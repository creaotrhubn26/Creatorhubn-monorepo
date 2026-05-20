/**
 * design-tokens-routes — Slice 9X.72
 *
 * CMS-styrte design-tokens for dashboardet. Frontend leser via
 * useDashboardTokens-hook og merger med hardkodede defaults.
 *
 * Endepunkter:
 *   GET  /api/admin/design-tokens       — leser nåværende overrides (offentlig — alle brukere får samme tema)
 *   PUT  /api/admin/design-tokens       — admin-only: oppdater overrides
 */

import type { Express, Request, Response, NextFunction } from "express";
import type { Pool } from "pg";

type RequireAdminSession = (req: Request, res: Response, next: NextFunction) => void;

const mapRow = (row: any) => ({
  accentColor: row.accent_color || undefined,
  accentColorSecondary: row.accent_color_secondary || undefined,
  textPrimary: row.text_primary || undefined,
  textSecondary: row.text_secondary || undefined,
  radiusMd: row.radius_md || undefined,
  radiusLg: row.radius_lg || undefined,
  fontDisplay: row.font_display || undefined,
  customOverrides: row.custom_overrides || {},
  updatedAt: row.updated_at,
  updatedBy: row.updated_by,
});

export function registerDesignTokensRoutes(
  app: Express,
  pool: Pool,
  requireAdminSession: RequireAdminSession,
) {
  // ─── Public: les overrides ─────────────────────────────────────
  app.get("/api/admin/design-tokens", async (_req, res) => {
    try {
      const result = await pool.query(
        `SELECT * FROM design_tokens WHERE id = 'global' LIMIT 1`,
      );
      if (result.rows.length === 0) {
        return res.json({ success: true, data: {} });
      }
      res.json({ success: true, data: mapRow(result.rows[0]) });
    } catch (err: any) {
      if (err?.code === '42P01') return res.json({ success: true, data: {} });
      console.error('[design-tokens GET] failed:', err.message);
      res.json({ success: true, data: {} });
    }
  });

  // ─── Admin: lagre overrides ────────────────────────────────────
  app.put(
    "/api/admin/design-tokens",
    requireAdminSession,
    async (req, res) => {
      const b = req.body || {};
      const adminEmail = (req.headers["x-user-email"] as string) || 'admin';
      try {
        const result = await pool.query(
          `INSERT INTO design_tokens (
             id, accent_color, accent_color_secondary,
             text_primary, text_secondary, radius_md, radius_lg,
             font_display, custom_overrides, updated_by, updated_at
           ) VALUES ('global', $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
           ON CONFLICT (id) DO UPDATE SET
             accent_color = EXCLUDED.accent_color,
             accent_color_secondary = EXCLUDED.accent_color_secondary,
             text_primary = EXCLUDED.text_primary,
             text_secondary = EXCLUDED.text_secondary,
             radius_md = EXCLUDED.radius_md,
             radius_lg = EXCLUDED.radius_lg,
             font_display = EXCLUDED.font_display,
             custom_overrides = EXCLUDED.custom_overrides,
             updated_by = EXCLUDED.updated_by,
             updated_at = NOW()
           RETURNING *`,
          [
            b.accentColor || null,
            b.accentColorSecondary || null,
            b.textPrimary || null,
            b.textSecondary || null,
            b.radiusMd || null,
            b.radiusLg || null,
            b.fontDisplay || null,
            b.customOverrides ? JSON.stringify(b.customOverrides) : '{}',
            adminEmail,
          ],
        );
        res.json({ success: true, data: mapRow(result.rows[0]) });
      } catch (err: any) {
        console.error('[design-tokens PUT] failed:', err.message);
        res.status(500).json({ success: false, error: err.message });
      }
    },
  );
}
