import express from "express";
import type { Pool } from "pg";

export interface EmailsRoutesDeps {
  app: express.Application;
  requireUserSession: (req: any, res: any) => any;
  pool: Pool;
  hasTable: (tableName: string) => Promise<boolean>;
  getCreatorhubUserEmailById: (userId: string) => Promise<string | null>;
  getVendorEmailById: (userId: string) => Promise<string | null>;
}

export function setupEmailsRoutes(deps: EmailsRoutesDeps): void {
  const {
    app,
    requireUserSession,
    pool,
    hasTable,
    getCreatorhubUserEmailById,
    getVendorEmailById,
  } = deps;

  // CustomerInquiryCenter henter submissions som email-meldinger her.
  app.get("/api/emails/recent", async (req, res) => {
    try {
      if (!(await hasTable("client_submissions"))) {
        res.json([]);
        return;
      }

      const userId =
        typeof req.query.userId === "string" ? req.query.userId : null;

      let vendorEmail: string | null = null;
      if (userId) {
        vendorEmail = await getCreatorhubUserEmailById(userId);
        if (!vendorEmail) {
          vendorEmail = await getVendorEmailById(userId);
        }
      }

      let query = "SELECT * FROM client_submissions";
      const params: any[] = [];
      if (vendorEmail) {
        query += " WHERE vendor_email = $1";
        params.push(vendorEmail);
      }
      query += " ORDER BY submitted_at DESC LIMIT 50";

      const result = await pool.query(query, params);

      const emails = result.rows.map((r: any) => ({
        id: r.id,
        subject: r.project_type
          ? `Forespørsel: ${r.project_type} - ${r.name || r.client_name || "Ukjent"}`
          : `Ny kundeforespørsel fra ${r.name || r.client_name || "Ukjent"}`,
        from: {
          name: r.name || r.client_name || "Ukjent",
          email: r.email || r.client_email || "",
        },
        timestamp: r.submitted_at || r.created_at,
        isRead: r.is_read || false,
        isStarred: r.is_starred || false,
        category: r.category || "inquiry",
        priority:
          r.priority === "urgent" || r.priority === "high"
            ? "high"
            : "normal",
        isCustomerInquiry: true,
        body: r.description || "",
        eventDate: r.event_date || null,
        budget: r.budget ? parseFloat(r.budget) : null,
        location: r.location || "",
      }));

      res.json(emails);
    } catch (error) {
      console.error("Error fetching emails:", error);
      res.json([]);
    }
  });

  app.get("/api/emails/stats", async (req, res) => {
    try {
      if (!(await hasTable("client_submissions"))) {
        res.json({ total: 0, unread: 0, thisWeek: 0 });
        return;
      }

      const userId =
        typeof req.query.userId === "string" ? req.query.userId : null;

      let vendorEmail: string | null = null;
      if (userId) {
        vendorEmail = await getCreatorhubUserEmailById(userId);
        if (!vendorEmail) {
          vendorEmail = await getVendorEmailById(userId);
        }
      }

      let whereClause = "";
      const params: any[] = [];
      if (vendorEmail) {
        whereClause = " WHERE vendor_email = $1";
        params.push(vendorEmail);
      }

      const result = await pool.query(
        `
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE is_read = false OR is_read IS NULL) as unread,
          COUNT(*) FILTER (WHERE submitted_at > NOW() - INTERVAL '7 days') as "thisWeek"
        FROM client_submissions${whereClause}
      `,
        params,
      );

      const stats = result.rows[0];
      res.json({
        total: parseInt(stats.total),
        unread: parseInt(stats.unread),
        thisWeek: parseInt(stats.thisWeek),
      });
    } catch (error) {
      console.error("Error fetching email stats:", error);
      res.json({ total: 0, unread: 0, thisWeek: 0 });
    }
  });

  app.get("/api/emails/contacts", async (_req, res) => {
    try {
      if (!(await hasTable("client_submissions"))) {
        res.json([]);
        return;
      }

      const result = await pool.query(
        `SELECT DISTINCT ON (email) id, name, email
         FROM client_submissions
         WHERE email IS NOT NULL AND email != ''
         ORDER BY email, submitted_at DESC`,
      );
      res.json(
        result.rows.map((r: any) => ({
          id: r.id,
          name: r.name || "Ukjent",
          email: r.email,
        })),
      );
    } catch (error) {
      console.error("Error fetching contacts:", error);
      res.json([]);
    }
  });

  app.patch("/api/emails/star", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const { emailId, starred } = req.body;
      await pool.query(
        "UPDATE client_submissions SET is_starred = $1, updated_at = NOW() WHERE id = $2",
        [starred, emailId],
      );
      res.json({ success: true });
    } catch (error) {
      console.error("Error starring email:", error);
      res.status(500).json({ error: "Kunne ikke oppdatere stjerne" });
    }
  });

  app.patch("/api/emails/read", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const { emailId, isRead } = req.body;
      await pool.query(
        "UPDATE client_submissions SET is_read = $1, updated_at = NOW() WHERE id = $2",
        [isRead !== false, emailId],
      );
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking email read:", error);
      res
        .status(500)
        .json({ error: "Kunne ikke oppdatere leststatus" });
    }
  });
}
