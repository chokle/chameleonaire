/**
 * Repurpose studio: the operator pastes their OWN short-form content — a script,
 * caption, transcript or rough notes — and we rewrite it as a tighter original
 * short on their channel's brand, with a cold open that states the blueprint's
 * own claimed figures rather than invented ones.
 */
import { callAI, parseJSON } from "./ai.server";
import { figuresPrompt, type BlueprintFigures } from "./blueprint-figures.server";

export type RewrittenShort = {
  title: string;
  hook: string;
  alternates: string[];
  script: string;
  description: string;
  tags: string[];
  thumbnail_prompt: string;
  concept: string;
  duration_target: number;
};

export async function rewriteAsShort(args: {
  source: string;
  brand: Record<string, unknown> | null;
  channelName: string;
  durationTarget: number;
  figures: BlueprintFigures;
}): Promise<RewrittenShort> {
  const { source, brand, channelName, durationTarget, figures } = args;

  const raw = await callAI({
    system:
      "You rewrite an operator's own short-form content into a tighter, stronger vertical short. " +
      "The material belongs to the operator, so you may keep its substance — you sharpen the " +
      "structure: a cold open in the first 8 seconds, escalating specifics, a hard payoff. " +
      "Every short must be EVERGREEN — no dates, years, news, trends or anything that expires. " +
      "Never reference other creators. Respond with strict JSON only.",
    prompt:
      `THE OPERATOR'S OWN CONTENT:\n${source.slice(0, 12000)}\n\n` +
      `BRAND:\n${JSON.stringify({
        name: brand?.["name"] ?? channelName,
        voice: brand?.["voice"] ?? "confident, plain-spoken",
        subject: brand?.["subject"] ?? channelName,
        palette: brand?.["palette"] ?? "high-contrast",
        audience: brand?.["audience"] ?? "general",
        avoid: brand?.["banned_topics"] ?? "none",
      })}\n` +
      figuresPrompt(figures) +
      `\nTARGET LENGTH: ${durationTarget} seconds of spoken script (roughly ${Math.round(
        durationTarget * 2.6,
      )} words).\n` +
      `Return JSON: { "title": string (under 90 chars), "hook": string (the cold open, first 8 seconds, verbatim, under 40 words), ` +
      `"alternates": string[] (2 other cold opens, same constraints), ` +
      `"script": string (full spoken script, hook first, hard payoff at the end), ` +
      `"description": string, "tags": string[] (8-12), "thumbnail_prompt": string (vertical 9:16 cover image prompt, ` +
      `no real people's likenesses), "concept": string (one line on the visual treatment) }`,
  });

  const p = parseJSON<Partial<RewrittenShort>>(raw);
  if (!p.title || !p.script) throw new Error("The engine returned an unusable short. Try again.");
  return {
    title: String(p.title).slice(0, 95),
    hook: String(p.hook ?? "").slice(0, 500),
    alternates: (p.alternates ?? []).map((a) => String(a).slice(0, 400)).slice(0, 3),
    script: String(p.script),
    description: String(p.description ?? "").slice(0, 4900),
    tags: (p.tags ?? []).map((t) => String(t).slice(0, 60)).slice(0, 15),
    thumbnail_prompt: String(p.thumbnail_prompt ?? p.title),
    concept: String(p.concept ?? "").slice(0, 500),
    duration_target: durationTarget,
  };
}
