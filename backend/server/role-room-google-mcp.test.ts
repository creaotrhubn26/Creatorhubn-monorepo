import { describe, expect, it } from 'vitest';
import {
  buildGoogleMcpConfig,
  GOOGLE_MCP_READ_ONLY_TOOLS,
} from './role-room-google-mcp.js';
import { AGENT_MCP_BETA } from './role-room-agent-mcp.js';

describe('buildGoogleMcpConfig', () => {
  it('targets the self-hosted URL with the 3 read-only tools', () => {
    const cfg = buildGoogleMcpConfig({ serverUrl: 'https://x.a.run.app/mcp' });
    expect(cfg).not.toBeNull();
    expect(cfg!.mcp_servers[0]).toEqual({ type: 'url', url: 'https://x.a.run.app/mcp', name: 'google-ads' });
    expect(cfg!.mcp_servers[0].authorization_token).toBeUndefined();
    expect(Object.keys(cfg!.tools[0].configs ?? {}).sort()).toEqual([...GOOGLE_MCP_READ_ONLY_TOOLS].sort());
    expect(cfg!.tools[0].default_config).toEqual({ enabled: false, defer_loading: true });
    expect(cfg!.betas).toEqual([AGENT_MCP_BETA]);
  });

  it('includes the bearer only when provided', () => {
    const withTok = buildGoogleMcpConfig({ serverUrl: 'https://x/mcp', authorizationToken: 'bear' });
    expect(withTok!.mcp_servers[0].authorization_token).toBe('bear');
  });

  it('returns null without a server URL (Google provides no hosted endpoint)', () => {
    expect(buildGoogleMcpConfig({ serverUrl: null })).toBeNull();
    expect(buildGoogleMcpConfig({ serverUrl: '  ' })).toBeNull();
  });
});
