import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const access = {
  organizationId: "11111111-1111-4111-8111-111111111111",
  projectId: "dentum-oslo",
  organizationRole: "salgssjef",
  permissions: new Set(["analytics.view_overview"]),
  platformAdmin: false,
};

vi.mock("./pondus-access.js", () => ({
  resolvePondusAccess: vi.fn(async () => access),
  assertPondusEntitled: vi.fn(async () => true),
  isPondusTemplateVisible: vi.fn(async () => true),
  canViewPondusAnalytics: vi.fn(() => true),
  canManagePondus: vi.fn(() => true),
  sendPondusAccessError: vi.fn(() => false),
}));

import { registerPondusUsageRoutesV2 } from "./pondus-usage-routes-v2.js";
import { registerPondusTemplateRoutesV2 } from "./pondus-template-routes-v2.js";
import { registerLeadgridPondusQuizRoutes } from "./leadgrid-pondus-quiz-routes.js";

const session = {
  userId: "user-1", email: "selger@example.no", name: "Selger", role: "member",
};

function appWith(register: (deps: any) => void, query: ReturnType<typeof vi.fn>) {
  const app = express();
  app.use(express.json());
  register({ app, pool: { query }, requireUserSession: () => session });
  return app;
}

describe("Pondus usage v2", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires a canonical usage session id", async () => {
    const query = vi.fn();
    const app = appWith(registerPondusUsageRoutesV2, query);
    const response = await request(app)
      .post("/api/leadgrid/pondus/templates/22222222-2222-4222-8222-222222222222/usage")
      .send({ outcome: "used" });
    expect(response.status).toBe(400);
    expect(response.body.issues).toContainEqual(expect.objectContaining({ path: "usage_session_id" }));
    expect(query).not.toHaveBeenCalled();
  });

  it("creates an idempotent exact session", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("INSERT INTO pondus_template_usage")) {
        return { rows: [{ id: "usage-1", usage_session_id: "33333333-3333-4333-8333-333333333333", outcome: "used" }] };
      }
      return { rows: [] };
    });
    const app = appWith(registerPondusUsageRoutesV2, query);
    const response = await request(app)
      .post("/api/leadgrid/pondus/templates/22222222-2222-4222-8222-222222222222/usage")
      .send({ usage_session_id: "33333333-3333-4333-8333-333333333333", outcome: "used", source: "ipad" });
    expect(response.status).toBe(201);
    const insert = query.mock.calls.find(([sql]) => String(sql).includes("INSERT INTO pondus_template_usage"));
    expect(String(insert?.[0])).toContain("ON CONFLICT (usage_session_id) DO NOTHING");
    expect(insert?.[1]?.[0]).toBe("33333333-3333-4333-8333-333333333333");
    expect(insert?.[1]?.[3]).toBe("dentum-oslo");
  });

  it("requires an authoritative project for every usage write", async () => {
    const previous = access.projectId;
    access.projectId = null as unknown as string;
    try {
      const query = vi.fn();
      const app = appWith(registerPondusUsageRoutesV2, query);
      const response = await request(app)
        .post("/api/leadgrid/pondus/templates/22222222-2222-4222-8222-222222222222/usage")
        .send({
          usage_session_id: "33333333-3333-4333-8333-333333333333",
          outcome: "used",
        });
      expect(response.status).toBe(400);
      expect(response.body.error).toBe("project_required");
    } finally {
      access.projectId = previous;
    }
  });

  it("updates outcome by exact session and never by a time heuristic", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("UPDATE pondus_template_usage")) {
        return { rows: [{ id: "usage-1", outcome: "meeting_booked" }] };
      }
      return { rows: [] };
    });
    const app = appWith(registerPondusUsageRoutesV2, query);
    const response = await request(app)
      .post("/api/leadgrid/pondus/templates/22222222-2222-4222-8222-222222222222/usage")
      .send({ usage_session_id: "33333333-3333-4333-8333-333333333333", outcome: "meeting_booked" });
    expect(response.status).toBe(200);
    const update = query.mock.calls.find(([sql]) => String(sql).includes("UPDATE pondus_template_usage"));
    expect(String(update?.[0])).toContain("usage_session_id=$3::uuid");
    expect(String(update?.[0])).not.toContain("INTERVAL '1 hour'");
  });

  it("persists an outcome that arrives before the queued start event", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("UPDATE pondus_template_usage")) return { rows: [] };
      if (sql.includes("INSERT INTO pondus_template_usage")) {
        return { rows: [{ id: "usage-1", outcome: "meeting_booked" }] };
      }
      return { rows: [] };
    });
    const app = appWith(registerPondusUsageRoutesV2, query);
    const response = await request(app)
      .post("/api/leadgrid/pondus/templates/22222222-2222-4222-8222-222222222222/usage")
      .send({
        usage_session_id: "33333333-3333-4333-8333-333333333333",
        outcome: "meeting_booked",
        source: "ipad",
      });
    expect(response.status).toBe(201);
    const insert = query.mock.calls.find(([sql]) => String(sql).includes("INSERT INTO pondus_template_usage"));
    expect(String(insert?.[0])).toContain("ON CONFLICT (usage_session_id) DO NOTHING");
    expect(insert?.[1]?.[0]).toBe("33333333-3333-4333-8333-333333333333");
  });

  it("scopes every usage aggregate to the active project", async () => {
    const query = vi.fn(async () => ({ rows: [] }));
    const app = appWith(registerPondusUsageRoutesV2, query);
    const response = await request(app)
      .get("/api/leadgrid/pondus/usage/stats?period=30d");

    expect(response.status).toBe(200);
    expect(query).toHaveBeenCalledTimes(2);
    for (const [sql, values] of query.mock.calls) {
      expect(String(sql)).toContain("organization_id=$1::uuid AND project_id=$2");
      expect(values).toEqual([access.organizationId, "dentum-oslo"]);
    }
  });
});

describe("Pondus template concurrency", () => {
  it("lists only global, organization-shared, or active-project templates", async () => {
    const query = vi.fn(async () => ({ rows: [] }));
    const app = appWith(registerPondusTemplateRoutesV2, query);
    const response = await request(app)
      .get("/api/leadgrid/pondus/templates?published=all");

    expect(response.status).toBe(200);
    expect(response.body.templates).toEqual([]);
    const [sql, values] = query.mock.calls[0];
    expect(String(sql)).toContain("project_id = $2");
    expect(String(sql)).toContain("project_id IS NULL");
    expect(values).toEqual([access.organizationId, "dentum-oslo"]);
  });

  it("normalizes legacy objections before returning native templates", async () => {
    const query = vi.fn(async () => ({
      rows: [{
        id: "22222222-2222-4222-8222-222222222222",
        name: "Legacy-mal",
        category: "custom",
        kind: "telephone",
        score: 50,
        steps: [],
        objections: [{ objection: "Ikke nå", response: "Når passer det bedre?" }],
        is_published: true,
        version: 1,
      }],
    }));
    const app = appWith(registerPondusTemplateRoutesV2, query);

    const response = await request(app).get("/api/leadgrid/pondus/templates");

    expect(response.status).toBe(200);
    expect(response.body.templates[0].objections).toEqual([{
      id: "legacy_objection_1",
      prompt: "Ikke nå",
      response: "Når passer det bedre?",
    }]);
  });

  it("uses explicit PostgreSQL types for reused create parameters", async () => {
    const query = vi.fn(async (sql: string) => ({
      rows: String(sql).includes("INSERT INTO pondus_templates")
        ? [{
            id: "22222222-2222-4222-8222-222222222222",
            name: "E2E-mal",
            category: "custom",
            kind: "telephone",
            score: 50,
            steps: [],
            objections: [],
            analysis: {},
            analysis_meta: {},
            org_id: access.organizationId,
            is_published: true,
            version: 1,
          }]
        : [],
    }));
    const app = appWith(registerPondusTemplateRoutesV2, query);
    const response = await request(app)
      .post("/api/leadgrid/pondus/templates")
      .send({ name: "E2E-mal", category: "custom", kind: "telephone", steps: [], objections: [] });
    expect(response.status).toBe(201);
    const insert = query.mock.calls.find(([sql]) => String(sql).includes("INSERT INTO pondus_templates"));
    expect(String(insert?.[0])).toContain("$10::varchar(255)");
    expect(String(insert?.[0])).toContain("$13::boolean");
    expect(insert?.[1]?.[11]).toBe("dentum-oslo");
  });

  it("requires an expected version before publish", async () => {
    const query = vi.fn();
    const app = appWith(registerPondusTemplateRoutesV2, query);
    const response = await request(app)
      .post("/api/leadgrid/pondus/templates/22222222-2222-4222-8222-222222222222/publish")
      .send({ published: true });
    expect(response.status).toBe(428);
    expect(response.body.error).toBe("expected_version_required");
    expect(query).not.toHaveBeenCalled();
  });
});

describe("Pondus quiz API", () => {
  it("ignores client scores and persists the server-scored answer bank", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("INSERT INTO leadgrid_pondus_quiz_results")) {
        return { rows: [{ id: 1, user_id: "user-1", total: 42, scoring_version: "pondus-quiz-2026-09-1" }] };
      }
      return { rows: [] };
    });
    const app = appWith(registerLeadgridPondusQuizRoutes, query);
    const answers = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`q${i + 1}`, 0]));
    const response = await request(app).post("/api/leadgrid/pondus/quiz")
      .send({ total: 100, autoritet: 100, answers });
    expect(response.status).toBe(200);
    const insert = query.mock.calls.find(([sql]) => String(sql).includes("INSERT INTO leadgrid_pondus_quiz_results"));
    expect(insert?.[1]?.[9]).toBe(JSON.stringify(answers));
    expect(insert?.[1]?.[10]).toBe("pondus-quiz-2026-09-1");
    expect(insert?.[1]?.[8]).not.toBe(100);
  });
});
