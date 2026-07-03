/**
 * leadgrid-proposals-routes.ts
 *
 * Tilbudssending (funn #7, produktrevisjonen 2026-07-03) — selgeren skal
 * aldri måtte ut i Word/privat e-post for å sende tilbud.
 *
 * Flyt:
 *   1. POST /api/leadgrid/leads/:id/proposals  (auth)
 *      → lagrer tilbudet, sender branded e-post m/ «Se tilbudet»-lenke
 *        via Resend, flytter leaden til stage 'proposal' og logger
 *        'proposal_sent'-aktivitet.
 *   2. GET /api/leadgrid/p/:token  (OFFENTLIG — e-post-lenken)
 *      → første åpning: status='opened' + leadgrid_proposal_views +
 *        proposal.opened-workflow-event (triggeren fantes allerede).
 *        Strømmer branded PDF av tilbudet.
 *   3. GET /api/leadgrid/leads/:id/proposals  (auth) — historikk per lead.
 *   4. PATCH /api/leadgrid/proposals/:id  (auth) — marker accepted/rejected.
 *
 * Forutsetter mig 0363 (leadgrid_proposals). Auth-mønster som
 * leadgrid-sales-teams-routes.ts. JSON snake_case (iPad _sharedEncoder).
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import crypto from "node:crypto";
import PDFDocument from "pdfkit";
import { sendTransactionalEmail } from "./transactional-email-service.js";
import { publishEvent } from "./leadgrid-workflow-engine.js";
import { applyStageChange } from "./leadgrid-deals-service.js";

type SessionUser = {
  userId: string;
  email: string;
  name: string;
  role: string;
};

export interface ProposalsRoutesDeps {
  app: Express;
  pool: Pool;
  requireUserSession: (req: Request, res: Response) => SessionUser | null;
}

/** Samme org-oppslag som sales-leadership/sales-teams (modul-privat der). */
async function resolveOrgIdForUser(
  pool: Pool,
  userId: string,
): Promise<string> {
  try {
    const r = await pool.query<{ organization_id: string }>(
      `SELECT organization_id
         FROM enterprise_team_members
        WHERE user_id = $1 AND status = 'active'
        ORDER BY joined_at DESC NULLS LAST
        LIMIT 1`,
      [userId],
    );
    const orgId = r.rows[0]?.organization_id;
    if (orgId) return String(orgId);
  } catch {
    // Fall til userId-modell (solo).
  }
  return userId;
}

function publicBackendBase(): string {
  return (
    process.env.PUBLIC_BACKEND_URL ||
    "https://creatorhub-backend-rtbl.onrender.com"
  ).replace(/\/+$/, "");
}

interface ProposalLine {
  description: string;
  amount_nok: number;
}

function parseLines(raw: unknown): ProposalLine[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((l) => {
      const o = (l ?? {}) as Record<string, unknown>;
      const description = typeof o.description === "string" ? o.description.trim().slice(0, 300) : "";
      const amount = Number(o.amount_nok);
      return { description, amount_nok: Number.isFinite(amount) ? Math.max(0, amount) : 0 };
    })
    .filter((l) => l.description.length > 0)
    .slice(0, 50);
}

function fmtNok(n: number): string {
  return new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 }).format(n);
}

function mapProposalRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: String(row.id),
    lead_id: String(row.lead_id),
    title: String(row.title ?? ""),
    message: String(row.message ?? ""),
    lines: Array.isArray(row.lines) ? row.lines : [],
    total_amount_nok: Number(row.total_amount_nok ?? 0),
    currency: String(row.currency ?? "NOK"),
    valid_until: row.valid_until ?? null,
    status: String(row.status ?? "sent"),
    sent_to_email: String(row.sent_to_email ?? ""),
    opened_at: row.opened_at instanceof Date ? row.opened_at.toISOString() : row.opened_at,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  };
}

/** Branded e-post-HTML med «Se tilbudet»-knapp. Ingen emoji (designregel). */
function proposalEmailHtml(opts: {
  leadName: string;
  title: string;
  message: string;
  totalNok: number;
  senderName: string;
  url: string;
}): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const msgHtml = esc(opts.message).replace(/\n/g, "<br>");
  return `<div style="font-family:-apple-system,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;color:#111">
  <h2 style="font-size:20px;margin:24px 0 4px">${esc(opts.title)}</h2>
  <p style="color:#555;margin:0 0 16px">Tilbud til ${esc(opts.leadName)}</p>
  ${msgHtml ? `<p style="font-size:15px;line-height:1.6">${msgHtml}</p>` : ""}
  <p style="font-size:15px;margin:18px 0 6px">Totalsum: <strong>${fmtNok(opts.totalNok)} kr</strong> eks. mva.</p>
  <p style="margin:26px 0">
    <a href="${opts.url}" style="background:#7c3aed;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;display:inline-block">Se tilbudet (PDF)</a>
  </p>
  <p style="font-size:13px;color:#777">Vennlig hilsen<br>${esc(opts.senderName)}</p>
</div>`;
}

/** Branded tilbuds-PDF — samme PDFKit-stil som lead-eksporten. */
function renderProposalPdf(
  res: Response,
  proposal: {
    title: string;
    message: string;
    lines: ProposalLine[];
    total_amount_nok: number;
    valid_until: string | null;
    created_at: Date;
  },
  leadName: string,
  branding: { name: string; primary_color: string; sender_name: string | null },
): void {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="tilbud.pdf"`);
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  doc.pipe(res);

  const accent = /^#[0-9a-fA-F]{6}$/.test(branding.primary_color)
    ? branding.primary_color
    : "#7c3aed";

  // Header
  doc.rect(0, 0, doc.page.width, 90).fill(accent);
  doc.fillColor("#ffffff").fontSize(20).text(branding.name, 50, 30);
  doc.fontSize(10).text("TILBUD", 50, 58);

  // Tittel + mottaker
  doc.fillColor("#111111").fontSize(18).text(proposal.title, 50, 120);
  doc.fontSize(11).fillColor("#555555")
    .text(`Til: ${leadName}`, 50, 148)
    .text(`Dato: ${proposal.created_at.toLocaleDateString("nb-NO")}`, 50, 163);
  if (proposal.valid_until) {
    doc.text(`Gyldig til: ${new Date(proposal.valid_until).toLocaleDateString("nb-NO")}`, 50, 178);
  }

  // Melding
  let y = 205;
  if (proposal.message) {
    doc.fontSize(11).fillColor("#111111").text(proposal.message, 50, y, { width: 495 });
    y = doc.y + 20;
  }

  // Linjer
  doc.fontSize(10).fillColor("#888888").text("BESKRIVELSE", 50, y).text("BELØP", 430, y, { width: 115, align: "right" });
  y += 16;
  doc.moveTo(50, y).lineTo(545, y).strokeColor("#dddddd").stroke();
  y += 8;
  for (const line of proposal.lines) {
    doc.fontSize(11).fillColor("#111111")
      .text(line.description, 50, y, { width: 360 })
      .text(`${fmtNok(line.amount_nok)} kr`, 430, y, { width: 115, align: "right" });
    y = Math.max(doc.y, y + 14) + 6;
    if (y > 720) { doc.addPage(); y = 60; }
  }
  y += 6;
  doc.moveTo(50, y).lineTo(545, y).strokeColor("#dddddd").stroke();
  y += 10;
  doc.fontSize(13).fillColor(accent)
    .text("Totalsum eks. mva.", 50, y)
    .text(`${fmtNok(proposal.total_amount_nok)} kr`, 400, y, { width: 145, align: "right" });

  // Footer
  doc.fontSize(8).fillColor("#aaaaaa")
    .text(`Generert via Leadgrid · ${branding.sender_name ?? branding.name}`,
          50, 780, { align: "center", width: 495 });
  doc.end();
}

export function registerLeadgridProposalsRoutes(deps: ProposalsRoutesDeps): void {
  const { app, pool, requireUserSession } = deps;

  // ── POST /api/leadgrid/leads/:id/proposals — opprett + send ─────────
  app.post("/api/leadgrid/leads/:id/proposals", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const orgId = await resolveOrgIdForUser(pool, session.userId);
    const leadId = String(req.params.id ?? "");
    const body = (req.body ?? {}) as Record<string, unknown>;
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 200) : "";
    const message = typeof body.message === "string" ? body.message.trim().slice(0, 4000) : "";
    const lines = parseLines(body.lines);
    const validUntil = typeof body.valid_until === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.valid_until)
      ? body.valid_until : null;
    const overrideEmail = typeof body.to_email === "string" && body.to_email.includes("@")
      ? body.to_email.trim() : null;

    if (!title) return res.status(400).json({ error: "mangler_tittel" });
    if (lines.length === 0) return res.status(400).json({ error: "mangler_linjer" });

    try {
      const leadR = await pool.query<{ id: string; name: string; email: string | null }>(
        `SELECT id::text, name, email FROM crm_customers WHERE id = $1::uuid LIMIT 1`,
        [leadId],
      );
      const lead = leadR.rows[0];
      if (!lead) return res.status(404).json({ error: "lead_ikke_funnet" });
      const toEmail = overrideEmail ?? (lead.email ?? "").trim();
      if (!toEmail || !toEmail.includes("@")) {
        return res.status(400).json({ error: "lead_mangler_epost", detail: "Leaden har ingen e-postadresse — legg til én, eller send `to_email` i body." });
      }

      const total = lines.reduce((sum, l) => sum + l.amount_nok, 0);
      const token = crypto.randomBytes(24).toString("hex");

      const ins = await pool.query(
        `INSERT INTO leadgrid_proposals
           (organization_id, lead_id, title, message, lines, total_amount_nok,
            valid_until, public_token, sent_to_email, sent_by_user_id)
         VALUES ($1, $2::uuid, $3, $4, $5::jsonb, $6, $7, $8, $9, $10)
         RETURNING *`,
        [orgId, leadId, title, message, JSON.stringify(lines), total,
         validUntil, token, toEmail, session.userId],
      );

      // E-post m/ offentlig lenke (Resend → SMTP-fallback, logges).
      const url = `${publicBackendBase()}/api/leadgrid/p/${token}`;
      const senderName = session.name || "Salgsteamet";
      const emailResult = await sendTransactionalEmail({
        to: toEmail,
        subject: `Tilbud: ${title}`,
        html: proposalEmailHtml({ leadName: lead.name, title, message, totalNok: total, senderName, url }),
        text: `${title}\n\nTilbud til ${lead.name}.\n\n${message}\n\nTotalsum: ${fmtNok(total)} kr eks. mva.\n\nSe tilbudet: ${url}\n\nVennlig hilsen\n${senderName}`,
        fromLabel: "Leadgrid",
        kind: "leadgrid_proposal",
        sentByUserId: session.userId,
        pool,
      });

      // Stage → 'proposal' + aktivitetslogg (best-effort — tilbudet er
      // sendt uansett; stage-endring kan feile på custom-stage-orgs).
      try {
        await applyStageChange(pool, leadId, session.userId, "proposal", {
          source: "proposal_sent",
          notes: title,
        });
      } catch (err) {
        console.warn("[proposals] stage-endring feilet:", (err as Error).message);
      }
      try {
        await pool.query(
          `INSERT INTO crm_lead_activities
             (customer_id, user_id, activity_type, description, metadata)
           VALUES ($1::uuid, $2, 'proposal_sent', $3, $4::jsonb)`,
          [leadId, session.userId, `Tilbud sendt: ${title} (${fmtNok(total)} kr)`,
           JSON.stringify({ proposal_id: ins.rows[0].id, total_amount_nok: total })],
        );
      } catch (err) {
        console.warn("[proposals] aktivitetslogg feilet:", (err as Error).message);
      }

      return res.status(201).json({
        proposal: mapProposalRow(ins.rows[0]),
        email_sent: emailResult.sent,
        email_provider: emailResult.provider,
        email_error: emailResult.sent ? null : emailResult.reason,
      });
    } catch (err) {
      console.error("[proposals] POST failed:", err);
      return res.status(500).json({ error: "proposal_create_failed", detail: String((err as Error).message) });
    }
  });

  // ── GET /api/leadgrid/leads/:id/proposals — historikk ───────────────
  app.get("/api/leadgrid/leads/:id/proposals", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const orgId = await resolveOrgIdForUser(pool, session.userId);
    try {
      const r = await pool.query(
        `SELECT * FROM leadgrid_proposals
          WHERE lead_id = $1::uuid AND organization_id = $2
          ORDER BY created_at DESC LIMIT 50`,
        [String(req.params.id ?? ""), orgId],
      );
      return res.json({ proposals: r.rows.map(mapProposalRow) });
    } catch (err) {
      console.error("[proposals] GET failed:", err);
      return res.status(500).json({ error: "proposals_failed", detail: String((err as Error).message) });
    }
  });

  // ── PATCH /api/leadgrid/proposals/:id — accepted/rejected ───────────
  app.patch("/api/leadgrid/proposals/:id", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const orgId = await resolveOrgIdForUser(pool, session.userId);
    const status = String((req.body ?? {}).status ?? "");
    if (!["accepted", "rejected", "expired"].includes(status)) {
      return res.status(400).json({ error: "ugyldig_status" });
    }
    try {
      const r = await pool.query(
        `UPDATE leadgrid_proposals
            SET status = $1, responded_at = NOW(), updated_at = NOW()
          WHERE id = $2::uuid AND organization_id = $3
          RETURNING *`,
        [status, String(req.params.id ?? ""), orgId],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "ikke_funnet" });
      return res.json({ proposal: mapProposalRow(r.rows[0]) });
    } catch (err) {
      console.error("[proposals] PATCH failed:", err);
      return res.status(500).json({ error: "proposal_update_failed", detail: String((err as Error).message) });
    }
  });

  // ── GET /api/leadgrid/p/:token — OFFENTLIG (e-post-lenken) ──────────
  app.get("/api/leadgrid/p/:token", async (req, res) => {
    const token = String(req.params.token ?? "");
    if (!/^[0-9a-f]{48}$/.test(token)) {
      return res.status(404).send("Ikke funnet");
    }
    try {
      const r = await pool.query(
        `SELECT p.*, c.name AS lead_name
           FROM leadgrid_proposals p
           JOIN crm_customers c ON c.id = p.lead_id
          WHERE p.public_token = $1
          LIMIT 1`,
        [token],
      );
      const row = r.rows[0] as (Record<string, unknown> & { lead_name: string }) | undefined;
      if (!row) return res.status(404).send("Tilbudet finnes ikke lenger");

      // Første åpning: marker opened + logg view + fyr workflow-event.
      if (row.status === "sent") {
        await pool.query(
          `UPDATE leadgrid_proposals
              SET status = 'opened', opened_at = NOW(), updated_at = NOW()
            WHERE id = $1::uuid AND status = 'sent'`,
          [row.id],
        );
        // leadgrid_proposal_views har UUID-org — hopp over når org er
        // slug/user-id (samme begrensning som triggers-ruta).
        try {
          await pool.query(
            `INSERT INTO leadgrid_proposal_views
               (organization_id, customer_id, proposal_id, device_type, user_agent)
             VALUES ($1::uuid, $2::uuid, $3, 'email_link', $4)`,
            [row.organization_id, row.lead_id, String(row.id),
             String(req.headers["user-agent"] ?? "").slice(0, 400)],
          );
        } catch {
          // org ikke uuid — view-loggen er best-effort.
        }
        void publishEvent({
          pool,
          organizationId: String(row.organization_id),
          type: "proposal.opened",
          leadId: String(row.lead_id),
          actorUserId: null,
          data: {
            proposal_id: String(row.id),
            occurred_at: new Date().toISOString(),
          },
        });
      }

      // Branding: prøv organizations-oppslag (uuid), fall til Leadgrid.
      let branding = { name: "Leadgrid", primary_color: "#7c3aed", sender_name: null as string | null };
      try {
        const b = await pool.query<{ name: string; primary_color: string; sender_name: string | null }>(
          `SELECT o.name,
                  COALESCE(eb.brand_primary_color, o.brand_color, '#7c3aed') AS primary_color,
                  eb.sender_full_name AS sender_name
             FROM organizations o
             LEFT JOIN leadgrid_email_branding_config eb ON eb.org_key = o.id::text
            WHERE o.id = $1::uuid`,
          [row.organization_id],
        );
        if (b.rows[0]) branding = b.rows[0];
      } catch {
        // org er slug/user-id — behold default-branding.
      }

      return renderProposalPdf(
        res,
        {
          title: String(row.title ?? ""),
          message: String(row.message ?? ""),
          lines: parseLines(row.lines),
          total_amount_nok: Number(row.total_amount_nok ?? 0),
          valid_until: row.valid_until ? String(row.valid_until) : null,
          created_at: row.created_at instanceof Date ? row.created_at : new Date(),
        },
        String(row.lead_name ?? ""),
        branding,
      );
    } catch (err) {
      console.error("[proposals] public GET failed:", err);
      return res.status(500).send("Noe gikk galt");
    }
  });
}
