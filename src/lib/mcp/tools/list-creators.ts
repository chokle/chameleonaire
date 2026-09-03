import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_creators",
  title: "List surfaced creators",
  description:
    "List creators surfaced by scans, with subscribers, average views and estimated profit per video. Filter by niche, scan or minimum profit.",
  inputSchema: {
    niche: z.string().trim().min(1).optional().describe("Only creators in this niche."),
    scan_id: z.string().uuid().optional().describe("Only creators from this scan."),
    min_profit_per_video: z.number().min(0).optional().describe("Minimum estimated profit per video, in USD."),
    limit: z.number().int().min(1).max(50).default(20).describe("How many creators to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ niche, scan_id, min_profit_per_video, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("creators")
      .select(
        "id, channel_name, handle, channel_url, niche, subscribers, avg_views, uploads_per_month, est_profit_per_video, est_monthly, data_source, scan_id",
      )
      .order("est_profit_per_video", { ascending: false })
      .limit(limit);

    if (niche) query = query.eq("niche", niche);
    if (scan_id) query = query.eq("scan_id", scan_id);
    if (typeof min_profit_per_video === "number") {
      query = query.gte("est_profit_per_video", min_profit_per_video);
    }

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { creators: data ?? [] },
    };
  },
});
