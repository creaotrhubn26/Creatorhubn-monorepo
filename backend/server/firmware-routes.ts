import express from "express";
import type { Pool } from "pg";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { and, eq, inArray } from "drizzle-orm";
import * as schema from "../migrations/schema.js";

export interface FirmwareRoutesDeps {
  app: express.Application;
  requireUserSession: (req: any, res: any) => any;
  pool: Pool;
  db: NodePgDatabase<typeof schema>;
  ensureFirmwareUpdatesCompatibilityColumns: () => Promise<void>;
  estimateInstallMinutes: (...args: any[]) => number;
  loadFirmwareDevices: (...args: any[]) => Promise<any[]>;
  loadFirmwareUpdates: (...args: any[]) => Promise<any[]>;
  loadFirmwareHistory: (...args: any[]) => Promise<any[]>;
  hasTable: (tableName: string) => Promise<boolean>;
  mapImportance: (importance?: string | null) => any;
  parseSettings: (settings: unknown) => Record<string, unknown>;
}

export function setupFirmwareRoutes(deps: FirmwareRoutesDeps): void {
  const {
    app,
    requireUserSession,
    pool,
    db,
    ensureFirmwareUpdatesCompatibilityColumns,
    estimateInstallMinutes,
    loadFirmwareDevices,
    loadFirmwareUpdates,
    loadFirmwareHistory,
    hasTable,
    mapImportance,
    parseSettings,
  } = deps;

  app.get("/api/firmware/devices", async (req, res) => {
    try {
      const userId =
        typeof req.query.userId === "string" ? req.query.userId : null;
      const profession =
        typeof req.query.profession === "string" ? req.query.profession : null;
      const devices = await loadFirmwareDevices(userId, profession);
      res.json(devices);
    } catch (error) {
      console.error("Firmware devices error:", error);
      res.status(500).json({ error: "Failed to load devices" });
    }
  });

  // Firmware updates
  app.get("/api/firmware/updates", async (req, res) => {
    try {
      const userId =
        typeof req.query.userId === "string" ? req.query.userId : null;
      const profession =
        typeof req.query.profession === "string" ? req.query.profession : null;
      const updates = await loadFirmwareUpdates(userId, profession);
      res.json(updates);
    } catch (error) {
      console.error("Firmware updates error:", error);
      res.status(500).json({ error: "Failed to load updates" });
    }
  });

  // Firmware update history
  app.get("/api/firmware/history", async (req, res) => {
    try {
      const userId =
        typeof req.query.userId === "string" ? req.query.userId : null;
      const profession =
        typeof req.query.profession === "string" ? req.query.profession : null;
      const history = await loadFirmwareHistory(userId, profession);
      res.json(history);
    } catch (error) {
      console.error("Firmware history error:", error);
      res.status(500).json({ error: "Failed to load update history" });
    }
  });

  // Check for firmware updates
  app.post("/api/firmware/check", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const { userId, profession } = req.body || {};
      const updates = await loadFirmwareUpdates(userId, profession);
      const devices = await loadFirmwareDevices(userId, profession);
      const history = await loadFirmwareHistory(userId, profession);
      const checkedAt = new Date().toISOString();

      if (updates.length > 0) {
        await db
          .update(schema.firmwareUpdates)
          .set({ lastChecked: checkedAt })
          .where(
            inArray(
              schema.firmwareUpdates.id,
              updates.map((u) => u!.id),
            ),
          );
      }

      res.json({ updates, devices, history, checkedAt });
    } catch (error) {
      console.error("Firmware check error:", error);
      res.status(500).json({ error: "Failed to check updates" });
    }
  });

  // Apply firmware update
  app.post("/api/firmware/update", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const { updateId, userId, profession } = req.body || {};
      if (!updateId || !userId) {
        res.status(400).json({ error: "Missing updateId or userId" });
        return;
      }

      if (!(await hasTable("firmware_updates"))) {
        res.status(404).json({ error: "Firmware updates table is unavailable" });
        return;
      }
      await ensureFirmwareUpdatesCompatibilityColumns();

      const [update] = await db
        .select()
        .from(schema.firmwareUpdates)
        .where(eq(schema.firmwareUpdates.id, updateId));

      if (!update) {
        res.status(404).json({ error: "Update not found" });
        return;
      }

      const [device] = await db
        .select()
        .from(schema.userEquipment)
        .where(
          and(
            eq(schema.userEquipment.userId, userId),
            eq(schema.userEquipment.brand, update.brand),
            eq(schema.userEquipment.model, update.model),
          ),
        );

      if (!device) {
        res.status(404).json({ error: "Device not found for update" });
        return;
      }

      const now = new Date();
      const completedAt = now.toISOString();
      const previousVersion = device.firmwareVersion || "Ukjent";
      const installMinutes = estimateInstallMinutes(device.category, null);

      const historyEntry = {
        id: update.id,
        deviceBrand: update.brand,
        deviceModel: update.model,
        deviceType: device.category || "accessory",
        currentVersion: previousVersion,
        latestVersion: update.version,
        priority: mapImportance(update.importance),
        description: update.description || "Firmware-oppdatering",
        completedAt,
        duration: installMinutes,
      };

      const settings = parseSettings(device.settings);
      const history = Array.isArray(settings.firmwareUpdateHistory)
        ? settings.firmwareUpdateHistory
        : [];
      const updatedSettings = {
        ...settings,
        firmwareUpdateHistory: [historyEntry, ...history],
        lastFirmwareCheck: completedAt,
      };

      await db
        .update(schema.userEquipment)
        .set({
          firmwareVersion: update.version,
          settings: updatedSettings,
          updatedAt: completedAt,
        })
        .where(eq(schema.userEquipment.id, device.id));

      const updates = await loadFirmwareUpdates(userId, profession);
      const devices = await loadFirmwareDevices(userId, profession);
      const historyList = await loadFirmwareHistory(userId, profession);

      res.json({ update: historyEntry, updates, devices, history: historyList });
    } catch (error) {
      console.error("Firmware update error:", error);
      res.status(500).json({ error: "Failed to apply update" });
    }
  });
}
