import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import {
  createWorkspaceParticipantDocumentCredentialRateLimit,
  createWorkspaceParticipantDocumentRateLimit,
  createWorkspaceParticipantDocumentTokenAuthenticityBoundary,
  resolveWorkspaceParticipantDocumentSocketPeerIp,
  setupWorkspaceParticipantDocumentBodyParserBoundary,
  setupWorkspaceParticipantDocumentRoutes,
  workspaceParticipantDocumentSecurityHeaders,
  WORKSPACE_PARTICIPANT_DOCUMENT_PUBLIC_PATH,
  WORKSPACE_PARTICIPANT_DOCUMENT_TOKEN_HEADER,
  type WorkspaceParticipantDocumentOperations,
} from "./workspace-participant-documents-routes.js";
import {
  generateWorkspaceParticipantDocumentToken,
  hashWorkspaceParticipantDocumentToken,
  WorkspaceParticipantDocumentError,
} from "./workspace-participant-documents-service.js";

const PROJECT_ID = "project-1";
const PARTICIPANT_ID = "22222222-2222-4222-8222-222222222222";
const DOCUMENT_ID = "11111111-1111-4111-8111-111111111111";
const SIGNER_ID = "33333333-3333-4333-8333-333333333333";
const TOKEN_SECRET = "workspace-participant-test-token-secret-v1";
const TOKEN_RUNTIME = { tokenSigningSecret: TOKEN_SECRET };
const tokenFor = (documentId: string, seed: number): string =>
  generateWorkspaceParticipantDocumentToken(documentId, {
    ...TOKEN_RUNTIME,
    randomBytes: (size) => Buffer.alloc(size, seed),
  });
const TOKEN = tokenFor(DOCUMENT_ID, 1);

const access = {
  projectId: PROJECT_ID,
  projectOwnerUserId: "owner-1",
  organizationId: "org-1",
  enterprise: true as const,
  featureId: "workspace-project-participants" as const,
  canView: true,
  canManage: true,
  canConfigureRequirements: true,
  scopeBound: true,
  role: "enterprise_admin" as const,
};

function documentSummary() {
  return {
    id: DOCUMENT_ID,
    participantId: PARTICIPANT_ID,
    documentType: "contract" as const,
    status: "issued" as const,
    version: 1,
    title: "Kontrakt",
    contentHash: "a".repeat(64),
    supersedesDocumentId: null,
    issuedAt: "2026-08-30T10:00:00.000Z",
    expiresAt: null,
    signedAt: null,
    withdrawnAt: null,
    createdAt: "2026-08-30T10:00:00.000Z",
    updatedAt: "2026-08-30T10:00:00.000Z",
    signer: {
      id: SIGNER_ID,
      role: "participant" as const,
      name: "Kari Nordmann",
      email: "kari@example.test",
      status: "pending" as const,
      tokenExpiresAt: "2026-09-29T10:00:00.000Z",
      tokenRevokedAt: null,
      signedAt: null,
    },
    delivery: { status: null, provider: null, reason: null, at: null },
  };
}

function publicDocument(overrides: Record<string, unknown> = {}) {
  return {
    documentId: DOCUMENT_ID,
    documentType: "contract" as const,
    status: "signed" as const,
    version: 1,
    title: "Kontrakt",
    contentHash: "a".repeat(64),
    issuedAt: "2026-08-30T10:00:00.000Z",
    signedAt: "2026-08-30T11:00:00.000Z",
    withdrawnAt: null,
    signerName: "Kari Nordmann",
    signerRole: "participant" as const,
    terms: {} as never,
    canSign: false,
    canWithdraw: false,
    ...overrides,
  };
}

function response() {
  const res: any = {
    statusCode: 200,
    body: undefined,
    headers: new Map<string, string>(),
  };
  res.setHeader = vi.fn((name: string, value: string) => {
    res.headers.set(name, value);
    return res;
  });
  res.status = vi.fn((statusCode: number) => {
    res.statusCode = statusCode;
    return res;
  });
  res.json = vi.fn((body: unknown) => {
    res.body = body;
    return res;
  });
  return res;
}

function operations(
  overrides: Partial<WorkspaceParticipantDocumentOperations> = {},
) {
  const summary = documentSummary();
  const defaults: WorkspaceParticipantDocumentOperations = {
    list: vi.fn(async () => ({
      documents: [summary],
      latest: { contract: summary },
    })),
    issue: vi.fn(async () => ({
      scope: {
        organizationId: "org-1",
        projectId: PROJECT_ID,
        participantId: PARTICIPANT_ID,
      },
      document: documentSummary(),
      rawToken: TOKEN,
      signerName: "Kari Nordmann",
      signerEmail: "kari@example.test",
      producerName: "Produsent",
      producerEmail: "owner@example.test",
      projectTitle: "Reklamefilm",
    })),
    reissue: vi.fn(async () => ({
      scope: {
        organizationId: "org-1",
        projectId: PROJECT_ID,
        participantId: PARTICIPANT_ID,
      },
      document: documentSummary(),
      rawToken: TOKEN,
      signerName: "Kari Nordmann",
      signerEmail: "kari@example.test",
      producerName: "Produsent",
      producerEmail: "owner@example.test",
      projectTitle: "Reklamefilm",
    })),
    view: vi.fn(async () => publicDocument()),
    sign: vi.fn(async () => ({
      document: publicDocument(),
      already: false,
      notification: {
        projectId: PROJECT_ID,
        projectTitle: "Reklamefilm",
        producerEmail: "owner@example.test",
        producerName: "Produsent",
        signerName: "Kari Nordmann",
      },
      scope: {
        organizationId: "org-1",
        projectId: PROJECT_ID,
        participantId: PARTICIPANT_ID,
        documentId: DOCUMENT_ID,
        signerId: SIGNER_ID,
      },
    })),
    withdraw: vi.fn(async () => ({
      document: publicDocument({
        documentType: "media_consent",
        status: "withdrawn",
      }),
      already: false,
      notification: {
        projectId: PROJECT_ID,
        projectTitle: "Reklamefilm",
        producerEmail: "owner@example.test",
        producerName: "Produsent",
        signerName: "Kari Nordmann",
      },
      scope: {
        organizationId: "org-1",
        projectId: PROJECT_ID,
        participantId: PARTICIPANT_ID,
        documentId: DOCUMENT_ID,
        signerId: SIGNER_ID,
      },
    })),
    appendDelivery: vi.fn(async () => undefined),
  };
  return {
    ...defaults,
    ...overrides,
  } as WorkspaceParticipantDocumentOperations;
}

function harness(
  input: {
    auth?: "authenticated" | "unauthenticated" | "unavailable";
    accessOverride?: Partial<typeof access>;
    session?: {
      userId: string;
      impersonatedByAdmin?: boolean;
      impersonatorId?: string;
      impersonationExpiresAt?: number;
    };
    operationOverrides?: Partial<WorkspaceParticipantDocumentOperations>;
    deliveryAdapter?: any;
    runTransaction?: any;
  } = {},
) {
  const routes = new Map<
    string,
    Array<(req: any, res: any, next?: any) => unknown>
  >();
  const app: any = {};
  for (const method of ["get", "post"]) {
    app[method] = (
      path: string,
      ...handlers: Array<(req: any, res: any, next?: any) => unknown>
    ) => {
      routes.set(`${method.toUpperCase()} ${path}`, handlers);
      return app;
    };
  }
  const client: any = { query: vi.fn(), release: vi.fn() };
  const pool: any = { query: vi.fn(), connect: vi.fn(async () => client) };
  const ops = operations(input.operationOverrides);
  const resolveSession = vi.fn(async () =>
    input.auth === "unauthenticated"
      ? { status: "unauthenticated" as const }
      : input.auth === "unavailable"
        ? { status: "unavailable" as const }
        : {
            status: "authenticated" as const,
            session: input.session ?? { userId: "manager-1" },
          },
  );
  const resolveAccess = vi.fn(async () => ({
    ...access,
    ...input.accessOverride,
  }));
  const ensureScope = vi.fn(async () => undefined);
  const runTransaction =
    input.runTransaction ?? (async (work: any) => work(client));
  setupWorkspaceParticipantDocumentRoutes({
    app,
    pool,
    resolveAuthoritativeSessionFromRequest: resolveSession,
    resolveAccess: resolveAccess as never,
    ensureScope: ensureScope as never,
    operations: ops,
    runTransaction,
    publicAppUrl: "https://creatorhubn.example",
    deliveryAdapter: input.deliveryAdapter,
    runtime: TOKEN_RUNTIME,
  });
  const invoke = async (key: string, request: Record<string, unknown>) => {
    const handlers = routes.get(key);
    if (!handlers) throw new Error(`Missing route ${key}`);
    const res = response();
    const req: any = {
      params: {},
      body: {},
      query: {},
      headers: {},
      ip: "192.0.2.1",
      socket: { remoteAddress: "192.0.2.1" },
      ...request,
    };
    await handlers[handlers.length - 1](req, res);
    return res;
  };
  return {
    routes,
    invoke,
    ops,
    resolveSession,
    resolveAccess,
    ensureScope,
    pool,
  };
}

const managerParams = { projectId: PROJECT_ID, participantId: PARTICIPANT_ID };
const contractIssueBody = {
  documentType: "contract",
  title: "Kontrakt",
  terms: {
    workDescription: "Én opptaksdag",
    role: "Statist",
    startsOn: "2026-09-02",
    endsOn: "2026-09-02",
  },
};

describe("Workspace participant document manager routes", () => {
  it("fails closed for unavailable and unauthenticated session authority", async () => {
    const unavailable = harness({ auth: "unavailable" });
    const unavailableResponse = await unavailable.invoke(
      `GET /api/projects/:projectId/participants/:participantId/documents`,
      { params: managerParams },
    );
    expect(unavailableResponse.statusCode).toBe(503);
    expect(unavailable.ops.list).not.toHaveBeenCalled();

    const unauthenticated = harness({ auth: "unauthenticated" });
    const unauthenticatedResponse = await unauthenticated.invoke(
      `GET /api/projects/:projectId/participants/:participantId/documents`,
      { params: managerParams },
    );
    expect(unauthenticatedResponse.statusCode).toBe(401);
    expect(unauthenticated.ops.list).not.toHaveBeenCalled();
  });

  it("separates view and manage authority", async () => {
    const readOnly = harness({
      accessOverride: {
        canManage: false,
        canConfigureRequirements: false,
      },
    });
    const listResponse = await readOnly.invoke(
      `GET /api/projects/:projectId/participants/:participantId/documents`,
      { params: managerParams },
    );
    expect(listResponse.statusCode).toBe(200);
    expect(readOnly.ops.list).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        organizationId: "org-1",
        projectId: PROJECT_ID,
        participantId: PARTICIPANT_ID,
        includeSignerEmail: false,
      }),
    );

    const issueResponse = await readOnly.invoke(
      `POST /api/projects/:projectId/participants/:participantId/documents/issue`,
      { params: managerParams, body: contractIssueBody },
    );
    expect(issueResponse.statusCode).toBe(403);
    expect(readOnly.ops.issue).not.toHaveBeenCalled();
  });

  it("rejects arbitrary legal HTML before persistence", async () => {
    const setup = harness();
    const res = await setup.invoke(
      `POST /api/projects/:projectId/participants/:participantId/documents/issue`,
      {
        params: managerParams,
        body: {
          ...contractIssueBody,
          terms: {
            ...contractIssueBody.terms,
            workDescription: "<b>skjult vilkår</b>",
          },
        },
      },
    );
    expect(res.statusCode).toBe(400);
    expect(setup.ops.issue).not.toHaveBeenCalled();
  });

  it("rejects client-supplied compensationSummary before persistence", async () => {
    const setup = harness();
    const res = await setup.invoke(
      `POST /api/projects/:projectId/participants/:participantId/documents/issue`,
      {
        params: managerParams,
        body: {
          ...contractIssueBody,
          terms: {
            ...contractIssueBody.terms,
            compensationSummary: "750 NOK per time",
          },
        },
      },
    );
    expect(res.statusCode).toBe(400);
    expect(setup.ops.issue).not.toHaveBeenCalled();
  });

  it("commits before delivery and never returns the personal link without egress", async () => {
    const sequence: string[] = [];
    const baseOps = operations();
    const issue = vi.fn(async (...args: any[]) => {
      sequence.push("issue");
      return baseOps.issue(...(args as never));
    });
    const appendDelivery = vi.fn(async () => {
      sequence.push("audit-delivery");
    });
    const setup = harness({
      operationOverrides: {
        issue: issue as never,
        appendDelivery: appendDelivery as never,
      },
      runTransaction: async (work: any) => {
        sequence.push("begin");
        const result = await work({ query: vi.fn() });
        sequence.push("commit");
        return result;
      },
    });
    const res = await setup.invoke(
      `POST /api/projects/:projectId/participants/:participantId/documents/issue`,
      { params: managerParams, body: contractIssueBody },
    );
    expect(res.statusCode).toBe(201);
    expect(sequence).toEqual(["begin", "issue", "commit", "audit-delivery"]);
    expect(res.body.delivery).toEqual({
      sent: false,
      provider: null,
      reason: "delivery_not_configured",
    });
    expect(res.body).not.toHaveProperty("portalUrl");
    expect(JSON.stringify(res.body)).not.toContain(TOKEN);
    expect(JSON.stringify(appendDelivery.mock.calls)).not.toContain(TOKEN);
    expect(setup.ensureScope).toHaveBeenCalled();
  });

  it("runs an injected delivery adapter only after commit", async () => {
    const sequence: string[] = [];
    const adapter = vi.fn(async () => {
      sequence.push("deliver");
      return { sent: true, provider: "test-adapter", reason: null };
    });
    const setup = harness({
      deliveryAdapter: adapter,
      runTransaction: async (work: any) => {
        sequence.push("begin");
        const result = await work({ query: vi.fn() });
        sequence.push("commit");
        return result;
      },
    });
    const res = await setup.invoke(
      `POST /api/projects/:projectId/participants/:participantId/documents/issue`,
      { params: managerParams, body: contractIssueBody },
    );
    expect(sequence).toEqual(["begin", "commit", "deliver"]);
    expect(res.body.delivery.sent).toBe(true);
    expect(res.body).not.toHaveProperty("portalUrl");
    expect(JSON.stringify(res.body)).not.toContain(TOKEN);
    expect(adapter).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "kari@example.test",
        portalUrl: expect.stringContaining("#token="),
      }),
    );
  });

  it("delivers a reissued credential but never serializes it to the manager", async () => {
    const adapter = vi.fn(async () => ({
      sent: false,
      provider: "test-adapter",
      reason: "delivery_failed",
    }));
    const setup = harness({ deliveryAdapter: adapter });

    const res = await setup.invoke(
      `POST /api/projects/:projectId/participants/:participantId/documents/:documentId/reissue-link`,
      {
        params: { ...managerParams, documentId: DOCUMENT_ID },
        body: {},
      },
    );

    expect(res.statusCode).toBe(200);
    expect(adapter).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "workspace_participant_document_reissued",
        to: "kari@example.test",
        portalUrl: expect.stringContaining(`#token=${TOKEN}`),
      }),
    );
    expect(res.body.delivery).toEqual({
      sent: false,
      provider: "test-adapter",
      reason: "delivery_failed",
    });
    expect(res.body).not.toHaveProperty("portalUrl");
    expect(JSON.stringify(res.body)).not.toContain(TOKEN);
  });

  it("rejects secret-bearing metadata returned by a faulty delivery adapter", async () => {
    const personalUrl =
      `https://creatorhubn.example/participant-document/${DOCUMENT_ID}#token=${TOKEN}`;
    const setup = harness({
      deliveryAdapter: vi.fn(async () => ({
        sent: false,
        provider: TOKEN,
        reason: personalUrl,
        portalUrl: personalUrl,
      })),
    });

    const res = await setup.invoke(
      `POST /api/projects/:projectId/participants/:participantId/documents/issue`,
      { params: managerParams, body: contractIssueBody },
    );

    expect(res.body.delivery).toEqual({
      sent: false,
      provider: null,
      reason: "delivery_failed",
    });
    expect(JSON.stringify(res.body)).not.toContain(TOKEN);
    expect(JSON.stringify(res.body)).not.toContain("portalUrl");
  });

  it("uses effective access but attributes issue, reissue, delivery and email to the impersonator", async () => {
    const adapter = vi.fn(async () => ({
      sent: true,
      provider: "test-adapter",
      reason: null,
    }));
    const setup = harness({
      session: {
        userId: "owner-1",
        impersonatedByAdmin: true,
        impersonatorId: "admin-real",
        impersonationExpiresAt: Date.now() + 60_000,
      },
      deliveryAdapter: adapter,
    });

    const issueResponse = await setup.invoke(
      `POST /api/projects/:projectId/participants/:participantId/documents/issue`,
      { params: managerParams, body: contractIssueBody },
    );
    const reissueResponse = await setup.invoke(
      `POST /api/projects/:projectId/participants/:participantId/documents/:documentId/reissue-link`,
      {
        params: { ...managerParams, documentId: DOCUMENT_ID },
        body: {},
      },
    );

    expect(issueResponse.statusCode).toBe(201);
    expect(reissueResponse.statusCode).toBe(200);
    expect(setup.resolveAccess).toHaveBeenCalledWith(
      expect.anything(),
      "owner-1",
      PROJECT_ID,
    );
    expect(setup.ensureScope).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      "admin-real",
    );
    for (const operation of [setup.ops.issue, setup.ops.reissue]) {
      expect(operation).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          actorUserId: "admin-real",
          auditPayload: {
            impersonated: true,
            effectiveUserId: "owner-1",
          },
        }),
      );
    }
    expect(adapter).toHaveBeenCalledWith(
      expect.objectContaining({ actorUserId: "admin-real" }),
    );
    expect(setup.ops.appendDelivery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actorUserId: "admin-real",
        auditPayload: {
          impersonated: true,
          effectiveUserId: "owner-1",
        },
      }),
    );
  });
});

describe("Workspace participant public document routes", () => {
  it("uses only the dedicated header credential and never consults account sessions", async () => {
    const setup = harness();
    const res = await setup.invoke(
      `GET ${WORKSPACE_PARTICIPANT_DOCUMENT_PUBLIC_PATH}`,
      {
        params: { documentId: DOCUMENT_ID },
        query: { token: TOKEN },
        headers: {},
      },
    );
    expect(res.statusCode).toBe(404);
    expect(setup.ops.view).not.toHaveBeenCalled();
    expect(setup.resolveSession).not.toHaveBeenCalled();
  });

  it("hashes the raw header before handing it to the sign service", async () => {
    const setup = harness();
    const res = await setup.invoke(
      `POST ${WORKSPACE_PARTICIPANT_DOCUMENT_PUBLIC_PATH}/sign`,
      {
        params: { documentId: DOCUMENT_ID },
        headers: {
          [WORKSPACE_PARTICIPANT_DOCUMENT_TOKEN_HEADER]: TOKEN,
          "user-agent": "Vitest",
        },
        body: {
          signerName: "Kari Nordmann",
          accepted: true,
          signatureMethod: "typed",
        },
      },
    );
    expect(res.statusCode).toBe(200);
    expect(setup.ops.sign).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        documentId: DOCUMENT_ID,
        tokenHash: hashWorkspaceParticipantDocumentToken(TOKEN),
      }),
    );
    expect(JSON.stringify((setup.ops.sign as any).mock.calls)).not.toContain(
      `"token":"${TOKEN}"`,
    );
    expect(setup.resolveSession).not.toHaveBeenCalled();
  });

  it("does not redeliver or append duplicate events for an idempotent sign retry", async () => {
    const adapter = vi.fn();
    const appendDelivery = vi.fn();
    const setup = harness({
      deliveryAdapter: adapter,
      operationOverrides: {
        sign: vi.fn(async () => ({
          document: publicDocument(),
          already: true,
          notification: {
            projectId: PROJECT_ID,
            projectTitle: "Reklamefilm",
            producerEmail: "owner@example.test",
            producerName: "Produsent",
            signerName: "Kari",
          },
          scope: {
            organizationId: "org-1",
            projectId: PROJECT_ID,
            participantId: PARTICIPANT_ID,
            documentId: DOCUMENT_ID,
            signerId: SIGNER_ID,
          },
        })) as never,
        appendDelivery: appendDelivery as never,
      },
    });
    const res = await setup.invoke(
      `POST ${WORKSPACE_PARTICIPANT_DOCUMENT_PUBLIC_PATH}/sign`,
      {
        params: { documentId: DOCUMENT_ID },
        headers: { [WORKSPACE_PARTICIPANT_DOCUMENT_TOKEN_HEADER]: TOKEN },
        body: {
          signerName: "Et annet navn",
          accepted: true,
          signatureMethod: "typed",
        },
      },
    );
    expect(res.body.alreadySigned).toBe(true);
    expect(adapter).not.toHaveBeenCalled();
    expect(appendDelivery).not.toHaveBeenCalled();
  });

  it("maps the service-level contract withdrawal guard without delivery", async () => {
    const adapter = vi.fn();
    const setup = harness({
      deliveryAdapter: adapter,
      operationOverrides: {
        withdraw: vi.fn(async () => {
          throw new WorkspaceParticipantDocumentError(
            409,
            "document_not_withdrawable",
            "Kontrakter kan ikke trekkes tilbake.",
          );
        }) as never,
      },
    });
    const res = await setup.invoke(
      `POST ${WORKSPACE_PARTICIPANT_DOCUMENT_PUBLIC_PATH}/withdraw`,
      {
        params: { documentId: DOCUMENT_ID },
        headers: { [WORKSPACE_PARTICIPANT_DOCUMENT_TOKEN_HEADER]: TOKEN },
        body: { confirmed: true, reason: "ønsker ikke" },
      },
    );
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe("document_not_withdrawable");
    expect(adapter).not.toHaveBeenCalled();
  });

  it("sets no-store and no-referrer on document responses", () => {
    const res = response();
    const next = vi.fn();
    workspaceParticipantDocumentSecurityHeaders({} as never, res, next);
    expect(res.headers.get("Cache-Control")).toContain("no-store");
    expect(res.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(next).toHaveBeenCalled();
  });

  it("exports strict public body-parser boundaries for sign and withdraw", () => {
    const registered: string[] = [];
    const app: any = {
      post: vi.fn((path: string) => {
        registered.push(path);
        return app;
      }),
    };
    setupWorkspaceParticipantDocumentBodyParserBoundary(app);
    expect(registered).toEqual([
      `${WORKSPACE_PARTICIPANT_DOCUMENT_PUBLIC_PATH}/sign`,
      `${WORKSPACE_PARTICIPANT_DOCUMENT_PUBLIC_PATH}/withdraw`,
    ]);
  });

  it("charges malformed and oversized JSON before parsing across spoofed XFF", async () => {
    const app = express();
    const path = `${WORKSPACE_PARTICIPANT_DOCUMENT_PUBLIC_PATH}/sign`;
    setupWorkspaceParticipantDocumentBodyParserBoundary(
      app,
      100,
      2,
      TOKEN_RUNTIME,
    );
    app.use(express.json({ limit: "50mb" }));
    app.post(path, (_req, res) => res.status(204).end());

    const malformed = await request(app)
      .post(path.replace(":documentId", DOCUMENT_ID))
      .set(WORKSPACE_PARTICIPANT_DOCUMENT_TOKEN_HEADER, tokenFor(DOCUMENT_ID, 2))
      .set("X-Forwarded-For", "198.51.100.10")
      .set("Content-Type", "application/json")
      .send('{"signerName":');
    expect(malformed.status).toBe(400);
    expect(malformed.body).toEqual({ error: "invalid_request_body" });

    const oversized = await request(app)
      .post(path.replace(":documentId", DOCUMENT_ID))
      .set(WORKSPACE_PARTICIPANT_DOCUMENT_TOKEN_HEADER, tokenFor(DOCUMENT_ID, 3))
      .set("X-Forwarded-For", "203.0.113.20")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ padding: "x".repeat(40_000) }));
    expect(oversized.status).toBe(413);
    expect(oversized.body).toEqual({ error: "request_body_too_large" });

    const afterBudget = await request(app)
      .post(path.replace(":documentId", DOCUMENT_ID))
      .set(WORKSPACE_PARTICIPANT_DOCUMENT_TOKEN_HEADER, tokenFor(DOCUMENT_ID, 4))
      .set("X-Forwarded-For", "192.0.2.44")
      .send({ signerName: "Kari", accepted: true, signatureMethod: "typed" });
    expect(afterBudget.status).toBe(429);
    expect(afterBudget.body).toEqual({ error: "too_many_requests" });
  });

  it("stops rotating credentials and spoofed XFF per document without blocking another document", async () => {
    const app = express();
    const caseSensitiveDocumentId =
      "abcdefab-cdef-4abc-8def-abcdefabcdef";
    app.get(
      "/documents/:documentId",
      createWorkspaceParticipantDocumentRateLimit(1),
      (_req, res) => res.status(204).end(),
    );

    expect(
      (
        await request(app)
          .get(`/documents/${caseSensitiveDocumentId.toUpperCase()}`)
          .set(
            WORKSPACE_PARTICIPANT_DOCUMENT_TOKEN_HEADER,
            tokenFor(caseSensitiveDocumentId, 5),
          )
          .set("X-Forwarded-For", "198.51.100.10")
      ).status,
    ).toBe(204);
    expect(
      (
        await request(app)
          .get(`/documents/${caseSensitiveDocumentId}`)
          .set(
            WORKSPACE_PARTICIPANT_DOCUMENT_TOKEN_HEADER,
            tokenFor(caseSensitiveDocumentId, 6),
          )
          .set("X-Forwarded-For", "203.0.113.20")
      ).status,
    ).toBe(429);
    expect(
      (
        await request(app)
          .get("/documents/99999999-9999-4999-8999-999999999999")
          .set(
            WORKSPACE_PARTICIPANT_DOCUMENT_TOKEN_HEADER,
            tokenFor("99999999-9999-4999-8999-999999999999", 7),
          )
      ).status,
    ).toBe(204);
  });

  it("rejects random UUID, credential and XFF rotation before downstream state", async () => {
    const app = express();
    const downstream = vi.fn((_req, res) => res.status(204).end());
    app.get(
      "/documents/:documentId",
      createWorkspaceParticipantDocumentTokenAuthenticityBoundary(TOKEN_RUNTIME),
      downstream,
    );

    for (let index = 0; index < 20; index += 1) {
      const suffix = String(index + 1).padStart(12, "0");
      const result = await request(app)
        .get(`/documents/aaaaaaaa-aaaa-4aaa-8aaa-${suffix}`)
        .set(
          WORKSPACE_PARTICIPANT_DOCUMENT_TOKEN_HEADER,
          String.fromCharCode(65 + index).repeat(43),
        )
        .set("X-Forwarded-For", `198.51.100.${index + 1}`);
      expect(result.status).toBe(404);
    }
    expect(downstream).not.toHaveBeenCalled();

    const invalidPath = await request(app)
      .get("/documents/not-a-uuid")
      .set(WORKSPACE_PARTICIPANT_DOCUMENT_TOKEN_HEADER, "Z".repeat(43));
    expect(invalidPath.status).toBe(404);
    expect(downstream).not.toHaveBeenCalled();

    const valid = await request(app)
      .get(`/documents/${DOCUMENT_ID}`)
      .set(WORKSPACE_PARTICIPANT_DOCUMENT_TOKEN_HEADER, TOKEN);
    expect(valid.status).toBe(204);
    expect(downstream).toHaveBeenCalledTimes(1);
  });

  it("canonicalizes UUID casing in the secondary credential budget", async () => {
    const app = express();
    const documentId = "abcdefab-cdef-4abc-8def-abcdefabcdef";
    app.get(
      "/documents/:documentId",
      createWorkspaceParticipantDocumentCredentialRateLimit(1),
      (_req, res) => res.status(204).end(),
    );

    const first = await request(app)
      .get(`/documents/${documentId.toUpperCase()}`)
      .set(WORKSPACE_PARTICIPANT_DOCUMENT_TOKEN_HEADER, TOKEN)
      .set("X-Forwarded-For", "198.51.100.10");
    const second = await request(app)
      .get(`/documents/${documentId}`)
      .set(WORKSPACE_PARTICIPANT_DOCUMENT_TOKEN_HEADER, TOKEN)
      .set("X-Forwarded-For", "203.0.113.20");

    expect(first.status).toBe(204);
    expect(second.status).toBe(429);
  });

  it("keeps a valid signer outside the anonymous credential budget", async () => {
    const app = express();
    app.get(
      "/documents/:documentId",
      createWorkspaceParticipantDocumentCredentialRateLimit(1),
      (_req, res) => res.status(204).end(),
    );
    const path = `/documents/${DOCUMENT_ID}`;

    expect((await request(app).get(path)).status).toBe(204);
    expect((await request(app).get(path)).status).toBe(429);
    expect(
      (
        await request(app)
          .get(path)
          .set(WORKSPACE_PARTICIPANT_DOCUMENT_TOKEN_HEADER, TOKEN)
      ).status,
    ).toBe(204);
  });

  it("ignores attacker-supplied XFF and reports only the direct socket peer", () => {
    const req = {
      socket: { remoteAddress: "10.0.0.5" },
      headers: {
        "x-forwarded-for": "198.51.100.99, 203.0.113.20, 192.0.2.44",
      },
    } as never;
    expect(resolveWorkspaceParticipantDocumentSocketPeerIp(req)).toBe(
      "10.0.0.5",
    );
  });

  it("uses only the direct socket peer as signing evidence", async () => {
    const setup = harness();
    const res = await setup.invoke(
      `POST ${WORKSPACE_PARTICIPANT_DOCUMENT_PUBLIC_PATH}/sign`,
      {
        params: { documentId: DOCUMENT_ID },
        socket: { remoteAddress: "10.0.0.5" },
        headers: {
          [WORKSPACE_PARTICIPANT_DOCUMENT_TOKEN_HEADER]: TOKEN,
          "x-forwarded-for": "198.51.100.10, 203.0.113.20",
        },
        body: {
          signerName: "Kari Nordmann",
          accepted: true,
          signatureMethod: "typed",
        },
      },
    );
    expect(res.statusCode).toBe(200);
    expect(setup.ops.sign).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ ip: "10.0.0.5" }),
    );
  });
});
