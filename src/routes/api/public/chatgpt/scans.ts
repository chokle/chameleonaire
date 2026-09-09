import { createFileRoute } from "@tanstack/react-router";
import { authenticateRequest, jsonResponse, parseQueryInt } from "@/lib/chatgpt-route-helpers.server";
import { listScansForUser } from "@/lib/chatgpt-actions.server";

export const Route = createFileRoute("/api/public/chatgpt/scans")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authenticateRequest(request);
        if (auth instanceof Response) return auth;
        const url = new URL(request.url);
        const limit = parseQueryInt(url.searchParams.get("limit"), 10, 1, 50);
        const result = await listScansForUser(auth.userId, { limit });
        return jsonResponse(result);
      },
    },
  },
});
