/**
 * role-room-funding-routes.ts
 *
 * REST-flate for tilskuddssøknader (Del A punkt 114).
 *
 * Tjenestelaget var eksponert via MCP, men en skjerm trenger vanlige
 * endepunkter. Rutene er tynne med vilje — all vurdering ligger i
 * role-room-funding-application-service.ts, slik at MCP og UI svarer likt.
 *
 *   GET    /api/role-room/projects/:projectId/funding/applications
 *   POST   /api/role-room/projects/:projectId/funding/applications
 *   GET    /api/role-room/funding/applications/:applicationId/readiness
 *   PUT    /api/role-room/funding/applications/:applicationId/requirements/:key
 *   GET    /api/role-room/projects/:projectId/funding/financing
 *   POST   /api/role-room/projects/:projectId/funding/financing
 *   PATCH  /api/role-room/funding/financing/:sourceId
 *   DELETE /api/role-room/funding/financing/:sourceId
 *   GET    /api/role-room/projects/:projectId/funding/schemes
 *   GET    /api/role-room/funding/applications/:applicationId/export.csv
 */

import type express from "express";
import type { Pool } from "pg";
import { canAccessRoleRoomProject } from "./role-room-projects-routes.js";
import {
  getApplicationReadiness,
  getFinancingSummary,
  setRequirementStatus,
} from "./role-room-funding-application-service.js";
import { buildFundingExport, toCsv } from "./role-room-funding-export.js";

export interface FundingRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireUserSession: (req: any, res: any) => any;
}

const SOURCE_TYPES = new Set(["public", "private", "own", "other"]);
const ITEM_STATUSES = new Set(["pending", "ready", "not_applicable"]);

export function setupRoleRoomFundingRoutes(deps: FundingRoutesDeps): void {
  const { app, pool, requireUserSession } = deps;

  /**
   * Søknader og finansieringskilder slås opp globalt på id, så tilgangen må
   * verifiseres mot objektets FAKTISKE prosjekt — ikke mot et prosjekt
   * kalleren oppgir.
   */
  async function guardApplication(req: any, res: any): Promise<{ userId: string } | null> {
    const session = requireUserSession(req, res);
    if (!session) return null;
    const r = await pool.query<{ project_id: string }>(
      `SELECT project_id FROM role_room_funding_applications WHERE id = $1 LIMIT 1`,
      [String(req.params.applicationId ?? "")],
    );
    if (r.rowCount === 0) {
      res.status(404).json({ error: "Fant ikke søknaden." });
      return null;
    }
    if (!(await canAccessRoleRoomProject(pool, session.userId, r.rows[0].project_id))) {
      res.status(403).json({ error: "ingen_tilgang" });
      return null;
    }
    return session;
  }

  async function guardProject(req: any, res: any): Promise<{ userId: string } | null> {
    const session = requireUserSession(req, res);
    if (!session) return null;
    const projectId = String(req.params.projectId ?? "");
    if (!(await canAccessRoleRoomProject(pool, session.userId, projectId))) {
      res.status(403).json({ error: "ingen_tilgang" });
      return null;
    }
    return session;
  }

  // ── Ordninger ────────────────────────────────────────────────────────────
  app.get("/api/role-room/projects/:projectId/funding/schemes", async (req, res) => {
    if (!(await guardProject(req, res))) return;
    try {
      const r = await pool.query(
        `SELECT scheme_key, name, organisation, verified, source_url
           FROM role_room_funding_schemes ORDER BY name`,
      );
      res.json({ schemes: r.rows });
    } catch (err) {
      console.error("[funding] schemes feilet:", err);
      res.status(500).json({ error: "Kunne ikke hente ordninger." });
    }
  });

  // ── Søknader ─────────────────────────────────────────────────────────────
  app.get("/api/role-room/projects/:projectId/funding/applications", async (req, res) => {
    if (!(await guardProject(req, res))) return;
    try {
      const r = await pool.query(
        `SELECT a.id, a.label, a.status, a.deadline_at::text AS deadline_at,
                a.amount_applied_for, a.submitted_at, s.scheme_key, s.name AS scheme_name
           FROM role_room_funding_applications a
           JOIN role_room_funding_schemes s ON s.id = a.scheme_id
          WHERE a.project_id = $1
          ORDER BY a.deadline_at NULLS LAST, a.created_at DESC`,
        [String(req.params.projectId)],
      );
      res.json({ applications: r.rows });
    } catch (err) {
      console.error("[funding] applications feilet:", err);
      res.status(500).json({ error: "Kunne ikke hente søknader." });
    }
  });

  app.post("/api/role-room/projects/:projectId/funding/applications", async (req, res) => {
    const session = await guardProject(req, res);
    if (!session) return;
    try {
      const body = req.body && typeof req.body === "object" ? req.body : {};
      const schemeKey = typeof body.schemeKey === "string" ? body.schemeKey.trim() : "";
      const label = typeof body.label === "string" ? body.label.trim() : "";
      if (!schemeKey || !label) {
        return res.status(400).json({ error: "schemeKey og label er påkrevd." });
      }

      const scheme = await pool.query<{ id: string }>(
        `SELECT id FROM role_room_funding_schemes WHERE scheme_key = $1 LIMIT 1`,
        [schemeKey],
      );
      if (scheme.rowCount === 0) return res.status(400).json({ error: "Ukjent ordning." });

      const r = await pool.query<{ id: string }>(
        `INSERT INTO role_room_funding_applications
           (project_id, scheme_id, label, deadline_at, amount_applied_for, created_by_user_id)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [
          String(req.params.projectId), scheme.rows[0].id, label.slice(0, 255),
          body.deadlineAt || null,
          Number.isFinite(Number(body.amountAppliedFor)) ? Number(body.amountAppliedFor) : null,
          session.userId,
        ],
      );
      res.status(201).json({ id: r.rows[0].id });
    } catch (err) {
      console.error("[funding] opprett søknad feilet:", err);
      res.status(500).json({ error: "Kunne ikke opprette søknad." });
    }
  });

  // ── Klarhetsvurdering ────────────────────────────────────────────────────
  app.get("/api/role-room/funding/applications/:applicationId/readiness", async (req, res) => {
    if (!(await guardApplication(req, res))) return;
    try {
      res.json(await getApplicationReadiness(pool, String(req.params.applicationId)));
    } catch (err) {
      console.error("[funding] readiness feilet:", err);
      res.status(500).json({ error: "Kunne ikke vurdere søknaden." });
    }
  });

  app.put("/api/role-room/funding/applications/:applicationId/requirements/:key", async (req, res) => {
    const session = await guardApplication(req, res);
    if (!session) return;
    try {
      const body = req.body && typeof req.body === "object" ? req.body : {};
      const status = String(body.status ?? "");
      if (!ITEM_STATUSES.has(status)) {
        return res.status(400).json({ error: "Ugyldig status." });
      }
      await setRequirementStatus(pool, {
        applicationId: String(req.params.applicationId),
        requirementKey: String(req.params.key),
        status: status as "pending" | "ready" | "not_applicable",
        documentUrl: typeof body.documentUrl === "string" ? body.documentUrl : null,
        note: typeof body.note === "string" ? body.note : null,
        userId: session.userId,
      });
      res.json({ ok: true });
    } catch (err) {
      const message = (err as Error).message;
      // Forsøk på å krysse av et automatisk krav er en forventet tilstand,
      // ikke en systemfeil — svar 400 med forklaringen.
      if (/avgjøres automatisk|Ukjent krav/.test(message)) {
        return res.status(400).json({ error: message });
      }
      console.error("[funding] krav-status feilet:", err);
      res.status(500).json({ error: "Kunne ikke oppdatere kravet." });
    }
  });

  // ── Finansieringsplan ────────────────────────────────────────────────────
  app.get("/api/role-room/projects/:projectId/funding/financing", async (req, res) => {
    if (!(await guardProject(req, res))) return;
    try {
      const summary = await getFinancingSummary(pool, String(req.params.projectId));
      const rows = await pool.query(
        `SELECT id, source_name, source_type, amount, currency, confirmed,
                confirmed_at::text AS confirmed_at, evidence_note, notes
           FROM role_room_financing_sources
          WHERE project_id = $1
          ORDER BY confirmed DESC, amount DESC`,
        [String(req.params.projectId)],
      );
      res.json({ summary, sources: rows.rows });
    } catch (err) {
      console.error("[funding] financing feilet:", err);
      res.status(500).json({ error: "Kunne ikke hente finansieringsplan." });
    }
  });

  app.post("/api/role-room/projects/:projectId/funding/financing", async (req, res) => {
    if (!(await guardProject(req, res))) return;
    try {
      const body = req.body && typeof req.body === "object" ? req.body : {};
      const name = typeof body.sourceName === "string" ? body.sourceName.trim() : "";
      const type = String(body.sourceType ?? "");
      const amount = Number(body.amount);
      if (!name) return res.status(400).json({ error: "sourceName er påkrevd." });
      if (!SOURCE_TYPES.has(type)) return res.status(400).json({ error: "Ugyldig sourceType." });
      if (!Number.isFinite(amount) || amount < 0) {
        return res.status(400).json({ error: "amount må være et tall ≥ 0." });
      }

      const r = await pool.query<{ id: string }>(
        `INSERT INTO role_room_financing_sources
           (project_id, source_name, source_type, amount, confirmed, confirmed_at, evidence_note, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [
          String(req.params.projectId), name.slice(0, 255), type, amount,
          body.confirmed === true, body.confirmedAt || null,
          typeof body.evidenceNote === "string" ? body.evidenceNote : null,
          typeof body.notes === "string" ? body.notes : null,
        ],
      );
      res.status(201).json({ id: r.rows[0].id });
    } catch (err) {
      console.error("[funding] opprett kilde feilet:", err);
      res.status(500).json({ error: "Kunne ikke legge til finansieringskilde." });
    }
  });

  /** Felles vakt for de to rutene som treffer én finansieringskilde. */
  async function guardSource(req: any, res: any): Promise<boolean> {
    const session = requireUserSession(req, res);
    if (!session) return false;
    const r = await pool.query<{ project_id: string }>(
      `SELECT project_id FROM role_room_financing_sources WHERE id = $1 LIMIT 1`,
      [String(req.params.sourceId ?? "")],
    );
    if (r.rowCount === 0) {
      res.status(404).json({ error: "Fant ikke finansieringskilden." });
      return false;
    }
    if (!(await canAccessRoleRoomProject(pool, session.userId, r.rows[0].project_id))) {
      res.status(403).json({ error: "ingen_tilgang" });
      return false;
    }
    return true;
  }

  app.patch("/api/role-room/funding/financing/:sourceId", async (req, res) => {
    if (!(await guardSource(req, res))) return;
    try {
      const body = req.body && typeof req.body === "object" ? req.body : {};
      if (body.sourceType !== undefined && !SOURCE_TYPES.has(String(body.sourceType))) {
        return res.status(400).json({ error: "Ugyldig sourceType." });
      }
      // COALESCE lar klienten sende bare feltene den endrer.
      await pool.query(
        `UPDATE role_room_financing_sources
            SET source_name = COALESCE($2, source_name),
                source_type = COALESCE($3, source_type),
                amount = COALESCE($4, amount),
                confirmed = COALESCE($5, confirmed),
                confirmed_at = COALESCE($6, confirmed_at),
                evidence_note = COALESCE($7, evidence_note),
                updated_at = NOW()
          WHERE id = $1`,
        [
          String(req.params.sourceId),
          typeof body.sourceName === "string" ? body.sourceName.slice(0, 255) : null,
          body.sourceType === undefined ? null : String(body.sourceType),
          Number.isFinite(Number(body.amount)) ? Number(body.amount) : null,
          typeof body.confirmed === "boolean" ? body.confirmed : null,
          body.confirmedAt || null,
          typeof body.evidenceNote === "string" ? body.evidenceNote : null,
        ],
      );
      res.json({ ok: true });
    } catch (err) {
      console.error("[funding] oppdater kilde feilet:", err);
      res.status(500).json({ error: "Kunne ikke oppdatere finansieringskilden." });
    }
  });

  app.delete("/api/role-room/funding/financing/:sourceId", async (req, res) => {
    if (!(await guardSource(req, res))) return;
    try {
      await pool.query(`DELETE FROM role_room_financing_sources WHERE id = $1`, [
        String(req.params.sourceId),
      ]);
      res.json({ ok: true });
    } catch (err) {
      console.error("[funding] slett kilde feilet:", err);
      res.status(500).json({ error: "Kunne ikke slette finansieringskilden." });
    }
  });

  // ── Eksport ──────────────────────────────────────────────────────────────
  app.get("/api/role-room/funding/applications/:applicationId/export.csv", async (req, res) => {
    if (!(await guardApplication(req, res))) return;
    try {
      const app_ = await pool.query<{ project_id: string; scheme_key: string; label: string }>(
        `SELECT a.project_id, s.scheme_key, a.label
           FROM role_room_funding_applications a
           JOIN role_room_funding_schemes s ON s.id = a.scheme_id
          WHERE a.id = $1 LIMIT 1`,
        [String(req.params.applicationId)],
      );
      const row = app_.rows[0];
      const exported = await buildFundingExport(pool, row.project_id, row.scheme_key);

      const safeName = row.label.replace(/[^\p{L}\p{N}\-_ ]/gu, "").trim() || "budsjett";
      res.setHeader("content-type", "text/csv; charset=utf-8");
      res.setHeader("content-disposition", `attachment; filename="${safeName}.csv"`);
      res.send(toCsv(exported));
    } catch (err) {
      console.error("[funding] eksport feilet:", err);
      res.status(500).json({ error: "Kunne ikke lage eksport." });
    }
  });
}
