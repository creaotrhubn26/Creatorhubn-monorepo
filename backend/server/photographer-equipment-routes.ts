import express from "express";
import type { Pool } from "pg";

export interface PhotographerEquipmentRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireUserSession: (req: any, res: any) => any;
}

export function setupPhotographerEquipmentRoutes(
  deps: PhotographerEquipmentRoutesDeps,
): void {
  const { app, pool, requireUserSession } = deps;

  let photographerEquipmentSchemaReady: Promise<void> | null = null;
  function ensurePhotographerEquipmentSchema(): Promise<void> {
    if (!photographerEquipmentSchemaReady) {
      photographerEquipmentSchemaReady = (async () => {
        try {
          await pool.query(`
            ALTER TABLE user_equipment ADD COLUMN IF NOT EXISTS catalog_id VARCHAR(64);
            ALTER TABLE user_equipment ADD COLUMN IF NOT EXISTS warranty_months INTEGER;
            ALTER TABLE user_equipment ADD COLUMN IF NOT EXISTS reklamasjon_months INTEGER DEFAULT 60;
            ALTER TABLE user_equipment ADD COLUMN IF NOT EXISTS firmware_url VARCHAR(500);
            ALTER TABLE user_equipment ADD COLUMN IF NOT EXISTS latest_firmware_version VARCHAR(64);
            ALTER TABLE user_equipment ADD COLUMN IF NOT EXISTS retailer VARCHAR(128);
            ALTER TABLE user_equipment ADD COLUMN IF NOT EXISTS receipt_url VARCHAR(500);
            ALTER TABLE user_equipment ADD COLUMN IF NOT EXISTS battery_count INTEGER DEFAULT 1;
            ALTER TABLE user_equipment ADD COLUMN IF NOT EXISTS has_battery_grip BOOLEAN DEFAULT FALSE;
            ALTER TABLE user_equipment ADD COLUMN IF NOT EXISTS battery_model VARCHAR(64);
          `);
        } catch (err) {
          console.warn(
            "[photographer-equipment] schema-ensure failed:",
            err,
          );
          photographerEquipmentSchemaReady = null;
          throw err;
        }
      })();
    }
    return photographerEquipmentSchemaReady;
  }

  function computeDaysRemaining(
    purchaseDate: string | null,
    months: number | null | undefined,
  ): {
    days: number | null;
    endDate: string | null;
    totalDays: number | null;
    pct: number | null;
  } {
    if (!purchaseDate || !months || months <= 0) {
      return { days: null, endDate: null, totalDays: null, pct: null };
    }
    const pd = new Date(purchaseDate);
    if (!Number.isFinite(pd.getTime())) {
      return { days: null, endDate: null, totalDays: null, pct: null };
    }
    const end = new Date(pd);
    end.setMonth(end.getMonth() + months);
    const totalDays = Math.round((end.getTime() - pd.getTime()) / 86400000);
    const days = Math.round((end.getTime() - Date.now()) / 86400000);
    const elapsed = totalDays - days;
    const pct =
      totalDays > 0
        ? Math.max(0, Math.min(100, (elapsed / totalDays) * 100))
        : null;
    return {
      days,
      endDate: end.toISOString().slice(0, 10),
      totalDays,
      pct,
    };
  }

  app.get("/api/photographer/equipment/catalog", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const q = typeof req.query.q === "string" ? req.query.q : "";
      const { searchCatalog } = await import("./equipment-catalog.js");
      res.json({ catalog: searchCatalog(q) });
    } catch (err) {
      console.error("[equipment-catalog] failed:", err);
      res.status(500).json({ error: "catalog_failed" });
    }
  });

  app.get("/api/photographer/equipment", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      await ensurePhotographerEquipmentSchema();
      const r = await pool.query(
        `SELECT id, category, brand, model, serial_number, purchase_date,
                purchase_price, current_value, condition, notes, image_url,
                catalog_id, warranty_months, reklamasjon_months, firmware_url,
                latest_firmware_version, firmware_version, retailer, receipt_url,
                last_maintenance, next_maintenance,
                battery_count, has_battery_grip, battery_model,
                created_at, updated_at
           FROM user_equipment
          WHERE user_id = $1
          ORDER BY purchase_date DESC NULLS LAST, created_at DESC`,
        [session.userId],
      );
      const items = r.rows.map((row: Record<string, unknown>) => {
        const purchaseDate = row.purchase_date
          ? String(row.purchase_date)
          : null;
        const warrantyMonths =
          row.warranty_months != null ? Number(row.warranty_months) : null;
        const reklamasjonMonths =
          row.reklamasjon_months != null
            ? Number(row.reklamasjon_months)
            : 60;
        const warranty = computeDaysRemaining(purchaseDate, warrantyMonths);
        const reklamasjon = computeDaysRemaining(
          purchaseDate,
          reklamasjonMonths,
        );
        return {
          id: row.id,
          category: row.category ?? null,
          brand: row.brand,
          model: row.model,
          serialNumber: row.serial_number ?? null,
          purchaseDate,
          purchasePrice:
            row.purchase_price != null ? Number(row.purchase_price) : null,
          currentValue:
            row.current_value != null ? Number(row.current_value) : null,
          condition: row.condition ?? null,
          catalogId: row.catalog_id ?? null,
          imageUrl: row.image_url ?? null,
          firmwareUrl: row.firmware_url ?? null,
          firmwareVersion: row.firmware_version ?? null,
          latestFirmwareVersion: row.latest_firmware_version ?? null,
          warrantyMonths,
          reklamasjonMonths,
          warranty: {
            ...warranty,
            expired: warranty.days !== null && warranty.days < 0,
          },
          reklamasjon: {
            ...reklamasjon,
            expired: reklamasjon.days !== null && reklamasjon.days < 0,
          },
          retailer: row.retailer ?? null,
          receiptUrl: row.receipt_url ?? null,
          lastMaintenance: row.last_maintenance ?? null,
          nextMaintenance: row.next_maintenance ?? null,
          notes: row.notes ?? null,
          batteryCount:
            row.battery_count != null ? Number(row.battery_count) : 1,
          hasBatteryGrip: !!row.has_battery_grip,
          batteryModel: row.battery_model ?? null,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
      });
      res.json({ equipment: items });
    } catch (err) {
      console.error("[photographer-equipment] list failed:", err);
      res.status(500).json({ error: "list_failed" });
    }
  });

  app.post("/api/photographer/equipment", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const {
      catalogId,
      brand,
      model,
      category,
      serialNumber,
      purchaseDate,
      purchasePrice,
      retailer,
      condition,
      notes,
      receiptUrl,
      warrantyMonths,
      reklamasjonMonths,
    } = req.body ?? {};

    try {
      await ensurePhotographerEquipmentSchema();
      let resolved: {
        brand?: string;
        model?: string;
        category?: string;
        imageUrl?: string | null;
        firmwareUrl?: string | null;
        warrantyMonths?: number;
        reklamasjonMonths?: number;
        batteryModel?: string | null;
        hasBatteryGripOption?: boolean;
      } = {};

      if (catalogId) {
        const { findCatalogEntry } = await import("./equipment-catalog.js");
        const entry = findCatalogEntry(String(catalogId));
        if (entry) {
          resolved = {
            brand: entry.brand,
            model: entry.model,
            category: entry.category,
            imageUrl: entry.imageUrl,
            firmwareUrl: entry.firmwareUrl,
            warrantyMonths: entry.warrantyMonths,
            reklamasjonMonths: entry.reklamasjonMonths,
            batteryModel: entry.batteryModel ?? null,
            hasBatteryGripOption: !!entry.hasBatteryGripOption,
          };
        }
      }

      const finalBrand =
        (typeof brand === "string" && brand.trim()) || resolved.brand;
      const finalModel =
        (typeof model === "string" && model.trim()) || resolved.model;
      if (!finalBrand || !finalModel) {
        return res.status(400).json({ error: "brand_and_model_required" });
      }

      const ins = await pool.query(
        `INSERT INTO user_equipment
           (user_id, user_type, category, brand, model, serial_number,
            purchase_date, purchase_price, condition, notes,
            image_url, catalog_id, warranty_months, reklamasjon_months,
            firmware_url, retailer, receipt_url,
            battery_count, has_battery_grip, battery_model,
            created_at, updated_at)
         VALUES ($1, 'photographer', $2, $3, $4, $5,
                 $6, $7, $8, $9,
                 $10, $11, $12, $13,
                 $14, $15, $16,
                 $17, $18, $19, NOW(), NOW())
         RETURNING id`,
        [
          session.userId,
          (typeof category === "string" && category.trim()) ||
            resolved.category ||
            "other",
          finalBrand,
          finalModel,
          typeof serialNumber === "string" && serialNumber.trim()
            ? serialNumber.trim()
            : null,
          purchaseDate || null,
          Number.isFinite(Number(purchasePrice))
            ? Number(purchasePrice)
            : null,
          typeof condition === "string" ? condition : "excellent",
          typeof notes === "string" ? notes : null,
          resolved.imageUrl ?? null,
          catalogId || null,
          Number.isFinite(Number(warrantyMonths))
            ? Number(warrantyMonths)
            : (resolved.warrantyMonths ?? null),
          Number.isFinite(Number(reklamasjonMonths))
            ? Number(reklamasjonMonths)
            : (resolved.reklamasjonMonths ?? 60),
          resolved.firmwareUrl ?? null,
          typeof retailer === "string" && retailer.trim()
            ? retailer.trim()
            : null,
          typeof receiptUrl === "string" && receiptUrl.trim()
            ? receiptUrl.trim()
            : null,
          Number.isFinite(Number(req.body?.batteryCount))
            ? Number(req.body.batteryCount)
            : 1,
          !!req.body?.hasBatteryGrip,
          resolved.batteryModel ?? null,
        ],
      );
      res.status(201).json({ id: ins.rows[0]?.id });
    } catch (err) {
      console.error("[photographer-equipment] create failed:", err);
      res.status(500).json({ error: "create_failed" });
    }
  });

  app.patch("/api/photographer/equipment/:id", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ error: "id_required" });

    const {
      purchaseDate,
      purchasePrice,
      currentValue,
      serialNumber,
      condition,
      notes,
      warrantyMonths,
      reklamasjonMonths,
      retailer,
      receiptUrl,
      firmwareVersion,
      lastMaintenance,
      nextMaintenance,
      batteryCount,
      hasBatteryGrip,
    } = req.body ?? {};

    try {
      await ensurePhotographerEquipmentSchema();
      const r = await pool.query(
        `UPDATE user_equipment SET
           purchase_date = COALESCE($1, purchase_date),
           purchase_price = COALESCE($2, purchase_price),
           current_value = COALESCE($3, current_value),
           serial_number = COALESCE($4, serial_number),
           condition = COALESCE($5, condition),
           notes = COALESCE($6, notes),
           warranty_months = COALESCE($7, warranty_months),
           reklamasjon_months = COALESCE($8, reklamasjon_months),
           retailer = COALESCE($9, retailer),
           receipt_url = COALESCE($10, receipt_url),
           firmware_version = COALESCE($11, firmware_version),
           last_maintenance = COALESCE($12, last_maintenance),
           next_maintenance = COALESCE($13, next_maintenance),
           battery_count = COALESCE($14, battery_count),
           has_battery_grip = COALESCE($15, has_battery_grip),
           updated_at = NOW()
         WHERE id = $16 AND user_id = $17`,
        [
          purchaseDate || null,
          Number.isFinite(Number(purchasePrice))
            ? Number(purchasePrice)
            : null,
          Number.isFinite(Number(currentValue))
            ? Number(currentValue)
            : null,
          typeof serialNumber === "string" ? serialNumber : null,
          typeof condition === "string" ? condition : null,
          typeof notes === "string" ? notes : null,
          Number.isFinite(Number(warrantyMonths))
            ? Number(warrantyMonths)
            : null,
          Number.isFinite(Number(reklamasjonMonths))
            ? Number(reklamasjonMonths)
            : null,
          typeof retailer === "string" ? retailer : null,
          typeof receiptUrl === "string" ? receiptUrl : null,
          typeof firmwareVersion === "string" ? firmwareVersion : null,
          typeof lastMaintenance === "string" ? lastMaintenance : null,
          typeof nextMaintenance === "string" ? nextMaintenance : null,
          Number.isFinite(Number(batteryCount)) ? Number(batteryCount) : null,
          typeof hasBatteryGrip === "boolean" ? hasBatteryGrip : null,
          Number(id),
          session.userId,
        ],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "not_found" });
      res.json({ success: true });
    } catch (err) {
      console.error("[photographer-equipment] update failed:", err);
      res.status(500).json({ error: "update_failed" });
    }
  });

  app.delete("/api/photographer/equipment/:id", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ error: "id_required" });
    try {
      const r = await pool.query(
        `DELETE FROM user_equipment WHERE id = $1 AND user_id = $2`,
        [Number(id), session.userId],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "not_found" });
      res.json({ success: true });
    } catch (err) {
      console.error("[photographer-equipment] delete failed:", err);
      res.status(500).json({ error: "delete_failed" });
    }
  });
}
