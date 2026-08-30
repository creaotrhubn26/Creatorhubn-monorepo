import { describe, expect, it, vi } from "vitest";
import type { WorkspaceParticipantLegalSnapshot } from "../../frontend/shared/workspace-participant-documents.ts";
import {
  buildWorkspaceParticipantDocumentPortalUrl,
  canonicalizeWorkspaceParticipantLegalSnapshot,
  generateWorkspaceParticipantDocumentToken,
  hashWorkspaceParticipantDocumentToken,
  hashWorkspaceParticipantLegalSnapshot,
  signWorkspaceParticipantDocument,
  verifyWorkspaceParticipantDocumentToken,
  viewWorkspaceParticipantDocument,
  withdrawWorkspaceParticipantMediaConsent,
} from "./workspace-participant-documents-service.js";

const DOCUMENT_ID = "11111111-1111-4111-8111-111111111111";
const PARTICIPANT_ID = "22222222-2222-4222-8222-222222222222";
const SIGNER_ID = "33333333-3333-4333-8333-333333333333";
const TOKEN = "A".repeat(43);
const TOKEN_HASH = hashWorkspaceParticipantDocumentToken(TOKEN);
const NOW = new Date("2026-08-30T10:00:00.000Z");

function snapshot(
  type: "contract" | "media_consent" = "media_consent",
): WorkspaceParticipantLegalSnapshot {
  return {
    schemaVersion: 1,
    document: {
      id: DOCUMENT_ID,
      type,
      version: 1,
      title: type === "contract" ? "Kontrakt" : "Samtykke",
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
    terms:
      type === "contract"
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

function rowsFor(
  type: "contract" | "media_consent",
  status: "issued" | "signed" | "withdrawn" = "issued",
) {
  const terms = snapshot(type);
  const document: any = {
    id: DOCUMENT_ID,
    organization_id: "org-1",
    project_id: "project-1",
    participant_id: PARTICIPANT_ID,
    document_type: type,
    status,
    version: 1,
    title: terms.document.title,
    terms_snapshot: terms,
    content_hash: hashWorkspaceParticipantLegalSnapshot(terms),
    issued_at: terms.document.issuedAt,
    signed_at: status === "issued" ? null : "2026-08-29T11:00:00.000Z",
    withdrawn_at: status === "withdrawn" ? "2026-08-29T12:00:00.000Z" : null,
  };
  const evidence = {
    immutable: true,
    documentContentHash: document.content_hash,
  };
  const signer: any = {
    id: SIGNER_ID,
    organization_id: "org-1",
    project_id: "project-1",
    participant_id: PARTICIPANT_ID,
    document_id: DOCUMENT_ID,
    signer_role: "participant",
    signer_name: "Kari Nordmann",
    signer_email: "kari@example.test",
    status: status === "issued" ? "pending" : "signed",
    signing_token_hash: TOKEN_HASH,
    token_issued_at: "2026-08-29T10:00:00.000Z",
    token_expires_at:
      type === "media_consent" && status !== "issued"
        ? null
        : "2027-08-29T10:00:00.000Z",
    token_revoked_at: null,
    token_used_at: status === "issued" ? null : "2026-08-29T11:00:00.000Z",
    signed_at: status === "issued" ? null : "2026-08-29T11:00:00.000Z",
    signature_evidence: status === "issued" ? null : evidence,
  };
  return { document, signer, evidence };
}

function signingDb(state: ReturnType<typeof rowsFor>) {
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
      return {
        rowCount: 1,
        rows: [
          {
            organization_id: "org-1",
            project_id: "project-1",
            participant_id: PARTICIPANT_ID,
          },
        ],
      };
    }
    if (
      sql.startsWith("SELECT") &&
      sql.includes("FROM workspace_project_participants") &&
      sql.includes("FOR UPDATE")
    ) {
      return {
        rowCount: 1,
        rows: [
          {
            id: PARTICIPANT_ID,
            organization_id: "org-1",
            project_id: "project-1",
            is_minor: false,
            guardian_status: "not_required",
            version: 1,
            archived_at: null,
          },
        ],
      };
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
      state.signer.token_used_at = params[5];
      state.signer.signed_at = params[5];
      state.signer.signature_evidence = JSON.parse(String(params[6]));
      return { rowCount: 1, rows: [] };
    }
    if (
      sql.startsWith("UPDATE workspace_participant_documents") &&
      sql.includes("status = 'viewed'")
    ) {
      state.document.status = "viewed";
      return { rowCount: 1, rows: [] };
    }
    if (
      sql.startsWith("UPDATE workspace_participant_documents") &&
      sql.includes("status = 'signed'")
    ) {
      state.document.status = "signed";
      state.document.signed_at = params[4];
      return { rowCount: 1, rows: [] };
    }
    if (
      sql.startsWith("UPDATE workspace_participant_documents") &&
      sql.includes("status = 'withdrawn'")
    ) {
      state.document.status = "withdrawn";
      state.document.withdrawn_at = params[4];
      return { rowCount: 1, rows: [] };
    }
    if (sql.startsWith("INSERT INTO workspace_participant_events")) {
      return { rowCount: 1, rows: [] };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  });
  return { db: { query }, calls };
}

describe("Workspace participant document canonicalization", () => {
  it("hashes equivalent key order identically and binds every changed term", () => {
    const left = { z: [3, { b: "B", a: "A" }], a: "e\u0301" };
    const right = { a: "é", z: [3, { a: "A", b: "B" }] };
    expect(canonicalizeWorkspaceParticipantLegalSnapshot(left)).toBe(
      canonicalizeWorkspaceParticipantLegalSnapshot(right),
    );
    expect(hashWorkspaceParticipantLegalSnapshot(left)).toBe(
      hashWorkspaceParticipantLegalSnapshot(right),
    );
    expect(
      hashWorkspaceParticipantLegalSnapshot({ ...right, a: "annet" }),
    ).not.toBe(hashWorkspaceParticipantLegalSnapshot(right));
  });

  it("generates a 32-byte fragment credential and stores only its digest", () => {
    const runtime = {
      randomBytes: (size: number) => Buffer.alloc(size, 7),
      tokenSigningSecret: "workspace-participant-service-test-token-secret-v1",
    };
    const raw = generateWorkspaceParticipantDocumentToken(DOCUMENT_ID, {
      ...runtime,
    });
    const digest = hashWorkspaceParticipantDocumentToken(raw);
    const url = buildWorkspaceParticipantDocumentPortalUrl(
      "https://creatorhubn.com/",
      DOCUMENT_ID,
      raw,
    );
    expect(raw).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(digest).not.toContain(raw);
    expect(url).toContain(`#token=${raw}`);
    expect(url).not.toContain(`?token=${raw}`);
    expect(
      verifyWorkspaceParticipantDocumentToken(
        DOCUMENT_ID.toUpperCase(),
        raw,
        runtime,
      ),
    ).toBe(true);
    expect(
      verifyWorkspaceParticipantDocumentToken(
        "99999999-9999-4999-8999-999999999999",
        raw,
        runtime,
      ),
    ).toBe(false);
    const tampered = `${raw.slice(0, 10)}${raw[10] === "A" ? "B" : "A"}${raw.slice(11)}`;
    expect(
      verifyWorkspaceParticipantDocumentToken(DOCUMENT_ID, tampered, runtime),
    ).toBe(false);
    expect(
      verifyWorkspaceParticipantDocumentToken(DOCUMENT_ID, raw, {
        tokenSigningSecret: "a-different-test-token-secret-value-v1",
      }),
    ).toBe(false);
  });

  it("fails closed when no document token signing secret is configured", () => {
    vi.stubEnv("WORKSPACE_PARTICIPANT_DOCUMENT_TOKEN_SECRET", "");
    vi.stubEnv("SESSION_SECRET", "");
    expect(() =>
      generateWorkspaceParticipantDocumentToken(DOCUMENT_ID, {
        randomBytes: (size) => Buffer.alloc(size, 7),
      }),
    ).toThrow("workspace_document_token_secret_missing");
    vi.unstubAllEnvs();
  });
});

describe("Workspace participant document legal mutations", () => {
  it("locks document before signer and makes repeat signing evidence-immutable", async () => {
    const state = rowsFor("media_consent", "issued");
    const { db, calls } = signingDb(state);

    const first = await signWorkspaceParticipantDocument(db as never, {
      documentId: DOCUMENT_ID,
      tokenHash: TOKEN_HASH,
      signerName: "  KARI   NORDMANN ",
      accepted: true,
      signatureMethod: "typed",
      ip: "192.0.2.10",
      userAgent: "Vitest",
      runtime: { now: () => NOW },
    });
    const evidenceAfterFirst = structuredClone(state.signer.signature_evidence);
    const writesAfterFirst = calls.filter((call) =>
      /^(UPDATE|INSERT)/.test(call.sql),
    ).length;

    const second = await signWorkspaceParticipantDocument(db as never, {
      documentId: DOCUMENT_ID,
      tokenHash: TOKEN_HASH,
      signerName: "Forsøk på nytt navn",
      accepted: true,
      signatureMethod: "typed",
      ip: "198.51.100.20",
      userAgent: "Retry",
      runtime: { now: () => new Date("2026-08-30T11:00:00.000Z") },
    });

    expect(calls[0].sql).toMatch(/JOIN workspace_participant_document_signers/);
    expect(calls[1].sql).toMatch(/workspace_project_participants.*FOR UPDATE/);
    expect(calls[2].sql).toMatch(/workspace_participant_documents.*FOR UPDATE/);
    expect(calls[3].sql).toMatch(
      /workspace_participant_document_signers.*FOR UPDATE/,
    );
    expect(first.already).toBe(false);
    expect(second.already).toBe(true);
    expect(state.signer.signature_evidence).toEqual(evidenceAfterFirst);
    expect(
      calls.filter((call) => /^(UPDATE|INSERT)/.test(call.sql)),
    ).toHaveLength(writesAfterFirst);
    expect(state.signer.signing_token_hash).toBe(TOKEN_HASH);
    expect(evidenceAfterFirst.documentContentHash).toBe(
      state.document.content_hash,
    );
    expect(evidenceAfterFirst).toMatchObject({
      actorContext: "email_link_holder",
      assuranceLevel: "email_link_possession",
      signerRole: "participant",
    });
    const signedEvent = calls.find((call) =>
      call.sql.includes("'document_signed'"),
    );
    expect(signedEvent?.sql).toContain("'email_link_holder'");
    expect(JSON.parse(String(signedEvent?.params[5]))).toMatchObject({
      actorContext: "email_link_holder",
      assuranceLevel: "email_link_possession",
      signerRole: "participant",
    });
  });

  it("attributes first view to possession of the signer email link", async () => {
    const state = rowsFor("media_consent", "issued");
    const { db, calls } = signingDb(state);

    const document = await viewWorkspaceParticipantDocument(db as never, {
      documentId: DOCUMENT_ID,
      tokenHash: TOKEN_HASH,
      ip: "192.0.2.30",
      runtime: { now: () => NOW },
    });

    expect(document.status).toBe("viewed");
    const viewedEvent = calls.find((call) =>
      call.sql.includes("'document_viewed'"),
    );
    expect(viewedEvent?.sql).toContain("'email_link_holder'");
    expect(JSON.parse(String(viewedEvent?.params[5]))).toMatchObject({
      actorContext: "email_link_holder",
      assuranceLevel: "email_link_possession",
      signerRole: "participant",
    });
  });

  it("rejects contract withdrawal before any write", async () => {
    const state = rowsFor("contract", "signed");
    const { db, calls } = signingDb(state);
    await expect(
      withdrawWorkspaceParticipantMediaConsent(db as never, {
        documentId: DOCUMENT_ID,
        tokenHash: TOKEN_HASH,
        confirmed: true,
        reason: "Ikke lenger ønsket",
        ip: null,
        userAgent: null,
        runtime: { now: () => NOW },
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "document_not_withdrawable",
    });
    expect(calls.some((call) => call.sql.startsWith("UPDATE"))).toBe(false);
  });

  it("withdraws media consent once and preserves the signed evidence on retries", async () => {
    const state = rowsFor("media_consent", "signed");
    const originalEvidence = structuredClone(state.signer.signature_evidence);
    const { db, calls } = signingDb(state);
    const first = await withdrawWorkspaceParticipantMediaConsent(db as never, {
      documentId: DOCUMENT_ID,
      tokenHash: TOKEN_HASH,
      confirmed: true,
      reason: "Trekkes tilbake",
      ip: "192.0.2.20",
      userAgent: "Vitest",
      runtime: { now: () => NOW },
    });
    const second = await withdrawWorkspaceParticipantMediaConsent(db as never, {
      documentId: DOCUMENT_ID,
      tokenHash: TOKEN_HASH,
      confirmed: true,
      reason: "Et annet forsøk",
      ip: "192.0.2.21",
      userAgent: "Retry",
      runtime: { now: () => new Date("2026-08-30T12:00:00.000Z") },
    });
    expect(first.already).toBe(false);
    expect(second.already).toBe(true);
    expect(
      calls.filter((call) => call.sql.includes("SET status = 'withdrawn'")),
    ).toHaveLength(1);
    expect(state.signer.signature_evidence).toEqual(originalEvidence);
    const withdrawnEvent = calls.find((call) =>
      call.sql.includes("'media_consent_withdrawn'"),
    );
    expect(withdrawnEvent?.sql).toContain("'email_link_holder'");
    expect(JSON.parse(String(withdrawnEvent?.params[5]))).toMatchObject({
      actorContext: "email_link_holder",
      assuranceLevel: "email_link_possession",
      signerRole: "participant",
    });
  });

  it("fails closed when the persisted terms no longer match their content hash", async () => {
    const state = rowsFor("media_consent", "issued");
    state.document.terms_snapshot.terms.duration = "Endret etter utsendelse";
    const { db, calls } = signingDb(state);
    await expect(
      signWorkspaceParticipantDocument(db as never, {
        documentId: DOCUMENT_ID,
        tokenHash: TOKEN_HASH,
        signerName: "Kari Nordmann",
        accepted: true,
        signatureMethod: "typed",
        ip: null,
        userAgent: null,
        runtime: { now: () => NOW },
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "document_integrity_violation",
    });
    expect(calls.some((call) => call.sql.startsWith("UPDATE"))).toBe(false);
  });
});
