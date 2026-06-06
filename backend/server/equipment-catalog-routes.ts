/**
 * equipment-catalog-routes.ts
 *
 * Standalone modul for /api/equipment/{search,brands,stats,category-icons,market-prices,lenses}.
 * Ekstraktert fra backend/server/index.ts (linje 12654-13041).
 *
 * 6 routes:
 *   - GET  /api/equipment/search              — søk i katalogen
 *   - GET  /api/equipment/brands              — unique brands
 *   - GET  /api/equipment/stats               — kategori-statistikker
 *   - POST /api/equipment/category-icons/generate
 *   - GET  /api/equipment/market-prices       — pris-intervaller per kategori
 *   - GET  /api/equipment/lenses              — lens-katalog
 *
 * Eksplisitte dep-typer matchet til faktisk impl-signatur.
 */

import type express from "express";
import {
  type CompatCatalogItem,
  type CompatGearNewsItem,
  type ResolvedSupplierEquipmentImage,
} from "./index";

export interface EquipmentCatalogRoutesDeps {
  app: express.Application;
  COMPAT_GEAR_NEWS: CompatGearNewsItem[];
  enrichCatalogItemWithPreviewImage: (item: CompatCatalogItem) => Promise<CompatCatalogItem>;
  loadGearNewsFeed: () => Promise<{
    source: "live-rss" | "compat-news";
    data: CompatGearNewsItem[];
  }>;
  loadUnifiedEquipmentCatalog: () => Promise<CompatCatalogItem[]>;
  matchesEquipmentSearchQuery: (item: CompatCatalogItem, query: string) => boolean;
  normalizeCatalogCategory: (raw: string) => string;
  normalizeProductImageCategory: (value: string) => CompatCatalogItem["category"] | null;
  parseLimitParam: (raw: unknown, fallbackValue: number) => number;
  readString: (value: unknown) => string | null;
  resolveAuthenticSupplierEquipmentImage: (
    brand: string,
    model: string,
    category?: CompatCatalogItem["category"] | null,
  ) => Promise<ResolvedSupplierEquipmentImage | null>;
}

export function setupEquipmentCatalogRoutes(deps: EquipmentCatalogRoutesDeps): void {
  const {
    app,
    COMPAT_GEAR_NEWS,
    enrichCatalogItemWithPreviewImage,
    loadGearNewsFeed,
    loadUnifiedEquipmentCatalog,
    matchesEquipmentSearchQuery,
    normalizeCatalogCategory,
    normalizeProductImageCategory,
    parseLimitParam,
    readString,
    resolveAuthenticSupplierEquipmentImage,
  } = deps;

  app.get("/api/equipment/search", async (req, res) => {
    const q =
      typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
    const brand =
      typeof req.query.brand === "string"
        ? req.query.brand.trim().toLowerCase()
        : "";
    const category = normalizeCatalogCategory(
      typeof req.query.category === "string" ? req.query.category : "",
    );
    const year =
      typeof req.query.year === "string" ? Number(req.query.year) : NaN;
    const limit = parseLimitParam(req.query.limit, 80);
    try {
      const catalog = await loadUnifiedEquipmentCatalog();
      const filtered = catalog
        .filter((item) => {
          if (brand && brand !== "alle" && item.brand.toLowerCase() !== brand)
            return false;
          if (category && item.category !== category) return false;
          if (Number.isFinite(year) && item.releaseYear !== year) return false;
          if (!q) return true;
          return matchesEquipmentSearchQuery(item, q);
        })
        .slice(0, limit);

      const previewEnriched = await Promise.all(
        filtered.map((item, index) =>
          index <
          (category === "lenses"
            ? Math.min(filtered.length, 80)
            : q || brand
              ? Math.min(filtered.length, 24)
              : 16)
            ? enrichCatalogItemWithPreviewImage(item)
            : Promise.resolve(item),
        ),
      );

      res.json({
        success: true,
        source: "unified-catalog",
        total: previewEnriched.length,
        totalAvailable: catalog.length,
        data: previewEnriched,
        results: previewEnriched,
      });
    } catch (error) {
      console.error("Failed to load unified equipment catalog:", error);
      res.status(500).json({ error: "Failed to load equipment catalog" });
    }
  });

  app.get("/api/equipment/brands", async (_req, res) => {
    try {
      const catalog = await loadUnifiedEquipmentCatalog();
      const brands = Array.from(
        new Set(
          catalog
            .map((item) => item.brand)
            .filter(
              (brand): brand is string =>
                typeof brand === "string" && brand.trim().length > 0,
            ),
        ),
      ).sort((a, b) => a.localeCompare(b, "nb"));

      res.json({
        success: true,
        data: brands,
        total: brands.length,
      });
    } catch (error) {
      console.error("Failed to load equipment brands:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to load equipment brands" });
    }
  });

  app.get("/api/equipment/stats", async (_req, res) => {
    try {
      const catalog = await loadUnifiedEquipmentCatalog();
      const releaseYears = catalog
        .map((item) => item.releaseYear)
        .filter((value): value is number => Number.isFinite(value));
      const categories = Array.from(
        new Set(
          catalog
            .map((item) => item.category)
            .filter((category) => category.trim().length > 0),
        ),
      ).sort((a, b) => a.localeCompare(b, "nb"));
      const brands = Array.from(
        new Set(
          catalog
            .map((item) => item.brand)
            .filter(
              (brand): brand is string =>
                typeof brand === "string" && brand.trim().length > 0,
            ),
        ),
      );
      const authenticItems = catalog.filter(
        (item) => item.imageUrl || item.norwegianSupplier,
      ).length;
      const catalogItems = catalog.filter(
        (item) => item.category !== "video" || item.type !== "legacy",
      ).length;

      res.json({
        success: true,
        data: {
          totalItems: catalog.length,
          authenticItems,
          catalogItems,
          brandCount: brands.length,
          categories,
          yearRange: {
            min:
              releaseYears.length > 0
                ? Math.min(...releaseYears)
                : new Date().getFullYear(),
            max:
              releaseYears.length > 0
                ? Math.max(...releaseYears)
                : new Date().getFullYear(),
          },
          lastUpdate: new Date(),
        },
      });
    } catch (error) {
      console.error("Failed to load equipment stats:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to load equipment stats" });
    }
  });

  app.post("/api/product-images/test-images", async (req, res) => {
    try {
      const requestedProducts: Array<Record<string, unknown>> = Array.isArray(
        req.body?.products,
      )
        ? req.body.products
        : [];

      if (requestedProducts.length === 0) {
        res.status(400).json({ success: false, error: "Missing products array" });
        return;
      }

      const results = (
        await Promise.all(
          requestedProducts.map(async (product) => {
            const brand = readString(product?.brand) || "";
            const model = readString(product?.model) || "";
            const categoryInput = readString(product?.category) || "";
            if (!brand || !model) return null;

            const normalizedCategory =
              normalizeProductImageCategory(categoryInput) || null;
            const resolved = await resolveAuthenticSupplierEquipmentImage(
              brand,
              model,
              normalizedCategory,
            );

            return {
              brand,
              model,
              category: categoryInput || normalizedCategory || "accessories",
              imageFound: Boolean(resolved?.imageUrl),
              imageCount: resolved?.imageUrl ? 1 : 0,
              source: resolved?.source || "unresolved",
              sampleImage: resolved?.imageUrl || null,
              officialUrl: resolved?.productUrl || null,
              thumbnail: resolved?.thumbnailUrl || resolved?.imageUrl || null,
              confidence: resolved?.confidence || 0,
              databaseStored: false,
              googleImages: resolved?.imageUrl
                ? [
                    {
                      link: resolved.imageUrl,
                      thumbnail: resolved.thumbnailUrl || resolved.imageUrl,
                    },
                  ]
                : [],
            };
          }),
        )
      ).filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

      res.json({
        success: true,
        source: "supplier-live",
        results,
      });
    } catch (error) {
      console.error("Product image test route error:", error);
      res.status(500).json({ success: false, error: "Failed to resolve product images" });
    }
  });

  app.post("/api/equipment/category-icons/generate", async (_req, res) => {
    try {
      const catalog = await loadUnifiedEquipmentCatalog();
      const iconMap: Record<string, string> = {
        cameras: "camera",
        lenses: "lens",
        flash: "flash",
        lighting: "lightbulb",
        audio: "mic",
        tripods: "tripod",
        support: "build",
        accessories: "build",
        software: "settings",
        video: "videocam",
      };
      const categories = Array.from(
        new Set(
          catalog
            .map((item) => item.category)
            .filter((category) => category.trim().length > 0),
        ),
      ).sort((a, b) => a.localeCompare(b, "nb"));

      res.json({
        success: true,
        data: categories.map((category) => ({
          category,
          icon: iconMap[category] || "category",
        })),
        total: categories.length,
      });
    } catch (error) {
      console.error("Failed to generate equipment category icons:", error);
      res
        .status(500)
        .json({
          success: false,
          error: "Failed to generate equipment category icons",
        });
    }
  });

  app.get("/api/gear-news", async (req, res) => {
    const profession =
      typeof req.query.profession === "string" ? req.query.profession : "";
    const normalizedProfession = profession.trim().toLowerCase();

    try {
      const payload = await loadGearNewsFeed();

      const filtered = normalizedProfession
        ? payload.data.filter((item) =>
            Array.isArray(item.professions)
              ? item.professions
                  .map((entry) => String(entry).toLowerCase())
                  .includes(normalizedProfession)
              : true,
          )
        : payload.data;

      res.json({
        success: true,
        source: payload.source,
        data: filtered,
        total: filtered.length,
      });
    } catch (error) {
      console.error(
        "Failed to load /api/gear-news feed, returning fallback:",
        error,
      );

      const filtered = normalizedProfession
        ? COMPAT_GEAR_NEWS.filter((item) =>
            Array.isArray(item.professions)
              ? item.professions
                  .map((entry) => String(entry).toLowerCase())
                  .includes(normalizedProfession)
              : true,
          )
        : COMPAT_GEAR_NEWS;

      res.json({
        success: true,
        source: "compat-news",
        data: filtered,
        total: filtered.length,
      });
    }
  });

  app.get("/api/gear-news/:profession/firmware", (_req, res) => {
    res.json({
      success: true,
      updatesAvailable: 2,
      data: [
        {
          id: "fw-canon-r5-1",
          device: "Canon EOS R5 Mark II",
          latestVersion: "1.2.0",
          currentVersion: "1.1.0",
          priority: "recommended",
          releaseDate: "2026-02-10",
        },
        {
          id: "fw-sony-a7s3-1",
          device: "Sony A7S III",
          latestVersion: "4.0.1",
          currentVersion: "3.2.0",
          priority: "critical",
          releaseDate: "2026-01-29",
        },
      ],
    });
  });

  app.get("/api/equipment/market-prices", async (_req, res) => {
    try {
      const catalog = await loadUnifiedEquipmentCatalog();
      const data = catalog.slice(0, 400).map((item, index) => {
        const msrp = Math.round(item.priceNOK * 1.12);
        const rating = (4.0 + (index % 7) * 0.1).toFixed(1);
        return {
          id: item.id,
          brand: item.brand,
          model: item.model,
          category: item.category,
          currentPrice: String(item.priceNOK),
          msrp: String(msrp),
          availability: item.availability,
          photographerRating: rating,
          videographerRating: rating,
          sourceUrl: `https://www.foto.no/search?q=${encodeURIComponent(`${item.brand} ${item.model}`)}`,
        };
      });

      res.json(data);
    } catch (error) {
      console.error("Failed to load market prices from unified catalog:", error);
      res.status(500).json({ error: "Failed to load market prices" });
    }
  });

  app.get("/api/equipment/lenses", async (_req, res) => {
    try {
      const catalog = await loadUnifiedEquipmentCatalog();
      const lenses = catalog
        .filter((item) => item.category === "lenses")
        .map((item) => ({
          id: item.id,
          brand: item.brand,
          model: item.model,
          description: item.description,
          focalLength:
            typeof item.specifications.focalLength === "string"
              ? item.specifications.focalLength
              : "",
          aperture:
            typeof item.specifications.maxAperture === "string"
              ? item.specifications.maxAperture
              : "",
          mount: item.mount || "",
          lensType:
            typeof item.specifications.lensType === "string"
              ? item.specifications.lensType
              : item.type || "",
          imageStabilization: Boolean(item.specifications.imageStabilization),
          weatherSealing: Boolean(item.specifications.weatherSealed),
          weight:
            typeof item.specifications.weight === "string"
              ? item.specifications.weight
              : String(item.specifications.weight || ""),
          currentPrice: String(item.priceNOK),
          imageUrl: item.imageUrl,
          productUrl: item.productUrl || null,
          norwegianSupplier: item.norwegianSupplier || null,
        }));

      res.json(lenses);
    } catch (error) {
      console.error("Failed to load equipment lenses from unified catalog:", error);
      res.status(500).json({ error: "Failed to load equipment lenses" });
    }
  });
}
