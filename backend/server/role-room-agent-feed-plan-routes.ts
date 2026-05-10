/**
 * role-room-agent-feed-plan-routes.ts
 *
 * Setup-funksjon for /api/role-room/agent/feed-plan/* endpoints — AI-drevet
 * content-strategi, post-anbefaling, templates, Drive-import og approval-
 * flow for The Role Room Agent (Innholdsprodusent-mode).
 *
 * 10 endpoints:
 *   - GET    /feed-plan/templates/:projectId/:platform
 *   - POST   /feed-plan/templates/:projectId/:platform
 *   - DELETE /feed-plan/templates/:templateId
 *   - POST   /feed-plan/strategy/refresh           (Claude → strategi-summery)
 *   - POST   /feed-plan/recommend                  (Claude → post-anbefaling)
 *   - GET    /feed-plan/drive/images               (Google Drive listing)
 *   - POST   /feed-plan/drive/import               (Drive image-import + sharp resize)
 *   - GET    /feed-plan/:projectId/:platform       (les feed-plan)
 *   - PUT    /feed-plan/:projectId/:platform       (oppdater feed-plan)
 *   - POST   /feed-plan/:projectId/:platform/approve (approval-state-overgang)
 *
 * Auth: requireAdminSession + feature-flag `role-room-agent-producer`.
 *
 * Wire opp i backend/server/index.ts ved å legge til:
 *
 *   import { setupRoleRoomAgentFeedPlanRoutes } from "./role-room-agent-feed-plan-routes";
 *
 *   setupRoleRoomAgentFeedPlanRoutes({
 *     app, pool, requireAdminSession, isCompatAdminFeatureEnabled,
 *   });
 *
 * Mode-noter: Innholdsprodusent-mode-feature, gated på feature-flag.
 */

import type express from "express";
import type { Pool } from "pg";
import { google } from "googleapis";

import {
  isSupportedPlatform as isSupportedFeedPlatform,
  loadFeedPlan,
  normalizeFeedPostsPayload,
  saveFeedPlan,
  type RoleRoomFeedApprovalState,
} from "./role-room-feed-plan.js";
import { recommendFeedPost } from "./role-room-feed-recommend.js";
import {
  refreshStrategyWithClaude,
  upsertStrategy,
  loadStrategy,
} from "./role-room-feed-strategy.js";
import {
  archiveTemplate as archiveFeedTemplate,
  createTemplate as createFeedTemplate,
  listTemplates as listFeedTemplates,
  normalizeTemplatePayload,
} from "./role-room-feed-templates.js";
import { checkAgentEntitlement } from "./role-room-agent-entitlements.js";
import { logAiCall } from "./role-room-ai-audit.js";
import {
  requireActiveConsent,
  RoleRoomAiConsentError,
} from "./role-room-ai-consent.js";
import { resolveRoleRoomGoogleConnection } from "./contract-google-signing.js";

interface AdminSession {
  userId: string;
  email: string;
  name: string;
  role: string;
  loginAt: string;
}

export interface RoleRoomAgentFeedPlanRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireAdminSession: (
    req: express.Request,
    res: express.Response,
  ) => AdminSession | null;
  isCompatAdminFeatureEnabled: (featureId: string) => boolean;
}

export function setupRoleRoomAgentFeedPlanRoutes(
  deps: RoleRoomAgentFeedPlanRoutesDeps,
): void {
  const { app, pool, requireAdminSession, isCompatAdminFeatureEnabled } = deps;

  app.get("/api/role-room/agent/feed-plan/templates/:projectId/:platform", async (req, res) => {
    const featureId = "role-room-agent-producer";
    if (!isCompatAdminFeatureEnabled(featureId)) {
      return res.status(403).json({ success: false, error: "The Role Room Agent er ikke aktivert." });
    }
    const session = requireAdminSession(req, res);
    if (!session) return;
    const { projectId, platform } = req.params;
    if (!projectId || !isSupportedFeedPlatform(platform)) {
      return res.status(400).json({ success: false, error: "projectId og støttet plattform er påkrevd." });
    }
    const templates = await listFeedTemplates(pool, projectId, platform);
    return res.json({
      success: true,
      templates: templates.map((t) => ({
        id: t.id,
        name: t.name,
        template: t.template,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
    });
  });

  app.post("/api/role-room/agent/feed-plan/templates/:projectId/:platform", async (req, res) => {
    const featureId = "role-room-agent-producer";
    if (!isCompatAdminFeatureEnabled(featureId)) {
      return res.status(403).json({ success: false, error: "The Role Room Agent er ikke aktivert." });
    }
    const session = requireAdminSession(req, res);
    if (!session) return;
    const { projectId, platform } = req.params;
    if (!projectId || !isSupportedFeedPlatform(platform)) {
      return res.status(400).json({ success: false, error: "projectId og støttet plattform er påkrevd." });
    }
    const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return res.status(400).json({ success: false, error: "Navn på malen er påkrevd." });
    }
    const created = await createFeedTemplate(pool, {
      projectId,
      ownerUserId: session.userId,
      platform,
      name,
      template: normalizeTemplatePayload(body.template),
    });
    if (!created) {
      return res.status(500).json({ success: false, error: "Kunne ikke lagre malen." });
    }
    return res.json({
      success: true,
      template: {
        id: created.id,
        name: created.name,
        template: created.template,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      },
    });
  });

  app.delete("/api/role-room/agent/feed-plan/templates/:templateId", async (req, res) => {
    const featureId = "role-room-agent-producer";
    if (!isCompatAdminFeatureEnabled(featureId)) {
      return res.status(403).json({ success: false, error: "The Role Room Agent er ikke aktivert." });
    }
    const session = requireAdminSession(req, res);
    if (!session) return;
    const { templateId } = req.params;
    if (!templateId) {
      return res.status(400).json({ success: false, error: "templateId er påkrevd." });
    }
    const ok = await archiveFeedTemplate(pool, templateId, session.userId);
    return res.json({ success: ok });
  });

  app.post("/api/role-room/agent/feed-plan/strategy/refresh", async (req, res) => {
    const featureId = "role-room-agent-producer";
    if (!isCompatAdminFeatureEnabled(featureId)) {
      return res.status(403).json({ success: false, error: "The Role Room Agent er ikke aktivert." });
    }
    const session = requireAdminSession(req, res);
    if (!session) return;

    const body =
      req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const platform = body.platform;
    if (!isSupportedFeedPlatform(platform)) {
      return res.status(400).json({ success: false, error: "Støttet plattform er påkrevd." });
    }

    // Synkron refresh — admin venter aktivt og får strategi-summeringen tilbake.
    // Bakgrunnstriggeren er fortsatt opportunistisk; dette er manuell override.
    const refreshed = await refreshStrategyWithClaude(platform);
    if (!refreshed) {
      const current = await loadStrategy(pool, platform);
      return res.status(502).json({
        success: false,
        error: "Claude refresh feilet — strategi ikke endret. Sjekk ANTHROPIC_API_KEY og ROLE_ROOM_AGENT_CLAUDE_ENABLED.",
        strategy: current,
      });
    }

    await upsertStrategy(pool, platform, refreshed.summary, refreshed.sourceUrls, {
      refreshedBy: `manual:${session.userId}`,
    });
    const persisted = await loadStrategy(pool, platform);
    return res.json({ success: true, strategy: persisted });
  });

  app.post("/api/role-room/agent/feed-plan/recommend", async (req, res) => {
    const featureId = "role-room-agent-producer";
    if (!isCompatAdminFeatureEnabled(featureId)) {
      return res.status(403).json({ success: false, error: "The Role Room Agent er ikke aktivert." });
    }

    const session = requireAdminSession(req, res);
    if (!session) return;

    const body =
      req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const platform = body.platform;
    if (!isSupportedFeedPlatform(platform)) {
      return res.status(400).json({ success: false, error: "Støttet plattform er påkrevd." });
    }
    if (!body.post || typeof body.post !== "object") {
      return res.status(400).json({ success: false, error: "post er påkrevd." });
    }
    if (!body.brand || typeof body.brand !== "object") {
      return res.status(400).json({ success: false, error: "brand-kontekst er påkrevd." });
    }
    const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
    if (!projectId) {
      return res.status(400).json({ success: false, error: "projectId er påkrevd." });
    }

    // Følg samme entitlement-regler som resten av The Role Room-agenten:
    // admins går rett gjennom, betalende planer får uhindret tilgang,
    // trial-brukere får tilgang innenfor daglige/månedlige tak, ellers 402
    // med upsell-stier (addon_monthly / plan_pro / start_trial).
    const entitlement = await checkAgentEntitlement(pool, session.userId, session.role);
    if (!entitlement.allowed) {
      return res.status(402).json({
        success: false,
        error: entitlement.reason || "Tilgang til AI-anbefalinger krever aktiv plan eller addon.",
        entitlement,
      });
    }

    // GDPR: AI-anbefaling sender brand-kontekst (og evt. opplastet bilde) til
    // Anthropic. Krever aktivt samtykke per prosjekt + prosessor (samme
    // mekanisme som bootstrap/chat-flyten). Vision-kall krever 'full_context'
    // siden bildedata er bredere enn tekst-brief.
    const hasImageInPost =
      body.post && typeof body.post === "object"
        ? typeof (body.post as Record<string, unknown>).customImageUrl === "string"
        : false;
    try {
      await requireActiveConsent(
        pool,
        projectId,
        "anthropic",
        hasImageInPost ? "full_context" : "brief_and_reviews",
      );
    } catch (consentError) {
      if (consentError instanceof RoleRoomAiConsentError) {
        await logAiCall(pool, {
          projectId,
          userId: session.userId,
          processor: "anthropic",
          model: process.env.ROLE_ROOM_AGENT_CLAUDE_MODEL || "claude-sonnet-4-5",
          action: hasImageInPost ? "feed_plan_recommend_vision" : "feed_plan_recommend",
          status: "blocked_by_consent",
          errorCode: consentError.code,
        });
        return res.status(403).json({
          success: false,
          error: consentError.message,
          consent: { code: consentError.code, requiredScope: hasImageInPost ? "full_context" : "brief_and_reviews" },
        });
      }
      throw consentError;
    }

    const startedAt = Date.now();
    try {
      const recommendation = await recommendFeedPost(pool, {
        projectId,
        userId: session.userId,
        input: {
          platform,
          post: body.post as any,
          brand: body.brand as any,
          scheduleHint: typeof body.scheduleHint === "string" ? body.scheduleHint : null,
        },
      });

      const visionUsed = (recommendation as { visionUsed?: boolean }).visionUsed === true;
      // Logg samtalen i samme audit-tabell som øvrige role-room-agent-kall —
      // trialtakene i checkAgentEntitlement telles derfra, så feed-planner
      // arver automatisk pris- og forbruksreglene. Vi flagger også når vision
      // ble brukt så DPO-rapportene viser hvor bildedata ble prosessert.
      await logAiCall(pool, {
        projectId,
        userId: session.userId,
        processor: "anthropic",
        model: process.env.ROLE_ROOM_AGENT_CLAUDE_MODEL || "claude-sonnet-4-5",
        action: visionUsed ? "feed_plan_recommend_vision" : "feed_plan_recommend",
        status: "ok",
        latencyMs: Date.now() - startedAt,
        fieldCategories: visionUsed
          ? ["social_caption", "posting_time", "image_content"]
          : ["social_caption", "posting_time"],
      });

      return res.json({
        success: true,
        recommendation,
        entitlement: {
          source: entitlement.source,
          status: entitlement.status,
          trialEndsAt: entitlement.trialEndsAt ?? null,
          daysRemaining: entitlement.daysRemaining ?? null,
        },
      });
    } catch (error) {
      console.error("[role-room-agent] feed-plan recommend failed", error);
      await logAiCall(pool, {
        projectId,
        userId: session.userId,
        processor: "anthropic",
        model: process.env.ROLE_ROOM_AGENT_CLAUDE_MODEL || "claude-sonnet-4-5",
        action: "feed_plan_recommend",
        status: "error",
        latencyMs: Date.now() - startedAt,
        errorMessage: error instanceof Error ? error.message.slice(0, 500) : "unknown",
      });
      return res.status(500).json({
        success: false,
        error: "Kunne ikke hente AI-anbefaling.",
      });
    }
  });

  app.get("/api/role-room/agent/feed-plan/drive/images", async (req, res) => {
    const featureId = "role-room-agent-producer";
    if (!isCompatAdminFeatureEnabled(featureId)) {
      return res.status(403).json({ success: false, error: "The Role Room Agent er ikke aktivert." });
    }

    const session = requireAdminSession(req, res);
    if (!session) return;

    let authorized;
    try {
      authorized = await resolveRoleRoomGoogleConnection(pool, session.userId);
    } catch (error) {
      console.error("[role-room-agent] drive images: no connection", error);
      return res.status(200).json({
        success: false,
        notConnected: true,
        error: "Google Drive er ikke koblet til denne brukeren.",
      });
    }

    const searchQuery = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const escaped = searchQuery.replace(/'/g, "\\'");
    // `kind=video` restricts the listing to Drive's video MIME types (for
    // reels); `kind=media` returns image+video (useful when the UI wants a
    // combined picker); anything else keeps the legacy image-only scope.
    const kind = typeof req.query.kind === "string" ? req.query.kind.trim() : "image";
    const mimeFilter = kind === "video"
      ? "mimeType contains 'video/'"
      : kind === "media"
        ? "(mimeType contains 'image/' or mimeType contains 'video/')"
        : "mimeType contains 'image/'";
    const queryParts = [
      mimeFilter,
      "trashed = false",
    ];
    if (escaped) {
      queryParts.push(`name contains '${escaped}'`);
    }

    try {
      const driveApi = google.drive({ version: "v3", auth: authorized.oauthClient });
      const result = await driveApi.files.list({
        q: queryParts.join(" and "),
        pageSize: 60,
        orderBy: "modifiedTime desc",
        fields:
          "nextPageToken, files(id, name, mimeType, thumbnailLink, iconLink, webViewLink, modifiedTime, size)",
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });

      const files = (result.data.files || []).map((file) => ({
        id: file.id || "",
        name: file.name || "Uten navn",
        mimeType: file.mimeType || "image/jpeg",
        thumbnailLink: file.thumbnailLink ?? null,
        iconLink: file.iconLink ?? null,
        webViewLink: file.webViewLink ?? null,
        modifiedTime: file.modifiedTime ?? null,
        sizeBytes: file.size ? Number(file.size) : null,
      }));

      return res.json({
        success: true,
        files,
        nextPageToken: result.data.nextPageToken ?? null,
      });
    } catch (error) {
      console.error("[role-room-agent] drive images list failed", error);
      return res.status(500).json({
        success: false,
        error: "Kunne ikke hente bildene fra Google Drive.",
      });
    }
  });

  app.post("/api/role-room/agent/feed-plan/drive/import", async (req, res) => {
    const featureId = "role-room-agent-producer";
    if (!isCompatAdminFeatureEnabled(featureId)) {
      return res.status(403).json({ success: false, error: "The Role Room Agent er ikke aktivert." });
    }

    const session = requireAdminSession(req, res);
    if (!session) return;

    const body =
      req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const fileId = typeof body.fileId === "string" ? body.fileId.trim() : "";
    if (!fileId) {
      return res.status(400).json({ success: false, error: "fileId er påkrevd." });
    }

    const entitlement = await checkAgentEntitlement(pool, session.userId, session.role);
    if (!entitlement.allowed) {
      return res.status(402).json({
        success: false,
        error: entitlement.reason || "Bildeimport fra Drive krever aktiv Role Room-pakke.",
        entitlement,
      });
    }

    let authorized;
    try {
      authorized = await resolveRoleRoomGoogleConnection(pool, session.userId);
    } catch (error) {
      console.error("[role-room-agent] drive import: no connection", error);
      return res.status(400).json({
        success: false,
        notConnected: true,
        error: "Google Drive er ikke koblet til denne brukeren.",
      });
    }

    try {
      const driveApi = google.drive({ version: "v3", auth: authorized.oauthClient });
      const metaResponse = await driveApi.files.get({
        fileId,
        fields: "id, name, mimeType, size",
        supportsAllDrives: true,
      });
      const meta = metaResponse.data;
      const mimeType = meta?.mimeType ?? "";
      const isImage = mimeType.startsWith("image/");
      const isVideo = mimeType.startsWith("video/");
      if (!isImage && !isVideo) {
        return res.status(400).json({
          success: false,
          error: "Valgt fil er ikke et bilde eller en video.",
        });
      }

      const fileResponse = await driveApi.files.get(
        { fileId, alt: "media", supportsAllDrives: true },
        { responseType: "arraybuffer" },
      );
      const sourceBuffer = Buffer.from(fileResponse.data as ArrayBuffer);

      // Video path: we don't run video through sharp — Meta's reel
      // pipeline accepts the original file as-is. Size cap matches the
      // global express.json limit (50MB) with a little headroom for the
      // base64 overhead; larger files fail fast with a clear message
      // instead of a payload-too-large surprise downstream.
      if (isVideo) {
        const VIDEO_MAX_BYTES = 36 * 1024 * 1024; // ~48MB as base64
        if (sourceBuffer.byteLength > VIDEO_MAX_BYTES) {
          return res.status(413).json({
            success: false,
            error: `Videoen er for stor (${(sourceBuffer.byteLength / 1024 / 1024).toFixed(1)} MB). Maks 36 MB via Drive-import.`,
          });
        }
        const videoDataUrl = `data:${mimeType};base64,${sourceBuffer.toString("base64")}`;
        return res.json({
          success: true,
          image: {
            dataUrl: videoDataUrl,
            name: meta?.name ?? "",
            mimeType,
            fileId,
            kind: "video",
          },
        });
      }

      const aspectRaw = typeof body.aspect === "string" ? body.aspect : "4:5";
      const dimensions = ((): { width: number; height: number } => {
        switch (aspectRaw) {
          case "1:1":
            return { width: 1080, height: 1080 };
          case "9:16":
            return { width: 1080, height: 1920 };
          case "4:5":
          default:
            return { width: 1080, height: 1350 };
        }
      })();

      // sharp (libvips) — perseptuelt tapfri pipeline:
      //   .rotate()            respekterer EXIF-orientering fra kamera
      //   toColorspace('srgb') sikrer samme farger på IG/LinkedIn
      //   kernel: lanczos3     beste nedskalerings-filter i praksis
      //   position: attention  saliency-basert beskjæring holder motivet
      //   mozjpeg q=90         IG re-komprimerer uansett, høyere er spilt
      const sharpModule = await import("sharp");
      const resized = await sharpModule
        .default(sourceBuffer, { failOn: "none" })
        .rotate()
        .toColorspace("srgb")
        .resize({
          width: dimensions.width,
          height: dimensions.height,
          fit: "cover",
          position: "attention",
          kernel: sharpModule.default.kernel.lanczos3,
          withoutEnlargement: false,
        })
        .jpeg({
          quality: 90,
          progressive: true,
          mozjpeg: true,
          chromaSubsampling: "4:4:4",
        })
        .toBuffer();

      const dataUrl = `data:image/jpeg;base64,${resized.toString("base64")}`;

      // Behold Drive-filens originale navn uendret — ikke generer eget navn.
      // Bytene er alltid JPEG etter sharp-pipen, men navnet skal vises som i Drive.
      return res.json({
        success: true,
        image: {
          dataUrl,
          name: meta.name ?? "",
          mimeType: "image/jpeg",
          fileId,
          width: dimensions.width,
          height: dimensions.height,
        },
      });
    } catch (error) {
      console.error("[role-room-agent] drive import failed", error);
      return res.status(500).json({
        success: false,
        error: "Kunne ikke importere bildet fra Google Drive.",
      });
    }
  });

  app.get("/api/role-room/agent/feed-plan/:projectId/:platform", async (req, res) => {
    const featureId = "role-room-agent-producer";
    if (!isCompatAdminFeatureEnabled(featureId)) {
      return res.status(403).json({
        success: false,
        error: "The Role Room Agent er ikke aktivert.",
      });
    }

    const session = requireAdminSession(req, res);
    if (!session) {
      return;
    }

    const { projectId, platform } = req.params;
    if (!projectId || !isSupportedFeedPlatform(platform)) {
      return res.status(400).json({
        success: false,
        error: "projectId og støttet plattform er påkrevd.",
      });
    }

    const plan = await loadFeedPlan(pool, projectId, platform);
    return res.json({
      success: true,
      plan: plan
        ? {
            projectId: plan.projectId,
            platform: plan.platform,
            posts: plan.posts,
            brandSnapshot: plan.brandSnapshot,
            updatedAt: plan.updatedAt,
            updatedBy: plan.updatedBy,
          }
        : null,
    });
  });

  app.put("/api/role-room/agent/feed-plan/:projectId/:platform", async (req, res) => {
    const featureId = "role-room-agent-producer";
    if (!isCompatAdminFeatureEnabled(featureId)) {
      return res.status(403).json({
        success: false,
        error: "The Role Room Agent er ikke aktivert.",
      });
    }

    const session = requireAdminSession(req, res);
    if (!session) {
      return;
    }

    const { projectId, platform } = req.params;
    if (!projectId || !isSupportedFeedPlatform(platform)) {
      return res.status(400).json({
        success: false,
        error: "projectId og støttet plattform er påkrevd.",
      });
    }

    // Følg samme tier-regler som resten av The Role Room-agenten: admins går
    // gjennom, betalende planer får tilgang, trial-brukere innenfor sine tak.
    const entitlement = await checkAgentEntitlement(pool, session.userId, session.role);
    if (!entitlement.allowed) {
      return res.status(402).json({
        success: false,
        error: entitlement.reason || "Feed-planlegging krever aktiv Role Room-pakke.",
        entitlement,
      });
    }

    const body =
      req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const posts = normalizeFeedPostsPayload(body.posts);
    const brandSnapshot = body.brandSnapshot === undefined ? null : body.brandSnapshot;

    const saved = await saveFeedPlan(pool, projectId, platform, posts, {
      brandSnapshot,
      updatedBy: session.userId,
    });

    if (!saved) {
      return res.status(500).json({
        success: false,
        error: "Kunne ikke lagre feed-planen.",
      });
    }

    return res.json({
      success: true,
      plan: {
        projectId: saved.projectId,
        platform: saved.platform,
        posts: saved.posts,
        brandSnapshot: saved.brandSnapshot,
        updatedAt: saved.updatedAt,
        updatedBy: saved.updatedBy,
      },
    });
  });

  // ── Approval-flyt for feed-posts ─────────────────────────────────────────
  // Patcher approvalState (+ audit-felter) på en eller flere poster i
  // gjeldende feed-plan. Posten må eksistere i planen — ukjente IDs
  // returnerer 404. State-overgang er ikke streng (vi tillater alle
  // transisjoner), men UI styrer hvilke knapper som vises i hver tilstand.
  app.post("/api/role-room/agent/feed-plan/:projectId/:platform/approve", async (req, res) => {
    const featureId = "role-room-agent-producer";
    if (!isCompatAdminFeatureEnabled(featureId)) {
      return res.status(403).json({ success: false, error: "The Role Room Agent er ikke aktivert." });
    }
    const session = requireAdminSession(req, res);
    if (!session) return;

    const { projectId, platform } = req.params;
    if (!projectId || !isSupportedFeedPlatform(platform)) {
      return res.status(400).json({ success: false, error: "projectId og støttet plattform er påkrevd." });
    }

    const body = (req.body || {}) as Record<string, unknown>;
    const postIds = Array.isArray(body.postIds) ? (body.postIds as unknown[]) : [];
    const newState = String(body.approvalState || '').trim();
    const note = typeof body.approvalNote === 'string' ? body.approvalNote : null;

    const validStates = ['draft', 'approved', 'scheduled', 'published', 'rejected', 'needs_changes'];
    if (!validStates.includes(newState)) {
      return res.status(400).json({
        success: false,
        error: `approvalState må være en av: ${validStates.join(', ')}`,
      });
    }
    if (postIds.length === 0) {
      return res.status(400).json({ success: false, error: "postIds[] kan ikke være tom" });
    }

    const plan = await loadFeedPlan(pool, projectId, platform);
    if (!plan) {
      return res.status(404).json({ success: false, error: "Feed-plan ikke funnet" });
    }

    const wantedIds = new Set(postIds.map((id) => String(id)));
    const now = new Date().toISOString();
    let touched = 0;
    const nextPosts = plan.posts.map((post) => {
      if (!wantedIds.has(post.id)) return post;
      touched += 1;
      return {
        ...post,
        approvalState: newState as RoleRoomFeedApprovalState,
        approvalChangedAt: now,
        approvalChangedBy: session.email ?? session.userId ?? null,
        approvalNote: newState === 'rejected' || newState === 'needs_changes' ? note : null,
      };
    });

    if (touched === 0) {
      return res.status(404).json({
        success: false,
        error: "Ingen av de oppgitte postIds finnes i planen",
      });
    }

    const saved = await saveFeedPlan(pool, projectId, platform, nextPosts, {
      brandSnapshot: plan.brandSnapshot,
      updatedBy: session.email ?? session.userId ?? null,
    });

    return res.json({
      success: true,
      touched,
      posts: saved?.posts ?? nextPosts,
    });
  });

}
