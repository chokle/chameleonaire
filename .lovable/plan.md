# Make generated videos at least 30 seconds long

## Problem
The current renderer produces a single 8-second clip using `google/veo-3.1-lite`. The first published video was only 8 seconds. You need generated videos to be at least 30 seconds.

## Goal
Extend the render pipeline so every generated video reaches a configurable minimum duration (default 30 seconds), while keeping evergreen-only content and explicit user-initiated rendering.

## Plan

1. **Switch render strategy to chained extensions**
   - Replace the single 8-second `veo-3.1-lite` job with an initial generation plus repeated 7-second extension hops until the target duration is met.
   - Target: 30 seconds = one 8-second base clip + four 7-second extensions (36 seconds total). Round down the stored duration to the actual merged length.
   - Keep 1080p / 16:9 / audio on for all hops.

2. **Update `src/lib/render.server.ts`**
   - Add `startJob(prompt)` and `extendJob(videoBytes, prompt)` helpers.
   - Each extension re-uploads the previous merged MP4 as inline base64 bytes and asks the model to continue the same scene.
   - Poll each job with the existing 8-second interval and 5-minute budget, but allow the whole chain up to ~20 minutes.
   - Persist a `render_jobs` array (job IDs + statuses) on `generated_videos` so progress survives and can be shown in the UI.
   - Download the final merged MP4 and upload it to the private `renders` bucket, replacing the single-clip path.

3. **Update data model**
   - Add `duration_target` integer column to `generated_videos` (default 30).
   - Add `render_jobs` JSONB column to track each hop.
   - Update `duration_seconds` to store the real final length.

4. **Update generation prompt logic**
   - In `shotPrompt`, request a single continuous opening scene that can be naturally extended.
   - For extension prompts, use a continuation template: "The scene continues seamlessly from the previous shot..." plus the same concept/hook/palette constraints.

5. **Update UI in `src/routes/channels.$id.tsx`**
   - Add a duration target selector (30 / 45 / 60 seconds) before rendering.
   - Show render progress as "Clip 1 of N" during the chain.
   - Disable render button while any hop is in progress.

6. **Update publish flow**
   - Ensure `publish.server.ts` downloads and uploads the final merged file; no changes needed if it already reads `video.video_url`.

7. **Test end to end**
   - Render one approved evergreen finance video at 30 seconds.
   - Verify the stored file length and that it publishes to YouTube.

## Trade-offs
- Cost: a 30-second video uses roughly 4x the AI credits of an 8-second video.
- Time: rendering will take 4-8 minutes instead of 1-2 minutes.
- Extension quality depends on the model continuing the same visual style; the prompt will be tuned to keep the scene consistent.
