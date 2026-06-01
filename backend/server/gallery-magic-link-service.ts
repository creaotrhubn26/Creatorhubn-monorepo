// Gallery magic-link service — sentral validering + audit for klient-tilgang.
//
// Token-format: 32 bytes random, encoded som url-safe base64 (43 tegn).
// Konstant-tid sammenligning brukes ved oppslag for å unngå timing-angrep.

import { randomBytes, timingSafeEqual } from "crypto";
import type { Pool } from "pg";
import type { Request } from "express";

export interface MagicLinkRow {
  id: string;
  token: string;
  owner_user_id: string;
  recipient_label: string | null;
  recipient_email: string | null;
  file_ids: string[];
  gallery_name: string | null;
  message: string | null;
  expires_at: string;
  max_downloads: number | null;
  downloads_used: number;
  zip_downloads_used: number;
  max_zip_downloads: number | null;
  revoked_at: string | null;
  revoked_by: string | null;
  revoke_reason: string | null;
  created_at: string;
  last_accessed_at: string | null;
  metadata: Record<string, unknown>;
}

export type AccessType = "manifest" | "file" | "zip" | "rejected";
export type AccessOutcome =
  | "success"
  | "expired"
  | "revoked"
  | "over_quota"
  | "invalid_file_id"
  | "decrypt_failed"
  | "rate_limited"
  | "not_found";

export interface ValidationResult {
  ok: boolean;
  link?: MagicLinkRow;
  reason?: AccessOutcome;
}

/**
 * Generer en ny token: 32 bytes random → url-safe base64 uten padding.
 * Resulterer i 43-tegn streng. 256 bits entropy.
 */
export const generateToken = (): string =>
  randomBytes(32)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

/**
 * Slå opp og valider token. Returnerer link-rad + ok/reason.
 *
 * Bruker timingSafeEqual i token-sammenligningen for å unngå at
 * angripere kan lære gyldig token via response-time-analyse.
 */
export const validateToken = async (
  pool: Pool,
  token: string,
): Promise<ValidationResult> => {
  if (!token || typeof token !== "string" || token.length < 30 || token.length > 100) {
    return { ok: false, reason: "not_found" };
  }

  const r = await pool.query<MagicLinkRow>(
    `SELECT id, token, owner_user_id, recipient_label, recipient_email,
            file_ids, gallery_name, message, expires_at, max_downloads,
            downloads_used, zip_downloads_used, max_zip_downloads,
            revoked_at, revoked_by, revoke_reason, created_at,
            last_accessed_at, metadata
       FROM gallery_magic_links
      WHERE token = $1
      LIMIT 1`,
    [token],
  );

  if ((r.rowCount ?? 0) === 0) {
    return { ok: false, reason: "not_found" };
  }

  const link = r.rows[0];

  // Konstant-tid sammenligning — selv om SQL-equality gjorde jobben
  // gir vi en ekstra lag her for å håndtere fremtidig SHA-prefix-search.
  const stored = Buffer.from(link.token);
  const provided = Buffer.from(token);
  if (
    stored.length !== provided.length ||
    !timingSafeEqual(stored, provided)
  ) {
    return { ok: false, reason: "not_found" };
  }

  if (link.revoked_at) {
    return { ok: false, link, reason: "revoked" };
  }
  if (new Date(link.expires_at).getTime() < Date.now()) {
    return { ok: false, link, reason: "expired" };
  }
  if (
    link.max_downloads != null &&
    link.downloads_used >= link.max_downloads
  ) {
    return { ok: false, link, reason: "over_quota" };
  }
  return { ok: true, link };
};

export const isFileInBundle = (link: MagicLinkRow, fileId: string): boolean => {
  if (!Array.isArray(link.file_ids)) return false;
  return link.file_ids.includes(fileId);
};

export const incrementDownloadCount = async (
  pool: Pool,
  linkId: string,
): Promise<void> => {
  await pool
    .query(
      `UPDATE gallery_magic_links
          SET downloads_used = downloads_used + 1,
              last_accessed_at = now()
        WHERE id = $1`,
      [linkId],
    )
    .catch(() => undefined);
};

export const incrementZipDownloadCount = async (
  pool: Pool,
  linkId: string,
): Promise<void> => {
  await pool
    .query(
      `UPDATE gallery_magic_links
          SET zip_downloads_used = zip_downloads_used + 1,
              last_accessed_at = now()
        WHERE id = $1`,
      [linkId],
    )
    .catch(() => undefined);
};

export const checkZipQuota = (link: MagicLinkRow): boolean => {
  if (link.max_zip_downloads == null) return true;
  return link.zip_downloads_used < link.max_zip_downloads;
};

const truncate = (s: string | null | undefined, max: number): string | null => {
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
};

const extractIp = (req: Request): string | null => {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) {
    return truncate(xff.split(",")[0].trim(), 64);
  }
  if (Array.isArray(xff) && xff.length > 0) {
    return truncate(String(xff[0]), 64);
  }
  return truncate(req.ip, 64);
};

export const recordAccess = async (
  pool: Pool,
  rec: {
    linkId: string;
    fileId?: string;
    accessType: AccessType;
    outcome: AccessOutcome;
    req: Request;
    bytesServed?: number;
    metadata?: Record<string, unknown>;
  },
): Promise<void> => {
  try {
    await pool.query(
      `INSERT INTO gallery_magic_link_access
         (link_id, file_id, access_type, outcome, ip, user_agent, referer,
          bytes_served, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)`,
      [
        rec.linkId,
        rec.fileId ?? null,
        rec.accessType,
        rec.outcome,
        extractIp(rec.req),
        truncate(rec.req.headers["user-agent"] as string | undefined, 500),
        truncate(rec.req.headers["referer"] as string | undefined, 500),
        rec.bytesServed ?? null,
        JSON.stringify(rec.metadata ?? {}),
      ],
    );
  } catch (err) {
    console.warn("[magic-link] audit insert failed:", err);
  }
};

// Per-IP throttling — enkel in-memory bucket. For prod-scale: bytte til Redis.
// Defense-in-depth: hovedlaget er max_downloads / max_zip_downloads i DB.
const ipBuckets = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_PER_MINUTE = 30;
const RATE_WINDOW_MS = 60_000;

export const checkRateLimit = (ip: string | null): boolean => {
  if (!ip) return true;
  const now = Date.now();
  const bucket = ipBuckets.get(ip);
  if (!bucket || bucket.resetAt < now) {
    ipBuckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (bucket.count >= RATE_LIMIT_PER_MINUTE) return false;
  bucket.count++;
  return true;
};
