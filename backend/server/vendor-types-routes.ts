import express from "express";

export interface VendorTypesRoutesDeps {
  app: express.Application;
  fetchEvendiVendorCategories: () => Promise<any[]>;
  buildVendorTypePayload: (category: any) => any;
  resolveEvendiKey: (category: any) => string;
  evendiVendorOverrides: Map<string, any>;
  compatStoreSet: (
    key: string,
    value: Record<string, unknown>,
  ) => Promise<void>;
  dbCompatVendorOverrideKey: (typeId: string) => string;
  requireAdminSession: (req: any, res: any) => any;
}

export function setupVendorTypesRoutes(deps: VendorTypesRoutesDeps): void {
  const {
    app,
    fetchEvendiVendorCategories,
    buildVendorTypePayload,
    resolveEvendiKey,
    evendiVendorOverrides,
    compatStoreSet,
    dbCompatVendorOverrideKey,
    requireAdminSession,
  } = deps;

  app.get("/api/vendor-types", async (_req, res) => {
    try {
      const categories = await fetchEvendiVendorCategories();
      const sorted = [...categories].sort((a, b) => {
        const aOrder = a.sortOrder ?? 9999;
        const bOrder = b.sortOrder ?? 9999;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.name.localeCompare(b.name);
      });
      const vendorTypes = sorted.map(buildVendorTypePayload);
      res.json({
        vendorTypes,
        totalTypes: vendorTypes.length,
        coreTypes: vendorTypes,
        expandableTypes: [],
        categories: sorted.map((category: any) => category.name),
      });
    } catch (error) {
      console.error("[VendorTypes] Error:", error);
      res.status(502).json({
        vendorTypes: [],
        totalTypes: 0,
        coreTypes: [],
        expandableTypes: [],
        categories: [],
      });
    }
  });

  app.get("/api/vendor-types/expandable/available", (_req, res) => {
    res.json({ availableTypes: [], count: 0 });
  });

  app.post("/api/vendor-types/enable/:id", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const categories = await fetchEvendiVendorCategories();
      const typeId = req.params.id;
      const match = categories.find(
        (category: any) => resolveEvendiKey(category) === typeId,
      );
      if (!match) {
        return res.status(404).json({ error: "Vendor type ikke funnet" });
      }
      return res.json({ config: buildVendorTypePayload(match) });
    } catch (error) {
      console.error("[VendorTypesEnable] Error:", error);
      res.status(502).json({ error: "Kunne ikke aktivere vendor type" });
    }
  });

  app.put("/api/vendor-types/:id", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const typeId = req.params.id;
      const updates = req.body as any;
      const overrides = evendiVendorOverrides.get(typeId) || {};
      if (Array.isArray(updates.productCategories)) {
        overrides.productCategories = updates.productCategories;
        evendiVendorOverrides.set(typeId, overrides);
        await compatStoreSet(dbCompatVendorOverrideKey(typeId), overrides);
      }
      const baseCategory: any = {
        id: typeId,
        name: updates.name || typeId,
        slug: typeId,
        dashboardKey: typeId,
      };
      const payload = buildVendorTypePayload(baseCategory);
      payload.name = updates.name || payload.name;
      payload.color = updates.color || payload.color;
      payload.productCategories =
        overrides.productCategories || payload.productCategories;
      res.json(payload);
    } catch (error) {
      console.error("[VendorTypesUpdate] Error:", error);
      res.status(500).json({ error: "Kunne ikke oppdatere vendor type" });
    }
  });

  app.post("/api/vendor-types/:id/categories", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    const typeId = req.params.id;
    const category = req.body as any;
    const overrides = evendiVendorOverrides.get(typeId) || {
      productCategories: [],
    };
    const existing = overrides.productCategories || [];
    overrides.productCategories = [...existing, category];
    evendiVendorOverrides.set(typeId, overrides);
    await compatStoreSet(dbCompatVendorOverrideKey(typeId), overrides);
    res.json({ categories: overrides.productCategories });
  });

  app.put(
    "/api/vendor-types/:id/categories/:categoryId",
    async (req, res) => {
      if (!requireAdminSession(req, res)) return;
      const typeId = req.params.id;
      const categoryId = req.params.categoryId;
      const updates = req.body as any;
      const overrides = evendiVendorOverrides.get(typeId) || {
        productCategories: [],
      };
      const categories = overrides.productCategories || [];
      const updated = categories.map((category: any) =>
        category.id === categoryId
          ? { ...category, ...updates, id: updates.id || category.id }
          : category,
      );
      overrides.productCategories = updated;
      evendiVendorOverrides.set(typeId, overrides);
      await compatStoreSet(dbCompatVendorOverrideKey(typeId), overrides);
      res.json({ categories: updated, affectedProducts: 0 });
    },
  );

  app.delete(
    "/api/vendor-types/:id/categories/:categoryId",
    async (req, res) => {
      if (!requireAdminSession(req, res)) return;
      const typeId = req.params.id;
      const categoryId = req.params.categoryId;
      const { replacementCategory } = req.body as {
        replacementCategory?: string;
      };
      const overrides = evendiVendorOverrides.get(typeId) || {
        productCategories: [],
      };
      const categories = overrides.productCategories || [];
      const updated = categories.filter(
        (category: any) => category.id !== categoryId,
      );
      overrides.productCategories = updated;
      evendiVendorOverrides.set(typeId, overrides);
      await compatStoreSet(dbCompatVendorOverrideKey(typeId), overrides);
      res.json({
        categories: updated,
        affectedProducts: 0,
        replacementCategory: replacementCategory || null,
      });
    },
  );
}
