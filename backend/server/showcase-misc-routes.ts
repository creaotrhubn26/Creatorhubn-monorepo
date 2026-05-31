/**
 * showcase-misc-routes.ts
 *
 * Setup-funksjon for resterende /api/showcase/*-endpoints som ikke
 * passer i de mer fokuserte sub-modulene (templates, collections,
 * items, categories, comments, analytics, pricing, smart-albums,
 * batch-operations, google-photos, client). Bundlet i én fil for å
 * fullføre showcase-clusteret før image-ops-uthenting.
 *
 * 9 endpoints:
 *   - POST /sets                              (legacy showcase-set create)
 *   - POST /email                             (placeholder/log for delings-email)
 *   - GET  /enhancement-presets               (statiske preset-konfigurasjoner)
 *   - GET  /showcases                         (admin-side liste av items per profession)
 *   - PUT  /settings                          (UPSERT showcase-innstillinger,
 *                                              50+ felt: watermark, preview, etc.)
 *   - GET  /portfolios                        (collections som portfolio-ramme)
 *   - POST /link-project                      (kobler showcase til prosjekt-kontekst
 *                                              i compat-store)
 *   - POST /                                  (bar create — proxy til
 *                                              createShowcaseItemRecord)
 *   - POST /calculate-selection-price         (utleder pris fra valgt antall
 *                                              + showcase-prising)
 *
 * Auth: åpen — userId fra query/header/payload, ingen session-validering.
 *
 * Wire opp i backend/server/index.ts ved å legge til:
 *
 *   import { setupShowcaseMiscRoutes } from "./showcase-misc-routes";
 *
 *   setupShowcaseMiscRoutes({
 *     app, pool, db,
 *     mapShowcaseItemRow, createShowcaseItemRecord,
 *     resolveShowcasePricing, compatStoreSet, dbCompatUserKvKey,
 *   });
 *
 * Mode-noter: ingen mode-branching.
 */

import type express from "express";
import type { Pool } from "pg";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import crypto from "crypto";
import { and, eq, sql } from "drizzle-orm";

import * as schema from "../migrations/schema.js";
import {
  readBoolean,
  readNumber,
  readOptionalIsoDate,
  readString,
  readStringArray,
  normalizeJsonObjectField,
} from "./_shared";
import { sendTransactionalEmail } from "./transactional-email-service";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function resolvePublicAppUrl(): string {
  const raw =
    process.env.PUBLIC_APP_URL ||
    process.env.APP_BASE_URL ||
    "https://creatorhubn.com";
  return raw.replace(/\/+$/, "");
}

type Db = NodePgDatabase<typeof schema>;

interface ShowcasePricingShape {
  contractedBase: number;
  perImage: number;
  [key: string]: unknown;
}

const SHOWCASE_ENHANCEMENT_PRESETS: Record<
  string,
  { description: string; options: Record<string, unknown> }
> = {
  portrait: {
    description:
      "Mykere hudtoner, balansert kontrast og lett skarphet for portretter.",
    options: {
      brightness: 4,
      contrast: 1.05,
      saturation: 6,
      sharpening: 1.1,
      noiseReduction: true,
      autoTone: true,
    },
  },
  wedding: {
    description: "Varmere hvitbalanse og mer glod for bryllupsbilder.",
    options: {
      brightness: 6,
      contrast: 1.08,
      saturation: 8,
      sharpening: 1.05,
      noiseReduction: true,
      autoTone: true,
    },
  },
  landscape: {
    description: "Mer dybde, klarhet og farger for landskap og miljo.",
    options: {
      brightness: 2,
      contrast: 1.1,
      saturation: 10,
      sharpening: 1.2,
      noiseReduction: false,
      autoTone: true,
    },
  },
  product: {
    description: "Skarpere detaljer og renere bakgrunn for produktbilder.",
    options: {
      brightness: 0,
      contrast: 1.15,
      saturation: 4,
      sharpening: 1.25,
      noiseReduction: true,
      autoTone: false,
    },
  },
  events: {
    description: "Klar belysning og naturlige farger for arrangementsbilder.",
    options: {
      brightness: 5,
      contrast: 1.07,
      saturation: 7,
      sharpening: 1.1,
      noiseReduction: true,
      autoTone: true,
    },
  },
};

export interface ShowcaseMiscRoutesDeps {
  app: express.Application;
  pool: Pool;
  db: Db;
  requireUserSession: (req: any, res: any) => any;
  mapShowcaseItemRow: (row: Record<string, unknown>) => Record<string, unknown>;
  createShowcaseItemRecord: (
    payload: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
  resolveShowcasePricing: (
    profession: string,
    userId?: string | null,
  ) => Promise<ShowcasePricingShape>;
  compatStoreSet: (storeKey: string, value: unknown) => Promise<void>;
  dbCompatUserKvKey: (userId: string, key: string) => string;
}

export function setupShowcaseMiscRoutes(deps: ShowcaseMiscRoutesDeps): void {
  const {
    app,
    pool,
    db,
    requireUserSession,
    mapShowcaseItemRow,
    createShowcaseItemRecord,
    resolveShowcasePricing,
    compatStoreSet,
    dbCompatUserKvKey,
  } = deps;

  // POST /api/showcase/sets — Create showcase set
  app.post("/api/showcase/sets", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const { name, description, categoryId, items, userId } = req.body;
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      // Use universal_showcase_sets if available, fallback to simple response
      try {
        await pool.query(
          `INSERT INTO universal_showcase_sets (id, name, description, category_id, items, created_by, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7::timestamp, $8::timestamp)`,
          [
            id,
            name,
            description || "",
            categoryId || null,
            JSON.stringify(items || []),
            userId,
            now,
            now,
          ],
        );
      } catch {
        // Table may not exist, just return success
      }
      res
        .status(201)
        .json({ id, name, description, categoryId, items: items || [] });
    } catch (error) {
      console.error("Error creating showcase set:", error);
      res.status(500).json({ error: "Kunne ikke opprette sett" });
    }
  });

  // POST /api/showcase/email — Share showcase med klient via lenke + e-post.
  // Oppretter en photographer_client_galleries-rad (med fersk accessToken),
  // speiler tilhørende showcase_items inn i client_gallery_images, og sender
  // en transaksjonell e-post med public-lenken. Lenken løses i frontend av
  // /client/gallery/:accessToken — som allerede er bygget på samme tabell.
  app.post("/api/showcase/email", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;

    const payload = (req.body ?? {}) as Record<string, unknown>;
    const showcaseId = readString(payload.showcaseId);
    const clientEmail = readString(payload.clientEmail);
    const clientName = readString(payload.clientName);
    const message = readString(payload.message) ?? "";
    const photographerName =
      readString(payload.photographerName) ?? session.name ?? "Creatorhubn";
    const photographerCompany = readString(payload.photographerCompany) ?? "";
    const projectStateRaw = readString(payload.projectState) ?? "in_review";
    const projectState =
      projectStateRaw === "delivered" ? "delivered" : "in_review";
    const explicitProjectId = readString(payload.projectId);

    if (!clientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
      return res.status(400).json({ error: "ugyldig_klient_epost" });
    }
    if (!clientName) {
      return res.status(400).json({ error: "manglende_klientnavn" });
    }
    if (!showcaseId) {
      return res.status(400).json({ error: "manglende_showcase_id" });
    }

    try {
      // Slå opp seed-itemet for å hente projectId/userId/profession.
      const seedRes = await pool.query(
        `SELECT id, user_id, project_id, title, profession
           FROM showcase_items
          WHERE id = $1
          LIMIT 1`,
        [showcaseId],
      );
      const seed = seedRes.rows[0];
      if (!seed) {
        return res.status(404).json({ error: "showcase_ikke_funnet" });
      }
      if (seed.user_id !== session.userId) {
        return res.status(403).json({ error: "ikke_eier_av_showcase" });
      }

      const projectId = explicitProjectId ?? seed.project_id ?? null;

      // Samle alle items som hører til samme gallery: enten samme projectId
      // hvis seed har en, ellers fall tilbake til samme bruker (legacy
      // ungrupperte items). Bare aktive items.
      const itemsRes = projectId
        ? await pool.query(
            `SELECT id, title, description, media_type, media_url, thumbnail_url, sort_order
               FROM showcase_items
              WHERE user_id = $1 AND project_id = $2
              ORDER BY COALESCE(sort_order, 0) ASC, created_at ASC`,
            [session.userId, projectId],
          )
        : await pool.query(
            `SELECT id, title, description, media_type, media_url, thumbnail_url, sort_order
               FROM showcase_items
              WHERE id = $1`,
            [showcaseId],
          );
      const items = itemsRes.rows;
      if (items.length === 0) {
        return res.status(404).json({ error: "ingen_items_i_showcase" });
      }

      // Public-lenken: 24-byte hex = 48 tegn, ikke gjettbart.
      const accessToken = crypto.randomBytes(24).toString("hex");
      const projectTitle =
        readString(payload.projectTitle) ??
        (typeof seed.title === "string" && seed.title.trim()
          ? seed.title.trim()
          : "Showcase");

      // gallery_settings rommer alt en showcase trenger som ikke fins
      // som dedikerte kolonner: showcase-kontekst, state-gating,
      // download/watermark-policy, melding fra fotograf, og 30-dagers
      // utløp. Landing-API (client-gallery-routes.ts:115) leser disse
      // for å vise password-prompt / expired-state riktig.
      const expiresAt = new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000,
      ).toISOString();
      const gallerySettings: Record<string, unknown> = {
        source: "showcase",
        showcaseId,
        projectId,
        projectState,
        message,
        photographerName,
        photographerCompany,
        allowDownloads: projectState === "delivered",
        watermarkEnabled: projectState !== "delivered",
        allowComments: projectState !== "delivered",
        expiresAt,
        createdVia: "showcase-share",
      };

      const galleryId = crypto.randomUUID();
      await pool.query(
        `INSERT INTO photographer_client_galleries
           (id, photographer_id, client_name, client_email, project_title,
            access_token, gallery_settings, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'active', NOW(), NOW())`,
        [
          galleryId,
          session.userId,
          clientName,
          clientEmail,
          projectTitle,
          accessToken,
          JSON.stringify(gallerySettings),
        ],
      );

      // Speil items inn i client_gallery_images. fullSizeUrl er påkrevd
      // (NOT NULL), så vi bruker media_url for begge når thumbnail mangler.
      // imageMetadata bærer showcaseItemId så vi kan korrelere tilbake til
      // showcase-systemet for analytics/comments senere.
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const fullUrl =
          typeof item.media_url === "string" && item.media_url.trim()
            ? item.media_url
            : "";
        if (!fullUrl) continue;
        const thumb =
          typeof item.thumbnail_url === "string" && item.thumbnail_url.trim()
            ? item.thumbnail_url
            : fullUrl;
        await pool.query(
          `INSERT INTO client_gallery_images
             (id, gallery_id, photographer_id, image_title, image_description,
              thumbnail_url, full_size_url, image_metadata, sort_order,
              is_visible, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7::jsonb, $8,
                   true, NOW(), NOW())`,
          [
            galleryId,
            session.userId,
            (item.title as string) ?? "Bilde",
            (item.description as string) ?? null,
            thumb,
            fullUrl,
            JSON.stringify({
              showcaseItemId: item.id,
              mediaType: item.media_type ?? null,
              source: "showcase",
            }),
            typeof item.sort_order === "number" ? item.sort_order : i,
          ],
        );
      }

      const baseUrl = resolvePublicAppUrl();
      const shareUrl = `${baseUrl}/client/gallery/${accessToken}`;

      const greetingLine = `Hei ${escapeHtml(clientName)},`;
      const senderLabel = photographerCompany
        ? `${photographerName} (${photographerCompany})`
        : photographerName;
      const messageBlock = message.trim()
        ? `<p style="font-size:15px;line-height:1.6;color:#333;margin:0 0 18px;">${escapeHtml(message.trim()).replace(/\n/g, "<br/>")}</p>`
        : "";
      const stateLine =
        projectState === "delivered"
          ? "Bildene er klare for nedlasting."
          : "Se gjennom utvalget — du kan kommentere og velge favoritter.";

      const html = `
        <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#fafafa;">
          <h2 style="color:#1a1a1a;margin:0 0 12px;font-size:22px;">${escapeHtml(projectTitle)}</h2>
          <p style="font-size:15px;line-height:1.6;color:#333;margin:0 0 18px;">${greetingLine}</p>
          ${messageBlock}
          <p style="font-size:15px;line-height:1.6;color:#333;margin:0 0 18px;">
            ${escapeHtml(senderLabel)} har delt et showcase med deg.
            ${escapeHtml(stateLine)}
          </p>
          <p style="margin:24px 0;">
            <a href="${shareUrl}" style="display:inline-block;background:#ff8c00;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">
              Åpne showcase
            </a>
          </p>
          <p style="font-size:13px;line-height:1.5;color:#888;margin:0 0 6px;">
            Eller kopier lenken: <br/>
            <span style="word-break:break-all;color:#555;">${shareUrl}</span>
          </p>
          <p style="font-size:12px;color:#aaa;margin:24px 0 0;">
            Lenken er gyldig i 30 dager. Du trenger ikke konto for å åpne den.
          </p>
        </div>
      `;

      const text =
        `${greetingLine.replace("Hei ", "Hei ")}\n\n` +
        (message.trim() ? `${message.trim()}\n\n` : "") +
        `${senderLabel} har delt et showcase med deg: ${projectTitle}.\n` +
        `${stateLine}\n\n` +
        `Åpne: ${shareUrl}\n\n` +
        `Lenken er gyldig i 30 dager.\n`;

      const emailResult = await sendTransactionalEmail({
        to: clientEmail,
        subject: `${projectTitle} — Showcase fra ${senderLabel}`,
        html,
        text,
        replyTo: session.email ?? null,
        fromLabel: senderLabel,
        kind: "showcase_share",
        projectId: projectId ?? null,
        sentByUserId: session.userId,
        pool,
      });

      if (!emailResult.sent) {
        console.warn("[showcase-share] e-post ikke sendt", {
          reason: emailResult.reason,
          errorMessage: emailResult.errorMessage,
        });
        // Returner share-lenken uansett — galleriet finnes, klienten kan
        // kontaktes manuelt. Frontend tolker emailSent=false.
        return res.status(200).json({
          success: true,
          emailSent: false,
          emailReason: emailResult.reason,
          galleryId,
          accessToken,
          shareUrl,
          message: `Galleriet er opprettet, men e-posten kunne ikke sendes (${emailResult.reason ?? "ukjent feil"}). Du kan kopiere lenken og sende manuelt.`,
        });
      }

      return res.status(200).json({
        success: true,
        emailSent: true,
        galleryId,
        accessToken,
        shareUrl,
        message: `Showcaset er sendt til ${clientName} (${clientEmail}).`,
      });
    } catch (error) {
      console.error("[showcase-share] feilet", error);
      return res.status(500).json({
        error: "kunne_ikke_dele_showcase",
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // GET /api/showcase/enhancement-presets — Static preset configurations
  app.get("/api/showcase/enhancement-presets", async (_req, res) => {
    res.json(SHOWCASE_ENHANCEMENT_PRESETS);
  });

  // GET /api/showcase/showcases — Admin-side liste (alle items per profession)
  app.get("/api/showcase/showcases", async (req, res) => {
    try {
      const profession = readString(req.query.profession) || "photographer";
      const userId =
        readString(req.query.userId) ||
        readString(req.headers["x-user-id"]) ||
        null;
      const includeInactive =
        readBoolean(req.query.includeInactive) ??
        readBoolean(req.query.include_inactive) ??
        true;

      const params: unknown[] = [profession];
      let query = `SELECT si.*,
                          COALESCE((SELECT SUM(sa.views) FROM showcase_analytics sa WHERE sa.showcase_item_id = si.id), 0) AS view_count,
                          COALESCE((SELECT SUM(sa.likes) FROM showcase_analytics sa WHERE sa.showcase_item_id = si.id), 0) AS like_count,
                          COALESCE((SELECT SUM(sa.downloads) FROM showcase_analytics sa WHERE sa.showcase_item_id = si.id), 0) AS download_count
                     FROM showcase_items si
                    WHERE si.profession = $1`;

      if (userId) {
        params.push(userId);
        query += ` AND si.user_id = $${params.length}`;
      }
      if (!includeInactive) {
        query += " AND COALESCE(si.is_active, true) = true";
      }

      query += " ORDER BY si.created_at DESC NULLS LAST";
      const result = await pool.query(query, params);
      res.json(
        result.rows.map((row: Record<string, unknown>) => mapShowcaseItemRow(row)),
      );
    } catch (error) {
      console.error("Error loading showcase admin items:", error);
      res.status(500).json({ error: "Kunne ikke hente showcases" });
    }
  });

  // PUT /api/showcase/settings — UPSERT showcase-innstillinger (50+ felt)
  app.put("/api/showcase/settings", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const payload = req.body as Record<string, unknown>;
      const userId =
        readString(payload.userId) ||
        readString(req.headers["x-user-id"]) ||
        null;
      if (!userId) {
        return res.status(400).json({ error: "userId er påkrevd" });
      }

      const projectId = readString(payload.projectId) || null;
      const existing = await db
        .select()
        .from(schema.showcaseSettings)
        .where(
          and(
            eq(schema.showcaseSettings.userId, userId),
            projectId
              ? eq(schema.showcaseSettings.projectId, projectId)
              : sql`project_id is null`,
          ),
        )
        .limit(1);

      const nextValues = {
        userId,
        projectId,
        allowDownload: readBoolean(payload.allowDownload) ?? false,
        allowRightClick: readBoolean(payload.allowRightClick) ?? false,
        allowSave: readBoolean(payload.allowSave) ?? false,
        requireApproval: readBoolean(payload.requireApproval) ?? true,
        clientAccessEnabled: readBoolean(payload.clientAccessEnabled) ?? false,
        watermarkEnabled: readBoolean(payload.watermarkEnabled) ?? false,
        watermarkType: readString(payload.watermarkType) || "text",
        watermarkText: readString(payload.watermarkText) || "VANNMERKE",
        watermarkLogo: readString(payload.watermarkLogo) || null,
        watermarkSize: readNumber(payload.watermarkSize) ?? 16,
        watermarkOpacity: readNumber(payload.watermarkOpacity) ?? 70,
        watermarkPosition:
          readString(payload.watermarkPosition) || "bottom-right",
        watermarkRotation: readNumber(payload.watermarkRotation) ?? 0,
        previewFormat: readString(payload.previewFormat) || "16:9",
        previewBackground: readString(payload.previewBackground) || "light",
        showGrid: readBoolean(payload.showGrid) ?? true,
        showRulers: readBoolean(payload.showRulers) ?? false,
        showPixelDistance: readBoolean(payload.showPixelDistance) ?? false,
        watermarkFont: readString(payload.watermarkFont) || "Arial",
        watermarkBold: readBoolean(payload.watermarkBold) ?? false,
        watermarkItalic: readBoolean(payload.watermarkItalic) ?? false,
        watermarkColor: readString(payload.watermarkColor) || "#333333",
        watermarkShadow: readBoolean(payload.watermarkShadow) ?? false,
        watermarkBlur: readNumber(payload.watermarkBlur) ?? 0,
        watermarkBlendMode:
          readString(payload.watermarkBlendMode) || "normal",
        updatedAt: new Date().toISOString(),
      };

      if (existing[0]) {
        const [updated] = await db
          .update(schema.showcaseSettings)
          .set(nextValues)
          .where(eq(schema.showcaseSettings.id, existing[0].id))
          .returning();
        return res.json(updated);
      }

      const [created] = await db
        .insert(schema.showcaseSettings)
        .values({
          id: crypto.randomUUID(),
          ...nextValues,
          createdAt: new Date().toISOString(),
        })
        .returning();
      res.json(created);
    } catch (error) {
      console.error("Error saving showcase settings:", error);
      res.status(500).json({ error: "Kunne ikke lagre showcase-innstillinger" });
    }
  });

  // GET /api/showcase/portfolios — Collections som portfolio-ramme
  app.get("/api/showcase/portfolios", async (req, res) => {
    try {
      const userId =
        readString(req.query.userId) ||
        readString(req.headers["x-user-id"]) ||
        null;
      const profession = readString(req.query.profession);
      const collections = await pool.query(
        `SELECT id, name, settings
           FROM showcase_collections
          WHERE ($1::text IS NULL OR user_id = $1)
          ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST`,
        [userId],
      );

      const portfolios = collections.rows
        .map((row: Record<string, unknown>) => ({
          id: String(row.id),
          name: readString(row.name) || "Portfolio",
          profession:
            readString(
              (normalizeJsonObjectField(row.settings) || {}).profession,
            ) || undefined,
        }))
        .filter((portfolio) =>
          profession ? portfolio.profession === profession : true,
        );

      res.json({ portfolios });
    } catch (error) {
      console.error("Error loading showcase portfolios:", error);
      res.status(500).json({ error: "Kunne ikke hente showcase-portfolios" });
    }
  });

  // POST /api/showcase — Bare create (proxy til createShowcaseItemRecord)
  app.post("/api/showcase", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const created = await createShowcaseItemRecord(
        req.body as Record<string, unknown>,
      );
      res.status(201).json(mapShowcaseItemRow(created));
    } catch (error) {
      console.error("Error creating showcase item:", error);
      res.status(500).json({ error: "Kunne ikke opprette showcase" });
    }
  });

  // POST /api/showcase/calculate-selection-price — Utled pris fra valgt antall
  app.post("/api/showcase/calculate-selection-price", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const payload = req.body as Record<string, unknown>;
      const selectedImages = readStringArray(payload.selectedImages);
      const showcaseId = readString(payload.showcaseId);
      let profession = "photographer";
      let userId: string | null = null;

      if (showcaseId) {
        const itemResult = await pool
          .query(
            `SELECT profession, user_id
               FROM showcase_items
              WHERE id = $1
              LIMIT 1`,
            [showcaseId],
          )
          .catch(() => ({ rows: [] as Array<Record<string, unknown>> }));
        const row = itemResult.rows[0] as Record<string, unknown> | undefined;
        profession = readString(row?.profession) || profession;
        userId = readString(row?.user_id);
      }

      const pricing = await resolveShowcasePricing(profession, userId);
      const includedCount = pricing.contractedBase;
      const extraCount = Math.max(0, selectedImages.length - includedCount);
      const totalCost = extraCount * pricing.perImage;

      res.json({
        success: true,
        calculation: {
          selectedCount: selectedImages.length,
          includedCount,
          extraCount,
          pricePerImage: pricing.perImage,
          totalCost,
          currency: "NOK",
        },
        pricing,
      });
    } catch (error) {
      console.error("Error calculating showcase price:", error);
      res.status(500).json({ error: "Kunne ikke beregne pris" });
    }
  });

  // POST /api/showcase/link-project — Koble showcase til prosjekt-kontekst
  app.post("/api/showcase/link-project", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const payload = req.body as Record<string, unknown>;
      const userId =
        readString(payload.userId) ||
        readString(req.headers["x-user-id"]) ||
        null;
      const projectId = readString(payload.projectId);
      if (!userId || !projectId) {
        return res.status(400).json({ error: "userId og projectId er påkrevd" });
      }

      const projectResult = await pool.query(
        `SELECT id, name, title, profession, category, client_email, date, event_date, location
           FROM legacy.projects
          WHERE id = $1
          LIMIT 1`,
        [projectId],
      );
      const project = projectResult.rows[0] as Record<string, unknown> | undefined;
      if (!project) {
        return res.status(404).json({ error: "Prosjekt ikke funnet" });
      }

      await compatStoreSet(dbCompatUserKvKey(userId, "currentProjectContext"), {
        value: {
          projectId,
          projectName: readString(project.name) || readString(project.title) || "Prosjekt",
          projectType:
            readString(project.category) ||
            readString(project.profession) ||
            "project",
          clientName: readString(project.client_email) || "",
          eventDate:
            readOptionalIsoDate(project.event_date) ||
            readOptionalIsoDate(project.date) ||
            null,
          location: readString(project.location) || "",
        },
        updatedAt: new Date().toISOString(),
      });

      res.json({
        success: true,
        projectId,
        projectName: readString(project.name) || readString(project.title) || "Prosjekt",
        driveUrl: readString(payload.driveUrl) || null,
        driveFolderId: readString(payload.driveFolderId) || null,
      });
    } catch (error) {
      console.error("Error linking project to showcase:", error);
      res.status(500).json({ error: "Kunne ikke koble prosjekt til showcase" });
    }
  });
}
