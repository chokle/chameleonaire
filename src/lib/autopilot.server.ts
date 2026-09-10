/** Autopilot: runs the whole earn loop (scan → blueprint → channel → generate → render → publish). */

import { DEPLOY_THRESHOLD } from "./domain";
import { recommend, type AccountSnapshot, type ActionCard, type ActionParams } from "./recommendations";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function buildAccountSnapshot(userId?: string): Promise<AccountSnapshot> {
  const db = await admin();

  const channelsQ = db
    .from("channels")
    .select("id, name, blueprint_id, status")
    .order("created_at", { ascending: false })
    .limit(30);
  if (userId) channelsQ.eq("owner_id", userId);

  const [brands, creators, blueprints, channels, accounts] = await Promise.all([
    db.from("brands").select("id"),
    db.from("creators").select("id, channel_name, niche, est_profit_per_video").order("est_profit_per_video", { ascending: false }).limit(30),
    db.from("blueprints").select("id, name, confidence, niche").order("confidence", { ascending: false }).limit(30),
    channelsQ,
    db.from("youtube_accounts").select("channel_id"),
  ]);

  const ownedChannelIds = userId
    ? new Set((channels.data ?? []).map((c) => c.id))
    : new Set<string>();

  let videosQ = db
    .from("generated_videos")
    .select("id, title, channel_id, approved, render_status, video_url, youtube_video_id")
    .order("created_at", { ascending: false })
    .limit(60);
  let queueQ = db.from("publish_queue").select("id, status, generated_video_id, scheduled_for").order("scheduled_for").limit(60);
  if (userId) {
    videosQ = videosQ.in("channel_id", Array.from(ownedChannelIds));
    queueQ = queueQ.in("channel_id", Array.from(ownedChannelIds));
  }
  const [videos, queue] = await Promise.all([videosQ, queueQ]);

  const connected = new Set((accounts.data ?? []).map((a) => a.channel_id));

  return {
    brands: (brands.data ?? []).length,
    creators: (creators.data ?? []).map((c) => ({
      id: c.id,
      name: c.channel_name,
      niche: c.niche,
      profitPerVideo: Number(c.est_profit_per_video) || 0,
    })),
    blueprints: (blueprints.data ?? []).map((b) => ({
      id: b.id,
      name: b.name,
      confidence: Number(b.confidence) || 0,
      niche: b.niche,
    })),
    channels: (channels.data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      connected: connected.has(c.id),
      blueprintId: c.blueprint_id,
      status: c.status ?? "draft",
    })),
    videos: (videos.data ?? []).map((v) => ({
      id: v.id,
      title: v.title,
      channelId: v.channel_id,
      approved: Boolean(v.approved),
      renderStatus: v.render_status,
      hasFile: Boolean(v.video_url),
      published: Boolean(v.youtube_video_id),
    })),
    queue: (queue.data ?? []).map((q) => ({
      id: q.id,
      status: q.status ?? "queued",
      videoId: q.generated_video_id,
      scheduledFor: q.scheduled_for,
    })),
  };
}

export async function nextActions(userId?: string): Promise<{ actions: ActionCard[]; snapshot: AccountSnapshot }> {
  const snapshot = await buildAccountSnapshot(userId);
  return { actions: recommend(snapshot), snapshot };
}

export type AutopilotStep = {
  step: string;
  status: "done" | "skipped" | "failed";
  detail: string;
  data?: ActionParams | undefined;
};

export type AutopilotInput = {
  niche: string;
  min?: number | undefined;
  max?: number | null | undefined;
  channelName?: string | undefined;
  videoCount?: number | undefined;
  durationTarget?: number | undefined;
  /** "plan" stops after generating scripts; "full" also renders and publishes the first video. */
  mode?: "plan" | "full" | undefined;
};

/**
 * One call, whole loop. Each step records its own outcome so ChatGPT (or the UI)
 * can narrate progress and pick up where a run stopped.
 */
export async function runAutopilot(
  input: AutopilotInput,
  userId?: string,
): Promise<{
  steps: AutopilotStep[];
  scanId: string | null;
  blueprintId: string | null;
  channelId: string | null;
  videoIds: string[];
  publishedUrl: string | null;
}> {
  const db = await admin();
  const steps: AutopilotStep[] = [];
  const niche = input.niche.trim().toLowerCase();
  const mode = input.mode ?? "plan";
  const videoCount = Math.min(Math.max(input.videoCount ?? 3, 1), 6);
  const durationTarget = Math.min(Math.max(input.durationTarget ?? 30, 8), 120);

  let scanId: string | null = null;
  let blueprintId: string | null = null;
  let channelId: string | null = null;
  const videoIds: string[] = [];
  let publishedUrl: string | null = null;

  // 1. Scan
  const { executeScan } = await import("./scan.server");
  const scan = await executeScan({
    niche,
    min: input.min ?? 2000,
    max: input.max ?? null,
    count: 12,
    persistent: false,
    datasetId: null,
  });
  scanId = scan.scanId;
  steps.push({
    step: "scan",
    status: "done",
    detail: `Found ${scan.found} earning channels in ${niche}.`,
    data: { scanId: scan.scanId, found: scan.found },
  });

  // 2. Blueprint from the top earners of this scan
  const { data: top } = await db
    .from("creators")
    .select("id, channel_name, est_profit_per_video")
    .eq("scan_id", scan.scanId)
    .order("est_profit_per_video", { ascending: false })
    .limit(3);

  if (!top?.length) {
    steps.push({ step: "blueprint", status: "skipped", detail: "The scan surfaced no creators to model." });
    return { steps, scanId, blueprintId, channelId, videoIds, publishedUrl };
  }

  const { buildBlueprint } = await import("./blueprint.server");
  const blueprint = await buildBlueprint(top.map((c) => c.id));
  blueprintId = blueprint.id;
  const confidence = Math.round(Number(blueprint.confidence) || 0);
  steps.push({
    step: "blueprint",
    status: "done",
    detail: `Extracted "${blueprint.name}" at ${confidence}% confidence (gate is ${DEPLOY_THRESHOLD}%).`,
    data: { blueprintId: blueprint.id, confidence, deployable: confidence >= DEPLOY_THRESHOLD },
  });

  if (confidence < DEPLOY_THRESHOLD) {
    steps.push({
      step: "channel",
      status: "skipped",
      detail: `Confidence is below the ${DEPLOY_THRESHOLD}% gate, so nothing was spawned. Run another scan in this niche to add evidence.`,
    });
    return { steps, scanId, blueprintId, channelId, videoIds, publishedUrl };
  }

  // 3. Channel — reuse a connected one when we have it
  const existingQ = db
    .from("channels")
    .select("id, name, blueprint_id")
    .order("created_at", { ascending: true })
    .limit(5);
  if (userId) existingQ.eq("owner_id", userId);
  const { data: existing } = await existingQ;
  const connectedQ = db.from("youtube_accounts").select("channel_id");
  if (userId) {
    const ownedIds = (existing ?? []).map((c) => c.id);
    connectedQ.in("channel_id", ownedIds.length ? ownedIds : ["00000000-0000-0000-0000-000000000000"]);
  }
  const { data: connected } = await connectedQ;
  const connectedIds = new Set((connected ?? []).map((c) => c.channel_id));
  const reuse = (existing ?? []).find((c) => connectedIds.has(c.id)) ?? null;

  if (reuse) {
    channelId = reuse.id;
    if (reuse.blueprint_id !== blueprintId) {
      await db.from("channels").update({ blueprint_id: blueprintId }).eq("id", reuse.id);
    }
    steps.push({
      step: "channel",
      status: "done",
      detail: `Using your connected channel "${reuse.name}" and pointed it at the new blueprint.`,
      data: { channelId: reuse.id },
    });
  } else {
    if (!userId) throw new Error("Autopilot requires a signed-in user to spawn a channel.");
    const { data: brand } = await db.from("brands").select("id").limit(1).maybeSingle();
    const { data: created, error } = await db
      .from("channels")
      .insert({
        name: input.channelName?.trim() || `${niche} autopilot`,
        blueprint_id: blueprintId,
        brand_id: brand?.id ?? null,
        divergence: 35,
        uploads_per_week: 3,
        auto_publish: false,
        status: "draft",
        owner_id: userId,
      })
      .select("id, name")
      .single();
    if (error || !created) throw new Error(error?.message ?? "Could not spawn a channel.");
    channelId = created.id;
    steps.push({
      step: "channel",
      status: "done",
      detail: `Spawned "${created.name}". Connect YouTube on it before anything can go live.`,
      data: { channelId: created.id, needsYouTube: true },
    });
  }

  // 4. Generate evergreen concepts
  const { generateForChannel } = await import("./chameleon.server");
  const gen = await generateForChannel(channelId, videoCount, userId);
  const { data: fresh } = await db
    .from("generated_videos")
    .select("id, title")
    .eq("channel_id", channelId)
    .order("created_at", { ascending: false })
    .limit(gen.created);
  for (const v of fresh ?? []) videoIds.push(v.id);
  steps.push({
    step: "generate",
    status: "done",
    detail: `Wrote ${gen.created} evergreen concepts, scripts and thumbnails.`,
    data: { videoIds },
  });

  if (mode === "plan") {
    steps.push({
      step: "render",
      status: "skipped",
      detail: "Planning run — approve what you like, then render and publish.",
    });
    return { steps, scanId, blueprintId, channelId, videoIds, publishedUrl };
  }

  // 5. Render the first video
  const first = videoIds[0];
  if (!first) return { steps, scanId, blueprintId, channelId, videoIds, publishedUrl };

  const { renderVideoFile } = await import("./render.server");
  const rendered = await renderVideoFile(first, durationTarget, userId);
  steps.push({
    step: "render",
    status: "done",
    detail: `Rendered a ${rendered.durationSeconds}s video.`,
    data: { videoId: first },
  });

  // 6. Approve + publish
  await db.from("generated_videos").update({ approved: true, status: "scheduled" }).eq("id", first);
  const { data: queued } = await db
    .from("publish_queue")
    .select("id")
    .eq("generated_video_id", first)
    .maybeSingle();

  let queueId = queued?.id ?? null;
  if (!queueId) {
    const { data: inserted } = await db
      .from("publish_queue")
      .insert({
        generated_video_id: first,
        channel_id: channelId,
        scheduled_for: new Date().toISOString(),
        status: "scheduled",
      })
      .select("id")
      .single();
    queueId = inserted?.id ?? null;
  } else {
    await db.from("publish_queue").update({ status: "scheduled" }).eq("id", queueId);
  }

  if (!queueId) {
    steps.push({ step: "publish", status: "failed", detail: "Could not place the video in the queue." });
    return { steps, scanId, blueprintId, channelId, videoIds, publishedUrl };
  }

  try {
    const { publishQueueItem } = await import("./publish.server");
    const published = await publishQueueItem(queueId);
    publishedUrl = published.url;
    steps.push({
      step: "publish",
      status: "done",
      detail: `Uploaded to YouTube as private: ${published.url}`,
      data: { url: published.url },
    });
  } catch (e) {
    steps.push({
      step: "publish",
      status: "failed",
      detail: e instanceof Error ? e.message : "Publish failed.",
    });
  }

  return { steps, scanId, blueprintId, channelId, videoIds, publishedUrl };
}
