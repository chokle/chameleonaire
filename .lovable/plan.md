# Repurpose your own content + blueprint figures in every cold open

## 1. New page: Repurpose (paste your own short-form content)

A new page at `/repurpose`, added to the side drawer menu.

What you do on it:
- Paste anything you already made — a short's script, a caption, a voiceover transcript, rough notes.
- Pick the channel it's for, and optionally the blueprint to follow.
- Pick a target length (30 / 45 / 60 seconds).
- Press **Rewrite as a short** — you get a title, a cold open (first 8 seconds, spoken verbatim), the full script, description and tags, plus two alternate cold opens to tap between.
- Edit any of it inline, then press **Add to queue**.

The queued video behaves exactly like every other one: it lands awaiting approval, and approving it publishes to that channel's YouTube.

Everything generated stays evergreen (no dates, news or trends) and stays on the channel's brand voice.

## 2. Blueprint figures auto-fill into the cold open

Each blueprint is modelled on real channels whose earning figures we already store. Those figures become the numbers the script is allowed to use, so the video text matches what the channel claims rather than inventing a different amount.

- When a blueprint is selected (on the Repurpose page, and on the existing Templates page's "Generate cold open"), we pull the blueprint's source-channel figures: modelled profit per video, average views, subscriber scale, plus any signature numbers already recorded in the blueprint strategy.
- Those figures are rounded to clean, claimable numbers and passed to the writer as the only numbers it may state.
- The page shows the figures it will use as small chips above the cold open, so you can see them before generating.
- With no blueprint chosen, behaviour is unchanged.

## Technical notes

- `src/lib/repurpose.server.ts` — `rewriteAsShort({ source, brand, channelName, durationTarget, figures })` via the existing `callAI` / `parseJSON` helpers; returns title, hook, script, description, tags, thumbnail_prompt, concept.
- `src/lib/repurpose.functions.ts` — auth-gated `rewriteOwnContent` (channel ownership checked) and `queueRewrittenShort`, which inserts into `generated_videos` (`status: "ready"`, `approved: false`) and `publish_queue` (`awaiting_approval`), mirroring `clips.functions.ts`.
- `src/lib/blueprint-figures.server.ts` — `figuresForBlueprint(supabase, blueprintId)` reads `blueprints.source_creator_ids` → `creators` (`est_profit_per_video`, `avg_views`, `subscribers`) plus numbers found in `strategy`, returns a rounded, de-duplicated list.
- `generateColdOpen` in `src/lib/templates.functions.ts` gains an optional `blueprintId` and injects the same figures into the prompt.
- `src/routes/repurpose.tsx` for the page; menu entry in `src/components/AppShell.tsx`; route `head()` with its own title/description and `noindex`.
- No database migration needed.
