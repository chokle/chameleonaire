import { callAI, parseJSON } from "./ai.server";
import { ctrProxy, engagementRate, estimateProfit, retentionProxy, rpmBandFor } from "./domain";
import { getChannels, getRecentVideos, searchChannels, youtubeKey } from "./youtube.server";

type ScanArgs = {
  niche: string;
  min: number;
  max: number | null;
  count: number;
  persistent: boolean;
  datasetId: string | null;
};

type ModeledCreator = {
  channel_name: string;
  handle?: string;
  channel_url?: string;
  subscribers: number;
  avg_views: number;
  uploads_per_month: number;
  format?: string;
  view_velocity?: number;
  consistency_score?: number;
  notes?: string;
  videos?: Array<{ title: string; views: number; hook?: string; thumbnail_desc?: string }>;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function withinBracket(profit: number, min: number, max: number | null) {
  return profit >= min && (max === null || profit <= max);
}

/** Public-metadata pass driven by the YouTube Data API when a key is configured. */
async function scanViaApi(args: ScanArgs, key: string) {
  const channelIds = await searchChannels(args.niche, args.count * 2, key);
  const channels = await getChannels(channelIds, key);
  const rows: Array<{ creator: Record<string, unknown>; videos: Array<Record<string, unknown>> }> =
    [];

  for (const ch of channels) {
    if (rows.length >= args.count) break;
    let videos: Awaited<ReturnType<typeof getRecentVideos>> = [];
    if (ch.uploadsPlaylist) {
      videos = await getRecentVideos(ch.uploadsPlaylist, key, 12).catch(() => []);
    }
    if (!videos.length) continue;

    const avgViews = Math.round(videos.reduce((s, v) => s + v.views, 0) / videos.length);
    const est = estimateProfit(avgViews, args.niche);
    if (!withinBracket(est.profit, args.min, args.max)) continue;

    const spanDays = Math.max(
      1,
      (Date.now() - new Date(videos[videos.length - 1]!.publishedAt).getTime()) / 86_400_000,
    );
    const uploadsPerMonth = (videos.length / spanDays) * 30;
    const mean = avgViews || 1;
    const variance =
      videos.reduce((s, v) => s + Math.pow(v.views - mean, 2), 0) / videos.length / (mean * mean);
    const consistency = Math.max(0, Math.min(100, Math.round(100 - Math.sqrt(variance) * 60)));
    const newest = videos.slice(0, 3).reduce((s, v) => s + v.views, 0) / Math.min(3, videos.length);

    const vidSignals = videos.map((v) => ({
      engagement: engagementRate(v),
      retention: retentionProxy(v),
      ctr: ctrProxy(v, ch.subscribers),
    }));
    const mean0 = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

    rows.push({
      creator: {
        channel_name: ch.title,
        handle: ch.handle,
        channel_url: `https://www.youtube.com/channel/${ch.id}`,
        niche: args.niche,
        subscribers: ch.subscribers,
        avg_views: avgViews,
        uploads_per_month: Number(uploadsPerMonth.toFixed(1)),
        rpm_low: est.rpmLow,
        rpm_high: est.rpmHigh,
        est_profit_per_video: est.profit,
        est_profit_low: est.profitLow,
        est_profit_high: est.profitHigh,
        est_monthly: Math.round(est.profit * uploadsPerMonth),
        view_velocity: Number((newest / mean).toFixed(2)),
        consistency_score: consistency,
        format: videos[0] && videos[0].durationSeconds < 90 ? "short-form" : "long-form",
        data_source: "youtube_api",
        engagement_rate: Number(mean0(vidSignals.map((s) => s.engagement)).toFixed(3)),
        retention_proxy: Number(mean0(vidSignals.map((s) => s.retention)).toFixed(1)),
        ctr_proxy: Number(mean0(vidSignals.map((s) => s.ctr)).toFixed(1)),
        signal_coverage: 100,
      },
      videos: videos.slice(0, 10).map((v) => ({
        title: v.title,
        video_url: `https://www.youtube.com/watch?v=${v.id}`,
        views: v.views,
        duration_seconds: v.durationSeconds,
        published_at: v.publishedAt,
        est_profit: estimateProfit(v.views, args.niche).profit,
        likes: v.likes,
        comments: v.comments,
        engagement_rate: engagementRate(v),
        retention_proxy: retentionProxy(v),
        ctr_proxy: ctrProxy(v, ch.subscribers),
      })),
    });
  }
  return rows;
}

/** Modeled pass: public-metadata knowledge of the niche, scored with the same math. */
async function scanViaModel(args: ScanArgs, datasetRows: unknown[]) {
  const bracket =
    args.max === null ? `$${args.min}+ per video` : `$${args.min} – $${args.max} per video`;

  const raw = await callAI({
    system:
      "You are a YouTube market analyst working only from public channel metadata: view counts, " +
      "upload cadence, titles, thumbnails, formats. You never invent private revenue figures - you " +
      "report the public signals and let the caller model earnings. Respond with strict JSON only.",
    prompt:
      `Identify real, currently-active YouTube channels in the "${args.niche}" niche whose public ` +
      `performance would place them in the ${bracket} earnings band. Return ${args.count} entries.\n\n` +
      (datasetRows.length
        ? `Also incorporate these rows from the operator's own imported dataset where relevant:\n${JSON.stringify(
            datasetRows.slice(0, 40),
          ).slice(0, 6000)}\n\n`
        : "") +
      `Return JSON: { "creators": [ { "channel_name": string, "handle": string, "channel_url": string, ` +
      `"subscribers": number, "avg_views": number, "uploads_per_month": number, "format": "long-form"|"short-form"|"mixed", ` +
      `"view_velocity": number (1.0 = steady, >1 = accelerating), "consistency_score": number 0-100, ` +
      `"notes": string (one line on what drives the numbers), ` +
      `"videos": [ { "title": string, "views": number, "hook": string, "thumbnail_desc": string } ] (5 items) } ] }\n` +
      `avg_views must be realistic for the band. Only include channels you are confident exist.`,
  });

  const parsed = parseJSON<{ creators: ModeledCreator[] }>(raw);
  const [rpmLow, rpmHigh] = rpmBandFor(args.niche);

  return (parsed.creators ?? [])
    .map((c) => {
      const est = estimateProfit(Number(c.avg_views) || 0, args.niche);
      const upm = Number(c.uploads_per_month) || 4;
      return {
        creator: {
          channel_name: c.channel_name,
          handle: c.handle ?? null,
          channel_url: c.channel_url ?? null,
          niche: args.niche,
          subscribers: Math.round(Number(c.subscribers) || 0),
          avg_views: Math.round(Number(c.avg_views) || 0),
          uploads_per_month: upm,
          rpm_low: rpmLow,
          rpm_high: rpmHigh,
          est_profit_per_video: est.profit,
          est_profit_low: est.profitLow,
          est_profit_high: est.profitHigh,
          est_monthly: Math.round(est.profit * upm),
          view_velocity: Number(c.view_velocity) || 1,
          consistency_score: Math.round(Number(c.consistency_score) || 60),
          format: c.format ?? "long-form",
          data_source: datasetRows.length ? "model+dataset" : "model",
          notes: c.notes ?? null,
          engagement_rate: 0,
          retention_proxy: null,
          ctr_proxy: null,
          signal_coverage: 0,
        },
        videos: (c.videos ?? []).slice(0, 8).map((v) => ({
          title: v.title,
          views: Math.round(Number(v.views) || 0),
          hook: v.hook ?? null,
          thumbnail_desc: v.thumbnail_desc ?? null,
          est_profit: estimateProfit(Number(v.views) || 0, args.niche).profit,
        })),
      };
    })
    .filter((r) => withinBracket(Number(r.creator.est_profit_per_video), args.min, args.max));
}

export async function executeScan(args: ScanArgs) {
  const db = await admin();

  const { data: scan, error: scanErr } = await db
    .from("scans")
    .insert({
      niche: args.niche,
      bracket_min: args.min,
      bracket_max: args.max,
      source: youtubeKey() ? "youtube_api" : "model",
      status: "running",
      is_persistent: args.persistent,
    })
    .select()
    .single();
  if (scanErr || !scan) throw new Error(scanErr?.message ?? "Could not start the scan.");

  try {
    let datasetRows: unknown[] = [];
    if (args.datasetId) {
      const { data: ds } = await db
        .from("imported_datasets")
        .select("raw")
        .eq("id", args.datasetId)
        .maybeSingle();
      if (Array.isArray(ds?.raw)) datasetRows = ds.raw as unknown[];
    }

    const key = youtubeKey();
    let rows = key ? await scanViaApi(args, key) : [];
    if (rows.length < Math.min(4, args.count)) {
      const modeled = await scanViaModel(args, datasetRows);
      rows = [...rows, ...modeled].slice(0, args.count);
    }

    for (const row of rows) {
      const { data: creator } = await db
        .from("creators")
        .insert({ ...row.creator, scan_id: scan.id } as never)
        .select("id")
        .single();
      if (creator && row.videos.length) {
        await db
          .from("creator_videos")
          .insert(row.videos.map((v) => ({ ...v, creator_id: creator.id })) as never);
      }
    }

    await db
      .from("scans")
      .update({ status: "complete", results_count: rows.length, last_run_at: new Date().toISOString() })
      .eq("id", scan.id);

    return { scanId: scan.id, found: rows.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scan failed.";
    await db.from("scans").update({ status: "failed", error: message }).eq("id", scan.id);
    throw new Error(message);
  }
}

/** Bounded sweep: re-runs saved persistent scans so new winners keep surfacing. */
export async function runPersistentSweep() {
  const db = await admin();
  const { data: state } = await db.from("job_state").select("*").eq("id", "rescan").maybeSingle();

  if (state?.paused) return { skipped: true, reason: state.pause_reason ?? "paused" };
  const now = Date.now();
  if (state?.lease_until && new Date(state.lease_until).getTime() > now) {
    return { skipped: true, reason: "another sweep is running" };
  }

  await db
    .from("job_state")
    .update({ lease_until: new Date(now + 5 * 60_000).toISOString() })
    .eq("id", "rescan");

  const MAX_PER_RUN = 3;
  const { data: scans } = await db
    .from("scans")
    .select("*")
    .eq("is_persistent", true)
    .order("last_run_at", { ascending: true, nullsFirst: true })
    .limit(MAX_PER_RUN);

  let refreshed = 0;
  let paused: string | null = null;

  for (const s of scans ?? []) {
    try {
      await executeScan({
        niche: s.niche,
        min: Number(s.bracket_min),
        max: s.bracket_max === null ? null : Number(s.bracket_max),
        count: 8,
        persistent: false,
        datasetId: null,
      });
      refreshed += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (/credit|402|403|disabled/i.test(message)) {
        paused = message;
        break;
      }
    }
  }

  await db
    .from("job_state")
    .update({
      lease_until: null,
      last_run_at: new Date().toISOString(),
      runs: (state?.runs ?? 0) + 1,
      paused: paused !== null,
      pause_reason: paused,
    })
    .eq("id", "rescan");

  return { refreshed, paused };
}
