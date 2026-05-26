import express from "express";
import type { Pool } from "pg";
import { exchangeGoogleIdToken } from "./google-id-token-service.js";

export interface AuthRoutesDeps {
  app: express.Application;
  pool: Pool;
  buildAdminRoleEntry: (...args: any[]) => any;
  buildSessionUserFromActiveSession: (...args: any[]) => any;
  deletePersistedAuthSession: (...args: any[]) => Promise<void>;
  getRoleRoomCommercialLoginGate: (...args: any[]) => any;
  getTableColumns: (tableName: string) => Promise<Set<string>>;
  isRoleRoomCommercialLoginIntent: (...args: any[]) => boolean;
  normalizeAdminProfession: (
    value: unknown,
    roleId?: string | null,
  ) => string | null;
  normalizeAdminRoleId: (value: unknown) => string;
  ActiveSessionData?: never;
  ADMIN_SESSION_ROLES: Set<string>;
  pendingTwoFactorLogins: Map<string, any>;
  activeSessions: Map<string, any>;
  persistAuthSession: (...args: any[]) => Promise<void>;
  purgeExpiredPendingTwoFactor: () => void;
  readActiveSessionToken: (req: any) => string | null;
  resolveActiveSessionFromRequest: (req: any) => Promise<any>;
  adminRoleCatalogById: Map<string, any>;
}

export function setupAuthRoutes(deps: AuthRoutesDeps): void {
  const {
    app,
    pool,
    buildAdminRoleEntry,
    buildSessionUserFromActiveSession,
    deletePersistedAuthSession,
    getRoleRoomCommercialLoginGate,
    getTableColumns,
    isRoleRoomCommercialLoginIntent,
    normalizeAdminProfession,
    normalizeAdminRoleId,
    persistAuthSession,
    purgeExpiredPendingTwoFactor,
    readActiveSessionToken,
    resolveActiveSessionFromRequest,
    adminRoleCatalogById,
    ADMIN_SESSION_ROLES,
    pendingTwoFactorLogins,
    activeSessions,
  } = deps;
  type ActiveSessionData = any;

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      const loginType =
        typeof req.body?.type === "string"
          ? req.body.type.toLowerCase()
          : "general";
      const loginAs =
        typeof req.body?.loginAs === "string"
          ? req.body.loginAs.toLowerCase().trim()
          : "";
      const requestedRole =
        typeof req.body?.role === "string"
          ? req.body.role.toLowerCase().trim()
          : "";
      const isRoleRoomLogin =
        loginAs === "production_team" || loginAs === "content_producer";
      const isProductionEnv = process.env.NODE_ENV === "production";
      const roleRoomGuestPassword =
        process.env.ROLE_ROOM_GUEST_PASSWORD ||
        process.env.PROTOTYPE_GUEST_PASSWORD ||
        "guest-access";
      const prototypeGuestPassword =
        process.env.PROTOTYPE_GUEST_PASSWORD || "guest-access";
      if (!email) return res.status(400).json({ error: "E-post er påkrevd" });
      const normalizedEmail = email.toLowerCase().trim();
      const prototypeGuestEmails = new Set(
        String(
          process.env.PROTOTYPE_GUEST_EMAILS ||
            (!isProductionEnv ? "academy-guest@creatorhubn.com" : ""),
        )
          .split(",")
          .map((entry) => entry.trim().toLowerCase())
          .filter(Boolean),
      );
      const canUseGeneralGuestPassword =
        prototypeGuestEmails.has(normalizedEmail) &&
        (password === "auto" || password === "" || password == null);
      const effectivePassword = canUseGeneralGuestPassword
        ? prototypeGuestPassword
        : password;
      const commercialRoleRoomLogin = isRoleRoomCommercialLoginIntent({
        loginAs,
        requestedRole,
      });

      if (commercialRoleRoomLogin) {
        const accessGate = await getRoleRoomCommercialLoginGate({
          email: normalizedEmail,
          loginAs,
          requestedRole,
        });
        if (!accessGate.allowed) {
          return res.status(403).json({ error: accessGate.reason });
        }
      }

      // Local environments are not guaranteed to have every optional users column.
      const userColumns = await getTableColumns("users");
      const userSelectColumns = [
        "id",
        "email",
        userColumns.has("username") ? "username" : "NULL::text AS username",
        userColumns.has("first_name") ? "first_name" : "NULL::text AS first_name",
        userColumns.has("last_name") ? "last_name" : "NULL::text AS last_name",
        userColumns.has("password") ? "password" : "NULL::text AS password",
        userColumns.has("role") ? "role" : "NULL::text AS role",
        userColumns.has("profession") ? "profession" : "NULL::text AS profession",
        userColumns.has("company_name") ? "company_name" : "NULL::text AS company_name",
      ];

      // Look up user by email
      let result = await pool.query(
        `SELECT ${userSelectColumns.join(", ")} FROM users WHERE email = $1`,
        [normalizedEmail],
      );

      if (
        (!result.rowCount || result.rowCount === 0) &&
        isRoleRoomLogin &&
        !isProductionEnv
      ) {
        const bcrypt = await import("bcrypt");
        const safePassword =
          typeof password === "string" && password.trim().length > 0
            ? password
            : roleRoomGuestPassword;
        const hashedPassword = await bcrypt.default.hash(safePassword, 10);
        const inferredFirstName =
          normalizedEmail.split("@")[0]?.slice(0, 64) || "Role Room";
        const inferredUsername =
          normalizedEmail
            .split("@")[0]
            ?.toLowerCase()
            .replace(/[^a-z0-9._-]/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "")
            .slice(0, 64) || `role-room-${Date.now()}`;

        result = await pool.query(
          `INSERT INTO users (email, username, first_name, role, password, created_at, updated_at)
           VALUES ($1, $2, $3, 'user', $4, NOW(), NOW())
           ON CONFLICT (email) DO UPDATE
           SET password = COALESCE(NULLIF(users.password, ''), EXCLUDED.password),
               username = COALESCE(NULLIF(users.username, ''), EXCLUDED.username),
               first_name = COALESCE(NULLIF(users.first_name, ''), EXCLUDED.first_name),
               updated_at = NOW()
           RETURNING ${userSelectColumns.join(", ")}`,
          [normalizedEmail, inferredUsername, inferredFirstName, hashedPassword],
        );
      }

      if (!result.rowCount || result.rowCount === 0) {
        return res.status(401).json({ error: "Ugyldig e-post eller passord" });
      }

      const dbUser = result.rows[0];
      const storedPassword =
        typeof dbUser.password === "string" ? dbUser.password : "";

      if (storedPassword) {
        const bcrypt = await import("bcrypt");
        const isPasswordHashed = /^\$2[ayb]\$/.test(storedPassword);
        const passwordValid = isPasswordHashed
          ? await bcrypt.default.compare(effectivePassword || "", storedPassword)
          : effectivePassword === storedPassword;

        if (!passwordValid) {
          return res.status(401).json({ error: "Ugyldig e-post eller passord" });
        }
      } else {
        const canUsePrototypeFallback =
          (loginType === "prototype" || canUseGeneralGuestPassword) &&
          prototypeGuestEmails.has(dbUser.email);
        const canUseRoleRoomFallback = isRoleRoomLogin && !isProductionEnv;
        const roleRoomPasswordValid =
          canUseRoleRoomFallback && effectivePassword === roleRoomGuestPassword;
        if (
          (!canUsePrototypeFallback ||
            effectivePassword !== prototypeGuestPassword) &&
          !roleRoomPasswordValid
        ) {
          return res.status(401).json({ error: "Ugyldig e-post eller passord" });
        }
        if (roleRoomPasswordValid) {
          const bcrypt = await import("bcrypt");
          const hashedPassword = await bcrypt.default.hash(
            roleRoomGuestPassword,
            10,
          );
          await pool
            .query(
              `UPDATE users
             SET password = $2, updated_at = NOW()
             WHERE id = $1 AND (password IS NULL OR password = '')`,
              [dbUser.id, hashedPassword],
            )
            .catch(() => undefined);
        }
      }

      // Determine role
      const dbRole = String(dbUser.role || "").trim().toLowerCase();
      let role =
        dbRole === "super_admin"
          ? "admin"
          : adminRoleCatalogById.has(dbRole)
            ? dbRole
            : "user";
      if (loginType === "prototype") {
        if (
          dbRole === "prototype_tester" ||
          prototypeGuestEmails.has(dbUser.email)
        ) {
          role = "prototype_tester";
        } else {
          return res
            .status(403)
            .json({ error: "Prototype tester-tilgang krever godkjenning" });
        }
      }

      // Check couple_profiles
      const coupleCheck = await pool
        .query(
          "SELECT id, display_name FROM couple_profiles WHERE email = $1 LIMIT 1",
          [dbUser.email],
        )
        .catch(() => ({ rows: [], rowCount: 0 }));

      if (loginType !== "prototype" && coupleCheck.rows.length > 0)
        role = "couple";

      // Check vendors table
      const vendorCheck = await pool
        .query("SELECT id, business_name FROM vendors WHERE email = $1 LIMIT 1", [
          dbUser.email,
        ])
        .catch(() => ({ rows: [], rowCount: 0 }));

      if (loginType !== "prototype" && vendorCheck.rows.length > 0)
        role = "vendor";

      // Create session token
      const sessionToken = crypto.randomUUID();
      const name =
        [dbUser.first_name, dbUser.last_name].filter(Boolean).join(" ") ||
        dbUser.username;

      const normalizedRequestedRole = requestedRole || null;
      const roleRoomSessionRole = isRoleRoomLogin
        ? loginAs === "content_producer"
          ? normalizedRequestedRole === "client" ||
            normalizedRequestedRole === "client_reviewer"
            ? "client_reviewer"
            : "content_producer"
          : normalizedRequestedRole || role
        : role;

      const normalizedSessionRole = normalizeAdminRoleId(roleRoomSessionRole);
      const sessionRoleEntry = buildAdminRoleEntry(normalizedSessionRole);
      const sessionProfession = normalizeAdminProfession(
        dbUser.profession,
        normalizedSessionRole,
      );
      const sessionData: ActiveSessionData = {
        userId: dbUser.id,
        email: dbUser.email,
        name,
        role: normalizedSessionRole,
        roleLabel: sessionRoleEntry.name,
        permissions: sessionRoleEntry.permissions,
        profession: sessionProfession || undefined,
        userType: sessionProfession || undefined,
        displayName: name,
        isAdmin: ADMIN_SESSION_ROLES.has(normalizedSessionRole),
        loginAs: loginAs || undefined,
        requestedRole: normalizedRequestedRole,
        loginAt: new Date().toISOString(),
      };
      if (role === "vendor" && vendorCheck.rows.length > 0) {
        sessionData.vendorId = vendorCheck.rows[0].id;
        sessionData.businessName = vendorCheck.rows[0].business_name;
      }
      if (role === "couple" && coupleCheck.rows.length > 0) {
        sessionData.coupleProfileId = coupleCheck.rows[0].id;
        sessionData.displayName =
          coupleCheck.rows[0].display_name || sessionData.displayName;
      }
      // Bygg user-payload som returneres etter (eventuell 2FA-)login
      const userPayload = {
        id: dbUser.id,
        email: dbUser.email,
        name,
        role: normalizedSessionRole,
        roleLabel: sessionRoleEntry.name,
        profession: sessionProfession || undefined,
        userType: sessionProfession || undefined,
        permissions: sessionRoleEntry.permissions,
        isAdmin: ADMIN_SESSION_ROLES.has(normalizedSessionRole),
        ...(isRoleRoomLogin
          ? {
              requestedRole: normalizedRequestedRole,
              loginAs,
            }
          : {}),
        ...(role === "vendor" && vendorCheck.rows.length > 0
          ? {
              vendorId: vendorCheck.rows[0].id,
              businessName: vendorCheck.rows[0].business_name,
            }
          : {}),
        ...(role === "couple" && coupleCheck.rows.length > 0
          ? {
              coupleProfileId: coupleCheck.rows[0].id,
              displayName: coupleCheck.rows[0].display_name,
            }
          : {}),
      };

      // 2FA-gate: hvis brukeren har TOTP aktivert, IKKE commit session
      // ennå — krev kode først. Returner needs_2fa + tempToken.
      try {
        const totpSvc = await import("./totp-2fa-service.js");
        const totpStatus = await totpSvc.getTotpStatus(pool, String(dbUser.id));
        if (totpStatus.enabled) {
          purgeExpiredPendingTwoFactor();
          const tempToken = crypto.randomUUID();
          pendingTwoFactorLogins.set(tempToken, {
            userId: String(dbUser.id),
            sessionData,
            responsePayload: { token: sessionToken, user: userPayload },
            expiresAt: Date.now() + 5 * 60 * 1000,
          });
          return res.json({
            success: false,
            needs_2fa: true,
            method: "totp",
            tempToken,
            message: "Skriv inn 6-sifret kode fra Authenticator-appen for å fullføre innloggingen.",
          });
        }
      } catch (totpCheckError) {
        console.error("[Auth] TOTP-sjekk feilet, fortsetter uten 2FA:", totpCheckError);
        // Best-effort: hvis TOTP-tabellen ikke finnes (gammel DB), la
        // login fortsette uten 2FA istedenfor å låse brukeren ute.
      }

      activeSessions.set(sessionToken, sessionData);
      await persistAuthSession(pool, sessionToken, sessionData);

      console.log(
        `[Auth] Login: ${dbUser.email} as ${roleRoomSessionRole} (session: ${sessionToken.substring(0, 8)}...)`,
      );

      res.json({
        success: true,
        token: sessionToken,
        user: userPayload,
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Innlogging feilet" });
    }
  });


  // ── E-post-kode-verifisering (generisk for flere purposes) ──────────────
  //
  // POST /api/auth/email-code/send    { email, purpose }
  // POST /api/auth/email-code/verify  { email, purpose, code }
  //
  // Purpose-strings: client_portal_register | password_change |
  //                  login_2fa_email | account_delete
  //
  // NB: `send` rate-limites på server-siden via at vi invaliderer
  // eksisterende kode hver gang ny sendes — så "spam send"-knapp gir
  // bare ny kode, ikke flere parallelt. For ekte rate-limiting på
  // IP-nivå anbefales nginx/cloudflare-laget.
  app.post("/api/auth/email-code/send", async (req, res) => {
    const body = (req.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>;
    const email = typeof body.email === "string" ? body.email : "";
    const purpose = typeof body.purpose === "string" ? body.purpose : "";
    const validPurposes = ["client_portal_register", "password_change", "login_2fa_email", "account_delete", "vault_reveal"] as const;
    if (!validPurposes.includes(purpose as typeof validPurposes[number])) {
      return res.status(400).json({ error: "invalid_purpose" });
    }
    const ipAddress = (req.headers["x-forwarded-for"]?.toString().split(",")[0]
      ?? req.socket?.remoteAddress
      ?? null) as string | null;
    try {
      const svc = await import("./email-verification-service.js");
      const result = await svc.sendVerificationCode(pool, {
        email,
        purpose: purpose as typeof validPurposes[number],
        ipAddress,
      });
      return res.json({
        status: result.ok ? "ok" : "failed",
        expiresAt: result.expiresAt,
        reason: result.reason ?? null,
        // KUN i dev og kun hvis SMTP mangler — slik at devs kan teste:
        ...(result.devCode ? { devCode: result.devCode } : {}),
      });
    } catch (error) {
      console.error("[auth/email-code/send] failed", error);
      return res.status(500).json({ error: "failed" });
    }
  });

  app.post("/api/auth/email-code/verify", async (req, res) => {
    const body = (req.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>;
    const email = typeof body.email === "string" ? body.email : "";
    const purpose = typeof body.purpose === "string" ? body.purpose : "";
    const code = typeof body.code === "string" ? body.code : "";
    const validPurposes = ["client_portal_register", "password_change", "login_2fa_email", "account_delete", "vault_reveal"] as const;
    if (!validPurposes.includes(purpose as typeof validPurposes[number])) {
      return res.status(400).json({ error: "invalid_purpose" });
    }
    try {
      const svc = await import("./email-verification-service.js");
      const result = await svc.verifyCode(pool, {
        email,
        purpose: purpose as typeof validPurposes[number],
        code,
      });
      if (!result.ok) {
        const httpStatus = result.reason === "wrong_code" ? 401
                         : result.reason === "max_attempts" ? 429
                         : result.reason === "expired" ? 410
                         : 400;
        return res.status(httpStatus).json({
          error: result.reason,
          attemptsRemaining: result.attemptsRemaining,
        });
      }
      return res.json({ status: "ok" });
    } catch (error) {
      console.error("[auth/email-code/verify] failed", error);
      return res.status(500).json({ error: "failed" });
    }
  });

  // ── Password reset (alle bruker-typer) ──────────────────────────────────
  //
  // POST /api/auth/request-password-reset — alltid 204 (anti-enumeration)
  // GET  /api/auth/reset-password/:token   — sjekk om token er gyldig
  // POST /api/auth/reset-password/:token   — sett nytt passord
  app.post("/api/auth/request-password-reset", async (req, res) => {
    const body = (req.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>;
    const email = typeof body.email === "string" ? body.email : "";
    const ipAddress = (req.headers["x-forwarded-for"]?.toString().split(",")[0]
      ?? req.socket?.remoteAddress
      ?? null) as string | null;
    try {
      const svc = await import("./password-reset-service.js");
      await svc.requestPasswordReset(pool, { email, ipAddress });
    } catch (error) {
      console.error("[auth/request-password-reset] failed", error);
    }
    // Alltid 204 — caller skal ikke kunne enumere hvilke e-poster som finnes
    return res.status(204).end();
  });

  app.get("/api/auth/reset-password/:token", async (req, res) => {
    const token = String(req.params.token || "").trim();
    if (!token) return res.status(400).json({ error: "missing_token" });
    try {
      const svc = await import("./password-reset-service.js");
      const info = await svc.verifyResetToken(pool, token);
      if (!info.valid) {
        return res.status(404).json({ error: info.reason ?? "not_found" });
      }
      return res.json({ status: "ok", email: info.email });
    } catch (error) {
      console.error("[auth/reset-password GET] failed", error);
      return res.status(500).json({ error: "failed" });
    }
  });

  app.post("/api/auth/reset-password/:token", async (req, res) => {
    const token = String(req.params.token || "").trim();
    const body = (req.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>;
    const password = typeof body.password === "string" ? body.password : "";
    if (!token) return res.status(400).json({ error: "missing_token" });
    try {
      const svc = await import("./password-reset-service.js");
      const result = await svc.consumeResetToken(pool, token, password);
      if (!result.ok) {
        const httpStatus = result.error === "weak_password" ? 400
                         : result.error === "expired" || result.error === "already_used" || result.error === "invalid_token" ? 410
                         : 500;
        return res.status(httpStatus).json({ error: result.error, message: result.message });
      }
      return res.json({ status: "ok", message: result.message });
    } catch (error) {
      console.error("[auth/reset-password POST] failed", error);
      return res.status(500).json({ error: "failed" });
    }
  });

  // POST /api/auth/login/complete-2fa — fullfør login etter at brukeren
  //   har gitt en 6-sifret TOTP-kode (eller backup-kode).
  //   Body: { tempToken, code }
  app.post("/api/auth/login/complete-2fa", async (req, res) => {
    purgeExpiredPendingTwoFactor();
    const body = (req.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>;
    const tempToken = typeof body.tempToken === "string" ? body.tempToken : "";
    const code = typeof body.code === "string" ? body.code : "";
    if (!tempToken || !code) {
      return res.status(400).json({ error: "missing_token_or_code" });
    }
    const pending = pendingTwoFactorLogins.get(tempToken);
    if (!pending) {
      return res.status(410).json({ error: "expired_or_invalid_temp_token" });
    }
    try {
      const totpSvc = await import("./totp-2fa-service.js");
      const result = await totpSvc.verifyLoginToken(pool, { userId: pending.userId, token: code });
      if (!result.ok) {
        return res.status(401).json({
          error: result.reason ?? "wrong_code",
          message: result.reason === "wrong_code"
            ? "Feil kode. Sjekk Authenticator-appen og prøv igjen."
            : "Verifisering feilet.",
        });
      }
      // Commit session
      pendingTwoFactorLogins.delete(tempToken);
      const sessionToken = String(pending.responsePayload.token);
      activeSessions.set(sessionToken, pending.sessionData);
      await persistAuthSession(pool, sessionToken, pending.sessionData);
      console.log(`[Auth] 2FA login completed for ${pending.sessionData.email}${result.usedBackupCode ? " (backup-code)" : ""}`);
      return res.json({
        success: true,
        usedBackupCode: result.usedBackupCode === true,
        ...pending.responsePayload,
      });
    } catch (error) {
      console.error("[/api/auth/login/complete-2fa] failed", error);
      return res.status(500).json({ error: "failed" });
    }
  });

  // POST /api/auth/logout — Logout
  app.post("/api/auth/logout", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (token) {
      activeSessions.delete(token);
      await deletePersistedAuthSession(pool, token);
    }
    res.json({ success: true });
  });

  // GET /api/auth/user — Get current user from session
  app.get("/api/auth/user", async (req, res) => {
    const session = await resolveActiveSessionFromRequest(req);
    if (!session) {
      return res.json({ user: null, authenticated: false });
    }

    try {
      const user = await buildSessionUserFromActiveSession(session);
      return res.json({
        user,
        authenticated: true,
      });
    } catch (error) {
      console.error("Auth user session resolution error:", error);
      return res.status(500).json({
        user: null,
        authenticated: false,
        error: "Could not resolve session user",
      });
    }
  });

  // ── TOTP 2FA (Google Authenticator / 1Password / Authy) ────────────────
  //
  // GET   /api/2fa/status                — om 2FA er aktivert
  // POST  /api/2fa/setup                 — mint secret + returner QR
  // POST  /api/2fa/verify-and-enable     — bekreft første kode + aktiver
  // POST  /api/2fa/disable               — slå av (krever auth)
  // POST  /api/2fa/login-verify          — brukes etter passord-valid
  //                                         i login-flow
  //
  // /api/2fa/status og /verify-and-enable krever vanlig session.
  // /login-verify brukes UTEN session — kun via temp-token-flow under
  // login (kommer i en etterfølgende patch).

  // /api/2fa/* (5 endpoints) → ./twofa-routes.ts

  app.get("/api/auth/status", async (req, res) => {
    const session = await resolveActiveSessionFromRequest(req);
    if (session) {
      return res.json({ authenticated: true, user: session });
    }
    res.json({ authenticated: false, user: null });
  });

  app.get("/api/auth/session-status", async (req, res) => {
    if (await resolveActiveSessionFromRequest(req)) {
      return res.json({ active: true, authenticated: true });
    }
    res.json({ active: false, authenticated: false });
  });

  // Mobile / iPad sign-in: client (e.g. iPad CaptureApp) obtains a Google
  // ID token via the Google Sign-In SDK, posts it here, and gets back a
  // CreatorHub bearer that works against /api/capture/* and any other
  // requireAuth-gated route. Cheaper than running the full web OAuth dance
  // from a native app and avoids needing a redirect URI scheme at all.
  // Logic lives in google-id-token-service.ts so it can be unit-tested
  // without spinning up Express.
  app.post("/api/auth/google/token", async (req, res) => {
    try {
      const idToken = typeof req.body?.idToken === "string" ? req.body.idToken : "";
      const result = await exchangeGoogleIdToken({
        idToken,
        pool,
        activeSessions,
      });
      if (!result.ok) {
        return res.status(result.status).json({ error: result.error });
      }
      return res.json({ success: true, token: result.token, user: result.user });
    } catch (error) {
      console.error("[Auth] /api/auth/google/token failed:", error);
      return res.status(500).json({ error: "internal_error" });
    }
  });

  // GET /api/auth/public-session — minimal public session details for dashboard bootstrap
  app.get("/api/auth/public-session", async (req, res) => {
    const session = await resolveActiveSessionFromRequest(req);

    if (session) {
      return res.json({
        authenticated: true,
        sessionId: readActiveSessionToken(req),
        userId: session.userId,
        email: session.email,
        name: session.displayName || session.name,
        role: session.role,
        loginAt: session.loginAt,
      });
    }

    res.json({
      authenticated: false,
      sessionId: null,
      userId: "guest",
      email: null,
      name: null,
      role: "guest",
      loginAt: null,
    });
  });
}
