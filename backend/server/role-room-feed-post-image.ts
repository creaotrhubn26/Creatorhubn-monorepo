import { createHash } from "node:crypto";
import type { Pool } from "pg";
import type {
  RoleRoomFeedApprovalState,
  RoleRoomFeedPlatform,
  RoleRoomFeedPostInput,
} from "./role-room-feed-plan.js";

export type ApplyFeedPostImageResult =
  | {
      ok: true;
      changed: boolean;
      imageSha256: string;
      approvalState: RoleRoomFeedApprovalState;
    }
  | {
      ok: false;
      reason:
        | "link_not_found"
        | "feed_plan_not_found"
        | "feed_post_not_found"
        | "published_post_locked"
        | "approval_confirmation_required";
      approvalState?: RoleRoomFeedApprovalState;
    };

export interface ApplyFeedPostImageInput {
  workspaceProjectId: string;
  platform: RoleRoomFeedPlatform;
  feedPostId: string;
  imageDataUrl: string;
  imageName: string;
  /** Stable project-access URL after the render has been persisted. Legacy
   * thumbnail callers omit this and keep using imageDataUrl directly. */
  assetUrl?: string;
  assetSha256?: string;
  mediaType?: "image" | "carousel" | "reel";
  variantAssets?: Array<{ url: string; name: string }>;
  updatedBy: string;
  /** Present for Mockup Studio sends; absent for the legacy thumbnail bridge. */
  link?: {
    id: string;
    mockupProjectId: string;
    mockupCreatedBy: string;
    revision: number;
    confirmApprovedAssetChange: boolean;
    variantId?: string;
    outputPosition?: number;
  };
}

function imageHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function approvalStateOf(post: RoleRoomFeedPostInput): RoleRoomFeedApprovalState {
  return post.approvalState ?? "draft";
}

/**
 * Atomically applies one rendered image to one feed post. The advisory lock is
 * the same lock used by mutateFeedPlanLocked, so autosave, approvals and Mockup
 * Studio sends cannot clobber each other. When a link is supplied, its sync
 * metadata is committed in the same transaction as the feed image.
 */
export async function applyFeedPostImageLocked(
  pool: Pool,
  input: ApplyFeedPostImageInput,
): Promise<ApplyFeedPostImageResult> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      `${input.workspaceProjectId}::${input.platform}`,
    ]);

    if (input.link) {
      const linked = await client.query(
        `SELECT 1
           FROM role_room_feed_mockup_links
          WHERE id=$1::uuid
            AND workspace_project_id=$2
            AND platform=$3
            AND feed_post_id=$4
            AND mockup_project_id=$5
            AND mockup_created_by=$6
          FOR UPDATE`,
        [
          input.link.id,
          input.workspaceProjectId,
          input.platform,
          input.feedPostId,
          input.link.mockupProjectId,
          input.link.mockupCreatedBy,
        ],
      );
      if (!linked.rows.length) {
        await client.query("ROLLBACK");
        return { ok: false, reason: "link_not_found" };
      }
    }

    const plan = await client.query<{ posts: RoleRoomFeedPostInput[] }>(
      `SELECT posts
         FROM role_room_feed_plans
        WHERE project_id=$1 AND platform=$2
        LIMIT 1
        FOR UPDATE`,
      [input.workspaceProjectId, input.platform],
    );
    if (!plan.rows.length) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "feed_plan_not_found" };
    }

    const posts = Array.isArray(plan.rows[0].posts) ? plan.rows[0].posts : [];
    const postIndex = posts.findIndex(
      (post) => String(post.id) === input.feedPostId,
    );
    if (postIndex < 0) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "feed_post_not_found" };
    }

    const currentPost = posts[postIndex];
    const currentApproval = approvalStateOf(currentPost);
    const sha256 = input.assetSha256 ?? imageHash(input.imageDataUrl);
    const assetUrl = input.assetUrl ?? input.imageDataUrl;
    const mediaType = input.mediaType ?? "image";
    const variantAssets = input.variantAssets ?? [
      { url: assetUrl, name: input.imageName },
    ];
    const alreadyApplied =
      mediaType === "reel"
        ? currentPost.customVideoDataUrl === assetUrl &&
          currentPost.customVideoName === input.imageName
        : mediaType === "carousel"
          ? JSON.stringify(currentPost.customImageUrls ?? []) ===
              JSON.stringify(variantAssets.map((asset) => asset.url)) &&
            JSON.stringify(currentPost.customImageNames ?? []) ===
              JSON.stringify(variantAssets.map((asset) => asset.name))
          : currentPost.customImageUrl === assetUrl &&
            currentPost.customImageName === input.imageName;
    if (input.link && currentApproval === "published" && !alreadyApplied) {
      await client.query("ROLLBACK");
      return {
        ok: false,
        reason: "published_post_locked",
        approvalState: currentApproval,
      };
    }
    const approvalMustReset = Boolean(
      input.link &&
      !alreadyApplied &&
      ["awaiting_client", "approved", "scheduled"].includes(currentApproval),
    );
    if (approvalMustReset && !input.link?.confirmApprovedAssetChange) {
      await client.query("ROLLBACK");
      return {
        ok: false,
        reason: "approval_confirmation_required",
        approvalState: currentApproval,
      };
    }

    let nextApproval = currentApproval;

    if (!alreadyApplied) {
      const nextPost: RoleRoomFeedPostInput = { ...currentPost, mediaType };
      if (mediaType === "reel") {
        Object.assign(nextPost, {
          customVideoDataUrl: assetUrl,
          customVideoName: input.imageName,
          customImageUrl: null,
          customImageName: null,
          customImageUrls: null,
          customImageNames: null,
        });
      } else if (mediaType === "carousel") {
        Object.assign(nextPost, {
          customImageUrls: variantAssets.map((asset) => asset.url),
          customImageNames: variantAssets.map((asset) => asset.name),
          customImageUrl: null,
          customImageName: null,
          customVideoDataUrl: null,
          customVideoName: null,
        });
      } else {
        Object.assign(nextPost, {
          customImageUrl: assetUrl,
          customImageName: input.imageName,
          customImageUrls: null,
          customImageNames: null,
          customVideoDataUrl: null,
          customVideoName: null,
        });
      }
      if (approvalMustReset) {
        const now = new Date().toISOString();
        nextApproval = "needs_changes";
        Object.assign(nextPost, {
          approvalState: nextApproval,
          approvalChangedAt: now,
          approvalChangedBy: input.updatedBy,
          approvalNote:
            "Mockup-output ble oppdatert etter godkjenning og må godkjennes på nytt.",
          reviewRequestedAt: null,
          reviewRequestedBy: null,
          reviewDeadline: null,
        });
      }
      posts[postIndex] = nextPost;
      await client.query(
        `UPDATE role_room_feed_plans
            SET posts=$1::jsonb, updated_by=$2, updated_at=now()
          WHERE project_id=$3 AND platform=$4`,
        [
          JSON.stringify(posts),
          input.updatedBy,
          input.workspaceProjectId,
          input.platform,
        ],
      );
    }

    if (input.link) {
      await client.query(
        `UPDATE role_room_feed_mockup_links
            SET last_applied_revision=$2,
                last_applied_sha256=$3::varchar(64),
                last_applied_at=CASE
                  WHEN last_applied_sha256 IS DISTINCT FROM $3::varchar(64) THEN now()
                  ELSE COALESCE(last_applied_at, now())
                END,
                updated_at=now()
          WHERE id=$1::uuid`,
        [input.link.id, input.link.revision, sha256],
      );
      if (input.link.variantId) {
        await client.query(
          `UPDATE role_room_feed_mockup_variants SET is_active=false,updated_at=now()
            WHERE workspace_project_id=$1 AND platform=$2 AND feed_post_id=$3
              AND id<>$4::uuid AND is_active`,
          [
            input.workspaceProjectId,
            input.platform,
            input.feedPostId,
            input.link.variantId,
          ],
        );
        await client.query(
          `UPDATE role_room_feed_mockup_variants SET is_active=true,updated_at=now()
            WHERE id=$1::uuid AND workspace_project_id=$2 AND platform=$3 AND feed_post_id=$4`,
          [
            input.link.variantId,
            input.workspaceProjectId,
            input.platform,
            input.feedPostId,
          ],
        );
      }
    }

    await client.query("COMMIT");
    return {
      ok: true,
      changed: !alreadyApplied,
      imageSha256: sha256,
      approvalState: nextApproval,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
