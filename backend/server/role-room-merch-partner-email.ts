/**
 * Role Room — send cooperation/outreach emails to merch partners
 * (Slice 7b). Reuses the existing nodemailer + Gmail SMTP transport
 * pattern (GMAIL_USER / GOOGLE_ADMIN_EMAIL + GMAIL_APP_PASSWORD) that
 * already powers crew-invites, audition reminders and access-request
 * emails — no new third-party email provider, no extra cost.
 *
 * Every send is logged to role_room_merch_partner_emails so the
 * producer can see "Sendt 4. mai til Lindeberg SK Fotball ✓" inside
 * the agent without leaving Role Room. The producer is BCC'd so the
 * sent message also lands in their own Gmail "Sent"-folder.
 */

import nodemailer from "nodemailer";
import type { Pool } from "pg";

export interface SendMerchPartnerEmailInput {
  pool: Pool;
  projectId: string;
  userId: string | null;
  partnerOrgnr: string | null;
  partnerName: string;
  partnerEmail: string;
  /** Producer's own email — BCC'd so they have a copy in their Sent folder.
   *  When null, only the partner receives. */
  producerCcEmail?: string | null;
  subject: string;
  bodyMarkdown: string;
  /** When set, used as Reply-To so partner replies hit producer's
   *  inbox directly even though we sent through GMAIL_USER. */
  replyToEmail?: string | null;
}

export interface SendMerchPartnerEmailResult {
  ok: boolean;
  messageId: string | null;
  reason?: string;
  loggedRowId?: string;
}

export interface MerchPartnerEmailLogEntry {
  id: string;
  projectId: string;
  partnerOrgnr: string | null;
  partnerName: string;
  partnerEmail: string;
  ccEmail: string | null;
  subject: string;
  bodyMarkdown: string;
  status: string;
  gmailMessageId: string | null;
  errorMessage: string | null;
  sentByUserId: string | null;
  sentAt: string;
}

function readGmailConfig(): { user: string; password: string } | null {
  const user =
    (process.env.GMAIL_USER
      ?? process.env.GOOGLE_WORKSPACE_EMAIL
      ?? process.env.GOOGLE_ADMIN_EMAIL
      ?? "").trim();
  const password = (process.env.GMAIL_APP_PASSWORD ?? "").replace(/\s+/g, "");
  if (!user || !password) return null;
  return { user, password };
}

/** Validate a Norwegian-style mail address. nodemailer is permissive
 *  about the recipient header; we want to fail loudly for placeholders
 *  (bruker@domene.no etc) that the scraper might have leaked through. */
function isPlausibleRecipient(email: string): boolean {
  if (!email) return false;
  const lower = email.toLowerCase().trim();
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(lower)) return false;
  if (lower.startsWith("bruker@") || lower.startsWith("test@") || lower.startsWith("noreply@")) return false;
  if (/(domene|firma|bedrift|kunde)\.(no|com)$/.test(lower)) return false;
  return true;
}

/** Convert markdown bullets/headings to a plain-text body that renders
 *  acceptably in any email client. Producer typically wants the email
 *  to look like a normal letter, not a markdown dump. */
function markdownToPlainText(markdown: string): string {
  return markdown
    // Headings — strip leading hashes, keep the line.
    .replace(/^#{1,6}\s+/gm, "")
    // Bold / italic markers — drop the markers, keep the text.
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    // Bullet lists — replace "- " with "• " for slightly nicer plain-text.
    .replace(/^[-*]\s+/gm, "• ")
    // Numbered list markers stay as-is.
    .replace(/\n{3,}/g, "\n\n");
}

/** Build a minimal HTML version of the markdown so the email renders
 *  with paragraph spacing in clients that prefer HTML. Markdown-style
 *  headings become <h3>, bullets become <ul>, paragraphs are <p>. */
function markdownToHtml(markdown: string): string {
  const lines = markdown.split(/\n/);
  const out: string[] = [];
  let inList = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (line.length === 0) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push("");
      continue;
    }
    const heading = line.match(/^#{1,6}\s+(.+)$/);
    if (heading) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<h3 style="margin:18px 0 6px 0;font-size:15px;">${escapeHtml(heading[1])}</h3>`);
      continue;
    }
    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      if (!inList) { out.push("<ul style=\"margin:6px 0;padding-left:20px;\">"); inList = true; }
      out.push(`<li>${escapeHtml(bullet[1])}</li>`);
      continue;
    }
    if (inList) { out.push("</ul>"); inList = false; }
    out.push(`<p style="margin:6px 0;line-height:1.55;">${escapeHtml(line)}</p>`);
  }
  if (inList) out.push("</ul>");
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;color:#1a1a1a;">${out.join("\n")}</div>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function logSentEmail(
  pool: Pool,
  input: SendMerchPartnerEmailInput,
  result: { status: string; gmailMessageId: string | null; errorMessage: string | null },
): Promise<string | null> {
  try {
    const r = await pool.query(
      `INSERT INTO role_room_merch_partner_emails (
         project_id, partner_orgnr, partner_name, partner_email, cc_email,
         subject, body_markdown, status, gmail_message_id, error_message, sent_by_user_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        input.projectId,
        input.partnerOrgnr,
        input.partnerName,
        input.partnerEmail,
        input.producerCcEmail ?? null,
        input.subject,
        input.bodyMarkdown,
        result.status,
        result.gmailMessageId,
        result.errorMessage,
        input.userId,
      ],
    );
    return r.rows[0]?.id ?? null;
  } catch (err) {
    console.error("[merch-partner-email] log failure:", err);
    return null;
  }
}

export async function sendMerchPartnerEmail(
  input: SendMerchPartnerEmailInput,
): Promise<SendMerchPartnerEmailResult> {
  // Validate recipient first so we never log a placeholder send attempt.
  if (!isPlausibleRecipient(input.partnerEmail)) {
    return {
      ok: false,
      messageId: null,
      reason: "invalid_recipient",
    };
  }
  const cfg = readGmailConfig();
  if (!cfg) {
    return {
      ok: false,
      messageId: null,
      reason: "missing_email_config",
    };
  }
  if (!input.subject?.trim() || !input.bodyMarkdown?.trim()) {
    return { ok: false, messageId: null, reason: "missing_subject_or_body" };
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: cfg.user,
      pass: cfg.password,
    },
  });

  const plainBody = markdownToPlainText(input.bodyMarkdown);
  const htmlBody = markdownToHtml(input.bodyMarkdown);

  try {
    const info = await transporter.sendMail({
      from: cfg.user,
      to: input.partnerEmail,
      bcc: input.producerCcEmail ?? undefined,
      replyTo: input.replyToEmail ?? input.producerCcEmail ?? cfg.user,
      subject: input.subject.trim(),
      text: plainBody,
      html: htmlBody,
    });
    const messageId = info?.messageId ?? null;
    const loggedRowId = await logSentEmail(input.pool, input, {
      status: "sent",
      gmailMessageId: messageId,
      errorMessage: null,
    });
    return { ok: true, messageId, loggedRowId: loggedRowId ?? undefined };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await logSentEmail(input.pool, input, {
      status: "failed",
      gmailMessageId: null,
      errorMessage,
    });
    return { ok: false, messageId: null, reason: errorMessage };
  }
}

export async function listMerchPartnerEmails(
  pool: Pool,
  options: { projectId: string; partnerOrgnr?: string | null; limit?: number },
): Promise<MerchPartnerEmailLogEntry[]> {
  const limit = Math.min(Math.max(1, options.limit ?? 50), 200);
  const params: unknown[] = [options.projectId];
  let where = "project_id = $1";
  if (options.partnerOrgnr) {
    params.push(options.partnerOrgnr);
    where += ` AND partner_orgnr = $${params.length}`;
  }
  params.push(limit);
  try {
    const r = await pool.query(
      `SELECT id, project_id, partner_orgnr, partner_name, partner_email,
              cc_email, subject, body_markdown, status, gmail_message_id,
              error_message, sent_by_user_id, sent_at
         FROM role_room_merch_partner_emails
         WHERE ${where}
         ORDER BY sent_at DESC
         LIMIT $${params.length}`,
      params,
    );
    return r.rows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      partnerOrgnr: row.partner_orgnr,
      partnerName: row.partner_name,
      partnerEmail: row.partner_email,
      ccEmail: row.cc_email,
      subject: row.subject,
      bodyMarkdown: row.body_markdown,
      status: row.status,
      gmailMessageId: row.gmail_message_id,
      errorMessage: row.error_message,
      sentByUserId: row.sent_by_user_id,
      sentAt: row.sent_at instanceof Date ? row.sent_at.toISOString() : String(row.sent_at),
    }));
  } catch (err) {
    console.error("[merch-partner-email] list failure:", err);
    return [];
  }
}
