import { createFileRoute } from "@tanstack/react-router";
import { authenticateRequest, jsonResponse, parseQueryInt } from "@/lib/chatgpt-route-helpers.server";
import { listChannelsForUser } from "@/lib/chatgpt-actions.server";

export const Route = createFileRoute("/api/public/chatgpt/channels")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authenticateRequest(request);
        if (auth instanceof Response) return auth;
        const url = new URL(request.url);
        const limit = parseQueryInt(url.searchParams.get("limit"), 20, 1, 50);
        const result = await listChannelsForUser(auth.userId, { limit });
        return jsonResponse(result);
      },
    },
  },
});
