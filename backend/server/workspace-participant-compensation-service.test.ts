import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createWorkspaceParticipantCompensationVersion,
  listWorkspaceParticipantCompensation,
  workspaceParticipantCompensationRequestHash,
  WorkspaceParticipantCompensationError,
} from "./workspace-participant-compensation-service.js";
import type { WorkspaceParticipantAccess } from "./workspace-project-participants-routes.js";

const documentInvalidation = vi.hoisted(() => ({
  supersede: vi.fn(async () => ({
    activeCompensation: {},
    supersededDocumentIds: [],
  })),
}));
vi.mock("./workspace-participant-documents-service.js", () => ({
  supersedeStalePendingWorkspaceParticipantContracts:
    documentInvalidation.supersede,
}));

const PROJECT_ID = "project-1";
const PARTICIPANT_ID = "11111111-1111-4111-8111-111111111111";
const COMPENSATION_ID = "22222222-2222-4222-8222-222222222222";
const SHEET_ID = "33333333-3333-4333-8333-333333333333";
const CONTRIBUTOR_ID = "44444444-4444-4444-8444-444444444444";
const VERSION_ID = "55555555-5555-4555-8555-555555555555";
const OLD_COMPENSATION_ID = "66666666-6666-4666-8666-666666666666";
const OLD_SHEET_ID = "77777777-7777-4777-8777-777777777777";
const IDEMPOTENCY_KEY = "88888888-8888-4888-8888-888888888888";

const access: WorkspaceParticipantAccess = {
  projectId: PROJECT_ID,
  projectOwnerUserId: "owner-1",
  organizationId: "org-a",
  enterprise: true,
  featureId: "workspace-project-participants",
  canView: true,
  canManage: true,
  canConfigureRequirements: false,
  scopeBound: true,
  role: "participant_manager",
};

const sqlText = (value: unknown) => String(value).replace(/\s+/g, " ").trim();

function compensationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: COMPENSATION_ID,
    organization_id: "org-a",
    project_id: PROJECT_ID,
    project_owner_user_id: "owner-1",
    participant_id: PARTICIPANT_ID,
    split_sheet_id: SHEET_ID,
    contributor_id: CONTRIBUTOR_ID,
    compensation_type: "hourly",
    hourly_rate: "1250.00",
    estimated_hours: "8.00",
    day_rate: null,
    fixed_amount: null,
    share_percentage: null,
    currency: "NOK",
    status: "active",
    terms_snapshot: { estimatedAmount: 10000, note: "Kveld" },
    version: 1,
    idempotency_key: IDEMPOTENCY_KEY,
    request_hash: "a".repeat(64),
    supersedes_link_id: null,
    created_at: "2026-08-30T08:00:00.000Z",
    updated_at: "2026-08-30T08:00:00.000Z",
    superseded_at: null,
    archived_at: null,
    split_sheet_status: "draft",
    ...overrides,
  };
}

function participantRow(overrides: Record<string, unknown> = {}) {
  return {
    id: PARTICIPANT_ID,
    display_name: "Ada Statist",
    email: "ADA@example.test",
    role_label: "Bakgrunn",
    workflow_status: "confirmed",
    archived_at: null,
    ...overrides,
  };
}

function createServiceDb(
  options: {
    current?: Record<string, unknown> | null;
    replay?: Record<string, unknown> | null;
    oldSheetStatus?: string;
    hasSignatureEvidence?: boolean;
    participant?: Record<string, unknown> | null;
    final?: Record<string, unknown>;
  } = {},
) {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const query = vi.fn(async (sqlValue: unknown, params: unknown[] = []) => {
    const sql = sqlText(sqlValue);
    calls.push({ sql, params });
    if (
      sql.startsWith("SELECT id, display_name") &&
      sql.includes("workspace_project_participants")
    ) {
      const row =
        options.participant === undefined
          ? participantRow()
          : options.participant;
      return { rowCount: row ? 1 : 0, rows: row ? [row] : [] };
    }
    if (sql.includes("link.idempotency_key = $5::uuid")) {
      return {
        rowCount: options.replay ? 1 : 0,
        rows: options.replay ? [options.replay] : [],
      };
    }
    if (
      sql.includes("link.status = 'active'") &&
      sql.includes("FOR UPDATE OF link")
    ) {
      return {
        rowCount: options.current ? 1 : 0,
        rows: options.current ? [options.current] : [],
      };
    }
    if (sql.startsWith("SELECT COALESCE(MAX(version), 0)::integer")) {
      return {
        rowCount: 1,
        rows: [{ max_version: options.current ? options.current.version : 0 }],
      };
    }
    if (sql.startsWith("SELECT id, status FROM split_sheets")) {
      return {
        rowCount: 1,
        rows: [{ id: OLD_SHEET_ID, status: options.oldSheetStatus ?? "draft" }],
      };
    }
    if (sql.includes("AS has_signature_evidence")) {
      return {
        rowCount: 1,
        rows: [
          { has_signature_evidence: options.hasSignatureEvidence ?? false },
        ],
      };
    }
    if (sql.includes("AND link.id = $5::uuid") && sql.includes("LIMIT 1")) {
      return {
        rowCount: 1,
        rows: [options.final ?? compensationRow()],
      };
    }
    return { rowCount: 1, rows: [] };
  });
  return { db: { query } as never, query, calls };
}

const fixedRequest = {
  compensationType: "fixed" as const,
  fixedAmount: 15_000,
  currency: "NOK",
  expectedCurrentVersion: null,
  idempotencyKey: IDEMPOTENCY_KEY,
};

describe("workspace participant compensation service", () => {
  beforeEach(() => {
    documentInvalidation.supersede.mockClear();
  });

  it("creates a private versioned hourly sheet with one external contributor", async () => {
    const harness = createServiceDb();
    const ids = [COMPENSATION_ID, SHEET_ID, CONTRIBUTOR_ID, VERSION_ID];
    documentInvalidation.supersede.mockImplementationOnce(async () => {
      const activationWritten = harness.calls.some(
        (call) =>
          call.sql.startsWith(
            "UPDATE workspace_participant_compensation_links",
          ) && call.sql.includes("SET status = 'active'"),
      );
      const eventWritten = harness.calls.some((call) =>
        call.sql.includes("participant_compensation_version_created"),
      );
      expect({ activationWritten, eventWritten }).toEqual({
        activationWritten: true,
        eventWritten: false,
      });
      return { activeCompensation: {}, supersededDocumentIds: [] };
    });
    const result = await createWorkspaceParticipantCompensationVersion({
      db: harness.db,
      access,
      actorUserId: "admin-real",
      auditPayload: { impersonated: true, effectiveUserId: "owner-1" },
      participantId: PARTICIPANT_ID,
      request: {
        compensationType: "hourly",
        hourlyRate: 1250,
        estimatedHours: 8,
        currency: "NOK",
        expectedCurrentVersion: null,
        idempotencyKey: IDEMPOTENCY_KEY,
        note: "Kveld",
      },
      createId: () => ids.shift() || VERSION_ID,
    });

    expect(result.replayed).toBe(false);
    expect(result.compensation.estimatedAmount).toBe(10_000);
    expect(documentInvalidation.supersede).toHaveBeenCalledWith(harness.db, {
      organizationId: access.organizationId,
      projectId: access.projectId,
      participantId: PARTICIPANT_ID,
      activeCompensationId: COMPENSATION_ID,
      activeCompensationVersion: 1,
      actorUserId: "admin-real",
      auditPayload: { impersonated: true, effectiveUserId: "owner-1" },
    });
    const sheet = harness.calls.find((call) =>
      call.sql.startsWith("INSERT INTO split_sheets"),
    );
    expect(sheet?.params.slice(0, 3)).toEqual([
      SHEET_ID,
      "owner-1",
      PROJECT_ID,
    ]);
    expect(JSON.parse(String(sheet?.params[5]))).toMatchObject({
      agreementVersion: 1,
      visibility: "private",
      source: "workspace-participant-compensation",
      workspaceProjectId: PROJECT_ID,
      workspaceParticipantId: PARTICIPANT_ID,
      workspaceCompensationId: COMPENSATION_ID,
      compensationModel: "hourly",
    });
    const contributor = harness.calls.find((call) =>
      call.sql.startsWith("INSERT INTO split_sheet_contributors"),
    );
    expect(contributor?.sql).toContain("user_id");
    expect(contributor?.sql).toContain("'not_sent', NULL");
    expect(contributor?.params.slice(0, 4)).toEqual([
      CONTRIBUTOR_ID,
      SHEET_ID,
      "Ada Statist",
      "ada@example.test",
    ]);
    expect(JSON.parse(String(contributor?.params[4]))).toMatchObject({
      compensationType: "hourly",
      hourlyRate: 1250,
      estimatedHours: 8,
      estimatedAmount: 10000,
      externalParticipant: true,
    });
    expect(
      harness.calls.some((call) =>
        call.sql.includes("split_sheet_contributor_access"),
      ),
    ).toBe(false);
    expect(
      harness.calls.some((call) =>
        /role_room|casting|talent|enterprise_team_members/i.test(call.sql),
      ),
    ).toBe(false);
    const sheetVersion = harness.calls.find((call) =>
      call.sql.startsWith("INSERT INTO split_sheet_versions"),
    );
    expect(sheetVersion?.params[3]).toBe("admin-real");
    const compensationLink = harness.calls.find((call) =>
      call.sql.startsWith(
        "INSERT INTO workspace_participant_compensation_links",
      ),
    );
    expect(compensationLink?.params[17]).toBe("admin-real");
    const event = harness.calls.find((call) =>
      call.sql.includes("participant_compensation_version_created"),
    );
    expect(event?.params[3]).toBe("admin-real");
    expect(JSON.parse(String(event?.params[4]))).toMatchObject({
      impersonated: true,
      effectiveUserId: "owner-1",
    });
  });

  it("creates unpaid compensation without a split sheet or contributor", async () => {
    const harness = createServiceDb({
      final: compensationRow({
        split_sheet_id: null,
        contributor_id: null,
        compensation_type: "unpaid",
        hourly_rate: null,
        estimated_hours: null,
        terms_snapshot: { estimatedAmount: null, note: null },
        split_sheet_status: null,
      }),
    });
    const result = await createWorkspaceParticipantCompensationVersion({
      db: harness.db,
      access,
      actorUserId: "manager-1",
      participantId: PARTICIPANT_ID,
      request: {
        compensationType: "unpaid",
        expectedCurrentVersion: null,
        idempotencyKey: IDEMPOTENCY_KEY,
      },
      createId: () => COMPENSATION_ID,
    });

    expect(result.compensation.compensationType).toBe("unpaid");
    expect(result.compensation.splitSheetId).toBeNull();
    expect(
      harness.calls.some((call) =>
        call.sql.startsWith("INSERT INTO split_sheets"),
      ),
    ).toBe(false);
    const link = harness.calls.find((call) =>
      call.sql.startsWith(
        "INSERT INTO workspace_participant_compensation_links",
      ),
    );
    expect(link?.params[5]).toBeNull();
    expect(link?.params[6]).toBeNull();
  });

  it("archives an unsigned pending sheet before superseding its active link", async () => {
    const current = compensationRow({
      id: OLD_COMPENSATION_ID,
      split_sheet_id: OLD_SHEET_ID,
      contributor_id: CONTRIBUTOR_ID,
      version: 1,
    });
    const harness = createServiceDb({
      current,
      oldSheetStatus: "pending_signatures",
      hasSignatureEvidence: false,
      final: compensationRow({
        compensation_type: "fixed",
        hourly_rate: null,
        estimated_hours: null,
        fixed_amount: "15000.00",
        terms_snapshot: { estimatedAmount: 15000, note: null },
        version: 2,
        supersedes_link_id: OLD_COMPENSATION_ID,
      }),
    });
    const ids = [COMPENSATION_ID, SHEET_ID, CONTRIBUTOR_ID, VERSION_ID];
    await createWorkspaceParticipantCompensationVersion({
      db: harness.db,
      access,
      actorUserId: "manager-1",
      participantId: PARTICIPANT_ID,
      request: { ...fixedRequest, expectedCurrentVersion: 1 },
      createId: () => ids.shift() || VERSION_ID,
    });

    const participantLock = harness.calls.findIndex(
      (call) =>
        call.sql.includes("workspace_project_participants") &&
        call.sql.includes("FOR UPDATE"),
    );
    const oldSheetLock = harness.calls.findIndex((call) =>
      call.sql.startsWith("SELECT id, status FROM split_sheets"),
    );
    expect(participantLock).toBeGreaterThanOrEqual(0);
    expect(oldSheetLock).toBeGreaterThan(participantLock);
    expect(
      harness.calls.some(
        (call) =>
          call.sql.startsWith("UPDATE split_sheets") &&
          call.sql.includes("status = 'archived'"),
      ),
    ).toBe(true);
    expect(
      harness.calls.some(
        (call) =>
          call.sql.startsWith(
            "UPDATE workspace_participant_compensation_links",
          ) && call.sql.includes("status = 'superseded'"),
      ),
    ).toBe(true);
  });

  it.each([
    { oldSheetStatus: "pending_signatures", hasSignatureEvidence: true },
    { oldSheetStatus: "completed", hasSignatureEvidence: true },
  ])("preserves signed evidence for $oldSheetStatus", async (scenario) => {
    const harness = createServiceDb({
      current: compensationRow({
        id: OLD_COMPENSATION_ID,
        split_sheet_id: OLD_SHEET_ID,
        version: 1,
      }),
      ...scenario,
      final: compensationRow({ version: 2 }),
    });
    const ids = [COMPENSATION_ID, SHEET_ID, CONTRIBUTOR_ID, VERSION_ID];
    await createWorkspaceParticipantCompensationVersion({
      db: harness.db,
      access,
      actorUserId: "manager-1",
      participantId: PARTICIPANT_ID,
      request: { ...fixedRequest, expectedCurrentVersion: 1 },
      createId: () => ids.shift() || VERSION_ID,
    });

    expect(
      harness.calls.some(
        (call) =>
          call.sql.startsWith("UPDATE split_sheets") &&
          call.sql.includes("status = 'archived'"),
      ),
    ).toBe(false);
    expect(
      harness.calls.some((call) =>
        call.sql.includes(
          "signed_at IS NOT NULL OR signature_data IS NOT NULL",
        ),
      ),
    ).toBe(true);
  });

  it("replays the same idempotency key before OCC and rejects payload reuse", async () => {
    const request = {
      compensationType: "unpaid" as const,
      expectedCurrentVersion: null,
      idempotencyKey: IDEMPOTENCY_KEY,
    };
    const firstHarness = createServiceDb();
    const ids = [COMPENSATION_ID];
    await createWorkspaceParticipantCompensationVersion({
      db: firstHarness.db,
      access,
      actorUserId: "manager-1",
      participantId: PARTICIPANT_ID,
      request,
      createId: () => ids.shift() || COMPENSATION_ID,
    });
    const insertedLink = firstHarness.calls.find((call) =>
      call.sql.startsWith(
        "INSERT INTO workspace_participant_compensation_links",
      ),
    );
    const requestHash = String(insertedLink?.params[15]);
    const replayHarness = createServiceDb({
      replay: compensationRow({
        split_sheet_id: null,
        contributor_id: null,
        compensation_type: "unpaid",
        hourly_rate: null,
        estimated_hours: null,
        request_hash: requestHash,
        split_sheet_status: null,
      }),
    });
    const replay = await createWorkspaceParticipantCompensationVersion({
      db: replayHarness.db,
      access,
      actorUserId: "manager-1",
      participantId: PARTICIPANT_ID,
      request,
    });
    expect(replay.replayed).toBe(true);
    expect(
      replayHarness.calls.some((call) =>
        call.sql.includes("link.status = 'active'"),
      ),
    ).toBe(false);

    const conflictHarness = createServiceDb({
      replay: compensationRow({ request_hash: "f".repeat(64) }),
    });
    await expect(
      createWorkspaceParticipantCompensationVersion({
        db: conflictHarness.db,
        access,
        actorUserId: "manager-1",
        participantId: PARTICIPANT_ID,
        request,
      }),
    ).rejects.toMatchObject({ code: "idempotency_conflict", statusCode: 409 });
  });

  it("fails OCC with the scoped current version", async () => {
    const harness = createServiceDb({
      current: compensationRow({ version: 4 }),
    });
    await expect(
      createWorkspaceParticipantCompensationVersion({
        db: harness.db,
        access,
        actorUserId: "manager-1",
        participantId: PARTICIPANT_ID,
        request: fixedRequest,
      }),
    ).rejects.toMatchObject({
      code: "version_conflict",
      statusCode: 409,
      details: { currentVersion: 4 },
    });
  });

  it("scopes history by tenant, project owner, and participant and fails closed", async () => {
    const query = vi.fn(async (sqlValue: unknown, params: unknown[] = []) => {
      const sql = sqlText(sqlValue);
      if (sql.startsWith("SELECT id FROM workspace_project_participants")) {
        expect(params).toEqual(["org-a", PROJECT_ID, PARTICIPANT_ID]);
        return { rowCount: 0, rows: [] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });
    await expect(
      listWorkspaceParticipantCompensation(
        { query } as never,
        access,
        PARTICIPANT_ID,
      ),
    ).rejects.toBeInstanceOf(WorkspaceParticipantCompensationError);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("canonicalizes the public note and rejects HTML before database access", () => {
    const base = {
      compensationType: "unpaid" as const,
      expectedCurrentVersion: null,
      idempotencyKey: IDEMPOTENCY_KEY,
    };
    expect(
      workspaceParticipantCompensationRequestHash({
        ...base,
        note: "  Cafe\u0301 kveld  ",
      }),
    ).toBe(
      workspaceParticipantCompensationRequestHash({
        ...base,
        note: "Café kveld",
      }),
    );
    expect(() =>
      workspaceParticipantCompensationRequestHash({
        ...base,
        note: "<strong>privat</strong>",
      }),
    ).toThrowError(WorkspaceParticipantCompensationError);
  });
});
