// capture-push.ts
//
// APNs push for CaptureApp (fotograf-appen). Gjenbruker den delte APNs-klienten
// (lead-map-apns-client.sendAPNs) med CaptureApp sin egen apns-topic — samme
// signeringsnøkkel gjelder alle bundle-ID-er på teamet.
//
// Leverer de hendelsene realtime-laget allerede kjenner (kunde signerte,
// likte/kommenterte bilder, redigerer ferdig, ny melding) SELV NÅR APPEN ER
// LUKKET, der WebSocket-realtime suspenderes av iOS.

import type { Pool } from "pg";
import { sendAPNs } from "./lead-map-apns-client";

const CAPTURE_TOPIC =
  process.env.APNS_CAPTURE_BUNDLE_ID ?? "com.creatorhubn.capture";

// notification_device_tokens deles med LeadMap; `app`-kolonnen skiller hvilken
// app (og dermed apns-topic) et token hører til. Lat selvheler siden Render
// ikke har preDeploy-migrasjon (samme mønster som lead-map).
let appColumnEnsured = false;
async function ensureAppColumn(pool: Pool): Promise<void> {
  if (appColumnEnsured) return;
  await pool.query(
    `ALTER TABLE notification_device_tokens
       ADD COLUMN IF NOT EXISTS app VARCHAR(20) NOT NULL DEFAULT 'leadmap'`,
  );
  appColumnEnsured = true;
}

/** Registrer/oppdater et APNs-token for CaptureApp-brukeren. */
export async function registerCaptureDeviceToken(
  pool: Pool,
  userId: string,
  token: string,
  opts: { deviceName?: string; appVersion?: string } = {},
): Promise<void> {
  await ensureAppColumn(pool);
  await pool.query(
    `INSERT INTO notification_device_tokens
       (user_id, platform, token, app, device_name, app_version, enabled, last_seen_at)
     VALUES ($1, 'apns', $2, 'capture', $3, $4, TRUE, NOW())
     ON CONFLICT (platform, token) DO UPDATE
       SET user_id = EXCLUDED.user_id, app = 'capture', enabled = TRUE,
           device_name = EXCLUDED.device_name, app_version = EXCLUDED.app_version,
           last_seen_at = NOW()`,
    [userId, token, opts.deviceName ?? null, opts.appVersion ?? null],
  );
}

/**
 * Send push til alle CaptureApp-enhetene til en fotograf. Deaktiverer tokens
 * APNs melder som ugyldige. Klar til å kalles fra hendelses-punktene
 * (kontrakt/tilbud signert, bilde likt, redigerer ferdig, ny melding).
 */
export async function sendCapturePush(
  pool: Pool,
  userId: string,
  title: string,
  body: string,
  customData?: Record<string, unknown>,
): Promise<{ sent: number; total: number }> {
  await ensureAppColumn(pool);
  const { rows } = await pool.query<{ token: string }>(
    `SELECT token FROM notification_device_tokens
     WHERE user_id = $1 AND platform = 'apns' AND app = 'capture' AND enabled = TRUE`,
    [userId],
  );
  let sent = 0;
  for (const row of rows) {
    const result = await sendAPNs(row.token, title, body, {
      topic: CAPTURE_TOPIC,
      customData,
    });
    if (result.sent) {
      sent += 1;
    } else if (
      result.reason &&
      /BadDeviceToken|Unregistered|410/.test(result.reason)
    ) {
      await pool.query(
        `UPDATE notification_device_tokens SET enabled = FALSE
         WHERE platform = 'apns' AND token = $1`,
        [row.token],
      );
    }
  }
  return { sent, total: rows.length };
}
