/**
 * control-center-secret-watch.ts
 *
 * Secret-/utløpsvakt — PROAKTIV nøkkel-overvåkning i Control Center. En cron
 * (GitHub Actions, daglig) prober gyldigheten (og der API-et avslører det:
 * utløpsdatoen) til de kritiske plattform-nøklene, og varsler super_admin FØR
 * en nøkkel utløper eller blir rotert-vekk. Adresserer inntekts-outage-klassen
 * (utløpt Stripe-nøkkel = 0 kr) direkte.
 *
 * Gjenbruker de SAMME env-varene som deploy-innsikten (ingen nye secrets):
 *   Stripe : STRIPE_SECRET_KEY   → GET /v1/balance (200 ok / 401 rotert-vekk)
 *   Render : RENDER_API_KEY      → GET /v1/services (200 ok / 401 ugyldig)
 *   GitHub : GITHUB_DEPLOY_TOKEN | GITHUB_TOKEN → GET /rate_limit; leser
 *            `github-authentication-token-expiration`-header = EKTE utløpsdato
 *
 * Ærlig-inaktiv: manglende env → status `not_configured` (ikke falsk-feil, ikke
 * varsel). Kun GitHub-PAT gir reell utløpsdato; de andre er gyldighet/liveness
 * (fanger rotasjon/tilbaketrekking). Vi finner ALDRI på utløpsdatoer.
 */

import type { Pool } from "pg";
import { logError, type LogErrorInput } from "./error-log-service.js";
import { notifyAdmins, type AdminInboundEvent } from "./admin-notify.js";

export type SecretStatus =
  | "ok"
  | "expiring"
  | "invalid"
  | "error"
  | "not_configured";

export interface SecretProbeResult {
  key: string;
  label: string;
  status: SecretStatus;
  httpStatus: number | null;
  expiresAt: string | null;
  daysLeft: number | null;
  message: string;
}

const TIMEOUT_MS = 8000;
const DEFAULT_WARN_DAYS = 14;

function warnDays(env: NodeJS.ProcessEnv): number {
  const n = Number.parseInt((env.SECRET_EXPIRY_WARN_DAYS || "").trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_WARN_DAYS;
}

interface SecretProbeDef {
  key: string;
  label: string;
  /** Hvilken env-var som må være satt for at proben er aktiv. */
  configured(env: NodeJS.ProcessEnv): boolean;
  run(
    env: NodeJS.ProcessEnv,
    fetchImpl: typeof fetch,
    warn: number,
    now: () => number,
  ): Promise<Omit<SecretProbeResult, "key" | "label">>;
}

async function timedFetch(
  fetchImpl: typeof fetch,
  url: string,
  headers: Record<string, string>,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetchImpl(url, { method: "GET", headers, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Ren utløps-klassifisering: gjør en gyldig nøkkel «expiring» nær utløp. */
export function classifyExpiry(
  daysLeft: number | null,
  warn: number,
): "ok" | "expiring" {
  return daysLeft != null && daysLeft <= warn ? "expiring" : "ok";
}

function daysUntil(expiresAt: string | null, now: () => number): number | null {
  if (!expiresAt) return null;
  const t = Date.parse(expiresAt);
  if (Number.isNaN(t)) return null;
  return Math.floor((t - now()) / 86_400_000);
}

const PROBES: SecretProbeDef[] = [
  {
    key: "stripe",
    label: "Stripe live-nøkkel",
    configured: (env) => Boolean((env.STRIPE_SECRET_KEY || "").trim()),
    async run(env, fetchImpl) {
      const key = (env.STRIPE_SECRET_KEY || "").trim();
      try {
        const res = await timedFetch(fetchImpl, "https://api.stripe.com/v1/balance", {
          Authorization: `Bearer ${key}`,
        });
        if (res.status === 200) {
          return { status: "ok", httpStatus: 200, expiresAt: null, daysLeft: null, message: "Gyldig (GET /v1/balance 200)" };
        }
        return {
          status: "invalid",
          httpStatus: res.status,
          expiresAt: null,
          daysLeft: null,
          message: `Ugyldig/rotert nøkkel (HTTP ${res.status}) — inntekt stopper`,
        };
      } catch (err) {
        return { status: "error", httpStatus: null, expiresAt: null, daysLeft: null, message: `Probe-feil: ${(err as Error).message}` };
      }
    },
  },
  {
    key: "render",
    label: "Render API-nøkkel",
    configured: (env) => Boolean((env.RENDER_API_KEY || "").trim()),
    async run(env, fetchImpl) {
      const key = (env.RENDER_API_KEY || "").trim();
      try {
        const res = await timedFetch(fetchImpl, "https://api.render.com/v1/services?limit=1", {
          Authorization: `Bearer ${key}`,
          Accept: "application/json",
        });
        if (res.status === 200) {
          return { status: "ok", httpStatus: 200, expiresAt: null, daysLeft: null, message: "Gyldig (GET /v1/services 200)" };
        }
        return { status: "invalid", httpStatus: res.status, expiresAt: null, daysLeft: null, message: `Ugyldig token (HTTP ${res.status})` };
      } catch (err) {
        return { status: "error", httpStatus: null, expiresAt: null, daysLeft: null, message: `Probe-feil: ${(err as Error).message}` };
      }
    },
  },
  {
    key: "github",
    label: "GitHub deploy-PAT",
    configured: (env) => Boolean((env.GITHUB_DEPLOY_TOKEN || env.GITHUB_TOKEN || "").trim()),
    async run(env, fetchImpl, warn, now) {
      const token = (env.GITHUB_DEPLOY_TOKEN || env.GITHUB_TOKEN || "").trim();
      try {
        const res = await timedFetch(fetchImpl, "https://api.github.com/rate_limit", {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "creatorhub-control-center",
        });
        if (res.status !== 200) {
          return { status: "invalid", httpStatus: res.status, expiresAt: null, daysLeft: null, message: `Ugyldig PAT (HTTP ${res.status})` };
        }
        // GitHub avslører EKTE utløp via header for PAT-er med utløp. Parse
        // DEFENSIVT: `Date.parse` returnerer NaN (kaster ikke) på uventet format
        // — aldri `new Date(x).toISOString()` på uvalidert streng (kaster
        // «Invalid time value» → falsk «ugyldig nøkkel»-varsel). `Date.parse`
        // håndterer «GMT» + numeriske offset.
        const header = res.headers.get("github-authentication-token-expiration");
        let expiresAt: string | null = null;
        if (header) {
          const t = Date.parse(header.replace(" UTC", " GMT"));
          if (!Number.isNaN(t)) expiresAt = new Date(t).toISOString();
        }
        const daysLeft = daysUntil(expiresAt, now);
        const status = classifyExpiry(daysLeft, warn);
        return {
          status,
          httpStatus: 200,
          expiresAt,
          daysLeft,
          message:
            expiresAt == null
              ? "Gyldig (uten utløpsdato)"
              : status === "expiring"
                ? `Utløper om ${daysLeft} dager — roter snart`
                : `Gyldig, utløper om ${daysLeft} dager`,
        };
      } catch (err) {
        return { status: "error", httpStatus: null, expiresAt: null, daysLeft: null, message: `Probe-feil: ${(err as Error).message}` };
      }
    },
  },
];

/** Kun `invalid`/`expiring` er varslbare ekte problemer. `error` = probe-blip
 *  (nettverk/timeout) — inkonklusivt, skal IKKE varsle/lage incident (unngår
 *  alarm-spam ved forbigående feil). `not_configured` = env mangler. */
export function isAlertable(status: SecretStatus): boolean {
  return status === "invalid" || status === "expiring";
}

/** Alvorlighet KUN for visning (worst-badge). error rangeres under kjente
 *  problemer, over ok. */
export function severity(status: SecretStatus): number {
  switch (status) {
    case "invalid":
      return 3;
    case "expiring":
      return 2;
    case "error":
      return 1;
    case "ok":
      return 0;
    default:
      return -1; // not_configured
  }
}

// Utløps-bånd (dager): en tettere terskel = ny nudge (14 → 7 → 3 → 1), så et
// nøkkel-utløp ikke varsles ÉN gang og så tystner til den faktisk dør.
const EXPIRY_BANDS = [1, 3, 7, 14];

export function expiryBand(daysLeft: number | null, warn: number): number | null {
  if (daysLeft == null) return null;
  const bands = EXPIRY_BANDS.filter((b) => b <= warn);
  const eff = bands.length ? bands : [warn];
  for (const b of eff) if (daysLeft <= b) return b;
  return daysLeft <= warn ? warn : null;
}

/** Kanonisk «alert-nøkkel» lagret i last_alert_status for transisjons-styring. */
export function alertKeyFor(status: SecretStatus, band: number | null): string {
  if (status === "invalid") return "invalid";
  if (status === "expiring") return `expiring:${band ?? 14}`;
  if (status === "ok") return "ok";
  return "none"; // error/not_configured → nøytral
}

/** Monoton rangering: tettere expiring-bånd + invalid rangeres høyere → tillater
 *  re-nudge når nøkkelen nærmer seg utløp. */
export function alertRank(key: string | null): number {
  if (!key || key === "ok" || key === "none") return 0;
  if (key === "invalid") return 100;
  const m = /^expiring:(\d+)$/.exec(key);
  if (m) return 50 - Number(m[1]); // band 14→36, 7→43, 3→47, 1→49
  return 0;
}

export type SecretTransition = "alert" | "recover" | "none";

/**
 * Varsel-styring. `prevKey` = alert-nøkkelen vi sist varslet på (null = aldri).
 * error/not_configured er inkonklusive → rør ikke alert-tilstanden.
 */
export function secretTransition(
  prevKey: string | null,
  nowStatus: SecretStatus,
  band: number | null,
): { action: SecretTransition; newKey: string | null } {
  if (nowStatus === "error" || nowStatus === "not_configured") {
    return { action: "none", newKey: prevKey };
  }
  const nowKey = alertKeyFor(nowStatus, band);
  const nowRank = alertRank(nowKey);
  const prevRank = alertRank(prevKey);
  if (nowKey !== "ok" && nowRank > prevRank) return { action: "alert", newKey: nowKey };
  if (nowKey === "ok" && prevRank > 0) return { action: "recover", newKey: "ok" };
  return { action: "none", newKey: prevKey };
}

function isMissingTable(err: unknown): boolean {
  return (err as { code?: string })?.code === "42P01";
}

export interface SecretWatchDeps {
  fetchImpl?: typeof fetch;
  now?: () => number;
  logErrorFn?: (pool: Pool, input: LogErrorInput) => Promise<string | null>;
  notifyFn?: (pool: Pool, event: AdminInboundEvent) => Promise<void>;
  probes?: SecretProbeDef[];
  env?: NodeJS.ProcessEnv;
}

export interface SecretWatchSummary {
  ran: number;
  ok: number;
  configured: number;
  problems: number;
  results: SecretProbeResult[];
}

/**
 * Kjører alle secret-prober, upserter status, og varsler super_admin på
 * forverring/gjenoppretting. not_configured hoppes over (ingen varsel/incident).
 */
export async function runSecretWatch(pool: Pool, deps: SecretWatchDeps = {}): Promise<SecretWatchSummary> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const now = deps.now ?? (() => Date.now());
  const logErrorFn = deps.logErrorFn ?? logError;
  const notifyFn = deps.notifyFn ?? notifyAdmins;
  const env = deps.env ?? process.env;
  const probes = deps.probes ?? PROBES;
  const warn = warnDays(env);

  const results: SecretProbeResult[] = [];
  let okCount = 0;
  let configured = 0;
  let problems = 0;

  for (const probe of probes) {
    if (!probe.configured(env)) {
      results.push({ key: probe.key, label: probe.label, status: "not_configured", httpStatus: null, expiresAt: null, daysLeft: null, message: "Ikke konfigurert (env mangler)" });
      // Registrer, men uten varsel.
      await upsertStatus(pool, probe.key, probe.label, { status: "not_configured", httpStatus: null, expiresAt: null, daysLeft: null, message: "Ikke konfigurert (env mangler)" }, null);
      continue;
    }
    configured++;

    const prev = await prevStatusFor(pool, probe.key);
    const r = await probe.run(env, fetchImpl, warn, now);
    const result: SecretProbeResult = { key: probe.key, label: probe.label, ...r };
    results.push(result);
    if (r.status === "ok") okCount++;
    if (isAlertable(r.status)) problems++;

    const band = expiryBand(r.daysLeft, warn);
    const { action, newKey } = secretTransition(prev.lastAlert, r.status, band);

    // Kjent problem (ugyldig/utløper) → idempotent incident. `error` (probe-blip)
    // lager IKKE incident — det er ikke et nøkkel-problem.
    if (isAlertable(r.status)) {
      try {
        await logErrorFn(pool, {
          source: "backend",
          level: r.status === "expiring" ? "warning" : "error",
          endpoint: `secret:${probe.key}`,
          errorName: "SecretWatch",
          message: `Nøkkel «${probe.label}»: ${r.message}`,
          meta: { secretKey: probe.key, status: r.status, expiresAt: r.expiresAt, daysLeft: r.daysLeft },
        });
      } catch (err) {
        console.warn("[secret-watch] logError failed:", (err as Error).message);
      }
    }

    await upsertStatus(pool, probe.key, probe.label, r, newKey);

    if (action !== "none") {
      try {
        await notifyFn(pool, {
          type: "secret_watch",
          source: "Control Center · Nøkkelvakt",
          title:
            action === "alert"
              ? (r.status === "expiring" ? `🟠 Nøkkel utløper snart: ${probe.label}` : `🔴 Nøkkel ugyldig: ${probe.label}`)
              : `🟢 Nøkkel OK igjen: ${probe.label}`,
          summary: r.message,
          link: "/admin?panel=control-center&tab=secrets",
          relatedId: probe.key,
        });
      } catch (err) {
        console.warn("[secret-watch] notify failed:", (err as Error).message);
      }
    }
  }

  return { ran: results.length, ok: okCount, configured, problems, results };
}

async function prevStatusFor(pool: Pool, key: string): Promise<{ lastAlert: string | null }> {
  try {
    const r = await pool.query(`SELECT last_alert_status FROM control_center_secret_status WHERE secret_key = $1`, [key]);
    if (r.rows.length === 0) return { lastAlert: null };
    return { lastAlert: (r.rows[0].last_alert_status as string | null) ?? null };
  } catch (err) {
    if (isMissingTable(err)) return { lastAlert: null };
    throw err;
  }
}

async function upsertStatus(
  pool: Pool,
  key: string,
  label: string,
  r: Omit<SecretProbeResult, "key" | "label">,
  lastAlert: string | null,
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO control_center_secret_status
         (secret_key, label, status, http_status, expires_at, days_left, message, checked_at, last_alert_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7, now(), $8)
       ON CONFLICT (secret_key) DO UPDATE SET
         label = EXCLUDED.label,
         status = EXCLUDED.status,
         http_status = EXCLUDED.http_status,
         expires_at = EXCLUDED.expires_at,
         days_left = EXCLUDED.days_left,
         message = EXCLUDED.message,
         checked_at = now(),
         last_alert_status = EXCLUDED.last_alert_status`,
      [key, label, r.status, r.httpStatus, r.expiresAt, r.daysLeft, r.message, lastAlert],
    );
  } catch (err) {
    if (!isMissingTable(err)) console.warn("[secret-watch] upsert failed:", (err as Error).message);
  }
}

// ─── Status-visning ─────────────────────────────────────────────────────────

export interface SecretStatusView {
  key: string;
  label: string;
  status: SecretStatus;
  httpStatus: number | null;
  expiresAt: string | null;
  daysLeft: number | null;
  message: string | null;
  checkedAt: string | null;
}

export interface SecretsView {
  secrets: SecretStatusView[];
  configured: number;
  worst: SecretStatus;
  generatedAt: string;
}

export async function getSecretStatus(pool: Pool, env: NodeJS.ProcessEnv = process.env): Promise<SecretsView> {
  const generatedAt = new Date().toISOString();
  let rows = new Map<string, Record<string, unknown>>();
  try {
    const q = await pool.query(
      `SELECT secret_key, status, http_status, expires_at, days_left, message, checked_at
         FROM control_center_secret_status`,
    );
    rows = new Map(q.rows.map((r) => [r.secret_key as string, r]));
  } catch (err) {
    if (!isMissingTable(err)) console.warn("[secret-watch] status query failed:", (err as Error).message);
  }

  const secrets: SecretStatusView[] = PROBES.map((p) => {
    const row = rows.get(p.key);
    return {
      key: p.key,
      label: p.label,
      status: row ? (row.status as SecretStatus) : "not_configured",
      httpStatus: row ? ((row.http_status as number) ?? null) : null,
      expiresAt: row && row.expires_at ? new Date(row.expires_at as string).toISOString() : null,
      daysLeft: row ? ((row.days_left as number) ?? null) : null,
      message: row ? ((row.message as string) ?? null) : null,
      checkedAt: row ? new Date(row.checked_at as string).toISOString() : null,
    };
  });

  const worst = secrets.reduce<SecretStatus>((acc, s) => (severity(s.status) > severity(acc) ? s.status : acc), "ok");
  const configured = PROBES.filter((p) => p.configured(env)).length;
  return { secrets, configured, worst, generatedAt };
}
