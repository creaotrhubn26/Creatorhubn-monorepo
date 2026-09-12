// =============================================================================
// Google Ads MCP connector. Unlike Meta/TikTok (platform-hosted), Google's Ads
// MCP is SELF-HOSTED: run locally (stdio) or deploy to Cloud Run as an HTTPS
// endpoint. Anthropic's MCP connector needs a public HTTPS URL, so this targets
// the Cloud-Run deployment via the GOOGLE_ADS_MCP_URL env var. Strictly
// read-only — the server exposes only 3 tools and cannot mutate.
//
// Docs: https://developers.google.com/google-ads/api/docs/developer-toolkit/mcp-server
// Server auth: the server itself holds the Google Ads developer token + OAuth /
// service-account creds. An optional bearer (GOOGLE_ADS_MCP_TOKEN) guards the
// Cloud Run URL when configured.
// =============================================================================

import {
  AGENT_MCP_BETA,
  buildMcpToolset,
  type AgentMcpConfig,
  type AgentMcpMode,
} from "./role-room-agent-mcp.js";

export const GOOGLE_MCP_SERVER_NAME = "google-ads";
export const GOOGLE_MCP_BETA = AGENT_MCP_BETA;

/** The Google Ads MCP server is read-only by design; these are its only tools. */
export const GOOGLE_MCP_READ_ONLY_TOOLS: readonly string[] = [
  "list_accessible_customers",
  "search", // GAQL queries for metrics + campaign data
  "get_resource_metadata",
];

/**
 * Build the Google Ads MCP connector config. Requires a self-hosted server URL
 * (Cloud Run) — returns null when unset, since Google provides no hosted
 * endpoint. authorizationToken is optional (used only if the URL is bearer-
 * guarded).
 */
export function buildGoogleMcpConfig(options: {
  serverUrl: string | null | undefined;
  authorizationToken?: string | null;
  mode?: AgentMcpMode;
  deferLoading?: boolean;
}): AgentMcpConfig | null {
  const url = typeof options.serverUrl === "string" ? options.serverUrl.trim() : "";
  if (!url) return null;
  const server = { type: "url" as const, url, name: GOOGLE_MCP_SERVER_NAME } as AgentMcpConfig["mcp_servers"][number];
  const token = typeof options.authorizationToken === "string" ? options.authorizationToken.trim() : "";
  if (token) server.authorization_token = token;
  return {
    mcp_servers: [server],
    tools: [
      buildMcpToolset(GOOGLE_MCP_SERVER_NAME, options.mode ?? "read_only", GOOGLE_MCP_READ_ONLY_TOOLS, options.deferLoading ?? true),
    ],
    betas: [AGENT_MCP_BETA],
  };
}
