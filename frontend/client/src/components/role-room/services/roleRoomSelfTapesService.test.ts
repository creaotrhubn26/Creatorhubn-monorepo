import { describe, expect, it } from 'vitest';

import { canQueryCastingRoleSelftapes } from './roleRoomSelfTapesService';

describe('canQueryCastingRoleSelftapes', () => {
  it('accepts canonical roles persisted for the current project', () => {
    expect(canQueryCastingRoleSelftapes(
      { project_id: 'troll-project' },
      'troll-project',
    )).toBe(true);
    expect(canQueryCastingRoleSelftapes(
      { projectId: 'troll-project' },
      'troll-project',
    )).toBe(true);
  });

  it('rejects manuscript-only and cross-project role identifiers', () => {
    expect(canQueryCastingRoleSelftapes({}, 'troll-project')).toBe(false);
    expect(canQueryCastingRoleSelftapes(
      { project_id: 'another-project' },
      'troll-project',
    )).toBe(false);
  });
});
