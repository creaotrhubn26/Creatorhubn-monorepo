/**
 * role-room-quotes-routes.ts
 *
 * The Role Room pristilbud (egen feature). Innholdsprodusenten bygger et
 * tilbud med linjeposter (enheter × stykkpris), pakkerabatt og mva, og sender
 * det til klienten. Eier role_room_quote (mig 289). Tilbudsnr. genereres
 * TR-ÅÅÅÅ-NNNN. Totaler beregnes server-side.
 *
 *   GET    /api/role-room/projects/:projectId/quotes
 *   POST   /api/role-room/projects/:projectId/quotes
 *   PATCH  /api/role-room/quotes/:id           (oppdater innhold)
 *   PATCH  /api/role-room/quotes/:id/status    body: { status }
 *   DELETE /api/role-room/quotes/:id
 */

import type express from "express";
import type { Pool } from "pg";

interface SessionLike { userId: string; email?: string; name?: string }

export interface RoleRoomQuotesRoutesDeps {
  app: express.Application;
  pool: Pool;
  getActiveSession: (req: express.Request) => SessionLike | null;
}

interface LineItem { label: string; detail: string | null; units: number; unitLabel: string | null; unitPriceKr: number }

interface QuoteRow {
  id: string;
  project_id: string;
  quote_number: string | null;
  client_name: string | null;
  line_items: LineItem[];
  discount_pct: number;
  vat_pct: number;
  valid_until: string | null;
  notes: string | null;
  status: string;
  subtotal_kr: number;
  total_kr: number;
  created_at: string;
  updated_at: string;
}

function parseLineItems(raw: unknown): LineItem[] {
  const arr = Array.isArray(raw) ? raw : typeof raw === "string" ? safeArr(raw) : [];
  return arr.filter((x) => x && typeof x === "object").map((x: any) => ({
    label: typeof x.label === "string" ? x.label.slice(0, 120) : "",
    detail: typeof x.detail === "string" && x.detail.trim() ? x.detail.slice(0, 240) : null,
    units: Number.isFinite(Number(x.units)) ? Math.max(0, Number(x.units)) : 0,
    unitLabel: typeof x.unitLabel === "string" && x.unitLabel.trim() ? x.unitLabel.slice(0, 24) : null,
    unitPriceKr: Number.isFinite(Number(x.unitPriceKr)) ? Math.max(0, Number(x.unitPriceKr)) : 0,
  })).filter((x) => x.label);
}
function safeArr(s: string): any[] { try { const p = JSON.parse(s); return Array.isArray(p) ? p : []; } catch { return []; } }

function computeTotals(items: LineItem[], discountPct: number, vatPct: number): { subtotal: number; total: number } {
  const subtotal = items.reduce((a, i) => a + i.units * i.unitPriceKr, 0);
  const net = subtotal - subtotal * (discountPct / 100);
  const total = net + net * (vatPct / 100);
  return { subtotal: Math.round(subtotal), total: Math.round(total) };
}

function mapRow(r: Record<string, unknown>): QuoteRow {
  return {
    id: String(r.id),
    project_id: String(r.project_id),
    quote_number: r.quote_number == null ? null : String(r.quote_number),
    client_name: r.client_name == null ? null : String(r.client_name),
    line_items: parseLineItems(r.line_items),
    discount_pct: Number(r.discount_pct) || 0,
    vat_pct: Number(r.vat_pct) || 0,
    valid_until: r.valid_until == null ? null : (r.valid_until instanceof Date ? r.valid_until.toISOString().slice(0, 10) : String(r.valid_until)),
    notes: r.notes == null ? null : String(r.notes),
    status: String(r.status ?? "draft"),
    subtotal_kr: Number(r.subtotal_kr) || 0,
    total_kr: Number(r.total_kr) || 0,
    created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    updated_at: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
  };
}

async function nextQuoteNumber(pool: Pool, ownerUserId: string): Promise<string> {
  const year = new Date().getFullYear();
  try {
    const r = await pool.query(
      `SELECT count(*)::int AS n FROM role_room_quote WHERE owner_user_id = $1 AND date_part('year', created_at) = $2`,
      [ownerUserId, year],
    );
    const n = (Number(r.rows[0]?.n) || 0) + 1;
    return `TR-${year}-${String(n).padStart(4, "0")}`;
  } catch {
    return `TR-${year}-0001`;
  }
}

function parseBody(body: Record<string, unknown>): { clientName: string | null; lineItems: LineItem[]; discountPct: number; vatPct: number; validUntil: string | null; notes: string | null } {
  return {
    clientName: typeof body.clientName === "string" && body.clientName.trim() ? body.clientName.trim().slice(0, 160) : null,
    lineItems: parseLineItems(body.lineItems),
    discountPct: Number.isFinite(Number(body.discountPct)) ? Math.min(100, Math.max(0, Number(body.discountPct))) : 0,
    vatPct: Number.isFinite(Number(body.vatPct)) ? Math.min(100, Math.max(0, Number(body.vatPct))) : 25,
    validUntil: typeof body.validUntil === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.validUntil) ? body.validUntil : null,
    notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim().slice(0, 1000) : null,
  };
}

export function setupRoleRoomQuotesRoutes(deps: RoleRoomQuotesRoutesDeps): void {
  const { app, pool, getActiveSession } = deps;

  app.get("/api/role-room/projects/:projectId/quotes", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    try {
      const r = await pool.query(
        `SELECT * FROM role_room_quote WHERE project_id = $1 ORDER BY created_at DESC LIMIT 100`,
        [req.params.projectId],
      );
      return res.json({ quotes: r.rows.map(mapRow) });
    } catch (err) {
      console.error("[quotes GET] failed", err);
      return res.status(500).json({ error: "Klarte ikke å hente tilbud" });
    }
  });

  app.post("/api/role-room/projects/:projectId/quotes", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const b = parseBody((req.body || {}) as Record<string, unknown>);
    try {
      const { subtotal, total } = computeTotals(b.lineItems, b.discountPct, b.vatPct);
      const quoteNumber = await nextQuoteNumber(pool, session.userId);
      const r = await pool.query(
        `INSERT INTO role_room_quote
           (project_id, owner_user_id, quote_number, client_name, line_items, discount_pct, vat_pct, valid_until, notes, status, subtotal_kr, total_kr)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, 'draft', $10, $11)
         RETURNING *`,
        [req.params.projectId, session.userId, quoteNumber, b.clientName, JSON.stringify(b.lineItems), b.discountPct, b.vatPct, b.validUntil, b.notes, subtotal, total],
      );
      return res.json({ quote: mapRow(r.rows[0]) });
    } catch (err) {
      console.error("[quotes POST] failed", err);
      return res.status(500).json({ error: "Klarte ikke å lagre tilbud" });
    }
  });

  app.patch("/api/role-room/quotes/:id", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const b = parseBody((req.body || {}) as Record<string, unknown>);
    try {
      const { subtotal, total } = computeTotals(b.lineItems, b.discountPct, b.vatPct);
      const r = await pool.query(
        `UPDATE role_room_quote
            SET client_name = $2, line_items = $3::jsonb, discount_pct = $4, vat_pct = $5, valid_until = $6, notes = $7, subtotal_kr = $8, total_kr = $9, updated_at = now()
          WHERE id = $1 RETURNING *`,
        [req.params.id, b.clientName, JSON.stringify(b.lineItems), b.discountPct, b.vatPct, b.validUntil, b.notes, subtotal, total],
      );
      if (!r.rowCount) return res.status(404).json({ error: "Ikke funnet" });
      return res.json({ quote: mapRow(r.rows[0]) });
    } catch (err) {
      console.error("[quotes PATCH] failed", err);
      return res.status(500).json({ error: "Klarte ikke å oppdatere tilbud" });
    }
  });

  app.patch("/api/role-room/quotes/:id/status", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const status = (req.body || {}).status;
    if (!["draft", "sent", "accepted", "declined"].includes(status)) return res.status(400).json({ error: "Ugyldig status" });
    try {
      const r = await pool.query(
        `UPDATE role_room_quote SET status = $2, updated_at = now() WHERE id = $1 RETURNING *`,
        [req.params.id, status],
      );
      if (!r.rowCount) return res.status(404).json({ error: "Ikke funnet" });
      return res.json({ quote: mapRow(r.rows[0]) });
    } catch (err) {
      console.error("[quotes status] failed", err);
      return res.status(500).json({ error: "Klarte ikke å oppdatere status" });
    }
  });

  app.delete("/api/role-room/quotes/:id", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    try {
      const r = await pool.query(`DELETE FROM role_room_quote WHERE id = $1`, [req.params.id]);
      return res.json({ deleted: r.rowCount ?? 0 });
    } catch (err) {
      console.error("[quotes DELETE] failed", err);
      return res.status(500).json({ error: "Klarte ikke å slette tilbud" });
    }
  });
}
