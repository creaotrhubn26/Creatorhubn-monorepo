import { describe, expect, it } from 'vitest';
import {
  buildMcpToolset,
  mergeAgentMcpConfigs,
  type AgentMcpConfig,
} from './role-room-agent-mcp.js';

describe('buildMcpToolset', () => {
  it('read_only disables all + enables the allowlist', () => {
    const ts = buildMcpToolset('srv', 'read_only', ['a', 'b']);
    expect(ts.default_config).toEqual({ enabled: false, defer_loading: true });
    expect(ts.configs).toEqual({ a: { enabled: true }, b: { enabled: true } });
  });
  it('full enables all with no allowlist', () => {
    const ts = buildMcpToolset('srv', 'full', ['a']);
    expect(ts.default_config).toEqual({ enabled: true, defer_loading: true });
    expect(ts.configs).toBeUndefined();
  });
});

describe('mergeAgentMcpConfigs', () => {
  const a: AgentMcpConfig = {
    mcp_servers: [{ type: 'url', url: 'https://a', name: 'a', authorization_token: 't1' }],
    tools: [{ type: 'mcp_toolset', mcp_server_name: 'a' }],
    betas: ['mcp-client-2025-11-20'],
  };
  const b: AgentMcpConfig = {
    mcp_servers: [{ type: 'url', url: 'https://b', name: 'b', authorization_token: 't2' }],
    tools: [{ type: 'mcp_toolset', mcp_server_name: 'b' }],
    betas: ['mcp-client-2025-11-20'],
  };

  it('concats servers + toolsets and dedupes betas', () => {
    const merged = mergeAgentMcpConfigs([a, b])!;
    expect(merged.mcp_servers.map((s) => s.name)).toEqual(['a', 'b']);
    expect(merged.tools.map((t) => t.mcp_server_name)).toEqual(['a', 'b']);
    expect(merged.betas).toEqual(['mcp-client-2025-11-20']);
  });

  it('skips nulls and returns the single present config', () => {
    const merged = mergeAgentMcpConfigs([null, a, undefined])!;
    expect(merged.mcp_servers).toHaveLength(1);
    expect(merged.mcp_servers[0].name).toBe('a');
  });

  it('returns null when nothing is present', () => {
    expect(mergeAgentMcpConfigs([null, undefined])).toBeNull();
  });
});
