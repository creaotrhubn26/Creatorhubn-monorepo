/**
 * google-calendar-project.ts
 *
 * Pusher fotograf-prosjektets event_date inn i fotografens Google Calendar
 * når prosjekt opprettes/oppdateres. Bruker samme OAuth-pattern som
 * google-meet.ts (role_room_google_connections + AES-decrypt av tokens).
 *
 * Beste innsats — feiler stille hvis Google-tilkobling mangler eller er
 * utløpt. Prosjekt-API-et fortsetter å funke selv om kalender-sync feiler.
 */

import crypto from 'crypto';
import { google } from 'googleapis';
import type { Pool } from 'pg';
import {
  type GoogleWorkspaceOauthApp,
  getGoogleWorkspaceOauthConfig,
  normalizeGoogleWorkspaceOauthApp,
} from './google-workspace-oauth.js';

type GoogleConnectionRow = {
  google_email: string | null;
  access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
  expiry_date: string | null;
  oauth_app: string | null;
};

function deriveServiceEncryptionKey(): Buffer | null {
  const secret = process.env.ROLE_ROOM_GOOGLE_TOKEN_ENCRYPTION_KEY
    || process.env.ROLE_ROOM_ENCRYPTION_KEY
    || process.env.SESSION_SECRET
    || process.env.JWT_SECRET
    || process.env.AUTH_SECRET;
  if (!secret) return null;
  return crypto.createHash('sha256').update(secret).digest();
}

function decryptToken(value: string | null | undefined): string | null {
  if (!value) return null;
  const key = deriveServiceEncryptionKey();
  if (!key) return null;
  try {
    const buf = Buffer.from(value, 'base64');
    // AES-256-GCM: iv(12) + tag(16) + ciphertext
    if (buf.length < 28) return null;
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const ct = buf.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(ct), decipher.final()]);
    return plain.toString('utf8');
  } catch {
    return null;
  }
}

export async function loadGoogleCredentials(pool: Pool, userId: string): Promise<{
  oauthClient: InstanceType<typeof google.auth.OAuth2>;
  googleEmail: string | null;
} | null> {
  const result = await pool.query<GoogleConnectionRow>(
    `SELECT google_email, access_token_encrypted, refresh_token_encrypted, expiry_date, oauth_app
       FROM role_room_google_connections
      WHERE connection_state = 'connected'
        AND user_id = $1
        AND (refresh_token_encrypted IS NOT NULL OR access_token_encrypted IS NOT NULL)
      ORDER BY
        CASE WHEN refresh_token_encrypted IS NOT NULL THEN 0 ELSE 1 END,
        last_used_at DESC NULLS LAST,
        updated_at DESC NULLS LAST
      LIMIT 1`,
    [userId],
  ).catch(() => ({ rows: [] as GoogleConnectionRow[] }));

  const row = result.rows[0];
  if (!row) return null;

  const oauthApp = normalizeGoogleWorkspaceOauthApp(row.oauth_app, 'role_room') as GoogleWorkspaceOauthApp;
  const oauthConfig = getGoogleWorkspaceOauthConfig(oauthApp);
  if (!oauthConfig.clientId || !oauthConfig.clientSecret) return null;

  const refreshToken = decryptToken(row.refresh_token_encrypted);
  const accessToken = decryptToken(row.access_token_encrypted);
  if (!refreshToken && !accessToken) return null;

  const oauthClient = new google.auth.OAuth2(
    oauthConfig.clientId,
    oauthConfig.clientSecret,
    oauthConfig.redirectUri ?? 'http://localhost:5050/api/creatorhub/google/oauth/callback',
  );

  const tokenSeed: { refresh_token?: string; access_token?: string; expiry_date?: number } = {};
  if (refreshToken) tokenSeed.refresh_token = refreshToken;
  if (accessToken) tokenSeed.access_token = accessToken;
  if (row.expiry_date) {
    const expiryTs = Date.parse(row.expiry_date);
    if (Number.isFinite(expiryTs)) tokenSeed.expiry_date = expiryTs;
  }
  oauthClient.setCredentials(tokenSeed);

  if (refreshToken) {
    const expiringSoon = !Number.isFinite(tokenSeed.expiry_date) || (tokenSeed.expiry_date ?? 0) <= Date.now() + 60_000;
    if (expiringSoon) {
      oauthClient.setCredentials({ refresh_token: refreshToken });
      await oauthClient.refreshAccessToken().catch(() => undefined);
    }
  }

  return { oauthClient, googleEmail: row.google_email ?? null };
}

export interface SyncProjectEventInput {
  photographerId: string;
  projectId: string;
  title: string;
  eventDate: string | null;       // YYYY-MM-DD; null = slett event
  location?: string | null;
  description?: string | null;
  clientName?: string | null;
  clientEmail?: string | null;
  existingEventId?: string | null;
}

export interface SyncProjectEventResult {
  eventId: string | null;
  action: 'created' | 'updated' | 'deleted' | 'noop' | 'skipped';
  reason?: string;
}

/**
 * Sync prosjekt-event til Google Calendar. Returnerer eventId hvis vi
 * lagret/oppdaterte, null hvis vi slettet eller hoppet over.
 *
 * Beste innsats — kaster ALDRI for å beskytte prosjekt-API-et. Loggfører
 * feil til console.warn med kategori.
 */
export async function syncProjectCalendarEvent(
  pool: Pool,
  input: SyncProjectEventInput,
): Promise<SyncProjectEventResult> {
  try {
    const creds = await loadGoogleCredentials(pool, input.photographerId);
    if (!creds) {
      return { eventId: input.existingEventId ?? null, action: 'skipped', reason: 'no_google_connection' };
    }

    const calendarApi = google.calendar({ version: 'v3', auth: creds.oauthClient });

    // Slett-case: event_date er fjernet, men vi har eksisterende event
    if (!input.eventDate && input.existingEventId) {
      await calendarApi.events.delete({
        calendarId: 'primary',
        eventId: input.existingEventId,
      }).catch((err) => {
        console.warn('[calendar-sync] delete failed (vil prøve på nytt senere):', err?.message);
      });
      return { eventId: null, action: 'deleted' };
    }

    if (!input.eventDate) {
      return { eventId: null, action: 'noop', reason: 'no_event_date' };
    }

    // Bygg event-body. All-day event (date, ikke dateTime) siden vi kun
    // har dato på prosjektet.
    const summary = input.clientName
      ? `📷 ${input.title} – ${input.clientName}`
      : `📷 ${input.title}`;

    const descriptionParts = [
      input.description,
      input.clientName ? `Klient: ${input.clientName}` : null,
      input.clientEmail ? `Epost: ${input.clientEmail}` : null,
      `Prosjekt-id: ${input.projectId}`,
      'Opprettet av Creatorhubn',
    ].filter(Boolean);

    const eventBody = {
      summary,
      location: input.location ?? undefined,
      description: descriptionParts.join('\n'),
      start: { date: input.eventDate },
      end: { date: input.eventDate },
      extendedProperties: {
        private: {
          source: 'creatorhubn_photographer_project',
          projectId: input.projectId,
        },
      },
    };

    // Update-case
    if (input.existingEventId) {
      try {
        const updated = await calendarApi.events.patch({
          calendarId: 'primary',
          eventId: input.existingEventId,
          requestBody: eventBody,
        });
        return { eventId: updated.data.id ?? input.existingEventId, action: 'updated' };
      } catch (err: any) {
        // Hvis eventet er slettet i Google, opprett nytt
        if (err?.code === 404 || err?.code === 410) {
          // fall through til create
        } else {
          console.warn('[calendar-sync] update failed:', err?.message);
          return { eventId: input.existingEventId, action: 'skipped', reason: 'update_failed' };
        }
      }
    }

    // Create-case
    const created = await calendarApi.events.insert({
      calendarId: 'primary',
      requestBody: eventBody,
    });
    return { eventId: created.data.id ?? null, action: 'created' };
  } catch (err: any) {
    console.warn('[calendar-sync] failed:', err?.message);
    return { eventId: input.existingEventId ?? null, action: 'skipped', reason: 'exception' };
  }
}
