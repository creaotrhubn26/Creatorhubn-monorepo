/**
 * Arcweave `project.json` → Story Graph (full `FormatGraph`).
 *
 * Tapsfri der modellene overlapper; alt som ikke kan representeres eller som
 * peker på noe som mangler, rapporteres som `warnings` (aldri kastet). Kaster
 * kun `ArcweaveImportError` når dokumentet ikke er et Arcweave-prosjekt.
 */

import type {
  ArcweaveAttribute, ArcweaveBoard, ArcweaveComponent, ArcweaveFolder, ArcweaveProject, ArcweaveVariable,
} from './arcweave-types';
import { isArcweaveFolder } from './arcweave-types';
import { defaultIdFactory, type IdFactory, type IdKind } from './ids';
import type {
  ExportBranchCondition, FormatAsset, FormatAttribute, FormatAttributeType, FormatBoard, FormatComponent,
  FormatConnection, FormatElement, FormatElementComponent, FormatGraph, FormatVariable, FormatWarning,
} from './types';

export class ArcweaveImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArcweaveImportError';
  }
}

export interface FromArcweaveOptions {
  projectId: string;
  /** ISO-tidsstempel for created/updated (deterministisk i tester). */
  now?: string;
  idFactory?: IdFactory;
}

export interface FromArcweaveResult {
  graph: FormatGraph;
  warnings: FormatWarning[];
}

const KNOWN_THEMES = new Set(['default', 'green', 'blue', 'purple', 'amber', 'red', 'teal', 'pink', 'gray']);
const THEME_ALIASES: Record<string, string> = { orange: 'amber', yellow: 'amber', grey: 'gray', cyan: 'teal', magenta: 'pink' };
const VARIABLE_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]{0,99}$/;

function normalizeTheme(theme: unknown): string {
  const t = typeof theme === 'string' ? theme.trim().toLowerCase() : '';
  if (!t) return 'default';
  if (KNOWN_THEMES.has(t)) return t;
  return THEME_ALIASES[t] ?? 'default';
}

function num(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function record<T>(value: unknown): Record<string, T> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, T>) : {};
}

function sanitizeVariableName(name: string): string {
  const cleaned = name
    .replace(/[æÆ]/g, 'ae').replace(/[øØ]/g, 'o').replace(/[åÅ]/g, 'a')
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 100);
  return /^[A-Za-z_]/.test(cleaned) ? cleaned : `_${cleaned}`;
}

/** Mappe-sti («A/B») for hvert blad i en Arcweave-samling med mappe-noder. */
function folderPaths(collection: Record<string, unknown>): Map<string, string> {
  const out = new Map<string, string>();
  const referenced = new Set<string>();
  for (const v of Object.values(collection)) if (isArcweaveFolder(v)) for (const c of v.children) referenced.add(c);
  const roots = Object.entries(collection).filter(([id, v]) => isArcweaveFolder(v) && (v.root || !referenced.has(id)));
  const visited = new Set<string>();
  const walk = (folder: ArcweaveFolder, path: string) => {
    for (const childId of folder.children) {
      if (visited.has(childId)) continue;
      visited.add(childId);
      const child = collection[childId];
      if (isArcweaveFolder(child)) {
        walk(child, path ? `${path}/${child.name}` : child.name);
      } else if (child) {
        out.set(childId, path);
      }
    }
  };
  for (const [, root] of roots) walk(root as ArcweaveFolder, '');
  return out;
}

export function fromArcweaveProject(input: unknown, options: FromArcweaveOptions): FromArcweaveResult {
  const project = input as Partial<ArcweaveProject> | null;
  if (!project || typeof project !== 'object' || !project.boards || !project.elements) {
    throw new ArcweaveImportError('Dokumentet ser ikke ut som en Arcweave-eksport (mangler «boards»/«elements»).');
  }
  const { projectId } = options;
  const now = options.now ?? new Date().toISOString();
  const factory = options.idFactory ?? defaultIdFactory;
  const warnings: FormatWarning[] = [];
  const warn = (message: string, ref?: string) => { warnings.push(ref ? { message, ref } : { message }); };

  const idMap = new Map<string, string>();
  const newId = (kind: IdKind, arcId: string): string => {
    const existing = idMap.get(arcId);
    if (existing) return existing;
    const id = factory(kind);
    idMap.set(arcId, id);
    return id;
  };
  const lookup = (arcId: string | null | undefined): string | null => (arcId ? idMap.get(arcId) ?? null : null);

  const boardsIn = record<ArcweaveBoard | ArcweaveFolder>(project.boards);
  const elementsIn = record<ArcweaveProject['elements'][string]>(project.elements);
  const branchesIn = record<ArcweaveProject['branches'][string]>(project.branches);
  const jumpersIn = record<ArcweaveProject['jumpers'][string]>(project.jumpers);
  const notesIn = record<ArcweaveProject['notes'][string]>(project.notes);
  const connectionsIn = record<ArcweaveProject['connections'][string]>(project.connections);
  const conditionsIn = record<ArcweaveProject['conditions'][string]>(project.conditions);
  const componentsIn = record<ArcweaveComponent | ArcweaveFolder>(project.components);
  const attributesIn = record<ArcweaveAttribute>(project.attributes);
  const variablesIn = record<ArcweaveVariable | ArcweaveFolder>(project.variables);
  const assetsIn = record<ArcweaveProject['assets'][string]>(project.assets);

  // Pass 1: registrer ider så referanser (jumper-mål, startelement, cover) løses uansett rekkefølge.
  for (const id of Object.keys(elementsIn)) newId('element', id);
  for (const id of Object.keys(branchesIn)) newId('element', id);
  for (const id of Object.keys(jumpersIn)) newId('element', id);
  for (const id of Object.keys(notesIn)) newId('element', id);
  for (const [id, v] of Object.entries(componentsIn)) if (!isArcweaveFolder(v)) newId('component', id);
  for (const [id, v] of Object.entries(assetsIn)) if (!isArcweaveFolder(v)) newId('asset', id);
  for (const [id, v] of Object.entries(boardsIn)) if (!isArcweaveFolder(v)) newId('board', id);

  // ── Ressurser ───────────────────────────────────────────────────────
  const assetPaths = folderPaths(assetsIn);
  const assets: FormatAsset[] = [];
  for (const [arcId, a] of Object.entries(assetsIn)) {
    if (isArcweaveFolder(a)) continue;
    const type = str(a.type).toLowerCase();
    const kind = type === 'audio' || type === 'video' ? type : 'image';
    if (type && type !== kind) warn(`Ressurs «${a.name}» har typen «${a.type}» — importert som bilde.`, arcId);
    const url = typeof a.url === 'string' && /^https?:\/\//i.test(a.url) ? a.url : null;
    assets.push({
      id: newId('asset', arcId), projectId, kind, name: str(a.name) || 'Ressurs',
      storageKey: null, externalUrl: url, mime: null, sizeBytes: null,
      folderPath: assetPaths.get(arcId) ?? '', createdAt: now, updatedAt: now,
    });
    if (!url) warn(`Ressursfila «${a.name}» følger ikke med i JSON — legg til URL i Ressurser.`, arcId);
  }
  const assetRef = (cover: { id?: string } | null | undefined): string | null => {
    const id = cover?.id ? lookup(cover.id) : null;
    return id && assets.some((a) => a.id === id) ? id : null;
  };

  // ── Brett ───────────────────────────────────────────────────────────
  const boardPaths = folderPaths(boardsIn);
  const boards: FormatBoard[] = [];
  const boardOfArcElement = new Map<string, string>();
  let boardOrder = 0;
  for (const [arcId, b] of Object.entries(boardsIn)) {
    if (isArcweaveFolder(b)) continue;
    const id = newId('board', arcId);
    boards.push({
      id, projectId, name: str(b.name) || 'Brett', customId: b.customId ? str(b.customId) : null,
      folderPath: boardPaths.get(arcId) ?? '', sortOrder: boardOrder++, viewport: {}, createdAt: now, updatedAt: now,
    });
    for (const list of [b.elements, b.branches, b.jumpers, b.notes]) {
      for (const child of Array.isArray(list) ? list : []) boardOfArcElement.set(child, id);
    }
  }
  if (boards.length === 0) {
    boards.push({ id: factory('board'), projectId, name: 'Brett 1', customId: null, folderPath: '', sortOrder: 0, viewport: {}, createdAt: now, updatedAt: now });
    warn('Prosjektet hadde ingen brett — alt ble lagt på «Brett 1».');
  }
  const fallbackBoardId = boards[0].id;
  const boardFor = (arcId: string, label: string): string => {
    const b = boardOfArcElement.get(arcId);
    if (b) return b;
    warn(`${label} lå ikke på noe brett — lagt på «${boards[0].name}».`, arcId);
    return fallbackBoardId;
  };

  // ── Elementer ───────────────────────────────────────────────────────
  const elements: FormatElement[] = [];
  const elementComponents: FormatElementComponent[] = [];
  let elementOrder = 0;
  const base = (arcId: string, kind: FormatElement['kind'], label: string): FormatElement => ({
    id: newId('element', arcId), projectId, boardId: boardFor(arcId, label), kind,
    titleHtml: '', contentHtml: '', x: 0, y: 0, width: 260, height: 120, theme: 'default',
    coverAssetId: null, customId: null, jumperTargetId: null, branchConditions: [],
    version: 1, sortOrder: elementOrder++, createdAt: now, updatedAt: now, i18n: {},
  });

  for (const [arcId, e] of Object.entries(elementsIn)) {
    const el = base(arcId, 'element', `Elementet «${str(e.title).replace(/<[^>]+>/g, '') || arcId}»`);
    el.titleHtml = str(e.title);
    el.contentHtml = str(e.content);
    el.x = num(e.x, 0); el.y = num(e.y, 0);
    el.width = num(e.width, 260); el.height = num(e.height, 120);
    el.theme = normalizeTheme(e.theme);
    el.coverAssetId = assetRef(e.assets?.cover);
    el.customId = typeof e.customId === 'string' && e.customId.trim() ? e.customId.trim() : null;
    elements.push(el);
    (Array.isArray(e.components) ? e.components : []).forEach((compArcId, i) => {
      const compId = lookup(compArcId);
      if (!compId) { warn(`Elementet «${arcId}» peker på en komponent som ikke finnes.`, compArcId); return; }
      elementComponents.push({ elementId: el.id, componentId: compId, sortOrder: i });
    });
  }

  // Forgreninger: betingelser → branchConditions; betingelses-id → forgrening (for koblinger).
  const branchOfCondition = new Map<string, { branchId: string; conditionId: string }>();
  for (const [arcId, b] of Object.entries(branchesIn)) {
    const el = base(arcId, 'branch', 'Forgreningen');
    el.x = num(b.x, 0); el.y = num(b.y, 0); el.width = 200; el.height = 80;
    el.theme = normalizeTheme(b.theme);
    const conds: ExportBranchCondition[] = [];
    const condRefs: Array<{ arcId: string; isElse: boolean }> = [];
    const c = b.conditions ?? { ifCondition: '' };
    if (c.ifCondition) condRefs.push({ arcId: c.ifCondition, isElse: false });
    for (const ei of Array.isArray(c.elseIfConditions) ? c.elseIfConditions : []) condRefs.push({ arcId: ei, isElse: false });
    if (c.elseCondition) condRefs.push({ arcId: c.elseCondition, isElse: true });
    for (const ref of condRefs) {
      const cond = conditionsIn[ref.arcId];
      if (!cond) { warn('Forgreningen peker på en betingelse som ikke finnes.', ref.arcId); continue; }
      const conditionId = factory('condition');
      const script = ref.isElse ? null : (typeof cond.script === 'string' && cond.script.trim() ? cond.script : 'true');
      conds.push({ id: conditionId, script, label: ref.isElse ? 'Ellers' : null });
      branchOfCondition.set(ref.arcId, { branchId: el.id, conditionId });
    }
    if (conds.length === 0) {
      conds.push({ id: factory('condition'), script: 'true', label: null });
      warn('Forgreningen manglet betingelser — fikk en «true»-betingelse.', arcId);
    }
    el.branchConditions = conds;
    elements.push(el);
  }

  for (const [arcId, j] of Object.entries(jumpersIn)) {
    const el = base(arcId, 'jumper', 'Jumperen');
    el.x = num(j.x, 0); el.y = num(j.y, 0); el.width = 160; el.height = 60;
    const target = lookup(j.elementId);
    if (j.elementId && !target) warn('Jumperen peker på et element som ikke finnes.', arcId);
    el.jumperTargetId = target;
    elements.push(el);
  }

  for (const [arcId, n] of Object.entries(notesIn)) {
    const el = base(arcId, 'note', 'Notatet');
    el.contentHtml = str(n.content);
    el.x = num(n.x, 0); el.y = num(n.y, 0);
    el.width = num(n.width, 200); el.height = num(n.height, 120);
    el.theme = normalizeTheme(n.theme);
    elements.push(el);
  }
  const elementById = new Map(elements.map((e) => [e.id, e]));

  // ── Koblinger ───────────────────────────────────────────────────────
  const connections: FormatConnection[] = [];
  let connOrder = 0;
  for (const [arcId, c] of Object.entries(connectionsIn)) {
    let sourceId: string | null;
    let sourceOutputKey = 'default';
    if (c.sourceType === 'conditions') {
      const ref = branchOfCondition.get(c.sourceid);
      sourceId = ref?.branchId ?? null;
      if (ref) sourceOutputKey = ref.conditionId;
    } else {
      sourceId = lookup(c.sourceid);
    }
    const targetId = lookup(c.targetid);
    const source = sourceId ? elementById.get(sourceId) : undefined;
    const target = targetId ? elementById.get(targetId) : undefined;
    if (!source || !target || source.kind === 'note' || target.kind === 'note') {
      warn('Koblingen peker på noe som ikke finnes og ble droppet.', arcId);
      continue;
    }
    connections.push({
      id: newId('connection', arcId), projectId, boardId: source.boardId, sourceId: source.id, targetId: target.id,
      sourceOutputKey, labelHtml: typeof c.label === 'string' ? c.label : '', sortOrder: connOrder++, createdAt: now, updatedAt: now, i18n: {},
    });
  }

  // ── Komponenter ─────────────────────────────────────────────────────
  const componentPaths = folderPaths(componentsIn);
  const components: FormatComponent[] = [];
  let compOrder = 0;
  for (const [arcId, c] of Object.entries(componentsIn)) {
    if (isArcweaveFolder(c)) continue;
    components.push({
      id: newId('component', arcId), projectId, name: str(c.name) || 'Komponent', folderPath: componentPaths.get(arcId) ?? '',
      coverAssetId: assetRef(c.assets?.cover), customId: c.customId ? str(c.customId) : null,
      sortOrder: compOrder++, createdAt: now, updatedAt: now,
    });
  }

  // ── Attributter ─────────────────────────────────────────────────────
  const attributes: FormatAttribute[] = [];
  let attrOrder = 0;
  for (const [arcId, a] of Object.entries(attributesIn)) {
    const ownerKind: FormatAttribute['ownerKind'] | null =
      a.cType === 'elements' ? 'element' : a.cType === 'components' ? 'component' : a.cType === 'boards' ? 'board' : null;
    const ownerId = lookup(a.cId);
    if (!ownerKind || !ownerId) { warn(`Attributtet «${a.name}» har en eier som ikke finnes.`, arcId); continue; }
    const v = a.value ?? { data: '', type: 'string' };
    let type: FormatAttributeType;
    let value: unknown;
    switch (v.type) {
      case 'string': type = v.plain === false ? 'rich_text' : 'string'; value = str(v.data); break;
      case 'integer': type = 'int'; value = Math.trunc(num(v.data, 0)); break;
      case 'float': type = 'float'; value = num(v.data, 0); break;
      case 'boolean': type = 'bool'; value = v.data === true || v.data === 'true'; break;
      case 'component-list':
      case 'asset-list': {
        type = v.type === 'component-list' ? 'component_list' : 'asset_list';
        value = (Array.isArray(v.data) ? v.data : []).map((x) => lookup(typeof x === 'string' ? x : null)).filter((x): x is string => !!x);
        break;
      }
      default:
        type = 'string'; value = str(v.data);
        warn(`Attributtet «${a.name}» har ukjent type «${String(v.type)}» — importert som tekst.`, arcId);
    }
    attributes.push({
      id: newId('attribute', arcId), projectId, ownerKind, ownerId, name: str(a.name) || 'attributt', type, value,
      customId: null, sortOrder: attrOrder++, createdAt: now, updatedAt: now,
    });
  }

  // ── Variabler ───────────────────────────────────────────────────────
  const variables: FormatVariable[] = [];
  const seenNames = new Set<string>();
  let varOrder = 0;
  for (const [arcId, v] of Object.entries(variablesIn)) {
    if (isArcweaveFolder(v)) continue;
    const rawName = str(v.name);
    let name = rawName;
    if (!VARIABLE_NAME_RE.test(name)) {
      name = sanitizeVariableName(rawName);
      warn(`Variabelen «${rawName}» fikk navnet «${name}» (kun bokstaver, tall og _).`, arcId);
    }
    if (seenNames.has(name)) { warn(`Variabelen «${name}» finnes flere ganger — bare den første ble importert.`, arcId); continue; }
    seenNames.add(name);
    const t = str(v.type).toLowerCase();
    const type: FormatVariable['type'] = t === 'integer' || t === 'int' ? 'int' : t === 'float' ? 'float' : t === 'boolean' || t === 'bool' ? 'bool' : 'string';
    const defaultValue = type === 'int' ? Math.trunc(num(v.value, 0)) : type === 'float' ? num(v.value, 0)
      : type === 'bool' ? v.value === true || v.value === 'true' : str(v.value);
    variables.push({ id: newId('variable', arcId), projectId, name, type, defaultValue, sortOrder: varOrder++, createdAt: now, updatedAt: now });
  }

  // ── Innstillinger ───────────────────────────────────────────────────
  const startingElementId = lookup(project.startingElement);
  if (project.startingElement && !startingElementId) warn('Startelementet i Arcweave-prosjektet finnes ikke.', project.startingElement);
  const coverAssetId = assetRef(project.cover ?? null);

  return {
    graph: {
      settings: { projectId, title: str(project.name) || null, startingElementId, coverAssetId, schemaVersion: 1, updatedAt: now, locales: ['nb'], i18n: {} },
      boards, elements, connections, components, elementComponents, attributes, variables, assets,
    },
    warnings,
  };
}
