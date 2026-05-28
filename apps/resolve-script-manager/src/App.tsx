import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { RoleRoomSignInDialog } from "./components/RoleRoomSignInDialog";
import { DependenciesModal } from "./components/DependenciesModal";
import { HighlightReviewView } from "./components/HighlightReviewView";
import { CreativeEditorView } from "./components/CreativeEditorView";
import { NewProjectModal } from "./components/NewProjectModal";
import { GuidedWeddingWizard } from "./components/GuidedWeddingWizard";
import { CommandPalette } from "./components/CommandPalette";
import { LearningView } from "./components/LearningView";
import { FirstRunSetupWizard, shouldShowFirstRun } from "./components/FirstRunSetupWizard";
import { WatchFolderModal } from "./components/WatchFolderModal";
import { MagicCutDialog } from "./components/MagicCutDialog";
import { HomeView, recordRecentProject } from "./components/HomeView";
import { IconChevronLeft, IconChevronRight } from "./components/Icons";
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
  const [showPalette, setShowPalette] = useState(false);
  const [showLearning, setShowLearning] = useState(false);
  const [highlightReviewPath, setHighlightReviewPath] = useState<string | null>(null);
  const [creativeEditorPath, setCreativeEditorPath] = useState<string | null>(null);
  const [showNewProject, setShowNewProject] = useState(false);
  const [showWeddingWizard, setShowWeddingWizard] = useState(false);
  // Listen for cross-component requests to open the deps modal
  // (dispatched from e.g. RoleRoomProjectSync when ffprobe is missing).
  useEffect(() => {
    const handler = () => setShowDependencies(true);
    window.addEventListener("trrpa:open-dependencies", handler);
    return () => window.removeEventListener("trrpa:open-dependencies", handler);
  }, []);
  const [showFirstRun, setShowFirstRun] = useState(() => shouldShowFirstRun());
  const [showWatch, setShowWatch] = useState(false);
  const [showMagicCut, setShowMagicCut] = useState(false);
  // Auto-show Role Room sign-in on app launch when first-run is done but
  // the user hasn't authenticated yet. Suppressed during first-run since
  // the wizard owns that flow.
  const [showSignIn, setShowSignIn] = useState(() => {
    if (shouldShowFirstRun()) return false;
    const s = loadSettings();
    return !s.RR_BEARER_TOKEN?.trim();
  });
  // Toggle to expose the legacy power-user UI (Pipeline + Library + Logs)
  const [advancedMode, setAdvancedMode] = useState(() => localStorage.getItem("trrpa.advancedMode") === "true");

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

  // #286 + #287 — Native macOS notifications on workflow finished + sound on fail.
  // Uses the Web Notifications API (works inside Tauri WebView) so we don't
  // need an extra tauri-plugin-notification dep. Requests permission lazily
  // on first run. Plays a Web-Audio "thud" on failure as audible alert.
  const notifyRef = useRef<{
    permission: NotificationPermission | "unknown";
    requested: boolean;
  }>({ permission: "unknown", requested: false });

  const playFailureSound = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      // Descending two-tone "uh-oh" pattern
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.setValueAtTime(220, ctx.currentTime + 0.18);
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start(); osc.stop(ctx.currentTime + 0.55);
    } catch { /* AudioContext unavailable; silent fallback */ }
  }, []);

  const fireNotification = useCallback(async (
    title: string, body: string, isFailure: boolean,
  ) => {
    if (typeof Notification === "undefined") return;
    const n = notifyRef.current;
    if (n.permission === "unknown" && !n.requested) {
      n.requested = true;
      try {
        n.permission = await Notification.requestPermission();
      } catch { /* user dismissed */ }
    }
    if (Notification.permission !== "granted") return;
    try {
      new Notification(title, {
        body,
        silent: isFailure,  // we provide our own louder sound on failure
        tag: "post-agent-run",  // de-dupe rapid runs
      });
    } catch { /* WebView may block in some contexts */ }
    if (isFailure) playFailureSound();
  }, [playFailureSound]);

  // #222 — Cmd+K opens the command palette
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        const tag = (e.target as HTMLElement | null)?.tagName?.toUpperCase();
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault();
        setShowPalette((s) => !s);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Subscribe to native-menu events (#186 + #187 + #129)
  useEffect(() => {
    const unlisteners: Array<() => void> = [];
    let cancelled = false;
    void import("@tauri-apps/api/event").then(({ listen }) => {
      if (cancelled) return;
      listen("menu://rerun-last", async () => {
        const all = Object.values(runs ?? {}).filter((r): r is RunRecord => !!r);
        if (all.length === 0) {
          setEvents((prev) => [
            ...prev,
            { type: "log", ts: Date.now() / 1000, runId: "n/a", message: "No previous run to re-execute" },
          ]);
          return;
        }
        const last = all.sort((a, b) => Number(b.startedAt ?? 0) - Number(a.startedAt ?? 0))[0];
        const script = scriptsById[last.scriptId];
        if (!script) return;
        // Params aren't persisted on RunRecord — re-run with empty params,
        // which makes the runner use defaults or prompt where required.
        await runScript(script, {}, false);
      }).then((u) => unlisteners.push(u));
      listen("menu://new-workflow", () => setView("pipeline")).then((u) => unlisteners.push(u));
      listen("menu://check-updates", async () => {
        try {
          const { check } = await import("@tauri-apps/plugin-updater");
          const update = await check();
          if (update) {
            setEvents((prev) => [
              ...prev,
              { type: "log", ts: Date.now() / 1000, runId: "n/a",
                message: `Update available: v${update.version} — ${update.body ?? ""}` },
            ]);
          } else {
            setEvents((prev) => [
              ...prev,
              { type: "log", ts: Date.now() / 1000, runId: "n/a", message: "No updates available" },
            ]);
          }
        } catch (e) {
          // Updater not configured (no endpoint/pubkey) — silent in dev
          console.warn("[updater] not available:", e);
        }
      }).then((u) => unlisteners.push(u));
    });
    return () => { cancelled = true; unlisteners.forEach((u) => u?.()); };
  // runs + scriptsById intentionally NOT in deps — we always read latest via closure ref
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        // #286 / #287 — surface completion as a native notification.
        // Don't notify on health_check / get_media_pool_state etc. — internal
        // helpers that run frequently would create notification spam.
        const internalScripts = new Set([
          "health_check", "get_media_pool_state", "check_dependencies",
        ]);
        if (event.scriptId && !internalScripts.has(event.scriptId)) {
          const succeeded = !!event.succeeded;
          void fireNotification(
            succeeded ? "Script ferdig" : "Script feilet",
            `${event.scriptId} · exit ${event.exitCode ?? "?"}`,
            !succeeded,
          );
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
    // Auto-open the Creative Editor (Phase 1-3 flagship UI) when
    // extract_highlight_from_film returns reviewMode + picksPath.
    // Legacy HighlightReviewView is still available via direct invocation.
    if (summary.script_id === "extract_highlight_from_film") {
      const resultEvent = summary.events.find((e) => e.type === "result");
      const r = resultEvent?.value as { reviewMode?: boolean; picksPath?: string } | undefined;
      if (r?.reviewMode && r.picksPath) {
        setCreativeEditorPath(r.picksPath);
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
        onOpenCreativeEditor={() => setCreativeEditorPath(
          "/Users/danielqazi/Library/Application Support/no.creatorhubn.roleroom-post-agent/last_highlight_picks.json"
        )}
        onOpenSettings={() => setShowSettings(true)}
        onOpenDependencies={() => setShowDependencies(true)}
        onOpenWatch={() => setShowWatch(true)}
        onSignIn={() => setShowSignIn(true)}
        onSignedOut={() => { /* state refresh happens via storage event */ }}
        advancedMode={advancedMode}
      />

      {!advancedMode && view === "pipeline" && (
        <HomeView
          templates={projectTemplates}
          onPickTemplate={(id) => {
            setActiveTemplateId(id);
            // Defer to next tick so the activeTemplate prop in MagicCutDialog
            // reflects the new selection before the dialog mounts.
            setTimeout(() => setShowMagicCut(true), 0);
            const t = projectTemplates.find((x) => x.id === id);
            if (t) recordRecentProject({ templateId: t.id, templateName: t.name });
          }}
          onOpenAdvanced={() => {
            setAdvancedMode(true);
            localStorage.setItem("trrpa.advancedMode", "true");
          }}
          onNewProjectFromFile={() => setShowNewProject(true)}
          onOpenWeddingWizard={() => setShowWeddingWizard(true)}
          onOpenSavedProject={(picksPath) => setCreativeEditorPath(picksPath)}
          signedIn={Boolean(loadSettings().RR_BEARER_TOKEN)}
          onSignIn={() => setShowSignIn(true)}
          resolveConnected={Boolean(health?.resolveRunning && health?.projectOpen)}
        />
      )}

      {view === "cull" && <CullView activeTemplate={activeTemplate} />}
      {view === "audio" && <AudioView />}
      {view === "color" && <ColorView activeTemplate={activeTemplate} />}

      {advancedMode && view === "pipeline" && (
      <div className="body">
        <aside className="col col-pipeline">
          <button
            className="small ghost"
            style={{ marginBottom: 8 }}
            onClick={() => {
              setAdvancedMode(false);
              localStorage.removeItem("trrpa.advancedMode");
            }}
          >
            ← Tilbake til Home
          </button>
          <WorkflowPicker
            workflows={workflows}
            selectedId={selectedWorkflowId}
            onSelect={setSelectedWorkflowId}
          />
          <h3 className="section-title">Pipeline</h3>
          {selectedWorkflow ? (
            selectedWorkflow.steps.map((step) => {
              const script = scriptsById[step.scriptId];
              // #235 — derive per-step status from runs[] + runningScripts
              const lastRun = runs[step.scriptId];
              const running = Object.values(runningScripts).find(
                (r) => r.scriptId === step.scriptId,
              );
              const runStatus: "pending" | "running" | "success" | "failed" = running
                ? "running"
                : lastRun
                  ? (lastRun.succeeded ? "success" : "failed")
                  : "pending";
              return (
                <PipelineStep
                  key={step.order}
                  step={step}
                  script={script}
                  busy={busy}
                  runStatus={runStatus}
                  runProgress={running?.percent}
                  lastFinishedAt={lastRun?.finishedAt}
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

      <footer className="footer footer-minimal">
        <span className="footer-meta">
          {activeTemplate ? activeTemplate.name : "Ingen mal valgt"}
          {advancedMode && (
            <> · {registry.scripts.length} scripts · {Object.keys(workflows).length} workflows</>
          )}
        </span>
        <span className="footer-meta">
          <button
            className="small ghost icon-button"
            onClick={() => setShowMediaPool((s) => !s)}
            title="Toggle Media Pool sidebar"
          >
            {showMediaPool ? <IconChevronRight /> : <IconChevronLeft />}
          </button>
          <span className="footer-version">v0.1.0</span>
        </span>
      </footer>

      {showLearning && <LearningView onClose={() => setShowLearning(false)} />}

      <CommandPalette
        open={showPalette}
        onClose={() => setShowPalette(false)}
        registry={registry}
        workflows={workflows}
        onRunScript={(script, dryRun) => handleTrigger(script, dryRun)}
        onSelectWorkflow={(id) => { setSelectedWorkflowId(id); setView("pipeline"); }}
        actions={[
          { id: "health_check", title: "Run health-check",
            subtitle: "verify Resolve + venv + ffmpeg + disks",
            handler: () => void handleHealthCheck() },
          { id: "clear_logs", title: "Clear logs",
            subtitle: "wipe the right-side log panel",
            handler: () => setEvents([]) },
          { id: "open_dependencies", title: "Open Dependencies modal",
            subtitle: "install/verify ffmpeg, whisperx, librosa, cv2…",
            handler: () => setShowDependencies(true) },
          { id: "open_settings", title: "Open Settings",
            subtitle: "API keys, paths, preferences",
            handler: () => setShowSettings(true) },
          { id: "open_learning", title: "Vis hva systemet har lært",
            subtitle: "per-project + global læringsprofil + sist 10 økter",
            handler: () => setShowLearning(true) },
          { id: "toggle_media_pool", title: "Toggle Media Pool sidebar",
            subtitle: "show/hide right sidebar",
            handler: () => setShowMediaPool((s) => !s) },
          { id: "view_pipeline", title: "View: Pipeline",
            subtitle: "main workflow view",
            handler: () => setView("pipeline") },
          { id: "view_cull", title: "View: Cull",
            subtitle: "magic-cut for batch culling",
            handler: () => setView("cull") },
          { id: "view_audio", title: "View: Audio",
            subtitle: "audio QC + sync tools",
            handler: () => setView("audio") },
          { id: "creative_editor", title: "Åpne Creative Editor",
            subtitle: "Pixel-perfect editor med segments + timeline + Claude assistent",
            handler: () => setCreativeEditorPath(
              "/Users/danielqazi/Library/Application Support/no.creatorhubn.roleroom-post-agent/last_highlight_picks.json"
            ) },
        ]}
      />

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
      {highlightReviewPath && (
        <HighlightReviewView
          picksPath={highlightReviewPath}
          onClose={() => setHighlightReviewPath(null)}
          onBuilt={() => setHighlightReviewPath(null)}
        />
      )}

      {creativeEditorPath && (
        <CreativeEditorView
          picksPath={creativeEditorPath}
          advisorPath={creativeEditorPath.replace(/last_highlight_picks\.json$/, "music_advisor.json")}
          onClose={() => setCreativeEditorPath(null)}
          onStartNewProject={() => {
            setCreativeEditorPath(null);
            setShowNewProject(true);
          }}
        />
      )}

      {showNewProject && (
        <NewProjectModal
          onClose={() => setShowNewProject(false)}
          onComplete={(picksPath) => {
            setShowNewProject(false);
            setCreativeEditorPath(picksPath);
          }}
        />
      )}

      {showWeddingWizard && (
        <GuidedWeddingWizard
          onClose={() => setShowWeddingWizard(false)}
          onComplete={() => {
            setShowWeddingWizard(false);
            // TODO: chain into ekte extract når alle steg er bygget
          }}
        />
      )}

      {showFirstRun && <FirstRunSetupWizard onClose={() => setShowFirstRun(false)} />}

      {/* Auto-prompt sign-in on launch when first-run is done but user isn't authed.
          Suppressed during first-run since the wizard handles the initial auth. */}
      {!showFirstRun && showSignIn && (
        <RoleRoomSignInDialog
          onClose={() => setShowSignIn(false)}
          onSignedIn={() => setShowSignIn(false)}
        />
      )}

      {showWatch && <WatchFolderModal onClose={() => setShowWatch(false)} />}

      {showMagicCut && activeTemplate && (
        <MagicCutDialog
          templateId={activeTemplate.id}
          templateName={activeTemplate.name}
          onClose={() => setShowMagicCut(false)}
        />
      )}

      {showSignIn && (
        <RoleRoomSignInDialog
          onClose={() => setShowSignIn(false)}
          onSignedIn={() => setShowSignIn(false)}
        />
      )}
    </div>
  );
}
