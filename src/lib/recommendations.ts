/** Client-safe recommendation engine: turns account state into ranked next actions. */

import { DEPLOY_THRESHOLD } from "./domain";

export type ActionKind =
  | "connect_youtube"
  | "create_brand"
  | "run_scan"
  | "extract_blueprint"
  | "spawn_channel"
  | "generate_videos"
  | "render_video"
  | "approve_video"
  | "publish_video"
  | "autopilot";

export type ActionParams = Record<string, string | number | boolean | null | string[]>;

export type ActionCard = {
  id: string;
  kind: ActionKind;
  title: string;
  why: string;
  impact: string;
  priority: number;
  params: ActionParams;
};

export type AccountSnapshot = {
  brands: number;
  creators: { id: string; name: string; niche: string; profitPerVideo: number }[];
  blueprints: { id: string; name: string; confidence: number; niche: string }[];
  channels: {
    id: string;
    name: string;
    connected: boolean;
    blueprintId: string | null;
    status: string;
  }[];
  videos: {
    id: string;
    title: string;
    channelId: string | null;
    approved: boolean;
    renderStatus: string | null;
    hasFile: boolean;
    published: boolean;
  }[];
  queue: { id: string; status: string; videoId: string | null; scheduledFor: string | null }[];
};

export const EMPTY_SNAPSHOT: AccountSnapshot = {
  brands: 0,
  creators: [],
  blueprints: [],
  channels: [],
  videos: [],
  queue: [],
};

/**
 * Ranks the whole account into "do this next" cards. Everything is blueprint-aware:
 * we never suggest generating from a blueprint below the deploy gate.
 */
export function recommend(s: AccountSnapshot): ActionCard[] {
  const cards: ActionCard[] = [];
  const best = [...s.blueprints].sort((a, b) => b.confidence - a.confidence)[0] ?? null;
  const deployable = s.blueprints.filter((b) => b.confidence >= DEPLOY_THRESHOLD);
  const topCreators = [...s.creators].sort((a, b) => b.profitPerVideo - a.profitPerVideo);

  if (s.creators.length === 0) {
    cards.push({
      id: "scan-first",
      kind: "run_scan",
      title: "Run your first profit scan",
      why: "Nothing has been scanned yet, so there is no proof of who is earning in your niche.",
      impact: "Surfaces the highest-earning channels you can model",
      priority: 100,
      params: { niche: "finance", min: 2000, max: 10000 },
    });
  }

  if (s.creators.length > 0 && s.blueprints.length === 0) {
    const seed = topCreators.slice(0, 3);
    cards.push({
      id: "extract-first",
      kind: "extract_blueprint",
      title: `Extract a blueprint from ${seed[0]?.name ?? "your top earner"}`,
      why: "You have earners on the board but no repeatable formula pulled out of them yet.",
      impact: "Unlocks channel spawning",
      priority: 95,
      params: { creatorIds: seed.map((c) => c.id) },
    });
  }

  if (best && best.confidence < DEPLOY_THRESHOLD) {
    cards.push({
      id: `widen-${best.id}`,
      kind: "run_scan",
      title: `Widen the evidence — best blueprint is at ${Math.round(best.confidence)}%`,
      why: `The deploy gate is ${DEPLOY_THRESHOLD}%. Another scan in the same niche adds evidence and lifts confidence.`,
      impact: "Gets a blueprint over the gate",
      priority: 90,
      params: { niche: best.niche, min: 2000, max: null },
    });
  }

  if (s.brands === 0 && deployable.length > 0) {
    cards.push({
      id: "brand",
      kind: "create_brand",
      title: "Define your brand voice",
      why: "Every spawned channel writes in your own voice, not the source creator's.",
      impact: "Keeps output original and on-brand",
      priority: 88,
      params: {},
    });
  }

  if (deployable.length > 0 && s.channels.length === 0) {
    const bp = deployable[0]!;
    cards.push({
      id: `spawn-${bp.id}`,
      kind: "spawn_channel",
      title: `Spawn a channel on "${bp.name}"`,
      why: `That blueprint is at ${Math.round(bp.confidence)}% — above the ${DEPLOY_THRESHOLD}% gate.`,
      impact: "Starts the publishing engine",
      priority: 85,
      params: { blueprintId: bp.id },
    });
  }

  for (const ch of s.channels) {
    if (!ch.connected) {
      cards.push({
        id: `connect-${ch.id}`,
        kind: "connect_youtube",
        title: `Connect YouTube for ${ch.name}`,
        why: "Videos can be generated and rendered, but nothing can go live until the channel is connected.",
        impact: "Required before anything publishes",
        priority: 84,
        params: { channelId: ch.id },
      });
    }
    if (!ch.blueprintId && deployable.length > 0) {
      cards.push({
        id: `attach-${ch.id}`,
        kind: "spawn_channel",
        title: `Attach a blueprint to ${ch.name}`,
        why: "This channel has no winning formula attached, so it cannot generate.",
        impact: "Unblocks generation",
        priority: 82,
        params: { channelId: ch.id, blueprintId: deployable[0]!.id },
      });
    }
    const owned = s.videos.filter((v) => v.channelId === ch.id);
    if (ch.blueprintId && owned.filter((v) => !v.published).length === 0) {
      cards.push({
        id: `generate-${ch.id}`,
        kind: "generate_videos",
        title: `Generate 3 evergreen videos for ${ch.name}`,
        why: "The pipeline is empty. Evergreen topics keep earning years after upload.",
        impact: "Refills the publish queue",
        priority: 78,
        params: { channelId: ch.id, count: 3 },
      });
    }
  }

  for (const v of s.videos.filter((v) => !v.published && !v.hasFile && v.renderStatus !== "rendering")) {
    cards.push({
      id: `render-${v.id}`,
      kind: "render_video",
      title: `Render "${v.title}"`,
      why: "The script is written but there is no video file yet.",
      impact: "Ready to publish once rendered",
      priority: 70,
      params: { videoId: v.id, durationTarget: 30 },
    });
  }

  for (const v of s.videos.filter((v) => !v.approved && !v.published)) {
    cards.push({
      id: `approve-${v.id}`,
      kind: "approve_video",
      title: `Approve "${v.title}"`,
      why: "Approval is the gate before anything is uploaded to your channel.",
      impact: "Moves it into the schedule",
      priority: 66,
      params: { videoId: v.id, approved: true },
    });
  }

  for (const q of s.queue.filter((q) => q.status === "scheduled" || q.status === "queued")) {
    const video = s.videos.find((v) => v.id === q.videoId);
    if (!video?.approved || !video.hasFile) continue;
    cards.push({
      id: `publish-${q.id}`,
      kind: "publish_video",
      title: `Publish "${video.title}" now`,
      why: "It is rendered, approved and waiting in the queue.",
      impact: "Goes live on YouTube (private first)",
      priority: 60,
      params: { queueId: q.id },
    });
  }

  if (cards.length === 0) {
    cards.push({
      id: "autopilot",
      kind: "autopilot",
      title: "Run autopilot on a fresh niche",
      why: "Everything in flight is handled. Autopilot scans a new niche and builds the next earner end to end.",
      impact: "Adds another income line",
      priority: 40,
      params: { niche: "finance" },
    });
  }

  return cards.sort((a, b) => b.priority - a.priority).slice(0, 12);
}
