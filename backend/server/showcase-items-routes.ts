/**
 * showcase-items-routes.ts
 *
 * Setup-funksjon for /api/showcase/items + /api/showcase/:itemId endpoints —
 * CRUD for individuelle showcase-elementer (bilder/videoer i portfolio).
 *
 * 7 endpoints:
 *   - POST   /items                                (create)
 *   - PATCH  /items/:itemId                        (update via raw SQL)
 *   - DELETE /items/:itemId                        (delete)
 *   - PUT    /:itemId                              (legacy update via helper)
 *   - DELETE /:itemId                              (legacy delete)
 *   - PUT    /items/:itemId                        (alias update via helper)
 *   - PUT    /update-metadata/:itemId              (alias update via helper)
 *
 * De 3 første (POST/PATCH/DELETE under /items) er originale; de 4 siste
 * er legacy-/alias-URL-er for samme operasjon, bevart for bakoverkompatibilitet
 * med eldre klienter.
 *
 * Auth: åpen — userId leses fra request-body, ingen session-validering
 * (eksisterende oppførsel bevart 1:1).
 *
 * Wire opp i backend/server/index.ts ved å legge til:
 *
 *   import { setupShowcaseItemsRoutes } from "./showcase-items-routes";
 *
 *   setupShowcaseItemsRoutes({
 *     app, pool, updateShowcaseItemRecord, mapShowcaseItemRow,
 *   });
 *
 * Mode-noter: profession-feltet er et profession-filter, ikke en Role
 * Room-mode. Ingen mode-branching.
 */

import type express from "express";
import type { Pool } from "pg";
import crypto from "crypto";

export interface ShowcaseItemsRoutesDeps {
  app: express.Application;
  pool: Pool;
  updateShowcaseItemRecord: (
    itemId: string,
    payload: Record<string, unknown>,
  ) => Promise<Record<string, unknown> | null>;
  mapShowcaseItemRow: (row: Record<string, unknown>) => Record<string, unknown>;
}

export function setupShowcaseItemsRoutes(deps: ShowcaseItemsRoutesDeps): void {
  const { app, pool, updateShowcaseItemRecord, mapShowcaseItemRow } = deps;

  // POST /api/showcase/items — Create showcase item
  app.post("/api/showcase/items", async (req, res) => {
    try {
      const {
        title,
        description,
        imageUrl,
        thumbnailUrl,
        category,
        profession,
        userId,
        tags,
        clientName,
        isPublic,
      } = req.body;
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      await pool.query(
        `INSERT INTO showcase_items (id, user_id, profession, category, title, description, image_url, thumbnail_url, crop_data, is_public, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, $11::timestamp, $12::timestamp)`,
        [
          id,
          userId,
          profession,
          category || "Portfolio",
          title,
          description || "",
          imageUrl || "",
          thumbnailUrl || "",
          JSON.stringify({ tags: tags || [], clientName: clientName || "" }),
          isPublic !== false,
          now,
          now,
        ],
      );
      res.status(201).json({ id, title, category, profession, created_at: now });
    } catch (error) {
      console.error("Error creating showcase item:", error);
      res.status(500).json({ error: "Kunne ikke opprette element" });
    }
  });

  // PATCH /api/showcase/items/:itemId — Update showcase item
  app.patch("/api/showcase/items/:itemId", async (req, res) => {
    try {
      const { itemId } = req.params;
      const updates = req.body;
      const setClauses: string[] = [];
      const params: any[] = [];
      let paramIdx = 1;

      const fieldMap: Record<string, string> = {
        title: "title",
        description: "description",
        imageUrl: "image_url",
        thumbnailUrl: "thumbnail_url",
        category: "category",
        isPublic: "is_public",
        isActive: "is_active",
      };
      for (const [key, col] of Object.entries(fieldMap)) {
        if (updates[key] !== undefined) {
          setClauses.push(`${col} = $${paramIdx}`);
          params.push(updates[key]);
          paramIdx++;
        }
      }
      if (setClauses.length === 0)
        return res.status(400).json({ error: "Ingen felt å oppdatere" });

      setClauses.push(`updated_at = $${paramIdx}::timestamp`);
      params.push(new Date().toISOString());
      paramIdx++;
      params.push(itemId);

      const result = await pool.query(
        `UPDATE showcase_items SET ${setClauses.join(", ")} WHERE id = $${paramIdx} RETURNING *`,
        params,
      );
      if (!result.rowCount)
        return res.status(404).json({ error: "Element ikke funnet" });
      res.json(result.rows[0]);
    } catch (error) {
      console.error("Error updating showcase item:", error);
      res.status(500).json({ error: "Kunne ikke oppdatere element" });
    }
  });

  // DELETE /api/showcase/items/:itemId — Delete showcase item
  app.delete("/api/showcase/items/:itemId", async (req, res) => {
    try {
      const { itemId } = req.params;
      const result = await pool.query(
        "DELETE FROM showcase_items WHERE id = $1 RETURNING id",
        [itemId],
      );
      if (!result.rowCount)
        return res.status(404).json({ error: "Element ikke funnet" });
      res.json({ deleted: true, id: itemId });
    } catch (error) {
      console.error("Error deleting showcase item:", error);
      res.status(500).json({ error: "Kunne ikke slette element" });
    }
  });

  // Legacy URL: PUT /api/showcase/:itemId
  app.put("/api/showcase/:itemId", async (req, res) => {
    try {
      const updated = await updateShowcaseItemRecord(
        req.params.itemId,
        req.body as Record<string, unknown>,
      );
      if (!updated) {
        return res.status(404).json({ error: "Showcase ikke funnet" });
      }
      res.json(mapShowcaseItemRow(updated));
    } catch (error) {
      console.error("Error updating showcase item:", error);
      res.status(500).json({ error: "Kunne ikke oppdatere showcase" });
    }
  });

  // Legacy URL: DELETE /api/showcase/:itemId
  app.delete("/api/showcase/:itemId", async (req, res) => {
    try {
      const result = await pool.query(
        "DELETE FROM showcase_items WHERE id = $1 RETURNING *",
        [req.params.itemId],
      );
      if (!result.rows.length) {
        return res.status(404).json({ error: "Showcase ikke funnet" });
      }
      res.json({ deleted: true, id: req.params.itemId });
    } catch (error) {
      console.error("Error deleting showcase item:", error);
      res.status(500).json({ error: "Kunne ikke slette showcase" });
    }
  });

  // Alias: PUT /api/showcase/items/:itemId (samme som legacy PUT /:itemId)
  app.put("/api/showcase/items/:itemId", async (req, res) => {
    try {
      const updated = await updateShowcaseItemRecord(
        req.params.itemId,
        req.body as Record<string, unknown>,
      );
      if (!updated) {
        return res.status(404).json({ error: "Showcase-element ikke funnet" });
      }
      res.json(mapShowcaseItemRow(updated));
    } catch (error) {
      console.error("Error updating showcase item alias:", error);
      res.status(500).json({ error: "Kunne ikke oppdatere showcase-element" });
    }
  });

  // Alias: PUT /api/showcase/update-metadata/:itemId (samme som over)
  app.put("/api/showcase/update-metadata/:itemId", async (req, res) => {
    try {
      const updated = await updateShowcaseItemRecord(
        req.params.itemId,
        req.body as Record<string, unknown>,
      );
      if (!updated) {
        return res.status(404).json({ error: "Showcase-element ikke funnet" });
      }
      res.json({ success: true, item: mapShowcaseItemRow(updated) });
    } catch (error) {
      console.error("Error updating showcase metadata:", error);
      res.status(500).json({ error: "Kunne ikke oppdatere metadata" });
    }
  });
}
