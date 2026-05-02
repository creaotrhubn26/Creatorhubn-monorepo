/**
 * Send e-post-varsel når en social-publish feiler permanent (etter alle
 * retries). Lukker "wake-up"-loopen — brukeren trenger ikke å sjekke
 * Approvals-widgeten manuelt for å oppdage feilet posts.
 *
 * Idempotent: vi husker ikke hvilke jobs vi har varslet, men siden
 * permanent failure kun skjer én gang per job (state = 'failed' er en
 * terminal-state), blir vi heller ikke ringt for samme jobb to ganger.
 *
 * Best-effort: hvis Gmail-config mangler eller send feiler, logger vi
 * og fortsetter. Aldri throw — feilet email skal ikke blokkere andre
 * sider av publish-pipelinen.
 */

import type { Pool } from 'pg';
import { sendEmail } from './casting-reminder-sender.js';

interface NotifyInput {
  userId: string;
  projectId: string;
  feedPlanPostId: string;
  postTitle: string;
  platform: 'instagram' | 'facebook_page' | string;
  errorMessage: string;
  /** Base URL til The Role Room (uten trailing slash). */
  appBaseUrl?: string;
}

async function lookupUserEmail(pool: Pool, userId: string): Promise<string | null> {
  try {
    const result = await pool.query<{ email: string | null }>(
      `SELECT email FROM creatorhub_users WHERE id = $1 LIMIT 1`,
      [userId],
    );
    const email = result.rows[0]?.email;
    return typeof email === 'string' && email.includes('@') ? email : null;
  } catch (error) {
    console.warn('[publish-fail-notifier] lookupUserEmail failed', error);
    return null;
  }
}

const PLATFORM_LABEL: Record<string, string> = {
  instagram: 'Instagram',
  facebook_page: 'Facebook Page',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
};

function buildEmailHtml(
  postTitle: string,
  platform: string,
  errorMessage: string,
  fixUrl: string,
): string {
  const platformLabel = PLATFORM_LABEL[platform] ?? platform;
  // Holdes bevisst kort + handlingsbar. Ingen logo-fanfare, ingen
  // farget gradient — dette er en utility-mail, ikke en marketing-mail.
  return `
<!doctype html>
<html lang="nb"><head><meta charset="utf-8"><title>Publisering feilet</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;color:#0f172a;margin:0;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:24px;">
    <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#dc2626;">Publisering feilet</h1>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:#334155;">
      Posten <strong>${escapeHtml(postTitle || 'Uten tittel')}</strong> kunne ikke publiseres
      til ${escapeHtml(platformLabel)} etter flere automatiske forsøk.
    </p>
    <div style="margin:16px 0;padding:12px;border-radius:6px;background:#fef2f2;border:1px solid #fecaca;">
      <p style="margin:0;font-size:13px;font-family:monospace;color:#7f1d1d;line-height:1.5;">
        ${escapeHtml(errorMessage.slice(0, 400))}
      </p>
    </div>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#334155;">
      Posten er flyttet til <strong>"Trenger endring"</strong> i Markedsplan-fasen.
      Åpne den i Role Room for å se hva som må justeres, og send inn på nytt.
    </p>
    <a href="${escapeHtml(fixUrl)}"
       style="display:inline-block;background:#0f172a;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">
      Åpne i Role Room
    </a>
    <p style="margin:24px 0 0;font-size:12px;color:#94a3b8;">
      Du får denne e-posten fordi posten din ble publisert via The Role Room Agent.
      Hvis posten gjentatte ganger feiler kan det være token-utløp eller en konto-restriksjon
      hos plattformen — sjekk Connections-baren øverst i Role Room.
    </p>
  </div>
</body></html>
  `.trim();
}

function buildEmailText(
  postTitle: string,
  platform: string,
  errorMessage: string,
  fixUrl: string,
): string {
  const platformLabel = PLATFORM_LABEL[platform] ?? platform;
  return [
    'Publisering feilet',
    '',
    `Posten "${postTitle || 'Uten tittel'}" kunne ikke publiseres til ${platformLabel}`,
    'etter flere automatiske forsøk.',
    '',
    'Feilmelding fra plattformen:',
    `  ${errorMessage.slice(0, 400)}`,
    '',
    'Posten er flyttet til "Trenger endring" i Markedsplan-fasen.',
    `Åpne i Role Room: ${fixUrl}`,
    '',
    '— The Role Room',
  ].join('\n');
}

function escapeHtml(input: string): string {
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function notifyPublishFailure(
  pool: Pool,
  input: NotifyInput,
): Promise<{ sent: boolean; reason?: string }> {
  if (!input.userId || !input.projectId) {
    return { sent: false, reason: 'missing_ids' };
  }
  const email = await lookupUserEmail(pool, input.userId);
  if (!email) {
    return { sent: false, reason: 'no_email_for_user' };
  }
  const baseUrl =
    input.appBaseUrl ||
    process.env.APP_BASE_URL ||
    'https://www.theroleroom.com';
  const fixUrl = `${baseUrl.replace(/\/$/, '')}/role-room/projects/${encodeURIComponent(
    input.projectId,
  )}?tab=marketing-plan`;

  const result = await sendEmail({
    to: email,
    subject: `Publisering feilet: ${input.postTitle || 'Uten tittel'}`,
    html: buildEmailHtml(input.postTitle, input.platform, input.errorMessage, fixUrl),
    text: buildEmailText(input.postTitle, input.platform, input.errorMessage, fixUrl),
    fromName: 'The Role Room',
  });

  if (!result.success) {
    return { sent: false, reason: result.error ?? 'send_failed' };
  }
  return { sent: true };
}
