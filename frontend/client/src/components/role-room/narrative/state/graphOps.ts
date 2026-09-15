/**
 * Rene operasjoner på NarrativeGraph — ingen React, ingen nettverk.
 * Brukes av useNarrativeGraph (optimistiske oppdateringer) og av tester.
 */

import { validateScripts } from '@shared/narrative-runtime/validate';
import type {
  NarrativeAsset,
  NarrativeAttribute,
  NarrativeBoard,
  NarrativeComponent,
  NarrativeConnection,
  NarrativeElement,
  NarrativeGraph,
  NarrativeVariable,
} from '../narrativeTypes';

function upsertById<T extends { id: string }>(list: T[], item: T): T[] {
  const idx = list.findIndex((x) => x.id === item.id);
  if (idx === -1) return [...list, item];
  const next = list.slice();
  next[idx] = item;
  return next;
}

function removeById<T extends { id: string }>(list: T[], id: string): T[] {
  return list.filter((x) => x.id !== id);
}

export function withBoard(graph: NarrativeGraph, board: NarrativeBoard): NarrativeGraph {
  return { ...graph, boards: upsertById(graph.boards, board) };
}

export function withoutBoard(graph: NarrativeGraph, boardId: string): NarrativeGraph {
  const removedElementIds = new Set(graph.elements.filter((e) => e.boardId === boardId).map((e) => e.id));
  return {
    ...graph,
    boards: removeById(graph.boards, boardId),
    elements: graph.elements.filter((e) => e.boardId !== boardId),
    connections: graph.connections.filter((c) => c.boardId !== boardId),
    attributes: graph.attributes.filter((a) => !(a.ownerKind === 'element' && removedElementIds.has(a.ownerId)) && !(a.ownerKind === 'board' && a.ownerId === boardId)),
    elementComponents: graph.elementComponents.filter((ec) => !removedElementIds.has(ec.elementId)),
  };
}

export function withElement(graph: NarrativeGraph, element: NarrativeElement): NarrativeGraph {
  return { ...graph, elements: upsertById(graph.elements, element) };
}

export function withoutElement(graph: NarrativeGraph, elementId: string): NarrativeGraph {
  return {
    ...graph,
    elements: removeById(graph.elements, elementId).map((e) =>
      e.jumperTargetId === elementId ? { ...e, jumperTargetId: null } : e,
    ),
    connections: graph.connections.filter((c) => c.sourceId !== elementId && c.targetId !== elementId),
    attributes: graph.attributes.filter((a) => !(a.ownerKind === 'element' && a.ownerId === elementId)),
    elementComponents: graph.elementComponents.filter((ec) => ec.elementId !== elementId),
    settings: graph.settings.startingElementId === elementId
      ? { ...graph.settings, startingElementId: null }
      : graph.settings,
  };
}

export interface PositionMove {
  id: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export function withMoves(graph: NarrativeGraph, moves: PositionMove[]): NarrativeGraph {
  if (moves.length === 0) return graph;
  const byId = new Map(moves.map((m) => [m.id, m]));
  return {
    ...graph,
    elements: graph.elements.map((e) => {
      const m = byId.get(e.id);
      if (!m) return e;
      return { ...e, x: m.x, y: m.y, width: m.width ?? e.width, height: m.height ?? e.height };
    }),
  };
}

export function withConnection(graph: NarrativeGraph, connection: NarrativeConnection): NarrativeGraph {
  return { ...graph, connections: upsertById(graph.connections, connection) };
}

export function withoutConnection(graph: NarrativeGraph, connectionId: string): NarrativeGraph {
  return { ...graph, connections: removeById(graph.connections, connectionId) };
}

export function withComponent(graph: NarrativeGraph, component: NarrativeComponent): NarrativeGraph {
  return { ...graph, components: upsertById(graph.components, component) };
}

export function withoutComponent(graph: NarrativeGraph, componentId: string): NarrativeGraph {
  return {
    ...graph,
    components: removeById(graph.components, componentId),
    attributes: graph.attributes.filter((a) => !(a.ownerKind === 'component' && a.ownerId === componentId)),
    elementComponents: graph.elementComponents.filter((ec) => ec.componentId !== componentId),
  };
}

export function withAttribute(graph: NarrativeGraph, attribute: NarrativeAttribute): NarrativeGraph {
  return { ...graph, attributes: upsertById(graph.attributes, attribute) };
}

export function withoutAttribute(graph: NarrativeGraph, attributeId: string): NarrativeGraph {
  return { ...graph, attributes: removeById(graph.attributes, attributeId) };
}

export function withVariable(graph: NarrativeGraph, variable: NarrativeVariable): NarrativeGraph {
  return { ...graph, variables: upsertById(graph.variables, variable) };
}

export function withoutVariable(graph: NarrativeGraph, variableId: string): NarrativeGraph {
  return { ...graph, variables: removeById(graph.variables, variableId) };
}

export function withAsset(graph: NarrativeGraph, asset: NarrativeAsset): NarrativeGraph {
  return { ...graph, assets: upsertById(graph.assets, asset) };
}

export function withoutAsset(graph: NarrativeGraph, assetId: string): NarrativeGraph {
  return { ...graph, assets: removeById(graph.assets, assetId) };
}

export function withElementComponents(graph: NarrativeGraph, elementId: string, componentIds: string[]): NarrativeGraph {
  return {
    ...graph,
    elementComponents: [
      ...graph.elementComponents.filter((ec) => ec.elementId !== elementId),
      ...componentIds.map((componentId, sortOrder) => ({ elementId, componentId, sortOrder })),
    ],
  };
}

/** Elementer + koblinger på ett brett (koblinger følger kildens brett). */
export function boardSlice(graph: NarrativeGraph, boardId: string | null): { elements: NarrativeElement[]; connections: NarrativeConnection[] } {
  if (!boardId) return { elements: [], connections: [] };
  const elements = graph.elements.filter((e) => e.boardId === boardId);
  const ids = new Set(elements.map((e) => e.id));
  const connections = graph.connections.filter((c) => c.boardId === boardId || (ids.has(c.sourceId) && ids.has(c.targetId)));
  return { elements, connections };
}

/** Kobling-regler (Arcweave): jumper/notat har ingen utganger; notat ingen innganger. */
export function canConnect(source: NarrativeElement | undefined, target: NarrativeElement | undefined): boolean {
  if (!source || !target) return false;
  if (source.id === target.id) return false;
  if (source.kind === 'jumper' || source.kind === 'note') return false;
  if (target.kind === 'note') return false;
  return true;
}

/** Enkel valideringsrapport for brettet (Arcweave mangler dette). */
export interface GraphIssue {
  level: 'warning' | 'error';
  elementId: string | null;
  message: string;
}

export function validateGraph(graph: NarrativeGraph): GraphIssue[] {
  const issues: GraphIssue[] = [];
  const outgoing = new Map<string, number>();
  const incoming = new Map<string, number>();
  for (const c of graph.connections) {
    outgoing.set(c.sourceId, (outgoing.get(c.sourceId) ?? 0) + 1);
    incoming.set(c.targetId, (incoming.get(c.targetId) ?? 0) + 1);
  }
  const start = graph.settings.startingElementId;
  if (!start && graph.elements.some((e) => e.kind === 'element')) {
    issues.push({ level: 'warning', elementId: null, message: 'Ingen startelement er satt.' });
  }
  const byId = new Map(graph.elements.map((e) => [e.id, e]));
  for (const e of graph.elements) {
    if (e.kind === 'note') continue;
    if (e.kind === 'jumper') {
      if (!e.jumperTargetId || !byId.has(e.jumperTargetId)) {
        issues.push({ level: 'error', elementId: e.id, message: 'Jumper mangler gyldig mål.' });
      }
      continue;
    }
    if (e.kind === 'branch') {
      if (e.branchConditions.length === 0) {
        issues.push({ level: 'error', elementId: e.id, message: 'Forgrening har ingen betingelser.' });
      }
      const wired = new Set(graph.connections.filter((c) => c.sourceId === e.id).map((c) => c.sourceOutputKey));
      for (const cond of e.branchConditions) {
        if (!wired.has(cond.id)) {
          issues.push({ level: 'warning', elementId: e.id, message: `Utgangen «${cond.label ?? cond.script ?? 'else'}» er ikke koblet.` });
        }
      }
    }
    if (e.id !== start && !(incoming.get(e.id) ?? 0) && !graph.elements.some((j) => j.jumperTargetId === e.id)) {
      issues.push({ level: 'warning', elementId: e.id, message: 'Elementet kan ikke nås (ingen innganger).' });
    }
  }
  // Skriptvalidering (delt med backend): parse-feil, ukjente variabler, døde referanser.
  return issues.concat(validateScripts(graph));
}
