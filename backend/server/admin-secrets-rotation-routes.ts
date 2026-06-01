// Admin secrets-rotation routes — eksponerer hvilke nøkler som trenger
// rotering og lar admin markere når en nøkkel er rotert.
//
// Vi lagrer ALDRI selve nøkkelen — kun metadata om rotering. Når admin
// klikker "Marker som rotert" må de først ha gjort selve rotasjonen
// i Stripe/Cloudflare/Render-dashboardene.

import express from "express";
import type { Pool } from "pg";

export interface AdminSecretsRotationRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireAdminSession: (
    req: express.Request,
    res: express.Response,
  ) => { userId: string; email: string; name: string; role: string } | null;
}

interface SecretRow {
  key_name: string;
  display_name: string;
  category: string;
  rotated_at: string | null;
  rotated_by: string | null;
  rotation_interval_days: number;
  next_rotation_due: string | null;
  notes: string | null;
}

const computeStatus = (
  row: SecretRow,
): { status: "overdue" | "due_soon" | "ok" | "never_rotated"; daysUntilDue: number | null } => {
  if (!row.rotated_at || !row.next_rotation_due) {
    return { status: "never_rotated", daysUntilDue: null };
  }
  const due = new Date(row.next_rotation_due).getTime();
  const now = Date.now();
  const days = Math.ceil((due - now) / (24 * 60 * 60 * 1000));
  if (days < 0) return { status: "overdue", daysUntilDue: days };
  if (days <= 30) return { status: "due_soon", daysUntilDue: days };
  return { status: "ok", daysUntilDue: days };
};

const isPresent = (envValue: string | undefined): boolean =>
  typeof envValue === "string" && envValue.trim().length > 0;

export function setupAdminSecretsRotationRoutes(
  deps: AdminSecretsRotationRoutesDeps,
): void {
  const { app, pool, requireAdminSession } = deps;

  // GET /api/admin/secrets/rotation — fullt status-bilde
  app.get("/api/admin/secrets/rotation", async (req, res) => {
    const adminSession = requireAdminSession(req, res);
    if (!adminSession) return;

    try {
      const r = await pool.query<SecretRow>(
        `SELECT key_name, display_name, category, rotated_at,
                rotated_by, rotation_interval_days, next_rotation_due, notes
           FROM secret_rotation_tracker
           ORDER BY
             CASE
               WHEN rotated_at IS NULL THEN 0
               ELSE 1
             END,
             next_rotation_due ASC NULLS FIRST,
             key_name ASC`,
      );

      const rows = r.rows.map((row) => {
        const { status, daysUntilDue } = computeStatus(row);
        return {
          keyName: row.key_name,
          displayName: row.display_name,
          category: row.category,
          rotatedAt: row.rotated_at,
          rotatedBy: row.rotated_by,
          rotationIntervalDays: row.rotation_interval_days,
          nextRotationDue: row.next_rotation_due,
          status,
          daysUntilDue,
          envVarPresent: isPresent(process.env[row.key_name]),
          notes: row.notes,
        };
      });

      const summary = rows.reduce(
        (acc, r) => {
          if (r.status === "overdue") acc.overdue++;
          else if (r.status === "due_soon") acc.dueSoon++;
          else if (r.status === "never_rotated") acc.neverRotated++;
          else acc.ok++;
          if (!r.envVarPresent) acc.missingFromEnv++;
          return acc;
        },
        { overdue: 0, dueSoon: 0, neverRotated: 0, ok: 0, missingFromEnv: 0 },
      );

      res.json({
        success: true,
        summary,
        rows,
      });
    } catch (err: any) {
      console.error("[admin-secrets] list failed:", err);
      res.status(500).json({
        success: false,
        error: "list_failed",
        message: String(err?.message || err).slice(0, 200),
      });
    }
  });

  // POST /api/admin/secrets/rotation/:keyName/rotated
  // Markerer at admin har rotert nøkkelen. Vi lagrer hvem + når +
  // hvor lenge siden forrige rotering (audit).
  // Body: { notes?: string }
  app.post(
    "/api/admin/secrets/rotation/:keyName/rotated",
    async (req, res) => {
      const adminSession = requireAdminSession(req, res);
      if (!adminSession) return;
      const keyName = String(req.params.keyName || "").trim();
      if (!keyName) {
        return res.status(400).json({ success: false, error: "missing_key_name" });
      }
      const notes =
        typeof req.body?.notes === "string" ? req.body.notes.slice(0, 500) : null;

      try {
        const before = await pool.query<{ rotated_at: string | null }>(
          `SELECT rotated_at FROM secret_rotation_tracker WHERE key_name = $1`,
          [keyName],
        );
        if ((before.rowCount ?? 0) === 0) {
          return res.status(404).json({
            success: false,
            error: "unknown_key",
            message:
              "Denne nøkkelen er ikke registrert i secret_rotation_tracker. Legg den til via SQL først.",
          });
        }
        const previousRotatedAt = before.rows[0].rotated_at;

        const now = new Date();
        const updated = await pool.query<SecretRow>(
          `UPDATE secret_rotation_tracker
              SET rotated_at = $2,
                  rotated_by = $3,
                  updated_at = $2,
                  notes = COALESCE($4, notes)
            WHERE key_name = $1
            RETURNING key_name, display_name, category, rotated_at,
                      rotated_by, rotation_interval_days, next_rotation_due, notes`,
          [keyName, now.toISOString(), adminSession.email, notes],
        );

        // Audit
        const daysSincePrev = previousRotatedAt
          ? Math.floor(
              (now.getTime() - new Date(previousRotatedAt).getTime()) /
                (24 * 60 * 60 * 1000),
            )
          : null;
        await pool
          .query(
            `INSERT INTO secret_rotation_history
               (key_name, rotated_at, rotated_by, previous_rotated_at,
                days_since_previous, notes)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              keyName,
              now.toISOString(),
              adminSession.email,
              previousRotatedAt,
              daysSincePrev,
              notes,
            ],
          )
          .catch((err) =>
            console.warn("[admin-secrets] audit insert failed:", err),
          );

        const row = updated.rows[0];
        const { status, daysUntilDue } = computeStatus(row);
        res.json({
          success: true,
          keyName,
          rotatedAt: row.rotated_at,
          rotatedBy: row.rotated_by,
          nextRotationDue: row.next_rotation_due,
          status,
          daysUntilDue,
        });
      } catch (err: any) {
        console.error("[admin-secrets] mark rotated failed:", err);
        res.status(500).json({
          success: false,
          error: "mark_rotated_failed",
          message: String(err?.message || err).slice(0, 200),
        });
      }
    },
  );

  // PUT /api/admin/secrets/rotation/:keyName
  // Endre rotation_interval_days eller notes på en eksisterende rad.
  app.put("/api/admin/secrets/rotation/:keyName", async (req, res) => {
    const adminSession = requireAdminSession(req, res);
    if (!adminSession) return;
    const keyName = String(req.params.keyName || "").trim();
    const { rotationIntervalDays, notes, displayName, category } = req.body || {};

    const updates: string[] = [];
    const params: any[] = [keyName];
    let i = 2;
    if (rotationIntervalDays !== undefined) {
      const n = Number(rotationIntervalDays);
      if (!Number.isFinite(n) || n < 1 || n > 3650) {
        return res.status(400).json({
          success: false,
          error: "invalid_interval",
        });
      }
      updates.push(`rotation_interval_days = $${i++}`);
      params.push(n);
    }
    if (typeof notes === "string") {
      updates.push(`notes = $${i++}`);
      params.push(notes.slice(0, 500));
    }
    if (typeof displayName === "string" && displayName.trim().length > 0) {
      updates.push(`display_name = $${i++}`);
      params.push(displayName.trim().slice(0, 200));
    }
    if (typeof category === "string" && category.trim().length > 0) {
      updates.push(`category = $${i++}`);
      params.push(category.trim().slice(0, 50));
    }
    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: "no_changes" });
    }
    updates.push(`updated_at = now()`);

    try {
      const r = await pool.query(
        `UPDATE secret_rotation_tracker
            SET ${updates.join(", ")}
          WHERE key_name = $1
          RETURNING key_name`,
        params,
      );
      if ((r.rowCount ?? 0) === 0) {
        return res
          .status(404)
          .json({ success: false, error: "unknown_key" });
      }
      res.json({ success: true, keyName });
    } catch (err: any) {
      console.error("[admin-secrets] update failed:", err);
      res.status(500).json({ success: false, error: "update_failed" });
    }
  });

  // GET /api/admin/secrets/rotation/:keyName/history — siste 100 roteringer
  app.get(
    "/api/admin/secrets/rotation/:keyName/history",
    async (req, res) => {
      const adminSession = requireAdminSession(req, res);
      if (!adminSession) return;
      const keyName = String(req.params.keyName || "").trim();
      try {
        const r = await pool.query(
          `SELECT id, key_name, rotated_at, rotated_by, previous_rotated_at,
                  days_since_previous, notes, created_at
             FROM secret_rotation_history
            WHERE key_name = $1
            ORDER BY rotated_at DESC
            LIMIT 100`,
          [keyName],
        );
        res.json({ success: true, keyName, history: r.rows });
      } catch (err) {
        console.error("[admin-secrets] history failed:", err);
        res.status(500).json({ success: false, error: "history_failed" });
      }
    },
  );
}
