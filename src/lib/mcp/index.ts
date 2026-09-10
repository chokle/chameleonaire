import { auth, defineMcp } from "@lovable.dev/mcp-js";

type McpTools = Parameters<typeof defineMcp>[0]["tools"];
import listScans from "./tools/list-scans";
import listCreators from "./tools/list-creators";
import listBlueprints from "./tools/list-blueprints";
import listChannels from "./tools/list-channels";
import estimateEarnings from "./tools/estimate-earnings";
import { actionTools } from "./tools/actions";

// The OAuth issuer must be the direct Supabase host; the project ref is the
// only value that survives publish unchanged.
const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "chameleonaire",
  title: "Chameleonaire",
  version: "0.1.0",
  instructions:
    "Tools for Chameleonaire, a YouTube profit-intelligence app. Read: `list_scans`, `list_creators`, `list_blueprints`, `list_channels`, `list_videos`, `list_queue`, `get_performance`, `estimate_earnings`, `next_actions`. Write: `run_scan`, `extract_blueprint`, `spawn_channel`, `generate_videos` (evergreen only — no news, trends or dated topics), `render_video`, `approve_video`, `schedule_video`, `publish_now`, and `autopilot` for the whole flow. Typical order: next_actions -> generate_videos -> render_video -> schedule_video (or publish_now). YouTube uploads are private by default.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  // Tools declare no outputSchema; the SDK's type treats that key as required
  // under exactOptionalPropertyTypes, so widen to the shared tool type here.
  tools: [
    listScans,
    listCreators,
    listBlueprints,
    listChannels,
    estimateEarnings,
    ...actionTools,
  ] as unknown as McpTools,
});
