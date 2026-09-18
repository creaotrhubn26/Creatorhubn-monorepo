export type WeddingEditorOperationMode = "write" | "read-only" | "conditional-write";

export interface WeddingEditorPlanInput {
  resolveReady: boolean;
  projectName: string;
  sourceCount: number;
  cameraCount: number;
  clipCount: number;
  multicamGroupCount: number;
  multicamRequested: boolean;
  externalAudioRequested: boolean;
  externalAudioMatchCount: number;
  selectedSongCount: number;
  pickCount: number;
  picksPath: string | null;
  deliverables: {
    longFilm: boolean;
    highlight: boolean;
    teaser: boolean;
  };
  backupManifestPath: string | null;
  projectSettingsAvailable: boolean;
  lutRequested: boolean;
}

export interface WeddingEditorPlanStep {
  id: string;
  label: string;
  description: string;
  mode: WeddingEditorOperationMode;
  enabled: boolean;
}

export interface WeddingEditorPlan {
  version: "wedding-editor-v1";
  readiness: "ready" | "blocked";
  requiresApproval: true;
  approvalKey: string;
  blockers: string[];
  warnings: string[];
  deliverables: string[];
  steps: WeddingEditorPlanStep[];
  summary: {
    projectName: string;
    sourceCount: number;
    cameraCount: number;
    clipCount: number;
    multicamGroupCount: number;
    externalAudioMatchCount: number;
    selectedSongCount: number;
    pickCount: number;
  };
}

export function buildWeddingEditorPlan(input: WeddingEditorPlanInput): WeddingEditorPlan {
  const deliverables = [
    input.deliverables.longFilm ? "Langfilm" : null,
    input.deliverables.highlight ? "Highlight" : null,
    input.deliverables.teaser ? "Teaser" : null,
  ].filter((value): value is string => value !== null);

  const blockers: string[] = [];
  if (!input.resolveReady) blockers.push("Åpne et prosjekt i DaVinci Resolve og sjekk tilkoblingen på nytt.");
  if (input.clipCount < 1) blockers.push("Materialskanningen må finne minst ett videoklipp.");
  if (!input.picksPath || input.pickCount < 1) blockers.push("Live-analysen må fullføres og produsere minst ett AI-pick.");
  if (deliverables.length === 0) blockers.push("Velg minst én leveranse: langfilm, highlight eller teaser.");

  const warnings: string[] = [];
  if (!input.projectName.trim()) {
    warnings.push("Prosjektnavn mangler. Resolve-timelines får navnet «Untitled».");
  }
  if (input.multicamRequested && input.multicamGroupCount > 0) {
    warnings.push(
      "Multicam-grupper er analysert, men native multicam opprettes foreløpig i Multicam Studio som et separat godkjent steg.",
    );
  }
  if (input.externalAudioRequested && input.externalAudioMatchCount === 0) {
    warnings.push("Ekstern lyd er valgt, men ingen sikre lydmatcher er funnet.");
  }
  if (input.lutRequested) {
    warnings.push(
      "LUT-anbefalingen lagres som et kreativt valg; Wedding Editor v1 bruker ikke en LUT automatisk på timeline.",
    );
  }

  const steps: WeddingEditorPlanStep[] = [
    {
      id: "mcp-project-doctor",
      label: "Kjør MCP Project Doctor",
      description: "Kontroller aktivt prosjekt og grunnstatus read-only rett før første endring.",
      mode: "read-only",
      enabled: input.resolveReady,
    },
    {
      id: "apply-project-settings",
      label: "Konfigurer prosjektinnstillinger",
      description: "Bruk funnet oppløsning, bildefrekvens og eventuell log/CST-profil.",
      mode: "write",
      enabled: input.resolveReady && input.projectSettingsAvailable,
    },
    {
      id: "create-bins",
      label: "Opprett organiserte bins",
      description: "Bygg Resolve-bins fra det verifiserte backupmanifestet.",
      mode: "write",
      enabled: Boolean(input.backupManifestPath),
    },
    {
      id: "build-timelines",
      label: `Bygg ${deliverables.length} leveranse${deliverables.length === 1 ? "" : "r"}`,
      description: deliverables.length > 0 ? deliverables.join(" · ") : "Ingen leveranser valgt",
      mode: "write",
      enabled: Boolean(input.picksPath) && deliverables.length > 0,
    },
    {
      id: "timeline-qc",
      label: "Kjør timeline-QC",
      description: "Les hver nye timeline og finn svarte mellomrom og stille partier.",
      mode: "read-only",
      enabled: Boolean(input.picksPath) && deliverables.length > 0,
    },
    {
      id: "qc-markers",
      label: "Legg eventuelt til QC-markers",
      description: "Skjer bare dersom QC finner avvik og du godkjenner én gang til.",
      mode: "conditional-write",
      enabled: Boolean(input.picksPath) && deliverables.length > 0,
    },
  ];

  const approvalKey = JSON.stringify({
    resolveReady: input.resolveReady,
    projectName: input.projectName.trim(),
    sourceCount: input.sourceCount,
    cameraCount: input.cameraCount,
    clipCount: input.clipCount,
    multicamGroupCount: input.multicamGroupCount,
    multicamRequested: input.multicamRequested,
    externalAudioRequested: input.externalAudioRequested,
    externalAudioMatchCount: input.externalAudioMatchCount,
    selectedSongCount: input.selectedSongCount,
    pickCount: input.pickCount,
    picksPath: input.picksPath,
    deliverables: input.deliverables,
    backupManifestPath: input.backupManifestPath,
    projectSettingsAvailable: input.projectSettingsAvailable,
    lutRequested: input.lutRequested,
  });

  return {
    version: "wedding-editor-v1",
    readiness: blockers.length === 0 ? "ready" : "blocked",
    requiresApproval: true,
    approvalKey,
    blockers,
    warnings,
    deliverables,
    steps,
    summary: {
      projectName: input.projectName.trim() || "Untitled",
      sourceCount: input.sourceCount,
      cameraCount: input.cameraCount,
      clipCount: input.clipCount,
      multicamGroupCount: input.multicamGroupCount,
      externalAudioMatchCount: input.externalAudioMatchCount,
      selectedSongCount: input.selectedSongCount,
      pickCount: input.pickCount,
    },
  };
}
