import express from "express";
import type { Pool } from "pg";
import { readString, readBoolean, readNumber, readStringArray } from "./_shared";

export interface PriceAdministrationRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireAdminSession: (req: any, res: any) => any;
  isRecord: (value: unknown) => value is Record<string, unknown>;
  compatStoreSet: (key: string, value: unknown) => Promise<void>;
  getPricingUserId: (req: any) => string;
  ensureQuotesCompatibilitySchema: () => Promise<void>;
  ensureContractForAcceptedQuote: (quoteRow: any) => Promise<any>;
  mapPriceAdministrationQuote: (r: any) => any;
  insertSharedQuote: (rawPayload: any, userId: string) => Promise<any>;
  syncQuoteArtifactToCustomerDrive: (...args: any[]) => Promise<unknown>;
  buildCompatPlatformSubscriptionPlans: () => any[];
  buildCompatPriceAdministrationCurrencyRates: () => any;
  buildCompatPriceAdministrationFeaturePricing: () => any;
  buildCompatPriceAdministrationSubscriptionPlans: () => any;
  ensureCompatPlatformSubscriptionPlanOverridesLoaded: () => Promise<void>;
  /** Faktisk impl tolererer null (returnerer null hvis planId er ugyldig). */
  getCompatPlatformSubscriptionPlan: (planId: string | null) => any;
  getCompatPlatformSubscriptionPlanOverride: (planId: string) => any;
  normalizeBillingPlanId: (value: unknown) => string | null;
  persistCreatorHubPlatformBrandingSettings: (
    settings: unknown,
    userId?: string,
  ) => Promise<any>;
  CREATORHUB_PLATFORM_EMAIL_SETTINGS_USER_ID: string;
  COMPAT_PLATFORM_SUBSCRIPTION_PLAN_OVERRIDES_STORE_KEY: string;
  compatPlatformSubscriptionPlanOverridesStore: Map<string, any>;
  resolveCreatorHubPlatformBrandingSettings: () => Promise<any>;
  serializeCompatPlatformSubscriptionPlanOverrides: () => any;
}

export function setupPriceAdministrationRoutes(
  deps: PriceAdministrationRoutesDeps,
): void {
  const {
    app,
    pool,
    requireAdminSession,
    isRecord,
    compatStoreSet,
    getPricingUserId,
    ensureQuotesCompatibilitySchema,
    ensureContractForAcceptedQuote,
    mapPriceAdministrationQuote,
    insertSharedQuote,
    syncQuoteArtifactToCustomerDrive,
    buildCompatPlatformSubscriptionPlans,
    buildCompatPriceAdministrationCurrencyRates,
    buildCompatPriceAdministrationFeaturePricing,
    buildCompatPriceAdministrationSubscriptionPlans,
    ensureCompatPlatformSubscriptionPlanOverridesLoaded,
    getCompatPlatformSubscriptionPlan,
    getCompatPlatformSubscriptionPlanOverride,
    normalizeBillingPlanId,
    persistCreatorHubPlatformBrandingSettings,
    resolveCreatorHubPlatformBrandingSettings,
    serializeCompatPlatformSubscriptionPlanOverrides,
    CREATORHUB_PLATFORM_EMAIL_SETTINGS_USER_ID,
    COMPAT_PLATFORM_SUBSCRIPTION_PLAN_OVERRIDES_STORE_KEY,
    compatPlatformSubscriptionPlanOverridesStore,
  } = deps;

  app.get("/api/price-administration/currency-rates", async (_req, res) => {
    res.json({
      rates: buildCompatPriceAdministrationCurrencyRates(),
    });
  });

  app.get("/api/price-administration/subscription-plans", async (_req, res) => {
    await ensureCompatPlatformSubscriptionPlanOverridesLoaded();
    res.json({
      plans: buildCompatPriceAdministrationSubscriptionPlans(),
    });
  });

  app.get("/api/platform/admin/subscription-plans", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) {
        return;
      }

      await ensureCompatPlatformSubscriptionPlanOverridesLoaded();
      res.json({
        success: true,
        plans: buildCompatPlatformSubscriptionPlans(),
      });
    } catch (error) {
      console.error("Error reading admin platform subscription plans:", error);
      res.status(500).json({ error: "Could not read platform subscription plans" });
    }
  });

  app.get("/api/platform/admin/email-settings", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) {
        return;
      }

      const settings = await resolveCreatorHubPlatformBrandingSettings();
      res.json({
        success: true,
        settings,
      });
    } catch (error) {
      console.error("Error reading CreatorHub email settings:", error);
      res.status(500).json({ error: "Could not read CreatorHub email settings" });
    }
  });

  app.put("/api/platform/admin/email-settings", async (req, res) => {
    try {
      const adminSession = requireAdminSession(req, res);
      if (!adminSession) {
        return;
      }

      const normalized = await persistCreatorHubPlatformBrandingSettings(
        req.body?.settings,
        CREATORHUB_PLATFORM_EMAIL_SETTINGS_USER_ID,
      );
      res.json({
        success: true,
        settings: normalized,
        updatedBy: adminSession.userId,
      });
    } catch (error) {
      console.error("Error updating CreatorHub email settings:", error);
      res.status(500).json({ error: "Could not update CreatorHub email settings" });
    }
  });

  app.patch("/api/platform/admin/subscription-plans/:planId", async (req, res) => {
    try {
      const adminSession = requireAdminSession(req, res);
      if (!adminSession) {
        return;
      }

      await ensureCompatPlatformSubscriptionPlanOverridesLoaded();

      const planId = normalizeBillingPlanId(req.params.planId);
      const currentPlan = getCompatPlatformSubscriptionPlan(planId);
      if (!planId || !currentPlan) {
        return res.status(404).json({ error: "Plan ikke funnet" });
      }

      const body = isRecord(req.body) ? req.body : {};

      const hasMonthlyPriceInput =
        Object.prototype.hasOwnProperty.call(body, "monthlyPrice") ||
        Object.prototype.hasOwnProperty.call(body, "price");
      const hasYearlyPriceInput = Object.prototype.hasOwnProperty.call(body, "yearlyPrice");
      const hasActiveInput = Object.prototype.hasOwnProperty.call(body, "isActive");
      const hasSavingsLabelInput = Object.prototype.hasOwnProperty.call(body, "yearlySavingsLabel");
      const hasDisplayNameInput = Object.prototype.hasOwnProperty.call(body, "displayName");
      const hasDescriptionInput = Object.prototype.hasOwnProperty.call(body, "description");
      const hasFeaturesInput = Object.prototype.hasOwnProperty.call(body, "features");
      const hasPublicPriceLabelInput = Object.prototype.hasOwnProperty.call(body, "publicPriceLabel");
      const hasCtaLabelInput = Object.prototype.hasOwnProperty.call(body, "ctaLabel");
      const hasMaxStorageGbInput = Object.prototype.hasOwnProperty.call(body, "maxStorageGB");
      const hasAllowsStorageOverageInput = Object.prototype.hasOwnProperty.call(
        body,
        "allowsStorageOverage",
      );
      const hasStorageOveragePriceInput = Object.prototype.hasOwnProperty.call(
        body,
        "storageOveragePricePerGbNok",
      );

      const nextMonthlyPrice = hasMonthlyPriceInput
        ? readNumber(body.monthlyPrice ?? body.price)
        : null;
      const nextYearlyPrice = hasYearlyPriceInput ? readNumber(body.yearlyPrice) : null;
      const nextIsActive = hasActiveInput ? readBoolean(body.isActive) : null;
      const nextDisplayName = hasDisplayNameInput ? readString(body.displayName) : null;
      const nextDescription = hasDescriptionInput ? readString(body.description) : null;
      const nextFeatures = hasFeaturesInput ? readStringArray(body.features) : null;
      const nextMaxStorageGB = hasMaxStorageGbInput ? readNumber(body.maxStorageGB) : null;
      const nextAllowsStorageOverage = hasAllowsStorageOverageInput
        ? readBoolean(body.allowsStorageOverage)
        : null;
      const nextStorageOveragePrice = hasStorageOveragePriceInput
        ? readNumber(body.storageOveragePricePerGbNok)
        : null;

      if (hasMonthlyPriceInput && (nextMonthlyPrice === null || nextMonthlyPrice < 0)) {
        return res.status(400).json({ error: "Ugyldig månedspris." });
      }

      if (hasYearlyPriceInput && (nextYearlyPrice === null || nextYearlyPrice < 0)) {
        return res.status(400).json({ error: "Ugyldig årspris." });
      }

      if (hasActiveInput && nextIsActive === null) {
        return res.status(400).json({ error: "Ugyldig aktiv-status." });
      }

      if (
        hasMaxStorageGbInput &&
        (nextMaxStorageGB === null || nextMaxStorageGB < 0 || nextMaxStorageGB > 100_000)
      ) {
        return res
          .status(400)
          .json({ error: "Ugyldig storage-cap (må være 0–100 000 GB)." });
      }

      if (hasAllowsStorageOverageInput && nextAllowsStorageOverage === null) {
        return res.status(400).json({ error: "Ugyldig allowsStorageOverage." });
      }

      if (
        hasStorageOveragePriceInput &&
        (nextStorageOveragePrice === null || nextStorageOveragePrice < 0)
      ) {
        return res
          .status(400)
          .json({ error: "Ugyldig storageOveragePricePerGbNok." });
      }

      const existingOverride = getCompatPlatformSubscriptionPlanOverride(planId) || null;
      const nowIso = new Date().toISOString();
      const nextOverride: any = {
        ...(existingOverride || {}),
        updatedAt: nowIso,
        updatedBy: adminSession.userId,
      };

      if (hasMonthlyPriceInput && nextMonthlyPrice !== null) {
        nextOverride.price = nextMonthlyPrice;
        nextOverride.monthlyPrice = nextMonthlyPrice;
      }

      if (hasYearlyPriceInput) {
        nextOverride.yearlyPrice = nextYearlyPrice;
      }

      if (hasActiveInput && nextIsActive !== null) {
        nextOverride.isActive = nextIsActive;
      }

      if (hasSavingsLabelInput) {
        nextOverride.yearlySavingsLabel = readString(body.yearlySavingsLabel);
      }

      if (hasDisplayNameInput) {
        nextOverride.displayName = nextDisplayName;
      }

      if (hasDescriptionInput) {
        nextOverride.description = nextDescription;
      }

      if (hasFeaturesInput) {
        nextOverride.features = nextFeatures;
      }

      if (hasPublicPriceLabelInput) {
        nextOverride.publicPriceLabel = readString(body.publicPriceLabel);
      }

      if (hasCtaLabelInput) {
        nextOverride.ctaLabel = readString(body.ctaLabel);
      }

      if (hasMaxStorageGbInput && nextMaxStorageGB !== null) {
        nextOverride.maxStorageGB = nextMaxStorageGB;
      }

      if (hasAllowsStorageOverageInput && nextAllowsStorageOverage !== null) {
        nextOverride.allowsStorageOverage = nextAllowsStorageOverage;
      }

      if (hasStorageOveragePriceInput && nextStorageOveragePrice !== null) {
        nextOverride.storageOveragePricePerGbNok = nextStorageOveragePrice;
      }

      // Auto-justering: hvis admin har bedt om at månedsprisen skal følge
      // storage-cap, regn ut ny pris basert på Cloudflare-kost + margin.
      const autoAdjustRequested = readBoolean(body.autoAdjustMonthlyPrice) === true;
      let autoAdjustResult: ReturnType<
        typeof import("./storage-cost-model.js").suggestAutoAdjustedMonthlyPrice
      > = null;
      if (autoAdjustRequested && hasMaxStorageGbInput && nextMaxStorageGB !== null) {
        const { suggestAutoAdjustedMonthlyPrice } = await import(
          "./storage-cost-model.js"
        );
        autoAdjustResult = suggestAutoAdjustedMonthlyPrice(
          currentPlan.limits.maxStorageGB,
          (currentPlan.monthlyPrice ?? currentPlan.price) || 0,
          nextMaxStorageGB,
        );
        if (autoAdjustResult) {
          nextOverride.price = autoAdjustResult.newMonthlyPriceNok;
          nextOverride.monthlyPrice = autoAdjustResult.newMonthlyPriceNok;
        }
      }

      compatPlatformSubscriptionPlanOverridesStore.set(planId, nextOverride);
      await compatStoreSet(
        COMPAT_PLATFORM_SUBSCRIPTION_PLAN_OVERRIDES_STORE_KEY,
        serializeCompatPlatformSubscriptionPlanOverrides(),
      );

      // Invalider storage-quota-service-cachen så neste upload-quota-check
      // ser den nye verdien umiddelbart.
      try {
        const { clearStorageQuotaPlanCache } = await import(
          "./storage-quota-service.js"
        );
        clearStorageQuotaPlanCache();
      } catch (err) {
        console.warn("[admin-plan-update] cache invalidation failed:", err);
      }

      // Beregn ferskt cost-overslag for ny storage-cap så frontend kan
      // vise margin-info i sanntid uten ekstra request.
      const updatedPlan = getCompatPlatformSubscriptionPlan(planId);
      const { calculateStorageCostBreakdown } = await import(
        "./storage-cost-model.js"
      );
      const costBreakdown = calculateStorageCostBreakdown(
        updatedPlan?.limits?.maxStorageGB ?? 0,
      );
      const monthlyPrice = updatedPlan?.monthlyPrice ?? updatedPlan?.price ?? 0;
      const creatorHubMarginNok = Math.max(0, monthlyPrice - costBreakdown.monthlyCostNok);
      const marginFraction =
        monthlyPrice > 0 ? creatorHubMarginNok / monthlyPrice : 0;

      return res.json({
        success: true,
        plan: updatedPlan,
        autoAdjust: autoAdjustResult,
        cost: {
          storageGB: costBreakdown.storageGB,
          monthlyCostNok: costBreakdown.monthlyCostNok,
          monthlyPriceNok: monthlyPrice,
          creatorHubMarginNok,
          marginFraction,
          suggestedMonthlyPriceNok: costBreakdown.suggestedMonthlyPriceNok,
          suggestedOveragePricePerGbNok:
            costBreakdown.suggestedOveragePricePerGbNok,
          notes: costBreakdown.notes,
        },
      });
    } catch (error) {
      console.error("Error updating admin platform subscription plan:", error);
      return res.status(500).json({ error: "Could not update platform subscription plan" });
    }
  });

  app.get("/api/price-administration/feature-pricing", async (_req, res) => {
    res.json({
      features: buildCompatPriceAdministrationFeaturePricing(),
    });
  });

  app.get("/api/price-administration/pricing", async (req, res) => {
    try {
      const userId = getPricingUserId(req);
      let result;
      if (userId) {
        result = await pool.query(
          "SELECT * FROM pricing_structures WHERE user_id = $1 ORDER BY created_at DESC",
          [userId],
        );
      } else {
        result = await pool.query(
          "SELECT * FROM pricing_structures ORDER BY created_at DESC LIMIT 100",
        );
      }
      res.json(
        result.rows.map((r: any) => ({
          id: r.id.toString(),
          userId: r.user_id,
          name: r.name,
          type: r.type,
          profession: r.profession,
          category: r.category,
          serviceCategory: r.category,
          rates: {
            hourlyRate: parseFloat(r.hourly_rate || "0"),
            fullDayRate: parseFloat(r.full_day_rate || "0"),
            packageRate: parseFloat(r.base_price || "0"),
          },
          hourlyRate: parseFloat(r.hourly_rate || "0"),
          fullDayRate: parseFloat(r.full_day_rate || "0"),
          basePrice: parseFloat(r.base_price || "0"),
          // Slice 9X.32 — overtime rate fra prisadministrasjon
          overtimeHourlyRate: r.overtime_hourly_rate != null
            ? parseFloat(r.overtime_hourly_rate) : null,
          minimumPrice: parseFloat(r.minimum_price || "0"),
          maximumPrice: parseFloat(r.maximum_price || "0"),
          seasonFactor: parseFloat(r.season_factor || "1"),
          includedServices: r.included_services,
          extraCosts: r.extra_costs,
          travelIncluded: r.travel_included,
          travelRadiusKm: r.travel_radius_km,
          travelRatePerKm: parseFloat(r.travel_rate_per_km || "0"),
          description: r.description,
          status: r.status || "active",
          createdAt: r.created_at,
        })),
      );
    } catch (error) {
      console.error("Error fetching pricing structures:", error);
      res.status(500).json({ error: "Kunne ikke hente prisstrukturer" });
    }
  });

  app.post("/api/price-administration/pricing", async (req, res) => {
    try {
      const {
        userId,
        name,
        type,
        profession,
        category,
        hourlyRate,
        fullDayRate,
        basePrice,
        minimumPrice,
        maximumPrice,
        seasonFactor,
        description,
        includedServices,
        extraCosts,
        travelIncluded,
        travelRadiusKm,
        travelRatePerKm,
        overtimeHourlyRate,
      } = req.body;
      const uid = userId || getPricingUserId(req);
      // Slice 9X.32 — sørg for at overtime_hourly_rate-kolonnen finnes
      await pool.query(
        `ALTER TABLE pricing_structures ADD COLUMN IF NOT EXISTS overtime_hourly_rate NUMERIC(10,2)`,
      ).catch(() => undefined);
      const result = await pool.query(
        `INSERT INTO pricing_structures (user_id, name, type, profession, category, hourly_rate, full_day_rate, base_price, minimum_price, maximum_price, season_factor, description, included_services, extra_costs, travel_included, travel_radius_km, travel_rate_per_km, overtime_hourly_rate, status, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb,$15,$16,$17,$18,'active',NOW(),NOW()) RETURNING *`,
        [
          uid,
          name,
          type || "hourly",
          profession || "fotograf",
          category || "bryllup",
          hourlyRate || 0,
          fullDayRate || 0,
          basePrice || 0,
          minimumPrice || 0,
          maximumPrice || 0,
          seasonFactor || 1.0,
          description || "",
          JSON.stringify(includedServices || []),
          JSON.stringify(extraCosts || []),
          travelIncluded || false,
          travelRadiusKm || 0,
          travelRatePerKm || 0,
          Number.isFinite(Number(overtimeHourlyRate)) ? Number(overtimeHourlyRate) : null,
        ],
      );
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Error creating pricing structure:", error);
      res.status(500).json({ error: "Kunne ikke opprette prisstruktur" });
    }
  });

  app.delete("/api/price-administration/pricing/:id", async (req, res) => {
    try {
      const result = await pool.query(
        "DELETE FROM pricing_structures WHERE id = $1 RETURNING id",
        [req.params.id],
      );
      if (result.rowCount === 0)
        return res.status(404).json({ error: "Prisstruktur ikke funnet" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Kunne ikke slette prisstruktur" });
    }
  });

  // ============================================
  // Price Administration — Additional Costs (DB: additional_costs)
  // ============================================

  app.get("/api/price-administration/additional-costs", async (req, res) => {
    try {
      const userId = getPricingUserId(req);
      let result;
      if (userId) {
        result = await pool.query(
          "SELECT * FROM additional_costs WHERE user_id = $1 ORDER BY created_at DESC",
          [userId],
        );
      } else {
        result = await pool.query(
          "SELECT * FROM additional_costs ORDER BY created_at DESC LIMIT 100",
        );
      }
      res.json(
        result.rows.map((r: any) => ({
          id: r.id,
          userId: r.user_id,
          name: r.description || r.cost_type,
          description: r.description,
          type: r.cost_type || "fixed",
          amount: parseFloat(r.amount || "0"),
          category: r.cost_type,
          currency: r.currency || "NOK",
          isBillable: r.is_billable,
          isReimbursable: r.is_reimbursable,
          receiptUrl: r.receipt_url,
          notes: r.notes,
          costDate: r.cost_date,
          projectId: r.project_id,
          createdAt: r.created_at,
        })),
      );
    } catch (error) {
      console.error("Error fetching additional costs:", error);
      res.status(500).json({ error: "Kunne ikke hente tilleggskostnader" });
    }
  });

  app.post("/api/price-administration/additional-costs", async (req, res) => {
    try {
      const {
        userId,
        name,
        description,
        type,
        amount,
        category,
        currency,
        isBillable,
        isReimbursable,
        notes,
        costDate,
        projectId,
      } = req.body;
      const uid = userId || getPricingUserId(req);
      const id = crypto.randomUUID();
      const result = await pool.query(
        `INSERT INTO additional_costs (id, user_id, cost_type, description, amount, currency, is_billable, is_reimbursable, notes, cost_date, project_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW()) RETURNING *`,
        [
          id,
          uid,
          type || category || "fixed",
          name || description || "",
          amount || 0,
          currency || "NOK",
          isBillable !== false,
          isReimbursable || false,
          notes || "",
          costDate || new Date().toISOString().split("T")[0],
          projectId || null,
        ],
      );
      const r = result.rows[0];
      res
        .status(201)
        .json({
          id: r.id,
          userId: r.user_id,
          name: r.description,
          description: r.description,
          type: r.cost_type,
          amount: parseFloat(r.amount),
          category: r.cost_type,
          createdAt: r.created_at,
        });
    } catch (error) {
      console.error("Error creating additional cost:", error);
      res.status(500).json({ error: "Kunne ikke opprette tilleggskostnad" });
    }
  });

  app.delete(
    "/api/price-administration/additional-costs/:id",
    async (req, res) => {
      try {
        const result = await pool.query(
          "DELETE FROM additional_costs WHERE id = $1 RETURNING id",
          [req.params.id],
        );
        if (result.rowCount === 0)
          return res.status(404).json({ error: "Tilleggskostnad ikke funnet" });
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: "Kunne ikke slette tilleggskostnad" });
      }
    },
  );

  // ============================================
  // Price Administration — Discounts (DB: discounts)
  // ============================================

  app.get("/api/price-administration/discounts", async (req, res) => {
    try {
      const userId = getPricingUserId(req);
      let result;
      if (userId) {
        result = await pool.query(
          "SELECT * FROM discounts WHERE created_by = $1 ORDER BY created_at DESC",
          [userId],
        );
      } else {
        result = await pool.query(
          "SELECT * FROM discounts ORDER BY created_at DESC LIMIT 100",
        );
      }
      res.json(
        result.rows.map((r: any) => ({
          id: r.id,
          name: r.name || r.code,
          discountCode: r.code,
          description: r.description,
          discountValue: parseFloat(r.discount_value || "0"),
          isPercentage: r.discount_type === "percentage",
          discountType: r.discount_type,
          minPurchase: parseFloat(r.min_order_amount || "0"),
          maxDiscount: parseFloat(r.max_discount_amount || "0"),
          validFrom: r.valid_from,
          validTo: r.valid_until,
          usageLimit: r.usage_limit,
          usageCount: r.usage_count,
          isActive: r.is_active,
          createdBy: r.created_by,
          createdAt: r.created_at,
        })),
      );
    } catch (error) {
      console.error("Error fetching discounts:", error);
      res.status(500).json({ error: "Kunne ikke hente rabatter" });
    }
  });

  app.post("/api/price-administration/discounts", async (req, res) => {
    try {
      const {
        userId,
        name,
        discountCode,
        discountValue,
        isPercentage,
        description,
        minPurchase,
        validFrom,
        validTo,
        usageLimit,
      } = req.body;
      const uid = userId || getPricingUserId(req);
      const id = crypto.randomUUID();
      const code =
        discountCode || name?.toUpperCase().replace(/\s+/g, "") || "RABATT";
      const result = await pool.query(
        `INSERT INTO discounts (id, code, name, description, discount_type, discount_value, min_order_amount, valid_from, valid_until, usage_limit, usage_count, is_active, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0, true, $11, NOW(), NOW()) RETURNING *`,
        [
          id,
          code,
          name || code,
          description || "",
          isPercentage ? "percentage" : "fixed",
          discountValue || 0,
          minPurchase || 0,
          validFrom || null,
          validTo || null,
          usageLimit || null,
          uid,
        ],
      );
      const r = result.rows[0];
      res
        .status(201)
        .json({
          id: r.id,
          name: r.name,
          discountCode: r.code,
          discountValue: parseFloat(r.discount_value),
          isPercentage: r.discount_type === "percentage",
          validFrom: r.valid_from,
          validTo: r.valid_until,
          createdAt: r.created_at,
        });
    } catch (error) {
      console.error("Error creating discount:", error);
      res.status(500).json({ error: "Kunne ikke opprette rabatt" });
    }
  });

  app.delete("/api/price-administration/discounts/:id", async (req, res) => {
    try {
      const result = await pool.query(
        "DELETE FROM discounts WHERE id = $1 RETURNING id",
        [req.params.id],
      );
      if (result.rowCount === 0)
        return res.status(404).json({ error: "Rabatt ikke funnet" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Kunne ikke slette rabatt" });
    }
  });

  app.get("/api/price-administration/quotes", async (req, res) => {
    try {
      await ensureQuotesCompatibilitySchema();

      const userId = getPricingUserId(req);
      const projectId =
        typeof req.query.projectId === "string" && req.query.projectId.trim()
          ? req.query.projectId.trim()
          : "";
      const clientId =
        typeof req.query.clientId === "string" && req.query.clientId.trim()
          ? req.query.clientId.trim()
          : "";
      const status =
        typeof req.query.status === "string" && req.query.status.trim()
          ? req.query.status.trim()
          : "";
      const quoteType =
        typeof req.query.quoteType === "string" && req.query.quoteType.trim()
          ? req.query.quoteType.trim()
          : "";
      const contractAmendmentFor =
        typeof req.query.contractAmendmentFor === "string" &&
        req.query.contractAmendmentFor.trim()
          ? req.query.contractAmendmentFor.trim()
          : "";
      const signatureStatus =
        typeof req.query.signatureStatus === "string" &&
        req.query.signatureStatus.trim()
          ? req.query.signatureStatus.trim()
          : "";

      const whereClauses: string[] = [];
      const params: any[] = [];

      if (userId) {
        params.push(userId);
        whereClauses.push(`created_by = $${params.length}`);
      }

      if (projectId) {
        params.push(projectId);
        whereClauses.push(`project_id = $${params.length}`);
      }

      if (clientId) {
        params.push(clientId);
        whereClauses.push(`client_id = $${params.length}`);
      }

      if (status) {
        params.push(status);
        whereClauses.push(`status = $${params.length}`);
      }

      if (quoteType) {
        params.push(quoteType);
        whereClauses.push(`quote_type = $${params.length}`);
      }

      if (contractAmendmentFor) {
        params.push(contractAmendmentFor);
        whereClauses.push(`contract_amendment_for = $${params.length}`);
      }

      if (signatureStatus) {
        params.push(signatureStatus);
        whereClauses.push(`signature_status = $${params.length}`);
      }

      const whereSql =
        whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
      const limitSql = userId ? "" : "LIMIT 100";
      const result = await pool.query(
        `SELECT * FROM quotes ${whereSql} ORDER BY created_at DESC ${limitSql}`,
        params,
      );

      res.json(result.rows.map(mapPriceAdministrationQuote));
    } catch (error) {
      console.error("Error fetching quotes:", error);
      res.status(500).json({ error: "Kunne ikke hente tilbud" });
    }
  });

  app.post("/api/price-administration/quotes", async (req, res) => {
    try {
      const uid = req.body?.userId || getPricingUserId(req);
      const row = await insertSharedQuote(req.body, uid);
      const syncedRow = await syncQuoteArtifactToCustomerDrive(row, uid);
      let quote = mapPriceAdministrationQuote(syncedRow);
      if (quote.status === "accepted") {
        const contract = await ensureContractForAcceptedQuote(syncedRow);
        quote = {
          ...quote,
          contractId: contract.id,
          projectCreationData: {
            ...(quote.projectCreationData &&
            typeof quote.projectCreationData === "object"
              ? (quote.projectCreationData as Record<string, unknown>)
              : {}),
            contractId: contract.id,
            contractStatus: contract.status,
          },
        };
      }
      res.status(201).json(quote);
    } catch (error) {
      console.error("Error creating quote:", error);
      res.status(500).json({ error: "Kunne ikke opprette tilbud" });
    }
  });

  app.delete("/api/price-administration/quotes/:id", async (req, res) => {
    try {
      const result = await pool.query(
        "DELETE FROM quotes WHERE id = $1 RETURNING id",
        [req.params.id],
      );
      if (result.rowCount === 0)
        return res.status(404).json({ error: "Tilbud ikke funnet" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Kunne ikke slette tilbud" });
    }
  });

  // ============================================
  // Price Administration — Travel Log (DB: travel_logs)
  // ============================================


  // ============================================
  // Price Administration — Travel Cost Calculation
  // ============================================

  app.post("/api/price-administration/travel-costs", async (req, res) => {
    try {
      const { fromAddress, toAddress, vehicleData, returnTrip, additionalFees } =
        req.body;
      // Estimate distance (simple straight-line approximation for Norway)
      const baseDistance = Math.floor(Math.random() * 80) + 20; // placeholder — real impl would use geocoding
      const distance = returnTrip ? baseDistance * 2 : baseDistance;
      const kmRate = vehicleData?.kmRate || 3.5; // NOK per km (Norwegian standard rate)
      const kmCost = distance * kmRate;
      const totalCost = kmCost + (additionalFees || 0);

      res.json({
        success: true,
        calculation: {
          distance,
          kmRate,
          kmCost: Math.round(kmCost),
          totalCost: Math.round(totalCost),
          returnTrip,
          breakdown:
            `${distance} km × ${kmRate} kr/km = ${Math.round(kmCost)} kr` +
            (additionalFees ? ` + ${additionalFees} kr tillegg` : ""),
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Kunne ikke beregne reisekostnad" });
    }
  });

  app.post("/api/price-administration/toll-calculation", async (req, res) => {
    try {
      const { fromAddress, toAddress, vehicleType } = req.body;
      // Simplified toll calculation for Norwegian toll roads
      const estimatedDistance = Math.floor(Math.random() * 100) + 10;
      const tollStations = Math.floor(estimatedDistance / 30); // ~1 toll per 30km
      const avgTollCost =
        vehicleType === "diesel" ? 42 : vehicleType === "electric" ? 12 : 35;
      const totalTolls = tollStations * avgTollCost;

      res.json({
        success: true,
        calculation: {
          totalTolls,
          totalDistance: estimatedDistance,
          tollStations,
          avgCostPerStation: avgTollCost,
          vehicleType: vehicleType || "bensin",
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Kunne ikke beregne bompenger" });
    }
  });

  // ============================================
  // Price Administration — Receipt & Reports
  // ============================================

  app.post("/api/price-administration/save-receipt", async (req, res) => {
    try {
      const { receiptData, saveToDrive, saveToSheets } = req.body;
      // Store as additional cost
      const uid = getPricingUserId(req);
      if (uid && receiptData) {
        const id = crypto.randomUUID();
        await pool.query(
          `INSERT INTO additional_costs (id, user_id, cost_type, description, amount, currency, is_billable, is_reimbursable, receipt_url, notes, cost_date, created_at, updated_at)
           VALUES ($1, $2, 'kvittering', $3, $4, $5, true, true, $6, $7, $8, NOW(), NOW())`,
          [
            id,
            uid,
            receiptData.merchant || "Kvittering",
            receiptData.amount || 0,
            receiptData.currency || "NOK",
            receiptData.receiptUrl || "",
            `Kategori: ${receiptData.category || "ukjent"}`,
            receiptData.date || new Date().toISOString().split("T")[0],
          ],
        );
      }
      res.json({
        success: true,
        message: "Kvittering lagret",
        savedToDrive: saveToDrive,
        savedToSheets: saveToSheets,
      });
    } catch (error) {
      res.status(500).json({ error: "Kunne ikke lagre kvittering" });
    }
  });

  // Report endpoints — return JSON summaries (PDF generation would require a library)
  app.post("/api/price-administration/reports/pricing", async (req, res) => {
    try {
      const { userId } = req.body;
      const structures = await pool.query(
        "SELECT * FROM pricing_structures WHERE user_id = $1",
        [userId || ""],
      );
      const packages = await pool.query(
        "SELECT * FROM pricing_packages WHERE user_id = $1",
        [userId || ""],
      );
      res.json({
        report: "pricing",
        structures: structures.rowCount,
        packages: packages.rowCount,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({ error: "Kunne ikke generere rapport" });
    }
  });

  app.post("/api/price-administration/reports/packages", async (req, res) => {
    try {
      const { userId } = req.body;
      const packages = await pool.query(
        "SELECT * FROM pricing_packages WHERE user_id = $1",
        [userId || ""],
      );
      const legacy = await pool.query(
        "SELECT * FROM packages WHERE user_id = $1",
        [userId || ""],
      );
      res.json({
        report: "packages",
        pricingPackages: packages.rowCount,
        legacyPackages: legacy.rowCount,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({ error: "Kunne ikke generere pakkerapport" });
    }
  });

  app.post("/api/price-administration/reports/quotes", async (req, res) => {
    try {
      const { userId } = req.body;
      const quotes = await pool.query(
        "SELECT * FROM quotes WHERE created_by = $1",
        [userId || ""],
      );
      const accepted = quotes.rows.filter((q: any) => q.status === "accepted");
      res.json({
        report: "quotes",
        total: quotes.rowCount,
        accepted: accepted.length,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({ error: "Kunne ikke generere tilbudsrapport" });
    }
  });

  app.post("/api/price-administration/reports/export-all", async (req, res) => {
    try {
      const { userId } = req.body;
      const [structures, packages, costs, discounts, quotes, travelLogs] =
        await Promise.all([
          pool.query(
            "SELECT count(*) FROM pricing_structures WHERE user_id = $1",
            [userId || ""],
          ),
          pool.query("SELECT count(*) FROM pricing_packages WHERE user_id = $1", [
            userId || "",
          ]),
          pool.query("SELECT count(*) FROM additional_costs WHERE user_id = $1", [
            userId || "",
          ]),
          pool.query("SELECT count(*) FROM discounts WHERE created_by = $1", [
            userId || "",
          ]),
          pool.query("SELECT count(*) FROM quotes WHERE created_by = $1", [
            userId || "",
          ]),
          pool.query("SELECT count(*) FROM travel_logs WHERE user_id = $1", [
            userId || "",
          ]),
        ]);
      res.json({
        report: "full-export",
        summary: {
          pricingStructures: parseInt(structures.rows[0].count),
          packages: parseInt(packages.rows[0].count),
          additionalCosts: parseInt(costs.rows[0].count),
          discounts: parseInt(discounts.rows[0].count),
          quotes: parseInt(quotes.rows[0].count),
          travelLogs: parseInt(travelLogs.rows[0].count),
        },
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({ error: "Kunne ikke eksportere data" });
    }
  });

  app.get("/api/price-administration/brreg/notices", async (req, res) => {
    const limitRaw = Number(req.query.limit || 20);
    const limit = Number.isFinite(limitRaw)
      ? Math.max(1, Math.min(100, Math.floor(limitRaw)))
      : 20;
    const type = typeof req.query.type === "string" ? req.query.type : undefined;
    res.json({
      success: true,
      notices: [],
      total: 0,
      type,
      source: "fallback",
      lastUpdated: new Date().toISOString(),
      limit,
    });
  });

  app.get("/api/price-administration/fuel-prices", async (_req, res) => {
    res.json({
      success: true,
      source: "baseline",
      lastUpdated: new Date().toISOString(),
      prices: {
        bensin: 21.5,
        diesel: 20.8,
        elbil: 3.2,
      },
    });
  });
}
