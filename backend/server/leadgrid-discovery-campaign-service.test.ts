import { readFileSync } from "node:fs";

import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";

import {
  attachLaunchedRun,
  createDiscoveryCampaign,
  discoveryCampaignJobHandler,
  discoveryCampaignAttemptKey,
  discoveryCampaignCanDetachRun,
  discoveryCampaignProfileVersionsMatch,
  discoveryCampaignRunAction,
  DiscoveryCampaignError,
  failDiscoveryCampaignWorkerExhausted,
  mapDiscoveryCampaignCreateError,
  scheduleNextCampaignTick,
} from "./leadgrid-discovery-campaign-service.js";

const serviceSource = readFileSync(
  new URL("./leadgrid-discovery-campaign-service.ts", import.meta.url),
  "utf8",
);
const handlerSource = readFileSync(
  new URL("./job-handlers.ts", import.meta.url),
  "utf8",
);

describe("Leadgrid Discovery campaign orchestration", () => {
  it("uses one stable child-run key for every retry of the same item attempt", () => {
    const first = discoveryCampaignAttemptKey("campaign-a", 2, 3);
    expect(first).toBe("campaign:campaign-a:position:2:attempt:3");
    expect(discoveryCampaignAttemptKey("campaign-a", 2, 3)).toBe(first);
    expect(discoveryCampaignAttemptKey("campaign-a", 2, 4)).not.toBe(first);
  });

  it("waits for active work, advances successful/partial work and stops failures", () => {
    for (const status of [
      "planning",
      "awaiting_confirmation",
      "queued",
      "searching",
      "researching",
      "cancel_requested",
    ] as const) {
      expect(discoveryCampaignRunAction(status)).toBe("wait");
    }
    for (const status of ["review_ready", "completed", "partial"] as const) {
      expect(discoveryCampaignRunAction(status)).toBe("advance");
    }
    expect(discoveryCampaignRunAction("failed")).toBe("fail");
    expect(discoveryCampaignRunAction("cancelled")).toBe("cancel");
    expect(discoveryCampaignCanDetachRun("cancel_requested")).toBe(false);
    expect(discoveryCampaignCanDetachRun("researching")).toBe(false);
    expect(discoveryCampaignCanDetachRun("cancelled")).toBe(true);
    expect(discoveryCampaignCanDetachRun("failed")).toBe(true);
  });

  it("maps concurrent different-key active-campaign races to a domain conflict", () => {
    expect(
      mapDiscoveryCampaignCreateError({
        code: "23505",
        constraint: "ux_leadgrid_discovery_campaign_runs_one_active",
      }),
    ).toMatchObject({
      code: "campaign_already_active",
      status: 409,
    });
    const original = { code: "08006" };
    expect(mapDiscoveryCampaignCreateError(original)).toBe(original);
  });

  it("rejects a campaign when a confirmed profile version changed before POST", () => {
    const expected = [{ profileId: "profile-oslo", expectedVersion: 4 }];
    expect(
      discoveryCampaignProfileVersionsMatch(
        [{ id: "profile-oslo", version: 5 }],
        expected,
      ),
    ).toBe(false);
    expect(
      discoveryCampaignProfileVersionsMatch(
        [{ id: "profile-oslo", version: 4 }],
        expected,
      ),
    ).toBe(true);
    expect(new DiscoveryCampaignError("profile_version_conflict")).toMatchObject({
      code: "profile_version_conflict",
      status: 409,
      retryable: false,
    });
  });

  it("blocks a new campaign while an older parent still links a nonterminal child", async () => {
    const statements: string[] = [];
    const client = {
      query: vi.fn(async (sql: string) => {
        statements.push(sql);
        if (
          sql.includes("FROM leadgrid_discovery_campaign_runs c") &&
          sql.includes("idempotency_key = $3")
        ) {
          return { rows: [], rowCount: 0 };
        }
        if (
          sql.includes("JOIN leadgrid_discovery_runs r") &&
          sql.includes("r.status IN")
        ) {
          return { rows: [{ id: "older-campaign" }], rowCount: 1 };
        }
        return { rows: [], rowCount: 1 };
      }),
      release: vi.fn(),
    };
    const pool = {
      connect: vi.fn().mockResolvedValue(client),
    } as unknown as Pool;

    await expect(
      createDiscoveryCampaign(pool, {
        project: {
          id: "dentum-project",
          organizationId: "11111111-1111-4111-8111-111111111111",
          name: "Dentum",
          description: null,
          industry: null,
          status: "active",
          createdBy: "user-a",
          memberRole: "owner",
        },
        userId: "user-a",
        name: "Ny kampanje",
        profiles: [
          {
            profileId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            expectedVersion: 1,
          },
        ],
        idempotencyKey: "new-campaign-key",
      }),
    ).rejects.toMatchObject({ code: "campaign_already_active", status: 409 });
    expect(
      statements.some((sql) => sql.includes("FROM leadgrid_discovery_profiles")),
    ).toBe(false);
    expect(statements).toContain("ROLLBACK");
  });

  it("rejects a late child attach after cancel wins the create/attach race", async () => {
    const statements: string[] = [];
    const client = {
      query: vi.fn(async (sql: string) => {
        statements.push(sql);
        if (sql.includes("FROM leadgrid_discovery_campaign_runs c")) {
          return {
            rows: [
              {
                id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                organization_id: "11111111-1111-4111-8111-111111111111",
                project_id: "dentum-project",
                name: "Dentum",
                status: "cancelled",
                profile_ids: ["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"],
                current_position: 0,
                active_run_id: null,
                idempotency_key: "campaign-key",
                request_hash: "a".repeat(64),
                requested_by: "user-a",
                cancellation_requested_at: null,
                started_at: null,
                finished_at: null,
                error_code: null,
                error_message: null,
                poll_generation: 0,
                version: 2,
                created_at: "2026-09-06T12:00:00.000Z",
                updated_at: "2026-09-06T12:00:01.000Z",
              },
            ],
          };
        }
        return { rows: [], rowCount: 1 };
      }),
      release: vi.fn(),
    };
    const pool = {
      connect: vi.fn().mockResolvedValue(client),
    } as unknown as Pool;
    const attached = await attachLaunchedRun(pool, {
      project: {
        id: "dentum-project",
        organizationId: "11111111-1111-4111-8111-111111111111",
        name: "Dentum",
        description: null,
        industry: null,
        status: "active",
        createdBy: "user-a",
        memberRole: "owner",
      },
      campaignId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      position: 0,
      attemptNo: 1,
      runId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      runStatus: "queued",
    });

    expect(attached).toBe(false);
    expect(
      statements.some((sql) =>
        sql.includes("INSERT INTO leadgrid_discovery_campaign_attempts"),
      ),
    ).toBe(false);
    expect(statements.some((sql) => sql.includes("SET active_run_id"))).toBe(
      false,
    );
    expect(serviceSource).toContain("if (!attached)");
    expect(serviceSource).toContain("await cancelDiscoveryRun(pool");
  });

  it("runs progression on the durable server worker, independent of client polling", () => {
    expect(handlerSource).toContain("LEADGRID_DISCOVERY_CAMPAIGN_JOB_TYPE");
    expect(handlerSource).toContain("discoveryCampaignJobHandler");
    expect(serviceSource).toContain("poll_generation = poll_generation + 1");
    expect(serviceSource).toContain("expectedGeneration: input.tickGeneration");
    expect(serviceSource).toContain("`generation:${input.pollGeneration}`");
    expect(serviceSource).not.toContain("nextTickDedupeSuffix:");
    expect(serviceSource).not.toContain("after:${job.id}");
    expect(serviceSource).toContain("INSERT INTO background_jobs");
    expect(serviceSource).toContain("String(input.delayMs ?? 0)");
    expect(serviceSource).toContain(
      "const runKey = discoveryCampaignAttemptKey(",
    );
  });

  it("scopes every campaign read and command by organization, project and campaign", () => {
    expect(serviceSource).toMatch(
      /FROM leadgrid_discovery_campaign_runs c[\s\S]*?c\.organization_id = \$1::uuid[\s\S]*?c\.project_id = \$2[\s\S]*?c\.id = \$3::uuid/,
    );
    expect(serviceSource).toMatch(
      /FROM leadgrid_discovery_campaign_commands[\s\S]*?organization_id = \$1::uuid[\s\S]*?project_id = \$2[\s\S]*?campaign_id = \$3::uuid/,
    );
    expect(serviceSource).toContain(
      '["completed", "partial", "failed", "cancelled"]',
    );
    expect(serviceSource).toContain("trustedProfileSnapshot: {");
    expect(serviceSource).toContain(
      "Later profile patch/pause/archive applies to the next campaign.",
    );
    expect(serviceSource).toContain(
      "const authorizedProject = await revalidateDiscoveryCampaignActor(",
    );
    expect(serviceSource).toContain("actor_access_revoked");
    const reconcileStart = serviceSource.indexOf(
      "export async function reconcileDiscoveryCampaign(",
    );
    expect(
      serviceSource.indexOf(
        "const authorizedProject = await revalidateDiscoveryCampaignActor(",
        reconcileStart,
      ),
    ).toBeLessThan(
      serviceSource.indexOf(
        "const runKey = discoveryCampaignAttemptKey(",
        reconcileStart,
      ),
    );
  });

  it("commits a durable seed tick before synchronous progression can crash", async () => {
    const statements: string[] = [];
    const campaignId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const profileId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const client = {
      query: vi.fn(async (sql: string) => {
        statements.push(sql.trim());
        if (
          sql.includes("FROM leadgrid_discovery_campaign_runs c") &&
          sql.includes("idempotency_key = $3")
        ) {
          return { rows: [] };
        }
        if (
          sql.includes("FROM leadgrid_discovery_campaign_runs") &&
          sql.includes("status IN")
        ) {
          return { rows: [] };
        }
        if (sql.includes("FROM leadgrid_discovery_profiles")) {
          return {
            rows: [
              {
                id: profileId,
                version: 3,
                status: "active",
                name: "Oslo kjerne",
                brief: {
                  ideal_customer: "Uavhengig tannklinikk",
                  migrated_from: "legacy",
                },
                target_customer_types: ["tannklinikk"],
                city_filters: ["Oslo"],
                geography_lat: null,
                geography_lng: null,
                geography_radius_km: 25,
                company_size_min: 5,
                company_size_max: null,
                max_candidates_per_run: 60,
                enrichment_count: 30,
              },
            ],
          };
        }
        if (sql.includes("INSERT INTO leadgrid_discovery_campaign_runs")) {
          return { rows: [{ id: campaignId, poll_generation: 0 }] };
        }
        return { rows: [], rowCount: 1 };
      }),
      release: vi.fn(),
    };
    const pool = {
      connect: vi.fn().mockResolvedValue(client),
      query: vi
        .fn()
        .mockRejectedValue(new Error("simulated process crash after commit")),
    } as unknown as Pool;

    await expect(
      createDiscoveryCampaign(pool, {
        project: {
          id: "dentum-project",
          organizationId: "11111111-1111-4111-8111-111111111111",
          name: "Dentum",
          description: null,
          industry: null,
          status: "active",
          createdBy: "initiator-a",
          memberRole: "owner",
        },
        userId: "initiator-a",
        name: "Dentum – klinikkpilot Oslo og omegn",
        profiles: [{ profileId, expectedVersion: 3 }],
        idempotencyKey: "campaign-start-stable-key",
      }),
    ).rejects.toThrow("simulated process crash after commit");

    const seedIndex = statements.findIndex((sql) =>
      sql.includes("INSERT INTO background_jobs"),
    );
    const commitIndex = statements.indexOf("COMMIT");
    expect(seedIndex).toBeGreaterThan(-1);
    expect(commitIndex).toBeGreaterThan(seedIndex);
    expect(statements[seedIndex]).toContain("ON CONFLICT (dedupe_key)");
    expect(client.release).toHaveBeenCalledOnce();
  });

  it("lets only one concurrent worker CAS create the next poll generation", async () => {
    let generation = 4;
    let jobInserts = 0;
    const client = {
      query: vi.fn(async (sql: string, values?: unknown[]) => {
        if (sql.includes("SET poll_generation = poll_generation + 1")) {
          if (values?.[3] !== generation) return { rows: [], rowCount: 0 };
          generation += 1;
          return { rows: [{ poll_generation: generation }], rowCount: 1 };
        }
        if (sql.includes("INSERT INTO background_jobs")) {
          jobInserts += 1;
        }
        return { rows: [], rowCount: 1 };
      }),
      release: vi.fn(),
    };
    const pool = {
      connect: vi.fn().mockResolvedValue(client),
    } as unknown as Pool;
    const input = {
      project: {
        id: "dentum-project",
        organizationId: "11111111-1111-4111-8111-111111111111",
        name: "Dentum",
        description: null,
        industry: null,
        status: "active",
        createdBy: "user-a",
        memberRole: "owner",
      },
      campaignId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      expectedGeneration: 4,
      userId: "user-a",
      delayMs: 10_000,
    } as const;

    const results = await Promise.all([
      scheduleNextCampaignTick(pool, input),
      scheduleNextCampaignTick(pool, input),
    ]);

    expect(results.sort()).toEqual([false, true]);
    expect(generation).toBe(5);
    expect(jobInserts).toBe(1);
  });

  it("drops a stale worker tick before planning or scheduling side effects", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          organization_id: "11111111-1111-4111-8111-111111111111",
          project_id: "dentum-project",
          requested_by: "user-a",
          cancellation_requested_by: null,
          poll_generation: 9,
        },
      ],
    });
    const connect = vi.fn();
    const result = await discoveryCampaignJobHandler(
      { query, connect } as unknown as Pool,
      {
        campaignId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        pollGeneration: 8,
      },
      { id: "job-a" } as never,
      { signal: new AbortController().signal } as never,
    );

    expect(result).toMatchObject({ stale: true, poll_generation: 9 });
    expect(query).toHaveBeenCalledOnce();
    expect(connect).not.toHaveBeenCalled();
  });

  it("keeps the active invariant and seeds durable cleanup after the final worker attempt", async () => {
    const statements: string[] = [];
    const valuesSeen: unknown[][] = [];
    const campaign = {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      organization_id: "11111111-1111-4111-8111-111111111111",
      project_id: "dentum-project",
      name: "Dentum",
      status: "running",
      profile_ids: ["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"],
      current_position: 0,
      active_run_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      idempotency_key: "key",
      request_hash: "a".repeat(64),
      requested_by: "user-a",
      cancellation_requested_at: null,
      cancellation_requested_by: null,
      started_at: null,
      finished_at: null,
      error_code: null,
      error_message: null,
      poll_generation: 7,
      version: 1,
      created_at: "2026-09-07T00:00:00Z",
      updated_at: "2026-09-07T00:00:00Z",
    };
    const client = {
      query: vi.fn(async (sql: string, values: unknown[] = []) => {
        statements.push(sql.trim());
        valuesSeen.push(values);
        if (sql.includes("FROM leadgrid_discovery_campaign_runs c")) {
          return { rows: [campaign], rowCount: 1 };
        }
        if (
          sql.includes("SET status = 'cancel_requested', finished_at = NULL") &&
          sql.includes("RETURNING poll_generation")
        ) {
          return { rows: [{ poll_generation: 7 }], rowCount: 1 };
        }
        if (
          sql.includes("SET poll_generation = poll_generation + 1") &&
          sql.includes("RETURNING poll_generation")
        ) {
          return { rows: [{ poll_generation: 8 }], rowCount: 1 };
        }
        return { rows: [], rowCount: 1 };
      }),
      release: vi.fn(),
    };
    const pool = {
      connect: vi.fn().mockResolvedValue(client),
    } as unknown as Pool;

    await expect(
      failDiscoveryCampaignWorkerExhausted(pool, {
        organizationId: campaign.organization_id,
        projectId: campaign.project_id,
        campaignId: campaign.id,
        pollGeneration: 7,
      }),
    ).resolves.toBe(true);

    expect(
      statements.some((sql) => sql.includes("UPDATE leadgrid_discovery_runs")),
    ).toBe(true);
    expect(
      statements.some((sql) =>
        sql.includes("AND poll_generation = $4") &&
        sql.includes("campaign_worker_exhausted"),
      ),
    ).toBe(false);
    expect(valuesSeen.some((values) => values.includes("campaign_worker_exhausted"))).toBe(true);
    expect(
      statements.some((sql) =>
        sql.includes("SET status = 'cancel_requested', finished_at = NULL")),
    ).toBe(true);
    expect(
      statements.some((sql) =>
        sql.includes("SET poll_generation = poll_generation + 1")),
    ).toBe(true);
    expect(
      statements.some((sql) => sql.includes("INSERT INTO background_jobs")),
    ).toBe(true);
    expect(serviceSource).toContain(
      'campaign.error_code === "campaign_worker_exhausted"',
    );
    expect(serviceSource).toContain('workerCleanup ? "failed" : "cancelled"');

    campaign.poll_generation = 8;
    const statementCount = statements.length;
    await expect(
      failDiscoveryCampaignWorkerExhausted(pool, {
        organizationId: campaign.organization_id,
        projectId: campaign.project_id,
        campaignId: campaign.id,
        pollGeneration: 7,
      }),
    ).resolves.toBe(false);
    expect(
      statements.slice(statementCount).some((sql) =>
        sql.includes("UPDATE leadgrid_discovery_runs"),
      ),
    ).toBe(false);
    expect(serviceSource).toContain("integer(job.attempts) >= integer(job.max_attempts, 1)");
    expect(serviceSource).toContain("!context.signal.aborted");
    expect(serviceSource).toContain('throw new DiscoveryCampaignError("child_run_still_stopping")');
    expect(serviceSource).toContain("SET status = 'queued', active_run_id = NULL");
  });

  it("never lets an advance or retry caller replace the original launch actor", () => {
    const reconcileStart = serviceSource.indexOf(
      "export async function reconcileDiscoveryCampaign(",
    );
    const reconcileEnd = serviceSource.indexOf(
      "async function recordCommand(",
      reconcileStart,
    );
    const reconcileSource = serviceSource.slice(reconcileStart, reconcileEnd);
    expect(reconcileSource).toContain(
      "const campaignUserId = authoritative.requestedBy",
    );
    expect(reconcileSource).toContain("userId: campaignUserId");
    expect(reconcileSource).not.toContain(
      "userId: commandUserId,\n        brief:",
    );
    expect(reconcileSource.indexOf("if (!campaignUserId)")).toBeLessThan(
      reconcileSource.indexOf("createDiscoveryRun(pool"),
    );
  });
});
