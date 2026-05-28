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
}

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
      console.error("[rr-profile] GET /me failed:", err);
      res.status(500).json({ error: "intern_feil" });
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
      console.error("[rr-profile] GET onboarding failed:", err);
      res.status(500).json({ error: "intern_feil" });
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
}
