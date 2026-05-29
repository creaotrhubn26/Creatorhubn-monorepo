/**
 * GuidedWeddingWizard — fullstendig onboarding for bryllups-prosjekt.
 *
 * 8 steg, hvert et med læring-hook (manuelle korreksjoner skrives til
 * trrpa.learnings.global slik at Claude lærer fra sessionen).
 *
 *   1. Materialet      — mappe-pick + multicam-deteksjon + 3 timeline-valg
 *   2. Ekstern lyd     — TODO (placeholder)
 *   3. Sanger + kultur — TODO
 *   4. Personer        — TODO (face-clustering)
 *   5. Stil            — TODO (storytelling/cinematic/energetic + FlowMap)
 *   6. Live-arbeid     — TODO (Harry-Potter preview-stream)
 *   7. Color/LUT       — TODO
 *   8. Klar i Resolve  — TODO
 */

import { useEffect, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { executeScript, onScriptEvent, listMountedCards, runHealthCheck, launchResolve, convertFileSrc } from "../api";
import type { ScriptEvent, MountedCard, HealthStatus } from "../types";
import { logActivity } from "../lib/projectActivity";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningIcon from "@mui/icons-material/Warning";
import ErrorIcon from "@mui/icons-material/Error";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import RefreshIcon from "@mui/icons-material/Refresh";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import CheckIcon from "@mui/icons-material/Check";
import SaveIcon from "@mui/icons-material/Save";
import StorageIcon from "@mui/icons-material/Storage";
import FolderIcon from "@mui/icons-material/Folder";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import LightbulbIcon from "@mui/icons-material/Lightbulb";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import GroupIcon from "@mui/icons-material/Group";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import MovieIcon from "@mui/icons-material/Movie";
import BoltIcon from "@mui/icons-material/Bolt";
import BalanceIcon from "@mui/icons-material/Balance";
import PaletteIcon from "@mui/icons-material/Palette";
import VideocamIcon from "@mui/icons-material/Videocam";
import ConstructionIcon from "@mui/icons-material/Construction";

interface Props {
  onClose: () => void;
  onComplete: (sourceVideo: string) => void;
}

interface MulticamGroup {
  startSec: number;
  durationSec: number;
  angles: string[];
  confidence: number;
}

interface ScanResult {
  folder: string;
  clipCount: number;
  multicamGroups: MulticamGroup[];
  multicamGroupCount: number;
  clips?: Array<{ path: string; duration: number; fps?: number; width?: number; height?: number }>;
}

type Step = "sources" | "material" | "audio" | "music" | "persons" | "style" | "live" | "color" | "done";

const STEPS: Array<{ id: Step; label: string; n: number }> = [
  { id: "sources",  label: "Kilder + kameraer", n: 1 },
  { id: "material", label: "Multicam-scan",     n: 2 },
  { id: "audio",    label: "Ekstern lyd",       n: 3 },
  { id: "music",    label: "Sanger",            n: 4 },
  { id: "persons",  label: "Personer",          n: 5 },
  { id: "style",    label: "Stil",              n: 6 },
  { id: "live",     label: "Live-arbeid",       n: 7 },
  { id: "color",    label: "Color / LUT",       n: 8 },
];

interface SourceEntry { path: string; role: "card" | "folder" | "ssd"; label?: string }
interface CameraInfo {
  id: string; make: string | null; model: string | null; serial: string | null;
  clips: Array<{ path: string; duration: number; sizeBytes: number }>;
  totalDuration: number; totalSizeBytes: number; codec: string | null;
  resolution: string | null; suggestedAngle: number; clipCount: number;
}

export function GuidedWeddingWizard({ onClose, onComplete }: Props) {
  const [step, setStep] = useState<Step>("sources");
  // QC-prompt: erstatter native confirm() med en in-app dialog. Promise-
  // basert så fortsatt await-bar fra resten av wizard-flowen.
  const [qcPrompt, setQcPrompt] = useState<{
    warnings: string[];
    resolve: (v: boolean) => void;
  } | null>(null);
  const askQcMarkers = (warnings: string[]): Promise<boolean> => {
    return new Promise((resolve) => setQcPrompt({ warnings, resolve }));
  };

  // Steg 0 (NY): Kilder + kameraer
  const [mountedCards, setMountedCards] = useState<MountedCard[]>([]);
  const [sources, setSources] = useState<SourceEntry[]>([]);
  const [sourceScanBusy, setSourceScanBusy] = useState(false);
  const [sourceScanPct, setSourceScanPct] = useState(0);
  const [sourceScanMsg, setSourceScanMsg] = useState("");
  const [cameras, setCameras] = useState<CameraInfo[]>([]);
  const [audioFilesDetected, setAudioFilesDetected] = useState<Array<{ path: string; duration: number; sizeBytes: number }>>([]);
  const [angleAssignment, setAngleAssignment] = useState<Record<string, number>>({});
  const [angleLabels, setAngleLabels] = useState<Record<string, string>>({});
  const [sourceScanError, setSourceScanError] = useState<string | null>(null);
  const [backupTarget, setBackupTarget] = useState<string>("");
  const [wantBackup, setWantBackup] = useState<boolean>(false);
  const [benchmarkResult, setBenchmarkResult] = useState<{ writeMBs: number; readMBs: number; verdict: string } | null>(null);
  const [benchmarkBusy, setBenchmarkBusy] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupPct, setBackupPct] = useState(0);
  const [backupMsg, setBackupMsg] = useState("");
  const [backupResult, setBackupResult] = useState<{ projectRoot: string; manifestPath: string; filesCount: number } | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string>("");

  useEffect(() => {
    listMountedCards().then(setMountedCards).catch(() => { /* non-critical */ });
  }, []);

  // Resolve connection state
  const [resolveHealth, setResolveHealth] = useState<HealthStatus | null>(null);
  const [resolveChecking, setResolveChecking] = useState(false);

  const checkResolve = async () => {
    setResolveChecking(true);
    try {
      const sum = await runHealthCheck();
      const r = sum.events.find((e) => e.type === "result");
      if (r?.value) setResolveHealth(r.value as HealthStatus);
    } catch { /* non-critical */ }
    setResolveChecking(false);
  };

  useEffect(() => { checkResolve(); }, []);

  // Steg 1: Material state
  const [folder, setFolder] = useState<string>("");
  const [scanning, setScanning] = useState(false);
  const [scanPct, setScanPct] = useState(0);
  const [scanMsg, setScanMsg] = useState("");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  // User choices
  const [enableMulticam, setEnableMulticam] = useState(true);
  const [makeLongFilm, setMakeLongFilm] = useState(true);
  const [makeHighlight, setMakeHighlight] = useState(true);
  const [makeTeaser, setMakeTeaser] = useState(true);

  // Steg 2: Ekstern lyd state
  const [hasExternal, setHasExternal] = useState<boolean | null>(null);
  const [externalFolder, setExternalFolder] = useState<string>("");
  const [matchPct, setMatchPct] = useState(0);
  const [matchMsg, setMatchMsg] = useState("");
  const [matching, setMatching] = useState(false);
  const [matchResult, setMatchResult] = useState<{
    matches: Array<{ externalAudio: string; clipPath: string; offsetSec: number; confidence: number }>;
    matchCount: number;
  } | null>(null);
  const [matchError, setMatchError] = useState<string | null>(null);
  // Bruker-overrides: matchIndex → "correct" | "wrong" (læring)
  const [matchOverrides, setMatchOverrides] = useState<Record<number, "correct" | "wrong">>({});

  // Steg 3: Sanger + kultur
  type SongRole = "main" | "entry" | "first_dance" | "dance" | "exit";
  type WishedSong = { id: string; title: string; artist: string; role: SongRole };
  const [culture, setCulture] = useState<string>("");
  const [cultureOther, setCultureOther] = useState<string>("");
  const [wishedSongs, setWishedSongs] = useState<WishedSong[]>([]);
  const [newSongTitle, setNewSongTitle] = useState("");
  const [newSongArtist, setNewSongArtist] = useState("");
  const [musicSuggestBusy, setMusicSuggestBusy] = useState(false);
  const [musicSuggestError, setMusicSuggestError] = useState<string | null>(null);

  // Steg 4: Personer — face-clustering
  type FaceCluster = { id: string; thumbnail: string; occurrences: number; clips: Array<{ clip: string; timeSec: number }> };
  const [facesScanning, setFacesScanning] = useState(false);
  const [facesPct, setFacesPct] = useState(0);
  const [facesMsg, setFacesMsg] = useState("");
  const [faceClusters, setFaceClusters] = useState<FaceCluster[]>([]);
  const [facesError, setFacesError] = useState<string | null>(null);
  const [faceLabels, setFaceLabels] = useState<Record<string, string>>({});  // clusterId → label

  const PERSON_SUGGESTIONS = [
    "Brud", "Brudgom", "Brudens mor", "Brudens far", "Brudgom mor", "Brudgom far",
    "Brudens søster", "Brudgom søster", "Brudens bror", "Brudgom bror",
    "Forlover", "Brudepike", "Prest", "Annet",
  ];

  // Steg 5: Stil
  type Style = "storytelling" | "cinematic" | "energetic" | "balanced";
  const [chosenStyle, setChosenStyle] = useState<Style>("balanced");

  // Steg 6: Live-arbeid
  const [liveRunning, setLiveRunning] = useState(false);
  const [livePct, setLivePct] = useState(0);
  const [liveMsg, setLiveMsg] = useState("");
  const [livePicks, setLivePicks] = useState<Array<{ index: number; chapter: string; thumbPath?: string }>>([]);
  const [livePicksPath, setLivePicksPath] = useState<string | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  // Live shot-scoring stream (Harry Potter mode)
  type LiveShot = { index: number; startSec: number; endSec: number; score: number; thumbnailPath: string | null; accepted: boolean | null };
  const [liveShots, setLiveShots] = useState<LiveShot[]>([]);

  // Steg 7: Color / LUT
  const [logGamma, setLogGamma] = useState<{ isLog: boolean; profile: string; suggestedLut?: string } | null>(null);
  const [applyLut, setApplyLut] = useState(false);
  const [logCheckBusy, setLogCheckBusy] = useState(false);

  // Læring: record decisions
  const recordLearning = (note: string) => {
    try {
      const entry = { ts: Date.now(), kind: "wizard_choice", note };
      const raw = localStorage.getItem("trrpa.learnings.global");
      const list = raw ? JSON.parse(raw) : [];
      list.unshift(entry);
      localStorage.setItem("trrpa.learnings.global", JSON.stringify(list.slice(0, 200)));
    } catch { /* non-critical */ }
  };

  // ESC closes
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !scanning) onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [scanning, onClose]);

  const pickFolder = async () => {
    const sel = await openDialog({
      multiple: false,
      directory: true,
      title: "Pek mappa der bryllups-materialet ligger",
    });
    if (typeof sel === "string") setFolder(sel);
  };

  const startScan = async () => {
    if (!folder) return;
    setScanning(true);
    setScanError(null);
    setScanResult(null);
    setScanPct(0);

    const unsubProm = onScriptEvent((ev: ScriptEvent) => {
      if (ev.type === "progress") {
        const pct = ev.total ? Math.round(((ev.current ?? 0) / ev.total) * 100) : 0;
        setScanPct(pct); setScanMsg(ev.message || "");
      }
    });

    try {
      const sum = await executeScript("scan_folder_multicam", {
        folder,
        audioVerify: true,
      }, false);
      const r = sum.events.find((e) => e.type === "result");
      const val = r?.value as ScanResult | undefined;
      if (val) setScanResult(val);
      else setScanError("Skanningen returnerte ingen data");
    } catch (err) {
      setScanError(String(err));
    } finally {
      unsubProm.then((u) => u());
      setScanning(false);
    }
  };

  const goNext = () => {
    // Record user choices for læring
    if (scanResult) {
      const choices = [
        `multicam=${enableMulticam}`,
        `longFilm=${makeLongFilm}`,
        `highlight=${makeHighlight}`,
        `teaser=${makeTeaser}`,
        `clipCount=${scanResult.clipCount}`,
        `multicamGroups=${scanResult.multicamGroupCount}`,
      ];
      recordLearning(`Steg 1 valg: ${choices.join(", ")}`);
    }
    // Move to next step
    const cur = STEPS.findIndex((s) => s.id === step);
    if (cur < STEPS.length - 1) setStep(STEPS[cur + 1].id);
    else onComplete(folder);
  };

  const currentStepN = STEPS.find((s) => s.id === step)?.n ?? 1;

  return (
    <div className="modal-backdrop anim-fade-in" onClick={!scanning ? onClose : undefined}>
      <div className="modal anim-slide-up" onClick={(e) => e.stopPropagation()}
           style={{ maxWidth: 860, width: "min(96vw, 860px)", maxHeight: "92vh",
                     overflowY: "auto" }}>
        <h2>Nytt bryllup — {STEPS[currentStepN - 1].label}</h2>

        {/* Resolve-connection status banner */}
        <div style={{ display: "flex", alignItems: "center", gap: 10,
                       padding: "8px 12px", borderRadius: 6, marginTop: 10,
                       background: resolveHealth?.resolveRunning && resolveHealth?.projectOpen
                         ? "rgba(74, 212, 138, 0.10)"
                         : resolveHealth?.resolveRunning
                         ? "rgba(240, 165, 0, 0.10)"
                         : "rgba(239, 79, 111, 0.10)",
                       border: `1px solid ${
                         resolveHealth?.resolveRunning && resolveHealth?.projectOpen
                           ? "#4ad48a"
                           : resolveHealth?.resolveRunning
                           ? "#f0a500"
                           : "#ef4f6f"
                       }`,
                       fontSize: 12 }}>
          <span style={{ display: "inline-flex", alignItems: "center" }}>
            {resolveHealth?.resolveRunning && resolveHealth?.projectOpen
              ? <CheckCircleIcon sx={{ fontSize: 16, color: "#4ad48a" }} />
              : resolveHealth?.resolveRunning
              ? <WarningIcon sx={{ fontSize: 16, color: "#f0a500" }} />
              : <ErrorIcon sx={{ fontSize: 16, color: "#ef4f6f" }} />}
          </span>
          <span style={{ flex: 1 }}>
            <strong>DaVinci Resolve:</strong>{" "}
            {resolveHealth === null
              ? "Sjekker tilkobling …"
              : resolveHealth.resolveRunning && resolveHealth.projectOpen
              ? `Koblet til "${resolveHealth.projectName}"`
              : resolveHealth.resolveRunning
              ? "Kjører, men ingen prosjekt er åpnet"
              : "Ikke kjører — åpne Resolve med et prosjekt"}
          </span>
          <button onClick={checkResolve} disabled={resolveChecking}
                  style={{ fontSize: 11, padding: "4px 10px", display: "inline-flex", alignItems: "center", gap: 4 }}>
            {resolveChecking
              ? <HourglassEmptyIcon sx={{ fontSize: 12 }} />
              : <><RefreshIcon sx={{ fontSize: 12 }} /> Sjekk</>}
          </button>
          {!resolveHealth?.resolveRunning && (
            <button onClick={async () => {
              try { await launchResolve(); setTimeout(checkResolve, 3000); }
              catch { /* noop */ }
            }} style={{ fontSize: 11, padding: "4px 10px", display: "inline-flex", alignItems: "center", gap: 4 }}>
              <PlayArrowIcon sx={{ fontSize: 12 }} /> Åpne Resolve
            </button>
          )}
        </div>

        {/* Step-progress strip */}
        <div style={{ display: "flex", gap: 4, margin: "12px 0 20px", flexWrap: "wrap" }}>
          {STEPS.map((s) => (
            <div key={s.id}
                 style={{ flex: 1, minWidth: 80, padding: "6px 10px", borderRadius: 6,
                           background: s.n < currentStepN ? "var(--accent-dim)"
                                     : s.n === currentStepN ? "var(--accent)"
                                     : "var(--bg-3)",
                           color: s.n === currentStepN ? "white" : "inherit",
                           fontSize: 11, textAlign: "center",
                           opacity: s.n > currentStepN ? 0.5 : 1 }}>
              {s.n}. {s.label}
            </div>
          ))}
        </div>

        {/* ────── Step 1 (NY): Kilder + kameraer ────── */}
        {step === "sources" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 14, lineHeight: 1.5 }}>
              Hvor ligger materialet? Du kan legge til flere kilder (SD-kort, SSD, mapper).
              Jeg leser kamera-metadata og grupperer klipp per kamera.
            </div>

            {mountedCards.length > 0 && (
              <div style={{ background: "var(--bg-3)", padding: 12, borderRadius: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8,
                                display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <CameraAltIcon sx={{ fontSize: 14 }} /> Tilkoblede kort/SSD-er:
                </div>
                {mountedCards.map((c) => {
                  const added = sources.find((s) => s.path === c.mount_path);
                  return (
                    <div key={c.mount_path}
                          style={{ display: "flex", alignItems: "center", gap: 8,
                                    padding: 8, borderRadius: 4, marginBottom: 6,
                                    background: added ? "rgba(74, 212, 138, 0.10)" : "transparent" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <strong style={{ fontSize: 13 }}>{c.volume_label}</strong>
                        {c.camera_guess && (
                          <span style={{ fontSize: 11, opacity: 0.7, marginLeft: 6 }}>
                            — {c.camera_guess}
                          </span>
                        )}
                        <div style={{ fontSize: 11, opacity: 0.6 }}>
                          {c.mount_path} · {c.total_clips} klipp · {(c.total_bytes / 1e9).toFixed(1)} GB
                        </div>
                      </div>
                      {!added ? (
                        <button onClick={() => setSources((p) => [...p, { path: c.mount_path, role: "card", label: c.volume_label }])}
                                style={{ fontSize: 11, padding: "4px 10px" }}>
                          + Legg til
                        </button>
                      ) : (
                        <span style={{ fontSize: 11, color: "#4ad48a", display: "inline-flex", alignItems: "center", gap: 2 }}><CheckIcon sx={{ fontSize: 12 }} /> Lagt til</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={async () => {
                const sel = await openDialog({ multiple: false, directory: true, title: "Pek på mappe" });
                if (typeof sel === "string") {
                  setSources((p) => [...p, { path: sel, role: "folder", label: sel.split("/").pop() }]);
                }
              }}>+ Legg til mappe</button>
              <button onClick={() => listMountedCards().then(setMountedCards)}
                      style={{ fontSize: 11, display: "inline-flex", alignItems: "center", gap: 4 }}>
                <RefreshIcon sx={{ fontSize: 12 }} /> Re-skann
              </button>
            </div>

            {sources.length > 0 && (
              <div style={{ background: "var(--bg-3)", padding: 12, borderRadius: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
                  Valgte kilder ({sources.length}):
                </div>
                {sources.map((s, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8,
                                          padding: "4px 6px", fontSize: 12 }}>
                    <span style={{ display: "inline-flex", alignItems: "center" }}>
                      {s.role === "card"
                        ? <SaveIcon sx={{ fontSize: 14 }} />
                        : s.role === "ssd"
                        ? <StorageIcon sx={{ fontSize: 14 }} />
                        : <FolderIcon sx={{ fontSize: 14 }} />}
                    </span>
                    <span style={{ flex: 1, minWidth: 0, overflow: "hidden",
                                    textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.label || s.path}
                    </span>
                    <button onClick={() => setSources((p) => p.filter((_, idx) => idx !== i))}
                            style={{ fontSize: 11, padding: "2px 8px", display: "inline-flex", alignItems: "center" }}>
                      <CloseIcon sx={{ fontSize: 12 }} />
                    </button>
                  </div>
                ))}

                {cameras.length === 0 && !sourceScanBusy && (
                  <button className="primary"
                          style={{ marginTop: 10, width: "100%" }}
                          onClick={async () => {
                    setSourceScanBusy(true);
                    setSourceScanError(null);
                    const unsub = onScriptEvent((ev: ScriptEvent) => {
                      if (ev.type === "progress") {
                        const pct = ev.total ? Math.round(((ev.current ?? 0) / ev.total) * 100) : 0;
                        setSourceScanPct(pct); setSourceScanMsg(ev.message || "");
                      }
                    });
                    try {
                      const sum = await executeScript("scan_and_organize_sources", {
                        sources: sources.map((s) => ({ path: s.path, role: s.role })),
                      }, false);
                      const r = sum.events.find((e) => e.type === "result");
                      const val = r?.value as { cameras?: CameraInfo[]; audioFiles?: typeof audioFilesDetected } | undefined;
                      if (val?.cameras) {
                        setCameras(val.cameras);
                        const assign: Record<string, number> = {};
                        val.cameras.forEach((c) => { assign[c.id] = c.suggestedAngle; });
                        setAngleAssignment(assign);
                        logActivity(sources[0]?.path || null, {
                          kind: "multicam_scan",
                          label: `${val.cameras.length} kamera${val.cameras.length > 1 ? "er" : ""} identifisert`,
                          summary: val.cameras.map((c) => `${c.model || "?"} (${c.clipCount} klipp)`).join(", "),
                        });
                      }
                      if (val?.audioFiles) setAudioFilesDetected(val.audioFiles);
                    } catch (err) {
                      setSourceScanError(String(err));
                    } finally {
                      unsub.then((u) => u());
                      setSourceScanBusy(false);
                    }
                  }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <SearchIcon sx={{ fontSize: 14 }} /> Skanne alle kilder + identifiser kameraer
                    </span>
                  </button>
                )}
              </div>
            )}

            {sourceScanBusy && (
              <div>
                <div style={{ height: 6, background: "var(--bg-3)", borderRadius: 3, overflow: "hidden", marginBottom: 6 }}>
                  <div style={{ width: `${sourceScanPct}%`, height: "100%",
                                  background: "var(--accent)", transition: "width 0.3s" }} />
                </div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>{sourceScanMsg} — {sourceScanPct}%</div>
              </div>
            )}

            {sourceScanError && (
              <div style={{ background: "var(--bg-3)", borderLeft: "3px solid var(--danger)",
                              padding: 10, borderRadius: 4 }}>
                <strong>Feil:</strong> {sourceScanError}
              </div>
            )}

            {cameras.length > 0 && (
              <div style={{ background: "var(--bg-3)", padding: 14, borderRadius: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
                  Fant {cameras.length} kamera{cameras.length > 1 ? "er" : ""}. Tilordne vinkel:
                </div>
                {cameras.map((cam) => (
                  <div key={cam.id} style={{ display: "flex", alignItems: "center", gap: 10,
                                                padding: 8, background: "rgba(0,0,0,0.2)",
                                                borderRadius: 6, marginBottom: 6 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>
                        {cam.model || cam.make || "Ukjent kamera"}
                      </div>
                      <div style={{ fontSize: 11, opacity: 0.7 }}>
                        {cam.clipCount} klipp · {(cam.totalDuration / 60).toFixed(1)} min ·{" "}
                        {(cam.totalSizeBytes / 1e9).toFixed(1)} GB
                        {cam.codec && ` · ${cam.codec}`}
                        {cam.resolution && ` · ${cam.resolution}`}
                      </div>
                    </div>
                    <select value={angleAssignment[cam.id] || cam.suggestedAngle}
                            onChange={(e) => setAngleAssignment((p) => ({ ...p, [cam.id]: parseInt(e.target.value) }))}
                            style={{ fontSize: 12, padding: "4px 8px", minWidth: 90 }}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>Vinkel {n}</option>
                      ))}
                    </select>
                    <input type="text" placeholder="Beskrivelse"
                            value={angleLabels[cam.id] || ""}
                            onChange={(e) => setAngleLabels((p) => ({ ...p, [cam.id]: e.target.value }))}
                            style={{ fontSize: 11, width: 130 }} />
                  </div>
                ))}
                {audioFilesDetected.length > 0 && (
                  <div style={{ fontSize: 11, opacity: 0.7, marginTop: 10 }}>
                    + {audioFilesDetected.length} lyd-fil{audioFilesDetected.length > 1 ? "er" : ""} funnet
                  </div>
                )}
              </div>
            )}

            {cameras.length > 0 && (
              <div style={{ background: "var(--bg-3)", padding: 12, borderRadius: 8 }}>
                <div className="field" style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 12 }}>Prosjekt-navn (for mappestruktur)</label>
                  <input type="text" value={projectName}
                          onChange={(e) => setProjectName(e.target.value)}
                          placeholder="F.eks. Hamis_Rukhma" />
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input type="checkbox" checked={wantBackup}
                          onChange={(e) => setWantBackup(e.target.checked)} />
                  <span>
                    <strong>Backup til SSD før jobben</strong>
                    <div style={{ fontSize: 11, opacity: 0.7, fontWeight: 400 }}>
                      Anbefales for SD-kort. Lager DIT-struktur med kamera-mapper per vinkel + lager Resolve-bins automatisk.
                    </div>
                  </span>
                </label>
                {wantBackup && (
                  <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
                    <input readOnly value={backupTarget || "Ingen SSD valgt"} style={{ flex: 1 }} />
                    <button onClick={async () => {
                      const sel = await openDialog({ multiple: false, directory: true,
                        title: "Pek på SSD/backup-mappe" });
                      if (typeof sel === "string") setBackupTarget(sel);
                    }} style={{ fontSize: 11 }}>Velg…</button>
                    {backupTarget && (
                      <button disabled={benchmarkBusy} style={{ fontSize: 11 }}
                              onClick={async () => {
                        setBenchmarkBusy(true);
                        try {
                          const sum = await executeScript("benchmark_drive", {
                            path: backupTarget, testSizeBytes: 200_000_000,
                          }, false);
                          const r = sum.events.find((e) => e.type === "result");
                          const val = r?.value as typeof benchmarkResult;
                          if (val) setBenchmarkResult(val);
                        } catch { /* noop */ }
                        setBenchmarkBusy(false);
                      }}>
                        {benchmarkBusy ? <HourglassEmptyIcon sx={{ fontSize: 14 }} /> : "Test hastighet"}
                      </button>
                    )}
                  </div>
                )}
                {benchmarkResult && (
                  <div style={{ fontSize: 11, marginTop: 8, padding: 8,
                                  background: "rgba(0,0,0,0.2)", borderRadius: 4 }}>
                    <strong>Hastighet:</strong> Skriv {benchmarkResult.writeMBs.toFixed(0)} MB/s ·
                    Les {benchmarkResult.readMBs.toFixed(0)} MB/s ·{" "}
                    <span style={{ color: benchmarkResult.verdict === "ok" ? "#4ad48a"
                                          : benchmarkResult.verdict === "marginal" ? "#f0a500" : "#ef4f6f" }}>
                      {benchmarkResult.verdict}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div style={{ fontSize: 11, opacity: 0.6, fontStyle: "italic",
                            background: "var(--bg-3)", padding: 10, borderRadius: 6,
                            display: "flex", alignItems: "flex-start", gap: 6 }}>
              <LightbulbIcon sx={{ fontSize: 14, flexShrink: 0, marginTop: "1px" }} />
              <span>Vinkel-tilordningen brukes til å lage Resolve-bins automatisk.
              Si fra hvis jeg gjettet feil — jeg lærer.</span>
            </div>

            {backupBusy && (
              <div style={{ background: "var(--bg-3)", padding: 12, borderRadius: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6,
                                display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <Inventory2Icon sx={{ fontSize: 14 }} /> Backup pågår…
                </div>
                <div style={{ height: 6, background: "var(--bg-4)", borderRadius: 3,
                                overflow: "hidden", marginBottom: 6 }}>
                  <div style={{ width: `${backupPct}%`, height: "100%",
                                  background: "var(--accent)", transition: "width 0.3s" }} />
                </div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>{backupMsg} — {backupPct}%</div>
              </div>
            )}

            {backupResult && (
              <div style={{ background: "rgba(74, 212, 138, 0.10)",
                              border: "1px solid #4ad48a", padding: 12, borderRadius: 8,
                              fontSize: 12 }}>
                <CheckIcon sx={{ fontSize: 14, verticalAlign: "middle" }} /> Backup ferdig: <strong>{backupResult.filesCount} filer</strong> kopiert til
                <br />
                <code style={{ fontSize: 11, opacity: 0.8 }}>{backupResult.projectRoot}</code>
              </div>
            )}

            {backupError && (
              <div style={{ background: "var(--bg-3)", borderLeft: "3px solid var(--danger)",
                              padding: 10, borderRadius: 4 }}>
                <strong>Backup-feil:</strong> {backupError}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
              <button onClick={onClose} disabled={backupBusy}>Avbryt</button>
              <button className="primary" disabled={cameras.length === 0 || sourceScanBusy || backupBusy}
                      onClick={async () => {
                recordLearning(`Steg 1: ${cameras.length} kameraer, ${sources.length} kilder, backup=${wantBackup}`);

                // Hvis backup ønsket og ikke ferdig: kjør det først
                if (wantBackup && backupTarget && !backupResult) {
                  setBackupBusy(true);
                  setBackupError(null);
                  setBackupPct(0);
                  const unsub = onScriptEvent((ev: ScriptEvent) => {
                    if (ev.type === "progress") {
                      const pct = ev.total ? Math.round(((ev.current ?? 0) / ev.total) * 100) : 0;
                      setBackupPct(pct); setBackupMsg(ev.message || "");
                    }
                  });
                  try {
                    const audioFolders = audioFilesDetected.length > 0
                      ? Array.from(new Set(audioFilesDetected.map((a) => a.path.split("/").slice(0, -1).join("/"))))
                      : [];
                    const sum = await executeScript("backup_multi_source_with_angles", {
                      sources: sources.map((s) => {
                        // Find first camera matching this source (best effort)
                        const cam = cameras.find((c) => c.clips.some((cl) => cl.path.startsWith(s.path)));
                        return {
                          path: s.path, role: s.role,
                          cameraId: cam?.id || null,
                          cameraModel: cam?.model || cam?.make || "Camera",
                          angleNumber: cam ? (angleAssignment[cam.id] || cam.suggestedAngle) : 0,
                          angleLabel: cam ? (angleLabels[cam.id] || "") : "",
                        };
                      }),
                      ssdPath: backupTarget,
                      projectName: projectName || "Untitled",
                      audioFolders,
                    }, false);
                    const r = sum.events.find((e) => e.type === "result");
                    const val = r?.value as { projectRoot: string; manifestPath: string; filesCount: number } | undefined;
                    if (val) {
                      setBackupResult(val);
                      recordLearning(`Backup: ${val.filesCount} filer → ${val.projectRoot}`);
                      logActivity(sources[0]?.path || null, {
                        kind: "backup",
                        label: `Backup til SSD (${val.filesCount} filer)`,
                        summary: val.projectRoot,
                      });
                    }
                  } catch (err) {
                    setBackupError(String(err));
                    unsub.then((u) => u());
                    setBackupBusy(false);
                    return; // Ikke gå videre hvis backup feilet
                  }
                  unsub.then((u) => u());
                  setBackupBusy(false);
                }

                if (cameras.length > 0 && sources[0]) setFolder(sources[0].path);
                setStep("material");
              }}>
                {wantBackup && backupTarget && !backupResult
                  ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <Inventory2Icon sx={{ fontSize: 14 }} /> Backup + Neste →
                    </span>
                  : "Neste: Multicam-scan →"}
              </button>
            </div>
          </div>
        )}

        {/* ────── Step 2: Multicam-scan (var Step 1: Materialet) ────── */}
        {step === "material" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="field">
              <label>Mappe med bryllups-materialet</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input readOnly value={folder || "Ingen valgt"} style={{ flex: 1 }} />
                <button onClick={pickFolder} disabled={scanning}>Pek på mappe…</button>
              </div>
              <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>
                Jeg skanner alle .mp4/.mov/.mkv-filer (også undermapper). For
                multicam-deteksjon bruker jeg tids-metadata + audio-correlation.
              </div>
            </div>

            {!scanResult && !scanning && folder && (
              <button className="primary" onClick={startScan}
                      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <SearchIcon sx={{ fontSize: 14 }} /> Skanne mappa
              </button>
            )}

            {scanning && (
              <div>
                <div style={{ height: 6, background: "var(--bg-3)", borderRadius: 3,
                               overflow: "hidden", marginBottom: 6 }}>
                  <div style={{ width: `${scanPct}%`, height: "100%",
                                 background: "var(--accent)", transition: "width 0.3s" }} />
                </div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>{scanMsg} — {scanPct}%</div>
              </div>
            )}

            {scanError && (
              <div style={{ background: "var(--bg-3)", borderLeft: "3px solid var(--danger)",
                             padding: 10, borderRadius: 4 }}>
                <strong>Feil:</strong> {scanError}
              </div>
            )}

            {scanResult && (
              <>
                <div style={{ background: "var(--bg-3)", padding: 14, borderRadius: 8 }}>
                  <strong>Skanning ferdig:</strong>
                  <ul style={{ margin: "8px 0 0 18px", padding: 0, fontSize: 13,
                                lineHeight: 1.7 }}>
                    <li>{scanResult.clipCount} videoklipp funnet</li>
                    <li>
                      {scanResult.multicamGroupCount > 0
                        ? `${scanResult.multicamGroupCount} multicam-grupper (${scanResult.multicamGroups.reduce((a, g) => a + g.angles.length, 0)} totale vinkler)`
                        : "Ingen multicam-grupper oppdaget"}
                    </li>
                  </ul>
                </div>

                {scanResult.multicamGroupCount > 0 && (
                  <div style={{ background: "var(--bg-3)", padding: 14, borderRadius: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                      Multicam-grupper:
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6,
                                   maxHeight: 180, overflowY: "auto" }}>
                      {scanResult.multicamGroups.slice(0, 10).map((g, i) => (
                        <div key={i} style={{ fontSize: 11, opacity: 0.85,
                                                fontFamily: "ui-monospace, monospace" }}>
                          <span style={{ color: g.confidence > 0.8 ? "#4ad48a"
                                                    : g.confidence > 0.6 ? "#f0a500"
                                                    : "#ef4f6f" }}>
                            ● {(g.confidence * 100).toFixed(0)}%
                          </span>{" "}
                          {g.angles.length} vinkler · {g.durationSec.toFixed(0)}s ·{" "}
                          {g.angles.map((p) => p.split("/").pop()).join(", ")}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ background: "var(--bg-3)", padding: 14, borderRadius: 8,
                               display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Hva skal lages?</div>

                  {scanResult.multicamGroupCount > 0 && (
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                      <input type="checkbox" checked={enableMulticam}
                             onChange={(e) => setEnableMulticam(e.target.checked)} />
                      <span>
                        <strong>Multicam-redigering</strong> — sync vinkler + auto-cut basert på audio + face-focus
                      </span>
                    </label>
                  )}

                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                    <input type="checkbox" checked={makeLongFilm}
                           onChange={(e) => setMakeLongFilm(e.target.checked)} />
                    <span>
                      <strong>Lang film (~60 min)</strong> — alt material syncet, sendt til Resolve
                    </span>
                  </label>

                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                    <input type="checkbox" checked={makeHighlight}
                           onChange={(e) => setMakeHighlight(e.target.checked)} />
                    <span>
                      <strong>Highlight (~15 min)</strong> — AI plukker beste øyeblikk
                    </span>
                  </label>

                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                    <input type="checkbox" checked={makeTeaser}
                           onChange={(e) => setMakeTeaser(e.target.checked)} />
                    <span>
                      <strong>Teaser social (~30s, 9:16)</strong> — for Reels/TikTok
                    </span>
                  </label>
                </div>

                <div style={{ fontSize: 11, opacity: 0.6, fontStyle: "italic",
                               background: "var(--bg-3)", padding: 10, borderRadius: 6,
                               display: "flex", alignItems: "flex-start", gap: 6 }}>
                  <LightbulbIcon sx={{ fontSize: 14, flexShrink: 0, marginTop: "1px" }} />
                  <span>Hvis jeg gjør feil — korriger det. Jeg lærer av valgene dine.</span>
                </div>
              </>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
              <button onClick={onClose} disabled={scanning}>Avbryt</button>
              <button className="primary" onClick={goNext}
                      disabled={scanning || !scanResult}>
                Neste: Ekstern lyd →
              </button>
            </div>
          </div>
        )}

        {/* ────── Step 2: Ekstern lyd ────── */}
        {step === "audio" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 14, lineHeight: 1.5 }}>
              Har du tatt opp lyd fra en ekstern opptaker (lavalier, zoom-recorder) for taler?
              Hvis ja, finner jeg klippene og syncer lyden mot kamera-audio.
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => setHasExternal(false)}
                className={hasExternal === false ? "primary" : ""}
                style={{ flex: 1, padding: "12px 18px" }}
              >
                Nei, bare kamera-audio
              </button>
              <button
                onClick={() => setHasExternal(true)}
                className={hasExternal === true ? "primary" : ""}
                style={{ flex: 1, padding: "12px 18px" }}
              >
                Ja, jeg har eksterne opptak
              </button>
            </div>

            {hasExternal === true && (
              <>
                <div className="field">
                  <label>Mappe med ekstern lyd (.wav, .mp3, .m4a, etc.)</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input readOnly value={externalFolder || "Ingen valgt"} style={{ flex: 1 }} />
                    <button onClick={async () => {
                      const sel = await openDialog({
                        multiple: false, directory: true,
                        title: "Pek mappa med eksterne lyd-opptak",
                      });
                      if (typeof sel === "string") setExternalFolder(sel);
                    }} disabled={matching}>Pek på mappe…</button>
                  </div>
                </div>

                {externalFolder && !matchResult && !matching && (
                  <button className="primary" onClick={async () => {
                    if (!scanResult) return;
                    setMatching(true);
                    setMatchError(null);
                    setMatchPct(0);
                    const unsubProm = onScriptEvent((ev: ScriptEvent) => {
                      if (ev.type === "progress") {
                        const pct = ev.total ? Math.round(((ev.current ?? 0) / ev.total) * 100) : 0;
                        setMatchPct(pct); setMatchMsg(ev.message || "");
                      }
                    });
                    try {
                      const sum = await executeScript("match_external_audio_to_clips", {
                        externalAudioFolder: externalFolder,
                        clips: scanResult ? (scanResult as unknown as { clips?: Array<{ path: string }> }).clips || [] : [],
                      }, false);
                      const r = sum.events.find((e) => e.type === "result");
                      const val = r?.value as { matches: Array<{ externalAudio: string; clipPath: string; offsetSec: number; confidence: number }>; matchCount: number } | undefined;
                      if (val) {
                        setMatchResult(val);
                        logActivity(sources[0]?.path || null, {
                          kind: "audio_match",
                          label: `Audio-sync: ${val.matchCount} matches`,
                          summary: val.matches.length > 0 ? `Topp conf: ${(val.matches[0].confidence * 100).toFixed(0)}%` : "Ingen matches",
                        });
                      }
                    } catch (err) {
                      setMatchError(String(err));
                    } finally {
                      unsubProm.then((u) => u());
                      setMatching(false);
                    }
                  }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <VolumeUpIcon sx={{ fontSize: 14 }} /> Match audio mot klipp
                    </span>
                  </button>
                )}

                {matching && (
                  <div>
                    <div style={{ height: 6, background: "var(--bg-3)", borderRadius: 3,
                                   overflow: "hidden", marginBottom: 6 }}>
                      <div style={{ width: `${matchPct}%`, height: "100%",
                                     background: "var(--accent)", transition: "width 0.3s" }} />
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.7 }}>{matchMsg} — {matchPct}%</div>
                  </div>
                )}

                {matchError && (
                  <div style={{ background: "var(--bg-3)", borderLeft: "3px solid var(--danger)",
                                 padding: 10, borderRadius: 4 }}>
                    <strong>Feil:</strong> {matchError}
                  </div>
                )}

                {matchResult && matchResult.matches.length > 0 && (
                  <div style={{ background: "var(--bg-3)", padding: 14, borderRadius: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
                      Fant {matchResult.matchCount} sync-kandidater — kryss av om noe er feil:
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6,
                                   maxHeight: 280, overflowY: "auto" }}>
                      {matchResult.matches.slice(0, 30).map((m, i) => {
                        const ext = m.externalAudio.split("/").pop() || "";
                        const clip = m.clipPath.split("/").pop() || "";
                        const override = matchOverrides[i];
                        return (
                          <div key={i} style={{ display: "flex", alignItems: "center",
                                                  gap: 10, padding: "6px 8px", borderRadius: 4,
                                                  background: override === "wrong" ? "rgba(239, 79, 111, 0.10)" : "transparent",
                                                  opacity: override === "wrong" ? 0.6 : 1 }}>
                            <span style={{ color: m.confidence > 0.7 ? "#4ad48a"
                                                     : m.confidence > 0.5 ? "#f0a500"
                                                     : "#ef4f6f", fontSize: 12, minWidth: 44 }}>
                              {(m.confidence * 100).toFixed(0)}%
                            </span>
                            <span style={{ fontSize: 12, fontFamily: "ui-monospace, monospace",
                                            flex: 1, overflow: "hidden", textOverflow: "ellipsis",
                                            whiteSpace: "nowrap" }}>
                              {ext} → {clip} <span style={{ opacity: 0.5 }}>(offset {m.offsetSec.toFixed(2)}s)</span>
                            </span>
                            <button onClick={() => {
                              setMatchOverrides(prev => ({ ...prev, [i]: "wrong" }));
                              recordLearning(`Steg 2: Avvist match (conf ${(m.confidence * 100).toFixed(0)}%): ${ext} ↔ ${clip}`);
                            }} title="Feil match — Claude lærer"
                                     style={{ padding: "2px 8px", fontSize: 11, display: "inline-flex", alignItems: "center" }}>
                              <CloseIcon sx={{ fontSize: 12 }} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {matchResult && matchResult.matches.length === 0 && (
                  <div style={{ background: "var(--bg-3)", padding: 14, borderRadius: 8,
                                 fontSize: 12, opacity: 0.8 }}>
                    Fant ingen klare matches. Sjekk at lyd-filene er fra samme tidsperiode
                    som videoene, og at lyden er hørbar (ikke bare bakgrunnsstøy).
                  </div>
                )}

                <div style={{ fontSize: 11, opacity: 0.6, fontStyle: "italic",
                               background: "var(--bg-3)", padding: 10, borderRadius: 6,
                               display: "flex", alignItems: "flex-start", gap: 6 }}>
                  <LightbulbIcon sx={{ fontSize: 14, flexShrink: 0, marginTop: "1px" }} />
                  <span>Hvis jeg matcher feil — klikk lukk-knappen. Jeg lærer å unngå lignende feil neste gang.</span>
                </div>
              </>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
              <button onClick={() => setStep("material")} disabled={matching}>← Tilbake</button>
              <button className="primary" onClick={() => {
                recordLearning(`Steg 2: hasExternal=${hasExternal} matches=${matchResult?.matchCount || 0} wrong=${Object.values(matchOverrides).filter(v => v === "wrong").length}`);
                setStep("music");
              }} disabled={hasExternal === null || matching}>
                Neste: Sanger →
              </button>
            </div>
          </div>
        )}

        {/* ────── Step 3: Sanger + kultur ────── */}
        {step === "music" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 14, lineHeight: 1.5 }}>
              Hvilken kultur er bryllupet? Jeg foreslår sanger basert på det.
            </div>

            <div className="field">
              <label>Kultur</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                {["Pakistansk", "Indisk", "Norsk", "Tyrkisk", "Arabisk", "Afghansk"].map((c) => (
                  <button key={c}
                          className={culture === c ? "primary" : ""}
                          onClick={() => setCulture(c)}
                          style={{ padding: "8px 10px", fontSize: 12 }}>
                    {c}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "center" }}>
                <button onClick={() => setCulture("annet")}
                        className={culture === "annet" ? "primary" : ""}
                        style={{ padding: "8px 10px", fontSize: 12 }}>
                  Annet
                </button>
                {culture === "annet" && (
                  <input type="text" placeholder="F.eks. afghansk, somalisk, etc."
                         value={cultureOther}
                         onChange={(e) => setCultureOther(e.target.value)}
                         style={{ flex: 1 }} />
                )}
              </div>
            </div>

            <div style={{ background: "var(--bg-3)", padding: 14, borderRadius: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                Brudeparets ønsker (specifikke sanger)
              </div>
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                <input type="text" placeholder="Sang-tittel"
                       value={newSongTitle}
                       onChange={(e) => setNewSongTitle(e.target.value)}
                       style={{ flex: 2 }} />
                <input type="text" placeholder="Artist"
                       value={newSongArtist}
                       onChange={(e) => setNewSongArtist(e.target.value)}
                       style={{ flex: 2 }} />
                <button onClick={() => {
                  if (!newSongTitle.trim()) return;
                  setWishedSongs((prev) => [...prev, {
                    id: `s-${Date.now()}`,
                    title: newSongTitle.trim(),
                    artist: newSongArtist.trim(),
                    role: "main",
                  }]);
                  setNewSongTitle(""); setNewSongArtist("");
                }}>+ Legg til</button>
              </div>

              {wishedSongs.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                  {wishedSongs.map((s) => (
                    <div key={s.id} style={{ display: "flex", alignItems: "center",
                                              gap: 8, padding: 8, borderRadius: 4,
                                              background: "rgba(160, 48, 192, 0.08)" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden",
                                       textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {s.title}
                        </div>
                        {s.artist && (
                          <div style={{ fontSize: 11, opacity: 0.7 }}>{s.artist}</div>
                        )}
                      </div>
                      <select value={s.role}
                              onChange={(e) => setWishedSongs((prev) => prev.map(x =>
                                x.id === s.id ? { ...x, role: e.target.value as SongRole } : x))}
                              style={{ fontSize: 11, padding: "4px 6px" }}>
                        <option value="main">Hoved-musikk</option>
                        <option value="entry">Inntog</option>
                        <option value="first_dance">Første dans</option>
                        <option value="dance">Dans-sekvens</option>
                        <option value="exit">Avslutning</option>
                      </select>
                      <button onClick={() => setWishedSongs((prev) => prev.filter(x => x.id !== s.id))}
                              title="Fjern" style={{ padding: "4px 8px", fontSize: 12,
                                                      display: "inline-flex", alignItems: "center" }}>
                        <CloseIcon sx={{ fontSize: 12 }} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              disabled={musicSuggestBusy || !culture}
              onClick={async () => {
                if (!culture) return;
                setMusicSuggestBusy(true);
                setMusicSuggestError(null);
                try {
                  const cultureLabel = culture === "annet" ? cultureOther.trim() : culture;
                  const resp = await invoke<{
                    content?: Array<{ type: string; input?: { suggestions?: Array<{ title: string; artist: string; role: SongRole; reason?: string }> } }>;
                  }>("claude_chat", {
                    messages: [{ role: "user", content: `Foreslå 5 sanger til en ${cultureLabel} bryllups-highlight. Variér roller.` }],
                    system: `Du er en musikk-kurator for bryllupsvideo. Du kjenner kulturelle sanger som er ikoniske og hyppig brukt i ${cultureLabel} bryllup. Foreslå 5 sanger med:
- title (originaltittel)
- artist
- role (main / entry / first_dance / dance / exit)
- reason (1 setning på norsk hvorfor)

KUN reelle, kjente sanger. Du MÅ kalle suggest_songs-tool.`,
                    model: "claude-opus-4-7",
                    maxTokens: 800,
                    tools: [{
                      name: "suggest_songs",
                      description: "Return 5 song suggestions",
                      input_schema: {
                        type: "object",
                        properties: {
                          suggestions: {
                            type: "array", minItems: 5, maxItems: 5,
                            items: {
                              type: "object",
                              properties: {
                                title: { type: "string" },
                                artist: { type: "string" },
                                role: { type: "string", enum: ["main", "entry", "first_dance", "dance", "exit"] },
                                reason: { type: "string" },
                              },
                              required: ["title", "artist", "role"],
                            },
                          },
                        },
                        required: ["suggestions"],
                      },
                    }],
                  });
                  const toolUse = resp?.content?.find((c) => c.type === "tool_use");
                  const sugg = toolUse?.input?.suggestions;
                  if (Array.isArray(sugg)) {
                    setWishedSongs((prev) => [
                      ...prev,
                      ...sugg.map((s, i) => ({
                        id: `ai-${Date.now()}-${i}`,
                        title: s.title, artist: s.artist, role: s.role || "main",
                      })),
                    ]);
                    recordLearning(`Steg 3: AI foreslo ${sugg.length} ${cultureLabel}-sanger`);
                  }
                } catch (err) {
                  setMusicSuggestError(String(err));
                } finally {
                  setMusicSuggestBusy(false);
                }
              }}
              style={{ padding: "10px 14px" }}
            >
              {musicSuggestBusy ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <AutoAwesomeIcon sx={{ fontSize: 14 }} /> Henter forslag…
                </span>
              ) : !culture ? "Velg kultur først" : (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <AutoAwesomeIcon sx={{ fontSize: 14 }} /> Få anbefalinger for {culture === "annet" ? cultureOther || "kultur" : culture}
                </span>
              )}
            </button>

            {musicSuggestError && (
              <div style={{ background: "var(--bg-3)", borderLeft: "3px solid var(--danger)",
                             padding: 10, borderRadius: 4 }}>
                <strong>Feil:</strong> {musicSuggestError}
              </div>
            )}

            <div style={{ fontSize: 11, opacity: 0.6, fontStyle: "italic",
                           background: "var(--bg-3)", padding: 10, borderRadius: 6,
                           display: "flex", alignItems: "flex-start", gap: 6 }}>
              <LightbulbIcon sx={{ fontSize: 14, flexShrink: 0, marginTop: "1px" }} />
              <span>AI-forslag kan være feil. Fjern de som ikke passer — jeg lærer hva du foretrekker.</span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
              <button onClick={() => setStep("audio")}>← Tilbake</button>
              <button className="primary" onClick={() => {
                recordLearning(`Steg 3: culture=${culture === "annet" ? cultureOther : culture} songs=${wishedSongs.length}`);
                setStep("persons");
              }}>
                Neste: Personer →
              </button>
            </div>
          </div>
        )}

        {/* ────── Step 4: Personer ────── */}
        {step === "persons" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 14, lineHeight: 1.5 }}>
              Hvilke personer er viktige å ha fokus på? Jeg skanner gjennom klippene
              og finner unike ansikter — du labeler hvem som er hvem.
            </div>

            {faceClusters.length === 0 && !facesScanning && (
              <button
                className="primary"
                disabled={!scanResult}
                onClick={async () => {
                  if (!scanResult) return;
                  setFacesScanning(true);
                  setFacesError(null);
                  setFacesPct(0);
                  const unsubProm = onScriptEvent((ev: ScriptEvent) => {
                    if (ev.type === "progress") {
                      const pct = ev.total ? Math.round(((ev.current ?? 0) / ev.total) * 100) : 0;
                      setFacesPct(pct); setFacesMsg(ev.message || "");
                    }
                  });
                  try {
                    const sum = await executeScript("cluster_faces_from_clips", {
                      clips: scanResult ? (scanResult as unknown as { clips?: Array<{ path: string }> }).clips || [] : [],
                      sampleIntervalSec: 10,
                      maxFramesPerClip: 8,
                    }, false);
                    const r = sum.events.find((e) => e.type === "result");
                    const val = r?.value as { clusters?: FaceCluster[] } | undefined;
                    if (val?.clusters) {
                      setFaceClusters(val.clusters);
                      logActivity(sources[0]?.path || null, {
                        kind: "face_cluster",
                        label: `${val.clusters.length} unike personer funnet`,
                      });
                    }
                  } catch (err) {
                    setFacesError(String(err));
                  } finally {
                    unsubProm.then((u) => u());
                    setFacesScanning(false);
                  }
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <GroupIcon sx={{ fontSize: 14 }} /> Skanne ansikter
                </span>
              </button>
            )}

            {facesScanning && (
              <div>
                <div style={{ height: 6, background: "var(--bg-3)", borderRadius: 3,
                               overflow: "hidden", marginBottom: 6 }}>
                  <div style={{ width: `${facesPct}%`, height: "100%",
                                 background: "var(--accent)", transition: "width 0.3s" }} />
                </div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>{facesMsg} — {facesPct}%</div>
              </div>
            )}

            {facesError && (
              <div style={{ background: "var(--bg-3)", borderLeft: "3px solid var(--danger)",
                             padding: 10, borderRadius: 4 }}>
                <strong>Feil:</strong> {facesError}
              </div>
            )}

            {faceClusters.length > 0 && (
              <div style={{ background: "var(--bg-3)", padding: 14, borderRadius: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
                  Fant {faceClusters.length} unike personer. Hvem er hvem?
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                                gap: 12 }}>
                  {faceClusters.slice(0, 18).map((c) => {
                    const thumbUrl = c.thumbnail.startsWith("/")
                      ? `http://asset.localhost${c.thumbnail}` : c.thumbnail;
                    return (
                      <div key={c.id} style={{ background: "rgba(0,0,0,0.3)",
                                                 padding: 8, borderRadius: 6 }}>
                        <div style={{ width: "100%", aspectRatio: "1 / 1",
                                       borderRadius: 4, overflow: "hidden",
                                       background: "rgba(26, 13, 69, 0.4)",
                                       display: "flex", alignItems: "center",
                                       justifyContent: "center", marginBottom: 6 }}>
                          <img src={thumbUrl} alt={c.id}
                               style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        </div>
                        <div style={{ fontSize: 10, opacity: 0.6, marginBottom: 4 }}>
                          {c.occurrences} obs
                        </div>
                        <input
                          type="text"
                          list={`person-suggestions-${c.id}`}
                          placeholder="Hvem er dette?"
                          value={faceLabels[c.id] || ""}
                          onChange={(e) => setFaceLabels(prev => ({ ...prev, [c.id]: e.target.value }))}
                          style={{ width: "100%", fontSize: 11, padding: "4px 6px" }}
                        />
                        <datalist id={`person-suggestions-${c.id}`}>
                          {PERSON_SUGGESTIONS.map((s) => <option key={s} value={s} />)}
                        </datalist>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ fontSize: 11, opacity: 0.6, fontStyle: "italic",
                           background: "var(--bg-3)", padding: 10, borderRadius: 6,
                           display: "flex", alignItems: "flex-start", gap: 6 }}>
              <LightbulbIcon sx={{ fontSize: 14, flexShrink: 0, marginTop: "1px" }} />
              <span>Du kan hoppe over personer du ikke kjenner. Claude bruker label-ene
              til å prioritere klipp i highlight (f.eks. flere shot av brudens mor).</span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
              <button onClick={() => setStep("music")} disabled={facesScanning}>← Tilbake</button>
              <button className="primary" onClick={() => {
                const labeledCount = Object.values(faceLabels).filter(v => v.trim()).length;
                recordLearning(`Steg 4: labeled ${labeledCount}/${faceClusters.length} personer`);
                setStep("style");
              }} disabled={facesScanning}>
                Neste: Stil →
              </button>
            </div>
          </div>
        )}

        {/* ────── Step 5: Stil ────── */}
        {step === "style" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 14, lineHeight: 1.5 }}>
              Hvilken fremtoning ønsker du i highlighten? Stil-valget styrer hvordan
              Claude prioriterer klipp + rytme i flowmap.
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
              {([
                { id: "storytelling", Icon: MenuBookIcon, name: "Storytelling",
                  desc: "Rolig tempo, mer dialog/tale, kronologisk. Familie-vekt." },
                { id: "cinematic", Icon: MovieIcon, name: "Cinematic",
                  desc: "Slow-mo, bokeh, color-grade. Visuell vekt over hastighet." },
                { id: "energetic", Icon: BoltIcon, name: "Energisk",
                  desc: "Kort cuts, beat-sync, dans-fokus. Høyere BPM, mer action." },
                { id: "balanced", Icon: BalanceIcon, name: "Balansert",
                  desc: "Storytelling + energi mix. Default for de fleste bryllup." },
              ] as Array<{ id: Style; Icon: typeof MenuBookIcon; name: string; desc: string }>).map((opt) => (
                <button key={opt.id}
                        onClick={() => setChosenStyle(opt.id)}
                        className={chosenStyle === opt.id ? "primary" : ""}
                        style={{ display: "flex", flexDirection: "column",
                                  alignItems: "flex-start", gap: 4, padding: 14,
                                  textAlign: "left" }}>
                  <div><opt.Icon sx={{ fontSize: 20 }} /></div>
                  <div style={{ fontWeight: 600 }}>{opt.name}</div>
                  <div style={{ fontSize: 11, opacity: 0.8, lineHeight: 1.4 }}>{opt.desc}</div>
                </button>
              ))}
            </div>

            <div style={{ background: "var(--bg-3)", padding: 14, borderRadius: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                Forhåndsvisning av rytme (FlowMap)
              </div>
              {/* Mini FlowMap preview — visualiserer fremtidig rytme basert på stil */}
              <div style={{ display: "flex", height: 60, alignItems: "flex-end",
                              gap: 2, marginBottom: 8 }}>
                {Array.from({ length: 40 }).map((_, i) => {
                  // Generate styling-aware preview heights
                  let h = 0.5;
                  if (chosenStyle === "energetic") h = 0.3 + Math.abs(Math.sin(i * 0.6)) * 0.7;
                  else if (chosenStyle === "cinematic") h = 0.4 + Math.sin(i * 0.2 + 1) * 0.3 + 0.1;
                  else if (chosenStyle === "storytelling") h = 0.4 + Math.sin(i * 0.15) * 0.25;
                  else h = 0.3 + Math.abs(Math.sin(i * 0.35)) * 0.5;
                  return (
                    <div key={i}
                          style={{ flex: 1, background: "var(--accent)",
                                    height: `${h * 100}%`, borderRadius: 1,
                                    opacity: 0.7 + h * 0.3 }} />
                  );
                })}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between",
                              fontSize: 10, opacity: 0.6 }}>
                <span>Intro</span><span>Build</span><span>Peak</span><span>Outro</span>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
              <button onClick={() => setStep("persons")}>← Tilbake</button>
              <button className="primary" onClick={() => {
                recordLearning(`Steg 5: chose style=${chosenStyle}`);
                setStep("live");
              }}>
                Neste: Live-arbeid →
              </button>
            </div>
          </div>
        )}

        {/* ────── Step 6: Live-arbeid (Harry Potter mode) ────── */}
        {step === "live" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 14, lineHeight: 1.5 }}>
              Nå starter jeg å arbeide. Du kan se hvert klipp som blir valgt i sanntid —
              som om jeg redigerer foran øynene dine.
            </div>

            {!livePicksPath && !liveRunning && (
              <button className="primary"
                      disabled={!scanResult}
                      onClick={async () => {
                if (!scanResult) return;
                const firstClip = (scanResult as unknown as { clips?: Array<{ path: string }> }).clips?.[0]?.path;
                if (!firstClip) return;
                setLiveRunning(true);
                setLiveError(null);
                setLivePct(0);
                setLivePicks([]);
                setLiveShots([]);
                const unsubProm = onScriptEvent((ev: ScriptEvent) => {
                  if (ev.type === "progress") {
                    const pct = ev.total ? Math.round(((ev.current ?? 0) / ev.total) * 100) : 0;
                    setLivePct(pct); setLiveMsg(ev.message || "");
                  }
                  if (ev.type === "shot_scored" && typeof ev.index === "number") {
                    setLiveShots((prev) => [
                      ...prev,
                      {
                        index: ev.index!,
                        startSec: ev.startSec ?? 0,
                        endSec: ev.endSec ?? 0,
                        score: ev.score ?? 0,
                        thumbnailPath: ev.thumbnailPath ?? null,
                        accepted: null,
                      },
                    ]);
                  }
                  if (ev.type === "picks_finalized" && Array.isArray(ev.indices)) {
                    const acceptedSet = new Set(ev.indices);
                    setLiveShots((prev) => prev.map((s) => ({
                      ...s,
                      accepted: acceptedSet.has(s.index),
                    })));
                  }
                });
                try {
                  const sum = await executeScript("extract_highlight_from_film", {
                    videoPath: firstClip,
                    genre: "wedding",
                    interactiveReview: true,
                  }, false);
                  const r = sum.events.find((e) => e.type === "result");
                  const val = r?.value as { picksPath?: string; picks?: Array<{ index: number; chapter: string }> } | undefined;
                  if (val?.picksPath) {
                    setLivePicksPath(val.picksPath);
                    logActivity(firstClip, {
                      kind: "extract",
                      label: `Extract ferdig: ${val.picks?.length ?? 0} picks`,
                      summary: `Kjørt på ${firstClip.split("/").pop()}`,
                    });
                  }
                  if (val?.picks) setLivePicks(val.picks.map(p => ({ index: p.index, chapter: p.chapter })));
                } catch (err) {
                  setLiveError(String(err));
                } finally {
                  unsubProm.then((u) => u());
                  setLiveRunning(false);
                }
              }} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <MovieIcon sx={{ fontSize: 14 }} /> Start Claude
              </button>
            )}

            {(liveRunning || livePicksPath) && (
              <div style={{ background: "var(--bg-3)", padding: 14, borderRadius: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between",
                                fontSize: 12, marginBottom: 6 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {liveRunning
                      ? <WarningIcon sx={{ fontSize: 14, color: "#f0a500" }} />
                      : <CheckCircleIcon sx={{ fontSize: 14, color: "#4ad48a" }} />}
                    {liveRunning ? "Claude redigerer …" : "Ferdig"}
                  </span>
                  <span>{liveShots.length > 0 ? `${liveShots.length} skann` : `${livePct}%`}</span>
                </div>
                <div style={{ height: 6, background: "var(--bg-4)", borderRadius: 3,
                                overflow: "hidden", marginBottom: 8 }}>
                  <div style={{ width: `${livePct}%`, height: "100%",
                                  background: "var(--accent)", transition: "width 0.4s" }} />
                </div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>{liveMsg}</div>

                {/* Harry-Potter live shot-grid */}
                {liveShots.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ display: "grid",
                                    gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
                                    gap: 6, maxHeight: 260, overflowY: "auto",
                                    background: "rgba(0,0,0,0.25)", padding: 8, borderRadius: 6 }}>
                      {liveShots.slice(-80).map((s) => {
                        const url = s.thumbnailPath ? convertFileSrc(s.thumbnailPath) : null;
                        const fmt = (sec: number) => {
                          const m = Math.floor(sec / 60); const ss = Math.floor(sec % 60);
                          return `${m}:${String(ss).padStart(2, "0")}`;
                        };
                        const status: React.ReactNode = s.accepted === true
                          ? <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}><CheckIcon sx={{ fontSize: 10 }} /> valgt</span>
                          : s.accepted === false
                          ? <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}><CloseIcon sx={{ fontSize: 10 }} /> skip</span>
                          : "skann…";
                        const borderColor = s.accepted === true ? "#4ad48a"
                          : s.accepted === false ? "#3a2548"
                          : "#f0a500";
                        return (
                          <div key={s.index}
                                style={{ aspectRatio: "16 / 9", borderRadius: 4,
                                          overflow: "hidden", position: "relative",
                                          background: "#1a0d45",
                                          border: `2px solid ${borderColor}`,
                                          opacity: s.accepted === false ? 0.4 : 1,
                                          transition: "opacity 0.3s, border-color 0.3s",
                                          animation: s.accepted === null ? "ce-fade-in 0.4s" : undefined }}>
                            {url
                              ? <img src={url} alt=""
                                      style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              : <div style={{ width: "100%", height: "100%",
                                                display: "flex", alignItems: "center",
                                                justifyContent: "center" }}>
                                  <MovieIcon sx={{ fontSize: 20 }} />
                                </div>}
                            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0,
                                            background: "rgba(0,0,0,0.7)", padding: "2px 4px",
                                            fontSize: 9, fontFamily: "ui-monospace, monospace",
                                            display: "flex", justifyContent: "space-between" }}>
                              <span>{fmt(s.startSec)}</span>
                              <span style={{ color: s.score > 0.6 ? "#4ad48a" : s.score > 0.4 ? "#f0a500" : "#8674a8" }}>
                                {s.score.toFixed(2)}
                              </span>
                            </div>
                            <div style={{ position: "absolute", top: 2, right: 2,
                                            background: "rgba(0,0,0,0.7)",
                                            padding: "1px 5px", borderRadius: 3,
                                            fontSize: 8, fontWeight: 600,
                                            color: s.accepted === true ? "#4ad48a"
                                              : s.accepted === false ? "#8674a8"
                                              : "#f0a500" }}>
                              {status}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ fontSize: 10, opacity: 0.5, marginTop: 6 }}>
                      Viser siste 80 av {liveShots.length} skannede klipp. Grønn = valgt, grå = skip.
                    </div>
                  </div>
                )}
              </div>
            )}

            {liveError && (
              <div style={{ background: "var(--bg-3)", borderLeft: "3px solid var(--danger)",
                              padding: 10, borderRadius: 4 }}>
                <strong>Feil:</strong> {liveError}
              </div>
            )}

            <div style={{ fontSize: 11, opacity: 0.6, fontStyle: "italic",
                            background: "var(--bg-3)", padding: 10, borderRadius: 6,
                            display: "flex", alignItems: "flex-start", gap: 6 }}>
              <LightbulbIcon sx={{ fontSize: 14, flexShrink: 0, marginTop: "1px" }} />
              <span>Etter dette skannes filmen for log-gamma + LUT-anbefaling.</span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
              <button onClick={() => setStep("style")} disabled={liveRunning}>← Tilbake</button>
              <button className="primary" onClick={() => {
                recordLearning(`Steg 6: extracted ${livePicks.length} picks`);
                setStep("color");
              }} disabled={liveRunning || !livePicksPath}>
                Neste: Color / LUT →
              </button>
            </div>
          </div>
        )}

        {/* ────── Step 7: Color / LUT ────── */}
        {step === "color" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 14, lineHeight: 1.5 }}>
              Sjekker om filmen er tatt opp i log-gamma. Hvis ja, foreslår jeg en LUT
              som matcher kameraet ditt. Vi bruker din egen LUT-mappe i Resolve.
            </div>

            {!logGamma && !logCheckBusy && (
              <button className="primary"
                      disabled={!scanResult}
                      onClick={async () => {
                if (!scanResult) return;
                const firstClip = (scanResult as unknown as { clips?: Array<{ path: string }> }).clips?.[0]?.path;
                if (!firstClip) return;
                setLogCheckBusy(true);
                try {
                  const sum = await executeScript("detect_log_gamma", {
                    videoPath: firstClip,
                  }, false);
                  const r = sum.events.find((e) => e.type === "result");
                  const val = r?.value as { isLog: boolean; profile: string; suggestedLut?: string } | undefined;
                  if (val) setLogGamma(val);
                } catch { /* noop */ }
                setLogCheckBusy(false);
              }} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <PaletteIcon sx={{ fontSize: 14 }} /> Sjekk log-gamma
              </button>
            )}

            {logCheckBusy && (
              <div style={{ fontSize: 12, opacity: 0.7 }}>Sjekker log-profil …</div>
            )}

            {logGamma && (
              <div style={{ background: "var(--bg-3)", padding: 14, borderRadius: 8 }}>
                <div style={{ fontSize: 13, marginBottom: 8 }}>
                  <strong>Resultat:</strong> {logGamma.isLog
                    ? <span style={{ color: "#f0a500", display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <VideocamIcon sx={{ fontSize: 14 }} /> Log-gamma oppdaget
                      </span>
                    : <span style={{ color: "#4ad48a", display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <CheckIcon sx={{ fontSize: 14 }} /> Allerede gradet ({logGamma.profile})
                      </span>}
                </div>
                <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 8 }}>
                  Profil: {logGamma.profile}
                </div>
                {logGamma.isLog && logGamma.suggestedLut && (
                  <>
                    <div style={{ fontSize: 12, marginBottom: 8 }}>
                      Foreslått LUT: <code>{logGamma.suggestedLut}</code>
                    </div>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                      <input type="checkbox" checked={applyLut}
                              onChange={(e) => setApplyLut(e.target.checked)} />
                      <span>Apply LUT i Resolve-timeline</span>
                    </label>
                  </>
                )}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
              <button onClick={() => setStep("live")}>← Tilbake</button>
              <button className="primary" onClick={async () => {
                recordLearning(`Steg 7: isLog=${logGamma?.isLog} applyLut=${applyLut} timelines: long=${makeLongFilm} hl=${makeHighlight} teaser=${makeTeaser}`);

                // 1. Apply project settings (resolution + framerate + CST)
                //    basert på første kameras codec + log-gamma-deteksjon
                if (resolveHealth?.resolveRunning && resolveHealth?.projectOpen) {
                  try {
                    const firstCam = cameras[0];
                    const resolution = firstCam?.resolution?.replace("×", "x");
                    // Sjekk codec / fps fra første klipp (heuristikk)
                    const cstParams: Record<string, unknown> = {};
                    if (resolution) cstParams.resolution = resolution;
                    // FPS henter vi fra scan_folder_multicam dersom tilgjengelig
                    if (scanResult && scanResult.clips && scanResult.clips[0]?.fps) {
                      cstParams.frameRate = scanResult.clips[0].fps;
                    }
                    // CST log-gamma fra detect-resultatet
                    if (logGamma?.isLog && logGamma.profile) {
                      // Map profile-string til CST-input
                      const p = logGamma.profile.toLowerCase();
                      if (p.includes("c-log")) {
                        cstParams.cstInputGamma = "Canon C-Log 2";
                        cstParams.cstInputGamut = "Canon Cinema Gamut";
                      } else if (p.includes("s-log")) {
                        cstParams.cstInputGamma = "Sony S-Log 3";
                        cstParams.cstInputGamut = "Sony S-Gamut3.Cine";
                      } else if (p.includes("v-log")) {
                        cstParams.cstInputGamma = "Panasonic V-Log";
                        cstParams.cstInputGamut = "Panasonic V-Gamut";
                      } else if (p.includes("logc") || p.includes("log c")) {
                        cstParams.cstInputGamma = "ARRI Log C / HLG";
                      }
                    }
                    if (Object.keys(cstParams).length > 0) {
                      await executeScript("apply_project_settings", cstParams, false);
                    }
                  } catch (e) {
                    console.warn("apply_project_settings failed:", e);
                  }
                }

                // 2. Hvis backup-manifest finnes → lag Resolve-bins
                if (backupResult?.manifestPath) {
                  try {
                    await executeScript("create_resolve_bins_from_manifest", {
                      manifestPath: backupResult.manifestPath,
                    }, false);
                  } catch (e) {
                    console.warn("Resolve-bins-build failed:", e);
                  }
                }

                // 3. Bygg 3 timelines i ett kall basert på Steg 1-valgene
                let timelineNames: Record<string, string> = {};
                if (livePicksPath && (makeLongFilm || makeHighlight || makeTeaser)) {
                  try {
                    const sum = await executeScript("build_three_timelines", {
                      picksPath: livePicksPath,
                      projectName: projectName || "Untitled",
                      wanted: {
                        longFilm: makeLongFilm,
                        highlight: makeHighlight,
                        teaser: makeTeaser,
                      },
                    }, false);
                    const r = sum.events.find((e) => e.type === "result");
                    const val = r?.value as { timelineNames?: Record<string, string> } | undefined;
                    if (val?.timelineNames) {
                      timelineNames = val.timelineNames;
                      logActivity(livePicksPath, {
                        kind: "timelines_built",
                        label: `${Object.keys(timelineNames).length} timelines bygget`,
                        summary: Object.values(timelineNames).join(" · "),
                      });
                    }
                  } catch (e) {
                    console.warn("Three-timelines-build failed:", e);
                  }
                }

                // 4. QC: gaps + silent-sections i hver bygget timeline
                const qcWarnings: string[] = [];
                // Spor ubrukte sanger til silent-suggestion
                const unusedSongs = wishedSongs.map((s) => ({
                  title: s.title, artist: s.artist, role: s.role,
                }));
                for (const [key, tlName] of Object.entries(timelineNames)) {
                  if (!tlName) continue;
                  // 4a. Svarte mellomrom
                  try {
                    const sum = await executeScript("detect_timeline_gaps", {
                      timelineName: tlName,
                    }, false);
                    const r = sum.events.find((e) => e.type === "result");
                    const val = r?.value as { verdict?: string; gapCount?: number; totalGapSec?: number } | undefined;
                    if (val && val.verdict !== "clean" && (val.gapCount ?? 0) > 0) {
                      qcWarnings.push(`⬛ ${key}: ${val.gapCount} svarte mellomrom (${val.totalGapSec?.toFixed(1)}s)`);
                    }
                  } catch (e) {
                    console.warn(`Gap-check failed for ${tlName}:`, e);
                  }
                  // 4b. Stille intervaller med musikk-forslag
                  try {
                    const sum = await executeScript("detect_silent_sections_in_timeline", {
                      timelineName: tlName,
                      unusedSongs,
                      minSilenceSec: 3.0,
                    }, false);
                    const r = sum.events.find((e) => e.type === "result");
                    const val = r?.value as {
                      silentSections?: Array<{ startSec: number; endSec: number; durationSec: number;
                                                 chapterAtTime?: string;
                                                 suggestedSongs?: Array<{ title: string; artist: string; role: string }> }>;
                      totalSilentSec?: number;
                      silentPercent?: number;
                    } | undefined;
                    if (val && (val.silentSections?.length ?? 0) > 0) {
                      const lines = val.silentSections!.slice(0, 3).map((s) => {
                        const fmt = (x: number) => {
                          const m = Math.floor(x / 60); const ss = Math.floor(x % 60);
                          return `${m}:${String(ss).padStart(2, "0")}`;
                        };
                        const sugg = s.suggestedSongs?.[0];
                        return `   ${fmt(s.startSec)}–${fmt(s.endSec)} (${s.durationSec.toFixed(1)}s)${
                          sugg ? ` → forslag: "${sugg.title}" — ${sugg.artist}` : ""}`;
                      }).join("\n");
                      qcWarnings.push(`🎵 ${key}: ${val.silentSections!.length} stille intervaller (${val.totalSilentSec}s, ${val.silentPercent}%):\n${lines}`);
                    }
                  } catch (e) {
                    console.warn(`Silent-check failed for ${tlName}:`, e);
                  }
                }
                if (qcWarnings.length > 0) {
                  logActivity(livePicksPath, {
                    kind: "qc_run",
                    label: `QC: ${qcWarnings.length} advarsler funnet`,
                    summary: qcWarnings.slice(0, 2).join("; "),
                  });
                  const wantMarkers = await askQcMarkers(qcWarnings);
                  recordLearning(`QC: ${qcWarnings.length} advarsler — wantMarkers=${wantMarkers}`);

                  if (wantMarkers) {
                    let totalMarkers = 0;
                    for (const tlName of Object.values(timelineNames)) {
                      if (!tlName) continue;
                      try {
                        const sum = await executeScript("mark_qc_issues_on_timeline", {
                          timelineName: tlName,
                          unusedSongs,
                          removeOldQc: true,
                        }, false);
                        const r = sum.events.find((e) => e.type === "result");
                        const val = r?.value as { markersAdded?: number } | undefined;
                        if (val?.markersAdded) totalMarkers += val.markersAdded;
                      } catch (e) {
                        console.warn("Marker failed:", e);
                      }
                    }
                    if (totalMarkers > 0) {
                      alert(`✓ La til ${totalMarkers} QC-markers i Resolve. Røde = svart-gap, gule = stille. Hopp til hver via marker-listen.`);
                    }
                  }
                }

                if (livePicksPath) onComplete(livePicksPath);
                else onComplete(folder);
              }}>
                Ferdig — konfigurer Resolve + bygg timelines →
              </button>
            </div>
          </div>
        )}

        {/* Catch-all (skulle aldri trigge) */}
        {!["material","audio","music","persons","style","live","color"].includes(step) && (
          <div style={{ padding: 32, textAlign: "center", opacity: 0.7 }}>
            <div style={{ marginBottom: 12 }}><ConstructionIcon sx={{ fontSize: 48 }} /></div>
            <div style={{ fontSize: 15, marginBottom: 6 }}>
              <strong>Steg {currentStepN}: {STEPS[currentStepN - 1].label}</strong>
            </div>
            <div style={{ fontSize: 12, opacity: 0.7, maxWidth: 420, margin: "0 auto 20px" }}>
              Dette steget bygges i neste iterasjon. For nå hopper vi videre.
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button onClick={() => {
                const cur = STEPS.findIndex((s) => s.id === step);
                if (cur > 0) setStep(STEPS[cur - 1].id);
              }}>← Tilbake</button>
              <button className="primary" onClick={goNext}>
                {step === "color" ? "Ferdig — start prosjekt" : "Neste →"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* QC-prompt — erstatter native confirm(). Vises kun under delivery-flowen. */}
      {qcPrompt && (
        <div className="modal-backdrop" style={{ zIndex: 10000 }}
             onClick={() => { qcPrompt.resolve(false); setQcPrompt(null); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}
               style={{ width: 560, maxHeight: "80vh", overflow: "auto" }}>
            <h3 style={{ marginTop: 0 }}>⚠️ QC-rapport før delivery</h3>
            <div style={{ fontSize: 13, color: "var(--text-2)", whiteSpace: "pre-wrap" }}>
              {qcPrompt.warnings.join("\n\n")}
            </div>
            <p style={{ fontSize: 13, marginTop: 16 }}>
              Vil du at jeg legger til markers på timeline i Resolve så du kan
              navigere direkte til hvert problem?
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <button onClick={() => { qcPrompt.resolve(false); setQcPrompt(null); }}>
                Nei, hopp over
              </button>
              <button className="primary"
                      onClick={() => { qcPrompt.resolve(true); setQcPrompt(null); }}>
                Ja, legg til markers
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
