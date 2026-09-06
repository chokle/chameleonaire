# Unblock YouTube OAuth and prepare production verification

## Confirmed diagnosis
The screenshot shows `Error 403: access_denied` because the Google OAuth app is in **Testing** and the selected Google account is not an approved tester. The callback mismatch is no longer the blocker.

## Plan
1. **Restore access immediately**
   - In Google Cloud Console, open the OAuth consent screen’s **Audience** section.
   - Add the Google account shown in the error screen as a **Test user**.
   - Allow a few minutes for Google’s setting to propagate, then retry **Connect YouTube** in a normal browser window.

2. **Verify the complete channel connection**
   - Confirm Google receives the registered callback exactly as `https://chameleonaire.lovable.app/api/public/youtube/callback`.
   - Approve the YouTube read and upload permissions using the account that owns the intended YouTube channel.
   - Confirm the callback succeeds and the Main Channel changes from **Not connected** to **Connected** with the real channel name.
   - If Google returns another denial, capture and surface its exact error category rather than a generic 403.

3. **Prepare broad production access**
   - Change the Google OAuth app audience from **Testing** to **In production** when its branding, authorized domain, privacy policy, terms, and support contact are ready.
   - Submit Google verification for the sensitive YouTube permissions (`youtube.readonly` and `youtube.upload`), including the required app explanation and demonstration video.
   - Keep the approved test user in place so channel publishing can be tested while Google reviews the app.

4. **Validate before generating**
   - Verify token storage and refresh behavior without exposing credentials.
   - Do not generate or publish until the channel is connected and a blueprint reaches the existing 95% confidence threshold.

## External configuration boundary
Adding the test user and submitting OAuth verification must be completed in Google Cloud Console; app code cannot bypass Google’s tester restriction or verification review. The test-user route should unblock this specific account immediately, while production verification enables access for other Google accounts later.
