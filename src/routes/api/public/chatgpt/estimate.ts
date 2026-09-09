import { createFileRoute } from "@tanstack/react-router";
import { authenticateRequest, jsonResponse, parseQueryInt } from "@/lib/chatgpt-route-helpers.server";
import { estimateEarningsForUser } from "@/lib/chatgpt-actions.server";

export const Route = createFileRoute("/api/public/chatgpt/estimate")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authenticateRequest(request);
        if (auth instanceof Response) return auth;
        const url = new URL(request.url);
        const avgViewsRaw = url.searchParams.get("avg_views_per_video");
        if (!avgViewsRaw) {
          return jsonResponse(
            { error: "Missing required query parameter: avg_views_per_video" },
            400,
          );
        }
        const avgViews = parseFloat(avgViewsRaw);
        if (Number.isNaN(avgViews) || avgViews <= 0) {
          return jsonResponse({ error: "avg_views_per_video must be a positive number" }, 400);
        }
        const videosPerMonth = parseQueryInt(url.searchParams.get("videos_per_month"), 8, 1, 300);
        const niche = url.searchParams.get("niche") ?? undefined;
        const result = await estimateEarningsForUser(auth.userId, {
          avg_views_per_video: avgViews,
          videos_per_month: videosPerMonth,
          niche,
        });
        return jsonResponse(result);
      },
    },
  },
});
