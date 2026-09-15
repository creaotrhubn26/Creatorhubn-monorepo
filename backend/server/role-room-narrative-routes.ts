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
}

const idSchema = z.string().min(1).max(200);
const nullableStr = (max: number) => z.string().max(max).nullable().optional();
const html = (max: number) => z.string().max(max).optional();
const jsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(jsonValueSchema), z.record(jsonValueSchema)]),
);

const settingsBody = z.object({
  title: nullableStr(300),
  startingElementId: nullableStr(200),
  coverAssetId: nullableStr(200),
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
  const wrap = (fn: (req: AuthedRequest, res: Response) => Promise<void>) =>
    async (req: Request, res: Response) => {
      try {
        await fn(req as AuthedRequest, res);
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

  return router;
}
