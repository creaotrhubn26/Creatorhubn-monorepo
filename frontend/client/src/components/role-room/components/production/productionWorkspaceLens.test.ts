import { describe, expect, it } from 'vitest';
import { isRoleRoomWorkspaceLens } from './productionWorkspaceLens';

describe('productionWorkspaceLens', () => {
  it('accepts the full, director and cinematography workspace lenses', () => {
    expect(isRoleRoomWorkspaceLens('full')).toBe(true);
    expect(isRoleRoomWorkspaceLens('director')).toBe(true);
    expect(isRoleRoomWorkspaceLens('cinematography')).toBe(true);
  });

  it('rejects unknown and non-string values', () => {
    expect(isRoleRoomWorkspaceLens('camera')).toBe(false);
    expect(isRoleRoomWorkspaceLens(null)).toBe(false);
  });
});
