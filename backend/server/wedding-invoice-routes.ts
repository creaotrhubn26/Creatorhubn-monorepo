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
  requireUserSession: (req: any, res: any) => any;
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

/**
 * Push en wedding_invoice som SalesOrder i PowerOffice Go.
 *
 * Returnerer:
 *   { ok: true, salesOrderId, salesOrderNumber, sendError? }
 *   { ok: false, status, error, message, detail? }
 *
 * sendError er ikke-fatalt: salgsordren ER opprettet i PO, bare send-
 * stegen ble blokkert (typisk demo-tier). Caller skal lagre PO-id likevel.
 *
 * NB: Linjer med mvaApplicable=false (kjøring/bom) markeres med [MVA-fri]
 * i beskrivelsen — vårt standard-produkt (CHUB-FOTO, konto 3000) gir 25%
 * MVA på alle linjer. Fotograf justerer kjøring/bom-linjenes konto til
 * 3100 i PO Go-draftet før send.
 */
async function pushWeddingInvoiceToPowerOffice(
  pool: any,
  input: {
    weddingId: string;
    invoiceId: string;
    photographerId: string;
    customerEmailOverride: string | null;
  },
): Promise<
  | {
      ok: true;
      salesOrderId: string;
      salesOrderNumber: number | null;
      sendError: { status: number; detail?: unknown } | null;
    }
  | { ok: false; status: number; error: string; message: string; detail?: unknown }
> {
  const intQ = await pool.query(
    `SELECT client_key, status, default_product_id FROM photographer_integrations
      WHERE photographer_id = $1 AND provider = 'poweroffice' LIMIT 1`,
    [input.photographerId],
  );
  if (intQ.rowCount === 0) {
    return {
      ok: false,
      status: 412,
      error: "poweroffice_not_connected",
      message: "Koble til PowerOffice først via /photographer/settings/integrations.",
    };
  }
  const { client_key, status: intStatus, default_product_id } = intQ.rows[0];
  if (intStatus !== "active") {
    return { ok: false, status: 412, error: "integration_not_active", message: `status=${intStatus}` };
  }

  const invQ = await pool.query(
    `SELECT id, lines, total_kr, poweroffice_invoice_id
       FROM wedding_invoices
      WHERE id = $1 AND wedding_id = $2 AND photographer_id = $3 LIMIT 1`,
    [input.invoiceId, input.weddingId, input.photographerId],
  );
  if (invQ.rowCount === 0) {
    return { ok: false, status: 404, error: "invoice_not_found", message: "Faktura finnes ikke" };
  }
  const invoice = invQ.rows[0];

  // Idempotens: hvis allerede pushet, returner samme id.
  if (invoice.poweroffice_invoice_id) {
    return {
      ok: true,
      salesOrderId: invoice.poweroffice_invoice_id,
      salesOrderNumber: null,
      sendError: null,
    };
  }

  const lines: InvoiceLine[] = Array.isArray(invoice.lines) ? invoice.lines : [];
  if (lines.length === 0) {
    return { ok: false, status: 400, error: "invoice_empty", message: "Fakturaen har ingen linjer." };
  }

  const wdQ = await pool.query(
    `SELECT partner_one_name, partner_two_name,
            partner_one_email, partner_two_email,
            partner_one_phone, partner_two_phone
       FROM wedding_details
      WHERE timeline_id = $1 LIMIT 1`,
    [input.weddingId],
  );
  const wd = wdQ.rows[0] ?? {};
  const wtQ = await pool.query(
    `SELECT couple_name, wedding_date FROM wedding_timelines WHERE id = $1 LIMIT 1`,
    [input.weddingId],
  );
  const wt = wtQ.rows[0] ?? {};

  const customerEmail =
    input.customerEmailOverride
    ?? wd.partner_one_email
    ?? wd.partner_two_email
    ?? null;
  if (!customerEmail) {
    return {
      ok: false,
      status: 400,
      error: "customer_email_required",
      message:
        "Brudepar mangler e-post i wedding_details (partner_one_email / partner_two_email). "
        + "Legg til via wedding-detail-skjemaet eller send customerEmail i request-body.",
    };
  }

  const customerName =
    [wd.partner_one_name, wd.partner_two_name].filter(Boolean).join(" og ")
    || wt.couple_name
    || "Brudepar";

  const poLines = lines.map((l) => ({
    description: (l.mvaApplicable === false ? "[MVA-fri] " : "") + l.description,
    quantity: Number(l.quantity) || 1,
    unitPriceNet: Number(l.unitPriceKr),
  }));

  const reference =
    `Bryllup ${wt.couple_name || customerName}`
    + (wt.wedding_date ? ` ${new Date(wt.wedding_date).toISOString().slice(0, 10)}` : "");

  try {
    const { createInvoiceViaSalesOrder, PowerOfficeApiError, PowerOfficeAuthError } = await import(
      "./poweroffice.js"
    );
    try {
      const result = await createInvoiceViaSalesOrder({
        clientKey: client_key,
        cachedProductId: default_product_id ? Number(default_product_id) : null,
        customer: {
          type: "person",
          name: customerName,
          email: customerEmail,
          phone: wd.partner_one_phone ?? wd.partner_two_phone ?? null,
        },
        reference,
        lines: poLines,
        deliveryType: "Auto",
      });

      if (result.productJustCreated) {
        await pool.query(
          `UPDATE photographer_integrations
              SET default_product_id = $2,
                  default_product_synced_at = NOW(),
                  last_used_at = NOW(),
                  updated_at = NOW()
            WHERE photographer_id = $1 AND provider = 'poweroffice'`,
          [input.photographerId, result.productId],
        );
      } else {
        await pool.query(
          `UPDATE photographer_integrations
              SET last_used_at = NOW(), updated_at = NOW()
            WHERE photographer_id = $1 AND provider = 'poweroffice'`,
          [input.photographerId],
        );
      }

      return {
        ok: true,
        salesOrderId: result.salesOrderId,
        salesOrderNumber: result.salesOrderNumber,
        sendError: result.sendError,
      };
    } catch (err: unknown) {
      if (err instanceof PowerOfficeAuthError) {
        await pool.query(
          `UPDATE photographer_integrations
              SET status = 'invalid', last_error = $2, updated_at = NOW()
            WHERE photographer_id = $1 AND provider = 'poweroffice'`,
          [input.photographerId, err.message.slice(0, 500)],
        );
        return {
          ok: false,
          status: 401,
          error: "poweroffice_auth_failed",
          message: "PowerOffice-tilkoblingen er ikke gyldig lenger. Reconnect via innstillinger.",
        };
      }
      if (err instanceof PowerOfficeApiError) {
        await pool.query(
          `UPDATE photographer_integrations
              SET last_error = $2, updated_at = NOW()
            WHERE photographer_id = $1 AND provider = 'poweroffice'`,
          [input.photographerId, `${err.status}: ${err.message}`.slice(0, 500)],
        );
        return {
          ok: false,
          status: 502,
          error: "poweroffice_api_failed",
          message: err.message,
          detail: err.body,
        };
      }
      throw err;
    }
  } catch (err) {
    console.error("[poweroffice/wedding] push failed:", err);
    return { ok: false, status: 500, error: "internal_error", message: String(err) };
  }
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
  const { app, pool, requireUserSession, getPricingUserId } = deps;

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
    if (!requireUserSession(req, res)) return;
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
  //
  // Når channel='poweroffice' pushes fakturaen som SalesOrder i PO Go
  // (kaller pushWeddingInvoiceToPowerOffice). Andre kanaler oppdaterer
  // kun lokal status. Tilleggsparameter `customerEmail` i body overstyrer
  // brudepar-epost-oppslaget fra wedding_details.
  app.post("/api/wedding/:weddingId/invoice/:invoiceId/mark-sent", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const uid = getPricingUserId(req);
      if (!uid) return res.status(401).json({ error: "Mangler bruker-ID" });
      const channel = String(req.body?.channel || "email");
      const customerEmailOverride: string | null =
        typeof req.body?.customerEmail === "string" && req.body.customerEmail.trim()
          ? req.body.customerEmail.trim()
          : null;

      if (channel === "poweroffice") {
        const poResult = await pushWeddingInvoiceToPowerOffice(pool, {
          weddingId: req.params.weddingId,
          invoiceId: req.params.invoiceId,
          photographerId: uid,
          customerEmailOverride,
        });
        if (!poResult.ok) {
          return res.status(poResult.status).json({
            error: poResult.error,
            message: poResult.message,
            detail: poResult.detail,
          });
        }
        const noteFromSendError = poResult.sendError
          ? `PO send blokkert (${poResult.sendError.status}): send manuelt fra PO Go → Salg → Salgsordre`
          : "";
        const r = await pool.query(
          `UPDATE wedding_invoices
             SET status = 'sent',
                 delivery_channel = 'poweroffice',
                 poweroffice_invoice_id = $1,
                 sent_at = NOW(),
                 updated_at = NOW(),
                 notes = CASE
                   WHEN $5::text = '' THEN notes
                   ELSE COALESCE(notes, '') || E'\\n' || $5::text
                 END
             WHERE id = $2 AND wedding_id = $3 AND photographer_id = $4
           RETURNING *`,
          [poResult.salesOrderId, req.params.invoiceId, req.params.weddingId, uid, noteFromSendError],
        );
        if (r.rowCount === 0) return res.status(404).json({ error: "Faktura finnes ikke" });
        return res.json({
          invoice: r.rows[0],
          salesOrderId: poResult.salesOrderId,
          salesOrderNumber: poResult.salesOrderNumber,
          sendError: poResult.sendError,
        });
      }

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
