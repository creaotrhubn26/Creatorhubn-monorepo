/**
 * SelectionService - Centralized selection state management
 * 
 * Features:
 * - Single source of truth for selection
 * - Multi-select support
 * - Selection history
 * - Event-driven updates
 * - Cross-panel synchronization
 */

import * as THREE from 'three';

// ============================================================================
// Types
// ============================================================================

export interface SelectionState {
  selectedIds: string[];
  lastSelectedId: string | null;
  selectionMode: 'single' | 'multi' | 'additive';
  hoveredId: string | null;
  focusedId: string | null;
}

export interface SelectionEvent {
  type: 'select' | 'deselect' | 'toggle' | 'clear' | 'hover' | 'focus';
  ids: string[];
  source: string; // Which panel triggered the selection
  additive: boolean;
}

export type SelectionListener = (state: SelectionState, event?: SelectionEvent) => void;

// ============================================================================
// Selection Service
// ============================================================================

class SelectionService {
  private state: SelectionState = {
    selectedIds: [],
    lastSelectedId: null,
    selectionMode: 'single',
    hoveredId: null,
    focusedId: null,
  };

  private listeners: Set<SelectionListener> = new Set();
  private selectionHistory: string[][] = [];
  private maxHistory = 20;

  // -------------------------------------------------------------------------
  // State Access
  // -------------------------------------------------------------------------

  getState(): SelectionState {
    return { ...this.state };
  }

  getSelectedIds(): string[] {
    return [...this.state.selectedIds];
  }

  isSelected(id: string): boolean {
    return this.state.selectedIds.includes(id);
  }

  getSelectionCount(): number {
    return this.state.selectedIds.length;
  }

  hasSelection(): boolean {
    return this.state.selectedIds.length > 0;
  }

  // -------------------------------------------------------------------------
  // Selection Operations
  // -------------------------------------------------------------------------

  select(ids: string | string[], source = 'unknown', additive = false): void {
    const idsArray = Array.isArray(ids) ? ids : [ids];
    
    // Save current state to history
    this.pushHistory();

    let newSelectedIds: string[];
    
    if (additive || this.state.selectionMode === 'additive') {
      // Add to existing selection
      newSelectedIds = [...new Set([...this.state.selectedIds, ...idsArray])];
    } else if (this.state.selectionMode === 'multi') {
      // Multi-select mode (toggle each)
      newSelectedIds = [...this.state.selectedIds];
      idsArray.forEach((id) => {
        const index = newSelectedIds.indexOf(id);
        if (index === -1) {
          newSelectedIds.push(id);
        }
      });
    } else {
      // Single select mode (replace)
      newSelectedIds = idsArray;
    }

    this.state = {
      ...this.state,
      selectedIds: newSelectedIds,
      lastSelectedId: idsArray[idsArray.length - 1],
    };

    this.notify({
      type: 'select',
      ids: idsArray,
      source,
      additive,
    });

    // Dispatch DOM event for components not using React
    this.dispatchDOMEvent('select', idsArray);
  }

  deselect(ids: string | string[], source = 'unknown'): void {
    const idsArray = Array.isArray(ids) ? ids : [ids];
    
    this.pushHistory();

    const newSelectedIds = this.state.selectedIds.filter((id) => !idsArray.includes(id));

    this.state = {
      ...this.state,
      selectedIds: newSelectedIds,
      lastSelectedId: newSelectedIds[newSelectedIds.length - 1] || null,
    };

    this.notify({
      type: 'deselect',
      ids: idsArray,
      source,
      additive: false,
    });

    this.dispatchDOMEvent('deselect', idsArray);
  }

  toggle(ids: string | string[], source = 'unknown'): void {
    const idsArray = Array.isArray(ids) ? ids : [ids];
    
    this.pushHistory();

    const newSelectedIds = [...this.state.selectedIds];
    
    idsArray.forEach((id) => {
      const index = newSelectedIds.indexOf(id);
      if (index === -1) {
        newSelectedIds.push(id);
      } else {
        newSelectedIds.splice(index, 1);
      }
    });

    this.state = {
      ...this.state,
      selectedIds: newSelectedIds,
      lastSelectedId: newSelectedIds[newSelectedIds.length - 1] || null,
    };

    this.notify({
      type: 'toggle',
      ids: idsArray,
      source,
      additive: false,
    });

    this.dispatchDOMEvent('toggle', idsArray);
  }

  clear(source = 'unknown'): void {
    if (this.state.selectedIds.length === 0) return;
    
    this.pushHistory();

    const oldIds = [...this.state.selectedIds];

    this.state = {
      ...this.state,
      selectedIds: [],
      lastSelectedId: null,
    };

    this.notify({
      type: 'clear',
      ids: oldIds,
      source,
      additive: false,
    });

    this.dispatchDOMEvent('clear', oldIds);
  }

  selectAll(allIds: string[], source = 'unknown'): void {
    this.pushHistory();

    this.state = {
      ...this.state,
      selectedIds: [...allIds],
      lastSelectedId: allIds[allIds.length - 1] || null,
    };

    this.notify({
      type: 'select',
      ids: allIds,
      source,
      additive: false,
    });

    this.dispatchDOMEvent('select', allIds);
  }

  // -------------------------------------------------------------------------
  // Hover/Focus
  // -------------------------------------------------------------------------

  setHovered(id: string | null, source = 'unknown'): void {
    if (this.state.hoveredId === id) return;

    this.state = {
      ...this.state,
      hoveredId: id,
    };

    this.notify({
      type: 'hover',
      ids: id ? [id] : [],
      source,
      additive: false,
    });
  }

  setFocused(id: string | null, source = 'unknown'): void {
    if (this.state.focusedId === id) return;

    this.state = {
      ...this.state,
      focusedId: id,
    };

    this.notify({
      type: 'focus',
      ids: id ? [id] : [],
      source,
      additive: false,
    });
  }

  // -------------------------------------------------------------------------
  // Selection Mode
  // -------------------------------------------------------------------------

  setSelectionMode(mode: 'single' | 'multi' | 'additive'): void {
    this.state = {
      ...this.state,
      selectionMode: mode,
    };
    this.notify();
  }

  getSelectionMode(): 'single' | 'multi' | 'additive' {
    return this.state.selectionMode;
  }

  // -------------------------------------------------------------------------
  // History
  // -------------------------------------------------------------------------

  private pushHistory(): void {
    this.selectionHistory.push([...this.state.selectedIds]);
    if (this.selectionHistory.length > this.maxHistory) {
      this.selectionHistory.shift();
    }
  }

  undoSelection(source = 'history'): boolean {
    if (this.selectionHistory.length === 0) return false;

    const previousSelection = this.selectionHistory.pop()!;
    
    this.state = {
      ...this.state,
      selectedIds: previousSelection,
      lastSelectedId: previousSelection[previousSelection.length - 1] || null,
    };

    this.notify({
      type: 'select',
      ids: previousSelection,
      source,
      additive: false,
    });

    return true;
  }

  // -------------------------------------------------------------------------
  // Subscription
  // -------------------------------------------------------------------------

  subscribe(listener: SelectionListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify(event?: SelectionEvent): void {
    const state = this.getState();
    this.listeners.forEach((listener) => listener(state, event));
  }

  // -------------------------------------------------------------------------
  // DOM Events (for non-React components)
  // -------------------------------------------------------------------------

  private dispatchDOMEvent(type: string, ids: string[]): void {
    window.dispatchEvent(
      new CustomEvent('vs-selection', {
        detail: { type, ids, state: this.getState() },
      })
    );
  }

  // -------------------------------------------------------------------------
  // Utilities
  // -------------------------------------------------------------------------

  getSelectionBounds(getPosition: (id: string) => THREE.Vector3 | null): THREE.Box3 | null {
    if (this.state.selectedIds.length === 0) return null;

    const box = new THREE.Box3();
    let hasValidPosition = false;

    this.state.selectedIds.forEach((id) => {
      const pos = getPosition(id);
      if (pos) {
        box.expandByPoint(pos);
        hasValidPosition = true;
      }
    });

    return hasValidPosition ? box : null;
  }

  getSelectionCenter(getPosition: (id: string) => THREE.Vector3 | null): THREE.Vector3 | null {
    const bounds = this.getSelectionBounds(getPosition);
    if (!bounds) return null;

    const center = new THREE.Vector3();
    bounds.getCenter(center);
    return center;
  }
}

// ============================================================================
// React Hook
// ============================================================================

import { useState, useEffect, useCallback } from 'react';

export function useSelection(source ='unknown') {
  const [state, setState] = useState<SelectionState>(selectionService.getState());

  useEffect(() => {
    return selectionService.subscribe(setState);
  }, []);

  const select = useCallback(
    (ids: string | string[], additive = false) => {
      selectionService.select(ids, source, additive);
    },
    [source]
  );

  const deselect = useCallback(
    (ids: string | string[]) => {
      selectionService.deselect(ids, source);
    },
    [source]
  );

  const toggle = useCallback(
    (ids: string | string[]) => {
      selectionService.toggle(ids, source);
    },
    [source]
  );

  const clear = useCallback(() => {
    selectionService.clear(source);
  }, [source]);

  const setHovered = useCallback(
    (id: string | null) => {
      selectionService.setHovered(id, source);
    },
    [source]
  );

  const setFocused = useCallback(
    (id: string | null) => {
      selectionService.setFocused(id, source);
    },
    [source]
  );

  return {
    ...state,
    select,
    deselect,
    toggle,
    clear,
    setHovered,
    setFocused,
    isSelected: (id: string) => state.selectedIds.includes(id),
    isHovered: (id: string) => state.hoveredId === id,
    isFocused: (id: string) => state.focusedId === id,
  };
}

// Export singleton
export const selectionService = new SelectionService();

export default selectionService;

