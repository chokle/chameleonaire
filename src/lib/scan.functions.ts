import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ScanInput = z.object({
  niche: z.string().min(2).max(80),
  min: z.number().min(0),
  max: z.number().nullable(),
  count: z.number().min(3).max(24).default(12),
  persistent: z.boolean().default(false),
  datasetId: z.string().uuid().nullable().default(null),
});

export const runScan = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ScanInput.parse(input))
  .handler(async ({ data }) => {
    const { executeScan } = await import("./scan.server");
    return executeScan(data);
  });

export const rescanPersistent = createServerFn({ method: "POST" }).handler(async () => {
  const { runPersistentSweep } = await import("./scan.server");
  return runPersistentSweep();
});
