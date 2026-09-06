import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ChannelInput = z.object({ channelId: z.string().uuid() });

export const youtubeConnectUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ChannelInput.parse(input))
  .handler(async ({ data }) => {
    const { buildConsentUrl } = await import("./youtube-oauth.server");
    return { url: await buildConsentUrl(data.channelId) };
  });

const IdInput = z.object({ channelId: z.string().uuid() });

export const youtubeDisconnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => IdInput.parse(input))
  .handler(async ({ data }) => {
    const { disconnect } = await import("./youtube-oauth.server");
    await disconnect(data.channelId);
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

const VideoInput = z.object({ videoId: z.string().uuid() });

export const renderVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => VideoInput.parse(input))
  .handler(async ({ data }) => {
    const { renderVideoFile } = await import("./render.server");
    return renderVideoFile(data.videoId);
  });

const QueueInput = z.object({ queueId: z.string().uuid() });

export const publishNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => QueueInput.parse(input))
  .handler(async ({ data }) => {
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
