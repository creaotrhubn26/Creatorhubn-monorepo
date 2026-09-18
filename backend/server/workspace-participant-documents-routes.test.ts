import { describe, expect, it, vi } from "vitest";
import {
  setupWorkspaceParticipantDocumentBodyParserBoundary,
  resolveWorkspaceParticipantDocumentClientIp,
  setupWorkspaceParticipantDocumentRoutes,
  workspaceParticipantDocumentSecurityHeaders,
  WORKSPACE_PARTICIPANT_DOCUMENT_PUBLIC_PATH,
  WORKSPACE_PARTICIPANT_DOCUMENT_TOKEN_HEADER,
  type WorkspaceParticipantDocumentOperations,
} from "./workspace-participant-documents-routes.js";
import {
  hashWorkspaceParticipantDocumentToken,
  WorkspaceParticipantDocumentError,
} from "./workspace-participant-documents-service.js";

const PROJECT_ID = "project-1";
const PARTICIPANT_ID = "22222222-2222-4222-8222-222222222222";
const DOCUMENT_ID = "11111111-1111-4111-8111-111111111111";
const SIGNER_ID = "33333333-3333-4333-8333-333333333333";
const TOKEN = "A".repeat(43);

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
            session: { userId: "manager-1" },
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
    const readOnly = harness({ accessOverride: { canManage: false } });
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

  it("commits before optional delivery and falls back to a fragment link without egress", async () => {
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
    expect(res.body.portalUrl).toBe(
      `https://creatorhubn.example/participant-document/${DOCUMENT_ID}#token=${TOKEN}`,
    );
    expect(res.body.portalUrl).not.toContain("?token=");
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
    expect(adapter).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "kari@example.test",
        portalUrl: expect.stringContaining("#token="),
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

  it("resolves 0, 1 and 2 trusted hops right-to-left without trusting spoofed XFF", () => {
    const previous =
      process.env.WORKSPACE_PARTICIPANT_DOCUMENT_TRUST_PROXY_HOPS;
    const req = {
      socket: { remoteAddress: "10.0.0.5" },
      headers: {
        "x-forwarded-for": "198.51.100.99, 203.0.113.20, 192.0.2.44",
      },
    } as never;
    try {
      process.env.WORKSPACE_PARTICIPANT_DOCUMENT_TRUST_PROXY_HOPS = "0";
      expect(resolveWorkspaceParticipantDocumentClientIp(req)).toBe("10.0.0.5");
      process.env.WORKSPACE_PARTICIPANT_DOCUMENT_TRUST_PROXY_HOPS = "1";
      expect(resolveWorkspaceParticipantDocumentClientIp(req)).toBe(
        "192.0.2.44",
      );
      process.env.WORKSPACE_PARTICIPANT_DOCUMENT_TRUST_PROXY_HOPS = "2";
      expect(resolveWorkspaceParticipantDocumentClientIp(req)).toBe(
        "203.0.113.20",
      );
      process.env.WORKSPACE_PARTICIPANT_DOCUMENT_TRUST_PROXY_HOPS = "4";
      expect(resolveWorkspaceParticipantDocumentClientIp(req)).toBe("10.0.0.5");
    } finally {
      if (previous === undefined) {
        delete process.env.WORKSPACE_PARTICIPANT_DOCUMENT_TRUST_PROXY_HOPS;
      } else {
        process.env.WORKSPACE_PARTICIPANT_DOCUMENT_TRUST_PROXY_HOPS = previous;
      }
    }
  });

  it("uses the standalone trusted-hop result for signing evidence", async () => {
    const previous =
      process.env.WORKSPACE_PARTICIPANT_DOCUMENT_TRUST_PROXY_HOPS;
    try {
      process.env.WORKSPACE_PARTICIPANT_DOCUMENT_TRUST_PROXY_HOPS = "2";
      const setup = harness();
      const res = await setup.invoke(
        `POST ${WORKSPACE_PARTICIPANT_DOCUMENT_PUBLIC_PATH}/sign`,
        {
          params: { documentId: DOCUMENT_ID },
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
        expect.objectContaining({ ip: "198.51.100.10" }),
      );
    } finally {
      if (previous === undefined) {
        delete process.env.WORKSPACE_PARTICIPANT_DOCUMENT_TRUST_PROXY_HOPS;
      } else {
        process.env.WORKSPACE_PARTICIPANT_DOCUMENT_TRUST_PROXY_HOPS = previous;
      }
    }
  });
});
