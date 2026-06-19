/**
 * client-notification-service.ts
 *
 * Multi-kanal varsels-service for Leadgrid klient-portal:
 *   - E-post via Resend (transactional-email-service)
 *   - WhatsApp via Meta Cloud API (eksisterende casting-whatsapp-sender-stack)
 *   - SMS: TODO (Twilio droppet — vurder Sinch eller behold WhatsApp-only)
 *
 * Bruker client_notification_prefs til å filtrere kanaler per event-type
 * og logger alt til client_notification_log (audit + dedup).
 *
 * Event-typer:
 *   deliverable_completed | focus_request_received |
 *   score_changed | new_finding | monthly_report
 *
 * Multi-tenant: henter WA-config fra role_room_org_whatsapp_config via
 * kundens organisasjon. Faller tilbake til env-config (The Role Room's
 * delte WABA) hvis org-en ikke har egen WA-bedrift.
 */

import type { Pool } from "pg";
import {
  readEnvFallbackConfig, normalizePhoneE164, type WhatsAppSenderConfig,
} from "./casting-whatsapp-sender.js";

const META_GRAPH_VERSION = "v22.0";
import {
  getLeadgridWaTemplate, type LeadgridWaTemplate,
} from "./leadgrid-whatsapp-templates.js";

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

/** Hent WhatsApp Cloud API-config for kunden:
 *  per-org først (role_room_org_whatsapp_config), så env-fallback. */
async function getWhatsAppConfigForCustomer(
  pool: Pool, customerId: string,
): Promise<WhatsAppSenderConfig | null> {
  try {
    const r = await pool.query<{
      access_token_encrypted: string | null;
      phone_number_id: string | null;
      display_name: string | null;
      template_language: string | null;
    }>(
      `SELECT w.access_token_encrypted, w.phone_number_id,
              w.display_name, w.template_language
         FROM role_room_org_whatsapp_config w
         JOIN casting_projects p ON p.organization_id::text = w.org_key
         JOIN crm_customers c ON c.project_id = p.id
        WHERE c.id::text = $1
        LIMIT 1`,
      [customerId],
    );
    if (r.rows[0]?.access_token_encrypted && r.rows[0]?.phone_number_id) {
      const row = r.rows[0];
      return {
        accessToken: row.access_token_encrypted!,
        phoneNumberId: row.phone_number_id!,
        displayName: row.display_name ?? "Leadgrid",
        templateLanguage: row.template_language ?? "nb",
        template24hName: "", // ikke brukt her
        template1hName: "",
      };
    }
  } catch (e) {
    console.warn("[client-notif] org-WA-config lookup feilet", e);
  }
  return readEnvFallbackConfig();
}

/** Send WhatsApp via Meta Cloud API + en av Leadgrid-templatene.
 *
 *  Inkluderer URL-button-parameteren (portal-token) som Meta krever
 *  for hver template som har dynamisk URL-button. */
async function sendWhatsApp(
  pool: Pool, customerId: string, to: string,
  event: LeadgridWaTemplate, params: string[],
  buttonParam: string,
  language: "nb" | "en" = "nb",
): Promise<{ ok: boolean; messageId?: string; templateName?: string; error?: string }> {
  const config = await getWhatsAppConfigForCustomer(pool, customerId);
  if (!config) return { ok: false, error: "WhatsApp Cloud API ikke konfigurert" };

  const normalized = normalizePhoneE164(to);
  if (!normalized) return { ok: false, error: "Ugyldig telefonnummer (forventet E.164)" };

  const tmpl = getLeadgridWaTemplate(event, language);
  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${config.phoneNumberId}/messages`;
  const body = {
    messaging_product: "whatsapp",
    to: normalized.replace(/^\+/, ""),
    type: "template",
    template: {
      name: tmpl.fullName,
      language: { code: tmpl.language },
      components: [
        { type: "body", parameters: params.map((text) => ({ type: "text", text })) },
        ...(tmpl.hasUrlButton ? [{
          type: "button", sub_type: "url", index: "0",
          parameters: [{ type: "text", text: buttonParam }],
        }] : []),
      ],
    },
  };

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const txt = await r.text();
      return { ok: false, templateName: tmpl.fullName,
                error: `HTTP ${r.status}: ${txt.slice(0, 200)}` };
    }
    const j: any = await r.json().catch(() => ({}));
    const messageId = j?.messages?.[0]?.id;
    return { ok: true, messageId, templateName: tmpl.fullName };
  } catch (e: any) {
    return { ok: false, templateName: tmpl.fullName,
              error: e?.message ?? String(e) };
  }
}

interface EmailBranding {
  from_name: string;
  from_email: string | null;
  reply_to_email: string | null;
  sender_full_name: string | null;
  sender_title: string | null;
  sender_phone: string | null;
  sender_email: string | null;
  brand_name: string;
  brand_logo_url: string | null;
  brand_primary_color: string;
  brand_accent_color: string;
  footer_html: string | null;
  footer_address: string | null;
  custom_variables: Record<string, string>;
}

/** Hent branding-config for kundens org, fall til global default. */
async function getEmailBranding(pool: Pool, customerId: string): Promise<EmailBranding> {
  const r = await pool.query<EmailBranding>(
    `SELECT eb.from_name, eb.from_email, eb.reply_to_email,
            eb.sender_full_name, eb.sender_title, eb.sender_phone, eb.sender_email,
            eb.brand_name, eb.brand_logo_url, eb.brand_primary_color,
            eb.brand_accent_color, eb.footer_html, eb.footer_address,
            eb.custom_variables
       FROM crm_customers c
       JOIN casting_projects p ON p.id = c.project_id
       LEFT JOIN leadgrid_email_branding_config eb
              ON eb.org_key = p.organization_id::text
      WHERE c.id::text = $1
      LIMIT 1`,
    [customerId],
  );
  if (r.rows[0]?.brand_name) return r.rows[0];

  // Global default
  const g = await pool.query<EmailBranding>(
    `SELECT from_name, from_email, reply_to_email,
            sender_full_name, sender_title, sender_phone, sender_email,
            brand_name, brand_logo_url, brand_primary_color,
            brand_accent_color, footer_html, footer_address, custom_variables
       FROM leadgrid_email_branding_config WHERE org_key IS NULL LIMIT 1`,
  );
  return g.rows[0] ?? {
    from_name: "Leadgrid", from_email: null, reply_to_email: null,
    sender_full_name: null, sender_title: null, sender_phone: null, sender_email: null,
    brand_name: "Leadgrid", brand_logo_url: null,
    brand_primary_color: "#a78bfa", brand_accent_color: "#9be15d",
    footer_html: null, footer_address: null,
    custom_variables: {},
  };
}

async function sendEmail(
  to: string, subject: string, html: string,
  branding: EmailBranding,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const { sendTransactionalEmail } = await import("./transactional-email-service.js");
    const r = await sendTransactionalEmail({
      to, subject, html,
      text: html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
      fromLabel: branding.from_name,
      fromAddress: branding.from_email,
      replyTo: branding.reply_to_email,
      kind: "leadgrid_client_notification",
    });
    if (r.sent) return { ok: true, id: r.messageId ?? undefined };
    return { ok: false, error: r.errorMessage ?? r.reason ?? "Ukjent feil" };
  } catch (e: any) {
    return { ok: false, error: e.message ?? String(e) };
  }
}

function htmlBody(data: NotificationData, body: string, brand: EmailBranding): string {
  const portal = data.portalToken
    ? `${PORTAL_BASE}/c/${data.portalToken}` : null;

  const logoBlock = brand.brand_logo_url
    ? `<img src="${brand.brand_logo_url}" alt="${brand.brand_name}"
            style="max-height:48px; margin-bottom:16px;" />`
    : `<div style="font-weight:700; font-size:18px; color:${brand.brand_primary_color};
                    margin-bottom:16px;">${brand.brand_name}</div>`;

  const signature = brand.sender_full_name ? `
    <div style="margin-top:24px; padding-top:16px;
                border-top:1px solid #eee; color:#444; font-size:13px;">
      Mvh,<br/>
      <strong>${brand.sender_full_name}</strong>
      ${brand.sender_title ? `<br/>${brand.sender_title}` : ""}
      ${brand.sender_email ? `<br/><a href="mailto:${brand.sender_email}"
                                    style="color:${brand.brand_primary_color};">${brand.sender_email}</a>` : ""}
      ${brand.sender_phone ? `<br/>${brand.sender_phone}` : ""}
      <br/><strong style="color:${brand.brand_primary_color};">${brand.brand_name}</strong>
    </div>` : "";

  const customFooter = brand.footer_html ?? "";
  const address = brand.footer_address
    ? `<div style="margin-top:8px;">${brand.footer_address}</div>` : "";

  return `
<div style="font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
            max-width:560px; margin:0 auto; padding:24px; background:#fff;">
  ${logoBlock}
  <h2 style="color:#0a0512; margin-bottom:12px; font-size:20px;">
    ${SUBJECT_PER_EVENT[data.event](data)}
  </h2>
  <p style="color:#333; line-height:1.55; font-size:15px;">${body}</p>
  ${portal ? `
  <div style="margin:24px 0;">
    <a href="${portal}" style="display:inline-block; background:${brand.brand_primary_color};
        color:#0a0512; padding:12px 24px; border-radius:8px;
        text-decoration:none; font-weight:700;">
      Åpne klient-portalen
    </a>
  </div>` : ""}
  ${signature}
  <div style="margin-top:32px; padding-top:16px; border-top:1px solid #eee;
              color:#888; font-size:11px; line-height:1.5;">
    ${customFooter}
    ${address}
    ${portal ? `<div style="margin-top:8px;">
      <a href="${portal}/notifications" style="color:#888;">Endre varsels-innstillingene</a>
    </div>` : ""}
  </div>
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

  // 2. E-post (m/ org-branding)
  if (prefs.notify_email && prefs.contact_email) {
    attempted++;
    const branding = await getEmailBranding(pool, data.customerId);
    const res = await sendEmail(prefs.contact_email, subject,
                                  htmlBody(data, body, branding), branding);
    if (res.ok) { sent++; channels.push("email"); }
    await logSend(pool, data.customerId, "email", data.event,
                   prefs.contact_email, subject, body,
                   res.ok ? "sent" : "failed", res.id, res.error);
  }

  // 3. WhatsApp via Meta Cloud API
  if (prefs.notify_whatsapp && prefs.contact_phone) {
    attempted++;
    const senderName = data.customerName ?? "Leadgrid";
    const params = buildWaParamsForEvent(data, prefs, senderName);
    const waEvent: LeadgridWaTemplate = `leadgrid_${data.event}` as LeadgridWaTemplate;
    const buttonParam = data.portalToken ?? "portal";
    const res = await sendWhatsApp(
      pool, data.customerId, prefs.contact_phone, waEvent, params, buttonParam,
    );
    if (res.ok) { sent++; channels.push("whatsapp"); }
    await logSend(pool, data.customerId, "whatsapp", data.event,
                   prefs.contact_phone, subject,
                   `template=${res.templateName} params=${JSON.stringify(params)}`,
                   res.ok ? "sent" : "failed", res.messageId, res.error);
  }

  // SMS-kanal er midlertidig deaktivert (Twilio droppet).
  // Beholdt schema-feltet `notify_sms` for fremtidig Sinch-integrasjon.

  return { attempted, sent, channels };
}

/** Bygg WA-template-body-parametere per event-type.
 *  Rekkefølgen MÅ matche bodyTemplate-stringen ({{1}}, {{2}}, ...). */
function buildWaParamsForEvent(
  data: NotificationData, prefs: Prefs, senderName: string,
): string[] {
  const customerName = prefs.contact_name ?? data.customerName ?? "der";
  switch (data.event) {
    case "deliverable_completed":
      return [customerName, data.deliverableTitle ?? "Ny leveranse", senderName];
    case "focus_request_received":
      return [customerName, data.focusArea ?? "valgt område", senderName];
    case "score_changed": {
      const delta = (data.scoreNew ?? 0) - (data.scoreOld ?? 0);
      const explain = delta > 0
        ? `Det er en økning på ${delta} poeng — godt jobbet!`
        : delta < 0
          ? `Det er en nedgang på ${Math.abs(delta)} poeng. Vi følger opp.`
          : "Det er en endring vi vil at du skal være klar over.";
      return [customerName, String(data.scoreOld ?? "-"),
               String(data.scoreNew ?? "-"), explain];
    }
    case "new_finding":
      return [customerName, data.findingTitle ?? "Nytt funn",
               "Vi har lagt en anbefaling i portalen din."];
    case "monthly_report":
      return [customerName, data.monthLabel ?? "denne perioden",
               "Se hele rapporten i portalen."];
  }
}
