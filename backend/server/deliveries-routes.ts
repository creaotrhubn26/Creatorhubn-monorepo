import express from "express";
import type { Pool } from "pg";
import crypto from "crypto";

export interface DeliveriesRoutesDeps {
  app: express.Application;
  pool: Pool;
  normalizeEventType: (value: unknown) => string | null;
}

export function setupDeliveriesRoutes(deps: DeliveriesRoutesDeps): void {
  const { app, pool, normalizeEventType } = deps;

  // MUST be BEFORE parameterized /:vendorId routes to avoid shadowing
  app.get("/api/deliveries/access/:accessCode", async (req, res) => {
    try {
      const { accessCode } = req.params;
      const delivery = await pool.query(
        "SELECT id, couple_name, title, description, wedding_date, status, event_type, created_at FROM deliveries WHERE access_code = $1 AND status = $2",
        [accessCode, "active"],
      );
      if (!delivery.rowCount) {
        return res
          .status(404)
          .json({ error: "Leveranse ikke funnet eller ikke aktiv" });
      }
      const items = await pool.query(
        "SELECT id, type, label, url, description, sort_order FROM delivery_items WHERE delivery_id = $1 ORDER BY sort_order ASC",
        [delivery.rows[0].id],
      );
      res.json({ ...delivery.rows[0], items: items.rows });
    } catch (error) {
      console.error("Error accessing delivery:", error);
      res.status(500).json({ error: "Kunne ikke hente leveranse" });
    }
  });

  app.get("/api/deliveries/:vendorId", async (req, res) => {
    try {
      const { vendorId } = req.params;
      const { status } = req.query;
      let query = "SELECT * FROM deliveries WHERE vendor_id = $1";
      const params: any[] = [vendorId];
      if (status) {
        query += " AND status = $2";
        params.push(status);
      }
      query += " ORDER BY created_at DESC";
      const result = await pool.query(query, params);
      res.json({ deliveries: result.rows, total: result.rowCount });
    } catch (error) {
      console.error("Error fetching deliveries:", error);
      res.status(500).json({ error: "Kunne ikke hente leveranser" });
    }
  });

  app.get("/api/deliveries/:vendorId/:deliveryId", async (req, res) => {
    try {
      const { vendorId, deliveryId } = req.params;
      const delivery = await pool.query(
        "SELECT * FROM deliveries WHERE id = $1 AND vendor_id = $2",
        [deliveryId, vendorId],
      );
      if (!delivery.rowCount) {
        return res.status(404).json({ error: "Leveranse ikke funnet" });
      }
      const items = await pool.query(
        "SELECT * FROM delivery_items WHERE delivery_id = $1 ORDER BY sort_order ASC, created_at ASC",
        [deliveryId],
      );
      res.json({ ...delivery.rows[0], items: items.rows });
    } catch (error) {
      console.error("Error fetching delivery:", error);
      res.status(500).json({ error: "Kunne ikke hente leveranse" });
    }
  });

  app.post("/api/deliveries/:vendorId", async (req, res) => {
    try {
      const { vendorId } = req.params;
      const {
        couple_name,
        couple_email,
        title,
        description,
        wedding_date,
        status: deliveryStatus,
        event_type,
      } = req.body;
      const normalizedEventType = normalizeEventType(event_type);
      if (event_type && !normalizedEventType) {
        return res.status(400).json({ error: "Ugyldig event_type" });
      }
      const id = crypto.randomUUID();
      const accessCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const now = new Date().toISOString();
      await pool.query(
        `INSERT INTO deliveries (id, vendor_id, couple_name, couple_email, access_code, title, description, wedding_date, status, event_type, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::timestamp, $12::timestamp)`,
        [
          id,
          vendorId,
          couple_name || "",
          couple_email || "",
          accessCode,
          title || "Ny leveranse",
          description || "",
          wedding_date || "",
          deliveryStatus || "draft",
          normalizedEventType || null,
          now,
          now,
        ],
      );
      res.status(201).json({
        id,
        vendor_id: vendorId,
        couple_name,
        couple_email,
        access_code: accessCode,
        title,
        description,
        wedding_date,
        status: deliveryStatus || "draft",
        event_type: normalizedEventType || null,
        created_at: now,
        updated_at: now,
      });
    } catch (error) {
      console.error("Error creating delivery:", error);
      res.status(500).json({ error: "Kunne ikke opprette leveranse" });
    }
  });

  app.patch("/api/deliveries/:vendorId/:deliveryId", async (req, res) => {
    try {
      const { vendorId, deliveryId } = req.params;
      const updates = req.body;
      const allowedFields = [
        "couple_name",
        "couple_email",
        "title",
        "description",
        "wedding_date",
        "status",
        "event_type",
      ];
      if (updates.event_type !== undefined) {
        const normalizedEventType = normalizeEventType(updates.event_type);
        if (!normalizedEventType) {
          return res.status(400).json({ error: "Ugyldig event_type" });
        }
        updates.event_type = normalizedEventType;
      }
      const setClauses: string[] = [];
      const values: any[] = [];
      let paramIdx = 1;
      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          setClauses.push(`${field} = $${paramIdx}`);
          values.push(updates[field]);
          paramIdx++;
        }
      }
      if (setClauses.length === 0) {
        return res.status(400).json({ error: "Ingen felter å oppdatere" });
      }
      setClauses.push(`updated_at = $${paramIdx}::timestamp`);
      values.push(new Date().toISOString());
      paramIdx++;
      values.push(deliveryId, vendorId);
      const result = await pool.query(
        `UPDATE deliveries SET ${setClauses.join(", ")} WHERE id = $${paramIdx} AND vendor_id = $${paramIdx + 1} RETURNING *`,
        values,
      );
      if (!result.rowCount) {
        return res.status(404).json({ error: "Leveranse ikke funnet" });
      }
      res.json(result.rows[0]);
    } catch (error) {
      console.error("Error updating delivery:", error);
      res.status(500).json({ error: "Kunne ikke oppdatere leveranse" });
    }
  });

  app.delete("/api/deliveries/:vendorId/:deliveryId", async (req, res) => {
    try {
      const { vendorId, deliveryId } = req.params;
      await pool.query(
        "DELETE FROM delivery_items WHERE delivery_id = $1",
        [deliveryId],
      );
      const result = await pool.query(
        "DELETE FROM deliveries WHERE id = $1 AND vendor_id = $2 RETURNING id",
        [deliveryId, vendorId],
      );
      if (!result.rowCount) {
        return res.status(404).json({ error: "Leveranse ikke funnet" });
      }
      res.json({ deleted: true, id: deliveryId });
    } catch (error) {
      console.error("Error deleting delivery:", error);
      res.status(500).json({ error: "Kunne ikke slette leveranse" });
    }
  });

  app.post(
    "/api/deliveries/:vendorId/:deliveryId/items",
    async (req, res) => {
      try {
        const { vendorId, deliveryId } = req.params;
        const delivery = await pool.query(
          "SELECT id FROM deliveries WHERE id = $1 AND vendor_id = $2",
          [deliveryId, vendorId],
        );
        if (!delivery.rowCount) {
          return res.status(404).json({ error: "Leveranse ikke funnet" });
        }
        const { type, label, url, description, sort_order } = req.body;
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        await pool.query(
          `INSERT INTO delivery_items (id, delivery_id, type, label, url, description, sort_order, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8::timestamp)`,
          [
            id,
            deliveryId,
            type || "file",
            label || "",
            url || "",
            description || "",
            sort_order || 0,
            now,
          ],
        );
        res.status(201).json({
          id,
          delivery_id: deliveryId,
          type: type || "file",
          label,
          url,
          description,
          sort_order: sort_order || 0,
          created_at: now,
        });
      } catch (error) {
        console.error("Error adding delivery item:", error);
        res.status(500).json({ error: "Kunne ikke legge til element" });
      }
    },
  );

  app.delete(
    "/api/deliveries/:vendorId/:deliveryId/items/:itemId",
    async (req, res) => {
      try {
        const { vendorId, deliveryId, itemId } = req.params;
        const delivery = await pool.query(
          "SELECT id FROM deliveries WHERE id = $1 AND vendor_id = $2",
          [deliveryId, vendorId],
        );
        if (!delivery.rowCount) {
          return res.status(404).json({ error: "Leveranse ikke funnet" });
        }
        const result = await pool.query(
          "DELETE FROM delivery_items WHERE id = $1 AND delivery_id = $2 RETURNING id",
          [itemId, deliveryId],
        );
        if (!result.rowCount) {
          return res.status(404).json({ error: "Element ikke funnet" });
        }
        res.json({ deleted: true, id: itemId });
      } catch (error) {
        console.error("Error removing delivery item:", error);
        res.status(500).json({ error: "Kunne ikke fjerne element" });
      }
    },
  );
}
