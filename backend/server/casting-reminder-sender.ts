// SMS (Twilio) + e-post (Gmail) primitives for audition-reminders.
//
// Brand-bevisst: Velger Twilio Messaging Service SID per brand (role-room |
// creatorhub), med generisk TWILIO_* som fallback. Sender via Twilio REST API
// (HTTP basic-auth) for å unngå tung twilio npm-dep.

import { parsePhoneNumberFromString } from "libphonenumber-js";
import nodemailer from "nodemailer";

export type ReminderBrand = "role-room" | "creatorhub";
export type ReminderThreshold = "24h" | "1h";

export interface ReminderPrefs {
  sms24h: boolean;
  sms1h: boolean;
  email24h: boolean;
  email1h: boolean;
}

export const DEFAULT_REMINDER_PREFS: ReminderPrefs = {
  sms24h: true,
  sms1h: true,
  email24h: true,
  email1h: true,
};

export function parseReminderPrefs(raw: unknown): ReminderPrefs {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_REMINDER_PREFS };
  const r = raw as Record<string, unknown>;
  return {
    sms24h: typeof r.sms24h === "boolean" ? r.sms24h : DEFAULT_REMINDER_PREFS.sms24h,
    sms1h: typeof r.sms1h === "boolean" ? r.sms1h : DEFAULT_REMINDER_PREFS.sms1h,
    email24h: typeof r.email24h === "boolean" ? r.email24h : DEFAULT_REMINDER_PREFS.email24h,
    email1h: typeof r.email1h === "boolean" ? r.email1h : DEFAULT_REMINDER_PREFS.email1h,
  };
}

export interface SmsResult {
  success: boolean;
  provider: "twilio" | null;
  messageSid?: string;
  error?: string;
  brandLabel?: string;
}

export interface EmailResult {
  success: boolean;
  provider: "gmail" | null;
  messageId?: string;
  error?: string;
}

interface TwilioBrandConfig {
  accountSid: string;
  authToken: string;
  messagingServiceSid: string;
  brandLabel: string;
}

function readTwilioConfig(brand: ReminderBrand): TwilioBrandConfig | null {
  const prefix = brand === "role-room" ? "ROLE_ROOM" : "CREATORHUB";
  const accountSid =
    (process.env[`${prefix}_TWILIO_ACCOUNT_SID`] || "").trim() ||
    (process.env.TWILIO_ACCOUNT_SID || "").trim();
  const authToken =
    (process.env[`${prefix}_TWILIO_AUTH_TOKEN`] || "").trim() ||
    (process.env.TWILIO_AUTH_TOKEN || "").trim();
  const messagingServiceSid =
    (process.env[`${prefix}_TWILIO_MESSAGING_SERVICE_SID`] || "").trim();

  if (!accountSid || !authToken || !messagingServiceSid) return null;
  return {
    accountSid,
    authToken,
    messagingServiceSid,
    brandLabel: brand === "role-room" ? "The Role Room" : "CreatorHub",
  };
}

export function isSmsBrandConfigured(brand: ReminderBrand): boolean {
  return readTwilioConfig(brand) !== null;
}

export function normalizePhoneE164(
  raw: string | null | undefined,
  defaultCountry: "NO" | "SE" | "DK" | "FI" | "GB" | "US" = "NO",
): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  try {
    const parsed = parsePhoneNumberFromString(trimmed, defaultCountry);
    if (!parsed || !parsed.isValid()) return null;
    return parsed.format("E.164");
  } catch {
    return null;
  }
}

interface SendSmsInput {
  brand: ReminderBrand;
  to: string;
  body: string;
  fetchImpl?: typeof fetch;
}

export async function sendSms(input: SendSmsInput): Promise<SmsResult> {
  const config = readTwilioConfig(input.brand);
  if (!config) {
    return { success: false, provider: null, error: "twilio_not_configured" };
  }

  const e164 = normalizePhoneE164(input.to);
  if (!e164) {
    return {
      success: false,
      provider: "twilio",
      error: "invalid_phone",
      brandLabel: config.brandLabel,
    };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`;
  const params = new URLSearchParams();
  params.set("To", e164);
  params.set("MessagingServiceSid", config.messagingServiceSid);
  params.set("Body", input.body);

  const fetchFn = input.fetchImpl ?? fetch;

  try {
    const response = await fetchFn(url, {
      method: "POST",
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      return {
        success: false,
        provider: "twilio",
        error: `twilio_${response.status}: ${errBody.slice(0, 200)}`,
        brandLabel: config.brandLabel,
      };
    }

    const json = (await response.json().catch(() => ({}))) as { sid?: unknown };
    const messageSid = typeof json.sid === "string" ? json.sid : undefined;
    return {
      success: true,
      provider: "twilio",
      messageSid,
      brandLabel: config.brandLabel,
    };
  } catch (error) {
    return {
      success: false,
      provider: "twilio",
      error: error instanceof Error ? error.message : String(error),
      brandLabel: config.brandLabel,
    };
  }
}

function readGmailConfig(): { user: string; password: string } | null {
  const user =
    (process.env.GMAIL_USER || "").trim() ||
    (process.env.GOOGLE_WORKSPACE_EMAIL || "").trim() ||
    (process.env.GOOGLE_ADMIN_EMAIL || "").trim();
  const password = (process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, "");
  if (!user || !password) return null;
  return { user, password };
}

export function isEmailConfigured(): boolean {
  return readGmailConfig() !== null;
}

type GmailTransport = ReturnType<typeof nodemailer.createTransport>;

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  fromName: string;
  transportFactory?: () => GmailTransport;
}

export async function sendEmail(input: SendEmailInput): Promise<EmailResult> {
  const cfg = readGmailConfig();
  if (!cfg) return { success: false, provider: null, error: "gmail_not_configured" };

  const transport =
    input.transportFactory?.() ??
    nodemailer.createTransport({
      service: "gmail",
      auth: { user: cfg.user, pass: cfg.password },
    });

  try {
    const info = await transport.sendMail({
      from: `${input.fromName} <${cfg.user}>`,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
    return { success: true, provider: "gmail", messageId: info.messageId };
  } catch (error) {
    return {
      success: false,
      provider: "gmail",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export interface ReminderContext {
  candidateName: string;
  projectName: string;
  date: string;
  startTime: string;
  location?: string | null;
  threshold: ReminderThreshold;
  portalUrl?: string | null;
  brandLabel?: string;
}

export function buildAuditionReminderSmsBody(ctx: ReminderContext): string {
  const dateLabel = formatNorwegianDate(ctx.date);
  const intro =
    ctx.threshold === "24h"
      ? "Påminnelse: audition i morgen"
      : "Påminnelse: audition om ca 1 time";
  const lines = [intro, `${ctx.projectName} — ${dateLabel} kl ${ctx.startTime}`];
  if (ctx.location) lines.push(`Sted: ${ctx.location}`);
  if (ctx.portalUrl) lines.push(`Detaljer: ${ctx.portalUrl}`);
  lines.push(`— ${ctx.brandLabel || "The Role Room"}`);
  return lines.join("\n");
}

export function buildAuditionReminderEmail(ctx: ReminderContext): {
  subject: string;
  html: string;
  text: string;
} {
  const dateLabel = formatNorwegianDate(ctx.date);
  const subject =
    ctx.threshold === "24h"
      ? `Påminnelse: audition i morgen — ${ctx.projectName}`
      : `Påminnelse: audition om ca 1 time — ${ctx.projectName}`;
  const text = buildAuditionReminderSmsBody(ctx);
  const brandLabel = ctx.brandLabel || "The Role Room";
  const locationRow = ctx.location
    ? `<tr><td><strong>Sted</strong></td><td>${escapeHtml(ctx.location)}</td></tr>`
    : "";
  const ctaButton = ctx.portalUrl
    ? `<p><a href="${escapeHtml(ctx.portalUrl)}" style="display:inline-block;background:#f6c358;color:#171410;padding:10px 16px;text-decoration:none;border-radius:6px;font-weight:600;">Åpne talent-portalen</a></p>`
    : "";

  const html = `<!doctype html>
<html lang="nb"><head><meta charset="utf-8" /><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f6f3ee;font-family:system-ui,-apple-system,sans-serif;color:#171410;">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px;">
    <div style="background:#ffffff;border:1px solid #e9e0d4;border-radius:8px;overflow:hidden;">
      <div style="background:#171410;color:#f8f5ef;padding:16px 20px;font-weight:600;">${escapeHtml(brandLabel)}</div>
      <div style="padding:24px;">
        <h2 style="margin:0 0 12px;">${escapeHtml(subject)}</h2>
        <p>Hei ${escapeHtml(ctx.candidateName)},</p>
        <p>Dette er en vennlig påminnelse om auditionen din.</p>
        <table cellpadding="6" style="margin:16px 0;border-collapse:collapse;">
          <tr><td><strong>Prosjekt</strong></td><td>${escapeHtml(ctx.projectName)}</td></tr>
          <tr><td><strong>Dato</strong></td><td>${escapeHtml(dateLabel)}</td></tr>
          <tr><td><strong>Tid</strong></td><td>kl ${escapeHtml(ctx.startTime)}</td></tr>
          ${locationRow}
        </table>
        ${ctaButton}
        <p style="color:#7b7368;font-size:12px;margin-top:24px;">Du kan slå av påminnelser i innstillingene i talent-portalen.</p>
      </div>
    </div>
  </div>
</body></html>`;
  return { subject, html, text };
}

function formatNorwegianDate(iso: string): string {
  const months = [
    "januar",
    "februar",
    "mars",
    "april",
    "mai",
    "juni",
    "juli",
    "august",
    "september",
    "oktober",
    "november",
    "desember",
  ];
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const day = Number(m[3]);
  const monthIdx = Number(m[2]) - 1;
  return `${day}. ${months[monthIdx] ?? m[2]}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
