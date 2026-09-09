import { createFileRoute } from "@tanstack/react-router";
import { authenticateRequest, jsonResponse } from "@/lib/chatgpt-route-helpers.server";
import { performanceForUser } from "@/lib/chatgpt-actions.server";

export const Route = createFileRoute("/api/public/chatgpt/performance")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authenticateRequest(request);
        if (auth instanceof Response) return auth;
        const url = new URL(request.url);
        const refresh = url.searchParams.get("refresh") === "true";
        try {
          return jsonResponse(await performanceForUser(auth.userId, refresh));
        } catch (err) {
          return jsonResponse({ error: err instanceof Error ? err.message : "Could not read performance." }, 400);
        }
      },
    },
  },
});
