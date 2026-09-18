import { describe, expect, it } from 'vitest';
import {
  WORKSPACE_LENS_REGISTRY,
  matchesLensProjectRole,
} from '../components/production/workspaceLensRegistry';
import { resolveSessionProjectRole, isSessionProjectRole } from './sessionProjectRole';

describe('resolveSessionProjectRole', () => {
  it('leser katalogens id', () => {
    expect(resolveSessionProjectRole('director')).toBe('director');
    expect(resolveSessionProjectRole('production_manager')).toBe('production_manager');
  });

  it('leser aliasene katalogen eier, uten en egen liste her', () => {
    // Disse skrivemåtene lå tidligere som håndskrevne lister i panelet.
    expect(resolveSessionProjectRole('dop')).toBe('camera_team');
    expect(resolveSessionProjectRole('director_of_photography')).toBe('camera_team');
    expect(resolveSessionProjectRole('1st_ad')).toBe('first_ad');
    expect(resolveSessionProjectRole('first_assistant_director')).toBe('first_ad');
    expect(resolveSessionProjectRole('2nd_ad')).toBe('second_ad');
  });

  it('tåler skitne verdier fra sesjonen', () => {
    expect(resolveSessionProjectRole('  DoP  ')).toBe('camera_team');
    expect(resolveSessionProjectRole('')).toBeNull();
    expect(resolveSessionProjectRole(null)).toBeNull();
    expect(resolveSessionProjectRole(42)).toBeNull();
    expect(resolveSessionProjectRole('tryllekunstner')).toBeNull();
  });

  it('lander kontoroller på nærmeste prosjektrolle', () => {
    expect(resolveSessionProjectRole('owner')).toBe('director');
    expect(resolveSessionProjectRole('super_admin')).toBe('director');
    expect(resolveSessionProjectRole('admin')).toBe('producer');
    expect(resolveSessionProjectRole('client')).toBe('client_reviewer');
    expect(resolveSessionProjectRole('photographer')).toBe('content_producer');
    expect(resolveSessionProjectRole('film_photographer')).toBe('content_producer');
  });

  it('svarer på om en verdi er en gitt rolle, uansett skrivemåte', () => {
    expect(isSessionProjectRole('DP', 'camera_team')).toBe(true);
    expect(isSessionProjectRole('producer', 'camera_team')).toBe(false);
  });
});

describe('katalogen og linseregisteret er enige', () => {
  // To kopier av de samme aliasene kan drive fra hverandre uten at noe sier
  // fra. Her sier noe fra: hver skrivemåte registeret kjenner må også løses av
  // katalogen, til den rollen linsen faktisk tilhører.
  const LENS_EXPECTATION: Record<string, string> = {
    director: 'director',
    cinematography: 'camera_team',
    'production-management': 'production_manager',
    'production-coordination': 'production_coordinator',
    continuity: 'script_supervisor',
  };

  it('løser hver alias i registeret til samme rolle som linsen tilhører', () => {
    for (const entry of WORKSPACE_LENS_REGISTRY) {
      const expected = LENS_EXPECTATION[entry.lens];
      if (!expected) continue;
      for (const alias of entry.projectRoles) {
        expect(resolveSessionProjectRole(alias), `${alias} i linsen ${entry.lens}`).toBe(expected);
        expect(matchesLensProjectRole(entry.lens, alias)).toBe(true);
      }
    }
  });

  it('dekker begge regiassistentene, som deler én linse men er to roller', () => {
    const entry = WORKSPACE_LENS_REGISTRY.find((item) => item.lens === 'assistant-direction');
    const roller = new Set((entry?.projectRoles ?? []).map(resolveSessionProjectRole));
    expect([...roller].sort()).toEqual(['first_ad', 'second_ad']);
  });

  it('løser location-linsens tre roller hver for seg', () => {
    const entry = WORKSPACE_LENS_REGISTRY.find((item) => item.lens === 'location-management');
    expect((entry?.projectRoles ?? []).map(resolveSessionProjectRole)).toEqual([
      'location_manager', 'location_scout', 'location_security',
    ]);
  });
});
