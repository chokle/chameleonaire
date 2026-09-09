import { createFileRoute } from "@tanstack/react-router";
import { authenticateRequest, jsonResponse, parseQueryInt } from "@/lib/chatgpt-route-helpers.server";
import { listQueueForUser } from "@/lib/chatgpt-actions.server";

export const Route = createFileRoute("/api/public/chatgpt/queue")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authenticateRequest(request);
        if (auth instanceof Response) return auth;
        const url = new URL(request.url);
        const result = await listQueueForUser(auth.userId, {
          limit: parseQueryInt(url.searchParams.get("limit"), 20, 1, 50),
          channel_id: url.searchParams.get("channel_id") ?? undefined,
          status: url.searchParams.get("status") ?? undefined,
        });
        return jsonResponse(result);
      },
    },
  },
});
