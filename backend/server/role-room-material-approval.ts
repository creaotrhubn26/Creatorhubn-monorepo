/**
 * role-room-material-approval.ts
 *
 * Client material-approval gate for Role Room (MedInnova-avtalen §5.1–5.2):
 *
 *   §5.1  Nothing is published until the client has had the chance to review it.
 *   §5.2  The client must respond within N business days (default 3); if they
 *         don't, the material is considered approved (auto-approval).
 *
 * Mechanics, layered on the existing feed-plan post.approvalState:
 *   • submitPostsForReview()  → 'awaiting_client' + reviewDeadline (business days)
 *   • assertPostPublishable() → throws unless the post is approved/scheduled/published
 *   • runMaterialAutoApproveSweep() → flips overdue 'awaiting_client' → 'approved'
 *
 * The business-day math + state predicates are pure and unit-tested; the I/O
 * functions reuse loadFeedPlan/saveFeedPlan.
 */

import type { Pool } from "pg";
import {
  loadFeedPlan,
  saveFeedPlan,
  listFeedPlansAwaitingClient,
  SUPPORTED_FEED_PLATFORMS,
  type RoleRoomFeedApprovalState,
  type RoleRoomFeedPlatform,
  type RoleRoomFeedPostInput,
} from "./role-room-feed-plan.js";

/** Business days the client has to respond (§5.2). Configurable; contract says 2–3. */
export function reviewBusinessDays(): number {
  const raw = Number(process.env.MATERIAL_REVIEW_BUSINESS_DAYS);
  return Number.isFinite(raw) && raw >= 1 && raw <= 30 ? Math.floor(raw) : 3;
}

/** States in which a post may actually be published (§5.1 gate passes). */
const PUBLISHABLE_STATES: ReadonlyArray<RoleRoomFeedApprovalState> = [
  "approved",
  "scheduled",
  "published",
];

export function isPublishable(state: RoleRoomFeedApprovalState | null | undefined): boolean {
  return !!state && (PUBLISHABLE_STATES as readonly string[]).includes(state);
}

/**
 * Add N business days to an ISO timestamp, skipping Sat/Sun (and any extra
 * holiday YYYY-MM-DD dates supplied). Time-of-day is preserved.
 */
export function addBusinessDaysIso(iso: string, businessDays: number, holidays: string[] = []): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return addBusinessDaysIso(new Date().toISOString(), businessDays, holidays);
  }
  const holidaySet = new Set(holidays);
  let added = 0;
  while (added < businessDays) {
    date.setUTCDate(date.getUTCDate() + 1);
    const day = date.getUTCDay(); // 0 = Sun, 6 = Sat
    if (day === 0 || day === 6) continue;
    if (holidaySet.has(date.toISOString().slice(0, 10))) continue;
    added += 1;
  }
  return date.toISOString();
}

export function computeReviewDeadlineIso(submittedIso: string, days = reviewBusinessDays()): string {
  return addBusinessDaysIso(submittedIso, days);
}

/** A post is due for auto-approval if it is awaiting client and past its deadline. */
export function shouldAutoApprove(
  post: Pick<RoleRoomFeedPostInput, "approvalState" | "reviewDeadline">,
  now: Date = new Date(),
): boolean {
  if (post.approvalState !== "awaiting_client") return false;
  if (!post.reviewDeadline) return false;
  const deadline = new Date(post.reviewDeadline);
  if (Number.isNaN(deadline.getTime())) return false;
  return now.getTime() >= deadline.getTime();
}

// ─────────────────────────────────────────────────────────
// Approval policy — who may approve material for publishing.
// The CLIENT decides this (default: only the client). §5.1.
// ─────────────────────────────────────────────────────────

export interface ApprovalPolicy {
  requireClientApproval: boolean;
}

/** True for actors logged in as the client. */
export function isClientActor(role: string | null | undefined): boolean {
  const r = (role ?? "").toLowerCase();
  return r === "client" || r === "client_reviewer";
}

/**
 * May this actor move a post into a publishable (approved) state?
 * System (auto-approval) always may. Otherwise: anyone if the client has
 * disabled the requirement, else only the client.
 */
export function canTransitionToPublishable(opts: {
  requireClientApproval: boolean;
  actorRole?: string | null;
  isSystem?: boolean;
}): boolean {
  if (opts.isSystem) return true;
  if (!opts.requireClientApproval) return true;
  return isClientActor(opts.actorRole);
}

export async function getApprovalPolicy(pool: Pool, projectId: string): Promise<ApprovalPolicy> {
  try {
    const result = await pool.query(
      `SELECT require_client_approval FROM role_room_approval_settings WHERE project_id = $1 LIMIT 1`,
      [projectId],
    );
    if (!result.rowCount) return { requireClientApproval: true }; // default: strict §5.1
    return { requireClientApproval: result.rows[0].require_client_approval !== false };
  } catch (error) {
    console.error("[material-approval] getApprovalPolicy failed", error);
    return { requireClientApproval: true };
  }
}

export async function setApprovalPolicy(
  pool: Pool,
  projectId: string,
  requireClientApproval: boolean,
  updatedBy: string,
): Promise<ApprovalPolicy> {
  await pool.query(
    `INSERT INTO role_room_approval_settings (project_id, require_client_approval, updated_by, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (project_id) DO UPDATE SET
       require_client_approval = EXCLUDED.require_client_approval,
       updated_by = EXCLUDED.updated_by,
       updated_at = now()`,
    [projectId, requireClientApproval, updatedBy],
  );
  return { requireClientApproval };
}

export class MaterialNotApprovedError extends Error {
  readonly approvalState: RoleRoomFeedApprovalState | null;
  readonly reviewDeadline: string | null;
  constructor(state: RoleRoomFeedApprovalState | null, reviewDeadline: string | null) {
    super(
      `Materiell er ikke godkjent av kunden ennå (status: ${state ?? "ukjent"}). ` +
        `Kan ikke publiseres før kunden har godkjent (MedInnova-avtalen §5.1).`,
    );
    this.name = "MaterialNotApprovedError";
    this.approvalState = state;
    this.reviewDeadline = reviewDeadline;
  }
}

/** Locate a post by id across the supported platforms. */
async function findPost(
  pool: Pool,
  projectId: string,
  feedPlanPostId: string,
): Promise<{ platform: RoleRoomFeedPlatform; post: RoleRoomFeedPostInput } | null> {
  for (const platform of SUPPORTED_FEED_PLATFORMS) {
    const plan = await loadFeedPlan(pool, projectId, platform);
    const post = plan?.posts.find((p) => p.id === feedPlanPostId);
    if (post) return { platform, post };
  }
  return null;
}

/**
 * §5.1 publish gate. Throws MaterialNotApprovedError unless the linked feed-plan
 * post is in a publishable (client-approved) state. If the material isn't linked
 * to a feed-plan post we cannot verify approval → block (fail-closed) unless
 * `allowUnlinked` is set.
 */
export async function assertPostPublishable(
  pool: Pool,
  projectId: string | null | undefined,
  feedPlanPostId: string | null | undefined,
  options: { allowUnlinked?: boolean } = {},
): Promise<void> {
  if (!feedPlanPostId || !projectId) {
    if (options.allowUnlinked) return;
    throw new MaterialNotApprovedError(null, null);
  }
  const found = await findPost(pool, projectId, feedPlanPostId);
  if (!found) {
    // Post not found — can't prove it was reviewed.
    if (options.allowUnlinked) return;
    throw new MaterialNotApprovedError(null, null);
  }
  const state = found.post.approvalState ?? "draft";
  if (!isPublishable(state)) {
    throw new MaterialNotApprovedError(state, found.post.reviewDeadline ?? null);
  }
}

/**
 * Submit posts to the client for review (§5.1). Sets 'awaiting_client' + a
 * business-day deadline. Returns how many posts were transitioned.
 */
export async function submitPostsForReview(
  pool: Pool,
  projectId: string,
  platform: RoleRoomFeedPlatform,
  postIds: string[],
  requestedBy: string,
  options: { days?: number; now?: Date } = {},
): Promise<{ submitted: number; deadline: string | null }> {
  const plan = await loadFeedPlan(pool, projectId, platform);
  if (!plan) return { submitted: 0, deadline: null };
  const ids = new Set(postIds);
  const now = (options.now ?? new Date()).toISOString();
  const deadline = computeReviewDeadlineIso(now, options.days ?? reviewBusinessDays());

  let submitted = 0;
  const nextPosts = plan.posts.map((p) => {
    if (!ids.has(p.id)) return p;
    submitted += 1;
    return {
      ...p,
      approvalState: "awaiting_client" as RoleRoomFeedApprovalState,
      approvalChangedAt: now,
      approvalChangedBy: requestedBy,
      reviewRequestedAt: now,
      reviewRequestedBy: requestedBy,
      reviewDeadline: deadline,
    };
  });
  if (submitted === 0) return { submitted: 0, deadline: null };
  await saveFeedPlan(pool, projectId, platform, nextPosts, {
    brandSnapshot: plan.brandSnapshot,
    updatedBy: requestedBy,
  });
  return { submitted, deadline };
}

export interface AutoApproveSummary {
  plansScanned: number;
  postsAutoApproved: number;
  errors: string[];
}

/**
 * §5.2 auto-approval. Flips every 'awaiting_client' post past its reviewDeadline
 * to 'approved', recording that it was the deadline (not the client) that
 * approved it. Idempotent — safe to run daily.
 */
export async function runMaterialAutoApproveSweep(
  pool: Pool,
  now: Date = new Date(),
): Promise<AutoApproveSummary> {
  const summary: AutoApproveSummary = { plansScanned: 0, postsAutoApproved: 0, errors: [] };
  const plans = await listFeedPlansAwaitingClient(pool);
  summary.plansScanned = plans.length;
  const nowIso = now.toISOString();

  for (const plan of plans) {
    let changed = 0;
    const nextPosts = plan.posts.map((p) => {
      if (!shouldAutoApprove(p, now)) return p;
      changed += 1;
      return {
        ...p,
        approvalState: "approved" as RoleRoomFeedApprovalState,
        approvalChangedAt: nowIso,
        approvalChangedBy: "system:auto-approval",
        approvalNote:
          "Auto-godkjent: kunden svarte ikke innen fristen (MedInnova-avtalen §5.2).",
      };
    });
    if (changed === 0) continue;
    try {
      await saveFeedPlan(pool, plan.projectId, plan.platform, nextPosts, {
        brandSnapshot: plan.brandSnapshot,
        updatedBy: "system:auto-approval",
      });
      summary.postsAutoApproved += changed;
    } catch (error) {
      summary.errors.push(`save_failed[${plan.projectId}/${plan.platform}]: ${String(error)}`);
    }
  }
  return summary;
}
