import { callAI, parseJSON } from "./ai.server";
import { DEPLOY_THRESHOLD } from "./domain";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type Concept = {
  concept: string;
  title: string;
  hook: string;
  script: string;
  description: string;
  tags: string[];
  thumbnail_prompt: string;
};

export async function generateForChannel(channelId: string, count: number, userId?: string) {
  const db = await admin();

  const { data: channel } = await db
    .from("channels")
    .select("*, blueprints(*), brands(*)")
    .eq("id", channelId)
    .maybeSingle();
  if (!channel) throw new Error("Channel not found.");
  if (userId && channel.owner_id !== userId) {
    throw new Error("Channel not found or not owned by you.");
  }

  const blueprint = channel.blueprints as { strategy?: unknown; confidence?: number; name?: string } | null;
  const brand = channel.brands as Record<string, unknown> | null;

  if (!blueprint) throw new Error("Attach a blueprint to this channel first.");
  if ((blueprint.confidence ?? 0) < DEPLOY_THRESHOLD) {
    throw new Error(
      `Blueprint confidence is ${Math.round(blueprint.confidence ?? 0)}% — below the ${DEPLOY_THRESHOLD}% deploy gate.`,
    );
  }

  const { data: recent } = await db
    .from("generated_videos")
    .select("title")
    .eq("channel_id", channelId)
    .order("created_at", { ascending: false })
    .limit(20);

  const raw = await callAI({
    model: "google/gemini-3.7-flash",
    system:
      "You are a content producer. You apply a proven structural blueprint to an original brand. " +
      "You copy STRUCTURE only: hook shape, title formula, pacing, cadence, thumbnail grammar. " +
      "You never reuse a source creator's exact titles, scripts, thumbnails, likeness or claims, " +
      "and you never reference the source creators. " +
      "Every concept must be EVERGREEN: a timeless problem, question, or curiosity that stays relevant " +
      "for years and compounds search/suggested traffic — never news, trends, memes, current events, " +
      "dates, years, or anything that expires. Prefer 'how to', 'why', 'mistakes', 'explained' angles " +
      "that a viewer could search for in 3 years and still find fully accurate. " +
      "Respond with strict JSON only.",
    prompt:
      `BLUEPRINT (structure to follow):\n${JSON.stringify(blueprint.strategy).slice(0, 12000)}\n\n` +
      `BRAND (the identity all output must belong to):\n${JSON.stringify({
        name: brand?.["name"] ?? channel.name,
        voice: brand?.["voice"] ?? "confident, plain-spoken",
        subject: brand?.["subject"] ?? channel.name,
        palette: brand?.["palette"] ?? "high-contrast",
        audience: brand?.["audience"] ?? "general",
        avoid: brand?.["banned_topics"] ?? "none",
      })}\n\n` +
      `DIVERGENCE: ${channel.divergence}% — 0 means hug the blueprint structure tightly, 100 means keep only its ` +
      `underlying principle and reinvent the surface. Apply it to angle, format and tone.\n\n` +
      `ALREADY PUBLISHED (do not repeat): ${JSON.stringify((recent ?? []).map((r) => r.title))}\n\n` +
      `Produce ${count} new videos. Return JSON: { "videos": [ { "concept": string, "title": string, ` +
      `"hook": string (first 8 seconds, verbatim), "script": string (full spoken script, follow the blueprint's ` +
      `beat structure, 350-700 words), "description": string, "tags": string[] (8-12), ` +
      `"thumbnail_prompt": string (image-model prompt matching the blueprint's thumbnail grammar in the brand palette) } ] }`,
  });

  const parsed = parseJSON<{ videos: Concept[] }>(raw);
  const rows = (parsed.videos ?? []).slice(0, count).map((v) => ({
    channel_id: channelId,
    blueprint_id: channel.blueprint_id,
    title: v.title,
    hook: v.hook,
    script: v.script,
    description: v.description,
    tags: v.tags ?? [],
    thumbnail_prompt: v.thumbnail_prompt,
    concept: v.concept,
    divergence_applied: channel.divergence,
    status: "ready",
    approved: channel.auto_publish,
  }));

  if (!rows.length) throw new Error("The engine returned no usable concepts. Try again.");

  const { data: inserted, error } = await db.from("generated_videos").insert(rows).select();
  if (error) throw new Error(error.message);

  // Queue each new video on the channel's cadence.
  const gapHours = Math.max(6, Math.round((7 * 24) / Math.max(1, Number(channel.uploads_per_week))));
  const queue = (inserted ?? []).map((v, i) => ({
    generated_video_id: v.id,
    channel_id: channelId,
    scheduled_for: new Date(Date.now() + gapHours * 3600_000 * (i + 1)).toISOString(),
    status: channel.auto_publish ? "scheduled" : "awaiting_approval",
  }));
  if (queue.length) await db.from("publish_queue").insert(queue);

  if (channel.status === "draft") {
    await db.from("channels").update({ status: "active" }).eq("id", channelId);
  }

  return { created: inserted?.length ?? 0 };
}

export async function makeThumbnail(videoId: string, userId?: string) {
  const db = await admin();
  const { data: video } = await db
    .from("generated_videos")
    .select("id, thumbnail_prompt, title, channel_id")
    .eq("id", videoId)
    .maybeSingle();
  if (!video) throw new Error("Video not found.");
  if (userId) {
    const { data: channel } = await db
      .from("channels")
      .select("owner_id")
      .eq("id", video.channel_id)
      .maybeSingle();
    if (!channel || channel.owner_id !== userId) {
      throw new Error("Video not found or not owned by you.");
    }
  }

  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI is not configured.");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "google/gemini-3.1-flash-image",
      messages: [
        {
          role: "user",
          content:
            `YouTube thumbnail, 16:9, high contrast, readable at small size. ` +
            `${video.thumbnail_prompt ?? video.title}. No watermarks, no real people's likenesses.`,
        },
      ],
      modalities: ["image", "text"],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Thumbnail generation failed (${res.status}). ${body.slice(0, 200)}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { images?: Array<{ image_url?: { url?: string } }> } }>;
  };
  const url = json.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!url) throw new Error("No image came back from the model.");

  await db.from("generated_videos").update({ thumbnail_url: url }).eq("id", videoId);
  return { url };
}

/**
 * The forever loop: reads back performance, scores each blueprint's win rate,
 * and nudges channel divergence toward whatever is currently working.
 */
export async function learnFromPerformance(channelId: string | null, userId?: string) {
  const db = await admin();

  let q = db.from("performance_snapshots").select("*").order("captured_at", { ascending: false }).limit(500);
  if (channelId) q = q.eq("channel_id", channelId);
  const { data: snaps } = await q;

  if (userId && snaps) {
    const ownedChannelIds = new Set(
      (await db.from("channels").select("id").eq("owner_id", userId)).data?.map((c) => c.id) ?? [],
    );
    const filtered = snaps.filter((s) => ownedChannelIds.has(s.channel_id));
    return learnFromSnapshotRows(filtered, db, userId);
  }

  return learnFromSnapshotRows(snaps ?? [], db);
}

async function learnFromSnapshotRows(
  snaps: { blueprint_id: string | null; outcome: string | null; channel_id: string }[],
  db: Awaited<ReturnType<typeof admin>>,
  userId?: string,
) {

  const byBlueprint = new Map<string, { wins: number; total: number }>();
  for (const s of snaps ?? []) {
    if (!s.blueprint_id) continue;
    const entry = byBlueprint.get(s.blueprint_id) ?? { wins: 0, total: 0 };
    entry.total += 1;
    if (s.outcome === "win") entry.wins += 1;
    byBlueprint.set(s.blueprint_id, entry);
  }

  const updates: Array<{ id: string; win_rate: number }> = [];
  for (const [id, { wins, total }] of byBlueprint) {
    const winRate = total ? Math.round((wins / total) * 100) : 0;
    updates.push({ id, win_rate: winRate });
    await db.from("blueprints").update({ win_rate: winRate }).eq("id", id);
  }

  // Channels riding a losing blueprint drift further from it; winners tighten up.
  let channelsQ = db.from("channels").select("id, blueprint_id, divergence");
  if (userId) channelsQ = channelsQ.eq("owner_id", userId);
  const { data: channels } = await channelsQ;
  for (const c of channels ?? []) {
    if (!c.blueprint_id) continue;
    const stat = byBlueprint.get(c.blueprint_id);
    if (!stat || stat.total < 3) continue;
    const winRate = (stat.wins / stat.total) * 100;
    const next =
      winRate >= 60
        ? Math.max(10, Number(c.divergence) - 5)
        : Math.min(80, Number(c.divergence) + 8);
    await db.from("channels").update({ divergence: next }).eq("id", c.id);
  }

  return { blueprintsScored: updates.length, snapshots: snaps?.length ?? 0 };
}
