import { createFileRoute } from "@tanstack/react-router";
import { authenticateRequest, jsonResponse, parseQueryInt, parseQueryFloat } from "@/lib/chatgpt-route-helpers.server";
import { listBlueprintsForUser } from "@/lib/chatgpt-actions.server";

export const Route = createFileRoute("/api/public/chatgpt/blueprints")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authenticateRequest(request);
        if (auth instanceof Response) return auth;
        const url = new URL(request.url);
        const limit = parseQueryInt(url.searchParams.get("limit"), 20, 1, 50);
        const niche = url.searchParams.get("niche") ?? undefined;
        const minConfidence = parseQueryFloat(url.searchParams.get("min_confidence"));
        const result = await listBlueprintsForUser(auth.userId, { limit, niche, min_confidence: minConfidence });
        return jsonResponse(result);
      },
    },
  },
});
