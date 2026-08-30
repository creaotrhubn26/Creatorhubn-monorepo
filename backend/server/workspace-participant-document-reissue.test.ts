import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  hashWorkspaceParticipantDocumentToken,
  hashWorkspaceParticipantLegalSnapshot,
  reissueWorkspaceParticipantDocumentToken,
} from "./workspace-participant-documents-service.js";

const DOCUMENT_ID = "11111111-1111-4111-8111-111111111111";
const PARTICIPANT_ID = "22222222-2222-4222-8222-222222222222";
const SIGNER_ID = "33333333-3333-4333-8333-333333333333";
const NOW = new Date("2026-08-30T10:00:00.000Z");

const migration = readFileSync(
  fileURLToPath(
    new URL(
      "../migrations/0468_workspace_participant_document_lifecycle.sql",
      import.meta.url,
    ),
  ),
  "utf8",
);

function reissueDb(updateRowCount = 1) {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const termsSnapshot = {
    project: { id: "project-1", title: "Reklamefilm" },
    producer: { name: "Produsent", email: "owner@example.test" },
    compensation: null,
  };
  const document = {
    id: DOCUMENT_ID,
    organization_id: "org-1",
    project_id: "project-1",
    participant_id: PARTICIPANT_ID,
    document_type: "media_consent",
    status: "issued",
    version: 1,
    title: "Mediesamtykke",
    terms_snapshot: termsSnapshot,
    content_hash: hashWorkspaceParticipantLegalSnapshot(termsSnapshot),
    issued_at: NOW,
    expires_at: null,
    signed_at: null,
    withdrawn_at: null,
    created_at: NOW,
    updated_at: NOW,
  };
  const signer = {
    id: SIGNER_ID,
    signer_role: "participant",
    signer_name: "Kari Nordmann",
    signer_email: "kari@example.test",
    status: "pending",
    signing_token_hash: null,
    token_issued_at: new Date("2026-08-01T10:00:00.000Z"),
    token_expires_at: new Date("2026-08-15T10:00:00.000Z"),
    token_revoked_at: new Date("2026-08-10T10:00:00.000Z"),
    signed_at: null,
  };
  const query = vi.fn(async (sqlValue: unknown, params: unknown[] = []) => {
    const sql = String(sqlValue).replace(/\s+/g, " ").trim();
    calls.push({ sql, params });
    if (
      sql.startsWith("SELECT document_type") &&
      sql.includes("workspace_participant_documents")
    ) {
      return { rowCount: 1, rows: [{ document_type: "media_consent" }] };
    }
    if (
      sql.startsWith("SELECT participant.id::text") &&
      sql.includes("workspace_project_participants")
    ) {
      return {
        rowCount: 1,
        rows: [
          {
            id: PARTICIPANT_ID,
            organization_id: "org-1",
            project_id: "project-1",
            project_owner_user_id: "owner-1",
            is_minor: false,
            guardian_status: "not_required",
            version: 1,
            archived_at: null,
            workflow_status: "confirmed",
            requires_compensation: false,
          },
        ],
      };
    }
    if (sql.startsWith("SELECT * FROM workspace_participant_documents")) {
      return { rowCount: 1, rows: [document] };
    }
    if (
      sql.startsWith("SELECT * FROM workspace_participant_document_signers")
    ) {
      return { rowCount: 1, rows: [signer] };
    }
    if (sql.startsWith("UPDATE workspace_participant_document_signers")) {
      return { rowCount: updateRowCount, rows: [] };
    }
    if (sql.startsWith("INSERT INTO workspace_participant_events")) {
      return { rowCount: 1, rows: [] };
    }
    if (sql.startsWith("SELECT document.*")) {
      return {
        rowCount: 1,
        rows: [
          {
            ...document,
            signer_id: SIGNER_ID,
            signer_role: signer.signer_role,
            signer_name: signer.signer_name,
            signer_email: signer.signer_email,
            signer_status: signer.status,
            token_expires_at: new Date("2026-09-29T10:00:00.000Z"),
            token_revoked_at: null,
            signer_signed_at: null,
            delivery_event_type: null,
            delivery_payload: null,
            delivery_occurred_at: null,
          },
        ],
      };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  });
  return { db: { query }, calls };
}

const input = {
  organizationId: "org-1",
  projectId: "project-1",
  participantId: PARTICIPANT_ID,
  documentId: DOCUMENT_ID,
  actorUserId: "admin-real",
  auditPayload: { impersonated: true, effectiveUserId: "owner-1" },
  runtime: {
    now: () => NOW,
    randomBytes: (size: number) => Buffer.alloc(size, 9),
    tokenSigningSecret: "workspace-participant-reissue-test-token-secret-v1",
  },
};

describe("Workspace participant document credential reissue", () => {
  it("rotates a revoked pending credential without changing legal evidence", async () => {
    const { db, calls } = reissueDb();
    const result = await reissueWorkspaceParticipantDocumentToken(
      db as never,
      input,
    );

    expect(calls[0].sql).toMatch(/SELECT document_type/);
    expect(calls[1].sql).toMatch(/workspace_project_participants.*FOR UPDATE/);
    expect(calls[2].sql).toMatch(/workspace_participant_documents.*FOR UPDATE/);
    expect(calls[3].sql).toMatch(
      /workspace_participant_document_signers.*FOR UPDATE/,
    );
    const update = calls.find((call) =>
      call.sql.startsWith("UPDATE workspace_participant_document_signers"),
    );
    expect(update?.sql).toContain("token_revoked_at = NULL");
    expect(update?.sql).not.toContain("signature_evidence");
    expect(update?.sql).not.toContain("token_used_at");
    expect(update?.params[4]).toBe(
      hashWorkspaceParticipantDocumentToken(result.rawToken),
    );
    expect(update?.params[5]).toBe(NOW.toISOString());
    expect(update?.params[6]).toBe("2026-09-29T10:00:00.000Z");
    const event = calls.find((call) =>
      call.sql.startsWith("INSERT INTO workspace_participant_events"),
    );
    expect(event?.params[5]).toBe("admin-real");
    expect(JSON.parse(String(event?.params[6]))).toMatchObject({
      impersonated: true,
      effectiveUserId: "owner-1",
    });
  });

  it("does not append a reissue event after a lost compare-and-set", async () => {
    const { db, calls } = reissueDb(0);
    await expect(
      reissueWorkspaceParticipantDocumentToken(db as never, input),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "document_reissue_conflict",
    });
    expect(
      calls.some((call) =>
        call.sql.startsWith("INSERT INTO workspace_participant_events"),
      ),
    ).toBe(false);
  });

  it("models a revoked pending credential as hashless but reissuable", () => {
    expect(migration).toContain(
      "token_revoked_at IS NULL OR signing_token_hash IS NULL",
    );
    expect(migration).toMatch(
      /signing_token_hash IS NULL AND token_issued_at IS NOT NULL[\s\S]{0,180}token_revoked_at IS NOT NULL/,
    );
  });
});
