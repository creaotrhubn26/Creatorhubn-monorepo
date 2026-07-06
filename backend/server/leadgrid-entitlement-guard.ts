/**
 * leadgrid-entitlement-guard.ts
 *
 * SERVER-SIDE håndhevelse av SuperAdmin-tilgangsmatrisen (mig 0370).
 *
 * QA 2026-07-06 avdekket at gating var 100% klient-side: en «sperret»
 * feature ble bare skjult i iPad-UI-et, mens dataendepunktet fortsatt
 * kunne kalles direkte. Denne guarden er backbone-en for ekte
 * håndhevelse — den slår opp `leadgrid_org_entitlements.state` for
 * brukerens org og blokkerer `locked`-features på serveren.
 *
 * Semantikk (matcher klienten, bakoverkompatibelt):
 *   - Ingen rader for org-en   → FAIL-OPEN (alt tillatt; org uten
 *     matrise-oppsett = eldre kunde, ikke sperret).
 *   - Rad finnes, state=locked → BLOKKERT (403).
 *   - Rad finnes, annen state  → tillatt.
 *   - Platform-admin (super_admin/admin) → alltid tillatt (bypass).
 *
 * feature_key = Swift `LeadgridFeature.key` (case-navnet, f.eks.
 * "leadbookPondus").
 *
 * Utrulling er inkrementell: Pondus-rutene er første håndhevede feature
 * (proof). Nye features wires ved å kalle `assertEntitled` i ruta.
 */

import type { Pool } from "pg";
import { resolveOrgIdForUser } from "./leadgrid-org-resolver.js";

export type EntitlementDecision = {
  allowed: boolean;
  /** 'included' | 'trial' | 'add_on' | 'locked' | null (ingen rad) */
  state: string | null;
  organizationId: string | null;
};

/**
 * Slår opp om `userId` sin org har tilgang til `featureKey`.
 * Fail-open ved manglende org eller manglende rad.
 */
export async function checkEntitlement(
  pool: Pool,
  userId: string,
  featureKey: string,
): Promise<EntitlementDecision> {
  const orgId = await resolveOrgIdForUser(pool, userId).catch(() => null);
  if (!orgId) {
    // Ingen org-kobling → behold bakoverkompatibel åpen tilgang.
    return { allowed: true, state: null, organizationId: null };
  }
  const r = await pool.query<{ state: string }>(
    `SELECT state FROM leadgrid_org_entitlements
      WHERE organization_id = $1 AND feature_key = $2
      LIMIT 1`,
    [orgId, featureKey],
  );
  const state = r.rows[0]?.state ?? null;
  // Ingen rad = ingen override for denne featuren → åpen (samme som
  // klientens `hasServerEntitlements ? .included : .included`-default).
  const allowed = state == null ? true : state !== "locked";
  return { allowed, state, organizationId: orgId };
}

/**
 * Express-vennlig hjelper: returnerer `true` hvis tilgang OK, ellers
 * sender 403 og returnerer `false` (kall-stedet skal da `return`).
 * Kast-frie — feil i oppslaget fail-open-er (returnerer true) så en
 * DB-hikke ikke låser ute betalende kunder.
 */
export async function assertEntitled(
  pool: Pool,
  userId: string,
  featureKey: string,
  res: { status: (n: number) => { json: (b: unknown) => unknown } },
): Promise<boolean> {
  try {
    const decision = await checkEntitlement(pool, userId, featureKey);
    if (!decision.allowed) {
      res.status(403).json({
        error: "entitlement_locked",
        feature: featureKey,
        message: "Organisasjonen har ikke tilgang til denne funksjonen.",
      });
      return false;
    }
    return true;
  } catch (e) {
    console.error("[entitlement-guard] check failed (fail-open):", e);
    return true;
  }
}
