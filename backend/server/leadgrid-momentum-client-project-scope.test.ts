import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const swiftRoot = new URL(
  "../../ipad/LeadMapApp/LeadMapApp/",
  import.meta.url,
);

function swift(path: string): string {
  return readFileSync(new URL(path, swiftRoot), "utf8");
}

describe("Leadgrid momentum iPad project contract", () => {
  it("requires and sends projectId for every momentum API operation", () => {
    const source = swift("Core/APIClient.swift");
    const start = source.indexOf("// MARK: - Leadgrid Momentum");
    const end = source.indexOf("// MARK: - Leadgrid Analytics", start);
    const momentumAPI = source.slice(start, end);

    expect(momentumAPI).toContain(
      "func fetchMomentumToday(projectId rawProjectId: String)",
    );
    expect(momentumAPI).toContain(
      "func fetchSalesGoal(projectId rawProjectId: String)",
    );
    expect(momentumAPI).toContain("projectId rawProjectId: String,");
    expect(momentumAPI).toContain(
      "func fetchMomentumTrend(\n        projectId rawProjectId: String,",
    );
    expect(momentumAPI).toContain(
      'URLQueryItem(name: "projectId", value: projectId)',
    );
    expect(momentumAPI).toContain('"projectId": projectId');
    expect(momentumAPI).toContain(
      "resp.projectId == projectId, resp.momentum.projectId == projectId",
    );
    expect(momentumAPI).toContain(
      "resp.projectId == projectId, resp.goal.projectId == projectId",
    );
    expect(momentumAPI).toContain("resp.trend.projectId == projectId");
    expect(momentumAPI).not.toMatch(/fetchMomentumToday\(\s*\)/);
    expect(momentumAPI).not.toMatch(/fetchSalesGoal\(\s*\)/);
    expect(momentumAPI).not.toMatch(/fetchMomentumTrend\(\s*\)/);
  });

  it("decodes authoritative project identity in every response shape", () => {
    const models = swift("Core/LeadgridMomentumModels.swift");
    for (const typeName of [
      "LeadgridMomentum",
      "LeadgridMomentumResponse",
      "LeadgridSalesGoal",
      "LeadgridSalesGoalResponse",
      "LeadgridMomentumTrend",
    ]) {
      const start = models.indexOf(`struct ${typeName}`);
      expect(start, typeName).toBeGreaterThan(-1);
      const body = models.slice(start, models.indexOf("}", start) + 1);
      expect(body, typeName).toContain("let projectId: String");
    }
    expect(models).toContain("case missingProjectID");
    expect(models).toContain("case responseProjectMismatch");
  });

  it("scopes the active overview and project-card calls and drops stale data", () => {
    const overview = swift("Views/Tabs/Oversikt/OversiktView.swift");
    const card = swift("Views/MapProjectCard.swift");

    expect(overview).toContain(
      "api.fetchMomentumToday(\n            projectId: projectId\n        )",
    );
    expect(overview).toContain(
      "guard appState.activeLeadgridProjectId == projectId else { return }",
    );
    expect(card).toContain('.task(id: "\\(project.id)|\\(isActive)")');
    expect(card).toContain(
      "api.fetchMomentumToday(projectId: project.id)",
    );
    expect(card).toContain(
      "appState.activeLeadgridProjectId == project.id,\n                  loaded.projectId == project.id",
    );
    expect(`${overview}\n${card}`).not.toMatch(/fetchMomentumToday\(\s*\)/);
  });

  it("rebinds momentum cards to the active project and guards stale responses", () => {
    const card = swift("Views/LeadgridMomentumCard.swift");
    const trend = swift("Views/LeadgridMomentumTrendChart.swift");

    for (const source of [card, trend]) {
      expect(source).toContain("@Environment(AppState.self) private var appState");
      expect(source).toContain(
        ".task(id: appState.activeLeadgridProjectId) { await load() }",
      );
      expect(source).toContain(
        "guard let projectId = appState.activeLeadgridProjectId else",
      );
      expect(source).toContain(
        "guard !Task.isCancelled, appState.activeLeadgridProjectId == projectId",
      );
    }
    expect(card).toContain("loaded.projectId == projectId");
    expect(trend).toContain("loaded.projectId == projectId");
    expect(card).toMatch(/momentum = nil\s+loading = true/);
    expect(trend).toMatch(/trend = nil\s+selectedPoint = nil\s+loading = true/);
    expect(card).not.toMatch(/fetchMomentumToday\(\s*\)/);
    expect(trend).not.toMatch(/fetchMomentumTrend\(\s*\)/);
  });

  it("keeps goal reads and writes bound to the captured active project", () => {
    const sheet = swift("Views/LeadgridSetGoalSheet.swift");
    const card = swift("Views/LeadgridMomentumCard.swift");

    expect(card).toContain(
      "LeadgridSetGoalSheet(api: api, projectId: projectId",
    );
    expect(sheet).toContain("let projectId: String");
    expect(sheet).toContain(
      "appState.activeLeadgridProjectId == projectId",
    );
    expect(sheet).toContain("api.fetchSalesGoal(projectId: projectId)");
    expect(sheet).toContain(
      "let saved = try await api.saveSalesGoal(\n                projectId: projectId,",
    );
    expect(sheet).toContain("saved.projectId == projectId");
    expect(sheet).toContain(
      ".disabled(saving || loading || !scopeIsCurrent)",
    );
    expect(sheet).not.toMatch(/fetchSalesGoal\(\s*\)/);
  });
});
