/**
 * Marketing Plan exporters — items #137 (PDF) and #139 (iCalendar).
 *
 * PDF mirrors the look of the in-app plan view: brand-colored header,
 * strategy card, pillar cards, post-roadmap as a vertical timeline.
 * Reuses the jsPDF setup pattern from feedPlannerPdf.ts.
 *
 * .ics generates RFC 5545-compliant iCalendar so the user can import
 * the 30-day post schedule into Google Calendar / Outlook. Each post
 * becomes a 30-minute VEVENT — the user can drag to extend in their
 * calendar app.
 */

import jsPDF from 'jspdf';
import type {
  MarketingPlan,
  MarketingPlanPost,
} from '../services/roleRoomAgentService';

function sanitizeFilename(name: string | null | undefined, fallback = 'marketing-plan'): string {
  if (!name) return fallback;
  return name
    .normalize('NFKD')
    .replace(/[^\w\-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
    .slice(0, 60) || fallback;
}

function triggerDownload(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([a-f0-9]{6})$/i.exec(hex);
  if (!m) return [99, 102, 241];
  const v = m[1];
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

export function exportMarketingPlanAsPdf(input: {
  plan: MarketingPlan;
  posts: MarketingPlanPost[];
  companyName?: string | null;
  brandPrimaryHex?: string | null;
  brandAccentHex?: string | null;
}): void {
  const { plan, posts, companyName, brandPrimaryHex, brandAccentHex } = input;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  const usable = pageWidth - margin * 2;
  const [pr, pg, pb] = hexToRgb(brandPrimaryHex ?? '#22d3ee');
  const [ar, ag, ab] = hexToRgb(brandAccentHex ?? '#3b82f6');

  // Header bar
  doc.setFillColor(pr, pg, pb);
  doc.rect(0, 0, pageWidth, 64, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(companyName || 'Marketing Plan', margin, 32);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `${plan.pillars.length} pillars · ${plan.horizonDays} dagers horisont · ${plan.status}`,
    margin,
    50,
  );

  let y = 90;
  doc.setTextColor(15, 23, 42);

  // Strategy block
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Strategi', margin, y);
  y += 16;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  const strategyLines: string[] = [];
  const channelPrimary = plan.strategy?.channelStrategy?.primary;
  if (channelPrimary) strategyLines.push(`Primær kanal: ${channelPrimary}`);
  const cadence = plan.strategy?.channelStrategy?.cadencePerWeek;
  if (typeof cadence === 'number') strategyLines.push(`Frekvens: ${cadence}/uke`);
  const voice = plan.strategy?.toneOfVoice?.voice;
  if (voice) strategyLines.push(`Tone: ${voice}`);
  const positioning = plan.strategy?.positioning?.valueProp;
  if (positioning) strategyLines.push(`Posisjonering: ${positioning}`);
  for (const line of strategyLines) {
    const wrapped = doc.splitTextToSize(line, usable);
    doc.text(wrapped as string[], margin, y);
    y += (wrapped as string[]).length * 12;
  }
  y += 8;

  // KPI targets
  if ((plan.strategy?.kpiTargets ?? []).length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('KPI-mål', margin, y);
    y += 14;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    for (const kpi of plan.strategy.kpiTargets) {
      doc.text(`• ${kpi.metric} → ${kpi.target} per ${kpi.per}`, margin + 6, y);
      y += 12;
    }
    y += 6;
  }

  // Pillars
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Content Pillars', margin, y);
  y += 14;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  plan.pillars.forEach((pillar, idx) => {
    // Page-break safety: leave 40pt for footer
    if (y > doc.internal.pageSize.getHeight() - 80) {
      doc.addPage();
      y = margin;
    }
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y - 10, usable, 36, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`${idx + 1}. ${pillar.name}`, margin + 8, y);
    y += 12;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    if (pillar.description) {
      const wrapped = doc.splitTextToSize(pillar.description, usable - 16);
      doc.text(wrapped as string[], margin + 8, y);
      y += (wrapped as string[]).length * 10;
    }
    y += 14;
  });

  // Post roadmap (compact list)
  if (posts.length > 0) {
    if (y > doc.internal.pageSize.getHeight() - 100) {
      doc.addPage();
      y = margin;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`Post-roadmap (${posts.length} posts)`, margin, y);
    y += 14;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    for (const post of posts.slice(0, 30)) {
      if (y > doc.internal.pageSize.getHeight() - 60) {
        doc.addPage();
        y = margin;
      }
      const day = `Dag ${(post.dayOffset ?? 0) + 1}`;
      const fmt = post.format;
      const hook = post.hook?.slice(0, 80) ?? '';
      doc.text(`${day} · ${fmt}: ${hook}`, margin, y);
      y += 11;
    }
  }

  // Footer
  doc.setFillColor(ar, ag, ab);
  doc.rect(0, doc.internal.pageSize.getHeight() - 22, pageWidth, 22, 'F');
  doc.setTextColor(241, 245, 249);
  doc.setFontSize(8);
  doc.text(
    `Marketing Plan · ${plan.generatedWithModel ?? '—'} · id ${plan.id.slice(0, 8)}`,
    margin,
    doc.internal.pageSize.getHeight() - 8,
  );

  const filename = `${sanitizeFilename(companyName)}_marketing_plan_${plan.id.slice(0, 8)}.pdf`;
  doc.save(filename);
}

// ─────────────────────────────────────────────────────────────────────
// iCalendar export — item #139
// ─────────────────────────────────────────────────────────────────────

function icsEscape(value: string): string {
  // RFC 5545 §3.3.11: TEXT escape — backslash, comma, semicolon, newline.
  return value
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\r?\n/g, '\\n');
}

function formatIcsDate(date: Date): string {
  // YYYYMMDDTHHmmssZ in UTC.
  const pad = (n: number): string => String(n).padStart(2, '0');
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    'T',
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds()),
    'Z',
  ].join('');
}

/** Folds long lines per RFC 5545 §3.1: lines >75 octets must be split
 *  with CRLF + leading space. Naive char-count is good enough for our
 *  short titles + captions. */
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let i = 0;
  while (i < line.length) {
    parts.push(line.slice(i, i + 73));
    i += 73;
  }
  return parts.join('\r\n ');
}

export function exportMarketingPlanAsIcs(input: {
  plan: MarketingPlan;
  posts: MarketingPlanPost[];
  companyName?: string | null;
}): void {
  const { plan, posts, companyName } = input;
  // Anchor: start_date if active, else today. Each post's scheduledFor
  // takes precedence; fall back to start_date + dayOffset.
  const planStart = plan.startDate ? new Date(plan.startDate) : new Date();
  const now = new Date();

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//Role Room//Marketing Plan ${plan.id.slice(0, 8)}//EN`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    foldLine(`X-WR-CALNAME:${icsEscape(`${companyName ?? 'Marketing Plan'} — Posts`)}`),
  ];

  posts.forEach((post, idx) => {
    const scheduledFor: Date = post.scheduledFor
      ? new Date(post.scheduledFor)
      : new Date(planStart.getTime() + (post.dayOffset ?? 0) * 24 * 60 * 60 * 1000);
    // 30-min default duration — calendar apps make this drag-extendable.
    const end = new Date(scheduledFor.getTime() + 30 * 60 * 1000);
    const uid = `${plan.id}-${post.id ?? idx}@role-room`;
    const hook = (post.hook ?? `Post ${idx + 1}`).slice(0, 120);
    const summary = `${post.format ?? 'post'}: ${hook}`;
    const descriptionParts = [
      post.script ?? post.captionDraft ?? '',
      post.callToAction ? `\nCTA: ${post.callToAction}` : '',
      post.primaryPlatform ? `\nKanal: ${post.primaryPlatform}` : '',
    ].filter(Boolean).join('');
    lines.push(
      'BEGIN:VEVENT',
      foldLine(`UID:${uid}`),
      foldLine(`DTSTAMP:${formatIcsDate(now)}`),
      foldLine(`DTSTART:${formatIcsDate(scheduledFor)}`),
      foldLine(`DTEND:${formatIcsDate(end)}`),
      foldLine(`SUMMARY:${icsEscape(summary)}`),
      foldLine(`DESCRIPTION:${icsEscape(descriptionParts)}`),
      'STATUS:CONFIRMED',
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    );
  });
  lines.push('END:VCALENDAR');

  const content = lines.join('\r\n') + '\r\n';
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const filename = `${sanitizeFilename(companyName)}_marketing_plan_${plan.id.slice(0, 8)}.ics`;
  triggerDownload(filename, blob);
}
