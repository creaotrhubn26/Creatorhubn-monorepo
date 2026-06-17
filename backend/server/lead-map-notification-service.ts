/**
 * lead-map-notification-service.ts
 *
 * Sender notifikasjoner ved lead-events. Multi-kanal:
 *   - In-app (lagres alltid i notification_events → /me/notifications)
 *   - APNs   (hvis enabled + device-token registrert)
 *   - E-post (fallback hvis APNs ikke konfigurert, eller hvis bruker
 *            har skrudd på email_enabled)
 *
 * Brukes fra:
 *   - assign-route (notifyLeadAssigned)
 *   - status-update (notifyStatusChanged)
 *   - follow-up cron (notifyFollowUpDue)
 *   - iPad GPS (notifyApproachingLead)
 */

import type { Pool } from "pg";
import { sendTransactionalEmail } from "./transactional-email-service.js";
import { sendAPNs } from "./lead-map-apns-client.js";

export type NotificationEventType =
  | "lead_assigned"
  | "lead_status_changed"
  | "lead_won_on_team"
  | "follow_up_due"
  | "approaching_lead";

interface DispatchArgs {
  pool: Pool;
  recipientUserId: string;
  organizationId: string | null;
  eventType: NotificationEventType;
  title: string;
  body: string;
  leadId?: string | null;
  visitId?: string | null;
  triggeredByUserId?: string | null;
  deepLink?: string | null;
  meta?: Record<string, unknown>;
}

interface DispatchResult {
  notificationId: string;
  emailSent: boolean;
  apnsSent: boolean;
  reason?: string;
}

/**
 * Hent eller opprett preferanse-rad m/ default-verdier (alt på).
 */
async function getPreference(
  pool: Pool,
  userId: string,
  organizationId: string | null,
  eventType: NotificationEventType,
): Promise<{ emailEnabled: boolean; apnsEnabled: boolean }> {
  if (!organizationId) return { emailEnabled: true, apnsEnabled: true };
  const r = await pool.query<{ email_enabled: boolean; apns_enabled: boolean }>(
    `SELECT email_enabled, apns_enabled
       FROM notification_preferences
      WHERE user_id = $1 AND organization_id = $2 AND event_type = $3
      LIMIT 1`,
    [userId, organizationId, eventType],
  );
  if (r.rows.length === 0) {
    return { emailEnabled: true, apnsEnabled: true };
  }
  return {
    emailEnabled: r.rows[0].email_enabled,
    apnsEnabled: r.rows[0].apns_enabled,
  };
}

/** Wrapper rundt sendAPNs (ekte ES256 JWT + HTTP/2). Returnerer
 *  shouldDisable=true hvis Apple svarer 410/BadDeviceToken — kalleren
 *  disabler token i db for å unngå framtidige forsøk på samme.
 */
async function deliverAPNs(
  token: string,
  title: string,
  body: string,
): Promise<{ sent: boolean; reason?: string; shouldDisable?: boolean }> {
  const r = await sendAPNs(token, title, body);
  return {
    sent: r.sent,
    reason: r.reason,
    shouldDisable: r.shouldDisableToken,
  };
}

export async function dispatchNotification(
  args: DispatchArgs,
): Promise<DispatchResult> {
  const {
    pool, recipientUserId, organizationId, eventType,
    title, body, leadId, visitId, triggeredByUserId,
    deepLink, meta,
  } = args;

  // 1. ALLTID lagre in-app event
  const insertRes = await pool.query<{ id: string }>(
    `INSERT INTO notification_events (
       recipient_user_id, organization_id, event_type,
       title, body, lead_id, visit_id,
       triggered_by_user_id, deep_link, meta
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id::text`,
    [
      recipientUserId, organizationId, eventType,
      title, body, leadId ?? null, visitId ?? null,
      triggeredByUserId ?? null, deepLink ?? null,
      meta ?? {},
    ],
  );
  const notificationId = insertRes.rows[0].id;

  // 2. Sjekk preferanser
  const pref = await getPreference(pool, recipientUserId, organizationId, eventType);

  let emailSent = false;
  let apnsSent = false;

  // 3. APNs (hvis aktivt og device-token finnes)
  if (pref.apnsEnabled) {
    const tokRes = await pool.query<{ token: string }>(
      `SELECT token FROM notification_device_tokens
        WHERE user_id = $1 AND platform = 'apns' AND enabled = TRUE`,
      [recipientUserId],
    );
    for (const t of tokRes.rows) {
      const r = await deliverAPNs(t.token, title, body);
      if (r.sent) {
        apnsSent = true;
        break;
      }
      // Apple sa "BadDeviceToken"/"Unregistered" — token er død,
      // disable den så vi ikke prøver igjen
      if (r.shouldDisable) {
        try {
          await pool.query(
            `UPDATE notification_device_tokens
                SET enabled = FALSE
              WHERE token = $1 AND user_id = $2`,
            [t.token, recipientUserId],
          );
        } catch { /* noop */ }
      }
    }
  }

  // 4. E-post (fallback hvis ikke APNs, eller alltid hvis pref vil ha begge)
  if (pref.emailEnabled && !apnsSent) {
    try {
      const userRes = await pool.query<{ email: string | null; name: string | null }>(
        `SELECT email, name FROM users WHERE id = $1`,
        [recipientUserId],
      );
      const email = userRes.rows[0]?.email;
      if (email) {
        const result = await sendTransactionalEmail({
          to: email,
          subject: `Lead Map · ${title}`,
          text: `${body}\n\n${deepLink ? `Åpne: ${deepLink}` : ""}`,
          html: `<p>${body.replace(/\n/g, "<br>")}</p>${
            deepLink
              ? `<p><a href="${deepLink}" style="color:#c084fc">Åpne lead</a></p>`
              : ""
          }`,
          kind: `lead_map_${eventType}`,
          sentByUserId: triggeredByUserId ?? "system",
          pool,
        });
        emailSent = result.sent;
      }
    } catch (err) {
      console.error("[notification] email-deliver failed:", err);
    }
  }

  // 5. Markér delivery-flags på event-raden
  await pool.query(
    `UPDATE notification_events
        SET email_sent = $2, apns_sent = $3
      WHERE id = $1`,
    [notificationId, emailSent, apnsSent],
  );

  return { notificationId, emailSent, apnsSent };
}

// ─────────────────────────────────────────────────────────────────
// Trigger-helpers — kalles fra eksisterende routes
// ─────────────────────────────────────────────────────────────────

export async function notifyLeadAssigned(
  pool: Pool,
  args: {
    leadId: string;
    fromUserId: string | null;
    toUserId: string;
    triggeredByUserId: string;
  },
): Promise<void> {
  // Hent lead-info for å bygge nyttig melding
  const r = await pool.query<{
    name: string; address: string | null; city: string | null;
    organization_id: string | null;
  }>(
    `SELECT c.name, c.address, c.city, cp.organization_id::text
       FROM crm_customers c
       LEFT JOIN casting_projects cp ON cp.id = c.project_id
      WHERE c.id = $1 LIMIT 1`,
    [args.leadId],
  );
  const lead = r.rows[0];
  if (!lead) return;
  const locationFragment = [lead.address, lead.city].filter(Boolean).join(", ");
  await dispatchNotification({
    pool,
    recipientUserId: args.toUserId,
    organizationId: lead.organization_id ?? null,
    eventType: "lead_assigned",
    title: `Ny lead tildelt deg: ${lead.name}`,
    body: locationFragment
      ? `${lead.name} (${locationFragment}) er tildelt deg av salgssjefen. Åpne Min dag-listen.`
      : `${lead.name} er tildelt deg. Åpne Min dag-listen.`,
    leadId: args.leadId,
    triggeredByUserId: args.triggeredByUserId,
    deepLink: `https://theroleroom.com/admin-room?lead=${args.leadId}`,
  });
}

export async function notifyStatusChanged(
  pool: Pool,
  args: {
    leadId: string;
    oldStatus: string | null;
    newStatus: string;
    triggeredByUserId: string;
  },
): Promise<void> {
  // Hent assigned_user + org_id
  const r = await pool.query<{
    name: string; assigned_user_id: string | null;
    organization_id: string | null;
  }>(
    `SELECT c.name, c.assigned_user_id, cp.organization_id::text
       FROM crm_customers c
       LEFT JOIN casting_projects cp ON cp.id = c.project_id
      WHERE c.id = $1 LIMIT 1`,
    [args.leadId],
  );
  const lead = r.rows[0];
  if (!lead?.assigned_user_id) return;
  // Ikke send notifikasjon hvis brukeren endret sin egen lead's status
  if (lead.assigned_user_id === args.triggeredByUserId) return;
  const statusLabel = (s: string): string => {
    const map: Record<string, string> = {
      won: "Vunnet", lost: "Tapt", meeting_booked: "Møte booket",
      interested: "Interessert", proposal_sent: "Tilbud sendt",
      declined: "Avvist", visited: "Besøkt",
    };
    return map[s] ?? s;
  };
  await dispatchNotification({
    pool,
    recipientUserId: lead.assigned_user_id,
    organizationId: lead.organization_id ?? null,
    eventType: "lead_status_changed",
    title: `${lead.name}: ${statusLabel(args.newStatus)}`,
    body: `Status på din lead "${lead.name}" er endret til ${statusLabel(args.newStatus)}.`,
    leadId: args.leadId,
    triggeredByUserId: args.triggeredByUserId,
    deepLink: `https://theroleroom.com/admin-room?lead=${args.leadId}`,
    meta: { oldStatus: args.oldStatus, newStatus: args.newStatus },
  });

  // Hvis won: varsle også teamleder + salgssjef i samme org
  if (args.newStatus === "won" && lead.organization_id) {
    // LM-8: dedup mot tidligere won-fan-out. Toggle won→lost→won (eller
    // status-rapport som re-trigger via PATCH) ville ellers spammet
    // hele teamet med 🏆-varsler hver gang. Vi sjekker om noen tidligere
    // lead_won_on_team-event eksisterer for dette leadet — i så fall
    // hopper vi over fan-out entirely.
    const previouslyWon = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM notification_events
          WHERE lead_id = $1
            AND event_type = 'lead_won_on_team'
       ) AS exists`,
      [args.leadId],
    );
    if (previouslyWon.rows[0]?.exists) {
      return;
    }
    const teamLeads = await pool.query<{ user_id: string }>(
      `SELECT om.user_id FROM organization_members om
         JOIN organization_members om_seller
           ON om_seller.organization_id = om.organization_id
          AND om_seller.user_id = $1
        WHERE om.organization_id = $2
          AND (om.role = 'salgssjef'
               OR (om.role = 'teamleder' AND om.sales_team_id = om_seller.sales_team_id))`,
      [lead.assigned_user_id, lead.organization_id],
    );
    for (const tl of teamLeads.rows) {
      if (tl.user_id === lead.assigned_user_id) continue;
      await dispatchNotification({
        pool,
        recipientUserId: tl.user_id,
        organizationId: lead.organization_id,
        eventType: "lead_won_on_team",
        title: `🏆 Lead vunnet i teamet: ${lead.name}`,
        body: `En selger i ditt team vant "${lead.name}".`,
        leadId: args.leadId,
        triggeredByUserId: args.triggeredByUserId,
        deepLink: `https://theroleroom.com/admin-room?lead=${args.leadId}`,
      });
    }
  }
}

/**
 * Trigget av iPad når CLCircularRegion-monitorering detekterer at
 * brukeren er innenfor 500m av en tildelt lead. Throttled til 1 varsel
 * per (user, lead) per 4 timer for å unngå spam hvis brukeren står
 * stille (eller går inn/ut av regionen flere ganger).
 *
 * Returnerer suppressed=true hvis varselet ble undertrykt av throttling.
 */
export async function notifyApproachingLead(
  pool: Pool,
  args: {
    leadId: string;
    userId: string;
    distanceMeters?: number;
  },
): Promise<{ sent: boolean; suppressed: boolean; reason?: string }> {
  // Throttle: ikke send hvis vi har sendt approaching_lead for samme
  // (user, lead) siste 4 timer.
  const throttleRes = await pool.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n
       FROM notification_events
      WHERE recipient_user_id = $1
        AND lead_id = $2
        AND event_type = 'approaching_lead'
        AND created_at > NOW() - INTERVAL '4 hours'`,
    [args.userId, args.leadId],
  );
  if ((throttleRes.rows[0]?.n ?? 0) > 0) {
    return { sent: false, suppressed: true, reason: "throttled_4h" };
  }

  // Hent lead + org-id (lead må være assigned til brukeren — sikkerhet)
  const r = await pool.query<{
    name: string; address: string | null;
    assigned_user_id: string | null;
    organization_id: string | null;
  }>(
    `SELECT c.name, c.address, c.assigned_user_id,
            cp.organization_id::text
       FROM crm_customers c
       LEFT JOIN casting_projects cp ON cp.id = c.project_id
      WHERE c.id = $1 LIMIT 1`,
    [args.leadId],
  );
  const lead = r.rows[0];
  if (!lead) return { sent: false, suppressed: false, reason: "lead_not_found" };
  if (lead.assigned_user_id !== args.userId) {
    return { sent: false, suppressed: false, reason: "not_assigned_to_user" };
  }

  const distLabel = args.distanceMeters !== undefined
    ? `${Math.round(args.distanceMeters)} m unna`
    : "i nærheten";
  const addr = lead.address ? ` (${lead.address})` : "";

  await dispatchNotification({
    pool,
    recipientUserId: args.userId,
    organizationId: lead.organization_id ?? null,
    eventType: "approaching_lead",
    title: `📍 Nær lead: ${lead.name}`,
    body: `Du er ${distLabel} fra ${lead.name}${addr}. Stikk innom for et besøk?`,
    leadId: args.leadId,
    triggeredByUserId: args.userId,
    deepLink: `https://theroleroom.com/admin-room?lead=${args.leadId}`,
    meta: { distance_m: args.distanceMeters },
  });

  return { sent: true, suppressed: false };
}
