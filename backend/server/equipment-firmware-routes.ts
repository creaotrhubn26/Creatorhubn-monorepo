/**
 * equipment-firmware-routes.ts
 *
 * Standalone modul for /api/equipment/{software,software-updates,firmware-updates,
 * inventory,maintenance-schedule,rentals,images,sync-firmware}.
 * Ekstraktert fra backend/server/index.ts (linje 13060-13758).
 *
 * 9 routes:
 *   - GET  /api/equipment/software
 *   - GET  /api/equipment/software-updates
 *   - GET  /api/equipment/firmware-updates/:userId
 *   - GET  /api/equipment/inventory
 *   - GET  /api/equipment/maintenance-schedule
 *   - GET  /api/equipment/rentals
 *   - GET  /api/equipment/images
 *   - POST /api/equipment/inventory
 *   - POST /api/equipment/sync-firmware
 *
 * NB: setupRoleRoomVendorLinksRoutes-call var historisk wedged inn mellom
 * firmware-updates og inventory; flyttet til top-level setup-blokk i index.ts
 * som del av denne ekstraksjonen.
 */

import type express from "express";
import type { Pool } from "pg";
import { eq, and, desc, asc, inArray, sql } from "drizzle-orm";
import {
  type CompatCatalogItem,
  type CompatSoftwareCatalogEntry,
  type EquipmentImageAttachmentRow,
  type EquipmentImageTarget,
  type EquipmentImageEnvelope,
  type EquipmentRow,
  type InventoryRecommendedMemoryCardSummary,
  type FirmwareSeedCandidate,
  type DiscoveryFirmwareSyncResult,
  type SoftwareCatalogRow,
  type SoftwareUpdateRow,
} from "./index";

export interface EquipmentFirmwareRoutesDeps {
  app: express.Application;
  pool: Pool;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: any;
  buildEquipmentImageAttachmentMap: (
    rows: EquipmentImageAttachmentRow[],
  ) => Map<number, EquipmentImageAttachmentRow>;
  buildInventoryRecommendedMemoryCards: (
    item: CompatCatalogItem | null,
  ) => InventoryRecommendedMemoryCardSummary[];
  ensureEquipmentImageEnvelope: (
    equipment: EquipmentImageTarget,
    attachment?: EquipmentImageAttachmentRow | null,
  ) => Promise<EquipmentImageEnvelope | null>;
  ensureFirmwareRowsForCameras: (
    cameras: FirmwareSeedCandidate[],
    options?: { liveRefresh?: boolean },
  ) => Promise<DiscoveryFirmwareSyncResult>;
  formatSoftwareCategoryLabel: (category: string | null) => string;
  loadEquipmentImageAttachments: (
    equipmentIds: number[],
  ) => Promise<EquipmentImageAttachmentRow[]>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  loadFirmwareDevices: (userId?: string | null, profession?: string | null) => Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  loadFirmwareHistory: (userId?: string | null, profession?: string | null) => Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  loadFirmwareUpdates: (userId?: string | null, profession?: string | null) => Promise<any>;
  loadFirmwareSeedCandidates: (
    type: "photo" | "video" | null,
    filters?: { userId?: string | null; profession?: string | null },
  ) => Promise<FirmwareSeedCandidate[]>;
  loadUnifiedEquipmentCatalog: () => Promise<CompatCatalogItem[]>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mapMaintenanceRow: (row: any, equipmentMap: Map<string, any>) => any;
  matchInventoryEquipmentCatalogItem: (
    catalog: CompatCatalogItem[],
    equipment: Pick<EquipmentImageTarget, "brand" | "model" | "category">,
  ) => CompatCatalogItem | null;
  parseSettings: (settings: unknown) => Record<string, unknown>;
  readString: (value: unknown) => string | null;
  resolveFallbackSoftwareCatalog: (profession: string | null) => CompatSoftwareCatalogEntry[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resolveFallbackSoftwareUpdates: (profession: string | null) => any[];
  resolveOfficialCatalogFallback: (
    item: CompatCatalogItem,
  ) => Promise<Pick<CompatCatalogItem, "imageUrl" | "productUrl"> | null>;
  resolveSoftwareCategoriesForProfession: (profession: string | null) => string[] | null;
  resolveSoftwareOrderColumn: (profession: string | null) => string;
  toIsoString: (value: unknown) => string | null;
}

export function setupEquipmentFirmwareRoutes(deps: EquipmentFirmwareRoutesDeps): void {
  const {
    app, pool, db, schema,
    buildEquipmentImageAttachmentMap,
    buildInventoryRecommendedMemoryCards,
    ensureEquipmentImageEnvelope,
    ensureFirmwareRowsForCameras,
    formatSoftwareCategoryLabel,
    loadEquipmentImageAttachments,
    loadFirmwareDevices,
    loadFirmwareHistory,
    loadFirmwareUpdates,
    loadFirmwareSeedCandidates,
    loadUnifiedEquipmentCatalog,
    mapMaintenanceRow,
    matchInventoryEquipmentCatalogItem,
    parseSettings,
    readString,
    resolveFallbackSoftwareCatalog,
    resolveFallbackSoftwareUpdates,
    resolveOfficialCatalogFallback,
    resolveSoftwareCategoriesForProfession,
    resolveSoftwareOrderColumn,
    toIsoString,
  } = deps;

  app.get("/api/equipment/software", async (req, res) => {
    const profession =
      typeof req.query.profession === "string"
        ? req.query.profession.trim().toLowerCase()
        : null;
    const categories = resolveSoftwareCategoriesForProfession(profession);

    try {
      const params: Array<string | string[]> = [];
      const whereClauses = [`COALESCE(is_active, true) = true`];

      if (categories && categories.length > 0) {
        params.push(categories);
        whereClauses.push(`category = ANY($${params.length})`);
      }

      const orderColumn = resolveSoftwareOrderColumn(profession);
      const result = await pool.query<SoftwareCatalogRow>(
        `SELECT
           id,
           name,
           vendor,
           category,
           pricing_model,
           price,
           website,
           description,
           photographer_rating,
           videographer_rating,
           overall_rating,
           current_version,
           is_recommended,
           download_url
         FROM software_database
         WHERE ${whereClauses.join(" AND ")}
         ORDER BY COALESCE(${orderColumn}, overall_rating, 0::numeric) DESC NULLS LAST, name ASC`,
        params,
      );

      if (result.rows.length === 0) {
        res.json(resolveFallbackSoftwareCatalog(profession));
        return;
      }

      const data = result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        developer: row.vendor,
        vendor: row.vendor,
        category: formatSoftwareCategoryLabel(row.category),
        pricingModel: row.pricing_model,
        price: row.price,
        website: row.website,
        description: row.description,
        photographerRating: row.photographer_rating,
        videographerRating: row.videographer_rating,
        overallRating: row.overall_rating,
        freeTrialAvailable: false,
        freeTrialDays: null,
        currentVersion: row.current_version,
        isRecommended: Boolean(row.is_recommended),
        downloadUrl: row.download_url,
      }));

      res.json(data);
    } catch (error) {
      console.error(
        "Failed to load equipment software catalog, returning fallback:",
        error,
      );
      res.json(resolveFallbackSoftwareCatalog(profession));
    }
  });

  app.get("/api/equipment/software-updates", async (req, res) => {
    const profession =
      typeof req.query.profession === "string"
        ? req.query.profession.trim().toLowerCase()
        : null;
    const categories = resolveSoftwareCategoriesForProfession(profession);

    try {
      const params: Array<string | string[]> = [];
      const whereClauses = ["1 = 1"];

      if (categories && categories.length > 0) {
        params.push(categories);
        whereClauses.push(`category = ANY($${params.length})`);
      }

      const result = await pool.query<SoftwareUpdateRow>(
        `SELECT
           id,
           software,
           vendor,
           category,
           version,
           release_date,
           update_type,
           is_latest,
           download_size,
           priority,
           source_url,
           last_verified
         FROM software_updates
         WHERE ${whereClauses.join(" AND ")}
         ORDER BY
           COALESCE(is_latest, true) DESC,
           CASE COALESCE(priority, 'optional')
             WHEN 'critical' THEN 0
             WHEN 'recommended' THEN 1
             ELSE 2
           END,
           release_date DESC`,
        params,
      );

      if (result.rows.length === 0) {
        res.json(resolveFallbackSoftwareUpdates(profession));
        return;
      }

      const data = result.rows.map((row) => ({
        id: row.id,
        softwareName: row.software,
        vendor: row.vendor,
        category: formatSoftwareCategoryLabel(row.category),
        version: row.version,
        releaseDate: row.release_date,
        updateType: row.update_type,
        isLatest: row.is_latest ?? true,
        isCritical: row.priority === "critical",
        downloadSize: row.download_size,
        downloadUrl: row.source_url,
        priority: row.priority || "optional",
        lastVerified: row.last_verified,
      }));

      res.json(data);
    } catch (error) {
      console.error(
        "Failed to load equipment software updates, returning fallback:",
        error,
      );
      res.json(resolveFallbackSoftwareUpdates(profession));
    }
  });

  app.get("/api/equipment/firmware-updates/:userId", async (req, res) => {
    try {
      const userIdRaw = req.params.userId;
      const userId = userIdRaw && userIdRaw !== "guest" ? userIdRaw : null;
      const profession =
        typeof req.query.profession === "string" ? req.query.profession : null;
      const firmwareCandidates = await loadFirmwareSeedCandidates(null, {
        userId,
        profession,
      });
      await ensureFirmwareRowsForCameras(firmwareCandidates);
      const updates = await loadFirmwareUpdates(userId, profession);
      res.json(updates);
    } catch (error) {
      console.error("Firmware compatibility endpoint error:", error);
      res.status(500).json({ error: "Failed to load firmware updates" });
    }
  });

  // ── role-room/vendor-links setup-call flyttet til top-level setup-blokken.

  app.get("/api/equipment/inventory", async (req, res) => {
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

      const rows = await db
        .select()
        .from(schema.userEquipment)
        .where(conditions.length ? and(...conditions) : sql`true`)
        .orderBy(desc(schema.userEquipment.createdAt));

      const attachments = buildEquipmentImageAttachmentMap(
        await loadEquipmentImageAttachments(
          (rows as EquipmentRow[]).map((item) => Number(item.id)),
        ),
      );
      const catalog = await loadUnifiedEquipmentCatalog();

      const inventory = [];
      for (const item of rows) {
        const settings = parseSettings(item.settings);
        const equipmentTarget: EquipmentImageTarget = {
          id: Number(item.id),
          userId: item.userId,
          brand: item.brand,
          model: item.model,
          category: item.category,
          imageUrl: item.imageUrl,
          settings: item.settings,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        };
        const imageEnvelope = await ensureEquipmentImageEnvelope(
          equipmentTarget,
          attachments.get(Number(item.id)),
        );
        const catalogMatch = matchInventoryEquipmentCatalogItem(catalog, equipmentTarget);
        const officialCatalogFallback = catalogMatch
          ? await resolveOfficialCatalogFallback(catalogMatch)
          : null;
        const supplierUrl =
          imageEnvelope?.officialUrl ||
          readString(settings.supplierUrl) ||
          readString(officialCatalogFallback?.productUrl) ||
          readString(catalogMatch?.productUrl) ||
          null;
        const recommendedMemoryCards = buildInventoryRecommendedMemoryCards(catalogMatch);
        const catalogSpecifications = catalogMatch?.specifications || null;
        const catalogImageUrl =
          readString(catalogMatch?.imageUrl) ||
          readString(officialCatalogFallback?.imageUrl) ||
          null;

        inventory.push({
          id: item.id,
          userId: item.userId,
          profession: item.userType,
          name:
            readString(settings.name) || `${item.brand} ${item.model}`.trim(),
          brand: item.brand,
          model: item.model,
          category: item.category,
          status: readString(settings.status) || item.condition || "available",
          condition: readString(settings.condition) || item.condition || null,
          imageUrl:
            imageEnvelope?.imageUrl ||
            readString(item.imageUrl) ||
            catalogImageUrl,
          supplierUrl,
          purchaseVendor:
            supplierUrl && supplierUrl.includes("foto.no")
              ? "Foto.no"
              : supplierUrl
                ? null
                : readString(catalogMatch?.norwegianSupplier) || null,
          catalogDescription: readString(catalogMatch?.description) || null,
          catalogSpecifications,
          imageSource:
            imageEnvelope?.source || readString(settings.imageSource) || null,
          specifications: settings.specifications ?? {},
          recommendedMemoryCards,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        });
      }

      res.json(inventory);
    } catch (error) {
      console.error("Equipment inventory list error:", error);
      res.status(500).json({ error: "Failed to load equipment inventory" });
    }
  });

  app.get("/api/equipment/maintenance-schedule", async (req, res) => {
    try {
      const userId = readString(req.query.userId) || "";
      const profession = readString(req.query.profession);

      if (!userId && !profession) {
        res.json([]);
        return;
      }

      const equipmentConditions = [];
      if (userId) {
        equipmentConditions.push(eq(schema.userEquipment.userId, userId));
      }
      if (profession) {
        equipmentConditions.push(eq(schema.userEquipment.userType, profession));
      }

      const equipmentRows = await db
        .select()
        .from(schema.userEquipment)
        .where(
          equipmentConditions.length ? and(...equipmentConditions) : sql`true`,
        );

      const equipmentMap = new Map<string, EquipmentRow>();
      const equipmentIds = (equipmentRows as EquipmentRow[]).map((item) => {
        const key = String(item.id);
        equipmentMap.set(key, item);
        return key;
      });

      if (profession && equipmentIds.length === 0) {
        res.json([]);
        return;
      }

      const maintenanceConditions = [];
      if (userId) {
        maintenanceConditions.push(eq(schema.equipmentMaintenance.userId, userId));
      }
      if (profession && equipmentIds.length > 0) {
        maintenanceConditions.push(
          inArray(schema.equipmentMaintenance.equipmentId, equipmentIds),
        );
      }

      if (maintenanceConditions.length === 0) {
        res.json([]);
        return;
      }

      const rows = await db
        .select()
        .from(schema.equipmentMaintenance)
        .where(and(...maintenanceConditions))
        .orderBy(desc(schema.equipmentMaintenance.createdAt));

      const data = rows.map((row: any) => {
        const mapped = mapMaintenanceRow(row, equipmentMap);
        return {
          id: row.id,
          equipmentId: row.equipmentId,
          equipmentName: mapped.equipmentName,
          maintenanceType: row.maintenanceType,
          description: mapped.title || row.description,
          serviceProvider: row.serviceProvider || "",
          warrantyExtended: Boolean(row.warrantyExtended),
          serviceNotes: row.serviceNotes || "",
          scheduledDate: toIsoString(row.scheduledDate) || mapped.scheduledDate,
          completedDate: toIsoString(row.completedDate),
          nextScheduledDate: toIsoString(row.nextScheduledDate),
          cost: row.cost,
          status: mapped.status,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        };
      });

      res.json(data);
    } catch (error) {
      console.error("Equipment maintenance schedule error:", error);
      res.status(500).json({ error: "Failed to load maintenance schedule" });
    }
  });

  app.get("/api/equipment/rentals", async (req, res) => {
    try {
      const userId = readString(req.query.userId) || "";
      const profession = readString(req.query.profession);

      if (!userId && !profession) {
        res.json([]);
        return;
      }

      const equipmentConditions = [];
      if (userId) {
        equipmentConditions.push(eq(schema.userEquipment.userId, userId));
      }
      if (profession) {
        equipmentConditions.push(eq(schema.userEquipment.userType, profession));
      }

      const equipmentRows = await db
        .select({
          id: schema.userEquipment.id,
          brand: schema.userEquipment.brand,
          model: schema.userEquipment.model,
        })
        .from(schema.userEquipment)
        .where(
          equipmentConditions.length ? and(...equipmentConditions) : sql`true`,
        );

      const equipmentMap = new Map(
        (equipmentRows as EquipmentRow[]).map((row) => [
          String(row.id),
          `${row.brand} ${row.model}`.trim(),
        ]),
      );
      const equipmentIds = (equipmentRows as EquipmentRow[])
        .map((row) => row.id)
        .filter((id): id is number => typeof id === "number" && Number.isFinite(id));

      if (profession && equipmentIds.length === 0) {
        res.json([]);
        return;
      }

      const rentalConditions = [];
      if (userId) {
        rentalConditions.push(eq(schema.equipmentRentals.userId, userId));
      }
      if (profession && equipmentIds.length > 0) {
        rentalConditions.push(
          inArray(schema.equipmentRentals.equipmentId, equipmentIds),
        );
      }

      if (rentalConditions.length === 0) {
        res.json([]);
        return;
      }

      const rows = await db
        .select()
        .from(schema.equipmentRentals)
        .where(and(...rentalConditions))
        .orderBy(desc(schema.equipmentRentals.rentalStartDate));

      const data = rows.map((row: any) => ({
        id: row.id,
        equipmentId: row.equipmentId,
        equipmentName:
          equipmentMap.get(String(row.equipmentId || "")) || "Ukjent utstyr",
        rentalCompany: row.rentalCompany || "",
        rentalStartDate:
          toIsoString(row.rentalStartDate) || new Date().toISOString(),
        rentalEndDate: toIsoString(row.rentalEndDate) || new Date().toISOString(),
        rentalCost: row.rentalCost,
        projectId: row.projectId,
        clientName: row.clientName || "",
        status: row.status || "active",
        returnCondition: row.returnCondition,
        lateFees: row.lateFees,
        rentalAgreementUrl: row.rentalAgreementUrl,
        damageNotes: row.damageNotes,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }));

      res.json(data);
    } catch (error) {
      console.error("Equipment rentals error:", error);
      res.status(500).json({ error: "Failed to load equipment rentals" });
    }
  });

  app.get("/api/equipment/images", async (req, res) => {
    try {
      const userId = readString(req.query.userId) || "";
      const profession = readString(req.query.profession);

      if (!userId && !profession) {
        res.json([]);
        return;
      }

      const equipmentConditions = [];
      if (userId) {
        equipmentConditions.push(eq(schema.userEquipment.userId, userId));
      }
      if (profession) {
        equipmentConditions.push(eq(schema.userEquipment.userType, profession));
      }

      const equipmentRows = await db
        .select({
          id: schema.userEquipment.id,
          userId: schema.userEquipment.userId,
          brand: schema.userEquipment.brand,
          model: schema.userEquipment.model,
          category: schema.userEquipment.category,
          imageUrl: schema.userEquipment.imageUrl,
          settings: schema.userEquipment.settings,
          createdAt: schema.userEquipment.createdAt,
          updatedAt: schema.userEquipment.updatedAt,
        })
        .from(schema.userEquipment)
        .where(
          equipmentConditions.length ? and(...equipmentConditions) : sql`true`,
        );

      if (equipmentRows.length === 0) {
        res.json([]);
        return;
      }

      const attachments = buildEquipmentImageAttachmentMap(
        await loadEquipmentImageAttachments(
          (equipmentRows as EquipmentRow[]).map((row) => Number(row.id)),
        ),
      );

      const data = [];
      for (const row of equipmentRows as EquipmentRow[]) {
        const equipmentTarget: EquipmentImageTarget = {
          id: Number(row.id),
          userId: row.userId,
          brand: row.brand,
          model: row.model,
          category: row.category,
          imageUrl: row.imageUrl,
          settings: row.settings,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        };
        const attachment = attachments.get(Number(row.id));
        const imageEnvelope = await ensureEquipmentImageEnvelope(
          equipmentTarget,
          attachment,
        );
        if (!imageEnvelope) {
          continue;
        }

        data.push({
          id: attachment?.id || row.id,
          equipmentId: row.id,
          equipmentName: `${row.brand} ${row.model}`.trim(),
          brand: row.brand,
          model: row.model,
          category: row.category,
          imageUrl: imageEnvelope.imageUrl,
          officialUrl: imageEnvelope.officialUrl,
          imageType: imageEnvelope.source === "official_norwegian" ? "official" : "equipment",
          description: imageEnvelope.description,
          isPrimary: true,
          isOfficial: imageEnvelope.source === "official_norwegian",
          verified: imageEnvelope.source === "official_norwegian",
          source: imageEnvelope.source,
          createdAt: imageEnvelope.createdAt,
          updatedAt: imageEnvelope.updatedAt,
        });
      }

      res.json(data);
    } catch (error) {
      console.error("Equipment images error:", error);
      res.status(500).json({ error: "Failed to load equipment images" });
    }
  });

  app.post("/api/equipment/inventory", async (req, res) => {
    try {
      const {
        userId,
        profession,
        name,
        brand,
        model,
        category,
        imageUrl,
        specifications,
        status,
        condition,
      } = req.body || {};

      if (!userId || !brand || !model) {
        res.status(400).json({ error: "Missing required fields" });
        return;
      }

      const mergedSettings = {
        name: typeof name === "string" ? name : `${brand} ${model}`,
        imageUrl: typeof imageUrl === "string" ? imageUrl : null,
        specifications:
          specifications && typeof specifications === "object"
            ? specifications
            : {},
        status: typeof status === "string" ? status : "available",
        condition:
          typeof condition === "string"
            ? condition
            : typeof status === "string"
              ? status
              : "available",
      };

      const [inserted] = await db
        .insert(schema.userEquipment)
        .values({
          userId,
          userType: typeof profession === "string" ? profession : null,
          brand,
          model,
          category: typeof category === "string" ? category : null,
          imageUrl: typeof imageUrl === "string" ? imageUrl : null,
          condition:
            typeof condition === "string"
              ? condition
              : typeof status === "string"
                ? status
                : "available",
          settings: mergedSettings,
        })
        .returning();

      const insertedTarget: EquipmentImageTarget = {
        id: Number(inserted.id),
        userId: inserted.userId,
        brand: inserted.brand,
        model: inserted.model,
        category: inserted.category,
        imageUrl: inserted.imageUrl,
        settings: inserted.settings,
        createdAt: inserted.createdAt,
        updatedAt: inserted.updatedAt,
      };
      const imageEnvelope = await ensureEquipmentImageEnvelope(insertedTarget);
      const catalog = await loadUnifiedEquipmentCatalog();
      const catalogMatch = matchInventoryEquipmentCatalogItem(catalog, insertedTarget);
      const officialCatalogFallback = catalogMatch
        ? await resolveOfficialCatalogFallback(catalogMatch)
        : null;
      const supplierUrl =
        imageEnvelope?.officialUrl ||
        readString(officialCatalogFallback?.productUrl) ||
        readString(catalogMatch?.productUrl) ||
        null;
      const recommendedMemoryCards = buildInventoryRecommendedMemoryCards(catalogMatch);
      const catalogSpecifications = catalogMatch?.specifications || null;
      const catalogImageUrl =
        readString(catalogMatch?.imageUrl) ||
        readString(officialCatalogFallback?.imageUrl) ||
        null;

      res.status(201).json({
        id: inserted.id,
        userId: inserted.userId,
        profession: inserted.userType,
        name: mergedSettings.name,
        brand: inserted.brand,
        model: inserted.model,
        category: inserted.category,
        status: mergedSettings.status,
        condition: mergedSettings.condition,
        imageUrl: imageEnvelope?.imageUrl || mergedSettings.imageUrl || catalogImageUrl,
        supplierUrl,
        purchaseVendor:
          supplierUrl && supplierUrl.includes("foto.no")
            ? "Foto.no"
            : supplierUrl
              ? null
              : readString(catalogMatch?.norwegianSupplier) || null,
        catalogDescription: readString(catalogMatch?.description) || null,
        catalogSpecifications,
        imageSource: imageEnvelope?.source || null,
        specifications: mergedSettings.specifications,
        recommendedMemoryCards,
        createdAt: inserted.createdAt,
        updatedAt: inserted.updatedAt,
      });
    } catch (error) {
      console.error("Equipment inventory create error:", error);
      res.status(500).json({ error: "Failed to create inventory item" });
    }
  });

  app.post("/api/equipment/sync-firmware", async (req, res) => {
    try {
      const userId =
        typeof req.body?.userId === "string"
          ? req.body.userId
          : typeof req.query.userId === "string"
            ? req.query.userId
            : null;
      const profession =
        typeof req.body?.profession === "string"
          ? req.body.profession
          : typeof req.query.profession === "string"
            ? req.query.profession
            : null;

      const firmwareCandidates = await loadFirmwareSeedCandidates(null, {
        userId,
        profession,
      });
      const firmwareSync = await ensureFirmwareRowsForCameras(firmwareCandidates, {
        liveRefresh: true,
      });
      const updates = await loadFirmwareUpdates(userId, profession);
      const devices = await loadFirmwareDevices(userId, profession);
      const history = await loadFirmwareHistory(userId, profession);

      res.json({
        success: true,
        checkedAt: new Date().toISOString(),
        updates,
        devices,
        history,
        updatesCount: updates.length,
        firmwareSync,
      });
    } catch (error) {
      console.error("Firmware sync compatibility endpoint error:", error);
      res.status(500).json({ error: "Failed to sync firmware updates" });
    }
  });
}
