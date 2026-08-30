import { describe, expect, it, vi } from "vitest";
import type { WorkspaceParticipantAccess } from "./workspace-project-participants-routes.js";
import {
  getWorkspaceParticipantWorkPermitClearance,
  setWorkspaceParticipantWorkPermitClearance,
} from "./workspace-participant-clearance-service.js";

const PARTICIPANT_ID = "11111111-1111-4111-8111-111111111111";
const access: WorkspaceParticipantAccess = {
  projectId: "project-1",
  projectOwnerUserId: "owner-1",
  organizationId: "org-a",
  enterprise: true,
  featureId: "workspace-project-participants",
  canView: true,
  canManage: true,
  canConfigureRequirements: true,
  scopeBound: true,
  role: "enterprise_admin",
};

const normalized = (value: unknown) =>
  String(value).replace(/\s+/g, " ").trim();

function successfulDb() {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const query = vi.fn(async (sqlValue: unknown, params: unknown[] = []) => {
    const sql = normalized(sqlValue);
    calls.push({ sql, params });
    if (sql.startsWith("SELECT id::text") && sql.includes("FOR UPDATE")) {
      return {
        rowCount: 1,
        rows: [
          {
            id: PARTICIPANT_ID,
            is_minor: true,
            work_permit_status: "required",
            workflow_status: "confirmed",
            version: 3,
            updated_at: "2026-08-30T08:00:00.000Z",
            archived_at: null,
          },
        ],
      };
    }
    if (sql.startsWith("UPDATE workspace_project_participants")) {
      return {
        rowCount: 1,
        rows: [
          {
            id: PARTICIPANT_ID,
            is_minor: true,
            work_permit_status: "approved",
            workflow_status: "confirmed",
            version: 4,
            updated_at: "2026-08-30T09:00:00.000Z",
            archived_at: null,
          },
        ],
      };
    }
    if (sql.startsWith("INSERT INTO workspace_participant_events")) {
      return {
        rowCount: 1,
        rows: [
          {
            id: "22222222-2222-4222-8222-222222222222",
            actor_user_id: "admin-1",
            payload: JSON.parse(String(params[4])),
            occurred_at: "2026-08-30T09:00:00.000Z",
          },
        ],
      };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  });
  return { db: { query } as never, calls };
}

describe("workspace participant work permit clearance service", () => {
  it("locks the scoped participant, uses OCC, persists status, and appends evidence", async () => {
    const target = successfulDb();
    const result = await setWorkspaceParticipantWorkPermitClearance({
      db: target.db,
      access,
      actorUserId: "admin-1",
      auditPayload: { impersonated: true, effectiveUserId: "owner-1" },
      participantId: PARTICIPANT_ID,
      request: {
        version: 3,
        status: "approved",
        evidenceReference:
          "creatorhub-document:33333333-3333-4333-8333-333333333333",
        note: "Kontrollert mot verge og produksjonsdato.",
      },
    });

    expect(result.clearance).toMatchObject({
      participantId: PARTICIPANT_ID,
      status: "approved",
      participantVersion: 4,
      isMinor: true,
    });
    expect(result.change).toMatchObject({
      previousStatus: "required",
      status: "approved",
      actorUserId: "admin-1",
      participantVersion: 4,
    });
    expect(target.calls[0].sql).toContain(
      "organization_id = $1 AND project_id = $2 AND id = $3::uuid",
    );
    expect(target.calls[0].sql).toContain("FOR UPDATE");
    expect(target.calls[0].params).toEqual([
      "org-a",
      "project-1",
      PARTICIPANT_ID,
    ]);
    expect(target.calls[1].sql).toContain("AND version = $4");
    expect(target.calls[1].params).toEqual([
      "org-a",
      "project-1",
      PARTICIPANT_ID,
      3,
      "approved",
      "admin-1",
    ]);
    expect(target.calls[2].sql).toContain(
      "'work_permit_status_changed','user'",
    );
    expect(JSON.parse(String(target.calls[2].params[4]))).toEqual({
      schemaVersion: 1,
      previousStatus: "required",
      status: "approved",
      evidenceReference:
        "creatorhub-document:33333333-3333-4333-8333-333333333333",
      note: "Kontrollert mot verge og produksjonsdato.",
      participantVersion: 4,
      impersonated: true,
      effectiveUserId: "owner-1",
    });
  });

  it("fails OCC before writing when the supplied version is stale", async () => {
    const target = successfulDb();
    await expect(
      setWorkspaceParticipantWorkPermitClearance({
        db: target.db,
        access,
        actorUserId: "admin-1",
        participantId: PARTICIPANT_ID,
        request: { version: 2, status: "pending" },
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "version_conflict",
      details: { currentVersion: 3 },
    });
    expect(target.calls).toHaveLength(1);
  });

  it("requires evidence for an approved clearance at the service boundary", async () => {
    const target = successfulDb();
    await expect(
      setWorkspaceParticipantWorkPermitClearance({
        db: target.db,
        access,
        actorUserId: "admin-1",
        participantId: PARTICIPANT_ID,
        request: { version: 3, status: "approved" },
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "work_permit_evidence_required",
    });
    expect(target.calls).toHaveLength(1);
  });

  it("does not approve an adult participant", async () => {
    const target = successfulDb();
    const query = vi.mocked((target.db as any).query);
    query.mockImplementationOnce(async () => ({
      rowCount: 1,
      rows: [
        {
          id: PARTICIPANT_ID,
          is_minor: false,
          work_permit_status: "not_required",
          workflow_status: "confirmed",
          version: 3,
          updated_at: "2026-08-30T08:00:00.000Z",
          archived_at: null,
        },
      ],
    }));
    await expect(
      setWorkspaceParticipantWorkPermitClearance({
        db: target.db,
        access,
        actorUserId: "admin-1",
        participantId: PARTICIPANT_ID,
        request: {
          version: 3,
          status: "approved",
          evidenceReference: "https://creatorhub.example/evidence/permit",
        },
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "work_permit_not_applicable",
    });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("returns only tenant/project/participant-scoped audit history", async () => {
    const calls: Array<{ sql: string; params: unknown[] }> = [];
    const query = vi.fn(async (sqlValue: unknown, params: unknown[] = []) => {
      const sql = normalized(sqlValue);
      calls.push({ sql, params });
      if (
        sql.startsWith("SELECT id::text") &&
        sql.includes("FROM workspace_project_participants")
      ) {
        return {
          rowCount: 1,
          rows: [
            {
              id: PARTICIPANT_ID,
              is_minor: true,
              work_permit_status: "pending",
              workflow_status: "confirmed",
              version: 5,
              updated_at: "2026-08-30T10:00:00.000Z",
              archived_at: null,
            },
          ],
        };
      }
      return {
        rowCount: 1,
        rows: [
          {
            id: "22222222-2222-4222-8222-222222222222",
            actor_user_id: "admin-1",
            payload: {
              previousStatus: "required",
              status: "pending",
              evidenceReference:
                "workspace-file:33333333-3333-4333-8333-333333333333",
              note: "Avventer kommune.",
              participantVersion: 5,
            },
            occurred_at: "2026-08-30T10:00:00.000Z",
          },
        ],
      };
    });
    const result = await getWorkspaceParticipantWorkPermitClearance({
      db: { query } as never,
      access,
      participantId: PARTICIPANT_ID,
    });
    expect(result.history).toHaveLength(1);
    expect(result.clearance.latestChange?.note).toBe("Avventer kommune.");
    expect(calls[1].sql).toContain("organization_id = $1 AND project_id = $2");
    expect(calls[1].sql).toContain("participant_id = $3::uuid");
    expect(calls[1].sql).toContain("event_type = 'work_permit_status_changed'");
    expect(calls[1].params).toEqual(["org-a", "project-1", PARTICIPANT_ID]);
  });
});
