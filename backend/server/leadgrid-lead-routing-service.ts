/**
 * leadgrid-lead-routing-service.ts
 *
 * Auto-routing av nye leads basert på bransje (mig 329 LAG 3).
 *
 * Regelsett:
 *   1. Hvis `industry_id` ikke er satt på lead'en → behold default owner.
 *   2. Hvis medlemmer i samme org har `is_primary = TRUE` på den
 *      bransjen → velg blant dem (round-robin etter `created_at` på
 *      tildelt-historikken — minst belastet vinner).
 *   3. Ellers hvis medlemmer har `expertise_level = 'expert'` → velg
 *      blant dem (round-robin).
 *   4. Ellers hvis `expertise_level = 'specialist'` → velg blant dem.
 *   5. Ellers behold default owner.
 *
 * Round-robin = velger medlemmet med færrest åpne lead-tildelinger
 * i org'en (ikke 'won'/'lost'/'do_not_contact'). Stabilt mot pseudo-
 * skjevhet på under 5 leads/medlem.
 *
 * Brukes fra alle lead-creation-pathene (URL Research, CSV import,
 * manual create, business card scanner) via `routeLeadByIndustry()`.
 *
 * NB: rutingen er IDempotent — gjentatt kall på samme lead-id med
 * samme industry returnerer samme owner forutsatt at workload-snapshot
 * ikke har endret seg vesentlig. Caller bestemmer om resultatet
 * faktisk persisteres.
 */

import type { Pool } from "pg";

export interface RoutingDecision {
  userId: string | null;
  reason:
    | "no_industry"
    | "no_candidates"
    | "primary"
    | "expert"
    | "specialist"
    | "no_change";
  candidatesConsidered: number;
}

interface RoutingCandidate {
  user_id: string;
  expertise_level: "general" | "specialist" | "expert";
  is_primary: boolean;
  open_lead_count: number;
}

/**
 * Sentralt entry-point: gitt en lead-rad, returner foreslått owner.
 * Persisterer IKKE — caller beslutter (vil typisk patch-e
 * `crm_customers.owner_user_id` i samme transaksjon som lead-create).
 */
export async function routeLeadByIndustry(
  pool: Pool,
  opts: {
    organizationId: string;
    industryId: string | null;
    currentOwnerUserId?: string | null;
  },
): Promise<RoutingDecision> {
  if (!opts.industryId) {
    return {
      userId: opts.currentOwnerUserId ?? null,
      reason: "no_industry",
      candidatesConsidered: 0,
    };
  }

  // Hent alle medlemmer i org'en som har denne bransjen + tell deres
  // åpne leads i samme org (round-robin-grunnlag).
  const r = await pool.query<RoutingCandidate>(
    `SELECT mi.user_id::text                     AS user_id,
            mi.expertise_level                   AS expertise_level,
            mi.is_primary                        AS is_primary,
            COALESCE(open_counts.n, 0)::int      AS open_lead_count
       FROM organization_member_industries mi
       LEFT JOIN (
         SELECT owner_user_id, COUNT(*)::int AS n
           FROM crm_customers
          WHERE archived_at IS NULL
            AND organization_id = $1::uuid
            AND lead_status NOT IN ('won', 'lost', 'do_not_contact')
          GROUP BY owner_user_id
       ) open_counts ON open_counts.owner_user_id = mi.user_id::text
      WHERE mi.organization_id = $1::uuid
        AND mi.industry_id = $2::uuid`,
    [opts.organizationId, opts.industryId],
  );

  const candidates = r.rows;
  if (candidates.length === 0) {
    return {
      userId: opts.currentOwnerUserId ?? null,
      reason: "no_candidates",
      candidatesConsidered: 0,
    };
  }

  // Hierarki: primary > expert > specialist. General faller utenfor
  // auto-routing — vi kobler dem ikke automatisk for å unngå støy.
  const buckets: Array<{ tier: RoutingDecision["reason"]; rows: RoutingCandidate[] }> = [
    { tier: "primary",    rows: candidates.filter((c) => c.is_primary) },
    { tier: "expert",     rows: candidates.filter((c) => !c.is_primary && c.expertise_level === "expert") },
    { tier: "specialist", rows: candidates.filter((c) => !c.is_primary && c.expertise_level === "specialist") },
  ];

  for (const bucket of buckets) {
    if (bucket.rows.length === 0) continue;
    // Round-robin: lavest open_lead_count. Stabilt sortert på user_id
    // som tie-breaker for deterministiske tester.
    bucket.rows.sort((a, b) => {
      if (a.open_lead_count !== b.open_lead_count) {
        return a.open_lead_count - b.open_lead_count;
      }
      return a.user_id.localeCompare(b.user_id);
    });
    return {
      userId: bucket.rows[0].user_id,
      reason: bucket.tier,
      candidatesConsidered: candidates.length,
    };
  }

  return {
    userId: opts.currentOwnerUserId ?? null,
    reason: "no_change",
    candidatesConsidered: candidates.length,
  };
}

/**
 * Convenience: kjør routeLeadByIndustry og persistér resultatet.
 * Brukes fra lead-creation-paths som vil ha alt i én kall.
 *
 * Returnerer beslutningen som ble tatt, slik at caller kan logge eller
 * notify-e medlemmet (f.eks. via PUSH/in-app).
 */
export async function routeAndPersist(
  pool: Pool,
  leadId: string,
  opts: {
    organizationId: string;
    industryId: string | null;
    currentOwnerUserId?: string | null;
  },
): Promise<RoutingDecision> {
  const decision = await routeLeadByIndustry(pool, opts);
  if (
    decision.userId &&
    decision.userId !== opts.currentOwnerUserId &&
    (decision.reason === "primary" ||
      decision.reason === "expert" ||
      decision.reason === "specialist")
  ) {
    await pool.query(
      `UPDATE crm_customers
          SET owner_user_id = $2,
              updated_at = NOW()
        WHERE id = $1::uuid`,
      [leadId, decision.userId],
    );
  }
  return decision;
}

/** Re-export for unit-tester. */
export const __test = {
  routeLeadByIndustry,
};
