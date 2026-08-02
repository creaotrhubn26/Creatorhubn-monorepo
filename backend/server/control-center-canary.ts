/**
 * control-center-canary.ts
 *
 * Syntetiske canary-journeys — den PROAKTIVE laget i CreatorHub Control Center.
 * En cron (GitHub Actions, hvert 10. min) kaller `POST /api/control-center/
 * canary/run`, som kjører disse ekte HTTP-reisene mot prod. Målet er å fange
 * feil FØR en bruker gjør det (401-regresjoner, utløpt Stripe-nøkkel, nede-
 * tjenester), ikke bare logge dem etterpå.
 *
 * Designvalg:
 *   - Ingen egne testkontoer kreves for v1. Vi verifiserer (a) reachability
 *     (200), (b) AUTH-GUARD-integritet: uauth-request skal gi 401 — 500 = ødelagt
 *     rute, 200 = auth-bypass, 404 = rute borte. Nettopp klassen vi feilsøkte i
 *     role-room/casting. (c) Stripe live-nøkkel gyldig (fanger «Expired API Key»).
 *   - Feil → `logError()` (idempotent på fingerprint) → dukker opp som incident
 *     i «Hendelser» via den eksisterende error_log→incident-broen.
 *   - Varsel (e-post til super_admin) sendes KUN på tilstandsovergang
 *     (ok→feil og feil→ok) for å unngå spam; logError dedup-er selv.
 *   - Alt er lesing/prober. Ingen skriv mot kunde-data.
 */

import type { Pool } from "pg";
import { logError, type LogErrorInput } from "./error-log-service.js";
import { notifyAdmins, type AdminInboundEvent } from "./admin-notify.js";

export type CanaryVertical = "platform" | "roleroom" | "leadgrid" | "payments";

export interface CanaryCheckDef {
  /** Stabil nøkkel — brukes som rad-nøkkel + del av error-fingerprint. */
  key: string;
  label: string;
  vertical: CanaryVertical;
  url: string;
  /** HTTP-statuser som regnes som OK. Guard-sjekker bruker [401]. */
  acceptable: number[];
  headers?: Record<string, string>;
  /** Menneske-lesbar forklaring på hva sjekken beviser. */
  note: string;
}

export interface CanaryResult {
  key: string;
  label: string;
  vertical: CanaryVertical;
  ok: boolean;
  httpStatus: number | null;
  latencyMs: number;
  expected: string;
  message: string;
  note: string;
}

export interface CanarySummary {
  ran: number;
  ok: number;
  failed: number;
  skipped: number;
  results: CanaryResult[];
}

const DEFAULT_BACKEND = "https://creatorhub-backend-rtbl.onrender.com";
const DEFAULT_ROLEROOM = "https://theroleroom.com";
const TIMEOUT_MS = 8000;

/** En canary-probe-UUID som garantert ikke finnes → tvinger auth-guarden. */
const PROBE_ID = "00000000-0000-0000-0000-0000000ca0a1";

/**
 * Bygger sjekk-listen fra env. Base-URL-er er overstyrbare (CANARY_BACKEND_URL
 * / CANARY_ROLEROOM_URL) for staging. Stripe-sjekken hoppes over hvis ingen
 * live-nøkkel er satt (ærlig-inaktiv, ikke falsk-feil).
 */
export function buildCanaryChecks(
  env: NodeJS.ProcessEnv = process.env,
): CanaryCheckDef[] {
  const backend = (env.CANARY_BACKEND_URL || DEFAULT_BACKEND).replace(/\/+$/, "");
  const roleroom = (env.CANARY_ROLEROOM_URL || DEFAULT_ROLEROOM).replace(/\/+$/, "");

  const checks: CanaryCheckDef[] = [
    {
      key: "platform-health",
      label: "Backend /api/health",
      vertical: "platform",
      url: `${backend}/api/health`,
      acceptable: [200],
      note: "Backend svarer og er live (DNS → edge → app).",
    },
    {
      key: "roleroom-my-tabs-guard",
      label: "Role Room · my-tabs auth-guard",
      vertical: "roleroom",
      url: `${roleroom}/api/role-room/projects/${PROBE_ID}/my-tabs`,
      acceptable: [401],
      note: "Uautorisert kall skal gi 401 (ikke 500=ødelagt, 200=bypass, 404=borte).",
    },
    {
      key: "roleroom-manuscripts-guard",
      label: "Role Room · casting manuscripts auth-guard",
      vertical: "roleroom",
      url: `${roleroom}/api/casting/manuscripts?projectId=${PROBE_ID}`,
      acceptable: [401],
      note: "Uautorisert kall skal gi 401 — samme klasse vi feilsøkte i klient-portalen.",
    },
    {
      key: "leadgrid-territories-reach",
      label: "Leadgrid · territories reachability",
      vertical: "leadgrid",
      url: `${backend}/api/leadgrid/territories`,
      acceptable: [200, 401],
      note: "Endepunktet er nåbart og guardet (200 eller 401, ikke 5xx/404).",
    },
    {
      key: "leadgrid-analytics-reach",
      label: "Leadgrid · analytics overview reachability",
      vertical: "leadgrid",
      url: `${backend}/api/leadgrid/analytics/overview`,
      acceptable: [200, 401],
      note: "Endepunktet er nåbart og guardet (200 eller 401, ikke 5xx/404).",
    },
  ];

  const stripeKey = (env.STRIPE_SECRET_KEY || "").trim();
  if (stripeKey) {
    checks.push({
      key: "payments-stripe-balance",
      label: "Stripe · live-nøkkel gyldig",
      vertical: "payments",
      url: "https://api.stripe.com/v1/balance",
      acceptable: [200],
      headers: { Authorization: `Bearer ${stripeKey}` },
      note: "GET /v1/balance med live-nøkkel — 401 = utløpt/rotert nøkkel (inntekts-stopp).",
    });
  }

  return checks;
}

/** Ren klassifisering: er observert status i akseptabelt sett? */
export function classifyOk(acceptable: number[], status: number | null): boolean {
  return status != null && acceptable.includes(status);
}

export type TransitionAction = "alert" | "recover" | "none";

/**
 * Varsel-styring på tilstandsovergang. `prevOk` = null når ingen tidligere
 * kjøring finnes (første gang) — da varsler vi kun hvis den feiler.
 */
export function transitionAction(prevOk: boolean | null, nowOk: boolean): TransitionAction {
  if (!nowOk && prevOk !== false) return "alert"; // ny feil (eller aldri sett før)
  if (nowOk && prevOk === false) return "recover"; // kom seg
  return "none";
}

/** Path-delen av en URL (for error_log-endpoint + fingerprint-gruppering). */
function urlPath(u: string): string {
  try {
    return new URL(u).pathname;
  } catch {
    return u;
  }
}

/** Kjører én sjekk med timeout. Nettverksfeil/timeout → ok=false, httpStatus=null. */
export async function executeCheck(
  def: CanaryCheckDef,
  fetchImpl: typeof fetch,
  now: () => number = () => Date.now(),
): Promise<CanaryResult> {
  const expected = def.acceptable.join(",");
  const started = now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(def.url, {
      method: "GET",
      headers: def.headers,
      signal: controller.signal,
      // `follow` (ikke `manual`): en godartet host-redirect (apex→www, trailing-
      // slash, http→https) skal ikke telle som 3xx-feil = falsk «canary NEDE».
      redirect: "follow",
    });
    const latencyMs = Math.max(0, Math.round(now() - started));
    const ok = classifyOk(def.acceptable, res.status);
    return {
      key: def.key,
      label: def.label,
      vertical: def.vertical,
      ok,
      httpStatus: res.status,
      latencyMs,
      expected,
      message: ok
        ? `OK ${res.status}`
        : `Forventet ${expected}, fikk ${res.status}`,
      note: def.note,
    };
  } catch (err) {
    const latencyMs = Math.max(0, Math.round(now() - started));
    const isAbort = (err as Error)?.name === "AbortError";
    return {
      key: def.key,
      label: def.label,
      vertical: def.vertical,
      ok: false,
      httpStatus: null,
      latencyMs,
      expected,
      message: isAbort
        ? `Timeout etter ${TIMEOUT_MS} ms`
        : `Nettverksfeil: ${(err as Error)?.message ?? "ukjent"}`,
      note: def.note,
    };
  } finally {
    clearTimeout(timer);
  }
}

export interface RunCanaryDeps {
  fetchImpl?: typeof fetch;
  now?: () => number;
  logErrorFn?: (pool: Pool, input: LogErrorInput) => Promise<string | null>;
  notifyFn?: (pool: Pool, event: AdminInboundEvent) => Promise<void>;
  /** Overstyr sjekk-listen (test). Default: buildCanaryChecks(process.env). */
  checks?: CanaryCheckDef[];
}

/** Er dette en «tabell finnes ikke»-feil (migrasjon ikke kjørt enda)? */
function isMissingTable(err: unknown): boolean {
  return (err as { code?: string })?.code === "42P01";
}

async function prevOkFor(pool: Pool, journeyKey: string): Promise<boolean | null> {
  try {
    const r = await pool.query(
      `SELECT ok FROM control_center_canary_runs
        WHERE journey_key = $1 ORDER BY checked_at DESC LIMIT 1`,
      [journeyKey],
    );
    if (r.rows.length === 0) return null;
    return Boolean(r.rows[0].ok);
  } catch (err) {
    if (isMissingTable(err)) return null;
    throw err;
  }
}

/**
 * Kjører alle canary-sjekker, registrerer utfall, og — ved feil — bygger en
 * error_log-incident + varsler super_admin på tilstandsovergang.
 */
export async function runCanaries(
  pool: Pool,
  deps: RunCanaryDeps = {},
): Promise<CanarySummary> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const now = deps.now ?? (() => Date.now());
  const logErrorFn = deps.logErrorFn ?? logError;
  const notifyFn = deps.notifyFn ?? notifyAdmins;
  const checks = deps.checks ?? buildCanaryChecks();

  const results: CanaryResult[] = [];
  let okCount = 0;
  let failed = 0;

  for (const def of checks) {
    const prevOk = await prevOkFor(pool, def.key);
    const result = await executeCheck(def, fetchImpl, now);
    results.push(result);
    if (result.ok) okCount++;
    else failed++;

    // Registrer utfallet (tåler manglende tabell før migrasjon kjøres).
    try {
      await pool.query(
        `INSERT INTO control_center_canary_runs
           (journey_key, label, vertical, ok, http_status, latency_ms, expected, message)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          def.key,
          def.label,
          def.vertical,
          result.ok,
          result.httpStatus,
          result.latencyMs,
          result.expected,
          result.message,
        ],
      );
    } catch (err) {
      if (!isMissingTable(err)) {
        console.warn("[canary] insert failed:", (err as Error).message);
      }
    }

    // Feil → idempotent incident i error_log (dukker opp i «Hendelser»).
    if (!result.ok) {
      try {
        await logErrorFn(pool, {
          source: "backend",
          level: "error",
          statusCode: result.httpStatus ?? undefined,
          endpoint: urlPath(def.url),
          errorName: "CanaryFailure",
          message: `Canary «${def.label}» feilet: ${result.message}`,
          meta: {
            journeyKey: def.key,
            vertical: def.vertical,
            expected: result.expected,
            latencyMs: result.latencyMs,
            note: def.note,
          },
        });
      } catch (err) {
        console.warn("[canary] logError failed:", (err as Error).message);
      }
    }

    // Varsel kun på overgang (unngå spam).
    const action = transitionAction(prevOk, result.ok);
    if (action !== "none") {
      try {
        await notifyFn(pool, {
          type: "canary_transition",
          source: `Control Center · Canary (${def.vertical})`,
          title:
            action === "alert"
              ? `🔴 Canary NEDE: ${def.label}`
              : `🟢 Canary tilbake: ${def.label}`,
          summary:
            action === "alert"
              ? `${result.message}. ${def.note}`
              : `${def.label} svarer normalt igjen (${result.message}).`,
          link: "/admin?panel=control-center&tab=canary",
          relatedId: def.key,
        });
      } catch (err) {
        console.warn("[canary] notify failed:", (err as Error).message);
      }
    }
  }

  return { ran: results.length, ok: okCount, failed, skipped: 0, results };
}

// ─── Status-aggregat for «Canary»-fanen ─────────────────────────────────────

export type CanaryJourneyStatus = "up" | "down" | "unknown";

export interface CanaryJourneyView {
  key: string;
  label: string;
  vertical: CanaryVertical;
  status: CanaryJourneyStatus;
  httpStatus: number | null;
  latencyMs: number | null;
  expected: string;
  message: string | null;
  note: string;
  uptime30d: number | null;
  p95Ms: number | null;
  sampleCount: number;
  lastFailureAt: string | null;
  lastCheckedAt: string | null;
}

export interface CanaryStatusView {
  journeys: CanaryJourneyView[];
  overall: CanaryJourneyStatus;
  configured: number;
  generatedAt: string;
}

/**
 * Slår sammen konfigurerte sjekker med siste DB-utfall + oppetid30d/p95.
 * En aldri-kjørt sjekk vises som «unknown» (ikke feil).
 */
export async function getCanaryStatus(
  pool: Pool,
  env: NodeJS.ProcessEnv = process.env,
): Promise<CanaryStatusView> {
  const checks = buildCanaryChecks(env);
  const generatedAt = new Date().toISOString();

  let latest = new Map<string, Record<string, unknown>>();
  let agg = new Map<string, { uptime30d: number | null; p95: number | null; samples: number }>();
  let lastFail = new Map<string, string>();

  try {
    const latestRows = await pool.query(
      `SELECT DISTINCT ON (journey_key)
              journey_key, ok, http_status, latency_ms, expected, message, checked_at
         FROM control_center_canary_runs
        ORDER BY journey_key, checked_at DESC`,
    );
    latest = new Map(latestRows.rows.map((r) => [r.journey_key as string, r]));

    const aggRows = await pool.query(
      `SELECT journey_key,
              ROUND(100.0 * SUM(CASE WHEN ok THEN 1 ELSE 0 END) / COUNT(*), 2) AS uptime30d,
              COUNT(*)::int AS samples,
              percentile_disc(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95
         FROM control_center_canary_runs
        WHERE checked_at > now() - interval '30 days'
        GROUP BY journey_key`,
    );
    agg = new Map(
      aggRows.rows.map((r) => [
        r.journey_key as string,
        {
          uptime30d: r.uptime30d != null ? Number(r.uptime30d) : null,
          p95: r.p95 != null ? Number(r.p95) : null,
          samples: Number(r.samples) || 0,
        },
      ]),
    );

    const failRows = await pool.query(
      `SELECT DISTINCT ON (journey_key) journey_key, checked_at
         FROM control_center_canary_runs
        WHERE ok = false
        ORDER BY journey_key, checked_at DESC`,
    );
    lastFail = new Map(
      failRows.rows.map((r) => [r.journey_key as string, new Date(r.checked_at).toISOString()]),
    );
  } catch (err) {
    if (!isMissingTable(err)) {
      console.warn("[canary] status query failed:", (err as Error).message);
    }
    // manglende tabell → alt vises som «unknown»
  }

  const journeys: CanaryJourneyView[] = checks.map((def) => {
    const row = latest.get(def.key);
    const a = agg.get(def.key);
    const status: CanaryJourneyStatus =
      row == null ? "unknown" : row.ok ? "up" : "down";
    return {
      key: def.key,
      label: def.label,
      vertical: def.vertical,
      status,
      httpStatus: row ? ((row.http_status as number) ?? null) : null,
      latencyMs: row ? ((row.latency_ms as number) ?? null) : null,
      expected: def.acceptable.join(","),
      message: row ? ((row.message as string) ?? null) : null,
      note: def.note,
      uptime30d: a?.uptime30d ?? null,
      p95Ms: a?.p95 ?? null,
      sampleCount: a?.samples ?? 0,
      lastFailureAt: lastFail.get(def.key) ?? null,
      lastCheckedAt: row ? new Date(row.checked_at as string).toISOString() : null,
    };
  });

  const overall: CanaryJourneyStatus = journeys.some((j) => j.status === "down")
    ? "down"
    : journeys.every((j) => j.status === "unknown")
      ? "unknown"
      : "up";

  return { journeys, overall, configured: checks.length, generatedAt };
}
