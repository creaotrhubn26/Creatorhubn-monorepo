// ============================================
// useSceneHistory — patch-based undo/redo (command pattern)
// ============================================
// Instead of storing full SceneBreakdown[][] snapshots,
// stores lightweight patches describing what changed.
// Supports: single edits, reorders, batch grouping, max cap.
// ============================================

import { useState, useCallback, useRef } from 'react';
import type { SceneBreakdown } from '../../models/casting';

// ---- Patch types (discriminated union) ----

export type ScenePatch =
  | { type: 'updateScene'; id: string; before: Partial<SceneBreakdown>; after: Partial<SceneBreakdown> }
  | { type: 'reorderScenes'; beforeOrder: string[]; afterOrder: string[] }
  | { type: 'deleteScene'; scene: SceneBreakdown; index: number }
  | { type: 'createScene'; scene: SceneBreakdown; index: number }
  | { type: 'batch'; label: string; patches: ScenePatch[] };

// ---- Constants ----

const MAX_HISTORY = 50;

// ---- Hook ----

export interface UseSceneHistoryReturn {
  /** Push a patch (auto-truncates redo branch) */
  pushPatch: (patch: ScenePatch) => void;
  /** Undo last patch — returns new scenes or null if nothing to undo */
  undo: (currentScenes: SceneBreakdown[]) => SceneBreakdown[] | null;
  /** Redo next patch — returns new scenes or null if nothing to redo */
  redo: (currentScenes: SceneBreakdown[]) => SceneBreakdown[] | null;
  /** Can undo? */
  canUndo: boolean;
  /** Can redo? */
  canRedo: boolean;
  /** Number of undo steps available */
  undoCount: number;
  /** Last patch description (for UI) */
  lastPatchLabel: string | null;
  /** Reset history (e.g. when scenes prop is replaced externally) */
  reset: () => void;
}

/**
 * Apply a single patch forward (redo direction) to scenes array
 */
function applyPatchForward(scenes: SceneBreakdown[], patch: ScenePatch): SceneBreakdown[] {
  switch (patch.type) {
    case 'updateScene':
      return scenes.map(s => s.id === patch.id ? { ...s, ...patch.after } : s);

    case 'reorderScenes': {
      const byId = new Map(scenes.map(s => [s.id, s]));
      return patch.afterOrder
        .map(id => byId.get(id))
        .filter((s): s is SceneBreakdown => !!s);
    }

    case 'deleteScene':
      return scenes.filter(s => s.id !== patch.scene.id);

    case 'createScene': {
      const result = [...scenes];
      result.splice(patch.index, 0, patch.scene);
      return result;
    }

    case 'batch':
      return patch.patches.reduce(applyPatchForward, scenes);
  }
}

/**
 * Apply a single patch backward (undo direction) to scenes array
 */
function applyPatchBackward(scenes: SceneBreakdown[], patch: ScenePatch): SceneBreakdown[] {
  switch (patch.type) {
    case 'updateScene':
      return scenes.map(s => s.id === patch.id ? { ...s, ...patch.before } : s);

    case 'reorderScenes': {
      const byId = new Map(scenes.map(s => [s.id, s]));
      return patch.beforeOrder
        .map(id => byId.get(id))
        .filter((s): s is SceneBreakdown => !!s);
    }

    case 'deleteScene': {
      const result = [...scenes];
      result.splice(patch.index, 0, patch.scene);
      return result;
    }

    case 'createScene':
      return scenes.filter(s => s.id !== patch.scene.id);

    case 'batch':
      // Undo in reverse order
      return [...patch.patches].reverse().reduce(applyPatchBackward, scenes);
  }
}

/**
 * Get human-readable label for a patch
 */
function getPatchLabel(patch: ScenePatch): string {
  switch (patch.type) {
    case 'updateScene': return `Update scene`;
    case 'reorderScenes': return `Reorder scenes`;
    case 'deleteScene': return `Delete scene ${patch.scene.sceneNumber}`;
    case 'createScene': return `Create scene ${patch.scene.sceneNumber}`;
    case 'batch': return patch.label;
  }
}

export function useSceneHistory(): UseSceneHistoryReturn {
  const [patches, setPatches] = useState<ScenePatch[]>([]);
  const [index, setIndex] = useState(0); // Points AFTER the last applied patch
  const patchesRef = useRef(patches);
  const indexRef = useRef(index);

  // Keep refs in sync for callbacks
  patchesRef.current = patches;
  indexRef.current = index;

  const pushPatch = useCallback((patch: ScenePatch) => {
    setPatches(prev => {
      // Truncate any redo branch
      const truncated = prev.slice(0, indexRef.current);
      truncated.push(patch);
      // Cap at MAX_HISTORY
      if (truncated.length > MAX_HISTORY) {
        const overflow = truncated.length - MAX_HISTORY;
        const capped = truncated.slice(overflow);
        // Adjust index to account for removed items
        setIndex(capped.length);
        return capped;
      }
      setIndex(truncated.length);
      return truncated;
    });
  }, []);

  const undo = useCallback((currentScenes: SceneBreakdown[]): SceneBreakdown[] | null => {
    const i = indexRef.current;
    const p = patchesRef.current;
    if (i <= 0) return null;
    const patch = p[i - 1];
    const result = applyPatchBackward(currentScenes, patch);
    setIndex(i - 1);
    return result;
  }, []);

  const redo = useCallback((currentScenes: SceneBreakdown[]): SceneBreakdown[] | null => {
    const i = indexRef.current;
    const p = patchesRef.current;
    if (i >= p.length) return null;
    const patch = p[i];
    const result = applyPatchForward(currentScenes, patch);
    setIndex(i + 1);
    return result;
  }, []);

  const reset = useCallback(() => {
    setPatches([]);
    setIndex(0);
  }, []);

  return {
    pushPatch,
    undo,
    redo,
    canUndo: index > 0,
    canRedo: index < patches.length,
    undoCount: index,
    lastPatchLabel: index > 0 ? getPatchLabel(patches[index - 1]) : null,
    reset,
  };
}
