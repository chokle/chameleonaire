import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getPerformance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { readPerformance } = await import("./performance.server");
    return readPerformance();
  });

export const refreshPerformance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { syncPerformance, readPerformance } = await import("./performance.server");
    const sync = await syncPerformance();
    const data = await readPerformance();
    return { ...data, sync };
  });
