/**
 * leadgrid-rute-routes.ts
 *
 * Fler-stopp besøksruter (Ruteplanlegger nivå 3, 2026-08-04): salgssjef
 * planlegger en rute på iPad og TILDELER den til en selger — selgeren får
 * push («Ny rute tildelt») og ruta lander rett i Kart-fanens rute-motor.
 *
 * Stoppene denormaliseres inn som JSONB (samme filosofi som anbud-
 * pipelinen): ruta skal overleve at leads endres/slettes etterpå.
 *
 * Lazy schema-selvheling (CREATE TABLE IF NOT EXISTS) — ingen manuell
 * migrasjon, samme mønster som doffin/pipeline-tabellene.
 *
 * Mount: /api/leadgrid/ruter/*
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { randomUUID } from "crypto";
import { resolveOrgIdForUser } from "./leadgrid-org-resolver.js";
import { assertAnyEntitled, LEADGRID_RUTEPLAN_FEATURE_KEYS } from "./leadgrid-entitlement-guard.js";
import { sendAPNs } from "./lead-map-apns-client.js";

let schemaReady = false;
async function ensureSchema(pool: Pool): Promise<void> {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS leadgrid_rute_planer (
      id UUID PRIMARY KEY,
      organization_id TEXT NOT NULL,
      created_by TEXT NOT NULL,
      assigned_user_id TEXT,
      navn TEXT NOT NULL DEFAULT '',
      stopp JSONB NOT NULL,
      status TEXT NOT NULL DEFAULT 'tildelt',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_rute_planer_assigned
      ON leadgrid_rute_planer (assigned_user_id, status, created_at DESC)`);
  schemaReady = true;
}

const GYLDIGE_STATUSER = new Set(["tildelt", "akseptert", "fullfort", "avvist"]);

type RuteStopp = {
  id: string; name: string; address: string;
  lat: number; lon: number; ankerTid?: string | null;
};

/** Valider/normaliser stopp-lista fra klienten (maks 20 stopp). */
function parseStopp(raw: unknown): RuteStopp[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 20) return null;
  const ut: RuteStopp[] = [];
  for (const s of raw) {
    if (typeof s !== "object" || s === null) return null;
    const o = s as Record<string, unknown>;
    const lat = Number(o.lat), lon = Number(o.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    // iPad-klientens JSON-encoder snake_case-er nøkler → godta begge former.
    const anker = o.ankerTid ?? (o as Record<string, unknown>).anker_tid;
    ut.push({
      id: String(o.id ?? randomUUID()),
      name: String(o.name ?? "").slice(0, 200),
      address: String(o.address ?? "").slice(0, 300),
      lat, lon,
      ankerTid: typeof anker === "string" ? anker : null,
    });
  }
  return ut;
}

export function registerLeadgridRuteRoutes(deps: {
  app: Express;
  pool: Pool;
  requireUserSession: (req: Request, res: Response) => { userId: string } | null | Promise<{ userId: string } | null>;
}): void {
  const { app, pool, requireUserSession } = deps;

  /** Opprett rute — evt. tildelt et teammedlem (push + in-app-varsel). */
  app.post("/api/leadgrid/ruter", async (req, res) => {
    try {
      const session = await requireUserSession(req, res);
      if (!session) return;
      if (!(await assertAnyEntitled(pool, session.userId, LEADGRID_RUTEPLAN_FEATURE_KEYS, res))) return;
      await ensureSchema(pool);
      const orgId = await resolveOrgIdForUser(pool, session.userId).catch(() => null);
      if (!orgId) { res.status(400).json({ error: "no_org" }); return; }
      const b = (req.body ?? {}) as Record<string, unknown>;
      const stopp = parseStopp(b.stopp);
      if (!stopp) {
        res.status(400).json({ error: "bad_request", message: "Ugyldig stopp-liste (1–20 stopp med koordinater)." });
        return;
      }
      const assigned = typeof b.assigned_user_id === "string" && b.assigned_user_id
        ? String(b.assigned_user_id) : null;
      // Tildeling kun til medlemmer av samme org.
      if (assigned) {
        const medlem = await pool.query(
          `SELECT 1 FROM organization_members
            WHERE organization_id = $1::uuid AND user_id::text = $2`,
          [orgId, assigned]);
        if (medlem.rowCount === 0) {
          res.status(400).json({ error: "bad_request", message: "Mottakeren er ikke medlem av organisasjonen." });
          return;
        }
      }
      const id = randomUUID();
      const navn = String(b.navn ?? "").slice(0, 120)
        || `Rute ${new Date().toISOString().slice(0, 10)} (${stopp.length} stopp)`;
      await pool.query(
        `INSERT INTO leadgrid_rute_planer
           (id, organization_id, created_by, assigned_user_id, navn, stopp, status)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'tildelt')`,
        [id, orgId, session.userId, assigned, navn, JSON.stringify(stopp)]);

      // Varsle mottakeren (best effort) — ikke ved selv-tildeling.
      if (assigned && assigned !== session.userId) {
        const body = `${navn} — ${stopp.length} stopp`;
        try {
          await pool.query(
            `INSERT INTO notification_events
               (recipient_user_id, organization_id, event_type, title, body,
                triggered_by_user_id, deep_link, meta, email_sent)
             VALUES ($1, $2, 'leadgrid_rute_tildelt', $3, $4, $5, 'leadgrid://kart', $6::jsonb, FALSE)`,
            [assigned, orgId, "Ny rute tildelt", body, session.userId,
             JSON.stringify({ rute_id: id })]);
          const tok = await pool.query<{ token: string }>(
            `SELECT token FROM notification_device_tokens
              WHERE user_id = $1 AND platform = 'apns' AND enabled = TRUE`, [assigned]);
          for (const t of tok.rows) {
            const pr = await sendAPNs(t.token, "Ny rute tildelt", body, {
              customData: { event_type: "leadgrid_rute_tildelt", deep_link: "leadgrid://kart" },
            });
            if (pr.sent) break;
          }
        } catch (notifErr) {
          console.warn("[ruter] tildelings-varsel feilet:", String(notifErr).slice(0, 120));
        }
      }
      res.json({ ok: true, id });
    } catch (e) {
      console.error("[ruter] opprett failed:", e);
      res.status(500).json({ error: "internal_error" });
    }
  });

  /** Min nyeste åpne tildelte rute (Kart-fanen henter ved varsel-tap/åpning). */
  app.get("/api/leadgrid/ruter/min", async (req, res) => {
    try {
      const session = await requireUserSession(req, res);
      if (!session) return;
      if (!(await assertAnyEntitled(pool, session.userId, LEADGRID_RUTEPLAN_FEATURE_KEYS, res))) return;
      await ensureSchema(pool);
      const r = await pool.query(
        `SELECT id, navn, stopp, status, created_by, created_at
           FROM leadgrid_rute_planer
          WHERE assigned_user_id = $1 AND status = 'tildelt'
          ORDER BY created_at DESC LIMIT 1`,
        [session.userId]);
      res.json({ rute: r.rows[0] ?? null });
    } catch (e) {
      console.error("[ruter] min failed:", e);
      res.status(500).json({ error: "internal_error" });
    }
  });

  /** Oppdater status (akseptert ved henting, fullfort/avvist av selgeren). */
  app.post("/api/leadgrid/ruter/:id/status", async (req, res) => {
    try {
      const session = await requireUserSession(req, res);
      if (!session) return;
      if (!(await assertAnyEntitled(pool, session.userId, LEADGRID_RUTEPLAN_FEATURE_KEYS, res))) return;
      await ensureSchema(pool);
      const status = String((req.body ?? {}).status ?? "");
      if (!GYLDIGE_STATUSER.has(status)) {
        res.status(400).json({ error: "bad_request", message: "Ugyldig status." });
        return;
      }
      const r = await pool.query(
        `UPDATE leadgrid_rute_planer SET status = $1, updated_at = now()
          WHERE id = $2 AND (assigned_user_id = $3 OR created_by = $3)`,
        [status, String(req.params.id), session.userId]);
      if (r.rowCount === 0) { res.status(404).json({ error: "not_found" }); return; }
      res.json({ ok: true });
    } catch (e) {
      console.error("[ruter] status failed:", e);
      res.status(500).json({ error: "internal_error" });
    }
  });
}
