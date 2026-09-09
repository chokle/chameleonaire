import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticateRequest, jsonResponse } from "@/lib/chatgpt-route-helpers.server";
import { setVideoApprovalForUser } from "@/lib/chatgpt-actions.server";

const Body = z.object({ video_id: z.string().uuid(), approved: z.boolean().default(true) });

export const Route = createFileRoute("/api/public/chatgpt/approve")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await authenticateRequest(request);
        if (auth instanceof Response) return auth;
        let parsed;
        try {
          parsed = Body.parse(await request.json());
        } catch {
          return jsonResponse({ error: "Body must be { video_id: uuid, approved?: boolean }." }, 400);
        }
        try {
          return jsonResponse(await setVideoApprovalForUser(auth.userId, parsed.video_id, parsed.approved));
        } catch (err) {
          return jsonResponse({ error: err instanceof Error ? err.message : "Failed to update approval." }, 400);
        }
      },
    },
  },
});
