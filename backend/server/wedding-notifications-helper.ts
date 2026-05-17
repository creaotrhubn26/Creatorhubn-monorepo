/**
 * wedding-notifications-helper.ts
 *
 * Felles helpers for bryllup-relaterte varsler (Slice 9X.38+).
 *
 * Initialt:
 *   - notifyPlanBActivation(weddingId, altId, primaryId, triggeredBy)
 *   - notifyPlanBDeactivation(weddingId, altId, primaryId, triggeredBy)
 *
 * Mottakere:
 *   - Fotograf (Stine) — fra wedding_timelines.photographer_id → users
 *   - Brudepar — fra wedding_timelines.couple_email + couple_phone hvis lagret;
 *     ellers en e-post Stine har registrert som invite-mottaker
 *   - VIP-kontakter med is_must_capture=true OG telefon — SMS
 *
 * Gjenbruker sendEmail + sendSms fra casting-reminder-sender.ts.
 */

import { sendEmail, sendSms } from "./casting-reminder-sender";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Recipient {
  type: "photographer" | "couple" | "vip_contact" | "assistant";
  name: string | null;
  email: string | null;
  phone: string | null;
}

async function ensureSchema(pool: any): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS wedding_notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      wedding_id VARCHAR(64) NOT NULL,
      notification_type TEXT NOT NULL,
      recipient_type TEXT NOT NULL,
      recipient_name TEXT,
      recipient_email TEXT,
      recipient_phone TEXT,
      channel TEXT NOT NULL,
      subject TEXT,
      body TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      provider TEXT,
      provider_message_id TEXT,
      error_message TEXT,
      related_entity_type TEXT,
      related_entity_id TEXT,
      triggered_by TEXT,
      sent_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(() => undefined);
}

async function logAndSend(
  pool: any,
  args: {
    weddingId: string;
    notificationType: string;
    recipient: Recipient;
    channel: "email" | "sms";
    subject: string;
    body: string;
    relatedEntityType?: string;
    relatedEntityId?: string;
    triggeredBy?: string;
  },
): Promise<void> {
  await ensureSchema(pool);
  const {
    weddingId,
    notificationType,
    recipient,
    channel,
    subject,
    body,
    relatedEntityType,
    relatedEntityId,
    triggeredBy,
  } = args;

  // Sjekk om vi har relevant kanal
  if (channel === "email" && !recipient.email) {
    await pool.query(
      `INSERT INTO wedding_notifications
         (wedding_id, notification_type, recipient_type, recipient_name,
          channel, subject, body, status, related_entity_type, related_entity_id, triggered_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'skipped',$8,$9,$10)`,
      [weddingId, notificationType, recipient.type, recipient.name, channel, subject, body, relatedEntityType, relatedEntityId, triggeredBy],
    );
    return;
  }
  if (channel === "sms" && !recipient.phone) {
    await pool.query(
      `INSERT INTO wedding_notifications
         (wedding_id, notification_type, recipient_type, recipient_name,
          channel, subject, body, status, related_entity_type, related_entity_id, triggered_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'skipped',$8,$9,$10)`,
      [weddingId, notificationType, recipient.type, recipient.name, channel, subject, body, relatedEntityType, relatedEntityId, triggeredBy],
    );
    return;
  }

  let status: "sent" | "failed" = "sent";
  let provider: string | null = null;
  let providerMessageId: string | null = null;
  let errorMessage: string | null = null;

  try {
    if (channel === "email" && recipient.email) {
      const result = await sendEmail({
        to: recipient.email,
        subject,
        html: `<div style="font-family: -apple-system, sans-serif; max-width: 600px;">${body.replace(/\n/g, "<br>")}</div>`,
        text: body,
        fromName: "Creatorhubn Bryllup",
      });
      provider = result.provider;
      if (result.success) {
        providerMessageId = result.messageId || null;
      } else {
        status = "failed";
        errorMessage = result.error || null;
      }
    } else if (channel === "sms" && recipient.phone) {
      const result = await sendSms({
        brand: "creatorhub" as any,
        to: recipient.phone,
        body,
      });
      provider = result.provider;
      if (result.success) {
        providerMessageId = (result as any).messageSid || null;
      } else {
        status = "failed";
        errorMessage = result.error || null;
      }
    }
  } catch (err) {
    status = "failed";
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  await pool.query(
    `INSERT INTO wedding_notifications
       (wedding_id, notification_type, recipient_type, recipient_name,
        recipient_email, recipient_phone, channel, subject, body, status,
        provider, provider_message_id, error_message,
        related_entity_type, related_entity_id, triggered_by,
        sent_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
             CASE WHEN $10 = 'sent' THEN NOW() ELSE NULL END)`,
    [
      weddingId,
      notificationType,
      recipient.type,
      recipient.name,
      recipient.email,
      recipient.phone,
      channel,
      subject,
      body,
      status,
      provider,
      providerMessageId,
      errorMessage,
      relatedEntityType,
      relatedEntityId,
      triggeredBy,
    ],
  );
}

async function gatherRecipients(
  pool: any,
  weddingId: string,
): Promise<Recipient[]> {
  const recipients: Recipient[] = [];

  // 1. Fotograf
  const wt = await pool.query(
    `SELECT photographer_id, couple_name FROM wedding_timelines WHERE id = $1 LIMIT 1`,
    [weddingId],
  );
  const photographerId = wt.rows[0]?.photographer_id;
  if (photographerId) {
    const ph = await pool.query(
      `SELECT email, first_name, last_name, phone_number FROM users WHERE id = $1 LIMIT 1`,
      [photographerId],
    );
    if (ph.rowCount > 0) {
      const u = ph.rows[0];
      recipients.push({
        type: "photographer",
        name: [u.first_name, u.last_name].filter(Boolean).join(" ") || null,
        email: u.email || null,
        phone: u.phone_number || null,
      });
    }
  }

  // 2. Brudepar — sjekk om wedding_timelines har couple-felter, ellers
  //    fall tilbake til wedding_contacts der relation='bride' eller 'groom'
  try {
    const cp = await pool.query(
      `SELECT couple_email, couple_phone FROM wedding_timelines WHERE id = $1 LIMIT 1`,
      [weddingId],
    );
    const ce = cp.rows[0]?.couple_email;
    const cph = cp.rows[0]?.couple_phone;
    if (ce || cph) {
      recipients.push({
        type: "couple",
        name: wt.rows[0]?.couple_name || "Brudepar",
        email: ce || null,
        phone: cph || null,
      });
    }
  } catch {
    // couple_email/phone-kolonnene finnes kanskje ikke — fallback under
  }

  // Hvis ingen direkte couple-felter, prøv wedding_contacts
  if (!recipients.find((r) => r.type === "couple")) {
    const cc = await pool.query(
      `SELECT full_name, email, phone, relation FROM wedding_contacts
         WHERE wedding_id = $1 AND LOWER(relation) IN ('brud','brudgom','bride','groom','partner')`,
      [weddingId],
    );
    for (const c of cc.rows) {
      recipients.push({
        type: "couple",
        name: c.full_name,
        email: c.email || null,
        phone: c.phone || null,
      });
    }
  }

  // 3. Must-capture VIPs med telefon
  const vips = await pool.query(
    `SELECT full_name, email, phone FROM wedding_contacts
       WHERE wedding_id = $1 AND is_must_capture = TRUE
         AND ((phone IS NOT NULL AND phone <> '') OR (email IS NOT NULL AND email <> ''))`,
    [weddingId],
  );
  for (const v of vips.rows) {
    recipients.push({
      type: "vip_contact",
      name: v.full_name,
      email: v.email || null,
      phone: v.phone || null,
    });
  }

  return recipients;
}

export async function notifyPlanBActivation(
  pool: any,
  args: {
    weddingId: string;
    altId: string;
    primaryId: string;
    triggeredBy: "photographer" | "couple";
  },
): Promise<{ totalSent: number; totalSkipped: number; totalFailed: number }> {
  await ensureSchema(pool);

  // Hent lokasjons-detaljer
  const locs = await pool.query(
    `SELECT id, label, address, city FROM wedding_locations WHERE id = ANY($1)`,
    [[args.altId, args.primaryId]],
  );
  const alt = locs.rows.find((r: any) => r.id === args.altId);
  const primary = locs.rows.find((r: any) => r.id === args.primaryId);
  if (!alt || !primary) return { totalSent: 0, totalSkipped: 0, totalFailed: 0 };

  const altDisplay = [alt.label, alt.address, alt.city].filter(Boolean).join(", ");
  const primaryDisplay = [primary.label, primary.address, primary.city].filter(Boolean).join(", ");
  const mapsUrl = alt.address
    ? `https://www.google.com/maps/search/${encodeURIComponent([alt.address, alt.city].filter(Boolean).join(", "))}`
    : null;

  const triggerLabel = args.triggeredBy === "couple" ? "Brudeparet" : "Fotografen";
  const subject = `🌧️ Plan B aktivert: ${alt.label}`;
  const bodyShort =
    `${triggerLabel} har aktivert plan B for bryllupet.\n\n` +
    `Ny lokasjon: ${altDisplay}\n` +
    `Erstatter: ${primaryDisplay}\n\n` +
    (mapsUrl ? `Kart: ${mapsUrl}\n\n` : "") +
    `Alle timeline-events er flyttet automatisk.`;
  const bodySms =
    `Plan B aktivert (${args.triggeredBy === "couple" ? "brudeparet" : "fotograf"}). ` +
    `Ny lokasjon: ${altDisplay}.` +
    (mapsUrl ? ` ${mapsUrl}` : "");

  const recipients = await gatherRecipients(pool, args.weddingId);

  let sent = 0, skipped = 0, failed = 0;
  for (const recipient of recipients) {
    // Ikke varsle den som trigget aktiveringen selv
    if (args.triggeredBy === "photographer" && recipient.type === "photographer") continue;
    if (args.triggeredBy === "couple" && recipient.type === "couple") continue;

    // E-post for alle som har det
    if (recipient.email) {
      const before = await pool.query(
        `SELECT COUNT(*)::int AS n FROM wedding_notifications WHERE wedding_id=$1`,
        [args.weddingId],
      );
      await logAndSend(pool, {
        weddingId: args.weddingId,
        notificationType: "plan_b_activated",
        recipient,
        channel: "email",
        subject,
        body: bodyShort,
        relatedEntityType: "location_alternative",
        relatedEntityId: args.altId,
        triggeredBy: args.triggeredBy,
      });
      const after = await pool.query(
        `SELECT status FROM wedding_notifications WHERE wedding_id=$1 ORDER BY created_at DESC LIMIT 1`,
        [args.weddingId],
      );
      const lastStatus = after.rows[0]?.status;
      if (lastStatus === "sent") sent++;
      else if (lastStatus === "failed") failed++;
      else skipped++;
    }

    // SMS for fotograf + VIPs (ikke spam brudepar med både e-post og SMS for samme event)
    if (recipient.phone && (recipient.type === "photographer" || recipient.type === "vip_contact")) {
      await logAndSend(pool, {
        weddingId: args.weddingId,
        notificationType: "plan_b_activated",
        recipient,
        channel: "sms",
        subject,
        body: bodySms,
        relatedEntityType: "location_alternative",
        relatedEntityId: args.altId,
        triggeredBy: args.triggeredBy,
      });
      const after = await pool.query(
        `SELECT status FROM wedding_notifications WHERE wedding_id=$1 ORDER BY created_at DESC LIMIT 1`,
        [args.weddingId],
      );
      const lastStatus = after.rows[0]?.status;
      if (lastStatus === "sent") sent++;
      else if (lastStatus === "failed") failed++;
      else skipped++;
    }
  }

  return { totalSent: sent, totalSkipped: skipped, totalFailed: failed };
}

export async function notifyPlanBDeactivation(
  pool: any,
  args: {
    weddingId: string;
    altId: string;
    primaryId: string;
    triggeredBy: "photographer" | "couple";
  },
): Promise<void> {
  await ensureSchema(pool);
  const locs = await pool.query(
    `SELECT id, label FROM wedding_locations WHERE id = ANY($1)`,
    [[args.altId, args.primaryId]],
  );
  const alt = locs.rows.find((r: any) => r.id === args.altId);
  const primary = locs.rows.find((r: any) => r.id === args.primaryId);
  if (!alt || !primary) return;

  const subject = `✅ Plan B avbrutt — tilbake til ${primary.label}`;
  const body =
    `${args.triggeredBy === "couple" ? "Brudeparet" : "Fotografen"} har deaktivert plan B.\n\n` +
    `Vi er tilbake til opprinnelig lokasjon: ${primary.label}.\n\n` +
    `Alle timeline-events er flyttet tilbake.`;

  const recipients = await gatherRecipients(pool, args.weddingId);
  for (const recipient of recipients) {
    if (args.triggeredBy === "photographer" && recipient.type === "photographer") continue;
    if (args.triggeredBy === "couple" && recipient.type === "couple") continue;
    if (recipient.email) {
      await logAndSend(pool, {
        weddingId: args.weddingId,
        notificationType: "plan_b_deactivated",
        recipient,
        channel: "email",
        subject,
        body,
        relatedEntityType: "location_alternative",
        relatedEntityId: args.altId,
        triggeredBy: args.triggeredBy,
      });
    }
  }
}
