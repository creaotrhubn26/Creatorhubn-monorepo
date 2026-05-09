/**
 * admin-room-partners-routes.ts
 *
 * Setup-funksjon for /api/admin-room/partner-contacts endpoints.
 * 4 endpoints: list, create, update (patch), delete. Tabellen
 * `admin_partner_contacts` lagrer partnerskaps-type, kontrakt-status
 * og oppfølgings-status per partner-kandidat.
 *
 * Wire opp i backend/server/index.ts ved å legge til:
 *
 *   import { setupAdminPartnersRoutes } from "./admin-room-partners-routes";
 *
 *   setupAdminPartnersRoutes({
 *     app, pool, getActiveSessionFromRequest, requireAdminRoomAccess, logAdminActivity,
 *   });
 *
 * Mode-noter: ingen Role Room-modes påvirker disse endpoints. Admin Room-
 * funksjonalitet låst til produkteier.
 */

import type { AdminRoomRoutesDeps } from "./_shared";
import { asString, asJsonbObject } from "./_shared";

export function setupAdminPartnersRoutes(deps: AdminRoomRoutesDeps): void {
  const {
    app,
    pool,
    requireAdminRoomAccess,
    logAdminActivity,
  } = deps;

  app.get("/api/admin-room/partner-contacts", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const result = await pool.query(
        `SELECT * FROM admin_partner_contacts WHERE user_id = $1 ORDER BY created_at DESC`,
        [session.userId],
      );
      res.json({ items: result.rows });
    } catch (err) {
      console.error("admin-room partner-contacts list error", err);
      res.status(500).json({ error: "Kunne ikke hente partnere" });
    }
  });

  app.post("/api/admin-room/partner-contacts", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (!asString(body.companyName)) {
      res.status(400).json({ error: "companyName er påkrevd" });
      return;
    }
    try {
      const result = await pool.query(
        `INSERT INTO admin_partner_contacts
           (user_id, company_name, contact_name, contact_email, contact_phone,
            partnership_type, status, proposal_summary, next_step, next_step_due,
            notes, contract_status, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb)
         RETURNING *`,
        [
          session.userId,
          asString(body.companyName),
          asString(body.contactName),
          asString(body.contactEmail),
          asString(body.contactPhone),
          asString(body.partnershipType, "other"),
          asString(body.status, "potential"),
          asString(body.proposalSummary),
          asString(body.nextStep),
          asString(body.nextStepDue),
          asString(body.notes),
          asString(body.contractStatus),
          asJsonbObject(body.metadata),
        ],
      );
      await logAdminActivity({
        userId: session.userId,
        entityType: "partner",
        entityId: result.rows[0].id,
        action: "created",
        summary: result.rows[0].company_name,
      });
      res.status(201).json({ item: result.rows[0] });
    } catch (err) {
      console.error("admin-room partner-contacts create error", err);
      res.status(500).json({ error: "Kunne ikke opprette partner" });
    }
  });

  app.patch("/api/admin-room/partner-contacts/:id", async (req, res) => {
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
    if ("partnershipType" in body) push("partnership_type", asString(body.partnershipType, "other"));
    if ("status" in body) push("status", asString(body.status, "potential"));
    if ("proposalSummary" in body) push("proposal_summary", asString(body.proposalSummary));
    if ("nextStep" in body) push("next_step", asString(body.nextStep));
    if ("nextStepDue" in body) push("next_step_due", asString(body.nextStepDue));
    if ("notes" in body) push("notes", asString(body.notes));
    if ("contractStatus" in body) push("contract_status", asString(body.contractStatus));
    if (sets.length === 0) {
      res.status(400).json({ error: "Ingen felter å oppdatere" });
      return;
    }
    sets.push("updated_at = now()");
    try {
      const result = await pool.query(
        `UPDATE admin_partner_contacts SET ${sets.join(", ")}
          WHERE id = $1 AND user_id = $2 RETURNING *`,
        params,
      );
      if (result.rowCount === 0) {
        res.status(404).json({ error: "Partner ikke funnet" });
        return;
      }
      res.json({ item: result.rows[0] });
    } catch (err) {
      console.error("admin-room partner-contacts patch error", err);
      res.status(500).json({ error: "Kunne ikke oppdatere partner" });
    }
  });

  app.delete("/api/admin-room/partner-contacts/:id", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const result = await pool.query(
        `DELETE FROM admin_partner_contacts WHERE id = $1 AND user_id = $2 RETURNING id`,
        [req.params.id, session.userId],
      );
      if (result.rowCount === 0) {
        res.status(404).json({ error: "Partner ikke funnet" });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      console.error("admin-room partner-contacts delete error", err);
      res.status(500).json({ error: "Kunne ikke slette partner" });
    }
  });
}
