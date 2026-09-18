/**
 * Feed-plan persistence for the Role Room Agent's social feed planner addon.
 *
 * One plan per (projectId, platform). Posts are stored as an ordered JSONB
 * array so the UI owns the shape — the server validates shape loosely and
 * caps size to prevent runaway payloads.
 */

import type { Pool, PoolClient } from 'pg';

export type RoleRoomFeedPlatform = 'instagram' | 'tiktok' | 'linkedin';

export const SUPPORTED_FEED_PLATFORMS: readonly RoleRoomFeedPlatform[] = [
  'instagram',
  'tiktok',
  'linkedin',
] as const;

export type RoleRoomFeedApprovalState =
  | 'draft'
  | 'awaiting_client' // submitted to client for review (MedInnova-avtalen §5.1)
  | 'approved'
  | 'scheduled'
  | 'published'
  | 'rejected'
  | 'needs_changes';

const APPROVAL_STATES: ReadonlyArray<RoleRoomFeedApprovalState> = [
  'draft',
  'awaiting_client',
  'approved',
  'scheduled',
  'published',
  'rejected',
  'needs_changes',
];

export interface RoleRoomFeedPostInput {
  id: string;
  concept: string;
  title: string;
  caption: string;
  hashtags: string[];
  callToAction: string;
  imageStyle: string;
  scheduledFor?: string | null;
  backgroundColor?: string | null;
  accentColor?: string | null;
  textColor?: string | null;
  logoPlacement?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center' | null;
  mediaType?: 'image' | 'reel' | 'carousel';
  locked?: boolean;
  customImageUrl?: string | null;
  customImageName?: string | null;
  customImageUrls?: string[] | null;
  customImageNames?: string[] | null;
  customVideoDataUrl?: string | null;
  customVideoName?: string | null;
  // Grid-beskjæring + egendefinert cover/thumbnail (vises i feed-grid,
  // nettside-portfolio, deling & link-preview). gridAspect default '4:5'.
  gridAspect?: '1:1' | '4:5' | '16:9' | null;
  coverImageUrl?: string | null;
  coverImageName?: string | null;
  // Approval-flyt — bevarer state mellom save-rounds. Default 'draft'.
  approvalState?: RoleRoomFeedApprovalState;
  approvalChangedAt?: string | null;
  approvalChangedBy?: string | null;
  approvalNote?: string | null;
  // Klient-review-flyt (§5.1–5.2): når materiell sendes til kunden settes
  // reviewRequestedAt + reviewDeadline. Hvis kunden ikke svarer innen fristen
  // auto-godkjennes posten (§5.2).
  reviewRequestedAt?: string | null;
  reviewRequestedBy?: string | null;
  reviewDeadline?: string | null;
  // LinkedIn-spesifikk: hvis satt, publiser som bedrift i stedet for
  // som personlig profil. Format: 'urn:li:organization:12345'. Null
  // = publiser som @bruker. Settes via "Publiser som"-dropdown i UI.
  linkedInOrganizationUrn?: string | null;
  // Durable publisher metadata. These fields are system-owned and are
  // preserved when the producer autosaves an older editor snapshot.
  publishJobId?: string | null;
  publishedAt?: string | null;
  externalPostId?: string | null;
  publishedPermalink?: string | null;
}

export interface RoleRoomFeedPlanRow {
  id: string;
  projectId: string;
  platform: RoleRoomFeedPlatform;
  posts: RoleRoomFeedPostInput[];
  brandSnapshot: unknown | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const MAX_POSTS_PER_PLAN = 48;
const MAX_HASHTAGS_PER_POST = 30;
const MAX_STRING_LENGTH = 2000;
// Data URL for a 1080x1350 JPEG at quality 0.82 runs ~600-900KB; allow 2MB
// per post so high-detail photos still fit. Combined with MAX_POSTS_PER_PLAN
// this keeps plan payloads below the 50MB Express body limit.
const MAX_CUSTOM_IMAGE_LENGTH = 2_000_000;
const MAX_CUSTOM_IMAGE_BYTES = 1_500_000;
const MAX_CUSTOM_IMAGE_NAME_LENGTH = 200;
const MAX_CAROUSEL_IMAGES = 20;
const MIN_CAROUSEL_IMAGES = 2;
// Inline media is currently sent through the 50 MB JSON endpoint. Keep both
// one post and the complete plan below that ceiling (JSON/base64 overhead
// included) so autosave fails predictably instead of at Express' body parser.
const MAX_CUSTOM_VIDEO_LENGTH = 40_000_000;
const MAX_CUSTOM_VIDEO_BYTES = 30_000_000;
const MAX_INLINE_MEDIA_PER_POST_LENGTH = 42_000_000;
const MAX_INLINE_MEDIA_PER_PLAN_LENGTH = 45_000_000;

function clipString(value: unknown, max = MAX_STRING_LENGTH): string {
  if (typeof value !== 'string') return '';
  return value.length > max ? value.slice(0, max) : value;
}

function estimateBase64Bytes(value: string): number {
  const comma = value.indexOf(',');
  if (comma < 0) return Number.POSITIVE_INFINITY;
  const encoded = value.slice(comma + 1).replace(/\s/g, '');
  if (!encoded) return 0;
  const padding = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((encoded.length * 3) / 4) - padding);
}

function normalizeInlineDataUrl(
  value: unknown,
  kind: 'image' | 'video',
  maxLength: number,
  maxBytes: number,
): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > maxLength) {
    return null;
  }
  const comma = value.indexOf(',');
  if (comma <= 0 || comma > 160) return null;
  const header = value.slice(0, comma + 1);
  if (!new RegExp(`^data:${kind}/[a-z0-9+.-]+;base64,$`, 'i').test(header)) {
    return null;
  }
  return estimateBase64Bytes(value) <= maxBytes ? value : null;
}

function normalizeInlineImageValue(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  // Never truncate base64: a clipped data URL is corrupt and cannot be
  // published. Remote URLs can safely use the ordinary string cap.
  if (value.startsWith('data:')) {
    return normalizeInlineDataUrl(
      value,
      'image',
      MAX_CUSTOM_IMAGE_LENGTH,
      MAX_CUSTOM_IMAGE_BYTES,
    );
  }
  return clipString(value, MAX_CUSTOM_IMAGE_LENGTH);
}

function normalizePost(raw: unknown, fallbackIndex: number): RoleRoomFeedPostInput | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const id = typeof record.id === 'string' && record.id.trim() ? record.id : `post-${fallbackIndex}`;
  const hashtagsRaw = Array.isArray(record.hashtags) ? record.hashtags : [];
  const hashtags = hashtagsRaw
    .slice(0, MAX_HASHTAGS_PER_POST)
    .map((entry) => clipString(entry, 80))
    .filter((entry) => entry.length > 0);

  const mediaType = record.mediaType === 'reel' || record.mediaType === 'carousel' ? record.mediaType : 'image';
  const logoPlacement = (['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center'] as const).includes(
    record.logoPlacement as 'top-left',
  )
    ? (record.logoPlacement as RoleRoomFeedPostInput['logoPlacement'])
    : null;

  const customImageUrl = normalizeInlineImageValue(record.customImageUrl);
  const customImageName =
    typeof record.customImageName === 'string' && record.customImageName.length > 0
      ? clipString(record.customImageName, MAX_CUSTOM_IMAGE_NAME_LENGTH)
      : null;
  const rawCustomImageNames = Array.isArray(record.customImageNames)
    ? record.customImageNames
    : [];
  const rawCustomImageEntries = Array.isArray(record.customImageUrls)
    ? record.customImageUrls
        .slice(0, MAX_CAROUSEL_IMAGES)
        .map((value, index) => ({
          value: normalizeInlineImageValue(value),
          name:
            typeof rawCustomImageNames[index] === 'string'
              ? clipString(rawCustomImageNames[index], MAX_CUSTOM_IMAGE_NAME_LENGTH)
              : '',
        }))
        .filter((entry): entry is { value: string; name: string } => entry.value !== null)
    : [];
  let customImageUrls: string[] | null = null;
  let customImageNames: string[] | null = null;
  if (rawCustomImageEntries.length >= MIN_CAROUSEL_IMAGES) {
    let used = 0;
    const bounded = rawCustomImageEntries.filter((entry) => {
      if (used + entry.value.length > MAX_INLINE_MEDIA_PER_POST_LENGTH) return false;
      used += entry.value.length;
      return true;
    });
    if (bounded.length >= MIN_CAROUSEL_IMAGES) {
      customImageUrls = bounded.map((entry) => entry.value);
      customImageNames = bounded.map((entry) => entry.name);
    }
  }
  const customVideoDataUrl = normalizeInlineDataUrl(
    record.customVideoDataUrl,
    'video',
    MAX_CUSTOM_VIDEO_LENGTH,
    MAX_CUSTOM_VIDEO_BYTES,
  );
  const customVideoName = customVideoDataUrl && typeof record.customVideoName === 'string'
    ? clipString(record.customVideoName, MAX_CUSTOM_IMAGE_NAME_LENGTH)
    : null;

  const approvalState =
    typeof record.approvalState === 'string' &&
    (APPROVAL_STATES as readonly string[]).includes(record.approvalState)
      ? (record.approvalState as RoleRoomFeedApprovalState)
      : 'draft';

  const gridAspect =
    record.gridAspect === '1:1' || record.gridAspect === '4:5' || record.gridAspect === '16:9'
      ? record.gridAspect
      : null;
  const coverImageUrl = normalizeInlineImageValue(record.coverImageUrl);
  const coverImageName =
    typeof record.coverImageName === 'string' && record.coverImageName.length > 0
      ? clipString(record.coverImageName, MAX_CUSTOM_IMAGE_NAME_LENGTH)
      : null;

  return {
    id,
    concept: clipString(record.concept, 120),
    title: clipString(record.title, 200),
    caption: clipString(record.caption, MAX_STRING_LENGTH),
    hashtags,
    callToAction: clipString(record.callToAction, 200),
    imageStyle: clipString(record.imageStyle, 200),
    scheduledFor: typeof record.scheduledFor === 'string' ? clipString(record.scheduledFor, 40) : null,
    backgroundColor: typeof record.backgroundColor === 'string' ? clipString(record.backgroundColor, 40) : null,
    accentColor: typeof record.accentColor === 'string' ? clipString(record.accentColor, 40) : null,
    textColor: typeof record.textColor === 'string' ? clipString(record.textColor, 40) : null,
    logoPlacement,
    mediaType,
    locked: Boolean(record.locked),
    customImageUrl,
    customImageName,
    customImageUrls,
    customImageNames,
    customVideoDataUrl,
    customVideoName,
    gridAspect,
    coverImageUrl,
    coverImageName,
    approvalState,
    approvalChangedAt:
      typeof record.approvalChangedAt === 'string' ? clipString(record.approvalChangedAt, 40) : null,
    approvalChangedBy:
      typeof record.approvalChangedBy === 'string' ? clipString(record.approvalChangedBy, 200) : null,
    approvalNote:
      typeof record.approvalNote === 'string' ? clipString(record.approvalNote, 1000) : null,
    reviewRequestedAt:
      typeof record.reviewRequestedAt === 'string' ? clipString(record.reviewRequestedAt, 40) : null,
    reviewRequestedBy:
      typeof record.reviewRequestedBy === 'string' ? clipString(record.reviewRequestedBy, 200) : null,
    reviewDeadline:
      typeof record.reviewDeadline === 'string' ? clipString(record.reviewDeadline, 40) : null,
    linkedInOrganizationUrn:
      typeof record.linkedInOrganizationUrn === 'string' &&
      record.linkedInOrganizationUrn.startsWith('urn:li:organization:')
        ? clipString(record.linkedInOrganizationUrn, 200)
        : null,
    publishJobId:
      typeof record.publishJobId === 'string' ? clipString(record.publishJobId, 200) : null,
    publishedAt:
      typeof record.publishedAt === 'string' ? clipString(record.publishedAt, 40) : null,
    externalPostId:
      typeof record.externalPostId === 'string' ? clipString(record.externalPostId, 500) : null,
    publishedPermalink:
      typeof record.publishedPermalink === 'string' ? clipString(record.publishedPermalink, 2000) : null,
  };
}

export function normalizeFeedPostsPayload(raw: unknown): RoleRoomFeedPostInput[] {
  if (!Array.isArray(raw)) return [];
  const posts = raw
    .slice(0, MAX_POSTS_PER_PLAN)
    .map((entry, index) => normalizePost(entry, index))
    .filter((entry): entry is RoleRoomFeedPostInput => entry !== null);
  let remainingInlineMedia = MAX_INLINE_MEDIA_PER_PLAN_LENGTH;
  const keepWithinPlanBudget = (value: string | null | undefined): string | null => {
    if (!value) return null;
    if (!value.startsWith('data:')) return value;
    if (value.length > remainingInlineMedia) return null;
    remainingInlineMedia -= value.length;
    return value;
  };
  return posts.map((post) => {
    const customImageUrl = keepWithinPlanBudget(post.customImageUrl);
    const coverImageUrl = keepWithinPlanBudget(post.coverImageUrl);
    const carouselLength = (post.customImageUrls ?? []).reduce(
      (total, value) => total + (value.startsWith('data:') ? value.length : 0),
      0,
    );
    const customImageUrls = carouselLength <= remainingInlineMedia
      ? post.customImageUrls ?? null
      : null;
    if (customImageUrls) remainingInlineMedia -= carouselLength;
    const customVideoDataUrl = keepWithinPlanBudget(post.customVideoDataUrl);
    return {
      ...post,
      customImageUrl,
      customImageName: customImageUrl ? post.customImageName ?? null : null,
      coverImageUrl,
      coverImageName: coverImageUrl ? post.coverImageName ?? null : null,
      customImageUrls,
      customImageNames: customImageUrls ? post.customImageNames ?? null : null,
      customVideoDataUrl,
      customVideoName: customVideoDataUrl ? post.customVideoName ?? null : null,
    };
  });
}

function mapRow(row: Record<string, unknown>): RoleRoomFeedPlanRow {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    platform: row.platform as RoleRoomFeedPlatform,
    posts: Array.isArray(row.posts) ? (row.posts as RoleRoomFeedPostInput[]) : [],
    brandSnapshot: row.brand_snapshot ?? null,
    updatedBy: (row.updated_by as string | null) ?? null,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  };
}

export async function loadFeedPlan(
  pool: Pool,
  projectId: string,
  platform: RoleRoomFeedPlatform,
): Promise<RoleRoomFeedPlanRow | null> {
  try {
    const result = await pool.query(
      `SELECT id, project_id, platform, posts, brand_snapshot, updated_by, created_at, updated_at
       FROM role_room_feed_plans
       WHERE project_id = $1 AND platform = $2
       LIMIT 1`,
      [projectId, platform],
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  } catch (error) {
    console.error('[role-room-feed-plan] loadFeedPlan failed', error);
    return null;
  }
}

export async function saveFeedPlan(
  pool: Pool,
  projectId: string,
  platform: RoleRoomFeedPlatform,
  posts: RoleRoomFeedPostInput[],
  options: { brandSnapshot?: unknown; updatedBy?: string | null } = {},
): Promise<RoleRoomFeedPlanRow | null> {
  try {
    const result = await pool.query(
      `INSERT INTO role_room_feed_plans (project_id, platform, posts, brand_snapshot, updated_by, updated_at)
       VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, now())
       ON CONFLICT (project_id, platform) DO UPDATE SET
         posts = EXCLUDED.posts,
         brand_snapshot = EXCLUDED.brand_snapshot,
         updated_by = EXCLUDED.updated_by,
         updated_at = now()
       RETURNING id, project_id, platform, posts, brand_snapshot, updated_by, created_at, updated_at`,
      [
        projectId,
        platform,
        JSON.stringify(posts),
        options.brandSnapshot === undefined ? null : JSON.stringify(options.brandSnapshot),
        options.updatedBy ?? null,
      ],
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  } catch (error) {
    console.error('[role-room-feed-plan] saveFeedPlan failed', error);
    return null;
  }
}

export interface FeedPlanMutationResult {
  posts: RoleRoomFeedPostInput[];
  /** Omit (undefined) to preserve the persisted brand_snapshot. */
  brandSnapshot?: unknown;
  updatedBy?: string | null;
}

/**
 * Transactional read-modify-write for a single feed plan. Takes a
 * transaction-scoped advisory lock keyed by (projectId, platform) at the very
 * start of the transaction — before the SELECT — so mutations serialize even
 * when no plan row exists yet. The SELECT … FOR UPDATE then locks the row when
 * it does exist. The mutator gets the freshly-locked current row (or null if
 * the plan doesn't exist) and returns the next posts; returning null aborts the
 * write and the call resolves to the unchanged current row.
 *
 * First-creates are serialized too: two concurrent first-writers for the same
 * (project_id, platform) block on pg_advisory_xact_lock, so one fully completes
 * (read empty → insert) before the other reads, and the second sees the
 * freshly-inserted row instead of racing through ON CONFLICT. The advisory lock
 * auto-releases on COMMIT/ROLLBACK — no manual unlock or migration needed.
 */
export async function mutateFeedPlanLocked(
  pool: Pool,
  projectId: string,
  platform: RoleRoomFeedPlatform,
  mutate: (current: RoleRoomFeedPlanRow | null) => FeedPlanMutationResult | null,
): Promise<RoleRoomFeedPlanRow | null> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Transaction-scoped advisory lock keyed by (projectId, platform) so even
    // first-creates serialize: a non-existent row can't be locked by FOR UPDATE,
    // so without this two concurrent first-writers would race through ON CONFLICT
    // (last writer wins). Auto-releases on COMMIT/ROLLBACK.
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `${projectId}::${platform}`,
    ]);
    const existing = await client.query(
      `SELECT id, project_id, platform, posts, brand_snapshot, updated_by, created_at, updated_at
         FROM role_room_feed_plans
        WHERE project_id = $1 AND platform = $2
        LIMIT 1
        FOR UPDATE`,
      [projectId, platform],
    );
    const current = existing.rows[0] ? mapRow(existing.rows[0]) : null;
    const next = mutate(current);
    if (!next) {
      await client.query('ROLLBACK');
      return current;
    }
    const brandToWrite =
      next.brandSnapshot === undefined ? current?.brandSnapshot ?? null : next.brandSnapshot;
    const result = await client.query(
      `INSERT INTO role_room_feed_plans (project_id, platform, posts, brand_snapshot, updated_by, updated_at)
       VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, now())
       ON CONFLICT (project_id, platform) DO UPDATE SET
         posts = EXCLUDED.posts,
         brand_snapshot = EXCLUDED.brand_snapshot,
         updated_by = EXCLUDED.updated_by,
         updated_at = now()
       RETURNING id, project_id, platform, posts, brand_snapshot, updated_by, created_at, updated_at`,
      [
        projectId,
        platform,
        JSON.stringify(next.posts),
        brandToWrite === null || brandToWrite === undefined ? null : JSON.stringify(brandToWrite),
        next.updatedBy ?? null,
      ],
    );
    await client.query('COMMIT');
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore rollback failure */
    }
    console.error('[role-room-feed-plan] mutateFeedPlanLocked failed', error);
    return null;
  } finally {
    client.release();
  }
}

// Approval/review fields form a state machine owned exclusively by the
// /approve and /submit-review endpoints (and the auto-approve sweep). A
// producer content-save must never carry these — see
// mergeFeedPostsPreservingApproval.
const PRESERVED_APPROVAL_KEYS = [
  'approvalState',
  'approvalChangedAt',
  'approvalChangedBy',
  'approvalNote',
  'reviewRequestedAt',
  'reviewRequestedBy',
  'reviewDeadline',
  'publishJobId',
  'publishedAt',
  'externalPostId',
  'publishedPermalink',
] as const;

/**
 * Merge producer-supplied posts with the persisted plan so a content save
 * (caption/image/order edits) can never overwrite the approval/review state.
 * For each incoming post that already exists, the persisted approval fields
 * win; brand-new posts keep their incoming (default 'draft') values. This is
 * what stops a producer's stale auto-save from silently wiping a client's
 * approval made on another surface.
 */
export function mergeFeedPostsPreservingApproval(
  incoming: RoleRoomFeedPostInput[],
  current: RoleRoomFeedPostInput[] | null | undefined,
): RoleRoomFeedPostInput[] {
  if (!current || current.length === 0) return incoming;
  const byId = new Map(current.map((p) => [p.id, p]));
  return incoming.map((post) => {
    const prev = byId.get(post.id);
    if (!prev) return post;
    const merged: RoleRoomFeedPostInput = { ...post };
    for (const key of PRESERVED_APPROVAL_KEYS) {
      (merged as unknown as Record<string, unknown>)[key] =
        (prev as unknown as Record<string, unknown>)[key] ?? null;
    }
    return merged;
  });
}

export function isSupportedPlatform(value: unknown): value is RoleRoomFeedPlatform {
  return typeof value === 'string' && SUPPORTED_FEED_PLATFORMS.includes(value as RoleRoomFeedPlatform);
}

/**
 * All feed plans that contain at least one post awaiting client review.
 * JSONB containment keeps the scan cheap. Used by the auto-approve sweep (§5.2).
 */
export async function listFeedPlansAwaitingClient(
  pool: Pool,
  limit = 500,
): Promise<RoleRoomFeedPlanRow[]> {
  try {
    const result = await pool.query(
      `SELECT id, project_id, platform, posts, brand_snapshot, updated_by, created_at, updated_at
         FROM role_room_feed_plans
        WHERE posts @> '[{"approvalState":"awaiting_client"}]'::jsonb
        ORDER BY updated_at DESC
        LIMIT $1`,
      [limit],
    );
    return result.rows.map(mapRow);
  } catch (error) {
    console.error('[role-room-feed-plan] listFeedPlansAwaitingClient failed', error);
    return [];
  }
}

/**
 * Marker en feed-plan-post som "trenger endring" fordi publish feilet
 * permanent (etter alle retry-forsøk). Setter approvalState='needs_changes'
 * + approvalNote med error-årsaken. Idempotent — kjøres trygt uansett om
 * planen finnes.
 *
 * Brukes av publish-worker for å lukke visibility-loopen: når en post
 * feiler å publiseres, dukker den opp i Approvals-widgeten med en tydelig
 * forklaring brukeren kan handle på.
 */
export async function markFeedPlanPostFailed(
  pool: Pool,
  projectId: string,
  feedPlanPostId: string,
  errorMessage: string,
): Promise<{ touched: boolean }> {
  if (!projectId || !feedPlanPostId) return { touched: false };
  // Vi prøver alle støttede plattformer fordi posten kan ligge under
  // hvilken som helst (IG og FB-Page deler 'instagram'-key i tabellen).
  for (const platform of SUPPORTED_FEED_PLATFORMS) {
    try {
      let found = false;
      const updated = await mutateFeedPlanLocked(pool, projectId, platform, (current) => {
        if (!current) return null;
        const idx = current.posts.findIndex((p) => p.id === feedPlanPostId);
        if (idx === -1) return null;
        found = true;
        const now = new Date().toISOString();
        const nextPosts = current.posts.map((p, i) =>
          i === idx
            ? {
                ...p,
                approvalState: 'needs_changes' as RoleRoomFeedApprovalState,
                approvalChangedAt: now,
                approvalChangedBy: 'system:publish-worker',
                approvalNote: `Publisering feilet: ${errorMessage.slice(0, 800)}`,
              }
            : p,
        );
        return { posts: nextPosts, updatedBy: 'system:publish-worker' };
      });
      if (found && updated) return { touched: true };
    } catch (error) {
      console.warn(
        `[feed-plan] markFeedPlanPostFailed failed for ${projectId}/${platform}/${feedPlanPostId}`,
        error,
      );
    }
  }
  return { touched: false };
}

/**
 * Moves one LinkedIn feed-plan post to scheduled after the durable queue row
 * exists. The locked mutation prevents an autosave from racing this state.
 */
export async function markFeedPlanPostScheduled(
  pool: Pool,
  projectId: string,
  feedPlanPostId: string,
  jobId: string,
  scheduledFor: Date,
  changedBy: string,
): Promise<{ touched: boolean }> {
  if (!projectId || !feedPlanPostId || !jobId) return { touched: false };
  let found = false;
  const updated = await mutateFeedPlanLocked(pool, projectId, 'linkedin', (current) => {
    if (!current) return null;
    const target = current.posts.find((post) => post.id === feedPlanPostId);
    if (!target || (target.approvalState ?? 'draft') !== 'approved') return null;
    found = true;
    const now = new Date().toISOString();
    return {
      posts: current.posts.map((post) =>
        post.id === feedPlanPostId
          ? {
              ...post,
              scheduledFor: scheduledFor.toISOString(),
              approvalState: 'scheduled' as RoleRoomFeedApprovalState,
              approvalChangedAt: now,
              approvalChangedBy: changedBy,
              approvalNote: null,
              publishJobId: jobId,
            }
          : post,
      ),
      updatedBy: changedBy,
    };
  });
  return { touched: found && Boolean(updated) };
}

/**
 * Transaction-local variant used by the durable LinkedIn queue. The caller
 * owns BEGIN/COMMIT. Taking the same advisory lock as mutateFeedPlanLocked
 * makes the queue INSERT and the approval-state transition one atomic unit,
 * while the locked re-check closes the approve/reject race at publish time.
 */
export async function markFeedPlanPostScheduledInTransaction(
  client: Pick<PoolClient, 'query'>,
  projectId: string,
  feedPlanPostId: string,
  jobId: string,
  scheduledFor: Date,
  changedBy: string,
): Promise<{ touched: boolean }> {
  if (!projectId || !feedPlanPostId || !jobId) return { touched: false };
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
    `${projectId}::linkedin`,
  ]);
  const existing = await client.query(
    `SELECT id, project_id, platform, posts, brand_snapshot, updated_by, created_at, updated_at
       FROM role_room_feed_plans
      WHERE project_id = $1 AND platform = 'linkedin'
      LIMIT 1
      FOR UPDATE`,
    [projectId],
  );
  if (!existing.rows[0]) return { touched: false };
  const current = mapRow(existing.rows[0]);
  const target = current.posts.find((post) => post.id === feedPlanPostId);
  if (!target || (target.approvalState ?? 'draft') !== 'approved') {
    return { touched: false };
  }
  const now = new Date().toISOString();
  const posts = current.posts.map((post) =>
    post.id === feedPlanPostId
      ? {
          ...post,
          scheduledFor: scheduledFor.toISOString(),
          approvalState: 'scheduled' as RoleRoomFeedApprovalState,
          approvalChangedAt: now,
          approvalChangedBy: changedBy,
          approvalNote: null,
          publishJobId: jobId,
        }
      : post,
  );
  const updated = await client.query(
    `UPDATE role_room_feed_plans
        SET posts = $3::jsonb,
            updated_by = $4,
            updated_at = NOW()
      WHERE project_id = $1 AND platform = $2
      RETURNING id`,
    [projectId, 'linkedin', JSON.stringify(posts), changedBy],
  );
  return { touched: (updated.rowCount ?? updated.rows.length) > 0 };
}

/** Records a successful LinkedIn publish on the canonical feed-plan row. */
export async function markFeedPlanPostPublished(
  pool: Pool,
  projectId: string,
  feedPlanPostId: string,
  result: {
    jobId?: string | null;
    externalPostId?: string | null;
    permalink?: string | null;
    changedBy: string;
  },
): Promise<{ touched: boolean }> {
  if (!projectId || !feedPlanPostId) return { touched: false };
  let found = false;
  const updated = await mutateFeedPlanLocked(pool, projectId, 'linkedin', (current) => {
    if (!current) return null;
    if (!current.posts.some((post) => post.id === feedPlanPostId)) return null;
    found = true;
    const now = new Date().toISOString();
    return {
      posts: current.posts.map((post) =>
        post.id === feedPlanPostId
          ? {
              ...post,
              approvalState: 'published' as RoleRoomFeedApprovalState,
              approvalChangedAt: now,
              approvalChangedBy: result.changedBy,
              approvalNote: null,
              publishJobId: result.jobId ?? post.publishJobId ?? null,
              publishedAt: now,
              externalPostId: result.externalPostId ?? null,
              publishedPermalink: result.permalink ?? null,
            }
          : post,
      ),
      updatedBy: result.changedBy,
    };
  });
  return { touched: found && Boolean(updated) };
}
