/**
 * Frontend-klient for /api/role-room/narrative (Story Graph).
 *
 * Følger dans-mønsteret: ren fetch + `credentials: 'include'` + typede feil.
 * `NarrativeConflictError` bærer serverens gjeldende rad ved 409 så UI kan
 * vise «noen andre endret dette» i stedet for å overskrive stille.
 */

import { narrativeAuthHeaders } from './narrativeAuthHeaders';
import type {
  NarrativeAsset,
  NarrativeAssetKind,
  NarrativeAttribute,
  NarrativeAttributeOwnerKind,
  NarrativeAttributeType,
  NarrativeBoard,
  NarrativeBranchCondition,
  NarrativeComponent,
  NarrativeConnection,
  NarrativeElement,
  NarrativeElementComponent,
  NarrativeElementKind,
  NarrativeGraph,
  NarrativeRevisionMeta,
  NarrativeSettings,
  NarrativeVariable,
  NarrativeVariableType,
} from './narrativeTypes';

const BASE = '/api/role-room/narrative';

export class NarrativeApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly code: string | null = null) {
    super(message);
    this.name = 'NarrativeApiError';
  }
}

export class NarrativeConflictError extends NarrativeApiError {
  constructor(public readonly current: NarrativeElement) {
    super('Elementet ble endret av noen andre.', 409, 'conflict');
    this.name = 'NarrativeConflictError';
  }
}

export class NarrativeNetworkError extends Error {
  constructor() {
    super('Ingen forbindelse til Story Graph-tjenesten.');
    this.name = 'NarrativeNetworkError';
  }
}

type Envelope<T> = { success: true; data: T };

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      credentials: 'include',
      headers: narrativeAuthHeaders({
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...((init.headers as Record<string, string> | undefined) ?? {}),
      }),
    });
  } catch {
    throw new NarrativeNetworkError();
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string; data?: unknown };
    if (res.status === 409 && body.error === 'conflict' && body.data) {
      throw new NarrativeConflictError(body.data as NarrativeElement);
    }
    throw new NarrativeApiError(body.message || body.error || `HTTP ${res.status}`, res.status, body.error ?? null);
  }
  if (res.status === 204) return undefined as T;
  const json = (await res.json()) as Envelope<T> | T;
  return (json && typeof json === 'object' && 'success' in json && 'data' in json)
    ? (json as Envelope<T>).data
    : (json as T);
}

const p = (projectId: string, rest = ''): string => `/projects/${encodeURIComponent(projectId)}${rest}`;
const id = (value: string): string => encodeURIComponent(value);
const json = (body: unknown): string => JSON.stringify(body);

// ─── Graf + innstillinger ────────────────────────────────────────────────

export function getGraph(projectId: string): Promise<NarrativeGraph> {
  return request<NarrativeGraph>(p(projectId, '/graph'));
}

export interface SettingsPatch {
  title?: string | null;
  startingElementId?: string | null;
  coverAssetId?: string | null;
}
export function updateSettings(projectId: string, patch: SettingsPatch): Promise<NarrativeSettings> {
  return request<NarrativeSettings>(p(projectId, '/settings'), { method: 'PUT', body: json(patch) });
}

// ─── Brett ──────────────────────────────────────────────────────────────

export interface BoardInput {
  name: string;
  customId?: string | null;
  folderPath?: string;
  sortOrder?: number;
  viewport?: Record<string, unknown>;
}
export function createBoard(projectId: string, input: BoardInput): Promise<NarrativeBoard> {
  return request<NarrativeBoard>(p(projectId, '/boards'), { method: 'POST', body: json(input) });
}
export function patchBoard(projectId: string, boardId: string, patch: Partial<BoardInput>): Promise<NarrativeBoard> {
  return request<NarrativeBoard>(p(projectId, `/boards/${id(boardId)}`), { method: 'PATCH', body: json(patch) });
}
export function deleteBoard(projectId: string, boardId: string): Promise<void> {
  return request<void>(p(projectId, `/boards/${id(boardId)}`), { method: 'DELETE' });
}

// ─── Elementer ──────────────────────────────────────────────────────────

export interface ElementInput {
  boardId: string;
  kind?: NarrativeElementKind;
  titleHtml?: string;
  contentHtml?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  theme?: string;
  coverAssetId?: string | null;
  customId?: string | null;
  jumperTargetId?: string | null;
  branchConditions?: Array<Partial<NarrativeBranchCondition>>;
  sortOrder?: number;
}
export type ElementPatch = Partial<ElementInput>;

export function createElement(projectId: string, input: ElementInput): Promise<NarrativeElement> {
  return request<NarrativeElement>(p(projectId, '/elements'), { method: 'POST', body: json(input) });
}
export function patchElement(
  projectId: string, elementId: string, patch: ElementPatch, expectedVersion: number | null = null,
): Promise<NarrativeElement> {
  return request<NarrativeElement>(p(projectId, `/elements/${id(elementId)}`), {
    method: 'PATCH',
    body: json(patch),
    headers: expectedVersion ? { 'If-Match': String(expectedVersion) } : {},
  });
}
export interface ElementMove {
  id: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
}
export function moveElements(projectId: string, moves: ElementMove[]): Promise<NarrativeElement[]> {
  return request<NarrativeElement[]>(p(projectId, '/elements/moves'), { method: 'POST', body: json({ moves }) });
}
export function deleteElement(projectId: string, elementId: string): Promise<void> {
  return request<void>(p(projectId, `/elements/${id(elementId)}`), { method: 'DELETE' });
}
export function setElementComponents(projectId: string, elementId: string, componentIds: string[]): Promise<NarrativeElementComponent[]> {
  return request<NarrativeElementComponent[]>(p(projectId, `/elements/${id(elementId)}/components`), {
    method: 'PUT', body: json({ componentIds }),
  });
}

// ─── Koblinger ──────────────────────────────────────────────────────────

export interface ConnectionInput {
  boardId: string;
  sourceId: string;
  targetId: string;
  sourceOutputKey?: string;
  labelHtml?: string;
  sortOrder?: number;
}
export function createConnection(projectId: string, input: ConnectionInput): Promise<NarrativeConnection> {
  return request<NarrativeConnection>(p(projectId, '/connections'), { method: 'POST', body: json(input) });
}
export function patchConnection(
  projectId: string, connectionId: string, patch: Partial<Pick<ConnectionInput, 'targetId' | 'sourceOutputKey' | 'labelHtml' | 'sortOrder'>>,
): Promise<NarrativeConnection> {
  return request<NarrativeConnection>(p(projectId, `/connections/${id(connectionId)}`), { method: 'PATCH', body: json(patch) });
}
export function deleteConnection(projectId: string, connectionId: string): Promise<void> {
  return request<void>(p(projectId, `/connections/${id(connectionId)}`), { method: 'DELETE' });
}

// ─── Komponenter + attributter ──────────────────────────────────────────

export interface ComponentInput {
  name: string;
  folderPath?: string;
  coverAssetId?: string | null;
  customId?: string | null;
  sortOrder?: number;
}
export function createComponent(projectId: string, input: ComponentInput): Promise<NarrativeComponent> {
  return request<NarrativeComponent>(p(projectId, '/components'), { method: 'POST', body: json(input) });
}
export function patchComponent(projectId: string, componentId: string, patch: Partial<ComponentInput>): Promise<NarrativeComponent> {
  return request<NarrativeComponent>(p(projectId, `/components/${id(componentId)}`), { method: 'PATCH', body: json(patch) });
}
export function deleteComponent(projectId: string, componentId: string): Promise<void> {
  return request<void>(p(projectId, `/components/${id(componentId)}`), { method: 'DELETE' });
}

export interface AttributeInput {
  ownerKind: NarrativeAttributeOwnerKind;
  ownerId: string;
  name: string;
  type?: NarrativeAttributeType;
  value?: unknown;
  customId?: string | null;
  sortOrder?: number;
}
export function createAttribute(projectId: string, input: AttributeInput): Promise<NarrativeAttribute> {
  return request<NarrativeAttribute>(p(projectId, '/attributes'), { method: 'POST', body: json(input) });
}
export function patchAttribute(
  projectId: string, attributeId: string, patch: Partial<Omit<AttributeInput, 'ownerKind' | 'ownerId'>>,
): Promise<NarrativeAttribute> {
  return request<NarrativeAttribute>(p(projectId, `/attributes/${id(attributeId)}`), { method: 'PATCH', body: json(patch) });
}
export function deleteAttribute(projectId: string, attributeId: string): Promise<void> {
  return request<void>(p(projectId, `/attributes/${id(attributeId)}`), { method: 'DELETE' });
}

// ─── Variabler ──────────────────────────────────────────────────────────

export interface VariableInput {
  name: string;
  type?: NarrativeVariableType;
  defaultValue?: unknown;
  sortOrder?: number;
}
export function createVariable(projectId: string, input: VariableInput): Promise<NarrativeVariable> {
  return request<NarrativeVariable>(p(projectId, '/variables'), { method: 'POST', body: json(input) });
}
export function patchVariable(projectId: string, variableId: string, patch: Partial<VariableInput>): Promise<NarrativeVariable> {
  return request<NarrativeVariable>(p(projectId, `/variables/${id(variableId)}`), { method: 'PATCH', body: json(patch) });
}
export function deleteVariable(projectId: string, variableId: string): Promise<void> {
  return request<void>(p(projectId, `/variables/${id(variableId)}`), { method: 'DELETE' });
}

// ─── Ressurser ──────────────────────────────────────────────────────────

export interface AssetInput {
  kind?: NarrativeAssetKind;
  name: string;
  externalUrl?: string | null;
  mime?: string | null;
  sizeBytes?: number | null;
  folderPath?: string;
}
export function createAsset(projectId: string, input: AssetInput): Promise<NarrativeAsset> {
  return request<NarrativeAsset>(p(projectId, '/assets'), { method: 'POST', body: json(input) });
}
export function patchAsset(projectId: string, assetId: string, patch: Partial<AssetInput>): Promise<NarrativeAsset> {
  return request<NarrativeAsset>(p(projectId, `/assets/${id(assetId)}`), { method: 'PATCH', body: json(patch) });
}
export function deleteAsset(projectId: string, assetId: string): Promise<void> {
  return request<void>(p(projectId, `/assets/${id(assetId)}`), { method: 'DELETE' });
}

// ─── Revisjoner ─────────────────────────────────────────────────────────

export function listRevisions(projectId: string): Promise<NarrativeRevisionMeta[]> {
  return request<NarrativeRevisionMeta[]>(p(projectId, '/revisions'));
}
export function createRevision(projectId: string, label: string | null): Promise<NarrativeRevisionMeta> {
  return request<NarrativeRevisionMeta>(p(projectId, '/revisions'), { method: 'POST', body: json({ label }) });
}
export function restoreRevision(projectId: string, revisionId: string): Promise<{ backup: NarrativeRevisionMeta; graph: NarrativeGraph }> {
  return request<{ backup: NarrativeRevisionMeta; graph: NarrativeGraph }>(
    p(projectId, `/revisions/${id(revisionId)}/restore`), { method: 'POST', body: json({}) },
  );
}
