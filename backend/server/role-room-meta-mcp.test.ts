import { describe, expect, it } from 'vitest';
import {
  buildMetaMcpConfig,
  META_MCP_READ_ONLY_TOOLS,
  META_MCP_SERVER_URL,
} from './role-room-meta-mcp.js';
import { AGENT_MCP_BETA } from './role-room-agent-mcp.js';

describe('buildMetaMcpConfig', () => {
  it('defaults to read-only against mcp.facebook.com/ads with the allowlist', () => {
    const cfg = buildMetaMcpConfig({ authorizationToken: 'metatok' });
    expect(cfg).not.toBeNull();
    expect(cfg!.mcp_servers[0]).toEqual({
      type: 'url',
      url: META_MCP_SERVER_URL,
      name: 'meta-ads',
      authorization_token: 'metatok',
    });
    const toolset = cfg!.tools[0];
    expect(toolset.default_config).toEqual({ enabled: false, defer_loading: true });
    expect(Object.keys(toolset.configs ?? {}).sort()).toEqual([...META_MCP_READ_ONLY_TOOLS].sort());
    expect(toolset.configs?.ads_insights_performance_trend).toEqual({ enabled: true });
    expect(cfg!.betas).toEqual([AGENT_MCP_BETA]);
  });

  it('excludes every write tool from the read-only allowlist', () => {
    for (const write of ['ads_create_campaign', 'ads_create_ad_set', 'ads_create_ad', 'ads_update_entity', 'ads_activate_entity', 'ads_catalog_create']) {
      expect(META_MCP_READ_ONLY_TOOLS).not.toContain(write);
    }
  });

  it('mode=full enables all tools', () => {
    const cfg = buildMetaMcpConfig({ authorizationToken: 'tok', mode: 'full' });
    expect(cfg!.tools[0].default_config).toEqual({ enabled: true, defer_loading: true });
    expect(cfg!.tools[0].configs).toBeUndefined();
  });

  it('returns null without a token', () => {
    expect(buildMetaMcpConfig({ authorizationToken: null })).toBeNull();
    expect(buildMetaMcpConfig({ authorizationToken: '  ' })).toBeNull();
  });
});
