import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ChannelInput = z.object({ channelId: z.string().uuid() });

export const youtubeConnectUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ChannelInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: channel } = await context.supabase
      .from("channels")
      .select("id")
      .eq("id", data.channelId)
      .single();
    if (!channel) throw new Error("Channel not found or not owned by you.");
    const { buildConsentUrl } = await import("./youtube-oauth.server");
    return { url: await buildConsentUrl(data.channelId) };
  });

const IdInput = z.object({ channelId: z.string().uuid() });

export const youtubeDisconnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => IdInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: channel } = await context.supabase
      .from("channels")
      .select("id")
      .eq("id", data.channelId)
      .single();
    if (!channel) throw new Error("Channel not found or not owned by you.");
    const { disconnect } = await import("./youtube-oauth.server");
    await disconnect(data.channelId, context.userId);
    return { ok: true };
  });

export const youtubeReady = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth]).handler(async () => {
    const { oauthCreds } = await import("./youtube-oauth.server");
    return {
      oauth: oauthCreds() !== null,
      dataApi: Boolean(process.env["YOUTUBE_API_KEY"]),
    };
  });

const PendingInput = z.object({ state: z.string().min(1) });

export const youtubePendingChannels = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PendingInput.parse(input))
  .handler(async ({ data }) => {
    const { getPendingOAuthState } = await import("./youtube-oauth.server");
    const pending = await getPendingOAuthState(data.state);
    if (!pending) throw new Error("This pick link has expired. Start the connection again.");
    return {
      channelId: pending.channelId,
      channels: pending.channels,
    };
  });

const PickInput = z.object({ state: z.string().min(1), youtubeChannelId: z.string().min(1) });

export const youtubePickChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PickInput.parse(input))
  .handler(async ({ data, context }) => {
    const { finalizeChannelPick } = await import("./youtube-oauth.server");
    return finalizeChannelPick(data.state, data.youtubeChannelId, context.userId);
  });

const VideoInput = z.object({
  videoId: z.string().uuid(),
  durationTarget: z.number().int().min(8).max(120).optional(),
});

export const renderVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => VideoInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: video } = await context.supabase
      .from("generated_videos")
      .select("id, channel_id")
      .eq("id", data.videoId)
      .single();
    if (!video) throw new Error("Video not found or not owned by you.");
    const { renderVideoFile } = await import("./render.server");
    return renderVideoFile(data.videoId, data.durationTarget, context.userId);
  });

const DurationInput = z.object({
  videoId: z.string().uuid(),
  durationTarget: z.number().int().min(8).max(120),
});

export const setVideoDurationTarget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DurationInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("generated_videos")
      .update({ duration_target: data.durationTarget })
      .eq("id", data.videoId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const QueueInput = z.object({ queueId: z.string().uuid() });

export const publishNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => QueueInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: queue } = await context.supabase
      .from("publish_queue")
      .select("id, channel_id")
      .eq("id", data.queueId)
      .single();
    if (!queue) throw new Error("Queue item not found or not owned by you.");
    const { publishQueueItem } = await import("./publish.server");
    return publishQueueItem(data.queueId);
  });

export const runPublishTick = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth]).handler(async () => {
    const { publishTick } = await import("./publish.server");
    return publishTick();
  });

export const resumePublishQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth]).handler(async () => {
    const { resumePublishing } = await import("./publish.server");
    await resumePublishing();
    return { ok: true };
  });
