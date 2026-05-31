// Google Drive helpers — gjenbrukbar lasting av OAuth-klient, kvotesjekk,
// retry-med-backoff og folder-resolution. Trekker boilerplate ut av
// route-filene slik at hver Drive-rute slipper å duplisere
// token-decryption + refresh-håndtering.

import type { Pool } from "pg";

export interface DriveClient {
  driveApi: any;
  oauthClient: any;
  userId: string;
}

export interface DriveQuota {
  limit: number | null; // null = unlimited (Workspace med pooled storage)
  usage: number;
  free: number | null;
  hasSpace: boolean;
}

export interface DriveLoadError extends Error {
  code: "google_not_connected" | "tokens_invalid" | "oauth_config_missing" | "encryption_key_missing" | "cred_load_failed";
}

const makeError = (code: DriveLoadError["code"], message: string): DriveLoadError => {
  const err = new Error(message) as DriveLoadError;
  err.code = code;
  return err;
};

// Last Drive-klient for en bruker — bruker samme pattern som
// photographer-misc-routes.ts (decrypt fra role_room_google_connections,
// refresh hvis vi har refresh-token, returner ferdig satt opp drive.v3-klient).
export async function loadDriveClient(
  pool: Pool,
  userId: string,
): Promise<DriveClient> {
  const { google } = await import("googleapis");

  const r = await pool.query(
    `SELECT access_token_encrypted, refresh_token_encrypted, expiry_date, oauth_app
       FROM role_room_google_connections
      WHERE user_id = $1 AND connection_state = 'connected'
        AND (refresh_token_encrypted IS NOT NULL OR access_token_encrypted IS NOT NULL)
      ORDER BY last_used_at DESC NULLS LAST LIMIT 1`,
    [userId],
  );
  if ((r.rowCount ?? 0) === 0) {
    throw makeError(
      "google_not_connected",
      "Google Workspace må kobles til for å bruke Drive-sync.",
    );
  }

  const row = r.rows[0];

  const { getGoogleWorkspaceOauthConfig, normalizeGoogleWorkspaceOauthApp } =
    await import("./google-workspace-oauth.js");
  const oauthApp = normalizeGoogleWorkspaceOauthApp(row.oauth_app, "role_room");
  const oauthConfig = getGoogleWorkspaceOauthConfig(
    oauthApp as "role_room" | "creatorhub",
  );
  if (!oauthConfig.clientId || !oauthConfig.clientSecret) {
    throw makeError(
      "oauth_config_missing",
      "Google OAuth-konfigurasjonen mangler på serveren.",
    );
  }

  const cryptoMod = await import("crypto");
  const secret =
    process.env.ROLE_ROOM_GOOGLE_TOKEN_ENCRYPTION_KEY ||
    process.env.ROLE_ROOM_ENCRYPTION_KEY ||
    process.env.SESSION_SECRET ||
    process.env.JWT_SECRET ||
    process.env.AUTH_SECRET;
  if (!secret) {
    throw makeError(
      "encryption_key_missing",
      "Token-krypteringsnøkkelen mangler.",
    );
  }
  const key = cryptoMod.createHash("sha256").update(secret).digest();
  const decrypt = (val: string | null | undefined): string | null => {
    if (!val) return null;
    try {
      const buf = Buffer.from(val, "base64");
      if (buf.length < 28) return null;
      const iv = buf.subarray(0, 12);
      const tag = buf.subarray(12, 28);
      const ct = buf.subarray(28);
      const dec = cryptoMod.createDecipheriv("aes-256-gcm", key, iv);
      dec.setAuthTag(tag);
      return Buffer.concat([dec.update(ct), dec.final()]).toString("utf8");
    } catch {
      return null;
    }
  };

  const refreshToken = decrypt(row.refresh_token_encrypted);
  const accessToken = decrypt(row.access_token_encrypted);
  if (!refreshToken && !accessToken) {
    throw makeError(
      "tokens_invalid",
      "De lagrede Google-tokenene kunne ikke dekrypteres.",
    );
  }

  const oauthClient = new google.auth.OAuth2(
    oauthConfig.clientId,
    oauthConfig.clientSecret,
    oauthConfig.redirectUri ?? undefined,
  );
  const seed: any = {};
  if (refreshToken) seed.refresh_token = refreshToken;
  if (accessToken) seed.access_token = accessToken;
  if (row.expiry_date) {
    const ts = Date.parse(row.expiry_date);
    if (Number.isFinite(ts)) seed.expiry_date = ts;
  }
  oauthClient.setCredentials(seed);

  if (refreshToken) {
    try {
      const { refreshAccessTokenWithStateTracking } = await import(
        "./google-oauth-shared.js"
      );
      await refreshAccessTokenWithStateTracking(oauthClient, {
        pool,
        userId,
        context: "drive_sync_refresh",
      }).catch(() => undefined);
    } catch (err) {
      // Hvis refresh feiler stille, fortsetter vi med eksisterende access-token —
      // hvis det er utløpt vil Drive returnere 401 og withDriveRetry fanger det.
      console.warn("[drive-helpers] refresh attempt failed:", err);
    }
  }

  const driveApi = google.drive({ version: "v3", auth: oauthClient });

  return { driveApi, oauthClient, userId };
}

// Drive retry-med-backoff. Håndterer:
//   - 429 (rate limit) — retry med eksponensiell backoff + jitter
//   - 5xx (server error) — retry
//   - 401 (token expired) — én reload+retry hvis reloader er gitt
// Alt annet kastes umiddelbart.
export async function withDriveRetry<T>(
  fn: () => Promise<T>,
  opts?: {
    maxAttempts?: number;
    baseDelayMs?: number;
    onReauth?: () => Promise<void>; // kalles én gang ved 401
  },
): Promise<T> {
  const maxAttempts = opts?.maxAttempts ?? 4;
  const baseDelayMs = opts?.baseDelayMs ?? 500;
  let reauthed = false;
  let lastError: any = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const status =
        err?.code ?? err?.response?.status ?? err?.status ?? 0;

      if (status === 401 && !reauthed && opts?.onReauth) {
        reauthed = true;
        try {
          await opts.onReauth();
          continue; // umiddelbar retry uten backoff
        } catch {
          throw err;
        }
      }

      // 429 / 5xx → retry med backoff
      if (status === 429 || (status >= 500 && status < 600)) {
        if (attempt === maxAttempts - 1) break;
        const jitter = Math.floor(Math.random() * 200);
        const delay = baseDelayMs * Math.pow(2, attempt) + jitter;
        await new Promise<void>((resolve) => setTimeout(resolve, delay));
        continue;
      }

      // Alle andre feil — kast umiddelbart
      throw err;
    }
  }
  throw lastError;
}

// Sjekk Drive-kvote. Returnerer null-limit for Workspace-pooled-storage
// (da rapporterer Drive limit som "unlimited" og vi antar plass).
export async function checkDriveQuota(
  driveApi: any,
  minBytesNeeded: number = 0,
): Promise<DriveQuota> {
  const result = await withDriveRetry(() =>
    driveApi.about.get({ fields: "storageQuota" }),
  );
  const sq = result.data?.storageQuota || {};
  const limit = sq.limit ? Number(sq.limit) : null;
  const usage = sq.usage ? Number(sq.usage) : 0;
  const free = limit === null ? null : Math.max(0, limit - usage);
  const hasSpace = free === null || free >= minBytesNeeded;
  return { limit, usage, free, hasSpace };
}

// Idempotent: finn eller opprett en folder med gitt navn under en parent.
// Returnerer folder-id.
export async function ensureDriveFolder(
  driveApi: any,
  name: string,
  parentId?: string,
): Promise<string> {
  const escaped = name.replace(/'/g, "\\'");
  const q = parentId
    ? `name='${escaped}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
    : `name='${escaped}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;

  const list = await withDriveRetry(() =>
    driveApi.files.list({
      q,
      fields: "files(id, name)",
      spaces: "drive",
    }),
  );
  if ((list.data.files ?? []).length > 0) {
    return list.data.files[0].id;
  }

  const created = await withDriveRetry(() =>
    driveApi.files.create({
      requestBody: {
        name,
        mimeType: "application/vnd.google-apps.folder",
        ...(parentId ? { parents: [parentId] } : {}),
      },
      fields: "id",
    }),
  );
  return created.data.id;
}

// Map en hvilken som helst Drive-feil til en HTTP-status + meldingstekst.
export function mapDriveError(err: any): {
  status: number;
  code: string;
  message: string;
} {
  const status =
    err?.code ?? err?.response?.status ?? err?.status ?? 500;

  if ((err as DriveLoadError)?.code) {
    const loadErr = err as DriveLoadError;
    const httpStatus = loadErr.code === "google_not_connected" ? 412 : 500;
    return { status: httpStatus, code: loadErr.code, message: loadErr.message };
  }

  if (status === 401) {
    return {
      status: 401,
      code: "drive_auth_expired",
      message:
        "Google-tilgangen er utløpt. Koble til Google på nytt fra innstillinger.",
    };
  }
  if (status === 403) {
    return {
      status: 403,
      code: "drive_scope_missing",
      message:
        "Mangler Google Drive-tilgang. Koble til Google på nytt og godkjenn Drive-scope.",
    };
  }
  if (status === 429) {
    return {
      status: 429,
      code: "drive_rate_limited",
      message:
        "Google Drive har midlertidig blokkert flere forespørsler — prøv igjen om litt.",
    };
  }
  if (status >= 500) {
    return {
      status: 502,
      code: "drive_upstream_error",
      message: "Google Drive er midlertidig utilgjengelig — prøv igjen senere.",
    };
  }

  return {
    status: 500,
    code: "drive_sync_failed",
    message: String(err?.message ?? "Ukjent feil mot Google Drive").slice(0, 200),
  };
}
