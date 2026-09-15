import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ExtractInput = z.object({
  creatorIds: z.array(z.string().uuid()).min(1).max(8),
  name: z.string().min(1).max(120).optional(),
});

export const extractBlueprint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ExtractInput.parse(input))
  .handler(async ({ data }) => {
    const { buildBlueprint } = await import("./blueprint.server");
    return buildBlueprint(data.creatorIds, data.name);
  });

const RefineInput = z.object({ blueprintId: z.string().uuid() });

export const refineBlueprint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RefineInput.parse(input))
  .handler(async ({ data }) => {
    const { evolveBlueprint } = await import("./blueprint.server");
    return evolveBlueprint(data.blueprintId);
  });

const PinInput = z.object({ blueprintId: z.string().uuid(), pinned: z.boolean() });

/** Pin a blueprint to the top of the bank so it is easy to reuse. */
export const setBlueprintPinned = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PinInput.parse(input))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("blueprints")
      .update({ pinned: data.pinned })
      .eq("id", data.blueprintId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

const NotesInput = z.object({
  blueprintId: z.string().uuid(),
  notes: z.string().max(2000),
});

/** Free-text notes the operator keeps alongside a stored blueprint. */
export const setBlueprintNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => NotesInput.parse(input))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("blueprints")
      .update({ notes: data.notes.trim() || null })
      .eq("id", data.blueprintId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

const DuplicateInput = z.object({
  blueprintId: z.string().uuid(),
  name: z.string().min(1).max(120).optional(),
});

/** Copy a stored blueprint so it can be tweaked without losing the original. */
export const duplicateBlueprint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DuplicateInput.parse(input))
  .handler(async ({ context, data }) => {
    const { data: src, error } = await context.supabase
      .from("blueprints")
      .select("*")
      .eq("id", data.blueprintId)
      .single();
    if (error || !src) throw new Error(error?.message ?? "Blueprint not found");
    const { id: _id, created_at: _c, updated_at: _u, ...rest } = src;
    const { data: copy, error: insErr } = await context.supabase
      .from("blueprints")
      .insert({ ...rest, name: data.name ?? `${src.name} (copy)`, pinned: false, parent_id: src.id })
      .select("id")
      .single();
    if (insErr || !copy) throw new Error(insErr?.message ?? "Could not copy the blueprint");
    return { id: copy.id as string };
  });
