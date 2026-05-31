/**
 * role-room-agency-search-routes.ts
 *
 * Phase 7 — Talent Registry for agency-brukere.
 *
 * Konseptet: en agency-user (Stella, NSF, produksjon) skal kunne søke i
 * talents som har gitt nettopp denne agency-en eksplisitt consent. Søk er
 * IKKE en offentlig discovery — bare consent-filtrerte resultater. Det er
 * det som gjør produktet GDPR-trygt.
 *
 * Endpoints:
 *   GET    /api/role-room/agency/talents/search?q=...&location=...&...
 *   GET    /api/role-room/agency/saved-searches
 *   POST   /api/role-room/agency/saved-searches { name, filters, shared? }
 *   PUT    /api/role-room/agency/saved-searches/:id
 *   DELETE /api/role-room/agency/saved-searches/:id
 *   GET    /api/role-room/agency/registry-overview  (stats for sidebar)
 */

import type express from "express";
import type { Pool } from "pg";

interface SessionLike {
  userId: string;
  email?: string;
}

export interface RoleRoomAgencySearchRoutesDeps {
  app: express.Application;
  pool: Pool;
  getActiveSession: (req: express.Request) => SessionLike | null;
}

/** Hent agency for innlogget user. Returnerer null hvis ikke koblet. */
async function fetchAgencyForUser(pool: Pool, userId: string) {
  const r = await pool.query(
    `SELECT a.id, a.type, a.name, a.slug, u.agency_role
       FROM users u JOIN agency_orgs a ON a.id = u.agency_org_id
      WHERE u.id = $1 LIMIT 1`,
    [userId],
  );
  return r.rows[0] ?? null;
}

/** Demo-modus: returner Stella Casting som standard "agency view". */
function getDemoAgency() {
  return {
    id: "a2222222-2222-2222-2222-2222222222a2",
    type: "stella_casting",
    name: "Stella Casting (demo)",
    slug: "demo-stella-casting",
    agency_role: "admin",
  };
}

function isDemoRequest(req: express.Request): boolean {
  return req.query?.demo === "1" || req.query?.demo === "true";
}

type SearchFilters = {
  q?: string;
  location?: string;       // matcher city ILIKE
  gender?: string;
  age_min?: number;        // playing_age_max >= age_min
  age_max?: number;        // playing_age_min <= age_max
  languages?: string[];    // matcher languages JSONB (label)
  skills?: string[];       // matcher skills JSONB
  dialects?: string[];     // matcher dialects JSONB
  availability?: string;   // open | limited | unavailable
  has_selftape?: boolean;  // talent.showreel_url IS NOT NULL
  representation?: string; // 'represented' | 'independent' | 'any'
  sort?: string;           // 'recent' | 'name' | 'available_first'
  limit?: number;          // max 200, default 50
  offset?: number;
};

function parseFilters(query: Record<string, unknown>): SearchFilters {
  const arrFromCsv = (v: unknown): string[] | undefined => {
    if (Array.isArray(v)) return v.map(String).filter(Boolean);
    if (typeof v === "string" && v.trim().length > 0) {
      return v.split(",").map((s) => s.trim()).filter(Boolean);
    }
    return undefined;
  };
  return {
    q: typeof query.q === "string" ? query.q.trim() : undefined,
    location: typeof query.location === "string" ? query.location.trim() : undefined,
    gender: typeof query.gender === "string" ? query.gender.trim() : undefined,
    age_min: query.age_min ? Number(query.age_min) : undefined,
    age_max: query.age_max ? Number(query.age_max) : undefined,
    languages: arrFromCsv(query.languages),
    skills: arrFromCsv(query.skills),
    dialects: arrFromCsv(query.dialects),
    availability: typeof query.availability === "string" ? query.availability : undefined,
    has_selftape: query.has_selftape === "1" || query.has_selftape === "true",
    representation: typeof query.representation === "string" ? query.representation : undefined,
    sort: typeof query.sort === "string" ? query.sort : "recent",
    limit: Math.min(Math.max(Number(query.limit) || 50, 1), 200),
    offset: Math.max(Number(query.offset) || 0, 0),
  };
}

/**
 * Bygger consent-gated search-query. ALLE talents må ha aktiv consent
 * til denne agency-en for å være synlige. Felter maskeres etter scopes
 * agency-en har — basic_profile gir minimum, media_portfolio gir bilder etc.
 */
function buildSearchSql(
  agencyType: string,
  agencyId: string,
  filters: SearchFilters,
  demo: boolean,
): { sql: string; params: unknown[]; countSql: string } {
  const params: unknown[] = [agencyType, agencyId];
  const where: string[] = [
    `c.partner_type = $1`,
    `c.partner_ref = $2`,
    `c.status = 'granted'`,
    `(c.expires_at IS NULL OR c.expires_at > now())`,
    `t.profile_status != 'archived'`,
    `COALESCE(t.is_demo, FALSE) = ${demo ? "TRUE" : "FALSE"}`,
  ];

  let p = 3;
  if (filters.q) {
    params.push(`%${filters.q}%`);
    where.push(`(t.display_name ILIKE $${p} OR t.bio ILIKE $${p} OR t.city ILIKE $${p})`);
    p++;
  }
  if (filters.location) {
    params.push(`%${filters.location}%`);
    where.push(`t.city ILIKE $${p}`);
    p++;
  }
  if (filters.gender) {
    params.push(filters.gender);
    where.push(`t.gender = $${p}`);
    p++;
  }
  if (filters.age_min) {
    params.push(filters.age_min);
    where.push(`(t.playing_age_max IS NULL OR t.playing_age_max >= $${p})`);
    p++;
  }
  if (filters.age_max) {
    params.push(filters.age_max);
    where.push(`(t.playing_age_min IS NULL OR t.playing_age_min <= $${p})`);
    p++;
  }
  if (filters.languages?.length) {
    params.push(JSON.stringify(filters.languages));
    where.push(`EXISTS (SELECT 1 FROM jsonb_array_elements(t.languages) lang
                        WHERE lang->>'label' = ANY(SELECT jsonb_array_elements_text($${p}::jsonb)))`);
    p++;
  }
  if (filters.skills?.length) {
    params.push(JSON.stringify(filters.skills));
    where.push(`EXISTS (SELECT 1 FROM jsonb_array_elements(t.skills) sk
                        WHERE (sk->>'label' = ANY(SELECT jsonb_array_elements_text($${p}::jsonb))
                            OR sk->>'id' = ANY(SELECT jsonb_array_elements_text($${p}::jsonb))))`);
    p++;
  }
  if (filters.dialects?.length) {
    params.push(JSON.stringify(filters.dialects));
    where.push(`EXISTS (SELECT 1 FROM jsonb_array_elements_text(t.dialects) d
                        WHERE d = ANY(SELECT jsonb_array_elements_text($${p}::jsonb)))`);
    p++;
  }
  if (filters.availability) {
    params.push(filters.availability);
    where.push(`t.availability_status = $${p}`);
    p++;
  }
  if (filters.has_selftape) {
    where.push(`t.showreel_url IS NOT NULL AND t.showreel_url != ''`);
  }
  if (filters.representation === "represented") {
    where.push(`t.represented = TRUE`);
  } else if (filters.representation === "independent") {
    where.push(`(t.represented IS NULL OR t.represented = FALSE)`);
  }

  let orderBy = "MAX(c.granted_at) DESC";
  if (filters.sort === "name") orderBy = "MIN(t.display_name) ASC";
  if (filters.sort === "available_first") {
    orderBy = `(CASE WHEN MIN(t.availability_status) = 'open' THEN 0
                     WHEN MIN(t.availability_status) = 'limited' THEN 1
                     ELSE 2 END) ASC, MAX(c.granted_at) DESC`;
  }

  const baseFrom = `
    FROM talent_consent_registry c
    JOIN talents t ON t.id = c.talent_id
    WHERE ${where.join(" AND ")}
    GROUP BY t.id
  `;

  params.push(filters.limit);
  params.push(filters.offset);
  const sql = `
    SELECT
      t.id, t.display_name, t.city, t.country, t.bio,
      t.headshot_url, t.showreel_url, t.resume_url,
      t.playing_age_min, t.playing_age_max, t.gender,
      t.skills, t.languages, t.dialects,
      t.availability_status, t.willing_to_travel,
      t.represented, t.agency_name,
      t.created_at, t.updated_at,
      array_agg(DISTINCT c.scope) AS granted_scopes,
      MAX(c.granted_at) AS last_consent_at
    ${baseFrom}
    ORDER BY ${orderBy}
    LIMIT $${p} OFFSET $${p + 1}
  `;

  // Count-query bruker samme WHERE-clause (men dropper GROUP+ORDER+LIMIT)
  const countSql = `SELECT count(DISTINCT t.id)::int AS n FROM talent_consent_registry c
                    JOIN talents t ON t.id = c.talent_id
                    WHERE ${where.join(" AND ")}`;
  return { sql, params, countSql };
}

function maskByScopes(row: Record<string, unknown>): Record<string, unknown> {
  const scopes = new Set<string>(Array.isArray(row.granted_scopes) ? row.granted_scopes as string[] : []);
  const has = (s: string) => scopes.has("full_profile") || scopes.has(s);
  const masked: Record<string, unknown> = {
    id: row.id,
    display_name: row.display_name,
    city: row.city,
    country: row.country,
    bio: row.bio,
    represented: row.represented,
    skills: row.skills,
    languages: row.languages,
    dialects: row.dialects,
    granted_scopes: Array.from(scopes),
    last_consent_at: row.last_consent_at,
  };
  if (has("media_portfolio")) {
    masked.headshot_url = row.headshot_url;
    masked.showreel_url = row.showreel_url;
    masked.has_showreel = Boolean(row.showreel_url);
  }
  if (has("demographics")) {
    masked.playing_age_min = row.playing_age_min;
    masked.playing_age_max = row.playing_age_max;
    masked.gender = row.gender;
  }
  if (has("availability")) {
    masked.availability_status = row.availability_status;
    masked.willing_to_travel = row.willing_to_travel;
  }
  if (has("contact_info")) {
    masked.agency_name = row.agency_name;
  }
  return masked;
}

export function setupRoleRoomAgencySearchRoutes(deps: RoleRoomAgencySearchRoutesDeps): void {
  const { app, pool, getActiveSession } = deps;

  // ── GET /agency/talents/search ─────────────────────────────────────
  app.get("/api/role-room/agency/talents/search", async (req, res) => {
    const demo = isDemoRequest(req);
    let agency: { id: string; type: string; name: string; slug: string; agency_role: string } | null = null;

    if (demo) {
      agency = getDemoAgency();
    } else {
      const session = getActiveSession(req);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      agency = await fetchAgencyForUser(pool, session.userId);
      if (!agency) return res.status(403).json({ error: "Du tilhører ikke en agency" });
    }

    try {
      const filters = parseFilters(req.query as Record<string, unknown>);
      const { sql, params, countSql } = buildSearchSql(agency.type, agency.id, filters, demo);

      const [result, count] = await Promise.all([
        pool.query(sql, params),
        pool.query(countSql, params.slice(0, params.length - 2)),
      ]);
      const masked = result.rows.map(maskByScopes);
      return res.json({
        agency: { id: agency.id, name: agency.name, type: agency.type },
        filters,
        total: count.rows[0]?.n ?? 0,
        talents: masked,
      });
    } catch (err) {
      console.error("[agency/talents/search] failed", err);
      return res.status(500).json({ error: "Søk feilet", detail: String(err) });
    }
  });

  // ── GET /agency/registry-overview — stats for sidebar ───────────────
  app.get("/api/role-room/agency/registry-overview", async (req, res) => {
    const demo = isDemoRequest(req);
    let agency: { id: string; type: string; name: string } | null = null;
    if (demo) {
      agency = getDemoAgency();
    } else {
      const session = getActiveSession(req);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      agency = await fetchAgencyForUser(pool, session.userId);
      if (!agency) return res.status(403).json({ error: "Du tilhører ikke en agency" });
    }
    try {
      const demoFlag = demo ? "TRUE" : "FALSE";
      // 1) Aggregate stats
      const r = await pool.query(
        `WITH visible AS (
           SELECT DISTINCT t.id, t.created_at, t.availability_status
             FROM talent_consent_registry c
             JOIN talents t ON t.id = c.talent_id
            WHERE c.partner_type = $1 AND c.partner_ref = $2
              AND c.status = 'granted'
              AND (c.expires_at IS NULL OR c.expires_at > now())
              AND COALESCE(t.is_demo, FALSE) = ${demoFlag}
              AND t.profile_status != 'archived'
         )
         SELECT
           count(*)::int AS total_visible,
           count(*) FILTER (WHERE created_at > now() - interval '30 days')::int AS new_30d,
           count(*) FILTER (WHERE availability_status = 'open')::int AS available_now
         FROM visible`,
        [agency.type, agency.id],
      );

      // 2) Sparkline: daily new signups siste 30 dager (matcher "+87 New
      //    signups Last 30 days"-tallet). En signup = en NY talent som ga
      //    samtykke til denne agency på den dagen.
      const sparkline = await pool.query(
        `WITH days AS (
           SELECT generate_series(
             (now() at time zone 'UTC')::date - interval '29 days',
             (now() at time zone 'UTC')::date,
             interval '1 day'
           )::date AS day
         ), counts AS (
           SELECT DATE(c.granted_at at time zone 'UTC') AS day,
                  COUNT(DISTINCT t.id)::int AS n
             FROM talent_consent_registry c
             JOIN talents t ON t.id = c.talent_id
            WHERE c.partner_type = $1 AND c.partner_ref = $2
              AND c.status = 'granted'
              AND COALESCE(t.is_demo, FALSE) = ${demoFlag}
              AND c.granted_at >= now() - interval '30 days'
            GROUP BY DATE(c.granted_at at time zone 'UTC')
         )
         SELECT days.day::text AS day, COALESCE(counts.n, 0)::int AS n
           FROM days LEFT JOIN counts USING (day)
           ORDER BY days.day`,
        [agency.type, agency.id],
      );

      return res.json({
        agency: { id: agency.id, name: agency.name },
        ...r.rows[0],
        sparkline: sparkline.rows, // [{ day: '2026-05-02', n: 0 }, ...] — 30 punkter
      });
    } catch (err) {
      console.error("[registry-overview] failed", err);
      return res.status(500).json({ error: "Klarte ikke å hente oversikt" });
    }
  });

  // ── GET /agency/saved-searches ──────────────────────────────────────
  app.get("/api/role-room/agency/saved-searches", async (req, res) => {
    const demo = isDemoRequest(req);
    if (demo) {
      // Demo: returner shared-searches for demo-agency (Stella)
      const agency = getDemoAgency();
      const r = await pool.query(
        `SELECT id, name, filters, estimated_count, estimated_at, shared,
                created_at, updated_at, last_run_at, owner_user_id
           FROM agency_saved_searches
          WHERE agency_org_id = $1 AND shared = TRUE
          ORDER BY updated_at DESC LIMIT 20`,
        [agency.id],
      );
      return res.json({ searches: r.rows });
    }

    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    try {
      const agency = await fetchAgencyForUser(pool, session.userId);
      if (!agency) return res.json({ searches: [] });
      const r = await pool.query(
        `SELECT id, name, filters, estimated_count, estimated_at, shared,
                created_at, updated_at, last_run_at, owner_user_id
           FROM agency_saved_searches
          WHERE owner_user_id = $1
             OR (agency_org_id = $2 AND shared = TRUE)
          ORDER BY updated_at DESC`,
        [session.userId, agency.id],
      );
      return res.json({ searches: r.rows });
    } catch (err) {
      console.error("[saved-searches GET] failed", err);
      return res.status(500).json({ error: "Klarte ikke å hente lagrede søk" });
    }
  });

  // ── POST /agency/saved-searches ─────────────────────────────────────
  app.post("/api/role-room/agency/saved-searches", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const { name, filters, shared, estimated_count } = (req.body || {}) as {
      name?: string;
      filters?: Record<string, unknown>;
      shared?: boolean;
      estimated_count?: number;
    };
    if (!name?.trim()) return res.status(400).json({ error: "name er påkrevd" });
    try {
      const agency = await fetchAgencyForUser(pool, session.userId);
      if (!agency) return res.status(403).json({ error: "Du tilhører ikke en agency" });
      const r = await pool.query(
        `INSERT INTO agency_saved_searches
           (owner_user_id, agency_org_id, name, filters, shared,
            estimated_count, estimated_at, last_run_at)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6, now(), now())
         RETURNING *`,
        [
          session.userId,
          agency.id,
          name.trim(),
          JSON.stringify(filters || {}),
          shared ?? false,
          estimated_count ?? null,
        ],
      );
      return res.status(201).json({ search: r.rows[0] });
    } catch (err) {
      console.error("[saved-searches POST] failed", err);
      return res.status(500).json({ error: "Klarte ikke å lagre søket", detail: String(err) });
    }
  });

  // ── DELETE /agency/saved-searches/:id ──────────────────────────────
  app.delete("/api/role-room/agency/saved-searches/:id", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    try {
      const r = await pool.query(
        `DELETE FROM agency_saved_searches
          WHERE id = $1 AND owner_user_id = $2
          RETURNING id`,
        [req.params.id, session.userId],
      );
      if (!r.rowCount) return res.status(404).json({ error: "Søk ikke funnet eller ikke ditt" });
      return res.json({ ok: true });
    } catch (err) {
      console.error("[saved-searches DELETE] failed", err);
      return res.status(500).json({ error: "Klarte ikke å slette" });
    }
  });
}
