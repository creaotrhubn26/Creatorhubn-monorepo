/**
 * client-notification-service.ts
 *
 * Multi-kanal varsels-service for Leadgrid klient-portal:
 *   - E-post via Resend (transactional-email-service)
 *   - SMS via Twilio
 *   - WhatsApp via Twilio (Business)
 *
 * Bruker client_notification_prefs til å filtrere kanaler per event-type
 * og logger alt til client_notification_log (audit + dedup).
 *
 * Event-typer:
 *   deliverable_completed | focus_request_received |
 *   score_changed | new_finding | monthly_report
 */

import type { Pool } from "pg";

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID ?? "";
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN ?? "";
const TWILIO_SMS_FROM = process.env.TWILIO_SMS_FROM ?? "";
const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM
  ?? "whatsapp:+14155238886"; // sandbox-default
const PORTAL_BASE = process.env.LEADGRID_PORTAL_BASE_URL
  ?? "https://leadgrid.theroleroom.com";

export type NotificationEvent =
  | "deliverable_completed"
  | "focus_request_received"
  | "score_changed"
  | "new_finding"
  | "monthly_report";

export interface NotificationData {
  customerId: string;
  event: NotificationEvent;
  customerName?: string;
  portalToken?: string;
  // Free-form data per event-type
  deliverableTitle?: string;
  focusArea?: string;
  scoreOld?: number;
  scoreNew?: number;
  findingTitle?: string;
  monthLabel?: string;
}

interface Prefs {
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  notify_email: boolean;
  notify_sms: boolean;
  notify_whatsapp: boolean;
  notify_deliverable_completed: boolean;
  notify_focus_request_received: boolean;
  notify_score_changed: boolean;
  notify_new_finding: boolean;
  notify_monthly_report: boolean;
  unsubscribed_at: string | null;
}

const SUBJECT_PER_EVENT: Record<NotificationEvent, (d: NotificationData) => string> = {
  deliverable_completed: (d) => `✓ Levert: ${d.deliverableTitle ?? "Ny leveranse"}`,
  focus_request_received: (d) => `Vi har mottatt fokus-ønsket ditt`,
  score_changed: (d) => {
    const delta = (d.scoreNew ?? 0) - (d.scoreOld ?? 0);
    return delta > 0
      ? `Markeds-scoren din økte til ${d.scoreNew} (+${delta})`
      : `Markeds-scoren din endret seg`;
  },
  new_finding: (d) => `Nytt funn: ${d.findingTitle ?? "Vi har noe nytt"}`,
  monthly_report: (d) => `Månedsrapporten din for ${d.monthLabel ?? "perioden"} er klar`,
};

const BODY_PER_EVENT: Record<NotificationEvent, (d: NotificationData) => string> = {
  deliverable_completed: (d) =>
    `Leveransen "${d.deliverableTitle ?? "din"}" er klar. Logg inn for å se den.`,
  focus_request_received: (d) =>
    `Vi har mottatt fokus-ønsket "${d.focusArea ?? ""}" og setter i gang.`,
  score_changed: (d) =>
    `Markeds-scoren din gikk fra ${d.scoreOld} til ${d.scoreNew}.`,
  new_finding: (d) =>
    `Vi fant noe nytt i markeds-analysen din: ${d.findingTitle ?? ""}.`,
  monthly_report: (d) =>
    `Månedsrapporten din for ${d.monthLabel ?? ""} er klar.`,
};

function eventEnabled(prefs: Prefs, event: NotificationEvent): boolean {
  switch (event) {
    case "deliverable_completed": return prefs.notify_deliverable_completed;
    case "focus_request_received": return prefs.notify_focus_request_received;
    case "score_changed": return prefs.notify_score_changed;
    case "new_finding": return prefs.notify_new_finding;
    case "monthly_report": return prefs.notify_monthly_report;
  }
}

async function logSend(
  pool: Pool, customerId: string, channel: string,
  event: string, recipient: string, subject: string,
  bodyPreview: string, status: string, externalId?: string, error?: string,
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO client_notification_log
        (customer_id, channel, event_type, recipient, subject,
         body_preview, delivery_status, external_message_id, error_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [customerId, channel, event, recipient, subject.slice(0, 300),
       bodyPreview.slice(0, 1000), status, externalId ?? null, error ?? null],
    );
  } catch (e) {
    console.error("[client-notif] log-insert failed", e);
  }
}

async function sendTwilio(
  channel: "sms" | "whatsapp", to: string, body: string,
): Promise<{ ok: boolean; sid?: string; error?: string }> {
  if (!TWILIO_SID || !TWILIO_TOKEN) {
    return { ok: false, error: "Twilio ikke konfigurert" };
  }
  const from = channel === "whatsapp" ? TWILIO_WHATSAPP_FROM : TWILIO_SMS_FROM;
  if (!from) return { ok: false, error: `Twilio ${channel} from-nummer mangler` };
  const toFormatted = channel === "whatsapp" && !to.startsWith("whatsapp:")
    ? `whatsapp:${to}` : to;

  try {
    const auth = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString("base64");
    const form = new URLSearchParams();
    form.set("From", from);
    form.set("To", toFormatted);
    form.set("Body", body);
    const r = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Authorization": `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      },
    );
    const data: any = await r.json();
    if (r.ok && data.sid) return { ok: true, sid: data.sid };
    return { ok: false, error: data.message ?? `HTTP ${r.status}` };
  } catch (e: any) {
    return { ok: false, error: e.message ?? String(e) };
  }
}

async function sendEmail(
  to: string, subject: string, html: string,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    // Dynamisk import for å unngå sirkulær import
    const { sendTransactionalEmail } = await import("./transactional-email-service.js");
    const r = await sendTransactionalEmail({
      to, subject, html,
      text: html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
      fromLabel: "Leadgrid",
      kind: "leadgrid_client_notification",
    });
    if (r.sent) return { ok: true, id: r.messageId ?? undefined };
    return { ok: false, error: r.errorMessage ?? r.reason ?? "Ukjent feil" };
  } catch (e: any) {
    return { ok: false, error: e.message ?? String(e) };
  }
}

function htmlBody(data: NotificationData, body: string): string {
  const portal = data.portalToken
    ? `${PORTAL_BASE}/portal/${data.portalToken}` : null;
  return `
<div style="font-family: -apple-system,BlinkMacSystemFont,sans-serif; max-width:560px; margin:0 auto; padding:24px;">
  <h2 style="color:#0a0512; margin-bottom:12px;">${SUBJECT_PER_EVENT[data.event](data)}</h2>
  <p style="color:#444; line-height:1.55;">${body}</p>
  ${portal ? `
  <div style="margin:24px 0;">
    <a href="${portal}" style="display:inline-block; background:#a78bfa; color:#0a0512;
        padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:700;">
      Åpne klient-portalen
    </a>
  </div>` : ""}
  <p style="color:#888; font-size:12px; margin-top:32px;">
    Dette er en automatisk melding fra Leadgrid.
    ${portal ? `<br/><a href="${portal}/notifications" style="color:#888;">Endre varsels-innstillingene</a>` : ""}
  </p>
</div>`.trim();
}

/**
 * Hovedinngangspunkt: send varsel om et event til alle kanaler kunden har valgt.
 *
 * Returnerer antall kanaler vi forsøkte å sende på, og hvor mange som lyktes.
 */
export async function notifyClient(
  pool: Pool, data: NotificationData,
): Promise<{ attempted: number; sent: number; channels: string[] }> {
  // 1. Hent prefs
  const r = await pool.query<Prefs>(
    `SELECT contact_name, contact_email, contact_phone,
            notify_email, notify_sms, notify_whatsapp,
            notify_deliverable_completed, notify_focus_request_received,
            notify_score_changed, notify_new_finding, notify_monthly_report,
            unsubscribed_at::text
       FROM client_notification_prefs
      WHERE customer_id = $1`,
    [data.customerId],
  );
  if (r.rows.length === 0) {
    // Fallback: bruk kundens primær-e-post fra crm_customers
    const cr = await pool.query<{ email: string | null; name: string }>(
      `SELECT email, name FROM crm_customers WHERE id = $1`,
      [data.customerId],
    );
    if (!cr.rows[0]?.email) return { attempted: 0, sent: 0, channels: [] };
    // Auto-init prefs med default-værdier (email på)
    await pool.query(
      `INSERT INTO client_notification_prefs (customer_id, contact_name, contact_email)
       VALUES ($1, $2, $3) ON CONFLICT (customer_id) DO NOTHING`,
      [data.customerId, cr.rows[0].name, cr.rows[0].email],
    );
    r.rows.push({
      contact_name: cr.rows[0].name,
      contact_email: cr.rows[0].email,
      contact_phone: null,
      notify_email: true, notify_sms: false, notify_whatsapp: false,
      notify_deliverable_completed: true, notify_focus_request_received: true,
      notify_score_changed: false, notify_new_finding: true,
      notify_monthly_report: true,
      unsubscribed_at: null,
    });
  }
  const prefs = r.rows[0];
  if (prefs.unsubscribed_at) return { attempted: 0, sent: 0, channels: [] };
  if (!eventEnabled(prefs, data.event)) return { attempted: 0, sent: 0, channels: [] };

  const subject = SUBJECT_PER_EVENT[data.event](data);
  const body = BODY_PER_EVENT[data.event](data);
  const channels: string[] = [];
  let attempted = 0;
  let sent = 0;

  // 2. E-post
  if (prefs.notify_email && prefs.contact_email) {
    attempted++;
    const res = await sendEmail(prefs.contact_email, subject, htmlBody(data, body));
    if (res.ok) { sent++; channels.push("email"); }
    await logSend(pool, data.customerId, "email", data.event,
                   prefs.contact_email, subject, body,
                   res.ok ? "sent" : "failed", res.id, res.error);
  }

  // 3. SMS
  if (prefs.notify_sms && prefs.contact_phone) {
    attempted++;
    const smsBody = `${subject} – ${body}`.slice(0, 320);
    const res = await sendTwilio("sms", prefs.contact_phone, smsBody);
    if (res.ok) { sent++; channels.push("sms"); }
    await logSend(pool, data.customerId, "sms", data.event,
                   prefs.contact_phone, subject, smsBody,
                   res.ok ? "sent" : "failed", res.sid, res.error);
  }

  // 4. WhatsApp
  if (prefs.notify_whatsapp && prefs.contact_phone) {
    attempted++;
    const waBody = `*${subject}*\n\n${body}`;
    const res = await sendTwilio("whatsapp", prefs.contact_phone, waBody);
    if (res.ok) { sent++; channels.push("whatsapp"); }
    await logSend(pool, data.customerId, "whatsapp", data.event,
                   prefs.contact_phone, subject, waBody,
                   res.ok ? "sent" : "failed", res.sid, res.error);
  }

  return { attempted, sent, channels };
}
