import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Write-side operations for the operator console.
 *
 * The browser is read-only against the database (anon has SELECT only), so every
 * mutation the UI performs goes through these server handlers, which validate the
 * payload before touching the service-role client.
 */

const uuid = z.string().uuid();

const brandInput = z.object({
  name: z.string().trim().min(1).max(120),
  voice: z.string().trim().max(2000).default(""),
  subject: z.string().trim().max(2000).default(""),
  palette: z.string().trim().max(500).default(""),
  audience: z.string().trim().max(1000).default(""),
  banned_topics: z.string().trim().max(2000).default(""),
});

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const createBrand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => brandInput.parse(data))
  .handler(async ({ data }) => {
    const db = await admin();
    const { error } = await db.from("brands").insert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteBrand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: uuid }).parse(data))
  .handler(async ({ data }) => {
    const db = await admin();
    const { error } = await db.from("brands").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        name: z.string().trim().min(1).max(120),
        blueprint_id: uuid.nullable(),
        brand_id: uuid.nullable(),
        divergence: z.number().int().min(0).max(100),
        uploads_per_week: z.number().int().min(1).max(21),
        auto_publish: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("channels")
      .insert({ ...data, owner_id: context.userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: uuid }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: channel, error: readError } = await context.supabase
      .from("channels")
      .select("id, owner_id")
      .eq("id", data.id)
      .single();
    if (readError || !channel) throw new Error("Channel not found.");
    if (channel.owner_id !== context.userId) throw new Error("You do not own this channel.");

    const db = await admin();
    // Remove dependent rows first; FK constraints block the channel delete otherwise.
    const { data: videos } = await db
      .from("generated_videos")
      .select("id")
      .eq("channel_id", data.id);
    const videoIds = (videos ?? []).map((v) => v.id);
    if (videoIds.length > 0) {
      await db.from("publish_queue").delete().in("generated_video_id", videoIds);
      await db.from("performance_snapshots").delete().in("generated_video_id", videoIds);
    }
    await db.from("publish_queue").delete().eq("channel_id", data.id);
    await db.from("performance_snapshots").delete().eq("channel_id", data.id);
    await db.from("generated_videos").delete().eq("channel_id", data.id);
    await db.from("youtube_accounts").delete().eq("channel_id", data.id);
    await db.from("oauth_states").delete().eq("channel_id", data.id);

    const { error } = await db.from("channels").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setQueueStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: uuid,
        status: z.enum(["awaiting_approval", "scheduled", "publishing", "published", "failed", "cancelled"]),
        videoId: uuid.nullable().default(null),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("publish_queue")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    if (data.videoId) {
      await context.supabase
        .from("generated_videos")
        .update({ approved: data.status === "scheduled" })
        .eq("id", data.videoId);
    }
    return { ok: true };
  });

/**
 * Edits the title, description and tags that YouTube will show on the upload.
 * Ownership is checked through the video's channel before anything is written.
 */
export const updateVideoMetadata = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        videoId: uuid,
        title: z.string().trim().min(1).max(95),
        description: z.string().trim().max(4900).default(""),
        tags: z.array(z.string().trim().min(1).max(60)).max(15).default([]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: video } = await db
      .from("generated_videos")
      .select("id, channel_id")
      .eq("id", data.videoId)
      .maybeSingle();
    if (!video) throw new Error("Video not found.");

    const { data: channel } = await db
      .from("channels")
      .select("owner_id")
      .eq("id", video.channel_id)
      .maybeSingle();
    if (!channel || channel.owner_id !== context.userId) {
      throw new Error("Video not found or not owned by you.");
    }

    const { error } = await db
      .from("generated_videos")
      .update({ title: data.title, description: data.description, tags: data.tags })
      .eq("id", data.videoId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const setVideoApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ videoId: uuid, approved: z.boolean() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("generated_videos")
      .update({ approved: data.approved })
      .eq("id", data.videoId);
    if (error) throw new Error(error.message);

    // Unapproving pulls a not-yet-published video back out of the queue.
    if (!data.approved) {
      await context.supabase
        .from("publish_queue")
        .update({ status: "awaiting_approval" })
        .eq("generated_video_id", data.videoId)
        .eq("status", "scheduled");
      return { ok: true, published: false as const };
    }

    // Approving publishes straight away: mark the queue row due now, then
    // upload inline. A failure is recorded on the row, never thrown past the
    // approval write, so the operator can retry.
    const now = new Date().toISOString();
    await context.supabase
      .from("publish_queue")
      .update({ status: "scheduled", scheduled_for: now })
      .eq("generated_video_id", data.videoId)
      .in("status", ["awaiting_approval", "failed", "cancelled"]);

    const { data: queued } = await context.supabase
      .from("publish_queue")
      .select("id, status")
      .eq("generated_video_id", data.videoId)
      .eq("status", "scheduled")
      .order("scheduled_for", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!queued) return { ok: true, published: false as const };

    try {
      const { publishQueueItem } = await import("./publish.server");
      const result = await publishQueueItem(queued.id, "public");
      return { ok: true, published: true as const, url: result.url };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Publish failed.";
      return { ok: true, published: false as const, error: message };
    }
  });

