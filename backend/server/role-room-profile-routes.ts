/**
 * Role Room Member Profile — sentral profil-modul for ALLE Role Room-medlemmer.
 *
 * Separat fra Creatorhub-fotograf-profiler. Profilen bygges først via
 * onboarding (når bruker kommer inn for første gang), og kan deretter
 * redigeres via Settings i web-appen eller Post Agent.
 *
 * Endepunkter:
 *   GET    /api/role-room/profile/me
 *   PATCH  /api/role-room/profile/me
 *   POST   /api/role-room/profile/me/image         (multipart/form-data, file=image)
 *   DELETE /api/role-room/profile/me/image
 *   GET    /api/role-room/profile/me/onboarding
 *   POST   /api/role-room/profile/me/onboarding    (mark/update steps)
 *   GET    /api/role-room/profile/:userId          (offentlig — basert på visibility)
 *
 * Auth: bruker eksisterende session-cookie ELLER Authorization Bearer
 * mot users-tabellen (samme pattern som resten av Role Room).
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import multer from "multer";
import crypto from "crypto";

interface SessionData {
  userId: string;
  email?: string;
}

interface RoleRoomProfileDeps {
  pool: Pool;
  activeSessions: Map<string, SessionData>;
  /** Optional: Cloudflare R2 / S3 uploader. Hvis undefined, returnerer 503 ved image-upload. */
  uploadImage?: (buffer: Buffer, mimeType: string, key: string) => Promise<string>;
  /** Sjekker om bruker er admin. Hvis null returneres, ble respons sendt fra middleware. */
  requireAdminSession?: (req: Request, res: Response) => { userId: string } | null;
}

// ─── Default onboarding-config ───────────────────────────────────────────

const DEFAULT_ONBOARDING_CONFIG = {
  welcomeMessage: 'Velkommen til The Role Room. La oss bygge profilen din slik at andre medlemmer kan finne deg og du kan vise hva du gjør.',
  professionsOptions: [
    'Fotograf', 'Videograf', 'Editor', 'Colorist', 'Sound Designer',
    'Producer', 'Director', 'DOP', 'Skuespiller', 'Modell',
    'Brudefotograf', 'Bryllups-editor', 'Dancer', 'Choreograph',
    'Makeup-artist', 'Stylist', 'Annet',
  ],
  skillsOptions: [
    'Color Grading', 'Multi-cam editing', 'Live event', 'Wedding cinematography',
    'Documentary', 'Music video', 'Corporate film', 'Audio mixing',
    'Drone (DJI)', 'Lighting', 'Motion graphics', 'VFX',
    'DaVinci Resolve', 'Premiere Pro', 'Final Cut Pro', 'After Effects',
  ],
  languageOptions: [
    { code: 'no', name: 'Norsk' },
    { code: 'sv', name: 'Svenska' },
    { code: 'da', name: 'Dansk' },
    { code: 'en', name: 'English' },
  ],
  stepsEnabled: {
    welcome: true,
    image: true,
    profession: true,
    about: true,
    links: true,
    privacy: true,
  },
  requiredFields: {
    displayName: true,
    professions: true,
    bio: false,
    profileImage: false,
  },
};

// Multer config: max 4 MB per profilbilde (banner kan være større — egen route senere)
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /^image\/(jpeg|jpg|png|webp|gif)$/.test(file.mimetype);
    if (!ok) {
      cb(new Error("Bare JPG/PNG/WebP/GIF tillatt"));
      return;
    }
    cb(null, true);
  },
});

let tableEnsured = false;
let configTableEnsured = false;

async function ensureConfigTable(pool: Pool): Promise<boolean> {
  if (configTableEnsured) return true;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS role_room_onboarding_config (
        id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
        config JSONB NOT NULL,
        updated_by_user_id VARCHAR(255),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    // Seed default config hvis tom
    await pool.query(
      `INSERT INTO role_room_onboarding_config (id, config)
            VALUES (1, $1::jsonb)
       ON CONFLICT (id) DO NOTHING`,
      [JSON.stringify(DEFAULT_ONBOARDING_CONFIG)],
    );
    configTableEnsured = true;
    return true;
  } catch (err) {
    console.error('[rr-profile] ensure config table failed:', err);
    return false;
  }
}

async function ensureProfileTable(pool: Pool): Promise<boolean> {
  if (tableEnsured) return true;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS role_room_member_profiles (
        user_id VARCHAR(255) PRIMARY KEY,
        display_name VARCHAR(255),
        bio TEXT,
        professions JSONB NOT NULL DEFAULT '[]'::jsonb,
        company_name VARCHAR(255),
        location_city VARCHAR(120),
        location_country VARCHAR(120),
        website VARCHAR(500),
        social_links JSONB NOT NULL DEFAULT '{}'::jsonb,
        showreel_url VARCHAR(500),
        skills JSONB NOT NULL DEFAULT '[]'::jsonb,
        languages JSONB NOT NULL DEFAULT '[]'::jsonb,
        profile_image_url VARCHAR(500),
        banner_image_url VARCHAR(500),
        visibility VARCHAR(32) NOT NULL DEFAULT 'connections',
        onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
        onboarding_completed_at TIMESTAMPTZ,
        onboarding_progress JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_rr_member_profiles_visibility
        ON role_room_member_profiles(visibility);
      CREATE INDEX IF NOT EXISTS idx_rr_member_profiles_onboarding
        ON role_room_member_profiles(onboarding_completed)
        WHERE onboarding_completed = FALSE;
    `);
    tableEnsured = true;
    return true;
  } catch (err) {
    console.error("[rr-profile] ensure table failed:", err);
    return false;
  }
}

// ─── Auth helpers ────────────────────────────────────────────────────────

function getUserIdFromRequest(req: Request, activeSessions: Map<string, SessionData>): string | null {
  // 1. Bearer-token (Post Agent + andre clients) — token er nøkkel i Map
  const authHeader = (req.headers.authorization || "").trim();
  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    const session = activeSessions.get(token);
    if (session?.userId) return session.userId;
  }
  // 2. Cookie-token (samme format: token = session-key)
  const cookieHeader = req.headers.cookie || "";
  const sessionMatch = cookieHeader.match(/(?:^|;\s*)session_token=([^;]+)/);
  if (sessionMatch) {
    const token = decodeURIComponent(sessionMatch[1]);
    const session = activeSessions.get(token);
    if (session?.userId) return session.userId;
  }
  return null;
}

function requireUser(req: Request, res: Response, activeSessions: Map<string, SessionData>): string | null {
  const userId = getUserIdFromRequest(req, activeSessions);
  if (!userId) {
    res.status(401).json({ error: "ikke_innlogget" });
    return null;
  }
  return userId;
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function rowToProfile(row: Record<string, unknown>): Record<string, unknown> {
  return {
    userId: row.user_id,
    displayName: row.display_name,
    bio: row.bio,
    professions: row.professions,
    companyName: row.company_name,
    locationCity: row.location_city,
    locationCountry: row.location_country,
    website: row.website,
    socialLinks: row.social_links,
    showreelUrl: row.showreel_url,
    skills: row.skills,
    languages: row.languages,
    profileImageUrl: row.profile_image_url,
    bannerImageUrl: row.banner_image_url,
    visibility: row.visibility,
    onboardingCompleted: row.onboarding_completed,
    onboardingCompletedAt: row.onboarding_completed_at,
    onboardingProgress: row.onboarding_progress,
    updatedAt: row.updated_at,
  };
}

const ALLOWED_PROFILE_FIELDS: Array<keyof typeof FIELD_TO_COLUMN> = [
  "displayName", "bio", "professions", "companyName", "locationCity",
  "locationCountry", "website", "socialLinks", "showreelUrl", "skills",
  "languages", "visibility",
];

const FIELD_TO_COLUMN = {
  displayName: "display_name",
  bio: "bio",
  professions: "professions",
  companyName: "company_name",
  locationCity: "location_city",
  locationCountry: "location_country",
  website: "website",
  socialLinks: "social_links",
  showreelUrl: "showreel_url",
  skills: "skills",
  languages: "languages",
  visibility: "visibility",
} as const;

const JSONB_FIELDS = new Set<keyof typeof FIELD_TO_COLUMN>([
  "professions", "socialLinks", "skills", "languages",
]);

// ─── Public registration ─────────────────────────────────────────────────

export function registerRoleRoomProfileRoutes(app: Express, deps: RoleRoomProfileDeps): void {
  const { pool, activeSessions, uploadImage } = deps;

  // Ensure table på første mount-tidspunkt
  void ensureProfileTable(pool);

  // ── GET /api/role-room/profile/me ──
  app.get("/api/role-room/profile/me", async (req: Request, res: Response) => {
    const userId = requireUser(req, res, activeSessions);
    if (!userId) return;
    if (!(await ensureProfileTable(pool))) {
      res.status(503).json({ error: "tabell_ikke_klar" }); return;
    }

    try {
      const { rows } = await pool.query(
        `SELECT * FROM role_room_member_profiles WHERE user_id = $1 LIMIT 1`,
        [userId],
      );
      if (rows.length === 0) {
        // Auto-create empty profile på første call
        await pool.query(
          `INSERT INTO role_room_member_profiles (user_id) VALUES ($1)
           ON CONFLICT (user_id) DO NOTHING`,
          [userId],
        );
        const fresh = await pool.query(
          `SELECT * FROM role_room_member_profiles WHERE user_id = $1 LIMIT 1`,
          [userId],
        );
        res.json({ profile: rowToProfile(fresh.rows[0]) });
        return;
      }
      res.json({ profile: rowToProfile(rows[0]) });
    } catch (err) {
      // Column-drift på role_room_member_profiles skal ikke krasje role-room.
      // Returner tom profile-shape istedet for 500 — bruker ser bare default-state.
      console.warn("[rr-profile] GET /me degraded:", (err as any)?.message || err);
      res.json({ profile: null });
    }
  });

  // ── PATCH /api/role-room/profile/me ──
  app.patch("/api/role-room/profile/me", async (req: Request, res: Response) => {
    const userId = requireUser(req, res, activeSessions);
    if (!userId) return;
    if (!(await ensureProfileTable(pool))) {
      res.status(503).json({ error: "tabell_ikke_klar" }); return;
    }
    const body = req.body ?? {};
    const updates: Array<{ col: string; value: unknown }> = [];

    for (const field of ALLOWED_PROFILE_FIELDS) {
      if (field in body) {
        const val = body[field];
        const col = FIELD_TO_COLUMN[field];
        if (JSONB_FIELDS.has(field)) {
          updates.push({ col, value: JSON.stringify(val ?? (Array.isArray(val) ? [] : {})) });
        } else {
          updates.push({ col, value: typeof val === "string" ? val.trim() : val });
        }
      }
    }
    if (updates.length === 0) {
      res.status(400).json({ error: "ingen_felter_oppgitt" }); return;
    }

    // Ensure rad finnes
    await pool.query(
      `INSERT INTO role_room_member_profiles (user_id) VALUES ($1)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId],
    );

    const setClauses = updates.map((u, i) => `${u.col} = $${i + 1}`);
    const values = updates.map((u) => u.value);
    values.push(userId);

    try {
      const { rows } = await pool.query(
        `UPDATE role_room_member_profiles
            SET ${setClauses.join(", ")},
                updated_at = NOW()
          WHERE user_id = $${values.length}
        RETURNING *`,
        values,
      );
      res.json({ profile: rowToProfile(rows[0]) });
    } catch (err) {
      console.error("[rr-profile] PATCH /me failed:", err);
      res.status(500).json({ error: "intern_feil" });
    }
  });

  // ── POST /api/role-room/profile/me/image ──
  app.post(
    "/api/role-room/profile/me/image",
    imageUpload.single("image"),
    async (req: Request, res: Response) => {
      const userId = requireUser(req, res, activeSessions);
      if (!userId) return;
      if (!uploadImage) {
        res.status(503).json({ error: "image_upload_ikke_konfigurert" }); return;
      }
      const file = (req as Request & { file?: Express.Multer.File }).file;
      if (!file) {
        res.status(400).json({ error: "ingen_fil" }); return;
      }
      if (!(await ensureProfileTable(pool))) {
        res.status(503).json({ error: "tabell_ikke_klar" }); return;
      }

      // Object-key: deterministisk per bruker så uploads erstatter forrige
      const ext = file.mimetype.split("/")[1] || "jpg";
      const hash = crypto.createHash("sha1").update(file.buffer).digest("hex").slice(0, 10);
      const key = `role-room/profile-images/${userId}/${Date.now()}-${hash}.${ext}`;

      try {
        const url = await uploadImage(file.buffer, file.mimetype, key);
        await pool.query(
          `INSERT INTO role_room_member_profiles (user_id, profile_image_url)
               VALUES ($1, $2)
           ON CONFLICT (user_id)
           DO UPDATE SET profile_image_url = EXCLUDED.profile_image_url,
                         updated_at = NOW()`,
          [userId, url],
        );
        res.json({ profileImageUrl: url });
      } catch (err) {
        console.error("[rr-profile] image upload failed:", err);
        res.status(500).json({ error: "upload_feilet" });
      }
    },
  );

  // ── DELETE /api/role-room/profile/me/image ──
  app.delete("/api/role-room/profile/me/image", async (req: Request, res: Response) => {
    const userId = requireUser(req, res, activeSessions);
    if (!userId) return;
    try {
      await pool.query(
        `UPDATE role_room_member_profiles
            SET profile_image_url = NULL, updated_at = NOW()
          WHERE user_id = $1`,
        [userId],
      );
      // Merk: vi sletter ikke faktisk objekt fra R2 her — det gjøres av cron
      res.json({ ok: true });
    } catch (err) {
      console.error("[rr-profile] DELETE image failed:", err);
      res.status(500).json({ error: "intern_feil" });
    }
  });

  // ── GET /api/role-room/profile/me/onboarding ──
  app.get("/api/role-room/profile/me/onboarding", async (req: Request, res: Response) => {
    const userId = requireUser(req, res, activeSessions);
    if (!userId) return;
    try {
      const { rows } = await pool.query(
        `SELECT onboarding_completed, onboarding_completed_at, onboarding_progress
           FROM role_room_member_profiles WHERE user_id = $1`,
        [userId],
      );
      if (rows.length === 0) {
        res.json({ completed: false, progress: {}, requiresOnboarding: true });
        return;
      }
      const row = rows[0];
      res.json({
        completed: row.onboarding_completed === true,
        completedAt: row.onboarding_completed_at,
        progress: row.onboarding_progress || {},
        requiresOnboarding: row.onboarding_completed !== true,
      });
    } catch (err) {
      // Manglende onboarding_*-kolonner skal ikke krasje role-room. Returner
      // requiresOnboarding=true så bruker går gjennom wizarden uten 500.
      console.warn("[rr-profile] GET onboarding degraded:", (err as any)?.message || err);
      res.json({ completed: false, progress: {}, requiresOnboarding: true });
    }
  });

  // ── POST /api/role-room/profile/me/onboarding ──
  // Body: { progress?: object, complete?: boolean }
  app.post("/api/role-room/profile/me/onboarding", async (req: Request, res: Response) => {
    const userId = requireUser(req, res, activeSessions);
    if (!userId) return;
    const body = req.body ?? {};
    const progress = body.progress && typeof body.progress === "object" ? body.progress : undefined;
    const complete = body.complete === true;

    if (!(await ensureProfileTable(pool))) {
      res.status(503).json({ error: "tabell_ikke_klar" }); return;
    }

    await pool.query(
      `INSERT INTO role_room_member_profiles (user_id) VALUES ($1)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId],
    );

    try {
      if (complete) {
        await pool.query(
          `UPDATE role_room_member_profiles
              SET onboarding_completed = TRUE,
                  onboarding_completed_at = COALESCE(onboarding_completed_at, NOW()),
                  onboarding_progress = COALESCE($2::jsonb, onboarding_progress),
                  updated_at = NOW()
            WHERE user_id = $1`,
          [userId, progress ? JSON.stringify(progress) : null],
        );
      } else if (progress) {
        await pool.query(
          `UPDATE role_room_member_profiles
              SET onboarding_progress = $2::jsonb, updated_at = NOW()
            WHERE user_id = $1`,
          [userId, JSON.stringify(progress)],
        );
      } else {
        res.status(400).json({ error: "ingenting_a_oppdatere" }); return;
      }
      res.json({ ok: true, completed: complete });
    } catch (err) {
      console.error("[rr-profile] POST onboarding failed:", err);
      res.status(500).json({ error: "intern_feil" });
    }
  });

  // ── GET /api/role-room/profile/:userId (offentlig basert på visibility) ──
  // ── GET /api/role-room/members ── (katalog/søk) ────────────────────
  //
  // Scope: kun medlemmer som deler minst ett produksjonsteam-prosjekt
  // med viewer. Eier-av-prosjekt + alle som er lagt til via
  // casting_user_roles teller som "i samme team".
  //
  // Filtre: q (fritekst), profession (eksakt match mot array), projectId
  // (snevre til ett spesifikt prosjekt).
  app.get("/api/role-room/members", async (req: Request, res: Response) => {
    const viewerId = getUserIdFromRequest(req, activeSessions);
    if (!viewerId) {
      res.status(401).json({ error: "krever_innlogging" });
      return;
    }
    if (!(await ensureProfileTable(pool))) {
      res.status(503).json({ error: "tabell_ikke_klar" }); return;
    }

    const q = String(req.query.q ?? "").trim().toLowerCase().slice(0, 100);
    const profession = String(req.query.profession ?? "").trim().slice(0, 60);
    const projectId = String(req.query.projectId ?? "").trim().slice(0, 64);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "30"), 10) || 30));
    const offset = Math.max(0, parseInt(String(req.query.offset ?? "0"), 10) || 0);

    try {
      const params: unknown[] = [viewerId];

      // Viewer's tilgjengelige prosjekter (eier-av + lagt-til-via-rolle)
      let scopeProjectsSql = `
        SELECT id FROM casting_projects WHERE created_by = $1
        UNION
        SELECT project_id FROM casting_user_roles WHERE user_id = $1`;

      if (projectId) {
        params.push(projectId);
        scopeProjectsSql = `
          SELECT id FROM (${scopeProjectsSql}) v
           WHERE id = $${params.length}`;
      }

      // Andre brukere som er i samme prosjekt-sett
      const teamMembersSql = `
        SELECT DISTINCT cp.created_by AS user_id
          FROM casting_projects cp
         WHERE cp.id IN (${scopeProjectsSql}) AND cp.created_by IS NOT NULL
        UNION
        SELECT DISTINCT cur.user_id
          FROM casting_user_roles cur
         WHERE cur.project_id IN (${scopeProjectsSql})`;

      const where: string[] = [
        "p.visibility IN ('public','connections')",
        "p.onboarding_completed = TRUE",
        `p.user_id != $1`,
        `p.user_id IN (${teamMembersSql})`,
      ];

      if (q) {
        params.push(`%${q}%`);
        const i = params.length;
        where.push(`(
          LOWER(COALESCE(p.display_name,'')) LIKE $${i}
          OR LOWER(COALESCE(p.company_name,'')) LIKE $${i}
          OR LOWER(COALESCE(p.bio,'')) LIKE $${i}
          OR LOWER(COALESCE(p.location_city,'')) LIKE $${i}
        )`);
      }
      if (profession) {
        params.push(profession);
        where.push(`$${params.length} = ANY(p.professions)`);
      }

      params.push(limit, offset);
      const limitIdx = params.length - 1;
      const offsetIdx = params.length;

      const { rows } = await pool.query(
        `SELECT p.user_id, p.display_name, p.bio, p.professions, p.skills,
                p.company_name, p.location_city, p.location_country,
                p.profile_image_url, p.visibility, p.updated_at, u.email
           FROM role_room_member_profiles p
           JOIN users u ON u.id = p.user_id
          WHERE ${where.join(" AND ")}
          ORDER BY p.updated_at DESC
          LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        params,
      );

      const members = rows.map((row) => ({
        userId: row.user_id,
        displayName: row.display_name,
        bio: row.bio,
        professions: row.professions ?? [],
        skills: row.skills ?? [],
        companyName: row.company_name,
        locationCity: row.location_city,
        locationCountry: row.location_country,
        profileImageUrl: row.profile_image_url,
        visibility: row.visibility,
      }));

      res.json({ members, limit, offset, hasMore: members.length === limit });
    } catch (err) {
      // Schema-drift på casting_projects / casting_user_roles / member-profiles
      // skal ikke krasje medlems-katalogen. Returner tom liste i stedet for 500.
      console.warn("[rr-profile] GET /members degraded:", (err as any)?.message || err);
      res.json({ members: [], limit: 0, offset: 0, hasMore: false });
    }
  });

  app.get("/api/role-room/profile/:userId", async (req: Request, res: Response) => {
    const viewerId = getUserIdFromRequest(req, activeSessions);
    const targetUserId = req.params.userId;
    if (!targetUserId) {
      res.status(400).json({ error: "userId_mangler" }); return;
    }
    if (!(await ensureProfileTable(pool))) {
      res.status(503).json({ error: "tabell_ikke_klar" }); return;
    }

    try {
      const { rows } = await pool.query(
        `SELECT p.*, u.email
           FROM role_room_member_profiles p
           JOIN users u ON u.id = p.user_id
          WHERE p.user_id = $1`,
        [targetUserId],
      );
      if (rows.length === 0) {
        res.status(404).json({ error: "ikke_funnet" }); return;
      }
      const row = rows[0];
      const visibility = row.visibility || "connections";

      // Visibility-sjekk
      if (visibility === "private" && viewerId !== targetUserId) {
        res.status(403).json({ error: "privat_profil" }); return;
      }
      if (visibility === "connections" && !viewerId) {
        res.status(401).json({ error: "krever_innlogging" }); return;
      }

      const profile = rowToProfile(row);
      // Skjul onboarding-state fra offentlig
      delete (profile as Record<string, unknown>).onboardingCompleted;
      delete (profile as Record<string, unknown>).onboardingCompletedAt;
      delete (profile as Record<string, unknown>).onboardingProgress;
      res.json({ profile });
    } catch (err) {
      console.error("[rr-profile] GET /:userId failed:", err);
      res.status(500).json({ error: "intern_feil" });
    }
  });

  // ─── Onboarding-config ───────────────────────────────────────────────

  app.get(
    "/api/role-room/onboarding-config",
    async (_req: Request, res: Response) => {
      if (!(await ensureConfigTable(pool))) {
        res.json({ config: DEFAULT_ONBOARDING_CONFIG });
        return;
      }
      try {
        const { rows } = await pool.query(
          `SELECT config FROM role_room_onboarding_config WHERE id = 1`,
        );
        const config = rows[0]?.config ?? DEFAULT_ONBOARDING_CONFIG;
        res.json({ config });
      } catch (err) {
        console.error("[rr-profile] GET onboarding-config failed:", err);
        res.json({ config: DEFAULT_ONBOARDING_CONFIG });
      }
    },
  );

  app.get(
    "/api/role-room/admin/onboarding-config",
    async (req: Request, res: Response) => {
      if (!deps.requireAdminSession) {
        res.status(503).json({ error: "admin_ikke_konfigurert" });
        return;
      }
      const admin = deps.requireAdminSession(req, res);
      if (!admin) return;

      if (!(await ensureConfigTable(pool))) {
        res.status(503).json({ error: "tabell_ikke_klar" });
        return;
      }
      try {
        const { rows } = await pool.query(
          `SELECT config, updated_by_user_id, updated_at
             FROM role_room_onboarding_config WHERE id = 1`,
        );
        const row = rows[0];
        res.json({
          config: row?.config ?? DEFAULT_ONBOARDING_CONFIG,
          defaults: DEFAULT_ONBOARDING_CONFIG,
          updatedByUserId: row?.updated_by_user_id ?? null,
          updatedAt: row?.updated_at ?? null,
        });
      } catch (err) {
        console.error("[rr-profile] GET admin onboarding-config failed:", err);
        res.status(500).json({ error: "intern_feil" });
      }
    },
  );

  app.patch(
    "/api/role-room/admin/onboarding-config",
    async (req: Request, res: Response) => {
      if (!deps.requireAdminSession) {
        res.status(503).json({ error: "admin_ikke_konfigurert" });
        return;
      }
      const admin = deps.requireAdminSession(req, res);
      if (!admin) return;

      if (!(await ensureConfigTable(pool))) {
        res.status(503).json({ error: "tabell_ikke_klar" });
        return;
      }

      const body = (req.body ?? {}) as Record<string, unknown>;
      const next = body.config && typeof body.config === "object"
        ? (body.config as Record<string, unknown>)
        : body;

      // Validér strukturen mykt — krev at de viktige feltene er av riktig type
      const validators: Array<[string, (v: unknown) => boolean]> = [
        ["welcomeMessage", (v) => v === undefined || typeof v === "string"],
        ["professionsOptions", (v) => v === undefined || (Array.isArray(v) && v.every((s) => typeof s === "string"))],
        ["skillsOptions", (v) => v === undefined || (Array.isArray(v) && v.every((s) => typeof s === "string"))],
        ["languageOptions", (v) => v === undefined || (Array.isArray(v) && v.every((o) =>
          o && typeof o === "object" && typeof (o as Record<string, unknown>).code === "string" && typeof (o as Record<string, unknown>).name === "string",
        ))],
        ["stepsEnabled", (v) => v === undefined || (typeof v === "object" && v !== null && !Array.isArray(v))],
        ["requiredFields", (v) => v === undefined || (typeof v === "object" && v !== null && !Array.isArray(v))],
      ];
      for (const [key, ok] of validators) {
        if (!ok(next[key])) {
          res.status(400).json({ error: `ugyldig_${key}` });
          return;
        }
      }

      try {
        const { rows } = await pool.query(
          `SELECT config FROM role_room_onboarding_config WHERE id = 1`,
        );
        const current = (rows[0]?.config as Record<string, unknown> | undefined) ?? DEFAULT_ONBOARDING_CONFIG;
        const merged = { ...current, ...next };

        await pool.query(
          `UPDATE role_room_onboarding_config
              SET config = $1::jsonb,
                  updated_by_user_id = $2,
                  updated_at = NOW()
            WHERE id = 1`,
          [JSON.stringify(merged), admin.userId],
        );
        res.json({ ok: true, config: merged });
      } catch (err) {
        console.error("[rr-profile] PATCH admin onboarding-config failed:", err);
        res.status(500).json({ error: "intern_feil" });
      }
    },
  );

  app.post(
    "/api/role-room/admin/onboarding-config/reset",
    async (req: Request, res: Response) => {
      if (!deps.requireAdminSession) {
        res.status(503).json({ error: "admin_ikke_konfigurert" });
        return;
      }
      const admin = deps.requireAdminSession(req, res);
      if (!admin) return;
      if (!(await ensureConfigTable(pool))) {
        res.status(503).json({ error: "tabell_ikke_klar" });
        return;
      }
      try {
        await pool.query(
          `UPDATE role_room_onboarding_config
              SET config = $1::jsonb,
                  updated_by_user_id = $2,
                  updated_at = NOW()
            WHERE id = 1`,
          [JSON.stringify(DEFAULT_ONBOARDING_CONFIG), admin.userId],
        );
        res.json({ ok: true, config: DEFAULT_ONBOARDING_CONFIG });
      } catch (err) {
        console.error("[rr-profile] reset onboarding-config failed:", err);
        res.status(500).json({ error: "intern_feil" });
      }
    },
  );
}
