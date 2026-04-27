/**
 * Dance admin ops routes — én router for performance/music/reel/grant/
 * invoice/union under /api/dance/ops.
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
import * as svc from './dance-admin-ops-service.js';

interface SessionData {
  userId: string;
  email: string;
  name: string;
  role: string;
  loginAt: string;
  [key: string]: unknown;
}
type AuthedRequest = Request & { userId: string };

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

const idSchema = z.string().min(1).max(200);
const projectIdQuery = (req: Request): string | null => {
  const v = req.query.projectId;
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
};

export interface CreateDanceAdminOpsRouterDeps {
  activeSessions?: Map<string, SessionData>;
}

export function createDanceAdminOpsRouter(
  pool: Pool,
  deps: CreateDanceAdminOpsRouterDeps = {},
): ExpressRouter {
  const router = Router();
  const auth = requireAuth(pool, deps.activeSessions);

  // ─── PERFORMANCES ──────────────────────────────────
  const programItem = z.object({
    choreographyId: z.string().min(1).max(200),
    durationSec: z.number().min(0).optional(),
    notes: z.string().max(2000).optional(),
  });
  const performanceBody = z.object({
    title: z.string().min(1).max(300),
    performanceDate: z.string().datetime(),
    venue: z.string().max(300).nullable().optional(),
    status: z.enum(['planned', 'rehearsing', 'tickets_open', 'sold_out', 'completed', 'cancelled']).optional(),
    ticketUrl: z.string().url().max(2000).nullable().optional(),
    capacity: z.number().int().min(0).nullable().optional(),
    ticketsSold: z.number().int().min(0).optional(),
    program: z.array(programItem).max(50).optional(),
    notes: z.string().max(5000).nullable().optional(),
    projectId: z.string().max(200).nullable().optional(),
  });
  router.get('/performances', auth, async (req, res) => {
    const { userId } = req as AuthedRequest;
    res.json({ success: true, data: await svc.listPerformances(pool, userId, projectIdQuery(req)) });
  });
  router.post('/performances', auth, async (req, res) => {
    const parsed = performanceBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'invalid_request', details: parsed.error.format() }); return; }
    const { userId } = req as AuthedRequest;
    res.status(201).json({ success: true, data: await svc.createPerformance(pool, userId, parsed.data) });
  });
  router.patch('/performances/:id', auth, async (req, res) => {
    if (!idSchema.safeParse(req.params.id).success) { res.status(400).json({ error: 'invalid_id' }); return; }
    const parsed = performanceBody.partial().safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'invalid_request' }); return; }
    const { userId } = req as AuthedRequest;
    const r = await svc.patchPerformance(pool, userId, req.params.id, parsed.data);
    if (!r) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true, data: r });
  });
  router.delete('/performances/:id', auth, async (req, res) => {
    const { userId } = req as AuthedRequest;
    const ok = await svc.deletePerformance(pool, userId, req.params.id);
    res.status(ok ? 200 : 404).json(ok ? { success: true } : { error: 'not_found' });
  });

  // ─── MUSIC ARCHIVE ─────────────────────────────────
  const musicBody = z.object({
    title: z.string().min(1).max(300),
    composer: z.string().max(300).nullable().optional(),
    bpm: z.number().int().min(20).max(400).nullable().optional(),
    musicalKey: z.string().max(40).nullable().optional(),
    durationSec: z.number().min(0).nullable().optional(),
    tonoStatus: z.enum(['pending', 'cleared', 'blocked', 'unknown']).optional(),
    tonoReference: z.string().max(200).nullable().optional(),
    sourceUrl: z.string().url().max(2000).nullable().optional(),
    tags: z.array(z.string().max(80)).max(30).optional(),
    notes: z.string().max(5000).nullable().optional(),
    projectId: z.string().max(200).nullable().optional(),
  });
  router.get('/music', auth, async (req, res) => {
    const { userId } = req as AuthedRequest;
    res.json({ success: true, data: await svc.listMusic(pool, userId, projectIdQuery(req)) });
  });
  router.post('/music', auth, async (req, res) => {
    const parsed = musicBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'invalid_request', details: parsed.error.format() }); return; }
    const { userId } = req as AuthedRequest;
    res.status(201).json({ success: true, data: await svc.createMusic(pool, userId, parsed.data) });
  });
  router.patch('/music/:id', auth, async (req, res) => {
    const parsed = musicBody.partial().safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'invalid_request' }); return; }
    const { userId } = req as AuthedRequest;
    const r = await svc.patchMusic(pool, userId, req.params.id, parsed.data);
    if (!r) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true, data: r });
  });
  router.delete('/music/:id', auth, async (req, res) => {
    const { userId } = req as AuthedRequest;
    const ok = await svc.deleteMusic(pool, userId, req.params.id);
    res.status(ok ? 200 : 404).json(ok ? { success: true } : { error: 'not_found' });
  });

  // ─── REEL ──────────────────────────────────────────
  const reelBody = z.object({
    title: z.string().min(1).max(300),
    sourceUrl: z.string().url().max(2000).nullable().optional(),
    embedUrl: z.string().url().max(2000).nullable().optional(),
    thumbnailUrl: z.string().url().max(2000).nullable().optional(),
    durationSec: z.number().min(0).nullable().optional(),
    tags: z.array(z.string().max(80)).max(30).optional(),
    featureOrder: z.number().int().min(0).max(1000).optional(),
    recordedAt: z.string().datetime().nullable().optional(),
    notes: z.string().max(5000).nullable().optional(),
    projectId: z.string().max(200).nullable().optional(),
    publicShareEnabled: z.boolean().optional(),
  });
  router.get('/reel', auth, async (req, res) => {
    const { userId } = req as AuthedRequest;
    res.json({ success: true, data: await svc.listReel(pool, userId, projectIdQuery(req)) });
  });
  router.post('/reel', auth, async (req, res) => {
    const parsed = reelBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'invalid_request', details: parsed.error.format() }); return; }
    const { userId } = req as AuthedRequest;
    res.status(201).json({ success: true, data: await svc.createReel(pool, userId, parsed.data) });
  });
  router.patch('/reel/:id', auth, async (req, res) => {
    const parsed = reelBody.partial().safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'invalid_request' }); return; }
    const { userId } = req as AuthedRequest;
    const r = await svc.patchReel(pool, userId, req.params.id, parsed.data);
    if (!r) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true, data: r });
  });
  router.delete('/reel/:id', auth, async (req, res) => {
    const { userId } = req as AuthedRequest;
    const ok = await svc.deleteReel(pool, userId, req.params.id);
    res.status(ok ? 200 : 404).json(ok ? { success: true } : { error: 'not_found' });
  });

  // Public reel-share — uten auth.
  router.get('/reel/public/:token', async (req, res) => {
    const tokenParsed = z.string().min(8).max(200).safeParse(req.params.token);
    if (!tokenParsed.success) { res.status(400).json({ error: 'invalid_token' }); return; }
    const clip = await svc.getReelByShareToken(pool, tokenParsed.data);
    if (clip.length === 0) { res.status(404).json({ error: 'not_found' }); return; }
    // Hent eierens hele public reel for samme delings-side.
    const allPublic = await svc.getOwnerPublicReel(pool, clip[0].ownerUserId);
    res.json({
      success: true,
      data: { matched: clip[0], reel: allPublic },
    });
  });

  // ─── GRANTS ────────────────────────────────────────
  const grantBody = z.object({
    title: z.string().min(1).max(300),
    fundName: z.string().min(1).max(120).optional(),
    amountRequestedKr: z.number().int().min(0).nullable().optional(),
    amountAwardedKr: z.number().int().min(0).nullable().optional(),
    status: z.enum(['draft', 'submitted', 'in_review', 'awarded', 'rejected', 'withdrawn']).optional(),
    deadline: z.string().datetime().nullable().optional(),
    submittedAt: z.string().datetime().nullable().optional(),
    decidedAt: z.string().datetime().nullable().optional(),
    applicationText: z.string().max(20000).nullable().optional(),
    notes: z.string().max(5000).nullable().optional(),
    attachments: z.array(z.string().url().max(2000)).max(20).optional(),
    projectId: z.string().max(200).nullable().optional(),
  });
  router.get('/grants', auth, async (req, res) => {
    const { userId } = req as AuthedRequest;
    res.json({ success: true, data: await svc.listGrants(pool, userId, projectIdQuery(req)) });
  });
  router.post('/grants', auth, async (req, res) => {
    const parsed = grantBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'invalid_request', details: parsed.error.format() }); return; }
    const { userId } = req as AuthedRequest;
    res.status(201).json({ success: true, data: await svc.createGrant(pool, userId, parsed.data) });
  });
  router.patch('/grants/:id', auth, async (req, res) => {
    const parsed = grantBody.partial().safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'invalid_request' }); return; }
    const { userId } = req as AuthedRequest;
    const r = await svc.patchGrant(pool, userId, req.params.id, parsed.data);
    if (!r) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true, data: r });
  });
  router.delete('/grants/:id', auth, async (req, res) => {
    const { userId } = req as AuthedRequest;
    const ok = await svc.deleteGrant(pool, userId, req.params.id);
    res.status(ok ? 200 : 404).json(ok ? { success: true } : { error: 'not_found' });
  });

  // ─── INVOICES ──────────────────────────────────────
  const lineItemSchema = z.object({
    description: z.string().min(1).max(500),
    quantity: z.number().min(0),
    unitPriceKr: z.number().min(0),
    amountKr: z.number(),
  });
  const invoiceBody = z.object({
    invoiceNumber: z.string().max(40).nullable().optional(),
    customerName: z.string().min(1).max(300),
    customerOrgNo: z.string().max(40).nullable().optional(),
    customerEmail: z.string().email().max(200).nullable().optional(),
    customerAddress: z.string().max(500).nullable().optional(),
    amountKr: z.number().int().min(0).optional(),
    vatKr: z.number().int().min(0).optional(),
    status: z.enum(['draft', 'sent', 'paid', 'overdue', 'void']).optional(),
    deliveryMethod: z.enum(['manual', 'ehf', 'kid']).optional(),
    kidNumber: z.string().max(80).nullable().optional(),
    ehfStatus: z.string().max(80).nullable().optional(),
    issueDate: z.string().datetime().nullable().optional(),
    dueDate: z.string().datetime().nullable().optional(),
    paidAt: z.string().datetime().nullable().optional(),
    lineItems: z.array(lineItemSchema).max(50).optional(),
    notes: z.string().max(5000).nullable().optional(),
    projectId: z.string().max(200).nullable().optional(),
  });
  router.get('/invoices', auth, async (req, res) => {
    const { userId } = req as AuthedRequest;
    res.json({ success: true, data: await svc.listInvoices(pool, userId, projectIdQuery(req)) });
  });
  router.post('/invoices', auth, async (req, res) => {
    const parsed = invoiceBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'invalid_request', details: parsed.error.format() }); return; }
    const { userId } = req as AuthedRequest;
    res.status(201).json({ success: true, data: await svc.createInvoice(pool, userId, parsed.data) });
  });
  router.patch('/invoices/:id', auth, async (req, res) => {
    const parsed = invoiceBody.partial().safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'invalid_request' }); return; }
    const { userId } = req as AuthedRequest;
    const r = await svc.patchInvoice(pool, userId, req.params.id, parsed.data);
    if (!r) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true, data: r });
  });
  router.delete('/invoices/:id', auth, async (req, res) => {
    const { userId } = req as AuthedRequest;
    const ok = await svc.deleteInvoice(pool, userId, req.params.id);
    res.status(ok ? 200 : 404).json(ok ? { success: true } : { error: 'not_found' });
  });

  // ─── UNION ─────────────────────────────────────────
  const workDaySchema = z.object({
    ymd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    hours: z.number().min(0).max(24),
    classKind: z.string().max(80).optional(),
    tariffKr: z.number().min(0).optional(),
    jobTitle: z.string().max(200).optional(),
    project: z.string().max(200).optional(),
  });
  const unionBody = z.object({
    organization: z.enum(['skuda', 'noda', 'sko', 'other']).optional(),
    memberId: z.string().max(80).nullable().optional(),
    status: z.enum(['active', 'pending', 'inactive', 'suspended']).optional(),
    joinedAt: z.string().datetime().nullable().optional(),
    workDays: z.array(workDaySchema).max(2000).optional(),
    tariffSnapshot: z.record(z.unknown()).optional(),
    notes: z.string().max(5000).nullable().optional(),
  });
  router.get('/union', auth, async (req, res) => {
    const { userId } = req as AuthedRequest;
    res.json({ success: true, data: await svc.listUnion(pool, userId) });
  });
  router.post('/union', auth, async (req, res) => {
    const parsed = unionBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'invalid_request', details: parsed.error.format() }); return; }
    const { userId } = req as AuthedRequest;
    res.status(201).json({ success: true, data: await svc.createUnion(pool, userId, parsed.data) });
  });
  router.patch('/union/:id', auth, async (req, res) => {
    const parsed = unionBody.partial().safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'invalid_request' }); return; }
    const { userId } = req as AuthedRequest;
    const r = await svc.patchUnion(pool, userId, req.params.id, parsed.data);
    if (!r) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true, data: r });
  });
  router.delete('/union/:id', auth, async (req, res) => {
    const { userId } = req as AuthedRequest;
    const ok = await svc.deleteUnion(pool, userId, req.params.id);
    res.status(ok ? 200 : 404).json(ok ? { success: true } : { error: 'not_found' });
  });

  return router;
}
