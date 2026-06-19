/**
 * lead-assignment-notification-service.ts
 *
 * Sender notifikasjoner til mottakeren når de blir tildelt en lead.
 *
 * Kanaler:
 *   1. In-app   (alltid lagret i notification_events)
 *   2. E-post   (via transactional-email-service + Leadgrid-branding)
 *   3. WhatsApp (via Meta Cloud API m/ approved utility-template)
 *
 * Respekterer user_lead_notification_prefs per bruker. Bygger e-post-HTML
 * med samme branding-system som klient-portalen (dark header + sender-card).
 */

import type { Pool } from "pg";

type EventType =
  | "lead_assigned_as_team_leader"
  | "lead_assigned_as_rep"
  | "lead_assigned_on_accept"
  | "lead_status_change"
  | "lead_won"
  | "lead_lost";

interface NotifyAssignmentParams {
  recipientUserId: string;
  organizationId: string;
  eventType: EventType;
  customerId: string;
  customerName: string;
  customerTier?: string | null;
  triggeredByUserId: string;
  note?: string | null;
  deepLink?: string | null;
}

interface UserPrefs {
  notify_email: boolean;
  notify_whatsapp: boolean;
  notify_sms: boolean;
  notify_in_app: boolean;
  notify_on_assigned_team_leader: boolean;
  notify_on_assigned_as_rep: boolean;
  notify_on_lead_status_change: boolean;
  notify_on_lead_won: boolean;
  notify_on_lead_lost: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
}

const DEFAULT_PREFS: UserPrefs = {
  notify_email: true, notify_whatsapp: false, notify_sms: false, notify_in_app: true,
  notify_on_assigned_team_leader: true, notify_on_assigned_as_rep: true,
  notify_on_lead_status_change: true, notify_on_lead_won: true, notify_on_lead_lost: false,
  quiet_hours_start: null, quiet_hours_end: null,
};

async function getUserPrefs(pool: Pool, userId: string): Promise<UserPrefs> {
  const r = await pool.query<UserPrefs>(
    `SELECT notify_email, notify_whatsapp, notify_sms, notify_in_app,
            notify_on_assigned_team_leader, notify_on_assigned_as_rep,
            notify_on_lead_status_change, notify_on_lead_won, notify_on_lead_lost,
            quiet_hours_start, quiet_hours_end
       FROM user_lead_notification_prefs WHERE user_id = $1`,
    [userId],
  );
  return r.rows[0] ?? DEFAULT_PREFS;
}

function eventEnabled(prefs: UserPrefs, e: EventType): boolean {
  switch (e) {
    case "lead_assigned_as_team_leader":
    case "lead_assigned_on_accept": return prefs.notify_on_assigned_team_leader;
    case "lead_assigned_as_rep":    return prefs.notify_on_assigned_as_rep;
    case "lead_status_change":      return prefs.notify_on_lead_status_change;
    case "lead_won":                return prefs.notify_on_lead_won;
    case "lead_lost":               return prefs.notify_on_lead_lost;
  }
}

function subjectFor(e: EventType, customerName: string, tier: string | null | undefined): string {
  const tierLbl = tier ? ` [${tier.toUpperCase()}]` : "";
  switch (e) {
    case "lead_assigned_as_team_leader":
    case "lead_assigned_on_accept":
      return `Ny lead tildelt deg som teamleder: ${customerName}${tierLbl}`;
    case "lead_assigned_as_rep":
      return `Ny lead i din portefølje: ${customerName}${tierLbl}`;
    case "lead_status_change":
      return `Status oppdatert: ${customerName}`;
    case "lead_won":
      return `🎉 Lead vunnet: ${customerName}`;
    case "lead_lost":
      return `Lead tapt: ${customerName}`;
  }
}

function bodyFor(e: EventType, customerName: string, note: string | null | undefined): string {
  const noteFmt = note ? `\n\nNotat: "${note}"` : "";
  switch (e) {
    case "lead_assigned_as_team_leader":
      return `Du er nå teamleder for ${customerName}. Du bestemmer hvem som skal jobbe med leaden videre.${noteFmt}`;
    case "lead_assigned_on_accept":
      return `${customerName} er lagt til som prosjekt og tildelt deg.${noteFmt}`;
    case "lead_assigned_as_rep":
      return `Du har fått tildelt ${customerName} av teamlederen din. Kontakt innen 24 timer for best resultat.${noteFmt}`;
    case "lead_status_change":
      return `Status på ${customerName} ble oppdatert.${noteFmt}`;
    case "lead_won":
      return `Gratulerer! Du vant ${customerName}.${noteFmt}`;
    case "lead_lost":
      return `${customerName} ble markert som tapt.${noteFmt}`;
  }
}

function buildEmailHtml(params: {
  recipientName: string;
  subject: string;
  body: string;
  customerName: string;
  customerTier: string | null | undefined;
  deepLink: string;
  brandColor: string;
}): string {
  const tierBadge = params.customerTier ? `
    <span style="display:inline-block; padding:3px 10px; border-radius:12px;
                  background:${params.customerTier === "hot" ? "#f87171"
                            : params.customerTier === "warm" ? "#ffb86b"
                            : "#a78bfa"};
                  color:#0a0512; font-weight:700; font-size:11px;
                  letter-spacing:0.5px; text-transform:uppercase;">
      ${params.customerTier} lead
    </span>` : "";

  return `<!DOCTYPE html>
<html lang="nb"><head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1.0" />
<title>${escapeHtml(params.subject)}</title>
</head>
<body style="margin:0; padding:0; background:#f4f4f8;
              font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
         style="background:#f4f4f8;">
    <tr><td style="padding:24px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"
             width="100%" style="max-width:600px; margin:0 auto; background:#fff;
                                  border-radius:8px; overflow:hidden;
                                  box-shadow:0 4px 16px rgba(0,0,0,0.06);">
        <tr><td style="background:#0a0512; padding:20px 24px;">
          <table width="100%"><tr>
            <td>
              <div style="color:rgba(255,255,255,0.5); font-size:10px;
                           letter-spacing:1px; text-transform:uppercase;">
                Leadgrid
              </div>
              <div style="color:${params.brandColor}; font-weight:700;
                           font-size:18px; margin-top:2px;">
                Tildelings-varsel
              </div>
            </td>
            <td align="right">${tierBadge}</td>
          </tr></table>
        </td></tr>

        <tr><td style="padding:28px 24px 8px 24px;">
          <h1 style="color:#0a0512; margin:0;
                      font-size:22px; line-height:1.3; font-weight:700;">
            Hei ${escapeHtml(params.recipientName)}!
          </h1>
        </td></tr>

        <tr><td style="padding:8px 24px;">
          <p style="color:#333; line-height:1.55; font-size:15px; margin:0;
                     white-space:pre-wrap;">${escapeHtml(params.body)}</p>
        </td></tr>

        <tr><td align="center" style="padding:24px;">
          <a href="${escapeAttr(params.deepLink)}"
             style="display:inline-block; background:${params.brandColor};
                    color:#0a0512; padding:14px 28px; border-radius:8px;
                    text-decoration:none; font-weight:700; font-size:15px;">
            Åpne ${escapeHtml(params.customerName)} →
          </a>
        </td></tr>

        <tr><td style="padding:16px 24px 24px 24px; border-top:1px solid #eee;
                       color:#888; font-size:11px; text-align:center;">
          Logg inn i Leadgrid for å se hele lead-historikken.<br/>
          <a href="/profil/notifikasjoner" style="color:#888;">Endre varsels-innstillingene</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/[\r\n]/g, "");
}

/** Send WhatsApp via Meta Cloud (samme env-config som klient-pipeline). */
async function sendInternalWhatsApp(
  to: string, recipientName: string, customerName: string, customerTier: string | null | undefined,
): Promise<boolean> {
  const token = process.env.META_WHATSAPP_ACCESS_TOKEN ?? process.env.META_APP_ACCESS_TOKEN ?? "";
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID ?? "";
  if (!token || !phoneId) return false;

  const tierLabel = customerTier ? customerTier.toUpperCase() : "ny";
  const body = `Hei ${recipientName}! Du har fått tildelt en ${tierLabel} lead: ${customerName}. Logg inn i Leadgrid for å se detaljer.`;

  try {
    // Bruker free-text utility-template hvis vi har den, ellers session-message
    // (24t-vinduet gjelder kun mot kunder som har sendt oss melding)
    const r = await fetch(
      `https://graph.facebook.com/v22.0/${phoneId}/messages`,
      {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: to.replace(/^\+/, ""),
          type: "text",
          text: { body },
        }),
      },
    );
    return r.ok;
  } catch { return false; }
}

/** Hent og send via Resend. */
async function sendInternalEmail(
  to: string, subject: string, html: string,
): Promise<boolean> {
  try {
    const { sendTransactionalEmail } = await import("./transactional-email-service.js");
    const r = await sendTransactionalEmail({
      to, subject, html,
      text: html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
      fromLabel: "Leadgrid",
      kind: "lead_assignment_internal",
    });
    return r.sent;
  } catch { return false; }
}

export async function notifyAssignment(
  pool: Pool, params: NotifyAssignmentParams,
): Promise<{ in_app: boolean; email: boolean; whatsapp: boolean }> {
  // Hent recipient + prefs
  const userR = await pool.query<{
    first_name: string | null; last_name: string | null;
    email: string | null; phone: string | null;
  }>(
    `SELECT first_name, last_name, email, phone FROM users WHERE id = $1`,
    [params.recipientUserId],
  );
  const user = userR.rows[0];
  if (!user) return { in_app: false, email: false, whatsapp: false };
  const recipientName = [user.first_name, user.last_name].filter(Boolean).join(" ") || "der";

  const prefs = await getUserPrefs(pool, params.recipientUserId);
  if (!eventEnabled(prefs, params.eventType)) {
    return { in_app: false, email: false, whatsapp: false };
  }

  const subject = subjectFor(params.eventType, params.customerName, params.customerTier);
  const body = bodyFor(params.eventType, params.customerName, params.note);
  const deepLink = params.deepLink ?? `${process.env.LEADGRID_PORTAL_BASE_URL ?? "https://theroleroom.com"}/admin-room?lead=${params.customerId}`;

  const result = { in_app: false, email: false, whatsapp: false };

  // 1. In-app — alltid lagre hvis aktivert
  if (prefs.notify_in_app) {
    try {
      await pool.query(
        `INSERT INTO notification_events
           (recipient_user_id, organization_id, event_type, title, body,
            lead_id, triggered_by_user_id, deep_link, meta, email_sent)
         VALUES ($1, $2, $3, $4, $5, $6::uuid, $7, $8, $9::jsonb, FALSE)`,
        [params.recipientUserId, params.organizationId, params.eventType,
         subject, body, params.customerId, params.triggeredByUserId, deepLink,
         JSON.stringify({ tier: params.customerTier, note: params.note })],
      );
      result.in_app = true;
    } catch (e) { console.warn("[lead-assign-notif] in_app feilet", e); }
  }

  // 2. E-post
  if (prefs.notify_email && user.email) {
    const html = buildEmailHtml({
      recipientName, subject, body,
      customerName: params.customerName, customerTier: params.customerTier,
      deepLink, brandColor: "#a78bfa",
    });
    result.email = await sendInternalEmail(user.email, subject, html);
    if (result.email) {
      try {
        await pool.query(
          `UPDATE notification_events SET email_sent = TRUE
            WHERE recipient_user_id = $1 AND event_type = $2
              AND lead_id = $3 AND created_at > now() - interval '30 seconds'`,
          [params.recipientUserId, params.eventType, params.customerId],
        );
      } catch { /* ignore */ }
    }
  }

  // 3. WhatsApp
  if (prefs.notify_whatsapp && user.phone) {
    result.whatsapp = await sendInternalWhatsApp(
      user.phone, recipientName.split(" ")[0],
      params.customerName, params.customerTier,
    );
  }

  return result;
}
