import { createFileRoute } from "@tanstack/react-router";

const OPENAPI_SCHEMA = {
  openapi: "3.1.0",
  info: {
    title: "Chameleonaire ChatGPT Actions",
    description:
      "Full control of Chameleonaire from a ChatGPT Custom GPT: scan niches for earning channels, extract blueprints, spawn channels, generate evergreen videos, render, schedule and publish to YouTube.",
    version: "1.0.0",
    contact: { name: "Chameleonaire", url: "https://chameleonaire.me" },
  },
  servers: [{ url: "https://chameleonaire.lovable.app" }],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: "apiKey",
        in: "header",
        name: "Authorization",
        description: "Use 'Authorization: Bearer <your_chatgpt_api_key>'",
      },
    },
  },
  security: [{ ApiKeyAuth: [] }],
  paths: {
    "/api/public/chatgpt/channels/{id}": {
      get: {
        operationId: "getChannel",
        summary: "Get one channel with its videos and queue",
        description:
          "Returns a single channel, its brand and blueprint, aggregate stats, its generated videos and its publish queue entries.",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        ],
        responses: {
          "200": { description: "Channel detail", content: { "application/json": { schema: { type: "object" } } } },
          "401": { description: "Missing or invalid API key" },
          "403": { description: "Account is not an approved member" },
          "404": { description: "Channel not found" },
        },
      },
    },
    "/api/public/chatgpt/videos": {
      get: {
        operationId: "listVideos",
        summary: "List generated videos",
        description:
          "Returns generated videos with render status, approval state and YouTube video id. Filter by channel, status or approval.",
        parameters: [
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 50, default: 20 } },
          { name: "channel_id", in: "query", schema: { type: "string", format: "uuid" } },
          { name: "status", in: "query", schema: { type: "string" }, description: "e.g. awaiting_approval, scheduled, published." },
          { name: "approved", in: "query", schema: { type: "boolean" } },
        ],
        responses: {
          "200": { description: "List of videos", content: { "application/json": { schema: { type: "object" } } } },
          "401": { description: "Missing or invalid API key" },
          "403": { description: "Account is not an approved member" },
        },
      },
    },
    "/api/public/chatgpt/queue": {
      get: {
        operationId: "listQueue",
        summary: "List publish queue entries",
        description: "Returns publish queue entries with schedule, attempts, last error and the linked video.",
        parameters: [
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 50, default: 20 } },
          { name: "channel_id", in: "query", schema: { type: "string", format: "uuid" } },
          { name: "status", in: "query", schema: { type: "string" }, description: "e.g. queued, publishing, published, failed." },
        ],
        responses: {
          "200": { description: "Queue entries", content: { "application/json": { schema: { type: "object" } } } },
          "401": { description: "Missing or invalid API key" },
          "403": { description: "Account is not an approved member" },
        },
      },
    },
    "/api/public/chatgpt/performance": {
      get: {
        operationId: "getPerformance",
        summary: "Per-video performance and blueprint ranking",
        description:
          "Returns every published video with live YouTube views, likes and comments plus modelled watch time and estimated revenue, and ranks blueprints by earnings per video. Pass refresh=true to pull fresh numbers from YouTube first.",
        parameters: [{ name: "refresh", in: "query", schema: { type: "boolean", default: false } }],
        responses: {
          "200": { description: "Performance data", content: { "application/json": { schema: { type: "object" } } } },
          "401": { description: "Missing or invalid API key" },
          "403": { description: "Account is not an approved member" },
        },
      },
    },
    "/api/public/chatgpt/approve": {
      post: {
        operationId: "setVideoApproval",
        summary: "Approve or unapprove a generated video",
        description: "Approving a video marks it scheduled so the publish worker can upload it.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["video_id"],
                properties: {
                  video_id: { type: "string", format: "uuid" },
                  approved: { type: "boolean", default: true },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Updated video", content: { "application/json": { schema: { type: "object" } } } },
          "400": { description: "Invalid request" },
          "401": { description: "Missing or invalid API key" },
          "403": { description: "Account is not an approved member" },
        },
      },
    },
    "/api/public/chatgpt/publish": {
      post: {
        operationId: "publishQueueItem",
        summary: "Publish a queued video to YouTube now",
        description:
          "Renders if needed and uploads the queued video to the connected YouTube channel. Set privacy to 'public' to publish it live for everyone, 'unlisted' for link-only, or 'private' (default). Returns the YouTube video id and URL.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["queue_id"],
                properties: {
                  queue_id: { type: "string", format: "uuid" },
                  privacy: {
                    type: "string",
                    enum: ["private", "unlisted", "public"],
                    default: "private",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Published", content: { "application/json": { schema: { type: "object" } } } },
          "400": { description: "Publish failed" },
          "401": { description: "Missing or invalid API key" },
          "403": { description: "Account is not an approved member" },
        },
      },
    },
    "/api/public/chatgpt/visibility": {
      post: {
        operationId: "setVideoVisibility",
        summary: "Change a published video's YouTube visibility",
        description:
          "Changes the visibility of a video already uploaded to YouTube, for example flipping a private upload to public.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["video_id", "privacy"],
                properties: {
                  video_id: { type: "string", format: "uuid" },
                  privacy: { type: "string", enum: ["private", "unlisted", "public"] },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Visibility updated", content: { "application/json": { schema: { type: "object" } } } },
          "400": { description: "Update failed" },
          "401": { description: "Missing or invalid API key" },
          "403": { description: "Account is not an approved member" },
        },
      },
    },
    "/api/public/chatgpt/scans": {
      get: {
        operationId: "listScans",
        summary: "List recent scans",
        description: "Returns the most recent YouTube creator scans with niche and profit bracket metadata.",
        parameters: [
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", minimum: 1, maximum: 50, default: 10 },
            description: "Maximum number of scans to return.",
          },
        ],
        responses: {
          "200": {
            description: "List of scans",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    scans: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string", format: "uuid" },
                          niche: { type: "string" },
                          bracket_min: { type: "number" },
                          bracket_max: { type: ["number", "null"] },
                          status: { type: "string" },
                          results_count: { type: "integer" },
                          created_at: { type: "string", format: "date-time" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          "401": { description: "Missing or invalid API key" },
          "403": { description: "Account is not an approved member" },
        },
      },
    },
    "/api/public/chatgpt/creators": {
      get: {
        operationId: "listCreators",
        summary: "List creators",
        description: "Returns YouTube creators from scans, ordered by estimated profit per video.",
        parameters: [
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 50, default: 20 } },
          { name: "niche", in: "query", schema: { type: "string" }, description: "Filter by niche slug." },
          { name: "scan_id", in: "query", schema: { type: "string", format: "uuid" }, description: "Filter by scan UUID." },
          {
            name: "min_profit_per_video",
            in: "query",
            schema: { type: "number" },
            description: "Minimum estimated profit per video in USD.",
          },
        ],
        responses: {
          "200": {
            description: "List of creators",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    creators: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string", format: "uuid" },
                          channel_name: { type: "string" },
                          handle: { type: ["string", "null"] },
                          channel_url: { type: ["string", "null"] },
                          niche: { type: "string" },
                          subscribers: { type: "integer" },
                          avg_views: { type: "number" },
                          uploads_per_month: { type: "number" },
                          est_profit_per_video: { type: "number" },
                          est_monthly: { type: "number" },
                          data_source: { type: "string" },
                          scan_id: { type: ["string", "null"] },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          "401": { description: "Missing or invalid API key" },
          "403": { description: "Account is not an approved member" },
        },
      },
    },
    "/api/public/chatgpt/blueprints": {
      get: {
        operationId: "listBlueprints",
        summary: "List winning blueprints",
        description: "Returns extracted creator blueprints ordered by confidence score.",
        parameters: [
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 50, default: 20 } },
          { name: "niche", in: "query", schema: { type: "string" }, description: "Filter by niche slug." },
          {
            name: "min_confidence",
            in: "query",
            schema: { type: "number" },
            description: "Minimum confidence score (0-100).",
          },
        ],
        responses: {
          "200": {
            description: "List of blueprints",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    blueprints: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string", format: "uuid" },
                          name: { type: "string" },
                          niche: { type: "string" },
                          confidence: { type: "number" },
                          generation: { type: "string" },
                          status: { type: "string" },
                          deployable: { type: "boolean" },
                          win_rate: { type: ["number", "null"] },
                          gap_notes: { type: ["string", "null"] },
                          created_at: { type: "string", format: "date-time" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          "401": { description: "Missing or invalid API key" },
          "403": { description: "Account is not an approved member" },
        },
      },
    },
    "/api/public/chatgpt/channels": {
      get: {
        operationId: "listChannels",
        summary: "List spawned channels",
        description: "Returns channels created in the app, including their YouTube connection status.",
        parameters: [
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 50, default: 20 } },
        ],
        responses: {
          "200": {
            description: "List of channels",
            content: { "application/json": { schema: { type: "object", properties: { channels: { type: "array" } } } } },
          },
          "401": { description: "Missing or invalid API key" },
          "403": { description: "Account is not an approved member" },
        },
      },
    },
    "/api/public/chatgpt/estimate": {
      get: {
        operationId: "estimateEarnings",
        summary: "Estimate YouTube earnings",
        description: "Estimates per-video, monthly, and yearly earnings for a given view count, upload cadence, and niche.",
        parameters: [
          {
            name: "avg_views_per_video",
            in: "query",
            required: true,
            schema: { type: "number" },
            description: "Average views per video.",
          },
          {
            name: "videos_per_month",
            in: "query",
            schema: { type: "integer", minimum: 1, maximum: 300, default: 8 },
            description: "Number of videos uploaded per month.",
          },
          {
            name: "niche",
            in: "query",
            schema: { type: "string", default: "finance" },
            description: "Niche slug used to select RPM range.",
          },
        ],
        responses: {
          "200": {
            description: "Earnings estimate",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    niche: { type: "string" },
                    avgViewsPerVideo: { type: "number" },
                    videosPerMonth: { type: "integer" },
                    rpmRange: { type: "array", items: { type: "number" } },
                    perVideo: {
                      type: "object",
                      properties: { low: { type: "number" }, mid: { type: "number" }, high: { type: "number" } },
                    },
                    perMonth: {
                      type: "object",
                      properties: { low: { type: "number" }, mid: { type: "number" }, high: { type: "number" } },
                    },
                    perYear: {
                      type: "object",
                      properties: { low: { type: "number" }, mid: { type: "number" }, high: { type: "number" } },
                    },
                  },
                },
              },
            },
          },
          "400": { description: "Missing or invalid parameters" },
          "401": { description: "Missing or invalid API key" },
          "403": { description: "Account is not an approved member" },
        },
      },
    },
    "/api/public/chatgpt/next-actions": {
      get: {
        operationId: "getNextActions",
        summary: "Get the ranked next actions for this account",
        description:
          "ALWAYS call this first. It returns ranked action cards (kind, title, why, impact, params) describing exactly what to do next: run a scan, extract a blueprint, spawn a channel, generate, render, approve or publish. Use the params on a card as the body for the matching action.",
        responses: {
          "200": { description: "Ranked action cards", content: { "application/json": { schema: { type: "object" } } } },
          "401": { description: "Missing or invalid API key" },
        },
      },
    },
    "/api/public/chatgpt/scan": {
      post: {
        operationId: "runScan",
        summary: "Scan YouTube for high-earning creators in a niche",
        description:
          "Runs a live scan and stores the creators it finds with modelled profit per video. Use min/max to target a profit bracket (for example 2000 to 10000 per video).",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["niche"],
                properties: {
                  niche: { type: "string", description: "e.g. finance, ai, real estate" },
                  min: { type: "number", default: 2000 },
                  max: { type: "number", nullable: true, default: 10000 },
                  count: { type: "integer", minimum: 3, maximum: 24, default: 12 },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Scan result with scanId and number found" },
          "400": { description: "Scan failed" },
          "401": { description: "Missing or invalid API key" },
        },
      },
    },
    "/api/public/chatgpt/blueprint": {
      post: {
        operationId: "extractBlueprint",
        summary: "Extract a strategy blueprint from scanned creators",
        description:
          "Pulls the repeatable structure out of one to eight creators and returns confidence plus whether it clears the deploy gate. Structure only — never a creator's words, likeness or thumbnails.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["creator_ids"],
                properties: {
                  creator_ids: { type: "array", items: { type: "string", format: "uuid" }, minItems: 1, maxItems: 8 },
                  name: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Blueprint with confidence and deployable flag" },
          "400": { description: "Extraction failed" },
          "401": { description: "Missing or invalid API key" },
        },
      },
    },
    "/api/public/chatgpt/spawn-channel": {
      post: {
        operationId: "spawnChannel",
        summary: "Spawn a channel that runs a blueprint",
        description:
          "Creates a channel bound to a blueprint and brand. Only pass a blueprint that is deployable; otherwise generation is blocked.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name"],
                properties: {
                  name: { type: "string" },
                  blueprint_id: { type: "string", format: "uuid", nullable: true },
                  brand_id: { type: "string", format: "uuid", nullable: true },
                  divergence: { type: "integer", minimum: 0, maximum: 100, default: 35 },
                  uploads_per_week: { type: "integer", minimum: 1, maximum: 21, default: 3 },
                  auto_publish: { type: "boolean", default: false },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "The new channel" },
          "400": { description: "Could not spawn channel" },
          "401": { description: "Missing or invalid API key" },
        },
      },
    },
    "/api/public/chatgpt/generate": {
      post: {
        operationId: "generateVideos",
        summary: "Generate evergreen video concepts and scripts for a channel",
        description:
          "Writes 1-6 evergreen concepts, titles, hooks, scripts, descriptions and thumbnail prompts using the channel's blueprint and brand. Evergreen only: no news, trends or dated topics.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["channel_id"],
                properties: {
                  channel_id: { type: "string", format: "uuid" },
                  count: { type: "integer", minimum: 1, maximum: 6, default: 3 },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Created videos" },
          "400": { description: "Generation failed" },
          "401": { description: "Missing or invalid API key" },
        },
      },
    },
    "/api/public/chatgpt/render": {
      post: {
        operationId: "renderVideo",
        summary: "Render a generated video to a real video file",
        description:
          "Renders the video at the requested length in seconds (30, 45 or 60 are typical). This is slow; if it times out, poll listVideos for render_status.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["video_id"],
                properties: {
                  video_id: { type: "string", format: "uuid" },
                  duration_target: { type: "integer", minimum: 8, maximum: 120, default: 30 },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Render result with duration" },
          "400": { description: "Render failed" },
          "401": { description: "Missing or invalid API key" },
        },
      },
    },
    "/api/public/chatgpt/schedule": {
      post: {
        operationId: "scheduleVideo",
        summary: "Approve a video and put it in the publish queue",
        description: "Approves the video and schedules it. Omit scheduled_for to schedule it an hour from now.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["video_id"],
                properties: {
                  video_id: { type: "string", format: "uuid" },
                  scheduled_for: { type: "string", format: "date-time" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Queue entry" },
          "400": { description: "Scheduling failed" },
          "401": { description: "Missing or invalid API key" },
        },
      },
    },
    "/api/public/chatgpt/autopilot": {
      post: {
        operationId: "runAutopilot",
        summary: "Run the whole earning loop for a niche in one call",
        description:
          "Scans the niche, extracts a blueprint from the top earners, reuses the connected channel (or spawns one), and generates evergreen videos. With mode 'full' it also renders and publishes the first video privately to YouTube. Returns a step-by-step report you should narrate to the user. Use mode 'plan' by default; use 'full' only when the user asked to publish.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["niche"],
                properties: {
                  niche: { type: "string" },
                  min: { type: "number", default: 2000 },
                  max: { type: "number", nullable: true, default: 10000 },
                  channel_name: { type: "string" },
                  video_count: { type: "integer", minimum: 1, maximum: 6, default: 3 },
                  duration_target: { type: "integer", minimum: 8, maximum: 120, default: 30 },
                  mode: { type: "string", enum: ["plan", "full"], default: "plan" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Step-by-step autopilot report" },
          "400": { description: "Autopilot failed" },
          "401": { description: "Missing or invalid API key" },
        },
      },
    },
  },
};


export const Route = createFileRoute("/api/public/chatgpt/openapi.json")({
  server: {
    handlers: {
      GET: () => Response.json(OPENAPI_SCHEMA),
    },
  },
});
