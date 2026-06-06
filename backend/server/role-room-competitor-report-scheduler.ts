/**
 * role-room-competitor-report-scheduler.ts
 *
 * In-process scheduler som hver mandag 08:00 CET genererer ukentlig
 * konkurrent-rapport for The Role Room og sender den på e-post til
 * konfigurerte mottakere via Resend.
 *
 * Plus: manuell trigger-endepunkt + en mail-now-endepunkt for å sende
 * SISTE rapport (ferdig generert) på e-post uten å re-generere.
 */

import type { Application, Request, Response } from 'express';
import type { Pool } from 'pg';
import { emailCompetitorReport } from './role-room-competitor-report-mailer.js';
import type { CompetitorReport } from './role-room-competitor-report-claude.js';

export interface SetupReportSchedulerDeps {
  app: Application;
  pool: Pool;
  requireAdminOrDemoBypass: (req: Request, res: Response) => boolean;
}

/**
 * Genererer en fersh rapport ved å kalle vår egen /generate-report-endpoint
 * via self-HTTP. Bruker WHATSAPP_DEMO_BYPASS_TOKEN for auth. Holder oss unna
 * sirkulær import mellom scheduler og competitors-routes.
 */
async function generateReportViaSelfHttp(brandKey: string, useCache: boolean): Promise<{
  ok: boolean;
  reportId: number | null;
  report?: CompetitorReport;
  generatedAt: string;
  competitorCount: number;
  error?: string;
} | null> {
  const port = process.env.PORT || '10000';
  const bypassToken = (process.env.WHATSAPP_DEMO_BYPASS_TOKEN || '').trim();
  if (!bypassToken) {
    return { ok: false, reportId: null, generatedAt: '', competitorCount: 0, error: 'WHATSAPP_DEMO_BYPASS_TOKEN missing' };
  }
  try {
    const resp = await fetch(`http://127.0.0.1:${port}/api/role-room/marketing-cockpit/competitors/generate-report?token=${encodeURIComponent(bypassToken)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brandKey, useCache }),
    });
    const body = await resp.json().catch(() => ({})) as Record<string, unknown>;
    if (!resp.ok || !body.ok) {
      return {
        ok: false, reportId: null, generatedAt: '', competitorCount: 0,
        error: (body.error as string) || `http ${resp.status}`,
      };
    }
    return {
      ok: true,
      reportId: typeof body.reportId === 'number' ? body.reportId : null,
      report: body.report as CompetitorReport | undefined,
      generatedAt: typeof body.generatedAt === 'string' ? body.generatedAt : new Date().toISOString(),
      competitorCount: typeof body.competitorCount === 'number' ? body.competitorCount : 0,
    };
  } catch (err) {
    return { ok: false, reportId: null, generatedAt: '', competitorCount: 0, error: String(err) };
  }
}

const CHECK_INTERVAL_MS = 60 * 60 * 1000;       // tikker hver time
const SCHEDULE_DAY = 1;                          // mandag (0=søndag)
const SCHEDULE_HOUR = 8;                         // 08:00 CET
const STARTUP_DELAY_MS = 120_000;                // 2 min etter boot

function getRecipients(): string[] {
  const raw = (process.env.MARKETING_REPORT_RECIPIENTS || 'daniel@creatorhubn.com').trim();
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function shouldSendNow(): boolean {
  if ((process.env.MARKETING_REPORT_AUTO_WEEKLY || 'true').toLowerCase() === 'false') return false;
  const now = new Date();
  // CET-justering: serveren kjører UTC; CET = UTC+1 (eller UTC+2 sommertid).
  // Vi target Oslo-tid; bruker Intl for å få konsistent dag/time-mapping.
  const oslo = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Oslo',
    weekday: 'short',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(now);
  const weekday = oslo.find((p) => p.type === 'weekday')?.value || '';
  const hour = parseInt(oslo.find((p) => p.type === 'hour')?.value || '0', 10);
  const wMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return wMap[weekday] === SCHEDULE_DAY && hour === SCHEDULE_HOUR;
}

async function alreadySentThisWeek(pool: Pool): Promise<boolean> {
  try {
    const r = await pool.query(
      `SELECT 1 FROM marketing_competitor_reports
       WHERE brand_key = 'theroleroom' AND triggered_by = 'auto-weekly'
         AND generated_at > date_trunc('week', now())
       LIMIT 1`,
    );
    return (r.rowCount ?? 0) > 0;
  } catch { return false; }
}

let schedulerInterval: NodeJS.Timeout | null = null;

export async function runWeeklyReportNow(
  deps: { pool: Pool },
  options: { recipients?: string[]; markAsAuto?: boolean } = {},
): Promise<{
  ok: boolean;
  reportId: number | null;
  emailResults: Array<{ to: string; sent: boolean; error?: string; messageId?: string | null }>;
  error?: string;
}> {
  const result = await generateReportViaSelfHttp('theroleroom', /*useCache*/ false);
  if (!result || !result.ok || !result.report) {
    return { ok: false, reportId: null, emailResults: [], error: result?.error || 'generation_failed' };
  }
  // Mark this report as auto-weekly so dedup works
  if (options.markAsAuto !== false && result.reportId) {
    try {
      await deps.pool.query(
        `UPDATE marketing_competitor_reports SET triggered_by = 'auto-weekly' WHERE id = $1`,
        [result.reportId],
      );
    } catch { /* ignore */ }
  }
  const recipients = options.recipients ?? getRecipients();
  const reportUrl = (process.env.THEROLERROOM_PUBLIC_URL || 'https://theroleroom.com').replace(/\/$/, '') + '/admin';
  const emailResults: Array<{ to: string; sent: boolean; error?: string; messageId?: string | null }> = [];
  for (const to of recipients) {
    const r = await emailCompetitorReport({
      pool: deps.pool,
      to,
      report: result.report,
      generatedAt: result.generatedAt,
      competitorCount: result.competitorCount,
      brandName: 'The Role Room',
      reportUrl,
    });
    emailResults.push({ to, ...r });
  }
  return { ok: true, reportId: result.reportId, emailResults };
}

export function startCompetitorReportScheduler(deps: { pool: Pool }): void {
  if (schedulerInterval) return;
  const tick = async () => {
    if (!shouldSendNow()) return;
    if (await alreadySentThisWeek(deps.pool)) return;
    console.log('[report-scheduler] mandag 08:00 CET reached + ikke sendt denne uken → genererer + sender');
    try {
      const result = await runWeeklyReportNow({ pool: deps.pool });
      const sentCount = result.emailResults.filter((r) => r.sent).length;
      const failedCount = result.emailResults.length - sentCount;
      console.log(`[report-scheduler] reportId=${result.reportId} sent=${sentCount} failed=${failedCount}`);
    } catch (err) {
      console.error('[report-scheduler] tick crashed', err);
    }
  };
  setTimeout(() => {
    void tick();
    schedulerInterval = setInterval(() => void tick(), CHECK_INTERVAL_MS);
    console.log('[report-scheduler] started — checks hver time, fyrer mandag 08:00 CET hvis ikke allerede sendt denne uken');
  }, STARTUP_DELAY_MS);
}

export function setupReportSchedulerRoutes(deps: SetupReportSchedulerDeps): void {
  const { app, pool, requireAdminOrDemoBypass } = deps;

  // ── POST trigger-weekly-now — for testing/manual override ───────────────
  app.post('/api/role-room/marketing-cockpit/competitors/reports/send-weekly-now', async (req, res) => {
    if (!requireAdminOrDemoBypass(req, res)) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const recipients = Array.isArray(body.recipients)
      ? (body.recipients as unknown[]).filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      : undefined;
    const markAsAuto = body.markAsAuto !== false;
    try {
      const result = await runWeeklyReportNow({ pool }, { recipients, markAsAuto });
      res.status(result.ok ? 200 : 502).json(result);
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  // ── POST email-existing-report — re-send siste rapport uten å regenerere ──
  app.post('/api/role-room/marketing-cockpit/competitors/reports/email-latest', async (req, res) => {
    if (!requireAdminOrDemoBypass(req, res)) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const brandKey = typeof body.brandKey === 'string' && body.brandKey.trim() ? body.brandKey.trim() : 'theroleroom';
    const recipients = Array.isArray(body.recipients)
      ? (body.recipients as unknown[]).filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      : getRecipients();
    try {
      const r = await pool.query(
        `SELECT id, report_json, generated_at, competitor_count
         FROM marketing_competitor_reports WHERE brand_key = $1
         ORDER BY generated_at DESC LIMIT 1`,
        [brandKey],
      );
      if (!r.rowCount) {
        res.status(404).json({ ok: false, error: 'no_report_to_send' });
        return;
      }
      const row = r.rows[0];
      const reportUrl = (process.env.THEROLERROOM_PUBLIC_URL || 'https://theroleroom.com').replace(/\/$/, '') + '/admin';
      const results: Array<{ to: string; sent: boolean; error?: string }> = [];
      for (const to of recipients) {
        const er = await emailCompetitorReport({
          pool, to,
          report: row.report_json as CompetitorReport,
          generatedAt: row.generated_at,
          competitorCount: row.competitor_count,
          brandName: 'The Role Room',
          reportUrl,
        });
        results.push({ to, sent: er.sent, error: er.error });
      }
      res.json({ ok: true, reportId: Number(row.id), emailResults: results });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  // ── GET scheduler-status ────────────────────────────────────────────────
  app.get('/api/role-room/marketing-cockpit/competitors/reports/scheduler-status', async (req, res) => {
    if (!requireAdminOrDemoBypass(req, res)) return;
    try {
      const r = await pool.query(
        `SELECT generated_at, triggered_by FROM marketing_competitor_reports
         WHERE brand_key = 'theroleroom' AND triggered_by = 'auto-weekly'
         ORDER BY generated_at DESC LIMIT 1`,
      );
      const lastAuto = r.rowCount ? r.rows[0].generated_at : null;
      res.json({
        ok: true,
        autoWeeklyEnabled: (process.env.MARKETING_REPORT_AUTO_WEEKLY || 'true').toLowerCase() !== 'false',
        scheduleDescription: 'Mandag 08:00 Europe/Oslo',
        recipients: getRecipients(),
        lastAutoReportAt: lastAuto,
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });
}
