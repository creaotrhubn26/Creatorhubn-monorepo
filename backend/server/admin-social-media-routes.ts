// Admin social media + marketing automation routes.
//
// Backes med tabellene fra migrasjon 253_social_media.sql:
//   - social_media_posts: drafts/scheduled/posted-posts pr. plattform
//   - marketing_automation_workflows: triggered multi-step-flows
//
// Driver AdminDashboard "Marketing" → social media-fanen + automation-fanen.
//
// Defensiv: hvis migrasjonen ikke er kjørt enda returneres tomme
// kollektoner + console.warn — ikke 500 — slik at UI ikke krasjer.

import express from "express";
import type { Pool } from "pg";

export interface AdminSocialMediaRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireAdminSession: (
    req: express.Request,
    res: express.Response,
  ) => { userId: string; email: string; name: string; role: string } | null;
}

// ───────── Table existence-cache ─────────
//
// `to_regclass` returnerer null hvis tabellen mangler — gir oss en rask
// ja/nei uten å rotere information_schema flere ganger pr. request.

async function socialPostsTableExists(pool: Pool): Promise<boolean> {
  try {
    const r = await pool.query<{ reg: string | null }>(
      `SELECT to_regclass('public.social_media_posts') AS reg`,
    );
    return r.rows[0]?.reg !== null && r.rows[0]?.reg !== undefined;
  } catch {
    return false;
  }
}

async function workflowsTableExists(pool: Pool): Promise<boolean> {
  try {
    const r = await pool.query<{ reg: string | null }>(
      `SELECT to_regclass('public.marketing_automation_workflows') AS reg`,
    );
    return r.rows[0]?.reg !== null && r.rows[0]?.reg !== undefined;
  } catch {
    return false;
  }
}

// ───────── Helpers ─────────

function safeLimit(input: unknown, def: number, max: number): number {
  const n = Number(input);
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.min(Math.floor(n), max);
}

const ALLOWED_PLATFORMS = new Set([
  "instagram",
  "linkedin",
  "tiktok",
  "twitter",
  "facebook",
  "youtube",
]);

const ALLOWED_STATUS = new Set([
  "draft",
  "scheduled",
  "posted",
  "failed",
  "deleted",
]);

const ALLOWED_TRIGGER_TYPES = new Set([
  "signup",
  "cart_abandoned",
  "purchase",
  "inactivity",
  "milestone",
]);

// UUID-validator — vi vil ikke kaste den interne dev-session-iden
// "local-admin" inn i en uuid-kolonne (failer på pg-cast).
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function asUuidOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  return UUID_RE.test(v) ? v : null;
}

function parseRangeToDays(input: unknown): number {
  if (typeof input !== "string") return 30;
  const m = input.trim().match(/^(\d+)\s*d$/i);
  if (!m) return 30;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return 30;
  return Math.min(Math.floor(n), 365);
}

function toStringArray(input: unknown): string[] | undefined {
  if (input === undefined || input === null) return undefined;
  if (!Array.isArray(input)) return undefined;
  return input.map((v) => String(v));
}

interface SocialPostRow {
  id: string;
  platform: string;
  external_post_id: string | null;
  caption: string | null;
  media_urls: string[] | null;
  hashtags: string[] | null;
  status: string;
  scheduled_for: Date | null;
  posted_at: Date | null;
  impressions: number;
  engagements: number;
  likes: number;
  comments: number;
  shares: number;
  campaign_id: string | null;
  author_user_id: string | null;
  metadata: unknown;
  created_at: Date;
}

function rowToPost(r: SocialPostRow) {
  return {
    id: r.id,
    platform: r.platform,
    externalPostId: r.external_post_id,
    caption: r.caption,
    mediaUrls: r.media_urls ?? [],
    hashtags: r.hashtags ?? [],
    status: r.status,
    scheduledFor: r.scheduled_for,
    postedAt: r.posted_at,
    impressions: Number(r.impressions ?? 0),
    engagements: Number(r.engagements ?? 0),
    likes: Number(r.likes ?? 0),
    comments: Number(r.comments ?? 0),
    shares: Number(r.shares ?? 0),
    campaignId: r.campaign_id,
    authorUserId: r.author_user_id,
    metadata: r.metadata ?? {},
    createdAt: r.created_at,
  };
}

interface WorkflowRow {
  id: string;
  name: string;
  description: string | null;
  trigger_type: string;
  trigger_config: unknown;
  steps: unknown;
  is_active: boolean;
  total_users_entered: number;
  total_users_completed: number;
  created_at: Date;
  updated_at: Date;
}

function rowToWorkflow(r: WorkflowRow) {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    triggerType: r.trigger_type,
    triggerConfig: r.trigger_config ?? {},
    steps: r.steps ?? [],
    isActive: r.is_active,
    totalUsersEntered: Number(r.total_users_entered ?? 0),
    totalUsersCompleted: Number(r.total_users_completed ?? 0),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function setupAdminSocialMediaRoutes(
  deps: AdminSocialMediaRoutesDeps,
): void {
  const { app, pool, requireAdminSession } = deps;

  // ══════════════════════════════════════════════════════════════
  // SOCIAL MEDIA POSTS
  // ══════════════════════════════════════════════════════════════

  // ─── List posts ───────────────────────────────────────────
  // GET /api/social-media/posts?platform=instagram&status=posted&limit=50
  app.get("/api/social-media/posts", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      if (!(await socialPostsTableExists(pool))) {
        console.warn(
          "[admin-social-media] social_media_posts table missing — returning empty list. " +
            "Run migration 253_social_media.sql.",
        );
        return res.json({ posts: [], total: 0 });
      }

      const limit = safeLimit(req.query.limit, 50, 500);

      const filters: string[] = [];
      const params: unknown[] = [];

      const platform =
        typeof req.query.platform === "string"
          ? req.query.platform.trim().toLowerCase()
          : "";
      if (platform && ALLOWED_PLATFORMS.has(platform)) {
        params.push(platform);
        filters.push(`platform = $${params.length}`);
      }

      const status =
        typeof req.query.status === "string"
          ? req.query.status.trim().toLowerCase()
          : "";
      if (status && ALLOWED_STATUS.has(status)) {
        params.push(status);
        filters.push(`status = $${params.length}`);
      } else {
        // Skjul soft-deleted posts som default.
        filters.push(`status <> 'deleted'`);
      }

      params.push(limit);
      const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

      const result = await pool.query<SocialPostRow>(
        `SELECT id, platform, external_post_id, caption, media_urls, hashtags,
                status, scheduled_for, posted_at,
                impressions, engagements, likes, comments, shares,
                campaign_id, author_user_id, metadata, created_at
           FROM social_media_posts
           ${where}
           ORDER BY COALESCE(posted_at, scheduled_for, created_at) DESC
           LIMIT $${params.length}`,
        params,
      );

      res.json({
        posts: result.rows.map(rowToPost),
        total: result.rows.length,
      });
    } catch (err) {
      console.error("[admin-social-media] posts list failed:", err);
      res.status(500).json({ error: "social_posts_list_failed" });
    }
  });

  // ─── Create post ──────────────────────────────────────────
  // POST /api/social-media/posts
  app.post("/api/social-media/posts", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    try {
      if (!(await socialPostsTableExists(pool))) {
        return res
          .status(503)
          .json({ error: "social_posts_table_missing" });
      }

      const body = (req.body ?? {}) as Record<string, unknown>;
      const platform =
        typeof body.platform === "string"
          ? body.platform.trim().toLowerCase()
          : "";
      if (!platform || !ALLOWED_PLATFORMS.has(platform)) {
        return res.status(400).json({ error: "invalid_platform" });
      }

      const status =
        typeof body.status === "string"
          ? body.status.trim().toLowerCase()
          : "draft";
      if (!ALLOWED_STATUS.has(status)) {
        return res.status(400).json({ error: "invalid_status" });
      }

      const caption = typeof body.caption === "string" ? body.caption : null;
      const externalPostId =
        typeof body.externalPostId === "string" ? body.externalPostId : null;
      const mediaUrls = toStringArray(body.mediaUrls) ?? [];
      const hashtags = toStringArray(body.hashtags) ?? [];
      const scheduledFor =
        typeof body.scheduledFor === "string" ? body.scheduledFor : null;
      const campaignId =
        typeof body.campaignId === "string" ? body.campaignId : null;
      const metadata =
        body.metadata && typeof body.metadata === "object" ? body.metadata : {};

      const result = await pool.query<SocialPostRow>(
        `INSERT INTO social_media_posts
            (platform, external_post_id, caption, media_urls, hashtags,
             status, scheduled_for, campaign_id, author_user_id, metadata)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
       RETURNING id, platform, external_post_id, caption, media_urls, hashtags,
                 status, scheduled_for, posted_at,
                 impressions, engagements, likes, comments, shares,
                 campaign_id, author_user_id, metadata, created_at`,
        [
          platform,
          externalPostId,
          caption,
          mediaUrls,
          hashtags,
          status,
          scheduledFor,
          asUuidOrNull(campaignId),
          asUuidOrNull(session.userId),
          JSON.stringify(metadata),
        ],
      );

      res.status(201).json({ success: true, post: rowToPost(result.rows[0]) });
    } catch (err) {
      console.error("[admin-social-media] post create failed:", err);
      res.status(500).json({ error: "social_post_create_failed" });
    }
  });

  // ─── Update post ──────────────────────────────────────────
  // PUT /api/social-media/posts/:id
  app.put("/api/social-media/posts/:id", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      if (!(await socialPostsTableExists(pool))) {
        return res
          .status(503)
          .json({ error: "social_posts_table_missing" });
      }

      const { id } = req.params;
      const body = (req.body ?? {}) as Record<string, unknown>;

      const platform =
        typeof body.platform === "string"
          ? body.platform.trim().toLowerCase()
          : null;
      if (platform !== null && !ALLOWED_PLATFORMS.has(platform)) {
        return res.status(400).json({ error: "invalid_platform" });
      }

      const status =
        typeof body.status === "string"
          ? body.status.trim().toLowerCase()
          : null;
      if (status !== null && !ALLOWED_STATUS.has(status)) {
        return res.status(400).json({ error: "invalid_status" });
      }

      const caption =
        typeof body.caption === "string" ? body.caption : null;
      const externalPostId =
        typeof body.externalPostId === "string"
          ? body.externalPostId
          : null;
      const mediaUrls = toStringArray(body.mediaUrls);
      const hashtags = toStringArray(body.hashtags);
      const scheduledFor =
        typeof body.scheduledFor === "string" ? body.scheduledFor : null;
      const campaignId =
        typeof body.campaignId === "string" ? body.campaignId : null;
      const metadata =
        body.metadata && typeof body.metadata === "object"
          ? JSON.stringify(body.metadata)
          : null;

      const result = await pool.query<SocialPostRow>(
        `UPDATE social_media_posts SET
            platform        = COALESCE($1, platform),
            external_post_id = COALESCE($2, external_post_id),
            caption         = COALESCE($3, caption),
            media_urls      = COALESCE($4, media_urls),
            hashtags        = COALESCE($5, hashtags),
            status          = COALESCE($6, status),
            scheduled_for   = COALESCE($7::timestamptz, scheduled_for),
            campaign_id     = COALESCE($8::uuid, campaign_id),
            metadata        = COALESCE($9::jsonb, metadata)
          WHERE id = $10
       RETURNING id, platform, external_post_id, caption, media_urls, hashtags,
                 status, scheduled_for, posted_at,
                 impressions, engagements, likes, comments, shares,
                 campaign_id, author_user_id, metadata, created_at`,
        [
          platform,
          externalPostId,
          caption,
          mediaUrls ?? null,
          hashtags ?? null,
          status,
          scheduledFor,
          asUuidOrNull(campaignId),
          metadata,
          id,
        ],
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: "post_not_found" });
      }

      res.json({ success: true, post: rowToPost(result.rows[0]) });
    } catch (err) {
      console.error("[admin-social-media] post update failed:", err);
      res.status(500).json({ error: "social_post_update_failed" });
    }
  });

  // ─── Publish post (stub) ──────────────────────────────────
  // POST /api/social-media/posts/:id/publish
  //
  // Stub: setter status='posted' og posted_at=now() lokalt. Faktisk
  // posting til Instagram/LinkedIn-API kommer som follow-up i en egen
  // platform-bridge-modul.
  app.post("/api/social-media/posts/:id/publish", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      if (!(await socialPostsTableExists(pool))) {
        return res
          .status(503)
          .json({ error: "social_posts_table_missing" });
      }

      const { id } = req.params;
      const result = await pool.query<{ id: string; posted_at: Date | null }>(
        `UPDATE social_media_posts
            SET status = 'posted',
                posted_at = now()
          WHERE id = $1
       RETURNING id, posted_at`,
        [id],
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: "post_not_found" });
      }

      res.json({
        success: true,
        postedAt: result.rows[0].posted_at,
      });
    } catch (err) {
      console.error("[admin-social-media] publish failed:", err);
      res.status(500).json({ error: "social_post_publish_failed" });
    }
  });

  // ─── Soft delete post ─────────────────────────────────────
  // DELETE /api/social-media/posts/:id
  app.delete("/api/social-media/posts/:id", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      if (!(await socialPostsTableExists(pool))) {
        return res
          .status(503)
          .json({ error: "social_posts_table_missing" });
      }

      const { id } = req.params;
      const result = await pool.query<{ id: string }>(
        `UPDATE social_media_posts
            SET status = 'deleted'
          WHERE id = $1
       RETURNING id`,
        [id],
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: "post_not_found" });
      }

      res.json({ success: true });
    } catch (err) {
      console.error("[admin-social-media] delete failed:", err);
      res.status(500).json({ error: "social_post_delete_failed" });
    }
  });

  // ─── Analytics ────────────────────────────────────────────
  // GET /api/social-media/analytics?range=30d
  app.get("/api/social-media/analytics", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      if (!(await socialPostsTableExists(pool))) {
        console.warn(
          "[admin-social-media] social_media_posts table missing — returning zero analytics.",
        );
        return res.json({
          range: "30d",
          totalPosts: 0,
          totalImpressions: 0,
          totalEngagements: 0,
          engagementRate: 0,
          byPlatform: [],
        });
      }

      const days = parseRangeToDays(req.query.range);
      const since = `${days} days`;

      const totalsRes = await pool.query<{
        total_posts: string | null;
        total_impressions: string | null;
        total_engagements: string | null;
      }>(
        `SELECT COUNT(*)::text AS total_posts,
                COALESCE(SUM(impressions), 0)::text AS total_impressions,
                COALESCE(SUM(engagements), 0)::text AS total_engagements
           FROM social_media_posts
          WHERE status <> 'deleted'
            AND created_at >= now() - $1::interval`,
        [since],
      );

      const totalPosts = Number(totalsRes.rows[0]?.total_posts ?? 0);
      const totalImpressions = Number(
        totalsRes.rows[0]?.total_impressions ?? 0,
      );
      const totalEngagements = Number(
        totalsRes.rows[0]?.total_engagements ?? 0,
      );
      const engagementRate =
        totalImpressions > 0
          ? Math.round((totalEngagements / totalImpressions) * 10000) / 100
          : 0;

      const byPlatformRes = await pool.query<{
        platform: string;
        posts: string;
        impressions: string;
        engagements: string;
      }>(
        `SELECT platform,
                COUNT(*)::text AS posts,
                COALESCE(SUM(impressions), 0)::text AS impressions,
                COALESCE(SUM(engagements), 0)::text AS engagements
           FROM social_media_posts
          WHERE status <> 'deleted'
            AND created_at >= now() - $1::interval
       GROUP BY platform
       ORDER BY platform`,
        [since],
      );

      res.json({
        range: `${days}d`,
        totalPosts,
        totalImpressions,
        totalEngagements,
        engagementRate,
        byPlatform: byPlatformRes.rows.map((r) => ({
          platform: r.platform,
          posts: Number(r.posts),
          impressions: Number(r.impressions),
          engagements: Number(r.engagements),
        })),
      });
    } catch (err) {
      console.error("[admin-social-media] analytics failed:", err);
      res.status(500).json({ error: "social_analytics_failed" });
    }
  });

  // ══════════════════════════════════════════════════════════════
  // MARKETING AUTOMATION WORKFLOWS
  // ══════════════════════════════════════════════════════════════

  // ─── List workflows ───────────────────────────────────────
  // GET /api/marketing-automation/workflows
  app.get("/api/marketing-automation/workflows", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      if (!(await workflowsTableExists(pool))) {
        console.warn(
          "[admin-social-media] marketing_automation_workflows table missing — returning empty list. " +
            "Run migration 253_social_media.sql.",
        );
        return res.json({ workflows: [], total: 0 });
      }

      const result = await pool.query<WorkflowRow>(
        `SELECT id, name, description, trigger_type, trigger_config, steps,
                is_active, total_users_entered, total_users_completed,
                created_at, updated_at
           FROM marketing_automation_workflows
       ORDER BY created_at DESC`,
      );

      res.json({
        workflows: result.rows.map(rowToWorkflow),
        total: result.rows.length,
      });
    } catch (err) {
      console.error("[admin-social-media] workflows list failed:", err);
      res.status(500).json({ error: "workflows_list_failed" });
    }
  });

  // ─── Create workflow ──────────────────────────────────────
  // POST /api/marketing-automation/workflows
  app.post("/api/marketing-automation/workflows", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      if (!(await workflowsTableExists(pool))) {
        return res
          .status(503)
          .json({ error: "workflows_table_missing" });
      }

      const body = (req.body ?? {}) as Record<string, unknown>;
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name) {
        return res.status(400).json({ error: "missing_name" });
      }

      const triggerType =
        typeof body.triggerType === "string"
          ? body.triggerType.trim().toLowerCase()
          : "";
      if (!triggerType || !ALLOWED_TRIGGER_TYPES.has(triggerType)) {
        return res.status(400).json({ error: "invalid_trigger_type" });
      }

      const description =
        typeof body.description === "string" ? body.description : null;
      const triggerConfig =
        body.triggerConfig && typeof body.triggerConfig === "object"
          ? body.triggerConfig
          : {};
      const steps = Array.isArray(body.steps) ? body.steps : [];
      const isActive = Boolean(body.isActive);

      const result = await pool.query<WorkflowRow>(
        `INSERT INTO marketing_automation_workflows
            (name, description, trigger_type, trigger_config, steps, is_active)
          VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6)
       RETURNING id, name, description, trigger_type, trigger_config, steps,
                 is_active, total_users_entered, total_users_completed,
                 created_at, updated_at`,
        [
          name,
          description,
          triggerType,
          JSON.stringify(triggerConfig),
          JSON.stringify(steps),
          isActive,
        ],
      );

      res
        .status(201)
        .json({ success: true, workflow: rowToWorkflow(result.rows[0]) });
    } catch (err: unknown) {
      // 23505 = unique violation (name UNIQUE)
      if (
        typeof err === "object" &&
        err !== null &&
        (err as { code?: string }).code === "23505"
      ) {
        return res.status(409).json({ error: "workflow_name_taken" });
      }
      console.error("[admin-social-media] workflow create failed:", err);
      res.status(500).json({ error: "workflow_create_failed" });
    }
  });

  // ─── Toggle workflow ──────────────────────────────────────
  // PATCH /api/marketing-automation/workflows/:id/toggle  body: { active }
  app.patch(
    "/api/marketing-automation/workflows/:id/toggle",
    async (req, res) => {
      if (!requireAdminSession(req, res)) return;
      try {
        if (!(await workflowsTableExists(pool))) {
          return res
            .status(503)
            .json({ error: "workflows_table_missing" });
        }

        const { id } = req.params;
        const active = Boolean(req.body?.active);

        const result = await pool.query<{ id: string; is_active: boolean }>(
          `UPDATE marketing_automation_workflows
              SET is_active = $1,
                  updated_at = now()
            WHERE id = $2
         RETURNING id, is_active`,
          [active, id],
        );

        if (result.rowCount === 0) {
          return res.status(404).json({ error: "workflow_not_found" });
        }

        res.json({
          success: true,
          id: result.rows[0].id,
          active: result.rows[0].is_active,
        });
      } catch (err) {
        console.error("[admin-social-media] workflow toggle failed:", err);
        res.status(500).json({ error: "workflow_toggle_failed" });
      }
    },
  );

  // ─── Workflow stats ───────────────────────────────────────
  // GET /api/marketing-automation/workflows/:id/stats
  app.get(
    "/api/marketing-automation/workflows/:id/stats",
    async (req, res) => {
      if (!requireAdminSession(req, res)) return;
      try {
        if (!(await workflowsTableExists(pool))) {
          return res
            .status(503)
            .json({ error: "workflows_table_missing" });
        }

        const { id } = req.params;
        const result = await pool.query<{
          id: string;
          name: string;
          trigger_type: string;
          is_active: boolean;
          total_users_entered: number;
          total_users_completed: number;
          step_count: string;
        }>(
          `SELECT id, name, trigger_type, is_active,
                  total_users_entered, total_users_completed,
                  COALESCE(jsonb_array_length(steps), 0)::text AS step_count
             FROM marketing_automation_workflows
            WHERE id = $1`,
          [id],
        );

        if (result.rowCount === 0) {
          return res.status(404).json({ error: "workflow_not_found" });
        }

        const r = result.rows[0];
        const entered = Number(r.total_users_entered ?? 0);
        const completed = Number(r.total_users_completed ?? 0);
        const completionRate =
          entered > 0
            ? Math.round((completed / entered) * 10000) / 100
            : 0;

        res.json({
          id: r.id,
          name: r.name,
          triggerType: r.trigger_type,
          isActive: r.is_active,
          stepCount: Number(r.step_count ?? 0),
          totalUsersEntered: entered,
          totalUsersCompleted: completed,
          completionRate,
        });
      } catch (err) {
        console.error("[admin-social-media] workflow stats failed:", err);
        res.status(500).json({ error: "workflow_stats_failed" });
      }
    },
  );
}
