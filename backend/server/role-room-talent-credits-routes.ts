/**
 * role-room-talent-credits-routes.ts
 *
 * Krediteringene i skuespiller-CV-en: rolle, produksjon, regissør, år.
 *
 *   GET    /api/role-room/talents/me/credits
 *   POST   /api/role-room/talents/me/credits
 *   PATCH  /api/role-room/talents/me/credits/:id
 *   DELETE /api/role-room/talents/me/credits/:id
 *   GET    /api/role-room/talents/credits/suggest?field=…&q=…
 *
 * Alt er eier-scopet: hver spørring går via talents.owner_user_id, aldri via
 * credit-id alene. Ellers ville en gjettet UUID gitt tilgang til en annen
 * skuespillers CV.
 *
 * Skjema: migrasjon 0611 (talent_credits).
 */

import type express from "express";
import type { Pool } from "pg";

interface SessionLike {
  userId: string;
  email?: string;
}

export interface RoleRoomTalentCreditsRoutesDeps {
  app: express.Application;
  pool: Pool;
  getActiveSession: (req: express.Request) => SessionLike | null;
}

const CATEGORIES = new Set(["film_tv", "theatre", "commercial", "voice", "other"]);
const ROLE_TYPES = new Set(["lead", "supporting", "featured", "ensemble", "voice", "extra"]);

/** Felter skuespilleren selv kan skrive. */
const EDITABLE = [
  "category",
  "title",
  "role_name",
  "role_type",
  "production_company",
  "production_org_number",
  "director",
  "format",
  "year",
  "sort_order",
  "notes",
  "external_url",
] as const;

const MAX_TEXT = 255;
const MAX_NOTES = 2000;
const MAX_CREDITS = 300;

function text(value: unknown, max = MAX_TEXT): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function year(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n)) return null;
  // Film er ikke eldre enn 1888, og en kreditering kan gjelde noe som er
  // annonsert et par år fram i tid.
  if (n < 1888 || n > new Date().getFullYear() + 5) return null;
  return n;
}

function cleanPatch(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of EDITABLE) {
    if (!(field in body)) continue;
    const raw = body[field];
    if (field === "year" || field === "sort_order") {
      out[field] = field === "year" ? year(raw) : (Number.isFinite(Number(raw)) ? Number(raw) : null);
    } else if (field === "category") {
      const value = text(raw, 30);
      out[field] = value && CATEGORIES.has(value) ? value : "film_tv";
    } else if (field === "role_type") {
      const value = text(raw, 40)?.toLowerCase() ?? null;
      out[field] = value && ROLE_TYPES.has(value) ? value : null;
    } else if (field === "notes") {
      out[field] = text(raw, MAX_NOTES);
    } else if (field === "external_url") {
      const value = text(raw, 2000);
      out[field] = value && /^https?:\/\//i.test(value) ? value : null;
    } else {
      out[field] = text(raw);
    }
  }
  return out;
}

export function setupRoleRoomTalentCreditsRoutes(
  deps: RoleRoomTalentCreditsRoutesDeps,
): void {
  const { app, pool, getActiveSession } = deps;

  /** Talent-raden for den innloggede brukeren, eller null. */
  async function ownTalentId(req: express.Request): Promise<string | null> {
    const session = getActiveSession(req);
    if (!session?.userId) return null;
    const r = await pool.query(
      `SELECT id FROM talents WHERE owner_user_id = $1 LIMIT 1`,
      [session.userId],
    );
    return r.rows[0]?.id ?? null;
  }

  // ── GET /me/credits ─────────────────────────────────────────────────
  app.get("/api/role-room/talents/me/credits", async (req, res) => {
    const talentId = await ownTalentId(req);
    if (!talentId) return res.status(401).json({ error: "Innlogging kreves" });
    try {
      const r = await pool.query(
        `SELECT * FROM talent_credits
          WHERE talent_id = $1
          ORDER BY sort_order ASC NULLS LAST, year DESC NULLS LAST, created_at DESC`,
        [talentId],
      );
      return res.json({ credits: r.rows });
    } catch (err) {
      console.error("[talents/credits GET] failed", err);
      return res.status(500).json({ error: "Klarte ikke å hente krediteringer" });
    }
  });

  // ── POST /me/credits ────────────────────────────────────────────────
  app.post("/api/role-room/talents/me/credits", async (req, res) => {
    const talentId = await ownTalentId(req);
    if (!talentId) return res.status(401).json({ error: "Innlogging kreves" });

    const patch = cleanPatch((req.body || {}) as Record<string, unknown>);
    if (!patch.title) return res.status(400).json({ error: "Tittel er påkrevd" });

    try {
      const count = await pool.query(
        `SELECT COUNT(*)::int AS n FROM talent_credits WHERE talent_id = $1`,
        [talentId],
      );
      if ((count.rows[0]?.n ?? 0) >= MAX_CREDITS) {
        return res.status(400).json({ error: "Maks 300 krediteringer" });
      }

      const cols = ["talent_id", ...Object.keys(patch)];
      const vals = [talentId, ...Object.values(patch)];
      const placeholders = vals.map((_, i) => `$${i + 1}`).join(", ");
      const r = await pool.query(
        `INSERT INTO talent_credits (${cols.join(", ")}) VALUES (${placeholders}) RETURNING *`,
        vals,
      );
      return res.status(201).json({ credit: r.rows[0] });
    } catch (err) {
      console.error("[talents/credits POST] failed", err);
      return res.status(500).json({ error: "Klarte ikke å lagre krediteringen" });
    }
  });

  // ── PATCH /me/credits/:id ───────────────────────────────────────────
  app.patch("/api/role-room/talents/me/credits/:id", async (req, res) => {
    const talentId = await ownTalentId(req);
    if (!talentId) return res.status(401).json({ error: "Innlogging kreves" });

    const patch = cleanPatch((req.body || {}) as Record<string, unknown>);
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: "Ingen felter å oppdatere" });
    }

    try {
      const sets = Object.keys(patch).map((c, i) => `${c} = $${i + 3}`);
      // talent_id i WHERE er eierskapssjekken — en gjettet credit-id treffer
      // aldri en annen skuespillers rad.
      const r = await pool.query(
        `UPDATE talent_credits SET ${sets.join(", ")}, updated_at = NOW()
          WHERE id = $1 AND talent_id = $2
          RETURNING *`,
        [req.params.id, talentId, ...Object.values(patch)],
      );
      if (!r.rowCount) return res.status(404).json({ error: "Kreditering ikke funnet" });
      return res.json({ credit: r.rows[0] });
    } catch (err) {
      console.error("[talents/credits PATCH] failed", err);
      return res.status(500).json({ error: "Klarte ikke å oppdatere krediteringen" });
    }
  });

  // ── DELETE /me/credits/:id ──────────────────────────────────────────
  app.delete("/api/role-room/talents/me/credits/:id", async (req, res) => {
    const talentId = await ownTalentId(req);
    if (!talentId) return res.status(401).json({ error: "Innlogging kreves" });
    try {
      const r = await pool.query(
        `DELETE FROM talent_credits WHERE id = $1 AND talent_id = $2`,
        [req.params.id, talentId],
      );
      if (!r.rowCount) return res.status(404).json({ error: "Kreditering ikke funnet" });
      return res.json({ ok: true });
    } catch (err) {
      console.error("[talents/credits DELETE] failed", err);
      return res.status(500).json({ error: "Klarte ikke å slette krediteringen" });
    }
  });

  // ── GET /credits/suggest — autocomplete fra eksisterende data ───────
  //
  // Produksjoner, produksjonsselskaper og regissører som allerede står i
  // registeret. Uten dette får vi sju stavemåter av «Nationaltheatret», og da
  // er feltet verdiløst å filtrere på.
  //
  // Returnerer KUN verdier som forekommer hos minst to ulike talents, eller
  // hos innloggede selv. Ellers kunne søket brukes til å lese ut en enkelt
  // skuespillers krediteringer uten samtykke.
  app.get("/api/role-room/talents/credits/suggest", async (req, res) => {
    const talentId = await ownTalentId(req);
    if (!talentId) return res.status(401).json({ error: "Innlogging kreves" });

    const field = String(req.query.field || "title");
    const column =
      field === "production_company"
        ? "production_company"
        : field === "director"
          ? "director"
          : "title";
    const q = text(req.query.q, 120);
    if (!q || q.length < 2) return res.json({ suggestions: [] });

    try {
      const r = await pool.query(
        `SELECT value, COUNT(DISTINCT talent_id)::int AS talents
           FROM (
             SELECT ${column} AS value, talent_id
               FROM talent_credits
              WHERE ${column} IS NOT NULL
                AND ${column} ILIKE '%' || $1 || '%'
           ) matches
          GROUP BY value
         HAVING COUNT(DISTINCT talent_id) > 1 OR bool_or(talent_id = $2)
          ORDER BY talents DESC, value ASC
          LIMIT 10`,
        [q, talentId],
      );
      return res.json({ suggestions: r.rows.map((row) => row.value) });
    } catch (err) {
      console.error("[talents/credits suggest] failed", err);
      return res.status(500).json({ error: "Klarte ikke å hente forslag" });
    }
  });
}
