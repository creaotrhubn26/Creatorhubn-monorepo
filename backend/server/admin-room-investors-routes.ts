/**
 * admin-room-investors-routes.ts
 *
 * Setup-funksjon for /api/admin-room/investor-contacts endpoints.
 * 4 endpoints: list, create, update (patch), delete. Tabellen
 * `admin_investor_contacts` lagrer due-diligence-checklist, deck-status
 * og oppfølgings-status per investor-kontakt.
 *
 * Wire opp i backend/server/index.ts ved å legge til:
 *
 *   import { setupAdminInvestorsRoutes } from "./admin-room-investors-routes";
 *
 *   setupAdminInvestorsRoutes({
 *     app, pool, getActiveSessionFromRequest, requireAdminRoomAccess, logAdminActivity,
 *   });
 *
 * Mode-noter: ingen Role Room-modes påvirker disse endpoints. Admin Room-
 * funksjonalitet låst til produkteier (orthogonalt til alle 4 modes).
 */

import type { AdminRoomRoutesDeps } from "./_shared";
import { asString, asNumberOrNull, asJsonbArray, asJsonbObject } from "./_shared";

export function setupAdminInvestorsRoutes(deps: AdminRoomRoutesDeps): void {
  const {
    app,
    pool,
    requireAdminRoomAccess,
    logAdminActivity,
  } = deps;

  app.get("/api/admin-room/investor-contacts", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const result = await pool.query(
        `SELECT * FROM admin_investor_contacts WHERE user_id = $1 ORDER BY created_at DESC`,
        [session.userId],
      );
      res.json({ items: result.rows });
    } catch (err) {
      console.error("admin-room investor-contacts list error", err);
      res.status(500).json({ error: "Kunne ikke hente investor-kontakter" });
    }
  });

  app.post("/api/admin-room/investor-contacts", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (!asString(body.companyName)) {
      res.status(400).json({ error: "companyName er påkrevd" });
      return;
    }
    try {
      const result = await pool.query(
        `INSERT INTO admin_investor_contacts
           (user_id, company_name, contact_name, contact_email, contact_phone,
            status, ticket_size_min, ticket_size_max, currency, focus_areas,
            intro_source, next_step, next_step_due, notes, last_contact_at,
            dd_checklist, deck_url, deck_uploaded_at, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $13, $14, $15,
                 $16::jsonb, $17, $18, $19::jsonb)
         RETURNING *`,
        [
          session.userId,
          asString(body.companyName),
          asString(body.contactName),
          asString(body.contactEmail),
          asString(body.contactPhone),
          asString(body.status, "lead"),
          asNumberOrNull(body.ticketSizeMin),
          asNumberOrNull(body.ticketSizeMax),
          asString(body.currency, "NOK"),
          asJsonbArray(body.focusAreas),
          asString(body.introSource),
          asString(body.nextStep),
          asString(body.nextStepDue),
          asString(body.notes),
          asString(body.lastContactAt),
          asJsonbArray(body.ddChecklist),
          asString(body.deckUrl),
          asString(body.deckUploadedAt),
          asJsonbObject(body.metadata),
        ],
      );
      await logAdminActivity({
        userId: session.userId,
        entityType: "investor",
        entityId: result.rows[0].id,
        action: "created",
        summary: result.rows[0].company_name,
      });
      res.status(201).json({ item: result.rows[0] });
    } catch (err) {
      console.error("admin-room investor-contacts create error", err);
      res.status(500).json({ error: "Kunne ikke opprette investor-kontakt" });
    }
  });

  app.patch("/api/admin-room/investor-contacts/:id", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const sets: string[] = [];
    const params: unknown[] = [req.params.id, session.userId];
    const push = (sqlExpr: string, value: unknown) => {
      params.push(value);
      sets.push(`${sqlExpr} = $${params.length}`);
    };
    if ("companyName" in body) push("company_name", asString(body.companyName));
    if ("contactName" in body) push("contact_name", asString(body.contactName));
    if ("contactEmail" in body) push("contact_email", asString(body.contactEmail));
    if ("contactPhone" in body) push("contact_phone", asString(body.contactPhone));
    if ("status" in body) push("status", asString(body.status, "lead"));
    if ("ticketSizeMin" in body) push("ticket_size_min", asNumberOrNull(body.ticketSizeMin));
    if ("ticketSizeMax" in body) push("ticket_size_max", asNumberOrNull(body.ticketSizeMax));
    if ("currency" in body) push("currency", asString(body.currency, "NOK"));
    if ("focusAreas" in body) sets.push(`focus_areas = '${asJsonbArray(body.focusAreas).replace(/'/g, "''")}'::jsonb`);
    if ("introSource" in body) push("intro_source", asString(body.introSource));
    if ("nextStep" in body) push("next_step", asString(body.nextStep));
    if ("nextStepDue" in body) push("next_step_due", asString(body.nextStepDue));
    if ("notes" in body) push("notes", asString(body.notes));
    if ("lastContactAt" in body) push("last_contact_at", asString(body.lastContactAt));
    if ("ddChecklist" in body) sets.push(`dd_checklist = '${asJsonbArray(body.ddChecklist).replace(/'/g, "''")}'::jsonb`);
    if ("deckUrl" in body) push("deck_url", asString(body.deckUrl));
    if ("deckUploadedAt" in body) push("deck_uploaded_at", asString(body.deckUploadedAt));
    if (sets.length === 0) {
      res.status(400).json({ error: "Ingen felter å oppdatere" });
      return;
    }
    sets.push("updated_at = now()");
    try {
      const result = await pool.query(
        `UPDATE admin_investor_contacts SET ${sets.join(", ")}
          WHERE id = $1 AND user_id = $2 RETURNING *`,
        params,
      );
      if (result.rowCount === 0) {
        res.status(404).json({ error: "Investor-kontakt ikke funnet" });
        return;
      }
      res.json({ item: result.rows[0] });
    } catch (err) {
      console.error("admin-room investor-contacts patch error", err);
      res.status(500).json({ error: "Kunne ikke oppdatere investor-kontakt" });
    }
  });

  app.delete("/api/admin-room/investor-contacts/:id", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const result = await pool.query(
        `DELETE FROM admin_investor_contacts WHERE id = $1 AND user_id = $2 RETURNING id`,
        [req.params.id, session.userId],
      );
      if (result.rowCount === 0) {
        res.status(404).json({ error: "Investor-kontakt ikke funnet" });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      console.error("admin-room investor-contacts delete error", err);
      res.status(500).json({ error: "Kunne ikke slette investor-kontakt" });
    }
  });
}
