/**
 * lead-export-routes.ts
 *
 * Eksport av leads til CSV eller PDF for rapportering.
 *
 *   GET /api/leadgrid/leads/export
 *       ?format=csv|pdf
 *       &period=7d|30d|90d|all
 *       &status=all|won|lost|in_pipeline|active
 *       &assigned_user_id=<uuid> (valgfri filtrering på spesifikk rep)
 *       &team_leader_id=<uuid>   (valgfri)
 *
 *   GET /api/leadgrid/leads/export-summary  (PDF KPI-rapport)
 *       ?period=30d
 *
 * PDF bruker pdfkit + org-branding (logo, farger, signatur).
 * CSV følger standard Excel-kompatibelt format (UTF-8 BOM + semikolon).
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import PDFDocument from "pdfkit";

type SessionData = { userId: string; role?: string; email?: string };
interface Deps { app: Express; pool: Pool; activeSessions: Map<string, SessionData>; }

function getSession(req: Request, sessions: Map<string, SessionData>): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return sessions.get(auth.substring(7)) ?? null;
  const t = (req as any).cookies?.sessionToken;
  return t ? sessions.get(t) ?? null : null;
}

async function getOrgId(pool: Pool, userId: string): Promise<string | null> {
  const r = await pool.query<{ organization_id: string }>(
    `SELECT organization_id::text FROM organization_members
      WHERE user_id = $1 ORDER BY role = 'owner' DESC LIMIT 1`,
    [userId],
  );
  return r.rows[0]?.organization_id ?? null;
}

async function getOrgBranding(pool: Pool, orgId: string): Promise<{
  name: string; logo_url: string | null; primary_color: string; sender_name: string | null;
}> {
  const r = await pool.query(
    `SELECT o.name, o.logo_url,
            COALESCE(eb.brand_primary_color, o.brand_color, '#a78bfa') AS primary_color,
            eb.sender_full_name AS sender_name
       FROM organizations o
       LEFT JOIN leadgrid_email_branding_config eb ON eb.org_key = o.id::text
      WHERE o.id = $1`,
    [orgId],
  );
  return r.rows[0] ?? { name: "Leadgrid", logo_url: null,
                         primary_color: "#a78bfa", sender_name: null };
}

interface LeadRow {
  id: string; name: string; email: string | null; phone: string | null;
  website_url: string | null;
  status: string; lead_category: string | null;
  ai_opportunity_score: number | null;
  assigned_team_leader_name: string | null;
  assigned_rep_name: string | null;
  assignment_note: string | null;
  contacted_at: string | null;
  meeting_booked_at: string | null;
  proposal_sent_at: string | null;
  won_at: string | null; won_amount_oere: number | null; won_recurring_oere: number | null;
  lost_at: string | null; lost_reason: string | null;
  created_at: string;
}

async function fetchLeadsForExport(pool: Pool, opts: {
  orgId: string; periodDays: number; status: string;
  assignedUserId?: string | null; teamLeaderId?: string | null;
}): Promise<LeadRow[]> {
  let where = `p.organization_id::text = $1
    AND COALESCE(c.won_at, c.lost_at, c.status_changed_at, c.created_at)
        > now() - ($2::int * INTERVAL '1 day')`;
  const params: any[] = [opts.orgId, opts.periodDays];
  let n = 3;

  if (opts.status === "won") { where += ` AND c.status = 'won'`; }
  else if (opts.status === "lost") { where += ` AND c.status = 'lost'`; }
  else if (opts.status === "in_pipeline") {
    where += ` AND c.status IN ('contacted','meeting_booked','proposal_sent','negotiating')`;
  } else if (opts.status === "active") {
    where += ` AND c.status NOT IN ('archived')`;
  }

  if (opts.assignedUserId) {
    where += ` AND c.assigned_user_id = $${n++}`; params.push(opts.assignedUserId);
  }
  if (opts.teamLeaderId) {
    where += ` AND c.assigned_team_leader_id = $${n++}`; params.push(opts.teamLeaderId);
  }

  const r = await pool.query<LeadRow>(
    `SELECT c.id::text, c.name, c.email, c.phone, c.website_url,
            c.status, c.lead_category, c.ai_opportunity_score,
            (tl.first_name || ' ' || tl.last_name) AS assigned_team_leader_name,
            (rep.first_name || ' ' || rep.last_name) AS assigned_rep_name,
            c.assignment_note,
            c.contacted_at::text, c.meeting_booked_at::text,
            c.proposal_sent_at::text,
            c.won_at::text, c.won_amount_oere, c.won_recurring_oere,
            c.lost_at::text, c.lost_reason,
            c.created_at::text
       FROM crm_customers c
       JOIN casting_projects p ON p.id = c.project_id
       LEFT JOIN users tl  ON tl.id = c.assigned_team_leader_id
       LEFT JOIN users rep ON rep.id = c.assigned_user_id
      WHERE ${where}
      ORDER BY c.created_at DESC LIMIT 1000`,
    params,
  );
  return r.rows;
}

// ============================================================
// CSV
// ============================================================
function escapeCsv(v: any): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s.includes(";") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function leadsToCsv(rows: LeadRow[]): string {
  const headers = [
    "Bedrift", "E-post", "Telefon", "Nettside",
    "Status", "Tier", "Score",
    "Teamleder", "Rep", "Notat",
    "Kontaktet", "Møte booket", "Forslag sendt",
    "Vunnet", "Vunnet kr", "Vunnet kr/mnd",
    "Tapt", "Tapt-årsak",
    "Opprettet",
  ];
  const lines = [
    "﻿" + headers.join(";"), // BOM for Excel
  ];
  for (const r of rows) {
    lines.push([
      r.name, r.email, r.phone, r.website_url,
      r.status, r.lead_category, r.ai_opportunity_score,
      r.assigned_team_leader_name, r.assigned_rep_name, r.assignment_note,
      r.contacted_at, r.meeting_booked_at, r.proposal_sent_at,
      r.won_at, r.won_amount_oere ? (r.won_amount_oere / 100) : null,
      r.won_recurring_oere ? (r.won_recurring_oere / 100) : null,
      r.lost_at, r.lost_reason,
      r.created_at,
    ].map(escapeCsv).join(";"));
  }
  return lines.join("\r\n");
}

// ============================================================
// PDF (lead-liste)
// ============================================================
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3
    ? h.split("").map((c) => c + c).join("")
    : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

async function renderLeadsPdf(
  res: Response, rows: LeadRow[],
  branding: Awaited<ReturnType<typeof getOrgBranding>>,
  meta: { period_label: string; status_label: string; total: number },
): Promise<void> {
  const doc = new PDFDocument({
    margin: 40, size: "A4", layout: "landscape",
    info: { Title: `Lead-eksport — ${branding.name}` },
  });
  const filename = `leads-${new Date().toISOString().slice(0, 10)}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  doc.pipe(res);

  const [r, g, b] = hexToRgb(branding.primary_color);

  // Header
  doc.fontSize(20).fillColor(branding.primary_color)
     .text(branding.name, 40, 40);
  doc.fontSize(10).fillColor("#666")
     .text("Lead-eksport · " + meta.period_label, 40, 65);
  doc.fontSize(9).fillColor("#999")
     .text(`Generert ${new Date().toLocaleString("no-NO")} · ${meta.total} leads`, 40, 80);

  doc.strokeColor(branding.primary_color).lineWidth(2)
     .moveTo(40, 100).lineTo(802, 100).stroke();

  // Tabell-headers
  const cols = [
    { key: "name",        label: "Bedrift",   width: 130 },
    { key: "status",      label: "Status",    width: 75 },
    { key: "tier",        label: "Tier",      width: 50 },
    { key: "rep",         label: "Rep",       width: 110 },
    { key: "contacted",   label: "Kontaktet", width: 75 },
    { key: "won_kr",      label: "Vunnet kr", width: 75 },
    { key: "lost_reason", label: "Tapt-årsak", width: 90 },
    { key: "created",     label: "Opprettet", width: 70 },
  ];

  let y = 115;
  doc.fontSize(8).fillColor("#fff");
  let x = 40;
  doc.rect(40, y - 2, 762, 16).fill(branding.primary_color);
  for (const c of cols) {
    doc.fillColor("#fff").text(c.label, x + 4, y, { width: c.width - 8 });
    x += c.width;
  }
  y += 20;

  for (let i = 0; i < rows.length; i++) {
    if (y > 540) {
      doc.addPage();
      y = 40;
    }
    const row = rows[i];
    if (i % 2 === 0) {
      doc.rect(40, y - 2, 762, 16).fill("#f8f8fc");
    }
    doc.fillColor("#222").fontSize(8);
    x = 40;
    const fields: Record<string, string> = {
      name: row.name?.slice(0, 50) ?? "",
      status: row.status,
      tier: row.lead_category ?? "",
      rep: row.assigned_rep_name ?? row.assigned_team_leader_name ?? "—",
      contacted: row.contacted_at?.slice(0, 10) ?? "",
      won_kr: row.won_amount_oere ? `${(row.won_amount_oere / 100).toLocaleString("no-NO")}` : "",
      lost_reason: row.lost_reason ?? "",
      created: row.created_at?.slice(0, 10) ?? "",
    };
    for (const c of cols) {
      doc.text(fields[c.key] ?? "", x + 4, y, { width: c.width - 8, ellipsis: true });
      x += c.width;
    }
    y += 16;
  }

  // Footer
  const pageCount = (doc as any)._pageBufferStart !== undefined
    ? (doc as any).bufferedPageRange().count : 1;
  for (let i = 0; i < pageCount; i++) {
    doc.switchToPage(i);
    doc.fontSize(8).fillColor("#999")
       .text(`Generert via Leadgrid · ${branding.name}`,
             40, 555, { align: "left" });
    doc.text(`Side ${i + 1} av ${pageCount}`, 0, 555,
             { align: "right", width: 802 });
  }

  doc.end();
}

// ============================================================
// PDF (KPI-rapport)
// ============================================================
async function renderSummaryPdf(
  res: Response, summary: any,
  branding: Awaited<ReturnType<typeof getOrgBranding>>,
  periodLabel: string,
): Promise<void> {
  const doc = new PDFDocument({
    margin: 50, size: "A4",
    info: { Title: `Salgs-rapport — ${branding.name}` },
  });
  const filename = `salgs-rapport-${new Date().toISOString().slice(0, 10)}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  doc.pipe(res);

  // Header
  doc.fontSize(28).fillColor(branding.primary_color)
     .text("Salgs-rapport", 50, 60);
  doc.fontSize(14).fillColor("#333")
     .text(branding.name, 50, 95);
  doc.fontSize(10).fillColor("#888")
     .text(periodLabel, 50, 115);
  doc.fontSize(8).fillColor("#aaa")
     .text(`Generert ${new Date().toLocaleString("no-NO")}`, 50, 130);

  doc.strokeColor(branding.primary_color).lineWidth(2)
     .moveTo(50, 150).lineTo(545, 150).stroke();

  // KPI-cards
  let y = 170;
  const kpis = [
    { label: "Vunnet", value: summary.won_count, color: "#16a34a" },
    { label: "Tapt", value: summary.lost_count, color: "#dc2626" },
    {
      label: "Sum vunnet",
      value: `${((Number(summary.total_won_oere) || 0) / 100).toLocaleString("no-NO")} kr`,
      color: branding.primary_color,
    },
    {
      label: "Win-rate",
      value: `${Math.round((summary.win_rate || 0) * 100)} %`,
      color: "#d97706",
    },
  ];

  const cardW = 120;
  for (let i = 0; i < kpis.length; i++) {
    const x = 50 + i * (cardW + 5);
    doc.rect(x, y, cardW, 70).fillAndStroke("#fafafd", "#e5e7eb");
    doc.fontSize(9).fillColor("#666").text(kpis[i].label, x + 10, y + 12);
    doc.fontSize(22).fillColor(kpis[i].color)
       .text(String(kpis[i].value), x + 10, y + 28, { width: cardW - 20 });
  }
  y += 90;

  // Top selgere
  if (summary.top_reps?.length > 0) {
    doc.fontSize(14).fillColor("#222").text("Topp selgere", 50, y);
    y += 25;
    summary.top_reps.forEach((r: any, i: number) => {
      const medalColor = i === 0 ? "#fbbf24" : i === 1 ? "#9ca3af"
                       : i === 2 ? "#b45309" : "#666";
      doc.fontSize(11).fillColor(medalColor).text(`#${i + 1}`, 50, y);
      doc.fontSize(11).fillColor("#222")
         .text(`${r.first_name ?? ""} ${r.last_name ?? ""}`.trim(),
               90, y, { width: 220 });
      doc.text(`${r.won_count} vunnet · ${((Number(r.won_amount_oere) || 0) / 100).toLocaleString("no-NO")} kr`,
               320, y, { width: 200, align: "right" });
      y += 20;
    });
    y += 10;
  }

  // Lost-årsaker
  if (summary.top_lost_reasons?.length > 0) {
    doc.fontSize(14).fillColor("#222").text("Hvorfor vi tapte", 50, y);
    y += 25;
    const lostLabels: Record<string, string> = {
      no_budget: "Ingen budsjett", no_decision_maker: "Ingen avgjørelsestaker",
      no_timeline: "Ingen tidshorisont", competitor: "Tapt til konkurrent",
      bad_fit: "Dårlig fit", unresponsive: "Ikke responderer",
      too_expensive: "For dyrt", other: "Annet",
    };
    summary.top_lost_reasons.forEach((r: any) => {
      doc.fontSize(11).fillColor("#222")
         .text(lostLabels[r.lost_reason] ?? r.lost_reason, 50, y, { width: 350 });
      doc.fillColor("#dc2626").text(`${r.n}`, 400, y, { width: 100, align: "right" });
      y += 20;
    });
    y += 10;
  }

  // Konverterings-trakt
  if (summary.funnel) {
    doc.fontSize(14).fillColor("#222").text("Konverterings-trakt", 50, y);
    y += 25;
    const funnel = [
      ["Nye leads", summary.funnel.new_leads],
      ["Kontaktet", summary.funnel.contacted],
      ["Møte booket", summary.funnel.meeting_booked],
      ["Forslag sendt", summary.funnel.proposal_sent],
      ["I forhandling", summary.funnel.negotiating],
      ["Vunnet", summary.funnel.won],
    ];
    const maxN = Math.max(1, ...funnel.map((f) => Number(f[1]) || 0));
    funnel.forEach(([label, n]) => {
      const v = Number(n) || 0;
      const pct = v / maxN;
      doc.fontSize(10).fillColor("#333").text(String(label), 50, y, { width: 100 });
      doc.rect(160, y - 2, 300, 14).fill("#f0f0f5");
      doc.rect(160, y - 2, 300 * pct, 14).fill(branding.primary_color);
      doc.fontSize(10).fillColor("#222").text(String(v), 470, y);
      y += 20;
    });
  }

  // Footer
  doc.fontSize(8).fillColor("#aaa")
     .text(`Generert via Leadgrid · ${branding.sender_name ?? branding.name}`,
           50, 780, { align: "center", width: 495 });

  doc.end();
}

// ============================================================
// ROUTES
// ============================================================
export function registerLeadExportRoutes({ app, pool, activeSessions }: Deps): void {

  app.get("/api/leadgrid/leads/export", async (req, res) => {
    const s = getSession(req, activeSessions);
    if (!s) return res.status(401).json({ error: "Ikke innlogget" });
    const orgId = await getOrgId(pool, s.userId);
    if (!orgId) return res.status(403).json({ error: "Ikke i noen org" });

    const format = (req.query.format as string) ?? "csv";
    const period = (req.query.period as string) ?? "30d";
    const status = (req.query.status as string) ?? "all";
    const days = period === "all" ? 36500
               : period === "7d"  ? 7
               : period === "90d" ? 90 : 30;

    const rows = await fetchLeadsForExport(pool, {
      orgId, periodDays: days, status,
      assignedUserId: (req.query.assigned_user_id as string) || null,
      teamLeaderId: (req.query.team_leader_id as string) || null,
    });

    if (format === "csv") {
      const filename = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(leadsToCsv(rows));
      return;
    }

    if (format === "pdf") {
      const branding = await getOrgBranding(pool, orgId);
      await renderLeadsPdf(res, rows, branding, {
        period_label: `Periode: siste ${period}`,
        status_label: status,
        total: rows.length,
      });
      return;
    }

    res.status(400).json({ error: "format må være 'csv' eller 'pdf'" });
  });

  app.get("/api/leadgrid/leads/export-summary", async (req, res) => {
    const s = getSession(req, activeSessions);
    if (!s) return res.status(401).json({ error: "Ikke innlogget" });
    const orgId = await getOrgId(pool, s.userId);
    if (!orgId) return res.status(403).json({ error: "Ikke i noen org" });

    const period = (req.query.period as string) ?? "30d";

    // Reuse won-lost-stats-logic ved å kjøre samme query
    const days = period === "7d" ? 7 : period === "90d" ? 90 : 30;
    const summary = await pool.query<any>(
      `WITH base AS (
         SELECT c.* FROM crm_customers c
         JOIN casting_projects p ON p.id = c.project_id
         WHERE p.organization_id::text = $1
           AND COALESCE(c.won_at, c.lost_at, c.status_changed_at)
               > now() - ($2::int * INTERVAL '1 day')
       )
       SELECT
         COUNT(*) FILTER (WHERE status = 'won') AS won_count,
         COUNT(*) FILTER (WHERE status = 'lost') AS lost_count,
         COALESCE(SUM(won_amount_oere) FILTER (WHERE status = 'won'), 0) AS total_won_oere,
         COALESCE(SUM(won_recurring_oere) FILTER (WHERE status = 'won'), 0) AS total_recurring_oere
        FROM base`,
      [orgId, days],
    );
    const stats = summary.rows[0];
    const winRate = Number(stats.won_count)
      / Math.max(1, Number(stats.won_count) + Number(stats.lost_count));

    const lostR = await pool.query(
      `SELECT lost_reason, COUNT(*) AS n FROM crm_customers c
       JOIN casting_projects p ON p.id = c.project_id
       WHERE p.organization_id::text = $1 AND status = 'lost'
         AND lost_at > now() - ($2::int * INTERVAL '1 day')
       GROUP BY lost_reason ORDER BY n DESC LIMIT 5`,
      [orgId, days],
    );
    const repR = await pool.query(
      `SELECT u.first_name, u.last_name,
              COUNT(*) FILTER (WHERE c.status = 'won') AS won_count,
              COALESCE(SUM(c.won_amount_oere) FILTER (WHERE c.status = 'won'), 0) AS won_amount_oere
         FROM crm_customers c
         JOIN casting_projects p ON p.id = c.project_id
         LEFT JOIN users u ON u.id = c.assigned_user_id
        WHERE p.organization_id::text = $1
          AND c.assigned_user_id IS NOT NULL
          AND COALESCE(c.won_at, c.lost_at) > now() - ($2::int * INTERVAL '1 day')
        GROUP BY u.first_name, u.last_name
        HAVING COUNT(*) FILTER (WHERE c.status = 'won') > 0
        ORDER BY won_amount_oere DESC LIMIT 5`,
      [orgId, days],
    );
    const funnelR = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status IN ('new', 'lead', 'active')) AS new_leads,
         COUNT(*) FILTER (WHERE status = 'contacted') AS contacted,
         COUNT(*) FILTER (WHERE status = 'meeting_booked') AS meeting_booked,
         COUNT(*) FILTER (WHERE status = 'proposal_sent') AS proposal_sent,
         COUNT(*) FILTER (WHERE status = 'negotiating') AS negotiating,
         COUNT(*) FILTER (WHERE status = 'won') AS won,
         COUNT(*) FILTER (WHERE status = 'lost') AS lost
        FROM crm_customers c
        JOIN casting_projects p ON p.id = c.project_id
       WHERE p.organization_id::text = $1
         AND c.created_at > now() - ($2::int * INTERVAL '1 day')`,
      [orgId, days],
    );

    const branding = await getOrgBranding(pool, orgId);
    await renderSummaryPdf(res, {
      ...stats, win_rate: winRate,
      top_lost_reasons: lostR.rows,
      top_reps: repR.rows,
      funnel: funnelR.rows[0],
    }, branding, `Periode: siste ${period}`);
  });
}
