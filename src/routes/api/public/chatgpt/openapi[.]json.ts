import { createFileRoute } from "@tanstack/react-router";

const OPENAPI_SCHEMA = {
  openapi: "3.1.0",
  info: {
    title: "Chameleonaire ChatGPT Actions",
    description:
      "API for surfacing YouTube creator scans, blueprints, channels, and earnings estimates inside a ChatGPT Custom GPT.",
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
          "Renders if needed and uploads the queued video to the connected YouTube channel. Returns the YouTube video id and URL.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["queue_id"],
                properties: { queue_id: { type: "string", format: "uuid" } },
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
  },
};

export const Route = createFileRoute("/api/public/chatgpt/openapi.json")({
  server: {
    handlers: {
      GET: () => Response.json(OPENAPI_SCHEMA),
    },
  },
});
