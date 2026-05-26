import express from "express";
import type { Pool } from "pg";

export interface AdminProvisioningRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireAdminSession: (req: any, res: any) => any;
}

export function setupAdminProvisioningRoutes(
  deps: AdminProvisioningRoutesDeps,
): void {
  const { app, pool, requireAdminSession } = deps;

  app.get("/api/admin-provisioning/users", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const result = await pool.query(
        `SELECT id, email, first_name, last_name, profession, company_name,
                organization_number, status, created_at, updated_at, user_journey_status,
                phone_number, website, admin_notes, processed_at, onboarding_completed_at
         FROM invite_requests ORDER BY created_at DESC`,
      );
      const users = result.rows.map((r: any) => ({
        id: r.id,
        email: r.email,
        firstName: r.first_name || "",
        lastName: r.last_name || "",
        profession: r.profession,
        companyName: r.company_name || "",
        organizationNumber: r.organization_number || "",
        userType: r.profession,
        role:
          r.profession === "enterprise"
            ? "enterprise_admin"
            : r.profession === "vendor"
              ? "vendor"
              : "user",
        isActive: r.status === "approved",
        status: r.status,
        createdAt: r.created_at,
        approvedAt: r.processed_at,
        onboardingCompleted: r.onboarding_completed_at !== null,
        lastLoginAt: r.updated_at,
      }));
      res.json(users);
    } catch (error) {
      console.error("Error fetching provisioning users:", error);
      res.status(500).json({ error: "Could not fetch users" });
    }
  });

  app.get("/api/admin-provisioning/pending-approvals", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const result = await pool.query(
        `SELECT id, email, first_name, last_name, profession, company_name,
                organization_number, status, created_at
         FROM invite_requests WHERE status = 'pending' ORDER BY created_at DESC`,
      );
      res.json(
        result.rows.map((r: any) => ({
          id: r.id,
          email: r.email,
          firstName: r.first_name,
          lastName: r.last_name,
          profession: r.profession,
          companyName: r.company_name || "",
          organizationNumber: r.organization_number || "",
          status: r.status,
          createdAt: r.created_at,
        })),
      );
    } catch (error) {
      console.error("Error fetching pending approvals:", error);
      res.status(500).json({ error: "Could not fetch pending approvals" });
    }
  });

  app.post(
    "/api/admin-provisioning/approve-music-producer",
    async (req, res) => {
      if (!requireAdminSession(req, res)) return;
      try {
        const { userId, userType, enableIntegrations } = req.body;

        const result = await pool.query(
          `UPDATE invite_requests
           SET status = 'approved', processed_at = NOW(), user_journey_status = 'approved', updated_at = NOW()
           WHERE id = $1 RETURNING *`,
          [userId],
        );

        if (result.rowCount === 0) {
          return res.status(404).json({ error: "User not found" });
        }

        const user = result.rows[0];

        // If enterprise, auto-create team membership entry
        if (user.profession === "enterprise" && user.company_name) {
          const orgId = user.company_name
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "");
          try {
            await pool.query(
              `INSERT INTO enterprise_team_members (organization_id, email, role, status, invited_at, joined_at)
               VALUES ($1, $2, 'admin', 'active', NOW(), NOW())
               ON CONFLICT DO NOTHING`,
              [orgId, user.email],
            );
            console.log(
              `✅ Enterprise team created for ${orgId} with admin ${user.email}`,
            );
          } catch (teamErr) {
            console.warn(
              "Could not auto-create enterprise team:",
              (teamErr as any).message,
            );
          }
        }

        console.log(
          `✅ User ${userId} approved as ${userType || user.profession}`,
        );
        res.json({
          success: true,
          user: {
            id: user.id,
            email: user.email,
            profession: user.profession,
          },
        });
      } catch (error) {
        console.error("Error approving user:", error);
        res.status(500).json({ error: "Could not approve user" });
      }
    },
  );

  app.post("/api/admin-provisioning/create-user", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const {
        email,
        firstName,
        lastName,
        role,
        userType,
        businessName,
        sendInvite,
      } = req.body;

      const result = await pool.query(
        `INSERT INTO invite_requests (email, first_name, last_name, profession, company_name, status, user_journey_status, source, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'approved', 'approved', 'creatorhub', NOW(), NOW())
         RETURNING id`,
        [email, firstName, lastName, userType || role, businessName || ""],
      );

      console.log(`✅ User created: ${email} as ${userType || role}`);
      res.json({ success: true, userId: result.rows[0].id });
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ error: "Could not create user" });
    }
  });

  app.post("/api/admin-provisioning/reject-user", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const { userId, reason } = req.body;

      const result = await pool.query(
        `UPDATE invite_requests SET status = 'rejected', admin_notes = $1, processed_at = NOW(),
         user_journey_status = 'rejected', updated_at = NOW()
         WHERE id = $2 RETURNING email`,
        [reason || "", userId],
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      console.log(`❌ User ${userId} rejected: ${reason}`);
      res.json({ success: true });
    } catch (error) {
      console.error("Error rejecting user:", error);
      res.status(500).json({ error: "Could not reject user" });
    }
  });
}
