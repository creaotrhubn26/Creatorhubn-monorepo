/**
 * Story Graph-ruter — /api/role-room/narrative
 *
 * Alle ruter ligger under /projects/:projectId og gates av
 * canAccessRoleRoomProject (eier eller casting_user_roles-medlem) — samme
 * regel som resten av Role Room. Svar-konvolutt: { success: true, data }.
 *
 * Optimistisk låsing på elementer: PATCH med `If-Match: <version>` (eller
 * body.expectedVersion) → 409 { error: 'conflict', data: <gjeldende> }.
 */

import {
  Router,
  type NextFunction,
  type Request,
  type Response,
  type Router as ExpressRouter,
} from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import { loadPersistedAuthSession } from './auth-session-store.js';
import { canAccessRoleRoomProject } from './role-room-projects-routes.js';
import * as svc from './role-room-narrative-service.js';
import { resolveUserCapabilitiesForTeam } from './game-team-service.js';
// Delt validator (struktur + skript) — samme kode som frontendens merknader-chip.
import { validateStoryGraph } from '../../frontend/shared/narrative-runtime/validate.ts';
// Delt format-lag (Fase 3): Arcweave JSON, Markdown, filnavn.
import {
  ArcweaveImportError, InkImportError, TweeImportError, LOCALE_CODE_RE, exportFileStem, toArcweaveProject, toCsv, toMarkdown,
} from '../../frontend/shared/narrative-format/index.ts';
import { MAX_TRANSLATE_SEGMENTS, translateSegments } from './narrative-translate.js';
import { renderStoryGraphPdf, storyGraphPdfFilename } from './narrative-pdf.js';
import { broadcastEventToRoom, narrativeRoomKey } from './websocket-chat.js';
import { captureBackendException } from './sentry-init.js';
import { createTokenRateLimiter } from './narrative-rate-limit.js';
import multer from 'multer';
import { createHash } from 'node:crypto';
import {
  DOCUMENT_IMPORT_MAX_BYTES, DocumentImportError, diffAgainstProject, extractDocumentText, parseSceneDocument,
} from './narrative-document-import.js';
import { applyDocumentImport, listExistingScenesForImport } from './narrative-document-import-service.js';
import { createCiHook, listCiDeliveries, listCiHooks, revokeCiHook } from './role-room-narrative-ci-hooks.js';
import { createPlaytestIngestHandler, createPlaytestToken, getPlaytestSummary, listPlaytestTokens, revokePlaytestToken } from './role-room-narrative-playtest.js';
import { AiFrameError, createAiReferenceFrame } from './role-room-narrative-frames-ai.js';
import { presignCreatorHubObjectDownload } from './creatorhub-object-storage.js';
import {
  PlanLimitError, PlanRequiredError, assertGameFeature, assertGameLimit, resolveGamePlanForProject, sendPlanRequired,
  type ResolveProjectPlan,
} from './game-plan-gate.js';
import { notifyUsersByEmail, upsertProducerProjectNotification } from './role-room-producer-notifications.js';

interface SessionData {
  userId: string;
  email: string;
  name: string;
  role: string;
  loginAt: string;
  [key: string]: unknown;
}
type AuthedRequest = Request & { userId: string; projectId: string };

async function resolveUser(pool: Pool, activeSessions: Map<string, SessionData> | undefined, bearer: string | null | undefined) {
  const token = typeof bearer === 'string' ? bearer.trim() : '';
  if (!token) return null;
  const inMemory = activeSessions?.get(token) ?? null;
  if (inMemory) return inMemory;
  const persisted = await loadPersistedAuthSession<SessionData>(pool, token);
  if (persisted) { activeSessions?.set(token, persisted); return persisted; }
  return null;
}

function requireAuth(pool: Pool, activeSessions?: Map<string, SessionData>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim();
    const session = await resolveUser(pool, activeSessions, bearer);
    if (!session?.userId) { res.status(401).json({ error: 'unauthorized' }); return; }
    (req as AuthedRequest).userId = session.userId;
    next();
  };
}

export interface CreateRoleRoomNarrativeRouterDeps {
  activeSessions?: Map<string, SessionData>;
  /** Overstyrbar for tester. Default: canAccessRoleRoomProject. */
  canAccessProject?: (pool: Pool, userId: string, projectId: string) => Promise<boolean>;
  /** Overstyrbar for tester. Default: websocket-chat broadcastEventToRoom. */
  broadcast?: (room: string, message: unknown) => number;
  /** Overstyrbar for tester. Default: prosjekteierens game_plan (solo uten abonnement). */
  resolveProjectPlan?: ResolveProjectPlan;
  /** Overstyrbar for tester. Default: inbox-varsel + e-post (best-effort). */
  notify?: SceneNotifier;
  /** Overstyrbar for tester. Default: game-team-service (eier = alle capabilities). */
  resolveCapabilities?: (pool: Pool, userId: string, teamOrgId: string) => Promise<Set<string>>;
}

/** Fase 6: varsel når en review-runde bes om / avgjøres (inbox + e-post, best-effort). */
export interface SceneNotification {
  event: 'narrative_scene_review_requested' | 'narrative_scene_review_decided';
  projectId: string;
  actorUserId: string;
  scene: svc.NarrativeScene;
  review: svc.NarrativeSceneReview;
  /** Mottakere utenom aktøren (ansvarlig, forespørrer). */
  recipientUserIds: string[];
}
export type SceneNotifier = (pool: Pool, n: SceneNotification) => Promise<void>;

export const defaultSceneNotifier: SceneNotifier = async (pool, n) => {
  const label = `${n.scene.code} – ${n.scene.title || 'Uten tittel'}`;
  const requested = n.event === 'narrative_scene_review_requested';
  const decision = n.review.status === 'approved' ? 'godkjent' : n.review.status === 'changes_requested' ? 'bedt om endringer' : n.review.status;
  const title = requested ? `Review ønsket: ${label} (runde ${n.review.round})` : `Review ${decision}: ${label} (runde ${n.review.round})`;
  const note = requested ? n.review.requestNote : n.review.decisionNote;
  const message = note ? note.slice(0, 500) : null;
  await upsertProducerProjectNotification(pool, {
    projectId: n.projectId, audience: 'producer_team', eventType: n.event, title, message,
    linkedEntityType: 'narrative_scene', linkedEntityId: n.scene.id,
    metadata: { inboxType: 'review', sceneCode: n.scene.code, reviewId: n.review.id, round: n.review.round, status: n.review.status },
    createdByUserId: n.actorUserId, assignedToUserId: n.scene.assigneeUserId ?? null, initiallyReadByUserId: n.actorUserId,
    mentionUserIds: n.recipientUserIds,
  });
  if (n.recipientUserIds.length) {
    const text = `${title}${message ? `\n\n${message}` : ''}\n\nÅpne prosjektet i The Role Room (Scener & gameplay) for å se runden.`;
    await notifyUsersByEmail(pool, {
      projectId: n.projectId, userIds: n.recipientUserIds, subject: title, kind: n.event,
      text, html: `<p>${escapeHtml(title)}</p>${message ? `<p>${escapeHtml(message)}</p>` : ''}<p>Åpne prosjektet i The Role Room (Scener &amp; gameplay) for å se runden.</p>`,
    });
  }
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

export type GraphChangeKind =
  | 'settings' | 'board' | 'element' | 'connection' | 'component' | 'attribute' | 'variable' | 'asset' | 'graph' | 'translation' | 'scene'
  | 'production';

const idSchema = z.string().min(1).max(200);
const nullableStr = (max: number) => z.string().max(max).nullable().optional();
const html = (max: number) => z.string().max(max).optional();
const jsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(jsonValueSchema), z.record(jsonValueSchema)]),
);

const localeCode = z.string().regex(LOCALE_CODE_RE, 'Locale-kode: f.eks. nb, en, sv, pt-BR');
const elementI18n = z.record(localeCode, z.object({ titleHtml: html(20_000), contentHtml: html(200_000) }).partial()).optional();
const connectionI18n = z.record(localeCode, z.object({ labelHtml: html(5000) }).partial()).optional();

const settingsBody = z.object({
  title: nullableStr(300),
  startingElementId: nullableStr(200),
  coverAssetId: nullableStr(200),
  locales: z.array(localeCode).min(1).max(20).optional(),
});

const translationsBody = z.object({
  locale: localeCode,
  entries: z.array(z.discriminatedUnion('ownerKind', [
    z.object({ ownerKind: z.literal('element'), id: idSchema, field: z.enum(['titleHtml', 'contentHtml']), html: z.string().max(200_000) }),
    z.object({ ownerKind: z.literal('connection'), id: idSchema, field: z.literal('labelHtml'), html: z.string().max(5000) }),
    z.object({ ownerKind: z.literal('settings'), id: z.string().max(200), field: z.literal('title'), html: z.string().max(300) }),
  ])).min(1).max(500),
});

const translateBody = z.object({
  sourceLocale: localeCode.optional(),
  targetLocale: localeCode,
  storyContext: z.string().max(300).optional(),
  segments: z.array(z.object({ key: z.string().min(1).max(200), text: z.string().min(1).max(4000), context: z.string().max(200).optional() })).min(1).max(MAX_TRANSLATE_SEGMENTS),
});

const boardBody = z.object({
  name: z.string().min(1).max(200),
  customId: nullableStr(120),
  folderPath: z.string().max(500).optional(),
  sortOrder: z.number().int().optional(),
  viewport: z.record(jsonValueSchema).optional(),
});

const branchConditionSchema = z.object({
  id: z.string().max(200).optional(),
  script: z.string().max(5000).nullable().optional(),
  label: z.string().max(500).nullable().optional(),
});

const elementBody = z.object({
  boardId: idSchema,
  kind: z.enum(['element', 'branch', 'jumper', 'note']).optional(),
  titleHtml: html(20_000),
  contentHtml: html(200_000),
  x: z.number().finite().optional(),
  y: z.number().finite().optional(),
  width: z.number().finite().min(40).max(4000).optional(),
  height: z.number().finite().min(24).max(4000).optional(),
  theme: z.string().max(50).optional(),
  coverAssetId: nullableStr(200),
  customId: nullableStr(120),
  jumperTargetId: nullableStr(200),
  branchConditions: z.array(branchConditionSchema).max(50).optional(),
  sortOrder: z.number().int().optional(),
  i18n: elementI18n,
});

const movesBody = z.object({
  moves: z.array(z.object({
    id: idSchema,
    x: z.number().finite(),
    y: z.number().finite(),
    width: z.number().finite().min(40).max(4000).optional(),
    height: z.number().finite().min(24).max(4000).optional(),
  })).min(1).max(500),
});

const connectionBody = z.object({
  boardId: idSchema,
  sourceId: idSchema,
  targetId: idSchema,
  sourceOutputKey: z.string().max(200).optional(),
  labelHtml: html(5000),
  sortOrder: z.number().int().optional(),
  i18n: connectionI18n,
});

const componentKind = z.enum(['character', 'location', 'item', 'faction', 'other']);
const componentBody = z.object({
  name: z.string().min(1).max(200),
  folderPath: z.string().max(500).optional(),
  coverAssetId: nullableStr(200),
  customId: nullableStr(120),
  sortOrder: z.number().int().optional(),
  // Fase 7: karakter/lokasjon/gjenstand/fraksjon + typet profil (fri JSON, ≤ 64 kB).
  kind: componentKind.optional(),
  profile: z.record(jsonValueSchema).optional(),
});

const elementComponentsBody = z.object({
  componentIds: z.array(idSchema).max(200),
});

const attributeBody = z.object({
  ownerKind: z.enum(['element', 'component', 'board']),
  ownerId: idSchema,
  name: z.string().min(1).max(200),
  type: z.enum(['rich_text', 'string', 'bool', 'int', 'float', 'component_list', 'asset_list']).optional(),
  value: jsonValueSchema.optional(),
  customId: nullableStr(120),
  sortOrder: z.number().int().optional(),
});

const variableName = z.string().regex(/^[A-Za-z_][A-Za-z0-9_]{0,99}$/, 'Variabelnavn: bokstav/underscore først, deretter bokstaver, tall, underscore');
const variableBody = z.object({
  name: variableName,
  type: z.enum(['bool', 'int', 'float', 'string']).optional(),
  defaultValue: jsonValueSchema.optional(),
  sortOrder: z.number().int().optional(),
});

const assetBody = z.object({
  kind: z.enum(['image', 'audio', 'video', 'file']).optional(),
  name: z.string().min(1).max(300),
  externalUrl: z.string().url().max(2000).nullable().optional(),
  mime: nullableStr(120),
  sizeBytes: z.number().int().min(0).nullable().optional(),
  folderPath: z.string().max(500).optional(),
});

const revisionBody = z.object({
  label: z.string().max(200).nullable().optional(),
});

// Import: Arcweave-JSON (bakoverkompatibelt uten `format`), Twee 3 eller Ink som tekst (≤ 5 MB).
const MAX_IMPORT_SOURCE = 5 * 1024 * 1024;
const importBody = z.preprocess(
  (raw) => (raw && typeof raw === 'object' && !('format' in (raw as object)) && 'project' in (raw as object) ? { ...(raw as object), format: 'arcweave' } : raw),
  z.discriminatedUnion('format', [
    z.object({ format: z.literal('arcweave'), project: z.record(z.unknown()) }),
    z.object({ format: z.literal('twee'), source: z.string().min(1).max(MAX_IMPORT_SOURCE), title: nullableStr(300) }),
    z.object({ format: z.literal('ink'), source: z.string().min(1).max(MAX_IMPORT_SOURCE), title: nullableStr(300) }),
  ]),
);

const shareLinkBody = z.object({
  mode: z.enum(['view_play', 'play_only']).optional(),
  expiresInDays: z.number().int().min(1).max(3650).nullable().optional(),
});

// ─── Fase 6: scener, rammer, oppgaver, review ──────────────────────────
const isoDate = z.string().datetime({ offset: true }).nullable().optional();
const sourceRefSchema = z.object({
  tag: z.enum(['W', 'K', 'U', 'A', 'E', 'T']),
  ref: z.string().trim().min(1).max(120),
  field: z.string().max(60).optional(),
  note: z.string().max(1000).optional(),
});
const sceneStatus = z.enum(['idea', 'in_progress', 'in_review', 'changes_requested', 'approved', 'implemented']);
const sceneBody = z.object({
  code: z.string().trim().regex(svc.NARRATIVE_SCENE_CODE_RE, 'Kode: 1–3 bokstaver + 1–4 sifre, f.eks. S12').nullable().optional(),
  title: z.string().max(300).optional(),
  subtitle: z.string().max(300).optional(),
  location: z.string().max(2000).optional(),
  challenge: z.string().max(5000).optional(),
  gameplayMechanic: z.string().max(5000).optional(),
  environment: z.string().max(5000).optional(),
  status: sceneStatus.optional(),
  assigneeUserId: nullableStr(200),
  dueAt: isoDate,
  heroAssetId: nullableStr(200),
  sortOrder: z.number().int().optional(),
  // Fase 7: scenekort v2 (Før / Handling / Kontroll / Etter / Lyd …), kildemerker, epoke.
  beforeState: z.string().max(20_000).optional(),
  action: z.string().max(20_000).optional(),
  control: z.string().max(20_000).optional(),
  afterState: z.string().max(20_000).optional(),
  audio: z.string().max(20_000).optional(),
  changeNote: z.string().max(20_000).optional(),
  bridge: z.string().max(20_000).optional(),
  timeNote: z.string().max(2000).optional(),
  knowledge: z.object({
    actualPast: z.string().max(5000).optional(), recollection: z.string().max(5000).optional(),
    ownerPerspective: z.string().max(5000).optional(), othersObserve: z.string().max(5000).optional(),
    audienceKnows: z.string().max(5000).optional(), saidAloud: z.string().max(5000).optional(),
  }).optional(),
  era: z.enum(['pre', '1797', '1802', '1817', 'other']).optional(),
  episodeId: nullableStr(200),
  startAt: isoDate,
  sourceRefs: z.array(sourceRefSchema).max(100).optional(),
  workingId: nullableStr(40),
});
const sceneLinksBody = z.object({
  links: z.array(z.object({ ownerKind: z.enum(['element', 'board', 'component']), ownerId: idSchema })).max(200),
});
const sceneFrameBody = z.object({
  assetId: nullableStr(200),
  externalUrl: z.string().url().max(2000).nullable().optional(),
  caption: z.string().max(1000).optional(),
  sortOrder: z.number().int().optional(),
}).refine((v) => !!v.assetId !== !!v.externalUrl, { message: 'Oppgi enten assetId eller externalUrl (ikke begge).' });
const sceneFramePatch = z.object({ caption: z.string().max(1000).optional(), sortOrder: z.number().int().optional() });
const orderBody = z.object({ orderedIds: z.array(idSchema).max(500) });
const sceneTaskBody = z.object({
  title: z.string().trim().min(1).max(300),
  status: z.enum(['todo', 'doing', 'done']).optional(),
  assigneeUserId: nullableStr(200),
  dueAt: isoDate,
  sortOrder: z.number().int().optional(),
});
const sceneTaskPatch = sceneTaskBody.partial();
const reviewRequestBody = z.object({ note: z.string().max(5000).nullable().optional() });
const reviewDecisionBody = z.object({
  decision: z.enum(['approved', 'changes_requested']),
  note: z.string().max(5000).nullable().optional(),
  expectedSnapshotHash: z.string().regex(/^[0-9a-f]{64}$/).nullable().optional(),
});

// ─── Fase 7: produksjons-OS (gater, replikker, episoder, spørsmål, kilder, milepæler, plattform) ──
const gateBody = z.object({
  status: z.enum(['not_started', 'in_progress', 'passed', 'failed']),
  evidence: z.string().max(5000).optional(),
  evidenceRefs: z.array(z.string().max(500)).max(50).optional(),
});
const lineBody = z.object({
  cueId: z.string().trim().regex(svc.NARRATIVE_CUE_ID_RE, 'Replikk-ID: f.eks. W01.01, U04.02 eller G03A.1'),
  speakerComponentId: nullableStr(200),
  speakerLabel: z.string().max(200).optional(),
  perspective: z.string().max(500).optional(),
  textEn: z.string().max(5000).optional(),
  textNb: z.string().max(5000).optional(),
  sourceType: z.enum(['E', 'T', 'E+T', 'U', 'A']).optional(),
  recordingStatus: z.enum(['none', 'needs_take', 'recorded', 'approved']).optional(),
  note: z.string().max(2000).optional(),
  sortOrder: z.number().int().optional(),
});
const linePatch = lineBody.partial();
const shortCode = z.string().trim().regex(/^[A-Za-z][A-Za-z0-9_-]{0,39}$/, 'Kode: bokstav + inntil 39 tegn, f.eks. E01, Q07, W');
const episodeBody = z.object({
  code: shortCode,
  title: z.string().max(300).optional(),
  summary: z.string().max(20_000).optional(),
  playersLearn: z.string().max(20_000).optional(),
  sourceNote: z.string().max(5000).optional(),
  status: z.enum(['draft', 'locked']).optional(),
  sortOrder: z.number().int().optional(),
});
const episodePatch = episodeBody.partial();
const openQuestionBody = z.object({
  code: shortCode,
  kind: z.enum(['question', 'check']).optional(),
  question: z.string().trim().min(1).max(5000),
  context: z.string().max(20_000).optional(),
  status: z.enum(['open', 'done', 'dropped']).optional(),
  decision: z.string().max(20_000).optional(),
  sourceRefs: z.array(sourceRefSchema).max(100).optional(),
  sortOrder: z.number().int().optional(),
});
const openQuestionPatch = openQuestionBody.partial();
const sourceBody = z.object({
  code: shortCode,
  label: z.string().trim().min(1).max(300),
  kind: z.enum(['docx', 'pdf', 'md', 'txt', 'other']).optional(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/, 'SHA-256: 64 hex-tegn').nullable().optional(),
  pathHint: z.string().max(1000).optional(),
  notes: z.string().max(5000).optional(),
  sortOrder: z.number().int().optional(),
});
const sourcePatch = sourceBody.partial().extend({ verified: z.boolean().optional() });
const milestoneBody = z.object({
  title: z.string().trim().min(1).max(300),
  lane: z.enum(['story', 'greybox', 'characters', 'playtest', 'picture_audio', 'engineering', 'other']).optional(),
  startAt: isoDate,
  dueAt: isoDate,
  status: z.enum(['planned', 'in_progress', 'done', 'blocked']).optional(),
  ownerUserId: nullableStr(200),
  description: z.string().max(20_000).optional(),
  acceptance: z.string().max(20_000).optional(),
  evidence: z.string().max(20_000).optional(),
  sortOrder: z.number().int().optional(),
});
const milestonePatch = milestoneBody.partial();
const milestoneScenesBody = z.object({ sceneIds: z.array(idSchema).max(500) });
const platformRequirementSchema = z.object({
  code: z.string().trim().min(1).max(60),
  text: z.string().max(2000),
  status: z.enum(['unverified', 'verified', 'failed']),
  evidence: z.string().max(2000).optional(),
  source: z.string().max(300).optional(),
});
const platformTargetBody = z.object({
  name: z.string().trim().min(1).max(200),
  platform: z.enum(['ipad', 'iphone', 'mac', 'pc', 'console', 'web', 'other']).optional(),
  isPrimary: z.boolean().optional(),
  engine: z.string().max(200).optional(),
  osMin: z.string().max(200).optional(),
  deviceMin: z.string().max(200).optional(),
  inputModel: z.string().max(2000).optional(),
  budgets: z.record(jsonValueSchema).optional(),
  requirements: z.array(platformRequirementSchema).max(200).optional(),
  visualDirection: z.record(jsonValueSchema).optional(),
  notes: z.string().max(20_000).optional(),
  sortOrder: z.number().int().optional(),
});
const platformTargetPatch = platformTargetBody.partial();
const reviewShareLinkBody = z.object({
  accessMode: z.enum(['view', 'comment', 'approve']).optional(),
  requireIdentity: z.boolean().optional(),
  expiresAt: isoDate,
});

/** Ruteparameter som streng (Express 5 typer `req.params.x` som `string | string[]`). */
function param(req: Request, key: string): string {
  const v = (req.params as Record<string, string | string[] | undefined>)[key];
  return Array.isArray(v) ? String(v[0] ?? '') : String(v ?? '');
}

function readExpectedVersion(req: Request): number | null {
  const header = req.headers['if-match'];
  const raw = Array.isArray(header) ? header[0] : header;
  const fromHeader = typeof raw === 'string' ? raw.replace(/"/g, '').trim() : '';
  const body = (req.body ?? {}) as { expectedVersion?: unknown };
  const candidate = fromHeader || (typeof body.expectedVersion === 'number' ? String(body.expectedVersion) : '');
  if (!candidate) return null;
  const n = Number.parseInt(candidate, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function invalid(res: Response, error: z.ZodError): void {
  res.status(400).json({ error: 'invalid_request', details: error.format() });
}

export function createRoleRoomNarrativeRouter(
  pool: Pool,
  deps: CreateRoleRoomNarrativeRouterDeps = {},
): ExpressRouter {
  const router = Router();
  const publicStoryLimiter = createTokenRateLimiter({ windowMs: 60_000, max: 120 });
  const auth = requireAuth(pool, deps.activeSessions);
  const canAccess = deps.canAccessProject ?? canAccessRoleRoomProject;

  const requireProject = async (req: Request, res: Response, next: NextFunction) => {
    const projectId = param(req, 'projectId').trim();
    if (!idSchema.safeParse(projectId).success) { res.status(400).json({ error: 'invalid_project_id' }); return; }
    const { userId } = req as AuthedRequest;
    if (!(await canAccess(pool, userId, projectId))) { res.status(403).json({ error: 'forbidden' }); return; }
    (req as AuthedRequest).projectId = projectId;
    next();
  };

  const guard = [auth, requireProject];
  const broadcast = deps.broadcast ?? broadcastEventToRoom;
  const resolvePlan = deps.resolveProjectPlan ?? resolveGamePlanForProject;
  // Plan-gating (Fase 4d): 402 { error: 'plan_required' | 'plan_limit' } fra game-plan-gate.
  const feature = (projectId: string, f: Parameters<typeof assertGameFeature>[2]) => assertGameFeature(pool, projectId, f, resolvePlan);
  const notify = deps.notify ?? defaultSceneNotifier;
  /**
   * Fase 7e-1: server-side kapabilitetssjekk for de få handlingene med
   * produksjonskonsekvens (scenes.delete, review.decide, plan.edit).
   * Prosjekteier bypasser; uten team-medlemskap = 403 (fail closed).
   */
  const resolveCaps = deps.resolveCapabilities ?? resolveUserCapabilitiesForTeam;
  const requireCapability = async (req: AuthedRequest, res: Response, cap: string): Promise<boolean> => {
    const info = await resolvePlan(pool, req.projectId);
    const ownerUserId = info.ownerUserId;
    if (!ownerUserId || ownerUserId === req.userId) return true;
    const caps = await resolveCaps(pool, req.userId, ownerUserId);
    if (caps.has(cap)) return true;
    res.status(403).json({ error: 'capability_required', capability: cap, message: 'Rollen din i studioet mangler denne rettigheten.' });
    return false;
  };
  const limit = (projectId: string, key: string, current: number) => assertGameLimit(pool, projectId, key, current, resolvePlan);
  /**
   * Push «grafen er endret» til alle i prosjektets sanntidsrom (inkl. aktøren —
   * klienten filtrerer på actorUserId). Klientene gjør en debounced reload.
   */
  const notifyGraphChanged = (req: AuthedRequest, kind: GraphChangeKind, ids: string[] = []) => {
    try {
      broadcast(narrativeRoomKey(req.projectId), {
        type: 'narrative:graph_changed',
        payload: { kind, ids, actorUserId: req.userId, at: new Date().toISOString() },
        timestamp: new Date().toISOString(),
      });
    } catch { /* sanntid er best-effort */ }
  };
  /** Hvilken endringstype en mutasjons-URL under /projects/:id/ tilsvarer (null = ingen push). */
  const changeKindFor = (req: Request): GraphChangeKind | null => {
    if (req.method === 'GET') return null;
    const seg = String(req.path).split('/').filter(Boolean);
    const head = seg[2];
    switch (head) {
      case 'settings': return 'settings';
      case 'boards': return 'board';
      case 'elements': return 'element';
      case 'connections': return 'connection';
      case 'components': return 'component';
      case 'attributes': return 'attribute';
      case 'variables': return 'variable';
      case 'assets': return 'asset';
      case 'import': return 'graph';
      case 'translations': return 'translation';
      case 'revisions': return seg[4] === 'restore' ? 'graph' : null;
      case 'scenes': return 'scene';
      case 'episodes': case 'open-questions': case 'sources': case 'milestones': case 'platform-targets': return 'production';
      default: return null;
    }
  };
  const wrap = (fn: (req: AuthedRequest, res: Response) => Promise<void>) =>
    async (req: Request, res: Response) => {
      try {
        await fn(req as AuthedRequest, res);
        // Sanntid: vellykket mutasjon → push til prosjektets rom (best-effort).
        const kind = changeKindFor(req);
        if (kind && res.statusCode < 400 && (req as AuthedRequest).projectId) {
          const id = [param(req, 'id') || param(req, 'sceneId')].filter(Boolean);
          notifyGraphChanged(req as AuthedRequest, kind, id);
        }
      } catch (err) {
        if (err instanceof PlanRequiredError || err instanceof PlanLimitError) {
          if (!res.headersSent) sendPlanRequired(res, err);
          return;
        }
        // Fase 8a: wrap() svarer selv, så Sentry-middlewaren i index.ts ser aldri feilen —
        // fang den eksplisitt (no-op uten SENTRY_DSN). Ikke next(err): finalhandler ville
        // rive sokkelen når svaret alt er sendt.
        captureBackendException(err, {
          endpoint: `${req.method} ${req.baseUrl}${req.route?.path ?? req.path}`,
          userId: (req as AuthedRequest).userId,
          extra: { projectId: (req as AuthedRequest).projectId, area: 'role-room/narrative' },
        });
        console.error('[narrative] route error', err);
        if (!res.headersSent) res.status(500).json({ error: 'internal_error' });
      }
    };

  // ─── Hele grafen + innstillinger ───────────────────────────────────
  router.get('/projects/:projectId/graph', ...guard, wrap(async (req, res) => {
    res.json({ success: true, data: await svc.getGraph(pool, req.projectId) });
  }));

  // Validering av hele grafen: struktur (startelement, uoppnåelige elementer,
  // ukoblede utganger) + skript (parse-feil, ukjente variabler, døde referanser).
  router.get('/projects/:projectId/validate', ...guard, wrap(async (req, res) => {
    const graph = await svc.getGraph(pool, req.projectId);
    const issues = validateStoryGraph(graph);
    res.json({
      success: true,
      data: {
        issues,
        summary: {
          errors: issues.filter((i) => i.level === 'error').length,
          warnings: issues.filter((i) => i.level === 'warning').length,
        },
      },
    });
  }));

  router.put('/projects/:projectId/settings', ...guard, wrap(async (req, res) => {
    const parsed = settingsBody.safeParse(req.body);
    if (!parsed.success) { invalid(res, parsed.error); return; }
    res.json({ success: true, data: await svc.upsertSettings(pool, req.projectId, req.userId, parsed.data) });
  }));

  // ─── Brett ─────────────────────────────────────────────────────────
  router.post('/projects/:projectId/boards', ...guard, wrap(async (req, res) => {
    const parsed = boardBody.safeParse(req.body);
    if (!parsed.success) { invalid(res, parsed.error); return; }
    res.status(201).json({ success: true, data: await svc.createBoard(pool, req.projectId, req.userId, parsed.data) });
  }));
  router.patch('/projects/:projectId/boards/:id', ...guard, wrap(async (req, res) => {
    const parsed = boardBody.partial().safeParse(req.body);
    if (!parsed.success) { invalid(res, parsed.error); return; }
    const r = await svc.patchBoard(pool, req.projectId, param(req, 'id'), parsed.data);
    if (!r) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true, data: r });
  }));
  router.delete('/projects/:projectId/boards/:id', ...guard, wrap(async (req, res) => {
    const ok = await svc.deleteBoard(pool, req.projectId, param(req, 'id'));
    res.status(ok ? 200 : 404).json(ok ? { success: true } : { error: 'not_found' });
  }));

  // ─── Elementer ─────────────────────────────────────────────────────
  router.post('/projects/:projectId/elements', ...guard, wrap(async (req, res) => {
    const parsed = elementBody.safeParse(req.body);
    if (!parsed.success) { invalid(res, parsed.error); return; }
    // Solo-planen har elementgrense; Pro/Studio ubegrenset (limits.maxElements mangler).
    const count = await pool.query(`SELECT COUNT(*)::int AS n FROM narrative_elements WHERE project_id = $1`, [req.projectId]);
    await limit(req.projectId, 'maxElements', Number(count.rows[0]?.n ?? 0));
    const input: svc.ElementInput = {
      ...parsed.data,
      branchConditions: parsed.data.branchConditions
        ? svc.normalizeBranchConditions(parsed.data.branchConditions)
        : undefined,
    };
    res.status(201).json({ success: true, data: await svc.createElement(pool, req.projectId, req.userId, input) });
  }));
  router.post('/projects/:projectId/elements/moves', ...guard, wrap(async (req, res) => {
    const parsed = movesBody.safeParse(req.body);
    if (!parsed.success) { invalid(res, parsed.error); return; }
    res.json({ success: true, data: await svc.moveElements(pool, req.projectId, parsed.data.moves) });
  }));
  router.patch('/projects/:projectId/elements/:id', ...guard, wrap(async (req, res) => {
    const parsed = elementBody.partial().safeParse(req.body);
    if (!parsed.success) { invalid(res, parsed.error); return; }
    const patch: svc.ElementPatch = {
      ...parsed.data,
      branchConditions: parsed.data.branchConditions
        ? svc.normalizeBranchConditions(parsed.data.branchConditions)
        : undefined,
    };
    const r = await svc.patchElement(pool, req.projectId, param(req, 'id'), patch, readExpectedVersion(req));
    if (!r) { res.status(404).json({ error: 'not_found' }); return; }
    if (!r.ok) { res.status(409).json({ error: 'conflict', data: r.conflict }); return; }
    res.json({ success: true, data: r.element });
  }));
  router.delete('/projects/:projectId/elements/:id', ...guard, wrap(async (req, res) => {
    const ok = await svc.deleteElement(pool, req.projectId, param(req, 'id'));
    res.status(ok ? 200 : 404).json(ok ? { success: true } : { error: 'not_found' });
  }));
  router.put('/projects/:projectId/elements/:id/components', ...guard, wrap(async (req, res) => {
    const parsed = elementComponentsBody.safeParse(req.body);
    if (!parsed.success) { invalid(res, parsed.error); return; }
    const r = await svc.setElementComponents(pool, req.projectId, param(req, 'id'), parsed.data.componentIds);
    if (!r) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true, data: r });
  }));

  // ─── Koblinger ─────────────────────────────────────────────────────
  router.post('/projects/:projectId/connections', ...guard, wrap(async (req, res) => {
    const parsed = connectionBody.safeParse(req.body);
    if (!parsed.success) { invalid(res, parsed.error); return; }
    const r = await svc.createConnection(pool, req.projectId, req.userId, parsed.data);
    if (!r) { res.status(400).json({ error: 'unknown_endpoint', message: 'Kilde eller mål finnes ikke i prosjektet.' }); return; }
    res.status(201).json({ success: true, data: r });
  }));
  router.patch('/projects/:projectId/connections/:id', ...guard, wrap(async (req, res) => {
    const parsed = connectionBody.pick({ targetId: true, sourceOutputKey: true, labelHtml: true, sortOrder: true }).partial().safeParse(req.body);
    if (!parsed.success) { invalid(res, parsed.error); return; }
    const r = await svc.patchConnection(pool, req.projectId, param(req, 'id'), parsed.data);
    if (!r) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true, data: r });
  }));
  router.delete('/projects/:projectId/connections/:id', ...guard, wrap(async (req, res) => {
    const ok = await svc.deleteConnection(pool, req.projectId, param(req, 'id'));
    res.status(ok ? 200 : 404).json(ok ? { success: true } : { error: 'not_found' });
  }));

  // ─── Komponenter ───────────────────────────────────────────────────
  router.post('/projects/:projectId/components', ...guard, wrap(async (req, res) => {
    const parsed = componentBody.safeParse(req.body);
    if (!parsed.success) { invalid(res, parsed.error); return; }
    res.status(201).json({ success: true, data: await svc.createComponent(pool, req.projectId, req.userId, parsed.data) });
  }));
  router.patch('/projects/:projectId/components/:id', ...guard, wrap(async (req, res) => {
    const parsed = componentBody.partial().safeParse(req.body);
    if (!parsed.success) { invalid(res, parsed.error); return; }
    const r = await svc.patchComponent(pool, req.projectId, param(req, 'id'), parsed.data);
    if (!r) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true, data: r });
  }));
  router.delete('/projects/:projectId/components/:id', ...guard, wrap(async (req, res) => {
    const ok = await svc.deleteComponent(pool, req.projectId, param(req, 'id'));
    res.status(ok ? 200 : 404).json(ok ? { success: true } : { error: 'not_found' });
  }));

  // ─── Attributter ───────────────────────────────────────────────────
  router.post('/projects/:projectId/attributes', ...guard, wrap(async (req, res) => {
    const parsed = attributeBody.safeParse(req.body);
    if (!parsed.success) { invalid(res, parsed.error); return; }
    res.status(201).json({ success: true, data: await svc.createAttribute(pool, req.projectId, parsed.data) });
  }));
  router.patch('/projects/:projectId/attributes/:id', ...guard, wrap(async (req, res) => {
    const parsed = attributeBody.omit({ ownerKind: true, ownerId: true }).partial().safeParse(req.body);
    if (!parsed.success) { invalid(res, parsed.error); return; }
    const r = await svc.patchAttribute(pool, req.projectId, param(req, 'id'), parsed.data);
    if (!r) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true, data: r });
  }));
  router.delete('/projects/:projectId/attributes/:id', ...guard, wrap(async (req, res) => {
    const ok = await svc.deleteAttribute(pool, req.projectId, param(req, 'id'));
    res.status(ok ? 200 : 404).json(ok ? { success: true } : { error: 'not_found' });
  }));

  // ─── Variabler ─────────────────────────────────────────────────────
  router.post('/projects/:projectId/variables', ...guard, wrap(async (req, res) => {
    const parsed = variableBody.safeParse(req.body);
    if (!parsed.success) { invalid(res, parsed.error); return; }
    const r = await svc.createVariable(pool, req.projectId, parsed.data);
    if (!r) { res.status(409).json({ error: 'duplicate_name', message: 'En variabel med dette navnet finnes allerede.' }); return; }
    res.status(201).json({ success: true, data: r });
  }));
  router.patch('/projects/:projectId/variables/:id', ...guard, wrap(async (req, res) => {
    const parsed = variableBody.partial().safeParse(req.body);
    if (!parsed.success) { invalid(res, parsed.error); return; }
    const r = await svc.patchVariable(pool, req.projectId, param(req, 'id'), parsed.data);
    if (!r) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true, data: r });
  }));
  router.delete('/projects/:projectId/variables/:id', ...guard, wrap(async (req, res) => {
    const ok = await svc.deleteVariable(pool, req.projectId, param(req, 'id'));
    res.status(ok ? 200 : 404).json(ok ? { success: true } : { error: 'not_found' });
  }));

  // ─── Ressurser ─────────────────────────────────────────────────────
  router.post('/projects/:projectId/assets', ...guard, wrap(async (req, res) => {
    const parsed = assetBody.safeParse(req.body);
    if (!parsed.success) { invalid(res, parsed.error); return; }
    res.status(201).json({ success: true, data: await svc.createAsset(pool, req.projectId, req.userId, parsed.data) });
  }));
  router.patch('/projects/:projectId/assets/:id', ...guard, wrap(async (req, res) => {
    const parsed = assetBody.partial().safeParse(req.body);
    if (!parsed.success) { invalid(res, parsed.error); return; }
    const r = await svc.patchAsset(pool, req.projectId, param(req, 'id'), parsed.data);
    if (!r) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true, data: r });
  }));
  router.delete('/projects/:projectId/assets/:id', ...guard, wrap(async (req, res) => {
    const ok = await svc.deleteAsset(pool, req.projectId, param(req, 'id'));
    res.status(ok ? 200 : 404).json(ok ? { success: true } : { error: 'not_found' });
  }));

  // ─── Revisjoner ────────────────────────────────────────────────────
  router.get('/projects/:projectId/revisions', ...guard, wrap(async (req, res) => {
    res.json({ success: true, data: await svc.listRevisions(pool, req.projectId) });
  }));
  router.post('/projects/:projectId/revisions', ...guard, wrap(async (req, res) => {
    const parsed = revisionBody.safeParse(req.body ?? {});
    if (!parsed.success) { invalid(res, parsed.error); return; }
    res.status(201).json({ success: true, data: await svc.createRevision(pool, req.projectId, req.userId, parsed.data.label ?? null) });
  }));
  router.get('/projects/:projectId/revisions/:id', ...guard, wrap(async (req, res) => {
    const r = await svc.getRevision(pool, req.projectId, param(req, 'id'));
    if (!r) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true, data: r });
  }));
  router.post('/projects/:projectId/revisions/:id/restore', ...guard, wrap(async (req, res) => {
    const backup = await svc.restoreRevision(pool, req.projectId, req.userId, param(req, 'id'));
    if (!backup) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true, data: { backup, graph: await svc.getGraph(pool, req.projectId) } });
  }));

  // ─── Fase 3: eksport, import, delingslenker ────────────────────────
  // Arcweave-kompatibel project.json — lastes rett inn i Arcweaves
  // Unity/Godot/Unreal-plugins. Frontend bygger samme fil klient-side fra
  // det delte format-laget; dette endepunktet er for API-/verktøy-bruk.
  /** `?locale=en` → oversettelser brukes i eksporten (nb = kilde). Ugyldig kode ignoreres. */
  const exportLocale = (req: Request): string | null => {
    const raw = typeof req.query.locale === 'string' ? req.query.locale.trim() : '';
    return raw && raw !== 'nb' && LOCALE_CODE_RE.test(raw) ? raw : null;
  };
  const exportName = (title: string | null | undefined, locale: string | null, ext: string) =>
    `${exportFileStem(title)}${locale ? `-${locale}` : ''}.${ext}`;

  router.get('/projects/:projectId/export.json', ...guard, wrap(async (req, res) => {
    const graph = await svc.getGraph(pool, req.projectId);
    const locale = exportLocale(req);
    res.setHeader('Content-Disposition', `attachment; filename="${exportName(graph.settings.title, locale, 'json')}"`);
    res.json(toArcweaveProject(graph, { locale }));
  }));

  router.get('/projects/:projectId/export.md', ...guard, wrap(async (req, res) => {
    const graph = await svc.getGraph(pool, req.projectId);
    const locale = exportLocale(req);
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${exportName(graph.settings.title, locale, 'md')}"`);
    res.send(toMarkdown(graph, { locale }));
  }));

  // Fase 5a: regneark-eksport (én rad per element; norsk Excel-profil med «;» og BOM).
  router.get('/projects/:projectId/export.csv', ...guard, wrap(async (req, res) => {
    const graph = await svc.getGraph(pool, req.projectId);
    const locale = exportLocale(req);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${exportName(graph.settings.title, locale, 'csv')}"`);
    res.send(toCsv(graph, { locale }));
  }));

  // Fase 5c: lesbart manus som PDF (Pro/Studio). Binært → ikke i MCP.
  router.get('/projects/:projectId/export.pdf', ...guard, wrap(async (req, res) => {
    await feature(req.projectId, 'export_pdf');
    const graph = await svc.getGraph(pool, req.projectId);
    const locale = exportLocale(req);
    const pdf = await renderStoryGraphPdf(graph, { locale });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${storyGraphPdfFilename(graph, locale)}"`);
    res.setHeader('Content-Length', String(pdf.length));
    res.send(pdf);
  }));

  // Import erstatter hele grafen; nåværende graf lagres først som revisjon.
  router.post('/projects/:projectId/import', ...guard, wrap(async (req, res) => {
    const parsed = importBody.safeParse(req.body);
    if (!parsed.success) { invalid(res, parsed.error); return; }
    if (parsed.data.format === 'twee' || parsed.data.format === 'ink') await feature(req.projectId, 'import_twine_ink');
    try {
      const result = await svc.importProject(pool, req.projectId, req.userId, parsed.data);
      res.json({ success: true, data: result });
    } catch (err) {
      if (err instanceof ArcweaveImportError || err instanceof TweeImportError || err instanceof InkImportError) {
        res.status(400).json({ error: 'invalid_project', message: err.message });
        return;
      }
      throw err;
    }
  }));

  router.get('/projects/:projectId/share-links', ...guard, wrap(async (req, res) => {
    res.json({ success: true, data: await svc.listShareLinks(pool, req.projectId) });
  }));
  router.post('/projects/:projectId/share-links', ...guard, wrap(async (req, res) => {
    const parsed = shareLinkBody.safeParse(req.body ?? {});
    if (!parsed.success) { invalid(res, parsed.error); return; }
    await feature(req.projectId, 'share_links');
    const { link, token } = await svc.createShareLink(pool, req.projectId, req.userId, parsed.data);
    // Råtokenet vises én gang; kun hash lagres.
    res.status(201).json({ success: true, data: { link, token, path: `/story/${token}` } });
  }));
  router.post('/projects/:projectId/share-links/:id/revoke', ...guard, wrap(async (req, res) => {
    const link = await svc.revokeShareLink(pool, req.projectId, param(req, 'id'));
    if (!link) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true, data: link });
  }));

  // ─── Fase 4b: oversettelser ─────────────────────────────────────────
  router.put('/projects/:projectId/translations', ...guard, wrap(async (req, res) => {
    const parsed = translationsBody.safeParse(req.body);
    if (!parsed.success) { invalid(res, parsed.error); return; }
    if (parsed.data.locale === 'nb') { res.status(400).json({ error: 'source_locale', message: 'nb er kildespråket — rediger elementene direkte.' }); return; }
    const result = await svc.saveTranslations(pool, req.projectId, parsed.data.locale, parsed.data.entries);
    res.json({ success: true, data: result });
  }));

  // Statsløs KI-oversettelse av prose-segmenter (lagrer ingenting).
  router.post('/projects/:projectId/translate', ...guard, wrap(async (req, res) => {
    const parsed = translateBody.safeParse(req.body);
    if (!parsed.success) { invalid(res, parsed.error); return; }
    await feature(req.projectId, 'translations');
    try {
      const result = await translateSegments({
        segments: parsed.data.segments, sourceLocale: parsed.data.sourceLocale ?? 'nb',
        targetLocale: parsed.data.targetLocale, storyContext: parsed.data.storyContext,
      });
      res.json({ success: true, data: result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/disabled|ANTHROPIC_API_KEY/i.test(message)) { res.status(503).json({ error: 'ai_unavailable', message: 'KI-oversettelse er ikke aktivert på denne serveren.' }); return; }
      throw err;
    }
  }));

  // ─── Fase 6: Scener & gameplay + Review & Godkjenning ──────────────
  // Scener og oppgaver er ugatet; review-runder krever `scene_review` (Pro/Studio).
  router.get('/projects/:projectId/scenes', ...guard, wrap(async (req, res) => {
    const scenes = await svc.listScenes(pool, req.projectId);
    res.json({ success: true, data: { scenes, nextCode: svc.nextSceneCode(scenes.map((s) => s.code)) } });
  }));
  router.post('/projects/:projectId/scenes', ...guard, wrap(async (req, res) => {
    const parsed = sceneBody.safeParse(req.body ?? {});
    if (!parsed.success) { invalid(res, parsed.error); return; }
    try {
      const scene = await svc.createScene(pool, req.projectId, req.userId, parsed.data);
      res.status(201).json({ success: true, data: scene });
    } catch (err) {
      if (err instanceof svc.SceneDuplicateCodeError) { res.status(409).json({ error: 'duplicate_code', code: err.sceneCode, message: err.message }); return; }
      throw err;
    }
  }));
  router.get('/projects/:projectId/scenes/:sceneId', ...guard, wrap(async (req, res) => {
    const detail = await svc.getSceneDetail(pool, req.projectId, param(req, 'sceneId'));
    if (!detail) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true, data: detail });
  }));
  router.patch('/projects/:projectId/scenes/:sceneId', ...guard, wrap(async (req, res) => {
    const parsed = sceneBody.safeParse(req.body ?? {});
    if (!parsed.success) { invalid(res, parsed.error); return; }
    try {
      const scene = await svc.patchScene(pool, req.projectId, param(req, 'sceneId'), parsed.data);
      if (!scene) { res.status(404).json({ error: 'not_found' }); return; }
      res.json({ success: true, data: scene });
    } catch (err) {
      if (err instanceof svc.SceneDuplicateCodeError) { res.status(409).json({ error: 'duplicate_code', code: err.sceneCode, message: err.message }); return; }
      throw err;
    }
  }));
  router.delete('/projects/:projectId/scenes/:sceneId', ...guard, wrap(async (req, res) => {
    if (!(await requireCapability(req, res, 'scenes.delete'))) return;
    const ok = await svc.deleteScene(pool, req.projectId, param(req, 'sceneId'));
    if (!ok) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true });
  }));
  router.put('/projects/:projectId/scenes/order', ...guard, wrap(async (req, res) => {
    const parsed = orderBody.safeParse(req.body ?? {});
    if (!parsed.success) { invalid(res, parsed.error); return; }
    await svc.reorderScenes(pool, req.projectId, parsed.data.orderedIds);
    res.json({ success: true });
  }));
  router.put('/projects/:projectId/scenes/:sceneId/links', ...guard, wrap(async (req, res) => {
    const parsed = sceneLinksBody.safeParse(req.body ?? {});
    if (!parsed.success) { invalid(res, parsed.error); return; }
    const links = await svc.setSceneLinks(pool, req.projectId, param(req, 'sceneId'), parsed.data.links);
    if (!links) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true, data: links });
  }));

  router.post('/projects/:projectId/scenes/:sceneId/frames', ...guard, wrap(async (req, res) => {
    const parsed = sceneFrameBody.safeParse(req.body ?? {});
    if (!parsed.success) { invalid(res, parsed.error); return; }
    const frame = await svc.createSceneFrame(pool, req.projectId, param(req, 'sceneId'), req.userId, parsed.data);
    if (!frame) { res.status(404).json({ error: 'not_found', message: 'Scenen eller ressursen finnes ikke i prosjektet.' }); return; }
    res.status(201).json({ success: true, data: frame });
  }));
  router.put('/projects/:projectId/scenes/:sceneId/frames/order', ...guard, wrap(async (req, res) => {
    const parsed = orderBody.safeParse(req.body ?? {});
    if (!parsed.success) { invalid(res, parsed.error); return; }
    await svc.reorderSceneFrames(pool, req.projectId, param(req, 'sceneId'), parsed.data.orderedIds);
    res.json({ success: true });
  }));
  router.patch('/projects/:projectId/scenes/:sceneId/frames/:frameId', ...guard, wrap(async (req, res) => {
    const parsed = sceneFramePatch.safeParse(req.body ?? {});
    if (!parsed.success) { invalid(res, parsed.error); return; }
    const frame = await svc.patchSceneFrame(pool, req.projectId, param(req, 'sceneId'), param(req, 'frameId'), parsed.data);
    if (!frame) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true, data: frame });
  }));
  router.delete('/projects/:projectId/scenes/:sceneId/frames/:frameId', ...guard, wrap(async (req, res) => {
    const ok = await svc.deleteSceneFrame(pool, req.projectId, param(req, 'sceneId'), param(req, 'frameId'));
    if (!ok) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true });
  }));

  router.post('/projects/:projectId/scenes/:sceneId/tasks', ...guard, wrap(async (req, res) => {
    const parsed = sceneTaskBody.safeParse(req.body ?? {});
    if (!parsed.success) { invalid(res, parsed.error); return; }
    const task = await svc.createSceneTask(pool, req.projectId, param(req, 'sceneId'), req.userId, parsed.data);
    if (!task) { res.status(404).json({ error: 'not_found' }); return; }
    res.status(201).json({ success: true, data: task });
  }));
  router.patch('/projects/:projectId/scenes/:sceneId/tasks/:taskId', ...guard, wrap(async (req, res) => {
    const parsed = sceneTaskPatch.safeParse(req.body ?? {});
    if (!parsed.success) { invalid(res, parsed.error); return; }
    const task = await svc.patchSceneTask(pool, req.projectId, param(req, 'sceneId'), param(req, 'taskId'), parsed.data);
    if (!task) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true, data: task });
  }));
  router.delete('/projects/:projectId/scenes/:sceneId/tasks/:taskId', ...guard, wrap(async (req, res) => {
    const ok = await svc.deleteSceneTask(pool, req.projectId, param(req, 'sceneId'), param(req, 'taskId'));
    if (!ok) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true });
  }));

  router.get('/projects/:projectId/scenes/:sceneId/reviews', ...guard, wrap(async (req, res) => {
    res.json({ success: true, data: await svc.listSceneReviews(pool, req.projectId, param(req, 'sceneId')) });
  }));
  router.post('/projects/:projectId/scenes/:sceneId/reviews', ...guard, wrap(async (req, res) => {
    const parsed = reviewRequestBody.safeParse(req.body ?? {});
    if (!parsed.success) { invalid(res, parsed.error); return; }
    await feature(req.projectId, 'scene_review');
    const review = await svc.requestSceneReview(pool, req.projectId, param(req, 'sceneId'), req.userId, parsed.data.note ?? null);
    if (!review) { res.status(404).json({ error: 'not_found' }); return; }
    res.status(201).json({ success: true, data: review });
    const scene = await svc.getScene(pool, req.projectId, param(req, 'sceneId'));
    if (scene) {
      const recipients = [scene.assigneeUserId].filter((id): id is string => !!id && id !== req.userId);
      notify(pool, { event: 'narrative_scene_review_requested', projectId: req.projectId, actorUserId: req.userId, scene, review, recipientUserIds: recipients })
        .catch((err) => console.warn('[narrative] review notify failed', err));
    }
  }));
  router.post('/projects/:projectId/scenes/:sceneId/reviews/:reviewId/decision', ...guard, wrap(async (req, res) => {
    const parsed = reviewDecisionBody.safeParse(req.body ?? {});
    if (!parsed.success) { invalid(res, parsed.error); return; }
    await feature(req.projectId, 'scene_review');
    if (!(await requireCapability(req, res, 'review.decide'))) return;
    const session = deps.activeSessions?.get((req.headers.authorization ?? '').replace(/^Bearer\s+/i, '').trim());
    const userLabel = (session && (session.name || session.email)) || null;
    try {
      const review = await svc.decideSceneReview(pool, req.projectId, param(req, 'sceneId'), param(req, 'reviewId'), {
        decision: parsed.data.decision, note: parsed.data.note ?? null, expectedSnapshotHash: parsed.data.expectedSnapshotHash ?? null,
        userId: req.userId, userLabel,
      });
      if (!review) { res.status(404).json({ error: 'not_found' }); return; }
      res.json({ success: true, data: review });
      const scene = await svc.getScene(pool, req.projectId, param(req, 'sceneId'));
      if (scene) {
        const recipients = Array.from(new Set([scene.assigneeUserId, review.requestedBy].filter((id): id is string => !!id && id !== req.userId)));
        notify(pool, { event: 'narrative_scene_review_decided', projectId: req.projectId, actorUserId: req.userId, scene, review, recipientUserIds: recipients })
          .catch((err) => console.warn('[narrative] review notify failed', err));
      }
    } catch (err) {
      if (err instanceof svc.SceneReviewStaleError) {
        res.status(409).json({ error: 'snapshot_stale', message: err.message, currentHash: err.currentHash, reviewHash: err.reviewHash });
        return;
      }
      if (err instanceof svc.SceneReviewClosedError) {
        res.status(409).json({ error: 'review_closed', message: err.message, status: err.status });
        return;
      }
      throw err;
    }
  }));

  // ─── Fase 7: produksjons-OS ─────────────────────────────────────────
  // Gater: én PUT per gate; «bestått» krever bevis (400 gate_evidence_required).
  router.get('/projects/:projectId/scenes/:sceneId/gates', ...guard, wrap(async (req, res) => {
    const scene = await svc.getScene(pool, req.projectId, param(req, 'sceneId'));
    if (!scene) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true, data: await svc.listSceneGates(pool, req.projectId, scene.id) });
  }));
  router.put('/projects/:projectId/scenes/:sceneId/gates/:gateKey', ...guard, wrap(async (req, res) => {
    const gateKey = param(req, 'gateKey');
    if (!(svc.NARRATIVE_GATE_KEYS as readonly string[]).includes(gateKey)) { res.status(400).json({ error: 'invalid_request', message: `Ukjent gate «${gateKey}».` }); return; }
    const parsed = gateBody.safeParse(req.body ?? {});
    if (!parsed.success) { invalid(res, parsed.error); return; }
    try {
      const gate = await svc.setSceneGate(pool, req.projectId, param(req, 'sceneId'), gateKey as svc.NarrativeGateKey, req.userId, parsed.data);
      if (!gate) { res.status(404).json({ error: 'not_found' }); return; }
      res.json({ success: true, data: gate });
    } catch (err) {
      if (err instanceof svc.GateEvidenceRequiredError) { res.status(400).json({ error: err.code, message: err.message }); return; }
      throw err;
    }
  }));

  // Replikker (dialog-linjer som data).
  router.get('/projects/:projectId/scenes/:sceneId/lines', ...guard, wrap(async (req, res) => {
    const scene = await svc.getScene(pool, req.projectId, param(req, 'sceneId'));
    if (!scene) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true, data: await svc.listSceneLines(pool, req.projectId, scene.id) });
  }));
  router.post('/projects/:projectId/scenes/:sceneId/lines', ...guard, wrap(async (req, res) => {
    const parsed = lineBody.safeParse(req.body ?? {});
    if (!parsed.success) { invalid(res, parsed.error); return; }
    try {
      const line = await svc.createSceneLine(pool, req.projectId, param(req, 'sceneId'), req.userId, parsed.data);
      if (!line) { res.status(404).json({ error: 'not_found' }); return; }
      res.status(201).json({ success: true, data: line });
    } catch (err) {
      if (err instanceof svc.DuplicateCueError) { res.status(409).json({ error: err.code, cueId: err.cueId, message: err.message }); return; }
      throw err;
    }
  }));
  router.put('/projects/:projectId/scenes/:sceneId/lines/order', ...guard, wrap(async (req, res) => {
    const parsed = orderBody.safeParse(req.body ?? {});
    if (!parsed.success) { invalid(res, parsed.error); return; }
    await svc.reorderSceneLines(pool, req.projectId, param(req, 'sceneId'), parsed.data.orderedIds);
    res.json({ success: true, data: await svc.listSceneLines(pool, req.projectId, param(req, 'sceneId')) });
  }));
  router.patch('/projects/:projectId/scenes/:sceneId/lines/:lineId', ...guard, wrap(async (req, res) => {
    const parsed = linePatch.safeParse(req.body ?? {});
    if (!parsed.success) { invalid(res, parsed.error); return; }
    try {
      const line = await svc.patchSceneLine(pool, req.projectId, param(req, 'sceneId'), param(req, 'lineId'), parsed.data);
      if (!line) { res.status(404).json({ error: 'not_found' }); return; }
      res.json({ success: true, data: line });
    } catch (err) {
      if (err instanceof svc.DuplicateCueError) { res.status(409).json({ error: err.code, cueId: err.cueId, message: err.message }); return; }
      throw err;
    }
  }));
  router.delete('/projects/:projectId/scenes/:sceneId/lines/:lineId', ...guard, wrap(async (req, res) => {
    const ok = await svc.deleteSceneLine(pool, req.projectId, param(req, 'sceneId'), param(req, 'lineId'));
    if (!ok) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true });
  }));
  // Replikker på tvers av scener for én taler (Karakterer-visningen).
  router.get('/projects/:projectId/lines', ...guard, wrap(async (req, res) => {
    const speaker = typeof req.query.speakerComponentId === 'string' ? req.query.speakerComponentId : '';
    if (!speaker) { res.status(400).json({ error: 'invalid_request', message: 'speakerComponentId mangler.' }); return; }
    res.json({ success: true, data: await svc.listLinesBySpeaker(pool, req.projectId, speaker) });
  }));
  // Scener koblet til en komponent (karakter/lokasjon) — reverse-oppslag.
  router.get('/projects/:projectId/components/:id/scenes', ...guard, wrap(async (req, res) => {
    res.json({ success: true, data: await svc.listScenesForOwner(pool, req.projectId, 'component', param(req, 'id')) });
  }));

  // Episoder (E01–E12).
  router.get('/projects/:projectId/episodes', ...guard, wrap(async (req, res) => {
    res.json({ success: true, data: await svc.listEpisodes(pool, req.projectId) });
  }));
  router.post('/projects/:projectId/episodes', ...guard, wrap(async (req, res) => {
    const parsed = episodeBody.safeParse(req.body ?? {});
    if (!parsed.success) { invalid(res, parsed.error); return; }
    try {
      res.status(201).json({ success: true, data: await svc.createEpisode(pool, req.projectId, req.userId, parsed.data) });
    } catch (err) {
      if (err instanceof svc.DuplicateCodeError) { res.status(409).json({ error: err.code, entity: err.entity, value: err.value, message: err.message }); return; }
      throw err;
    }
  }));
  router.patch('/projects/:projectId/episodes/:id', ...guard, wrap(async (req, res) => {
    const parsed = episodePatch.safeParse(req.body ?? {});
    if (!parsed.success) { invalid(res, parsed.error); return; }
    try {
      const ep = await svc.patchEpisode(pool, req.projectId, param(req, 'id'), parsed.data);
      if (!ep) { res.status(404).json({ error: 'not_found' }); return; }
      res.json({ success: true, data: ep });
    } catch (err) {
      if (err instanceof svc.DuplicateCodeError) { res.status(409).json({ error: err.code, entity: err.entity, value: err.value, message: err.message }); return; }
      throw err;
    }
  }));
  router.delete('/projects/:projectId/episodes/:id', ...guard, wrap(async (req, res) => {
    const ok = await svc.deleteEpisode(pool, req.projectId, param(req, 'id'));
    if (!ok) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true });
  }));

  // Åpne spørsmål og sjekklister (kind = question | check).
  router.get('/projects/:projectId/open-questions', ...guard, wrap(async (req, res) => {
    res.json({ success: true, data: await svc.listOpenQuestions(pool, req.projectId) });
  }));
  router.post('/projects/:projectId/open-questions', ...guard, wrap(async (req, res) => {
    const parsed = openQuestionBody.safeParse(req.body ?? {});
    if (!parsed.success) { invalid(res, parsed.error); return; }
    try {
      res.status(201).json({ success: true, data: await svc.createOpenQuestion(pool, req.projectId, req.userId, parsed.data) });
    } catch (err) {
      if (err instanceof svc.DuplicateCodeError) { res.status(409).json({ error: err.code, entity: err.entity, value: err.value, message: err.message }); return; }
      throw err;
    }
  }));
  router.patch('/projects/:projectId/open-questions/:id', ...guard, wrap(async (req, res) => {
    const parsed = openQuestionPatch.safeParse(req.body ?? {});
    if (!parsed.success) { invalid(res, parsed.error); return; }
    try {
      const q = await svc.patchOpenQuestion(pool, req.projectId, param(req, 'id'), req.userId, parsed.data);
      if (!q) { res.status(404).json({ error: 'not_found' }); return; }
      res.json({ success: true, data: q });
    } catch (err) {
      if (err instanceof svc.DuplicateCodeError) { res.status(409).json({ error: err.code, entity: err.entity, value: err.value, message: err.message }); return; }
      throw err;
    }
  }));
  router.delete('/projects/:projectId/open-questions/:id', ...guard, wrap(async (req, res) => {
    const ok = await svc.deleteOpenQuestion(pool, req.projectId, param(req, 'id'));
    if (!ok) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true });
  }));

  // Kilderegister (dokumenter med SHA-256).
  router.get('/projects/:projectId/sources', ...guard, wrap(async (req, res) => {
    res.json({ success: true, data: await svc.listSources(pool, req.projectId) });
  }));
  router.post('/projects/:projectId/sources', ...guard, wrap(async (req, res) => {
    const parsed = sourceBody.safeParse(req.body ?? {});
    if (!parsed.success) { invalid(res, parsed.error); return; }
    try {
      res.status(201).json({ success: true, data: await svc.createSource(pool, req.projectId, req.userId, parsed.data) });
    } catch (err) {
      if (err instanceof svc.DuplicateCodeError) { res.status(409).json({ error: err.code, entity: err.entity, value: err.value, message: err.message }); return; }
      throw err;
    }
  }));
  router.patch('/projects/:projectId/sources/:id', ...guard, wrap(async (req, res) => {
    const parsed = sourcePatch.safeParse(req.body ?? {});
    if (!parsed.success) { invalid(res, parsed.error); return; }
    try {
      const src = await svc.patchSource(pool, req.projectId, param(req, 'id'), req.userId, parsed.data);
      if (!src) { res.status(404).json({ error: 'not_found' }); return; }
      res.json({ success: true, data: src });
    } catch (err) {
      if (err instanceof svc.DuplicateCodeError) { res.status(409).json({ error: err.code, entity: err.entity, value: err.value, message: err.message }); return; }
      throw err;
    }
  }));
  router.delete('/projects/:projectId/sources/:id', ...guard, wrap(async (req, res) => {
    const ok = await svc.deleteSource(pool, req.projectId, param(req, 'id'));
    if (!ok) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true });
  }));

  // Milepæler (produksjonsplan). Lesing er åpen; mutasjoner krever `production_plan` (Pro/Studio).
  router.get('/projects/:projectId/milestones', ...guard, wrap(async (req, res) => {
    res.json({ success: true, data: await svc.listMilestones(pool, req.projectId) });
  }));
  router.post('/projects/:projectId/milestones', ...guard, wrap(async (req, res) => {
    const parsed = milestoneBody.safeParse(req.body ?? {});
    if (!parsed.success) { invalid(res, parsed.error); return; }
    await feature(req.projectId, 'production_plan');
    if (!(await requireCapability(req, res, 'plan.edit'))) return;
    res.status(201).json({ success: true, data: await svc.createMilestone(pool, req.projectId, req.userId, parsed.data) });
  }));
  router.patch('/projects/:projectId/milestones/:id', ...guard, wrap(async (req, res) => {
    const parsed = milestonePatch.safeParse(req.body ?? {});
    if (!parsed.success) { invalid(res, parsed.error); return; }
    await feature(req.projectId, 'production_plan');
    if (!(await requireCapability(req, res, 'plan.edit'))) return;
    const m = await svc.patchMilestone(pool, req.projectId, param(req, 'id'), parsed.data);
    if (!m) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true, data: m });
  }));
  router.delete('/projects/:projectId/milestones/:id', ...guard, wrap(async (req, res) => {
    await feature(req.projectId, 'production_plan');
    if (!(await requireCapability(req, res, 'plan.edit'))) return;
    const ok = await svc.deleteMilestone(pool, req.projectId, param(req, 'id'));
    if (!ok) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true });
  }));
  router.put('/projects/:projectId/milestones/:id/scenes', ...guard, wrap(async (req, res) => {
    const parsed = milestoneScenesBody.safeParse(req.body ?? {});
    if (!parsed.success) { invalid(res, parsed.error); return; }
    await feature(req.projectId, 'production_plan');
    if (!(await requireCapability(req, res, 'plan.edit'))) return;
    const sceneIds = await svc.setMilestoneScenes(pool, req.projectId, param(req, 'id'), parsed.data.sceneIds);
    if (!sceneIds) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true, data: { sceneIds } });
  }));

  // Plattformmål (iPad/iPhone/… med budsjetter, krav og visuell retning). Alle planer.
  router.get('/projects/:projectId/platform-targets', ...guard, wrap(async (req, res) => {
    res.json({ success: true, data: await svc.listPlatformTargets(pool, req.projectId) });
  }));
  router.post('/projects/:projectId/platform-targets', ...guard, wrap(async (req, res) => {
    const parsed = platformTargetBody.safeParse(req.body ?? {});
    if (!parsed.success) { invalid(res, parsed.error); return; }
    res.status(201).json({ success: true, data: await svc.createPlatformTarget(pool, req.projectId, req.userId, parsed.data) });
  }));
  router.patch('/projects/:projectId/platform-targets/:id', ...guard, wrap(async (req, res) => {
    const parsed = platformTargetPatch.safeParse(req.body ?? {});
    if (!parsed.success) { invalid(res, parsed.error); return; }
    const t = await svc.patchPlatformTarget(pool, req.projectId, param(req, 'id'), parsed.data);
    if (!t) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true, data: t });
  }));
  router.delete('/projects/:projectId/platform-targets/:id', ...guard, wrap(async (req, res) => {
    const ok = await svc.deletePlatformTarget(pool, req.projectId, param(req, 'id'));
    if (!ok) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true });
  }));

  // Hjem: ett aggregat (server teller) + innboks over prosjektets narrative varsler.
  router.get('/projects/:projectId/overview', ...guard, wrap(async (req, res) => {
    res.json({ success: true, data: await svc.getProjectOverview(pool, req.projectId, req.userId) });
  }));
  router.get('/projects/:projectId/inbox', ...guard, wrap(async (req, res) => {
    const limitRaw = Number.parseInt(String(req.query.limit ?? ''), 10);
    const max = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 200) : 50;
    res.json({ success: true, data: await svc.listInbox(pool, req.projectId, req.userId, max) });
  }));
  router.post('/projects/:projectId/inbox/read-all', ...guard, wrap(async (req, res) => {
    res.json({ success: true, data: { marked: await svc.markAllInboxRead(pool, req.projectId, req.userId) } });
  }));
  router.post('/projects/:projectId/inbox/:id/read', ...guard, wrap(async (req, res) => {
    const ok = await svc.markInboxRead(pool, req.projectId, req.userId, param(req, 'id'));
    if (!ok) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true });
  }));

  // ─── Fase 7e-2: gjeste-reviewere (delingslenker per runde, Studio) ──
  router.get('/projects/:projectId/scenes/:sceneId/reviews/:reviewId/share-links', ...guard, wrap(async (req, res) => {
    res.json({ success: true, data: await svc.listReviewShareLinks(pool, req.projectId, param(req, 'sceneId'), param(req, 'reviewId')) });
  }));
  router.post('/projects/:projectId/scenes/:sceneId/reviews/:reviewId/share-links', ...guard, wrap(async (req, res) => {
    const parsed = reviewShareLinkBody.safeParse(req.body ?? {});
    if (!parsed.success) { invalid(res, parsed.error); return; }
    await feature(req.projectId, 'guest_reviewers');
    try {
      const created = await svc.createReviewShareLink(pool, req.projectId, param(req, 'sceneId'), param(req, 'reviewId'), req.userId, parsed.data);
      if (!created) { res.status(404).json({ error: 'not_found' }); return; }
      res.status(201).json({ success: true, data: { link: created.link, token: created.token, path: `/story-review/${created.token}` } });
    } catch (err) {
      if (err instanceof svc.SceneReviewClosedError) { res.status(409).json({ error: 'review_closed', status: err.status, message: err.message }); return; }
      throw err;
    }
  }));
  router.delete('/projects/:projectId/scenes/:sceneId/reviews/:reviewId/share-links/:linkId', ...guard, wrap(async (req, res) => {
    await feature(req.projectId, 'guest_reviewers');
    const ok = await svc.revokeReviewShareLink(pool, req.projectId, param(req, 'sceneId'), param(req, 'reviewId'), param(req, 'linkId'));
    if (!ok) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true });
  }));

  // Lettvekts medlemsliste (eier + aktive medlemmer) for «Ansvarlig»-velgeren.
  router.get('/projects/:projectId/members-lite', ...guard, wrap(async (req, res) => {
    res.json({ success: true, data: await svc.listMembersLite(pool, req.projectId) });
  }));

  // ─── Fase 8b: manusimport (Word/PDF/Markdown → scener + replikker) ─────
  // Dry-run først: dokumentet parses og diffes mot prosjektet; ingenting skrives før
  // brukeren godkjenner diffen via /scenes/import-document/apply. Ligger utenfor
  // «scenes»-segmentet så dry-run ikke sender sanntids-push.
  const documentUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: DOCUMENT_IMPORT_MAX_BYTES, files: 1 } });
  const uploadDocument = (req: Request, res: Response, next: NextFunction) => {
    documentUpload.single('file')(req, res, (err: unknown) => {
      if (err) {
        const code = (err as { code?: string }).code;
        if (code === 'LIMIT_FILE_SIZE') { res.status(413).json({ error: 'file_too_large', maxBytes: DOCUMENT_IMPORT_MAX_BYTES }); return; }
        res.status(400).json({ error: 'bad_upload', message: err instanceof Error ? err.message : String(err) });
        return;
      }
      next();
    });
  };
  router.post('/projects/:projectId/import-document', ...guard, uploadDocument, wrap(async (req, res) => {
    const file = (req as Request & { file?: { buffer: Buffer; mimetype: string; originalname: string; size: number } }).file;
    if (!file) { res.status(400).json({ error: 'missing_file', message: 'Send dokumentet som multipart-feltet «file».' }); return; }
    try {
      const { text, kind } = await extractDocumentText(file.buffer, file.mimetype, file.originalname);
      const parsed = parseSceneDocument(text);
      const existing = await listExistingScenesForImport(pool, req.projectId);
      const diff = diffAgainstProject(parsed, existing);
      res.json({
        success: true,
        data: {
          fileName: file.originalname, sizeBytes: file.size, kind,
          sourceSha256: createHash('sha256').update(file.buffer).digest('hex'),
          title: parsed.title, stats: parsed.stats, diff,
        },
      });
    } catch (err) {
      if (err instanceof DocumentImportError) {
        res.status(err.code === 'unsupported_type' ? 415 : 422).json({ error: err.code, message: err.message });
        return;
      }
      throw err;
    }
  }));

  const importFieldChange = z.object({ from: z.string().max(20_000), to: z.string().max(20_000) });
  const importParsedLine = z.object({
    cueId: z.string().trim().regex(svc.NARRATIVE_CUE_ID_RE), speakerLabel: z.string().max(200), textEn: z.string().max(5000),
    sourceType: z.enum(['E', 'T', 'E+T', 'U', 'A']).nullable(), note: z.string().max(2000).optional(),
  });
  const importApplyBody = z.object({
    sourceSha256: z.string().regex(/^[0-9a-f]{64}$/),
    sourceCode: z.string().trim().min(1).max(40),
    sourceLabel: z.string().trim().min(1).max(300),
    sourceKind: z.enum(['docx', 'pdf', 'md', 'txt', 'other']),
    fileName: z.string().max(300).optional(),
    create: z.array(z.object({
      workingId: z.string().max(40), code: z.string().trim().regex(svc.NARRATIVE_SCENE_CODE_RE),
      scene: z.object({
        workingId: z.string().max(40), title: z.string().max(300), subtitle: z.string().max(300),
        era: z.enum(['pre', '1797', '1802', '1817', 'other']), cueBlocks: z.array(z.string().max(10)).max(50),
        fields: z.object({ beforeState: z.string().max(20_000), action: z.string().max(20_000), control: z.string().max(20_000), afterState: z.string().max(20_000), audio: z.string().max(20_000) }),
        lines: z.array(importParsedLine).max(500),
      }),
    })).max(500),
    update: z.array(z.object({
      sceneId: idSchema, code: z.string().max(40), workingId: z.string().max(40),
      changes: z.record(z.enum(['title', 'subtitle', 'era', 'beforeState', 'action', 'control', 'afterState', 'audio']), importFieldChange),
      lines: z.object({
        create: z.array(importParsedLine).max(500),
        update: z.array(z.object({ lineId: idSchema, cueId: z.string().max(40), changes: z.record(z.enum(['speakerLabel', 'textEn', 'sourceType']), importFieldChange) })).max(500),
        unchanged: z.number().int().default(0),
      }),
    })).max(500),
    openQuestions: z.array(z.object({ question: z.string().trim().min(1).max(2000), context: z.string().max(5000).optional(), sceneCode: z.string().max(40).optional() })).max(500).default([]),
  });
  router.post('/projects/:projectId/scenes/import-document/apply', ...guard, wrap(async (req, res) => {
    const parsed = importApplyBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'validation_error', details: parsed.error.flatten() }); return; }
    try {
      const result = await applyDocumentImport(pool, req.projectId, req.userId, parsed.data);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      if (err instanceof svc.SceneDuplicateCodeError) { res.status(409).json({ error: 'duplicate_code', code: err.code }); return; }
      if (err instanceof svc.DuplicateCueError) { res.status(409).json({ error: 'duplicate_cue', cueId: err.cueId }); return; }
      throw err;
    }
  }));

  // ─── Fase 8c: CI-bevis-hooks (autentisert del) + bevis-nedlasting ──────
  // Selve webhooken og bevis-opplastingen ligger i index.ts FØR express.json (rå body).
  router.get('/projects/:projectId/ci-hooks', ...guard, wrap(async (req, res) => {
    res.json({ success: true, data: await listCiHooks(pool, req.projectId) });
  }));
  router.post('/projects/:projectId/ci-hooks', ...guard, wrap(async (req, res) => {
    const parsed = z.object({ label: z.string().trim().max(200).optional() }).safeParse(req.body ?? {});
    if (!parsed.success) { invalid(res, parsed.error); return; }
    const { hook, secret } = await createCiHook(pool, req.projectId, req.userId, parsed.data.label ?? '');
    // Hemmeligheten vises ÉN gang (lagres i klartekst i DB fordi HMAC trenger den).
    res.status(201).json({ success: true, data: { hook, secret, webhookPath: `/api/role-room/narrative/hooks/ci/${hook.id}` } });
  }));
  router.post('/projects/:projectId/ci-hooks/:hookId/revoke', ...guard, wrap(async (req, res) => {
    const hook = await revokeCiHook(pool, req.projectId, param(req, 'hookId'));
    if (!hook) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true, data: hook });
  }));
  router.get('/projects/:projectId/ci-hooks/:hookId/deliveries', ...guard, wrap(async (req, res) => {
    res.json({ success: true, data: await listCiDeliveries(pool, req.projectId, { hookId: param(req, 'hookId'), limit: 200 }) });
  }));
  router.get('/projects/:projectId/ci-deliveries', ...guard, wrap(async (req, res) => {
    res.json({ success: true, data: await listCiDeliveries(pool, req.projectId, { limit: 200 }) });
  }));
  // ─── Fase 8f: KI-referansebilde → objektlager → narrative_assets(storage_key) → scene-ramme ──
  // Bildet genereres av /api/storyboards/generate-frame (persisterer ingenting); ai_assist-gate + daglig tak her.
  router.post('/projects/:projectId/scenes/:sceneId/frames/from-base64', ...guard, wrap(async (req, res) => {
    await feature(req.projectId, 'ai_assist');
    const parsed = z.object({
      imageBase64: z.string().min(64).max(12 * 1024 * 1024),
      caption: z.string().trim().max(120).optional(),
      prompt: z.string().max(2000).optional(),
      model: z.string().max(60).optional(),
    }).safeParse(req.body ?? {});
    if (!parsed.success) { invalid(res, parsed.error); return; }
    try {
      const result = await createAiReferenceFrame(pool, req.projectId, param(req, 'sceneId'), req.userId, parsed.data);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      if (err instanceof AiFrameError) {
        const status = err.code === 'daily_limit' ? 429 : err.code === 'invalid_image' ? 400 : err.code === 'scene_not_found' ? 404 : 503;
        res.status(status).json({ error: err.code, message: err.message });
        return;
      }
      throw err;
    }
  }));

  // ─── Fase 8e: spilltest-telemetri (tokens + aggregat; inntaket er offentlig nederst) ──
  router.get('/projects/:projectId/playtest-tokens', ...guard, wrap(async (req, res) => {
    res.json({ success: true, data: await listPlaytestTokens(pool, req.projectId) });
  }));
  router.post('/projects/:projectId/playtest-tokens', ...guard, wrap(async (req, res) => {
    const parsed = z.object({ label: z.string().trim().max(200).optional(), ttlDays: z.number().int().min(1).max(365).nullable().optional() }).safeParse(req.body ?? {});
    if (!parsed.success) { invalid(res, parsed.error); return; }
    const { token, rawToken } = await createPlaytestToken(pool, req.projectId, req.userId, parsed.data);
    // Råtokenet vises ÉN gang; kun sha256-hashen lagres.
    res.status(201).json({ success: true, data: { token, rawToken, ingestPath: '/api/role-room/narrative/playtest/events' } });
  }));
  router.post('/projects/:projectId/playtest-tokens/:tokenId/revoke', ...guard, wrap(async (req, res) => {
    const token = await revokePlaytestToken(pool, req.projectId, param(req, 'tokenId'));
    if (!token) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true, data: token });
  }));
  router.get('/projects/:projectId/playtest/summary', ...guard, wrap(async (req, res) => {
    const build = typeof req.query.build === 'string' ? req.query.build.slice(0, 100) : null;
    const days = typeof req.query.days === 'string' ? Number(req.query.days) : undefined;
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, data: await getPlaytestSummary(pool, req.projectId, { build, days: Number.isFinite(days) ? days : undefined }) });
  }));

  // Bevis-artefakt (narrative_assets.storage_key) → kortlevd signert nedlastings-URL.
  router.get('/projects/:projectId/assets/:assetId/download', ...guard, wrap(async (req, res) => {
    const { rows } = await pool.query(`SELECT id, name, storage_key, external_url FROM narrative_assets WHERE id = $1 AND project_id = $2 LIMIT 1`, [param(req, 'assetId'), req.projectId]);
    const row = rows[0] as { name: string; storage_key: string | null; external_url: string | null } | undefined;
    if (!row) { res.status(404).json({ error: 'not_found' }); return; }
    if (!row.storage_key) {
      if (row.external_url) { res.json({ success: true, data: { url: row.external_url, expiresInSeconds: null } }); return; }
      res.status(404).json({ error: 'no_file' }); return;
    }
    const url = await presignCreatorHubObjectDownload(row.storage_key, row.name, 300);
    if (!url) { res.status(503).json({ error: 'storage_unavailable' }); return; }
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, data: { url, expiresInSeconds: 300 } });
  }));

  // Offentlig (uten innlogging): spill-grafen bak et delingstoken. Ugyldig,
  // utløpt og tilbakekalt gir samme 404 (ingen lekkasje av hvilken).
  // Fase 8e: telemetri-inntak fra spillet — bearer-token (hashet), alltid 204, aldri blokkerende.
  router.post('/playtest/events', createPlaytestIngestHandler(pool));

  router.get('/public/:token', async (req: Request, res: Response) => {
    try {
      const token = param(req, 'token');
      // Fase 8a: per-token-budsjett (ikke IP — bak Renders proxy er req.ip lik for alle).
      if (publicStoryLimiter.hit(token)) { res.status(429).set('Retry-After', '60').json({ error: 'rate_limited' }); return; }
      const story = await svc.getPublicStory(pool, token);
      res.setHeader('Cache-Control', 'no-store');
      if (!story) { res.status(404).json({ error: 'not_found' }); return; }
      res.json({ success: true, data: story });
    } catch (err) {
      console.error('[narrative] public route error', err);
      if (!res.headersSent) res.status(500).json({ error: 'internal_error' });
    }
  });

  return router;
}
