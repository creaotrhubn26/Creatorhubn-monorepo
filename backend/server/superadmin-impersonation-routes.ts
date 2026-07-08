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

// Løs kobling til den faktiske ActiveSessionData i index.ts.
type Sess = {
  userId: string; email: string; name: string; role: string; profession?: string;
  impersonatedByAdmin?: boolean;
  impersonatorId?: string; impersonatorEmail?: string;
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
  persistSession: (token: string, session: any) => void | Promise<void>;
}

const TTL_MS = 30 * 60 * 1000; // 30 min auto-utløp

export function setupSuperadminImpersonationRoutes({ app, pool, activeSessions, readSessionToken, persistSession }: Deps): void {
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

  const ctx = (req: express.Request): { token: string | null; session: Sess | null } => {
    const token = readSessionToken(req) || null;
    return { token, session: token ? activeSessions.get(token) || null : null };
  };

  const restore = (token: string, session: Sess): void => {
    const snap = session.impersonatorSnapshot || {};
    Object.assign(session, snap);
    session.impersonatedByAdmin = false;
    delete session.impersonatorId; delete session.impersonatorEmail;
    delete session.impersonatorSnapshot; delete session.impersonationExpiresAt;
    activeSessions.set(token, session);
    void persistSession(token, session);
  };

  // Håndhev utløp: gjenopprett hvis impersonasjonen har gått ut på tid.
  const expiredThenRestore = (token: string, session: Sess): boolean => {
    if (session.impersonatedByAdmin && session.impersonationExpiresAt && Date.now() > session.impersonationExpiresAt) {
      restore(token, session);
      return true;
    }
    return false;
  };

  const isRealSuperAdmin = (s: Sess | null): boolean =>
    !!s && String(s.role).toLowerCase() === "super_admin" && !s.impersonatedByAdmin;

  // Søk brukere (for velgeren) — kun super_admin, ikke under impersonation.
  app.get("/api/superadmin/users/search", async (req, res) => {
    const { session } = ctx(req);
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
    const { token, session } = ctx(req);
    if (!token || !session) return res.status(401).json({ error: "auth_required" });
    if (!isRealSuperAdmin(session)) return res.status(403).json({ error: "krever_super_admin" });
    const targetUserId = String(req.body?.targetUserId || "");
    try {
      const t = (await pool.query<{ id: string; email: string; name: string; role: string; profession: string | null }>(
        `SELECT id, email, COALESCE(company_name, username, email) AS name, role, profession FROM users WHERE id=$1 LIMIT 1`,
        [targetUserId],
      )).rows[0];
      if (!t) return res.status(404).json({ error: "bruker_ikke_funnet" });
      if (String(t.role).toLowerCase() === "super_admin") return res.status(400).json({ error: "kan_ikke_impersonere_super_admin" });

      session.impersonatorSnapshot = { userId: session.userId, email: session.email, name: session.name, role: session.role, profession: session.profession };
      session.impersonatorId = session.userId;
      session.impersonatorEmail = session.email;
      session.userId = t.id; session.email = t.email; session.name = t.name; session.role = t.role; session.profession = t.profession || undefined;
      session.impersonatedByAdmin = true;
      session.impersonationExpiresAt = Date.now() + TTL_MS;
      activeSessions.set(token, session);
      void persistSession(token, session);
      audit(session.impersonatorId, "start", t.id, { targetEmail: t.email, targetRole: t.role });
      res.json({ ok: true, target: { id: t.id, name: t.name, role: t.role, profession: t.profession } });
    } catch (err) {
      console.error("[impersonation:start]", err);
      res.status(500).json({ error: "kunne_ikke_starte" });
    }
  });

  // Avslutt impersonation → gjenopprett super_admin.
  app.post("/api/superadmin/end-impersonation-user", async (req, res) => {
    const { token, session } = ctx(req);
    if (!token || !session) return res.status(401).json({ error: "auth_required" });
    if (!session.impersonatedByAdmin) return res.json({ ok: true, wasActive: false });
    const impersonatorId = session.impersonatorId;
    const targetId = session.userId;
    restore(token, session);
    audit(impersonatorId, "end", targetId, {});
    res.json({ ok: true, wasActive: true });
  });

  // Status (frontend-banner) — håndhever også utløp.
  app.get("/api/superadmin/impersonation-status", (req, res) => {
    const { token, session } = ctx(req);
    if (!token || !session) return res.json({ active: false });
    if (expiredThenRestore(token, session)) return res.json({ active: false, expired: true });
    if (session.impersonatedByAdmin) {
      return res.json({
        active: true, targetName: session.name, targetEmail: session.email,
        targetRole: session.role, impersonatorEmail: session.impersonatorEmail,
        expiresAt: session.impersonationExpiresAt,
      });
    }
    res.json({ active: false });
  });

  // Skriv-audit + utløp: logg mutasjoner utført under impersonation (impersonator
  // ansvarlig). Registrert her; fanger ruter registrert ETTER dette kallet.
  app.use((req, _res, next) => {
    const { token, session } = ctx(req);
    if (token && session?.impersonatedByAdmin) {
      if (!expiredThenRestore(token, session)) {
        const m = req.method.toUpperCase();
        if ((m === "POST" || m === "PUT" || m === "PATCH" || m === "DELETE") && !req.path.includes("/impersonation") && !req.path.includes("/impersonate")) {
          audit(session.impersonatorId, "write", session.userId, { method: m, path: req.path.slice(0, 200) });
        }
      }
    }
    next();
  });
}
