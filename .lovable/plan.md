# chamele-on-air

A YouTube profit-intelligence engine: find creators by earnings bracket, reverse-engineer what makes them win, score the confidence of that pattern, and spawn branded channels that publish adapted videos on the winning formula — continuously.

## How it gets the data

The engine runs on **public metadata intelligence** — the same class of signal the commercial creator-analytics platforms use. Nothing private, nothing that breaks when a source gets pulled:

- Public YouTube signals: views, upload cadence, titles, thumbnails, descriptions, tags, durations, engagement, view velocity.
- Earnings modeling layered on top: views x niche RPM band x sponsor-slot uplift, producing a profit-per-video estimate with a range.
- A dataset import lane: any creator or earnings dataset you already have (CSV/JSON) drops in and is treated as a first-class source alongside the live scan, blended into the same brackets.

Brackets are real and usable. They're modeled estimates with a confidence range rather than invented precision — which is exactly what every platform in this space is actually reporting.


## What gets built

### 1. Profit scanner
- Pick a niche and a profit-per-video bracket (e.g. $500-2k, $2k-10k, $10k+).
- Engine pulls channels/videos in that niche, computes estimated profit per video (views x niche RPM band x sponsor-slot uplift), and filters to the bracket.
- Ranked results table: channel, est. profit/video, est. monthly, upload cadence, view velocity, consistency score.
- Sources: YouTube Data API (you supply a key) plus any imported dataset.

### 2. Blueprint extractor
- Select one or many creators, run extraction.
- AI digests their catalog into a structured blueprint: hook pattern, title formula, thumbnail grammar (composition, color, face/no-face, text length), pacing and retention structure, script skeleton, upload cadence, topic ladder, monetization mix.
- Every field carries evidence (which videos support it) and a per-field confidence.
- An overall confidence score. Below 95%, the blueprint is marked "not deployable" and the engine tells you exactly what data would raise it (more videos, longer history, tighter niche).

### 3. Chameleonizer
- Takes an approved blueprint plus your brand profile (name, voice, palette, subject) and produces a near-identical structural clone where only the surface metadata differs: your topics, your angles, your wording, your thumbnails.
- Divergence dial: how far each output drifts from the source formula.
- Guardrails: no copying of source scripts, titles verbatim, thumbnails, or likenesses. Structure is copied; content is original.

### 4. Channel spawner + auto-deploy
- Create multiple virtual channels, each bound to a blueprint plus a brand identity.
- Per channel: generate video concepts, scripts, titles, descriptions, tags, and thumbnails; render short-form video from generated clips and voiceover; queue with a publish schedule matching the blueprint's cadence.
- Publishing runs through YouTube OAuth per channel. Channels you haven't connected yet stay in "ready to publish" state with everything rendered and downloadable.
- Manual approval gate on by default; flip to fully automatic per channel.

### 5. The forever loop
- After each publish, the engine pulls back that video's performance.
- Winners raise the weight of their blueprint variants; losers lower it.
- Scheduled re-scan re-runs the profit scanner on the niche, catches newly emerging winners, and refreshes blueprints as formulas drift.
- Dashboard: per-channel earnings estimate, per-blueprint win rate, evolution timeline of what the engine has learned.

## Build order

1. Cloud database, design system, shell and dashboard.
2. Profit scanner with bracket filtering + dataset import (seeded with sample data so the flow is visible immediately).
3. Blueprint extractor with evidence and the 95% confidence gate.
4. Chameleonizer + brand profiles.
5. Channel spawner, generation queue, script/thumbnail output, render pipeline.
6. YouTube OAuth publishing + scheduler.
7. Feedback loop, re-scan job, evolution dashboard.

Steps 1-4 land first as a working product; 5-7 follow.

## Technical notes

- Lovable Cloud for the database. No login for now — one personal workspace; auth is a later drop-in.
- Tables: `creators`, `creator_videos`, `scans`, `blueprints` (JSONB fields + confidence), `brands`, `channels`, `generated_videos`, `publish_queue`, `performance_snapshots`, `imported_datasets`.
- All AI work runs server-side through Lovable AI (Gemini for extraction and generation, image model for thumbnails, Veo for clips). Long extractions stream so they don't get cut off.
- YouTube Data API key and YouTube OAuth credentials are stored as secrets when we reach those steps — I'll walk you through obtaining them at that point, not before.
- Rendering and publishing run as background jobs with retry, so a long batch doesn't block the UI.

## Open item for later

Auto-publishing at scale across many channels can trip YouTube's spam and authenticity policies. I'll build the approval gate and per-channel rate limits in by default so the system stays inside platform rules; we can loosen it per channel once you see the output quality.
