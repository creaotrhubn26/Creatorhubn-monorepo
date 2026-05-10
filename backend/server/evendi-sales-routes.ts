/**
 * evendi-sales-routes.ts
 *
 * Setup-funksjon for /api/evendi/offers + /api/evendi/contracts endpoints —
 * vendor-side salgs-flyt mellom leverandør (foto/film/etc.) og brudepar.
 *
 * 6 endpoints:
 *   - GET    /offers                      (list vendor-tilbud)
 *   - POST   /offers                      (create offer + items + WS-melding)
 *   - PATCH  /offers/:id                  (oppdater offer + erstatt items)
 *   - DELETE /offers/:id                  (slett)
 *   - GET    /contracts                   (list vendor-kontrakter)
 *   - PATCH  /contracts/:id               (vendor markerer ferdig osv.)
 *
 * Auth: token-basert via getVendorFromSession (Bearer-token + vendor-
 * lookup). Returnerer 401 hvis ingen session, 404 hvis ingen vendor-
 * profil.
 *
 * Wire opp i backend/server/index.ts ved å legge til:
 *
 *   import { setupEvendiSalesRoutes } from "./evendi-sales-routes";
 *
 *   setupEvendiSalesRoutes({ app, pool, getVendorFromSession });
 *
 * Mode-noter: ingen Role Room-mode-branching.
 */

import type express from "express";
import type { Pool } from "pg";

interface VendorSession {
  id: string;
  business_name: string;
}

export interface EvendiSalesRoutesDeps {
  app: express.Application;
  pool: Pool;
  getVendorFromSession: (
    req: express.Request,
    res: express.Response,
  ) => Promise<VendorSession | null>;
}

export function setupEvendiSalesRoutes(deps: EvendiSalesRoutesDeps): void {
  const { app, pool, getVendorFromSession } = deps;

  // GET /api/evendi/offers — List vendor's offers with couple info
  app.get("/api/evendi/offers", async (req, res) => {
    try {
      const vendor = await getVendorFromSession(req, res);
      if (!vendor) return;

      const result = await pool.query(
        `
        SELECT
          o.id, o.vendor_id, o.couple_id, o.conversation_id,
          o.title, o.message, o.status, o.total_amount, o.currency,
          o.valid_until, o.accepted_at, o.declined_at, o.created_at, o.updated_at,
          cp.display_name as couple_name, cp.email as couple_email,
          (SELECT json_agg(json_build_object(
            'id', oi.id, 'title', oi.title, 'description', oi.description,
            'quantity', oi.quantity, 'unit_price', oi.unit_price, 'line_total', oi.line_total,
            'sort_order', oi.sort_order
          ) ORDER BY oi.sort_order)
          FROM vendor_offer_items oi WHERE oi.offer_id = o.id) as items
        FROM vendor_offers o
        JOIN couple_profiles cp ON cp.id = o.couple_id
        WHERE o.vendor_id = $1
        ORDER BY o.created_at DESC
      `,
        [vendor.id],
      );

      res.json({ offers: result.rows, vendorName: vendor.business_name });
    } catch (error) {
      console.error("Evendi offers list error:", error);
      res.status(500).json({ error: "Kunne ikke hente tilbud" });
    }
  });

  // POST /api/evendi/offers — Create a new offer
  app.post("/api/evendi/offers", async (req, res) => {
    try {
      const vendor = await getVendorFromSession(req, res);
      if (!vendor) return;

      const { coupleId, conversationId, title, message, validUntil, items } =
        req.body;
      if (!coupleId || !title || !items?.length) {
        return res
          .status(400)
          .json({ error: "coupleId, title og minst 1 linje er påkrevd" });
      }

      // Calculate total
      const totalAmount = items.reduce(
        (sum: number, item: any) => sum + item.quantity * item.unitPrice,
        0,
      );

      // Insert offer
      const offerResult = await pool.query(
        `
        INSERT INTO vendor_offers (vendor_id, couple_id, conversation_id, title, message, total_amount, currency, valid_until)
        VALUES ($1, $2, $3, $4, $5, $6, 'NOK', $7)
        RETURNING *
      `,
        [
          vendor.id,
          coupleId,
          conversationId || null,
          title,
          message || null,
          totalAmount,
          validUntil || null,
        ],
      );

      const offer = offerResult.rows[0];

      // Insert items
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const lineTotal = item.quantity * item.unitPrice;
        await pool.query(
          `
          INSERT INTO vendor_offer_items (offer_id, product_id, title, description, quantity, unit_price, line_total, sort_order)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
          [
            offer.id,
            item.productId || null,
            item.title,
            item.description || null,
            item.quantity,
            item.unitPrice,
            lineTotal,
            i,
          ],
        );
      }

      // Send notification message in conversation if one exists
      if (conversationId) {
        const formattedAmount = (totalAmount / 100).toLocaleString("nb-NO");
        await pool.query(
          `
          INSERT INTO messages (conversation_id, sender_type, sender_id, body)
          VALUES ($1, 'vendor', $2, $3)
        `,
          [
            conversationId,
            vendor.id,
            `📋 Nytt tilbud sendt: "${title}" — ${formattedAmount} NOK`,
          ],
        );
        await pool.query(
          `
          UPDATE conversations SET last_message_at = NOW(), couple_unread_count = couple_unread_count + 1
          WHERE id = $1
        `,
          [conversationId],
        );
      }

      res.json({ offer, items: items.length });
    } catch (error) {
      console.error("Evendi create offer error:", error);
      res.status(500).json({ error: "Kunne ikke opprette tilbud" });
    }
  });

  // PATCH /api/evendi/offers/:id — Update an offer (status, details)
  app.patch("/api/evendi/offers/:id", async (req, res) => {
    try {
      const vendor = await getVendorFromSession(req, res);
      if (!vendor) return;

      const offerId = req.params.id;
      const { title, message, validUntil, status, items } = req.body;

      // Verify ownership
      const check = await pool.query(
        "SELECT id FROM vendor_offers WHERE id = $1 AND vendor_id = $2",
        [offerId, vendor.id],
      );
      if (!check.rows.length)
        return res
          .status(403)
          .json({ error: "Ingen tilgang til dette tilbudet" });

      // Build dynamic update
      const updates: string[] = [];
      const values: any[] = [];
      let idx = 1;
      if (title !== undefined) {
        updates.push(`title = $${idx++}`);
        values.push(title);
      }
      if (message !== undefined) {
        updates.push(`message = $${idx++}`);
        values.push(message);
      }
      if (validUntil !== undefined) {
        updates.push(`valid_until = $${idx++}`);
        values.push(validUntil);
      }
      if (status !== undefined) {
        updates.push(`status = $${idx++}`);
        values.push(status);
      }
      updates.push(`updated_at = NOW()`);
      values.push(offerId);

      const result = await pool.query(
        `UPDATE vendor_offers SET ${updates.join(", ")} WHERE id = $${idx} RETURNING *`,
        values,
      );

      // Replace items if provided
      if (items?.length) {
        await pool.query("DELETE FROM vendor_offer_items WHERE offer_id = $1", [
          offerId,
        ]);
        let totalAmount = 0;
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const lineTotal = item.quantity * item.unitPrice;
          totalAmount += lineTotal;
          await pool.query(
            `
            INSERT INTO vendor_offer_items (offer_id, product_id, title, description, quantity, unit_price, line_total, sort_order)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `,
            [
              offerId,
              item.productId || null,
              item.title,
              item.description || null,
              item.quantity,
              item.unitPrice,
              lineTotal,
              i,
            ],
          );
        }
        await pool.query(
          "UPDATE vendor_offers SET total_amount = $1 WHERE id = $2",
          [totalAmount, offerId],
        );
      }

      res.json({ offer: result.rows[0] });
    } catch (error) {
      console.error("Evendi update offer error:", error);
      res.status(500).json({ error: "Kunne ikke oppdatere tilbud" });
    }
  });

  // DELETE /api/evendi/offers/:id — Delete an offer
  app.delete("/api/evendi/offers/:id", async (req, res) => {
    try {
      const vendor = await getVendorFromSession(req, res);
      if (!vendor) return;

      const result = await pool.query(
        "DELETE FROM vendor_offers WHERE id = $1 AND vendor_id = $2 RETURNING id",
        [req.params.id, vendor.id],
      );
      if (!result.rows.length)
        return res.status(404).json({ error: "Tilbud ikke funnet" });
      res.json({ deleted: true });
    } catch (error) {
      console.error("Evendi delete offer error:", error);
      res.status(500).json({ error: "Kunne ikke slette tilbud" });
    }
  });

  // GET /api/evendi/contracts — List vendor's contracts with couple info
  app.get("/api/evendi/contracts", async (req, res) => {
    try {
      const vendor = await getVendorFromSession(req, res);
      if (!vendor) return;

      const result = await pool.query(
        `
        SELECT
          c.id, c.couple_id, c.vendor_id, c.offer_id,
          c.status, c.vendor_role, c.completed_at,
          c.can_view_schedule, c.can_view_speeches, c.can_view_table_seating,
          c.notify_on_schedule_changes, c.notify_on_speech_changes, c.notify_on_table_changes,
          c.created_at, c.updated_at,
          cp.display_name as couple_name, cp.email as couple_email,
          cp.wedding_date,
          o.title as offer_title, o.total_amount as offer_total_amount, o.currency as offer_currency,
          vc.name as vendor_category_name
        FROM couple_vendor_contracts c
        JOIN couple_profiles cp ON cp.id = c.couple_id
        LEFT JOIN vendor_offers o ON o.id = c.offer_id
        LEFT JOIN vendors v ON v.id = c.vendor_id
        LEFT JOIN vendor_categories vc ON vc.id = v.category_id
        WHERE c.vendor_id = $1
        ORDER BY c.created_at DESC
      `,
        [vendor.id],
      );

      res.json({ contracts: result.rows, vendorName: vendor.business_name });
    } catch (error) {
      console.error("Evendi contracts list error:", error);
      res.status(500).json({ error: "Kunne ikke hente kontrakter" });
    }
  });

  // PATCH /api/evendi/contracts/:id — Update contract (vendor marks complete etc.)
  app.patch("/api/evendi/contracts/:id", async (req, res) => {
    try {
      const vendor = await getVendorFromSession(req, res);
      if (!vendor) return;

      const contractId = req.params.id;
      const { status } = req.body;

      const check = await pool.query(
        "SELECT id FROM couple_vendor_contracts WHERE id = $1 AND vendor_id = $2",
        [contractId, vendor.id],
      );
      if (!check.rows.length)
        return res.status(403).json({ error: "Ingen tilgang" });

      const updates: string[] = ["updated_at = NOW()"];
      const values: any[] = [];
      let idx = 1;

      if (status) {
        updates.push(`status = $${idx++}`);
        values.push(status);
        if (status === "completed") {
          updates.push(`completed_at = NOW()`);
        }
      }
      values.push(contractId);

      const result = await pool.query(
        `UPDATE couple_vendor_contracts SET ${updates.join(", ")} WHERE id = $${idx} RETURNING *`,
        values,
      );
      res.json({ contract: result.rows[0] });
    } catch (error) {
      console.error("Evendi update contract error:", error);
      res.status(500).json({ error: "Kunne ikke oppdatere kontrakt" });
    }
  });
}
