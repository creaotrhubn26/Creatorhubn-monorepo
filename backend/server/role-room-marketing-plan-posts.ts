/**
 * Marketing Plan Engine — 30-day post generator (Slice 2).
 *
 * Takes the persisted strategy + pillars from Slice 1, asks Claude to
 * draft N concrete posts (one per day, balanced across pillars) and
 * persists them to role_room_marketing_plan_posts.
 *
 * Each generated post carries everything the producer needs to go
 * from idea to published: hook, format, script/beat-sheet, caption
 * draft, CTA, primary platform + cross-post rules, and a KPI goal
 * inherited from the pillar when not specified explicitly.
 */

import crypto from 'node:crypto';
import type { Pool } from 'pg';
import type { MarketingPlanStrategy, PersistedPillar } from './role-room-marketing-plan.js';
import { logAIUsage } from './ai-usage-tracker.js';

const DEFAULT_MODEL = 'claude-sonnet-4-5';
const VALID_FORMATS = new Set([
  'reel', 'carousel', 'image', 'story', 'tiktok', 'linkedin_post', 'youtube_short',
]);
const VALID_PLATFORMS = new Set([
  'instagram', 'tiktok', 'linkedin', 'youtube', 'facebook',
]);
const VALID_KPI_PER = new Set(['post', 'week', 'month', 'quarter']);

// ── Shapes ──────────────────────────────────────────────────────────────

export interface GeneratedPlanPost {
  pillarId: string | null;
  sortOrder: number;
  dayOffset: number | null;
  hook: string;
  format: 'reel' | 'carousel' | 'image' | 'story' | 'tiktok' | 'linkedin_post' | 'youtube_short';
  script: string | null;
  captionDraft: string | null;
  callToAction: string | null;
  primaryPlatform: 'instagram' | 'tiktok' | 'linkedin' | 'youtube' | 'facebook' | null;
  crossPostPlan: Array<{ platform: string; delayDays: number; adaptationNote?: string }>;
  goalKpi: { metric: string; target: number; per: 'post' | 'week' | 'month' | 'quarter' } | null;
}

export interface PersistedPlanPost extends GeneratedPlanPost {
  id: string;
  planId: string;
  status: 'proposed' | 'scheduled' | 'published' | 'skipped';
  feedPlanPostId: string | null;
  scheduledFor: Date | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  // Preview-video (Cloudflare Stream primær, R2 fallback)
  previewStreamUid: string | null;
  previewStreamReady: boolean;
  previewStreamPlaybackUrl: string | null;
  previewStreamThumbnailUrl: string | null;
  previewStreamDurationSec: number | null;
  previewVideoR2Url: string | null;
  previewVideoUploadedAt: Date | null;
  clientReviewStatus: 'pending' | 'approved' | 'changes_requested';
  clientReviewAt: Date | null;
  clientReviewNote: string | null;
  lastEditedAt: Date | null;
  lastEditedByUserId: string | null;
  lastEditedByName: string | null;
  lastEditedByKind: 'team' | 'client' | null;
}

// ── Claude generation ───────────────────────────────────────────────────

function buildSystemPrompt(horizonDays: number): string {
  return [
    'You are The Role Room content planner.',
    `Your job: turn a marketing strategy + content pillars into ${horizonDays} concrete post ideas`,
    'the producer can execute against — each with the fields needed to go from idea to',
    'published without further planning.',
    '',
    'Output a JSON object — nothing else — matching exactly this TypeScript type:',
    '```',
    'type PostPlan = {',
    '  posts: Array<{',
    '    pillarIndex: number;      // 0-based index into the pillars array the user sent',
    '    dayOffset: number;         // 0..horizonDays-1, the day this post should go live',
    '    hook: string;              // 1-2 lines — what makes a scroller stop',
    '    format: "reel"|"carousel"|"image"|"story"|"tiktok"|"linkedin_post"|"youtube_short";',
    '    script: string;            // beat-sheet for reels; caption-level structure for static',
    '    captionDraft: string;      // first-pass caption the producer will edit',
    '    callToAction: string;      // concrete verb + outcome ("Book en befaring", not "lær mer")',
    '    primaryPlatform: "instagram"|"tiktok"|"linkedin"|"youtube"|"facebook";',
    '    crossPostPlan: Array<{ platform: string; delayDays: number; adaptationNote?: string }>;',
    '    goalKpi: { metric: string; target: number; per: "post"|"week"|"month"|"quarter" };',
    '  }>;',
    '};',
    '```',
    '',
    'Rules:',
    `- Produce exactly ${horizonDays} posts, sorted by dayOffset ascending.`,
    '- Balance pillars across days — no pillar goes 3+ days in a row.',
    '- Every hook is concrete and specific. Never "Did you know…?", never "5 tips for…".',
    '  Good: "Her er hva ingen sier om drilling-tillatelser i Oslo kommune".',
    '- Format matches the platform + channel strategy. Reels/shorts for tutorial-style,',
    '  carousel for step-by-steps, image+caption for announcements.',
    '- crossPostPlan respects the channel strategy. If secondary is ["tiktok","linkedin"]:',
    '  reel → tiktok +1 day (native-vertical), linkedin +3 days (captioned + subtitled).',
    '- CTAs are specific verbs with outcomes. "Kommenter med BRANSJE for en case-study" is',
    '  more measurable than "la oss vite hva du tenker".',
    '- Language matches the strategy\'s tone of voice — if tone is Norwegian bokmål, every',
    '  field is in Norwegian.',
    '- Target numbers are realistic for Norwegian SMB audience: saves per post 5-30,',
    '  reach per post 500-5000, engagement rate 2-6%.',
    '',
    'Return ONLY the JSON object. No markdown, no prose, no backticks.',
  ].join('\n');
}

function buildUserMessage(
  strategy: MarketingPlanStrategy,
  pillars: PersistedPillar[],
  horizonDays: number,
): string {
  const lines: string[] = [];
  lines.push('## Strategy');
  lines.push(`Value prop: ${strategy.positioning.valueProp}`);
  lines.push(`Differentiator: ${strategy.positioning.differentiator}`);
  lines.push(`Primary channel: ${strategy.channelStrategy.primary} @ ${strategy.channelStrategy.cadencePerWeek}/week`);
  if (strategy.channelStrategy.secondary.length) {
    lines.push(`Secondary channels: ${strategy.channelStrategy.secondary.join(', ')}`);
  }
  lines.push(`Channel reasoning: ${strategy.channelStrategy.reasoning}`);
  lines.push('');
  lines.push('## Tone of voice');
  lines.push(`Voice: ${strategy.toneOfVoice.voice}`);
  lines.push(`DO: ${strategy.toneOfVoice.dos.join(' · ')}`);
  lines.push(`DON'T: ${strategy.toneOfVoice.donts.join(' · ')}`);
  lines.push('');
  lines.push('## KPI targets');
  for (const kpi of strategy.kpiTargets) {
    lines.push(`- ${kpi.metric} ${kpi.target}/${kpi.per} — ${kpi.rationale}`);
  }
  lines.push('');
  lines.push(`## Pillars (${pillars.length})`);
  pillars.forEach((p, i) => {
    lines.push(`[${i}] ${p.name}`);
    lines.push(`    ${p.description}`);
    if (p.targetKpi) {
      lines.push(`    pillar-kpi: ${p.targetKpi.target} ${p.targetKpi.metric}/${p.targetKpi.per}`);
    }
  });
  lines.push('');
  lines.push(`## Horizon: ${horizonDays} days`);
  lines.push(`Generate exactly ${horizonDays} posts now.`);
  return lines.join('\n');
}

function parsePostsJson(text: string, expectedCount: number): GeneratedPlanPost[] | null {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
  const firstBrace = cleaned.indexOf('{');
  if (firstBrace < 0) return null;
  let depth = 0;
  let end = -1;
  for (let i = firstBrace; i < cleaned.length; i++) {
    const c = cleaned[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end < 0) return null;
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned.slice(firstBrace, end + 1));
  } catch {
    return null;
  }
  if (!Array.isArray(parsed?.posts)) return null;
  // We accept ±20% deviation from expected count; 30 asked → 24-36 OK.
  const minCount = Math.max(1, Math.floor(expectedCount * 0.8));
  const maxCount = Math.ceil(expectedCount * 1.2);
  if (parsed.posts.length < minCount || parsed.posts.length > maxCount) return null;

  const out: GeneratedPlanPost[] = [];
  for (let i = 0; i < parsed.posts.length; i++) {
    const p = parsed.posts[i];
    if (!p || typeof p !== 'object') continue;
    if (typeof p.hook !== 'string' || !p.hook.trim()) continue;
    if (!VALID_FORMATS.has(p.format)) continue;
    const primary = VALID_PLATFORMS.has(p.primaryPlatform) ? p.primaryPlatform : null;
    const goalKpi = p.goalKpi
      && typeof p.goalKpi.metric === 'string'
      && typeof p.goalKpi.target === 'number'
      && VALID_KPI_PER.has(p.goalKpi.per)
      ? p.goalKpi
      : null;
    const crossPosts = Array.isArray(p.crossPostPlan)
      ? p.crossPostPlan
          .filter((x: any) => x && typeof x.platform === 'string' && typeof x.delayDays === 'number')
          .map((x: any) => ({
            platform: String(x.platform),
            delayDays: Math.max(0, Math.round(x.delayDays)),
            adaptationNote: typeof x.adaptationNote === 'string' ? x.adaptationNote : undefined,
          }))
      : [];
    out.push({
      pillarIndex: typeof p.pillarIndex === 'number' ? p.pillarIndex : -1,
      sortOrder: i,
      dayOffset: typeof p.dayOffset === 'number' ? Math.max(0, Math.round(p.dayOffset)) : null,
      hook: p.hook.trim(),
      format: p.format,
      script: typeof p.script === 'string' ? p.script : null,
      captionDraft: typeof p.captionDraft === 'string' ? p.captionDraft : null,
      callToAction: typeof p.callToAction === 'string' ? p.callToAction : null,
      primaryPlatform: primary,
      crossPostPlan: crossPosts,
      goalKpi,
    } as GeneratedPlanPost & { pillarIndex: number });
  }
  // Re-number sortOrder contiguously after filtering.
  return out
    .sort((a, b) => (a.dayOffset ?? 0) - (b.dayOffset ?? 0))
    .map((p, i) => ({ ...p, sortOrder: i }));
}

export async function generatePlanPosts(input: {
  strategy: MarketingPlanStrategy;
  pillars: PersistedPillar[];
  horizonDays: number;
  model?: string;
}): Promise<{ posts: GeneratedPlanPost[]; model: string; pillarIndexToId: Map<number, string> } | null> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('[marketing-plan-posts] ANTHROPIC_API_KEY missing');
    return null;
  }
  const model = input.model || process.env.ROLE_ROOM_MARKETING_PLAN_MODEL || DEFAULT_MODEL;
  let client: { messages: { create: Function } };
  try {
    // @ts-ignore — optional SDK
    const mod: any = await import('@anthropic-ai/sdk');
    const AnthropicCtor = mod.default ?? mod.Anthropic;
    client = new AnthropicCtor({ apiKey: process.env.ANTHROPIC_API_KEY });
  } catch (error) {
    console.error('[marketing-plan-posts] SDK unavailable', error);
    return null;
  }

  // Map 0-based pillar index → pillar id so we can resolve the LLM's
  // pillarIndex field to a real FK before persisting.
  const pillarIndexToId = new Map<number, string>();
  input.pillars.forEach((p, i) => pillarIndexToId.set(i, p.id as unknown as string));

  try {
    const response: any = await client.messages.create({
      model,
      max_tokens: 8192,
      system: [
        {
          type: 'text',
          text: buildSystemPrompt(input.horizonDays),
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: buildUserMessage(input.strategy, input.pillars, input.horizonDays) }],
    });
    logAIUsage(response, { feature: 'role-room/marketing-posts' }).catch(() => undefined);
    let text = '';
    for (const block of response.content ?? []) {
      if (block.type === 'text' && typeof block.text === 'string') text += block.text;
    }
    const parsed = parsePostsJson(text, input.horizonDays);
    if (!parsed) {
      console.error('[marketing-plan-posts] parse failed', text.slice(0, 600));
      return null;
    }
    return { posts: parsed, model, pillarIndexToId };
  } catch (error) {
    console.error('[marketing-plan-posts] generation failed', error);
    return null;
  }
}

// ── Persistence ─────────────────────────────────────────────────────────

function mapPostRow(row: Record<string, unknown>): PersistedPlanPost {
  const crossPostPlan = Array.isArray(row.cross_post_plan) ? (row.cross_post_plan as GeneratedPlanPost['crossPostPlan']) : [];
  const goalKpi = (row.goal_kpi as GeneratedPlanPost['goalKpi']) ?? null;
  return {
    id: String(row.id),
    planId: String(row.plan_id),
    pillarId: (row.pillar_id as string | null) ?? null,
    sortOrder: Number(row.sort_order ?? 0),
    dayOffset: (row.day_offset as number | null) ?? null,
    hook: String(row.hook ?? ''),
    format: row.format as GeneratedPlanPost['format'],
    script: (row.script as string | null) ?? null,
    captionDraft: (row.caption_draft as string | null) ?? null,
    callToAction: (row.call_to_action as string | null) ?? null,
    primaryPlatform: (row.primary_platform as GeneratedPlanPost['primaryPlatform']) ?? null,
    crossPostPlan,
    goalKpi,
    status: (row.status as PersistedPlanPost['status']) ?? 'proposed',
    feedPlanPostId: (row.feed_plan_post_id as string | null) ?? null,
    scheduledFor: (row.scheduled_for as Date | null) ?? null,
    publishedAt: (row.published_at as Date | null) ?? null,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
    previewStreamUid: (row.preview_stream_uid as string | null) ?? null,
    previewStreamReady: row.preview_stream_ready === true,
    previewStreamPlaybackUrl: (row.preview_stream_playback_url as string | null) ?? null,
    previewStreamThumbnailUrl: (row.preview_stream_thumbnail_url as string | null) ?? null,
    previewStreamDurationSec: row.preview_stream_duration_sec != null
      ? Number(row.preview_stream_duration_sec) : null,
    previewVideoR2Url: (row.preview_video_url as string | null) ?? null,
    previewVideoUploadedAt: (row.preview_video_uploaded_at as Date | null) ?? null,
    clientReviewStatus: (row.client_review_status as PersistedPlanPost['clientReviewStatus']) ?? 'pending',
    clientReviewAt: (row.client_review_at as Date | null) ?? null,
    clientReviewNote: (row.client_review_note as string | null) ?? null,
    lastEditedAt: (row.last_edited_at as Date | null) ?? null,
    lastEditedByUserId: (row.last_edited_by_user_id as string | null) ?? null,
    lastEditedByName: (row.last_edited_by_name as string | null) ?? null,
    lastEditedByKind: (row.last_edited_by_kind as 'team' | 'client' | null) ?? null,
    pillarIndex: 0, // unused after persistence
  } as unknown as PersistedPlanPost;
}

/**
 * Replace all proposed-status posts on a plan with the newly-generated
 * set. Scheduled/published posts are preserved so we don't wipe real
 * work when the producer regenerates. Returns the full current list
 * (including preserved rows).
 */
export async function persistPlanPosts(
  pool: Pool,
  input: {
    planId: string;
    posts: GeneratedPlanPost[];
    pillarIndexToId: Map<number, string>;
  },
): Promise<PersistedPlanPost[] | null> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Wipe previously-proposed posts — they haven't been acted on yet.
    await client.query(
      `DELETE FROM role_room_marketing_plan_posts
        WHERE plan_id = $1 AND status = 'proposed'`,
      [input.planId],
    );
    for (const post of input.posts) {
      const pillarId = input.pillarIndexToId.get((post as any).pillarIndex ?? -1) ?? null;
      await client.query(
        `INSERT INTO role_room_marketing_plan_posts
           (plan_id, pillar_id, sort_order, day_offset, hook, format, script,
            caption_draft, call_to_action, primary_platform, cross_post_plan, goal_kpi)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb)`,
        [
          input.planId,
          pillarId,
          post.sortOrder,
          post.dayOffset,
          post.hook,
          post.format,
          post.script,
          post.captionDraft,
          post.callToAction,
          post.primaryPlatform,
          JSON.stringify(post.crossPostPlan),
          post.goalKpi ? JSON.stringify(post.goalKpi) : null,
        ],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[marketing-plan-posts] persist failed', error);
    return null;
  } finally {
    client.release();
  }
  return listPlanPosts(pool, input.planId);
}

// ── Accept plan-post into the feed-planner ──────────────────────────────

/**
 * Move a proposed plan-post into the feed-planner so it becomes a real
 * scheduling target. Builds a RoleRoomFeedPostInput from the plan-post,
 * appends it to the project's feed_plan row for the target platform,
 * and flips the plan-post to status='scheduled' with a back-reference
 * to the new feed-plan-post id.
 *
 * Idempotent: if the plan-post is already scheduled, returns the
 * current state unchanged — re-accepting doesn't duplicate the feed
 * entry.
 */
export async function acceptPlanPostIntoFeedPlanner(
  pool: Pool,
  input: {
    planPostId: string;
    projectId: string;
    ownerUserId: string;
    scheduledFor?: string | null;
  },
  // Injectable so tests can stub the feed-plan module instead of
  // hitting it for real.
  feedPlanApi: {
    loadFeedPlan: (pool: Pool, projectId: string, platform: string) => Promise<{ posts: unknown[] } | null>;
    saveFeedPlan: (
      pool: Pool,
      projectId: string,
      platform: string,
      posts: unknown[],
      options: { updatedBy?: string | null },
    ) => Promise<unknown>;
  },
): Promise<{ planPost: PersistedPlanPost; feedPlanPostId: string } | null> {
  // 1. Load + authorise the plan-post.
  const rows = await pool
    .query(
      `SELECT p.*, mp.owner_user_id, mp.project_id AS plan_project_id
         FROM role_room_marketing_plan_posts p
         JOIN role_room_marketing_plans mp ON mp.id = p.plan_id
        WHERE p.id = $1
        LIMIT 1`,
      [input.planPostId],
    )
    .catch((e) => {
      console.error('[marketing-plan-posts] accept lookup failed', e);
      return null;
    });
  const row = rows?.rows?.[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  if (row.owner_user_id !== input.ownerUserId) return null;
  if (row.plan_project_id !== input.projectId) return null;

  const existingPost = mapPostRow(row);
  if (existingPost.status !== 'proposed' && existingPost.feedPlanPostId) {
    // Already accepted — return current state, don't duplicate.
    return { planPost: existingPost, feedPlanPostId: existingPost.feedPlanPostId };
  }

  // 2. Platform: prefer the plan-post's primary, fall back to instagram
  // (the only feed-planner target currently supported).
  const platform = (existingPost.primaryPlatform ?? 'instagram') as string;

  // 3. Build the feed-planner post shape.
  const feedPlanPostId = `post-${crypto.randomUUID()}`;
  const mediaType =
    existingPost.format === 'reel' ? 'reel'
    : existingPost.format === 'carousel' ? 'carousel'
    : 'image';
  const feedPost = {
    id: feedPlanPostId,
    concept: 'marketing_plan',
    title: existingPost.hook.slice(0, 120),
    caption: existingPost.captionDraft ?? existingPost.hook,
    hashtags: [],
    callToAction: existingPost.callToAction ?? '',
    imageStyle: existingPost.script?.slice(0, 200) ?? '',
    mediaType,
    scheduledFor: input.scheduledFor ?? existingPost.scheduledFor?.toISOString() ?? null,
    locked: false,
  };

  // 4. Append to the feed-plan and persist.
  const existingPlan = await feedPlanApi.loadFeedPlan(pool, input.projectId, platform);
  const existingPosts = Array.isArray(existingPlan?.posts) ? existingPlan!.posts : [];
  await feedPlanApi.saveFeedPlan(pool, input.projectId, platform, [...existingPosts, feedPost], {
    updatedBy: input.ownerUserId,
  });

  // 5. Flip plan-post to scheduled with back-reference.
  const scheduledForTs = input.scheduledFor
    ? new Date(input.scheduledFor)
    : existingPost.scheduledFor ?? new Date();
  try {
    await pool.query(
      `UPDATE role_room_marketing_plan_posts
          SET status = 'scheduled',
              feed_plan_post_id = $1,
              scheduled_for = $2,
              updated_at = now()
        WHERE id = $3`,
      [feedPlanPostId, scheduledForTs, input.planPostId],
    );
  } catch (error) {
    console.error('[marketing-plan-posts] accept flip failed', error);
    return null;
  }

  return {
    planPost: {
      ...existingPost,
      status: 'scheduled',
      feedPlanPostId,
      scheduledFor: scheduledForTs,
    },
    feedPlanPostId,
  };
}

export async function listPlanPosts(
  pool: Pool,
  planId: string,
  since: string | null = null,
): Promise<PersistedPlanPost[]> {
  try {
    const sinceFilter = since ? `AND p.updated_at > $2` : ``;
    const params: unknown[] = since ? [planId, since] : [planId];
    const result = await pool.query(
      `SELECT p.id, p.plan_id, p.pillar_id, p.sort_order, p.day_offset, p.hook, p.format,
              p.script, p.caption_draft, p.call_to_action, p.primary_platform,
              p.cross_post_plan, p.goal_kpi, p.status, p.feed_plan_post_id,
              p.scheduled_for, p.published_at, p.created_at, p.updated_at,
              p.preview_stream_uid, p.preview_stream_ready,
              p.preview_stream_playback_url, p.preview_stream_thumbnail_url,
              p.preview_stream_duration_sec, p.preview_video_url,
              p.preview_video_uploaded_at,
              p.client_review_status, p.client_review_at, p.client_review_note,
              p.last_edited_at, p.last_edited_by_user_id,
              p.last_edited_by_kind,
              u.email AS last_edited_by_name
         FROM role_room_marketing_plan_posts p
         LEFT JOIN users u ON u.id = p.last_edited_by_user_id
        WHERE p.plan_id = $1
          ${sinceFilter}
        ORDER BY p.day_offset NULLS LAST, p.sort_order`,
      params,
    );
    return result.rows.map(mapPostRow);
  } catch (error) {
    console.error('[marketing-plan-posts] list failed', error);
    return [];
  }
}
