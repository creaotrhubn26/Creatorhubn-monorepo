/**
 * Logg inn med LinkedIn — kjerne uten HTTP.
 *
 * Bruker «Sign In with LinkedIn using OpenID Connect» (scopes
 * openid profile email). userinfo gir sub, navn, fornavn/etternavn, bilde,
 * e-post og email_verified — ikke headline, tittel eller selskap (krever
 * r_basicprofile, som er forbeholdt partnerprogrammet). Se
 * docs/evidence/2026-09-linkedin-oidc-login-claims.yaml.
 *
 * Oppslagsrekkefølge (resolveOrCreateUserFromLinkedIn):
 *   1. user_auth_identities ('linkedin', sub)
 *   2. role_room_linkedin_connections.linkedin_member_id (eksisterende
 *      publiserings-tilkobling)
 *   3. users på LOWER(email) — kun når LinkedIn sier e-posten er verifisert
 *   4. opprett bruker (member) + solo_free-org, som Leadgrid-Google-flyten
 *
 * Profilen fylles bare der den er tom: first_name, last_name og
 * profile_image_url (bildet lastes ned og lagres i R2 fordi LinkedIns URL-er
 * utløper). Det brukeren har redigert selv, røres aldri.
 */

import crypto from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { detectedImageType } from "./lead-map-me-profile-routes.js";

export const LINKEDIN_LOGIN_SCOPES = ["openid", "profile", "email"] as const;
export const LINKEDIN_LOGIN_STATE_PREFIX = "lgn_";
export const LINKEDIN_LOGIN_PROVIDER = "linkedin";
export const LINKEDIN_AUTHORIZATION_URL = "https://www.linkedin.com/oauth/v2/authorization";
export const LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
export const LINKEDIN_USERINFO_URL = "https://api.linkedin.com/v2/userinfo";

const PICTURE_MAX_BYTES = 2 * 1024 * 1024;
const PICTURE_TIMEOUT_MS = 5_000;

type EnvLike = Readonly<Record<string, string | undefined>>;
type FetchLike = typeof fetch;

export function linkedInLoginEnabled(env: EnvLike = process.env): boolean {
  return (env.LINKEDIN_LOGIN_ENABLED ?? "").trim().toLowerCase() !== "off";
}

export function createLinkedInLoginState(): string {
  return `${LINKEDIN_LOGIN_STATE_PREFIX}${crypto.randomBytes(16).toString("hex")}`;
}

const STATE_RE = /^lgn_[a-f0-9]{32}$/;

export function isLinkedInLoginState(value: unknown): value is string {
  return typeof value === "string" && STATE_RE.test(value);
}

export function buildLinkedInAuthorizationUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const url = new URL(LINKEDIN_AUTHORIZATION_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("scope", LINKEDIN_LOGIN_SCOPES.join(" "));
  url.searchParams.set("state", input.state);
  return url.toString();
}

function readStringValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export interface LinkedInLoginProfile {
  sub: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  givenName: string | null;
  familyName: string | null;
  picture: string | null;
  locale: string | null;
  raw: Record<string, unknown>;
}

export type LinkedInCodeExchangeResult =
  | { ok: true; profile: LinkedInLoginProfile }
  | { ok: false; reason: "token_exchange_failed" | "userinfo_failed" | "missing_subject"; message: string };

/** Bytter authorization code mot access token og henter userinfo. */
export async function exchangeLinkedInCodeForProfile(
  input: { code: string; clientId: string; clientSecret: string; redirectUri: string },
  fetchImpl: FetchLike = fetch,
): Promise<LinkedInCodeExchangeResult> {
  const tokenResponse = await fetchImpl(LINKEDIN_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: input.code,
      client_id: input.clientId,
      client_secret: input.clientSecret,
      redirect_uri: input.redirectUri,
    }),
  });
  const tokenPayload = (await tokenResponse.json().catch(() => null)) as Record<string, unknown> | null;
  const accessToken = readStringValue(tokenPayload?.access_token);
  if (!tokenResponse.ok || !accessToken) {
    return {
      ok: false,
      reason: "token_exchange_failed",
      message:
        readStringValue(tokenPayload?.error_description)
        ?? readStringValue(tokenPayload?.error)
        ?? "LinkedIn godtok ikke innloggingen. Prøv igjen.",
    };
  }

  const profileResponse = await fetchImpl(LINKEDIN_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const raw = (await profileResponse.json().catch(() => null)) as Record<string, unknown> | null;
  if (!profileResponse.ok || !raw) {
    return {
      ok: false,
      reason: "userinfo_failed",
      message: readStringValue(raw?.message) ?? "Kunne ikke hente LinkedIn-profilen.",
    };
  }
  const sub = readStringValue(raw.sub);
  if (!sub) {
    return { ok: false, reason: "missing_subject", message: "LinkedIn-kontoen mangler identitet." };
  }
  const givenName = readStringValue(raw.given_name);
  const familyName = readStringValue(raw.family_name);
  return {
    ok: true,
    profile: {
      sub,
      email: readStringValue(raw.email)?.toLowerCase() ?? null,
      emailVerified: raw.email_verified === true || raw.email_verified === "true",
      name: readStringValue(raw.name) ?? ([givenName, familyName].filter(Boolean).join(" ") || null),
      givenName,
      familyName,
      picture: readStringValue(raw.picture),
      locale: readStringValue(raw.locale) ?? readStringValue((raw.locale as Record<string, unknown> | null)?.language),
      raw,
    },
  };
}

/** Splitter «Kari Nordmann» i fornavn/etternavn når LinkedIn ikke gir dem separat. */
export function splitDisplayName(name: string | null): { first: string | null; last: string | null } {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: null, last: null };
  return { first: parts[0], last: parts.slice(1).join(" ") || null };
}

export type LinkedInLoginMatch = "identity" | "connection" | "email" | "created";

export interface LinkedInLoginUser {
  userId: string;
  email: string;
  role: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  picture: string | null;
  isNew: boolean;
  matchedBy: LinkedInLoginMatch;
  organizationId: string | null;
}

export type LinkedInLoginResolveResult =
  | { ok: true; user: LinkedInLoginUser }
  | { ok: false; reason: "email_not_verified" | "account_inactive" | "missing_email"; message: string };

export interface LinkedInLoginDeps {
  uploadImage?: (buffer: Buffer, mimeType: string, key: string) => Promise<string>;
  fetchImpl?: FetchLike;
  hashPlaceholderPassword?: () => Promise<string>;
}

async function defaultPlaceholderPassword(): Promise<string> {
  // users.password er NOT NULL. Brukeren logger aldri inn med passord her;
  // samme mønster som leadgrid-google-auth-routes.ts.
  const bcrypt = await import("bcrypt");
  return bcrypt.default.hash(`${crypto.randomUUID()}${crypto.randomUUID()}`, 10);
}

interface UserRow {
  id: string;
  email: string;
  role: string | null;
  is_active: boolean;
  first_name: string | null;
  last_name: string | null;
  profile_image_url: string | null;
}

const USER_COLUMNS = `u.id, u.email, u.role,
        COALESCE((to_jsonb(u)->>'is_active')::boolean, TRUE) AS is_active,
        u.first_name, u.last_name, u.profile_image_url`;

function isMissingRelation(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && (error as { code?: string }).code === "42P01");
}

async function findUserIdByIdentity(client: PoolClient, sub: string): Promise<string | null> {
  const r = await client.query<{ user_id: string }>(
    `SELECT user_id FROM user_auth_identities
      WHERE provider = $1 AND provider_subject = $2 LIMIT 1`,
    [LINKEDIN_LOGIN_PROVIDER, sub],
  );
  return r.rows[0]?.user_id ?? null;
}

async function findUserIdByConnection(client: PoolClient, sub: string): Promise<string | null> {
  try {
    const r = await client.query<{ user_id: string }>(
      `SELECT user_id FROM role_room_linkedin_connections
        WHERE linkedin_member_id = $1 LIMIT 1`,
      [sub],
    );
    return r.rows[0]?.user_id ?? null;
  } catch (error) {
    if (isMissingRelation(error)) return null;
    throw error;
  }
}

async function loadUserById(client: PoolClient, userId: string): Promise<UserRow | null> {
  const r = await client.query<UserRow>(
    `SELECT ${USER_COLUMNS} FROM users u WHERE u.id = $1 LIMIT 1`,
    [userId],
  );
  return r.rows[0] ?? null;
}

async function loadUserByEmail(client: PoolClient, email: string): Promise<UserRow | null> {
  const r = await client.query<UserRow>(
    `SELECT ${USER_COLUMNS} FROM users u WHERE LOWER(u.email) = LOWER($1) LIMIT 1`,
    [email],
  );
  return r.rows[0] ?? null;
}

async function ensureSoloOrganization(
  client: PoolClient,
  userId: string,
  email: string,
  displayName: string | null,
): Promise<string | null> {
  const existing = await client.query<{ id: string }>(
    `SELECT om.organization_id AS id FROM organization_members om
      WHERE om.user_id = $1 LIMIT 1`,
    [userId],
  );
  if (existing.rows[0]) return existing.rows[0].id;

  const orgName = displayName ? `${displayName}'s Leadgrid` : `${email.split("@")[0]}'s Leadgrid`;
  const slug =
    orgName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
    + "-" + crypto.randomBytes(3).toString("hex");
  const created = await client.query<{ id: string }>(
    `INSERT INTO organizations (name, slug, org_type, plan, owner_user_id, contact_email)
     VALUES ($1, $2, 'customer', 'solo_free', $3, $4) RETURNING id`,
    [orgName, slug, userId, email],
  );
  const orgId = created.rows[0]?.id ?? null;
  if (orgId) {
    await client.query(
      `INSERT INTO organization_members (organization_id, user_id, role) VALUES ($1, $2, 'admin')`,
      [orgId, userId],
    );
  }
  return orgId;
}

/** Laster ned LinkedIn-bildet (best effort) og returnerer bytes + type. */
export async function downloadLinkedInPicture(
  url: string,
  fetchImpl: FetchLike = fetch,
): Promise<{ buffer: Buffer; mime: string; extension: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PICTURE_TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, { signal: controller.signal });
    if (!response.ok) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length === 0 || bytes.length > PICTURE_MAX_BYTES) return null;
    const detected = detectedImageType(bytes);
    if (!detected) return null;
    return { buffer: bytes, mime: detected.mime, extension: detected.extension };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Finner eller oppretter brukeren, fyller tomme profilfelt og registrerer
 * identiteten. Alt unntatt bildenedlastingen skjer i én transaksjon.
 */
export async function resolveOrCreateUserFromLinkedIn(
  pool: Pool,
  profile: LinkedInLoginProfile,
  deps: LinkedInLoginDeps = {},
): Promise<LinkedInLoginResolveResult> {
  const split = splitDisplayName(profile.name);
  const givenName = profile.givenName ?? split.first;
  const familyName = profile.familyName ?? split.last;

  const client = await pool.connect();
  let user: UserRow | null = null;
  let matchedBy: LinkedInLoginMatch = "created";
  let organizationId: string | null = null;
  try {
    await client.query("BEGIN");

    const identityUserId = await findUserIdByIdentity(client, profile.sub);
    if (identityUserId) {
      user = await loadUserById(client, identityUserId);
      matchedBy = "identity";
    }
    if (!user) {
      const connectionUserId = await findUserIdByConnection(client, profile.sub);
      if (connectionUserId) {
        user = await loadUserById(client, connectionUserId);
        matchedBy = "connection";
      }
    }
    if (!user) {
      if (!profile.email) {
        await client.query("ROLLBACK");
        return { ok: false, reason: "missing_email", message: "LinkedIn-kontoen har ingen e-postadresse." };
      }
      if (!profile.emailVerified) {
        // Uverifisert e-post kan verken kobles til en eksisterende konto
        // (kontoovertakelse) eller opprette en ny (samme krav som Google).
        await client.query("ROLLBACK");
        return {
          ok: false,
          reason: "email_not_verified",
          message: "E-postadressen på LinkedIn-kontoen er ikke verifisert. Verifiser den hos LinkedIn og prøv igjen.",
        };
      }
      user = await loadUserByEmail(client, profile.email);
      if (user) matchedBy = "email";
    }

    if (user && user.is_active !== true) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "account_inactive", message: "Kontoen er deaktivert." };
    }

    if (!user) {
      const userId = crypto.randomUUID();
      const email = profile.email as string;
      const placeholder = await (deps.hashPlaceholderPassword ?? defaultPlaceholderPassword)();
      const inserted = await client.query<UserRow>(
        `INSERT INTO users (id, email, username, password, role, first_name, last_name, created_at)
         VALUES ($1, $2, $3, $4, 'member', $5, $6, now())
         RETURNING id, email, role, TRUE AS is_active, first_name, last_name, profile_image_url`,
        [userId, email, email, placeholder, givenName, familyName],
      );
      user = inserted.rows[0];
      matchedBy = "created";
    } else {
      // Fyll bare tomme felt; brukerens egne redigeringer beholdes.
      const updated = await client.query<UserRow>(
        `UPDATE users u
            SET first_name = COALESCE(NULLIF(u.first_name, ''), $2),
                last_name = COALESCE(NULLIF(u.last_name, ''), $3),
                last_login_at = now(),
                updated_at = now()
          WHERE u.id = $1
          RETURNING ${USER_COLUMNS}`,
        [user.id, givenName, familyName],
      );
      user = updated.rows[0] ?? user;
    }

    await client.query(
      `INSERT INTO user_auth_identities (user_id, provider, provider_subject, email, email_verified, profile, last_login_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, now())
       ON CONFLICT (provider, provider_subject) DO UPDATE
         SET email = EXCLUDED.email,
             email_verified = EXCLUDED.email_verified,
             profile = EXCLUDED.profile,
             last_login_at = now()`,
      [user.id, LINKEDIN_LOGIN_PROVIDER, profile.sub, profile.email, profile.emailVerified, JSON.stringify(profile.raw)],
    );

    organizationId = await ensureSoloOrganization(client, user.id, user.email, profile.name);

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  let picture = readStringValue(user.profile_image_url);
  if (!picture && profile.picture && deps.uploadImage) {
    const downloaded = await downloadLinkedInPicture(profile.picture, deps.fetchImpl ?? fetch);
    if (downloaded) {
      try {
        const hash = crypto.createHash("sha256").update(downloaded.buffer).digest("hex").slice(0, 16);
        const key = `leadgrid/profile-images/${user.id}/${hash}.${downloaded.extension}`;
        const url = await deps.uploadImage(downloaded.buffer, downloaded.mime, key);
        const written = await pool.query<{ id: string }>(
          `UPDATE users SET profile_image_url = $1, updated_at = now()
            WHERE id = $2 AND COALESCE(profile_image_url, '') = '' RETURNING id`,
          [url, user.id],
        );
        if (written.rows.length > 0) picture = url;
      } catch (error) {
        console.warn("[linkedin-login] profile picture import failed:", (error as Error).message);
      }
    }
  }

  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
  return {
    ok: true,
    user: {
      userId: user.id,
      email: user.email,
      role: user.role ?? "member",
      name: fullName || profile.name || user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      picture,
      isNew: matchedBy === "created",
      matchedBy,
      organizationId,
    },
  };
}
