/**
 * control-center-health-client.ts
 *
 * CreatorHub Control Center — Fase 3 (byggeplanen): health-pings.
 *
 * Server-side AKTIVE helsesjekker mot de indre tjenestene (API, database,
 * betaling, frontend, opplasting, realtime, workers). Alt normaliseres til én
 * felles `HealthCheck`-form slik at cockpiten kan vise en samlet
 * helse-tavle uavhengig av tjeneste-type.
 *
 * VIKTIG (aggregator-topologi + Fase-avgrensning):
 *   - Alle tokens/secrets holdes server-side (aldri på operatør-maskinen).
 *   - KUN LESE/PROBE. Ingen mutasjoner — probene rører aldri tilstand
 *     (SELECT 1, HEAD, GET balance). Flags/rollback hører til Fase 4.
 *   - Best-effort: mangler konfig for en tjeneste → status "unknown"
 *     (not_configured), ikke feil. Én treg/nede tjeneste feller aldri de
 *     andre — hver probe er isolert med egen timeout.
 *
 * Env (alle valgfrie — se env-validator OPTIONAL):
 *   Frontend : CONTROL_CENTER_FRONTEND_URL  (default https://creatorhubn.com)
 *   Betaling : STRIPE_SECRET_KEY            (gjenbruk — GET /v1/balance, les-only)
 *   Storage  : B2_APPLICATION_KEY_ID + B2_APPLICATION_KEY (b2_authorize_account),
 *              ellers R2_ENDPOINT (nåbarhet), ellers CONTROL_CENTER_UPLOADS_HEALTH_URL
 *   Realtime : CONTROL_CENTER_REALTIME_HEALTH_URL
 *   Workers  : CONTROL_CENTER_WORKERS_HEALTH_URL
 */

import type { Pool } from "pg";

export type HealthService =
  | "api"
  | "database"
  | "payments"
  | "frontend"
  | "uploads"
  | "realtime"
  | "workers";

/** Normalisert helse-status på tvers av tjenester. */
export type HealthStatus =
  | "up"             // svarer normalt
  | "degraded"       // svarer, men tregt / delvis
  | "down"           // svarer ikke / feil
  | "not_configured" // ingen probe konfigurert for denne tjenesten
  | "unknown";       // probe kjørte ikke / uventet

export interface HealthCheck {
  service: HealthService;
  status: HealthStatus;
  /** Målt svartid i ms (null hvis ikke målt). */
  latencyMs: number | null;
  /** Kort menneskelesbar detalj (HTTP-kode, feilmelding, «SELECT 1»). */
  detail: string;
  checkedAt: string;
}

/** Terskler (ms) for degradert-flagging pr. probe-type. */
const DEGRADED_MS = {
  database: 400,
  http: 1500,
} as const;

const PROBE_TIMEOUT_MS = 6000;

// ─── Felles hjelpere ───────────────────────────────────────────────────────

function readEnv(name: string): string | null {
  const v = process.env[name]?.trim();
  return v && v.length > 0 ? v : null;
}

function nowIso(): string {
  return new Date().toISOString();
}

/** HTTP-probe (HEAD → fallback GET) med egen timeout. Returnerer status+latency. */
async function httpProbe(
  url: string,
  label: string,
  headers: Record<string, string> = {},
  method: "HEAD" | "GET" = "HEAD",
): Promise<{ status: HealthStatus; latencyMs: number; detail: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  const started = Date.now();
  try {
    const res = await fetch(url, { method, headers, signal: controller.signal });
    const latencyMs = Date.now() - started;
    if (!res.ok) {
      return { status: "down", latencyMs, detail: `HTTP ${res.status}` };
    }
    const status: HealthStatus = latencyMs > DEGRADED_MS.http ? "degraded" : "up";
    return { status, latencyMs, detail: `HTTP ${res.status} · ${latencyMs} ms` };
  } catch (err) {
    const latencyMs = Date.now() - started;
    const msg = (err as Error).name === "AbortError" ? "timeout" : (err as Error).message;
    console.warn(`[control-center/health] ${label} feilet:`, msg);
    return { status: "down", latencyMs, detail: msg };
  } finally {
    clearTimeout(timer);
  }
}

// ─── Enkelt-prober ───────────────────────────────────────────────────────────

/** API (selv): prosessen svarer per definisjon når dette kjører. */
function probeApi(): HealthCheck {
  const uptimeS = Math.round(process.uptime());
  return {
    service: "api",
    status: "up",
    latencyMs: 0,
    detail: `oppe · uptime ${uptimeS}s`,
    checkedAt: nowIso(),
  };
}

/** Database: SELECT 1 via poolen. Treg → degradert. */
async function probeDatabase(pool: Pool): Promise<HealthCheck> {
  const started = Date.now();
  try {
    await pool.query("SELECT 1");
    const latencyMs = Date.now() - started;
    const status: HealthStatus = latencyMs > DEGRADED_MS.database ? "degraded" : "up";
    return {
      service: "database",
      status,
      latencyMs,
      detail: `SELECT 1 · ${latencyMs} ms`,
      checkedAt: nowIso(),
    };
  } catch (err) {
    return {
      service: "database",
      status: "down",
      latencyMs: Date.now() - started,
      detail: (err as Error).message,
      checkedAt: nowIso(),
    };
  }
}

/** Betaling: Stripe GET /v1/balance (les-only) hvis nøkkel finnes. */
async function probePayments(): Promise<HealthCheck> {
  const key = readEnv("STRIPE_SECRET_KEY");
  if (!key) {
    return {
      service: "payments",
      status: "not_configured",
      latencyMs: null,
      detail: "STRIPE_SECRET_KEY ikke satt",
      checkedAt: nowIso(),
    };
  }
  const probe = await httpProbe(
    "https://api.stripe.com/v1/balance",
    "stripe",
    { Authorization: `Bearer ${key}` },
    "GET",
  );
  return { service: "payments", ...probe, checkedAt: nowIso() };
}

/** Frontend: HEAD mot offentlig URL. */
async function probeFrontend(): Promise<HealthCheck> {
  const url = readEnv("CONTROL_CENTER_FRONTEND_URL") ?? "https://creatorhubn.com";
  const probe = await httpProbe(url, "frontend", {}, "HEAD");
  return { service: "frontend", ...probe, checkedAt: nowIso() };
}

/**
 * Storage/opplasting: verifiserer at media-lageret svarer.
 * Primær = Backblaze B2 (b2_authorize_account = LES-only creds-sjekk, ingen
 * mutasjon). Faller tilbake til Cloudflare R2 endpoint-nåbarhet, så en
 * eksplisitt health-URL. Ingen → not_configured.
 */
async function probeStorage(): Promise<HealthCheck> {
  const b2KeyId = readEnv("B2_APPLICATION_KEY_ID");
  const b2AppKey = readEnv("B2_APPLICATION_KEY");
  if (b2KeyId && b2AppKey) {
    const apiBase = readEnv("B2_API_BASE") ?? "https://api.backblazeb2.com";
    const auth = Buffer.from(`${b2KeyId}:${b2AppKey}`).toString("base64");
    const probe = await httpProbe(
      `${apiBase}/b2api/v3/b2_authorize_account`,
      "b2",
      { Authorization: `Basic ${auth}` },
      "GET",
    );
    return {
      service: "uploads",
      ...probe,
      detail: `B2 · ${probe.detail}`,
      checkedAt: nowIso(),
    };
  }

  // R2: signert S3-API krever signering; en enkel nåbarhets-HEAD mot endepunktet
  // beviser i det minste at storage-verten svarer (403/400 = oppe, men avvist).
  const r2Endpoint = readEnv("R2_ENDPOINT");
  if (r2Endpoint) {
    const probe = await httpProbe(r2Endpoint, "r2", {}, "HEAD");
    // 400/403 fra en signert S3-endpoint = verten LEVER (bare uautorisert kall).
    const reachable = probe.status !== "down" || /HTTP (400|401|403)/.test(probe.detail);
    return {
      service: "uploads",
      status: reachable ? "up" : "down",
      latencyMs: probe.latencyMs,
      detail: `R2 · ${probe.detail}`,
      checkedAt: nowIso(),
    };
  }

  return probeOptionalHttp("uploads", "CONTROL_CENTER_UPLOADS_HEALTH_URL");
}

/** Valgfri HTTP-tjeneste: probe hvis health-URL er konfigurert, ellers not_configured. */
async function probeOptionalHttp(
  service: HealthService,
  envName: string,
): Promise<HealthCheck> {
  const url = readEnv(envName);
  if (!url) {
    return {
      service,
      status: "not_configured",
      latencyMs: null,
      detail: `${envName} ikke satt`,
      checkedAt: nowIso(),
    };
  }
  const probe = await httpProbe(url, service, {}, "GET");
  return { service, ...probe, checkedAt: nowIso() };
}

// ─── Aggregator ───────────────────────────────────────────────────────────────

/** Kjør alle prober parallelt og isolert. Én feiler aldri de andre. */
export async function runHealthChecks(pool: Pool): Promise<HealthCheck[]> {
  const results = await Promise.all([
    Promise.resolve(probeApi()),
    probeDatabase(pool),
    probePayments(),
    probeFrontend(),
    probeStorage(),
    probeOptionalHttp("realtime", "CONTROL_CENTER_REALTIME_HEALTH_URL"),
    probeOptionalHttp("workers", "CONTROL_CENTER_WORKERS_HEALTH_URL"),
  ]);
  return results;
}

/** Samlet totalstatus: down > degraded > up (not_configured/unknown ignoreres). */
export function overallStatus(checks: HealthCheck[]): HealthStatus {
  const relevant = checks.filter(
    (c) => c.status === "up" || c.status === "degraded" || c.status === "down",
  );
  if (relevant.length === 0) return "unknown";
  if (relevant.some((c) => c.status === "down")) return "down";
  if (relevant.some((c) => c.status === "degraded")) return "degraded";
  return "up";
}
