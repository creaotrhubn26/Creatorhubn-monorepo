/**
 * microsoft-oauth-routes.ts — «Koble til Outlook»-flyt for kvittering-skann.
 *
 * Auth-mønster: frontend henter authorize-URL via apiRequest (bearer i header)
 * → redirecter nettleseren dit. Callbacken stoler IKKE på cookie/session, men
 * på en HMAC-signert `state` som bærer userId (signState/verifyState). Alt gated
 * bak MICROSOFT_CLIENT_ID/SECRET — uten dem svarer /url {configured:false}.
 */
import type express from "express";
import type { Pool } from "pg";
import {
  isMicrosoftConfigured, getMicrosoftAuthUrl, signState, verifyState,
  exchangeCodeForTokens, fetchMicrosoftProfile, saveMicrosoftConnection,
  getMicrosoftStatus, disconnectMicrosoft, getFreshMicrosoftAccessToken,
} from "./microsoft-graph.js";

type SessionUser = { userId: string; email: string; name: string; role: string };

export interface MicrosoftOauthRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireUserSession: (req: express.Request, res: express.Response) => SessionUser | null;
}

function frontendUrl(): string {
  return process.env.PUBLIC_FRONTEND_URL || "https://creatorhubn.com";
}

export function setupMicrosoftOauthRoutes(deps: MicrosoftOauthRoutesDeps): void {
  const { app, pool, requireUserSession } = deps;

  // Authorize-URL (kalt med bearer). Frontend redirecter nettleseren til url.
  app.get("/api/creatorhub/microsoft/oauth/url", (req, res) => {
    const session = requireUserSession(req, res); if (!session) return;
    if (!isMicrosoftConfigured()) return res.json({ configured: false, url: null });
    res.json({ configured: true, url: getMicrosoftAuthUrl(signState(session.userId)) });
  });

  // OAuth-callback (nettleser-redirect fra Microsoft). Ingen session — verifiser state.
  app.get("/api/creatorhub/microsoft/oauth/callback", async (req, res) => {
    const back = (flag: string) => res.redirect(`${frontendUrl()}/?outlook=${flag}`);
    try {
      if (!isMicrosoftConfigured()) return back("not_configured");
      const error = String((req.query as any)?.error || "");
      if (error) return back("denied");
      const code = String((req.query as any)?.code || "");
      const state = String((req.query as any)?.state || "");
      const userId = verifyState(state);
      if (!code || !userId) return back("invalid");
      const tokens = await exchangeCodeForTokens(code);
      let profile: any = {};
      try { profile = await fetchMicrosoftProfile(tokens.access_token); } catch { profile = {}; }
      await saveMicrosoftConnection(pool, userId, tokens, profile);
      return back("connected");
    } catch (e) {
      console.error("[microsoft-oauth] callback", e);
      return back("failed");
    }
  });

  // Status — er Outlook koblet? (+ om integrasjonen i det hele tatt er konfigurert)
  app.get("/api/creatorhub/microsoft/status", async (req, res) => {
    const session = requireUserSession(req, res); if (!session) return;
    try {
      const st = await getMicrosoftStatus(pool, session.userId);
      res.json({ configured: isMicrosoftConfigured(), ...st });
    } catch (e) { console.error("[microsoft-oauth] status", e); res.json({ configured: isMicrosoftConfigured(), connected: false, email: null }); }
  });

  // Koble fra
  app.post("/api/creatorhub/microsoft/disconnect", async (req, res) => {
    const session = requireUserSession(req, res); if (!session) return;
    try { await disconnectMicrosoft(pool, session.userId); res.json({ ok: true }); }
    catch (e) { console.error("[microsoft-oauth] disconnect", e); res.status(500).json({ error: "disconnect_failed" }); }
  });

  // Lett helsesjekk (brukes internt av skann for å avgjøre om vi skal spørre Graph)
  void getFreshMicrosoftAccessToken;
}
