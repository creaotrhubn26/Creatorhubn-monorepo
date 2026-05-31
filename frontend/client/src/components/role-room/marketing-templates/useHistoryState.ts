/**
 * useHistoryState — drop-in erstatter for useState som beholder en
 * stack-historikk så undo/redo kan tilbakestille verdier. Cap'd så
 * memory ikke ballooner ved langvarig redigering.
 *
 * canUndo/canRedo synkroniseres via et lite counter-state så React
 * re-rendrer når historikken endrer seg (refs alene ville ikke
 * trigget toolbar-knapp-disabled-state).
 *
 * Usage:
 *   const [value, set, history] = useHistoryState(initial, { cap: 50 });
 *   history.canUndo / history.canRedo / history.undo() / history.redo()
 */

import { useCallback, useMemo, useRef, useState } from 'react';

export interface HistoryControl<T> {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  reset: (next: T) => void;
}

export interface UseHistoryOptions {
  cap?: number;
}

export function useHistoryState<T>(
  initial: T,
  options: UseHistoryOptions = {},
): [T, (next: T | ((prev: T) => T)) => void, HistoryControl<T>] {
  const cap = options.cap ?? 50;
  const [value, setValueState] = useState<T>(initial);
  const past = useRef<T[]>([]);
  const future = useRef<T[]>([]);
  // Counter som incrementeres ved hver mutasjon for å trigge re-render
  // så canUndo/canRedo oppdateres på toolbar-knappene.
  const [version, setVersion] = useState(0);
  const bumpVersion = useCallback(() => setVersion((n) => n + 1), []);

  const setValue = useCallback(
    (nextOrFn: T | ((prev: T) => T)) => {
      setValueState((prev) => {
        const next = typeof nextOrFn === 'function'
          ? (nextOrFn as (p: T) => T)(prev)
          : nextOrFn;
        if (Object.is(next, prev)) return prev;
        past.current.push(prev);
        if (past.current.length > cap) past.current.shift();
        future.current = [];
        return next;
      });
      bumpVersion();
    },
    [cap, bumpVersion],
  );

  const undo = useCallback(() => {
    if (past.current.length === 0) return;
    setValueState((current) => {
      const previous = past.current.pop();
      if (previous === undefined) return current;
      future.current.push(current);
      if (future.current.length > cap) future.current.shift();
      return previous;
    });
    bumpVersion();
  }, [cap, bumpVersion]);

  const redo = useCallback(() => {
    if (future.current.length === 0) return;
    setValueState((current) => {
      const next = future.current.pop();
      if (next === undefined) return current;
      past.current.push(current);
      if (past.current.length > cap) past.current.shift();
      return next;
    });
    bumpVersion();
  }, [cap, bumpVersion]);

  const reset = useCallback((next: T) => {
    past.current = [];
    future.current = [];
    setValueState(next);
    bumpVersion();
  }, [bumpVersion]);

  const control = useMemo<HistoryControl<T>>(() => ({
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    undo,
    redo,
    reset,
  // version is what forces re-eval of canUndo/canRedo
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [undo, redo, reset, version]);

  return [value, setValue, control];
}
