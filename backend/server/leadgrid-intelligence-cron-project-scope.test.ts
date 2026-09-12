import type { Express, Request, RequestHandler, Response } from "express";
import type { Pool } from "pg";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const engine = vi.hoisted(() => ({ compute: vi.fn(async () => ({ leadScore: 80 })) }));
const webhook = vi.hoisted(() => ({ emit: vi.fn(async () => undefined) }));
const notifications = vi.hoisted(() => ({
  dispatch: vi.fn(async () => ({ notificationId: "notification-1" })),
  deepLink: vi.fn((projectId: string, leadId: string) =>
    `https://leadgrid.no/admin-room?projectId=${projectId}&lead=${leadId}`),
}));

vi.mock("./leadgrid-intelligence-engine.js", () => ({
  computeIntelligenceForLead: engine.compute,
}));
vi.mock("./webhook-emitter.js", () => ({ emitWebhook: webhook.emit }));
vi.mock("./lead-map-notification-service.js", () => ({
  dispatchNotification: notifications.dispatch,
  leadgridLeadDeepLink: notifications.deepLink,
}));

import { registerLeadgridIntelligenceCron } from "./leadgrid-intelligence-cron.js";
import { registerLeadMapFollowupCronRoutes } from "./lead-map-followup-cron.js";

const leadId = "11111111-1111-4111-8111-111111111111";
const organizationId = "22222222-2222-4222-8222-222222222222";
const projectId = "dentum-oslo";

type RegisteredRoute = { path: string; handler: RequestHandler };

function makeApp(routes: RegisteredRoute[]): Express {
  return {
    post(path: string, ...handlers: RequestHandler[]) {
      routes.push({ path, handler: handlers.at(-1)! });
    },
  } as unknown as Express;
}

async function invoke(route: RegisteredRoute, token: string) {
  const req = {
    headers: { "x-cron-trigger-token": token },
  } as unknown as Request;
  let statusCode = 200;
  let responseBody: unknown;
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(value: unknown) {
      responseBody = value;
      return this;
    },
  } as unknown as Response;
  await route.handler(req, res, vi.fn());
  return { statusCode, responseBody };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.LEADGRID_INTELLIGENCE_CRON_TOKEN = "intelligence-secret";
  process.env.MIGRATE_TRIGGER_TOKEN = "followup-secret";
});

afterEach(() => {
  delete process.env.LEADGRID_INTELLIGENCE_CRON_TOKEN;
  delete process.env.MIGRATE_TRIGGER_TOKEN;
});

describe("Leadgrid background intelligence project scope", () => {
  it("selects exact project tuples and fences daily recomputation", async () => {
    const routes: RegisteredRoute[] = [];
    const queries: Array<{ sql: string; params?: readonly unknown[] }> = [];
    const query = vi.fn(async (sql: string, params?: readonly unknown[]) => {
      queries.push({ sql, params });
      if (sql.includes("ORDER BY customer.scored_at")) {
        return {
          rows: [{
            id: leadId,
            organization_id: organizationId,
            project_id: projectId,
          }],
          rowCount: 1,
        };
      }
      if (sql.includes("c.next_follow_up_at < NOW() -")) {
        return {
          rows: [{
            id: leadId,
            organization_id: organizationId,
            project_id: projectId,
            assigned_user_id: "seller-1",
            name: "Dentum klinikk",
            next_follow_up_at: "2026-09-05T00:00:00.000Z",
          }],
          rowCount: 1,
        };
      }
      if (sql.includes("c.next_follow_up_at >= NOW()")) {
        return {
          rows: [{
            id: leadId,
            organization_id: organizationId,
            project_id: projectId,
            assigned_user_id: "seller-1",
            name: "Dentum klinikk",
            next_follow_up_at: "2026-09-07T00:00:00.000Z",
          }],
          rowCount: 1,
        };
      }
      if (sql.includes("UPDATE lead_recommendations recommendation")) {
        return { rows: [], rowCount: 2 };
      }
      throw new Error(`unexpected SQL: ${sql}`);
    });
    const pool = { query } as unknown as Pool;
    registerLeadgridIntelligenceCron({ app: makeApp(routes), pool });

    const result = await invoke(routes[0]!, "intelligence-secret");

    expect(result).toMatchObject({
      statusCode: 200,
      responseBody: {
        ok: true,
        processed: 1,
        followup_due: 1,
        followup_overdue: 1,
        expired_recommendations: 2,
      },
    });
    const candidateSql = queries.find(({ sql }) =>
      sql.includes("ORDER BY customer.scored_at"),
    )?.sql ?? "";
    expect(candidateSql).toContain("project.id = customer.project_id");
    expect(candidateSql).toContain("project.organization_id = customer.organization_id");
    expect(candidateSql).toContain("customer.project_id IS NOT NULL");
    expect(candidateSql).not.toContain("organization_members");
    expect(engine.compute).toHaveBeenCalledWith(
      pool,
      leadId,
      expect.objectContaining({
        expectedScope: { organizationId, projectId },
      }),
    );
    expect(webhook.emit).toHaveBeenCalledWith(
      pool,
      "followup.overdue",
      expect.objectContaining({
        organization_id: organizationId,
        project_id: projectId,
      }),
      organizationId,
      projectId,
    );
    expect(webhook.emit).toHaveBeenCalledWith(
      pool,
      "followup.due",
      expect.objectContaining({ project_id: projectId }),
      organizationId,
      projectId,
    );
    const expirySql = queries.find(({ sql }) =>
      sql.includes("UPDATE lead_recommendations recommendation"),
    )?.sql ?? "";
    expect(expirySql).toContain("recommendation.project_id = customer.project_id");
  });

  it("uses one DB session for lock/unlock and throttles by exact project", async () => {
    const routes: RegisteredRoute[] = [];
    const lockQuery = vi.fn(async (sql: string) => {
      if (sql.includes("pg_try_advisory_lock")) {
        return { rows: [{ locked: true }], rowCount: 1 };
      }
      if (sql.includes("pg_advisory_unlock")) {
        return { rows: [{ pg_advisory_unlock: true }], rowCount: 1 };
      }
      throw new Error(`unexpected lock SQL: ${sql}`);
    });
    const release = vi.fn();
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("FROM crm_customers c")) {
        return {
          rows: [{
            lead_id: leadId,
            lead_name: "Dentum klinikk",
            address: "Karl Johans gate 1",
            assigned_user_id: "seller-1",
            next_follow_up_at: new Date(Date.now() - 86_400_000).toISOString(),
            organization_id: organizationId,
            project_id: projectId,
          }],
          rowCount: 1,
        };
      }
      throw new Error(`unexpected SQL: ${sql}`);
    });
    const pool = {
      query,
      connect: vi.fn(async () => ({ query: lockQuery, release })),
    } as unknown as Pool;
    registerLeadMapFollowupCronRoutes({ app: makeApp(routes), pool });

    const result = await invoke(routes[0]!, "followup-secret");

    expect(result).toMatchObject({
      statusCode: 200,
      responseBody: { ok: true, notifications_sent: 1 },
    });
    const candidateSql = String(query.mock.calls[0]?.[0]);
    expect(candidateSql).toContain("project.id = c.project_id");
    expect(candidateSql).toContain("project.organization_id = c.organization_id");
    expect(candidateSql).toContain("ne.organization_id = c.organization_id");
    expect(candidateSql).toContain("ne.project_id = c.project_id");
    expect(notifications.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        pool,
        organizationId,
        projectId,
        leadId,
        deepLink: expect.stringContaining(`projectId=${projectId}`),
        meta: expect.objectContaining({ project_id: projectId }),
      }),
    );
    expect(lockQuery.mock.calls.map(([sql]) => String(sql))).toEqual([
      expect.stringContaining("pg_try_advisory_lock"),
      expect.stringContaining("pg_advisory_unlock"),
    ]);
    expect(release).toHaveBeenCalledOnce();
  });

  it("releases the lock connection without querying work when another run owns it", async () => {
    const routes: RegisteredRoute[] = [];
    const lockQuery = vi.fn(async () => ({
      rows: [{ locked: false }],
      rowCount: 1,
    }));
    const release = vi.fn();
    const query = vi.fn();
    const pool = {
      query,
      connect: vi.fn(async () => ({ query: lockQuery, release })),
    } as unknown as Pool;
    registerLeadMapFollowupCronRoutes({ app: makeApp(routes), pool });

    const result = await invoke(routes[0]!, "followup-secret");

    expect(result).toMatchObject({
      statusCode: 200,
      responseBody: { ok: true, skipped: true, reason: "another_run_in_progress" },
    });
    expect(query).not.toHaveBeenCalled();
    expect(lockQuery).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledOnce();
  });
});
