import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveOrgIdForUser: vi.fn(async () => "11111111-1111-4111-8111-111111111111"),
  assertAnyEntitled: vi.fn(async () => true),
}));

vi.mock("./leadgrid-org-resolver.js", () => ({
  resolveOrgIdForUser: mocks.resolveOrgIdForUser,
}));
vi.mock("./leadgrid-entitlement-guard.js", () => ({
  assertAnyEntitled: mocks.assertAnyEntitled,
  LEADBOOK_AI_STRUKTUR_FEATURE_KEYS: ["leadbookAiStruktur"],
}));
vi.mock("./lead-map-apns-client.js", () => ({
  sendAPNs: vi.fn(async () => ({ sent: true, shouldDisableToken: false })),
}));
vi.mock("./leadgrid-ai-queue.js", () => ({
  withAIQuota: vi.fn(),
}));

import { registerLeadgridLeadbookExamplesRoutes } from "./leadgrid-leadbook-examples-routes.js";
import { registerLeadgridAcademyRoutes } from "./leadgrid-academy-routes.js";

const session = {
  userId: "seller-1", email: "seller@example.no", name: "Selger En", role: "member",
};
const exampleId = "22222222-2222-4222-8222-222222222222";
const consentId = "33333333-3333-4333-8333-333333333333";
const creationId = "44444444-4444-4444-8444-444444444444";
const organizationId = "11111111-1111-4111-8111-111111111111";

function appWith(register: (deps: any) => void, query: ReturnType<typeof vi.fn>) {
  const app = express();
  app.use(express.json());
  register({ app, pool: { query }, requireUserSession: () => session });
  return app;
}

describe("Leadbook hardened example contract", () => {
  beforeEach(() => vi.clearAllMocks());

  it("binds recording consent and a seller draft to the current tenant identity", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("SELECT role FROM organization_members")) return { rows: [{ role: "salgskonsulent" }] };
      if (sql.includes("FROM leadbook_recording_consents")) return { rows: [{ customer_label: "Kunde A" }] };
      if (sql.includes("INSERT INTO leadbook_examples")) return { rows: [{ id: exampleId }] };
      return { rows: [] };
    });
    const response = await request(appWith(registerLeadgridLeadbookExamplesRoutes, query))
      .post("/api/leadgrid/leadbook/examples")
      .send({
        title: "Samtale", status: "published", channel: "phone",
        seller_user_id: "other-user", seller_name: "Annen",
        source_consent_id: consentId, creation_id: creationId,
      });
    expect(response.status).toBe(201);
    const consent = query.mock.calls.find(([sql]) => String(sql).includes("FROM leadbook_recording_consents"));
    expect(consent?.[1]).toEqual([consentId, organizationId, session.userId]);
    const insert = query.mock.calls.find(([sql]) => String(sql).includes("INSERT INTO leadbook_examples"));
    expect(String(insert?.[0])).toContain("ON CONFLICT (organization_id, creation_id)");
    expect(insert?.[1]?.[2]).toBe("draft");
    expect(insert?.[1]?.[7]).toBe("telephone");
    expect(insert?.[1]?.[9]).toBe(session.userId);
    expect(insert?.[1]?.[23]).toBe(consentId);
    expect(insert?.[1]?.[24]).toBe(creationId);
  });

  it("rejects a consent id that is not owned by the same user and org", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("SELECT role FROM organization_members")) return { rows: [{ role: "salgskonsulent" }] };
      return { rows: [] };
    });
    const response = await request(appWith(registerLeadgridLeadbookExamplesRoutes, query))
      .post("/api/leadgrid/leadbook/examples")
      .send({ title: "Samtale", source_consent_id: consentId, creation_id: creationId });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("ugyldig_source_consent");
    expect(query.mock.calls.some(([sql]) => String(sql).includes("INSERT INTO leadbook_examples"))).toBe(false);
  });

  it("returns the existing id for a retried create action", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("SELECT role FROM organization_members")) return { rows: [{ role: "salgskonsulent" }] };
      if (sql.includes("INSERT INTO leadbook_examples")) return { rows: [] };
      if (sql.includes("creation_id = $2")) return { rows: [{ id: exampleId }] };
      return { rows: [] };
    });
    const response = await request(appWith(registerLeadgridLeadbookExamplesRoutes, query))
      .post("/api/leadgrid/leadbook/examples")
      .send({ title: "Retry", creation_id: creationId });
    expect(response.status).toBe(200);
    expect(response.body.id).toBe(exampleId);
  });

  it("paginates a summary without transcript and exposes own-draft capability", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("SELECT role FROM organization_members")) return { rows: [{ role: "salgskonsulent" }] };
      if (sql.includes("FROM leadbook_examples") && sql.includes("ORDER BY created_at")) {
        return { rows: [{
          id: exampleId, title: "Kort", status: "draft", seller_user_id: session.userId,
          created_at: "2026-09-04T10:00:00.000Z",
        }] };
      }
      return { rows: [] };
    });
    const response = await request(appWith(registerLeadgridLeadbookExamplesRoutes, query))
      .get("/api/leadgrid/leadbook/examples?limit=1");
    expect(response.status).toBe(200);
    expect(response.body.canCreateDraft).toBe(true);
    expect(response.body.examples[0].can_request_deletion).toBe(true);
    const list = query.mock.calls.find(([sql]) => String(sql).includes("ORDER BY created_at"));
    expect(String(list?.[0])).not.toContain("transcript");
    expect(list?.[1]?.at(-1)).toBe(2);
  });

  it("returns 404 instead of leaking a hidden draft detail", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("SELECT role FROM organization_members")) {
        return { rows: [{ role: "salgskonsulent" }] };
      }
      return { rows: [], rowCount: 0 };
    });
    const response = await request(appWith(registerLeadgridLeadbookExamplesRoutes, query))
      .get(`/api/leadgrid/leadbook/examples/${exampleId}`);
    expect(response.status).toBe(404);
    const detail = query.mock.calls.find(([sql]) => String(sql).includes("SELECT * FROM leadbook_examples"));
    expect(String(detail?.[0])).toContain("organization_id = $2");
    expect(String(detail?.[0])).toContain("seller_user_id = $4");
    expect(detail?.[1]).toEqual([exampleId, organizationId, false, session.userId]);
  });

  it("does not count a view for an invisible example", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("SELECT role FROM organization_members")) {
        return { rows: [{ role: "salgskonsulent" }] };
      }
      return { rows: [], rowCount: 0 };
    });
    const response = await request(appWith(registerLeadgridLeadbookExamplesRoutes, query))
      .post(`/api/leadgrid/leadbook/examples/${exampleId}/view`);
    expect(response.status).toBe(404);
    expect(query.mock.calls.some(([sql]) => String(sql).includes("INSERT INTO leadbook_example_views"))).toBe(false);
  });

  it("rejects invalid bounds before writing an example", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("SELECT role FROM organization_members")) {
        return { rows: [{ role: "salgssjef" }] };
      }
      return { rows: [] };
    });
    const response = await request(appWith(registerLeadgridLeadbookExamplesRoutes, query))
      .post("/api/leadgrid/leadbook/examples")
      .send({ title: "Ugyldig", duration_sec: 86401, pondus_score: 101 });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("ugyldig_tallverdi");
    expect(query.mock.calls.some(([sql]) => String(sql).includes("INSERT INTO leadbook_examples"))).toBe(false);
  });

  it("returns the existing feedback for an idempotent leader retry", async () => {
    const feedbackId = "77777777-7777-4777-8777-777777777777";
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("SELECT role FROM organization_members")) {
        return { rows: [{ role: "teamleder" }] };
      }
      if (sql.includes("SELECT id, title, seller_user_id FROM leadbook_examples")) {
        return { rows: [{ id: exampleId, title: "Samtale", seller_user_id: session.userId }] };
      }
      if (sql.includes("INSERT INTO leadbook_example_feedback")) return { rows: [] };
      if (sql.includes("client_action_id = $2")) return { rows: [{ id: feedbackId }] };
      return { rows: [] };
    });
    const response = await request(appWith(registerLeadgridLeadbookExamplesRoutes, query))
      .post(`/api/leadgrid/leadbook/examples/${exampleId}/feedback`)
      .send({ body: "Bra", client_action_id: creationId });
    expect(response.status).toBe(200);
    expect(response.body.id).toBe(feedbackId);
  });

  it("scopes feedback replies to the active organization", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("SELECT role FROM organization_members")) {
        return { rows: [{ role: "salgskonsulent" }] };
      }
      return { rows: [] };
    });
    const response = await request(appWith(registerLeadgridLeadbookExamplesRoutes, query))
      .post(`/api/leadgrid/leadbook/feedback/${exampleId}/replies`)
      .send({ body: "Svar", client_action_id: creationId });
    expect(response.status).toBe(404);
    const lookup = query.mock.calls.find(([sql]) => String(sql).includes("JOIN leadbook_examples"));
    expect(String(lookup?.[0])).toContain("f.organization_id = $2");
    expect(lookup?.[1]).toEqual([exampleId, organizationId]);
  });
});

describe("Academy tenant contract", () => {
  beforeEach(() => vi.clearAllMocks());

  it("refuses progress for a chapter outside visible published courses", async () => {
    const query = vi.fn(async () => ({ rows: [] }));
    const app = appWith(registerLeadgridAcademyRoutes, query);
    const response = await request(app).post("/api/leadgrid/academy/progress").send({
      chapter_id: "55555555-5555-4555-8555-555555555555", watched: true,
    });
    expect(response.status).toBe(404);
    expect(response.body.error).toBe("chapter_not_visible");
    expect(query.mock.calls.some(([sql]) => String(sql).includes("INSERT INTO leadgrid_academy_progress"))).toBe(false);
  });

  it("accepts a Leadgrid team leader as an Academy manager", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("WHERE EXISTS")) return { rows: [{ "?column?": 1 }] };
      if (sql.includes("INSERT INTO leadgrid_academy_courses")) {
        return { rows: [{ id: "66666666-6666-4666-8666-666666666666" }] };
      }
      return { rows: [] };
    });
    const response = await request(appWith(registerLeadgridAcademyRoutes, query))
      .post("/api/leadgrid/academy/courses")
      .send({ title: "Org-kurs" });
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("created");
    const roleQuery = query.mock.calls.find(([sql]) => String(sql).includes("WHERE EXISTS"));
    expect(String(roleQuery?.[0])).toContain("'salgssjef', 'teamleder'");
  });
});
