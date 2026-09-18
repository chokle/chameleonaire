import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const uuid = z.string().uuid();

/** Rewrite the operator's own pasted content as an original short on their channel. */
export const rewriteOwnContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        source: z.string().trim().min(30).max(20000),
        channelId: uuid.nullable().default(null),
        blueprintId: uuid.nullable().default(null),
        durationTarget: z.number().int().min(15).max(120).default(45),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    let channelName = "your channel";
    let brand: Record<string, unknown> | null = null;
    let blueprintId = data.blueprintId;

    if (data.channelId) {
      const { data: channel } = await context.supabase
        .from("channels")
        .select("id, name, blueprint_id, brands(*)")
        .eq("id", data.channelId)
        .eq("owner_id", context.userId)
        .maybeSingle();
      if (!channel) throw new Error("Channel not found or not owned by you.");
      channelName = channel.name;
      brand = (channel.brands as Record<string, unknown> | null) ?? null;
      blueprintId = blueprintId ?? channel.blueprint_id;
    }

    const { figuresForBlueprint } = await import("./blueprint-figures.server");
    const { rewriteAsShort } = await import("./repurpose.server");
    const figures = await figuresForBlueprint(context.supabase, blueprintId);
    const short = await rewriteAsShort({
      source: data.source,
      brand,
      channelName,
      durationTarget: data.durationTarget,
      figures,
    });
    return { short, figures: figures.claims };
  });

/** Look up the numbers a blueprint allows, so the page can show them up front. */
export const blueprintFigures = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ blueprintId: uuid.nullable().default(null) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { figuresForBlueprint } = await import("./blueprint-figures.server");
    const figures = await figuresForBlueprint(context.supabase, data.blueprintId);
    return { claims: figures.claims };
  });

/** Queue the rewritten short on a channel the user owns, awaiting approval. */
export const queueRewrittenShort = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        channelId: uuid,
        title: z.string().trim().min(2).max(95),
        hook: z.string().trim().max(1000).default(""),
        script: z.string().trim().min(30).max(20000),
        description: z.string().trim().max(4900).default(""),
        tags: z.array(z.string().trim().max(60)).max(15).default([]),
        thumbnailPrompt: z.string().trim().max(2000).default(""),
        concept: z.string().trim().max(500).default(""),
        durationTarget: z.number().int().min(15).max(120).default(45),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: channel } = await context.supabase
      .from("channels")
      .select("id, blueprint_id, divergence")
      .eq("id", data.channelId)
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (!channel) throw new Error("Channel not found or not owned by you.");

    const { data: video, error } = await context.supabase
      .from("generated_videos")
      .insert({
        channel_id: channel.id,
        blueprint_id: channel.blueprint_id,
        title: data.title,
        hook: data.hook,
        script: data.script,
        description: data.description,
        tags: data.tags,
        thumbnail_prompt: data.thumbnailPrompt,
        concept: `${data.concept} · repurposed from your own content`,
        divergence_applied: channel.divergence,
        duration_target: data.durationTarget,
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
