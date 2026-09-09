import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticateRequest, jsonResponse } from "@/lib/chatgpt-route-helpers.server";
import { autopilotForUser } from "@/lib/chatgpt-actions.server";

const Body = z.object({
  niche: z.string().trim().min(2).max(80),
  min: z.number().min(0).optional(),
  max: z.number().nullable().optional(),
  channel_name: z.string().trim().max(120).optional(),
  video_count: z.number().int().min(1).max(6).optional(),
  duration_target: z.number().int().min(8).max(120).optional(),
  mode: z.enum(["plan", "full"]).optional(),
});

export const Route = createFileRoute("/api/public/chatgpt/autopilot")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await authenticateRequest(request);
        if (auth instanceof Response) return auth;
        let parsed;
        try {
          parsed = Body.parse(await request.json());
        } catch {
          return jsonResponse({ error: "Body must include a niche. Optional: mode 'plan' or 'full'." }, 400);
        }
        try {
          return jsonResponse(await autopilotForUser(auth.userId, parsed));
        } catch (err) {
          return jsonResponse({ error: err instanceof Error ? err.message : "Autopilot failed." }, 400);
        }
      },
    },
  },
});
