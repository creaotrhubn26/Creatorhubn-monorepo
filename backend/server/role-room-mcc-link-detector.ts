/**
 * role-room-mcc-link-detector — detekterer endring i Google Ads MCC ↔ kunde-
 * link-status og fyrer producer-notifikasjon ved endring.
 *
 * Kjøres som en del av attribution-tick-cron-en (samme schedule). For hver
 * produsent med aktiv Google Ads OAuth-connection:
 *   1. Hent listMccLinks fra deres MCC (login_customer_id = miljø-konfig)
 *   2. Diff mot role_room_mcc_link_state (forrige observert status)
 *   3. Hvis status endrer seg → INSERT i role_room_project_notifications +
 *      oppdater state-snapshot
 *
 * Status-endringer vi notifiserer på:
 *   • PENDING → ACTIVE   ("kunde har godkjent invitasjon")
 *   • PENDING → REFUSED  ("kunde avviste")
 *   • ACTIVE → INACTIVE  ("link er deaktivert — kunden trakk tilgang")
 *
 * Notifikasjonen kobles til prosjektet hvor produsenten har en kampanje på
 * samme client_customer_id. Hvis ingen kampanje finnes ennå (kunden er
 * helt fersk), prøver vi første casting_user_roles-prosjekt produsenten
 * eier. Hvis det heller ikke finnes, oppdaterer vi state stille.
 */
import crypto from "node:crypto";
import type { Pool } from "pg";

import { listMccLinks, GoogleAdsApiError, type GoogleAdsMccLinkStatus } from "./role-room-google-ads.js";
import { resolveAdsAccessToken } from "./role-room-ads-oauth.js";

export interface McсLinkDetectSummary {
  producersScanned: number;
  linksObserved: number;
  statusChanges: number;
  notificationsFired: number;
  errors: number;
}

interface ProducerRow {
  user_id: string;
}

interface ExistingStateRow {
  client_customer_id: string;
  last_status: string;
  last_notified_status: string | null;
}

const STATUS_CHANGE_NOTIFICATIONS: Record<
  string,
  { eventType: string; titleSuffix: string; intent: GoogleAdsMccLinkStatus }
> = {
  ACTIVE: {
    eventType: "ads_mcc_link_active",
    titleSuffix: "har godkjent Google Ads-tilgang",
    intent: "ACTIVE",
  },
  REFUSED: {
    eventType: "ads_mcc_link_refused",
    titleSuffix: "avviste Google Ads-tilgang",
    intent: "REFUSED",
  },
  CANCELED: {
    eventType: "ads_mcc_link_canceled",
    titleSuffix: "kansellerte Google Ads-tilgang",
    intent: "CANCELED",
  },
  INACTIVE: {
    eventType: "ads_mcc_link_inactive",
    titleSuffix: "tilbaketrakk Google Ads-tilgang",
    intent: "INACTIVE",
  },
};

const fmtCustomerId = (digits: string): string =>
  digits.length === 10
    ? `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
    : digits;

/**
 * Finn et passende projectId å henge MCC-notifikasjonen på. Prioritet:
 *   1. Prosjekt med kampanje på samme customer_id (kunde-id matcher)
 *   2. Første aktive prosjekt produsenten eier via casting_user_roles
 *   3. null (ingen prosjekt-tilknytning enda — skipper notification)
 */
async function findProjectForNotification(
  pool: Pool,
  producerUserId: string,
  clientCustomerId: string,
): Promise<string | null> {
  // 1) Kampanje på matching customer_id (lagret i external_campaign_id eller
  //    creative_config.customerId — sjekk begge).
  const matchingProject = await pool.query<{ project_id: string }>(
    `SELECT project_id FROM ads_campaigns
      WHERE user_id = $1
        AND platform = 'google'
        AND (
          external_campaign_id LIKE 'customers/' || $2 || '/%'
          OR creative_config->>'customerId' = $2
        )
      ORDER BY created_at DESC
      LIMIT 1`,
    [producerUserId, clientCustomerId],
  );
  if (matchingProject.rows[0]?.project_id) {
    return matchingProject.rows[0].project_id;
  }

  // 2) Casting-prosjekt produsenten eier (siste opprettet).
  const fallbackProject = await pool.query<{ project_id: string }>(
    `SELECT project_id FROM casting_user_roles
      WHERE user_id = $1
      ORDER BY created_at DESC NULLS LAST
      LIMIT 1`,
    [producerUserId],
  );
  return fallbackProject.rows[0]?.project_id ?? null;
}

async function fireNotification(
  pool: Pool,
  args: {
    projectId: string;
    producerUserId: string;
    clientCustomerId: string;
    newStatus: GoogleAdsMccLinkStatus;
  },
): Promise<boolean> {
  const meta = STATUS_CHANGE_NOTIFICATIONS[args.newStatus];
  if (!meta) return false;
  const formatted = fmtCustomerId(args.clientCustomerId);
  const title = `Kunde ${formatted} ${meta.titleSuffix}`;
  const message =
    args.newStatus === "ACTIVE"
      ? "Du kan nå opprette og styre kampanjer for denne kontoen i Role Room."
      : args.newStatus === "REFUSED"
      ? "Invitasjonen ble ikke godtatt. Sjekk om kunden vil at du sender ny invitasjon."
      : args.newStatus === "INACTIVE"
      ? "Tilgangen til kontoen er ikke lenger aktiv. Du kan be om ny tilkobling."
      : "Invitasjonen ble kansellert.";
  try {
    await pool.query(
      `INSERT INTO role_room_project_notifications (
         id, project_id, audience, event_type, title, message,
         linked_entity_type, linked_entity_id, inbox_type, metadata,
         created_by_user_id, created_by_role, created_at, updated_at
       ) VALUES (
         $1, $2, 'producer_team', $3, $4, $5,
         'ads_mcc_link', $6, 'ads', $7::jsonb,
         $8, 'system', NOW(), NOW()
       )`,
      [
        crypto.randomUUID(),
        args.projectId,
        meta.eventType,
        title,
        message,
        args.clientCustomerId,
        JSON.stringify({
          clientCustomerId: args.clientCustomerId,
          status: args.newStatus,
          source: "mcc-link-detector",
        }),
        args.producerUserId,
      ],
    );
    return true;
  } catch (error) {
    console.warn(
      "[mcc-link-detector] failed to insert producer-notification:",
      error,
    );
    return false;
  }
}

/**
 * Hovedfunksjon — kalles fra attribution-tick. Trygt non-fatal: feil per
 * produsent stoppes lokalt og rapporteres i summary.errors.
 */
export async function runMccLinkStatusSweep(
  pool: Pool,
): Promise<McсLinkDetectSummary> {
  const summary: McсLinkDetectSummary = {
    producersScanned: 0,
    linksObserved: 0,
    statusChanges: 0,
    notificationsFired: 0,
    errors: 0,
  };

  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
  if (!developerToken || !loginCustomerId) {
    // Ikke konfigurert — hopp over hele sweep.
    return summary;
  }

  // 1) List produsenter med aktiv Google Ads OAuth-connection.
  const producers = await pool
    .query<ProducerRow>(
      `SELECT DISTINCT user_id
         FROM role_room_ads_oauth_connections
        WHERE platform = 'google' AND connection_state = 'connected'`,
    )
    .then((r) => r.rows);

  for (const { user_id: producerUserId } of producers) {
    summary.producersScanned += 1;
    try {
      const accessToken = await resolveAdsAccessToken(pool, "google", producerUserId);
      if (!accessToken) continue; // token utløpt og refresh feilet — neste runde

      const links = await listMccLinks({
        accessToken,
        developerToken,
        loginCustomerId,
      });
      summary.linksObserved += links.length;

      // 2) Hent eksisterende state for denne produsenten.
      const existingStates = await pool
        .query<ExistingStateRow>(
          `SELECT client_customer_id, last_status, last_notified_status
             FROM role_room_mcc_link_state
            WHERE producer_user_id = $1`,
          [producerUserId],
        )
        .then((r) => r.rows);
      const stateMap = new Map(
        existingStates.map((r) => [r.client_customer_id, r] as const),
      );

      // 3) Diff per link.
      for (const link of links) {
        const prior = stateMap.get(link.clientCustomerId);
        const newStatus = link.status;
        const statusChanged = !prior || prior.last_status !== newStatus;
        const shouldNotify =
          STATUS_CHANGE_NOTIFICATIONS[newStatus] !== undefined &&
          statusChanged &&
          // Unngå å fyre samme notification to ganger for samme (link, status):
          prior?.last_notified_status !== newStatus;

        if (statusChanged) summary.statusChanges += 1;

        // Upsert state.
        await pool.query(
          `INSERT INTO role_room_mcc_link_state (
             producer_user_id, client_customer_id, login_customer_id,
             last_status, last_status_changed_at, last_checked_at
           ) VALUES ($1, $2, $3, $4, NOW(), NOW())
           ON CONFLICT (producer_user_id, client_customer_id) DO UPDATE
             SET last_status = EXCLUDED.last_status,
                 login_customer_id = EXCLUDED.login_customer_id,
                 last_status_changed_at = CASE
                   WHEN role_room_mcc_link_state.last_status <> EXCLUDED.last_status
                     THEN NOW()
                   ELSE role_room_mcc_link_state.last_status_changed_at
                 END,
                 last_checked_at = NOW(),
                 updated_at = NOW()`,
          [producerUserId, link.clientCustomerId, loginCustomerId, newStatus],
        );

        if (!shouldNotify) continue;

        // 4) Finn prosjekt + fyre notifikasjon.
        const projectId = await findProjectForNotification(
          pool,
          producerUserId,
          link.clientCustomerId,
        );
        if (!projectId) {
          // Ingen prosjekt-tilknytning ennå — oppdater notify-state likevel
          // så vi ikke spammer fremtidige sweep-runder med samme link.
          await pool.query(
            `UPDATE role_room_mcc_link_state
                SET last_notified_status = $3, producer_notified_at = NOW(), updated_at = NOW()
              WHERE producer_user_id = $1 AND client_customer_id = $2`,
            [producerUserId, link.clientCustomerId, newStatus],
          );
          continue;
        }

        const fired = await fireNotification(pool, {
          projectId,
          producerUserId,
          clientCustomerId: link.clientCustomerId,
          newStatus,
        });
        if (fired) {
          summary.notificationsFired += 1;
          await pool.query(
            `UPDATE role_room_mcc_link_state
                SET last_notified_status = $3, producer_notified_at = NOW(), updated_at = NOW()
              WHERE producer_user_id = $1 AND client_customer_id = $2`,
            [producerUserId, link.clientCustomerId, newStatus],
          );
        }
      }
    } catch (error) {
      summary.errors += 1;
      if (error instanceof GoogleAdsApiError) {
        console.warn(
          `[mcc-link-detector] Google API error for producer ${producerUserId}:`,
          error.message,
        );
      } else {
        console.warn(
          `[mcc-link-detector] error scanning producer ${producerUserId}:`,
          error,
        );
      }
    }
  }

  return summary;
}
