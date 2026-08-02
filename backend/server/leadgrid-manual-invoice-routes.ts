// leadgrid-manual-invoice-routes.ts
//
// Manuell faktura for organisasjoner UTEN Stripe (super-admin org-detalj →
// «Send manuell faktura»). Genererer fakturanr, sender HTML-e-post og
// tilbyr PDF-nedlasting (pdfkit). Egen Leadgrid-tabell (mig 0407).
//
// Endepunkter:
//   POST /api/leadgrid/manual-invoice        (super-admin: opprett + send)
//   GET  /api/leadgrid/manual-invoice        (super-admin: siste fakturaer)
//   GET  /api/leadgrid/manual-invoice/:id/pdf (strøm PDF via pdfkit)

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import PDFDocument from "pdfkit";
import { sendEmail } from "./casting-reminder-sender.js";

type SessionUser = { userId: string; email: string; name: string; role: string };

export interface LeadgridManualInvoiceRoutesDeps {
  app: Express;
  pool: Pool;
  requireUserSession: (req: Request, res: Response) => SessionUser | null;
}

function isSuperAdmin(role: string | undefined): boolean {
  return (role ?? "").toLowerCase() === "super_admin";
}

function invoiceDTO(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    organizationId: (row.organization_id as string | null) ?? null,
    orgLabel: (row.org_label as string | null) ?? null,
    invoiceNumber: (row.invoice_number as string | null) ?? null,
    recipientEmail: String(row.recipient_email ?? ""),
    amountNok: Number(row.amount_nok ?? 0),
    description: (row.description as string | null) ?? null,
    status: String(row.status ?? "sent"),
    sentAt: row.sent_at ? new Date(String(row.sent_at)).toISOString() : null,
    createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : null,
  };
}

function money(n: number): string {
  return new Intl.NumberFormat("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export function registerLeadgridManualInvoiceRoutes(deps: LeadgridManualInvoiceRoutesDeps): void {
  const { app, pool, requireUserSession } = deps;

  let ensured = false;
  async function ensureTable(): Promise<void> {
    if (ensured) return;
    await pool.query(`
      CREATE TABLE IF NOT EXISTS leadgrid_manual_invoices (
        id SERIAL PRIMARY KEY, organization_id VARCHAR(255), org_label VARCHAR(255),
        invoice_number VARCHAR(64), recipient_email VARCHAR(255) NOT NULL,
        amount_nok NUMERIC(12,2) NOT NULL DEFAULT 0, description TEXT,
        status VARCHAR(16) NOT NULL DEFAULT 'sent', sent_at TIMESTAMPTZ,
        created_by VARCHAR(255), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS leadgrid_manual_invoices_org_idx ON leadgrid_manual_invoices (organization_id, created_at DESC)`);
    ensured = true;
  }

  // ── Opprett + send ──────────────────────────────────────────────────
  app.post("/api/leadgrid/manual-invoice", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    if (!isSuperAdmin(session.role)) return res.status(403).json({ error: "super_admin_required" });
    try {
      await ensureTable();
      const b = (req.body ?? {}) as Record<string, unknown>;
      const recipient = String(b.recipientEmail ?? "").trim();
      if (!recipient || !recipient.includes("@")) return res.status(400).json({ error: "invalid_recipient" });
      const amount = Number(b.amountNok);
      if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: "invalid_amount" });
      const description = typeof b.description === "string" ? b.description.slice(0, 1000) : null;
      const orgLabel = typeof b.orgLabel === "string" ? b.orgLabel.slice(0, 255) : null;
      const orgId = typeof b.organizationId === "string" ? b.organizationId : null;

      // Sett inn først → få id → bygg fakturanr.
      const ins = await pool.query(
        `INSERT INTO leadgrid_manual_invoices
           (organization_id, org_label, recipient_email, amount_nok, description, status, created_by)
         VALUES ($1,$2,$3,$4,$5,'draft',$6) RETURNING *`,
        [orgId, orgLabel, recipient, amount, description, session.userId],
      );
      const id = Number(ins.rows[0].id);
      const invoiceNumber = `LG-${new Date().getFullYear()}-${String(id).padStart(5, "0")}`;

      // Send HTML-faktura (best-effort).
      let status = "sent";
      try {
        await sendEmail({
          to: recipient,
          subject: `Faktura ${invoiceNumber} fra Leadgrid`,
          fromName: "Leadgrid",
          text: `Faktura ${invoiceNumber}\nBeløp: NOK ${money(amount)}\n${description ?? ""}`,
          html: `
            <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px">
              <h2 style="color:#7A47FF;margin:0 0 4px">Faktura ${invoiceNumber}</h2>
              ${orgLabel ? `<p style="color:#555;margin:0 0 16px">${orgLabel}</p>` : ""}
              <table style="width:100%;border-collapse:collapse;margin:16px 0">
                <tr><td style="padding:8px 0;border-bottom:1px solid #eee">${description ?? "Leadgrid-tjenester"}</td>
                    <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right">NOK ${money(amount)}</td></tr>
                <tr><td style="padding:8px 0;font-weight:700">Å betale</td>
                    <td style="padding:8px 0;font-weight:700;text-align:right">NOK ${money(amount)}</td></tr>
              </table>
              <p style="color:#888;font-size:12px">Betalingsfrist 14 dager. Spørsmål: daniel@creatorhubn.com</p>
            </div>`,
        });
      } catch (mailErr) {
        console.warn("[leadgrid-manual-invoice] email failed:", (mailErr as Error).message);
        status = "failed";
      }

      const upd = await pool.query(
        `UPDATE leadgrid_manual_invoices
            SET invoice_number = $1, status = $2, sent_at = CASE WHEN $2 = 'sent' THEN NOW() ELSE NULL END
          WHERE id = $3 RETURNING *`,
        [invoiceNumber, status, id],
      );
      return res.json({ invoice: invoiceDTO(upd.rows[0]) });
    } catch (err) {
      console.error("[leadgrid-manual-invoice] create failed:", err);
      return res.status(500).json({ error: "invoice_create_failed" });
    }
  });

  // ── Siste fakturaer ─────────────────────────────────────────────────
  app.get("/api/leadgrid/manual-invoice", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    if (!isSuperAdmin(session.role)) return res.status(403).json({ error: "super_admin_required" });
    try {
      await ensureTable();
      const orgId = typeof req.query.organizationId === "string" ? req.query.organizationId : null;
      const { rows } = orgId
        ? await pool.query(`SELECT * FROM leadgrid_manual_invoices WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 100`, [orgId])
        : await pool.query(`SELECT * FROM leadgrid_manual_invoices ORDER BY created_at DESC LIMIT 100`);
      return res.json({ invoices: rows.map(invoiceDTO) });
    } catch (err) {
      console.error("[leadgrid-manual-invoice] list failed:", err);
      return res.status(500).json({ error: "invoice_list_failed" });
    }
  });

  // ── PDF-nedlasting (pdfkit) ─────────────────────────────────────────
  app.get("/api/leadgrid/manual-invoice/:id/pdf", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    if (!isSuperAdmin(session.role)) return res.status(403).json({ error: "super_admin_required" });
    try {
      await ensureTable();
      const id = parseInt(String(req.params.id), 10);
      if (!Number.isFinite(id)) return res.status(400).json({ error: "bad_id" });
      const { rows } = await pool.query(`SELECT * FROM leadgrid_manual_invoices WHERE id = $1 LIMIT 1`, [id]);
      if (rows.length === 0) return res.status(404).json({ error: "not_found" });
      const inv = invoiceDTO(rows[0]);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${inv.invoiceNumber ?? "faktura"}.pdf"`);
      const doc = new PDFDocument({ size: "A4", margin: 56 });
      doc.pipe(res);
      doc.fillColor("#7A47FF").fontSize(24).text("Leadgrid", { continued: false });
      doc.moveDown(0.3);
      doc.fillColor("#111").fontSize(16).text(`Faktura ${inv.invoiceNumber ?? ""}`);
      doc.moveDown(0.5);
      doc.fillColor("#555").fontSize(11);
      if (inv.orgLabel) doc.text(`Kunde: ${inv.orgLabel}`);
      doc.text(`Mottaker: ${inv.recipientEmail}`);
      if (inv.sentAt) doc.text(`Dato: ${inv.sentAt.slice(0, 10)}`);
      doc.moveDown(1);
      doc.fillColor("#111").fontSize(12).text(inv.description ?? "Leadgrid-tjenester");
      doc.moveDown(0.5);
      doc.fontSize(14).fillColor("#111").text(`Å betale: NOK ${money(inv.amountNok)}`, { align: "right" });
      doc.moveDown(2);
      doc.fillColor("#888").fontSize(10).text("Betalingsfrist 14 dager. Spørsmål: daniel@creatorhubn.com");
      doc.end();
    } catch (err) {
      console.error("[leadgrid-manual-invoice] pdf failed:", err);
      if (!res.headersSent) res.status(500).json({ error: "invoice_pdf_failed" });
    }
  });
}
