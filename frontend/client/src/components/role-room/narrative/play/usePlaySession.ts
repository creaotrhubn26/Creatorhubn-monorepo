/**
 * usePlaySession — React-innpakning rundt den rene spillmotoren.
 *
 * Sesjonen bygges fra grafen slik den var ved start og holdes i en ref, så
 * redigeringer i andre faner ikke drar teppet vekk midt i en gjennomspilling.
 * Når grafen endres, settes `stale` og brukeren kan starte på nytt.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPlaySession, type PlaySession, type PlayState, type PlayView } from '@shared/narrative-runtime';
import { applyLocaleToGraph } from '@shared/narrative-format';
import type { ScriptValue } from '@shared/narrative-script';
import type { NarrativeGraph } from '../narrativeTypes';

export interface UsePlaySessionResult {
  view: PlayView | null;
  state: PlayState;
  variableDefs: Array<{ name: string; type: string }>;
  stale: boolean;
  started: boolean;
  start: () => void;
  choose: (connectionId: string) => void;
  back: () => void;
  canBack: boolean;
  restart: () => void;
  setVariable: (name: string, value: ScriptValue) => void;
  /** Bygg sesjonen på nytt fra gjeldende graf (etter redigering). */
  rebuild: () => void;
}

const EMPTY_STATE: PlayState = { variables: {}, visits: {}, historyDepth: 0, log: [] };

export function usePlaySession(sourceGraph: NarrativeGraph, locale: string | null = null): UsePlaySessionResult {
  // Spill på valgt språk: overrides + kildens skript (applyLocaleToGraph er identitet for nb).
  const graph = useMemo(() => applyLocaleToGraph(sourceGraph, locale), [sourceGraph, locale]);
  const sessionRef = useRef<PlaySession | null>(null);
  const graphAtBuild = useRef<NarrativeGraph | null>(null);
  const [tick, setTick] = useState(0);
  const [started, setStarted] = useState(false);

  const ensureSession = useCallback((): PlaySession => {
    if (!sessionRef.current) {
      sessionRef.current = createPlaySession(graph);
      graphAtBuild.current = graph;
    }
    return sessionRef.current;
  }, [graph]);

  const bump = useCallback(() => setTick((t) => t + 1), []);

  const rebuild = useCallback(() => {
    sessionRef.current = createPlaySession(graph);
    graphAtBuild.current = graph;
    sessionRef.current.start();
    setStarted(true);
    bump();
  }, [graph, bump]);

  const start = useCallback(() => {
    const s = ensureSession();
    s.start();
    setStarted(true);
    bump();
  }, [ensureSession, bump]);

  const choose = useCallback((connectionId: string) => {
    sessionRef.current?.choose(connectionId);
    bump();
  }, [bump]);

  const back = useCallback(() => {
    sessionRef.current?.back();
    bump();
  }, [bump]);

  const restart = useCallback(() => {
    sessionRef.current?.restart();
    bump();
  }, [bump]);

  const setVariable = useCallback((name: string, value: ScriptValue) => {
    sessionRef.current?.setVariable(name, value);
    bump();
  }, [bump]);

  // Første gang: start automatisk så fanen ikke er tom.
  useEffect(() => {
    if (!started && graph.elements.length > 0) start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph.elements.length]);

  const session = sessionRef.current;
  const view = session?.current() ?? null;
  const state = session?.getState() ?? EMPTY_STATE;
  const variableDefs = useMemo(() => session?.getVariableDefs() ?? [], [session, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const stale = graphAtBuild.current !== null && graphAtBuild.current !== graph;

  void tick;
  return {
    view, state, variableDefs, stale, started,
    start, choose, back, canBack: session?.canBack() ?? false, restart, setVariable, rebuild,
  };
}
