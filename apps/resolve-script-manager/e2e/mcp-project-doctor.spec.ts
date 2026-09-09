import { expect, test } from "@playwright/test";
import { installTauriMock } from "./fixtures/tauri-mock";

const MCP_STATUS = {
  installed: true,
  available: true,
  binaryPath: "/Applications/DaVinci Resolve/ResolveMCP",
  protocolVersion: "2024-11-05",
  serverVersion: "21.1",
  toolCount: 14,
  toolNames: ["get_resolve_status", "run_script"],
  resolveReachable: true,
  resolveStatus: { running: true, version: "21.1" },
  message: "Resolve MCP er klar",
};

const SKILLS = [
  ["resolve-project-doctor", "Project Doctor", false, true],
  ["resolve-timeline-qc", "Timeline QC", true, true],
  ["resolve-media-health", "Media Health", false, true],
  ["resolve-delivery-qc", "Delivery QC", true, true],
  ["resolve-project-organizer", "Project Organizer", false, false],
  ["resolve-transcript-editor", "Transcript Editor", false, false],
  ["resolve-multicam-director", "Multicam Director", true, false],
  ["resolve-audio-post", "Audio Post", true, false],
  ["resolve-color-guardian", "Color Guardian", true, false],
  ["resolve-review-notes", "Review Notes", true, false],
  ["resolve-batch-render-planner", "Batch Render Planner", true, false],
  ["resolve-v1-clip-renamer", "V1 Clip Renamer", true, false],
].map(([id, name, requiresTimeline, available]) => ({
  id,
  name,
  description: `${name} testbeskrivelse`,
  access: available ? "read-only" : "approval-required",
  status: available ? "available" : "planned",
  readOnly: available,
  requiresTimeline,
}));

const TIMELINE_QC_REPORT = {
  schemaVersion: 1,
  skillId: "resolve-timeline-qc",
  readOnly: true,
  resolve: { version: "21.1", page: "edit" },
  project: { name: "MCP Test Project", uniqueId: "project-1" },
  timeline: {
    name: "Master Timeline",
    uniqueId: "timeline-1",
    startFrame: 0,
    endFrame: 2500,
  },
  summary: {
    videoTracks: 2,
    audioTracks: 3,
    subtitleTracks: 1,
    videoItems: 18,
    audioItems: 22,
    disabledItems: 1,
    emptyTracks: 0,
    gaps: 3,
    overlaps: 0,
  },
  details: { tracks: [], gapSamples: [] },
  findings: [{
    severity: "warning",
    code: "timeline_video_gaps",
    title: "Gap på videospor",
    detail: "3 gap ble funnet mellom klipp på individuelle videospor.",
  }],
};

async function openResolveSkills(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    localStorage.setItem("trrpa.photoshopTourCompleted", "e2e");
  });
  await page.goto("/");
  const back = page.getByRole("button", { name: "← Tilbake" });
  if (await back.isVisible()) await back.click();
  await page.getByRole("button", { name: "12 Resolve-skills" }).click();
}

test("Resolve Skills viser katalogen og kjører Timeline QC", async ({ page }) => {
  await page.addInitScript(installTauriMock);
  await page.addInitScript(({ status, skills, report }) => {
    const tauri = (globalThis as any).__TAURI_INTERNALS__;
    const originalInvoke = tauri.invoke;
    tauri.invoke = async (cmd: string, args?: { skillId?: string }) => {
      if (cmd === "get_resolve_mcp_status") return status;
      if (cmd === "list_resolve_mcp_skills") return skills;
      if (cmd === "run_resolve_mcp_skill") {
        if (args?.skillId !== "resolve-timeline-qc") {
          throw new Error(`Uventet skill: ${args?.skillId}`);
        }
        return {
          run_id: "mcp-timeline-qc-test",
          script_id: args.skillId,
          exit_code: 0,
          succeeded: true,
          started_at: "2026-09-08T12:00:00Z",
          finished_at: "2026-09-08T12:00:01Z",
          dry_run: true,
          events: [{
            type: "result",
            runId: "mcp-timeline-qc-test",
            scriptId: args.skillId,
            value: report,
          }],
        };
      }
      return originalInvoke(cmd, args);
    };
  }, { status: MCP_STATUS, skills: SKILLS, report: TIMELINE_QC_REPORT });

  await openResolveSkills(page);

  const dialog = page.getByRole("dialog", { name: "Resolve Skills" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Resolve 21.1 er klar")).toBeVisible();
  await expect(dialog.getByText("4 klare · 8 planlagt · 14 MCP-verktøy")).toBeVisible();
  await expect(dialog.getByRole("button", { name: /^Project Doctor ANALYSE/ })).toBeVisible();
  await expect(dialog.getByRole("button", { name: /Review Notes/ })).toBeVisible();

  await dialog.getByRole("button", { name: /Timeline QC/ }).click();
  await dialog.getByRole("button", { name: "Kjør Timeline QC" }).click();
  await expect(dialog.getByText("MCP Test Project")).toBeVisible();
  await expect(dialog.getByText("Master Timeline")).toBeVisible();
  await expect(dialog.getByText("Gap på videospor")).toBeVisible();
  await expect(dialog.getByText("3 gap ble funnet mellom klipp på individuelle videospor.")).toBeVisible();
});

test("Resolve Skills holder skrivende skills låst", async ({ page }) => {
  await page.addInitScript(installTauriMock);
  await page.addInitScript(({ status, skills }) => {
    const tauri = (globalThis as any).__TAURI_INTERNALS__;
    const originalInvoke = tauri.invoke;
    tauri.invoke = async (cmd: string, args?: unknown) => {
      if (cmd === "get_resolve_mcp_status") return status;
      if (cmd === "list_resolve_mcp_skills") return skills;
      return originalInvoke(cmd, args);
    };
  }, { status: MCP_STATUS, skills: SKILLS });

  await openResolveSkills(page);

  const dialog = page.getByRole("dialog", { name: "Resolve Skills" });
  await dialog.getByRole("button", { name: /Project Organizer/ }).click();
  await expect(dialog.getByText("Denne skillen kan ikke kjøres før trygg godkjenning og rollback er implementert.")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Ikke aktivert" })).toBeDisabled();
});

test("Resolve Skills planlegger, godkjenner og ruller tilbake en skrivende workflow", async ({ page }) => {
  const gatewaySkills = SKILLS.map(skill => ({
    ...skill,
    status: "available",
    supportsPlan: !skill.readOnly,
    supportsApply: !skill.readOnly,
  }));
  const basePlan = {
    schemaVersion: 1,
    planId: "plan-12345678",
    skillId: "resolve-project-organizer",
    state: "planned",
    createdAt: "2026-09-09T12:00:00Z",
    expiresAt: "2026-09-09T12:30:00Z",
    target: { projectId: "project-1", projectName: "MCP Test Project", timelineId: "timeline-1", timelineName: "Master Timeline" },
    preflight: TIMELINE_QC_REPORT,
    steps: [
      { id: "preflight", label: "Lås mål", detail: "Prosjekt-ID verifiseres", risk: "none", reversible: true },
      { id: "apply", label: "Opprett bins", detail: "5 nye rot-bins", risk: "low", reversible: true },
      { id: "verify", label: "Les resultat tilbake", detail: "Kontroller bins", risk: "none", reversible: true },
    ],
    executable: true,
    rollbackAvailable: true,
    confirmationToken: "GODKJENN-12345678",
    operationSummary: "Opprett 5 manglende bins uten å flytte eksisterende media.",
    warnings: [],
    result: null,
    verification: null,
    rollbackResult: null,
  };

  await page.addInitScript(installTauriMock);
  await page.addInitScript(({ status, skills, plan }) => {
    const tauri = (globalThis as any).__TAURI_INTERNALS__;
    const originalInvoke = tauri.invoke;
    tauri.invoke = async (cmd: string, args?: { skillId?: string; planId?: string; confirmationToken?: string }) => {
      if (cmd === "get_resolve_mcp_status") return status;
      if (cmd === "list_resolve_mcp_skills") return skills;
      if (cmd === "create_resolve_mcp_plan") {
        if (args?.skillId !== "resolve-project-organizer") throw new Error("feil skill");
        return plan;
      }
      if (cmd === "apply_resolve_mcp_plan") {
        if (args?.confirmationToken !== plan.confirmationToken) throw new Error("feil token");
        return { ...plan, state: "applied", result: { ok: true }, verification: { ok: true, source: "immediate-resolve-readback" } };
      }
      if (cmd === "rollback_resolve_mcp_plan") {
        return { ...plan, state: "rolled-back", rollbackResult: { ok: true } };
      }
      return originalInvoke(cmd, args);
    };
  }, { status: MCP_STATUS, skills: gatewaySkills, plan: basePlan });

  await openResolveSkills(page);

  const dialog = page.getByRole("dialog", { name: "Resolve Skills" });
  await expect(dialog.getByText("12 klare · 0 planlagt · 14 MCP-verktøy")).toBeVisible();
  await dialog.getByRole("button", { name: /Project Organizer/ }).click();
  await dialog.getByRole("button", { name: "Lag plan for Project Organizer" }).click();
  await expect(dialog.getByText("Godkjenningsplan")).toBeVisible();
  await expect(dialog.getByText(/Opprett 5 manglende bins/)).toBeVisible();
  await dialog.getByLabel(/Jeg godkjenner GODKJENN-12345678/).check();
  await dialog.getByRole("button", { name: "Godkjenn og utfør" }).click();
  await expect(dialog.getByText("Verifisert i Resolve")).toBeVisible();
  await dialog.getByRole("button", { name: "Rollback" }).click();
  await expect(dialog.getByText("Endringen er rullet tilbake.")).toBeVisible();
});

test("Resolve Skills forhåndsviser batch-render og sekvensielle V1-navn", async ({ page }) => {
  const gatewaySkills = SKILLS.map(skill => ({
    ...skill,
    status: "available",
    supportsPlan: !skill.readOnly,
    supportsApply: !skill.readOnly,
  }));
  const planBase = {
    schemaVersion: 1,
    state: "planned",
    createdAt: "2026-09-09T14:00:00Z",
    expiresAt: "2026-09-09T14:30:00Z",
    target: { projectId: "project-1", projectName: "MCP Test Project", timelineId: "timeline-1", timelineName: "Master Timeline" },
    preflight: TIMELINE_QC_REPORT,
    steps: [{ id: "preflight", label: "Lås mål", detail: "Timeline-ID verifiseres", risk: "none", reversible: true }],
    executable: true,
    rollbackAvailable: true,
    warnings: [],
    result: null,
    verification: null,
    rollbackResult: null,
  };

  await page.addInitScript(installTauriMock);
  await page.addInitScript(({ status, skills, base }) => {
    const tauri = (globalThis as any).__TAURI_INTERNALS__;
    const originalInvoke = tauri.invoke;
    tauri.invoke = async (cmd: string, args?: { skillId?: string; input?: Record<string, unknown> }) => {
      if (cmd === "get_resolve_mcp_status") return status;
      if (cmd === "list_resolve_mcp_skills") return skills;
      if (cmd === "create_resolve_mcp_plan" && args?.skillId === "resolve-batch-render-planner") {
        const profiles = args.input?.profileIds as string[];
        if (profiles.length !== 3 || args.input?.baseName !== "Wedding Delivery") throw new Error("feil render-input");
        return {
          ...base,
          planId: "render-plan-1",
          skillId: args.skillId,
          confirmationToken: "GODKJENN-RENDER",
          operationSummary: "Legg 3 validerte leveranser i renderkøen uten å starte rendering.",
          preview: {
            kind: "render-jobs",
            destination: "/Movies/Post Agent Exports",
            items: [{ id: "prores-422-hq", label: "ProRes 422 HQ master", format: "QuickTime", codec: "ProRes422HQ", resolution: "Timeline-oppløsning", outputName: "Wedding Delivery_prores-422-hq" }],
          },
        };
      }
      if (cmd === "create_resolve_mcp_plan" && args?.skillId === "resolve-v1-clip-renamer") {
        if (args.input?.prefix !== "SCENE" || args.input?.startNumber !== 1 || args.input?.padding !== 3) throw new Error("feil rename-input");
        return {
          ...base,
          planId: "rename-plan-1",
          skillId: args.skillId,
          confirmationToken: "GODKJENN-RENAME",
          operationSummary: "Gi 1 videoklipp på V1 sekvensielt navn.",
          preview: { kind: "rename-v1", items: [{ id: "item-1", before: "Original", after: "SCENE_001", startFrame: 100 }] },
        };
      }
      return originalInvoke(cmd, args);
    };
  }, { status: MCP_STATUS, skills: gatewaySkills, base: planBase });

  await openResolveSkills(page);
  const dialog = page.getByRole("dialog", { name: "Resolve Skills" });

  await dialog.getByRole("button", { name: /Batch Render Planner/ }).click();
  await dialog.getByLabel("Filnavnbase").fill("Wedding Delivery");
  await dialog.getByRole("button", { name: "Lag plan for Batch Render Planner" }).click();
  await expect(dialog.getByTestId("resolve-plan-preview")).toContainText("ProRes 422 HQ master");
  await expect(dialog.getByTestId("resolve-plan-preview")).toContainText("Wedding Delivery_prores-422-hq");
  await expect(dialog.getByRole("button", { name: "Godkjenn og legg i kø" })).toBeVisible();

  await dialog.getByRole("button", { name: /V1 Clip Renamer/ }).click();
  await dialog.getByLabel("Prefiks").fill("SCENE");
  await dialog.getByRole("button", { name: "Lag plan for V1 Clip Renamer" }).click();
  await expect(dialog.getByTestId("resolve-plan-preview")).toContainText("Original → SCENE_001");
  await expect(dialog.getByRole("button", { name: "Godkjenn nye navn" })).toBeVisible();
});

test("Resolve Skills henter planen som Claude opprettet via lokal MCP-bro", async ({ page }) => {
  const gatewaySkills = SKILLS.map(skill => ({
    ...skill,
    status: "available",
    supportsPlan: !skill.readOnly,
    supportsApply: !skill.readOnly,
  }));
  const externalPlan = {
    schemaVersion: 1,
    planId: "external-plan-1",
    skillId: "resolve-project-organizer",
    state: "planned",
    createdAt: "2026-09-09T13:00:00Z",
    expiresAt: "2026-09-09T13:30:00Z",
    target: { projectId: "project-1", projectName: "MCP Test Project", timelineId: "timeline-1", timelineName: "Master Timeline" },
    preflight: TIMELINE_QC_REPORT,
    steps: [{ id: "preflight", label: "Lås mål", detail: "Prosjekt-ID verifiseres", risk: "none", reversible: true }],
    executable: true,
    rollbackAvailable: true,
    confirmationToken: "GODKJENN-EXTERNAL",
    operationSummary: "Claude foreslår å opprette seks manglende bins.",
    warnings: [],
    result: null,
    verification: null,
    rollbackResult: null,
  };

  await page.addInitScript(installTauriMock);
  await page.addInitScript(({ status, skills, plan }) => {
    const tauri = (globalThis as any).__TAURI_INTERNALS__;
    const originalInvoke = tauri.invoke;
    tauri.invoke = async (cmd: string, args?: unknown) => {
      if (cmd === "get_resolve_mcp_status") return status;
      if (cmd === "list_resolve_mcp_skills") return skills;
      if (cmd === "get_latest_resolve_mcp_plan") return plan;
      return originalInvoke(cmd, args);
    };
  }, { status: MCP_STATUS, skills: gatewaySkills, plan: externalPlan });

  await openResolveSkills(page);

  const dialog = page.getByRole("dialog", { name: "Resolve Skills" });
  await expect(dialog.getByText("Claude foreslår å opprette seks manglende bins.")).toBeVisible();
  await expect(dialog.getByLabel("Jeg godkjenner GODKJENN-EXTERNAL")).toBeVisible();
  await expect(dialog.locator('button[aria-pressed="true"]').filter({ hasText: "Project Organizer" })).toBeVisible();
});

test("Resolve Skills viser trygg utilgjengelig-tilstand", async ({ page }) => {
  await page.addInitScript(installTauriMock);
  await page.addInitScript(({ status, skills }) => {
    const tauri = (globalThis as any).__TAURI_INTERNALS__;
    const originalInvoke = tauri.invoke;
    tauri.invoke = async (cmd: string, args?: unknown) => {
      if (cmd === "get_resolve_mcp_status") return status;
      if (cmd === "list_resolve_mcp_skills") return skills;
      return originalInvoke(cmd, args);
    };
  }, {
    status: {
      ...MCP_STATUS,
      resolveReachable: false,
      resolveStatus: { running: false, version: "21.1" },
      message: "DaVinci Resolve Studio 21.1 is not running",
    },
    skills: SKILLS,
  });

  await openResolveSkills(page);

  const dialog = page.getByRole("dialog", { name: "Resolve Skills" });
  await expect(dialog.getByText("MCP installert — Resolve er ikke tilgjengelig")).toBeVisible();
  await expect(dialog.getByText(/File → Setup AI Assistants/)).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Kjør Project Doctor" })).toBeDisabled();
});
