/**
 * Én rad per kunde: registrert, signert, i gang.
 *
 * Spørsmålet oversikten svarer på er ikke «hvem finnes», men «hvem har
 * faktisk kommet i gang, og hvem mangler noe jeg må følge opp».
 *
 * Derfor skilles det mellom FÅTT og IVERKSATT. En organisasjon kan ha alle
 * rettigheter i entitlements-tabellen og likevel aldri ha kjørt et søk.
 * Rettigheter forteller hva de har lov til; kjøringer og leads forteller om
 * de bruker det. Bare det siste betyr noe når du skal vite hvem som blir
 * kunde.
 *
 * DPA uten signatur er et avvik, ikke en detalj: kjører de Discovery uten
 * databehandleravtale, behandler vi personopplysninger på deres vegne uten
 * hjemmel (GDPR art. 28). Det flagges eksplisitt.
 */
import type { Pool } from "pg";

import { evaluateTrial, type TrialStatus } from "./leadgrid-trial.js";
import {
  AGREEMENT_LABELS,
  REQUIRED_AGREEMENT_TYPES,
  type AgreementType,
} from "./leadgrid-org-agreements.js";

export interface CustomerRow {
  organization_id: string;
  name: string;
  org_number: string | null;
  city: string | null;
  nace_code: string | null;
  plan: string | null;
  created_at: string;
  admin_email: string | null;
  members: number;
  trial: TrialStatus;
  agreements: {
    signed: Array<{ type: AgreementType; label: string; signed_at: string; signer_name: string }>;
    missing: Array<{ type: AgreementType; label: string }>;
  };
  services: {
    /** Rettigheter organisasjonen har fått. */
    granted: string[];
    /** Rettigheter de faktisk har tatt i bruk, målt på data. */
    activated: string[];
  };
  activity: {
    projects: number;
    discovery_runs: number;
    leads: number;
    /** Kandidater godkjent eller avvist — det eneste som viser reell bruk. */
    decisions: number;
    last_activity_at: string | null;
  };
  /** Målt forbruk inneværende måned. Det er dette en faktura bygger på. */
  usage: {
    month: string;
    discovery_runs: number;
    candidates_reserved: number;
    candidate_limit: number | null;
    ai_calls: number;
    ai_cost_usd: number;
    storage_mb: number;
    billable_events: number;
  };
  /** Ting du må gjøre noe med. Tom liste er et godt tegn. */
  flags: string[];
}

/** DPA og personvern er lovpålagt, intensjonsavtalen er kommersiell. */
const REQUIRED_AGREEMENTS = REQUIRED_AGREEMENT_TYPES;

export async function customerOverview(
  pool: Pool,
  options: { organizationId?: string; limit?: number } = {},
): Promise<CustomerRow[]> {
  const grense = Math.min(200, Math.max(1, options.limit ?? 100));
  const rader = await pool.query<{
    id: string; name: string; org_number: string | null; city: string | null;
    nace_code: string | null; plan: string | null; created_at: Date;
    stripe_subscription_id: string | null;
    trial_started_at: Date | null; trial_ends_at: Date | null;
    trial_hard_expires_at: Date | null;
    admin_email: string | null; members: number;
    projects: number; discovery_runs: number; leads: number;
    decisions: number; last_activity_at: Date | null;
  }>(
    `SELECT o.id::text, o.name, o.org_number, o.city, o.nace_code, o.plan,
            o.created_at, o.stripe_subscription_id,
            o.trial_started_at, o.trial_ends_at, o.trial_hard_expires_at,
            (SELECT u.email FROM organization_members m
               JOIN users u ON u.id = m.user_id
              WHERE m.organization_id = o.id AND m.role = 'admin'
              ORDER BY m.created_at LIMIT 1) AS admin_email,
            (SELECT count(*)::int FROM organization_members m
              WHERE m.organization_id = o.id) AS members,
            (SELECT count(*)::int FROM leadgrid_projects p
              WHERE p.organization_id = o.id) AS projects,
            (SELECT count(*)::int FROM leadgrid_discovery_runs r
              WHERE r.organization_id = o.id) AS discovery_runs,
            (SELECT count(*)::int FROM crm_customers c
              WHERE c.organization_id = o.id AND c.archived_at IS NULL) AS leads,
            (SELECT count(*)::int FROM leadgrid_discovery_feedback f
              WHERE f.organization_id = o.id) AS decisions,
            GREATEST(
              (SELECT max(r.created_at) FROM leadgrid_discovery_runs r
                WHERE r.organization_id = o.id),
              (SELECT max(c.updated_at) FROM crm_customers c
                WHERE c.organization_id = o.id)
            ) AS last_activity_at
       FROM organizations o
      WHERE ($1::uuid IS NULL OR o.id = $1::uuid)
      ORDER BY o.created_at DESC
      LIMIT $2`,
    [options.organizationId ?? null, grense],
  );

  const ut: CustomerRow[] = [];
  for (const rad of rader.rows) {
    const [avtaler, rettigheter, forbruk] = await Promise.all([
      pool.query<{ agreement_type: AgreementType; signed_at: Date; signer_name: string }>(
        `SELECT DISTINCT ON (agreement_type) agreement_type, signed_at, signer_name
           FROM leadgrid_org_agreements WHERE organization_id = $1::uuid
          ORDER BY agreement_type, signed_at DESC`,
        [rad.id],
      ),
      pool.query<{ feature: string; state: string }>(
        `SELECT feature, state FROM leadgrid_org_entitlements
          WHERE organization_id = $1::uuid`,
        [rad.id],
      ),
      // Forbruk denne måneden. Tallene kommer fra tabellene som allerede
      // teller — vi lager ingen ny måling, bare samler den som finnes.
      pool.query<{
        run_count: number | null; reserved: number | null; candidate_limit: number | null;
        ai_calls: number | null; ai_cost: string | null; used_bytes: string | null;
        billable: number | null;
      }>(
        `SELECT
           (SELECT run_count FROM leadgrid_discovery_monthly_usage
             WHERE organization_id = $1::uuid
               AND month_start = date_trunc('month', NOW())::date) AS run_count,
           (SELECT reserved_candidates FROM leadgrid_discovery_monthly_usage
             WHERE organization_id = $1::uuid
               AND month_start = date_trunc('month', NOW())::date) AS reserved,
           (SELECT candidate_limit FROM leadgrid_discovery_monthly_usage
             WHERE organization_id = $1::uuid
               AND month_start = date_trunc('month', NOW())::date) AS candidate_limit,
           (SELECT COALESCE(sum(total_calls), 0)::int FROM leadgrid_ai_usage_daily
             WHERE organization_id = $1::uuid
               AND usage_date >= date_trunc('month', NOW())::date) AS ai_calls,
           (SELECT COALESCE(sum(total_cost_usd), 0)::text FROM leadgrid_ai_usage_daily
             WHERE organization_id = $1::uuid
               AND usage_date >= date_trunc('month', NOW())::date) AS ai_cost,
           (SELECT used_bytes::text FROM leadgrid_org_storage_usage
             WHERE organization_id = $1::uuid) AS used_bytes,
           (SELECT count(*)::int FROM leadgrid_usage_events
             WHERE organization_id = $1::uuid AND billable
               AND occurred_at >= date_trunc('month', NOW())) AS billable`,
        [rad.id],
      ),
    ]);
    const f = forbruk.rows[0] ?? {};

    const signert = avtaler.rows.map((a) => ({
      type: a.agreement_type,
      label: AGREEMENT_LABELS[a.agreement_type] ?? a.agreement_type,
      signed_at: a.signed_at.toISOString(),
      signer_name: a.signer_name,
    }));
    const signerteTyper = new Set(signert.map((s) => s.type));
    const mangler = REQUIRED_AGREEMENTS.filter((t) => !signerteTyper.has(t)).map((t) => ({
      type: t,
      label: AGREEMENT_LABELS[t],
    }));

    const gitt = rettigheter.rows
      .filter((r) => r.state !== "off" && r.state !== "disabled")
      .map((r) => r.feature);

    const trial = evaluateTrial(rad);
    const flags: string[] = [];
    if (!signerteTyper.has("dpa") && rad.discovery_runs > 0) {
      // Dette er et GDPR-avvik, ikke en påminnelse.
      flags.push(
        "Kjører Discovery uten signert databehandleravtale — behandling uten hjemmel.",
      );
    } else if (!signerteTyper.has("dpa")) {
      flags.push("Databehandleravtale ikke signert.");
    }
    if (!signerteTyper.has("loi")) flags.push("Intensjonsavtale ikke signert.");
    if (rad.discovery_runs === 0) flags.push("Har aldri kjørt et søk.");
    else if (rad.decisions === 0) flags.push("Har søkt, men aldri godkjent en kandidat.");
    const tak = f.candidate_limit ?? null;
    const brukt = Number(f.reserved ?? 0);
    if (tak && brukt >= tak) {
      flags.push(`Kandidatkvoten for måneden er brukt opp (${brukt} av ${tak}).`);
    } else if (tak && brukt >= tak * 0.8) {
      flags.push(`${brukt} av ${tak} kandidater brukt denne måneden.`);
    }
    if (trial.state === "expired") flags.push("Prøveperioden er ute — skrivebeskyttet.");
    else if (trial.state === "active" && (trial.days_left ?? 99) <= 2) {
      flags.push(`${trial.days_left} dager igjen av prøveperioden.`);
    }

    ut.push({
      organization_id: rad.id,
      name: rad.name,
      org_number: rad.org_number,
      city: rad.city,
      nace_code: rad.nace_code,
      plan: rad.plan,
      created_at: rad.created_at.toISOString(),
      admin_email: rad.admin_email,
      members: rad.members,
      trial,
      agreements: { signed: signert, missing: mangler },
      services: { granted: gitt, activated: activatedServices(rad) },
      usage: {
        month: new Date().toISOString().slice(0, 7),
        discovery_runs: Number(f.run_count ?? 0),
        candidates_reserved: Number(f.reserved ?? 0),
        candidate_limit: f.candidate_limit ?? null,
        ai_calls: Number(f.ai_calls ?? 0),
        ai_cost_usd: Number(f.ai_cost ?? 0),
        storage_mb: Math.round(Number(f.used_bytes ?? 0) / 1_048_576),
        billable_events: Number(f.billable ?? 0),
      },
      activity: {
        projects: rad.projects,
        discovery_runs: rad.discovery_runs,
        leads: rad.leads,
        decisions: rad.decisions,
        last_activity_at: rad.last_activity_at?.toISOString() ?? null,
      },
      flags,
    });
  }
  return ut;
}

/**
 * Hva de faktisk bruker, målt på data — ikke hva de har fått lov til.
 * En rettighet uten bruk er en rettighet ingen har bedt om.
 */
function activatedServices(rad: {
  projects: number; discovery_runs: number; leads: number; decisions: number;
}): string[] {
  const ut: string[] = [];
  if (rad.projects > 0) ut.push("kundeprosjekt");
  if (rad.discovery_runs > 0) ut.push("discovery");
  if (rad.leads > 0) ut.push("leads");
  if (rad.decisions > 0) ut.push("godkjenning");
  return ut;
}
