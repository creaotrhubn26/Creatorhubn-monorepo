/**
 * manual-import-routes.ts
 *
 *   POST /api/integrations/import/preview
 *        Body: { csv: string, mapping?, provider?, filename? }
 *        → PreviewResult (preset-deteksjon, foreslått mapping, sample +
 *          valideringsfeil) — ingenting skrives.
 *
 *   POST /api/integrations/import/commit
 *        Samme body → oppretter import_batch + skriver signaler
 *        (dedup via unique-indeksen; lineage via metadata.importBatchId).
 *
 *   GET  /api/integrations/import/batches → siste batcher (lineage)
 *
 * Admin-gated. Org-scoping obligatorisk (409 uten organisasjon).
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { commitImport, previewImport, type ColumnMapping } from "./manual-import-service.js";
import { resolveOrgIdForUser } from "../leadgrid-org-resolver.js";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
  isAdminEmail: (email: string | undefined) => boolean;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_CSV_BYTES = 2 * 1024 * 1024; // 2 MB

function getSession(req: Request, activeSessions: Map<string, SessionData>): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return activeSessions.get(auth.slice(7).trim()) ?? null;
  return null;
}

export function registerManualImportRoutes({ app, pool, activeSessions, isAdminEmail }: Deps): void {
  async function requireAdminWithOrg(req: Request, res: Response) {
    const session = getSession(req, activeSessions);
    if (!session) { res.status(401).json({ error: "ikke_innlogget" }); return null; }
    if (session.role !== "admin" && !isAdminEmail(session.email)) {
      res.status(403).json({ error: "krever_admin" });
      return null;
    }
    const orgId = await resolveOrgIdForUser(pool, session.userId);
    if (!UUID_PATTERN.test(orgId)) {
      res.status(409).json({ error: "ingen_organisasjon" });
      return null;
    }
    return { session, orgId };
  }

  function readBody(req: Request, res: Response) {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const csv = typeof b.csv === "string" ? b.csv : "";
    if (!csv.trim()) { res.status(400).json({ error: "csv_pakrevd" }); return null; }
    if (Buffer.byteLength(csv, "utf8") > MAX_CSV_BYTES) {
      res.status(413).json({ error: "csv_for_stor", maxBytes: MAX_CSV_BYTES });
      return null;
    }
    return {
      csv,
      mapping: (typeof b.mapping === "object" && b.mapping ? b.mapping : undefined) as ColumnMapping | undefined,
      provider: typeof b.provider === "string" ? b.provider : undefined,
      filename: typeof b.filename === "string" ? b.filename.slice(0, 200) : undefined,
    };
  }

  app.post("/api/integrations/import/preview", async (req, res) => {
    const auth = await requireAdminWithOrg(req, res);
    if (!auth) return;
    const body = readBody(req, res);
    if (!body) return;
    try {
      const preview = previewImport(body.csv, {
        organizationId: auth.orgId,
        workspaceOwnerUserId: auth.session.userId,
        provider: body.provider,
        filename: body.filename,
      }, body.mapping);
      return res.json(preview);
    } catch (err) {
      return res.status(422).json({ error: "preview_failed", detail: String(err).slice(0, 200) });
    }
  });

  app.post("/api/integrations/import/commit", async (req, res) => {
    const auth = await requireAdminWithOrg(req, res);
    if (!auth) return;
    const body = readBody(req, res);
    if (!body) return;
    try {
      const result = await commitImport(pool, body.csv, {
        organizationId: auth.orgId,
        workspaceOwnerUserId: auth.session.userId,
        provider: body.provider,
        filename: body.filename,
      }, body.mapping);
      return res.status(201).json(result);
    } catch (err) {
      const msg = String(err);
      const status = msg.includes("import_empty") ? 422 : 500;
      console.error("[manual-import] commit failed", err);
      return res.status(status).json({ error: "import_failed", detail: msg.slice(0, 200) });
    }
  });

  app.get("/api/integrations/import/batches", async (req, res) => {
    const auth = await requireAdminWithOrg(req, res);
    if (!auth) return;
    try {
      const r = await pool.query(
        `SELECT id::text, provider, filename, preset, row_count, inserted_count,
                skipped_duplicates, rejected_rows, status, created_at::text
           FROM import_batches
          WHERE workspace_owner_user_id = $1
          ORDER BY created_at DESC LIMIT 25`,
        [auth.session.userId],
      );
      return res.json({ batches: r.rows });
    } catch (err) {
      return res.status(500).json({ error: "list_failed" });
    }
  });
}
