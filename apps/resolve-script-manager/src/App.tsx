import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";
import {
  executeScript,
  getRunHistory,
  listScripts,
  listWorkflows,
  onScriptEvent,
  openScriptFolder,
  runHealthCheck,
} from "./api";
import type {
  HealthStatus,
  Registry,
  RunRecord,
  RunSummary,
  ScriptEvent,
  ScriptMeta,
  WorkflowMap,
} from "./types";
import { HeaderBar } from "./components/HeaderBar";
import { WorkflowPicker } from "./components/WorkflowPicker";
import { PipelineStep } from "./components/PipelineStep";
import { ScriptLibrary } from "./components/ScriptLibrary";
import { LogPanel } from "./components/LogPanel";
import { ParamDialog } from "./components/ParamDialog";
import { CullView } from "./components/CullView";
import { AudioView } from "./components/AudioView";
import { ColorView } from "./components/ColorView";
import { ResolveSetupModal } from "./components/ResolveSetupModal";
import { OnboardingWizard } from "./components/OnboardingWizard";
import { RunningScriptsPanel, type RunningScript } from "./components/RunningScriptsPanel";
import { MediaPoolSidebar } from "./components/MediaPoolSidebar";
import { SettingsModal, loadSettings, settingsToEnvVars } from "./components/SettingsModal";
import { DependenciesModal } from "./components/DependenciesModal";
import { FirstRunSetupWizard, shouldShowFirstRun } from "./components/FirstRunSetupWizard";
import { WatchFolderModal } from "./components/WatchFolderModal";
import { MagicCutDialog } from "./components/MagicCutDialog";
import { IconEye, IconBox, IconGear, IconChevronLeft, IconChevronRight, IconCheck } from "./components/Icons";
import { updateAppSettings } from "./api";
import { useProjectTemplate } from "./hooks/useProjectTemplate";

const MAX_LOG_EVENTS = 500;

export default function App() {
  const [registry, setRegistry] = useState<Registry | null>(null);
  const [workflows, setWorkflows] = useState<WorkflowMap>({});
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [events, setEvents] = useState<ScriptEvent[]>([]);
  const [runs, setRuns] = useState<Record<string, RunRecord>>({});
  const [busy, setBusy] = useState(false);
  const [pendingDialog, setPendingDialog] = useState<{ script: ScriptMeta; dryRun: boolean } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [view, setView] = useState<"pipeline" | "cull" | "audio" | "color">("pipeline");
  const [showSetup, setShowSetup] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [runningScripts, setRunningScripts] = useState<Record<string, RunningScript>>({});
  const [mediaPoolRefreshTrigger, setMediaPoolRefreshTrigger] = useState(0);
  const [showMediaPool, setShowMediaPool] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showDependencies, setShowDependencies] = useState(false);
  const [showFirstRun, setShowFirstRun] = useState(() => shouldShowFirstRun());
  const [showWatch, setShowWatch] = useState(false);
  const [showMagicCut, setShowMagicCut] = useState(false);

  // Push saved settings to backend on mount so the first Python run inherits ANTHROPIC_API_KEY etc.
  useEffect(() => {
    const saved = loadSettings();
    void updateAppSettings(settingsToEnvVars(saved));
  }, []);
  const { templates: projectTemplates, activeId: activeTemplateId, setActiveId: setActiveTemplateId, active: activeTemplate } = useProjectTemplate();

  const scriptsById = useMemo(() => {
    const map: Record<string, ScriptMeta> = {};
    registry?.scripts.forEach((s) => {
      map[s.id] = s;
    });
    return map;
  }, [registry]);

  // Initial load
  useEffect(() => {
    Promise.all([listScripts(), listWorkflows(), getRunHistory()])
      .then(([reg, wf, history]) => {
        setRegistry(reg);
        setWorkflows(wf);
        const first = Object.keys(wf)[0];
        if (first) setSelectedWorkflowId(first);

        // Replay persisted history: keep only the most-recent run per script
        const latestByScript: Record<string, RunRecord> = {};
        for (const rec of history) {
          const existing = latestByScript[rec.script_id];
          const candidate: RunRecord = {
            runId: rec.run_id,
            scriptId: rec.script_id,
            scriptName: rec.script_id,
            startedAt: rec.started_at,
            finishedAt: rec.finished_at,
            succeeded: rec.succeeded,
            dryRun: rec.dry_run,
            exitCode: rec.exit_code,
            events: rec.tail_events,
          };
          if (!existing || candidate.startedAt > existing.startedAt) {
            latestByScript[rec.script_id] = candidate;
          }
        }
        setRuns(latestByScript);
      })
      .catch((e: unknown) => setLoadError(String(e)));
  }, []);

  // Subscribe to Tauri events
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    onScriptEvent((event) => {
      setEvents((prev) => {
        const next = [...prev, event];
        return next.length > MAX_LOG_EVENTS ? next.slice(-MAX_LOG_EVENTS) : next;
      });
      // Track running scripts for the progress panel
      if (event.type === "started" && event.runId) {
        setRunningScripts((prev) => ({
          ...prev,
          [event.runId]: {
            runId: event.runId,
            scriptId: event.scriptId ?? "unknown",
            percent: 0,
            label: "",
            startedAt: Date.now(),
          },
        }));
      } else if (event.type === "progress" && event.runId) {
        setRunningScripts((prev) => {
          const existing = prev[event.runId];
          if (!existing) return prev;
          return {
            ...prev,
            [event.runId]: {
              ...existing,
              percent: event.percent ?? existing.percent,
              label: event.label ?? existing.label,
            },
          };
        });
      } else if (event.type === "finished" && event.runId) {
        setRunningScripts((prev) => {
          const next = { ...prev };
          delete next[event.runId];
          return next;
        });
        // After any script completes, kick the Media Pool sidebar to refresh
        if (event.scriptId !== "get_media_pool_state") {
          setMediaPoolRefreshTrigger((t) => t + 1);
        }
      }
    }).then((u) => {
      unlisten = u;
    });
    return () => {
      unlisten?.();
    };
  }, []);

  const recordRun = useCallback((summary: RunSummary) => {
    const meta = scriptsById[summary.script_id];
    const record: RunRecord = {
      runId: summary.run_id,
      scriptId: summary.script_id,
      scriptName: meta?.name ?? summary.script_id,
      startedAt: summary.started_at,
      finishedAt: summary.finished_at,
      succeeded: summary.succeeded,
      dryRun: summary.dry_run,
      exitCode: summary.exit_code,
      events: summary.events,
    };
    setRuns((prev) => ({ ...prev, [summary.script_id]: record }));
    if (summary.script_id === "health_check") {
      const resultEvent = summary.events.find((e) => e.type === "result");
      if (resultEvent && resultEvent.value && typeof resultEvent.value === "object") {
        setHealth(resultEvent.value as HealthStatus);
      }
    }
  }, [scriptsById]);

  const handleHealthCheck = useCallback(async () => {
    setBusy(true);
    try {
      const summary = await runHealthCheck();
      recordRun(summary);
    } catch (e) {
      setEvents((prev) => [
        ...prev,
        { type: "error", ts: Date.now() / 1000, runId: "n/a", message: String(e) },
      ]);
    } finally {
      setBusy(false);
    }
  }, [recordRun]);

  const handleOpenFolder = useCallback(async () => {
    try {
      await openScriptFolder();
    } catch (e) {
      setEvents((prev) => [
        ...prev,
        { type: "error", ts: Date.now() / 1000, runId: "n/a", message: `Open folder: ${e}` },
      ]);
    }
  }, []);

  const handleTrigger = useCallback(
    (script: ScriptMeta, dryRun: boolean) => {
      if (script.requiredInputs.length > 0) {
        setPendingDialog({ script, dryRun });
        return;
      }
      // For zero-input scripts, prompt anyway on non-dry-run for high-risk
      if (!dryRun && (script.riskLevel === "high" || script.status === "experimental" || script.status === "stub")) {
        setPendingDialog({ script, dryRun });
        return;
      }
      void runScript(script, {}, dryRun);
    },
    [],
  );

  const runScript = useCallback(
    async (script: ScriptMeta, params: Record<string, unknown>, dryRun: boolean) => {
      setBusy(true);
      try {
        const summary = await executeScript(script.id, params, dryRun);
        recordRun(summary);
      } catch (e) {
        setEvents((prev) => [
          ...prev,
          { type: "error", ts: Date.now() / 1000, runId: "n/a", message: String(e) },
        ]);
      } finally {
        setBusy(false);
      }
    },
    [recordRun],
  );

  const selectedWorkflow = selectedWorkflowId ? workflows[selectedWorkflowId] : null;

  if (loadError) {
    return (
      <div style={{ padding: 24, color: "var(--danger)" }}>
        <h2>Failed to load script registry</h2>
        <pre>{loadError}</pre>
        <p>Check that the bundled python/ folder is present and contains registry.json.</p>
      </div>
    );
  }

  if (!registry) {
    return (
      <div style={{ padding: 24, color: "var(--text-muted)" }}>Loading registry…</div>
    );
  }

  return (
    <div className="app">
      <HeaderBar
        health={health}
        busy={busy}
        onHealthCheck={handleHealthCheck}
        onOpenFolder={handleOpenFolder}
        onRefreshProject={handleHealthCheck}
        onConnect={() => setShowSetup(true)}
        view={view}
        onViewChange={setView}
        projectTemplates={projectTemplates}
        activeTemplateId={activeTemplateId}
        onTemplateChange={setActiveTemplateId}
        onSetupProject={() => setShowOnboarding(true)}
        onMagicCut={() => setShowMagicCut(true)}
      />

      {view === "cull" ? (
        <CullView activeTemplate={activeTemplate} />
      ) : view === "audio" ? (
        <AudioView />
      ) : view === "color" ? (
        <ColorView activeTemplate={activeTemplate} />
      ) : (
      <div className="body">
        <aside className="col col-pipeline">
          <WorkflowPicker
            workflows={workflows}
            selectedId={selectedWorkflowId}
            onSelect={setSelectedWorkflowId}
          />
          <h3 className="section-title">Pipeline</h3>
          {selectedWorkflow ? (
            selectedWorkflow.steps.map((step) => {
              const script = scriptsById[step.scriptId];
              return (
                <PipelineStep
                  key={step.order}
                  step={step}
                  script={script}
                  busy={busy}
                  onDryRun={() => script && handleTrigger(script, true)}
                  onRun={() => script && handleTrigger(script, false)}
                />
              );
            })
          ) : (
            <div className="empty">Select a workflow.</div>
          )}
        </aside>

        <main className="col col-main">
          <ScriptLibrary
            registry={registry}
            lastRunByScript={runs}
            busy={busy}
            onTrigger={handleTrigger}
          />
        </main>

        <aside className="col col-logs">
          <LogPanel events={events} onClear={() => setEvents([])} />
        </aside>
      </div>
      )}

      <footer className="footer">
        <span>
          {registry.scripts.length} scripts · {Object.keys(workflows).length} workflows ·{" "}
          {activeTemplate ? `Template: ${activeTemplate.name}` : "No template"} ·{" "}
          {health?.scriptingModulePath ? (
            <>Resolve scripting module <IconCheck /></>
          ) : (
            "Run Health Check to detect Resolve"
          )}
        </span>
        <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            className="small ghost"
            onClick={() => setShowWatch(true)}
            title="Watch folder — live event mode (auto-import new clips)"
          >
            <IconEye /> Watch Folder
          </button>
          <button
            className="small ghost"
            onClick={() => setShowDependencies(true)}
            title="Dependencies — ffmpeg, chromaprint, whisperx, Resolve"
          >
            <IconBox /> Dependencies
          </button>
          <button
            className="small ghost"
            onClick={() => setShowSettings(true)}
            title="Settings — preferences, AI usage, admin"
          >
            <IconGear /> Settings
          </button>
          <button
            className="small ghost"
            onClick={() => setShowMediaPool((s) => !s)}
            title="Toggle Media Pool sidebar"
          >
            {showMediaPool ? <><IconChevronRight /> Hide Media Pool</> : <><IconChevronLeft /> Show Media Pool</>}
          </button>
          <span>The Role Room Post Agent · v0.1.0</span>
        </span>
      </footer>

      {pendingDialog && (
        <ParamDialog
          script={pendingDialog.script}
          dryRun={pendingDialog.dryRun}
          defaults={{
            template: activeTemplate?.id ?? "",
            projectTemplate: activeTemplate?.id ?? "",
            deliveryTarget: "wedding",
            thresholdLufs: "-28",
            thresholdDb: "-0.1",
            thresholdIRE: "25",
            sampleSize: "30",
            outputFolder: "",
            backupFolder: "",
            frameRate: "25",
            timelineName: `${activeTemplate?.id ?? "Project"}_Master_V01`,
          }}
          onCancel={() => setPendingDialog(null)}
          onConfirm={(params) => {
            const { script, dryRun } = pendingDialog;
            setPendingDialog(null);
            void runScript(script, params, dryRun);
          }}
        />
      )}

      {showSetup && (
        <ResolveSetupModal
          health={health}
          onClose={() => setShowSetup(false)}
          onHealthRefreshed={setHealth}
        />
      )}

      {showOnboarding && (
        <OnboardingWizard
          onClose={() => setShowOnboarding(false)}
          defaultTemplateId={activeTemplateId}
          onTemplateChange={setActiveTemplateId}
        />
      )}

      <RunningScriptsPanel
        scripts={Object.values(runningScripts)}
        onCancelled={(runId) =>
          setRunningScripts((prev) => {
            const next = { ...prev };
            delete next[runId];
            return next;
          })
        }
      />

      {showMediaPool && <MediaPoolSidebar refreshTrigger={mediaPoolRefreshTrigger} />}

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

      {showDependencies && <DependenciesModal onClose={() => setShowDependencies(false)} />}

      {showFirstRun && <FirstRunSetupWizard onClose={() => setShowFirstRun(false)} />}

      {showWatch && <WatchFolderModal onClose={() => setShowWatch(false)} />}

      {showMagicCut && activeTemplate && (
        <MagicCutDialog
          templateId={activeTemplate.id}
          templateName={activeTemplate.name}
          onClose={() => setShowMagicCut(false)}
        />
      )}
    </div>
  );
}
