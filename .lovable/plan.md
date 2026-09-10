# Per-channel ownership + video template page

Two changes: channels become private to the person who created them, and a new page lets you write a script and pick visuals before a video is scheduled.

## 1. Private channels

Today every signed-in member sees every channel, every generated video, every queue item. After this change:

- Each channel has an owner. Loop Funds and your other channels get assigned to you.
- A signed-in person only sees, edits, connects, generates for, schedules and publishes channels they own.
- Everything hanging off a channel — generated videos, the publish queue, performance stats, the YouTube connection — follows the same rule.
- Shared research data (scans, creators, blueprints, brands) stays visible to all members, since that is the discovery layer and nothing there is channel-specific.
- The Studio board, channel list, queue, performance page, ChatGPT actions and the agent connection all return only your channels.

## 2. Video template page

A new **Templates** page (`/templates`) where you build a video before it goes anywhere near the schedule:

- Name the template, write the title, hook and full script (with a live word/estimated-length readout so the script matches the target duration).
- Choose visuals: visual style, colour palette, pacing, shot direction notes, and a thumbnail prompt.
- Pick target duration (30 / 45 / 60 / 90 seconds).
- Optionally start from a blueprint or brand so the tone and structure match a proven pattern.
- Save, edit, duplicate and delete templates. They are private to you.
- "Create video" turns a template into a draft video on a channel you own — it lands in the Studio board's Draft column, ready to render, approve and schedule with the flow that already exists.
- Evergreen-only rule still applies: templates warn if the script mentions dated or trending topics.

## Technical notes

- Migration: `channels.owner_id uuid` (defaults to the creating user, backfilled to your account), plus a `owns_channel(uuid)` security-definer helper. RLS on `channels`, `generated_videos`, `publish_queue`, `performance_snapshots` switches from `is_member()` to owner-scoped checks; `youtube_accounts` / `oauth_states` stay service-role only.
- New table `video_templates` (owner_id, name, title, hook, script, visual_style, palette, pacing, shot_notes, thumbnail_prompt, duration_target, blueprint_id, brand_id) with owner-scoped RLS and GRANTs.
- Every service-role server path that touches channels is filtered by owner: `console.functions.ts`, `chameleon.server.ts`, `publish.server.ts`, `auto-schedule.server.ts`, `autopilot.server.ts`, `chatgpt-actions.server.ts`, `mcp/tools/list-channels.ts`, `youtube-oauth.server.ts`.
- The publish worker and cron tick keep running service-role wide (they act for all owners); only user-facing reads and writes are scoped.
- New route `src/routes/templates.tsx` plus `src/lib/templates.functions.ts` (authenticated create/update/delete/instantiate) and query options in `src/lib/queries.ts`.
