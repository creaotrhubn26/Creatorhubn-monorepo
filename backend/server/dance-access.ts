/**
 * dance-access.ts — delt tilgangsresolver for dans-vertikalen.
 *
 * BAKGRUNN
 * ────────
 * Team-laget (dance_team_role + capabilities + invites) var bygget, men ALDRI
 * koblet til data-laget: alle dance-data-ruter scopet `WHERE owner_user_id =
 * callerId`. Et invitert team-medlem (Lærer/Koreograf/Danser) så derfor et TOMT
 * studio — deres egen bruker eier ingenting; studioets data eies av studio-
 * eierens user_id. Denne resolveren kobler de to lagene:
 *
 *   • Eier av eget studio (eller solo-bruker uten team) → orgOwnerId = egen
 *     userId, ALLE capabilities.
 *   • Medlem av et studio → orgOwnerId = studio-eierens id, rollens caps
 *     (Eier-rolle = alle).
 *   • Ingen team-membership → solo-sikkerhetsventil: egen id + alle caps
 *     (aldri lås ute eksisterende solo-brukere; speiler safety-valve-mønsteret
 *     fra Story Arc RBAC).
 *
 * SIKKERHET
 * ─────────
 * `orgOwnerId` er den IDOR-sensitive verdien og MÅ alltid derives fra auth
 * (`userId`), ALDRI fra request-body/query. Data-ruter filtrerer fortsatt
 * `WHERE id = $resourceId AND owner_user_id = $orgOwnerId`, så en bruker i
 * studio A som gjetter en ressurs-id i studio B får 404 (owner-mismatch).
 * Ved DB-feil fail-safe til solo (egen id) — lekker aldri et annet studios data.
 *
 * Denne resolveren er ISOLERT til dans-vertikalen: den keyer kun
 * `enterprise_team_members (org_kind='dance_studio')` + `dance_team_role`, og
 * skal ALDRI blandes med produksjonsteam-RBAC (Story Arc) eller andre
 * vertikalers tilgangsmodeller.
 */

import type { Pool } from 'pg';
import type { Request, Response, NextFunction } from 'express';
import { ALL_CAPABILITY_KEYS } from './dance-team-service.js';

export interface DanceContext {
  /** Innlogget brukers user_id (den handlende brukeren). */
  userId: string;
  /** owner_user_id å scope data-queries på (= studioets eier). */
  orgOwnerId: string;
  /** Effektive capabilities for denne brukeren i dette studioet. */
  capabilities: ReadonlySet<string>;
  /** True hvis caller er eier av org-en (orgOwnerId === userId). */
  isOwner: boolean;
  /** True hvis brukeren ikke er i noe dance-team (solo-fallback). */
  isSolo: boolean;
}

interface CacheEntry {
  ctx: DanceContext;
  at: number;
}

// Kort TTL: rolle/cap-endringer slår gjennom innen ~10s (som role-room-tab-access).
const CACHE_TTL_MS = 10_000;
const cache = new Map<string, CacheEntry>();

function allCaps(): Set<string> {
  return new Set(ALL_CAPABILITY_KEYS);
}

function safeJsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object') return value as Record<string, unknown>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return {};
}

/**
 * Resolver dance-kontekst for en innlogget bruker. Cachet per userId (10s).
 */
export async function resolveDanceContext(pool: Pool, userId: string): Promise<DanceContext> {
  const cached = cache.get(userId);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.ctx;

  let ctx: DanceContext;
  try {
    // Prefererer brukerens EGET studio hvis de eier ett (organization_id = userId),
    // ellers det studioet de sist ble med i. Én aktiv kontekst av gangen.
    const r = await pool.query(
      `SELECT m.organization_id, r.capabilities, r.is_owner_role
         FROM enterprise_team_members m
         LEFT JOIN dance_team_role r ON r.id = m.dance_role_id
        WHERE m.org_kind = 'dance_studio'
          AND m.user_id = $1
          AND m.status = 'active'
        ORDER BY (m.organization_id = $1) DESC, m.joined_at DESC NULLS LAST
        LIMIT 1`,
      [userId],
    );

    if (!r.rowCount) {
      // Solo — ingen team. Egen data, alle caps.
      ctx = { userId, orgOwnerId: userId, capabilities: allCaps(), isOwner: true, isSolo: true };
    } else {
      const row = r.rows[0];
      const orgOwnerId = String(row.organization_id);
      const isOwnerRole = row.is_owner_role === true || row.is_owner_role === 't';
      let capabilities: ReadonlySet<string>;
      if (isOwnerRole) {
        // Eier-rolle har alltid alle capabilities, uavhengig av JSONB-innhold.
        capabilities = allCaps();
      } else {
        const raw = safeJsonObject(row.capabilities);
        capabilities = new Set(Object.keys(raw).filter((k) => raw[k] === true));
      }
      ctx = {
        userId,
        orgOwnerId,
        capabilities,
        isOwner: orgOwnerId === userId,
        isSolo: false,
      };
    }
  } catch {
    // Fail-safe: solo over egen data. Lekker aldri et annet studios data.
    ctx = { userId, orgOwnerId: userId, capabilities: allCaps(), isOwner: true, isSolo: true };
  }

  cache.set(userId, { ctx, at: Date.now() });
  return ctx;
}

/** Invaliderer cachen for en bruker (kall etter rolle/medlemskap-endring). */
export function invalidateDanceContext(userId: string): void {
  cache.delete(userId);
}

export function danceCan(ctx: DanceContext, capability: string): boolean {
  return ctx.capabilities.has(capability);
}

/** Request beriket med resolvet dance-kontekst av `danceGuard`. */
export type DanceAuthedRequest = Request & { userId: string; danceCtx: DanceContext };

/**
 * Middleware: resolver dance-kontekst fra `req.userId` (satt av rutefilas egen
 * requireAuth) og fester den på `req.danceCtx`. Hvis `capability` er oppgitt,
 * håndheves den (403 hvis mangler). Kjøres ETTER auth-middleware.
 *
 * Bruk:
 *   router.get('/', auth, danceGuard(pool, 'choreography.view'), handler)
 *   // i handler: const { orgOwnerId } = (req as DanceAuthedRequest).danceCtx;
 */
export function danceGuard(pool: Pool, capability?: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = (req as { userId?: string }).userId;
    if (!userId) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    const ctx = await resolveDanceContext(pool, userId);
    (req as DanceAuthedRequest).danceCtx = ctx;
    if (capability && !ctx.capabilities.has(capability)) {
      res.status(403).json({ error: 'forbidden', detail: 'missing_capability', capability });
      return;
    }
    next();
  };
}
