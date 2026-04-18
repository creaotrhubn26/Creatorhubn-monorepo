/**
 * Reusable post templates for the feed-planner.
 *
 * Templates store the editable shape of a feed-post (concept, title,
 * caption, hashtags, CTA, media type, logo placement, brand colors).
 * They are scoped per (project, platform) and owned by the user that
 * created them. Apply-template patches a target post in-place — the
 * post's customImageUrl is never touched, since images are per-post.
 */

import type { Pool } from 'pg';

export type RoleRoomFeedTemplatePlatform = 'instagram' | 'tiktok' | 'linkedin';

export interface RoleRoomFeedTemplatePayload {
  concept: string;
  title: string;
  caption: string;
  hashtags: string[];
  callToAction: string;
  imageStyle: string;
  backgroundColor: string | null;
  accentColor: string | null;
  textColor: string | null;
  logoPlacement: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center' | null;
  mediaType: 'image' | 'reel' | 'carousel';
}

export interface RoleRoomFeedTemplateRow {
  id: string;
  projectId: string;
  ownerUserId: string;
  platform: RoleRoomFeedTemplatePlatform;
  name: string;
  template: RoleRoomFeedTemplatePayload;
  createdAt: Date;
  updatedAt: Date;
}

const MAX_NAME_LENGTH = 80;
const MAX_HASHTAGS = 30;
const MAX_TEXT = 2000;

function clip(value: unknown, max = MAX_TEXT): string {
  if (typeof value !== 'string') return '';
  return value.length > max ? value.slice(0, max) : value;
}

export function normalizeTemplatePayload(raw: unknown): RoleRoomFeedTemplatePayload {
  const r = (raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {});
  const hashtagsRaw = Array.isArray(r.hashtags) ? r.hashtags : [];
  const hashtags = hashtagsRaw
    .slice(0, MAX_HASHTAGS)
    .map((entry) => clip(entry, 80))
    .filter((entry) => entry.length > 0);
  const mediaType = r.mediaType === 'reel' || r.mediaType === 'carousel' ? r.mediaType : 'image';
  const logoPlacement = (['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center'] as const).includes(
    r.logoPlacement as 'top-left',
  )
    ? (r.logoPlacement as RoleRoomFeedTemplatePayload['logoPlacement'])
    : null;
  return {
    concept: clip(r.concept, 120),
    title: clip(r.title, 200),
    caption: clip(r.caption, MAX_TEXT),
    hashtags,
    callToAction: clip(r.callToAction, 200),
    imageStyle: clip(r.imageStyle, 200),
    backgroundColor: typeof r.backgroundColor === 'string' ? clip(r.backgroundColor, 40) : null,
    accentColor: typeof r.accentColor === 'string' ? clip(r.accentColor, 40) : null,
    textColor: typeof r.textColor === 'string' ? clip(r.textColor, 40) : null,
    logoPlacement,
    mediaType,
  };
}

function mapRow(row: Record<string, unknown>): RoleRoomFeedTemplateRow {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    ownerUserId: String(row.owner_user_id),
    platform: row.platform as RoleRoomFeedTemplatePlatform,
    name: String(row.name),
    template: row.template as RoleRoomFeedTemplatePayload,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  };
}

export async function listTemplates(
  pool: Pool,
  projectId: string,
  platform: RoleRoomFeedTemplatePlatform,
): Promise<RoleRoomFeedTemplateRow[]> {
  try {
    const result = await pool.query(
      `SELECT id, project_id, owner_user_id, platform, name, template, created_at, updated_at
         FROM role_room_feed_post_templates
        WHERE project_id = $1 AND platform = $2 AND archived_at IS NULL
        ORDER BY updated_at DESC
        LIMIT 50`,
      [projectId, platform],
    );
    return result.rows.map(mapRow);
  } catch (error) {
    console.error('[role-room-feed-templates] list failed', error);
    return [];
  }
}

export async function createTemplate(
  pool: Pool,
  input: {
    projectId: string;
    ownerUserId: string;
    platform: RoleRoomFeedTemplatePlatform;
    name: string;
    template: RoleRoomFeedTemplatePayload;
  },
): Promise<RoleRoomFeedTemplateRow | null> {
  try {
    const result = await pool.query(
      `INSERT INTO role_room_feed_post_templates
         (project_id, owner_user_id, platform, name, template)
       VALUES ($1, $2, $3, $4, $5::jsonb)
       RETURNING id, project_id, owner_user_id, platform, name, template, created_at, updated_at`,
      [
        input.projectId,
        input.ownerUserId,
        input.platform,
        clip(input.name, MAX_NAME_LENGTH),
        JSON.stringify(normalizeTemplatePayload(input.template)),
      ],
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  } catch (error) {
    console.error('[role-room-feed-templates] create failed', error);
    return null;
  }
}

export async function archiveTemplate(
  pool: Pool,
  templateId: string,
  ownerUserId: string,
): Promise<boolean> {
  try {
    const result = await pool.query(
      `UPDATE role_room_feed_post_templates
          SET archived_at = now()
        WHERE id = $1 AND owner_user_id = $2 AND archived_at IS NULL`,
      [templateId, ownerUserId],
    );
    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    console.error('[role-room-feed-templates] archive failed', error);
    return false;
  }
}
