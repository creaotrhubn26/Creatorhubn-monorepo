/**
 * Dance team routes — mountes under /api/dance/teams og /api/dance/invites.
 *
 * Auth-modell:
 *   • Alle routes krever auth (Bearer-token).
 *   • Owner-only routes: caller.userId === teamOrgId (Studio-eier eier teamet).
 *   • Public-with-auth: GET /invites/:token (alle authede brukere kan slå opp).
 *   • POST /invites/:token/accept — auth required (binder caller til teamet).
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
import * as svc from './dance-team-service.js';

interface SessionData {
  userId: string;
  email: string;
  name: string;
  role: string;
  loginAt: string;
  [key: string]: unknown;
}
type AuthedRequest = Request & { userId: string; userRole: string; userEmail: string };

async function resolveUser(
  pool: Pool,
  activeSessions: Map<string, SessionData> | undefined,
  bearer: string | null | undefined,
): Promise<SessionData | null> {
  const token = typeof bearer === 'string' ? bearer.trim() : '';
  if (!token) return null;
  const inMemory = activeSessions?.get(token) ?? null;
  if (inMemory) return inMemory;
  const persisted = await loadPersistedAuthSession<SessionData>(pool, token);
  if (persisted) { activeSessions?.set(token, persisted); return persisted; }
  return null;
}

function requireAuth(pool: Pool, activeSessions?: Map<string, SessionData>) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim();
    const session = await resolveUser(pool, activeSessions, bearer);
    if (!session?.userId) { res.status(401).json({ error: 'unauthorized' }); return; }
    (req as AuthedRequest).userId = session.userId;
    (req as AuthedRequest).userRole = session.role;
    (req as AuthedRequest).userEmail = session.email;
    next();
  };
}

function requireOwner() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const callerId = (req as AuthedRequest).userId;
    const teamOrgId = String(req.params.teamOrgId ?? '');
    if (!callerId || callerId !== teamOrgId) {
      res.status(403).json({ error: 'forbidden', detail: 'team_owner_only' });
      return;
    }
    next();
  };
}

// ─── Validation schemas ─────────────────────────────────────────────────

const labelSchema = z.string().trim().min(1).max(80);
const capabilitiesSchema = z.record(z.boolean());
const displayOrderSchema = z.number().int().min(0).max(10000);

const createTeamBody = z.object({
  studioName: z.string().max(200).optional(),
});

const createRoleBody = z.object({
  label: labelSchema,
  capabilities: capabilitiesSchema,
  isDefaultForInvite: z.boolean().optional(),
  displayOrder: displayOrderSchema.optional(),
});

const updateRoleBody = z.object({
  label: labelSchema.optional(),
  capabilities: capabilitiesSchema.optional(),
  isDefaultForInvite: z.boolean().optional(),
  displayOrder: displayOrderSchema.optional(),
});

const inviteBody = z.object({
  invitedEmail: z.string().email().max(200),
  invitedRoleId: z.string().uuid(),
  expiresAt: z.string().datetime().optional(),
});

const memberRolePatchBody = z.object({
  danceRoleId: z.string().uuid(),
});

// ─── Router ─────────────────────────────────────────────────────────────

export interface CreateDanceTeamRouterDeps {
  activeSessions?: Map<string, SessionData>;
}

export function createDanceTeamRouter(
  pool: Pool,
  deps: CreateDanceTeamRouterDeps = {},
): ExpressRouter {
  const router = Router();
  const auth = requireAuth(pool, deps.activeSessions);

  // ─── Capability-katalog (public-with-auth, brukes av UI) ───────────
  router.get('/capabilities', auth, (_req, res) => {
    res.json({
      success: true,
      data: {
        groups: svc.CAPABILITIES,
        all: Array.from(svc.ALL_CAPABILITY_KEYS),
      },
    });
  });

  // ─── My team / membership ───────────────────────────────────────────
  router.get('/me', auth, async (req, res) => {
    const { userId } = req as AuthedRequest;
    const membership = await svc.getMembershipForUser(pool, userId);
    if (!membership) {
      // Sjekk om brukeren ER en eier (har eget team)
      const summary = await svc.getTeamSummary(pool, userId);
      if (summary.memberCount === 0) {
        res.json({ success: true, data: null });
        return;
      }
      res.json({ success: true, data: { team: summary, member: null, role: null } });
      return;
    }
    res.json({ success: true, data: membership });
  });

  router.get('/me/capabilities', auth, async (req, res) => {
    const { userId } = req as AuthedRequest;
    const caps = await svc.resolveUserCapabilities(pool, userId);
    res.json({ success: true, data: { capabilities: Array.from(caps) } });
  });

  // ─── Create / ensure team ───────────────────────────────────────────
  router.post('/', auth, async (req, res) => {
    const parsed = createTeamBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_request', details: parsed.error.format() });
      return;
    }
    const { userId, userEmail } = req as AuthedRequest;
    try {
      const summary = await svc.ensureTeamForOwner(pool, userId, userEmail);
      res.status(201).json({ success: true, data: summary });
    } catch (err) {
      res.status(500).json({ error: 'create_team_failed', detail: String(err) });
    }
  });

  // ─── Roles ──────────────────────────────────────────────────────────
  router.get('/:teamOrgId/roles', auth, async (req, res) => {
    const teamOrgId = String(req.params.teamOrgId);
    const { userId } = req as AuthedRequest;
    // Tillat alle medlemmer å lese rolle-listen (de trenger den i invite-UI etc).
    const membership = await svc.getMembershipForUser(pool, userId);
    const isOwner = userId === teamOrgId;
    const isMember = membership?.team.teamOrganizationId === teamOrgId;
    if (!isOwner && !isMember) {
      res.status(403).json({ error: 'forbidden' }); return;
    }
    const roles = await svc.listRoles(pool, teamOrgId);
    res.json({ success: true, data: roles });
  });

  router.post('/:teamOrgId/roles', auth, requireOwner(), async (req, res) => {
    const parsed = createRoleBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_request', details: parsed.error.format() });
      return;
    }
    try {
      const role = await svc.createRole(pool, String(req.params.teamOrgId), parsed.data);
      res.status(201).json({ success: true, data: role });
    } catch (err) {
      res.status(400).json({ error: 'create_role_failed', detail: String(err) });
    }
  });

  router.patch('/:teamOrgId/roles/:roleId', auth, requireOwner(), async (req, res) => {
    const parsed = updateRoleBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_request', details: parsed.error.format() });
      return;
    }
    const role = await svc.updateRole(pool, String(req.params.roleId), parsed.data);
    if (!role) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true, data: role });
  });

  router.delete('/:teamOrgId/roles/:roleId', auth, requireOwner(), async (req, res) => {
    const r = await svc.deleteRole(pool, String(req.params.roleId));
    if (!r.deleted) {
      res.status(409).json({ error: 'cannot_delete_role', detail: r.reason });
      return;
    }
    res.json({ success: true });
  });

  // ─── Members ────────────────────────────────────────────────────────
  router.get('/:teamOrgId/members', auth, async (req, res) => {
    const teamOrgId = String(req.params.teamOrgId);
    const { userId } = req as AuthedRequest;
    const membership = await svc.getMembershipForUser(pool, userId);
    const isOwner = userId === teamOrgId;
    const isMember = membership?.team.teamOrganizationId === teamOrgId;
    if (!isOwner && !isMember) {
      res.status(403).json({ error: 'forbidden' }); return;
    }
    const members = await svc.listMembers(pool, teamOrgId);
    res.json({ success: true, data: members });
  });

  router.patch('/:teamOrgId/members/:memberId', auth, requireOwner(), async (req, res) => {
    const parsed = memberRolePatchBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_request', details: parsed.error.format() });
      return;
    }
    const m = await svc.updateMemberRole(
      pool,
      String(req.params.teamOrgId),
      String(req.params.memberId),
      parsed.data.danceRoleId,
    );
    if (!m) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true, data: m });
  });

  router.delete('/:teamOrgId/members/:memberId', auth, requireOwner(), async (req, res) => {
    const r = await svc.removeMember(
      pool,
      String(req.params.teamOrgId),
      String(req.params.memberId),
    );
    if (!r.removed) {
      res.status(409).json({ error: 'cannot_remove', detail: r.reason });
      return;
    }
    res.json({ success: true });
  });

  // ─── Invites ────────────────────────────────────────────────────────
  router.get('/:teamOrgId/invites', auth, requireOwner(), async (req, res) => {
    const invites = await svc.listInvites(pool, String(req.params.teamOrgId));
    res.json({ success: true, data: invites });
  });

  router.post('/:teamOrgId/invites', auth, requireOwner(), async (req, res) => {
    const parsed = inviteBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_request', details: parsed.error.format() });
      return;
    }
    const { userId } = req as AuthedRequest;
    try {
      const result = await svc.createInvite(pool, {
        teamOrgId: String(req.params.teamOrgId),
        invitedEmail: parsed.data.invitedEmail,
        invitedRoleId: parsed.data.invitedRoleId,
        invitedByUserId: userId,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : undefined,
      });
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      const code = String(err instanceof Error ? err.message : err);
      if (code === 'seat_limit_reached' || code === 'role_not_found_for_team') {
        res.status(409).json({ error: code });
        return;
      }
      res.status(400).json({ error: 'create_invite_failed', detail: code });
    }
  });

  router.delete('/:teamOrgId/invites/:token', auth, requireOwner(), async (req, res) => {
    const ok = await svc.revokeInvite(pool, String(req.params.token));
    if (!ok) { res.status(404).json({ error: 'not_found_or_already_processed' }); return; }
    res.json({ success: true });
  });

  return router;
}

// ─── Separat router for /api/dance/invites/:token (auth, ikke owner-only) ─

export function createDanceInviteAcceptRouter(
  pool: Pool,
  deps: CreateDanceTeamRouterDeps = {},
): ExpressRouter {
  const router = Router();
  const auth = requireAuth(pool, deps.activeSessions);

  // GET — slår opp invite (auth-only, men ikke owner-only — alle brukere kan
  // se hvem som har invitert dem).
  router.get('/:token', auth, async (req, res) => {
    const inv = await svc.getInviteByToken(pool, String(req.params.token));
    if (!inv) { res.status(404).json({ error: 'not_found' }); return; }
    if (inv.revokedAt) { res.status(410).json({ error: 'revoked' }); return; }
    if (inv.acceptedAt) { res.status(409).json({ error: 'already_accepted' }); return; }
    if (new Date(inv.expiresAt) <= new Date()) {
      res.status(410).json({ error: 'expired' }); return;
    }
    res.json({ success: true, data: inv });
  });

  // POST /:token/accept — binder caller til teamet
  router.post('/:token/accept', auth, async (req, res) => {
    const { userId, userEmail } = req as AuthedRequest;
    try {
      const r = await svc.acceptInvite(pool, String(req.params.token), userId, userEmail);
      if (!r.accepted) {
        res.status(409).json({ error: r.reason ?? 'accept_failed' });
        return;
      }
      res.json({
        success: true,
        data: {
          teamOrganizationId: r.teamOrganizationId,
          danceRoleId: r.danceRoleId,
        },
      });
    } catch (err) {
      res.status(500).json({ error: 'accept_failed', detail: String(err) });
    }
  });

  return router;
}
