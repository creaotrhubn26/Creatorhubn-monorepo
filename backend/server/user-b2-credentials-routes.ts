/**
 * user-b2-credentials-routes.ts
 *
 * Per-bruker Backblaze B2-credentials. ALLE endepunkter er bak
 * requireUserSession — vanlige CreatorHub-brukere (fotograf, videograf,
 * instruktør, etc.) skal kunne lagre EGNE B2-credentials sånn at de
 * kan arkivere foto/video direkte til SIN EGEN bucket.
 *
 * Sikkerhetsprinsipper (eksplisitt fra Daniel 2026-06-08):
 *   - Vi eksponerer ALDRI admin's B2-credentials til vanlige brukere.
 *     Admin-bucket (B2_BUCKET_NAME) er KUN for admin-academy via
 *     admin-academy-b2-routes.ts; denne fila berører ikke den.
 *   - Vi returnerer ALDRI Key ID eller App Key i klartekst over API.
 *     Kun metadata (bucketName, region, isVerified, lastVerifiedAt).
 *   - Krypteringsmodell:
 *       * Master KEK = STORAGE_MASTER_KEK_HEX (64 hex-tegn)
 *       * Per-bruker KEK = HKDF(masterKek, salt=sha256(userId), info=…)
 *       * AES-256-GCM med 12-byte random IV
 *       * Lagret som base64(iv || tag || ciphertext) i *_encrypted-felt;
 *         separat *_iv-kolonne lagrer base64(iv) som metadata for
 *         revisjon (input til denne tabellen i fremtidig nøkkel-rotasjon).
 *   - Logger ALDRI keyId/appKey i klartekst — bare metadata + req-id.
 *
 * Endepunkter:
 *   GET    /api/user/b2-credentials              — metadata (har bruker creds?)
 *   POST   /api/user/b2-credentials              — opprett/oppdater creds
 *   POST   /api/user/b2-credentials/verify       — test mot bucket
 *   DELETE /api/user/b2-credentials              — slett creds
 *   POST   /api/user/b2-credentials/upload-url   — presigned PUT mot
 *                                                    brukerens bucket
 *
 * Defensive:
 *   - Hvis STORAGE_MASTER_KEK_HEX mangler → 503. Vi nekter å skrive
 *     credentials i klartekst i DB.
 *   - Hvis tabellen mangler (migrasjon 256 ikke kjørt) → 503 med klar
 *     melding, ikke 500.
 */

import type express from "express";
import type { Pool } from "pg";
import { randomBytes, createCipheriv, createDecipheriv, hkdfSync, createHash } from "crypto";
import {
  S3Client,
  HeadBucketCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface UserB2CredentialsRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireUserSession: (req: any, res: any) => any;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ───────────────────────────────────────────────────────────────────
// Crypto-helpers (envelope-encryption — speiler file-encryption.ts)
// ───────────────────────────────────────────────────────────────────

const KEK_LENGTH = 32;
const IV_LENGTH_GCM = 12;
const AUTH_TAG_LENGTH = 16;
const HKDF_DIGEST = "sha256";
const HKDF_INFO = Buffer.from("creatorhub-user-b2-credentials-v1", "utf8");

const isHex64 = (s: string): boolean => /^[0-9a-fA-F]{64}$/.test(s);

let masterKekCache: Buffer | null = null;

function getMasterKek(): Buffer | null {
  if (masterKekCache) return masterKekCache;
  const raw = process.env.STORAGE_MASTER_KEK_HEX;
  if (!raw || raw.trim().length === 0) return null;
  if (!isHex64(raw.trim())) {
    console.error(
      "[user-b2-credentials] STORAGE_MASTER_KEK_HEX må være eksakt 64 hex-tegn (32 bytes)",
    );
    return null;
  }
  masterKekCache = Buffer.from(raw.trim(), "hex");
  return masterKekCache;
}

function deriveUserKek(userId: string): Buffer {
  const master = getMasterKek();
  if (!master) throw new Error("encryption_not_configured");
  const salt = createHash("sha256").update(userId).digest();
  return Buffer.from(hkdfSync(HKDF_DIGEST, master, salt, HKDF_INFO, KEK_LENGTH));
}

/**
 * Krypter en streng med per-bruker KEK. Returnerer
 * { ciphertext, iv } der `ciphertext` er base64(iv || tag || ct)
 * (selvstendig — kan dekrypteres uten den separate IV-kolonnen)
 * og `iv` er base64(iv) til revisjonsformål.
 */
function encryptForUser(plaintext: string, userKek: Buffer): { ciphertext: string; iv: string } {
  const iv = randomBytes(IV_LENGTH_GCM);
  const cipher = createCipheriv("aes-256-gcm", userKek, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const packed = Buffer.concat([iv, tag, ct]).toString("base64");
  return { ciphertext: packed, iv: iv.toString("base64") };
}

function decryptForUser(packedBase64: string, userKek: Buffer): string {
  const buf = Buffer.from(packedBase64, "base64");
  if (buf.length < IV_LENGTH_GCM + AUTH_TAG_LENGTH) {
    throw new Error("ciphertext_invalid_length");
  }
  const iv = buf.subarray(0, IV_LENGTH_GCM);
  const tag = buf.subarray(IV_LENGTH_GCM, IV_LENGTH_GCM + AUTH_TAG_LENGTH);
  const ct = buf.subarray(IV_LENGTH_GCM + AUTH_TAG_LENGTH);
  const dec = createDecipheriv("aes-256-gcm", userKek, iv);
  dec.setAuthTag(tag);
  return Buffer.concat([dec.update(ct), dec.final()]).toString("utf8");
}

// ───────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────

const VALID_REGIONS = new Set([
  "us-west-000",
  "us-west-001",
  "us-west-002",
  "us-west-004",
  "us-east-005",
  "eu-central-003",
]);

function sanitizeRegion(region: string | undefined | null): string {
  const r = (region || "").trim();
  return VALID_REGIONS.has(r) ? r : "us-west-001";
}

function defaultEndpointFor(region: string): string {
  return `https://s3.${region}.backblazeb2.com`;
}

function sanitizeBucketName(name: string | undefined | null): string {
  return (name || "").trim().slice(0, 256);
}

function sanitizeKey(key: string | undefined | null): string {
  // Tillat alfanumerisk + `._-/`, ingen `..`, kapp ved 1024 (S3-grense)
  return (key || "")
    .trim()
    .replace(/[\\]/g, "/")
    .split("/")
    .filter((p) => p && p !== "." && p !== "..")
    .join("/")
    .replace(/[^A-Za-z0-9._\-/() ]+/g, "-")
    .slice(0, 1024);
}

function resolveUserId(req: any, session: any): string | null {
  // Prøv flere kjente felter — session-objektets format varierer på tvers
  // av legacy/Auth0/dev-flow.
  const candidates = [
    session?.userId,
    session?.id,
    session?.user?.id,
    session?.user?.userId,
    req?.user?.id,
    req?.user?.userId,
    req?.session?.userId,
  ].filter((x): x is string => typeof x === "string" && x.length > 0);
  return candidates[0] || null;
}

function isUndefinedTableError(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  return (
    e?.code === "42P01" ||
    /relation "user_b2_credentials" does not exist/i.test(e?.message || "")
  );
}

function buildS3Client(opts: {
  keyId: string;
  appKey: string;
  region: string;
  endpointUrl: string;
}): S3Client {
  return new S3Client({
    region: opts.region,
    endpoint: opts.endpointUrl,
    credentials: { accessKeyId: opts.keyId, secretAccessKey: opts.appKey },
    forcePathStyle: true,
  });
}

// ───────────────────────────────────────────────────────────────────
// Route-setup
// ───────────────────────────────────────────────────────────────────

export function setupUserB2CredentialsRoutes(deps: UserB2CredentialsRoutesDeps): void {
  const { app, pool, requireUserSession } = deps;

  // ─── GET /api/user/b2-credentials — metadata only ─────────────────
  app.get("/api/user/b2-credentials", async (req, res) => {
    try {
      const session = requireUserSession(req, res);
      if (!session) return;
      const userId = resolveUserId(req, session);
      if (!userId) return res.status(401).json({ error: "no_session" });

      let row;
      try {
        const result = await pool.query(
          `SELECT bucket_name, region, endpoint_url, is_verified,
                  last_verified_at, last_error, created_at, updated_at
             FROM user_b2_credentials
            WHERE user_id = $1::uuid AND is_active = TRUE
            LIMIT 1`,
          [userId],
        );
        row = result.rows[0];
      } catch (err) {
        if (isUndefinedTableError(err)) {
          return res.status(503).json({
            error: "table_missing",
            message: "Migrasjon 256_user_b2_credentials.sql er ikke kjørt enda",
            exists: false,
          });
        }
        throw err;
      }

      if (!row) return res.json({ exists: false });
      return res.json({
        exists: true,
        bucketName: row.bucket_name,
        region: row.region,
        endpointUrl: row.endpoint_url,
        isVerified: !!row.is_verified,
        lastVerifiedAt: row.last_verified_at,
        lastError: row.last_error,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
    } catch (err) {
      console.error("[user-b2-credentials] GET failed:", err);
      res.status(500).json({ error: "fetch_failed" });
    }
  });

  // ─── POST /api/user/b2-credentials — opprett/oppdater ─────────────
  app.post("/api/user/b2-credentials", async (req, res) => {
    try {
      const session = requireUserSession(req, res);
      if (!session) return;
      const userId = resolveUserId(req, session);
      if (!userId) return res.status(401).json({ error: "no_session" });

      const body = (req.body || {}) as Record<string, unknown>;
      const keyId = typeof body.keyId === "string" ? body.keyId.trim() : "";
      const appKey = typeof body.appKey === "string" ? body.appKey.trim() : "";
      const bucketName = sanitizeBucketName(body.bucketName as string);
      const region = sanitizeRegion(body.region as string);
      const endpointUrl =
        typeof body.endpointUrl === "string" && body.endpointUrl.trim().length > 0
          ? body.endpointUrl.trim()
          : defaultEndpointFor(region);

      if (!keyId || !appKey || !bucketName) {
        return res.status(400).json({
          error: "missing_fields",
          message: "keyId, appKey og bucketName må alle være satt",
        });
      }
      // Defensive: ikke aksepter mistenkelig korte/lange verdier
      if (keyId.length < 8 || keyId.length > 256 || appKey.length < 16 || appKey.length > 512) {
        return res.status(400).json({ error: "invalid_credential_format" });
      }

      // Master KEK må være konfigurert — vi nekter å lagre klartekst
      if (!getMasterKek()) {
        return res.status(503).json({
          error: "encryption_not_configured",
          message:
            "STORAGE_MASTER_KEK_HEX mangler på serveren — kan ikke lagre credentials trygt",
        });
      }

      const userKek = deriveUserKek(userId);
      const keyIdPacked = encryptForUser(keyId, userKek);
      const appKeyPacked = encryptForUser(appKey, userKek);

      try {
        await pool.query(
          `INSERT INTO user_b2_credentials (
             user_id, bucket_name,
             key_id_encrypted, key_id_iv,
             app_key_encrypted, app_key_iv,
             endpoint_url, region,
             is_active, is_verified, last_error,
             created_at, updated_at
           ) VALUES (
             $1::uuid, $2,
             $3, $4,
             $5, $6,
             $7, $8,
             TRUE, FALSE, NULL,
             now(), now()
           )
           ON CONFLICT (user_id) DO UPDATE SET
             bucket_name = EXCLUDED.bucket_name,
             key_id_encrypted = EXCLUDED.key_id_encrypted,
             key_id_iv = EXCLUDED.key_id_iv,
             app_key_encrypted = EXCLUDED.app_key_encrypted,
             app_key_iv = EXCLUDED.app_key_iv,
             endpoint_url = EXCLUDED.endpoint_url,
             region = EXCLUDED.region,
             is_active = TRUE,
             is_verified = FALSE,
             last_error = NULL,
             updated_at = now()`,
          [
            userId,
            bucketName,
            keyIdPacked.ciphertext,
            keyIdPacked.iv,
            appKeyPacked.ciphertext,
            appKeyPacked.iv,
            endpointUrl,
            region,
          ],
        );
      } catch (err) {
        if (isUndefinedTableError(err)) {
          return res.status(503).json({
            error: "table_missing",
            message: "Migrasjon 256_user_b2_credentials.sql er ikke kjørt enda",
          });
        }
        throw err;
      }

      // Trigger auto-verify (best effort, ikke blokker svar over noen sekunder)
      let isVerified = false;
      let verifyError: string | null = null;
      try {
        const client = buildS3Client({ keyId, appKey, region, endpointUrl });
        await client.send(new HeadBucketCommand({ Bucket: bucketName }));
        await pool.query(
          `UPDATE user_b2_credentials
              SET is_verified = TRUE, last_verified_at = now(), last_error = NULL, updated_at = now()
            WHERE user_id = $1::uuid`,
          [userId],
        );
        isVerified = true;
      } catch (err) {
        verifyError = (err as Error)?.message?.slice(0, 500) || "verify_failed";
        try {
          await pool.query(
            `UPDATE user_b2_credentials
                SET is_verified = FALSE, last_error = $2, updated_at = now()
              WHERE user_id = $1::uuid`,
            [userId, verifyError],
          );
        } catch {
          // tabellen finnes, men UPDATE feilet — log og fortsett
          console.warn("[user-b2-credentials] update last_error failed for", userId);
        }
      }

      console.info("[user-b2-credentials] stored creds for user", {
        userId,
        bucketName,
        region,
        isVerified,
      });

      return res.json({
        success: true,
        isVerified,
        verifyError,
      });
    } catch (err) {
      console.error("[user-b2-credentials] POST failed:", err);
      res.status(500).json({ error: "save_failed" });
    }
  });

  // ─── POST /api/user/b2-credentials/verify ─────────────────────────
  app.post("/api/user/b2-credentials/verify", async (req, res) => {
    try {
      const session = requireUserSession(req, res);
      if (!session) return;
      const userId = resolveUserId(req, session);
      if (!userId) return res.status(401).json({ error: "no_session" });

      if (!getMasterKek()) {
        return res.status(503).json({ error: "encryption_not_configured" });
      }

      let row;
      try {
        const result = await pool.query(
          `SELECT bucket_name, region, endpoint_url,
                  key_id_encrypted, app_key_encrypted
             FROM user_b2_credentials
            WHERE user_id = $1::uuid AND is_active = TRUE
            LIMIT 1`,
          [userId],
        );
        row = result.rows[0];
      } catch (err) {
        if (isUndefinedTableError(err)) {
          return res.status(503).json({ error: "table_missing" });
        }
        throw err;
      }
      if (!row) return res.status(404).json({ error: "no_credentials" });

      const userKek = deriveUserKek(userId);
      let keyId: string;
      let appKey: string;
      try {
        keyId = decryptForUser(row.key_id_encrypted, userKek);
        appKey = decryptForUser(row.app_key_encrypted, userKek);
      } catch (err) {
        console.error("[user-b2-credentials] decrypt failed for", userId);
        return res.status(500).json({ error: "decrypt_failed" });
      }

      const region: string = row.region || "us-west-001";
      const endpointUrl: string = row.endpoint_url || defaultEndpointFor(region);

      try {
        const client = buildS3Client({ keyId, appKey, region, endpointUrl });
        await client.send(new HeadBucketCommand({ Bucket: row.bucket_name }));
        await pool.query(
          `UPDATE user_b2_credentials
              SET is_verified = TRUE, last_verified_at = now(), last_error = NULL, updated_at = now()
            WHERE user_id = $1::uuid`,
          [userId],
        );
        return res.json({ success: true, isVerified: true });
      } catch (err) {
        const msg = (err as Error)?.message?.slice(0, 500) || "verify_failed";
        await pool.query(
          `UPDATE user_b2_credentials
              SET is_verified = FALSE, last_error = $2, updated_at = now()
            WHERE user_id = $1::uuid`,
          [userId, msg],
        );
        return res.json({ success: false, isVerified: false, error: msg });
      }
    } catch (err) {
      console.error("[user-b2-credentials] verify failed:", err);
      res.status(500).json({ error: "verify_failed" });
    }
  });

  // ─── DELETE /api/user/b2-credentials ──────────────────────────────
  app.delete("/api/user/b2-credentials", async (req, res) => {
    try {
      const session = requireUserSession(req, res);
      if (!session) return;
      const userId = resolveUserId(req, session);
      if (!userId) return res.status(401).json({ error: "no_session" });

      try {
        await pool.query(
          `DELETE FROM user_b2_credentials WHERE user_id = $1::uuid`,
          [userId],
        );
      } catch (err) {
        if (isUndefinedTableError(err)) {
          // Tabellen finnes ikke — fra brukerens perspektiv har de heller ingen creds
          return res.json({ success: true });
        }
        throw err;
      }
      console.info("[user-b2-credentials] deleted creds for user", userId);
      return res.json({ success: true });
    } catch (err) {
      console.error("[user-b2-credentials] DELETE failed:", err);
      res.status(500).json({ error: "delete_failed" });
    }
  });

  // ─── POST /api/user/b2-credentials/upload-url ─────────────────────
  // Internal helper: generer presigned PUT-URL mot BRUKERENS bucket.
  app.post("/api/user/b2-credentials/upload-url", async (req, res) => {
    try {
      const session = requireUserSession(req, res);
      if (!session) return;
      const userId = resolveUserId(req, session);
      if (!userId) return res.status(401).json({ error: "no_session" });

      const body = (req.body || {}) as Record<string, unknown>;
      const fileName = sanitizeKey(typeof body.fileName === "string" ? body.fileName : "");
      const contentType =
        typeof body.contentType === "string" && body.contentType.trim().length > 0
          ? body.contentType.trim().slice(0, 256)
          : "application/octet-stream";
      if (!fileName) {
        return res.status(400).json({ error: "invalid_file_name" });
      }

      if (!getMasterKek()) {
        return res.status(503).json({ error: "encryption_not_configured" });
      }

      let row;
      try {
        const result = await pool.query(
          `SELECT bucket_name, region, endpoint_url,
                  key_id_encrypted, app_key_encrypted
             FROM user_b2_credentials
            WHERE user_id = $1::uuid AND is_active = TRUE
            LIMIT 1`,
          [userId],
        );
        row = result.rows[0];
      } catch (err) {
        if (isUndefinedTableError(err)) {
          return res.status(503).json({ error: "table_missing" });
        }
        throw err;
      }
      if (!row) {
        return res.status(400).json({ error: "no_credentials" });
      }

      const userKek = deriveUserKek(userId);
      let keyId: string;
      let appKey: string;
      try {
        keyId = decryptForUser(row.key_id_encrypted, userKek);
        appKey = decryptForUser(row.app_key_encrypted, userKek);
      } catch {
        return res.status(500).json({ error: "decrypt_failed" });
      }

      const region: string = row.region || "us-west-001";
      const endpointUrl: string = row.endpoint_url || defaultEndpointFor(region);

      // Key-struktur per spec: `creatorhub-uploads/:userId/:fileName`
      const objectKey = `creatorhub-uploads/${userId}/${fileName}`;
      const expiresIn = 15 * 60; // 15 min

      const client = buildS3Client({ keyId, appKey, region, endpointUrl });
      const cmd = new PutObjectCommand({
        Bucket: row.bucket_name,
        Key: objectKey,
        ContentType: contentType,
      });
      const uploadUrl = await getSignedUrl(client, cmd, { expiresIn });
      const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

      return res.json({
        uploadUrl,
        key: objectKey,
        bucket: row.bucket_name,
        expiresAt,
      });
    } catch (err) {
      console.error("[user-b2-credentials] upload-url failed:", err);
      res.status(500).json({ error: "upload_url_failed" });
    }
  });
}
