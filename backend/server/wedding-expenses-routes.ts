/**
 * wedding-expenses-routes.ts
 *
 * Slice 9X.40 — Hurtigregistrering av bryllupsdag-utlegg.
 *
 *   GET    /api/wedding/:weddingId/expenses
 *   POST   /api/wedding/:weddingId/expenses
 *          { amount, expenseCategory, description, receiptPhotoUrl?, isBillable?, isReimbursable? }
 *   DELETE /api/wedding/:weddingId/expenses/:expenseId
 *
 * receiptPhotoUrl: forventes å være URL fra eksisterende capture-routes
 *   foto-upload eller en data: URL (mobil → base64 → uploadet asset).
 *   Gjør IKKE upload selv — det er separat asset-pipeline.
 */

import type express from "express";
import crypto from "crypto";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface WeddingExpensesRoutesDeps {
  app: express.Application;
  pool: any;
  requireUserSession: (req: any, res: any) => any;
  getPricingUserId: (req: any) => string;
}

const VALID_CATEGORIES = ["parking", "meal", "gift", "supplies", "fuel", "toll", "other"];

async function ensureSchema(pool: any): Promise<void> {
  await pool.query(`ALTER TABLE additional_costs ADD COLUMN IF NOT EXISTS wedding_id VARCHAR(64)`).catch(() => undefined);
  await pool.query(`ALTER TABLE additional_costs ADD COLUMN IF NOT EXISTS receipt_photo_url TEXT`).catch(() => undefined);
  await pool.query(`ALTER TABLE additional_costs ADD COLUMN IF NOT EXISTS expense_category TEXT`).catch(() => undefined);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_additional_costs_wedding ON additional_costs (wedding_id) WHERE wedding_id IS NOT NULL`,
  ).catch(() => undefined);
}

async function resolveProjectId(pool: any, weddingId: string): Promise<string | null> {
  const r = await pool.query(
    `SELECT project_id FROM wedding_timelines WHERE id = $1 LIMIT 1`,
    [weddingId],
  );
  return r.rows[0]?.project_id || null;
}

function rowToExpense(r: any): any {
  return {
    id: r.id,
    weddingId: r.wedding_id,
    projectId: r.project_id,
    expenseCategory: r.expense_category,
    description: r.description,
    amount: parseFloat(r.amount || "0"),
    currency: r.currency,
    isBillable: !!r.is_billable,
    isReimbursable: !!r.is_reimbursable,
    receiptPhotoUrl: r.receipt_photo_url,
    notes: r.notes,
    costDate: r.cost_date,
    createdAt: r.created_at,
  };
}

export function setupWeddingExpensesRoutes(deps: WeddingExpensesRoutesDeps): void {
  const { app, pool, requireUserSession, getPricingUserId } = deps;

  // ─── GET /api/wedding/:weddingId/expenses ─────────────────────
  app.get("/api/wedding/:weddingId/expenses", async (req, res) => {
    try {
      await ensureSchema(pool);
      const uid = getPricingUserId(req);
      if (!uid) return res.status(401).json({ error: "Mangler bruker-ID" });
      const r = await pool.query(
        `SELECT * FROM additional_costs
           WHERE wedding_id = $1 AND user_id = $2
           ORDER BY cost_date DESC, created_at DESC`,
        [req.params.weddingId, uid],
      );
      const total = r.rows.reduce((sum: number, row: any) => sum + parseFloat(row.amount || "0"), 0);
      res.json({
        expenses: r.rows.map(rowToExpense),
        totalKr: Math.round(total * 100) / 100,
      });
    } catch (err) {
      console.error("GET /wedding/:id/expenses:", err);
      res.status(500).json({ error: "Kunne ikke hente utlegg" });
    }
  });

  // ─── POST /api/wedding/:weddingId/expenses ────────────────────
  app.post("/api/wedding/:weddingId/expenses", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      await ensureSchema(pool);
      const uid = getPricingUserId(req);
      if (!uid) return res.status(401).json({ error: "Mangler bruker-ID" });
      const weddingId = req.params.weddingId;

      const expenseCategory = String(req.body?.expenseCategory || "other").toLowerCase();
      if (!VALID_CATEGORIES.includes(expenseCategory)) {
        return res.status(400).json({ error: `Ugyldig kategori. Tillatte: ${VALID_CATEGORIES.join(", ")}` });
      }
      const amount = parseFloat(req.body?.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ error: "Beløp må være > 0" });
      }
      const description = String(req.body?.description || "").trim() || expenseCategory;
      const isBillable = req.body?.isBillable !== false;
      const isReimbursable = !!req.body?.isReimbursable;
      const receiptPhotoUrl = typeof req.body?.receiptPhotoUrl === "string" ? req.body.receiptPhotoUrl : null;
      const notes = typeof req.body?.notes === "string" ? req.body.notes.slice(0, 1000) : null;

      const projectId = await resolveProjectId(pool, weddingId);
      const id = crypto.randomUUID();

      const r = await pool.query(
        `INSERT INTO additional_costs
           (id, user_id, cost_type, description, amount, currency,
            is_billable, is_reimbursable, notes, cost_date, project_id,
            wedding_id, expense_category, receipt_photo_url,
            created_at, updated_at)
         VALUES ($1,$2,'wedding_expense',$3,$4,'NOK',$5,$6,$7,
                 CURRENT_DATE, $8, $9, $10, $11, NOW(), NOW())
         RETURNING *`,
        [id, uid, description, amount, isBillable, isReimbursable, notes, projectId, weddingId, expenseCategory, receiptPhotoUrl],
      );
      res.status(201).json({ expense: rowToExpense(r.rows[0]) });
    } catch (err) {
      console.error("POST /wedding/:id/expenses:", err);
      res.status(500).json({ error: "Kunne ikke lagre utlegg" });
    }
  });

  // ─── DELETE /api/wedding/:weddingId/expenses/:expenseId ───────
  app.delete("/api/wedding/:weddingId/expenses/:expenseId", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const uid = getPricingUserId(req);
      if (!uid) return res.status(401).json({ error: "Mangler bruker-ID" });
      const r = await pool.query(
        `DELETE FROM additional_costs WHERE id = $1 AND user_id = $2 AND wedding_id = $3 RETURNING id`,
        [req.params.expenseId, uid, req.params.weddingId],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "Utlegg finnes ikke" });
      res.json({ success: true });
    } catch (err) {
      console.error("DELETE /wedding/:id/expenses/:expenseId:", err);
      res.status(500).json({ error: "Kunne ikke slette utlegg" });
    }
  });
}
