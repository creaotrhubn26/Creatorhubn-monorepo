/**
 * role-room-agent-workspace-data.ts
 *
 * Read-only, agent-friendly snapshot functions for the Role Room Agent
 * "operator" surface (chat-operator tools + the Morning Brief both consume
 * these). Each function returns a small, plain-data object — numbers, strings
 * and capped arrays — suitable to drop straight into an LLM `tool_result`.
 *
 * Scoping is identical to the routes these reuse:
 *   • Inbox / Analytics — scoped to the caller's OWN social accounts
 *     (IG business + FB page + LinkedIn member + linked YouTube channels),
 *     the same UNION the GET /social/inbox + GET /social/analytics endpoints
 *     use (ownedSocialAccountIdsSql). Never returns another tenant's events.
 *   • Lead funnel — scoped to the caller's user_id across the lead tables
 *     (role_room_lead_segments / _outcomes / _spend / _followups), same as
 *     the producer leads routes, optionally narrowed to one connection/form.
 *   • Feed status — scoped to a single projectId via loadFeedPlan, reusing
 *     the feed-plan approval state machine + the auto-approval deadline check.
 *
 * Every function is defensive: any thrown query rejects into a safe empty
 * shape (it never throws), and result arrays are capped so payloads stay tiny.
 */

import type { Pool } from "pg";
import {
  loadFeedPlan,
  SUPPORTED_FEED_PLATFORMS,
  type RoleRoomFeedApprovalState,
} from "./role-room-feed-plan.js";
import { shouldAutoApprove } from "./role-room-material-approval.js";

// ───────────────────────────────────────────────────────────────────────────
// Shared scope SQL: every social account_id the given user owns. Mirrors the
// ownedSocialAccountIdsSql / analytics scopeSql helpers in
// role-room-social-routes.ts so inbox + analytics can never read across
// tenants. `userParam` is a bind placeholder (e.g. "$1"); pass the user id.
// ───────────────────────────────────────────────────────────────────────────
function ownedAccountScopeSql(userParam: string): string {
  return `
    SELECT ig_business_account_id FROM role_room_instagram_connections WHERE user_id = ${userParam}
    UNION
    SELECT facebook_page_id FROM role_room_instagram_connections
     WHERE user_id = ${userParam} AND facebook_page_id IS NOT NULL
    UNION
    SELECT linkedin_member_id FROM role_room_linkedin_connections
     WHERE user_id = ${userParam} AND linkedin_member_id IS NOT NULL
    UNION
    SELECT DISTINCT account_id FROM social_metrics
     WHERE platform = 'youtube'
       AND connection_id IN (SELECT id FROM role_room_google_connections WHERE user_id = ${userParam})
  `;
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  try {
    const d = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    return null;
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Inbox snapshot
// ───────────────────────────────────────────────────────────────────────────

export interface InboxSnapshotItem {
  id: string;
  platform: string;
  author: string | null;
  body: string | null;
  sentimentLabel: string | null;
  isRead: boolean;
  receivedAt: string | null;
}

export interface InboxSnapshot {
  totalEvents: number;
  unread: number;
  byPlatform: Record<string, number>;
  sentimentBreakdown: Record<string, number>;
  /** Recent negative/unread items, newest first, capped ~5. */
  topNegative: InboxSnapshotItem[];
  generatedAt: string;
}

function emptyInboxSnapshot(): InboxSnapshot {
  return {
    totalEvents: 0,
    unread: 0,
    byPlatform: {},
    sentimentBreakdown: {},
    topNegative: [],
    generatedAt: new Date().toISOString(),
  };
}

const TOP_NEGATIVE_CAP = 5;
const BODY_PREVIEW_LEN = 280;

/**
 * Cross-platform incoming-events snapshot for the caller's own accounts.
 * Counts events + unread, breaks them down by platform + sentiment, and lifts
 * the most actionable (negative or still-unread) recent items to the top.
 */
export async function getInboxSnapshot(
  pool: Pool,
  userId: string,
  opts: { sinceDays?: number } = {},
): Promise<InboxSnapshot> {
  const sinceDays = Number.isFinite(opts.sinceDays) && (opts.sinceDays as number) > 0
    ? Math.min(Math.floor(opts.sinceDays as number), 365)
    : 30;
  try {
    const scope = ownedAccountScopeSql("$1");
    const [aggregate, negatives] = await Promise.all([
      pool.query<{
        platform: string;
        sentiment_label: string | null;
        is_read: boolean;
        n: number;
      }>(
        `SELECT platform, sentiment_label, is_read, count(*)::int AS n
           FROM social_events
          WHERE account_id IN (${scope})
            AND received_at >= now() - make_interval(days => $2::int)
          GROUP BY platform, sentiment_label, is_read`,
        [userId, sinceDays],
      ),
      pool.query<{
        id: string;
        platform: string;
        author_username: string | null;
        author_display_name: string | null;
        body: string | null;
        sentiment_label: string | null;
        is_read: boolean;
        received_at: Date | null;
      }>(
        `SELECT id, platform, author_username, author_display_name, body,
                sentiment_label, is_read, received_at
           FROM social_events
          WHERE account_id IN (${scope})
            AND received_at >= now() - make_interval(days => $2::int)
            AND (sentiment_label = 'negative' OR NOT is_read)
          ORDER BY (sentiment_label = 'negative') DESC, received_at DESC
          LIMIT $3`,
        [userId, sinceDays, TOP_NEGATIVE_CAP],
      ),
    ]);

    const snapshot = emptyInboxSnapshot();
    for (const row of aggregate.rows) {
      const n = Number(row.n) || 0;
      snapshot.totalEvents += n;
      if (!row.is_read) snapshot.unread += n;
      if (row.platform) {
        snapshot.byPlatform[row.platform] = (snapshot.byPlatform[row.platform] ?? 0) + n;
      }
      if (row.sentiment_label) {
        snapshot.sentimentBreakdown[row.sentiment_label] =
          (snapshot.sentimentBreakdown[row.sentiment_label] ?? 0) + n;
      }
    }
    snapshot.topNegative = negatives.rows.map((r) => ({
      id: String(r.id),
      platform: r.platform,
      author: r.author_display_name || r.author_username || null,
      body: r.body ? r.body.slice(0, BODY_PREVIEW_LEN) : null,
      sentimentLabel: r.sentiment_label,
      isRead: Boolean(r.is_read),
      receivedAt: toIso(r.received_at),
    }));
    return snapshot;
  } catch (error) {
    console.warn("[workspace-data] getInboxSnapshot failed", error);
    return emptyInboxSnapshot();
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Lead funnel snapshot
// ───────────────────────────────────────────────────────────────────────────

export interface LeadFunnelColdLead {
  leadId: string;
  reason: string | null;
}

export interface LeadFunnelSnapshot {
  totalLeads: number;
  bySegment: Record<string, number>;
  byStage: Record<string, number>;
  /** Warm leads that have not yet been followed up, capped ~5. */
  coldLeads: LeadFunnelColdLead[];
  roi: { spendKr: number; revenueKr: number; costPerCustomerKr: number };
  generatedAt: string;
}

function emptyLeadFunnelSnapshot(): LeadFunnelSnapshot {
  return {
    totalLeads: 0,
    bySegment: {},
    byStage: {},
    coldLeads: [],
    roi: { spendKr: 0, revenueKr: 0, costPerCustomerKr: 0 },
    generatedAt: new Date().toISOString(),
  };
}

const COLD_LEADS_CAP = 5;

/**
 * Lead retargeting + ROI funnel for the caller, optionally narrowed to one
 * connection/form. Counts leads by retargeting segment + conversion stage,
 * surfaces warm-but-not-yet-followed-up leads, and totals spend/revenue so an
 * agent can cite cost-per-customer. All tables are user_id scoped.
 */
export async function getLeadFunnelSnapshot(
  pool: Pool,
  userId: string,
  opts: { connectionId?: string; formId?: string } = {},
): Promise<LeadFunnelSnapshot> {
  const connectionId =
    typeof opts.connectionId === "string" && opts.connectionId.trim() ? opts.connectionId.trim() : null;
  const formId = typeof opts.formId === "string" && opts.formId.trim() ? opts.formId.trim() : null;
  try {
    // role_room_lead_segments — no form_id column, so only user + connection.
    const segParams: unknown[] = [userId];
    let segWhere = `user_id = $1`;
    if (connectionId) {
      segParams.push(connectionId);
      segWhere += ` AND connection_id = $${segParams.length}`;
    }
    // role_room_lead_outcomes / _spend — support form_id too.
    const outParams: unknown[] = [userId];
    let outWhere = `user_id = $1`;
    if (connectionId) {
      outParams.push(connectionId);
      outWhere += ` AND connection_id = $${outParams.length}`;
    }
    if (formId) {
      outParams.push(formId);
      outWhere += ` AND form_id = $${outParams.length}`;
    }

    // Combined totals query — both halves of the UNION share ONE param list,
    // so build a single consistent numbering ($1 user, $2 connection, $3 form).
    const totalsParams: unknown[] = [userId];
    let totSegWhere = `user_id = $1`;
    let totOutWhere = `user_id = $1`;
    if (connectionId) {
      totalsParams.push(connectionId);
      const p = `$${totalsParams.length}`;
      totSegWhere += ` AND connection_id = ${p}`;
      totOutWhere += ` AND connection_id = ${p}`;
    }
    if (formId) {
      totalsParams.push(formId);
      totOutWhere += ` AND form_id = $${totalsParams.length}`;
    }

    // Cold leads (warm segment, no follow-up) — columns qualified to `s.`.
    const coldParams: unknown[] = [userId];
    let coldWhere = `s.user_id = $1`;
    if (connectionId) {
      coldParams.push(connectionId);
      coldWhere += ` AND s.connection_id = $${coldParams.length}`;
    }
    coldParams.push(COLD_LEADS_CAP);

    const [segments, stages, spend, totals, cold] = await Promise.all([
      pool.query<{ segment: string; n: number }>(
        `SELECT segment, count(*)::int AS n
           FROM role_room_lead_segments
          WHERE ${segWhere}
          GROUP BY segment`,
        segParams,
      ),
      pool.query<{ stage: string; n: number; sum_value: number }>(
        `SELECT stage, count(*)::int AS n, COALESCE(SUM(value_kr), 0)::float AS sum_value
           FROM role_room_lead_outcomes
          WHERE ${outWhere}
          GROUP BY stage`,
        outParams,
      ),
      pool.query<{ spend_kr: number }>(
        `SELECT COALESCE(SUM(spend_kr), 0)::float AS spend_kr
           FROM role_room_lead_spend
          WHERE ${outWhere}`,
        outParams,
      ),
      pool.query<{ n: number }>(
        `SELECT count(DISTINCT lead_external_id)::int AS n FROM (
           SELECT lead_external_id FROM role_room_lead_segments WHERE ${totSegWhere}
           UNION
           SELECT lead_external_id FROM role_room_lead_outcomes WHERE ${totOutWhere}
         ) u`,
        totalsParams,
      ),
      pool.query<{ lead_external_id: string; reason: string | null }>(
        `SELECT s.lead_external_id, s.reason
           FROM role_room_lead_segments s
           LEFT JOIN role_room_lead_followups f
             ON f.user_id = s.user_id AND f.lead_external_id = s.lead_external_id
          WHERE ${coldWhere}
            AND s.segment = 'varm'
            AND f.lead_external_id IS NULL
          ORDER BY s.updated_at DESC
          LIMIT $${coldParams.length}`,
        coldParams,
      ),
    ]);

    const snapshot = emptyLeadFunnelSnapshot();
    for (const r of segments.rows) {
      if (r.segment) snapshot.bySegment[r.segment] = Number(r.n) || 0;
    }
    let revenueKr = 0;
    let customers = 0;
    for (const r of stages.rows) {
      const n = Number(r.n) || 0;
      if (r.stage) snapshot.byStage[r.stage] = n;
      if (r.stage === "kunde") {
        customers = n;
        revenueKr = Number(r.sum_value) || 0;
      }
    }
    const spendKr = Number(spend.rows[0]?.spend_kr) || 0;
    snapshot.totalLeads = Number(totals.rows[0]?.n) || 0;
    snapshot.roi = {
      spendKr,
      revenueKr,
      costPerCustomerKr: customers > 0 ? spendKr / customers : 0,
    };
    snapshot.coldLeads = cold.rows.map((r) => ({
      leadId: String(r.lead_external_id),
      reason: r.reason || null,
    }));
    return snapshot;
  } catch (error) {
    console.warn("[workspace-data] getLeadFunnelSnapshot failed", error);
    return emptyLeadFunnelSnapshot();
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Analytics snapshot
// ───────────────────────────────────────────────────────────────────────────

export interface AnalyticsFollowerSnapshot {
  platform: string;
  accountId: string;
  count: number;
  recordedAt: string | null;
}

export interface AnalyticsSnapshot {
  events: {
    last7d: { total: number; unread: number };
    last30d: { total: number };
  };
  sentiment: { positive: number; neutral: number; negative: number };
  /** Latest follower/subscriber count per owned account. */
  followers: AnalyticsFollowerSnapshot[];
  publishCadence: { published30d: number; scheduled30d: number };
  generatedAt: string;
}

function emptyAnalyticsSnapshot(): AnalyticsSnapshot {
  return {
    events: { last7d: { total: 0, unread: 0 }, last30d: { total: 0 } },
    sentiment: { positive: 0, neutral: 0, negative: 0 },
    followers: [],
    publishCadence: { published30d: 0, scheduled30d: 0 },
    generatedAt: new Date().toISOString(),
  };
}

const FOLLOWER_METRIC_NAMES = [
  "followers",
  "follower_count",
  "followers_count",
  "fan_count",
  "subscriber_count",
];
const FOLLOWERS_CAP = 8;

/**
 * Condensed version of the GET /social/analytics aggregation — just the few
 * numbers an agent would cite: 7d/30d event volume, the 30d sentiment split,
 * the latest follower count per owned account, and 30d publish cadence.
 */
export async function getAnalyticsSnapshot(pool: Pool, userId: string): Promise<AnalyticsSnapshot> {
  try {
    const scope = `(${ownedAccountScopeSql("$1")})`;
    const [events7d, events30d, sentiment, followers, cadence] = await Promise.all([
      pool.query<{ total: string; unread: string }>(
        `SELECT count(*)::text AS total,
                count(*) FILTER (WHERE NOT is_read)::text AS unread
           FROM social_events
          WHERE account_id IN ${scope}
            AND received_at >= now() - interval '7 days'`,
        [userId],
      ),
      pool.query<{ total: string }>(
        `SELECT count(*)::text AS total
           FROM social_events
          WHERE account_id IN ${scope}
            AND received_at >= now() - interval '30 days'`,
        [userId],
      ),
      pool.query<{ sentiment_label: string; n: string }>(
        `SELECT sentiment_label, count(*)::text AS n
           FROM social_events
          WHERE account_id IN ${scope}
            AND received_at >= now() - interval '30 days'
            AND sentiment_label IS NOT NULL
          GROUP BY sentiment_label`,
        [userId],
      ),
      pool.query<{
        platform: string;
        account_id: string;
        metric_value: string | null;
        recorded_at: Date;
      }>(
        `SELECT DISTINCT ON (platform, account_id)
                platform, account_id, metric_value, recorded_at
           FROM social_metrics
          WHERE account_id IN ${scope}
            AND scope IN ('account', 'page')
            AND metric_name = ANY($2::text[])
          ORDER BY platform, account_id, recorded_at DESC
          LIMIT $3`,
        [userId, FOLLOWER_METRIC_NAMES, FOLLOWERS_CAP],
      ),
      pool.query<{ published: string; scheduled: string }>(
        `SELECT count(*) FILTER (WHERE metric_name = 'publish_count')::text AS published,
                count(*) FILTER (WHERE metric_name = 'scheduled_count')::text AS scheduled
           FROM social_metrics
          WHERE account_id IN ${scope}
            AND scope = 'account'
            AND metric_name IN ('publish_count', 'scheduled_count')
            AND recorded_at >= now() - interval '30 days'`,
        [userId],
      ),
    ]);

    const snapshot = emptyAnalyticsSnapshot();
    snapshot.events.last7d.total = Number(events7d.rows[0]?.total) || 0;
    snapshot.events.last7d.unread = Number(events7d.rows[0]?.unread) || 0;
    snapshot.events.last30d.total = Number(events30d.rows[0]?.total) || 0;
    for (const r of sentiment.rows) {
      const n = Number(r.n) || 0;
      if (r.sentiment_label === "positive") snapshot.sentiment.positive += n;
      else if (r.sentiment_label === "negative") snapshot.sentiment.negative += n;
      else if (r.sentiment_label === "neutral") snapshot.sentiment.neutral += n;
    }
    snapshot.followers = followers.rows.map((r) => ({
      platform: r.platform,
      accountId: r.account_id,
      count: r.metric_value != null ? Number(r.metric_value) || 0 : 0,
      recordedAt: toIso(r.recorded_at),
    }));
    snapshot.publishCadence.published30d = Number(cadence.rows[0]?.published) || 0;
    snapshot.publishCadence.scheduled30d = Number(cadence.rows[0]?.scheduled) || 0;
    return snapshot;
  } catch (error) {
    console.warn("[workspace-data] getAnalyticsSnapshot failed", error);
    return emptyAnalyticsSnapshot();
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Feed status snapshot
// ───────────────────────────────────────────────────────────────────────────

export interface FeedStatusSnapshot {
  byApprovalState: Record<string, number>;
  /** Posts awaiting client whose review deadline has passed. */
  awaitingClientOverdue: number;
  needsChanges: number;
  generatedAt: string;
}

function emptyFeedStatusSnapshot(): FeedStatusSnapshot {
  return {
    byApprovalState: {},
    awaitingClientOverdue: 0,
    needsChanges: 0,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Feed-plan approval status for a single project, aggregated across every
 * supported platform. Reuses loadFeedPlan + the auto-approval deadline check
 * so "overdue awaiting-client" lines up with the §5.2 sweep.
 */
export async function getFeedStatusSnapshot(pool: Pool, projectId: string): Promise<FeedStatusSnapshot> {
  const snapshot = emptyFeedStatusSnapshot();
  if (!projectId) return snapshot;
  const now = new Date();
  try {
    for (const platform of SUPPORTED_FEED_PLATFORMS) {
      let plan;
      try {
        plan = await loadFeedPlan(pool, projectId, platform);
      } catch (error) {
        console.warn(`[workspace-data] getFeedStatusSnapshot loadFeedPlan failed (${platform})`, error);
        continue;
      }
      if (!plan) continue;
      for (const post of plan.posts) {
        const state: RoleRoomFeedApprovalState = post.approvalState ?? "draft";
        snapshot.byApprovalState[state] = (snapshot.byApprovalState[state] ?? 0) + 1;
        if (state === "needs_changes") snapshot.needsChanges += 1;
        if (shouldAutoApprove(post, now)) snapshot.awaitingClientOverdue += 1;
      }
    }
    return snapshot;
  } catch (error) {
    console.warn("[workspace-data] getFeedStatusSnapshot failed", error);
    return emptyFeedStatusSnapshot();
  }
}
