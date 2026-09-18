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
  markFeedPlanPostFailed,
  markFeedPlanPostPublished,
  type RoleRoomFeedApprovalState,
} from "./role-room-feed-plan.js";
import {
  getLinkedInConnectionStatusForUser,
  listManagedCompaniesForUser,
} from "./social-publisher-linkedin.js";
import { listYouTubeChannels } from "./social-publisher-youtube.js";
import { generateYouTubeChannelPlan } from "./social-publisher-youtube-channel-plan.js";
import { getTikTokConnectionSummary } from "./social-publisher-tiktok.js";
import { safeReturnPath } from "./web-origin-allowlist.js";
import { notifyProducerOfClientPlatformConnection } from "./role-room-producer-notifications.js";
import { resolveClientPortalSession } from "./role-room-client-portal.js";
import { getProjectProducerUserId } from "./client-portal-connected-platforms.js";
import { canAccessRoleRoomProject } from "./role-room-projects-routes.js";
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
  type PublishResult,
} from "./social-publisher.js";
import { buildAgentFeedbackInsights } from "./role-room-agent-feedback-insights.js";
import { getPublishQueueStats } from "./role-room-instagram-publish.js";
import {
  checkEndpointRateLimit,
  RateLimitExceededError,
} from "./role-room-agent-ratelimit.js";
import { claimIdempotencyKey } from "./role-room-social-idempotency.js";
import {
  enqueueLinkedInPublishJob,
  getLinkedInPublishQueueStats,
  LinkedInPublishQueueConflictError,
  type LinkedInQueueMediaKind,
} from "./role-room-linkedin-publish-queue.js";

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

/**
 * LinkedIn publishing accepts either the producer's global connection or the
 * connection bound to this exact project. A project-scoped row from another
 * project must never be usable, even when it has the same producer user_id.
 */
export async function userCanUseLinkedInConnection(
  pool: Pool,
  connectionId: string,
  userId: string,
  projectId: string,
  requiredScopes: string[] = ['w_member_social'],
): Promise<boolean> {
  if (
    !connectionId
    || connectionId.length > 200
    || !projectId
    || requiredScopes.length === 0
    || requiredScopes.some((scope) => !/^[a-z_]+$/i.test(scope))
  ) return false;
  try {
    const result = await pool.query(
      `SELECT 1
         FROM role_room_linkedin_connections
        WHERE id::text = $1
          AND user_id = $2
          AND (project_id IS NULL OR project_id = $3)
          AND connection_state IN ('connected', 'active')
          AND expiry_date > NOW()
          AND scopes @> $4::jsonb
        LIMIT 1`,
      [connectionId, userId, projectId, JSON.stringify(requiredScopes)],
    );
    return (result.rowCount ?? result.rows.length) > 0;
  } catch (error) {
    console.error('[social-routes] LinkedIn connection check failed', error);
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
      const projectId = typeof req.query.projectId === "string"
        ? req.query.projectId.trim() || null
        : null;
      if (projectId && !(await canAccessRoleRoomProject(pool, session.userId, projectId))) {
        return res.status(403).json({ success: false, error: 'Ingen tilgang til prosjektet.' });
      }
      const result = await listManagedCompaniesForUser(pool, session.userId, projectId);
      return res.json({
        success: true,
        scopeMissing: result.scopeMissing,
        reconnectRequired: result.reconnectRequired,
        connectionScope: result.connectionScope,
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
      const projectId = typeof req.query.projectId === 'string'
        ? req.query.projectId.trim() || null
        : null;
      if (projectId && !(await canAccessRoleRoomProject(pool, session.userId, projectId))) {
        return res.status(403).json({ success: false, error: 'Ingen tilgang til prosjektet.' });
      }
      const [personalStatus, organizationStatus] = await Promise.all([
        getLinkedInConnectionStatusForUser(pool, session.userId, {
          author: 'personal',
        }),
        getLinkedInConnectionStatusForUser(pool, session.userId, {
          projectId,
          author: 'company',
        }),
      ]);
      const displayStatus = personalStatus.connectionId ? personalStatus : organizationStatus;
      const scopes = [...new Set([...personalStatus.scopes, ...organizationStatus.scopes])];
      return res.json({
        success: true,
        ...displayStatus,
        connected: personalStatus.connected || organizationStatus.connected,
        connectionId: personalStatus.connectionId ?? organizationStatus.connectionId,
        personalConnectionId: personalStatus.connectionId,
        organizationConnectionId: organizationStatus.connectionId,
        scopes,
        publishReady: personalStatus.publishReady,
        organizationPublishReady: organizationStatus.organizationPublishReady,
        reconnectRequired:
          personalStatus.connectionId !== null && !personalStatus.publishReady,
        organizationReconnectRequired:
          organizationStatus.connectionId !== null
          && !organizationStatus.organizationPublishReady,
        capabilities: {
          personal: personalStatus.publishReady,
          organization: organizationStatus.organizationPublishReady,
        },
        tokenExpiresAt: displayStatus.expiresAt,
        projectId,
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
    // Eierskaps-gate: produsent må eie/være medlem av prosjektet. Uten dette kan
    // enhver admin-sesjon oppgi en vilkårlig projectId og lekke en annen
    // produsents merkevare-kontekst (companyName/industry) fra role_room_feed_plans.
    if (!(await canAccessRoleRoomProject(pool, session.userId, projectId))) {
      return res.status(403).json({ success: false, error: "Ingen tilgang til prosjektet." });
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
        .json({ success: false, error: "Kunne ikke starte TikTok OAuth." });
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
        .json({ success: false, error: "Kunne ikke starte TikTok OAuth." });
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
      // Reject scheme-relative (`//host`) and backslash (`/\host`, which
      // browsers normalize to `//host`) open-redirect bypasses. safeReturnPath
      // returns "" (falsy) for anything that isn't a clean root-relative path,
      // so we fall through to the popup-HTML flow instead of redirecting.
      const returnPath = safeReturnPath(pending?.returnPath, "");
      if (returnPath) {
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
        .send("TikTok OAuth feilet. Lukk dette vinduet og prøv igjen.");
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
    // Eierskaps-gate: generateYouTubeChannelPlan forkaster userId-argumentet og
    // leser prosjektets merkevare-kontekst kun på project_id — uten denne sjekken
    // kan enhver admin-sesjon lese en annen produsents prosjekt via UUID.
    if (!(await canAccessRoleRoomProject(pool, session.userId, projectId))) {
      return res.status(403).json({ success: false, error: "Ingen tilgang til prosjektet." });
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
    // token (IDOR). YouTube resolves the connection from the session userId.
    // LinkedIn is checked below together with project/feed-plan ownership.
    if (platform === "instagram" || platform === "facebook_page") {
      if (
        !(await userOwnsSocialConnection(pool, String(post.connectionId), session.userId))
      ) {
        return res.status(404).json({ success: false, error: "connection_not_found" });
      }
    }

    const idempotencyKey =
      typeof body.idempotencyKey === "string" && body.idempotencyKey.trim()
        ? body.idempotencyKey.trim()
        : null;
    const projectId = String(post.projectId || "").trim();
    const feedPlanPostId =
      typeof post.feedPlanPostId === "string" && post.feedPlanPostId.trim()
        ? post.feedPlanPostId.trim()
        : undefined;
    const hasProjectReference = Boolean(projectId);
    const hasFeedPlanReference = Boolean(feedPlanPostId);
    if (hasProjectReference !== hasFeedPlanReference) {
      return res.status(400).json({
        success: false,
        error: "projectId og feedPlanPostId må sendes sammen.",
        gate: "feed_plan_reference_incomplete",
      });
    }
    if (platform === 'linkedin' && (!projectId || !feedPlanPostId)) {
      return res.status(400).json({
        success: false,
        error: 'LinkedIn-publisering må være knyttet til en feed-planpost.',
        gate: 'linkedin_feed_plan_reference_required',
      });
    }
    if (platform === 'linkedin' && !idempotencyKey) {
      return res.status(400).json({
        success: false,
        error: 'idempotencyKey er påkrevd for LinkedIn-publisering.',
        gate: 'idempotency_key_required',
      });
    }

    const hasScheduledFor = post.scheduledFor !== null
      && post.scheduledFor !== undefined
      && String(post.scheduledFor).trim().length > 0;
    const scheduledFor = hasScheduledFor
      ? new Date(String(post.scheduledFor))
      : null;
    if (scheduledFor && !Number.isFinite(scheduledFor.getTime())) {
      return res.status(400).json({
        success: false,
        error: "post.scheduledFor må være et gyldig tidspunkt.",
      });
    }
    if (scheduledFor && scheduledFor.getTime() <= Date.now()) {
      return res.status(400).json({
        success: false,
        error: 'Planlagt publisering må ligge i fremtiden.',
        gate: 'scheduled_time_not_future',
      });
    }
    if (idempotencyKey && idempotencyKey.length > 240) {
      return res.status(400).json({ success: false, error: 'idempotencyKey er for lang.' });
    }
    const mediaKind =
      (post.mediaKind as Parameters<typeof dispatchPublish>[1]["mediaKind"] | undefined)
      ?? "image";
    const extras =
      post.extras && typeof post.extras === "object" && !Array.isArray(post.extras)
        ? (post.extras as Record<string, unknown>)
        : undefined;

    // Fail-closed approval and tenant gate. Once either feed-plan reference is
    // present, a missing plan/post, unsupported platform or lookup failure must
    // block publishing rather than silently becoming a one-off publish.
    if (projectId && feedPlanPostId) {
      try {
        const feedPlatform = platform === "facebook_page" ? "instagram" : platform;
        if (!isSupportedFeedPlatform(feedPlatform)) {
          return res.status(400).json({
            success: false,
            error: "Plattformen støtter ikke feed-planpublisering.",
            gate: "unsupported_feed_platform",
          });
        }
        if (!(await canAccessRoleRoomProject(pool, session.userId, projectId))) {
          return res.status(403).json({
            success: false,
            error: "Ingen tilgang til prosjektet.",
            gate: "project_access_required",
          });
        }
        if (
          platform === 'linkedin'
          && !(await userCanUseLinkedInConnection(
            pool,
            String(post.connectionId),
            session.userId,
            projectId,
            typeof extras?.linkedInOrganizationUrn === 'string'
              ? ['r_organization_admin', 'w_organization_social']
              : ['w_member_social'],
          ))
        ) {
          return res.status(404).json({ success: false, error: 'connection_not_found' });
        }
        const plan = await loadFeedPlan(pool, projectId, feedPlatform);
        const matchedPost = plan?.posts.find((candidate) => candidate.id === feedPlanPostId);
        if (!plan || !matchedPost) {
          return res.status(409).json({
            success: false,
            error: "Feed-planen eller posten finnes ikke. Last inn planen på nytt.",
            gate: "feed_plan_post_not_found",
          });
        }
        const state = matchedPost.approvalState ?? "draft";
        const isSameFutureLinkedInSchedule =
          state === "scheduled"
          && platform === "linkedin"
          && scheduledFor !== null
          && matchedPost.scheduledFor === scheduledFor.toISOString();
        if (state !== "approved" && !isSameFutureLinkedInSchedule) {
          return res.status(409).json({
            success: false,
            error:
              state === "rejected"
                ? "Denne posten er avvist og kan ikke publiseres. Endre statusen først."
                : state === "needs_changes"
                  ? "Posten venter på endringer. Godkjenn på nytt etter at du har redigert."
                  : state === "scheduled"
                    ? "Posten er allerede planlagt og kan ikke publiseres umiddelbart."
                    : "Posten må godkjennes før den kan publiseres.",
            approvalState: state,
            gate: "approval_required",
          });
        }
      } catch (error) {
        console.error('[social-publish] approval or connection gate failed', error);
        return res.status(503).json({
          success: false,
          error: 'Kunne ikke verifisere publiseringstilgangen. Prøv igjen.',
          gate: 'publish_gate_unavailable',
        });
      }
    }

    let linkedInImmediateExternalDispatchStarted = false;
    try {
      let result: PublishResult & {
        deduped?: boolean;
        scheduledFor?: string;
      };
      let immediateIdempotencyClaimed = false;
      const isFutureLinkedInPublish =
        platform === "linkedin"
        && scheduledFor !== null
        && scheduledFor.getTime() > Date.now();
      if (isFutureLinkedInPublish) {
        const supportedKinds = new Set<LinkedInQueueMediaKind>([
          "text",
          "image",
          "carousel",
          "video",
          "reel",
          "link",
        ]);
        if (!supportedKinds.has(mediaKind as LinkedInQueueMediaKind)) {
          return res.status(400).json({
            success: false,
            error: `LinkedIn scheduling støtter ikke mediaKind "${mediaKind}".`,
          });
        }
        const queued = await enqueueLinkedInPublishJob(pool, {
          connectionId: String(post.connectionId),
          userId: session.userId,
          projectId,
          feedPlanPostId: feedPlanPostId!,
          mediaKind: mediaKind as LinkedInQueueMediaKind,
          caption: String(post.caption || ""),
          imageUrl: typeof post.imageUrl === "string" ? post.imageUrl : undefined,
          imageUrls: Array.isArray(post.imageUrls) ? (post.imageUrls as string[]) : undefined,
          videoUrl: typeof post.videoUrl === "string" ? post.videoUrl : undefined,
          extras,
          scheduledFor,
          idempotencyKey,
          changedBy: session.email || session.userId,
        });
        result = {
          ok: true,
          status: "scheduled",
          jobId: queued.job.id,
          deduped: queued.deduped,
          scheduledFor: queued.job.scheduledFor.toISOString(),
        };
      } else {
        // Immediate idempotency is separate from the durable queue's unique
        // key. Claim only after all auth/approval checks have succeeded.
        if (idempotencyKey) {
          try {
            const claim = await claimIdempotencyKey(
              pool,
              "social_publish",
              session.userId,
              idempotencyKey,
            );
            if (!claim.fresh) {
              return res.status(409).json({
                success: false,
                deduped: true,
                error: "idempotency_key_already_claimed",
                state: "unknown_or_in_progress",
              });
            }
            immediateIdempotencyClaimed = true;
          } catch (idemErr) {
            console.error("[social-publish] idempotency claim failed", idemErr);
            return res.status(503).json({
              success: false,
              error: 'Kunne ikke sikre publiseringsforespørselen. Prøv igjen.',
              gate: 'idempotency_unavailable',
            });
          }
        }
        if (platform === 'linkedin') {
          linkedInImmediateExternalDispatchStarted = true;
        }
        result = await dispatchPublish(
          platform as Parameters<typeof dispatchPublish>[0],
          {
            connectionId: String(post.connectionId),
            userId: session.userId,
            projectId,
            feedPlanPostId,
            mediaKind,
            caption: String(post.caption || ""),
            imageUrl: typeof post.imageUrl === "string" ? post.imageUrl : undefined,
            imageUrls: Array.isArray(post.imageUrls) ? (post.imageUrls as string[]) : undefined,
            videoUrl: typeof post.videoUrl === "string" ? post.videoUrl : undefined,
            extras,
            scheduledFor,
          },
        );
      }

      const linkedInPublishApiFailure =
        result.reason === 'linkedin_api_error'
        && /^publisering feilet:/i.test(result.error ?? '');
      const linkedInOutcomeUncertain =
        platform === 'linkedin'
        && !result.ok
        && (
          result.reason === 'network_error'
          || linkedInPublishApiFailure
        );

      if (immediateIdempotencyClaimed && !result.ok && idempotencyKey) {
        const safelyRetryableReasons = new Set([
          'validation_failed',
          'unsupported_media_kind',
          'platform_not_registered',
          'connection_not_found',
          'connection_lookup_failed',
          'scope_missing',
          'token_expired',
          'reconnect_required',
          'organization_not_managed',
          'org_not_managed',
          'organization_access_denied',
          'permission_denied',
          // A 429 is a definite provider response, including from POST /posts;
          // no ambiguous transport failure occurred, so retrying is safe.
          'rate_limited',
        ]);
        const safelyRetryableLinkedInApiFailure =
          platform === 'linkedin'
          && result.reason === 'linkedin_api_error'
          && /^(?:bildeopplasting(?: \d+)?|videoopplasting|siderollekontroll) feilet:/i
            .test(result.error ?? '');
        if (
          safelyRetryableReasons.has(result.reason ?? '')
          || safelyRetryableLinkedInApiFailure
        ) {
          try {
            await pool.query(
              `DELETE FROM role_room_social_idempotency
                WHERE scope = $1 AND user_id = $2 AND key = $3`,
              ['social_publish', session.userId, idempotencyKey],
            );
          } catch (error) {
            console.warn('[social-publish] failed to release safe idempotency claim', error);
          }
        }
      }
      if (linkedInOutcomeUncertain) {
        await markFeedPlanPostFailed(
          pool,
          projectId,
          feedPlanPostId!,
          'Utfallet er ukjent. Kontroller LinkedIn manuelt før du forsøker på nytt.',
        );
        return res.status(202).json({
          success: false,
          ok: false,
          status: 'uncertain',
          reason: 'publish_outcome_uncertain',
          error: 'LinkedIn svarte ikke entydig. Kontroller profilen eller siden før du prøver på nytt.',
        });
      }

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
            const organizationUrn =
              typeof extras?.linkedInOrganizationUrn === 'string'
                ? extras.linkedInOrganizationUrn
                : null;
            if (organizationUrn) accountId = organizationUrn;
            const accountRow = await pool.query<{
              linkedin_member_id: string | null;
            }>(
              `SELECT linkedin_member_id FROM role_room_linkedin_connections
                WHERE user_id = $1 AND project_id IS NULL LIMIT 1`,
              [session.userId],
            );
            accountId = accountId ?? accountRow.rows[0]?.linkedin_member_id ?? null;
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
      const { raw: _providerRaw, ...publicResult } = result;

      // Auto-transition: oppdater feed-plan-postens approvalState etter
      // suksessrik publish/scheduling, slik at UI-en reflekterer ny tilstand
      // uten egen API-rundtur. Best-effort — feiler ikke responsen.
      if (result.ok && projectId && feedPlanPostId) {
        if (platform === "linkedin" && result.status === "published") {
          try {
            await markFeedPlanPostPublished(pool, projectId, feedPlanPostId, {
              externalPostId: result.externalPostId ?? null,
              permalink: result.permalink ?? null,
              changedBy: session.email || session.userId,
            });
          } catch (postPublishErr) {
            console.warn(
              "[social-publish] LinkedIn feed-plan transition failed",
              postPublishErr,
            );
          }
          return res.status(200).json({ success: true, ...publicResult });
        }
        // Scheduled LinkedIn jobs transition atomically in enqueue; do not
        // overwrite their publishJobId through the generic save path.
        if (platform === "linkedin" && result.status === "scheduled") {
          return res.status(200).json({ success: true, ...publicResult });
        }
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

      return res.status(result.ok ? 200 : 422).json({
        success: result.ok,
        ...publicResult,
      });
    } catch (error) {
      if (error instanceof LinkedInPublishQueueConflictError) {
        return res.status(409).json({
          success: false,
          error: error.code,
          gate: 'already_scheduled',
        });
      }
      if (
        platform === 'linkedin'
        && linkedInImmediateExternalDispatchStarted
        && projectId
        && feedPlanPostId
      ) {
        await markFeedPlanPostFailed(
          pool,
          projectId,
          feedPlanPostId,
          'Utfallet er ukjent. Kontroller LinkedIn manuelt før du forsøker på nytt.',
        );
        return res.status(202).json({
          success: false,
          ok: false,
          status: 'uncertain',
          reason: 'publish_outcome_uncertain',
          error: 'LinkedIn-publiseringen kunne ikke bekreftes. Kontroller LinkedIn før du prøver på nytt.',
        });
      }
      console.error("[social-publish] dispatch threw", error);
      return res.status(500).json({
        success: false,
        error: 'Kunne ikke fullføre publiseringen. Kontroller status før du prøver igjen.',
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
      return res.status(500).json({ success: false, error: "internal_error" });
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
        linkedInPublishQueue,
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
        getLinkedInPublishQueueStats(pool),
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
        linkedInPublishQueue,
      });
    } catch (error) {
      console.error("[social-health] query failed", error);
      return res.status(500).json({ success: false, error: "Kunne ikke hente pipeline-status." });
    }
  });

}
