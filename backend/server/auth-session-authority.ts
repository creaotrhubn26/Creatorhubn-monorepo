import { timingSafeEqual } from "node:crypto";
import type { Request, RequestHandler } from "express";
import type { Pool } from "pg";
import { renewPersistedAuthSession } from "./auth-session-store.js";

export type AuthoritativeAuthSession = {
  userId: string;
  email: string;
  name: string;
  role: string;
  loginAt: string;
  authSessionVersion: string;
  isAdmin?: boolean;
  [key: string]: unknown;
};

export type AuthoritativeAuthSessionResolution =
  | { status: "authenticated"; session: AuthoritativeAuthSession }
  | { status: "unauthenticated" }
  | { status: "unavailable" };

type AuthoritativeSessionRow = {
  session_data: unknown;
  user_id: string | null;
  user_email: string | null;
  user_role: string | null;
  user_is_active: boolean | null;
  auth_session_version: string | number | bigint | null;
  impersonator_user_id: string | null;
  impersonator_role: string | null;
  impersonator_is_active: boolean | null;
  impersonator_auth_session_version: string | number | bigint | null;
};

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const READ_METHODS = new Set(["GET", "HEAD"]);
const ADMIN_IMPERSONATOR_ROLES = new Set(["admin", "super_admin"]);
const SENSITIVE_SESSION_PATHS = [
  /^\/api\/leadgrid\/canvas(?:\/|$)/i,
  /^\/api\/leadgrid\/canvas-rolle-policy$/i,
  /^\/api\/leadgrid\/oppgaver(?:\/|$)/i,
  /^\/api\/leadgrid\/moter(?:\/|$)/i,
  /^\/api\/admin-room\/lead-map(?:\/|$)/i,
  /^\/api\/admin-room\/ipad-tokens(?:\/|$)/i,
] as const;

export type LeadgridIndependentCredentialConfig = {
  workflowEventServiceToken?: string | null;
  cronTokensByPath?: Readonly<
    Record<string, readonly (string | null | undefined)[]>
  >;
};

export type AuthoritativeSessionRequestResolver = (
  req: Request,
) => Promise<
  | { status: "authenticated"; session: unknown }
  | { status: "unauthenticated" }
  | { status: "unavailable" }
>;

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

/**
 * PostgreSQL BIGINT values normally arrive as strings. Keep the canonical
 * decimal string in JSON so the comparison never loses precision in JS.
 */
export function normalizeAuthSessionVersion(value: unknown): string | null {
  if (typeof value === "bigint") {
    return value >= BigInt(0) ? value.toString() : null;
  }
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value >= 0 ? String(value) : null;
  }
  if (typeof value !== "string" || !/^\d+$/.test(value.trim())) return null;
  try {
    const parsed = BigInt(value.trim());
    return parsed >= BigInt(0) ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function parseSessionSnapshot(value: unknown): AuthoritativeAuthSession | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const userId = nonEmptyString(record.userId);
  const email = nonEmptyString(record.email);
  const name = nonEmptyString(record.name);
  const role = nonEmptyString(record.role);
  const loginAt = nonEmptyString(record.loginAt);
  // Sessions minted before migration 0464 have no snapshot field. Treat only
  // that absent JSON property as version zero, matching the users-column
  // default. Explicit null/malformed/negative values remain invalid.
  const authSessionVersion = normalizeAuthSessionVersion(
    Object.prototype.hasOwnProperty.call(record, "authSessionVersion")
      ? record.authSessionVersion
      : "0",
  );
  if (!userId || !email || !name || !role || !loginAt || authSessionVersion === null) {
    return null;
  }
  return {
    ...record,
    userId,
    email,
    name,
    role,
    loginAt,
    authSessionVersion,
  } as AuthoritativeAuthSession;
}

/**
 * Resolve a persisted session and the current user row in one statement.
 *
 * The LEFT JOIN is intentional: a deleted user still produces a session row,
 * which is then classified as unauthenticated rather than as a database error.
 * Cache eviction on every mismatch prevents a stale in-memory role/version
 * from being used by the synchronous route-local guards that run next.
 */
export async function resolveAuthoritativeAuthSession(input: {
  pool: Pick<Pool, "query">;
  token: string;
  activeSessions: Map<string, AuthoritativeAuthSession | any>;
  onEvict?: (token: string) => void;
}): Promise<AuthoritativeAuthSessionResolution> {
  const token = input.token.trim();
  if (!token || token.length > 512) return { status: "unauthenticated" };

  const evict = (): AuthoritativeAuthSessionResolution => {
    input.activeSessions.delete(token);
    input.onEvict?.(token);
    return { status: "unauthenticated" };
  };

  try {
    const result = await input.pool.query<AuthoritativeSessionRow>(
      `WITH expired_impersonation AS (
         DELETE FROM creatorhub_auth_sessions
          WHERE token = $1
            AND session_data->>'impersonatedByAdmin' = 'true'
            AND (expires_at IS NULL OR expires_at <= NOW())
          RETURNING token
       )
       SELECT s.session_data,
              u.id::text AS user_id,
              u.email::text AS user_email,
              COALESCE(NULLIF(TRIM(u.role::text), ''), 'user') AS user_role,
              COALESCE(u.is_active, TRUE) AS user_is_active,
              u.auth_session_version::text AS auth_session_version,
              impersonator.id::text AS impersonator_user_id,
              COALESCE(NULLIF(TRIM(impersonator.role::text), ''), 'user')
                AS impersonator_role,
              COALESCE(impersonator.is_active, TRUE)
                AS impersonator_is_active,
              impersonator.auth_session_version::text
                AS impersonator_auth_session_version
         FROM creatorhub_auth_sessions s
         LEFT JOIN users u
           ON u.id::text = s.session_data->>'userId'
         LEFT JOIN users impersonator
           ON impersonator.id::text = s.session_data->>'impersonatorId'
        WHERE s.token = $1
          AND s.expires_at IS NOT NULL
          AND s.expires_at > NOW()
        LIMIT 1`,
      [token],
    );
    const row = result.rows[0];
    const snapshot = parseSessionSnapshot(row?.session_data);
    const currentVersion = normalizeAuthSessionVersion(
      row?.auth_session_version,
    );
    if (
      !row ||
      !snapshot ||
      !row.user_id ||
      row.user_is_active !== true ||
      currentVersion === null ||
      snapshot.userId !== row.user_id ||
      snapshot.authSessionVersion !== currentVersion
    ) {
      return evict();
    }

    if (snapshot.impersonatedByAdmin === true) {
      const revokeImpersonation = async (): Promise<AuthoritativeAuthSessionResolution> => {
        evict();
        await input.pool.query(
          `DELETE FROM creatorhub_auth_sessions
            WHERE token = $1
              AND session_data->>'impersonatedByAdmin' = 'true'`,
          [token],
        );
        return { status: "unauthenticated" };
      };
      const impersonatorId = nonEmptyString(snapshot.impersonatorId);
      const issuedImpersonatorVersion = normalizeAuthSessionVersion(
        snapshot.impersonatorAuthSessionVersion,
      );
      const issuedImpersonatorRole = nonEmptyString(
        snapshot.impersonatorRole,
      )?.toLowerCase() ?? null;
      const currentImpersonatorVersion = normalizeAuthSessionVersion(
        row.impersonator_auth_session_version,
      );
      const currentImpersonatorRole = nonEmptyString(
        row.impersonator_role,
      )?.toLowerCase() ?? null;
      if (
        !impersonatorId ||
        issuedImpersonatorVersion === null ||
        !issuedImpersonatorRole ||
        !ADMIN_IMPERSONATOR_ROLES.has(issuedImpersonatorRole) ||
        row.impersonator_user_id !== impersonatorId ||
        row.impersonator_is_active !== true ||
        currentImpersonatorVersion === null ||
        currentImpersonatorVersion !== issuedImpersonatorVersion ||
        currentImpersonatorRole !== issuedImpersonatorRole ||
        !ADMIN_IMPERSONATOR_ROLES.has(currentImpersonatorRole)
      ) {
        return await revokeImpersonation();
      }
      const expiresAt = snapshot.impersonationExpiresAt;
      if (
        typeof expiresAt !== "number" ||
        !Number.isSafeInteger(expiresAt) ||
        expiresAt <= Date.now()
      ) {
        // Evict first so a failed cleanup can never leave the expired elevated
        // context usable in this process. The snapshot check is authoritative;
        // deleting the inert canonical row prevents later rehydration noise.
        return await revokeImpersonation();
      }
    }

    const currentRole = nonEmptyString(row.user_role) ?? "user";
    const session: AuthoritativeAuthSession = {
      ...snapshot,
      userId: row.user_id,
      email: nonEmptyString(row.user_email) ?? snapshot.email,
      role: currentRole,
      authSessionVersion: currentVersion,
      isAdmin: currentRole === "admin" || currentRole === "super_admin",
    };
    input.activeSessions.set(token, session);
    // Authoritative native/Canvas requests bypass loadPersistedAuthSession;
    // renew through the same 29d/30d throttled policy so an actively used iPad
    // bearer does not expire merely because every request took the strict path.
    if (snapshot.impersonatedByAdmin !== true) {
      renewPersistedAuthSession(input.pool, token);
    }
    return { status: "authenticated", session };
  } catch (error) {
    console.warn("[auth] authoritative session verification unavailable:", error);
    return { status: "unavailable" };
  }
}

function requestPath(req: Pick<Request, "originalUrl" | "url" | "path">): string {
  const raw = req.originalUrl || req.url || req.path;
  return raw
    .split("?", 1)[0]
    .replace(/\/{2,}/gu, "/")
    .replace(/\/+$/, "") || "/";
}

function scalarHeader(value: string | string[] | undefined): string | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (typeof candidate !== "string") return null;
  const normalized = candidate.trim();
  return normalized ? normalized : null;
}

function bearerToken(value: string | string[] | undefined): string | null {
  const authorization = scalarHeader(value);
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length).trim();
  return token || null;
}

function credentialEquals(
  provided: string | null,
  expected: string | null | undefined,
  minimumLength = 1,
): boolean {
  if (!provided || !expected || expected.length < minimumLength) return false;
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Session-version middleware must not replace the independent credentials on
 * public, signed-webhook or cron endpoints. The downstream route still owns
 * validation of its magic token, HMAC or cron secret.
 */
export function leadgridWriteNeedsAuthoritativeSession(
  req: Pick<Request, "method" | "originalUrl" | "url" | "path" | "headers">,
  independentCredentials: LeadgridIndependentCredentialConfig = {},
): boolean {
  const method = req.method.toUpperCase();
  const path = requestPath(req);
  const isSensitiveSessionRequest = SENSITIVE_SESSION_PATHS.some((pattern) =>
    pattern.test(path),
  );
  if (
    !WRITE_METHODS.has(method) &&
    !(READ_METHODS.has(method) && isSensitiveSessionRequest)
  ) return false;

  // Customer-facing pitch-deck shares are capability URLs, not user-session
  // routes. Keep both the HTML and 1x1 tracking pixel public.
  if (
    READ_METHODS.has(method) &&
    /^\/api\/admin-room\/lead-map\/pitch-deck\/p\/[^/]+$/i.test(path)
  ) return false;

  const cronToken = scalarHeader(req.headers["x-cron-trigger-token"]);
  const allowedCronTokens = independentCredentials.cronTokensByPath?.[path] ?? [];
  if (
    method === "POST" &&
    allowedCronTokens.some((expected) =>
      credentialEquals(cronToken, expected),
    )
  ) return false;

  // Canvas responses contain private drawings, OCR text, document metadata and
  // PDF bytes. Reads therefore use the same persisted-session authority as
  // writes, while unrelated legacy Leadgrid GET routes keep their hot path.
  if (isSensitiveSessionRequest) return true;

  const publicPosts = new Set([
    "/api/leadgrid/auth/google/callback",
    "/api/leadgrid/auth/google/exchange",
    "/api/leadgrid/self-onboard",
    "/api/leadgrid/self-onboard/consume-magic",
    "/api/leadgrid/developer-application",
    "/api/leadgrid/signup-interest",
    "/api/leadgrid/demo-request",
    "/api/leadgrid/app-waitlist",
    "/api/leadgrid/testimonials",
  ]);
  if (method === "POST" && publicPosts.has(path)) return false;

  const workflowEventPosts = new Set([
    "/api/leadgrid/events/email/opened",
    "/api/leadgrid/events/email/link-clicked",
    "/api/leadgrid/events/meetings/booked",
    "/api/leadgrid/events/meetings/no-show",
    "/api/leadgrid/events/proposals/opened",
    "/api/leadgrid/events/contracts/signed",
  ]);
  if (method === "POST" && workflowEventPosts.has(path)) {
    const timestamp = scalarHeader(req.headers["x-leadgrid-timestamp"]);
    const deliveryId = scalarHeader(req.headers["x-leadgrid-delivery-id"]);
    const signature = scalarHeader(req.headers["x-leadgrid-signature"]);
    const bearer = bearerToken(req.headers.authorization);

    // HMAC producers do not need a CreatorHub session. Require the complete
    // credential envelope and no Bearer header, so a stale user session cannot
    // add a fake signature header and skip the authoritative session check.
    if (timestamp && deliveryId && signature && !bearer) return false;

    // Internal producers use an exact, separately configured service bearer.
    // Comparing it here is intentional: header presence alone would let an
    // ordinary stale bearer bypass this middleware before the route falls back
    // to its session-auth branch.
    if (
      timestamp &&
      deliveryId &&
      credentialEquals(
        bearer,
        independentCredentials.workflowEventServiceToken,
        32,
      )
    ) return false;
  }

  if (
    method === "POST" &&
    /^\/api\/leadgrid\/intent\/[^/]+\/(?:sign|reject)$/.test(path)
  ) return false;
  if (
    (method === "PUT" || method === "POST") &&
    /^\/api\/leadgrid\/portal\/[^/]+\/notification-prefs(?:\/unsubscribe)?$/.test(path)
  ) return false;

  return true;
}

/**
 * Fail-closed write gate for the session-authenticated Leadgrid API.
 * Independent public/HMAC/token/cron credentials are deliberately left to
 * their route-local validators, but only after the narrow policy above has
 * identified the exact credential shape/value for that endpoint.
 */
export function createLeadgridAuthoritativeWriteMiddleware(input: {
  resolveSession: AuthoritativeSessionRequestResolver;
  independentCredentials?: LeadgridIndependentCredentialConfig;
}): RequestHandler {
  const canvasAdmission = new Map<
    string,
    { count: number; resetAt: number }
  >();
  let activeCanvasAuthorityChecks = 0;
  const maxCanvasAuthorityChecks = 32;
  const maxCanvasAuthorityChecksPerMinute = 600;

  return async (req, res, next) => {
    if (
      !leadgridWriteNeedsAuthoritativeSession(
        req,
        input.independentCredentials,
      )
    ) {
      next();
      return;
    }

    res.setHeader("Cache-Control", "no-store");
    const canvasRequest = /^\/api\/leadgrid\/canvas(?:\/|$)/i.test(
      requestPath(req),
    );
    let releaseAuthoritySlot = () => undefined;
    if (canvasRequest) {
      const now = Date.now();
      const admissionKey = req.socket.remoteAddress || req.ip || "unknown";
      const previous = canvasAdmission.get(admissionKey);
      const bucket = !previous || previous.resetAt <= now
        ? { count: 0, resetAt: now + 60_000 }
        : previous;
      if (bucket.count >= maxCanvasAuthorityChecksPerMinute) {
        res.setHeader(
          "Retry-After",
          String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000))),
        );
        res.status(429).json({ error: "canvas_auth_rate_limited" });
        return;
      }
      bucket.count += 1;
      canvasAdmission.set(admissionKey, bucket);
      if (canvasAdmission.size > 10_000) {
        for (const [key, candidate] of canvasAdmission) {
          if (candidate.resetAt <= now) canvasAdmission.delete(key);
        }
        if (canvasAdmission.size > 10_000) {
          canvasAdmission.delete(canvasAdmission.keys().next().value ?? "");
        }
      }
      if (activeCanvasAuthorityChecks >= maxCanvasAuthorityChecks) {
        res.setHeader("Retry-After", "1");
        res.status(503).json({ error: "canvas_auth_capacity_reached" });
        return;
      }
      activeCanvasAuthorityChecks += 1;
      let released = false;
      releaseAuthoritySlot = () => {
        if (released) return;
        released = true;
        activeCanvasAuthorityChecks = Math.max(
          0,
          activeCanvasAuthorityChecks - 1,
        );
      };
    }

    let resolution: Awaited<ReturnType<AuthoritativeSessionRequestResolver>>;
    try {
      resolution = await input.resolveSession(req);
    } catch (error) {
      console.warn("[auth] Leadgrid write authority unavailable:", error);
      res.status(503).json({ error: "session_authority_unavailable" });
      return;
    } finally {
      releaseAuthoritySlot();
    }

    if (resolution.status === "unavailable") {
      res.status(503).json({ error: "session_authority_unavailable" });
      return;
    }
    if (resolution.status !== "authenticated") {
      res.status(401).json({ error: "authentication_required" });
      return;
    }
    next();
  };
}
