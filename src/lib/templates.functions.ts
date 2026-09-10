import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const uuid = z.string().uuid();

const templateInput = z.object({
  id: uuid.nullable().default(null),
  name: z.string().trim().min(1).max(120),
  title: z.string().trim().max(200).default(""),
  hook: z.string().trim().max(2000).default(""),
  script: z.string().trim().max(20000).default(""),
  description: z.string().trim().max(5000).default(""),
  tags: z.array(z.string().trim().max(60)).max(20).default([]),
  visual_style: z.string().trim().max(1000).default(""),
  palette: z.string().trim().max(500).default(""),
  pacing: z.string().trim().max(500).default(""),
  shot_notes: z.string().trim().max(4000).default(""),
  thumbnail_prompt: z.string().trim().max(2000).default(""),
  duration_target: z.number().int().min(8).max(120).default(30),
  blueprint_id: uuid.nullable().default(null),
  brand_id: uuid.nullable().default(null),
});

export const listTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("video_templates")
      .select("*")
      .eq("owner_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const saveTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => templateInput.parse(data))
  .handler(async ({ data, context }) => {
    const { id, ...fields } = data;
    if (id) {
      const { error } = await context.supabase
        .from("video_templates")
        .update(fields)
        .eq("id", id)
        .eq("owner_id", context.userId);
      if (error) throw new Error(error.message);
      return { ok: true, id };
    }
    const { data: row, error } = await context.supabase
      .from("video_templates")
      .insert({ ...fields, owner_id: context.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id };
  });

export const deleteTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: uuid }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("video_templates")
      .delete()
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Turn a written template into a real draft video on a channel the user owns,
 * queued awaiting approval so it still goes through review before scheduling.
 */
export const createVideoFromTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ templateId: uuid, channelId: uuid }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: tpl } = await context.supabase
      .from("video_templates")
      .select("*")
      .eq("id", data.templateId)
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (!tpl) throw new Error("Template not found.");

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
        title: tpl.title || tpl.name,
        hook: tpl.hook,
        script: tpl.script,
        description: tpl.description,
        tags: tpl.tags ?? [],
        thumbnail_prompt: tpl.thumbnail_prompt,
        concept: [tpl.visual_style, tpl.palette, tpl.pacing, tpl.shot_notes]
          .filter(Boolean)
          .join(" · "),
        divergence_applied: channel.divergence,
        duration_target: tpl.duration_target,
        status: "ready",
        approved: false,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const { error: qError } = await context.supabase.from("publish_queue").insert({
      generated_video_id: video.id,
      channel_id: channel.id,
      scheduled_for: new Date(Date.now() + 24 * 3600_000).toISOString(),
      status: "awaiting_approval",
    });
    if (qError) throw new Error(qError.message);

    return { ok: true, videoId: video.id };
  });
