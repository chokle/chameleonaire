/** Client-safe domain types, brackets and profit math. */

export type Bracket = {
  id: string;
  label: string;
  min: number;
  max: number | null;
};

export const BRACKETS: Bracket[] = [
  { id: "starter", label: "$100 – $500 / video", min: 100, max: 500 },
  { id: "rising", label: "$500 – $2k / video", min: 500, max: 2000 },
  { id: "proven", label: "$2k – $10k / video", min: 2000, max: 10000 },
  { id: "elite", label: "$10k – $50k / video", min: 10000, max: 50000 },
  { id: "apex", label: "$50k+ / video", min: 50000, max: null },
];

export const NICHE_RPM: Record<string, [number, number]> = {
  finance: [12, 32],
  business: [10, 26],
  tech: [7, 18],
  ai: [8, 22],
  "real estate": [11, 28],
  health: [6, 16],
  fitness: [5, 13],
  education: [5, 14],
  gaming: [2, 6],
  entertainment: [2, 5],
  lifestyle: [3, 8],
  travel: [4, 10],
  food: [3, 9],
  automotive: [5, 12],
  "true crime": [4, 11],
  general: [3, 10],
};

export function rpmBandFor(niche: string): [number, number] {
  const key = niche.trim().toLowerCase();
  if (NICHE_RPM[key]) return NICHE_RPM[key]!;
  const partial = Object.keys(NICHE_RPM).find((k) => key.includes(k) || k.includes(key));
  return partial ? NICHE_RPM[partial]! : NICHE_RPM["general"]!;
}

/** Sponsor slots typically add 40-90% on top of ad revenue at scale. */
export function sponsorUplift(avgViews: number): number {
  if (avgViews > 500_000) return 0.9;
  if (avgViews > 150_000) return 0.65;
  if (avgViews > 40_000) return 0.4;
  return 0.15;
}

export function estimateProfit(avgViews: number, niche: string) {
  const [low, high] = rpmBandFor(niche);
  const uplift = 1 + sponsorUplift(avgViews);
  const monetizedRate = 0.55; // share of views that actually serve monetized impressions
  const base = (avgViews / 1000) * monetizedRate;
  const profitLow = base * low;
  const profitHigh = base * high * uplift;
  const profit = (profitLow + profitHigh) / 2;
  return {
    rpmLow: low,
    rpmHigh: high,
    profitLow: Math.round(profitLow),
    profitHigh: Math.round(profitHigh),
    profit: Math.round(profit),
  };
}

export function money(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(v >= 10_000 ? 0 : 1)}k`;
  return `$${Math.round(v)}`;
}

export function compact(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(v >= 10_000 ? 0 : 1)}K`;
  return `${Math.round(v)}`;
}

export type StrategyBlueprint = {
  positioning?: string;
  hook_pattern?: string;
  title_formula?: string;
  thumbnail_grammar?: string;
  script_skeleton?: string[];
  pacing?: string;
  retention_devices?: string[];
  topic_ladder?: string[];
  upload_cadence?: string;
  ideal_length?: string;
  monetization_mix?: string;
  why_it_wins?: string;
  field_confidence?: Record<string, number>;
};

export type BlueprintEvidence = {
  claim: string;
  supporting_videos: string[];
  confidence: number;
};

export const DEPLOY_THRESHOLD = 95;
export const IDEAL_THRESHOLD = 97;

/* ---------------------------------------------------------------------------
 * Signal layer
 *
 * True retention and CTR are private to a channel owner (YouTube Analytics).
 * From public metadata we derive calibrated *proxies* and always report how
 * much real signal backs a score, so confidence is earned rather than claimed.
 * ------------------------------------------------------------------------ */

export type VideoSignals = {
  views: number;
  likes?: number | null;
  comments?: number | null;
  durationSeconds?: number | null;
  publishedAt?: string | null;
};

/** Likes + comments per 1,000 views, expressed as a percentage of views. */
export function engagementRate(v: VideoSignals): number {
  const views = Math.max(1, Number(v.views) || 0);
  const inter = (Number(v.likes) || 0) + (Number(v.comments) || 0);
  return Number(((inter / views) * 100).toFixed(3));
}

/**
 * Watch-through proxy (0-100). Engagement per view correlates strongly with
 * average view percentage; longer videos need more of it to hold an audience,
 * so the score is length-normalised.
 */
export function retentionProxy(v: VideoSignals): number {
  const er = engagementRate(v);
  const mins = Math.max(0.5, (Number(v.durationSeconds) || 480) / 60);
  const lengthPenalty = Math.min(1, 8 / mins); // 8 minutes = neutral
  const raw = (er / 4) * 100 * (0.55 + 0.45 * lengthPenalty);
  return Number(Math.max(0, Math.min(100, raw)).toFixed(1));
}

/**
 * Click-through proxy (0-100). Views earned per subscriber, aged by how long
 * the video has been live — a young video already over its subscriber base is
 * being clicked hard in browse and suggested.
 */
export function ctrProxy(v: VideoSignals, subscribers: number): number {
  const subs = Math.max(1, Number(subscribers) || 0);
  const ratio = (Number(v.views) || 0) / subs;
  const ageDays = v.publishedAt
    ? Math.max(1, (Date.now() - new Date(v.publishedAt).getTime()) / 86_400_000)
    : 30;
  const aged = ratio * Math.min(1.6, 30 / ageDays + 0.4);
  // 0.25 views/sub ≈ typical browse CTR; 1.5+ ≈ breakout reach.
  return Number(Math.max(0, Math.min(100, (aged / 1.5) * 100)).toFixed(1));
}

export type SignalCoverage = {
  score: number; // 0-100, how much verified signal backs an extraction
  missing: string[];
};

/**
 * How trustworthy the evidence base is. Drives the confidence ceiling so a
 * blueprint can only clear the 95% gate on real, broad, engagement-rich data.
 */
export function signalCoverage(input: {
  videoCount: number;
  channelCount: number;
  withEngagement: number;
  withRetention: number;
  withCtr: number;
  verifiedSources: number; // channels sourced from the YouTube API, not modelled
}): SignalCoverage {
  const missing: string[] = [];
  const pct = (n: number) => (input.videoCount ? n / input.videoCount : 0);

  const volume = Math.min(1, input.videoCount / 60);
  const breadth = Math.min(1, input.channelCount / 4);
  const engagement = pct(input.withEngagement);
  const retention = pct(input.withRetention);
  const ctr = pct(input.withCtr);
  const verified = input.channelCount ? input.verifiedSources / input.channelCount : 0;

  if (input.videoCount < 60) missing.push(`${60 - input.videoCount} more sampled videos`);
  if (input.channelCount < 4) missing.push(`${4 - input.channelCount} more source channels`);
  if (engagement < 0.8) missing.push("like/comment data on more videos");
  if (retention < 0.8) missing.push("watch-through signal on more videos");
  if (ctr < 0.8) missing.push("click-through signal on more videos");
  if (verified < 0.8) missing.push("more channels pulled live from YouTube instead of modelled");

  const score =
    volume * 20 + breadth * 15 + engagement * 20 + retention * 15 + ctr * 15 + verified * 15;

  return { score: Math.round(Math.max(0, Math.min(100, score))), missing };
}

/** Confidence ceiling implied by the evidence base. */
export function confidenceCeiling(coverage: number): number {
  if (coverage >= 90) return 99;
  if (coverage >= 80) return 97;
  if (coverage >= 70) return 95;
  if (coverage >= 55) return 92;
  if (coverage >= 40) return 88;
  return 82;
}
