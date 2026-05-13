/**
 * showcase-collections-routes.ts
 *
 * Setup-funksjon for /api/showcase/collections/* endpoints — samlinger
 * av showcase-items (folder-lignende strukturer for portfolio-deling).
 *
 * 6 endpoints:
 *   - POST   /collections                                         (create)
 *   - GET    /collections                                         (list, filter på profession+userId)
 *   - PUT    /collections/:collectionId                           (update meta)
 *   - DELETE /collections/:collectionId                           (delete + cleanup show-id-mapping)
 *   - POST   /collections/:collectionId/showcases                 (assign showcases)
 *   - DELETE /collections/:collectionId/showcases/:showcaseId     (un-assign)
 *
 * Auth: åpen — userId leses fra query/header, ingen session-validering
 * (eksisterende oppførsel bevart).
 *
 * Wire opp i backend/server/index.ts ved å legge til:
 *
 *   import { setupShowcaseCollectionsRoutes } from "./showcase-collections-routes";
 *
 *   setupShowcaseCollectionsRoutes({
 *     app, pool, getTableColumns, compatStoreDelete,
 *     getShowcaseCollectionShowcaseIds, setShowcaseCollectionShowcaseIds,
 *     showcaseCollectionShowcasesKey,
 *   });
 *
 * NB: De 3 collection-spesifikke helpers (get/setShowcaseCollectionShowcaseIds
 * og showcaseCollectionShowcasesKey) brukes også av andre showcase-endpoints
 * som ikke er ekstraktert ennå. De blir værende i index.ts og passes via
 * deps inntil resten av showcase-clusteret er ekstraktert — da kan de
 * flyttes til en egen showcase-collection-store.ts om nødvendig.
 *
 * Mode-noter: profession-feltet er et profession-filter (photographer,
 * etc.), ikke en Role Room-mode.
 */

import type express from "express";
import type { Pool } from "pg";
import crypto from "crypto";

import {
  readBoolean,
  readNumber,
  readOptionalIsoDate,
  readString,
  readStringArray,
  normalizeJsonObjectField,
} from "./_shared";

export interface ShowcaseCollectionsRoutesDeps {
  app: express.Application;
  pool: Pool;
  getTableColumns: (tableName: string) => Promise<Set<string>>;
  compatStoreDelete: (storeKey: string) => Promise<void>;
  getShowcaseCollectionShowcaseIds: (collectionId: string) => Promise<string[]>;
  setShowcaseCollectionShowcaseIds: (
    collectionId: string,
    showcaseIds: string[],
  ) => Promise<void>;
  showcaseCollectionShowcasesKey: (collectionId: string) => string;
}

export function setupShowcaseCollectionsRoutes(
  deps: ShowcaseCollectionsRoutesDeps,
): void {
  const {
    app,
    pool,
    getTableColumns,
    compatStoreDelete,
    getShowcaseCollectionShowcaseIds,
    setShowcaseCollectionShowcaseIds,
    showcaseCollectionShowcasesKey,
  } = deps;

  // POST /api/showcase/collections — Create showcase collection
  app.post("/api/showcase/collections", async (req, res) => {
    try {
      const payload = req.body as Record<string, unknown>;
      const now = new Date().toISOString();
      const userId =
        readString(payload.userId) ||
        readString(req.headers["x-user-id"]) ||
        "system";
      const collectionId = crypto.randomUUID();
      const columns = await getTableColumns("showcase_collections");
      const fieldSpecs = [
        { column: "id", value: collectionId },
        { column: "user_id", value: userId },
        {
          column: "name",
          value: readString(payload.name) || "Ny samling",
        },
        {
          column: "description",
          value: readString(payload.description) || "",
        },
        {
          column: "cover_image",
          value: readString(payload.coverImage) || null,
        },
        {
          column: "is_public",
          value:
            readBoolean(payload.isPublic) ??
            (readString(payload.visibility) === "public"),
        },
        { column: "sort_order", value: readNumber(payload.sortOrder) ?? 0 },
        {
          column: "settings",
          value: JSON.stringify({
            visibility: readString(payload.visibility) || "private",
            tags: readStringArray(payload.tags),
            profession: readString(payload.profession) || null,
            parentFolderId: readString(payload.parentFolderId) || null,
            isFeatured: readBoolean(payload.isFeatured) ?? false,
            ...(normalizeJsonObjectField(payload.settings) || {}),
          }),
          json: true,
        },
        { column: "created_at", value: now, timestamp: true },
        { column: "updated_at", value: now, timestamp: true },
      ].filter((spec) => columns.has(spec.column));

      if (fieldSpecs.length) {
        const placeholders: string[] = [];
        const values: unknown[] = [];
        for (const spec of fieldSpecs) {
          values.push(spec.value);
          if (spec.json) {
            placeholders.push(`$${values.length}::jsonb`);
          } else if (spec.timestamp) {
            placeholders.push(`$${values.length}::timestamp`);
          } else {
            placeholders.push(`$${values.length}`);
          }
        }
        await pool.query(
          `INSERT INTO showcase_collections (${fieldSpecs
            .map((spec) => spec.column)
            .join(", ")})
           VALUES (${placeholders.join(", ")})`,
          values,
        );
      }

      const showcaseIds = readStringArray(payload.items);
      if (showcaseIds.length) {
        await setShowcaseCollectionShowcaseIds(collectionId, showcaseIds);
      }

      res.status(201).json({
        id: collectionId,
        collection: {
          id: collectionId,
          name: readString(payload.name) || "Ny samling",
          description: readString(payload.description) || "",
          visibility: readString(payload.visibility) || "private",
          isPublic:
            readBoolean(payload.isPublic) ??
            (readString(payload.visibility) === "public"),
          isFeatured: readBoolean(payload.isFeatured) ?? false,
          showcaseIds,
          items: showcaseIds,
          createdAt: now,
          updatedAt: now,
        },
      });
    } catch (error) {
      console.error("Error creating showcase collection:", error);
      res.status(500).json({ error: "Kunne ikke opprette samling" });
    }
  });

  app.get("/api/showcase/collections", async (req, res) => {
    try {
      const profession = readString(req.query.profession);
      const userId =
        readString(req.query.userId) ||
        readString(req.headers["x-user-id"]) ||
        null;
      const queryParams: unknown[] = [];
      const filters: string[] = [];
      if (userId) {
        queryParams.push(userId);
        filters.push(`user_id = $${queryParams.length}`);
      }
      const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
      const rows = await pool.query(
        `SELECT *
           FROM showcase_collections
           ${whereClause}
          ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST`,
        queryParams,
      );

      const collections = await Promise.all(
        rows.rows.map(async (row: Record<string, unknown>) => {
          const settings = normalizeJsonObjectField(row.settings) || {};
          const showcaseIds = await getShowcaseCollectionShowcaseIds(String(row.id));
          if (
            profession &&
            readString(settings.profession) &&
            readString(settings.profession) !== profession
          ) {
            return null;
          }
          return {
            id: String(row.id),
            name: readString(row.name) || "Samling",
            description: readString(row.description) || "",
            coverImage: readString(row.cover_image) || undefined,
            isPublic: readBoolean(row.is_public) ?? false,
            isFeatured: readBoolean(settings.isFeatured) ?? false,
            visibility: readString(settings.visibility) || "private",
            tags: readStringArray(settings.tags),
            settings,
            showcaseIds,
            items: showcaseIds,
            createdAt:
              readOptionalIsoDate(row.created_at) || new Date().toISOString(),
            updatedAt:
              readOptionalIsoDate(row.updated_at) || new Date().toISOString(),
          };
        }),
      );

      res.json(collections.filter(Boolean));
    } catch (error) {
      console.error("Error loading showcase collections:", error);
      res.status(500).json({ error: "Kunne ikke hente samlinger" });
    }
  });

  app.put("/api/showcase/collections/:collectionId", async (req, res) => {
    try {
      const payload = req.body as Record<string, unknown>;
      const settings = normalizeJsonObjectField(payload.settings) || {};
      const nextSettings = {
        ...settings,
        visibility:
          readString(payload.visibility) || readString(settings.visibility) || "private",
        tags: readStringArray(payload.tags).length
          ? readStringArray(payload.tags)
          : readStringArray(settings.tags),
        isFeatured:
          readBoolean(payload.isFeatured) ??
          readBoolean(settings.isFeatured) ??
          false,
      };

      const result = await pool.query(
        `UPDATE showcase_collections
            SET name = $1,
                description = $2,
                cover_image = $3,
                is_public = $4,
                settings = $5::jsonb,
                updated_at = NOW()
          WHERE id = $6
          RETURNING *`,
        [
          readString(payload.name) || "Samling",
          readString(payload.description) || "",
          readString(payload.coverImage) || null,
          readBoolean(payload.isPublic) ??
            (readString(payload.visibility) === "public"),
          JSON.stringify(nextSettings),
          req.params.collectionId,
        ],
      );

      if (!result.rows.length) {
        return res.status(404).json({ error: "Samling ikke funnet" });
      }

      const showcaseIds = await getShowcaseCollectionShowcaseIds(
        req.params.collectionId,
      );
      res.json({
        ...result.rows[0],
        showcaseIds,
        items: showcaseIds,
        visibility: nextSettings.visibility,
      });
    } catch (error) {
      console.error("Error updating showcase collection:", error);
      res.status(500).json({ error: "Kunne ikke oppdatere samling" });
    }
  });

  app.delete("/api/showcase/collections/:collectionId", async (req, res) => {
    try {
      const result = await pool.query(
        `DELETE FROM showcase_collections WHERE id = $1 RETURNING id`,
        [req.params.collectionId],
      );
      if (!result.rows.length) {
        return res.status(404).json({ error: "Samling ikke funnet" });
      }
      await compatStoreDelete(
        showcaseCollectionShowcasesKey(req.params.collectionId),
      );
      res.json({ deleted: true, id: req.params.collectionId });
    } catch (error) {
      console.error("Error deleting showcase collection:", error);
      res.status(500).json({ error: "Kunne ikke slette samling" });
    }
  });

  app.post("/api/showcase/collections/:collectionId/showcases", async (req, res) => {
    try {
      const showcaseIds = readStringArray(req.body?.showcaseIds);
      const existing = await getShowcaseCollectionShowcaseIds(
        req.params.collectionId,
      );
      const next = Array.from(new Set([...existing, ...showcaseIds]));
      await setShowcaseCollectionShowcaseIds(req.params.collectionId, next);
      res.json({
        success: true,
        collectionId: req.params.collectionId,
        showcaseIds: next,
      });
    } catch (error) {
      console.error("Error assigning showcases to collection:", error);
      res.status(500).json({ error: "Kunne ikke tildele showcases til samling" });
    }
  });

  app.delete(
    "/api/showcase/collections/:collectionId/showcases/:showcaseId",
    async (req, res) => {
      try {
        const existing = await getShowcaseCollectionShowcaseIds(
          req.params.collectionId,
        );
        const next = existing.filter((id) => id !== req.params.showcaseId);
        await setShowcaseCollectionShowcaseIds(req.params.collectionId, next);
        res.json({
          success: true,
          collectionId: req.params.collectionId,
          showcaseIds: next,
        });
      } catch (error) {
        console.error("Error removing showcase from collection:", error);
        res.status(500).json({ error: "Kunne ikke fjerne showcase fra samling" });
      }
    },
  );
}
