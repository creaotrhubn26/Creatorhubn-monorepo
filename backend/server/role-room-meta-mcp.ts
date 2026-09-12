// =============================================================================
// Meta (Facebook + Instagram) Ads MCP connector. Meta's official "Ads AI
// Connectors" MCP server (launched 2026-04-29) wraps the Marketing API as ~29
// MCP tools behind a Meta Business OAuth layer.
//
// Docs: https://mcp.facebook.com/ads (hosted) — single server, ~29 tools.
// Auth: Meta Business OAuth token (same as the existing IG/Meta connection).
//
// Built on the shared generic MCP core (role-room-agent-mcp.ts). Read-only by
// default (the connector auto-executes enabled tools server-side, so write
// tools — create/update/activate — are excluded from the allowlist).
// =============================================================================

import {
  AGENT_MCP_BETA,
  buildMcpToolset,
  type AgentMcpConfig,
  type AgentMcpMode,
} from "./role-room-agent-mcp.js";

export const META_MCP_SERVER_URL = "https://mcp.facebook.com/ads";
export const META_MCP_SERVER_NAME = "meta-ads";
export const META_MCP_BETA = AGENT_MCP_BETA;

/** READ-ONLY allowlist — every get/list/insights/report tool from Meta's ~29.
 *  The 6 write tools (ads_create_campaign/ad_set/ad, ads_update_entity,
 *  ads_activate_entity, ads_catalog_create) are deliberately excluded. */
export const META_MCP_READ_ONLY_TOOLS: readonly string[] = [
  // Accounts / entities / pages
  "ads_get_ad_accounts",
  "ads_get_ad_entities",
  "ads_get_pages_for_business",
  // Catalog (read)
  "ads_catalog_get_catalogs",
  "ads_catalog_get_details",
  "ads_catalog_get_diagnostics",
  "ads_catalog_get_feed_rules",
  "ads_catalog_get_product_details",
  "ads_catalog_get_product_feed_details",
  "ads_catalog_get_product_sets",
  "ads_catalog_get_products",
  "ads_catalog_get_product_set_products",
  // Datasets / tracking
  "ads_get_dataset_details",
  "ads_get_dataset_quality",
  "ads_get_dataset_stats",
  "ads_get_errors",
  // Analytics / benchmarks / help
  "ads_insights_advertiser_context",
  "ads_insights_anomaly_signal",
  "ads_insights_auction_ranking_benchmarks",
  "ads_insights_industry_benchmark",
  "ads_insights_performance_trend",
  "ads_get_opportunity_score",
  "ads_get_help_article",
];

/**
 * Build the Meta Ads MCP connector config for a Claude call. Returns null when
 * no authorization token is available (user hasn't connected Meta).
 */
export function buildMetaMcpConfig(options: {
  authorizationToken: string | null | undefined;
  mode?: AgentMcpMode;
  deferLoading?: boolean;
}): AgentMcpConfig | null {
  const token = typeof options.authorizationToken === "string" ? options.authorizationToken.trim() : "";
  if (!token) return null;
  return {
    mcp_servers: [
      {
        type: "url",
        url: META_MCP_SERVER_URL,
        name: META_MCP_SERVER_NAME,
        authorization_token: token,
      },
    ],
    tools: [
      buildMcpToolset(META_MCP_SERVER_NAME, options.mode ?? "read_only", META_MCP_READ_ONLY_TOOLS, options.deferLoading ?? true),
    ],
    betas: [AGENT_MCP_BETA],
  };
}
