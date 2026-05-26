/**
 * role-room-newsletter-email-service.ts
 *
 * Norwegian Casting Brief — send-funksjoner for confirm-mail og issue-blast.
 * Gjenbruker eksisterende Gmail SMTP-konfigurasjon (GMAIL_USER + GMAIL_APP_PASSWORD).
 */

import nodemailer, { type Transporter } from "nodemailer";

let cachedTransporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (cachedTransporter) return cachedTransporter;
  const user =
    process.env.GMAIL_USER ||
    process.env.GOOGLE_WORKSPACE_EMAIL ||
    process.env.GOOGLE_ADMIN_EMAIL;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    console.warn("[role-room-newsletter] Gmail SMTP ikke konfigurert");
    return null;
  }
  cachedTransporter = nodemailer.createTransport({ service: "gmail", auth: { user, pass } });
  return cachedTransporter;
}

function getFromAddress(): string {
  const addr =
    process.env.ROLE_ROOM_NEWSLETTER_FROM ||
    process.env.GMAIL_USER ||
    "noreply@theroleroom.com";
  return `Norwegian Casting Brief <${addr}>`;
}

function publicOrigin(): string {
  return (
    process.env.ROLE_ROOM_PUBLIC_URL ||
    process.env.PUBLIC_APP_URL ||
    "https://theroleroom.com"
  ).replace(/\/$/, "");
}

const BRIEF_BRAND_HEX = "#8b5cf6";
const BRIEF_BG_HEX = "#0a0a0f";

function wrapBrandedHtml(opts: { previewText: string; bodyHtml: string; unsubscribeUrl: string | null; footerNote?: string }): string {
  const { previewText, bodyHtml, unsubscribeUrl, footerNote } = opts;
  return `<!DOCTYPE html>
<html lang="no">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body { margin: 0; padding: 0; background: ${BRIEF_BG_HEX}; color: #e5e7eb; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  .preview { display: none; max-height: 0; overflow: hidden; opacity: 0; color: transparent; height: 0; width: 0; font-size: 1px; line-height: 1px; }
  .container { max-width: 600px; margin: 0 auto; padding: 24px; }
  .header { padding: 24px 0 16px; border-bottom: 1px solid rgba(255,255,255,0.08); margin-bottom: 24px; }
  .brand { color: ${BRIEF_BRAND_HEX}; font-family: "Courier New", Courier, monospace; font-size: 12px; letter-spacing: 0.25em; text-transform: uppercase; font-weight: 700; }
  .content { color: #e5e7eb; font-size: 15px; line-height: 1.7; }
  .content h1, .content h2, .content h3 { color: #fff; line-height: 1.3; }
  .content h1 { font-size: 28px; margin: 0 0 16px; }
  .content h2 { font-size: 20px; margin: 28px 0 12px; }
  .content h3 { font-size: 16px; margin: 24px 0 8px; }
  .content p { margin: 0 0 16px; }
  .content a { color: #a78bfa; }
  .content blockquote { border-left: 3px solid ${BRIEF_BRAND_HEX}; padding-left: 16px; color: rgba(229,231,235,0.78); margin: 16px 0; }
  .content ul, .content ol { padding-left: 24px; margin: 12px 0; }
  .content li { margin: 4px 0; }
  .footer { margin-top: 40px; padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.08); color: rgba(229,231,235,0.5); font-size: 12px; line-height: 1.6; }
  .footer a { color: rgba(167,139,250,0.85); }
</style>
</head>
<body>
<span class="preview">${previewText}</span>
<div class="container">
  <div class="header"><span class="brand">Norwegian Casting Brief</span></div>
  <div class="content">${bodyHtml}</div>
  <div class="footer">
    ${footerNote ? `<p>${footerNote}</p>` : ""}
    <p>Du mottar denne fordi du meldte deg på via theroleroom.com.${unsubscribeUrl ? ` <a href="${unsubscribeUrl}">Meld deg av</a>.` : ""}</p>
    <p>The Role Room · Et produkt fra CreatorHub Norge AS · Oslo, Norge</p>
  </div>
</div>
</body>
</html>`;
}

function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|h1|h2|h3|li)>/gi, "\n\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function sendNewsletterConfirmEmail(opts: { to: string; confirmToken: string; unsubscribeToken: string; source: string }): Promise<{ sent: boolean; error?: string }> {
  const transporter = getTransporter();
  if (!transporter) return { sent: false, error: "SMTP not configured" };

  const origin = publicOrigin();
  const confirmUrl = `${origin}/api/newsletter/role-room/confirm?token=${encodeURIComponent(opts.confirmToken)}`;
  const unsubscribeUrl = `${origin}/api/newsletter/role-room/unsubscribe?token=${encodeURIComponent(opts.unsubscribeToken)}`;

  const bodyHtml = `
    <h1>Bekreft påmeldingen til Norwegian Casting Brief</h1>
    <p>Hei,</p>
    <p>Du meldte deg på Norwegian Casting Brief fra <strong>${opts.source}</strong>. For å starte å motta brevet hver fredag, må du bekrefte e-postadressen din.</p>
    <p style="margin: 28px 0;">
      <a href="${confirmUrl}" style="display: inline-block; background: ${BRIEF_BRAND_HEX}; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600;">Bekreft påmelding</a>
    </p>
    <p>Hvis knappen ikke virker, kopier denne lenken til nettleseren:<br><a href="${confirmUrl}">${confirmUrl}</a></p>
    <p>Hvis du ikke meldte deg på, kan du se bort fra denne e-posten.</p>
  `;

  const html = wrapBrandedHtml({
    previewText: "Bekreft påmeldingen til Norwegian Casting Brief",
    bodyHtml,
    unsubscribeUrl,
    footerNote: "Denne bekreftelseslenken utløper aldri, men vi anbefaler å bekrefte innen 7 dager.",
  });

  try {
    const info = await transporter.sendMail({
      from: getFromAddress(),
      to: opts.to,
      subject: "Bekreft påmeldingen — Norwegian Casting Brief",
      html,
      text: htmlToText(html),
    });
    console.info(`[role-room-newsletter] confirm-mail sent to ${opts.to}`, { messageId: info.messageId });
    return { sent: true };
  } catch (err) {
    console.error("[role-room-newsletter] confirm-mail failed", err);
    return { sent: false, error: (err as Error).message };
  }
}

/**
 * Injiserer tracking i body-HTML:
 *  - Rewriter alle <a href="..."> til redirect via /api/newsletter/role-room/track/click
 *  - Legger til 1×1 transparent pixel rett før </body> (eller på slutten av body)
 */
function injectTracking(bodyHtml: string, opts: { issueId: string; signupId: string }): string {
  const base = publicOrigin();
  const params = `issue=${encodeURIComponent(opts.issueId)}&signup=${encodeURIComponent(opts.signupId)}`;

  // Rewrite href-er — skip mailto, tel og allerede-tracked links
  const trackedBody = bodyHtml.replace(/href="([^"]+)"/g, (match, url) => {
    if (typeof url !== "string") return match;
    if (url.startsWith("mailto:") || url.startsWith("tel:") || url.startsWith("#")) return match;
    if (url.includes("/api/newsletter/role-room/")) return match;
    return `href="${base}/api/newsletter/role-room/track/click?${params}&to=${encodeURIComponent(url)}"`;
  });

  const pixel = `<img src="${base}/api/newsletter/role-room/track/open.gif?${params}" alt="" width="1" height="1" style="display:block;width:1px;height:1px;opacity:0;">`;
  return `${trackedBody}\n${pixel}`;
}

export async function sendNewsletterIssueToRecipient(opts: {
  to: string;
  subject: string;
  preheader: string;
  bodyHtml: string;
  unsubscribeToken: string;
  issueId?: string;
  signupId?: string;
}): Promise<{ sent: boolean; error?: string }> {
  const transporter = getTransporter();
  if (!transporter) return { sent: false, error: "SMTP not configured" };
  const unsubscribeUrl = `${publicOrigin()}/api/newsletter/role-room/unsubscribe?token=${encodeURIComponent(opts.unsubscribeToken)}`;

  // Tracking aktiveres kun når både issueId og signupId er gitt (ekte send,
  // ikke test-send). Test-sends får uten tracking for å unngå å skitne stats.
  const trackedBody = opts.issueId && opts.signupId
    ? injectTracking(opts.bodyHtml, { issueId: opts.issueId, signupId: opts.signupId })
    : opts.bodyHtml;

  const html = wrapBrandedHtml({ previewText: opts.preheader, bodyHtml: trackedBody, unsubscribeUrl });
  try {
    await transporter.sendMail({
      from: getFromAddress(),
      to: opts.to,
      subject: opts.subject,
      html,
      text: htmlToText(html),
      headers: { "List-Unsubscribe": `<${unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    });
    return { sent: true };
  } catch (err) {
    return { sent: false, error: (err as Error).message };
  }
}

// ── Block-based content rendering ────────────────────────────────────────

export type NewsletterBlock =
  | { id: string; type: "header"; level?: 1 | 2 | 3; text: string }
  | { id: string; type: "text"; markdown: string }
  | { id: string; type: "image"; url: string; alt?: string; caption?: string }
  | { id: string; type: "cta"; label: string; url: string; align?: "left" | "center" | "right" }
  | { id: string; type: "divider" }
  | { id: string; type: "quote"; text: string; attribution?: string };

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function renderBlocksToHtml(blocks: NewsletterBlock[]): string {
  if (!Array.isArray(blocks) || blocks.length === 0) return "";
  const parts: string[] = [];
  for (const block of blocks) {
    switch (block.type) {
      case "header": {
        const level = block.level && [1, 2, 3].includes(block.level) ? block.level : 1;
        parts.push(`<h${level}>${escapeHtml(block.text)}</h${level}>`);
        break;
      }
      case "text":
        parts.push(markdownToHtml(block.markdown));
        break;
      case "image": {
        const img = `<img src="${escapeHtml(block.url)}" alt="${escapeHtml(block.alt ?? "")}" style="max-width:100%;height:auto;border-radius:8px;display:block;margin:0 auto;">`;
        const caption = block.caption
          ? `<p style="text-align:center;font-size:13px;color:rgba(229,231,235,0.6);margin-top:8px;">${escapeHtml(block.caption)}</p>`
          : "";
        parts.push(`<figure style="margin:24px 0;">${img}${caption}</figure>`);
        break;
      }
      case "cta": {
        const align = block.align ?? "center";
        parts.push(
          `<p style="text-align:${align};margin:28px 0;"><a href="${escapeHtml(block.url)}" style="display:inline-block;background:#8b5cf6;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:600;">${escapeHtml(block.label)}</a></p>`,
        );
        break;
      }
      case "divider":
        parts.push(`<hr style="border:none;border-top:1px solid rgba(255,255,255,0.12);margin:32px 0;">`);
        break;
      case "quote": {
        const attribution = block.attribution
          ? `<footer style="color:rgba(229,231,235,0.6);font-size:13px;margin-top:8px;">— ${escapeHtml(block.attribution)}</footer>`
          : "";
        parts.push(`<blockquote>${escapeHtml(block.text)}${attribution}</blockquote>`);
        break;
      }
    }
  }
  return parts.join("\n");
}

export function markdownToHtml(md: string): string {
  // Minimal markdown-renderer — bevisst enkel for å unngå tunge deps.
  // Hvis du trenger full markdown-støtte, bytt til `marked` eller `remark`.
  let html = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // Headers
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // Bold + italic
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    // Blockquotes
    .replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>")
    // Lists
    .replace(/(^|\n)((?:- .+(?:\n|$))+)/g, (_match, prefix, block) => {
      const items = block.trim().split("\n").map((line: string) => `<li>${line.replace(/^- /, "")}</li>`).join("");
      return `${prefix}<ul>${items}</ul>`;
    })
    .replace(/(^|\n)((?:\d+\. .+(?:\n|$))+)/g, (_match, prefix, block) => {
      const items = block.trim().split("\n").map((line: string) => `<li>${line.replace(/^\d+\. /, "")}</li>`).join("");
      return `${prefix}<ol>${items}</ol>`;
    });
  // Paragraphs — split på dobbel newline
  html = html
    .split(/\n{2,}/)
    .map((para) => {
      const trimmed = para.trim();
      if (!trimmed) return "";
      if (/^<(h[123]|ul|ol|blockquote)/i.test(trimmed)) return trimmed;
      return `<p>${trimmed.replace(/\n/g, "<br>")}</p>`;
    })
    .join("\n");
  return html;
}
