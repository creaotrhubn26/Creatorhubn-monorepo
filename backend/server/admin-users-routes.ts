/**
 * admin-users-routes.ts
 *
 * Admin user management — 10 endpoints for å håndtere brukere fra
 * admin-panelet.
 *
 *   GET    /api/admin/users                          — list
 *   GET    /api/admin/roles                          — list rolle-katalog
 *   POST   /api/admin/users                          — opprett
 *   PATCH  /api/admin/users/:id                      — oppdater
 *   PUT    /api/admin/users/:id/profession           — endre yrke
 *   POST   /api/admin/users/:id/approve              — godkjenn invitt
 *   GET    /api/admin/users/:id/payment-status       — betalingsstatus
 *   POST   /api/admin/users/:id/activate-google-wallet — stub
 *   POST   /api/admin/impersonate/start              — start impersonering
 *   GET    /api/admin/users/recently-approved        — nylig godkjente
 *
 * Alle krever requireAdminSession. Pass-through på ~19 deps.
 */

import crypto from "crypto";
import type express from "express";
import type { Pool } from "pg";

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface AdminUsersRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireAdminSession: (req: express.Request, res: express.Response) => any;
  activeSessions: Map<string, any>;
  getAdminRoleCatalog: () => any;
  ADMIN_SESSION_ROLES: Set<string>;
  listAdminUsersSnapshot: () => Promise<any[]>;
  normalizeAdminRoleId: (role: any) => any;
  resolveAdminProfessionForPersistence: (input: any) => any;
  upsertAdminInviteRequest: (input: any) => Promise<any>;
  upsertAdminAccountUser: (input: any) => Promise<any>;
  ensureInviteRequestAccessProvisioning: (inviteRequest: any) => Promise<any>;
  resolveAdminUserView: (id: string, email?: string) => Promise<any>;
  toAdminString: (value: any) => string | null;
  toAdminBoolean: (value: any) => boolean | null | undefined;
  findAdminInviteRequest: (id: string, email: string) => Promise<any>;
  findAdminAccountUser: (id: string, email: string | null) => Promise<any>;
  ensureCommunityAccessForApprovedInvite: (inviteRow: any, userId: string | null) => Promise<any>;
  normalizeInvitePlanId: (value: any) => any;
  buildAdminRoleEntry: (role: any) => any;
  persistAuthSession: (pool: Pool, token: string, session: any) => Promise<any>;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function setupAdminUsersRoutes(deps: AdminUsersRoutesDeps): void {
  const {
    app,
    pool,
    requireAdminSession,
    activeSessions,
    getAdminRoleCatalog,
    ADMIN_SESSION_ROLES,
    listAdminUsersSnapshot,
    normalizeAdminRoleId,
    resolveAdminProfessionForPersistence,
    upsertAdminInviteRequest,
    upsertAdminAccountUser,
    ensureInviteRequestAccessProvisioning,
    resolveAdminUserView,
    toAdminString,
    toAdminBoolean,
    findAdminInviteRequest,
    findAdminAccountUser,
    ensureCommunityAccessForApprovedInvite,
    normalizeInvitePlanId,
    buildAdminRoleEntry,
    persistAuthSession,
  } = deps;

  app.get("/api/admin/users", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) {
        return;
      }
      const users = await listAdminUsersSnapshot();
      res.json(users);
    } catch (error) {
      console.error("Error fetching admin users:", error);
      res.status(500).json({ error: "Could not fetch users" });
    }
  });

  app.get("/api/admin/roles", async (req, res) => {
    if (!requireAdminSession(req, res)) {
      return;
    }
    res.json({ roles: getAdminRoleCatalog() });
  });

  app.post("/api/admin/users", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) {
        return;
      }
      const email = toAdminString(req.body?.email)?.toLowerCase();
      if (!email) {
        return res.status(400).json({ error: "E-post er påkrevd" });
      }

      const firstName = toAdminString(req.body?.firstName);
      const lastName = toAdminString(req.body?.lastName);
      const businessName = toAdminString(req.body?.businessName);
      const organizationNumber = toAdminString(req.body?.organizationNumber);
      const requestedRole = normalizeAdminRoleId(req.body?.role);
      const profession = resolveAdminProfessionForPersistence({
        profession: req.body?.profession ?? req.body?.userType,
        roleId: requestedRole,
      });
      const sendInvite = req.body?.sendInvite === true;
      const inviteStatus = sendInvite ? "pending" : "approved";
      const inviteJourneyStatus = sendInvite ? "invite_sent" : "approved";

      let inviteRequest = await upsertAdminInviteRequest({
        email,
        firstName,
        lastName,
        profession,
        businessName,
        organizationNumber,
        status: inviteStatus,
        userJourneyStatus: inviteJourneyStatus,
        sendInvite,
      });

      let accountUser = null;

      if (!sendInvite) {
        accountUser = await upsertAdminAccountUser({
          email,
          firstName,
          lastName,
          role: requestedRole,
          profession,
          businessName,
          organizationNumber,
          isActive: true,
        });

        if (inviteRequest) {
          const provisioning =
            await ensureInviteRequestAccessProvisioning(inviteRequest);
          const provisionedUserId = toAdminString(provisioning?.userId);
          if (provisionedUserId) {
            accountUser =
              (await upsertAdminAccountUser({
                email,
                firstName,
                lastName,
                role: requestedRole,
                profession,
                businessName,
                organizationNumber,
                isActive: true,
              })) || accountUser;
            inviteRequest = await upsertAdminInviteRequest({
              email,
              registeredUserId: provisionedUserId,
            });
          }
        }
      }

      const createdUser = await resolveAdminUserView(
        String(accountUser?.id || inviteRequest?.id || email),
        email,
      );

      res.status(201).json({
        success: true,
        user: createdUser,
        message: sendInvite
          ? "Bruker opprettet og markert som invitert."
          : "Bruker opprettet.",
      });
    } catch (error: any) {
      console.error("Error creating admin user:", error);
      if (error?.constraint === "invite_requests_email_unique") {
        return res
          .status(409)
          .json({ error: "En bruker med denne e-posten finnes allerede." });
      }
      res.status(500).json({ error: "Could not create user" });
    }
  });

  app.patch("/api/admin/users/:id", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) {
        return;
      }
      const userView = await resolveAdminUserView(req.params.id);
      if (!userView) {
        return res.status(404).json({ error: "Bruker ikke funnet" });
      }

      const nextRole =
        req.body?.role !== undefined
          ? normalizeAdminRoleId(req.body.role)
          : undefined;
      const nextIsActive =
        req.body?.isActive !== undefined
          ? toAdminBoolean(req.body.isActive) ?? undefined
          : undefined;
      const nextFirstName =
        req.body?.firstName !== undefined
          ? toAdminString(req.body.firstName)
          : undefined;
      const nextLastName =
        req.body?.lastName !== undefined
          ? toAdminString(req.body.lastName)
          : undefined;
      const nextBusinessName =
        req.body?.businessName !== undefined
          ? toAdminString(req.body.businessName)
          : undefined;

      const email = String(userView.email || "");
      const inviteRequestId = toAdminString(userView.inviteRequestId);
      const accountUserId = toAdminString(userView.accountUserId);
      const currentRole = normalizeAdminRoleId(userView.role);
      const currentProfession = toAdminString(userView.profession);
      const nextProfession =
        req.body?.profession !== undefined
          ? resolveAdminProfessionForPersistence({
              profession: req.body.profession,
              roleId: nextRole || currentRole,
              fallbackProfession: currentProfession,
            })
          : undefined;

      if (accountUserId) {
        await upsertAdminAccountUser({
          email,
          firstName: nextFirstName,
          lastName: nextLastName,
          role: nextRole,
          profession: nextProfession,
          businessName: nextBusinessName,
          organizationNumber: undefined,
          isActive: nextIsActive,
        });
      }

      if (inviteRequestId) {
        await upsertAdminInviteRequest({
          email,
          firstName: nextFirstName,
          lastName: nextLastName,
          businessName: nextBusinessName,
          profession: nextProfession,
          status: nextIsActive === true ? "approved" : undefined,
          userJourneyStatus: nextIsActive === false ? "inactive" : undefined,
        });
      }

      const updatedUser = await resolveAdminUserView(req.params.id, email);
      res.json({ success: true, user: updatedUser });
    } catch (error) {
      console.error("Error updating admin user:", error);
      res.status(500).json({ error: "Could not update user" });
    }
  });

  app.put("/api/admin/users/:id/profession", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) {
        return;
      }
      const userView = await resolveAdminUserView(req.params.id);
      if (!userView) {
        return res.status(404).json({ error: "Bruker ikke funnet" });
      }

      const email = String(userView.email || "");
      const profession = resolveAdminProfessionForPersistence({
        profession: req.body?.profession,
        roleId: toAdminString(userView.role),
        fallbackProfession: userView.profession,
      });
      const inviteRequestId = toAdminString(userView.inviteRequestId);
      const accountUserId = toAdminString(userView.accountUserId);

      if (inviteRequestId) {
        await upsertAdminInviteRequest({
          email,
          profession,
        });
      }

      if (accountUserId) {
        await upsertAdminAccountUser({
          email,
          profession,
        });
      }

      const updatedUser = await resolveAdminUserView(req.params.id, email);
      res.json({ success: true, user: updatedUser });
    } catch (error) {
      console.error("Error updating user profession:", error);
      res.status(500).json({ error: "Could not update profession" });
    }
  });

  app.post("/api/admin/users/:id/approve", async (req, res) => {
    try {
      const adminSession = requireAdminSession(req, res);
      if (!adminSession) {
        return;
      }
      const userView = await resolveAdminUserView(req.params.id);
      if (!userView) {
        return res.status(404).json({ error: "Bruker ikke funnet" });
      }

      const email = String(userView.email || "");
      const inviteRequest = await findAdminInviteRequest(
        String(userView.inviteRequestId || req.params.id),
        email,
      );

      let provisioning: any = null;
      let communityProvisioning: any = null;

      if (inviteRequest?.id) {
        const inviteRow =
          (await upsertAdminInviteRequest({
            email,
            status: "approved",
            processedBy: adminSession.userId,
            userJourneyStatus: "approved",
            processed: true,
          })) || inviteRequest;
        provisioning = await ensureInviteRequestAccessProvisioning(inviteRow);
        const provisionedUserId = toAdminString(provisioning?.userId);
        if (provisionedUserId) {
          await upsertAdminAccountUser({
            email,
            firstName: toAdminString(userView.firstName),
            lastName: toAdminString(userView.lastName),
            role: toAdminString(userView.role),
            profession: toAdminString(userView.profession),
            businessName:
              toAdminString(userView.businessName) ||
              toAdminString(userView.companyName),
            organizationNumber: toAdminString(userView.organizationNumber),
            isActive: true,
          });
          await upsertAdminInviteRequest({
            email,
            registeredUserId: provisionedUserId,
          });
        }
        communityProvisioning = await ensureCommunityAccessForApprovedInvite(
          {
            ...inviteRow,
            registered_user_id:
              provisionedUserId || inviteRow.registered_user_id || null,
            profession:
              toAdminString(inviteRow.profession) ||
              toAdminString(userView.profession),
            email,
          },
          provisionedUserId || null,
        );
      } else if (toAdminString(userView.accountUserId)) {
        await upsertAdminAccountUser({
          email,
          role: toAdminString(userView.role),
          profession: toAdminString(userView.profession),
          businessName:
            toAdminString(userView.businessName) ||
            toAdminString(userView.companyName),
          organizationNumber: toAdminString(userView.organizationNumber),
          isActive: true,
        });
        communityProvisioning = await ensureCommunityAccessForApprovedInvite(
          {
            status: "approved",
            registered_user_id: toAdminString(userView.accountUserId),
            profession: toAdminString(userView.profession),
            email,
          },
          toAdminString(userView.accountUserId),
        );
      }

      const approvedUser = await resolveAdminUserView(req.params.id, email);
      res.json({
        success: true,
        user: approvedUser,
        provisioning,
        communityProvisioning,
      });
    } catch (error) {
      console.error("Error approving admin user:", error);
      res.status(500).json({ error: "Could not approve user" });
    }
  });

  app.get("/api/admin/users/:id/payment-status", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) {
        return;
      }
      const userView = await resolveAdminUserView(req.params.id);
      if (!userView) {
        return res.status(404).json({ error: "Bruker ikke funnet" });
      }

      const inviteRequest = await findAdminInviteRequest(
        String(userView.inviteRequestId || req.params.id),
        String(userView.email || ""),
      );
      const selectedPlan = normalizeInvitePlanId(
        inviteRequest?.selected_plan || inviteRequest?.plan_name,
      );
      const paymentCompleted = Boolean(inviteRequest?.payment_completed);
      const hasPayment = Boolean(
        selectedPlan ||
          inviteRequest?.plan_name ||
          inviteRequest?.payment_amount ||
          inviteRequest?.payment_completed,
      );

      res.json({
        hasPayment,
        paymentCompleted,
        planId: selectedPlan,
        planName:
          toAdminString(inviteRequest?.plan_name) ||
          toAdminString(inviteRequest?.selected_plan),
        paymentAmount:
          inviteRequest?.payment_amount != null
            ? Number(inviteRequest.payment_amount)
            : null,
      });
    } catch (error) {
      console.error("Error reading admin payment status:", error);
      res.status(500).json({ error: "Could not read payment status" });
    }
  });

  app.post("/api/admin/users/:id/activate-google-wallet", async (req, res) => {
    if (!requireAdminSession(req, res)) {
      return;
    }
    res.json({
      success: true,
      skipped: true,
      planId: toAdminString(req.body?.planId),
      message:
        "Google Wallet-aktivering er ikke koblet opp i admin-dashboardet ennå.",
    });
  });

  app.post("/api/admin/impersonate/start", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) {
        return;
      }
      const requestedTargetId = toAdminString(req.body?.targetUserId);
      if (!requestedTargetId) {
        return res.status(400).json({ error: "targetUserId er påkrevd" });
      }

      const userView = await resolveAdminUserView(requestedTargetId);
      const targetAccountId = toAdminString(userView?.accountUserId) || requestedTargetId;
      const targetAccount = await findAdminAccountUser(
        targetAccountId,
        toAdminString(userView?.email),
      );

      if (!targetAccount?.id) {
        return res
          .status(404)
          .json({ error: "Fant ingen aktiv brukerkonto å impersonere." });
      }

      const targetRole = normalizeAdminRoleId(
        targetAccount.role || userView?.role || "user",
      );
      const targetRoleEntry = buildAdminRoleEntry(targetRole);
      const targetProfession =
        toAdminString(targetAccount.profession) ||
        toAdminString(userView?.profession);
      const targetSessionToken = crypto.randomUUID();
      const targetSession = {
        userId: String(targetAccount.id),
        email: toAdminString(targetAccount.email) || String(userView?.email || ""),
        name:
          [
            toAdminString(targetAccount.first_name),
            toAdminString(targetAccount.last_name),
          ]
            .filter(Boolean)
            .join(" ") ||
          toAdminString(targetAccount.username) ||
          String(userView?.email || "").split("@")[0] ||
          "CreatorHub User",
        role: targetRole,
        roleLabel: targetRoleEntry.name,
        permissions: targetRoleEntry.permissions,
        profession: targetProfession || undefined,
        userType: targetProfession || undefined,
        displayName:
          [
            toAdminString(targetAccount.first_name),
            toAdminString(targetAccount.last_name),
          ]
            .filter(Boolean)
            .join(" ") ||
          toAdminString(targetAccount.username) ||
          String(userView?.email || "").split("@")[0] ||
          "CreatorHub User",
        impersonatedByAdmin: true,
        isAdmin: ADMIN_SESSION_ROLES.has(targetRole),
        loginAt: new Date().toISOString(),
      };

      activeSessions.set(targetSessionToken, targetSession);
      await persistAuthSession(pool, targetSessionToken, targetSession);

      res.json({
        success: true,
        token: targetSessionToken,
        targetUser: {
          id: targetSession.userId,
          email: targetSession.email,
          name: targetSession.name,
          role: targetSession.role,
          roleLabel: targetRoleEntry.name,
          profession: targetProfession,
          userType: targetProfession,
          permissions: targetRoleEntry.permissions,
          isAdmin: ADMIN_SESSION_ROLES.has(targetRole),
          impersonatedByAdmin: true,
        },
      });
    } catch (error) {
      console.error("Error starting admin impersonation:", error);
      res.status(500).json({ error: "Could not start impersonation" });
    }
  });

  app.get("/api/admin/users/recently-approved", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) {
        return;
      }
      const days = parseInt(req.query.days as string) || 30;
      const result = await pool.query(
        `SELECT * FROM invite_requests
         WHERE status = 'approved' AND processed_at > NOW() - INTERVAL '1 day' * $1
         ORDER BY processed_at DESC`,
        [days],
      );
      res.json(
        result.rows.map((r) => ({
          id: r.id,
          email: r.email,
          firstName: r.first_name,
          lastName: r.last_name,
          profession: r.profession,
          companyName: r.company_name,
          hasCompletedUniversalOnboarding: r.onboarding_completed_at !== null,
          hasEnteredUniversalDashboard:
            r.user_journey_status === "dashboard_accessed",
          createdAt: r.created_at,
          approvedAt: r.processed_at,
        })),
      );
    } catch (error) {
      console.error("Error fetching recently approved users:", error);
      res.status(500).json({ error: "Could not fetch recently approved users" });
    }
  });

  // DELETE /api/admin/users/:id — permanent sletting av en bruker.
  // KUN super_admin. Kan ikke slette seg selv eller andre admin/super_admin.
  // FK-trygt: NULL-er nullbare NO ACTION-referanser (bevarer raden), sletter
  // ikke-nullbare; CASCADE + SET NULL håndteres av DB-en. Alt i én transaksjon.
  app.delete("/api/admin/users/:id", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    if (String(session.role || "").trim().toLowerCase() !== "super_admin") {
      return res.status(403).json({ error: "Kun super_admin kan slette brukere." });
    }
    const targetId = String(req.params.id || "").trim();
    if (!targetId) return res.status(400).json({ error: "Bruker-ID mangler." });
    if (targetId === String(session.userId)) {
      return res.status(400).json({ error: "Du kan ikke slette din egen konto." });
    }

    const client = await pool.connect();
    try {
      const targetRes = await client.query(
        "SELECT id, email, role FROM users WHERE id::text = $1",
        [targetId],
      );
      if (targetRes.rowCount === 0) {
        return res.status(404).json({ error: "Fant ingen bruker med denne ID-en." });
      }
      const target = targetRes.rows[0];
      const targetRole = String(target.role || "").trim().toLowerCase();
      if (targetRole === "super_admin" || targetRole === "admin") {
        return res.status(403).json({
          error: "Kan ikke slette admin/super_admin-kontoer. Endre rollen til 'bruker' først.",
        });
      }

      await client.query("BEGIN");
      // NO ACTION-FK-barn må håndteres manuelt (ellers blokkerer de slettingen).
      // Katalog-navn (trygge, ikke bruker-input) → bygges som siterte identifikatorer.
      const fkRes = await client.query(`
        SELECT tc.table_schema AS s, tc.table_name AS t, kcu.column_name AS c, col.is_nullable AS nullable
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name=kcu.constraint_name AND tc.table_schema=kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name=ccu.constraint_name AND tc.table_schema=ccu.table_schema
        JOIN information_schema.referential_constraints rc
          ON tc.constraint_name=rc.constraint_name
        JOIN information_schema.columns col
          ON col.table_schema=tc.table_schema AND col.table_name=tc.table_name AND col.column_name=kcu.column_name
        WHERE tc.constraint_type='FOREIGN KEY'
          AND ccu.table_name='users' AND ccu.table_schema='public'
          AND rc.delete_rule='NO ACTION'`);
      for (const row of fkRes.rows as Array<{ s: string; t: string; c: string; nullable: string }>) {
        const ident = `"${row.s}"."${row.t}"`;
        const col = `"${row.c}"`;
        if (String(row.nullable).toUpperCase() === "YES") {
          await client.query(`UPDATE ${ident} SET ${col} = NULL WHERE ${col}::text = $1`, [targetId]);
        } else {
          await client.query(`DELETE FROM ${ident} WHERE ${col}::text = $1`, [targetId]);
        }
      }
      const del = await client.query("DELETE FROM users WHERE id::text = $1", [targetId]);
      await client.query("COMMIT");
      return res.json({ success: true, deletedEmail: target.email, deleted: del.rowCount });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("Error deleting user:", error);
      return res.status(500).json({ error: "Kunne ikke slette bruker.", detail: String(error) });
    } finally {
      client.release();
    }
  });
}
