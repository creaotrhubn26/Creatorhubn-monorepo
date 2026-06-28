/**
 * role-room-social-routes.ts
 *
 * Setup-funksjon for /api/role-room/* social endpoints på non-Meta-plattformer
 * (LinkedIn, YouTube, TikTok) + generelle /social/* endpoints (inbox,
 * publish, analytics, metrics, health, agent-insights).
 *
 * Meta-plattformer (Instagram + Facebook) ligger i en separat modul
 * (./role-room-social-meta-routes.ts — TBD).
 *
 * 16 endpoints:
 *   - GET    /linkedin/companies                       (managed pages)
 *   - GET    /linkedin/profile                         (status)
 *   - GET    /youtube/channels                         (connected channels)
 *   - POST   /youtube/channel-plan                     (Claude → channel-plan)
 *   - POST   /tiktok/oauth/start                       (OAuth init)
 *   - GET    /tiktok/oauth/callback                    (OAuth complete)
 *   - GET    /tiktok/connection                        (status)
 *   - POST   /tiktok/disconnect                        (revoke)
 *   - POST   /social/access-request                    (Claude → access-request-template)
 *   - GET    /social/inbox                             (cross-platform incoming events)
 *   - POST   /social/inbox/:eventId/read               (mark read)
 *   - POST   /social/publish                           (cross-platform publish dispatcher)
 *   - POST   /social/metrics/snapshot                  (insights snapshot)
 *   - GET    /social/analytics                         (analytics aggregat)
 *   - GET    /social/agent-insights                    (AI feedback insights)
 *   - GET    /social/health                            (cross-platform connection status)
 *
 * Auth: requireAdminSession på alle.
 *
 * Wire opp i backend/server/index.ts ved å legge til:
 *
 *   import { setupRoleRoomSocialRoutes } from "./role-room-social-routes";
 *
 *   setupRoleRoomSocialRoutes({
 *     app, pool, requireAdminSession, isCompatAdminFeatureEnabled,
 *   });
 *
 * Mode-noter: Innholdsprodusent-mode-features. Backend mode-agnostic.
 */

import type express from "express";
import type { Pool } from "pg";

import {
  isSupportedPlatform as isSupportedFeedPlatform,
  loadFeedPlan,
  saveFeedPlan,
  type RoleRoomFeedApprovalState,
} from "./role-room-feed-plan.js";
import { listManagedCompaniesForUser } from "./social-publisher-linkedin.js";
import { listYouTubeChannels } from "./social-publisher-youtube.js";
import { generateYouTubeChannelPlan } from "./social-publisher-youtube-channel-plan.js";
import { getTikTokConnectionSummary } from "./social-publisher-tiktok.js";
import { notifyProducerOfClientPlatformConnection } from "./role-room-producer-notifications.js";
import { resolveClientPortalSession } from "./role-room-client-portal.js";
import { getProjectProducerUserId } from "./client-portal-connected-platforms.js";
import {
  startTikTokOauth,
  completeTikTokOauthCallback,
  disconnectTikTok,
  getTikTokConfig,
} from "./role-room-tiktok-oauth.js";
import {
  generateSocialAccessRequest,
  isSupportedAccessRequestPlatform,
} from "./social-access-request.js";
import {
  dispatchPublish,
  dispatchFetchInsights,
} from "./social-publisher.js";
import { buildAgentFeedbackInsights } from "./role-room-agent-feedback-insights.js";
import { getPublishQueueStats } from "./role-room-instagram-publish.js";
import {
  checkEndpointRateLimit,
  RateLimitExceededError,
} from "./role-room-agent-ratelimit.js";
import { claimIdempotencyKey } from "./role-room-social-idempotency.js";

interface AdminSession {
  userId: string;
  email: string;
  name: string;
  role: string;
  loginAt: string;
}

export interface RoleRoomSocialRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireAdminSession: (
    req: express.Request,
    res: express.Response,
  ) => AdminSession | null;
  isCompatAdminFeatureEnabled: (featureId: string) => boolean;
}

/**
 * SQL subquery returning every social account_id the given user owns —
 * IG business + FB page + LinkedIn member + linked YouTube channels. Used to
 * scope both the inbox read (GET) and the mark-as-read write (POST) to the
 * caller's own data. `userParam` is a bind placeholder (e.g. "$2"); pass the
 * same user id for it. Kept in one place so the read and write paths can never
 * drift out of sync (which is how the mark-read endpoint became an IDOR).
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

/**
 * Does the given user own this social connection? Checks all three connection
 * tables (IG/FB, LinkedIn, Google/YouTube) by id + user_id. Fail-closed: any
 * error denies. `id::text` so a non-UUID id can't throw on a UUID column.
 * Used to gate the metrics-snapshot endpoint, which otherwise looked the
 * connection up by id alone (IDOR — one tenant could fetch/persist another
 * tenant's insights using their connection token).
 */
export async function userOwnsSocialConnection(
  pool: Pool,
  connectionId: string,
  userId: string,
): Promise<boolean> {
  try {
    const result = await pool.query(
      `SELECT 1 FROM role_room_instagram_connections WHERE id::text = $1 AND user_id = $2
       UNION ALL
       SELECT 1 FROM role_room_linkedin_connections WHERE id::text = $1 AND user_id = $2
       UNION ALL
       SELECT 1 FROM role_room_google_connections WHERE id::text = $1 AND user_id = $2
       LIMIT 1`,
      [connectionId, userId],
    );
    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    console.error("[social-routes] ownership check failed", error);
    return false;
  }
}

/** Translate a RateLimitExceededError into an HTTP 429 + Retry-After. */
function send429(
  res: express.Response,
  err: RateLimitExceededError,
): express.Response {
  res.setHeader("Retry-After", String(err.retryAfterSeconds));
  return res.status(429).json({
    success: false,
    error: "rate_limited",
    retryAfterSeconds: err.retryAfterSeconds,
  });
}

export function setupRoleRoomSocialRoutes(
  deps: RoleRoomSocialRoutesDeps,
): void {
  const { app, pool, requireAdminSession, isCompatAdminFeatureEnabled } = deps;

  // LinkedIn-orgs som brukeren har ADMINISTRATOR-rolle på. Brukes av
  // Feed Planner-UI for "Publish as"-dropdown og av publish-flyten for
  // å sende riktig organization-URN. Krever w_organization_social i scope —
  // hvis tokenet ikke har det, returnerer vi scopeMissing=true og UI-en
  // kan be brukeren om å reconnecte.
  app.get("/api/role-room/linkedin/companies", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    try {
      const result = await listManagedCompaniesForUser(pool, session.userId);
      return res.json({
        success: true,
        scopeMissing: result.scopeMissing,
        companies: result.companies,
      });
    } catch (error) {
      console.error("[linkedin-companies] failed", error);
      return res.status(500).json({ success: false, error: "Kunne ikke hente LinkedIn-bedrifter." });
    }
  });

  // LinkedIn profile-status — eksponert til Connections Bar slik at vi kan
  // rendre brukerens LinkedIn-konto med navn + avatar (samme nivå som IG).
  // Bruker eksisterende role_room_linkedin_connections-tabell.
  app.get("/api/role-room/linkedin/profile", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    try {
      const result = await pool.query<{
        linkedin_member_id: string | null;
        linkedin_email: string | null;
        linkedin_name: string | null;
        connection_state: string;
        profile: Record<string, unknown> | null;
        expiry_date: Date | null;
      }>(
        `SELECT linkedin_member_id, linkedin_email, linkedin_name,
                connection_state, profile, expiry_date
           FROM role_room_linkedin_connections
          WHERE user_id = $1 AND project_id IS NULL LIMIT 1`,
        [session.userId],
      );
      const row = result.rows[0] ?? null;
      if (!row || !row.linkedin_member_id) {
        return res.json({ success: true, connected: false });
      }
      const profile = row.profile ?? {};
      const profilePictureUrl =
        typeof (profile as Record<string, unknown>).profilePictureUrl === 'string'
          ? ((profile as Record<string, unknown>).profilePictureUrl as string)
          : typeof (profile as Record<string, unknown>).picture === 'string'
            ? ((profile as Record<string, unknown>).picture as string)
            : null;
      return res.json({
        success: true,
        connected: row.connection_state === 'connected' || row.connection_state === 'active',
        memberId: row.linkedin_member_id,
        email: row.linkedin_email,
        name: row.linkedin_name,
        profilePictureUrl,
        tokenExpiresAt: row.expiry_date,
      });
    } catch (error) {
      console.error("[linkedin-profile] query failed", error);
      return res.status(500).json({ success: false, error: "Kunne ikke hente LinkedIn-profil." });
    }
  });

  // brukeren. Brukes av Feed Planner-UI for å (a) bekrefte at en kanal
  // finnes før upload-forsøk, og (b) la brukeren velge mellom personlig
  // kanal og Brand-kontoer hvis flere finnes (managedByMe). Returnerer
  // scopeMissing=true hvis Google-tokenet mangler youtube/youtube.readonly,
  // noConnection=true hvis brukeren ikke har Google-tilkoblet ennå.
  app.get("/api/role-room/youtube/channels", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    try {
      const result = await listYouTubeChannels(pool, session.userId);
      return res.json({
        success: true,
        scopeMissing: result.scopeMissing,
        noConnection: result.noConnection,
        channels: result.channels,
      });
    } catch (error) {
      console.error("[youtube-channels] failed", error);
      return res.status(500).json({ success: false, error: "Kunne ikke hente YouTube-kanaler." });
    }
  });

  // til en plattform kunden eier, lager Claude en konkret e-post produsenten
  // kan kopiere/sende. Plattform-spesifikke trinn (Studio → Tillatelser →
  // Inviter rolle X) er deterministiske; selve e-post-teksten skreddersys
  // til kunden + bransje. Dette lukker det vanligste blokk-hullet i e2e-
  // publish-flyten ("vi har det teknisk klart, men venter på tilgang").
  app.post("/api/role-room/social/access-request", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const projectId = typeof req.body?.projectId === 'string' ? req.body.projectId.trim() : '';
    const platformInput = typeof req.body?.platform === 'string' ? req.body.platform.trim() : '';
    if (!projectId) {
      return res.status(400).json({ success: false, error: "projectId mangler." });
    }
    if (!isSupportedAccessRequestPlatform(platformInput)) {
      return res.status(400).json({
        success: false,
        error: `Plattform "${platformInput}" støttes ikke for tilgangsforespørsel.`,
      });
    }
    const recipientName =
      typeof req.body?.recipientName === 'string' ? req.body.recipientName.trim() : '';
    const recipientEmail =
      typeof req.body?.recipientEmail === 'string' ? req.body.recipientEmail.trim() : '';
    try {
      const result = await generateSocialAccessRequest(pool, {
        projectId,
        platform: platformInput,
        producerEmail: session.email,
        producerName: session.name || session.email.split('@')[0],
        recipientName: recipientName || null,
        recipientEmail: recipientEmail || null,
      });
      return res.json({ success: true, request: result });
    } catch (error) {
      console.error("[social-access-request] failed", error);
      return res
        .status(500)
        .json({ success: false, error: "Kunne ikke generere tilgangsforespørsel." });
    }
  });

  // Følger samme mønster som LinkedIn: produsent klikker «Koble TikTok» →
  // frontend gjør POST /tiktok/oauth/start → vi returnerer authorizationUrl
  // → popup → TikTok callback til /tiktok/oauth/callback → vi lagrer
  // kryptert token. Vi støtter inbox-modus (video.upload-scope) for første
  // versjon; direct publish krever ekstra TikTok App Review.
  app.post("/api/role-room/tiktok/oauth/start", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const config = getTikTokConfig();
    if (!config.configured) {
      return res
        .status(400)
        .json({ success: false, error: "TikTok ikke konfigurert", missing: config.missing });
    }
    try {
      const result = startTikTokOauth({
        userId: session.userId,
        projectId: typeof req.body?.projectId === "string" ? req.body.projectId : null,
        returnPath: typeof req.body?.returnPath === "string" ? req.body.returnPath : null,
        browserOrigin: typeof req.body?.browserOrigin === "string" ? req.body.browserOrigin : null,
      });
      return res.json({ success: true, authorizationUrl: result.authorizationUrl });
    } catch (error) {
      console.error("[tiktok-oauth-start] failed", error);
      return res
        .status(500)
        .json({ success: false, error: (error as Error).message || "Kunne ikke starte TikTok OAuth." });
    }
  });

  // Klient-initiert TikTok-kobling fra portalen. Samme prinsipp som
  // Instagram: produsentens userId + prosjektet bindes inn i state, den
  // delte callbacken lagrer koblingen. Klienten gir consent med egen konto.
  app.post("/api/client/portal/oauth/tiktok/start", async (req, res) => {
    const token = typeof req.query.token === "string" ? req.query.token : "";
    if (!token) return res.status(400).json({ success: false, error: "missing_token" });
    const session = await resolveClientPortalSession(pool, token);
    if (!session) return res.status(404).json({ success: false, error: "invalid_or_expired_token" });
    const config = getTikTokConfig();
    if (!config.configured) {
      return res
        .status(400)
        .json({ success: false, error: "TikTok ikke konfigurert", missing: config.missing });
    }
    const producerUserId = await getProjectProducerUserId(pool, session.projectId);
    if (!producerUserId) {
      return res.status(409).json({
        success: false,
        error: "Prosjektet mangler en produsent å koble kontoen til.",
      });
    }
    try {
      const result = startTikTokOauth({
        userId: producerUserId,
        projectId: session.projectId,
        returnPath: `/client/portal/${encodeURIComponent(token)}`,
        browserOrigin: typeof req.body?.browserOrigin === "string" ? req.body.browserOrigin : null,
      });
      return res.json({ success: true, authorizationUrl: result.authorizationUrl });
    } catch (error) {
      console.error("[tiktok-oauth-start-client] failed", error);
      return res
        .status(500)
        .json({ success: false, error: (error as Error).message || "Kunne ikke starte TikTok OAuth." });
    }
  });

  app.get("/api/role-room/tiktok/oauth/callback", async (req, res) => {
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    if (!code || !state) {
      return res.status(400).send("Missing code or state");
    }
    try {
      const result = await completeTikTokOauthCallback(pool, code, state);
      // Klient-initiert kobling (returnPath satt i state): redirect tilbake til
      // portalen i stedet for pop-up-HTML.
      const pending = (result as {
        pendingState?: { returnPath?: string | null; projectId?: string | null; clientEmail?: string | null };
      })?.pendingState;
      const returnPath = pending?.returnPath;
      if (returnPath && typeof returnPath === "string" && returnPath.startsWith("/")) {
        // Varsle produsent-teamet: tilkoblingen er fullført og aktiv.
        if (pending?.projectId) {
          void notifyProducerOfClientPlatformConnection(pool, {
            projectId: pending.projectId,
            platformLabel: "TikTok",
            platformKey: "tiktok",
            clientEmail: pending.clientEmail ?? null,
          });
        }
        const sep = returnPath.includes("?") ? "&" : "?";
        return res.redirect(`${returnPath}${sep}connected=tiktok`);
      }
      // Pop-up flow: returner enkel HTML som postMessage'er til parent og lukker.
      return res.send(`<!doctype html><html><body><script>
        try { window.opener?.postMessage({ type: 'tiktok-connected' }, '*'); } catch (e) {}
        window.close();
      </script><p>TikTok koblet. Du kan lukke dette vinduet.</p></body></html>`);
    } catch (error) {
      console.error("[tiktok-oauth-callback] failed", error);
      return res
        .status(500)
        .send(`TikTok OAuth feilet: ${(error as Error).message}`);
    }
  });

  app.get("/api/role-room/tiktok/connection", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    try {
      const summary = await getTikTokConnectionSummary(pool, session.userId);
      return res.json({ success: true, ...summary });
    } catch (error) {
      console.error("[tiktok-connection] failed", error);
      return res.status(500).json({ success: false, error: "Kunne ikke hente TikTok-status." });
    }
  });

  app.post("/api/role-room/tiktok/disconnect", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    try {
      await disconnectTikTok(pool, session.userId);
      return res.json({ success: true });
    } catch (error) {
      console.error("[tiktok-disconnect] failed", error);
      return res.status(500).json({ success: false, error: "Kunne ikke koble fra TikTok." });
    }
  });

  // feed-plan (samme datakilde som brukes til Feed Planner). Claude bruker
  // brand-info, bransje og målgruppe til å foreslå kanal-navn, handle,
  // beskrivelse, content pillars, første 5 video-ideer, publiseringskadens
  // og channel-trailer-konsept. Returnerer alltid en strukturert plan slik
  // at frontend kan rendre den ryddig uten å parse fri tekst.
  app.post("/api/role-room/youtube/channel-plan", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const projectId = typeof req.body?.projectId === 'string' ? req.body.projectId.trim() : '';
    if (!projectId) {
      return res.status(400).json({ success: false, error: "projectId mangler." });
    }
    try {
      const plan = await generateYouTubeChannelPlan(pool, projectId, session.userId);
      if (!plan) {
        return res.status(500).json({
          success: false,
          error: "Kunne ikke generere kanal-plan. Prøv igjen om litt.",
        });
      }
      return res.json({ success: true, plan });
    } catch (error) {
      console.error("[youtube-channel-plan] failed", error);
      return res.status(500).json({ success: false, error: "Kunne ikke generere kanal-plan." });
    }
  });

  // ── Cross-platform unified inbox API ─────────────────────────────────────
  // Henter social_events på tvers av alle plattformer for innlogget bruker,
  // med valgfri filter på platform / kind / unread / sentiment.
  app.get("/api/role-room/social/inbox", async (req, res) => {
    const featureId = "role-room-agent-producer";
    if (!isCompatAdminFeatureEnabled(featureId)) {
      return res.status(403).json({ success: false, error: "The Role Room Agent er ikke aktivert." });
    }
    const session = requireAdminSession(req, res);
    if (!session) return;

    const platform = typeof req.query.platform === "string" ? req.query.platform : null;
    const kind = typeof req.query.kind === "string" ? req.query.kind : null;
    const unreadOnly = req.query.unread === "true" || req.query.unread === "1";
    const sentiment = typeof req.query.sentiment === "string" ? req.query.sentiment : null;
    const limit = Math.min(Number(req.query.limit) || 50, 200);

    // Bygg WHERE-clause dynamisk basert på filter.
    const where: string[] = [];
    const params: unknown[] = [];
    // Scope til brukerens egne tilkoblinger. Inkluderer IG-business-id +
    // FB-page-id + LinkedIn-member-id + YouTube-channel-ids (sistnevnte
    // via Google-connection-link på social_metrics-raden).
    where.push(`account_id IN (${ownedSocialAccountIdsSql(`$${params.length + 1}`)})`);
    params.push(session.userId);
    if (platform) {
      where.push(`platform = $${params.length + 1}`);
      params.push(platform);
    }
    if (kind) {
      where.push(`kind = $${params.length + 1}`);
      params.push(kind);
    }
    if (unreadOnly) where.push(`is_read = false`);
    if (sentiment) {
      where.push(`sentiment_label = $${params.length + 1}`);
      params.push(sentiment);
    }
    params.push(limit);

    try {
      const result = await pool.query<{
        id: string;
        platform: string;
        account_id: string;
        external_post_id: string | null;
        kind: string;
        author_username: string | null;
        author_display_name: string | null;
        author_avatar_url: string | null;
        body: string | null;
        sentiment_score: number | null;
        sentiment_label: string | null;
        is_read: boolean;
        occurred_at: Date | null;
        received_at: Date;
      }>(
        `SELECT id, platform, account_id, external_post_id, kind,
                author_username, author_display_name, author_avatar_url, body,
                sentiment_score, sentiment_label, is_read,
                occurred_at, received_at
           FROM social_events
          WHERE ${where.join(" AND ")}
          ORDER BY received_at DESC
          LIMIT $${params.length}`,
        params,
      );
      return res.json({
        success: true,
        events: result.rows.map((r) => ({
          id: r.id,
          platform: r.platform,
          accountId: r.account_id,
          externalPostId: r.external_post_id,
          kind: r.kind,
          authorUsername: r.author_username,
          authorDisplayName: r.author_display_name,
          authorAvatarUrl: r.author_avatar_url,
          body: r.body,
          sentimentScore: r.sentiment_score != null ? Number(r.sentiment_score) : null,
          sentimentLabel: r.sentiment_label,
          isRead: r.is_read,
          occurredAt: r.occurred_at,
          receivedAt: r.received_at,
        })),
      });
    } catch (error) {
      console.error("[social-inbox] query failed", error);
      return res.status(500).json({ success: false, error: "Kunne ikke hente inbox." });
    }
  });

  app.post("/api/role-room/social/inbox/:eventId/read", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    try {
      // Scope the write to the caller's own accounts — same filter as the GET.
      // Previously this updated any social_events row by id, letting one user
      // mark another tenant's events read (IDOR).
      const result = await pool.query(
        `UPDATE social_events SET is_read = true
          WHERE id = $1
            AND account_id IN (${ownedSocialAccountIdsSql("$2")})`,
        [req.params.eventId, session.userId],
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ success: false, error: "Fant ikke hendelsen." });
      }
      return res.json({ success: true });
    } catch (error) {
      console.error("[social-inbox] mark read failed", error);
      return res.status(500).json({ success: false, error: "Kunne ikke merke som lest." });
    }
  });

  // Unified cross-platform publish-endepunkt. Router via dispatcher til
  // riktig SocialPublisher-implementasjon basert på platform-felt i body.
  app.post("/api/role-room/social/publish", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const body = (req.body || {}) as Record<string, unknown>;
    const platform = String(body.platform || "").trim();
    if (!platform) {
      return res.status(400).json({ success: false, error: "platform er påkrevd" });
    }
    const post = body.post as Record<string, unknown> | undefined;
    if (!post || !post.connectionId) {
      return res.status(400).json({ success: false, error: "post.connectionId er påkrevd" });
    }

    // Per-user rate limit — publish hits external Graph APIs + costs quota.
    try {
      checkEndpointRateLimit(session.userId, "social_publish", 30);
    } catch (rlErr) {
      if (rlErr instanceof RateLimitExceededError) return send429(res, rlErr);
      throw rlErr;
    }

    // Ownership gate. For instagram/facebook_page the connectionId is a
    // role_room_instagram_connections row id; dispatchPublish (FB page) derives
    // the connection's owner from that row rather than the session, so without
    // this check one tenant could publish using another tenant's stored Page
    // token (IDOR). LinkedIn/YouTube resolve the connection from the session
    // userId directly (connectionId is ignored there), so they're already
    // user-scoped and don't need this gate.
    if (platform === "instagram" || platform === "facebook_page") {
      if (
        !(await userOwnsSocialConnection(pool, String(post.connectionId), session.userId))
      ) {
        return res.status(404).json({ success: false, error: "connection_not_found" });
      }
    }

    // Idempotency: if the client supplied a stable key, the first claim wins
    // and a duplicate short-circuits without re-publishing. Best-effort — a
    // store error falls through to normal processing.
    const idempotencyKey =
      typeof body.idempotencyKey === "string" && body.idempotencyKey.trim()
        ? body.idempotencyKey.trim()
        : null;
    if (idempotencyKey) {
      try {
        const claim = await claimIdempotencyKey(
          pool,
          "social_publish",
          session.userId,
          idempotencyKey,
        );
        if (!claim.fresh) {
          return res.status(200).json({ success: true, deduped: true });
        }
      } catch (idemErr) {
        console.warn("[social-publish] idempotency claim failed", idemErr);
      }
    }

    const projectId = String(post.projectId || "").trim();
    const feedPlanPostId =
      typeof post.feedPlanPostId === "string" ? post.feedPlanPostId : undefined;

    // Approval-gate: hvis posten er knyttet til en feed-plan, må den være
    // godkjent eller scheduled før vi får publisere. Vi finner posten ved
    // å lese feed-planen for samme prosjekt + en plattform som matcher
    // dispatcher-targeten:
    //   instagram      → feed-plan key 'instagram'
    //   facebook_page  → feed-plan key 'instagram' (deler row med IG)
    //   linkedin       → feed-plan key 'linkedin'
    //   tiktok         → feed-plan key 'tiktok'
    // Hvis feedPlanPostId mangler, hopper vi over gate-en (one-off
    // publish via FB-Mention osv).
    if (projectId && feedPlanPostId) {
      const feedPlatform = platform === "facebook_page" ? "instagram" : platform;
      if (isSupportedFeedPlatform(feedPlatform)) {
        try {
          const plan = await loadFeedPlan(pool, projectId, feedPlatform);
          const matchedPost = plan?.posts.find((p) => p.id === feedPlanPostId);
          if (matchedPost) {
            const state = matchedPost.approvalState ?? "draft";
            if (state !== "approved" && state !== "scheduled") {
              return res.status(409).json({
                success: false,
                error:
                  state === "rejected"
                    ? "Denne posten er avvist og kan ikke publiseres. Endre statusen først."
                    : state === "needs_changes"
                      ? "Posten venter på endringer. Godkjenn på nytt etter at du har redigert."
                      : "Posten må godkjennes før den kan publiseres.",
                approvalState: state,
                gate: "approval_required",
              });
            }
          }
        } catch (gateError) {
          // Ikke fatalt — gate-feil skal ikke blokkere publish hvis feed-
          // planen ikke kan leses (f.eks. permission-feil på en spesifikk
          // pool-tilkobling). Logger og fortsetter.
          console.warn("[social-publish] approval-gate lookup failed", gateError);
        }
      }
    }

    try {
      const result = await dispatchPublish(
        platform as Parameters<typeof dispatchPublish>[0],
        {
          connectionId: String(post.connectionId),
          userId: session.userId,
          projectId,
          feedPlanPostId,
          mediaKind: (post.mediaKind as Parameters<typeof dispatchPublish>[1]["mediaKind"]) ?? "image",
          caption: String(post.caption || ""),
          imageUrl: typeof post.imageUrl === "string" ? post.imageUrl : undefined,
          imageUrls: Array.isArray(post.imageUrls) ? (post.imageUrls as string[]) : undefined,
          videoUrl: typeof post.videoUrl === "string" ? post.videoUrl : undefined,
          extras: (post.extras as Record<string, unknown>) ?? undefined,
          scheduledFor: post.scheduledFor ? new Date(String(post.scheduledFor)) : null,
        },
      );

      // Record publish-event til social_metrics for cross-platform analytics.
      // Dette gir Measure-fasen visibility på publish-rytme også for plattformer
      // som ikke har webhooks (LinkedIn) eller hvor /insights krever flere
      // scopes vi ikke har enda. Best-effort — feiler stille.
      if (result.ok && (result.status === 'published' || result.status === 'scheduled')) {
        try {
          // Resolve account_id. Foretrekk det publisheren returnerte
          // (result.accountId) — sparer en DB round-trip og dekker
          // plattformer (YouTube) som ikke har dedikert connection-tabell.
          let accountId: string | null = result.accountId ?? null;
          // For analytics-scope må vi også vite hvilken connection_id
          // som skal lagres på social_metrics-raden. For IG/FB bruker vi
          // post.connectionId (rad-id i IG-tabellen). For LinkedIn er det
          // user_id-koblingen. For YouTube må vi finne google-connection.
          let metricConnectionId: string = String(post.connectionId);
          if (!accountId && (platform === 'instagram' || platform === 'facebook_page')) {
            const accountRow = await pool.query<{
              account_id: string | null;
            }>(
              `SELECT CASE WHEN $1 = 'facebook_page' THEN facebook_page_id
                           ELSE ig_business_account_id END AS account_id
                 FROM role_room_instagram_connections
                WHERE id = $2 AND user_id = $3 LIMIT 1`,
              [platform, post.connectionId, session.userId],
            );
            accountId = accountRow.rows[0]?.account_id ?? null;
          } else if (!accountId && platform === 'linkedin') {
            const accountRow = await pool.query<{
              linkedin_member_id: string | null;
            }>(
              `SELECT linkedin_member_id FROM role_room_linkedin_connections
                WHERE user_id = $1 LIMIT 1`,
              [session.userId],
            );
            accountId = accountRow.rows[0]?.linkedin_member_id ?? null;
          }
          if (platform === 'youtube') {
            // Erstatt connection_id med Google-connection-rad slik at
            // analytics scope-SQL kan UNION-e channel_ids via user_id-join
            // mot role_room_google_connections.
            const gcRow = await pool.query<{ id: string }>(
              `SELECT id::text AS id FROM role_room_google_connections
                WHERE user_id = $1
                ORDER BY last_used_at DESC NULLS LAST, updated_at DESC NULLS LAST
                LIMIT 1`,
              [session.userId],
            );
            if (gcRow.rows[0]?.id) metricConnectionId = gcRow.rows[0].id;
          }
          if (accountId) {
            await pool.query(
              `INSERT INTO social_metrics
                 (connection_id, platform, account_id, external_post_id, scope,
                  metric_name, metric_value, recorded_at, raw)
               VALUES ($1, $2, $3, $4, 'account', $5, 1, now(), $6::jsonb)`,
              [
                metricConnectionId,
                platform,
                accountId,
                result.externalPostId ?? null,
                result.status === 'published' ? 'publish_count' : 'scheduled_count',
                JSON.stringify({
                  feedPlanPostId,
                  permalink: result.permalink,
                  status: result.status,
                }),
              ],
            );
          }
        } catch (metricErr) {
          console.warn('[social-publish] publish-metric record failed', metricErr);
        }
      }

      // Auto-transition: oppdater feed-plan-postens approvalState etter
      // suksessrik publish/scheduling, slik at UI-en reflekterer ny tilstand
      // uten egen API-rundtur. Best-effort — feiler ikke responsen.
      if (result.ok && projectId && feedPlanPostId) {
        const feedPlatform = platform === "facebook_page" ? "instagram" : platform;
        if (isSupportedFeedPlatform(feedPlatform)) {
          try {
            const plan = await loadFeedPlan(pool, projectId, feedPlatform);
            if (plan) {
              const now = new Date().toISOString();
              const nextState: RoleRoomFeedApprovalState =
                result.status === "published" ? "published" : "scheduled";
              const nextPosts = plan.posts.map((p) =>
                p.id === feedPlanPostId
                  ? {
                      ...p,
                      approvalState: nextState,
                      approvalChangedAt: now,
                      approvalChangedBy: session.email ?? session.userId ?? null,
                      approvalNote: null,
                    }
                  : p,
              );
              await saveFeedPlan(pool, projectId, feedPlatform, nextPosts, {
                brandSnapshot: plan.brandSnapshot,
                updatedBy: session.email ?? session.userId ?? null,
              });
            }
          } catch (postPublishErr) {
            console.warn(
              "[social-publish] auto-transition approval state failed",
              postPublishErr,
            );
          }
        }
      }

      return res.status(result.ok ? 200 : 422).json({ success: result.ok, ...result });
    } catch (error) {
      console.error("[social-publish] dispatch threw", error);
      return res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  });

  // Hent insights for en gitt connection + scope (page-level eller post-id).
  // Resultatet blir også INSERTet i social_metrics for tidsserie-tracking.
  app.post("/api/role-room/social/metrics/snapshot", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const body = (req.body || {}) as Record<string, unknown>;
    const platform = String(body.platform || "").trim();
    const connectionId = String(body.connectionId || "").trim();
    const scope = String(body.scope || "account").trim();
    const externalPostId = typeof body.externalPostId === "string" ? body.externalPostId : undefined;
    if (!platform || !connectionId) {
      return res.status(400).json({ success: false, error: "platform + connectionId påkrevd" });
    }
    // Per-user rate limit — each snapshot triggers a platform insights call.
    try {
      checkEndpointRateLimit(session.userId, "social_snapshot", 60);
    } catch (rlErr) {
      if (rlErr instanceof RateLimitExceededError) return send429(res, rlErr);
      throw rlErr;
    }
    // Ownership gate: without this, any user could pass another tenant's
    // connectionId to fetch (and persist) their insights using the stored
    // token — and the snapshots came back in the response.
    if (!(await userOwnsSocialConnection(pool, connectionId, session.userId))) {
      return res.status(404).json({ success: false, error: "connection_not_found" });
    }
    // Idempotency: dedup repeated snapshot requests carrying the same key so we
    // don't double-insert the same time-series rows. Best-effort.
    const snapshotIdempotencyKey =
      typeof body.idempotencyKey === "string" && body.idempotencyKey.trim()
        ? body.idempotencyKey.trim()
        : null;
    if (snapshotIdempotencyKey) {
      try {
        const claim = await claimIdempotencyKey(
          pool,
          "social_snapshot",
          session.userId,
          snapshotIdempotencyKey,
        );
        if (!claim.fresh) {
          return res.status(200).json({ success: true, deduped: true, snapshots: [] });
        }
      } catch (idemErr) {
        console.warn("[social-metrics] idempotency claim failed", idemErr);
      }
    }
    try {
      const snapshots = await dispatchFetchInsights(
        platform as Parameters<typeof dispatchFetchInsights>[0],
        {
          connectionId,
          externalPostId,
          scope: scope as Parameters<typeof dispatchFetchInsights>[1]["scope"],
        },
      );
      // Persistér til social_metrics for tidsserie-historikk.
      if (snapshots.length > 0) {
        const accountIdRow = await pool.query<{ account_id: string }>(
          `SELECT CASE WHEN $1 = 'facebook_page' THEN facebook_page_id
                       ELSE ig_business_account_id END AS account_id
             FROM role_room_instagram_connections WHERE id = $2 AND user_id = $3 LIMIT 1`,
          [platform, connectionId, session.userId],
        );
        const accountId = accountIdRow.rows[0]?.account_id;
        if (accountId) {
          for (const s of snapshots) {
            try {
              await pool.query(
                `INSERT INTO social_metrics
                   (connection_id, platform, account_id, external_post_id, scope,
                    metric_name, metric_value, metric_value_text, recorded_at, raw)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)`,
                [
                  connectionId,
                  platform,
                  accountId,
                  externalPostId ?? null,
                  s.scope,
                  s.metricName,
                  s.metricValue,
                  s.metricValueText ?? null,
                  s.recordedAt,
                  JSON.stringify(s.raw ?? {}),
                ],
              );
            } catch (insertErr) {
              console.warn("[social-metrics] insert failed", insertErr);
            }
          }
        }
      }
      return res.json({
        success: true,
        snapshots: snapshots.map((s) => ({
          metricName: s.metricName,
          metricValue: s.metricValue,
          scope: s.scope,
          recordedAt: s.recordedAt,
        })),
      });
    } catch (error) {
      console.error("[social-metrics] snapshot failed", error);
      return res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  // Cross-platform analytics aggregator. Powers the Measure-fasen i Role
  // Room Agent. Returnerer summary KPIs (siste 7 + 30 dager), daglig
  // time-series for events/sentiment, og latest account-level metrics-
  // snapshot per platform. Bruker brukerens egne tilkoblinger som scope.
  app.get("/api/role-room/social/analytics", async (req, res) => {
    const featureId = "role-room-agent-producer";
    if (!isCompatAdminFeatureEnabled(featureId)) {
      return res.status(403).json({ success: false, error: "The Role Room Agent er ikke aktivert." });
    }
    const session = requireAdminSession(req, res);
    if (!session) return;

    // Bygg bruker-scoped account_id-set fra IG-tabellen (IG-id + FB-page-id),
    // LinkedIn-tabellen, og YouTube-channel-ids via Google-connection-link.
    // YouTube har ingen dedikert connection-tabell — vi linker via
    // social_metrics.connection_id som peker til role_room_google_connections.
    const scopeSql = `(
      SELECT ig_business_account_id AS account_id FROM role_room_instagram_connections WHERE user_id = $1
      UNION
      SELECT facebook_page_id FROM role_room_instagram_connections
       WHERE user_id = $1 AND facebook_page_id IS NOT NULL
      UNION
      SELECT linkedin_member_id FROM role_room_linkedin_connections
       WHERE user_id = $1 AND linkedin_member_id IS NOT NULL
      UNION
      SELECT DISTINCT account_id FROM social_metrics
       WHERE platform = 'youtube'
         AND connection_id IN (SELECT id FROM role_room_google_connections WHERE user_id = $1)
    )`;

    try {
      const [
        summary7d,
        summary30d,
        sentimentBreakdown,
        dailyEvents,
        dailySentiment,
        latestAccountMetrics,
        topPostMetrics,
        publishesPerPlatform,
      ] = await Promise.all([
        pool.query<{ platform: string; total: string; unread: string }>(
          `SELECT platform,
                  count(*)::text AS total,
                  count(*) FILTER (WHERE NOT is_read)::text AS unread
             FROM social_events
            WHERE account_id IN ${scopeSql}
              AND received_at >= now() - interval '7 days'
            GROUP BY platform`,
          [session.userId],
        ),
        pool.query<{ platform: string; total: string }>(
          `SELECT platform, count(*)::text AS total
             FROM social_events
            WHERE account_id IN ${scopeSql}
              AND received_at >= now() - interval '30 days'
            GROUP BY platform`,
          [session.userId],
        ),
        pool.query<{ platform: string; sentiment_label: string; count: string }>(
          `SELECT platform, sentiment_label, count(*)::text AS count
             FROM social_events
            WHERE account_id IN ${scopeSql}
              AND received_at >= now() - interval '30 days'
              AND sentiment_label IS NOT NULL
            GROUP BY platform, sentiment_label`,
          [session.userId],
        ),
        pool.query<{ day: string; platform: string; count: string }>(
          `SELECT to_char(date_trunc('day', received_at), 'YYYY-MM-DD') AS day,
                  platform, count(*)::text AS count
             FROM social_events
            WHERE account_id IN ${scopeSql}
              AND received_at >= now() - interval '30 days'
            GROUP BY day, platform
            ORDER BY day ASC`,
          [session.userId],
        ),
        pool.query<{ day: string; sentiment_label: string; count: string }>(
          `SELECT to_char(date_trunc('day', received_at), 'YYYY-MM-DD') AS day,
                  sentiment_label, count(*)::text AS count
             FROM social_events
            WHERE account_id IN ${scopeSql}
              AND received_at >= now() - interval '30 days'
              AND sentiment_label IS NOT NULL
            GROUP BY day, sentiment_label
            ORDER BY day ASC`,
          [session.userId],
        ),
        // Siste account-level snapshot per platform/account/metric_name
        pool.query<{
          platform: string;
          account_id: string;
          metric_name: string;
          metric_value: string | null;
          recorded_at: Date;
        }>(
          `SELECT DISTINCT ON (platform, account_id, metric_name)
                  platform, account_id, metric_name, metric_value, recorded_at
             FROM social_metrics
            WHERE account_id IN ${scopeSql}
              AND scope IN ('account', 'page')
            ORDER BY platform, account_id, metric_name, recorded_at DESC`,
          [session.userId],
        ),
        // Top 10 posts ranked by reach over 30d
        pool.query<{
          platform: string;
          external_post_id: string;
          metric_name: string;
          metric_value: string;
          recorded_at: Date;
        }>(
          `SELECT DISTINCT ON (platform, external_post_id, metric_name)
                  platform, external_post_id, metric_name, metric_value, recorded_at
             FROM social_metrics
            WHERE account_id IN ${scopeSql}
              AND scope IN ('post', 'reel', 'video')
              AND external_post_id IS NOT NULL
              AND recorded_at >= now() - interval '30 days'
              AND metric_name IN ('reach', 'impressions', 'post_impressions', 'post_impressions_unique')
            ORDER BY platform, external_post_id, metric_name, recorded_at DESC
            LIMIT 100`,
          [session.userId],
        ),
        // Publish-rytme per plattform — teller publish_count + scheduled_count
        // events siste 30 dager. Gir cross-platform synlighet på "hvor mye
        // har vi publisert hvor".
        pool.query<{ platform: string; published: string; scheduled: string }>(
          `SELECT platform,
                  count(*) FILTER (WHERE metric_name = 'publish_count')::text AS published,
                  count(*) FILTER (WHERE metric_name = 'scheduled_count')::text AS scheduled
             FROM social_metrics
            WHERE account_id IN ${scopeSql}
              AND scope = 'account'
              AND metric_name IN ('publish_count', 'scheduled_count')
              AND recorded_at >= now() - interval '30 days'
            GROUP BY platform`,
          [session.userId],
        ),
      ]);

      return res.json({
        success: true,
        summary: {
          last7d: {
            perPlatform: summary7d.rows.map((r) => ({
              platform: r.platform,
              total: Number(r.total),
              unread: Number(r.unread),
            })),
            totalEvents: summary7d.rows.reduce((sum, r) => sum + Number(r.total), 0),
            totalUnread: summary7d.rows.reduce((sum, r) => sum + Number(r.unread), 0),
          },
          last30d: {
            perPlatform: summary30d.rows.map((r) => ({
              platform: r.platform,
              total: Number(r.total),
            })),
            totalEvents: summary30d.rows.reduce((sum, r) => sum + Number(r.total), 0),
          },
        },
        sentimentBreakdown: sentimentBreakdown.rows.map((r) => ({
          platform: r.platform,
          sentiment: r.sentiment_label,
          count: Number(r.count),
        })),
        dailyEvents: dailyEvents.rows.map((r) => ({
          day: r.day,
          platform: r.platform,
          count: Number(r.count),
        })),
        dailySentiment: dailySentiment.rows.map((r) => ({
          day: r.day,
          sentiment: r.sentiment_label,
          count: Number(r.count),
        })),
        accountMetrics: latestAccountMetrics.rows.map((r) => ({
          platform: r.platform,
          accountId: r.account_id,
          metricName: r.metric_name,
          metricValue: r.metric_value != null ? Number(r.metric_value) : null,
          recordedAt: r.recorded_at,
        })),
        topPosts: topPostMetrics.rows.map((r) => ({
          platform: r.platform,
          externalPostId: r.external_post_id,
          metricName: r.metric_name,
          metricValue: Number(r.metric_value),
          recordedAt: r.recorded_at,
        })),
        publishesPerPlatform: publishesPerPlatform.rows.map((r) => ({
          platform: r.platform,
          published: Number(r.published),
          scheduled: Number(r.scheduled),
        })),
      });
    } catch (error) {
      console.error("[social-analytics] aggregate failed", error);
      return res.status(500).json({
        success: false,
        error: "Kunne ikke hente analytics. Sjekk at social_events-tabellen finnes.",
      });
    }
  });

  // Agent feedback-insights: destillerer Listen + Measure-data tilbake til
  // strategiske signaler som kan vises i Plan-fasen og feed-es inn i agent-
  // prompts ved neste markedsplan-iterasjon.
  app.get("/api/role-room/social/agent-insights", async (req, res) => {
    const featureId = "role-room-agent-producer";
    if (!isCompatAdminFeatureEnabled(featureId)) {
      return res.status(403).json({ success: false, error: "The Role Room Agent er ikke aktivert." });
    }
    const session = requireAdminSession(req, res);
    if (!session) return;
    try {
      const insights = await buildAgentFeedbackInsights(pool, session.userId);
      return res.json({ success: true, insights });
    } catch (error) {
      console.error("[agent-insights] failed", error);
      return res.status(500).json({ success: false, error: "Kunne ikke bygge insights." });
    }
  });

  // Pipeline-observability — bruk fra dashboard / monitoring til å bekrefte
  // at e2e-flyten (webhook → social_events → sentiment-worker → inbox) er
  // alive. Returnerer aggregat-statistikk siste 24 timer.
  app.get("/api/role-room/social/health", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const [
        eventsByPlatform,
        sentimentBacklog,
        lastEvent,
        lastScored,
        tokenStatus,
        publishQueue,
      ] = await Promise.all([
        pool.query<{ platform: string; total: string; unread: string; with_sentiment: string }>(
          `SELECT platform,
                  count(*)::text AS total,
                  count(*) FILTER (WHERE NOT is_read)::text AS unread,
                  count(*) FILTER (WHERE sentiment_processed_at IS NOT NULL)::text AS with_sentiment
             FROM social_events
            WHERE received_at >= now() - interval '24 hours'
            GROUP BY platform`,
        ),
        pool.query<{ count: string }>(
          `SELECT count(*)::text AS count FROM social_events
            WHERE sentiment_processed_at IS NULL AND body IS NOT NULL`,
        ),
        pool.query<{ received_at: Date | null }>(
          `SELECT received_at FROM social_events ORDER BY received_at DESC LIMIT 1`,
        ),
        pool.query<{ sentiment_processed_at: Date | null }>(
          `SELECT sentiment_processed_at FROM social_events
            WHERE sentiment_processed_at IS NOT NULL
            ORDER BY sentiment_processed_at DESC LIMIT 1`,
        ),
        pool.query<{
          connection_state: string;
          bucket: string;
          count: string;
        }>(
          `SELECT connection_state,
                  CASE
                    WHEN token_expires_at IS NULL THEN 'unknown'
                    WHEN token_expires_at < now() THEN 'expired'
                    WHEN token_expires_at < now() + interval '7 days' THEN 'expiring_7d'
                    WHEN token_expires_at < now() + interval '30 days' THEN 'expiring_30d'
                    ELSE 'healthy'
                  END AS bucket,
                  count(*)::text AS count
             FROM role_room_instagram_connections
            GROUP BY connection_state, bucket`,
        ),
        getPublishQueueStats(pool),
      ]);

      // Aggregér token-status på tvers av buckets.
      const tokenSummary = {
        connected: 0,
        expired: 0,
        expiring7d: 0,
        expiring30d: 0,
        healthy: 0,
        revoked: 0,
        otherStates: 0,
      };
      for (const row of tokenStatus.rows) {
        const n = Number(row.count);
        if (row.connection_state === 'revoked') {
          tokenSummary.revoked += n;
          continue;
        }
        if (row.connection_state !== 'connected') {
          tokenSummary.otherStates += n;
          continue;
        }
        tokenSummary.connected += n;
        if (row.bucket === 'expired') tokenSummary.expired += n;
        else if (row.bucket === 'expiring_7d') tokenSummary.expiring7d += n;
        else if (row.bucket === 'expiring_30d') tokenSummary.expiring30d += n;
        else if (row.bucket === 'healthy') tokenSummary.healthy += n;
      }

      return res.json({
        success: true,
        anthropicConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
        metaSecretConfigured: Boolean(process.env.META_APP_SECRET),
        metaAppConfigured: Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET),
        perPlatform24h: eventsByPlatform.rows.map((r) => ({
          platform: r.platform,
          total: Number(r.total),
          unread: Number(r.unread),
          withSentiment: Number(r.with_sentiment),
        })),
        sentimentBacklog: Number(sentimentBacklog.rows[0]?.count ?? 0),
        lastEventReceivedAt: lastEvent.rows[0]?.received_at ?? null,
        lastSentimentScoredAt: lastScored.rows[0]?.sentiment_processed_at ?? null,
        tokenSummary,
        publishQueue,
      });
    } catch (error) {
      console.error("[social-health] query failed", error);
      return res.status(500).json({ success: false, error: "Kunne ikke hente pipeline-status." });
    }
  });

}
