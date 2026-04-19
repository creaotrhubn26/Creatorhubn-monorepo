/**
 * Role Room client portal — magic-link auth + dashboard data aggregation.
 *
 * The producer invites a client by email → we mint a long, random
 * session token + persist the row → return a magic-link URL for the
 * producer to share. Client clicks the link, hits the dashboard
 * endpoint with ?token=…, and sees the current marketing plan.
 *
 * The session token IS the authentication credential — treat it like
 * a bearer token. Over HTTPS that's equivalent to any bookmarked
 * session-cookie URL. Producers can revoke to cut access.
 */

import crypto from 'node:crypto';
import type { Pool } from 'pg';
import {
  fetchActiveMarketingPlan,
  type PersistedMarketingPlan,
} from './role-room-marketing-plan.js';
import { listPlanPosts, type PersistedPlanPost } from './role-room-marketing-plan-posts.js';

const DEFAULT_EXPIRES_IN_DAYS = 30;

export interface ClientPortalSession {
  id: string;
  sessionToken: string;
  clientEmail: string;
  clientName: string | null;
  projectId: string;
  invitedByUserId: string;
  status: 'active' | 'revoked' | 'expired';
  expiresAt: Date;
  createdAt: Date;
  lastSeenAt: Date | null;
}

function mapSessionRow(row: Record<string, unknown>): ClientPortalSession {
  return {
    id: String(row.id),
    sessionToken: String(row.session_token),
    clientEmail: String(row.client_email),
    clientName: (row.client_name as string | null) ?? null,
    projectId: String(row.project_id),
    invitedByUserId: String(row.invited_by_user_id),
    status: (row.status as ClientPortalSession['status']) ?? 'active',
    expiresAt: row.expires_at as Date,
    createdAt: row.created_at as Date,
    lastSeenAt: (row.last_seen_at as Date | null) ?? null,
  };
}

function generateSessionToken(): string {
  // 32 bytes → 43 base64url chars. Wide enough that guessing is
  // statistically impossible even without additional signing.
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Mint a new client-portal session bound to (email, project). Multiple
 * active sessions for the same (email, project) are allowed — the
 * producer may want to hand multiple clients the same portal without
 * a revoke/re-invite round trip.
 */
export async function createClientPortalInvite(
  pool: Pool,
  input: {
    projectId: string;
    invitedByUserId: string;
    clientEmail: string;
    clientName?: string | null;
    expiresInDays?: number;
  },
): Promise<ClientPortalSession | null> {
  const expiresInDays = Math.min(
    90,
    Math.max(1, Math.round(input.expiresInDays ?? DEFAULT_EXPIRES_IN_DAYS)),
  );
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
  const token = generateSessionToken();
  try {
    const result = await pool.query(
      `INSERT INTO role_room_client_portal_sessions
         (session_token, client_email, client_name, project_id,
          invited_by_user_id, status, expires_at)
       VALUES ($1, $2, $3, $4, $5, 'active', $6)
       RETURNING *`,
      [
        token,
        input.clientEmail.toLowerCase().trim(),
        input.clientName?.trim() || null,
        input.projectId,
        input.invitedByUserId,
        expiresAt,
      ],
    );
    return result.rows[0] ? mapSessionRow(result.rows[0]) : null;
  } catch (error) {
    console.error('[client-portal] invite failed', error);
    return null;
  }
}

/**
 * Resolve a session by its token. Returns null for unknown, revoked,
 * or expired tokens — all three are indistinguishable to the caller
 * so a valid-looking leaked token can't be used to enumerate state.
 * Side-effect: touches last_seen_at for active sessions so the
 * producer dashboard can show "last seen 3h ago".
 */
export async function resolveClientPortalSession(
  pool: Pool,
  sessionToken: string,
): Promise<ClientPortalSession | null> {
  if (!sessionToken || sessionToken.length < 32) return null;
  try {
    const result = await pool.query(
      `SELECT * FROM role_room_client_portal_sessions
        WHERE session_token = $1
        LIMIT 1`,
      [sessionToken],
    );
    const row = result.rows[0];
    if (!row) return null;
    const session = mapSessionRow(row);
    if (session.status !== 'active') return null;
    if (session.expiresAt.getTime() <= Date.now()) {
      // Mark expired in-place so producers can see it in the list
      // without the client being able to distinguish expired from
      // merely unknown.
      await pool
        .query(
          `UPDATE role_room_client_portal_sessions
              SET status = 'expired'
            WHERE id = $1 AND status = 'active'`,
          [session.id],
        )
        .catch(() => {});
      return null;
    }
    // Fire-and-forget last-seen update.
    await pool
      .query(
        `UPDATE role_room_client_portal_sessions
            SET last_seen_at = now()
          WHERE id = $1`,
        [session.id],
      )
      .catch(() => {});
    return session;
  } catch (error) {
    console.error('[client-portal] resolve failed', error);
    return null;
  }
}

export async function listClientPortalSessionsForProject(
  pool: Pool,
  projectId: string,
  ownerUserId: string,
): Promise<ClientPortalSession[]> {
  try {
    const result = await pool.query(
      `SELECT * FROM role_room_client_portal_sessions
        WHERE project_id = $1 AND invited_by_user_id = $2
        ORDER BY created_at DESC
        LIMIT 50`,
      [projectId, ownerUserId],
    );
    return result.rows.map(mapSessionRow);
  } catch (error) {
    console.error('[client-portal] list failed', error);
    return [];
  }
}

export async function revokeClientPortalSession(
  pool: Pool,
  sessionId: string,
  ownerUserId: string,
): Promise<boolean> {
  try {
    const result = await pool.query(
      `UPDATE role_room_client_portal_sessions
          SET status = 'revoked', revoked_at = now()
        WHERE id = $1 AND invited_by_user_id = $2 AND status = 'active'`,
      [sessionId, ownerUserId],
    );
    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    console.error('[client-portal] revoke failed', error);
    return false;
  }
}

// ── Dashboard data aggregation ──────────────────────────────────────────

export interface ClientDashboardProgress {
  /** Dager siden plan.start_date (null hvis draft — ikke aktivert). */
  dayIntoPlan: number | null;
  daysRemaining: number | null;
  /** Posts hvis status er 'published'. */
  publishedCount: number;
  /** Posts planlagt (flipped til 'scheduled' men ikke enda publisert). */
  scheduledCount: number;
  /** Posts som er forslag — ikke aksepsjonert inn i feed-planneren ennå. */
  proposedCount: number;
  /** Antall posts skippet manuelt. */
  skippedCount: number;
}

export interface ClientDashboardData {
  project: {
    id: string;
    title: string | null;
  };
  plan: PersistedMarketingPlan;
  posts: PersistedPlanPost[];
  progress: ClientDashboardProgress;
  /** Neste 3 forfalte eller nært forestående posts for "neste
   *  handling"-feltet øverst på dashbordet. */
  upcoming: PersistedPlanPost[];
  /** Når tokenet går ut — vises i footer så klient vet. */
  sessionExpiresAt: string;
}

function computeProgress(
  plan: PersistedMarketingPlan,
  posts: PersistedPlanPost[],
): ClientDashboardProgress {
  const published = posts.filter((p) => p.status === 'published').length;
  const scheduled = posts.filter((p) => p.status === 'scheduled').length;
  const proposed = posts.filter((p) => p.status === 'proposed').length;
  const skipped = posts.filter((p) => p.status === 'skipped').length;
  let dayIntoPlan: number | null = null;
  let daysRemaining: number | null = null;
  if (plan.startDate) {
    const msSince = Date.now() - new Date(plan.startDate).getTime();
    const daysSince = Math.floor(msSince / (24 * 60 * 60 * 1000));
    dayIntoPlan = Math.max(0, daysSince);
    daysRemaining = Math.max(0, plan.horizonDays - dayIntoPlan);
  }
  return {
    dayIntoPlan,
    daysRemaining,
    publishedCount: published,
    scheduledCount: scheduled,
    proposedCount: proposed,
    skippedCount: skipped,
  };
}

function pickUpcoming(posts: PersistedPlanPost[], limit = 3): PersistedPlanPost[] {
  const now = Date.now();
  const pending = posts.filter(
    (p) => p.status === 'proposed' || p.status === 'scheduled',
  );
  // Sort by scheduledFor first (soonest-pending), then by day_offset
  // for pre-activation plans, then fall back to sort_order.
  const sorted = pending.slice().sort((a, b) => {
    const aT = a.scheduledFor?.getTime();
    const bT = b.scheduledFor?.getTime();
    if (aT && bT) return aT - bT;
    if (aT && !bT) return -1;
    if (!aT && bT) return 1;
    const aD = a.dayOffset ?? Infinity;
    const bD = b.dayOffset ?? Infinity;
    if (aD !== bD) return aD - bD;
    return a.sortOrder - b.sortOrder;
  });
  return sorted.slice(0, limit);
}

/**
 * Resolve the dashboard for a session. The session already encodes
 * which project the client is entitled to see, so no further scoping
 * is needed. Returns null if the project has no active plan yet —
 * the client should see a "kommer snart"-state.
 */
export async function fetchClientDashboard(
  pool: Pool,
  session: ClientPortalSession,
): Promise<ClientDashboardData | null> {
  const plan = await fetchActiveMarketingPlan(pool, session.projectId);
  if (!plan) return null;

  const posts = await listPlanPosts(pool, plan.id);

  let projectTitle: string | null = null;
  try {
    // Legacy projects.id is varchar — matches session.project_id format.
    const titleRow = await pool.query(
      `SELECT name FROM projects WHERE id = $1 LIMIT 1`,
      [session.projectId],
    );
    projectTitle = (titleRow.rows[0]?.name as string | undefined) ?? null;
  } catch {
    /* projects table may be called differently in some schemas; leave null */
  }

  return {
    project: { id: session.projectId, title: projectTitle },
    plan,
    posts,
    progress: computeProgress(plan, posts),
    upcoming: pickUpcoming(posts),
    sessionExpiresAt: session.expiresAt.toISOString(),
  };
}
