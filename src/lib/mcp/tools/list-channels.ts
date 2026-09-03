import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_channels",
  title: "List spawned channels",
  description: "List spawned channels with their brand, blueprint, auto-publish setting and status.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).default(20).describe("How many channels to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("channels")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { channels: data ?? [] },
    };
  },
});
