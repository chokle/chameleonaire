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
  .handler(async ({ data }) => {
    const db = await admin();
    const { error } = await db.from("channels").insert(data);
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
  .handler(async ({ data }) => {
    const db = await admin();
    const { error } = await db.from("publish_queue").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    if (data.videoId) {
      await db
        .from("generated_videos")
        .update({ approved: data.status === "scheduled" })
        .eq("id", data.videoId);
    }
    return { ok: true };
  });

export const setVideoApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ videoId: uuid, approved: z.boolean() }).parse(data),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { error } = await db
      .from("generated_videos")
      .update({ approved: data.approved })
      .eq("id", data.videoId);
    if (error) throw new Error(error.message);
    await db
      .from("publish_queue")
      .update({ status: data.approved ? "scheduled" : "awaiting_approval" })
      .eq("generated_video_id", data.videoId)
      .in("status", ["awaiting_approval", "scheduled"]);
    return { ok: true };
  });
