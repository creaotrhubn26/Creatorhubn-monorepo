/**
 * Dance studio ops routes — én router som mounter alle 4 ressursene
 * under /api/dance/studio. Per-resource paths: /classes /instructors
 * /rooms /movement-vocab /room-bookings /class-enrollments.
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
import * as svc from './dance-studio-ops-service.js';

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

export interface CreateDanceStudioOpsRouterDeps {
  activeSessions?: Map<string, SessionData>;
}

export function createDanceStudioOpsRouter(
  pool: Pool,
  deps: CreateDanceStudioOpsRouterDeps = {},
): ExpressRouter {
  const router = Router();
  const auth = requireAuth(pool, deps.activeSessions);

  // ─── Classes ───────────────────────────────────────
  const classBody = z.object({
    title: z.string().min(1).max(200),
    kind: z.enum(['semester', 'drop_in', 'workshop', 'private']).optional(),
    schedulePattern: z.string().max(500).nullable().optional(),
    instructorId: z.string().max(200).nullable().optional(),
    roomId: z.string().max(200).nullable().optional(),
    startsAt: z.string().datetime().nullable().optional(),
    endsAt: z.string().datetime().nullable().optional(),
    maxStudents: z.number().int().min(0).nullable().optional(),
    priceKr: z.number().int().min(0).nullable().optional(),
    description: z.string().max(2000).nullable().optional(),
    projectId: z.string().max(200).nullable().optional(),
    level: z.enum(['nybegynner', 'mellomniva', 'viderekomne', 'alle']).nullable().optional(),
  });

  router.get('/classes', auth, async (req, res) => {
    const { userId } = req as AuthedRequest;
    res.json({ success: true, data: await svc.listClasses(pool, userId, projectIdQuery(req)) });
  });
  router.post('/classes', auth, async (req, res) => {
    const parsed = classBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'invalid_request', details: parsed.error.format() }); return; }
    const { userId } = req as AuthedRequest;
    res.status(201).json({ success: true, data: await svc.createClass(pool, userId, parsed.data) });
  });
  router.patch('/classes/:id', auth, async (req, res) => {
    if (!idSchema.safeParse(req.params.id).success) { res.status(400).json({ error: 'invalid_id' }); return; }
    const parsed = classBody.partial().safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'invalid_request', details: parsed.error.format() }); return; }
    const { userId } = req as AuthedRequest;
    const r = await svc.patchClass(pool, userId, req.params.id, parsed.data);
    if (!r) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true, data: r });
  });
  router.delete('/classes/:id', auth, async (req, res) => {
    const { userId } = req as AuthedRequest;
    const ok = await svc.deleteClass(pool, userId, req.params.id);
    res.status(ok ? 200 : 404).json(ok ? { success: true } : { error: 'not_found' });
  });

  // Enrollments
  const enrollmentBody = z.object({
    classId: z.string().min(1).max(200),
    studentDancerId: z.string().min(1).max(200),
    paymentStatus: z.enum(['unpaid', 'invoiced', 'paid', 'comp']).optional(),
    notes: z.string().max(2000).nullable().optional(),
  });
  router.get('/classes/:id/enrollments', auth, async (req, res) => {
    const { userId } = req as AuthedRequest;
    res.json({ success: true, data: await svc.listEnrollments(pool, userId, req.params.id) });
  });
  router.post('/class-enrollments', auth, async (req, res) => {
    const parsed = enrollmentBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'invalid_request', details: parsed.error.format() }); return; }
    const { userId } = req as AuthedRequest;
    res.status(201).json({ success: true, data: await svc.createEnrollment(pool, userId, parsed.data) });
  });
  router.patch('/class-enrollments/:id', auth, async (req, res) => {
    const parsed = z.object({
      paymentStatus: z.enum(['unpaid', 'invoiced', 'paid', 'comp']).optional(),
      notes: z.string().max(2000).nullable().optional(),
    }).safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'invalid_request' }); return; }
    const { userId } = req as AuthedRequest;
    const r = await svc.patchEnrollment(pool, userId, req.params.id, parsed.data);
    if (!r) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true, data: r });
  });
  router.delete('/class-enrollments/:id', auth, async (req, res) => {
    const { userId } = req as AuthedRequest;
    const ok = await svc.deleteEnrollment(pool, userId, req.params.id);
    res.status(ok ? 200 : 404).json(ok ? { success: true } : { error: 'not_found' });
  });

  // ─── Instructors ───────────────────────────────────
  const hoursEntrySchema = z.object({
    ymd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    hours: z.number().min(0).max(24),
    classId: z.string().max(200).optional(),
    note: z.string().max(500).optional(),
  });
  const instructorBody = z.object({
    displayName: z.string().min(1).max(200),
    email: z.string().email().max(200).nullable().optional(),
    phone: z.string().max(40).nullable().optional(),
    contractKind: z.enum(['enk_freelance', 'employee', 'guest']).optional(),
    hourlyRateKr: z.number().int().min(0).nullable().optional(),
    styles: z.array(z.string().max(80)).max(30).optional(),
    hoursLogged: z.array(hoursEntrySchema).max(1000).optional(),
    notes: z.string().max(2000).nullable().optional(),
    projectId: z.string().max(200).nullable().optional(),
    specialtyText: z.string().max(200).nullable().optional(),
    avatarUrl: z.string().max(2000).nullable().optional(),
    ratingAvg: z.number().min(0).max(5).nullable().optional(),
    ratingCount: z.number().int().min(0).optional(),
    nextClassText: z.string().max(200).nullable().optional(),
  });
  router.get('/instructors', auth, async (req, res) => {
    const { userId } = req as AuthedRequest;
    res.json({ success: true, data: await svc.listInstructors(pool, userId, projectIdQuery(req)) });
  });
  router.post('/instructors', auth, async (req, res) => {
    const parsed = instructorBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'invalid_request', details: parsed.error.format() }); return; }
    const { userId } = req as AuthedRequest;
    res.status(201).json({ success: true, data: await svc.createInstructor(pool, userId, parsed.data) });
  });
  router.patch('/instructors/:id', auth, async (req, res) => {
    const parsed = instructorBody.partial().safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'invalid_request' }); return; }
    const { userId } = req as AuthedRequest;
    const r = await svc.patchInstructor(pool, userId, req.params.id, parsed.data);
    if (!r) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true, data: r });
  });
  router.delete('/instructors/:id', auth, async (req, res) => {
    const { userId } = req as AuthedRequest;
    const ok = await svc.deleteInstructor(pool, userId, req.params.id);
    res.status(ok ? 200 : 404).json(ok ? { success: true } : { error: 'not_found' });
  });

  // ─── Rooms + Bookings ──────────────────────────────
  const roomBody = z.object({
    name: z.string().min(1).max(200),
    roomKind: z.enum(['mirror_studio', 'sprung_floor', 'ballet', 'rehearsal', 'theater']).optional(),
    capacity: z.number().int().min(0).nullable().optional(),
    hasSprungFloor: z.boolean().optional(),
    hasMirror: z.boolean().optional(),
    hasSoundSystem: z.boolean().optional(),
    address: z.string().max(500).nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
    projectId: z.string().max(200).nullable().optional(),
  });
  router.get('/rooms', auth, async (req, res) => {
    const { userId } = req as AuthedRequest;
    res.json({ success: true, data: await svc.listRooms(pool, userId, projectIdQuery(req)) });
  });
  router.post('/rooms', auth, async (req, res) => {
    const parsed = roomBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'invalid_request', details: parsed.error.format() }); return; }
    const { userId } = req as AuthedRequest;
    res.status(201).json({ success: true, data: await svc.createRoom(pool, userId, parsed.data) });
  });
  router.patch('/rooms/:id', auth, async (req, res) => {
    const parsed = roomBody.partial().safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'invalid_request' }); return; }
    const { userId } = req as AuthedRequest;
    const r = await svc.patchRoom(pool, userId, req.params.id, parsed.data);
    if (!r) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true, data: r });
  });
  router.delete('/rooms/:id', auth, async (req, res) => {
    const { userId } = req as AuthedRequest;
    const ok = await svc.deleteRoom(pool, userId, req.params.id);
    res.status(ok ? 200 : 404).json(ok ? { success: true } : { error: 'not_found' });
  });

  const bookingBody = z.object({
    roomId: z.string().min(1).max(200),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    choreographyId: z.string().max(200).nullable().optional(),
    classId: z.string().max(200).nullable().optional(),
    purpose: z.string().max(500).nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
  });
  router.get('/room-bookings', auth, async (req, res) => {
    const { userId } = req as AuthedRequest;
    const filters: { roomId?: string; from?: string; to?: string } = {};
    if (typeof req.query.roomId === 'string') filters.roomId = req.query.roomId;
    if (typeof req.query.from === 'string') filters.from = req.query.from;
    if (typeof req.query.to === 'string') filters.to = req.query.to;
    res.json({ success: true, data: await svc.listBookings(pool, userId, filters) });
  });
  router.post('/room-bookings', auth, async (req, res) => {
    const parsed = bookingBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'invalid_request', details: parsed.error.format() }); return; }
    const { userId } = req as AuthedRequest;
    res.status(201).json({ success: true, data: await svc.createBooking(pool, userId, parsed.data) });
  });
  router.patch('/room-bookings/:id', auth, async (req, res) => {
    const parsed = bookingBody.partial().safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'invalid_request' }); return; }
    const { userId } = req as AuthedRequest;
    const r = await svc.patchBooking(pool, userId, req.params.id, parsed.data);
    if (!r) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true, data: r });
  });
  router.delete('/room-bookings/:id', auth, async (req, res) => {
    const { userId } = req as AuthedRequest;
    const ok = await svc.deleteBooking(pool, userId, req.params.id);
    res.status(ok ? 200 : 404).json(ok ? { success: true } : { error: 'not_found' });
  });

  // ─── Movement vocab ────────────────────────────────
  const vocabBody = z.object({
    term: z.string().min(1).max(200),
    category: z.enum(['turn', 'leap', 'lift', 'extension', 'partnering', 'improv', 'other']).optional(),
    definition: z.string().min(1).max(5000),
    referenceVideoUrl: z.string().url().max(2000).nullable().optional(),
    aliases: z.array(z.string().max(120)).max(20).optional(),
    difficulty: z.enum(['beginner', 'intermediate', 'advanced', 'pro']).nullable().optional(),
    projectId: z.string().max(200).nullable().optional(),
  });
  router.get('/movement-vocab', auth, async (req, res) => {
    const { userId } = req as AuthedRequest;
    res.json({ success: true, data: await svc.listVocab(pool, userId, projectIdQuery(req)) });
  });
  router.post('/movement-vocab', auth, async (req, res) => {
    const parsed = vocabBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'invalid_request', details: parsed.error.format() }); return; }
    const { userId } = req as AuthedRequest;
    res.status(201).json({ success: true, data: await svc.createVocab(pool, userId, parsed.data) });
  });
  router.patch('/movement-vocab/:id', auth, async (req, res) => {
    const parsed = vocabBody.partial().safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'invalid_request' }); return; }
    const { userId } = req as AuthedRequest;
    const r = await svc.patchVocab(pool, userId, req.params.id, parsed.data);
    if (!r) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true, data: r });
  });
  router.delete('/movement-vocab/:id', auth, async (req, res) => {
    const { userId } = req as AuthedRequest;
    const ok = await svc.deleteVocab(pool, userId, req.params.id);
    res.status(ok ? 200 : 404).json(ok ? { success: true } : { error: 'not_found' });
  });

  // ─── Season plan (sesongplan med milepæl-tidslinje) ───────────────
  const milestoneSchema = z.object({
    id: z.string().max(200).optional(),
    title: z.string().min(1).max(200),
    dateLabel: z.string().max(80).optional().default(''),
    status: z.enum(['done', 'upcoming']).optional().default('upcoming'),
    icon: z.string().max(60).optional(),
  });
  const seasonBody = z.object({
    label: z.string().min(1).max(200),
    subtitle: z.string().max(300).nullable().optional(),
    milestones: z.array(milestoneSchema).max(100).optional(),
    projectId: z.string().max(200).nullable().optional(),
  });
  router.get('/season', auth, async (req, res) => {
    const { userId } = req as AuthedRequest;
    res.json({ success: true, data: await svc.getSeason(pool, userId, projectIdQuery(req)) });
  });
  router.put('/season', auth, async (req, res) => {
    const parsed = seasonBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'invalid_request', details: parsed.error.format() }); return; }
    const { userId } = req as AuthedRequest;
    const input = { ...parsed.data, projectId: parsed.data.projectId ?? projectIdQuery(req) };
    res.json({ success: true, data: await svc.upsertSeason(pool, userId, input) });
  });

  return router;
}
