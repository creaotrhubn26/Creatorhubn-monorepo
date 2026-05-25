import express from "express";
import type { Pool } from "pg";
import crypto from "crypto";

export interface CouplesRoutesDeps {
  app: express.Application;
  pool: Pool;
  activeSessions: Map<string, any>;
  buildAdminRoleEntry: (role: string) => { name: string; permissions: any[] };
  persistAuthSession: (
    pool: Pool,
    sessionToken: string,
    sessionData: any,
  ) => Promise<void>;
}

export function setupCouplesRoutes(deps: CouplesRoutesDeps): void {
  const {
    app,
    pool,
    activeSessions,
    buildAdminRoleEntry,
    persistAuthSession,
  } = deps;

  app.post("/api/couples/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email) return res.status(400).json({ error: "E-post er påkrevd" });

      console.log(`[CoupleLogin] Login attempt for email: ${email}`);

      const coupleResult = await pool.query(
        "SELECT id, email, display_name, password, partner_email, wedding_date FROM couple_profiles WHERE email = $1 LIMIT 1",
        [email.toLowerCase().trim()],
      );

      if (!coupleResult.rowCount || coupleResult.rowCount === 0) {
        console.log(`[CoupleLogin] Lookup result: Not found`);
        return res
          .status(401)
          .json({ error: "Ugyldig e-post eller passord" });
      }

      const couple = coupleResult.rows[0];
      console.log(`[CoupleLogin] Lookup result: Found`);

      if (couple.password) {
        const bcrypt = await import("bcrypt");
        const isPasswordHashed = /^\$2[ayb]\$/.test(couple.password);
        let passwordValid = false;

        if (isPasswordHashed) {
          passwordValid = await bcrypt.default.compare(
            password || "",
            couple.password,
          );
        } else {
          passwordValid = password === couple.password;
        }

        if (!passwordValid) {
          return res
            .status(401)
            .json({ error: "Ugyldig e-post eller passord" });
        }
      }

      const userResult = await pool
        .query("SELECT id FROM users WHERE email = $1 LIMIT 1", [
          email.toLowerCase().trim(),
        ])
        .catch(() => ({ rows: [] }));

      const userId = userResult.rows[0]?.id || couple.id;

      const sessionToken = crypto.randomUUID();
      const coupleRoleEntry = buildAdminRoleEntry("couple");
      const sessionData: any = {
        userId,
        email: couple.email,
        name: couple.display_name || email,
        role: "couple" as const,
        roleLabel: coupleRoleEntry.name,
        permissions: coupleRoleEntry.permissions,
        profession: "couple",
        userType: "couple",
        displayName: couple.display_name || email,
        coupleProfileId: couple.id,
        loginAt: new Date().toISOString(),
      };
      activeSessions.set(sessionToken, sessionData);
      await persistAuthSession(pool, sessionToken, sessionData);

      console.log(
        `[CoupleLogin] Success: ${couple.email} (session: ${sessionToken.substring(0, 8)}...)`,
      );

      res.json({
        success: true,
        token: sessionToken,
        user: {
          id: userId,
          email: couple.email,
          name: couple.display_name || email,
          role: "couple",
          coupleProfileId: couple.id,
          displayName: couple.display_name,
          partnerEmail: couple.partner_email,
          weddingDate: couple.wedding_date,
        },
      });
    } catch (error) {
      console.error("[CoupleLogin] Error:", error);
      res.status(500).json({ error: "Innlogging feilet" });
    }
  });

  app.get("/api/couples/projects", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      const session = token ? activeSessions.get(token) : null;
      const coupleEmail = session?.email || (req.query.email as string);

      if (!coupleEmail) {
        return res.status(401).json({ error: "Ikke autentisert" });
      }

      const result = await pool.query(
        `
        SELECT p.id, p.name, p.title, p.description, p.profession, p.status,
               p.client_email, p.client_phone, p.location, p.date, p.event_date,
               p.featured, p.published, p.settings, p.metadata,
               p.created_at, p.updated_at, p.user_id
        FROM legacy.projects p
        WHERE LOWER(p.client_email) = LOWER($1)
        ORDER BY p.created_at DESC
      `,
        [coupleEmail],
      );

      const projects = result.rows.map((r: any) => ({
        id: r.id,
        name: r.name || r.title,
        title: r.title || r.name,
        description: r.description,
        profession: r.profession,
        status: r.status || "active",
        clientEmail: r.client_email,
        clientPhone: r.client_phone,
        location: r.location,
        date: r.date || r.event_date,
        eventDate: r.event_date || r.date,
        featured: r.featured,
        published: r.published,
        settings:
          typeof r.settings === "string"
            ? JSON.parse(r.settings)
            : r.settings,
        metadata:
          typeof r.metadata === "string"
            ? JSON.parse(r.metadata)
            : r.metadata,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        vendorId: r.user_id,
      }));

      res.json(projects);
    } catch (error) {
      console.error("[CoupleProjects] Error:", error);
      res.status(500).json({ error: "Kunne ikke hente prosjekter" });
    }
  });

  app.get("/api/couples/projects/:projectId", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      const session = token ? activeSessions.get(token) : null;
      const coupleEmail = session?.email;

      const result = await pool.query(
        `
        SELECT p.*, v.business_name as vendor_name, v.category_id as vendor_profession
        FROM legacy.projects p
        LEFT JOIN users u ON u.id = p.user_id
        LEFT JOIN vendors v ON LOWER(v.email) = LOWER(u.email)
        WHERE p.id = $1
      `,
        [req.params.projectId],
      );

      if (!result.rowCount) {
        return res.status(404).json({ error: "Prosjekt ikke funnet" });
      }

      const r = result.rows[0];

      if (
        coupleEmail &&
        r.client_email &&
        r.client_email.toLowerCase() !== coupleEmail.toLowerCase()
      ) {
        return res
          .status(403)
          .json({ error: "Ingen tilgang til dette prosjektet" });
      }

      res.json({
        id: r.id,
        name: r.name || r.title,
        title: r.title || r.name,
        description: r.description,
        profession: r.profession,
        status: r.status || "active",
        clientEmail: r.client_email,
        clientPhone: r.client_phone,
        location: r.location,
        date: r.date || r.event_date,
        eventDate: r.event_date || r.date,
        featured: r.featured,
        published: r.published,
        settings:
          typeof r.settings === "string"
            ? JSON.parse(r.settings)
            : r.settings,
        metadata:
          typeof r.metadata === "string"
            ? JSON.parse(r.metadata)
            : r.metadata,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        vendorId: r.user_id,
        vendorName: r.vendor_name,
        vendorProfession: r.vendor_profession,
      });
    } catch (error) {
      console.error("[CoupleProjectDetail] Error:", error);
      res.status(500).json({ error: "Kunne ikke hente prosjekt" });
    }
  });

  app.get("/api/couples/dashboard", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      const session = token ? activeSessions.get(token) : null;
      const coupleEmail = session?.email;

      if (!coupleEmail) {
        return res.status(401).json({ error: "Ikke autentisert" });
      }

      const coupleResult = await pool.query(
        "SELECT id, email, display_name, partner_email, wedding_date, selected_traditions FROM couple_profiles WHERE LOWER(email) = LOWER($1)",
        [coupleEmail],
      );
      const couple = coupleResult.rows[0] || null;

      const projectsResult = await pool.query(
        `
        SELECT p.id, p.name, p.title, p.status, p.location, p.date, p.event_date,
               p.description, p.user_id
        FROM legacy.projects p
        WHERE LOWER(p.client_email) = LOWER($1)
        ORDER BY p.created_at DESC
      `,
        [coupleEmail],
      );

      const vendorUserIds = [
        ...new Set(
          projectsResult.rows.map((p: any) => p.user_id).filter(Boolean),
        ),
      ];
      let vendors: any[] = [];
      if (vendorUserIds.length > 0) {
        const vendorResult = await pool.query(
          `
          SELECT v.id, u.id as user_id, v.business_name, v.category_id, v.location, v.image_url, v.email
          FROM vendors v
          INNER JOIN users u ON LOWER(u.email) = LOWER(v.email)
          WHERE u.id = ANY($1)
        `,
          [vendorUserIds],
        );
        vendors = vendorResult.rows.map((v: any) => ({
          id: v.id,
          userId: v.user_id,
          businessName: v.business_name,
          profession: v.category_id,
          location: v.location,
          profileImage: v.image_url,
          email: v.email,
        }));
      }

      const bookingsResult = await pool
        .query(
          `
        SELECT id, date, client_name, event_type, location, status, created_at
        FROM bookings
        WHERE LOWER(client_email) = LOWER($1)
        ORDER BY date DESC
      `,
          [coupleEmail],
        )
        .catch(() => ({ rows: [] }));

      res.json({
        couple: couple
          ? {
              id: couple.id,
              email: couple.email,
              displayName: couple.display_name,
              partnerEmail: couple.partner_email,
              weddingDate: couple.wedding_date,
              selectedTraditions: couple.selected_traditions,
            }
          : null,
        projects: projectsResult.rows.map((p: any) => ({
          id: p.id,
          name: p.name || p.title,
          title: p.title || p.name,
          status: p.status,
          location: p.location,
          date: p.date || p.event_date,
          description: p.description,
          vendorId: p.user_id,
        })),
        vendors,
        bookings: bookingsResult.rows.map((b: any) => ({
          id: b.id,
          date: b.date,
          clientName: b.client_name,
          eventType: b.event_type,
          location: b.location,
          status: b.status,
          createdAt: b.created_at,
        })),
        stats: {
          totalProjects: projectsResult.rowCount || 0,
          totalVendors: vendors.length,
          totalBookings: bookingsResult.rows.length,
        },
      });
    } catch (error) {
      console.error("[CoupleDashboard] Error:", error);
      res.status(500).json({ error: "Kunne ikke hente dashbord-data" });
    }
  });

  app.get("/api/couples/vendors", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      const session = token ? activeSessions.get(token) : null;
      const coupleEmail = session?.email;

      if (!coupleEmail) {
        return res.status(401).json({ error: "Ikke autentisert" });
      }

      const result = await pool.query(
        `
        SELECT DISTINCT v.id, u.id as user_id, v.business_name, v.category_id, v.location,
               v.image_url, v.description, v.price_range, v.email
        FROM vendors v
        INNER JOIN users u ON LOWER(u.email) = LOWER(v.email)
        INNER JOIN legacy.projects p ON p.user_id = u.id
        WHERE LOWER(p.client_email) = LOWER($1)
      `,
        [coupleEmail],
      );

      const vendors = result.rows.map((v: any) => ({
        id: v.id,
        userId: v.user_id,
        businessName: v.business_name,
        profession: v.category_id,
        location: v.location,
        profileImage: v.image_url,
        description: v.description,
        priceRange: v.price_range,
        email: v.email,
      }));

      res.json(vendors);
    } catch (error) {
      console.error("[CoupleVendors] Error:", error);
      res.status(500).json({ error: "Kunne ikke hente leverandører" });
    }
  });
}
