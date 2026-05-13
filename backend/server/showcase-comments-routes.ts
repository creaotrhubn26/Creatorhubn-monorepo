/**
 * showcase-comments-routes.ts
 *
 * Setup-funksjon for /api/showcase/:itemId/comments + /comments/:commentId/like
 * endpoints. Klient-feedback på showcase-elementer (godkjent/avvist + likes).
 *
 * 3 endpoints:
 *   - GET   /:itemId/comments              (list comments per item)
 *   - POST  /:itemId/comments              (create comment)
 *   - POST  /comments/:commentId/like      (like — inkrement counter i metadata.likes)
 *
 * Auth: åpen — userId leses fra payload/header, kommentar opprettes med
 * status="pending" hvis ingen oppgitt. Eksisterende oppførsel bevart.
 *
 * Wire opp i backend/server/index.ts ved å legge til:
 *
 *   import { setupShowcaseCommentsRoutes } from "./showcase-comments-routes";
 *
 *   setupShowcaseCommentsRoutes({ app, db });
 *
 * Mode-noter: ingen mode-branching.
 */

import type express from "express";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import crypto from "crypto";
import { desc, eq } from "drizzle-orm";

import * as schema from "../migrations/schema.js";
import {
  readNumber,
  readString,
  normalizeJsonObjectField,
} from "./_shared";

type Db = NodePgDatabase<typeof schema>;

export interface ShowcaseCommentsRoutesDeps {
  app: express.Application;
  db: Db;
}

export function setupShowcaseCommentsRoutes(
  deps: ShowcaseCommentsRoutesDeps,
): void {
  const { app, db } = deps;

  app.get("/api/showcase/:itemId/comments", async (req, res) => {
    try {
      const rows = await db
        .select()
        .from(schema.showcaseComments)
        .where(eq(schema.showcaseComments.showcaseItemId, req.params.itemId))
        .orderBy(desc(schema.showcaseComments.createdAt));
      res.json(
        rows.map((row) => {
          const metadata = normalizeJsonObjectField(row.metadata) || {};
          return {
            id: row.id,
            showcaseItemId: row.showcaseItemId,
            userId: row.userId,
            userName: row.userName,
            userEmail: row.userEmail,
            comment: row.commentText,
            commentText: row.commentText,
            timestamp: readNumber(row.timestampSeconds) ?? null,
            timestampSeconds: readNumber(row.timestampSeconds) ?? null,
            parentCommentId: row.parentCommentId,
            status: row.status,
            photographerResponse: row.photographerResponse,
            isResolved: row.isResolved,
            likes: readNumber(metadata.likes) ?? 0,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          };
        }),
      );
    } catch (error) {
      console.error("Error loading showcase comments:", error);
      res.status(500).json({ error: "Kunne ikke hente kommentarer" });
    }
  });

  app.post("/api/showcase/:itemId/comments", async (req, res) => {
    try {
      const payload = req.body as Record<string, unknown>;
      const timestampSeconds =
        readNumber(payload.timestamp) ?? readNumber(payload.timestampSeconds);
      const [created] = await db
        .insert(schema.showcaseComments)
        .values({
          id: crypto.randomUUID(),
          showcaseItemId: req.params.itemId,
          userId:
            readString(payload.userId) ||
            readString(req.headers["x-user-id"]) ||
            "guest",
          userName: readString(payload.userName) || "CreatorHub-bruker",
          userEmail: readString(payload.userEmail) || null,
          commentText:
            readString(payload.comment) ||
            readString(payload.commentText) ||
            "",
          timestampSeconds:
            timestampSeconds !== null ? String(timestampSeconds) : null,
          parentCommentId: readString(payload.parentCommentId) || null,
          status: "pending",
          isResolved: false,
          metadata: { likes: 0 },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .returning();
      res.status(201).json(created);
    } catch (error) {
      console.error("Error creating showcase comment:", error);
      res.status(500).json({ error: "Kunne ikke lagre kommentar" });
    }
  });

  app.post("/api/showcase/comments/:commentId/like", async (req, res) => {
    try {
      const rows = await db
        .select()
        .from(schema.showcaseComments)
        .where(eq(schema.showcaseComments.id, req.params.commentId))
        .limit(1);
      const comment = rows[0];
      if (!comment) {
        return res.status(404).json({ error: "Kommentar ikke funnet" });
      }
      const metadata = normalizeJsonObjectField(comment.metadata) || {};
      const nextLikes = (readNumber(metadata.likes) ?? 0) + 1;
      const [updated] = await db
        .update(schema.showcaseComments)
        .set({
          metadata: {
            ...metadata,
            likes: nextLikes,
          },
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.showcaseComments.id, req.params.commentId))
        .returning();
      res.json({ success: true, likes: nextLikes, comment: updated });
    } catch (error) {
      console.error("Error liking showcase comment:", error);
      res.status(500).json({ error: "Kunne ikke like kommentar" });
    }
  });
}
