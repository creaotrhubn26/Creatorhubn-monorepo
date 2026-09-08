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
 *     (200), (b) AUTH-GUARD-integritet direkte mot appens loopback: uauth-request
 *     skal gi 401 — 500 = ødelagt rute, 200 = auth-bypass, 404 = rute borte.
 *     (c) Role Room-fronten måles separat fra GitHub-runneren, slik at en
 *     Netlify-/DNS-feil ikke feilrapporteres som to auth-feil. (d) Stripe
 *     live-nøkkel gyldig (fanger «Expired API Key»).
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
  attempts: number;
  failureKind: CanaryFailureKind | null;
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
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_TRANSPORT_RETRIES = 1;
const DEFAULT_RETRY_DELAY_MS = 200;
const MAX_EXTERNAL_LATENCY_MS = 120_000;
const DEFAULT_STALE_AFTER_MS = 30 * 60_000;
const CANARY_ADVISORY_LOCK_ID = 2_024_091_007;

export type CanaryFailureKind =
  | "timeout"
  | "network"
  | "auth_bypass"
  | "route_missing"
  | "server_error"
  | "unexpected_status";

export interface ExternalFrontdoorProbe {
  httpStatus: number | null;
  latencyMs: number;
  error?: "timeout" | "network";
  attempts?: number;
}

export interface ExecuteCheckOptions {
  timeoutMs?: number;
  transportRetries?: number;
  retryDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

/** En canary-probe-UUID som garantert ikke finnes → tvinger auth-guarden. */
const PROBE_ID = "00000000-0000-0000-0000-0000000ca0a1";

/**
 * Bygger sjekkene som kjøres inne i backend-prosessen. Offentlige backend-
 * sjekker bruker CANARY_BACKEND_URL. Auth-guardene bruker loopback for å teste
 * Express/auth-koden uten Render/Netlify-hairpin; CANARY_INTERNAL_BACKEND_URL
 * kan overstyre loopback i staging/test. Stripe hoppes over uten live-nøkkel.
 */
export function buildCanaryChecks(
  env: NodeJS.ProcessEnv = process.env,
): CanaryCheckDef[] {
  const backend = (env.CANARY_BACKEND_URL || DEFAULT_BACKEND).replace(
    /\/+$/,
    "",
  );
  const internalBackend = (
    env.CANARY_INTERNAL_BACKEND_URL || `http://127.0.0.1:${env.PORT || "3003"}`
  ).replace(/\/+$/, "");

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
      key: "roleroom-direct-my-tabs-guard",
      label: "Role Room · my-tabs auth-guard (direkte)",
      vertical: "roleroom",
      url: `${internalBackend}/api/role-room/projects/${PROBE_ID}/my-tabs`,
      acceptable: [401],
      note: "Direkte app-sjekk: uautorisert kall skal gi 401 (200=bypass, 404=borte, 500=ødelagt).",
    },
    {
      key: "roleroom-direct-manuscripts-guard",
      label: "Role Room · casting manuscripts auth-guard (direkte)",
      vertical: "roleroom",
      url: `${internalBackend}/api/casting/manuscripts?projectId=${PROBE_ID}`,
      acceptable: [401],
      note: "Direkte app-sjekk: uautorisert kall skal gi 401 uten avhengighet til offentlig proxy.",
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

/** Én ekstern front-door-journey; observasjonen produseres av GitHub Actions. */
export function buildExternalCanaryChecks(
  env: NodeJS.ProcessEnv = process.env,
): CanaryCheckDef[] {
  const roleroom = (env.CANARY_ROLEROOM_URL || DEFAULT_ROLEROOM).replace(
    /\/+$/,
    "",
  );
  return [
    {
      key: "roleroom-frontdoor-auth-guard",
      label: "Role Room · offentlig auth/API-front",
      vertical: "roleroom",
      url: `${roleroom}/api/role-room/projects/${PROBE_ID}/my-tabs`,
      acceptable: [401],
      note: "Ekstern GitHub-probe av DNS/TLS/Netlify-proxy og offentlig auth-integritet.",
    },
  ];
}

export function buildAllCanaryChecks(
  env: NodeJS.ProcessEnv = process.env,
): CanaryCheckDef[] {
  return [...buildCanaryChecks(env), ...buildExternalCanaryChecks(env)];
}

/** Ren klassifisering: er observert status i akseptabelt sett? */
export function classifyOk(acceptable: number[], status: number | null): boolean {
  return status != null && acceptable.includes(status);
}

export type TransitionAction = "alert" | "recover" | "none";
export type CanaryOutcome = Pick<CanaryResult, "ok" | "httpStatus">;

/**
 * Sikkerhets-/kontraktsfeil (for eksempel auth-bypass og 404) bekreftes straks.
 * Transportfeil og typisk midlertidige HTTP-feil må observeres to ganger på rad.
 */
export function isConfirmedDown(outcomesNewestFirst: CanaryOutcome[]): boolean {
  const latest = outcomesNewestFirst[0];
  if (!latest || latest.ok) return false;
  const transientStatus =
    latest.httpStatus == null ||
    latest.httpStatus === 408 ||
    latest.httpStatus === 425 ||
    latest.httpStatus === 429 ||
    latest.httpStatus >= 500;
  if (!transientStatus) return true;
  const previous = outcomesNewestFirst[1];
  return Boolean(previous && !previous.ok);
}

export function transitionAction(
  previousNewestFirst: CanaryOutcome[],
  current: CanaryOutcome,
): TransitionAction {
  const wasDown = isConfirmedDown(previousNewestFirst);
  const isDown = isConfirmedDown([current, ...previousNewestFirst].slice(0, 2));
  if (!wasDown && isDown) return "alert";
  if (wasDown && current.ok) return "recover";
  return "none";
}

function failureKindForStatus(
  acceptable: number[],
  status: number,
): CanaryFailureKind {
  const expectsAuthGuard =
    acceptable.includes(401) &&
    !acceptable.some((candidate) => candidate >= 200 && candidate < 300);
  if (status >= 200 && status < 300 && expectsAuthGuard) {
    return "auth_bypass";
  }
  if (status === 404) return "route_missing";
  if (status >= 500) return "server_error";
  return "unexpected_status";
}

/** Validerer kun rå observasjon; URL, forventning og `ok` bestemmes server-side. */
export function parseExternalFrontdoorProbe(
  value: unknown,
): ExternalFrontdoorProbe | undefined {
  if (value === undefined) return undefined;
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("frontdoorProbe må være et objekt");
  }
  const raw = value as Record<string, unknown>;
  const status = raw.httpStatus;
  const latency = raw.latencyMs;
  const error = raw.error;
  const attempts = raw.attempts;
  if (
    status !== null &&
    (!Number.isInteger(status) || Number(status) < 100 || Number(status) > 599)
  ) {
    throw new Error("frontdoorProbe.httpStatus må være null eller 100–599");
  }
  if (
    !Number.isInteger(latency) ||
    Number(latency) < 0 ||
    Number(latency) > MAX_EXTERNAL_LATENCY_MS
  ) {
    throw new Error(
      `frontdoorProbe.latencyMs må være 0–${MAX_EXTERNAL_LATENCY_MS}`,
    );
  }
  if (status === null && error !== "timeout" && error !== "network") {
    throw new Error(
      "frontdoorProbe.error må angi timeout eller network uten HTTP-status",
    );
  }
  if (status !== null && error !== undefined) {
    throw new Error("frontdoorProbe.error kan bare brukes uten HTTP-status");
  }
  if (
    attempts !== undefined &&
    (!Number.isInteger(attempts) || Number(attempts) < 1 || Number(attempts) > 2)
  ) {
    throw new Error("frontdoorProbe.attempts må være 1 eller 2");
  }
  return {
    httpStatus: status as number | null,
    latencyMs: latency as number,
    ...(error ? { error: error as "timeout" | "network" } : {}),
    ...(attempts !== undefined ? { attempts: Number(attempts) } : {}),
  };
}

/** Path-delen av en URL (for error_log-endpoint + fingerprint-gruppering). */
function urlPath(u: string): string {
  try {
    return new URL(u).pathname;
  } catch {
    return u;
  }
}

/** Kjører én sjekk. Kun transportfeil retries; observerte HTTP-feil er definitive. */
export async function executeCheck(
  def: CanaryCheckDef,
  fetchImpl: typeof fetch,
  now: () => number = () => Date.now(),
  options: ExecuteCheckOptions = {},
): Promise<CanaryResult> {
  const expected = def.acceptable.join(",");
  const started = now();
  const timeoutMs = Math.max(
    1,
    Math.round(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  );
  const retries = Math.max(
    0,
    Math.min(
      3,
      Math.round(options.transportRetries ?? DEFAULT_TRANSPORT_RETRIES),
    ),
  );
  const retryDelayMs = Math.max(
    0,
    Math.round(options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS),
  );
  const sleep =
    options.sleep ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const maxAttempts = retries + 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(def.url, {
        method: "GET",
        headers: def.headers,
        signal: controller.signal,
        // `follow` (ikke `manual`): godartede redirects skal ikke bli falsk feil.
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
        attempts: attempt,
        failureKind: ok
          ? null
          : failureKindForStatus(def.acceptable, res.status),
      };
    } catch (err) {
      const isAbort = (err as Error)?.name === "AbortError";
      if (attempt < maxAttempts) {
        if (retryDelayMs > 0) await sleep(retryDelayMs);
        continue;
      }
      return {
        key: def.key,
        label: def.label,
        vertical: def.vertical,
        ok: false,
        httpStatus: null,
        latencyMs: Math.max(0, Math.round(now() - started)),
        expected,
        message: isAbort
          ? `Timeout etter ${timeoutMs} ms (${attempt} forsøk)`
          : `Nettverksfeil etter ${attempt} forsøk: ${(err as Error)?.message ?? "ukjent"}`,
        note: def.note,
        attempts: attempt,
        failureKind: isAbort ? "timeout" : "network",
      };
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error("canary_unreachable");
}

function resultFromExternalProbe(
  def: CanaryCheckDef,
  probe: ExternalFrontdoorProbe,
): CanaryResult {
  const ok = classifyOk(def.acceptable, probe.httpStatus);
  const expected = def.acceptable.join(",");
  return {
    key: def.key,
    label: def.label,
    vertical: def.vertical,
    ok,
    httpStatus: probe.httpStatus,
    latencyMs: probe.latencyMs,
    expected,
    message: ok
      ? `OK ${probe.httpStatus}`
      : probe.httpStatus != null
        ? `Forventet ${expected}, fikk ${probe.httpStatus}`
        : probe.error === "timeout"
          ? `Ekstern probe fikk timeout etter ${probe.latencyMs} ms`
          : `Ekstern probe fikk nettverksfeil etter ${probe.latencyMs} ms`,
    note: def.note,
    attempts: probe.attempts ?? 1,
    failureKind:
      probe.httpStatus != null
        ? ok
          ? null
          : failureKindForStatus(def.acceptable, probe.httpStatus)
        : (probe.error ?? "network"),
  };
}

export interface RunCanaryDeps {
  fetchImpl?: typeof fetch;
  now?: () => number;
  logErrorFn?: (pool: Pool, input: LogErrorInput) => Promise<string | null>;
  notifyFn?: (pool: Pool, event: AdminInboundEvent) => Promise<void>;
  /** Overstyr sjekk-listen (test). Default: buildCanaryChecks(process.env). */
  checks?: CanaryCheckDef[];
  executeOptions?: ExecuteCheckOptions;
  frontdoorProbe?: ExternalFrontdoorProbe;
}

export class CanaryRunInProgressError extends Error {
  constructor() {
    super("canary_run_in_progress");
    this.name = "CanaryRunInProgressError";
  }
}

export class CanaryStoreUnavailableError extends Error {
  constructor() {
    super("canary_store_unavailable");
    this.name = "CanaryStoreUnavailableError";
  }
}

type CanaryStore = Pick<Pool, "query">;

interface RecentOutcomeHistory {
  available: boolean;
  outcomes: CanaryOutcome[];
}

/** Er dette en «tabell finnes ikke»-feil (migrasjon ikke kjørt enda)? */
function isMissingTable(err: unknown): boolean {
  return (err as { code?: string })?.code === "42P01";
}

async function recentOutcomesFor(
  store: CanaryStore,
  journeyKey: string,
): Promise<RecentOutcomeHistory> {
  try {
    const r = await store.query(
      `SELECT ok, http_status FROM control_center_canary_runs
        WHERE journey_key = $1 ORDER BY checked_at DESC LIMIT 2`,
      [journeyKey],
    );
    return {
      available: true,
      outcomes: r.rows.map((row) => ({
        ok: Boolean(row.ok),
        httpStatus: row.http_status == null ? null : Number(row.http_status),
      })),
    };
  } catch (err) {
    if (isMissingTable(err)) return { available: false, outcomes: [] };
    throw err;
  }
}

async function recordCanaryResult(
  pool: Pool,
  store: CanaryStore,
  def: CanaryCheckDef,
  result: CanaryResult,
  logErrorFn: (pool: Pool, input: LogErrorInput) => Promise<string | null>,
  notifyFn: (pool: Pool, event: AdminInboundEvent) => Promise<void>,
): Promise<void> {
  const history = await recentOutcomesFor(store, def.key);
  if (!history.available) {
    throw new CanaryStoreUnavailableError();
  }
  const previous = history.outcomes;
  const action = transitionAction(previous, result);
  const confirmedFailure =
    !result.ok && isConfirmedDown([result, ...previous].slice(0, 2));

  // Behold råutfallet for oppetid/diagnostikk, også første ubekreftede timeout.
  let persisted = false;
  try {
    await store.query(
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
    persisted = true;
  } catch (err) {
    if (isMissingTable(err)) {
      throw new CanaryStoreUnavailableError();
    }
    console.warn("[canary] insert failed:", (err as Error).message);
    throw err;
  }

  // Harde kontraktsbrudd logges straks; midlertidige feil først etter to funn.
  if (confirmedFailure) {
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
          attempts: result.attempts,
          failureKind: result.failureKind,
          note: def.note,
        },
      });
    } catch (err) {
      console.warn("[canary] logError failed:", (err as Error).message);
    }
  }

  if (persisted && action !== "none") {
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

/**
 * Kjører interne canary-sjekker og registrerer den valgfrie, eksterne
 * front-door-observasjonen fra GitHub-runneren.
 */
async function runCanariesLocked(
  pool: Pool,
  store: CanaryStore,
  deps: RunCanaryDeps = {},
): Promise<CanarySummary> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const now = deps.now ?? (() => Date.now());
  const logErrorFn = deps.logErrorFn ?? logError;
  const notifyFn = deps.notifyFn ?? notifyAdmins;
  const checks = deps.checks ?? buildCanaryChecks();
  const results: CanaryResult[] = [];

  for (const def of checks) {
    const result = await executeCheck(def, fetchImpl, now, deps.executeOptions);
    results.push(result);
    await recordCanaryResult(pool, store, def, result, logErrorFn, notifyFn);
  }

  let skipped = 0;
  if (deps.frontdoorProbe) {
    const [frontdoorDef] = buildExternalCanaryChecks();
    const result = resultFromExternalProbe(frontdoorDef, deps.frontdoorProbe);
    results.push(result);
    await recordCanaryResult(
      pool,
      store,
      frontdoorDef,
      result,
      logErrorFn,
      notifyFn,
    );
  } else {
    skipped = 1;
  }

  return {
    ran: results.length,
    ok: results.filter((result) => result.ok).length,
    failed: results.filter((result) => !result.ok).length,
    skipped,
    results,
  };
}

/**
 * Serialiserer hele read -> transition -> insert-sekvensen på tvers av
 * backend-replikaer. Dermed kan samtidige cron/manuelle kall ikke miste eller
 * duplisere en tilstandsovergang.
 */
export async function runCanaries(
  pool: Pool,
  deps: RunCanaryDeps = {},
): Promise<CanarySummary> {
  const client = await pool.connect();
  let locked = false;
  let releaseError: Error | undefined;
  try {
    const lockResult = await client.query(
      "SELECT pg_try_advisory_lock($1::bigint) AS locked",
      [CANARY_ADVISORY_LOCK_ID],
    );
    if (!lockResult.rows[0]?.locked) {
      throw new CanaryRunInProgressError();
    }
    locked = true;
    return await runCanariesLocked(pool, client, deps);
  } finally {
    if (locked) {
      try {
        const unlockResult = await client.query(
          "SELECT pg_advisory_unlock($1::bigint) AS unlocked",
          [CANARY_ADVISORY_LOCK_ID],
        );
        if (!unlockResult.rows[0]?.unlocked) {
          releaseError = new Error("pg_advisory_unlock returned false");
          console.warn("[canary] advisory unlock failed:", releaseError.message);
        }
      } catch (err) {
        releaseError =
          err instanceof Error ? err : new Error("canary_advisory_unlock_failed");
        console.warn("[canary] advisory unlock failed:", releaseError.message);
      }
    }
    client.release(releaseError);
  }
}

// ─── Status-aggregat for «Canary»-fanen ─────────────────────────────────────

export type CanaryJourneyStatus = "up" | "down" | "unknown";

export interface CanaryJourneyView {
  key: string;
  label: string;
  vertical: CanaryVertical;
  status: CanaryJourneyStatus;
  pending: boolean;
  stale: boolean;
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

export interface GetCanaryStatusOptions {
  now?: () => number;
  staleAfterMs?: number;
}

/**
 * Slår sammen konfigurerte sjekker med siste DB-utfall + oppetid30d/p95.
 * Aldri-kjørte, ubekreftede og eldre målinger vises som «unknown» (ikke grønt).
 */
export async function getCanaryStatus(
  pool: Pool,
  env: NodeJS.ProcessEnv = process.env,
  options: GetCanaryStatusOptions = {},
): Promise<CanaryStatusView> {
  const checks = buildAllCanaryChecks(env);
  const generatedAtMs = options.now?.() ?? Date.now();
  const generatedAt = new Date(generatedAtMs).toISOString();
  const staleAfterMs = Math.max(
    60_000,
    options.staleAfterMs ?? DEFAULT_STALE_AFTER_MS,
  );

  const recent = new Map<string, Record<string, unknown>[]>();
  let agg = new Map<
    string,
    { uptime30d: number | null; p95: number | null; samples: number }
  >();
  let lastFail = new Map<string, string>();

  try {
    const recentRows = await pool.query(
      `SELECT journey_key, ok, http_status, latency_ms, expected, message, checked_at
         FROM (
           SELECT journey_key, ok, http_status, latency_ms, expected, message, checked_at,
                  ROW_NUMBER() OVER (
                    PARTITION BY journey_key ORDER BY checked_at DESC
                  ) AS row_number
             FROM control_center_canary_runs
         ) ranked
        WHERE row_number <= 2
        ORDER BY journey_key, row_number`,
    );
    for (const row of recentRows.rows) {
      const key = row.journey_key as string;
      const rows = recent.get(key) ?? [];
      rows.push(row);
      recent.set(key, rows);
    }

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
      failRows.rows.map((r) => [
        r.journey_key as string,
        new Date(r.checked_at).toISOString(),
      ]),
    );
  } catch (err) {
    if (!isMissingTable(err)) {
      console.warn("[canary] status query failed:", (err as Error).message);
    }
    // manglende tabell → alt vises som «unknown»
  }

  const journeys: CanaryJourneyView[] = checks.map((def) => {
    const rows = recent.get(def.key) ?? [];
    const row = rows[0];
    const a = agg.get(def.key);
    const checkedAtDate = row ? new Date(row.checked_at as string) : null;
    const checkedAtMs = checkedAtDate?.getTime() ?? Number.NaN;
    const lastCheckedAt = Number.isFinite(checkedAtMs)
      ? checkedAtDate!.toISOString()
      : null;
    const stale =
      Boolean(row) &&
      (!Number.isFinite(checkedAtMs) ||
        generatedAtMs - checkedAtMs > staleAfterMs);
    const recentOutcomes = rows.map((candidate) => ({
      ok: Boolean(candidate.ok),
      httpStatus:
        candidate.http_status == null ? null : Number(candidate.http_status),
    }));
    const confirmedDown = isConfirmedDown(recentOutcomes);
    const pendingFailure =
      Boolean(row) && !row.ok && !confirmedDown && !stale;
    const status: CanaryJourneyStatus =
      row == null || stale || pendingFailure
        ? "unknown"
        : confirmedDown
          ? "down"
          : "up";
    const rawMessage = row ? ((row.message as string) ?? null) : null;
    return {
      key: def.key,
      label: def.label,
      vertical: def.vertical,
      status,
      pending: pendingFailure,
      stale,
      httpStatus: row ? ((row.http_status as number) ?? null) : null,
      latencyMs: row ? ((row.latency_ms as number) ?? null) : null,
      expected: def.acceptable.join(","),
      message: stale
        ? `Ingen fersk måling på over ${Math.round(staleAfterMs / 60_000)} min (sist: ${lastCheckedAt ?? "ukjent"})`
        : pendingFailure
          ? `Ubekreftet midlertidig feil (varsler ved 2 på rad): ${rawMessage ?? "ukjent"}`
          : rawMessage,
      note: def.note,
      uptime30d: a?.uptime30d ?? null,
      p95Ms: a?.p95 ?? null,
      sampleCount: a?.samples ?? 0,
      lastFailureAt: lastFail.get(def.key) ?? null,
      lastCheckedAt,
    };
  });

  const overall: CanaryJourneyStatus = journeys.some((j) => j.status === "down")
    ? "down"
    : journeys.some((j) => j.status === "unknown")
      ? "unknown"
      : "up";

  return { journeys, overall, configured: checks.length, generatedAt };
}
