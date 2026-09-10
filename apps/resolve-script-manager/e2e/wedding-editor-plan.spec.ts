import { expect, test } from "@playwright/test";
import { buildWeddingEditorPlan, type WeddingEditorPlanInput } from "../src/lib/weddingEditorPlan";
import { installTauriMock } from "./fixtures/tauri-mock";

const READY_INPUT: WeddingEditorPlanInput = {
  resolveReady: true,
  projectName: "Nora og Elias",
  sourceCount: 2,
  cameraCount: 3,
  clipCount: 184,
  multicamGroupCount: 4,
  multicamRequested: false,
  externalAudioRequested: true,
  externalAudioMatchCount: 12,
  selectedSongCount: 3,
  pickCount: 46,
  picksPath: "/tmp/nora-elias-picks.json",
  deliverables: { longFilm: true, highlight: true, teaser: false },
  backupManifestPath: "/tmp/nora-elias-manifest.json",
  projectSettingsAvailable: true,
  lutRequested: false,
};

test("Wedding Editor-plan blokkerer skriving når preflight mangler", () => {
  const plan = buildWeddingEditorPlan({
    ...READY_INPUT,
    resolveReady: false,
    clipCount: 0,
    pickCount: 0,
    picksPath: null,
    deliverables: { longFilm: false, highlight: false, teaser: false },
  });

  expect(plan.readiness).toBe("blocked");
  expect(plan.requiresApproval).toBe(true);
  expect(plan.blockers).toHaveLength(4);
  expect(plan.steps.find((step) => step.id === "build-timelines")?.enabled).toBe(false);
  expect(plan.steps.find((step) => step.id === "timeline-qc")?.mode).toBe("read-only");
});

test("Wedding Editor-plan beskriver godkjent timeline-bygg og separat QC-marker-steg", () => {
  const plan = buildWeddingEditorPlan({
    ...READY_INPUT,
    multicamRequested: true,
    lutRequested: true,
  });

  expect(plan.readiness).toBe("ready");
  expect(plan.deliverables).toEqual(["Langfilm", "Highlight"]);
  expect(plan.steps.find((step) => step.id === "mcp-project-doctor")?.mode).toBe("read-only");
  expect(plan.steps.find((step) => step.id === "apply-project-settings")?.enabled).toBe(true);
  expect(plan.steps.find((step) => step.id === "create-bins")?.enabled).toBe(true);
  expect(plan.steps.find((step) => step.id === "build-timelines")?.mode).toBe("write");
  expect(plan.steps.find((step) => step.id === "qc-markers")?.mode).toBe("conditional-write");
  expect(plan.warnings).toContainEqual(expect.stringContaining("Multicam Studio"));
  expect(plan.warnings).toContainEqual(expect.stringContaining("ikke en LUT automatisk"));
});

test("Wedding Editor er tilgjengelig som samlet arbeidsflyt fra Home", async ({ page }) => {
  await page.addInitScript(installTauriMock);
  await page.addInitScript(() => {
    localStorage.setItem("trrpa.photoshopTourCompleted", "e2e");
  });
  await page.route("**/api/post-agent/me", (route) => route.fulfill({
    json: {
      id: "wedding-editor-user",
      email: "editor@test.no",
      name: "Wedding Editor Test",
      role: "producer",
    },
  }));
  await page.route("**/api/post-agent/modules/entitlements", (route) => route.fulfill({ json: { modules: [] } }));
  await page.route("**/api/role-room/profile/me", (route) => route.fulfill({ json: { profile: null } }));
  await page.goto("/");
  await page.getByRole("button", { name: "← Tilbake" }).click();

  const weddingEditor = page.getByRole("button", { name: /^Wedding Editor Kilder/ });
  await expect(weddingEditor).toBeVisible();
  await expect(weddingEditor).toContainText("Analyse · plan · godkjenning · bygging");
  await weddingEditor.click();

  const dialog = page.getByRole("dialog", { name: "Wedding Editor" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: /Wedding Editor — Kilder \+ kameraer/ })).toBeVisible();
  await expect(dialog.getByText("Analyse → plan → godkjenning → bygging → QC → kreativ finpuss")).toBeVisible();
});
