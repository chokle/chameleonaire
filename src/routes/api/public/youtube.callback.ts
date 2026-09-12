import { createFileRoute } from "@tanstack/react-router";

function page(title: string, body: string, ok: boolean) {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{background:#0b0d0c;color:#e8f2ec;font:16px/1.6 system-ui,sans-serif;display:grid;place-items:center;height:100vh;margin:0}
.card{max-width:420px;padding:32px;border:1px solid #21302a;border-radius:16px;text-align:center}
h1{font-size:20px;margin:0 0 8px;color:${ok ? "#6ee7a8" : "#ff8f8f"}}
a{color:#8ef;display:inline-block;margin-top:16px}</style></head>
<body><div class="card"><h1>${title}</h1><p>${body}</p><a href="/channels">Back to channels</a></div></body></html>`,
    { status: ok ? 200 : 400, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

function googleErrorMessage(error: string, description: string | null): string {
  if (error === "access_denied") {
    return "Google denied access. If the OAuth app is still in Testing, add this Google account under OAuth Audience → Test users, then try again.";
  }
  if (error === "redirect_uri_mismatch") {
    return "Google rejected the callback address. The authorized redirect URI must exactly match the app’s published YouTube callback.";
  }
  return description ? `Google returned: ${error} — ${description}` : `Google returned: ${error}`;
}

export const Route = createFileRoute("/api/public/youtube/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const error = url.searchParams.get("error");
        const errorDescription = url.searchParams.get("error_description");
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");

        if (error) return page("Connection blocked", googleErrorMessage(error, errorDescription), false);
        if (!code || !state) return page("Invalid callback", "Missing authorization code.", false);

        try {
          const { completeConsent } = await import("@/lib/youtube-oauth.server");
          const result = await completeConsent(code, state);
          if ("picker" in result) {
            // Multiple YouTube channels under this Google account: redirect to the picker.
            return Response.redirect(`${url.origin}/youtube-picker?state=${encodeURIComponent(result.state)}`, 302);
          }
          return page("YouTube connected", `Uploads will go to “${result.title}”.`, true);
        } catch (e) {
          const message = e instanceof Error ? e.message : "Unknown error";
          return page("Could not connect", message, false);
        }
      },
    },
  },
});
