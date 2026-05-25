import express from "express";
import type { Pool } from "pg";
import PDFDocument from "pdfkit";

export interface QuotesRoutesDeps {
  app: express.Application;
  pool: Pool;
  compatStoreSet: (key: string, value: unknown) => Promise<void>;
  compatStoreGet: <T>(key: string) => Promise<T | null>;
  ensureQuotesCompatibilitySchema: () => Promise<void>;
  ensureContractForAcceptedQuote: (quoteRow: any) => Promise<any>;
  getPricingUserId: (req: any) => string;
  insertSharedQuote: (rawPayload: any, userId: string) => Promise<any>;
  mapPriceAdministrationQuote: (r: any) => any;
  mapQuoteCompatibilityRecord: (r: any) => any;
  normalizeJsonArrayField: (value: unknown) => any[];
  normalizeJsonObjectField: (value: unknown) => Record<string, unknown> | null;
  normalizeLegacyQuoteStatus: (value: unknown) => any;
  serializeQuoteDocument: (...args: any[]) => any;
  syncQuoteArtifactToCustomerDrive: (...args: any[]) => Promise<unknown>;
  toNumericValue: (value: unknown, fallback?: number) => number;
}

export function setupQuotesRoutes(deps: QuotesRoutesDeps): void {
  const {
    app,
    pool,
    compatStoreSet,
    compatStoreGet,
    ensureQuotesCompatibilitySchema,
    ensureContractForAcceptedQuote,
    getPricingUserId,
    insertSharedQuote,
    mapPriceAdministrationQuote,
    mapQuoteCompatibilityRecord,
    normalizeJsonArrayField,
    normalizeJsonObjectField,
    normalizeLegacyQuoteStatus,
    serializeQuoteDocument,
    syncQuoteArtifactToCustomerDrive,
    toNumericValue,
  } = deps;

  async function resolveQuoteUserId(req: any) {
    const headerUserId = getPricingUserId(req);
    if (headerUserId) {
      return String(headerUserId);
    }

    const fallback = await pool.query("SELECT id FROM users LIMIT 1");
    return fallback.rows[0]?.id || "default-user";
  }

  function buildSharedQuoteWhereClause(options: {
    userId?: string | null;
    status?: string | null;
    quoteType?: string | null;
    contractAmendmentFor?: string | null;
    signatureStatus?: string | null;
    clientId?: string | null;
  }) {
    const whereClauses: string[] = [];
    const params: any[] = [];

    if (options.userId) {
      params.push(options.userId);
      whereClauses.push(`created_by = $${params.length}`);
    }

    if (options.clientId) {
      params.push(options.clientId);
      whereClauses.push(`client_id = $${params.length}`);
    }

    if (options.quoteType) {
      params.push(options.quoteType);
      whereClauses.push(`quote_type = $${params.length}`);
    }

    if (options.contractAmendmentFor) {
      params.push(options.contractAmendmentFor);
      whereClauses.push(`contract_amendment_for = $${params.length}`);
    }

    if (options.signatureStatus) {
      params.push(options.signatureStatus);
      whereClauses.push(`signature_status = $${params.length}`);
    }

    if (options.status) {
      if (options.status === "pending") {
        params.push(["pending", "sent", "viewed"]);
        whereClauses.push(`COALESCE(status, 'draft') = ANY($${params.length})`);
      } else {
        params.push(options.status);
        whereClauses.push(`COALESCE(status, 'draft') = $${params.length}`);
      }
    }

    return {
      params,
      whereSql:
        whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "",
    };
  }

  function buildQuoteReminderConfigStoreKey(userId: string) {
    return `quotes:reminders:config:${userId}`;
  }

  function buildQuoteReminderStatusStoreKey(userId: string) {
    return `quotes:reminders:status:${userId}`;
  }

  function createDefaultQuoteReminderConfig() {
    return {
      expiryReminders: {
        enabled: true,
        daysBeforeExpiry: [7, 3, 1],
      },
      followUpReminders: {
        enabled: true,
        daysAfterSent: [3, 7, 14],
      },
      emailSubjectPrefix: "[Påminnelse]",
      defaultEmailFrom: "noreply@creatorhub.no",
    };
  }

  function normalizeReminderDayList(value: unknown, fallback: number[]) {
    const source = Array.isArray(value) ? value : fallback;
    const seen = new Set<number>();
    return source
      .map((entry) => Number(entry))
      .filter((entry) => Number.isFinite(entry) && entry >= 0)
      .sort((a, b) => a - b)
      .filter((entry) => {
        if (seen.has(entry)) return false;
        seen.add(entry);
        return true;
      });
  }

  function normalizeQuoteReminderConfig(input: unknown) {
    const defaults = createDefaultQuoteReminderConfig();
    const source =
      input && typeof input === "object" ? (input as Record<string, any>) : {};
    const expirySource =
      source.expiryReminders && typeof source.expiryReminders === "object"
        ? (source.expiryReminders as Record<string, unknown>)
        : {};
    const followUpSource =
      source.followUpReminders && typeof source.followUpReminders === "object"
        ? (source.followUpReminders as Record<string, unknown>)
        : {};

    return {
      expiryReminders: {
        enabled:
          typeof expirySource.enabled === "boolean"
            ? expirySource.enabled
            : defaults.expiryReminders.enabled,
        daysBeforeExpiry: normalizeReminderDayList(
          expirySource.daysBeforeExpiry,
          defaults.expiryReminders.daysBeforeExpiry,
        ),
      },
      followUpReminders: {
        enabled:
          typeof followUpSource.enabled === "boolean"
            ? followUpSource.enabled
            : defaults.followUpReminders.enabled,
        daysAfterSent: normalizeReminderDayList(
          followUpSource.daysAfterSent,
          defaults.followUpReminders.daysAfterSent,
        ),
      },
      emailSubjectPrefix:
        typeof source.emailSubjectPrefix === "string" &&
        source.emailSubjectPrefix.trim()
          ? source.emailSubjectPrefix.trim()
          : defaults.emailSubjectPrefix,
      defaultEmailFrom:
        typeof source.defaultEmailFrom === "string" &&
        source.defaultEmailFrom.trim()
          ? source.defaultEmailFrom.trim()
          : defaults.defaultEmailFrom,
    };
  }

  function buildQuoteProfessionVariants(profession: unknown) {
    const normalized =
      typeof profession === "string" ? profession.trim().toLowerCase() : "";
    if (!normalized || normalized === "all") {
      return [];
    }

    const aliasMap: Record<string, string[]> = {
      fotograf: ["fotograf", "photographer"],
      photographer: ["photographer", "fotograf"],
      videograf: ["videograf", "videographer"],
      videographer: ["videographer", "videograf"],
      musikkprodusent: [
        "musikkprodusent",
        "music_producer",
        "music producer",
        "music-producer",
      ],
      music_producer: [
        "music_producer",
        "music producer",
        "music-producer",
        "musikkprodusent",
      ],
      "music producer": [
        "music_producer",
        "music producer",
        "music-producer",
        "musikkprodusent",
      ],
      "music-producer": [
        "music_producer",
        "music producer",
        "music-producer",
        "musikkprodusent",
      ],
    };

    return Array.from(new Set(aliasMap[normalized] || [normalized]));
  }

  function normalizeQuoteTemplateItems(value: unknown) {
    return normalizeJsonArrayField(value)
      .map((entry: any) => {
        if (typeof entry === "string") return entry.trim();
        if (entry && typeof entry === "object") {
          return String(
            entry.name || entry.label || entry.title || entry.description || "",
          ).trim();
        }
        return "";
      })
      .filter(Boolean);
  }

  function normalizeQuoteTemplateServices(value: unknown) {
    return normalizeJsonArrayField(value)
      .map((entry: any) => {
        if (typeof entry === "string") {
          return {
            name: entry.trim(),
            price: "0",
          };
        }
        if (entry && typeof entry === "object") {
          const name = String(
            entry.name || entry.label || entry.title || entry.description || "",
          ).trim();
          if (!name) return null;
          return {
            name,
            price: String(
              toNumericValue(
                entry.price,
                toNumericValue(entry.unitPrice, toNumericValue(entry.totalPrice)),
              ),
            ),
          };
        }
        return null;
      })
      .filter(
        (entry): entry is { name: string; price: string } => entry !== null,
      );
  }

  type QuoteTemplateRecord = {
    id: string;
    name: string;
    description: string;
    profession: string;
    projectType: string;
    category: string;
    basePrice: string;
    services: Array<{ name: string; price: string }>;
    additionalServices: Array<{ name: string; price: string }>;
    includedItems: string[];
    deliverables: string[];
    validityDays: number;
    notes: string;
    isPublic: boolean;
    usageCount: number;
    tags: string[];
    createdBy: string;
    createdAt: string;
  };

  function buildQuoteTemplateFromPackageRow(
    row: any,
    source: "pricing_package" | "legacy_package",
  ): QuoteTemplateRecord {
    const name = String(row.package_name || row.name || "Pakke").trim();
    const includedItems = normalizeQuoteTemplateItems(
      row.included_services ?? row.inclusions,
    );
    const deliverables = normalizeQuoteTemplateItems(row.deliverables);
    const basePrice = String(
      toNumericValue(
        row.base_price,
        toNumericValue(row.price, toNumericValue(row.basePrice)),
      ),
    );
    const services = normalizeQuoteTemplateServices(
      row.included_services ?? row.inclusions,
    );

    return {
      id: `${source}:${row.id}`,
      name,
      description: String(row.description || "").trim(),
      profession: String(row.profession || "fotograf"),
      projectType: String(row.category || row.package_type || "general"),
      category: source === "pricing_package" ? "pricing-package" : "package",
      basePrice,
      services: services.length > 0 ? services : [{ name, price: basePrice }],
      additionalServices: [],
      includedItems,
      deliverables: deliverables.length > 0 ? deliverables : includedItems,
      validityDays: 30,
      notes: String(row.description || "").trim(),
      isPublic: Boolean(row.is_visible ?? row.isVisible ?? false),
      usageCount: 0,
      tags: Array.from(
        new Set(
          [row.profession, row.category, row.package_type]
            .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
            .filter(Boolean),
        ),
      ),
      createdBy: String(row.user_id || row.userId || ""),
      createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    };
  }

  function buildQuoteTemplateFromQuoteRow(row: any): QuoteTemplateRecord {
    const quote = mapQuoteCompatibilityRecord(row);
    const services = Array.isArray(quote.services)
      ? quote.services
          .map((service: any) => {
            const name = String(
              service?.description || service?.name || "",
            ).trim();
            if (!name) return null;
            return {
              name,
              price: String(
                toNumericValue(
                  service?.totalPrice,
                  toNumericValue(service?.unitPrice),
                ),
              ),
            };
          })
          .filter(
            (service: any): service is { name: string; price: string } =>
              service !== null,
          )
      : [];

    return {
      id: `quote:${quote.id}`,
      name: quote.title || quote.quoteNumber || "Tilbudsmal",
      description: quote.description || "",
      profession: quote.profession || "fotograf",
      projectType: quote.projectType || "general",
      category: quote.quoteType || "standard",
      basePrice: String(toNumericValue(quote.basePrice)),
      services:
        services.length > 0
          ? services
          : [
              {
                name: quote.title || "Tjeneste",
                price: String(toNumericValue(quote.basePrice)),
              },
            ],
      additionalServices: Array.isArray(quote.additionalServices)
        ? quote.additionalServices.map((service: any) => ({
            name: String(
              service?.description || service?.name || "Tillegg",
            ).trim(),
            price: String(
              toNumericValue(
                service?.totalPrice,
                toNumericValue(
                  service?.unitPrice,
                  toNumericValue(service?.price),
                ),
              ),
            ),
          }))
        : [],
      includedItems: Array.isArray(quote.services)
        ? quote.services
            .map((service: any) =>
              String(service?.description || service?.name || "").trim(),
            )
            .filter(Boolean)
        : [],
      deliverables: Array.isArray(quote.services)
        ? quote.services
            .map((service: any) =>
              String(service?.description || service?.name || "").trim(),
            )
            .filter(Boolean)
        : [],
      validityDays: quote.validUntil
        ? Math.max(
            0,
            Math.round(
              (new Date(quote.validUntil).getTime() - Date.now()) / 86400000,
            ),
          )
        : 30,
      notes: quote.notes || "",
      isPublic: false,
      usageCount: 1,
      tags: Array.from(
        new Set(
          [quote.profession, quote.projectType, quote.quoteType]
            .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
            .filter(Boolean),
        ),
      ),
      createdBy: String(quote.createdBy || ""),
      createdAt: quote.createdAt || new Date().toISOString(),
    };
  }


  app.get("/api/quotes/templates", async (req, res) => {
    try {
      const userId =
        typeof req.query.userId === "string" && req.query.userId.trim()
          ? req.query.userId.trim()
          : await resolveQuoteUserId(req);
      const professionVariants = buildQuoteProfessionVariants(
        req.query.profession,
      );

      const params: any[] = [userId];
      let pricingWhere = "WHERE user_id = $1";
      let legacyWhere = "WHERE user_id = $1 AND active = true";
      let quoteWhere = "WHERE created_by = $1";

      if (professionVariants.length > 0) {
        params.push(professionVariants);
        const filterIndex = params.length;
        pricingWhere += ` AND LOWER(COALESCE(profession, '')) = ANY($${filterIndex}::text[])`;
        legacyWhere += ` AND LOWER(COALESCE(profession, '')) = ANY($${filterIndex}::text[])`;
        quoteWhere += ` AND LOWER(COALESCE(profession, '')) = ANY($${filterIndex}::text[])`;
      }

      const [pricingPackagesResult, legacyPackagesResult] = await Promise.all([
        pool.query(
          `SELECT id::text, user_id, package_name, description, base_price, included_services, profession,
                  is_visible, created_at
           FROM pricing_packages ${pricingWhere}
           ORDER BY created_at DESC
           LIMIT 24`,
          params,
        ),
        pool.query(
          `SELECT id::text, user_id, name, description, price, inclusions, deliverables, category, profession, created_at
           FROM packages ${legacyWhere}
           ORDER BY created_at DESC
           LIMIT 24`,
          params,
        ),
      ]);

      let templates: QuoteTemplateRecord[] = [
        ...pricingPackagesResult.rows.map((row: any) =>
          buildQuoteTemplateFromPackageRow(row, "pricing_package"),
        ),
        ...legacyPackagesResult.rows.map((row: any) =>
          buildQuoteTemplateFromPackageRow(row, "legacy_package"),
        ),
      ];

      if (templates.length === 0) {
        const quoteTemplatesResult = await pool.query(
          `SELECT * FROM quotes ${quoteWhere}
           ORDER BY accepted_at DESC NULLS LAST, created_at DESC
           LIMIT 12`,
          params,
        );
        templates = quoteTemplatesResult.rows.map(buildQuoteTemplateFromQuoteRow);
      }

      const deduped = Array.from(
        templates
          .reduce((acc, template) => {
            const key = `${template.name.toLowerCase()}::${template.profession.toLowerCase()}`;
            if (!acc.has(key)) {
              acc.set(key, template);
            }
            return acc;
          }, new Map<string, QuoteTemplateRecord>())
          .values(),
      );

      res.json({ templates: deduped });
    } catch (error) {
      console.error("Quote templates error:", error);
      res.status(500).json({ error: "Failed to fetch quote templates" });
    }
  });

  app.get("/api/quotes/reminders/config", async (req, res) => {
    try {
      const userId =
        typeof req.query.userId === "string" && req.query.userId.trim()
          ? req.query.userId.trim()
          : await resolveQuoteUserId(req);
      const stored = await compatStoreGet<unknown>(
        buildQuoteReminderConfigStoreKey(userId),
      );
      res.json({
        success: true,
        config: normalizeQuoteReminderConfig(stored),
      });
    } catch (error) {
      console.error("Quote reminder config fetch error:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to fetch reminder config" });
    }
  });

  app.put("/api/quotes/reminders/config", async (req, res) => {
    try {
      const userId =
        typeof req.body?.userId === "string" && req.body.userId.trim()
          ? req.body.userId.trim()
          : await resolveQuoteUserId(req);
      const config = normalizeQuoteReminderConfig(req.body?.config);
      await compatStoreSet(buildQuoteReminderConfigStoreKey(userId), config);
      res.json({ success: true, config });
    } catch (error) {
      console.error("Quote reminder config save error:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to save reminder config" });
    }
  });

  app.get("/api/quotes/reminders/status", async (req, res) => {
    try {
      const userId =
        typeof req.query.userId === "string" && req.query.userId.trim()
          ? req.query.userId.trim()
          : await resolveQuoteUserId(req);
      const storedStatus = await compatStoreGet<{ lastCheck?: string }>(
        buildQuoteReminderStatusStoreKey(userId),
      );
      res.json({
        success: true,
        status: {
          isRunning: true,
          lastCheck: storedStatus?.lastCheck || null,
        },
      });
    } catch (error) {
      console.error("Quote reminder status error:", error);
      res
        .status(500)
        .json({
          success: false,
          error: "Failed to fetch reminder service status",
        });
    }
  });

  app.post("/api/quotes/reminders/trigger", async (req, res) => {
    try {
      await ensureQuotesCompatibilitySchema();

      const userId =
        typeof req.body?.userId === "string" && req.body.userId.trim()
          ? req.body.userId.trim()
          : await resolveQuoteUserId(req);
      const config = normalizeQuoteReminderConfig(
        await compatStoreGet<unknown>(buildQuoteReminderConfigStoreKey(userId)),
      );
      const result = await pool.query(
        `SELECT * FROM quotes
         WHERE created_by = $1
           AND COALESCE(status, 'draft') = ANY($2::text[])
         ORDER BY created_at DESC`,
        [userId, ["pending", "sent", "viewed"]],
      );

      const now = Date.now();
      const dueExpiryQuotes = result.rows.filter((row: any) => {
        if (!config.expiryReminders.enabled || !row.valid_until) return false;
        const diffDays = Math.ceil(
          (new Date(row.valid_until).getTime() - now) / 86400000,
        );
        return config.expiryReminders.daysBeforeExpiry.includes(diffDays);
      });

      const dueFollowUpQuotes = result.rows.filter((row: any) => {
        if (!config.followUpReminders.enabled || !row.sent_at) return false;
        const diffDays = Math.floor(
          (now - new Date(row.sent_at).getTime()) / 86400000,
        );
        return config.followUpReminders.daysAfterSent.includes(diffDays);
      });

      const summary = {
        lastCheck: new Date().toISOString(),
        processedQuotes: result.rows.length,
        remindersGenerated: dueExpiryQuotes.length + dueFollowUpQuotes.length,
        dueExpiryQuotes: dueExpiryQuotes.length,
        dueFollowUpQuotes: dueFollowUpQuotes.length,
      };

      await compatStoreSet(buildQuoteReminderStatusStoreKey(userId), summary);

      res.json({
        success: true,
        ...summary,
      });
    } catch (error) {
      console.error("Quote reminder trigger error:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to trigger quote reminders" });
    }
  });

  app.post("/api/quotes/items", async (req, res) => {
    try {
      await ensureQuotesCompatibilitySchema();

      const userId = await resolveQuoteUserId(req);
      const description =
        typeof req.body?.description === "string"
          ? req.body.description.trim()
          : "";
      const quantity = Math.max(
        1,
        Math.floor(toNumericValue(req.body?.quantity, 1)),
      );
      const unitPrice = toNumericValue(req.body?.unitPrice, 0);
      const projectId =
        typeof req.body?.projectId === "string" && req.body.projectId.trim()
          ? req.body.projectId.trim()
          : null;

      if (!description) {
        return res.status(400).json({ error: "description is required" });
      }

      const item = {
        type: "custom",
        description,
        quantity,
        unitPrice,
        totalPrice: quantity * unitPrice,
      };

      let quoteRow: any | null = null;

      if (projectId) {
        const existingDraftResult = await pool.query(
          `SELECT * FROM quotes
           WHERE created_by = $1
             AND project_id = $2
             AND COALESCE(status, 'draft') = 'draft'
           ORDER BY created_at DESC
           LIMIT 1`,
          [userId, projectId],
        );

        if (existingDraftResult.rows.length > 0) {
          const currentQuote = mapPriceAdministrationQuote(
            existingDraftResult.rows[0],
          );
          const nextServices = [
            ...(Array.isArray(currentQuote.services)
              ? currentQuote.services
              : []),
            item,
          ];
          const additionalCosts = Array.isArray(currentQuote.additionalCosts)
            ? currentQuote.additionalCosts
            : [];
          const discounts = Array.isArray(currentQuote.discounts)
            ? currentQuote.discounts
            : [];
          const subtotal = nextServices.reduce(
            (sum: number, service: any) =>
              sum + toNumericValue(service?.totalPrice),
            0,
          );
          const additionalCostsTotal = additionalCosts.reduce(
            (sum: number, cost: any) => sum + toNumericValue(cost?.amount),
            0,
          );
          const discountsTotal = discounts.reduce(
            (sum: number, discount: any) =>
              sum + toNumericValue(discount?.amount),
            0,
          );
          const taxableBase = Math.max(
            subtotal + additionalCostsTotal - discountsTotal,
            0,
          );
          const mva = taxableBase * 0.25;
          const totalAmount = taxableBase + mva;

          const updatedResult = await pool.query(
            `UPDATE quotes
             SET services = $1::jsonb,
                 base_price = $2,
                 subtotal = $3,
                 mva = $4,
                 total_amount = $5,
                 updated_at = NOW()
             WHERE id = $6
             RETURNING *`,
            [
              JSON.stringify(nextServices),
              subtotal,
              subtotal,
              mva,
              totalAmount,
              currentQuote.id,
            ],
          );
          quoteRow = updatedResult.rows[0] || null;
        }
      }

      if (!quoteRow) {
        quoteRow = await insertSharedQuote(
          {
            clientId: req.body?.clientId || projectId || userId,
            clientName: req.body?.clientName || "Utkast",
            clientEmail: req.body?.clientEmail || "",
            title: req.body?.title || "Utkast fra notat",
            description,
            projectId,
            profession: req.body?.profession || "fotograf",
            status: "draft",
            services: [item],
            subtotal: item.totalPrice,
            mva: item.totalPrice * 0.25,
            totalAmount: item.totalPrice * 1.25,
            clientInfo: {
              name: req.body?.clientName || "Utkast",
              email: req.body?.clientEmail || "",
            },
          },
          userId,
        );
      }

      quoteRow = await syncQuoteArtifactToCustomerDrive(quoteRow, userId);

      res.status(201).json({
        success: true,
        item,
        quote: mapQuoteCompatibilityRecord(quoteRow),
      });
    } catch (error) {
      console.error("Quote item create error:", error);
      res.status(500).json({ error: "Failed to add quote item" });
    }
  });

  app.post("/api/quotes/create", async (req, res) => {
    try {
      const userId = await resolveQuoteUserId(req);
      const row = await insertSharedQuote(req.body, userId);
      const syncedRow = await syncQuoteArtifactToCustomerDrive(row, userId);
      return res.status(201).json(mapQuoteCompatibilityRecord(syncedRow));
    } catch (error) {
      console.error("Quote creation error:", error);
      return res.status(500).json({ error: "Failed to create quote" });
    }
  });

  app.get("/api/quotes/all", async (req, res) => {
    try {
      await ensureQuotesCompatibilitySchema();

      const userId =
        typeof req.query.userId === "string" && req.query.userId.trim()
          ? req.query.userId.trim()
          : getPricingUserId(req);
      const status =
        typeof req.query.status === "string" ? req.query.status.trim() : "";
      const quoteType =
        typeof req.query.quoteType === "string" ? req.query.quoteType.trim() : "";
      const contractAmendmentFor =
        typeof req.query.contractAmendmentFor === "string"
          ? req.query.contractAmendmentFor.trim()
          : "";

      const { params, whereSql } = buildSharedQuoteWhereClause({
        userId,
        status: status || null,
        quoteType: quoteType || null,
        contractAmendmentFor: contractAmendmentFor || null,
      });

      const result = await pool.query(
        `SELECT * FROM quotes ${whereSql} ORDER BY created_at DESC`,
        params,
      );

      res.json({ quotes: result.rows.map(mapQuoteCompatibilityRecord) });
    } catch (error) {
      console.error("Quote list error:", error);
      res.status(500).json({ error: "Failed to fetch quotes" });
    }
  });

  app.get("/api/quotes/stats/overview", async (req, res) => {
    try {
      await ensureQuotesCompatibilitySchema();

      const userId =
        typeof req.query.userId === "string" && req.query.userId.trim()
          ? req.query.userId.trim()
          : getPricingUserId(req);

      const { params, whereSql } = buildSharedQuoteWhereClause({ userId });
      const result = await pool.query(`SELECT * FROM quotes ${whereSql}`, params);
      const quotes = result.rows.map(mapQuoteCompatibilityRecord);

      const stats = {
        total: quotes.length,
        pending: quotes.filter((quote: any) => quote.status === "pending").length,
        accepted: quotes.filter((quote: any) => quote.status === "accepted")
          .length,
        rejected: quotes.filter((quote: any) => quote.status === "rejected")
          .length,
        totalValue: quotes.reduce(
          (sum: number, quote: any) => sum + toNumericValue(quote.totalAmount),
          0,
        ),
        acceptedValue: quotes
          .filter((quote: any) => quote.status === "accepted")
          .reduce(
            (sum: number, quote: any) => sum + toNumericValue(quote.totalAmount),
            0,
          ),
        conversionRate:
          quotes.length > 0
            ? (quotes.filter((quote: any) => quote.status === "accepted").length /
                quotes.length) *
              100
            : 0,
      };

      res.json({ stats });
    } catch (error) {
      console.error("Quote stats error:", error);
      res.status(500).json({ error: "Failed to fetch quote stats" });
    }
  });

  app.get("/api/quotes", async (req, res) => {
    try {
      await ensureQuotesCompatibilitySchema();

      const userId =
        typeof req.query.userId === "string" && req.query.userId.trim()
          ? req.query.userId.trim()
          : getPricingUserId(req);
      const status =
        typeof req.query.status === "string" ? req.query.status.trim() : "";
      const signatureStatus =
        typeof req.query.signature_status === "string"
          ? req.query.signature_status.trim()
          : "";

      const { params, whereSql } = buildSharedQuoteWhereClause({
        userId,
        status: status || null,
        signatureStatus: signatureStatus || null,
      });

      const result = await pool.query(
        `SELECT * FROM quotes ${whereSql} ORDER BY created_at DESC`,
        params,
      );

      const data = result.rows.map((row) => ({
        ...mapQuoteCompatibilityRecord(row),
        signature_status: row.signature_status || "pending",
        google_doc_url: row.google_doc_url,
        client_info: normalizeJsonObjectField(row.client_info) || {
          name: row.client_name || "",
          email: row.client_email || "",
        },
        approvers: normalizeJsonArrayField(row.approvers),
      }));

      res.json({ data });
    } catch (error) {
      console.error("Quote compatibility list error:", error);
      res.status(500).json({ error: "Failed to fetch quotes" });
    }
  });

  app.get("/api/quotes/:id/pdf", async (req, res) => {
    try {
      await ensureQuotesCompatibilitySchema();

      const result = await pool.query(
        "SELECT * FROM quotes WHERE id = $1 LIMIT 1",
        [req.params.id],
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Quote not found" });
      }

      const quote = mapQuoteCompatibilityRecord(result.rows[0]);
      const doc = new PDFDocument({ margin: 48, size: "A4" });
      const fileName = `${quote.quoteNumber || quote.id}.pdf`;

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename=\"${fileName}\"`);
      doc.pipe(res);

      doc.fontSize(22).text("Tilbud", { align: "left" });
      doc.moveDown(0.5);
      doc
        .fontSize(11)
        .fillColor("#444")
        .text(`Tilbudsnummer: ${quote.quoteNumber}`);
      doc.text(`Kunde: ${quote.clientName || "Ukjent kunde"}`);
      if (quote.clientEmail) {
        doc.text(`E-post: ${quote.clientEmail}`);
      }
      doc.text(`Status: ${quote.status}`);
      if (quote.validUntil) {
        doc.text(
          `Gyldig til: ${new Date(quote.validUntil).toLocaleDateString("nb-NO")}`,
        );
      }
      doc.moveDown();

      doc
        .fontSize(16)
        .fillColor("#111")
        .text(quote.title || "Tilbud");
      doc.moveDown(0.5);
      if (quote.description) {
        doc.fontSize(11).fillColor("#333").text(quote.description);
        doc.moveDown();
      }

      doc.fontSize(13).fillColor("#111").text("Tjenester");
      doc.moveDown(0.5);
      (Array.isArray(quote.services) ? quote.services : []).forEach(
        (service: any) => {
          doc
            .fontSize(11)
            .text(
              `${service.description || "Tjeneste"} · ${toNumericValue(service.quantity, 1)} x ${toNumericValue(service.unitPrice, 0).toLocaleString("nb-NO")} NOK = ${toNumericValue(service.totalPrice, 0).toLocaleString("nb-NO")} NOK`,
            );
        },
      );

      if (
        Array.isArray(quote.additionalCosts) &&
        quote.additionalCosts.length > 0
      ) {
        doc.moveDown();
        doc.fontSize(13).text("Tilleggskostnader");
        doc.moveDown(0.5);
        quote.additionalCosts.forEach((cost: any) => {
          doc
            .fontSize(11)
            .text(
              `${cost.description || "Tillegg"} · ${toNumericValue(cost.amount, 0).toLocaleString("nb-NO")} NOK`,
            );
        });
      }

      if (Array.isArray(quote.discounts) && quote.discounts.length > 0) {
        doc.moveDown();
        doc.fontSize(13).text("Rabatter");
        doc.moveDown(0.5);
        quote.discounts.forEach((discount: any) => {
          doc
            .fontSize(11)
            .text(
              `${discount.description || "Rabatt"} · -${toNumericValue(discount.amount, 0).toLocaleString("nb-NO")} NOK`,
            );
        });
      }

      doc.moveDown();
      doc
        .fontSize(12)
        .text(
          `Subtotal: ${toNumericValue(quote.subtotal, 0).toLocaleString("nb-NO")} NOK`,
        );
      doc.text(
        `MVA: ${toNumericValue(quote.mva, 0).toLocaleString("nb-NO")} NOK`,
      );
      doc
        .fontSize(14)
        .fillColor("#111")
        .text(
          `Totalt: ${toNumericValue(quote.totalAmount, 0).toLocaleString("nb-NO")} NOK`,
        );

      if (quote.notes) {
        doc.moveDown();
        doc.fontSize(12).text("Notater");
        doc.moveDown(0.5);
        doc.fontSize(11).text(quote.notes);
      }

      doc.end();
    } catch (error) {
      console.error("Quote PDF error:", error);
      res.status(500).json({ error: "Failed to generate quote PDF" });
    }
  });

  app.get("/api/quotes/:id", async (req, res) => {
    try {
      await ensureQuotesCompatibilitySchema();

      const result = await pool.query(
        "SELECT * FROM quotes WHERE id = $1 LIMIT 1",
        [req.params.id],
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Quote not found" });
      }

      res.json({ data: mapQuoteCompatibilityRecord(result.rows[0]) });
    } catch (error) {
      console.error("Quote fetch error:", error);
      res.status(500).json({ error: "Failed to fetch quote" });
    }
  });

  app.put("/api/quotes/:id/status", async (req, res) => {
    try {
      await ensureQuotesCompatibilitySchema();

      const status = normalizeLegacyQuoteStatus(req.body?.status);
      const updates = ["status = $1", "updated_at = NOW()"];
      const params: any[] = [status];

      if (status === "accepted") {
        updates.push("accepted_at = NOW()");
      } else if (status === "rejected") {
        updates.push("responded_at = NOW()");
      }

      params.push(req.params.id);
      const result = await pool.query(
        `UPDATE quotes SET ${updates.join(", ")} WHERE id = $2 RETURNING *`,
        params,
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Quote not found" });
      }

      const syncedRow = await syncQuoteArtifactToCustomerDrive(result.rows[0]);
      let quote = mapQuoteCompatibilityRecord(syncedRow);

      if (status === "accepted") {
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

      res.json({ success: true, quote });
    } catch (error) {
      console.error("Quote status update error:", error);
      res.status(500).json({ error: "Failed to update quote status" });
    }
  });

  app.put("/api/quotes/:id/link-project", async (req, res) => {
    try {
      await ensureQuotesCompatibilitySchema();

      const projectId = req.body?.projectId ? String(req.body.projectId) : "";
      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }

      const result = await pool.query(
        "UPDATE quotes SET project_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
        [projectId, req.params.id],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Quote not found" });
      }

      res.json({
        success: true,
        quote: mapQuoteCompatibilityRecord(result.rows[0]),
      });
    } catch (error) {
      console.error("Quote link-project error:", error);
      res.status(500).json({ error: "Failed to link quote to project" });
    }
  });

  app.post("/api/quotes/:id/create-chat", async (req, res) => {
    try {
      await ensureQuotesCompatibilitySchema();

      const result = await pool.query(
        "SELECT * FROM quotes WHERE id = $1 LIMIT 1",
        [req.params.id],
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Quote not found" });
      }

      const quote = mapQuoteCompatibilityRecord(result.rows[0]);
      const projectCreationData =
        quote.projectCreationData && typeof quote.projectCreationData === "object"
          ? (quote.projectCreationData as Record<string, unknown>)
          : {};
      const existingChatSpaceId =
        typeof projectCreationData.chatSpaceId === "string"
          ? projectCreationData.chatSpaceId
          : "";

      if (existingChatSpaceId) {
        return res.json({
          success: true,
          spaceUrl: existingChatSpaceId.startsWith("http")
            ? existingChatSpaceId
            : `https://chat.google.com/app/chat/${existingChatSpaceId.replace(/^spaces\//, "")}`,
        });
      }

      return res.json({
        success: true,
        spaceUrl: `/photographer-dashboard-material?quoteId=${encodeURIComponent(String(quote.id))}&chat=1`,
        message: "Quote chat fallback created",
      });
    } catch (error) {
      console.error("Quote create-chat error:", error);
      res.status(500).json({ error: "Failed to create quote chat" });
    }
  });

  app.post("/api/quotes/:id/send-email", async (req, res) => {
    try {
      await ensureQuotesCompatibilitySchema();

      const result = await pool.query(
        `UPDATE quotes
         SET sent_at = NOW(),
             status = CASE WHEN COALESCE(status, 'draft') = 'draft' THEN 'pending' ELSE status END,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [req.params.id],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Quote not found" });
      }

      console.log("📧 Quote email marked as sent:", {
        quoteId: req.params.id,
        to: req.body?.clientEmail,
        clientName: req.body?.clientName,
      });

      res.json({
        success: true,
        emailId: `quote-email-${Date.now()}`,
        sentAt: new Date().toISOString(),
        quote: mapQuoteCompatibilityRecord(result.rows[0]),
      });
    } catch (error) {
      console.error("Quote send-email error:", error);
      res.status(500).json({ error: "Failed to send quote email" });
    }
  });

  app.put("/api/quotes/:id", async (req, res) => {
    try {
      await ensureQuotesCompatibilitySchema();

      const allowedScalarFields: Array<[string, string]> = [
        ["title", "title"],
        ["description", "description"],
        ["notes", "notes"],
        ["internalNotes", "internal_notes"],
        ["projectId", "project_id"],
        ["profession", "profession"],
        ["projectType", "project_type"],
        ["quoteType", "quote_type"],
        ["contractAmendmentFor", "contract_amendment_for"],
        ["googleDocUrl", "google_doc_url"],
        ["googleDocId", "google_doc_id"],
        ["signatureStatus", "signature_status"],
        ["accountingProvider", "accounting_provider"],
        ["accountingStatus", "accounting_status"],
        ["fikenInvoiceId", "fiken_invoice_id"],
        ["fikenInvoiceNumber", "fiken_invoice_number"],
        ["fikenCustomerId", "fiken_customer_id"],
        ["fikenInvoiceStatus", "fiken_invoice_status"],
        ["fikenSyncStatus", "fiken_sync_status"],
        ["fikenInvoiceUrl", "fiken_invoice_url"],
        ["tripletexCustomerId", "tripletex_customer_id"],
        ["tripletexInvoiceId", "tripletex_invoice_id"],
        ["tripletexInvoiceNumber", "tripletex_invoice_number"],
        ["tripletexInvoiceStatus", "tripletex_invoice_status"],
        ["tripletexInvoiceUrl", "tripletex_invoice_url"],
        ["tripletexVoucherId", "tripletex_voucher_id"],
        ["tripletexVoucherUrl", "tripletex_voucher_url"],
      ];

      const setClauses = ["updated_at = NOW()"];
      const params: any[] = [];
      let idx = 1;

      for (const [inputKey, column] of allowedScalarFields) {
        if (req.body?.[inputKey] !== undefined) {
          setClauses.push(`${column} = $${idx++}`);
          params.push(req.body[inputKey]);
        }
      }

      if (req.body?.validUntil !== undefined) {
        setClauses.push(`valid_until = $${idx++}`);
        params.push(req.body.validUntil ? new Date(req.body.validUntil) : null);
      }

      if (req.body?.fikenSyncedAt !== undefined) {
        setClauses.push(`fiken_synced_at = $${idx++}`);
        params.push(req.body.fikenSyncedAt ? new Date(req.body.fikenSyncedAt) : null);
      }

      if (req.body?.tripletexSyncedAt !== undefined) {
        setClauses.push(`tripletex_synced_at = $${idx++}`);
        params.push(req.body.tripletexSyncedAt ? new Date(req.body.tripletexSyncedAt) : null);
      }

      if (req.body?.totalAmount !== undefined) {
        const totalAmount = toNumericValue(req.body.totalAmount);
        const subtotal = totalAmount / 1.25;
        const mva = totalAmount - subtotal;
        setClauses.push(`total_amount = $${idx++}`);
        params.push(totalAmount);
        setClauses.push(`subtotal = $${idx++}`);
        params.push(subtotal);
        setClauses.push(`mva = $${idx++}`);
        params.push(mva);
      }

      if (req.body?.status !== undefined) {
        setClauses.push(`status = $${idx++}`);
        params.push(normalizeLegacyQuoteStatus(req.body.status));
      }

      if (req.body?.clientInfo !== undefined) {
        setClauses.push(`client_info = $${idx++}::jsonb`);
        params.push(JSON.stringify(req.body.clientInfo || {}));
      }

      if (req.body?.approvers !== undefined) {
        setClauses.push(`approvers = $${idx++}::jsonb`);
        params.push(
          JSON.stringify(
            Array.isArray(req.body.approvers) ? req.body.approvers : [],
          ),
        );
      }

      if (req.body?.projectCreationData !== undefined) {
        setClauses.push(`project_creation_data = $${idx++}::jsonb`);
        params.push(JSON.stringify(req.body.projectCreationData || {}));
      }

      if (req.body?.services !== undefined) {
        setClauses.push(`services = $${idx++}::jsonb`);
        params.push(
          JSON.stringify(
            Array.isArray(req.body.services) ? req.body.services : [],
          ),
        );
      }

      if (req.body?.additionalCosts !== undefined) {
        setClauses.push(`additional_costs = $${idx++}::jsonb`);
        params.push(
          JSON.stringify(
            Array.isArray(req.body.additionalCosts)
              ? req.body.additionalCosts
              : [],
          ),
        );
      }

      if (req.body?.discounts !== undefined) {
        setClauses.push(`discounts = $${idx++}::jsonb`);
        params.push(
          JSON.stringify(
            Array.isArray(req.body.discounts) ? req.body.discounts : [],
          ),
        );
      }

      if (setClauses.length === 1) {
        return res.status(400).json({ error: "No updates provided" });
      }

      params.push(req.params.id);
      const result = await pool.query(
        `UPDATE quotes SET ${setClauses.join(", ")} WHERE id = $${idx} RETURNING *`,
        params,
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Quote not found" });
      }

      const syncedRow = await syncQuoteArtifactToCustomerDrive(result.rows[0]);
      let quote = mapQuoteCompatibilityRecord(syncedRow);
      if (normalizeLegacyQuoteStatus(req.body?.status) === "accepted") {
        const contract = await ensureContractForAcceptedQuote(syncedRow);
        quote = {
          ...quote,
          contractId: contract.id,
          projectCreationData: {
            ...(quote.projectCreationData &&
            typeof quote.projectCreationData === "object"
              ? quote.projectCreationData
              : {}),
            contractId: contract.id,
            contractStatus: contract.status,
          },
        };
      }

      res.json({ success: true, data: quote });
    } catch (error) {
      console.error("Quote update error:", error);
      res.status(500).json({ error: "Failed to update quote" });
    }
  });

  app.delete("/api/quotes/:id", async (req, res) => {
    try {
      await ensureQuotesCompatibilitySchema();

      const result = await pool.query(
        "DELETE FROM quotes WHERE id = $1 RETURNING id",
        [req.params.id],
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Quote not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Quote delete error:", error);
      res.status(500).json({ error: "Failed to delete quote" });
    }
  });

  app.get("/api/quotes/status/:clientId", async (req, res) => {
    try {
      await ensureQuotesCompatibilitySchema();

      const { clientId } = req.params;
      const result = await pool.query(
        `SELECT * FROM quotes
         WHERE client_id = $1 OR client_email = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [clientId],
      );

      if (result.rows.length === 0) {
        return res.json({ accepted: false, projectId: null, clientInfo: null });
      }

      const row = mapQuoteCompatibilityRecord(result.rows[0]);
      return res.json({
        accepted: row.status === "accepted",
        projectId: row.projectId,
        contractId: row.contractId || row.projectCreationData?.contractId || null,
        quoteId: row.id,
        status: row.status,
        totalAmount: toNumericValue(row.totalAmount),
        clientInfo: {
          name: row.clientName,
          email: row.clientEmail,
        },
      });
    } catch (error) {
      console.error("Quote status error:", error);
      return res.json({ accepted: false, projectId: null, clientInfo: null });
    }
  });
}
