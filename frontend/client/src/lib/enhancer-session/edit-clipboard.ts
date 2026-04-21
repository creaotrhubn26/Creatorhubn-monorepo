import {
  EDIT_MODULES,
  DEFAULT_SETTINGS,
  cloneHsl,
  cloneLut,
  type EditModuleKey,
  type EnhancementSettings,
} from './module-contract';

/**
 * Selective paste — merge a subset of module slices from `source` onto
 * `target`. Unchecked modules leave `target` values untouched. Unknown
 * module keys are ignored (safe against vocabulary drift).
 *
 * Returns a new settings object; never mutates `target`.
 */
export function applyClipboardToSettings(
  target: EnhancementSettings,
  source: EnhancementSettings,
  modules: ReadonlySet<EditModuleKey>,
): EnhancementSettings {
  if (modules.size === 0) return target;
  const next: EnhancementSettings = { ...target };
  for (const mod of EDIT_MODULES) {
    if (!modules.has(mod.key)) continue;
    for (const key of mod.settingsKeys) {
      assignTyped(next, source, key);
    }
  }
  return next;
}

/**
 * Reset a subset of modules back to defaults. Useful for "revert color
 * edits" on a per-image basis.
 */
export function resetModulesToDefault(
  target: EnhancementSettings,
  modules: ReadonlySet<EditModuleKey>,
): EnhancementSettings {
  if (modules.size === 0) return target;
  const next: EnhancementSettings = { ...target };
  for (const mod of EDIT_MODULES) {
    if (!modules.has(mod.key)) continue;
    for (const key of mod.settingsKeys) {
      assignTyped(next, DEFAULT_SETTINGS, key);
    }
  }
  return next;
}

/** Returns the set of modules whose values differ between a and b. */
export function diffModules(a: EnhancementSettings, b: EnhancementSettings): EditModuleKey[] {
  const changed: EditModuleKey[] = [];
  for (const mod of EDIT_MODULES) {
    for (const key of mod.settingsKeys) {
      if (!settingsValuesEqual(a[key], b[key])) {
        changed.push(mod.key);
        break;
      }
    }
  }
  return changed;
}

function settingsValuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    // Shallow-structural compare — HSL is two levels deep so we walk the
    // bands explicitly. Good enough for the nesting we actually use; if
    // a future settings key introduces deeper nesting, extend here.
    const ao = a as Record<string, unknown>;
    const bo = b as Record<string, unknown>;
    const keys = new Set([...Object.keys(ao), ...Object.keys(bo)]);
    for (const key of keys) {
      if (!settingsValuesEqual(ao[key], bo[key])) return false;
    }
    return true;
  }
  return false;
}

function assignTyped<K extends keyof EnhancementSettings>(
  target: EnhancementSettings,
  source: EnhancementSettings,
  key: K,
): void {
  // Nested objects (hsl) need deep-copy so paste doesn't alias the
  // clipboard reference — a subsequent edit on the target would otherwise
  // bleed back into every other image that pasted from the same source.
  if (key === 'hsl') {
    target.hsl = cloneHsl(source.hsl);
    return;
  }
  if (key === 'lut') {
    target.lut = cloneLut(source.lut);
    return;
  }
  target[key] = source[key];
}
