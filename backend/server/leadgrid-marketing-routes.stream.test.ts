/**
 * Markedssjef-modus: SSE-kartlegging (POST /api/leadgrid/marketing/bootstrap/stream)
 * og status-feltene som styrer feilforebygging i UI (can_edit_profile,
 * org_number_editable). Alle eksterne avhengigheter er mocket; testen dekker
 * kontrakten frontend-tilstandsmaskinen bygger på:
 *   - autorisasjons-/valideringsfeil som vanlig JSON FØR streamen åpnes
 *   - hendelser i rekkefølge: start → stage … → done { success, result }
 *   - brukerens extraContext går videre til bootstrap-motoren
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import request from "supertest";
import type { Pool } from "pg";

const mocks = vi.hoisted(() => ({
  resolveLeadgridMarketingAccess: vi.fn(),
  getLeadgridSession: vi.fn(),
  generateBootstrap: vi.fn(),
  persistResearchVersion: vi.fn(),
  loadLatestResearchVersion: vi.fn(),
  fetchActiveMarketingPlan: vi.fn(),
  checkMarketingPlanReadiness: vi.fn(),
}));

vi.mock("./lead-map-rbac-helper.js", () => ({
  requireLeadMapPermission: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));
vi.mock("./ai-rate-limiter.js", () => ({
  aiRateLimit: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));
vi.mock("./leadgrid-ai-queue.js", () => ({
  withAIQuota: (_provider: string, _org: string | null, fn: () => Promise<unknown>) => fn(),
}));
vi.mock("./leadgrid-marketing-bridge.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("./leadgrid-marketing-bridge.js")>();
  return {
    ...original,
    resolveLeadgridMarketingAccess: mocks.resolveLeadgridMarketingAccess,
  };
});
vi.mock("./leadgrid-project-access.js", () => ({
  getLeadgridSession: mocks.getLeadgridSession,
  loadAccessibleLeadgridProject: vi.fn(),
}));
vi.mock("./role-room-agent.js", () => ({
  generateRoleRoomAgentProducerBootstrap: mocks.generateBootstrap,
}));
vi.mock("./role-room-agent-learning.js", () => ({
  loadApprovedNaceBusinessModelOverrides: async () => [],
  loadApprovedNaceChannelPriorityOverrides: async () => [],
}));
vi.mock("./role-room-marketing-plan.js", () => ({
  checkMarketingPlanReadiness: mocks.checkMarketingPlanReadiness,
  fetchActiveMarketingPlan: mocks.fetchActiveMarketingPlan,
}));
vi.mock("./role-room-research-versions.js", () => ({
  persistResearchVersion: mocks.persistResearchVersion,
  loadLatestResearchVersion: mocks.loadLatestResearchVersion,
}));

import { registerLeadgridMarketingRoutes } from "./leadgrid-marketing-routes";

const SESSION = { userId: "user-1", email: "markedssjef@example.no" };

function access(over: Partial<{ role: string; userId: string }> = {}) {
  return {
    ok: true,
    access: {
      projectKey: "lg-leadgrid-abc",
      leadgridProjectId: "leadgrid-abc",
      organizationId: "11111111-1111-4111-8111-111111111111",
      projectName: "Feltsalg Østlandet",
      role: over.role ?? "markedssjef",
      permissions: new Set(["marketing.content.brief"]),
      session: { ...SESSION, userId: over.userId ?? SESSION.userId },
    },
  };
}

function makeFakePool(org: Record<string, unknown> | null): Pool {
  return {
    query: async (sql: string) => {
      if (sql.toLowerCase().includes("from organizations")) return { rows: org ? [org] : [] };
      return { rows: [] };
    },
  } as unknown as Pool;
}

function makeApp(org: Record<string, unknown> | null): Express {
  const app = express();
  app.use(express.json());
  registerLeadgridMarketingRoutes({ app, pool: makeFakePool(org), activeSessions: new Map() });
  return app;
}

const ORG = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Nordvest Bygg AS",
  website: "nordvestbygg.no",
  org_number: "912345678",
  industry: null,
  nace_code: "41.200",
  nace_description: "Oppføring av bygninger",
  city: "Ålesund",
  owner_user_id: "owner-9",
};

/** Samler hele SSE-kroppen som tekst (supertest parser ikke text/event-stream). */
function collectText(res: NodeJS.ReadableStream, cb: (err: Error | null, body: string) => void): void {
  let text = "";
  res.on("data", (chunk: Buffer | string) => {
    text += chunk.toString();
  });
  res.on("end", () => cb(null, text));
}

function parseFrames(body: string): Array<{ event: string; data: Record<string, unknown> }> {
  return body
    .split("\n\n")
    .filter((frame) => frame.trim())
    .map((frame) => {
      let event = "message";
      let data = "";
      for (const line of frame.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      return { event, data: data ? (JSON.parse(data) as Record<string, unknown>) : {} };
    });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getLeadgridSession.mockReturnValue(SESSION);
  mocks.resolveLeadgridMarketingAccess.mockResolvedValue(access());
  mocks.checkMarketingPlanReadiness.mockReturnValue({ ready: true, missingFields: [] });
  mocks.fetchActiveMarketingPlan.mockResolvedValue(null);
  mocks.loadLatestResearchVersion.mockResolvedValue(null);
  mocks.persistResearchVersion.mockResolvedValue({ versionNumber: 3 });
  mocks.generateBootstrap.mockImplementation(
    async (_input: unknown, opts: { onProgress?: (e: unknown) => void; researchId: string }) => {
      opts.onProgress?.({ type: "stage_start", stage: "brreg" });
      opts.onProgress?.({ type: "stage_done", stage: "brreg", ms: 120 });
      opts.onProgress?.({ type: "stage_start", stage: "website" });
      opts.onProgress?.({ type: "stage_error", stage: "website", ms: 40, error: "timeout" });
      return { researchId: opts.researchId, companyProfile: { companyName: "Nordvest Bygg AS" } };
    },
  );
});

describe("POST /api/leadgrid/marketing/bootstrap/stream", () => {
  it("answers 401 as plain JSON before any stream is opened", async () => {
    mocks.getLeadgridSession.mockReturnValue(null);
    const res = await request(makeApp(ORG))
      .post("/api/leadgrid/marketing/bootstrap/stream")
      .send({ projectId: "leadgrid-abc" });
    expect(res.status).toBe(401);
    expect(res.headers["content-type"]).toContain("application/json");
    expect(mocks.generateBootstrap).not.toHaveBeenCalled();
  });

  it("answers 403 from the bridge as plain JSON", async () => {
    mocks.resolveLeadgridMarketingAccess.mockResolvedValue({
      ok: false,
      status: 403,
      error: "module_locked",
      module: "leadgrid:marketing",
    });
    const res = await request(makeApp(ORG))
      .post("/api/leadgrid/marketing/bootstrap/stream")
      .send({ projectId: "leadgrid-abc" });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "module_locked", module: "leadgrid:marketing" });
  });

  it("answers 409 org_profile_incomplete when the org has neither website nor org number", async () => {
    const res = await request(makeApp({ ...ORG, website: null, org_number: "  " }))
      .post("/api/leadgrid/marketing/bootstrap/stream")
      .send({ projectId: "leadgrid-abc" });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("org_profile_incomplete");
    expect(res.body.missing).toEqual(["website", "org_number"]);
    expect(mocks.generateBootstrap).not.toHaveBeenCalled();
  });

  it("streams start → stage events → done with the same payload as the non-stream route", async () => {
    const res = await request(makeApp(ORG))
      .post("/api/leadgrid/marketing/bootstrap/stream")
      .send({ projectId: "leadgrid-abc", extraContext: "  Målgruppe: byggefirma på Vestlandet  " })
      .buffer(true)
      .parse(collectText);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/event-stream");

    const frames = parseFrames(res.body as unknown as string);
    expect(frames.map((f) => f.event)).toEqual(["start", "stage", "stage", "stage", "stage", "done"]);
    expect(frames[0].data).toMatchObject({ projectKey: "lg-leadgrid-abc" });
    expect(frames[1].data).toEqual({ type: "stage_start", stage: "brreg" });
    expect(frames[4].data).toMatchObject({ type: "stage_error", stage: "website", error: "timeout" });

    const done = frames[5].data;
    expect(done.success).toBe(true);
    expect(done.project_key).toBe("lg-leadgrid-abc");
    expect(done.version_number).toBe(3);
    expect(done.readiness).toEqual({ ready: true, missingFields: [] });
    // `result` er alias for `bootstrap` slik at useResearchProgress kan gjenbrukes.
    expect(done.result).toEqual(done.bootstrap);
    expect(done.research_id).toBe((frames[0].data as { researchId: string }).researchId);

    // Markedssjefens stikkord når fram til motoren, trimmet og merket.
    const [input] = mocks.generateBootstrap.mock.calls[0] as [{ extraContext: string; websiteUrl: string; organizationNumber: string }];
    expect(input.extraContext).toContain("Fra markedssjefen: Målgruppe: byggefirma på Vestlandet");
    expect(input.websiteUrl).toBe("https://nordvestbygg.no");
    expect(input.organizationNumber).toBe("912345678");
    expect(mocks.persistResearchVersion).toHaveBeenCalledTimes(1);
  });

  it("emits an error event (not a JSON 500) when the engine throws mid-stream", async () => {
    mocks.generateBootstrap.mockRejectedValue(new Error("anthropic_down"));
    const res = await request(makeApp(ORG))
      .post("/api/leadgrid/marketing/bootstrap/stream")
      .send({ projectId: "leadgrid-abc" })
      .buffer(true)
      .parse(collectText);
    expect(res.status).toBe(200);
    const frames = parseFrames(res.body as unknown as string);
    expect(frames.map((f) => f.event)).toEqual(["start", "error"]);
    expect(frames[1].data).toEqual({ success: false, error: "bootstrap_failed" });
    expect(mocks.persistResearchVersion).not.toHaveBeenCalled();
  });
});

describe("GET /api/leadgrid/marketing/status — feilforebyggingsfelter", () => {
  it("lets an admin who owns the org edit both website and org number", async () => {
    mocks.resolveLeadgridMarketingAccess.mockResolvedValue(access({ role: "admin", userId: "owner-9" }));
    const res = await request(makeApp(ORG)).get("/api/leadgrid/marketing/status?projectId=leadgrid-abc");
    expect(res.status).toBe(200);
    expect(res.body.organization).toMatchObject({
      can_bootstrap: true,
      can_edit_profile: true,
      org_number_editable: true,
      website: "https://nordvestbygg.no",
    });
  });

  it("lets a non-owner admin edit the website but not the org number", async () => {
    mocks.resolveLeadgridMarketingAccess.mockResolvedValue(access({ role: "admin" }));
    const res = await request(makeApp(ORG)).get("/api/leadgrid/marketing/status?projectId=leadgrid-abc");
    expect(res.body.organization).toMatchObject({ can_edit_profile: true, org_number_editable: false });
  });

  it("gives markedssjef no inline editing and flags an org that cannot be mapped", async () => {
    const res = await request(makeApp({ ...ORG, website: null, org_number: null })).get(
      "/api/leadgrid/marketing/status?projectId=leadgrid-abc",
    );
    expect(res.status).toBe(200);
    expect(res.body.organization).toMatchObject({
      can_bootstrap: false,
      can_edit_profile: false,
      org_number_editable: false,
    });
    expect(res.body.bootstrap).toEqual({ available: false, readiness: null, result: null });
    expect(res.body.plan).toEqual({ exists: false });
  });
});
