import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticateRequest, jsonResponse } from "@/lib/chatgpt-route-helpers.server";
import { runScanForUser } from "@/lib/chatgpt-actions.server";

const Body = z.object({
  niche: z.string().trim().min(2).max(80),
  min: z.number().min(0).optional(),
  max: z.number().nullable().optional(),
  count: z.number().int().min(3).max(24).optional(),
});

export const Route = createFileRoute("/api/public/chatgpt/scan")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await authenticateRequest(request);
        if (auth instanceof Response) return auth;
        let parsed;
        try {
          parsed = Body.parse(await request.json());
        } catch {
          return jsonResponse({ error: "Body must include a niche, plus optional min, max and count." }, 400);
        }
        try {
          return jsonResponse(await runScanForUser(auth.userId, parsed));
        } catch (err) {
          return jsonResponse({ error: err instanceof Error ? err.message : "Scan failed." }, 400);
        }
      },
    },
  },
});
