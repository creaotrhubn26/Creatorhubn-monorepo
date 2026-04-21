import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  EDIT_MODULES,
  settingsKeysNotCoveredByAnyModule,
  type EditModuleKey,
  type EnhancementSettings,
} from '../module-contract';
import { applyClipboardToSettings, diffModules, resetModulesToDefault } from '../edit-clipboard';

const sourceOverrides: Partial<EnhancementSettings> = {
  brightness: 15,
  contrast: -10,
  saturation: 8,
  sharpness: 30,
  denoising: 40,
  faceEnhancement: 85,
  gfpganQuality: 82,
  codeformerFidelity: 55,
  skinTextureGuard: 60,
  teethWhiteness: 25,
  eyeBrightness: 18,
  eyeWhiteness: 12,
  blemishRemoval: 20,
  teethProfile: 'subtle',
  eyeBrightnessProfile: 'strong',
  subject: 'portrait',
  subjectLookStrength: 60,
  realesrganScale: 4,
  swinir: true,
};

const source: EnhancementSettings = { ...DEFAULT_SETTINGS, ...sourceOverrides };

const mods = (...keys: EditModuleKey[]) => new Set<EditModuleKey>(keys);

describe('module-contract invariants', () => {
  it('every EnhancementSettings key is owned by exactly one module', () => {
    expect(settingsKeysNotCoveredByAnyModule()).toEqual([]);
  });

  it('module keys are unique', () => {
    const keys = EDIT_MODULES.map((m) => m.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('applyClipboardToSettings', () => {
  it('returns target unchanged when no modules are selected', () => {
    expect(applyClipboardToSettings(DEFAULT_SETTINGS, source, mods())).toBe(DEFAULT_SETTINGS);
  });

  it('copies only the keys that belong to selected modules', () => {
    const result = applyClipboardToSettings(DEFAULT_SETTINGS, source, mods('color'));
    expect(result.brightness).toBe(15);
    expect(result.contrast).toBe(-10);
    expect(result.saturation).toBe(8);
    expect(result.sharpness).toBe(DEFAULT_SETTINGS.sharpness);
    expect(result.teethWhiteness).toBe(DEFAULT_SETTINGS.teethWhiteness);
  });

  it('carries intensity profiles alongside their sliders', () => {
    const result = applyClipboardToSettings(DEFAULT_SETTINGS, source, mods('portrait'));
    expect(result.teethProfile).toBe('subtle');
    expect(result.eyeBrightnessProfile).toBe('strong');
    expect(result.teethWhiteness).toBe(25);
    expect(result.subject).toBe(DEFAULT_SETTINGS.subject);
  });

  it('composes multiple modules in one pass', () => {
    const result = applyClipboardToSettings(DEFAULT_SETTINGS, source, mods('color', 'subject'));
    expect(result.brightness).toBe(15);
    expect(result.subject).toBe('portrait');
    expect(result.subjectLookStrength).toBe(60);
    expect(result.teethWhiteness).toBe(DEFAULT_SETTINGS.teethWhiteness);
  });

  it('does not mutate the target', () => {
    const target: EnhancementSettings = { ...DEFAULT_SETTINGS };
    applyClipboardToSettings(target, source, mods('color', 'portrait'));
    expect(target).toEqual(DEFAULT_SETTINGS);
  });
});

describe('resetModulesToDefault', () => {
  it('restores defaults for selected modules only', () => {
    const edited: EnhancementSettings = { ...source };
    const result = resetModulesToDefault(edited, mods('color'));
    expect(result.brightness).toBe(DEFAULT_SETTINGS.brightness);
    expect(result.teethWhiteness).toBe(source.teethWhiteness);
  });
});

describe('diffModules', () => {
  it('returns empty when both settings are equal', () => {
    expect(diffModules(DEFAULT_SETTINGS, DEFAULT_SETTINGS)).toEqual([]);
  });

  it('flags every module that has at least one changed key', () => {
    const changed = diffModules(DEFAULT_SETTINGS, source);
    expect(changed).toEqual(expect.arrayContaining(['color', 'detail', 'face', 'portrait', 'subject', 'model']));
  });

  it('does not duplicate modules when multiple keys inside it changed', () => {
    const changed = diffModules(DEFAULT_SETTINGS, source);
    expect(new Set(changed).size).toBe(changed.length);
  });
});
