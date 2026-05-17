/**
 * wedding-invoice-routes.ts
 *
 * Slice 9X.41 — Post-bryllup faktura-sammenstilling.
 *
 *   GET /api/wedding/:weddingId/invoice-summary
 *     Aggregerer:
 *       - Honorar (contracted_hours × pricing.hourly_rate ELLER fixed package_rate)
 *       - Overtid (timer mellom overtime_activated_at og overtime_ended_at × overtime_rate)
 *       - Kjøregodtgjørelse (fra wedding_mileage_reports)
 *       - Bom (fra mileage-rapport)
 *       - Utlegg (fra additional_costs WHERE wedding_id og is_billable=TRUE)
 *     Beregner MVA (25%) for tjenestelinjer, gjengir total.
 *
 *   POST /api/wedding/:weddingId/invoice
 *     Lagrer en "wedding_invoice"-rad (snapshot av summary) klar for sending.
 */

import type express from "express";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface WeddingInvoiceRoutesDeps {
  app: express.Application;
  pool: any;
  getPricingUserId: (req: any) => string;
}

interface InvoiceLine {
  category: "honorar" | "overtid" | "kjoregodtg" | "bom" | "utlegg";
  description: string;
  quantity: number;
  unit: string;
  unitPriceKr: number;
  amountKr: number;
  mvaApplicable: boolean;
}

async function ensureSchema(pool: any): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS wedding_invoices (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      wedding_id VARCHAR(64) NOT NULL,
      photographer_id TEXT NOT NULL,
      lines JSONB NOT NULL DEFAULT '[]'::jsonb,
      subtotal_kr NUMERIC(10,2) NOT NULL DEFAULT 0,
      mva_kr NUMERIC(10,2) NOT NULL DEFAULT 0,
      total_kr NUMERIC(10,2) NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'sent', 'paid', 'cancelled')),
      delivery_channel TEXT,
      poweroffice_invoice_id TEXT,
      sent_at TIMESTAMPTZ,
      paid_at TIMESTAMPTZ,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_wedding_invoices_wedding ON wedding_invoices (wedding_id)`,
  ).catch(() => undefined);
}

async function aggregateInvoice(pool: any, weddingId: string, photographerId: string) {
  // 1. Honorar + overtid fra wedding_timelines
  const wt = await pool.query(
    `SELECT contracted_hours, overtime_activated_at, overtime_ended_at,
            overtime_hourly_rate, couple_name, wedding_date
       FROM wedding_timelines WHERE id = $1 LIMIT 1`,
    [weddingId],
  );
  const w = wt.rows[0] || {};
  const contractedHours = w.contracted_hours != null ? Number(w.contracted_hours) : null;

  // Stines basis-honorar — vi henter siste pricing_structure med hourly_rate
  const pricing = await pool.query(
    `SELECT hourly_rate, overtime_hourly_rate, base_price, full_day_rate
       FROM pricing_structures
       WHERE user_id = $1 AND hourly_rate IS NOT NULL
       ORDER BY created_at DESC LIMIT 1`,
    [photographerId],
  );
  const p = pricing.rows[0] || {};
  const hourlyRate = p.hourly_rate != null ? Number(p.hourly_rate) : 0;
  const overtimeRate = w.overtime_hourly_rate != null
    ? Number(w.overtime_hourly_rate)
    : (p.overtime_hourly_rate != null ? Number(p.overtime_hourly_rate) : hourlyRate * 1.5);

  const lines: InvoiceLine[] = [];

  if (contractedHours && hourlyRate > 0) {
    lines.push({
      category: "honorar",
      description: `Fotografi ${contractedHours} t × ${hourlyRate.toFixed(0)} kr`,
      quantity: contractedHours,
      unit: "t",
      unitPriceKr: hourlyRate,
      amountKr: Math.round(contractedHours * hourlyRate * 100) / 100,
      mvaApplicable: true,
    });
  }

  // Overtid
  if (w.overtime_activated_at) {
    const start = new Date(w.overtime_activated_at).getTime();
    const end = w.overtime_ended_at ? new Date(w.overtime_ended_at).getTime() : Date.now();
    const overtimeHours = Math.max(0, (end - start) / (1000 * 60 * 60));
    const overtimeRounded = Math.ceil(overtimeHours * 4) / 4; // rund opp til nærmeste 15min
    if (overtimeRounded > 0 && overtimeRate > 0) {
      lines.push({
        category: "overtid",
        description: `Overtid ${overtimeRounded.toFixed(2)} t × ${overtimeRate.toFixed(0)} kr`,
        quantity: overtimeRounded,
        unit: "t",
        unitPriceKr: overtimeRate,
        amountKr: Math.round(overtimeRounded * overtimeRate * 100) / 100,
        mvaApplicable: true,
      });
    }
  }

  // Kjøregodtgjørelse — skattefri sats, MVA-fri
  const mileage = await pool.query(
    `SELECT total_km, total_toll_kr, km_rate, total_mileage_kr
       FROM wedding_mileage_reports
       WHERE wedding_id = $1 AND photographer_id = $2 LIMIT 1`,
    [weddingId, photographerId],
  );
  const m = mileage.rows[0];
  if (m) {
    const km = Number(m.total_km);
    const kmRate = Number(m.km_rate);
    const mileageKr = Number(m.total_mileage_kr);
    const tollKr = Number(m.total_toll_kr);
    if (km > 0) {
      lines.push({
        category: "kjoregodtg",
        description: `Kjøregodtgjørelse ${km.toFixed(1)} km × ${kmRate.toFixed(2).replace(".", ",")} kr/km`,
        quantity: km,
        unit: "km",
        unitPriceKr: kmRate,
        amountKr: mileageKr,
        mvaApplicable: false,
      });
    }
    if (tollKr > 0) {
      lines.push({
        category: "bom",
        description: "Bompenger (estimert)",
        quantity: 1,
        unit: "stk",
        unitPriceKr: tollKr,
        amountKr: tollKr,
        mvaApplicable: false,
      });
    }
  }

  // Utlegg som er fakturerbare
  const expenses = await pool.query(
    `SELECT description, amount, expense_category
       FROM additional_costs
       WHERE wedding_id = $1 AND user_id = $2 AND is_billable = TRUE`,
    [weddingId, photographerId],
  );
  for (const e of expenses.rows) {
    const amt = Number(e.amount);
    if (amt > 0) {
      lines.push({
        category: "utlegg",
        description: `${e.description}${e.expense_category ? ` (${e.expense_category})` : ""}`,
        quantity: 1,
        unit: "stk",
        unitPriceKr: amt,
        amountKr: amt,
        mvaApplicable: e.expense_category !== "toll", // bom er MVA-fri
      });
    }
  }

  // Beregn totaler. 25% MVA på MVA-applicable linjer.
  let mvaBase = 0;
  let zeroBase = 0;
  for (const l of lines) {
    if (l.mvaApplicable) mvaBase += l.amountKr;
    else zeroBase += l.amountKr;
  }
  const mva = Math.round(mvaBase * 0.25 * 100) / 100;
  const total = Math.round((mvaBase + zeroBase + mva) * 100) / 100;

  return {
    weddingId,
    coupleName: w.couple_name,
    weddingDate: w.wedding_date,
    lines,
    subtotalKr: Math.round((mvaBase + zeroBase) * 100) / 100,
    mvaKr: mva,
    totalKr: total,
  };
}

export function setupWeddingInvoiceRoutes(deps: WeddingInvoiceRoutesDeps): void {
  const { app, pool, getPricingUserId } = deps;

  // ─── GET /api/wedding/:weddingId/invoice-summary ───────────────
  app.get("/api/wedding/:weddingId/invoice-summary", async (req, res) => {
    try {
      await ensureSchema(pool);
      const uid = getPricingUserId(req);
      if (!uid) return res.status(401).json({ error: "Mangler bruker-ID" });
      const summary = await aggregateInvoice(pool, req.params.weddingId, uid);
      res.json(summary);
    } catch (err) {
      console.error("GET /invoice-summary:", err);
      res.status(500).json({ error: "Kunne ikke beregne faktura" });
    }
  });

  // ─── POST /api/wedding/:weddingId/invoice ──────────────────────
  // Lagrer snapshot, klar for sending. Tar valgfri override av lines
  // (Stine kan justere før send).
  app.post("/api/wedding/:weddingId/invoice", async (req, res) => {
    try {
      await ensureSchema(pool);
      const uid = getPricingUserId(req);
      if (!uid) return res.status(401).json({ error: "Mangler bruker-ID" });

      let lines: InvoiceLine[];
      let subtotalKr: number, mvaKr: number, totalKr: number;
      if (Array.isArray(req.body?.lines)) {
        lines = req.body.lines;
        const mvaBase = lines.filter((l) => l.mvaApplicable).reduce((s, l) => s + Number(l.amountKr), 0);
        const zeroBase = lines.filter((l) => !l.mvaApplicable).reduce((s, l) => s + Number(l.amountKr), 0);
        mvaKr = Math.round(mvaBase * 0.25 * 100) / 100;
        subtotalKr = Math.round((mvaBase + zeroBase) * 100) / 100;
        totalKr = Math.round((subtotalKr + mvaKr) * 100) / 100;
      } else {
        const summary = await aggregateInvoice(pool, req.params.weddingId, uid);
        lines = summary.lines;
        subtotalKr = summary.subtotalKr;
        mvaKr = summary.mvaKr;
        totalKr = summary.totalKr;
      }

      const r = await pool.query(
        `INSERT INTO wedding_invoices
           (wedding_id, photographer_id, lines, subtotal_kr, mva_kr, total_kr, status, notes)
         VALUES ($1, $2, $3::jsonb, $4, $5, $6, 'draft', $7) RETURNING *`,
        [req.params.weddingId, uid, JSON.stringify(lines), subtotalKr, mvaKr, totalKr, req.body?.notes || null],
      );
      res.status(201).json({ invoice: r.rows[0] });
    } catch (err) {
      console.error("POST /invoice:", err);
      res.status(500).json({ error: "Kunne ikke lagre faktura" });
    }
  });

  // ─── POST /api/wedding/:weddingId/invoice/:invoiceId/mark-sent ──
  app.post("/api/wedding/:weddingId/invoice/:invoiceId/mark-sent", async (req, res) => {
    try {
      const uid = getPricingUserId(req);
      if (!uid) return res.status(401).json({ error: "Mangler bruker-ID" });
      const channel = String(req.body?.channel || "email");
      const r = await pool.query(
        `UPDATE wedding_invoices
           SET status = 'sent', delivery_channel = $1, sent_at = NOW(), updated_at = NOW()
           WHERE id = $2 AND wedding_id = $3 AND photographer_id = $4
         RETURNING *`,
        [channel, req.params.invoiceId, req.params.weddingId, uid],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "Faktura finnes ikke" });
      res.json({ invoice: r.rows[0] });
    } catch (err) {
      console.error("POST /invoice/:id/mark-sent:", err);
      res.status(500).json({ error: "Kunne ikke markere som sendt" });
    }
  });

  // ─── GET /api/wedding/:weddingId/invoices ──────────────────────
  app.get("/api/wedding/:weddingId/invoices", async (req, res) => {
    try {
      await ensureSchema(pool);
      const uid = getPricingUserId(req);
      if (!uid) return res.status(401).json({ error: "Mangler bruker-ID" });
      const r = await pool.query(
        `SELECT * FROM wedding_invoices
           WHERE wedding_id = $1 AND photographer_id = $2
           ORDER BY created_at DESC`,
        [req.params.weddingId, uid],
      );
      res.json({ invoices: r.rows });
    } catch (err) {
      console.error("GET /invoices:", err);
      res.status(500).json({ error: "Kunne ikke hente fakturaer" });
    }
  });
}
