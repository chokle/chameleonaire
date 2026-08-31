import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return data;
    },
  });

export const creatorQuery = (id: string) =>
  queryOptions({
    queryKey: ["creator", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("creators")
        .select("*, creator_videos(*)")
        .eq("id", id)
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
  });

export const scansQuery = queryOptions({
  queryKey: ["scans"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("scans")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data;
  },
});

export const blueprintsQuery = queryOptions({
  queryKey: ["blueprints"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("blueprints")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data;
  },
});

export const blueprintQuery = (id: string) =>
  queryOptions({
    queryKey: ["blueprint", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("blueprints").select("*").eq("id", id).single();
      if (error) throw new Error(error.message);
      return data;
    },
  });

export const brandsQuery = queryOptions({
  queryKey: ["brands"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("brands")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  },
});

export const channelsQuery = queryOptions({
  queryKey: ["channels"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("channels")
      .select("*, blueprints(name, confidence, win_rate), brands(name)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  },
});

export const channelQuery = (id: string) =>
  queryOptions({
    queryKey: ["channel", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("channels")
        .select("*, blueprints(*), brands(*)")
        .eq("id", id)
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
  });

export const channelVideosQuery = (id: string) =>
  queryOptions({
    queryKey: ["channel-videos", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generated_videos")
        .select("*")
        .eq("channel_id", id)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data;
    },
  });

export const queueQuery = queryOptions({
  queryKey: ["queue"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("publish_queue")
      .select("*, generated_videos(title, thumbnail_url, approved, status), channels(name)")
      .order("scheduled_for", { ascending: true })
      .limit(100);
    if (error) throw new Error(error.message);
    return data;
  },
});

export const snapshotsQuery = queryOptions({
  queryKey: ["snapshots"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("performance_snapshots")
      .select("*")
      .order("captured_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data;
  },
});
