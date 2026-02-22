/**
 * useGuideConfig.ts
 * ─────────────────────────────────────────────────────────────────────────
 * React hook for reading and writing Role Room guide configuration.
 *
 * Persists to localStorage under the key `roleroom:guide-configs`.
 * The hook is safe to call from any component — it always returns a valid
 * registry (falls back to defaults when localStorage is empty or corrupt).
 *
 * Usage (read-only, e.g. inside a guide dialog):
 *   const { getConfig, getStepOverride } = useGuideConfig();
 *
 * Usage (admin editor):
 *   const { registry, updateGuideField, setStepOverride, reorderSteps, save } = useGuideConfig();
 * ─────────────────────────────────────────────────────────────────────────
 */

import { useState, useCallback, useMemo } from 'react';
import {
  type GuideId,
  type GuideConfig,
  type GuideStepOverride,
  type GuideRegistry,
  buildDefaultRegistry,
} from './guideTypes';

const STORAGE_KEY = 'roleroom:guide-configs';

// ── Helpers ───────────────────────────────────────────────────────────────

function loadRegistry(): GuideRegistry {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as GuideRegistry;
      if (parsed?.configs) return parsed;
    }
  } catch {
    // corrupt storage — fall through to defaults
  }
  return buildDefaultRegistry();
}

function saveRegistry(reg: GuideRegistry): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reg));
  } catch {
    // storage full or blocked — silently ignore
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useGuideConfig() {
  const [registry, setRegistry] = useState<GuideRegistry>(() => loadRegistry());

  // ── Read helpers ──────────────────────────────────────────────────────

  /** Returns the GuideConfig for a given guide, guaranteed non-null. */
  const getConfig = useCallback(
    (id: GuideId): GuideConfig => {
      return registry.configs[id] ?? buildDefaultRegistry().configs[id];
    },
    [registry],
  );

  /**
   * Returns the step override record for a given guide + step.
   * If no override exists returns a safe default (enabled, no note).
   */
  const getStepOverride = useCallback(
    (guideId: GuideId, stepId: string): GuideStepOverride => {
      const cfg = registry.configs[guideId];
      if (!cfg) return { stepId, enabled: true };
      return cfg.steps.find(s => s.stepId === stepId) ?? { stepId, enabled: true };
    },
    [registry],
  );

  /**
   * Returns the sorted, filtered step overrides for a guide.
   * Disabled steps are excluded. Useful inside guide dialogs.
   */
  const getActiveStepIds = useCallback(
    (guideId: GuideId): string[] => {
      const cfg = registry.configs[guideId];
      if (!cfg) return [];
      return [...cfg.steps]
        .filter(s => s.enabled)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        .map(s => s.stepId);
    },
    [registry],
  );

  // ── Mutate helpers (used by GuideEditorPanel) ─────────────────────────

  /** Mutate and sync registry state. */
  const mutate = useCallback((updater: (prev: GuideRegistry) => GuideRegistry) => {
    setRegistry(prev => {
      const next = updater(prev);
      return next;
    });
  }, []);

  /** Toggle the entire guide on/off for end-users. */
  const toggleGuide = useCallback(
    (id: GuideId) => {
      mutate(prev => ({
        ...prev,
        configs: {
          ...prev.configs,
          [id]: {
            ...prev.configs[id],
            enabled: !prev.configs[id]?.enabled,
            lastModified: new Date().toISOString(),
          },
        },
      }));
    },
    [mutate],
  );

  /** Update any top-level field on a GuideConfig (except `id` and `steps`). */
  const updateGuideField = useCallback(
    <K extends Exclude<keyof GuideConfig, 'id' | 'steps'>>(
      id: GuideId,
      field: K,
      value: GuideConfig[K],
    ) => {
      mutate(prev => ({
        ...prev,
        configs: {
          ...prev.configs,
          [id]: {
            ...prev.configs[id],
            [field]: value,
            lastModified: new Date().toISOString(),
          },
        },
      }));
    },
    [mutate],
  );

  /** Upsert a step override for a given guide. */
  const setStepOverride = useCallback(
    (guideId: GuideId, partial: Partial<GuideStepOverride> & { stepId: string }) => {
      mutate(prev => {
        const cfg = prev.configs[guideId];
        if (!cfg) return prev;
        const existing = cfg.steps.findIndex(s => s.stepId === partial.stepId);
        const updated: GuideStepOverride[] =
          existing >= 0
            ? cfg.steps.map((s, i) => (i === existing ? { ...s, ...partial } : s))
            : [...cfg.steps, { enabled: true, ...partial }];
        return {
          ...prev,
          configs: {
            ...prev.configs,
            [guideId]: { ...cfg, steps: updated, lastModified: new Date().toISOString() },
          },
        };
      });
    },
    [mutate],
  );

  /**
   * Move a step to a new sort position within a guide.
   * @param fromIdx zero-based index in the current sorted list
   * @param toIdx   zero-based target index
   */
  const reorderSteps = useCallback(
    (guideId: GuideId, fromIdx: number, toIdx: number) => {
      mutate(prev => {
        const cfg = prev.configs[guideId];
        if (!cfg) return prev;
        const sorted = [...cfg.steps].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        const [moved] = sorted.splice(fromIdx, 1);
        sorted.splice(toIdx, 0, moved);
        const reassigned = sorted.map((s, i) => ({ ...s, sortOrder: i }));
        return {
          ...prev,
          configs: {
            ...prev.configs,
            [guideId]: { ...cfg, steps: reassigned, lastModified: new Date().toISOString() },
          },
        };
      });
    },
    [mutate],
  );

  /** Persist the current in-memory registry to localStorage. */
  const save = useCallback(() => {
    const stamped: GuideRegistry = { ...registry, savedAt: new Date().toISOString() };
    saveRegistry(stamped);
    setRegistry(stamped);
    return stamped.savedAt;
  }, [registry]);

  /** Export the registry as a pretty-printed JSON string. */
  const exportJson = useCallback((): string => {
    return JSON.stringify(registry, null, 2);
  }, [registry]);

  /** Import a registry from a JSON string (validation included). */
  const importJson = useCallback(
    (json: string): { ok: boolean; error?: string } => {
      try {
        const parsed = JSON.parse(json) as GuideRegistry;
        if (!parsed?.configs) return { ok: false, error: 'Missing "configs" key.' };
        const stamped: GuideRegistry = { ...parsed, savedAt: new Date().toISOString() };
        saveRegistry(stamped);
        setRegistry(stamped);
        return { ok: true };
      } catch (e) {
        return { ok: false, error: String(e) };
      }
    },
    [],
  );

  /** Reset all configs to factory defaults. */
  const resetToDefaults = useCallback(() => {
    const defaults = buildDefaultRegistry();
    saveRegistry(defaults);
    setRegistry(defaults);
  }, []);

  // ── Derived stats for the editor header ──────────────────────────────

  const stats = useMemo(() => {
    let totalSteps = 0;
    let disabledSteps = 0;
    let guidesWithNotes = 0;
    for (const cfg of Object.values(registry.configs)) {
      for (const s of cfg.steps) {
        totalSteps++;
        if (!s.enabled) disabledSteps++;
      }
      if (cfg.steps.some(s => s.adminNote)) guidesWithNotes++;
    }
    return { totalSteps, disabledSteps, guidesWithNotes };
  }, [registry]);

  return {
    registry,
    getConfig,
    getStepOverride,
    getActiveStepIds,
    toggleGuide,
    updateGuideField,
    setStepOverride,
    reorderSteps,
    save,
    exportJson,
    importJson,
    resetToDefaults,
    stats,
  };
}
