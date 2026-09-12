import type { Pool } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

const access = vi.hoisted(() => ({
  loadAccessibleLeadgridProject: vi.fn(),
}));
const permission = vi.hoisted(() => ({
  resolveEffectivePermissions: vi.fn(),
}));
const discovery = vi.hoisted(() => ({
  cancelDiscoveryRun: vi.fn(),
  cancelDiscoveryRunFromTrustedWorkflow: vi.fn(),
  createDiscoveryRun: vi.fn(),
}));

vi.mock("./leadgrid-project-access.js", () => ({ ...access }));
vi.mock("./lead-map-permission-routes.js", () => ({ ...permission }));
vi.mock("./leadgrid-discovery-service.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./leadgrid-discovery-service.js")>();
  return {
    ...actual,
    cancelDiscoveryRun: discovery.cancelDiscoveryRun,
    cancelDiscoveryRunFromTrustedWorkflow:
      discovery.cancelDiscoveryRunFromTrustedWorkflow,
    createDiscoveryRun: discovery.createDiscoveryRun,
  };
});

import {
  loadDiscoveryCampaignJobContext,
  reconcileDiscoveryCampaign,
  revalidateDiscoveryCampaignActor,
} from "./leadgrid-discovery-campaign-service.js";

const expectedProject = {
  id: "dentum-project",
  organizationId: "11111111-1111-4111-8111-111111111111",
  name: "Dentum",
  description: null,
  industry: null,
  status: "active",
  createdBy: "user-a",
  memberRole: "owner",
};

const campaignId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const childRunId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const profileId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function makeCampaignRow(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: campaignId,
    organization_id: expectedProject.organizationId,
    project_id: expectedProject.id,
    name: "Dentum",
    status: "running",
    profile_ids: [profileId],
    current_position: 0,
    active_run_id: childRunId,
    idempotency_key: "campaign-key",
    request_hash: "a".repeat(64),
    requested_by: null,
    cancellation_requested_at: null,
    cancellation_requested_by: null,
    started_at: "2026-09-06T12:00:00.000Z",
    finished_at: null,
    error_code: null,
    error_message: null,
    poll_generation: 0,
    version: 2,
    created_at: "2026-09-06T12:00:00.000Z",
    updated_at: "2026-09-06T12:00:01.000Z",
    ...overrides,
  };
}

function makeCampaignPool(
  campaign: Record<string, unknown>,
  childStatus: string,
): { pool: Pool; statements: string[] } {
  const statements: string[] = [];
  const item = {
    campaign_id: campaignId,
    position: 0,
    profile_id: profileId,
    profile_version: 1,
    profile_name: "Oslo kjerne",
    territory_code: "oslo",
    brief_snapshot: { industry_queries: ["tannklinikk"], city: "Oslo" },
    status: "running",
    attempt_count: 1,
    current_run_id: childRunId,
    started_at: null,
    finished_at: null,
    error_code: null,
    error_message: null,
    run_status: childStatus,
    candidate_count: 12,
    researched_count: 4,
    review_ready_count: 3,
    run_error_code: null,
    run_error_message: null,
  };
  const client = {
    query: vi.fn(async (sql: string) => {
      statements.push(sql.trim());
      if (sql.includes("FROM leadgrid_discovery_campaign_runs c")) {
        return { rows: [campaign] };
      }
      if (sql.includes("FROM leadgrid_discovery_runs")) {
        return {
          rows: [
            { status: childStatus, error_code: null, error_message: null },
          ],
        };
      }
      if (sql.includes("SET poll_generation = poll_generation + 1")) {
        const current = Number(campaign.poll_generation ?? 0);
        campaign.poll_generation = current + 1;
        return {
          rows: [{ poll_generation: campaign.poll_generation }],
          rowCount: 1,
        };
      }
      if (sql.includes("INSERT INTO background_jobs")) {
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    }),
    release: vi.fn(),
  };
  const query = vi.fn(async (sql: string) => {
    statements.push(sql.trim());
    if (sql.includes("SELECT id::text, organization_id::text, project_id")) {
      return { rows: [campaign] };
    }
    if (sql.includes("INSERT INTO background_jobs")) {
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes("FROM leadgrid_discovery_campaign_runs c")) {
      return { rows: [campaign] };
    }
    if (sql.includes("FROM leadgrid_discovery_campaign_items i")) {
      return { rows: [item] };
    }
    if (sql.includes("FROM leadgrid_discovery_campaign_attempts a")) {
      return { rows: [] };
    }
    throw new Error(`Unexpected query: ${sql}`);
  });
  return {
    pool: {
      connect: vi.fn().mockResolvedValue(client),
      query,
    } as unknown as Pool,
    statements,
  };
}

describe("Discovery campaign autonomous membership gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    permission.resolveEffectivePermissions.mockResolvedValue({
      role: "owner",
      permissions: new Set(["lead_research.run"]),
    });
  });

  it("loads authoritative actor and tenant from the campaign row and rejects spoofed legacy payload", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          organization_id: expectedProject.organizationId,
          project_id: expectedProject.id,
          requested_by: "user-a",
          cancellation_requested_by: null,
        },
      ],
    });
    const pool = { query } as unknown as Pool;

    await expect(
      loadDiscoveryCampaignJobContext(
        pool,
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        { campaignId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
      ),
    ).resolves.toEqual({
      campaignId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      organizationId: expectedProject.organizationId,
      projectId: expectedProject.id,
      requestedBy: "user-a",
      cancellationRequestedBy: null,
      pollGeneration: 0,
    });
    await expect(
      loadDiscoveryCampaignJobContext(
        pool,
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        {
          campaignId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          organizationId: "22222222-2222-4222-8222-222222222222",
          projectId: "other-project",
          userId: "attacker",
        },
      ),
    ).rejects.toMatchObject({
      code: "invalid_request",
      field: "job_payload",
    });
    expect(String(query.mock.calls[0]?.[0])).toContain(
      "FROM leadgrid_discovery_campaign_runs",
    );
  });

  it("returns a null actor after user deletion so the worker can fail closed", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          organization_id: expectedProject.organizationId,
          project_id: expectedProject.id,
          requested_by: null,
          cancellation_requested_by: "cancel-user",
        },
      ],
    });
    const pool = { query } as unknown as Pool;
    await expect(
      loadDiscoveryCampaignJobContext(
        pool,
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        { campaignId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
      ),
    ).resolves.toMatchObject({
      requestedBy: null,
      cancellationRequestedBy: "cancel-user",
      organizationId: expectedProject.organizationId,
      projectId: expectedProject.id,
    });
  });

  it("keeps observing an active child after initiator deletion and does not detach it", async () => {
    const campaign = makeCampaignRow({ requested_by: null });
    const { pool, statements } = makeCampaignPool(campaign, "researching");

    const result = await reconcileDiscoveryCampaign(pool, {
      project: expectedProject,
      campaignId,
      commandUserId: null,
      tickGeneration: 0,
    });

    expect(result.status).toBe("running");
    expect(result.active_run_id).toBe(childRunId);
    expect(
      statements.some((sql) => sql.includes("INSERT INTO background_jobs")),
    ).toBe(true);
    expect(
      statements.some((sql) =>
        sql.includes("error_code = \x27actor_missing\x27"),
      ),
    ).toBe(false);
    expect(
      statements.some((sql) => sql.includes("SET status = \x27failed\x27")),
    ).toBe(false);
    expect(discovery.cancelDiscoveryRun).not.toHaveBeenCalled();
  });

  it("uses the persisted cancel requester after a crash when the initiator was deleted", async () => {
    const campaign = makeCampaignRow({
      status: "cancel_requested",
      requested_by: null,
      cancellation_requested_at: "2026-09-06T12:01:00.000Z",
      cancellation_requested_by: "member-b",
    });
    const { pool, statements } = makeCampaignPool(campaign, "researching");
    discovery.cancelDiscoveryRun.mockResolvedValueOnce({
      run: { status: "cancel_requested" },
    });

    const result = await reconcileDiscoveryCampaign(pool, {
      project: expectedProject,
      campaignId,
      commandUserId: null,
      tickGeneration: 0,
    });

    expect(result.status).toBe("cancel_requested");
    expect(discovery.cancelDiscoveryRun).toHaveBeenCalledWith(
      pool,
      expect.objectContaining({ userId: "member-b", runId: childRunId }),
    );
    expect(
      statements.some((sql) => sql.includes("INSERT INTO background_jobs")),
    ).toBe(true);
  });

  it("recovers and cancels a child committed before attach without launching another run", async () => {
    const campaign = makeCampaignRow({
      status: "cancel_requested",
      active_run_id: null,
      requested_by: null,
      cancellation_requested_at: "2026-09-06T12:01:00.000Z",
      cancellation_requested_by: "member-b",
    });
    const runKey = `campaign:${campaignId}:position:0:attempt:1`;
    const item: Record<string, unknown> = {
      campaign_id: campaignId,
      position: 0,
      profile_id: profileId,
      profile_version: 1,
      profile_name: "Oslo kjerne",
      territory_code: "oslo",
      brief_snapshot: { industry_queries: ["tannklinikk"], city: "Oslo" },
      status: "launching",
      attempt_count: 1,
      current_run_id: null,
      started_at: null,
      finished_at: null,
      error_code: null,
      error_message: null,
      run_status: "researching",
      candidate_count: 8,
      researched_count: 2,
      review_ready_count: 1,
      run_error_code: null,
      run_error_message: null,
    };
    const statements: string[] = [];
    const client = {
      query: vi.fn(async (sql: string, values?: unknown[]) => {
        statements.push(sql.trim());
        if (sql.includes("FROM leadgrid_discovery_campaign_runs c")) {
          return { rows: [campaign] };
        }
        if (sql.includes("SELECT position, profile_id::text")) {
          return { rows: [item] };
        }
        if (
          sql.includes("FROM leadgrid_discovery_runs") &&
          sql.includes("idempotency_key = $3")
        ) {
          expect(values?.[2]).toBe(runKey);
          return { rows: [{ id: childRunId, status: "researching" }] };
        }
        if (sql.includes("SET current_run_id = $5::uuid")) {
          item.current_run_id = childRunId;
          item.status = "running";
        }
        if (sql.includes("SET active_run_id = $4::uuid")) {
          campaign.active_run_id = childRunId;
        }
        if (sql.includes("SET poll_generation = poll_generation + 1")) {
          const current = Number(campaign.poll_generation ?? 0);
          campaign.poll_generation = current + 1;
          return {
            rows: [{ poll_generation: campaign.poll_generation }],
            rowCount: 1,
          };
        }
        if (sql.includes("INSERT INTO background_jobs")) {
          return { rows: [], rowCount: 1 };
        }
        return { rows: [], rowCount: 1 };
      }),
      release: vi.fn(),
    };
    const query = vi.fn(async (sql: string) => {
      statements.push(sql.trim());
      if (sql.includes("SELECT id::text, organization_id::text, project_id")) {
        return { rows: [campaign] };
      }
      if (sql.includes("INSERT INTO background_jobs")) {
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes("FROM leadgrid_discovery_campaign_runs c")) {
        return { rows: [campaign] };
      }
      if (sql.includes("FROM leadgrid_discovery_campaign_items i")) {
        return { rows: [item] };
      }
      if (sql.includes("FROM leadgrid_discovery_campaign_attempts a")) {
        return { rows: [] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });
    const pool = {
      connect: vi.fn().mockResolvedValue(client),
      query,
    } as unknown as Pool;
    discovery.cancelDiscoveryRun.mockResolvedValueOnce({
      run: { status: "cancel_requested" },
    });

    const result = await reconcileDiscoveryCampaign(pool, {
      project: expectedProject,
      campaignId,
      commandUserId: null,
      tickGeneration: 0,
    });

    expect(result.active_run_id).toBe(childRunId);
    expect(discovery.cancelDiscoveryRun).toHaveBeenCalledWith(
      pool,
      expect.objectContaining({ userId: "member-b", runId: childRunId }),
    );
    expect(discovery.createDiscoveryRun).not.toHaveBeenCalled();
    expect(
      statements.some((sql) =>
        sql.includes("INSERT INTO leadgrid_discovery_campaign_attempts"),
      ),
    ).toBe(true);
    expect(
      statements.some((sql) => sql.includes("INSERT INTO background_jobs")),
    ).toBe(true);
  });

  it("uses scoped internal cancellation when both audited actors were deleted", async () => {
    const campaign = makeCampaignRow({
      status: "cancel_requested",
      requested_by: null,
      cancellation_requested_at: "2026-09-06T12:01:00.000Z",
      cancellation_requested_by: null,
    });
    const { pool, statements } = makeCampaignPool(campaign, "researching");
    discovery.cancelDiscoveryRunFromTrustedWorkflow.mockResolvedValueOnce({
      run: { status: "cancel_requested" },
    });

    const result = await reconcileDiscoveryCampaign(pool, {
      project: expectedProject,
      campaignId,
      commandUserId: null,
      tickGeneration: 0,
    });

    expect(result.status).toBe("cancel_requested");
    expect(discovery.cancelDiscoveryRun).not.toHaveBeenCalled();
    expect(
      discovery.cancelDiscoveryRunFromTrustedWorkflow,
    ).toHaveBeenCalledWith(pool, {
      project: expectedProject,
      campaignId,
      runId: childRunId,
    });
    expect(
      statements.some((sql) => sql.includes("INSERT INTO background_jobs")),
    ).toBe(true);
    expect(
      statements.some((sql) => sql.includes("active_run_id = NULL")),
    ).toBe(false);
  });

  it("allows the next profile only while the initiating user still has project access", async () => {
    access.loadAccessibleLeadgridProject.mockResolvedValue(expectedProject);
    await expect(
      revalidateDiscoveryCampaignActor({} as Pool, expectedProject, "user-a"),
    ).resolves.toEqual(expectedProject);
    expect(access.loadAccessibleLeadgridProject).toHaveBeenCalledWith(
      expect.anything(),
      "dentum-project",
      "user-a",
    );
    expect(permission.resolveEffectivePermissions).toHaveBeenCalledWith(
      expect.anything(),
      expectedProject.organizationId,
      "user-a",
    );
  });

  it("blocks the next profile when lead_research.run was revoked but membership remains", async () => {
    access.loadAccessibleLeadgridProject.mockResolvedValue(expectedProject);
    permission.resolveEffectivePermissions.mockResolvedValueOnce({
      role: "marketer",
      permissions: new Set(),
    });

    await expect(
      revalidateDiscoveryCampaignActor(
        {} as Pool,
        expectedProject,
        "user-with-revoked-run-permission",
      ),
    ).resolves.toBeNull();
  });

  it("fails closed after membership removal or an organization mismatch", async () => {
    access.loadAccessibleLeadgridProject.mockResolvedValueOnce(null);
    await expect(
      revalidateDiscoveryCampaignActor(
        {} as Pool,
        expectedProject,
        "removed-user",
      ),
    ).resolves.toBeNull();

    access.loadAccessibleLeadgridProject.mockResolvedValueOnce({
      ...expectedProject,
      organizationId: "22222222-2222-4222-8222-222222222222",
    });
    await expect(
      revalidateDiscoveryCampaignActor({} as Pool, expectedProject, "user-a"),
    ).resolves.toBeNull();
  });
});
