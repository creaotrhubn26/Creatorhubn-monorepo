/**
 * wedding-gallery-delivery-routes.ts
 *
 * Slice 9X.42 — Galleri-leveringsflyt:
 *
 *   GET  /api/wedding/:weddingId/gallery-delivery
 *   PUT  /api/wedding/:weddingId/gallery-delivery
 *        { deadlineAt, galleryId?, status?, notes? }
 *   POST /api/wedding/:weddingId/gallery-delivery/mark-proof-sent
 *   POST /api/wedding/:weddingId/gallery-delivery/mark-delivered
 *   GET  /api/wedding/:weddingId/gallery/favorites — proxy til
 *        client_image_selections der selection_type='favorite' for å gi
 *        Stine raskt overblikk hvilke bilder brudeparet har valgt.
 */

import type express from "express";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface WeddingGalleryDeliveryRoutesDeps {
  app: express.Application;
  pool: any;
  requireUserSession: (req: any, res: any) => any;
  getPricingUserId: (req: any) => string;
}

async function ensureSchema(pool: any): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS wedding_gallery_deliveries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      wedding_id VARCHAR(64) NOT NULL,
      photographer_id TEXT NOT NULL,
      gallery_id TEXT,
      deadline_at TIMESTAMPTZ NOT NULL,
      delivered_at TIMESTAMPTZ,
      reminder_sent_at TIMESTAMPTZ,
      status TEXT NOT NULL DEFAULT 'pending',
      proof_sent_at TIMESTAMPTZ,
      selection_completed_at TIMESTAMPTZ,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(() => undefined);
  await pool.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_wedding_gallery_delivery_unique
       ON wedding_gallery_deliveries (wedding_id, photographer_id)`,
  ).catch(() => undefined);
}

function rowToDelivery(r: any): any {
  return {
    id: r.id,
    weddingId: r.wedding_id,
    galleryId: r.gallery_id,
    deadlineAt: r.deadline_at,
    deliveredAt: r.delivered_at,
    proofSentAt: r.proof_sent_at,
    selectionCompletedAt: r.selection_completed_at,
    status: r.status,
    notes: r.notes,
    daysUntilDeadline: r.deadline_at
      ? Math.ceil((new Date(r.deadline_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null,
  };
}

export function setupWeddingGalleryDeliveryRoutes(deps: WeddingGalleryDeliveryRoutesDeps): void {
  const { app, pool, requireUserSession, getPricingUserId } = deps;

  // ─── GET /api/wedding/:weddingId/gallery-delivery ──────────────
  app.get("/api/wedding/:weddingId/gallery-delivery", async (req, res) => {
    try {
      await ensureSchema(pool);
      const uid = getPricingUserId(req);
      if (!uid) return res.status(401).json({ error: "Mangler bruker-ID" });
      const r = await pool.query(
        `SELECT * FROM wedding_gallery_deliveries
           WHERE wedding_id = $1 AND photographer_id = $2 LIMIT 1`,
        [req.params.weddingId, uid],
      );
      if (r.rowCount === 0) return res.json({ delivery: null });
      res.json({ delivery: rowToDelivery(r.rows[0]) });
    } catch (err) {
      console.error("GET /gallery-delivery:", err);
      res.status(500).json({ error: "Kunne ikke hente leveranse-status" });
    }
  });

  // ─── PUT /api/wedding/:weddingId/gallery-delivery ─────────────
  // Upsert: setter deadline, valgfri gallery_id-kobling, valgfri status-override
  app.put("/api/wedding/:weddingId/gallery-delivery", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      await ensureSchema(pool);
      const uid = getPricingUserId(req);
      if (!uid) return res.status(401).json({ error: "Mangler bruker-ID" });
      const { deadlineAt, galleryId, status, notes } = req.body || {};
      if (!deadlineAt) return res.status(400).json({ error: "deadlineAt påkrevd" });
      const r = await pool.query(
        `INSERT INTO wedding_gallery_deliveries
           (wedding_id, photographer_id, gallery_id, deadline_at, status, notes)
         VALUES ($1, $2, $3, $4::timestamptz, COALESCE($5, 'pending'), $6)
         ON CONFLICT (wedding_id, photographer_id) DO UPDATE SET
           gallery_id = COALESCE(EXCLUDED.gallery_id, wedding_gallery_deliveries.gallery_id),
           deadline_at = EXCLUDED.deadline_at,
           status = COALESCE(EXCLUDED.status, wedding_gallery_deliveries.status),
           notes = COALESCE(EXCLUDED.notes, wedding_gallery_deliveries.notes),
           updated_at = NOW()
         RETURNING *`,
        [req.params.weddingId, uid, galleryId || null, deadlineAt, status || null, notes || null],
      );
      res.json({ delivery: rowToDelivery(r.rows[0]) });
    } catch (err) {
      console.error("PUT /gallery-delivery:", err);
      res.status(500).json({ error: "Kunne ikke lagre" });
    }
  });

  // ─── POST .../mark-proof-sent ──────────────────────────────────
  app.post("/api/wedding/:weddingId/gallery-delivery/mark-proof-sent", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      await ensureSchema(pool);
      const uid = getPricingUserId(req);
      if (!uid) return res.status(401).json({ error: "Mangler bruker-ID" });
      const r = await pool.query(
        `UPDATE wedding_gallery_deliveries
           SET status = 'proof_sent', proof_sent_at = NOW(), updated_at = NOW()
           WHERE wedding_id = $1 AND photographer_id = $2
         RETURNING *`,
        [req.params.weddingId, uid],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "Sett deadline først" });
      res.json({ delivery: rowToDelivery(r.rows[0]) });
    } catch (err) {
      console.error("POST /mark-proof-sent:", err);
      res.status(500).json({ error: "Kunne ikke markere" });
    }
  });

  // ─── POST .../mark-delivered ───────────────────────────────────
  app.post("/api/wedding/:weddingId/gallery-delivery/mark-delivered", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      await ensureSchema(pool);
      const uid = getPricingUserId(req);
      if (!uid) return res.status(401).json({ error: "Mangler bruker-ID" });
      const r = await pool.query(
        `UPDATE wedding_gallery_deliveries
           SET status = 'delivered', delivered_at = NOW(), updated_at = NOW()
           WHERE wedding_id = $1 AND photographer_id = $2
         RETURNING *`,
        [req.params.weddingId, uid],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "Sett deadline først" });
      res.json({ delivery: rowToDelivery(r.rows[0]) });
    } catch (err) {
      console.error("POST /mark-delivered:", err);
      res.status(500).json({ error: "Kunne ikke markere" });
    }
  });

  // ─── GET .../gallery/favorites ─────────────────────────────────
  // Brudeparet sine favorite-selections så Stine kan filtrere på
  // "kun favoritter" og bare bearbeide de bildene.
  app.get("/api/wedding/:weddingId/gallery/favorites", async (req, res) => {
    try {
      const uid = getPricingUserId(req);
      if (!uid) return res.status(401).json({ error: "Mangler bruker-ID" });
      const galleryR = await pool.query(
        `SELECT gallery_id FROM wedding_gallery_deliveries
           WHERE wedding_id = $1 AND photographer_id = $2 LIMIT 1`,
        [req.params.weddingId, uid],
      );
      const galleryId = galleryR.rows[0]?.gallery_id;
      if (!galleryId) return res.json({ favorites: [], note: "Ingen galleri koblet til bryllupet ennå." });

      const r = await pool.query(
        `SELECT image_id, client_email, priority, client_notes, updated_at
           FROM client_image_selections
           WHERE gallery_id = $1 AND selection_type = 'favorite'
           ORDER BY priority DESC NULLS LAST, updated_at DESC`,
        [galleryId],
      );
      res.json({
        favorites: r.rows.map((row: any) => ({
          imageId: row.image_id,
          clientEmail: row.client_email,
          priority: row.priority,
          clientNotes: row.client_notes,
          markedAt: row.updated_at,
        })),
        total: r.rowCount,
      });
    } catch (err) {
      console.error("GET /gallery/favorites:", err);
      res.status(500).json({ error: "Kunne ikke hente favoritter" });
    }
  });
}
