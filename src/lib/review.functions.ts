import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Full review payload (script, hook, preview URL, render state) for one video. */
export const reviewVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ videoId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { reviewVideoForUser } = await import("./chatgpt-actions.server");
    return reviewVideoForUser(context.userId, data.videoId);
  });
