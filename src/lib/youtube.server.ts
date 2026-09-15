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
  likes: number;
  comments: number;
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
      statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
      contentDetails?: { duration?: string };
    }>;
  }>("videos", { part: "snippet,statistics,contentDetails", id: ids.join(",") }, key);

  return (data.items ?? []).map((v) => ({
    id: v.id,
    title: v.snippet?.title ?? "Untitled",
    views: Number(v.statistics?.viewCount ?? 0),
    publishedAt: v.snippet?.publishedAt ?? new Date().toISOString(),
    durationSeconds: isoToSeconds(v.contentDetails?.duration ?? ""),
    likes: Number(v.statistics?.likeCount ?? 0),
    comments: Number(v.statistics?.commentCount ?? 0),
  }));
}

export type { YTChannel, YTVideo };

/** Resolve a pasted YouTube channel URL / @handle / channel id to a canonical channel id. */
export async function resolveChannelId(input: string, key: string): Promise<string | null> {
  const raw = input.trim();
  if (!raw) return null;

  const direct = /(?:youtube\.com\/channel\/)(UC[\w-]{20,})/i.exec(raw);
  if (direct?.[1]) return direct[1];
  if (/^UC[\w-]{20,}$/.test(raw)) return raw;

  // A video link: resolve through the video's channel.
  const video = /(?:v=|youtu\.be\/|\/shorts\/)([\w-]{8,})/.exec(raw);
  if (video?.[1]) {
    const data = await get<{ items?: Array<{ snippet?: { channelId?: string } }> }>(
      "videos",
      { part: "snippet", id: video[1] },
      key,
    );
    const id = data.items?.[0]?.snippet?.channelId;
    if (id) return id;
  }

  const handleMatch = /@([\w.\-]+)/.exec(raw);
  if (handleMatch?.[1]) {
    const data = await get<{ items?: Array<{ id?: string }> }>(
      "channels",
      { part: "id", forHandle: `@${handleMatch[1]}` },
      key,
    ).catch(() => ({ items: [] }));
    if (data.items?.[0]?.id) return data.items[0].id!;
  }

  const legacy = /youtube\.com\/(?:c|user)\/([\w.\-]+)/i.exec(raw);
  if (legacy?.[1]) {
    const data = await get<{ items?: Array<{ id?: string }> }>(
      "channels",
      { part: "id", forUsername: legacy[1] },
      key,
    ).catch(() => ({ items: [] }));
    if (data.items?.[0]?.id) return data.items[0].id!;
  }

  // Last resort: search by the most meaningful token in the link.
  const term = handleMatch?.[1] ?? legacy?.[1] ?? raw.replace(/https?:\/\/\S*?youtube\.com\//i, "");
  const search = await get<{ items?: Array<{ snippet?: { channelId?: string } }> }>(
    "search",
    { part: "snippet", type: "channel", q: term.slice(0, 80), maxResults: "1" },
    key,
  ).catch(() => ({ items: [] }));
  return search.items?.[0]?.snippet?.channelId ?? null;
}
