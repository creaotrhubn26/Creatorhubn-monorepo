/**
 * admin-room-marketing-catalog-routes.ts
 *
 * Business DNA — Catalog. Auto-populeres fra systemets vertikaler ved GET, og
 * admin kan legge til/fjerne/skru av. Samme admin-guard som øvrige admin-room-ruter.
 *
 *   GET    /api/admin-room/marketing-catalog            → { items }  (auto-seedet)
 *   POST   /api/admin-room/marketing-catalog            body { name, description?, imageUrl? }
 *   PATCH  /api/admin-room/marketing-catalog/:id        body { name?, description?, imageUrl?, active? }
 *   DELETE /api/admin-room/marketing-catalog/:id
 */

import type { AdminRoomRoutesDeps } from "./_shared.js";
import {
  createItem,
  deleteItem,
  listCatalog,
  updateItem,
} from "./marketing-catalog-service.js";

export function setupAdminMarketingCatalogRoutes(deps: AdminRoomRoutesDeps): void {
  const { app, pool, requireAdminRoomAccess, logAdminActivity } = deps;

  app.get("/api/admin-room/marketing-catalog", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      res.json({ items: await listCatalog(pool, session.userId) });
    } catch (err) {
      console.error("[marketing-catalog] list error", err);
      res.status(500).json({ error: "list_failed" });
    }
  });

  app.post("/api/admin-room/marketing-catalog", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const body = req.body ?? {};
    if (!body.name || typeof body.name !== "string") {
      return res.status(400).json({ error: "name_required" });
    }
    try {
      const item = await createItem(pool, session.userId, {
        name: body.name,
        description: typeof body.description === "string" ? body.description : undefined,
        imageUrl: typeof body.imageUrl === "string" ? body.imageUrl : undefined,
      });
      await logAdminActivity({
        userId: session.userId,
        entityType: "marketing_catalog_item",
        entityId: item.id,
        action: "created",
        summary: item.name,
      }).catch(() => {});
      res.status(201).json({ item });
    } catch (err) {
      console.error("[marketing-catalog] create error", err);
      res.status(500).json({ error: "create_failed" });
    }
  });

  app.patch("/api/admin-room/marketing-catalog/:id", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const body = req.body ?? {};
    try {
      const item = await updateItem(pool, session.userId, req.params.id, {
        name: typeof body.name === "string" ? body.name : undefined,
        description: typeof body.description === "string" ? body.description : undefined,
        imageUrl: typeof body.imageUrl === "string" ? body.imageUrl : undefined,
        active: typeof body.active === "boolean" ? body.active : undefined,
      });
      if (!item) return res.status(404).json({ error: "not_found" });
      res.json({ item });
    } catch (err) {
      console.error("[marketing-catalog] update error", err);
      res.status(500).json({ error: "update_failed" });
    }
  });

  app.delete("/api/admin-room/marketing-catalog/:id", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const deleted = await deleteItem(pool, session.userId, req.params.id);
      res.json({ deleted });
    } catch (err) {
      console.error("[marketing-catalog] delete error", err);
      res.status(500).json({ error: "delete_failed" });
    }
  });
}
