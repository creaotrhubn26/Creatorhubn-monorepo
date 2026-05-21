import crypto from 'crypto';
import { google } from 'googleapis';
import type { Pool } from 'pg';
import {
  type GoogleWorkspaceOauthApp,
  getGoogleWorkspaceOauthConfig,
  normalizeGoogleWorkspaceOauthApp,
} from './google-workspace-oauth.js';

type RoleRoomGoogleConnectionRow = {
  user_id: string | null;
  google_email: string | null;
  google_subject: string | null;
  access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
  expiry_date: string | null;
  oauth_app: string | null;
};

type GoogleMeetPayload = {
  title?: string | null;
  description?: string | null;
  date?: string | null;
  time?: string | null;
  duration?: number | string | null;
  startDateTime?: string | null;
  endDateTime?: string | null;
  participants?: unknown;
  attendees?: unknown;
  projectId?: string | null;
  projectName?: string | null;
  clientName?: string | null;
  calendarId?: string | null;
  timeZone?: string | null;
};

export type GoogleMeetCreationResult = {
  success: true;
  meetLink: string;
  title: string;
  scheduledAt: string;
  calendarEventId: string | null;
  webViewUrl: string | null;
};

function readStringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readPositiveNumber(value: unknown, fallback: number): number {
  const candidate = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(candidate) && candidate > 0 ? candidate : fallback;
}

function deriveRoleRoomServiceEncryptionKey(): Buffer | null {
  const secret = readStringValue(
    process.env.ROLE_ROOM_GOOGLE_TOKEN_ENCRYPTION_KEY
    ?? process.env.ROLE_ROOM_ENCRYPTION_KEY
    ?? process.env.SESSION_SECRET
    ?? process.env.JWT_SECRET
    ?? process.env.AUTH_SECRET,
  );
  if (!secret) {
    return null;
  }
  return crypto.createHash('sha256').update(secret).digest();
}

// Slice 9X.80 — delegerer til shared dekryptor som støtter alle historiske formater
import { decryptGoogleToken as _decryptGoogleToken } from './google-oauth-shared.js';
function decryptRoleRoomGoogleToken(value: string | null | undefined): string | null {
  return _decryptGoogleToken(value);
}

function shouldForceGoogleAccessTokenRefresh(expiryDate?: number | null): boolean {
  return !Number.isFinite(expiryDate) || Number(expiryDate) <= Date.now() + 60_000;
}

async function resolveRoleRoomGoogleCredentialSource(
  pool: Pool,
  preferredUserId?: string | null,
  preferredOauthApps: GoogleWorkspaceOauthApp[] = ['creatorhub', 'role_room'],
) {
  const params: string[] = [];
  const filters = [
    `connection_state = 'connected'`,
    `(refresh_token_encrypted IS NOT NULL OR access_token_encrypted IS NOT NULL)`,
  ];

  if (preferredUserId) {
    params.push(preferredUserId);
    filters.push(`user_id = $${params.length}`);
  }

  const result = await pool.query<RoleRoomGoogleConnectionRow>(
    `SELECT user_id, google_email, google_subject, access_token_encrypted, refresh_token_encrypted, expiry_date, oauth_app
     FROM role_room_google_connections
     WHERE ${filters.join(' AND ')}
     ORDER BY
       CASE WHEN refresh_token_encrypted IS NOT NULL THEN 0 ELSE 1 END,
       last_used_at DESC NULLS LAST,
       updated_at DESC NULLS LAST,
       created_at DESC NULLS LAST
     LIMIT 10`,
    params,
  );

  if (!result.rows.length) {
    throw new Error('Google Workspace er ikke koblet til denne brukeren.');
  }

  const row =
    preferredOauthApps
      .map((preferredApp) =>
        result.rows.find(
          (entry) => normalizeGoogleWorkspaceOauthApp(entry.oauth_app, 'role_room') === preferredApp,
        ),
      )
      .find((entry): entry is RoleRoomGoogleConnectionRow => Boolean(entry))
    ?? result.rows[0];
  const oauthApp = normalizeGoogleWorkspaceOauthApp(row.oauth_app, 'role_room');
  const oauthConfig = getGoogleWorkspaceOauthConfig(oauthApp);
  if (!oauthConfig.clientId || !oauthConfig.clientSecret) {
    throw new Error(
      oauthApp === 'creatorhub'
        ? 'CreatorHub Google OAuth-klienten mangler i backend-env.'
        : 'The Role Room Google OAuth-klienten mangler i backend-env.',
    );
  }
  const refreshToken = decryptRoleRoomGoogleToken(row.refresh_token_encrypted);
  const accessToken = decryptRoleRoomGoogleToken(row.access_token_encrypted);

  if (!refreshToken && !accessToken) {
    throw new Error('Google-tilkoblingen mangler gyldige tokens.');
  }

  return {
    clientId: oauthConfig.clientId,
    clientSecret: oauthConfig.clientSecret,
    redirectUri: oauthConfig.redirectUri,
    refreshToken,
    accessToken,
    expiryDate: readStringValue(row.expiry_date),
    googleEmail: readStringValue(row.google_email),
    googleSubject: readStringValue(row.google_subject),
    userId: readStringValue(row.user_id),  // Slice 9X.80 — needs_reauth-tracking
  };
}

function normalizeAttendees(payload: GoogleMeetPayload): Array<{ email: string }> {
  const rawCandidates = [
    ...(Array.isArray(payload.participants) ? payload.participants : []),
    ...(Array.isArray(payload.attendees) ? payload.attendees : []),
  ];

  const emails = rawCandidates
    .map((value) => {
      if (typeof value === 'string') {
        return value.trim();
      }
      if (value && typeof value === 'object') {
        return readStringValue((value as { email?: unknown }).email) ?? '';
      }
      return '';
    })
    .filter((email) => email.length > 0);

  return [...new Set(emails)].map((email) => ({ email }));
}

function resolveMeetingWindow(payload: GoogleMeetPayload) {
  const timeZone = readStringValue(payload.timeZone) ?? process.env.TZ ?? 'Europe/Oslo';
  const durationMinutes = readPositiveNumber(payload.duration, 30);

  let start = readStringValue(payload.startDateTime)
    ? new Date(readStringValue(payload.startDateTime)!)
    : null;

  if (!start && readStringValue(payload.date)) {
    const date = readStringValue(payload.date)!;
    const time = readStringValue(payload.time) ?? '09:00';
    start = new Date(`${date}T${time}`);
  }

  if (!start || Number.isNaN(start.getTime())) {
    start = new Date(Date.now() + 2 * 60 * 1000);
  }

  let end = readStringValue(payload.endDateTime)
    ? new Date(readStringValue(payload.endDateTime)!)
    : null;

  if (!end || Number.isNaN(end.getTime()) || end.getTime() <= start.getTime()) {
    end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  }

  return {
    startDateTime: start.toISOString(),
    endDateTime: end.toISOString(),
    timeZone,
  };
}

function extractMeetLink(event: Record<string, unknown> | null | undefined): string | null {
  const directLink = readStringValue(event?.hangoutLink);
  if (directLink) {
    return directLink;
  }

  const conferenceData = event?.conferenceData;
  if (!conferenceData || typeof conferenceData !== 'object') {
    return null;
  }

  const entryPoints = Array.isArray((conferenceData as { entryPoints?: unknown[] }).entryPoints)
    ? (conferenceData as { entryPoints: Array<Record<string, unknown>> }).entryPoints
    : [];

  const videoEntry = entryPoints.find((entry) => readStringValue(entry.entryPointType) === 'video');
  return readStringValue(videoEntry?.uri);
}

function normalizeGoogleMeetError(error: unknown): string {
  const rawMessage = error instanceof Error ? error.message : String(error ?? 'Google Meet-feil');
  const responseData = (error as { response?: { data?: unknown } } | undefined)?.response?.data;
  const responseMessage = typeof responseData === 'string' ? responseData : JSON.stringify(responseData ?? {});
  const combined = `${rawMessage} ${responseMessage}`.toLowerCase();

  if (combined.includes('invalid_grant')) {
    return 'Google Workspace-tokenet er utløpt og må kobles til på nytt.';
  }
  if (combined.includes('insufficient permissions') || combined.includes('forbidden')) {
    return 'Google Workspace-koblingen mangler Calendar/Meet-rettigheter.';
  }
  if (combined.includes('not found')) {
    return 'Google Calendar eller Meet-oppsettet ble ikke funnet for denne brukeren.';
  }

  return rawMessage;
}

export async function createGoogleMeetLink(
  pool: Pool,
  payload: GoogleMeetPayload,
  preferredUserId?: string | null,
  options?: {
    preferredOauthApps?: GoogleWorkspaceOauthApp[];
  },
): Promise<GoogleMeetCreationResult> {
  try {
    const credentialSource = await resolveRoleRoomGoogleCredentialSource(
      pool,
      preferredUserId,
      options?.preferredOauthApps,
    );
    const oauthClient = new google.auth.OAuth2(
      credentialSource.clientId,
      credentialSource.clientSecret,
      credentialSource.redirectUri ?? 'http://localhost:5050/api/creatorhub/google/oauth/callback',
    );

    const tokenSeed: {
      refresh_token?: string;
      access_token?: string;
      expiry_date?: number;
    } = {};

    if (credentialSource.refreshToken) {
      tokenSeed.refresh_token = credentialSource.refreshToken;
    }
    if (credentialSource.accessToken) {
      tokenSeed.access_token = credentialSource.accessToken;
    }
    if (credentialSource.expiryDate) {
      const expiryTimestamp = Date.parse(credentialSource.expiryDate);
      if (Number.isFinite(expiryTimestamp)) {
        tokenSeed.expiry_date = expiryTimestamp;
      }
    }

    oauthClient.setCredentials(tokenSeed);

    if (tokenSeed.refresh_token) {
      if (shouldForceGoogleAccessTokenRefresh(tokenSeed.expiry_date)) {
        oauthClient.setCredentials({ refresh_token: tokenSeed.refresh_token });
        // Slice 9X.80 — wrapper markerer needs_reauth ved invalid_grant
        const { refreshAccessTokenWithStateTracking } = await import('./google-oauth-shared.js');
        await refreshAccessTokenWithStateTracking(oauthClient, {
          pool,
          userId: (credentialSource as any).userId ?? preferredUserId ?? null,
          context: 'google_meet_refresh',
        });
      } else {
        await oauthClient.getAccessToken();
      }
    } else if (!tokenSeed.access_token) {
      throw new Error('Google-tilkoblingen mangler refresh-token og access-token.');
    }

    const { startDateTime, endDateTime, timeZone } = resolveMeetingWindow(payload);
    const attendees = normalizeAttendees(payload);
    const title =
      readStringValue(payload.title)
      ?? (readStringValue(payload.clientName) ? `Møte med ${readStringValue(payload.clientName)}` : 'CreatorHub møte');
    const description = [
      readStringValue(payload.description),
      readStringValue(payload.projectName) ? `Prosjekt: ${readStringValue(payload.projectName)}` : null,
      credentialSource.googleEmail ? `Opprettet av: ${credentialSource.googleEmail}` : null,
    ].filter(Boolean).join('\n');

    const calendarApi = google.calendar({ version: 'v3', auth: oauthClient });
    const response = await calendarApi.events.insert({
      calendarId: readStringValue(payload.calendarId) ?? 'primary',
      conferenceDataVersion: 1,
      sendUpdates: attendees.length > 0 ? 'all' : 'none',
      requestBody: {
        summary: title,
        description: description || undefined,
        start: {
          dateTime: startDateTime,
          timeZone,
        },
        end: {
          dateTime: endDateTime,
          timeZone,
        },
        attendees,
        conferenceData: {
          createRequest: {
            requestId: crypto.randomUUID(),
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
        extendedProperties: {
          private: {
            source: 'creatorhub_google_meet',
            projectId: readStringValue(payload.projectId) ?? '',
          },
        },
      },
    });

    const eventData = response.data as Record<string, unknown>;
    const meetLink = extractMeetLink(eventData);
    if (!meetLink) {
      throw new Error('Google svarte uten en Meet-lenke.');
    }

    return {
      success: true,
      meetLink,
      title,
      scheduledAt: startDateTime,
      calendarEventId: readStringValue(eventData.id),
      webViewUrl: readStringValue(eventData.htmlLink),
    };
  } catch (error) {
    throw new Error(normalizeGoogleMeetError(error));
  }
}
