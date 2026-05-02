/**
 * Periodisk worker som henter like/comment-counts for LinkedIn-poster
 * publisert siste N dager. LinkedIn har ingen webhook-funksjonalitet for
 * member-level posts, så polling er eneste vei til insights.
 *
 * Strategi:
 *   - Hver time skanner vi social_metrics for LinkedIn-publish-events
 *     siste 14 dager (engagement faller etter ~2 uker)
 *   - For hver post-URN kaller vi /v2/socialActions/{shareUrn}
 *   - Lagrer likes/comments som social_metrics-rader (post-scope)
 *   - Best-effort, idempotent — feiler stille uten å forstyrre andre workere
 *
 * No-op uten LinkedIn-konfig eller hvis ingen poster å polle.
 */

import crypto from 'node:crypto';
import type { Pool } from 'pg';
import { persistSocialEvent } from './social-events.js';

const SWEEP_INTERVAL_MS = 60 * 60 * 1000; // 1 time
const MAX_POSTS_PER_SWEEP = 50;
const POLL_WINDOW_DAYS = 14;
const LINKEDIN_SOCIAL_ACTIONS_BASE = 'https://api.linkedin.com/v2/socialActions';

function deriveLinkedInEncryptionKey(): Buffer | null {
  const secret =
    process.env.ROLE_ROOM_LINKEDIN_TOKEN_ENCRYPTION_KEY ?? process.env.AUTH_SECRET;
  if (!secret) return null;
  return crypto.createHash('sha256').update(secret).digest();
}

function decryptLinkedInToken(value: string | null | undefined): string | null {
  if (!value) return null;
  const key = deriveLinkedInEncryptionKey();
  if (!key) return null;
  const [version, ivPart, tagPart, encryptedPart] = value.split('.');
  if (version !== 'v1' || !ivPart || !tagPart || !encryptedPart) return null;
  try {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(ivPart, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedPart, 'base64url')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch {
    return null;
  }
}

interface LinkedInPostToPoll {
  external_post_id: string;
  account_id: string;
  user_id: string;
  connection_id: string;
}

async function listLinkedInPostsToPoll(
  pool: Pool,
  limit: number,
): Promise<LinkedInPostToPoll[]> {
  try {
    const result = await pool.query<{
      external_post_id: string;
      account_id: string;
      connection_id: string;
      user_id: string | null;
    }>(
      `SELECT DISTINCT ON (sm.external_post_id)
              sm.external_post_id, sm.account_id, sm.connection_id::text AS connection_id,
              li.user_id
         FROM social_metrics sm
         LEFT JOIN role_room_linkedin_connections li ON li.linkedin_member_id = sm.account_id
        WHERE sm.platform = 'linkedin'
          AND sm.metric_name = 'publish_count'
          AND sm.external_post_id IS NOT NULL
          AND sm.recorded_at >= now() - ($1 || ' days')::interval
        ORDER BY sm.external_post_id, sm.recorded_at DESC
        LIMIT $2`,
      [String(POLL_WINDOW_DAYS), limit],
    );
    return result.rows
      .filter((r): r is LinkedInPostToPoll & { user_id: string } => Boolean(r.user_id))
      .map((r) => ({
        external_post_id: r.external_post_id,
        account_id: r.account_id,
        user_id: r.user_id,
        connection_id: r.connection_id,
      }));
  } catch (error) {
    console.warn('[linkedin-insights] listLinkedInPostsToPoll failed', error);
    return [];
  }
}

async function getAccessTokenForUser(pool: Pool, userId: string): Promise<string | null> {
  try {
    const result = await pool.query<{ access_token_encrypted: string | null }>(
      `SELECT access_token_encrypted FROM role_room_linkedin_connections
        WHERE user_id = $1 AND connection_state IN ('connected', 'active')
        LIMIT 1`,
      [userId],
    );
    const enc = result.rows[0]?.access_token_encrypted;
    return decryptLinkedInToken(enc);
  } catch {
    return null;
  }
}

async function fetchSocialActions(
  shareUrn: string,
  accessToken: string,
): Promise<{
  likes: number | null;
  comments: number | null;
} | null> {
  try {
    const url = `${LINKEDIN_SOCIAL_ACTIONS_BASE}/${encodeURIComponent(`urn:li:ugcPost:${shareUrn}`)}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
    });
    if (!response.ok) {
      // 404 betyr posten finnes ikke (kanskje slettet) — ikke en feil vi
      // skal rope om. Andre statuser logges på debug.
      return null;
    }
    const body = (await response.json()) as {
      likesSummary?: { totalLikes?: number };
      commentsSummary?: { totalFirstLevelComments?: number };
    };
    return {
      likes:
        typeof body.likesSummary?.totalLikes === 'number'
          ? body.likesSummary.totalLikes
          : null,
      comments:
        typeof body.commentsSummary?.totalFirstLevelComments === 'number'
          ? body.commentsSummary.totalFirstLevelComments
          : null,
    };
  } catch (error) {
    console.warn('[linkedin-insights] fetchSocialActions threw', error);
    return null;
  }
}

interface LinkedInCommentItem {
  id: string; // urn:li:comment:(urn:li:ugcPost:xxx,123)
  actor: string; // urn:li:person:abc OR urn:li:organization:xyz
  message?: { text?: string };
  created?: { time?: number };
}

interface LinkedInLocalizedName {
  localized?: Record<string, string>;
  preferredLocale?: { country?: string; language?: string };
}

interface LinkedInImageElement {
  identifiers?: Array<{ identifier?: string }>;
  data?: Record<string, unknown>;
}

interface LinkedInDisplayImage {
  elements?: LinkedInImageElement[];
}

interface LinkedInPersonProfile {
  id?: string;
  firstName?: LinkedInLocalizedName;
  lastName?: LinkedInLocalizedName;
  profilePicture?: {
    'displayImage~'?: LinkedInDisplayImage;
  };
}

interface LinkedInOrganizationProfile {
  id?: string;
  localizedName?: string;
  vanityName?: string;
  logoV2?: {
    'original~'?: LinkedInDisplayImage;
  };
}

/**
 * Plukk URL fra et LinkedIn displayImage~ / logoV2.original~-objekt.
 * Bruker første tilgjengelige identifier (vanligvis high-res versjon).
 */
function pickAvatarUrl(displayImage: LinkedInDisplayImage | undefined): string | null {
  const elements = displayImage?.elements;
  if (!Array.isArray(elements) || elements.length === 0) return null;
  // LinkedIn returnerer vanligvis flere størrelser. Velg første tilgjengelige.
  for (const el of elements) {
    const identifiers = el?.identifiers;
    if (!Array.isArray(identifiers)) continue;
    for (const id of identifiers) {
      if (typeof id?.identifier === 'string' && id.identifier.startsWith('http')) {
        return id.identifier;
      }
    }
  }
  return null;
}

/**
 * Plukker bruker-vendt navn fra en LinkedIn localizedName-blokk. Velger
 * preferredLocale hvis den finnes i `localized`, faller tilbake til
 * første tilgjengelige verdi.
 */
function pickLocalizedName(
  block: LinkedInLocalizedName | undefined,
): string | null {
  if (!block?.localized) return null;
  const preferred =
    block.preferredLocale?.language && block.preferredLocale?.country
      ? `${block.preferredLocale.language}_${block.preferredLocale.country}`
      : null;
  if (preferred && typeof block.localized[preferred] === 'string') {
    return block.localized[preferred];
  }
  const firstKey = Object.keys(block.localized)[0];
  return firstKey ? block.localized[firstKey] ?? null : null;
}

export interface LinkedInAuthorProfile {
  name: string | null;
  avatarUrl: string | null;
}

/**
 * Resolver author-URN → navn + avatar fra /v2/people eller /v2/organizations.
 * LinkedIn rate-limiter person-lookups kraftig (~100/d per app), så vi
 * cacher aggressivt per sweep og short-circuit ved feil.
 *
 * Hvis vi ikke får navn, returnerer vi { name: null, avatarUrl: null } —
 * caller faller tilbake til URN-suffix som proxy.
 */
async function resolveLinkedInAuthor(
  actorUrn: string,
  accessToken: string,
): Promise<LinkedInAuthorProfile> {
  if (!actorUrn) return { name: null, avatarUrl: null };
  try {
    if (actorUrn.startsWith('urn:li:person:')) {
      const id = actorUrn.replace('urn:li:person:', '');
      const url = `https://api.linkedin.com/v2/people/(id:${encodeURIComponent(id)})?projection=(id,firstName,lastName,profilePicture(displayImage~:playableStreams))`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
        },
      });
      if (!response.ok) return { name: null, avatarUrl: null };
      const body = (await response.json()) as LinkedInPersonProfile;
      const first = pickLocalizedName(body.firstName);
      const last = pickLocalizedName(body.lastName);
      const full = [first, last].filter(Boolean).join(' ').trim();
      const avatarUrl = pickAvatarUrl(body.profilePicture?.['displayImage~']);
      return { name: full || null, avatarUrl };
    }
    if (actorUrn.startsWith('urn:li:organization:')) {
      const id = actorUrn.replace('urn:li:organization:', '');
      const url = `https://api.linkedin.com/v2/organizations/${encodeURIComponent(id)}?projection=(id,localizedName,vanityName,logoV2(original~:playableStreams))`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
        },
      });
      if (!response.ok) return { name: null, avatarUrl: null };
      const body = (await response.json()) as LinkedInOrganizationProfile;
      const name = body.localizedName ?? body.vanityName ?? null;
      const avatarUrl = pickAvatarUrl(body.logoV2?.['original~']);
      return { name, avatarUrl };
    }
    return { name: null, avatarUrl: null };
  } catch (error) {
    console.warn('[linkedin-insights] resolveLinkedInAuthor threw', error);
    return { name: null, avatarUrl: null };
  }
}

/**
 * Hent kommentarer for en LinkedIn-post. Returnerer opp til 50 nyeste.
 * LinkedIn paginerer med `start`+`count`; vi tar den første siden, som
 * dekker det meste av engasjementet på de fleste posts. Posts med 50+
 * kommentarer vil mangle eldre — kan utvides senere ved behov.
 */
async function fetchPostComments(
  shareUrn: string,
  accessToken: string,
): Promise<LinkedInCommentItem[]> {
  try {
    const fullUrn = `urn:li:ugcPost:${shareUrn}`;
    const url =
      `${LINKEDIN_SOCIAL_ACTIONS_BASE}/${encodeURIComponent(fullUrn)}/comments?count=50`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
    });
    if (!response.ok) return [];
    const body = (await response.json()) as { elements?: LinkedInCommentItem[] };
    return Array.isArray(body.elements) ? body.elements : [];
  } catch (error) {
    console.warn('[linkedin-insights] fetchPostComments threw', error);
    return [];
  }
}

/**
 * Persistér LinkedIn-kommentarer til social_events med resolved
 * author-name. Caching av name-lookups per sweep så vi ikke spammer
 * /v2/people for samme person på flere kommentarer. ON CONFLICT-dedup
 * sikrer idempotency.
 */
async function persistLinkedInComments(
  pool: Pool,
  post: LinkedInPostToPoll,
  comments: LinkedInCommentItem[],
  accessToken: string,
  authorCache: Map<string, LinkedInAuthorProfile>,
): Promise<number> {
  let inserted = 0;
  for (const comment of comments) {
    if (!comment.id) continue;
    const occurredAt =
      comment.created?.time && Number.isFinite(comment.created.time)
        ? new Date(comment.created.time)
        : null;

    // Resolver navn + avatar én gang per actor-URN per sweep
    let authorProfile: LinkedInAuthorProfile = { name: null, avatarUrl: null };
    if (comment.actor) {
      const cached = authorCache.get(comment.actor);
      if (cached !== undefined) {
        authorProfile = cached;
      } else {
        authorProfile = await resolveLinkedInAuthor(comment.actor, accessToken);
        authorCache.set(comment.actor, authorProfile);
      }
    }

    // URN-suffix som fallback proxy hvis name-lookup feilet
    const usernameProxy =
      typeof comment.actor === 'string' && comment.actor.startsWith('urn:li:person:')
        ? comment.actor.replace('urn:li:person:', '').slice(0, 24)
        : typeof comment.actor === 'string' && comment.actor.startsWith('urn:li:organization:')
          ? comment.actor.replace('urn:li:organization:', '').slice(0, 24)
          : null;

    const result = await persistSocialEvent(pool, {
      platform: 'linkedin',
      accountId: post.account_id,
      connectionId: post.connection_id,
      externalEventId: comment.id,
      externalPostId: post.external_post_id,
      kind: 'comment',
      authorExternalId: comment.actor ?? null,
      authorUsername: usernameProxy,
      authorDisplayName: authorProfile.name,
      authorAvatarUrl: authorProfile.avatarUrl,
      body: comment.message?.text ?? null,
      occurredAt,
      raw: comment as unknown as Record<string, unknown>,
    });
    if (result.inserted) inserted += 1;
  }
  return inserted;
}

/**
 * Backfill author_display_name + author_avatar_url for eksisterende
 * LinkedIn-events. Plukker rader hvor enten navn eller avatar mangler,
 * resolver dem batch-vis (max 20 per sweep) for å holde LinkedIn rate-
 * limit lavt. Idempotent — skriver kun til tomme felter.
 */
async function backfillLinkedInAuthorProfiles(
  pool: Pool,
  accessToken: string,
  authorCache: Map<string, LinkedInAuthorProfile>,
): Promise<number> {
  let updated = 0;
  try {
    const result = await pool.query<{
      id: string;
      author_external_id: string | null;
      author_display_name: string | null;
      author_avatar_url: string | null;
    }>(
      `SELECT id, author_external_id, author_display_name, author_avatar_url
         FROM social_events
        WHERE platform = 'linkedin'
          AND author_external_id IS NOT NULL
          AND (author_display_name IS NULL OR author_avatar_url IS NULL)
        ORDER BY received_at DESC
        LIMIT 20`,
    );
    for (const row of result.rows) {
      if (!row.author_external_id) continue;
      let profile = authorCache.get(row.author_external_id);
      if (profile === undefined) {
        profile = await resolveLinkedInAuthor(row.author_external_id, accessToken);
        authorCache.set(row.author_external_id, profile);
      }
      // Bygg dynamisk UPDATE basert på hva som faktisk mangler
      const sets: string[] = [];
      const values: unknown[] = [row.id];
      if (!row.author_display_name && profile.name) {
        sets.push(`author_display_name = $${values.length + 1}`);
        values.push(profile.name);
      }
      if (!row.author_avatar_url && profile.avatarUrl) {
        sets.push(`author_avatar_url = $${values.length + 1}`);
        values.push(profile.avatarUrl);
      }
      if (sets.length === 0) continue;
      try {
        await pool.query(
          `UPDATE social_events SET ${sets.join(', ')} WHERE id = $1`,
          values,
        );
        updated += 1;
      } catch (updateErr) {
        console.warn('[linkedin-insights] backfill update failed', updateErr);
      }
    }
  } catch (error) {
    console.warn('[linkedin-insights] backfillLinkedInAuthorProfiles query failed', error);
  }
  return updated;
}

async function recordPostMetrics(
  pool: Pool,
  post: LinkedInPostToPoll,
  metrics: { likes: number | null; comments: number | null },
): Promise<void> {
  const recordedAt = new Date();
  const rows: Array<{ name: string; value: number }> = [];
  if (metrics.likes != null) rows.push({ name: 'likes', value: metrics.likes });
  if (metrics.comments != null) rows.push({ name: 'comments', value: metrics.comments });
  for (const m of rows) {
    try {
      await pool.query(
        `INSERT INTO social_metrics
           (connection_id, platform, account_id, external_post_id, scope,
            metric_name, metric_value, recorded_at, raw)
         VALUES ($1, 'linkedin', $2, $3, 'post', $4, $5, $6, '{}'::jsonb)`,
        [
          post.connection_id,
          post.account_id,
          post.external_post_id,
          m.name,
          m.value,
          recordedAt,
        ],
      );
    } catch (error) {
      console.warn('[linkedin-insights] insert metric failed', error);
    }
  }
}

export async function sweepLinkedInInsights(
  pool: Pool,
): Promise<{
  polled: number;
  metricsUpdated: number;
  commentsInserted: number;
  namesResolved: number;
}> {
  const posts = await listLinkedInPostsToPoll(pool, MAX_POSTS_PER_SWEEP);
  if (posts.length === 0) {
    return { polled: 0, metricsUpdated: 0, commentsInserted: 0, namesResolved: 0 };
  }

  let metricsUpdated = 0;
  let commentsInserted = 0;
  let namesResolved = 0;
  // Cache token per bruker så vi ikke decrypt-er for hver post
  const tokenCache = new Map<string, string | null>();
  // Cache author-profile-lookups (navn + avatar) per sweep så vi ikke
  // spammer /v2/people for samme person på flere kommentarer (LinkedIn
  // rate-limiter ~100/d).
  const authorCache = new Map<string, LinkedInAuthorProfile>();

  for (const post of posts) {
    let token = tokenCache.get(post.user_id);
    if (token === undefined) {
      token = await getAccessTokenForUser(pool, post.user_id);
      tokenCache.set(post.user_id, token);
    }
    if (!token) continue;

    // Parallelle kall for like/comment-counts + faktiske kommentarer.
    // Counts brukes til Analytics dashboard. Kommentarene populerer
    // social_events slik at Inbox + sentiment-worker kan håndtere dem.
    const [actions, comments] = await Promise.all([
      fetchSocialActions(post.external_post_id, token),
      fetchPostComments(post.external_post_id, token),
    ]);

    if (actions && (actions.likes != null || actions.comments != null)) {
      await recordPostMetrics(pool, post, actions);
      metricsUpdated += 1;
    }
    if (comments.length > 0) {
      const inserted = await persistLinkedInComments(pool, post, comments, token, authorCache);
      commentsInserted += inserted;
    }
  }

  // Backfill: oppdatér eksisterende rader hvor navn eller avatar mangler.
  // Bruker første tilgjengelige token siden person-info ikke er
  // bruker-skopet (LinkedIn-API krever bare gyldig OAuth-token).
  const firstToken = Array.from(tokenCache.values()).find((t): t is string => Boolean(t));
  if (firstToken) {
    namesResolved = await backfillLinkedInAuthorProfiles(pool, firstToken, authorCache);
  }

  return { polled: posts.length, metricsUpdated, commentsInserted, namesResolved };
}

let workerHandle: NodeJS.Timeout | null = null;

export function startLinkedInInsightsWorker(pool: Pool): void {
  if (workerHandle) return;
  console.log('[linkedin-insights] starting (sweep every 1h, 14-day window)');
  workerHandle = setInterval(() => {
    sweepLinkedInInsights(pool)
      .then(({ polled, metricsUpdated, commentsInserted, namesResolved }) => {
        if (polled > 0 || namesResolved > 0) {
          console.log(
            `[linkedin-insights] sweep: polled=${polled} metricsUpdated=${metricsUpdated} commentsInserted=${commentsInserted} namesResolved=${namesResolved}`,
          );
        }
      })
      .catch((err) => {
        console.warn('[linkedin-insights] sweep threw', err);
      });
  }, SWEEP_INTERVAL_MS);
  // Første sweep 60s etter boot så vi ikke konkurrerer om DB ved oppstart
  setTimeout(() => {
    sweepLinkedInInsights(pool).catch(() => {});
  }, 60_000);
}

export function stopLinkedInInsightsWorker(): void {
  if (workerHandle) {
    clearInterval(workerHandle);
    workerHandle = null;
  }
}
