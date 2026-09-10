# Fix: OAuth consent page unreachable on chameleonaire.me

## What's wrong

The consent link bounces forever between two addresses, so the browser gives up and reports it can't connect:

1. The consent page (`src/routes/[.]lovable.oauth.consent.tsx`) contains a leftover rule: if you're on `chameleonaire.me`, it force-redirects you to `chameleonaire.lovable.app` (added earlier to fix an "unauthorized request origin" error).
2. But the published site now treats `chameleonaire.me` as the primary address — `chameleonaire.lovable.app` automatically redirects back to `chameleonaire.me` (confirmed: it answers with a 302 redirect to the custom domain).

Result: `chameleonaire.me` → `chameleonaire.lovable.app` → `chameleonaire.me` → … an endless loop, so the ChatGPT/MCP sign-in can never finish.

## The fix

1. **Remove the forced redirect** from the consent page so it simply runs on whatever address you opened it on (`chameleonaire.me`). Delete the `CANONICAL_ORIGIN` constant and the redirect block in `beforeLoad`.
2. **Re-point the sign-in server at the custom domain** by re-running the OAuth server configuration tool, so `chameleonaire.me` is the accepted origin for consent requests (this is what caused the original "unauthorized request origin" error the redirect was papering over).
3. **Verify end to end**: load your exact consent URL, confirm the "Connect …" approval screen renders (or redirects to sign-in and returns after login), approve, and confirm the redirect back to the client succeeds. Also spot-check that `/mcp` and the ChatGPT OpenAPI page still work.
4. **Publish** so the fix is live on `chameleonaire.me`.

## Technical details

- Edit: `src/routes/[.]lovable.oauth.consent.tsx` — remove lines 29–49 (`CANONICAL_ORIGIN` + hostname redirect in `beforeLoad`); keep the missing-`authorization_id` check and the session redirect to `/auth?next=…` unchanged.
- Tool: `supabase--configure_oauth_server` (no params) — re-stores the standard consent path `/.lovable/oauth/consent` and activates the provider using the project's canonical URL, which is now the custom domain.
- Verify: Playwright against `https://chameleonaire.me/.lovable/oauth/consent?authorization_id=<fresh id>`; check no redirect loop, consent card or auth redirect renders; `curl -I` both domains to confirm no ping-pong; confirm build OK.
