/**
 * role-room-agent-core-routes.ts
 *
 * Setup-funksjon for kjerne-/access-endpoints under /api/role-room/agent/* —
 * Innholdsprodusent-mode-feature for AI-drevet content-strategi.
 *
 * 3 endpoints (kjerne):
 *   - GET  /agent/access                              (feature-flag + provider-config status)
 *   - POST /agent/producer-bootstrap                  (Claude → markedsplan-bootstrap)
 *   - GET  /agent/feed-plan/approvals/pending         (pending posts på tvers av prosjekter)
 *
 * NB: Resten av agent-clusteret er splittet i sub-moduler:
 *   - role-room-agent-feed-plan-routes.ts (10 endpoints — templates,
 *     strategy/recommend, drive, CRUD, approve)
 *   - role-room-agent-inspect-routes.ts (6 endpoints — meta-page-inspect,
 *     page-search, page-content-inspect, hashtag-suggest,
 *     ig-hashtag-inspect, ads-attribution-inspect)
 *
 * Auth: requireAdminSession + feature-flag `role-room-agent-producer`.
 *
 * Wire opp i backend/server/index.ts ved å legge til:
 *
 *   import { setupRoleRoomAgentCoreRoutes } from "./role-room-agent-core-routes";
 *
 *   setupRoleRoomAgentCoreRoutes({
 *     app, pool, getActiveSessionFromRequest, requireAdminSession,
 *     isCompatAdminFeatureEnabled, getCompatAdminFeature,
 *   });
 *
 * Mode-noter: Innholdsprodusent-mode-feature, gated på feature-flag.
 * Backend mode-agnostic.
 */

import type express from "express";
import type { Pool } from "pg";

import {
  generateRoleRoomAgentProducerBootstrap,
  getRoleRoomAgentRuntimeConfig,
} from "./role-room-agent.js";
import { readString } from "./_shared";

interface AdminSession {
  userId: string;
  email: string;
  name: string;
  role: string;
  loginAt: string;
}

export interface RoleRoomAgentCoreRoutesDeps {
  app: express.Application;
  pool: Pool;
  getActiveSessionFromRequest: (
    req: express.Request,
  ) => { userId: string; email: string; role?: string } | null;
  requireAdminSession: (
    req: express.Request,
    res: express.Response,
  ) => AdminSession | null;
  isCompatAdminFeatureEnabled: (featureId: string) => boolean;
  getCompatAdminFeature: (featureId: string) => Record<string, unknown> | null;
}

export function setupRoleRoomAgentCoreRoutes(
  deps: RoleRoomAgentCoreRoutesDeps,
): void {
  const {
    app,
    pool,
    getActiveSessionFromRequest,
    requireAdminSession,
    isCompatAdminFeatureEnabled,
    getCompatAdminFeature,
  } = deps;

  // Admin feature flags compatibility endpoints
  app.get("/api/role-room/agent/access", (req, res) => {
    const featureId = "role-room-agent-producer";
    const feature = getCompatAdminFeature(featureId);
    const session = getActiveSessionFromRequest(req);
    const runtimeConfig = getRoleRoomAgentRuntimeConfig();
    const normalizedRole = String(session?.role || "").trim().toLowerCase();
    const isAdmin =
      normalizedRole === "admin" ||
      normalizedRole === "owner" ||
      normalizedRole === "super_admin";
    const enabled = isCompatAdminFeatureEnabled(featureId);

    res.json({
      success: true,
      featureId,
      enabled,
      isAdmin,
      allowed: enabled && isAdmin,
      stage: "admin_test",
      audience: "content_producer",
      feature: feature ?? null,
      provider: runtimeConfig.provider,
      providerConfigured: runtimeConfig.providerConfigured,
      defaultModel: runtimeConfig.defaultModel,
      googlePlacesConfigured: runtimeConfig.googlePlacesConfigured,
      cohereConfigured: runtimeConfig.cohereConfigured,
      cohereRerankModel: runtimeConfig.cohereRerankModel,
      brregConfigured: runtimeConfig.brregConfigured,
    });
  });

  app.post("/api/role-room/agent/producer-bootstrap", async (req, res) => {
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

    const body =
      req.body && typeof req.body === "object"
        ? (req.body as Record<string, unknown>)
        : {};
    const projectId = readString(body.projectId);
    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: "projectId er påkrevd.",
      });
    }

    try {
      const result = await generateRoleRoomAgentProducerBootstrap({
        projectId,
        projectName: readString(body.projectName) ?? undefined,
        websiteUrl: readString(body.websiteUrl) ?? undefined,
        organizationNumber: readString(body.organizationNumber) ?? undefined,
        companyName: readString(body.companyName) ?? undefined,
        extraContext: readString(body.extraContext) ?? undefined,
      });

      return res.json({
        success: true,
        stage: "admin_test",
        featureId,
        generatedBy: {
          userId: session.userId,
          email: session.email,
          role: session.role,
        },
        result,
      });
    } catch (error) {
      console.error("[role-room-agent] Failed to generate producer bootstrap", error);
      return res.status(500).json({
        success: false,
        error: "Kunne ikke generere utkast fra The Role Room Agent.",
      });
    }
  });

  // Aggregert pending-approvals-API: lister alle posts som venter på review
  // på tvers av brukerens prosjekter. Brukes av en fremtidig "Approvals"-
  // dashboard-widget.
  app.get("/api/role-room/agent/feed-plan/approvals/pending", async (req, res) => {
    const featureId = "role-room-agent-producer";
    if (!isCompatAdminFeatureEnabled(featureId)) {
      return res.status(403).json({ success: false, error: "The Role Room Agent er ikke aktivert." });
    }
    const session = requireAdminSession(req, res);
    if (!session) return;

    try {
      const result = await pool.query<{
        project_id: string;
        platform: string;
        posts: Array<Record<string, unknown>>;
        updated_at: Date;
      }>(
        `SELECT project_id, platform, posts, updated_at
           FROM role_room_feed_plans
          WHERE updated_by = $1 OR updated_by IS NULL
          ORDER BY updated_at DESC
          LIMIT 50`,
        [session.email ?? session.userId],
      );

      const pending: Array<{
        projectId: string;
        platform: string;
        postId: string;
        title: string;
        caption: string;
        scheduledFor: string | null;
        approvalState: string;
        approvalChangedAt: string | null;
      }> = [];

      for (const plan of result.rows) {
        for (const post of plan.posts ?? []) {
          const state = String(post.approvalState ?? 'draft');
          if (state === 'draft' || state === 'needs_changes') {
            pending.push({
              projectId: plan.project_id,
              platform: plan.platform,
              postId: String(post.id ?? ''),
              title: String(post.title ?? ''),
              caption: String(post.caption ?? '').slice(0, 200),
              scheduledFor: typeof post.scheduledFor === 'string' ? post.scheduledFor : null,
              approvalState: state,
              approvalChangedAt:
                typeof post.approvalChangedAt === 'string' ? post.approvalChangedAt : null,
            });
          }
        }
      }

      return res.json({ success: true, pending, totalPending: pending.length });
    } catch (error) {
      console.error('[approval-pending] query failed', error);
      return res.status(500).json({ success: false, error: "Kunne ikke hente pending-approvals." });
    }
  });
}
