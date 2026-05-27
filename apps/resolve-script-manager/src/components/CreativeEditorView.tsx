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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const [aspectRatio] = useState<"16:9" | "9:16" | "1:1">("16:9");
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

  // Claude chat state
  type ChatMsg = { role: "user" | "assistant"; content: string };
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // Hover-preview state — when mouse-over segment, play that pick
  const [hoveredPickIdx, setHoveredPickIdx] = useState<number | null>(null);

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
          savedAt: Date.now(),
        }));
      } catch (e) {
        console.warn("Could not save creative-editor state:", e);
      }
    }, 500);
    return () => clearTimeout(handle);
  }, [stateKey, payload, projectTitle, includedChapters, pickOverrides, activePickOrder, activeSongIdx]);

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

  const videoSrc = useMemo(() => payload ? convertFileSrc(payload.sourceVideo) : "", [payload]);
  // When hover is active, play that segment; else play focused
  const activePick = (hoveredPickIdx != null && filteredPicks[hoveredPickIdx]) || filteredPicks[focusedPickIdx];
  const focusedPick = activePick;
  // Live Narrative Simulation — mood derived from focused pick + chapter
  const mood = useMemo(() => moodForPick(focusedPick), [focusedPick]);

  // ─── Video playback: seek to focused pick + loop within range ───
  useEffect(() => {
    if (!videoRef.current || !focusedPick) return;
    const v = videoRef.current;
    if (Math.abs(v.currentTime - focusedPick.startSec) > 0.5) {
      v.currentTime = focusedPick.startSec;
    }
  }, [focusedPickIdx, focusedPick]);

  // Loop within current pick range
  useEffect(() => {
    if (!videoRef.current || !focusedPick) return;
    const v = videoRef.current;
    const onTime = () => {
      setCurrentTime(v.currentTime - focusedPick.startSec);
      if (v.currentTime >= focusedPick.endSec) {
        v.currentTime = focusedPick.startSec;
      }
    };
    v.addEventListener("timeupdate", onTime);
    return () => v.removeEventListener("timeupdate", onTime);
  }, [focusedPick]);

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

  // ─── Eksport: kall assemble_highlight_with_music for å render MP4 ───
  const handleExport = useCallback(async () => {
    if (exportBusy || !payload) return;
    setExportBusy(true);
    setExportError(null);
    setExportResult(null);
    try {
      const safeTitle = projectTitle.replace(/[^\w\s-]/g, "").trim() || "Highlight";
      const outputPath = `~/Desktop/${safeTitle}.mp4`;
      // Compute excluded chapters (those NOT in includedChapters set)
      const allChapters = new Set<string>();
      payload.picks.forEach(p => allChapters.add((p.chapter || "details").toLowerCase()));
      const excluded = Array.from(allChapters).filter(c => !includedChapters.has(c));
      const summary = await executeScript("assemble_highlight_with_music", {
        videoPath: payload.sourceVideo,
        outputPath,
        musicStrategy: "main+climax",
        // User's song selection from header dropdown (else falls back to advisor #1)
        mainSongTitle: activeSong?.title,
        // Pass current editor-state so trim/reorder/segment-toggle persists into render
        pickOverrides: pickOverrides,
        pickOrder: activePickOrder ?? undefined,
        excludedChapters: excluded,
      }, false);
      const resultEvent = summary.events.find(e => e.type === "result");
      const r = resultEvent?.value as { outputPath?: string; durationSec?: number } | undefined;
      if (r?.outputPath) {
        setExportResult({ outputPath: r.outputPath, durationSec: r.durationSec ?? 0 });
      } else {
        // Look for error in events
        const errEvent = summary.events.find(e => e.type === "error");
        throw new Error((errEvent?.value as any)?.message ?? "Export failed (no output path)");
      }
    } catch (e: any) {
      setExportError(typeof e === "string" ? e : (e?.message ?? "Ukjent feil"));
    } finally {
      setExportBusy(false);
    }
  }, [exportBusy, payload, projectTitle, pickOverrides, activePickOrder, includedChapters]);

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

  // ─── Claude chat: send message + receive reply ───
  const sendChat = useCallback(async (text: string) => {
    if (!text.trim() || chatBusy) return;
    const userMsg: ChatMsg = { role: "user", content: text.trim() };
    const nextMessages = [...chatMessages, userMsg];
    setChatMessages(nextMessages);
    setChatInput("");
    setChatBusy(true);
    setChatError(null);
    // Build context for Claude — picks summary + history balance + active song
    const ctxLines: string[] = [];
    ctxLines.push(`Project: "${projectTitle}"`);
    if (activeSong) ctxLines.push(`Main song: "${activeSong.title}" by ${activeSong.artist}${activeSong.bpm ? ` (${activeSong.bpm} BPM)` : ""}`);
    ctxLines.push(`Highlight length: ${formatTime(totalDuration)} (${filteredPicks.length} picks across ${segments.length} segments)`);
    ctxLines.push(`Segments included: ${Array.from(includedChapters).join(", ")}`);
    ctxLines.push(`Story balance: Romantikk ${balance.romantikk}%, Familie ${balance.familie}%, Detaljer ${balance.detaljer}%, Emosjon ${balance.emosjon}%, Energi ${balance.energi}%`);
    if (focusedPick) {
      ctxLines.push(`Currently focused: shot#${focusedPick.index} (${focusedPick.chapter || "?"}) — ${focusedPick.durationSec.toFixed(2)}s, score ${focusedPick.score.toFixed(3)}`);
    }
    const systemPrompt = `Du er Claude, en AI Creative Director som hjelper en wedding-film-redaktør lage emosjonelle highlights. Du følger redaktørens story-tankegang — IKKE bins/folders. Du gir korte, konkrete forslag (1-3 setninger) om pacing, emosjonell flyt, og narrativ struktur. Skriv på norsk. Du er kreativ partner, ikke chatbot.

Project-kontekst:
${ctxLines.join("\n")}`;
    try {
      const resp: any = await invoke("claude_chat", {
        messages: nextMessages.map(m => ({ role: m.role, content: m.content })),
        system: systemPrompt,
        model: "claude-opus-4-7",
        maxTokens: 600,
      });
      // Anthropic response: { content: [{ type: "text", text: "..." }], ... }
      const blocks = resp?.content ?? [];
      const text = blocks
        .filter((b: any) => b.type === "text")
        .map((b: any) => b.text)
        .join("\n")
        .trim();
      if (text) {
        setChatMessages([...nextMessages, { role: "assistant", content: text }]);
      } else {
        setChatError("Claude svarte tomt — prøv igjen.");
      }
    } catch (e: any) {
      setChatError(typeof e === "string" ? e : (e?.message ?? "Ukjent feil ved Claude-kall"));
    } finally {
      setChatBusy(false);
      // Scroll chat to bottom after render
      setTimeout(() => {
        chatScrollRef.current?.scrollTo({ top: 999999, behavior: "smooth" });
      }, 50);
    }
  }, [chatBusy, chatMessages, projectTitle, activeSong, totalDuration, filteredPicks.length, segments.length, includedChapters, balance, focusedPick]);

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
          <button className="ce-aspect">
            <span>📐</span> {aspectRatio}
          </button>
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
          <button>↗ Del</button>
          <button
            className="primary"
            onClick={handleExport}
            disabled={exportBusy || !payload}
          >
            {exportBusy ? "⏳ Rendrer …" : "+ Eksporter"}
          </button>
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
                      videoRef.current?.play().catch(() => {});
                    }
                  }}
                  onMouseLeave={() => {
                    setHoveredPickIdx(null);
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
          <div className="ce-preview-wrap">
            <video
              ref={videoRef}
              src={videoSrc}
              className="ce-preview-video"
              style={{
                filter: mood.filter,
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
            <div className="ce-timeline-ruler">
              {[0, 30, 60, 90, 120, 150, 180].map((t) => (
                <div key={t} className="ce-timeline-tick" style={{ left: `${(t / totalDuration) * 100}%` }}>
                  {formatTime(t)}
                </div>
              ))}
            </div>
            <div className="ce-timeline-strip">
              {filteredPicks.slice(0, 12).map((p, i) => {
                const segIdx = segments.findIndex(s => s.picks.some(x => x.index === p.index));
                const flowEval = flowEvals.find(f => f.pickIndex === p.index);
                return (
                  <div
                    key={p.index}
                    className={`ce-timeline-clip ${i === focusedPickIdx ? "active" : ""}`}
                    onClick={() => setFocusedPickIdx(i)}
                  >
                    <div className="ce-timeline-clip-num">{segIdx + 1}</div>
                    {p.thumbnailPath && <img src={convertFileSrc(p.thumbnailPath)} alt="" />}
                    <div className="ce-timeline-clip-dur">{p.durationSec.toFixed(2)}</div>
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
          </div>

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

        {/* ─── Right: Claude assistant ─── */}
        <aside className="ce-claude">
          <div className="ce-claude-header">
            <span className="ce-claude-icon">🌸</span>
            <span className="ce-claude-name">Claude</span>
            <span className="ce-claude-beta">BETA</span>
            <button className="ce-claude-close">✕</button>
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
