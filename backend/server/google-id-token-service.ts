import type { Pool } from "pg";
import crypto from "crypto";
import { persistAuthSession } from "./auth-session-store.js";

/// Mobile sign-in flow: a native client (iPad CaptureApp, future iOS/
/// Android apps) obtains a Google ID token via Google Sign-In, posts it
/// here, and gets back a CreatorHub session bearer that works with all
/// existing requireAuth-gated routes. Identity is the verified Google
/// email — we upsert by email, never by raw `sub`, so a user can sign
/// into the same account from multiple Google projects (web + native)
/// without duplicate rows.

export interface GoogleIdTokenInput {
  idToken: string;
  pool: Pool;
  activeSessions: Map<string, ActiveSessionLike>;
  /// Override the configured client ID. Tests inject this; production
  /// reads from env. Returning null means "not configured" — the route
  /// surfaces a 503 so clients know to fall back / retry later.
  clientIdOverride?: string;
  /// Override Google's verifier. Tests pass a stub that returns a
  /// canned payload; production uses google-auth-library.
  verifyOverride?: (idToken: string, audience: string) => Promise<GoogleTokenPayload>;
  /// Override the session token generator. Tests pin it for assertions.
  tokenFactory?: () => string;
  /// Override the timestamp used for session.loginAt. Tests pin it.
  now?: () => Date;
}

export interface GoogleTokenPayload {
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  sub?: string;
  aud?: string;
}

export interface ActiveSessionLike {
  userId: string;
  email: string;
  name: string;
  role: string;
  loginAt: string;
  [key: string]: unknown;
}

export type GoogleIdTokenResult =
  | {
      ok: true;
      token: string;
      user: {
        id: string;
        email: string;
        name: string;
        role: string;
        profileImageUrl: string | null;
      };
    }
  | {
      ok: false;
      status: number;
      error:
        | "idToken_required"
        | "google_oauth_not_configured"
        | "invalid_id_token"
        | "email_not_verified"
        | "user_upsert_failed";
      detail?: string;
    };

export async function exchangeGoogleIdToken(
  input: GoogleIdTokenInput,
): Promise<GoogleIdTokenResult> {
  const idToken = (input.idToken ?? "").trim();
  if (!idToken) {
    return { ok: false, status: 400, error: "idToken_required" };
  }

  // Accept tokens issued for any of the configured CreatorHub OAuth
  // clients. Each platform registers its own client ID in Google Cloud
  // (web client for the dashboard, iOS client for the iPad CaptureApp,
  // shared Role Room client where applicable), and tokens carry the
  // issuing client's ID in their `aud` claim. We need ALL active
  // platform IDs in the audience list — otherwise the iPad's id-token
  // (audience = iOS client) gets rejected against just the web one.
  //
  // Multi-value support via comma-separated env var is intentional: a
  // single `CAPTUREAPP_GOOGLE_CLIENT_ID="A,B"` is easier for ops to
  // manage on Render than provisioning a new env var per future native
  // client (Android, macOS, etc.).
  const audiences = (
    input.clientIdOverride
      ? [input.clientIdOverride]
      : [
          ...splitClientIds(process.env.CREATORHUB_GOOGLE_CLIENT_ID),
          ...splitClientIds(process.env.ROLE_ROOM_GOOGLE_CLIENT_ID),
          ...splitClientIds(process.env.CAPTUREAPP_GOOGLE_CLIENT_ID),
        ]
  ).filter((v): v is string => typeof v === "string" && v.length > 0);

  if (audiences.length === 0) {
    return { ok: false, status: 503, error: "google_oauth_not_configured" };
  }

  let payload: GoogleTokenPayload;
  try {
    payload = input.verifyOverride
      ? await input.verifyOverride(idToken, audiences[0]!)
      : await defaultVerify(idToken, audiences);
  } catch (verifyError) {
    return {
      ok: false,
      status: 401,
      error: "invalid_id_token",
      detail: String((verifyError as Error)?.message ?? verifyError),
    };
  }

  const email = payload.email?.toLowerCase().trim();
  if (!email || payload.email_verified === false) {
    return { ok: false, status: 401, error: "email_not_verified" };
  }

  const fullName = payload.name?.trim() || email;
  const givenName = payload.given_name?.trim() ?? null;
  const familyName = payload.family_name?.trim() ?? null;
  const profileImage = payload.picture?.trim() ?? null;

  const upsert = await input.pool.query<{ id: string; role: string | null }>(
    `
      INSERT INTO users (email, first_name, last_name, profile_image_url, role, last_login_at, created_at, updated_at)
      VALUES ($1, $2, $3, $4, 'user', NOW(), NOW(), NOW())
      ON CONFLICT (email) DO UPDATE SET
        first_name = COALESCE(EXCLUDED.first_name, users.first_name),
        last_name  = COALESCE(EXCLUDED.last_name,  users.last_name),
        profile_image_url = COALESCE(EXCLUDED.profile_image_url, users.profile_image_url),
        last_login_at = NOW(),
        updated_at = NOW()
      RETURNING id, role
    `,
    [email, givenName, familyName, profileImage],
  );
  const userRow = upsert.rows[0];
  if (!userRow) {
    return { ok: false, status: 500, error: "user_upsert_failed" };
  }

  const role = (userRow.role ?? "user").toString();
  const tokenFactory = input.tokenFactory ?? (() => crypto.randomUUID());
  const sessionToken = tokenFactory();
  const now = (input.now ?? (() => new Date()))();
  const sessionData: ActiveSessionLike = {
    userId: userRow.id,
    email,
    name: fullName,
    role,
    loginAt: now.toISOString(),
  };
  input.activeSessions.set(sessionToken, sessionData);
  await persistAuthSession(input.pool, sessionToken, sessionData);

  return {
    ok: true,
    token: sessionToken,
    user: {
      id: userRow.id,
      email,
      name: fullName,
      role,
      profileImageUrl: profileImage,
    },
  };
}

/// Split a comma-separated client-ID env value into individual IDs,
/// trimming whitespace + dropping empties. Single-value envs work
/// unchanged ("abc.googleusercontent.com" → ["abc.googleusercontent.com"]),
/// multi-value envs let ops add iOS / Android client IDs without
/// provisioning new env vars per platform.
///
/// Exported for direct unit testing — the integration path goes
/// through `exchangeGoogleIdToken` whose verifyOverride contract
/// makes audience-list assertions awkward.
export function splitClientIds(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
}

async function defaultVerify(
  idToken: string,
  audiences: string[],
): Promise<GoogleTokenPayload> {
  const { OAuth2Client } = await import("google-auth-library");
  const client = new OAuth2Client(audiences[0]);
  const ticket = await client.verifyIdToken({ idToken, audience: audiences });
  const payload = ticket.getPayload();
  if (!payload) {
    throw new Error("empty payload");
  }
  return payload as GoogleTokenPayload;
}
