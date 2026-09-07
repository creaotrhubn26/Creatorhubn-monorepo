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
 * i det aktuelle kundeprosjektet (ikke 'won'/'lost'/'do_not_contact').
 * Kandidater må samtidig ha tilgang til akkurat dette prosjektet.
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
    projectId: string;
    industryId: string | null;
    currentOwnerUserId?: string | null;
  },
): Promise<RoutingDecision> {
  const projectId = opts.projectId?.trim();
  if (!projectId) throw new Error("projectId is required for Leadgrid routing");

  if (!opts.industryId) {
    return {
      userId: opts.currentOwnerUserId ?? null,
      reason: "no_industry",
      candidatesConsidered: 0,
    };
  }

  // Hent medlemmer med denne bransjen som faktisk kan se prosjektet,
  // og tell bare åpne leads i samme kundeprosjekt.
  const r = await pool.query<RoutingCandidate>(
    `SELECT mi.user_id::text                     AS user_id,
            mi.expertise_level                   AS expertise_level,
            mi.is_primary                        AS is_primary,
            COALESCE(open_counts.n, 0)::int      AS open_lead_count
       FROM organization_member_industries mi
       JOIN leadgrid_projects project
         ON project.organization_id = mi.organization_id
        AND project.id = $2
        AND (project.status IS NULL OR project.status NOT IN ('archived', 'deleted'))
       LEFT JOIN organization_members member
         ON member.organization_id = mi.organization_id
        AND member.user_id = mi.user_id
       LEFT JOIN leadgrid_project_members project_member
         ON project_member.organization_id = mi.organization_id
        AND project_member.project_id = project.id
        AND project_member.user_id = mi.user_id
       LEFT JOIN (
         SELECT owner_user_id, COUNT(*)::int AS n
           FROM crm_customers
          WHERE archived_at IS NULL
            AND organization_id = $1::uuid
            AND project_id = $2
            AND COALESCE(lead_status, 'new') NOT IN ('won', 'lost', 'do_not_contact')
          GROUP BY owner_user_id
       ) open_counts ON open_counts.owner_user_id = mi.user_id::text
      WHERE mi.organization_id = $1::uuid
        AND mi.industry_id = $3::uuid
        AND (
          project.created_by = mi.user_id
          OR project_member.user_id IS NOT NULL
          OR (
            member.user_id IS NOT NULL
            AND NOT EXISTS (
              SELECT 1
                FROM leadgrid_user_permission_overrides denied
               WHERE denied.organization_id = mi.organization_id
                 AND denied.user_id = mi.user_id
                 AND denied.permission_key = 'projects.view_all'
                 AND denied.effect = 'revoke'
            )
            AND (
              member.role = 'admin'
              OR EXISTS (
                SELECT 1
                  FROM role_permissions defaults
                 WHERE defaults.role = member.role
                   AND defaults.permission_key = 'projects.view_all'
              )
              OR EXISTS (
                SELECT 1
                  FROM leadgrid_user_permission_overrides granted
                 WHERE granted.organization_id = mi.organization_id
                   AND granted.user_id = mi.user_id
                   AND granted.permission_key = 'projects.view_all'
                   AND granted.effect = 'grant'
              )
            )
          )
        )`,
    [opts.organizationId, projectId, opts.industryId],
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
    projectId: string;
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
        WHERE id = $1::uuid
          AND organization_id = $3::uuid
          AND project_id = $4
          AND owner_user_id IS DISTINCT FROM $2`,
      [leadId, decision.userId, opts.organizationId, opts.projectId],
    );
  }
  return decision;
}

/** Re-export for unit-tester. */
export const __test = {
  routeLeadByIndustry,
};
