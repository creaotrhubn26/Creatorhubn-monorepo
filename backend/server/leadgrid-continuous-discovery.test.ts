import { readFileSync } from "node:fs";
import type { Pool } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

const service = vi.hoisted(() => ({
  createDiscoveryRun: vi.fn(),
  isLeadgridDiscoveryEnabled: vi.fn(),
}));

vi.mock("./leadgrid-discovery-service.js", () => ({ ...service }));

import {
  __test,
  isValidDiscoverySchedule,
  nextDiscoveryScheduledAt,
  nextScheduledAt,
  runDiscoveryForProject,
} from "./leadgrid-continuous-discovery.js";

const organizationId = "11111111-1111-4111-8111-111111111111";
const profileId = "22222222-2222-4222-8222-222222222222";
const runId = "33333333-3333-4333-8333-333333333333";

function sourceRow(overrides: Record<string, unknown> = {}) {
  return {
    project_id: "project-a",
    organization_id: organizationId,
    project_name: "Project A",
    project_description: null,
    project_industry: "B2B",
    project_status: "active",
    project_created_by: "user-a",
    actor_user_id: "user-a",
    profile_id: profileId,
    profile_version: 7,
    target_customer_types: ["regnskapsbyrå"],
    city_filters: ["Oslo"],
    geography_lat: null,
    geography_lng: null,
    geography_radius_km: 25,
    profile_brief: {
      exclusion_terms: ["konkurs"],
      minimum_fit_score: 55,
    },
    max_candidates_per_run: 20,
    enrichment_count: 10,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  service.isLeadgridDiscoveryEnabled.mockReturnValue(true);
  service.createDiscoveryRun.mockResolvedValue({
    run: { id: runId, status: "queued" },
    replayed: false,
  });
});

describe("continuous Discovery v2 adapter", () => {
  it("does not query or enqueue while the production rollout gate is closed", async () => {
    service.isLeadgridDiscoveryEnabled.mockReturnValue(false);
    const query = vi.fn();

    const result = await runDiscoveryForProject(
      { query } as unknown as Pool,
      {
        projectId: "project-a",
        organizationId,
        ownerUserId: "user-a",
      },
    );

    expect(result).toEqual({
      ok: false,
      reason: "discovery_not_enabled",
    });
    expect(query).not.toHaveBeenCalled();
    expect(service.createDiscoveryRun).not.toHaveBeenCalled();
  });

  it("computes DST-safe next occurrences in the profile timezone", () => {
    expect(
      nextScheduledAt(
        "0 6 * * *",
        "Europe/Oslo",
        new Date("2026-03-28T06:01:00.000Z"),
      ).toISOString(),
    ).toBe("2026-03-29T04:00:00.000Z");
    expect(
      nextScheduledAt(
        "0 6 * * *",
        "Europe/Oslo",
        new Date("2026-10-24T04:01:00.000Z"),
      ).toISOString(),
    ).toBe("2026-10-25T05:00:00.000Z");
    expect(
      nextDiscoveryScheduledAt(
        "0 6 * * *",
        "Europe/Oslo",
        new Date("2026-03-28T06:01:00.000Z"),
      ).toISOString(),
    ).toBe("2026-03-29T04:00:00.000Z");
    expect(isValidDiscoverySchedule("0 6 * * *", "Europe/Oslo")).toBe(true);
    expect(isValidDiscoverySchedule("0 */6 * * *", "Europe/Oslo")).toBe(false);
    expect(isValidDiscoverySchedule("not-a-cron", "Europe/Oslo")).toBe(false);
    expect(isValidDiscoverySchedule("0 6 * * *", "Mars/Olympus_Mons")).toBe(
      false,
    );
  });

  it("queues a v2 run with profile OCC and keeps the compatibility result", async () => {
    const query = vi.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes("FROM leadgrid_discovery_runs")) return { rows: [] };
      expect(sql).toContain("p.organization_id = $1::uuid");
      expect(sql).toContain("p.id = $2");
      expect(params).toEqual([organizationId, "project-a", profileId]);
      return { rows: [sourceRow()] };
    });
    const result = await runDiscoveryForProject({ query } as unknown as Pool, {
      projectId: "project-a",
      organizationId,
      ownerUserId: "user-a",
      profileId,
      idempotencyKey: "workflow-run-0001",
      triggerKind: "workflow",
    });

    expect(result).toMatchObject({
      ok: true,
      batchId: runId,
      runId,
      foundCount: 0,
      pinnedLeads: 0,
      status: "queued",
      queued: true,
    });
    expect(service.createDiscoveryRun).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        profileId,
        expectedProfileVersion: 7,
        idempotencyKey: "workflow-run-0001",
        startImmediately: true,
        triggerKind: "workflow",
        brief: expect.objectContaining({
          industry_queries: ["regnskapsbyrå"],
          city: "Oslo",
          target_count: 20,
          enrichment_count: 10,
        }),
      }),
    );
  });

  it("falls back to the tenant-scoped legacy config when no default profile exists", async () => {
    const query = vi.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes("FROM leadgrid_discovery_runs")) return { rows: [] };
      if (sql.includes("FROM leadgrid_projects p")) {
        return {
          rows: [
            sourceRow({
              profile_id: null,
              profile_version: null,
              target_customer_types: null,
              city_filters: null,
              profile_brief: null,
              max_candidates_per_run: null,
              enrichment_count: null,
            }),
          ],
        };
      }
      expect(sql).toContain("project_id = $1");
      expect(sql).toContain("organization_id = $2::uuid");
      expect(params).toEqual(["project-a", organizationId]);
      return {
        rows: [
          {
            industry_query: "tannlege",
            industry_queries: ["tannlege", "fysioterapeut"],
            city_filter: ["Bergen"],
            geography_lat: null,
            geography_lng: null,
            geography_radius_km: 10,
            count_per_run: 12,
            created_by_user_id: "user-a",
          },
        ],
      };
    });
    const result = await runDiscoveryForProject({ query } as unknown as Pool, {
      projectId: "project-a",
      organizationId,
      ownerUserId: "user-a",
      idempotencyKey: "legacy-fallback-0001",
    });

    expect(result.ok).toBe(true);
    expect(service.createDiscoveryRun).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        profileId: null,
        expectedProfileVersion: null,
        brief: expect.objectContaining({
          industry_queries: ["tannlege", "fysioterapeut"],
          city: "Bergen",
          target_count: 12,
        }),
      }),
    );
  });

  it("replays a durable scheduled run before reading a changed profile", async () => {
    const query = vi.fn(async (sql: string, params?: unknown[]) => {
      expect(sql).toContain("FROM leadgrid_discovery_runs");
      expect(sql).toContain("organization_id = $1::uuid");
      expect(sql).toContain("project_id = $2");
      expect(params).toEqual([
        organizationId,
        "project-a",
        "scheduled-slot-0001",
      ]);
      return {
        rows: [
          {
            id: runId,
            status: "queued",
            brief_snapshot: {
              industry_queries: ["regnskapsbyrå"],
              exclusion_terms: [],
              city: "Oslo",
              target_count: 20,
              enrichment_count: 10,
              include_service_area_businesses: false,
              minimum_fit_score: 50,
            },
          },
        ],
      };
    });
    const result = await runDiscoveryForProject({ query } as unknown as Pool, {
      projectId: "project-a",
      organizationId,
      ownerUserId: "user-a",
      profileId,
      idempotencyKey: "scheduled-slot-0001",
      triggerKind: "scheduled",
    });

    expect(result).toMatchObject({
      ok: true,
      runId,
      batchId: runId,
      replayed: true,
    });
    expect(query).toHaveBeenCalledTimes(1);
    expect(service.createDiscoveryRun).not.toHaveBeenCalled();
  });

  it("uses a cross-instance advisory lock and deterministic slot idempotency", async () => {
    const due = {
      source_kind: "profile" as const,
      source_id: profileId,
      profile_id: profileId,
      profile_version: 7,
      project_id: "project-a",
      organization_id: organizationId,
      actor_user_id: "user-a",
      schedule_cron: "0 6 * * *",
      schedule_timezone: "Europe/Oslo",
      next_run_at: "2026-08-30T04:00:00.000Z",
    };
    const firstClient = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("pg_try_advisory_lock")) {
          return { rows: [{ acquired: true }] };
        }
        if (sql.includes("SELECT 1")) return { rows: [{ "?column?": 1 }] };
        return { rows: [{ pg_advisory_unlock: true }] };
      }),
      release: vi.fn(),
    };
    const secondClient = {
      query: vi.fn(async () => ({ rows: [{ acquired: false }] })),
      release: vi.fn(),
    };
    let connection = 0;
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("FROM leadgrid_discovery_runs")) return { rows: [] };
      if (sql.includes("FROM leadgrid_projects p")) {
        return { rows: [sourceRow()] };
      }
      return { rows: [] };
    });
    const pool = {
      query,
      connect: vi.fn(async () =>
        connection++ === 0 ? firstClient : secondClient,
      ),
    } as unknown as Pool;
    const now = new Date("2026-08-30T05:00:00.000Z");
    const [first, second] = await Promise.all([
      __test.processDueSource(pool, due, now),
      __test.processDueSource(pool, due, now),
    ]);

    expect([first, second].filter(Boolean)).toHaveLength(1);
    expect(service.createDiscoveryRun).toHaveBeenCalledTimes(1);
    expect(service.createDiscoveryRun).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        idempotencyKey: __test.scheduledIdempotencyKey(
          profileId,
          new Date(due.next_run_at),
        ),
        scheduledFor: new Date(due.next_run_at),
        triggerKind: "scheduled",
      }),
    );
    const advance = query.mock.calls.find(([sql]) =>
      sql.includes("UPDATE leadgrid_discovery_profiles"),
    );
    expect(advance?.[0]).toContain("organization_id = $1::uuid");
    expect(advance?.[0]).toContain("project_id = $2");
    expect(advance?.[0]).toContain("id = $3::uuid");
  });

  it("pauses an invalid stored schedule with a scoped compare-and-set", async () => {
    const due = {
      source_kind: "profile" as const,
      source_id: profileId,
      profile_id: profileId,
      profile_version: 7,
      project_id: "project-a",
      organization_id: organizationId,
      actor_user_id: "user-a",
      schedule_cron: "not-a-cron",
      schedule_timezone: "Europe/Oslo",
      next_run_at: "2026-08-30T04:00:00.000Z",
    };
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("pg_try_advisory_lock")) {
          return { rows: [{ acquired: true }] };
        }
        if (sql.includes("SELECT 1")) return { rows: [{ "?column?": 1 }] };
        return { rows: [{ pg_advisory_unlock: true }] };
      }),
      release: vi.fn(),
    };
    const query = vi.fn(async () => ({ rows: [] }));
    const pool = {
      query,
      connect: vi.fn(async () => client),
    } as unknown as Pool;

    await expect(
      __test.processDueSource(pool, due, new Date("2026-08-30T05:00:00.000Z")),
    ).resolves.toEqual({
      ok: false,
      reason: "discovery_schedule_invalid",
    });

    expect(service.createDiscoveryRun).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain("UPDATE leadgrid_discovery_profiles");
    expect(sql).toContain("auto_discover_enabled = FALSE");
    expect(sql).toContain("status = 'paused'");
    expect(sql).toContain("organization_id = $1::uuid");
    expect(sql).toContain("project_id = $2");
    expect(sql).toContain("id = $3::uuid");
    expect(sql).toContain("next_run_at IS NOT DISTINCT FROM $4::timestamptz");
    expect(params).toEqual([
      organizationId,
      "project-a",
      profileId,
      "2026-08-30T04:00:00.000Z",
    ]);
  });

  it("pauses a permanently invalid source instead of retrying every poll", async () => {
    const due = {
      source_kind: "profile" as const,
      source_id: profileId,
      profile_id: profileId,
      profile_version: 7,
      project_id: "project-a",
      organization_id: organizationId,
      actor_user_id: "user-a",
      schedule_cron: "0 6 * * *",
      schedule_timezone: "Europe/Oslo",
      next_run_at: "2026-08-30T04:00:00.000Z",
    };
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("pg_try_advisory_lock")) {
          return { rows: [{ acquired: true }] };
        }
        if (sql.includes("SELECT 1")) return { rows: [{ "?column?": 1 }] };
        return { rows: [{ pg_advisory_unlock: true }] };
      }),
      release: vi.fn(),
    };
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("FROM leadgrid_discovery_runs")) return { rows: [] };
      if (sql.includes("FROM leadgrid_projects p")) {
        return {
          rows: [
            sourceRow({
              target_customer_types: [],
              profile_brief: {},
            }),
          ],
        };
      }
      return { rows: [] };
    });
    const pool = {
      query,
      connect: vi.fn(async () => client),
    } as unknown as Pool;

    await expect(
      __test.processDueSource(pool, due, new Date("2026-08-30T05:00:00.000Z")),
    ).resolves.toEqual({ ok: false, reason: "discovery_brief_invalid" });

    expect(service.createDiscoveryRun).not.toHaveBeenCalled();
    const pause = query.mock.calls.find(([sql]) =>
      sql.includes("UPDATE leadgrid_discovery_profiles"),
    );
    expect(pause?.[0]).toContain("auto_discover_enabled = FALSE");
    expect(pause?.[0]).toContain("status = 'paused'");
    expect(pause?.[1]).toEqual([
      organizationId,
      "project-a",
      profileId,
      "2026-08-30T04:00:00.000Z",
    ]);
  });

  it("contains no legacy persistence path and reports workflow queue identity", () => {
    const adapter = readFileSync(
      new URL("./leadgrid-continuous-discovery.ts", import.meta.url),
      "utf8",
    );
    expect(adapter).not.toMatch(/\bcrm_customers\b/);
    expect(adapter).not.toMatch(/leadgrid_url_research_(?:batches|items)/);
    expect(adapter).toContain("createDiscoveryRun");

    const workflow = readFileSync(
      new URL("./leadgrid-workflow-engine.ts", import.meta.url),
      "utf8",
    );
    expect(workflow).toContain('message: "discovery_queued"');
    expect(workflow).toContain("run_id: result.runId");
  });
});
