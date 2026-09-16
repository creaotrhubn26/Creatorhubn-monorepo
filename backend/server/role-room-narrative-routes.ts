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
// Delt validator (struktur + skript) — samme kode som frontendens merknader-chip.
import { validateStoryGraph } from '../../frontend/shared/narrative-runtime/validate.ts';
// Delt format-lag (Fase 3): Arcweave JSON, Markdown, filnavn.
import {
  ArcweaveImportError, InkImportError, TweeImportError, LOCALE_CODE_RE, exportFileStem, toArcweaveProject, toCsv, toMarkdown,
} from '../../frontend/shared/narrative-format/index.ts';
import { MAX_TRANSLATE_SEGMENTS, translateSegments } from './narrative-translate.js';
import { renderStoryGraphPdf, storyGraphPdfFilename } from './narrative-pdf.js';
import { broadcastEventToRoom, narrativeRoomKey } from './websocket-chat.js';
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
  | 'settings' | 'board' | 'element' | 'connection' | 'component' | 'attribute' | 'variable' | 'asset' | 'graph' | 'translation' | 'scene';

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

const componentBody = z.object({
  name: z.string().min(1).max(200),
  folderPath: z.string().max(500).optional(),
  coverAssetId: nullableStr(200),
  customId: nullableStr(120),
  sortOrder: z.number().int().optional(),
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
  kind: z.enum(['image', 'audio', 'video']).optional(),
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
});
const sceneLinksBody = z.object({
  links: z.array(z.object({ ownerKind: z.enum(['element', 'board']), ownerId: idSchema })).max(200),
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
  const auth = requireAuth(pool, deps.activeSessions);
  const canAccess = deps.canAccessProject ?? canAccessRoleRoomProject;

  const requireProject = async (req: Request, res: Response, next: NextFunction) => {
    const projectId = typeof req.params.projectId === 'string' ? req.params.projectId.trim() : '';
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
          const id = typeof req.params.id === 'string' ? [req.params.id] : typeof req.params.sceneId === 'string' ? [req.params.sceneId] : [];
          notifyGraphChanged(req as AuthedRequest, kind, id);
        }
      } catch (err) {
        if (err instanceof PlanRequiredError || err instanceof PlanLimitError) {
          if (!res.headersSent) sendPlanRequired(res, err);
          return;
        }
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
    const r = await svc.patchBoard(pool, req.projectId, req.params.id, parsed.data);
    if (!r) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true, data: r });
  }));
  router.delete('/projects/:projectId/boards/:id', ...guard, wrap(async (req, res) => {
    const ok = await svc.deleteBoard(pool, req.projectId, req.params.id);
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
    const r = await svc.patchElement(pool, req.projectId, req.params.id, patch, readExpectedVersion(req));
    if (!r) { res.status(404).json({ error: 'not_found' }); return; }
    if (!r.ok) { res.status(409).json({ error: 'conflict', data: r.conflict }); return; }
    res.json({ success: true, data: r.element });
  }));
  router.delete('/projects/:projectId/elements/:id', ...guard, wrap(async (req, res) => {
    const ok = await svc.deleteElement(pool, req.projectId, req.params.id);
    res.status(ok ? 200 : 404).json(ok ? { success: true } : { error: 'not_found' });
  }));
  router.put('/projects/:projectId/elements/:id/components', ...guard, wrap(async (req, res) => {
    const parsed = elementComponentsBody.safeParse(req.body);
    if (!parsed.success) { invalid(res, parsed.error); return; }
    const r = await svc.setElementComponents(pool, req.projectId, req.params.id, parsed.data.componentIds);
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
    const r = await svc.patchConnection(pool, req.projectId, req.params.id, parsed.data);
    if (!r) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true, data: r });
  }));
  router.delete('/projects/:projectId/connections/:id', ...guard, wrap(async (req, res) => {
    const ok = await svc.deleteConnection(pool, req.projectId, req.params.id);
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
    const r = await svc.patchComponent(pool, req.projectId, req.params.id, parsed.data);
    if (!r) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true, data: r });
  }));
  router.delete('/projects/:projectId/components/:id', ...guard, wrap(async (req, res) => {
    const ok = await svc.deleteComponent(pool, req.projectId, req.params.id);
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
    const r = await svc.patchAttribute(pool, req.projectId, req.params.id, parsed.data);
    if (!r) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true, data: r });
  }));
  router.delete('/projects/:projectId/attributes/:id', ...guard, wrap(async (req, res) => {
    const ok = await svc.deleteAttribute(pool, req.projectId, req.params.id);
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
    const r = await svc.patchVariable(pool, req.projectId, req.params.id, parsed.data);
    if (!r) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true, data: r });
  }));
  router.delete('/projects/:projectId/variables/:id', ...guard, wrap(async (req, res) => {
    const ok = await svc.deleteVariable(pool, req.projectId, req.params.id);
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
    const r = await svc.patchAsset(pool, req.projectId, req.params.id, parsed.data);
    if (!r) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true, data: r });
  }));
  router.delete('/projects/:projectId/assets/:id', ...guard, wrap(async (req, res) => {
    const ok = await svc.deleteAsset(pool, req.projectId, req.params.id);
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
    const r = await svc.getRevision(pool, req.projectId, req.params.id);
    if (!r) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true, data: r });
  }));
  router.post('/projects/:projectId/revisions/:id/restore', ...guard, wrap(async (req, res) => {
    const backup = await svc.restoreRevision(pool, req.projectId, req.userId, req.params.id);
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
    const link = await svc.revokeShareLink(pool, req.projectId, req.params.id);
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
    const detail = await svc.getSceneDetail(pool, req.projectId, req.params.sceneId);
    if (!detail) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true, data: detail });
  }));
  router.patch('/projects/:projectId/scenes/:sceneId', ...guard, wrap(async (req, res) => {
    const parsed = sceneBody.safeParse(req.body ?? {});
    if (!parsed.success) { invalid(res, parsed.error); return; }
    try {
      const scene = await svc.patchScene(pool, req.projectId, req.params.sceneId, parsed.data);
      if (!scene) { res.status(404).json({ error: 'not_found' }); return; }
      res.json({ success: true, data: scene });
    } catch (err) {
      if (err instanceof svc.SceneDuplicateCodeError) { res.status(409).json({ error: 'duplicate_code', code: err.sceneCode, message: err.message }); return; }
      throw err;
    }
  }));
  router.delete('/projects/:projectId/scenes/:sceneId', ...guard, wrap(async (req, res) => {
    const ok = await svc.deleteScene(pool, req.projectId, req.params.sceneId);
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
    const links = await svc.setSceneLinks(pool, req.projectId, req.params.sceneId, parsed.data.links);
    if (!links) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true, data: links });
  }));

  router.post('/projects/:projectId/scenes/:sceneId/frames', ...guard, wrap(async (req, res) => {
    const parsed = sceneFrameBody.safeParse(req.body ?? {});
    if (!parsed.success) { invalid(res, parsed.error); return; }
    const frame = await svc.createSceneFrame(pool, req.projectId, req.params.sceneId, req.userId, parsed.data);
    if (!frame) { res.status(404).json({ error: 'not_found', message: 'Scenen eller ressursen finnes ikke i prosjektet.' }); return; }
    res.status(201).json({ success: true, data: frame });
  }));
  router.put('/projects/:projectId/scenes/:sceneId/frames/order', ...guard, wrap(async (req, res) => {
    const parsed = orderBody.safeParse(req.body ?? {});
    if (!parsed.success) { invalid(res, parsed.error); return; }
    await svc.reorderSceneFrames(pool, req.projectId, req.params.sceneId, parsed.data.orderedIds);
    res.json({ success: true });
  }));
  router.patch('/projects/:projectId/scenes/:sceneId/frames/:frameId', ...guard, wrap(async (req, res) => {
    const parsed = sceneFramePatch.safeParse(req.body ?? {});
    if (!parsed.success) { invalid(res, parsed.error); return; }
    const frame = await svc.patchSceneFrame(pool, req.projectId, req.params.sceneId, req.params.frameId, parsed.data);
    if (!frame) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true, data: frame });
  }));
  router.delete('/projects/:projectId/scenes/:sceneId/frames/:frameId', ...guard, wrap(async (req, res) => {
    const ok = await svc.deleteSceneFrame(pool, req.projectId, req.params.sceneId, req.params.frameId);
    if (!ok) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true });
  }));

  router.post('/projects/:projectId/scenes/:sceneId/tasks', ...guard, wrap(async (req, res) => {
    const parsed = sceneTaskBody.safeParse(req.body ?? {});
    if (!parsed.success) { invalid(res, parsed.error); return; }
    const task = await svc.createSceneTask(pool, req.projectId, req.params.sceneId, req.userId, parsed.data);
    if (!task) { res.status(404).json({ error: 'not_found' }); return; }
    res.status(201).json({ success: true, data: task });
  }));
  router.patch('/projects/:projectId/scenes/:sceneId/tasks/:taskId', ...guard, wrap(async (req, res) => {
    const parsed = sceneTaskPatch.safeParse(req.body ?? {});
    if (!parsed.success) { invalid(res, parsed.error); return; }
    const task = await svc.patchSceneTask(pool, req.projectId, req.params.sceneId, req.params.taskId, parsed.data);
    if (!task) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true, data: task });
  }));
  router.delete('/projects/:projectId/scenes/:sceneId/tasks/:taskId', ...guard, wrap(async (req, res) => {
    const ok = await svc.deleteSceneTask(pool, req.projectId, req.params.sceneId, req.params.taskId);
    if (!ok) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true });
  }));

  router.get('/projects/:projectId/scenes/:sceneId/reviews', ...guard, wrap(async (req, res) => {
    res.json({ success: true, data: await svc.listSceneReviews(pool, req.projectId, req.params.sceneId) });
  }));
  router.post('/projects/:projectId/scenes/:sceneId/reviews', ...guard, wrap(async (req, res) => {
    const parsed = reviewRequestBody.safeParse(req.body ?? {});
    if (!parsed.success) { invalid(res, parsed.error); return; }
    await feature(req.projectId, 'scene_review');
    const review = await svc.requestSceneReview(pool, req.projectId, req.params.sceneId, req.userId, parsed.data.note ?? null);
    if (!review) { res.status(404).json({ error: 'not_found' }); return; }
    res.status(201).json({ success: true, data: review });
    const scene = await svc.getScene(pool, req.projectId, req.params.sceneId);
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
    const session = deps.activeSessions?.get((req.headers.authorization ?? '').replace(/^Bearer\s+/i, '').trim());
    const userLabel = (session && (session.name || session.email)) || null;
    try {
      const review = await svc.decideSceneReview(pool, req.projectId, req.params.sceneId, req.params.reviewId, {
        decision: parsed.data.decision, note: parsed.data.note ?? null, expectedSnapshotHash: parsed.data.expectedSnapshotHash ?? null,
        userId: req.userId, userLabel,
      });
      if (!review) { res.status(404).json({ error: 'not_found' }); return; }
      res.json({ success: true, data: review });
      const scene = await svc.getScene(pool, req.projectId, req.params.sceneId);
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

  // Lettvekts medlemsliste (eier + aktive medlemmer) for «Ansvarlig»-velgeren.
  router.get('/projects/:projectId/members-lite', ...guard, wrap(async (req, res) => {
    res.json({ success: true, data: await svc.listMembersLite(pool, req.projectId) });
  }));

  // Offentlig (uten innlogging): spill-grafen bak et delingstoken. Ugyldig,
  // utløpt og tilbakekalt gir samme 404 (ingen lekkasje av hvilken).
  router.get('/public/:token', async (req: Request, res: Response) => {
    try {
      const story = await svc.getPublicStory(pool, req.params.token);
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
