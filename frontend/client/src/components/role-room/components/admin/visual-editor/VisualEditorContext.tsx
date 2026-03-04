/**
 * VisualEditorContext.tsx
 * ─────────────────────────────────────────────────────────────────────────
 * Context for the Role Room visual editor — shared state for editing mode,
 * element selection, and the guide configuration registry.
 * ─────────────────────────────────────────────────────────────────────────
 */

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useCallback } from 'react';
import {
  type GuideId,
  type GuideConfig,
  type GuideStepOverride,
  type GuideRegistry,
  buildDefaultRegistry,
} from './guideTypes';

// ── Storage key ───────────────────────────────────────────────────────────

const STORAGE_KEY = 'roleroom:guide-configs';

function loadRegistry(): GuideRegistry {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as GuideRegistry;
      if (parsed?.configs) return parsed;
    }
  } catch {
    // corrupt — fall through
  }
  return buildDefaultRegistry();
}

// ── Context type ──────────────────────────────────────────────────────────

interface VisualEditorContextType {
  // ─ General editing mode ──────────────────────────────────────────────
  isEditing: boolean;
  setIsEditing: (value: boolean) => void;
  selectedElement: string | null;
  setSelectedElement: (id: string | null) => void;

  // ─ Guide registry ────────────────────────────────────────────────────
  guideRegistry: GuideRegistry;
  getGuideConfig: (id: GuideId) => GuideConfig;
  getStepOverride: (guideId: GuideId, stepId: string) => GuideStepOverride;
  /** Returns sorted+enabled stepIds for end-user consumption. */
  getActiveStepIds: (guideId: GuideId) => string[];
  updateGuideRegistry: (next: GuideRegistry) => void;
  saveGuideRegistry: () => void;
}

// ── Context ───────────────────────────────────────────────────────────────

const VisualEditorContext = createContext<VisualEditorContextType | undefined>(undefined);

// ── Provider ──────────────────────────────────────────────────────────────

export function VisualEditorProvider({ children }: { children: ReactNode }) {
  const [isEditing, setIsEditing] = useState(false);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [guideRegistry, setGuideRegistry] = useState<GuideRegistry>(() => loadRegistry());

  const getGuideConfig = useCallback(
    (id: GuideId): GuideConfig => {
      return guideRegistry.configs[id] ?? buildDefaultRegistry().configs[id];
    },
    [guideRegistry],
  );

  const getStepOverride = useCallback(
    (guideId: GuideId, stepId: string): GuideStepOverride => {
      const cfg = guideRegistry.configs[guideId];
      if (!cfg) return { stepId, enabled: true };
      return cfg.steps.find(s => s.stepId === stepId) ?? { stepId, enabled: true };
    },
    [guideRegistry],
  );

  const getActiveStepIds = useCallback(
    (guideId: GuideId): string[] => {
      const cfg = guideRegistry.configs[guideId];
      if (!cfg) return [];
      return [...cfg.steps]
        .filter(s => s.enabled !== false)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        .map(s => s.stepId);
    },
    [guideRegistry],
  );

  const updateGuideRegistry = useCallback((next: GuideRegistry) => {
    setGuideRegistry(next);
  }, []);

  const saveGuideRegistry = useCallback(() => {
    const stamped: GuideRegistry = { ...guideRegistry, savedAt: new Date().toISOString() };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stamped));
    } catch {
      // storage blocked
    }
    setGuideRegistry(stamped);
  }, [guideRegistry]);

  return (
    <VisualEditorContext.Provider
      value={{
        isEditing,
        setIsEditing,
        selectedElement,
        setSelectedElement,
        guideRegistry,
        getGuideConfig,
        getStepOverride,
        getActiveStepIds,
        updateGuideRegistry,
        saveGuideRegistry,
      }}
    >
      {children}
    </VisualEditorContext.Provider>
  );
}

// ── Consumer hook ─────────────────────────────────────────────────────────

export function useVisualEditor() {
  const context = useContext(VisualEditorContext);
  if (!context) {
    // Safe fallback when used outside the provider
    return {
      isEditing: false,
      setIsEditing: () => {},
      selectedElement: null,
      setSelectedElement: () => {},
      guideRegistry: buildDefaultRegistry(),
      getGuideConfig: (id: GuideId) => buildDefaultRegistry().configs[id],
      getStepOverride: (_guideId: GuideId, stepId: string): GuideStepOverride => ({
        stepId,
        enabled: true,
      }),
      getActiveStepIds: (_guideId: GuideId): string[] => [],
      updateGuideRegistry: () => {},
      saveGuideRegistry: () => {},
    };
  }
  return context;
}
