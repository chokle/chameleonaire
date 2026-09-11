import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getAutoApprove = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { readAutoApprove } = await import("./auto-approve.server");
    return readAutoApprove();
  });

const SettingsInput = z.object({
  enabled: z.boolean(),
  threshold: z.number().int().min(50).max(100),
});

export const saveAutoApprove = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SettingsInput.parse(input))
  .handler(async ({ data }) => {
    const { writeAutoApprove, autoApproveQueue } = await import("./auto-approve.server");
    const settings = await writeAutoApprove(data);
    const run = settings.enabled ? await autoApproveQueue() : { approved: 0, held: 0 };
    return { settings, ...run };
  });

export const runAutoApprove = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { autoApproveQueue } = await import("./auto-approve.server");
    return autoApproveQueue();
  });
