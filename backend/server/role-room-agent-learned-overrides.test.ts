import { describe, expect, it } from 'vitest';
import { resolveNaceBusinessModelOverride } from './role-room-agent-learned-overrides.js';

const overrides = [
  { nacePrefix: '70', businessModel: 'B2B' },
  { nacePrefix: '70.100', businessModel: 'B2C' },
  { nacePrefix: '56', businessModel: 'B2C' },
];

describe('resolveNaceBusinessModelOverride', () => {
  it('picks the most specific matching prefix', () => {
    expect(resolveNaceBusinessModelOverride('70.100', overrides)).toBe('B2C');
    expect(resolveNaceBusinessModelOverride('70.220', overrides)).toBe('B2B');
  });

  it('matches a broader prefix against a longer code', () => {
    expect(resolveNaceBusinessModelOverride('56.101', overrides)).toBe('B2C');
  });

  it('returns null when nothing matches', () => {
    expect(resolveNaceBusinessModelOverride('47.111', overrides)).toBeNull();
  });

  it('returns null for empty / missing input', () => {
    expect(resolveNaceBusinessModelOverride(null, overrides)).toBeNull();
    expect(resolveNaceBusinessModelOverride('70.100', null)).toBeNull();
    expect(resolveNaceBusinessModelOverride('70.100', [])).toBeNull();
    expect(resolveNaceBusinessModelOverride('X', overrides)).toBeNull();
  });

  it('ignores malformed override entries', () => {
    const bad = [{ nacePrefix: '', businessModel: 'B2C' }, { nacePrefix: '70', businessModel: '' }];
    expect(resolveNaceBusinessModelOverride('70.100', bad)).toBeNull();
  });
});

import { resolveNaceChannelPriorityOverride } from './role-room-agent-learned-overrides.js';

const channelOverrides = [
  { nacePrefix: '56', channels: ['tiktok', 'instagram'] },
  { nacePrefix: '56.30', channels: ['instagram', 'facebook'] },
];

describe('resolveNaceChannelPriorityOverride', () => {
  it('returns the channel order for the most specific matching prefix', () => {
    expect(resolveNaceChannelPriorityOverride('56.101', channelOverrides)).toEqual(['tiktok', 'instagram']);
    expect(resolveNaceChannelPriorityOverride('56.301', channelOverrides)).toEqual(['instagram', 'facebook']);
  });
  it('returns null when nothing matches or input is empty', () => {
    expect(resolveNaceChannelPriorityOverride('47.11', channelOverrides)).toBeNull();
    expect(resolveNaceChannelPriorityOverride(null, channelOverrides)).toBeNull();
    expect(resolveNaceChannelPriorityOverride('56.101', [])).toBeNull();
  });
  it('ignores entries with empty channels', () => {
    expect(resolveNaceChannelPriorityOverride('56.101', [{ nacePrefix: '56', channels: [] }])).toBeNull();
  });
});
