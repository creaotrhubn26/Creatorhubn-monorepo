/**
 * equipment-discovery-routes.ts
 *
 * Standalone modul for de første 7 /api/equipment/*-rutene
 * (discovery + health + cameras + memory-cards + audio-storage + audio-interfaces).
 * Ekstraktert fra backend/server/index.ts (linje 10786-11406).
 *
 * 7 routes:
 *   - POST /api/equipment/discovery/sync
 *   - GET  /api/equipment/discovery/status
 *   - GET  /api/equipment/health
 *   - GET  /api/equipment/cameras
 *   - GET  /api/equipment/memory-cards
 *   - GET  /api/equipment/audio-storage-devices
 *   - GET  /api/equipment/audio-interfaces
 *
 * Eksplisitte typer på alle deps — ingen any-svekkelser. Importerer
 * delte typer fra index.ts som er gjort til exports.
 */

import type express from "express";
import {
  type CameraRecord,
  type DiscoveryCameraType,
  type DiscoverySyncStatus,
  type DiscoveryFirmwareSyncResult,
  type FirmwareSeedCandidate,
} from "./index";
// External data stores — importeres direkte fordi de er rene
// data-konstanter (frontend-shared, kostnadsfri å importere på modul-load).
import {
  MEMORY_CARD_TYPES as MEMORY_CARD_TYPES_DB,
  type MemoryCardType,
} from "../../frontend/client/src/data/memory-card-database.ts";
import {
  AUDIO_STORAGE_DEVICE_DATABASE,
  searchAudioStorageDevices,
} from "../../frontend/client/src/data/audio-storage-device-database.ts";

export interface EquipmentDiscoveryRoutesDeps {
  app: express.Application;
  /** EQUIPMENT_DISCOVERY_STATUS (mut-eres av sync-handler). */
  EQUIPMENT_DISCOVERY_STATUS: Record<DiscoveryCameraType, DiscoverySyncStatus>;
  /** Runtime camera-store (sync-handler skriver inn nye records). */
  EQUIPMENT_CAMERA_STORE: Record<DiscoveryCameraType, CameraRecord[]>;
  /** Catalog import-store (statisk read-side). */
  CATALOG_CAMERA_STORE: Record<DiscoveryCameraType, CameraRecord[]>;
  /** Verdens-katalog (frontend/shared-derived). */
  WORLD_CAMERA_STORE: Record<DiscoveryCameraType, CameraRecord[]>;
  /** Release-registry-store. */
  RELEASE_REGISTRY_STORE: Record<DiscoveryCameraType, CameraRecord[]>;
  normalizeCameraCategory: (value: string) => string;
  parseLimitParam: (raw: unknown, fallbackValue: number) => number;
  buildCameraRecord: (input: Omit<CameraRecord, "sourceMeta">) => CameraRecord;
  buildDiscoveryCandidates: (type: DiscoveryCameraType) => CameraRecord[];
  ensureFirmwareRowsForCameras: (
    cameras: FirmwareSeedCandidate[],
    options?: { liveRefresh?: boolean },
  ) => Promise<DiscoveryFirmwareSyncResult>;
  getCameraArrayByType: (type: DiscoveryCameraType) => CameraRecord[];
  /** Matcher index.ts:7194 — { totalCameras, newCameras, recentlyUpdated }. */
  getDiscoveryStats: (type: DiscoveryCameraType) => {
    totalCameras: number;
    newCameras: number;
    recentlyUpdated: number;
  };
  getMemoryCardTypesByCameraFromDatabase: (cameraId: string) => MemoryCardType[];
  isNetflixCertifiedCineCamera: (
    camera: Pick<CameraRecord, "brand" | "model" | "category">,
  ) => boolean;
  loadDatabaseCameraStore: () => Promise<CameraRecord[]>;
  loadFirmwareSeedCandidates: (
    type: DiscoveryCameraType | null,
    filters?: { userId?: string | null; profession?: string | null },
  ) => Promise<FirmwareSeedCandidate[]>;
  loadLegacyCameraStore: () => Promise<
    Record<DiscoveryCameraType, CameraRecord[]>
  >;
  mergeCameraLists: (
    base: CameraRecord[],
    extras: CameraRecord[],
  ) => CameraRecord[];
  resolveDiscoveryType: (value: unknown) => DiscoveryCameraType | null;
}

export function setupEquipmentDiscoveryRoutes(deps: EquipmentDiscoveryRoutesDeps): void {
  const {
    app,
    EQUIPMENT_DISCOVERY_STATUS,
    EQUIPMENT_CAMERA_STORE,
    CATALOG_CAMERA_STORE,
    WORLD_CAMERA_STORE,
    RELEASE_REGISTRY_STORE,
    normalizeCameraCategory,
    parseLimitParam,
    buildCameraRecord, buildDiscoveryCandidates,
    ensureFirmwareRowsForCameras,
    getCameraArrayByType, getDiscoveryStats,
    getMemoryCardTypesByCameraFromDatabase,
    isNetflixCertifiedCineCamera,
    loadDatabaseCameraStore, loadFirmwareSeedCandidates, loadLegacyCameraStore,
    mergeCameraLists, resolveDiscoveryType,
  } = deps;


  app.post("/api/equipment/discovery/sync", async (req, res) => {
    try {
      const type = resolveDiscoveryType(req.query.type);
      if (!type) {
        res.status(400).json({ error: "Invalid type. Use photo|video" });
        return;
      }

      const nowIso = new Date().toISOString();
      const syncId = `${type}-${Date.now()}`;
      const candidates = buildDiscoveryCandidates(type);
      const store = getCameraArrayByType(type);

      const byId = new Map(store.map((camera) => [camera.id, camera]));
      const byExternalId = new Map(
        store.map((camera) => [camera.externalId, camera.id]),
      );

      let inserted = 0;
      let updated = 0;
      let rejected = 0;
      let conflicts = 0;

      candidates.forEach((candidate) => {
        const existingId = byId.has(candidate.id)
          ? candidate.id
          : byExternalId.get(candidate.externalId);
        if (!existingId) {
          store.push(candidate);
          byId.set(candidate.id, candidate);
          byExternalId.set(candidate.externalId, candidate.id);
          inserted += 1;
          return;
        }

        const existing = byId.get(existingId);
        if (!existing) {
          rejected += 1;
          return;
        }

        if (
          existing.externalId !== candidate.externalId &&
          existing.id === candidate.id
        ) {
          conflicts += 1;
          return;
        }

        const merged = buildCameraRecord({
          ...existing,
          ...candidate,
          id: existing.id,
          externalId: existing.externalId,
          source: "discovery",
          lastSeenAt: nowIso,
          lastUpdated: nowIso,
          version: Math.max(existing.version, candidate.version) + 1,
          specs: { ...existing.specs, ...candidate.specs },
        });

        const hasMeaningfulChange =
          existing.description !== merged.description ||
          JSON.stringify(existing.features) !== JSON.stringify(merged.features) ||
          JSON.stringify(existing.logFormats ?? []) !==
            JSON.stringify(merged.logFormats ?? []) ||
          JSON.stringify(existing.resolution ?? []) !==
            JSON.stringify(merged.resolution ?? []);

        if (hasMeaningfulChange) {
          const index = store.findIndex((camera) => camera.id === existing.id);
          if (index >= 0) {
            store[index] = merged;
          }
          byId.set(existing.id, merged);
          updated += 1;
        }
      });

      const firmwareCandidates = await loadFirmwareSeedCandidates(type);
      const firmwareSync = await ensureFirmwareRowsForCameras(firmwareCandidates, {
        liveRefresh: true,
      });

      EQUIPMENT_DISCOVERY_STATUS[type] = {
        ...EQUIPMENT_DISCOVERY_STATUS[type],
        lastUpdate: nowIso,
        syncId,
        inserted,
        updated,
        rejected,
        conflicts,
        source: `backend-${type}-sync`,
      };

      res.json({
        success: true,
        type,
        source: EQUIPMENT_DISCOVERY_STATUS[type].source,
        timestamp: nowIso,
        syncId,
        inserted,
        updated,
        rejected,
        conflicts,
        totalCameras: store.length,
        firmwareSync,
      });
    } catch (error) {
      console.error("Discovery sync error:", error);
      res.status(500).json({ error: "Failed to run discovery sync" });
    }
  });

  app.get("/api/equipment/discovery/status", (req, res) => {
    const type = resolveDiscoveryType(req.query.type);
    if (!type) {
      res.status(400).json({ error: "Invalid type. Use photo|video" });
      return;
    }

    const status = EQUIPMENT_DISCOVERY_STATUS[type];
    const stats = getDiscoveryStats(type);

    res.json({
      ...status,
      ...stats,
      type,
    });
  });

  app.get("/api/equipment/health", (_req, res) => {
    const runtimeCameraCount =
      EQUIPMENT_CAMERA_STORE.photo.length + EQUIPMENT_CAMERA_STORE.video.length;
    const catalogCameraCount =
      CATALOG_CAMERA_STORE.photo.length + CATALOG_CAMERA_STORE.video.length;
    const worldCameraCount =
      WORLD_CAMERA_STORE.photo.length + WORLD_CAMERA_STORE.video.length;
    const releaseRegistryCount =
      RELEASE_REGISTRY_STORE.photo.length + RELEASE_REGISTRY_STORE.video.length;
    const memoryCardCount = MEMORY_CARD_TYPES_DB.length;
    const audioStorageCount = AUDIO_STORAGE_DEVICE_DATABASE.length;

    res.json({
      ok: true,
      timestamp: new Date().toISOString(),
      backendSourceOfTruth: true,
      services: {
        discovery: "ready",
        cameraCatalog: "ready",
        memoryCards: "ready",
        audioStorage: "ready",
        firmware: "ready",
      },
      counters: {
        runtimeCameras: runtimeCameraCount,
        catalogCameras: catalogCameraCount,
        worldCameras: worldCameraCount,
        releaseRegistryCameras: releaseRegistryCount,
        memoryCardTypes: memoryCardCount,
        audioStorageDevices: audioStorageCount,
      },
    });
  });

  app.get("/api/equipment/cameras", async (req, res) => {
    try {
      const type = resolveDiscoveryType(req.query.type);
      const q =
        typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
      const brand =
        typeof req.query.brand === "string"
          ? req.query.brand.trim().toLowerCase()
          : "";
      const category =
        typeof req.query.category === "string"
          ? normalizeCameraCategory(req.query.category)
          : "";
      const yearFromRaw = Number(req.query.yearFrom);
      const yearToRaw = Number(req.query.yearTo);
      const yearFrom = Number.isFinite(yearFromRaw) ? yearFromRaw : 2020;
      const yearTo = Number.isFinite(yearToRaw) ? yearToRaw : 2026;
      const minYear = Math.min(yearFrom, yearTo);
      const maxYear = Math.max(yearFrom, yearTo);
      const includeUndated =
        req.query.includeUndated === "true" || req.query.includeUndated === "1";
      const netflixCertifiedOnly =
        req.query.netflixCertified === "true" ||
        req.query.netflixCertified === "1";

      const extractReleaseYear = (camera: CameraRecord): number | null => {
        if (typeof camera.releaseDate !== "string") return null;
        const trimmed = camera.releaseDate.trim();
        const match = trimmed.match(/^(\d{4})-\d{2}-\d{2}$/);
        if (!match) return null;
        const parsed = Number.parseInt(match[1], 10);
        return Number.isFinite(parsed) ? parsed : null;
      };

      const runtimeSource = type
        ? getCameraArrayByType(type)
        : [...EQUIPMENT_CAMERA_STORE.photo, ...EQUIPMENT_CAMERA_STORE.video];
      const catalogSource = type
        ? CATALOG_CAMERA_STORE[type]
        : [...CATALOG_CAMERA_STORE.photo, ...CATALOG_CAMERA_STORE.video];
      const worldSource = type
        ? WORLD_CAMERA_STORE[type]
        : [...WORLD_CAMERA_STORE.photo, ...WORLD_CAMERA_STORE.video];
      const releaseRegistrySource = type
        ? RELEASE_REGISTRY_STORE[type]
        : [...RELEASE_REGISTRY_STORE.photo, ...RELEASE_REGISTRY_STORE.video];
      const legacyStore = await loadLegacyCameraStore();
      const legacySource = type
        ? legacyStore[type]
        : [...legacyStore.photo, ...legacyStore.video];
      const databaseSourceAll = await loadDatabaseCameraStore();
      const databaseSource = type
        ? databaseSourceAll.filter((camera) => camera.type === type)
        : databaseSourceAll;

      const mergedCatalog = mergeCameraLists(runtimeSource, catalogSource);
      const mergedRegistry = mergeCameraLists(
        mergedCatalog,
        releaseRegistrySource,
      );
      const mergedWorld = mergeCameraLists(mergedRegistry, worldSource);
      const mergedLegacy = mergeCameraLists(mergedWorld, legacySource);
      const source = mergeCameraLists(mergedLegacy, databaseSource);

      const baseFiltered = source.filter((camera) => {
        if (brand && camera.brand.toLowerCase() !== brand) return false;
        if (category && normalizeCameraCategory(camera.category) !== category)
          return false;
        if (!q) return true;
        return [camera.brand, camera.model, camera.description, camera.category]
          .join(" ")
          .toLowerCase()
          .includes(q);
      });

      const withDateMeta = baseFiltered.map((camera) => {
        const releaseYear = extractReleaseYear(camera);
        const isNetflixCertified = isNetflixCertifiedCineCamera(camera);
        return {
          camera,
          releaseYear,
          hasReleaseDate: releaseYear !== null,
          inYearRange:
            releaseYear !== null &&
            releaseYear >= minYear &&
            releaseYear <= maxYear,
          isNetflixCertified,
        };
      });

      const undated = withDateMeta.filter((entry) => !entry.hasReleaseDate);
      const outOfRange = withDateMeta.filter(
        (entry) => entry.hasReleaseDate && !entry.inYearRange,
      );

      const filtered = withDateMeta
        .filter((entry) => {
          if (netflixCertifiedOnly && !entry.isNetflixCertified) return false;
          if (entry.inYearRange) return true;
          if (includeUndated && !entry.hasReleaseDate) return true;
          return false;
        })
        .map((entry) => ({
          ...entry.camera,
          releaseYear: entry.releaseYear,
          hasReleaseDate: entry.hasReleaseDate,
          isNetflixCertified: entry.isNetflixCertified,
        }))
        .sort((a, b) => {
          const byBrand = a.brand.localeCompare(b.brand, "nb");
          if (byBrand !== 0) return byBrand;
          return a.model.localeCompare(b.model, "nb");
        });

      res.json({
        success: true,
        type: type ?? "all",
        total: filtered.length,
        sources: {
          runtime: runtimeSource.length,
          catalog: catalogSource.length,
          releaseRegistry: releaseRegistrySource.length,
          world: worldSource.length,
          legacy: legacySource.length,
          database: databaseSource.length,
        },
        filters: {
          minYear,
          maxYear,
          includeUndated,
          netflixCertifiedOnly,
        },
        quality: {
          matchedBeforeDateFilter: baseFiltered.length,
          excludedUndated: includeUndated ? 0 : undated.length,
          excludedOutOfRange: outOfRange.length,
          undatedCandidates: undated.slice(0, 25).map((entry) => ({
            id: entry.camera.id,
            brand: entry.camera.brand,
            model: entry.camera.model,
            category: entry.camera.category,
            source: entry.camera.source,
          })),
        },
        data: filtered,
        results: filtered,
        cameras: filtered,
      });
    } catch (error) {
      console.error(
        "Equipment cameras endpoint failed, returning runtime fallback:",
        error,
      );
      const type = resolveDiscoveryType(req.query.type);
      const fallback = type
        ? getCameraArrayByType(type)
        : [...EQUIPMENT_CAMERA_STORE.photo, ...EQUIPMENT_CAMERA_STORE.video];
      const trimmed = fallback.slice(0, 500);
      res.json({
        success: false,
        fallback: true,
        type: type ?? "all",
        total: trimmed.length,
        data: trimmed,
        results: trimmed,
        cameras: trimmed,
      });
    }
  });

  app.get("/api/equipment/memory-cards", (req, res) => {
    const cameraId =
      typeof req.query.cameraId === "string" ? req.query.cameraId.trim() : "";
    const sourceCards = cameraId
      ? getMemoryCardTypesByCameraFromDatabase(cameraId)
      : MEMORY_CARD_TYPES_DB;

    type MemoryCardApiResponseItem = {
      id: string;
      name: string;
      fullName: string;
      category: string;
      readSpeed: number;
      writeSpeed: number;
      maxCapacity: string;
      commonCapacities: string[];
      videoClass?: string;
      uhsClass?: string;
      priceRange: string;
      reliability: string;
      description: string;
      icon: string;
      color: string;
      pricePerGB: {
        budget: number;
        mid: number;
        premium: number;
        professional: number;
      };
    };

    const cards: MemoryCardApiResponseItem[] = sourceCards.map((card) => ({
      id: card.id,
      name: card.name,
      fullName: card.fullName,
      category: card.category,
      readSpeed: card.readSpeed,
      writeSpeed: card.writeSpeed,
      maxCapacity: card.maxCapacity,
      commonCapacities: card.commonCapacities,
      videoClass: card.videoClass,
      uhsClass: card.uhsClass,
      priceRange: card.priceRange,
      reliability: card.reliability,
      description: card.description,
      icon: card.icon,
      color: card.color,
      pricePerGB: card.pricePerGB,
    }));

    const storageMediaOptions: MemoryCardApiResponseItem[] = [
      {
        id: "storage-ssd",
        name: "SSD",
        fullName: "SSD (ekstern/produksjon)",
        category: "storage-media",
        readSpeed: 0,
        writeSpeed: 0,
        maxCapacity: "8TB",
        commonCapacities: ["500GB", "1TB", "2TB", "4TB"],
        videoClass: "",
        uhsClass: "",
        priceRange: "mid",
        reliability: "excellent",
        description: "Rask lokal lagring for backup på sett.",
        icon: "💽",
        color: "#00acc1",
        pricePerGB: { budget: 0, mid: 0, premium: 0, professional: 0 },
      },
      {
        id: "storage-hdd",
        name: "HDD",
        fullName: "HDD (ekstern disk)",
        category: "storage-media",
        readSpeed: 0,
        writeSpeed: 0,
        maxCapacity: "24TB",
        commonCapacities: ["1TB", "2TB", "4TB", "8TB"],
        videoClass: "",
        uhsClass: "",
        priceRange: "budget",
        reliability: "good",
        description: "Kostnadseffektiv lagring for ekstra kopi.",
        icon: "🗄️",
        color: "#607d8b",
        pricePerGB: { budget: 0, mid: 0, premium: 0, professional: 0 },
      },
      {
        id: "storage-nas",
        name: "NAS",
        fullName: "NAS-lagring",
        category: "storage-media",
        readSpeed: 0,
        writeSpeed: 0,
        maxCapacity: "64TB+",
        commonCapacities: ["4TB", "8TB", "16TB", "32TB"],
        videoClass: "",
        uhsClass: "",
        priceRange: "premium",
        reliability: "professional",
        description: "Nettverkslagring for team-tilgang og sikkerhetskopi.",
        icon: "🖧",
        color: "#5e35b1",
        pricePerGB: { budget: 0, mid: 0, premium: 0, professional: 0 },
      },
      {
        id: "storage-raid",
        name: "RAID",
        fullName: "RAID-lagring",
        category: "storage-media",
        readSpeed: 0,
        writeSpeed: 0,
        maxCapacity: "64TB+",
        commonCapacities: ["4TB", "8TB", "16TB", "32TB"],
        videoClass: "",
        uhsClass: "",
        priceRange: "premium",
        reliability: "professional",
        description: "Redundant lagring for robust backup-flyt.",
        icon: "🧱",
        color: "#3949ab",
        pricePerGB: { budget: 0, mid: 0, premium: 0, professional: 0 },
      },
      {
        id: "storage-usb",
        name: "USB",
        fullName: "USB-lagring",
        category: "storage-media",
        readSpeed: 0,
        writeSpeed: 0,
        maxCapacity: "2TB",
        commonCapacities: ["64GB", "128GB", "256GB", "512GB", "1TB"],
        videoClass: "",
        uhsClass: "",
        priceRange: "budget",
        reliability: "good",
        description: "Bærbar lagring for overføring i felt.",
        icon: "🔌",
        color: "#26a69a",
        pricePerGB: { budget: 0, mid: 0, premium: 0, professional: 0 },
      },
    ];

    const cardById = new Map<string, MemoryCardApiResponseItem>();
    for (const card of [...cards, ...storageMediaOptions]) {
      if (!cardById.has(card.id)) {
        cardById.set(card.id, card);
      }
    }
    const mergedCards = Array.from(cardById.values());
    const cardTypeIds = mergedCards.map((card) => card.id);

    res.json({
      success: true,
      cameraId: cameraId || null,
      cardTypeIds,
      total: mergedCards.length,
      source: "memory-card-database.ts + storage-media-defaults",
      data: mergedCards,
      results: mergedCards,
    });
  });

  app.get("/api/equipment/audio-storage-devices", (req, res) => {
    try {
      const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
      const brand =
        typeof req.query.brand === "string" ? req.query.brand.trim() : "";
      const category =
        typeof req.query.category === "string" ? req.query.category.trim() : "";
      const storageMedium =
        typeof req.query.storageMedium === "string"
          ? req.query.storageMedium.trim()
          : typeof req.query.medium === "string"
            ? req.query.medium.trim()
            : "";
      const yearFromRaw = Number(req.query.yearFrom);
      const yearToRaw = Number(req.query.yearTo);
      const yearFrom = Number.isFinite(yearFromRaw) ? yearFromRaw : 2020;
      const yearTo = Number.isFinite(yearToRaw) ? yearToRaw : 2026;
      const limit = parseLimitParam(req.query.limit, 200);

      const filtered = searchAudioStorageDevices({
        q,
        brand,
        category,
        storageMedium,
        yearFrom,
        yearTo,
      });

      const results = filtered.slice(0, limit);
      const availableCategories = Array.from(
        new Set(AUDIO_STORAGE_DEVICE_DATABASE.map((device) => device.category)),
      ).sort((a, b) => a.localeCompare(b, "nb"));
      const availableStorageMedia = Array.from(
        new Set(
          AUDIO_STORAGE_DEVICE_DATABASE.flatMap((device) => device.storageMedia),
        ),
      ).sort((a, b) => a.localeCompare(b, "nb"));

      res.json({
        success: true,
        source: "audio-storage-device-database.ts",
        total: filtered.length,
        count: results.length,
        filters: {
          q,
          brand: brand || null,
          category: category || null,
          storageMedium: storageMedium || null,
          yearFrom,
          yearTo,
          limit,
        },
        availableCategories,
        availableStorageMedia,
        data: results,
        results,
        devices: results,
      });
    } catch (error) {
      console.error(
        "Equipment audio-storage endpoint failed, returning fallback list:",
        error,
      );
      const fallback = AUDIO_STORAGE_DEVICE_DATABASE.slice(0, 400);
      res.json({
        success: false,
        fallback: true,
        source: "audio-storage-device-database.ts",
        total: fallback.length,
        count: fallback.length,
        filters: {
          q: null,
          brand: null,
          category: null,
          storageMedium: null,
          yearFrom: 2020,
          yearTo: 2026,
          limit: 400,
        },
        availableCategories: Array.from(
          new Set(fallback.map((device) => device.category)),
        ).sort((a, b) => a.localeCompare(b, "nb")),
        availableStorageMedia: Array.from(
          new Set(fallback.flatMap((device) => device.storageMedia)),
        ).sort((a, b) => a.localeCompare(b, "nb")),
        data: fallback,
        results: fallback,
        devices: fallback,
      });
    }
  });

  app.get("/api/equipment/audio-interfaces", (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const records = searchAudioStorageDevices({
      q,
      yearFrom: 2020,
      yearTo: 2026,
    }).map((device) => {
      const maxSampleRateKhz = Math.round(device.maxSampleRateHz / 1000);
      const storageFeature = `Lagring: ${device.storageMedia.join(", ")}`;
      return {
        id: device.id,
        brand: device.brand,
        model: device.model,
        type: device.category,
        inputs: Math.max(1, Math.ceil(device.channelCount / 2)),
        outputs: Math.max(1, Math.ceil(device.channelCount / 2)),
        preamps: Math.max(1, Math.ceil(device.channelCount / 2)),
        maxSampleRate: `${maxSampleRateKhz} kHz`,
        bitDepth: device.bitDepthOptions,
        features: [...device.recordingFormats, storageFeature],
        description: device.description,
        compatibility: ["macOS", "Windows", "iOS", "Android"],
        category: device.category,
        storageMedia: device.storageMedia,
        releaseYear: device.releaseYear,
      };
    });

    res.json(records);
  });
}
