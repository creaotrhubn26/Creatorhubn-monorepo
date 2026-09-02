/**
 * Utstyrsdatabase-admin (/equipment-admin i frontend).
 *
 * Frontenden (pages/EquipmentAdminPage.tsx) ble portet med et komplett
 * API-kontrakt mot /api/equipment-admin/*, men rutene fulgte aldri med —
 * alle kall ga 404. `products`-tabellen finnes allerede i skjemaet og
 * matcher frontend-typen felt for felt, så dette er kun rute-laget.
 *
 * Google Custom Search brukes for produkt-oppslag/berikelse og styres av
 * GOOGLE_SEARCH_API_KEY + GOOGLE_SEARCH_ENGINE_ID. Uten dem svarer
 * status-endepunktet configured=false og søke-endepunktene 503 — siden
 * viser da selv «ikke konfigurert»-varselet.
 *
 * Alle endepunkter er admin-gatet (requireAdminSession) — dette er en
 * global produktdatabase med skrivetilgang.
 */
import type express from "express";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { asc, eq, sql } from "drizzle-orm";
import * as schema from "../migrations/schema.js";
import { EQUIPMENT_CATALOG } from "./equipment-catalog.js";
import {
  googleCustomSearchConfigured,
  searchGoogleCustom,
} from "./google-custom-search.js";

export interface EquipmentAdminRoutesDeps {
  app: express.Application;
  requireAdminSession: (req: express.Request, res: express.Response) => any;
  db: NodePgDatabase<typeof schema>;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[æå]/g, "a")
    .replace(/ø/g, "o")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 280);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function parseTechnicalSpecs(value: unknown): unknown {
  if (value == null || value === "") return null;
  if (typeof value === "object") return value;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      // Fri-tekst-specs lagres som {text: ...} i stedet for å feile hele insert.
      return { text: value };
    }
  }
  return null;
}

export function setupEquipmentAdminRoutes(deps: EquipmentAdminRoutesDeps): void {
  const { app, requireAdminSession, db } = deps;
  const products = schema.products;

  // ── Offentlig kamerakatalog (lesing, ingen auth) ──────────────────────
  // Kilde for kameravelgerne i prosjekt-modalen: kameraer vedlikeholdes i
  // Utstyrsdatabase-adminen (products-tabellen) med spesifikasjoner i
  // technical_specs (megapixels, averageRawSize, averageCrawSize,
  // maxVideoBitrateMbps, cardTypes, category). Frontenden merger denne
  // lista med den innebygde statiske databasen (statisk = alltid fallback).
  app.get("/api/equipment/cameras", async (_req, res) => {
    try {
      const rows = await db
        .select({
          brand: products.brand,
          model: products.model,
          type: products.type,
          technicalSpecs: products.technicalSpecs,
        })
        .from(products)
        .where(sql`${products.type} IN ('camera', 'camera_body', 'cinema', 'video_camera')`)
        .orderBy(asc(products.brand), asc(products.model));
      const cameras = rows.map((row) => {
        const specs = (row.technicalSpecs ?? {}) as Record<string, unknown>;
        return {
          brand: row.brand,
          model: row.model,
          category: typeof specs.category === "string" ? specs.category
            : row.type === "cinema" || row.type === "video_camera" ? "cinema" : "mirrorless",
          megapixels: typeof specs.megapixels === "number" ? specs.megapixels : null,
          averageRawSize: typeof specs.averageRawSize === "number" ? specs.averageRawSize : null,
          averageCrawSize: typeof specs.averageCrawSize === "number" ? specs.averageCrawSize : null,
          maxVideoBitrateMbps: typeof specs.maxVideoBitrateMbps === "number" ? specs.maxVideoBitrateMbps : null,
          cardTypes: Array.isArray(specs.cardTypes) ? specs.cardTypes : [],
          fileFormat: Array.isArray(specs.fileFormat) ? specs.fileFormat : [],
        };
      });
      res.json({ success: true, cameras });
    } catch (error) {
      console.error("equipment cameras catalog error:", error);
      res.status(500).json({ error: "Kunne ikke hente kamerakatalogen" });
    }
  });

  // ── Produkter ─────────────────────────────────────────────────────────
  app.get("/api/equipment-admin/products", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const rows = await db
        .select()
        .from(products)
        .orderBy(asc(products.brand), asc(products.model));
      res.json({ success: true, data: rows });
    } catch (error) {
      console.error("equipment-admin products error:", error);
      res.status(500).json({ error: "Kunne ikke hente produkter" });
    }
  });

  app.get("/api/equipment-admin/stats", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const [row] = await db
        .select({
          total: sql<number>`count(*)::int`,
          brands: sql<number>`count(distinct ${products.brand})::int`,
          withSource: sql<number>`count(*) filter (where ${products.sourceUrl} is not null)::int`,
        })
        .from(products);
      res.json({ success: true, data: row ?? { total: 0, brands: 0, withSource: 0 } });
    } catch (error) {
      console.error("equipment-admin stats error:", error);
      res.status(500).json({ error: "Kunne ikke hente statistikk" });
    }
  });

  app.post("/api/equipment-admin/products", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    const body = (req.body || {}) as Record<string, unknown>;
    const type = readString(body.type);
    const brand = readString(body.brand);
    const model = readString(body.model);
    if (!type || !brand || !model) {
      res.status(400).json({ error: "type, brand og model er påkrevd" });
      return;
    }
    try {
      const [inserted] = await db
        .insert(products)
        .values({
          type,
          brand,
          model,
          series: readString(body.series),
          mount: readString(body.mount),
          sensorFormat: readString(body.sensorFormat),
          sourceUrl: readString(body.sourceUrl),
          license: readString(body.license),
          attribution: readString(body.attribution),
          technicalSpecs: parseTechnicalSpecs(body.technicalSpecs),
          slug: slugify(`${brand}-${model}`),
        })
        .onConflictDoNothing({ target: products.slug })
        .returning();
      if (!inserted) {
        res.status(409).json({ error: "Produktet finnes allerede (samme slug)" });
        return;
      }
      res.json({ success: true, data: inserted });
    } catch (error) {
      console.error("equipment-admin create error:", error);
      res.status(500).json({ error: "Kunne ikke opprette produkt" });
    }
  });

  app.put("/api/equipment-admin/products/:id", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    const body = (req.body || {}) as Record<string, unknown>;
    try {
      const update: Record<string, unknown> = { updatedAt: sql`now()` };
      for (const field of [
        "type",
        "brand",
        "model",
        "series",
        "mount",
        "sensorFormat",
        "sourceUrl",
        "license",
        "attribution",
      ] as const) {
        if (field in body) update[field] = readString(body[field]);
      }
      if ("technicalSpecs" in body) {
        update.technicalSpecs = parseTechnicalSpecs(body.technicalSpecs);
      }
      const [updated] = await db
        .update(products)
        .set(update)
        .where(eq(products.id, String(req.params.id)))
        .returning();
      if (!updated) {
        res.status(404).json({ error: "Produktet finnes ikke" });
        return;
      }
      res.json({ success: true, data: updated });
    } catch (error) {
      console.error("equipment-admin update error:", error);
      res.status(500).json({ error: "Kunne ikke oppdatere produkt" });
    }
  });

  app.delete("/api/equipment-admin/products/:id", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const [deleted] = await db
        .delete(products)
        .where(eq(products.id, String(req.params.id)))
        .returning({ id: products.id });
      if (!deleted) {
        res.status(404).json({ error: "Produktet finnes ikke" });
        return;
      }
      res.json({ success: true, data: deleted });
    } catch (error) {
      console.error("equipment-admin delete error:", error);
      res.status(500).json({ error: "Kunne ikke slette produkt" });
    }
  });

  app.post("/api/equipment-admin/bulk-import", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    const incoming = Array.isArray((req.body || {}).products)
      ? ((req.body as { products: unknown[] }).products)
      : null;
    if (!incoming || incoming.length === 0) {
      res.status(400).json({ error: "products-listen er tom" });
      return;
    }
    if (incoming.length > 500) {
      res.status(400).json({ error: "Maks 500 produkter per import" });
      return;
    }
    try {
      let imported = 0;
      for (const raw of incoming) {
        const item = (raw || {}) as Record<string, unknown>;
        const type = readString(item.type);
        const brand = readString(item.brand);
        const model = readString(item.model);
        if (!type || !brand || !model) continue;
        const [inserted] = await db
          .insert(products)
          .values({
            type,
            brand,
            model,
            series: readString(item.series),
            mount: readString(item.mount),
            sensorFormat: readString(item.sensorFormat),
            sourceUrl: readString(item.sourceUrl),
            technicalSpecs: parseTechnicalSpecs(item.technicalSpecs),
            slug: slugify(`${brand}-${model}`),
          })
          .onConflictDoNothing({ target: products.slug })
          .returning({ id: products.id });
        if (inserted) imported += 1;
      }
      res.json({ success: true, data: { imported, received: incoming.length } });
    } catch (error) {
      console.error("equipment-admin bulk-import error:", error);
      res.status(500).json({ error: "Masseimport feilet" });
    }
  });

  // ── Auto-oppdagelse fra intern katalog (deterministisk, ingen kvote) ──
  app.post("/api/equipment-admin/auto-discover-brand", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    const brand = readString((req.body || {}).brand);
    if (!brand) {
      res.status(400).json({ error: "brand er påkrevd" });
      return;
    }
    try {
      const matches = EQUIPMENT_CATALOG.filter(
        (entry) => entry.brand.toLowerCase() === brand.toLowerCase(),
      );
      let inserted = 0;
      for (const entry of matches) {
        const [row] = await db
          .insert(products)
          .values({
            type: entry.category,
            brand: entry.brand,
            model: entry.model,
            sourceUrl: entry.imageUrl || null,
            releasedAt: entry.releasedYear ? `${entry.releasedYear}-01-01T00:00:00.000Z` : null,
            slug: slugify(`${entry.brand}-${entry.model}`),
          })
          .onConflictDoNothing({ target: products.slug })
          .returning({ id: products.id });
        if (row) inserted += 1;
      }
      res.json({
        success: true,
        data: { brand, inserted, catalogMatches: matches.length },
      });
    } catch (error) {
      console.error("equipment-admin auto-discover error:", error);
      res.status(500).json({ error: "Auto-oppdagelse feilet" });
    }
  });

  // ── Google Custom Search ──────────────────────────────────────────────
  app.get("/api/equipment-admin/search-service-status", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    const missing: string[] = [];
    if (!process.env.GOOGLE_SEARCH_API_KEY) missing.push("GOOGLE_SEARCH_API_KEY");
    if (!process.env.GOOGLE_SEARCH_ENGINE_ID) missing.push("GOOGLE_SEARCH_ENGINE_ID");
    res.json({ success: true, data: { configured: googleCustomSearchConfigured(), missing } });
  });

  app.post("/api/equipment-admin/search-product-info", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    if (!googleCustomSearchConfigured()) {
      res.status(503).json({
        error: "Google Search API er ikke konfigurert (GOOGLE_SEARCH_API_KEY + GOOGLE_SEARCH_ENGINE_ID)",
      });
      return;
    }
    const body = (req.body || {}) as Record<string, unknown>;
    const brand = readString(body.brand);
    const model = readString(body.model);
    const type = readString(body.type);
    if (!brand || !model) {
      res.status(400).json({ error: "brand og model er påkrevd" });
      return;
    }
    try {
      const items = await searchGoogleCustom(
        [brand, model, type, "specifications"].filter(Boolean).join(" "),
        { num: 3 },
      );
      const first = items[0];
      res.json({
        success: true,
        data: {
          brand,
          model,
          type,
          description: first?.snippet ?? null,
          imageUrl: first?.pagemap?.cse_image?.[0]?.src ?? null,
          officialUrl: first?.link ?? null,
        },
      });
    } catch (error) {
      console.error("equipment-admin search error:", error);
      res.status(502).json({ error: "Google-søket feilet" });
    }
  });

  app.post("/api/equipment-admin/enrich-existing-products", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    if (!googleCustomSearchConfigured()) {
      res.status(503).json({
        error: "Google Search API er ikke konfigurert (GOOGLE_SEARCH_API_KEY + GOOGLE_SEARCH_ENGINE_ID)",
      });
      return;
    }
    try {
      // ponytail: maks 10 produkter per kall — bevisst kvote-tak (CSE gratis-
      // kvote er 100 søk/dag); kjør endepunktet flere ganger for full berikelse.
      const candidates = await db
        .select({ id: products.id, brand: products.brand, model: products.model })
        .from(products)
        .where(sql`${products.sourceUrl} is null`)
        .limit(10);
      const [{ total }] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(products)
        .where(sql`${products.sourceUrl} is null`);

      let enriched = 0;
      for (const candidate of candidates) {
        try {
          const items = await searchGoogleCustom(`${candidate.brand} ${candidate.model} specifications`, { num: 3 });
          const first = items[0];
          if (!first?.link) continue;
          await db
            .update(products)
            .set({
              sourceUrl: first.link,
              metaDescription: first.snippet ?? null,
              lastScrapedAt: sql`now()`,
              updatedAt: sql`now()`,
            })
            .where(eq(products.id, candidate.id));
          enriched += 1;
        } catch (error) {
          console.error(`equipment-admin enrich ${candidate.brand} ${candidate.model} error:`, error);
        }
      }
      res.json({
        success: true,
        message:
          total > candidates.length
            ? `Beriket ${enriched} av ${candidates.length} — ${total - candidates.length} gjenstår, kjør igjen.`
            : `Beriket ${enriched} produkter.`,
        data: { processed: candidates.length, total, enriched },
      });
    } catch (error) {
      console.error("equipment-admin enrich error:", error);
      res.status(500).json({ error: "Berikelse feilet" });
    }
  });
}
