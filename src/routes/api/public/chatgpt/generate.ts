import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticateRequest, jsonResponse } from "@/lib/chatgpt-route-helpers.server";
import { generateVideosForUser } from "@/lib/chatgpt-actions.server";

const Body = z.object({
  channel_id: z.string().uuid(),
  count: z.number().int().min(1).max(6).optional(),
});

export const Route = createFileRoute("/api/public/chatgpt/generate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await authenticateRequest(request);
        if (auth instanceof Response) return auth;
        let parsed;
        try {
          parsed = Body.parse(await request.json());
        } catch {
          return jsonResponse({ error: "Body must be { channel_id: uuid, count?: 1-6 }." }, 400);
        }
        try {
          return jsonResponse(await generateVideosForUser(auth.userId, parsed.channel_id, parsed.count ?? 3));
        } catch (err) {
          return jsonResponse({ error: err instanceof Error ? err.message : "Generation failed." }, 400);
        }
      },
    },
  },
});
