/**
 * Admin Room-endepunkter for Resend-status + transactional-email-dashboard.
 *
 * - GET /api/admin/resend/status     : provider-konfig + Resend-konto-status
 * - GET /api/admin/resend/usage      : antall sendt denne mnd + grenser
 * - GET /api/admin/resend/recent     : siste N sendinger fra loggen
 *
 * Resend gratis-tier: 3 000 e-poster/måned, 100/dag.
 */

import express from 'express';
import type { Pool } from 'pg';

export interface ResendAdminRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireAdminSession: (req: any, res: any) => any;
}

const RESEND_FREE_TIER_MONTHLY = 3000;
const RESEND_FREE_TIER_DAILY = 100;

function readEnvString(value: string | undefined | null): string | null {
  const s = typeof value === 'string' ? value.trim() : '';
  return s.length > 0 ? s : null;
}

async function fetchResendDomains(apiKey: string): Promise<{
  ok: boolean;
  domains: Array<{ id: string; name: string; status: string; region: string | null }>;
  error?: string;
}> {
  try {
    const response = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!response.ok) {
      return { ok: false, domains: [], error: `HTTP ${response.status}` };
    }
    const payload = await response.json().catch(() => null) as
      | { data?: Array<{ id: string; name: string; status: string; region?: string | null }> }
      | null;
    const domains = (payload?.data ?? []).map((d) => ({
      id: d.id,
      name: d.name,
      status: d.status,
      region: d.region ?? null,
    }));
    return { ok: true, domains };
  } catch (error) {
    return { ok: false, domains: [], error: error instanceof Error ? error.message : String(error) };
  }
}

export function setupResendAdminRoutes(deps: ResendAdminRoutesDeps): void {
  const { app, pool, requireAdminSession } = deps;

  // Sørg for at logg-tabellen finnes — idempotent oppstart-sjekk.
  void pool.query(
    `CREATE TABLE IF NOT EXISTS transactional_email_log (
      id BIGSERIAL PRIMARY KEY,
      provider TEXT NOT NULL,
      status TEXT NOT NULL,
      message_id TEXT,
      to_email TEXT NOT NULL,
      subject TEXT,
      kind TEXT,
      project_id TEXT,
      sent_by_user_id TEXT,
      error_reason TEXT,
      error_message TEXT,
      sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_tx_email_log_sent_at ON transactional_email_log(sent_at DESC);
    CREATE INDEX IF NOT EXISTS idx_tx_email_log_status_sent_at ON transactional_email_log(status, sent_at DESC);
    CREATE INDEX IF NOT EXISTS idx_tx_email_log_provider_sent_at ON transactional_email_log(provider, sent_at DESC);`,
  ).catch((err) => console.warn('[resend-admin] table ensure failed:', err));

  app.get('/api/admin/resend/status', async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    // Samme prioritets-rekkefølge som transactional-email-service:
    // ROLE_ROOM_RESEND_API_KEY først, RESEND_API_KEY fallback.
    const apiKey = readEnvString(process.env.ROLE_ROOM_RESEND_API_KEY)
      ?? readEnvString(process.env.RESEND_API_KEY);
    const gmailUser = readEnvString(process.env.GMAIL_USER ?? process.env.GOOGLE_WORKSPACE_EMAIL);
    const gmailPassword = readEnvString(process.env.GMAIL_APP_PASSWORD);
    const fromEmail = readEnvString(process.env.ROLE_ROOM_RESEND_FROM_EMAIL)
      ?? readEnvString(process.env.RESEND_FROM_EMAIL)
      ?? 'no-reply@theroleroom.com';

    let resendDomains: Awaited<ReturnType<typeof fetchResendDomains>> | null = null;
    if (apiKey) {
      resendDomains = await fetchResendDomains(apiKey);
    }

    const providers = {
      resend: {
        configured: Boolean(apiKey),
        apiKeyMasked: apiKey ? `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}` : null,
        domains: resendDomains?.domains ?? [],
        domainsOk: resendDomains?.ok ?? false,
        domainsError: resendDomains?.error ?? null,
        fromEmail,
      },
      gmail: {
        configured: Boolean(gmailUser && gmailPassword),
        user: gmailUser,
      },
    } as const;

    const primaryProvider = providers.resend.configured ? 'resend' : (providers.gmail.configured ? 'smtp' : null);

    res.json({
      success: true,
      primaryProvider,
      providers,
      freeTier: { monthly: RESEND_FREE_TIER_MONTHLY, daily: RESEND_FREE_TIER_DAILY },
    });
  });

  app.get('/api/admin/resend/usage', async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const result = await pool.query<{
        monthly_sent: string;
        monthly_failed: string;
        daily_sent: string;
        daily_failed: string;
        resend_count: string;
        smtp_count: string;
      }>(
        `SELECT
          COUNT(*) FILTER (WHERE status = 'sent' AND sent_at >= date_trunc('month', NOW())) AS monthly_sent,
          COUNT(*) FILTER (WHERE status = 'failed' AND sent_at >= date_trunc('month', NOW())) AS monthly_failed,
          COUNT(*) FILTER (WHERE status = 'sent' AND sent_at >= date_trunc('day', NOW())) AS daily_sent,
          COUNT(*) FILTER (WHERE status = 'failed' AND sent_at >= date_trunc('day', NOW())) AS daily_failed,
          COUNT(*) FILTER (WHERE provider = 'resend' AND sent_at >= date_trunc('month', NOW())) AS resend_count,
          COUNT(*) FILTER (WHERE provider = 'smtp' AND sent_at >= date_trunc('month', NOW())) AS smtp_count
        FROM transactional_email_log`,
      );

      const row = result.rows[0] ?? {
        monthly_sent: '0', monthly_failed: '0', daily_sent: '0', daily_failed: '0',
        resend_count: '0', smtp_count: '0',
      };
      const monthlySent = Number(row.monthly_sent);
      const dailySent = Number(row.daily_sent);

      res.json({
        success: true,
        monthly: {
          sent: monthlySent,
          failed: Number(row.monthly_failed),
          limit: RESEND_FREE_TIER_MONTHLY,
          usagePct: Math.min(100, Math.round((monthlySent / RESEND_FREE_TIER_MONTHLY) * 100)),
          remaining: Math.max(0, RESEND_FREE_TIER_MONTHLY - monthlySent),
        },
        daily: {
          sent: dailySent,
          failed: Number(row.daily_failed),
          limit: RESEND_FREE_TIER_DAILY,
          usagePct: Math.min(100, Math.round((dailySent / RESEND_FREE_TIER_DAILY) * 100)),
          remaining: Math.max(0, RESEND_FREE_TIER_DAILY - dailySent),
        },
        breakdownByProvider: {
          resend: Number(row.resend_count),
          smtp: Number(row.smtp_count),
        },
      });
    } catch (error) {
      console.error('[resend-admin] usage query failed:', error);
      res.status(500).json({ success: false, error: 'usage_query_failed' });
    }
  });

  app.get('/api/admin/resend/recent', async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    const limit = Math.max(1, Math.min(200, Number(req.query.limit ?? 50)));
    try {
      const result = await pool.query(
        `SELECT id, provider, status, message_id, to_email, subject, kind,
                project_id, sent_by_user_id, error_reason, error_message, sent_at
           FROM transactional_email_log
          ORDER BY sent_at DESC
          LIMIT $1`,
        [limit],
      );
      res.json({
        success: true,
        items: result.rows.map((r: any) => ({
          id: String(r.id),
          provider: r.provider,
          status: r.status,
          messageId: r.message_id,
          toEmail: r.to_email,
          subject: r.subject,
          kind: r.kind,
          projectId: r.project_id,
          sentByUserId: r.sent_by_user_id,
          errorReason: r.error_reason,
          errorMessage: r.error_message,
          sentAt: r.sent_at instanceof Date ? r.sent_at.toISOString() : r.sent_at,
        })),
      });
    } catch (error) {
      console.error('[resend-admin] recent query failed:', error);
      res.status(500).json({ success: false, error: 'recent_query_failed' });
    }
  });
}
