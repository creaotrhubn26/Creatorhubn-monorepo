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

type SessionData = { userId: string; role?: string; email?: string };

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
}
