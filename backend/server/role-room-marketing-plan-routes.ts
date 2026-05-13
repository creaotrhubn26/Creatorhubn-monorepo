/**
 * role-room-marketing-plan-routes.ts
 *
 * Setup-funksjon for /api/role-room/marketing-plan/* endpoints —
 * Innholdsprodusent-mode-feature for å generere og forvalte AI-genererte
 * markedsplaner med innhold-pillarer, kanal-strategi og 30-post Claude-
 * forslag som kan akseptes inn i feed-planneren.
 *
 * 7 endpoints:
 *   - POST /readiness                              (sjekk om bootstrap er klar for plan)
 *   - POST /generate                               (Claude → strategi+pillars, persist)
 *   - GET  /:projectId                             (hent aktiv plan)
 *   - GET  /:planId/posts                          (post-liste for plan)
 *   - POST /:planId/generate-posts                 (Claude → 30 posts, persist)
 *   - POST /posts/:postId/accept                   (accept post → feed-planner)
 *   - POST /:planId/activate                       (aktiver draft-plan)
 *
 * Feature-gated: alle skrivende endpoints krever feature-flag
 * `role-room-agent-producer` + AI-quota-entitlement (checkAgentEntitlement).
 *
 * Auth: requireAdminSession.
 *
 * Wire opp i backend/server/index.ts ved å legge til:
 *
 *   import { setupRoleRoomMarketingPlanRoutes } from "./role-room-marketing-plan-routes";
 *
 *   setupRoleRoomMarketingPlanRoutes({
 *     app, pool, requireAdminSession, isCompatAdminFeatureEnabled,
 *   });
 *
 * Mode-noter: marketing-plan er primært **Innholdsprodusent-mode**-feature.
 * Ingen direkte mode-branching i endpoint-koden, men feature-flagget
 * `role-room-agent-producer` styrer tilgangen og er aktivert per produkt-
 * modus i frontend. Backend-koden er mode-agnostisk — endpoints fungerer
 * for alle moduser så lenge feature-flag og entitlement er på.
 */

import type express from "express";
import type { Pool } from "pg";

import { checkAgentEntitlement } from "./role-room-agent-entitlements.js";
import {
  activateMarketingPlan,
  checkMarketingPlanReadiness,
  fetchActiveMarketingPlan,
  generateMarketingPlan,
  persistGeneratedMarketingPlan,
} from "./role-room-marketing-plan.js";
import {
  acceptPlanPostIntoFeedPlanner,
  generatePlanPosts,
  listPlanPosts,
  persistPlanPosts,
} from "./role-room-marketing-plan-posts.js";
import { listInstagramConnections } from "./role-room-instagram-oauth.js";
import { loadFeedPlan, saveFeedPlan } from "./role-room-feed-plan.js";

interface AdminSession {
  userId: string;
  email: string;
  name: string;
  role: string;
  loginAt: string;
}

export interface RoleRoomMarketingPlanRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireAdminSession: (
    req: express.Request,
    res: express.Response,
  ) => AdminSession | null;
  isCompatAdminFeatureEnabled: (featureId: string) => boolean;
}

export function setupRoleRoomMarketingPlanRoutes(
  deps: RoleRoomMarketingPlanRoutesDeps,
): void {
  const { app, pool, requireAdminSession, isCompatAdminFeatureEnabled } = deps;

  app.post("/api/role-room/marketing-plan/readiness", async (req, res) => {
    const featureId = "role-room-agent-producer";
    if (!isCompatAdminFeatureEnabled(featureId)) {
      return res.status(403).json({ success: false, error: "The Role Room Agent er ikke aktivert." });
    }
    const session = requireAdminSession(req, res);
    if (!session) return;
    const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const bootstrap = (body.bootstrap ?? {}) as Parameters<typeof checkMarketingPlanReadiness>[0];
    const connections = await listInstagramConnections(pool, session.userId);
    const readiness = checkMarketingPlanReadiness(bootstrap, connections.length > 0);
    return res.json({ success: true, readiness });
  });

  app.post("/api/role-room/marketing-plan/generate", async (req, res) => {
    const featureId = "role-room-agent-producer";
    if (!isCompatAdminFeatureEnabled(featureId)) {
      return res.status(403).json({ success: false, error: "The Role Room Agent er ikke aktivert." });
    }
    const session = requireAdminSession(req, res);
    if (!session) return;

    const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
    if (!projectId) {
      return res.status(400).json({ success: false, error: "projectId er påkrevd." });
    }
    if (!body.bootstrap || typeof body.bootstrap !== "object") {
      return res.status(400).json({ success: false, error: "bootstrap er påkrevd." });
    }
    const horizonDays = typeof body.horizonDays === "number" && body.horizonDays > 0 && body.horizonDays <= 90
      ? Math.round(body.horizonDays)
      : undefined;

    // Entitlement gate — marketing-plan generation counts against the
    // same AI quota as other Claude-powered features.
    const entitlement = await checkAgentEntitlement(pool, session.userId, session.role);
    if (!entitlement.allowed) {
      return res.status(402).json({
        success: false,
        error: entitlement.reason || "Markedsplan-generering krever aktiv plan eller add-on.",
        entitlement,
      });
    }

    const connections = await listInstagramConnections(pool, session.userId);
    const bootstrap = body.bootstrap as Parameters<typeof checkMarketingPlanReadiness>[0];
    const readiness = checkMarketingPlanReadiness(bootstrap, connections.length > 0);
    if (!readiness.ready) {
      return res.status(409).json({
        success: false,
        error: "Bootstrap mangler nødvendige felter for en meningsfull markedsplan.",
        readiness,
      });
    }

    const generated = await generateMarketingPlan({
      bootstrap,
      hasInstagramConnection: connections.length > 0,
      horizonDays,
    });
    if (!generated) {
      return res.status(503).json({
        success: false,
        error: "Claude kunne ikke generere planen nå. Sjekk ANTHROPIC_API_KEY eller prøv igjen.",
      });
    }

    const persisted = await persistGeneratedMarketingPlan(pool, {
      projectId,
      ownerUserId: session.userId,
      horizonDays,
      generated,
    });
    if (!persisted) {
      return res.status(500).json({ success: false, error: "Kunne ikke lagre planen." });
    }
    return res.json({ success: true, plan: persisted });
  });

  app.get("/api/role-room/marketing-plan/:projectId", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const projectId = String(req.params.projectId || "").trim();
    if (!projectId) {
      return res.status(400).json({ success: false, error: "projectId er påkrevd." });
    }
    const plan = await fetchActiveMarketingPlan(pool, projectId);
    return res.json({ success: true, plan });
  });

  app.get("/api/role-room/marketing-plan/:planId/posts", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const planId = String(req.params.planId || "").trim();
    if (!planId) {
      return res.status(400).json({ success: false, error: "planId er påkrevd." });
    }
    const posts = await listPlanPosts(pool, planId);
    return res.json({ success: true, posts });
  });

  app.post("/api/role-room/marketing-plan/:planId/generate-posts", async (req, res) => {
    const featureId = "role-room-agent-producer";
    if (!isCompatAdminFeatureEnabled(featureId)) {
      return res.status(403).json({ success: false, error: "The Role Room Agent er ikke aktivert." });
    }
    const session = requireAdminSession(req, res);
    if (!session) return;

    const planId = String(req.params.planId || "").trim();
    const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
    if (!planId || !projectId) {
      return res.status(400).json({ success: false, error: "planId og projectId er påkrevd." });
    }

    // Entitlement — 30-post Claude-gen counts against the AI quota.
    const entitlement = await checkAgentEntitlement(pool, session.userId, session.role);
    if (!entitlement.allowed) {
      return res.status(402).json({
        success: false,
        error: entitlement.reason || "Markedsplan-generering krever aktiv plan eller add-on.",
        entitlement,
      });
    }

    // Load the plan + pillars so we can hand Claude the full strategy
    // context. Ownership gate: plan must belong to the session user's
    // project (fetchActiveMarketingPlan only returns draft/active; we
    // also verify owner_user_id to prevent cross-project generation).
    const plan = await fetchActiveMarketingPlan(pool, projectId);
    if (!plan || plan.id !== planId || plan.ownerUserId !== session.userId) {
      return res.status(404).json({ success: false, error: "Fant ingen aktiv markedsplan for dette prosjektet." });
    }

    const generated = await generatePlanPosts({
      strategy: plan.strategy,
      pillars: plan.pillars,
      horizonDays: plan.horizonDays,
    });
    if (!generated) {
      return res.status(503).json({
        success: false,
        error: "Claude kunne ikke generere post-planen nå. Prøv igjen om et øyeblikk.",
      });
    }
    const persisted = await persistPlanPosts(pool, {
      planId,
      posts: generated.posts,
      pillarIndexToId: generated.pillarIndexToId,
    });
    if (!persisted) {
      return res.status(500).json({ success: false, error: "Kunne ikke lagre post-planen." });
    }
    return res.json({ success: true, posts: persisted, model: generated.model });
  });

  // Accept a plan-post into the feed-planner so it becomes schedulable.
  // Idempotent — re-accepting an already-scheduled post returns current
  // state without duplicating the feed entry.
  app.post("/api/role-room/marketing-plan/posts/:postId/accept", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const postId = String(req.params.postId || "").trim();
    const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
    const scheduledFor = typeof body.scheduledFor === "string" ? body.scheduledFor : null;
    if (!postId || !projectId) {
      return res.status(400).json({ success: false, error: "postId og projectId er påkrevd." });
    }
    const result = await acceptPlanPostIntoFeedPlanner(
      pool,
      { planPostId: postId, projectId, ownerUserId: session.userId, scheduledFor },
      { loadFeedPlan: loadFeedPlan as never, saveFeedPlan: saveFeedPlan as never },
    );
    if (!result) {
      return res.status(404).json({
        success: false,
        error: "Fant ikke posten eller du eier den ikke.",
      });
    }
    return res.json({ success: true, planPost: result.planPost, feedPlanPostId: result.feedPlanPostId });
  });

  app.post("/api/role-room/marketing-plan/:planId/activate", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const planId = String(req.params.planId || "").trim();
    const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
    if (!planId || !projectId) {
      return res.status(400).json({ success: false, error: "planId og projectId er påkrevd." });
    }
    const ok = await activateMarketingPlan(pool, planId, projectId);
    if (!ok) {
      return res.status(409).json({
        success: false,
        error: "Fant ingen draft-plan å aktivere (kan allerede være aktivert eller arkivert).",
      });
    }
    const plan = await fetchActiveMarketingPlan(pool, projectId);
    return res.json({ success: true, plan });
  });
}
