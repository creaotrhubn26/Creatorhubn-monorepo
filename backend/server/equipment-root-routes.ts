import express from "express";
import type { Pool } from "pg";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { and, desc, eq } from "drizzle-orm";
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
    // Sikkerhet (IDOR/broken-auth): userEquipment er per-bruker inventar med
    // en userId-eierkolonne. Uten sesjonsgate og med userId hentet fra query
    // kunne en ANONYM kaller lese et vilkårlig offers utstyr (?userId=<victim>),
    // eller — hvis userId utelates — dumpe HELE tabellen på tvers av alle
    // tenants (tidligere `sql`true``-fallback). Vi krever nå innlogging og
    // scoper ALLTID til session.userId; en klient-oppgitt query.userId ignoreres.
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const profession =
        typeof req.query.profession === "string" ? req.query.profession : null;
      const conditions = [eq(schema.userEquipment.userId, session.userId)];
      if (profession) {
        conditions.push(eq(schema.userEquipment.userType, profession));
      }

      const equipment = await db
        .select()
        .from(schema.userEquipment)
        .where(and(...conditions))
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
    // Sikkerhet (BOLA): eieren MÅ utledes fra sesjonen. Tidligere ble userId
    // tatt fra req.body, så enhver innlogget bruker kunne skrive utstyr inn i
    // et vilkårlig offers inventar. En klient-oppgitt body.userId ignoreres nå.
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const { profession, brand, model, category, status } = req.body || {};
      if (!brand || !model) {
        res.status(400).json({ error: "Missing required fields" });
        return;
      }

      const settings = {
        status: status || "Tilgjengelig",
      };

      const [inserted] = await db
        .insert(schema.userEquipment)
        .values({
          userId: session.userId,
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
