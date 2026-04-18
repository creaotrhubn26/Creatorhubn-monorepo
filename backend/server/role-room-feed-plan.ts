/**
 * Feed-plan persistence for the Role Room Agent's social feed planner addon.
 *
 * One plan per (projectId, platform). Posts are stored as an ordered JSONB
 * array so the UI owns the shape — the server validates shape loosely and
 * caps size to prevent runaway payloads.
 */

import type { Pool } from 'pg';

export type RoleRoomFeedPlatform = 'instagram' | 'tiktok' | 'linkedin';

export const SUPPORTED_FEED_PLATFORMS: readonly RoleRoomFeedPlatform[] = [
  'instagram',
  'tiktok',
  'linkedin',
] as const;

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
const MAX_CUSTOM_IMAGE_NAME_LENGTH = 200;

function clipString(value: unknown, max = MAX_STRING_LENGTH): string {
  if (typeof value !== 'string') return '';
  return value.length > max ? value.slice(0, max) : value;
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

  const customImageUrl =
    typeof record.customImageUrl === 'string' && record.customImageUrl.length > 0
      ? clipString(record.customImageUrl, MAX_CUSTOM_IMAGE_LENGTH)
      : null;
  const customImageName =
    typeof record.customImageName === 'string' && record.customImageName.length > 0
      ? clipString(record.customImageName, MAX_CUSTOM_IMAGE_NAME_LENGTH)
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
  };
}

export function normalizeFeedPostsPayload(raw: unknown): RoleRoomFeedPostInput[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, MAX_POSTS_PER_PLAN)
    .map((entry, index) => normalizePost(entry, index))
    .filter((entry): entry is RoleRoomFeedPostInput => entry !== null);
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

export function isSupportedPlatform(value: unknown): value is RoleRoomFeedPlatform {
  return typeof value === 'string' && SUPPORTED_FEED_PLATFORMS.includes(value as RoleRoomFeedPlatform);
}
