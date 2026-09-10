import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticateRequest, jsonResponse } from "@/lib/chatgpt-route-helpers.server";
import { setVideoVisibilityForUser } from "@/lib/chatgpt-actions.server";

const Body = z.object({
  video_id: z.string().uuid(),
  privacy: z.enum(["private", "unlisted", "public"]),
});

export const Route = createFileRoute("/api/public/chatgpt/visibility")({
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
            { error: "Body must be { video_id: uuid, privacy: private|unlisted|public }." },
            400,
          );
        }
        try {
          const result = await setVideoVisibilityForUser(auth.userId, parsed.video_id, parsed.privacy);
          return jsonResponse(result);
        } catch (err) {
          return jsonResponse({ error: err instanceof Error ? err.message : "Update failed." }, 400);
        }
      },
    },
  },
});
