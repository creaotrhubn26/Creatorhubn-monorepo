// Admin feature-customizations routes.
//
// CRUD for per-user feature overrides bak AdminDashboard "Lab" →
// feature-customizations-tab. Lar admin slå features på/av for én
// spesifikk bruker uavhengig av platform-default-status.
//
// Persistens: `feature_user_overrides`-tabellen (migrasjon 231).
// En rad pr. (user_id, feature_id). UNIQUE-constraint i DB gjør at
// POST kan upserte via ON CONFLICT.
//
// Endepunkter:
//   GET    /api/admin/feature-customizations[?userId=…]
//   POST   /api/admin/feature-customizations
//   PUT    /api/admin/feature-customizations/:id
//   DELETE /api/admin/feature-customizations/:id
//
// Alle krever admin-sesjon via requireAdminSession. `created_by`
// lagres som session.email — det er den admin-identifikatoren som er
// stabil over tid (userId varierer mer på tvers av sesjonstyper).

import express from "express";
import type { Pool } from "pg";

export interface AdminFeatureCustomizationsRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireAdminSession: (
    req: express.Request,
    res: express.Response,
  ) => { userId: string; email: string; name: string; role: string } | null;
}

interface FeatureOverrideRow {
  id: string;
  user_id: string;
  feature_id: string;
  override_value: boolean;
  override_reason: string | null;
  created_by: string;
  created_at: Date | string;
  updated_at: Date | string;
}

function serializeOverride(row: FeatureOverrideRow) {
  return {
    id: row.id,
    userId: row.user_id,
    featureId: row.feature_id,
    overrideValue: row.override_value,
    overrideReason: row.override_reason,
    createdBy: row.created_by,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : row.created_at,
    updatedAt:
      row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : row.updated_at,
  };
}

function readBool(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === 1) return true;
  if (value === "false" || value === 0) return false;
  return null;
}

function readString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
}

export function setupAdminFeatureCustomizationsRoutes(
  deps: AdminFeatureCustomizationsRoutesDeps,
): void {
  const { app, pool, requireAdminSession } = deps;

  // ─── List ─────────────────────────────────────────────────
  // GET /api/admin/feature-customizations[?userId=…]
  app.get("/api/admin/feature-customizations", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const userIdRaw = readString(req.query.userId);
      let result;
      if (userIdRaw) {
        result = await pool.query<FeatureOverrideRow>(
          `SELECT id, user_id, feature_id, override_value, override_reason,
                  created_by, created_at, updated_at
             FROM feature_user_overrides
            WHERE user_id = $1::uuid
            ORDER BY created_at DESC`,
          [userIdRaw],
        );
      } else {
        result = await pool.query<FeatureOverrideRow>(
          `SELECT id, user_id, feature_id, override_value, override_reason,
                  created_by, created_at, updated_at
             FROM feature_user_overrides
            ORDER BY created_at DESC`,
        );
      }
      const customizations = result.rows.map(serializeOverride);
      res.json({ customizations, total: customizations.length });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // ─── Upsert ───────────────────────────────────────────────
  // POST /api/admin/feature-customizations
  // body: { userId, featureId, override, reason? }
  app.post("/api/admin/feature-customizations", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    try {
      const body =
        req.body && typeof req.body === "object"
          ? (req.body as Record<string, unknown>)
          : {};
      const userId = readString(body.userId);
      const featureId = readString(body.featureId);
      const override = readBool(body.override);
      const reason = readString(body.reason);

      if (!userId || !featureId || override === null) {
        return res.status(400).json({
          error:
            "userId, featureId og override (boolean) er påkrevd",
        });
      }

      const result = await pool.query<FeatureOverrideRow>(
        `INSERT INTO feature_user_overrides
            (user_id, feature_id, override_value, override_reason, created_by, updated_at)
         VALUES ($1::uuid, $2, $3, $4, $5, now())
         ON CONFLICT (user_id, feature_id) DO UPDATE
            SET override_value  = EXCLUDED.override_value,
                override_reason = EXCLUDED.override_reason,
                updated_at      = now()
         RETURNING id, user_id, feature_id, override_value, override_reason,
                   created_by, created_at, updated_at`,
        [userId, featureId, override, reason, session.email],
      );
      const row = result.rows[0];
      res.json({ success: true, id: row.id, customization: serializeOverride(row) });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // ─── Update override ──────────────────────────────────────
  // PUT /api/admin/feature-customizations/:id
  // body: { override, reason? }
  app.put("/api/admin/feature-customizations/:id", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const body =
        req.body && typeof req.body === "object"
          ? (req.body as Record<string, unknown>)
          : {};
      const override = readBool(body.override);
      const reason = readString(body.reason);

      if (override === null && reason === null) {
        return res.status(400).json({
          error: "Minst én av override eller reason må sendes",
        });
      }

      const result = await pool.query<FeatureOverrideRow>(
        `UPDATE feature_user_overrides
            SET override_value  = COALESCE($1::boolean, override_value),
                override_reason = COALESCE($2::text, override_reason),
                updated_at      = now()
          WHERE id = $3::uuid
        RETURNING id, user_id, feature_id, override_value, override_reason,
                  created_by, created_at, updated_at`,
        [override, reason, req.params.id],
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Override ikke funnet" });
      }
      res.json({ success: true, customization: serializeOverride(result.rows[0]) });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // ─── Delete (=> default igjen) ────────────────────────────
  // DELETE /api/admin/feature-customizations/:id
  app.delete("/api/admin/feature-customizations/:id", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const result = await pool.query(
        `DELETE FROM feature_user_overrides WHERE id = $1::uuid`,
        [req.params.id],
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Override ikke funnet" });
      }
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });
}
