import express from "express";
import type { Pool } from "pg";

export interface TwoFaRoutesDeps {
  app: express.Application;
  pool: Pool;
  resolveActiveSessionFromRequest: (req: express.Request) => Promise<any>;
}

export function setupTwoFaRoutes(deps: TwoFaRoutesDeps): void {
  const { app, pool, resolveActiveSessionFromRequest } = deps;

  app.get("/api/2fa/status", async (req, res) => {
    const session = await resolveActiveSessionFromRequest(req);
    if (!session) return res.status(401).json({ error: "not_authenticated" });
    try {
      const svc = await import("./totp-2fa-service.js");
      const status = await svc.getTotpStatus(pool, session.userId);
      const backupCodesRemaining = status.enabled
        ? await svc.countUnusedBackupCodes(pool, session.userId)
        : 0;
      return res.json({
        enabled: status.enabled,
        pending: status.pending,
        backupCodesRemaining,
      });
    } catch (error) {
      console.error("[/api/2fa/status] failed", error);
      return res.status(500).json({ error: "failed" });
    }
  });

  app.post("/api/2fa/setup", async (req, res) => {
    const session = await resolveActiveSessionFromRequest(req);
    if (!session) return res.status(401).json({ error: "not_authenticated" });
    try {
      const svc = await import("./totp-2fa-service.js");
      const setup = await svc.startSetup(pool, {
        userId: session.userId,
        userEmail: session.email,
      });
      return res.json({
        secret: setup.secret,
        otpauthUrl: setup.otpauthUrl,
        qrPngDataUrl: setup.qrPngDataUrl,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("[/api/2fa/setup] failed", msg);
      return res
        .status(500)
        .json({ error: "setup_failed", message: msg });
    }
  });

  app.post("/api/2fa/verify-and-enable", async (req, res) => {
    const session = await resolveActiveSessionFromRequest(req);
    if (!session) return res.status(401).json({ error: "not_authenticated" });
    const body = (
      req.body && typeof req.body === "object" ? req.body : {}
    ) as Record<string, unknown>;
    const token = typeof body.token === "string" ? body.token : "";
    if (!token) return res.status(400).json({ error: "missing_token" });
    try {
      const svc = await import("./totp-2fa-service.js");
      const result = await svc.verifyAndEnable(pool, {
        userId: session.userId,
        token,
      });
      if (!result.ok) {
        return res
          .status(result.reason === "wrong_code" ? 401 : 400)
          .json({ error: result.reason });
      }
      return res.json({
        status: "ok",
        backupCodes: result.backupCodes,
        message:
          "2FA er aktivert. Lagre backup-kodene et trygt sted — de vises kun denne ene gangen.",
      });
    } catch (error) {
      console.error("[/api/2fa/verify-and-enable] failed", error);
      return res.status(500).json({ error: "failed" });
    }
  });

  app.post("/api/2fa/disable", async (req, res) => {
    const session = await resolveActiveSessionFromRequest(req);
    if (!session) return res.status(401).json({ error: "not_authenticated" });
    try {
      const svc = await import("./totp-2fa-service.js");
      await svc.disableTotp(pool, session.userId);
      return res.json({ status: "ok" });
    } catch (error) {
      console.error("[/api/2fa/disable] failed", error);
      return res.status(500).json({ error: "failed" });
    }
  });

  // Brukes av /api/auth/login når password-valid og bruker har 2FA på.
  // Endpoint validerer ikke passord selv — caller er ansvarlig for det.
  app.post("/api/2fa/login-verify", async (req, res) => {
    const body = (
      req.body && typeof req.body === "object" ? req.body : {}
    ) as Record<string, unknown>;
    const userId = typeof body.userId === "string" ? body.userId : "";
    const token = typeof body.token === "string" ? body.token : "";
    if (!userId || !token)
      return res
        .status(400)
        .json({ error: "missing_userid_or_token" });
    try {
      const svc = await import("./totp-2fa-service.js");
      const result = await svc.verifyLoginToken(pool, { userId, token });
      if (!result.ok) {
        return res.status(401).json({ error: result.reason });
      }
      return res.json({
        status: "ok",
        usedBackupCode: result.usedBackupCode === true,
      });
    } catch (error) {
      console.error("[/api/2fa/login-verify] failed", error);
      return res.status(500).json({ error: "failed" });
    }
  });
}
