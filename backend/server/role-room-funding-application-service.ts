/**
 * role-room-funding-application-service.ts
 *
 * Søknadsflaten for tilskudd (Del A punkt 114, tredje runde).
 *
 * Eksporten og innsendings-snapshotet løste hver sin bit, men ingen av dem
 * svarte på spørsmålet produsenten faktisk stiller: **er søknaden klar til å
 * sendes?** Det er der tiden går, og det er der søknader ryker.
 *
 * Poenget med denne modulen er at systemet allerede VET mesteparten. Budsjettet
 * ligger der, opptaksdagene ligger der, framdriftsplanen ligger der. Å be
 * produsenten krysse av manuelt for ting vi kan regne ut selv er å flytte
 * arbeid feil vei.
 *
 * Derfor: hvert krav er enten automatisk avgjort fra data vi har, eller
 * eksplisitt markert som noe som må lastes opp. Ingenting står som «ukjent»
 * uten at det sies hvorfor.
 *
 * Kravene er hentet fra NFIs ordningssider og ligger som data — ordningene
 * endrer krav, og den som oppdager det er en produsent foran en frist.
 */

import type { Pool } from "pg";

/** NFI krever at minst 80 % av finansieringen er bekreftet. */
export const CONFIRMED_FINANCING_THRESHOLD = 0.8;

export interface FinancingSummary {
  total: number;
  confirmed: number;
  unconfirmed: number;
  confirmedRatio: number | null;
  public: number;
  private: number;
  meetsThreshold: boolean;
  /** Hvor mye som mangler for å nå terskelen. 0 når den er nådd. */
  shortfallToThreshold: number;
  sources: Array<{ name: string; type: string; amount: number; confirmed: boolean }>;
}

export type RequirementState = "met" | "unmet" | "manual_pending" | "not_applicable";

export interface RequirementStatus {
  key: string;
  label: string;
  description: string | null;
  mandatory: boolean;
  state: RequirementState;
  /** Hvorfor kravet står som det gjør — alltid utfylt når state ikke er «met». */
  detail: string;
  /** True når systemet avgjorde kravet selv. */
  automatic: boolean;
}

export interface ApplicationReadiness {
  applicationId: string;
  label: string;
  schemeKey: string;
  schemeName: string;
  deadlineAt: string | null;
  daysToDeadline: number | null;
  status: string;
  requirements: RequirementStatus[];
  /** Klar når alle obligatoriske krav er oppfylt. */
  ready: boolean;
  mandatoryTotal: number;
  mandatoryMet: number;
  /** Det som gjenstår, i den rekkefølgen det bør tas. */
  blockers: string[];
  financing: FinancingSummary;
  warnings: string[];
}

// ── Finansiering ────────────────────────────────────────────────────────────

export async function getFinancingSummary(pool: Pool, projectId: string): Promise<FinancingSummary> {
  const r = await pool.query(
    `SELECT source_name, source_type, amount, confirmed
       FROM role_room_financing_sources
      WHERE project_id = $1
      ORDER BY confirmed DESC, amount DESC`,
    [projectId],
  );

  const sources = (r.rows as Array<Record<string, unknown>>).map((row) => ({
    name: String(row.source_name),
    type: String(row.source_type),
    amount: Number(row.amount ?? 0),
    confirmed: Boolean(row.confirmed),
  }));

  const total = sources.reduce((s, x) => s + x.amount, 0);
  const confirmed = sources.filter((x) => x.confirmed).reduce((s, x) => s + x.amount, 0);
  const ratio = total > 0 ? confirmed / total : null;

  return {
    total,
    confirmed,
    unconfirmed: total - confirmed,
    confirmedRatio: ratio === null ? null : Math.round(ratio * 1000) / 1000,
    public: sources.filter((x) => x.type === "public").reduce((s, x) => s + x.amount, 0),
    // Egenkapital er private midler i NFIs forstand — skillet ordningen ber om
    // er offentlig mot privat, ikke selskapets egne mot andres. Uten dette
    // ville egenkapital gitt en falsk blokker på nesten alle produksjoner.
    private: sources
      .filter((x) => x.type === "private" || x.type === "own")
      .reduce((s, x) => s + x.amount, 0),
    meetsThreshold: ratio !== null && ratio >= CONFIRMED_FINANCING_THRESHOLD,
    // Konkret kronebeløp framfor en prosent — det er beløpet som må skaffes.
    shortfallToThreshold:
      ratio === null || ratio >= CONFIRMED_FINANCING_THRESHOLD
        ? 0
        : Math.ceil(total * CONFIRMED_FINANCING_THRESHOLD - confirmed),
    sources,
  };
}

// ── Automatiske krav-sjekker ────────────────────────────────────────────────

interface CheckContext {
  pool: Pool;
  projectId: string;
  schemeKey: string;
  financing: FinancingSummary;
}

type CheckResult = { state: RequirementState; detail: string };

const CHECKS: Record<string, (ctx: CheckContext) => Promise<CheckResult>> = {
  async budget_present({ pool, projectId }) {
    const r = await pool.query<{ n: string; total: string }>(
      `SELECT COUNT(*)::int AS n, COALESCE(SUM(estimate),0) AS total
         FROM role_room_budget_items WHERE project_id = $1`,
      [projectId],
    );
    const n = Number(r.rows[0]?.n ?? 0);
    const total = Number(r.rows[0]?.total ?? 0);
    if (n === 0) return { state: "unmet", detail: "Ingen budsjettlinjer. Start fra en budsjettmal." };
    if (total === 0) return { state: "unmet", detail: `${n} budsjettlinjer, men ingen beløp er fylt inn.` };
    return { state: "met", detail: `${n} linjer, ${total.toLocaleString("nb-NO")} totalt.` };
  },

  async budget_fully_mapped({ pool, projectId, schemeKey }) {
    // Ukartlagte poster kommer ikke med i eksporten — de forsvinner stille,
    // og det er nettopp den feilen ingen oppdager.
    const r = await pool.query<{ category: string }>(
      `SELECT DISTINCT b.category
         FROM role_room_budget_items b
        WHERE b.project_id = $1
          AND NOT EXISTS (
            SELECT 1 FROM role_room_funding_category_mappings m
              JOIN role_room_funding_schemes s ON s.id = m.scheme_id
             WHERE s.scheme_key = $2 AND m.source_category = b.category
          )`,
      [projectId, schemeKey],
    );
    if (r.rowCount === 0) return { state: "met", detail: "Alle budsjettkategorier er kartlagt." };
    const names = r.rows.map((x) => x.category);
    return {
      state: "unmet",
      detail: `${names.length} kategori(er) mangler kartlegging og vil ikke komme med: ${names.join(", ")}.`,
    };
  },

  async financing_plan_present({ financing }) {
    if (financing.sources.length === 0) {
      return { state: "unmet", detail: "Ingen finansieringskilder er registrert." };
    }
    // Kun «other» står igjen som uklassifisert — offentlig, privat og
    // egenkapital er alle plassert i skillet ordningen ber om.
    const untyped = financing.total - financing.public - financing.private;
    if (untyped > 0) {
      const names = financing.sources.filter((s) => s.type === "other").map((s) => s.name);
      return {
        state: "unmet",
        detail:
          `${untyped.toLocaleString("nb-NO")} er ikke merket som offentlig eller privat` +
          (names.length ? ` (${names.join(", ")})` : "") +
          `. NFI krever at planen skiller dem.`,
      };
    }
    return {
      state: "met",
      detail:
        `${financing.sources.length} kilder: ${financing.public.toLocaleString("nb-NO")} offentlig, ` +
        `${financing.private.toLocaleString("nb-NO")} privat.`,
    };
  },

  async financing_80_percent({ financing }) {
    if (financing.total === 0) {
      return { state: "unmet", detail: "Ingen finansiering registrert ennå." };
    }
    const pct = Math.round((financing.confirmedRatio ?? 0) * 100);
    if (financing.meetsThreshold) {
      return { state: "met", detail: `${pct} % bekreftet.` };
    }
    return {
      state: "unmet",
      detail:
        `${pct} % bekreftet — kravet er 80 %. Det mangler ` +
        `${financing.shortfallToThreshold.toLocaleString("nb-NO")} i bekreftet finansiering.`,
    };
  },

  async timeline_present({ pool, projectId }) {
    const r = await pool.query<{ n: string; with_dates: string }>(
      `SELECT COUNT(*)::int AS n,
              COUNT(*) FILTER (WHERE due_at IS NOT NULL)::int AS with_dates
         FROM role_room_phase_timeline_items WHERE project_id = $1`,
      [projectId],
    );
    const n = Number(r.rows[0]?.n ?? 0);
    const withDates = Number(r.rows[0]?.with_dates ?? 0);
    if (n === 0) return { state: "unmet", detail: "Ingen framdriftsplan. Start fra en sjekkliste-mal." };
    if (withDates === 0) {
      return { state: "unmet", detail: `${n} punkter, men ingen har frist. En plan uten datoer er ikke en framdriftsplan.` };
    }
    return { state: "met", detail: `${n} punkter, ${withDates} med frist.` };
  },

  async shoot_plan_present({ pool, projectId }) {
    const r = await pool.query<{ days: string; scheduled: string }>(
      `SELECT (SELECT COUNT(*)::int FROM casting_production_days WHERE project_id = $1) AS days,
              (SELECT COUNT(*)::int FROM role_room_stripboard_entries
                WHERE project_id = $1 AND production_day_id IS NOT NULL) AS scheduled`,
      [projectId],
    );
    const days = Number(r.rows[0]?.days ?? 0);
    const scheduled = Number(r.rows[0]?.scheduled ?? 0);
    if (days === 0) return { state: "unmet", detail: "Ingen opptaksdager er lagt inn." };
    if (scheduled === 0) {
      return { state: "unmet", detail: `${days} opptaksdager, men ingen scener er fordelt på dem.` };
    }
    return { state: "met", detail: `${days} opptaksdager, ${scheduled} scener fordelt.` };
  },
};

// ── Vurderingen ─────────────────────────────────────────────────────────────

export async function getApplicationReadiness(
  pool: Pool,
  applicationId: string,
): Promise<ApplicationReadiness> {
  const appRes = await pool.query(
    `SELECT a.id, a.project_id, a.label, a.deadline_at::text AS deadline_at, a.status,
            s.id AS scheme_id, s.scheme_key, s.name AS scheme_name, s.verified
       FROM role_room_funding_applications a
       JOIN role_room_funding_schemes s ON s.id = a.scheme_id
      WHERE a.id = $1 LIMIT 1`,
    [applicationId],
  );
  if (appRes.rowCount === 0) throw new Error(`Ukjent søknad: ${applicationId}`);
  const app = appRes.rows[0] as Record<string, unknown>;
  const projectId = String(app.project_id);
  const schemeKey = String(app.scheme_key);

  const [reqRes, itemRes, financing] = await Promise.all([
    pool.query(
      `SELECT requirement_key, label, description, auto_check, mandatory, sort_order
         FROM role_room_funding_requirements
        WHERE scheme_id = $1 ORDER BY sort_order`,
      [app.scheme_id],
    ),
    pool.query(
      `SELECT requirement_key, status, document_url, note
         FROM role_room_funding_application_items WHERE application_id = $1`,
      [applicationId],
    ),
    getFinancingSummary(pool, projectId),
  ]);

  const manualByKey = new Map(
    (itemRes.rows as Array<Record<string, unknown>>).map((r) => [String(r.requirement_key), r]),
  );
  const ctx: CheckContext = { pool, projectId, schemeKey, financing };

  const requirements: RequirementStatus[] = [];
  for (const raw of reqRes.rows as Array<Record<string, unknown>>) {
    const key = String(raw.requirement_key);
    const manual = manualByKey.get(key);

    // Manuelt «ikke aktuelt» vinner over alt — produsenten vet om ordningen
    // gjelder dem.
    if (manual?.status === "not_applicable") {
      requirements.push({
        key, label: String(raw.label), description: (raw.description as string) ?? null,
        mandatory: Boolean(raw.mandatory), state: "not_applicable",
        detail: (manual.note as string) || "Markert som ikke aktuelt.",
        automatic: false,
      });
      continue;
    }

    const autoCheck = raw.auto_check ? CHECKS[String(raw.auto_check)] : undefined;
    if (autoCheck) {
      let result: CheckResult;
      try {
        result = await autoCheck(ctx);
      } catch (err) {
        // En sjekk som feiler skal ikke se ut som et oppfylt krav.
        result = { state: "unmet", detail: `Kunne ikke kontrolleres: ${String(err).slice(0, 120)}` };
      }
      requirements.push({
        key, label: String(raw.label), description: (raw.description as string) ?? null,
        mandatory: Boolean(raw.mandatory), ...result, automatic: true,
      });
      continue;
    }

    // Manuelt krav: må bekreftes eksplisitt.
    requirements.push({
      key, label: String(raw.label), description: (raw.description as string) ?? null,
      mandatory: Boolean(raw.mandatory),
      state: manual?.status === "ready" ? "met" : "manual_pending",
      detail:
        manual?.status === "ready"
          ? (manual.document_url as string) ? `Vedlegg registrert.` : "Bekreftet."
          : "Må lastes opp og bekreftes.",
      automatic: false,
    });
  }

  const mandatory = requirements.filter((r) => r.mandatory && r.state !== "not_applicable");
  const met = mandatory.filter((r) => r.state === "met");
  const blockers = mandatory.filter((r) => r.state !== "met").map((r) => `${r.label}: ${r.detail}`);

  const warnings: string[] = [];
  if (!app.verified) {
    warnings.push(
      `Kontoplanen for «${app.scheme_name}» er ikke kontrollert mot ordningens gjeldende mal.`,
    );
  }

  const deadlineAt = (app.deadline_at as string) ?? null;
  const daysToDeadline = deadlineAt
    ? Math.ceil((new Date(`${deadlineAt}T12:00:00Z`).getTime() - Date.now()) / 86_400_000)
    : null;
  if (daysToDeadline !== null && daysToDeadline < 0) {
    warnings.push(`Fristen gikk ut for ${Math.abs(daysToDeadline)} dager siden.`);
  } else if (daysToDeadline !== null && daysToDeadline <= 14 && blockers.length > 0) {
    warnings.push(
      `${daysToDeadline} dager til frist, og ${blockers.length} krav gjenstår.`,
    );
  }

  return {
    applicationId: String(app.id),
    label: String(app.label),
    schemeKey,
    schemeName: String(app.scheme_name),
    deadlineAt,
    daysToDeadline,
    status: String(app.status),
    requirements,
    ready: blockers.length === 0,
    mandatoryTotal: mandatory.length,
    mandatoryMet: met.length,
    blockers,
    financing,
    warnings,
  };
}

/**
 * Setter status på et manuelt krav. Automatiske krav kan ikke overstyres til
 * «ferdig» — da ville avkryssingen skjult at dataene faktisk mangler.
 */
export async function setRequirementStatus(
  pool: Pool,
  input: {
    applicationId: string;
    requirementKey: string;
    status: "pending" | "ready" | "not_applicable";
    documentUrl?: string | null;
    note?: string | null;
    userId: string | null;
  },
): Promise<void> {
  const auto = await pool.query<{ auto_check: string | null }>(
    `SELECT r.auto_check
       FROM role_room_funding_requirements r
       JOIN role_room_funding_applications a ON a.scheme_id = r.scheme_id
      WHERE a.id = $1 AND r.requirement_key = $2 LIMIT 1`,
    [input.applicationId, input.requirementKey],
  );
  if (auto.rowCount === 0) throw new Error(`Ukjent krav: ${input.requirementKey}`);
  if (auto.rows[0].auto_check && input.status === "ready") {
    throw new Error(
      `«${input.requirementKey}» avgjøres automatisk og kan ikke krysses av manuelt — ` +
        `fyll inn dataene i stedet.`,
    );
  }

  await pool.query(
    `INSERT INTO role_room_funding_application_items
       (application_id, requirement_key, status, document_url, note, updated_by_user_id)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (application_id, requirement_key) DO UPDATE SET
       status = EXCLUDED.status,
       document_url = EXCLUDED.document_url,
       note = EXCLUDED.note,
       updated_by_user_id = EXCLUDED.updated_by_user_id,
       updated_at = NOW()`,
    [
      input.applicationId, input.requirementKey, input.status,
      input.documentUrl ?? null, input.note ?? null, input.userId,
    ],
  );
}
