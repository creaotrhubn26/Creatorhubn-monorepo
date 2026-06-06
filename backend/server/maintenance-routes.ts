/**
 * maintenance-routes.ts
 *
 * Standalone modul for /api/maintenance/* — utstyrs-vedlikehold (4 routes).
 * Ekstraktert fra backend/server/index.ts (linje 48045-48436) som del av
 * backend-extraction-roadmappen.
 *
 * 4 endpoints:
 *   - GET  /api/maintenance/equipment      — list user equipment + age + condition
 *   - GET  /api/maintenance/tasks          — list scheduled maintenance tasks
 *   - POST /api/maintenance/tasks          — create new task
 *   - POST /api/maintenance/auto-schedule  — auto-generate tasks based on age/usage
 *
 * Wire opp i backend/server/index.ts:
 *
 *   import { setupMaintenanceRoutes } from "./maintenance-routes";
 *
 *   setupMaintenanceRoutes({
 *     app, db, schema, sql,
 *     parseSettings, readString, readBoolean, readNumber, readStringArray,
 *     normalizeEquipmentType, normalizeCondition,
 *     normalizeTaskType, normalizePriority,
 *     toDateOnly, addMonths, resolveScheduledDate, mapMaintenanceRow,
 *   });
 */

import type express from "express";
import { eq, and, desc, asc, inArray } from "drizzle-orm";

// Drizzle-typer kan ikke importeres uten å peke på ekte schema-instans —
// vi bruker any på dep-typer for å unngå transitiv kompleksitet (samme
// trade-off som de andre route-ekstraksjonene).

export interface MaintenanceRoutesDeps {
  app: express.Application;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sql: any;
  parseSettings: (settings: unknown) => Record<string, unknown>;
  readString: (value: unknown) => string | null;
  readBoolean: (value: unknown) => boolean | null;
  readNumber: (value: unknown) => number | null;
  readStringArray: (value: unknown) => string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  normalizeEquipmentType: (raw?: string | null) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  normalizeCondition: (raw?: string | null) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  normalizeTaskType: (raw?: string | null) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  normalizePriority: (raw?: string | null) => any;
  toDateOnly: (value: string | Date) => string;
  addMonths: (date: Date, months: number) => Date;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resolveScheduledDate: (row: any) => string;
  /**
   * Matcher index.ts:21760 — krever equipmentMap for equipmentName-lookup.
   * Tom Map = "Ukjent utstyr" som fallback.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mapMaintenanceRow: (row: any, equipmentMap: Map<string, any>) => any;
}

export function setupMaintenanceRoutes(deps: MaintenanceRoutesDeps): void {
  const {
    app, db, schema, sql,
    parseSettings, readString, readBoolean, readNumber, readStringArray,
    normalizeEquipmentType, normalizeCondition,
    normalizeTaskType, normalizePriority,
    toDateOnly, addMonths, resolveScheduledDate, mapMaintenanceRow,
  } = deps;

  // GET /api/maintenance/equipment
  app.get("/api/maintenance/equipment", async (req, res) => {
    try {
      const userId =
        typeof req.query.userId === "string" ? req.query.userId : null;
      const profession =
        typeof req.query.profession === "string" ? req.query.profession : null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const conditions: any[] = [];
      if (userId) {
        conditions.push(eq(schema.userEquipment.userId, userId));
      }
      if (profession) {
        conditions.push(eq(schema.userEquipment.userType, profession));
      }

      const equipmentRows = await db
        .select()
        .from(schema.userEquipment)
        .where(conditions.length ? and(...conditions) : sql`true`)
        .orderBy(desc(schema.userEquipment.createdAt));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const normalized = equipmentRows.map((item: any) => {
        const settings = parseSettings(item.settings);
        const purchaseDateValue =
          readString(settings.purchaseDate) || item.purchaseDate || null;
        const warrantyExpiryValue =
          readString(settings.warrantyExpiry) || item.warrantyExpiry || null;
        const lastServiceValue =
          readString(settings.lastService) || item.lastMaintenance || null;
        const nextServiceValue =
          readString(settings.nextService) || item.nextMaintenance || null;
        const purchaseDate = purchaseDateValue
          ? new Date(purchaseDateValue)
          : null;
        const estimatedLifespan = readNumber(settings.estimatedLifespan) ?? 7;
        const currentAge =
          readNumber(settings.currentAge) ??
          (purchaseDate
            ? Math.max(
                0,
                (Date.now() - purchaseDate.getTime()) /
                  (1000 * 60 * 60 * 24 * 365),
              )
            : 0);

        return {
          id: String(item.id),
          name: readString(settings.name) || `${item.brand} ${item.model}`.trim(),
          brand: item.brand,
          model: item.model,
          serialNumber: item.serialNumber || null,
          type: normalizeEquipmentType(
            readString(settings.type) || item.category,
          ),
          purchaseDate: purchaseDateValue || null,
          warrantyExpiry: warrantyExpiryValue || null,
          lastService: lastServiceValue || null,
          nextService: nextServiceValue || null,
          condition: normalizeCondition(
            readString(settings.condition) || item.condition,
          ),
          maintenanceNotes:
            readString(settings.maintenanceNotes) || item.notes || "",
          estimatedLifespan,
          currentAge,
          usageHours: readNumber(settings.usageHours) ?? 0,
        };
      });

      res.json(normalized);
    } catch (error) {
      console.error("[maintenance/equipment] failed:", error);
      res.status(500).json({ error: "Failed to load maintenance equipment" });
    }
  });

  // GET /api/maintenance/tasks
  app.get("/api/maintenance/tasks", async (req, res) => {
    try {
      const userId =
        typeof req.query.userId === "string" ? req.query.userId : null;
      const equipmentId =
        typeof req.query.equipmentId === "string"
          ? req.query.equipmentId
          : null;
      const includeCompleted = req.query.includeCompleted === "true";

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const conditions: any[] = [];
      if (userId) {
        conditions.push(eq(schema.maintenanceTasks.userId, userId));
      }
      if (equipmentId) {
        conditions.push(eq(schema.maintenanceTasks.equipmentId, equipmentId));
      }
      if (!includeCompleted) {
        conditions.push(eq(schema.maintenanceTasks.completed, false));
      }

      const rows = await db
        .select()
        .from(schema.maintenanceTasks)
        .where(conditions.length ? and(...conditions) : sql`true`)
        .orderBy(asc(schema.maintenanceTasks.scheduledDate));

      // Slå opp tilhørende utstyr for navn-felt (equipmentName i mapper).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const equipmentIds = Array.from(new Set(rows.map((r: any) => r.equipmentId).filter(Boolean) as string[]));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const equipmentMap = new Map<string, any>();
      if (equipmentIds.length > 0) {
        const equipmentRows = await db
          .select()
          .from(schema.userEquipment)
          .where(inArray(schema.userEquipment.id, equipmentIds));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const e of equipmentRows) equipmentMap.set(String(e.id), e);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      res.json(rows.map((r: any) => mapMaintenanceRow(r, equipmentMap)));
    } catch (error) {
      console.error("[maintenance/tasks GET] failed:", error);
      res.status(500).json({ error: "Failed to load maintenance tasks" });
    }
  });

  // POST /api/maintenance/tasks
  app.post("/api/maintenance/tasks", async (req, res) => {
    try {
      const payload =
        req.body && typeof req.body === "object" ? req.body : {};
      const userId = readString((payload as Record<string, unknown>).userId);
      const equipmentId = readString(
        (payload as Record<string, unknown>).equipmentId,
      );
      const title = readString((payload as Record<string, unknown>).title);
      if (!userId || !equipmentId || !title) {
        return res
          .status(400)
          .json({ error: "userId, equipmentId, title påkrevd" });
      }

      const taskType = normalizeTaskType(
        readString((payload as Record<string, unknown>).type),
      );
      const priority = normalizePriority(
        readString((payload as Record<string, unknown>).priority),
      );
      const scheduledDate = toDateOnly(
        readString((payload as Record<string, unknown>).scheduledDate) ||
          new Date().toISOString(),
      );

      const [inserted] = await db
        .insert(schema.maintenanceTasks)
        .values({
          userId,
          equipmentId,
          title,
          description:
            readString((payload as Record<string, unknown>).description) || "",
          type: taskType,
          priority,
          scheduledDate,
          tags: readStringArray(
            (payload as Record<string, unknown>).tags,
          ),
          completed: false,
        })
        .returning();

      // Slå opp equipment for navn-felt
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const equipmentMap = new Map<string, any>();
      const [equipmentRow] = await db
        .select()
        .from(schema.userEquipment)
        .where(eq(schema.userEquipment.id, equipmentId));
      if (equipmentRow) equipmentMap.set(String(equipmentRow.id), equipmentRow);

      res.status(201).json(mapMaintenanceRow(inserted, equipmentMap));
    } catch (error) {
      console.error("[maintenance/tasks POST] failed:", error);
      res.status(500).json({ error: "Failed to create maintenance task" });
    }
  });

  // POST /api/maintenance/auto-schedule
  app.post("/api/maintenance/auto-schedule", async (req, res) => {
    try {
      const payload =
        req.body && typeof req.body === "object" ? req.body : {};
      const userId = readString((payload as Record<string, unknown>).userId);
      if (!userId) {
        return res.status(400).json({ error: "userId påkrevd" });
      }

      const equipmentRows = await db
        .select()
        .from(schema.userEquipment)
        .where(eq(schema.userEquipment.userId, userId));

      const created: Array<Record<string, unknown>> = [];
      const now = new Date();
      const monthsBetween = readNumber(
        (payload as Record<string, unknown>).monthsBetween,
      ) ?? 6;

      for (const item of equipmentRows) {
        const settings = parseSettings(item.settings);
        const lastServiceValue =
          readString(settings.lastService) || item.lastMaintenance || null;
        const lastDate = lastServiceValue
          ? new Date(lastServiceValue)
          : now;
        const nextDate = addMonths(lastDate, monthsBetween);

        // Hopp over hvis allerede har en oppgave for samme periode
        const existing = await db
          .select()
          .from(schema.maintenanceTasks)
          .where(
            and(
              eq(schema.maintenanceTasks.equipmentId, String(item.id)),
              eq(schema.maintenanceTasks.completed, false),
            ),
          );
        if (existing.length > 0) continue;

        const [inserted] = await db
          .insert(schema.maintenanceTasks)
          .values({
            userId,
            equipmentId: String(item.id),
            title: `Service: ${item.brand} ${item.model}`.trim(),
            description: "Auto-generert basert på service-intervall",
            type: normalizeTaskType("preventive"),
            priority: normalizePriority("medium"),
            scheduledDate: toDateOnly(nextDate),
            tags: [],
            completed: false,
          })
          .returning();

        // Bygg single-entry equipmentMap for navn-felt
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const equipmentMap = new Map<string, any>([[String(item.id), item]]);
        created.push(mapMaintenanceRow(inserted, equipmentMap));
      }

      res.json({ created, count: created.length });
    } catch (error) {
      console.error("[maintenance/auto-schedule] failed:", error);
      res.status(500).json({ error: "Failed to auto-schedule maintenance" });
    }
  });
}
