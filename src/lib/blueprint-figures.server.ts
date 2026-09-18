/**
 * The claimable numbers behind a blueprint. Scripts written for a channel should
 * state the same figures the blueprint was modelled on, instead of inventing new
 * ones, so the video text matches what the channel claims.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type BlueprintFigures = {
  profitPerVideo: number | null;
  avgViews: number | null;
  subscribers: number | null;
  /** Human-readable, already-rounded figures the writer may state. */
  claims: string[];
};

const EMPTY: BlueprintFigures = {
  profitPerVideo: null,
  avgViews: null,
  subscribers: null,
  claims: [],
};

/** Round to a clean, claimable number: 41,732 -> 42,000; 987 -> 1,000. */
function roundClean(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  const digits = Math.floor(Math.log10(n));
  const step = Math.pow(10, Math.max(0, digits - 1));
  return Math.round(n / step) * step;
}

function compact(n: number): string {
  if (n >= 1_000_000) return `${Number((n / 1_000_000).toFixed(1))}M`;
  if (n >= 1_000) return `${Number((n / 1_000).toFixed(n >= 10_000 ? 0 : 1))}K`;
  return String(Math.round(n));
}

function money(n: number): string {
  return `$${roundClean(n).toLocaleString("en-US")}`;
}

/** Any standalone money figures the strategy itself recorded. */
function strategyNumbers(strategy: unknown): string[] {
  const text = typeof strategy === "string" ? strategy : JSON.stringify(strategy ?? "");
  const found = text.match(/\$\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:k|K|m|M))?/g) ?? [];
  return [...new Set(found.map((f) => f.replace(/\s/g, "")))].slice(0, 4);
}

export async function figuresForBlueprint(
  supabase: SupabaseClient,
  blueprintId: string | null | undefined,
): Promise<BlueprintFigures> {
  if (!blueprintId) return EMPTY;

  const { data: bp } = await supabase
    .from("blueprints")
    .select("source_creator_ids, strategy")
    .eq("id", blueprintId)
    .maybeSingle();
  if (!bp) return EMPTY;

  const ids = ((bp as { source_creator_ids?: string[] }).source_creator_ids ?? []).slice(0, 20);
  let profitPerVideo: number | null = null;
  let avgViews: number | null = null;
  let subscribers: number | null = null;

  if (ids.length) {
    const { data: rows } = await supabase
      .from("creators")
      .select("est_profit_per_video, avg_views, subscribers")
      .in("id", ids);
    const list = (rows ?? []) as Array<{
      est_profit_per_video: number | null;
      avg_views: number | null;
      subscribers: number | null;
    }>;
    const avg = (pick: (r: (typeof list)[number]) => number | null) => {
      const vals = list.map(pick).filter((v): v is number => typeof v === "number" && v > 0);
      if (!vals.length) return null;
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    };
    profitPerVideo = avg((r) => r.est_profit_per_video);
    avgViews = avg((r) => r.avg_views);
    subscribers = avg((r) => r.subscribers);
  }

  const claims: string[] = [];
  if (profitPerVideo) claims.push(`${money(profitPerVideo)} per video`);
  if (profitPerVideo) claims.push(`${money(profitPerVideo * 4)} per month`);
  if (avgViews) claims.push(`${compact(roundClean(avgViews))} views per video`);
  if (subscribers) claims.push(`${compact(roundClean(subscribers))} subscribers`);
  for (const extra of strategyNumbers(bp.strategy)) {
    if (claims.length >= 8) break;
    if (!claims.some((c) => c.startsWith(extra))) claims.push(extra);
  }

  return { profitPerVideo, avgViews, subscribers, claims };
}

/** The prompt fragment that pins the writer to those numbers. */
export function figuresPrompt(figures: BlueprintFigures): string {
  if (!figures.claims.length) return "";
  return (
    `\nAPPROVED FIGURES — these are the ONLY numbers you may state, verbatim, and at least one ` +
    `must appear in the cold open:\n- ${figures.claims.join("\n- ")}\n` +
    `Never invent a different amount, view count or subscriber count.\n`
  );
}
