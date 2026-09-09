# Roadmap

## Open
- [ ] Channel funnel page: views/likes/subscribers needed to earn money, links to /calculator
- [ ] Full channel page: videos, views and earnings per channel
- [ ] ChatGPT OAuth plugin flow (if user wants OAuth instead of API-key Actions)

## Performance tracking (done 2026-09-09)
- [x] /performance page: per-video views, likes, watch time, estimated revenue + blueprint leaderboard
- [x] performance_snapshots extended (likes, comments, watch_time_minutes, youtube_video_id)
- [x] getPerformance ChatGPT action
- [x] Live run: finance blueprint (86%) -> 2 evergreen videos -> 36s render -> published https://youtube.com/watch?v=ZA-kAROx4PE

## Done
- [x] Agent integrations (MCP): OAuth-protected MCP server at `/mcp` with read-only tools
- [x] ChatGPT Custom GPT Actions: API-key auth, OpenAPI schema, key management UI, read-only endpoints
- [x] 30+ second video render pipeline: base 8s + 7s Veo extensions, target selector (30/45/60s), persisted render_jobs
- [x] Second evergreen video rendered (36s) and published to YouTube: https://youtube.com/watch?v=8m_dZD2lKLg
- [x] YouTube OAuth connected (channel "Dee"), finance scan, blueprint extraction, first evergreen video published: https://youtube.com/watch?v=CRs5Kd8airA
- [x] Deploy gate lowered 95% → 85% (public metadata can't supply private retention/CTR)
- [x] Google Search Console connected, verified, sitemap submitted
- [x] Scanner returns real YouTube channel stats with proxy signals
- [x] Stale-chunk auto-recovery for deploys
- [x] SEO fixes: sitemap, unique metadata/social previews on detail pages, headings & labels
- [x] Security findings locked down

## Autopilot + Custom GPT (done 2026-09-09)
- [x] OpenAPI actions: next-actions, scan, blueprint, spawn-channel, generate, render, schedule, autopilot
- [x] Studio board with drag-and-drop recommendations and Draft/Approved/Scheduled/Published columns
- [x] Start earning one-button flow + persistent next steps on home
- [x] Paste-ready Custom GPT name/description/instructions/starters on /integrations/chatgpt
- [x] Publish the site so ChatGPT can load the updated schema
