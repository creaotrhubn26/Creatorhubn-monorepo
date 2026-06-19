/**
 * leadgrid-scheduled-reports-routes.ts
 *
 * Schedulerte rapporter — markedssjefer abonnerer på ukentlige/månedlige
 * PDF-rapporter på e-post.
 *
 * Endepunkter:
 *   GET    /api/leadgrid/scheduled-reports                 (mine + org sine)
 *   POST   /api/leadgrid/scheduled-reports                 (opprett)
 *   PUT    /api/leadgrid/scheduled-reports/:id             (oppdater)
 *   DELETE /api/leadgrid/scheduled-reports/:id             (slett)
 *   POST   /api/leadgrid/scheduled-reports/:id/send-now    (force send)
 *
 *   POST   /api/leadgrid/scheduled-reports/run             (cron-trigger,
 *                                                          x-cron-trigger-token)
 *
 * Cron-endepunktet henter alle due subscriptions (next_send_at <= now()),
 * genererer PDF in-memory via pdfkit, og sender på e-post via Resend.
 *
 * Beregner next_send_at basert på frequency + day_of_week/month + time_of_day.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import PDFDocument from "pdfkit";

type SessionData = { userId: string; role?: string; email?: string };
interface Deps { app: Express; pool: Pool; activeSessions: Map<string, SessionData>; }

const CRON_TOKEN = process.env.LEADGRID_CRON_TRIGGER_TOKEN ?? "";

function getSession(req: Request, sessions: Map<string, SessionData>): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return sessions.get(auth.substring(7)) ?? null;
  const t = (req as any).cookies?.sessionToken;
  return t ? sessions.get(t) ?? null : null;
}

function isCronAuthorized(req: Request): boolean {
  const t = req.headers["x-cron-trigger-token"] as string | undefined;
  return !!t && !!CRON_TOKEN && t === CRON_TOKEN;
}

async function getOrgId(pool: Pool, userId: string): Promise<string | null> {
  const r = await pool.query<{ organization_id: string }>(
    `SELECT organization_id::text FROM organization_members
      WHERE user_id = $1 ORDER BY role = 'owner' DESC LIMIT 1`,
    [userId],
  );
  return r.rows[0]?.organization_id ?? null;
}

/** Beregn neste send-tidspunkt basert på frequency. */
function computeNextSendAt(s: {
  frequency: string; day_of_week: number | null; day_of_month: number | null;
  time_of_day: string;
}): Date {
  const [hh, mm] = (s.time_of_day || "08:00").split(":").map(Number);
  const now = new Date();
  const next = new Date(now);
  next.setHours(hh, mm, 0, 0);

  if (s.frequency === "daily") {
    if (next <= now) next.setDate(next.getDate() + 1);
  } else if (s.frequency === "weekly") {
    const targetDow = s.day_of_week ?? 1; // Monday default
    const daysAhead = (targetDow - next.getDay() + 7) % 7 || 7;
    next.setDate(next.getDate() + daysAhead);
  } else if (s.frequency === "monthly") {
    const targetDay = s.day_of_month ?? 1;
    next.setDate(targetDay);
    if (next <= now) next.setMonth(next.getMonth() + 1);
  }
  return next;
}

interface SummaryData {
  won_count: string; lost_count: string;
  total_won_oere: string; total_recurring_oere: string;
  win_rate: number;
  top_lost_reasons: { lost_reason: string; n: string }[];
  top_reps: { first_name: string; last_name: string;
              won_count: string; won_amount_oere: string }[];
  funnel: any;
}

// ============================================================
// Lead-liste til CSV (for 'leads_list' og 'both')
// ============================================================
async function buildLeadsCsv(
  pool: Pool, orgId: string, periodDays: number, statusFilter: string,
): Promise<string> {
  let statusClause = "";
  if (statusFilter === "won") statusClause = " AND c.status = 'won'";
  else if (statusFilter === "lost") statusClause = " AND c.status = 'lost'";
  else if (statusFilter === "in_pipeline") {
    statusClause = " AND c.status IN ('contacted','meeting_booked','proposal_sent','negotiating')";
  } else if (statusFilter === "active") {
    statusClause = " AND c.status NOT IN ('archived')";
  }

  const r = await pool.query(
    `SELECT c.name, c.email, c.phone, c.website_url,
            c.status, c.lead_category, c.ai_opportunity_score,
            (tl.first_name || ' ' || tl.last_name) AS tl_name,
            (rep.first_name || ' ' || rep.last_name) AS rep_name,
            c.assignment_note,
            c.contacted_at::text, c.meeting_booked_at::text,
            c.proposal_sent_at::text,
            c.won_at::text, c.won_amount_oere, c.won_recurring_oere,
            c.lost_at::text, c.lost_reason, c.lost_reason_detail,
            c.created_at::text
       FROM crm_customers c
       JOIN casting_projects p ON p.id = c.project_id
       LEFT JOIN users tl  ON tl.id = c.assigned_team_leader_id
       LEFT JOIN users rep ON rep.id = c.assigned_user_id
      WHERE p.organization_id::text = $1
        AND COALESCE(c.won_at, c.lost_at, c.status_changed_at, c.created_at)
            > now() - ($2::int * INTERVAL '1 day')
        ${statusClause}
      ORDER BY c.created_at DESC LIMIT 2000`,
    [orgId, periodDays],
  );

  const escape = (v: any): string => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (s.includes(";") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const headers = [
    "Bedrift", "E-post", "Telefon", "Nettside",
    "Status", "Tier", "Score",
    "Teamleder", "Rep", "Notat",
    "Kontaktet", "Møte booket", "Forslag sendt",
    "Vunnet", "Vunnet kr", "Vunnet kr/mnd",
    "Tapt", "Tapt-årsak", "Tapt-detalj",
    "Opprettet",
  ];
  const lines = ["﻿" + headers.join(";")]; // UTF-8 BOM
  for (const row of r.rows) {
    lines.push([
      row.name, row.email, row.phone, row.website_url,
      row.status, row.lead_category, row.ai_opportunity_score,
      row.tl_name, row.rep_name, row.assignment_note,
      row.contacted_at, row.meeting_booked_at, row.proposal_sent_at,
      row.won_at,
      row.won_amount_oere ? (row.won_amount_oere / 100) : null,
      row.won_recurring_oere ? (row.won_recurring_oere / 100) : null,
      row.lost_at, row.lost_reason, row.lost_reason_detail,
      row.created_at,
    ].map(escape).join(";"));
  }
  return lines.join("\r\n");
}

async function buildSummary(pool: Pool, orgId: string, periodDays: number): Promise<SummaryData> {
  const statsR = await pool.query<any>(
    `WITH base AS (
       SELECT c.* FROM crm_customers c
       JOIN casting_projects p ON p.id = c.project_id
       WHERE p.organization_id::text = $1
         AND COALESCE(c.won_at, c.lost_at, c.status_changed_at)
             > now() - ($2::int * INTERVAL '1 day')
     )
     SELECT
       COUNT(*) FILTER (WHERE status='won') AS won_count,
       COUNT(*) FILTER (WHERE status='lost') AS lost_count,
       COALESCE(SUM(won_amount_oere) FILTER (WHERE status='won'), 0) AS total_won_oere,
       COALESCE(SUM(won_recurring_oere) FILTER (WHERE status='won'), 0) AS total_recurring_oere
      FROM base`,
    [orgId, periodDays],
  );
  const stats = statsR.rows[0];
  const winRate = Number(stats.won_count)
    / Math.max(1, Number(stats.won_count) + Number(stats.lost_count));

  const lostR = await pool.query(
    `SELECT lost_reason, COUNT(*) AS n FROM crm_customers c
     JOIN casting_projects p ON p.id = c.project_id
     WHERE p.organization_id::text = $1 AND status='lost'
       AND lost_at > now() - ($2::int * INTERVAL '1 day')
     GROUP BY lost_reason ORDER BY n DESC LIMIT 5`,
    [orgId, periodDays],
  );

  const repR = await pool.query(
    `SELECT u.first_name, u.last_name,
            COUNT(*) FILTER (WHERE c.status='won') AS won_count,
            COALESCE(SUM(c.won_amount_oere) FILTER (WHERE c.status='won'), 0) AS won_amount_oere
       FROM crm_customers c
       JOIN casting_projects p ON p.id = c.project_id
       LEFT JOIN users u ON u.id = c.assigned_user_id
      WHERE p.organization_id::text = $1
        AND c.assigned_user_id IS NOT NULL
        AND COALESCE(c.won_at, c.lost_at) > now() - ($2::int * INTERVAL '1 day')
      GROUP BY u.first_name, u.last_name
      HAVING COUNT(*) FILTER (WHERE c.status='won') > 0
      ORDER BY won_amount_oere DESC LIMIT 5`,
    [orgId, periodDays],
  );

  const funnelR = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE status IN ('new','lead','active')) AS new_leads,
       COUNT(*) FILTER (WHERE status='contacted') AS contacted,
       COUNT(*) FILTER (WHERE status='meeting_booked') AS meeting_booked,
       COUNT(*) FILTER (WHERE status='proposal_sent') AS proposal_sent,
       COUNT(*) FILTER (WHERE status='negotiating') AS negotiating,
       COUNT(*) FILTER (WHERE status='won') AS won,
       COUNT(*) FILTER (WHERE status='lost') AS lost
      FROM crm_customers c
      JOIN casting_projects p ON p.id = c.project_id
     WHERE p.organization_id::text = $1
       AND c.created_at > now() - ($2::int * INTERVAL '1 day')`,
    [orgId, periodDays],
  );

  return {
    ...stats, win_rate: winRate,
    top_lost_reasons: lostR.rows as any,
    top_reps: repR.rows as any,
    funnel: funnelR.rows[0],
  };
}

async function getOrgBranding(pool: Pool, orgId: string) {
  const r = await pool.query(
    `SELECT o.name, o.logo_url,
            COALESCE(eb.brand_primary_color, o.brand_color, '#a78bfa') AS primary_color,
            eb.sender_full_name, eb.sender_email, eb.from_name, eb.from_email
       FROM organizations o
       LEFT JOIN leadgrid_email_branding_config eb ON eb.org_key = o.id::text
      WHERE o.id = $1`,
    [orgId],
  );
  return r.rows[0] ?? { name: "Leadgrid", logo_url: null,
                         primary_color: "#a78bfa",
                         sender_full_name: null, sender_email: null,
                         from_name: "Leadgrid", from_email: null };
}

/** Render PDF KPI-rapport til Buffer (samme template som /export-summary). */
async function renderSummaryPdfToBuffer(
  summary: SummaryData, branding: any, periodLabel: string,
): Promise<Buffer> {
  return await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(28).fillColor(branding.primary_color).text("Salgs-rapport", 50, 60);
    doc.fontSize(14).fillColor("#333").text(branding.name, 50, 95);
    doc.fontSize(10).fillColor("#888").text(periodLabel, 50, 115);
    doc.fontSize(8).fillColor("#aaa")
       .text(`Generert ${new Date().toLocaleString("no-NO")}`, 50, 130);

    doc.strokeColor(branding.primary_color).lineWidth(2)
       .moveTo(50, 150).lineTo(545, 150).stroke();

    let y = 170;
    const kpis = [
      { label: "Vunnet", value: summary.won_count, color: "#16a34a" },
      { label: "Tapt", value: summary.lost_count, color: "#dc2626" },
      { label: "Sum vunnet",
        value: `${(Number(summary.total_won_oere) / 100).toLocaleString("no-NO")} kr`,
        color: branding.primary_color },
      { label: "Win-rate",
        value: `${Math.round((summary.win_rate || 0) * 100)} %`, color: "#d97706" },
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
        doc.text(`${r.won_count} vunnet · ${(Number(r.won_amount_oere) / 100).toLocaleString("no-NO")} kr`,
                 320, y, { width: 200, align: "right" });
        y += 20;
      });
      y += 10;
    }

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

    doc.fontSize(8).fillColor("#aaa")
       .text(`Generert via Leadgrid · ${branding.sender_full_name ?? branding.name}`,
             50, 780, { align: "center", width: 495 });
    doc.end();
  });
}

/** Send rapport m/ 1..N vedlegg via Resend. */
async function sendReportEmail(params: {
  to: string; orgName: string; subject: string;
  bodyHtml: string;
  attachments: Array<{ filename: string; content: Buffer | string; contentType?: string }>;
  brandPrimaryColor: string; fromName: string;
}): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const apiKey = process.env.ROLE_ROOM_RESEND_API_KEY
              ?? process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY mangler" };
  const fromAddress = process.env.ROLE_ROOM_RESEND_FROM_EMAIL
                   ?? process.env.RESEND_FROM_EMAIL
                   ?? "no-reply@theroleroom.com";

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${params.fromName} <${fromAddress}>`,
        to: [params.to],
        subject: params.subject,
        html: params.bodyHtml,
        attachments: params.attachments.map((a) => ({
          filename: a.filename,
          content: (a.content instanceof Buffer ? a.content : Buffer.from(a.content))
                    .toString("base64"),
          ...(a.contentType ? { content_type: a.contentType } : {}),
        })),
      }),
    });
    const j: any = await r.json();
    if (r.ok) return { ok: true, messageId: j.id };
    return { ok: false, error: j?.message ?? `HTTP ${r.status}` };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "send_failed" };
  }
}

function buildReportEmailHtml(opts: {
  orgName: string; periodLabel: string; primaryColor: string;
  wonCount: string; lostCount: string; totalWonKr: string; winRatePct: string;
  filename: string;
}): string {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f4f8;
font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f4f4f8;">
<tr><td style="padding:24px 16px;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%"
         style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;
                overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.06);">
    <tr><td style="background:#0a0512;padding:20px 24px;">
      <div style="color:rgba(255,255,255,0.5);font-size:10px;letter-spacing:1px;
                   text-transform:uppercase;">Leadgrid</div>
      <div style="color:${opts.primaryColor};font-weight:700;font-size:18px;margin-top:2px;">
        Ukens salgs-rapport
      </div>
    </td></tr>
    <tr><td style="padding:28px 24px 8px 24px;">
      <h1 style="color:#0a0512;margin:0;font-size:22px;line-height:1.3;font-weight:700;">
        ${opts.orgName}
      </h1>
      <div style="color:#888;font-size:12px;margin-top:4px;">${opts.periodLabel}</div>
    </td></tr>
    <tr><td style="padding:16px 24px;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td width="25%" style="padding:8px;background:#fafafd;border:1px solid #e5e7eb;text-align:center;">
            <div style="color:#666;font-size:11px;">Vunnet</div>
            <div style="color:#16a34a;font-size:22px;font-weight:800;">${opts.wonCount}</div>
          </td>
          <td width="25%" style="padding:8px;background:#fafafd;border:1px solid #e5e7eb;text-align:center;">
            <div style="color:#666;font-size:11px;">Tapt</div>
            <div style="color:#dc2626;font-size:22px;font-weight:800;">${opts.lostCount}</div>
          </td>
          <td width="25%" style="padding:8px;background:#fafafd;border:1px solid #e5e7eb;text-align:center;">
            <div style="color:#666;font-size:11px;">Sum vunnet</div>
            <div style="color:${opts.primaryColor};font-size:18px;font-weight:800;">${opts.totalWonKr}</div>
          </td>
          <td width="25%" style="padding:8px;background:#fafafd;border:1px solid #e5e7eb;text-align:center;">
            <div style="color:#666;font-size:11px;">Win-rate</div>
            <div style="color:#d97706;font-size:22px;font-weight:800;">${opts.winRatePct}</div>
          </td>
        </tr>
      </table>
    </td></tr>
    <tr><td style="padding:16px 24px;">
      <p style="color:#333;line-height:1.55;font-size:14px;">
        Full salgs-rapport for perioden er vedlagt som PDF (${opts.filename}).
        Inkluderer topp selgere, lost-årsaker og konverterings-trakt.
      </p>
    </td></tr>
    <tr><td style="padding:16px 24px 24px 24px;border-top:1px solid #eee;
                   color:#888;font-size:11px;text-align:center;">
      Sendt automatisk av Leadgrid · <a href="/admin-room" style="color:#888;">Endre abonnementet</a>
    </td></tr>
  </table>
</td></tr></table></body></html>`;
}

// ============================================================
// ROUTES
// ============================================================
export function registerLeadgridScheduledReportsRoutes({ app, pool, activeSessions }: Deps): void {

  app.get("/api/leadgrid/scheduled-reports", async (req, res) => {
    const s = getSession(req, activeSessions);
    if (!s) return res.status(401).json({ error: "Ikke innlogget" });
    const orgId = await getOrgId(pool, s.userId);
    if (!orgId) return res.status(403).json({ error: "Ikke i noen org" });
    const r = await pool.query(
      `SELECT id::text, name, report_type, period_days, status_filter,
              recipient_user_ids, recipient_emails,
              frequency, day_of_week, day_of_month, time_of_day, timezone,
              is_active, last_sent_at::text, last_send_status, last_send_error,
              next_send_at::text, created_at::text, updated_at::text,
              created_by_user_id
         FROM leadgrid_scheduled_reports
        WHERE organization_id::text = $1
        ORDER BY is_active DESC, name`,
      [orgId],
    );
    res.json({ items: r.rows });
  });

  app.post("/api/leadgrid/scheduled-reports", async (req, res) => {
    const s = getSession(req, activeSessions);
    if (!s) return res.status(401).json({ error: "Ikke innlogget" });
    const orgId = await getOrgId(pool, s.userId);
    if (!orgId) return res.status(403).json({ error: "Ikke i noen org" });
    const b = req.body ?? {};
    if (!b.name) return res.status(400).json({ error: "name påkrevd" });

    const nextSendAt = computeNextSendAt({
      frequency: b.frequency ?? "weekly",
      day_of_week: b.day_of_week ?? 1,
      day_of_month: b.day_of_month ?? null,
      time_of_day: b.time_of_day ?? "08:00",
    });

    const r = await pool.query<{ id: string }>(
      `INSERT INTO leadgrid_scheduled_reports
         (organization_id, created_by_user_id, name, report_type, period_days,
          status_filter, recipient_user_ids, recipient_emails,
          frequency, day_of_week, day_of_month, time_of_day, timezone,
          is_active, next_send_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7::text[], $8::text[], $9, $10, $11, $12, $13, $14, $15)
       RETURNING id::text`,
      [orgId, s.userId, b.name, b.report_type ?? "summary", b.period_days ?? 7,
       b.status_filter ?? "all",
       b.recipient_user_ids ?? [], b.recipient_emails ?? [],
       b.frequency ?? "weekly", b.day_of_week ?? 1, b.day_of_month ?? null,
       b.time_of_day ?? "08:00", b.timezone ?? "Europe/Oslo",
       b.is_active !== false, nextSendAt],
    );
    res.json({ ok: true, id: r.rows[0].id });
  });

  app.put("/api/leadgrid/scheduled-reports/:id", async (req, res) => {
    const s = getSession(req, activeSessions);
    if (!s) return res.status(401).json({ error: "Ikke innlogget" });
    const orgId = await getOrgId(pool, s.userId);
    if (!orgId) return res.status(403).json({ error: "Ikke i noen org" });
    const b = req.body ?? {};
    const nextSendAt = (b.frequency || b.time_of_day || b.day_of_week !== undefined)
      ? computeNextSendAt({
          frequency: b.frequency ?? "weekly",
          day_of_week: b.day_of_week ?? 1,
          day_of_month: b.day_of_month ?? null,
          time_of_day: b.time_of_day ?? "08:00",
        })
      : null;
    await pool.query(
      `UPDATE leadgrid_scheduled_reports SET
         name = COALESCE($1, name),
         report_type = COALESCE($2, report_type),
         period_days = COALESCE($3, period_days),
         status_filter = COALESCE($4, status_filter),
         recipient_user_ids = COALESCE($5::text[], recipient_user_ids),
         recipient_emails = COALESCE($6::text[], recipient_emails),
         frequency = COALESCE($7, frequency),
         day_of_week = COALESCE($8, day_of_week),
         day_of_month = COALESCE($9, day_of_month),
         time_of_day = COALESCE($10, time_of_day),
         is_active = COALESCE($11, is_active),
         next_send_at = COALESCE($12, next_send_at),
         updated_at = now()
       WHERE id = $13 AND organization_id::text = $14`,
      [b.name ?? null, b.report_type ?? null, b.period_days ?? null,
       b.status_filter ?? null, b.recipient_user_ids ?? null,
       b.recipient_emails ?? null,
       b.frequency ?? null, b.day_of_week ?? null, b.day_of_month ?? null,
       b.time_of_day ?? null, b.is_active ?? null, nextSendAt,
       req.params.id, orgId],
    );
    res.json({ ok: true });
  });

  app.delete("/api/leadgrid/scheduled-reports/:id", async (req, res) => {
    const s = getSession(req, activeSessions);
    if (!s) return res.status(401).json({ error: "Ikke innlogget" });
    const orgId = await getOrgId(pool, s.userId);
    if (!orgId) return res.status(403).json({ error: "Ikke i noen org" });
    await pool.query(
      `DELETE FROM leadgrid_scheduled_reports
        WHERE id = $1 AND organization_id::text = $2`,
      [req.params.id, orgId],
    );
    res.json({ ok: true });
  });

  app.post("/api/leadgrid/scheduled-reports/:id/send-now", async (req, res) => {
    const s = getSession(req, activeSessions);
    if (!s) return res.status(401).json({ error: "Ikke innlogget" });
    const orgId = await getOrgId(pool, s.userId);
    if (!orgId) return res.status(403).json({ error: "Ikke i noen org" });
    await pool.query(
      `UPDATE leadgrid_scheduled_reports SET next_send_at = now()
        WHERE id = $1 AND organization_id::text = $2`,
      [req.params.id, orgId],
    );
    res.json({ ok: true, queued: true });
  });

  // ============================================================
  // CRON-RUN — sender alle due rapporter
  // ============================================================
  app.post("/api/leadgrid/scheduled-reports/run", async (req, res) => {
    if (!isCronAuthorized(req)) {
      const s = getSession(req, activeSessions);
      const userR = s ? await pool.query<{ role: string }>(
        `SELECT role FROM users WHERE id = $1`, [s.userId],
      ) : null;
      if (userR?.rows[0]?.role !== "super_admin") {
        return res.status(401).json({ error: "Unauthorized" });
      }
    }

    const start = Date.now();
    const results = { due: 0, sent: 0, errors: 0 };

    try {
      const dueR = await pool.query<any>(
        `SELECT * FROM leadgrid_scheduled_reports
          WHERE is_active = TRUE AND next_send_at <= now()
          ORDER BY next_send_at LIMIT 50`,
      );
      results.due = dueR.rows.length;

      for (const sub of dueR.rows) {
        try {
          const branding = await getOrgBranding(pool, sub.organization_id);
          const periodLabel = `Periode: siste ${sub.period_days} dager`;
          const datedSuffix = new Date().toISOString().slice(0, 10);

          // Bygg vedlegg avhengig av report_type
          const attachments: Array<{ filename: string; content: Buffer | string;
                                       contentType?: string }> = [];
          let summary: SummaryData | null = null;

          if (sub.report_type === "summary" || sub.report_type === "both") {
            summary = await buildSummary(pool, sub.organization_id, sub.period_days);
            const pdf = await renderSummaryPdfToBuffer(summary, branding, periodLabel);
            attachments.push({
              filename: `salgs-rapport-${datedSuffix}.pdf`,
              content: pdf,
            });
          }

          if (sub.report_type === "leads_list" || sub.report_type === "both") {
            const csv = await buildLeadsCsv(
              pool, sub.organization_id, sub.period_days,
              sub.status_filter ?? "all",
            );
            attachments.push({
              filename: `leads-${datedSuffix}.csv`,
              content: Buffer.from("﻿" + csv, "utf8"),
              contentType: "text/csv; charset=utf-8",
            });
          }

          // Hvis summary mangler (kun leads_list), bygg én for e-post-preview
          if (!summary) {
            summary = await buildSummary(pool, sub.organization_id, sub.period_days);
          }

          const totalWonKr = `${(Number(summary.total_won_oere) / 100).toLocaleString("no-NO")} kr`;
          const winRatePct = `${Math.round(summary.win_rate * 100)} %`;
          const filenameLabel = attachments.length === 1
            ? attachments[0].filename
            : `${attachments.length} vedlegg`;
          const html = buildReportEmailHtml({
            orgName: branding.name, periodLabel,
            primaryColor: branding.primary_color,
            wonCount: summary.won_count, lostCount: summary.lost_count,
            totalWonKr, winRatePct, filename: filenameLabel,
          });

          // Hent e-poster: brukere + ekstra
          const recipientEmails = new Set<string>();
          for (const e of (sub.recipient_emails ?? [])) {
            if (e) recipientEmails.add(e);
          }
          if (sub.recipient_user_ids?.length > 0) {
            const usersR = await pool.query<{ email: string | null }>(
              `SELECT email FROM users WHERE id = ANY($1::text[])`,
              [sub.recipient_user_ids],
            );
            for (const u of usersR.rows) if (u.email) recipientEmails.add(u.email);
          }

          let anySuccess = false;
          let lastErr: string | null = null;
          const totalSize = attachments.reduce(
            (s, a) => s + (a.content instanceof Buffer ? a.content.length : a.content.length), 0,
          );
          for (const to of recipientEmails) {
            const res2 = await sendReportEmail({
              to, orgName: branding.name,
              subject: `${branding.name} — Salgs-rapport (${sub.frequency === "weekly" ? "ukentlig" : sub.frequency === "monthly" ? "månedlig" : "daglig"})`,
              bodyHtml: html, attachments,
              brandPrimaryColor: branding.primary_color,
              fromName: branding.from_name ?? "Leadgrid",
            });
            await pool.query(
              `INSERT INTO leadgrid_scheduled_report_log
                 (subscription_id, organization_id, recipient, report_type,
                  pdf_size_bytes, delivery_status, external_message_id, error_message)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
              [sub.id, sub.organization_id, to, sub.report_type,
               totalSize, res2.ok ? "sent" : "failed",
               res2.messageId ?? null, res2.ok ? null : res2.error],
            );
            if (res2.ok) anySuccess = true;
            else lastErr = res2.error ?? "unknown";
          }

          // Oppdater subscription
          const nextSendAt = computeNextSendAt(sub);
          await pool.query(
            `UPDATE leadgrid_scheduled_reports SET
               last_sent_at = now(),
               last_send_status = $1,
               last_send_error = $2,
               next_send_at = $3,
               updated_at = now()
             WHERE id = $4`,
            [anySuccess ? "success" : "failed",
             anySuccess ? null : lastErr, nextSendAt, sub.id],
          );

          if (anySuccess) results.sent++;
          else results.errors++;
        } catch (e: any) {
          console.error(`[scheduled-reports] ${sub.id} feilet`, e);
          results.errors++;
          await pool.query(
            `UPDATE leadgrid_scheduled_reports SET
               last_send_status = 'failed',
               last_send_error = $1,
               next_send_at = now() + INTERVAL '1 hour'
             WHERE id = $2`,
            [e?.message ?? String(e), sub.id],
          );
        }
      }

      res.json({ ok: true, duration_ms: Date.now() - start, ...results });
    } catch (e: any) {
      console.error("[scheduled-reports/run]", e);
      res.status(500).json({ error: e?.message ?? "run_failed" });
    }
  });
}
