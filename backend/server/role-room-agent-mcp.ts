// =============================================================================
// Generic Anthropic MCP-connector plumbing shared by every platform connector
// (TikTok Ads, Meta Ads, …). The Role Room Agent attaches one merged config to
// its Claude call so producers can query several ad platforms in one turn.
//
// Safety: the MCP connector AUTO-EXECUTES enabled tools server-side (no client
// confirmation like regular tool_use). Read-only toolsets (allowlist of
// reporting/get tools) are therefore the safe default; writes are opt-in.
// =============================================================================

/** Anthropic MCP-connector beta header value (current version). */
export const AGENT_MCP_BETA = "mcp-client-2025-11-20";

export interface AgentMcpServerDef {
  type: "url";
  url: string;
  name: string;
  /** OAuth bearer for the MCP server. Optional — some self-hosted servers (e.g.
   *  a Cloud Run Google Ads MCP) authenticate via env/IAM instead. */
  authorization_token?: string;
}

export interface AgentMcpToolConfig {
  enabled?: boolean;
  defer_loading?: boolean;
}

export interface AgentMcpToolset {
  type: "mcp_toolset";
  mcp_server_name: string;
  default_config?: AgentMcpToolConfig;
  configs?: Record<string, AgentMcpToolConfig>;
}

export interface AgentMcpConfig {
  mcp_servers: AgentMcpServerDef[];
  tools: AgentMcpToolset[];
  /** Add to `betas` on the Anthropic beta Messages call. */
  betas: string[];
}

export type AgentMcpMode = "read_only" | "full";

/** Build a toolset for a server. read_only disables everything, then enables
 *  only the allowlist; full enables all tools. */
export function buildMcpToolset(
  serverName: string,
  mode: AgentMcpMode,
  readOnlyTools: readonly string[],
  deferLoading = true,
): AgentMcpToolset {
  if (mode === "read_only") {
    return {
      type: "mcp_toolset",
      mcp_server_name: serverName,
      default_config: { enabled: false, defer_loading: deferLoading },
      configs: Object.fromEntries(readOnlyTools.map((name) => [name, { enabled: true }])),
    };
  }
  return {
    type: "mcp_toolset",
    mcp_server_name: serverName,
    default_config: { enabled: true, defer_loading: deferLoading },
  };
}

/** Merge several platform configs into one (concat servers + toolsets, dedupe
 *  betas). Nulls are skipped; returns null when nothing is present. */
export function mergeAgentMcpConfigs(
  configs: Array<AgentMcpConfig | null | undefined>,
): AgentMcpConfig | null {
  const present = configs.filter((c): c is AgentMcpConfig => Boolean(c));
  if (present.length === 0) return null;
  return {
    mcp_servers: present.flatMap((c) => c.mcp_servers),
    tools: present.flatMap((c) => c.tools),
    betas: Array.from(new Set(present.flatMap((c) => c.betas))),
  };
}
