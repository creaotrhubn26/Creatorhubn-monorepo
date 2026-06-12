/**
 * client-ads-diagnostics-service.ts
 *
 * N2-B6 — Monitoring + Diagnostics for klient-ads-tracking.
 *
 * Henter sammendrag fra client_ads_events:
 *   - Recent events (24h, 7d, 30d)
 *   - Per-action fire-counts + sist-fyret
 *   - Suksess-rate (sendt til Google Ads OK vs feilet)
 *   - Health-status (rød hvis action ikke fyrt på 7+ dager)
 *   - Sammenligning mot Google Ads forventet (offline reconciliation)
 *
 * Brukes også som receiver for proxy-method (POST /track) — registrer
 * event i client_ads_events, og videresend til Google Ads via Measurement
 * Protocol hvis konfigurert.
 */

import type { Pool } from "pg";

export interface DiagnosticsSummary {
  configId: string;
  generatedAt: string;

  // Per-tidsvindu
  windowCounts: {
    last_24h: number;
    last_7d: number;
    last_30d: number;
  };

  // Suksess-rate
  delivery: {
    total_attempted: number;
    delivered_to_google: number;
    failed: number;
    successRate: number;       // 0-100
    lastFailureAt: string | null;
    lastFailureMessage: string | null;
  };

  // Per-action
  actionsHealth: Array<{
    action_id: string | null;
    action_name: string;
    display_name: string | null;
    is_active: boolean;
    google_ads_label: string | null;
    fired_24h: number;
    fired_7d: number;
    fired_30d: number;
    last_fired_at: string | null;
    days_since_fired: number | null;
    health: 'green' | 'yellow' | 'red' | 'inactive';
    healthReason: string;
  }>;

  // Recent events
  recentEvents: Array<{
    id: string;
    action_name: string;
    event_value: number | null;
    currency: string | null;
    sent_to_google_ads: boolean;
    google_ads_error: string | null;
    transaction_id: string | null;
    created_at: string;
  }>;

  // Top-failures (siste 48t)
  topFailures: Array<{ error: string; count: number; first_seen: string; last_seen: string }>;
}

export async function buildDiagnosticsSummary(
  pool: Pool, configId: string,
): Promise<DiagnosticsSummary | null> {
  // Eksisterer config?
  const c = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM client_ads_configs WHERE id = $1::uuid) AS exists`,
    [configId],
  );
  if (!c.rows[0]?.exists) return null;

  // Window-counts
  const windowsRes = await pool.query<{
    last_24h: number; last_7d: number; last_30d: number;
  }>(
    `SELECT
       COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours')::int AS last_24h,
       COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS last_7d,
       COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int AS last_30d
     FROM client_ads_events
     WHERE config_id = $1::uuid`,
    [configId],
  );

  // Delivery-rate
  const deliveryRes = await pool.query<{
    total_attempted: number;
    delivered_to_google: number;
    failed: number;
    last_failure_at: Date | null;
    last_failure_message: string | null;
  }>(
    `SELECT
       COUNT(*)::int AS total_attempted,
       COUNT(*) FILTER (WHERE sent_to_google_ads = TRUE)::int AS delivered_to_google,
       COUNT(*) FILTER (WHERE google_ads_error IS NOT NULL)::int AS failed,
       MAX(created_at) FILTER (WHERE google_ads_error IS NOT NULL) AS last_failure_at,
       (SELECT google_ads_error FROM client_ads_events
        WHERE config_id = $1::uuid AND google_ads_error IS NOT NULL
        ORDER BY created_at DESC LIMIT 1) AS last_failure_message
     FROM client_ads_events
     WHERE config_id = $1::uuid AND created_at >= NOW() - INTERVAL '30 days'`,
    [configId],
  );
  const d = deliveryRes.rows[0];
  const successRate = d.total_attempted > 0
    ? Math.round((d.delivered_to_google / d.total_attempted) * 100)
    : 100;

  // Per-action health
  const actionsRes = await pool.query<{
    action_id: string | null;
    action_name: string;
    display_name: string | null;
    is_active: boolean;
    google_ads_label: string | null;
    fired_24h: number;
    fired_7d: number;
    fired_30d: number;
    last_fired_at: Date | null;
  }>(
    `SELECT
       a.id::text AS action_id,
       a.action_name,
       a.display_name,
       a.is_active,
       a.google_ads_label,
       COUNT(e.*) FILTER (WHERE e.created_at >= NOW() - INTERVAL '24 hours')::int AS fired_24h,
       COUNT(e.*) FILTER (WHERE e.created_at >= NOW() - INTERVAL '7 days')::int AS fired_7d,
       COUNT(e.*) FILTER (WHERE e.created_at >= NOW() - INTERVAL '30 days')::int AS fired_30d,
       MAX(e.created_at) AS last_fired_at
     FROM client_ads_actions a
     LEFT JOIN client_ads_events e ON e.action_id = a.id
     WHERE a.config_id = $1::uuid
     GROUP BY a.id, a.action_name, a.display_name, a.is_active, a.google_ads_label
     ORDER BY a.action_name ASC`,
    [configId],
  );

  const actionsHealth = actionsRes.rows.map((row) => {
    const daysSince = row.last_fired_at
      ? Math.floor((Date.now() - new Date(row.last_fired_at).getTime()) / 86400000)
      : null;

    let health: 'green' | 'yellow' | 'red' | 'inactive';
    let healthReason: string;

    if (!row.is_active) {
      health = 'inactive';
      healthReason = 'Action er deaktivert';
    } else if (!row.google_ads_label) {
      health = 'red';
      healthReason = 'Mangler Google Ads-label (provisjon i Setup)';
    } else if (daysSince === null) {
      health = 'red';
      healthReason = 'Aldri fyrt';
    } else if (daysSince > 14) {
      health = 'red';
      healthReason = `Ikke fyrt på ${daysSince} dager`;
    } else if (daysSince > 7) {
      health = 'yellow';
      healthReason = `Sist fyrt for ${daysSince} dager siden`;
    } else if (row.fired_7d === 0) {
      health = 'yellow';
      healthReason = 'Ingen fyringer siste 7 dager';
    } else {
      health = 'green';
      healthReason = `${row.fired_7d} fyringer siste 7 dager`;
    }

    return {
      action_id: row.action_id,
      action_name: row.action_name,
      display_name: row.display_name,
      is_active: row.is_active,
      google_ads_label: row.google_ads_label,
      fired_24h: row.fired_24h,
      fired_7d: row.fired_7d,
      fired_30d: row.fired_30d,
      last_fired_at: row.last_fired_at?.toISOString() ?? null,
      days_since_fired: daysSince,
      health, healthReason,
    };
  });

  // Recent events (last 20)
  const recentRes = await pool.query<{
    id: string; action_name: string;
    event_value: string | null; currency: string | null;
    sent_to_google_ads: boolean; google_ads_error: string | null;
    transaction_id: string | null; created_at: Date;
  }>(
    `SELECT id::text, action_name, event_value, currency,
            sent_to_google_ads, google_ads_error, transaction_id, created_at
     FROM client_ads_events
     WHERE config_id = $1::uuid
     ORDER BY created_at DESC
     LIMIT 20`,
    [configId],
  );

  const recentEvents = recentRes.rows.map((row) => ({
    id: row.id,
    action_name: row.action_name,
    event_value: row.event_value ? Number(row.event_value) : null,
    currency: row.currency,
    sent_to_google_ads: row.sent_to_google_ads,
    google_ads_error: row.google_ads_error,
    transaction_id: row.transaction_id,
    created_at: row.created_at.toISOString(),
  }));

  // Top failures (siste 48t)
  const failuresRes = await pool.query<{
    error: string; count: number; first_seen: Date; last_seen: Date;
  }>(
    `SELECT
       google_ads_error AS error,
       COUNT(*)::int AS count,
       MIN(created_at) AS first_seen,
       MAX(created_at) AS last_seen
     FROM client_ads_events
     WHERE config_id = $1::uuid
       AND google_ads_error IS NOT NULL
       AND created_at >= NOW() - INTERVAL '48 hours'
     GROUP BY google_ads_error
     ORDER BY count DESC
     LIMIT 5`,
    [configId],
  );

  return {
    configId,
    generatedAt: new Date().toISOString(),
    windowCounts: windowsRes.rows[0] ?? { last_24h: 0, last_7d: 0, last_30d: 0 },
    delivery: {
      total_attempted: d.total_attempted,
      delivered_to_google: d.delivered_to_google,
      failed: d.failed,
      successRate,
      lastFailureAt: d.last_failure_at?.toISOString() ?? null,
      lastFailureMessage: d.last_failure_message,
    },
    actionsHealth,
    recentEvents,
    topFailures: failuresRes.rows.map((r) => ({
      error: r.error.slice(0, 200),
      count: r.count,
      first_seen: r.first_seen.toISOString(),
      last_seen: r.last_seen.toISOString(),
    })),
  };
}

// ─────────────────────────────────────────────────────────────────────
// Track-endpoint: receiver for proxy-method
// ─────────────────────────────────────────────────────────────────────

export interface TrackEventInput {
  configId: string;
  proxyToken: string;
  actionName: string;
  value?: number;
  currency?: string;
  userIdentifier?: string;
  transactionId?: string;
  pageUrl?: string;
  referrer?: string;
  userAgent?: string;
  ipAddress?: string;
}

export async function recordTrackEvent(
  pool: Pool, input: TrackEventInput,
): Promise<
  | { ok: true; eventId: string; deduplicated: boolean }
  | { ok: false; reason: string }
> {
  // Verifiser proxy-token
  const c = await pool.query<{
    id: string; tracking_proxy_token: string | null;
  }>(
    `SELECT id::text, tracking_proxy_token
     FROM client_ads_configs WHERE id = $1::uuid`,
    [input.configId],
  );
  if (c.rowCount === 0) return { ok: false, reason: 'config_not_found' };
  if (!c.rows[0].tracking_proxy_token) return { ok: false, reason: 'proxy_not_configured' };
  if (c.rows[0].tracking_proxy_token !== input.proxyToken) {
    return { ok: false, reason: 'invalid_proxy_token' };
  }

  // Hent action_id basert på navn (UNIQUE per config)
  const a = await pool.query<{ id: string }>(
    `SELECT id::text FROM client_ads_actions
     WHERE config_id = $1::uuid AND action_name = $2 AND is_active = TRUE`,
    [input.configId, input.actionName],
  );
  const actionId = a.rows[0]?.id ?? null;

  // Dedup-check
  if (input.transactionId) {
    const dup = await pool.query(
      `SELECT id FROM client_ads_events
       WHERE config_id = $1::uuid AND transaction_id = $2 LIMIT 1`,
      [input.configId, input.transactionId],
    );
    if ((dup.rowCount ?? 0) > 0) {
      return { ok: true, eventId: dup.rows[0].id, deduplicated: true };
    }
  }

  // Insert event
  const e = await pool.query<{ id: string }>(
    `INSERT INTO client_ads_events (
       config_id, action_id, action_name, event_value, currency,
       user_identifier, transaction_id, page_url, referrer, user_agent, ip_address,
       sent_to_google_ads
     ) VALUES (
       $1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, $11, FALSE
     )
     RETURNING id::text`,
    [
      input.configId,
      actionId,
      input.actionName,
      input.value ?? null,
      input.currency ?? 'NOK',
      input.userIdentifier ?? null,
      input.transactionId ?? null,
      input.pageUrl ?? null,
      input.referrer ?? null,
      input.userAgent ?? null,
      input.ipAddress ?? null,
    ],
  );

  // Bump last_fired_at på action
  if (actionId) {
    await pool.query(
      `UPDATE client_ads_actions SET last_fired_at = NOW() WHERE id = $1::uuid`,
      [actionId],
    );
  }

  // Note: Faktisk videresending til Google Ads via Measurement Protocol
  // (POST til /collect endpoint) implementeres som egen worker som
  // poller sent_to_google_ads = FALSE-events. For nå markeres som
  // mottatt — dedup + monitoring fungerer uavhengig.
  return { ok: true, eventId: e.rows[0].id, deduplicated: false };
}
