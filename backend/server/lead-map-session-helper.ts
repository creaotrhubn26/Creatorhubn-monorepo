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

import type { Request } from "express";
import type { Pool } from "pg";
import { loadPersistedAuthSession } from "./auth-session-store.js";

type SessionData = { userId: string; role?: string; email?: string };

/** Persisted-form: bredere enn lead-maps SessionData, men gir oss userId
 *  + nok metadata for caching. Vi caster ned til SessionData ved retur —
 *  lead-map-handlerne leser kun userId / role / email. */
type PersistedSessionRow = {
  userId: string;
  email: string;
  name: string;
  role: string;
  loginAt: string;
  [key: string]: unknown;
};

export async function resolveLeadMapSession(
  req: Request,
  pool: Pool,
  activeSessions: Map<string, SessionData>,
): Promise<SessionData | null> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  if (!token) return null;
  const inMem = activeSessions.get(token);
  if (inMem) return inMem;
  // RT-5: Fallback til persistert lagring så restart/scale-out ikke
  // 401'er alle eksisterende sessjoner.
  const persisted = await loadPersistedAuthSession<PersistedSessionRow>(
    pool, token,
  );
  if (persisted) {
    const narrowed: SessionData = {
      userId: persisted.userId,
      role: persisted.role,
      email: persisted.email,
    };
    activeSessions.set(token, narrowed);
    return narrowed;
  }
  return null;
}
