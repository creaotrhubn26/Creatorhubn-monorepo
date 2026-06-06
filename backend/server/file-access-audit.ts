// File access audit — sentral logging av "hvem hentet hva, når, hvordan"
// for alle fil-serving-endepunkter.
//
// Brukes asynkront (fire-and-forget) fra fil-serve-handlere slik at audit-
// skriving aldri blokkerer respons-flow. Hvis audit-skriving feiler
// (manglende tabell etc.) svelges feilen — vi vil aldri at en audit-
// glitch skal forhindre at brukeren får fila.

import type { Pool } from "pg";
import type { Request } from "express";

export type AuditBackend = "cloudflare_stream" | "r2" | "filesystem" | "unknown";
export type AuditAccessType =
  | "download"
  | "stream_playback"
  | "signed_url_generated"
  | "preview";
export type AuditOutcome =
  | "success"
  | "not_found"
  | "forbidden"
  | "sign_failed"
  | "path_traversal_blocked"
  | "rate_limited";

export interface FileAccessRecord {
  userId: string;
  fileId: string;
  backend: AuditBackend;
  accessType: AuditAccessType;
  outcome: AuditOutcome;
  req?: Request;
  bytesServed?: number;
  metadata?: Record<string, unknown>;
}

const truncate = (s: string | undefined | null, max: number): string | null => {
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
};

const extractIp = (req?: Request): string | null => {
  if (!req) return null;
  // Foretrekker x-forwarded-for (proxy/Render) før req.ip
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) {
    return truncate(xff.split(",")[0].trim(), 64);
  }
  if (Array.isArray(xff) && xff.length > 0) {
    return truncate(String(xff[0]), 64);
  }
  return truncate(req.ip, 64);
};

let tableExists: boolean | null = null;
const checkTable = async (pool: Pool): Promise<boolean> => {
  if (tableExists !== null) return tableExists;
  try {
    await pool.query(`SELECT 1 FROM file_access_audit LIMIT 1`);
    tableExists = true;
  } catch {
    tableExists = false;
  }
  return tableExists;
};

export const recordFileAccess = async (
  pool: Pool,
  rec: FileAccessRecord,
): Promise<void> => {
  if (!(await checkTable(pool))) return;
  try {
    await pool.query(
      `INSERT INTO file_access_audit
         (user_id, file_id, backend, access_type, outcome,
          ip, user_agent, referer, bytes_served, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)`,
      [
        rec.userId,
        rec.fileId,
        rec.backend,
        rec.accessType,
        rec.outcome,
        extractIp(rec.req),
        truncate(rec.req?.headers["user-agent"] as string | undefined, 500),
        truncate(rec.req?.headers["referer"] as string | undefined, 500),
        rec.bytesServed ?? null,
        JSON.stringify(rec.metadata ?? {}),
      ],
    );
  } catch (err) {
    // Stille. Vi vil ikke at audit-svikt skal blokkere fil-serving.
    console.warn("[file-access-audit] insert failed:", err);
  }
};

export const queryFileAccessAudit = async (
  pool: Pool,
  filter: {
    userId?: string;
    fileId?: string;
    outcomeOnly?: AuditOutcome[];
    sinceHours?: number;
    limit?: number;
  } = {},
): Promise<any[]> => {
  if (!(await checkTable(pool))) return [];
  const where: string[] = ["1=1"];
  const params: any[] = [];
  let i = 1;
  if (filter.userId) {
    where.push(`user_id = $${i++}`);
    params.push(filter.userId);
  }
  if (filter.fileId) {
    where.push(`file_id = $${i++}`);
    params.push(filter.fileId);
  }
  if (filter.outcomeOnly && filter.outcomeOnly.length > 0) {
    where.push(`outcome = ANY($${i++}::text[])`);
    params.push(filter.outcomeOnly);
  }
  if (filter.sinceHours && filter.sinceHours > 0) {
    where.push(`created_at > NOW() - INTERVAL '${Math.floor(filter.sinceHours)} hours'`);
  }
  const limit = Math.min(1000, Math.max(1, filter.limit ?? 100));
  const r = await pool.query(
    `SELECT id, user_id, file_id, backend, access_type, outcome,
            ip, user_agent, referer, bytes_served, metadata, created_at
       FROM file_access_audit
      WHERE ${where.join(" AND ")}
      ORDER BY created_at DESC
      LIMIT ${limit}`,
    params,
  );
  return r.rows;
};
