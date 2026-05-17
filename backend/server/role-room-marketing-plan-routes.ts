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

import crypto from "node:crypto";
import zlib from "node:zlib";
import type express from "express";
import type { Pool } from "pg";

import { checkAgentEntitlement } from "./role-room-agent-entitlements.js";
import {
  findCreatorsForPost,
  fetchInstagramDiscovery,
} from "./role-room-creator-discovery.js";
import {
  persistKpiSnapshot,
  persistKpiSnapshotBatch,
  listKpiSnapshots,
  summarizeKpis,
} from "./role-room-kpi-tracking.js";
import { fetchAllPlatformKpis } from "./role-room-kpi-connectors.js";
import {
  aggregateByPillar,
  aggregateByPlatform,
  aggregateByFormat,
  aggregateByTimeWindow,
  detectOutliers,
  suggestCorrections,
} from "./role-room-kpi-analytics.js";
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

    // Item #194 — feedback-loop: hvis det finnes en tidligere plan med
    // KPI-data, bygg sammendrag av topp-pillar/format/platform + missed
    // targets og pass det til generateMarketingPlan som context.
    let previousPlanKpiContext: Parameters<typeof generateMarketingPlan>[0]["previousPlanKpiContext"] | undefined;
    try {
      const prev = await fetchActiveMarketingPlan(pool, projectId);
      if (prev && prev.id) {
        const [snapshots, prevTargets] = await Promise.all([
          listKpiSnapshots(pool, prev.id, { sinceDays: 30 }),
          Promise.resolve(prev.strategy?.kpiTargets ?? []),
        ]);
        if (snapshots.length > 0) {
          // Hent post-metadata for å kunne aggregere
          const r = await pool.query<{ id: string; pillar_id: string | null; pillar_name: string | null; primary_platform: string | null; format: string }>(
            `SELECT pp.id, pp.pillar_id, piln.name AS pillar_name, pp.primary_platform, pp.format
               FROM role_room_marketing_plan_posts pp
               LEFT JOIN role_room_marketing_plan_pillars piln ON piln.id = pp.pillar_id
              WHERE pp.plan_id = $1`,
            [prev.id],
          );
          const postsForAgg = r.rows.map((row) => ({
            id: row.id,
            pillarId: row.pillar_id,
            pillarName: row.pillar_name,
            primaryPlatform: row.primary_platform,
            format: row.format,
            scheduledFor: null,
          }));
          const primaryMetric = prevTargets[0]?.metric ?? "impressions";
          const pillarAgg = aggregateByPillar(snapshots, postsForAgg);
          const formatAgg = aggregateByFormat(snapshots, postsForAgg);
          const platformAgg = aggregateByPlatform(snapshots, postsForAgg);
          const top = (buckets: typeof pillarAgg): { name: string; value: number } | null => {
            const sorted = buckets
              .map((b) => ({ name: b.label, value: b.avgByMetric[primaryMetric] ?? 0 }))
              .filter((b) => b.value > 0)
              .sort((a, b) => b.value - a.value);
            return sorted[0] ?? null;
          };
          const missedTargets = prevTargets.flatMap((t) => {
            const platformAvgs = platformAgg.map((b) => b.avgByMetric[t.metric] ?? 0).filter((v) => v > 0);
            if (platformAvgs.length === 0) return [];
            const actual = platformAvgs.reduce((a, b) => a + b, 0) / platformAvgs.length;
            const ratio = actual / t.target;
            if (ratio >= 0.8) return [];
            return [{ metric: t.metric, target: t.target, actual: Math.round(actual * 100) / 100, ratio: Math.round(ratio * 100) / 100 }];
          });
          previousPlanKpiContext = {
            totalSnapshots: snapshots.length,
            topPillar: top(pillarAgg) ? { name: top(pillarAgg)!.name, primaryMetric, value: top(pillarAgg)!.value } : null,
            topFormat: top(formatAgg) ? { name: top(formatAgg)!.name, primaryMetric, value: top(formatAgg)!.value } : null,
            topPlatform: top(platformAgg) ? { name: top(platformAgg)!.name, primaryMetric, value: top(platformAgg)!.value } : null,
            missedTargets,
          };
        }
      }
    } catch (error) {
      console.warn("[marketing-plan-routes] kpi-feedback-loop: skipped pga lookup-feil", error);
    }

    const generated = await generateMarketingPlan({
      bootstrap,
      hasInstagramConnection: connections.length > 0,
      horizonDays,
      previousPlanKpiContext,
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

    // Item #151 — auto-generer 30 posts i bakgrunnen etter activate.
    // Fire-and-forget: vi venter ikke på resultatet (det tar 30-60s med
    // Claude og brukeren skal ikke holdes igjen). Hvis genereringen
    // feiler logges det; brukeren kan fortsatt trigge manuelt via
    // /generate-posts-endepunktet. Sjekker først om posts allerede finnes
    // for å unngå duplisering ved re-activate.
    if (plan && plan.id) {
      void (async () => {
        try {
          const existingPosts = await listPlanPosts(pool, plan.id);
          if (existingPosts.length > 0) {
            console.log(`[marketing-plan] auto-generation skipped — plan ${plan.id} already has ${existingPosts.length} posts`);
            return;
          }
          const generated = await generatePlanPosts({
            strategy: plan.strategy,
            pillars: plan.pillars,
            horizonDays: plan.horizonDays,
          });
          if (generated && generated.posts.length > 0) {
            await persistPlanPosts(pool, {
              planId: plan.id,
              posts: generated.posts,
              pillarIndexToId: generated.pillarIndexToId,
            });
            console.log(`[marketing-plan] auto-generated ${generated.posts.length} posts for plan ${plan.id}`);
          }
        } catch (error) {
          console.error("[marketing-plan] auto-generation failed", {
            planId: plan.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })();
    }

    return res.json({ success: true, plan });
  });

  // Item #130 — Share-link for plan preview (read-only, 24h TTL).
  // Gjenbruker samme HMAC + gzip-mønster som research/share-routen i
  // role-room-agent-core-routes.ts. Endpoint-en lager en signert token
  // som klienter kan åpne uten innlogging via /shared/:token.
  const PLAN_SHARE_SECRET = process.env.ROLE_ROOM_SHARE_SECRET ?? null;
  const b64urlEncode = (input: Buffer | string): string => {
    const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
    return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  };
  const b64urlDecode = (input: string): Buffer => {
    const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((input.length + 3) % 4);
    return Buffer.from(padded, "base64");
  };

  app.post("/api/role-room/marketing-plan/:planId/share", async (req, res) => {
    if (!PLAN_SHARE_SECRET || PLAN_SHARE_SECRET.length < 32) {
      return res.status(503).json({ success: false, error: "ROLE_ROOM_SHARE_SECRET er ikke konfigurert." });
    }
    const session = requireAdminSession(req, res);
    if (!session) return;
    const planId = String(req.params.planId || "").trim();
    if (!planId) {
      return res.status(400).json({ success: false, error: "planId er påkrevd." });
    }
    const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
    if (!projectId) {
      return res.status(400).json({ success: false, error: "projectId er påkrevd." });
    }

    // Hent planen + posts inn i én envelope. Vi gjenbruker fetchActive...
    // selv om planen er draft fordi share lager preview.
    let plan;
    try {
      plan = await fetchActiveMarketingPlan(pool, projectId);
    } catch {
      plan = null;
    }
    if (!plan || plan.id !== planId) {
      return res.status(404).json({ success: false, error: "Fant ingen plan å dele (sjekk projectId/planId)." });
    }

    const ttlMs = 24 * 60 * 60 * 1000;  // alltid 24t for plan-preview
    const issuedAt = Date.now();
    const expiresAt = issuedAt + ttlMs;
    const envelope = {
      v: 1,
      kind: "marketing_plan",
      iat: issuedAt,
      exp: expiresAt,
      iss: session.userId,
      plan,
    };
    const json = JSON.stringify(envelope);
    const compressed = zlib.gzipSync(Buffer.from(json, "utf8"));
    if (compressed.length > 800_000) {
      return res.status(413).json({
        success: false,
        error: "Plan er for stor for inline share-link.",
      });
    }
    const payloadB64 = `z${b64urlEncode(compressed)}`;
    const sig = crypto.createHmac("sha256", PLAN_SHARE_SECRET).update(payloadB64).digest();
    const token = `${payloadB64}.${b64urlEncode(sig)}`;
    const origin = (req.headers["x-forwarded-host"] || req.headers.host) as string | undefined;
    const proto = (req.headers["x-forwarded-proto"] as string | undefined) || (req.secure ? "https" : "http");
    const baseUrl = origin ? `${proto}://${origin}` : "";
    return res.json({
      success: true,
      token,
      shareUrl: `${baseUrl}/role-room/marketing-plan/shared/${token}`,
      expiresAt: new Date(expiresAt).toISOString(),
      expiresInHours: 24,
    });
  });

  // Item #165 ekte fiks — creator-discovery. Returnerer kuratert liste
  // av norske skapere fra norwegian-creators.json + (når IG-konto er
  // koblet) live discovery-stats for hver match. Tar industry + post-hook
  // som input for relevans-scoring.
  app.post("/api/role-room/marketing-plan/posts/:postId/creators", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const postId = String(req.params.postId || "").trim();
    if (!postId) return res.status(400).json({ success: false, error: "postId er påkrevd." });

    let post: any;
    try {
      const r = await pool.query(
        `SELECT pp.hook, pp.primary_platform, p.owner_user_id, p.project_id
           FROM role_room_marketing_plan_posts pp
           JOIN role_room_marketing_plans p ON p.id = pp.plan_id
          WHERE pp.id = $1`,
        [postId],
      );
      if (!r.rows[0]) return res.status(404).json({ success: false, error: "Fant ikke posten." });
      if (r.rows[0].owner_user_id !== session.userId) {
        return res.status(403).json({ success: false, error: "Du eier ikke planen." });
      }
      post = r.rows[0];
    } catch (error) {
      console.error("[marketing-plan-routes] creators: post-lookup failed", error);
      return res.status(500).json({ success: false, error: "Kunne ikke laste posten." });
    }

    const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const industry = typeof body.industry === "string" ? body.industry : null;

    const curated = findCreatorsForPost({
      industry,
      primaryPlatform: post.primary_platform,
      hook: post.hook ?? "",
      limit: 8,
    });

    // Forsøk å berike top-3 med IG-discovery-stats hvis IG er koblet
    // til prosjektet. Vi bryr oss kun om Instagram-discovery siden Meta
    // er eneste public discovery-API på sosiale plattformer.
    let igEnriched: Array<{ handle: string; followersCount: number; biography: string | null; profilePictureUrl: string | null }> = [];
    try {
      const conn = await pool.query<{ ig_user_id: string; access_token: string }>(
        `SELECT ig_user_id, access_token
           FROM role_room_instagram_connections
          WHERE project_id = $1
          ORDER BY connected_at DESC
          LIMIT 1`,
        [post.project_id],
      );
      const row = conn.rows[0];
      if (row?.ig_user_id && row?.access_token) {
        const igTargets = curated.filter((c) => c.platforms.includes("instagram")).slice(0, 3);
        for (const c of igTargets) {
          const discovery = await fetchInstagramDiscovery(row.ig_user_id, row.access_token, c.handle);
          if (discovery) {
            igEnriched.push({
              handle: c.handle,
              followersCount: discovery.followersCount,
              biography: discovery.biography,
              profilePictureUrl: discovery.profilePictureUrl,
            });
          }
        }
      }
    } catch {
      // IG-konto-tabell mangler eller spørring feilet. Ikke kritisk.
    }

    return res.json({
      success: true,
      creators: curated,
      igEnriched,
      dataSource: igEnriched.length > 0 ? "curated_plus_live_ig" : "curated_only",
    });
  });

  // Item #168 ekte fiks — thumbnail-generering. Bruker post-hook + brand-
  // farger som prompt. Returnerer URL (gyldig 60 min for OpenAI).
  // Frontend rendrer som <img>. For varig persistering må vi senere
  // laste opp til Vercel Blob / R2.
  //
  // Provider-routing (#59):
  //   1. Hvis AI_GATEWAY_API_KEY er satt → ruter via Vercel AI Gateway
  //      (gir fallback, observability, cost-tracking på tvers av
  //      providers). Modell-streng default 'openai/dall-e-3' kan
  //      overstyres via THUMBNAIL_MODEL env-var (f.eks. 'google/imagen-3'
  //      hvis du vil bytte til Imagen uten kodeendring).
  //   2. Ellers fall tilbake til direkte OpenAI med OPENAI_API_KEY.
  //   3. Hvis ingen av delene er satt → 503.
  app.post("/api/role-room/marketing-plan/posts/:postId/thumbnail", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const postId = String(req.params.postId || "").trim();
    if (!postId) return res.status(400).json({ success: false, error: "postId er påkrevd." });

    const gatewayKey = process.env.AI_GATEWAY_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!gatewayKey && !openaiKey) {
      return res.status(503).json({
        success: false,
        error: "Hverken AI_GATEWAY_API_KEY eller OPENAI_API_KEY er satt — thumbnail-generering trenger minst én av dem.",
      });
    }
    const useGateway = Boolean(gatewayKey);
    const modelString = process.env.THUMBNAIL_MODEL || "openai/dall-e-3";

    let post: any;
    try {
      const r = await pool.query(
        `SELECT pp.hook, pp.format, pp.primary_platform, p.owner_user_id
           FROM role_room_marketing_plan_posts pp
           JOIN role_room_marketing_plans p ON p.id = pp.plan_id
          WHERE pp.id = $1`,
        [postId],
      );
      if (!r.rows[0]) return res.status(404).json({ success: false, error: "Fant ikke posten." });
      if (r.rows[0].owner_user_id !== session.userId) {
        return res.status(403).json({ success: false, error: "Du eier ikke planen." });
      }
      post = r.rows[0];
    } catch (error) {
      console.error("[marketing-plan-routes] thumbnail: post-lookup failed", error);
      return res.status(500).json({ success: false, error: "Kunne ikke laste posten." });
    }

    const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const brandPrimaryHex = typeof body.brandPrimaryHex === "string" ? body.brandPrimaryHex : null;
    const brandAccentHex = typeof body.brandAccentHex === "string" ? body.brandAccentHex : null;
    const aspectRatio = post.format === "youtube_short" || post.format === "tiktok" || post.format === "reel"
      ? "1024x1792" // portrait 9:16 (DALL-E støtter 1024x1024, 1792x1024, 1024x1792)
      : post.format === "image"
        ? "1024x1024"
        : "1024x1024";

    const prompt = [
      `Eye-catching social media thumbnail for ${post.primary_platform ?? "instagram"} ${post.format ?? "post"}.`,
      `Concept: "${post.hook}".`,
      `Style: vibrant, professional, photographic.`,
      `Composition: bold focal point, high contrast, suitable for ${aspectRatio.includes("1792") ? "vertical" : "square"} format.`,
      brandPrimaryHex ? `Primary brand color hint: ${brandPrimaryHex}.` : "",
      brandAccentHex ? `Accent color hint: ${brandAccentHex}.` : "",
      `No text overlay — designer will add text on top. No watermarks.`,
    ].filter(Boolean).join(" ");

    try {
      // Bestem endpoint + provider-model basert på router-valg.
      // AI Gateway-format: model-stringen er "provider/model" (eks.
      // "openai/dall-e-3", "google/imagen-3"). Endpoint er gateway's
      // OpenAI-kompatible images-route.
      const endpoint = useGateway
        ? "https://ai-gateway.vercel.sh/v1/images/generations"
        : "https://api.openai.com/v1/images/generations";
      const authKey = useGateway ? gatewayKey! : openaiKey!;
      const modelName = useGateway ? modelString : "dall-e-3";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authKey}`,
        },
        body: JSON.stringify({
          model: modelName,
          prompt: prompt.slice(0, 4000),
          n: 1,
          size: aspectRatio,
          quality: "standard",
          response_format: "url",
        }),
        signal: AbortSignal.timeout(60_000),
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        console.error("[marketing-plan-routes] thumbnail provider failed", {
          provider: useGateway ? "ai-gateway" : "openai-direct",
          model: modelName,
          status: response.status,
          body: text.slice(0, 400),
        });
        return res.status(502).json({
          success: false,
          error: `Thumbnail-provider feil ${response.status}: ${text.slice(0, 200) || "ukjent"}`,
        });
      }
      const payload = await response.json() as { data?: Array<{ url?: string; revised_prompt?: string }> };
      const url = payload.data?.[0]?.url;
      if (!url) {
        return res.status(502).json({ success: false, error: "Provider returnerte ingen URL." });
      }
      return res.json({
        success: true,
        imageUrl: url,
        revisedPrompt: payload.data?.[0]?.revised_prompt ?? null,
        validForMinutes: 60,
        aspectRatio,
        provider: useGateway ? "ai-gateway" : "openai-direct",
        model: modelName,
      });
    } catch (error) {
      console.error("[marketing-plan-routes] thumbnail generation failed", error);
      return res.status(500).json({ success: false, error: "Thumbnail-generering feilet." });
    }
  });

  // Item #169 ekte fiks — reach-estimat basert på bransje-benchmark +
  // (når koblet) faktisk follower-count fra IG-konto. Returnerer estimert
  // reach-range (min/max) + confidence-nivå.
  app.post("/api/role-room/marketing-plan/posts/:postId/reach-estimate", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const postId = String(req.params.postId || "").trim();
    if (!postId) return res.status(400).json({ success: false, error: "postId er påkrevd." });

    let post: any;
    try {
      const r = await pool.query(
        `SELECT pp.format, pp.primary_platform, p.owner_user_id, p.project_id
           FROM role_room_marketing_plan_posts pp
           JOIN role_room_marketing_plans p ON p.id = pp.plan_id
          WHERE pp.id = $1`,
        [postId],
      );
      if (!r.rows[0]) return res.status(404).json({ success: false, error: "Fant ikke posten." });
      if (r.rows[0].owner_user_id !== session.userId) {
        return res.status(403).json({ success: false, error: "Du eier ikke planen." });
      }
      post = r.rows[0];
    } catch (error) {
      console.error("[marketing-plan-routes] reach-estimate: post-lookup failed", error);
      return res.status(500).json({ success: false, error: "Kunne ikke laste posten." });
    }

    const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const userFollowers = typeof body.followers === "number" && body.followers > 0 ? Math.round(body.followers) : null;
    const platform = post.primary_platform ?? "instagram";

    // Bransje-benchmark: organisk reach-rate som andel av followers.
    // Source: Sprout Social 2025, Hootsuite 2026. Lavt tall fordi
    // algoritmene har strammet inn organisk rekkevidde drastisk.
    const REACH_RATE_BENCHMARK: Record<string, { min: number; max: number }> = {
      instagram: { min: 0.10, max: 0.35 },   // 10-35% av followers
      facebook: { min: 0.03, max: 0.10 },    // 3-10% — kraftig nedgang siden 2018
      linkedin: { min: 0.15, max: 0.45 },    // LinkedIn har mest organisk rekkevidde
      tiktok: { min: 0.20, max: 5.00 },      // TikTok kan eksplodere via FYP
      youtube: { min: 0.05, max: 0.30 },     // YouTube subs ≠ views, vidt rom
    };
    // Format-multiplikator
    const FORMAT_MULTIPLIER: Record<string, number> = {
      reel: 1.5,        // Reels favoriseres på IG
      carousel: 1.2,    // Carousels får mer engagement enn singel-image
      image: 1.0,
      story: 0.3,       // Stories vises kun til ~25-30% av followers
      tiktok: 1.0,
      linkedin_post: 1.0,
      youtube_short: 1.3,
    };

    const benchmark = REACH_RATE_BENCHMARK[platform] ?? REACH_RATE_BENCHMARK.instagram;
    const multiplier = FORMAT_MULTIPLIER[post.format] ?? 1.0;

    let followerCount = userFollowers;
    let dataSource: "user_input" | "connected_account" | "benchmark_only" = "user_input";

    // Hvis IG koblet, prøv å hente faktisk follower-count
    if (!followerCount && platform === "instagram") {
      try {
        const conn = await pool.query<{ followers_count: number | null }>(
          `SELECT followers_count
             FROM role_room_instagram_connections
            WHERE project_id = $1
            ORDER BY connected_at DESC
            LIMIT 1`,
          [post.project_id],
        );
        if (conn.rows[0]?.followers_count) {
          followerCount = Number(conn.rows[0].followers_count);
          dataSource = "connected_account";
        }
      } catch {
        // Kolonne kan mangle på eldre miljøer
      }
    }

    if (!followerCount) {
      // Ingen data — vi kan fortsatt vise benchmark som "for 1000 followers"
      const minReach = Math.round(1000 * benchmark.min * multiplier);
      const maxReach = Math.round(1000 * benchmark.max * multiplier);
      return res.json({
        success: true,
        available: true,
        dataSource: "benchmark_only",
        message: `For 1000 followers på ${platform}, forventet rekkevidde: ${minReach}-${maxReach}. Skriv inn followers-count for et personlig estimat.`,
        per1000FollowersMin: minReach,
        per1000FollowersMax: maxReach,
        confidence: "low",
      });
    }

    const minReach = Math.round(followerCount * benchmark.min * multiplier);
    const maxReach = Math.round(followerCount * benchmark.max * multiplier);
    const midReach = Math.round((minReach + maxReach) / 2);

    return res.json({
      success: true,
      available: true,
      dataSource,
      followerCount,
      platform,
      format: post.format,
      minReach,
      midReach,
      maxReach,
      benchmark: {
        rateMin: benchmark.min,
        rateMax: benchmark.max,
        formatMultiplier: multiplier,
      },
      confidence: dataSource === "connected_account" ? "medium" : "low",
      note: "Estimat basert på industry-benchmarks 2025-2026. Faktisk reach varierer betydelig per innhold og algoritme-status.",
    });
  });

  // Item #170 — generér 3 svarmaler for forventede kommentarer (positiv,
  // spørsmål, negativ) basert på post-teksten. Bruker Haiku siden det
  // er små payloads. Returnerer ikke persistert — UI viser dem som
  // copy-til-utklippstavle-templates.
  app.post("/api/role-room/marketing-plan/posts/:postId/reply-templates", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const postId = String(req.params.postId || "").trim();
    if (!postId) return res.status(400).json({ success: false, error: "postId er påkrevd." });

    let post: any;
    try {
      const r = await pool.query(
        `SELECT pp.hook, pp.caption_draft, pp.primary_platform, p.owner_user_id
           FROM role_room_marketing_plan_posts pp
           JOIN role_room_marketing_plans p ON p.id = pp.plan_id
          WHERE pp.id = $1`,
        [postId],
      );
      if (!r.rows[0]) return res.status(404).json({ success: false, error: "Fant ikke posten." });
      if (r.rows[0].owner_user_id !== session.userId) {
        return res.status(403).json({ success: false, error: "Du eier ikke planen." });
      }
      post = r.rows[0];
    } catch (error) {
      console.error("[marketing-plan-routes] reply-templates: post-lookup failed", error);
      return res.status(500).json({ success: false, error: "Kunne ikke laste posten." });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ success: false, error: "ANTHROPIC_API_KEY mangler." });
    }

    try {
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const userMessage = `For følgende ${post.primary_platform ?? 'social media'}-post, lag 3 svar-maler på norsk som community-manager kan bruke når kommentarer kommer inn:

Hook: ${post.hook}
Caption: ${post.caption_draft ?? '(tomt)'}

Returner KUN JSON: { "positive": "svar på rosende kommentar", "question": "svar på spørsmål/curiosity", "negative": "svar på kritisk/negativ kommentar" }. Hvert svar maks 200 tegn. Skriv på norsk i samme tone som posten.`;

      const response: any = await client.messages.create({
        model: process.env.ROLE_ROOM_REGENERATE_MODEL || "claude-haiku-4-5-20251001",
        max_tokens: 600,
        temperature: 0.4,
        messages: [{ role: "user", content: userMessage }],
      });
      const block = response.content?.[0];
      if (!block || block.type !== "text") {
        return res.status(502).json({ success: false, error: "Claude returnerte ingen tekst." });
      }
      const cleaned = block.text.trim().replace(/^```json\n?|\n?```$/g, "");
      let parsed: { positive?: string; question?: string; negative?: string };
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        return res.status(502).json({ success: false, error: "Claude-respons kunne ikke parses." });
      }
      return res.json({
        success: true,
        templates: {
          positive: parsed.positive ?? null,
          question: parsed.question ?? null,
          negative: parsed.negative ?? null,
        },
      });
    } catch (error) {
      console.error("[marketing-plan-routes] reply-templates failed", error);
      return res.status(500).json({ success: false, error: "Generering feilet." });
    }
  });

  // Item #158 — generér A/B-variant av en eksisterende post. Lager
  // søsken-post med samme pillarId/dayOffset/format/platform, men hook
  // + script + caption regenerert med temperature=0.9. UI markerer
  // varianter med sortOrder = orig+0.5 så de havner like under originalen.
  app.post("/api/role-room/marketing-plan/posts/:postId/variant", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const postId = String(req.params.postId || "").trim();
    if (!postId) return res.status(400).json({ success: false, error: "postId er påkrevd." });

    // Last original-post + sjekk eierskap
    let original: any;
    try {
      const r = await pool.query(
        `SELECT pp.*, p.owner_user_id, p.status AS plan_status
           FROM role_room_marketing_plan_posts pp
           JOIN role_room_marketing_plans p ON p.id = pp.plan_id
          WHERE pp.id = $1`,
        [postId],
      );
      if (!r.rows[0]) return res.status(404).json({ success: false, error: "Fant ikke posten." });
      if (r.rows[0].owner_user_id !== session.userId) {
        return res.status(403).json({ success: false, error: "Du eier ikke planen." });
      }
      original = r.rows[0];
    } catch (error) {
      console.error("[marketing-plan-routes] variant: post-lookup failed", error);
      return res.status(500).json({ success: false, error: "Kunne ikke laste original-posten." });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ success: false, error: "ANTHROPIC_API_KEY mangler." });
    }

    try {
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const userMessage = `Lag en A/B-variant av følgende post på norsk. Behold samme intent og målgruppe, men varier hooken og caption helt — bruk annen vinkling, annet språk, annen åpning. Ikke endre plattform eller format.

Original:
Hook: ${original.hook}
Format: ${original.format}
Script: ${original.script ?? '(tomt)'}
Caption: ${original.caption_draft ?? '(tomt)'}
CTA: ${original.call_to_action ?? '(tomt)'}

Returner KUN JSON: { "hook": "...", "script": "...", "captionDraft": "...", "callToAction": "..." }.`;

      const response: any = await client.messages.create({
        model: process.env.ROLE_ROOM_REGENERATE_MODEL || "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        temperature: 0.9, // Høyere temp for variasjon
        messages: [{ role: "user", content: userMessage }],
      });
      const block = response.content?.[0];
      if (!block || block.type !== "text") {
        return res.status(502).json({ success: false, error: "Claude returnerte ingen tekst." });
      }
      const cleaned = block.text.trim().replace(/^```json\n?|\n?```$/g, "");
      let parsed: { hook?: string; script?: string; captionDraft?: string; callToAction?: string };
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        return res.status(502).json({ success: false, error: "Claude-respons kunne ikke parses." });
      }

      // Insert variant med original_post_id-pointer (lagres i goal_kpi.variantOf
      // som soft-relation; tabellen mangler dedikert kolonne, og JSONB
      // er mest pragmatisk uten en migrasjon).
      const goalKpi = {
        ...((original.goal_kpi && typeof original.goal_kpi === "object") ? original.goal_kpi : {}),
        variantOf: postId,
        variantOfHook: original.hook,
      };
      const inserted = await pool.query(
        `INSERT INTO role_room_marketing_plan_posts
           (plan_id, pillar_id, sort_order, day_offset, hook, format, script,
            caption_draft, call_to_action, primary_platform, cross_post_plan, goal_kpi, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb, 'proposed')
         RETURNING id, plan_id, pillar_id, sort_order, day_offset, hook, format, script,
                   caption_draft, call_to_action, primary_platform, cross_post_plan, goal_kpi,
                   status, feed_plan_post_id, scheduled_for, published_at, created_at, updated_at`,
        [
          original.plan_id,
          original.pillar_id,
          // sort_order: original + 0.5 så varianten lander rett under
          Number(original.sort_order) + 0.5,
          original.day_offset,
          parsed.hook ?? original.hook,
          original.format,
          parsed.script ?? null,
          parsed.captionDraft ?? null,
          parsed.callToAction ?? null,
          original.primary_platform,
          JSON.stringify(original.cross_post_plan ?? []),
          JSON.stringify(goalKpi),
        ],
      );
      return res.json({ success: true, variant: inserted.rows[0], variantOfPostId: postId });
    } catch (error) {
      console.error("[marketing-plan-routes] variant generation failed", error);
      return res.status(500).json({ success: false, error: "Variant-generering feilet." });
    }
  });

  // Item #176 — manuell KPI-snapshot for én post. Når connectorene
  // (Meta/TikTok/LinkedIn) er aktivert, kjører de daglig og fyller
  // tabellen automatisk. For prøveperioder + manuelt entry kan brukeren
  // skrive inn tall direkte via dette endepunktet.
  app.post("/api/role-room/marketing-plan/posts/:postId/kpi-snapshot", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const postId = String(req.params.postId || "").trim();
    if (!postId) return res.status(400).json({ success: false, error: "postId er påkrevd." });

    const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const platform = typeof body.platform === "string" ? body.platform : null;
    const metric = typeof body.metric === "string" ? body.metric : null;
    const value = typeof body.value === "number" && Number.isFinite(body.value) ? body.value : null;
    if (!platform || !metric || value === null) {
      return res.status(400).json({ success: false, error: "platform, metric og value er påkrevd." });
    }

    // Hent plan_id via post + sjekk eierskap
    let planId: string;
    try {
      const r = await pool.query<{ plan_id: string; owner_user_id: string }>(
        `SELECT pp.plan_id, p.owner_user_id
           FROM role_room_marketing_plan_posts pp
           JOIN role_room_marketing_plans p ON p.id = pp.plan_id
          WHERE pp.id = $1`,
        [postId],
      );
      if (!r.rows[0]) return res.status(404).json({ success: false, error: "Fant ikke posten." });
      if (r.rows[0].owner_user_id !== session.userId) {
        return res.status(403).json({ success: false, error: "Du eier ikke planen." });
      }
      planId = r.rows[0].plan_id;
    } catch (error) {
      console.error("[marketing-plan-routes] kpi-snapshot: lookup failed", error);
      return res.status(500).json({ success: false, error: "Kunne ikke laste posten." });
    }

    const snapshot = await persistKpiSnapshot(pool, {
      postId,
      planId,
      platform: platform as any,
      metric,
      value,
      source: "manual",
    });
    if (!snapshot) {
      return res.status(500).json({ success: false, error: "Kunne ikke lagre KPI-snapshot." });
    }
    return res.json({ success: true, snapshot });
  });

  // Items #177 + #178 + #179 — trigger sync av alle connectorer.
  // POST som starter Meta/TikTok/LinkedIn-fetch for alle aksepterte posts
  // i planen og persisterer resultatet. Brukeren får tilbake antall
  // snapshots skrevet per connector.
  app.post("/api/role-room/marketing-plan/:planId/kpi-sync", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const planId = String(req.params.planId || "").trim();
    if (!planId) return res.status(400).json({ success: false, error: "planId er påkrevd." });

    let projectId: string;
    try {
      const r = await pool.query<{ project_id: string; owner_user_id: string }>(
        `SELECT project_id, owner_user_id FROM role_room_marketing_plans WHERE id = $1`,
        [planId],
      );
      if (!r.rows[0]) return res.status(404).json({ success: false, error: "Fant ikke planen." });
      if (r.rows[0].owner_user_id !== session.userId) {
        return res.status(403).json({ success: false, error: "Du eier ikke planen." });
      }
      projectId = r.rows[0].project_id;
    } catch (error) {
      console.error("[marketing-plan-routes] kpi-sync: plan lookup failed", error);
      return res.status(500).json({ success: false, error: "Kunne ikke laste planen." });
    }

    // Hent posts som er aksepterte (feed_plan_post_id != null)
    let posts: Array<{ id: string; feedPlanPostId: string | null; primaryPlatform: string | null }>;
    try {
      const r = await pool.query<{ id: string; feed_plan_post_id: string | null; primary_platform: string | null }>(
        `SELECT id, feed_plan_post_id, primary_platform
           FROM role_room_marketing_plan_posts
          WHERE plan_id = $1 AND feed_plan_post_id IS NOT NULL`,
        [planId],
      );
      posts = r.rows.map((row) => ({
        id: row.id,
        feedPlanPostId: row.feed_plan_post_id,
        primaryPlatform: row.primary_platform,
      }));
    } catch (error) {
      console.error("[marketing-plan-routes] kpi-sync: posts lookup failed", error);
      return res.status(500).json({ success: false, error: "Kunne ikke laste posts." });
    }

    if (posts.length === 0) {
      return res.json({
        success: true,
        message: "Ingen aksepterte posts å hente KPI for ennå.",
        snapshotsWritten: 0,
        perConnectorCount: { meta_graph: 0, tiktok_business: 0, linkedin_pages: 0 },
      });
    }

    const startedAt = Date.now();
    const { snapshots, perConnectorCount } = await fetchAllPlatformKpis(pool, { projectId, planId, posts });
    const writeResult = await persistKpiSnapshotBatch(pool, snapshots);
    return res.json({
      success: true,
      snapshotsWritten: writeResult.written,
      snapshotsFailed: writeResult.failed,
      perConnectorCount,
      eligiblePosts: posts.length,
      durationMs: Date.now() - startedAt,
    });
  });

  // Item #180 — list/summarize alle KPI for en plan (driver UI-graf).
  app.get("/api/role-room/marketing-plan/:planId/kpi-summary", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const planId = String(req.params.planId || "").trim();
    if (!planId) return res.status(400).json({ success: false, error: "planId er påkrevd." });

    // Eierskap-sjekk via planen
    try {
      const r = await pool.query<{ owner_user_id: string }>(
        `SELECT owner_user_id FROM role_room_marketing_plans WHERE id = $1`,
        [planId],
      );
      if (!r.rows[0]) return res.status(404).json({ success: false, error: "Fant ikke planen." });
      if (r.rows[0].owner_user_id !== session.userId) {
        return res.status(403).json({ success: false, error: "Du eier ikke planen." });
      }
    } catch (error) {
      console.error("[marketing-plan-routes] kpi-summary: plan lookup failed", error);
      return res.status(500).json({ success: false, error: "Kunne ikke laste planen." });
    }

    const sinceDays = Number(req.query.sinceDays) > 0 ? Number(req.query.sinceDays) : 30;
    const [snapshots, summary] = await Promise.all([
      listKpiSnapshots(pool, planId, { sinceDays }),
      summarizeKpis(pool, planId, sinceDays),
    ]);

    // Hent post-metadata + pillar-mapping + plan-targets for aggregering
    let posts: Array<{ id: string; pillarId: string | null; pillarName: string | null; primaryPlatform: string | null; format: string; scheduledFor: string | null }> = [];
    let targets: Array<{ metric: string; target: number; per: "post" | "week" | "month" | "quarter" }> = [];
    try {
      const r = await pool.query<{ id: string; pillar_id: string | null; pillar_name: string | null; primary_platform: string | null; format: string; scheduled_for: Date | null }>(
        `SELECT pp.id, pp.pillar_id, piln.name AS pillar_name, pp.primary_platform, pp.format, pp.scheduled_for
           FROM role_room_marketing_plan_posts pp
           LEFT JOIN role_room_marketing_plan_pillars piln ON piln.id = pp.pillar_id
          WHERE pp.plan_id = $1`,
        [planId],
      );
      posts = r.rows.map((row) => ({
        id: row.id,
        pillarId: row.pillar_id,
        pillarName: row.pillar_name,
        primaryPlatform: row.primary_platform,
        format: row.format,
        scheduledFor: row.scheduled_for?.toISOString() ?? null,
      }));
      const planRow = await pool.query<{ strategy: { kpiTargets?: Array<{ metric: string; target: number; per: string }> } }>(
        `SELECT strategy FROM role_room_marketing_plans WHERE id = $1`,
        [planId],
      );
      const kpiTargetsRaw = planRow.rows[0]?.strategy?.kpiTargets ?? [];
      targets = kpiTargetsRaw
        .filter((t) => typeof t.metric === "string" && typeof t.target === "number")
        .map((t) => ({
          metric: t.metric,
          target: t.target,
          per: (t.per as "post" | "week" | "month" | "quarter") ?? "post",
        }));
    } catch (error) {
      console.error("[marketing-plan-routes] kpi-summary: aggregation lookup failed", error);
    }

    // Kjør aggregering + outlier-deteksjon + correction-suggestions
    const pillarAggregates = aggregateByPillar(snapshots, posts);
    const platformAggregates = aggregateByPlatform(snapshots, posts);
    const formatAggregates = aggregateByFormat(snapshots, posts);
    const timeAggregates = aggregateByTimeWindow(snapshots, posts);
    const outliers = detectOutliers(snapshots, posts);
    const corrections = suggestCorrections({
      pillarAggregates,
      platformAggregates,
      formatAggregates,
      targets,
      totalSnapshotCount: snapshots.length,
    });

    return res.json({
      success: true,
      planId,
      sinceDays,
      summary,
      snapshots,
      snapshotCount: snapshots.length,
      aggregates: {
        byPillar: pillarAggregates,
        byPlatform: platformAggregates,
        byFormat: formatAggregates,
        byTimeWindow: timeAggregates,
      },
      outliers,
      corrections,
      targets,
    });
  });

  // Item #152 — post-generation progress endpoint. Returner antall posts
  // som faktisk er persistert vs. forventet (horizonDays). Frontend
  // poller dette mens auto-genereringen kjører i bakgrunnen.
  app.get("/api/role-room/marketing-plan/:planId/posts/progress", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const planId = String(req.params.planId || "").trim();
    if (!planId) return res.status(400).json({ success: false, error: "planId er påkrevd." });
    try {
      const r = await pool.query<{ count: string; horizon: number; owner: string }>(
        `SELECT COUNT(pp.id) AS count, p.horizon_days AS horizon, p.owner_user_id AS owner
           FROM role_room_marketing_plans p
           LEFT JOIN role_room_marketing_plan_posts pp ON pp.plan_id = p.id
          WHERE p.id = $1
          GROUP BY p.horizon_days, p.owner_user_id`,
        [planId],
      );
      if (!r.rows[0]) return res.status(404).json({ success: false, error: "Fant ikke planen." });
      if (r.rows[0].owner !== session.userId) {
        return res.status(403).json({ success: false, error: "Du eier ikke planen." });
      }
      const generated = Number(r.rows[0].count);
      const expected = Number(r.rows[0].horizon);
      return res.json({
        success: true,
        generated,
        expected,
        complete: generated >= expected,
      });
    } catch (error) {
      console.error("[marketing-plan-routes] progress-check failed", error);
      return res.status(500).json({ success: false, error: "Kunne ikke sjekke progresjon." });
    }
  });

  // Item #157 — regenerér én post med valgfri prompt-hint
  // ("gjør den mer ironisk", "kort den ned til 50 ord", etc.).
  // Bruker Claude Haiku for hastighet (single-post er liten payload).
  app.post("/api/role-room/marketing-plan/posts/:postId/regenerate", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const postId = String(req.params.postId || "").trim();
    if (!postId) return res.status(400).json({ success: false, error: "postId er påkrevd." });
    const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const hint = typeof body.hint === "string" ? body.hint.trim().slice(0, 500) : "";

    // Eierskap-sjekk + last eksisterende post
    let post: { id: string; hook: string; format: string; script: string | null; caption_draft: string | null; call_to_action: string | null; primary_platform: string | null; pillar_id: string | null; plan_id: string };
    try {
      const r = await pool.query(
        `SELECT pp.*, p.owner_user_id, p.status AS plan_status
           FROM role_room_marketing_plan_posts pp
           JOIN role_room_marketing_plans p ON p.id = pp.plan_id
          WHERE pp.id = $1`,
        [postId],
      );
      if (!r.rows[0]) return res.status(404).json({ success: false, error: "Fant ikke posten." });
      if (r.rows[0].owner_user_id !== session.userId) {
        return res.status(403).json({ success: false, error: "Du eier ikke planen denne posten tilhører." });
      }
      if (r.rows[0].status === "scheduled" || r.rows[0].status === "published") {
        return res.status(409).json({ success: false, error: "Posten er allerede scheduled/published — regenerér kan ikke endre den." });
      }
      post = r.rows[0];
    } catch (error) {
      console.error("[marketing-plan-routes] post-lookup failed", error);
      return res.status(500).json({ success: false, error: "Kunne ikke laste posten." });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ success: false, error: "ANTHROPIC_API_KEY mangler — kan ikke regenerere." });
    }

    try {
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const userMessage = `Du skal regenerere én social-media-post på norsk. Originalen:

Hook: ${post.hook}
Format: ${post.format}
Script: ${post.script ?? '(tomt)'}
Caption: ${post.caption_draft ?? '(tomt)'}
CTA: ${post.call_to_action ?? '(tomt)'}
Plattform: ${post.primary_platform ?? 'instagram'}

${hint ? `Tone-justering bruker ønsker: ${hint}\n\n` : ''}Returner KUN JSON med samme felt-shape som original: { "hook": "...", "script": "...", "captionDraft": "...", "callToAction": "..." }. Behold format og plattform uendret. Skriv på norsk.`;

      const response: any = await client.messages.create({
        model: process.env.ROLE_ROOM_REGENERATE_MODEL || "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        temperature: 0.7,
        messages: [{ role: "user", content: userMessage }],
      });
      const block = response.content?.[0];
      if (!block || block.type !== "text") {
        return res.status(502).json({ success: false, error: "Claude returnerte ingen tekst." });
      }
      const cleaned = block.text.trim().replace(/^```json\n?|\n?```$/g, "");
      let parsed: { hook?: string; script?: string; captionDraft?: string; callToAction?: string };
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        return res.status(502).json({ success: false, error: "Claude-respons kunne ikke parses som JSON." });
      }

      // Oppdater posten med nye felt — behold de som ikke kom tilbake
      const r = await pool.query(
        `UPDATE role_room_marketing_plan_posts
            SET hook = COALESCE($2, hook),
                script = COALESCE($3, script),
                caption_draft = COALESCE($4, caption_draft),
                call_to_action = COALESCE($5, call_to_action),
                updated_at = now()
          WHERE id = $1
          RETURNING id, plan_id, pillar_id, sort_order, day_offset, hook, format, script,
                    caption_draft, call_to_action, primary_platform, cross_post_plan, goal_kpi,
                    status, feed_plan_post_id, scheduled_for, published_at, created_at, updated_at`,
        [
          postId,
          typeof parsed.hook === "string" ? parsed.hook.slice(0, 300) : null,
          typeof parsed.script === "string" ? parsed.script.slice(0, 4000) : null,
          typeof parsed.captionDraft === "string" ? parsed.captionDraft.slice(0, 4000) : null,
          typeof parsed.callToAction === "string" ? parsed.callToAction.slice(0, 500) : null,
        ],
      );
      return res.json({ success: true, post: r.rows[0], hint: hint || null });
    } catch (error) {
      console.error("[marketing-plan-routes] regenerate failed", error);
      return res.status(500).json({ success: false, error: "Regenerering feilet." });
    }
  });

  // Items #142 + #144 + #145 — pillar-redigering.
  // PATCH /pillars/:pillarId    → rename/edit/toggle is_active
  // POST  /:planId/pillars      → opprett egendefinert pillar
  // DELETE /pillars/:pillarId   → permanent slett (kun is_custom=true)
  // Alle skrivende endpoints krever owner = session.userId via plan-eierskap.
  const verifyPillarOwnership = async (pillarId: string, userId: string): Promise<boolean> => {
    try {
      const r = await pool.query<{ owner_user_id: string }>(
        `SELECT p.owner_user_id
           FROM role_room_marketing_plan_pillars piln
           JOIN role_room_marketing_plans p ON p.id = piln.plan_id
          WHERE piln.id = $1`,
        [pillarId],
      );
      return r.rows[0]?.owner_user_id === userId;
    } catch {
      return false;
    }
  };

  app.patch("/api/role-room/marketing-plan/pillars/:pillarId", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const pillarId = String(req.params.pillarId || "").trim();
    if (!pillarId) {
      return res.status(400).json({ success: false, error: "pillarId er påkrevd." });
    }
    if (!(await verifyPillarOwnership(pillarId, session.userId))) {
      return res.status(403).json({ success: false, error: "Du eier ikke denne pillaren." });
    }
    const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const updates: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    if (typeof body.name === "string") {
      updates.push(`name = $${i++}`);
      params.push(body.name.trim().slice(0, 200));
    }
    if (typeof body.description === "string") {
      updates.push(`description = $${i++}`);
      params.push(body.description.trim().slice(0, 2000));
    }
    if (typeof body.rationale === "string") {
      updates.push(`rationale = $${i++}`);
      params.push(body.rationale.trim().slice(0, 2000));
    }
    if (typeof body.isActive === "boolean") {
      updates.push(`is_active = $${i++}`);
      params.push(body.isActive);
    }
    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: "Ingen felter å oppdatere." });
    }
    params.push(pillarId);
    try {
      const r = await pool.query(
        `UPDATE role_room_marketing_plan_pillars
            SET ${updates.join(", ")}
          WHERE id = $${i}
          RETURNING id, plan_id, name, description, rationale, target_kpi, sort_order, is_active, is_custom`,
        params,
      );
      if (!r.rows[0]) return res.status(404).json({ success: false, error: "Fant ikke pillaren." });
      return res.json({ success: true, pillar: r.rows[0] });
    } catch (error) {
      console.error("[marketing-plan-routes] pillar-update failed", error);
      return res.status(500).json({ success: false, error: "Kunne ikke oppdatere pillaren." });
    }
  });

  app.post("/api/role-room/marketing-plan/:planId/pillars", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const planId = String(req.params.planId || "").trim();
    if (!planId) {
      return res.status(400).json({ success: false, error: "planId er påkrevd." });
    }
    try {
      const planRow = await pool.query<{ owner_user_id: string; status: string }>(
        `SELECT owner_user_id, status FROM role_room_marketing_plans WHERE id = $1`,
        [planId],
      );
      if (!planRow.rows[0]) return res.status(404).json({ success: false, error: "Fant ikke planen." });
      if (planRow.rows[0].owner_user_id !== session.userId) {
        return res.status(403).json({ success: false, error: "Du eier ikke denne planen." });
      }
      if (planRow.rows[0].status === "active") {
        return res.status(409).json({ success: false, error: "Planen er aktivert og låst. Arkivér først." });
      }
      const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
      const name = typeof body.name === "string" ? body.name.trim().slice(0, 200) : "";
      if (!name) return res.status(400).json({ success: false, error: "name er påkrevd." });
      const description = typeof body.description === "string" ? body.description.trim().slice(0, 2000) : null;
      const rationale = typeof body.rationale === "string" ? body.rationale.trim().slice(0, 2000) : null;
      // Plasser custom-pillaren sist i sort-rekkefølge.
      const maxOrderRow = await pool.query<{ max: number | null }>(
        `SELECT MAX(sort_order) AS max FROM role_room_marketing_plan_pillars WHERE plan_id = $1`,
        [planId],
      );
      const sortOrder = Number(maxOrderRow.rows[0]?.max ?? 0) + 1;
      const r = await pool.query(
        `INSERT INTO role_room_marketing_plan_pillars
           (plan_id, name, description, rationale, sort_order, is_active, is_custom)
         VALUES ($1, $2, $3, $4, $5, TRUE, TRUE)
         RETURNING id, plan_id, name, description, rationale, target_kpi, sort_order, is_active, is_custom`,
        [planId, name, description, rationale, sortOrder],
      );
      return res.json({ success: true, pillar: r.rows[0] });
    } catch (error) {
      console.error("[marketing-plan-routes] custom-pillar insert failed", error);
      return res.status(500).json({ success: false, error: "Kunne ikke opprette pillaren." });
    }
  });

  app.delete("/api/role-room/marketing-plan/pillars/:pillarId", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const pillarId = String(req.params.pillarId || "").trim();
    if (!pillarId) return res.status(400).json({ success: false, error: "pillarId er påkrevd." });
    try {
      // Kun is_custom kan slettes — AI-genererte pillars må toggles is_active
      // for å skille bevart-data fra slett-data.
      const r = await pool.query(
        `DELETE FROM role_room_marketing_plan_pillars
            USING role_room_marketing_plans p
           WHERE role_room_marketing_plan_pillars.plan_id = p.id
             AND role_room_marketing_plan_pillars.id = $1
             AND p.owner_user_id = $2
             AND role_room_marketing_plan_pillars.is_custom = TRUE
         RETURNING role_room_marketing_plan_pillars.id`,
        [pillarId, session.userId],
      );
      if (!r.rows[0]) {
        return res.status(404).json({
          success: false,
          error: "Fant ikke pillaren — eller den er AI-generert (bruk toggle is_active i stedet for slett).",
        });
      }
      return res.json({ success: true, deletedId: r.rows[0].id });
    } catch (error) {
      console.error("[marketing-plan-routes] pillar-delete failed", error);
      return res.status(500).json({ success: false, error: "Kunne ikke slette pillaren." });
    }
  });

  app.get("/api/role-room/marketing-plan/shared/:token", (req, res) => {
    if (!PLAN_SHARE_SECRET || PLAN_SHARE_SECRET.length < 32) {
      return res.status(503).json({ success: false, error: "ROLE_ROOM_SHARE_SECRET er ikke konfigurert." });
    }
    const token = String(req.params.token || "");
    const dot = token.indexOf(".");
    if (dot < 1) {
      return res.status(400).json({ success: false, error: "Ugyldig token-format." });
    }
    const payloadB64 = token.slice(0, dot);
    const sigB64 = token.slice(dot + 1);
    const expectedSig = crypto.createHmac("sha256", PLAN_SHARE_SECRET).update(payloadB64).digest();
    let providedSig: Buffer;
    try {
      providedSig = b64urlDecode(sigB64);
    } catch {
      return res.status(400).json({ success: false, error: "Token-signaturen er korrupt." });
    }
    if (providedSig.length !== expectedSig.length || !crypto.timingSafeEqual(providedSig, expectedSig)) {
      return res.status(403).json({ success: false, error: "Token-signaturen er ugyldig." });
    }
    let envelope: { kind?: string; exp?: number; plan?: unknown };
    try {
      const isGzipped = payloadB64.startsWith("z");
      const rawB64 = isGzipped ? payloadB64.slice(1) : payloadB64;
      const decoded = b64urlDecode(rawB64);
      const json = isGzipped ? zlib.gunzipSync(decoded).toString("utf8") : decoded.toString("utf8");
      envelope = JSON.parse(json);
    } catch {
      return res.status(400).json({ success: false, error: "Token-payloadet kunne ikke parses." });
    }
    if (envelope.kind !== "marketing_plan") {
      return res.status(400).json({ success: false, error: "Token er ikke for en marketing plan." });
    }
    if (typeof envelope.exp !== "number" || envelope.exp < Date.now()) {
      return res.status(410).json({ success: false, error: "Share-link er utløpt." });
    }
    return res.json({
      success: true,
      plan: envelope.plan,
      expiresAt: new Date(envelope.exp).toISOString(),
    });
  });
}
