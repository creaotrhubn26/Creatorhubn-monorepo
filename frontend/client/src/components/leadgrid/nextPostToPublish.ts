/**
 * nextPostToPublish — hvilken plan-post står for tur på LinkedIn?
 *
 * Ren funksjon for publiseringskortet i Markedssjef-modus. Regel:
 *   - kun LinkedIn-poster (primaryPlatform 'linkedin', eller ukjent plattform
 *     med LinkedIn-format)
 *   - hopp over publiserte og hoppet-over poster
 *   - sortert på dayOffset (null sist), deretter sortOrder
 */
import type { MarketingPlanPost } from "@/components/role-room/services/roleRoomAgentService";

export function isLinkedInPost(post: MarketingPlanPost): boolean {
  if (post.primaryPlatform === "linkedin") return true;
  return post.primaryPlatform === null && post.format === "linkedin_post";
}

export function isPublishable(post: MarketingPlanPost): boolean {
  return post.status !== "published" && post.status !== "skipped" && !post.externalPostId;
}

export function sortPlanPosts(posts: MarketingPlanPost[]): MarketingPlanPost[] {
  return [...posts].sort((a, b) => {
    const da = a.dayOffset ?? Number.POSITIVE_INFINITY;
    const db = b.dayOffset ?? Number.POSITIVE_INFINITY;
    if (da !== db) return da - db;
    return a.sortOrder - b.sortOrder;
  });
}

export interface PublishQueue {
  /** Neste post å publisere, eller null når køen er tom. */
  next: MarketingPlanPost | null;
  /** Antall LinkedIn-poster som gjenstår (inkl. `next`). */
  remaining: number;
  /** Antall LinkedIn-poster som er publisert. */
  published: number;
  /** Antall LinkedIn-poster totalt i planen. */
  total: number;
}

export function buildPublishQueue(posts: MarketingPlanPost[]): PublishQueue {
  const linkedIn = sortPlanPosts(posts.filter(isLinkedInPost));
  const queue = linkedIn.filter(isPublishable);
  const published = linkedIn.filter((p) => p.status === "published" || Boolean(p.externalPostId)).length;
  return {
    next: queue[0] ?? null,
    remaining: queue.length,
    published,
    total: linkedIn.length,
  };
}

/** Standardtekst for LinkedIn: caption-utkast + CTA, ellers hook. */
export function defaultCaptionFor(post: MarketingPlanPost): string {
  const parts = [post.captionDraft?.trim(), post.callToAction?.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join("\n\n") : post.hook.trim();
}
