/**
 * admin-gdpr-legal-routes.ts
 *
 * GDPR / juridisk: hent + oppdater privacy-policy + terms-conditions.
 * Lagrer som key-value i admin-styrt `legal_documents`-tabell (defensiv:
 * tabellen opprettes on-demand). Returnerer tom default når den mangler.
 *
 * Endpoints:
 *   GET /api/admin/legal-documents/privacy-policy
 *   PUT /api/admin/legal-documents/privacy-policy
 *   GET /api/admin/legal-documents/terms-conditions
 *   PUT /api/admin/legal-documents/terms-conditions
 *
 * Alle krever requireAdminSession.
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

const DOCUMENT_SLUGS = ["privacy-policy", "terms-conditions"] as const;
type DocumentSlug = (typeof DOCUMENT_SLUGS)[number];

async function ensureLegalDocumentsTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS legal_documents (
      slug TEXT PRIMARY KEY,
      content TEXT NOT NULL DEFAULT '',
      version TEXT NOT NULL DEFAULT '1.0',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_by TEXT
    )
  `);
}

async function readLegalDocument(
  pool: Pool,
  slug: DocumentSlug,
): Promise<{ content: string; version: string; updatedAt: string | null }> {
  try {
    await ensureLegalDocumentsTable(pool);
    const r = await pool.query<{
      content: string;
      version: string;
      updated_at: string;
    }>(
      `SELECT content, version, updated_at
         FROM legal_documents
        WHERE slug = $1
        LIMIT 1`,
      [slug],
    );
    if (r.rows.length === 0) {
      return { content: "", version: "1.0", updatedAt: null };
    }
    const row = r.rows[0];
    return {
      content: row.content ?? "",
      version: row.version ?? "1.0",
      updatedAt: row.updated_at ?? null,
    };
  } catch (err) {
    console.warn("[admin-gdpr-legal] read failed, returning defaults:", err);
    return { content: "", version: "1.0", updatedAt: null };
  }
}

async function writeLegalDocument(
  pool: Pool,
  slug: DocumentSlug,
  content: string,
  updatedBy: string | null,
): Promise<void> {
  await ensureLegalDocumentsTable(pool);
  await pool.query(
    `INSERT INTO legal_documents (slug, content, version, updated_at, updated_by)
       VALUES ($1, $2, '1.0', NOW(), $3)
     ON CONFLICT (slug)
     DO UPDATE SET
       content = EXCLUDED.content,
       updated_at = NOW(),
       updated_by = EXCLUDED.updated_by`,
    [slug, content, updatedBy],
  );
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
        res.json(doc);
      } catch (err) {
        console.error(`[admin-gdpr-legal] GET ${slug} failed:`, err);
        res.status(500).json({ error: `legal_${slug.replace("-", "_")}_failed` });
      }
    });

    app.put(`/api/admin/legal-documents/${slug}`, async (req, res) => {
      try {
        const session = requireAdminSession(req, res);
        if (!session) return;
        const body = (req.body ?? {}) as { content?: string };
        if (typeof body.content !== "string") {
          return res.status(400).json({ error: "content_required" });
        }
        await writeLegalDocument(
          pool,
          slug,
          body.content,
          session?.email ?? session?.userId ?? null,
        );
        res.json({ success: true });
      } catch (err) {
        console.error(`[admin-gdpr-legal] PUT ${slug} failed:`, err);
        res.status(500).json({ error: `legal_${slug.replace("-", "_")}_update_failed` });
      }
    });
  }
}
