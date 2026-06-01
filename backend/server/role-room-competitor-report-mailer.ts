/**
 * role-room-competitor-report-mailer.ts
 *
 * Renderer en CompetitorReport som HTML-mail og sender via Resend.
 * Brukes av weekly-scheduler + manuell "send rapport på e-post"-knapp.
 */

import type { Pool } from 'pg';
import {
  sendTransactionalEmail,
} from './transactional-email-service.js';
import type {
  CompetitorReport,
  KpiTarget,
} from './role-room-competitor-report-claude.js';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const CATEGORY_COLORS: Record<string, string> = {
  opportunity: '#22c55e',
  threat: '#ef4444',
  gap: '#fbbf24',
  trend: '#60a5fa',
};
const CATEGORY_LABEL: Record<string, string> = {
  opportunity: 'Mulighet',
  threat: 'Trussel',
  gap: 'Gap',
  trend: 'Trend',
};
const PRIORITY_LABEL: Record<string, string> = {
  high: 'Høy',
  medium: 'Medium',
  low: 'Lav',
};
const PLATFORM_LABEL: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  ga4: 'Google Analytics',
};
const MOMENTUM_LABEL: Record<string, string> = {
  'fast-growth': 'Hot',
  steady: 'Stabil',
  flat: 'Flat',
  declining: 'Faller',
};
const MOMENTUM_COLORS: Record<string, string> = {
  'fast-growth': '#22c55e',
  steady: '#60a5fa',
  flat: '#94a3b8',
  declining: '#ef4444',
};

function renderInsightHtml(ins: CompetitorReport['insights'][number]): string {
  const color = CATEGORY_COLORS[ins.category] || '#94a3b8';
  return `
  <div style="border:1px solid ${color}40; background:${color}0d; border-radius:6px; padding:14px 16px; margin-bottom:14px; ${ins.priority === 'high' ? `border-left:4px solid ${color};` : ''}">
    <div style="margin-bottom:8px;">
      <span style="background:${color}26; color:${color}; padding:2px 8px; border-radius:99px; font-size:11px; font-weight:700; letter-spacing:0.04em;">
        ${CATEGORY_LABEL[ins.category] || ins.category} · ${PRIORITY_LABEL[ins.priority] || ins.priority}
      </span>
    </div>
    <div style="font-weight:700; font-size:15px; color:#0f172a; margin-bottom:8px;">${escapeHtml(ins.title)}</div>
    <div style="color:#475569; line-height:1.55; font-size:14px; margin-bottom:10px;">${escapeHtml(ins.body)}</div>
    ${ins.actionableSteps.length > 0 ? `
      <div style="font-size:12px; font-weight:600; color:#475569; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:6px;">Handlinger</div>
      <ul style="margin:0; padding-left:18px; color:#334155; font-size:13.5px; line-height:1.6;">
        ${ins.actionableSteps.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}
      </ul>
    ` : ''}
    ${ins.relatedCompetitors && ins.relatedCompetitors.length > 0 ? `
      <div style="margin-top:8px; font-size:12px; color:#64748b;">
        Konkurrenter: ${ins.relatedCompetitors.map((n) => escapeHtml(n)).join(', ')}
      </div>
    ` : ''}
  </div>
  `;
}

function renderKpiRowHtml(k: KpiTarget): string {
  const delta = k.currentValue != null ? k.targetValue - k.currentValue : null;
  return `
  <tr>
    <td style="padding:8px 10px; border-bottom:1px solid #e2e8f0; font-size:12px; color:#475569; font-weight:600;">
      ${PLATFORM_LABEL[k.platform] || k.platform}
    </td>
    <td style="padding:8px 10px; border-bottom:1px solid #e2e8f0; font-size:13px; color:#0f172a;">
      ${escapeHtml(k.metric)}
    </td>
    <td style="padding:8px 10px; border-bottom:1px solid #e2e8f0; font-size:13px; color:#475569; text-align:right;">
      ${k.currentValue ?? '—'}
    </td>
    <td style="padding:8px 10px; border-bottom:1px solid #e2e8f0; font-size:13px; color:#0f172a; font-weight:700; text-align:right;">
      ${k.targetValue}
    </td>
    <td style="padding:8px 10px; border-bottom:1px solid #e2e8f0; font-size:12px; color:#64748b; text-align:right;">
      ${delta != null ? (delta > 0 ? '+' : '') + delta : '?'}
    </td>
    <td style="padding:8px 10px; border-bottom:1px solid #e2e8f0; font-size:11px; color:#64748b;">
      ${k.timeframe} · ${k.difficulty}
    </td>
  </tr>
  `;
}

export function renderCompetitorReportHtml(report: CompetitorReport, opts: {
  generatedAt: string;
  competitorCount: number;
  brandName?: string;
  reportUrl?: string;
}): string {
  return `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif; background:#f8fafc; padding:24px;">
    <div style="max-width:680px; margin:0 auto; background:#fff; border-radius:8px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
      <div style="background:linear-gradient(135deg,#a78bfa 0%,#7c3aed 100%); color:#fff; padding:24px 32px;">
        <div style="font-size:11px; font-weight:700; letter-spacing:0.15em; text-transform:uppercase; opacity:0.9;">${opts.brandName || 'The Role Room'} · Marketing Cockpit</div>
        <h1 style="margin:6px 0 0; font-size:24px; font-weight:800;">AI Konkurrent-rapport</h1>
        <div style="font-size:13px; opacity:0.9; margin-top:6px;">
          ${new Date(opts.generatedAt).toLocaleString('nb-NO', { dateStyle: 'long', timeStyle: 'short' })}
          · ${opts.competitorCount} konkurrent${opts.competitorCount === 1 ? '' : 'er'} analysert
        </div>
      </div>

      <div style="padding:24px 32px;">
        <div style="background:linear-gradient(135deg,rgba(168,85,247,0.08),rgba(168,85,247,0.16)); border:1px solid rgba(168,85,247,0.25); border-radius:6px; padding:14px 16px; margin-bottom:20px;">
          <div style="font-size:11px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#7c3aed; margin-bottom:6px;">Sammendrag</div>
          <div style="color:#1e293b; line-height:1.65; font-size:14px;">${escapeHtml(report.summary)}</div>
        </div>

        ${report.insights.length > 0 ? `
          <h2 style="font-size:16px; color:#0f172a; margin:24px 0 12px;">Insights · ${report.insights.length}</h2>
          ${[...report.insights].sort((a, b) => {
            const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
            return (order[a.priority] ?? 3) - (order[b.priority] ?? 3);
          }).map(renderInsightHtml).join('')}
        ` : ''}

        ${report.recommendedNextActions.length > 0 ? `
          <h2 style="font-size:16px; color:#0f172a; margin:24px 0 12px;">Anbefalte handlinger · ${report.recommendedNextActions.length}</h2>
          ${report.recommendedNextActions.map((a) => `
            <div style="border:1px solid rgba(34,197,94,0.25); border-left:4px solid #22c55e; background:rgba(34,197,94,0.05); border-radius:6px; padding:12px 14px; margin-bottom:10px;">
              <div style="font-weight:700; color:#15803d; font-size:14px;">${escapeHtml(a.action)}</div>
              <div style="color:#475569; font-size:13px; margin-top:4px; line-height:1.55;">${escapeHtml(a.rationale)}</div>
              <div style="margin-top:6px; font-size:11px; color:#64748b;">
                Impact: ${escapeHtml(a.expectedImpact)}${a.timeframe ? ` · ${escapeHtml(a.timeframe)}` : ''}
              </div>
            </div>
          `).join('')}
        ` : ''}

        ${report.contentGaps.length > 0 ? `
          <h2 style="font-size:16px; color:#0f172a; margin:24px 0 12px;">Content-gaps · ${report.contentGaps.length}</h2>
          <ul style="margin:0; padding-left:18px; color:#334155; font-size:13.5px; line-height:1.8;">
            ${report.contentGaps.map((g) => `<li>${escapeHtml(g)}</li>`).join('')}
          </ul>
        ` : ''}

        ${report.kpiTargets && report.kpiTargets.length > 0 ? `
          <h2 style="font-size:16px; color:#0f172a; margin:24px 0 12px;">KPI-mål · ${report.kpiTargets.length}</h2>
          <table style="width:100%; border-collapse:collapse;">
            <thead>
              <tr style="background:#f1f5f9;">
                <th style="padding:8px 10px; text-align:left; font-size:11px; color:#475569; font-weight:600; letter-spacing:0.05em; text-transform:uppercase;">Plattform</th>
                <th style="padding:8px 10px; text-align:left; font-size:11px; color:#475569; font-weight:600; letter-spacing:0.05em; text-transform:uppercase;">Metric</th>
                <th style="padding:8px 10px; text-align:right; font-size:11px; color:#475569; font-weight:600; letter-spacing:0.05em; text-transform:uppercase;">Nå</th>
                <th style="padding:8px 10px; text-align:right; font-size:11px; color:#475569; font-weight:600; letter-spacing:0.05em; text-transform:uppercase;">Mål</th>
                <th style="padding:8px 10px; text-align:right; font-size:11px; color:#475569; font-weight:600; letter-spacing:0.05em; text-transform:uppercase;">Δ</th>
                <th style="padding:8px 10px; text-align:left; font-size:11px; color:#475569; font-weight:600; letter-spacing:0.05em; text-transform:uppercase;">Detalj</th>
              </tr>
            </thead>
            <tbody>${report.kpiTargets.map(renderKpiRowHtml).join('')}</tbody>
          </table>
        ` : ''}

        ${report.competitorScorecard.length > 0 ? `
          <h2 style="font-size:16px; color:#0f172a; margin:24px 0 12px;">Konkurrent-scorecard</h2>
          ${report.competitorScorecard.map((s) => {
            const color = MOMENTUM_COLORS[s.momentum] || '#94a3b8';
            return `
              <div style="display:flex; align-items:center; gap:12px; padding:8px 10px; border-bottom:1px solid #e2e8f0;">
                <div style="font-weight:700; color:#0f172a; font-size:14px; min-width:120px;">${escapeHtml(s.nickname)}</div>
                <div style="background:${color}26; color:${color}; padding:2px 8px; border-radius:99px; font-size:11px; font-weight:700;">${MOMENTUM_LABEL[s.momentum] || s.momentum}</div>
                <div style="color:#475569; font-size:13px; flex:1;">${escapeHtml(s.notableActivity)}</div>
              </div>
            `;
          }).join('')}
        ` : ''}

        ${opts.reportUrl ? `
          <div style="margin-top:32px; text-align:center;">
            <a href="${opts.reportUrl}" style="display:inline-block; background:#7c3aed; color:#fff; padding:12px 24px; border-radius:6px; text-decoration:none; font-weight:700; font-size:14px;">
              Åpne i Marketing Cockpit →
            </a>
          </div>
        ` : ''}

        <div style="margin-top:32px; padding-top:16px; border-top:1px solid #e2e8f0; font-size:11px; color:#94a3b8; text-align:center;">
          Auto-generert av Marketing Cockpit · Claude Sonnet 4.5
        </div>
      </div>
    </div>
  </div>
  `;
}

export function renderCompetitorReportText(report: CompetitorReport, opts: {
  generatedAt: string;
  competitorCount: number;
  brandName?: string;
}): string {
  const lines: string[] = [];
  lines.push(`${opts.brandName || 'The Role Room'} — AI Konkurrent-rapport`);
  lines.push(`Generert: ${new Date(opts.generatedAt).toLocaleString('nb-NO')}`);
  lines.push(`${opts.competitorCount} konkurrent${opts.competitorCount === 1 ? '' : 'er'} analysert`);
  lines.push('');
  lines.push('## SAMMENDRAG');
  lines.push(report.summary);
  lines.push('');
  if (report.insights.length > 0) {
    lines.push('## INSIGHTS');
    for (const ins of report.insights) {
      lines.push(`[${(CATEGORY_LABEL[ins.category] || ins.category).toUpperCase()} · ${PRIORITY_LABEL[ins.priority] || ins.priority}] ${ins.title}`);
      lines.push(ins.body);
      if (ins.actionableSteps.length > 0) {
        lines.push('Handlinger:');
        for (const s of ins.actionableSteps) lines.push(`  - ${s}`);
      }
      lines.push('');
    }
  }
  if (report.recommendedNextActions.length > 0) {
    lines.push('## ANBEFALTE HANDLINGER');
    for (const a of report.recommendedNextActions) {
      lines.push(`- ${a.action}`);
      lines.push(`  Rationale: ${a.rationale}`);
      lines.push(`  Impact: ${a.expectedImpact}${a.timeframe ? ` (${a.timeframe})` : ''}`);
    }
    lines.push('');
  }
  if (report.kpiTargets && report.kpiTargets.length > 0) {
    lines.push('## KPI-MÅL');
    for (const k of report.kpiTargets) {
      lines.push(`- [${PLATFORM_LABEL[k.platform] || k.platform}] ${k.metric}: ${k.currentValue ?? '—'} → ${k.targetValue} (${k.timeframe}, ${k.difficulty})`);
      lines.push(`  ${k.reasoning}`);
    }
    lines.push('');
  }
  if (report.contentGaps.length > 0) {
    lines.push('## CONTENT-GAPS');
    for (const g of report.contentGaps) lines.push(`- ${g}`);
    lines.push('');
  }
  return lines.join('\n');
}

export interface MailReportOptions {
  pool?: Pool | null;
  to: string;
  report: CompetitorReport;
  generatedAt: string;
  competitorCount: number;
  brandName?: string;
  reportUrl?: string;
}

export async function emailCompetitorReport(opts: MailReportOptions): Promise<{ sent: boolean; error?: string; messageId?: string | null }> {
  const html = renderCompetitorReportHtml(opts.report, {
    generatedAt: opts.generatedAt,
    competitorCount: opts.competitorCount,
    brandName: opts.brandName,
    reportUrl: opts.reportUrl,
  });
  const text = renderCompetitorReportText(opts.report, {
    generatedAt: opts.generatedAt,
    competitorCount: opts.competitorCount,
    brandName: opts.brandName,
  });
  const subject = `${opts.brandName || 'The Role Room'} — Ukentlig konkurrent-rapport (${new Date(opts.generatedAt).toLocaleDateString('nb-NO', { day: '2-digit', month: 'short' })})`;
  const result = await sendTransactionalEmail({
    to: opts.to,
    subject, html, text,
    fromLabel: 'The Role Room Marketing Cockpit',
    kind: 'marketing_competitor_report',
    pool: opts.pool ?? null,
  });
  return {
    sent: result.sent,
    error: result.errorMessage ?? undefined,
    messageId: result.messageId,
  };
}
