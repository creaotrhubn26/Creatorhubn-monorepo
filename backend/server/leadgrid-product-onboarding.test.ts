import { readFileSync } from "node:fs";
import type { Express, Request, RequestHandler, Response } from "express";
import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";

import { registerLeadgridOnboardingRoutes } from "./leadgrid-onboarding-routes.js";

const organizationId = "11111111-1111-4111-8111-111111111111";
const userId = "user-a";

interface MemoryState {
  current_step: string;
  steps_completed: string[];
  started_at: string;
  last_activity_at: string;
  completed_at: string | null;
  skipped_at: string | null;
  organization_id: string;
  project_id: string;
  role_track: string;
  onboarding_version: number;
}

function scopedPool(role = "admin") {
  const states = new Map<string, MemoryState>();
  const key = (params: unknown[]) => [params[0], params[1], params[2], params[3], params[4]].join("|");
  const now = "2026-09-12T08:00:00.000Z";

  const query = vi.fn();
  query.mockImplementation(async (sqlValue: string, rawParams: unknown[] = []) => {
    const sql = String(sqlValue);
    if (sql.includes("FROM leadgrid_product_onboarding_state") && !sql.includes("GROUP BY")) {
      return { rows: states.has(key(rawParams)) ? [{ ...states.get(key(rawParams))! }] : [] };
    }
    if (sql.includes("FROM leadgrid_projects p")) {
      const projectId = String(rawParams[0]);
      if (projectId === "forbidden") return { rows: [] };
      return { rows: [{
        id: projectId,
        organization_id: organizationId,
        name: projectId === "dentum" ? "Dentum" : "CreatorHub",
        description: null,
        project_type: "sales",
        industry: "professional_services",
        status: "active",
        created_by: "someone-else",
        member_role: role,
      }] };
    }
    if (sql.includes("INSERT INTO leadgrid_product_onboarding_state")) {
      const stateKey = key(rawParams);
      if (states.has(stateKey)) return { rows: [] };
      const row: MemoryState = {
        current_step: "welcome",
        steps_completed: [],
        started_at: now,
        last_activity_at: now,
        completed_at: null,
        skipped_at: null,
        organization_id: String(rawParams[1]),
        project_id: String(rawParams[2]),
        role_track: String(rawParams[3]),
        onboarding_version: Number(rawParams[4]),
      };
      states.set(stateKey, row);
      return { rows: [{ ...row }] };
    }
    if (sql.includes("SET current_step = $1")) {
      const stateKey = key([
        rawParams[2], rawParams[3], rawParams[4], rawParams[5], rawParams[6],
      ]);
      const row = states.get(stateKey);
      if (!row || row.current_step !== rawParams[1]) return { rows: [] };
      row.current_step = String(rawParams[0]);
      if (!row.steps_completed.includes(String(rawParams[1]))) {
        row.steps_completed.push(String(rawParams[1]));
      }
      if (row.current_step === "completed") row.completed_at = now;
      return { rows: [{ ...row }] };
    }
    if (sql.includes("SET current_step = 'skipped'")) {
      const row = states.get(key(rawParams));
      if (row && !["completed", "skipped"].includes(row.current_step)) {
        row.current_step = "skipped";
        row.skipped_at = now;
      }
      return { rows: [] };
    }
    return { rows: [] };
  });

  return { pool: { query } as unknown as Pool, states, query };
}

function harness(pool: Pool) {
  const routes = new Map<string, RequestHandler>();
  const app = {
    get(path: string, handler: RequestHandler) { routes.set(`GET ${path}`, handler); },
    post(path: string, handler: RequestHandler) { routes.set(`POST ${path}`, handler); },
  } as unknown as Express;
  registerLeadgridOnboardingRoutes({
    app,
    pool,
    activeSessions: new Map([["token-a", { userId }]]),
  });

  return async function request(
    method: "GET" | "POST",
    path: string,
    options: { projectId?: string; body?: Record<string, unknown>; authenticated?: boolean } = {},
  ) {
    const handler = routes.get(`${method} ${path}`);
    if (!handler) throw new Error(`Missing route ${method} ${path}`);
    const authenticated = options.authenticated !== false;
    const req = {
      method,
      query: method === "GET" && options.projectId ? { projectId: options.projectId } : {},
      body: method === "POST"
        ? { ...(options.body ?? {}), ...(options.projectId ? { projectId: options.projectId } : {}) }
        : {},
      headers: authenticated ? { authorization: "Bearer token-a" } : {},
      get(name: string) {
        return name.toLowerCase() === "authorization" && authenticated
          ? "Bearer token-a"
          : undefined;
      },
    } as unknown as Request;
    let status = 200;
    let payload: any;
    const res = {
      status(value: number) { status = value; return this; },
      json(value: unknown) { payload = value; return this; },
    } as unknown as Response;
    await handler(req, res, vi.fn());
    return { status, payload };
  };
}

describe("Leadgrid product onboarding", () => {
  it("requires authentication and an accessible customer project", async () => {
    const { pool } = scopedPool();
    const request = harness(pool);
    await expect(request("GET", "/api/leadgrid/onboarding/state", { projectId: "dentum", authenticated: false }))
      .resolves.toMatchObject({ status: 401 });
    await expect(request("GET", "/api/leadgrid/onboarding/state"))
      .resolves.toMatchObject({ status: 400 });
    await expect(request("GET", "/api/leadgrid/onboarding/state", { projectId: "forbidden" }))
      .resolves.toMatchObject({ status: 404 });
  });

  it("creates independent v2 state for each user, organization, project and effective role", async () => {
    const { pool, states } = scopedPool("admin");
    const request = harness(pool);
    const dentum = await request("GET", "/api/leadgrid/onboarding/state", { projectId: "dentum" });
    const creatorhub = await request("GET", "/api/leadgrid/onboarding/state", { projectId: "creatorhub" });

    expect(dentum).toMatchObject({
      status: 200,
      payload: {
        eligible: true,
        is_new: true,
        state: {
          current_step: "welcome",
          project_id: "dentum",
          organization_id: organizationId,
          role_track: "admin",
          onboarding_version: 2,
        },
      },
    });
    expect(creatorhub.payload.state.project_id).toBe("creatorhub");
    expect(states.size).toBe(2);
  });

  it("accepts canonical fromStep, rejects from_step and makes retries idempotent", async () => {
    const { pool } = scopedPool();
    const request = harness(pool);
    await request("GET", "/api/leadgrid/onboarding/state", { projectId: "dentum" });

    const wrongCase = await request("POST", "/api/leadgrid/onboarding/advance", {
      projectId: "dentum",
      body: { from_step: "welcome" },
    });
    expect(wrongCase.status).toBe(400);

    const advanced = await request("POST", "/api/leadgrid/onboarding/advance", {
      projectId: "dentum",
      body: { fromStep: "welcome" },
    });
    expect(advanced).toMatchObject({
      status: 200,
      payload: { ok: true, next_step: "choose_project" },
    });

    const replay = await request("POST", "/api/leadgrid/onboarding/advance", {
      projectId: "dentum",
      body: { fromStep: "welcome" },
    });
    expect(replay).toMatchObject({
      status: 200,
      payload: { ok: true, next_step: "choose_project" },
    });

    const stale = await request("POST", "/api/leadgrid/onboarding/advance", {
      projectId: "dentum",
      body: { fromStep: "find_candidates" },
    });
    expect(stale).toMatchObject({
      status: 409,
      payload: { error: "onboarding_step_conflict", current_step: "choose_project" },
    });
  });

  it("declares the complete composite scope and project foreign key in migration 0586", () => {
    const migration = readFileSync(
      new URL("../migrations/0587_leadgrid_product_onboarding_scope.sql", import.meta.url),
      "utf8",
    );
    expect(migration).toContain(
      "user_id, organization_id, project_id, role_track, onboarding_version",
    );
    expect(migration).toContain("FOREIGN KEY (organization_id, project_id)");
    expect(migration).toContain("REFERENCES leadgrid_projects(organization_id, id)");
    expect(migration).toContain("'find_candidates'");
    expect(migration).toContain("'approve_candidates'");
  });

  it("mounts the current guide and keeps native discovery and empty states actionable", () => {
    const webTour = readFileSync(
      new URL("../../frontend/client/src/components/leadgrid/OnboardingTour.tsx", import.meta.url),
      "utf8",
    );
    expect(webTour).toContain("JSON.stringify({ fromStep: state.current_step, projectId })");
    expect(webTour).toContain("CRM-lead under Leads");
    expect(webTour).not.toMatch(/add_first_customer|see_portal|try_playbook|view_apis/);

    for (const page of ["leadgrid-import.tsx", "leadgrid-deals.tsx", "leadgrid-workflows.tsx"]) {
      const source = readFileSync(
        new URL(`../../frontend/client/src/pages/${page}`, import.meta.url),
        "utf8",
      );
      expect(source).toContain("<OnboardingTour projectId={projectId} />");
    }

    const apiClient = readFileSync(
      new URL("../../ipad/LeadMapApp/LeadMapApp/Core/APIClient.swift", import.meta.url),
      "utf8",
    );
    expect(apiClient).toContain('body: ["fromStep": fromStep, "projectId": projectId]');

    const discovery = readFileSync(
      new URL(
        "../../ipad/LeadMapApp/LeadMapApp/Views/Discovery/DiscoveryWorkspaceView.swift",
        import.meta.url,
      ),
      "utf8",
    );
    expect(discovery).toContain("Ingen forslag blir leads eller kartnåler før du godkjenner dem.");
    expect(discovery).not.toContain("legges i Leadbook");

    const leads = readFileSync(
      new URL("../../ipad/LeadMapApp/LeadMapApp/Views/Tabs/Leads/LeadsView.swift", import.meta.url),
      "utf8",
    );
    expect(leads).toContain('accessibilityIdentifier("leads.empty.discovery")');
    expect(leads).toContain('accessibilityIdentifier("leads.empty.import")');
    expect(leads).toContain('accessibilityIdentifier("leads.empty.manual")');
    expect(leads).not.toContain("skru på demo-modus");

    const meetings = readFileSync(
      new URL(
        "../../ipad/LeadMapApp/LeadMapApp/Views/Tabs/Moeter/MeetingsView.swift",
        import.meta.url,
      ),
      "utf8",
    );
    expect(meetings).toContain('Label("Åpne Leads"');
    expect(meetings).toContain('identifier: "meetings.empty-today.open-leads"');
    expect(meetings).toContain('identifier: "meetings.empty-upcoming.open-leads"');
    expect(meetings).not.toContain("skru på demo-modus");
  });
});
