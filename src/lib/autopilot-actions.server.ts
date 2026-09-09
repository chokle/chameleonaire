/** Shared queue/scheduling helpers used by both the app and the ChatGPT action layer. */

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Approves a video and makes sure it has a scheduled queue row. */
export async function scheduleGeneratedVideo(videoId: string, scheduledFor: string | null) {
  const db = await admin();
  const { data: video, error } = await db
    .from("generated_videos")
    .select("id, title, channel_id")
    .eq("id", videoId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!video) throw new Error("Video not found.");

  await db.from("generated_videos").update({ approved: true, status: "scheduled" }).eq("id", videoId);

  const when = scheduledFor ?? new Date(Date.now() + 60 * 60_000).toISOString();
  const { data: existing } = await db
    .from("publish_queue")
    .select("id")
    .eq("generated_video_id", videoId)
    .maybeSingle();

  if (existing) {
    await db.from("publish_queue").update({ status: "scheduled", scheduled_for: when }).eq("id", existing.id);
    return { queueId: existing.id, scheduledFor: when, title: video.title };
  }

  const { data: inserted, error: insErr } = await db
    .from("publish_queue")
    .insert({
      generated_video_id: videoId,
      channel_id: video.channel_id,
      scheduled_for: when,
      status: "scheduled",
    })
    .select("id")
    .single();
  if (insErr || !inserted) throw new Error(insErr?.message ?? "Could not queue the video.");
  return { queueId: inserted.id, scheduledFor: when, title: video.title };
}
