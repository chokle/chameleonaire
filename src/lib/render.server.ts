/** Renders a generated concept into an actual video file and stores it. */

const VIDEOS = "https://ai.gateway.lovable.dev/v1/videos";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function key(): string {
  const k = process.env["LOVABLE_API_KEY"];
  if (!k) throw new Error("AI is not configured for this project.");
  return k;
}

type Job = { id: string; status: string; progress?: number; error?: { message?: string } };
type RenderJobRecord = { id: string; status: string; duration_seconds?: number | null };

function hopsForTarget(targetSeconds: number): number {
  if (targetSeconds <= 8) return 1;
  return 1 + Math.ceil((targetSeconds - 8) / 7);
}

async function startJob(prompt: string): Promise<string> {
  const res = await fetch(VIDEOS, {
    method: "POST",
    headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/veo-3.1-lite",
      instances: [{ prompt: prompt.slice(0, 1500) }],
      parameters: {
        durationSeconds: 8,
        resolution: "720p",
        aspectRatio: "16:9",
        sampleCount: 1,
        generateAudio: true,
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 402) throw new Error("AI credits are exhausted — top up to keep rendering.");
    if (res.status === 429) throw new Error("Rendering is rate limited right now. Try again shortly.");
    if (res.status === 413) throw new Error("Video segment was too large to extend. Try a shorter target or lower resolution.");
    throw new Error(`Video render failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return ((await res.json()) as Job).id;
}

async function extendJob(videoBytes: ArrayBuffer, prompt: string): Promise<string> {
  const base64 = Buffer.from(videoBytes).toString("base64");
  const res = await fetch(VIDEOS, {
    method: "POST",
    headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/veo-3.1-lite",
      instances: [
        {
          prompt: prompt.slice(0, 1500),
          video: { bytesBase64Encoded: base64, mimeType: "video/mp4" },
        },
      ],
      parameters: {
        durationSeconds: 7,
        resolution: "720p",
        sampleCount: 1,
        generateAudio: true,
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 402) throw new Error("AI credits are exhausted — top up to keep rendering.");
    if (res.status === 429) throw new Error("Rendering is rate limited right now. Try again shortly.");
    if (res.status === 413) throw new Error("Video segment was too large to extend. Try a shorter target or lower resolution.");
    throw new Error(`Video extension failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return ((await res.json()) as Job).id;
}

async function waitForJob(id: string, budgetMs: number): Promise<void> {
  const deadline = Date.now() + budgetMs;
  for (;;) {
    if (Date.now() > deadline) throw new Error("Render is taking longer than expected — try again in a minute.");
    await new Promise((r) => setTimeout(r, 8000));
    const res = await fetch(`${VIDEOS}/${id}`, { headers: { Authorization: `Bearer ${key()}` } });
    const job = (await res.json()) as Job;
    if (job.status === "completed") return;
    if (job.status === "failed") throw new Error(job.error?.message ?? "The renderer could not finish this video.");
  }
}

async function downloadJob(id: string): Promise<ArrayBuffer> {
  const res = await fetch(`${VIDEOS}/${id}/content`, {
    headers: { Authorization: `Bearer ${key()}` },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`Could not download the rendered video (${res.status}).`);
  return res.arrayBuffer();
}

/** Builds the opening shot prompt from the video's own concept + brand palette. */
function shotPrompt(
  v: {
    title: string;
    hook?: string | null;
    concept?: string | null;
    thumbnail_prompt?: string | null;
  },
  palette: string | null,
): string {
  return [
    `Opening shot for a YouTube video titled "${v.title}".`,
    v.hook ? `It must visually deliver this hook: ${v.hook}` : "",
    v.concept ? `Context: ${v.concept}` : "",
    v.thumbnail_prompt ? `Visual grammar: ${v.thumbnail_prompt}` : "",
    palette ? `Colour palette: ${palette}.` : "",
    "Cinematic, high contrast, no on-screen text, no watermarks, no recognisable real people.",
    "Single continuous scene that can be extended seamlessly.",
  ]
    .filter(Boolean)
    .join(" ");
}

/** Builds the continuation prompt for each extension hop. */
function extensionPrompt(
  v: {
    title: string;
    hook?: string | null;
    concept?: string | null;
    thumbnail_prompt?: string | null;
  },
  palette: string | null,
): string {
  return [
    `The scene continues seamlessly from the previous shot of a YouTube video titled "${v.title}".`,
    v.hook ? `Keep delivering this hook: ${v.hook}` : "",
    v.concept ? `Context: ${v.concept}` : "",
    v.thumbnail_prompt ? `Visual grammar: ${v.thumbnail_prompt}` : "",
    palette ? `Colour palette: ${palette}.` : "",
    "Cinematic, high contrast, no on-screen text, no watermarks, no recognisable real people.",
    "The camera, lighting, and subject stay the same; the motion continues naturally without a cut.",
  ]
    .filter(Boolean)
    .join(" ");
}

/** Renders a generated video and uploads the file to the private renders bucket. */
export async function renderVideoFile(
  videoId: string,
  durationTarget = 30,
  userId?: string,
): Promise<{ videoUrl: string; durationSeconds: number }> {
  const db = await admin();

  const { data: video } = await db
    .from("generated_videos")
    .select("*, channels(id, name, owner_id, brands(palette))")
    .eq("id", videoId)
    .maybeSingle();
  if (!video) throw new Error("Video not found.");
  const channel = video.channels as { owner_id?: string } | null;
  if (userId && channel?.owner_id !== userId) {
    throw new Error("Video not found or not owned by you.");
  }
  if (video.video_url) return { videoUrl: video.video_url, durationSeconds: video.duration_seconds ?? 0 };

  const target = Math.max(8, Math.min(120, durationTarget));
  const jobs: RenderJobRecord[] = [];
  await db
    .from("generated_videos")
    .update({ render_status: "rendering", render_error: null, duration_target: target, render_jobs: jobs })
    .eq("id", videoId);

  try {
    const channel = video.channels as { brands?: { palette?: string | null } | null } | null;
    const basePrompt = shotPrompt(video, channel?.brands?.palette ?? null);
    const continuePrompt = extensionPrompt(video, channel?.brands?.palette ?? null);

    let currentBytes: ArrayBuffer;
    let totalSeconds = 0;

    // Base generation: 8 seconds
    const baseJobId = await startJob(basePrompt);
    jobs.push({ id: baseJobId, status: "in_progress" });
    await db.from("generated_videos").update({ render_jobs: jobs }).eq("id", videoId);
    await waitForJob(baseJobId, 6 * 60_000);
    jobs[0]!.status = "completed";
    await db.from("generated_videos").update({ render_jobs: jobs }).eq("id", videoId);
    currentBytes = await downloadJob(baseJobId);
    totalSeconds += 8;

    // Extend until we hit the target
    while (totalSeconds < target) {
      const nextJobId = await extendJob(currentBytes, continuePrompt);
      jobs.push({ id: nextJobId, status: "in_progress" });
      await db.from("generated_videos").update({ render_jobs: jobs }).eq("id", videoId);
      await waitForJob(nextJobId, 6 * 60_000);
      jobs[jobs.length - 1]!.status = "completed";
      await db.from("generated_videos").update({ render_jobs: jobs }).eq("id", videoId);
      currentBytes = await downloadJob(nextJobId);
      totalSeconds += 7;
    }

    const path = `${video.channel_id}/${videoId}.mp4`;
    const { error: upErr } = await db.storage.from("renders").upload(path, currentBytes, {
      contentType: "video/mp4",
      upsert: true,
    });
    if (upErr) throw new Error(upErr.message);

    await db
      .from("generated_videos")
      .update({ video_url: path, render_status: "rendered", duration_seconds: totalSeconds, render_jobs: jobs })
      .eq("id", videoId);

    return { videoUrl: path, durationSeconds: totalSeconds };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Render failed.";
    await db
      .from("generated_videos")
      .update({ render_status: "failed", render_error: message, render_jobs: jobs })
      .eq("id", videoId);
    throw new Error(message);
  }
}

/** Signed URL so the UI can preview a rendered file from the private bucket. */
export async function previewUrl(path: string): Promise<string | null> {
  const db = await admin();
  const { data } = await db.storage.from("renders").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}
