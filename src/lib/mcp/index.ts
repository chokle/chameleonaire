import { auth, defineMcp } from "@lovable.dev/mcp-js";

type McpTools = Parameters<typeof defineMcp>[0]["tools"];
import listScans from "./tools/list-scans";
import listCreators from "./tools/list-creators";
import listBlueprints from "./tools/list-blueprints";
import listChannels from "./tools/list-channels";
import estimateEarnings from "./tools/estimate-earnings";

// The OAuth issuer must be the direct Supabase host; the project ref is the
// only value that survives publish unchanged.
const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "chameleonaire",
  title: "Chameleonaire",
  version: "0.1.0",
  instructions:
    "Tools for Chameleonaire, a YouTube profit-intelligence app. Use `list_scans` to see profit scans, `list_creators` to inspect surfaced creators and their estimated earnings, `list_blueprints` for extracted strategy blueprints, `list_channels` for spawned channels, and `estimate_earnings` to model earnings for any views/cadence/niche combination.",
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
  ] as unknown as McpTools,
});
