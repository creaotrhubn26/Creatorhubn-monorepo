// gallery-versions-routes.ts — versjons-historikk + leveranse-progress
// for klient-gallerier.
//
// PUBLIC (klient, token-gatet via gateGalleryAccess):
//   GET  /api/client/gallery/:accessToken/versions
//        → liste publiserte versjoner + klient sin egen avgjørelse
//   POST /api/client/gallery/:accessToken/versions/:versionLabel/approve
//        → marker som godkjent
//   POST /api/client/gallery/:accessToken/versions/:versionLabel/request-changes
//        → marker som changes_requested + note
//   GET  /api/client/gallery/:accessToken/timeline
//        → fase-progresjon klient kan se
//
// OWNER (fotograf, getActiveSessionFromRequest):
//   POST   /api/photographer/galleries/:galleryId/versions
//          → opprett ny versjon (R1/R2/R3/Final) + linker bilder
//   PUT    /api/photographer/galleries/:galleryId/versions/:versionId/visibility
//          → publiser/avpubliser
//   GET    /api/photographer/galleries/:galleryId/timeline
//          → full liste milepæler m/ klient-decisions oppsummert
//   PUT    /api/photographer/galleries/:galleryId/timeline/:milestoneId
//          → oppdater status/eta/blocked_reason/display_label
//   POST   /api/photographer/galleries/:galleryId/timeline/seed
//          → kall seed_client_delivery_timeline() for default 12-stages
//          (idempotent — ON CONFLICT DO NOTHING)

import express from "express";
import type { Pool } from "pg";

export interface GalleryVersionsRoutesDeps {
  app: express.Application;
  pool: Pool;
  gateGalleryAccess: (
    accessToken: string,
    password: string | null,
  ) => Promise<any>;
  readGalleryPasswordHeader: (req: express.Request) => string | null;
  getActiveSessionFromRequest: (req: express.Request) => any;
  dispatchGalleryNotification?: (
    type: string,
    photographerId: string,
    payload: any,
  ) => Promise<void>;
}

export function setupGalleryVersionsRoutes(
  deps: GalleryVersionsRoutesDeps,
): void {
  const {
    app,
    pool,
    gateGalleryAccess,
    readGalleryPasswordHeader,
    getActiveSessionFromRequest,
    dispatchGalleryNotification,
  } = deps;

  // ─── PUBLIC (klient) ────────────────────────────────────────────

  // GET versjoner som klient kan se
  app.get(
    "/api/client/gallery/:accessToken/versions",
    async (req, res) => {
      const accessToken = String(req.params.accessToken || "").trim();
      if (!accessToken)
        return res.status(400).json({ error: "missing_access_token" });

      try {
        const access = await gateGalleryAccess(
          accessToken,
          readGalleryPasswordHeader(req),
        );
        if (!access.ok) {
          return res.status(access.status).json({
            error: access.error,
            ...(access.requiresPassword ? { requiresPassword: true } : {}),
          });
        }

        const versions = await pool.query<{
          id: string;
          version_label: string;
          version_order: number;
          published_at: string | null;
          notes: string | null;
          image_count: string | number;
        }>(
          `SELECT v.id, v.version_label, v.version_order, v.published_at,
                  v.notes,
                  (SELECT COUNT(*) FROM client_gallery_image_version_links l
                    WHERE l.version_id = v.id) AS image_count
             FROM client_gallery_image_versions v
            WHERE v.gallery_id = $1
              AND v.is_published_to_client = TRUE
            ORDER BY v.version_order DESC`,
          [access.gallery.id],
        );

        // Hent siste decision per versjon
        const decisions = await pool.query<{
          version_id: string;
          decision: string;
          decision_note: string | null;
          decided_by_email: string;
          decided_by_label: string | null;
          decided_at: string;
        }>(
          `SELECT DISTINCT ON (version_id)
                  version_id, decision, decision_note, decided_by_email,
                  decided_by_label, decided_at
             FROM client_gallery_version_decisions
            WHERE version_id = ANY($1::uuid[])
            ORDER BY version_id, decided_at DESC`,
          [versions.rows.map((v) => v.id)],
        );
        const decisionByVersion = new Map(
          decisions.rows.map((d) => [d.version_id, d]),
        );

        res.json({
          success: true,
          versions: versions.rows.map((v) => ({
            id: v.id,
            label: v.version_label,
            order: v.version_order,
            publishedAt: v.published_at,
            notes: v.notes,
            imageCount: Number(v.image_count),
            decision: decisionByVersion.get(v.id) ?? null,
          })),
        });
      } catch (err) {
        console.error("[gallery-versions] list failed:", err);
        res.status(500).json({ error: "list_failed" });
      }
    },
  );

  // POST approve
  app.post(
    "/api/client/gallery/:accessToken/versions/:versionLabel/approve",
    async (req, res) => {
      await handleClientDecision(req, res, "approved");
    },
  );

  // POST request-changes
  app.post(
    "/api/client/gallery/:accessToken/versions/:versionLabel/request-changes",
    async (req, res) => {
      await handleClientDecision(req, res, "changes_requested");
    },
  );

  async function handleClientDecision(
    req: express.Request,
    res: express.Response,
    decision: "approved" | "changes_requested" | "rejected",
  ) {
    const accessToken = String(req.params.accessToken || "").trim();
    const versionLabel = String(req.params.versionLabel || "").trim();
    if (!accessToken || !versionLabel) {
      return res.status(400).json({ error: "missing_params" });
    }
    const note =
      typeof req.body?.note === "string"
        ? req.body.note.slice(0, 5000)
        : null;
    const decidedByEmail =
      typeof req.body?.clientEmail === "string"
        ? req.body.clientEmail.trim().toLowerCase()
        : "";
    const decidedByLabel =
      typeof req.body?.clientName === "string"
        ? req.body.clientName.slice(0, 200)
        : null;

    if (!decidedByEmail) {
      return res
        .status(400)
        .json({ error: "missing_email", message: "Skriv inn e-posten din." });
    }
    if (decision === "changes_requested" && (!note || !note.trim())) {
      return res.status(400).json({
        error: "missing_note",
        message: "Beskriv hva som skal endres.",
      });
    }

    try {
      const access = await gateGalleryAccess(
        accessToken,
        readGalleryPasswordHeader(req),
      );
      if (!access.ok) {
        return res.status(access.status).json({ error: access.error });
      }

      const versionRes = await pool.query<{ id: string; gallery_id: string }>(
        `SELECT id, gallery_id
           FROM client_gallery_image_versions
          WHERE gallery_id = $1
            AND version_label = $2
            AND is_published_to_client = TRUE
          LIMIT 1`,
        [access.gallery.id, versionLabel],
      );
      if ((versionRes.rowCount ?? 0) === 0) {
        return res.status(404).json({ error: "version_not_found" });
      }
      const versionId = versionRes.rows[0].id;

      await pool.query(
        `INSERT INTO client_gallery_version_decisions
           (version_id, decision, decision_note, decided_by_email,
            decided_by_label)
         VALUES ($1, $2, $3, $4, $5)`,
        [versionId, decision, note, decidedByEmail, decidedByLabel],
      );

      // Notification til fotograf — fire-and-forget
      if (dispatchGalleryNotification && access.gallery.photographerId) {
        void dispatchGalleryNotification(
          decision === "approved"
            ? "version_approved"
            : "version_changes_requested",
          access.gallery.photographerId,
          {
            galleryId: access.gallery.id,
            versionLabel,
            decision,
            clientEmail: decidedByEmail,
            clientLabel: decidedByLabel,
            note,
          },
        ).catch(() => undefined);
      }

      // Hvis approved → fremover-progress på timeline
      if (decision === "approved") {
        await advanceTimelineOnApproval(pool, access.gallery.id, versionLabel);
      } else if (decision === "changes_requested") {
        // Sett aktuell client_review-milepæl til 'blocked' så
        // fotografen umiddelbart ser at det venter feedback
        await pool
          .query(
            `UPDATE client_delivery_milestones
                SET status = 'blocked',
                    blocked_reason = $2,
                    updated_at = now()
              WHERE gallery_id = $1
                AND stage = 'client_review'`,
            [
              access.gallery.id,
              `${versionLabel}: klient ba om endringer${note ? ' — "' + note.slice(0, 200) + '"' : ""}`,
            ],
          )
          .catch(() => undefined);
      }

      res.json({ success: true, decision, versionLabel });
    } catch (err) {
      console.error("[gallery-versions] decision failed:", err);
      res.status(500).json({ error: "decision_failed" });
    }
  }

  // GET timeline (klient)
  app.get(
    "/api/client/gallery/:accessToken/timeline",
    async (req, res) => {
      const accessToken = String(req.params.accessToken || "").trim();
      if (!accessToken)
        return res.status(400).json({ error: "missing_access_token" });

      try {
        const access = await gateGalleryAccess(
          accessToken,
          readGalleryPasswordHeader(req),
        );
        if (!access.ok) {
          return res
            .status(access.status)
            .json({ error: access.error });
        }

        const milestones = await pool.query(
          `SELECT id, stage, stage_order, display_label, status,
                  estimated_at, started_at, completed_at, blocked_reason
             FROM client_delivery_milestones
            WHERE gallery_id = $1
              AND is_client_visible = TRUE
            ORDER BY stage_order ASC`,
          [access.gallery.id],
        );
        res.json({
          success: true,
          milestones: milestones.rows.map((m) => ({
            id: m.id,
            stage: m.stage,
            order: m.stage_order,
            label: m.display_label,
            status: m.status,
            estimatedAt: m.estimated_at,
            startedAt: m.started_at,
            completedAt: m.completed_at,
            blockedReason: m.blocked_reason,
          })),
        });
      } catch (err) {
        console.error("[gallery-versions] timeline failed:", err);
        res.status(500).json({ error: "timeline_failed" });
      }
    },
  );

  // ─── OWNER (fotograf) ──────────────────────────────────────────

  // GET versjons-liste (fotograf — inkluderer utkast som ikke er publisert)
  app.get(
    "/api/photographer/galleries/:galleryId/versions",
    async (req, res) => {
      const session = getActiveSessionFromRequest(req);
      if (!session?.userId)
        return res.status(401).json({ error: "not_authenticated" });
      const { galleryId } = req.params;

      try {
        const owns = await pool.query(
          `SELECT 1 FROM photographer_client_galleries
            WHERE id = $1 AND photographer_id = $2`,
          [galleryId, session.userId],
        );
        if ((owns.rowCount ?? 0) === 0) {
          return res.status(404).json({ error: "gallery_not_found" });
        }

        const versions = await pool.query<{
          id: string;
          version_label: string;
          version_order: number;
          is_published_to_client: boolean;
          published_at: string | null;
          notes: string | null;
          image_count: string | number;
        }>(
          `SELECT v.id, v.version_label, v.version_order,
                  v.is_published_to_client, v.published_at, v.notes,
                  (SELECT COUNT(*) FROM client_gallery_image_version_links l
                    WHERE l.version_id = v.id) AS image_count
             FROM client_gallery_image_versions v
            WHERE v.gallery_id = $1
            ORDER BY v.version_order DESC`,
          [galleryId],
        );
        const decisions = await pool.query<{
          version_id: string;
          decision: string;
          decision_note: string | null;
          decided_by_email: string;
          decided_by_label: string | null;
          decided_at: string;
        }>(
          `SELECT DISTINCT ON (version_id)
                  version_id, decision, decision_note, decided_by_email,
                  decided_by_label, decided_at
             FROM client_gallery_version_decisions
            WHERE version_id = ANY($1::uuid[])
            ORDER BY version_id, decided_at DESC`,
          [versions.rows.map((v) => v.id)],
        );
        const decisionByVersion = new Map(
          decisions.rows.map((d) => [d.version_id, d]),
        );
        res.json({
          success: true,
          versions: versions.rows.map((v) => ({
            id: v.id,
            label: v.version_label,
            order: v.version_order,
            isPublished: v.is_published_to_client,
            publishedAt: v.published_at,
            notes: v.notes,
            imageCount: Number(v.image_count),
            decision: decisionByVersion.get(v.id) ?? null,
          })),
        });
      } catch (err) {
        console.error("[gallery-versions] photographer list failed:", err);
        res.status(500).json({ error: "list_failed" });
      }
    },
  );

  // POST opprett versjon
  app.post(
    "/api/photographer/galleries/:galleryId/versions",
    async (req, res) => {
      const session = getActiveSessionFromRequest(req);
      if (!session?.userId)
        return res.status(401).json({ error: "not_authenticated" });
      const { galleryId } = req.params;
      const {
        versionLabel,
        versionOrder,
        notes,
        imageIds,
        publishImmediately,
      } = req.body || {};

      if (typeof versionLabel !== "string" || !versionLabel.trim()) {
        return res.status(400).json({ error: "missing_version_label" });
      }

      try {
        // Eierskap-sjekk
        const owns = await pool.query(
          `SELECT 1 FROM photographer_client_galleries
            WHERE id = $1 AND photographer_id = $2`,
          [galleryId, session.userId],
        );
        if ((owns.rowCount ?? 0) === 0) {
          return res.status(403).json({ error: "not_gallery_owner" });
        }

        // Hvis admin ikke spesifiserer imageIds — snapshot alle bilder i
        // galleriet. Dette er den vanlige workflowen: "marker dagens
        // tilstand som R1".
        let effectiveImageIds: string[];
        if (Array.isArray(imageIds) && imageIds.length > 0) {
          const owned = await pool.query<{ id: string }>(
            `SELECT id FROM client_gallery_images
              WHERE id = ANY($1::uuid[]) AND gallery_id = $2`,
            [imageIds, galleryId],
          );
          const ownedIds = new Set(owned.rows.map((r) => r.id));
          const missing = imageIds.filter((id: string) => !ownedIds.has(id));
          if (missing.length > 0) {
            return res
              .status(400)
              .json({ error: "image_not_in_gallery", missing });
          }
          effectiveImageIds = imageIds;
        } else {
          const all = await pool.query<{ id: string }>(
            `SELECT id FROM client_gallery_images WHERE gallery_id = $1`,
            [galleryId],
          );
          effectiveImageIds = all.rows.map((r) => r.id);
        }

        // Bestem versionOrder hvis ikke gitt: max+1
        let order =
          typeof versionOrder === "number" && versionOrder > 0
            ? Math.floor(versionOrder)
            : null;
        if (order === null) {
          const maxRes = await pool.query<{ max: string | number | null }>(
            `SELECT COALESCE(MAX(version_order), 0) AS max
               FROM client_gallery_image_versions
              WHERE gallery_id = $1`,
            [galleryId],
          );
          order = Number(maxRes.rows[0]?.max ?? 0) + 1;
        }

        const insertRes = await pool.query<{ id: string }>(
          `INSERT INTO client_gallery_image_versions
             (gallery_id, version_label, version_order, notes,
              is_published_to_client, published_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (gallery_id, version_label) DO UPDATE SET
             version_order = EXCLUDED.version_order,
             notes = EXCLUDED.notes,
             is_published_to_client = EXCLUDED.is_published_to_client,
             published_at = EXCLUDED.published_at,
             updated_at = now()
           RETURNING id`,
          [
            galleryId,
            versionLabel.trim(),
            order,
            typeof notes === "string" ? notes.slice(0, 5000) : null,
            publishImmediately === true,
            publishImmediately === true ? new Date().toISOString() : null,
          ],
        );
        const versionId = insertRes.rows[0].id;

        // Slett gamle lenker for versjonen + insert nye
        await pool.query(
          `DELETE FROM client_gallery_image_version_links WHERE version_id = $1`,
          [versionId],
        );
        for (let i = 0; i < effectiveImageIds.length; i++) {
          await pool.query(
            `INSERT INTO client_gallery_image_version_links
               (version_id, image_id, sort_order)
             VALUES ($1, $2, $3)
             ON CONFLICT DO NOTHING`,
            [versionId, effectiveImageIds[i], i],
          );
        }

        res.json({
          success: true,
          versionId,
          versionLabel: versionLabel.trim(),
          versionOrder: order,
          imageCount: effectiveImageIds.length,
          publishedToClient: publishImmediately === true,
        });
      } catch (err: any) {
        console.error("[gallery-versions] create failed:", err);
        res.status(500).json({
          error: "create_failed",
          message: String(err?.message || err).slice(0, 200),
        });
      }
    },
  );

  // PUT publiser/avpubliser
  app.put(
    "/api/photographer/galleries/:galleryId/versions/:versionId/visibility",
    async (req, res) => {
      const session = getActiveSessionFromRequest(req);
      if (!session?.userId)
        return res.status(401).json({ error: "not_authenticated" });
      const { galleryId, versionId } = req.params;
      const publish = req.body?.publish === true;

      try {
        const owns = await pool.query(
          `SELECT v.id
             FROM client_gallery_image_versions v
             JOIN photographer_client_galleries g
               ON g.id = v.gallery_id
            WHERE v.id = $1
              AND v.gallery_id = $2
              AND g.photographer_id = $3`,
          [versionId, galleryId, session.userId],
        );
        if ((owns.rowCount ?? 0) === 0) {
          return res.status(404).json({ error: "version_not_found" });
        }

        await pool.query(
          `UPDATE client_gallery_image_versions
              SET is_published_to_client = $2,
                  published_at = $3,
                  updated_at = now()
            WHERE id = $1`,
          [versionId, publish, publish ? new Date().toISOString() : null],
        );
        res.json({ success: true, publish });
      } catch (err) {
        console.error("[gallery-versions] visibility failed:", err);
        res.status(500).json({ error: "visibility_failed" });
      }
    },
  );

  // GET timeline (fotograf — full inkl. interne stages)
  app.get(
    "/api/photographer/galleries/:galleryId/timeline",
    async (req, res) => {
      const session = getActiveSessionFromRequest(req);
      if (!session?.userId)
        return res.status(401).json({ error: "not_authenticated" });
      const { galleryId } = req.params;

      try {
        const owns = await pool.query(
          `SELECT 1 FROM photographer_client_galleries
            WHERE id = $1 AND photographer_id = $2`,
          [galleryId, session.userId],
        );
        if ((owns.rowCount ?? 0) === 0) {
          return res.status(404).json({ error: "gallery_not_found" });
        }

        const milestones = await pool.query(
          `SELECT id, stage, stage_order, display_label, status,
                  estimated_at, started_at, completed_at, blocked_reason,
                  is_client_visible, metadata
             FROM client_delivery_milestones
            WHERE gallery_id = $1
            ORDER BY stage_order ASC`,
          [galleryId],
        );

        // Hent versjons-decisions-oversikt
        const versions = await pool.query(
          `SELECT v.id, v.version_label, v.version_order, v.is_published_to_client,
                  v.published_at,
                  (SELECT decision FROM client_gallery_version_decisions d
                    WHERE d.version_id = v.id
                    ORDER BY decided_at DESC LIMIT 1) AS latest_decision,
                  (SELECT decided_at FROM client_gallery_version_decisions d
                    WHERE d.version_id = v.id
                    ORDER BY decided_at DESC LIMIT 1) AS decided_at,
                  (SELECT decided_by_label FROM client_gallery_version_decisions d
                    WHERE d.version_id = v.id
                    ORDER BY decided_at DESC LIMIT 1) AS decided_by
             FROM client_gallery_image_versions v
            WHERE v.gallery_id = $1
            ORDER BY v.version_order DESC`,
          [galleryId],
        );

        res.json({
          success: true,
          milestones: milestones.rows.map((m: any) => ({
            id: m.id,
            stage: m.stage,
            order: m.stage_order,
            label: m.display_label,
            status: m.status,
            estimatedAt: m.estimated_at,
            startedAt: m.started_at,
            completedAt: m.completed_at,
            blockedReason: m.blocked_reason,
            isClientVisible: m.is_client_visible,
          })),
          versions: versions.rows,
        });
      } catch (err) {
        console.error("[gallery-versions] photographer timeline failed:", err);
        res.status(500).json({ error: "timeline_failed" });
      }
    },
  );

  // PUT oppdater milepæl
  app.put(
    "/api/photographer/galleries/:galleryId/timeline/:milestoneId",
    async (req, res) => {
      const session = getActiveSessionFromRequest(req);
      if (!session?.userId)
        return res.status(401).json({ error: "not_authenticated" });
      const { galleryId, milestoneId } = req.params;
      const { status, estimatedAt, displayLabel, blockedReason, isClientVisible } =
        req.body || {};

      try {
        const owns = await pool.query(
          `SELECT 1
             FROM client_delivery_milestones m
             JOIN photographer_client_galleries g
               ON g.id = m.gallery_id
            WHERE m.id = $1
              AND m.gallery_id = $2
              AND g.photographer_id = $3`,
          [milestoneId, galleryId, session.userId],
        );
        if ((owns.rowCount ?? 0) === 0) {
          return res.status(404).json({ error: "milestone_not_found" });
        }

        const updates: string[] = ["updated_at = now()"];
        const params: any[] = [milestoneId];
        let i = 2;
        if (typeof status === "string") {
          const valid = new Set([
            "pending",
            "in_progress",
            "completed",
            "blocked",
            "skipped",
          ]);
          if (!valid.has(status))
            return res.status(400).json({ error: "invalid_status" });
          updates.push(`status = $${i++}`);
          params.push(status);
          if (status === "completed") {
            updates.push(`completed_at = COALESCE(completed_at, now())`);
            updates.push(`blocked_reason = NULL`);
          }
          if (status === "in_progress") {
            updates.push(`started_at = COALESCE(started_at, now())`);
            updates.push(`completed_at = NULL`);
            updates.push(`blocked_reason = NULL`);
          }
        }
        if (estimatedAt === null) {
          updates.push(`estimated_at = NULL`);
        } else if (typeof estimatedAt === "string") {
          const d = new Date(estimatedAt);
          if (!Number.isFinite(d.getTime()))
            return res.status(400).json({ error: "invalid_estimated_at" });
          updates.push(`estimated_at = $${i++}`);
          params.push(d.toISOString());
        }
        if (typeof displayLabel === "string") {
          updates.push(`display_label = $${i++}`);
          params.push(displayLabel.slice(0, 200));
        }
        if (typeof blockedReason === "string" || blockedReason === null) {
          updates.push(`blocked_reason = $${i++}`);
          params.push(blockedReason);
        }
        if (typeof isClientVisible === "boolean") {
          updates.push(`is_client_visible = $${i++}`);
          params.push(isClientVisible);
        }

        if (updates.length === 1) {
          return res.status(400).json({ error: "no_changes" });
        }
        await pool.query(
          `UPDATE client_delivery_milestones SET ${updates.join(", ")} WHERE id = $1`,
          params,
        );
        res.json({ success: true });
      } catch (err) {
        console.error("[gallery-versions] milestone update failed:", err);
        res.status(500).json({ error: "update_failed" });
      }
    },
  );

  // POST seed standard timeline (12 stages)
  app.post(
    "/api/photographer/galleries/:galleryId/timeline/seed",
    async (req, res) => {
      const session = getActiveSessionFromRequest(req);
      if (!session?.userId)
        return res.status(401).json({ error: "not_authenticated" });
      const { galleryId } = req.params;

      try {
        const owns = await pool.query(
          `SELECT 1 FROM photographer_client_galleries
            WHERE id = $1 AND photographer_id = $2`,
          [galleryId, session.userId],
        );
        if ((owns.rowCount ?? 0) === 0) {
          return res.status(404).json({ error: "gallery_not_found" });
        }

        const r = await pool.query<{ seed_client_delivery_timeline: number }>(
          `SELECT seed_client_delivery_timeline($1::uuid)`,
          [galleryId],
        );
        const inserted = r.rows[0]?.seed_client_delivery_timeline ?? 0;
        res.json({ success: true, inserted });
      } catch (err) {
        console.error("[gallery-versions] seed failed:", err);
        res.status(500).json({ error: "seed_failed" });
      }
    },
  );
}

// Hjelper: når en versjon godkjennes, oppdater leveranse-timeline.
// R1 approved → marker r1_delivered + client_review som completed.
// R2 approved → r2_delivered + client_review = completed.
// Final approved → final_delivered = completed.
async function advanceTimelineOnApproval(
  pool: Pool,
  galleryId: string,
  versionLabel: string,
): Promise<void> {
  const lower = versionLabel.toLowerCase().trim();
  const completedStages: string[] = [];

  if (lower === "r1") completedStages.push("r1_delivered", "client_review");
  else if (lower === "r2") completedStages.push("r2_delivered", "client_review");
  else if (lower === "final") completedStages.push("final_delivered");

  for (const stage of completedStages) {
    await pool
      .query(
        `UPDATE client_delivery_milestones
            SET status = 'completed',
                completed_at = COALESCE(completed_at, now()),
                blocked_reason = NULL,
                updated_at = now()
          WHERE gallery_id = $1 AND stage = $2`,
        [galleryId, stage],
      )
      .catch(() => undefined);
  }
}
