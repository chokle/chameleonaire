import { createFileRoute } from "@tanstack/react-router";

/**
 * One-way sync of the worker secret from env into the private cron_config
 * table so the database-side scheduler can authenticate its calls.
 * Never returns the value; safe to expose.
 */
export const Route = createFileRoute("/api/public/hooks/sync-cron-secret")({
  server: {
    handlers: {
      POST: async () => {
        const secret = process.env["PUBLISH_CRON_SECRET"];
        if (!secret) {
          return Response.json({ ok: false, reason: "no secret configured" }, { status: 500 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin
          .from("cron_config")
          .upsert({ key: "publish_tick_secret", value: secret }, { onConflict: "key" });
        if (error) return Response.json({ ok: false, reason: error.message }, { status: 500 });
        return Response.json({ ok: true });
      },
    },
  },
});
