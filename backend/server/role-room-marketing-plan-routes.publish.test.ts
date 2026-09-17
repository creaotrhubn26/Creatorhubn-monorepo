/**
 * Markedssjef-modus fase 1b: direkte LinkedIn-publisering av en plan-post.
 * Kontrakten Leadgrid-siden bygger på:
 *   - org-medlem autorisert via broen kan publisere (ikke bare plan-eier)
 *   - fremmed → 403, allerede publisert → 409, tom tekst → 400, feil kanal → 400
 *   - publisher-feil → 502 med norsk tekst + publish_error lagret
 *   - suksess → status/published_at/external_post_id/permalink skrevet
 *   - publish-options gir tilkoblingstilstand + bedriftssider
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import request from "supertest";
import type { Pool } from "pg";

const mocks = vi.hoisted(() => ({
  dispatchPublish: vi.fn(),
  listManagedCompaniesForUser: vi.fn(),
}));

vi.mock("./social-publisher.js", () => ({ dispatchPublish: mocks.dispatchPublish }));
vi.mock("./social-publisher-linkedin.js", () => ({
  listManagedCompaniesForUser: mocks.listManagedCompaniesForUser,
}));
vi.mock("./leadgrid-marketing-bridge.js", () => ({
  getLeadgridMarketingAccess: (req: Request) => (req as Request & { __lg?: unknown }).__lg ?? null,
  leadgridMarketingAuthorizedFor: (req: Request, projectId: string) =>
    (req as Request & { __lg?: { projectKey: string } }).__lg?.projectKey === projectId,
  isLeadgridMarketingProjectKey: (key: string) => key.startsWith("lg-"),
}));
vi.mock("./ai-rate-limiter.js", () => ({
  aiRateLimit: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));
// Tunge moduler som ikke brukes av publiseringsrutene.
vi.mock("./role-room-marketing-plan.js", () => ({
  activateMarketingPlan: vi.fn(),
  checkMarketingPlanReadiness: vi.fn(),
  fetchActiveMarketingPlan: vi.fn(),
  generateMarketingPlan: vi.fn(),
  persistGeneratedMarketingPlan: vi.fn(),
}));
vi.mock("./role-room-marketing-plan-posts.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("./role-room-marketing-plan-posts.js")>();
  return {
    ...original,
    generatePlanPosts: vi.fn(),
    persistPlanPosts: vi.fn(),
    acceptPlanPostIntoFeedPlanner: vi.fn(),
  };
});
vi.mock("./role-room-creator-discovery.js", () => ({}));
vi.mock("./role-room-agent-entitlements.js", () => ({ checkAgentEntitlement: vi.fn() }));
vi.mock("./ai-usage-tracker.js", () => ({ logAIUsage: vi.fn() }));
vi.mock("./role-room-instagram-oauth.js", () => ({ listInstagramConnections: vi.fn() }));
vi.mock("./role-room-feed-plan.js", () => ({ loadFeedPlan: vi.fn(), saveFeedPlan: vi.fn() }));
vi.mock("./role-room-marketing-scorecard.js", () => ({ buildChannelScorecard: vi.fn() }));
vi.mock("./role-room-kpi-connectors.js", () => ({ fetchAllPlatformKpis: vi.fn() }));
vi.mock("./role-room-kpi-tracking.js", () => ({
  persistKpiSnapshot: vi.fn(),
  persistKpiSnapshotBatch: vi.fn(),
  listKpiSnapshots: vi.fn(),
  summarizeKpis: vi.fn(),
}));
vi.mock("./role-room-kpi-analytics.js", () => ({
  aggregateByPillar: vi.fn(),
  aggregateByPlatform: vi.fn(),
  aggregateByFormat: vi.fn(),
  aggregateByTimeWindow: vi.fn(),
  detectOutliers: vi.fn(),
  suggestCorrections: vi.fn(),
}));

import { setupRoleRoomMarketingPlanRoutes } from "./role-room-marketing-plan-routes";

process.env.ROLE_ROOM_AGENT_RATE_LIMIT = "off";

const PLAN_PROJECT = "lg-leadgrid-abc";

function postRow(over: Record<string, unknown> = {}) {
  return {
    id: "post-1",
    plan_id: "plan-1",
    pillar_id: null,
    sort_order: 0,
    day_offset: 0,
    hook: "Tre uker venting er normalen",
    format: "linkedin_post",
    script: null,
    caption_draft: "Slik får vi det ned til fire dager.",
    call_to_action: "Book en prat",
    primary_platform: "linkedin",
    cross_post_plan: [],
    goal_kpi: null,
    status: "proposed",
    feed_plan_post_id: null,
    scheduled_for: null,
    published_at: null,
    external_post_id: null,
    external_permalink: null,
    publish_error: null,
    created_at: new Date("2026-09-17T00:00:00Z"),
    updated_at: new Date("2026-09-17T00:00:00Z"),
    owner_user_id: "owner-1",
    plan_project_id: PLAN_PROJECT,
    ...over,
  };
}

function makeApp(opts: { row?: Record<string, unknown> | null; connection?: Record<string, unknown> | null } = {}) {
  const updates: Array<{ sql: string; args: unknown[] }> = [];
  const pool = {
    query: vi.fn(async (sql: string, args: unknown[] = []) => {
      if (sql.includes("FROM role_room_marketing_plan_posts p") && sql.includes("JOIN role_room_marketing_plans mp")) {
        return { rows: opts.row === null ? [] : [opts.row ?? postRow()] };
      }
      if (sql.includes("FROM role_room_linkedin_connections")) {
        return { rows: opts.connection ? [opts.connection] : [] };
      }
      if (sql.startsWith("UPDATE role_room_marketing_plan_posts")) {
        updates.push({ sql, args });
        if (sql.includes("RETURNING *")) {
          return {
            rows: [
              postRow({
                status: "published",
                published_at: new Date(),
                external_post_id: args[2],
                external_permalink: args[3],
                caption_draft: args[4],
                published_by_user_id: args[1],
                published_platform: "linkedin",
                published_author_urn: args[5],
              }),
            ],
          };
        }
        return { rows: [] };
      }
      return { rows: [] };
    }),
  } as unknown as Pool;

  const app: Express = express();
  app.use(express.json());
  // Simulerer bro-middlewaren: header x-lg-project → autorisert lg-tilgang.
  app.use((req, _res, next) => {
    const lg = req.header("x-lg-project");
    if (lg) {
      (req as Request & { __lg?: unknown }).__lg = {
        projectKey: lg,
        session: { userId: req.header("x-user") ?? "markedssjef-1", email: "m@example.no", name: "M", role: "markedssjef" },
        role: "markedssjef",
      };
    }
    next();
  });
  setupRoleRoomMarketingPlanRoutes({
    app,
    pool,
    requireAdminSession: (req, res) => {
      const userId = req.header("x-user");
      if (!userId) {
        res.status(401).json({ success: false, error: "Innlogging kreves" });
        return null;
      }
      return { userId, email: `${userId}@example.no`, name: userId, role: "admin", loginAt: "" };
    },
    isCompatAdminFeatureEnabled: () => true,
  });
  return { app, updates };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.dispatchPublish.mockResolvedValue({
    ok: true,
    status: "published",
    externalPostId: "7470001",
    permalink: "https://www.linkedin.com/feed/update/urn:li:ugcPost:7470001/",
  });
  mocks.listManagedCompaniesForUser.mockResolvedValue({ companies: [], scopeMissing: true });
});

describe("POST /api/role-room/marketing-plan/posts/:postId/publish", () => {
  it("lets an org member authorised by the bridge publish, and persists the LinkedIn state", async () => {
    const { app, updates } = makeApp();
    const res = await request(app)
      .post("/api/role-room/marketing-plan/posts/post-1/publish")
      .set("x-lg-project", PLAN_PROJECT)
      .send({ projectId: PLAN_PROJECT, platform: "linkedin", caption: "  Egen tekst fra markedssjefen  " });
    expect(res.status).toBe(200);
    expect(res.body.permalink).toContain("urn:li:ugcPost:7470001");
    expect(res.body.post).toMatchObject({ status: "published", externalPostId: "7470001" });

    expect(mocks.dispatchPublish).toHaveBeenCalledWith("linkedin", {
      connectionId: "markedssjef-1",
      userId: "markedssjef-1",
      projectId: PLAN_PROJECT,
      mediaKind: "text",
      caption: "Egen tekst fra markedssjefen",
      extras: {},
    });
    expect(updates).toHaveLength(1);
    expect(updates[0].sql).toContain("status = 'published'");
    expect(updates[0].sql).toContain("published_author_urn = $6");
    expect(updates[0].args).toEqual([
      "post-1",
      "markedssjef-1",
      "7470001",
      "https://www.linkedin.com/feed/update/urn:li:ugcPost:7470001/",
      "Egen tekst fra markedssjefen",
      null, // ingen tilkoblingsrad i denne testen → ukjent avsender
    ]);
  });

  it("records the person URN from the connection when publishing as a profile", async () => {
    const { app, updates } = makeApp({ connection: { linkedin_member_id: "m1", connection_state: "connected", scopes: [] } });
    const res = await request(app)
      .post("/api/role-room/marketing-plan/posts/post-1/publish")
      .set("x-user", "owner-1")
      .send({ projectId: PLAN_PROJECT });
    expect(res.status).toBe(200);
    expect(updates[0].args[5]).toBe("urn:li:person:m1");
  });

  it("uses caption draft + CTA when no caption is sent, and passes the organisation URN through", async () => {
    const { app } = makeApp();
    const res = await request(app)
      .post("/api/role-room/marketing-plan/posts/post-1/publish")
      .set("x-user", "owner-1")
      .send({ projectId: PLAN_PROJECT, organizationUrn: "urn:li:organization:42" });
    expect(res.status).toBe(200);
    const [, input] = mocks.dispatchPublish.mock.calls[0];
    expect(input.caption).toBe("Slik får vi det ned til fire dager.\n\nBook en prat");
    expect(input.extras).toEqual({ linkedInOrganizationUrn: "urn:li:organization:42" });
    expect(res.body.post.publishedAuthorUrn).toBe("urn:li:organization:42");
  });

  it("refuses a stranger (403) and never calls LinkedIn", async () => {
    const { app } = makeApp();
    const res = await request(app)
      .post("/api/role-room/marketing-plan/posts/post-1/publish")
      .set("x-user", "someone-else")
      .send({ projectId: PLAN_PROJECT });
    expect(res.status).toBe(403);
    expect(mocks.dispatchPublish).not.toHaveBeenCalled();
  });

  it("refuses a project mismatch (403) even for the owner", async () => {
    const { app } = makeApp();
    const res = await request(app)
      .post("/api/role-room/marketing-plan/posts/post-1/publish")
      .set("x-user", "owner-1")
      .send({ projectId: "lg-other" });
    expect(res.status).toBe(403);
  });

  it("answers 409 with the permalink when the post is already published", async () => {
    const { app } = makeApp({
      row: postRow({ status: "published", external_post_id: "1", external_permalink: "https://li/1" }),
    });
    const res = await request(app)
      .post("/api/role-room/marketing-plan/posts/post-1/publish")
      .set("x-user", "owner-1")
      .send({ projectId: PLAN_PROJECT });
    expect(res.status).toBe(409);
    expect(res.body.permalink).toBe("https://li/1");
    expect(mocks.dispatchPublish).not.toHaveBeenCalled();
  });

  it("answers 400 for a post planned for another channel, and for empty text", async () => {
    const other = makeApp({ row: postRow({ primary_platform: "instagram" }) });
    const r1 = await request(other.app)
      .post("/api/role-room/marketing-plan/posts/post-1/publish")
      .set("x-user", "owner-1")
      .send({ projectId: PLAN_PROJECT });
    expect(r1.status).toBe(400);
    expect(r1.body.error).toContain("instagram");

    const empty = makeApp({ row: postRow({ caption_draft: null, call_to_action: null, hook: "   " }) });
    const r2 = await request(empty.app)
      .post("/api/role-room/marketing-plan/posts/post-1/publish")
      .set("x-user", "owner-1")
      .send({ projectId: PLAN_PROJECT });
    expect(r2.status).toBe(400);
    expect(mocks.dispatchPublish).not.toHaveBeenCalled();
  });

  it("answers 502 with a Norwegian reason and stores publish_error when LinkedIn refuses", async () => {
    mocks.dispatchPublish.mockResolvedValue({
      ok: false,
      status: "failed",
      reason: "connection_not_found",
      error: "Ingen aktiv LinkedIn-tilkobling",
    });
    const { app, updates } = makeApp();
    const res = await request(app)
      .post("/api/role-room/marketing-plan/posts/post-1/publish")
      .set("x-user", "owner-1")
      .send({ projectId: PLAN_PROJECT });
    expect(res.status).toBe(502);
    expect(res.body.reason).toBe("connection_not_found");
    expect(res.body.error).toContain("ikke koblet til");
    expect(updates).toHaveLength(1);
    expect(updates[0].sql).toContain("publish_error = $2");
    expect(String(updates[0].args[1])).toContain("connection_not_found");
  });

  it("answers 401 without a session", async () => {
    const { app } = makeApp();
    const res = await request(app)
      .post("/api/role-room/marketing-plan/posts/post-1/publish")
      .send({ projectId: PLAN_PROJECT });
    expect(res.status).toBe(401);
  });
});

describe("GET /api/role-room/marketing-plan/linkedin/publish-options", () => {
  it("reports disconnected without a connection row", async () => {
    const { app } = makeApp({ connection: null });
    const res = await request(app)
      .get(`/api/role-room/marketing-plan/linkedin/publish-options?projectId=${PLAN_PROJECT}`)
      .set("x-lg-project", PLAN_PROJECT);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      connected: false,
      state: "disconnected",
      companies: [],
      orgScopesGranted: false,
      defaultSender: "__profile__",
    });
    expect(mocks.listManagedCompaniesForUser).not.toHaveBeenCalled();
  });

  it("reports expired when the token has run out", async () => {
    const { app } = makeApp({
      connection: {
        linkedin_name: "Kari",
        linkedin_member_id: "m1",
        connection_state: "connected",
        expiry_date: new Date(Date.now() - 60_000),
      },
    });
    const res = await request(app)
      .get(`/api/role-room/marketing-plan/linkedin/publish-options?projectId=${PLAN_PROJECT}`)
      .set("x-user", "owner-1");
    expect(res.body).toMatchObject({ connected: false, state: "expired", memberName: "Kari" });
  });

  it("lists company pages and makes the first one the default sender when the org scopes were granted", async () => {
    mocks.listManagedCompaniesForUser.mockResolvedValue({
      scopeMissing: false,
      companies: [{ urn: "urn:li:organization:42", id: "42", name: "Nordvest Bygg AS", vanityName: null, logoUrl: null, role: "ADMINISTRATOR" }],
    });
    const { app } = makeApp({
      connection: {
        linkedin_name: "Kari",
        linkedin_member_id: "m1",
        connection_state: "connected",
        expiry_date: new Date(Date.now() + 3_600_000),
        scopes: ["openid", "w_member_social", "w_organization_social", "r_organization_social", "r_organization_admin"],
      },
    });
    const res = await request(app)
      .get(`/api/role-room/marketing-plan/linkedin/publish-options?projectId=${PLAN_PROJECT}`)
      .set("x-user", "owner-1");
    expect(res.body).toMatchObject({
      connected: true,
      state: "connected",
      scopeMissing: false,
      orgScopesGranted: true,
      companies: [{ urn: "urn:li:organization:42", name: "Nordvest Bygg AS" }],
      defaultSender: "urn:li:organization:42",
      captionMax: 3000,
    });
  });

  it("flags scopeMissing (reconnect needed) for an active connection made before the org scopes existed", async () => {
    const { app } = makeApp({
      connection: {
        linkedin_name: "Kari",
        linkedin_member_id: "m1",
        connection_state: "connected",
        expiry_date: new Date(Date.now() + 3_600_000),
        scopes: ["openid", "profile", "email", "w_member_social"],
      },
    });
    const res = await request(app)
      .get(`/api/role-room/marketing-plan/linkedin/publish-options?projectId=${PLAN_PROJECT}`)
      .set("x-user", "owner-1");
    expect(res.body).toMatchObject({
      connected: true,
      orgScopesGranted: false,
      scopeMissing: true,
      companies: [],
      defaultSender: "__profile__",
    });
    // Ingen unødvendig LinkedIn-kall når vi allerede vet at scopet mangler.
    expect(mocks.listManagedCompaniesForUser).not.toHaveBeenCalled();
  });
});
