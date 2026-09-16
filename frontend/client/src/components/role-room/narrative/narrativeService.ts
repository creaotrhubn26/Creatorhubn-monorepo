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
  NarrativeImportWarning,
  NarrativeMemberLite,
  NarrativePublicStory,
  NarrativeScene,
  NarrativeSceneDetail,
  NarrativeSceneFrame,
  NarrativeSceneLink,
  NarrativeSceneLinkKind,
  NarrativeSceneReview,
  NarrativeSceneStatus,
  NarrativeSceneSummary,
  NarrativeSceneTask,
  NarrativeSceneTaskStatus,
  NarrativeRevisionMeta,
  NarrativeShareLink,
  NarrativeShareMode,
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

/** 409 ved review-beslutning: scenen er endret siden runden ble sendt. */
export class NarrativeStaleReviewError extends NarrativeApiError {
  constructor(public readonly currentHash: string | null) {
    super('Scenen er endret siden runden ble sendt — send ny runde.', 409, 'snapshot_stale');
    this.name = 'NarrativeStaleReviewError';
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
    if (res.status === 409 && body.error === 'snapshot_stale') {
      throw new NarrativeStaleReviewError(typeof (body as { currentHash?: unknown }).currentHash === 'string' ? (body as { currentHash: string }).currentHash : null);
    }
    throw new NarrativeApiError(body.message || body.error || `HTTP ${res.status}`, res.status, body.error ?? null);
  }
  if (res.status === 204) return undefined as T;
  const json = (await res.json()) as Envelope<T> | T;
  return (json && typeof json === 'object' && 'success' in json && 'data' in json)
    ? (json as Envelope<T>).data
    : (json as T);
}

/** Binær nedlasting (PDF). 402 → NarrativeApiError med code 'plan_required'. */
async function requestBlob(path: string): Promise<{ blob: Blob; filename: string | null }> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { credentials: 'include', headers: narrativeAuthHeaders() });
  } catch {
    throw new NarrativeNetworkError();
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new NarrativeApiError(body.message || body.error || `HTTP ${res.status}`, res.status, body.error ?? null);
  }
  const disposition = res.headers.get('content-disposition') ?? '';
  const m = /filename="([^"]+)"/.exec(disposition);
  return { blob: await res.blob(), filename: m ? m[1] : null };
}

const p = (projectId: string, rest = ''): string => `/projects/${encodeURIComponent(projectId)}${rest}`;
const id = (value: string): string => encodeURIComponent(value);
const json = (body: unknown): string => JSON.stringify(body);

// ─── Graf + innstillinger ────────────────────────────────────────────────

export function getGraph(projectId: string): Promise<NarrativeGraph> {
  return request<NarrativeGraph>(p(projectId, '/graph'));
}

export interface TranslationEntry {
  ownerKind: 'element' | 'connection' | 'settings';
  id: string;
  field: 'titleHtml' | 'contentHtml' | 'labelHtml' | 'title';
  html: string;
}

export function saveTranslations(projectId: string, locale: string, entries: TranslationEntry[]): Promise<{ saved: number }> {
  return request(p(projectId, '/translations'), { method: 'PUT', body: json({ locale, entries }) });
}

export interface TranslateRequest {
  sourceLocale?: string;
  targetLocale: string;
  storyContext?: string;
  segments: Array<{ key: string; text: string; context?: string }>;
}

export function translateSegments(projectId: string, body: TranslateRequest): Promise<{ translations: Array<{ key: string; text: string }>; missing: string[]; model: string }> {
  return request(p(projectId, '/translate'), { method: 'POST', body: json(body) });
}

export interface SettingsPatch {
  title?: string | null;
  startingElementId?: string | null;
  coverAssetId?: string | null;
  locales?: string[];
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

// ─── Fase 3: import, delingslenker, offentlig spill ─────────────────────

export interface ImportResult {
  graph: NarrativeGraph;
  warnings: NarrativeImportWarning[];
  backup: NarrativeRevisionMeta;
  format: 'arcweave' | 'twee' | 'ink';
  stats?: { elements: number; connections: number; variables: number; unsupported: number };
}

export type ImportBody =
  | { format: 'arcweave'; project: Record<string, unknown> }
  | { format: 'twee' | 'ink'; source: string; title?: string | null };

/** Erstatter hele grafen med et importert prosjekt (server tar revisjon først). */
export function importProject(projectId: string, body: ImportBody): Promise<ImportResult> {
  return request(p(projectId, '/import'), { method: 'POST', body: json(body) });
}

/** Bakoverkompatibel innpakning for Arcweave-JSON. */
export function importArcweave(projectId: string, project: Record<string, unknown>): Promise<ImportResult> {
  return importProject(projectId, { format: 'arcweave', project });
}

export function listShareLinks(projectId: string): Promise<NarrativeShareLink[]> {
  return request(p(projectId, '/share-links'));
}

export interface ShareLinkInput {
  mode?: NarrativeShareMode;
  expiresInDays?: number | null;
}

export function createShareLink(projectId: string, input: ShareLinkInput): Promise<{ link: NarrativeShareLink; token: string; path: string }> {
  return request(p(projectId, '/share-links'), { method: 'POST', body: json(input) });
}

export function revokeShareLink(projectId: string, linkId: string): Promise<NarrativeShareLink> {
  return request(p(projectId, `/share-links/${id(linkId)}/revoke`), { method: 'POST' });
}

/** Offentlig (ingen innlogging): grafen bak et delingstoken. null = ugyldig/utløpt/tilbakekalt. */
export async function getPublicStory(token: string): Promise<NarrativePublicStory | null> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/public/${encodeURIComponent(token)}`, { credentials: 'omit' });
  } catch {
    throw new NarrativeNetworkError();
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new NarrativeApiError(`HTTP ${res.status}`, res.status);
  const body = (await res.json()) as Envelope<NarrativePublicStory>;
  return body.data;
}

// ─── Fase 5c: PDF-eksport (server-side, Pro/Studio) ──────────────────────

export function exportPdf(projectId: string, locale: string | null): Promise<{ blob: Blob; filename: string | null }> {
  const q = locale && locale !== 'nb' ? `?locale=${encodeURIComponent(locale)}` : '';
  return requestBlob(p(projectId, `/export.pdf${q}`));
}

// ─── Fase 6: scener, rammer, oppgaver, review ──────────────────────────

export interface SceneInput {
  code?: string | null;
  title?: string;
  subtitle?: string;
  location?: string;
  challenge?: string;
  gameplayMechanic?: string;
  environment?: string;
  status?: NarrativeSceneStatus;
  assigneeUserId?: string | null;
  dueAt?: string | null;
  heroAssetId?: string | null;
  sortOrder?: number;
}

export function listScenes(projectId: string): Promise<{ scenes: NarrativeSceneSummary[]; nextCode: string }> {
  return request(p(projectId, '/scenes'));
}
export function createScene(projectId: string, input: SceneInput): Promise<NarrativeScene> {
  return request(p(projectId, '/scenes'), { method: 'POST', body: json(input) });
}
export function getSceneDetail(projectId: string, sceneId: string): Promise<NarrativeSceneDetail> {
  return request(p(projectId, `/scenes/${id(sceneId)}`));
}
export function patchScene(projectId: string, sceneId: string, patch: SceneInput): Promise<NarrativeScene> {
  return request(p(projectId, `/scenes/${id(sceneId)}`), { method: 'PATCH', body: json(patch) });
}
export function deleteScene(projectId: string, sceneId: string): Promise<void> {
  return request(p(projectId, `/scenes/${id(sceneId)}`), { method: 'DELETE' });
}
export function setSceneLinks(projectId: string, sceneId: string, links: Array<{ ownerKind: NarrativeSceneLinkKind; ownerId: string }>): Promise<NarrativeSceneLink[]> {
  return request(p(projectId, `/scenes/${id(sceneId)}/links`), { method: 'PUT', body: json({ links }) });
}
export function createSceneFrame(projectId: string, sceneId: string, input: { assetId?: string | null; externalUrl?: string | null; caption?: string }): Promise<NarrativeSceneFrame> {
  return request(p(projectId, `/scenes/${id(sceneId)}/frames`), { method: 'POST', body: json(input) });
}
export function patchSceneFrame(projectId: string, sceneId: string, frameId: string, patch: { caption?: string }): Promise<NarrativeSceneFrame> {
  return request(p(projectId, `/scenes/${id(sceneId)}/frames/${id(frameId)}`), { method: 'PATCH', body: json(patch) });
}
export function deleteSceneFrame(projectId: string, sceneId: string, frameId: string): Promise<void> {
  return request(p(projectId, `/scenes/${id(sceneId)}/frames/${id(frameId)}`), { method: 'DELETE' });
}
export function reorderSceneFrames(projectId: string, sceneId: string, orderedIds: string[]): Promise<void> {
  return request(p(projectId, `/scenes/${id(sceneId)}/frames/order`), { method: 'PUT', body: json({ orderedIds }) });
}
export function createSceneTask(projectId: string, sceneId: string, input: { title: string; assigneeUserId?: string | null; dueAt?: string | null }): Promise<NarrativeSceneTask> {
  return request(p(projectId, `/scenes/${id(sceneId)}/tasks`), { method: 'POST', body: json(input) });
}
export function patchSceneTask(projectId: string, sceneId: string, taskId: string, patch: { title?: string; status?: NarrativeSceneTaskStatus; assigneeUserId?: string | null; dueAt?: string | null }): Promise<NarrativeSceneTask> {
  return request(p(projectId, `/scenes/${id(sceneId)}/tasks/${id(taskId)}`), { method: 'PATCH', body: json(patch) });
}
export function deleteSceneTask(projectId: string, sceneId: string, taskId: string): Promise<void> {
  return request(p(projectId, `/scenes/${id(sceneId)}/tasks/${id(taskId)}`), { method: 'DELETE' });
}
export function listSceneReviews(projectId: string, sceneId: string): Promise<NarrativeSceneReview[]> {
  return request(p(projectId, `/scenes/${id(sceneId)}/reviews`));
}
/** 402 → NarrativeApiError code 'plan_required' (scene_review). */
export function requestSceneReview(projectId: string, sceneId: string, note: string | null): Promise<NarrativeSceneReview> {
  return request(p(projectId, `/scenes/${id(sceneId)}/reviews`), { method: 'POST', body: json({ note }) });
}
/** 409 snapshot_stale → NarrativeStaleReviewError; 409 review_closed → NarrativeApiError code 'review_closed'. */
export function decideSceneReview(
  projectId: string, sceneId: string, reviewId: string,
  input: { decision: 'approved' | 'changes_requested'; note?: string | null; expectedSnapshotHash?: string | null },
): Promise<NarrativeSceneReview> {
  return request(p(projectId, `/scenes/${id(sceneId)}/reviews/${id(reviewId)}/decision`), { method: 'POST', body: json(input) });
}
export function listMembersLite(projectId: string): Promise<NarrativeMemberLite[]> {
  return request(p(projectId, '/members-lite'));
}
