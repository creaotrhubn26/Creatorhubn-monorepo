import express from "express";
import type { Pool } from "pg";
import crypto from "crypto";

export interface InspirationsRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireUserSession: (req: any, res: any) => any;
}

export function setupInspirationsRoutes(
  deps: InspirationsRoutesDeps,
): void {
  const { app, pool, requireUserSession } = deps;

  app.get("/api/inspirations/categories", async (_req, res) => {
    try {
      const result = await pool.query(
        "SELECT * FROM inspiration_categories ORDER BY sort_order ASC",
      );
      res.json({ categories: result.rows });
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ error: "Kunne ikke hente kategorier" });
    }
  });

  // MUST be BEFORE /:vendorId routes to avoid shadowing
  app.get("/api/inspirations/public/browse", async (req, res) => {
    try {
      const { category_id, limit: queryLimit, offset } = req.query;
      let query = `SELECT i.*, ic.name as category_name, ic.icon as category_icon,
                   (SELECT COUNT(*) FROM inspiration_media im WHERE im.inspiration_id = i.id) as media_count
                   FROM inspirations i
                   LEFT JOIN inspiration_categories ic ON i.category_id = ic.id
                   WHERE i.status = 'approved'`;
      const params: any[] = [];
      let paramIdx = 1;
      if (category_id) {
        query += ` AND i.category_id = $${paramIdx}`;
        params.push(category_id);
        paramIdx++;
      }
      query += ` ORDER BY i.created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
      params.push(Number(queryLimit) || 20, Number(offset) || 0);
      const result = await pool.query(query, params);
      const countResult = await pool.query(
        `SELECT COUNT(*) FROM inspirations WHERE status = 'approved'${category_id ? " AND category_id = $1" : ""}`,
        category_id ? [category_id] : [],
      );
      res.json({
        inspirations: result.rows,
        total: Number(countResult.rows[0].count),
        limit: Number(queryLimit) || 20,
        offset: Number(offset) || 0,
      });
    } catch (error) {
      console.error("Error browsing inspirations:", error);
      res.status(500).json({ error: "Kunne ikke hente inspirasjoner" });
    }
  });

  // MUST be BEFORE /:vendorId routes to avoid shadowing
  app.post(
    "/api/inspirations/public/:inspirationId/inquiry",
    async (req, res) => {
      try {
        const { inspirationId } = req.params;
        const inspiration = await pool.query(
          "SELECT id, vendor_id FROM inspirations WHERE id = $1 AND status = $2",
          [inspirationId, "approved"],
        );
        if (!inspiration.rowCount) {
          return res.status(404).json({ error: "Inspirasjon ikke funnet" });
        }
        const { name, email, phone, message, wedding_date } = req.body;
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        await pool.query(
          `INSERT INTO inspiration_inquiries (id, inspiration_id, vendor_id, name, email, phone, message, wedding_date, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::timestamp)`,
          [
            id,
            inspirationId,
            inspiration.rows[0].vendor_id,
            name || "",
            email || "",
            phone || "",
            message || "",
            wedding_date || "",
            "new",
            now,
          ],
        );
        res.status(201).json({
          id,
          status: "new",
          message: "Forespørsel sendt",
        });
      } catch (error) {
        console.error("Error submitting inquiry:", error);
        res.status(500).json({ error: "Kunne ikke sende forespørsel" });
      }
    },
  );

  app.get("/api/inspirations/:vendorId", async (req, res) => {
    try {
      const { vendorId } = req.params;
      const { status, category_id } = req.query;
      let query =
        "SELECT i.*, ic.name as category_name, ic.icon as category_icon FROM inspirations i LEFT JOIN inspiration_categories ic ON i.category_id = ic.id WHERE i.vendor_id = $1";
      const params: any[] = [vendorId];
      let paramIdx = 2;
      if (status) {
        query += ` AND i.status = $${paramIdx}`;
        params.push(status);
        paramIdx++;
      }
      if (category_id) {
        query += ` AND i.category_id = $${paramIdx}`;
        params.push(category_id);
        paramIdx++;
      }
      query += " ORDER BY i.created_at DESC";
      const result = await pool.query(query, params);
      res.json({ inspirations: result.rows, total: result.rowCount });
    } catch (error) {
      console.error("Error fetching inspirations:", error);
      res.status(500).json({ error: "Kunne ikke hente inspirasjoner" });
    }
  });

  app.get(
    "/api/inspirations/:vendorId/:inspirationId",
    async (req, res) => {
      try {
        const { vendorId, inspirationId } = req.params;
        const inspiration = await pool.query(
          `SELECT i.*, ic.name as category_name, ic.icon as category_icon
           FROM inspirations i LEFT JOIN inspiration_categories ic ON i.category_id = ic.id
           WHERE i.id = $1 AND i.vendor_id = $2`,
          [inspirationId, vendorId],
        );
        if (!inspiration.rowCount) {
          return res
            .status(404)
            .json({ error: "Inspirasjon ikke funnet" });
        }
        const media = await pool.query(
          "SELECT * FROM inspiration_media WHERE inspiration_id = $1 ORDER BY sort_order ASC, created_at ASC",
          [inspirationId],
        );
        const inquiries = await pool.query(
          "SELECT * FROM inspiration_inquiries WHERE inspiration_id = $1 ORDER BY created_at DESC",
          [inspirationId],
        );
        res.json({
          ...inspiration.rows[0],
          media: media.rows,
          inquiries: inquiries.rows,
        });
      } catch (error) {
        console.error("Error fetching inspiration:", error);
        res.status(500).json({ error: "Kunne ikke hente inspirasjon" });
      }
    },
  );

  app.post("/api/inspirations/:vendorId", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const { vendorId } = req.params;
      const {
        category_id,
        title,
        description,
        cover_image_url,
        price_summary,
        price_min,
        price_max,
        currency,
        website_url,
        inquiry_email,
        inquiry_phone,
        cta_label,
        cta_url,
        allow_inquiry_form,
      } = req.body;
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      await pool.query(
        `INSERT INTO inspirations (id, vendor_id, category_id, title, description, cover_image_url, price_summary, price_min, price_max, currency, website_url, inquiry_email, inquiry_phone, cta_label, cta_url, allow_inquiry_form, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18::timestamp, $19::timestamp)`,
        [
          id,
          vendorId,
          category_id || null,
          title || "Ny inspirasjon",
          description || "",
          cover_image_url || "",
          price_summary || "",
          price_min || 0,
          price_max || 0,
          currency || "NOK",
          website_url || "",
          inquiry_email || "",
          inquiry_phone || "",
          cta_label || "Kontakt meg",
          cta_url || "",
          allow_inquiry_form !== false,
          "draft",
          now,
          now,
        ],
      );
      res.status(201).json({
        id,
        vendor_id: vendorId,
        category_id,
        title,
        description,
        cover_image_url,
        price_summary,
        price_min,
        price_max,
        currency,
        website_url,
        inquiry_email,
        inquiry_phone,
        cta_label,
        cta_url,
        allow_inquiry_form: allow_inquiry_form !== false,
        status: "draft",
        created_at: now,
        updated_at: now,
      });
    } catch (error) {
      console.error("Error creating inspiration:", error);
      res.status(500).json({ error: "Kunne ikke opprette inspirasjon" });
    }
  });

  app.patch(
    "/api/inspirations/:vendorId/:inspirationId",
    async (req, res) => {
      if (!requireUserSession(req, res)) return;
      try {
        const { vendorId, inspirationId } = req.params;
        const updates = req.body;
        const allowedFields = [
          "category_id",
          "title",
          "description",
          "cover_image_url",
          "price_summary",
          "price_min",
          "price_max",
          "currency",
          "website_url",
          "inquiry_email",
          "inquiry_phone",
          "cta_label",
          "cta_url",
          "allow_inquiry_form",
          "status",
          "rejection_reason",
        ];
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
          return res
            .status(400)
            .json({ error: "Ingen felter å oppdatere" });
        }
        setClauses.push(`updated_at = $${paramIdx}::timestamp`);
        values.push(new Date().toISOString());
        paramIdx++;
        values.push(inspirationId, vendorId);
        const result = await pool.query(
          `UPDATE inspirations SET ${setClauses.join(", ")} WHERE id = $${paramIdx} AND vendor_id = $${paramIdx + 1} RETURNING *`,
          values,
        );
        if (!result.rowCount) {
          return res
            .status(404)
            .json({ error: "Inspirasjon ikke funnet" });
        }
        res.json(result.rows[0]);
      } catch (error) {
        console.error("Error updating inspiration:", error);
        res
          .status(500)
          .json({ error: "Kunne ikke oppdatere inspirasjon" });
      }
    },
  );

  app.delete(
    "/api/inspirations/:vendorId/:inspirationId",
    async (req, res) => {
      if (!requireUserSession(req, res)) return;
      try {
        const { vendorId, inspirationId } = req.params;
        await pool.query(
          "DELETE FROM inspiration_media WHERE inspiration_id = $1",
          [inspirationId],
        );
        await pool.query(
          "DELETE FROM inspiration_inquiries WHERE inspiration_id = $1",
          [inspirationId],
        );
        const result = await pool.query(
          "DELETE FROM inspirations WHERE id = $1 AND vendor_id = $2 RETURNING id",
          [inspirationId, vendorId],
        );
        if (!result.rowCount) {
          return res
            .status(404)
            .json({ error: "Inspirasjon ikke funnet" });
        }
        res.json({ deleted: true, id: inspirationId });
      } catch (error) {
        console.error("Error deleting inspiration:", error);
        res.status(500).json({ error: "Kunne ikke slette inspirasjon" });
      }
    },
  );

  app.post(
    "/api/inspirations/:vendorId/:inspirationId/media",
    async (req, res) => {
      if (!requireUserSession(req, res)) return;
      try {
        const { vendorId, inspirationId } = req.params;
        const inspiration = await pool.query(
          "SELECT id FROM inspirations WHERE id = $1 AND vendor_id = $2",
          [inspirationId, vendorId],
        );
        if (!inspiration.rowCount) {
          return res
            .status(404)
            .json({ error: "Inspirasjon ikke funnet" });
        }
        const { type, url, caption, sort_order } = req.body;
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        await pool.query(
          `INSERT INTO inspiration_media (id, inspiration_id, type, url, caption, sort_order, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7::timestamp)`,
          [
            id,
            inspirationId,
            type || "image",
            url || "",
            caption || "",
            sort_order || 0,
            now,
          ],
        );
        res.status(201).json({
          id,
          inspiration_id: inspirationId,
          type: type || "image",
          url,
          caption,
          sort_order: sort_order || 0,
          created_at: now,
        });
      } catch (error) {
        console.error("Error adding media:", error);
        res.status(500).json({ error: "Kunne ikke legge til media" });
      }
    },
  );

  app.delete(
    "/api/inspirations/:vendorId/:inspirationId/media/:mediaId",
    async (req, res) => {
      if (!requireUserSession(req, res)) return;
      try {
        const { vendorId, inspirationId, mediaId } = req.params;
        const inspiration = await pool.query(
          "SELECT id FROM inspirations WHERE id = $1 AND vendor_id = $2",
          [inspirationId, vendorId],
        );
        if (!inspiration.rowCount) {
          return res
            .status(404)
            .json({ error: "Inspirasjon ikke funnet" });
        }
        const result = await pool.query(
          "DELETE FROM inspiration_media WHERE id = $1 AND inspiration_id = $2 RETURNING id",
          [mediaId, inspirationId],
        );
        if (!result.rowCount) {
          return res.status(404).json({ error: "Media ikke funnet" });
        }
        res.json({ deleted: true, id: mediaId });
      } catch (error) {
        console.error("Error removing media:", error);
        res.status(500).json({ error: "Kunne ikke fjerne media" });
      }
    },
  );

  app.get(
    "/api/inspirations/:vendorId/inquiries/all",
    async (req, res) => {
      try {
        const { vendorId } = req.params;
        const result = await pool.query(
          `SELECT iq.*, i.title as inspiration_title
           FROM inspiration_inquiries iq
           JOIN inspirations i ON iq.inspiration_id = i.id
           WHERE iq.vendor_id = $1
           ORDER BY iq.created_at DESC`,
          [vendorId],
        );
        res.json({ inquiries: result.rows, total: result.rowCount });
      } catch (error) {
        console.error("Error fetching inquiries:", error);
        res.status(500).json({ error: "Kunne ikke hente forespørsler" });
      }
    },
  );
}
