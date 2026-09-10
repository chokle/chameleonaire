import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticateRequest, jsonResponse } from "@/lib/chatgpt-route-helpers.server";
import { publishQueueItemForUser } from "@/lib/chatgpt-actions.server";

const Body = z.object({
  queue_id: z.string().uuid(),
  privacy: z.enum(["private", "unlisted", "public"]).default("private"),
});

export const Route = createFileRoute("/api/public/chatgpt/publish")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await authenticateRequest(request);
        if (auth instanceof Response) return auth;
        let parsed;
        try {
          parsed = Body.parse(await request.json());
        } catch {
          return jsonResponse(
            { error: "Body must be { queue_id: uuid, privacy?: private|unlisted|public }." },
            400,
          );
        }
        try {
          const result = await publishQueueItemForUser(auth.userId, parsed.queue_id, parsed.privacy);
          return jsonResponse(result);
        } catch (err) {
          return jsonResponse({ error: err instanceof Error ? err.message : "Publish failed." }, 400);
        }
      },
    },
  },
});
