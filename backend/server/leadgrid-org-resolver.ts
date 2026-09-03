/**
 * leadgrid-org-resolver.ts
 *
 * Felles org-oppslag for Leadgrid-modulene (2026-07-03). Erstatter fem
 * identiske modul-private kopier av resolveOrgIdForUser i:
 * sales-leadership, sales-teams, proposals, pondus og routes-adherence.
 *
 * Oppløsning (i rekkefølge):
 *   1. Modus-override (mig 0365, leadgrid_org_overrides) — super_admins
 *      kan velge modus via POST /api/leadgrid/org-override:
 *        'self'  → solo-modus (orgId = userId)
 *        <id>    → se appen som den org-en
 *      (Skrive-endepunktet håndhever super_admin; resolveren stoler på
 *      at rader kun finnes for autoriserte brukere.)
 *   2. enterprise_team_members (nyeste aktive medlemskap)
 *   3. Fallback: userId (solo-modus)
 *
 * Cache: 30s per bruker så override-oppslaget ikke koster en ekstra
 * query på hvert eneste API-kall.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import type { NextFunction, Request, Response } from "express";
import type { Pool } from "pg";

const CACHE_TTL_MS = 30_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const cache = new Map<string, { orgId: string; expiresAt: number }>();
const requestContext = new AsyncLocalStorage<{ requestedOrganizationId: string | null }>();

export class LeadgridOrganizationAccessError extends Error {
  constructor(public readonly code: "invalid_organization_id" | "not_organization_member") {
    super(code);
    this.name = "LeadgridOrganizationAccessError";
  }
}

/**
 * Captures the iOS client's active workspace for the entire async request.
 * Older Leadgrid modules can keep calling resolveOrgIdForUser; the resolver
 * still sees this request-local value without global per-user state.
 */
export function leadgridOrganizationContextMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const raw = req.get("X-Leadgrid-Organization-Id")?.trim() || null;
  requestContext.run({ requestedOrganizationId: raw }, next);
}

async function resolveRequestedOrganization(
  pool: Pool,
  userId: string,
  requestedOrganizationId: string,
): Promise<string> {
  if (!UUID_PATTERN.test(requestedOrganizationId)) {
    throw new LeadgridOrganizationAccessError("invalid_organization_id");
  }
  const membership = await pool.query(
    `SELECT 1 FROM organization_members
      WHERE organization_id = $1::uuid AND user_id = $2
      LIMIT 1`,
    [requestedOrganizationId, userId],
  );
  if (!membership.rows.length) {
    throw new LeadgridOrganizationAccessError("not_organization_member");
  }
  return requestedOrganizationId;
}

export async function resolveOrgIdForUser(
  pool: Pool,
  userId: string,
): Promise<string> {
  const requestedOrganizationId = requestContext.getStore()?.requestedOrganizationId;
  if (requestedOrganizationId) {
    // Request-local choices are deliberately not cached: the same user can
    // use two devices/windows in different workspaces at the same time.
    return resolveRequestedOrganization(pool, userId, requestedOrganizationId);
  }

  const hit = cache.get(userId);
  if (hit && hit.expiresAt > Date.now()) return hit.orgId;

  let orgId = userId; // solo-fallback

  // 1. Modus-override (tabell kan mangle pre-mig-0365 — stille fallback)
  try {
    const o = await pool.query<{ override_org_id: string | null }>(
      `SELECT override_org_id FROM leadgrid_org_overrides WHERE user_id = $1`,
      [userId],
    );
    const override = o.rows[0]?.override_org_id;
    if (override) {
      orgId = override === "self" ? userId : override;
      cache.set(userId, { orgId, expiresAt: Date.now() + CACHE_TTL_MS });
      return orgId;
    }
  } catch {
    // Tabell mangler — fortsett til medlemskap.
  }

  // 2. Enterprise-medlemskap
  try {
    const r = await pool.query<{ organization_id: string }>(
      `SELECT organization_id
         FROM enterprise_team_members
        WHERE user_id = $1 AND status = 'active'
        ORDER BY joined_at DESC NULLS LAST
        LIMIT 1`,
      [userId],
    );
    if (r.rows[0]?.organization_id) orgId = String(r.rows[0].organization_id);
  } catch {
    // Tabell mangler — behold solo-fallback.
  }

  cache.set(userId, { orgId, expiresAt: Date.now() + CACHE_TTL_MS });
  return orgId;
}

/** Tøm cache for en bruker — kalles når override endres. */
export function invalidateOrgCache(userId: string): void {
  cache.delete(userId);
}
