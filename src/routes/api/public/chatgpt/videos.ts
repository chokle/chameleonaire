import { createFileRoute } from "@tanstack/react-router";
import { authenticateRequest, jsonResponse, parseQueryInt } from "@/lib/chatgpt-route-helpers.server";
import { listVideosForUser } from "@/lib/chatgpt-actions.server";

export const Route = createFileRoute("/api/public/chatgpt/videos")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authenticateRequest(request);
        if (auth instanceof Response) return auth;
        const url = new URL(request.url);
        const approvedParam = url.searchParams.get("approved");
        const result = await listVideosForUser(auth.userId, {
          limit: parseQueryInt(url.searchParams.get("limit"), 20, 1, 50),
          channel_id: url.searchParams.get("channel_id") ?? undefined,
          status: url.searchParams.get("status") ?? undefined,
          approved: approvedParam === null ? undefined : approvedParam === "true",
        });
        return jsonResponse(result);
      },
    },
  },
});
