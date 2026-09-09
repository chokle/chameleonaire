import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticateRequest, jsonResponse } from "@/lib/chatgpt-route-helpers.server";
import { spawnChannelForUser } from "@/lib/chatgpt-actions.server";

const Body = z.object({
  name: z.string().trim().min(1).max(120),
  blueprint_id: z.string().uuid().nullable().optional(),
  brand_id: z.string().uuid().nullable().optional(),
  divergence: z.number().int().min(0).max(100).optional(),
  uploads_per_week: z.number().int().min(1).max(21).optional(),
  auto_publish: z.boolean().optional(),
});

export const Route = createFileRoute("/api/public/chatgpt/spawn-channel")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await authenticateRequest(request);
        if (auth instanceof Response) return auth;
        let parsed;
        try {
          parsed = Body.parse(await request.json());
        } catch {
          return jsonResponse({ error: "Body must include a channel name." }, 400);
        }
        try {
          return jsonResponse(await spawnChannelForUser(auth.userId, parsed));
        } catch (err) {
          return jsonResponse({ error: err instanceof Error ? err.message : "Could not spawn channel." }, 400);
        }
      },
    },
  },
});
