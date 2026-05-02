/**
 * Cross-platform social events: persistence + flattening helpers.
 *
 * Meta sender forskjellig payload per "field" (comments, mentions, story_insights,
 * messages-ordene). Vi flattener alt til en konsistent SocialEventInput-shape
 * og lagrer i social_events. Sentiment scores legges til lazily av en
 * batch-worker som plukker rader hvor sentiment_processed_at IS NULL.
 */

import type { Pool } from 'pg';
import type { SocialPlatform } from './social-publisher.js';

export type SocialEventKind =
  | 'comment'
  | 'reply'
  | 'mention'
  | 'dm'
  | 'reaction'
  | 'review'
  | 'tag'
  | 'share'
  | 'other';

export interface SocialEventInput {
  platform: SocialPlatform;
  accountId: string;
  connectionId?: string | null;
  externalEventId?: string | null;
  externalPostId?: string | null;
  externalThreadId?: string | null;
  kind: SocialEventKind;
  authorExternalId?: string | null;
  authorUsername?: string | null;
  authorDisplayName?: string | null;
  /** URL til forfatterens profil-bilde (når kjent). Brukes i Inbox-
   *  rendering. Null hvis vi ikke fikk hentet det fra plattformen. */
  authorAvatarUrl?: string | null;
  body?: string | null;
  language?: string | null;
  occurredAt?: Date | null;
  raw: Record<string, unknown>;
}

export async function persistSocialEvent(
  pool: Pool,
  input: SocialEventInput,
): Promise<{ inserted: boolean; id: string | null }> {
  try {
    const result = await pool.query<{ id: string }>(
      `INSERT INTO social_events (
         connection_id, platform, account_id, external_event_id,
         external_post_id, external_thread_id, kind,
         author_external_id, author_username, author_display_name, author_avatar_url,
         body, language, occurred_at, raw
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb
       )
       ON CONFLICT (platform, account_id, external_event_id)
         WHERE external_event_id IS NOT NULL
       DO NOTHING
       RETURNING id`,
      [
        input.connectionId ?? null,
        input.platform,
        input.accountId,
        input.externalEventId ?? null,
        input.externalPostId ?? null,
        input.externalThreadId ?? null,
        input.kind,
        input.authorExternalId ?? null,
        input.authorUsername ?? null,
        input.authorDisplayName ?? null,
        input.authorAvatarUrl ?? null,
        input.body ?? null,
        input.language ?? null,
        input.occurredAt ?? null,
        JSON.stringify(input.raw ?? {}),
      ],
    );
    return {
      inserted: (result.rowCount ?? 0) > 0,
      id: result.rows[0]?.id ?? null,
    };
  } catch (error) {
    console.warn('[social-events] insert failed', error);
    return { inserted: false, id: null };
  }
}

// ── Plattform-spesifikk flattening ─────────────────────────────────────

interface MetaIgEntry {
  id?: string;
  time?: number;
  changes?: Array<{
    field?: string;
    value?: Record<string, unknown>;
  }>;
}

interface MetaIgPayload {
  object?: string;
  entry?: MetaIgEntry[];
}

function readString(obj: Record<string, unknown> | undefined, key: string): string | null {
  if (!obj) return null;
  const v = obj[key];
  return typeof v === 'string' ? v : null;
}

function readNested(
  obj: Record<string, unknown> | undefined,
  key: string,
): Record<string, unknown> | null {
  if (!obj) return null;
  const v = obj[key];
  return v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

/**
 * Flatten Meta IG webhook payload til 0..n SocialEventInput-rader.
 * Håndterer comments, mentions, og kjente field-typer. Ukjente fields
 * lagres med kind='other' for audit.
 */
export function flattenIgWebhookEvent(
  payload: MetaIgPayload,
): SocialEventInput[] {
  const events: SocialEventInput[] = [];
  const entries = payload?.entry ?? [];

  for (const entry of entries) {
    const accountId = entry.id ?? '';
    if (!accountId) continue;
    const occurredAt = typeof entry.time === 'number' ? new Date(entry.time * 1000) : null;
    const changes = entry.changes ?? [];

    for (const change of changes) {
      const field = (change.field ?? '').trim();
      const value = (change.value ?? {}) as Record<string, unknown>;
      if (!field) continue;

      if (field === 'comments') {
        // Comment + reply (parent_id signaliserer reply)
        const isReply = Boolean(readString(value, 'parent_id'));
        const from = readNested(value, 'from');
        const media = readNested(value, 'media');
        events.push({
          platform: 'instagram',
          accountId,
          externalEventId: readString(value, 'id'),
          externalPostId: media ? readString(media, 'id') : null,
          externalThreadId: readString(value, 'parent_id'),
          kind: isReply ? 'reply' : 'comment',
          authorExternalId: from ? readString(from, 'id') : null,
          authorUsername: from ? readString(from, 'username') : null,
          body: readString(value, 'text'),
          occurredAt,
          raw: { field, ...value },
        });
        continue;
      }

      if (field === 'mentions') {
        // Mentions har media_id + comment_id (mention i en kommentar)
        // eller bare media_id (mention i caption på en story/post)
        events.push({
          platform: 'instagram',
          accountId,
          externalEventId: readString(value, 'comment_id') ?? readString(value, 'media_id'),
          externalPostId: readString(value, 'media_id'),
          kind: 'mention',
          occurredAt,
          raw: { field, ...value },
        });
        continue;
      }

      if (field === 'live_comments') {
        events.push({
          platform: 'instagram',
          accountId,
          externalEventId: readString(value, 'id'),
          externalPostId: readString(value, 'media_id'),
          kind: 'comment',
          authorUsername: readString(value, 'username'),
          body: readString(value, 'text'),
          occurredAt,
          raw: { field, ...value },
        });
        continue;
      }

      if (field === 'messages' || field === 'messaging_postbacks') {
        // IG Direct messages
        const sender = readNested(value, 'sender');
        const message = readNested(value, 'message');
        events.push({
          platform: 'instagram',
          accountId,
          externalEventId: message ? readString(message, 'mid') : null,
          externalThreadId: sender ? readString(sender, 'id') : null,
          kind: 'dm',
          authorExternalId: sender ? readString(sender, 'id') : null,
          body: message ? readString(message, 'text') : null,
          occurredAt,
          raw: { field, ...value },
        });
        continue;
      }

      // Ukjent field — lagre som 'other' for audit
      events.push({
        platform: 'instagram',
        accountId,
        kind: 'other',
        occurredAt,
        raw: { field, ...value },
      });
    }
  }

  return events;
}

/**
 * Tilsvarende for Facebook Page-webhooks. Field-typer: feed (posts +
 * comments + reactions), mention, messages.
 */
export function flattenFacebookPageWebhookEvent(
  payload: MetaIgPayload,
): SocialEventInput[] {
  const events: SocialEventInput[] = [];
  const entries = payload?.entry ?? [];

  for (const entry of entries) {
    const accountId = entry.id ?? '';
    if (!accountId) continue;
    const occurredAt = typeof entry.time === 'number' ? new Date(entry.time * 1000) : null;
    const changes = entry.changes ?? [];

    for (const change of changes) {
      const field = (change.field ?? '').trim();
      const value = (change.value ?? {}) as Record<string, unknown>;
      if (!field) continue;

      if (field === 'feed') {
        const item = readString(value, 'item'); // 'comment' | 'reaction' | 'post' | 'status'
        const verb = readString(value, 'verb'); // 'add' | 'remove' | 'edit'
        const from = readNested(value, 'from');

        if (item === 'comment' && verb === 'add') {
          events.push({
            platform: 'facebook_page',
            accountId,
            externalEventId: readString(value, 'comment_id'),
            externalPostId: readString(value, 'post_id'),
            externalThreadId: readString(value, 'parent_id'),
            kind: readString(value, 'parent_id') ? 'reply' : 'comment',
            authorExternalId: from ? readString(from, 'id') : null,
            authorDisplayName: from ? readString(from, 'name') : null,
            body: readString(value, 'message'),
            occurredAt,
            raw: { field, ...value },
          });
          continue;
        }

        if (item === 'reaction' && verb === 'add') {
          events.push({
            platform: 'facebook_page',
            accountId,
            externalEventId: `${readString(value, 'post_id')}_reaction_${from ? readString(from, 'id') : 'unknown'}`,
            externalPostId: readString(value, 'post_id'),
            kind: 'reaction',
            authorExternalId: from ? readString(from, 'id') : null,
            authorDisplayName: from ? readString(from, 'name') : null,
            body: readString(value, 'reaction_type'),
            occurredAt,
            raw: { field, ...value },
          });
          continue;
        }

        events.push({
          platform: 'facebook_page',
          accountId,
          kind: 'other',
          occurredAt,
          raw: { field, ...value },
        });
        continue;
      }

      if (field === 'mention') {
        events.push({
          platform: 'facebook_page',
          accountId,
          externalEventId: readString(value, 'post_id'),
          externalPostId: readString(value, 'post_id'),
          kind: 'mention',
          authorExternalId: readString(value, 'sender_id'),
          authorDisplayName: readString(value, 'sender_name'),
          body: readString(value, 'message'),
          occurredAt,
          raw: { field, ...value },
        });
        continue;
      }

      events.push({
        platform: 'facebook_page',
        accountId,
        kind: 'other',
        occurredAt,
        raw: { field, ...value },
      });
    }
  }

  return events;
}

export async function listPendingSentimentEvents(
  pool: Pool,
  limit: number = 50,
): Promise<Array<{
  id: string;
  platform: string;
  body: string | null;
  language: string | null;
}>> {
  try {
    const result = await pool.query<{
      id: string;
      platform: string;
      body: string | null;
      language: string | null;
    }>(
      `SELECT id, platform, body, language
         FROM social_events
        WHERE sentiment_processed_at IS NULL
          AND body IS NOT NULL
          AND length(body) > 0
        ORDER BY received_at ASC
        LIMIT $1`,
      [limit],
    );
    return result.rows;
  } catch (error) {
    console.warn('[social-events] listPendingSentimentEvents failed', error);
    return [];
  }
}

export async function setEventSentiment(
  pool: Pool,
  eventId: string,
  score: number,
  label: 'negative' | 'neutral' | 'positive' | 'mixed',
  model: string,
): Promise<void> {
  try {
    await pool.query(
      `UPDATE social_events
          SET sentiment_score = $2,
              sentiment_label = $3,
              sentiment_model = $4,
              sentiment_processed_at = now()
        WHERE id = $1`,
      [eventId, score, label, model],
    );
  } catch (error) {
    console.warn('[social-events] setEventSentiment failed', error);
  }
}
