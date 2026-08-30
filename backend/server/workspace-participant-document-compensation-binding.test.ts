import { describe, expect, it, vi } from "vitest";
import type {
  WorkspaceParticipantCompensationSnapshot,
  WorkspaceParticipantLegalSnapshot,
} from "../../frontend/shared/workspace-participant-documents.ts";
import {
  hashWorkspaceParticipantCompensationPublicTerms,
  hashWorkspaceParticipantDocumentToken,
  hashWorkspaceParticipantLegalSnapshot,
  issueWorkspaceParticipantDocument,
  reissueWorkspaceParticipantDocumentToken,
  signWorkspaceParticipantDocument,
  viewWorkspaceParticipantDocument,
  withdrawWorkspaceParticipantMediaConsent,
} from "./workspace-participant-documents-service.js";

const DOCUMENT_ID = "11111111-1111-4111-8111-111111111111";
const PARTICIPANT_ID = "22222222-2222-4222-8222-222222222222";
const SIGNER_ID = "33333333-3333-4333-8333-333333333333";
const COMPENSATION_ID = "44444444-4444-4444-8444-444444444444";
const SHEET_ID = "55555555-5555-4555-8555-555555555555";
const CONTRIBUTOR_ID = "66666666-6666-4666-8666-666666666666";
const TOKEN_HASH = hashWorkspaceParticipantDocumentToken("A".repeat(43));
const NOW = new Date("2026-08-30T10:00:00.000Z");

function participant(overrides: Record<string, unknown> = {}) {
  return {
    id: PARTICIPANT_ID,
    organization_id: "org-1",
    project_id: "project-1",
    project_owner_user_id: "owner-1",
    display_name: "Kari Nordmann",
    email: "kari@example.test",
    role_label: "Statist",
    is_minor: false,
    guardian_status: "not_required",
    workflow_status: "confirmed",
    requires_compensation: true,
    version: 1,
    archived_at: null,
    project_title: "Reklamefilm",
    producer_user_id: "owner-1",
    producer_email: "owner@example.test",
    producer_name: "Produsent",
    producer_company_name: "Studio",
    ...overrides,
  };
}

function hourlyLink() {
  return {
    id: COMPENSATION_ID,
    organization_id: "org-1",
    project_id: "project-1",
    project_owner_user_id: "owner-1",
    participant_id: PARTICIPANT_ID,
    split_sheet_id: SHEET_ID,
    contributor_id: CONTRIBUTOR_ID,
    compensation_type: "hourly",
    hourly_rate: "750.00",
    estimated_hours: "8.00",
    day_rate: null,
    fixed_amount: null,
    share_percentage: null,
    currency: "NOK",
    status: "active",
    version: 3,
    terms_snapshot: {
      source: "workspace-participant-compensation",
      workspaceProjectId: "project-1",
      workspaceParticipantId: PARTICIPANT_ID,
      workspaceCompensationId: COMPENSATION_ID,
      compensationVersion: 3,
      compensationType: "hourly",
      hourlyRate: 750,
      estimatedHours: 8,
      fixedAmount: null,
      estimatedAmount: 6000,
      currency: "NOK",
      note: "Kveldsskift",
    },
  };
}

function unpaidLink() {
  return {
    ...hourlyLink(),
    split_sheet_id: null,
    contributor_id: null,
    compensation_type: "unpaid",
    hourly_rate: null,
    estimated_hours: null,
    version: 2,
    terms_snapshot: {
      source: "workspace-participant-compensation",
      workspaceProjectId: "project-1",
      workspaceParticipantId: PARTICIPANT_ID,
      workspaceCompensationId: COMPENSATION_ID,
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
  documentType: "contract" | "media_consent",
  compensation: WorkspaceParticipantCompensationSnapshot | null,
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
    project: {
      id: "project-1",
      title: "Reklamefilm",
      organizationId: "org-1",
    },
    producer: {
      userId: "owner-1",
      name: "Produsent",
      email: "owner@example.test",
      companyName: "Studio",
    },
    participant: {
      id: PARTICIPANT_ID,
      name: "Kari Nordmann",
      email: "kari@example.test",
      role: "Statist",
      isMinor: false,
    },
    signer: {
      role: "participant",
      name: "Kari Nordmann",
      email: "kari@example.test",
      guardianRelationship: null,
    },
    acceptance: {
      version: "workspace-participant-legal-acceptance-v1",
      text: "Jeg godtar vilkårene.",
    },
    compensation,
    terms:
      documentType === "contract"
        ? {
            kind: "contract",
            workDescription: "Én opptaksdag",
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

describe("Workspace participant contract compensation binding", () => {
  it("derives paid terms after participant→link→sheet→sole contributor locks", async () => {
    const calls: Array<{ sql: string; params: unknown[] }> = [];
    let stored: WorkspaceParticipantLegalSnapshot | undefined;
    let eventPayload: Record<string, unknown> | undefined;
    const query = vi.fn(async (sqlValue: unknown, params: unknown[] = []) => {
      const sql = String(sqlValue).replace(/\s+/g, " ").trim();
      calls.push({ sql, params });
      if (sql.startsWith("SELECT participant.id::text")) {
        return { rowCount: 1, rows: [participant()] };
      }
      if (sql.startsWith("SELECT link.*")) {
        return { rowCount: 1, rows: [hourlyLink()] };
      }
      if (sql.startsWith("SELECT sheet.*")) {
        return {
          rowCount: 1,
          rows: [
            {
              id: SHEET_ID,
              project_id: "project-1",
              user_id: "owner-1",
              status: "draft",
              access_code: null,
              pin: null,
              password: null,
              security_enabled: false,
              require_pin_for_signature: false,
              require_password_for_signature: false,
              track_id: null,
              total_percentage: 0,
              metadata: {
                agreementVersion: 1,
                visibility: "private",
                source: "workspace-participant-compensation",
                workspaceOrganizationId: "org-1",
                workspaceProjectId: "project-1",
                workspaceParticipantId: PARTICIPANT_ID,
                workspaceCompensationId: COMPENSATION_ID,
                compensationVersion: 3,
                currency: "NOK",
                projectAmount: 6000,
              },
            },
          ],
        };
      }
      if (sql.startsWith("SELECT contributor.*")) {
        return {
          rowCount: 1,
          rows: [
            {
              id: CONTRIBUTOR_ID,
              user_id: null,
              signed_at: null,
              signature_data: null,
              invitation_sent_at: null,
              invitation_status: "not_sent",
              contributor_pin: null,
              contributor_password: null,
              percentage: 0,
              custom_fields: {
                externalParticipant: true,
                workspaceProjectId: "project-1",
                workspaceParticipantId: PARTICIPANT_ID,
                workspaceCompensationId: COMPENSATION_ID,
                compensationVersion: 3,
                compensationType: "hourly",
                currency: "NOK",
                hourlyRate: 750,
                estimatedHours: 8,
                estimatedAmount: 6000,
              },
            },
          ],
        };
      }
      if (sql.startsWith("SELECT access_entry.contributor_id")) {
        return { rowCount: 0, rows: [] };
      }
      if (sql.startsWith("SELECT id::text, version, status")) {
        return { rowCount: 0, rows: [] };
      }
      if (sql.startsWith("INSERT INTO workspace_participant_documents")) {
        stored = JSON.parse(String(params[7]));
        return { rowCount: 1, rows: [] };
      }
      if (
        sql.startsWith("INSERT INTO workspace_participant_document_signers")
      ) {
        return { rowCount: 1, rows: [{ id: SIGNER_ID }] };
      }
      if (
        sql.startsWith("UPDATE workspace_participant_documents") &&
        sql.includes("status = 'issued'")
      ) {
        return { rowCount: 1, rows: [] };
      }
      if (sql.startsWith("INSERT INTO workspace_participant_events")) {
        eventPayload = JSON.parse(String(params[6]));
        return { rowCount: 1, rows: [] };
      }
      if (sql.startsWith("SELECT document.*")) {
        return {
          rowCount: 1,
          rows: [
            {
              id: DOCUMENT_ID,
              participant_id: PARTICIPANT_ID,
              document_type: "contract",
              status: "issued",
              version: 1,
              title: "Kontrakt",
              content_hash: "a".repeat(64),
              supersedes_document_id: null,
              issued_at: NOW,
              expires_at: null,
              signed_at: null,
              withdrawn_at: null,
              created_at: NOW,
              updated_at: NOW,
              signer_id: SIGNER_ID,
              signer_role: "participant",
              signer_name: "Kari Nordmann",
              signer_email: "kari@example.test",
              signer_status: "pending",
              token_expires_at: NOW,
              token_revoked_at: null,
              signer_signed_at: null,
              delivery_event_type: null,
              delivery_payload: null,
              delivery_occurred_at: null,
            },
          ],
        };
      }
      throw new Error("Unexpected SQL: " + sql);
    });

    await issueWorkspaceParticipantDocument({ query } as never, {
      scope: {
        organizationId: "org-1",
        projectId: "project-1",
        participantId: PARTICIPANT_ID,
      },
      projectOwnerUserId: "owner-1",
      actorUserId: "manager-1",
      issue: {
        documentType: "contract",
        terms: { workDescription: "Én opptaksdag", role: "Statist" },
      },
      runtime: {
        now: () => NOW,
        randomBytes: (size: number) => Buffer.alloc(size, 7),
        randomUUID: () => DOCUMENT_ID,
        tokenSigningSecret: "workspace-participant-binding-test-token-secret-v1",
      },
    });

    expect(calls.slice(0, 6).map((call) => call.sql)).toEqual([
      expect.stringMatching(/workspace_project_participants.*FOR UPDATE/),
      expect.stringMatching(/compensation_links.*FOR UPDATE OF link/),
      expect.stringMatching(/split_sheets.*FOR UPDATE/),
      expect.stringMatching(/split_sheet_contributors.*FOR UPDATE/),
      expect.stringMatching(/split_sheet_contributor_access/),
      expect.stringMatching(/workspace_participant_documents.*FOR UPDATE/),
    ]);
    const bound = stored?.compensation;
    expect(bound).toMatchObject({
      id: COMPENSATION_ID,
      version: 3,
      type: "hourly",
      hourlyRate: 750,
      estimatedHours: 8,
      estimatedAmount: 6000,
      currency: "NOK",
      note: "Kveldsskift",
    });
    expect(bound?.publicTermsHash).toBe(
      hashWorkspaceParticipantCompensationPublicTerms({
        id: COMPENSATION_ID,
        version: 3,
        type: "hourly",
        hourlyRate: 750,
        estimatedHours: 8,
        fixedAmount: null,
        estimatedAmount: 6000,
        currency: "NOK",
        note: "Kveldsskift",
      }),
    );
    expect(eventPayload).toMatchObject({
      compensationId: COMPENSATION_ID,
      compensationVersion: 3,
      compensationPublicTermsHash: bound?.publicTermsHash,
    });
  });

  it("fails with 409 before document locking when required compensation is missing", async () => {
    const calls: string[] = [];
    const query = vi.fn(async (sqlValue: unknown) => {
      const sql = String(sqlValue).replace(/\s+/g, " ").trim();
      calls.push(sql);
      if (sql.startsWith("SELECT participant.id::text")) {
        return { rowCount: 1, rows: [participant()] };
      }
      if (sql.startsWith("SELECT link.*")) {
        return { rowCount: 0, rows: [] };
      }
      throw new Error("Unexpected SQL: " + sql);
    });
    await expect(
      issueWorkspaceParticipantDocument({ query } as never, {
        scope: {
          organizationId: "org-1",
          projectId: "project-1",
          participantId: PARTICIPANT_ID,
        },
        projectOwnerUserId: "owner-1",
        actorUserId: "manager-1",
        issue: {
          documentType: "contract",
          terms: { workDescription: "Opptak", role: "Statist" },
        },
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "participant_compensation_required",
    });
    expect(
      calls.some((sql) => sql.includes("workspace_participant_documents")),
    ).toBe(false);
  });

  it.each(["view", "sign", "reissue"] as const)(
    "blocks stale pending contract %s with 410 before writes",
    async (operation) => {
      const embeddedTerms = {
        id: "77777777-7777-4777-8777-777777777777",
        version: 1,
        type: "unpaid" as const,
        hourlyRate: null,
        estimatedHours: null,
        fixedAmount: null,
        estimatedAmount: null,
        currency: "NOK",
        note: null,
      };
      const embedded = {
        ...embeddedTerms,
        publicTermsHash:
          hashWorkspaceParticipantCompensationPublicTerms(embeddedTerms),
      };
      const snapshot = legalSnapshot("contract", embedded);
      const document = {
        id: DOCUMENT_ID,
        organization_id: "org-1",
        project_id: "project-1",
        participant_id: PARTICIPANT_ID,
        document_type: "contract",
        status: "issued",
        version: 1,
        title: "Kontrakt",
        terms_snapshot: snapshot,
        content_hash: hashWorkspaceParticipantLegalSnapshot(snapshot),
        issued_at: snapshot.document.issuedAt,
        signed_at: null,
        withdrawn_at: null,
      };
      const signer = {
        id: SIGNER_ID,
        signer_role: "participant",
        signer_name: "Kari Nordmann",
        signer_email: "kari@example.test",
        status: "pending",
        signing_token_hash: TOKEN_HASH,
        token_expires_at: "2027-08-30T10:00:00.000Z",
        token_revoked_at: null,
      };
      const calls: string[] = [];
      const query = vi.fn(async (sqlValue: unknown) => {
        const sql = String(sqlValue).replace(/\s+/g, " ").trim();
        calls.push(sql);
        if (sql.startsWith("SELECT document_type")) {
          return { rowCount: 1, rows: [{ document_type: "contract" }] };
        }
        if (
          sql.startsWith("SELECT document.organization_id") &&
          sql.includes("JOIN workspace_participant_document_signers")
        ) {
          return {
            rowCount: 1,
            rows: [
              {
                organization_id: "org-1",
                project_id: "project-1",
                participant_id: PARTICIPANT_ID,
                document_type: "contract",
              },
            ],
          };
        }
        if (sql.startsWith("SELECT participant.id::text")) {
          return { rowCount: 1, rows: [participant()] };
        }
        if (sql.startsWith("SELECT link.*")) {
          return { rowCount: 1, rows: [unpaidLink()] };
        }
        if (sql.startsWith("SELECT * FROM workspace_participant_documents")) {
          return { rowCount: 1, rows: [document] };
        }
        if (
          sql.startsWith("SELECT * FROM workspace_participant_document_signers")
        ) {
          return { rowCount: 1, rows: [signer] };
        }
        throw new Error("Unexpected SQL: " + sql);
      });
      const db = { query } as never;
      const action =
        operation === "view"
          ? viewWorkspaceParticipantDocument(db, {
              documentId: DOCUMENT_ID,
              tokenHash: TOKEN_HASH,
              ip: null,
              runtime: { now: () => NOW },
            })
          : operation === "sign"
            ? signWorkspaceParticipantDocument(db, {
                documentId: DOCUMENT_ID,
                tokenHash: TOKEN_HASH,
                signerName: "Kari Nordmann",
                accepted: true,
                signatureMethod: "typed",
                ip: null,
                userAgent: null,
                runtime: { now: () => NOW },
              })
            : reissueWorkspaceParticipantDocumentToken(db, {
                organizationId: "org-1",
                projectId: "project-1",
                participantId: PARTICIPANT_ID,
                documentId: DOCUMENT_ID,
                actorUserId: "manager-1",
                runtime: { now: () => NOW },
              });

      await expect(action).rejects.toMatchObject({
        statusCode: 410,
        code: "document_compensation_stale",
      });
      expect(calls.slice(0, 5)).toEqual([
        expect.stringMatching(
          operation === "reissue"
            ? /SELECT document_type/
            : /JOIN workspace_participant_document_signers/,
        ),
        expect.stringMatching(/workspace_project_participants.*FOR UPDATE/),
        expect.stringMatching(/compensation_links.*FOR UPDATE OF link/),
        expect.stringMatching(/workspace_participant_documents.*FOR UPDATE/),
        expect.stringMatching(
          /workspace_participant_document_signers.*FOR UPDATE/,
        ),
      ]);
      expect(calls.some((sql) => /^(UPDATE|INSERT)/.test(sql))).toBe(false);
    },
  );

  it("keeps signed media consent viewable and withdrawable after archive", async () => {
    const snapshot = legalSnapshot("media_consent", null);
    const document: Record<string, unknown> = {
      id: DOCUMENT_ID,
      organization_id: "org-1",
      project_id: "project-1",
      participant_id: PARTICIPANT_ID,
      document_type: "media_consent",
      status: "signed",
      version: 1,
      title: "Mediesamtykke",
      terms_snapshot: snapshot,
      content_hash: hashWorkspaceParticipantLegalSnapshot(snapshot),
      issued_at: snapshot.document.issuedAt,
      signed_at: "2026-08-29T11:00:00.000Z",
      withdrawn_at: null,
    };
    const signer = {
      id: SIGNER_ID,
      signer_role: "participant",
      signer_name: "Kari Nordmann",
      signer_email: "kari@example.test",
      status: "signed",
      signing_token_hash: TOKEN_HASH,
      token_expires_at: null,
      token_revoked_at: null,
      signed_at: "2026-08-29T11:00:00.000Z",
    };
    const calls: string[] = [];
    const query = vi.fn(async (sqlValue: unknown) => {
      const sql = String(sqlValue).replace(/\s+/g, " ").trim();
      calls.push(sql);
      if (
        sql.startsWith("SELECT document.organization_id") &&
        sql.includes("JOIN workspace_participant_document_signers")
      ) {
        return {
          rowCount: 1,
          rows: [
            {
              organization_id: "org-1",
              project_id: "project-1",
              participant_id: PARTICIPANT_ID,
              document_type: "media_consent",
            },
          ],
        };
      }
      if (sql.startsWith("SELECT participant.id::text")) {
        return {
          rowCount: 1,
          rows: [
            participant({
              workflow_status: "archived",
              archived_at: "2026-08-30T09:00:00.000Z",
            }),
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
      if (
        sql.startsWith("UPDATE workspace_participant_documents") &&
        sql.includes("status = 'withdrawn'")
      ) {
        document.status = "withdrawn";
        document.withdrawn_at = NOW.toISOString();
        return { rowCount: 1, rows: [] };
      }
      if (sql.startsWith("INSERT INTO workspace_participant_events")) {
        return { rowCount: 1, rows: [] };
      }
      throw new Error("Unexpected SQL: " + sql);
    });
    const db = { query } as never;

    const viewed = await viewWorkspaceParticipantDocument(db, {
      documentId: DOCUMENT_ID,
      tokenHash: TOKEN_HASH,
      ip: null,
      runtime: { now: () => NOW },
    });
    expect(viewed.status).toBe("signed");
    expect(viewed.canWithdraw).toBe(true);

    const withdrawn = await withdrawWorkspaceParticipantMediaConsent(db, {
      documentId: DOCUMENT_ID,
      tokenHash: TOKEN_HASH,
      confirmed: true,
      reason: "Trekkes tilbake",
      ip: null,
      userAgent: null,
      runtime: { now: () => NOW },
    });
    expect(withdrawn.document.status).toBe("withdrawn");
    expect(calls.some((sql) => sql.includes("compensation_links"))).toBe(false);
  });
});
