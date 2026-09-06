# Resolve the remaining YouTube 403

## Goal
Make **Connect YouTube** complete successfully for the Main Channel, or surface the exact Google account/configuration action required instead of a generic 403.

## Plan
1. Reproduce the connection from the authenticated channel page and capture the final Google authorization URL, response parameters, and visible error state without exposing credentials.
2. Confirm the outgoing request uses the exact registered callback:
   `https://chameleonaire.lovable.app/api/public/youtube/callback`
3. Separate the remaining failure into the verified category:
   - OAuth app test-user / publishing-status restriction
   - Google Workspace or supervised-account restriction
   - YouTube channel/Brand Account permission restriction
   - App-side callback or token-exchange failure
4. Fix any app-side issue found in the authorization request or callback handling. Improve the callback/error presentation so Google denial codes produce a specific next step rather than a generic failure.
5. Validate the complete path: click **Connect YouTube**, approve access, return through the live callback, and confirm the Main Channel changes to **Connected** with its actual YouTube channel name.
6. Check the latest build and runtime signals. Do not attempt video generation until the separate 95% blueprint confidence requirement is met.

## External configuration boundary
If Google confirms this is an account eligibility, test-user, Workspace policy, or Brand Account permission restriction, the app cannot override it. I will identify the exact setting/account change needed and then immediately retest the flow after it is applied.

## Technical notes
- Keep OAuth secrets server-side and preserve CSRF state validation.
- Continue using the stable production callback for preview, published, and custom-domain entry points.
- Do not lower or bypass the 95% blueprint confidence gate.
