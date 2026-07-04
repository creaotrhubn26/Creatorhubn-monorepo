import { describe, expect, it } from 'vitest';
import {
  buildTikTokMcpConfig,
  TIKTOK_MCP_BETA,
  TIKTOK_MCP_SERVER_URLS,
} from './role-room-tiktok-mcp.js';

describe('buildTikTokMcpConfig', () => {
  it('builds a progressive-disclosure connector by default with defer_loading', () => {
    const cfg = buildTikTokMcpConfig({ authorizationToken: 'tok123' });
    expect(cfg).not.toBeNull();
    expect(cfg!.mcp_servers[0]).toEqual({
      type: 'url',
      url: TIKTOK_MCP_SERVER_URLS.progressive,
      name: 'tiktok-ads',
      authorization_token: 'tok123',
    });
    expect(cfg!.tools[0]).toEqual({
      type: 'mcp_toolset',
      mcp_server_name: 'tiktok-ads',
      default_config: { defer_loading: true },
    });
    expect(cfg!.betas).toEqual([TIKTOK_MCP_BETA]);
  });

  it('uses the full-disclosure URL when requested', () => {
    const cfg = buildTikTokMcpConfig({ authorizationToken: 'tok', disclosure: 'full' });
    expect(cfg!.mcp_servers[0].url).toBe(TIKTOK_MCP_SERVER_URLS.full);
  });

  it('respects deferLoading=false', () => {
    const cfg = buildTikTokMcpConfig({ authorizationToken: 'tok', deferLoading: false });
    expect(cfg!.tools[0].default_config).toEqual({ defer_loading: false });
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
