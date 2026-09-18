/**
 * LinkedIn socialActions — likes og kommentarer for én publisert post.
 *
 * Delt mellom social-linkedin-insights-worker.ts (social_metrics-sweep) og
 * role-room-kpi-connectors.ts (KPI-snapshots for markedsplaner). LinkedIn
 * har ingen webhooks for member-level poster, så polling er eneste vei.
 *
 * Endepunkt: GET /v2/socialActions/{urn:li:ugcPost:<id>}
 * Scope: r_member_social (egne poster) / r_organization_social (bedriftsside).
 */

const LINKEDIN_SOCIAL_ACTIONS_BASE = 'https://api.linkedin.com/v2/socialActions';

export interface LinkedInSocialActions {
  likes: number | null;
  comments: number | null;
}

/** Normaliserer «urn:li:ugcPost:123», «urn:li:share:123» og «123» til «123». */
export function normalizeLinkedInPostId(value: string): string {
  return String(value).replace('urn:li:share:', '').replace('urn:li:ugcPost:', '').trim();
}

/**
 * Henter like-/kommentar-tellere. Returnerer null ved 404 (posten er
 * slettet) eller andre feil — kalleren skal ikke rope om det.
 */
export async function fetchLinkedInSocialActions(
  postId: string,
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<LinkedInSocialActions | null> {
  try {
    const urn = `urn:li:ugcPost:${normalizeLinkedInPostId(postId)}`;
    const response = await fetchImpl(`${LINKEDIN_SOCIAL_ACTIONS_BASE}/${encodeURIComponent(urn)}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
    });
    if (!response.ok) return null;
    const body = (await response.json()) as {
      likesSummary?: { totalLikes?: number };
      commentsSummary?: { totalFirstLevelComments?: number };
    };
    return {
      likes:
        typeof body.likesSummary?.totalLikes === 'number' ? body.likesSummary.totalLikes : null,
      comments:
        typeof body.commentsSummary?.totalFirstLevelComments === 'number'
          ? body.commentsSummary.totalFirstLevelComments
          : null,
    };
  } catch (error) {
    console.warn('[linkedin-social-actions] fetch threw', error);
    return null;
  }
}
