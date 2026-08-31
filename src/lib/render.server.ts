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

type Job = { id: string; status: string; error?: { message?: string } };

async function startJob(prompt: string): Promise<string> {
  const res = await fetch(VIDEOS, {
    method: "POST",
    headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/veo-3.1-lite",
      prompt: prompt.slice(0, 1500),
      resolution: "1080p",
      duration: 8,
      aspect_ratio: "16:9",
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 402) throw new Error("AI credits are exhausted — top up to keep rendering.");
    if (res.status === 429) throw new Error("Rendering is rate limited right now. Try again shortly.");
    throw new Error(`Video render failed (${res.status}): ${text.slice(0, 200)}`);
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

/** Builds the shot prompt from the video's own concept + brand palette. */
function shotPrompt(v: {
  title: string;
  hook?: string | null;
  concept?: string | null;
  thumbnail_prompt?: string | null;
}, palette: string | null): string {
  return [
    `Opening shot for a YouTube video titled "${v.title}".`,
    v.hook ? `It must visually deliver this hook: ${v.hook}` : "",
    v.concept ? `Context: ${v.concept}` : "",
    v.thumbnail_prompt ? `Visual grammar: ${v.thumbnail_prompt}` : "",
    palette ? `Colour palette: ${palette}.` : "",
    "Cinematic, high contrast, no on-screen text, no watermarks, no recognisable real people.",
  ]
    .filter(Boolean)
    .join(" ");
}

/** Renders a generated video and uploads the file to the private renders bucket. */
export async function renderVideoFile(videoId: string): Promise<{ videoUrl: string }> {
  const db = await admin();

  const { data: video } = await db
    .from("generated_videos")
    .select("*, channels(id, name, brands(palette))")
    .eq("id", videoId)
    .maybeSingle();
  if (!video) throw new Error("Video not found.");
  if (video.video_url) return { videoUrl: video.video_url };

  await db.from("generated_videos").update({ render_status: "rendering", render_error: null }).eq("id", videoId);

  try {
    const channel = video.channels as { brands?: { palette?: string | null } | null } | null;
    const jobId = await startJob(shotPrompt(video, channel?.brands?.palette ?? null));
    await waitForJob(jobId, 5 * 60_000);
    const bytes = await downloadJob(jobId);

    const path = `${video.channel_id}/${videoId}.mp4`;
    const { error: upErr } = await db.storage
      .from("renders")
      .upload(path, bytes, { contentType: "video/mp4", upsert: true });
    if (upErr) throw new Error(upErr.message);

    await db
      .from("generated_videos")
      .update({ video_url: path, render_status: "rendered", duration_seconds: 8 })
      .eq("id", videoId);

    return { videoUrl: path };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Render failed.";
    await db.from("generated_videos").update({ render_status: "failed", render_error: message }).eq("id", videoId);
    throw new Error(message);
  }
}

/** Signed URL so the UI can preview a rendered file from the private bucket. */
export async function previewUrl(path: string): Promise<string | null> {
  const db = await admin();
  const { data } = await db.storage.from("renders").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}
