/**
 * org-self-onboard-routes.ts
 *
 * Åpen selv-registrering for Solo-planen. Ingen super-admin involvert.
 *
 *   POST /api/leadgrid/self-onboard
 *
 * Flyt:
 *   1) E-post + org-navn + (valgfritt org_nr) + ønsket mal-key
 *   2) Sjekk at malen tillater self_onboard_allowed=true
 *   3) Opprett bruker (eller hent eksisterende) + organisasjon + medlemskap
 *   4) Send velkomst-e-post m/ magic-link (sett-passord-token)
 *
 * Konsekvent med superadmin-routes' create-flyt, men:
 *   - Gated på mal-`self_onboard_allowed`
 *   - Atomisk DB-rate-limit på hashet IP + e-post
 *   - Cloudflare Turnstile med egen action (påkrevd i produksjon)
 *   - Ingen audit-log (det er åpen registrering)
 */

import type { Express, NextFunction, Request, Response } from "express";
import type { Pool } from "pg";
import crypto from "crypto";
import { isIP } from "node:net";
import Stripe from "stripe";
import { z } from "zod";
import { sendTransactionalEmail } from "./transactional-email-service.js";
import { notifyAdmins } from "./admin-notify.js";
import { lookupCompanyForNewLead } from "./lead-brreg-service.js";
import {
  createRoleRoomTurnstileService,
  type RoleRoomTurnstileService,
} from "./role-room-turnstile-service.js";
import {
  ensureAuthSessionTable,
  persistAuthSessionInTransaction,
} from "./auth-session-store.js";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type LeadgridWelcomeSession = {
  userId: string;
  email: string;
  name: string;
  role: string;
  authSessionVersion?: string;
  loginAt: string;
  displayName?: string;
  isAdmin?: boolean;
  verified_email?: boolean;
};

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, LeadgridWelcomeSession>;
  ensureSessionStore?: typeof ensureAuthSessionTable;
  persistSessionInTransaction?: typeof persistAuthSessionInTransaction;
  turnstileService?: RoleRoomTurnstileService;
  hashPlaceholderPassword?: (value: string) => Promise<string>;
  getStripeClient?: () => Stripe | null;
  sendWelcomeEmail?: typeof sendTransactionalEmail;
  notifyAdminsFn?: typeof notifyAdmins;
  lookupCompany?: typeof lookupCompanyForNewLead;
  isProduction?: () => boolean;
}

type MagicTokenCandidate = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  role: string | null;
  auth_session_version: string;
  is_active: boolean;
  meta: Record<string, unknown> | null;
  organization_id: string | null;
  organization_name: string | null;
  organization_slug: string | null;
  organization_plan: string | null;
};

const MAGIC_TOKEN_PATTERN = /^[a-f0-9]{64}$/i;
const MAGIC_CONSUME_RATE_WINDOW_MS = 60_000;
const MAGIC_CONSUME_RATE_MAX = 10;
const MAGIC_CONSUME_RATE_MAX_BUCKETS = 4_096;
const MAGIC_CONSUME_RATE_PRUNE_EVERY = 64;
const MAGIC_CONSUME_OVERFLOW_BUCKET = "__leadgrid_magic_overflow__";
export const LEADGRID_SELF_ONBOARD_BODY_LIMIT_BYTES = 16 * 1024;
const SELF_ONBOARD_RATE_WINDOW_MINUTES = 15;
const SELF_ONBOARD_IP_RATE_MAX = 8;
const SELF_ONBOARD_EMAIL_RATE_MAX = 3;
const LEADGRID_SELF_ONBOARD_TURNSTILE_ACTION = "leadgrid_self_onboard";

/**
 * Avviser feil innholdstype og deklarert overstor body før JSON-parseren får
 * lese requesten. Denne monteres også foran den rutespesifikke parseren i
 * index.ts; route-middleware-bruken under er et ekstra fail-closed vern for
 * isolerte monteringer og tester.
 */
export function requireLeadgridSelfOnboardJsonEnvelope(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");

  if (!req.is(["application/json", "application/*+json"])) {
    res.status(415).json({ error: "content_type_must_be_json" });
    return;
  }

  const rawContentLength = req.get("content-length")?.trim();
  if (rawContentLength) {
    if (!/^\d+$/.test(rawContentLength)) {
      res.status(400).json({ error: "invalid_content_length" });
      return;
    }
    const contentLength = Number(rawContentLength);
    if (
      !Number.isSafeInteger(contentLength) ||
      contentLength > LEADGRID_SELF_ONBOARD_BODY_LIMIT_BYTES
    ) {
      res.status(413).json({ error: "request_body_too_large" });
      return;
    }
  }

  next();
}

function containsControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 0x1f || codePoint === 0x7f;
  });
}

const safeText = (minimum: number, maximum: number) =>
  z
    .string()
    .trim()
    .min(minimum)
    .max(maximum)
    .refine((value) => !containsControlCharacter(value), {
      message: "control_characters_not_allowed",
    });

const optionalTrimmedText = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum)
    .refine((value) => !containsControlCharacter(value), {
      message: "control_characters_not_allowed",
    })
    .optional()
    .transform((value) => value || undefined);

function isSafePublicWebsite(value: string): boolean {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:")
      return false;
    if (parsed.username || parsed.password) return false;
    const hostname = parsed.hostname.trim().toLowerCase();
    if (!hostname || hostname === "localhost" || hostname.endsWith(".local"))
      return false;
    if (isIP(hostname) !== 0) return false;
    return hostname.includes(".");
  } catch {
    return false;
  }
}

function isValidNorwegianOrgNumber(value: string): boolean {
  if (!/^\d{9}$/.test(value)) return false;
  const digits = value.split("").map(Number);
  const weights = [3, 2, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce(
    (total, weight, index) => total + weight * digits[index],
    0,
  );
  const remainder = 11 - (sum % 11);
  if (remainder === 11) return digits[8] === 0;
  if (remainder === 10) return false;
  return digits[8] === remainder;
}

const selfOnboardBodySchema = z
  .object({
    email: z.string().trim().toLowerCase().min(3).max(254).email(),
    orgName: safeText(2, 160),
    orgNumber: z
      .string()
      .trim()
      .refine(isValidNorwegianOrgNumber, { message: "invalid_org_number" })
      .optional()
      .transform((value) => value || undefined),
    templateKey: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/)
      .default("solo"),
    website: z
      .string()
      .trim()
      .max(500)
      .refine(isSafePublicWebsite, { message: "invalid_public_website" })
      .optional()
      .transform((value) => value || undefined),
    contactName: optionalTrimmedText(120),
    turnstileToken: z.string().trim().min(1).max(2048).optional(),
    cfTurnstileResponse: z.string().trim().min(1).max(2048).optional(),
    "cf-turnstile-response": z.string().trim().min(1).max(2048).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const suppliedTokens = [
      value.turnstileToken,
      value.cfTurnstileResponse,
      value["cf-turnstile-response"],
    ].filter((token): token is string => Boolean(token));
    if (new Set(suppliedTokens).size > 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["turnstileToken"],
        message: "conflicting_turnstile_tokens",
      });
    }
  });

type SelfOnboardRateLimitRow = {
  allowed: boolean | string;
  remaining: number | string;
  retry_after_seconds: number | string;
};

function normalizeIpAddress(value: unknown): string | null {
  let candidate = typeof value === "string" ? value.trim() : "";
  if (!candidate || candidate.length > 64) return null;
  if (candidate.startsWith("[") && candidate.includes("]")) {
    candidate = candidate.slice(1, candidate.indexOf("]"));
  }
  const zoneIndex = candidate.indexOf("%");
  if (zoneIndex > -1) candidate = candidate.slice(0, zoneIndex);
  return isIP(candidate) === 0 ? null : candidate.toLowerCase();
}

function configuredTrustedProxyHops(): number {
  const raw = process.env.LEADGRID_SELF_ONBOARD_TRUST_PROXY_HOPS?.trim() ?? "";
  if (!/^\d+$/.test(raw)) return 0;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed >= 0 && parsed <= 5
    ? parsed
    : 0;
}

export function resolveLeadgridPublicClientIp(req: Request): string {
  const socketAddress =
    normalizeIpAddress(req.socket?.remoteAddress) ?? "unknown";
  const trustedHops = configuredTrustedProxyHops();
  if (trustedHops === 0) return socketAddress;

  // X-Forwarded-For leses bare når et eksakt antall betrodde proxy-hopp er
  // konfigurert. Vi går fra høyre (nærmest serveren), slik at en klient ikke
  // kan påvirke nøkkelen ved å legge inn en vilkårlig første verdi.
  const forwardedHeader = req.headers["x-forwarded-for"];
  const forwarded = (
    Array.isArray(forwardedHeader)
      ? forwardedHeader.join(",")
      : (forwardedHeader ?? "")
  )
    .split(",")
    .map(normalizeIpAddress)
    .filter((value): value is string => Boolean(value));
  const clientIndex = forwarded.length - trustedHops;
  return clientIndex >= 0 ? forwarded[clientIndex] : socketAddress;
}

function hashRateLimitIdentity(scope: "ip" | "email", value: string): string {
  return crypto
    .createHash("sha256")
    .update(scope + ":" + value)
    .digest("hex");
}

export function createLeadgridMagicConsumeRateLimiter(options?: {
  windowMs?: number;
  maxAttempts?: number;
  maxBuckets?: number;
  pruneEvery?: number;
}): {
  isLimited: (key: string, now?: number) => boolean;
  bucketCount: () => number;
  largestBucketDepth: () => number;
} {
  const windowMs = Math.max(
    1,
    options?.windowMs ?? MAGIC_CONSUME_RATE_WINDOW_MS,
  );
  const maxAttempts = Math.max(
    1,
    options?.maxAttempts ?? MAGIC_CONSUME_RATE_MAX,
  );
  const maxBuckets = Math.max(
    1,
    options?.maxBuckets ?? MAGIC_CONSUME_RATE_MAX_BUCKETS,
  );
  const pruneEvery = Math.max(
    1,
    options?.pruneEvery ?? MAGIC_CONSUME_RATE_PRUNE_EVERY,
  );
  const buckets = new Map<string, number[]>();
  let operationCount = 0;

  const pruneExpiredBuckets = (now: number): void => {
    for (const [bucketKey, timestamps] of buckets) {
      const current = timestamps.filter(
        (timestamp) => now - timestamp < windowMs,
      );
      if (current.length === 0) {
        buckets.delete(bucketKey);
      } else if (current.length !== timestamps.length) {
        buckets.set(bucketKey, current);
      }
    }
  };

  return {
    isLimited(key: string, now = Date.now()): boolean {
      operationCount += 1;
      if (operationCount % pruneEvery === 0) {
        pruneExpiredBuckets(now);
      }

      let bucketKey = key;
      if (!buckets.has(bucketKey)) {
        const normalBucketCount =
          buckets.size - (buckets.has(MAGIC_CONSUME_OVERFLOW_BUCKET) ? 1 : 0);
        // Én plass reserveres til en delt overflow-bøtte. Nye, roterende
        // adresser kan dermed ikke vokse Map-en eller kaste ut aktive bøtter.
        if (normalBucketCount >= Math.max(0, maxBuckets - 1)) {
          bucketKey = MAGIC_CONSUME_OVERFLOW_BUCKET;
        }
      }

      const attempts = (buckets.get(bucketKey) ?? []).filter(
        (timestamp) => now - timestamp < windowMs,
      );
      attempts.push(now);
      const limited = attempts.length > maxAttempts;
      if (attempts.length > maxAttempts + 1) {
        attempts.splice(0, attempts.length - (maxAttempts + 1));
      }
      buckets.set(bucketKey, attempts);
      return limited;
    },
    bucketCount: () => buckets.size,
    largestBucketDepth: () =>
      Math.max(
        0,
        ...Array.from(buckets.values(), (attempts) => attempts.length),
      ),
  };
}

const magicConsumeRateLimiter = createLeadgridMagicConsumeRateLimiter();

async function checkSelfOnboardRateLimit(
  pool: Pool,
  req: Request,
  email: string,
): Promise<{ allowed: boolean; remaining: number; retryAfterSeconds: number }> {
  const sql = [
    "WITH current_window AS (",
    "  SELECT date_trunc('hour', NOW())",
    "         + floor(EXTRACT(minute FROM NOW()) / $5::integer)::integer",
    "           * make_interval(mins => $5::integer) AS window_start",
    "), limits(scope, key_hash, request_limit) AS (",
    "  VALUES",
    "    ('leadgrid_self_onboard_ip', $1::text, $3::integer),",
    "    ('leadgrid_self_onboard_email', $2::text, $4::integer)",
    "), prune AS (",
    "  DELETE FROM leadgrid_public_rate_limit_buckets",
    "   WHERE window_start < NOW() - interval '2 days'",
    "), attempts AS (",
    "  INSERT INTO leadgrid_public_rate_limit_buckets",
    "    (scope, key_hash, window_start, request_count, request_limit, updated_at)",
    "  SELECT scope, key_hash, current_window.window_start, 1, request_limit, NOW()",
    "    FROM limits CROSS JOIN current_window",
    "  ON CONFLICT (scope, key_hash, window_start) DO UPDATE",
    "    SET request_count = leadgrid_public_rate_limit_buckets.request_count + 1,",
    "        request_limit = EXCLUDED.request_limit,",
    "        updated_at = NOW()",
    "  WHERE leadgrid_public_rate_limit_buckets.request_count < EXCLUDED.request_limit",
    "  RETURNING request_count, request_limit",
    ")",
    "SELECT (COUNT(*) = 2) AS allowed,",
    "       COALESCE(MIN(request_limit - request_count), 0)::integer AS remaining,",
    "       GREATEST(",
    "         1,",
    "         CEIL(EXTRACT(EPOCH FROM (",
    "           (SELECT window_start FROM current_window)",
    "           + make_interval(mins => $5::integer) - NOW()",
    "         )))::integer",
    "       ) AS retry_after_seconds",
    "  FROM attempts",
  ].join("\n");
  const result = await pool.query<SelfOnboardRateLimitRow>(sql, [
    hashRateLimitIdentity("ip", resolveLeadgridPublicClientIp(req)),
    hashRateLimitIdentity("email", email),
    SELF_ONBOARD_IP_RATE_MAX,
    SELF_ONBOARD_EMAIL_RATE_MAX,
    SELF_ONBOARD_RATE_WINDOW_MINUTES,
  ]);
  const row = result.rows[0];
  return {
    allowed: row?.allowed === true || row?.allowed === "true",
    remaining: Math.max(0, Number(row?.remaining ?? 0)),
    retryAfterSeconds: Math.max(1, Number(row?.retry_after_seconds ?? 900)),
  };
}

function isMagicConsumeRateLimited(req: Request): boolean {
  return magicConsumeRateLimiter.isLimited(resolveLeadgridPublicClientIp(req));
}

export function hashLeadgridMagicToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function getStripe(): Stripe | null {
  const key =
    process.env.CREATORHUB_STRIPE_SECRET_KEY ?? process.env.STRIPE_SECRET_KEY;
  return key ? new Stripe(key) : null;
}

const PUBLIC_BASE =
  process.env.ROLE_ROOM_PUBLIC_URL ?? "https://theroleroom.com";

async function defaultHashPlaceholderPassword(value: string): Promise<string> {
  const bcrypt = await import("bcrypt");
  return bcrypt.default.hash(value, 10);
}

function normalizeConfigValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getDefaultPublicOrigin(): string {
  return (
    normalizeConfigValue(process.env.ROLE_ROOM_PUBLIC_ORIGIN) ||
    normalizeConfigValue(process.env.ROLE_ROOM_PUBLIC_URL) ||
    "https://theroleroom.com"
  );
}

function productionTurnstileHostnames(): Set<string> {
  const hostnames = new Set([
    "theroleroom.com",
    "www.theroleroom.com",
    "leadgrid.no",
    "www.leadgrid.no",
    "leadgrid.theroleroom.com",
  ]);
  const configured = [
    getDefaultPublicOrigin(),
    ...(process.env.LEADGRID_TURNSTILE_ALLOWED_HOSTNAMES ?? "").split(","),
  ];
  for (const value of configured) {
    const candidate = normalizeConfigValue(value);
    if (!candidate) continue;
    try {
      const parsed = new URL(
        candidate.includes("://") ? candidate : "https://" + candidate,
      );
      if (parsed.hostname) hostnames.add(parsed.hostname.toLowerCase());
    } catch {
      // Ugyldige konfigverdier utvider aldri allow-listen.
    }
  }
  return hostnames;
}

export function registerOrgSelfOnboardRoutes({
  app,
  pool,
  activeSessions,
  ensureSessionStore = ensureAuthSessionTable,
  persistSessionInTransaction = persistAuthSessionInTransaction,
  turnstileService,
  hashPlaceholderPassword = defaultHashPlaceholderPassword,
  getStripeClient = getStripe,
  sendWelcomeEmail = sendTransactionalEmail,
  notifyAdminsFn = notifyAdmins,
  lookupCompany = lookupCompanyForNewLead,
  isProduction = () => process.env.NODE_ENV === "production",
}: Deps): void {
  const selfOnboardTurnstile =
    turnstileService ??
    createRoleRoomTurnstileService({
      normalizeMailConfigValue: normalizeConfigValue,
      getDefaultRoleRoomPublicOrigin: getDefaultPublicOrigin,
    });

  app.post("/api/leadgrid/self-onboard/consume-magic", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Referrer-Policy", "no-referrer");

    if (isMagicConsumeRateLimited(req)) {
      return res.status(429).json({ error: "too_many_requests" });
    }

    const token =
      typeof req.body?.token === "string" ? req.body.token.trim() : "";
    if (!MAGIC_TOKEN_PATTERN.test(token)) {
      return res.status(400).json({ error: "invalid_magic_token_format" });
    }

    let sessionStoreReady = false;
    try {
      sessionStoreReady = await ensureSessionStore(pool);
    } catch {
      sessionStoreReady = false;
    }
    if (!sessionStoreReady) {
      return res.status(503).json({ error: "session_store_unavailable" });
    }

    const tokenHash = hashLeadgridMagicToken(token);
    const client = await pool.connect().catch(() => null);
    if (!client) {
      return res.status(503).json({ error: "session_store_unavailable" });
    }

    try {
      await client.query("BEGIN");

      // FOR UPDATE serialiserer samtidige innløsninger. Etter at vinneren har
      // fjernet token-feltene vil neste transaksjon ikke lenger matche raden.
      // `magic_token` beholdes kun som tidsbegrenset legacy-lesing; alle nye
      // tokens lagres som SHA-256 i `magic_token_hash`.
      const candidateResult = await client.query<MagicTokenCandidate>(
        `SELECT u.id, u.email, u.first_name, u.last_name, u.username, u.role, u.meta,
                u.auth_session_version::text AS auth_session_version,
                COALESCE(u.is_active, TRUE) AS is_active,
                org.organization_id, org.organization_name,
                org.organization_slug, org.organization_plan
           FROM users u
           LEFT JOIN LATERAL (
             SELECT om.organization_id,
                    o.name AS organization_name,
                    o.slug AS organization_slug,
                    o.plan AS organization_plan
               FROM organization_members om
               JOIN organizations o ON o.id = om.organization_id
              WHERE om.user_id = u.id
              ORDER BY CASE WHEN o.owner_user_id = u.id THEN 0 ELSE 1 END,
                       o.name ASC
              LIMIT 1
           ) org ON TRUE
          WHERE u.meta->>'magic_token_hash' = $1
             OR u.meta->>'magic_token' = $2
          FOR UPDATE OF u`,
        [tokenHash, token],
      );
      const candidate = candidateResult.rows[0];

      if (!candidate) {
        await client.query("ROLLBACK");
        return res.status(401).json({ error: "invalid_or_used_magic_token" });
      }
      if (candidate.is_active === false) {
        await client.query("ROLLBACK");
        return res.status(401).json({ error: "account_inactive" });
      }

      const expiresValue = candidate.meta?.magic_expires;
      const expiresAt =
        typeof expiresValue === "string"
          ? Date.parse(expiresValue)
          : Number.NaN;
      const tokenIsCurrent =
        Number.isFinite(expiresAt) && expiresAt > Date.now();

      if (!tokenIsCurrent) {
        await client.query(
          `UPDATE users
              SET meta = ((COALESCE(meta, '{}'::jsonb) - 'magic_token')
                          - 'magic_token_hash') - 'magic_expires'
            WHERE id = $1`,
          [candidate.id],
        );
        await client.query("COMMIT");
        return res.status(410).json({ error: "magic_token_expired" });
      }

      const role = String(candidate.role || "member")
        .trim()
        .toLowerCase()
        .replace(/-/g, "_");
      const name =
        [candidate.first_name, candidate.last_name]
          .filter((part): part is string => Boolean(part?.trim()))
          .join(" ") ||
        candidate.username?.trim() ||
        candidate.email.split("@")[0] ||
        "Leadgrid-bruker";
      const sessionToken = crypto.randomUUID();
      const sessionData: LeadgridWelcomeSession = {
        userId: String(candidate.id),
        email: candidate.email.trim().toLowerCase(),
        name,
        displayName: name,
        role,
        authSessionVersion: String(candidate.auth_session_version ?? "0"),
        isAdmin: role === "admin" || role === "super_admin",
        verified_email: true,
        loginAt: new Date().toISOString(),
      };

      await client.query(
        `UPDATE users
            SET meta = ((COALESCE(meta, '{}'::jsonb) - 'magic_token')
                        - 'magic_token_hash') - 'magic_expires',
                last_login_at = NOW()
          WHERE id = $1`,
        [candidate.id],
      );
      // Denne helperen kaster ved feil og bruker samme PoolClient/TX. Dermed
      // blir token-fjerningen rullet tilbake dersom sessionen ikke kan lagres.
      await persistSessionInTransaction(client, sessionToken, sessionData);
      await client.query("COMMIT");

      activeSessions.set(sessionToken, sessionData);
      return res.json({
        success: true,
        token: sessionToken,
        user: {
          id: sessionData.userId,
          email: sessionData.email,
          name: sessionData.name,
          displayName: sessionData.displayName,
          role: sessionData.role,
          isAdmin: sessionData.isAdmin,
          verified_email: sessionData.verified_email,
        },
        organization: candidate.organization_id
          ? {
              id: candidate.organization_id,
              name: candidate.organization_name,
              slug: candidate.organization_slug,
              plan: candidate.organization_plan,
            }
          : null,
      });
    } catch {
      await client.query("ROLLBACK").catch(() => undefined);
      console.error("[self-onboard] magic-token consume failed");
      return res.status(503).json({ error: "session_creation_failed" });
    } finally {
      client.release();
    }
  });

  app.post(
    "/api/leadgrid/self-onboard",
    requireLeadgridSelfOnboardJsonEnvelope,
    async (req, res) => {
      if (
        !req.body ||
        typeof req.body !== "object" ||
        Array.isArray(req.body)
      ) {
        return res.status(400).json({ error: "invalid_request_body" });
      }

      const parsed = selfOnboardBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "invalid_self_onboard_request",
          fields: Object.keys(parsed.error.flatten().fieldErrors),
        });
      }
      const {
        email,
        orgName,
        orgNumber,
        templateKey,
        website,
        contactName,
        turnstileToken,
        cfTurnstileResponse,
      } = parsed.data;
      const verificationToken =
        turnstileToken ||
        cfTurnstileResponse ||
        parsed.data["cf-turnstile-response"] ||
        "";

      let rateLimit: Awaited<ReturnType<typeof checkSelfOnboardRateLimit>>;
      try {
        rateLimit = await checkSelfOnboardRateLimit(pool, req, email);
      } catch {
        console.error("[self-onboard] rate limiter unavailable");
        return res.status(503).json({ error: "signup_protection_unavailable" });
      }
      res.setHeader("X-RateLimit-Remaining", String(rateLimit.remaining));
      if (!rateLimit.allowed) {
        res.setHeader("Retry-After", String(rateLimit.retryAfterSeconds));
        return res.status(429).json({
          error: "too_many_signup_attempts",
          retry_after_seconds: rateLimit.retryAfterSeconds,
        });
      }

      const turnstileConfigured = Boolean(
        selfOnboardTurnstile.getRoleRoomTurnstileSecretKey(),
      );
      if (isProduction() && !turnstileConfigured) {
        console.error(
          "[self-onboard] Turnstile secret is required in production",
        );
        return res.status(503).json({ error: "signup_protection_unavailable" });
      }
      if (turnstileConfigured) {
        if (!verificationToken) {
          return res.status(400).json({ error: "human_verification_required" });
        }
        try {
          const verification =
            await selfOnboardTurnstile.verifyRoleRoomTurnstileToken({
              token: verificationToken,
              ipAddress: resolveLeadgridPublicClientIp(req),
              expectedAction: LEADGRID_SELF_ONBOARD_TURNSTILE_ACTION,
              expectedHostnames: isProduction()
                ? productionTurnstileHostnames()
                : selfOnboardTurnstile.getRoleRoomTurnstileExpectedHostnames(
                    req,
                  ),
            });
          if (!verification.success) {
            if (
              verification.reason === "verification_timeout" ||
              verification.reason === "verification_unavailable"
            ) {
              console.error(
                "[self-onboard] Turnstile verification unavailable",
              );
              return res
                .status(503)
                .json({ error: "signup_protection_unavailable" });
            }
            return res.status(403).json({ error: "human_verification_failed" });
          }
          if (isProduction() && !verification.configured) {
            return res
              .status(503)
              .json({ error: "signup_protection_unavailable" });
          }
        } catch {
          console.error("[self-onboard] Turnstile verification unavailable");
          return res
            .status(503)
            .json({ error: "signup_protection_unavailable" });
        }
      }

      const client = await pool.connect().catch(() => null);
      if (!client) {
        return res.status(503).json({ error: "signup_storage_unavailable" });
      }
      try {
        await client.query("BEGIN");

        // 1) Lås både self-onboard-malen og den aktive planen den peker på.
        // En mal med en ukjent/deaktivert plan skal aldri rekke frem til
        // bruker- eller organisasjons-writes.
        const templatePlanResult = await client.query<{
          template_key: string;
          validated_plan_key: string;
          provisioned_plan_key: string;
          stripe_price_id_monthly: string | null;
        }>(
          `SELECT template.template_key,
                plan.plan_key AS validated_plan_key,
                provisioning_plan.plan_key AS provisioned_plan_key,
                plan.stripe_price_id_monthly
           FROM organization_setup_templates template
           JOIN plan_limits plan
             ON plan.plan_key = template.default_plan
            AND plan.is_active = TRUE
           JOIN plan_limits provisioning_plan
             ON provisioning_plan.plan_key = CASE
                  WHEN plan.stripe_price_id_monthly IS NULL
                    THEN plan.plan_key
                  ELSE 'solo_free'
                END
            AND provisioning_plan.is_active = TRUE
          WHERE template.template_key = $1
            AND template.is_active = TRUE
            AND template.self_onboard_allowed = TRUE
          FOR SHARE OF template, plan, provisioning_plan`,
          [templateKey],
        );
        if (templatePlanResult.rows.length === 0) {
          const eligibilityResult = await client.query<{
            template_eligible: boolean | string;
          }>(
            `SELECT EXISTS (
             SELECT 1
               FROM organization_setup_templates
              WHERE template_key = $1
                AND is_active = TRUE
                AND self_onboard_allowed = TRUE
           ) AS template_eligible`,
            [templateKey],
          );
          await client.query("ROLLBACK");

          const templateEligible =
            eligibilityResult.rows[0]?.template_eligible === true ||
            eligibilityResult.rows[0]?.template_eligible === "true";
          if (templateEligible) {
            console.error("[self-onboard] template has no active plan");
            return res.status(503).json({ error: "signup_plan_unavailable" });
          }
          return res.status(400).json({
            error: "Denne malen krever invitasjon fra Leadgrid",
          });
        }
        const templatePlan = templatePlanResult.rows[0];
        const validatedPlanKey = templatePlan.validated_plan_key;
        // Betalte målplaner blir først aktive via Stripe-webhook etter betaling.
        // Frem til da får org-en den aktive gratisplanen, aldri betalte
        // entitlements bare fordi checkout-sessionen ble opprettet.
        const provisionedPlanKey = templatePlan.provisioned_plan_key;

        // 2) Sjekk om e-post allerede har en org
        const existingR = await client.query(
          `SELECT u.id AS user_id, om.organization_id, o.name AS org_name
         FROM users u
         LEFT JOIN organization_members om ON om.user_id = u.id
         LEFT JOIN organizations o ON o.id = om.organization_id
         WHERE LOWER(u.email) = LOWER($1)`,
          [email],
        );
        if (existingR.rows.length > 0 && existingR.rows[0].organization_id) {
          await client.query("ROLLBACK");
          return res.status(409).json({
            error: `Du er allerede registrert i ${existingR.rows[0].org_name}`,
            existing_org: existingR.rows[0].org_name,
          });
        }

        // 3) Opprett (eller bruk eksisterende) bruker
        let userId: string;
        let isNewUser = false;
        if (existingR.rows.length > 0) {
          userId = existingR.rows[0].user_id;
        } else {
          userId = crypto.randomUUID();
          // users.password er NOT NULL uten default — trenger en ikke-null
          // placeholder inntil bruker setter passord via magic-link (samme
          // mønster som google-id-token-service.ts). Uten denne feiler INSERT
          // med "null value in column password violates not-null constraint".
          const placeholderPassword = await hashPlaceholderPassword(
            crypto.randomUUID() + crypto.randomUUID(),
          );
          await client.query(
            `INSERT INTO users (id, email, password, role, created_at)
           VALUES ($1, $2, $3, 'member', now())`,
            [userId, email, placeholderPassword],
          );
          isNewUser = true;
        }

        // 4) Opprett org (org_type=customer for Solo, agency for Lite byrå)
        const orgType =
          templatePlan.template_key === "agency_small" ? "agency" : "customer";
        const slug =
          String(orgName)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "")
            .substring(0, 60) || "org";
        const slugUnique = `${slug}-${crypto.randomBytes(3).toString("hex")}`;

        const orgR = await client.query(
          `INSERT INTO organizations
          (name, slug, org_type, owner_user_id, org_number, website,
           plan, contact_email, meta)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
          [
            orgName,
            slugUnique,
            orgType,
            userId,
            orgNumber ?? null,
            website ?? null,
            provisionedPlanKey,
            email,
            JSON.stringify({
              setup_template_key: templatePlan.template_key,
              self_onboarded: true,
              contact_name: contactName,
              requested_plan_key:
                validatedPlanKey === provisionedPlanKey
                  ? undefined
                  : validatedPlanKey,
            }),
          ],
        );
        const orgId = orgR.rows[0].id;

        // 5) Legg bruker som admin
        await client.query(
          `INSERT INTO organization_members (organization_id, user_id, role)
         VALUES ($1, $2, 'admin')`,
          [orgId, userId],
        );

        // 6) Magic-link / sett-passord-token (kun ny bruker)
        let magicToken: string | null = null;
        if (isNewUser) {
          magicToken = crypto.randomBytes(32).toString("hex");
          const magicTokenHash = hashLeadgridMagicToken(magicToken);
          await client.query(
            `UPDATE users
              SET meta = (COALESCE(meta, '{}'::jsonb) - 'magic_token')
                       || jsonb_build_object('magic_token_hash', $1::text, 'magic_expires', $2::text)
            WHERE id = $3`,
            [
              magicTokenHash,
              new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString(),
              userId,
            ],
          );
        }

        await client.query("COMMIT");

        // NACE-oppslaget starter først etter vellykket COMMIT og bruker pool,
        // ikke transaksjonsklienten som kan være frigitt når callbacken kjører.
        // Best-effort-feil blokkerer aldri den ferdige registreringen.
        if (orgNumber) {
          void lookupCompany(orgNumber)
            .then((result) => {
              if (!result.found || !result.company) return;
              return pool.query(
                `UPDATE organizations SET nace_code = $1, nace_description = $2 WHERE id = $3`,
                [
                  result.company.naceCode,
                  result.company.naceDescription,
                  orgId,
                ],
              );
            })
            .catch((error) =>
              console.warn(
                "[self-onboard] nace-oppslag feilet:",
                (error as Error).message,
              ),
            );
        }

        // 6.5) Opprett Stripe Customer + Checkout Session (mode='setup'
        //      for Free, 'subscription' for paid). Returnerer URL til
        //      Stripe-hosted checkout. Ved suksess kommer brukeren
        //      tilbake til /leadgrid/welcome med magic-token.
        let checkoutUrl: string | null = null;
        const stripe = getStripeClient();
        if (stripe) {
          try {
            const customer = await stripe.customers.create({
              email,
              name: orgName,
              metadata: {
                organization_id: orgId,
                user_id: userId,
                plan_key: validatedPlanKey,
              },
            });
            await pool.query(
              `UPDATE organizations SET stripe_customer_id = $1 WHERE id = $2`,
              [customer.id, orgId],
            );

            const successUrl = magicToken
              ? `${PUBLIC_BASE}/leadgrid/welcome?checkout=success#token=${magicToken}`
              : `${PUBLIC_BASE}/leadgrid?checkout=success`;
            const cancelUrl = `${PUBLIC_BASE}/leadgrid/welcome?checkout=cancelled`;

            // Pris-ID-en kommer fra den samme aktive, låste planraden som ble
            // validert før organisasjonen ble opprettet.
            const priceId = templatePlan.stripe_price_id_monthly;

            if (priceId) {
              // Paid plan — subscription checkout
              const session = await stripe.checkout.sessions.create({
                mode: "subscription",
                customer: customer.id,
                line_items: [{ price: priceId, quantity: 1 }],
                success_url: successUrl,
                cancel_url: cancelUrl,
                allow_promotion_codes: true,
                metadata: {
                  organization_id: orgId,
                  plan_key: validatedPlanKey,
                  product_family: "leadgrid",
                },
                subscription_data: {
                  metadata: {
                    organization_id: orgId,
                    plan_key: validatedPlanKey,
                    product_family: "leadgrid",
                  },
                },
              });
              checkoutUrl = session.url;
            } else {
              // Free plan — kun lagre kort (Setup Intent) for senere oppgrade
              const session = await stripe.checkout.sessions.create({
                mode: "setup",
                customer: customer.id,
                success_url: successUrl,
                cancel_url: cancelUrl,
                metadata: {
                  organization_id: orgId,
                  plan_key: validatedPlanKey,
                  product_family: "leadgrid",
                },
              });
              checkoutUrl = session.url;
            }
          } catch (e) {
            console.error("[self-onboard] stripe checkout failed", e);
          }
        }

        // 7) Velkomst-e-post (utenfor TX)
        {
          const url = magicToken
            ? `${PUBLIC_BASE}/leadgrid/welcome#token=${magicToken}`
            : `${PUBLIC_BASE}/leadgrid`;
          try {
            await sendWelcomeEmail({
              to: email,
              subject: `Velkommen til Leadgrid${contactName ? `, ${contactName}` : ""}`,
              html: `<p>Velkommen til Leadgrid.</p>
             <p>Vi har satt opp <strong>${escapeHtml(orgName)}</strong> for deg.
             Trykk lenken under for å logge inn og legge til din første kunde:</p>
             <p><a href="${url}">${url}</a></p>`,
              text: `Velkommen til Leadgrid. Vi har satt opp ${orgName} for deg. Logg inn her: ${url}`,
              kind: "leadgrid_self_onboard",
              pool,
            });
          } catch (e) {
            console.error("[self-onboard] mail failed", e);
          }
        }

        const boundedReferer =
          (req.get("referer") ?? "").trim().slice(0, 500) || null;
        void notifyAdminsFn(pool, {
          type: "leadgrid_self_onboard",
          source: "Leadgrid · selvbetjent org-registrering",
          title: `Ny selvbetjent registrering: ${orgName}`,
          summary: `${contactName ? `${contactName} · ` : ""}${email}${orgNumber ? ` · org.nr ${orgNumber}` : ""}${website ? ` · ${website}` : ""} · mal: ${templatePlan.template_key} · plan: ${provisionedPlanKey}${validatedPlanKey === provisionedPlanKey ? "" : ` · ønsket plan etter betaling: ${validatedPlanKey}`}`,
          link: "/admin",
          cta: null,
          page: boundedReferer,
          utm: null,
          relatedId: orgId,
        });

        res.status(201).json({
          organization: {
            id: orgId,
            name: orgName,
            slug: slugUnique,
            org_type: orgType,
            plan: provisionedPlanKey,
            requested_plan:
              validatedPlanKey === provisionedPlanKey
                ? null
                : validatedPlanKey,
          },
          user_id: userId,
          magic_link_sent: isNewUser,
          checkout_url: checkoutUrl,
        });
      } catch (e) {
        await client.query("ROLLBACK");
        console.error("[self-onboard] failed", e);
        res.status(500).json({ error: "Kunne ikke opprette org" });
      } finally {
        client.release();
      }
    },
  );

  // Liste maler som er tilgjengelig for self-onboard
  app.get("/api/leadgrid/self-onboard-templates", async (_req, res) => {
    try {
      const r = await pool.query(
        `SELECT template.template_key, template.label, template.description,
                plan.plan_key AS default_plan
           FROM organization_setup_templates template
           JOIN plan_limits plan
             ON plan.plan_key = template.default_plan
            AND plan.is_active = TRUE
          WHERE template.is_active = TRUE
            AND template.self_onboard_allowed = TRUE
          ORDER BY template.display_order ASC`,
      );
      res.json({ templates: r.rows });
    } catch {
      res.status(500).json({ error: "Kunne ikke hente maler" });
    }
  });
}
