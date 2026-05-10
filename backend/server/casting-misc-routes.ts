/**
 * casting-misc-routes.ts
 *
 * Setup-funksjon for trivielle/misc-endpoints under /api/casting/* —
 * health-check, favorites-store og demo-stubs.
 *
 * 7 endpoints:
 *   GET    /health                                      — status-check (stub)
 *   GET    /favorites/:projectId/:favoriteType          — list favorites
 *   POST   /favorites/:projectId/:favoriteType          — replace list
 *   POST   /favorites/:projectId/:favoriteType/add      — append one
 *   POST   /favorites/:projectId/:favoriteType/remove   — remove one
 *   POST   /demo/troll/offers-contracts                 — demo-seed stub
 *   GET    /demo/troll/offers-contracts                 — demo-list stub
 *
 * Tilgang: ÅPEN (matcher eksisterende oppførsel).
 *
 * State: Eier `legacyFavoritesStore` Map + key-generator-funksjoner
 * internt. Maps brukes ikke utenfor favorites-endpointene (verifisert via
 * grep). NB: Casting-projects DELETE-handler (i index.ts) rydder DB-state
 * for favorites via prefix-delete på "casting:favorites:..." — det
 * fortsetter å virke uavhengig av denne modulen. Den in-memory Map kan
 * få stale entries ved prosjekt-DELETE, men det er eksisterende oppførsel.
 *
 * Wire opp i backend/server/index.ts:
 *
 *   import { setupCastingMiscRoutes } from "./casting-misc-routes";
 *
 *   setupCastingMiscRoutes({
 *     app,
 *     compatStoreGet,
 *     compatStoreSet,
 *   });
 */

import type express from "express";

export interface CastingMiscRoutesDeps {
  app: express.Application;
  compatStoreGet: <T>(storeKey: string) => Promise<T | null>;
  compatStoreSet: (storeKey: string, storeValue: unknown) => Promise<void>;
}

export function setupCastingMiscRoutes(deps: CastingMiscRoutesDeps): void {
  const { app, compatStoreGet, compatStoreSet } = deps;

  const legacyFavoritesStore = new Map<string, string[]>();

  function legacyFavoritesKey(projectId: string, favoriteType: string): string {
    return `${projectId}::${favoriteType}`;
  }

  function dbLegacyFavoritesKey(
    projectId: string,
    favoriteType: string,
  ): string {
    return `casting:favorites:${legacyFavoritesKey(projectId, favoriteType)}`;
  }

  // ── Health ─────────────────────────────────────────────────────────

  app.get("/api/casting/health", (_req, res) => {
    res.json({ status: "healthy", mode: "local-dev" });
  });

  // ── Favorites (legacy compatibility for Role/Candidate panels) ────

  app.get("/api/casting/favorites/:projectId/:favoriteType", async (req, res) => {
    const { projectId, favoriteType } = req.params;
    const key = legacyFavoritesKey(projectId, favoriteType);
    const dbFavorites = await compatStoreGet<string[]>(
      dbLegacyFavoritesKey(projectId, favoriteType),
    );
    if (Array.isArray(dbFavorites)) {
      legacyFavoritesStore.set(key, dbFavorites);
      res.json({ favorites: dbFavorites });
      return;
    }
    res.json({ favorites: legacyFavoritesStore.get(key) || [] });
  });

  app.post(
    "/api/casting/favorites/:projectId/:favoriteType",
    async (req, res) => {
      const { projectId, favoriteType } = req.params;
      const itemIds = Array.isArray(req.body?.itemIds)
        ? req.body.itemIds.filter((id: unknown) => typeof id === "string")
        : [];
      legacyFavoritesStore.set(
        legacyFavoritesKey(projectId, favoriteType),
        itemIds as string[],
      );
      await compatStoreSet(
        dbLegacyFavoritesKey(projectId, favoriteType),
        itemIds,
      );
      res.json({ ok: true, favorites: itemIds });
    },
  );

  app.post(
    "/api/casting/favorites/:projectId/:favoriteType/add",
    async (req, res) => {
      const { projectId, favoriteType } = req.params;
      const itemId = typeof req.body?.itemId === "string" ? req.body.itemId : "";
      if (!itemId) {
        res.status(400).json({ error: "itemId is required" });
        return;
      }
      const key = legacyFavoritesKey(projectId, favoriteType);
      const dbFavorites = await compatStoreGet<string[]>(
        dbLegacyFavoritesKey(projectId, favoriteType),
      );
      const source = Array.isArray(dbFavorites)
        ? dbFavorites
        : legacyFavoritesStore.get(key) || [];
      const current = new Set(source);
      current.add(itemId);
      const updated = Array.from(current);
      legacyFavoritesStore.set(key, updated);
      await compatStoreSet(
        dbLegacyFavoritesKey(projectId, favoriteType),
        updated,
      );
      res.json({ ok: true, favorites: updated });
    },
  );

  app.post(
    "/api/casting/favorites/:projectId/:favoriteType/remove",
    async (req, res) => {
      const { projectId, favoriteType } = req.params;
      const itemId = typeof req.body?.itemId === "string" ? req.body.itemId : "";
      if (!itemId) {
        res.status(400).json({ error: "itemId is required" });
        return;
      }
      const key = legacyFavoritesKey(projectId, favoriteType);
      const dbFavorites = await compatStoreGet<string[]>(
        dbLegacyFavoritesKey(projectId, favoriteType),
      );
      const source = Array.isArray(dbFavorites)
        ? dbFavorites
        : legacyFavoritesStore.get(key) || [];
      const updated = source.filter((id) => id !== itemId);
      legacyFavoritesStore.set(key, updated);
      await compatStoreSet(
        dbLegacyFavoritesKey(projectId, favoriteType),
        updated,
      );
      res.json({ ok: true, favorites: updated });
    },
  );

  // ── Demo / TROLL stubs ─────────────────────────────────────────────

  app.post("/api/casting/demo/troll/offers-contracts", (_req, res) => {
    res.json({ success: true, created: 0 });
  });

  app.get("/api/casting/demo/troll/offers-contracts", (_req, res) => {
    res.json({ success: true, offers: [], contracts: [] });
  });
}
