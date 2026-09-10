import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getAutoSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { readAutoSchedule } = await import("./auto-schedule.server");
    return readAutoSchedule();
  });

const SettingsInput = z.object({
  enabled: z.boolean(),
  perWeek: z.number().int().min(1).max(21),
  hourUtc: z.number().int().min(0).max(23),
});

export const saveAutoSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SettingsInput.parse(input))
  .handler(async ({ data }) => {
    const { writeAutoSchedule, autoScheduleApproved } = await import("./auto-schedule.server");
    const saved = await writeAutoSchedule(data);
    const run = saved.enabled ? await autoScheduleApproved() : { scheduled: 0, nextSlot: null };
    return { settings: saved, ...run };
  });

export const runAutoSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { autoScheduleApproved } = await import("./auto-schedule.server");
    return autoScheduleApproved();
  });
