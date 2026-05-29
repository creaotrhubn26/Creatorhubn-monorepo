/**
 * AgentEditorView — generisk editor som driver alle nye agenter
 * (Music Video, Corporate, Event, Documentary, …) basert på AgentConfig
 * som beskriver chapters, signal-vekter, look-packs og Claude-persona.
 *
 * Wedding Agent har sin egen CreativeEditorView (CE) som forblir
 * uendret — dette er den nye, config-drevne editor-en alle ikke-
 * wedding agenter rendres gjennom.
 *
 * Funksjoner:
 *   - Chapter-strip fra config.chapters med pacingPct + priorityHint
 *   - Look-pack-grid med genre-tags + color-direction-detaljer
 *   - BPM-input + auto-detect (kun for music_video-kind)
 *   - Chat med config.primaryAgent (egen Claude-persona pr agent)
 *   - Thumbnail Creator + asset-bibliotek + upcoming jobs gjenbrukes
 *
 * Auto-pilot er disabled i V1 — kommer per-agent i V2.
 */

import { useState } from "react";
import { ThumbnailCreator } from "./ThumbnailCreator";
import { UpcomingJobsSidebar } from "./UpcomingJobsSidebar";
import { LowerThirdsStudio } from "./LowerThirdsStudio";
import { CaptionStudio } from "./CaptionStudio";
import SubtitlesIcon from "@mui/icons-material/Subtitles";
import ClosedCaptionIcon from "@mui/icons-material/ClosedCaption";
import AppShortcutIcon from "@mui/icons-material/AppShortcut";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import LaunchIcon from "@mui/icons-material/Launch";
import type { WhisperTranscript } from "../lib/captionTypes";
import { openPath } from "@tauri-apps/plugin-opener";
import { lowerThirdsService } from "../services/lowerThirdsService";
import type { AgentConfig, ChapterDef, LookPackDef } from "../agents/types";
import { executeScript } from "../api";
import { claudeProxyService } from "../services/claudeProxyService";
import type { ClaudeMessage } from "../services/claudeProxyService";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import BusinessCenterIcon from "@mui/icons-material/BusinessCenter";
import EventIcon from "@mui/icons-material/Event";
import ChurchIcon from "@mui/icons-material/Church";
import ScreenShareIcon from "@mui/icons-material/ScreenShare";
import PodcastsIcon from "@mui/icons-material/Podcasts";
import TheatersIcon from "@mui/icons-material/Theaters";
import LocalMoviesIcon from "@mui/icons-material/LocalMovies";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import MouseIcon from "@mui/icons-material/Mouse";
import ContentCutIcon from "@mui/icons-material/ContentCut";
import GraphicEqIcon from "@mui/icons-material/GraphicEq";
import BrushIcon from "@mui/icons-material/Brush";
import CloseIcon from "@mui/icons-material/Close";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import ColorLensIcon from "@mui/icons-material/ColorLens";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import SendIcon from "@mui/icons-material/Send";

const AGENT_ICON: Record<string, typeof MusicNoteIcon> = {
  music_video: MusicNoteIcon,
  corporate: BusinessCenterIcon,
  event: EventIcon,
  documentary: LocalMoviesIcon,
  wedding: ChurchIcon,
  screen_recording: ScreenShareIcon,
  podcast: PodcastsIcon,
  short_film: TheatersIcon,
};

interface Props {
  /** Sti til source-video. */
  sourcePath: string;
  onClose: () => void;
  /** Hvilken agent som skal kjøre denne editor-instansen. */
  config: AgentConfig;
}

export function AgentEditorView({ sourcePath, onClose, config }: Props) {
  const CFG = config;
  const AgentIcon = AGENT_ICON[config.kind] ?? MusicNoteIcon;
  // Music-video viser BPM-grid; Corporate/Event har det ikke som primær-modus
  const showBpmGrid = config.kind === "music_video";
  // Screen-recording har sin egen Analyze-modus i venstre kolonne
  const showScreenAnalysis = config.kind === "screen_recording";
  const [selectedChapter, setSelectedChapter] = useState<string>(CFG.chapters[0].id);
  const [bpm, setBpm] = useState<number>(120);
  const [songLengthSec, setSongLengthSec] = useState<number>(CFG.defaultDurationSec);
  const [selectedLook, setSelectedLook] = useState<string>(CFG.lookPacks[0].id);
  const [genre, setGenre] = useState<string>("");
  const [clientWishes, setClientWishes] = useState<string>("");
  const [thumbnailOpen, setThumbnailOpen] = useState(false);
  const [lowerThirdsOpen, setLowerThirdsOpen] = useState(false);
  const [captionStudioOpen, setCaptionStudioOpen] = useState(false);
  // Caption Studio gir oss transcript som vi inkluderer i Director-context
  const [loadedTranscript, setLoadedTranscript] = useState<WhisperTranscript | null>(null);
  const [multiAspectExporting, setMultiAspectExporting] = useState(false);
  const [multiAspectResult, setMultiAspectResult] = useState<{
    outputDir: string; renderedCount: number;
    renders: Array<{ aspect: string; sizeMB: number;
                       dimensions: string; path: string }>;
  } | null>(null);
  const [multiAspectError, setMultiAspectError] = useState<string | null>(null);
  const [handoffExporting, setHandoffExporting] = useState(false);
  const [handoffResult, setHandoffResult] = useState<{
    xmlPath: string; edlPath: string; outputDir: string;
    chapterMarkers: number; captionSubtitles: number;
    lowerThirdMarkers: number;
  } | null>(null);
  const [handoffError, setHandoffError] = useState<string | null>(null);

  const exportResolveHandoff = async () => {
    if (!sourcePath) return;
    setHandoffExporting(true);
    setHandoffError(null);
    setHandoffResult(null);
    try {
      // Hent lower-thirds for prosjektet (hvis Bjarne har laget noen)
      let lowerThirdsItems: unknown[] = [];
      try {
        const cols = await lowerThirdsService.list(projectIdForStudio);
        const def = cols.find(c => c.collectionName === "Default");
        if (def) lowerThirdsItems = def.items;
      } catch { /* ikke kritisk */ }

      const summary = await executeScript("export_resolve_handoff", {
        videoPath: sourcePath,
        projectName: `${CFG.name} — ${new Date().toISOString().slice(0, 10)}`,
        chapters: CFG.chapters,
        captions: loadedTranscript,
        lowerThirds: lowerThirdsItems,
      }, false);
      const result = summary.events.find(e => e.type === "result");
      const v = result?.value as typeof handoffResult;
      if (v) setHandoffResult(v);
    } catch (err) {
      setHandoffError((err as Error).message);
    } finally {
      setHandoffExporting(false);
    }
  };

  const exportMultiAspect = async () => {
    if (!sourcePath) return;
    setMultiAspectExporting(true);
    setMultiAspectError(null);
    setMultiAspectResult(null);
    try {
      const summary = await executeScript("export_multi_aspect", {
        videoPath: sourcePath,
        aspects: ["16:9", "9:16", "1:1", "4:5"],
        fileNamePrefix: config.kind,
        faceAware: true,
      }, false);
      const result = summary.events.find(e => e.type === "result");
      const v = result?.value as typeof multiAspectResult;
      if (v) setMultiAspectResult(v);
    } catch (err) {
      setMultiAspectError((err as Error).message);
    } finally {
      setMultiAspectExporting(false);
    }
  };
  // Project-id for persistence av lower-thirds. Hentes via tilstand
  // som settes når user åpner agent fra HomeView; for nå fallback til
  // hardkodet test-id slik at button funker uten Role Room-context.
  const projectIdForStudio = "test-project-default";
  // Hvilke agenter har lower-thirds som naturlig konvensjon
  const showLowerThirdsButton = (
    config.kind === "event" || config.kind === "podcast"
    || config.kind === "documentary" || config.kind === "corporate"
    || config.kind === "short_film"
  );
  const [beatAnalyzing, setBeatAnalyzing] = useState(false);
  const [beatAnalysis, setBeatAnalysis] = useState<{
    bpm: number; confidence: number; method: string;
    downbeatTimes: number[]; totalBars: number;
    totalDurationSec: number;
  } | null>(null);
  const [beatError, setBeatError] = useState<string | null>(null);
  // Screen-recording analyse-state (silenser, klikk, speech-segmenter)
  const [scanAnalyzing, setScanAnalyzing] = useState(false);
  const [scanAnalysis, setScanAnalysis] = useState<{
    totalDurationSec: number;
    silenceCount: number;
    clickCount: number;
    totalSilenceSec: number;
    trimSavingsSec: number;
    estimatedAfterTrimSec: number;
    silenceGaps: Array<{ startSec: number; endSec: number; durationSec: number }>;
    clickCandidates: Array<{ atSec: number; confidence: number }>;
  } | null>(null);
  const [autoTrimSilence, setAutoTrimSilence] = useState(true);
  const [zoomOnClicks, setZoomOnClicks] = useState(true);
  const [zoomStrength, setZoomStrength] = useState(1.3);
  const [scanError, setScanError] = useState<string | null>(null);
  // Claude chat-state — historikken med config.primaryAgent (Director)
  const [chatMessages, setChatMessages] = useState<ClaudeMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatThinking, setChatThinking] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const chapter = CFG.chapters.find(c => c.id === selectedChapter) ?? CFG.chapters[0];
  const look = CFG.lookPacks.find(l => l.id === selectedLook) ?? CFG.lookPacks[0];

  // Beat-grid: bars × beats per bar (4/4 default). Vises som markører
  // på chapter-strip-en så Bjarne ser hvor downbeats faller.
  const beatsPerBar = 4;
  const beatDurationSec = 60 / bpm;
  const totalBeats = Math.floor(songLengthSec / beatDurationSec);
  const totalBars = Math.floor(totalBeats / beatsPerBar);

  const buildContextPrimer = (): string => {
    const lines: string[] = [];
    lines.push(`Nåværende prosjekt-kontekst:`);
    if (showBpmGrid) {
      lines.push(`- BPM: ${bpm} (${beatAnalysis ? `auto-detect via ${beatAnalysis.method}, ${(beatAnalysis.confidence * 100).toFixed(0)}% sikkerhet` : "manuelt satt"})`);
      lines.push(`- Sang-lengde: ${songLengthSec}s (${totalBars} bars total)`);
    } else {
      lines.push(`- Leverings-lengde: ${songLengthSec}s`);
    }
    if (showScreenAnalysis && scanAnalysis) {
      lines.push(`- Screen-analyse: ${scanAnalysis.silenceCount} silens-gaps (${scanAnalysis.totalSilenceSec}s totalt), ${scanAnalysis.clickCount} klikk-kandidater, trim-savings ${scanAnalysis.trimSavingsSec}s`);
      lines.push(`- Auto-trim silenser: ${autoTrimSilence ? "PÅ" : "AV"}, zoom på klikk: ${zoomOnClicks ? `${zoomStrength}x` : "AV"}`);
    }
    lines.push(`- Aktivt kapittel: ${chapter.label} (priority: ${chapter.priorityHint}, ~${chapter.pacingPct}% av total)`);
    lines.push(`- Valgt look-pack: ${look.label} (${look.tags.join(", ")})`);
    if (genre) lines.push(`- ${showBpmGrid ? "Genre" : "Varemerke/industri"}: ${genre}`);
    if (clientWishes) lines.push(`- Klient wishes: ${clientWishes}`);
    if (loadedTranscript) {
      // Inkluder transkript som ekstra context. Cap til ~3000 chars
      // for å ikke spise hele Claude-tokenbudsjettet — Director kan
      // be om mer hvis nødvendig.
      const fullText = loadedTranscript.fullText.slice(0, 3000);
      const truncated = loadedTranscript.fullText.length > 3000;
      lines.push(``);
      lines.push(`TRANSKRIPT (${loadedTranscript.language}, ${loadedTranscript.segments.length} segments via ${loadedTranscript.method}${loadedTranscript.model ? `:${loadedTranscript.model}` : ""}):`);
      lines.push(fullText + (truncated ? ` … [trunkert ved 3000 chars, totalt ${loadedTranscript.fullText.length} chars]` : ""));
    }
    return lines.join("\n");
  };

  const sendChat = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setChatInput("");
    setChatError(null);
    const userMsg: ClaudeMessage = { role: "user", content: trimmed };
    // For første melding: inkluder kontekst-primer i user-meldingen
    const isFirstMessage = chatMessages.length === 0;
    const userMsgWithContext: ClaudeMessage = isFirstMessage
      ? { role: "user", content: `${buildContextPrimer()}\n\n---\n\n${trimmed}` }
      : userMsg;
    const nextHistory = [...chatMessages, userMsgWithContext];
    setChatMessages([...chatMessages, userMsg]);
    setChatThinking(true);
    try {
      const reply = await claudeProxyService.send({
        systemPrompt: CFG.primaryAgent.systemPrompt,
        messages: nextHistory,
        maxTokens: 800,
      });
      setChatMessages(prev => [...prev, userMsg, { role: "assistant", content: reply }]);
    } catch (err) {
      setChatError((err as Error).message);
      setChatMessages(prev => prev.slice(0, -1)); // rull tilbake user-melding
      setChatInput(trimmed);
    } finally {
      setChatThinking(false);
    }
  };

  const analyzeScreenRecording = async () => {
    if (!sourcePath) return;
    setScanAnalyzing(true);
    setScanError(null);
    try {
      const summary = await executeScript("analyze_screen_recording", {
        audioPath: sourcePath,
      }, false);
      const result = summary.events.find(e => e.type === "result");
      const v = result?.value as typeof scanAnalysis;
      if (!v) throw new Error("Ingen analyse-output");
      setScanAnalysis(v);
    } catch (err) {
      setScanError((err as Error).message);
    } finally {
      setScanAnalyzing(false);
    }
  };

  const analyzeBeats = async () => {
    if (!sourcePath) return;
    setBeatAnalyzing(true);
    setBeatError(null);
    try {
      const summary = await executeScript("analyze_audio_beats", {
        audioPath: sourcePath,
      }, false);
      const result = summary.events.find(e => e.type === "result");
      const v = result?.value as {
        bpm: number; confidence: number; method: string;
        downbeatTimes: number[]; totalBars: number;
        totalDurationSec: number;
      } | undefined;
      if (!v) throw new Error("Ingen analyse-output");
      setBeatAnalysis(v);
      setBpm(Math.round(v.bpm));
      if (v.totalDurationSec > 0) {
        setSongLengthSec(Math.round(v.totalDurationSec));
      }
    } catch (err) {
      setBeatError((err as Error).message);
    } finally {
      setBeatAnalyzing(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 2000,
      background: "linear-gradient(180deg, #0a0518 0%, #14081f 100%)",
      color: "var(--text-1, #e8e0f0)",
      display: "flex", flexDirection: "column",
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      {/* Header */}
      <div style={{
        padding: "10px 20px",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        background: "linear-gradient(180deg, rgba(20,12,40,0.95), rgba(10,5,24,0.95))",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 12,
      }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 6,
            background: "linear-gradient(135deg, #6e3fc7, #a030c0)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            color: "#fff",
          }}>
            <AgentIcon fontSize="small" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>
              {CFG.name}
            </div>
            <div style={{ fontSize: 10, color: "var(--text-3, #a89cb8)" }}>
              {CFG.tagline}
            </div>
          </div>
        </div>

        <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => setCaptionStudioOpen(true)}
                  style={{
                    background: "rgba(160,48,192,0.15)",
                    border: "1px solid rgba(160,48,192,0.4)",
                    color: "#fff", padding: "5px 12px", fontSize: 11,
                    borderRadius: 4, cursor: "pointer", fontWeight: 600,
                    display: "inline-flex", alignItems: "center", gap: 5,
                  }}>
            <ClosedCaptionIcon sx={{ fontSize: 14 }} /> Captions
            {loadedTranscript && (
              <span style={{ fontSize: 9, opacity: 0.7 }}>
                · {loadedTranscript.segments.length}
              </span>
            )}
          </button>
          <button onClick={() => void exportResolveHandoff()}
                  disabled={handoffExporting || !sourcePath}
                  title="Eksporter agent-state som FCP7 XML + EDL for import i DaVinci Resolve"
                  style={{
                    background: handoffExporting
                      ? "rgba(160,48,192,0.10)"
                      : "rgba(160,48,192,0.15)",
                    border: "1px solid rgba(160,48,192,0.4)",
                    color: "#fff", padding: "5px 12px", fontSize: 11,
                    borderRadius: 4,
                    cursor: handoffExporting ? "wait"
                          : sourcePath ? "pointer" : "not-allowed",
                    opacity: !sourcePath ? 0.5 : 1, fontWeight: 600,
                    display: "inline-flex", alignItems: "center", gap: 5,
                  }}>
            <LaunchIcon sx={{ fontSize: 14 }} />
            {handoffExporting ? "Eksporterer …" : "Resolve handoff"}
          </button>
          <button onClick={() => void exportMultiAspect()}
                  disabled={multiAspectExporting || !sourcePath}
                  title="Rendre 16:9 + 9:16 + 1:1 + 4:5 i én operasjon for cross-posting"
                  style={{
                    background: multiAspectExporting
                      ? "rgba(160,48,192,0.10)"
                      : "rgba(160,48,192,0.15)",
                    border: "1px solid rgba(160,48,192,0.4)",
                    color: "#fff", padding: "5px 12px", fontSize: 11,
                    borderRadius: 4,
                    cursor: multiAspectExporting ? "wait"
                          : sourcePath ? "pointer" : "not-allowed",
                    opacity: !sourcePath ? 0.5 : 1, fontWeight: 600,
                    display: "inline-flex", alignItems: "center", gap: 5,
                  }}>
            <AppShortcutIcon sx={{ fontSize: 14 }} />
            {multiAspectExporting ? "Renderer 4 …" : "Multi-aspect"}
          </button>
          {showLowerThirdsButton && (
            <button onClick={() => setLowerThirdsOpen(true)}
                    style={{
                      background: "rgba(160,48,192,0.15)",
                      border: "1px solid rgba(160,48,192,0.4)",
                      color: "#fff", padding: "5px 12px", fontSize: 11,
                      borderRadius: 4, cursor: "pointer", fontWeight: 600,
                      display: "inline-flex", alignItems: "center", gap: 5,
                    }}>
              <SubtitlesIcon sx={{ fontSize: 14 }} /> Lower Thirds
            </button>
          )}
          <button onClick={() => setThumbnailOpen(true)}
                  style={{
                    background: "rgba(160,48,192,0.15)",
                    border: "1px solid rgba(160,48,192,0.4)",
                    color: "#fff", padding: "5px 12px", fontSize: 11,
                    borderRadius: 4, cursor: "pointer", fontWeight: 600,
                    display: "inline-flex", alignItems: "center", gap: 5,
                  }}>
            <BrushIcon sx={{ fontSize: 14 }} /> Thumbnails
          </button>
          <button onClick={onClose}
                  title="Lukk"
                  style={{
                    background: "transparent", border: 0, color: "var(--text-2, #ccc)",
                    cursor: "pointer", padding: 4,
                    display: "inline-flex", alignItems: "center",
                  }}>
            <CloseIcon />
          </button>
        </div>
      </div>

      {/* Multi-aspect export result pill */}
      {multiAspectResult && (
        <div style={{
          padding: "8px 22px",
          background: "rgba(74,212,138,0.10)",
          borderBottom: "1px solid rgba(74,212,138,0.20)",
          color: "#4ad48a", fontSize: 11,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontWeight: 600 }}>
            {multiAspectResult.renderedCount} renders ferdig:
          </span>
          {multiAspectResult.renders.map(r => (
            <span key={r.aspect} style={{
              padding: "2px 8px", borderRadius: 3,
              background: "rgba(74,212,138,0.18)",
              border: "1px solid rgba(74,212,138,0.30)",
            }}>{r.aspect} · {r.dimensions} · {r.sizeMB}MB</span>
          ))}
          <button onClick={() => void openPath(multiAspectResult.outputDir)}
                  style={{
                    marginLeft: "auto",
                    background: "rgba(74,212,138,0.18)",
                    border: "1px solid rgba(74,212,138,0.40)",
                    color: "#4ad48a", borderRadius: 3,
                    padding: "3px 10px", fontSize: 10.5,
                    cursor: "pointer",
                    display: "inline-flex", alignItems: "center", gap: 4,
                  }}>
            <FolderOpenIcon sx={{ fontSize: 12 }} /> Åpne mappe
          </button>
        </div>
      )}
      {multiAspectError && (
        <div style={{
          padding: "8px 22px",
          background: "rgba(239,79,111,0.15)",
          color: "#ef4f6f", fontSize: 11,
        }}>Multi-aspect-eksport feilet: {multiAspectError}</div>
      )}

      {/* Resolve handoff result pill */}
      {handoffResult && (
        <div style={{
          padding: "8px 22px",
          background: "rgba(74,212,138,0.10)",
          borderBottom: "1px solid rgba(74,212,138,0.20)",
          color: "#4ad48a", fontSize: 11,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontWeight: 600 }}>
            Resolve handoff klar:
          </span>
          <span style={{
            padding: "2px 8px", borderRadius: 3,
            background: "rgba(74,212,138,0.18)",
            border: "1px solid rgba(74,212,138,0.30)",
          }}>{handoffResult.chapterMarkers} chapters</span>
          <span style={{
            padding: "2px 8px", borderRadius: 3,
            background: "rgba(74,212,138,0.18)",
            border: "1px solid rgba(74,212,138,0.30)",
          }}>{handoffResult.captionSubtitles} captions</span>
          <span style={{
            padding: "2px 8px", borderRadius: 3,
            background: "rgba(74,212,138,0.18)",
            border: "1px solid rgba(74,212,138,0.30)",
          }}>{handoffResult.lowerThirdMarkers} lower-thirds</span>
          <span style={{ opacity: 0.7 }}>
            → File → Import Timeline → velg .xml
          </span>
          <button onClick={() => void openPath(handoffResult.outputDir)}
                  style={{
                    marginLeft: "auto",
                    background: "rgba(74,212,138,0.18)",
                    border: "1px solid rgba(74,212,138,0.40)",
                    color: "#4ad48a", borderRadius: 3,
                    padding: "3px 10px", fontSize: 10.5,
                    cursor: "pointer",
                    display: "inline-flex", alignItems: "center", gap: 4,
                  }}>
            <FolderOpenIcon sx={{ fontSize: 12 }} /> Åpne mappe
          </button>
        </div>
      )}
      {handoffError && (
        <div style={{
          padding: "8px 22px",
          background: "rgba(239,79,111,0.15)",
          color: "#ef4f6f", fontSize: 11,
        }}>Resolve handoff feilet: {handoffError}</div>
      )}

      {/* Main area */}
      <div style={{ flex: 1, display: "grid",
                      gridTemplateColumns: "260px 1fr 320px",
                      overflow: "hidden" }}>

        {/* LEFT: chapters + BPM */}
        <div style={{ background: "rgba(255,255,255,0.02)",
                        borderRight: "1px solid rgba(255,255,255,0.06)",
                        padding: 16, overflowY: "auto" }}>
          <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 8,
                          color: "var(--text-2, #c8bcd8)" }}>
            {showBpmGrid ? "SANG-STRUKTUR" : "STORY-STRUKTUR"}
          </div>
          {CFG.chapters.map(ch => (
            <ChapterRow key={ch.id}
                        chapter={ch}
                        selected={ch.id === selectedChapter}
                        onSelect={() => setSelectedChapter(ch.id)} />
          ))}

          {showBpmGrid && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, marginTop: 16, marginBottom: 8,
                              color: "var(--text-2, #c8bcd8)" }}>
                BEAT-GRID
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8,
                              marginBottom: 6, fontSize: 11 }}>
                <span style={{ minWidth: 36 }}>BPM</span>
                <input type="number" min={60} max={220}
                       value={bpm}
                       onChange={e => setBpm(parseInt(e.target.value) || 120)}
                       style={inputStyle} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8,
                              marginBottom: 6, fontSize: 11 }}>
                <span style={{ minWidth: 36 }}>Lengde</span>
                <input type="number" min={30} max={600}
                       value={songLengthSec}
                       onChange={e => setSongLengthSec(parseInt(e.target.value) || 210)}
                       style={inputStyle} />
                <span style={{ fontSize: 10, color: "var(--text-3, #a89cb8)" }}>sek</span>
              </div>
              <div style={{ fontSize: 10, color: "var(--text-3, #a89cb8)", lineHeight: 1.4 }}>
                {totalBars} bars · {totalBeats} beats · {beatDurationSec.toFixed(3)}s pr beat
              </div>

              <button onClick={() => void analyzeBeats()}
                      disabled={!sourcePath || beatAnalyzing}
                      style={{
                        marginTop: 10, width: "100%",
                        background: beatAnalyzing
                          ? "rgba(110,63,199,0.20)"
                          : "linear-gradient(135deg, #6e3fc7, #a030c0)",
                        border: 0, color: "#fff",
                        padding: "7px 10px", borderRadius: 4,
                        fontSize: 11, fontWeight: 600,
                        cursor: beatAnalyzing ? "wait"
                              : sourcePath ? "pointer" : "not-allowed",
                        opacity: !sourcePath ? 0.5 : 1,
                        display: "inline-flex", alignItems: "center",
                        justifyContent: "center", gap: 6,
                      }}>
                <AutoFixHighIcon sx={{ fontSize: 14 }} />
                {beatAnalyzing ? "Analyserer …" : "Auto-detect BPM"}
              </button>

              {beatAnalysis && (
                <div style={{
                  marginTop: 8, padding: 8, borderRadius: 4,
                  background: "rgba(160,48,192,0.12)",
                  border: "1px solid rgba(160,48,192,0.30)",
                  fontSize: 10, lineHeight: 1.5,
                  color: "var(--text-2, #c8bcd8)",
                }}>
                  Detekteret: <strong>{beatAnalysis.bpm} BPM</strong>
                  {" "}({(beatAnalysis.confidence * 100).toFixed(0)}% sikkerhet)
                  {" · "}<code style={{ opacity: 0.7 }}>{beatAnalysis.method}</code>
                  {beatAnalysis.confidence < 0.5 && (
                    <div style={{ marginTop: 4, color: "#f0a500" }}>
                      Lav sikkerhet — verifiser BPM manuelt.
                    </div>
                  )}
                </div>
              )}
              {beatError && (
                <div style={{
                  marginTop: 8, padding: 6, borderRadius: 4,
                  background: "rgba(239,79,111,0.10)",
                  color: "#ef4f6f", fontSize: 10,
                }}>{beatError}</div>
              )}
            </>
          )}
          {!showBpmGrid && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, marginTop: 16, marginBottom: 8,
                              color: "var(--text-2, #c8bcd8)" }}>
                LEVERINGS-LENGDE
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8,
                              marginBottom: 6, fontSize: 11 }}>
                <span style={{ minWidth: 36 }}>Sek</span>
                <input type="number" min={15} max={1800}
                       value={songLengthSec}
                       onChange={e => setSongLengthSec(parseInt(e.target.value) || CFG.defaultDurationSec)}
                       style={inputStyle} />
              </div>
              <div style={{ fontSize: 10, color: "var(--text-3, #a89cb8)", lineHeight: 1.4 }}>
                {Math.floor(songLengthSec / 60)}:{String(songLengthSec % 60).padStart(2, "0")} ferdig-leveranse
              </div>
            </>
          )}

          {showScreenAnalysis && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, marginTop: 16, marginBottom: 8,
                              color: "var(--text-2, #c8bcd8)",
                              display: "inline-flex", alignItems: "center", gap: 5 }}>
                <ScreenShareIcon sx={{ fontSize: 13 }} />
                SCREEN-ANALYSE
              </div>

              <button onClick={() => void analyzeScreenRecording()}
                      disabled={!sourcePath || scanAnalyzing}
                      style={{
                        width: "100%", marginBottom: 8,
                        background: scanAnalyzing
                          ? "rgba(110,63,199,0.20)"
                          : "linear-gradient(135deg, #4a90e2, #6e3fc7)",
                        border: 0, color: "#fff",
                        padding: "7px 10px", borderRadius: 4,
                        fontSize: 11, fontWeight: 600,
                        cursor: scanAnalyzing ? "wait"
                              : sourcePath ? "pointer" : "not-allowed",
                        opacity: !sourcePath ? 0.5 : 1,
                        display: "inline-flex", alignItems: "center",
                        justifyContent: "center", gap: 6,
                      }}>
                <AutoFixHighIcon sx={{ fontSize: 14 }} />
                {scanAnalyzing ? "Analyserer …" : "Detect klikk + silenser"}
              </button>

              {scanAnalysis && (
                <div style={{
                  padding: 8, borderRadius: 4,
                  background: "rgba(74,144,226,0.10)",
                  border: "1px solid rgba(74,144,226,0.30)",
                  fontSize: 10, lineHeight: 1.6,
                  color: "var(--text-2, #c8bcd8)",
                  marginBottom: 8,
                }}>
                  <div>Total: <strong>{Math.floor(scanAnalysis.totalDurationSec / 60)}:{String(Math.floor(scanAnalysis.totalDurationSec % 60)).padStart(2, "0")}</strong></div>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <VolumeOffIcon sx={{ fontSize: 11 }} />
                    {scanAnalysis.silenceCount} silenser ({scanAnalysis.totalSilenceSec}s)
                  </div>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <MouseIcon sx={{ fontSize: 11 }} />
                    {scanAnalysis.clickCount} klikk-kandidater
                  </div>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 4,
                                  marginTop: 4, color: "#4ad48a" }}>
                    <ContentCutIcon sx={{ fontSize: 11 }} />
                    Trim-savings: <strong>{scanAnalysis.trimSavingsSec}s</strong> → {Math.floor(scanAnalysis.estimatedAfterTrimSec / 60)}:{String(Math.floor(scanAnalysis.estimatedAfterTrimSec % 60)).padStart(2, "0")}
                  </div>
                </div>
              )}
              {scanError && (
                <div style={{
                  marginBottom: 8, padding: 6, borderRadius: 4,
                  background: "rgba(239,79,111,0.10)",
                  color: "#ef4f6f", fontSize: 10,
                }}>{scanError}</div>
              )}

              <label style={{ display: "flex", alignItems: "center", gap: 6,
                                fontSize: 11, color: "var(--text-2, #c8bcd8)",
                                marginBottom: 4, cursor: "pointer" }}>
                <input type="checkbox" checked={autoTrimSilence}
                       onChange={e => setAutoTrimSilence(e.target.checked)} />
                Auto-trim silenser
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6,
                                fontSize: 11, color: "var(--text-2, #c8bcd8)",
                                marginBottom: 6, cursor: "pointer" }}>
                <input type="checkbox" checked={zoomOnClicks}
                       onChange={e => setZoomOnClicks(e.target.checked)} />
                Zoom inn på klikk
              </label>
              {zoomOnClicks && (
                <div style={{ display: "flex", alignItems: "center", gap: 6,
                                fontSize: 10.5, color: "var(--text-2, #c8bcd8)" }}>
                  <span style={{ minWidth: 50 }}>Zoom-styrke</span>
                  <input type="range" min={1.05} max={2.0} step={0.05}
                         value={zoomStrength}
                         onChange={e => setZoomStrength(parseFloat(e.target.value))}
                         style={{ flex: 1 }} />
                  <span style={{ minWidth: 32, textAlign: "right" }}>
                    {zoomStrength.toFixed(2)}x
                  </span>
                </div>
              )}

              {scanAnalysis && scanAnalysis.clickCount > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 600,
                                  color: "var(--text-3, #a89cb8)",
                                  marginBottom: 4 }}>
                    KLIKK-TIDLINJE
                  </div>
                  <ClickTimeline clicks={scanAnalysis.clickCandidates}
                                 totalDur={scanAnalysis.totalDurationSec} />
                </div>
              )}
            </>
          )}
        </div>

        {/* CENTER: preview + beat-strip */}
        <div style={{ background: "rgba(0,0,0,0.4)", padding: 24,
                        display: "flex", flexDirection: "column", gap: 16,
                        overflow: "hidden" }}>
          {/* Source-video info */}
          <div style={{ fontSize: 11, color: "var(--text-3, #a89cb8)" }}>
            Kilde: {sourcePath || "(ingen video valgt)"}
          </div>

          {/* Selected chapter info */}
          <div style={{
            background: "rgba(160,48,192,0.10)",
            border: "1px solid rgba(160,48,192,0.30)",
            borderRadius: 6, padding: 14,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8,
                            marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{chapter.label}</span>
              <span style={{ fontSize: 10,
                              padding: "2px 8px", borderRadius: 999,
                              background: priorityBg(chapter.priorityHint),
                              color: "#fff", fontWeight: 600 }}>
                {chapter.priorityHint}
              </span>
              <span style={{ fontSize: 10, color: "var(--text-3, #a89cb8)",
                              marginLeft: "auto" }}>
                ~{chapter.pacingPct}% av total
              </span>
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text-2, #c8bcd8)",
                            lineHeight: 1.5 }}>
              {chapter.description}
            </div>
          </div>

          {/* Beat-grid visualization — kun for music_video */}
          {showBpmGrid && <div>
            <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6,
                            color: "var(--text-2, #c8bcd8)" }}>
              BEAT-GRID FOR {chapter.label.toUpperCase()}
            </div>
            <BeatGridStrip bpm={bpm} chapter={chapter}
                           songLengthSec={songLengthSec}
                           beatsPerBar={beatsPerBar} />
            <div style={{ fontSize: 10, color: "var(--text-3, #a89cb8)",
                            marginTop: 6, lineHeight: 1.4 }}>
              Lyse linjer = downbeats (bar-start). Snare-treff på beat 2 og 4.
              {chapter.priorityHint === "high-energy"
                && " Sikt på cut hver 2. beat eller raskere i chorus."}
              {chapter.priorityHint === "atmospheric"
                && " Behold cuts langsommere — hver 4. beat eller halv-bar."}
            </div>
          </div>}

          {/* Look-pack picker */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 8,
                            color: "var(--text-2, #c8bcd8)",
                            display: "flex", alignItems: "center", gap: 6 }}>
              <ColorLensIcon sx={{ fontSize: 13 }} />
              {showBpmGrid ? "GENRE / LOOK" : "VAREMERKE / LOOK"}
            </div>
            <input value={genre}
                   onChange={e => setGenre(e.target.value)}
                   placeholder={showBpmGrid
                     ? "Genre (f.eks. hip-hop, hyperpop, indie-rock …)"
                     : "Varemerke / industri (f.eks. SaaS, fintech, helsetech …)"}
                   style={{ ...inputStyle, width: "100%", marginBottom: 8 }} />
            <div style={{ display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
                            gap: 6 }}>
              {CFG.lookPacks.map(lp => (
                <LookPackCard key={lp.id}
                              pack={lp}
                              selected={lp.id === selectedLook}
                              onSelect={() => setSelectedLook(lp.id)} />
              ))}
            </div>
          </div>

          {/* Selected look details */}
          <div style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 6, padding: 10, fontSize: 11,
            color: "var(--text-2, #c8bcd8)",
          }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              {look.label}
            </div>
            <div style={{ marginBottom: 4 }}>{look.description}</div>
            <div style={{ display: "flex", gap: 12, color: "var(--text-3, #a89cb8)",
                            fontSize: 10, flexWrap: "wrap" }}>
              <span>Kontrast: {look.colorDirection.contrast}</span>
              <span>Sat: {look.colorDirection.saturation}</span>
              <span>Temp: {look.colorDirection.temperature}</span>
              <span>Black: {look.colorDirection.blackPoint}</span>
              <span>Grain: {look.colorDirection.grain}</span>
              {look.colorDirection.specials && look.colorDirection.specials.map(s => (
                <span key={s} style={{ background: "rgba(160,48,192,0.20)",
                                         padding: "1px 6px", borderRadius: 3 }}>
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: Director-panel (agent's primary persona) */}
        <div style={{ background: "rgba(255,255,255,0.02)",
                        borderLeft: "1px solid rgba(255,255,255,0.06)",
                        padding: 16, overflowY: "auto",
                        display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 14,
              background: "linear-gradient(135deg, #6e3fc7, #a030c0)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}>
              <GraphicEqIcon sx={{ fontSize: 16, color: "#fff" }} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700 }}>
                {CFG.primaryAgent.name}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-3, #a89cb8)" }}>
                {CFG.primaryAgent.tagline}
              </div>
            </div>
          </div>

          <div style={{ fontSize: 11, fontWeight: 700,
                          color: "var(--text-2, #c8bcd8)" }}>
            {showBpmGrid ? "ARTIST / LABEL WISHES" : "KLIENT WISHES"}
          </div>
          <textarea value={clientWishes}
                    onChange={e => setClientWishes(e.target.value)}
                    rows={2}
                    placeholder={CFG.clientWishesExamples.slice(0, 3).join(" · ")}
                    style={{ ...inputStyle, minHeight: 44, resize: "vertical" }} />

          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {CFG.clientWishesExamples.slice(0, 4).map(ex => (
              <button key={ex}
                      onClick={() => setClientWishes(prev =>
                        prev ? `${prev}, ${ex}` : ex)}
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        color: "var(--text-2, #c8bcd8)",
                        fontSize: 10, padding: "3px 8px",
                        borderRadius: 999, cursor: "pointer",
                      }}>
                {ex}
              </button>
            ))}
          </div>

          {/* Chat med Director */}
          <div style={{ fontSize: 11, fontWeight: 700,
                          color: "var(--text-2, #c8bcd8)",
                          display: "flex", alignItems: "center",
                          justifyContent: "space-between" }}>
            <span>CHAT MED DIRECTOR</span>
            {chatMessages.length > 0 && (
              <button onClick={() => { setChatMessages([]); setChatError(null); }}
                      style={{
                        background: "transparent", border: 0,
                        color: "var(--text-3, #a89cb8)",
                        fontSize: 9.5, cursor: "pointer",
                      }}>Nullstill</button>
            )}
          </div>
          <div style={{
            flex: 1, minHeight: 140, maxHeight: 280,
            display: "flex", flexDirection: "column", gap: 6,
            background: "rgba(0,0,0,0.3)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 4, padding: 8, overflowY: "auto",
            fontSize: 11.5, lineHeight: 1.5,
          }}>
            {chatMessages.length === 0 && !chatThinking && (
              <div style={{ color: "var(--text-3, #a89cb8)",
                              fontSize: 10.5, lineHeight: 1.5 }}>
                Spør {CFG.primaryAgent.name} om pacing, struktur,
                look-valg, eller andre kreative valg. Konteksten
                ({showBpmGrid ? "BPM, " : ""}kapittel, look, wishes)
                sendes automatisk med første melding.
              </div>
            )}
            {chatMessages.map((m, i) => (
              <div key={i} style={{
                padding: "6px 8px", borderRadius: 4,
                background: m.role === "user"
                  ? "rgba(160,48,192,0.10)"
                  : "rgba(110,63,199,0.06)",
                border: m.role === "user"
                  ? "1px solid rgba(160,48,192,0.20)"
                  : "1px solid rgba(110,63,199,0.20)",
                whiteSpace: "pre-wrap", wordBreak: "break-word",
                color: m.role === "user"
                  ? "var(--text-1, #e8e0f0)" : "var(--text-2, #c8bcd8)",
              }}>
                {m.role === "user" && (
                  <div style={{ fontSize: 9, fontWeight: 600,
                                  color: "#c08ff0", marginBottom: 2 }}>DU</div>
                )}
                {m.role === "assistant" && (
                  <div style={{ fontSize: 9, fontWeight: 600,
                                  color: "#a08dd8", marginBottom: 2 }}>
                    {CFG.primaryAgent.name.toUpperCase()}
                  </div>
                )}
                {m.content}
              </div>
            ))}
            {chatThinking && (
              <div style={{ padding: "6px 8px", color: "var(--text-3, #a89cb8)",
                              fontStyle: "italic", fontSize: 10 }}>
                Tenker …
              </div>
            )}
          </div>
          {chatError && (
            <div style={{ padding: 6, borderRadius: 4,
                            background: "rgba(239,79,111,0.10)",
                            color: "#ef4f6f", fontSize: 10 }}>
              {chatError}
            </div>
          )}
          <div style={{ display: "flex", gap: 4 }}>
            <input value={chatInput}
                   onChange={e => setChatInput(e.target.value)}
                   onKeyDown={e => {
                     if (e.key === "Enter" && !e.shiftKey) {
                       e.preventDefault();
                       void sendChat(chatInput);
                     }
                   }}
                   placeholder="Spør Director …"
                   disabled={chatThinking}
                   style={{ ...inputStyle, flex: 1 }} />
            <button onClick={() => void sendChat(chatInput)}
                    disabled={chatThinking || !chatInput.trim()}
                    title="Send"
                    style={{
                      background: chatThinking || !chatInput.trim()
                        ? "rgba(110,63,199,0.20)"
                        : "linear-gradient(135deg, #6e3fc7, #a030c0)",
                      border: 0, color: "#fff",
                      padding: "0 10px", borderRadius: 4,
                      cursor: chatThinking || !chatInput.trim() ? "not-allowed" : "pointer",
                      display: "inline-flex", alignItems: "center",
                    }}>
              <SendIcon sx={{ fontSize: 14 }} />
            </button>
          </div>

          <button onClick={() => alert(`Auto-pilot for ${CFG.name} kommer i V2`)}
                  disabled
                  style={{
                    padding: "9px 12px",
                    background: "rgba(110,63,199,0.20)",
                    border: "1px solid rgba(110,63,199,0.40)",
                    color: "#fff", borderRadius: 6,
                    cursor: "not-allowed", fontSize: 11.5, fontWeight: 600,
                    opacity: 0.7,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    gap: 6,
                  }}>
            <PlayArrowIcon sx={{ fontSize: 14 }} />
            Start Auto-pilot (V2)
          </button>
        </div>
      </div>

      {/* Floating: upcoming jobs */}
      <UpcomingJobsSidebar onJobSelected={() => {}} />

      {/* Thumbnail Creator */}
      <ThumbnailCreator
        open={thumbnailOpen}
        onClose={() => setThumbnailOpen(false)}
        sourceVideoPath={sourcePath}
      />

      {/* Lower Thirds Studio — Role Room-brandet */}
      {showLowerThirdsButton && (
        <LowerThirdsStudio
          open={lowerThirdsOpen}
          onClose={() => setLowerThirdsOpen(false)}
          projectId={projectIdForStudio}
          agentKind={config.kind}
          videoDurationSec={songLengthSec}
        />
      )}

      {/* Caption Studio — Whisper-drevet, Role Room-brandet, alle agenter */}
      <CaptionStudio
        open={captionStudioOpen}
        onClose={() => setCaptionStudioOpen(false)}
        projectId={projectIdForStudio}
        sourceVideoPath={sourcePath}
        videoDurationSec={songLengthSec}
        onTranscriptLoaded={setLoadedTranscript}
      />
    </div>
  );
}

function ChapterRow({ chapter, selected, onSelect }: {
  chapter: ChapterDef;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button onClick={onSelect}
            style={{
              display: "flex", flexDirection: "column", alignItems: "stretch",
              width: "100%", textAlign: "left",
              background: selected ? "rgba(160,48,192,0.18)"
                                    : "rgba(255,255,255,0.04)",
              border: selected ? "1px solid rgba(160,48,192,0.4)"
                                : "1px solid rgba(255,255,255,0.06)",
              borderRadius: 4, padding: "6px 10px", marginBottom: 4,
              cursor: "pointer", color: "inherit",
            }}>
      <div style={{ display: "flex", justifyContent: "space-between",
                      alignItems: "center" }}>
        <span style={{ fontSize: 11.5, fontWeight: 600 }}>
          {chapter.label}
        </span>
        <span style={{ fontSize: 9, color: "var(--text-3, #a89cb8)" }}>
          {chapter.pacingPct}%
        </span>
      </div>
      <div style={{ fontSize: 9.5,
                      color: priorityColor(chapter.priorityHint),
                      marginTop: 2, fontWeight: 500 }}>
        {chapter.priorityHint}
      </div>
    </button>
  );
}

function LookPackCard({ pack, selected, onSelect }: {
  pack: LookPackDef;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button onClick={onSelect}
            title={pack.description}
            style={{
              background: selected ? "rgba(160,48,192,0.18)"
                                    : "rgba(255,255,255,0.04)",
              border: selected ? "1px solid rgba(160,48,192,0.5)"
                                : "1px solid rgba(255,255,255,0.08)",
              borderRadius: 4, padding: "6px 8px",
              cursor: "pointer", color: "inherit", textAlign: "left",
              display: "flex", flexDirection: "column", gap: 3,
            }}>
      <span style={{ fontSize: 11, fontWeight: 600 }}>{pack.label}</span>
      <span style={{ fontSize: 9, color: "var(--text-3, #a89cb8)",
                       lineHeight: 1.3 }}>
        {pack.tags.slice(0, 3).join(" · ")}
      </span>
    </button>
  );
}

function ClickTimeline({ clicks, totalDur }: {
  clicks: Array<{ atSec: number; confidence: number }>;
  totalDur: number;
}) {
  return (
    <div style={{
      position: "relative",
      height: 18,
      background: "rgba(0,0,0,0.4)",
      border: "1px solid rgba(74,144,226,0.20)",
      borderRadius: 2,
    }}>
      {clicks.map((c, i) => {
        const leftPct = (c.atSec / totalDur) * 100;
        const opacity = 0.4 + c.confidence * 0.6;
        return (
          <div key={i}
               title={`Klikk ved ${c.atSec.toFixed(1)}s (${(c.confidence * 100).toFixed(0)}% sikkerhet)`}
               style={{
                 position: "absolute",
                 left: `${leftPct}%`,
                 top: 2, bottom: 2,
                 width: 2,
                 background: "#4ad48a",
                 opacity,
                 borderRadius: 1,
               }} />
        );
      })}
    </div>
  );
}

function BeatGridStrip({ bpm, chapter, songLengthSec, beatsPerBar }: {
  bpm: number; chapter: ChapterDef;
  songLengthSec: number; beatsPerBar: number;
}) {
  const beatDur = 60 / bpm;
  const chapterDuration = (songLengthSec * (chapter.pacingPct ?? 10)) / 100;
  const beats = Math.floor(chapterDuration / beatDur);
  const bars = Math.max(1, Math.floor(beats / beatsPerBar));
  const visBars = Math.min(bars, 32);

  return (
    <div style={{
      display: "flex",
      gap: 2,
      background: "rgba(0,0,0,0.4)",
      padding: 6, borderRadius: 4,
      overflowX: "auto",
    }}>
      {Array.from({ length: visBars }).map((_, barIdx) => (
        <div key={barIdx} style={{
          display: "flex", gap: 1,
          padding: "0 2px",
          borderRight: barIdx < visBars - 1
            ? "1px solid rgba(255,255,255,0.10)" : undefined,
        }}>
          {Array.from({ length: beatsPerBar }).map((__, beatIdx) => (
            <div key={beatIdx} style={{
              width: 12, height: 18,
              background: beatIdx === 0
                ? "rgba(160,48,192,0.6)"
                : beatIdx === 2
                  ? "rgba(110,63,199,0.4)"
                  : "rgba(255,255,255,0.10)",
              borderRadius: 1,
            }} />
          ))}
        </div>
      ))}
      {bars > visBars && (
        <span style={{ alignSelf: "center", marginLeft: 6,
                         fontSize: 9, color: "var(--text-3, #a89cb8)" }}>
          +{bars - visBars} bars …
        </span>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 4, padding: "5px 8px",
  color: "var(--text-1, #e8e0f0)", fontSize: 11,
  flex: 1, minWidth: 0,
};

function priorityBg(p: ChapterDef["priorityHint"]): string {
  switch (p) {
    case "high-energy": return "#a030c0";
    case "emotional-peak": return "#6e3fc7";
    case "atmospheric": return "#4a8db8";
    case "informational": return "#5c9d6e";
    case "transitional": return "#a37a3a";
  }
}

function priorityColor(p: ChapterDef["priorityHint"]): string {
  switch (p) {
    case "high-energy": return "#e88dc8";
    case "emotional-peak": return "#a08dd8";
    case "atmospheric": return "#8db8d8";
    case "informational": return "#8dd8a0";
    case "transitional": return "#d8b88d";
  }
}

export default AgentEditorView;
