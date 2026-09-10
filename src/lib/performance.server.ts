/** Per-video performance tracking: pulls YouTube stats for published videos and ranks blueprints. */

import { accessTokenFor } from "./youtube-oauth.server";
import { rpmBandFor } from "./domain";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Share of views that serve monetized impressions — same assumption the profit model uses. */
const MONETIZED_RATE = 0.55;
/** Public data can't give true retention; this is the modelled average-view-percentage. */
const DEFAULT_RETENTION = 0.45;

export type VideoPerformance = {
  videoId: string;
  title: string;
  channelId: string;
  channelName: string;
  blueprintId: string | null;
  blueprintName: string | null;
  niche: string;
  youtubeVideoId: string | null;
  url: string | null;
  durationSeconds: number;
  views: number;
  likes: number;
  comments: number;
  watchTimeMinutes: number;
  estRevenue: number;
  engagementRate: number;
  capturedAt: string | null;
};

export type BlueprintRanking = {
  blueprintId: string;
  name: string;
  niche: string;
  confidence: number;
  videos: number;
  views: number;
  watchTimeMinutes: number;
  estRevenue: number;
  revenuePerVideo: number;
  avgViews: number;
};

function estimate(views: number, durationSeconds: number, niche: string, retention: number) {
  const [low, high] = rpmBandFor(niche);
  const rpm = (low + high) / 2;
  const estRevenue = (views / 1000) * MONETIZED_RATE * rpm;
  const watchTimeMinutes = (views * durationSeconds * retention) / 60;
  return { estRevenue: Math.round(estRevenue * 100) / 100, watchTimeMinutes: Math.round(watchTimeMinutes) };
}

type YTStatItem = {
  id: string;
  statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
  contentDetails?: { duration?: string };
};

function isoToSeconds(iso: string): number {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso ?? "");
  if (!m) return 0;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

async function fetchStats(channelId: string, youtubeIds: string[]): Promise<Map<string, YTStatItem>> {
  const out = new Map<string, YTStatItem>();
  if (!youtubeIds.length) return out;
  const token = await accessTokenFor(channelId);
  for (let i = 0; i < youtubeIds.length; i += 50) {
    const batch = youtubeIds.slice(i, i + 50);
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails&id=${batch.join(",")}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) throw new Error(`YouTube stats ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const json = (await res.json()) as { items?: YTStatItem[] };
    for (const item of json.items ?? []) out.set(item.id, item);
  }
  return out;
}

/** Pulls fresh stats from YouTube for every published video and stores a snapshot. */
export async function syncPerformance(userId?: string): Promise<{ updated: number; skipped: number; errors: string[] }> {
  const db = await admin();
  let q = db
    .from("generated_videos")
    .select("id, title, channel_id, blueprint_id, youtube_video_id, duration_seconds")
    .not("youtube_video_id", "is", null)
    .limit(200);
  if (userId) {
    const owned = (await db.from("channels").select("id").eq("owner_id", userId)).data?.map((c) => c.id) ?? [];
    if (!owned.length) return { updated: 0, skipped: 0, errors: [] };
    q = q.in("channel_id", owned);
  }
  const { data: videos } = await q;

  const rows = videos ?? [];
  if (!rows.length) return { updated: 0, skipped: 0, errors: [] };

  const byChannel = new Map<string, typeof rows>();
  for (const v of rows) {
    const list = byChannel.get(v.channel_id) ?? [];
    list.push(v);
    byChannel.set(v.channel_id, list);
  }

  const { data: blueprints } = await db.from("blueprints").select("id, niche");
  const nicheOf = new Map((blueprints ?? []).map((b) => [b.id, b.niche as string]));
  const retentionOf = new Map<string, number>((blueprints ?? []).map((b) => [b.id, DEFAULT_RETENTION]));

  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const [channelId, list] of byChannel) {
    let stats: Map<string, YTStatItem>;
    try {
      stats = await fetchStats(
        channelId,
        list.map((v) => v.youtube_video_id!).filter(Boolean),
      );
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "Could not read YouTube stats.");
      skipped += list.length;
      continue;
    }

    for (const v of list) {
      const s = stats.get(v.youtube_video_id!);
      if (!s) {
        skipped += 1;
        continue;
      }
      const views = Number(s.statistics?.viewCount ?? 0);
      const likes = Number(s.statistics?.likeCount ?? 0);
      const comments = Number(s.statistics?.commentCount ?? 0);
      const duration = isoToSeconds(s.contentDetails?.duration ?? "") || Number(v.duration_seconds ?? 0);
      const niche = (v.blueprint_id && nicheOf.get(v.blueprint_id)) || "general";
      const retention = (v.blueprint_id && retentionOf.get(v.blueprint_id)) || DEFAULT_RETENTION;
      const { estRevenue, watchTimeMinutes } = estimate(views, duration, niche, retention);

      await db.from("performance_snapshots").insert({
        generated_video_id: v.id,
        channel_id: v.channel_id,
        blueprint_id: v.blueprint_id,
        youtube_video_id: v.youtube_video_id,
        views,
        likes,
        comments,
        watch_time_minutes: watchTimeMinutes,
        est_revenue: estRevenue,
        retention: Math.round(retention * 100),
        outcome: views > 0 ? "tracked" : "no_views",
      });
      if (duration && duration !== v.duration_seconds) {
        await db.from("generated_videos").update({ duration_seconds: duration }).eq("id", v.id);
      }
      updated += 1;
    }
  }

  return { updated, skipped, errors };
}

/** Latest snapshot per video plus a blueprint leaderboard. */
export async function readPerformance(): Promise<{
  videos: VideoPerformance[];
  blueprints: BlueprintRanking[];
  totals: { views: number; watchTimeMinutes: number; estRevenue: number; published: number };
}> {
  const db = await admin();

  const [{ data: videos }, { data: snaps }, { data: blueprintRows }] = await Promise.all([
    db
      .from("generated_videos")
      .select("id, title, channel_id, blueprint_id, youtube_video_id, duration_seconds, channels(name)")
      .not("youtube_video_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(200),
    db
      .from("performance_snapshots")
      .select("*")
      .order("captured_at", { ascending: false })
      .limit(1000),
    db.from("blueprints").select("id, name, niche, confidence"),
  ]);

  const latest = new Map<string, NonNullable<typeof snaps>[number]>();
  for (const s of snaps ?? []) {
    if (!s.generated_video_id) continue;
    if (!latest.has(s.generated_video_id)) latest.set(s.generated_video_id, s);
  }
  const bp = new Map((blueprintRows ?? []).map((b) => [b.id, b]));

  const out: VideoPerformance[] = (videos ?? []).map((v) => {
    const s = latest.get(v.id);
    const blueprint = v.blueprint_id ? bp.get(v.blueprint_id) : undefined;
    const views = Number(s?.views ?? 0);
    const likes = Number((s as { likes?: number } | undefined)?.likes ?? 0);
    const comments = Number((s as { comments?: number } | undefined)?.comments ?? 0);
    return {
      videoId: v.id,
      title: v.title,
      channelId: v.channel_id,
      channelName: (v.channels as { name?: string } | null)?.name ?? "unassigned",
      blueprintId: v.blueprint_id,
      blueprintName: blueprint?.name ?? null,
      niche: blueprint?.niche ?? "general",
      youtubeVideoId: v.youtube_video_id,
      url: v.youtube_video_id ? `https://youtube.com/watch?v=${v.youtube_video_id}` : null,
      durationSeconds: Number(v.duration_seconds ?? 0),
      views,
      likes,
      comments,
      watchTimeMinutes: Number((s as { watch_time_minutes?: number } | undefined)?.watch_time_minutes ?? 0),
      estRevenue: Number(s?.est_revenue ?? 0),
      engagementRate: views > 0 ? Math.round(((likes + comments) / views) * 1000) / 10 : 0,
      capturedAt: s?.captured_at ?? null,
    };
  });

  const grouped = new Map<string, BlueprintRanking>();
  for (const v of out) {
    if (!v.blueprintId) continue;
    const blueprint = bp.get(v.blueprintId);
    const row =
      grouped.get(v.blueprintId) ??
      ({
        blueprintId: v.blueprintId,
        name: blueprint?.name ?? "Unnamed blueprint",
        niche: blueprint?.niche ?? "general",
        confidence: Math.round(Number(blueprint?.confidence ?? 0)),
        videos: 0,
        views: 0,
        watchTimeMinutes: 0,
        estRevenue: 0,
        revenuePerVideo: 0,
        avgViews: 0,
      } satisfies BlueprintRanking);
    row.videos += 1;
    row.views += v.views;
    row.watchTimeMinutes += v.watchTimeMinutes;
    row.estRevenue += v.estRevenue;
    grouped.set(v.blueprintId, row);
  }

  const blueprints = [...grouped.values()]
    .map((r) => ({
      ...r,
      revenuePerVideo: r.videos ? Math.round((r.estRevenue / r.videos) * 100) / 100 : 0,
      avgViews: r.videos ? Math.round(r.views / r.videos) : 0,
    }))
    .sort((a, b) => b.estRevenue - a.estRevenue || b.views - a.views);

  const totals = out.reduce(
    (acc, v) => ({
      views: acc.views + v.views,
      watchTimeMinutes: acc.watchTimeMinutes + v.watchTimeMinutes,
      estRevenue: Math.round((acc.estRevenue + v.estRevenue) * 100) / 100,
      published: acc.published + 1,
    }),
    { views: 0, watchTimeMinutes: 0, estRevenue: 0, published: 0 },
  );

  return { videos: out, blueprints, totals };
}
