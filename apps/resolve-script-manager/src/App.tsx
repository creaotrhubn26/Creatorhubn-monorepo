import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import "./styles/animations.css";
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
import { DemoStudioShell } from "./components/demo-studio/DemoStudioShell";
import { ModuleGate } from "./components/ModuleGate";
import {
  getEntitledModules,
  onEntitlementsChanged,
  refreshEntitlements,
  type PostAgentModule,
} from "./entitlements";
import { StoryTestHarness } from "./components/story/StoryTestHarness";
import { DemoTestHarness } from "./components/demo-studio/DemoTestHarness";
import { AgentEditorView } from "./components/AgentEditorView";
import MUSIC_VIDEO_AGENT_CONFIG from "./agents/music_video";
import CORPORATE_AGENT_CONFIG from "./agents/corporate";
import SCREEN_RECORDING_AGENT_CONFIG from "./agents/screen_recording";
import EVENT_AGENT_CONFIG from "./agents/event";
import DOCUMENTARY_AGENT_CONFIG from "./agents/documentary";
import PODCAST_AGENT_CONFIG from "./agents/podcast";
import SHORT_FILM_AGENT_CONFIG from "./agents/short_film";
import type { AgentConfig } from "./agents/types";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { NewProjectModal } from "./components/NewProjectModal";
import { GuidedWeddingWizard } from "./components/GuidedWeddingWizard";
import { QcSourceVideoModal } from "./components/QcSourceVideoModal";
import { CommandPalette } from "./components/CommandPalette";
import { LearningView } from "./components/LearningView";
import { FirstRunSetupWizard, shouldShowFirstRun } from "./components/FirstRunSetupWizard";
import { UpdaterDialog } from "./components/UpdaterDialog";
import { WatchFolderModal } from "./components/WatchFolderModal";
import { PhotoshopBridgeDialog } from "./components/PhotoshopBridgeDialog";
import { FireflyPromptDialog } from "./components/FireflyPromptDialog";
import { PhotoshopWorkspaceDialog } from "./components/PhotoshopWorkspaceDialog";
import { MultiAgentDirectorDialog } from "./components/MultiAgentDirectorDialog";
import { PhotoshopTemplateDialog } from "./components/PhotoshopTemplateDialog";
import { PsdGalleryDialog } from "./components/PsdGalleryDialog";
import { PhotoshopHealthCheckDialog } from "./components/PhotoshopHealthCheckDialog";
import {
  PhotoshopOnboardingTour,
  hasCompletedPhotoshopTour,
} from "./components/PhotoshopOnboardingTour";
import { FeedbackDialog } from "./components/FeedbackDialog";
import { HelpDialog } from "./components/HelpDialog";
import { PhotoshopSetupWizard } from "./components/PhotoshopSetupWizard";
import { PhotoshopScaffoldDialog } from "./components/PhotoshopScaffoldDialog";
import { AiImageDialog } from "./components/AiImageDialog";
import { ArtDirectorDialog } from "./components/ArtDirectorDialog";
import { CreationsDialog } from "./components/CreationsDialog";
import { MagicCutDialog } from "./components/MagicCutDialog";
import { HomeView, recordRecentProject } from "./components/HomeView";
import { IconChevronLeft, IconChevronRight } from "./components/Icons";
import { updateAppSettings } from "./api";
import { useProjectTemplate } from "./hooks/useProjectTemplate";

const MAX_LOG_EVENTS = 500;

/**
 * Test-bypass: når URL har `?test=story`, eksporter vi en harness som
 * direkte mounter StoryView med pre-loaded picks fra window.__POST_AGENT_TEST_PICKS__.
 * Brukes av Playwright e2e — ingen prod-effekt fordi flagget kun
 * finnes når Playwright setter det.
 */
function isStoryTestMode(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("test") === "story";
}

function isDemoTestMode(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("test") === "demo";
}

export default function App() {
  if (isStoryTestMode()) {
    return <StoryTestHarness />;
  }
  if (isDemoTestMode()) {
    return <DemoTestHarness />;
  }

  const [registry, setRegistry] = useState<Registry | null>(null);
  const [workflows, setWorkflows] = useState<WorkflowMap>({});
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [events, setEvents] = useState<ScriptEvent[]>([]);
  const [runs, setRuns] = useState<Record<string, RunRecord>>({});
  const [busy, setBusy] = useState(false);
  const [pendingDialog, setPendingDialog] = useState<{ script: ScriptMeta; dryRun: boolean } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [view, setView] = useState<"pipeline" | "cull" | "audio" | "color" | "demo">("pipeline");
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
  // Auto-updater dialog-state. Set når sjekk finner ny versjon; null mens
  // ingen oppdatering venter eller mens vi laster ned. Selve download +
  // install kalles via onDownload-prop på UpdaterDialog.
  const [updateInfo, setUpdateInfo] = useState<{
    version: string;
    notes: string | null;
    runDownload: (
      onProgress: (fraction: number, status: "downloading" | "finished") => void,
    ) => Promise<void>;
  } | null>(null);
  const [agentEditorConfig, setAgentEditorConfig] = useState<AgentConfig | null>(null);
  const [agentSourcePath, setAgentSourcePath] = useState<string>("");
  // Ekte app-versjon fra Tauri (ikke hardkodet) — vises i footer + innstillinger.
  const [appVersion, setAppVersion] = useState<string>("");
  useEffect(() => {
    void import("@tauri-apps/api/app")
      .then(({ getVersion }) => getVersion())
      .then((v) => setAppVersion(v))
      .catch(() => { /* web/dev — ingen Tauri */ });
  }, []);

  const openAgent = useCallback(async (config: AgentConfig) => {
    try {
      const picked = await openFileDialog({
        multiple: false,
        title: `Velg kilde for ${config.name}`,
        filters: [
          { name: "Video", extensions: ["mp4", "mov", "mkv", "m4v", "avi"] },
          { name: "Audio", extensions: ["wav", "mp3", "flac", "aif", "aiff", "m4a"] },
        ],
      });
      if (typeof picked === "string" && picked.length > 0) {
        setAgentSourcePath(picked);
        setAgentEditorConfig(config);
      }
    } catch (err) {
      console.error(`[${config.kind}] file pick failed:`, err);
    }
  }, []);
  const [showNewProject, setShowNewProject] = useState(false);
  const [showWeddingWizard, setShowWeddingWizard] = useState(false);
  const [showQcVideo, setShowQcVideo] = useState(false);
  // Listen for cross-component requests to open the deps modal
  // (dispatched from e.g. RoleRoomProjectSync when ffprobe is missing).
  useEffect(() => {
    const handler = () => setShowDependencies(true);
    window.addEventListener("trrpa:open-dependencies", handler);
    return () => window.removeEventListener("trrpa:open-dependencies", handler);
  }, []);
  const [showFirstRun, setShowFirstRun] = useState(() => shouldShowFirstRun());
  const [showWatch, setShowWatch] = useState(false);
  const [showPhotoshopBridge, setShowPhotoshopBridge] = useState(false);
  const [showFireflyPrompt, setShowFireflyPrompt] = useState(false);
  const [showPhotoshopWorkspace, setShowPhotoshopWorkspace] = useState(false);
  const [showMultiAgent, setShowMultiAgent] = useState(false);
  const [showPhotoshopTemplates, setShowPhotoshopTemplates] = useState(false);
  const [showPsdGallery, setShowPsdGallery] = useState(false);
  const [showPhotoshopHealth, setShowPhotoshopHealth] = useState(false);
  const [showPhotoshopTour, setShowPhotoshopTour] = useState(
    () => !hasCompletedPhotoshopTour(),
  );
  const [showFeedback, setShowFeedback] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showPhotoshopSetup, setShowPhotoshopSetup] = useState(false);
  const [showPhotoshopScaffold, setShowPhotoshopScaffold] = useState(false);
  const [showAiImage, setShowAiImage] = useState(false);
  const [showArtDirector, setShowArtDirector] = useState(false);
  const [showCreations, setShowCreations] = useState(false);
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
      // Updater-handler: brukes både av menu://check-updates og av
      // auto-check ved oppstart. Sjekker etter ny versjon; hvis funnet
      // setter vi updateInfo som rendrer UpdaterDialog. Selve nedlastings-
      // + install-kallet skjer fra dialogens "Last ned"-knapp via
      // runDownload-prop, som propagerer Tauri-download-events tilbake til
      // dialogens progress-bar. notifyNone=true betyr "menu trigget,
      // si fra hvis det ikke er noe nytt"; auto-check skipper det.
      const runUpdateCheck = async (notifyNone: boolean) => {
        try {
          const updater = await import("@tauri-apps/plugin-updater");
          const update = await updater.check();
          if (!update) {
            if (notifyNone) {
              setEvents((prev) => [
                ...prev,
                { type: "log", ts: Date.now() / 1000, runId: "n/a", message: "No updates available" },
              ]);
            }
            return;
          }
          setEvents((prev) => [
            ...prev,
            { type: "log", ts: Date.now() / 1000, runId: "n/a",
              message: `Update available: v${update.version}` },
          ]);
          // Hold update-objektet i closure til brukeren klikker "Last ned".
          // downloadAndInstall tar en progress-callback med events:
          //   Started(contentLength) → vis 0
          //   Progress(chunkLength) → akkumuler bytes
          //   Finished → 100% + skift til installed-state
          setUpdateInfo({
            version: update.version,
            notes: update.body ?? null,
            runDownload: async (onProgress) => {
              let total = 0;
              let downloaded = 0;
              await update.downloadAndInstall((event) => {
                if (event.event === "Started") {
                  total = event.data.contentLength ?? 0;
                  onProgress(0, "downloading");
                } else if (event.event === "Progress") {
                  downloaded += event.data.chunkLength;
                  if (total > 0) onProgress(downloaded / total, "downloading");
                } else if (event.event === "Finished") {
                  onProgress(1, "finished");
                }
              });
            },
          });
        } catch (e) {
          // Updater not configured (no endpoint/pubkey) — silent i dev
          console.warn("[updater] not available:", e);
        }
      };
      listen("menu://check-updates", () => void runUpdateCheck(true))
        .then((u) => unlisteners.push(u));
      // Auto-check ved oppstart (én gang, 4 sek etter mount slik at
      // hovedflyten ikke blir blokket av en tung GitHub-fetch).
      const autoCheckTimer = window.setTimeout(() => void runUpdateCheck(false), 4000);
      unlisteners.push(() => window.clearTimeout(autoCheckTimer));
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

  // Silent helper — refresh health uten busy/log-spam (for autosjekk)
  const silentHealthCheck = useCallback(async () => {
    try {
      const summary = await runHealthCheck();
      const resultEvent = summary.events.find((e) => e.type === "result");
      if (resultEvent?.value && typeof resultEvent.value === "object") {
        setHealth(resultEvent.value as HealthStatus);
      }
    } catch { /* non-critical */ }
  }, []);

  // Role Room auth-status: undefined (sjekker), "ok" (gyldig token), "expired" (token finnes men 401), "none" (ingen token)
  const [authStatus, setAuthStatus] = useState<"checking" | "ok" | "expired" | "none">("checking");
  const [authUserEmail, setAuthUserEmail] = useState<string | null>(null);
  const [authMemberProfile, setAuthMemberProfile] = useState<{
    displayName: string | null;
    profileImageUrl: string | null;
    professions: string[];
  } | null>(null);
  // À la carte-moduler brukeren har låst opp (synket fra entitlements-cache
  // via 'trrpa:entitlements-changed'). Demo Studio m.fl. gates på disse.
  const [entitledModules, setEntitledModules] = useState<PostAgentModule[]>(getEntitledModules());
  useEffect(() => {
    const sync = () => setEntitledModules(getEntitledModules());
    return onEntitlementsChanged(sync);
  }, []);

  const silentAuthCheck = useCallback(async () => {
    const s = loadSettings();
    const token = s.RR_BEARER_TOKEN?.trim();
    if (!token) {
      setAuthStatus("none");
      setAuthUserEmail(null);
      void refreshEntitlements(); // tømmer modul-cache når utlogget
      return;
    }
    try {
      const base = (s.RR_POST_AGENT_BASE_URL || "https://creatorhubn.com/api/post-agent").replace(/\/$/, "");
      const res = await fetch(`${base}/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        // Et 200-svar fra /me betyr at token-et er gyldig → brukeren ER
        // innlogget. Tidligere krevde vi `me.email`, men enkelte kontoer
        // (OAuth/migrert) mangler email i users-raden → 200-uten-email ble
        // feilaktig tolket som «Token utløpt». Nå: 200 = innlogget, email er
        // bare til visning.
        const me = await res.json().catch(() => ({})) as { email?: string; name?: string };
        {
          setAuthStatus("ok");
          setAuthUserEmail(me?.email ?? null);
          void refreshEntitlements(); // hent hvilke moduler brukeren eier

          // Hent Role Room-medlemsprofil (avatar + navn + profesjon) i bakgrunnen.
          // Origin: strip /api/post-agent fra base for å nå sibling-endpoint
          try {
            const origin = base.replace(/\/api\/post-agent\/?$/, "");
            const profRes = await fetch(`${origin}/api/role-room/profile/me`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (profRes.ok) {
              const data = await profRes.json() as {
                profile?: { displayName?: string | null; profileImageUrl?: string | null; professions?: string[] };
              };
              const p = data.profile;
              if (p) {
                setAuthMemberProfile({
                  displayName: p.displayName ?? null,
                  profileImageUrl: p.profileImageUrl ?? null,
                  professions: p.professions ?? [],
                });
              }
            }
          } catch {
            // Profil-fetch er best-effort — status er allerede satt ok
          }
        }
      } else if (res.status === 401 || res.status === 403) {
        setAuthStatus("expired");
        setAuthUserEmail(null);
        setAuthMemberProfile(null);
      } else {
        setAuthStatus("expired");
        setAuthUserEmail(null);
        setAuthMemberProfile(null);
      }
    } catch {
      // Nettverksfeil — IKKE downgrade auth-status. Vi vet ikke om
      // tokenet er ugyldig eller om serveren bare er uoppnåelig.
      // Tidligere satte vi her "expired", som forårsaket en bug der
      // re-login fra dialogen ikke registrerte: nytt token ble lagret,
      // silentAuthCheck kjørte, men hvis fetchen feilet (eller var
      // litt sen), så ble status overskrevet til "expired" igjen.
      // Beholde nåværende status er trygt — neste auto-check eller
      // focus-trigger vil prøve igjen.
    }
  }, []);

  // Auto-refresh health + auth: ved fokus + hvert 30. sekund + på auth-change-event
  useEffect(() => {
    void silentHealthCheck();
    void silentAuthCheck();
    const onFocus = () => { silentHealthCheck(); silentAuthCheck(); };
    // Når pairing-dialogen lagrer ny token (saveBearerToSettings) fyrer
    // den 'trrpa:auth-changed' — uten denne lytteren venter HomeView
    // opp til 30s før status-pillen oppdateres.
    const onAuthChange = () => { silentAuthCheck(); };
    window.addEventListener("focus", onFocus);
    window.addEventListener("trrpa:auth-changed", onAuthChange);
    const interval = setInterval(() => {
      silentHealthCheck();
      silentAuthCheck();
    }, 30_000);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("trrpa:auth-changed", onAuthChange);
      clearInterval(interval);
    };
  }, [silentHealthCheck, silentAuthCheck]);

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
        onOpenPhotoshopBridge={() => setShowPhotoshopBridge(true)}
        onOpenFireflyPrompt={() => setShowFireflyPrompt(true)}
        onOpenPhotoshopWorkspace={() => setShowPhotoshopWorkspace(true)}
        onOpenMultiAgent={() => setShowMultiAgent(true)}
        onOpenPhotoshopTemplates={() => setShowPhotoshopTemplates(true)}
        onOpenPsdGallery={() => setShowPsdGallery(true)}
        onOpenPhotoshopHealth={() => setShowPhotoshopHealth(true)}
        onOpenPhotoshopTour={() => setShowPhotoshopTour(true)}
        onOpenFeedback={() => setShowFeedback(true)}
        onOpenHelp={() => setShowHelp(true)}
        onOpenPhotoshopSetup={() => setShowPhotoshopSetup(true)}
        onOpenPhotoshopScaffold={() => setShowPhotoshopScaffold(true)}
        onOpenAiImage={() => setShowAiImage(true)}
        onOpenArtDirector={() => setShowArtDirector(true)}
        onOpenCreations={() => setShowCreations(true)}
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
          onOpenMusicVideoAgent={() => void openAgent(MUSIC_VIDEO_AGENT_CONFIG)}
          onOpenCorporateAgent={() => void openAgent(CORPORATE_AGENT_CONFIG)}
          onOpenScreenRecordingAgent={() => void openAgent(SCREEN_RECORDING_AGENT_CONFIG)}
          onOpenEventAgent={() => void openAgent(EVENT_AGENT_CONFIG)}
          onOpenDocumentaryAgent={() => void openAgent(DOCUMENTARY_AGENT_CONFIG)}
          onOpenPodcastAgent={() => void openAgent(PODCAST_AGENT_CONFIG)}
          onOpenShortFilmAgent={() => void openAgent(SHORT_FILM_AGENT_CONFIG)}
          onOpenDemoStudio={() => setView("demo")}
          onOpenQcVideo={() => setShowQcVideo(true)}
          onOpenSavedProject={(picksPath) => setCreativeEditorPath(picksPath)}
          signedIn={authStatus === "ok"}
          authStatus={authStatus}
          authUserEmail={authUserEmail}
          authMemberProfile={authMemberProfile}
          onSignIn={() => setShowSignIn(true)}
          resolveConnected={Boolean(health?.resolveRunning && health?.projectOpen)}
          resolveRunning={Boolean(health?.resolveRunning)}
          resolveProjectOpen={Boolean(health?.projectOpen)}
          resolveProjectName={health?.projectName}
        />
      )}

      {/* #6 à la carte-gating: culling = Capture-modul, audio/color (Fairlight/
          grading) = Resolve-modul. Admin/eier bypasser (entitlements gir alle). */}
      {view === "cull" && (
        authStatus === "ok" && entitledModules.includes("capture")
          ? <CullView activeTemplate={activeTemplate} />
          : <ModuleGate module="capture" signedIn={authStatus === "ok"} onClose={() => setView("pipeline")} onSignIn={() => setShowSignIn(true)} />
      )}
      {view === "audio" && (
        authStatus === "ok" && entitledModules.includes("resolve")
          ? <AudioView />
          : <ModuleGate module="resolve" signedIn={authStatus === "ok"} onClose={() => setView("pipeline")} onSignIn={() => setShowSignIn(true)} />
      )}
      {view === "color" && (
        authStatus === "ok" && entitledModules.includes("resolve")
          ? <ColorView activeTemplate={activeTemplate} />
          : <ModuleGate module="resolve" signedIn={authStatus === "ok"} onClose={() => setView("pipeline")} onSignIn={() => setShowSignIn(true)} />
      )}
      {view === "demo" &&
        (authStatus === "ok" && entitledModules.includes("demo_studio") ? (
          <DemoStudioShell onClose={() => setView("pipeline")} />
        ) : (
          <ModuleGate
            module="demo_studio"
            signedIn={authStatus === "ok"}
            onClose={() => setView("pipeline")}
            onSignIn={() => setShowSignIn(true)}
          />
        ))}

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
          <span className="footer-version">{appVersion ? `v${appVersion}` : ""}</span>
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
          /* music_advisor.json er en singleton i app-data-dir — ikke per-projekt.
             Bruk app-data + filnavn istedet for å derive fra picks-path
             (som ikke matcher arkiverte filer). */
          advisorPath={
            creativeEditorPath.replace(
              /(?:picks\/[^/]+\.json|last_highlight_picks\.json)$/,
              "music_advisor.json",
            )
          }
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

      {agentEditorConfig && (
        <AgentEditorView
          sourcePath={agentSourcePath}
          config={agentEditorConfig}
          onClose={() => {
            setAgentEditorConfig(null);
            setAgentSourcePath("");
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

      {showQcVideo && <QcSourceVideoModal onClose={() => setShowQcVideo(false)} />}

      {showFirstRun && <FirstRunSetupWizard onClose={() => setShowFirstRun(false)} />}

      {/* Auto-prompt sign-in on launch when first-run is done but user isn't authed.
          Suppressed during first-run since the wizard handles the initial auth. */}
      {!showFirstRun && showSignIn && (
        <RoleRoomSignInDialog
          onClose={() => setShowSignIn(false)}
          onSignedIn={() => { setShowSignIn(false); void silentAuthCheck(); }}
        />
      )}

      {showWatch && <WatchFolderModal onClose={() => setShowWatch(false)} />}
      {showPhotoshopBridge && (
        <PhotoshopBridgeDialog onClose={() => setShowPhotoshopBridge(false)} />
      )}

      <FireflyPromptDialog
        open={showFireflyPrompt}
        onClose={() => setShowFireflyPrompt(false)}
        onApply={(prompt) => {
          // Lagre i clipboard som default action — parent kan plugge inn
          // egen handler senere når gen.fill-panel er bygd.
          void navigator.clipboard?.writeText(prompt);
        }}
      />

      <PhotoshopWorkspaceDialog
        open={showPhotoshopWorkspace}
        onClose={() => setShowPhotoshopWorkspace(false)}
        onOpenFireflyPrompt={() => {
          setShowPhotoshopWorkspace(false);
          setShowFireflyPrompt(true);
        }}
      />

      <MultiAgentDirectorDialog
        open={showMultiAgent}
        onClose={() => setShowMultiAgent(false)}
      />
      {showPhotoshopTemplates && (
        <PhotoshopTemplateDialog onClose={() => setShowPhotoshopTemplates(false)} />
      )}
      {showPsdGallery && (
        <PsdGalleryDialog onClose={() => setShowPsdGallery(false)} />
      )}
      {showPhotoshopHealth && (
        <PhotoshopHealthCheckDialog onClose={() => setShowPhotoshopHealth(false)} />
      )}
      {showPhotoshopTour && (
        <PhotoshopOnboardingTour onClose={() => setShowPhotoshopTour(false)} />
      )}
      {showCreations && (
        <CreationsDialog onClose={() => setShowCreations(false)} />
      )}
      {showArtDirector && (
        <ArtDirectorDialog onClose={() => setShowArtDirector(false)} />
      )}
      {showAiImage && (
        <AiImageDialog onClose={() => setShowAiImage(false)} />
      )}
      {showPhotoshopScaffold && (
        <PhotoshopScaffoldDialog onClose={() => setShowPhotoshopScaffold(false)} />
      )}
      {showPhotoshopSetup && (
        <PhotoshopSetupWizard onClose={() => setShowPhotoshopSetup(false)} />
      )}
      {showHelp && (
        <HelpDialog onClose={() => setShowHelp(false)} />
      )}
      {showFeedback && (
        <FeedbackDialog onClose={() => setShowFeedback(false)} />
      )}

      {updateInfo && (
        <UpdaterDialog
          version={updateInfo.version}
          notes={updateInfo.notes}
          onDownload={updateInfo.runDownload}
          onDismiss={() => setUpdateInfo(null)}
        />
      )}

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
          onSignedIn={() => { setShowSignIn(false); void silentAuthCheck(); }}
        />
      )}
    </div>
  );
}
