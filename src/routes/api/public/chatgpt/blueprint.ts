import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticateRequest, jsonResponse } from "@/lib/chatgpt-route-helpers.server";
import { extractBlueprintForUser } from "@/lib/chatgpt-actions.server";

const Body = z.object({
  creator_ids: z.array(z.string().uuid()).min(1).max(8),
  name: z.string().trim().min(1).max(120).optional(),
});

export const Route = createFileRoute("/api/public/chatgpt/blueprint")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await authenticateRequest(request);
        if (auth instanceof Response) return auth;
        let parsed;
        try {
          parsed = Body.parse(await request.json());
        } catch {
          return jsonResponse({ error: "Body must be { creator_ids: uuid[], name?: string }." }, 400);
        }
        try {
          return jsonResponse(await extractBlueprintForUser(auth.userId, parsed.creator_ids, parsed.name));
        } catch (err) {
          return jsonResponse({ error: err instanceof Error ? err.message : "Extraction failed." }, 400);
        }
      },
    },
  },
});
