import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_blueprints",
  title: "List strategy blueprints",
  description:
    "List extracted strategy blueprints with their niche, confidence score, generation and whether they are deployable.",
  inputSchema: {
    niche: z.string().trim().min(1).optional().describe("Only blueprints in this niche."),
    min_confidence: z.number().min(0).max(100).optional().describe("Minimum confidence score (0-100)."),
    limit: z.number().int().min(1).max(50).default(20).describe("How many blueprints to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ niche, min_confidence, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("blueprints")
      .select("id, name, niche, confidence, generation, status, deployable, win_rate, gap_notes, created_at")
      .order("confidence", { ascending: false })
      .limit(limit);

    if (niche) query = query.eq("niche", niche);
    if (typeof min_confidence === "number") query = query.gte("confidence", min_confidence);

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { blueprints: data ?? [] },
    };
  },
});
