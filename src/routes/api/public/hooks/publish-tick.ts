import { createFileRoute } from "@tanstack/react-router";

/** Scheduled drain of the publish queue. Called by the Cloud scheduler. */
export const Route = createFileRoute("/api/public/hooks/publish-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["LOVABLE_CRON_SECRET"];
        const provided =
          request.headers.get("x-cron-secret") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
          "";
        if (!secret || provided !== secret) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }

        try {
          const { publishTick } = await import("@/lib/publish.server");
          const result = await publishTick();
          return Response.json(result);
        } catch (e) {
          const message = e instanceof Error ? e.message : "tick failed";
          return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});
