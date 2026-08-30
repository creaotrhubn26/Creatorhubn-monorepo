import { describe, expect, it, vi } from "vitest";
import type { WorkspaceParticipantLegalSnapshot } from "../../frontend/shared/workspace-participant-documents.ts";
import {
  hashWorkspaceParticipantDocumentToken,
  hashWorkspaceParticipantLegalSnapshot,
  signWorkspaceParticipantDocument,
} from "./workspace-participant-documents-service.js";

const DOCUMENT_ID = "11111111-1111-4111-8111-111111111111";
const PARTICIPANT_ID = "22222222-2222-4222-8222-222222222222";
const SIGNER_ID = "33333333-3333-4333-8333-333333333333";
const TOKEN = "A".repeat(43);
const TOKEN_HASH = hashWorkspaceParticipantDocumentToken(TOKEN);
const NOW = new Date("2026-08-30T10:00:00.000Z");

function snapshot(
  documentType: "contract" | "media_consent",
): WorkspaceParticipantLegalSnapshot {
  return {
    schemaVersion: 1,
    document: {
      id: DOCUMENT_ID,
      type: documentType,
      version: 1,
      title: documentType === "contract" ? "Kontrakt" : "Mediesamtykke",
      issuedAt: "2026-08-29T10:00:00.000Z",
    },
    project: { id: "project-1", title: "Reklamefilm", organizationId: "org-1" },
    producer: {
      userId: "owner-1",
      name: "Produsent",
      email: "owner@example.test",
      companyName: "Studio",
    },
    participant: {
      id: PARTICIPANT_ID,
      name: "Mindreårig",
      email: null,
      role: "Statist",
      isMinor: true,
    },
    signer: {
      role: "guardian",
      name: "Foresatt Nordmann",
      email: "foresatt@example.test",
      guardianRelationship: "Forelder",
    },
    acceptance: {
      version: "workspace-participant-legal-acceptance-v1",
      text: "Jeg godtar vilkårene.",
    },
    terms:
      documentType === "contract"
        ? {
            kind: "contract",
            workDescription: "En opptaksdag",
            role: "Statist",
          }
        : {
            kind: "media_consent",
            mediaTypes: ["photo", "video"],
            purposes: ["Markedsføring"],
            channels: ["Nettside"],
            territory: "Norge",
            duration: "3 år",
            retention: "Slettes etter formålet",
            editingAllowed: true,
            paidMediaAllowed: false,
            withdrawalContact: "privacy@example.test",
          },
  };
}

function guardianSigningDb(input: {
  documentType: "contract" | "media_consent";
  guardianStatus:
    | "not_required"
    | "required"
    | "pending"
    | "approved"
    | "rejected";
  guardianUpdateRowCount?: number;
  preflightFound?: boolean;
}) {
  const terms = snapshot(input.documentType);
  const state = {
    participant: {
      id: PARTICIPANT_ID,
      organization_id: "org-1",
      project_id: "project-1",
      is_minor: true,
      guardian_status: input.guardianStatus,
      version: 7,
      archived_at: null,
    },
    document: {
      id: DOCUMENT_ID,
      organization_id: "org-1",
      project_id: "project-1",
      participant_id: PARTICIPANT_ID,
      document_type: input.documentType,
      status: "issued",
      version: 1,
      title: terms.document.title,
      terms_snapshot: terms,
      content_hash: hashWorkspaceParticipantLegalSnapshot(terms),
      issued_at: terms.document.issuedAt,
      signed_at: null as string | null,
      withdrawn_at: null,
    },
    signer: {
      id: SIGNER_ID,
      organization_id: "org-1",
      project_id: "project-1",
      participant_id: PARTICIPANT_ID,
      document_id: DOCUMENT_ID,
      signer_role: "guardian",
      signer_name: "Foresatt Nordmann",
      signer_email: "foresatt@example.test",
      status: "pending",
      signing_token_hash: TOKEN_HASH,
      token_issued_at: "2026-08-29T10:00:00.000Z",
      token_expires_at: "2026-09-29T10:00:00.000Z" as string | null,
      token_revoked_at: null,
      token_used_at: null as string | null,
      signed_at: null as string | null,
      signature_evidence: null as Record<string, unknown> | null,
    },
  };
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const query = vi.fn(async (sqlValue: unknown, params: unknown[] = []) => {
    const sql = String(sqlValue).replace(/\s+/g, " ").trim();
    calls.push({ sql, params });
    if (
      sql.startsWith("SELECT") &&
      sql.includes("JOIN workspace_participant_document_signers") &&
      sql.includes("signing_token_hash") &&
      !sql.includes("FOR UPDATE")
    ) {
      return input.preflightFound === false
        ? { rowCount: 0, rows: [] }
        : {
            rowCount: 1,
            rows: [
              {
                organization_id: state.document.organization_id,
                project_id: state.document.project_id,
                participant_id: state.document.participant_id,
              },
            ],
          };
    }
    if (
      sql.startsWith("SELECT") &&
      sql.includes("FROM workspace_project_participants") &&
      sql.includes("FOR UPDATE")
    ) {
      return { rowCount: 1, rows: [state.participant] };
    }
    if (sql.startsWith("SELECT * FROM workspace_participant_documents")) {
      return { rowCount: 1, rows: [state.document] };
    }
    if (
      sql.startsWith("SELECT * FROM workspace_participant_document_signers")
    ) {
      return { rowCount: 1, rows: [state.signer] };
    }
    if (sql.startsWith("UPDATE workspace_participant_document_signers")) {
      state.signer.status = "signed";
      state.signer.token_used_at = String(params[5]);
      state.signer.signed_at = String(params[5]);
      state.signer.signature_evidence = JSON.parse(String(params[6]));
      state.signer.token_expires_at =
        input.documentType === "media_consent" ? null : String(params[8]);
      return { rowCount: 1, rows: [] };
    }
    if (sql.startsWith("UPDATE workspace_participant_documents")) {
      state.document.status = "signed";
      state.document.signed_at = String(params[4]);
      return { rowCount: 1, rows: [] };
    }
    if (sql.startsWith("UPDATE workspace_project_participants")) {
      const rowCount = input.guardianUpdateRowCount ?? 1;
      if (rowCount === 1) {
        state.participant.guardian_status = "approved";
        state.participant.version += 1;
      }
      return {
        rowCount,
        rows: rowCount === 1 ? [{ version: state.participant.version }] : [],
      };
    }
    if (sql.startsWith("INSERT INTO workspace_participant_events")) {
      return { rowCount: 1, rows: [] };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  });
  return { db: { query }, calls, state };
}

const signInput = {
  documentId: DOCUMENT_ID,
  tokenHash: TOKEN_HASH,
  signerName: "Foresatt Nordmann",
  accepted: true as const,
  signatureMethod: "typed" as const,
  ip: "192.0.2.10",
  userAgent: "Vitest",
  runtime: { now: () => NOW },
};

describe("guardian document signature readiness", () => {
  it.each(["contract", "media_consent"] as const)(
    "approves guardian readiness exactly once for a signed %s",
    async (documentType) => {
      const { db, calls, state } = guardianSigningDb({
        documentType,
        guardianStatus: "pending",
      });
      const first = await signWorkspaceParticipantDocument(
        db as never,
        signInput,
      );
      const writesAfterFirst = calls.filter((call) =>
        /^(UPDATE|INSERT)/.test(call.sql),
      ).length;
      const second = await signWorkspaceParticipantDocument(db as never, {
        ...signInput,
        signerName: "Forsøk på annet navn",
      });

      const locks = calls.filter((call) => call.sql.includes("FOR UPDATE"));
      expect(locks[0].sql).toContain("workspace_project_participants");
      expect(locks[1].sql).toContain("workspace_participant_documents");
      expect(locks[2].sql).toContain("workspace_participant_document_signers");
      expect(first.already).toBe(false);
      expect(second.already).toBe(true);
      expect(state.participant.guardian_status).toBe("approved");
      expect(state.participant.version).toBe(8);

      const participantUpdates = calls.filter((call) =>
        call.sql.startsWith("UPDATE workspace_project_participants"),
      );
      expect(participantUpdates).toHaveLength(1);
      expect(participantUpdates[0].sql).toMatch(
        /guardian_status\s*=\s*'approved'/,
      );
      expect(participantUpdates[0].sql).toContain("version = version + 1");
      expect(participantUpdates[0].sql).toContain(
        "guardian_status IN ('required', 'pending')",
      );
      expect(
        `${participantUpdates[0].sql} ${JSON.stringify(participantUpdates[0].params)}`,
      ).toContain("workspace-email-link-holder");

      const guardianEvents = calls.filter((call) =>
        call.sql.includes("'guardian_approval_recorded'"),
      );
      expect(guardianEvents).toHaveLength(1);
      expect(guardianEvents[0].sql).toContain("'email_link_holder'");
      expect(guardianEvents[0].params.slice(0, 5)).toEqual([
        "org-1",
        "project-1",
        PARTICIPANT_ID,
        DOCUMENT_ID,
        SIGNER_ID,
      ]);
      expect(JSON.parse(String(guardianEvents[0].params[5]))).toMatchObject({
        actorContext: "email_link_holder",
        assuranceLevel: "email_link_possession",
        signerRole: "guardian",
        guardianStatus: "approved",
      });
      expect(state.signer.signature_evidence).toMatchObject({
        actorContext: "email_link_holder",
        assuranceLevel: "email_link_possession",
        signerRole: "guardian",
      });
      const signedEvent = calls.find((call) =>
        call.sql.includes("'document_signed'"),
      );
      expect(signedEvent?.sql).toContain("'email_link_holder'");
      expect(JSON.parse(String(signedEvent?.params[5]))).toMatchObject({
        actorContext: "email_link_holder",
        assuranceLevel: "email_link_possession",
        signerRole: "guardian",
      });
      expect(
        calls.filter((call) => /^(UPDATE|INSERT)/.test(call.sql)),
      ).toHaveLength(writesAfterFirst);
    },
  );

  it.each(["approved", "rejected", "not_required"] as const)(
    "preserves guardian status %s while allowing the legal signature",
    async (guardianStatus) => {
      const { db, calls, state } = guardianSigningDb({
        documentType: "media_consent",
        guardianStatus,
      });
      const result = await signWorkspaceParticipantDocument(
        db as never,
        signInput,
      );
      expect(result.already).toBe(false);
      expect(state.participant.guardian_status).toBe(guardianStatus);
      expect(state.participant.version).toBe(7);
      expect(
        calls.some((call) =>
          call.sql.startsWith("UPDATE workspace_project_participants"),
        ),
      ).toBe(false);
      expect(
        calls.some((call) => call.sql.includes("'guardian_approval_recorded'")),
      ).toBe(false);
      expect(calls.some((call) => call.sql.includes("'document_signed'"))).toBe(
        true,
      );
    },
  );

  it("fails atomically when the scoped guardian compare-and-set loses", async () => {
    const { db, calls } = guardianSigningDb({
      documentType: "contract",
      guardianStatus: "required",
      guardianUpdateRowCount: 0,
    });
    await expect(
      signWorkspaceParticipantDocument(db as never, signInput),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "document_sign_conflict",
    });
    expect(
      calls.some((call) => call.sql.includes("'guardian_approval_recorded'")),
    ).toBe(false);
    expect(calls.some((call) => call.sql.includes("'document_signed'"))).toBe(
      false,
    );
  });

  it("uses the same public not-found error when preflight cannot validate the credential", async () => {
    const { db, calls } = guardianSigningDb({
      documentType: "contract",
      guardianStatus: "pending",
      preflightFound: false,
    });
    await expect(
      signWorkspaceParticipantDocument(db as never, signInput),
    ).rejects.toMatchObject({ statusCode: 404, code: "document_not_found" });
    expect(calls.some((call) => call.sql.includes("FOR UPDATE"))).toBe(false);
    expect(calls.some((call) => /^(UPDATE|INSERT)/.test(call.sql))).toBe(false);
  });
});
