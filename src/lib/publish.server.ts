/** Uploads rendered videos to YouTube and drains the publish queue. */

import { accessTokenFor } from "./youtube-oauth.server";
import { renderVideoFile } from "./render.server";

const UPLOAD = "https://www.googleapis.com/upload/youtube/v3";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const JOB_ID = "publish";
const BATCH = 3;
const LEASE_MINUTES = 10;

async function uploadToYouTube(
  token: string,
  bytes: ArrayBuffer,
  meta: { title: string; description: string; tags: string[] },
): Promise<string> {
  const boundary = `chameleon${crypto.randomUUID().replace(/-/g, "")}`;
  const snippet = {
    snippet: {
      title: meta.title.slice(0, 95),
      description: meta.description.slice(0, 4900),
      tags: meta.tags.slice(0, 15),
      categoryId: "22",
    },
    status: { privacyStatus: "private", selfDeclaredMadeForKids: false },
  };

  const enc = new TextEncoder();
  const head = enc.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(snippet)}\r\n` +
      `--${boundary}\r\nContent-Type: video/mp4\r\n\r\n`,
  );
  const tail = enc.encode(`\r\n--${boundary}--\r\n`);
  const body = new Uint8Array(head.length + bytes.byteLength + tail.length);
  body.set(head, 0);
  body.set(new Uint8Array(bytes), head.length);
  body.set(tail, head.length + bytes.byteLength);

  const res = await fetch(`${UPLOAD}/videos?uploadType=multipart&part=snippet,status`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  const json = (await res.json()) as { id?: string; error?: { message?: string } };
  if (!res.ok || !json.id) {
    throw new Error(json.error?.message ?? `YouTube rejected the upload (${res.status}).`);
  }
  return json.id;
}

async function setThumbnail(token: string, videoId: string, url: string): Promise<void> {
  try {
    const img = await fetch(url);
    if (!img.ok) return;
    const bytes = await img.arrayBuffer();
    await fetch(`${UPLOAD}/thumbnails/set?videoId=${videoId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "image/png" },
      body: bytes,
    });
  } catch {
    /* thumbnails are best-effort; the upload already succeeded */
  }
}

/** Publishes one queue row end to end: render if needed, upload, record. */
export async function publishQueueItem(queueId: string): Promise<{ youtubeVideoId: string; url: string }> {
  const db = await admin();

  const { data: item } = await db
    .from("publish_queue")
    .select("*, generated_videos(*), channels(id, name, auto_publish)")
    .eq("id", queueId)
    .maybeSingle();
  if (!item) throw new Error("Queue item not found.");

  const video = item.generated_videos as {
    id: string;
    title: string;
    description: string | null;
    tags: string[] | null;
    video_url: string | null;
    thumbnail_url: string | null;
    approved: boolean;
  } | null;
  if (!video) throw new Error("This queue item has no video attached.");
  if (!video.approved) throw new Error("This video has not been approved yet.");

  await db.from("publish_queue").update({ status: "publishing" }).eq("id", queueId);

  try {
    const token = await accessTokenFor(item.channel_id);

    let path = video.video_url;
    if (!path) path = (await renderVideoFile(video.id)).videoUrl;

    const { data: file, error: dlErr } = await db.storage.from("renders").download(path);
    if (dlErr || !file) throw new Error(dlErr?.message ?? "Rendered file is missing.");
    const bytes = await file.arrayBuffer();

    const ytId = await uploadToYouTube(token, bytes, {
      title: video.title,
      description: video.description ?? "",
      tags: video.tags ?? [],
    });
    if (video.thumbnail_url) await setThumbnail(token, ytId, video.thumbnail_url);

    await db
      .from("publish_queue")
      .update({ status: "published", published_at: new Date().toISOString(), last_error: null })
      .eq("id", queueId);
    await db
      .from("generated_videos")
      .update({ status: "published", youtube_video_id: ytId })
      .eq("id", video.id);
    await db.from("performance_snapshots").insert({
      generated_video_id: video.id,
      channel_id: item.channel_id,
      blueprint_id: (item.generated_videos as { blueprint_id?: string | null })?.blueprint_id ?? null,
      outcome: "pending",
    });

    return { youtubeVideoId: ytId, url: `https://youtube.com/watch?v=${ytId}` };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Publish failed.";
    await db
      .from("publish_queue")
      .update({ status: "failed", last_error: message, attempts: (item.attempts ?? 0) + 1 })
      .eq("id", queueId);
    throw new Error(message);
  }
}

type JobState = { paused: boolean; pause_reason: string | null; lease_until: string | null; runs: number };

async function readJob(): Promise<JobState> {
  const db = await admin();
  const { data } = await db.from("job_state").select("*").eq("id", JOB_ID).maybeSingle();
  if (data) return data as JobState;
  await db.from("job_state").insert({ id: JOB_ID });
  return { paused: false, pause_reason: null, lease_until: null, runs: 0 };
}

async function pause(reason: string) {
  const db = await admin();
  await db.from("job_state").update({ paused: true, pause_reason: reason }).eq("id", JOB_ID);
}

export async function resumePublishing() {
  const db = await admin();
  await db.from("job_state").update({ paused: false, pause_reason: null }).eq("id", JOB_ID);
}

/**
 * Bounded, single-flight worker: publishes at most BATCH due items per run,
 * takes a lease so overlapping runs exit, and halts on billing/permission errors.
 */
export async function publishTick(): Promise<{
  skipped?: string;
  published: number;
  failed: number;
  paused?: string;
}> {
  const db = await admin();
  const job = await readJob();

  if (job.paused) return { skipped: `paused: ${job.pause_reason ?? "unknown"}`, published: 0, failed: 0 };
  if (job.lease_until && new Date(job.lease_until).getTime() > Date.now()) {
    return { skipped: "another run is in flight", published: 0, failed: 0 };
  }

  await db
    .from("job_state")
    .update({
      lease_until: new Date(Date.now() + LEASE_MINUTES * 60_000).toISOString(),
      last_run_at: new Date().toISOString(),
      runs: (job.runs ?? 0) + 1,
    })
    .eq("id", JOB_ID);

  // Auto-schedule (when enabled) tops the queue up before we drain it.
  try {
    const { autoScheduleApproved } = await import("./auto-schedule.server");
    await autoScheduleApproved();
  } catch {
    // Never let scheduling failures block publishing.
  }

  const { data: due } = await db
    .from("publish_queue")
    .select("id")
    .eq("status", "scheduled")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(BATCH);

  let published = 0;
  let failed = 0;
  let pausedReason: string | undefined;

  for (const row of due ?? []) {
    try {
      await publishQueueItem(row.id);
      published += 1;
    } catch (e) {
      failed += 1;
      const message = e instanceof Error ? e.message : "";
      if (/credit|quota exceeded|exhausted|forbidden|not configured|disabled/i.test(message)) {
        pausedReason = message;
        await pause(message);
        break;
      }
    }
  }

  await db.from("job_state").update({ lease_until: null }).eq("id", JOB_ID);
  return { published, failed, ...(pausedReason ? { paused: pausedReason } : {}) };
}
