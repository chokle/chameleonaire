/**
 * Clip studio: read a long-form video's PUBLIC metadata from anywhere on the web,
 * find the moments worth turning into shorts, and write ORIGINAL shorts around
 * those moments. We never download, re-cut or re-upload anyone's footage — the
 * source is used as structure/inspiration only, and every short we produce is
 * written and rendered from scratch on the user's own brand.
 */
import { callAI, parseJSON } from "./ai.server";

export type SourceInfo = {
  url: string;
  platform: string;
  title: string;
  author: string;
  description: string;
  durationSeconds: number;
};

export type ClipMoment = {
  start: number;
  end: number;
  label: string;
  why: string;
  angle: string;
};

export function hhmmss(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`;
}

export function parseTimecode(value: string): number {
  const parts = value
    .trim()
    .split(":")
    .map((p) => Number(p.replace(/[^\d.]/g, "")) || 0);
  if (!parts.length) return 0;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

function isoToSeconds(iso: string): number {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso ?? "");
  if (!m) return 0;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

function youtubeVideoId(url: string): string | null {
  const m = /(?:v=|youtu\.be\/|\/shorts\/|\/embed\/)([\w-]{8,})/.exec(url);
  return m?.[1] ?? null;
}

function decodeEntities(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/** Read whatever public metadata the source page or API will give us. */
export async function readSource(url: string): Promise<SourceInfo> {
  const clean = url.trim();
  let host = "the web";
  try {
    host = new URL(clean).hostname.replace(/^www\./, "");
  } catch {
    throw new Error("That does not look like a valid video link.");
  }

  const ytId = youtubeVideoId(clean);
  const key = process.env["YOUTUBE_API_KEY"];
  if (ytId && key) {
    const qs = new URLSearchParams({
      part: "snippet,contentDetails",
      id: ytId,
      key,
    }).toString();
    const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?${qs}`);
    if (res.ok) {
      const json = (await res.json()) as {
        items?: Array<{
          snippet?: { title?: string; description?: string; channelTitle?: string };
          contentDetails?: { duration?: string };
        }>;
      };
      const item = json.items?.[0];
      if (item) {
        return {
          url: clean,
          platform: "YouTube",
          title: item.snippet?.title ?? "Untitled",
          author: item.snippet?.channelTitle ?? "Unknown",
          description: (item.snippet?.description ?? "").slice(0, 6000),
          durationSeconds: isoToSeconds(item.contentDetails?.duration ?? ""),
        };
      }
    }
  }

  // Anything else on the internet: oEmbed first, then the page's own tags.
  const oembed = await fetch(
    `https://noembed.com/embed?url=${encodeURIComponent(clean)}`,
  )
    .then((r) => (r.ok ? (r.json() as Promise<Record<string, unknown>>) : null))
    .catch(() => null);

  let title = typeof oembed?.["title"] === "string" ? (oembed["title"] as string) : "";
  let author =
    typeof oembed?.["author_name"] === "string" ? (oembed["author_name"] as string) : "";
  let description = "";
  let durationSeconds = 0;

  const page = await fetch(clean, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; chameleonaire/1.0)" },
  })
    .then((r) => (r.ok ? r.text() : ""))
    .catch(() => "");

  if (page) {
    const html = page.slice(0, 400_000);
    const meta = (prop: string) =>
      new RegExp(
        `<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`,
        "i",
      ).exec(html)?.[1] ?? "";
    title ||= decodeEntities(meta("og:title") || /<title>([^<]+)<\/title>/i.exec(html)?.[1] || "");
    description = decodeEntities(meta("og:description") || meta("description") || "");
    const dur = meta("og:video:duration") || meta("video:duration");
    if (dur) durationSeconds = Number(dur) || 0;
    author ||= decodeEntities(meta("og:site_name") || "");
  }

  if (!title) throw new Error("Could not read that link. Try a direct video page URL.");

  return {
    url: clean,
    platform: host,
    title,
    author: author || host,
    description: description.slice(0, 6000),
    durationSeconds,
  };
}

/** Ask the model where the short-form gold is inside the long video. */
export async function suggestMoments(source: SourceInfo, count: number): Promise<ClipMoment[]> {
  const raw = await callAI({
    system:
      "You are a short-form editor. Given a long-form video's public metadata you identify the moments " +
      "most likely to work as standalone vertical shorts. You never reproduce the source's wording, " +
      "footage or claims — you name the MOMENT and the reusable structural angle only. " +
      "Every angle must be EVERGREEN: no dates, news, trends or anything that expires. " +
      "Respond with strict JSON only.",
    prompt:
      `SOURCE TITLE: ${source.title}\nCHANNEL: ${source.author}\nPLATFORM: ${source.platform}\n` +
      `LENGTH (seconds): ${source.durationSeconds || "unknown"}\n` +
      `DESCRIPTION:\n${source.description.slice(0, 4000)}\n\n` +
      `Propose ${count} clip moments spread across the video. If the length is unknown assume 12 minutes. ` +
      `Return JSON: { "moments": [ { "start": number (seconds), "end": number (seconds, 20-70s after start), ` +
      `"label": string (what happens in that moment, max 10 words), "why": string (why it stops a scroll, one sentence), ` +
      `"angle": string (the evergreen short-form angle we would build originally around it) } ] }`,
  });
  const parsed = parseJSON<{ moments?: ClipMoment[] }>(raw);
  const max = source.durationSeconds || 43200;
  return (parsed.moments ?? [])
    .map((m) => {
      const start = Math.max(0, Math.min(Number(m.start) || 0, max));
      const end = Math.max(start + 15, Math.min(Number(m.end) || start + 40, max || start + 70));
      return {
        start,
        end,
        label: String(m.label ?? "Moment").slice(0, 120),
        why: String(m.why ?? "").slice(0, 300),
        angle: String(m.angle ?? "").slice(0, 400),
      };
    })
    .slice(0, count);
}

type BuiltShort = {
  title: string;
  hook: string;
  script: string;
  description: string;
  tags: string[];
  thumbnail_prompt: string;
  concept: string;
  duration_target: number;
};

/** Write an original vertical short around a clip moment, on the user's brand. */
export async function writeShort(args: {
  source: SourceInfo;
  moment: ClipMoment;
  brand: Record<string, unknown> | null;
  channelName: string;
  durationTarget: number;
}): Promise<BuiltShort> {
  const { source, moment, brand, channelName, durationTarget } = args;
  const raw = await callAI({
    model: "google/gemini-3.7-flash",
    system:
      "You write original vertical shorts. You are given a moment from someone else's long-form video as " +
      "STRUCTURAL inspiration only: you take the shape of the beat (the tension, the reveal, the pacing) and " +
      "write a completely original short on the operator's own brand. Never reuse the source's wording, " +
      "claims, footage, thumbnails or name, and never mention the source creator. " +
      "Every short must be EVERGREEN — no dates, years, news, trends or anything that expires. " +
      "Respond with strict JSON only.",
    prompt:
      `SOURCE MOMENT (inspiration only): ${moment.label} — ${moment.why}\n` +
      `ANGLE: ${moment.angle}\nSOURCE TOPIC AREA: ${source.title}\n\n` +
      `BRAND:\n${JSON.stringify({
        name: brand?.["name"] ?? channelName,
        voice: brand?.["voice"] ?? "confident, plain-spoken",
        subject: brand?.["subject"] ?? channelName,
        palette: brand?.["palette"] ?? "high-contrast",
        audience: brand?.["audience"] ?? "general",
        avoid: brand?.["banned_topics"] ?? "none",
      })}\n\n` +
      `TARGET LENGTH: ${durationTarget} seconds of spoken script (roughly ${Math.round(durationTarget * 2.6)} words).\n` +
      `Return JSON: { "title": string (under 90 chars), "hook": string (first 3 seconds, verbatim), ` +
      `"script": string (full spoken script for a vertical short, hook first, hard payoff at the end), ` +
      `"description": string, "tags": string[] (8-12), "thumbnail_prompt": string (vertical 9:16 cover image prompt, ` +
      `no real people's likenesses), "concept": string (one line on the visual treatment) }`,
  });
  const p = parseJSON<Partial<BuiltShort>>(raw);
  if (!p.title || !p.script) throw new Error("The engine returned an unusable short. Try again.");
  return {
    title: String(p.title).slice(0, 95),
    hook: String(p.hook ?? "").slice(0, 500),
    script: String(p.script),
    description: String(p.description ?? "").slice(0, 4900),
    tags: (p.tags ?? []).map((t) => String(t).slice(0, 60)).slice(0, 15),
    thumbnail_prompt: String(p.thumbnail_prompt ?? p.title),
    concept: String(p.concept ?? moment.angle).slice(0, 500),
    duration_target: durationTarget,
  };
}
