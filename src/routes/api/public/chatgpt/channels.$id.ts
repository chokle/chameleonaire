import { createFileRoute } from "@tanstack/react-router";
import { authenticateRequest, jsonResponse } from "@/lib/chatgpt-route-helpers.server";
import { getChannelForUser } from "@/lib/chatgpt-actions.server";

export const Route = createFileRoute("/api/public/chatgpt/channels/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const auth = await authenticateRequest(request);
        if (auth instanceof Response) return auth;
        const result = await getChannelForUser(auth.userId, params.id);
        if (!result) return jsonResponse({ error: "Channel not found." }, 404);
        return jsonResponse(result);
      },
    },
  },
});
