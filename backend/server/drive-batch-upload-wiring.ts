import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { google, type drive_v3 } from "googleapis";
import type { Pool } from "pg";
import type {
  DriveBatchItem,
} from "./drive-batch-planning.js";
import type { DriveUploader } from "./drive-batch-upload-service.js";

/**
 * Production wiring for the Drive batch pipeline: resolves a Drive
 * API client for a user from the existing
 * ``role_room_google_connections`` table, wraps it as a
 * ``DriveUploader`` the orchestrator can call without caring about
 * OAuth or ``googleapis``.
 *
 * Kept in its own file so tests of the orchestrator + pure helpers
 * don't need to import ``googleapis`` (which pulls in a heavy
 * transitive dependency graph). The orchestrator sees only the
 * narrow ``DriveUploader`` protocol and an injected resolver.
 */

const CREATORHUB_GOOGLE_OAUTH_APP = "creatorhub";

/// Readable error the route surfaces when the photographer hasn't
/// linked their Google Workspace yet.
export class DriveNotConnectedError extends Error {
  constructor(userId: string) {
    super(`User ${userId} has no CreatorHub Google connection`);
    this.name = "DriveNotConnectedError";
  }
}

export interface DriveClientResolver {
  /// Return an authenticated Drive API client for the given user.
  /// Throws ``DriveNotConnectedError`` when no connection exists.
  resolve(userId: string): Promise<drive_v3.Drive>;
}

/**
 * Live resolver backed by the shared OAuth table. Tokens are
 * refreshed on demand — the ``OAuth2Client`` internally re-issues
 * on 401, and we persist the refreshed values back so the next
 * call doesn't pay the refresh cost again.
 */
export function makePgDriveClientResolver(pool: Pool): DriveClientResolver {
  return {
    resolve: async (userId: string) => {
      const row = await pool.query<{
        access_token_encrypted: string | null;
        refresh_token_encrypted: string | null;
        expiry_date: string | null;
      }>(
        `SELECT access_token_encrypted, refresh_token_encrypted, expiry_date
         FROM role_room_google_connections
         WHERE user_id = $1 AND oauth_app = $2
         LIMIT 1`,
        [userId, CREATORHUB_GOOGLE_OAUTH_APP],
      );
      if (row.rowCount === 0 || !row.rows[0]) {
        throw new DriveNotConnectedError(userId);
      }
      const connection = row.rows[0];
      const access = decryptGoogleToken(connection.access_token_encrypted);
      const refresh = decryptGoogleToken(connection.refresh_token_encrypted);
      if (!refresh) {
        throw new DriveNotConnectedError(userId);
      }

      const clientId = process.env.GOOGLE_CREATORHUB_CLIENT_ID
        ?? process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CREATORHUB_CLIENT_SECRET
        ?? process.env.GOOGLE_CLIENT_SECRET;
      const redirectUri = process.env.GOOGLE_CREATORHUB_REDIRECT_URI
        ?? process.env.GOOGLE_REDIRECT_URI
        ?? "https://creatorhub-backend-rtbl.onrender.com/api/creatorhub-google/oauth/callback";
      if (!clientId || !clientSecret) {
        throw new Error("CreatorHub Google OAuth env vars missing");
      }
      const oauth = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
      oauth.setCredentials({
        access_token: access ?? undefined,
        refresh_token: refresh,
        expiry_date: connection.expiry_date
          ? Date.parse(connection.expiry_date)
          : undefined,
      });
      // Persist refreshed tokens back so the next resolve call
      // doesn't pay the refresh round-trip again.
      oauth.on("tokens", (tokens) => {
        void persistRefreshedTokens(pool, userId, tokens).catch((err) => {
          console.warn("[drive-batch] token persist failed", err);
        });
      });
      return google.drive({ version: "v3", auth: oauth });
    },
  };
}

/**
 * Live ``DriveUploader`` that calls ``drive.files.create`` with
 * a readable-stream media body. The ``googleapis`` SDK handles
 * resumable-vs-multipart internally based on the body size —
 * for bodies > ``uploadType=resumable`` threshold it runs a full
 * resumable session, for smaller bodies it sends multipart in a
 * single request. We don't need to hand-roll either.
 */
export function makeDriveUploader(resolver: DriveClientResolver): DriveUploader {
  return {
    upload: async (item: DriveBatchItem) => {
      const userId = extractUserIdFromItemContext(item);
      if (!userId) {
        return {
          error: {
            code: 400,
            message: "item missing userId context — wire resolver per-batch",
          },
        };
      }
      // In practice the uploader is per-batch so this branch is
      // dead code for real traffic; kept as a defensive error to
      // make the failure mode obvious if a caller forgets.
      try {
        const drive = await resolver.resolve(userId);
        return await performUpload(drive, item);
      } catch (err) {
        const driveErr = err as { code?: number; message?: string };
        return {
          error: {
            code: typeof driveErr.code === "number" ? driveErr.code : 500,
            message: driveErr.message ?? "unknown drive error",
          },
        };
      }
    },
  };
}

/**
 * Factory for a per-batch uploader. This is the flavour the worker
 * loop uses — one ``DriveUploader`` bound to the batch owner's
 * Drive client, constructed once per tick + reused across every
 * item in the batch. Avoids the per-item token-refresh overhead.
 */
export async function makePerBatchDriveUploader(
  resolver: DriveClientResolver,
  userId: string,
): Promise<DriveUploader> {
  const drive = await resolver.resolve(userId);
  return {
    upload: async (item: DriveBatchItem) => {
      try {
        return await performUpload(drive, item);
      } catch (err) {
        const driveErr = err as { code?: number; message?: string };
        return {
          error: {
            code: typeof driveErr.code === "number" ? driveErr.code : 500,
            message: driveErr.message ?? "unknown drive error",
          },
        };
      }
    },
  };
}

async function performUpload(
  drive: drive_v3.Drive,
  item: DriveBatchItem,
): Promise<{
  response?: { statusCode?: number; data?: { id?: string } };
  error?: { code?: number; message?: string };
}> {
  if (!fs.existsSync(item.localPath)) {
    return { error: { code: 404, message: `local file missing: ${item.localPath}` } };
  }
  const response = await drive.files.create({
    requestBody: {
      name: item.driveName,
      mimeType: item.mimeType,
      parents: [item.targetFolderId],
    },
    media: {
      mimeType: item.mimeType,
      body: fs.createReadStream(item.localPath),
    },
    fields: "id",
    supportsAllDrives: true,
  });
  return {
    response: {
      statusCode: response.status,
      data: { id: response.data.id ?? undefined },
    },
  };
}

async function persistRefreshedTokens(
  pool: Pool,
  userId: string,
  tokens: { access_token?: string | null; refresh_token?: string | null; expiry_date?: number | null },
): Promise<void> {
  const access = tokens.access_token
    ? encryptGoogleToken(tokens.access_token)
    : null;
  const refresh = tokens.refresh_token
    ? encryptGoogleToken(tokens.refresh_token)
    : null;
  const expiry = typeof tokens.expiry_date === "number"
    ? new Date(tokens.expiry_date).toISOString()
    : null;
  await pool.query(
    `UPDATE role_room_google_connections
     SET access_token_encrypted = COALESCE($1, access_token_encrypted),
         refresh_token_encrypted = COALESCE($2, refresh_token_encrypted),
         expiry_date = COALESCE($3, expiry_date),
         updated_at = NOW(),
         last_used_at = NOW()
     WHERE user_id = $4 AND oauth_app = $5`,
    [access, refresh, expiry, userId, CREATORHUB_GOOGLE_OAUTH_APP],
  );
}

// MARK: - Symmetric crypto (matches creatorhub-google-routes format)

function deriveEncryptionKey(): Buffer | null {
  const secret = process.env.CREATORHUB_GOOGLE_ENCRYPTION_KEY
    ?? process.env.GOOGLE_TOKEN_ENCRYPTION_KEY
    ?? process.env.SESSION_SECRET;
  if (!secret) return null;
  return crypto.createHash("sha256").update(secret).digest();
}

function encryptGoogleToken(value: string): string | null {
  const key = deriveEncryptionKey();
  if (!key) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${authTag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

function decryptGoogleToken(value: string | null): string | null {
  if (!value) return null;
  const key = deriveEncryptionKey();
  if (!key) return null;
  const parts = value.split(".");
  // Both the CreatorHub format (3 parts: iv.tag.ciphertext) and the
  // Role Room format (4 parts with a ``v1`` prefix) feed the same
  // table. Accept either so an old Role-Room-style token can be
  // read without migrating.
  let ivPart: string | undefined;
  let tagPart: string | undefined;
  let cipherPart: string | undefined;
  if (parts.length === 3) {
    [ivPart, tagPart, cipherPart] = parts;
  } else if (parts.length === 4 && parts[0] === "v1") {
    [, ivPart, tagPart, cipherPart] = parts;
  } else {
    return null;
  }
  try {
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(ivPart!, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagPart!, "base64url"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(cipherPart!, "base64url")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    return null;
  }
}

// MARK: - Item-context helpers

/// The orchestrator's ``DriveBatchItem`` doesn't carry a userId
/// (batches are user-scoped, not items). When a caller wants the
/// generic ``makeDriveUploader`` rather than the per-batch flavour
/// they can stash the userId inside ``localPath`` as a prefix —
/// we reserve ``__userId=<id>:``. Not used in production; kept for
/// one-off scripts.
function extractUserIdFromItemContext(item: DriveBatchItem): string | null {
  const prefix = "__userId=";
  if (!item.localPath.startsWith(prefix)) return null;
  const idx = item.localPath.indexOf(":");
  if (idx < 0) return null;
  return item.localPath.slice(prefix.length, idx);
}

// MARK: - Public schema/env helpers

/**
 * Guard so the worker doesn't crash-loop when env vars are
 * missing. Routes call this before kicking off a batch so the UI
 * can surface a "connect Google first" message instead of a
 * generic 500.
 */
export function driveUploaderCanRun(): {
  ok: boolean;
  missing: string[];
} {
  const missing: string[] = [];
  if (!process.env.GOOGLE_CREATORHUB_CLIENT_ID && !process.env.GOOGLE_CLIENT_ID) {
    missing.push("GOOGLE_CREATORHUB_CLIENT_ID");
  }
  if (
    !process.env.GOOGLE_CREATORHUB_CLIENT_SECRET
    && !process.env.GOOGLE_CLIENT_SECRET
  ) {
    missing.push("GOOGLE_CREATORHUB_CLIENT_SECRET");
  }
  if (
    !process.env.CREATORHUB_GOOGLE_ENCRYPTION_KEY
    && !process.env.GOOGLE_TOKEN_ENCRYPTION_KEY
    && !process.env.SESSION_SECRET
  ) {
    missing.push("CREATORHUB_GOOGLE_ENCRYPTION_KEY");
  }
  return { ok: missing.length === 0, missing };
}

/**
 * Simple sanity helper: normalise an absolute path so the uploader
 * doesn't end up opening files under a different working directory
 * than the worker thinks. Returns null for clearly-unsafe paths
 * (traversals, non-file URIs).
 */
export function validateLocalUploadPath(raw: string): string | null {
  if (!raw || raw.includes("\0")) return null;
  const normalized = path.normalize(raw);
  // Allow absolute paths only — relative paths would be evaluated
  // against whatever cwd the worker inherits, which is fragile
  // under supervisor restarts.
  if (!path.isAbsolute(normalized)) return null;
  if (normalized.includes("..")) return null;
  return normalized;
}
