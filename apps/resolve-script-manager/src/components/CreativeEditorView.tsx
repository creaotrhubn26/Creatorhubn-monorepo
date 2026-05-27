/**
 * CreativeEditorView — Creator-style editing canvas matching the mockup:
 *
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │ CreatorHub │ Project Title         │ 16:9 │ Song │ Del Eksport │
 *   ├──────────┬────────────────────────────────────────┬────────────┤
 *   │ Segments │ Tabs (Rediger | Story)                 │  Claude    │
 *   │          │                                        │  assistant │
 *   │ [thumb]  │  ┌────────────────────────────────┐   │            │
 *   │ Forbered │  │      Live preview (video)      │   │  82% ███   │
 *   │          │  │                                │   │            │
 *   │ [thumb]  │  └────────────────────────────────┘   │  Forslag:  │
 *   │ Vielse   │  Claude ser på tidslinjen…           │  card 1    │
 *   │ ...      │  ┌─ Timeline strip ──────────────┐   │  card 2    │
 *   │          │  │ [1] [2] [3] [4] [5] [6] [7] [8]│   │  card 3    │
 *   │          │  └────────────────────────────────┘   │            │
 *   │ Historie │  ▰▰▰▰▰▱▱▰▰▰▰  Audio waveform        │  Chat:     │
 *   │ balanse  │  Trim · Juster · Overganger · Mer    │  [input]   │
 *   ├──────────┴────────────────────────────────────────┴────────────┤
 *   │ ① Velg segmenter  ② Forhåndsvisning  ③ Redigering  Start ▶   │
 *   └─────────────────────────────────────────────────────────────────┘
 *
 * Phase 1 (this commit): layout + segments from picks-cache + video preview +
 *   timeline strip + history balance computed from real signal scores +
 *   wizard nav state. All data is real — no mocks.
 *
 * Phase 2/3/4 (future): toolbar interactions, Claude API streaming chat +
 *   tool-use suggestions, Web-Audio waveform render. Stubs are minimal and
 *   clearly marked so they fail-loud rather than silently fake behavior.
 */

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { executeScript } from "../api";
import {
  IconPlay,
  IconMusic,
  IconSparkle,
  IconCheck,
  IconChevronLeft,
} from "./Icons";
import "./CreativeEditorView.css";

// ─────────────── types matching last_highlight_picks.json ───────────────
interface PickSignals {
  exposure?: number; slowmo?: number; color_grade?: number; bokeh?: number;
  speech?: number; emotional_peak?: number; faces?: number;
  wedding_events?: number; audio_events?: number; aesthetic?: number;
  pose?: number; open_vocab?: number; action?: number; depth?: number;
  [k: string]: number | undefined;
}

interface Pick {
  index: number;
  startSec: number;
  endSec: number;
  durationSec: number;
  score: number;
  chapter?: string;
  thumbnailPath?: string;
  signals?: PickSignals;
}

interface PicksPayload {
  sourceVideo: string;
  timelineName?: string;
  sourceDurationSec?: number;
  fps?: number;
  totalDurationSec?: number;
  picks: Pick[];
}

interface MusicAdvisor {
  uniqueSongs?: Array<{ title: string; artist: string; bpm?: number;
                       totalDuration: number; percentOfMusic?: number;
                       sections?: Array<{ startSec: number; endSec: number }> }>;
}

// ─────────────── chapter → segment-display mapping ───────────────
const CHAPTER_DISPLAY: Record<string, { label: string; emoji: string }> = {
  forberedelser: { label: "Forberedelser", emoji: "💄" },
  mehndi:        { label: "Mehndi",        emoji: "🌸" },
  haldi:         { label: "Haldi",         emoji: "🌼" },
  sangeet:       { label: "Sangeet",       emoji: "🎵" },
  nikkah:        { label: "Vielse",        emoji: "💒" },
  ceremony:      { label: "Vielse",        emoji: "💒" },
  vows:          { label: "Vielse",        emoji: "💒" },
  reception:     { label: "Reception",     emoji: "🥂" },
  walima:        { label: "Walima",        emoji: "🥂" },
  dance:         { label: "Dans",          emoji: "💃" },
  speeches:      { label: "Taler",         emoji: "🎤" },
  portraits:     { label: "Portretter",    emoji: "📸" },
  family:        { label: "Familie",       emoji: "👨‍👩‍👧" },
  details:       { label: "Detaljer",      emoji: "💍" },
};

// ─────────────── Historiebalanse weighting from signals ───────────────
const BALANCE_WEIGHTS: Record<string, { romantikk: number; familie: number; detaljer: number; emosjon: number; energi: number }> = {
  faces:          { romantikk: 0.3, familie: 0.7, detaljer: 0.0, emosjon: 0.4, energi: 0.0 },
  bokeh:          { romantikk: 0.7, familie: 0.0, detaljer: 0.5, emosjon: 0.2, energi: 0.0 },
  emotional_peak: { romantikk: 0.4, familie: 0.0, detaljer: 0.0, emosjon: 1.0, energi: 0.3 },
  pose:           { romantikk: 0.5, familie: 0.3, detaljer: 0.0, emosjon: 0.6, energi: 0.4 },
  slowmo:         { romantikk: 0.6, familie: 0.0, detaljer: 0.7, emosjon: 0.5, energi: 0.0 },
  action:         { romantikk: 0.0, familie: 0.2, detaljer: 0.0, emosjon: 0.0, energi: 1.0 },
  audio_events:   { romantikk: 0.0, familie: 0.3, detaljer: 0.0, emosjon: 0.2, energi: 0.8 },
  open_vocab:     { romantikk: 0.3, familie: 0.0, detaljer: 0.4, emosjon: 0.0, energi: 0.0 },
  color_grade:    { romantikk: 0.2, familie: 0.0, detaljer: 0.6, emosjon: 0.0, energi: 0.0 },
  aesthetic:      { romantikk: 0.4, familie: 0.0, detaljer: 0.7, emosjon: 0.1, energi: 0.0 },
  wedding_events: { romantikk: 0.3, familie: 0.4, detaljer: 0.2, emosjon: 0.3, energi: 0.2 },
};

function computeHistorybalance(picks: Pick[]) {
  const totals = { romantikk: 0, familie: 0, detaljer: 0, emosjon: 0, energi: 0 };
  let n = 0;
  for (const p of picks) {
    if (!p.signals) continue;
    n++;
    for (const [sig, v] of Object.entries(p.signals)) {
      const w = BALANCE_WEIGHTS[sig];
      if (!w || v == null) continue;
      totals.romantikk += v * w.romantikk;
      totals.familie   += v * w.familie;
      totals.detaljer  += v * w.detaljer;
      totals.emosjon   += v * w.emosjon;
      totals.energi    += v * w.energi;
    }
  }
  if (!n) return totals;
  // Normalize to 0-100% summing to ~100
  const sum = totals.romantikk + totals.familie + totals.detaljer + totals.emosjon + totals.energi;
  if (sum === 0) return totals;
  return {
    romantikk: Math.round((totals.romantikk / sum) * 100),
    familie:   Math.round((totals.familie   / sum) * 100),
    detaljer:  Math.round((totals.detaljer  / sum) * 100),
    emosjon:   Math.round((totals.emosjon   / sum) * 100),
    energi:    Math.round((totals.energi    / sum) * 100),
  };
}

// ─────────────── Group picks into segments by chapter ───────────────
function groupBySegments(picks: Pick[]) {
  const groups: Array<{
    chapter: string;
    display: { label: string; emoji: string };
    picks: Pick[];
    startSec: number;
    endSec: number;
    duration: number;
  }> = [];
  for (const p of picks.slice().sort((a, b) => a.startSec - b.startSec)) {
    const ch = (p.chapter || "details").toLowerCase();
    const last = groups[groups.length - 1];
    if (last && last.chapter === ch) {
      last.picks.push(p);
      last.endSec = p.endSec;
      last.duration = last.picks.reduce((s, x) => s + x.durationSec, 0);
    } else {
      groups.push({
        chapter: ch,
        display: CHAPTER_DISPLAY[ch] ?? { label: ch, emoji: "🎬" },
        picks: [p],
        startSec: p.startSec,
        endSec: p.endSec,
        duration: p.durationSec,
      });
    }
  }
  return groups;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ─── Dynamic Mood Engine ───
// Live Narrative Simulation fra UX-visjonen: video-preview justerer color/
// blur/contrast LIVE basert på focused pick's signals + chapter. Returns
// {filter, label, gradient} for current pick.
type Mood = { filter: string; label: string; accent: string };

function moodForPick(pick: Pick | undefined): Mood {
  if (!pick || !pick.signals) {
    return { filter: "none", label: "Natural", accent: "#8674a8" };
  }
  const s = pick.signals;
  const emotional = s.emotional_peak ?? 0;
  const action    = s.action ?? 0;
  const slowmo    = s.slowmo ?? 0;
  const faces     = s.faces ?? 0;
  const bokeh     = s.bokeh ?? 0;
  const score     = pick.score ?? 0;
  const chapter   = (pick.chapter || "").toLowerCase();

  // Chapter-driven base mood
  let label = "Cinematic";
  let accent = "#a030c0";
  let satBoost = 100;   // %
  let contrastBoost = 100;
  let brightnessBoost = 100;
  let blurPx = 0;
  let hueShift = 0;     // deg

  if (chapter === "mehndi") {
    label = "Warm Setup"; accent = "#f0a500";
    satBoost = 110; contrastBoost = 102; brightnessBoost = 105; hueShift = 10;
  } else if (chapter === "haldi") {
    label = "Golden Hour"; accent = "#fbbf24";
    satBoost = 125; contrastBoost = 105; brightnessBoost = 110; hueShift = 20;
  } else if (chapter === "sangeet" || chapter === "dance") {
    label = "Vivid Dance"; accent = "#c850e0";
    satBoost = 130; contrastBoost = 115; brightnessBoost = 100;
  } else if (chapter === "nikkah" || chapter === "ceremony" || chapter === "vows") {
    label = "Sacred"; accent = "#6e3fc7";
    satBoost = 95; contrastBoost = 108; brightnessBoost = 100; hueShift = -5;
  } else if (chapter === "reception" || chapter === "walima") {
    label = "Reception Glow"; accent = "#ef4f6f";
    satBoost = 120; contrastBoost = 112; brightnessBoost = 105;
  } else if (chapter === "portraits") {
    label = "Portrait"; accent = "#a030c0";
    satBoost = 105; contrastBoost = 107; brightnessBoost = 102; blurPx = 0.3;
  }

  // Per-signal modulation (live narrative simulation responds to actual data)
  if (emotional > 0.3) { satBoost += emotional * 10; contrastBoost += emotional * 8; }
  if (action > 0.3)    { satBoost += action * 15; contrastBoost += action * 10; }
  if (slowmo > 0.5)    { blurPx += slowmo * 0.6; satBoost -= slowmo * 5; }
  if (bokeh > 0.5)     { blurPx += bokeh * 0.3; }
  if (faces > 0.5)     { brightnessBoost += faces * 3; }
  if (score < 0.3)     { satBoost -= 10; brightnessBoost -= 5; } // weak picks → dim

  const filter = `saturate(${satBoost.toFixed(0)}%) contrast(${contrastBoost.toFixed(0)}%) brightness(${brightnessBoost.toFixed(0)}%) hue-rotate(${hueShift}deg) blur(${blurPx.toFixed(2)}px)`;
  return { filter, label, accent };
}

// Mirror of identify_and_download_source_songs.safe_query() in Python.
// Used to derive the expected WAV filename from title + artist.
function safeQuery(s: string): string {
  // Match Python's re.sub(r"[^\w\s-]", "", query)[:80].strip()
  // \w in JS matches [A-Za-z0-9_]; Python's \w is similar.
  return s.replace(/[^\w\s-]/g, "").trim().slice(0, 80);
}

const SONGS_DIR = "/Users/danielqazi/Library/Application Support/no.creatorhubn.roleroom-post-agent/source_songs";
function songWavPath(title?: string, artist?: string): string | undefined {
  if (!title) return undefined;
  const q = safeQuery(`${title} ${artist ?? ""}`);
  return `${SONGS_DIR}/${q}.wav`;
}

// ─────────────── Component ───────────────
interface Props {
  picksPath?: string;       // path to last_highlight_picks.json
  advisorPath?: string;     // path to music_advisor.json
  onClose?: () => void;
}

export function CreativeEditorView({ picksPath, advisorPath, onClose }: Props) {
  const [payload, setPayload] = useState<PicksPayload | null>(null);
  const [advisor, setAdvisor] = useState<MusicAdvisor | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [projectTitle, setProjectTitle] = useState<string>("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16" | "1:1">("16:9");
  const [aspectMenuOpen, setAspectMenuOpen] = useState(false);

  // Export dropdown — 5 delivery variants powered by existing Post Agent scripts
  type ExportVariant = "custom" | "teaser" | "instagram" | "couple" | "family" | "full";
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  // Color/Look pack — applies CSS filter LIVE + sends LUT-name to assemble-script
  type LookPack = "none" | "norwedfilm" | "warm" | "cinematic" | "documentary";
  const [lookPack, setLookPack] = useState<LookPack>("none");
  const [lookMenuOpen, setLookMenuOpen] = useState(false);

  // Audio Agent smart-actions — wire eksisterende audio-scripts
  type AudioAction = "isolate_vocals" | "duck_music" | "transcribe" | "normalize_loudness";
  const [audioActionBusy, setAudioActionBusy] = useState<AudioAction | null>(null);
  const [audioActionResults, setAudioActionResults] = useState<Record<string, string>>({});

  // Vision Agent quality flags — flag_underexposed + flag_clipping + face-id
  type QualityFlag = { pickIndex: number; severity: "ok" | "warning" | "error"; issues: string[] };
  const [qualityFlags, setQualityFlags] = useState<QualityFlag[]>([]);
  const [qualityBusy, setQualityBusy] = useState(false);

  // Client Wishes — free-text input from couple → Claude tool-use applies edits
  const [clientWishes, setClientWishes] = useState("");
  const [wishesBusy, setWishesBusy] = useState(false);
  const [wishesError, setWishesError] = useState<string | null>(null);
  const [wishesResult, setWishesResult] = useState<{
    interpretation: string; rationale: string; changesSummary: string
  } | null>(null);
  const [activeSongIdx, setActiveSongIdx] = useState(0);
  const [songMenuOpen, setSongMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"rediger" | "story">("rediger");
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);

  // Pick selection state — which segments are included in the highlight
  const [includedChapters, setIncludedChapters] = useState<Set<string>>(new Set());
  // Currently focused pick (for video playback)
  const [focusedPickIdx, setFocusedPickIdx] = useState<number>(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playRate, setPlayRate] = useState(1);
  // Loop within focused pick (default) vs play full source continuously
  const [loopMode, setLoopMode] = useState<"pick" | "full">("pick");

  // Claude chat state — separate history per agent
  type ChatMsg = { role: "user" | "assistant"; content: string };
  type AgentRole = "claude" | "vision" | "audio" | "wedding";
  const [agentRole, setAgentRole] = useState<AgentRole>("claude");
  const [chatHistory, setChatHistory] = useState<Record<AgentRole, ChatMsg[]>>({
    claude: [], vision: [], audio: [], wedding: [],
  });
  const chatMessages = chatHistory[agentRole];
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // Hover-preview state — when mouse-over segment, play that pick
  const [hoveredPickIdx, setHoveredPickIdx] = useState<number | null>(null);
  const hoverStartedPlaybackRef = useRef(false);

  // Generate Alternate Edit state
  type AltVariant = "cinematic" | "emotional" | "social" | "luxury" | "documentary";
  const [altMenuOpen, setAltMenuOpen] = useState(false);
  const [altBusy, setAltBusy] = useState<AltVariant | null>(null);
  const [altError, setAltError] = useState<string | null>(null);
  const [activePickOrder, setActivePickOrder] = useState<number[] | null>(null);
  const [altRationale, setAltRationale] = useState<{ variant: AltVariant; text: string } | null>(null);

  // AI Attention Tracking state — narrative-flow evaluation per pick
  type FlowQuality = "strong" | "weak" | "drag";
  type FlowEval = { pickIndex: number; flowQuality: FlowQuality; reason: string };
  const [flowEvals, setFlowEvals] = useState<FlowEval[]>([]);
  const [flowBusy, setFlowBusy] = useState(false);
  const [flowError, setFlowError] = useState<string | null>(null);
  const [hoveredFlowPickIdx, setHoveredFlowPickIdx] = useState<number | null>(null);

  // Export state
  const [exportBusy, setExportBusy] = useState(false);
  const [exportResult, setExportResult] = useState<{ outputPath: string; durationSec: number } | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // Real suggestion cards from Claude
  type SuggestionAction = "focus" | "trim" | "skip" | "promote";
  type Suggestion = {
    title: string;
    description: string;
    targetPickIndex: number;
    action: SuggestionAction;
    primaryLabel?: string;
  };
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggBusy, setSuggBusy] = useState(false);
  const [suggError, setSuggError] = useState<string | null>(null);

  // Trim state — adjusts focused pick's startSec/endSec via local override
  const [pickOverrides, setPickOverrides] = useState<Record<number, { startSec?: number; endSec?: number }>>({});
  const [trimMode, setTrimMode] = useState(false);
  const [snapToBeat, setSnapToBeat] = useState(true);

  // Undo/redo history — snapshots of editor state on each change
  type EditorSnapshot = {
    includedChapters: string[];
    pickOverrides: Record<number, { startSec?: number; endSec?: number }>;
    activePickOrder: number[] | null;
  };
  const historyRef = useRef<{ snapshots: EditorSnapshot[]; idx: number; restoringFromHistory: boolean }>({
    snapshots: [],
    idx: -1,
    restoringFromHistory: false,
  });
  const [undoAvailable, setUndoAvailable] = useState(false);
  const [redoAvailable, setRedoAvailable] = useState(false);

  // Drag-and-drop for timeline reorder
  const [draggedPickIdx, setDraggedPickIdx] = useState<number | null>(null);

  // Shortcuts help-overlay
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // ─── Pro-editor: Overganger / Custom audio / Markers / Comments ───
  type TransitionType = "cut" | "fade" | "dissolve" | "wipeleft" | "fadeblack" | "fadewhite";
  const [pickTransitions, setPickTransitions] = useState<Record<string, TransitionType>>({});
  const [transitionMenuFor, setTransitionMenuFor] = useState<string | null>(null);

  type CustomAudio = { id: string; path: string; name: string; startSec: number; volume: number };
  const [customAudios, setCustomAudios] = useState<CustomAudio[]>([]);

  type TimelineMarker = { id: string; timeSec: number; label: string; color: string; comment: string };
  const [markers, setMarkers] = useState<TimelineMarker[]>([]);
  const [editingMarkerId, setEditingMarkerId] = useState<string | null>(null);

  // Comments per pick (separate from markers — these are pick-level notes)
  const [pickComments, setPickComments] = useState<Record<number, string>>({});
  const [editingCommentPick, setEditingCommentPick] = useState<number | null>(null);

  // ─── Persist edit state per-project to localStorage ───
  // Key = source-video path. State: title, included chapters, pickOverrides,
  // activePickOrder, activeSongIdx. Restored next time editor opens same video.
  const stateKey = useMemo(() => payload ? `trrpa.creative_editor.${payload.sourceVideo}` : null, [payload]);

  // ─── Load picks + advisor ───
  useEffect(() => {
    if (!picksPath) { setLoadError("No picks path provided"); return; }
    fetch(convertFileSrc(picksPath))
      .then((r) => r.json())
      .then((data: PicksPayload) => {
        setPayload(data);
        // Try restoring saved edit-state for this source video
        const key = `trrpa.creative_editor.${data.sourceVideo}`;
        let restored = false;
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const s = JSON.parse(raw);
            if (s.projectTitle)      setProjectTitle(s.projectTitle);
            if (Array.isArray(s.includedChapters)) setIncludedChapters(new Set(s.includedChapters));
            if (s.pickOverrides)     setPickOverrides(s.pickOverrides);
            if (Array.isArray(s.activePickOrder)) setActivePickOrder(s.activePickOrder);
            if (typeof s.activeSongIdx === "number") setActiveSongIdx(s.activeSongIdx);
            if (typeof s.clientWishes === "string") setClientWishes(s.clientWishes);
            if (s.pickTransitions) setPickTransitions(s.pickTransitions);
            if (Array.isArray(s.customAudios)) setCustomAudios(s.customAudios);
            if (Array.isArray(s.markers)) setMarkers(s.markers);
            if (s.pickComments) setPickComments(s.pickComments);
            restored = true;
          }
        } catch (e) {
          // Corrupt localStorage entry → ignore and use defaults
          console.warn("Could not restore creative-editor state:", e);
        }
        if (!restored) {
          // Derive default project title from source-video filename
          const base = data.sourceVideo.split("/").pop() ?? "Highlight";
          const clean = base.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
          setProjectTitle(clean);
          // Include all chapters by default
          const chapters = new Set<string>();
          for (const p of data.picks) chapters.add((p.chapter || "details").toLowerCase());
          setIncludedChapters(chapters);
        }
      })
      .catch((e) => setLoadError(`Failed to load picks: ${e}`));
  }, [picksPath]);

  // Auto-save state on changes (debounced via timeout)
  useEffect(() => {
    if (!stateKey || !payload) return;
    const handle = setTimeout(() => {
      try {
        localStorage.setItem(stateKey, JSON.stringify({
          projectTitle,
          includedChapters: Array.from(includedChapters),
          pickOverrides,
          activePickOrder,
          activeSongIdx,
          clientWishes,
          pickTransitions,
          customAudios,
          markers,
          pickComments,
          savedAt: Date.now(),
        }));
      } catch (e) {
        console.warn("Could not save creative-editor state:", e);
      }
    }, 500);
    return () => clearTimeout(handle);
  }, [stateKey, payload, projectTitle, includedChapters, pickOverrides, activePickOrder, activeSongIdx, clientWishes, pickTransitions, customAudios, markers, pickComments]);

  useEffect(() => {
    if (!advisorPath) return;
    fetch(convertFileSrc(advisorPath))
      .then((r) => r.json())
      .then((d) => setAdvisor(d))
      .catch(() => { /* advisor is optional */ });
  }, [advisorPath]);

  // ─── Derived state ───
  const segments = useMemo(() => payload ? groupBySegments(payload.picks) : [], [payload]);
  const filteredPicks = useMemo(() => {
    if (!payload) return [];
    // Apply local trim-overrides first, then filter + sort
    const withOverrides = payload.picks.map(p => {
      const o = pickOverrides[p.index];
      if (!o) return p;
      const startSec = o.startSec ?? p.startSec;
      const endSec = o.endSec ?? p.endSec;
      return { ...p, startSec, endSec, durationSec: Math.max(0.1, endSec - startSec) };
    });
    const base = withOverrides
      .filter((p) => includedChapters.has((p.chapter || "details").toLowerCase()));
    if (activePickOrder) {
      const orderMap = new Map(activePickOrder.map((idx, i) => [idx, i]));
      return base
        .filter(p => orderMap.has(p.index))
        .sort((a, b) => (orderMap.get(a.index) ?? 0) - (orderMap.get(b.index) ?? 0));
    }
    return base.sort((a, b) => a.startSec - b.startSec);
  }, [payload, includedChapters, activePickOrder, pickOverrides]);
  const balance = useMemo(() => computeHistorybalance(filteredPicks), [filteredPicks]);
  const totalDuration = useMemo(() => filteredPicks.reduce((s, p) => s + p.durationSec, 0), [filteredPicks]);
  const songs = advisor?.uniqueSongs ?? [];
  const activeSong = songs[activeSongIdx];

  // Trigger music-analysis on song-change
  useEffect(() => {
    if (!activeSong) { setMusicFlow(null); return; }
    const wavPath = songWavPath(activeSong.title, activeSong.artist);
    if (!wavPath) { setMusicFlow(null); return; }
    let cancelled = false;
    setMusicFlowBusy(true);
    (async () => {
      try {
        const summary = await executeScript("analyze_music_for_flow", { audioPath: wavPath }, false);
        const result = summary.events.find(e => e.type === "result");
        if (!cancelled && result) {
          setMusicFlow(result.value as MusicFlowData);
        }
      } catch (e) {
        console.warn("Music flow analysis failed:", e);
      } finally {
        if (!cancelled) setMusicFlowBusy(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activeSong?.title, activeSong?.artist]);

  const videoSrc = useMemo(() => payload ? convertFileSrc(payload.sourceVideo) : "", [payload]);
  // When hover is active, play that segment; else play focused
  const activePick = (hoveredPickIdx != null && filteredPicks[hoveredPickIdx]) || filteredPicks[focusedPickIdx];
  const focusedPick = activePick;
  // Live Narrative Simulation — mood derived from focused pick + chapter
  const mood = useMemo(() => moodForPick(focusedPick), [focusedPick]);

  // LookPack-overlay-filter (kombineres med mood.filter)
  const lookFilter = useMemo(() => {
    switch (lookPack) {
      case "norwedfilm":  return " saturate(110%) contrast(108%) sepia(0.05)";
      case "warm":        return " saturate(120%) brightness(105%) hue-rotate(8deg)";
      case "cinematic":   return " contrast(115%) saturate(95%) brightness(98%)";
      case "documentary": return " saturate(90%) contrast(102%)";
      default: return "";
    }
  }, [lookPack]);

  // ─── Video playback: seek to focused pick (kun i pick-loop-mode) ───
  useEffect(() => {
    if (!videoRef.current || !focusedPick) return;
    // I full-mode: ikke seek tilbake til pick-start når focus endrer seg
    if (loopMode === "full") return;
    const v = videoRef.current;
    if (Math.abs(v.currentTime - focusedPick.startSec) > 0.5) {
      v.currentTime = focusedPick.startSec;
    }
  }, [focusedPickIdx, focusedPick, loopMode]);

  // Loop within current pick range (pick-mode) eller spill fritt (full-mode)
  useEffect(() => {
    if (!videoRef.current || !focusedPick) return;
    const v = videoRef.current;
    const onTime = () => {
      setCurrentTime(v.currentTime - focusedPick.startSec);
      // Bare loop hvis vi er i pick-mode
      if (loopMode === "pick" && v.currentTime >= focusedPick.endSec) {
        v.currentTime = focusedPick.startSec;
      }
    };
    v.addEventListener("timeupdate", onTime);
    return () => v.removeEventListener("timeupdate", onTime);
  }, [focusedPick, loopMode]);

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (isPlaying) { videoRef.current.pause(); setIsPlaying(false); }
    else { videoRef.current.play(); setIsPlaying(true); }
  }, [isPlaying]);

  const cyclePlayRate = useCallback(() => {
    const rates = [1, 0.5, 0.25, 1.5, 2];
    const next = rates[(rates.indexOf(playRate) + 1) % rates.length];
    setPlayRate(next);
    if (videoRef.current) videoRef.current.playbackRate = next;
  }, [playRate]);

  const toggleChapter = useCallback((ch: string) => {
    setIncludedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(ch)) next.delete(ch);
      else next.add(ch);
      return next;
    });
  }, []);

  // ─── Undo/redo: snapshot editor state on changes ───
  // Push current state as a new history snapshot. Skipped when restoring
  // (otherwise undo/redo would itself create new snapshots).
  useEffect(() => {
    if (historyRef.current.restoringFromHistory) {
      historyRef.current.restoringFromHistory = false;
      return;
    }
    const snap: EditorSnapshot = {
      includedChapters: Array.from(includedChapters),
      pickOverrides: { ...pickOverrides },
      activePickOrder: activePickOrder ? [...activePickOrder] : null,
    };
    const h = historyRef.current;
    // Truncate any forward-history when new change is made
    h.snapshots = [...h.snapshots.slice(0, h.idx + 1), snap].slice(-50); // cap at 50
    h.idx = h.snapshots.length - 1;
    setUndoAvailable(h.idx > 0);
    setRedoAvailable(false);
  }, [includedChapters, pickOverrides, activePickOrder]);

  const restoreSnapshot = useCallback((snap: EditorSnapshot) => {
    historyRef.current.restoringFromHistory = true;
    setIncludedChapters(new Set(snap.includedChapters));
    setPickOverrides(snap.pickOverrides);
    setActivePickOrder(snap.activePickOrder);
  }, []);

  const undo = useCallback(() => {
    const h = historyRef.current;
    if (h.idx <= 0) return;
    h.idx -= 1;
    restoreSnapshot(h.snapshots[h.idx]);
    setUndoAvailable(h.idx > 0);
    setRedoAvailable(h.idx < h.snapshots.length - 1);
  }, [restoreSnapshot]);

  const redo = useCallback(() => {
    const h = historyRef.current;
    if (h.idx >= h.snapshots.length - 1) return;
    h.idx += 1;
    restoreSnapshot(h.snapshots[h.idx]);
    setUndoAvailable(h.idx > 0);
    setRedoAvailable(h.idx < h.snapshots.length - 1);
  }, [restoreSnapshot]);

  // ─── Reorder picks (drag-and-drop) ───
  const reorderPicks = useCallback((fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    const newOrder = filteredPicks.map(p => p.index);
    const [moved] = newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, moved);
    setActivePickOrder(newOrder);
  }, [filteredPicks]);

  // ─── Transitions per boundary ───
  const setTransition = useCallback((fromIdx: number, toIdx: number, type: TransitionType) => {
    const key = `${fromIdx}-${toIdx}`;
    setPickTransitions(prev => ({ ...prev, [key]: type }));
    setTransitionMenuFor(null);
  }, []);

  // ─── Markers ───
  const addMarkerAtPlayhead = useCallback((label?: string) => {
    if (!focusedPick || !videoRef.current) return;
    const absTime = videoRef.current.currentTime;
    const colors = ["#a030c0", "#4ad48a", "#f0a500", "#ef4f6f", "#6e3fc7"];
    const m: TimelineMarker = {
      id: `m-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      timeSec: absTime,
      label: label ?? `Marker ${markers.length + 1}`,
      color: colors[markers.length % colors.length],
      comment: "",
    };
    setMarkers(prev => [...prev, m]);
    setEditingMarkerId(m.id);
  }, [focusedPick, markers.length]);

  const updateMarker = useCallback((id: string, patch: Partial<TimelineMarker>) => {
    setMarkers(prev => prev.map(m => m.id === id ? { ...m, ...patch } : m));
  }, []);

  const deleteMarker = useCallback((id: string) => {
    setMarkers(prev => prev.filter(m => m.id !== id));
  }, []);

  // ─── Custom Audio: file picker + state ───
  const addCustomAudio = useCallback(async () => {
    try {
      const { open: openDialog } = await import("@tauri-apps/plugin-dialog");
      const selected = await openDialog({
        multiple: false,
        filters: [{ name: "Audio", extensions: ["wav", "mp3", "m4a", "flac", "aac", "ogg"] }],
      });
      if (typeof selected !== "string") return;
      const name = selected.split("/").pop() ?? "Audio";
      const newAudio: CustomAudio = {
        id: `a-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
        path: selected,
        name,
        startSec: 0,
        volume: 0.8,
      };
      setCustomAudios(prev => [...prev, newAudio]);
    } catch (e: any) {
      console.warn("Custom audio picker failed:", e);
    }
  }, []);

  const updateCustomAudio = useCallback((id: string, patch: Partial<CustomAudio>) => {
    setCustomAudios(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a));
  }, []);

  const removeCustomAudio = useCallback((id: string) => {
    setCustomAudios(prev => prev.filter(a => a.id !== id));
  }, []);

  // ─── Story Arc: emotional curve fra signals per pick ───
  const storyArcPoints = useMemo(() => {
    if (filteredPicks.length === 0) return [];
    let cumTime = 0;
    return filteredPicks.map(p => {
      const s = p.signals ?? {};
      // Emotional energy: weighted sum of energy-related signals
      const energy = (
        (s.emotional_peak ?? 0) * 1.0 +
        (s.pose ?? 0) * 0.7 +
        (s.faces ?? 0) * 0.4 +
        (s.action ?? 0) * 0.6 +
        (s.audio_events ?? 0) * 0.5 +
        (s.slowmo ?? 0) * 0.3
      );
      // Normalize to 0-1 range (signals are 0-1 each, sum max ~3.5)
      const normalizedEnergy = Math.min(1.0, energy / 2.0);
      const startSec = cumTime;
      cumTime += p.durationSec;
      return {
        pickIndex: p.index,
        startSec,
        midSec: startSec + p.durationSec / 2,
        endSec: cumTime,
        energy: normalizedEnergy,
        score: p.score,
        chapter: p.chapter ?? "?",
      };
    });
  }, [filteredPicks]);

  const [flowMapOpen, setFlowMapOpen] = useState(false);

  // ─── Music-Driven Flow Map data (from analyze_music_for_flow.py) ───
  type MusicFlowData = {
    duration: number;
    tempo: number;
    beats: number[];
    downbeats: number[];
    sections: { startSec: number; endSec: number; label: string; rms: number }[];
    rms: { t: number; value: number }[];
    silence: { startSec: number; endSec: number }[];
    spectralCentroid: { t: number; value: number }[];
    drops: { t: number; intensity: number }[];
  };
  const [musicFlow, setMusicFlow] = useState<MusicFlowData | null>(null);
  const [musicFlowBusy, setMusicFlowBusy] = useState(false);

  // Story Arc phase analysis — find intro/build/peak/outro
  const storyArcPhases = useMemo(() => {
    if (storyArcPoints.length === 0) return null;
    const totalDur = storyArcPoints[storyArcPoints.length - 1].endSec;
    const peak = storyArcPoints.reduce((a, b) => a.energy > b.energy ? a : b);
    return {
      totalDur,
      peakTime: peak.midSec,
      peakEnergy: peak.energy,
      // Intro = first 15%, Build = next 35%, Peak = around peak, Outro = last 20%
      introEnd: totalDur * 0.15,
      buildEnd: totalDur * 0.55,
      outroStart: totalDur * 0.80,
    };
  }, [storyArcPoints]);

  // ─── Keyboard shortcuts (NLE-standard JKL/XV/M + Cmd+Z) ───
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const isMeta = e.metaKey || e.ctrlKey;
      if (isMeta && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if (isMeta && e.shiftKey && (e.key === "z" || e.key === "Z")) { e.preventDefault(); redo(); return; }
      if (isMeta) return;
      switch (e.key) {
        case "j": case "J": case "ArrowLeft":
          e.preventDefault();
          if (focusedPickIdx > 0) setFocusedPickIdx(focusedPickIdx - 1);
          break;
        case "l": case "L": case "ArrowRight":
          e.preventDefault();
          if (focusedPickIdx < filteredPicks.length - 1) setFocusedPickIdx(focusedPickIdx + 1);
          break;
        case "k": case "K": case " ":
          e.preventDefault();
          togglePlay();
          break;
        case "x": case "X":
          if (focusedPick?.chapter) {
            const ch = focusedPick.chapter.toLowerCase();
            const sameChapter = filteredPicks.filter(p => (p.chapter || "details").toLowerCase() === ch);
            if (sameChapter.length === 1) toggleChapter(ch);
          }
          break;
        case "v": case "V":
          if (focusedPick?.chapter) {
            const ch = focusedPick.chapter.toLowerCase();
            if (!includedChapters.has(ch)) toggleChapter(ch);
          }
          break;
        case "t": case "T":
          setTrimMode(v => !v);
          break;
        case "m": case "M":
          addMarkerAtPlayhead();
          break;
        case "c": case "C":
          if (focusedPick) setEditingCommentPick(focusedPick.index);
          break;
        case "?":
          e.preventDefault();
          setShortcutsOpen(true);
          break;
        case "Escape":
          if (shortcutsOpen) setShortcutsOpen(false);
          else if (aspectMenuOpen) setAspectMenuOpen(false);
          else if (songMenuOpen) setSongMenuOpen(false);
          else if (lookMenuOpen) setLookMenuOpen(false);
          else if (altMenuOpen) setAltMenuOpen(false);
          else if (exportMenuOpen) setExportMenuOpen(false);
          else if (editingMarkerId) setEditingMarkerId(null);
          else if (editingCommentPick !== null) setEditingCommentPick(null);
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [focusedPickIdx, filteredPicks.length, togglePlay, focusedPick, toggleChapter, includedChapters, undo, redo, filteredPicks, shortcutsOpen, aspectMenuOpen, songMenuOpen, lookMenuOpen, altMenuOpen, exportMenuOpen, editingMarkerId, editingCommentPick, addMarkerAtPlayhead]);

  // ─── Generate Alternate Edit: Claude tool-use to reorder picks ───
  const generateAlternate = useCallback(async (variant: AltVariant) => {
    if (altBusy) return;
    setAltBusy(variant);
    setAltError(null);
    setAltMenuOpen(false);
    const variantPrompts: Record<AltVariant, string> = {
      cinematic:   "Cinematic — slow, atmospheric, long emotional holds. Prioriter shots med høy aesthetic/bokeh-score og sakte pacing. Bygg en filmatisk bue.",
      emotional:   "Emotional — fokus på tårer, klem, latter, øyeblikk av nærhet. Prioriter shots med høy emotional_peak / pose / faces. Lang holding på reaksjoner.",
      social:      "Social media — kort, kvikk, høy energi. Korte rytmiske cuts (≤1s hver), action-shots, beat-matchet til musikken. Hook i de første 3 sekundene.",
      luxury:      "Luxury wedding — elegante portretter, detalj-shots (ringer, blomster), nøye komposisjon. Slow-mo og bokeh prioriteres.",
      documentary: "Documentary — naturlig kronologi, vitne-shots, behind-the-scenes. Mindre styling, mer 'å være der'. Speech-rich segmenter inkluderes.",
    };
    const pickSummary = filteredPicks.map(p => ({
      index: p.index,
      duration: p.durationSec,
      score: p.score,
      chapter: p.chapter ?? "?",
      signals: p.signals
        ? Object.entries(p.signals)
            .filter(([_, v]) => (v ?? 0) > 0.3)
            .map(([k, v]) => `${k}=${(v as number).toFixed(2)}`)
            .join(",")
        : "",
    }));
    const systemPrompt = `Du er en AI Creative Director som re-ordner picks for å lage en alternativ edit i en spesifikk stil. Du må returnere en gyldig sekvens av pick-indeksene (subset av tilgjengelige picks), i den rekkefølgen de skal spille av.

Tilgjengelige picks (${pickSummary.length} stk):
${pickSummary.map(p => `  shot#${p.index}: ${p.duration.toFixed(2)}s, chapter=${p.chapter}, score=${p.score.toFixed(2)}, signals[${p.signals}]`).join("\n")}

Project: "${projectTitle}"
Main song: ${activeSong ? `${activeSong.title} (${activeSong.bpm ?? "?"} BPM)` : "(ingen)"}

Stil: ${variant.toUpperCase()}
${variantPrompts[variant]}

Du MÅ kalle generate_alternate_edit-verktøyet med en re-ordned pickOrder + rationale (norsk, 2-3 setninger).`;
    try {
      const resp: any = await invoke("claude_chat", {
        messages: [{ role: "user", content: `Generer ${variant}-versjon. Du må kalle generate_alternate_edit-tool.` }],
        system: systemPrompt,
        model: "claude-opus-4-7",
        maxTokens: 800,
        tools: [{
          name: "generate_alternate_edit",
          description: "Re-order picks for an alternate edit in a specific style",
          input_schema: {
            type: "object",
            properties: {
              variant:   { type: "string", enum: ["cinematic", "emotional", "social", "luxury", "documentary"] },
              pickOrder: { type: "array", items: { type: "integer" },
                           description: "Reordered pick indices (subset). Each integer is a pick.index from the list above." },
              rationale: { type: "string", description: "Short Norwegian rationale (2-3 sentences) for the ordering" },
            },
            required: ["variant", "pickOrder", "rationale"],
          },
        }],
      });
      // Find tool_use block in response.content
      const blocks = resp?.content ?? [];
      const toolBlock = blocks.find((b: any) => b.type === "tool_use" && b.name === "generate_alternate_edit");
      if (!toolBlock) {
        const txt = blocks.filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n");
        throw new Error(`Claude returnerte ikke tool-call. Tekst: ${txt.slice(0, 200)}`);
      }
      const input = toolBlock.input ?? {};
      const order: number[] = Array.isArray(input.pickOrder) ? input.pickOrder : [];
      const rationale: string = input.rationale ?? "(ingen rationale)";
      // Validate order — must all be valid pick indices
      const validIdx = new Set(filteredPicks.map(p => p.index));
      const cleanOrder = order.filter(i => validIdx.has(i));
      if (cleanOrder.length === 0) {
        throw new Error(`Claude returnerte tom eller ugyldig pickOrder (${order.length} items, ${cleanOrder.length} valid).`);
      }
      setActivePickOrder(cleanOrder);
      setAltRationale({ variant, text: rationale });
      // Focus first pick of the alternate order
      const firstIdx = filteredPicks.findIndex(p => p.index === cleanOrder[0]);
      if (firstIdx >= 0) setFocusedPickIdx(firstIdx);
    } catch (e: any) {
      setAltError(typeof e === "string" ? e : (e?.message ?? "Ukjent feil"));
    } finally {
      setAltBusy(null);
    }
  }, [altBusy, filteredPicks, projectTitle, activeSong]);

  // ─── Real Suggestion Cards: Claude analyserer + foreslår 3 konkrete forbedringer ───
  const fetchSuggestions = useCallback(async () => {
    if (suggBusy || filteredPicks.length === 0) return;
    setSuggBusy(true);
    setSuggError(null);
    const pickSummary = filteredPicks.map((p, i) => ({
      pos: i + 1, index: p.index, duration: p.durationSec,
      score: p.score, chapter: p.chapter ?? "?",
      topSignals: p.signals
        ? Object.entries(p.signals)
            .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
            .slice(0, 3)
            .map(([k, v]) => `${k}=${(v as number).toFixed(2)}`)
            .join(",")
        : "",
    }));
    const systemPrompt = `Du er en AI Creative Director som ser etter konkrete forbedringer i en wedding-highlight. Du skal returnere NØYAKTIG 3 actionable forslag basert på sekvensen og signal-data.

Sekvens (${filteredPicks.length} picks):
${pickSummary.map(p => `  pos ${p.pos}: shot#${p.index} chapter=${p.chapter} ${p.duration.toFixed(2)}s score=${p.score.toFixed(2)} signals[${p.topSignals}]`).join("\n")}

Project: "${projectTitle}" — total ${formatTime(totalDuration)}
Story balance: Romantikk ${balance.romantikk}%, Familie ${balance.familie}%, Detaljer ${balance.detaljer}%, Emosjon ${balance.emosjon}%, Energi ${balance.energi}%

For hvert forslag oppgi:
  title (norsk, kort 3-7 ord)
  description (norsk, 1 setning som forklarer hvorfor)
  targetPickIndex (faktisk shot#-index fra sekvensen)
  action: "focus" (vis klippet) | "trim" (juster lengde) | "skip" (fjern) | "promote" (flytt til høyere posisjon)

Du MÅ kalle generate_suggestions-tool med en array på akkurat 3 forslag.`;
    try {
      const resp: any = await invoke("claude_chat", {
        messages: [{ role: "user", content: "Gi 3 konkrete forbedringsforslag for denne sekvensen." }],
        system: systemPrompt,
        model: "claude-opus-4-7",
        maxTokens: 1200,
        tools: [{
          name: "generate_suggestions",
          description: "Return 3 actionable improvement suggestions for the highlight",
          input_schema: {
            type: "object",
            properties: {
              suggestions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title:           { type: "string" },
                    description:     { type: "string" },
                    targetPickIndex: { type: "integer" },
                    action:          { type: "string", enum: ["focus", "trim", "skip", "promote"] },
                  },
                  required: ["title", "description", "targetPickIndex", "action"],
                },
                minItems: 3,
                maxItems: 3,
              },
            },
            required: ["suggestions"],
          },
        }],
      });
      const blocks = resp?.content ?? [];
      const toolBlock = blocks.find((b: any) => b.type === "tool_use" && b.name === "generate_suggestions");
      if (!toolBlock) throw new Error("Claude returnerte ikke tool-call.");
      const raw = (toolBlock.input?.suggestions ?? []) as Suggestion[];
      const validIdx = new Set(filteredPicks.map(p => p.index));
      const clean = raw.filter(s => validIdx.has(s.targetPickIndex));
      if (clean.length === 0) throw new Error("Claude foreslo picks som ikke finnes i sekvensen.");
      setSuggestions(clean);
    } catch (e: any) {
      setSuggError(typeof e === "string" ? e : (e?.message ?? "Ukjent feil"));
    } finally {
      setSuggBusy(false);
    }
  }, [suggBusy, filteredPicks, projectTitle, totalDuration, balance]);

  // ─── Apply suggestion: execute the suggested action ───
  const applySuggestion = useCallback((s: Suggestion) => {
    const idx = filteredPicks.findIndex(p => p.index === s.targetPickIndex);
    if (idx < 0) return;
    setFocusedPickIdx(idx);
    if (s.action === "trim") {
      setTrimMode(true);
    } else if (s.action === "skip") {
      // Add to excluded — toggle off chapter that contains only this pick if possible,
      // else just inform user (more nuanced "skip individual pick" is future-work).
      const pick = filteredPicks[idx];
      const chapter = (pick.chapter || "details").toLowerCase();
      const sameChapter = filteredPicks.filter(p => (p.chapter || "details").toLowerCase() === chapter);
      if (sameChapter.length === 1) toggleChapter(chapter);
    } else if (s.action === "promote") {
      // Move pick to front of order
      const newOrder = [s.targetPickIndex, ...filteredPicks.filter(p => p.index !== s.targetPickIndex).map(p => p.index)];
      setActivePickOrder(newOrder);
    }
    // For "focus" action — just focus, already done above
  }, [filteredPicks, toggleChapter]);

  // ─── Apply Wishes from couple: Claude oversetter wishes til edit-handlinger ───
  const applyWishes = useCallback(async () => {
    if (wishesBusy || !clientWishes.trim() || filteredPicks.length === 0) return;
    setWishesBusy(true);
    setWishesError(null);
    setWishesResult(null);
    const pickSummary = filteredPicks.map((p, i) => ({
      pos: i + 1, index: p.index, duration: p.durationSec,
      score: p.score, chapter: p.chapter ?? "?",
      topSignals: p.signals
        ? Object.entries(p.signals)
            .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
            .slice(0, 3)
            .map(([k, v]) => `${k}=${(v as number).toFixed(2)}`)
            .join(",")
        : "",
    }));
    const systemPrompt = `Du er en AI Creative Director som oversetter naturlig-språk-ønsker fra bryllupsparet til konkrete edit-handlinger. Du må forstå hva paret mener selv om de ikke bruker tekniske termer.

Eksempler på vanlige wishes:
  "mer av pappa sin tale"     → finn picks med høy speech + faces=family-pose, prioriter dem
  "kortere reception"         → trim reception-picks med 30-50%
  "fjern familie-shots"       → skip alle picks med høy faces-signal og chapter=family
  "fokuser på følelser"       → prioriter høy emotional_peak, lengre holds, slow-mo
  "ikke for langsomt"         → fjern lange holds, prioriter kortere picks

Sekvens (${filteredPicks.length} picks):
${pickSummary.map(p => `  pos ${p.pos}: shot#${p.index} chapter=${p.chapter} ${p.duration.toFixed(2)}s score=${p.score.toFixed(2)} signals[${p.topSignals}]`).join("\n")}

Project: "${projectTitle}" — total ${formatTime(totalDuration)}
Main song: ${activeSong ? `${activeSong.title} (${activeSong.bpm ?? "?"} BPM)` : "(ingen)"}

Bryllupsparets wishes:
"${clientWishes.trim()}"

Du MÅ kalle apply_couple_wishes-tool med:
  interpretation: 1-2 setninger som forteller hva du forsto fra wishes
  pickOrder: re-ordnet liste av pickIndex-er (subset eller full)
  skipped: array av pickIndex-er som skal helt fjernes (kan være tom)
  trims: object {pickIndex: newDurationFactor (0.5-1.5)} for picks som bør forkortes/forlenges (kan være tom)
  rationale: 2-3 setninger som forklarer endringer på norsk`;
    try {
      const resp: any = await invoke("claude_chat", {
        messages: [{ role: "user", content: "Oversett bryllupsparets wishes til edit-handlinger." }],
        system: systemPrompt,
        model: "claude-opus-4-7",
        maxTokens: 1500,
        tools: [{
          name: "apply_couple_wishes",
          description: "Translate couple's wishes into edit actions",
          input_schema: {
            type: "object",
            properties: {
              interpretation: { type: "string" },
              pickOrder:      { type: "array", items: { type: "integer" } },
              skipped:        { type: "array", items: { type: "integer" } },
              trims:          { type: "object", additionalProperties: { type: "number" } },
              rationale:      { type: "string" },
            },
            required: ["interpretation", "pickOrder", "rationale"],
          },
        }],
      });
      const blocks = resp?.content ?? [];
      const toolBlock = blocks.find((b: any) => b.type === "tool_use" && b.name === "apply_couple_wishes");
      if (!toolBlock) throw new Error("Claude returnerte ikke tool-call.");
      const input = toolBlock.input ?? {};
      const validIdx = new Set(filteredPicks.map(p => p.index));
      const pickOrder: number[] = (input.pickOrder ?? []).filter((i: number) => validIdx.has(i));
      const skipped: number[] = (input.skipped ?? []).filter((i: number) => validIdx.has(i));
      const trims: Record<string, number> = input.trims ?? {};

      // Apply re-order
      if (pickOrder.length > 0) {
        const finalOrder = pickOrder.filter(i => !skipped.includes(i));
        setActivePickOrder(finalOrder);
      } else if (skipped.length > 0) {
        // Skip-only — keep current order minus skipped
        setActivePickOrder(filteredPicks.filter(p => !skipped.includes(p.index)).map(p => p.index));
      }

      // Apply trims
      if (Object.keys(trims).length > 0) {
        const newOverrides: typeof pickOverrides = { ...pickOverrides };
        for (const [idxStr, factor] of Object.entries(trims)) {
          const idx = parseInt(idxStr, 10);
          if (!validIdx.has(idx)) continue;
          const pick = filteredPicks.find(p => p.index === idx)!;
          const mid = (pick.startSec + pick.endSec) / 2;
          const f = Math.max(0.3, Math.min(1.8, factor));
          const newDur = pick.durationSec * f;
          newOverrides[idx] = {
            startSec: mid - newDur / 2,
            endSec: mid + newDur / 2,
          };
        }
        setPickOverrides(newOverrides);
      }

      // Build summary for UI
      const changes: string[] = [];
      if (pickOrder.length > 0 && pickOrder.length !== filteredPicks.length) {
        changes.push(`Re-ordnet ${pickOrder.length} picks`);
      } else if (pickOrder.length > 0) {
        changes.push(`Re-ordnet sekvens`);
      }
      if (skipped.length > 0) changes.push(`Fjernet ${skipped.length} picks`);
      if (Object.keys(trims).length > 0) changes.push(`Trimmet ${Object.keys(trims).length} picks`);
      setWishesResult({
        interpretation: input.interpretation ?? "(ingen interpretasjon)",
        rationale: input.rationale ?? "(ingen begrunnelse)",
        changesSummary: changes.length > 0 ? changes.join(", ") : "Ingen endringer foreslått",
      });
    } catch (e: any) {
      setWishesError(typeof e === "string" ? e : (e?.message ?? "Ukjent feil"));
    } finally {
      setWishesBusy(false);
    }
  }, [wishesBusy, clientWishes, filteredPicks, projectTitle, totalDuration, activeSong, pickOverrides]);

  // ─── Eksport: 6 leveranse-varianter via eksisterende scripts ───
  const VARIANT_PRESETS: Record<ExportVariant, {
    name: string;
    desc: string;
    duration?: number; // target seconds (for trim)
    aspect?: "16:9" | "9:16" | "1:1";
  }> = {
    custom:    { name: "Custom",          desc: "Bruk current editor-state",    aspect: aspectRatio },
    teaser:    { name: "Teaser",          desc: "30s social-teaser",    duration: 30,  aspect: "9:16" },
    instagram: { name: "Instagram",       desc: "60s 9:16 for Reels",    duration: 60,  aspect: "9:16" },
    couple:    { name: "Couple-cut",      desc: "4 min 16:9 til paret",  duration: 240, aspect: "16:9" },
    family:    { name: "Family",          desc: "10 min hele dagen",     duration: 600, aspect: "16:9" },
    full:      { name: "Full highlight",  desc: "15 min directors-cut",  duration: 900, aspect: "16:9" },
  };

  const handleExport = useCallback(async (variant: ExportVariant = "custom") => {
    if (exportBusy || !payload) return;
    setExportBusy(true);
    setExportError(null);
    setExportResult(null);
    setExportMenuOpen(false);
    try {
      const preset = VARIANT_PRESETS[variant];
      const safeTitle = projectTitle.replace(/[^\w\s-]/g, "").trim() || "Highlight";
      const suffix = variant === "custom" ? "" : `_${variant}`;
      const outputPath = `~/Desktop/${safeTitle}${suffix}.mp4`;
      const allChapters = new Set<string>();
      payload.picks.forEach(p => allChapters.add((p.chapter || "details").toLowerCase()));
      const excluded = Array.from(allChapters).filter(c => !includedChapters.has(c));
      const summary = await executeScript("assemble_highlight_with_music", {
        videoPath: payload.sourceVideo,
        outputPath,
        musicStrategy: "main+climax",
        mainSongTitle: activeSong?.title,
        aspectRatio: preset.aspect ?? aspectRatio,
        colorLook: lookPack !== "none" ? lookPack : undefined,
        targetDurationSec: preset.duration,
        pickOverrides,
        pickOrder: activePickOrder ?? undefined,
        excludedChapters: excluded,
        // Pro-editor: per-boundary transitions
        pickTransitions: Object.keys(pickTransitions).length > 0 ? pickTransitions : undefined,
        // Custom audio tracks
        customAudios: customAudios.length > 0 ? customAudios.map(a => ({
          path: a.path, startSec: a.startSec, volume: a.volume
        })) : undefined,
      }, false);
      const resultEvent = summary.events.find(e => e.type === "result");
      const r = resultEvent?.value as { outputPath?: string; durationSec?: number } | undefined;
      if (r?.outputPath) {
        setExportResult({ outputPath: r.outputPath, durationSec: r.durationSec ?? 0 });
      } else {
        const errEvent = summary.events.find(e => e.type === "error");
        throw new Error((errEvent?.value as any)?.message ?? "Export failed (no output path)");
      }
    } catch (e: any) {
      setExportError(typeof e === "string" ? e : (e?.message ?? "Ukjent feil"));
    } finally {
      setExportBusy(false);
    }
  }, [exportBusy, payload, projectTitle, pickOverrides, activePickOrder, includedChapters, activeSong, aspectRatio, lookPack]);

  // ─── Audio Agent smart-actions — wire eksisterende Post Agent scripts ───
  const runAudioAction = useCallback(async (action: AudioAction) => {
    if (audioActionBusy || !payload) return;
    setAudioActionBusy(action);
    setAudioActionResults(prev => ({ ...prev, [action]: "Kjører…" }));
    const scriptMap: Record<AudioAction, { id: string; params: Record<string, unknown>; label: string }> = {
      isolate_vocals: {
        id: "isolate_vocals_with_demucs",
        params: { videoPath: payload.sourceVideo },
        label: "Demucs vocal-isolasjon",
      },
      duck_music: {
        id: "generate_music_ducking_plan",
        params: { videoPath: payload.sourceVideo },
        label: "Music-ducking plan generert",
      },
      transcribe: {
        id: "transcribe_audio",
        params: { videoPath: payload.sourceVideo, model: "large-v3" },
        label: "WhisperX transcription",
      },
      normalize_loudness: {
        id: "analyze_loudness",
        params: { videoPath: payload.sourceVideo, targetLufs: -16 },
        label: "EBU R128 loudness check",
      },
    };
    const s = scriptMap[action];
    try {
      const summary = await executeScript(s.id, s.params, false);
      const result = summary.events.find(e => e.type === "result");
      const errEvent = summary.events.find(e => e.type === "error");
      if (errEvent) throw new Error((errEvent.value as any)?.message ?? "Script failed");
      const msg = result ? `✓ ${s.label} ferdig` : `✓ ${s.label} kjørt`;
      setAudioActionResults(prev => ({ ...prev, [action]: msg }));
    } catch (e: any) {
      const msg = `⚠ ${typeof e === "string" ? e : (e?.message ?? "Feil")}`;
      setAudioActionResults(prev => ({ ...prev, [action]: msg }));
    } finally {
      setAudioActionBusy(null);
    }
  }, [audioActionBusy, payload]);

  // ─── Vision Agent quality-check — flag underexposed + clipping per pick ───
  const runQualityCheck = useCallback(async () => {
    if (qualityBusy || !payload) return;
    setQualityBusy(true);
    try {
      const summary = await executeScript("flag_underexposed_clips", {
        videoPath: payload.sourceVideo,
      }, false);
      const result = summary.events.find(e => e.type === "result");
      const flagged = (result?.value as any)?.flaggedClips ?? [];
      // Convert script-output to QualityFlag[] per pick
      const flags: QualityFlag[] = filteredPicks.map(p => {
        const hit = flagged.find((f: any) => f.timeSec >= p.startSec && f.timeSec <= p.endSec);
        if (hit) {
          return { pickIndex: p.index, severity: "warning", issues: [hit.reason || "Underexposed"] };
        }
        return { pickIndex: p.index, severity: "ok", issues: [] };
      });
      setQualityFlags(flags);
    } catch (e: any) {
      console.warn("Quality check failed:", e);
    } finally {
      setQualityBusy(false);
    }
  }, [qualityBusy, payload, filteredPicks]);

  // ─── Trim: update local override for focused pick ───
  const applyTrim = useCallback((pickIndex: number, startSec?: number, endSec?: number) => {
    setPickOverrides(prev => ({
      ...prev,
      [pickIndex]: { ...prev[pickIndex], startSec, endSec },
    }));
  }, []);

  // ─── Smart snap-all: align every pick's duration to whole-beat multiples ───
  const snapAllToBeats = useCallback(() => {
    if (!activeSong?.bpm) return;
    const beatInterval = 60 / activeSong.bpm;
    const newOverrides: typeof pickOverrides = { ...pickOverrides };
    let snappedCount = 0;
    for (const p of filteredPicks) {
      const original = payload?.picks.find(x => x.index === p.index);
      if (!original) continue;
      const currentDur = p.endSec - p.startSec;
      const nBeats = Math.max(1, Math.round(currentDur / beatInterval));
      const newDur = nBeats * beatInterval;
      // Center the new duration around the original midpoint
      const mid = (p.startSec + p.endSec) / 2;
      const newStart = mid - newDur / 2;
      const newEnd = mid + newDur / 2;
      if (Math.abs(newDur - currentDur) > 0.05) {
        newOverrides[p.index] = { startSec: newStart, endSec: newEnd };
        snappedCount++;
      }
    }
    setPickOverrides(newOverrides);
    return snappedCount;
  }, [activeSong, filteredPicks, payload, pickOverrides]);

  // ─── AI Attention Tracking: Claude evaluates narrative-flow per pick ───
  const analyzeNarrativeFlow = useCallback(async () => {
    if (flowBusy || filteredPicks.length === 0) return;
    setFlowBusy(true);
    setFlowError(null);
    const pickSummary = filteredPicks.map((p, i) => ({
      pos: i + 1,
      index: p.index,
      duration: p.durationSec,
      score: p.score,
      chapter: p.chapter ?? "?",
      topSignals: p.signals
        ? Object.entries(p.signals)
            .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
            .slice(0, 3)
            .map(([k, v]) => `${k}=${(v as number).toFixed(2)}`)
            .join(",")
        : "",
    }));
    const systemPrompt = `Du er en AI Creative Director som analyserer narrativ flyt i en wedding-highlight. Du skal evaluere hver pick i sekvensen og flagge hvor flyten er sterk vs problematisk.

Sekvens (i playback-rekkefølge):
${pickSummary.map(p => `  pos ${p.pos}: shot#${p.index} chapter=${p.chapter} ${p.duration.toFixed(2)}s, score=${p.score.toFixed(2)}, top-signals[${p.topSignals}]`).join("\n")}

Project: "${projectTitle}"
Total duration: ${formatTime(totalDuration)}
Main song: ${activeSong ? `${activeSong.title} (${activeSong.bpm ?? "?"} BPM)` : "(ingen)"}

Vurder hver pick ut fra:
  STRONG (grønn) = sterk narrativ flyt, treffer rytmen, gir energi/emosjon
  WEAK (rød) = svak narrativ energi, repetitivt, mister momentum, dårlig score
  DRAG (gul) = treg pacing, for langt, eller bryter flyt mellom segmenter

Vurder ALLE ${filteredPicks.length} picks og returner array med pickIndex (faktisk shot#), flowQuality, og kort norsk grunn (max 100 tegn).

Du MÅ kalle analyze_narrative_flow-tool med evaluations-array som inkluderer ALLE ${filteredPicks.length} picks.`;
    try {
      const resp: any = await invoke("claude_chat", {
        messages: [{ role: "user", content: `Analyser flyt i sekvensen. Kall analyze_narrative_flow-tool med alle ${filteredPicks.length} picks.` }],
        system: systemPrompt,
        model: "claude-opus-4-7",
        maxTokens: 2000,
        tools: [{
          name: "analyze_narrative_flow",
          description: "Evaluate narrative-flow quality for each pick in the sequence",
          input_schema: {
            type: "object",
            properties: {
              evaluations: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    pickIndex:   { type: "integer", description: "The shot#/index of this pick" },
                    flowQuality: { type: "string", enum: ["strong", "weak", "drag"] },
                    reason:      { type: "string", description: "Short Norwegian reason (<=100 chars)" },
                  },
                  required: ["pickIndex", "flowQuality", "reason"],
                },
              },
            },
            required: ["evaluations"],
          },
        }],
      });
      const blocks = resp?.content ?? [];
      const toolBlock = blocks.find((b: any) => b.type === "tool_use" && b.name === "analyze_narrative_flow");
      if (!toolBlock) {
        const txt = blocks.filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n");
        throw new Error(`Claude returnerte ikke tool-call. ${txt.slice(0, 150)}`);
      }
      const evals = (toolBlock.input?.evaluations ?? []) as FlowEval[];
      if (!evals.length) throw new Error("Claude returnerte tom evaluation-array");
      setFlowEvals(evals);
    } catch (e: any) {
      setFlowError(typeof e === "string" ? e : (e?.message ?? "Ukjent feil"));
    } finally {
      setFlowBusy(false);
    }
  }, [flowBusy, filteredPicks, projectTitle, totalDuration, activeSong]);

  // ─── Multi-agent: agent-personas med egne system-prompts ───
  const AGENT_PROFILES: Record<AgentRole, { name: string; icon: string; accent: string; systemPrompt: string }> = {
    claude: {
      name: "Claude",
      icon: "🌸",
      accent: "#c850e0",
      systemPrompt: `Du er Claude, en AI Creative Director som hjelper en wedding-film-redaktør lage emosjonelle highlights. Du følger redaktørens story-tankegang — IKKE bins/folders. Du gir korte, konkrete forslag (1-3 setninger) om pacing, emosjonell flyt, og narrativ struktur. Skriv på norsk. Du er kreativ partner, ikke chatbot.`,
    },
    vision: {
      name: "Vision Agent",
      icon: "👁",
      accent: "#4ad48a",
      systemPrompt: `Du er Vision Agent, en spesialisert AI for SHOT QUALITY-vurdering. Du analyserer framing, fokus, lyssetting, komposisjon, og teknisk kvalitet. Du gir konkrete tekniske observasjoner om hvilke shots holder cinematic standard og hvilke som er svake teknisk. Du foreslår color/exposure-justeringer, reframing, eller å erstatte tekniske svake shots. Skriv på norsk, vær teknisk men ikke nerd.`,
    },
    audio: {
      name: "Audio Agent",
      icon: "🎙",
      accent: "#f0a500",
      systemPrompt: `Du er Audio Agent, en spesialisert AI for LYD-spørsmål. Du analyserer talenes klarhet, behovet for vocal isolation, music sync, applaus-detektering, og emosjonelle audio-peaks (gråt/latter/jubel). Du foreslår hvilke speech-rich shots trenger cleanup, hvor musikk bygger best emosjonell drift, og hvor du mangler reaksjonsapplaus. Skriv på norsk, fokus på lyd-narrativ.`,
    },
    wedding: {
      name: "Wedding Agent",
      icon: "💍",
      accent: "#ef4f6f",
      systemPrompt: `Du er Wedding Agent, en spesialisert AI med dyp kunnskap om bryllups-tradisjoner. Du kjenner pakistansk/indisk bryllup (mehndi, sangeet, haldi, nikkah, walima, varmala, saat phere), kristne bryllup (vows, ring exchange, first kiss, cake-cutting), og norske bryllup (toastmaster, brudevals, bryllupsdrakter). Du flagger MANGLENDE viktige ritualer i sekvensen, og foreslår hvilke kulturelt viktige momenter som bør prioriteres. Skriv på norsk.`,
    },
  };

  // ─── Multi-agent chat: send message + receive reply ───
  const sendChat = useCallback(async (text: string) => {
    if (!text.trim() || chatBusy) return;
    const userMsg: ChatMsg = { role: "user", content: text.trim() };
    const nextMessages = [...chatHistory[agentRole], userMsg];
    setChatHistory(prev => ({ ...prev, [agentRole]: nextMessages }));
    setChatInput("");
    setChatBusy(true);
    setChatError(null);
    const ctxLines: string[] = [];
    ctxLines.push(`Project: "${projectTitle}"`);
    if (activeSong) ctxLines.push(`Main song: "${activeSong.title}" by ${activeSong.artist}${activeSong.bpm ? ` (${activeSong.bpm} BPM)` : ""}`);
    ctxLines.push(`Highlight length: ${formatTime(totalDuration)} (${filteredPicks.length} picks across ${segments.length} segments)`);
    ctxLines.push(`Segments included: ${Array.from(includedChapters).join(", ")}`);
    ctxLines.push(`Story balance: Romantikk ${balance.romantikk}%, Familie ${balance.familie}%, Detaljer ${balance.detaljer}%, Emosjon ${balance.emosjon}%, Energi ${balance.energi}%`);
    if (focusedPick) {
      ctxLines.push(`Currently focused: shot#${focusedPick.index} (${focusedPick.chapter || "?"}) — ${focusedPick.durationSec.toFixed(2)}s, score ${focusedPick.score.toFixed(3)}`);
    }
    const systemPrompt = `${AGENT_PROFILES[agentRole].systemPrompt}

Project-kontekst:
${ctxLines.join("\n")}`;
    try {
      const resp: any = await invoke("claude_chat", {
        messages: nextMessages.map(m => ({ role: m.role, content: m.content })),
        system: systemPrompt,
        model: "claude-opus-4-7",
        maxTokens: 600,
      });
      const blocks = resp?.content ?? [];
      const text = blocks
        .filter((b: any) => b.type === "text")
        .map((b: any) => b.text)
        .join("\n")
        .trim();
      if (text) {
        setChatHistory(prev => ({
          ...prev,
          [agentRole]: [...nextMessages, { role: "assistant", content: text }],
        }));
      } else {
        setChatError("Claude svarte tomt — prøv igjen.");
      }
    } catch (e: any) {
      setChatError(typeof e === "string" ? e : (e?.message ?? "Ukjent feil ved Claude-kall"));
    } finally {
      setChatBusy(false);
      setTimeout(() => {
        chatScrollRef.current?.scrollTo({ top: 999999, behavior: "smooth" });
      }, 50);
    }
  }, [chatBusy, agentRole, chatHistory, projectTitle, activeSong, totalDuration, filteredPicks.length, segments.length, includedChapters, balance, focusedPick]);

  if (loadError) {
    return (
      <div className="creative-editor-error">
        <h2>Kan ikke åpne Creative Editor</h2>
        <p>{loadError}</p>
        <p className="hint">Kjør først <code>extract_highlight_from_film</code> på en kildefil.</p>
        {onClose && <button onClick={onClose}>Lukk</button>}
      </div>
    );
  }

  if (!payload) {
    return <div className="creative-editor-loading">Laster picks…</div>;
  }

  return (
    <div className="creative-editor">
      {/* ─── Top header: logo + title + aspect + song + actions ─── */}
      <header className="ce-header">
        <div className="ce-logo">
          <div className="ce-logo-icon">K</div>
          <div className="ce-logo-text">CreatorHub</div>
        </div>
        <div className="ce-title-area">
          {editingTitle ? (
            <input
              type="text"
              className="ce-title-input"
              value={projectTitle}
              autoFocus
              onChange={(e) => setProjectTitle(e.target.value)}
              onBlur={() => setEditingTitle(false)}
              onKeyDown={(e) => { if (e.key === "Enter") setEditingTitle(false); }}
            />
          ) : (
            <div className="ce-title" onClick={() => setEditingTitle(true)}>
              {projectTitle} <span className="ce-title-edit">✎</span>
            </div>
          )}
        </div>
        <div className="ce-meta">
          <button className="ce-aspect" onClick={() => setAspectMenuOpen(v => !v)}>
            <span>📐</span> {aspectRatio}
            <span>▾</span>
          </button>
          {aspectMenuOpen && (
            <div className="ce-aspect-menu">
              {([
                { v: "16:9" as const, name: "Landscape", desc: "1920×1080 — TV/YouTube" },
                { v: "9:16" as const, name: "Reels / TikTok", desc: "1080×1920 — Instagram" },
                { v: "1:1"  as const, name: "Square", desc: "1080×1080 — feed-post" },
              ]).map(opt => (
                <div
                  key={opt.v}
                  className={`ce-aspect-item ${aspectRatio === opt.v ? "active" : ""}`}
                  onClick={() => { setAspectRatio(opt.v); setAspectMenuOpen(false); }}
                >
                  <div className="ce-aspect-item-name">{opt.v} — {opt.name}</div>
                  <div className="ce-aspect-item-desc">{opt.desc}</div>
                </div>
              ))}
            </div>
          )}
          <div style={{ position: "relative" }}>
            <button className="ce-aspect" onClick={() => setLookMenuOpen(v => !v)}>
              <span>🎨</span> {lookPack === "none" ? "Look" : lookPack}
              <span>▾</span>
            </button>
            {lookMenuOpen && (
              <div className="ce-aspect-menu">
                {([
                  { v: "none" as const,        name: "Ingen LUT",        desc: "Native color" },
                  { v: "norwedfilm" as const,  name: "Norwedfilm Look",  desc: "Cinematic warm" },
                  { v: "warm" as const,        name: "Warm Glow",        desc: "Mehndi/haldi-stil" },
                  { v: "cinematic" as const,   name: "Cinematic",        desc: "Film-emulering" },
                  { v: "documentary" as const, name: "Documentary",      desc: "Naturlig flat" },
                ]).map(opt => (
                  <div
                    key={opt.v}
                    className={`ce-aspect-item ${lookPack === opt.v ? "active" : ""}`}
                    onClick={() => { setLookPack(opt.v); setLookMenuOpen(false); }}
                  >
                    <div className="ce-aspect-item-name">{opt.name}</div>
                    <div className="ce-aspect-item-desc">{opt.desc}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button className="ce-song" onClick={() => setSongMenuOpen((v) => !v)}>
            <IconMusic size={14} /> {activeSong ? `${activeSong.title} – ${activeSong.artist}` : "Velg sang"}
            <span>▾</span>
          </button>
          {songMenuOpen && songs.length > 0 && (
            <div className="ce-song-menu">
              {songs.map((s, i) => (
                <div
                  key={`${s.title}-${i}`}
                  className={`ce-song-item ${i === activeSongIdx ? "active" : ""}`}
                  onClick={() => { setActiveSongIdx(i); setSongMenuOpen(false); }}
                >
                  <div className="ce-song-item-title">{s.title}</div>
                  <div className="ce-song-item-meta">
                    {s.artist} · {s.bpm ? `${s.bpm} BPM` : "—"} · {Math.round((s.percentOfMusic ?? 0))}% av film
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="ce-actions">
          <button
            className="ce-icon-mini"
            onClick={undo}
            disabled={!undoAvailable}
            title="Undo (⌘Z)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7v6h6" />
              <path d="M21 17a9 9 0 00-9-9 9 9 0 00-6.7 3L3 13" />
            </svg>
          </button>
          <button
            className="ce-icon-mini"
            onClick={redo}
            disabled={!redoAvailable}
            title="Redo (⇧⌘Z)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 7v6h-6" />
              <path d="M3 17a9 9 0 019-9 9 9 0 016.7 3L21 13" />
            </svg>
          </button>
          <button
            className="ce-icon-mini"
            onClick={() => setShortcutsOpen(true)}
            title="Hurtigtaster (?)"
            style={{ fontWeight: 700, fontSize: 13 }}
          >?</button>
          <button>↗ Del</button>
          <div className="ce-export-wrap">
            <button
              className="primary"
              onClick={() => setExportMenuOpen(v => !v)}
              disabled={exportBusy || !payload}
            >
              {exportBusy ? "⏳ Rendrer …" : "+ Eksporter ▾"}
            </button>
            {exportMenuOpen && !exportBusy && (
              <div className="ce-export-menu">
                {(["custom", "teaser", "instagram", "couple", "family", "full"] as ExportVariant[]).map(v => {
                  const preset = VARIANT_PRESETS[v];
                  return (
                    <button
                      key={v}
                      className="ce-export-item"
                      onClick={() => handleExport(v)}
                    >
                      <div className="ce-export-item-name">{preset.name}</div>
                      <div className="ce-export-item-desc">{preset.desc}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ─── Three-column body ─── */}
      <div className="ce-body">
        {/* ─── Left: segments + history balance ─── */}
        <aside className="ce-segments">
          <div className="ce-segments-header">
            <span>Segmenter <span className="ce-info">ⓘ</span></span>
            <button className="ce-segments-add">+ Legg til flere</button>
          </div>
          <div className="ce-segments-list">
            {segments.map((seg, i) => {
              const included = includedChapters.has(seg.chapter);
              const firstPick = seg.picks[0];
              return (
                <div
                  key={`${seg.chapter}-${i}`}
                  className={`ce-segment-card ${included ? "included" : ""} ${focusedPick && seg.picks.some(p => p.index === focusedPick.index) ? "focused" : ""}`}
                  onClick={() => {
                    const idx = filteredPicks.findIndex(p => p.index === firstPick.index);
                    if (idx >= 0) setFocusedPickIdx(idx);
                  }}
                  onMouseEnter={() => {
                    const idx = filteredPicks.findIndex(p => p.index === firstPick.index);
                    if (idx >= 0) {
                      setHoveredPickIdx(idx);
                      hoverStartedPlaybackRef.current = !!videoRef.current?.paused;
                      videoRef.current?.play().catch(() => {});
                    }
                  }}
                  onMouseLeave={() => {
                    setHoveredPickIdx(null);
                    // Bare pause hvis hover startet playback — ikke pause hvis bruker
                    // klikket play intensjonelt før hover.
                    if (hoverStartedPlaybackRef.current && videoRef.current) {
                      videoRef.current.pause();
                    }
                    hoverStartedPlaybackRef.current = false;
                  }}
                >
                  <div className="ce-segment-num">{i + 1}</div>
                  <div className="ce-segment-thumb">
                    {firstPick.thumbnailPath
                      ? <img src={convertFileSrc(firstPick.thumbnailPath)} alt="" />
                      : <div className="ce-segment-thumb-placeholder">{seg.display.emoji}</div>}
                  </div>
                  <div className="ce-segment-info">
                    <div className="ce-segment-label">{seg.display.label}</div>
                    <div className="ce-segment-time">
                      {formatTime(seg.startSec)} – {formatTime(seg.endSec)}
                    </div>
                    <div className="ce-segment-dur">{formatTime(seg.duration)}</div>
                  </div>
                  <button
                    className={`ce-segment-check ${included ? "on" : ""}`}
                    onClick={(e) => { e.stopPropagation(); toggleChapter(seg.chapter); }}
                  >
                    {included && <IconCheck size={12} />}
                  </button>
                </div>
              );
            })}
          </div>

          {/* History balance — computed from real signal scores */}
          <div className="ce-balance">
            <div className="ce-balance-header">
              <span>Historiebalanse</span>
              <span className="ce-balance-tag">Bra balanse!</span>
            </div>
            <div className="ce-balance-bars">
              <BalanceRow color="#ef4f6f" icon="❤️" label="Romantikk" pct={balance.romantikk} />
              <BalanceRow color="#f0a500" icon="👨‍👩‍👧" label="Familie" pct={balance.familie} />
              <BalanceRow color="#a030c0" icon="💍" label="Detaljer" pct={balance.detaljer} />
              <BalanceRow color="#6e3fc7" icon="✨" label="Emosjon" pct={balance.emosjon} />
              <BalanceRow color="#4ad48a" icon="⚡" label="Energi" pct={balance.energi} />
            </div>
          </div>

          {onClose && (
            <button className="ce-back" onClick={onClose}>
              <IconChevronLeft size={14} /> Tilbake til prosjekter
            </button>
          )}
        </aside>

        {/* ─── Center: tabs + preview + status + timeline + audio + toolbar ─── */}
        <main className="ce-main">
          <div className="ce-tabs">
            <button className={`ce-tab ${activeTab === "rediger" ? "active" : ""}`} onClick={() => setActiveTab("rediger")}>Rediger</button>
            <button className={`ce-tab ${activeTab === "story" ? "active" : ""}`} onClick={() => setActiveTab("story")}>Story</button>
          </div>

          {/* Live preview */}
          <div
            className="ce-preview-wrap"
            style={{
              aspectRatio: aspectRatio === "16:9" ? "16 / 9"
                : aspectRatio === "9:16" ? "9 / 16"
                : "1 / 1",
              maxHeight: aspectRatio === "9:16" ? "70vh" : "none",
              maxWidth: aspectRatio === "9:16" ? "40vh" : aspectRatio === "1:1" ? "60vh" : "none",
              margin: aspectRatio !== "16:9" ? "0 auto" : "0",
            }}
          >
            <video
              ref={videoRef}
              src={videoSrc}
              className="ce-preview-video"
              style={{
                filter: mood.filter + lookFilter,
                transition: "filter 0.6s cubic-bezier(.4,0,.2,1)",
              }}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              playsInline
              muted={false}
            />
            <div className="ce-preview-overlay">
              <div className="ce-preview-tag">
                <span className="ce-live-dot" /> Live preview
              </div>
            </div>
            <div
              className="ce-mood-tag"
              style={{
                background: `linear-gradient(135deg, ${mood.accent}40, ${mood.accent}20)`,
                borderColor: `${mood.accent}80`,
                color: mood.accent,
              }}
            >
              <span className="ce-mood-dot" style={{ background: mood.accent }} />
              {mood.label}
            </div>
            <div className="ce-preview-controls">
              <div className="ce-preview-scrubber" />
              <div className="ce-preview-row">
                <button className="ce-icon-btn" onClick={togglePlay}>
                  {isPlaying ? "⏸" : <IconPlay size={16} />}
                </button>
                <button className="ce-icon-btn" onClick={() => focusedPickIdx > 0 && setFocusedPickIdx(focusedPickIdx - 1)}>
                  ◁
                </button>
                <button className="ce-icon-btn" onClick={() => focusedPickIdx < filteredPicks.length - 1 && setFocusedPickIdx(focusedPickIdx + 1)}>
                  ▷
                </button>
                <button className="ce-icon-btn">🔊</button>
                <div className="ce-preview-time">
                  {formatTime(currentTime)} / {focusedPick ? formatTime(focusedPick.durationSec) : "00:00"}
                </div>
                <div className="ce-spacer" />
                <button
                  className="ce-icon-btn"
                  onClick={() => setLoopMode(m => m === "pick" ? "full" : "pick")}
                  title={loopMode === "pick" ? "Loop kun focused pick (klikk → spill hele filmen)" : "Spiller hele filmen (klikk → loop pick)"}
                  style={{
                    background: loopMode === "full" ? "rgba(74, 212, 138, 0.20)" : undefined,
                    color: loopMode === "full" ? "#4ad48a" : undefined,
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "0 8px",
                    minWidth: 56,
                  }}
                >
                  {loopMode === "pick" ? "🔁 Loop" : "▶ Hele"}
                </button>
                <button className="ce-icon-btn" onClick={cyclePlayRate}>{playRate}x</button>
                <button className="ce-icon-btn">⛶</button>
              </div>
            </div>
          </div>

          {/* Claude status bar — wired to real actions */}
          <div className="ce-claude-status">
            <div className="ce-claude-status-icon"><IconSparkle size={14} /></div>
            <div className="ce-claude-status-text">
              {suggBusy ? "Claude analyserer sekvensen …"
                : suggestions.length > 0 ? `Claude har ${suggestions.length} forslag klare`
                : "Claude ser på tidslinjen din"}
              <span className="ce-collab"> ● Samarbeider</span>
            </div>
            <button
              className="ce-claude-ask"
              onClick={analyzeNarrativeFlow}
              disabled={flowBusy}
            >
              {flowBusy ? "🔍 Analyserer …" : "🔍 Analyser flyt"}
            </button>
            <button
              className="ce-claude-suggest"
              onClick={fetchSuggestions}
              disabled={suggBusy}
            >
              {suggBusy ? "✨ Henter …" : <>✨ {suggestions.length > 0 ? "Oppdater" : "Hent"} forslag {suggestions.length > 0 && <span className="ce-badge">{suggestions.length}</span>}</>}
            </button>
          </div>

          {/* Timeline strip */}
          <div className="ce-timeline">
            {/* Music-Driven Flow Map — beat structure, sections, RMS, drops, silence, spectral */}
            <div className="ce-flowmap-header">
              <button
                className="ce-flowmap-toggle"
                onClick={() => setFlowMapOpen(v => !v)}
              >
                {flowMapOpen ? "▼" : "▶"} Music Flow Map ({musicFlow ? `${musicFlow.tempo} BPM · ${musicFlow.sections.length} seksjoner · ${musicFlow.drops.length} drops` : musicFlowBusy ? "analyserer…" : "ingen sang"})
              </button>
            </div>
            {flowMapOpen && musicFlow && (
              <div className="ce-flowmap">
                {/* Section bands (chorus/verse/drop/etc.) */}
                <div className="ce-flowmap-layer">
                  <div className="ce-flowmap-label" style={{ color: "#c850e0" }}>
                    <span style={{ background: "#c850e0" }} className="ce-flowmap-dot" />
                    Sections
                  </div>
                  <div className="ce-flowmap-sections">
                    {musicFlow.sections.map((sec, i) => {
                      const colors: Record<string, string> = {
                        intro: "#4ad48a", verse: "#6e3fc7", chorus: "#c850e0",
                        drop: "#ef4f6f", bridge: "#f0a500", outro: "#8674a8", song: "#a030c0",
                      };
                      const color = colors[sec.label] ?? "#a030c0";
                      return (
                        <div
                          key={i}
                          className="ce-flowmap-section"
                          style={{
                            left: `${(sec.startSec / musicFlow.duration) * 100}%`,
                            width: `${((sec.endSec - sec.startSec) / musicFlow.duration) * 100}%`,
                            background: color + "40", borderColor: color,
                            color: color,
                          }}
                          title={`${sec.label} (${sec.startSec.toFixed(1)}-${sec.endSec.toFixed(1)}s, RMS ${sec.rms.toFixed(2)})`}
                        >
                          {sec.label}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* RMS energy curve */}
                <div className="ce-flowmap-layer">
                  <div className="ce-flowmap-label" style={{ color: "#a030c0" }}>
                    <span style={{ background: "#a030c0" }} className="ce-flowmap-dot" />
                    RMS-energi
                  </div>
                  <svg className="ce-flowmap-svg" viewBox="0 0 1000 38" preserveAspectRatio="none">
                    {(() => {
                      const w = 1000, h = 38;
                      const points = musicFlow.rms.map(pt =>
                        `${(pt.t / musicFlow.duration) * w},${h - (pt.value * h * 0.85)}`
                      );
                      if (points.length === 0) return null;
                      const fillPath = `M 0,${h} L ${points.join(" L ")} L ${w},${h} Z`;
                      return (
                        <>
                          <path d={fillPath} fill="#a030c0" fillOpacity="0.20" />
                          <path d={`M ${points.join(" L ")}`} fill="none" stroke="#a030c0"
                                strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </>
                      );
                    })()}
                    {/* Drops marked with red dots */}
                    {musicFlow.drops.map((d, i) => {
                      const x = (d.t / musicFlow.duration) * 1000;
                      const y = 38 - (d.intensity * 38 * 0.85);
                      return <circle key={i} cx={x} cy={y} r="3" fill="#ef4f6f"
                                     stroke="white" strokeWidth="0.5" />;
                    })}
                  </svg>
                </div>

                {/* Spectral centroid (brightness) */}
                <div className="ce-flowmap-layer">
                  <div className="ce-flowmap-label" style={{ color: "#f0a500" }}>
                    <span style={{ background: "#f0a500" }} className="ce-flowmap-dot" />
                    Brightness
                  </div>
                  <svg className="ce-flowmap-svg" viewBox="0 0 1000 38" preserveAspectRatio="none">
                    {(() => {
                      const w = 1000, h = 38;
                      const points = musicFlow.spectralCentroid.map(pt =>
                        `${(pt.t / musicFlow.duration) * w},${h - (pt.value * h * 0.85)}`
                      );
                      if (points.length === 0) return null;
                      const fillPath = `M 0,${h} L ${points.join(" L ")} L ${w},${h} Z`;
                      return (
                        <>
                          <path d={fillPath} fill="#f0a500" fillOpacity="0.15" />
                          <path d={`M ${points.join(" L ")}`} fill="none" stroke="#f0a500"
                                strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </>
                      );
                    })()}
                  </svg>
                </div>

                {/* Beat grid + silence */}
                <div className="ce-flowmap-layer">
                  <div className="ce-flowmap-label" style={{ color: "#4ad48a" }}>
                    <span style={{ background: "#4ad48a" }} className="ce-flowmap-dot" />
                    Beats ({musicFlow.tempo} BPM)
                  </div>
                  <svg className="ce-flowmap-svg" viewBox="0 0 1000 38" preserveAspectRatio="none">
                    {/* Silence regions (gray boxes) */}
                    {musicFlow.silence.map((s, i) => {
                      const x = (s.startSec / musicFlow.duration) * 1000;
                      const w = ((s.endSec - s.startSec) / musicFlow.duration) * 1000;
                      return <rect key={i} x={x} y={0} width={w} height={38}
                                   fill="rgba(134, 116, 168, 0.30)" />;
                    })}
                    {/* Beats */}
                    {musicFlow.beats.map((b, i) => {
                      const x = (b / musicFlow.duration) * 1000;
                      const isDownbeat = i % 4 === 0;
                      return (
                        <line key={i} x1={x} y1={isDownbeat ? 4 : 12} x2={x} y2={34}
                              stroke={isDownbeat ? "#4ad48a" : "rgba(74, 212, 138, 0.4)"}
                              strokeWidth={isDownbeat ? "1.2" : "0.6"} />
                      );
                    })}
                  </svg>
                </div>
              </div>
            )}
            {flowMapOpen && !musicFlow && !musicFlowBusy && (
              <div className="ce-flowmap" style={{ padding: 24, textAlign: "center", color: "#8674a8", fontSize: 11.5 }}>
                Velg en sang i header (Music-meny) for å analysere musikk-flow.
              </div>
            )}

            {/* Story Arc overlay — emotional curve fra signals */}
            {storyArcPoints.length > 1 && storyArcPhases && (
              <div className="ce-story-arc">
                <svg className="ce-story-arc-svg" viewBox={`0 0 1000 60`} preserveAspectRatio="none">
                  {/* Phase backgrounds */}
                  <rect x="0" y="0" width={(storyArcPhases.introEnd / storyArcPhases.totalDur) * 1000} height="60"
                        fill="rgba(110, 63, 199, 0.05)" />
                  <rect x={(storyArcPhases.introEnd / storyArcPhases.totalDur) * 1000} y="0"
                        width={((storyArcPhases.buildEnd - storyArcPhases.introEnd) / storyArcPhases.totalDur) * 1000} height="60"
                        fill="rgba(240, 165, 0, 0.06)" />
                  <rect x={(storyArcPhases.buildEnd / storyArcPhases.totalDur) * 1000} y="0"
                        width={((storyArcPhases.outroStart - storyArcPhases.buildEnd) / storyArcPhases.totalDur) * 1000} height="60"
                        fill="rgba(239, 79, 111, 0.08)" />
                  <rect x={(storyArcPhases.outroStart / storyArcPhases.totalDur) * 1000} y="0"
                        width={((storyArcPhases.totalDur - storyArcPhases.outroStart) / storyArcPhases.totalDur) * 1000} height="60"
                        fill="rgba(74, 212, 138, 0.04)" />
                  {/* Energy curve */}
                  <path
                    d={(() => {
                      const w = 1000, h = 60;
                      const points = storyArcPoints.map(pt => {
                        const x = (pt.midSec / storyArcPhases.totalDur) * w;
                        const y = h - (pt.energy * h * 0.85);
                        return `${x},${y}`;
                      });
                      return `M ${points.join(" L ")}`;
                    })()}
                    fill="none"
                    stroke="rgba(200, 80, 224, 0.85)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* Filled area under curve */}
                  <path
                    d={(() => {
                      const w = 1000, h = 60;
                      const points = storyArcPoints.map(pt => {
                        const x = (pt.midSec / storyArcPhases.totalDur) * w;
                        const y = h - (pt.energy * h * 0.85);
                        return `${x},${y}`;
                      });
                      const first = storyArcPoints[0].midSec / storyArcPhases.totalDur * w;
                      const last = storyArcPoints[storyArcPoints.length-1].midSec / storyArcPhases.totalDur * w;
                      return `M ${first},${h} L ${points.join(" L ")} L ${last},${h} Z`;
                    })()}
                    fill="url(#arcGradient)"
                  />
                  <defs>
                    <linearGradient id="arcGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(200, 80, 224, 0.40)" />
                      <stop offset="100%" stopColor="rgba(200, 80, 224, 0.00)" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="ce-story-arc-labels">
                  <span style={{ left: "5%" }}>↑ Intro</span>
                  <span style={{ left: "35%" }}>↑ Build</span>
                  <span style={{ left: `${(storyArcPhases.peakTime / storyArcPhases.totalDur) * 100}%`,
                                  color: "#ef4f6f" }}>⚡ Peak</span>
                  <span style={{ left: "85%" }}>↓ Outro</span>
                </div>
              </div>
            )}

            <div className="ce-timeline-ruler">
              {[0, 30, 60, 90, 120, 150, 180].map((t) => (
                <div key={t} className="ce-timeline-tick" style={{ left: `${(t / totalDuration) * 100}%` }}>
                  {formatTime(t)}
                </div>
              ))}
              {/* Timeline markers */}
              {markers.map(m => {
                const arcPt = storyArcPoints.find(p => p.startSec <= m.timeSec && p.endSec >= m.timeSec) ?? storyArcPoints[0];
                const relTime = arcPt ? (arcPt.midSec / (storyArcPhases?.totalDur || 1)) * 100 : 0;
                return (
                  <div
                    key={m.id}
                    className="ce-timeline-marker"
                    style={{ left: `${relTime}%`, borderColor: m.color }}
                    onClick={() => setEditingMarkerId(m.id)}
                    title={`${m.label}${m.comment ? ' — ' + m.comment : ''}`}
                  >
                    <div className="ce-timeline-marker-flag" style={{ background: m.color }}>{m.label}</div>
                  </div>
                );
              })}
            </div>
            <div className="ce-timeline-strip">
              {filteredPicks.slice(0, 12).map((p, i) => {
                const segIdx = segments.findIndex(s => s.picks.some(x => x.index === p.index));
                const flowEval = flowEvals.find(f => f.pickIndex === p.index);
                const transKey = i > 0 ? `${i-1}-${i}` : null;
                const transType = transKey ? (pickTransitions[transKey] ?? "fade") : null;
                const sigs = p.signals ?? {};
                const hasComment = !!pickComments[p.index];
                return (
                  <Fragment key={p.index}>
                    {/* Transition picker between clips */}
                    {i > 0 && transKey && (
                      <div className="ce-trans-slot">
                        <button
                          className="ce-trans-btn"
                          title={`Overgang: ${transType}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setTransitionMenuFor(transitionMenuFor === transKey ? null : transKey);
                          }}
                        >
                          {transType === "cut" ? "│" :
                           transType === "fade" ? "▶" :
                           transType === "dissolve" ? "◈" :
                           transType === "wipeleft" ? "◀" :
                           transType === "fadeblack" ? "●" :
                           transType === "fadewhite" ? "○" : "▶"}
                        </button>
                        {transitionMenuFor === transKey && (
                          <div className="ce-trans-menu">
                            {(["cut","fade","dissolve","wipeleft","fadeblack","fadewhite"] as TransitionType[]).map(t => (
                              <button
                                key={t}
                                className={`ce-trans-item ${transType === t ? "active" : ""}`}
                                onClick={() => setTransition(i-1, i, t)}
                              >
                                {t === "cut" ? "│ Cut" :
                                 t === "fade" ? "▶ Fade" :
                                 t === "dissolve" ? "◈ Dissolve" :
                                 t === "wipeleft" ? "◀ Wipe-left" :
                                 t === "fadeblack" ? "● Fade-to-black" :
                                 "○ Fade-to-white"}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    <div
                      className={`ce-timeline-clip ${i === focusedPickIdx ? "active" : ""} ${draggedPickIdx === i ? "dragging" : ""}`}
                      draggable
                      onClick={() => setFocusedPickIdx(i)}
                      onDragStart={(e) => {
                        setDraggedPickIdx(i);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (draggedPickIdx !== null) reorderPicks(draggedPickIdx, i);
                        setDraggedPickIdx(null);
                      }}
                      onDragEnd={() => setDraggedPickIdx(null)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setEditingCommentPick(p.index);
                      }}
                    >
                      <div className="ce-timeline-clip-num">{segIdx + 1}</div>
                      {p.thumbnailPath && <img src={convertFileSrc(p.thumbnailPath)} alt="" />}
                      <div className="ce-timeline-clip-dur">{p.durationSec.toFixed(2)}</div>
                      {/* Shot Intelligence — small indicator icons */}
                      <div className="ce-clip-intel">
                        {(sigs.bokeh ?? 0) > 0.5 && <span title="Shallow DOF / bokeh">◯</span>}
                        {(sigs.slowmo ?? 0) > 0.5 && <span title="Slow-motion">⏱</span>}
                        {(sigs.faces ?? 0) > 0.5 && <span title="Faces detected">😊</span>}
                        {(sigs.pose ?? 0) > 0.5 && <span title="Pose: embrace/dance/raise">🤝</span>}
                        {(sigs.action ?? 0) > 0.5 && <span title="High action">⚡</span>}
                        {(sigs.emotional_peak ?? 0) > 0.4 && <span title="Emotional peak">💗</span>}
                        {(sigs.audio_events ?? 0) > 0.5 && <span title="Audio event (applaus/latter)">🔊</span>}
                      </div>
                      {hasComment && (
                        <div className="ce-clip-comment-badge" title={pickComments[p.index]}>💬</div>
                      )}
                      {flowEval && (
                        <div
                          className={`ce-flow-marker ce-flow-${flowEval.flowQuality}`}
                          onMouseEnter={() => setHoveredFlowPickIdx(p.index)}
                          onMouseLeave={() => setHoveredFlowPickIdx(null)}
                        >
                          {hoveredFlowPickIdx === p.index && (
                            <div className="ce-flow-tooltip">
                              <strong>{flowEval.flowQuality === "strong" ? "Sterk flyt" : flowEval.flowQuality === "weak" ? "Svak energi" : "Treg pacing"}</strong>
                              <div>{flowEval.reason}</div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </Fragment>
                );
              })}
            </div>
            {flowEvals.length > 0 && (
              <div className="ce-flow-summary">
                <span className="ce-flow-dot ce-flow-strong" /> Sterk flyt ({flowEvals.filter(f=>f.flowQuality==="strong").length})
                <span className="ce-flow-dot ce-flow-drag" /> Treg pacing ({flowEvals.filter(f=>f.flowQuality==="drag").length})
                <span className="ce-flow-dot ce-flow-weak" /> Svak energi ({flowEvals.filter(f=>f.flowQuality==="weak").length})
                <button className="ce-flow-clear" onClick={() => setFlowEvals([])}>Nullstill</button>
              </div>
            )}
          </div>

          {/* Audio waveform — Phase 4 will compute real waveform from song WAV */}
          <div className="ce-audio">
            <div className="ce-audio-icon">🎵</div>
            <div className="ce-audio-title">
              {activeSong ? `${activeSong.title} – ${activeSong.artist}` : "(Ingen sang valgt)"}
            </div>
            <div className="ce-audio-wave">
              <RealWaveform
                wavPath={songWavPath(activeSong?.title, activeSong?.artist)}
                bars={120}
                active={isPlaying}
              />
            </div>
            <button
              className="ce-audio-add-btn"
              onClick={addCustomAudio}
              title="Legg til egen lyd"
            >+ Lyd</button>
            <button
              className="ce-audio-add-btn"
              onClick={() => addMarkerAtPlayhead()}
              title="Sett markør (M)"
            >+ Markør</button>
          </div>

          {/* Custom audio tracks */}
          {customAudios.map((audio) => (
            <div key={audio.id} className="ce-audio ce-audio-custom">
              <div className="ce-audio-icon">🎙</div>
              <div className="ce-audio-title">{audio.name}</div>
              <div className="ce-audio-wave">
                <RealWaveform wavPath={audio.path} bars={120} active={isPlaying} />
              </div>
              <input
                type="range" min="0" max="1" step="0.05"
                value={audio.volume}
                onChange={(e) => updateCustomAudio(audio.id, { volume: parseFloat(e.target.value) })}
                title={`Volum ${Math.round(audio.volume * 100)}%`}
                style={{ width: 60 }}
              />
              <button
                className="ce-audio-add-btn"
                onClick={() => removeCustomAudio(audio.id)}
                title="Fjern audio-spor"
              >✕</button>
            </div>
          ))}

          <div className="ce-duration">
            <span>Varighet valgt: <strong>{formatTime(totalDuration)}</strong></span>
            <span className="ce-spacer" />
            <span className="ce-muted">Estimert ferdig: ~{Math.ceil(totalDuration / 60)} min</span>
          </div>

          {/* Toolbar */}
          <div className="ce-toolbar">
            <ToolButton icon="✂" label="Trim" active={trimMode} onClick={() => setTrimMode(v => !v)} />
            <ToolButton icon="⚙" label="Juster" />
            <ToolButton icon="◇" label="Overganger" />
            <ToolButton icon="🎨" label="Farge" />
            <ToolButton icon="📐" label="Stabilisering" />
            <ToolButton icon="…" label="Mer" />
          </div>

          {/* Trim panel — appears below toolbar when Trim is active */}
          {trimMode && focusedPick && (
            <TrimPanel
              pick={focusedPick}
              originalPick={payload.picks.find(p => p.index === focusedPick.index)}
              bpm={activeSong?.bpm}
              snapToBeat={snapToBeat}
              onSnapToggle={() => setSnapToBeat(v => !v)}
              onChange={(s, e) => applyTrim(focusedPick.index, s, e)}
              onReset={() => setPickOverrides(prev => {
                const next = { ...prev };
                delete next[focusedPick.index];
                return next;
              })}
              onSnapAll={snapAllToBeats}
            />
          )}

          {/* Export result/error banner */}
          {exportResult && (
            <div className="ce-export-result">
              ✅ Highlight rendret ({formatTime(exportResult.durationSec)}):
              <code>{exportResult.outputPath}</code>
              <button onClick={() => setExportResult(null)}>×</button>
            </div>
          )}
          {exportError && (
            <div className="ce-export-error">
              ⚠ Eksport feilet: {exportError}
              <button onClick={() => setExportError(null)}>×</button>
            </div>
          )}
        </main>

        {/* ─── Right: Claude assistant + agent-tabs ─── */}
        <aside
          className="ce-claude"
          style={{ borderColor: AGENT_PROFILES[agentRole].accent + "60" }}
        >
          <div className="ce-claude-header">
            <span className="ce-claude-icon">{AGENT_PROFILES[agentRole].icon}</span>
            <span className="ce-claude-name" style={{ color: AGENT_PROFILES[agentRole].accent }}>
              {AGENT_PROFILES[agentRole].name}
            </span>
            <span className="ce-claude-beta">BETA</span>
            <button className="ce-claude-close">✕</button>
          </div>

          {/* Agent tabs */}
          <div className="ce-agent-tabs">
            {(["claude", "vision", "audio", "wedding"] as AgentRole[]).map(role => {
              const profile = AGENT_PROFILES[role];
              const isActive = agentRole === role;
              return (
                <button
                  key={role}
                  className={`ce-agent-tab ${isActive ? "active" : ""}`}
                  style={{
                    ...(isActive && {
                      background: `linear-gradient(135deg, ${profile.accent}30, ${profile.accent}15)`,
                      borderColor: profile.accent + "80",
                      color: profile.accent,
                    }),
                  }}
                  title={profile.systemPrompt.split(".")[0]}
                  onClick={() => setAgentRole(role)}
                >
                  <span className="ce-agent-tab-icon">{profile.icon}</span>
                  <span className="ce-agent-tab-name">{profile.name}</span>
                  {chatHistory[role].length > 0 && (
                    <span className="ce-agent-tab-badge">{chatHistory[role].filter(m => m.role === "assistant").length}</span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="ce-claude-banner">
            <div className="ce-claude-banner-title">Claude analyserer klippene dine</div>
            <div className="ce-claude-banner-subtitle">
              Jeg sjekker flyt, rytme og emosjon for å lage den beste historien.
            </div>
            <div className="ce-claude-progress">
              <div className="ce-claude-progress-fill" style={{ width: "82%" }} />
            </div>
            <div className="ce-claude-progress-pct">82%</div>
          </div>

          {/* Agent-specific action panels */}
          {agentRole === "audio" && (
            <div className="ce-agent-actions">
              <div className="ce-agent-actions-title">🎙 Audio-tools</div>
              {([
                { id: "isolate_vocals", icon: "🎤", label: "Isoler vocals (Demucs)" },
                { id: "duck_music", icon: "🔉", label: "Auto-duck musikk" },
                { id: "transcribe", icon: "📝", label: "Transcribe taler (WhisperX)" },
                { id: "normalize_loudness", icon: "📊", label: "Loudness -16 LUFS" },
              ] as { id: AudioAction; icon: string; label: string }[]).map(a => (
                <div key={a.id} className="ce-agent-action-row">
                  <button
                    className="ce-agent-action-btn"
                    disabled={audioActionBusy !== null}
                    onClick={() => runAudioAction(a.id)}
                  >
                    <span>{audioActionBusy === a.id ? "⏳" : a.icon}</span>
                    {a.label}
                  </button>
                  {audioActionResults[a.id] && (
                    <div className="ce-agent-action-result">{audioActionResults[a.id]}</div>
                  )}
                </div>
              ))}
            </div>
          )}
          {agentRole === "vision" && (
            <div className="ce-agent-actions">
              <div className="ce-agent-actions-title">👁 Vision-tools</div>
              <button
                className="ce-agent-action-btn"
                disabled={qualityBusy}
                onClick={runQualityCheck}
              >
                {qualityBusy ? "⏳ Sjekker shots…" : "🔍 Sjekk teknisk kvalitet (eksponering + WB)"}
              </button>
              {qualityFlags.length > 0 && (
                <div className="ce-agent-action-result">
                  ✓ Sjekket {qualityFlags.length} picks · {qualityFlags.filter(f => f.severity !== "ok").length} med advarsler
                </div>
              )}
            </div>
          )}

          {/* Client Wishes — bride/groom natural-language input */}
          <div className="ce-wishes">
            <div className="ce-wishes-header">
              <span>💬 Wishes fra paret</span>
              {wishesResult && (
                <button className="ce-wishes-clear" onClick={() => {
                  setActivePickOrder(null);
                  setPickOverrides({});
                  setWishesResult(null);
                }}>Angre</button>
              )}
            </div>
            <textarea
              className="ce-wishes-input"
              placeholder='F.eks. "mer av pappa sin tale", "kortere reception", "fokuser på følelser"'
              rows={2}
              value={clientWishes}
              onChange={e => setClientWishes(e.target.value)}
              disabled={wishesBusy}
            />
            <button
              className="ce-wishes-apply"
              onClick={applyWishes}
              disabled={wishesBusy || !clientWishes.trim() || filteredPicks.length === 0}
            >
              {wishesBusy ? "🎬 Anvender ønsker…" : "🎬 Anvend ønsker"}
            </button>
            {wishesResult && (
              <div className="ce-wishes-result">
                <div className="ce-wishes-interpretation">
                  <strong>Forsto:</strong> {wishesResult.interpretation}
                </div>
                <div className="ce-wishes-changes">
                  ✓ {wishesResult.changesSummary}
                </div>
                <div className="ce-wishes-rationale">{wishesResult.rationale}</div>
              </div>
            )}
            {wishesError && <div className="ce-claude-alt-error">⚠ {wishesError}</div>}
          </div>

          <button
            className="ce-claude-flow-btn"
            onClick={analyzeNarrativeFlow}
            disabled={flowBusy || filteredPicks.length === 0}
          >
            {flowBusy ? <>🔍 Analyserer flyt …</> : <>🔍 Analyser narrativ flyt</>}
          </button>
          {flowError && <div className="ce-claude-alt-error">⚠ {flowError}</div>}

          <div className="ce-claude-alt">
            <button
              className="ce-claude-alt-btn"
              onClick={() => setAltMenuOpen((v) => !v)}
              disabled={altBusy !== null}
            >
              {altBusy ? <>✨ Genererer {altBusy}-versjon…</> : <>✨ Generate Alternate Edit ▾</>}
            </button>
            {altMenuOpen && (
              <div className="ce-claude-alt-menu">
                {(["cinematic","emotional","social","luxury","documentary"] as AltVariant[]).map(v => (
                  <button
                    key={v}
                    className="ce-claude-alt-item"
                    onClick={() => generateAlternate(v)}
                  >
                    <div className="ce-claude-alt-item-name">{v.charAt(0).toUpperCase()+v.slice(1)}</div>
                    <div className="ce-claude-alt-item-desc">
                      {v === "cinematic"   && "Slow, atmosfærisk, lange holds"}
                      {v === "emotional"   && "Tårer, klem, latter — nærhet"}
                      {v === "social"      && "Kort, kvikk, beat-matchet"}
                      {v === "luxury"      && "Elegant, portretter, detaljer"}
                      {v === "documentary" && "Naturlig kronologi, vitnespor"}
                    </div>
                  </button>
                ))}
              </div>
            )}
            {altRationale && (
              <div className="ce-claude-alt-rationale">
                <strong>{altRationale.variant.charAt(0).toUpperCase()+altRationale.variant.slice(1)}:</strong>{" "}
                {altRationale.text}
                <button
                  className="ce-claude-alt-clear"
                  onClick={() => { setActivePickOrder(null); setAltRationale(null); }}
                >
                  Tilbakestill
                </button>
              </div>
            )}
            {altError && <div className="ce-claude-alt-error">⚠ {altError}</div>}
          </div>

          <div className="ce-claude-suggestions">
            <div className="ce-claude-suggest-header">
              <span>Forslag {suggestions.length > 0 && `(${suggestions.length})`}</span>
              <button
                className="ce-claude-accept-all"
                onClick={fetchSuggestions}
                disabled={suggBusy}
              >
                {suggBusy ? "Henter…" : suggestions.length > 0 ? "Hent på nytt" : "Hent forslag"}
              </button>
            </div>
            {suggError && <div className="ce-claude-alt-error">⚠ {suggError}</div>}
            {!suggBusy && suggestions.length === 0 && !suggError && (
              <div className="ce-suggest-empty">
                Klikk "Hent forslag" så analyserer Claude sekvensen og gir 3 konkrete forbedringer.
              </div>
            )}
            {suggestions.map((s, i) => {
              const targetPick = filteredPicks.find(p => p.index === s.targetPickIndex);
              const actionLabel = {
                focus: "Vis klipp",
                trim:  "Juster lengde",
                skip:  "Fjern",
                promote: "Flytt frem",
              }[s.action];
              return (
                <SuggestionCard
                  key={`${s.targetPickIndex}-${i}`}
                  thumb={targetPick?.thumbnailPath}
                  title={s.title}
                  desc={s.description}
                  primaryLabel={actionLabel}
                  secondaryLabel="Se klipp"
                  onPrimary={() => applySuggestion(s)}
                  onSecondary={() => {
                    const idx = filteredPicks.findIndex(p => p.index === s.targetPickIndex);
                    if (idx >= 0) setFocusedPickIdx(idx);
                  }}
                />
              );
            })}
          </div>

          <div className="ce-claude-chat">
            <div className="ce-claude-chat-title">Chat med Claude</div>
            <div className="ce-claude-msgs" ref={chatScrollRef}>
              {chatMessages.length === 0 && (
                <div className="ce-claude-empty">
                  Spør Claude om historiens flyt, pacing, eller alternative cuts.
                </div>
              )}
              {chatMessages.map((m, i) => (
                <div key={i} className={`ce-claude-msg ce-claude-msg-${m.role}`}>
                  {m.content}
                </div>
              ))}
              {chatBusy && (
                <div className="ce-claude-msg ce-claude-msg-assistant ce-claude-msg-typing">
                  <span /><span /><span />
                </div>
              )}
              {chatError && (
                <div className="ce-claude-msg ce-claude-msg-error">
                  ⚠ {chatError}
                </div>
              )}
            </div>
            <form
              className="ce-claude-input-row"
              onSubmit={(e) => { e.preventDefault(); sendChat(chatInput); }}
            >
              <input
                className="ce-claude-input"
                placeholder={chatBusy ? "Claude tenker…" : "Skriv melding til Claude …"}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                disabled={chatBusy}
              />
              <button
                type="submit"
                className="ce-claude-send"
                disabled={chatBusy || !chatInput.trim()}
              >
                ▸
              </button>
            </form>
            <div className="ce-claude-warning">
              Claude kan ta feil. Dobbeltsjekk viktige detaljer.
            </div>
          </div>
        </aside>
      </div>

      {/* Marker edit modal */}
      {editingMarkerId && (() => {
        const m = markers.find(x => x.id === editingMarkerId);
        if (!m) return null;
        return (
          <div className="ce-shortcuts-backdrop" onClick={() => setEditingMarkerId(null)}>
            <div className="ce-shortcuts-modal" onClick={(e) => e.stopPropagation()} style={{ width: 360 }}>
              <div className="ce-shortcuts-title">📍 Markør @ {formatTime(m.timeSec)}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <input
                  type="text"
                  value={m.label}
                  placeholder="Marker-tittel"
                  onChange={(e) => updateMarker(m.id, { label: e.target.value })}
                  className="ce-claude-input"
                  autoFocus
                />
                <textarea
                  value={m.comment}
                  placeholder="Kommentar (valgfri)…"
                  onChange={(e) => updateMarker(m.id, { comment: e.target.value })}
                  className="ce-wishes-input"
                  rows={3}
                />
                <div style={{ display: "flex", gap: 6 }}>
                  {["#a030c0", "#4ad48a", "#f0a500", "#ef4f6f", "#6e3fc7"].map(c => (
                    <button
                      key={c}
                      onClick={() => updateMarker(m.id, { color: c })}
                      style={{
                        width: 28, height: 28, borderRadius: 14,
                        background: c, border: m.color === c ? "2px solid white" : "none",
                        cursor: "pointer",
                      }}
                    />
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <button onClick={() => { deleteMarker(m.id); setEditingMarkerId(null); }}
                          style={{ background: "rgba(239, 79, 111, 0.20)", color: "#ef9fb0",
                                   border: "1px solid rgba(239, 79, 111, 0.40)",
                                   borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}>
                    🗑 Slett
                  </button>
                  <button className="ce-shortcuts-close" style={{ flex: 1 }}
                          onClick={() => setEditingMarkerId(null)}>Lukk</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Comment edit modal */}
      {editingCommentPick !== null && (() => {
        const p = filteredPicks.find(pp => pp.index === editingCommentPick);
        if (!p) return null;
        return (
          <div className="ce-shortcuts-backdrop" onClick={() => setEditingCommentPick(null)}>
            <div className="ce-shortcuts-modal" onClick={(e) => e.stopPropagation()} style={{ width: 380 }}>
              <div className="ce-shortcuts-title">💬 Kommentar — shot#{p.index} ({p.chapter})</div>
              <textarea
                value={pickComments[p.index] || ""}
                placeholder="Editor notes, edit-spørsmål, eller bryllupspar-feedback…"
                onChange={(e) => setPickComments(prev => ({ ...prev, [p.index]: e.target.value }))}
                className="ce-wishes-input"
                rows={5}
                autoFocus
              />
              <button className="ce-shortcuts-close" style={{ marginTop: 12 }}
                      onClick={() => setEditingCommentPick(null)}>Lagre + lukk</button>
            </div>
          </div>
        );
      })()}

      {/* Shortcuts help-overlay */}
      {shortcutsOpen && (
        <div className="ce-shortcuts-backdrop" onClick={() => setShortcutsOpen(false)}>
          <div className="ce-shortcuts-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ce-shortcuts-title">⌨ Hurtigtaster</div>
            <div className="ce-shortcuts-list">
              {[
                { keys: ["J", "←"], desc: "Forrige pick" },
                { keys: ["L", "→"], desc: "Neste pick" },
                { keys: ["K", "Space"], desc: "Play/pause" },
                { keys: ["X"], desc: "Skip focused pick" },
                { keys: ["V"], desc: "Keep / re-include" },
                { keys: ["T"], desc: "Toggle Trim panel" },
                { keys: ["M"], desc: "Sett markør ved playhead" },
                { keys: ["C"], desc: "Kommenter focused pick" },
                { keys: ["⌘Z"], desc: "Undo" },
                { keys: ["⇧⌘Z"], desc: "Redo" },
                { keys: ["?"], desc: "Vis denne hjelpen" },
                { keys: ["Esc"], desc: "Lukk dialog" },
              ].map((s, i) => (
                <div key={i} className="ce-shortcut-row">
                  <div className="ce-shortcut-keys">
                    {s.keys.map((k, j) => <kbd key={j}>{k}</kbd>)}
                  </div>
                  <div className="ce-shortcut-desc">{s.desc}</div>
                </div>
              ))}
            </div>
            <button className="ce-shortcuts-close" onClick={() => setShortcutsOpen(false)}>Lukk</button>
          </div>
        </div>
      )}

      {/* ─── Bottom: wizard nav + Start CTA ─── */}
      <footer className="ce-footer">
        <div className="ce-wizard">
          <WizardStep n={1} label="Velg segmenter" active={wizardStep === 1} done={wizardStep > 1} onClick={() => setWizardStep(1)} />
          <WizardStep n={2} label="Forhåndsvisning" active={wizardStep === 2} done={wizardStep > 2} onClick={() => setWizardStep(2)} />
          <WizardStep n={3} label="Redigering" active={wizardStep === 3} done={wizardStep > 3} onClick={() => setWizardStep(3)} />
          <WizardStep n={4} label="Eksporter" active={wizardStep === 4} done={false} onClick={() => setWizardStep(4)} />
        </div>
        <button
          className="ce-start"
          onClick={() => {
            const next = Math.min(4, wizardStep + 1) as 1 | 2 | 3 | 4;
            setWizardStep(next);
            // Step-specific actions: step 4 triggers export
            if (next === 4 && !exportBusy) {
              handleExport();
            }
            // Step 3: auto-fetch suggestions if not loaded yet
            if (next === 3 && suggestions.length === 0 && !suggBusy) {
              fetchSuggestions();
            }
          }}
          disabled={exportBusy}
        >
          <IconSparkle size={14} />
          {wizardStep === 4 ? (exportBusy ? "Rendrer…" : "Eksporter MP4") :
           wizardStep === 3 ? "Klar for eksport" :
           wizardStep === 2 ? "Gå til redigering" :
           "Start redigering"}
          <div className="ce-start-sub">
            {wizardStep === 4 ? "assemble_highlight_with_music"
              : wizardStep === 3 ? "Claude foreslår underveis"
              : wizardStep === 2 ? "Se story-flyt + balansering"
              : "Claude vil hjelpe underveis"}
          </div>
        </button>
      </footer>
    </div>
  );
}

// ─────────────── Sub-components ───────────────
function BalanceRow({ color, icon, label, pct }: { color: string; icon: string; label: string; pct: number }) {
  return (
    <div className="ce-balance-row">
      <span className="ce-balance-icon" style={{ color }}>{icon}</span>
      <span className="ce-balance-label">{label}</span>
      <div className="ce-balance-track">
        <div className="ce-balance-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="ce-balance-pct">{pct}%</span>
    </div>
  );
}

function ToolButton({ icon, label, active = false, onClick }: {
  icon: string; label: string; active?: boolean; onClick?: () => void;
}) {
  return (
    <button className={`ce-tool ${active ? "active" : ""}`} onClick={onClick}>
      <span className="ce-tool-icon">{icon}</span>
      <span className="ce-tool-label">{label}</span>
    </button>
  );
}

function TrimPanel({ pick, originalPick, bpm, snapToBeat, onSnapToggle, onChange, onReset, onSnapAll }: {
  pick: Pick;
  originalPick?: Pick;
  bpm?: number;
  snapToBeat: boolean;
  onSnapToggle: () => void;
  onChange: (startSec?: number, endSec?: number) => void;
  onReset: () => void;
  onSnapAll: () => void;
}) {
  // Bounds: allow ±50% expansion from original pick range
  const orig = originalPick ?? pick;
  const minStart = Math.max(0, orig.startSec - orig.durationSec * 0.5);
  const maxEnd = orig.endSec + orig.durationSec * 0.5;
  const beatInterval = bpm ? 60 / bpm : 0;
  const [start, setStart] = useState(pick.startSec);
  const [end, setEnd] = useState(pick.endSec);

  useEffect(() => { setStart(pick.startSec); setEnd(pick.endSec); }, [pick.index, pick.startSec, pick.endSec]);

  // Snap helper — round delta from minStart to nearest beat-interval
  const snap = (v: number) => {
    if (!snapToBeat || !beatInterval) return v;
    const offset = v - minStart;
    const snapped = Math.round(offset / beatInterval) * beatInterval;
    return Math.max(minStart, Math.min(maxEnd, minStart + snapped));
  };
  const commit = () => onChange(snap(start), snap(end));

  // Beat-grid positions for visual ruler (relative 0..1)
  const range = maxEnd - minStart;
  const beatTicks = beatInterval ? Math.floor(range / beatInterval) : 0;

  return (
    <div className="ce-trim-panel">
      <div className="ce-trim-header">
        <strong>Trim shot#{pick.index}</strong>
        <span className="ce-trim-dur">{(end - start).toFixed(2)}s</span>
        {bpm && (
          <label className="ce-trim-snap-toggle">
            <input type="checkbox" checked={snapToBeat} onChange={onSnapToggle} />
            <span>♪ Snap til beat ({bpm} BPM)</span>
          </label>
        )}
      </div>
      {/* Beat-grid overlay */}
      {beatTicks > 0 && (
        <div className="ce-trim-beatgrid">
          {Array.from({ length: beatTicks + 1 }).map((_, i) => (
            <div
              key={i}
              className={`ce-trim-beat ${i % 4 === 0 ? "downbeat" : ""}`}
              style={{ left: `${(i * beatInterval / range) * 100}%` }}
            />
          ))}
          <div
            className="ce-trim-region"
            style={{
              left:  `${((start - minStart) / range) * 100}%`,
              width: `${((end - start) / range) * 100}%`,
            }}
          />
        </div>
      )}
      <div className="ce-trim-row">
        <label>Start</label>
        <input
          type="range"
          min={minStart}
          max={end - 0.1}
          step={snapToBeat && beatInterval ? beatInterval : 0.01}
          value={start}
          onChange={e => setStart(parseFloat(e.target.value))}
          onMouseUp={commit}
          onTouchEnd={commit}
        />
        <span className="ce-trim-val">{snap(start).toFixed(2)}s</span>
      </div>
      <div className="ce-trim-row">
        <label>Slutt</label>
        <input
          type="range"
          min={start + 0.1}
          max={maxEnd}
          step={snapToBeat && beatInterval ? beatInterval : 0.01}
          value={end}
          onChange={e => setEnd(parseFloat(e.target.value))}
          onMouseUp={commit}
          onTouchEnd={commit}
        />
        <span className="ce-trim-val">{snap(end).toFixed(2)}s</span>
      </div>
      <div className="ce-trim-actions">
        {bpm && (
          <button className="ce-trim-snap-all" onClick={onSnapAll}>
            ♪ Snap alle picks til {bpm} BPM
          </button>
        )}
        <button className="ce-trim-reset" onClick={onReset}>Tilbakestill original</button>
      </div>
    </div>
  );
}

function SuggestionCard({ thumb, title, desc, primaryLabel = "Bruk forslag", secondaryLabel = "Se klipp", onPrimary, onSecondary }: {
  thumb?: string;
  title: string;
  desc: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  onPrimary?: () => void;
  onSecondary?: () => void;
}) {
  return (
    <div className="ce-suggest-card">
      {thumb && (
        <div className="ce-suggest-thumb">
          <img src={convertFileSrc(thumb)} alt="" />
        </div>
      )}
      <div className="ce-suggest-body">
        <div className="ce-suggest-title">{title}</div>
        <div className="ce-suggest-desc">{desc}</div>
        <div className="ce-suggest-actions">
          <button className="ce-suggest-primary" onClick={onPrimary}>{primaryLabel}</button>
          <button className="ce-suggest-secondary" onClick={onSecondary}>{secondaryLabel}</button>
        </div>
      </div>
    </div>
  );
}

function WizardStep({ n, label, active, done, onClick }: {
  n: number; label: string; active: boolean; done: boolean; onClick: () => void;
}) {
  return (
    <button className={`ce-wizard-step ${active ? "active" : ""} ${done ? "done" : ""}`} onClick={onClick}>
      <span className="ce-wizard-num">{done ? <IconCheck size={12} /> : n}</span>
      <span className="ce-wizard-label">{label}</span>
    </button>
  );
}

function FakeWaveform({ bars, active }: { bars: number; active: boolean }) {
  // Fallback waveform when no real song WAV is loaded (sine-modulated).
  const heights = useMemo(() => {
    const arr = [];
    for (let i = 0; i < bars; i++) {
      const v = Math.abs(Math.sin(i * 0.37) * Math.cos(i * 0.13) * 0.6) + 0.2;
      arr.push(v);
    }
    return arr;
  }, [bars]);
  return (
    <div className="ce-wave-bars">
      {heights.map((h, i) => (
        <div key={i} className={`ce-wave-bar ${active ? "active" : ""}`}
             style={{ height: `${h * 100}%` }} />
      ))}
    </div>
  );
}

/**
 * RealWaveform — loads the song WAV via fetch + WebAudio API, decodes it,
 * and reduces to N peak-amplitude bars. Phase 2: real waveform render.
 */
function RealWaveform({ wavPath, bars, active }: {
  wavPath?: string; bars: number; active: boolean;
}) {
  const [peaks, setPeaks] = useState<number[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!wavPath) return;
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch(convertFileSrc(wavPath));
        const buf = await resp.arrayBuffer();
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const audio = await ctx.decodeAudioData(buf);
        // Reduce to N peak-amplitudes (max-abs per chunk)
        const channel = audio.getChannelData(0);
        const samplesPerBar = Math.floor(channel.length / bars);
        const arr: number[] = [];
        let maxPeak = 0;
        for (let i = 0; i < bars; i++) {
          let m = 0;
          const start = i * samplesPerBar;
          const end = Math.min(start + samplesPerBar, channel.length);
          for (let j = start; j < end; j++) {
            const v = Math.abs(channel[j]);
            if (v > m) m = v;
          }
          arr.push(m);
          if (m > maxPeak) maxPeak = m;
        }
        // Normalize to 0..1
        const normalized = maxPeak > 0 ? arr.map(v => v / maxPeak) : arr;
        if (!cancelled) setPeaks(normalized);
        try { ctx.close(); } catch { /* noop */ }
      } catch (e: any) {
        if (!cancelled) setError(typeof e === "string" ? e : (e?.message ?? "Failed to decode WAV"));
      }
    })();
    return () => { cancelled = true; };
  }, [wavPath, bars]);

  if (error || !peaks) {
    return <FakeWaveform bars={bars} active={active} />;
  }
  return (
    <div className="ce-wave-bars">
      {peaks.map((h, i) => (
        <div key={i} className={`ce-wave-bar ${active ? "active" : ""}`}
             style={{ height: `${Math.max(8, h * 100)}%` }} />
      ))}
    </div>
  );
}
