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
    expect(resolveSessionProjectRole('2nd_2nd_ad')).toBe('second_second_assistant_director');
    expect(resolveSessionProjectRole('set_pa')).toBe('set_production_assistant');
    expect(resolveSessionProjectRole('office_pa')).toBe('office_production_assistant');
    expect(resolveSessionProjectRole('local_casting_director')).toBe('local_casting_director');
    expect(resolveSessionProjectRole('property_master')).toBe('production_designer');
    expect(resolveSessionProjectRole('sound_engineer')).toBe('production_sound_mixer');
    expect(resolveSessionProjectRole('boom_operator')).toBe('production_sound_mixer');
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
  it('løser hver rolle i linseregisteret gjennom den kanoniske rollekatalogen', () => {
    for (const entry of WORKSPACE_LENS_REGISTRY) {
      for (const alias of entry.projectRoles) {
        expect(resolveSessionProjectRole(alias), `${alias} i linsen ${entry.lens}`).not.toBeNull();
        expect(matchesLensProjectRole(entry.lens, alias)).toBe(true);
      }
    }
  });

  it('dekker hele regiassistentlinjen i den delte arbeidsflaten', () => {
    const entry = WORKSPACE_LENS_REGISTRY.find((item) => item.lens === 'assistant-direction');
    const roller = new Set((entry?.projectRoles ?? []).map(resolveSessionProjectRole));
    expect([...roller].sort()).toEqual([
      'first_ad',
      'second_ad',
      'second_second_assistant_director',
      'set_production_assistant',
    ]);
  });

  it('løser location-linsens tre roller hver for seg', () => {
    const entry = WORKSPACE_LENS_REGISTRY.find((item) => item.lens === 'location-management');
    expect((entry?.projectRoles ?? []).map(resolveSessionProjectRole)).toEqual([
      'location_manager', 'location_scout', 'location_security',
    ]);
  });

  it('samler art-avdelingens fagroller under produksjonsdesignerens prosjektrolle', () => {
    const entry = WORKSPACE_LENS_REGISTRY.find((item) => item.lens === 'art-department');
    expect(new Set((entry?.projectRoles ?? []).map(resolveSessionProjectRole))).toEqual(new Set(['production_designer']));
  });

  it('samler opptakslyd under lydmikserens prosjektrolle', () => {
    const entry = WORKSPACE_LENS_REGISTRY.find((item) => item.lens === 'production-sound');
    expect(new Set((entry?.projectRoles ?? []).map(resolveSessionProjectRole))).toEqual(new Set(['production_sound_mixer']));
  });
});
