/**
 * leadgrid-import-routes.ts
 *
 * Lead-import-pipeline for Leadgrid (mig 328). Dekker to flows som
 * begge eksisterer på Leadgrid one-pager seksjon 1 "DISCOVER & IMPORT
 * LEADS":
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
 *   2. URL-basert lead-extraction — lim inn opptil 20 nettside-URLer
 *      eller SoMe-profiler, Claude Haiku 4.5 ekstraherer firma-data.
 *
 *        POST /api/leadgrid/import/url/scrape
 *          body: { urls: string[] }
 *          → { results: [{ url, lead?, error? }] }
 *
 *        POST /api/leadgrid/import/url/commit
 *          body: { leads: [...] }
 *          → { imported, skipped_duplicates, errors, batch_id }
 *
 * Cost-throttling: 20 URLer / minutt / bruker via leadgrid_import_url_rate.
 * Modell: claude-haiku-4-5-20251001 (cost-effektivt for HTML→JSON).
 *
 * Auth: requireAuth via lead-map-rbac-helper. Permission-keys:
 *   - leads.import_csv
 *   - leads.import_url
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
import * as cheerio from "cheerio";
import Anthropic from "@anthropic-ai/sdk";

import { requireLeadMapPermission } from "./lead-map-rbac-helper.js";

const MAX_IMPORT_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_PREVIEW_ROWS = 20;
const MAX_URLS_PER_BATCH = 20;
const URL_RATE_LIMIT_PER_MINUTE = 20;
const HAIKU_MODEL =
  process.env.LEADGRID_IMPORT_MODEL || "claude-haiku-4-5-20251001";

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
    importSource: "csv_import" | "url_extract";
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
// URL scraping
// =====================================================================

let anthropicClient: Anthropic | null = null;
function getAnthropicClient(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  if (!anthropicClient) anthropicClient = new Anthropic({ apiKey: key });
  return anthropicClient;
}

// Eksportert for unit-testing — funksjonen er ren (input-buffer + url).
export function extractMetaFromHtml(html: string, sourceUrl: string): {
  og_title: string | null;
  og_description: string | null;
  og_image: string | null;
  title: string | null;
  body_text: string;
} {
  const $ = cheerio.load(html);
  const og_title =
    $('meta[property="og:title"]').attr("content")?.trim() ||
    $('meta[name="twitter:title"]').attr("content")?.trim() ||
    null;
  const og_description =
    $('meta[property="og:description"]').attr("content")?.trim() ||
    $('meta[name="description"]').attr("content")?.trim() ||
    null;
  const og_image = $('meta[property="og:image"]').attr("content")?.trim() || null;
  const title = $("title").first().text().trim() || null;

  // Fjern script/style/svg, behold meningsfull tekst
  $("script, style, svg, noscript").remove();
  const body_text = $("body").text().replace(/\s+/g, " ").trim().slice(0, 10_000);

  // Inkluder source-url i body slik at Claude vet hvor det kommer fra.
  const prefix = `URL: ${sourceUrl}\nTITLE: ${title ?? og_title ?? ""}\nMETA: ${og_description ?? ""}\n\n`;
  return {
    og_title,
    og_description,
    og_image,
    title,
    body_text: prefix + body_text.slice(0, 10_000 - prefix.length),
  };
}

const URL_EXTRACT_SYSTEM_PROMPT = `Du ekstraherer struktur fra firma-nettsider (website, LinkedIn company page, Instagram-profil). Returner KUN ett JSON-objekt — ingen markdown, ingen forklaring:

{
  "company_name": string | null,
  "company_description": string | null,
  "industry": string | null,
  "country": string | null,           // 2-bokstav ISO (NO/SE/DK/DE/...)
  "city": string | null,
  "address": string | null,
  "phone": string | null,
  "email": string | null,
  "website": string | null,
  "linkedin_url": string | null,
  "instagram_url": string | null,
  "facebook_url": string | null,
  "employee_count_estimate": number | null,  // 1-99999 eller null
  "lead_quality_score": number | null        // 0-100, basert på hvor mye signal vi har
}

Regler:
- Hvis siden er en LinkedIn company page, ekstraher "Headquarters", "Industry", "Company size", "Website" osv.
- Hvis siden er en Instagram-profil, ekstraher bio, kontakt og link i bio.
- Hvis det er en vanlig nettside, finn kontakt-side-data.
- Hvis et felt ikke kan utledes med rimelig sikkerhet, returner null.
- lead_quality_score = 0-100. 80+ for komplett firma med navn+adresse+telefon+e-post. 30-50 for kun navn+web.
- Behold UTF-8 (æøå).
- Returner KUN ett JSON-objekt.`;

interface ScrapedLead {
  company_name: string | null;
  company_description: string | null;
  industry: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  linkedin_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  employee_count_estimate: number | null;
  lead_quality_score: number | null;
}

export function parseScrapedJson(text: string): ScrapedLead | null {
  // Claude returnerer noen ganger markdown-fence rundt JSON. Strippe det.
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    const obj = JSON.parse(cleaned) as Partial<ScrapedLead>;
    return {
      company_name: obj.company_name ?? null,
      company_description: obj.company_description ?? null,
      industry: obj.industry ?? null,
      country: obj.country ?? null,
      city: obj.city ?? null,
      address: obj.address ?? null,
      phone: obj.phone ?? null,
      email: obj.email ?? null,
      website: obj.website ?? null,
      linkedin_url: obj.linkedin_url ?? null,
      instagram_url: obj.instagram_url ?? null,
      facebook_url: obj.facebook_url ?? null,
      employee_count_estimate: typeof obj.employee_count_estimate === "number" ? obj.employee_count_estimate : null,
      lead_quality_score: typeof obj.lead_quality_score === "number" ? obj.lead_quality_score : null,
    };
  } catch {
    return null;
  }
}

async function scrapeUrl(
  url: string,
): Promise<
  | { ok: true; lead: ScrapedLead; raw: Record<string, unknown> }
  | { ok: false; error: string }
> {
  // Validér URL
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, error: "invalid_url" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: "unsupported_protocol" };
  }

  // Fetch HTML
  let html: string;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15_000);
    const resp = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15 Leadgrid-Importer/1.0",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "nb-NO,nb;q=0.9,no;q=0.8,en;q=0.7",
      },
      signal: ctrl.signal,
      redirect: "follow",
    });
    clearTimeout(t);
    if (!resp.ok) {
      return { ok: false, error: `fetch_failed_${resp.status}` };
    }
    html = await resp.text();
  } catch (err) {
    const msg = (err as Error).message || "unknown";
    return { ok: false, error: `fetch_error: ${msg.slice(0, 120)}` };
  }

  // Parse + ekstraher
  const meta = extractMetaFromHtml(html, url);

  const client = getAnthropicClient();
  if (!client) {
    return { ok: false, error: "anthropic_unavailable" };
  }

  let claudeText: string;
  try {
    const resp = await client.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 800,
      system: URL_EXTRACT_SYSTEM_PROMPT,
      messages: [{ role: "user", content: meta.body_text }],
    });
    const block = resp.content.find((c) => c.type === "text");
    claudeText = block && block.type === "text" ? block.text : "";
  } catch (err) {
    return { ok: false, error: `claude_error: ${(err as Error).message.slice(0, 120)}` };
  }

  const lead = parseScrapedJson(claudeText);
  if (!lead) {
    return { ok: false, error: "claude_parse_failed" };
  }
  return {
    ok: true,
    lead,
    raw: {
      url,
      og_title: meta.og_title,
      og_description: meta.og_description,
      og_image: meta.og_image,
      title: meta.title,
    },
  };
}

export function scrapedLeadToMapped(
  url: string,
  lead: ScrapedLead,
  raw: Record<string, unknown>,
): MappedLead {
  const name = lead.company_name?.trim() || "";
  return {
    name,
    email: lead.email,
    phone: lead.phone,
    city: lead.city,
    address: lead.address,
    postal_code: null,
    company: name,
    website_url: lead.website || url,
    notes: lead.company_description,
    industry: lead.industry,
    country: lead.country,
    linkedin_url: lead.linkedin_url,
    instagram_url: lead.instagram_url,
    facebook_url: lead.facebook_url,
    employee_count_estimate: lead.employee_count_estimate,
    lead_quality_score: lead.lead_quality_score,
    raw: { ...raw, ...lead },
  };
}

// =====================================================================
// Rate-limiting (URL-scrape)
// =====================================================================

async function checkAndIncrementUrlRate(
  pool: Pool,
  userId: string,
  count: number,
): Promise<{ ok: true } | { ok: false; remaining: number }> {
  // Atomic upsert: setter inn ny bucket eller øker count.
  const r = await pool.query<{ url_count: number }>(
    `INSERT INTO leadgrid_import_url_rate (user_id, minute_bucket, url_count)
     VALUES ($1, date_trunc('minute', NOW()), $2)
     ON CONFLICT (user_id, minute_bucket)
       DO UPDATE SET url_count = leadgrid_import_url_rate.url_count + EXCLUDED.url_count
     RETURNING url_count`,
    [userId, count],
  );
  const total = r.rows[0]?.url_count ?? count;
  if (total > URL_RATE_LIMIT_PER_MINUTE) {
    // Roll back tilskuddet vårt så neste forsøk får en korrekt baseline.
    await pool.query(
      `UPDATE leadgrid_import_url_rate
          SET url_count = GREATEST(url_count - $2, 0)
        WHERE user_id = $1
          AND minute_bucket = date_trunc('minute', NOW())`,
      [userId, count],
    );
    return { ok: false, remaining: Math.max(URL_RATE_LIMIT_PER_MINUTE - (total - count), 0) };
  }
  return { ok: true };
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
  const permUrl = requireLeadMapPermission("leads.import_url", {
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
  // POST /api/leadgrid/import/url/scrape
  // ------------------------------------------------------------------
  app.post(
    "/api/leadgrid/import/url/scrape",
    permUrl,
    async (req: Request, res: Response) => {
      const session = getSession(req, activeSessions);
      if (!session?.userId) {
        return res.status(401).json({ error: "Innlogging kreves" });
      }
      const body = req.body as { urls?: string[] };
      const urls = (body.urls ?? [])
        .map((u) => (typeof u === "string" ? u.trim() : ""))
        .filter((u) => u.length > 0);
      if (urls.length === 0) {
        return res.status(400).json({ error: "missing_urls" });
      }
      if (urls.length > MAX_URLS_PER_BATCH) {
        return res.status(400).json({
          error: "too_many_urls",
          max: MAX_URLS_PER_BATCH,
        });
      }

      const rate = await checkAndIncrementUrlRate(pool, session.userId, urls.length);
      if (!rate.ok) {
        return res.status(429).json({
          error: "rate_limited",
          message: `Maks ${URL_RATE_LIMIT_PER_MINUTE} URL-er per minutt per bruker.`,
          retry_after_seconds: 60,
        });
      }

      // Sekvensiell behandling — Claude-kall er ikke parallelliserbare
      // uten å bryte cost-throttling i framtiden.
      const results: Array<{ url: string; lead?: MappedLead; error?: string }> = [];
      for (const url of urls) {
        const scrape = await scrapeUrl(url);
        if (scrape.ok) {
          results.push({
            url,
            lead: scrapedLeadToMapped(url, scrape.lead, scrape.raw),
          });
        } else {
          results.push({ url, error: scrape.error });
        }
      }
      return res.json({ results });
    },
  );

  // ------------------------------------------------------------------
  // POST /api/leadgrid/import/url/commit
  // ------------------------------------------------------------------
  app.post(
    "/api/leadgrid/import/url/commit",
    permUrl,
    async (req: Request, res: Response) => {
      const session = getSession(req, activeSessions);
      if (!session?.userId) {
        return res.status(401).json({ error: "Innlogging kreves" });
      }
      const body = req.body as {
        leads?: Partial<MappedLead>[];
        dedupe_strategy?: DedupeStrategy;
      };
      const leads = (body.leads ?? []).filter(
        (l): l is Partial<MappedLead> & { name: string } =>
          typeof l?.name === "string" && l.name.trim().length > 0,
      );
      if (leads.length === 0) {
        return res.status(400).json({ error: "missing_leads" });
      }

      const dedupe: DedupeStrategy = body.dedupe_strategy ?? "email";
      const orgId = await resolveOrgId(req, pool, session.userId);
      const batchId = crypto.randomUUID();

      let imported = 0;
      let skipped = 0;
      const errors: { index: number; error: string }[] = [];

      for (let i = 0; i < leads.length; i++) {
        const partial = leads[i];
        const mapped: MappedLead = {
          name: partial.name ?? "",
          email: partial.email ?? null,
          phone: partial.phone ?? null,
          city: partial.city ?? null,
          address: partial.address ?? null,
          postal_code: partial.postal_code ?? null,
          company: partial.company ?? partial.name ?? null,
          website_url: partial.website_url ?? null,
          notes: partial.notes ?? null,
          industry: partial.industry ?? null,
          country: partial.country ?? null,
          linkedin_url: partial.linkedin_url ?? null,
          instagram_url: partial.instagram_url ?? null,
          facebook_url: partial.facebook_url ?? null,
          employee_count_estimate: partial.employee_count_estimate ?? null,
          lead_quality_score: partial.lead_quality_score ?? null,
          raw: (partial.raw as Record<string, unknown>) ?? {},
        };
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
          importSource: "url_extract",
          importBatchId: batchId,
          lead: mapped,
        });
        if (ins.ok) imported++;
        else errors.push({ index: i, error: ins.reason });
      }

      await pool.query(
        `INSERT INTO leadgrid_import_batches (
            id, organization_id, owner_user_id, import_source, file_name,
            total_rows, imported_count, skipped_duplicates, errors_count,
            errors_sample, dedupe_strategy
          ) VALUES (
            $1::uuid, $2::uuid, $3, 'url_extract', NULL,
            $4, $5, $6, $7,
            $8::jsonb, $9
          )`,
        [
          batchId,
          orgId,
          session.userId,
          leads.length,
          imported,
          skipped,
          errors.length,
          JSON.stringify(errors.slice(0, 10)),
          dedupe,
        ],
      );

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
  extractMetaFromHtml,
  parseScrapedJson,
  scrapedLeadToMapped,
};
