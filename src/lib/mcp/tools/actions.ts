import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import type { ToolContext } from "@lovable.dev/mcp-js";

/** Shared result helpers so every write tool reports consistently. */
function ok(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload as Record<string, unknown>,
  };
}

function fail(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

async function withUser<T>(ctx: ToolContext, fn: (userId: string) => Promise<T>) {
  if (!ctx.isAuthenticated()) return fail("Not authenticated");
  const userId = ctx.getUserId();
  if (!userId) return fail("Not authenticated");
  try {
    return ok((await fn(userId)) as unknown);
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
}

async function actions() {
  return import("@/lib/chatgpt-actions.server");
}

const nextActionsTool = defineTool({
  name: "next_actions",
  title: "Get recommended next actions",
  description:
    "Return the ranked next actions for the signed-in account (what to scan, generate, render, schedule or publish next).",
  inputSchema: {},
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: (_input, ctx) => withUser(ctx, async (userId) => (await actions()).nextActionsForUser(userId)),
});

const listVideosTool = defineTool({
  name: "list_videos",
  title: "List generated videos",
  description: "List generated videos for the signed-in account, optionally filtered to one channel.",
  inputSchema: {
    channel_id: z.string().uuid().optional().describe("Only videos for this channel."),
    limit: z.number().int().min(1).max(50).default(20),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: ({ channel_id, limit }, ctx) =>
    withUser(ctx, async (userId) =>
      (await actions()).listVideosForUser(userId, { ...(channel_id ? { channel_id } : {}), limit }),
    ),
});

const listQueueTool = defineTool({
  name: "list_queue",
  title: "List publish queue",
  description: "List publish queue entries (awaiting approval, scheduled, published) for the signed-in account.",
  inputSchema: {
    channel_id: z.string().uuid().optional(),
    limit: z.number().int().min(1).max(50).default(20),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: ({ channel_id, limit }, ctx) =>
    withUser(ctx, async (userId) =>
      (await actions()).listQueueForUser(userId, { ...(channel_id ? { channel_id } : {}), limit }),
    ),
});

const generateVideosTool = defineTool({
  name: "generate_videos",
  title: "Generate evergreen video concepts",
  description:
    "Generate 1-6 evergreen video concepts (title, hook, script, thumbnail brief) for one of your channels using its blueprint.",
  inputSchema: {
    channel_id: z.string().uuid().describe("Channel to generate for."),
    count: z.number().int().min(1).max(6).default(3),
  },
  annotations: { readOnlyHint: false, openWorldHint: false },
  handler: ({ channel_id, count }, ctx) =>
    withUser(ctx, async (userId) => (await actions()).generateVideosForUser(userId, channel_id, count)),
});

const renderVideoTool = defineTool({
  name: "render_video",
  title: "Render a generated video",
  description: "Render the actual video file for a generated concept. Duration is in seconds (8-120).",
  inputSchema: {
    video_id: z.string().uuid(),
    duration_target: z.number().int().min(8).max(120).default(30),
  },
  annotations: { readOnlyHint: false, openWorldHint: false },
  handler: ({ video_id, duration_target }, ctx) =>
    withUser(ctx, async (userId) => (await actions()).renderVideoForUser(userId, video_id, duration_target)),
});

const approveVideoTool = defineTool({
  name: "approve_video",
  title: "Approve or unapprove a video",
  description: "Mark a generated video approved (or remove approval). Approval alone does not schedule or publish.",
  inputSchema: { video_id: z.string().uuid(), approved: z.boolean().default(true) },
  annotations: { readOnlyHint: false, openWorldHint: false },
  handler: ({ video_id, approved }, ctx) =>
    withUser(ctx, async (userId) => (await actions()).setVideoApprovalForUser(userId, video_id, approved)),
});

const scheduleVideoTool = defineTool({
  name: "schedule_video",
  title: "Schedule a video for publishing",
  description:
    "Approve and schedule a rendered video for upload. Provide an ISO timestamp, or omit to schedule one hour from now.",
  inputSchema: {
    video_id: z.string().uuid(),
    scheduled_for: z.string().datetime().optional().describe("ISO 8601 UTC timestamp."),
  },
  annotations: { readOnlyHint: false, openWorldHint: false },
  handler: ({ video_id, scheduled_for }, ctx) =>
    withUser(ctx, async (userId) => (await actions()).scheduleVideoForUser(userId, video_id, scheduled_for ?? null)),
});

const publishNowTool = defineTool({
  name: "publish_now",
  title: "Publish a queued video now",
  description:
    "Immediately upload a queued video to its connected YouTube channel. Set privacy to 'public' to make it live for everyone, 'unlisted' for link-only, or 'private' (default).",
  inputSchema: {
    queue_id: z.string().uuid().describe("Publish queue entry id from list_queue."),
    privacy: z.enum(["private", "unlisted", "public"]).default("private"),
  },
  annotations: { readOnlyHint: false, openWorldHint: true },
  handler: ({ queue_id, privacy }, ctx) =>
    withUser(ctx, async (userId) => (await actions()).publishQueueItemForUser(userId, queue_id, privacy)),
});

const setVisibilityTool = defineTool({
  name: "set_video_visibility",
  title: "Change a published video's visibility",
  description:
    "Change the YouTube visibility of a video that is already uploaded (for example flip a private upload to public).",
  inputSchema: {
    video_id: z.string().uuid().describe("Generated video id from list_videos."),
    privacy: z.enum(["private", "unlisted", "public"]),
  },
  annotations: { readOnlyHint: false, openWorldHint: true },
  handler: ({ video_id, privacy }, ctx) =>
    withUser(ctx, async (userId) => (await actions()).setVideoVisibilityForUser(userId, video_id, privacy)),
});

const runScanTool = defineTool({
  name: "run_scan",
  title: "Run a profit scan",
  description: "Scan YouTube for creators in a niche within a modeled profit-per-video bracket.",
  inputSchema: {
    niche: z.string().trim().min(1),
    min: z.number().min(0).default(2000),
    max: z.number().min(0).nullable().optional(),
  },
  annotations: { readOnlyHint: false, openWorldHint: true },
  handler: ({ niche, min, max }, ctx) =>
    withUser(ctx, async (userId) =>
      (await actions()).runScanForUser(userId, { niche, min, max: max ?? null }),
    ),
});

const extractBlueprintTool = defineTool({
  name: "extract_blueprint",
  title: "Extract a blueprint",
  description: "Extract a structure-only strategy blueprint from one or more surfaced creators.",
  inputSchema: {
    creator_ids: z.array(z.string().uuid()).min(1).max(10),
    name: z.string().trim().min(1).optional(),
  },
  annotations: { readOnlyHint: false, openWorldHint: false },
  handler: ({ creator_ids, name }, ctx) =>
    withUser(ctx, async (userId) => (await actions()).extractBlueprintForUser(userId, creator_ids, name)),
});

const spawnChannelTool = defineTool({
  name: "spawn_channel",
  title: "Spawn a channel",
  description: "Create a channel from a blueprint and brand profile.",
  inputSchema: {
    name: z.string().trim().min(1),
    blueprint_id: z.string().uuid().optional(),
    brand_id: z.string().uuid().optional(),
    auto_publish: z.boolean().optional(),
  },
  annotations: { readOnlyHint: false, openWorldHint: false },
  handler: ({ name, blueprint_id, brand_id, auto_publish }, ctx) =>
    withUser(ctx, async (userId) =>
      (await actions()).spawnChannelForUser(userId, {
        name,
        ...(blueprint_id ? { blueprint_id } : {}),
        ...(brand_id ? { brand_id } : {}),
        ...(auto_publish === undefined ? {} : { auto_publish }),
      }),
    ),
});

const autopilotTool = defineTool({
  name: "autopilot",
  title: "Run autopilot",
  description:
    "Run the end-to-end flow for a niche: scan, blueprint, channel, evergreen concepts. Use mode 'plan' to stop before rendering, 'full' to also render.",
  inputSchema: {
    niche: z.string().trim().min(1),
    min: z.number().min(0).optional(),
    max: z.number().min(0).nullable().optional(),
    channel_name: z.string().trim().min(1).optional(),
    video_count: z.number().int().min(1).max(6).optional(),
    duration_target: z.number().int().min(8).max(120).optional(),
    mode: z.enum(["plan", "full"]).default("plan"),
  },
  annotations: { readOnlyHint: false, openWorldHint: true },
  handler: ({ niche, min, max, channel_name, video_count, duration_target, mode }, ctx) =>
    withUser(ctx, async (userId) =>
      (await actions()).autopilotForUser(userId, {
        niche,
        min,
        max: max ?? null,
        channel_name,
        video_count,
        duration_target,
        mode,
      }),
    ),
});

const performanceTool = defineTool({
  name: "get_performance",
  title: "Get video performance",
  description: "Per-video views, watch time and modeled revenue, plus blueprint rankings. Set refresh to pull fresh YouTube stats.",
  inputSchema: { refresh: z.boolean().default(false) },
  annotations: { readOnlyHint: true, openWorldHint: true },
  handler: ({ refresh }, ctx) =>
    withUser(ctx, async (userId) => (await actions()).performanceForUser(userId, refresh)),
});

export const actionTools = [
  nextActionsTool,
  listVideosTool,
  listQueueTool,
  generateVideosTool,
  renderVideoTool,
  approveVideoTool,
  scheduleVideoTool,
  publishNowTool,
  setVisibilityTool,
  runScanTool,
  extractBlueprintTool,
  spawnChannelTool,
  autopilotTool,
  performanceTool,
];
