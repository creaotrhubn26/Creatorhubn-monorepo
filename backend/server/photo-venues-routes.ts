/**
 * photo-venues-routes.ts
 *
 * Foto-lokasjons-API for Slice 9X.34. Stine får auto-oppslag fra timeline-
 * event sin location-tekst → fuzzy match mot katalogen → kontakt, pris,
 * åpningstider og regler.
 *
 * Endpoints:
 *   GET  /api/photo-venues/lookup?q=…    — fuzzy søk på navn/adresse/by
 *   GET  /api/photo-venues/:slug         — full venue-info
 *   GET  /api/photo-venues                — liste alle (admin/utforsk)
 */

import type express from "express";
import { PHOTO_VENUES_SEED } from "./photo-venues-catalog";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface PhotoVenuesRoutesDeps {
  app: express.Application;
  pool: any;
  getPricingUserId?: (req: any) => string;
  requireAdminSession?: (req: any, res: any) => any;
}

// Felter som faktisk er tillatt å sette via contribution (whitelist).
// Hindrer at en bidragsyter kan sette is_active, last_verified_at, etc.
const CONTRIBUTABLE_FIELDS: Array<{ key: string; col: string; type: "text" | "bool" | "number" | "jsonb" }> = [
  { key: "name", col: "name", type: "text" },
  { key: "venueType", col: "venue_type", type: "text" },
  { key: "address", col: "address", type: "text" },
  { key: "city", col: "city", type: "text" },
  { key: "postalCode", col: "postal_code", type: "text" },
  { key: "county", col: "county", type: "text" },
  { key: "latitude", col: "latitude", type: "number" },
  { key: "longitude", col: "longitude", type: "number" },
  { key: "contactName", col: "contact_name", type: "text" },
  { key: "contactEmail", col: "contact_email", type: "text" },
  { key: "contactPhone", col: "contact_phone", type: "text" },
  { key: "websiteUrl", col: "website_url", type: "text" },
  { key: "bookingUrl", col: "booking_url", type: "text" },
  { key: "requiresBooking", col: "requires_booking", type: "bool" },
  { key: "requiresPermit", col: "requires_permit", type: "bool" },
  { key: "feeKr", col: "fee_kr", type: "number" },
  { key: "feeUnit", col: "fee_unit", type: "text" },
  { key: "openingHours", col: "opening_hours", type: "jsonb" },
  { key: "restrictionsText", col: "restrictions_text", type: "text" },
  { key: "photographerNotes", col: "photographer_notes", type: "text" },
  { key: "sourceUrl", col: "source_url", type: "text" },
];

function sanitizeProposedData(raw: any): Record<string, any> {
  const out: Record<string, any> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const f of CONTRIBUTABLE_FIELDS) {
    if (!(f.key in raw)) continue;
    const v = raw[f.key];
    if (v === null || v === "") {
      out[f.key] = null;
      continue;
    }
    switch (f.type) {
      case "text":
        if (typeof v === "string") out[f.key] = v.trim();
        break;
      case "bool":
        out[f.key] = Boolean(v);
        break;
      case "number":
        if (typeof v === "number" && Number.isFinite(v)) out[f.key] = v;
        else if (typeof v === "string") {
          const n = parseFloat(v.replace(",", "."));
          if (Number.isFinite(n)) out[f.key] = n;
        }
        break;
      case "jsonb":
        if (typeof v === "object") out[f.key] = v;
        break;
    }
  }
  return out;
}

async function ensureContributionsSchema(pool: any): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS photo_venue_contributions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      contributor_user_id TEXT NOT NULL,
      contributor_email TEXT,
      contributor_name TEXT,
      proposal_kind TEXT NOT NULL CHECK (proposal_kind IN ('new', 'diff')),
      target_venue_id UUID,
      proposed_data JSONB NOT NULL,
      contributor_note TEXT,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
      admin_note TEXT,
      reviewed_by TEXT,
      reviewed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_venue_contributions_status ON photo_venue_contributions (status, created_at DESC)`,
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_venue_contributions_contributor ON photo_venue_contributions (contributor_user_id, created_at DESC)`,
  );
}

function rowToContribution(r: any): any {
  return {
    id: r.id,
    contributorUserId: r.contributor_user_id,
    contributorEmail: r.contributor_email,
    contributorName: r.contributor_name,
    proposalKind: r.proposal_kind,
    targetVenueId: r.target_venue_id,
    targetVenueName: r.target_venue_name,
    proposedData: r.proposed_data,
    contributorNote: r.contributor_note,
    status: r.status,
    adminNote: r.admin_note,
    reviewedBy: r.reviewed_by,
    reviewedAt: r.reviewed_at,
    createdAt: r.created_at,
  };
}

async function ensureSchema(pool: any): Promise<void> {
  // CREATE EXTENSION må kjøres separat (krever superuser i Neon — er
  // forhåndsaktivert der). Vi gjør det best-effort.
  await pool.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`).catch(() => undefined);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS photo_venues (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      venue_type TEXT,
      address TEXT,
      city TEXT,
      postal_code TEXT,
      county TEXT,
      latitude NUMERIC(10,7),
      longitude NUMERIC(10,7),
      contact_name TEXT,
      contact_email TEXT,
      contact_phone TEXT,
      website_url TEXT,
      booking_url TEXT,
      requires_booking BOOLEAN DEFAULT FALSE,
      requires_permit BOOLEAN DEFAULT FALSE,
      fee_kr NUMERIC(10,2),
      fee_unit TEXT,
      opening_hours JSONB,
      restrictions_text TEXT,
      photographer_notes TEXT,
      last_verified_at TIMESTAMPTZ,
      verified_by TEXT,
      source_url TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

async function seedIfEmpty(pool: any): Promise<void> {
  const count = await pool.query(`SELECT COUNT(*)::int AS n FROM photo_venues`);
  if ((count.rows[0]?.n ?? 0) > 0) return;
  for (const v of PHOTO_VENUES_SEED) {
    await pool.query(
      `INSERT INTO photo_venues
         (slug, name, venue_type, address, city, postal_code, county,
          latitude, longitude, contact_name, contact_email, contact_phone,
          website_url, booking_url, requires_booking, requires_permit,
          fee_kr, fee_unit, opening_hours, restrictions_text,
          photographer_notes, last_verified_at, source_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,
               $19::jsonb,$20,$21,NOW(),$22)
       ON CONFLICT (slug) DO NOTHING`,
      [
        v.slug,
        v.name,
        v.venueType,
        v.address ?? null,
        v.city ?? null,
        v.postalCode ?? null,
        v.county ?? null,
        v.latitude ?? null,
        v.longitude ?? null,
        v.contactName ?? null,
        v.contactEmail ?? null,
        v.contactPhone ?? null,
        v.websiteUrl ?? null,
        v.bookingUrl ?? null,
        v.requiresBooking,
        v.requiresPermit,
        v.feeKr ?? null,
        v.feeUnit ?? null,
        v.openingHours ? JSON.stringify(v.openingHours) : null,
        v.restrictionsText ?? null,
        v.photographerNotes ?? null,
        v.sourceUrl ?? null,
      ],
    );
  }
}

function rowToVenue(r: any): any {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    venueType: r.venue_type,
    address: r.address,
    city: r.city,
    postalCode: r.postal_code,
    county: r.county,
    latitude: r.latitude != null ? Number(r.latitude) : null,
    longitude: r.longitude != null ? Number(r.longitude) : null,
    contactName: r.contact_name,
    contactEmail: r.contact_email,
    contactPhone: r.contact_phone,
    websiteUrl: r.website_url,
    bookingUrl: r.booking_url,
    requiresBooking: !!r.requires_booking,
    requiresPermit: !!r.requires_permit,
    feeKr: r.fee_kr != null ? Number(r.fee_kr) : null,
    feeUnit: r.fee_unit,
    openingHours: r.opening_hours,
    restrictionsText: r.restrictions_text,
    photographerNotes: r.photographer_notes,
    lastVerifiedAt: r.last_verified_at,
    sourceUrl: r.source_url,
  };
}

export function setupPhotoVenuesRoutes(deps: PhotoVenuesRoutesDeps): void {
  const { app, pool, getPricingUserId, requireAdminSession } = deps;
  let initialized = false;
  const init = async () => {
    if (initialized) return;
    await ensureSchema(pool);
    await ensureContributionsSchema(pool).catch((err) =>
      console.warn("[photo-venues] contributions schema feilet:", err),
    );
    await seedIfEmpty(pool).catch((err) => {
      console.warn("[photo-venues] seed feilet:", err);
    });
    initialized = true;
  };

  // ─── GET /api/photo-venues ──────────────────────────────────────
  app.get("/api/photo-venues", async (_req, res) => {
    try {
      await init();
      const r = await pool.query(
        `SELECT * FROM photo_venues WHERE is_active = TRUE ORDER BY name ASC`,
      );
      res.json({ venues: r.rows.map(rowToVenue) });
    } catch (err) {
      console.error("GET /api/photo-venues:", err);
      res.status(500).json({ error: "Kunne ikke hente lokasjoner" });
    }
  });

  // ─── GET /api/photo-venues/lookup?q=… ──────────────────────────
  // Fuzzy search for å matche Stines location-tekst på event mot katalogen.
  app.get("/api/photo-venues/lookup", async (req, res) => {
    try {
      await init();
      const q = String(req.query.q || "").trim();
      if (!q) return res.json({ matches: [] });

      // Bruk trigram-similaritet hvis pg_trgm finnes, ellers fallback til ILIKE
      let rows: any[] = [];
      try {
        const r = await pool.query(
          `SELECT *, GREATEST(
              similarity(LOWER(name), LOWER($1)),
              similarity(LOWER(COALESCE(address, '')), LOWER($1)),
              similarity(LOWER(COALESCE(city, '')), LOWER($1))
            ) AS sim
           FROM photo_venues
           WHERE is_active = TRUE
             AND (
               LOWER(name) % LOWER($1)
               OR LOWER(COALESCE(address, '')) % LOWER($1)
               OR LOWER(COALESCE(city, '')) % LOWER($1)
               OR name ILIKE '%' || $1 || '%'
               OR address ILIKE '%' || $1 || '%'
             )
           ORDER BY sim DESC NULLS LAST
           LIMIT 5`,
          [q],
        );
        rows = r.rows;
      } catch {
        // Fallback uten pg_trgm
        const r = await pool.query(
          `SELECT * FROM photo_venues
             WHERE is_active = TRUE
               AND (name ILIKE '%' || $1 || '%'
                    OR address ILIKE '%' || $1 || '%'
                    OR city ILIKE '%' || $1 || '%')
             LIMIT 5`,
          [q],
        );
        rows = r.rows;
      }
      res.json({ matches: rows.map(rowToVenue), query: q });
    } catch (err) {
      console.error("GET /api/photo-venues/lookup:", err);
      res.status(500).json({ error: "Kunne ikke søke etter lokasjon" });
    }
  });

  // ─── GET /api/photo-venues/:slug ───────────────────────────────
  app.get("/api/photo-venues/:slug", async (req, res) => {
    try {
      await init();
      const r = await pool.query(
        `SELECT * FROM photo_venues WHERE slug = $1 AND is_active = TRUE LIMIT 1`,
        [req.params.slug],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "Ikke funnet" });
      res.json({ venue: rowToVenue(r.rows[0]) });
    } catch (err) {
      console.error("GET /api/photo-venues/:slug:", err);
      res.status(500).json({ error: "Kunne ikke hente lokasjon" });
    }
  });

  // ─── POST /api/photo-venues/contributions ──────────────────────
  // Stine submitter forslag: ny venue ELLER diff på eksisterende.
  app.post("/api/photo-venues/contributions", async (req, res) => {
    try {
      await init();
      const uid = getPricingUserId ? getPricingUserId(req) : (req.headers["x-user-id"] as string) || "";
      if (!uid) return res.status(401).json({ error: "Mangler bruker-ID" });

      const kind = String(req.body?.proposalKind || "").trim();
      if (kind !== "new" && kind !== "diff") {
        return res.status(400).json({ error: "Ugyldig proposalKind (forventer 'new' eller 'diff')" });
      }
      const targetVenueId = req.body?.targetVenueId || null;
      if (kind === "diff" && !targetVenueId) {
        return res.status(400).json({ error: "diff krever targetVenueId" });
      }
      const proposed = sanitizeProposedData(req.body?.proposedData);
      if (Object.keys(proposed).length === 0) {
        return res.status(400).json({ error: "Ingen gyldige felter foreslått" });
      }
      if (kind === "new" && !proposed.name) {
        return res.status(400).json({ error: "Navn er påkrevd for ny venue" });
      }

      const email = (req.headers["x-user-email"] as string) || null;
      const contributorNote = typeof req.body?.contributorNote === "string"
        ? req.body.contributorNote.trim().slice(0, 1000)
        : null;

      const r = await pool.query(
        `INSERT INTO photo_venue_contributions
           (contributor_user_id, contributor_email, proposal_kind,
            target_venue_id, proposed_data, contributor_note, status)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, 'pending')
         RETURNING *`,
        [uid, email, kind, targetVenueId, JSON.stringify(proposed), contributorNote],
      );
      res.status(201).json({ contribution: rowToContribution(r.rows[0]) });
    } catch (err) {
      console.error("POST /api/photo-venues/contributions:", err);
      res.status(500).json({ error: "Kunne ikke lagre bidrag" });
    }
  });

  // ─── GET /api/photo-venues/contributions/mine ──────────────────
  app.get("/api/photo-venues/contributions/mine", async (req, res) => {
    try {
      await init();
      const uid = getPricingUserId ? getPricingUserId(req) : (req.headers["x-user-id"] as string) || "";
      if (!uid) return res.status(401).json({ error: "Mangler bruker-ID" });
      const r = await pool.query(
        `SELECT c.*, v.name AS target_venue_name
           FROM photo_venue_contributions c
           LEFT JOIN photo_venues v ON v.id = c.target_venue_id
           WHERE c.contributor_user_id = $1
           ORDER BY c.created_at DESC
           LIMIT 100`,
        [uid],
      );
      res.json({ contributions: r.rows.map(rowToContribution) });
    } catch (err) {
      console.error("GET /api/photo-venues/contributions/mine:", err);
      res.status(500).json({ error: "Kunne ikke hente bidrag" });
    }
  });

  // ─── GET /api/admin/photo-venues/contributions ────────────────
  app.get("/api/admin/photo-venues/contributions", async (req, res) => {
    if (requireAdminSession && !requireAdminSession(req, res)) return;
    try {
      await init();
      const status = String(req.query.status || "pending");
      const r = await pool.query(
        `SELECT c.*, v.name AS target_venue_name
           FROM photo_venue_contributions c
           LEFT JOIN photo_venues v ON v.id = c.target_venue_id
           WHERE ($1 = 'all' OR c.status = $1)
           ORDER BY c.created_at DESC
           LIMIT 200`,
        [status],
      );
      res.json({ contributions: r.rows.map(rowToContribution) });
    } catch (err) {
      console.error("GET /api/admin/photo-venues/contributions:", err);
      res.status(500).json({ error: "Kunne ikke hente bidrag" });
    }
  });

  // ─── POST /api/admin/photo-venues/contributions/:id/approve ───
  // Applier diff til photo_venues. For 'new': lager ny venue med slug
  // generert fra name. For 'diff': UPDATE photo_venues SET ... WHERE id=.
  app.post("/api/admin/photo-venues/contributions/:id/approve", async (req, res) => {
    if (requireAdminSession && !requireAdminSession(req, res)) return;
    try {
      await init();
      const adminNote = typeof req.body?.adminNote === "string" ? req.body.adminNote.slice(0, 1000) : null;
      const reviewerId = (req as any).adminSession?.userId || (req.headers["x-user-id"] as string) || "admin";

      const cr = await pool.query(
        `SELECT * FROM photo_venue_contributions WHERE id = $1 AND status = 'pending' LIMIT 1`,
        [req.params.id],
      );
      if (cr.rowCount === 0) return res.status(404).json({ error: "Bidrag finnes ikke eller er ikke pending" });
      const contribution = cr.rows[0];
      const proposed = contribution.proposed_data || {};

      if (contribution.proposal_kind === "new") {
        const baseSlug = String(proposed.name || "venue")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .replace(/[æå]/g, "a")
          .replace(/ø/g, "o")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "")
          .slice(0, 60) || "venue";
        // Sikre unik slug
        let slug = baseSlug;
        for (let i = 2; i < 100; i++) {
          const exists = await pool.query(`SELECT 1 FROM photo_venues WHERE slug = $1`, [slug]);
          if (exists.rowCount === 0) break;
          slug = `${baseSlug}-${i}`;
        }

        const cols = ["slug"];
        const vals: any[] = [slug];
        const placeholders = ["$1"];
        for (const f of CONTRIBUTABLE_FIELDS) {
          if (proposed[f.key] === undefined) continue;
          cols.push(f.col);
          vals.push(f.type === "jsonb" ? JSON.stringify(proposed[f.key]) : proposed[f.key]);
          placeholders.push(`$${vals.length}${f.type === "jsonb" ? "::jsonb" : ""}`);
        }
        cols.push("last_verified_at", "verified_by");
        vals.push(new Date(), reviewerId);
        placeholders.push(`$${vals.length - 1}`, `$${vals.length}`);

        const ins = await pool.query(
          `INSERT INTO photo_venues (${cols.join(", ")}) VALUES (${placeholders.join(", ")}) RETURNING *`,
          vals,
        );
        await pool.query(
          `UPDATE photo_venue_contributions SET
             status = 'approved', admin_note = $1, reviewed_by = $2, reviewed_at = NOW(),
             target_venue_id = $3, updated_at = NOW()
           WHERE id = $4`,
          [adminNote, reviewerId, ins.rows[0].id, contribution.id],
        );
        return res.json({ contribution: { ...rowToContribution(contribution), status: "approved", targetVenueId: ins.rows[0].id }, venue: rowToVenue(ins.rows[0]) });
      }

      // 'diff' — applier endringer på eksisterende venue
      const setClauses: string[] = [];
      const setVals: any[] = [];
      for (const f of CONTRIBUTABLE_FIELDS) {
        if (proposed[f.key] === undefined) continue;
        setVals.push(f.type === "jsonb" ? JSON.stringify(proposed[f.key]) : proposed[f.key]);
        setClauses.push(`${f.col} = $${setVals.length}${f.type === "jsonb" ? "::jsonb" : ""}`);
      }
      if (setClauses.length === 0) return res.status(400).json({ error: "Tomt diff" });
      setVals.push(new Date(), reviewerId);
      setClauses.push(`last_verified_at = $${setVals.length - 1}`, `verified_by = $${setVals.length}`);
      setVals.push(contribution.target_venue_id);

      const upd = await pool.query(
        `UPDATE photo_venues SET ${setClauses.join(", ")}, updated_at = NOW()
           WHERE id = $${setVals.length} RETURNING *`,
        setVals,
      );
      if (upd.rowCount === 0) return res.status(404).json({ error: "Target venue finnes ikke" });

      await pool.query(
        `UPDATE photo_venue_contributions SET
           status = 'approved', admin_note = $1, reviewed_by = $2, reviewed_at = NOW(), updated_at = NOW()
         WHERE id = $3`,
        [adminNote, reviewerId, contribution.id],
      );
      res.json({
        contribution: { ...rowToContribution(contribution), status: "approved" },
        venue: rowToVenue(upd.rows[0]),
      });
    } catch (err) {
      console.error("POST /approve:", err);
      res.status(500).json({ error: "Kunne ikke godkjenne bidrag" });
    }
  });

  // ─── POST /api/admin/photo-venues/contributions/:id/reject ────
  app.post("/api/admin/photo-venues/contributions/:id/reject", async (req, res) => {
    if (requireAdminSession && !requireAdminSession(req, res)) return;
    try {
      await init();
      const adminNote = typeof req.body?.adminNote === "string" ? req.body.adminNote.slice(0, 1000) : null;
      const reviewerId = (req as any).adminSession?.userId || (req.headers["x-user-id"] as string) || "admin";
      const r = await pool.query(
        `UPDATE photo_venue_contributions SET
           status = 'rejected', admin_note = $1, reviewed_by = $2, reviewed_at = NOW(), updated_at = NOW()
         WHERE id = $3 AND status = 'pending' RETURNING *`,
        [adminNote, reviewerId, req.params.id],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "Bidrag finnes ikke eller er ikke pending" });
      res.json({ contribution: rowToContribution(r.rows[0]) });
    } catch (err) {
      console.error("POST /reject:", err);
      res.status(500).json({ error: "Kunne ikke avslå bidrag" });
    }
  });
}
