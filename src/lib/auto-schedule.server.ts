/**
 * Auto-schedule: turns approved, rendered videos into queued publishes on a
 * regular cadence, without the operator dragging each card to "Scheduled".
 *
 * Settings live in the service-role-only `cron_config` table so the browser
 * can never flip them directly; the hourly publish worker calls
 * `autoScheduleApproved()` before draining the queue.
 */

const KEY_ENABLED = "auto_schedule_enabled";
const KEY_PER_WEEK = "auto_schedule_per_week";
const KEY_HOUR = "auto_schedule_hour_utc";

const MAX_PER_RUN = 10;

export type AutoScheduleSettings = {
  enabled: boolean;
  perWeek: number;
  hourUtc: number;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function readAutoSchedule(): Promise<AutoScheduleSettings> {
  const db = await admin();
  const { data } = await db.from("cron_config").select("key, value").in("key", [KEY_ENABLED, KEY_PER_WEEK, KEY_HOUR]);
  const map = new Map((data ?? []).map((r) => [r.key, r.value]));
  const perWeek = Number(map.get(KEY_PER_WEEK) ?? 3);
  const hourUtc = Number(map.get(KEY_HOUR) ?? 15);
  return {
    enabled: map.get(KEY_ENABLED) === "true",
    perWeek: Number.isFinite(perWeek) ? Math.min(Math.max(Math.round(perWeek), 1), 21) : 3,
    hourUtc: Number.isFinite(hourUtc) ? Math.min(Math.max(Math.round(hourUtc), 0), 23) : 15,
  };
}

export async function writeAutoSchedule(next: AutoScheduleSettings): Promise<AutoScheduleSettings> {
  const db = await admin();
  const rows = [
    { key: KEY_ENABLED, value: next.enabled ? "true" : "false" },
    { key: KEY_PER_WEEK, value: String(next.perWeek) },
    { key: KEY_HOUR, value: String(next.hourUtc) },
  ].map((r) => ({ ...r, updated_at: new Date().toISOString() }));
  const { error } = await db.from("cron_config").upsert(rows, { onConflict: "key" });
  if (error) throw new Error(error.message);
  return next;
}

/** Aligns a timestamp forward to the configured publishing hour when the cadence is daily-or-slower. */
function alignSlot(at: Date, hourUtc: number, gapHours: number): Date {
  const slot = new Date(at);
  slot.setUTCMinutes(0, 0, 0);
  if (gapHours >= 24) {
    slot.setUTCHours(hourUtc);
    while (slot.getTime() < at.getTime()) slot.setUTCDate(slot.getUTCDate() + 1);
  } else if (slot.getTime() < at.getTime()) {
    slot.setUTCHours(slot.getUTCHours() + 1);
  }
  return slot;
}

/**
 * Queues every approved, rendered, not-yet-queued video onto the next free
 * cadence slot. Idempotent: videos already scheduled or published are skipped.
 */
export async function autoScheduleApproved(): Promise<{ scheduled: number; nextSlot: string | null; skipped?: string }> {
  const settings = await readAutoSchedule();
  if (!settings.enabled) return { scheduled: 0, nextSlot: null, skipped: "auto-schedule is off" };

  const db = await admin();
  const gapHours = Math.max(1, Math.round((7 * 24) / settings.perWeek));

  const { data: videos } = await db
    .from("generated_videos")
    .select("id, channel_id, video_url, approved, youtube_video_id, created_at")
    .eq("approved", true)
    .is("youtube_video_id", null)
    .not("video_url", "is", null)
    .order("created_at", { ascending: true })
    .limit(50);

  const candidates = videos ?? [];
  if (candidates.length === 0) return { scheduled: 0, nextSlot: null };

  const { data: queueRows } = await db
    .from("publish_queue")
    .select("id, generated_video_id, status, scheduled_for");
  const rows = queueRows ?? [];
  const busy = new Set(
    rows.filter((r) => ["scheduled", "publishing", "published"].includes(r.status)).map((r) => r.generated_video_id),
  );

  const pending = candidates.filter((v) => !busy.has(v.id)).slice(0, MAX_PER_RUN);
  if (pending.length === 0) return { scheduled: 0, nextSlot: null };

  const now = Date.now();
  const lastPlanned = rows
    .filter((r) => r.status === "scheduled" || r.status === "publishing")
    .map((r) => new Date(r.scheduled_for).getTime())
    .filter((t) => Number.isFinite(t));
  let cursor = new Date(Math.max(now + 5 * 60_000, ...(lastPlanned.length ? [Math.max(...lastPlanned) + gapHours * 3_600_000] : [])));

  const { scheduleGeneratedVideo } = await import("./autopilot-actions.server");
  let scheduled = 0;
  let nextSlot: string | null = null;

  for (const video of pending) {
    const slot = alignSlot(cursor, settings.hourUtc, gapHours);
    try {
      await scheduleGeneratedVideo(video.id, slot.toISOString());
      scheduled += 1;
      if (!nextSlot) nextSlot = slot.toISOString();
    } catch {
      // A single bad row must not stop the cadence.
    }
    cursor = new Date(slot.getTime() + gapHours * 3_600_000);
  }

  return { scheduled, nextSlot };
}
