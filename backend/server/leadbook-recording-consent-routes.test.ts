import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveOrg: vi.fn(),
  loadProject: vi.fn(),
  loadComplianceProject: vi.fn(),
  assertExamples: vi.fn(),
  anonymizeText: vi.fn((value: string) => `anon:${value}`),
  anonymizeTranscript: vi.fn(() => [
    { speaker: "Selger", text: "[anonymisert]" },
  ]),
}));

vi.mock("./leadgrid-org-resolver.js", () => ({
  resolveOrgIdForUser: mocks.resolveOrg,
}));
vi.mock("./leadgrid-project-access.js", () => ({
  loadAccessibleLeadgridProject: mocks.loadProject,
  loadAccessibleLeadgridProjectForCompliance: mocks.loadComplianceProject,
}));
vi.mock("./leadgrid-entitlement-guard.js", () => ({
  assertAnyEntitledForOrganization: mocks.assertExamples,
  LEADBOOK_LYDOPPTAK_FEATURE_KEY: "leadbookLydopptak",
}));
vi.mock("./leadgrid-leadbook-examples-routes.js", () => ({
  anonymizeText: mocks.anonymizeText,
  anonymizeTranscript: mocks.anonymizeTranscript,
}));

import { registerLeadbookRecordingConsentRoutes } from
  "./leadbook-recording-consent-routes.js";

const orgId = "11111111-1111-4111-8111-111111111111";
const projectId = "dentum-oslo";
const exampleId = "22222222-2222-4222-8222-222222222222";
const session = {
  userId: "seller-1",
  email: "seller@example.no",
  name: "Selger En",
  role: "member",
};

type QueryResult = { rows: unknown[]; rowCount: number | null };
type QueryImpl = (sql: string, values?: unknown[]) => Promise<QueryResult>;

const result = (
  rows: unknown[] = [],
  rowCount: number | null = rows.length,
): QueryResult => ({ rows, rowCount });

const sqlText = (sql: unknown) => String(sql).replace(/\s+/g, " ").trim();

function accessibleProject(memberRole = "salgskonsulent") {
  return {
    id: projectId,
    organizationId: orgId,
    memberRole,
    name: "Dentum",
    description: null,
    industry: "tannhelse",
    status: "active",
    createdBy: "owner-1",
  };
}

function harness(
  clientImpl: QueryImpl = async () => result(),
  poolImpl: QueryImpl = async () => result(),
  sessionValue = session,
) {
  const clientQuery = vi.fn(clientImpl);
  const release = vi.fn();
  const connect = vi.fn(async () => ({ query: clientQuery, release }));
  const poolQuery = vi.fn(poolImpl);
  const app = express();
  app.use(express.json());
  registerLeadbookRecordingConsentRoutes({
    app,
    pool: { query: poolQuery, connect } as never,
    requireUserSession: () => sessionValue,
  });
  return { app, clientQuery, poolQuery, connect, release };
}

describe("Leadbook recording/deletion project scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveOrg.mockResolvedValue(orgId);
    mocks.assertExamples.mockResolvedValue(true);
    mocks.loadProject.mockResolvedValue(accessibleProject());
    mocks.loadComplianceProject.mockResolvedValue(accessibleProject());
  });

  it("rejects a deletion request without a project before touching storage", async () => {
    const h = harness();
    const response = await request(h.app)
      .post(`/api/leadgrid/leadbook/examples/${exampleId}/request-deletion`)
      .send({});
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("project_id_required");
    expect(mocks.loadProject).not.toHaveBeenCalled();
    expect(mocks.loadComplianceProject).not.toHaveBeenCalled();
    expect(h.connect).not.toHaveBeenCalled();
  });

  it("returns 404 when the caller cannot access the requested project", async () => {
    mocks.loadComplianceProject.mockResolvedValue(null);
    const h = harness();
    const response = await request(h.app)
      .post(`/api/leadgrid/leadbook/examples/${exampleId}/request-deletion`)
      .send({ projectId });
    expect(response.status).toBe(404);
    expect(response.body.error).toBe("project_not_found");
    expect(mocks.loadProject).not.toHaveBeenCalled();
    expect(h.connect).not.toHaveBeenCalled();
  });

  it("allows erasure handling for an archived project through the compliance ACL", async () => {
    mocks.loadProject.mockResolvedValue(null);
    mocks.loadComplianceProject.mockResolvedValue({
      ...accessibleProject(),
      status: "archived",
    });
    const h = harness(async (raw) => {
      const sql = sqlText(raw);
      if (["BEGIN", "COMMIT"].includes(sql)) return result();
      if (sql.startsWith("DELETE FROM leadbook_examples")) return result();
      if (sql.startsWith("UPDATE leadbook_examples")) {
        return result([{ id: exampleId }], 1);
      }
      if (sql.startsWith("SELECT DISTINCT member.user_id")) return result();
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const response = await request(h.app)
      .post(`/api/leadgrid/leadbook/examples/${exampleId}/request-deletion`)
      .send({ projectId });

    expect(response.status).toBe(200);
    expect(mocks.loadComplianceProject).toHaveBeenCalledWith(
      expect.anything(), projectId, session.userId,
    );
    expect(mocks.loadProject).not.toHaveBeenCalled();
  });

  it("still refuses a new recording consent for an archived project", async () => {
    mocks.loadProject.mockResolvedValue(null);
    mocks.loadComplianceProject.mockResolvedValue({
      ...accessibleProject(),
      status: "archived",
    });
    const h = harness();

    const response = await request(h.app)
      .post("/api/leadgrid/leadbook/recording-consent")
      .send({ projectId, consent_version: "v1" });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("project_not_found");
    expect(mocks.loadProject).toHaveBeenCalledWith(
      expect.anything(), projectId, session.userId,
    );
    expect(mocks.loadComplianceProject).not.toHaveBeenCalled();
    expect(h.poolQuery).not.toHaveBeenCalled();
  });

  it("returns 404 when the example belongs to another project", async () => {
    const h = harness(async (raw) => {
      const sql = sqlText(raw);
      if (["BEGIN", "ROLLBACK"].includes(sql)) return result();
      if (sql.startsWith("DELETE FROM leadbook_examples")) return result();
      if (sql.startsWith("UPDATE leadbook_examples")) return result();
      if (sql.startsWith("SELECT status, seller_user_id")) return result();
      throw new Error(`Unexpected SQL: ${sql}`);
    });
    const response = await request(h.app)
      .post(`/api/leadgrid/leadbook/examples/${exampleId}/request-deletion`)
      .send({ projectId });
    expect(response.status).toBe(404);
    const fallback = h.clientQuery.mock.calls.find(([sql]) =>
      sqlText(sql).startsWith("SELECT status, seller_user_id"));
    expect(sqlText(fallback?.[0])).toContain("organization_id = $2");
    expect(sqlText(fallback?.[0])).toContain("project_id = $3");
    expect(fallback?.[1]).toEqual([exampleId, orgId, projectId]);
    expect(h.clientQuery).toHaveBeenCalledWith("ROLLBACK");
  });

  it("rolls back the deletion request when a notification write fails", async () => {
    const h = harness(async (raw) => {
      const sql = sqlText(raw);
      if (["BEGIN", "ROLLBACK"].includes(sql)) return result();
      if (sql.startsWith("DELETE FROM leadbook_examples")) return result();
      if (sql.startsWith("UPDATE leadbook_examples")) {
        return result([{ id: exampleId }], 1);
      }
      if (sql.startsWith("SELECT DISTINCT member.user_id")) {
        return result([{ user_id: "leader-1" }]);
      }
      if (sql.startsWith("INSERT INTO notification_events")) {
        throw new Error("notification write failed");
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });
    const response = await request(h.app)
      .post(`/api/leadgrid/leadbook/examples/${exampleId}/request-deletion`)
      .send({ projectId });
    expect(response.status).toBe(500);
    expect(response.body.error).toBe("request_deletion_failed");
    expect(h.clientQuery).toHaveBeenCalledWith("ROLLBACK");
    expect(h.clientQuery).not.toHaveBeenCalledWith("COMMIT");
    expect(h.release).toHaveBeenCalledOnce();
  });

  it("does not create a second notification when a successful request is retried", async () => {
    let requested = false;
    const h = harness(async (raw) => {
      const sql = sqlText(raw);
      if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) return result();
      if (sql.startsWith("DELETE FROM leadbook_examples")) return result();
      if (sql.startsWith("UPDATE leadbook_examples")) {
        if (requested) return result();
        requested = true;
        return result([{ id: exampleId }], 1);
      }
      if (sql.startsWith("SELECT status, seller_user_id")) {
        return result([{
          status: "published",
          seller_user_id: session.userId,
          delete_requested_at: new Date(),
          anonymized_at: null,
        }]);
      }
      if (sql.startsWith("SELECT DISTINCT member.user_id")) {
        return result([{ user_id: "leader-1" }]);
      }
      if (sql.startsWith("INSERT INTO notification_events")) return result([], 1);
      throw new Error(`Unexpected SQL: ${sql}`);
    });
    const endpoint =
      `/api/leadgrid/leadbook/examples/${exampleId}/request-deletion`;
    const first = await request(h.app).post(endpoint).send({ projectId });
    const retry = await request(h.app).post(endpoint).send({ projectId });
    expect(first.status).toBe(200);
    expect(first.body.requested).toBe(true);
    expect(retry.status).toBe(200);
    expect(retry.body).toMatchObject({
      requested: true,
      alreadyRequested: true,
      projectId,
    });
    expect(h.clientQuery.mock.calls.filter(([sql]) =>
      sqlText(sql).startsWith("INSERT INTO notification_events"))).toHaveLength(1);
  });

  it("allows an archived row with raw PII to enter the deletion queue", async () => {
    const h = harness(async (raw) => {
      const sql = sqlText(raw);
      if (["BEGIN", "COMMIT"].includes(sql)) return result();
      if (sql.startsWith("DELETE FROM leadbook_examples")) return result();
      if (sql.startsWith("UPDATE leadbook_examples")) {
        return result([{ id: exampleId }], 1);
      }
      if (sql.startsWith("SELECT DISTINCT member.user_id")) return result();
      throw new Error(`Unexpected SQL: ${sql}`);
    });
    const response = await request(h.app)
      .post(`/api/leadgrid/leadbook/examples/${exampleId}/request-deletion`)
      .send({ projectId });
    expect(response.status).toBe(200);
    const transition = h.clientQuery.mock.calls.find(([sql]) =>
      sqlText(sql).startsWith("UPDATE leadbook_examples"));
    expect(sqlText(transition?.[0])).toContain("status IN ('published', 'archived')");
    expect(sqlText(transition?.[0])).toContain("anonymized_at IS NULL");
    expect(transition?.[1]).toEqual([
      exampleId, orgId, projectId, false, session.userId,
    ]);
  });

  it("keeps archived rows with raw PII in the project-scoped deletion queue", async () => {
    mocks.loadComplianceProject.mockResolvedValue(accessibleProject("teamleder"));
    const pending = {
      id: exampleId,
      title: "Arkivert råeksempel",
      seller_name: "Selger En",
      delete_requested_at: "2026-09-06T10:00:00.000Z",
      anonymized_at: null,
    };
    const h = harness(undefined, async (raw) => {
      const sql = sqlText(raw);
      if (sql.includes("FROM leadbook_examples")) return result([pending], 1);
      throw new Error(`Unexpected SQL: ${sql}`);
    });
    const response = await request(h.app).get(
      `/api/leadgrid/admin/leadbook/deletion-queue?projectId=${encodeURIComponent(projectId)}`,
    );
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ projectId, pendingDeletions: [pending] });
    const queue = h.poolQuery.mock.calls.find(([sql]) =>
      sqlText(sql).includes("FROM leadbook_examples"));
    expect(sqlText(queue?.[0])).toContain("organization_id = $1 AND project_id = $2");
    expect(sqlText(queue?.[0])).toContain("delete_requested_at IS NOT NULL");
    expect(sqlText(queue?.[0])).toContain("anonymized_at IS NULL");
    expect(sqlText(queue?.[0])).not.toContain("status != 'archived'");
    expect(queue?.[1]).toEqual([orgId, projectId]);
  });

  it("requires a pending request and locks the row before approval", async () => {
    mocks.loadComplianceProject.mockResolvedValue(accessibleProject("teamleder"));
    const h = harness(async (raw) => {
      const sql = sqlText(raw);
      if (["BEGIN", "ROLLBACK"].includes(sql)) return result();
      if (sql.includes("FROM leadbook_examples") && sql.includes("FOR UPDATE")) {
        return result([{
          transcript: [],
          customer_label: "Kunde",
          status: "published",
          delete_requested_at: null,
          anonymized_at: null,
        }]);
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });
    const response = await request(h.app)
      .post(`/api/leadgrid/admin/leadbook/examples/${exampleId}/approve-deletion`)
      .send({ projectId });
    expect(response.status).toBe(409);
    expect(response.body.error).toBe("deletion_not_requested");
    const locked = h.clientQuery.mock.calls.find(([sql]) =>
      sqlText(sql).includes("FOR UPDATE"));
    expect(sqlText(locked?.[0])).toContain("project_id = $3");
    expect(locked?.[1]).toEqual([exampleId, orgId, projectId]);
    expect(h.clientQuery.mock.calls.some(([sql]) =>
      sqlText(sql).startsWith("UPDATE leadbook_examples"))).toBe(false);
    expect(h.clientQuery).toHaveBeenCalledWith("ROLLBACK");
  });

  it("anonymizes an archived row that still contains raw PII", async () => {
    mocks.loadComplianceProject.mockResolvedValue(accessibleProject("teamleder"));
    const rawTranscript = [{ speaker: "Kunde", text: "Ring Ola på 99999999" }];
    const h = harness(async (raw) => {
      const sql = sqlText(raw);
      if (["BEGIN", "COMMIT"].includes(sql)) return result();
      if (sql.includes("FROM leadbook_examples") && sql.includes("FOR UPDATE")) {
        return result([{
          transcript: rawTranscript,
          customer_label: "Ola Nordmann",
          status: "archived",
          delete_requested_at: "2026-09-06T10:00:00.000Z",
          anonymized_at: null,
        }]);
      }
      if (sql.startsWith("UPDATE leadbook_examples")) {
        return result([{ id: exampleId }], 1);
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });
    const response = await request(h.app)
      .post(`/api/leadgrid/admin/leadbook/examples/${exampleId}/approve-deletion`)
      .send({ projectId });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ anonymized: true, archived: true, projectId });
    expect(mocks.anonymizeTranscript).toHaveBeenCalledWith(rawTranscript);
    expect(mocks.anonymizeText).toHaveBeenCalledWith("Ola Nordmann");
    const update = h.clientQuery.mock.calls.find(([sql]) =>
      sqlText(sql).startsWith("UPDATE leadbook_examples"));
    expect(sqlText(update?.[0])).toContain("status IN ('published', 'archived')");
    expect(sqlText(update?.[0])).toContain("delete_requested_at IS NOT NULL");
    expect(update?.[1]).toEqual([
      JSON.stringify([{ speaker: "Selger", text: "[anonymisert]" }]),
      "anon:Ola Nordmann",
      exampleId,
      orgId,
      projectId,
    ]);
    expect(h.clientQuery).toHaveBeenCalledWith("COMMIT");
  });

  it("treats only an actually anonymized archived row as already complete", async () => {
    mocks.loadComplianceProject.mockResolvedValue(accessibleProject("teamleder"));
    const h = harness(async (raw) => {
      const sql = sqlText(raw);
      if (["BEGIN", "COMMIT"].includes(sql)) return result();
      if (sql.includes("FROM leadbook_examples") && sql.includes("FOR UPDATE")) {
        return result([{
          transcript: [],
          customer_label: "Anonymisert kunde",
          status: "archived",
          delete_requested_at: null,
          anonymized_at: "2026-09-06T10:00:00.000Z",
        }]);
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });
    const response = await request(h.app)
      .post(`/api/leadgrid/admin/leadbook/examples/${exampleId}/approve-deletion`)
      .send({ projectId });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      anonymized: true,
      archived: true,
      alreadyCompleted: true,
      projectId,
    });
    expect(h.clientQuery.mock.calls.some(([sql]) =>
      sqlText(sql).startsWith("UPDATE leadbook_examples"))).toBe(false);
    expect(h.clientQuery).toHaveBeenCalledWith("COMMIT");
  });

  it("rolls back compliance acknowledgement when entitlement opening fails", async () => {
    const adminSession = { ...session, role: "super_admin" };
    const h = harness(
      async (raw) => {
        const sql = sqlText(raw);
        if (["BEGIN", "ROLLBACK"].includes(sql)) return result();
        if (sql.startsWith("INSERT INTO leadbook_recording_compliance_ack")) {
          return result([], 1);
        }
        if (sql.startsWith("INSERT INTO leadgrid_org_entitlements")) {
          throw new Error("entitlement failed");
        }
        throw new Error(`Unexpected SQL: ${sql}`);
      },
      async () => result(),
      adminSession,
    );
    const response = await request(h.app)
      .post("/api/leadgrid/org/leadbook-lydopptak-compliance")
      .send({
        checklist: {
          drofting: true,
          rutine: true,
          infoskriv: true,
          innsyn: true,
        },
      });
    expect(response.status).toBe(500);
    expect(response.body.error).toBe("compliance_ack_failed");
    expect(h.clientQuery).toHaveBeenCalledWith("ROLLBACK");
    expect(h.clientQuery).not.toHaveBeenCalledWith("COMMIT");
    expect(h.release).toHaveBeenCalledOnce();
  });
});
