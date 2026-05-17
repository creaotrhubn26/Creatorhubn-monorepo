/**
 * chat-gmail-poller.ts
 *
 * Henter inn klient-svar fra fotografens Gmail når Stine trigger refresh
 * på chat-panelet. Matcher mot tråd-IDene vi satte i Message-ID-headeren
 * da vi sendte ut chat-meldingen, så vi vet at innkommende er svar på
 * VÅR chat (ikke andre klient-eposter).
 *
 * Krever Gmail readonly-scope. Hvis fotografen ikke har gitt det,
 * returnerer helperen graceful "no_scope"-feil som chat-panelet viser.
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

async function loadGmailCredentials(pool: Pool, userId: string): Promise<{
  oauthClient: InstanceType<typeof google.auth.OAuth2>;
} | null> {
  const result = await pool.query<GoogleConnectionRow>(
    `SELECT google_email, access_token_encrypted, refresh_token_encrypted, expiry_date, oauth_app
       FROM role_room_google_connections
      WHERE connection_state = 'connected'
        AND user_id = $1
        AND (refresh_token_encrypted IS NOT NULL OR access_token_encrypted IS NOT NULL)
      ORDER BY
        CASE WHEN refresh_token_encrypted IS NOT NULL THEN 0 ELSE 1 END,
        last_used_at DESC NULLS LAST
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

  return { oauthClient };
}

function header(headers: Array<{ name?: string | null; value?: string | null }> | undefined, key: string): string | null {
  if (!headers) return null;
  const lower = key.toLowerCase();
  const h = headers.find((h) => (h.name ?? '').toLowerCase() === lower);
  return h?.value ?? null;
}

/**
 * Dekoder Gmail base64url-encoded body til utf-8 string.
 * Plukker text/plain hvis tilgjengelig, ellers strip-HTML-text fra text/html.
 */
function extractPlainBody(payload: any): string {
  function decodePart(part: any): string {
    if (part?.body?.data) {
      const b64 = String(part.body.data).replace(/-/g, '+').replace(/_/g, '/');
      try {
        return Buffer.from(b64, 'base64').toString('utf-8');
      } catch {
        return '';
      }
    }
    return '';
  }

  function findPart(part: any, mime: string): any | null {
    if (!part) return null;
    if ((part.mimeType || '').toLowerCase() === mime) return part;
    if (Array.isArray(part.parts)) {
      for (const p of part.parts) {
        const found = findPart(p, mime);
        if (found) return found;
      }
    }
    return null;
  }

  const plain = findPart(payload, 'text/plain');
  if (plain) return decodePart(plain).trim();
  const html = findPart(payload, 'text/html');
  if (html) {
    const raw = decodePart(html);
    // Naiv HTML-strip: fjern tags + decode common entities
    return raw
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\n\s*\n\s*\n+/g, '\n\n')
      .trim();
  }
  return '';
}

/**
 * Strip quoted-reply-text. Gmail-svar inkluderer ofte "On <dato>, X wrote:" +
 * den opprinnelige meldingen som quote. Vi vil bare ha den NYE teksten.
 */
function stripQuotedReply(body: string): string {
  // Vanlige norske + engelske quote-markers
  const markers = [
    /\nOn\s+\d.*wrote:[\s\S]*/i,
    /\nFra:\s+.*[\s\S]*/i,
    /\nDen\s+\d.*skrev:[\s\S]*/i,
    /\n>+\s.*[\s\S]*/,
    /\n-----+\s*Original [Mm]essage\s*-----+[\s\S]*/,
  ];
  let result = body;
  for (const re of markers) {
    result = result.replace(re, '');
  }
  return result.trim();
}

export interface PollResult {
  status: 'ok' | 'no_credentials' | 'no_scope' | 'no_outbound' | 'failed';
  newRepliesCount: number;
  message?: string;
}

/**
 * Hent klient-svar fra Gmail som matcher chat-tråden for ett prosjekt.
 * Idempotent — gjentatt kall introduserer ikke duplikater (sjekker mot
 * google_email_id i client_communications).
 */
export async function pollProjectGmailReplies(
  pool: Pool,
  args: {
    photographerId: string;
    projectId: string;
  },
): Promise<PollResult> {
  // Hent prosjekt-info + klient-email + alle våre tidligere outbound message-ids
  const ctxQ = await pool.query(
    `SELECT
       p.title, p.client_id,
       c.email AS client_email,
       COALESCE(c.first_name || ' ' || c.last_name, p.client_name, c.email) AS client_display
     FROM projects p
     LEFT JOIN clients c ON c.id = p.client_id
     WHERE p.id = $1 AND p.user_id = $2 LIMIT 1`,
    [args.projectId, args.photographerId],
  );
  if (ctxQ.rowCount === 0) {
    return { status: 'failed', newRepliesCount: 0, message: 'project_not_found' };
  }
  const ctx = ctxQ.rows[0];
  if (!ctx.client_email) {
    return { status: 'failed', newRepliesCount: 0, message: 'no_client_email' };
  }

  const outboundQ = await pool.query(
    `SELECT google_email_id FROM client_communications
      WHERE project_id = $1 AND direction = 'outbound'
        AND google_email_id IS NOT NULL`,
    [args.projectId],
  );
  const outboundMessageIds = new Set(
    outboundQ.rows
      .map((r: Record<string, unknown>) => String(r.google_email_id ?? '').trim())
      .filter((s) => s.length > 0),
  );

  if (outboundMessageIds.size === 0) {
    // Ingen utgående meldinger ennå — ingenting å matche svar mot
    return { status: 'no_outbound', newRepliesCount: 0 };
  }

  // Last credentials
  const creds = await loadGmailCredentials(pool, args.photographerId);
  if (!creds) {
    return {
      status: 'no_credentials',
      newRepliesCount: 0,
      message: 'Google Workspace ikke koblet. Koble til via innstillinger for å motta klient-svar i chat.',
    };
  }

  const gmail = google.gmail({ version: 'v1', auth: creds.oauthClient });

  // Søk Gmail etter mail fra klient siste 90 dager
  const ninetyDaysAgo = Math.floor((Date.now() - 90 * 86400_000) / 1000);
  const query = `from:${ctx.client_email} after:${ninetyDaysAgo}`;
  let listResult;
  try {
    listResult = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 50,
    });
  } catch (err: any) {
    // 403 = scope mangler
    if (err?.code === 403 || err?.response?.status === 403) {
      return {
        status: 'no_scope',
        newRepliesCount: 0,
        message: 'Mangler gmail.readonly-tilgang. Koble til Google på nytt og godkjenn lese-tilgang.',
      };
    }
    console.warn('[chat-poll] Gmail list failed:', err?.message);
    return { status: 'failed', newRepliesCount: 0, message: String(err?.message ?? err).slice(0, 200) };
  }

  const candidateIds = (listResult.data.messages ?? []).map((m) => m.id).filter((id): id is string => !!id);
  if (candidateIds.length === 0) {
    return { status: 'ok', newRepliesCount: 0 };
  }

  // Fetch hver kandidat, sjekk om In-Reply-To matcher våre outbound ids
  let newCount = 0;
  for (const messageId of candidateIds.slice(0, 30)) { // cap 30 per refresh
    try {
      const msg = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      });

      const headers = msg.data.payload?.headers ?? [];
      const messageIdHeader = header(headers, 'Message-ID') ?? header(headers, 'Message-Id');
      const inReplyTo = header(headers, 'In-Reply-To');
      const references = header(headers, 'References') ?? '';
      const subjectHeader = header(headers, 'Subject');

      if (!messageIdHeader) continue;
      // Sjekk om den allerede er importert
      const exists = await pool.query(
        `SELECT 1 FROM client_communications WHERE google_email_id = $1 LIMIT 1`,
        [messageIdHeader],
      );
      if ((exists.rowCount ?? 0) > 0) continue;

      // Sjekk om in-reply-to/references peker på en av våre outbound IDs
      const refsAndReply = `${inReplyTo ?? ''} ${references}`;
      const matchesOurThread = Array.from(outboundMessageIds).some((id) => refsAndReply.includes(id));
      if (!matchesOurThread) continue;

      const body = stripQuotedReply(extractPlainBody(msg.data.payload));
      if (!body) continue;

      // Insert som inbound
      await pool.query(
        `INSERT INTO client_communications
           (user_id, client_id, project_id, communication_type, direction,
            subject, content, from_email, to_email, status, requires_response,
            priority, category, tags, universal_thread_id, is_universal_chat,
            google_email_id, google_thread_id, created_at)
         VALUES ($1, $2, $3, 'chat', 'inbound',
                 $4, $5, $6, $7, 'unread', true,
                 'normal', 'chat', ARRAY['chat','inbound','gmail-sync'], $8, true,
                 $9, $10, NOW())`,
        [
          args.photographerId,
          ctx.client_id,
          args.projectId,
          subjectHeader || `Svar: ${ctx.title}`,
          body.slice(0, 10_000),
          ctx.client_email,
          header(headers, 'To') ?? null,
          `proj-${args.projectId}`,
          messageIdHeader,
          msg.data.threadId ?? null,
        ],
      );
      newCount++;
    } catch (err: any) {
      console.warn('[chat-poll] fetch message failed:', err?.message);
    }
  }

  return { status: 'ok', newRepliesCount: newCount };
}
