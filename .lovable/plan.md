# Final wiring: secrets, worker schedule, live end-to-end run

The full pipeline is built — scanner, blueprint extractor, brands, channel spawner, Veo rendering, YouTube OAuth publishing, approval gate (queue approval already flips `generated_videos.approved`), and the publish worker. What remains is configuration and one live verification pass.

## Steps

1. **Request the three secrets** via a secure secrets form:
   - `YOUTUBE_API_KEY` — YouTube Data API v3 key (Google Cloud Console → APIs & Services → Credentials → Create API key, with "YouTube Data API v3" enabled). Powers the profit scanner and metadata reads.
   - `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` — from an OAuth 2.0 Web client (Google Cloud Console → Credentials → Create OAuth client ID). Authorized redirect URI: your app origin + `/api/public/youtube/callback` (the exact URL is shown on the channel connect card). The OAuth consent screen needs the `youtube.upload` and `youtube.readonly` scopes.
   - `LOVABLE_CRON_SECRET` — I'll generate this one automatically to protect the publish worker hook.

2. **Verify the pipeline live:**
   - Run a real profit scan on a niche + bracket using the API key and confirm real creator profiles land.
   - Extract one creator's blueprint end to end and check the confidence gate behaves.
   - Connect one channel via YouTube OAuth, generate a video, render it, approve it in the queue, and confirm it publishes to YouTube.

3. **Schedule the publish worker** — register the `/api/public/hooks/publish-tick` cron hook so the queue drains automatically (hourly), with its built-in pause-on-quota safety.

## Technical notes

- No code changes expected beyond small fixes uncovered during the live run — the approval gate link between queue and video rows is already in place.
- Secrets are stored encrypted by Lovable Cloud and read only inside server handlers; they never reach the browser bundle.
- YouTube upload quota: ~1,600 units per upload against a 10,000/day default, so roughly 6 uploads/day until you request a quota increase.
