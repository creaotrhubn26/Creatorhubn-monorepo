/**
 * admin-gdpr-legal-routes.ts
 *
 * GDPR / juridisk: hent + oppdater versjonerte juridiske dokumenter med
 * full revisjons-historikk (audit-trail).
 *
 * Skjema (se migrations/240_legal_documents.sql):
 *   legal_documents             - "head"-rad per document_key
 *   legal_document_revisions    - append-only historikk per versjon
 *
 * Endpoints:
 *   GET  /api/admin/legal-documents/privacy-policy
 *   PUT  /api/admin/legal-documents/privacy-policy
 *   GET  /api/admin/legal-documents/terms-conditions
 *   PUT  /api/admin/legal-documents/terms-conditions
 *   GET  /api/admin/legal-documents/:key/history    (bonus)
 *
 * Alle krever requireAdminSession.
 *
 * PUT bumper versjonen X.Y -> X.(Y+1), INSERT-er revisjon, oppdaterer head.
 */

import type express from "express";
import type { Pool } from "pg";

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface AdminGdprLegalRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireAdminSession: (req: express.Request, res: express.Response) => any;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const DOCUMENT_SLUGS = [
  "privacy-policy",
  "terms-conditions",
  "cookie-policy",
  "dpa",
] as const;
type DocumentSlug = (typeof DOCUMENT_SLUGS)[number];

const isKnownSlug = (s: string): s is DocumentSlug =>
  (DOCUMENT_SLUGS as readonly string[]).includes(s);

/**
 * Bump "X.Y" -> "X.(Y+1)". Hvis input ikke matcher, fall tilbake til "1.1".
 * Behold major manuell (administratorer kan sette content som vil; UI kan
 * senere eksponere "major bump"-knapp om ønskelig).
 */
function bumpVersion(current: string | null | undefined): string {
  if (!current) return "1.1";
  const m = /^(\d+)\.(\d+)$/.exec(current.trim());
  if (!m) return "1.1";
  const major = Number(m[1]);
  const minor = Number(m[2]);
  return `${major}.${minor + 1}`;
}

interface LegalDocumentResponse {
  documentKey: string;
  displayName: string;
  content: string;
  version: string;
  updatedAt: string | null;
  updatedBy: string | null;
}

interface LegalRevisionResponse {
  id: string;
  documentKey: string;
  version: string;
  content: string;
  updatedBy: string | null;
  notes: string | null;
  publishedAt: string | null;
}

async function readLegalDocument(
  pool: Pool,
  slug: DocumentSlug,
): Promise<LegalDocumentResponse | null> {
  const r = await pool.query<{
    document_key: string;
    display_name: string;
    current_content: string;
    current_version: string;
    current_published_at: string | null;
    current_updated_by: string | null;
  }>(
    `SELECT document_key, display_name, current_content,
            current_version, current_published_at, current_updated_by
       FROM legal_documents
      WHERE document_key = $1
      LIMIT 1`,
    [slug],
  );
  if (r.rows.length === 0) return null;
  const row = r.rows[0];
  return {
    documentKey: row.document_key,
    displayName: row.display_name,
    content: row.current_content ?? "",
    version: row.current_version ?? "1.0",
    updatedAt: row.current_published_at ?? null,
    updatedBy: row.current_updated_by ?? null,
  };
}

async function writeLegalDocument(
  pool: Pool,
  slug: DocumentSlug,
  content: string,
  updatedBy: string | null,
  notes: string | null,
): Promise<LegalDocumentResponse> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Lock raden + hent gjeldende versjon for bump.
    const cur = await client.query<{
      current_version: string;
      display_name: string;
    }>(
      `SELECT current_version, display_name
         FROM legal_documents
        WHERE document_key = $1
        FOR UPDATE`,
      [slug],
    );

    let displayName: string;
    let currentVersion: string;

    if (cur.rows.length === 0) {
      // Edge case: head-rad mangler (skal ikke skje pga seed). Opprett.
      displayName = slug;
      currentVersion = "1.0";
      await client.query(
        `INSERT INTO legal_documents (document_key, display_name, current_content, current_version)
         VALUES ($1, $2, '', '1.0')`,
        [slug, displayName],
      );
    } else {
      displayName = cur.rows[0].display_name;
      currentVersion = cur.rows[0].current_version ?? "1.0";
    }

    const nextVersion = bumpVersion(currentVersion);
    const publishedAt = new Date().toISOString();

    // Insert revisjon (audit-trail).
    await client.query(
      `INSERT INTO legal_document_revisions
         (document_key, version, content, updated_by, notes, published_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (document_key, version) DO NOTHING`,
      [slug, nextVersion, content, updatedBy, notes, publishedAt],
    );

    // Oppdater head.
    await client.query(
      `UPDATE legal_documents
          SET current_content = $2,
              current_version = $3,
              current_published_at = $4,
              current_updated_by = $5
        WHERE document_key = $1`,
      [slug, content, nextVersion, publishedAt, updatedBy],
    );

    await client.query("COMMIT");

    return {
      documentKey: slug,
      displayName,
      content,
      version: nextVersion,
      updatedAt: publishedAt,
      updatedBy,
    };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

async function readLegalHistory(
  pool: Pool,
  slug: DocumentSlug,
): Promise<LegalRevisionResponse[]> {
  const r = await pool.query<{
    id: string;
    document_key: string;
    version: string;
    content: string;
    updated_by: string | null;
    notes: string | null;
    published_at: string | null;
  }>(
    `SELECT id, document_key, version, content, updated_by, notes, published_at
       FROM legal_document_revisions
      WHERE document_key = $1
      ORDER BY published_at DESC NULLS LAST, version DESC`,
    [slug],
  );
  return r.rows.map((row) => ({
    id: row.id,
    documentKey: row.document_key,
    version: row.version,
    content: row.content,
    updatedBy: row.updated_by,
    notes: row.notes,
    publishedAt: row.published_at,
  }));
}

export function setupAdminGdprLegalRoutes(
  deps: AdminGdprLegalRoutesDeps,
): void {
  const { app, pool, requireAdminSession } = deps;

  for (const slug of DOCUMENT_SLUGS) {
    app.get(`/api/admin/legal-documents/${slug}`, async (req, res) => {
      try {
        if (!requireAdminSession(req, res)) return;
        const doc = await readLegalDocument(pool, slug);
        if (!doc) {
          return res.status(404).json({ error: "legal_document_not_found" });
        }
        res.json(doc);
      } catch (err) {
        console.error(`[admin-gdpr-legal] GET ${slug} failed:`, err);
        res
          .status(500)
          .json({ error: `legal_${slug.replace(/-/g, "_")}_failed` });
      }
    });

    app.put(`/api/admin/legal-documents/${slug}`, async (req, res) => {
      try {
        const session = requireAdminSession(req, res);
        if (!session) return;
        const body = (req.body ?? {}) as { content?: string; notes?: string };
        if (typeof body.content !== "string") {
          return res.status(400).json({ error: "content_required" });
        }
        const updatedBy =
          (session as { email?: string; userId?: string })?.email ??
          (session as { email?: string; userId?: string })?.userId ??
          null;
        const notes =
          typeof body.notes === "string" && body.notes.trim().length > 0
            ? body.notes.trim()
            : null;
        const doc = await writeLegalDocument(
          pool,
          slug,
          body.content,
          updatedBy,
          notes,
        );
        res.json({ success: true, ...doc });
      } catch (err) {
        console.error(`[admin-gdpr-legal] PUT ${slug} failed:`, err);
        res.status(500).json({
          error: `legal_${slug.replace(/-/g, "_")}_update_failed`,
        });
      }
    });
  }

  // Bonus: historikk-endepunkt per document key.
  app.get("/api/admin/legal-documents/:key/history", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) return;
      const key = String(req.params.key ?? "");
      if (!isKnownSlug(key)) {
        return res.status(400).json({ error: "unknown_document_key" });
      }
      const revisions = await readLegalHistory(pool, key);
      res.json({ documentKey: key, revisions });
    } catch (err) {
      console.error("[admin-gdpr-legal] GET history failed:", err);
      res.status(500).json({ error: "legal_history_failed" });
    }
  });
}
