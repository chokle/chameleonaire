import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return (data ?? []) as T;
}

export const creatorsQuery = (scanId?: string | null) =>
  queryOptions({
    queryKey: ["creators", scanId ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("creators")
        .select("*")
        .order("est_profit_per_video", { ascending: false })
        .limit(200);
      if (scanId) q = q.eq("scan_id", scanId);
      return unwrap(await q);
    },
  });

export const creatorQuery = (id: string) =>
  queryOptions({
    queryKey: ["creator", id],
    queryFn: async () =>
      unwrap(await supabase.from("creators").select("*, creator_videos(*)").eq("id", id).single()),
  });

export const scansQuery = queryOptions({
  queryKey: ["scans"],
  queryFn: async () =>
    unwrap(await supabase.from("scans").select("*").order("created_at", { ascending: false }).limit(50)),
});

export const blueprintsQuery = queryOptions({
  queryKey: ["blueprints"],
  queryFn: async () =>
    unwrap(
      await supabase.from("blueprints").select("*").order("created_at", { ascending: false }).limit(100),
    ),
});

export const blueprintQuery = (id: string) =>
  queryOptions({
    queryKey: ["blueprint", id],
    queryFn: async () => unwrap(await supabase.from("blueprints").select("*").eq("id", id).single()),
  });

export const brandsQuery = queryOptions({
  queryKey: ["brands"],
  queryFn: async () =>
    unwrap(await supabase.from("brands").select("*").order("created_at", { ascending: false })),
});

export const channelsQuery = queryOptions({
  queryKey: ["channels"],
  queryFn: async () =>
    unwrap(
      await supabase
        .from("channels")
        .select("*, blueprints(name, confidence, win_rate), brands(name)")
        .order("created_at", { ascending: false }),
    ),
});

export const channelQuery = (id: string) =>
  queryOptions({
    queryKey: ["channel", id],
    queryFn: async () =>
      unwrap(
        await supabase
          .from("channels")
          .select("*, blueprints(*), brands(*)")
          .eq("id", id)
          .single(),
      ),
  });

export const channelVideosQuery = (id: string) =>
  queryOptions({
    queryKey: ["channel-videos", id],
    queryFn: async () =>
      unwrap(
        await supabase
          .from("generated_videos")
          .select("*")
          .eq("channel_id", id)
          .order("created_at", { ascending: false }),
      ),
  });

export const queueQuery = queryOptions({
  queryKey: ["queue"],
  queryFn: async () =>
    unwrap(
      await supabase
        .from("publish_queue")
        .select("*, generated_videos(title, thumbnail_url, approved, status), channels(name)")
        .order("scheduled_for", { ascending: true })
        .limit(100),
    ),
});

export const snapshotsQuery = queryOptions({
  queryKey: ["snapshots"],
  queryFn: async () =>
    unwrap(
      await supabase
        .from("performance_snapshots")
        .select("*")
        .order("captured_at", { ascending: false })
        .limit(200),
    ),
});
