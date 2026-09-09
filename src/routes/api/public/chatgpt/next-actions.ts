import { createFileRoute } from "@tanstack/react-router";
import { authenticateRequest, jsonResponse } from "@/lib/chatgpt-route-helpers.server";
import { nextActionsForUser } from "@/lib/chatgpt-actions.server";

export const Route = createFileRoute("/api/public/chatgpt/next-actions")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authenticateRequest(request);
        if (auth instanceof Response) return auth;
        try {
          return jsonResponse(await nextActionsForUser(auth.userId));
        } catch (err) {
          return jsonResponse({ error: err instanceof Error ? err.message : "Could not build actions." }, 400);
        }
      },
    },
  },
});
