import { describe, expect, it } from 'vitest';
import { ROLE_ROOM_WORKSPACE_LENSES } from './productionWorkspaceLens';
import {
  FIRST_ASSISTANT_DIRECTOR_PROJECT_ROLES,
  SECOND_ASSISTANT_DIRECTOR_PROJECT_ROLES,
  WORKSPACE_LENS_REGISTRY,
  matchesLensProjectRole,
  isLensDecisionPending,
  resolveLensUrlState,
  resolveWorkspaceLens,
  type RoleWorkspaceLens,
} from './workspaceLensRegistry';

const none = () => false;
const all = () => true;
const only = (...lenses: RoleWorkspaceLens[]) => (lens: RoleWorkspaceLens) => lenses.includes(lens);

describe('workspaceLensRegistry', () => {
  it('covers every registered lens except the full workspace', () => {
    const registered = WORKSPACE_LENS_REGISTRY.map((entry) => entry.lens).sort();
    const expected = ROLE_ROOM_WORKSPACE_LENSES.filter((lens) => lens !== 'full').sort();
    expect(registered).toEqual(expected);
  });

  it('keeps the assistant direction split in sync with the lens entry', () => {
    const entry = WORKSPACE_LENS_REGISTRY.find((item) => item.lens === 'assistant-direction');
    expect([...(entry?.projectRoles ?? [])].sort()).toEqual([
      ...FIRST_ASSISTANT_DIRECTOR_PROJECT_ROLES,
      ...SECOND_ASSISTANT_DIRECTOR_PROJECT_ROLES,
    ].sort());
  });

  it('resolves persisted role aliases to their lens', () => {
    expect(matchesLensProjectRole('cinematography', 'dop')).toBe(true);
    expect(matchesLensProjectRole('cinematography', '  DoP  ')).toBe(true);
    expect(matchesLensProjectRole('assistant-direction', '2nd_ad')).toBe(true);
    expect(matchesLensProjectRole('assistant-direction', '2nd_2nd_ad')).toBe(true);
    expect(matchesLensProjectRole('assistant-direction', 'set_pa')).toBe(true);
    expect(matchesLensProjectRole('producer', 'executive_producer')).toBe(true);
    expect(matchesLensProjectRole('producer', 'line_producer')).toBe(true);
    expect(matchesLensProjectRole('casting', 'local_casting_director')).toBe(true);
    expect(matchesLensProjectRole('casting', 'extras_casting_director')).toBe(true);
    expect(matchesLensProjectRole('production-coordination', 'production_secretary')).toBe(true);
    expect(matchesLensProjectRole('production-coordination', 'office_pa')).toBe(true);
    expect(matchesLensProjectRole('location-management', 'location_scout')).toBe(true);
    expect(matchesLensProjectRole('art-department', 'production_designer')).toBe(true);
    expect(matchesLensProjectRole('art-department', 'property_master')).toBe(true);
    expect(matchesLensProjectRole('production-sound', 'sound_engineer')).toBe(true);
    expect(matchesLensProjectRole('production-sound', 'boom_operator')).toBe(true);
    expect(matchesLensProjectRole('director', 'producer')).toBe(false);
    expect(matchesLensProjectRole('director', null)).toBe(false);
    expect(matchesLensProjectRole('director', '')).toBe(false);
  });
});

describe('resolveWorkspaceLens', () => {
  it('falls back to the full workspace without an assignment or preference', () => {
    expect(resolveWorkspaceLens({ preference: null, isAssigned: none, isAllowed: all }))
      .toBe('full');
  });

  it('opens the lens the member is assigned to', () => {
    expect(resolveWorkspaceLens({
      preference: null,
      isAssigned: only('continuity'),
      isAllowed: all,
    })).toBe('continuity');
  });

  it('opens producer and casting lenses from their assigned role', () => {
    expect(resolveWorkspaceLens({
      preference: null,
      isAssigned: only('producer'),
      isAllowed: all,
    })).toBe('producer');
    expect(resolveWorkspaceLens({
      preference: null,
      isAssigned: only('casting'),
      isAllowed: all,
    })).toBe('casting');
  });

  it('lets an explicit preference override the assigned role', () => {
    expect(resolveWorkspaceLens({
      preference: 'location-management',
      isAssigned: only('director'),
      isAllowed: all,
    })).toBe('location-management');
  });

  it('never opens a lens the member is not permitted to use', () => {
    expect(resolveWorkspaceLens({
      preference: 'production-management',
      isAssigned: only('production-management'),
      isAllowed: none,
    })).toBe('full');
  });

  it('skips a forbidden lens and keeps looking', () => {
    expect(resolveWorkspaceLens({
      preference: null,
      isAssigned: only('director', 'continuity'),
      isAllowed: only('continuity'),
    })).toBe('continuity');
  });

  it('applies registry order when several assignments are allowed', () => {
    expect(resolveWorkspaceLens({
      preference: null,
      isAssigned: only('continuity', 'director'),
      isAllowed: all,
    })).toBe('director');
  });

  it('treats a full preference as leaving the role lens', () => {
    expect(resolveWorkspaceLens({
      preference: 'full',
      isAssigned: only('director'),
      isAllowed: all,
    })).toBe('full');
  });
});

describe('resolveLensUrlState', () => {
  const base = {
    preference: null,
    hasAssignedLensRole: false,
    surfaces: {},
    plannerSurface: '',
    scenes: {},
  } as const;

  it('publishes the lens surface and scene for the director', () => {
    expect(resolveLensUrlState({
      ...base,
      lens: 'director',
      surfaces: { director: 'visual-plan' },
      scenes: { director: 'scene-12' },
    })).toEqual({ lens: 'director', surface: 'visual-plan', scene: 'scene-12' });
  });

  it('keeps the scene parameter to the director lens', () => {
    expect(resolveLensUrlState({
      ...base,
      lens: 'cinematography',
      surfaces: { cinematography: 'shot-plan' },
      scenes: { cinematography: 'scene-12' } as never,
    })).toEqual({ lens: 'cinematography', surface: 'shot-plan', scene: '' });
  });

  it('clears the surface for lenses without one', () => {
    expect(resolveLensUrlState({
      ...base,
      lens: 'production-management',
      plannerSurface: 'roles',
    })).toEqual({ lens: 'production-management', surface: '', scene: '' });
  });

  it('keeps producer URLs clean and publishes the casting surface', () => {
    expect(resolveLensUrlState({
      ...base,
      lens: 'producer',
      plannerSurface: 'approval',
    })).toEqual({ lens: 'producer', surface: '', scene: '' });
    expect(resolveLensUrlState({
      ...base,
      lens: 'casting',
      surfaces: { casting: 'talents' },
      plannerSurface: 'project_room',
    })).toEqual({ lens: 'casting', surface: 'talents', scene: '' });
  });

  it('falls back to the planner surface for the continuity lens', () => {
    expect(resolveLensUrlState({
      ...base,
      lens: 'continuity',
      plannerSurface: 'roles',
    })).toEqual({ lens: 'continuity', surface: 'roles', scene: '' });
  });

  it('publishes the selected production-design surface', () => {
    expect(resolveLensUrlState({
      ...base,
      lens: 'art-department',
      surfaces: { 'art-department': 'visual-direction' },
    })).toEqual({ lens: 'art-department', surface: 'visual-direction', scene: '' });
  });

  it('publishes the selected production-sound surface', () => {
    expect(resolveLensUrlState({
      ...base,
      lens: 'production-sound',
      surfaces: { 'production-sound': 'takes' },
    })).toEqual({ lens: 'production-sound', surface: 'takes', scene: '' });
  });

  it('drops the lens parameter in the full workspace', () => {
    expect(resolveLensUrlState({ ...base, lens: 'full', plannerSurface: 'roles' }))
      .toEqual({ lens: '', surface: 'roles', scene: '' });
  });

  it('keeps an explicit full choice in the URL for members who have a lens', () => {
    expect(resolveLensUrlState({
      ...base,
      lens: 'full',
      preference: 'full',
      hasAssignedLensRole: true,
    })).toEqual({ lens: 'full', surface: '', scene: '' });
  });

  it('does not write a full lens for members without a production role', () => {
    expect(resolveLensUrlState({
      ...base,
      lens: 'full',
      preference: 'full',
      hasAssignedLensRole: false,
    })).toEqual({ lens: '', surface: '', scene: '' });
  });
});

describe('admin lens', () => {
  it('is registered but selected by no project role', () => {
    const entry = WORKSPACE_LENS_REGISTRY.find((item) => item.lens === 'admin');
    expect(entry?.projectRoles).toEqual([]);
    expect(matchesLensProjectRole('admin', 'director')).toBe(false);
    expect(matchesLensProjectRole('admin', 'admin')).toBe(false);
  });

  it('never opens on its own, even for an owner with no other lens', () => {
    expect(resolveWorkspaceLens({
      preference: null,
      isAssigned: none,
      isAllowed: all,
    })).toBe('full');
  });

  it('opens only on an explicit choice by a permitted caller', () => {
    expect(resolveWorkspaceLens({
      preference: 'admin',
      isAssigned: none,
      isAllowed: only('admin'),
    })).toBe('admin');
  });

  it('stays shut for a caller who is not super admin', () => {
    expect(resolveWorkspaceLens({
      preference: 'admin',
      isAssigned: none,
      isAllowed: (lens) => lens !== 'admin',
    })).toBe('full');
  });

  it('does not take a role lens away from the member who asked for admin', () => {
    // En produsent som ikke er super admin faller tilbake til sin egen linse.
    expect(resolveWorkspaceLens({
      preference: null,
      isAssigned: only('director'),
      isAllowed: (lens) => lens !== 'admin',
    })).toBe('director');
  });

  it('writes no surface or scene parameter', () => {
    expect(resolveLensUrlState({
      lens: 'admin',
      preference: 'admin',
      hasAssignedLensRole: false,
      surfaces: {},
      plannerSurface: 'roles',
      scenes: {},
    })).toEqual({ lens: 'admin', surface: '', scene: '' });
  });
});

describe('isLensDecisionPending', () => {
  it('holds the admin lens while the server has not answered', () => {
    expect(isLensDecisionPending('admin', false)).toBe(true);
  });

  it('releases it once the gate has settled, allowed or not', () => {
    expect(isLensDecisionPending('admin', true)).toBe(false);
  });

  it('never holds a lens that is decided locally', () => {
    expect(isLensDecisionPending('director', false)).toBe(false);
    expect(isLensDecisionPending('full', false)).toBe(false);
    expect(isLensDecisionPending(null, false)).toBe(false);
  });
});
