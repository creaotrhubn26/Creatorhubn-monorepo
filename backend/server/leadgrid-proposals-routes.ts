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
import { LEADGRID_LOGO_BUFFER } from "./leadgrid-brand-assets.js";

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

/**
 * Branded e-post-HTML (redesign 2026-07-03) — samme visuelle språk som
 * PDF-en: accent-topplinje, chip, linje-tabell m/ mva-oppstilling og
 * stor CTA. Ingen emoji (designregel). Inline-styles for e-post-klienter.
 */
function proposalEmailHtml(opts: {
  leadName: string;
  title: string;
  message: string;
  lines: ProposalLine[];
  totalNok: number;
  senderName: string;
  orgName: string;
  accent: string;
  url: string;
  validUntil: string | null;
  /** Hostet logo-URL (org-egen eller Leadgrid-lockup). Null → tekst-navn. */
  logoUrl: string | null;
}): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const accent = /^#[0-9a-fA-F]{6}$/.test(opts.accent) ? opts.accent : "#7c3aed";
  const zebra = tint(accent, 0.94);
  const vat = Math.round(opts.totalNok * 0.25);
  const msgHtml = esc(opts.message).replace(/\n/g, "<br>");

  const lineRows = opts.lines
    .map(
      (l, i) => `<tr style="background:${i % 2 === 0 ? zebra : "#ffffff"}">
      <td style="padding:11px 14px;font-size:14px;color:#151221">${esc(l.description)}</td>
      <td style="padding:11px 14px;font-size:14px;color:#151221;font-weight:600;text-align:right;white-space:nowrap">${fmtNok(l.amount_nok)} kr</td>
    </tr>`,
    )
    .join("");

  return `<div style="background:#f4f3f8;padding:28px 12px">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;font-family:-apple-system,'Segoe UI',Roboto,sans-serif">
    <div style="height:7px;background:${accent}"></div>
    <div style="padding:28px 32px 32px">
      ${opts.logoUrl
        ? `<img src="${opts.logoUrl}" alt="${esc(opts.orgName)}" height="52" style="display:block;height:52px;max-width:260px;object-fit:contain">`
        : `<div style="font-size:17px;font-weight:800;color:#151221">${esc(opts.orgName)}</div>`}
      <div style="display:inline-block;background:${accent};color:#ffffff;font-size:10px;font-weight:700;letter-spacing:0.6px;border-radius:10px;padding:4px 12px;margin-top:8px">TILBUD</div>

      <h1 style="font-size:22px;color:#151221;margin:22px 0 4px">${esc(opts.title)}</h1>
      <p style="color:#6b6580;font-size:13px;margin:0 0 18px">Utarbeidet for ${esc(opts.leadName)}</p>

      ${msgHtml ? `<p style="font-size:14px;line-height:1.65;color:#3c374d;margin:0 0 22px">${msgHtml}</p>` : ""}

      <table style="width:100%;border-collapse:collapse;border-top:2px solid ${accent}">
        ${lineRows}
      </table>

      <table style="width:100%;border-collapse:collapse;margin-top:14px">
        <tr>
          <td style="font-size:13px;color:#6b6580;padding:3px 14px">Sum eks. mva.</td>
          <td style="font-size:13px;color:#151221;text-align:right;padding:3px 14px">${fmtNok(opts.totalNok)} kr</td>
        </tr>
        <tr>
          <td style="font-size:13px;color:#6b6580;padding:3px 14px">Mva. 25 %</td>
          <td style="font-size:13px;color:#151221;text-align:right;padding:3px 14px">${fmtNok(vat)} kr</td>
        </tr>
      </table>
      <div style="background:${accent};border-radius:10px;padding:12px 16px;margin-top:10px">
        <table style="width:100%;border-collapse:collapse">
          <tr>
            <td style="color:#ffffff;font-size:11px;letter-spacing:0.5px">TOTALT INKL. MVA.</td>
            <td style="color:#ffffff;font-size:18px;font-weight:800;text-align:right">${fmtNok(opts.totalNok + vat)} kr</td>
          </tr>
        </table>
      </div>

      <div style="text-align:center;margin:28px 0 6px">
        <a href="${opts.url}" style="background:${accent};color:#ffffff;text-decoration:none;padding:14px 34px;border-radius:10px;font-weight:700;font-size:15px;display:inline-block">Se hele tilbudet (PDF)</a>
      </div>
      ${opts.validUntil ? `<p style="text-align:center;color:#a29cb5;font-size:12px;margin:10px 0 0">Tilbudet er gyldig til ${esc(new Date(opts.validUntil).toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric" }))}</p>` : ""}

      <hr style="border:none;border-top:1px solid #e2e0ea;margin:26px 0 16px">
      <p style="font-size:13px;color:#6b6580;margin:0">Vennlig hilsen<br><strong style="color:#151221">${esc(opts.senderName)}</strong><br>${esc(opts.orgName)}</p>
    </div>
  </div>
  <p style="text-align:center;color:#a29cb5;font-size:11px;margin:16px 0 0">Generert med Leadgrid</p>
</div>`;
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return [124, 58, 237];
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

/** Lys tint av accent-fargen — for zebra-rader og bakgrunns-kort. */
function tint(hex: string, factor: number): string {
  const [r, g, b] = hexToRgb(hex);
  const mix = (c: number) => Math.round(c + (255 - c) * factor);
  return `#${[mix(r), mix(g), mix(b)].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/** Hent org-logo (best-effort, 3s timeout) for PDF-headeren. */
async function fetchLogoBuffer(logoUrl: string | null): Promise<Buffer | null> {
  if (!logoUrl || !/^https?:\/\//.test(logoUrl)) return null;
  try {
    const resp = await fetch(logoUrl, { signal: AbortSignal.timeout(3000) });
    if (!resp.ok) return null;
    const type = resp.headers.get("content-type") ?? "";
    if (!/image\/(png|jpe?g)/.test(type)) return null;
    const buf = Buffer.from(await resp.arrayBuffer());
    return buf.length > 0 && buf.length < 2_000_000 ? buf : null;
  } catch {
    return null;
  }
}

/**
 * Branded tilbuds-PDF (redesign 2026-07-03 — «tilbudene må ha mye bedre
 * design»): accent-topplinje + chip, meta-blokk, hero-tittel,
 * mottaker-kort, zebra-tabell, full mva-oppstilling m/ totalboks,
 * gyldighets-notis og footer. Accent følger org-brandingen.
 */
function renderProposalPdf(
  res: Response,
  proposal: {
    number: string;
    title: string;
    message: string;
    lines: ProposalLine[];
    total_amount_nok: number;
    valid_until: string | null;
    created_at: Date;
  },
  leadName: string,
  branding: { name: string; primary_color: string; sender_name: string | null },
  logoBuffer: Buffer | null,
  // Lockup = logoen inneholder wordmarken (Leadgrid-default) → tegnes
  // større og org-navn-teksten droppes så navnet ikke dobles.
  logoIsLockup = false,
): void {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="tilbud.pdf"`);
  const doc = new PDFDocument({ size: "A4", margin: 0 });
  doc.pipe(res);

  const accent = /^#[0-9a-fA-F]{6}$/.test(branding.primary_color)
    ? branding.primary_color
    : "#7c3aed";
  const ink = "#151221";
  const dim = "#6b6580";
  const faint = "#a29cb5";
  const zebra = tint(accent, 0.94);
  const accentSoft = tint(accent, 0.88);
  const W = doc.page.width;
  const M = 56;
  const CW = W - M * 2;
  const longDate = (d: Date) =>
    d.toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric" });

  // Topp-accentlinje
  doc.rect(0, 0, W, 8).fill(accent);

  // Header: org-navn (+ ev. logo) + TILBUD-chip venstre, meta høyre.
  // Lockup (Leadgrid-default) tegnes større uten navnetekst ved siden.
  let y = 44;
  let drewLockup = false;
  if (logoBuffer) {
    try {
      if (logoIsLockup) {
        doc.image(logoBuffer, M - 4, y - 12, { fit: [200, 66] });
        drewLockup = true;
      } else {
        doc.image(logoBuffer, M, y - 4, { fit: [110, 36] });
        doc.fillColor(ink).font("Helvetica-Bold").fontSize(19).text(branding.name, M + 122, y);
      }
    } catch {
      doc.fillColor(ink).font("Helvetica-Bold").fontSize(19).text(branding.name, M, y);
    }
  } else {
    doc.fillColor(ink).font("Helvetica-Bold").fontSize(19).text(branding.name, M, y);
  }
  const chipY = drewLockup ? y + 60 : y + 28;
  doc.roundedRect(M, chipY, 68, 20, 10).fill(accent);
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(9)
    .text("TILBUD", M, chipY + 6, { width: 68, align: "center" });

  const metaX = W - M - 190;
  const meta: Array<[string, string]> = [
    ["Tilbudsnr.", proposal.number],
    ["Dato", longDate(proposal.created_at)],
  ];
  if (proposal.valid_until) {
    meta.push(["Gyldig til", longDate(new Date(proposal.valid_until))]);
  }
  let my = y + 2;
  for (const [label, value] of meta) {
    doc.fillColor(faint).font("Helvetica").fontSize(8.5)
      .text(label.toUpperCase(), metaX, my, { width: 80, characterSpacing: 0.4 });
    doc.fillColor(ink).font("Helvetica-Bold").fontSize(9.5)
      .text(value, metaX + 84, my - 1, { width: 106, align: "right" });
    my += 17;
  }

  // Hero: tittel + mottaker-kort (lockup-headeren er litt høyere)
  y = drewLockup ? 152 : 128;
  doc.fillColor(ink).font("Helvetica-Bold").fontSize(24).text(proposal.title, M, y, { width: CW });
  y = doc.y + 14;

  doc.roundedRect(M, y, CW, 44, 8).fill(zebra);
  doc.fillColor(faint).font("Helvetica").fontSize(8.5)
    .text("UTARBEIDET FOR", M + 16, y + 9, { characterSpacing: 0.5 });
  doc.fillColor(ink).font("Helvetica-Bold").fontSize(13).text(leadName, M + 16, y + 21);
  if (branding.sender_name) {
    doc.fillColor(faint).font("Helvetica").fontSize(8.5)
      .text("KONTAKTPERSON", M + CW / 2, y + 9, { characterSpacing: 0.5 });
    doc.fillColor(ink).font("Helvetica").fontSize(11)
      .text(branding.sender_name, M + CW / 2, y + 22);
  }
  y += 62;

  // Melding
  if (proposal.message) {
    doc.fillColor(dim).font("Helvetica").fontSize(10.5)
      .text(proposal.message, M, y, { width: CW, lineGap: 3.5 });
    y = doc.y + 24;
  }

  // Tabell
  const colNum = M;
  const colDesc = M + 34;
  const colAmt = W - M - 120;
  doc.fillColor(faint).font("Helvetica-Bold").fontSize(8.5);
  doc.text("#", colNum, y, { width: 26 });
  doc.text("BESKRIVELSE", colDesc, y, { characterSpacing: 0.5 });
  doc.text("BELØP EKS. MVA.", colAmt, y, { width: 120, align: "right", characterSpacing: 0.5 });
  y += 15;
  doc.moveTo(M, y).lineTo(W - M, y).lineWidth(1.2).strokeColor(accent).stroke();
  y += 2;

  proposal.lines.forEach((line, i) => {
    const rowH = Math.max(
      30,
      doc.heightOfString(line.description, { width: colAmt - colDesc - 16, lineGap: 2 }) + 16,
    );
    if (y + rowH > 700) {
      doc.addPage();
      doc.rect(0, 0, W, 8).fill(accent);
      y = 44;
    }
    if (i % 2 === 0) doc.rect(M, y, CW, rowH).fill(zebra);
    doc.fillColor(faint).font("Helvetica").fontSize(9.5)
      .text(String(i + 1).padStart(2, "0"), colNum + 6, y + 9);
    doc.fillColor(ink).font("Helvetica").fontSize(10.5)
      .text(line.description, colDesc, y + 8, { width: colAmt - colDesc - 16, lineGap: 2 });
    doc.fillColor(ink).font("Helvetica-Bold").fontSize(10.5)
      .text(`${fmtNok(line.amount_nok)} kr`, colAmt, y + 8, { width: 120, align: "right" });
    y += rowH;
  });
  doc.moveTo(M, y).lineTo(W - M, y).lineWidth(0.7).strokeColor("#e2e0ea").stroke();
  y += 14;

  // Sum-oppstilling m/ mva
  const sumW = 250;
  const sumX = W - M - sumW;
  const subtotal = proposal.total_amount_nok;
  const vat = Math.round(subtotal * 0.25);
  const totalIncl = subtotal + vat;

  doc.fillColor(dim).font("Helvetica").fontSize(10).text("Sum eks. mva.", sumX, y, { width: sumW - 110 });
  doc.fillColor(ink).font("Helvetica").fontSize(10)
    .text(`${fmtNok(subtotal)} kr`, sumX + sumW - 110, y, { width: 110, align: "right" });
  y += 18;
  doc.fillColor(dim).font("Helvetica").fontSize(10).text("Mva. 25 %", sumX, y, { width: sumW - 110 });
  doc.fillColor(ink).font("Helvetica").fontSize(10)
    .text(`${fmtNok(vat)} kr`, sumX + sumW - 110, y, { width: 110, align: "right" });
  y += 22;
  doc.roundedRect(sumX, y, sumW, 38, 8).fill(accent);
  doc.fillColor("#ffffff").font("Helvetica").fontSize(9)
    .text("TOTALT INKL. MVA.", sumX + 14, y + 8, { characterSpacing: 0.5 });
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(15)
    .text(`${fmtNok(totalIncl)} kr`, sumX, y + 15, { width: sumW - 14, align: "right" });
  y += 56;

  // Gyldighets-notis
  if (proposal.valid_until) {
    doc.roundedRect(M, y, CW, 30, 6).fill(accentSoft);
    doc.fillColor(ink).font("Helvetica").fontSize(9.5)
      .text(
        `Tilbudet er gyldig til ${longDate(new Date(proposal.valid_until))}. Priser er oppgitt eks. mva. der annet ikke er nevnt.`,
        M + 14, y + 10, { width: CW - 28 },
      );
  }

  // Footer
  const fy = doc.page.height - 64;
  doc.moveTo(M, fy).lineTo(W - M, fy).lineWidth(0.7).strokeColor("#e2e0ea").stroke();
  doc.fillColor(faint).font("Helvetica").fontSize(8)
    .text(branding.sender_name ? `${branding.name} · ${branding.sender_name}` : branding.name,
          M, fy + 10, { width: CW / 2 });
  doc.fillColor(faint).font("Helvetica").fontSize(8)
    .text("Generert med Leadgrid", M + CW / 2, fy + 10, { width: CW / 2, align: "right" });

  doc.end();
}

export function registerLeadgridProposalsRoutes(deps: ProposalsRoutesDeps): void {
  const { app, pool, requireUserSession } = deps;

  // ── GET /api/leadgrid/assets/logo.png — Leadgrid-lockup for e-post ──
  // (Gmail o.l. stripper data-URIer, så e-posten trenger en hostet URL.)
  app.get("/api/leadgrid/assets/logo.png", (_req, res) => {
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(LEADGRID_LOGO_BUFFER);
  });

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
      // Org-branding (accent/navn) — best-effort, default Leadgrid-lilla.
      let orgName = "Leadgrid";
      let accent = "#7c3aed";
      let emailLogoUrl: string | null = `${publicBackendBase()}/api/leadgrid/assets/logo.png`;
      try {
        const b = await pool.query<{ name: string; primary_color: string; logo_url: string | null }>(
          `SELECT o.name,
                  COALESCE(eb.brand_primary_color, o.brand_color, '#7c3aed') AS primary_color,
                  o.logo_url
             FROM organizations o
             LEFT JOIN leadgrid_email_branding_config eb ON eb.org_key = o.id::text
            WHERE o.id = $1::uuid`,
          [orgId],
        );
        if (b.rows[0]) {
          orgName = b.rows[0].name;
          accent = b.rows[0].primary_color;
          // Org-egen logo når den finnes; ellers tekst-navn (Leadgrid-
          // lockup-en gjelder kun default-brandingen).
          emailLogoUrl = b.rows[0].logo_url;
        }
      } catch {
        // org er slug/user-id — behold Leadgrid-default.
      }
      const url = `${publicBackendBase()}/api/leadgrid/p/${token}`;
      const senderName = session.name || "Salgsteamet";
      const emailResult = await sendTransactionalEmail({
        to: toEmail,
        subject: `Tilbud: ${title}`,
        html: proposalEmailHtml({
          leadName: lead.name, title, message, lines, totalNok: total,
          senderName, orgName, accent, url, validUntil, logoUrl: emailLogoUrl,
        }),
        text: `${title}\n\nTilbud til ${lead.name}.\n\n${message}\n\nSum eks. mva.: ${fmtNok(total)} kr\nMva. 25 %: ${fmtNok(Math.round(total * 0.25))} kr\nTotalt inkl. mva.: ${fmtNok(total + Math.round(total * 0.25))} kr\n\nSe tilbudet: ${url}\n\nVennlig hilsen\n${senderName}\n${orgName}`,
        fromLabel: orgName,
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
      let branding = {
        name: "Leadgrid",
        primary_color: "#7c3aed",
        sender_name: null as string | null,
        logo_url: null as string | null,
      };
      try {
        const b = await pool.query<{
          name: string; primary_color: string; sender_name: string | null; logo_url: string | null;
        }>(
          `SELECT o.name,
                  COALESCE(eb.brand_primary_color, o.brand_color, '#7c3aed') AS primary_color,
                  eb.sender_full_name AS sender_name,
                  o.logo_url
             FROM organizations o
             LEFT JOIN leadgrid_email_branding_config eb ON eb.org_key = o.id::text
            WHERE o.id = $1::uuid`,
          [row.organization_id],
        );
        if (b.rows[0]) branding = b.rows[0];
      } catch {
        // org er slug/user-id — behold default-branding.
      }
      let logoBuffer = await fetchLogoBuffer(branding.logo_url);
      let logoIsLockup = false;
      if (!logoBuffer && branding.name === "Leadgrid") {
        // Default-branding (org uten rad i organizations) → Leadgrid-lockup.
        logoBuffer = LEADGRID_LOGO_BUFFER;
        logoIsLockup = true;
      }

      return renderProposalPdf(
        res,
        {
          number: `T-${String(row.id).slice(0, 8).toUpperCase()}`,
          title: String(row.title ?? ""),
          message: String(row.message ?? ""),
          lines: parseLines(row.lines),
          total_amount_nok: Number(row.total_amount_nok ?? 0),
          valid_until: row.valid_until ? String(row.valid_until) : null,
          created_at: row.created_at instanceof Date ? row.created_at : new Date(),
        },
        String(row.lead_name ?? ""),
        branding,
        logoBuffer,
        logoIsLockup,
      );
    } catch (err) {
      console.error("[proposals] public GET failed:", err);
      return res.status(500).send("Noe gikk galt");
    }
  });
}
