/**
 * Story Graph → Arcweave `project.json`.
 *
 * Målet er at eksporten kan lastes rett inn i Arcweaves MIT-lisensierte
 * Unity/Godot/Unreal-plugins (som leser `startingElement`, `boards`,
 * `elements`, `connections`, `branches`, `conditions`, `jumpers`,
 * `components`, `attributes`, `variables`, `assets`). Ren TS, ingen DOM.
 */

import type {
  ArcweaveAttribute, ArcweaveBoard, ArcweaveBranch, ArcweaveComponent, ArcweaveCondition,
  ArcweaveConnection, ArcweaveElement, ArcweaveFolder, ArcweaveJumper, ArcweaveNote,
  ArcweaveProject, ArcweaveVariable, ArcweaveVariableType,
} from './arcweave-types';
import { createExportIdMapper, folderIdForPath, type IdMapper } from './ids';
import type { ExportAttribute, ExportElement, ExportGraph } from './types';

const VARIABLE_TYPE_OUT: Record<string, ArcweaveVariableType> = {
  int: 'integer', float: 'float', bool: 'boolean', string: 'string',
};

function bySort<T extends { sortOrder?: number }>(list: T[]): T[] {
  return [...list].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

function coerceVariableValue(type: string, value: unknown): unknown {
  switch (type) {
    case 'int': { const n = Number(value); return Number.isFinite(n) ? Math.trunc(n) : 0; }
    case 'float': { const n = Number(value); return Number.isFinite(n) ? n : 0; }
    case 'bool': return value === true || value === 'true' || value === 1;
    default: return value == null ? '' : String(value);
  }
}

/**
 * Bygg Arcweave-mappetre av `folderPath` («Akt 1/Kapittel 2»). Returnerer
 * mappe-noder (nøklet på id) og en funksjon som registrerer et blad under
 * riktig mappe. Rot-mappa har `root: true`.
 */
function buildFolderTree(rootName: string, usedIds: Set<string>) {
  const folders: Record<string, ArcweaveFolder> = {};
  const idByPath = new Map<string, string>();
  const rootId = folderIdForPath(`${rootName}-root`, usedIds);
  folders[rootId] = { name: 'Root', children: [], root: true };
  idByPath.set('', rootId);

  const ensure = (path: string): string => {
    const existing = idByPath.get(path);
    if (existing) return existing;
    const segments = path.split('/').filter(Boolean);
    const parentPath = segments.slice(0, -1).join('/');
    const parentId = ensure(parentPath);
    const id = folderIdForPath(`${rootName}/${path}`, usedIds);
    folders[id] = { name: segments[segments.length - 1] ?? path, children: [] };
    folders[parentId].children.push(id);
    idByPath.set(path, id);
    return id;
  };

  const add = (folderPath: string | undefined, leafId: string) => {
    const path = (folderPath ?? '').split('/').map((s) => s.trim()).filter(Boolean).join('/');
    folders[ensure(path)].children.push(leafId);
  };

  return { folders, add };
}

function attributeValue(a: ExportAttribute, id: (x: string) => string): ArcweaveAttribute['value'] {
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').map(id) : []);
  switch (a.type) {
    case 'rich_text': return { data: a.value == null ? '' : String(a.value), type: 'string', plain: false };
    case 'string': return { data: a.value == null ? '' : String(a.value), type: 'string', plain: true };
    case 'bool': return { data: coerceVariableValue('bool', a.value), type: 'boolean', plain: true };
    case 'int': return { data: coerceVariableValue('int', a.value), type: 'integer', plain: true };
    case 'float': return { data: coerceVariableValue('float', a.value), type: 'float', plain: true };
    case 'component_list': return { data: list(a.value), type: 'component-list', plain: true };
    case 'asset_list': return { data: list(a.value), type: 'asset-list', plain: true };
    default: return { data: a.value ?? '', type: 'string', plain: true };
  }
}

export interface ToArcweaveOptions {
  idMapper?: IdMapper;
}

export function toArcweaveProject(graph: ExportGraph, options: ToArcweaveOptions = {}): ArcweaveProject {
  const mapper = options.idMapper ?? createExportIdMapper();
  const id = (internal: string) => mapper.map(internal);
  const usedFolderIds = new Set<string>();

  const elementById = new Map(graph.elements.map((e) => [e.id, e]));
  const boardIds = new Set(graph.boards.map((b) => b.id));
  const componentIds = new Set(graph.components.map((c) => c.id));
  const assetIds = new Set(graph.assets.map((a) => a.id));

  const connectionsBySource = new Map<string, typeof graph.connections>();
  for (const c of bySort(graph.connections)) {
    const list = connectionsBySource.get(c.sourceId) ?? [];
    list.push(c);
    connectionsBySource.set(c.sourceId, list);
  }
  const componentsByElement = new Map<string, string[]>();
  for (const ec of bySort(graph.elementComponents)) {
    if (!componentIds.has(ec.componentId)) continue;
    const list = componentsByElement.get(ec.elementId) ?? [];
    list.push(ec.componentId);
    componentsByElement.set(ec.elementId, list);
  }
  const attributesByOwner = new Map<string, ExportAttribute[]>();
  for (const a of bySort(graph.attributes)) {
    const key = `${a.ownerKind}:${a.ownerId}`;
    const list = attributesByOwner.get(key) ?? [];
    list.push(a);
    attributesByOwner.set(key, list);
  }
  const attrIds = (kind: ExportAttribute['ownerKind'], ownerId: string) =>
    (attributesByOwner.get(`${kind}:${ownerId}`) ?? []).map((a) => id(a.id));
  const cover = (assetId: string | null | undefined) =>
    assetId && assetIds.has(assetId) ? { cover: { id: id(assetId) } } : {};

  // ── Brett + mapper ──────────────────────────────────────────────────
  const boardTree = buildFolderTree('boards', usedFolderIds);
  const boards: Record<string, ArcweaveBoard | ArcweaveFolder> = {};
  const boardOut = new Map<string, ArcweaveBoard>();
  for (const b of bySort(graph.boards)) {
    const out: ArcweaveBoard = {
      name: b.name, customId: b.customId ?? null,
      notes: [], jumpers: [], branches: [], elements: [], connections: [],
    };
    const boardAttrs = attrIds('board', b.id);
    if (boardAttrs.length) out.attributes = boardAttrs;
    boards[id(b.id)] = out;
    boardOut.set(b.id, out);
    boardTree.add(b.folderPath, id(b.id));
  }
  Object.assign(boards, boardTree.folders);

  // ── Elementer / forgreninger / jumpere / notater ────────────────────
  const elements: Record<string, ArcweaveElement> = {};
  const branches: Record<string, ArcweaveBranch> = {};
  const conditions: Record<string, ArcweaveCondition> = {};
  const jumpers: Record<string, ArcweaveJumper> = {};
  const notes: Record<string, ArcweaveNote> = {};
  const connections: Record<string, ArcweaveConnection> = {};

  const connectable = (e: ExportElement | undefined): e is ExportElement => !!e && e.kind !== 'note';
  const targetType = (e: ExportElement): ArcweaveConnection['targetType'] =>
    e.kind === 'branch' ? 'branches' : e.kind === 'jumper' ? 'jumpers' : 'elements';

  for (const e of bySort(graph.elements)) {
    const board = boardOut.get(e.boardId);
    if (!board || !boardIds.has(e.boardId)) continue;
    const eid = id(e.id);
    switch (e.kind) {
      case 'element': {
        const outputs: string[] = [];
        for (const c of connectionsBySource.get(e.id) ?? []) {
          const target = elementById.get(c.targetId);
          if (!connectable(target)) continue;
          const cid = id(c.id);
          outputs.push(cid);
          connections[cid] = {
            type: 'Straight', theme: 'default', sourceid: eid, targetid: id(target.id),
            sourceType: 'elements', targetType: targetType(target), label: c.labelHtml?.trim() ? c.labelHtml : null,
          };
          board.connections.push(cid);
        }
        const out: ArcweaveElement = {
          x: e.x, y: e.y, width: e.width, height: e.height, theme: e.theme || 'default',
          title: e.titleHtml ?? '', content: e.contentHtml ?? '',
          outputs, components: (componentsByElement.get(e.id) ?? []).map(id), attributes: attrIds('element', e.id),
          assets: cover(e.coverAssetId),
        };
        if (e.customId?.trim()) out.customId = e.customId.trim();
        elements[eid] = out;
        board.elements.push(eid);
        break;
      }
      case 'branch': {
        const conds = e.branchConditions.length > 0
          ? e.branchConditions
          : [{ id: `${e.id}-if`, script: 'true', label: null }];
        const outgoing = connectionsBySource.get(e.id) ?? [];
        const condIds: string[] = [];
        conds.forEach((cond, index) => {
          const isLast = index === conds.length - 1;
          const isElse = isLast && cond.script == null && conds.length > 1;
          const condId = id(cond.id);
          condIds.push(condId);
          const conn = outgoing.find((c) => c.sourceOutputKey === cond.id);
          const target = conn ? elementById.get(conn.targetId) : undefined;
          let output: string | null = null;
          if (conn && connectable(target)) {
            const cid = id(conn.id);
            output = cid;
            connections[cid] = {
              type: 'Straight', theme: 'default', sourceid: condId, targetid: id(target.id),
              sourceType: 'conditions', targetType: targetType(target), label: conn.labelHtml?.trim() ? conn.labelHtml : null,
            };
            board.connections.push(cid);
          }
          conditions[condId] = isElse
            ? { output }
            : { script: cond.script?.trim() ? cond.script : 'true', output };
        });
        const [ifCondition, ...rest] = condIds;
        const lastCond = conds[conds.length - 1];
        const hasElse = conds.length > 1 && lastCond.script == null;
        branches[eid] = {
          x: e.x, y: e.y, theme: e.theme || 'default',
          conditions: {
            ifCondition,
            elseIfConditions: hasElse ? rest.slice(0, -1) : rest,
            elseCondition: hasElse ? rest[rest.length - 1] : null,
          },
        };
        board.branches.push(eid);
        break;
      }
      case 'jumper': {
        const target = e.jumperTargetId ? elementById.get(e.jumperTargetId) : undefined;
        jumpers[eid] = { x: e.x, y: e.y, elementId: target && target.kind === 'element' ? id(target.id) : null };
        board.jumpers.push(eid);
        break;
      }
      case 'note': {
        notes[eid] = { x: e.x, y: e.y, width: e.width, height: e.height, theme: e.theme || 'default', content: e.contentHtml ?? '' };
        board.notes.push(eid);
        break;
      }
      default:
        break;
    }
  }

  // ── Komponenter + mapper ────────────────────────────────────────────
  const componentTree = buildFolderTree('components', usedFolderIds);
  const components: Record<string, ArcweaveComponent | ArcweaveFolder> = {};
  for (const c of bySort(graph.components)) {
    const cid = id(c.id);
    components[cid] = {
      name: c.name, customId: c.customId ?? null,
      attributes: attrIds('component', c.id), assets: cover(c.coverAssetId),
    };
    componentTree.add(c.folderPath, cid);
  }
  Object.assign(components, componentTree.folders);

  // ── Attributter ─────────────────────────────────────────────────────
  const attributes: Record<string, ArcweaveAttribute> = {};
  for (const a of bySort(graph.attributes)) {
    const ownerExists = a.ownerKind === 'element'
      ? elementById.has(a.ownerId)
      : a.ownerKind === 'component' ? componentIds.has(a.ownerId) : boardIds.has(a.ownerId);
    if (!ownerExists) continue;
    attributes[id(a.id)] = {
      cId: id(a.ownerId),
      cType: a.ownerKind === 'element' ? 'elements' : a.ownerKind === 'component' ? 'components' : 'boards',
      name: a.name,
      value: attributeValue(a, id),
    };
  }

  // ── Variabler ───────────────────────────────────────────────────────
  const variables: Record<string, ArcweaveVariable | ArcweaveFolder> = {};
  const variableRootId = folderIdForPath('variables-root', usedFolderIds);
  const variableChildren: string[] = [];
  for (const v of bySort(graph.variables)) {
    const vid = id(v.id);
    variables[vid] = {
      name: v.name, type: VARIABLE_TYPE_OUT[v.type] ?? 'string', cType: 'global',
      value: coerceVariableValue(v.type, v.defaultValue),
    };
    variableChildren.push(vid);
  }
  variables[variableRootId] = { name: 'Root', children: variableChildren, root: true };

  // ── Ressurser ───────────────────────────────────────────────────────
  const assetTree = buildFolderTree('assets', usedFolderIds);
  const assets: ArcweaveProject['assets'] = {};
  for (const a of graph.assets) {
    const aid = id(a.id);
    assets[aid] = a.externalUrl ? { name: a.name, type: a.kind, url: a.externalUrl } : { name: a.name, type: a.kind };
    assetTree.add(a.folderPath, aid);
  }
  Object.assign(assets, assetTree.folders);

  const start = graph.settings.startingElementId ? elementById.get(graph.settings.startingElementId) : undefined;
  const coverAsset = graph.settings.coverAssetId && assetIds.has(graph.settings.coverAssetId)
    ? { id: id(graph.settings.coverAssetId) }
    : null;

  return {
    name: graph.settings.title ?? '',
    cover: coverAsset,
    startingElement: start && start.kind === 'element' ? id(start.id) : null,
    boards, notes, elements, jumpers, connections, branches, components, attributes, assets, variables, conditions,
  };
}
