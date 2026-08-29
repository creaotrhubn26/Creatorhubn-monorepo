/**
 * superadmin-impersonation-routes.ts
 *
 * User-nivå impersonation for super_admin («Vis som ekte bruker»). Bytter den
 * innloggede super_adminens sesjon til å PEKE på målbrukeren, så alle data-
 * endepunkter (som bruker session.userId) returnerer målbrukerens data — uten
 * å endre hundrevis av endepunkter. Skrivetilgang er TILLATT (admin-valg), men
 * hver impersonasjon audit-logges (start/slutt + skriv), og sesjonen bærer
 * `impersonatorId` + et snapshot av original-super_adminen for ren gjenoppretting.
 *
 * Sikkerhet: kun super_admin kan starte; 30 min auto-utløp; tydelig banner +
 * enkel exit i frontend. Kontrakten er isolert — muterer KUN når en super_admin
 * bevisst kaller /impersonate-user.
 */

import type express from "express";
import type { Pool } from "pg";
import {
  deletePersistedAuthSessionStrict,
  ensureAuthSessionTableStrict,
  persistAuthSessionInTransaction,
} from "./auth-session-store.js";
import type { AuthoritativeSessionRequestResolver } from "./auth-session-authority.js";

// Løs kobling til den faktiske ActiveSessionData i index.ts.
type Sess = {
  userId: string; email: string; name: string; role: string; loginAt: string;
  authSessionVersion: string; profession?: string;
  impersonatedByAdmin?: boolean;
  impersonatorId?: string; impersonatorEmail?: string;
  impersonatorAuthSessionVersion?: string; impersonatorRole?: string;
  impersonatorSnapshot?: Partial<Sess>; impersonationExpiresAt?: number;
  [k: string]: unknown;
};

interface Deps {
  app: express.Application;
  pool: Pool;
  // any på bro-punktene: index.ts sin ActiveSessionData er ikke eksportert, og
  // Map/funksjons-varians ville ellers gitt falske type-feil. Sess brukes internt.
  activeSessions: Map<string, any>;
  readSessionToken: (req: express.Request) => string | null | undefined;
  resolveAuthoritativeSession: AuthoritativeSessionRequestResolver;
}

const TTL_MS = 30 * 60 * 1000; // 30 min auto-utløp

class ImpersonatorAuthorityChangedError extends Error {
  constructor() {
    super("impersonator_authority_changed");
    this.name = "ImpersonatorAuthorityChangedError";
  }
}

export function setupSuperadminImpersonationRoutes({
  app,
  pool,
  activeSessions,
  readSessionToken,
  resolveAuthoritativeSession,
}: Deps): void {
  void pool.query(
    `CREATE TABLE IF NOT EXISTS superadmin_impersonation_audit (
       id bigserial PRIMARY KEY,
       super_admin_id varchar(255),
       action varchar(40),
       target_user_id varchar(255),
       details jsonb,
       created_at timestamptz NOT NULL DEFAULT now())`,
  ).catch((e) => console.error("[impersonation] audit-table", e));

  const audit = (adminId: string | undefined, action: string, targetUserId: string | undefined, details: Record<string, unknown>) => {
    void pool.query(
      `INSERT INTO superadmin_impersonation_audit (super_admin_id, action, target_user_id, details)
       VALUES ($1,$2,$3,$4::jsonb)`,
      [adminId || null, action, targetUserId || null, JSON.stringify(details || {})],
    ).catch((e) => console.error("[impersonation:audit]", e));
  };

  const ctx = async (req: express.Request): Promise<{
    token: string | null;
    session: Sess | null;
    unavailable: boolean;
  }> => {
    const token = readSessionToken(req) || null;
    if (!token) return { token: null, session: null, unavailable: false };
    const resolution = await resolveAuthoritativeSession(req);
    if (resolution.status === "unavailable") {
      return { token, session: null, unavailable: true };
    }
    return {
      token,
      session:
        resolution.status === "authenticated"
          ? (resolution.session as Sess)
          : null,
      unavailable: false,
    };
  };

  const cleanSnapshot = (session: Sess): Sess => {
    const snapshot: Sess = { ...session };
    delete snapshot.impersonatedByAdmin;
    delete snapshot.impersonatorId;
    delete snapshot.impersonatorEmail;
    delete snapshot.impersonatorAuthSessionVersion;
    delete snapshot.impersonatorRole;
    delete snapshot.impersonatorSnapshot;
    delete snapshot.impersonationExpiresAt;
    return snapshot;
  };

  const restore = async (token: string, session: Sess): Promise<Sess> => {
    const snapshot = session.impersonatorSnapshot;
    if (
      !snapshot ||
      typeof snapshot.userId !== "string" ||
      typeof snapshot.email !== "string" ||
      typeof snapshot.name !== "string" ||
      typeof snapshot.role !== "string" ||
      typeof snapshot.loginAt !== "string" ||
      typeof snapshot.authSessionVersion !== "string"
    ) {
      activeSessions.delete(token);
      await deletePersistedAuthSessionStrict(pool, token);
      throw new ImpersonatorAuthorityChangedError();
    }

    const client = await pool.connect();
    let transactionOpen = false;
    try {
      await client.query("BEGIN");
      transactionOpen = true;
      await ensureAuthSessionTableStrict(client);
      const current = (await client.query<{
        id: string;
        email: string;
        name: string;
        role: string;
        auth_session_version: string;
        is_active: boolean;
      }>(
        `SELECT id::text AS id,
                email::text AS email,
                COALESCE(
                  NULLIF(BTRIM(CONCAT_WS(' ', first_name, last_name)), ''),
                  email::text
                ) AS name,
                COALESCE(NULLIF(BTRIM(role::text), ''), 'user') AS role,
                auth_session_version::text AS auth_session_version,
                COALESCE(is_active, TRUE) AS is_active
           FROM users
          WHERE id::text = $1
          FOR SHARE`,
        [snapshot.userId],
      )).rows[0];
      const currentVersion = String(current?.auth_session_version ?? "");
      if (
        !current ||
        current.is_active !== true ||
        String(current.role).toLowerCase() !== "super_admin" ||
        currentVersion !== snapshot.authSessionVersion
      ) {
        await client.query(
          `DELETE FROM creatorhub_auth_sessions WHERE token = $1`,
          [token],
        );
        await client.query("COMMIT");
        transactionOpen = false;
        activeSessions.delete(token);
        throw new ImpersonatorAuthorityChangedError();
      }

      const restored = cleanSnapshot({
        ...(snapshot as Sess),
        userId: current.id,
        email: current.email,
        name: current.name,
        role: "super_admin",
        authSessionVersion: currentVersion,
        isAdmin: true,
      });
      await persistAuthSessionInTransaction(client, token, restored);
      await client.query("COMMIT");
      transactionOpen = false;
      activeSessions.set(token, restored);
      return restored;
    } catch (error) {
      if (transactionOpen) {
        await client.query("ROLLBACK").catch(() => undefined);
      }
      throw error;
    } finally {
      client.release();
    }
  };

  const isRealSuperAdmin = (s: Sess | null): boolean =>
    !!s && String(s.role).toLowerCase() === "super_admin" && !s.impersonatedByAdmin;

  // Søk brukere (for velgeren) — kun super_admin, ikke under impersonation.
  app.get("/api/superadmin/users/search", async (req, res) => {
    const { session, unavailable } = await ctx(req);
    if (unavailable) return res.status(503).json({ error: "session_store_unavailable" });
    if (!isRealSuperAdmin(session)) return res.status(403).json({ error: "krever_super_admin" });
    const q = String(req.query.q || "").trim();
    if (q.length < 2) return res.json({ users: [] });
    try {
      const r = await pool.query(
        `SELECT id, email, COALESCE(company_name, username, email) AS name, role, profession
           FROM users
          WHERE email ILIKE $1 OR company_name ILIKE $1 OR username ILIKE $1
          ORDER BY (role='super_admin') DESC, email ASC LIMIT 20`,
        [`%${q}%`],
      );
      res.json({ users: r.rows });
    } catch (err) {
      console.error("[impersonation:search]", err);
      res.status(500).json({ error: "kunne_ikke_soke" });
    }
  });

  // Start impersonation.
  app.post("/api/superadmin/impersonate-user", async (req, res) => {
    const { token, session, unavailable } = await ctx(req);
    if (unavailable) return res.status(503).json({ error: "session_store_unavailable" });
    if (!token || !session) return res.status(401).json({ error: "auth_required" });
    if (!isRealSuperAdmin(session)) return res.status(403).json({ error: "krever_super_admin" });
    const targetUserId = String(req.body?.targetUserId || "");
    try {
      const t = (await pool.query<{
        id: string; email: string; name: string; role: string;
        profession: string | null; auth_session_version: string;
        is_active: boolean;
      }>(
        `SELECT id::text AS id,
                email::text AS email,
                COALESCE(
                  NULLIF(BTRIM(CONCAT_WS(' ', first_name, last_name)), ''),
                  email::text
                ) AS name,
                COALESCE(NULLIF(BTRIM(role::text), ''), 'user') AS role,
                profession,
                auth_session_version::text AS auth_session_version,
                COALESCE(is_active, TRUE) AS is_active
           FROM users
          WHERE id::text = $1
          LIMIT 1`,
        [targetUserId],
      )).rows[0];
      if (!t) return res.status(404).json({ error: "bruker_ikke_funnet" });
      if (!t.is_active) return res.status(403).json({ error: "bruker_deaktivert" });
      if (String(t.role).toLowerCase() === "super_admin") return res.status(400).json({ error: "kan_ikke_impersonere_super_admin" });

      const impersonationExpiresAt = Date.now() + TTL_MS;
      const targetRole = String(t.role || "user").toLowerCase();
      const targetSession: Sess = {
        userId: t.id,
        email: t.email,
        name: t.name,
        role: targetRole,
        profession: t.profession || undefined,
        authSessionVersion: String(t.auth_session_version),
        loginAt: new Date().toISOString(),
        isAdmin: targetRole === "admin" || targetRole === "super_admin",
        impersonatedByAdmin: true,
        impersonatorId: session.userId,
        impersonatorEmail: session.email,
        impersonatorAuthSessionVersion: session.authSessionVersion,
        impersonatorRole: "super_admin",
        impersonatorSnapshot: cleanSnapshot(session),
        impersonationExpiresAt,
      };
      try {
        await ensureAuthSessionTableStrict(pool);
        await persistAuthSessionInTransaction(pool, token, targetSession, {
          expiresAt: new Date(impersonationExpiresAt),
        });
      } catch (error) {
        console.error("[impersonation:start] canonical persist failed", error);
        return res.status(503).json({ error: "session_store_unavailable" });
      }
      activeSessions.set(token, targetSession);
      audit(targetSession.impersonatorId, "start", t.id, { targetEmail: t.email, targetRole: t.role });
      res.json({ ok: true, target: { id: t.id, name: t.name, role: t.role, profession: t.profession } });
    } catch (err) {
      console.error("[impersonation:start]", err);
      res.status(500).json({ error: "kunne_ikke_starte" });
    }
  });

  // Avslutt impersonation → gjenopprett super_admin.
  app.post("/api/superadmin/end-impersonation-user", async (req, res) => {
    const { token, session, unavailable } = await ctx(req);
    if (unavailable) return res.status(503).json({ error: "session_store_unavailable" });
    if (!token || !session) return res.status(401).json({ error: "auth_required" });
    if (!session.impersonatedByAdmin) return res.json({ ok: true, wasActive: false });
    const impersonatorId = session.impersonatorId;
    const targetId = session.userId;
    try {
      await restore(token, session);
    } catch (error) {
      if (error instanceof ImpersonatorAuthorityChangedError) {
        return res.status(401).json({ error: "impersonator_authority_changed" });
      }
      console.error("[impersonation:end] canonical restore failed", error);
      return res.status(503).json({ error: "session_store_unavailable" });
    }
    audit(impersonatorId, "end", targetId, {});
    res.json({ ok: true, wasActive: true });
  });

  // Status (frontend-banner) — håndhever også utløp.
  app.get("/api/superadmin/impersonation-status", async (req, res) => {
    const { token, session, unavailable } = await ctx(req);
    if (unavailable) return res.status(503).json({ error: "session_store_unavailable" });
    if (!token || !session) return res.json({ active: false });
    if (session.impersonatedByAdmin) {
      return res.json({
        active: true, targetName: session.name, targetEmail: session.email,
        targetRole: session.role, impersonatorEmail: session.impersonatorEmail,
        expiresAt: session.impersonationExpiresAt,
      });
    }
    res.json({ active: false });
  });
  // Merk: skriv-audit + utløps-håndhevelse på hver request registreres TIDLIG i
  // index.ts (før rutene) for full dekning — ikke her, som ville fanget for lite.
}
