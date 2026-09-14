/**
 * useNarrativeGraph — laster hele grafen for et prosjekt (ett kall) og gir
 * optimistiske mutasjoner som skriver gjennom til API-et. Posisjonsendringer
 * batches (debounce) og har angre/gjør om.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as api from '../narrativeService';
import { NarrativeConflictError } from '../narrativeService';
import { emptyGraph, type NarrativeElement, type NarrativeGraph } from '../narrativeTypes';
import * as ops from './graphOps';

const MOVE_DEBOUNCE_MS = 400;
const UNDO_LIMIT = 100;

interface MoveHistoryEntry {
  from: ops.PositionMove[];
  to: ops.PositionMove[];
}

export interface UseNarrativeGraphResult {
  graph: NarrativeGraph;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  /** Erstatt hele grafen lokalt (etter gjenoppretting/import). */
  replaceGraph: (graph: NarrativeGraph) => void;

  updateSettings: (patch: api.SettingsPatch) => Promise<void>;

  createBoard: (input: api.BoardInput) => Promise<string>;
  patchBoard: (boardId: string, patch: Partial<api.BoardInput>) => Promise<void>;
  deleteBoard: (boardId: string) => Promise<void>;

  createElement: (input: api.ElementInput) => Promise<NarrativeElement>;
  patchElement: (elementId: string, patch: api.ElementPatch) => Promise<NarrativeElement>;
  deleteElement: (elementId: string) => Promise<void>;
  moveElements: (moves: ops.PositionMove[], opts?: { record?: boolean }) => void;
  setElementComponents: (elementId: string, componentIds: string[]) => Promise<void>;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  createConnection: (input: api.ConnectionInput) => Promise<void>;
  patchConnection: (connectionId: string, patch: { labelHtml?: string; targetId?: string; sourceOutputKey?: string }) => Promise<void>;
  deleteConnection: (connectionId: string) => Promise<void>;

  createComponent: (input: api.ComponentInput) => Promise<void>;
  patchComponent: (componentId: string, patch: Partial<api.ComponentInput>) => Promise<void>;
  deleteComponent: (componentId: string) => Promise<void>;

  createAttribute: (input: api.AttributeInput) => Promise<void>;
  patchAttribute: (attributeId: string, patch: Partial<Omit<api.AttributeInput, 'ownerKind' | 'ownerId'>>) => Promise<void>;
  deleteAttribute: (attributeId: string) => Promise<void>;

  createVariable: (input: api.VariableInput) => Promise<void>;
  patchVariable: (variableId: string, patch: Partial<api.VariableInput>) => Promise<void>;
  deleteVariable: (variableId: string) => Promise<void>;

  createAsset: (input: api.AssetInput) => Promise<void>;
  patchAsset: (assetId: string, patch: Partial<api.AssetInput>) => Promise<void>;
  deleteAsset: (assetId: string) => Promise<void>;

  /** Siste 409-konflikt (for snackbar). */
  conflict: NarrativeElement | null;
  clearConflict: () => void;
}

export function useNarrativeGraph(projectId: string | null): UseNarrativeGraphResult {
  const [graph, setGraph] = useState<NarrativeGraph>(() => emptyGraph(projectId ?? ''));
  const [loading, setLoading] = useState<boolean>(!!projectId);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<NarrativeElement | null>(null);

  const graphRef = useRef(graph);
  graphRef.current = graph;

  const pendingMoves = useRef<Map<string, ops.PositionMove>>(new Map());
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoStack = useRef<MoveHistoryEntry[]>([]);
  const redoStack = useRef<MoveHistoryEntry[]>([]);
  const [historyTick, setHistoryTick] = useState(0);

  const reload = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      setGraph(await api.getGraph(projectId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke laste grafen.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    undoStack.current = [];
    redoStack.current = [];
    pendingMoves.current.clear();
    if (!projectId) {
      setGraph(emptyGraph(''));
      setLoading(false);
      return;
    }
    void reload();
  }, [projectId, reload]);

  const requireProject = (): string => {
    if (!projectId) throw new Error('Ingen prosjekt valgt.');
    return projectId;
  };

  // ─── Flytting (batch + angre) ────────────────────────────────────────

  const flushMoves = useCallback(() => {
    flushTimer.current = null;
    if (!projectId || pendingMoves.current.size === 0) return;
    const moves = Array.from(pendingMoves.current.values());
    pendingMoves.current.clear();
    void api.moveElements(projectId, moves).catch((err) => {
      setError(err instanceof Error ? err.message : 'Kunne ikke lagre posisjoner.');
    });
  }, [projectId]);

  const queueMoves = useCallback((moves: ops.PositionMove[]) => {
    for (const m of moves) pendingMoves.current.set(m.id, m);
    if (flushTimer.current) clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(flushMoves, MOVE_DEBOUNCE_MS);
  }, [flushMoves]);

  useEffect(() => () => {
    if (flushTimer.current) {
      clearTimeout(flushTimer.current);
      flushMoves();
    }
  }, [flushMoves]);

  const moveElements = useCallback((moves: ops.PositionMove[], opts: { record?: boolean } = {}) => {
    if (moves.length === 0) return;
    const before = graphRef.current;
    if (opts.record !== false) {
      const from: ops.PositionMove[] = [];
      for (const m of moves) {
        const e = before.elements.find((x) => x.id === m.id);
        if (e) from.push({ id: e.id, x: e.x, y: e.y, width: e.width, height: e.height });
      }
      const changed = moves.filter((m) => {
        const f = from.find((x) => x.id === m.id);
        return !f || f.x !== m.x || f.y !== m.y || (m.width != null && f.width !== m.width) || (m.height != null && f.height !== m.height);
      });
      if (changed.length === 0) return;
      undoStack.current.push({ from, to: moves });
      if (undoStack.current.length > UNDO_LIMIT) undoStack.current.shift();
      redoStack.current = [];
      setHistoryTick((t) => t + 1);
    }
    setGraph((g) => ops.withMoves(g, moves));
    queueMoves(moves);
  }, [queueMoves]);

  const undo = useCallback(() => {
    const entry = undoStack.current.pop();
    if (!entry) return;
    redoStack.current.push(entry);
    setHistoryTick((t) => t + 1);
    setGraph((g) => ops.withMoves(g, entry.from));
    queueMoves(entry.from);
  }, [queueMoves]);

  const redo = useCallback(() => {
    const entry = redoStack.current.pop();
    if (!entry) return;
    undoStack.current.push(entry);
    setHistoryTick((t) => t + 1);
    setGraph((g) => ops.withMoves(g, entry.to));
    queueMoves(entry.to);
  }, [queueMoves]);

  // ─── Mutasjoner ──────────────────────────────────────────────────────

  const fail = (err: unknown, fallback: string): never => {
    const message = err instanceof Error ? err.message : fallback;
    setError(message);
    throw err instanceof Error ? err : new Error(message);
  };

  const result: UseNarrativeGraphResult = {
    graph,
    loading,
    error,
    reload,
    replaceGraph: (next) => setGraph(next),
    conflict,
    clearConflict: () => setConflict(null),
    canUndo: undoStack.current.length > 0,
    canRedo: redoStack.current.length > 0,
    undo,
    redo,
    moveElements,

    updateSettings: async (patch) => {
      const pid = requireProject();
      try {
        const settings = await api.updateSettings(pid, patch);
        setGraph((g) => ({ ...g, settings }));
      } catch (err) { fail(err, 'Kunne ikke lagre innstillinger.'); }
    },

    createBoard: async (input) => {
      const pid = requireProject();
      try {
        const board = await api.createBoard(pid, input);
        setGraph((g) => ops.withBoard(g, board));
        return board.id;
      } catch (err) { return fail(err, 'Kunne ikke opprette brett.'); }
    },
    patchBoard: async (boardId, patch) => {
      const pid = requireProject();
      try {
        const board = await api.patchBoard(pid, boardId, patch);
        setGraph((g) => ops.withBoard(g, board));
      } catch (err) { fail(err, 'Kunne ikke oppdatere brett.'); }
    },
    deleteBoard: async (boardId) => {
      const pid = requireProject();
      const before = graphRef.current;
      setGraph((g) => ops.withoutBoard(g, boardId));
      try {
        await api.deleteBoard(pid, boardId);
      } catch (err) { setGraph(before); fail(err, 'Kunne ikke slette brett.'); }
    },

    createElement: async (input) => {
      const pid = requireProject();
      try {
        const element = await api.createElement(pid, input);
        setGraph((g) => ops.withElement(g, element));
        return element;
      } catch (err) { return fail(err, 'Kunne ikke opprette element.'); }
    },
    patchElement: async (elementId, patch) => {
      const pid = requireProject();
      const current = graphRef.current.elements.find((e) => e.id === elementId);
      try {
        const element = await api.patchElement(pid, elementId, patch, current?.version ?? null);
        setGraph((g) => ops.withElement(g, element));
        return element;
      } catch (err) {
        if (err instanceof NarrativeConflictError) {
          setConflict(err.current);
          setGraph((g) => ops.withElement(g, err.current));
        }
        return fail(err, 'Kunne ikke lagre element.');
      }
    },
    deleteElement: async (elementId) => {
      const pid = requireProject();
      const before = graphRef.current;
      setGraph((g) => ops.withoutElement(g, elementId));
      try {
        await api.deleteElement(pid, elementId);
      } catch (err) { setGraph(before); fail(err, 'Kunne ikke slette element.'); }
    },
    setElementComponents: async (elementId, componentIds) => {
      const pid = requireProject();
      const before = graphRef.current;
      setGraph((g) => ops.withElementComponents(g, elementId, componentIds));
      try {
        await api.setElementComponents(pid, elementId, componentIds);
      } catch (err) { setGraph(before); fail(err, 'Kunne ikke oppdatere komponenter.'); }
    },

    createConnection: async (input) => {
      const pid = requireProject();
      try {
        const connection = await api.createConnection(pid, input);
        setGraph((g) => ops.withConnection(g, connection));
      } catch (err) { fail(err, 'Kunne ikke koble elementene.'); }
    },
    patchConnection: async (connectionId, patch) => {
      const pid = requireProject();
      try {
        const connection = await api.patchConnection(pid, connectionId, patch);
        setGraph((g) => ops.withConnection(g, connection));
      } catch (err) { fail(err, 'Kunne ikke oppdatere kobling.'); }
    },
    deleteConnection: async (connectionId) => {
      const pid = requireProject();
      const before = graphRef.current;
      setGraph((g) => ops.withoutConnection(g, connectionId));
      try {
        await api.deleteConnection(pid, connectionId);
      } catch (err) { setGraph(before); fail(err, 'Kunne ikke slette kobling.'); }
    },

    createComponent: async (input) => {
      const pid = requireProject();
      try {
        const component = await api.createComponent(pid, input);
        setGraph((g) => ops.withComponent(g, component));
      } catch (err) { fail(err, 'Kunne ikke opprette komponent.'); }
    },
    patchComponent: async (componentId, patch) => {
      const pid = requireProject();
      try {
        const component = await api.patchComponent(pid, componentId, patch);
        setGraph((g) => ops.withComponent(g, component));
      } catch (err) { fail(err, 'Kunne ikke oppdatere komponent.'); }
    },
    deleteComponent: async (componentId) => {
      const pid = requireProject();
      const before = graphRef.current;
      setGraph((g) => ops.withoutComponent(g, componentId));
      try {
        await api.deleteComponent(pid, componentId);
      } catch (err) { setGraph(before); fail(err, 'Kunne ikke slette komponent.'); }
    },

    createAttribute: async (input) => {
      const pid = requireProject();
      try {
        const attribute = await api.createAttribute(pid, input);
        setGraph((g) => ops.withAttribute(g, attribute));
      } catch (err) { fail(err, 'Kunne ikke opprette attributt.'); }
    },
    patchAttribute: async (attributeId, patch) => {
      const pid = requireProject();
      try {
        const attribute = await api.patchAttribute(pid, attributeId, patch);
        setGraph((g) => ops.withAttribute(g, attribute));
      } catch (err) { fail(err, 'Kunne ikke oppdatere attributt.'); }
    },
    deleteAttribute: async (attributeId) => {
      const pid = requireProject();
      const before = graphRef.current;
      setGraph((g) => ops.withoutAttribute(g, attributeId));
      try {
        await api.deleteAttribute(pid, attributeId);
      } catch (err) { setGraph(before); fail(err, 'Kunne ikke slette attributt.'); }
    },

    createVariable: async (input) => {
      const pid = requireProject();
      try {
        const variable = await api.createVariable(pid, input);
        setGraph((g) => ops.withVariable(g, variable));
      } catch (err) { fail(err, 'Kunne ikke opprette variabel.'); }
    },
    patchVariable: async (variableId, patch) => {
      const pid = requireProject();
      try {
        const variable = await api.patchVariable(pid, variableId, patch);
        setGraph((g) => ops.withVariable(g, variable));
      } catch (err) { fail(err, 'Kunne ikke oppdatere variabel.'); }
    },
    deleteVariable: async (variableId) => {
      const pid = requireProject();
      const before = graphRef.current;
      setGraph((g) => ops.withoutVariable(g, variableId));
      try {
        await api.deleteVariable(pid, variableId);
      } catch (err) { setGraph(before); fail(err, 'Kunne ikke slette variabel.'); }
    },

    createAsset: async (input) => {
      const pid = requireProject();
      try {
        const asset = await api.createAsset(pid, input);
        setGraph((g) => ops.withAsset(g, asset));
      } catch (err) { fail(err, 'Kunne ikke opprette ressurs.'); }
    },
    patchAsset: async (assetId, patch) => {
      const pid = requireProject();
      try {
        const asset = await api.patchAsset(pid, assetId, patch);
        setGraph((g) => ops.withAsset(g, asset));
      } catch (err) { fail(err, 'Kunne ikke oppdatere ressurs.'); }
    },
    deleteAsset: async (assetId) => {
      const pid = requireProject();
      const before = graphRef.current;
      setGraph((g) => ops.withoutAsset(g, assetId));
      try {
        await api.deleteAsset(pid, assetId);
      } catch (err) { setGraph(before); fail(err, 'Kunne ikke slette ressurs.'); }
    },
  };

  // historyTick brukes kun for å re-rendre canUndo/canRedo etter stack-endringer.
  void historyTick;

  return useMemo(() => result, [graph, loading, error, conflict, historyTick, projectId]); // eslint-disable-line react-hooks/exhaustive-deps
}
