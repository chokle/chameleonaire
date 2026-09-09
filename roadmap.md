# Roadmap

## Open
- [ ] Channel funnel page: views/likes/subscribers needed to earn money, links to /calculator
- [ ] Full channel page: videos, views and earnings per channel
- [ ] ChatGPT OAuth plugin flow (if user wants OAuth instead of API-key Actions)

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
