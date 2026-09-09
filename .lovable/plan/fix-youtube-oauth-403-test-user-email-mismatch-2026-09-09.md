# Fix YouTube OAuth 403: test-user email mismatch

## Root cause

The Google OAuth consent screen blocks sign-in with `Error 403: access_denied` because the app is in Testing mode and the signing-in account is not an approved test user. Comparing the two screenshots:

- Blocked account: `ex.tliquidity87@gmail.com`
- Test user added in Google Cloud Console: `ex.itliquidity87@gmail.com` (extra "i")

Google treats these as different accounts, so the real account is still unapproved.

## Steps

1. Confirm the exact account email used in the OAuth attempt (from the 403 screen / Google account chooser) so there is no second typo.
2. User action in Google Cloud Console → Google Auth Platform → Audience → Test users:
   - Add the exact email from step 1 (`ex.tliquidity87@gmail.com` if that is the real account).
   - Optionally remove the misspelled entry `ex.itliquidity87@gmail.com`.
   - Save and wait 5–10 minutes for propagation.
3. Retry "Connect YouTube" from the channel page in the app (in a normal browser tab, not an embedded preview, if the popup is blocked).
4. On the consent screen, if an "unverified app" warning appears, use Advanced → Continue to proceed (expected for testing-mode apps).
5. Verify in the app that the channel shows as connected and the YouTube token is stored.

## Notes

- No app code changes are needed — the OAuth flow, callback URL, and consent handling are already verified working.
- Longer term, publishing the OAuth app to production (Google verification for `youtube.readonly` and `youtube.upload`) removes the test-user requirement entirely.
