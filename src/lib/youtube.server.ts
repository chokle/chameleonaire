/** Public YouTube metadata reader. Only used when a Data API key is configured. */

type YTChannel = {
  id: string;
  title: string;
  handle: string | null;
  subscribers: number;
  totalViews: number;
  videoCount: number;
  uploadsPlaylist: string | null;
};

type YTVideo = {
  id: string;
  title: string;
  views: number;
  publishedAt: string;
  durationSeconds: number;
};

const API = "https://www.googleapis.com/youtube/v3";

export function youtubeKey(): string | null {
  return process.env["YOUTUBE_API_KEY"] ?? null;
}

async function get<T>(path: string, params: Record<string, string>, key: string): Promise<T> {
  const qs = new URLSearchParams({ ...params, key }).toString();
  const res = await fetch(`${API}/${path}?${qs}`);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`YouTube API ${res.status}: ${body.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

function isoToSeconds(iso: string): number {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso ?? "");
  if (!m) return 0;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

export async function searchChannels(niche: string, limit: number, key: string): Promise<string[]> {
  const data = await get<{ items?: Array<{ snippet?: { channelId?: string } }> }>(
    "search",
    {
      part: "snippet",
      type: "video",
      q: niche,
      order: "viewCount",
      maxResults: String(Math.min(50, limit * 3)),
      publishedAfter: new Date(Date.now() - 1000 * 60 * 60 * 24 * 120).toISOString(),
    },
    key,
  );
  const ids = new Set<string>();
  for (const item of data.items ?? []) {
    const id = item.snippet?.channelId;
    if (id) ids.add(id);
  }
  return [...ids].slice(0, limit);
}

export async function getChannels(ids: string[], key: string): Promise<YTChannel[]> {
  if (!ids.length) return [];
  const data = await get<{
    items?: Array<{
      id: string;
      snippet?: { title?: string; customUrl?: string };
      statistics?: { subscriberCount?: string; viewCount?: string; videoCount?: string };
      contentDetails?: { relatedPlaylists?: { uploads?: string } };
    }>;
  }>("channels", { part: "snippet,statistics,contentDetails", id: ids.join(",") }, key);

  return (data.items ?? []).map((c) => ({
    id: c.id,
    title: c.snippet?.title ?? "Unknown channel",
    handle: c.snippet?.customUrl ?? null,
    subscribers: Number(c.statistics?.subscriberCount ?? 0),
    totalViews: Number(c.statistics?.viewCount ?? 0),
    videoCount: Number(c.statistics?.videoCount ?? 0),
    uploadsPlaylist: c.contentDetails?.relatedPlaylists?.uploads ?? null,
  }));
}

export async function getRecentVideos(
  playlistId: string,
  key: string,
  limit = 12,
): Promise<YTVideo[]> {
  const list = await get<{ items?: Array<{ contentDetails?: { videoId?: string } }> }>(
    "playlistItems",
    { part: "contentDetails", playlistId, maxResults: String(limit) },
    key,
  );
  const ids = (list.items ?? []).map((i) => i.contentDetails?.videoId).filter(Boolean) as string[];
  if (!ids.length) return [];

  const data = await get<{
    items?: Array<{
      id: string;
      snippet?: { title?: string; publishedAt?: string };
      statistics?: { viewCount?: string };
      contentDetails?: { duration?: string };
    }>;
  }>("videos", { part: "snippet,statistics,contentDetails", id: ids.join(",") }, key);

  return (data.items ?? []).map((v) => ({
    id: v.id,
    title: v.snippet?.title ?? "Untitled",
    views: Number(v.statistics?.viewCount ?? 0),
    publishedAt: v.snippet?.publishedAt ?? new Date().toISOString(),
    durationSeconds: isoToSeconds(v.contentDetails?.duration ?? ""),
  }));
}

export type { YTChannel, YTVideo };
