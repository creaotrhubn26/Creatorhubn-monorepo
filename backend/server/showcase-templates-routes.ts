/**
 * showcase-templates-routes.ts
 *
 * Setup-funksjon for /api/showcase/templates endpoints — design-maler
 * for showcase-portfolios. Hver mal har layoutConfig + designSettings
 * og kan markeres som default per profession (photographer, etc.).
 *
 * 4 endpoints (CRUD): GET, POST, PUT /:templateId, DELETE /:templateId.
 *
 * Auth: åpen — userId leses fra query/header, ingen session-validering.
 * Dette er eksisterende oppførsel og bevares.
 *
 * Wire opp i backend/server/index.ts ved å legge til:
 *
 *   import { setupShowcaseTemplatesRoutes } from "./showcase-templates-routes";
 *
 *   setupShowcaseTemplatesRoutes({ app, db });
 *
 * Mode-noter: `profession`-feltet (photographer, videographer, etc.) er
 * et profession-filter, ikke en Role Room-mode. Showcase er primært en
 * Innholdsprodusent/Produksjonsteam-feature, men endpointet selv har
 * ingen mode-branching — bare profession-filtrering på query-param.
 */

import type express from "express";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import crypto from "crypto";
import { and, desc, eq } from "drizzle-orm";

import * as schema from "../migrations/schema.js";
import { readBoolean, readString } from "./_shared";
import { normalizeJsonObjectField } from "./_shared";

type Db = NodePgDatabase<typeof schema>;

export interface ShowcaseTemplatesRoutesDeps {
  app: express.Application;
  db: Db;
  requireUserSession: (req: any, res: any) => any;
}

export function setupShowcaseTemplatesRoutes(
  deps: ShowcaseTemplatesRoutesDeps,
): void {
  const { app, db, requireUserSession } = deps;

  app.get("/api/showcase/templates", async (req, res) => {
    try {
      const profession = readString(req.query.profession);
      const userId =
        readString(req.query.userId) ||
        readString(req.headers["x-user-id"]) ||
        null;
      const filters = [];
      if (profession) {
        filters.push(eq(schema.showcaseTemplates.profession, profession));
      }
      if (userId) {
        filters.push(eq(schema.showcaseTemplates.userId, userId));
      }

      const rows = await db
        .select()
        .from(schema.showcaseTemplates)
        .where(filters.length ? and(...filters) : undefined)
        .orderBy(desc(schema.showcaseTemplates.updatedAt));
      res.json(rows);
    } catch (error) {
      console.error("Error loading showcase templates:", error);
      res.status(500).json({ error: "Kunne ikke hente showcase-maler" });
    }
  });

  app.post("/api/showcase/templates", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const payload = req.body as Record<string, unknown>;
      const [created] = await db
        .insert(schema.showcaseTemplates)
        .values({
          id: crypto.randomUUID(),
          userId:
            readString(payload.userId) ||
            readString(req.headers["x-user-id"]) ||
            null,
          name: readString(payload.name) || "Ny mal",
          profession: readString(payload.profession) || "photographer",
          description: readString(payload.description) || "",
          layoutConfig: normalizeJsonObjectField(payload.layoutConfig) || {},
          designSettings: normalizeJsonObjectField(payload.designSettings) || {},
          isDefault: readBoolean(payload.isDefault) ?? false,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .returning();
      res.status(201).json(created);
    } catch (error) {
      console.error("Error creating showcase template:", error);
      res.status(500).json({ error: "Kunne ikke opprette showcase-mal" });
    }
  });

  app.put("/api/showcase/templates/:templateId", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const payload = req.body as Record<string, unknown>;
      const [updated] = await db
        .update(schema.showcaseTemplates)
        .set({
          name: readString(payload.name) || "Ny mal",
          description: readString(payload.description) || "",
          profession: readString(payload.profession) || "photographer",
          layoutConfig: normalizeJsonObjectField(payload.layoutConfig) || {},
          designSettings: normalizeJsonObjectField(payload.designSettings) || {},
          isDefault: readBoolean(payload.isDefault) ?? false,
          isActive: readBoolean(payload.isActive) ?? true,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.showcaseTemplates.id, req.params.templateId))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: "Template ikke funnet" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating showcase template:", error);
      res.status(500).json({ error: "Kunne ikke oppdatere showcase-mal" });
    }
  });

  app.delete("/api/showcase/templates/:templateId", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const [deleted] = await db
        .delete(schema.showcaseTemplates)
        .where(eq(schema.showcaseTemplates.id, req.params.templateId))
        .returning();
      if (!deleted) {
        return res.status(404).json({ error: "Template ikke funnet" });
      }
      res.json({ deleted: true, id: req.params.templateId });
    } catch (error) {
      console.error("Error deleting showcase template:", error);
      res.status(500).json({ error: "Kunne ikke slette showcase-mal" });
    }
  });
}
