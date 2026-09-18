/**
 * LinkedIn Organization Share Statistics — rekkevidde per bedriftspost.
 *
 * GET /rest/organizationalEntityShareStatistics
 *     ?q=organizationalEntity&organizationalEntity=urn:li:organization:{id}
 *     &ugcPosts=List(urn:li:ugcPost:{a},urn:li:ugcPost:{b},…)
 * Scope: r_organization_social (Community Management API). Medlemmet må ha
 * en admin-/poster-rolle på siden — manglende rolle gir samme 403 som
 * manglende scope, så begge svares med null (ærlig tomt), ikke kast.
 *
 * Brukes av role-room-kpi-connectors.ts for poster publisert som bedrift
 * fra markedsplanen (published_author_urn = urn:li:organization:…).
 */
import { LINKEDIN_REST_BASE, linkedInRestHeaders } from './linkedin-api-version.js';
import { normalizeLinkedInPostId } from './social-linkedin-social-actions.js';

export interface LinkedInOrgShareStats {
  /** Rå ugcPost-id uten urn-prefiks. */
  postId: string;
  impressions: number | null;
  uniqueImpressions: number | null;
  clicks: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  /** Andel (0–1) slik LinkedIn rapporterer den. */
  engagementRate: number | null;
}

/** LinkedIn tar maks ~50 URN-er per List(); hold oss under for å være trygge. */
export const LINKEDIN_SHARE_STATS_BATCH = 40;

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

interface ShareStatsElement {
  ugcPost?: string;
  share?: string;
  totalShareStatistics?: {
    impressionCount?: number;
    uniqueImpressionsCount?: number;
    clickCount?: number;
    likeCount?: number;
    commentCount?: number;
    shareCount?: number;
    engagement?: number;
  };
}

/**
 * Henter statistikk for opptil LINKEDIN_SHARE_STATS_BATCH poster i ett kall.
 * Returnerer null når LinkedIn avviser (403 scope/rolle, 404, 5xx) eller
 * svaret ikke kan tolkes; ellers ett element per post LinkedIn kjenner.
 */
export async function fetchOrganizationShareStatistics(
  organizationUrn: string,
  postIds: string[],
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<LinkedInOrgShareStats[] | null> {
  const ids = Array.from(new Set(postIds.map(normalizeLinkedInPostId).filter(Boolean))).slice(
    0,
    LINKEDIN_SHARE_STATS_BATCH,
  );
  if (ids.length === 0 || !organizationUrn.startsWith('urn:li:organization:')) return null;
  const list = `List(${ids.map((id) => encodeURIComponent(`urn:li:ugcPost:${id}`)).join(',')})`;
  const url =
    `${LINKEDIN_REST_BASE}/organizationalEntityShareStatistics` +
    `?q=organizationalEntity&organizationalEntity=${encodeURIComponent(organizationUrn)}` +
    `&ugcPosts=${list}`;
  try {
    const response = await fetchImpl(url, { headers: linkedInRestHeaders(accessToken) });
    if (!response.ok) {
      console.warn(
        `[linkedin-org-share-stats] ${response.status} for ${organizationUrn} (${ids.length} posts)`,
      );
      return null;
    }
    const body = (await response.json()) as { elements?: ShareStatsElement[] };
    const elements = Array.isArray(body.elements) ? body.elements : [];
    return elements
      .map((el) => {
        const ref = el.ugcPost ?? el.share;
        if (!ref) return null;
        const t = el.totalShareStatistics ?? {};
        return {
          postId: normalizeLinkedInPostId(ref),
          impressions: num(t.impressionCount),
          uniqueImpressions: num(t.uniqueImpressionsCount),
          clicks: num(t.clickCount),
          likes: num(t.likeCount),
          comments: num(t.commentCount),
          shares: num(t.shareCount),
          engagementRate: num(t.engagement),
        } satisfies LinkedInOrgShareStats;
      })
      .filter((row): row is LinkedInOrgShareStats => row !== null);
  } catch (error) {
    console.warn('[linkedin-org-share-stats] fetch threw', error);
    return null;
  }
}
