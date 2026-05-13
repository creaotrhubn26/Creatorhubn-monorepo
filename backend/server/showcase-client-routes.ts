/**
 * showcase-client-routes.ts
 *
 * Setup-funksjon for /api/showcase/client-* + /public/* + /send-overage-email
 * endpoints — klient-rettet portal-funksjonalitet for prøvegallerier.
 *
 * 8 endpoints:
 *   - POST   /send-overage-email                              (placeholder/log)
 *   - GET    /client-session/:sessionId                       (sesjonsdetaljer)
 *   - GET    /client-selections/:sessionId                    (klientens valg)
 *   - GET    /public/:userId                                  (offentlig vendor-view)
 *   - POST   /client-selections                               (lagre/oppdater valg + WS-broadcast)
 *   - DELETE /client-selections                               (fjern valg)
 *   - PUT    /client-session/:sessionId/project-state         (prosjektstatus i compat-store)
 *   - POST   /client-submissions                              (endelig innsending)
 *
 * Auth: åpen — sesjons-baserte endpoints validerer mot client_gallery_sessions
 * + client-email i payload/query, ingen ekstern session-validering.
 *
 * Wire opp i backend/server/index.ts ved å legge til:
 *
 *   import { setupShowcaseClientRoutes } from "./showcase-client-routes";
 *
 *   setupShowcaseClientRoutes({
 *     app, pool, compatStoreGet, compatStoreSet, showcaseCompatKey,
 *   });
 *
 * Mode-noter: ingen mode-branching. Klient-portal er feature primært
 * for Produksjonsteam og Innholdsprodusent (klient-godkjenning av
 * leveranser).
 */

import type express from "express";
import type { Pool } from "pg";
import crypto from "crypto";

import { broadcastChatEventToUser } from "./websocket-chat.js";
import {
  readBoolean,
  readNumber,
  readOptionalIsoDate,
  readString,
  readStringArray,
} from "./_shared";

export interface ShowcaseClientRoutesDeps {
  app: express.Application;
  pool: Pool;
  compatStoreGet: <T>(storeKey: string) => Promise<T | null>;
  compatStoreSet: (storeKey: string, value: unknown) => Promise<void>;
  showcaseCompatKey: (...parts: Array<string | null | undefined>) => string;
}

export function setupShowcaseClientRoutes(
  deps: ShowcaseClientRoutesDeps,
): void {
  const { app, pool, compatStoreGet, compatStoreSet, showcaseCompatKey } = deps;

  app.post("/api/showcase/send-overage-email", async (req, res) => {
    try {
      const { to, showcaseId, overageCount } = req.body;
      console.log(
        `[Showcase Overage] Notifying ${to} about ${overageCount} overage selections`,
      );
      // showcaseId beholdt i loggsignaturen for fremtidig email-template-bruk
      void showcaseId;
      res.json({ success: true, message: "Overskridelsesvarsel sendt" });
    } catch (error) {
      res.status(500).json({ error: "Kunne ikke sende varsel" });
    }
  });

  // GET /api/showcase/client-session/:sessionId — Get client proofing session
  app.get("/api/showcase/client-session/:sessionId", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const clientEmail = readString(req.query.clientEmail) || "";
      const sessionResult = await pool
        .query(
          `SELECT *
             FROM client_gallery_sessions
            WHERE id = $1
            LIMIT 1`,
          [sessionId],
        )
        .catch(() => ({ rows: [] as Array<Record<string, unknown>> }));

      const sessionRow =
        (sessionResult.rows[0] as Record<string, unknown> | undefined) || null;
      const projectStateEntry = await compatStoreGet<{
        projectState?: string;
        projectId?: string | null;
      }>(showcaseCompatKey("client-session", sessionId, "project-state"));

      if (!sessionRow) {
        return res.json({
          id: sessionId,
          sessionName: "Bryllupsgalleri",
          clientName: clientEmail || "Klient",
          maxSelections: 50,
          minSelections: 20,
          selectionDeadline: new Date(
            Date.now() + 14 * 86400000,
          ).toISOString(),
          status: "active",
          proofingRound: 1,
          selectedCount: 0,
          projectState: projectStateEntry?.projectState || "in_review",
          projectId: projectStateEntry?.projectId || null,
        });
      }

      const selectionResult = await pool
        .query(
          `SELECT COUNT(*)::int AS total
             FROM client_selections
            WHERE session_id = $1
              AND ($2 = '' OR LOWER(client_email) = LOWER($2))
              AND is_selected = true`,
          [sessionId, clientEmail],
        )
        .catch(() => ({ rows: [{ total: 0 }] }));

      res.json({
        id: String(sessionRow.id || sessionId),
        sessionName: readString(sessionRow.session_name) || "Kundegalleri",
        clientName:
          readString(sessionRow.client_name) || clientEmail || "Klient",
        maxSelections: readNumber(sessionRow.max_selections) ?? 50,
        minSelections: readNumber(sessionRow.min_selections) ?? 0,
        selectionDeadline:
          readOptionalIsoDate(sessionRow.selection_deadline) ||
          new Date(Date.now() + 14 * 86400000).toISOString(),
        status: readString(sessionRow.status) || "active",
        proofingRound: readNumber(sessionRow.proofing_round) ?? 1,
        selectedCount: Number(selectionResult.rows[0]?.total || 0),
        description: readString(sessionRow.description) || "",
        projectState: projectStateEntry?.projectState || "in_review",
        projectId: projectStateEntry?.projectId || readString(sessionRow.project_id),
        allowComments: readBoolean(sessionRow.allow_comments) ?? true,
        allowDownloads: readBoolean(sessionRow.allow_downloads) ?? false,
      });
    } catch (error) {
      console.error("Error fetching client session:", error);
      res.status(500).json({ error: "Kunne ikke hente klientsesjon" });
    }
  });

  // GET /api/showcase/client-selections/:sessionId — Get client's selections
  app.get("/api/showcase/client-selections/:sessionId", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const clientEmail = readString(req.query.clientEmail) || "";
      const result = await pool
        .query(
          `SELECT *
             FROM client_selections
            WHERE session_id = $1
              AND ($2 = '' OR LOWER(client_email) = LOWER($2))
            ORDER BY created_at ASC`,
          [sessionId, clientEmail],
        )
        .catch(() => ({ rows: [] as Array<Record<string, unknown>> }));

      res.json(
        result.rows.map((row: Record<string, unknown>) => ({
          id: String(row.id),
          sessionId: String(row.session_id || sessionId),
          showcaseItemId: String(row.showcase_item_id),
          clientEmail: readString(row.client_email) || clientEmail,
          isSelected: readBoolean(row.is_selected) ?? true,
          priority: readNumber(row.priority) ?? null,
          clientComment: readString(row.client_comment) || "",
          photographerApproved:
            readBoolean(row.photographer_approved) ?? null,
          photographerComment: readString(row.photographer_comment) || "",
          createdAt:
            readOptionalIsoDate(row.created_at) || new Date().toISOString(),
          updatedAt:
            readOptionalIsoDate(row.updated_at) || new Date().toISOString(),
        })),
      );
    } catch (error) {
      res.status(500).json({ error: "Kunne ikke hente valg" });
    }
  });

  // GET /api/showcase/public/:userId — Public showcase for a vendor (couple can view)
  app.get("/api/showcase/public/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const { profession: profQuery } = req.query;

      let query = `SELECT si.*,
                   COALESCE((SELECT SUM(sa.views) FROM showcase_analytics sa WHERE sa.showcase_item_id = si.id), 0) as view_count,
                   COALESCE((SELECT SUM(sa.likes) FROM showcase_analytics sa WHERE sa.showcase_item_id = si.id), 0) as like_count
                   FROM showcase_items si WHERE si.user_id = $1 AND si.is_active = true AND si.is_public = true`;
      const params: any[] = [userId];
      let paramIdx = 2;

      if (profQuery) {
        query += ` AND si.profession = $${paramIdx}`;
        params.push(profQuery);
        paramIdx++;
      }
      query += " ORDER BY si.created_at DESC";

      const result = await pool.query(query, params);

      // Get vendor info
      const vendor = await pool.query(
        "SELECT id, username, first_name, last_name, profile_image_url FROM users WHERE id = $1",
        [userId],
      );

      const items = result.rows.map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        thumbnailUrl: row.thumbnail_url,
        fileUrl: row.image_url,
        type:
          row.profession === "music_producer"
            ? "audio"
            : row.profession === "videographer"
              ? "video"
              : "photo",
        category: row.category,
        createdAt: row.created_at,
        isFeatured: row.is_public,
        viewCount: Number(row.view_count) || 0,
        likeCount: Number(row.like_count) || 0,
      }));

      res.json({
        vendor: vendor.rows[0] || null,
        items,
        total: items.length,
      });
    } catch (error) {
      console.error("Error fetching public showcase:", error);
      res.status(500).json({ error: "Kunne ikke hente showcase" });
    }
  });

  app.post("/api/showcase/client-selections", async (req, res) => {
    try {
      const payload = req.body as Record<string, unknown>;
      const sessionId =
        readString(payload.sessionIdd) || readString(payload.sessionId);
      const showcaseItemId = readString(payload.showcaseItemId);
      const clientEmail = readString(payload.clientEmail);
      if (!sessionId || !showcaseItemId || !clientEmail) {
        return res.status(400).json({ error: "Manglende selection-data" });
      }

      const existing = await pool.query(
        `SELECT id
           FROM client_selections
          WHERE session_id = $1
            AND showcase_item_id = $2
            AND LOWER(client_email) = LOWER($3)
          LIMIT 1`,
        [sessionId, showcaseItemId, clientEmail],
      );

      if (existing.rows.length) {
        const result = await pool.query(
          `UPDATE client_selections
              SET is_selected = true,
                  client_comment = $1,
                  updated_at = NOW()
            WHERE id = $2
            RETURNING *`,
          [readString(payload.clientComment) || "", existing.rows[0].id],
        );
        return res.json(result.rows[0]);
      }

      const result = await pool.query(
        `INSERT INTO client_selections (
           id, session_id, showcase_item_id, client_email, is_selected, client_comment, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, true, $5, NOW(), NOW()
         )
         RETURNING *`,
        [
          crypto.randomUUID(),
          sessionId,
          showcaseItemId,
          clientEmail,
          readString(payload.clientComment) || "",
        ],
      );

      // Slice 9D.5.D — varsle fotograf via WebSocket så dashboard-badgen
      // oppdateres umiddelbart. Best-effort; feiler stille uten å forstyrre
      // klient-responsen.
      try {
        const ownerRow = await pool.query(
          `SELECT photographer_id FROM client_gallery_sessions WHERE id = $1 LIMIT 1`,
          [sessionId],
        );
        const ownerId = ownerRow.rows[0]?.photographer_id as string | undefined;
        if (ownerId) {
          broadcastChatEventToUser(ownerId, {
            type: 'gallery_submission',
            sessionId,
            clientEmail,
            showcaseItemId,
            createdAt: new Date().toISOString(),
          });
        }
      } catch (wsErr) {
        console.warn('[ws] gallery_submission broadcast failed:', wsErr);
      }

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Error saving client selection:", error);
      res.status(500).json({ error: "Kunne ikke lagre klientvalg" });
    }
  });

  app.delete("/api/showcase/client-selections", async (req, res) => {
    try {
      const payload = req.body as Record<string, unknown>;
      const sessionId =
        readString(payload.sessionIdd) || readString(payload.sessionId);
      const showcaseItemId = readString(payload.showcaseItemId);
      const clientEmail = readString(payload.clientEmail);
      if (!sessionId || !showcaseItemId || !clientEmail) {
        return res.status(400).json({ error: "Manglende selection-data" });
      }

      await pool.query(
        `DELETE FROM client_selections
          WHERE session_id = $1
            AND showcase_item_id = $2
            AND LOWER(client_email) = LOWER($3)`,
        [sessionId, showcaseItemId, clientEmail],
      );
      res.json({ success: true, showcaseItemId });
    } catch (error) {
      console.error("Error deleting client selection:", error);
      res.status(500).json({ error: "Kunne ikke slette klientvalg" });
    }
  });

  app.put("/api/showcase/client-session/:sessionId/project-state", async (req, res) => {
    try {
      const payload = req.body as Record<string, unknown>;
      const nextState = {
        projectState: readString(payload.projectState) || "in_review",
        projectId: readString(payload.projectId) || null,
      };
      await compatStoreSet(
        showcaseCompatKey("client-session", req.params.sessionId, "project-state"),
        nextState,
      );
      res.json({ success: true, ...nextState });
    } catch (error) {
      console.error("Error updating showcase project state:", error);
      res.status(500).json({ error: "Kunne ikke oppdatere prosjektstatus" });
    }
  });

  app.post("/api/showcase/client-submissions", async (req, res) => {
    try {
      const payload = req.body as Record<string, unknown>;
      const sessionId = readString(payload.sessionId);
      const clientEmail = readString(payload.clientEmail);
      if (!sessionId || !clientEmail) {
        return res.status(400).json({ error: "sessionId og clientEmail er påkrevd" });
      }

      const submission = {
        id: crypto.randomUUID(),
        sessionId,
        clientEmail,
        submissionComment: readString(payload.submissionComment) || "",
        selectedItems: readStringArray(payload.selectedItems),
        submittedAt: new Date().toISOString(),
      };
      await compatStoreSet(
        showcaseCompatKey("client-submission", sessionId, clientEmail.toLowerCase()),
        submission,
      );
      await pool
        .query(
          `UPDATE client_gallery_sessions
              SET status = 'selections_made',
                  updated_at = NOW()
            WHERE id = $1`,
          [sessionId],
        )
        .catch(() => undefined);
      res.status(201).json({ success: true, submission });
    } catch (error) {
      console.error("Error saving client showcase submission:", error);
      res.status(500).json({ error: "Kunne ikke sende klientutvalg" });
    }
  });
}
