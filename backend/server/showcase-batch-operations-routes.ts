/**
 * showcase-batch-operations-routes.ts
 *
 * Setup-funksjon for /api/showcase/batch-operations endpoints —
 * masseoperasjoner på showcase-items med undo-støtte.
 *
 * 2 endpoints:
 *   - POST /batch-operations         (delete | archive | publish | unpublish |
 *                                     feature | unfeature | bulk-photo-enhance)
 *   - POST /batch-operations/undo    (gjenopprett siste batch-operasjon)
 *
 * Undo-state lagres i compat-store under nøkkelen produsert av
 * `showcaseBatchUndoKey(userId)` — én slot per bruker.
 *
 * Auth: åpen — userId fra payload/header.
 *
 * Wire opp i backend/server/index.ts ved å legge til:
 *
 *   import { setupShowcaseBatchOperationsRoutes } from "./showcase-batch-operations-routes";
 *
 *   setupShowcaseBatchOperationsRoutes({
 *     app, pool,
 *     compatStoreGet, compatStoreSet, compatStoreDelete,
 *     updateShowcaseItemRecord, createShowcaseItemRecord,
 *     showcaseBatchUndoKey,
 *   });
 *
 * Mode-noter: ingen mode-branching.
 */

import type express from "express";
import type { Pool } from "pg";
import crypto from "crypto";

import {
  readString,
  readStringArray,
  normalizeJsonObjectField,
} from "./_shared";

interface ShowcaseBatchUndoState {
  id: string;
  type: string;
  items: Array<Record<string, unknown>>;
  createdAt: string;
}

export interface ShowcaseBatchOperationsRoutesDeps {
  app: express.Application;
  requireUserSession: (req: any, res: any) => any;
  pool: Pool;
  compatStoreGet: <T>(storeKey: string) => Promise<T | null>;
  compatStoreSet: (storeKey: string, value: unknown) => Promise<void>;
  compatStoreDelete: (storeKey: string) => Promise<void>;
  updateShowcaseItemRecord: (
    itemId: string,
    payload: Record<string, unknown>,
  ) => Promise<Record<string, unknown> | null>;
  createShowcaseItemRecord: (
    payload: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
  showcaseBatchUndoKey: (userId: string) => string;
}

export function setupShowcaseBatchOperationsRoutes(
  deps: ShowcaseBatchOperationsRoutesDeps,
): void {
  const {
    app,
    requireUserSession,
    pool,
    compatStoreGet,
    compatStoreSet,
    compatStoreDelete,
    updateShowcaseItemRecord,
    createShowcaseItemRecord,
    showcaseBatchUndoKey,
  } = deps;

  app.post("/api/showcase/batch-operations", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const payload = req.body as Record<string, unknown>;
      const operation = readString(payload.operation) || "";
      const itemIds = readStringArray(payload.itemIds);
      const userId =
        readString(payload.userId) ||
        readString(req.headers["x-user-id"]) ||
        "system";
      if (!itemIds.length) {
        return res.status(400).json({ error: "Ingen items valgt" });
      }

      const snapshot = await pool.query(
        `SELECT * FROM showcase_items WHERE id = ANY($1)`,
        [itemIds],
      );
      const undoState: ShowcaseBatchUndoState = {
        id: crypto.randomUUID(),
        type: operation,
        items: snapshot.rows as Array<Record<string, unknown>>,
        createdAt: new Date().toISOString(),
      };
      await compatStoreSet(showcaseBatchUndoKey(userId), undoState);

      if (operation === "delete") {
        await pool.query(`DELETE FROM showcase_items WHERE id = ANY($1)`, [itemIds]);
        return res.json({ success: true, deletedCount: itemIds.length });
      }

      if (
        operation === "archive" ||
        operation === "publish" ||
        operation === "unpublish" ||
        operation === "feature" ||
        operation === "unfeature"
      ) {
        const setClauses: string[] = ["updated_at = NOW()"];
        const values: unknown[] = [];

        if (operation === "archive") {
          setClauses.push("is_active = false");
        }
        if (operation === "publish") {
          setClauses.push("is_public = true");
        }
        if (operation === "unpublish") {
          setClauses.push("is_public = false");
        }
        if (operation === "feature") {
          setClauses.push("is_featured = true");
        }
        if (operation === "unfeature") {
          setClauses.push("is_featured = false");
        }

        values.push(itemIds);
        await pool.query(
          `UPDATE showcase_items
              SET ${setClauses.join(", ")}
            WHERE id = ANY($1)`,
          values,
        );
        return res.json({ success: true, updatedCount: itemIds.length });
      }

      if (operation === "bulk-photo-enhance") {
        const enhancementOptions =
          normalizeJsonObjectField(payload.enhancementOptions) || {};
        for (const itemId of itemIds) {
          await updateShowcaseItemRecord(itemId, {
            transformations: {
              enhancedAt: new Date().toISOString(),
              enhancementOptions,
              preset: readString(payload.preset) || "custom",
            },
          });
        }
        return res.json({
          success: true,
          enhancedCount: itemIds.length,
          totalItems: itemIds.length,
        });
      }

      res.json({ success: true, processedCount: itemIds.length });
    } catch (error) {
      console.error("Error running showcase batch operation:", error);
      res.status(500).json({ error: "Kunne ikke kjore batch-operasjon" });
    }
  });

  app.post("/api/showcase/batch-operations/undo", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const userId =
        readString(req.body?.userId) ||
        readString(req.headers["x-user-id"]) ||
        "system";
      const undoState = await compatStoreGet<ShowcaseBatchUndoState>(
        showcaseBatchUndoKey(userId),
      );

      if (!undoState) {
        return res.status(404).json({ error: "Ingen batch-operasjon a angre" });
      }

      if (undoState.type === "delete") {
        for (const item of undoState.items) {
          const existing = await pool.query(
            `SELECT id FROM showcase_items WHERE id = $1 LIMIT 1`,
            [item.id],
          );
          if (!existing.rows.length) {
            await createShowcaseItemRecord(item);
          }
        }
      } else {
        for (const item of undoState.items) {
          await updateShowcaseItemRecord(String(item.id), item);
        }
      }

      await compatStoreDelete(showcaseBatchUndoKey(userId));
      res.json({ success: true, restoredCount: undoState.items.length });
    } catch (error) {
      console.error("Error undoing showcase batch operation:", error);
      res.status(500).json({ error: "Kunne ikke angre batch-operasjon" });
    }
  });
}
