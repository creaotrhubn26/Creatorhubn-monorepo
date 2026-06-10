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
