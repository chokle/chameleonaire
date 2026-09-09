import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticateRequest, jsonResponse } from "@/lib/chatgpt-route-helpers.server";
import { scheduleVideoForUser } from "@/lib/chatgpt-actions.server";

const Body = z.object({
  video_id: z.string().uuid(),
  scheduled_for: z.string().datetime().optional(),
});

export const Route = createFileRoute("/api/public/chatgpt/schedule")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await authenticateRequest(request);
        if (auth instanceof Response) return auth;
        let parsed;
        try {
          parsed = Body.parse(await request.json());
        } catch {
          return jsonResponse({ error: "Body must be { video_id: uuid, scheduled_for?: ISO date }." }, 400);
        }
        try {
          return jsonResponse(
            await scheduleVideoForUser(auth.userId, parsed.video_id, parsed.scheduled_for ?? null),
          );
        } catch (err) {
          return jsonResponse({ error: err instanceof Error ? err.message : "Scheduling failed." }, 400);
        }
      },
    },
  },
});
