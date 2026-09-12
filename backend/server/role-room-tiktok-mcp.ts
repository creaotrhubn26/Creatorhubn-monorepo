// =============================================================================
// TikTok for Business MCP connector (Spor B). Builds the platform-specific
// config on the shared generic MCP core (role-room-agent-mcp.ts).
//
// Docs: https://business-api.tiktok.com/portal/docs/tiktok-ads-mcp-server
//   - Progressive Disclosure (~40 core tools + on-demand) — token-efficient
//     default for an LLM agent (TikTok exposes ~400 tools).
//   - Full Disclosure (~400 tools at connect) — only for very large contexts.
// Auth: TikTok for Business OAuth token (30-day lifespan → refresh/reauth).
// =============================================================================

import {
  AGENT_MCP_BETA,
  buildMcpToolset,
  type AgentMcpConfig,
  type AgentMcpMode,
} from "./role-room-agent-mcp.js";

export type TikTokMcpDisclosure = "progressive" | "full";
export type TikTokMcpMode = AgentMcpMode;
/** @deprecated use AgentMcpConfig from role-room-agent-mcp.js */
export type TikTokMcpConfig = AgentMcpConfig;

export const TIKTOK_MCP_SERVER_URLS: Record<TikTokMcpDisclosure, string> = {
  progressive: "https://business-api.tiktok.com/open_mcp/tt-ads-mcp-layer",
  full: "https://business-api.tiktok.com/open_mcp/tt-ads-mcp-flat",
};

export const TIKTOK_MCP_BETA = AGENT_MCP_BETA;
export const TIKTOK_MCP_SERVER_NAME = "tiktok-ads";

/** Curated READ-ONLY tool allowlist. The MCP connector auto-executes enabled
 *  tools server-side, so the safe default enables only reporting/get/list tools
 *  — never create/update/delete/status. Writes are opt-in via mode:'full'. */
export const TIKTOK_MCP_READ_ONLY_TOOLS: readonly string[] = [
  "report_integrated_get",
  "report_video_performance_get",
  "creative_report_get",
  "gmv_max_report_get",
  "campaign_get",
  "adgroup_get",
  "ad_get",
  "advertiser_info_get",
  "advertiser_balance_get",
  "audience_insight_info_get",
  "audience_insight_overlap_get",
  "dmp_custom_audience_list_get",
  "dmp_saved_audience_list_get",
  "catalog_get",
  "catalog_overview_get",
  "bc_get",
  "bc_account_cost_get",
  "spark_ad_recommend_get",
  "tool_bid_recommend",
  "lead_get",
  "lead_field_get",
];

/**
 * Build the TikTok MCP connector config for a Claude call. Returns null when no
 * authorization token is available (user hasn't connected TikTok for Business).
 */
export function buildTikTokMcpConfig(options: {
  authorizationToken: string | null | undefined;
  mode?: TikTokMcpMode;
  disclosure?: TikTokMcpDisclosure;
  deferLoading?: boolean;
}): AgentMcpConfig | null {
  const token = typeof options.authorizationToken === "string" ? options.authorizationToken.trim() : "";
  if (!token) return null;
  const disclosure = options.disclosure ?? "progressive";
  return {
    mcp_servers: [
      {
        type: "url",
        url: TIKTOK_MCP_SERVER_URLS[disclosure],
        name: TIKTOK_MCP_SERVER_NAME,
        authorization_token: token,
      },
    ],
    tools: [
      buildMcpToolset(TIKTOK_MCP_SERVER_NAME, options.mode ?? "read_only", TIKTOK_MCP_READ_ONLY_TOOLS, options.deferLoading ?? true),
    ],
    betas: [AGENT_MCP_BETA],
  };
}
