import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const uuid = z.string().uuid();

/** Read a long-form video from any public URL and propose short-form moments. */
export const analyzeClipSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        url: z.string().trim().url().max(2000),
        count: z.number().int().min(1).max(8).default(5),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { readSource, suggestMoments } = await import("./clips.server");
    const source = await readSource(data.url);
    const moments = await suggestMoments(source, data.count);
    return { source, moments };
  });

/** Turn a clip moment into an original short queued on a channel the user owns. */
export const createShortFromMoment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        channelId: uuid,
        sourceUrl: z.string().trim().url().max(2000),
        sourceTitle: z.string().trim().max(300).default(""),
        start: z.number().min(0).max(86400),
        end: z.number().min(1).max(86400),
        label: z.string().trim().min(2).max(160),
        why: z.string().trim().max(400).default(""),
        angle: z.string().trim().max(600).default(""),
        durationTarget: z.number().int().min(15).max(120).default(45),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: channel } = await context.supabase
      .from("channels")
      .select("id, name, blueprint_id, divergence, brands(*)")
      .eq("id", data.channelId)
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (!channel) throw new Error("Channel not found or not owned by you.");

    const { writeShort, hhmmss } = await import("./clips.server");
    const short = await writeShort({
      source: {
        url: data.sourceUrl,
        platform: "web",
        title: data.sourceTitle,
        author: "",
        description: "",
        durationSeconds: 0,
      },
      moment: { start: data.start, end: data.end, label: data.label, why: data.why, angle: data.angle },
      brand: (channel.brands as Record<string, unknown> | null) ?? null,
      channelName: channel.name,
      durationTarget: data.durationTarget,
    });

    const { data: video, error } = await context.supabase
      .from("generated_videos")
      .insert({
        channel_id: channel.id,
        blueprint_id: channel.blueprint_id,
        title: short.title,
        hook: short.hook,
        script: short.script,
        description: short.description,
        tags: short.tags,
        thumbnail_prompt: short.thumbnail_prompt,
        concept: `${short.concept} · clipped from ${hhmmss(data.start)}–${hhmmss(data.end)} of ${data.sourceUrl}`,
        divergence_applied: channel.divergence,
        duration_target: short.duration_target,
        status: "ready",
        approved: false,
      })
      .select("id, title")
      .single();
    if (error) throw new Error(error.message);

    const { error: qError } = await context.supabase.from("publish_queue").insert({
      generated_video_id: video.id,
      channel_id: channel.id,
      scheduled_for: new Date(Date.now() + 24 * 3600_000).toISOString(),
      status: "awaiting_approval",
    });
    if (qError) throw new Error(qError.message);

    return { ok: true, videoId: video.id, title: video.title };
  });
