import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const SpawnInput = z.object({
  channelId: z.string().uuid(),
  count: z.number().min(1).max(6).default(3),
});

export const chameleonize = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SpawnInput.parse(input))
  .handler(async ({ data, context }) => {
    const { generateForChannel } = await import("./chameleon.server");
    return generateForChannel(data.channelId, data.count, context.userId);
  });

const ThumbInput = z.object({ videoId: z.string().uuid() });

export const renderThumbnail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ThumbInput.parse(input))
  .handler(async ({ data, context }) => {
    const { makeThumbnail } = await import("./chameleon.server");
    return makeThumbnail(data.videoId, context.userId);
  });

const LoopInput = z.object({ channelId: z.string().uuid().nullable().default(null) });

export const runFeedbackLoop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => LoopInput.parse(input))
  .handler(async ({ data, context }) => {
    const { learnFromPerformance } = await import("./chameleon.server");
    return learnFromPerformance(data.channelId, context.userId);
  });
