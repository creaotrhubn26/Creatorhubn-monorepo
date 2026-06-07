/**
 * linkedin-conversions-service.ts
 *
 * LinkedIn Conversions API — sender konverterings-events fra vår backend
 * til LinkedIn for å optimalisere ad-bidding og spore offline-conversion.
 *
 * Når godkjent på LinkedIn: vi henter access_token fra linkedin_org_config
 * (Showcase Page er default) og POST-er events til
 * https://api.linkedin.com/rest/conversionEvents.
 *
 * Inntil godkjent: vi logger events i linkedin_conversion_events med
 * send_status='pending'. Cron-jobben drainer køen så snart godkjenningen
 * faller på plass.
 */

import crypto from "crypto";
import type { Pool } from "pg";

import { resolveDefaultLinkedInOrg } from "./linkedin-oauth-routes.js";

export type ConversionEventType =
  | "PAGE_VIEW" | "LEAD" | "SIGN_UP" | "PURCHASE"
  | "ADD_PAYMENT_INFO" | "SUBSCRIBE" | "BOOK_APPOINTMENT" | "CONTACT" | "OTHER";

export interface ConversionEventInput {
  eventType: ConversionEventType;
  eventName?: string;                    // vår interne label
  conversionUrn?: string;                // valgfri LinkedIn conversion-URN

  // Match-data (raw — vi hasher før send)
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  countryCode?: string;                  // ISO-3166 (f.eks. "NO")
  linkedinClickId?: string;              // li_fat_id fra URL-param

  // Verdi
  valueCurrency?: string;
  valueAmount?: number;

  // Source-tracking
  sourceKind?: "agency_lead" | "stripe_subscription" | "manual" | "webinar" | "form";
  sourceAgencyLeadId?: string;
  sourceMetadata?: Record<string, unknown>;

  // Tid
  occurredAt?: Date;
}

/** SHA-256-hash lowercase-trimmet streng (LinkedIn-krav for PII). */
function hashPii(value: string | undefined | null): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

/**
 * Logg en conversion event i køen. Sender ikke umiddelbart — cron-jobben
 * (sendDueConversionEvents) drainer køen i bulk og håndterer retries.
 *
 * Returnerer event-ID slik at caller kan logge sammenhengen.
 */
export async function queueConversionEvent(
  pool: Pool,
  input: ConversionEventInput,
): Promise<string> {
  const eventId = crypto.randomUUID();
  const occurredAt = input.occurredAt ?? new Date();

  await pool.query(
    `INSERT INTO linkedin_conversion_events (
       event_type, event_name, conversion_urn,
       user_email_hash, user_phone_hash,
       user_first_name_hash, user_last_name_hash,
       user_country_code, linkedin_click_id,
       conversion_value_currency, conversion_value_amount,
       event_id, occurred_at,
       source_agency_lead_id, source_kind, source_metadata,
       send_status
     ) VALUES (
       $1, $2, $3,
       $4, $5,
       $6, $7,
       $8, $9,
       $10, $11,
       $12, $13::timestamptz,
       $14, $15, $16::jsonb,
       'pending'
     ) ON CONFLICT (event_id) DO NOTHING`,
    [
      input.eventType,
      input.eventName ?? null,
      input.conversionUrn ?? null,
      hashPii(input.email),
      hashPii(input.phone),
      hashPii(input.firstName),
      hashPii(input.lastName),
      input.countryCode?.slice(0, 2).toUpperCase() ?? null,
      input.linkedinClickId ?? null,
      input.valueCurrency ?? null,
      input.valueAmount ?? null,
      eventId,
      occurredAt.toISOString(),
      input.sourceAgencyLeadId ?? null,
      input.sourceKind ?? null,
      JSON.stringify(input.sourceMetadata ?? {}),
    ],
  );

  return eventId;
}

/**
 * Drainer pending-køen. Henter LinkedIn-token fra linkedin_org_config,
 * og POST-er events til /rest/conversionEvents i batch (LinkedIn tillater
 * inntil 50 per kall).
 *
 * Tåler at LinkedIn-godkjenning ikke er på plass — events forblir
 * 'pending' med last_send_error satt så vi kan inspisere.
 */
export async function sendDueConversionEvents(pool: Pool): Promise<{
  attempted: number;
  sent: number;
  skipped: number;
  failed: number;
}> {
  const due = await pool.query(
    `SELECT id::text, event_type, event_name, conversion_urn,
            user_email_hash, user_phone_hash,
            user_first_name_hash, user_last_name_hash,
            user_country_code, linkedin_click_id,
            conversion_value_currency, conversion_value_amount,
            event_id, occurred_at,
            send_attempts
       FROM linkedin_conversion_events
      WHERE send_status IN ('pending','retrying')
        AND send_attempts < 5
      ORDER BY created_at
      LIMIT 50`,
  );

  if (!due.rowCount) {
    return { attempted: 0, sent: 0, skipped: 0, failed: 0 };
  }

  const resolved = await resolveDefaultLinkedInOrg(pool);
  if (!resolved) {
    // LinkedIn er ikke koblet ennå — bare bump attempts uten å feile køen
    return {
      attempted: due.rowCount,
      sent: 0,
      skipped: due.rowCount,
      failed: 0,
    };
  }

  let sent = 0;
  let failed = 0;

  for (const ev of due.rows) {
    try {
      const occurredMs = new Date(ev.occurred_at).getTime();

      const userIds: Array<Record<string, string>> = [];
      if (ev.user_email_hash) userIds.push({ idType: "SHA256_EMAIL", idValue: ev.user_email_hash });
      if (ev.user_phone_hash) userIds.push({ idType: "SHA256_PHONE", idValue: ev.user_phone_hash });
      if (ev.linkedin_click_id) userIds.push({ idType: "LINKEDIN_FIRST_PARTY_ADS_TRACKING_UUID", idValue: ev.linkedin_click_id });

      const userInfo: Record<string, string> = {};
      if (ev.user_first_name_hash) userInfo.firstName = ev.user_first_name_hash;
      if (ev.user_last_name_hash) userInfo.lastName = ev.user_last_name_hash;
      if (ev.user_country_code) userInfo.countryCode = ev.user_country_code;

      const payload: Record<string, unknown> = {
        conversion: ev.conversion_urn ?? undefined,
        conversionEventType: ev.event_type,
        conversionHappenedAt: occurredMs,
        user: {
          userIds,
          ...(Object.keys(userInfo).length ? { userInfo } : {}),
        },
      };
      if (ev.conversion_value_amount != null && ev.conversion_value_currency) {
        payload.conversionValue = {
          currencyCode: ev.conversion_value_currency,
          amount: String(ev.conversion_value_amount),
        };
      }

      const resp = await fetch("https://api.linkedin.com/rest/conversionEvents", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resolved.accessToken}`,
          "Content-Type": "application/json",
          "X-Restli-Protocol-Version": "2.0.0",
          "LinkedIn-Version": "202410",
        },
        body: JSON.stringify(payload),
      });

      if (resp.ok) {
        const data = await resp.json().catch(() => ({})) as { id?: string };
        await pool.query(
          `UPDATE linkedin_conversion_events
              SET send_status = 'sent',
                  sent_at = now(),
                  last_send_at = now(),
                  send_attempts = send_attempts + 1,
                  linkedin_response_id = $1,
                  last_send_error = NULL
            WHERE id = $2::uuid`,
          [data.id ?? null, ev.id],
        );
        sent++;
      } else {
        const errText = await resp.text().catch(() => "");
        const isRetryable = resp.status >= 500 || resp.status === 429;
        await pool.query(
          `UPDATE linkedin_conversion_events
              SET send_status = $1,
                  send_attempts = send_attempts + 1,
                  last_send_at = now(),
                  last_send_error = $2
            WHERE id = $3::uuid`,
          [
            isRetryable ? "retrying" : "failed",
            `${resp.status} ${errText.slice(0, 400)}`,
            ev.id,
          ],
        );
        failed++;
      }
    } catch (err) {
      await pool.query(
        `UPDATE linkedin_conversion_events
            SET send_status = 'retrying',
                send_attempts = send_attempts + 1,
                last_send_at = now(),
                last_send_error = $1
          WHERE id = $2::uuid`,
        [String(err).slice(0, 400), ev.id],
      );
      failed++;
    }
  }

  return { attempted: due.rowCount, sent, skipped: 0, failed };
}

/**
 * Convenience helpers — fyrer event direkte fra agency-leads-flow + Stripe.
 */
export async function fireAgencyLeadConversion(
  pool: Pool,
  args: {
    leadId: string;
    email: string;
    firstName?: string;
    lastName?: string;
    agencyName: string;
    linkedinClickId?: string;
  },
): Promise<void> {
  await queueConversionEvent(pool, {
    eventType: "LEAD",
    eventName: "agency_lead_received",
    email: args.email,
    firstName: args.firstName,
    lastName: args.lastName,
    countryCode: "NO",
    linkedinClickId: args.linkedinClickId,
    valueCurrency: "NOK",
    valueAmount: 500,                    // estimert lead-value
    sourceKind: "agency_lead",
    sourceAgencyLeadId: args.leadId,
    sourceMetadata: { agency_name: args.agencyName },
  });
}

export async function fireSubscriptionConversion(
  pool: Pool,
  args: {
    leadId?: string;
    email: string;
    firstName?: string;
    lastName?: string;
    mrrNok: number;
    eventType: "SUBSCRIBE" | "PURCHASE" | "ADD_PAYMENT_INFO";
  },
): Promise<void> {
  await queueConversionEvent(pool, {
    eventType: args.eventType,
    eventName: args.eventType === "PURCHASE"
      ? "subscription_first_payment"
      : args.eventType === "SUBSCRIBE"
        ? "subscription_started"
        : "payment_method_added",
    email: args.email,
    firstName: args.firstName,
    lastName: args.lastName,
    countryCode: "NO",
    valueCurrency: "NOK",
    valueAmount: args.mrrNok,
    sourceKind: "stripe_subscription",
    sourceAgencyLeadId: args.leadId,
  });
}
