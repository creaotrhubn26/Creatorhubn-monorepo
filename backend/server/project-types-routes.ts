import express from "express";
import { readString } from "./_shared";

export interface ProjectTypesRoutesDeps {
  app: express.Application;
  requireUserSession: (req: any, res: any) => any;
  compatResolveUserId: (req: express.Request) => string;
  getCompatDefaultProjectTypes: () => any[];
  getCompatUserProjectTypes: (userId: string) => Promise<any[]>;
  compatProjectTypesStore: Map<string, any[]>;
  compatStoreSet: (key: string, value: any[]) => Promise<void>;
  dbCompatProjectTypesKey: (userId: string) => string;
}

export function setupProjectTypesRoutes(
  deps: ProjectTypesRoutesDeps,
): void {
  const {
    app,
    requireUserSession,
    compatResolveUserId,
    getCompatDefaultProjectTypes,
    getCompatUserProjectTypes,
    compatProjectTypesStore,
    compatStoreSet,
    dbCompatProjectTypesKey,
  } = deps;

  app.get("/api/project-types", async (req, res) => {
    const userId = compatResolveUserId(req);
    const defaultTypes = getCompatDefaultProjectTypes();
    const userTypes = await getCompatUserProjectTypes(userId);
    const trendingTypes = [...defaultTypes, ...userTypes]
      .filter((type) => type.isTrending || type.usageCount > 1)
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 6);
    res.json({ userTypes, defaultTypes, trendingTypes });
  });

  app.post("/api/project-types", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    const userId = compatResolveUserId(req);
    const userTypes = await getCompatUserProjectTypes(userId);
    const now = new Date().toISOString();
    const nextId =
      userTypes.length > 0
        ? Math.max(...userTypes.map((t: any) => t.id)) + 1
        : 2001;
    const next = {
      id: nextId,
      userId: Number.isFinite(Number(userId)) ? Number(userId) : 0,
      name: readString(req.body?.name) || "Untitled",
      icon: readString(req.body?.icon) || "📁",
      category: readString(req.body?.category) || "general",
      description: readString(req.body?.description) || "",
      usageCount: 0,
      isGlobal: false,
      isTrending: false,
      createdAt: now,
      updatedAt: now,
    };
    userTypes.push(next);
    compatProjectTypesStore.set(userId, userTypes);
    await compatStoreSet(dbCompatProjectTypesKey(userId), userTypes);
    res.status(201).json(next);
  });

  app.put("/api/project-types/:id", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    const userId = compatResolveUserId(req);
    const id = Number(req.params.id);
    const userTypes = await getCompatUserProjectTypes(userId);
    const index = userTypes.findIndex((type: any) => type.id === id);
    if (index < 0) {
      return res.status(404).json({ error: "Project type not found" });
    }
    const updated = {
      ...userTypes[index],
      ...(req.body || {}),
      updatedAt: new Date().toISOString(),
    };
    userTypes[index] = updated;
    compatProjectTypesStore.set(userId, userTypes);
    await compatStoreSet(dbCompatProjectTypesKey(userId), userTypes);
    res.json(updated);
  });

  app.delete("/api/project-types/:id", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    const userId = compatResolveUserId(req);
    const id = Number(req.params.id);
    const userTypes = await getCompatUserProjectTypes(userId);
    const next = userTypes.filter((type: any) => type.id !== id);
    compatProjectTypesStore.set(userId, next);
    await compatStoreSet(dbCompatProjectTypesKey(userId), next);
    res.json({ success: true });
  });

  app.post("/api/project-types/:id/use", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    const userId = compatResolveUserId(req);
    const id = Number(req.params.id);
    const userTypes = await getCompatUserProjectTypes(userId);
    const index = userTypes.findIndex((type: any) => type.id === id);
    if (index >= 0) {
      userTypes[index] = {
        ...userTypes[index],
        usageCount: (userTypes[index].usageCount || 0) + 1,
        updatedAt: new Date().toISOString(),
      };
      compatProjectTypesStore.set(userId, userTypes);
      await compatStoreSet(dbCompatProjectTypesKey(userId), userTypes);
    }
    res.json({ success: true });
  });
}
