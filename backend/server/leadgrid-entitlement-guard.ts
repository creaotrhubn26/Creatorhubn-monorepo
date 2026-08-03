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
  return checkAnyEntitlement(pool, userId, [featureKey]);
}

/**
 * «Tillat hvis MINST ÉN av `featureKeys` er åpen». Brukes når ett
 * endepunkt serverer data som UI-et deler over flere separat-gatede
 * features (f.eks. pondus_templates → Maler/Pondus/Eksempler/Innsikt).
 * Å gate et slikt delt endepunkt på én enkelt feature ville sperret
 * søsken-fanene urettmessig.
 *
 * Semantikk: fail-open ved manglende org; åpen hvis org-en IKKE har
 * noen override-rader for NOEN av nøklene (eldre kunde); ellers åpen
 * hvis minst én rad er ikke-`locked`. Blokkert kun hvis alle relevante
 * rader er `locked`.
 */
export async function checkAnyEntitlement(
  pool: Pool,
  userId: string,
  featureKeys: string[],
): Promise<EntitlementDecision> {
  const orgId = await resolveOrgIdForUser(pool, userId).catch(() => null);
  if (!orgId || featureKeys.length === 0) {
    return { allowed: true, state: null, organizationId: orgId ?? null };
  }
  const r = await pool.query<{ feature_key: string; state: string }>(
    `SELECT feature_key, state FROM leadgrid_org_entitlements
      WHERE organization_id = $1 AND feature_key = ANY($2::text[])`,
    [orgId, featureKeys],
  );
  if (r.rows.length === 0) {
    // Ingen override for noen av nøklene → åpen (bakoverkompatibelt).
    return { allowed: true, state: null, organizationId: orgId };
  }
  const anyOpen = r.rows.some((row) => row.state !== "locked");
  // Representativ state for logging: første ikke-locked, ellers locked.
  const state = r.rows.find((row) => row.state !== "locked")?.state
    ?? r.rows[0].state;
  return { allowed: anyOpen, state, organizationId: orgId };
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
  return assertAnyEntitled(pool, userId, [featureKey], res);
}

/**
 * Som `assertEntitled`, men tillater hvis MINST ÉN av `featureKeys` er
 * åpen — for delte endepunkter (se `checkAnyEntitlement`).
 */
export async function assertAnyEntitled(
  pool: Pool,
  userId: string,
  featureKeys: string[],
  res: { status: (n: number) => { json: (b: unknown) => unknown } },
): Promise<boolean> {
  try {
    const decision = await checkAnyEntitlement(pool, userId, featureKeys);
    if (!decision.allowed) {
      res.status(403).json({
        error: "entitlement_locked",
        features: featureKeys,
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

/** Leadbook-feature-gruppen — alle serveres av pondus_templates. */
export const LEADBOOK_FEATURE_KEYS = [
  "leadbookMaler",
  "leadbookPondus",
  "leadbookEksempler",
  "leadbookInnsikt",
];

/** Leadgrid Go-gruppen (tilleggstjeneste) — kjørebok + auto-registrering +
 *  team-dashbord. Gate GRUPPEN: åpent hvis MINST én key ikke er «locked». */
export const LEADGRID_GO_FEATURE_KEYS = [
  "leadgridGoKjorebok",
  "leadgridGoAuto",
  "leadgridGoDashboard",
];

/** Kvalitet-avdelingen (tilleggstjeneste) — salgsverifisering m/ samtale-maler. */
export const LEADGRID_KVALITET_FEATURE_KEYS = ["leadgridKvalitet"];

/** Tettsted-tildeling (SSB tettbygde strøk under kommunenivå) — katalogen
 *  som driver «Tildel område → Tettsted» på iPad. Nøkkelen matcher
 *  LeadgridFeature.omradeTildeling (Swift-casenavn = stabil API-nøkkel). */
export const LEADGRID_OMRADE_FEATURE_KEYS = ["omradeTildeling"];

/** AI-strukturering av Leadbook-eksempler (Claude-kall = kostnadsbærende) —
 *  egen nøkkel så den kan styres per plan uavhengig av Eksempler-fanen. */
export const LEADBOOK_AI_STRUKTUR_FEATURE_KEYS = ["leadbookAIStrukturering"];

/** Anbud (Doffin) — tilleggstjeneste: søk + overvåkning av offentlige
 *  anskaffelser. Nøkkelen matcher LeadgridFeature.leadgridAnbud. */
export const LEADGRID_ANBUD_FEATURE_KEYS = ["leadgridAnbud"];

/** Ruteplanlegger (2026-08-04): fler-stopp dagsruter m/ leder-tildeling.
 *  Nøkkelen matcher LeadgridFeature.leadgridRuteplanlegger. */
export const LEADGRID_RUTEPLAN_FEATURE_KEYS = ["leadgridRuteplanlegger"];

