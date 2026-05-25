import { useCallback, useEffect, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { executeScript, listProjectTemplates } from "../api";
import type { ProjectTemplateSummary } from "../types";
import { IconCheck, IconX, IconPlay } from "./Icons";

interface AnalyzeResult {
  folder: string;
  totalFiles: number;
  videoCount: number;
  audioCount: number;
  imageCount: number;
  totalBytes: number;
  cameraDistribution: Record<string, number>;
  logProfileDistribution: Record<string, number>;
  audioRecorders: Record<string, number>;
  screenRecordingCount: number;
  sceneHintCounts: Record<string, number>;
  suggestedTemplate: { id: string; name: string; confidence: number; reasoning: string } | null;
  alternateTemplates: Array<{ id: string; name: string; confidence: number; reasoning: string }>;
}

interface DriveInfo {
  path: string;
  mountPoint: string | null;
  isCameraCard: boolean;
  cardSignals: string[];
  drive: {
    volumeName?: string;
    fileSystem?: string;
    totalBytes?: number;
    freeBytes?: number;
    removable?: boolean;
    protocol?: string;
    deviceModel?: string | null;
  };
  kind: string;
  recommendBackup: boolean;
}

interface StorageVolume {
  mountPoint: string;
  volumeName: string;
  fileSystem?: string;
  totalGB: number;
  freeGB: number;
  removable: boolean;
  protocol?: string;
  deviceModel?: string | null;
  isInternal?: boolean;
}

interface BenchmarkResult {
  path: string;
  driveModel: { vendor?: string | null; model?: string | null; protocol?: string | null };
  writeMBs: number;
  readMBs: number;
  cameraLabel?: string;
  cameraRequirementMBs?: number;
  verdict: "fast_enough" | "ok" | "marginal" | "too_slow" | "no_requirement";
  verdictDescription: string;
  recommendedSSDs?: Array<{ model: string; speedMBs: number; interface: string; price: string }>;
}

interface BackupResult {
  projectRoot: string;
  filesCopied: number;
  filesFailed: number;
  gbCopied: number;
  newSourcePath: string;
}

type Stage =
  | "pick"
  | "inspecting"
  | "backupConfig"
  | "backupRunning"
  | "analyzing"
  | "review"
  | "preview"
  | "running"
  | "done";

interface PipelineStep {
  id: string;
  label: string;
  status: "pending" | "running" | "ok" | "error";
  detail?: string;
}

const FORMAT_GB = (b: number) => `${(b / 1_073_741_824).toFixed(1)} GB`;

interface Props {
  onClose: () => void;
  defaultTemplateId: string;
  onTemplateChange: (id: string) => void;
}

export function OnboardingWizard({ onClose, defaultTemplateId, onTemplateChange }: Props) {
  const [stage, setStage] = useState<Stage>("pick");
  const [folder, setFolder] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalyzeResult | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(defaultTemplateId);
  const [projectName, setProjectName] = useState<string>("");
  const [templates, setTemplates] = useState<ProjectTemplateSummary[]>([]);
  const [steps, setSteps] = useState<PipelineStep[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [driveInfo, setDriveInfo] = useState<DriveInfo | null>(null);
  const [storageVolumes, setStorageVolumes] = useState<StorageVolume[]>([]);
  const [selectedSsdMount, setSelectedSsdMount] = useState<string>("");
  const [benchmarkResult, setBenchmarkResult] = useState<BenchmarkResult | null>(null);
  const [benchmarking, setBenchmarking] = useState(false);
  const [, setBackupResult] = useState<BackupResult | null>(null);
  const [primaryCamera, setPrimaryCamera] = useState<string>("");

  useEffect(() => {
    listProjectTemplates().then((index) => setTemplates(index.templates)).catch(() => {});
  }, []);

  const runAnalyze = useCallback(async (folderPath: string) => {
    setStage("analyzing");
    const summary = await executeScript("analyze_clip_folder", { folderPath }, false);
    const result = summary.events.find((e) => e.type === "result")?.value as AnalyzeResult | undefined;
    if (!result) {
      setError("Analyze script returned no result. Check the log panel.");
      setStage("pick");
      return;
    }
    setAnalysis(result);
    if (result.suggestedTemplate?.id) {
      setSelectedTemplateId(result.suggestedTemplate.id);
    }
    // Pick the most-common camera for benchmark / SSD recommendation defaults
    const cameras = Object.entries(result.cameraDistribution);
    if (cameras.length > 0) {
      const top = cameras.sort((a, b) => b[1] - a[1])[0][0];
      setPrimaryCamera(top);
    }
    setStage("review");
  }, []);

  const pickFolder = useCallback(async () => {
    try {
      const picked = await openDialog({ directory: true, multiple: false });
      if (typeof picked !== "string") return;
      setFolder(picked);
      // Derive a project name suggestion from the folder name
      const base = picked.split("/").filter(Boolean).pop() ?? "";
      setProjectName(base.replace(/[^a-zA-Z0-9_-]/g, "_"));
      // Inspect drive first — may suggest backup
      setStage("inspecting");
      const inspect = await executeScript("inspect_source_drive", { path: picked }, false);
      const driveResult = inspect.events.find((e) => e.type === "result")?.value as DriveInfo | undefined;
      if (driveResult) {
        setDriveInfo(driveResult);
        if (driveResult.recommendBackup) {
          // Load available SSDs in parallel
          const storage = await executeScript("list_storage_devices", {
            excludeMounts: driveResult.mountPoint ? [driveResult.mountPoint] : [],
            requireWritable: true,
          }, false);
          const volumes = (storage.events.find((e) => e.type === "result")?.value as { volumes: StorageVolume[] } | undefined)?.volumes ?? [];
          setStorageVolumes(volumes);
          if (volumes.length > 0) setSelectedSsdMount(volumes[0].mountPoint);
          setStage("backupConfig");
          return;
        }
      }
      // Not a card — go straight to analyze
      await runAnalyze(picked);
    } catch (e) {
      setError(String(e));
      setStage("pick");
    }
  }, [runAnalyze]);

  const runBenchmark = useCallback(async () => {
    if (!selectedSsdMount) return;
    setBenchmarking(true);
    setError(null);
    try {
      const summary = await executeScript(
        "benchmark_drive",
        {
          path: selectedSsdMount,
          testSizeBytes: 524_288_000, // 500 MB — quick test
          cameraLabel: primaryCamera || undefined,
        },
        false,
      );
      const result = summary.events.find((e) => e.type === "result")?.value as BenchmarkResult | undefined;
      if (result) setBenchmarkResult(result);
    } catch (e) {
      setError(String(e));
    } finally {
      setBenchmarking(false);
    }
  }, [selectedSsdMount, primaryCamera]);

  const runBackup = useCallback(async () => {
    if (!folder || !selectedSsdMount) return;
    setStage("backupRunning");
    setError(null);
    try {
      const summary = await executeScript(
        "backup_card_to_ssd",
        {
          sourcePath: folder,
          ssdPath: selectedSsdMount,
          projectName: projectName || "Untitled",
          fullSha: false,
        },
        false,
      );
      const result = summary.events.find((e) => e.type === "result")?.value as BackupResult | undefined;
      if (!result || result.filesFailed > 0) {
        setError(
          `Backup completed with issues: ${result?.filesCopied ?? 0} copied, ${result?.filesFailed ?? 0} failed. See log.`,
        );
      }
      if (result?.newSourcePath) {
        setBackupResult(result);
        setFolder(result.newSourcePath);
        await runAnalyze(result.newSourcePath);
        return;
      }
      setStage("backupConfig");
    } catch (e) {
      setError(String(e));
      setStage("backupConfig");
    }
  }, [folder, selectedSsdMount, projectName, runAnalyze]);

  const skipBackup = useCallback(async () => {
    if (!folder) return;
    await runAnalyze(folder);
  }, [folder, runAnalyze]);

  const startPipeline = useCallback(async () => {
    if (!analysis || !folder || !selectedTemplateId) return;
    setStage("running");
    setError(null);

    const initialSteps: PipelineStep[] = [
      { id: "create_project", label: "Create project structure", status: "pending" },
      { id: "import", label: `Import ${analysis.videoCount + analysis.audioCount} clips`, status: "pending" },
      { id: "organize", label: "Organize by camera", status: "pending" },
      { id: "profiles", label: "Detect camera profiles", status: "pending" },
      { id: "qc", label: "Check missing media", status: "pending" },
    ];
    setSteps(initialSteps);

    const markStep = (id: string, status: PipelineStep["status"], detail?: string) => {
      setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, status, detail } : s)));
    };

    const runStep = async (id: string, scriptId: string, params: Record<string, unknown>) => {
      markStep(id, "running");
      try {
        const summary = await executeScript(scriptId, params, false);
        if (summary.succeeded) {
          const result = summary.events.find((e) => e.type === "result")?.value;
          const detail =
            result && typeof result === "object" && "summary" in (result as Record<string, unknown>)
              ? String((result as Record<string, unknown>).summary)
              : "ok";
          markStep(id, "ok", detail);
          return true;
        }
        markStep(id, "error", `exit ${summary.exit_code ?? "?"}`);
        return false;
      } catch (e) {
        markStep(id, "error", String(e));
        return false;
      }
    };

    // Persist template selection so all subsequent scripts (Color view etc.) use it
    onTemplateChange(selectedTemplateId);

    const ok1 = await runStep("create_project", "create_project_structure", {
      projectName: projectName || "Untitled",
      template: selectedTemplateId,
    });
    if (!ok1) {
      setError("Create project structure failed — see log. Pipeline stopped.");
      setStage("done");
      return;
    }

    const ok2 = await runStep("import", "import_media_from_folder", {
      mediaFolderPath: folder,
    });
    if (!ok2) {
      setError("Import failed — pipeline stopped. Project was created, but bins are empty.");
      setStage("done");
      return;
    }

    await runStep("organize", "organize_by_camera", {});
    await runStep("profiles", "detect_camera_profiles", {});
    await runStep("qc", "check_missing_media", {});

    setStage("done");
  }, [analysis, folder, selectedTemplateId, projectName, onTemplateChange]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 640, maxHeight: "85vh" }}>
        <h2>Set up Project</h2>

        {/* STAGE 1 — PICK FOLDER */}
        {stage === "pick" && (
          <>
            <div className="desc">
              Pek på mappen med klippene dine. Appen skanner filnavn + metadata, foreslår en passende prosjekt-template, og setter opp Resolve-prosjektet for deg.
            </div>
            {error && <div className="dialog-warning">{error}</div>}
            <div className="actions">
              <button onClick={onClose}>Cancel</button>
              <button className="primary" onClick={pickFolder}>Pick clip folder…</button>
            </div>
          </>
        )}

        {/* STAGE 1b — INSPECTING DRIVE */}
        {stage === "inspecting" && (
          <div className="cull-running" style={{ padding: 24 }}>
            <div className="cull-running-spinner" />
            Sjekker hvilken type disk dette er…
          </div>
        )}

        {/* STAGE 1c — BACKUP CONFIG */}
        {stage === "backupConfig" && driveInfo && (
          <>
            <div className="onboarding-suggestion">
              <div className="card-chip-meta">SD-KORT DETEKTERT</div>
              <div className="onboarding-suggestion-name">
                {driveInfo.drive.volumeName ?? "(unnamed)"}
                <span className="chip" style={{ marginLeft: 8 }}>
                  {driveInfo.drive.protocol ?? "removable"}
                </span>
              </div>
              <div className="clip-notes">
                {driveInfo.cardSignals.join(", ")} · {driveInfo.drive.fileSystem ?? "?"} ·{" "}
                {driveInfo.drive.freeBytes !== undefined
                  ? `${FORMAT_GB(driveInfo.drive.freeBytes)} free of ${FORMAT_GB(driveInfo.drive.totalBytes ?? 0)}`
                  : ""}
              </div>
              <div className="clip-notes" style={{ marginTop: 6 }}>
                Anbefalt: ta backup til SSD før du redigerer. Da kan kortet brukes på nytt og du har en kopi hvis kortet feiler.
              </div>
            </div>

            {error && <div className="dialog-warning">{error}</div>}

            <div className="field" style={{ marginTop: 14 }}>
              <label>Velg SSD å ta backup til</label>
              {storageVolumes.length === 0 ? (
                <div className="empty">Ingen eksterne SSDs detektert. Koble til en og refresh.</div>
              ) : (
                <select value={selectedSsdMount} onChange={(e) => setSelectedSsdMount(e.target.value)}>
                  {storageVolumes.map((v) => (
                    <option key={v.mountPoint} value={v.mountPoint}>
                      {v.volumeName} · {v.freeGB} GB free · {v.protocol ?? "?"}
                      {v.removable ? " · ext" : v.isInternal ? " · int" : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {primaryCamera && (
              <div className="card-chip-meta">
                Benchmark vil sjekke MB/s mot codec-krav for kamera: <strong>{primaryCamera}</strong>
              </div>
            )}

            {benchmarkResult && (
              <div className={`dialog-warning`} style={{
                marginTop: 10,
                borderColor:
                  benchmarkResult.verdict === "fast_enough" || benchmarkResult.verdict === "ok"
                    ? "var(--success)"
                    : benchmarkResult.verdict === "marginal"
                    ? "var(--warning)"
                    : "var(--danger)",
                color: benchmarkResult.verdict === "too_slow" ? "var(--danger)" : "var(--text)",
                background: "rgba(255,255,255,.03)",
              }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                  Write: {benchmarkResult.writeMBs.toFixed(0)} MB/s · Read: {benchmarkResult.readMBs.toFixed(0)} MB/s
                </div>
                <div style={{ fontSize: 11 }}>{benchmarkResult.verdictDescription}</div>
                {benchmarkResult.verdict === "too_slow" && benchmarkResult.recommendedSSDs && (
                  <div style={{ marginTop: 6, fontSize: 11 }}>
                    Anbefalt:{" "}
                    {benchmarkResult.recommendedSSDs.slice(0, 2).map((s) => `${s.model} (${s.speedMBs} MB/s)`).join(", ")}
                  </div>
                )}
              </div>
            )}

            <div className="setup-actions" style={{ marginTop: 12 }}>
              <button
                className="small"
                onClick={runBenchmark}
                disabled={!selectedSsdMount || benchmarking}
              >
                {benchmarking ? "Benchmarking…" : "Benchmark SSD (500 MB)"}
              </button>
              <button className="small ghost" onClick={skipBackup}>
                Skip backup — bruk kortet direkte
              </button>
              <button
                className="small primary"
                onClick={runBackup}
                disabled={!selectedSsdMount}
                style={{ gridColumn: "1 / -1" }}
              >
                Backup til {storageVolumes.find((v) => v.mountPoint === selectedSsdMount)?.volumeName ?? "SSD"} + fortsett
              </button>
            </div>
            <div className="actions">
              <button onClick={onClose}>Cancel</button>
            </div>
          </>
        )}

        {/* STAGE 1d — BACKUP RUNNING */}
        {stage === "backupRunning" && driveInfo && (
          <div className="cull-running" style={{ padding: 24, flexDirection: "column", alignItems: "flex-start" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
              <div className="cull-running-spinner" />
              Kopierer {FORMAT_GB(driveInfo.drive.totalBytes ?? 0)} fra {driveInfo.drive.volumeName} til {storageVolumes.find((v) => v.mountPoint === selectedSsdMount)?.volumeName ?? "SSD"}…
            </div>
            <div className="card-chip-meta">
              Følg med i log-panelet i hovedvinduet for filnavn og fremdrift. Dette kan ta noen minutter avhengig av kort + SSD-hastighet.
            </div>
          </div>
        )}

        {/* STAGE 2 — ANALYZING */}
        {stage === "analyzing" && (
          <div className="cull-running" style={{ padding: 24 }}>
            <div className="cull-running-spinner" />
            Analyserer {folder}…
          </div>
        )}

        {/* STAGE 3 — REVIEW ANALYSIS */}
        {stage === "review" && analysis && (
          <>
            <div className="desc">
              Funnet i <code>{analysis.folder}</code>
            </div>

            <div className="onboarding-stats">
              <div><strong>{analysis.videoCount}</strong> video<span className="card-chip-meta"> · </span><strong>{analysis.audioCount}</strong> audio<span className="card-chip-meta"> · </span><strong>{analysis.imageCount}</strong> image</div>
              <div className="card-chip-meta">{FORMAT_GB(analysis.totalBytes)} totalt</div>
            </div>

            {Object.keys(analysis.cameraDistribution).length > 0 && (
              <div className="onboarding-section">
                <div className="section-title">Kameraer detektert</div>
                <div>
                  {Object.entries(analysis.cameraDistribution).map(([cam, count]) => (
                    <span key={cam} className="chip ready" style={{ marginRight: 4 }}>
                      {cam} · {count}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {Object.keys(analysis.audioRecorders).length > 0 && (
              <div className="onboarding-section">
                <div className="section-title">Eksterne lydopptakere</div>
                <div>
                  {Object.entries(analysis.audioRecorders).map(([rec, count]) => (
                    <span key={rec} className="chip" style={{ marginRight: 4 }}>{rec} · {count}</span>
                  ))}
                </div>
              </div>
            )}

            {analysis.suggestedTemplate && (
              <div className="onboarding-suggestion">
                <div className="card-chip-meta">FORESLÅTT TEMPLATE</div>
                <div className="onboarding-suggestion-name">
                  {analysis.suggestedTemplate.name}
                  <span className="chip ready" style={{ marginLeft: 8 }}>
                    {Math.round(analysis.suggestedTemplate.confidence * 100)}% match
                  </span>
                </div>
                <div className="clip-notes">{analysis.suggestedTemplate.reasoning}</div>
              </div>
            )}

            <div className="field" style={{ marginTop: 12 }}>
              <label>Velg template</label>
              <select value={selectedTemplateId} onChange={(e) => setSelectedTemplateId(e.target.value)}>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {analysis.alternateTemplates.find((alt) => alt.id === t.id)
                      ? ` · ${Math.round((analysis.alternateTemplates.find((alt) => alt.id === t.id)?.confidence ?? 0) * 100)}%`
                      : analysis.suggestedTemplate?.id === t.id
                      ? ` · ${Math.round(analysis.suggestedTemplate.confidence * 100)}%`
                      : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Prosjekt-navn (i Resolve)</label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Untitled"
              />
            </div>

            <div className="actions">
              <button onClick={onClose}>Cancel</button>
              <button onClick={() => setStage("preview")}>Next →</button>
            </div>
          </>
        )}

        {/* STAGE 4 — PREVIEW */}
        {stage === "preview" && analysis && (
          <>
            <div className="desc">
              Klar til å kjøre. Dette gjøres:
            </div>
            <ol className="setup-steps">
              <li className="setup-step setup-step-pending">
                <span className="setup-step-marker">1</span>
                <div>
                  <div className="setup-step-label">Lag prosjekt-struktur "<strong>{projectName}</strong>"</div>
                  <div className="setup-step-detail">Template: {selectedTemplateId} · Bins følger templaten</div>
                </div>
              </li>
              <li className="setup-step setup-step-pending">
                <span className="setup-step-marker">2</span>
                <div>
                  <div className="setup-step-label">Importer {analysis.videoCount + analysis.audioCount} klipp</div>
                  <div className="setup-step-detail">{FORMAT_GB(analysis.totalBytes)} fra {folder}</div>
                </div>
              </li>
              <li className="setup-step setup-step-pending">
                <span className="setup-step-marker">3</span>
                <div>
                  <div className="setup-step-label">Organiser etter kamera</div>
                  <div className="setup-step-detail">Lager bins per detektert kameramerke</div>
                </div>
              </li>
              <li className="setup-step setup-step-pending">
                <span className="setup-step-marker">4</span>
                <div>
                  <div className="setup-step-label">Detekter kamera-profiler</div>
                  <div className="setup-step-detail">Foreslår teknisk transform per kamera</div>
                </div>
              </li>
              <li className="setup-step setup-step-pending">
                <span className="setup-step-marker">5</span>
                <div>
                  <div className="setup-step-label">QC: Check missing media</div>
                  <div className="setup-step-detail">Verifiserer at alt er online</div>
                </div>
              </li>
            </ol>
            <div className="dialog-warning">
              Resolve må ha prosjektet ditt åpent. Hvis et annet prosjekt er aktivt nå, bytt til riktig prosjekt før du kjører — eller la steg 1 lage et nytt.
            </div>
            <div className="actions">
              <button onClick={() => setStage("review")}>← Back</button>
              <button className="primary" onClick={startPipeline}>Run setup</button>
            </div>
          </>
        )}

        {/* STAGE 5 — RUNNING */}
        {(stage === "running" || stage === "done") && (
          <>
            <div className="desc">Pipeline kjører…</div>
            <ol className="setup-steps">
              {steps.map((step, i) => (
                <li key={step.id} className={`setup-step setup-step-${step.status === "ok" ? "ok" : step.status === "error" ? "warn" : "pending"}`}>
                  <span className="setup-step-marker">
                    {step.status === "ok" ? <IconCheck /> : step.status === "error" ? <IconX /> : step.status === "running" ? <IconPlay /> : i + 1}
                  </span>
                  <div>
                    <div className="setup-step-label">{step.label}</div>
                    {step.detail && <div className="setup-step-detail">{step.detail}</div>}
                  </div>
                </li>
              ))}
            </ol>
            {error && <div className="dialog-warning">{error}</div>}
            {stage === "done" && (
              <div className="actions">
                <button className="primary" onClick={onClose}>Done</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
