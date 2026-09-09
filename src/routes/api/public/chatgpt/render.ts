import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticateRequest, jsonResponse } from "@/lib/chatgpt-route-helpers.server";
import { renderVideoForUser } from "@/lib/chatgpt-actions.server";

const Body = z.object({
  video_id: z.string().uuid(),
  duration_target: z.number().int().min(8).max(120).optional(),
});

export const Route = createFileRoute("/api/public/chatgpt/render")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await authenticateRequest(request);
        if (auth instanceof Response) return auth;
        let parsed;
        try {
          parsed = Body.parse(await request.json());
        } catch {
          return jsonResponse({ error: "Body must be { video_id: uuid, duration_target?: 8-120 }." }, 400);
        }
        try {
          return jsonResponse(
            await renderVideoForUser(auth.userId, parsed.video_id, parsed.duration_target ?? 30),
          );
        } catch (err) {
          return jsonResponse({ error: err instanceof Error ? err.message : "Render failed." }, 400);
        }
      },
    },
  },
});
