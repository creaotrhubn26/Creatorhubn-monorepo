/**
 * lead-map-pdf-export.ts
 *
 * Bygger en client-side PDF-rapport for ett prosjekt via window.print().
 * Vi åpner en isolert popup, skriver et komplett HTML-dokument med
 * print-CSS, og lar brukeren velge 'Lagre som PDF' i print-dialogen.
 *
 * Hvorfor ikke jsPDF? PDF-quality fra jsPDF er marginal og krever
 * font-embedding for å håndtere norske tegn. window.print + print-CSS
 * gir vector-output med perfekt typografi gratis.
 */

import type { LeadStatus } from "./LeadMapPanel";

interface Project {
  id: string;
  name: string;
  description: string | null;
  projectType: string | null;
  genre: string | null;
  status: string;
}

interface BrandKitSummary {
  positioningSummary: string | null;
  tone: string | null;
  targetAudience: string | null;
  valueProposition: string | null;
  logoUrl: string | null;
  sourceUrl: string | null;
}

interface LeaderboardEntry {
  rank: number;
  userName: string | null;
  userEmail: string | null;
  totalLeads: number;
  won: number;
  meetingBooked: number;
  conversionRate: number | null;
}

interface PdfReportData {
  project: Project;
  brandKit: BrandKitSummary | null;
  metrics: {
    totalLeads: number;
    followUpsDue: number;
    meetingsBooked: number;
    conversionRate: number;
    statusCounts: Record<string, number>;
  } | null;
  competitorCount: number;
  leaderboard: LeaderboardEntry[];
  reminders: {
    totalStale: number;
    buckets: { over30days: number; over14days: number; over7days: number };
  } | null;
  generatedAt: Date;
  ownerName: string | null;
}

const STATUS_LABEL: Record<LeadStatus, string> = {
  unvisited: "Unvisited",
  visited: "Visited",
  return: "Return",
  not_present: "Not present",
  declined: "Declined",
  interested: "Interested",
  meeting_booked: "Meeting booked",
  proposal_sent: "Proposal sent",
  won: "Won",
  lost: "Lost",
  do_not_contact: "Do not contact",
};

function escape(s: string | null | undefined): string {
  if (s == null) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function openLeadMapPdfReport(data: PdfReportData): void {
  const win = window.open("", "_blank", "width=900,height=1200");
  if (!win) {
    alert("Pop-up ble blokkert. Tillat popups for å eksportere PDF.");
    return;
  }
  const html = buildHtml(data);
  win.document.open();
  win.document.write(html);
  win.document.close();
  // Vent på render + bilder før print
  setTimeout(() => {
    win.focus();
    win.print();
  }, 600);
}

function buildHtml(data: PdfReportData): string {
  const date = data.generatedAt.toLocaleDateString("nb-NO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const time = data.generatedAt.toLocaleTimeString("nb-NO", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const kpiHtml = data.metrics
    ? `
      <section class="kpi-stripe">
        ${kpiCard("Total leads", String(data.metrics.totalLeads), "#fbbf24")}
        ${kpiCard("Follow-ups", String(data.metrics.followUpsDue), "#fb923c")}
        ${kpiCard("Møter", String(data.metrics.meetingsBooked), "#a78bfa")}
        ${kpiCard("Conversion", `${data.metrics.conversionRate}%`, "#34d399")}
        ${kpiCard("Konkurrenter", String(data.competitorCount), "#ef4444")}
      </section>
    `
    : "";

  const statusHtml = data.metrics?.statusCounts
    ? `
      <section class="status-grid">
        <h3>Status-fordeling</h3>
        <div class="status-rows">
          ${Object.entries(data.metrics.statusCounts)
            .sort(([, a], [, b]) => b - a)
            .map(([status, n]) => `
              <div class="status-row">
                <span class="status-label">${escape(STATUS_LABEL[status as LeadStatus] ?? status)}</span>
                <span class="status-count">${n}</span>
              </div>`)
            .join("")}
        </div>
      </section>
    `
    : "";

  const leaderboardHtml = data.leaderboard.length > 0
    ? `
      <section class="leaderboard">
        <h3>Lead-leaderboard</h3>
        <table>
          <thead>
            <tr><th>#</th><th>Bruker</th><th>Leads</th><th>Møter</th><th>Won</th><th>Conv.</th></tr>
          </thead>
          <tbody>
            ${data.leaderboard.slice(0, 10).map((e) => `
              <tr>
                <td class="rank">${e.rank}</td>
                <td>${escape(e.userName ?? e.userEmail ?? "Ukjent")}</td>
                <td class="num">${e.totalLeads}</td>
                <td class="num">${e.meetingBooked}</td>
                <td class="num">${e.won}</td>
                <td class="num">${e.conversionRate != null ? `${e.conversionRate}%` : "—"}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </section>
    `
    : "";

  const remindersHtml = data.reminders && data.reminders.totalStale > 0
    ? `
      <section class="reminders">
        <h3>Stille leads</h3>
        <div class="bucket-grid">
          <div class="bucket urgent">
            <div class="count">${data.reminders.buckets.over30days}</div>
            <div class="label">over 30 dager</div>
          </div>
          <div class="bucket warn">
            <div class="count">${data.reminders.buckets.over14days}</div>
            <div class="label">over 14 dager</div>
          </div>
          <div class="bucket info">
            <div class="count">${data.reminders.buckets.over7days}</div>
            <div class="label">over 7 dager</div>
          </div>
        </div>
      </section>
    `
    : "";

  return `<!DOCTYPE html>
<html lang="nb">
<head>
  <meta charset="utf-8">
  <title>Lead Map-rapport · ${escape(data.project.name)}</title>
  <style>
    @page { size: A4; margin: 18mm 20mm; }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #1a1a1a;
      line-height: 1.5;
      margin: 0;
      padding: 0;
    }
    header.report-header {
      border-bottom: 2px solid #c084fc;
      padding-bottom: 16px;
      margin-bottom: 24px;
      display: flex;
      align-items: flex-start;
      gap: 16px;
    }
    .logo {
      width: 64px; height: 64px;
      background: #fff;
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 6px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .logo img { max-width: 100%; max-height: 100%; object-fit: contain; }
    .logo .fallback {
      font-weight: 800; font-size: 24px; color: #c084fc;
    }
    h1 { margin: 0; font-size: 26px; }
    .subtitle { color: #666; font-size: 13px; margin-top: 4px; }
    .meta { color: #999; font-size: 11px; margin-top: 8px; }
    h2 { font-size: 16px; margin: 24px 0 12px; color: #c084fc; text-transform: uppercase; letter-spacing: 0.04em; }
    h3 { font-size: 14px; margin: 0 0 10px; color: #444; text-transform: uppercase; letter-spacing: 0.04em; }
    .positioning {
      padding: 12px 14px;
      background: rgba(192,132,252,0.06);
      border-left: 3px solid #c084fc;
      margin: 8px 0;
      font-size: 13px;
    }
    .positioning .label {
      font-size: 10px; font-weight: 700; color: #c084fc; text-transform: uppercase;
      letter-spacing: 0.04em; margin-bottom: 4px;
    }
    .goal {
      padding: 12px 14px;
      background: rgba(251,191,36,0.08);
      border-left: 3px solid #fbbf24;
      margin: 8px 0;
      font-size: 13px;
    }
    .goal .label {
      font-size: 10px; font-weight: 700; color: #d97706; text-transform: uppercase;
      margin-bottom: 4px;
    }
    .kpi-stripe { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin: 16px 0; }
    .kpi-card {
      padding: 12px; border-radius: 6px; border: 1px solid #eee;
      text-align: center;
    }
    .kpi-card .value { font-size: 22px; font-weight: 800; line-height: 1; }
    .kpi-card .label { font-size: 9px; color: #999; text-transform: uppercase; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { text-align: left; background: #f5f5f5; padding: 8px; font-size: 10px; text-transform: uppercase; color: #666; }
    td { padding: 8px; border-bottom: 1px solid #eee; }
    td.num, td.rank { text-align: right; font-variant-numeric: tabular-nums; }
    td.rank { font-weight: 700; }
    .status-rows { display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px 24px; }
    .status-row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dotted #eee; font-size: 12px; }
    .status-count { font-weight: 700; }
    .bucket-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    .bucket { padding: 14px; border-radius: 6px; text-align: center; }
    .bucket .count { font-size: 28px; font-weight: 800; line-height: 1; }
    .bucket .label { font-size: 10px; margin-top: 6px; text-transform: uppercase; }
    .bucket.urgent { background: rgba(248,113,113,0.1); color: #b91c1c; }
    .bucket.warn { background: rgba(251,191,36,0.1); color: #d97706; }
    .bucket.info { background: rgba(96,165,250,0.1); color: #2563eb; }
    footer.report-footer {
      margin-top: 32px; padding-top: 12px;
      border-top: 1px solid #eee;
      font-size: 10px; color: #999; text-align: center;
    }
    @media print { .no-print { display: none; } }
    .print-banner {
      background: #fef3c7; padding: 8px 12px; border-radius: 4px; margin-bottom: 16px;
      font-size: 12px; color: #92400e;
    }
  </style>
</head>
<body>
  <div class="no-print print-banner">
    Bruk <strong>Cmd+P</strong> (Mac) eller <strong>Ctrl+P</strong> (Windows) → velg <strong>Lagre som PDF</strong>.
  </div>
  <header class="report-header">
    <div class="logo">
      ${data.brandKit?.logoUrl
        ? `<img src="${escape(data.brandKit.logoUrl)}" alt="${escape(data.project.name)} logo" onerror="this.style.display='none';this.parentElement.innerHTML='<span class=\\'fallback\\'>${escape(data.project.name.slice(0,2).toUpperCase())}</span>';">`
        : `<span class="fallback">${escape(data.project.name.slice(0, 2).toUpperCase())}</span>`}
    </div>
    <div>
      <h1>${escape(data.project.name)}</h1>
      <div class="subtitle">Lead Map-rapport</div>
      <div class="meta">${escape(date)} kl. ${escape(time)}${data.ownerName ? ` · ${escape(data.ownerName)}` : ""}</div>
    </div>
  </header>

  ${data.brandKit?.positioningSummary
    ? `<div class="positioning">
         <div class="label">Posisjonering</div>
         <div>${escape(data.brandKit.positioningSummary)}</div>
       </div>`
    : ""}

  ${data.brandKit?.valueProposition
    ? `<div class="goal">
         <div class="label">Mål: hva vi leter etter</div>
         <div>${escape(data.brandKit.valueProposition)}</div>
       </div>`
    : ""}

  <h2>Pipeline-oversikt</h2>
  ${kpiHtml}

  ${statusHtml}

  ${remindersHtml}

  ${leaderboardHtml}

  <footer class="report-footer">
    Generert av Lead Map · theroleroom.com
  </footer>
</body>
</html>`;
}

function kpiCard(label: string, value: string, color: string): string {
  return `<div class="kpi-card" style="border-color: ${color}44">
    <div class="value" style="color: ${color}">${escape(value)}</div>
    <div class="label">${escape(label)}</div>
  </div>`;
}
