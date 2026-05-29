/**
 * Transactional email-service for The Role Room / CreatorHub.
 *
 * Prøver Resend HTTP-API først (hvis RESEND_API_KEY er satt), faller
 * tilbake til Gmail SMTP via nodemailer (GMAIL_USER + GMAIL_APP_PASSWORD).
 * Resend er foretrukket for produksjon: API-nøkler utløper ikke, ingen
 * 2FA-binding, du eier domenet via DKIM/SPF, og du får bounces +
 * open-rates i Resend-dashboardet.
 *
 * Påvirker IKKE Google Workspace-OAuth (Calendar, Meet, Drive) — de er
 * separate systemer som bruker OAuth-tokens, ikke SMTP-passord.
 *
 * Bruk:
 *   const result = await sendTransactionalEmail({
 *     to: 'klient@kunde.no',
 *     subject: '...',
 *     html: '<p>...</p>',
 *     text: '...',
 *     replyTo: 'daniel@creatorhubn.com',
 *     fromLabel: 'The Role Room',
 *   });
 *   if (!result.sent) console.error(result.reason, result.errorMessage);
 */

import nodemailer from 'nodemailer';
import type { Pool } from 'pg';

export type TransactionalEmailReason =
  | 'missing_email_config'
  | 'resend_auth_failed'
  | 'resend_domain_not_verified'
  | 'resend_rate_limited'
  | 'resend_failed'
  | 'gmail_auth_failed'
  | 'gmail_rate_limited'
  | 'smtp_unreachable'
  | 'send_failed';

export interface TransactionalEmailResult {
  sent: boolean;
  reason: TransactionalEmailReason | null;
  provider: 'resend' | 'smtp' | null;
  messageId: string | null;
  accepted: string[];
  errorMessage: string | null;
}

export interface TransactionalEmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string | null;
  /** Display name foran "<from@adressen>". Default "The Role Room". */
  fromLabel?: string | null;
  /** Override fra-adresse. Default: RESEND_FROM_EMAIL eller GMAIL_USER. */
  fromAddress?: string | null;
  /** For logging — type sending (client_invite, talent_invite, ...). */
  kind?: string | null;
  /** For logging — knyttet prosjekt-ID, hvis aktuelt. */
  projectId?: string | null;
  /** For logging — bruker som triggrer sendingen. */
  sentByUserId?: string | null;
  /** For logging — pool for å skrive til transactional_email_log. */
  pool?: Pool | null;
}

function readEnvString(value: string | undefined | null): string | null {
  const s = typeof value === 'string' ? value.trim() : '';
  return s.length > 0 ? s : null;
}

function defaultResendFromAddress(): string {
  return readEnvString(process.env.ROLE_ROOM_RESEND_FROM_EMAIL)
    ?? readEnvString(process.env.RESEND_FROM_EMAIL)
    ?? 'no-reply@theroleroom.com';
}

/** Leser Resend API-key med Role Room-spesifikk var som førsteprioritet
 *  + generelt RESEND_API_KEY-fallback. Tillater flere keys per Render-
 *  instans (én per app som sender via Resend). */
function resolveResendApiKey(): string | null {
  return readEnvString(process.env.ROLE_ROOM_RESEND_API_KEY)
    ?? readEnvString(process.env.RESEND_API_KEY);
}

async function sendViaResend(opts: TransactionalEmailOptions): Promise<TransactionalEmailResult> {
  const apiKey = resolveResendApiKey();
  if (!apiKey) {
    return {
      sent: false,
      reason: 'missing_email_config',
      provider: null,
      messageId: null,
      accepted: [],
      errorMessage: 'RESEND_API_KEY not set',
    };
  }

  const fromLabel = readEnvString(opts.fromLabel) ?? 'The Role Room';
  const fromAddress = readEnvString(opts.fromAddress) ?? defaultResendFromAddress();
  const fromHeader = `${fromLabel} <${fromAddress}>`;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: fromHeader,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
        reply_to: opts.replyTo ? [opts.replyTo] : undefined,
      }),
    });

    const payload = await response.json().catch(() => null) as
      | { id?: string; name?: string; message?: string; statusCode?: number }
      | null;

    if (response.ok && payload?.id) {
      return {
        sent: true,
        reason: null,
        provider: 'resend',
        messageId: payload.id,
        accepted: [opts.to],
        errorMessage: null,
      };
    }

    // Map Resend-feilkoder til våre reasons.
    const errName = payload?.name ?? '';
    const errMessage = payload?.message ?? `HTTP ${response.status}`;
    let reason: TransactionalEmailReason = 'resend_failed';
    if (response.status === 401 || errName.includes('invalid_api_key')) {
      reason = 'resend_auth_failed';
    } else if (errName.includes('validation_error') && errMessage.includes('domain')) {
      reason = 'resend_domain_not_verified';
    } else if (response.status === 429 || errName.includes('rate_limit')) {
      reason = 'resend_rate_limited';
    }

    console.error('Resend send error:', { status: response.status, name: errName, message: errMessage });
    return {
      sent: false,
      reason,
      provider: 'resend',
      messageId: null,
      accepted: [],
      errorMessage: errMessage,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Resend network error:', message);
    return {
      sent: false,
      reason: 'smtp_unreachable',
      provider: 'resend',
      messageId: null,
      accepted: [],
      errorMessage: message,
    };
  }
}

async function sendViaGmailSmtp(opts: TransactionalEmailOptions): Promise<TransactionalEmailResult> {
  const user = readEnvString(
    process.env.GMAIL_USER
    ?? process.env.GOOGLE_WORKSPACE_EMAIL
    ?? process.env.GOOGLE_ADMIN_EMAIL,
  );
  const password = readEnvString(process.env.GMAIL_APP_PASSWORD)?.replace(/\s+/g, '') ?? null;

  if (!user || !password) {
    return {
      sent: false,
      reason: 'missing_email_config',
      provider: null,
      messageId: null,
      accepted: [],
      errorMessage: 'GMAIL_USER or GMAIL_APP_PASSWORD not set',
    };
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass: password },
  });

  const fromLabel = readEnvString(opts.fromLabel) ?? 'The Role Room';
  const fromAddress = readEnvString(opts.fromAddress) ?? user;
  const fromHeader = `${fromLabel} <${fromAddress}>`;

  try {
    const info = await transporter.sendMail({
      from: fromHeader,
      to: opts.to,
      replyTo: opts.replyTo ?? undefined,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    });

    return {
      sent: true,
      reason: null,
      provider: 'smtp',
      messageId: typeof info.messageId === 'string' ? info.messageId : null,
      accepted: Array.isArray(info.accepted)
        ? info.accepted.map((value: unknown) => String(value))
        : [opts.to],
      errorMessage: null,
    };
  } catch (error) {
    const err = error as { code?: string; responseCode?: number; response?: string; message?: string };
    console.error('Gmail SMTP send error:', {
      code: err?.code,
      responseCode: err?.responseCode,
      response: err?.response,
      message: err?.message,
    });
    let reason: TransactionalEmailReason = 'send_failed';
    if (err?.code === 'EAUTH' || err?.responseCode === 535) {
      reason = 'gmail_auth_failed';
    } else if (err?.responseCode === 421 || err?.responseCode === 450) {
      reason = 'gmail_rate_limited';
    } else if (err?.code === 'ESOCKET' || err?.code === 'ECONNECTION') {
      reason = 'smtp_unreachable';
    }
    return {
      sent: false,
      reason,
      provider: 'smtp',
      messageId: null,
      accepted: [],
      errorMessage: err?.message ?? null,
    };
  }
}

async function logTransactionalEmail(
  pool: Pool | null | undefined,
  opts: TransactionalEmailOptions,
  result: TransactionalEmailResult,
): Promise<void> {
  if (!pool) return;
  try {
    await pool.query(
      `INSERT INTO transactional_email_log (
        provider, status, message_id, to_email, subject, kind, project_id,
        sent_by_user_id, error_reason, error_message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        result.provider ?? 'unknown',
        result.sent ? 'sent' : 'failed',
        result.messageId,
        opts.to,
        opts.subject,
        opts.kind ?? null,
        opts.projectId ?? null,
        opts.sentByUserId ?? null,
        result.reason,
        result.errorMessage,
      ],
    );
  } catch (logError) {
    console.warn('Klarte ikke logge transactional_email_log:', logError);
  }
}

/**
 * Send transactional email. Prøver Resend først hvis RESEND_API_KEY er
 * satt, faller tilbake til Gmail SMTP ved feil eller hvis Resend mangler.
 * Returnerer alltid et resultat — kaster aldri. Logger til
 * transactional_email_log hvis pool er gitt (for Admin Room-dashboard).
 */
export async function sendTransactionalEmail(
  opts: TransactionalEmailOptions,
): Promise<TransactionalEmailResult> {
  const resendAvailable = resolveResendApiKey() !== null;
  let result: TransactionalEmailResult;

  if (resendAvailable) {
    result = await sendViaResend(opts);
    if (
      !result.sent
      && (
        result.reason === 'resend_auth_failed'
        || result.reason === 'resend_domain_not_verified'
      )
    ) {
      // Fall til SMTP kun ved kritisk Resend-feilkonfig.
      console.warn('Resend ikke i drift, faller tilbake til Gmail SMTP:', result.reason);
      result = await sendViaGmailSmtp(opts);
    }
  } else {
    result = await sendViaGmailSmtp(opts);
  }

  await logTransactionalEmail(opts.pool, opts, result);
  return result;
}

/** Returnerer true hvis enten Resend ELLER Gmail er konfigurert. */
export function isTransactionalEmailConfigured(): boolean {
  if (resolveResendApiKey()) return true;
  const user = readEnvString(
    process.env.GMAIL_USER
    ?? process.env.GOOGLE_WORKSPACE_EMAIL
    ?? process.env.GOOGLE_ADMIN_EMAIL,
  );
  const password = readEnvString(process.env.GMAIL_APP_PASSWORD);
  return Boolean(user && password);
}
