import express from "express";
import type { Pool } from "pg";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { and, desc, eq, sql } from "drizzle-orm";
import * as schema from "../migrations/schema.js";

export interface EquipmentRootRoutesDeps {
  app: express.Application;
  requireUserSession: (req: any, res: any) => any;
  pool: Pool;
  db: NodePgDatabase<typeof schema>;
  parseSettings: (settings: unknown) => Record<string, unknown>;
}

export function setupEquipmentRootRoutes(
  deps: EquipmentRootRoutesDeps,
): void {
  const { app, requireUserSession, pool, db, parseSettings } = deps;

  app.get("/api/equipment", async (req, res) => {
    try {
      const userId =
        typeof req.query.userId === "string" ? req.query.userId : null;
      const profession =
        typeof req.query.profession === "string" ? req.query.profession : null;
      const conditions = [];
      if (userId) {
        conditions.push(eq(schema.userEquipment.userId, userId));
      }
      if (profession) {
        conditions.push(eq(schema.userEquipment.userType, profession));
      }

      const equipment = await db
        .select()
        .from(schema.userEquipment)
        .where(conditions.length ? and(...conditions) : sql`true`)
        .orderBy(desc(schema.userEquipment.createdAt));

      const normalized = equipment.map((item) => {
        const settings = parseSettings(item.settings);
        return {
          id: item.id,
          brand: item.brand,
          model: item.model,
          category: item.category,
          status:
            typeof settings.status === "string"
              ? settings.status
              : item.condition || null,
        };
      });

      res.json(normalized);
    } catch (error) {
      console.error("Equipment list error:", error);
      res.status(500).json({ error: "Failed to load equipment" });
    }
  });

  app.post("/api/equipment", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const { userId, profession, brand, model, category, status } =
        req.body || {};
      if (!userId || !brand || !model) {
        res.status(400).json({ error: "Missing required fields" });
        return;
      }

      const settings = {
        status: status || "Tilgjengelig",
      };

      const [inserted] = await db
        .insert(schema.userEquipment)
        .values({
          userId,
          userType: profession || null,
          brand,
          model,
          category: category || null,
          condition: status || null,
          settings,
        })
        .returning();

      res.json({
        id: inserted.id,
        brand: inserted.brand,
        model: inserted.model,
        category: inserted.category,
        status: status || inserted.condition || null,
      });
    } catch (error) {
      console.error("Equipment create error:", error);
      res.status(500).json({ error: "Failed to create equipment" });
    }
  });
}
