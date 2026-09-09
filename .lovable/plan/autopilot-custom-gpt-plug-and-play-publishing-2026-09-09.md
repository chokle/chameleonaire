# Autopilot: Custom GPT + plug-and-play publishing

## Goal
Turn the platform from a set of expert tools into a one-button money machine, and give ChatGPT enough actions to run the whole loop — plan, generate, render, approve, publish — on its own.

## 1. New actions the GPT needs (server + OpenAPI)
Today the ChatGPT layer can read scans, creators, blueprints, channels, videos and the queue, and can approve/publish. To run autopilot it also needs:

- `POST /api/public/chatgpt/scan` — start a niche + profit-bracket scan, return the scan id.
- `POST /api/public/chatgpt/blueprint` — extract a blueprint from a creator, return confidence and whether it clears the 85% deploy gate.
- `POST /api/public/chatgpt/spawn-channel` — create a channel from a brand + blueprint.
- `POST /api/public/chatgpt/generate` — generate evergreen video concepts/scripts for a channel (count 1-6).
- `POST /api/public/chatgpt/render` — render a video at a duration target (30/45/60s) and report render progress.
- `POST /api/public/chatgpt/schedule` — put a rendered, approved video into the publish queue at a time.
- `GET  /api/public/chatgpt/next-actions` — the single most useful next step(s) for the account, as structured cards (same engine the app uses, see section 3).

All reuse existing server logic (scan, blueprint, chameleon, render, publish), keep bearer-key auth, membership check, Zod validation, and the evergreen-only rule. The OpenAPI schema at `/api/public/chatgpt/openapi.json` is extended to describe them with model-facing descriptions so the GPT chains them correctly.

## 2. Autopilot endpoint
- `POST /api/public/chatgpt/autopilot` — one call that runs the whole chain for a niche: scan → best creator → blueprint → channel (or reuse existing) → generate → render → approve → queue → publish. Returns a step-by-step report so ChatGPT can narrate progress. Long steps are recorded as jobs so a follow-up call can report status rather than time out.
- Guardrails: only evergreen concepts, only blueprints at or above the 85% gate, YouTube uploads stay private on first publish, and a per-run cap on how many videos it will push.

## 3. Recommendation engine (shared by app and GPT)
A single module scores the account state and emits ranked action cards, each with a title, why-it-matters line, expected earnings impact, and the action it triggers. Examples: "Run a finance scan", "Extract a blueprint from <creator>", "Blueprint at 86% — spawn a channel", "3 videos awaiting approval", "Connect YouTube", "Queue is empty — generate 3 evergreen videos". Cards are blueprint-aware, so suggestions always follow the winning formula for the linked blueprint.

## 4. Plug-and-play app screens
- **Start earning button** on the home screen: pick a niche and profit bracket, then it runs the same autopilot chain with live progress and no other decisions required.
- **Next-step checklist** on the home screen, always showing the one action that matters most plus the rest ranked below.
- **Suggestion lane → schedule board** (new `/studio` page): AI action cards on the left; drag a card into the "Do this" lane to run it. Below it a board with Draft, Approved, Scheduled, Published columns — drag a video between columns to approve it, schedule it, or publish it now. Uses `@dnd-kit` with tap-friendly targets for mobile, plus button fallbacks on every card so nothing depends on dragging.
- Existing expert pages (scanner, blueprints, channels, queue) stay, but move behind an "Advanced" grouping in the navigation.

## 5. Paste-ready Custom GPT setup
A new section on `/integrations/chatgpt` with copy buttons for: GPT name, description, full instructions (how to chain the actions, when to ask before publishing, the evergreen rule, the 85% gate), four conversation starters, the schema URL, and the auth setup (API Key, header `Authorization`, prefix `Bearer`).

## Technical notes
- New routes under `src/routes/api/public/chatgpt/`, new logic in `src/lib/chatgpt-actions.server.ts`, recommendations in a new `src/lib/recommendations.ts` (+ `.server.ts` for data), consumed by both the app and the actions layer.
- Long-running work (render, autopilot) writes progress to existing `render_jobs` / queue fields so status can be polled instead of blocking.
- Drag and drop via `@dnd-kit/core` + `@dnd-kit/sortable`.
- Verification: typecheck and build clean, every new endpoint returns 401 without a key and 200 with one, and a browser pass over the new home flow and board.
