/**
 * role-room-agent-inbox-reply.ts — Inbox reply-drafting (Phase 2b).
 *
 * A producer, from the unified social Inbox, asks the agent to draft a reply to
 * ONE specific comment / mention / DM. Privacy posture (agreed): this is
 * user-initiated and per-element — ONLY that single comment's text is sent to
 * Claude. We never bulk-send inbox data, and we never include author names or
 * any other events. See docs/role-room/ai-gdpr-dpia.md.
 *
 * Ownership: the social_events row is loaded BY id AND scoped to the caller's
 * own connections using the exact same subquery the inbox GET/POST routes use
 * (ownedSocialAccountIdsSql in role-room-social-routes.ts — IG business + FB
 * page + LinkedIn member + linked YouTube channels). If the row isn't the
 * caller's, we return { ok:false, error:'not_owned' } and send nothing to the
 * model. The scoping is duplicated here (not imported) deliberately so the
 * read+write paths in the routes file stay self-contained; if it ever changes
 * there, this comment is the cross-reference.
 *
 * Never throws — any failure (disabled flag, missing key, model error) resolves
 * to { ok:false, error }.
 */

import type { Pool } from 'pg';

import { runClaudeAgent } from './role-room-agent-claude.js';

export interface DraftInboxReplyInput {
  userId: string;
  eventId: string;
  /** Optional brand-voice / tone hint (e.g. "varm, profesjonell, kortfattet"). */
  brandVoice?: string | null;
  /** Optional extra producer instruction for this specific reply. */
  instructions?: string | null;
}

export type DraftInboxReplyResult =
  | { ok: true; draft: string; model: string }
  | { ok: false; error: string };

/**
 * Subquery returning every social account_id the user owns. Mirrors
 * ownedSocialAccountIdsSql() in role-room-social-routes.ts EXACTLY. `userParam`
 * is a bind placeholder (e.g. "$2"); pass the user id for it.
 */
function ownedSocialAccountIdsSql(userParam: string): string {
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

const PLATFORM_LABEL: Record<string, string> = {
  instagram: 'Instagram',
  facebook_page: 'Facebook',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  x: 'X',
  threads: 'Threads',
};

const SYSTEM_PROMPT = [
  'Du er en sosiale-medier-svaransvarlig som hjelper en innholdsprodusent å svare på',
  'kommentarer, omtaler og DM-er på vegne av en merkevare.',
  'Skriv ETT kort, naturlig og merkevare-tilpasset svar — klart til å lime inn.',
  'Regler:',
  '- Svar på SAMME språk som kommentaren (norsk hvis kommentaren er norsk).',
  '- Hold det kort: 1–3 setninger. Ingen hashtags med mindre det er åpenbart naturlig.',
  '- Hvis kommentaren er negativ eller en klage: vær empatisk og de-eskalerende, ',
  '  ta eieransvar uten å være defensiv, og tilby et neste steg (f.eks. ta det på DM).',
  '- Hvis kommentaren er positiv: vær varm og takknemlig, ikke generisk.',
  '- Aldri lov noe konkret (pris, dato, refusjon) du ikke kan vite.',
  '- Ikke finn på navn, lenker eller fakta. Ikke bruk plassholdere som [navn].',
  'Returner KUN selve svarteksten — ingen forklaring, ingen anførselstegn rundt.',
].join('\n');

/**
 * Draft a single on-brand reply for one inbox event. PII-minimal: only the
 * comment body + platform + an optional tone hint reach the model.
 */
export async function draftInboxReply(
  pool: Pool,
  input: DraftInboxReplyInput,
): Promise<DraftInboxReplyResult> {
  const userId = (input.userId || '').trim();
  const eventId = (input.eventId || '').trim();
  if (!userId) return { ok: false, error: 'missing_user' };
  if (!eventId) return { ok: false, error: 'missing_event' };

  let row: { platform: string; kind: string; body: string | null } | null = null;
  try {
    // Load the single event BY id AND verify the caller owns it via the same
    // account-scoping the inbox routes use. id::text guards against a non-UUID
    // id throwing on a UUID column.
    const result = await pool.query<{ platform: string; kind: string; body: string | null }>(
      `SELECT platform, kind, body
         FROM social_events
        WHERE id::text = $1
          AND account_id IN (${ownedSocialAccountIdsSql('$2')})
        LIMIT 1`,
      [eventId, userId],
    );
    row = result.rows[0] ?? null;
  } catch (error) {
    console.error('[inbox-reply] ownership/load query failed', error);
    return { ok: false, error: 'lookup_failed' };
  }

  if (!row) {
    // Either the event doesn't exist or it isn't the caller's. Fail-closed —
    // never reveal which, and never send anything to the model.
    return { ok: false, error: 'not_owned' };
  }

  const body = (row.body || '').trim();
  if (!body) {
    // Reactions / empty events have nothing to reply to.
    return { ok: false, error: 'no_body' };
  }

  const platformLabel = PLATFORM_LABEL[row.platform] ?? row.platform;
  const brandVoice = (input.brandVoice || '').trim();
  const instructions = (input.instructions || '').trim();

  // Build the per-call user message with ONLY this comment + minimal context.
  // No author name, no other events, no account ids.
  const userMessage = [
    `Plattform: ${platformLabel}`,
    `Type: ${row.kind}`,
    brandVoice ? `Merkevarestemme/tone: ${brandVoice}` : null,
    instructions ? `Ekstra instruks fra produsent: ${instructions}` : null,
    '',
    'Kommentar å svare på:',
    '"""',
    body,
    '"""',
    '',
    'Skriv det beste svaret.',
  ]
    .filter((line) => line !== null)
    .join('\n');

  try {
    const response = await runClaudeAgent({
      cachedSystem: SYSTEM_PROMPT,
      userMessage,
      maxTokens: 400,
      feature: 'role-room/inbox-reply',
      userId,
      route: '/api/role-room/social/inbox/:eventId/draft-reply',
    });
    const draft = (response.text || '').trim();
    if (!draft) return { ok: false, error: 'empty_draft' };
    return { ok: true, draft, model: response.model };
  } catch (error) {
    console.error('[inbox-reply] claude call failed', error);
    return { ok: false, error: 'draft_failed' };
  }
}
