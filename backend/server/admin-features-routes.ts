/**
 * admin-features-routes.ts
 *
 * Setup-funksjon for /api/admin/features/* — feature-toggle CRUD for
 * platform-wide AB-tests, gradual-rollouts og admin-paneler.
 *
 * 6 endpoints:
 *   GET    /api/admin/features                              — list
 *   PATCH  /api/admin/features/:featureId                   — update én
 *   POST   /api/admin/features/:featureId/toggle            — toggle isEnabled
 *   POST   /api/admin/features/category/:category/toggle    — bulk-toggle category
 *   POST   /api/admin/features/bulk-update                  — batch updates
 *   POST   /api/admin/features/initialize                   — seed defaults hvis empty
 *
 * **Tilgang:** ÅPEN per nå (matcher eksisterende oppførsel — alle 6
 * endpoints manglet requireAdminSession i index.ts). KJENT SIKKERHETS-
 * GAP — bør lukkes i egen security-commit etter denne ekstraksjonen.
 *
 * Service-state: `compatAdminFeaturesStore` Map er DELT — passes via
 * deps fra index.ts. Helpers `getCompatAdminFeature` og
 * `isCompatAdminFeatureEnabled` brukes også av role-room-routes-moduler
 * (feature-gating), så Map kan IKKE lukkes inn i denne modulen.
 *
 * Wire opp i backend/server/index.ts:
 *
 *   import { setupAdminFeaturesRoutes } from "./admin-features-routes";
 *
 *   setupAdminFeaturesRoutes({
 *     app,
 *     ensureCompatAdminFeatures,
 *     compatAdminFeaturesStore,
 *     compatStoreSet,
 *     dbCompatAdminFeatureKey,
 *     compatResolveUserId,
 *     isRecord,
 *   });
 */

import type express from "express";

import { readString } from "./_shared";

export interface CompatAdminFeature {
  id: string;
  name: string;
  description: string;
  category: string;
  isEnabled: boolean;
  enabled: boolean;
  configurable: boolean;
  usageCount: number;
  lastModified: string;
  modifiedBy: string;
  impact: "low" | "medium" | "high" | "critical";
  rolloutPercentage: number;
  environment: "staging" | "production";
  publishedAt: string;
  publishedBy: string;
  version: number;
  metadata: Record<string, unknown>;
}

export interface AdminFeaturesRoutesDeps {
  app: express.Application;
  ensureCompatAdminFeatures: () => CompatAdminFeature[];
  compatAdminFeaturesStore: Map<string, CompatAdminFeature>;
  compatStoreSet: (storeKey: string, storeValue: unknown) => Promise<void>;
  dbCompatAdminFeatureKey: (featureId: string) => string;
  compatResolveUserId: (req: express.Request) => string;
  isRecord: (value: unknown) => value is Record<string, unknown>;
}

export function setupAdminFeaturesRoutes(
  deps: AdminFeaturesRoutesDeps,
): void {
  const {
    app,
    ensureCompatAdminFeatures,
    compatAdminFeaturesStore,
    compatStoreSet,
    dbCompatAdminFeatureKey,
    compatResolveUserId,
    isRecord,
  } = deps;

  app.get("/api/admin/features", (_req, res) => {
    const features = ensureCompatAdminFeatures();
    res.json(features);
  });

  app.patch("/api/admin/features/:featureId", (req, res) => {
    ensureCompatAdminFeatures();
    const featureId = req.params.featureId;
    const existing = compatAdminFeaturesStore.get(featureId);
    if (!existing) {
      return res.status(404).json({ success: false, error: "Feature not found" });
    }

    const now = new Date().toISOString();
    const updates = (
      req.body && typeof req.body === "object"
        ? (req.body as Record<string, unknown>)
        : {}
    ) as Record<string, unknown>;

    const nextEnabled =
      typeof updates.isEnabled === "boolean"
        ? updates.isEnabled
        : typeof updates.enabled === "boolean"
          ? updates.enabled
          : existing.isEnabled;

    const updated: CompatAdminFeature = {
      ...existing,
      ...updates,
      isEnabled: nextEnabled,
      enabled: nextEnabled,
      lastModified: now,
      modifiedBy: compatResolveUserId(req),
      version: existing.version + 1,
      metadata: isRecord(updates.metadata) ? updates.metadata : existing.metadata,
    };

    compatAdminFeaturesStore.set(featureId, updated);
    void compatStoreSet(dbCompatAdminFeatureKey(featureId), updated);
    res.json(updated);
  });

  app.post("/api/admin/features/:featureId/toggle", (req, res) => {
    ensureCompatAdminFeatures();
    const featureId = req.params.featureId;
    const existing = compatAdminFeaturesStore.get(featureId);
    if (!existing) {
      return res.status(404).json({ success: false, error: "Feature not found" });
    }

    const now = new Date().toISOString();
    const toggled: CompatAdminFeature = {
      ...existing,
      isEnabled: !existing.isEnabled,
      enabled: !existing.enabled,
      lastModified: now,
      modifiedBy: compatResolveUserId(req),
      version: existing.version + 1,
    };
    compatAdminFeaturesStore.set(featureId, toggled);
    void compatStoreSet(dbCompatAdminFeatureKey(featureId), toggled);
    res.json({ success: true, feature: toggled });
  });

  app.post("/api/admin/features/category/:category/toggle", (req, res) => {
    const category = req.params.category;
    const enable =
      typeof req.body?.enabled === "boolean" ? req.body.enabled : undefined;
    const now = new Date().toISOString();
    const modifiedBy = compatResolveUserId(req);

    const updated = ensureCompatAdminFeatures()
      .filter((feature) => feature.category === category)
      .map((feature) => {
        const isEnabled =
          typeof enable === "boolean" ? enable : !feature.isEnabled;
        const nextFeature: CompatAdminFeature = {
          ...feature,
          isEnabled,
          enabled: isEnabled,
          lastModified: now,
          modifiedBy,
          version: feature.version + 1,
        };
        compatAdminFeaturesStore.set(nextFeature.id, nextFeature);
        void compatStoreSet(dbCompatAdminFeatureKey(nextFeature.id), nextFeature);
        return nextFeature;
      });

    res.json({ success: true, updatedCount: updated.length, features: updated });
  });

  app.post("/api/admin/features/bulk-update", (req, res) => {
    ensureCompatAdminFeatures();
    const updates = Array.isArray(req.body?.updates) ? req.body.updates : [];
    const now = new Date().toISOString();
    const modifiedBy = compatResolveUserId(req);
    const changed: CompatAdminFeature[] = [];

    updates.forEach((entry: unknown) => {
      if (!entry || typeof entry !== "object") {
        return;
      }
      const id = readString((entry as Record<string, unknown>).id);
      const partial = (entry as Record<string, unknown>).updates;
      if (!id || !isRecord(partial)) {
        return;
      }

      const current = compatAdminFeaturesStore.get(id);
      if (!current) {
        return;
      }

      const nextEnabled =
        typeof partial.isEnabled === "boolean"
          ? partial.isEnabled
          : typeof partial.enabled === "boolean"
            ? partial.enabled
            : current.isEnabled;

      const next: CompatAdminFeature = {
        ...current,
        ...partial,
        isEnabled: nextEnabled,
        enabled: nextEnabled,
        lastModified: now,
        modifiedBy,
        version: current.version + 1,
        metadata: isRecord(partial.metadata)
          ? partial.metadata
          : current.metadata,
      };
      compatAdminFeaturesStore.set(id, next);
      void compatStoreSet(dbCompatAdminFeatureKey(id), next);
      changed.push(next);
    });

    res.json({ success: true, updated: changed.length, features: changed });
  });

  app.post("/api/admin/features/initialize", (_req, res) => {
    const features = ensureCompatAdminFeatures();
    res.json({ success: true, features, initialized: features.length });
  });
}
