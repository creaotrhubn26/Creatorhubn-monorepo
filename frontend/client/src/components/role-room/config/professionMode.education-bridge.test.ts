// @vitest-environment node
import { describe, expect, it, beforeEach, afterEach } from 'vitest';

import {
  professionRoleToMode,
  applyProfessionModeFromRole,
  hasStoredProfessionMode,
  getActiveProfessionMode,
} from './professionMode';

// ── Ren mapping ──────────────────────────────────────────────────────────────

describe('professionRoleToMode', () => {
  it('education-signaler → education (case-insensitivt)', () => {
    for (const r of ['education', 'Education', 'education_institution', 'educational_institution', 'utdanning', 'utdanningsinstitusjon', 'SKOLE']) {
      expect(professionRoleToMode(r)).toBe('education');
    }
  });
  it('ikke-education / ukjent → null (uendret for eksisterende personaer)', () => {
    for (const r of ['photographer', 'production', 'dance_studio', 'random', '']) {
      expect(professionRoleToMode(r)).toBeNull();
    }
  });
  it('null/undefined → null', () => {
    expect(professionRoleToMode(null)).toBeNull();
    expect(professionRoleToMode(undefined)).toBeNull();
  });
});

// ── applyProfessionModeFromRole (fake window.localStorage) ───────────────────

describe('applyProfessionModeFromRole', () => {
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    (globalThis as { window?: unknown }).window = {
      localStorage: {
        getItem: (k: string) => (k in store ? store[k] : null),
        setItem: (k: string, v: string) => { store[k] = v; },
        removeItem: (k: string) => { delete store[k]; },
      },
      location: { search: '' },
    };
  });
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it('education-rolle uten eksplisitt modus → aktiverer education (persistert)', () => {
    expect(applyProfessionModeFromRole('education')).toBe(true);
    expect(store['role_room_profession_mode']).toBe('education');
    expect(getActiveProfessionMode()).toBe('education');
  });

  it('eksplisitt modus-valg vinner → no-op', () => {
    store['role_room_profession_mode'] = 'production';
    expect(applyProfessionModeFromRole('education')).toBe(false);
    expect(store['role_room_profession_mode']).toBe('production');
  });

  it('ikke-education rolle → no-op (rører ikke eksisterende personaer)', () => {
    expect(applyProfessionModeFromRole('photographer')).toBe(false);
    expect(store['role_room_profession_mode']).toBeUndefined();
  });

  it('null rolle → no-op', () => {
    expect(applyProfessionModeFromRole(null)).toBe(false);
    expect(store['role_room_profession_mode']).toBeUndefined();
  });

  it('hasStoredProfessionMode: true kun for gyldig lagret modus', () => {
    expect(hasStoredProfessionMode()).toBe(false);
    store['role_room_profession_mode'] = 'education';
    expect(hasStoredProfessionMode()).toBe(true);
    store['role_room_profession_mode'] = 'tull';
    expect(hasStoredProfessionMode()).toBe(false);
  });
});
