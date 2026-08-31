import { callAI, parseJSON } from "./ai.server";
import { DEPLOY_THRESHOLD, type BlueprintEvidence, type StrategyBlueprint } from "./domain";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type ExtractResult = {
  strategy: StrategyBlueprint;
  evidence: BlueprintEvidence[];
  confidence: number;
  gap_notes: string;
};

export async function buildBlueprint(creatorIds: string[], name?: string) {
  const db = await admin();

  const { data: creators } = await db.from("creators").select("*").in("id", creatorIds);
  if (!creators?.length) throw new Error("Those creators could not be found.");

  const { data: videos } = await db
    .from("creator_videos")
    .select("*")
    .in("creator_id", creatorIds)
    .order("views", { ascending: false })
    .limit(80);

  const corpus = creators.map((c) => ({
    channel: c.channel_name,
    niche: c.niche,
    subscribers: c.subscribers,
    avg_views: c.avg_views,
    uploads_per_month: c.uploads_per_month,
    format: c.format,
    est_profit_per_video: c.est_profit_per_video,
    consistency: c.consistency_score,
    velocity: c.view_velocity,
    videos: (videos ?? [])
      .filter((v) => v.creator_id === c.id)
      .map((v) => ({
        title: v.title,
        views: v.views,
        hook: v.hook,
        thumbnail: v.thumbnail_desc,
        seconds: v.duration_seconds,
      })),
  }));

  const totalVideos = (videos ?? []).length;

  const raw = await callAI({
    model: "google/gemini-3.7-flash",
    system:
      "You reverse-engineer YouTube content strategy from public metadata. You extract STRUCTURE " +
      "(patterns, formulas, pacing, cadence), never verbatim copy. Every claim must be backed by " +
      "specific video titles from the supplied corpus. You are strict and calibrated about " +
      "confidence: with fewer than 20 sampled videos or a single source channel, confidence must " +
      "stay below 90. Respond with strict JSON only.",
    prompt:
      `Digest this corpus and extract the winning strategy.\n\n${JSON.stringify(corpus).slice(0, 24000)}\n\n` +
      `Return JSON:\n{\n` +
      `  "strategy": { "positioning": string, "hook_pattern": string, "title_formula": string, ` +
      `"thumbnail_grammar": string, "script_skeleton": string[] (5-8 beats), "pacing": string, ` +
      `"retention_devices": string[], "topic_ladder": string[] (6 escalating topic tiers), ` +
      `"upload_cadence": string, "ideal_length": string, "monetization_mix": string, "why_it_wins": string, ` +
      `"field_confidence": { "hook_pattern": number, "title_formula": number, "thumbnail_grammar": number, ` +
      `"script_skeleton": number, "topic_ladder": number, "upload_cadence": number } },\n` +
      `  "evidence": [ { "claim": string, "supporting_videos": string[], "confidence": number } ] (6-10 items),\n` +
      `  "confidence": number 0-100 (overall, calibrated to sample size and signal agreement),\n` +
      `  "gap_notes": string (exactly what extra data would raise confidence)\n}\n` +
      `Sample size: ${totalVideos} videos across ${creators.length} channels.`,
  });

  const result = parseJSON<ExtractResult>(raw);

  // Calibration floor: never let the model claim deployable confidence on thin evidence.
  let confidence = Math.max(0, Math.min(100, Number(result.confidence) || 0));
  const cap = totalVideos >= 40 && creators.length >= 3 ? 99 : totalVideos >= 20 ? 94 : 82;
  confidence = Math.min(confidence, cap);

  const gapNotes =
    confidence < DEPLOY_THRESHOLD
      ? result.gap_notes ||
        `Sample is thin (${totalVideos} videos, ${creators.length} channels). Add more creators in the same bracket and re-extract.`
      : (result.gap_notes ?? "");

  const { data: blueprint, error } = await db
    .from("blueprints")
    .insert({
      name: name || `${creators[0]!.niche} — ${creators.map((c) => c.channel_name)[0]} pattern`,
      niche: creators[0]!.niche,
      source_creator_ids: creatorIds,
      confidence,
      deployable: confidence >= DEPLOY_THRESHOLD,
      gap_notes: gapNotes,
      strategy: result.strategy ?? {},
      evidence: result.evidence ?? [],
      status: "ready",
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return blueprint;
}

/** Re-runs extraction with the widest available evidence, producing a next-generation blueprint. */
export async function evolveBlueprint(blueprintId: string) {
  const db = await admin();
  const { data: bp } = await db.from("blueprints").select("*").eq("id", blueprintId).maybeSingle();
  if (!bp) throw new Error("Blueprint not found.");

  const { data: peers } = await db
    .from("creators")
    .select("id")
    .eq("niche", bp.niche)
    .order("est_profit_per_video", { ascending: false })
    .limit(8);

  const ids = [...new Set([...(bp.source_creator_ids ?? []), ...(peers ?? []).map((p) => p.id)])].slice(
    0,
    8,
  );

  const next = await buildBlueprint(ids, `${bp.name} · gen ${(bp.generation ?? 1) + 1}`);
  await db
    .from("blueprints")
    .update({ generation: (bp.generation ?? 1) + 1, parent_id: bp.id })
    .eq("id", next.id);
  return next;
}
