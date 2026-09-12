import express from "express";

export interface LegacySettingEntry {
  userId: string;
  projectId?: string;
  namespace: string;
  data: unknown;
}

export interface SettingsRoutesDeps {
  app: express.Application;
  requireUserSession: (req: any, res: any) => any;
  /**
   * Passiv sesjons-oppslag (svarer IKKE med 401). Brukes for å binde
   * settings-nøkkelen til den innloggede brukeren i stedet for en
   * klient-oppgitt `user_id`, som ellers lot enhver innlogget bruker
   * lese/skrive/slette en annen brukers innstillinger (IDOR / over-posting).
   */
  getActiveSessionFromRequest?: (req: any) => { userId?: string } | null | undefined;
  readQueryString: (value: unknown, fallback: string) => string;
  legacySettingsStore: Map<string, LegacySettingEntry>;
  legacySettingKey: (
    userId: string,
    namespace: string,
    projectId?: string,
  ) => string;
  dbLegacySettingKey: (
    userId: string,
    namespace: string,
    projectId?: string,
  ) => string;
  compatStoreGet: <T>(key: string) => Promise<T | null>;
  compatStoreSet: (key: string, value: unknown) => Promise<void>;
  compatStoreDelete: (key: string) => Promise<void>;
  compatStoreListByPrefix: <T>(
    prefix: string,
  ) => Promise<Array<{ key: string; value: T }>>;
}

export function setupSettingsRoutes(deps: SettingsRoutesDeps): void {
  const {
    app,
    requireUserSession,
    getActiveSessionFromRequest,
    readQueryString,
    legacySettingsStore,
    legacySettingKey,
    dbLegacySettingKey,
    compatStoreGet,
    compatStoreSet,
    compatStoreDelete,
    compatStoreListByPrefix,
  } = deps;

  // Bind alltid innstillings-nøkkelen til den innloggede brukeren når en
  // sesjon finnes; fall bare tilbake til klient-oppgitt id for uinnlogget
  // legacy-trafikk (default-user-bøtta). Dette hindrer at bruker A leser/
  // skriver/sletter bruker B sine innstillinger ved å oppgi `user_id=B`.
  const resolveSettingsUserId = (req: any, clientSupplied: unknown): string => {
    const sessionUserId = getActiveSessionFromRequest?.(req)?.userId;
    if (sessionUserId) return sessionUserId;
    return readQueryString(clientSupplied, "default-user");
  };

  app.get("/api/settings", async (req, res) => {
    const userId = resolveSettingsUserId(req, req.query.user_id);
    const namespace = readQueryString(req.query.namespace, "");
    const projectId =
      typeof req.query.project_id === "string"
        ? req.query.project_id
        : undefined;

    if (!namespace) {
      res.status(400).json({ error: "namespace is required" });
      return;
    }

    const legacyKey = legacySettingKey(userId, namespace, projectId);
    const dbKey = dbLegacySettingKey(userId, namespace, projectId);
    const dbEntry = await compatStoreGet<LegacySettingEntry>(dbKey);
    if (dbEntry) {
      legacySettingsStore.set(legacyKey, dbEntry);
      res.json({ data: dbEntry.data ?? null });
      return;
    }

    const entry = legacySettingsStore.get(legacyKey);
    res.json({ data: entry?.data ?? null });
  });

  app.put("/api/settings", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    const userId = resolveSettingsUserId(
      req,
      req.body?.userId ?? req.body?.user_id,
    );
    const namespace = readQueryString(req.body?.namespace, "");
    const projectId =
      typeof req.body?.projectId === "string"
        ? req.body.projectId
        : typeof req.body?.project_id === "string"
          ? req.body.project_id
          : undefined;

    if (!namespace) {
      res.status(400).json({ error: "namespace is required" });
      return;
    }

    const entry: LegacySettingEntry = {
      userId,
      projectId,
      namespace,
      data: req.body?.data ?? null,
    };
    const legacyKey = legacySettingKey(userId, namespace, projectId);
    legacySettingsStore.set(legacyKey, entry);
    await compatStoreSet(
      dbLegacySettingKey(userId, namespace, projectId),
      entry,
    );
    res.json({ ok: true });
  });

  app.delete("/api/settings", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    const userId = resolveSettingsUserId(req, req.query.user_id);
    const namespace = readQueryString(req.query.namespace, "");
    const projectId =
      typeof req.query.project_id === "string"
        ? req.query.project_id
        : undefined;

    if (!namespace) {
      res.status(400).json({ error: "namespace is required" });
      return;
    }

    const legacyKey = legacySettingKey(userId, namespace, projectId);
    legacySettingsStore.delete(legacyKey);
    await compatStoreDelete(
      dbLegacySettingKey(userId, namespace, projectId),
    );
    res.json({ ok: true });
  });

  app.get("/api/settings/list", async (req, res) => {
    const userId = resolveSettingsUserId(req, req.query.user_id);
    const namespacePrefix = readQueryString(req.query.namespace_prefix, "");
    const hasProjectIdFilter = typeof req.query.project_id === "string";
    const projectId = hasProjectIdFilter
      ? (req.query.project_id as string)
      : undefined;

    const dbRows = await compatStoreListByPrefix<LegacySettingEntry>(
      "settings:",
    );
    for (const row of dbRows) {
      const entry = row.value;
      if (!entry || typeof entry !== "object") continue;
      if (
        typeof entry.userId !== "string" ||
        typeof entry.namespace !== "string"
      )
        continue;
      const legacyKey = legacySettingKey(
        entry.userId,
        entry.namespace,
        entry.projectId,
      );
      legacySettingsStore.set(legacyKey, entry);
    }

    const entries = Array.from(legacySettingsStore.values()).filter(
      (entry) => {
        if (entry.userId !== userId) return false;
        if (
          hasProjectIdFilter &&
          (entry.projectId || "") !== (projectId || "")
        )
          return false;
        return (
          !namespacePrefix || entry.namespace.startsWith(namespacePrefix)
        );
      },
    );

    res.json({ entries });
  });
}
