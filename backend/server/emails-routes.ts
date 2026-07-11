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

  // Eier-oppslag: løs opp sesjonens vendor_email (samme kolonne som
  // client_submissions scopes på). Returnerer null hvis ukjent — kallere
  // MÅ da returnere tomt, aldri falle gjennom til ufiltrert spørring.
  async function resolveVendorEmail(userId: string): Promise<string | null> {
    return (
      (await getCreatorhubUserEmailById(userId)) ||
      (await getVendorEmailById(userId))
    );
  }

  // CustomerInquiryCenter henter submissions som email-meldinger her.
  app.get("/api/emails/recent", async (req, res) => {
    // Sesjons-scope: tidligere tok endepunktet userId fra query UTEN auth,
    // og manglende userId ga INGEN WHERE → alle tenants' forespørsler (PII:
    // navn/e-post/budsjett/beskrivelse) ble lekket til en uautentisert
    // kaller. Nå kreves sesjon og vendor avledes fra den; uten oppslagsbar
    // vendor_email returneres tom liste (aldri ufiltrert).
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      if (!(await hasTable("client_submissions"))) {
        res.json([]);
        return;
      }

      const vendorEmail = await resolveVendorEmail(session.userId);
      if (!vendorEmail) {
        res.json([]);
        return;
      }

      const result = await pool.query(
        "SELECT * FROM client_submissions WHERE vendor_email = $1 ORDER BY submitted_at DESC LIMIT 50",
        [vendorEmail],
      );

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
    // Sesjons-scope (samme grunn som /recent): uten dette lekket
    // aggregerte tellinger på tvers av alle tenants til uautentiserte.
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      if (!(await hasTable("client_submissions"))) {
        res.json({ total: 0, unread: 0, thisWeek: 0 });
        return;
      }

      const vendorEmail = await resolveVendorEmail(session.userId);
      if (!vendorEmail) {
        res.json({ total: 0, unread: 0, thisWeek: 0 });
        return;
      }

      const result = await pool.query(
        `
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE is_read = false OR is_read IS NULL) as unread,
          COUNT(*) FILTER (WHERE submitted_at > NOW() - INTERVAL '7 days') as "thisWeek"
        FROM client_submissions WHERE vendor_email = $1
      `,
        [vendorEmail],
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

  app.get("/api/emails/contacts", async (req, res) => {
    // Sesjons-scope: dette lekket TIDLIGERE HVER klients navn+e-post på
    // tvers av alle vendors (ingen auth, ingen filter). Nå scopet til
    // innlogget vendor via vendor_email.
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      if (!(await hasTable("client_submissions"))) {
        res.json([]);
        return;
      }

      const vendorEmail = await resolveVendorEmail(session.userId);
      if (!vendorEmail) {
        res.json([]);
        return;
      }

      const result = await pool.query(
        `SELECT DISTINCT ON (email) id, name, email
         FROM client_submissions
         WHERE vendor_email = $1 AND email IS NOT NULL AND email != ''
         ORDER BY email, submitted_at DESC`,
        [vendorEmail],
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
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const { emailId, starred } = req.body;
      // Eier-scope vendor_email: emailId er caller-oppgitt — uten filter
      // kunne en innlogget vendor toggle stjerne på en ANNEN vendors
      // forespørsel (cross-tenant write-IDOR).
      const vendorEmail = await resolveVendorEmail(session.userId);
      if (!vendorEmail) return res.json({ success: true });
      await pool.query(
        "UPDATE client_submissions SET is_starred = $1, updated_at = NOW() WHERE id = $2 AND vendor_email = $3",
        [starred, emailId, vendorEmail],
      );
      res.json({ success: true });
    } catch (error) {
      console.error("Error starring email:", error);
      res.status(500).json({ error: "Kunne ikke oppdatere stjerne" });
    }
  });

  app.patch("/api/emails/read", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const { emailId, isRead } = req.body;
      // Eier-scope vendor_email (samme grunn som /star).
      const vendorEmail = await resolveVendorEmail(session.userId);
      if (!vendorEmail) return res.json({ success: true });
      await pool.query(
        "UPDATE client_submissions SET is_read = $1, updated_at = NOW() WHERE id = $2 AND vendor_email = $3",
        [isRead !== false, emailId, vendorEmail],
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
