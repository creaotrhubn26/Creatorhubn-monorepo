/**
 * nextrole-email-service.ts
 *
 * Tynn wrapper rundt nodemailer for NextRole-spesifikke e-poster.
 * Bruker eksisterende Gmail SMTP-konfigurasjon fra env (samme som
 * password-reset-service.ts og resten av platformen).
 *
 * Eksporterer:
 *   sendNextRoleWelcomeEmail(to, firstName)
 *   sendNextRoleTrialStartedEmail(to, firstName, trialEndsAt)
 *   sendNextRoleTrialExpiringEmail(to, firstName, daysLeft, trialEndsAt, tier)
 *   sendNextRolePaymentReceiptEmail(to, firstName, opts)
 *
 * Returnerer { sent: true, messageId } eller { sent: false, error }.
 * Logger til console — kan utvides til central logging senere.
 */

import nodemailer from "nodemailer";
import {
  renderWelcomeEmail,
  renderTrialStartedEmail,
  renderTrialExpiringEmail,
  renderPaymentReceiptEmail,
  renderDripDay3TipsEmail,
  renderDripDay7SocialProofEmail,
  renderDripDay13LastCallEmail,
  renderPostTrialWinbackEmail,
} from "./nextrole-email-templates";

interface SendResult {
  sent: boolean;
  messageId?: string;
  error?: string;
}

let cachedTransporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (cachedTransporter) return cachedTransporter;
  const user =
    process.env.GMAIL_USER ||
    process.env.GOOGLE_WORKSPACE_EMAIL ||
    process.env.GOOGLE_ADMIN_EMAIL;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    console.warn(
      "[nextrole-email] Gmail SMTP er ikke konfigurert (mangler GMAIL_USER/GMAIL_APP_PASSWORD). E-poster blir ikke sendt.",
    );
    return null;
  }
  cachedTransporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
  return cachedTransporter;
}

function getFromAddress(): string {
  const addr =
    process.env.NEXTROLE_FROM_EMAIL ||
    process.env.GMAIL_USER ||
    process.env.GOOGLE_WORKSPACE_EMAIL ||
    process.env.GOOGLE_ADMIN_EMAIL ||
    "noreply@creatorhubn.com";
  return `NextRole <${addr}>`;
}

async function sendRendered(
  to: string,
  rendered: { subject: string; html: string; text: string },
  context: string,
): Promise<SendResult> {
  const transporter = getTransporter();
  if (!transporter) {
    return { sent: false, error: "SMTP not configured" };
  }
  try {
    const info = await transporter.sendMail({
      from: getFromAddress(),
      to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
    console.info(`[nextrole-email] ${context} sent to ${to}`, {
      messageId: info.messageId,
    });
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[nextrole-email] ${context} failed for ${to}:`, message);
    return { sent: false, error: message };
  }
}

// ── Public API ──────────────────────────────────────────────────────

export async function sendNextRoleWelcomeEmail(
  to: string,
  firstName: string,
): Promise<SendResult> {
  return sendRendered(
    to,
    renderWelcomeEmail({ firstName, email: to }),
    "welcome",
  );
}

export async function sendNextRoleTrialStartedEmail(
  to: string,
  firstName: string,
  trialEndsAt: Date,
): Promise<SendResult> {
  return sendRendered(
    to,
    renderTrialStartedEmail({ firstName, trialEndsAt }),
    "trial-started",
  );
}

export async function sendNextRoleTrialExpiringEmail(
  to: string,
  firstName: string,
  daysLeft: number,
  trialEndsAt: Date,
  convertingTo: "standard" | "pro" = "standard",
): Promise<SendResult> {
  return sendRendered(
    to,
    renderTrialExpiringEmail({
      firstName,
      daysLeft,
      trialEndsAt,
      convertingTo,
    }),
    "trial-expiring",
  );
}

export async function sendNextRolePaymentReceiptEmail(
  to: string,
  firstName: string,
  opts: {
    tierId: "standard" | "pro";
    amountOre: number;
    currency: string;
    invoiceId?: string;
    nextBillingDate?: Date;
    invoiceUrl?: string;
  },
): Promise<SendResult> {
  return sendRendered(
    to,
    renderPaymentReceiptEmail({
      firstName,
      ...opts,
    }),
    "payment-receipt",
  );
}

// ── Drip-templates ──────────────────────────────────────────────────

interface DripInput {
  firstName: string;
  trialEndsAt: Date;
  daysActive: number;
  resumesBuilt?: number;
  hasUsedAiAnalysis?: boolean;
}

export async function sendNextRoleDripDay3TipsEmail(
  to: string,
  input: DripInput,
): Promise<SendResult> {
  return sendRendered(to, renderDripDay3TipsEmail(input), "drip-day3-tips");
}

export async function sendNextRoleDripDay7SocialProofEmail(
  to: string,
  input: DripInput,
): Promise<SendResult> {
  return sendRendered(
    to,
    renderDripDay7SocialProofEmail(input),
    "drip-day7-social",
  );
}

export async function sendNextRoleDripDay13LastCallEmail(
  to: string,
  input: DripInput,
): Promise<SendResult> {
  return sendRendered(
    to,
    renderDripDay13LastCallEmail(input),
    "drip-day13-lastcall",
  );
}

export async function sendNextRolePostTrialWinbackEmail(
  to: string,
  input: DripInput,
): Promise<SendResult> {
  return sendRendered(
    to,
    renderPostTrialWinbackEmail(input),
    "post-trial-winback",
  );
}
