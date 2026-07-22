/**
 * leadgrid-experience-config-routes.ts
 *
 * Super-admin styrer HVA som vises inne i mockupene i landing-scrollfilmen
 * (LeadgridExperience). Configen holder per-scene media-overstyringer; scenene
 * har innebygde defaults, og dette overstyrer bilde/video for valgte scener.
 *
 *   GET  /api/leadgrid/experience-config   — OFFENTLIG (landing leser)
 *   PUT  /api/leadgrid/experience-config   — SUPER-ADMIN (admin-editor skriver)
 *
 * Singleton-rad (mig 0404). Lat CREATE så endepunktene aldri 500-er før
 * migrasjonen er kjørt. Gate-mønster speilet fra leadgrid-pricing-config.
 *
 * ⚠️ FORM-SYNK: speiles i frontend/shared/leadgridExperienceConfig.ts.
 */
import type { Express, Request, Response } from "express";
import type { Pool } from "pg";

type SessionData = { userId: string; role?: string; email?: string };

/** Per-scene media-overstyring. Tom = bruk scenens innebygde default. */
export interface ExperienceSceneMedia {
  image?: string;
  video?: string;
}
export interface ExperienceConfig {
  /** scene-id → media-overstyring (f.eks. { watch: { video: "/…​.mp4" } }). */
  scenes: Record<string, ExperienceSceneMedia>;
}

export const DEFAULT_EXPERIENCE_CONFIG: ExperienceConfig = { scenes: {} };

export function registerLeadgridExperienceConfigRoutes(deps: {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
  isAdminEmail: (email: string | undefined) => boolean;
}) {
  const { app, pool, activeSessions, isAdminEmail } = deps;

  let tableEnsured = false;
  async function ensureTable(): Promise<void> {
    if (tableEnsured) return;
    await pool.query(
      `CREATE TABLE IF NOT EXISTS leadgrid_experience_config (
         id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
         config JSONB NOT NULL,
         updated_by VARCHAR(255),
         updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
       )`,
    );
    tableEnsured = true;
  }

  async function loadConfig(): Promise<ExperienceConfig> {
    await ensureTable();
    const r = await pool.query("SELECT config FROM leadgrid_experience_config WHERE id = 1");
    if (r.rows.length === 0) return DEFAULT_EXPERIENCE_CONFIG;
    return r.rows[0].config as ExperienceConfig;
  }

  function sessionFor(req: Request): SessionData | null {
    const auth = req.headers.authorization;
    if (auth?.startsWith("Bearer ")) return activeSessions.get(auth.slice(7).trim()) ?? null;
    return null;
  }

  // Strukturvalidering — kun strenger for image/video per scene.
  function validate(c: unknown): c is ExperienceConfig {
    const o = c as ExperienceConfig;
    if (!o || typeof o !== "object" || !o.scenes || typeof o.scenes !== "object") return false;
    return Object.values(o.scenes).every((m) => {
      if (!m || typeof m !== "object") return false;
      if (m.image !== undefined && typeof m.image !== "string") return false;
      if (m.video !== undefined && typeof m.video !== "string") return false;
      return true;
    });
  }

  // OFFENTLIG — landingssiden leser.
  app.get("/api/leadgrid/experience-config", async (_req, res) => {
    try {
      const config = await loadConfig();
      res.set("Cache-Control", "public, max-age=60");
      return res.json(config);
    } catch (err) {
      console.error("[leadgrid-experience-config] get feilet:", (err as Error).message);
      return res.json(DEFAULT_EXPERIENCE_CONFIG);
    }
  });

  // SUPER-ADMIN — media-editoren skriver.
  app.put("/api/leadgrid/experience-config", async (req, res) => {
    const session = sessionFor(req);
    if (!session || !isAdminEmail(session.email)) {
      return res.status(403).json({ error: "not_super_admin" });
    }
    try {
      await ensureTable();
      const body = (req.body ?? {}) as { config?: unknown };
      if (!validate(body.config)) {
        return res.status(400).json({ error: "ugyldig_config" });
      }
      await pool.query(
        `INSERT INTO leadgrid_experience_config (id, config, updated_by, updated_at)
         VALUES (1, $1, $2, NOW())
         ON CONFLICT (id) DO UPDATE
           SET config = EXCLUDED.config, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
        [JSON.stringify(body.config), session.email ?? session.userId],
      );
      return res.json({ ok: true });
    } catch (err) {
      console.error("[leadgrid-experience-config] put feilet:", (err as Error).message);
      return res.status(500).json({ error: "internal_error" });
    }
  });
}
