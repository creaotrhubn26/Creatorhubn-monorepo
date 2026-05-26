import express from "express";
import type { Pool } from "pg";
import crypto from "crypto";

export interface UniversalVendorShowcaseRoutesDeps {
  app: express.Application;
  requireUserSession: (req: any, res: any) => any;
  pool: Pool;
}

export function setupUniversalVendorShowcaseRoutes(
  deps: UniversalVendorShowcaseRoutesDeps,
): void {
  const { app, requireUserSession, pool } = deps;

  app.get(
    "/api/universal-vendor-showcase/:vendorType/:vendorName",
    async (req, res) => {
      try {
        const { vendorType, vendorName } = req.params;
        const { category, search, sort } = req.query;

        let query = "SELECT * FROM vendor_showcase_products WHERE 1=1";
        const params: any[] = [];
        let paramIdx = 1;

        query += ` AND (vendor_name = $${paramIdx} OR product_type = $${paramIdx + 1})`;
        params.push(vendorName, vendorType);
        paramIdx += 2;

        if (category && category !== "all") {
          query += ` AND category = $${paramIdx}`;
          params.push(category);
          paramIdx++;
        }
        if (search) {
          query += ` AND (product_name ILIKE $${paramIdx} OR description ILIKE $${paramIdx} OR name ILIKE $${paramIdx})`;
          params.push(`%${search}%`);
          paramIdx++;
        }

        switch (sort) {
          case "newest":
            query += " ORDER BY created_at DESC";
            break;
          case "price_low":
            query += " ORDER BY price ASC";
            break;
          case "price_high":
            query += " ORDER BY price DESC";
            break;
          case "rating":
            query += " ORDER BY average_rating DESC";
            break;
          default:
            query += " ORDER BY download_count DESC";
        }

        const result = await pool.query(query, params);

        const products = result.rows.map((row: any) => ({
          id: String(row.id),
          name: row.product_name || row.name || "",
          vendor: row.vendor_name || vendorName,
          category: row.category || "",
          version: row.version || "1.0.0",
          price: Number(row.price) || 0,
          currency: row.currency || "NOK",
          description: row.description || "",
          imageUrl: row.image_url || "",
          downloadUrl: row.download_url || "",
          demoUrl: row.demo_url || "",
          downloads: row.download_count || 0,
          rating: Number(row.average_rating) || 0,
          reviews: row.review_count || 0,
          tags: row.tags || [],
          featured: row.featured || false,
          status: row.status || "active",
          releaseDate:
            row.release_date?.toISOString?.() ||
            row.created_at?.toISOString?.() ||
            new Date().toISOString(),
          requirements: row.requirements || [],
          screenshots: row.screenshots || [],
          model3dUrl: row.model_3d_url || "",
        }));

        res.json(products);
      } catch (error) {
        console.error("Error fetching vendor showcase products:", error);
        res.status(500).json({ error: "Kunne ikke hente produkter" });
      }
    },
  );

  app.get(
    "/api/universal-vendor-showcase-stats/:vendorType/:vendorName",
    async (req, res) => {
      try {
        const { vendorName } = req.params;

        const result = await pool.query(
          "SELECT * FROM vendor_showcase_stats WHERE vendor_id = $1 OR vendor_id LIKE $2 LIMIT 1",
          [vendorName, `%${vendorName}%`],
        );

        if (result.rowCount && result.rowCount > 0) {
          res.json(result.rows[0]);
        } else {
          const productCount = await pool.query(
            "SELECT COUNT(*) as total FROM vendor_showcase_products WHERE vendor_name = $1",
            [vendorName],
          );
          res.json({
            total_products: Number(productCount.rows[0].total) || 0,
            total_downloads: 0,
            total_revenue: 0,
            average_rating: 0,
            featured_products: 0,
            active_products: Number(productCount.rows[0].total) || 0,
            popularity_score: 0,
          });
        }
      } catch (error) {
        console.error("Error fetching vendor showcase stats:", error);
        res.status(500).json({ error: "Kunne ikke hente statistikk" });
      }
    },
  );

  app.post("/api/universal-vendor-showcase/product", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const {
        vendorId,
        vendorName: vName,
        productType,
        name,
        category,
        version,
        price,
        currency,
        description,
        imageUrl,
        downloadUrl,
        demoUrl,
        tags,
        featured,
        status,
        requirements,
        screenshots,
        model3dUrl,
      } = req.body;
      const now = new Date().toISOString();
      const result = await pool.query(
        `INSERT INTO vendor_showcase_products (vendor_id, vendor_name, product_name, product_type, name, category, version, price, currency, description, image_url, download_url, demo_url, tags, featured, status, requirements, screenshots, model_3d_url, download_count, average_rating, review_count, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, 0, 0, 0, $20::timestamp, $21::timestamp) RETURNING *`,
        [
          vendorId || "",
          vName || "",
          name || "",
          productType || "",
          name || "",
          category || "",
          version || "1.0.0",
          price || 0,
          currency || "NOK",
          description || "",
          imageUrl || "",
          downloadUrl || "",
          demoUrl || "",
          tags || "{}",
          featured || false,
          status || "active",
          requirements || "{}",
          screenshots || "{}",
          model3dUrl || "",
          now,
          now,
        ],
      );
      const row = result.rows[0];
      res.status(201).json({
        id: String(row.id),
        name: row.product_name,
        vendor: row.vendor_name,
        category: row.category,
        price: Number(row.price),
        status: row.status,
      });
    } catch (error) {
      console.error("Error creating vendor product:", error);
      res.status(500).json({ error: "Kunne ikke opprette produkt" });
    }
  });

  app.put(
    "/api/universal-vendor-showcase/product/:id",
    async (req, res) => {
    if (!requireUserSession(req, res)) return;
      try {
        const { id } = req.params;
        const updates = req.body;
        const setClauses: string[] = [];
        const params: any[] = [];
        let paramIdx = 1;

        const fieldMap: Record<string, string> = {
          name: "product_name",
          category: "category",
          version: "version",
          price: "price",
          currency: "currency",
          description: "description",
          imageUrl: "image_url",
          downloadUrl: "download_url",
          demoUrl: "demo_url",
          tags: "tags",
          featured: "featured",
          status: "status",
          requirements: "requirements",
          screenshots: "screenshots",
          model3dUrl: "model_3d_url",
        };
        for (const [key, col] of Object.entries(fieldMap)) {
          if (updates[key] !== undefined) {
            setClauses.push(`${col} = $${paramIdx}`);
            params.push(updates[key]);
            paramIdx++;
          }
        }
        if (setClauses.length === 0)
          return res.status(400).json({ error: "Ingen felt å oppdatere" });

        setClauses.push(`updated_at = $${paramIdx}::timestamp`);
        params.push(new Date().toISOString());
        paramIdx++;
        params.push(Number(id));

        const result = await pool.query(
          `UPDATE vendor_showcase_products SET ${setClauses.join(", ")} WHERE id = $${paramIdx} RETURNING *`,
          params,
        );
        if (!result.rowCount)
          return res.status(404).json({ error: "Produkt ikke funnet" });
        res.json({ id: String(result.rows[0].id), updated: true });
      } catch (error) {
        console.error("Error updating vendor product:", error);
        res.status(500).json({ error: "Kunne ikke oppdatere produkt" });
      }
    },
  );

  app.delete(
    "/api/universal-vendor-showcase/product/:id",
    async (req, res) => {
    if (!requireUserSession(req, res)) return;
      try {
        const { id } = req.params;
        await pool.query(
          "DELETE FROM vendor_product_downloads WHERE product_id = $1",
          [id],
        );
        await pool.query(
          "DELETE FROM vendor_product_reviews WHERE product_id = $1",
          [id],
        );
        const result = await pool.query(
          "DELETE FROM vendor_showcase_products WHERE id = $1 RETURNING id",
          [Number(id)],
        );
        if (!result.rowCount)
          return res.status(404).json({ error: "Produkt ikke funnet" });
        res.json({ deleted: true, id });
      } catch (error) {
        console.error("Error deleting vendor product:", error);
        res.status(500).json({ error: "Kunne ikke slette produkt" });
      }
    },
  );

  app.patch(
    "/api/universal-vendor-showcase/product/:id/featured",
    async (req, res) => {
    if (!requireUserSession(req, res)) return;
      try {
        const { id } = req.params;
        const result = await pool.query(
          "UPDATE vendor_showcase_products SET featured = NOT featured, updated_at = $1::timestamp WHERE id = $2 RETURNING id, featured",
          [new Date().toISOString(), Number(id)],
        );
        if (!result.rowCount)
          return res.status(404).json({ error: "Produkt ikke funnet" });
        res.json({
          id: String(result.rows[0].id),
          featured: result.rows[0].featured,
        });
      } catch (error) {
        console.error("Error toggling featured:", error);
        res
          .status(500)
          .json({ error: "Kunne ikke endre fremhevet-status" });
      }
    },
  );

  app.post(
    "/api/universal-vendor-showcase/product/:id/download",
    async (req, res) => {
    if (!requireUserSession(req, res)) return;
      try {
        const { id } = req.params;
        const { userId: downloadUserId, userAgent } = req.body;
        const downloadId = crypto.randomUUID();
        const now = new Date().toISOString();

        await pool.query(
          `INSERT INTO vendor_product_downloads (id, product_id, user_id, user_agent, download_date, completed, created_at)
         VALUES ($1, $2, $3, $4, $5::timestamp, true, $6::timestamp)`,
          [downloadId, id, downloadUserId || "", userAgent || "", now, now],
        );

        await pool.query(
          "UPDATE vendor_showcase_products SET download_count = download_count + 1 WHERE id = $1",
          [Number(id)],
        );

        res.json({ tracked: true, downloadId });
      } catch (error) {
        console.error("Error tracking download:", error);
        res
          .status(500)
          .json({ error: "Kunne ikke registrere nedlasting" });
      }
    },
  );
}
