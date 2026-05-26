import express from "express";
import type { Pool } from "pg";

export interface PricingRoutesDeps {
  app: express.Application;
  pool: Pool;
  getPricingUserId: (req: any) => string;
}

export function setupPricingRoutes(deps: PricingRoutesDeps): void {
  const { app, pool, getPricingUserId } = deps;

  app.get("/api/pricing/categories/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const result = await pool.query(
        "SELECT * FROM pricing_categories WHERE user_id = $1 ORDER BY sort_order, created_at",
        [userId],
      );
      res.json(
        result.rows.map((r: any) => ({
          id: r.id.toString(),
          userId: r.user_id,
          name: r.name || r.category_name,
          categoryName: r.category_name,
          description: r.description,
          color: r.color,
          isActive: r.is_active,
          sortOrder: r.sort_order,
          profession: r.profession,
          createdAt: r.created_at,
        })),
      );
    } catch (error) {
      console.error("Error fetching pricing categories:", error);
      res.status(500).json({ error: "Kunne ikke hente kategorier" });
    }
  });

  app.post("/api/pricing/categories", async (req, res) => {
    try {
      const {
        userId,
        name,
        categoryName,
        description,
        color,
        profession,
        sortOrder,
      } = req.body;
      const result = await pool.query(
        `INSERT INTO pricing_categories (user_id, name, category_name, description, color, profession, sort_order, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW()) RETURNING *`,
        [
          userId,
          name || categoryName,
          categoryName || name,
          description || "",
          color || "#3B82F6",
          profession || "fotograf",
          sortOrder || 0,
        ],
      );
      const r = result.rows[0];
      res.json({
        id: r.id.toString(),
        userId: r.user_id,
        name: r.name,
        categoryName: r.category_name,
        description: r.description,
        color: r.color,
        isActive: r.is_active,
        sortOrder: r.sort_order,
        profession: r.profession,
        createdAt: r.created_at,
      });
    } catch (error) {
      console.error("Error creating pricing category:", error);
      res.status(500).json({ error: "Kunne ikke opprette kategori" });
    }
  });

  app.put("/api/pricing/categories/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const data = req.body;
      const updates: string[] = ["updated_at = NOW()"];
      const params: any[] = [];
      let idx = 1;
      if (data.name !== undefined) {
        updates.push(`name = $${idx}`);
        params.push(data.name);
        idx++;
      }
      if (data.categoryName !== undefined) {
        updates.push(`category_name = $${idx}`);
        params.push(data.categoryName);
        idx++;
      }
      if (data.description !== undefined) {
        updates.push(`description = $${idx}`);
        params.push(data.description);
        idx++;
      }
      if (data.color !== undefined) {
        updates.push(`color = $${idx}`);
        params.push(data.color);
        idx++;
      }
      if (data.isActive !== undefined) {
        updates.push(`is_active = $${idx}`);
        params.push(data.isActive);
        idx++;
      }
      if (data.sortOrder !== undefined) {
        updates.push(`sort_order = $${idx}`);
        params.push(data.sortOrder);
        idx++;
      }
      params.push(id);
      const result = await pool.query(
        `UPDATE pricing_categories SET ${updates.join(", ")} WHERE id = $${idx} RETURNING *`,
        params,
      );
      if (result.rowCount === 0)
        return res.status(404).json({ error: "Category not found" });
      res.json(result.rows[0]);
    } catch (error) {
      console.error("Error updating pricing category:", error);
      res.status(500).json({ error: "Kunne ikke oppdatere kategori" });
    }
  });

  app.delete("/api/pricing/categories/:id", async (req, res) => {
    try {
      const result = await pool.query(
        "DELETE FROM pricing_categories WHERE id = $1 RETURNING id",
        [req.params.id],
      );
      if (result.rowCount === 0)
        return res.status(404).json({ error: "Category not found" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Kunne ikke slette kategori" });
    }
  });

  // ============================================
  // Pricing Services (DB: pricing_services)
  // ============================================

  app.get("/api/pricing/services/:userId", async (req, res) => {
    try {
      const result = await pool.query(
        "SELECT * FROM pricing_services WHERE user_id = $1 ORDER BY created_at",
        [req.params.userId],
      );
      res.json(
        result.rows.map((r: any) => ({
          id: r.id.toString(),
          userId: r.user_id,
          profession: r.profession,
          categoryId: r.category_id?.toString(),
          serviceName: r.service_name,
          name: r.service_name,
          description: r.description,
          basePrice: parseFloat(r.base_price || "0"),
          priceType: r.price_type,
          unit: r.unit,
          minimumQuantity: r.minimum_quantity,
          maximumQuantity: r.maximum_quantity,
          isVisible: r.is_visible,
          isActive: r.is_active,
          createdAt: r.created_at,
        })),
      );
    } catch (error) {
      console.error("Error fetching pricing services:", error);
      res.status(500).json({ error: "Kunne ikke hente tjenester" });
    }
  });

  app.post("/api/pricing/services", async (req, res) => {
    try {
      const {
        userId,
        profession,
        categoryId,
        serviceName,
        name,
        description,
        basePrice,
        priceType,
        unit,
        minimumQuantity,
        maximumQuantity,
      } = req.body;
      const result = await pool.query(
        `INSERT INTO pricing_services (user_id, profession, category_id, service_name, description, base_price, price_type, unit, minimum_quantity, maximum_quantity, is_visible, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, true) RETURNING *`,
        [
          userId,
          profession || "fotograf",
          categoryId || null,
          serviceName || name,
          description || "",
          basePrice || 0,
          priceType || "fixed",
          unit || "stk",
          minimumQuantity || 1,
          maximumQuantity || null,
        ],
      );
      res.json(result.rows[0]);
    } catch (error) {
      console.error("Error creating pricing service:", error);
      res.status(500).json({ error: "Kunne ikke opprette tjeneste" });
    }
  });

  app.put("/api/pricing/services/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const data = req.body;
      const updates: string[] = [];
      const params: any[] = [];
      let idx = 1;
      if (data.serviceName !== undefined) {
        updates.push(`service_name = $${idx++}`);
        params.push(data.serviceName);
      }
      if (data.name !== undefined) {
        updates.push(`service_name = $${idx++}`);
        params.push(data.name);
      }
      if (data.description !== undefined) {
        updates.push(`description = $${idx++}`);
        params.push(data.description);
      }
      if (data.basePrice !== undefined) {
        updates.push(`base_price = $${idx++}`);
        params.push(data.basePrice);
      }
      if (data.priceType !== undefined) {
        updates.push(`price_type = $${idx++}`);
        params.push(data.priceType);
      }
      if (data.unit !== undefined) {
        updates.push(`unit = $${idx++}`);
        params.push(data.unit);
      }
      if (data.isActive !== undefined) {
        updates.push(`is_active = $${idx++}`);
        params.push(data.isActive);
      }
      if (data.isVisible !== undefined) {
        updates.push(`is_visible = $${idx++}`);
        params.push(data.isVisible);
      }
      if (updates.length === 0) return res.json({ message: "Ingen endringer" });
      params.push(id);
      const result = await pool.query(
        `UPDATE pricing_services SET ${updates.join(", ")} WHERE id = $${idx} RETURNING *`,
        params,
      );
      if (result.rowCount === 0)
        return res.status(404).json({ error: "Service not found" });
      res.json(result.rows[0]);
    } catch (error) {
      res.status(500).json({ error: "Kunne ikke oppdatere tjeneste" });
    }
  });

  app.delete("/api/pricing/services/:id", async (req, res) => {
    try {
      const result = await pool.query(
        "DELETE FROM pricing_services WHERE id = $1 RETURNING id",
        [req.params.id],
      );
      if (result.rowCount === 0)
        return res.status(404).json({ error: "Service not found" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Kunne ikke slette tjeneste" });
    }
  });

  // ============================================
  // Pricing Packages (DB: pricing_packages + packages)
  // ============================================

  // GET /api/pricing/packages — returns ALL packages (used by PriceAdministration without userId)
  app.get("/api/pricing/packages", async (req, res) => {
    try {
      const userId = req.query.userId || getPricingUserId(req);
      let result;
      if (userId) {
        result = await pool.query(
          `SELECT id::text, user_id, package_name AS name, description, base_price AS "basePrice", 
           discount_percentage AS "discountPercentage", included_services AS "includedServices",
           is_visible AS "isVisible", is_active AS "isActive", profession, created_at AS "createdAt"
           FROM pricing_packages WHERE user_id = $1 ORDER BY created_at DESC`,
          [userId],
        );
      } else {
        // Return from both pricing_packages and packages tables
        result = await pool.query(
          `SELECT id::text, user_id AS "userId", package_name AS name, description, base_price AS "basePrice",
           discount_percentage AS "discountPercentage", included_services AS inclusions,
           is_visible AS "isVisible", is_active AS "isActive", profession, created_at AS "createdAt"
           FROM pricing_packages ORDER BY created_at DESC
           LIMIT 50`,
        );
      }
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching pricing packages:", error);
      res.status(500).json({ error: "Kunne ikke hente pakker" });
    }
  });

  app.get("/api/pricing/packages/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      // Combine data from pricing_packages and packages tables
      const ppResult = await pool.query(
        `SELECT id::text, user_id AS "userId", package_name AS name, description, base_price AS "basePrice",
         discount_percentage AS "discountPercentage", included_services AS inclusions,
         is_visible AS "isVisible", is_active AS "isActive", profession, created_at AS "createdAt"
         FROM pricing_packages WHERE user_id = $1 ORDER BY created_at DESC`,
        [userId],
      );
      const pkgResult = await pool.query(
        `SELECT id::text, user_id AS "userId", name, description, price AS "basePrice", category,
         hours_included AS "hoursIncluded", deliverables, inclusions, popular, active AS "isActive",
         profession, created_at AS "createdAt"
         FROM packages WHERE user_id = $1 AND active = true ORDER BY created_at DESC`,
        [userId],
      );
      res.json([...ppResult.rows, ...pkgResult.rows]);
    } catch (error) {
      console.error("Error fetching packages for user:", error);
      res.status(500).json({ error: "Kunne ikke hente pakker" });
    }
  });

  app.post("/api/pricing/packages", async (req, res) => {
    try {
      const {
        userId,
        name,
        packageName,
        description,
        basePrice,
        discountPercentage,
        includedServices,
        profession,
      } = req.body;
      const result = await pool.query(
        `INSERT INTO pricing_packages (user_id, package_name, description, base_price, discount_percentage, included_services, profession, is_visible, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, true, true, NOW(), NOW()) RETURNING *`,
        [
          userId,
          packageName || name,
          description || "",
          basePrice || 0,
          discountPercentage || 0,
          JSON.stringify(includedServices || []),
          profession || "fotograf",
        ],
      );
      const r = result.rows[0];
      res.json({
        id: r.id,
        userId: r.user_id,
        name: r.package_name,
        description: r.description,
        basePrice: parseFloat(r.base_price),
        discountPercentage: parseFloat(r.discount_percentage),
        includedServices: r.included_services,
        profession: r.profession,
        createdAt: r.created_at,
      });
    } catch (error) {
      console.error("Error creating package:", error);
      res.status(500).json({ error: "Kunne ikke opprette pakke" });
    }
  });

  app.put("/api/pricing/packages/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const data = req.body;
      const updates: string[] = ["updated_at = NOW()"];
      const params: any[] = [];
      let idx = 1;
      if (data.name !== undefined || data.packageName !== undefined) {
        updates.push(`package_name = $${idx++}`);
        params.push(data.packageName || data.name);
      }
      if (data.description !== undefined) {
        updates.push(`description = $${idx++}`);
        params.push(data.description);
      }
      if (data.basePrice !== undefined) {
        updates.push(`base_price = $${idx++}`);
        params.push(data.basePrice);
      }
      if (data.discountPercentage !== undefined) {
        updates.push(`discount_percentage = $${idx++}`);
        params.push(data.discountPercentage);
      }
      if (data.includedServices !== undefined) {
        updates.push(`included_services = $${idx++}::jsonb`);
        params.push(JSON.stringify(data.includedServices));
      }
      if (data.isActive !== undefined) {
        updates.push(`is_active = $${idx++}`);
        params.push(data.isActive);
      }
      if (data.isVisible !== undefined) {
        updates.push(`is_visible = $${idx++}`);
        params.push(data.isVisible);
      }
      params.push(id);
      const result = await pool.query(
        `UPDATE pricing_packages SET ${updates.join(", ")} WHERE id = $${idx} RETURNING *`,
        params,
      );
      if (result.rowCount === 0)
        return res.status(404).json({ error: "Package not found" });
      res.json(result.rows[0]);
    } catch (error) {
      res.status(500).json({ error: "Kunne ikke oppdatere pakke" });
    }
  });

  app.delete("/api/pricing/packages/:id", async (req, res) => {
    try {
      // Try pricing_packages first, then packages
      let result = await pool.query(
        "DELETE FROM pricing_packages WHERE id = $1 RETURNING id",
        [req.params.id],
      );
      if (result.rowCount === 0) {
        result = await pool.query(
          "DELETE FROM packages WHERE id = $1 RETURNING id",
          [parseInt(req.params.id) || 0],
        );
      }
      if (result.rowCount === 0)
        return res.status(404).json({ error: "Package not found" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Kunne ikke slette pakke" });
    }
  });

  // ============================================
  // Customer Pricing (DB: customer_pricing)
  // ============================================

  app.get("/api/pricing/customer-pricing/:userId", async (req, res) => {
    try {
      const result = await pool.query(
        "SELECT * FROM customer_pricing WHERE user_id = $1 ORDER BY created_at",
        [req.params.userId],
      );
      res.json(
        result.rows.map((r: any) => ({
          id: r.id.toString(),
          userId: r.user_id,
          customerId: r.customer_id,
          serviceItemId: r.service_item_id?.toString(),
          customPrice: parseFloat(r.custom_price || "0"),
          discountType: r.discount_type,
          discountValue: parseFloat(r.discount_value || "0"),
          notes: r.notes,
          isActive: r.is_active,
          validFrom: r.valid_from,
          validUntil: r.valid_until,
          createdAt: r.created_at,
        })),
      );
    } catch (error) {
      res.status(500).json({ error: "Kunne ikke hente kundepriser" });
    }
  });

  app.post("/api/pricing/customer-pricing", async (req, res) => {
    try {
      const {
        userId,
        customerId,
        serviceItemId,
        customPrice,
        discountType,
        discountValue,
        notes,
        validFrom,
        validUntil,
      } = req.body;
      const result = await pool.query(
        `INSERT INTO customer_pricing (user_id, customer_id, service_item_id, custom_price, discount_type, discount_value, notes, valid_from, valid_until, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, NOW(), NOW()) RETURNING *`,
        [
          userId,
          customerId,
          serviceItemId || 0,
          customPrice || 0,
          discountType || "fixed",
          discountValue || 0,
          notes || "",
          validFrom || null,
          validUntil || null,
        ],
      );
      res.json(result.rows[0]);
    } catch (error) {
      console.error("Error creating customer pricing:", error);
      res.status(500).json({ error: "Kunne ikke opprette kundepris" });
    }
  });

  app.put("/api/pricing/customer-pricing/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const data = req.body;
      const updates: string[] = ["updated_at = NOW()"];
      const params: any[] = [];
      let idx = 1;
      if (data.customPrice !== undefined) {
        updates.push(`custom_price = $${idx++}`);
        params.push(data.customPrice);
      }
      if (data.discountType !== undefined) {
        updates.push(`discount_type = $${idx++}`);
        params.push(data.discountType);
      }
      if (data.discountValue !== undefined) {
        updates.push(`discount_value = $${idx++}`);
        params.push(data.discountValue);
      }
      if (data.notes !== undefined) {
        updates.push(`notes = $${idx++}`);
        params.push(data.notes);
      }
      if (data.isActive !== undefined) {
        updates.push(`is_active = $${idx++}`);
        params.push(data.isActive);
      }
      params.push(id);
      const result = await pool.query(
        `UPDATE customer_pricing SET ${updates.join(", ")} WHERE id = $${idx} RETURNING *`,
        params,
      );
      if (result.rowCount === 0)
        return res.status(404).json({ error: "Customer pricing not found" });
      res.json(result.rows[0]);
    } catch (error) {
      res.status(500).json({ error: "Kunne ikke oppdatere kundepris" });
    }
  });

  app.delete("/api/pricing/customer-pricing/:id", async (req, res) => {
    try {
      const result = await pool.query(
        "DELETE FROM customer_pricing WHERE id = $1 RETURNING id",
        [req.params.id],
      );
      if (result.rowCount === 0)
        return res.status(404).json({ error: "Customer pricing not found" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Kunne ikke slette kundepris" });
    }
  });
}
