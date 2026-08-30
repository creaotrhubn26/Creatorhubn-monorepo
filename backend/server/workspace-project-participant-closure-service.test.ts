import { describe, expect, it, vi } from "vitest";
import {
  closeWorkspaceProjectParticipant,
  WorkspaceProjectParticipantClosureError,
} from "./workspace-project-participant-closure-service";

const ORG_ID = "enterprise-1";
const PROJECT_ID = "project-1";
const OWNER_ID = "owner-1";
const PARTICIPANT_ID = "11111111-1111-4111-8111-111111111111";
const COMPENSATION_ID = "22222222-2222-4222-8222-222222222222";
const SHEET_ID = "33333333-3333-4333-8333-333333333333";

const normalizedSql = (value: unknown) =>
  String(value).replace(/\s+/g, " ").trim();

interface HarnessOptions {
  participant?: Record<string, unknown> | null;
  compensation?: Record<string, unknown> | null;
  sheet?: Record<string, unknown> | null;
  revoked?: number;
  superseded?: number;
}

function createHarness(options: HarnessOptions = {}) {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const participant =
    options.participant === undefined
      ? {
          id: PARTICIPANT_ID,
          workflow_status: "confirmed",
          version: 4,
          archived_at: null,
        }
      : options.participant;
  const compensation =
    options.compensation === undefined
      ? {
          id: COMPENSATION_ID,
          split_sheet_id: SHEET_ID,
          compensation_type: "hourly",
        }
      : options.compensation;
  const sheet =
    options.sheet === undefined
      ? {
          id: SHEET_ID,
          status: "draft",
          metadata: {
            source: "workspace-participant-compensation",
            workspaceOrganizationId: ORG_ID,
            workspaceProjectId: PROJECT_ID,
            workspaceParticipantId: PARTICIPANT_ID,
            workspaceCompensationId: COMPENSATION_ID,
          },
        }
      : options.sheet;

  const db = {
    query: vi.fn(async (sqlValue: unknown, paramsValue?: unknown[]) => {
      const sql = normalizedSql(sqlValue);
      const params = paramsValue ?? [];
      calls.push({ sql, params });

      if (
        sql.startsWith("SELECT id::text, workflow_status") &&
        sql.includes("FROM workspace_project_participants")
      ) {
        return {
          rowCount: participant ? 1 : 0,
          rows: participant ? [participant] : [],
        };
      }
      if (
        sql.startsWith("SELECT id::text, split_sheet_id::text") &&
        sql.includes("FROM workspace_participant_compensation_links")
      ) {
        return {
          rowCount: compensation ? 1 : 0,
          rows: compensation ? [compensation] : [],
        };
      }
      if (
        sql.startsWith("SELECT id::text, status, metadata") &&
        sql.includes("FROM split_sheets")
      ) {
        return { rowCount: sheet ? 1 : 0, rows: sheet ? [sheet] : [] };
      }
      if (
        sql.startsWith("SELECT id::text, document_type, status") &&
        sql.includes("FROM workspace_participant_documents")
      ) {
        return {
          rowCount: 2,
          rows: [
            {
              id: "44444444-4444-4444-8444-444444444444",
              document_type: "contract",
              status: "issued",
            },
            {
              id: "55555555-5555-4555-8555-555555555555",
              document_type: "media_consent",
              status: "signed",
            },
          ],
        };
      }
      if (
        sql.startsWith("SELECT id::text, document_id::text") &&
        sql.includes("FROM workspace_participant_document_signers")
      ) {
        return {
          rowCount: 2,
          rows: [{ status: "pending" }, { status: "signed" }],
        };
      }
      if (sql.startsWith("UPDATE workspace_participant_document_signers")) {
        return { rowCount: options.revoked ?? 1, rows: [] };
      }
      if (sql.startsWith("UPDATE workspace_participant_documents")) {
        return { rowCount: options.superseded ?? 1, rows: [] };
      }
      if (sql.startsWith("UPDATE split_sheets")) {
        return { rowCount: 1, rows: [] };
      }
      if (sql.startsWith("UPDATE workspace_participant_compensation_links")) {
        return { rowCount: 1, rows: [] };
      }
      if (sql.startsWith("UPDATE workspace_project_participants")) {
        return { rowCount: 1, rows: [{ version: 5 }] };
      }
      if (sql.startsWith("INSERT INTO workspace_participant_events")) {
        return { rowCount: 1, rows: [] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    }),
  };
  return { db, calls };
}

const baseInput = {
  organizationId: ORG_ID,
  projectId: PROJECT_ID,
  projectOwnerUserId: OWNER_ID,
  participantId: PARTICIPANT_ID,
  expectedVersion: 4,
  actorUserId: OWNER_ID,
} as const;

describe("workspace project participant closure", () => {
  it("revokes pending documents and archives paid compensation before the participant", async () => {
    const { db, calls } = createHarness({ revoked: 1, superseded: 1 });

    const result = await closeWorkspaceProjectParticipant({
      ...baseInput,
      db: db as any,
      actorUserId: "admin-real",
      auditPayload: { impersonated: true, effectiveUserId: OWNER_ID },
      terminalStatus: "archived",
    });

    expect(result).toEqual({
      participantId: PARTICIPANT_ID,
      previousWorkflowStatus: "confirmed",
      workflowStatus: "archived",
      version: 5,
      revokedDocumentTokens: 1,
      supersededDocuments: 1,
      archivedCompensations: 1,
      archivedSplitSheets: 1,
    });

    const indexOf = (fragment: string) =>
      calls.findIndex((call) => call.sql.includes(fragment));
    expect(indexOf("FROM workspace_project_participants")).toBeLessThan(
      indexOf("FROM workspace_participant_compensation_links"),
    );
    expect(
      indexOf("FROM workspace_participant_compensation_links"),
    ).toBeLessThan(indexOf("FROM split_sheets"));
    expect(indexOf("FROM split_sheets")).toBeLessThan(
      indexOf("FROM workspace_participant_documents"),
    );
    expect(indexOf("FROM workspace_participant_documents")).toBeLessThan(
      indexOf("FROM workspace_participant_document_signers"),
    );
    expect(indexOf("UPDATE split_sheets")).toBeLessThan(
      indexOf("UPDATE workspace_participant_compensation_links"),
    );
    expect(
      indexOf("UPDATE workspace_participant_compensation_links"),
    ).toBeLessThan(indexOf("UPDATE workspace_project_participants"));

    const signerUpdate = calls.find((call) =>
      call.sql.startsWith("UPDATE workspace_participant_document_signers"),
    )?.sql;
    expect(signerUpdate).toContain("document.status IN ('issued', 'viewed')");
    expect(signerUpdate).toContain("signer.status = 'pending'");
    const documentUpdate = calls.find((call) =>
      call.sql.startsWith("UPDATE workspace_participant_documents"),
    )?.sql;
    expect(documentUpdate).toContain("status IN ('issued', 'viewed')");
    expect(documentUpdate).not.toContain("status = 'signed'");
    const participantUpdate = calls.find((call) =>
      call.sql.startsWith("UPDATE workspace_project_participants"),
    );
    expect(participantUpdate?.params[4]).toBe("admin-real");
    const event = calls.find((call) =>
      call.sql.startsWith("INSERT INTO workspace_participant_events"),
    );
    expect(event?.params[4]).toBe("admin-real");
    expect(JSON.parse(String(event?.params[5]))).toMatchObject({
      impersonated: true,
      effectiveUserId: OWNER_ID,
    });
  });

  it("archives unpaid compensation without touching a split sheet", async () => {
    const { db, calls } = createHarness({
      compensation: {
        id: COMPENSATION_ID,
        split_sheet_id: null,
        compensation_type: "unpaid",
      },
    });

    const result = await closeWorkspaceProjectParticipant({
      ...baseInput,
      db: db as any,
      terminalStatus: "cancelled",
    });

    expect(result.archivedCompensations).toBe(1);
    expect(result.archivedSplitSheets).toBe(0);
    expect(
      calls.some(
        (call) =>
          call.sql.startsWith("SELECT id::text, status, metadata") &&
          call.sql.includes("FROM split_sheets"),
      ),
    ).toBe(false);
  });

  it("allows closure without compensation or documents", async () => {
    const { db } = createHarness({ compensation: null });
    db.query.mockImplementation(
      async (sqlValue: unknown, params?: unknown[]) => {
        const sql = normalizedSql(sqlValue);
        if (sql.startsWith("SELECT id::text, workflow_status")) {
          return {
            rowCount: 1,
            rows: [{ workflow_status: "draft", version: 4, archived_at: null }],
          };
        }
        if (sql.startsWith("SELECT id::text, split_sheet_id::text")) {
          return { rowCount: 0, rows: [] };
        }
        if (sql.startsWith("SELECT id::text, document_type, status")) {
          return { rowCount: 0, rows: [] };
        }
        if (sql.startsWith("UPDATE workspace_participant_document_signers")) {
          return { rowCount: 0, rows: [] };
        }
        if (sql.startsWith("UPDATE workspace_participant_documents")) {
          return { rowCount: 0, rows: [] };
        }
        if (sql.startsWith("UPDATE workspace_project_participants")) {
          return { rowCount: 1, rows: [{ version: 5 }] };
        }
        if (sql.startsWith("INSERT INTO workspace_participant_events")) {
          return { rowCount: 1, rows: [] };
        }
        throw new Error(`Unexpected SQL: ${sql} ${JSON.stringify(params)}`);
      },
    );

    const result = await closeWorkspaceProjectParticipant({
      ...baseInput,
      db: db as any,
      terminalStatus: "cancelled",
    });
    expect(result.archivedCompensations).toBe(0);
    expect(result.revokedDocumentTokens).toBe(0);
  });

  it("fails before capability locks when the version is stale", async () => {
    const { db, calls } = createHarness({
      participant: {
        workflow_status: "confirmed",
        version: 9,
        archived_at: null,
      },
    });

    await expect(
      closeWorkspaceProjectParticipant({
        ...baseInput,
        db: db as any,
        terminalStatus: "archived",
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "version_conflict",
      details: { currentVersion: 9 },
    } satisfies Partial<WorkspaceProjectParticipantClosureError>);
    expect(calls).toHaveLength(1);
  });

  it("fails closed when the paid sheet is outside the reserved namespace", async () => {
    const { db } = createHarness({
      sheet: {
        id: SHEET_ID,
        status: "draft",
        metadata: { source: "generic-split-sheet" },
      },
    });

    await expect(
      closeWorkspaceProjectParticipant({
        ...baseInput,
        db: db as any,
        terminalStatus: "cancelled",
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "compensation_integrity_conflict",
    });
  });

  it("preserves the existing workflow transition policy", async () => {
    const { db, calls } = createHarness({
      participant: {
        workflow_status: "completed",
        version: 4,
        archived_at: null,
      },
    });

    await expect(
      closeWorkspaceProjectParticipant({
        ...baseInput,
        db: db as any,
        terminalStatus: "cancelled",
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "workflow_transition_invalid",
    });
    expect(calls).toHaveLength(1);
  });
});
