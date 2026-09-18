/**
 * Felles byggekloss for tekstbaserte importere (Twee, Ink): graf-bygger med
 * auto-layout, variabel-inferens og kodeblokk-hjelpere. Ren TS, ingen DOM.
 */

import { escapeHtml } from '../narrative-script/html';
import type { RuntimeVariableType } from '../narrative-runtime/types';
import { defaultIdFactory, type IdFactory } from './ids';
import { plainTextToHtml } from './text';
import type {
  ExportBranchCondition, FormatBoard, FormatConnection, FormatElement, FormatGraph, FormatVariable, FormatWarning,
} from './types';

export interface TextImportStats {
  elements: number;
  connections: number;
  variables: number;
  /** Antall konstruksjoner som ikke kunne oversettes (beholdt som tekst / droppet med varsel). */
  unsupported: number;
}

export interface FromTextResult {
  graph: FormatGraph;
  warnings: FormatWarning[];
  stats: TextImportStats;
}

export interface TextImportOptions {
  projectId: string;
  now?: string;
  idFactory?: IdFactory;
  /** Fallback-tittel (typisk filnavn uten endelse). */
  title?: string;
}

export const VARIABLE_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]{0,99}$/;

export function sanitizeVariableName(name: string): string {
  const cleaned = name
    .replace(/[æÆ]/g, 'ae').replace(/[øØ]/g, 'o').replace(/[åÅ]/g, 'a')
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 100);
  return /^[A-Za-z_]/.test(cleaned) ? cleaned : `_${cleaned || 'var'}`;
}

/** Typeinferens fra en literal i kildeteksten. */
export function inferVariableType(literal: string | null | undefined): { type: RuntimeVariableType; value: unknown } {
  const raw = (literal ?? '').trim();
  if (!raw) return { type: 'string', value: '' };
  if (/^(true|false)$/i.test(raw)) return { type: 'bool', value: raw.toLowerCase() === 'true' };
  if (/^-?\d+$/.test(raw)) return { type: 'int', value: Number.parseInt(raw, 10) };
  if (/^-?\d*\.\d+$/.test(raw)) return { type: 'float', value: Number.parseFloat(raw) };
  const str = raw.match(/^"([\s\S]*)"$/) ?? raw.match(/^'([\s\S]*)'$/);
  if (str) return { type: 'string', value: str[1] };
  return { type: 'string', value: '' };
}

/** `<pre><code>…</code></pre>` med escapede entiteter (arcscript-kodeblokk). */
export function codeBlock(code: string): string {
  const trimmed = code.replace(/\r\n?/g, '\n').trim();
  return trimmed ? `<pre><code>${escapeHtml(trimmed)}</code></pre>` : '';
}

/** Tekst-segment → avsnitts-HTML (tom streng for tomt innhold). */
export function proseHtml(text: string): string {
  return plainTextToHtml(text);
}

export interface ElementSpec {
  boardId: string;
  kind?: FormatElement['kind'];
  titleHtml?: string;
  contentHtml?: string;
  x?: number | null;
  y?: number | null;
  width?: number;
  height?: number;
  theme?: string;
  customId?: string | null;
  jumperTargetId?: string | null;
  branchConditions?: ExportBranchCondition[];
}

export interface ConnectionSpec {
  sourceId: string;
  targetId: string;
  labelHtml?: string;
  sourceOutputKey?: string;
}

export interface GraphBuilder {
  readonly projectId: string;
  readonly warnings: FormatWarning[];
  unsupported: number;
  warn: (message: string, ref?: string) => void;
  newId: IdFactory;
  addBoard: (name: string, folderPath?: string) => FormatBoard;
  addElement: (spec: ElementSpec) => FormatElement;
  addConnection: (spec: ConnectionSpec) => FormatConnection | null;
  /** Dedupliserer på navn; første type vinner. */
  addVariable: (name: string, type: RuntimeVariableType, defaultValue: unknown) => FormatVariable;
  hasVariable: (name: string) => boolean;
  element: (id: string) => FormatElement | undefined;
  /** Plasser elementer uten posisjon i et rutenett etter BFS-nivå fra start. */
  autoLayout: (startElementId: string | null) => void;
  finish: (settings: { title: string | null; startingElementId: string | null }) => FromTextResult;
}

const GRID_X = 320;
const GRID_Y = 180;

export function createGraphBuilder(options: TextImportOptions): GraphBuilder {
  const { projectId } = options;
  const now = options.now ?? new Date().toISOString();
  const factory = options.idFactory ?? defaultIdFactory;
  const warnings: FormatWarning[] = [];
  const boards: FormatBoard[] = [];
  const elements: FormatElement[] = [];
  const connections: FormatConnection[] = [];
  const variables: FormatVariable[] = [];
  const variableByName = new Map<string, FormatVariable>();
  const positioned = new Set<string>();

  const builder: GraphBuilder = {
    projectId,
    warnings,
    unsupported: 0,
    newId: factory,
    warn(message, ref) { warnings.push(ref ? { message, ref } : { message }); },
    addBoard(name, folderPath = '') {
      const board: FormatBoard = {
        id: factory('board'), projectId, name, customId: null, folderPath, sortOrder: boards.length, viewport: {}, createdAt: now, updatedAt: now,
      };
      boards.push(board);
      return board;
    },
    addElement(spec) {
      const kind = spec.kind ?? 'element';
      const hasPos = typeof spec.x === 'number' && typeof spec.y === 'number';
      const el: FormatElement = {
        id: factory('element'), projectId, boardId: spec.boardId, kind,
        titleHtml: spec.titleHtml ?? '', contentHtml: spec.contentHtml ?? '',
        x: hasPos ? (spec.x as number) : 0, y: hasPos ? (spec.y as number) : 0,
        width: spec.width ?? (kind === 'branch' ? 200 : kind === 'jumper' ? 160 : 260),
        height: spec.height ?? (kind === 'branch' ? 80 : kind === 'jumper' ? 60 : 120),
        theme: spec.theme ?? 'default', coverAssetId: null, customId: spec.customId ?? null,
        jumperTargetId: spec.jumperTargetId ?? null, branchConditions: spec.branchConditions ?? [],
        version: 1, sortOrder: elements.length, createdAt: now, updatedAt: now, i18n: {},
      };
      if (hasPos) positioned.add(el.id);
      elements.push(el);
      return el;
    },
    addConnection(spec) {
      const source = elements.find((e) => e.id === spec.sourceId);
      const target = elements.find((e) => e.id === spec.targetId);
      if (!source || !target) return null;
      const conn: FormatConnection = {
        id: factory('connection'), projectId, boardId: source.boardId, sourceId: source.id, targetId: target.id,
        sourceOutputKey: spec.sourceOutputKey ?? 'default', labelHtml: spec.labelHtml ?? '',
        sortOrder: connections.filter((c) => c.sourceId === source.id).length, createdAt: now, updatedAt: now, i18n: {},
      };
      connections.push(conn);
      return conn;
    },
    addVariable(name, type, defaultValue) {
      const existing = variableByName.get(name);
      if (existing) return existing;
      const v: FormatVariable = { id: factory('variable'), projectId, name, type, defaultValue, sortOrder: variables.length, createdAt: now, updatedAt: now };
      variables.push(v);
      variableByName.set(name, v);
      return v;
    },
    hasVariable: (name) => variableByName.has(name),
    element: (id) => elements.find((e) => e.id === id),
    autoLayout(startElementId) {
      const level = new Map<string, number>();
      const out = new Map<string, string[]>();
      for (const c of connections) {
        const list = out.get(c.sourceId) ?? [];
        list.push(c.targetId);
        out.set(c.sourceId, list);
      }
      for (const e of elements) if (e.kind === 'jumper' && e.jumperTargetId) out.set(e.id, [...(out.get(e.id) ?? []), e.jumperTargetId]);
      const queue: string[] = [];
      const seed = (id: string) => { if (!level.has(id)) { level.set(id, 0); queue.push(id); } };
      if (startElementId) seed(startElementId);
      for (const e of elements) if (!positioned.has(e.id)) seed(e.id);
      while (queue.length) {
        const id = queue.shift()!;
        const l = level.get(id) ?? 0;
        for (const next of out.get(id) ?? []) {
          if (!level.has(next)) { level.set(next, l + 1); queue.push(next); }
        }
      }
      const rowByLevel = new Map<number, number>();
      for (const e of elements) {
        if (positioned.has(e.id)) continue;
        const l = level.get(e.id) ?? 0;
        const row = rowByLevel.get(l) ?? 0;
        rowByLevel.set(l, row + 1);
        e.x = 40 + l * GRID_X;
        e.y = 40 + row * GRID_Y;
      }
    },
    finish(settings) {
      return {
        graph: {
          settings: { projectId, title: settings.title, startingElementId: settings.startingElementId, coverAssetId: null, schemaVersion: 1, updatedAt: now, locales: ['nb'], i18n: {} },
          boards, elements, connections, components: [], elementComponents: [], attributes: [], variables, assets: [],
        },
        warnings,
        stats: { elements: elements.length, connections: connections.length, variables: variables.length, unsupported: builder.unsupported },
      };
    },
  };
  return builder;
}

/**
 * Del en tekst i segmenter: prose og kodeblokk-HTML i rekkefølge, og sett
 * dem sammen til element-HTML (prose → avsnitt, kode → <pre><code>).
 */
export type ContentPart = { kind: 'text'; text: string } | { kind: 'code'; code: string } | { kind: 'html'; html: string };

export function partsToHtml(parts: ContentPart[]): string {
  const out: string[] = [];
  let textBuffer: string[] = [];
  const flush = () => {
    const text = textBuffer.join('');
    if (text.trim()) out.push(proseHtml(text));
    textBuffer = [];
  };
  for (const part of parts) {
    if (part.kind === 'text') { textBuffer.push(part.text); continue; }
    flush();
    if (part.kind === 'code') out.push(codeBlock(part.code));
    else out.push(part.html);
  }
  flush();
  return out.join('');
}
