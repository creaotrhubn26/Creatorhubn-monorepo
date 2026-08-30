import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createWorkspaceParticipantDocumentCredentialRateLimit,
  setupWorkspaceParticipantDocumentRoutes,
  WORKSPACE_PARTICIPANT_DOCUMENT_PUBLIC_PATH,
  WORKSPACE_PARTICIPANT_DOCUMENT_TOKEN_HEADER,
} from "./workspace-participant-documents-routes.js";
import {
  issueWorkspaceParticipantDocument,
  generateWorkspaceParticipantDocumentToken,
  WorkspaceParticipantDocumentError,
} from "./workspace-participant-documents-service.js";

const DOCUMENT_ID = "11111111-1111-4111-8111-111111111111";
const PARTICIPANT_ID = "22222222-2222-4222-8222-222222222222";
const SIGNER_ID = "33333333-3333-4333-8333-333333333333";
const TOKEN_RUNTIME = {
  tokenSigningSecret: "workspace-participant-audit-test-token-secret-v1",
};
const TOKEN = generateWorkspaceParticipantDocumentToken(DOCUMENT_ID, {
  ...TOKEN_RUNTIME,
  randomBytes: (size) => Buffer.alloc(size, 1),
});
const NOW = new Date("2026-08-30T10:00:00.000Z");

afterEach(() => {
  vi.unstubAllEnvs();
});

const migration = readFileSync(
  fileURLToPath(
    new URL(
      "../migrations/0468_workspace_participant_document_lifecycle.sql",
      import.meta.url,
    ),
  ),
  "utf8",
);
const routesSource = readFileSync(
  fileURLToPath(
    new URL("./workspace-participant-documents-routes.ts", import.meta.url),
  ),
  "utf8",
);

function issueDb(issuedRowCount = 1) {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const query = vi.fn(async (sqlValue: unknown, params: unknown[] = []) => {
    const sql = String(sqlValue).replace(/\s+/g, " ").trim();
    calls.push({ sql, params });
    if (sql.startsWith("SELECT participant.id::text")) {
      return {
        rowCount: 1,
        rows: [
          {
            id: PARTICIPANT_ID,
            display_name: "Kari Nordmann",
            email: "kari@example.test",
            role_label: "Statist",
            is_minor: false,
            archived_at: null,
            project_title: "Reklamefilm",
            producer_user_id: "owner-1",
            producer_email: "owner@example.test",
            producer_name: "Produsent",
            producer_company_name: "Studio",
          },
        ],
      };
    }
    if (
      sql.startsWith("SELECT link.*") &&
      sql.includes("workspace_participant_compensation_links")
    ) {
      return { rowCount: 0, rows: [] };
    }
    if (sql.startsWith("SELECT id::text, version, status")) {
      return { rowCount: 0, rows: [] };
    }
    if (sql.startsWith("INSERT INTO workspace_participant_documents")) {
      return { rowCount: 1, rows: [] };
    }
    if (sql.startsWith("INSERT INTO workspace_participant_document_signers")) {
      return { rowCount: 1, rows: [{ id: SIGNER_ID }] };
    }
    if (
      sql.startsWith("UPDATE workspace_participant_documents") &&
      sql.includes("status = 'issued'")
    ) {
      return { rowCount: issuedRowCount, rows: [] };
    }
    if (sql.startsWith("INSERT INTO workspace_participant_events")) {
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

const issueInput = {
  scope: {
    organizationId: "org-1",
    projectId: "project-1",
    participantId: PARTICIPANT_ID,
  },
  projectOwnerUserId: "owner-1",
  actorUserId: "admin-real",
  auditPayload: { impersonated: true, effectiveUserId: "owner-1" },
  issue: {
    documentType: "contract" as const,
    title: "Kontrakt",
    terms: { workDescription: "En opptaksdag", role: "Statist" },
  },
  runtime: {
    now: () => NOW,
    randomBytes: (size: number) => Buffer.alloc(size, 7),
    randomUUID: () => DOCUMENT_ID,
    ...TOKEN_RUNTIME,
  },
};

describe("Workspace participant document database regressions", () => {
  it("persists a constraint-valid draft before setting issued_at in the guarded transition", async () => {
    const { db, calls } = issueDb();
    await issueWorkspaceParticipantDocument(db as never, issueInput);

    const draftInsert = calls.find((call) =>
      call.sql.startsWith("INSERT INTO workspace_participant_documents"),
    );
    const issuedUpdate = calls.find(
      (call) =>
        call.sql.startsWith("UPDATE workspace_participant_documents") &&
        call.sql.includes("status = 'issued'"),
    );
    expect(draftInsert?.sql).not.toMatch(/\bissued_at\b/);
    expect(issuedUpdate?.sql).toContain(
      "SET status = 'issued', issued_at = $5",
    );
    expect(issuedUpdate?.params[4]).toBe(NOW.toISOString());
    expect(draftInsert?.params[10]).toBe("admin-real");
    const event = calls.find((call) =>
      call.sql.startsWith("INSERT INTO workspace_participant_events"),
    );
    expect(event?.params[5]).toBe("admin-real");
    expect(JSON.parse(String(event?.params[6]))).toMatchObject({
      impersonated: true,
      effectiveUserId: "owner-1",
    });
  });

  it("fails the transaction-facing service when draft to issued loses its compare-and-set", async () => {
    const { db, calls } = issueDb(0);
    await expect(
      issueWorkspaceParticipantDocument(db as never, issueInput),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "document_issue_conflict",
    });
    expect(
      calls.some((call) =>
        call.sql.startsWith("INSERT INTO workspace_participant_events"),
      ),
    ).toBe(false);
  });

  it("requires every revoked credential to discard its token hash", () => {
    expect(migration).toContain(
      "token_revoked_at IS NULL OR signing_token_hash IS NULL",
    );
  });
});

function publicErrorApp(code: string, statusCode: number) {
  const app = express();
  setupWorkspaceParticipantDocumentRoutes({
    app,
    pool: { query: vi.fn() } as never,
    resolveAuthoritativeSessionFromRequest: async () => ({
      status: "unauthenticated",
    }),
    operations: {
      view: vi.fn(async () => {
        throw new WorkspaceParticipantDocumentError(
          statusCode,
          code,
          `sensitive:${code}`,
        );
      }) as never,
    },
    runTransaction: async (work) => work({ query: vi.fn() } as never),
    runtime: TOKEN_RUNTIME,
  });
  return app;
}

describe("Workspace participant public document route hardening", () => {
  it.each([
    ["document_not_found", 404],
    ["document_token_revoked", 410],
    ["document_token_expired", 410],
  ])(
    "collapses %s into the same non-oracular public response",
    async (code, statusCode) => {
      const response = await request(publicErrorApp(code, statusCode))
        .get(`/api/public/workspace-participant-documents/${DOCUMENT_ID}`)
        .set(WORKSPACE_PARTICIPANT_DOCUMENT_TOKEN_HEADER, TOKEN);
      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: "document_not_found",
        message: "Dokumentlenken er ugyldig.",
      });
      expect(JSON.stringify(response.body)).not.toContain("sensitive");
    },
  );

  it("partitions anonymous traffic from a valid signer without trusting XFF", async () => {
    const app = express();
    app.get(
      "/documents/:documentId",
      createWorkspaceParticipantDocumentCredentialRateLimit(1),
      (_req, res) => res.status(204).end(),
    );

    const first = await request(app)
      .get(`/documents/${DOCUMENT_ID}`)
      .set("X-Forwarded-For", "198.51.100.10");
    const second = await request(app)
      .get(`/documents/${DOCUMENT_ID}`)
      .set("X-Forwarded-For", "203.0.113.20");
    const signer = await request(app)
      .get(`/documents/${DOCUMENT_ID}`)
      .set("X-Forwarded-For", "192.0.2.44")
      .set(WORKSPACE_PARTICIPANT_DOCUMENT_TOKEN_HEADER, TOKEN);

    expect(first.status).toBe(204);
    expect(second.status).toBe(429);
    expect(signer.status).toBe(204);
  });

  it("authenticates tokens before topology-independent limiter budgets", () => {
    expect(routesSource).not.toContain(
      "createWorkspaceParticipantDocumentIpRateLimit",
    );
    expect(routesSource).toContain(
      "createWorkspaceParticipantDocumentRateLimit",
    );
    expect(routesSource).not.toContain(
      "createWorkspaceParticipantDocumentGlobalRateLimit",
    );
    expect(routesSource).toContain(
      "verifyWorkspaceParticipantDocumentToken",
    );
    expect(routesSource).toMatch(
      /WORKSPACE_PARTICIPANT_DOCUMENT_PUBLIC_PATH,\s*workspaceParticipantDocumentSecurityHeaders,\s*authenticatePublicToken,\s*viewDocumentLimit,\s*viewCredentialLimit,/,
    );
    expect(routesSource).toMatch(
      /return authenticatePublicToken[\s\S]*return mutationDocumentLimit[\s\S]*return mutationCredentialLimit/,
    );
    expect(routesSource).toMatch(
      /workspaceParticipantDocumentSecurityHeaders,\s*authenticateToken,\s*mutationDocumentLimit,\s*mutationCredentialLimit,\s*markPrelimited,\s*requireJsonContentType/,
    );
    expect(routesSource).not.toContain("ipKeyGenerator");
  });
});
