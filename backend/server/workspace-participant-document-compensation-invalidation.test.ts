import { describe, expect, it, vi } from "vitest";
import type {
  WorkspaceParticipantCompensationSnapshot,
  WorkspaceParticipantLegalSnapshot,
} from "../../frontend/shared/workspace-participant-documents.ts";
import {
  hashWorkspaceParticipantCompensationPublicTerms,
  hashWorkspaceParticipantLegalSnapshot,
  supersedeStalePendingWorkspaceParticipantContracts,
} from "./workspace-participant-documents-service.js";

const PARTICIPANT_ID = "22222222-2222-4222-8222-222222222222";
const DOCUMENT_ID = "11111111-1111-4111-8111-111111111111";
const SIGNED_DOCUMENT_ID = "77777777-7777-4777-8777-777777777777";
const SIGNER_ID = "33333333-3333-4333-8333-333333333333";
const SIGNED_SIGNER_ID = "88888888-8888-4888-8888-888888888888";
const ACTIVE_COMPENSATION_ID = "44444444-4444-4444-8444-444444444444";
const OLD_COMPENSATION_ID = "99999999-9999-4999-8999-999999999999";
const NOW = new Date("2026-08-30T12:00:00.000Z");

function compensationSnapshot(
  id: string,
  version: number,
): WorkspaceParticipantCompensationSnapshot {
  const publicTerms = {
    id,
    version,
    type: "unpaid" as const,
    hourlyRate: null,
    estimatedHours: null,
    fixedAmount: null,
    estimatedAmount: null,
    currency: "NOK",
    note: null,
  };
  return {
    ...publicTerms,
    publicTermsHash:
      hashWorkspaceParticipantCompensationPublicTerms(publicTerms),
  };
}

function participantRow() {
  return {
    id: PARTICIPANT_ID,
    organization_id: "org-1",
    project_id: "project-1",
    project_owner_user_id: "owner-1",
    is_minor: false,
    guardian_status: "not_required",
    version: 1,
    archived_at: null,
    workflow_status: "confirmed",
    requires_compensation: true,
  };
}

function activeUnpaidLink() {
  return {
    id: ACTIVE_COMPENSATION_ID,
    organization_id: "org-1",
    project_id: "project-1",
    project_owner_user_id: "owner-1",
    participant_id: PARTICIPANT_ID,
    split_sheet_id: null,
    contributor_id: null,
    compensation_type: "unpaid",
    hourly_rate: null,
    estimated_hours: null,
    day_rate: null,
    fixed_amount: null,
    share_percentage: null,
    currency: "NOK",
    status: "active",
    version: 2,
    terms_snapshot: {
      source: "workspace-participant-compensation",
      workspaceProjectId: "project-1",
      workspaceParticipantId: PARTICIPANT_ID,
      workspaceCompensationId: ACTIVE_COMPENSATION_ID,
      compensationVersion: 2,
      compensationType: "unpaid",
      hourlyRate: null,
      estimatedHours: null,
      fixedAmount: null,
      estimatedAmount: null,
      currency: "NOK",
      note: null,
    },
  };
}

function legalSnapshot(
  compensation: WorkspaceParticipantCompensationSnapshot,
): WorkspaceParticipantLegalSnapshot {
  return {
    compensation,
  } as unknown as WorkspaceParticipantLegalSnapshot;
}

describe("Workspace participant stale contract invalidation", () => {
  it("revokes and supersedes only stale pending contracts in canonical lock order", async () => {
    const staleSnapshot = legalSnapshot(
      compensationSnapshot(OLD_COMPENSATION_ID, 1),
    );
    const currentSnapshot = compensationSnapshot(ACTIVE_COMPENSATION_ID, 2);
    const calls: Array<{ sql: string; params: unknown[] }> = [];
    let eventPayload: Record<string, unknown> | undefined;

    const query = vi.fn(async (sqlValue: unknown, params: unknown[] = []) => {
      const sql = String(sqlValue).replace(/\s+/g, " ").trim();
      calls.push({ sql, params });
      if (sql.startsWith("SELECT participant.id::text")) {
        return { rowCount: 1, rows: [participantRow()] };
      }
      if (sql.startsWith("SELECT link.*")) {
        return { rowCount: 1, rows: [activeUnpaidLink()] };
      }
      if (sql.startsWith("SELECT id::text, status, terms_snapshot")) {
        return {
          rowCount: 2,
          rows: [
            {
              id: DOCUMENT_ID,
              status: "issued",
              terms_snapshot: staleSnapshot,
              content_hash:
                hashWorkspaceParticipantLegalSnapshot(staleSnapshot),
            },
            {
              id: SIGNED_DOCUMENT_ID,
              status: "viewed",
              terms_snapshot: staleSnapshot,
              content_hash:
                hashWorkspaceParticipantLegalSnapshot(staleSnapshot),
            },
          ],
        };
      }
      if (
        sql.startsWith("SELECT * FROM workspace_participant_document_signers")
      ) {
        return params[3] === DOCUMENT_ID
          ? {
              rowCount: 1,
              rows: [
                {
                  id: SIGNER_ID,
                  status: "pending",
                  signing_token_hash: "a".repeat(64),
                  token_issued_at: "2026-08-29T12:00:00.000Z",
                  token_revoked_at: null,
                },
              ],
            }
          : {
              rowCount: 1,
              rows: [
                {
                  id: SIGNED_SIGNER_ID,
                  status: "signed",
                  signing_token_hash: "b".repeat(64),
                },
              ],
            };
      }
      if (sql.startsWith("UPDATE workspace_participant_document_signers")) {
        return { rowCount: 1, rows: [] };
      }
      if (sql.startsWith("UPDATE workspace_participant_documents")) {
        return { rowCount: 1, rows: [] };
      }
      if (sql.startsWith("INSERT INTO workspace_participant_events")) {
        eventPayload = JSON.parse(String(params[6]));
        return { rowCount: 1, rows: [] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const result = await supersedeStalePendingWorkspaceParticipantContracts(
      { query } as never,
      {
        organizationId: "org-1",
        projectId: "project-1",
        participantId: PARTICIPANT_ID,
        activeCompensationId: ACTIVE_COMPENSATION_ID,
        activeCompensationVersion: 2,
        actorUserId: "manager-1",
        runtime: { now: () => NOW },
      },
    );

    expect(calls.slice(0, 4).map((call) => call.sql)).toEqual([
      expect.stringMatching(/workspace_project_participants.*FOR UPDATE/),
      expect.stringMatching(/compensation_links.*FOR UPDATE OF link/),
      expect.stringMatching(
        /document_type = 'contract'.*status IN \('issued', 'viewed'\).*ORDER BY id.*FOR UPDATE/,
      ),
      expect.stringMatching(
        /workspace_participant_document_signers.*FOR UPDATE/,
      ),
    ]);
    const signerUpdates = calls.filter((call) =>
      call.sql.startsWith("UPDATE workspace_participant_document_signers"),
    );
    const documentUpdates = calls.filter((call) =>
      call.sql.startsWith("UPDATE workspace_participant_documents"),
    );
    expect(signerUpdates).toHaveLength(1);
    expect(signerUpdates[0]?.sql).toContain("signing_token_hash = NULL");
    expect(signerUpdates[0]?.sql).toContain("token_revoked_at = GREATEST");
    expect(signerUpdates[0]?.params[3]).toBe(DOCUMENT_ID);
    expect(documentUpdates).toHaveLength(1);
    expect(documentUpdates[0]?.params[3]).toBe(DOCUMENT_ID);
    expect(
      calls.some(
        (call) =>
          /^(UPDATE|INSERT)/.test(call.sql) &&
          call.params.includes(SIGNED_DOCUMENT_ID),
      ),
    ).toBe(false);
    expect(eventPayload).toMatchObject({
      reason: "active_compensation_changed",
      previousCompensationId: OLD_COMPENSATION_ID,
      previousCompensationVersion: 1,
      compensationId: ACTIVE_COMPENSATION_ID,
      compensationVersion: 2,
      compensationPublicTermsHash: currentSnapshot.publicTermsHash,
    });
    expect(result).toEqual({
      activeCompensation: currentSnapshot,
      supersededDocumentIds: [DOCUMENT_ID],
    });
  });

  it("is idempotent when a pending contract already contains current terms", async () => {
    const currentSnapshot = compensationSnapshot(ACTIVE_COMPENSATION_ID, 2);
    const snapshot = legalSnapshot(currentSnapshot);
    const calls: string[] = [];
    const query = vi.fn(async (sqlValue: unknown) => {
      const sql = String(sqlValue).replace(/\s+/g, " ").trim();
      calls.push(sql);
      if (sql.startsWith("SELECT participant.id::text")) {
        return { rowCount: 1, rows: [participantRow()] };
      }
      if (sql.startsWith("SELECT link.*")) {
        return { rowCount: 1, rows: [activeUnpaidLink()] };
      }
      if (sql.startsWith("SELECT id::text, status, terms_snapshot")) {
        return {
          rowCount: 1,
          rows: [
            {
              id: DOCUMENT_ID,
              status: "issued",
              terms_snapshot: snapshot,
              content_hash: hashWorkspaceParticipantLegalSnapshot(snapshot),
            },
          ],
        };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const result = await supersedeStalePendingWorkspaceParticipantContracts(
      { query } as never,
      {
        organizationId: "org-1",
        projectId: "project-1",
        participantId: PARTICIPANT_ID,
        activeCompensationId: ACTIVE_COMPENSATION_ID,
        activeCompensationVersion: 2,
        actorUserId: "manager-1",
        runtime: { now: () => NOW },
      },
    );

    expect(result.supersededDocumentIds).toEqual([]);
    expect(
      calls.some((sql) =>
        sql.includes("workspace_participant_document_signers"),
      ),
    ).toBe(false);
  });
});
