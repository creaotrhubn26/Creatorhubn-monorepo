/**
 * leadgrid-equipment-routes.ts
 *
 * Utstyrsregister (2026-07-17) — org-eid utstyr (nettbrett, telefon,
 * laptop, klær, ID-kort …) utlevert til medlemmer.
 *
 * Prefix: /api/leadgrid/equipment*
 *
 * Auth-modell:
 *   • Innlogging kreves; org utledes av medlemskap (aldri fra body).
 *   • Lese hele registeret + administrere (opprett/rediger/tildel/
 *     innlever/kasser): admin|salgssjef|teamleder.
 *   • Alle medlemmer ser SITT utstyr (GET /mine) — «Mitt utstyr» i
 *     Min profil.
 *   • Entitlement: utstyrsregister (feature-matrisen, standard fail-open).
 *   • Ved utlevering varsles mottakeren (in-app + push, samme pipeline
 *     som lead-tildeling); ved innlevering logges hendelsen.
 *
 * Forutsetter mig 0385 (leadgrid_equipment + leadgrid_equipment_events).
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { resolveOrgIdForUser } from "./leadgrid-org-resolver.js";
import { assertAnyEntitled } from "./leadgrid-entitlement-guard.js";
import { sendAPNs } from "./lead-map-apns-client.js";

type SessionUser = {
  userId: string;
  email: string;
  name: string;
  role: string;
};

export interface EquipmentRoutesDeps {
  app: Express;
  pool: Pool;
  requireUserSession: (req: Request, res: Response) => SessionUser | null;
}

const EQUIPMENT_FEATURE_KEYS = ["utstyrsregister"];
const MANAGE_ROLES = new Set(["admin", "salgssjef", "teamleder"]);
const VALID_KINDS = new Set([
  "nettbrett", "telefon", "laptop", "klaer", "id_kort", "annet",
]);
const VALID_STATUS = new Set([
  "tilgjengelig", "utlevert", "tapt", "defekt", "kassert",
]);

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function uuid(): string {
  return (globalThis.crypto as { randomUUID: () => string }).randomUUID();
}

export function registerLeadgridEquipmentRoutes(deps: EquipmentRoutesDeps): void {
  const { app, pool, requireUserSession } = deps;

  async function guard(
    req: Request, res: Response,
  ): Promise<{ session: SessionUser; orgId: string; role: string | null } | null> {
    const session = requireUserSession(req, res);
    if (!session) return null;
    const orgId = await resolveOrgIdForUser(pool, session.userId);
    if (!orgId) {
      res.status(400).json({ error: "ingen_organisasjon" });
      return null;
    }
    const ok = await assertAnyEntitled(pool, session.userId, EQUIPMENT_FEATURE_KEYS, res);
    if (!ok) return null;
    let role: string | null = null;
    try {
      const r = await pool.query<{ role: string }>(
        `SELECT role FROM organization_members
          WHERE organization_id = $1::uuid AND user_id = $2 LIMIT 1`,
        [orgId, session.userId],
      );
      role = r.rows[0]?.role ?? null;
    } catch { /* role forblir null */ }
    return { session, orgId, role };
  }

  async function logEvent(
    equipmentId: string, orgId: string, event: string,
    subjectUserId: string | null, subjectName: string,
    actor: SessionUser, note: string,
  ): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO leadgrid_equipment_events
           (id, equipment_id, organization_id, event, subject_user_id,
            subject_user_name, actor_user_id, actor_name, note)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [uuid(), equipmentId, orgId, event, subjectUserId, subjectName,
         actor.userId, actor.name ?? "", note],
      );
    } catch (e) {
      console.warn("[equipment] event-logg feilet:", (e as Error).message);
    }
  }

  /// In-app + push til mottaker — best effort, velter aldri hovedkallet.
  async function notify(
    recipientUserId: string, orgId: string, actor: SessionUser,
    title: string, body: string,
  ): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO notification_events
           (recipient_user_id, organization_id, event_type, title, body,
            triggered_by_user_id, deep_link, meta, email_sent)
         VALUES ($1, $2, 'equipment_assigned', $3, $4, $5, 'leadgrid://profil/utstyr', '{}'::jsonb, FALSE)`,
        [recipientUserId, orgId, title, body, actor.userId],
      );
    } catch (e) {
      console.warn("[equipment] notif in_app feilet:", (e as Error).message);
    }
    try {
      const tokRes = await pool.query<{ token: string }>(
        `SELECT token FROM notification_device_tokens
          WHERE user_id = $1 AND platform = 'apns' AND enabled = TRUE`,
        [recipientUserId],
      );
      for (const t of tokRes.rows) {
        const r = await sendAPNs(t.token, title, body, {
          customData: { event_type: "equipment_assigned", deep_link: "leadgrid://profil/utstyr" },
        });
        if (r.sent) break;
        if (r.shouldDisableToken) {
          await pool.query(
            `UPDATE notification_device_tokens SET enabled = FALSE
              WHERE token = $1 AND user_id = $2`,
            [t.token, recipientUserId],
          ).catch(() => {});
        }
      }
    } catch (e) {
      console.warn("[equipment] notif apns feilet:", (e as Error).message);
    }
  }

  // ── GET /api/leadgrid/equipment — hele registeret (ledere) ────────
  // «Sist aktiv i Leadgrid» (2026-07-18): utleverte rader berikes med
  // innehaverens siste app-innsjekk (tid + posisjon) fra leadgrid_presence.
  // Serienr → innehaver → posisjon: appen kan ikke lese serienummer
  // (Apple-sperre), men registeret vet hvem som har utstyret.
  app.get("/api/leadgrid/equipment", async (req, res) => {
    const g = await guard(req, res);
    if (!g) return;
    if (g.role == null || !MANAGE_ROLES.has(g.role)) {
      return res.status(403).json({ error: "krever_leder_rolle" });
    }
    try {
      const r = await pool.query(
        `SELECT q.*, p.last_seen_at, p.lat AS last_lat, p.lng AS last_lng,
                p.device_model AS last_device_model
           FROM leadgrid_equipment q
           LEFT JOIN leadgrid_presence p
             ON p.organization_id = q.organization_id
            AND p.user_id = q.assigned_user_id
          WHERE q.organization_id = $1 AND q.status <> 'kassert'
          ORDER BY CASE q.status WHEN 'utlevert' THEN 0 WHEN 'tilgjengelig' THEN 1 ELSE 2 END,
                   q.kind, q.label
          LIMIT 500`,
        [g.orgId],
      );
      return res.json({ equipment: r.rows, canManage: true });
    } catch (err) {
      console.warn("[equipment] list failed:", (err as Error).message);
      return res.status(500).json({ error: "list_failed" });
    }
  });

  // ── POST /api/leadgrid/presence/checkin — appens «sist aktiv»-puls ─
  // Kalles ved app-aktivering (ekte modus). Posisjon er valgfri (kun når
  // brukeren alt har gitt appen posisjonstillatelse). KUN siste punkt
  // lagres (upsert) — ingen historikk.
  app.post("/api/leadgrid/presence/checkin", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const orgId = await resolveOrgIdForUser(pool, session.userId);
    if (!orgId) return res.status(400).json({ error: "ingen_organisasjon" });
    const b = (req.body ?? {}) as Record<string, unknown>;
    const lat = Number(b.lat);
    const lng = Number(b.lng);
    const hasPos = Number.isFinite(lat) && Number.isFinite(lng)
      && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
    try {
      await pool.query(
        `INSERT INTO leadgrid_presence
           (organization_id, user_id, last_seen_at, lat, lng, device_model, app_version)
         VALUES ($1, $2, now(), $3, $4, $5, $6)
         ON CONFLICT (organization_id, user_id)
         DO UPDATE SET last_seen_at = now(),
                       lat = COALESCE(EXCLUDED.lat, leadgrid_presence.lat),
                       lng = COALESCE(EXCLUDED.lng, leadgrid_presence.lng),
                       device_model = EXCLUDED.device_model,
                       app_version = EXCLUDED.app_version`,
        [orgId, session.userId,
         hasPos ? lat : null, hasPos ? lng : null,
         str(b.device_model).slice(0, 60), str(b.app_version).slice(0, 30)],
      );
      return res.json({ ok: true });
    } catch (err) {
      console.warn("[equipment] checkin failed:", (err as Error).message);
      return res.status(500).json({ error: "checkin_failed" });
    }
  });

  // ── GET /api/leadgrid/equipment/mine — «Mitt utstyr» ──────────────
  app.get("/api/leadgrid/equipment/mine", async (req, res) => {
    const g = await guard(req, res);
    if (!g) return;
    try {
      const r = await pool.query(
        `SELECT * FROM leadgrid_equipment
          WHERE organization_id = $1 AND assigned_user_id = $2
            AND status = 'utlevert'
          ORDER BY kind, label`,
        [g.orgId, g.session.userId],
      );
      return res.json({ equipment: r.rows });
    } catch (err) {
      console.warn("[equipment] mine failed:", (err as Error).message);
      return res.status(500).json({ error: "mine_failed" });
    }
  });

  // ── POST /api/leadgrid/equipment — opprett (leder) ────────────────
  app.post("/api/leadgrid/equipment", async (req, res) => {
    const g = await guard(req, res);
    if (!g) return;
    if (g.role == null || !MANAGE_ROLES.has(g.role)) {
      return res.status(403).json({ error: "krever_leder_rolle" });
    }
    const b = (req.body ?? {}) as Record<string, unknown>;
    const kind = str(b.kind);
    const label = str(b.label).trim();
    if (!VALID_KINDS.has(kind)) return res.status(400).json({ error: "ugyldig_kind" });
    if (!label) return res.status(400).json({ error: "mangler_label" });
    try {
      const id = uuid();
      await pool.query(
        `INSERT INTO leadgrid_equipment
           (id, organization_id, kind, label, serial_number, size, note, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [id, g.orgId, kind, label,
         str(b.serial_number).trim() || null,
         str(b.size).trim() || null,
         str(b.note), g.session.userId],
      );
      await logEvent(id, g.orgId, "opprettet", null, "", g.session, label);
      return res.status(201).json({ id });
    } catch (err) {
      console.warn("[equipment] create failed:", (err as Error).message);
      return res.status(500).json({ error: "create_failed" });
    }
  });

  // ── PATCH /api/leadgrid/equipment/:id — rediger/status (leder) ────
  app.patch("/api/leadgrid/equipment/:id", async (req, res) => {
    const g = await guard(req, res);
    if (!g) return;
    if (g.role == null || !MANAGE_ROLES.has(g.role)) {
      return res.status(403).json({ error: "krever_leder_rolle" });
    }
    const b = (req.body ?? {}) as Record<string, unknown>;
    const sets: string[] = [];
    const vals: unknown[] = [];
    const push = (col: string, val: unknown) => {
      vals.push(val);
      sets.push(`${col} = $${vals.length}`);
    };
    if (typeof b.label === "string" && b.label.trim()) push("label", b.label.trim());
    if (typeof b.kind === "string" && VALID_KINDS.has(b.kind)) push("kind", b.kind);
    if (b.serial_number !== undefined) push("serial_number", str(b.serial_number).trim() || null);
    if (b.size !== undefined) push("size", str(b.size).trim() || null);
    if (typeof b.note === "string") push("note", b.note);
    // Status-endring (tapt/defekt/tilgjengelig/kassert) logges som hendelse.
    const newStatus = typeof b.status === "string" && VALID_STATUS.has(b.status)
      ? b.status : null;
    if (newStatus) push("status", newStatus);
    if (sets.length === 0) return res.status(400).json({ error: "ingenting_aa_oppdatere" });
    push("updated_at", new Date());
    vals.push(req.params.id, g.orgId);
    try {
      const r = await pool.query<{ assigned_user_id: string | null; assigned_user_name: string }>(
        `UPDATE leadgrid_equipment SET ${sets.join(", ")}
          WHERE id = $${vals.length - 1}::uuid AND organization_id = $${vals.length}
          RETURNING assigned_user_id, assigned_user_name`,
        vals,
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "ikke_funnet" });
      if (newStatus) {
        await logEvent(req.params.id, g.orgId,
          newStatus === "tilgjengelig" ? "endret" : newStatus,
          r.rows[0].assigned_user_id, r.rows[0].assigned_user_name,
          g.session, str(b.note));
      }
      return res.json({ ok: true });
    } catch (err) {
      console.warn("[equipment] patch failed:", (err as Error).message);
      return res.status(500).json({ error: "patch_failed" });
    }
  });

  // ── POST /:id/assign — utlever til medlem (leder) ─────────────────
  app.post("/api/leadgrid/equipment/:id/assign", async (req, res) => {
    const g = await guard(req, res);
    if (!g) return;
    if (g.role == null || !MANAGE_ROLES.has(g.role)) {
      return res.status(403).json({ error: "krever_leder_rolle" });
    }
    const b = (req.body ?? {}) as Record<string, unknown>;
    const userId = str(b.user_id).trim();
    const userName = str(b.user_name).trim();
    if (!userId) return res.status(400).json({ error: "mangler_user_id" });
    try {
      // Mottaker må være medlem i samme org (IDOR-vakt).
      const member = await pool.query(
        `SELECT 1 FROM organization_members
          WHERE organization_id = $1::uuid AND user_id = $2 LIMIT 1`,
        [g.orgId, userId],
      );
      if (member.rowCount === 0) {
        return res.status(400).json({ error: "ikke_medlem" });
      }
      const r = await pool.query<{ label: string; kind: string }>(
        `UPDATE leadgrid_equipment
            SET status = 'utlevert', assigned_user_id = $1,
                assigned_user_name = $2, assigned_at = now(), updated_at = now()
          WHERE id = $3::uuid AND organization_id = $4
            AND status IN ('tilgjengelig', 'utlevert')
          RETURNING label, kind`,
        [userId, userName, req.params.id, g.orgId],
      );
      if (r.rowCount === 0) {
        return res.status(409).json({ error: "ikke_tilgjengelig" });
      }
      await logEvent(req.params.id, g.orgId, "utlevert", userId, userName,
        g.session, str(b.note));
      if (userId !== g.session.userId) {
        await notify(userId, g.orgId, g.session,
          "Utstyr utlevert",
          `Du har fått utlevert: ${r.rows[0].label}`);
      }
      return res.json({ ok: true });
    } catch (err) {
      console.warn("[equipment] assign failed:", (err as Error).message);
      return res.status(500).json({ error: "assign_failed" });
    }
  });

  // ── POST /:id/return — innlever (leder ELLER innehaveren selv) ────
  app.post("/api/leadgrid/equipment/:id/return", async (req, res) => {
    const g = await guard(req, res);
    if (!g) return;
    const isLeder = g.role != null && MANAGE_ROLES.has(g.role);
    try {
      const cur = await pool.query<{
        assigned_user_id: string | null; assigned_user_name: string; label: string;
      }>(
        `SELECT assigned_user_id, assigned_user_name, label
           FROM leadgrid_equipment
          WHERE id = $1::uuid AND organization_id = $2 AND status = 'utlevert'
          LIMIT 1`,
        [req.params.id, g.orgId],
      );
      const row = cur.rows[0];
      if (!row) return res.status(404).json({ error: "ikke_funnet" });
      if (!isLeder && row.assigned_user_id !== g.session.userId) {
        return res.status(403).json({ error: "kun_innehaver_eller_leder" });
      }
      await pool.query(
        `UPDATE leadgrid_equipment
            SET status = 'tilgjengelig', assigned_user_id = NULL,
                assigned_user_name = '', assigned_at = NULL, updated_at = now()
          WHERE id = $1::uuid AND organization_id = $2`,
        [req.params.id, g.orgId],
      );
      await logEvent(req.params.id, g.orgId, "innlevert",
        row.assigned_user_id, row.assigned_user_name, g.session,
        str((req.body ?? {}).note));
      return res.json({ ok: true });
    } catch (err) {
      console.warn("[equipment] return failed:", (err as Error).message);
      return res.status(500).json({ error: "return_failed" });
    }
  });

  // ── GET /:id/events — hendelseslogg (leder) ───────────────────────
  app.get("/api/leadgrid/equipment/:id/events", async (req, res) => {
    const g = await guard(req, res);
    if (!g) return;
    if (g.role == null || !MANAGE_ROLES.has(g.role)) {
      return res.status(403).json({ error: "krever_leder_rolle" });
    }
    try {
      const r = await pool.query(
        `SELECT e.* FROM leadgrid_equipment_events e
           JOIN leadgrid_equipment q ON q.id = e.equipment_id
          WHERE e.equipment_id = $1::uuid AND q.organization_id = $2
          ORDER BY e.created_at DESC
          LIMIT 100`,
        [req.params.id, g.orgId],
      );
      return res.json({ events: r.rows });
    } catch (err) {
      console.warn("[equipment] events failed:", (err as Error).message);
      return res.status(500).json({ error: "events_failed" });
    }
  });
}
