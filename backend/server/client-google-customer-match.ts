/**
 * client-google-customer-match.ts
 *
 * Google Ads Customer Match — last opp e-postlister fra klient-CRM
 * som målgruppe på Google Ads (brukes til retargeting på Search +
 * YouTube + Gmail + Display).
 *
 * SHA256-hasher email + phone før upload via offline-user-data-jobs.
 * Krever Marketing-API-godkjent OAuth-connection + developer-token.
 *
 * https://developers.google.com/google-ads/api/docs/remarketing/audience-segments/customer-match
 */

import type { Pool } from "pg";
import crypto from "node:crypto";
import {
  ensureFreshAdsToken,
  getAdsOauthConnection,
} from "./role-room-ads-oauth.js";

const GOOGLE_ADS_API_BASE = "https://googleads.googleapis.com/v18";

function googleHash(value: string): string {
  return crypto.createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

async function getAdsAccess(pool: Pool, producerUserId: string): Promise<string | null> {
  const conn = await getAdsOauthConnection(pool, producerUserId, "google");
  if (!conn) return null;
  const t = await ensureFreshAdsToken(pool, conn);
  return t.connectionState === "connected" ? t.accessToken : null;
}

function adsHeaders(access: string): Record<string, string> {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim();
  const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.trim().replace(/-/g, "");
  const h: Record<string, string> = {
    Authorization: `Bearer ${access}`,
    "Content-Type": "application/json",
    "developer-token": developerToken ?? "",
  };
  if (loginCustomerId) h["login-customer-id"] = loginCustomerId;
  return h;
}

/** Opprett user-list + last opp hashed e-poster i én operasjon. */
export async function createGoogleCustomerMatchAudience(
  pool: Pool,
  opts: {
    producerUserId: string;
    customerId: string;          // 10 sifre, uten bindestreker
    name: string;
    sourceDescription?: string;
    identifiers: Array<{ email?: string; phone?: string }>;
    configId?: string | null;
  },
): Promise<{ ok: true; userListResource: string; uploadCount: number } | { ok: false; error: string }> {
  const access = await getAdsAccess(pool, opts.producerUserId);
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim();
  if (!access || !developerToken) return { ok: false, error: "not_connected" };

  const cleanId = opts.customerId.replace(/-/g, "");

  // 1) Opprett UserList av type CRM_BASED
  const userListBody = {
    operations: [{
      create: {
        name: opts.name,
        description: opts.sourceDescription ?? `RR Agent — ${opts.name}`,
        crmBasedUserList: {
          uploadKeyType: "CONTACT_INFO",
          dataSourceType: "FIRST_PARTY",
        },
        membershipLifeSpan: 540,
      },
    }],
  };
  const listR = await fetch(`${GOOGLE_ADS_API_BASE}/customers/${cleanId}/userLists:mutate`, {
    method: "POST",
    headers: adsHeaders(access),
    body: JSON.stringify(userListBody),
  });
  if (!listR.ok) {
    const t = await listR.text();
    return { ok: false, error: `userLists/mutate HTTP ${listR.status} — ${t.slice(0, 200)}` };
  }
  const listBody = await listR.json() as { results?: Array<{ resourceName?: string }> };
  const userListResource = listBody.results?.[0]?.resourceName;
  if (!userListResource) return { ok: false, error: "Manglende resourceName" };

  // 2) Opprett offline-user-data-job
  const jobR = await fetch(`${GOOGLE_ADS_API_BASE}/customers/${cleanId}/offlineUserDataJobs:create`, {
    method: "POST",
    headers: adsHeaders(access),
    body: JSON.stringify({
      job: {
        type: "CUSTOMER_MATCH_USER_LIST",
        customerMatchUserListMetadata: { userList: userListResource },
      },
    }),
  });
  if (!jobR.ok) return { ok: false, error: `offlineUserDataJobs/create HTTP ${jobR.status}` };
  const jobBody = await jobR.json() as { resourceName?: string };
  const jobResource = jobBody.resourceName;
  if (!jobResource) return { ok: false, error: "Manglende job resourceName" };

  // 3) Legg til operasjoner med hashed user-data
  const operations: any[] = [];
  for (const id of opts.identifiers) {
    const userIdentifiers: any[] = [];
    if (id.email) userIdentifiers.push({ hashedEmail: googleHash(id.email) });
    if (id.phone) userIdentifiers.push({ hashedPhoneNumber: googleHash(id.phone) });
    if (userIdentifiers.length > 0) {
      operations.push({ create: { userIdentifiers } });
    }
  }
  if (operations.length === 0) return { ok: false, error: "Ingen gyldige identifiers" };

  // Google tillater max 100 000 ops per request — batch i 10 000-er for sikkerhet
  for (let i = 0; i < operations.length; i += 10000) {
    const batch = operations.slice(i, i + 10000);
    await fetch(`${GOOGLE_ADS_API_BASE}/${jobResource}:addOperations`, {
      method: "POST",
      headers: adsHeaders(access),
      body: JSON.stringify({
        operations: batch,
        enablePartialFailure: true,
      }),
    }).catch(() => null);
  }

  // 4) Kjør jobben
  await fetch(`${GOOGLE_ADS_API_BASE}/${jobResource}:run`, {
    method: "POST",
    headers: adsHeaders(access),
    body: "{}",
  }).catch(() => null);

  // 5) Cache i DB
  await pool.query(
    `INSERT INTO google_customer_match_audiences (
       config_id, producer_user_id, customer_id, user_list_resource,
       audience_name, source_description, upload_count, status
     ) VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, 'processing')
     ON CONFLICT (user_list_resource) DO NOTHING`,
    [
      opts.configId ?? null,
      opts.producerUserId,
      cleanId,
      userListResource,
      opts.name,
      opts.sourceDescription ?? null,
      operations.length,
    ],
  ).catch(() => {});

  return { ok: true, userListResource, uploadCount: operations.length };
}

export async function listGoogleCustomerMatchAudiences(
  pool: Pool,
  opts: { producerUserId: string; customerId: string },
): Promise<{ ok: true; audiences: Array<{ resourceName: string; name: string; size?: number; status: string }> } | { ok: false; error: string }> {
  const access = await getAdsAccess(pool, opts.producerUserId);
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim();
  if (!access || !developerToken) return { ok: false, error: "not_connected" };

  const cleanId = opts.customerId.replace(/-/g, "");
  const gaql = `
    SELECT user_list.resource_name, user_list.name, user_list.size_for_display, user_list.membership_status
      FROM user_list
     WHERE user_list.type = 'CRM_BASED'
     ORDER BY user_list.id DESC
     LIMIT 50
  `;

  const r = await fetch(`${GOOGLE_ADS_API_BASE}/customers/${cleanId}/googleAds:search`, {
    method: "POST",
    headers: adsHeaders(access),
    body: JSON.stringify({ query: gaql }),
  });
  if (!r.ok) return { ok: false, error: `googleAds:search HTTP ${r.status}` };
  const body = await r.json() as { results?: Array<{ userList?: any }> };
  return {
    ok: true,
    audiences: (body.results ?? []).map((row) => ({
      resourceName: row.userList?.resourceName ?? "",
      name: row.userList?.name ?? "(unnamed)",
      size: row.userList?.sizeForDisplay ? Number(row.userList.sizeForDisplay) : undefined,
      status: row.userList?.membershipStatus ?? "unknown",
    })),
  };
}

// ─────────────────────────────────────────────────────────────────────
// Google Offline Conversions per klient — server-side conversion events
//   https://developers.google.com/google-ads/api/docs/conversions/upload-clicks
//   https://developers.google.com/google-ads/api/docs/conversions/enhanced-conversions
// ─────────────────────────────────────────────────────────────────────

/**
 * Last opp én offline-konvertering til Google Ads (krever enten gclid eller
 * Enhanced Conversions user_identifiers). Logger leveransen i
 * google_offline_conversion_log.
 *
 * Bruker conversions:uploadClickConversions hvis gclid finnes, ellers
 * uploadConversionAdjustments for Enhanced Conversions.
 */
export async function sendGoogleOfflineConversion(
  pool: Pool,
  opts: {
    producerUserId: string;
    configId?: string | null;
    customerId: string;                          // 10 sifre
    conversionActionResource: string;            // customers/X/conversionActions/Y
    eventName: string;                           // for logging
    eventTime?: Date;
    eventSourceUrl?: string;
    gclid?: string;                              // Click-ID hvis tilgjengelig
    email?: string;
    phone?: string;
    value?: number;
    currency?: string;
    enhancedConversions?: boolean;               // true = bruk user_identifiers
    customProperties?: Record<string, unknown>;
  },
): Promise<{ ok: true; logId: string } | { ok: false; error: string; logId?: string }> {
  const access = await getAdsAccess(pool, opts.producerUserId);
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim();
  if (!access || !developerToken) return { ok: false, error: "not_connected" };

  const cleanId = opts.customerId.replace(/-/g, "");
  const eventTime = opts.eventTime ?? new Date();
  // Google ønsker "yyyy-MM-dd HH:mm:ss+TZ" — bruk ISO8601 med offset
  const tz = eventTime.toISOString().replace("T", " ").replace("Z", "+00:00");

  const externalUserHash = opts.email ? googleHash(opts.email) : null;
  const logRow = await pool.query(
    `INSERT INTO google_offline_conversion_log (
       config_id, producer_user_id, customer_id, conversion_action_resource,
       event_name, event_time, event_source, external_user_id, gclid,
       event_value, event_currency, enhanced_conversions, custom_properties,
       delivery_status, attempt_count
     ) VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, 'pending', 1)
     RETURNING id`,
    [
      opts.configId ?? null,
      opts.producerUserId,
      cleanId,
      opts.conversionActionResource,
      opts.eventName,
      eventTime.toISOString(),
      opts.eventSourceUrl ?? null,
      externalUserHash,
      opts.gclid ?? null,
      opts.value ?? null,
      opts.currency ?? "NOK",
      opts.enhancedConversions ?? false,
      JSON.stringify(opts.customProperties ?? {}),
    ],
  );
  const logId = logRow.rows[0].id as string;

  const useEnhanced = opts.enhancedConversions || !opts.gclid;
  if (useEnhanced && !opts.email && !opts.phone) {
    await pool.query(
      `UPDATE google_offline_conversion_log SET delivery_status='failed', last_error=$1, updated_at=NOW() WHERE id=$2::uuid`,
      ["Ingen gclid + ingen email/phone — kan ikke matche konvertering", logId],
    );
    return { ok: false, error: "Mangler gclid eller bruker-identifikatorer", logId };
  }

  const conversion: Record<string, unknown> = {
    conversionAction: opts.conversionActionResource,
    conversionDateTime: tz,
  };
  if (opts.value !== undefined) {
    conversion.conversionValue = opts.value;
    conversion.currencyCode = opts.currency ?? "NOK";
  }
  if (opts.gclid) {
    conversion.gclid = opts.gclid;
  }
  if (useEnhanced) {
    const userIdentifiers: Array<Record<string, string>> = [];
    if (opts.email) userIdentifiers.push({ hashedEmail: googleHash(opts.email) });
    if (opts.phone) userIdentifiers.push({ hashedPhoneNumber: googleHash(opts.phone.replace(/[^\d]/g, "")) });
    conversion.userIdentifiers = userIdentifiers;
  }

  const r = await fetch(
    `${GOOGLE_ADS_API_BASE}/customers/${cleanId}:uploadClickConversions`,
    {
      method: "POST",
      headers: adsHeaders(access),
      body: JSON.stringify({
        conversions: [conversion],
        partialFailure: true,
        validateOnly: false,
      }),
    },
  );
  const respText = await r.text();
  const respBody: unknown = respText ? (() => { try { return JSON.parse(respText); } catch { return { raw: respText }; } })() : {};

  // partialFailureError er Google sin måte å rapportere per-row-feil
  const partialErr = (respBody as { partialFailureError?: { message?: string } })?.partialFailureError;
  if (!r.ok || partialErr) {
    const errMsg = !r.ok
      ? `Google offline conv HTTP ${r.status} — ${respText.slice(0, 300)}`
      : `Partial failure: ${partialErr?.message ?? JSON.stringify(partialErr).slice(0, 300)}`;
    await pool.query(
      `UPDATE google_offline_conversion_log
         SET delivery_status='failed', last_error=$1, google_response=$2::jsonb, updated_at=NOW()
       WHERE id=$3::uuid`,
      [errMsg, JSON.stringify(respBody), logId],
    );
    return { ok: false, error: errMsg, logId };
  }

  await pool.query(
    `UPDATE google_offline_conversion_log
       SET delivery_status='delivered', delivered_at=NOW(), google_response=$1::jsonb, updated_at=NOW()
     WHERE id=$2::uuid`,
    [JSON.stringify(respBody), logId],
  );
  return { ok: true, logId };
}

export async function listGoogleOfflineConversions(
  pool: Pool,
  opts: { configId?: string | null; producerUserId: string; limit?: number },
): Promise<Array<{
  id: string;
  customerId: string;
  conversionActionResource: string;
  eventName: string;
  eventTime: string;
  externalUserId: string | null;
  gclid: string | null;
  eventValue: number | null;
  eventCurrency: string;
  enhancedConversions: boolean;
  deliveryStatus: string;
  deliveredAt: string | null;
  attemptCount: number;
  lastError: string | null;
}>> {
  const r = await pool.query(
    `SELECT id, customer_id, conversion_action_resource, event_name, event_time,
            external_user_id, gclid, event_value, event_currency, enhanced_conversions,
            delivery_status, delivered_at, attempt_count, last_error
     FROM google_offline_conversion_log
     WHERE producer_user_id = $1::uuid
       AND ($2::uuid IS NULL OR config_id = $2::uuid)
     ORDER BY event_time DESC
     LIMIT $3`,
    [opts.producerUserId, opts.configId ?? null, opts.limit ?? 50],
  );
  return r.rows.map((row) => ({
    id: row.id,
    customerId: row.customer_id,
    conversionActionResource: row.conversion_action_resource,
    eventName: row.event_name,
    eventTime: row.event_time,
    externalUserId: row.external_user_id,
    gclid: row.gclid,
    eventValue: row.event_value ? Number(row.event_value) : null,
    eventCurrency: row.event_currency,
    enhancedConversions: row.enhanced_conversions,
    deliveryStatus: row.delivery_status,
    deliveredAt: row.delivered_at,
    attemptCount: row.attempt_count,
    lastError: row.last_error,
  }));
}
