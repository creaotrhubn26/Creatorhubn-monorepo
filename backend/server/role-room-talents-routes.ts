/**
 * role-room-talents-routes.ts
 *
 * B2B2Talent — talent eier sin egen profil. Routes for:
 *   - Egen-profil (GET/POST/PUT /api/role-room/talents/me)
 *   - Samtykke-registry (GET/POST/DELETE /api/role-room/talents/me/consents)
 *
 * Dette er Phase 1 MVP. Partner-search + audit-listing kommer senere
 * (Phase 1.5). Inntil da kan partnere ikke se talents — kun talenten selv
 * ser sin egen profil og hvem de har gitt tilgang til.
 *
 * Skjema: migrasjon 209 (talents) + 210 (talent_consent_registry +
 * talent_access_audit).
 */

import type express from "express";
import type { Pool } from "pg";

interface SessionLike {
  userId: string;
  email?: string;
  name?: string;
  role?: string;
}

export interface RoleRoomTalentsRoutesDeps {
  app: express.Application;
  pool: Pool;
  /** Mild session-helper — alle innloggede brukere kan ha en talent-profil. */
  getActiveSession: (req: express.Request) => SessionLike | null;
}

// Hvilke felter talenten kan oppdatere selv. Gjør whitelisting eksplisitt
// så vi ikke uventet lar profile_status eller verifiseringsmerker bli skrevet
// av sluttbruker.
const EDITABLE_FIELDS = [
  "display_name",
  "email",
  "phone",
  "city",
  "country",
  "bio",
  "agency_name",
  "agency_contact",
  "represented",
  "headshot_url",
  "headshot_alt_urls",
  "showreel_url",
  "resume_url",
  "age_range",
  "playing_age_min",
  "playing_age_max",
  "gender",
  "ethnicity",
  "height_cm",
  "hair_color",
  "eye_color",
  "skills",
  "languages",
  "dialects",
  "availability_status",
  "availability_notes",
  "availability_calendar",
  "willing_to_travel",
  "external_links",
] as const;
type EditableField = (typeof EDITABLE_FIELDS)[number];

const VALID_SCOPES = new Set([
  "basic_profile",
  "media_portfolio",
  "contact_info",
  "demographics",
  "availability",
  "audition_invitations",
  "self_tape_review",
  "full_profile",
]);

const VALID_PARTNER_TYPES = new Set([
  "stella_casting",
  "skuespillersenter",
  "production_company",
  "caster_individual",
  "workshop_provider",
]);

function pickEditable(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of EDITABLE_FIELDS) {
    if (field in body) out[field as EditableField] = body[field];
  }
  return out;
}

/** Hent talent for en owner-user-id. Returnerer null hvis ingen profil. */
async function fetchTalentForUser(pool: Pool, userId: string) {
  const r = await pool.query(
    `SELECT * FROM talents WHERE owner_user_id = $1 LIMIT 1`,
    [userId],
  );
  return r.rows[0] ?? null;
}

export function setupRoleRoomTalentsRoutes(deps: RoleRoomTalentsRoutesDeps): void {
  const { app, pool, getActiveSession } = deps;

  // ── GET /me — talentens egen profil (oppretter ikke en) ─────────────
  app.get("/api/role-room/talents/me", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    try {
      const talent = await fetchTalentForUser(pool, session.userId);
      return res.json({ talent });
    } catch (err) {
      console.error("[talents/me] failed", err);
      return res.status(500).json({ error: "Klarte ikke å hente profilen" });
    }
  });

  // ── POST /me — opprett talent-profil (kun hvis ikke finnes) ─────────
  app.post("/api/role-room/talents/me", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });

    const body = (req.body || {}) as Record<string, unknown>;
    const display_name = typeof body.display_name === "string"
      ? body.display_name.trim()
      : (session.name ?? session.email ?? "Ukjent skuespiller");

    try {
      const existing = await fetchTalentForUser(pool, session.userId);
      if (existing) {
        return res.status(409).json({ error: "Profil finnes allerede", talent: existing });
      }
      const editable = pickEditable(body);
      const cols = ["owner_user_id", "display_name", "email", ...Object.keys(editable).filter(k => k !== "display_name" && k !== "email")];
      const vals: unknown[] = [
        session.userId,
        display_name,
        session.email ?? body.email ?? null,
        ...cols.slice(3).map((c) => {
          const v = (editable as Record<string, unknown>)[c];
          // JSONB-felter må stringifyes
          if (["headshot_alt_urls", "skills", "languages", "dialects", "external_links"].includes(c)) {
            return v == null ? "[]" : JSON.stringify(v);
          }
          return v ?? null;
        }),
      ];
      const placeholders = vals.map((_, i) => `$${i + 1}`).join(", ");
      const r = await pool.query(
        `INSERT INTO talents (${cols.join(", ")}) VALUES (${placeholders}) RETURNING *`,
        vals,
      );
      return res.status(201).json({ talent: r.rows[0] });
    } catch (err) {
      console.error("[talents/me POST] failed", err);
      return res.status(500).json({ error: "Klarte ikke å opprette profil", detail: String(err) });
    }
  });

  // ── PUT /me — oppdater profilen ─────────────────────────────────────
  app.put("/api/role-room/talents/me", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });

    try {
      const existing = await fetchTalentForUser(pool, session.userId);
      if (!existing) {
        return res.status(404).json({ error: "Ingen profil ennå — POST først" });
      }
      const editable = pickEditable((req.body || {}) as Record<string, unknown>);
      if (Object.keys(editable).length === 0) {
        return res.json({ talent: existing }); // ingenting å oppdatere
      }
      const setClauses: string[] = [];
      const vals: unknown[] = [];
      let i = 1;
      for (const [k, v] of Object.entries(editable)) {
        if (k === "availability_calendar") {
          setClauses.push(`${k} = $${i}::jsonb`);
          vals.push(v == null ? "{}" : JSON.stringify(v));
        } else if (["headshot_alt_urls", "skills", "languages", "dialects", "external_links"].includes(k)) {
          setClauses.push(`${k} = $${i}::jsonb`);
          vals.push(v == null ? "[]" : JSON.stringify(v));
        } else {
          setClauses.push(`${k} = $${i}`);
          vals.push(v ?? null);
        }
        i += 1;
      }
      vals.push(existing.id);
      const r = await pool.query(
        `UPDATE talents SET ${setClauses.join(", ")} WHERE id = $${i} RETURNING *`,
        vals,
      );
      return res.json({ talent: r.rows[0] });
    } catch (err) {
      console.error("[talents/me PUT] failed", err);
      return res.status(500).json({ error: "Klarte ikke å oppdatere profil", detail: String(err) });
    }
  });

  // ── GET /me/consents — alle samtykker for min profil ────────────────
  app.get("/api/role-room/talents/me/consents", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    try {
      const talent = await fetchTalentForUser(pool, session.userId);
      if (!talent) return res.json({ consents: [] });
      const r = await pool.query(
        `SELECT * FROM talent_consent_registry
          WHERE talent_id = $1
          ORDER BY granted_at DESC`,
        [talent.id],
      );
      return res.json({ consents: r.rows });
    } catch (err) {
      console.error("[talents/me/consents GET] failed", err);
      return res.status(500).json({ error: "Klarte ikke å hente samtykker" });
    }
  });

  // ── POST /me/consents — gi en partner tilgang ───────────────────────
  app.post("/api/role-room/talents/me/consents", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });

    const { partner_type, partner_ref, partner_display_name, scope, expires_at, notes } =
      (req.body || {}) as Record<string, unknown>;
    if (typeof partner_type !== "string" || !VALID_PARTNER_TYPES.has(partner_type)) {
      return res.status(400).json({ error: "Ugyldig partner_type" });
    }
    if (typeof partner_ref !== "string" || !partner_ref.trim()) {
      return res.status(400).json({ error: "partner_ref er påkrevd" });
    }
    if (typeof scope !== "string" || !VALID_SCOPES.has(scope)) {
      return res.status(400).json({ error: "Ugyldig scope" });
    }

    try {
      const talent = await fetchTalentForUser(pool, session.userId);
      if (!talent) return res.status(404).json({ error: "Ingen profil ennå — opprett først" });
      // Upsert — hvis status er 'revoked', sett tilbake til 'granted' med ny granted_at
      const r = await pool.query(
        `INSERT INTO talent_consent_registry
           (talent_id, partner_type, partner_ref, partner_display_name, scope,
            status, granted_at, granted_by, expires_at, notes)
         VALUES ($1, $2, $3, $4, $5, 'granted', now(), $6, $7, $8)
         ON CONFLICT (talent_id, partner_type, partner_ref, scope) DO UPDATE SET
           status = 'granted',
           granted_at = now(),
           granted_by = EXCLUDED.granted_by,
           revoked_at = NULL,
           revoked_by = NULL,
           expires_at = EXCLUDED.expires_at,
           partner_display_name = COALESCE(EXCLUDED.partner_display_name, talent_consent_registry.partner_display_name),
           notes = EXCLUDED.notes,
           updated_at = now()
         RETURNING *`,
        [
          talent.id,
          partner_type,
          partner_ref.trim(),
          typeof partner_display_name === "string" ? partner_display_name : null,
          scope,
          session.userId,
          typeof expires_at === "string" ? expires_at : null,
          typeof notes === "string" ? notes : null,
        ],
      );
      return res.status(201).json({ consent: r.rows[0] });
    } catch (err) {
      console.error("[talents/me/consents POST] failed", err);
      return res.status(500).json({ error: "Klarte ikke å lagre samtykke", detail: String(err) });
    }
  });

  // ── GET /me/access-audit — hvem har sett profilen min ───────────────
  app.get("/api/role-room/talents/me/access-audit", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    try {
      const talent = await fetchTalentForUser(pool, session.userId);
      if (!talent) return res.json({ audit: [] });
      // Aggreger per partner-day for å unngå overveldende støy.
      const r = await pool.query(
        `SELECT
            partner_type,
            partner_ref,
            (SELECT name FROM agency_orgs WHERE id::text = partner_ref LIMIT 1) AS partner_name,
            date_trunc('day', accessed_at) AS day,
            count(*) AS access_count,
            max(accessed_at) AS last_accessed,
            array_agg(DISTINCT scope) AS scopes_seen
          FROM talent_access_audit
          WHERE talent_id = $1
            AND accessed_at > now() - interval '90 days'
          GROUP BY partner_type, partner_ref, day
          ORDER BY day DESC, last_accessed DESC
          LIMIT 200`,
        [talent.id],
      );
      return res.json({ audit: r.rows });
    } catch (err) {
      console.error("[talents/me/access-audit] failed", err);
      return res.status(500).json({ error: "Klarte ikke å hente audit-logg" });
    }
  });

  // ── DELETE /me/consents/:id — trekk en tilgang ──────────────────────
  app.delete("/api/role-room/talents/me/consents/:id", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const { id } = req.params;
    try {
      const talent = await fetchTalentForUser(pool, session.userId);
      if (!talent) return res.status(404).json({ error: "Ingen profil" });
      const r = await pool.query(
        `UPDATE talent_consent_registry
            SET status = 'revoked', revoked_at = now(), revoked_by = $3, updated_at = now()
          WHERE id = $1 AND talent_id = $2
          RETURNING *`,
        [id, talent.id, session.userId],
      );
      if (!r.rowCount) return res.status(404).json({ error: "Samtykke ikke funnet" });
      return res.json({ consent: r.rows[0] });
    } catch (err) {
      console.error("[talents/me/consents DELETE] failed", err);
      return res.status(500).json({ error: "Klarte ikke å trekke samtykke" });
    }
  });
}
