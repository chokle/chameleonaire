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
  const { data, error } = await supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
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

export async function listChannelsForUser(userId: string, input: ListChannelsInput = {}) {
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 50);
  const supabase = await adminClient();
  const { data, error } = await supabase
    .from("channels")
    .select("*")
    .eq("owner_id", userId)
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

export type ListVideosInput = {
  channel_id?: string | undefined;
  status?: string | undefined;
  approved?: boolean | undefined;
  limit?: number;
};
export type ListQueueInput = {
  channel_id?: string | undefined;
  status?: string | undefined;
  limit?: number;
};

export async function getChannelForUser(userId: string, channelId: string) {
  const supabase = await adminClient();
  const { data: channel, error } = await supabase
    .from("channels")
    .select("*, brands(name, voice, palette), blueprints(id, name, niche, confidence, deployable)")
    .eq("id", channelId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!channel) return null;

  const { data: videos } = await supabase
    .from("generated_videos")
    .select(
      "id, title, status, approved, render_status, duration_seconds, duration_target, youtube_video_id, video_url, created_at",
    )
    .eq("channel_id", channelId)
    .order("created_at", { ascending: false })
    .limit(50);

  const { data: queue } = await supabase
    .from("publish_queue")
    .select("id, generated_video_id, status, scheduled_for, published_at, attempts, last_error")
    .eq("channel_id", channelId)
    .order("scheduled_for", { ascending: true })
    .limit(50);

  const list = videos ?? [];
  return {
    channel,
    stats: {
      videos: list.length,
      published: list.filter((v) => v.youtube_video_id).length,
      awaitingApproval: list.filter((v) => !v.approved).length,
      queued: (queue ?? []).filter((q) => q.status === "queued" || q.status === "scheduled").length,
    },
    videos: list,
    queue: queue ?? [],
  };
}

export async function listVideosForUser(userId: string, input: ListVideosInput = {}) {
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 50);
  const supabase = await adminClient();

  // videos are owned through their channel
  let channelQ = supabase.from("channels").select("id").eq("owner_id", userId);
  if (input.channel_id) channelQ = channelQ.eq("id", input.channel_id);
  const { data: ownedChannels } = await channelQ;
  const ownedIds = (ownedChannels ?? []).map((c) => c.id);
  if (!ownedIds.length) return { videos: [] };

  let query = supabase
    .from("generated_videos")
    .select(
      "id, channel_id, title, concept, hook, status, approved, render_status, render_error, duration_seconds, duration_target, thumbnail_url, youtube_video_id, created_at",
    )
    .in("channel_id", ownedIds)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (input.channel_id) query = query.eq("channel_id", input.channel_id);
  if (input.status) query = query.eq("status", input.status);
  if (typeof input.approved === "boolean") query = query.eq("approved", input.approved);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return { videos: data ?? [] };
}

export async function listQueueForUser(userId: string, input: ListQueueInput = {}) {
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 50);
  const supabase = await adminClient();

  let channelQ = supabase.from("channels").select("id").eq("owner_id", userId);
  if (input.channel_id) channelQ = channelQ.eq("id", input.channel_id);
  const { data: ownedChannels } = await channelQ;
  const ownedIds = (ownedChannels ?? []).map((c) => c.id);
  if (!ownedIds.length) return { queue: [] };

  let query = supabase
    .from("publish_queue")
    .select(
      "id, channel_id, generated_video_id, status, scheduled_for, published_at, attempts, last_error, generated_videos(id, title, approved, render_status, youtube_video_id), channels(name)",
    )
    .in("channel_id", ownedIds)
    .order("scheduled_for", { ascending: true })
    .limit(limit);
  if (input.channel_id) query = query.eq("channel_id", input.channel_id);
  if (input.status) query = query.eq("status", input.status);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return { queue: data ?? [] };
}

export async function setVideoApprovalForUser(userId: string, videoId: string, approved: boolean) {
  const supabase = await adminClient();
  const { data: video } = await supabase
    .from("generated_videos")
    .select("id, channel_id")
    .eq("id", videoId)
    .maybeSingle();
  if (!video) throw new Error("Video not found.");
  const { data: channel } = await supabase
    .from("channels")
    .select("id")
    .eq("id", video.channel_id)
    .eq("owner_id", userId)
    .maybeSingle();
  if (!channel) throw new Error("Video not found or not owned by you.");

  const { data, error } = await supabase
    .from("generated_videos")
    .update({ approved, status: approved ? "scheduled" : "awaiting_approval" })
    .eq("id", videoId)
    .select("id, title, approved, status")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Video not found.");
  return { video: data };
}

export type Privacy = "private" | "unlisted" | "public";

/** Change visibility of a video already uploaded to YouTube. */
export async function setVideoVisibilityForUser(userId: string, videoId: string, privacy: Privacy) {
  const supabase = await adminClient();
  const { data: video } = await supabase
    .from("generated_videos")
    .select("id, title, channel_id, youtube_video_id")
    .eq("id", videoId)
    .maybeSingle();
  if (!video?.channel_id) throw new Error("Video not found.");
  const { data: channel } = await supabase
    .from("channels")
    .select("id")
    .eq("id", video.channel_id)
    .eq("owner_id", userId)
    .maybeSingle();
  if (!channel) throw new Error("Video not found or not owned by you.");
  if (!video.youtube_video_id) throw new Error("This video has not been uploaded to YouTube yet.");

  const { setYouTubePrivacy } = await import("./publish.server");
  await setYouTubePrivacy(video.channel_id, video.youtube_video_id, privacy);
  return {
    video: { id: video.id, title: video.title, privacy },
    url: `https://youtube.com/watch?v=${video.youtube_video_id}`,
  };
}

export async function publishQueueItemForUser(userId: string, queueId: string, privacy: Privacy = "private") {
  const supabase = await adminClient();
  const { data: item } = await supabase
    .from("publish_queue")
    .select("id, channel_id")
    .eq("id", queueId)
    .maybeSingle();
  if (!item) throw new Error("Queue item not found.");
  const { data: channel } = await supabase
    .from("channels")
    .select("id")
    .eq("id", item.channel_id)
    .eq("owner_id", userId)
    .maybeSingle();
  if (!channel) throw new Error("Queue item not found or not owned by you.");

  const { publishQueueItem } = await import("./publish.server");
  return publishQueueItem(queueId);
}

/* ---------- write actions: plan, generate, render, schedule, autopilot ---------- */

export type RunScanInput = {
  niche: string;
  min?: number | undefined;
  max?: number | null | undefined;
  count?: number | undefined;
};

export async function runScanForUser(_userId: string, input: RunScanInput) {
  const { executeScan } = await import("./scan.server");
  return executeScan({
    niche: input.niche.trim().toLowerCase(),
    min: input.min ?? 2000,
    max: input.max ?? null,
    count: Math.min(Math.max(input.count ?? 12, 3), 24),
    persistent: false,
    datasetId: null,
  });
}

export async function extractBlueprintForUser(_userId: string, creatorIds: string[], name?: string) {
  const { buildBlueprint } = await import("./blueprint.server");
  const { DEPLOY_THRESHOLD } = await import("./domain");
  const bp = await buildBlueprint(creatorIds.slice(0, 8), name);
  const confidence = Math.round(Number(bp.confidence) || 0);
  return {
    blueprint: { id: bp.id, name: bp.name, niche: bp.niche, confidence, gap_notes: bp.gap_notes },
    deployable: confidence >= DEPLOY_THRESHOLD,
    deploy_threshold: DEPLOY_THRESHOLD,
  };
}

export type SpawnChannelInput = {
  name: string;
  blueprint_id?: string | null | undefined;
  brand_id?: string | null | undefined;
  divergence?: number | undefined;
  uploads_per_week?: number | undefined;
  auto_publish?: boolean | undefined;
};

export async function spawnChannelForUser(userId: string, input: SpawnChannelInput) {
  const supabase = await adminClient();
  const { data, error } = await supabase
    .from("channels")
    .insert({
      name: input.name.trim(),
      blueprint_id: input.blueprint_id ?? null,
      brand_id: input.brand_id ?? null,
      divergence: Math.min(Math.max(input.divergence ?? 35, 0), 100),
      uploads_per_week: Math.min(Math.max(input.uploads_per_week ?? 3, 1), 21),
      auto_publish: input.auto_publish ?? false,
      status: "draft",
      owner_id: userId,
    })
    .select("id, name, blueprint_id, status")
    .single();
  if (error) throw new Error(error.message);
  return { channel: data };
}

export async function generateVideosForUser(userId: string, channelId: string, count: number) {
  const supabase = await adminClient();
  const { data: channel } = await supabase
    .from("channels")
    .select("id")
    .eq("id", channelId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (!channel) throw new Error("Channel not found or not owned by you.");

  const { generateForChannel } = await import("./chameleon.server");
  const result = await generateForChannel(channelId, Math.min(Math.max(count, 1), 6), userId);
  const { data } = await supabase
    .from("generated_videos")
    .select("id, title, hook, status, approved")
    .eq("channel_id", channelId)
    .order("created_at", { ascending: false })
    .limit(result.created);
  return { created: result.created, videos: data ?? [] };
}

export async function renderVideoForUser(userId: string, videoId: string, durationTarget: number) {
  const { renderVideoFile } = await import("./render.server");
  return renderVideoFile(videoId, durationTarget, userId);
}

export async function scheduleVideoForUser(userId: string, videoId: string, scheduledFor: string | null) {
  const { scheduleGeneratedVideo } = await import("./autopilot-actions.server");
  return scheduleGeneratedVideo(videoId, scheduledFor, userId);
}

export async function nextActionsForUser(userId: string) {
  const { nextActions } = await import("./autopilot.server");
  const { actions } = await nextActions(userId);
  return { actions };
}

export async function autopilotForUser(
  userId: string,
  input: {
    niche: string;
    min?: number | undefined;
    max?: number | null | undefined;
    channel_name?: string | undefined;
    video_count?: number | undefined;
    duration_target?: number | undefined;
    mode?: "plan" | "full" | undefined;
  },
) {
  const { runAutopilot } = await import("./autopilot.server");
  return runAutopilot({
    niche: input.niche,
    min: input.min ?? 2000,
    max: input.max ?? null,
    channelName: input.channel_name,
    videoCount: input.video_count ?? 3,
    durationTarget: input.duration_target ?? 30,
    mode: input.mode ?? "plan",
  }, userId);
}

export async function performanceForUser(userId: string, refresh: boolean) {
  const { syncPerformance, readPerformance } = await import("./performance.server");
  const sync = refresh ? await syncPerformance(userId) : null;
  const data = await readPerformance(userId);
  return { ...data, sync };
}
