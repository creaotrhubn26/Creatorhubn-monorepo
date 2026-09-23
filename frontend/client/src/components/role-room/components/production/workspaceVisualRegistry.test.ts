import { describe, expect, it } from 'vitest';
import { ROLE_ROOM_WORKSPACE_LENSES } from './productionWorkspaceLens';
import { getRoleRoomWorkspaceVisual } from './workspaceVisualRegistry';

describe('workspaceVisualRegistry', () => {
  it('gir alle arbeidslinser et prosjektnøytralt motiv', () => {
    for (const lens of ROLE_ROOM_WORKSPACE_LENSES) {
      const visual = getRoleRoomWorkspaceVisual(lens);
      expect(visual.src).toMatch(/^\/assets\/role-room\/workspace-atmosphere\/.+-v1\.webp$/);
      expect(visual.label.length).toBeGreaterThan(8);
    }
  });

  it('holder casting og post visuelt adskilt fra produksjonssettet', () => {
    expect(getRoleRoomWorkspaceVisual('casting').family).toBe('casting');
    expect(getRoleRoomWorkspaceVisual('post-production').family).toBe('post');
    expect(getRoleRoomWorkspaceVisual('director').family).toBe('production');
  });
});
