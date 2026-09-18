/**
 * Felles traversering for lesbare eksporter (Markdown, CSV, PDF): sortering,
 * elementetiketter og oppslag per graf. DOM-fri.
 */

import { htmlToTitle } from './text';
import type { ExportComponent, ExportConnection, ExportElement, ExportGraph } from './types';

export function bySort<T extends { sortOrder?: number }>(list: T[]): T[] {
  return [...list].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

export function elementLabel(e: ExportElement | undefined): string {
  if (!e) return '(mangler)';
  const title = htmlToTitle(e.titleHtml);
  if (title) return title;
  if (e.kind === 'branch') return 'Forgrening';
  if (e.kind === 'jumper') return 'Jumper';
  return e.customId ? `#${e.customId}` : 'Uten tittel';
}

export interface GraphIndex {
  elementById: Map<string, ExportElement>;
  componentById: Map<string, ExportComponent>;
  /** Utgående koblinger per kilde, i sortOrder-rekkefølge. */
  connectionsBySource: Map<string, ExportConnection[]>;
  /** Navn på festede komponenter per element, i sortOrder-rekkefølge. */
  componentsByElement: Map<string, string[]>;
}

export function indexGraph(graph: ExportGraph): GraphIndex {
  const elementById = new Map(graph.elements.map((e) => [e.id, e]));
  const componentById = new Map(graph.components.map((c) => [c.id, c]));
  const connectionsBySource = new Map<string, ExportConnection[]>();
  for (const c of bySort(graph.connections)) {
    const list = connectionsBySource.get(c.sourceId) ?? [];
    list.push(c);
    connectionsBySource.set(c.sourceId, list);
  }
  const componentsByElement = new Map<string, string[]>();
  for (const ec of bySort(graph.elementComponents)) {
    const list = componentsByElement.get(ec.elementId) ?? [];
    const name = componentById.get(ec.componentId)?.name;
    if (name) list.push(name);
    componentsByElement.set(ec.elementId, list);
  }
  return { elementById, componentById, connectionsBySource, componentsByElement };
}
