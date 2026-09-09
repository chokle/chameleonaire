import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getNextActions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { nextActions } = await import("./autopilot.server");
    return nextActions();
  });

const AutopilotInput = z.object({
  niche: z.string().trim().min(2).max(80),
  min: z.number().min(0).default(2000),
  max: z.number().nullable().default(10000),
  channelName: z.string().trim().max(120).optional(),
  videoCount: z.number().int().min(1).max(6).default(3),
  durationTarget: z.number().int().min(8).max(120).default(30),
  mode: z.enum(["plan", "full"]).default("plan"),
});

export const startAutopilot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AutopilotInput.parse(input))
  .handler(async ({ data }) => {
    const { runAutopilot } = await import("./autopilot.server");
    return runAutopilot(data);
  });

const ScheduleInput = z.object({
  videoId: z.string().uuid(),
  scheduledFor: z.string().datetime().optional(),
});

export const scheduleVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ScheduleInput.parse(input))
  .handler(async ({ data }) => {
    const { scheduleGeneratedVideo } = await import("./autopilot-actions.server");
    return scheduleGeneratedVideo(data.videoId, data.scheduledFor ?? null);
  });
