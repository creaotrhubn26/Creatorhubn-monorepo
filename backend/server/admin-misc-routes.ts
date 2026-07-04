import express from "express";
import type { Pool } from "pg";
import crypto from "crypto";
import {
  CANONICAL_PROFESSIONS,
  normalizeProfession,
  getProfessionIconColor,
} from "../../frontend/shared/profession-types.ts";

export interface AdminMiscRoutesDeps {
  app: express.Application;
  requireUserSession: (req: any, res: any) => any;
  requireAdminSession: (req: any, res: any) => any;
  pool: Pool;
  isEvendiSmokeAuthorized: (req: any) => boolean;
  runEvendiSmoke: (...args: any[]) => Promise<any>;
  compatResolveUserId: (req: any) => string;
  compatStoreSet: (key: string, value: unknown) => Promise<void>;
  dbCompatAdminInteractionKey: (logId: string) => string;
  compatAdminInteractionLog: Array<Record<string, unknown>>;
}

export function setupAdminMiscRoutes(deps: AdminMiscRoutesDeps): void {
  const {
    app,
    requireUserSession,
    requireAdminSession,
    pool,
    isEvendiSmokeAuthorized,
    runEvendiSmoke,
    compatResolveUserId,
    compatStoreSet,
    dbCompatAdminInteractionKey,
    compatAdminInteractionLog,
  } = deps;

  app.get("/api/admin/gdpr-settings", (req, res) => {
    if (!requireAdminSession(req, res)) return;
    res.json({
      cookieConsentEnabled: false,
      dataRetentionDays: 365,
      gdprEnabled: true,
    });
  });

  // ─────────── Profesjonstyper — kanonisk baseline (kode) + DB-utvidelser ───────────
  // Kilde til sannhet: CANONICAL_PROFESSIONS (frontend/shared/profession-types.ts)
  // som runtime-baseline, merget med profession_types-tabellen (admin kan legge
  // til/overstyre/deaktivere). DB-rader vinner over baseline på samme navn.
  const CANONICAL_CATEGORY: Record<string, string> = Object.fromEntries(
    CANONICAL_PROFESSIONS.map((p) => [p.name, p.category]),
  );
  const professionRowToDto = (r: any) => ({
    id: r.name,
    uuid: r.id || null,
    name: r.name,
    displayName: r.display_name,
    description: r.description || null,
    iconColor: r.icon_color || getProfessionIconColor(r.name),
    category: CANONICAL_CATEGORY[r.name] || null,
    isActive: !!r.is_active,
    enabled: !!r.is_active, // bakoverkompatibelt felt-navn
    sortOrder: r.sort_order ?? 0,
  });
  const canonicalToDto = (p: (typeof CANONICAL_PROFESSIONS)[number]) => ({
    id: p.name,
    uuid: null,
    name: p.name,
    displayName: p.displayName,
    description: null,
    iconColor: p.iconColor,
    category: p.category,
    isActive: p.isActive,
    enabled: p.isActive,
    sortOrder: p.sortOrder,
  });
  const listProfessions = async (includeInactive: boolean) => {
    const merged = new Map<string, any>(
      CANONICAL_PROFESSIONS.map((p) => [p.name, canonicalToDto(p)]),
    );
    try {
      const result = await pool.query(
        "SELECT id, name, display_name, description, icon_color, is_active, sort_order FROM profession_types ORDER BY sort_order",
      );
      for (const r of result.rows) {
        const name = normalizeProfession(r.name);
        merged.set(name, professionRowToDto({ ...r, name }));
      }
    } catch (err) {
      console.warn("profession_types DB read failed, using canonical baseline:", (err as any).message);
    }
    return [...merged.values()]
      .filter((p) => includeInactive || p.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  };

  app.get("/api/admin/profession-types", async (req, res) => {
    // GET er åpen for autentiserte brukere — profesjons-listen brukes av
    // useDynamicProfessions/useProfessionTabs i vanlig dashboard for å
    // bestemme profesjons-spesifikke UI-faner. Mutasjonene under er admin-gated.
    if (!requireUserSession(req, res)) return;
    const includeInactive = String(req.query.includeInactive || "") === "1";
    res.json({ professions: await listProfessions(includeInactive) });
  });

  app.get("/api/admin/profession-types/:id", async (req, res, next) => {
    if (req.params.id === "templates") return next(); // håndteres i admin-customers-routes
    if (!requireUserSession(req, res)) return;
    const name = normalizeProfession(req.params.id);
    const found = (await listProfessions(true)).find((p) => p.name === name || p.uuid === req.params.id);
    if (!found) return res.status(404).json({ error: "not_found" });
    res.json(found);
  });

  // Upsert-kjerne for mutasjonene: profession_types har UNIQUE(name).
  const upsertProfession = async (name: string, fields: { displayName?: string; description?: string | null; iconColor?: string; sortOrder?: number; isActive?: boolean }) => {
    const canonicalDefaults = CANONICAL_PROFESSIONS.find((p) => p.name === name);
    const displayName = fields.displayName || canonicalDefaults?.displayName || name;
    const iconColor = fields.iconColor || canonicalDefaults?.iconColor || "#ff8c00";
    const sortOrder = fields.sortOrder ?? canonicalDefaults?.sortOrder ?? 99;
    const isActive = fields.isActive ?? true;
    const r = await pool.query(
      `INSERT INTO profession_types (name, display_name, description, icon_color, is_active, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (name) DO UPDATE SET
         display_name = COALESCE($2, profession_types.display_name),
         description = COALESCE($3, profession_types.description),
         icon_color = COALESCE($4, profession_types.icon_color),
         is_active = $5,
         sort_order = $6,
         updated_at = NOW()
       RETURNING id, name, display_name, description, icon_color, is_active, sort_order`,
      [name, displayName, fields.description ?? null, iconColor, isActive, sortOrder],
    );
    return professionRowToDto(r.rows[0]);
  };
  // :id kan være kanonisk navn eller rad-uuid; 'templates' håndteres i
  // admin-customers-routes (registrert før denne) — guardet her likevel.
  const resolveProfessionName = async (id: string): Promise<string | null> => {
    const byName = normalizeProfession(id);
    if (CANONICAL_PROFESSIONS.some((p) => p.name === byName)) return byName;
    const r = await pool.query(`SELECT name FROM profession_types WHERE name = $1 OR id::text = $2 LIMIT 1`, [byName, id]).catch(() => ({ rows: [] as any[] }));
    return r.rows[0]?.name ? normalizeProfession(r.rows[0].name) : (byName || null);
  };

  app.post("/api/admin/profession-types", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const name = normalizeProfession(req.body?.name || req.body?.id);
      if (!name) return res.status(400).json({ error: "name_required" });
      const dto = await upsertProfession(name, {
        displayName: typeof req.body?.displayName === "string" ? req.body.displayName.trim() : undefined,
        description: typeof req.body?.description === "string" ? req.body.description.trim() : null,
        iconColor: typeof req.body?.iconColor === "string" ? req.body.iconColor.trim() : undefined,
        sortOrder: Number.isFinite(Number(req.body?.sortOrder)) ? Number(req.body.sortOrder) : undefined,
        isActive: req.body?.isActive !== false,
      });
      res.status(201).json(dto);
    } catch (e) { console.error("POST profession-types", e); res.status(500).json({ error: "failed" }); }
  });

  const updateProfessionHandler = async (req: any, res: any, next: any) => {
    if (req.params.id === "templates") return next();
    if (!requireAdminSession(req, res)) return;
    try {
      const name = await resolveProfessionName(req.params.id);
      if (!name) return res.status(404).json({ error: "not_found" });
      const current = (await listProfessions(true)).find((p) => p.name === name);
      const dto = await upsertProfession(name, {
        displayName: typeof req.body?.displayName === "string" ? req.body.displayName.trim() : current?.displayName,
        description: typeof req.body?.description === "string" ? req.body.description.trim() : current?.description ?? null,
        iconColor: typeof req.body?.iconColor === "string" ? req.body.iconColor.trim() : current?.iconColor,
        sortOrder: Number.isFinite(Number(req.body?.sortOrder)) ? Number(req.body.sortOrder) : current?.sortOrder,
        isActive: typeof req.body?.isActive === "boolean" ? req.body.isActive : current?.isActive ?? true,
      });
      res.json(dto);
    } catch (e) { console.error("PUT/PATCH profession-types", e); res.status(500).json({ error: "failed" }); }
  };
  app.put("/api/admin/profession-types/:id", updateProfessionHandler);
  app.patch("/api/admin/profession-types/:id", updateProfessionHandler);

  app.post("/api/admin/profession-types/:id/toggle", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const name = await resolveProfessionName(req.params.id);
      if (!name) return res.status(404).json({ error: "not_found" });
      const current = (await listProfessions(true)).find((p) => p.name === name);
      const isActive = typeof req.body?.isActive === "boolean" ? req.body.isActive : !(current?.isActive ?? true);
      const dto = await upsertProfession(name, {
        displayName: current?.displayName,
        description: current?.description ?? null,
        iconColor: current?.iconColor,
        sortOrder: current?.sortOrder,
        isActive,
      });
      res.json(dto);
    } catch (e) { console.error("toggle profession-types", e); res.status(500).json({ error: "failed" }); }
  });

  // Soft-delete: kanoniske baseline-profesjoner ligger i kode og kan ikke
  // hard-slettes — deaktivering er det konsistente for begge kilder.
  app.delete("/api/admin/profession-types/:id", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const name = await resolveProfessionName(req.params.id);
      if (!name) return res.status(404).json({ error: "not_found" });
      const current = (await listProfessions(true)).find((p) => p.name === name);
      const dto = await upsertProfession(name, {
        displayName: current?.displayName,
        description: current?.description ?? null,
        iconColor: current?.iconColor,
        sortOrder: current?.sortOrder,
        isActive: false,
      });
      res.json({ ok: true, profession: dto });
    } catch (e) { console.error("DELETE profession-types", e); res.status(500).json({ error: "failed" }); }
  });

  app.post("/api/admin/log-interaction", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    const userId = compatResolveUserId(req);
    const logEntry = {
      id: crypto.randomUUID(),
      userId,
      action: req.body?.action || "unknown",
      details: req.body?.details || null,
      timestamp: req.body?.timestamp || new Date().toISOString(),
      userType: req.body?.userType || "unknown",
      prototypeTester: req.body?.prototypeTester || null,
      createdAt: new Date().toISOString(),
    };
    compatAdminInteractionLog.push(logEntry);
    if (compatAdminInteractionLog.length > 5000)
      compatAdminInteractionLog.shift();
    await compatStoreSet(dbCompatAdminInteractionKey(logEntry.id), logEntry);
    res.json({ success: true, logEntry });
  });

  app.get("/api/admin/smoke-tests/evendi", async (req, res) => {
    try {
      if (!isEvendiSmokeAuthorized(req)) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const projectId = (req.query.projectId as string) || "local-user";

      const [
        showcaseCategories,
        showcaseItems,
        worklogList,
        worklogStats,
        landingDesktop,
        landingMobile,
      ] = await Promise.all([
        runEvendiSmoke("/api/showcase/categories?profession=videographer"),
        runEvendiSmoke("/api/showcase/profession/videographer"),
        runEvendiSmoke(`/api/projects/${encodeURIComponent(projectId)}/worklog`),
        runEvendiSmoke(
          `/api/projects/${encodeURIComponent(projectId)}/worklog/stats`,
        ),
        runEvendiSmoke("/api/pages/landing-desktop/published"),
        runEvendiSmoke("/api/pages/landing-mobile/published"),
      ]);

      res.json({
        showcaseCategories,
        showcaseItems,
        worklogList,
        worklogStats,
        landingDesktop,
        landingMobile,
      });
    } catch (error: any) {
      console.error("Evendi smoke test error:", error?.message || error);
      res.status(502).json({ error: "Evendi smoke test failed" });
    }
  });
}
