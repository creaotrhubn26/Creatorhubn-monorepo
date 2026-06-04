/**
 * role-room-social-meta-routes.ts
 *
 * Setup-funksjon for /api/role-room/{instagram,facebook}/* endpoints —
 * Meta Graph API-integrasjon for OAuth, publishing, webhooks, og
 * data-deletion (GDPR/Meta App Review-krav).
 *
 * 16 endpoints:
 *   Instagram (10):
 *     - GET  /instagram/oauth/start                  (OAuth init med signed state)
 *     - GET  /instagram/oauth/callback               (token-exchange + IG-account discovery)
 *     - GET  /instagram/connections                  (list user's connections)
 *     - DELETE /instagram/connections/:connectionId  (revoke)
 *     - POST /instagram/publish                      (queue + publish via worker)
 *     - GET  /instagram/jobs/:projectId              (publish queue jobs for project)
 *     - GET  /instagram/webhook                      (Meta verify token)
 *     - POST /instagram/webhook                      (events + signature-sjekk)
 *     - POST /instagram/deauthorize                  (Meta de-authorize callback)
 *     - POST /instagram/data-deletion                (GDPR data-deletion request)
 *     - GET  /instagram/data-deletion/:code          (status lookup)
 *   Facebook (4):
 *     - GET  /facebook/pages                         (managed Pages list)
 *     - POST /facebook/publish-video                 (Reel/Video publish)
 *     - POST /facebook/publish-page-post             (text/photo Page post)
 *     - GET  /facebook/webhook                       (Meta verify)
 *     - POST /facebook/webhook                       (events + signature-sjekk)
 *
 * Auth: requireAdminSession på admin-endpoints; webhook-endpoints public
 * men signatur-sjekket via verifyMetaWebhookSignature.
 *
 * Wire opp i backend/server/index.ts ved å legge til:
 *
 *   import { setupRoleRoomSocialMetaRoutes } from "./role-room-social-meta-routes";
 *
 *   setupRoleRoomSocialMetaRoutes({
 *     app, pool, requireAdminSession,
 *   });
 *
 * Mode-noter: Innholdsprodusent-mode-features. Backend mode-agnostic.
 */

import express from "express";
import type { Pool } from "pg";

import {
  buildAuthorizationUrl,
  discoverIgBusinessAccounts,
  exchangeCodeForShortLivedToken,
  exchangeForLongLivedToken,
  fetchMetaUserId,
  getMetaAppConfig,
  listInstagramConnections,
  META_REQUIRED_SCOPES,
  revokeConnection as revokeIgConnection,
  signOauthState,
  subscribeFbPageWebhookFields,
  subscribeIgWebhookFields,
  upsertInstagramConnection,
  verifyOauthState,
} from "./role-room-instagram-oauth.js";
import {
  getPublishQueueStats,
  IG_RATE_LIMIT_PER_24H,
  listPublishJobs as listIgPublishJobs,
  queueAndPublish as queueAndPublishIg,
} from "./role-room-instagram-publish.js";
import {
  parseMetaWebhookEvent,
  summariseEvent as summariseMetaWebhookEvent,
  verifyMetaWebhookSignature,
} from "./role-room-instagram-webhook.js";
import {
  flattenFacebookPageWebhookEvent,
  flattenIgWebhookEvent,
  persistSocialEvent,
} from "./social-events.js";
import { persistInboundDmFromWebhook } from "./role-room-ig-messaging.js";
import {
  fetchDataDeletionRequest,
  parseSignedRequest,
  recordDataDeletionRequest,
  revokeConnectionsForFbUser,
} from "./role-room-instagram-deauth.js";
import { isInstagramImageUploadConfigured } from "./role-room-instagram-image-upload.js";
import { checkAgentEntitlement } from "./role-room-agent-entitlements.js";

interface AdminSession {
  userId: string;
  email: string;
  name: string;
  role: string;
  loginAt: string;
}

export interface RoleRoomSocialMetaRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireAdminSession: (
    req: express.Request,
    res: express.Response,
  ) => AdminSession | null;
  isCompatAdminFeatureEnabled: (featureId: string) => boolean;
}

export function setupRoleRoomSocialMetaRoutes(
  deps: RoleRoomSocialMetaRoutesDeps,
): void {
  const { app, pool, requireAdminSession, isCompatAdminFeatureEnabled } = deps;

  // ── Instagram publishing endpoints ────────────────────────────────────

  app.get("/api/role-room/instagram/oauth/start", async (req, res) => {
    const featureId = "role-room-agent-producer";
    if (!isCompatAdminFeatureEnabled(featureId)) {
      return res.status(403).json({ success: false, error: "The Role Room Agent er ikke aktivert." });
    }
    const session = requireAdminSession(req, res);
    if (!session) return;
    const config = getMetaAppConfig();
    if (!config) {
      return res.status(503).json({
        success: false,
        error: "Meta App er ikke konfigurert. Sett META_APP_ID, META_APP_SECRET og META_OAUTH_REDIRECT_URI.",
      });
    }
    const projectId = typeof req.query.projectId === "string" ? req.query.projectId : null;
    const state = signOauthState({ userId: session.userId, projectId });
    const url = buildAuthorizationUrl(state);
    if (!url) return res.status(500).json({ success: false, error: "Kunne ikke bygge auth-URL." });
    return res.json({ success: true, url, scopes: META_REQUIRED_SCOPES });
  });

  app.get("/api/role-room/instagram/oauth/callback", async (req, res) => {
    const code = typeof req.query.code === "string" ? req.query.code : null;
    const state = typeof req.query.state === "string" ? req.query.state : null;
    const error = typeof req.query.error === "string" ? req.query.error : null;
    if (error) {
      return res.status(400).send(`<html><body><h1>Meta returnerte feil</h1><p>${error}</p></body></html>`);
    }
    if (!code || !state) {
      return res.status(400).send("Mangler code/state");
    }
    const claims = verifyOauthState(state);
    if (!claims) {
      return res.status(400).send("Ugyldig eller utløpt state");
    }
    try {
      const short = await exchangeCodeForShortLivedToken(code);
      const long = await exchangeForLongLivedToken(short.accessToken);
      // Fetch Meta's user id once so we can match future deauth +
      // data-deletion callbacks back to these rows.
      const fbUserId = await fetchMetaUserId(long.accessToken);
      const accounts = await discoverIgBusinessAccounts(long.accessToken);
      if (accounts.length === 0) {
        return res.status(400).send(
          "<html><body><h1>Ingen Instagram Business Account funnet</h1>" +
            "<p>Sørg for at brukeren har en Instagram Business-konto koblet til en Facebook Page.</p></body></html>",
        );
      }
      const saved: { igUsername: string | null; igBusinessAccountId: string }[] = [];
      for (const acct of accounts) {
        const row = await upsertInstagramConnection(pool, {
          userId: claims.userId,
          projectId: claims.projectId ?? null,
          page: acct,
          longLivedToken: long.accessToken,
          expiresInSeconds: long.expiresIn,
          scopes: META_REQUIRED_SCOPES,
          fbUserId,
        });
        if (row) {
          saved.push({ igUsername: row.igUsername, igBusinessAccountId: row.igBusinessAccountId });
          // Best-effort: abonner appen vår på IG webhook-felter
          // (comments, mentions, live_comments). Feiler ikke connect-flyt
          // hvis Meta avviser — bruker vil bare ikke få real-time events.
          subscribeIgWebhookFields(acct.igBusinessAccountId, acct.pageAccessToken).then(
            (ok) => {
              if (!ok) {
                console.warn(
                  `[ig-oauth] webhook subscription not active for ${acct.igBusinessAccountId} — comments/mentions will not stream.`,
                );
              }
            },
          );
          // FB Page-abonnement parallelt — siden samme Page nå brukes både
          // som IG-broer og som direkte publish-target (FacebookVideoPublisher),
          // er det fornuftig å fange feed/mention/messages-events sammen.
          subscribeFbPageWebhookFields(acct.pageId, acct.pageAccessToken).then((ok) => {
            if (!ok) {
              console.warn(
                `[fb-oauth] webhook subscription not active for Page ${acct.pageId} — comments/mentions will not stream.`,
              );
            }
          });
        }
      }
      return res.send(
        `<html><body style="font-family:system-ui;padding:40px;background:#0b1220;color:#e2e8f0;">` +
          `<h1>Instagram er koblet til</h1>` +
          `<p>${saved.length} konto(er) lagret. Du kan lukke dette vinduet og gå tilbake til The Role Room.</p>` +
          `<ul>${saved.map((a) => `<li>@${a.igUsername ?? "(ukjent)"} — ${a.igBusinessAccountId}</li>`).join("")}</ul>` +
          `<script>window.opener && window.opener.postMessage({type:'instagram-connected',count:${saved.length}}, '*'); setTimeout(()=>window.close(), 4000);</script>` +
          `</body></html>`,
      );
    } catch (oauthError) {
      console.error("[ig-oauth] callback failed", oauthError);
      return res.status(500).send(
        `<html><body><h1>Innlogging feilet</h1><p>${(oauthError as Error).message}</p></body></html>`,
      );
    }
  });

  // ── TikTok OAuth + connection-status ─────────────────────────────────

  // AI-generert kanal-plan for produsenter som skal bygge ny YouTube-kanal.
  // Tar projectId som input og henter brand_snapshot fra eksisterende

  app.get("/api/role-room/instagram/connections", async (req, res) => {
    const featureId = "role-room-agent-producer";
    if (!isCompatAdminFeatureEnabled(featureId)) {
      return res.status(403).json({ success: false, error: "The Role Room Agent er ikke aktivert." });
    }
    const session = requireAdminSession(req, res);
    if (!session) return;
    const connections = await listInstagramConnections(pool, session.userId);
    return res.json({
      success: true,
      metaConfigured: getMetaAppConfig() !== null,
      imageHostingConfigured: isInstagramImageUploadConfigured(),
      rateLimitPer24h: IG_RATE_LIMIT_PER_24H,
      connections: connections.map((c) => ({
        id: c.id,
        igBusinessAccountId: c.igBusinessAccountId,
        igUsername: c.igUsername,
        facebookPageName: c.facebookPageName,
        tokenExpiresAt: c.tokenExpiresAt,
        scopes: c.scopes,
        // Profil-metadata for UI-rendering (avatar, follower-tall, etc.)
        accountType: c.accountType,
        profilePictureUrl: c.profilePictureUrl,
        followersCount: c.followersCount,
        mediaCount: c.mediaCount,
        profileRefreshedAt: c.profileRefreshedAt,
      })),
    });
  });

  app.delete("/api/role-room/instagram/connections/:connectionId", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const ok = await revokeIgConnection(pool, req.params.connectionId, session.userId);
    return res.json({ success: ok });
  });

  app.get("/api/role-room/facebook/pages", async (req, res) => {
    const featureId = "role-room-agent-producer";
    if (!isCompatAdminFeatureEnabled(featureId)) {
      return res.status(403).json({ success: false, error: "The Role Room Agent er ikke aktivert." });
    }
    const session = requireAdminSession(req, res);
    if (!session) return;

    const connections = await listInstagramConnections(pool, session.userId);
    if (connections.length === 0) {
      return res.status(409).json({
        success: false,
        error: "Koble Facebook/Instagram til Role Room først.",
        connectRequired: true,
      });
    }
    const connection = connections[0];

    const url = `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,category,tasks&access_token=${encodeURIComponent(connection.accessToken)}`;
    try {
      const response = await fetch(url);
      const text = await response.text();
      let payload: Record<string, unknown> | null = null;
      try { payload = JSON.parse(text) as Record<string, unknown>; } catch { /* keep raw */ }

      if (!response.ok) {
        console.error(`[facebook-pages] status=${response.status} body=${text.replace(/\s+/g, " ").slice(0, 400)}`);
        const errObj = (payload?.error as Record<string, unknown> | undefined) ?? null;
        return res.status(response.status).json({
          success: false,
          error: typeof errObj?.message === "string" ? `Meta Graph API: ${errObj.message}` : `Meta Graph API returnerte ${response.status}.`,
        });
      }
      const pages = Array.isArray(payload?.data) ? payload.data : [];
      return res.json({
        success: true,
        pages: pages.map((p: Record<string, unknown>) => ({
          id: String(p.id),
          name: typeof p.name === "string" ? p.name : null,
          category: typeof p.category === "string" ? p.category : null,
          tasks: Array.isArray(p.tasks) ? p.tasks : [],
          hasPageToken: typeof p.access_token === "string" && p.access_token.length > 0,
        })),
      });
    } catch (err) {
      console.error(`[facebook-pages] fetch threw: ${err instanceof Error ? err.message : String(err)}`);
      return res.status(500).json({ success: false, error: "Kunne ikke nå Meta Graph API." });
    }
  });

  app.post("/api/role-room/facebook/publish-video", async (req, res) => {
    const featureId = "role-room-agent-producer";
    if (!isCompatAdminFeatureEnabled(featureId)) {
      return res.status(403).json({ success: false, error: "The Role Room Agent er ikke aktivert." });
    }
    const session = requireAdminSession(req, res);
    if (!session) return;

    const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const pageId = typeof body.pageId === "string" ? body.pageId.trim() : "";
    const videoDataUrl = typeof body.videoDataUrl === "string" ? body.videoDataUrl : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const scheduledForIso = typeof body.scheduledFor === "string" ? body.scheduledFor.trim() : "";
    if (!pageId || !videoDataUrl) {
      return res.status(400).json({ success: false, error: "pageId og videoDataUrl er påkrevd." });
    }
    // Meta scheduled_publish_time must be 10 min – 6 months in future,
    // expressed as unix seconds. Accept an ISO string from the Feed
    // Planner and translate; skip if invalid or in the past.
    let scheduledPublishUnix: number | null = null;
    if (scheduledForIso) {
      const parsed = Date.parse(scheduledForIso);
      if (Number.isFinite(parsed) && parsed > Date.now() + 10 * 60 * 1000) {
        scheduledPublishUnix = Math.floor(parsed / 1000);
      }
    }

    const connections = await listInstagramConnections(pool, session.userId);
    if (connections.length === 0) {
      return res.status(409).json({
        success: false,
        error: "Koble Facebook/Instagram til Role Room først.",
        connectRequired: true,
      });
    }
    const connection = connections[0];

    // Look up the Page access token — FB Page publishes need a Page-
    // scoped token, not the user token directly.
    let pageAccessToken: string | null = null;
    try {
      const accountsRes = await fetch(
        `https://graph.facebook.com/v21.0/me/accounts?fields=id,access_token&access_token=${encodeURIComponent(connection.accessToken)}`,
      );
      const accountsBody = await accountsRes.json() as { data?: Array<{ id?: string; access_token?: string }> };
      const match = (accountsBody.data ?? []).find((p) => String(p.id) === pageId);
      if (match?.access_token) pageAccessToken = match.access_token;
    } catch (err) {
      console.error(`[fb-publish-video] me/accounts threw: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (!pageAccessToken) {
      return res.status(403).json({
        success: false,
        error: "Fant ingen Page-token for denne siden. Re-connect Facebook og bekreft at siden er admin'et av deg.",
      });
    }

    // Decode data URL.
    const dataUrlMatch = videoDataUrl.match(/^data:(video\/[a-z0-9.+-]+);base64,(.+)$/i);
    if (!dataUrlMatch) {
      return res.status(400).json({ success: false, error: "videoDataUrl må være et base64-kodet video/*-data-URL." });
    }
    const mimeType = dataUrlMatch[1];
    const buffer = Buffer.from(dataUrlMatch[2], "base64");
    if (buffer.length === 0) {
      return res.status(400).json({ success: false, error: "Tom video-body etter dekoding." });
    }
    if (buffer.length > 100 * 1024 * 1024) {
      return res.status(413).json({ success: false, error: "Video er over 100 MB — bruk en mindre fil for review-demoen." });
    }

    const form = new FormData();
    const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
    form.append("source", blob, `upload.${mimeType.split("/")[1] || "mp4"}`);
    if (description) form.append("description", description);
    if (scheduledPublishUnix) {
      // Two-part flag: published=false + scheduled_publish_time tells
      // Meta to queue rather than publish immediately.
      form.append("published", "false");
      form.append("scheduled_publish_time", String(scheduledPublishUnix));
    }
    form.append("access_token", pageAccessToken);

    const uploadUrl = `https://graph.facebook.com/v21.0/${encodeURIComponent(pageId)}/videos`;
    try {
      const response = await fetch(uploadUrl, { method: "POST", body: form });
      const text = await response.text();
      let payload: Record<string, unknown> | null = null;
      try { payload = JSON.parse(text) as Record<string, unknown>; } catch { /* keep raw */ }

      if (!response.ok) {
        console.error(`[fb-publish-video] upload status=${response.status} body=${text.replace(/\s+/g, " ").slice(0, 400)}`);
        const errObj = (payload?.error as Record<string, unknown> | undefined) ?? null;
        return res.status(response.status === 400 ? 422 : response.status).json({
          success: false,
          error: typeof errObj?.message === "string" ? `Meta Graph API: ${errObj.message}` : `Meta Graph API returnerte ${response.status}.`,
          graphError: errObj,
        });
      }
      const videoId = payload?.id ? String(payload.id) : null;
      return res.json({
        success: true,
        video: {
          id: videoId,
          pageId,
          permalink: videoId ? `https://www.facebook.com/${videoId}` : null,
          graphUrl: videoId ? `https://graph.facebook.com/v21.0/${videoId}` : null,
          sizeBytes: buffer.length,
          mimeType,
          scheduled: !!scheduledPublishUnix,
          scheduledFor: scheduledPublishUnix ? new Date(scheduledPublishUnix * 1000).toISOString() : null,
        },
      });
    } catch (err) {
      console.error(`[fb-publish-video] fetch threw: ${err instanceof Error ? err.message : String(err)}`);
      return res.status(500).json({ success: false, error: "Kunne ikke nå Meta Graph API." });
    }
  });

  app.post("/api/role-room/facebook/publish-page-post", async (req, res) => {
    const featureId = "role-room-agent-producer";
    if (!isCompatAdminFeatureEnabled(featureId)) {
      return res.status(403).json({ success: false, error: "The Role Room Agent er ikke aktivert." });
    }
    const session = requireAdminSession(req, res);
    if (!session) return;

    const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const pageId = typeof body.pageId === "string" ? body.pageId.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const mentionedPageId = typeof body.mentionedPageId === "string" ? body.mentionedPageId.trim() : "";
    if (!pageId || !message || !mentionedPageId) {
      return res.status(400).json({ success: false, error: "pageId, message og mentionedPageId er påkrevd." });
    }
    if (!/^[0-9]{3,}$/.test(mentionedPageId)) {
      return res.status(400).json({ success: false, error: "mentionedPageId må være en numerisk Facebook-Page-id." });
    }

    const connections = await listInstagramConnections(pool, session.userId);
    if (connections.length === 0) {
      return res.status(409).json({
        success: false,
        error: "Koble Facebook/Instagram til Role Room først.",
        connectRequired: true,
      });
    }
    const connection = connections[0];

    let pageAccessToken: string | null = null;
    try {
      const accountsRes = await fetch(
        `https://graph.facebook.com/v21.0/me/accounts?fields=id,access_token&access_token=${encodeURIComponent(connection.accessToken)}`,
      );
      const accountsBody = await accountsRes.json() as { data?: Array<{ id?: string; access_token?: string }> };
      const match = (accountsBody.data ?? []).find((p) => String(p.id) === pageId);
      if (match?.access_token) pageAccessToken = match.access_token;
    } catch (err) {
      console.error(`[fb-publish-page-post] me/accounts threw: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (!pageAccessToken) {
      return res.status(403).json({
        success: false,
        error: "Fant ingen Page-token for denne siden — sørg for at du admin'er Page-en.",
      });
    }

    // `@[PAGE_ID]` is the documented Meta in-line mention syntax for
    // /feed posts. It's kept separate from the user's message on the
    // wire so the reviewer can clearly see the mention was added by
    // the producer rather than being free text that happened to match.
    const finalMessage = `${message} @[${mentionedPageId}]`;

    const form = new FormData();
    form.append("message", finalMessage);
    form.append("access_token", pageAccessToken);

    const feedUrl = `https://graph.facebook.com/v21.0/${encodeURIComponent(pageId)}/feed`;
    try {
      const response = await fetch(feedUrl, { method: "POST", body: form });
      const text = await response.text();
      let payload: Record<string, unknown> | null = null;
      try { payload = JSON.parse(text) as Record<string, unknown>; } catch { /* keep raw */ }
      if (!response.ok) {
        console.error(`[fb-publish-page-post] status=${response.status} body=${text.replace(/\s+/g, " ").slice(0, 400)}`);
        const errObj = (payload?.error as Record<string, unknown> | undefined) ?? null;
        return res.status(response.status === 400 ? 422 : response.status).json({
          success: false,
          error: typeof errObj?.message === "string" ? `Meta Graph API: ${errObj.message}` : `Meta Graph API returnerte ${response.status}.`,
          graphError: errObj,
        });
      }
      const postId = typeof payload?.id === "string" ? payload.id : null;
      return res.json({
        success: true,
        post: {
          id: postId,
          pageId,
          mentionedPageId,
          message: finalMessage,
          graphUrl: postId ? `https://graph.facebook.com/${encodeURIComponent(postId)}` : null,
          permalink: postId ? `https://www.facebook.com/${encodeURIComponent(postId)}` : null,
        },
      });
    } catch (err) {
      console.error(`[fb-publish-page-post] fetch threw: ${err instanceof Error ? err.message : String(err)}`);
      return res.status(500).json({ success: false, error: "Kunne ikke nå Meta Graph API." });
    }
  });

  app.post("/api/role-room/instagram/publish", async (req, res) => {
    const featureId = "role-room-agent-producer";
    if (!isCompatAdminFeatureEnabled(featureId)) {
      return res.status(403).json({ success: false, error: "The Role Room Agent er ikke aktivert." });
    }
    const session = requireAdminSession(req, res);
    if (!session) return;

    // Showrunner-tier (or admin) only — entitlement check via the same gate.
    const entitlement = await checkAgentEntitlement(pool, session.userId, session.role);
    if (!entitlement.allowed) {
      return res.status(402).json({
        success: false,
        error: entitlement.reason || "IG-publisering krever Showrunner-pakken.",
        entitlement,
      });
    }

    const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const required = ["connectionId", "projectId", "feedPlanPostId", "mediaType"];
    for (const k of required) {
      if (!body[k]) return res.status(400).json({ success: false, error: `${k} er påkrevd.` });
    }
    if (!["image", "reel", "carousel"].includes(String(body.mediaType))) {
      return res.status(400).json({ success: false, error: "mediaType må være image|reel|carousel." });
    }
    const imageDataUrls = Array.isArray(body.imageDataUrls)
      ? body.imageDataUrls.filter((s): s is string => typeof s === "string")
      : undefined;
    const imageDataUrl = typeof body.imageDataUrl === "string" ? body.imageDataUrl : undefined;
    const videoDataUrl = typeof body.videoDataUrl === "string" ? body.videoDataUrl : undefined;
    const mediaType = body.mediaType as "image" | "reel" | "carousel";
    if (mediaType === "reel") {
      if (!videoDataUrl) {
        return res.status(400).json({ success: false, error: "reel krever videoDataUrl." });
      }
    } else if (!imageDataUrl && (!imageDataUrls || imageDataUrls.length === 0)) {
      return res.status(400).json({
        success: false,
        error: "imageDataUrl eller imageDataUrls er påkrevd for image/carousel.",
      });
    }

    try {
      const result = await queueAndPublishIg(pool, {
        connectionId: String(body.connectionId),
        userId: session.userId,
        projectId: String(body.projectId),
        feedPlanPostId: String(body.feedPlanPostId),
        mediaType,
        caption: typeof body.caption === "string" ? body.caption : "",
        imageDataUrl,
        imageDataUrls,
        videoDataUrl,
        scheduledFor: typeof body.scheduledFor === "string" ? body.scheduledFor : null,
      });
      return res.json({
        success: true,
        job: result.job,
        immediatelyPublished: result.immediatelyPublished,
        rateLimited: result.rateLimited,
      });
    } catch (publishError) {
      console.error("[ig-publish] error", publishError);
      return res.status(500).json({
        success: false,
        error: (publishError as Error).message || "Publish feilet.",
      });
    }
  });

  app.get("/api/role-room/instagram/jobs/:projectId", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const jobs = await listIgPublishJobs(pool, req.params.projectId, session.userId);
    return res.json({ success: true, jobs });
  });

  // Meta webhook for IG events (status updates, mention notifications, etc.)
  app.get("/api/role-room/instagram/webhook", (req, res) => {
    const expectedToken = process.env.META_WEBHOOK_VERIFY_TOKEN;
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    if (mode === "subscribe" && expectedToken && token === expectedToken) {
      return res.status(200).send(String(challenge ?? ""));
    }
    return res.status(403).send("verify token mismatch");
  });

  // Deauthorize Callback URL — registered in the Meta App Dashboard.
  // Body is application/x-www-form-urlencoded with a single `signed_request`
  // field. We verify the signature, extract the fb user id, revoke their
  // IG connections, and respond 200.
  app.post(
    "/api/role-room/instagram/deauthorize",
    express.urlencoded({ extended: false, limit: "32kb" }),
    async (req, res) => {
      const appSecret = process.env.META_APP_SECRET;
      if (!appSecret) return res.status(503).send("not configured");
      const body = (req.body ?? {}) as Record<string, unknown>;
      const signedRequest = typeof body.signed_request === "string" ? body.signed_request : null;
      const payload = parseSignedRequest(signedRequest, appSecret);
      if (!payload || !payload.user_id) {
        console.warn("[ig-deauth] invalid signed_request on deauthorize callback");
        return res.status(400).send("invalid signed_request");
      }
      const revoked = await revokeConnectionsForFbUser(pool, String(payload.user_id));
      console.log(`[ig-deauth] user=${payload.user_id} revoked ${revoked} connection(s)`);
      return res.status(200).send("ok");
    },
  );

  // Data Deletion Request URL — registered in the Meta App Dashboard.
  // Same signed_request body as above. Response must be JSON with
  // `{url, confirmation_code}` so the user can check deletion status.
  app.post(
    "/api/role-room/instagram/data-deletion",
    express.urlencoded({ extended: false, limit: "32kb" }),
    async (req, res) => {
      const appSecret = process.env.META_APP_SECRET;
      if (!appSecret) return res.status(503).json({ error: "not configured" });
      const body = (req.body ?? {}) as Record<string, unknown>;
      const signedRequest = typeof body.signed_request === "string" ? body.signed_request : null;
      const payload = parseSignedRequest(signedRequest, appSecret);
      if (!payload || !payload.user_id) {
        console.warn("[ig-deauth] invalid signed_request on data-deletion callback");
        return res.status(400).json({ error: "invalid signed_request" });
      }
      const { confirmationCode, connectionsRevoked } = await recordDataDeletionRequest(
        pool,
        String(payload.user_id),
      );
      const base = process.env.CREATORHUB_PUBLIC_URL
        || process.env.APP_URL
        || "https://theroleroom.com";
      console.log(
        `[ig-deauth] data-deletion user=${payload.user_id} code=${confirmationCode} revoked=${connectionsRevoked}`,
      );
      return res.status(200).json({
        url: `${base.replace(/\/$/, "")}/api/role-room/instagram/data-deletion/${confirmationCode}`,
        confirmation_code: confirmationCode,
      });
    },
  );

  // Public status check for a data-deletion request. Meta points the user
  // here so they can confirm deletion has been processed.
  app.get("/api/role-room/instagram/data-deletion/:code", async (req, res) => {
    const record = await fetchDataDeletionRequest(pool, req.params.code);
    if (!record) return res.status(404).send("Unknown confirmation code.");
    return res.status(200).send(
      `<html><body style="font-family:system-ui;padding:40px;background:#0b1220;color:#e2e8f0;">` +
        `<h1>Data deletion status</h1>` +
        `<p>Status: <strong>${record.status}</strong></p>` +
        `<p>Requested: ${record.requestedAt.toISOString()}</p>` +
        `<p>Connections revoked: ${record.connectionsRevoked}</p>` +
        (record.completedAt ? `<p>Completed: ${record.completedAt.toISOString()}</p>` : "") +
        `</body></html>`,
    );
  });

  app.post(
    "/api/role-room/instagram/webhook",
    // Raw body required: signature is HMAC over the exact bytes Meta sent.
    express.raw({ type: "application/json", limit: "1mb" }),
    async (req, res) => {
      const appSecret = process.env.META_APP_SECRET;
      if (!appSecret) {
        // Without META_APP_SECRET we can't verify anything. In production
        // this is a misconfiguration — reject loud so monitoring notices.
        if (process.env.NODE_ENV === "production") {
          console.error("[ig-webhook] META_APP_SECRET unset — cannot verify signature");
          return res.status(503).send("webhook not configured");
        }
        // Non-prod: allow unsigned for local testing, but log it.
        console.warn("[ig-webhook] accepting unsigned event (META_APP_SECRET unset, non-prod)");
      }

      const rawBody: Buffer = Buffer.isBuffer(req.body)
        ? req.body
        : Buffer.from(String(req.body ?? ""), "utf8");

      if (appSecret) {
        const signatureHeader = req.headers["x-hub-signature-256"];
        const valid = verifyMetaWebhookSignature(rawBody, signatureHeader, appSecret);
        if (!valid) {
          console.warn("[ig-webhook] signature mismatch — rejecting");
          return res.status(401).send("invalid signature");
        }
      }

      const event = parseMetaWebhookEvent(rawBody);
      if (!event) {
        console.warn("[ig-webhook] body was not valid JSON");
        // Still 200 so Meta doesn't retry forever on a single bad payload.
        return res.status(200).send("ok");
      }

      console.log("[ig-webhook]", summariseMetaWebhookEvent(event));

      // Persistér events til social_events for unified inbox + sentiment.
      // Best-effort — feiler ikke webhook-acket hvis storage feiler.
      try {
        const flattened = flattenIgWebhookEvent(
          event as Parameters<typeof flattenIgWebhookEvent>[0],
        );
        let inserted = 0;
        for (const e of flattened) {
          const r = await persistSocialEvent(pool, e);
          if (r.inserted) inserted += 1;
        }
        if (flattened.length > 0) {
          console.log(
            `[ig-webhook] persisted ${inserted}/${flattened.length} events to social_events`,
          );
        }
      } catch (err) {
        console.warn("[ig-webhook] persist failed (non-fatal)", err);
      }

      // Persist inbound Instagram DMs into the unified CRM inbox. Best-effort —
      // never blocks the ack. Handles object='instagram'/'page' messaging events.
      try {
        const dms = await persistInboundDmFromWebhook(pool, event);
        if (dms > 0) console.log(`[ig-webhook] persisted ${dms} inbound DM(s) to inbox`);
      } catch (err) {
        console.warn("[ig-webhook] DM persist failed (non-fatal)", err);
      }

      // Ack quickly — Meta treats >10s as a failure and will retry.
      return res.status(200).send("ok");
    },
  );

  // ── Facebook Pages webhook (samme Meta-app, separat callback URL for at
  //    verify-tokens kan roteres uavhengig av IG og WhatsApp) ──────────────

  app.get("/api/role-room/facebook/webhook", (req, res) => {
    const expectedToken =
      (process.env.META_FB_WEBHOOK_VERIFY_TOKEN || "").trim() ||
      (process.env.META_WEBHOOK_VERIFY_TOKEN || "").trim();
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    if (mode === "subscribe" && expectedToken && token === expectedToken) {
      return res.status(200).send(String(challenge ?? ""));
    }
    return res.status(403).send("verify token mismatch");
  });

  app.post(
    "/api/role-room/facebook/webhook",
    express.raw({ type: "application/json", limit: "1mb" }),
    async (req, res) => {
      const appSecret = process.env.META_APP_SECRET;
      if (!appSecret) {
        if (process.env.NODE_ENV === "production") {
          console.error("[fb-webhook] META_APP_SECRET unset — cannot verify signature");
          return res.status(503).send("webhook not configured");
        }
        console.warn("[fb-webhook] accepting unsigned event (META_APP_SECRET unset, non-prod)");
      }

      const rawBody: Buffer = Buffer.isBuffer(req.body)
        ? req.body
        : Buffer.from(String(req.body ?? ""), "utf8");

      if (appSecret) {
        const signatureHeader = req.headers["x-hub-signature-256"];
        const valid = verifyMetaWebhookSignature(rawBody, signatureHeader, appSecret);
        if (!valid) {
          console.warn("[fb-webhook] signature mismatch — rejecting");
          return res.status(401).send("invalid signature");
        }
      }

      const event = parseMetaWebhookEvent(rawBody);
      if (!event) {
        console.warn("[fb-webhook] body was not valid JSON");
        return res.status(200).send("ok");
      }

      try {
        const flattened = flattenFacebookPageWebhookEvent(
          event as Parameters<typeof flattenFacebookPageWebhookEvent>[0],
        );
        let inserted = 0;
        for (const e of flattened) {
          const r = await persistSocialEvent(pool, e);
          if (r.inserted) inserted += 1;
        }
        if (flattened.length > 0) {
          console.log(
            `[fb-webhook] persisted ${inserted}/${flattened.length} events to social_events`,
          );
        }
      } catch (err) {
        console.warn("[fb-webhook] persist failed (non-fatal)", err);
      }

      return res.status(200).send("ok");
    },
  );

}
