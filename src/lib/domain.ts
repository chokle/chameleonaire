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
