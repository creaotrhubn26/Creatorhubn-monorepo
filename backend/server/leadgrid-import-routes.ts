/**
 * leadgrid-import-routes.ts
 *
 * CSV/Excel-import for Leadgrid (mig 328). Dekker en av to flows på
 * Leadgrid one-pager seksjon 1 "DISCOVER & IMPORT LEADS":
 *
 *   1. CSV/Excel-import — fotograf eller selger laster opp en fil
 *      eksportert fra Pipedrive/HubSpot/Excel-regneark.
 *
 *        POST /api/leadgrid/import/csv/preview
 *          multipart/form-data, file=<CSV|XLSX> (≤10MB)
 *          → { file_token, columns, rows (first 20), total_rows }
 *
 *        POST /api/leadgrid/import/csv/commit
 *          body: {
 *            file_token,
 *            mapping: { name: 'col', email: 'col', phone: 'col', ... },
 *            dedupe_strategy: 'email' | 'phone' | 'name+city' | 'none'
 *          }
 *          → { imported, skipped_duplicates, errors, batch_id }
 *
 * URL-Research-flyten lever i `leadgrid-url-research-routes.ts` —
 * bruker hele Role Room Agents research-stack (Brreg + website +
 * Google Places + Claude synthesis) i stedet for one-shot HTML-
 * skraping, og oppretter draft-lead i samme call slik at lokasjons-
 * konfidens kan vises i preview før commit.
 *
 * Auth: requireAuth via lead-map-rbac-helper. Permission-keys:
 *   - leads.import_csv
 *   - leads.import_admin (for rollback — fremtidig)
 *
 * Worker pattern: følger leadgrid-momentum-routes.ts mht. session-
 * resolution og org-id-resolve.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import crypto from "crypto";
import multer from "multer";
import * as Papa from "papaparse";
import * as XLSX from "xlsx";

import { requireLeadMapPermission } from "./lead-map-rbac-helper.js";

const MAX_IMPORT_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_PREVIEW_ROWS = 20;

const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMPORT_BYTES },
});

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

function getSession(
  req: Request,
  activeSessions: Map<string, SessionData>,
): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const s = activeSessions.get(auth.slice(7));
    if (s) return s;
  }
  // Cookie/session-fallback for web (matches lead-map-session-helper logic)
  const cookieSid = (req as Request & { session?: { userId?: string; email?: string; role?: string } }).session;
  if (cookieSid?.userId) {
    return { userId: cookieSid.userId, email: cookieSid.email, role: cookieSid.role };
  }
  return null;
}

async function resolveOrgId(
  req: Request,
  pool: Pool,
  userId: string,
): Promise<string | null> {
  const explicit =
    (req.query?.organization_id
      ?? (req.body as { organization_id?: string } | undefined)?.organization_id) as
      | string
      | undefined;
  if (typeof explicit === "string" && explicit.length > 0) return explicit;
  const r = await pool.query<{ organization_id: string }>(
    `SELECT organization_id::text FROM organization_members
      WHERE user_id = $1 ORDER BY joined_at ASC LIMIT 1`,
    [userId],
  );
  return r.rows[0]?.organization_id ?? null;
}

// =====================================================================
// File-token cache: server holder oppe parsed CSV/XLSX i 15 min mellom
// preview og commit. Lite memory-footprint (typisk under 1 MB per fil).
// =====================================================================

interface ParsedFile {
  columns: string[];
  rows: Record<string, string>[];
  ownerUserId: string;
  fileName: string;
  expiresAt: number;
}

const fileCache = new Map<string, ParsedFile>();

function cacheFile(parsed: Omit<ParsedFile, "expiresAt">): string {
  const token = crypto.randomBytes(18).toString("base64url");
  fileCache.set(token, {
    ...parsed,
    expiresAt: Date.now() + 15 * 60 * 1000,
  });
  return token;
}

function readCachedFile(token: string, userId: string): ParsedFile | null {
  const f = fileCache.get(token);
  if (!f) return null;
  if (f.expiresAt < Date.now()) {
    fileCache.delete(token);
    return null;
  }
  if (f.ownerUserId !== userId) return null;
  return f;
}

// Lett opprydning: kjør hvert 5. minutt for å unngå minnelekkasje.
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of fileCache.entries()) {
    if (v.expiresAt < now) fileCache.delete(k);
  }
}, 5 * 60 * 1000).unref?.();

// =====================================================================
// CSV / XLSX parsing
// =====================================================================

export interface ParsedSpreadsheet {
  columns: string[];
  rows: Record<string, string>[];
}

/**
 * Parse en CSV-buffer eller XLSX-buffer til kolonner + rader.
 * Headers normaliseres ikke (vi viser dem som de er i column-mapping-UI).
 */
export function parseSpreadsheetBuffer(
  buf: Buffer,
  fileName: string,
): ParsedSpreadsheet {
  const lower = fileName.toLowerCase();
  const isXlsx =
    lower.endsWith(".xlsx") ||
    lower.endsWith(".xls") ||
    lower.endsWith(".xlsm");

  if (isXlsx) {
    const wb = XLSX.read(buf, { type: "buffer" });
    const firstSheetName = wb.SheetNames[0];
    if (!firstSheetName) return { columns: [], rows: [] };
    const sheet = wb.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
      raw: false,
    });
    if (rows.length === 0) return { columns: [], rows: [] };
    const columns = Object.keys(rows[0]);
    const stringRows = rows.map((r) => {
      const out: Record<string, string> = {};
      for (const c of columns) out[c] = String(r[c] ?? "").trim();
      return out;
    });
    return { columns, rows: stringRows };
  }

  // CSV — papaparse handles BOM, quotes, embedded newlines.
  const text = buf.toString("utf-8");
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  const rows = result.data
    .map((r) => {
      const out: Record<string, string> = {};
      for (const k of Object.keys(r)) {
        out[k] = String(r[k] ?? "").trim();
      }
      return out;
    })
    .filter((r) => Object.values(r).some((v) => v.length > 0));
  const columns = result.meta.fields ?? (rows[0] ? Object.keys(rows[0]) : []);
  return { columns, rows };
}

// =====================================================================
// Dedup
// =====================================================================

export type DedupeStrategy = "email" | "phone" | "name+city" | "none";

function normalizeEmail(s?: string | null): string | null {
  if (!s) return null;
  const v = s.trim().toLowerCase();
  return v.length > 0 ? v : null;
}

function normalizePhone(s?: string | null): string | null {
  if (!s) return null;
  const digits = s.replace(/[^\d+]/g, "");
  return digits.length > 0 ? digits : null;
}

function normalizeName(s?: string | null): string | null {
  if (!s) return null;
  const v = s.trim().toLowerCase().replace(/\s+/g, " ");
  return v.length > 0 ? v : null;
}

interface MappedLead {
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  address: string | null;
  postal_code: string | null;
  company: string | null;
  website_url: string | null;
  notes: string | null;
  industry: string | null;
  country: string | null;
  linkedin_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  employee_count_estimate: number | null;
  lead_quality_score: number | null;
  raw: Record<string, unknown>;
}

/**
 * Sjekk om en lead er en duplikat innenfor org/owner-scopet.
 * Returnerer eksisterende lead-ID hvis duplikat funnet, null ellers.
 */
export async function findDuplicate(
  pool: Pool,
  opts: {
    ownerUserId: string;
    organizationId: string | null;
    strategy: DedupeStrategy;
    lead: Pick<MappedLead, "email" | "phone" | "name" | "city">;
  },
): Promise<string | null> {
  if (opts.strategy === "none") return null;

  // Bygg WHERE basert på strategi
  const params: unknown[] = [];
  let where = "";

  if (opts.strategy === "email") {
    const e = normalizeEmail(opts.lead.email);
    if (!e) return null;
    params.push(e);
    where = `lower(email) = $${params.length}`;
  } else if (opts.strategy === "phone") {
    const p = normalizePhone(opts.lead.phone);
    if (!p) return null;
    // Vi sammenligner siste 8 sifre (norsk) for å håndtere
    // landskode-varianter ("+47 123 45 678" vs "12345678").
    const tail = p.slice(-8);
    params.push(`%${tail}`);
    where = `regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') LIKE $${params.length}`;
  } else if (opts.strategy === "name+city") {
    const n = normalizeName(opts.lead.name);
    if (!n) return null;
    params.push(n);
    where = `lower(name) = $${params.length}`;
    const c = normalizeName(opts.lead.city);
    if (c) {
      params.push(c);
      where += ` AND lower(coalesce(city, '')) = $${params.length}`;
    }
  } else {
    return null;
  }

  // Tenant-scope: foretrekk organization_id (denormalisert i mig 320),
  // fall tilbake til owner_user_id for legacy-rader.
  if (opts.organizationId) {
    params.push(opts.organizationId);
    where += ` AND (organization_id = $${params.length}::uuid OR owner_user_id = $${params.length + 1})`;
    params.push(opts.ownerUserId);
  } else {
    params.push(opts.ownerUserId);
    where += ` AND owner_user_id = $${params.length}`;
  }

  const r = await pool.query<{ id: string }>(
    `SELECT id::text FROM crm_customers
       WHERE archived_at IS NULL AND ${where}
       LIMIT 1`,
    params,
  );
  return r.rows[0]?.id ?? null;
}

// =====================================================================
// Mapping
// =====================================================================

export type ColumnMapping = Partial<Record<keyof MappedLead | "raw", string>>;

function pickMapped(
  row: Record<string, string>,
  mapping: ColumnMapping,
  key: keyof MappedLead,
): string | null {
  const colName = mapping[key];
  if (!colName) return null;
  const v = row[colName];
  if (v == null) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

function buildMappedLead(
  row: Record<string, string>,
  mapping: ColumnMapping,
): MappedLead {
  const empNum = pickMapped(row, mapping, "employee_count_estimate");
  const qual = pickMapped(row, mapping, "lead_quality_score");
  return {
    name: pickMapped(row, mapping, "name") ?? "",
    email: pickMapped(row, mapping, "email"),
    phone: pickMapped(row, mapping, "phone"),
    city: pickMapped(row, mapping, "city"),
    address: pickMapped(row, mapping, "address"),
    postal_code: pickMapped(row, mapping, "postal_code"),
    company: pickMapped(row, mapping, "company") ?? pickMapped(row, mapping, "name"),
    website_url: pickMapped(row, mapping, "website_url"),
    notes: pickMapped(row, mapping, "notes"),
    industry: pickMapped(row, mapping, "industry"),
    country: pickMapped(row, mapping, "country"),
    linkedin_url: pickMapped(row, mapping, "linkedin_url"),
    instagram_url: pickMapped(row, mapping, "instagram_url"),
    facebook_url: pickMapped(row, mapping, "facebook_url"),
    employee_count_estimate: empNum && /^\d+$/.test(empNum) ? Number(empNum) : null,
    lead_quality_score: qual && /^\d+$/.test(qual) ? Number(qual) : null,
    raw: row,
  };
}

// =====================================================================
// Insert
// =====================================================================

async function insertLead(
  pool: Pool,
  opts: {
    ownerUserId: string;
    organizationId: string | null;
    importSource: "csv_import";
    importBatchId: string;
    lead: MappedLead;
  },
): Promise<{ ok: true; id: string } | { ok: false; reason: string }> {
  if (!opts.lead.name || opts.lead.name.length === 0) {
    return { ok: false, reason: "missing_name" };
  }
  try {
    const r = await pool.query<{ id: string }>(
      `INSERT INTO crm_customers (
         id, name, phone, email, company, status, source,
         owner_user_id, organization_id,
         address, city, postal_code, website_url,
         lead_status, lead_source,
         import_source, import_batch_id, import_raw_data,
         created_at, updated_at
       ) VALUES (
         gen_random_uuid(), $1, $2, $3, $4, 'lead', $5,
         $6, $7::uuid,
         $8, $9, $10, $11,
         'unvisited', $12,
         $13, $14::uuid, $15::jsonb,
         NOW(), NOW()
       )
       RETURNING id::text`,
      [
        opts.lead.name,
        opts.lead.phone,
        opts.lead.email,
        opts.lead.company ?? opts.lead.name,
        opts.importSource,
        opts.ownerUserId,
        opts.organizationId,
        opts.lead.address,
        opts.lead.city,
        opts.lead.postal_code,
        opts.lead.website_url,
        opts.importSource,
        opts.importSource,
        opts.importBatchId,
        JSON.stringify(opts.lead.raw ?? {}),
      ],
    );
    return { ok: true, id: r.rows[0].id };
  } catch (err) {
    return { ok: false, reason: `insert_failed: ${(err as Error).message}` };
  }
}

// =====================================================================
// Route-registrering
// =====================================================================

export function registerLeadgridImportRoutes(deps: Deps): void {
  const { app, pool, activeSessions } = deps;

  const permCsv = requireLeadMapPermission("leads.import_csv", {
    pool,
    activeSessions,
  });

  // ------------------------------------------------------------------
  // POST /api/leadgrid/import/csv/preview
  // ------------------------------------------------------------------
  app.post(
    "/api/leadgrid/import/csv/preview",
    importUpload.single("file"),
    permCsv,
    async (req: Request, res: Response) => {
      const session = getSession(req, activeSessions);
      if (!session?.userId) {
        return res.status(401).json({ error: "Innlogging kreves" });
      }
      const file = (req as Request & { file?: Express.Multer.File }).file;
      if (!file) {
        return res.status(400).json({ error: "missing_file" });
      }
      try {
        const parsed = parseSpreadsheetBuffer(file.buffer, file.originalname);
        if (parsed.columns.length === 0) {
          return res.status(400).json({ error: "empty_or_invalid_file" });
        }
        const token = cacheFile({
          columns: parsed.columns,
          rows: parsed.rows,
          ownerUserId: session.userId,
          fileName: file.originalname,
        });
        return res.json({
          file_token: token,
          file_name: file.originalname,
          columns: parsed.columns,
          rows: parsed.rows.slice(0, MAX_PREVIEW_ROWS),
          total_rows: parsed.rows.length,
        });
      } catch (err) {
        console.error("[leadgrid-import] preview failed", err);
        return res.status(500).json({
          error: "parse_failed",
          detail: (err as Error).message,
        });
      }
    },
  );

  // ------------------------------------------------------------------
  // POST /api/leadgrid/import/csv/commit
  // ------------------------------------------------------------------
  app.post(
    "/api/leadgrid/import/csv/commit",
    permCsv,
    async (req: Request, res: Response) => {
      const session = getSession(req, activeSessions);
      if (!session?.userId) {
        return res.status(401).json({ error: "Innlogging kreves" });
      }
      const body = req.body as {
        file_token?: string;
        mapping?: ColumnMapping;
        dedupe_strategy?: DedupeStrategy;
      };
      if (!body.file_token || !body.mapping) {
        return res.status(400).json({ error: "missing_file_token_or_mapping" });
      }
      const cached = readCachedFile(body.file_token, session.userId);
      if (!cached) {
        return res.status(404).json({ error: "file_token_expired_or_unknown" });
      }
      if (!body.mapping.name) {
        return res.status(400).json({ error: "mapping_must_include_name" });
      }

      const dedupe: DedupeStrategy = body.dedupe_strategy ?? "email";
      const orgId = await resolveOrgId(req, pool, session.userId);
      const batchId = crypto.randomUUID();

      let imported = 0;
      let skipped = 0;
      const errors: { row: number; error: string }[] = [];

      for (let i = 0; i < cached.rows.length; i++) {
        const row = cached.rows[i];
        const mapped = buildMappedLead(row, body.mapping);
        if (!mapped.name) {
          errors.push({ row: i + 1, error: "missing_name" });
          continue;
        }
        const dupId = await findDuplicate(pool, {
          ownerUserId: session.userId,
          organizationId: orgId,
          strategy: dedupe,
          lead: mapped,
        });
        if (dupId) {
          skipped++;
          continue;
        }
        const ins = await insertLead(pool, {
          ownerUserId: session.userId,
          organizationId: orgId,
          importSource: "csv_import",
          importBatchId: batchId,
          lead: mapped,
        });
        if (ins.ok) {
          imported++;
        } else {
          errors.push({ row: i + 1, error: ins.reason });
        }
      }

      await pool.query(
        `INSERT INTO leadgrid_import_batches (
            id, organization_id, owner_user_id, import_source, file_name,
            total_rows, imported_count, skipped_duplicates, errors_count,
            errors_sample, dedupe_strategy, column_mapping
          ) VALUES (
            $1::uuid, $2::uuid, $3, 'csv_import', $4,
            $5, $6, $7, $8,
            $9::jsonb, $10, $11::jsonb
          )`,
        [
          batchId,
          orgId,
          session.userId,
          cached.fileName,
          cached.rows.length,
          imported,
          skipped,
          errors.length,
          JSON.stringify(errors.slice(0, 10)),
          dedupe,
          JSON.stringify(body.mapping),
        ],
      );

      // Slett cache-token når den er konsumert
      fileCache.delete(body.file_token);

      return res.json({
        batch_id: batchId,
        imported,
        skipped_duplicates: skipped,
        errors: errors.slice(0, 50),
        errors_count: errors.length,
      });
    },
  );

  // ------------------------------------------------------------------
  // GET /api/leadgrid/import/batches — siste 20 batches for innlogget bruker
  // ------------------------------------------------------------------
  app.get(
    "/api/leadgrid/import/batches",
    async (req: Request, res: Response) => {
      const session = getSession(req, activeSessions);
      if (!session?.userId) {
        return res.status(401).json({ error: "Innlogging kreves" });
      }
      try {
        const r = await pool.query(
          `SELECT id::text, organization_id::text, import_source, file_name,
                  total_rows, imported_count, skipped_duplicates, errors_count,
                  dedupe_strategy, created_at
             FROM leadgrid_import_batches
            WHERE owner_user_id = $1
            ORDER BY created_at DESC
            LIMIT 20`,
          [session.userId],
        );
        return res.json({ batches: r.rows });
      } catch (err) {
        return res.status(500).json({
          error: "batches_failed",
          detail: (err as Error).message,
        });
      }
    },
  );
}

// Re-export for tests
export const __test = {
  parseSpreadsheetBuffer,
  findDuplicate,
};
