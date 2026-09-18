import crypto from "node:crypto";
import type { Pool } from "pg";
import type { AdminRoomRoutesDeps } from "./_shared";
import {
  chunkContextText,
  indexAdminDocumentFile,
  rankContextCandidates,
  type ContextCandidate,
} from "./admin-document-context-service";

const MAX_CONTEXT_INPUT = 4_000;
const VALID_INSERT_MODES = new Set(["text", "bullets", "source_card"]);

function textValue(value: unknown, max = MAX_CONTEXT_INPUT): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim();
  return clean ? clean.slice(0, max) : null;
}

function integerValue(value: unknown, min: number, max: number): number | null {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(number)) return null;
  return Math.max(min, Math.min(max, number));
}

async function ownedDocument(pool: Pool, documentId: string, userId: string) {
  const result = await pool.query(
    `SELECT id, title, summary, content, document_type, product_key, tags, updated_at
       FROM admin_documents
      WHERE id::text = $1 AND user_id::text = $2 AND deleted_at IS NULL
      LIMIT 1`,
    [documentId, userId],
  );
  return result.rows[0] ?? null;
}

function sectionAtCursor(content: string, cursor: number): string | null {
  const before = content.slice(0, Math.max(0, Math.min(cursor, content.length)));
  const headings = [...before.matchAll(/^#{1,4}\s+(.+)$/gmu)];
  return headings.at(-1)?.[1]?.replace(/\*\*/gu, "").trim().slice(0, 255) ?? null;
}

function contextWindow(content: string, cursor: number): string {
  const safeCursor = Math.max(0, Math.min(cursor, content.length));
  return content.slice(Math.max(0, safeCursor - 1_500), Math.min(content.length, safeCursor + 1_500));
}

async function contextLibrary(pool: Pool, documentId: string, userId: string) {
  const result = await pool.query(
     `WITH connections AS (
       SELECT id, source_document_id, source_file_id
         FROM admin_document_context_sources
        WHERE target_document_id::text = $1 AND user_id::text = $2 AND enabled = TRUE
     ), project_preferences AS (
       SELECT id, project_file_id, enabled
         FROM admin_document_project_file_preferences
        WHERE document_id::text = $1 AND user_id::text = $2
     ), source_rows AS (
       SELECT 'workspace_document'::text AS source_type,
              d.id::text AS source_id,
              d.id::text AS source_document_id,
              NULL::text AS source_file_id,
              NULL::text AS source_project_file_id,
              NULL::text AS project_id,
              NULL::text AS project_title,
              'workspace'::text AS scope,
              d.title::text AS title,
              COALESCE(NULLIF(d.summary, ''), 'Workspace-dokument')::text AS subtitle,
              NULL::text AS mime_type,
              'ready'::text AS extraction_status,
              NULL::text AS extraction_error,
              TRUE AS context_enabled,
              char_length(d.content)::int AS character_count,
              d.product_key::text AS product_key,
              d.updated_at,
              c.id::text AS connection_id,
              (c.id IS NOT NULL) AS connected,
              FALSE AS intrinsic
         FROM admin_documents d
         LEFT JOIN connections c ON c.source_document_id = d.id
        WHERE d.user_id::text = $2
          AND d.deleted_at IS NULL
          AND d.id::text <> $1
          AND char_length(trim(d.content)) > 0
       UNION ALL
       SELECT 'file'::text AS source_type,
              f.id::text AS source_id,
              f.document_id::text AS source_document_id,
              f.id::text AS source_file_id,
              NULL::text AS source_project_file_id,
              NULL::text AS project_id,
              NULL::text AS project_title,
              'document'::text AS scope,
              f.file_name::text AS title,
              d.title::text AS subtitle,
              f.mime_type::text,
              f.extraction_status::text,
              f.extraction_error::text,
              f.context_enabled,
              COALESCE((f.extraction_metadata->>'characterCount')::int, 0) AS character_count,
              d.product_key::text AS product_key,
              COALESCE(f.extracted_at, f.created_at) AS updated_at,
              c.id::text AS connection_id,
              (f.document_id::text = $1 OR c.id IS NOT NULL) AS connected,
              (f.document_id::text = $1) AS intrinsic
         FROM admin_document_files f
         JOIN admin_documents d
           ON d.id = f.document_id AND d.user_id = f.user_id AND d.deleted_at IS NULL
         LEFT JOIN connections c ON c.source_file_id = f.id
        WHERE f.user_id::text = $2
       UNION ALL
       SELECT 'project_file'::text AS source_type,
              f.id::text AS source_id,
              NULL::text AS source_document_id,
              NULL::text AS source_file_id,
              f.id::text AS source_project_file_id,
              p.id::text AS project_id,
              p.title::text AS project_title,
              'project'::text AS scope,
              f.file_name::text AS title,
              concat('Prosjekt: ', p.title)::text AS subtitle,
              f.mime_type::text,
              f.extraction_status::text,
              f.extraction_error::text,
              f.context_enabled,
              COALESCE((f.extraction_metadata->>'characterCount')::int, 0) AS character_count,
              p.product_key::text AS product_key,
              COALESCE(f.extracted_at, f.updated_at) AS updated_at,
              pref.id::text AS connection_id,
              (f.context_enabled = TRUE
                AND f.extraction_status = 'ready'
                AND COALESCE(pref.enabled, TRUE)) AS connected,
              FALSE AS intrinsic
         FROM admin_document_links dl
         JOIN admin_workspace_projects p
           ON p.id::text = dl.entity_id AND p.user_id = dl.user_id
         JOIN admin_workspace_project_files f
           ON f.project_id = p.id AND f.user_id = p.user_id
         LEFT JOIN project_preferences pref ON pref.project_file_id = f.id
        WHERE dl.document_id::text = $1
          AND dl.user_id::text = $2
          AND dl.entity_type = 'workspace_project'
     )
     SELECT * FROM source_rows
      ORDER BY connected DESC, updated_at DESC, title
      LIMIT 500`,
    [documentId, userId],
  );
  return result.rows;
}

export function setupAdminDocumentContextRoutes(deps: AdminRoomRoutesDeps): void {
  const { app, pool, requireAdminRoomAccess, logAdminActivity } = deps;

  app.get("/api/admin-room/workspace/documents/:id/context/library", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const document = await ownedDocument(pool, req.params.id, session.userId);
      if (!document) {
        res.status(404).json({ error: "Dokumentet finnes ikke" });
        return;
      }
      res.json({ items: await contextLibrary(pool, req.params.id, session.userId) });
    } catch (error) {
      console.error("[admin document context] library error", error);
      res.status(500).json({ error: "Kunne ikke hente kildebiblioteket" });
    }
  });

  app.post("/api/admin-room/workspace/documents/:id/context/sources", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const sourceType = req.body?.sourceType;
    const sourceId = textValue(req.body?.sourceId, 100);
    if ((sourceType !== "workspace_document" && sourceType !== "file") || !sourceId) {
      res.status(400).json({ error: "Velg en gyldig dokument- eller filkilde" });
      return;
    }
    try {
      const target = await ownedDocument(pool, req.params.id, session.userId);
      if (!target) {
        res.status(404).json({ error: "Dokumentet finnes ikke" });
        return;
      }
      if (sourceType === "workspace_document") {
        if (sourceId === req.params.id) {
          res.status(400).json({ error: "Dokumentet kan ikke være sin egen kilde" });
          return;
        }
        const source = await pool.query(
          `SELECT id, title FROM admin_documents
            WHERE id::text = $1 AND user_id::text = $2 AND deleted_at IS NULL
              AND char_length(trim(content)) > 0`,
          [sourceId, session.userId],
        );
        if (!source.rows.length) {
          res.status(404).json({ error: "Kildedokumentet finnes ikke eller er tomt" });
          return;
        }
        const existing = await pool.query(
          `SELECT id FROM admin_document_context_sources
            WHERE target_document_id::text = $1 AND source_document_id::text = $2
              AND user_id::text = $3`,
          [req.params.id, sourceId, session.userId],
        );
        const result = existing.rows.length
          ? existing
          : await pool.query(
              `INSERT INTO admin_document_context_sources
                 (target_document_id, user_id, source_document_id)
               VALUES ($1, $2, $3)
               RETURNING id`,
              [req.params.id, session.userId, sourceId],
            );
        res.status(existing.rows.length ? 200 : 201).json({
          item: { id: result.rows[0].id, sourceType, sourceId },
        });
        return;
      }

      const source = await pool.query(
        `SELECT f.id, f.file_name, f.document_id::text AS document_id
           FROM admin_document_files f
           JOIN admin_documents d
             ON d.id = f.document_id AND d.user_id = f.user_id AND d.deleted_at IS NULL
          WHERE f.id::text = $1 AND f.user_id::text = $2
            AND f.source_kind = 'upload' AND f.extraction_status = 'ready'
            AND f.context_enabled = TRUE`,
        [sourceId, session.userId],
      );
      if (!source.rows.length) {
        res.status(404).json({ error: "Filen er ikke ferdig indeksert eller er utilgjengelig" });
        return;
      }
      if (source.rows[0].document_id === req.params.id) {
        res.json({ item: { id: null, sourceType, sourceId, intrinsic: true } });
        return;
      }
      const existing = await pool.query(
        `SELECT id FROM admin_document_context_sources
          WHERE target_document_id::text = $1 AND source_file_id::text = $2
            AND user_id::text = $3`,
        [req.params.id, sourceId, session.userId],
      );
      const result = existing.rows.length
        ? existing
        : await pool.query(
            `INSERT INTO admin_document_context_sources
               (target_document_id, user_id, source_file_id)
             VALUES ($1, $2, $3)
             RETURNING id`,
            [req.params.id, session.userId, sourceId],
          );
      res.status(existing.rows.length ? 200 : 201).json({
        item: { id: result.rows[0].id, sourceType, sourceId },
      });
    } catch (error) {
      console.error("[admin document context] add source error", error);
      res.status(500).json({ error: "Kunne ikke koble kontekstkilden" });
    }
  });

  app.delete("/api/admin-room/workspace/documents/:id/context/sources/:sourceId", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const result = await pool.query(
        `DELETE FROM admin_document_context_sources
          WHERE id::text = $1 AND target_document_id::text = $2 AND user_id::text = $3
          RETURNING id`,
        [req.params.sourceId, req.params.id, session.userId],
      );
      if (!result.rows.length) {
        res.status(404).json({ error: "Kildekoblingen finnes ikke" });
        return;
      }
      res.json({ deleted: true });
    } catch (error) {
      console.error("[admin document context] remove source error", error);
      res.status(500).json({ error: "Kunne ikke fjerne kontekstkilden" });
    }
  });

  app.patch("/api/admin-room/workspace/documents/:id/context/project-files/:fileId", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    if (typeof req.body?.enabled !== "boolean") {
      res.status(400).json({ error: "enabled må være true eller false" });
      return;
    }
    try {
      const source = await pool.query(
        `SELECT f.id::text, f.file_name
           FROM admin_workspace_project_files f
          WHERE f.id::text = $1 AND f.user_id::text = $3
            AND EXISTS (
              SELECT 1
                FROM admin_document_links dl
               WHERE dl.document_id::text = $2
                 AND dl.user_id::text = $3
                 AND dl.entity_type = 'workspace_project'
                 AND dl.entity_id = f.project_id::text
            )`,
        [req.params.fileId, req.params.id, session.userId],
      );
      if (!source.rows.length) {
        res.status(404).json({ error: "Prosjektfilen er ikke tilgjengelig for dokumentet" });
        return;
      }
      const result = await pool.query(
        `INSERT INTO admin_document_project_file_preferences
           (document_id, project_file_id, user_id, enabled)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (document_id, project_file_id)
         DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = NOW()
         RETURNING id::text, enabled`,
        [req.params.id, req.params.fileId, session.userId, req.body.enabled],
      );
      await logAdminActivity({
        userId: session.userId,
        entityType: "workspace_document",
        entityId: req.params.id,
        action: req.body.enabled ? "project_source_enabled" : "project_source_disabled",
        summary: `${req.body.enabled ? "Aktiverte" : "Deaktiverte"} prosjektkilden «${source.rows[0].file_name}»`,
        details: { projectFileId: req.params.fileId },
      });
      res.json({ item: result.rows[0] });
    } catch (error) {
      console.error("[admin document context] project file preference error", error);
      res.status(500).json({ error: "Kunne ikke endre prosjektkilden for dokumentet" });
    }
  });

  app.patch("/api/admin-room/workspace/documents/:id/files/:fileId/context", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    if (typeof req.body?.enabled !== "boolean") {
      res.status(400).json({ error: "enabled må være true eller false" });
      return;
    }
    try {
      const result = await pool.query(
        `UPDATE admin_document_files
            SET context_enabled = $4
          WHERE id::text = $1 AND document_id::text = $2 AND user_id::text = $3
            AND source_kind = 'upload'
          RETURNING id, context_enabled`,
        [req.params.fileId, req.params.id, session.userId, req.body.enabled],
      );
      if (!result.rows.length) {
        res.status(404).json({ error: "Vedlegget finnes ikke" });
        return;
      }
      res.json({ item: result.rows[0] });
    } catch (error) {
      console.error("[admin document context] toggle file error", error);
      res.status(500).json({ error: "Kunne ikke endre kildeinnstillingen" });
    }
  });

  app.post("/api/admin-room/workspace/documents/:id/files/:fileId/reindex", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const result = await pool.query(
        `SELECT id::text, document_id::text, file_name, mime_type, file_data
           FROM admin_document_files
          WHERE id::text = $1 AND document_id::text = $2 AND user_id::text = $3
            AND source_kind = 'upload'
          LIMIT 1`,
        [req.params.fileId, req.params.id, session.userId],
      );
      if (!result.rows.length || !result.rows[0].file_data) {
        res.status(404).json({ error: "Opplastet vedlegg finnes ikke" });
        return;
      }
      const file = result.rows[0];
      const indexed = await indexAdminDocumentFile({
        pool,
        fileId: file.id,
        documentId: file.document_id,
        userId: session.userId,
        fileName: file.file_name,
        mimeType: file.mime_type,
        buffer: file.file_data,
      });
      res.json({ item: indexed });
    } catch (error) {
      console.error("[admin document context] reindex error", error);
      res.status(500).json({ error: "Kunne ikke indeksere vedlegget" });
    }
  });

  app.get("/api/admin-room/workspace/documents/:id/context/preview/:sourceType/:sourceId", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const target = await ownedDocument(pool, req.params.id, session.userId);
      if (!target) {
        res.status(404).json({ error: "Dokumentet finnes ikke" });
        return;
      }
      if (req.params.sourceType === "workspace_document") {
        const result = await pool.query(
          `SELECT id::text, title, content
             FROM admin_documents
            WHERE id::text = $1 AND user_id::text = $2 AND deleted_at IS NULL`,
          [req.params.sourceId, session.userId],
        );
        if (!result.rows.length) {
          res.status(404).json({ error: "Kildedokumentet finnes ikke" });
          return;
        }
        const source = result.rows[0];
        res.json({
          item: {
            title: source.title,
            sourceType: "workspace_document",
            segments: chunkContextText(source.content).slice(0, 30),
          },
        });
        return;
      }
      if (req.params.sourceType === "project_file") {
        const result = await pool.query(
          `SELECT f.file_name AS title, p.title AS project_title,
                  c.chunk_index, c.section_label, c.page_number, c.content
             FROM admin_workspace_project_files f
             JOIN admin_workspace_projects p
               ON p.id = f.project_id AND p.user_id = f.user_id
             LEFT JOIN admin_workspace_project_file_chunks c
               ON c.project_file_id = f.id AND c.user_id = f.user_id
            WHERE f.id::text = $1 AND f.user_id::text = $2
              AND EXISTS (
                SELECT 1 FROM admin_document_links dl
                 WHERE dl.document_id::text = $3
                   AND dl.user_id::text = $2
                   AND dl.entity_type = 'workspace_project'
                   AND dl.entity_id = f.project_id::text
              )
            ORDER BY c.chunk_index
            LIMIT 30`,
          [req.params.sourceId, session.userId, req.params.id],
        );
        if (!result.rows.length) {
          res.status(404).json({ error: "Prosjektfilen er ikke tilgjengelig for dokumentet" });
          return;
        }
        res.json({
          item: {
            title: result.rows[0].title,
            originDocumentTitle: `Prosjekt: ${result.rows[0].project_title}`,
            sourceType: "project_file",
            segments: result.rows.filter((row) => row.content),
          },
        });
        return;
      }
      if (req.params.sourceType !== "file") {
        res.status(400).json({ error: "Ugyldig kildetype" });
        return;
      }
      const result = await pool.query(
        `SELECT f.file_name AS title, d.title AS origin_document_title,
                c.chunk_index, c.section_label, c.page_number, c.content
           FROM admin_document_files f
           JOIN admin_documents d ON d.id = f.document_id AND d.user_id = f.user_id
           LEFT JOIN admin_document_context_chunks c
             ON c.file_id = f.id AND c.user_id = f.user_id
          WHERE f.id::text = $1 AND f.user_id::text = $2
          ORDER BY c.chunk_index
          LIMIT 30`,
        [req.params.sourceId, session.userId],
      );
      if (!result.rows.length) {
        res.status(404).json({ error: "Filkilden finnes ikke" });
        return;
      }
      res.json({
        item: {
          title: result.rows[0].title,
          originDocumentTitle: result.rows[0].origin_document_title,
          sourceType: "file",
          segments: result.rows.filter((row) => row.content),
        },
      });
    } catch (error) {
      console.error("[admin document context] preview error", error);
      res.status(500).json({ error: "Kunne ikke vise kildeinnholdet" });
    }
  });

  app.post("/api/admin-room/workspace/documents/:id/context/suggestions", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const document = await ownedDocument(pool, req.params.id, session.userId);
      if (!document) {
        res.status(404).json({ error: "Dokumentet finnes ikke" });
        return;
      }
      const cursor = integerValue(req.body?.cursorPosition, 0, document.content.length) ?? 0;
      const clientNearby = textValue(req.body?.nearbyText);
      const selectedText = textValue(req.body?.selectedText, 2_000);
      const clientHeading = textValue(req.body?.sectionHeading, 255);
      const limit = integerValue(req.body?.limit, 1, 12) ?? 8;
      const sectionHeading = clientHeading ?? sectionAtCursor(document.content, cursor);
      const nearbyText = clientNearby ?? contextWindow(document.content, cursor);

      const [fileResult, sourceDocumentResult, projectFileResult] = await Promise.all([
        pool.query(
          `SELECT c.document_id::text AS source_document_id,
                  c.file_id::text AS source_file_id,
                  f.file_name AS source_title,
                  d.title AS origin_document_title,
                  c.section_label, c.page_number, c.chunk_index, c.content
             FROM admin_document_context_chunks c
             JOIN admin_document_files f
               ON f.id = c.file_id AND f.user_id = c.user_id
             JOIN admin_documents d
               ON d.id = c.document_id AND d.user_id = c.user_id AND d.deleted_at IS NULL
            WHERE c.user_id::text = $2
              AND f.context_enabled = TRUE
              AND f.extraction_status = 'ready'
              AND (
                c.document_id::text = $1
                OR EXISTS (
                  SELECT 1 FROM admin_document_context_sources s
                   WHERE s.target_document_id::text = $1
                     AND s.user_id::text = $2
                     AND s.source_file_id = c.file_id
                     AND s.enabled = TRUE
                )
              )
            ORDER BY c.file_id, c.chunk_index
            LIMIT 2000`,
          [req.params.id, session.userId],
        ),
        pool.query(
          `SELECT d.id::text, d.title, d.content
             FROM admin_document_context_sources s
             JOIN admin_documents d
               ON d.id = s.source_document_id AND d.user_id = s.user_id
            WHERE s.target_document_id::text = $1
              AND s.user_id::text = $2
              AND s.enabled = TRUE
              AND d.deleted_at IS NULL
              AND char_length(trim(d.content)) > 0
            ORDER BY d.updated_at DESC
            LIMIT 100`,
          [req.params.id, session.userId],
        ),
        pool.query(
          `SELECT c.project_id::text,
                  c.project_file_id::text AS source_project_file_id,
                  f.file_name AS source_title,
                  concat('Prosjekt: ', p.title)::text AS origin_document_title,
                  c.section_label, c.page_number, c.chunk_index, c.content
             FROM admin_workspace_project_file_chunks c
             JOIN admin_workspace_project_files f
               ON f.id = c.project_file_id AND f.user_id = c.user_id
             JOIN admin_workspace_projects p
               ON p.id = c.project_id AND p.user_id = c.user_id
             JOIN admin_document_links dl
               ON dl.user_id = c.user_id
              AND dl.entity_type = 'workspace_project'
              AND dl.entity_id = c.project_id::text
              AND dl.document_id::text = $1
             LEFT JOIN admin_document_project_file_preferences pref
               ON pref.document_id = dl.document_id
              AND pref.project_file_id = f.id
              AND pref.user_id = c.user_id
            WHERE c.user_id::text = $2
              AND f.context_enabled = TRUE
              AND f.extraction_status = 'ready'
              AND COALESCE(pref.enabled, TRUE) = TRUE
            ORDER BY c.project_file_id, c.chunk_index
            LIMIT 2000`,
          [req.params.id, session.userId],
        ),
      ]);

      const candidates: ContextCandidate[] = fileResult.rows.map((row) => ({
        sourceType: "file",
        sourceDocumentId: row.source_document_id,
        sourceFileId: row.source_file_id,
        sourceProjectFileId: null,
        sourceTitle: row.source_title,
        originDocumentTitle: row.origin_document_title,
        sectionLabel: row.section_label,
        pageNumber: row.page_number === null ? null : Number(row.page_number),
        chunkIndex: Number(row.chunk_index),
        content: row.content,
      }));
      for (const source of sourceDocumentResult.rows) {
        for (const chunk of chunkContextText(source.content)) {
          candidates.push({
            sourceType: "workspace_document",
            sourceDocumentId: source.id,
            sourceFileId: null,
            sourceProjectFileId: null,
            sourceTitle: source.title,
            originDocumentTitle: source.title,
            sectionLabel: chunk.sectionLabel,
            pageNumber: null,
            chunkIndex: chunk.chunkIndex,
            content: chunk.content,
          });
        }
      }
      for (const row of projectFileResult.rows) {
        candidates.push({
          sourceType: "project_file",
          sourceDocumentId: null,
          sourceFileId: null,
          sourceProjectFileId: row.source_project_file_id,
          sourceTitle: row.source_title,
          originDocumentTitle: row.origin_document_title,
          sectionLabel: row.section_label,
          pageNumber: row.page_number === null ? null : Number(row.page_number),
          chunkIndex: Number(row.chunk_index),
          content: row.content,
        });
      }

      const suggestions = rankContextCandidates(candidates, {
        documentTitle: document.title,
        documentType: document.document_type,
        sectionHeading,
        selectedText,
        nearbyText,
        currentDocumentContent: document.content,
      }, limit);
      res.json({
        items: suggestions,
        context: {
          sectionHeading,
          cursorPosition: cursor,
          sourceCount: new Set(candidates.map((candidate) =>
            candidate.sourceProjectFileId ?? candidate.sourceFileId ?? candidate.sourceDocumentId,
          )).size,
          candidateCount: candidates.length,
        },
      });
    } catch (error) {
      console.error("[admin document context] suggestions error", error);
      res.status(500).json({ error: "Kunne ikke finne relevante kildeutdrag" });
    }
  });

  app.post("/api/admin-room/workspace/documents/:id/context/usage", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const sourceType = req.body?.sourceType;
    const sourceId = textValue(req.body?.sourceId, 100);
    const suggestionId = textValue(req.body?.suggestionId, 64);
    const insertMode = textValue(req.body?.insertMode, 20);
    const insertedText = textValue(req.body?.insertedText, 20_000);
    if (
      (sourceType !== "workspace_document" && sourceType !== "file" && sourceType !== "project_file") ||
      !sourceId || !suggestionId || !insertMode || !VALID_INSERT_MODES.has(insertMode) || !insertedText
    ) {
      res.status(400).json({ error: "Ugyldig informasjon om kildeinnsetting" });
      return;
    }
    try {
      const target = await ownedDocument(pool, req.params.id, session.userId);
      if (!target) {
        res.status(404).json({ error: "Dokumentet finnes ikke" });
        return;
      }
      const source = sourceType === "workspace_document"
        ? await pool.query(
            `SELECT id::text AS source_document_id, NULL::text AS source_file_id,
                    NULL::text AS source_project_file_id,
                    title AS source_title
               FROM admin_documents
              WHERE id::text = $1 AND user_id::text = $2 AND deleted_at IS NULL`,
            [sourceId, session.userId],
          )
        : sourceType === "file"
          ? await pool.query(
              `SELECT document_id::text AS source_document_id, id::text AS source_file_id,
                      NULL::text AS source_project_file_id, file_name AS source_title
                 FROM admin_document_files
                WHERE id::text = $1 AND user_id::text = $2`,
              [sourceId, session.userId],
            )
          : await pool.query(
              `SELECT NULL::text AS source_document_id, NULL::text AS source_file_id,
                      f.id::text AS source_project_file_id, f.file_name AS source_title
                 FROM admin_workspace_project_files f
                WHERE f.id::text = $1 AND f.user_id::text = $2
                  AND EXISTS (
                    SELECT 1 FROM admin_document_links dl
                     WHERE dl.document_id::text = $3
                       AND dl.user_id::text = $2
                       AND dl.entity_type = 'workspace_project'
                       AND dl.entity_id = f.project_id::text
                  )`,
              [sourceId, session.userId, req.params.id],
            );
      if (!source.rows.length) {
        res.status(404).json({ error: "Kilden finnes ikke" });
        return;
      }
      const item = source.rows[0];
      const insertedTextHash = crypto.createHash("sha256").update(insertedText).digest("hex");
      const result = await pool.query(
        `INSERT INTO admin_document_context_usages
           (document_id, user_id, source_document_id, source_file_id,
            source_project_file_id, source_title, suggestion_id, insert_mode,
            inserted_text_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, created_at`,
        [
          req.params.id,
          session.userId,
          item.source_document_id,
          item.source_file_id,
          item.source_project_file_id,
          item.source_title,
          suggestionId,
          insertMode,
          insertedTextHash,
        ],
      );
      await logAdminActivity({
        userId: session.userId,
        entityType: "workspace_document",
        entityId: req.params.id,
        action: "context_inserted",
        summary: `Satte inn kildebasert innhold fra «${item.source_title}»`,
        details: { sourceType, sourceId, suggestionId, insertMode, insertedTextHash },
      });
      res.status(201).json({ item: result.rows[0] });
    } catch (error) {
      console.error("[admin document context] usage error", error);
      res.status(500).json({ error: "Kunne ikke registrere kildeinnsettingen" });
    }
  });
}
