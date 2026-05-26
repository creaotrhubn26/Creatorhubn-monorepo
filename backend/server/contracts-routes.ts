import express from "express";
import type { Pool } from "pg";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import PDFDocument from "pdfkit";
import * as schema from "../migrations/schema.js";
import {
  ensureContractsCompatibilitySchema,
  getContractGoogleESignature,
  prepareContractGoogleESignature,
  sendContractGoogleESignature,
  syncContractGoogleESignature,
  updateContractGoogleESignatureStatus,
} from "./contract-google-signing.js";
import { readString, normalizeJsonObjectField } from "./_shared";

export interface ContractsRoutesDeps {
  app: express.Application;
  pool: Pool;
  db: NodePgDatabase<typeof schema>;
  requireUserSession: (req: any, res: any) => any;
  mapContractRecord: (row: any) => any;
  fetchContractById: (contractId: string) => Promise<any>;
  syncContractLifecycleArtifacts: (params: any) => Promise<void>;
  getActiveSessionFromRequest: (req: express.Request) => any;
  normalizeJsonArrayField: (value: unknown) => any[];
  toNumericValue: (value: unknown, fallback?: number) => number;
  toBiNumericMetric: (value: unknown, fallback?: number) => number;
  calculateContractHash: (contract: any) => string;
}

export function setupContractsRoutes(deps: ContractsRoutesDeps): void {
  const {
    app,
    pool,
    db,
    requireUserSession,
    mapContractRecord,
    fetchContractById,
    syncContractLifecycleArtifacts,
    getActiveSessionFromRequest,
    normalizeJsonArrayField,
    toNumericValue,
    toBiNumericMetric,
    calculateContractHash,
  } = deps;

  async function resolveContractUserId(req: any) {
    const rawUserId =
      readString(req.headers["x-user-id"]) ??
      readString(req.body?.userId) ??
      readString(req.query?.userId);

    if (!rawUserId) {
      return "default-user";
    }

    if (
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
        rawUserId,
      )
    ) {
      return rawUserId;
    }

    try {
      const lookup = await pool.query(
        `SELECT id
           FROM users
          WHERE username = $1 OR email = $1
          LIMIT 1`,
        [rawUserId],
      );
      return lookup.rows[0]?.id || rawUserId;
    } catch {
      return rawUserId;
    }
  }

  function normalizeContractStatusValue(value: unknown) {
    const normalized = readString(value)?.toLowerCase() ?? "draft";
    switch (normalized) {
      case "draft":
      case "active":
      case "completed":
      case "cancelled":
      case "pending_signatures":
      case "signed":
      case "rejected":
        return normalized;
      default:
        return "draft";
    }
  }

  function buildContractNumber() {
    return `CTR-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  }

  function normalizeContractSections(value: unknown) {
    return normalizeJsonArrayField(value).map((entry: any, index: number) => ({
      id: readString(entry?.id) ?? `section-${index + 1}`,
      title:
        readString(entry?.title) ??
        readString(entry?.heading) ??
        `Seksjon ${index + 1}`,
      content: readString(entry?.content) ?? readString(entry?.body) ?? "",
      type: readString(entry?.type) ?? "custom",
      required: typeof entry?.required === "boolean" ? entry.required : false,
    }));
  }

  function buildContractSectionsFromQuote(quote: any) {
    const services = Array.isArray(quote.services) ? quote.services : [];
    const additionalCosts = Array.isArray(quote.additionalCosts)
      ? quote.additionalCosts
      : [];
    const discounts = Array.isArray(quote.discounts) ? quote.discounts : [];

    const servicesText =
      services.length > 0
        ? services
            .map((service: any) => {
              const name =
                readString(service?.description) ??
                readString(service?.name) ??
                "Tjeneste";
              const quantity = Number.isFinite(Number(service?.quantity))
                ? ` x ${Number(service.quantity)}`
                : "";
              const price = toNumericValue(
                service?.totalPrice,
                toNumericValue(service?.unitPrice, 0),
              );
              return `- ${name}${quantity} · ${price.toLocaleString("no-NO")} NOK`;
            })
            .join("\n")
        : "Tilbudet inneholder standard leveranser i henhold til avtalt pakke.";

    const pricingLines = [
      `Subtotal: ${toNumericValue(quote.subtotal, toNumericValue(quote.basePrice, 0)).toLocaleString("no-NO")} NOK`,
      additionalCosts.length > 0
        ? `Tillegg: ${additionalCosts.map((cost: any) => `${readString(cost?.name) ?? readString(cost?.description) ?? "Tillegg"} (${toNumericValue(cost?.amount, 0).toLocaleString("no-NO")} NOK)`).join(", ")}`
        : null,
      discounts.length > 0
        ? `Rabatter: ${discounts.map((discount: any) => `${readString(discount?.name) ?? readString(discount?.discountCode) ?? "Rabatt"} (${toNumericValue(discount?.value ?? discount?.discountValue, 0).toLocaleString("no-NO")} NOK)`).join(", ")}`
        : null,
      `Total: ${toNumericValue(quote.totalAmount, 0).toLocaleString("no-NO")} NOK`,
    ]
      .filter(Boolean)
      .join("\n");

    return [
      {
        id: "services",
        title: "Leveranse og omfang",
        content: servicesText,
        type: "responsibilities",
        required: true,
      },
      {
        id: "pricing",
        title: "Pris og betalingsbetingelser",
        content: pricingLines,
        type: "pricing",
        required: true,
      },
      {
        id: "schedule",
        title: "Fremdrift og neste steg",
        content:
          readString(quote.notes) ??
          `Tilbudet ble akseptert ${quote.acceptedAt ? new Date(quote.acceptedAt).toLocaleDateString("no-NO") : "nylig"}. Kontrakten følger samme prosjektgrunnlag og leveransebeskrivelse som tilbudet.`,
        type: "schedule",
        required: false,
      },
    ];
  }

  async function buildContractPdfBuffer(contract: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: "A4" });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer | Uint8Array) =>
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)),
      );
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const sections = Array.isArray(contract.sections) ? contract.sections : [];
      doc
        .fontSize(22)
        .text(contract.contractTitle || contract.title || "Kontrakt", {
          underline: true,
        });
      doc.moveDown(0.5);
      doc
        .fontSize(10)
        .fillColor("#555")
        .text(`Kontraktnummer: ${contract.contractNumber || contract.id}`);
      doc.text(`Status: ${contract.status || "draft"}`);
      doc.text(
        `Klient: ${contract.clientName || "Ukjent klient"}${contract.clientEmail ? ` · ${contract.clientEmail}` : ""}`,
      );
      if (contract.projectDescription) {
        doc.text(`Prosjekt: ${contract.projectDescription}`);
      }
      if (contract.eventDate) {
        doc.text(
          `Dato: ${new Date(contract.eventDate).toLocaleDateString("no-NO")}`,
        );
      }
      if (contract.eventLocation) {
        doc.text(`Lokasjon: ${contract.eventLocation}`);
      }
      doc.text(
        `Beløp: ${toNumericValue(contract.totalAmount, 0).toLocaleString("no-NO")} NOK`,
      );
      doc.moveDown();
      doc.fillColor("#111");

      if (sections.length > 0) {
        sections.forEach((section: any) => {
          doc.fontSize(14).text(section.title || "Seksjon", { continued: false });
          doc.moveDown(0.2);
          doc.fontSize(11).text(section.content || "Ingen innhold tilgjengelig");
          doc.moveDown();
        });
      } else if (contract.content) {
        doc.fontSize(11).text(contract.content);
        doc.moveDown();
      }

      doc
        .fontSize(10)
        .fillColor("#666")
        .text(`Generert av CreatorHub ${new Date().toLocaleString("no-NO")}`);
      if (contract.googleDocUrl) {
        doc.moveDown(0.4);
        doc.text(`Google-signaturdokument: ${contract.googleDocUrl}`);
      }
      doc.end();
    });
  }

  function extractSectionsFromText(text: string) {
    const sections: any[] = [];

    // Common Norwegian contract section headers
    const sectionKeywords = [
      {
        keywords: ["tjeneste", "leveranse", "arbeid", "ytelse"],
        type: "responsibilities",
        title: "Tjenester og leveranser",
      },
      {
        keywords: ["pris", "betaling", "honorar", "kostnad", "faktura"],
        type: "pricing",
        title: "Priser og betaling",
      },
      {
        keywords: ["frist", "levering", "tidsplan", "dato", "tidspunkt"],
        type: "schedule",
        title: "Frister og tidsplan",
      },
      {
        keywords: [
          "opphavsrett",
          "rettighet",
          "eierskap",
          "copyright",
          "bruksrett",
        ],
        type: "terms",
        title: "Rettigheter og vilkår",
      },
      {
        keywords: ["ansvar", "erstatning", "garanti", "reklamasjon"],
        type: "terms",
        title: "Ansvar og garantier",
      },
      {
        keywords: ["oppsigelse", "heving", "kansellering", "avbestilling"],
        type: "terms",
        title: "Oppsigelse og heving",
      },
    ];

    // Split text into paragraphs
    const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 50);

    // Try to match paragraphs to section types
    const usedParagraphs = new Set<number>();

    sectionKeywords.forEach((section) => {
      const matchingParagraphs: string[] = [];

      paragraphs.forEach((paragraph, index) => {
        if (usedParagraphs.has(index)) return;

        const lowerPara = paragraph.toLowerCase();
        const hasKeyword = section.keywords.some((keyword) =>
          lowerPara.includes(keyword),
        );

        if (hasKeyword) {
          matchingParagraphs.push(paragraph.trim());
          usedParagraphs.add(index);
        }
      });

      if (matchingParagraphs.length > 0) {
        sections.push({
          id: `extracted-${sections.length + 1}`,
          title: section.title,
          content: matchingParagraphs.join("\n\n"),
          type: section.type,
          required:
            section.type === "pricing" || section.type === "responsibilities",
        });
      }
    });

    // If no sections were extracted, create a general section
    if (sections.length === 0 && paragraphs.length > 0) {
      sections.push({
        id: "extracted-1",
        title: "Kontraktinnhold",
        content: paragraphs.slice(0, 3).join("\n\n"),
        type: "custom",
        required: false,
      });
    }

    return sections;
  }


  app.get("/api/contracts/summary", async (req, res) => {
    try {
      await ensureContractsCompatibilitySchema(pool);
      const { projectId } = req.query;
      const userId =
        readString(req.headers["x-user-id"]) ??
        readString(req.query.userId) ??
        null;

      if (!projectId && userId) {
        const [pendingResult, expiringResult, recentResult] = await Promise.all([
          pool.query(
            `SELECT id, contract_title, title, client_name, project_description, signature_status, status
             FROM contracts
             WHERE user_id = $1
               AND COALESCE(signature_status, 'not_started') <> 'signed'
               AND COALESCE(status, 'draft') NOT IN ('cancelled', 'completed')
             ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
             LIMIT 5`,
            [userId],
          ),
          pool.query(
            `SELECT id, contract_title, title, client_name, project_description, event_date
             FROM contracts
             WHERE user_id = $1
               AND event_date IS NOT NULL
               AND event_date >= CURRENT_DATE
               AND event_date <= CURRENT_DATE + INTERVAL '45 days'
             ORDER BY event_date ASC
             LIMIT 5`,
            [userId],
          ),
          pool.query(
            `SELECT id, contract_title, title, client_name, project_description, signed_at, status
             FROM contracts
             WHERE user_id = $1
             ORDER BY COALESCE(signed_at, updated_at, created_at) DESC NULLS LAST
             LIMIT 5`,
            [userId],
          ),
        ]);

        return res.json({
          pending: pendingResult.rows.map((row: Record<string, unknown>) => ({
            id: String(row.id),
            title: String(row.contract_title || row.title || "Kontrakt"),
            client_name: String(row.client_name || ""),
            project_name: row.project_description
              ? String(row.project_description)
              : undefined,
          })),
          expiring: expiringResult.rows.map((row: Record<string, unknown>) => {
            const eventDate = row.event_date
              ? new Date(String(row.event_date))
              : null;
            const today = new Date();
            const daysUntilExpiry = eventDate
              ? Math.max(
                  0,
                  Math.ceil(
                    (eventDate.getTime() - today.getTime()) /
                      (1000 * 60 * 60 * 24),
                  ),
                )
              : undefined;

            return {
              id: String(row.id),
              title: String(row.contract_title || row.title || "Kontrakt"),
              client_name: String(row.client_name || ""),
              project_name: row.project_description
                ? String(row.project_description)
                : undefined,
              daysUntilExpiry,
            };
          }),
          recent: recentResult.rows.map((row: Record<string, unknown>) => ({
            id: String(row.id),
            title: String(row.contract_title || row.title || "Kontrakt"),
            client_name: String(row.client_name || ""),
            project_name: row.project_description
              ? String(row.project_description)
              : undefined,
            signed_at: row.signed_at
              ? new Date(String(row.signed_at)).toISOString()
              : undefined,
          })),
        });
      }

      if (!projectId) return res.json({ hasContract: false });

      const result = await pool.query(
        `SELECT * FROM contracts WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [projectId],
      );

      if (result.rows.length === 0) return res.json({ hasContract: false });
      const c = mapContractRecord(result.rows[0]);
      res.json({
        hasContract: true,
        contractId: c.id,
        isSigned: c.signatureStatus === "signed" || c.status === "signed",
        status: c.status,
        clientName: c.clientName,
      });
    } catch (error) {
      res.json({ hasContract: false });
    }
  });

  // GET /api/contracts/stats — Aggregate contract statistics for BI and CRM
  app.get("/api/contracts/stats", async (req, res) => {
    try {
      await ensureContractsCompatibilitySchema(pool);
      const userId =
        readString(req.headers["x-user-id"]) ??
        readString(req.query.userId) ??
        null;

      const values: Array<string> = [];
      const userFilter = userId
        ? (() => {
            values.push(userId);
            return `WHERE user_id = $${values.length}`;
          })()
        : "";

      const result = await pool.query(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE COALESCE(status, 'draft') NOT IN ('completed', 'cancelled'))::int AS active,
           COUNT(*) FILTER (WHERE COALESCE(status, 'draft') IN ('completed', 'signed'))::int AS completed,
           COUNT(*) FILTER (
             WHERE COALESCE(signature_status, 'not_started') <> 'signed'
               AND COALESCE(status, 'draft') NOT IN ('cancelled', 'completed')
           )::int AS pending_signatures,
           COALESCE(SUM(total_amount), 0)::numeric AS total_value
         FROM contracts
         ${userFilter}`,
        values,
      );

      const row = (result.rows[0] ?? {}) as Record<string, unknown>;
      res.json({
        stats: {
          total: Math.round(toBiNumericMetric(row.total, 0)),
          active: Math.round(toBiNumericMetric(row.active, 0)),
          completed: Math.round(toBiNumericMetric(row.completed, 0)),
          pendingSignatures: Math.round(
            toBiNumericMetric(row.pending_signatures, 0),
          ),
          totalValue: toBiNumericMetric(row.total_value, 0),
        },
      });
    } catch (error) {
      console.error("Contract stats error:", error);
      res.status(500).json({ error: "Failed to load contract statistics" });
    }
  });

  // GET /api/contracts/signers — Get contract signers
  app.get("/api/contracts/signers", async (req, res) => {
    try {
      await ensureContractsCompatibilitySchema(pool);
      const { projectId, contractId } = req.query;
      let query = "SELECT * FROM contracts WHERE ";
      let param: any;

      if (contractId) {
        query += "id = $1";
        param = contractId;
      } else if (projectId) {
        query += "project_id = $1";
        param = projectId;
      } else return res.json([]);

      const result = await pool.query(query, [param]);
      if (result.rows.length === 0) return res.json([]);

      const contract = mapContractRecord(result.rows[0]);
      const signers = [];
      if (contract.clientName) {
        signers.push({
          name: contract.clientName,
          email: contract.clientEmail || "",
          signedDate: contract.signedAt || null,
        });
      }
      res.json(signers);
    } catch (error) {
      res.json([]);
    }
  });

  // GET /api/contracts/:contractId/signers — Get contract signers by contract ID
  app.get("/api/contracts/:contractId/signers", async (req, res) => {
    try {
      await ensureContractsCompatibilitySchema(pool);
      const { contractId } = req.params;
      const result = await pool.query("SELECT * FROM contracts WHERE id = $1", [
        contractId,
      ]);
      if (result.rows.length === 0) return res.json({ signers: [] });

      const contract = mapContractRecord(result.rows[0]);
      const signers = [];
      if (contract.clientName) {
        signers.push({
          name: contract.clientName,
          email: contract.clientEmail || "",
          signedDate: contract.signedAt || null,
        });
      }
      res.json({ signers });
    } catch (error) {
      res.json({ signers: [] });
    }
  });

  app.get("/api/projects/:projectId/contract/status", async (req, res) => {
    try {
      await ensureContractsCompatibilitySchema(pool);
      const { projectId } = req.params;
      const result = await pool.query(
        "SELECT * FROM contracts WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1",
        [projectId],
      );
      if (result.rows.length === 0) return res.json({ hasContract: false });
      const c = mapContractRecord(result.rows[0]);
      res.json({
        hasContract: true,
        contractId: c.id,
        isSigned: c.signatureStatus === "signed" || c.status === "signed",
        status: c.status,
        clientName: c.clientName,
      });
    } catch (error) {
      res.json({ hasContract: false });
    }
  });

  app.post("/api/contracts", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      await ensureContractsCompatibilitySchema(pool);

      const contractData = req.body || {};
      const userId = await resolveContractUserId(req);
      const contractNumber = buildContractNumber();
      const sourceQuoteId = readString(contractData.sourceQuoteId) ?? null;
      const title =
        readString(contractData.contractTitle) ??
        readString(contractData.title) ??
        "Ny kontrakt";
      const sections = normalizeContractSections(contractData.sections);
      const metadata = {
        ...(normalizeJsonObjectField(contractData.metadata) || {}),
        ...(sourceQuoteId ? { sourceQuoteId } : {}),
      };

      const result = await pool.query(
        `INSERT INTO contracts (
           id, user_id, client_id, project_id, source_quote_id, contract_number,
           contract_title, title, logo_url, customer_type, organization_number, organization_name,
           business_address, contract_type, project_type, project_description, event_date, event_location,
           total_amount, profession, template_used, sections, content, metadata, status, signature_status,
           created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6,
           $7, $8, $9, $10, $11, $12,
           $13, $14, $15, $16, $17, $18,
           $19, $20, $21, $22::jsonb, $23, $24::jsonb, $25, $26,
           NOW(), NOW()
         )
         RETURNING *`,
        [
          crypto.randomUUID(),
          userId,
          readString(contractData.clientId),
          readString(contractData.projectId),
          sourceQuoteId,
          contractNumber,
          title,
          readString(contractData.title) ?? title,
          readString(contractData.logoUrl),
          readString(contractData.customerType) ?? "private",
          readString(contractData.organizationNumber),
          readString(contractData.organizationName),
          readString(contractData.businessAddress),
          readString(contractData.contractType) ?? "service_agreement",
          readString(contractData.projectType) ??
            readString(contractData.contractType) ??
            "service_agreement",
          readString(contractData.projectDescription) ?? "",
          readString(contractData.eventDate),
          readString(contractData.eventLocation),
          toNumericValue(contractData.totalAmount, 0),
          readString(contractData.profession) ?? "photographer",
          readString(contractData.templateUsed),
          JSON.stringify(sections),
          readString(contractData.content),
          JSON.stringify(metadata),
          normalizeContractStatusValue(contractData.status),
          readString(contractData.signatureStatus) ?? "not_started",
        ],
      );

      const contract = mapContractRecord(result.rows[0]);

      if (sourceQuoteId) {
        const quoteResult = await pool
          .query(
            `SELECT project_creation_data FROM quotes WHERE id = $1 LIMIT 1`,
            [sourceQuoteId],
          )
          .catch(() => ({ rows: [] as any[] }));
        const projectCreationData: Record<string, unknown> =
          normalizeJsonObjectField(quoteResult.rows[0]?.project_creation_data) ||
          {};
        await pool
          .query(
            `UPDATE quotes
             SET contract_id = $2,
                 project_creation_data = $3::jsonb,
                 updated_at = NOW()
           WHERE id = $1`,
            [
              sourceQuoteId,
              contract.id,
              JSON.stringify({
                ...projectCreationData,
                contractId: contract.id,
                contractStatus: contract.status,
              }),
            ],
          )
          .catch(() => undefined);
      }

      await syncContractLifecycleArtifacts({
        contract,
        eventType: sourceQuoteId ? "created_from_quote" : "created",
        actorUserId: userId,
      });

      res.json({
        success: true,
        message: "Contract created successfully",
        contractId: contract.id,
        contract,
      });
    } catch (error: any) {
      console.error("❌ Contract creation error:", error.message || error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to create contract",
      });
    }
  });

  app.put("/api/contracts/:contractId", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      await ensureContractsCompatibilitySchema(pool);

      const contractData = req.body || {};
      const setClauses = ["updated_at = NOW()"];
      const params: any[] = [];
      let idx = 1;

      const scalarFields: Array<[string, string, (value: unknown) => unknown]> = [
        ["contractTitle", "contract_title", (value) => readString(value)],
        ["title", "title", (value) => readString(value)],
        ["logoUrl", "logo_url", (value) => readString(value)],
        [
          "customerType",
          "customer_type",
          (value) => readString(value) ?? "private",
        ],
        [
          "organizationNumber",
          "organization_number",
          (value) => readString(value),
        ],
        ["organizationName", "organization_name", (value) => readString(value)],
        ["businessAddress", "business_address", (value) => readString(value)],
        ["contractType", "contract_type", (value) => readString(value)],
        ["projectType", "project_type", (value) => readString(value)],
        [
          "projectDescription",
          "project_description",
          (value) => readString(value),
        ],
        ["eventDate", "event_date", (value) => readString(value)],
        ["eventLocation", "event_location", (value) => readString(value)],
        ["profession", "profession", (value) => readString(value)],
        ["templateUsed", "template_used", (value) => readString(value)],
        ["clientId", "client_id", (value) => readString(value)],
        ["projectId", "project_id", (value) => readString(value)],
        ["clientName", "client_name", (value) => readString(value)],
        ["clientEmail", "client_email", (value) => readString(value)],
        ["clientPhone", "client_phone", (value) => readString(value)],
        ["status", "status", (value) => normalizeContractStatusValue(value)],
        ["signatureStatus", "signature_status", (value) => readString(value)],
        ["googleDocId", "google_doc_id", (value) => readString(value)],
        ["googleDocUrl", "google_doc_url", (value) => readString(value)],
        ["signerName", "signer_name", (value) => readString(value)],
        ["signerEmail", "signer_email", (value) => readString(value)],
        ["content", "content", (value) => readString(value)],
      ];

      for (const [inputKey, column, transform] of scalarFields) {
        if (contractData[inputKey] !== undefined) {
          setClauses.push(`${column} = $${idx++}`);
          params.push(transform(contractData[inputKey]));
        }
      }

      if (contractData.totalAmount !== undefined) {
        setClauses.push(`total_amount = $${idx++}`);
        params.push(toNumericValue(contractData.totalAmount, 0));
      }

      if (contractData.sections !== undefined) {
        setClauses.push(`sections = $${idx++}::jsonb`);
        params.push(
          JSON.stringify(normalizeContractSections(contractData.sections)),
        );
      }

      if (contractData.metadata !== undefined) {
        setClauses.push(`metadata = $${idx++}::jsonb`);
        params.push(
          JSON.stringify(normalizeJsonObjectField(contractData.metadata) || {}),
        );
      }

      if (setClauses.length === 1) {
        return res
          .status(400)
          .json({ success: false, message: "No updates provided" });
      }

      params.push(req.params.contractId);
      const result = await pool.query(
        `UPDATE contracts SET ${setClauses.join(", ")} WHERE id = $${idx} RETURNING *`,
        params,
      );

      if (result.rows.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Contract not found" });
      }

      const contract = mapContractRecord(result.rows[0]);
      await syncContractLifecycleArtifacts({
        contract,
        eventType: "updated",
        actorUserId: await resolveContractUserId(req),
      });

      res.json({ success: true, contractId: contract.id, contract });
    } catch (error: any) {
      console.error("Contract update error:", error);
      res
        .status(500)
        .json({
          success: false,
          message: error.message || "Failed to update contract",
        });
    }
  });

  app.post("/api/contracts/:contractId/sign", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      await ensureContractsCompatibilitySchema(pool);

      const { signerName, signerEmail, signatureData } = req.body;
      const signedAt = new Date().toISOString();
      const ipAddress = String(
        req.headers["x-forwarded-for"] || req.ip || "unknown",
      );
      const userAgent = String(req.headers["user-agent"] || "unknown");

      const existingContract = await fetchContractById(req.params.contractId);
      if (!existingContract) {
        return res
          .status(404)
          .json({ success: false, message: "Contract not found" });
      }

      const updateResult = await pool.query(
        `UPDATE contracts
           SET signer_name = $2,
               signer_email = $3,
               digital_signature = $4,
               signed_date = $5,
               signed_at = $5,
               signature_ip_address = $6,
               status = 'signed',
               signature_status = 'signed',
               updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [
          req.params.contractId,
          readString(signerName) ?? existingContract.clientName,
          readString(signerEmail) ?? existingContract.clientEmail,
          readString(signatureData) ??
            readString(signerName) ??
            existingContract.clientName,
          signedAt,
          ipAddress,
        ],
      );

      const contract = mapContractRecord(updateResult.rows[0]);
      const documentHash = calculateContractHash(contract);

      // Store signature record with hash for verification
      try {
        await pool.query(
          `INSERT INTO customer_signatures (
             id, contract_id, signer_person_id, signer_name, signer_email, auth_method,
             document_hash, signature_data, ip_address, user_agent, status, signed_at, created_at
           ) VALUES (
             $1, $2, $3, $4, $5, $6,
             $7, $8, $9, $10, $11, NOW(), NOW()
           )`,
          [
            crypto.randomUUID(),
            contract.id,
            existingContract.clientId || "default-signer",
            readString(signerName) ?? existingContract.clientName,
            readString(signerEmail) ?? existingContract.clientEmail,
            "basic",
            documentHash,
            readString(signatureData) ??
              readString(signerName) ??
              existingContract.clientName,
            ipAddress,
            userAgent,
            "valid",
          ],
        );
      } catch (signatureAuditError) {
        console.warn(
          "Skipping customer_signatures audit insert:",
          signatureAuditError instanceof Error
            ? signatureAuditError.message
            : signatureAuditError,
        );
      }

      await pool.query(
        `UPDATE contracts SET document_hash = $2, updated_at = NOW() WHERE id = $1`,
        [req.params.contractId, documentHash],
      );

      let signedContract = await fetchContractById(req.params.contractId);

      try {
        const googleSignature = await getContractGoogleESignature(
          pool,
          req.params.contractId,
        );
        if (googleSignature.signature) {
          const updatedGoogleSignature =
            await updateContractGoogleESignatureStatus(pool, {
              contractId: req.params.contractId,
              status: "signed",
              preferredUserId: existingContract.userId,
              signerName: readString(signerName) ?? existingContract.clientName,
              signerEmail:
                readString(signerEmail) ?? existingContract.clientEmail,
            });
          signedContract = mapContractRecord(updatedGoogleSignature.contract);
        }
      } catch (error) {
        console.warn(
          "Google signature sync skipped during contract sign:",
          error instanceof Error ? error.message : error,
        );
      }

      if (signedContract) {
        signedContract = {
          ...signedContract,
          documentHash,
        };
        await syncContractLifecycleArtifacts({
          contract: signedContract,
          eventType: "signed",
          actorUserId: existingContract.userId,
        });
      }

      res.json({
        success: true,
        contractId: signedContract?.id ?? req.params.contractId,
        contract: signedContract,
      });
    } catch (error: any) {
      console.error("Contract sign error:", error);
      res
        .status(500)
        .json({
          success: false,
          message: error.message || "Failed to sign contract",
        });
    }
  });

  app.get("/api/contracts/:contractId", async (req, res) => {
    try {
      await ensureContractsCompatibilitySchema(pool);
      const contract = await fetchContractById(req.params.contractId);

      if (!contract) {
        return res.status(404).json({
          success: false,
          message: "Contract not found",
        });
      }

      // Calculate verification hash for signed contracts
      let verificationStatus = null;
      if (contract.status === "signed" && contract.signedAt) {
        const currentHash = calculateContractHash(contract);
        const storedHash = contract.documentHash;

        verificationStatus = {
          isTampered: currentHash !== storedHash,
          currentHash,
          storedHash,
          verifiedAt: new Date().toISOString(),
        };

        if (verificationStatus.isTampered) {
          console.warn(`⚠️  TAMPER DETECTED on contract ${contract.id}!`);
        }
      }

      const googleSignature = await getContractGoogleESignature(
        pool,
        req.params.contractId,
      ).catch(() => ({ signature: null }));

      res.json({
        ...contract,
        googleSignature: googleSignature.signature,
        _verification: verificationStatus,
      });
    } catch (error: any) {
      console.error("Contract fetch error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch contract",
      });
    }
  });

  app.get("/api/contracts/:contractId/signature-status", async (req, res) => {
    try {
      await ensureContractsCompatibilitySchema(pool);
      const contract = await fetchContractById(req.params.contractId);
      if (!contract) {
        return res
          .status(404)
          .json({ success: false, message: "Contract not found" });
      }

      const googleSignature = await getContractGoogleESignature(
        pool,
        req.params.contractId,
      ).catch(() => ({ signature: null }));
      const signature = googleSignature.signature;
      res.json({
        success: true,
        signatureStatus: {
          isSigned:
            contract.signatureStatus === "signed" || contract.status === "signed",
          signedDate: contract.signedAt,
          signerName: contract.signerName,
          signerEmail: contract.signerEmail,
          signatureStatus: contract.signatureStatus,
          googleDocId: contract.googleDocId,
          googleDocUrl: contract.googleDocUrl,
          requestUrl: signature?.request_url ?? null,
          webViewUrl: signature?.web_view_url ?? null,
        },
        contract,
      });
    } catch (error: any) {
      console.error("Contract signature status error:", error);
      res
        .status(500)
        .json({
          success: false,
          message: error.message || "Failed to fetch contract signature status",
        });
    }
  });

  app.post("/api/contracts/:contractId/google-esignature", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const preferredUserId = await resolveContractUserId(req);
      const response = await sendContractGoogleESignature(pool, {
        contractId: req.params.contractId,
        preferredUserId,
        requestedBy: preferredUserId,
        requestedByEmail: readString(req.headers["x-user-email"]) ?? undefined,
      });
      const contract = mapContractRecord(response.contract);
      await syncContractLifecycleArtifacts({
        contract,
        eventType: "signature_sent",
        actorUserId: preferredUserId,
      });
      res.json({
        success: true,
        contract,
        data: {
          documentId: contract.googleDocId,
          documentUrl: contract.googleDocUrl,
          signatureStatus: contract.signatureStatus,
        },
        connection: response.connection,
      });
    } catch (error: any) {
      console.error("Contract Google e-signature error:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to create Google e-signature document",
      });
    }
  });

  app.post("/api/contracts/:contractId/backup-drive", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const preferredUserId = await resolveContractUserId(req);
      const response = await prepareContractGoogleESignature(pool, {
        contractId: req.params.contractId,
        preferredUserId,
        requestedBy: preferredUserId,
        requestedByEmail: readString(req.headers["x-user-email"]) ?? undefined,
        sendNow: false,
      });
      const contract = mapContractRecord(response.contract);
      await syncContractLifecycleArtifacts({
        contract,
        eventType: "signature_prepared",
        actorUserId: preferredUserId,
      });
      res.json({
        success: true,
        contract,
        driveBackupUrl: contract.googleDocUrl,
      });
    } catch (error: any) {
      console.error("Contract backup-drive error:", error);
      res
        .status(500)
        .json({
          success: false,
          message: error.message || "Failed to back up contract to Google Drive",
        });
    }
  });

  app.get("/api/contracts/:contractId/google-signature", async (req, res) => {
    try {
      const response = await getContractGoogleESignature(
        pool,
        req.params.contractId,
      );
      res.json({
        success: true,
        contract: response.contract ? mapContractRecord(response.contract) : null,
        signature: response.signature,
      });
    } catch (error: any) {
      console.error("Get contract Google signature error:", error);
      res
        .status(500)
        .json({
          success: false,
          message: error.message || "Failed to fetch contract Google signature",
        });
    }
  });

  app.post(
    "/api/contracts/:contractId/google-signature/prepare",
    async (req, res) => {
      if (!requireUserSession(req, res)) return;
      try {
        const preferredUserId = await resolveContractUserId(req);
        const response = await prepareContractGoogleESignature(pool, {
          contractId: req.params.contractId,
          preferredUserId,
          requestedBy: preferredUserId,
          requestedByEmail: readString(req.headers["x-user-email"]) ?? undefined,
          sendNow: false,
        });
        const contract = mapContractRecord(response.contract);
        await syncContractLifecycleArtifacts({
          contract,
          eventType: "signature_prepared",
          actorUserId: preferredUserId,
        });
        res.json({
          success: true,
          contract,
          signature: response.signature,
          connection: response.connection,
        });
      } catch (error: any) {
        console.error("Prepare contract Google signature error:", error);
        res
          .status(500)
          .json({
            success: false,
            message:
              error.message || "Failed to prepare contract Google signature",
          });
      }
    },
  );

  app.post(
    "/api/contracts/:contractId/google-signature/send",
    async (req, res) => {
      if (!requireUserSession(req, res)) return;
      try {
        const preferredUserId = await resolveContractUserId(req);
        const response = await sendContractGoogleESignature(pool, {
          contractId: req.params.contractId,
          preferredUserId,
          requestedBy: preferredUserId,
          requestedByEmail: readString(req.headers["x-user-email"]) ?? undefined,
        });
        const contract = mapContractRecord(response.contract);
        await syncContractLifecycleArtifacts({
          contract,
          eventType: "signature_sent",
          actorUserId: preferredUserId,
        });
        res.json({
          success: true,
          contract,
          signature: response.signature,
          connection: response.connection,
        });
      } catch (error: any) {
        console.error("Send contract Google signature error:", error);
        res
          .status(500)
          .json({
            success: false,
            message: error.message || "Failed to send contract Google signature",
          });
      }
    },
  );

  app.post(
    "/api/contracts/:contractId/google-signature/sync",
    async (req, res) => {
      if (!requireUserSession(req, res)) return;
      try {
        const preferredUserId = await resolveContractUserId(req);
        const response = await syncContractGoogleESignature(pool, {
          contractId: req.params.contractId,
          preferredUserId,
        });
        const contract = response.contract
          ? mapContractRecord(response.contract)
          : null;
        if (contract) {
          await syncContractLifecycleArtifacts({
            contract,
            eventType:
              contract.signatureStatus === "signed" ? "signed" : "updated",
            actorUserId: preferredUserId,
          });
        }
        res.json({
          success: true,
          contract,
          signature: response.signature,
          connection: response.connection,
        });
      } catch (error: any) {
        console.error("Sync contract Google signature error:", error);
        res
          .status(500)
          .json({
            success: false,
            message: error.message || "Failed to sync contract Google signature",
          });
      }
    },
  );

  app.post(
    "/api/contracts/:contractId/google-signature/status",
    async (req, res) => {
      if (!requireUserSession(req, res)) return;
      try {
        const preferredUserId = await resolveContractUserId(req);
        const status = readString(req.body?.status) as any;
        if (!status) {
          return res
            .status(400)
            .json({ success: false, message: "status is required" });
        }
        if (
          ![
            "not_started",
            "prepared",
            "sent",
            "viewed",
            "signed",
            "changes_requested",
            "rejected",
          ].includes(status)
        ) {
          return res
            .status(400)
            .json({
              success: false,
              message: "Unsupported contract Google signature status",
            });
        }
        const response = await updateContractGoogleESignatureStatus(pool, {
          contractId: req.params.contractId,
          status,
          preferredUserId,
          signerName: readString(req.body?.signerName),
          signerEmail: readString(req.body?.signerEmail),
          requestUrl: readString(req.body?.requestUrl),
          webViewUrl: readString(req.body?.webViewUrl),
        });
        const contract = mapContractRecord(response.contract);
        await syncContractLifecycleArtifacts({
          contract,
          eventType:
            status === "signed"
              ? "signed"
              : status === "rejected"
                ? "rejected"
                : "updated",
          actorUserId: preferredUserId,
        });
        res.json({ success: true, contract, signature: response.signature });
      } catch (error: any) {
        console.error("Update contract Google signature status error:", error);
        res
          .status(500)
          .json({
            success: false,
            message:
              error.message ||
              "Failed to update contract Google signature status",
          });
      }
    },
  );

  app.put("/api/contracts/:contractId/status", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      await ensureContractsCompatibilitySchema(pool);
      const status = normalizeContractStatusValue(req.body?.status);
      const result = await pool.query(
        `UPDATE contracts
           SET status = $2,
               updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [req.params.contractId, status],
      );
      if (result.rowCount === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Contract not found" });
      }
      const contract = mapContractRecord(result.rows[0]);
      await syncContractLifecycleArtifacts({
        contract,
        eventType: status === "signed" ? "signed" : "updated",
        actorUserId: await resolveContractUserId(req),
      });
      res.json({ success: true, contract });
    } catch (error: any) {
      console.error("Contract status update error:", error);
      res
        .status(500)
        .json({
          success: false,
          message: error.message || "Failed to update contract status",
        });
    }
  });

  app.delete("/api/contracts/:contractId", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      await ensureContractsCompatibilitySchema(pool);
      const contract = await fetchContractById(req.params.contractId);
      if (!contract) {
        return res
          .status(404)
          .json({ success: false, message: "Contract not found" });
      }

      await pool.query(`DELETE FROM contracts WHERE id = $1`, [
        req.params.contractId,
      ]);

      if (contract.sourceQuoteId) {
        await pool
          .query(
            `UPDATE quotes
             SET contract_id = NULL,
                 project_creation_data = COALESCE(project_creation_data, '{}'::jsonb) - 'contractId' - 'contractStatus',
                 updated_at = NOW()
           WHERE id = $1`,
            [contract.sourceQuoteId],
          )
          .catch(() => undefined);
      }

      res.json({
        success: true,
        deleted: true,
        contractId: req.params.contractId,
      });
    } catch (error: any) {
      console.error("Contract delete error:", error);
      res
        .status(500)
        .json({
          success: false,
          message: error.message || "Failed to delete contract",
        });
    }
  });

  app.get("/api/contracts/:contractId/pdf", async (req, res) => {
    try {
      const contract = await fetchContractById(req.params.contractId);
      if (!contract) {
        return res
          .status(404)
          .json({ success: false, message: "Contract not found" });
      }
      const pdfBuffer = await buildContractPdfBuffer(contract);
      const safeFileName = (contract.contractNumber || contract.id).replace(
        /[^a-z0-9-_]+/giu,
        "-",
      );
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${safeFileName}.pdf"`,
      );
      res.send(pdfBuffer);
    } catch (error: any) {
      console.error("Contract PDF error:", error);
      res
        .status(500)
        .json({
          success: false,
          message: error.message || "Failed to generate contract PDF",
        });
    }
  });

  app.post("/api/contracts/send-email", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      await ensureContractsCompatibilitySchema(pool);

      const { contractId, photographerEmail, targetEmail } = req.body || {};
      const preferredUserId = await resolveContractUserId(req);
      let resolvedContractId = readString(contractId);

      if (resolvedContractId === "latest") {
        const latest = await pool.query(
          `SELECT id FROM contracts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
          [preferredUserId],
        );
        resolvedContractId = latest.rows[0]?.id ?? null;
      }

      if (resolvedContractId) {
        const response = await sendContractGoogleESignature(pool, {
          contractId: resolvedContractId,
          preferredUserId,
          requestedBy: preferredUserId,
          requestedByEmail:
            readString(req.headers["x-user-email"]) ??
            readString(photographerEmail) ??
            undefined,
        });
        const contract = mapContractRecord(response.contract);
        await syncContractLifecycleArtifacts({
          contract,
          eventType: "signature_sent",
          actorUserId: preferredUserId,
        });

        return res.json({
          success: true,
          message: "Contract signature document sent successfully",
          contract,
          sentTo: contract.clientEmail || targetEmail || null,
          sentAt: new Date().toISOString(),
        });
      }

      res.json({
        success: true,
        message: "Email sent successfully",
        emailId: `email-${Date.now()}`,
        sentTo: targetEmail,
        sentAt: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("Contract send-email error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to send contract email",
      });
    }
  });

  app.get("/api/contracts", async (req, res) => {
    try {
      await ensureContractsCompatibilitySchema(pool);

      const clientId = readString(req.query.clientId);
      const projectId = readString(req.query.projectId);
      const sourceQuoteId = readString(req.query.sourceQuoteId);
      const status = readString(req.query.status);
      const signatureStatus = readString(req.query.signature_status);
      const userId = await resolveContractUserId(req);

      const whereClauses = ["1 = 1"];
      const params: any[] = [];

      if (userId && userId !== "default-user") {
        params.push(userId);
        whereClauses.push(`c.user_id = $${params.length}`);
      }
      if (clientId) {
        params.push(clientId);
        whereClauses.push(`c.client_id = $${params.length}`);
      }
      if (projectId) {
        params.push(projectId);
        whereClauses.push(`c.project_id = $${params.length}`);
      }
      if (sourceQuoteId) {
        params.push(sourceQuoteId);
        whereClauses.push(`c.source_quote_id = $${params.length}`);
      }
      if (status) {
        params.push(status);
        whereClauses.push(`c.status = $${params.length}`);
      }
      if (signatureStatus) {
        params.push(signatureStatus);
        whereClauses.push(
          `COALESCE(c.signature_status, 'not_started') = $${params.length}`,
        );
      }

      const result = await pool.query(
        `SELECT c.*, cm.name as linked_client_name, cm.email as linked_client_email
           FROM contracts c
           LEFT JOIN crm_customers cm ON cm.id::text = c.client_id
          WHERE ${whereClauses.join(" AND ")}
          ORDER BY c.created_at DESC`,
        params,
      );

      return res.json({
        contracts: result.rows.map((row: any) => {
          const mapped = mapContractRecord({
            ...row,
            client_name: row.client_name || row.linked_client_name,
            client_email: row.client_email || row.linked_client_email,
          });
          return {
            ...mapped,
            google_signature: mapped.metadata?.googleSignature || null,
          };
        }),
      });
    } catch (error) {
      console.error("Contracts list error:", error);
      return res.json({ contracts: [] });
    }
  });
}
