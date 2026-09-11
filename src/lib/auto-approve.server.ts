/**
 * Confidence auto-approval: a queued video whose blueprint confidence clears the
 * configured threshold is approved and scheduled automatically, so the publish
 * worker uploads it without an operator clicking through the queue.
 *
 * Manual actions always win — approving, cancelling or unapproving a row moves it
 * out of `awaiting_approval`, and this pass only ever touches rows still sitting
 * there. Settings live in the service-role-only `cron_config` table.
 */

import { DEPLOY_THRESHOLD } from "./domain";

const KEY_ENABLED = "auto_approve_enabled";
const KEY_THRESHOLD = "auto_approve_threshold";

const MAX_PER_RUN = 10;

export type AutoApproveSettings = {
  enabled: boolean;
  threshold: number;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function clampThreshold(value: number): number {
  if (!Number.isFinite(value)) return DEPLOY_THRESHOLD;
  return Math.min(Math.max(Math.round(value), 50), 100);
}

export async function readAutoApprove(): Promise<AutoApproveSettings> {
  const db = await admin();
  const { data } = await db
    .from("cron_config")
    .select("key, value")
    .in("key", [KEY_ENABLED, KEY_THRESHOLD]);
  const map = new Map((data ?? []).map((r) => [r.key, r.value]));
  return {
    enabled: map.get(KEY_ENABLED) === "true",
    threshold: clampThreshold(Number(map.get(KEY_THRESHOLD) ?? DEPLOY_THRESHOLD)),
  };
}

export async function writeAutoApprove(next: AutoApproveSettings): Promise<AutoApproveSettings> {
  const db = await admin();
  const settings: AutoApproveSettings = {
    enabled: next.enabled,
    threshold: clampThreshold(next.threshold),
  };
  const rows = [
    { key: KEY_ENABLED, value: settings.enabled ? "true" : "false" },
    { key: KEY_THRESHOLD, value: String(settings.threshold) },
  ].map((r) => ({ ...r, updated_at: new Date().toISOString() }));
  const { error } = await db.from("cron_config").upsert(rows, { onConflict: "key" });
  if (error) throw new Error(error.message);
  return settings;
}

/**
 * Approves and schedules every awaiting-approval queue row whose blueprint
 * confidence clears the threshold. Only rendered videos qualify — an unrendered
 * one has nothing to upload.
 */
export async function autoApproveQueue(): Promise<{
  approved: number;
  held: number;
  skipped?: string;
}> {
  const settings = await readAutoApprove();
  if (!settings.enabled) return { approved: 0, held: 0, skipped: "auto-approval is off" };

  const db = await admin();
  const { data: rows } = await db
    .from("publish_queue")
    .select("id, generated_video_id, generated_videos(id, video_url, blueprint_id)")
    .eq("status", "awaiting_approval")
    .order("scheduled_for", { ascending: true })
    .limit(50);

  const pending = (rows ?? []).filter((r) => {
    const v = r.generated_videos as { video_url?: string | null } | null;
    return Boolean(v?.video_url);
  });
  if (pending.length === 0) return { approved: 0, held: 0 };

  const blueprintIds = Array.from(
    new Set(
      pending
        .map((r) => (r.generated_videos as { blueprint_id?: string | null } | null)?.blueprint_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const confidence = new Map<string, number>();
  if (blueprintIds.length > 0) {
    const { data: bps } = await db.from("blueprints").select("id, confidence").in("id", blueprintIds);
    for (const b of bps ?? []) confidence.set(b.id, Number(b.confidence));
  }

  let approved = 0;
  let held = 0;

  for (const row of pending) {
    const video = row.generated_videos as { id?: string; blueprint_id?: string | null } | null;
    const score = video?.blueprint_id ? (confidence.get(video.blueprint_id) ?? 0) : 0;
    if (score < settings.threshold || approved >= MAX_PER_RUN) {
      held += 1;
      continue;
    }
    const { error } = await db
      .from("publish_queue")
      .update({ status: "scheduled" })
      .eq("id", row.id)
      .eq("status", "awaiting_approval"); // a manual action in the meantime wins
    if (error) {
      held += 1;
      continue;
    }
    if (video?.id) {
      await db.from("generated_videos").update({ approved: true }).eq("id", video.id);
    }
    approved += 1;
  }

  return { approved, held };
}
