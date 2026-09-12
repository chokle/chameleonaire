# Support multiple YouTube channels under one Google account

## Goal
Let you connect a second (or third) YouTube channel to a different spawned app channel, even when all YouTube channels live under the same Google account (`ex.itliquidity87@gmail.com`).

## Current gap
The OAuth callback calls `channels?part=snippet&mine=true` and blindly stores `items[0]`. If your Google account has more than one YouTube channel, the app always picks the first one and never lets you choose another.

## What we'll build

1. **OAuth callback discovers every available YouTube channel**
   - Change `completeConsent` in `src/lib/youtube-oauth.server.ts` to fetch all `mine=true` items, not just the first.
   - If exactly one channel is returned, keep today's auto-connect behavior.
   - If multiple channels are returned, store the list temporarily and redirect the popup to a picker page instead of completing immediately.

2. **Channel picker page**
   - New route `/channels/$id/connect-youtube` (or reuse the existing channel detail page with a picker modal).
   - Reads the temporary OAuth result, shows each YouTube channel's title and thumbnail, and lets the user pick which one to link to the spawned app channel.
   - On selection, stores the chosen `youtube_channel_id` + `youtube_title` in `youtube_accounts` and `channels`, then closes the popup and refreshes the parent.

3. **Reconnect to a different YouTube channel**
   - Update the channel detail page so "Disconnect" clears the current link and "Connect YouTube" starts a fresh OAuth flow, which will again show the picker if multiple channels exist.

4. **Guard against duplicate YouTube links**
   - Before saving a selected YouTube channel, check whether another app channel already uses the same `youtube_channel_id` under the same owner.
   - If it does, warn the user and ask them to pick a different YouTube channel or disconnect the other app channel first.

5. **Verify and publish**
   - Run typecheck and production build.
   - Publish so the new picker flow is live.
   - Walk through connecting your second YouTube channel end to end.

## Outcome
You can spawn "Outsourced Empire 2" (or any new channel), connect it to a different YouTube channel under the same Google account, and publish videos to it independently of the first one.
