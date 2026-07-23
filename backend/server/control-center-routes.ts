/**
 * control-center-routes.ts
 *
 * CreatorHub Control Center — Fase 1a+1b (byggeplanen):
 * observability-proxy + hendelser med tynn ack/assign-layer.
 *
 * Datakilder aggregeres server-side (aggregator-topologi):
 *   - `error_log`  → backend-native feil (alltid tilgjengelig, ingen ny secret)
 *   - Sentry API   → frontend + backend issues/feilrate (hvis lese-token satt)
 *
 * Alle endepunkter er super_admin-gated (drift-flate, ikke kundevendt).
 * Ingen provider-WRITE her (flags/rollback = Fase 4). "Resolve" på en
 * error_log-hendelse markerer raden løst; på en Sentry-hendelse lagrer vi
 * kun en cockpit-lokal kvittering (vi rører ikke Sentrys egen status).
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";

import {
  getErrorStats,
  listErrors,
  markErrorResolved,
  reopenError,
  type LoggedError,
} from "./error-log-service.js";
import {
  fetchSentryIssues,
  fetchCrashFreeRate,
  isSentryReadConfigured,
  type SentryIssue,
} from "./control-center-sentry-client.js";
import {
  fetchAllDeploys,
  getDeployProviderStatus,
} from "./control-center-deploys-client.js";
import {
  runHealthChecks,
  overallStatus,
  type HealthService,
} from "./control-center-health-client.js";
import { computeAiMargin } from "./ai-margin-service.js";
import {
  computeMonthlyAiOverage,
  readAiOverageAccrual,
  type AiOverageResult,
} from "./ai-overage-service.js";
import { overageMarkup } from "./ai-plan-budgets.js";
import { billAiOverage } from "./ai-overage-billing.js";
import { timingSafeEqual } from "crypto";
import { runCanaries, getCanaryStatus } from "./control-center-canary.js";
import { runSecretWatch, getSecretStatus } from "./control-center-secret-watch.js";
import { runAnomalyScan, getAnomalyView } from "./control-center-anomaly.js";

type SessionData = { userId: string; role?: string; email?: string };

/** Tomt overage-svar (mig 333 ikke kjørt / ingen data) — samme form som tjenesten. */
function emptyOverageResult(month?: string): AiOverageResult {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return {
    periodMonth: month ? `${month}-01` : `${y}-${m}-01`,
    usdToNok: Number(process.env.AI_USD_TO_NOK) || 10.5,
    markup: overageMarkup(),
    orgsProcessed: 0,
    orgsWithOverage: 0,
    totalOverageChargeNok: 0,
    orgsMissingStripeLink: 0,
    rows: [],
    computedAt: new Date().toISOString(),
  };
}

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

// ─── Auth ────────────────────────────────────────────────────────────────

function getSession(req: Request, sessions: Map<string, SessionData>): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return sessions.get(auth.slice(7).trim()) ?? null;
  const t = (req as Request & { cookies?: Record<string, string> }).cookies?.sessionToken;
  return t ? sessions.get(t) ?? null : null;
}

async function requireSuperAdmin(
  req: Request, res: Response,
  pool: Pool, activeSessions: Map<string, SessionData>,
): Promise<SessionData | null> {
  const s = getSession(req, activeSessions);
  if (!s) { res.status(401).json({ error: "Innlogging kreves" }); return null; }
  const u = await pool.query<{ role: string }>(
    `SELECT role FROM users WHERE id = $1`, [s.userId],
  );
  if (u.rows[0]?.role !== "super_admin") {
    res.status(403).json({ error: "Krever super-admin" });
    return null;
  }
  return s;
}

// ─── Ack-layer (control_center_incident_acks) ──────────────────────────────

type IncidentSource = "sentry" | "error_log";

interface IncidentAck {
  incidentId: string;
  source: IncidentSource;
  ackedAt: string | null;
  ackedByUserId: string | null;
  assignedTo: string | null;
  note: string | null;
  resolvedAt: string | null;
  resolvedByUserId: string | null;
}

interface AckRow {
  incident_id: string;
  source: IncidentSource;
  acked_at: string | null;
  acked_by_user_id: string | null;
  assigned_to: string | null;
  note: string | null;
  resolved_at: string | null;
  resolved_by_user_id: string | null;
}

function ackRowToAck(r: AckRow): IncidentAck {
  return {
    incidentId: r.incident_id,
    source: r.source,
    ackedAt: r.acked_at,
    ackedByUserId: r.acked_by_user_id,
    assignedTo: r.assigned_to,
    note: r.note,
    resolvedAt: r.resolved_at,
    resolvedByUserId: r.resolved_by_user_id,
  };
}

/** Parser "sentry:<id>" / "error_log:<uuid>" → {source, nativeId}. */
function parseIncidentId(incidentId: string): { source: IncidentSource; nativeId: string } | null {
  const idx = incidentId.indexOf(":");
  if (idx <= 0) return null;
  const source = incidentId.slice(0, idx);
  const nativeId = incidentId.slice(idx + 1);
  if ((source !== "sentry" && source !== "error_log") || !nativeId) return null;
  return { source, nativeId };
}

async function loadAcks(pool: Pool, incidentIds: string[]): Promise<Map<string, IncidentAck>> {
  const map = new Map<string, IncidentAck>();
  if (incidentIds.length === 0) return map;
  try {
    const r = await pool.query<AckRow>(
      `SELECT incident_id, source, acked_at::text, acked_by_user_id::text,
              assigned_to, note, resolved_at::text, resolved_by_user_id::text
         FROM control_center_incident_acks
        WHERE incident_id = ANY($1::text[])`,
      [incidentIds],
    );
    for (const row of r.rows) map.set(row.incident_id, ackRowToAck(row));
  } catch (err) {
    // Tabellen finnes kanskje ikke enda (migrasjon ikke kjørt) → tom map.
    console.warn("[control-center] loadAcks feilet:", (err as Error).message);
  }
  return map;
}

/** Upsert av ack-raden med kun de feltene som settes. */
async function upsertAck(
  pool: Pool,
  incidentId: string,
  source: IncidentSource,
  patch: Partial<{
    ackedAt: string | null;
    ackedByUserId: string | null;
    assignedTo: string | null;
    note: string | null;
    resolvedAt: string | null;
    resolvedByUserId: string | null;
  }>,
): Promise<IncidentAck> {
  const r = await pool.query<AckRow>(
    `INSERT INTO control_center_incident_acks
       (incident_id, source, acked_at, acked_by_user_id, assigned_to, note,
        resolved_at, resolved_by_user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (incident_id) DO UPDATE SET
       acked_at            = COALESCE($3, control_center_incident_acks.acked_at),
       acked_by_user_id    = COALESCE($4, control_center_incident_acks.acked_by_user_id),
       assigned_to         = COALESCE($5, control_center_incident_acks.assigned_to),
       note                = COALESCE($6, control_center_incident_acks.note),
       resolved_at         = $7,
       resolved_by_user_id = $8,
       updated_at          = now()
     RETURNING incident_id, source, acked_at::text, acked_by_user_id::text,
               assigned_to, note, resolved_at::text, resolved_by_user_id::text`,
    [
      incidentId, source,
      patch.ackedAt ?? null,
      patch.ackedByUserId ?? null,
      patch.assignedTo ?? null,
      patch.note ?? null,
      patch.resolvedAt ?? null,
      patch.resolvedByUserId ?? null,
    ],
  );
  return ackRowToAck(r.rows[0]);
}

// ─── Incident-modell (unified) ─────────────────────────────────────────────

interface Incident {
  incidentId: string;
  source: IncidentSource;
  title: string;
  level: string | null;
  count: number;
  firstSeen: string | null;
  lastSeen: string | null;
  /** Sentry: permalink. error_log: endpoint. */
  reference: string | null;
  ack: IncidentAck | null;
}

function sentryIssueToIncident(i: SentryIssue): Incident {
  return {
    incidentId: `sentry:${i.id}`,
    source: "sentry",
    title: i.title,
    level: i.level,
    count: i.count,
    firstSeen: i.firstSeen,
    lastSeen: i.lastSeen,
    reference: i.permalink,
    ack: null,
  };
}

function loggedErrorToIncident(e: LoggedError): Incident {
  return {
    incidentId: `error_log:${e.id}`,
    source: "error_log",
    title: e.errorName ? `${e.errorName}: ${e.message}` : e.message,
    level: e.level,
    count: e.occurrenceCount,
    firstSeen: e.firstSeenAt,
    lastSeen: e.lastSeenAt,
    reference: e.endpoint,
    ack: null,
  };
}

// ─── Routes ────────────────────────────────────────────────────────────────

/** Cron-token-gate (x-cron-trigger-token + konstant-tid) — delt av cron-endepunktene. */
function verifyCronToken(req: Request): boolean {
  const presented = String(req.headers["x-cron-trigger-token"] || "").trim();
  const expected = (process.env.CRON_TRIGGER_TOKEN || "").trim();
  if (!presented || !expected || presented.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(presented), Buffer.from(expected));
}

export function setupControlCenterRoutes(deps: Deps): void {
  const { app, pool, activeSessions } = deps;

  // ── GET /api/control-center/observability ──────────────────────────
  // Feilrate-kort + Observability-panel. Backend fra error_log (alltid),
  // Sentry-tillegg hvis lese-token er konfigurert.
  app.get("/api/control-center/observability", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;

    const errorLog = await getErrorStats(pool).catch((err) => {
      console.warn("[control-center/observability] getErrorStats:", (err as Error).message);
      return null;
    });

    let sentry: {
      unresolvedIssues: number;
      events24h: number;
      crashFreeSessionsPct: number | null;
      topIssues: SentryIssue[];
    } | null = null;

    if (isSentryReadConfigured()) {
      const [issues, crashFree] = await Promise.all([
        fetchSentryIssues({ query: "is:unresolved", statsPeriod: "24h", limit: 50 }),
        fetchCrashFreeRate("24h"),
      ]);
      sentry = {
        unresolvedIssues: issues.length,
        events24h: issues.reduce((sum, i) => sum + i.count, 0),
        crashFreeSessionsPct: crashFree.crashFreeSessionsPct,
        topIssues: issues.slice(0, 5),
      };
    }

    return res.json({
      sentryConfigured: isSentryReadConfigured(),
      errorLog,
      sentry,
      generatedAt: new Date().toISOString(),
    });
  });

  // ── GET /api/control-center/incidents ──────────────────────────────
  // Aktive hendelser: Sentry unresolved + error_log unresolved, med
  // cockpit-ack-laget joinet på. ?includeResolved=1 tar med lukkede.
  app.get("/api/control-center/incidents", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;

    const includeResolved = req.query.includeResolved === "1";

    const [sentryIssues, backendErrors] = await Promise.all([
      isSentryReadConfigured()
        ? fetchSentryIssues({ query: "is:unresolved", statsPeriod: "24h", limit: 50 })
        : Promise.resolve([] as SentryIssue[]),
      listErrors(pool, { showResolved: false, hoursAgo: 24 * 7, limit: 100 }).catch((err) => {
        console.warn("[control-center/incidents] listErrors:", (err as Error).message);
        return [] as LoggedError[];
      }),
    ]);

    const incidents: Incident[] = [
      ...sentryIssues.map(sentryIssueToIncident),
      ...backendErrors.map(loggedErrorToIncident),
    ];

    // Join ack-laget.
    const acks = await loadAcks(pool, incidents.map((i) => i.incidentId));
    for (const inc of incidents) inc.ack = acks.get(inc.incidentId) ?? null;

    const filtered = includeResolved
      ? incidents
      : incidents.filter((i) => !i.ack?.resolvedAt);

    filtered.sort((a, b) => {
      const ta = a.lastSeen ? Date.parse(a.lastSeen) : 0;
      const tb = b.lastSeen ? Date.parse(b.lastSeen) : 0;
      return tb - ta;
    });

    return res.json({
      sentryConfigured: isSentryReadConfigured(),
      incidents: filtered,
      generatedAt: new Date().toISOString(),
    });
  });

  // ── POST /api/control-center/incidents/:incidentId/ack ─────────────
  app.post("/api/control-center/incidents/:incidentId/ack", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    const parsed = parseIncidentId(req.params.incidentId);
    if (!parsed) return res.status(400).json({ error: "Ugyldig incident-ID" });
    try {
      const ack = await upsertAck(pool, req.params.incidentId, parsed.source, {
        ackedAt: new Date().toISOString(),
        ackedByUserId: s.userId,
        resolvedAt: null,
        resolvedByUserId: null,
      });
      return res.json({ success: true, data: ack });
    } catch (err) {
      console.error("[control-center] ack feilet:", err);
      return res.status(500).json({ error: "Kunne ikke kvittere hendelse" });
    }
  });

  // ── POST /api/control-center/incidents/:incidentId/assign ──────────
  app.post("/api/control-center/incidents/:incidentId/assign", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    const parsed = parseIncidentId(req.params.incidentId);
    if (!parsed) return res.status(400).json({ error: "Ugyldig incident-ID" });
    const assignedTo = typeof req.body?.assignedTo === "string" ? req.body.assignedTo.trim() : "";
    if (!assignedTo) return res.status(400).json({ error: "assignedTo kreves" });
    try {
      const ack = await upsertAck(pool, req.params.incidentId, parsed.source, {
        assignedTo,
        resolvedAt: null,
        resolvedByUserId: null,
      });
      return res.json({ success: true, data: ack });
    } catch (err) {
      console.error("[control-center] assign feilet:", err);
      return res.status(500).json({ error: "Kunne ikke tildele hendelse" });
    }
  });

  // ── POST /api/control-center/incidents/:incidentId/resolve ─────────
  // Cockpit-lokal lukking. For error_log-hendelser markeres også raden løst.
  app.post("/api/control-center/incidents/:incidentId/resolve", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    const parsed = parseIncidentId(req.params.incidentId);
    if (!parsed) return res.status(400).json({ error: "Ugyldig incident-ID" });
    const note = typeof req.body?.note === "string" ? req.body.note.trim() || null : null;
    try {
      if (parsed.source === "error_log") {
        await markErrorResolved(pool, {
          errorId: parsed.nativeId,
          resolvedByUserId: s.userId,
          note: note ?? undefined,
        });
      }
      const ack = await upsertAck(pool, req.params.incidentId, parsed.source, {
        ackedAt: new Date().toISOString(),
        ackedByUserId: s.userId,
        note,
        resolvedAt: new Date().toISOString(),
        resolvedByUserId: s.userId,
      });
      return res.json({ success: true, data: ack });
    } catch (err) {
      console.error("[control-center] resolve feilet:", err);
      return res.status(500).json({ error: "Kunne ikke lukke hendelse" });
    }
  });

  // ── POST /api/control-center/incidents/:incidentId/reopen ──────────
  app.post("/api/control-center/incidents/:incidentId/reopen", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    const parsed = parseIncidentId(req.params.incidentId);
    if (!parsed) return res.status(400).json({ error: "Ugyldig incident-ID" });
    try {
      if (parsed.source === "error_log") {
        await reopenError(pool, parsed.nativeId);
      }
      const ack = await upsertAck(pool, req.params.incidentId, parsed.source, {
        resolvedAt: null,
        resolvedByUserId: null,
      });
      return res.json({ success: true, data: ack });
    } catch (err) {
      console.error("[control-center] reopen feilet:", err);
      return res.status(500).json({ error: "Kunne ikke gjenåpne hendelse" });
    }
  });

  // ── GET /api/control-center/deploys ────────────────────────────────
  // Fase 2: deploy-innsikt. Read-only aggregat av Render + GitHub Actions
  // + Vercel siste deploys. Hver provider uavhengig gated (mangler token →
  // tom liste, ingen 500). Ingen provider-WRITE (trigge/rollback = Fase 4).
  app.get("/api/control-center/deploys", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    const limit = Number(req.query.limit);
    try {
      const result = await fetchAllDeploys(
        Number.isFinite(limit) && limit > 0 ? Math.min(limit, 50) : 15,
      );
      return res.json({
        ...result,
        anyConfigured: result.providers.render || result.providers.github || result.providers.vercel,
        generatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn("[control-center/deploys] failed:", (err as Error).message);
      return res.json({
        providers: getDeployProviderStatus(),
        deploys: [],
        anyConfigured: false,
        generatedAt: new Date().toISOString(),
      });
    }
  });

  // ── GET /api/control-center/health ─────────────────────────────────
  // Fase 3: health-pings. Kjører aktive prober mot indre tjenester (KUN
  // LESE/PROBE), lagrer hvert sample, og regner oppetid (30d) + p95-svartid
  // fra FAKTISKE registrerte samples. Én treg/nede tjeneste feller aldri de
  // andre. Ingen mutasjon av tjeneste-tilstand.
  app.get("/api/control-center/health", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    try {
      const checks = await runHealthChecks(pool);

      // Persister samples (best-effort — skal ikke felle svaret).
      try {
        const values: string[] = [];
        const params: unknown[] = [];
        checks.forEach((c, i) => {
          const b = i * 4;
          values.push(`($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4})`);
          params.push(c.service, c.status, c.latencyMs, c.detail);
        });
        await pool.query(
          `INSERT INTO control_center_health_checks (service, status, latency_ms, detail)
           VALUES ${values.join(", ")}`,
          params,
        );
      } catch (persistErr) {
        console.warn("[control-center/health] persist feilet:", (persistErr as Error).message);
      }

      // Oppetid (andel ikke-nede) + p95 fra samples siste 30 dager, pr. tjeneste.
      const stats = new Map<HealthService, { uptime30d: number | null; p95Ms: number | null; sampleCount: number }>();
      try {
        const agg = await pool.query<{
          service: HealthService;
          samples: string;
          up_like: string;
          p95: string | null;
        }>(
          `SELECT service,
                  COUNT(*)::bigint AS samples,
                  COUNT(*) FILTER (WHERE status IN ('up','degraded'))::bigint AS up_like,
                  percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms)
                    FILTER (WHERE latency_ms IS NOT NULL AND status IN ('up','degraded')) AS p95
           FROM control_center_health_checks
           WHERE checked_at >= now() - interval '30 days'
             AND status IN ('up','degraded','down')
           GROUP BY service`,
        );
        for (const r of agg.rows) {
          const samples = Number(r.samples);
          const upLike = Number(r.up_like);
          stats.set(r.service, {
            uptime30d: samples > 0 ? Math.round((upLike / samples) * 1000) / 10 : null,
            p95Ms: r.p95 != null ? Math.round(Number(r.p95)) : null,
            sampleCount: samples,
          });
        }
      } catch (aggErr) {
        console.warn("[control-center/health] aggregat feilet:", (aggErr as Error).message);
      }

      const services = checks.map((c) => {
        const st = stats.get(c.service);
        return {
          ...c,
          uptime30d: st?.uptime30d ?? null,
          p95Ms: st?.p95Ms ?? null,
          sampleCount: st?.sampleCount ?? 0,
        };
      });

      return res.json({
        services,
        overall: overallStatus(checks),
        generatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn("[control-center/health] failed:", (err as Error).message);
      return res.json({ services: [], overall: "unknown", generatedAt: new Date().toISOString() });
    }
  });

  // ── GET /api/control-center/ai-margin ──────────────────────────────
  // Fase A av «soft-cap + overage»: READ-ONLY synlighet i faktisk AI-kost
  // per org (fra ai_usage_log.cost_usd), så vi ser hvem som spiser marginen
  // FØR vi bygger enforcement + Stripe metered-overage. Ingen mutasjon.
  app.get("/api/control-center/ai-margin", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    const windowDays = Number(req.query.windowDays);
    const limit = Number(req.query.limit);
    try {
      const report = await computeAiMargin(pool, {
        windowDays: Number.isFinite(windowDays) ? windowDays : undefined,
        limit: Number.isFinite(limit) ? limit : undefined,
      });
      return res.json(report);
    } catch (err) {
      // ai_usage_log finnes ikke enda / annen feil → tomt, ikke 500.
      console.warn("[control-center/ai-margin] failed:", (err as Error).message);
      return res.json({
        summary: {
          windowDays: Number.isFinite(windowDays) ? windowDays : 30,
          usdToNok: Number(process.env.AI_USD_TO_NOK) || 10.5,
          alertThresholdNok: Number(process.env.AI_MARGIN_ALERT_NOK) || 500,
          totalCostUsd: 0, totalCostNok: 0, totalCalls: 0,
          distinctOrgs: 0, orgsAtRisk: 0, unattributedCostNok: 0,
          generatedAt: new Date().toISOString(),
        },
        topConsumers: [],
      });
    }
  });

  // ── GET /api/control-center/ai-overage ─────────────────────────────
  // Fase B: LES akkumulerte overage-rader for en måned (default inneværende).
  // READ-ONLY — beregner ikke på nytt, skriver ikke til Stripe. `?month=YYYY-MM`.
  app.get("/api/control-center/ai-overage", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    const month = typeof req.query.month === "string" ? req.query.month : undefined;
    try {
      const report = await readAiOverageAccrual(pool, { month });
      return res.json(report);
    } catch (err) {
      // ai_overage_accrual finnes ikke enda (mig 333 ikke kjørt) → tomt, ikke 500.
      console.warn("[control-center/ai-overage] read failed:", (err as Error).message);
      return res.json(emptyOverageResult(month));
    }
  });

  // ── POST /api/control-center/ai-overage/compute ────────────────────
  // Fase B: (re)beregn og UPSERT akkumulering for en måned. Aggregerer
  // ai_usage_log per org, løser plan/Stripe-kunde, fyller ai_overage_accrual.
  // BELASTER IKKE Stripe og blokkerer ingen kall — kun regnskap. `{month?}`.
  app.post("/api/control-center/ai-overage/compute", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    const month =
      typeof req.body?.month === "string" ? req.body.month : undefined;
    try {
      const report = await computeMonthlyAiOverage(pool, { month });
      return res.json(report);
    } catch (err) {
      console.warn("[control-center/ai-overage/compute] failed:", (err as Error).message);
      return res.status(500).json({ error: "compute_failed", message: (err as Error).message });
    }
  });

  // ── POST /api/control-center/ai-overage/bill ───────────────────────
  // Fase C: DEN ENESTE ruten som flytter penger. Rapporterer ufakturerte
  // ai_overage_accrual-rader som Stripe metered-events + setter billed_at.
  // Dobbel sikkerhet: ekte fakturering krever BÅDE env AI_OVERAGE_BILLING_ENABLED
  // ="true" OG body {dryRun:false}. Ellers = dry-run (viser hva som VILLE blitt
  // fakturert, ingen Stripe-kall, ingen billed_at). `{month?, dryRun?}`.
  app.post("/api/control-center/ai-overage/bill", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    const month = typeof req.body?.month === "string" ? req.body.month : undefined;
    // Default TRYGT: dry-run med mindre kaller EKSPLISITT sender dryRun:false.
    const dryRun = req.body?.dryRun !== false;
    try {
      const result = await billAiOverage(pool, { month, dryRun });
      return res.json(result);
    } catch (err) {
      console.warn("[control-center/ai-overage/bill] failed:", (err as Error).message);
      return res.status(500).json({ error: "bill_failed", message: (err as Error).message });
    }
  });

  // ── GET /api/control-center/logs ───────────────────────────────────
  // Logg-panel (backend-kilden). Frontend-logg leses direkte fra Sentry i
  // cockpiten; her eksponerer vi error_log med enkle filtre.
  app.get("/api/control-center/logs", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    const hoursAgo = Number(req.query.hoursAgo);
    const limit = Number(req.query.limit);
    try {
      const errors = await listErrors(pool, {
        showResolved: req.query.showResolved === "1",
        source: typeof req.query.source === "string" ? (req.query.source as never) : undefined,
        endpoint: typeof req.query.endpoint === "string" ? req.query.endpoint : undefined,
        hoursAgo: Number.isFinite(hoursAgo) && hoursAgo > 0 ? hoursAgo : 24,
        limit: Number.isFinite(limit) && limit > 0 ? Math.min(limit, 500) : 200,
      });
      return res.json({ success: true, data: errors });
    } catch (err) {
      console.warn("[control-center/logs] failed:", (err as Error).message);
      return res.json({ success: true, data: [] });
    }
  });

  // ── Canary: syntetiske journeys (proaktiv drift) ──────────────────────────
  // GET er super_admin-gated (cockpit-visning). POST /run er cron-token-gated
  // (kalles av GitHub Actions hvert 10. min), IKKE super_admin — samme mønster
  // som de øvrige cron-endepunktene (x-cron-trigger-token + timingSafeEqual).
  app.get("/api/control-center/canary", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    try {
      const status = await getCanaryStatus(pool);
      return res.json(status);
    } catch (err) {
      console.warn("[control-center/canary] failed:", (err as Error).message);
      return res.json({ journeys: [], overall: "unknown", configured: 0, generatedAt: new Date().toISOString() });
    }
  });

  app.post("/api/control-center/canary/run", async (req, res) => {
    if (!verifyCronToken(req)) return res.status(401).json({ error: "unauthorized" });
    try {
      const summary = await runCanaries(pool);
      return res.json({ ok: true, ...summary });
    } catch (err) {
      console.error("[control-center/canary/run] failed:", (err as Error).message);
      return res.status(500).json({ ok: false, error: "canary_run_failed" });
    }
  });

  // ── Secret-/utløpsvakt: proaktiv nøkkel-overvåkning ───────────────────────
  app.get("/api/control-center/secrets", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    try {
      const status = await getSecretStatus(pool);
      return res.json(status);
    } catch (err) {
      console.warn("[control-center/secrets] failed:", (err as Error).message);
      return res.json({ secrets: [], configured: 0, worst: "ok", generatedAt: new Date().toISOString() });
    }
  });

  app.post("/api/control-center/secret-watch/run", async (req, res) => {
    if (!verifyCronToken(req)) return res.status(401).json({ error: "unauthorized" });
    try {
      const summary = await runSecretWatch(pool);
      return res.json({ ok: true, ...summary });
    } catch (err) {
      console.error("[control-center/secret-watch/run] failed:", (err as Error).message);
      return res.status(500).json({ ok: false, error: "secret_watch_failed" });
    }
  });

  // ── Anomali-deteksjon: rate-spike + nye feiltyper i error_log ─────────────
  app.get("/api/control-center/anomalies", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    try {
      const view = await getAnomalyView(pool);
      return res.json(view);
    } catch (err) {
      console.warn("[control-center/anomalies] failed:", (err as Error).message);
      return res.json({ spike: false, latestDelta: null, baseline: null, activeFingerprints: null, unresolvedTotal: null, newErrors: [], lastScanAt: null, generatedAt: new Date().toISOString() });
    }
  });

  app.post("/api/control-center/anomaly/run", async (req, res) => {
    if (!verifyCronToken(req)) return res.status(401).json({ error: "unauthorized" });
    try {
      const summary = await runAnomalyScan(pool);
      return res.json({ ok: true, ...summary });
    } catch (err) {
      console.error("[control-center/anomaly/run] failed:", (err as Error).message);
      return res.status(500).json({ ok: false, error: "anomaly_scan_failed" });
    }
  });
}
