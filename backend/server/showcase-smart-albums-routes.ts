/**
 * showcase-smart-albums-routes.ts
 *
 * Setup-funksjon for /api/showcase/smart-albums endpoints — regelbaserte
 * autogenererte album basert på rating, tags, dato og kamera.
 *
 * 2 endpoints:
 *   - POST /smart-albums                      (create med smart-rule)
 *   - POST /smart-albums/:albumId/update      (re-evaluer regler, oppdater items)
 *
 * Auth: åpen — userId fra payload/header.
 *
 * Wire opp i backend/server/index.ts ved å legge til:
 *
 *   import { setupShowcaseSmartAlbumsRoutes } from "./showcase-smart-albums-routes";
 *
 *   setupShowcaseSmartAlbumsRoutes({ app, pool, db, mapShowcaseItemRow });
 *
 * Mode-noter: profession-feltet er Showcase-profession, ikke Role Room-mode.
 */

import type express from "express";
import type { Pool } from "pg";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import crypto from "crypto";
import { eq } from "drizzle-orm";

import * as schema from "../migrations/schema.js";
import {
  readBoolean,
  readNumber,
  readString,
  readStringArray,
  normalizeJsonObjectField,
} from "./_shared";

type Db = NodePgDatabase<typeof schema>;

export interface ShowcaseSmartAlbumsRoutesDeps {
  app: express.Application;
  pool: Pool;
  db: Db;
  requireUserSession: (req: any, res: any) => any;
  mapShowcaseItemRow: (row: Record<string, unknown>) => Record<string, unknown>;
}

export function setupShowcaseSmartAlbumsRoutes(
  deps: ShowcaseSmartAlbumsRoutesDeps,
): void {
  const { app, pool, db, requireUserSession, mapShowcaseItemRow } = deps;

  app.post("/api/showcase/smart-albums", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const payload = req.body as Record<string, unknown>;
      const [created] = await db
        .insert(schema.smartAlbums)
        .values({
          id: crypto.randomUUID(),
          userId:
            readString(payload.userId) ||
            readString(req.headers["x-user-id"]) ||
            "system",
          profession: readString(payload.profession) || "photographer",
          name: readString(payload.name) || "Smart album",
          description: readString(payload.description) || "",
          albumType: "smart_rule",
          smartRules: {
            rating: readNumber(payload.rating) ?? 0,
            tags: readStringArray(payload.tags),
            dateRange: normalizeJsonObjectField(payload.dateRange) || {},
            location: readString(payload.location) || "",
            camera: readString(payload.camera) || "",
            autoUpdate: readBoolean(payload.autoUpdate) ?? true,
          },
          layoutStyle: "grid",
          sortBy: "date",
          sortOrder: "desc",
          isPublic: false,
          itemCount: 0,
          status: "active",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .returning();
      res.status(201).json(created);
    } catch (error) {
      console.error("Error creating smart album:", error);
      res.status(500).json({ error: "Kunne ikke opprette smart album" });
    }
  });

  app.post("/api/showcase/smart-albums/:albumId/update", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const albumId = req.params.albumId;
      const albumRows = await db
        .select()
        .from(schema.smartAlbums)
        .where(eq(schema.smartAlbums.id, albumId))
        .limit(1);
      const album = albumRows[0];
      if (!album) {
        return res.status(404).json({ error: "Smart album ikke funnet" });
      }

      const rules = normalizeJsonObjectField(album.smartRules) || {};
      const tagRules = readStringArray(rules.tags);
      const ratingRule = readNumber(rules.rating) ?? 0;
      const userId = readString(album.userId) || "";
      const profession = readString(album.profession) || "photographer";

      const itemsResult = await pool.query(
        `SELECT *
           FROM showcase_items
          WHERE user_id = $1
            AND profession = $2
            AND COALESCE(is_active, true) = true`,
        [userId, profession],
      );

      const matchingItems = itemsResult.rows
        .map((row: Record<string, unknown>) => mapShowcaseItemRow(row))
        .filter((item) => {
          const tagMatch =
            !tagRules.length ||
            tagRules.every((tag) => ((item.tags as string[]) || []).includes(tag));
          const ratingMatch = !ratingRule || Number(item.rating || 0) >= ratingRule;
          return tagMatch && ratingMatch;
        });

      await db
        .delete(schema.smartAlbumItems)
        .where(eq(schema.smartAlbumItems.albumId, albumId));

      if (matchingItems.length) {
        await db.insert(schema.smartAlbumItems).values(
          matchingItems.map((item, index) => ({
            id: crypto.randomUUID(),
            albumId,
            showcaseItemId: String(item.id),
            sortOrder: index,
            wasAutoAssigned: true,
            assignmentReason: "smart_rules",
            addedAt: new Date().toISOString(),
          })),
        );
      }

      const [updated] = await db
        .update(schema.smartAlbums)
        .set({
          itemCount: matchingItems.length,
          lastAutoUpdate: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.smartAlbums.id, albumId))
        .returning();

      res.json({
        success: true,
        album: updated,
        items: matchingItems,
        itemCount: matchingItems.length,
      });
    } catch (error) {
      console.error("Error updating smart album:", error);
      res.status(500).json({ error: "Kunne ikke oppdatere smart album" });
    }
  });
}
