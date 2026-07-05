import { describe, expect, it } from 'vitest';
import {
  buildTikTokMcpConfig,
  TIKTOK_MCP_BETA,
  TIKTOK_MCP_READ_ONLY_TOOLS,
  TIKTOK_MCP_SERVER_URLS,
} from './role-room-tiktok-mcp.js';

describe('buildTikTokMcpConfig', () => {
  it('defaults to read-only: server def + all tools disabled except the read allowlist', () => {
    const cfg = buildTikTokMcpConfig({ authorizationToken: 'tok123' });
    expect(cfg).not.toBeNull();
    expect(cfg!.mcp_servers[0]).toEqual({
      type: 'url',
      url: TIKTOK_MCP_SERVER_URLS.progressive,
      name: 'tiktok-ads',
      authorization_token: 'tok123',
    });
    const toolset = cfg!.tools[0];
    expect(toolset.default_config).toEqual({ enabled: false, defer_loading: true });
    // Every read-allowlist tool is explicitly enabled; nothing else is.
    expect(Object.keys(toolset.configs ?? {}).sort()).toEqual([...TIKTOK_MCP_READ_ONLY_TOOLS].sort());
    expect(toolset.configs?.report_integrated_get).toEqual({ enabled: true });
    // No write tool is enabled.
    expect(toolset.configs?.campaign_create).toBeUndefined();
    expect(cfg!.betas).toEqual([TIKTOK_MCP_BETA]);
  });

  it('mode=full enables all tools (no allowlist)', () => {
    const cfg = buildTikTokMcpConfig({ authorizationToken: 'tok', mode: 'full' });
    expect(cfg!.tools[0].default_config).toEqual({ enabled: true, defer_loading: true });
    expect(cfg!.tools[0].configs).toBeUndefined();
  });

  it('uses the full-disclosure URL when requested', () => {
    const cfg = buildTikTokMcpConfig({ authorizationToken: 'tok', disclosure: 'full' });
    expect(cfg!.mcp_servers[0].url).toBe(TIKTOK_MCP_SERVER_URLS.full);
  });

  it('respects deferLoading=false', () => {
    const cfg = buildTikTokMcpConfig({ authorizationToken: 'tok', deferLoading: false });
    expect(cfg!.tools[0].default_config?.defer_loading).toBe(false);
  });

  it('returns null without a token (user not connected)', () => {
    expect(buildTikTokMcpConfig({ authorizationToken: null })).toBeNull();
    expect(buildTikTokMcpConfig({ authorizationToken: '' })).toBeNull();
    expect(buildTikTokMcpConfig({ authorizationToken: '   ' })).toBeNull();
  });

  it('trims the token', () => {
    const cfg = buildTikTokMcpConfig({ authorizationToken: '  tok  ' });
    expect(cfg!.mcp_servers[0].authorization_token).toBe('tok');
  });
});
