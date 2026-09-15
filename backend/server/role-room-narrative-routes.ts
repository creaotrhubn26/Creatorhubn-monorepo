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
  ArcweaveImportError, InkImportError, TweeImportError, LOCALE_CODE_RE, exportFileStem, toArcweaveProject, toMarkdown,
} from '../../frontend/shared/narrative-format/index.ts';
import { MAX_TRANSLATE_SEGMENTS, translateSegments } from './narrative-translate.js';
import { broadcastEventToRoom, narrativeRoomKey } from './websocket-chat.js';

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
}

export type GraphChangeKind =
  | 'settings' | 'board' | 'element' | 'connection' | 'component' | 'attribute' | 'variable' | 'asset' | 'graph' | 'translation';

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
          const id = typeof req.params.id === 'string' ? [req.params.id] : [];
          notifyGraphChanged(req as AuthedRequest, kind, id);
        }
      } catch (err) {
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
  router.get('/projects/:projectId/export.json', ...guard, wrap(async (req, res) => {
    const graph = await svc.getGraph(pool, req.projectId);
    res.setHeader('Content-Disposition', `attachment; filename="${exportFileStem(graph.settings.title)}.json"`);
    res.json(toArcweaveProject(graph));
  }));

  router.get('/projects/:projectId/export.md', ...guard, wrap(async (req, res) => {
    const graph = await svc.getGraph(pool, req.projectId);
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${exportFileStem(graph.settings.title)}.md"`);
    res.send(toMarkdown(graph));
  }));

  // Import erstatter hele grafen; nåværende graf lagres først som revisjon.
  router.post('/projects/:projectId/import', ...guard, wrap(async (req, res) => {
    const parsed = importBody.safeParse(req.body);
    if (!parsed.success) { invalid(res, parsed.error); return; }
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
