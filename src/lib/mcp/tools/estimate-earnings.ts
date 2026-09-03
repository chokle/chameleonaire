import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { NICHE_RPM, estimateProfit } from "@/lib/domain";

export default defineTool({
  name: "estimate_earnings",
  title: "Estimate channel earnings",
  description:
    "Estimate YouTube earnings for a channel using monthly views, upload cadence and niche RPM. Returns per-video, monthly and yearly low/high ranges in USD.",
  inputSchema: {
    monthly_views: z.number().min(0).describe("Total monthly views across the channel."),
    videos_per_month: z.number().int().min(1).max(300).default(8).describe("Videos published per month."),
    niche: z
      .string()
      .trim()
      .min(1)
      .default("finance")
      .describe(`Content niche. Known niches: ${Object.keys(NICHE_RPM).join(", ")}.`),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ monthly_views, videos_per_month, niche }) => {
    const result = estimateProfit({
      monthlyViews: monthly_views,
      videosPerMonth: videos_per_month,
      niche,
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: result as unknown as Record<string, unknown>,
    };
  },
});
