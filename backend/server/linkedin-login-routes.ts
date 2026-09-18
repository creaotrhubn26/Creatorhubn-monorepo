/**
 * Logg inn med LinkedIn — HTTP-ruter for web og Leadgrid iOS.
 *
 *   Web:
 *     POST /api/auth/linkedin/oauth/start      { returnPath?, browserOrigin? } → { authorizationUrl }
 *     GET  /api/auth/linkedin/login-callback   (forwardet fra /api/auth/linkedin/callback når state
 *                                               starter med lgn_) → redirect returnPath?chLinkedInStatus=…
 *     GET  /api/auth/linkedin/session-result/:transferId → { sessionToken, user } (one-shot)
 *   iOS:
 *     GET  /api/leadgrid/auth/linkedin/start?platform=ios → { auth_url, state }
 *     (samme callback) → redirect leadgrid://oauth?linkedin_transfer=…
 *     POST /api/leadgrid/auth/linkedin/exchange { transfer, deviceInfo } → { bearer, user, … } (one-shot)
 *   Felles:
 *     GET  /api/auth/linkedin/login-status → { enabled }
 *
 * Samme LinkedIn-app og callback-URL som Role Room-tilkoblingen; login ber
 * bare om openid profile email. State og transfer ligger i databasen
 * (role-room-oauth-store) så flyten tåler flere backend-pods.
 */

import crypto from "node:crypto";
import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { persistAuthSession } from "./auth-session-store.js";
import {
  consumeOauthState,
  consumeOauthTransfer,
  persistOauthState,
  persistOauthTransfer,
} from "./role-room-oauth-store.js";
import { resolveLinkedInOauthClient, resolveLinkedInRedirectUri } from "./linkedin-oauth-config.js";
import { RateLimitExceededError, checkEndpointRateLimit } from "./role-room-agent-ratelimit.js";
import { isTrustedWebOrigin, safeReturnPath } from "./web-origin-allowlist.js";
import {
  buildLinkedInAuthorizationUrl,
  createLinkedInLoginState,
  exchangeLinkedInCodeForProfile,
  isLinkedInLoginState,
  linkedInLoginEnabled,
  resolveOrCreateUserFromLinkedIn,
  type LinkedInLoginUser,
} from "./linkedin-login.js";

type SessionData = {
  userId: string;
  role?: string;
  email?: string;
  name?: string;
  loginAt?: string;
};

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
  uploadImage?: (buffer: Buffer, mimeType: string, key: string) => Promise<string>;
  fetchImpl?: typeof fetch;
}

type Platform = "web" | "ios";

type LoginState = {
  kind: "linkedin_login";
  platform: Platform;
  createdAt: number;
  redirectUri: string;
  returnPath: string;
  browserOrigin: string | null;
};

type LoginTransfer = {
  kind: "linkedin_login";
  platform: Platform;
  createdAt: number;
  sessionToken: string | null;
  user: {
    id: string;
    email: string;
    role: string;
    name: string;
    first_name: string | null;
    last_name: string | null;
    picture: string | null;
    verified_email: true;
  };
  isNew: boolean;
  matchedBy: LinkedInLoginUser["matchedBy"];
  organizationId: string | null;
};

const STATE_TTL_MS = 10 * 60 * 1000;
const TRANSFER_TTL_MS = 5 * 60 * 1000;
const DEFAULT_RETURN_PATH = "/login";
const IOS_SCHEME = "leadgrid";

function requestString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) return null;
  return normalized;
}

function trustedOrigin(value: unknown): string | null {
  const candidate = requestString(value, 256);
  if (!candidate) return null;
  try {
    const origin = new URL(candidate).origin;
    return isTrustedWebOrigin(origin) ? origin : null;
  } catch {
    return null;
  }
}

function appendQuery(path: string, params: Record<string, string | null | undefined>): string {
  const [pathname, hash = ""] = path.split("#", 2);
  const [base, search = ""] = pathname.split("?", 2);
  const query = new URLSearchParams(search);
  for (const [key, value] of Object.entries(params)) {
    if (value == null) continue;
    query.set(key, value);
  }
  const qs = query.toString();
  return `${base}${qs ? `?${qs}` : ""}${hash ? `#${hash}` : ""}`;
}

function webReturnUrl(state: Pick<LoginState, "returnPath" | "browserOrigin">, params: Record<string, string | null | undefined>): string {
  const nextPath = appendQuery(state.returnPath, params);
  return state.browserOrigin ? `${state.browserOrigin}${nextPath}` : nextPath;
}

function iosReturnUrl(params: Record<string, string | null | undefined>): string {
  return appendQuery(`${IOS_SCHEME}://oauth`, params);
}

function transferUser(user: LinkedInLoginUser): LoginTransfer["user"] {
  return {
    id: user.userId,
    email: user.email,
    role: user.role,
    name: user.name,
    first_name: user.firstName,
    last_name: user.lastName,
    picture: user.picture,
    verified_email: true,
  };
}

function clientKey(req: Request): string {
  return requestString(req.ip, 128) ?? "unknown";
}

export function registerLinkedInLoginRoutes({ app, pool, activeSessions, uploadImage, fetchImpl }: Deps): void {
  const resolveConfig = (req: Request) => {
    const client = resolveLinkedInOauthClient();
    const redirectUri = resolveLinkedInRedirectUri(req);
    return {
      ...client,
      redirectUri,
      enabled: linkedInLoginEnabled() && client.complete && Boolean(redirectUri),
    };
  };

  async function startLogin(req: Request, res: Response, platform: Platform, options: { returnPath?: unknown; browserOrigin?: unknown }) {
    try {
      checkEndpointRateLimit(clientKey(req), "linkedin_login_start", 20);
    } catch (error) {
      if (error instanceof RateLimitExceededError) {
        res.setHeader("Retry-After", String(error.retryAfterSeconds));
        return res.status(429).json({ error: "rate_limited", message: "For mange forsøk. Vent litt og prøv igjen." });
      }
      throw error;
    }

    const config = resolveConfig(req);
    if (!config.enabled || !config.clientId || !config.redirectUri) {
      return res.status(503).json({ error: "linkedin_login_unavailable", message: "LinkedIn-innlogging er ikke tilgjengelig." });
    }

    const state = createLinkedInLoginState();
    const payload: LoginState = {
      kind: "linkedin_login",
      platform,
      createdAt: Date.now(),
      redirectUri: config.redirectUri,
      returnPath: safeReturnPath(options.returnPath, DEFAULT_RETURN_PATH),
      browserOrigin: trustedOrigin(options.browserOrigin),
    };
    const persisted = await persistOauthState(pool, state, payload, new Date(payload.createdAt + STATE_TTL_MS));
    if (!persisted) {
      return res.status(503).json({ error: "oauth_state_unavailable", message: "Kunne ikke starte innloggingen. Prøv igjen." });
    }

    const authorizationUrl = buildLinkedInAuthorizationUrl({
      clientId: config.clientId,
      redirectUri: config.redirectUri,
      state,
    });
    return platform === "ios"
      ? res.json({ auth_url: authorizationUrl, state })
      : res.json({ authorizationUrl, state });
  }

  app.get("/api/auth/linkedin/login-status", (req, res) => {
    res.json({ enabled: resolveConfig(req).enabled });
  });

  app.post("/api/auth/linkedin/oauth/start", async (req, res) => {
    try {
      await startLogin(req, res, "web", {
        returnPath: req.body?.returnPath,
        browserOrigin: req.body?.browserOrigin ?? req.get("origin"),
      });
    } catch (error) {
      console.error("[linkedin-login] start failed", error);
      res.status(500).json({ error: "internal_error" });
    }
  });

  app.get("/api/leadgrid/auth/linkedin/start", async (req, res) => {
    const platform = requestString(req.query.platform, 32) ?? "ios";
    if (platform !== "ios") {
      return res.status(400).json({ error: "Ugyldig platform" });
    }
    try {
      await startLogin(req, res, "ios", {});
    } catch (error) {
      console.error("[linkedin-login] ios start failed", error);
      res.status(500).json({ error: "internal_error" });
    }
  });

  app.get("/api/auth/linkedin/login-callback", async (req, res) => {
    const stateId = requestString(req.query.state, 64);
    if (!isLinkedInLoginState(stateId)) {
      return res.status(400).send("Ugyldig state");
    }
    const state = await consumeOauthState<LoginState>(pool, stateId);
    if (!state || state.kind !== "linkedin_login") {
      return res.status(400).send("Innloggingen er utløpt. Start på nytt.");
    }

    const fail = (message: string) =>
      res.redirect(
        state.platform === "ios"
          ? iosReturnUrl({ error: message })
          : webReturnUrl(state, { chLinkedInStatus: "error", chLinkedInMessage: message }),
      );

    const oauthError = requestString(req.query.error, 256);
    if (oauthError) {
      return fail(oauthError === "user_cancelled_login" || oauthError === "user_cancelled_authorize"
        ? "Innloggingen ble avbrutt."
        : requestString(req.query.error_description, 512) ?? "LinkedIn avviste innloggingen.");
    }
    const code = requestString(req.query.code, 8_192);
    if (!code) {
      return fail("Mangler kode fra LinkedIn.");
    }

    const config = resolveConfig(req);
    if (!config.enabled || !config.clientId || !config.clientSecret) {
      return fail("LinkedIn-innlogging er ikke tilgjengelig.");
    }

    try {
      const exchanged = await exchangeLinkedInCodeForProfile(
        { code, clientId: config.clientId, clientSecret: config.clientSecret, redirectUri: state.redirectUri },
        fetchImpl,
      );
      if (!exchanged.ok) {
        return fail(exchanged.message);
      }
      const resolved = await resolveOrCreateUserFromLinkedIn(pool, exchanged.profile, { uploadImage, fetchImpl });
      if (!resolved.ok) {
        return fail(resolved.message);
      }
      const { user } = resolved;

      let sessionToken: string | null = null;
      if (state.platform === "web") {
        sessionToken = crypto.randomUUID();
        const session = {
          userId: user.userId,
          email: user.email,
          name: user.name,
          role: user.role,
          loginAt: new Date().toISOString(),
          isAdmin: user.role === "admin" || user.role === "super_admin",
          verified_email: true,
          picture: user.picture ?? undefined,
        };
        activeSessions.set(sessionToken, session);
        await persistAuthSession(pool, sessionToken, session);
      }

      const transferId = crypto.randomUUID();
      const transfer: LoginTransfer = {
        kind: "linkedin_login",
        platform: state.platform,
        createdAt: Date.now(),
        sessionToken,
        user: transferUser(user),
        isNew: user.isNew,
        matchedBy: user.matchedBy,
        organizationId: user.organizationId,
      };
      const persisted = await persistOauthTransfer(pool, transferId, transfer, new Date(transfer.createdAt + TRANSFER_TTL_MS));
      if (!persisted) {
        return fail("Kunne ikke fullføre innloggingen. Prøv igjen.");
      }

      return res.redirect(
        state.platform === "ios"
          ? iosReturnUrl({ linkedin_transfer: transferId })
          : webReturnUrl(state, { chLinkedInStatus: "success", chLinkedInTransfer: transferId }),
      );
    } catch (error) {
      console.error("[linkedin-login] callback failed", error);
      return fail("LinkedIn-innloggingen feilet. Prøv igjen.");
    }
  });

  app.get("/api/auth/linkedin/session-result/:transferId", async (req, res) => {
    const transferId = requestString(req.params.transferId, 64);
    if (!transferId) {
      return res.status(400).json({ error: "transferId mangler" });
    }
    const transfer = await consumeOauthTransfer<LoginTransfer>(pool, transferId);
    if (!transfer || transfer.kind !== "linkedin_login" || transfer.platform !== "web" || !transfer.sessionToken) {
      return res.status(404).json({ error: "LinkedIn-innloggingen er utløpt eller allerede brukt." });
    }
    res.json({
      success: true,
      sessionToken: transfer.sessionToken,
      user: transfer.user,
      isNew: transfer.isNew,
    });
  });

  app.post("/api/leadgrid/auth/linkedin/exchange", async (req, res) => {
    const transferId = requestString(req.body?.transfer, 64);
    if (!transferId) {
      return res.status(400).json({ error: "transfer påkrevd" });
    }
    const transfer = await consumeOauthTransfer<LoginTransfer>(pool, transferId);
    if (!transfer || transfer.kind !== "linkedin_login" || transfer.platform !== "ios") {
      return res.status(404).json({ error: "linkedin_transfer_expired" });
    }

    const deviceInfo = (req.body?.deviceInfo ?? {}) as Record<string, unknown>;
    const deviceName = requestString(deviceInfo.name, 255) ?? requestString(deviceInfo.deviceName, 255) ?? "LinkedIn Sign-In";
    const deviceModel = requestString(deviceInfo.model, 120);
    const osVersion = requestString(deviceInfo.osVersion, 40);
    const appVersion = requestString(deviceInfo.appVersion, 40);
    const bearer = crypto.randomBytes(32).toString("hex");

    try {
      try {
        await pool.query(
          `INSERT INTO ipad_tokens (token, user_id, device_name, device_model, os_version, app_version, source, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, 'linkedin_signin', now())`,
          [bearer, transfer.user.id, deviceName, deviceModel, osVersion, appVersion],
        );
      } catch {
        await pool.query(
          `INSERT INTO ipad_tokens (token, user_id, device_name, device_model, os_version, app_version, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, now())`,
          [bearer, transfer.user.id, deviceName, deviceModel, osVersion, appVersion],
        );
      }
    } catch (error) {
      console.error("[linkedin-login] ios bearer persist failed", error);
      return res.status(500).json({ error: "internal_error" });
    }

    activeSessions.set(bearer, {
      userId: transfer.user.id,
      email: transfer.user.email,
      role: transfer.user.role,
      name: transfer.user.name,
      loginAt: new Date().toISOString(),
    });

    res.json({
      bearer,
      user: { id: transfer.user.id, email: transfer.user.email, role: transfer.user.role },
      is_new_user: transfer.isNew,
      organization_id: transfer.organizationId,
    });
  });
}
