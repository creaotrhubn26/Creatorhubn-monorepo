import express from "express";
import type { Pool } from "pg";

export interface PhotographerPrintRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireUserSession: (req: any, res: any) => any;
  ensurePrintStoreSchema: () => Promise<void>;
}

export function setupPhotographerPrintRoutes(
  deps: PhotographerPrintRoutesDeps,
): void {
  const { app, pool, requireUserSession, ensurePrintStoreSchema } = deps;

  app.get("/api/photographer/print-products", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      await ensurePrintStoreSchema();
      const result = await pool.query(
        `SELECT id, name, description, size_label, material, unit_price,
                currency, is_active, sort_order, created_at, updated_at
         FROM print_products
         WHERE photographer_id = $1
         ORDER BY sort_order ASC, created_at DESC`,
        [session.userId],
      );
      res.json({
        products: result.rows.map((r: Record<string, unknown>) => ({
          id: r.id,
          name: r.name,
          description: r.description ?? "",
          sizeLabel: r.size_label ?? "",
          material: r.material ?? "",
          unitPrice: Number(r.unit_price),
          currency: r.currency,
          isActive: r.is_active !== false,
          sortOrder: r.sort_order ?? 0,
        })),
      });
    } catch (err) {
      console.warn("[print-store] list products failed:", err);
      res.json({ products: [] });
    }
  });

  app.post("/api/photographer/print-products", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      await ensurePrintStoreSchema();
      const {
        name,
        description,
        sizeLabel,
        material,
        unitPrice,
        currency,
        sortOrder,
        isActive,
      } = req.body ?? {};
      if (!name || unitPrice == null) {
        return res
          .status(400)
          .json({ error: "name_and_unitPrice_required" });
      }
      const result = await pool.query(
        `INSERT INTO print_products (photographer_id, name, description, size_label, material, unit_price, currency, sort_order, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [
          session.userId,
          String(name),
          description ?? null,
          sizeLabel ?? null,
          material ?? null,
          Number(unitPrice),
          String(currency || "NOK").toUpperCase(),
          Number(sortOrder) || 0,
          isActive !== false,
        ],
      );
      res.status(201).json({ id: result.rows[0].id, success: true });
    } catch (err) {
      console.error("[print-store] create product failed:", err);
      res.status(500).json({
        error: "create_product_failed",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  });

  app.put("/api/photographer/print-products/:id", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      await ensurePrintStoreSchema();
      const {
        name,
        description,
        sizeLabel,
        material,
        unitPrice,
        currency,
        sortOrder,
        isActive,
      } = req.body ?? {};
      await pool.query(
        `UPDATE print_products
         SET name = COALESCE($1, name),
             description = COALESCE($2, description),
             size_label = COALESCE($3, size_label),
             material = COALESCE($4, material),
             unit_price = COALESCE($5, unit_price),
             currency = COALESCE($6, currency),
             sort_order = COALESCE($7, sort_order),
             is_active = COALESCE($8, is_active),
             updated_at = NOW()
         WHERE id = $9 AND photographer_id = $10`,
        [
          name ?? null,
          description ?? null,
          sizeLabel ?? null,
          material ?? null,
          unitPrice != null ? Number(unitPrice) : null,
          currency ? String(currency).toUpperCase() : null,
          sortOrder != null ? Number(sortOrder) : null,
          isActive ?? null,
          req.params.id,
          session.userId,
        ],
      );
      res.json({ success: true });
    } catch (err) {
      console.error("[print-store] update product failed:", err);
      res.status(500).json({ error: "update_product_failed" });
    }
  });

  app.delete(
    "/api/photographer/print-products/:id",
    async (req, res) => {
      const session = requireUserSession(req, res);
      if (!session) return;
      try {
        await ensurePrintStoreSchema();
        await pool.query(
          `DELETE FROM print_products WHERE id = $1 AND photographer_id = $2`,
          [req.params.id, session.userId],
        );
        res.json({ success: true });
      } catch (err) {
        console.error("[print-store] delete product failed:", err);
        res.status(500).json({ error: "delete_product_failed" });
      }
    },
  );

  // Slice 9D.5.C — print-orders-liste for fotograf
  app.get("/api/photographer/print-orders", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      await ensurePrintStoreSchema();
      const result = await pool.query(
        `SELECT id, gallery_id, client_email, client_name,
                total_amount, currency, payment_status,
                fulfillment_status, stripe_session_id, created_at
           FROM print_orders
          WHERE photographer_id = $1
          ORDER BY created_at DESC
          LIMIT 200`,
        [session.userId],
      );
      res.json({
        orders: result.rows.map((r: Record<string, unknown>) => ({
          id: r.id,
          galleryId: r.gallery_id,
          clientEmail: r.client_email,
          clientName: r.client_name ?? "",
          totalAmount: Number(r.total_amount ?? 0),
          currency: r.currency ?? "NOK",
          paymentStatus: r.payment_status,
          fulfillmentStatus: r.fulfillment_status,
          stripeSessionId: r.stripe_session_id,
          createdAt: r.created_at,
        })),
      });
    } catch (err) {
      console.warn("[print-orders] list failed:", err);
      res.json({ orders: [] });
    }
  });
}
