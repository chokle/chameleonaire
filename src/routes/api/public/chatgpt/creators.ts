import { createFileRoute } from "@tanstack/react-router";
import { authenticateRequest, jsonResponse, parseQueryInt, parseQueryFloat } from "@/lib/chatgpt-route-helpers.server";
import { listCreatorsForUser } from "@/lib/chatgpt-actions.server";

export const Route = createFileRoute("/api/public/chatgpt/creators")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authenticateRequest(request);
        if (auth instanceof Response) return auth;
        const url = new URL(request.url);
        const limit = parseQueryInt(url.searchParams.get("limit"), 20, 1, 50);
        const niche = url.searchParams.get("niche") ?? undefined;
        const scanId = url.searchParams.get("scan_id") ?? undefined;
        const minProfit = parseQueryFloat(url.searchParams.get("min_profit_per_video"));
        const result = await listCreatorsForUser(auth.userId, {
          limit,
          niche,
          scan_id: scanId,
          min_profit_per_video: minProfit,
        });
        return jsonResponse(result);
      },
    },
  },
});
