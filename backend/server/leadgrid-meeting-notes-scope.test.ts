import { readFileSync } from "node:fs";
import type { Express, Request, RequestHandler, Response } from "express";
import type { Pool } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

const leadAccessMocks = vi.hoisted(() => ({ load: vi.fn() }));
const permissionMocks = vi.hoisted(() => ({ resolve: vi.fn() }));
const meetingServiceMocks = vi.hoisted(() => ({
  process: vi.fn(),
  transcribe: vi.fn(),
}));
const webhookMocks = vi.hoisted(() => ({ emit: vi.fn() }));

vi.mock("./leadgrid-lead-access.js", () => ({
  loadAccessibleLeadgridLead: leadAccessMocks.load,
}));
vi.mock("./lead-map-permission-routes.js", () => ({
  resolveEffectivePermissions: permissionMocks.resolve,
}));
vi.mock("./leadgrid-meeting-notes-service.js", () => ({
  processMeetingNote: meetingServiceMocks.process,
  transcribeAudio: meetingServiceMocks.transcribe,
}));
vi.mock("./webhook-emitter.js", () => ({
  emitWebhook: webhookMocks.emit,
}));

import { registerLeadgridMeetingNotesRoutes } from "./leadgrid-meeting-notes-routes.js";

const organizationId = "11111111-1111-4111-8111-111111111111";
const spoofedOrganizationId = "22222222-2222-4222-8222-222222222222";
const leadId = "33333333-3333-4333-8333-333333333333";
const noteId = "44444444-4444-4444-8444-444444444444";
const projectId = "dentum-project";

type RegisteredRoute = {
  method: string;
  path: string;
  handler: RequestHandler;
};

function setupHarness(query = vi.fn()) {
  const routes: RegisteredRoute[] = [];
  const register =
    (method: string) =>
    (path: string, ...handlers: RequestHandler[]) =>
      routes.push({ method, path, handler: handlers.at(-1)! });
  const app = {
    get: register("GET"),
    post: register("POST"),
    delete: register("DELETE"),
  } as unknown as Express;
  const pool = { query } as unknown as Pool;
  registerLeadgridMeetingNotesRoutes({
    app,
    pool,
    activeSessions: new Map([["token-a", { userId: "user-a" }]]),
  });
  return {
    pool,
    query,
    route(method: string, path: string) {
      const route = routes.find(
        (candidate) => candidate.method === method && candidate.path === path,
      );
      if (!route) throw new Error(`Missing ${method} ${path}`);
      return route.handler;
    },
  };
}

function request(options: {
  id: string;
  body?: Record<string, unknown>;
}): Request {
  return {
    headers: { authorization: "Bearer token-a" },
    params: { id: options.id },
    query: {},
    body: options.body ?? {},
  } as unknown as Request;
}

function responseHarness() {
  let status = 200;
  let body: unknown;
  const response = {} as Response;
  response.status = vi.fn((value: number) => {
    status = value;
    return response;
  });
  response.json = vi.fn((value: unknown) => {
    body = value;
    return response;
  });
  return { response, status: () => status, body: () => body };
}

beforeEach(() => {
  vi.clearAllMocks();
  leadAccessMocks.load.mockResolvedValue({
    id: leadId,
    organizationId,
    projectId,
  });
  permissionMocks.resolve.mockResolvedValue({
    role: "admin",
    permissions: new Set([
      "meeting_notes.create",
      "meeting_notes.view",
      "meeting_notes.delete",
    ]),
  });
  meetingServiceMocks.process.mockResolvedValue(true);
});

describe("Leadgrid meeting-note scope", () => {
  it("ignores a spoofed request organization and inserts from the accessible lead tuple", async () => {
    const query = vi
      .fn()
      .mockResolvedValue({ rows: [{ id: noteId }], rowCount: 1 });
    const harness = setupHarness(query);
    const result = responseHarness();
    const scheduled = vi
      .spyOn(globalThis, "setImmediate")
      .mockImplementation(() => ({}) as NodeJS.Immediate);

    await harness.route(
      "POST",
      "/api/leadgrid/leads/:id/meeting-notes/from-text",
    )(
      request({
        id: leadId,
        body: {
          transcript: "Kunden ønsker en pilot.",
          language: "no",
          organization_id: spoofedOrganizationId,
        },
      }),
      result.response,
      vi.fn(),
    );

    scheduled.mockRestore();
    expect(result.status()).toBe(202);
    expect(leadAccessMocks.load).toHaveBeenCalledWith(harness.pool, {
      leadId,
      userId: "user-a",
    });
    const insert = query.mock.calls.find(([sql]) =>
      String(sql).includes("INSERT INTO lead_meeting_notes"),
    );
    expect(insert).toBeDefined();
    expect(String(insert?.[0])).toContain(
      "SELECT lead.id, lead.organization_id",
    );
    expect(insert?.[1]).toEqual([
      leadId,
      organizationId,
      projectId,
      "user-a",
      "Kunden ønsker en pilot.",
      "no",
    ]);
    expect(insert?.[1]).not.toContain(spoofedOrganizationId);
  });

  it("does not emit a completion webhook when scoped background processing aborts", async () => {
    const query = vi
      .fn()
      .mockResolvedValue({ rows: [{ id: noteId }], rowCount: 1 });
    const harness = setupHarness(query);
    const result = responseHarness();
    let background: (() => Promise<void>) | undefined;
    const scheduled = vi
      .spyOn(globalThis, "setImmediate")
      .mockImplementation((callback) => {
        background = callback as unknown as () => Promise<void>;
        return {} as NodeJS.Immediate;
      });
    meetingServiceMocks.process.mockResolvedValue(false);

    await harness.route(
      "POST",
      "/api/leadgrid/leads/:id/meeting-notes/from-text",
    )(
      request({
        id: leadId,
        body: {
          transcript: "Kunden ønsker en pilot.",
          language: "no",
        },
      }),
      result.response,
      vi.fn(),
    );
    expect(background).toBeDefined();
    await background?.();
    scheduled.mockRestore();

    expect(result.status()).toBe(202);
    expect(meetingServiceMocks.process).toHaveBeenCalledWith(harness.pool, {
      noteId,
      leadId,
      organizationId,
      projectId,
    });
    expect(webhookMocks.emit).not.toHaveBeenCalled();
  });

  it("denies a foreign or same-organization hidden lead before listing notes", async () => {
    leadAccessMocks.load.mockResolvedValue(null);
    const harness = setupHarness();
    const result = responseHarness();

    await harness.route("GET", "/api/leadgrid/leads/:id/meeting-notes")(
      request({ id: leadId }),
      result.response,
      vi.fn(),
    );

    expect(result.status()).toBe(404);
    expect(result.body()).toEqual({ error: "ikke_funnet" });
    expect(harness.query).not.toHaveBeenCalled();
  });

  it.each([
    ["GET", "/api/leadgrid/meeting-notes/:id"],
    ["POST", "/api/leadgrid/meeting-notes/:id/reprocess"],
    ["DELETE", "/api/leadgrid/meeting-notes/:id"],
  ])(
    "authorizes the persisted note-to-lead tuple for %s %s",
    async (method, path) => {
      const query = vi.fn().mockResolvedValueOnce({
        rows: [
          {
            id: noteId,
            lead_id: leadId,
            organization_id: organizationId,
            project_id: projectId,
          },
        ],
        rowCount: 1,
      });
      leadAccessMocks.load.mockResolvedValue(null);
      const harness = setupHarness(query);
      const result = responseHarness();

      await harness.route(method, path)(
        request({ id: noteId }),
        result.response,
        vi.fn(),
      );

      expect(result.status()).toBe(404);
      expect(query).toHaveBeenCalledTimes(1);
      expect(String(query.mock.calls[0][0])).toContain(
        "lead.organization_id = mn.organization_id",
      );
    },
  );

  it("rejects a note when the accessible lead no longer matches its persisted project", async () => {
    const query = vi.fn().mockResolvedValueOnce({
      rows: [
        {
          id: noteId,
          lead_id: leadId,
          organization_id: organizationId,
          project_id: projectId,
        },
      ],
    });
    leadAccessMocks.load.mockResolvedValue({
      id: leadId,
      organizationId,
      projectId: "another-project",
    });
    const harness = setupHarness(query);
    const result = responseHarness();

    await harness.route("GET", "/api/leadgrid/meeting-notes/:id")(
      request({ id: noteId }),
      result.response,
      vi.fn(),
    );

    expect(result.status()).toBe(404);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("binds the background processor to note, lead, organization and project", () => {
    const source = readFileSync(
      new URL("./leadgrid-meeting-notes-service.ts", import.meta.url),
      "utf8",
    );
    expect(source).toContain("scope: MeetingNoteProcessingScope");
    expect(source).toContain("AND mn.lead_id = $2::uuid");
    expect(source).toContain("AND mn.organization_id = $3::uuid");
    expect(source).toContain("AND lead.project_id = $4");
    expect(source).not.toContain(
      "processMeetingNote(\n  pool: Pool,\n  noteId: string",
    );
    expect(source).toContain("): Promise<boolean>");
    expect(source).toContain("if (!result.rows.length) return false");
  });
});
