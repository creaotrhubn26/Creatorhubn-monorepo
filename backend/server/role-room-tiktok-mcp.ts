// =============================================================================
// TikTok for Business MCP connector (Spor B) — foundation.
//
// Builds the Anthropic MCP-connector config (beta `mcp-client-2025-11-20`) that
// wires TikTok's official Ads MCP server into a Role Room Agent Claude call, so
// producers can manage TikTok ad campaigns / reporting / audiences / creative in
// natural language. Spread the returned config into `beta.messages.create` and
// add the beta header.
//
// Docs: https://business-api.tiktok.com/portal/docs/tiktok-ads-mcp-server
//   - Progressive Disclosure (~40 core tools + on-demand) — token-efficient,
//     the right default for an LLM agent (TikTok exposes ~400 tools).
//   - Full Disclosure (~400 tools at connect) — only for very large contexts.
// Auth: TikTok for Business OAuth token (30-day lifespan → refresh/reauth).
//
// Pure config builder — no network, no SDK. The agent runner resolves the
// per-user token and spreads this into the Claude request.
// =============================================================================

export type TikTokMcpDisclosure = "progressive" | "full";

export const TIKTOK_MCP_SERVER_URLS: Record<TikTokMcpDisclosure, string> = {
  progressive: "https://business-api.tiktok.com/open_mcp/tt-ads-mcp-layer",
  full: "https://business-api.tiktok.com/open_mcp/tt-ads-mcp-flat",
};

/** Anthropic MCP-connector beta header value (current version). */
export const TIKTOK_MCP_BETA = "mcp-client-2025-11-20";
export const TIKTOK_MCP_SERVER_NAME = "tiktok-ads";

export interface TikTokMcpServerDef {
  type: "url";
  url: string;
  name: string;
  authorization_token: string;
}

export interface TikTokMcpToolset {
  type: "mcp_toolset";
  mcp_server_name: string;
  default_config?: { defer_loading?: boolean };
}

export interface TikTokMcpConfig {
  mcp_servers: TikTokMcpServerDef[];
  tools: TikTokMcpToolset[];
  /** Add to `betas` on the Anthropic beta Messages call. */
  betas: string[];
}

/**
 * Build the TikTok MCP connector config for a Claude call. Returns null when no
 * authorization token is available (user hasn't connected TikTok for Business),
 * so the caller simply omits the connector.
 */
export function buildTikTokMcpConfig(options: {
  authorizationToken: string | null | undefined;
  disclosure?: TikTokMcpDisclosure;
  /** Defer tool schemas (used with the Tool search tool) — recommended for the
   *  ~400-tool library so context isn't blown at connect. Default true. */
  deferLoading?: boolean;
}): TikTokMcpConfig | null {
  const token = typeof options.authorizationToken === "string" ? options.authorizationToken.trim() : "";
  if (!token) return null;
  const disclosure = options.disclosure ?? "progressive";
  const deferLoading = options.deferLoading ?? true;
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
      {
        type: "mcp_toolset",
        mcp_server_name: TIKTOK_MCP_SERVER_NAME,
        default_config: { defer_loading: deferLoading },
      },
    ],
    betas: [TIKTOK_MCP_BETA],
  };
}
