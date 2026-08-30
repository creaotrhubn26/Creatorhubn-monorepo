/**
 * lead-map-session-helper.ts
 *
 * RT-5: Sentral bearer-token resolver med DB-fallback for alle
 * lead-map-* routes. Tidligere hadde hver fil sin egen synkrone
 * helper som KUN sjekket in-memory activeSessions — etter en
 * Render-restart eller på en annen instans i horisontal scaling kom
 * persisted-sessjoner ikke til syne før hydratePersistedAuthSessions
 * hadde fullført (fire-and-forget, ingen retry pr request).
 *
 * Speilet etter capture-routes.ts:316-329.
 */

import type { NextFunction, Request, Response } from "express";
import type { Pool } from "pg";
import { loadPersistedAuthSession } from "./auth-session-store.js";

type SessionData = {
  userId: string;
  role?: string;
  email?: string;
  name?: string;
  loginAt?: string;
};

/** Persisted-form: bredere enn feltene Leadgrid-vaktene bruker. Hele objektet
 *  beholdes i cachen fordi /api/auth/user også leser name/loginAt. */
type PersistedSessionRow = {
  userId: string;
  email: string;
  name: string;
  role: string;
  loginAt: string;
  [key: string]: unknown;
};

type IpadTokenSessionRow = {
  user_id: string;
  email: string | null;
  role: string | null;
  name: string | null;
  login_at: string;
  revoked_at: string | null;
  is_active: boolean;
};

type IpadTokenLookup = {
  found: boolean;
  session: SessionData | null;
};

const IPAD_BEARER_RE = /^[a-f0-9]{64}$/;
const MAX_BEARER_LENGTH = 512;
const requestSessionCache = new WeakMap<
  Request,
  { session: SessionData | null }
>();

async function loadIpadTokenSession(
  pool: Pool,
  token: string,
): Promise<IpadTokenLookup> {
  // Native Leadgrid tokens are minted as 32 random bytes encoded as hex.
  // Reject other bearer formats before touching ipad_tokens so API keys and
  // unrelated auth schemes mounted below /api/leadgrid are never confused
  // with an iPad session.
  if (!IPAD_BEARER_RE.test(token)) {
    return { found: false, session: null };
  }

  const result = await pool.query<IpadTokenSessionRow>(
    `SELECT t.user_id,
            u.email,
            u.role,
            COALESCE(
              NULLIF(BTRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''),
              u.email
            ) AS name,
            t.created_at::text AS login_at,
            t.revoked_at::text,
            COALESCE(u.is_active, TRUE) AS is_active
       FROM ipad_tokens t
       LEFT JOIN users u ON u.id::text = t.user_id
      WHERE t.token = $1
      LIMIT 1`,
    [token],
  );
  const row = result.rows[0];
  if (!row) return { found: false, session: null };
  if (
    !row.user_id ||
    row.revoked_at !== null ||
    row.is_active !== true ||
    !row.email?.trim() ||
    !row.name?.trim()
  ) {
    return { found: true, session: null };
  }

  return {
    found: true,
    session: {
      userId: row.user_id,
      email: row.email,
      role: row.role ?? "member",
      name: row.name,
      loginAt: row.login_at,
    },
  };
}

export async function resolveLeadMapSession(
  req: Request,
  pool: Pool,
  activeSessions: Map<string, SessionData>,
): Promise<SessionData | null> {
  const requestCached = requestSessionCache.get(req);
  if (requestCached) return requestCached.session;

  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    requestSessionCache.set(req, { session: null });
    return null;
  }
  const token = auth.slice(7).trim();
  if (!token || token.length > MAX_BEARER_LENGTH) {
    requestSessionCache.set(req, { session: null });
    return null;
  }

  // ipad_tokens is authoritative for 64-char native bearers. Validate it even
  // when the process Map already contains the token, so revoked tokens and
  // deactivated users cannot survive in a warm pod cache.
  const ipadLookup = await loadIpadTokenSession(pool, token);
  if (ipadLookup.found) {
    if (ipadLookup.session) {
      activeSessions.set(token, ipadLookup.session);
    } else {
      activeSessions.delete(token);
    }
    requestSessionCache.set(req, { session: ipadLookup.session });
    return ipadLookup.session;
  }

  const inMem = activeSessions.get(token);
  if (inMem) {
    requestSessionCache.set(req, { session: inMem });
    return inMem;
  }
  // RT-5: Fallback til persistert lagring så restart/scale-out ikke
  // 401'er alle eksisterende sessjoner.
  const persisted = await loadPersistedAuthSession<PersistedSessionRow>(
    pool,
    token,
  );
  if (persisted) {
    // Keep the complete shape. /api/auth/user runs after this middleware and
    // expects name/loginAt in addition to the fields used by Leadgrid guards.
    activeSessions.set(token, persisted);
    requestSessionCache.set(req, { session: persisted });
    return persisted;
  }
  requestSessionCache.set(req, { session: null });
  return null;
}

/**
 * Read-through middleware for the Leadgrid namespaces. It does not require
 * authentication and therefore leaves public routes untouched; it only warms
 * activeSessions when a valid bearer is present. Existing synchronous route
 * guards can then keep reading the Map while remaining safe across instances.
 */
export function createLeadMapSessionHydrator(
  pool: Pool,
  activeSessions: Map<string, SessionData>,
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  return async (req, _res, next) => {
    try {
      await resolveLeadMapSession(req, pool, activeSessions);
      next();
    } catch (error) {
      // A shared-store outage must surface as a server error, not a misleading
      // 401 that makes the iOS client erase an otherwise valid login.
      next(error);
    }
  };
}
