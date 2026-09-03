import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { NICHE_RPM, estimateProfit } from "@/lib/domain";

export default defineTool({
  name: "estimate_earnings",
  title: "Estimate channel earnings",
  description:
    "Estimate YouTube earnings from average views per video, upload cadence and niche RPM. Returns per-video, monthly and yearly low/high ranges in USD.",
  inputSchema: {
    avg_views_per_video: z.number().min(0).describe("Average views per video."),
    videos_per_month: z.number().int().min(1).max(300).default(8).describe("Videos published per month."),
    niche: z
      .string()
      .trim()
      .min(1)
      .default("finance")
      .describe(`Content niche. Known niches: ${Object.keys(NICHE_RPM).join(", ")}.`),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ avg_views_per_video, videos_per_month, niche }) => {
    const perVideo = estimateProfit(avg_views_per_video, niche);
    const result = {
      niche,
      avgViewsPerVideo: avg_views_per_video,
      videosPerMonth: videos_per_month,
      rpmRange: [perVideo.rpmLow, perVideo.rpmHigh],
      perVideo: { low: perVideo.profitLow, mid: perVideo.profit, high: perVideo.profitHigh },
      perMonth: {
        low: perVideo.profitLow * videos_per_month,
        mid: perVideo.profit * videos_per_month,
        high: perVideo.profitHigh * videos_per_month,
      },
      perYear: {
        low: perVideo.profitLow * videos_per_month * 12,
        mid: perVideo.profit * videos_per_month * 12,
        high: perVideo.profitHigh * videos_per_month * 12,
      },
    };
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
    };
  },
});
