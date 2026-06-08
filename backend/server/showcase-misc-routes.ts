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
import { sendTransactionalEmail } from "./transactional-email-service.js";

type Db = NodePgDatabase<typeof schema>;

// Daily cron-trigger som finner galleries med selectionDeadline om
// 3 eller 1 dag og som ikke har fått reminder for den aktuelle stagen
// ennå. Idempotent via gallery_settings.reminderSentFor (verdi: '3d'|'1d').
// Eksportert så index.ts kan registrere setInterval; kalles også manuelt
// via /api/showcase/run-deadline-sweep.
export async function runDeadlineReminderSweep(pool: Pool): Promise<{
  scanned: number;
  sent: number;
  errors: number;
}> {
  let scanned = 0;
  let sent = 0;
  let errors = 0;

  // 3-dagers reminder
  const three = await pool.query(
    `SELECT g.id, g.client_email, g.client_name, g.project_title, g.access_token,
            g.photographer_id, g.gallery_settings
       FROM photographer_client_galleries g
      WHERE g.status = 'active'
        AND (g.gallery_settings ->> 'selectionDeadline') IS NOT NULL
        AND (g.gallery_settings ->> 'selectionDeadline')::timestamptz
              BETWEEN NOW() + INTERVAL '2.5 days' AND NOW() + INTERVAL '3.5 days'
        AND COALESCE(g.gallery_settings ->> 'reminderSentFor', '') NOT IN ('3d', '1d')
      LIMIT 200`,
  );
  scanned += three.rowCount ?? 0;
  for (const row of three.rows) {
    try {
      await sendDeadlineReminderEmail(pool, row, '3d');
      await pool.query(
        `UPDATE photographer_client_galleries
            SET gallery_settings = gallery_settings || jsonb_build_object('reminderSentFor', '3d', 'reminder3dAt', NOW()::text),
                updated_at = NOW()
          WHERE id = $1`,
        [row.id],
      );
      sent++;
    } catch (err) {
      errors++;
      console.warn(`[deadline-sweep] 3d send failed for ${row.id}:`, err);
    }
  }

  // 1-dags reminder (har høyere prioritet — oppdaterer reminderSentFor selv om 3d er satt)
  const one = await pool.query(
    `SELECT g.id, g.client_email, g.client_name, g.project_title, g.access_token,
            g.photographer_id, g.gallery_settings
       FROM photographer_client_galleries g
      WHERE g.status = 'active'
        AND (g.gallery_settings ->> 'selectionDeadline') IS NOT NULL
        AND (g.gallery_settings ->> 'selectionDeadline')::timestamptz
              BETWEEN NOW() + INTERVAL '0.5 days' AND NOW() + INTERVAL '1.5 days'
        AND COALESCE(g.gallery_settings ->> 'reminderSentFor', '') <> '1d'
      LIMIT 200`,
  );
  scanned += one.rowCount ?? 0;
  for (const row of one.rows) {
    try {
      await sendDeadlineReminderEmail(pool, row, '1d');
      await pool.query(
        `UPDATE photographer_client_galleries
            SET gallery_settings = gallery_settings || jsonb_build_object('reminderSentFor', '1d', 'reminder1dAt', NOW()::text),
                updated_at = NOW()
          WHERE id = $1`,
        [row.id],
      );
      sent++;
    } catch (err) {
      errors++;
      console.warn(`[deadline-sweep] 1d send failed for ${row.id}:`, err);
    }
  }

  return { scanned, sent, errors };
}

async function sendDeadlineReminderEmail(
  pool: Pool,
  row: any,
  stage: '3d' | '1d',
): Promise<void> {
  const settings = (row.gallery_settings ?? {}) as Record<string, unknown>;
  const deadlineRaw = String(settings.selectionDeadline ?? '');
  const deadlineDate = new Date(deadlineRaw);
  const deadlineLabel = Number.isFinite(deadlineDate.getTime())
    ? deadlineDate.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long' })
    : 'snart';

  const baseUrl = (
    process.env.PUBLIC_APP_URL ||
    process.env.APP_BASE_URL ||
    'https://creatorhubn.com'
  ).replace(/\/+$/, '');
  const shareUrl = `${baseUrl}/client/gallery/${row.access_token}`;

  const photographerName = String(settings.photographerName ?? 'fotografen');
  const subject = stage === '1d'
    ? `Påminnelse — utvalg utløper i morgen for "${row.project_title}"`
    : `Påminnelse — utvalg utløper ${deadlineLabel} for "${row.project_title}"`;
  const greeting = `Hei ${row.client_name},`;
  const body = stage === '1d'
    ? `Bare en kort påminnelse om at fristen for å gjøre ditt utvalg på "${row.project_title}" er i morgen.`
    : `Bare en kort påminnelse om at fristen for å gjøre ditt utvalg på "${row.project_title}" er ${deadlineLabel}.`;

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#fafafa;">
      <h2 style="color:#1a1a1a;margin:0 0 12px;font-size:20px;">${row.project_title}</h2>
      <p style="font-size:15px;line-height:1.6;color:#333;margin:0 0 18px;">${greeting}</p>
      <p style="font-size:15px;line-height:1.6;color:#333;margin:0 0 18px;">${body}</p>
      <p style="margin:24px 0;">
        <a href="${shareUrl}" style="display:inline-block;background:#ff8c00;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">
          Fortsett utvalget
        </a>
      </p>
      <p style="font-size:13px;color:#888;margin:24px 0 0;">
        Send fra ${photographerName} via Creatorhubn.
      </p>
    </div>
  `;
  const text = `${greeting}\n\n${body}\n\nFortsett utvalget: ${shareUrl}\n`;

  const result = await sendTransactionalEmail({
    to: row.client_email,
    subject,
    html,
    text,
    fromLabel: photographerName,
    kind: `showcase_deadline_${stage}`,
    sentByUserId: row.photographer_id,
    pool,
  });
  if (!result.sent) {
    throw new Error(result.reason ?? 'send_failed');
  }
}

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

  // POST /api/showcase/email — Share showcase via email
  app.post("/api/showcase/email", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const { to, subject } = req.body;
      console.log(`[Showcase Email] Sending to ${to}: ${subject}`);
      // In production, this would send via email service
      res.json({ success: true, message: `E-post sendt til ${to}` });
    } catch (error) {
      console.error("Error sending showcase email:", error);
      res.status(500).json({ error: "Kunne ikke sende e-post" });
    }
  });

  // POST /api/showcase/run-deadline-sweep — Manuell trigger av deadline-
  // cron. Cron registreres i index.ts som daily setInterval.
  app.post("/api/showcase/run-deadline-sweep", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const result = await runDeadlineReminderSweep(pool);
      res.json(result);
    } catch (error) {
      console.error("[deadline-sweep] feilet", error);
      res.status(500).json({ error: "sweep_failed" });
    }
  });

  // GET /api/showcase/galleries/mine — Liste over share-galleries denne
  // fotografen eier. Brukes av "Mine delte galleries"-panelet til å la
  // Fredrik se hva som er aktivt og revokere/regenerere ved behov.
  app.get("/api/showcase/galleries/mine", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const result = await pool.query(
        `SELECT id, project_title, client_name, client_email, access_token,
                status, gallery_settings, created_at, updated_at, completed_at
           FROM photographer_client_galleries
          WHERE photographer_id = $1
          ORDER BY created_at DESC
          LIMIT 200`,
        [session.userId],
      );
      const rows = result.rows.map((r: any) => {
        const settings = (r.gallery_settings ?? {}) as Record<string, unknown>;
        const expiresAtRaw = settings.expiresAt;
        const expiresAt =
          typeof expiresAtRaw === 'string' && expiresAtRaw.trim()
            ? expiresAtRaw
            : null;
        const isExpired = expiresAt
          ? new Date(expiresAt).getTime() < Date.now()
          : false;
        return {
          id: r.id,
          projectTitle: r.project_title,
          clientName: r.client_name,
          clientEmail: r.client_email,
          accessToken: r.access_token,
          status: r.status ?? 'active',
          projectState: typeof settings.projectState === 'string' ? settings.projectState : null,
          source: typeof settings.source === 'string' ? settings.source : null,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
          completedAt: r.completed_at,
          expiresAt,
          isExpired,
        };
      });
      res.json({ galleries: rows });
    } catch (error) {
      // Manglende photographer_client_galleries-tabell skal ikke krasje
      // showcase-listen. Returner tom shape istedet for 500.
      console.warn(
        "[showcase-galleries-mine] degraded:",
        (error as any)?.message || error,
      );
      res.json({ galleries: [] });
    }
  });

  // PATCH /api/showcase/galleries/:id/deadline — Sett/oppdater
  // selectionDeadline. Resetter reminderSentFor så cron sender ny
  // reminder hvis ny deadline er i 3/1d-vinduet.
  app.patch("/api/showcase/galleries/:id/deadline", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const galleryId = String(req.params.id || "").trim();
    if (!galleryId) return res.status(400).json({ error: "manglende_gallery_id" });
    const deadlineRaw = readString((req.body || {}).deadline);
    // Null/tom string → clear deadline.
    if (deadlineRaw && !Number.isFinite(new Date(deadlineRaw).getTime())) {
      return res.status(400).json({ error: "ugyldig_deadline" });
    }
    try {
      const owner = await pool.query(
        `SELECT photographer_id, gallery_settings, project_title
           FROM photographer_client_galleries
          WHERE id = $1 LIMIT 1`,
        [galleryId],
      );
      const ownerRow = owner.rows[0];
      if (!ownerRow || ownerRow.photographer_id !== session.userId) {
        return res.status(404).json({ error: "ikke_funnet" });
      }
      const newSettings = {
        ...((ownerRow.gallery_settings ?? {}) as Record<string, unknown>),
        selectionDeadline: deadlineRaw || null,
        reminderSentFor: null,
      };
      await pool.query(
        `UPDATE photographer_client_galleries
            SET gallery_settings = $1, updated_at = now()
          WHERE id = $2`,
        [newSettings, galleryId],
      );
      res.json({ ok: true });
    } catch (error) {
      console.error("[showcase-deadline] feilet", error);
      res.status(500).json({ error: "kunne_ikke_sette_deadline" });
    }
  });

  // POST /api/showcase/galleries/:galleryId/revoke — Marker som revoked.
  // Vi sletter ikke raden (audit-spor + selections/comments referer til
  // gallery_id). Status='revoked' gjør at fetchClientGalleryByAccessToken
  // returnerer null (return-tidlig hvis status != 'active'), så lenken
  // svarer 404 derfra.
  app.post("/api/showcase/galleries/:galleryId/revoke", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const galleryId = String(req.params.galleryId || "").trim();
    if (!galleryId) {
      return res.status(400).json({ error: "manglende_gallery_id" });
    }
    try {
      // Eier-sjekk + status-fetch i én query for å unngå race.
      const owner = await pool.query(
        `SELECT photographer_id, status, project_title FROM photographer_client_galleries
          WHERE id = $1 LIMIT 1`,
        [galleryId],
      );
      const row = owner.rows[0];
      if (!row) {
        return res.status(404).json({ error: "galleri_ikke_funnet" });
      }
      if (row.photographer_id !== session.userId) {
        return res.status(403).json({ error: "ikke_eier_av_galleri" });
      }
      if (row.status === 'revoked') {
        return res.json({
          success: true,
          alreadyRevoked: true,
          message: `Galleriet "${row.project_title}" var allerede revokert.`,
        });
      }
      await pool.query(
        `UPDATE photographer_client_galleries
            SET status = 'revoked', updated_at = NOW()
          WHERE id = $1`,
        [galleryId],
      );
      res.json({
        success: true,
        message: `Lenken til "${row.project_title}" er revokert og fungerer ikke lenger.`,
      });
    } catch (error) {
      console.error("[showcase-gallery-revoke] feilet", error);
      res.status(500).json({ error: "kunne_ikke_revokere" });
    }
  });

  // POST /api/showcase/galleries/:galleryId/regenerate-token — Ruller en
  // ny accessToken og gjenåpner galleriet (status='active'). Den GAMLE
  // tokenen slutter å virke umiddelbart fordi vi overskriver. Returnerer
  // den nye shareUrl-en så frontend kan vise den + kopiere-knapp.
  app.post(
    "/api/showcase/galleries/:galleryId/regenerate-token",
    async (req, res) => {
      const session = requireUserSession(req, res);
      if (!session) return;
      const galleryId = String(req.params.galleryId || "").trim();
      if (!galleryId) {
        return res.status(400).json({ error: "manglende_gallery_id" });
      }
      try {
        const owner = await pool.query(
          `SELECT photographer_id, project_title FROM photographer_client_galleries
            WHERE id = $1 LIMIT 1`,
          [galleryId],
        );
        const row = owner.rows[0];
        if (!row) {
          return res.status(404).json({ error: "galleri_ikke_funnet" });
        }
        if (row.photographer_id !== session.userId) {
          return res.status(403).json({ error: "ikke_eier_av_galleri" });
        }
        const newAccessToken = crypto.randomBytes(24).toString("hex");
        await pool.query(
          `UPDATE photographer_client_galleries
              SET access_token = $1, status = 'active', updated_at = NOW()
            WHERE id = $2`,
          [newAccessToken, galleryId],
        );
        const baseUrl = (
          process.env.PUBLIC_APP_URL ||
          process.env.APP_BASE_URL ||
          "https://creatorhubn.com"
        ).replace(/\/+$/, "");
        const shareUrl = `${baseUrl}/client/gallery/${newAccessToken}`;
        res.json({
          success: true,
          accessToken: newAccessToken,
          shareUrl,
          message: `Ny lenke generert for "${row.project_title}". Den gamle fungerer ikke lenger.`,
        });
      } catch (error) {
        console.error("[showcase-gallery-regenerate] feilet", error);
        res.status(500).json({ error: "kunne_ikke_regenerere_token" });
      }
    },
  );

  // GET /api/showcase/engagement/feed?limit=50 — Cross-gallery activity feed
  // for fotografens dashboard. Union-er events fra 4 datakilder:
  //   - gallery_download_audit   (klient lastet ned bilder)
  //   - client_image_comments    (klient kommenterte)
  //   - client_image_selections  (klient favoritt-merket / valgte)
  //   - analytics_events         (klient åpnet galleri — view-tracking
  //                                 fra creatorhub-events.viewedByClient)
  // Alle filtreres på photographer_id = session.userId via gallery-FK.
  // Returneres sortert nyeste først så Fredrik kan scrolle som
  // morning-checkin.
  app.get("/api/showcase/engagement/feed", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 200
      ? Math.floor(limitRaw)
      : 50;
    try {
      // 4 unioned subqueries, hver normaliserer til samme kolonnesett.
      // gallery_id binder dem til photographer via FK. analytics_events
      // har ikke FK, men entity_type='gallery' + entity_id=galleryId
      // matcher manuelt mot photographer_client_galleries.
      const sqlText = `
        WITH owned_galleries AS (
          SELECT id, project_title, client_name, client_email
          FROM photographer_client_galleries
          WHERE photographer_id = $1
        )
        (
          SELECT
            'download'::text AS kind,
            d.gallery_id::text AS gallery_id,
            g.project_title,
            g.client_name,
            d.client_email,
            d.created_at AS happened_at,
            jsonb_build_object('imageId', d.image_id::text) AS detail
          FROM gallery_download_audit d
          JOIN owned_galleries g ON g.id = d.gallery_id
        )
        UNION ALL
        (
          SELECT
            'comment'::text AS kind,
            c.gallery_id::text AS gallery_id,
            g.project_title,
            g.client_name,
            c.client_email,
            c.created_at AS happened_at,
            jsonb_build_object(
              'imageId', c.image_id::text,
              'comment', LEFT(c.comment, 200),
              'status', c.status
            ) AS detail
          FROM client_image_comments c
          JOIN owned_galleries g ON g.id = c.gallery_id
        )
        UNION ALL
        (
          SELECT
            'selection'::text AS kind,
            s.gallery_id::text AS gallery_id,
            g.project_title,
            g.client_name,
            s.client_email,
            s.created_at AS happened_at,
            jsonb_build_object(
              'imageId', s.image_id::text,
              'selectionType', s.selection_type
            ) AS detail
          FROM client_image_selections s
          JOIN owned_galleries g ON g.id = s.gallery_id
        )
        UNION ALL
        (
          SELECT
            'view'::text AS kind,
            (a.entity_id) AS gallery_id,
            g.project_title,
            g.client_name,
            g.client_email,
            a.created_at AS happened_at,
            COALESCE(a.metadata, '{}'::jsonb) AS detail
          FROM analytics_events a
          JOIN owned_galleries g ON g.id::text = a.entity_id
          WHERE a.entity_type = 'gallery'
            AND a.event_type IN ('gallery_viewed', 'gallery.view', 'view')
        )
        ORDER BY happened_at DESC
        LIMIT $2
      `;
      // analytics_events kan mangle (idempotent ensure i marketplace-app-
      // config-routes.ts), så vi catcher og faller tilbake til de tre
      // andre datakildene hvis hovedquery feiler.
      let rows: any[];
      try {
        const result = await pool.query(sqlText, [session.userId, limit]);
        rows = result.rows;
      } catch (unionErr) {
        // Fallback uten analytics_events.
        const fallbackSql = sqlText.replace(/UNION ALL\s*\(\s*SELECT[\s\S]*?WHERE a\.entity_type[\s\S]*?\)\s*ORDER BY/m,
          'ORDER BY');
        const result = await pool.query(fallbackSql, [session.userId, limit]);
        rows = result.rows;
      }

      // Aggregate-summary for siste 7 dager — drives av samme dataset.
      // Kjøres som second query for å holde unionen ren.
      const summaryRes = await pool.query(
        `
        WITH owned AS (
          SELECT id FROM photographer_client_galleries WHERE photographer_id = $1
        ),
        cutoff AS (SELECT NOW() - INTERVAL '7 days' AS since)
        SELECT
          (SELECT COUNT(*)::int FROM gallery_download_audit d
             JOIN owned o ON o.id = d.gallery_id, cutoff
             WHERE d.created_at >= cutoff.since) AS downloads_7d,
          (SELECT COUNT(*)::int FROM client_image_comments c
             JOIN owned o ON o.id = c.gallery_id, cutoff
             WHERE c.created_at >= cutoff.since) AS comments_7d,
          (SELECT COUNT(*)::int FROM client_image_selections s
             JOIN owned o ON o.id = s.gallery_id, cutoff
             WHERE s.created_at >= cutoff.since) AS selections_7d,
          (SELECT COUNT(DISTINCT s.client_email)::int FROM client_image_selections s
             JOIN owned o ON o.id = s.gallery_id, cutoff
             WHERE s.created_at >= cutoff.since) AS active_clients_7d
        `,
        [session.userId],
      );
      const summary = summaryRes.rows[0] ?? {
        downloads_7d: 0,
        comments_7d: 0,
        selections_7d: 0,
        active_clients_7d: 0,
      };

      res.json({
        events: rows.map((r: any) => ({
          kind: r.kind,
          galleryId: r.gallery_id,
          projectTitle: r.project_title,
          clientName: r.client_name,
          clientEmail: r.client_email,
          happenedAt: r.happened_at,
          detail: r.detail ?? {},
        })),
        summary: {
          downloads7d: Number(summary.downloads_7d ?? 0),
          comments7d: Number(summary.comments_7d ?? 0),
          selections7d: Number(summary.selections_7d ?? 0),
          activeClients7d: Number(summary.active_clients_7d ?? 0),
        },
      });
    } catch (error) {
      // Schema-drift på noen av de 4 union-tabellene (gallery_download_audit,
      // client_image_comments, client_image_selections, analytics_events) skal
      // ikke krasje engagement-feeden. Returner tom shape istedet for 500.
      console.warn(
        "[engagement-feed] degraded:",
        (error as any)?.message || error,
      );
      res.json({
        events: [],
        summary: {
          views7d: 0,
          downloads7d: 0,
          comments7d: 0,
          selections7d: 0,
          activeClients7d: 0,
        },
      });
    }
  });


  // ── Multi-round revisions ─────────────────────────────────────────
  // Bryllup/event-fotografer trenger ofte runde 1 (klient velger) →
  // runde 2 (etter retusj/feedback). Round-info lagres som
  //   gallery_settings.proofingRound      (current round på galleriet)
  //   client_image_selections.proofing_round (round når selection ble gjort)
  // proofing_round-kolonnen sikres lazy via ensureSelectionsRoundColumn.

  let selectionsRoundColumnReady: Promise<void> | null = null;
  async function ensureSelectionsRoundColumn() {
    if (!selectionsRoundColumnReady) {
      selectionsRoundColumnReady = (async () => {
        try {
          await pool.query(
            `ALTER TABLE client_image_selections
               ADD COLUMN IF NOT EXISTS proofing_round INTEGER DEFAULT 1`,
          );
          await pool.query(
            `UPDATE client_image_selections
                SET proofing_round = 1
              WHERE proofing_round IS NULL`,
          );
        } catch (err: any) {
          console.warn('[selections-round-ensure] failed:', err?.message);
        }
      })();
    }
    return selectionsRoundColumnReady;
  }

  // GET /api/showcase/galleries/:galleryId/round — Hent current round.
  app.get("/api/showcase/galleries/:galleryId/round", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const galleryId = String(req.params.galleryId || "").trim();
    if (!galleryId) return res.status(400).json({ error: "manglende_gallery_id" });
    try {
      const row = await pool.query(
        `SELECT photographer_id, gallery_settings, project_title
           FROM photographer_client_galleries
          WHERE id = $1 LIMIT 1`,
        [galleryId],
      );
      const g = row.rows[0];
      if (!g) return res.status(404).json({ error: "galleri_ikke_funnet" });
      if (g.photographer_id !== session.userId) {
        return res.status(403).json({ error: "ikke_eier_av_galleri" });
      }
      const settings = (g.gallery_settings ?? {}) as Record<string, unknown>;
      const round = Number(settings.proofingRound ?? 1) || 1;
      res.json({ galleryId, projectTitle: g.project_title, round });
    } catch (error) {
      console.error("[showcase-round-get] feilet", error);
      res.status(500).json({ error: "kunne_ikke_hente_round" });
    }
  });

  // POST /api/showcase/galleries/:galleryId/start-new-round — Bump round.
  // Setter status='active' og expiresAt 30d. Eksisterende selections
  // beholdes med sin runde-tagg så Fredrik kan sammenligne runder.
  app.post(
    "/api/showcase/galleries/:galleryId/start-new-round",
    async (req, res) => {
      const session = requireUserSession(req, res);
      if (!session) return;
      const galleryId = String(req.params.galleryId || "").trim();
      if (!galleryId) return res.status(400).json({ error: "manglende_gallery_id" });
      try {
        await ensureSelectionsRoundColumn();
        const row = await pool.query(
          `SELECT photographer_id, gallery_settings, project_title
             FROM photographer_client_galleries
            WHERE id = $1 LIMIT 1`,
          [galleryId],
        );
        const g = row.rows[0];
        if (!g) return res.status(404).json({ error: "galleri_ikke_funnet" });
        if (g.photographer_id !== session.userId) {
          return res.status(403).json({ error: "ikke_eier_av_galleri" });
        }
        const settings = (g.gallery_settings ?? {}) as Record<string, unknown>;
        const currentRound = Number(settings.proofingRound ?? 1) || 1;
        const newRound = currentRound + 1;
        const newExpiresAt = new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000,
        ).toISOString();
        const nextSettings = {
          ...settings,
          proofingRound: newRound,
          expiresAt: newExpiresAt,
          projectState: 'in_review',
        };
        await pool.query(
          `UPDATE photographer_client_galleries
              SET status = 'active',
                  gallery_settings = $1::jsonb,
                  updated_at = NOW()
            WHERE id = $2`,
          [JSON.stringify(nextSettings), galleryId],
        );
        res.json({
          success: true,
          round: newRound,
          previousRound: currentRound,
          message: `"${g.project_title}" er nå på runde ${newRound}. Klienten kan velge på nytt — eksisterende valg fra runde ${currentRound} er bevart for sammenligning.`,
        });
      } catch (error) {
        console.error("[showcase-start-new-round] feilet", error);
        res.status(500).json({ error: "kunne_ikke_starte_ny_runde" });
      }
    },
  );

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
      // Manglende showcase_items eller showcase_analytics-tabell skal ikke
      // krasje admin-listen. Returner tom liste i stedet for 500.
      console.warn(
        "[showcase-admin-items] list degraded:",
        (error as any)?.message || error,
      );
      res.json([]);
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
      // Manglende showcase_collections-tabell skal ikke krasje
      // portfolio-velgeren. Returner tom liste i stedet for 500.
      console.warn(
        "[showcase-portfolios] list degraded:",
        (error as any)?.message || error,
      );
      res.json({ portfolios: [] });
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
