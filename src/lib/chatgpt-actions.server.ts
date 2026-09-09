import { estimateProfit } from "@/lib/domain";

export type ListScansInput = { limit?: number };
export type ListCreatorsInput = {
  niche?: string | undefined;
  scan_id?: string | undefined;
  min_profit_per_video?: number | undefined;
  limit?: number;
};
export type ListBlueprintsInput = {
  niche?: string | undefined;
  min_confidence?: number | undefined;
  limit?: number;
};
export type ListChannelsInput = { limit?: number };
export type EstimateInput = {
  avg_views_per_video: number;
  videos_per_month?: number | undefined;
  niche?: string | undefined;
};

async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function assertIsMember(userId: string): Promise<boolean> {
  const supabase = await adminClient();
  const { data, error } = await supabase.rpc("is_member", { _user_id: userId });
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function listScansForUser(_userId: string, input: ListScansInput = {}) {
  const limit = Math.min(Math.max(input.limit ?? 10, 1), 50);
  const supabase = await adminClient();
  const { data, error } = await supabase
    .from("scans")
    .select("id, niche, bracket_min, bracket_max, status, results_count, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return { scans: data ?? [] };
}

export async function listCreatorsForUser(_userId: string, input: ListCreatorsInput = {}) {
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 50);
  const supabase = await adminClient();
  let query = supabase
    .from("creators")
    .select(
      "id, channel_name, handle, channel_url, niche, subscribers, avg_views, uploads_per_month, est_profit_per_video, est_monthly, data_source, scan_id",
    )
    .order("est_profit_per_video", { ascending: false })
    .limit(limit);

  if (input.niche) query = query.eq("niche", input.niche);
  if (input.scan_id) query = query.eq("scan_id", input.scan_id);
  if (typeof input.min_profit_per_video === "number") {
    query = query.gte("est_profit_per_video", input.min_profit_per_video);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return { creators: data ?? [] };
}

export async function listBlueprintsForUser(_userId: string, input: ListBlueprintsInput = {}) {
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 50);
  const supabase = await adminClient();
  let query = supabase
    .from("blueprints")
    .select("id, name, niche, confidence, generation, status, deployable, win_rate, gap_notes, created_at")
    .order("confidence", { ascending: false })
    .limit(limit);

  if (input.niche) query = query.eq("niche", input.niche);
  if (typeof input.min_confidence === "number") query = query.gte("confidence", input.min_confidence);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return { blueprints: data ?? [] };
}

export async function listChannelsForUser(_userId: string, input: ListChannelsInput = {}) {
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 50);
  const supabase = await adminClient();
  const { data, error } = await supabase
    .from("channels")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return { channels: data ?? [] };
}

export async function estimateEarningsForUser(_userId: string, input: EstimateInput) {
  const videosPerMonth = Math.min(Math.max(input.videos_per_month ?? 8, 1), 300);
  const niche = input.niche?.trim().toLowerCase() ?? "finance";
  const perVideo = estimateProfit(input.avg_views_per_video, niche);
  return {
    niche,
    avgViewsPerVideo: input.avg_views_per_video,
    videosPerMonth,
    rpmRange: [perVideo.rpmLow, perVideo.rpmHigh],
    perVideo: { low: perVideo.profitLow, mid: perVideo.profit, high: perVideo.profitHigh },
    perMonth: {
      low: perVideo.profitLow * videosPerMonth,
      mid: perVideo.profit * videosPerMonth,
      high: perVideo.profitHigh * videosPerMonth,
    },
    perYear: {
      low: perVideo.profitLow * videosPerMonth * 12,
      mid: perVideo.profit * videosPerMonth * 12,
      high: perVideo.profitHigh * videosPerMonth * 12,
    },
  };
}
