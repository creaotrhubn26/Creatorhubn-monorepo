/**
 * evendi-people-routes.ts
 *
 * Setup-funksjon for vendor-side endpoints som omhandler personer rundt
 * brudeparet — kontakter, viktige personer, parprofil, koordinatorer.
 *
 * 10 endpoints:
 *   - GET    /contacts                                      (vendor → couples med samtaler)
 *   - GET    /important-people?coupleId                     (les viktige personer)
 *   - POST   /important-people                              (legg til)
 *   - PATCH  /important-people/:id                          (oppdater)
 *   - DELETE /important-people/:id                          (slett)
 *   - GET    /couple-profile?coupleId                       (parprofil-detaljer)
 *   - GET    /couple/:coupleId/important-people             (alternativt URL-format)
 *   - GET    /couple/:coupleId/wedding-invites              (rolle-invitasjoner)
 *   - PUT    /couple/guests                                 (gjestetall)
 *   - GET    /coordinators/:coupleId                        (koordinatorer m/ kontrakt-sjekk)
 *
 * Auth: alle bruker `getVendorFromSession` (Bearer-token + vendor-lookup).
 * Tilgang valideres mot eksisterende `conversations` mellom vendor og
 * couple (eller `couple_vendor_contracts` for koordinatorer).
 *
 * Wire opp i backend/server/index.ts ved å legge til:
 *
 *   import { setupEvendiPeopleRoutes } from "./evendi-people-routes";
 *
 *   setupEvendiPeopleRoutes({ app, pool, getVendorFromSession });
 *
 * Mode-noter: ingen Role Room-mode-branching.
 */

import type express from "express";
import type { Pool } from "pg";

interface VendorSession {
  id: string;
  business_name: string;
}

export interface EvendiPeopleRoutesDeps {
  app: express.Application;
  pool: Pool;
  getVendorFromSession: (
    req: express.Request,
    res: express.Response,
  ) => Promise<VendorSession | null>;
}

export function setupEvendiPeopleRoutes(deps: EvendiPeopleRoutesDeps): void {
  const { app, pool, getVendorFromSession } = deps;

  // GET /api/evendi/contacts — List couples the vendor has conversations with
  app.get("/api/evendi/contacts", async (req, res) => {
    try {
      const vendor = await getVendorFromSession(req, res);
      if (!vendor) return;

      const result = await pool.query(
        `
        SELECT DISTINCT ON (cp.id)
          cp.id, cp.display_name, cp.email, cp.wedding_date,
          c.id as conversation_id
        FROM conversations c
        JOIN couple_profiles cp ON cp.id = c.couple_id
        WHERE c.vendor_id = $1 AND c.deleted_by_vendor = false
        ORDER BY cp.id, c.last_message_at DESC
      `,
        [vendor.id],
      );

      res.json({ contacts: result.rows });
    } catch (error) {
      console.error("Evendi contacts error:", error);
      res.status(500).json({ error: "Kunne ikke hente kontakter" });
    }
  });

  // GET /api/evendi/important-people?coupleId=xxx — list important people for a couple
  // Vendor must have an active conversation with the couple
  app.get("/api/evendi/important-people", async (req: any, res: any) => {
    try {
      const vendor = await getVendorFromSession(req, res);
      if (!vendor) return;

      const coupleId = req.query.coupleId as string;
      if (!coupleId) {
        return res.status(400).json({ error: "coupleId er påkrevd" });
      }

      // Verify vendor has a conversation with this couple
      const convCheck = await pool.query(
        "SELECT id FROM conversations WHERE vendor_id = $1 AND couple_id = $2 LIMIT 1",
        [vendor.id, coupleId],
      );
      if (!convCheck.rows.length) {
        return res
          .status(403)
          .json({ error: "Ingen tilgang til dette parets data" });
      }

      const result = await pool.query(
        `
        SELECT id, couple_id, name, role, phone, email, notes, sort_order, created_at, updated_at
        FROM couple_important_people
        WHERE couple_id = $1
        ORDER BY sort_order, created_at
      `,
        [coupleId],
      );

      res.json({ people: result.rows });
    } catch (error) {
      console.error("Evendi important people error:", error);
      res.status(500).json({ error: "Kunne ikke hente viktige personer" });
    }
  });

  // POST /api/evendi/important-people — vendor can add important person for a couple
  app.post("/api/evendi/important-people", async (req: any, res: any) => {
    try {
      const vendor = await getVendorFromSession(req, res);
      if (!vendor) return;

      const { coupleId, name, role, phone, email, notes, sortOrder } = req.body;
      if (!coupleId || !name || !role) {
        return res
          .status(400)
          .json({ error: "coupleId, name og role er påkrevd" });
      }

      // Verify vendor has a conversation with this couple
      const convCheck = await pool.query(
        "SELECT id FROM conversations WHERE vendor_id = $1 AND couple_id = $2 LIMIT 1",
        [vendor.id, coupleId],
      );
      if (!convCheck.rows.length) {
        return res
          .status(403)
          .json({ error: "Ingen tilgang til dette parets data" });
      }

      const result = await pool.query(
        `
        INSERT INTO couple_important_people (id, couple_id, name, role, phone, email, notes, sort_order, created_at, updated_at)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        RETURNING *
      `,
        [
          coupleId,
          name,
          role,
          phone || null,
          email || null,
          notes || null,
          sortOrder || 0,
        ],
      );

      res.json({ person: result.rows[0] });
    } catch (error) {
      console.error("Evendi create important person error:", error);
      res.status(500).json({ error: "Kunne ikke legge til person" });
    }
  });

  // PATCH /api/evendi/important-people/:id — update an important person
  app.patch("/api/evendi/important-people/:id", async (req: any, res: any) => {
    try {
      const vendor = await getVendorFromSession(req, res);
      if (!vendor) return;

      const { id } = req.params;
      const { name, role, phone, email, notes, sortOrder } = req.body;

      // Verify this person belongs to a couple the vendor is connected to
      const personCheck = await pool.query(
        `
        SELECT cip.couple_id FROM couple_important_people cip
        JOIN conversations c ON c.couple_id = cip.couple_id AND c.vendor_id = $1
        WHERE cip.id = $2
        LIMIT 1
      `,
        [vendor.id, id],
      );
      if (!personCheck.rows.length) {
        return res.status(403).json({ error: "Ingen tilgang" });
      }

      const setClauses: string[] = ["updated_at = NOW()"];
      const values: any[] = [];
      let paramIndex = 1;

      if (name !== undefined) {
        setClauses.push(`name = $${paramIndex++}`);
        values.push(name);
      }
      if (role !== undefined) {
        setClauses.push(`role = $${paramIndex++}`);
        values.push(role);
      }
      if (phone !== undefined) {
        setClauses.push(`phone = $${paramIndex++}`);
        values.push(phone);
      }
      if (email !== undefined) {
        setClauses.push(`email = $${paramIndex++}`);
        values.push(email);
      }
      if (notes !== undefined) {
        setClauses.push(`notes = $${paramIndex++}`);
        values.push(notes);
      }
      if (sortOrder !== undefined) {
        setClauses.push(`sort_order = $${paramIndex++}`);
        values.push(sortOrder);
      }

      values.push(id);
      const result = await pool.query(
        `
        UPDATE couple_important_people SET ${setClauses.join(", ")} WHERE id = $${paramIndex} RETURNING *
      `,
        values,
      );

      res.json({ person: result.rows[0] });
    } catch (error) {
      console.error("Evendi update important person error:", error);
      res.status(500).json({ error: "Kunne ikke oppdatere person" });
    }
  });

  // DELETE /api/evendi/important-people/:id — delete an important person
  app.delete("/api/evendi/important-people/:id", async (req: any, res: any) => {
    try {
      const vendor = await getVendorFromSession(req, res);
      if (!vendor) return;

      const { id } = req.params;

      // Verify this person belongs to a couple the vendor is connected to
      const personCheck = await pool.query(
        `
        SELECT cip.couple_id FROM couple_important_people cip
        JOIN conversations c ON c.couple_id = cip.couple_id AND c.vendor_id = $1
        WHERE cip.id = $2
        LIMIT 1
      `,
        [vendor.id, id],
      );
      if (!personCheck.rows.length) {
        return res.status(403).json({ error: "Ingen tilgang" });
      }

      await pool.query("DELETE FROM couple_important_people WHERE id = $1", [id]);
      res.json({ success: true });
    } catch (error) {
      console.error("Evendi delete important person error:", error);
      res.status(500).json({ error: "Kunne ikke slette person" });
    }
  });

  // GET /api/evendi/couple-profile?coupleId=xxx — get couple profile details
  app.get("/api/evendi/couple-profile", async (req: any, res: any) => {
    try {
      const vendor = await getVendorFromSession(req, res);
      if (!vendor) return;

      const coupleId = req.query.coupleId as string;
      if (!coupleId) {
        return res.status(400).json({ error: "coupleId er påkrevd" });
      }

      const convCheck = await pool.query(
        "SELECT id FROM conversations WHERE vendor_id = $1 AND couple_id = $2 LIMIT 1",
        [vendor.id, coupleId],
      );
      if (!convCheck.rows.length) {
        return res.status(403).json({ error: "Ingen tilgang" });
      }

      const result = await pool.query(
        `
        SELECT id, email, display_name, wedding_date, created_at
        FROM couple_profiles
        WHERE id = $1
      `,
        [coupleId],
      );

      if (!result.rows.length) {
        return res.status(404).json({ error: "Parprofil ikke funnet" });
      }

      res.json({ profile: result.rows[0] });
    } catch (error) {
      console.error("Evendi couple profile error:", error);
      res.status(500).json({ error: "Kunne ikke hente parprofil" });
    }
  });

  // VENDOR — View important people for a couple (alternativt URL-format)
  app.get(
    "/api/evendi/couple/:coupleId/important-people",
    async (req: any, res: any) => {
      try {
        const vendor = await getVendorFromSession(req, res);
        if (!vendor) return;

        const { coupleId } = req.params;

        // Verify vendor has relationship with this couple
        const convCheck = await pool.query(
          "SELECT id FROM conversations WHERE vendor_id = $1 AND couple_id = $2 LIMIT 1",
          [vendor.id, coupleId],
        );
        if (!convCheck.rows.length) {
          return res
            .status(403)
            .json({
              error: "Ingen tilgang til dette bryllupets viktige personer",
            });
        }

        const result = await pool.query(
          `SELECT id, name, role, phone, email, notes
         FROM couple_important_people
         WHERE couple_id = $1
         ORDER BY sort_order ASC NULLS LAST`,
          [coupleId],
        );

        res.json({ success: true, importantPeople: result.rows });
      } catch (error) {
        console.error("Get important people error:", error);
        res.status(500).json({ error: "Kunne ikke hente viktige personer" });
      }
    },
  );

  // VENDOR — View wedding role invitations for a couple
  app.get(
    "/api/evendi/couple/:coupleId/wedding-invites",
    async (req: any, res: any) => {
      try {
        const vendor = await getVendorFromSession(req, res);
        if (!vendor) return;

        const { coupleId } = req.params;

        // Verify vendor has relationship with this couple
        const convCheck = await pool.query(
          "SELECT id FROM conversations WHERE vendor_id = $1 AND couple_id = $2 LIMIT 1",
          [vendor.id, coupleId],
        );
        if (!convCheck.rows.length) {
          return res.status(403).json({ error: "Ingen tilgang" });
        }

        const result = await pool.query(
          `SELECT id, name, role, status, joined_at, created_at
         FROM wedding_role_invitations
         WHERE couple_id = $1 AND status != 'revoked'
         ORDER BY created_at DESC`,
          [coupleId],
        );

        res.json({ success: true, invitations: result.rows });
      } catch (error) {
        console.error("Get wedding invitations error:", error);
        res.status(500).json({ error: "Kunne ikke hente invitasjoner" });
      }
    },
  );

  // UPDATE EXPECTED GUESTS — Set guest count on couple profile
  app.put("/api/evendi/couple/guests", async (req: any, res: any) => {
    try {
      const vendor = await getVendorFromSession(req, res);
      if (!vendor) return;

      const { coupleId, expectedGuests } = req.body;
      if (!coupleId || expectedGuests === undefined) {
        return res
          .status(400)
          .json({ error: "coupleId og expectedGuests er påkrevd" });
      }

      // Verify vendor has access via conversation
      const convCheck = await pool.query(
        "SELECT id FROM conversations WHERE vendor_id = $1 AND couple_id = $2 LIMIT 1",
        [vendor.id, coupleId],
      );
      if (!convCheck.rows.length) {
        return res.status(403).json({ error: "Ingen tilgang til dette paret" });
      }

      await pool.query(
        "UPDATE couple_profiles SET expected_guests = $1, updated_at = NOW() WHERE id = $2",
        [parseInt(expectedGuests) || 0, coupleId],
      );

      res.json({ success: true, expectedGuests: parseInt(expectedGuests) || 0 });
    } catch (error) {
      console.error("Update expected guests error:", error);
      res.status(500).json({ error: "Kunne ikke oppdatere gjestetall" });
    }
  });

  // COORDINATORS BRIDGE — GET /api/evendi/coordinators/:coupleId
  app.get("/api/evendi/coordinators/:coupleId", async (req: any, res: any) => {
    try {
      const vendor = await getVendorFromSession(req, res);
      if (!vendor) return;

      const { coupleId } = req.params;

      // Check vendor has an active contract with can_view_coordinators = true
      const contractCheck = await pool.query(
        `SELECT id, can_view_coordinators FROM couple_vendor_contracts
         WHERE vendor_id = $1 AND couple_id = $2 AND status = 'active' LIMIT 1`,
        [vendor.id, coupleId],
      );

      // Fallback: if no contract, check if they have a conversation (relaxed access)
      if (!contractCheck.rows.length) {
        const convCheck = await pool.query(
          "SELECT id FROM conversations WHERE vendor_id = $1 AND couple_id = $2 LIMIT 1",
          [vendor.id, coupleId],
        );
        if (!convCheck.rows.length) {
          return res
            .status(403)
            .json({ error: "Ingen tilgang til koordinatordata" });
        }
      }

      // If contract exists but can_view_coordinators is false, deny
      if (
        contractCheck.rows.length &&
        !contractCheck.rows[0].can_view_coordinators
      ) {
        return res
          .status(403)
          .json({
            error:
              "Tilgang til koordinatorer er ikke aktivert for denne kontrakten",
          });
      }

      // Fetch active coordinators
      const [coordinatorsResult, organizerResult] = await Promise.all([
        pool.query(
          `SELECT id, name, role_label, email, can_view_speeches, can_view_schedule,
                  can_edit_speeches, can_edit_schedule, status, last_accessed_at, created_at
           FROM coordinator_invitations
           WHERE couple_id = $1 AND status = 'active'
           ORDER BY created_at DESC`,
          [coupleId],
        ),
        pool.query(
          "SELECT display_name, event_type FROM couple_profiles WHERE id = $1",
          [coupleId],
        ),
      ]);

      const organizer = organizerResult.rows[0];

      res.json({
        coordinators: coordinatorsResult.rows.map((c: any) => ({
          id: c.id,
          name: c.name,
          roleLabel: c.role_label,
          email: c.email,
          canViewSpeeches: c.can_view_speeches,
          canViewSchedule: c.can_view_schedule,
          canEditSpeeches: c.can_edit_speeches,
          canEditSchedule: c.can_edit_schedule,
          status: c.status,
          lastAccessedAt: c.last_accessed_at,
          createdAt: c.created_at,
        })),
        coupleId,
        eventType: organizer?.event_type || "wedding",
        organizerName: organizer?.display_name || "Ukjent",
        totalCoordinators: coordinatorsResult.rows.length,
      });
    } catch (error) {
      console.error("Evendi coordinators bridge error:", error);
      res.status(500).json({ error: "Kunne ikke hente koordinatorer" });
    }
  });
}
