/**
 * role-room-newsletter-from-report-routes.ts
 *
 * PR 12: Newsletter Studio ↔ Konkurrent-rapport.
 *
 * Endepunkt: POST /api/admin-room/newsletter/role-room/issues/from-report
 *   - Henter siste rapport for brandKey (eller spesifikk reportId)
 *   - Bygger Norwegian Casting Brief–draft deterministisk (summary, insights,
 *     anbefalte handlinger, content gaps, CTA)
 *   - Setter inn rad i role_room_newsletter_issues med status='draft'
 *   - Returnerer issue-id + slug så frontend kan navigere til editoren
 *
 * Designet: ingen ekstra LLM-kostnad — rapporten er allerede generert.
 * Admin redigerer ferdig i Newsletter Studio før send.
 */

import crypto from 'node:crypto';
import type { Application, Request, Response } from 'express';
import type { Pool } from 'pg';
import { renderBlocksToHtml, type NewsletterBlock } from './role-room-newsletter-email-service.js';
import type { AdminRoomRoutesDeps } from './_shared.js';

export interface SetupNewsletterFromReportDeps {
  app: Application;
  pool: Pool;
  requireAdminRoomAccess: AdminRoomRoutesDeps['requireAdminRoomAccess'];
}

interface ReportJson {
  summary?: string;
  insights?: Array<{
    category?: string;
    priority?: string;
    title?: string;
    body?: string;
    actionableSteps?: string[];
  }>;
  contentGaps?: string[];
  recommendedNextActions?: Array<{
    action?: string;
    rationale?: string;
    timeframe?: string;
  }>;
  competitorScorecard?: Array<{
    nickname?: string;
    momentum?: string;
    notableActivity?: string;
  }>;
  kpiTargets?: Array<{
    platform?: string;
    metric?: string;
    targetValue?: number;
    timeframe?: string;
  }>;
}

function blockId(prefix: string): string {
  return `${prefix}-${crypto.randomBytes(6).toString('hex')}`;
}

function isoWeek(d: Date): { year: number; week: number } {
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const diff = (target.getTime() - firstThursday.getTime()) / 86_400_000;
  const week = 1 + Math.round((diff - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return { year: target.getUTCFullYear(), week };
}

function buildBlocksFromReport(report: ReportJson, brandLabel: string, weekLabel: string): NewsletterBlock[] {
  const blocks: NewsletterBlock[] = [];

  // Hovedoverskrift
  blocks.push({ id: blockId('h1'), type: 'header', level: 1, text: `${brandLabel} — Uke ${weekLabel}` });

  // Intro / summary
  if (report.summary && report.summary.trim()) {
    blocks.push({ id: blockId('intro'), type: 'text', markdown: report.summary.trim() });
  }

  blocks.push({ id: blockId('div'), type: 'divider' });

  // Anbefalte handlinger — øverst, action-først
  const actions = (report.recommendedNextActions || []).filter((a) => a.action && a.action.trim());
  if (actions.length > 0) {
    blocks.push({ id: blockId('h2-actions'), type: 'header', level: 2, text: 'Hva må du gjøre denne uken' });
    const lines = actions.slice(0, 4).map((a) => {
      const tf = a.timeframe ? ` _(${a.timeframe})_` : '';
      const why = a.rationale ? ` — ${a.rationale}` : '';
      return `- **${a.action}**${tf}${why}`;
    });
    blocks.push({ id: blockId('actions-list'), type: 'text', markdown: lines.join('\n') });
  }

  // High-priority insights
  const insights = (report.insights || []).filter((i) => i.title && i.body);
  const highInsights = insights.filter((i) => i.priority === 'high');
  const showInsights = highInsights.length > 0 ? highInsights : insights.slice(0, 3);
  if (showInsights.length > 0) {
    blocks.push({ id: blockId('div2'), type: 'divider' });
    blocks.push({ id: blockId('h2-insights'), type: 'header', level: 2, text: 'Markedsbevegelser vi følger' });
    for (const ins of showInsights.slice(0, 4)) {
      const catLabel = ({ opportunity: 'Mulighet', threat: 'Trussel', gap: 'Hull', trend: 'Trend' } as Record<string, string>)[ins.category || ''] || 'Innsikt';
      blocks.push({ id: blockId('insight-h'), type: 'header', level: 3, text: `${catLabel}: ${ins.title}` });
      blocks.push({ id: blockId('insight-body'), type: 'text', markdown: ins.body || '' });
    }
  }

  // Content gaps
  const gaps = (report.contentGaps || []).filter((g) => g && g.trim());
  if (gaps.length > 0) {
    blocks.push({ id: blockId('div3'), type: 'divider' });
    blocks.push({ id: blockId('h2-gaps'), type: 'header', level: 2, text: 'Innholdshull å fylle' });
    blocks.push({ id: blockId('gaps-list'), type: 'text', markdown: gaps.slice(0, 5).map((g) => `- ${g}`).join('\n') });
  }

  // KPI-targets
  const kpis = (report.kpiTargets || []).filter((k) => k.metric && typeof k.targetValue === 'number');
  if (kpis.length > 0) {
    blocks.push({ id: blockId('div4'), type: 'divider' });
    blocks.push({ id: blockId('h2-kpi'), type: 'header', level: 2, text: 'KPI-mål neste 30 dager' });
    const kpiLines = kpis.slice(0, 6).map((k) => {
      return `- **${k.platform} · ${k.metric}** → ${k.targetValue} (${k.timeframe || '30d'})`;
    });
    blocks.push({ id: blockId('kpi-list'), type: 'text', markdown: kpiLines.join('\n') });
  }

  // CTA — link til The Role Room
  blocks.push({ id: blockId('div5'), type: 'divider' });
  blocks.push({
    id: blockId('cta'),
    type: 'cta',
    label: 'Les hele rapporten i Admin Room',
    url: 'https://theroleroom.com/admin?tab=marketing-cockpit',
    align: 'center',
  });

  return blocks;
}

function blocksToMarkdown(blocks: NewsletterBlock[]): string {
  const parts: string[] = [];
  for (const b of blocks) {
    switch (b.type) {
      case 'header':
        parts.push(`${'#'.repeat(b.level || 1)} ${b.text}`);
        break;
      case 'text':
        parts.push(b.markdown);
        break;
      case 'divider':
        parts.push('---');
        break;
      case 'cta':
        parts.push(`[${b.label}](${b.url})`);
        break;
      case 'image':
        parts.push(`![${b.alt || ''}](${b.url})`);
        break;
      case 'quote':
        parts.push(`> ${b.text}${b.attribution ? `\n> — ${b.attribution}` : ''}`);
        break;
    }
  }
  return parts.join('\n\n');
}

export function setupNewsletterFromReportRoutes(deps: SetupNewsletterFromReportDeps): void {
  const { app, pool, requireAdminRoomAccess } = deps;

  app.post('/api/admin-room/newsletter/role-room/issues/from-report', async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;

    const body = (req.body ?? {}) as Record<string, unknown>;
    const brandKey = typeof body.brandKey === 'string' && body.brandKey.trim() ? body.brandKey.trim() : 'theroleroom';
    const reportId = typeof body.reportId === 'number' ? body.reportId : null;

    try {
      // 1. Hent rapporten
      const r = reportId
        ? await pool.query(
            `SELECT id, brand_key, generated_at, report_json
               FROM marketing_competitor_reports
              WHERE id = $1`,
            [reportId],
          )
        : await pool.query(
            `SELECT id, brand_key, generated_at, report_json
               FROM marketing_competitor_reports
              WHERE brand_key = $1
              ORDER BY generated_at DESC LIMIT 1`,
            [brandKey],
          );

      if (!r.rowCount) {
        res.status(404).json({ ok: false, error: 'Ingen rapport funnet for denne brandKey. Generer en rapport først.' });
        return;
      }

      const report = r.rows[0];
      const reportJson = (report.report_json || {}) as ReportJson;

      // 2. Bygg blocks
      const brandLabel = brandKey === 'theroleroom' ? 'Norwegian Casting Brief' : `${brandKey} brief`;
      const generatedAt = new Date(report.generated_at);
      const wk = isoWeek(generatedAt);
      const weekLabel = `${wk.week}/${wk.year}`;
      const blocks = buildBlocksFromReport(reportJson, brandLabel, weekLabel);
      const markdown = blocksToMarkdown(blocks);
      const html = renderBlocksToHtml(blocks);

      // 3. Sett inn newsletter_issue
      const title = `${brandLabel} — Uke ${weekLabel}`;
      const baseSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
      const slug = `${baseSlug}-${crypto.randomBytes(3).toString('hex')}`;
      const subject = `${brandLabel} — Uke ${weekLabel}`;
      const preheader = (reportJson.summary || '').slice(0, 140);

      const inserted = await pool.query(
        `INSERT INTO role_room_newsletter_issues
           (user_id, slug, title, subject, preheader, body_markdown, body_html, body_blocks, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, 'draft')
         RETURNING id, slug, title, subject, status, created_at`,
        [session.userId, slug, title, subject, preheader, markdown, html, JSON.stringify(blocks)],
      );

      res.status(201).json({
        ok: true,
        issue: inserted.rows[0],
        sourceReport: {
          id: Number(report.id),
          brandKey: report.brand_key,
          generatedAt: report.generated_at,
        },
        blockCount: blocks.length,
      });
    } catch (err) {
      console.error('[newsletter-from-report] error', err);
      res.status(500).json({ ok: false, error: 'Kunne ikke generere utgave fra rapport', detail: String(err) });
    }
  });
}
