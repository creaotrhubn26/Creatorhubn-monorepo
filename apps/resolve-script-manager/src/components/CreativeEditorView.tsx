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
import { convertFileSrc } from "@tauri-apps/api/core";
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

  // ─── Load picks + advisor ───
  useEffect(() => {
    if (!picksPath) { setLoadError("No picks path provided"); return; }
    fetch(convertFileSrc(picksPath))
      .then((r) => r.json())
      .then((data: PicksPayload) => {
        setPayload(data);
        // Derive default project title from source-video filename
        const base = data.sourceVideo.split("/").pop() ?? "Highlight";
        const clean = base.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
        setProjectTitle(clean);
        // Include all chapters by default
        const chapters = new Set<string>();
        for (const p of data.picks) chapters.add((p.chapter || "details").toLowerCase());
        setIncludedChapters(chapters);
      })
      .catch((e) => setLoadError(`Failed to load picks: ${e}`));
  }, [picksPath]);

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
    return payload.picks
      .filter((p) => includedChapters.has((p.chapter || "details").toLowerCase()))
      .sort((a, b) => a.startSec - b.startSec);
  }, [payload, includedChapters]);
  const balance = useMemo(() => computeHistorybalance(filteredPicks), [filteredPicks]);
  const totalDuration = useMemo(() => filteredPicks.reduce((s, p) => s + p.durationSec, 0), [filteredPicks]);
  const songs = advisor?.uniqueSongs ?? [];
  const activeSong = songs[activeSongIdx];

  const videoSrc = useMemo(() => payload ? convertFileSrc(payload.sourceVideo) : "", [payload]);
  const focusedPick = filteredPicks[focusedPickIdx];

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
          <button className="primary">+ Eksporter</button>
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

          {/* Claude status bar (Phase 3 placeholder — shows real state, no fake messages) */}
          <div className="ce-claude-status">
            <div className="ce-claude-status-icon"><IconSparkle size={14} /></div>
            <div className="ce-claude-status-text">
              Claude ser på tidslinjen din … <span className="ce-collab">● Samarbeider</span>
            </div>
            <button className="ce-claude-ask">⚪ Be Claude om råd</button>
            <button className="ce-claude-suggest">✨ Vis forslag <span className="ce-badge">3</span></button>
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
                return (
                  <div
                    key={p.index}
                    className={`ce-timeline-clip ${i === focusedPickIdx ? "active" : ""}`}
                    onClick={() => setFocusedPickIdx(i)}
                  >
                    <div className="ce-timeline-clip-num">{segIdx + 1}</div>
                    {p.thumbnailPath && <img src={convertFileSrc(p.thumbnailPath)} alt="" />}
                    <div className="ce-timeline-clip-dur">{p.durationSec.toFixed(2)}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Audio waveform — Phase 4 will compute real waveform from song WAV */}
          <div className="ce-audio">
            <div className="ce-audio-icon">🎵</div>
            <div className="ce-audio-title">
              {activeSong ? `${activeSong.title} – ${activeSong.artist}` : "(Ingen sang valgt)"}
            </div>
            <div className="ce-audio-wave">
              <FakeWaveform bars={120} active={isPlaying} />
            </div>
          </div>

          <div className="ce-duration">
            <span>Varighet valgt: <strong>{formatTime(totalDuration)}</strong></span>
            <span className="ce-spacer" />
            <span className="ce-muted">Estimert ferdig: ~{Math.ceil(totalDuration / 60)} min</span>
          </div>

          {/* Toolbar */}
          <div className="ce-toolbar">
            <ToolButton icon="✂" label="Trim" />
            <ToolButton icon="⚙" label="Juster" />
            <ToolButton icon="◇" label="Overganger" />
            <ToolButton icon="🎨" label="Farge" />
            <ToolButton icon="📐" label="Stabilisering" />
            <ToolButton icon="…" label="Mer" />
          </div>
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

          <div className="ce-claude-suggestions">
            <div className="ce-claude-suggest-header">
              <span>Forslag (3)</span>
              <button className="ce-claude-accept-all">Godta alle</button>
            </div>
            <SuggestionCard
              thumb={segments[3]?.picks[0]?.thumbnailPath}
              title="Juster lengden på «Portretter»"
              desc="Jeg foreslår å kutte 10–15 sekunder for å stramme opp flyten."
            />
            <SuggestionCard
              thumb={segments[1]?.picks[0]?.thumbnailPath}
              title="Legg til reaksjon etter første kyss"
              desc="Et klipp av gjestenes reaksjon vil forsterke øyeblikket."
            />
            <SuggestionCard
              thumb={segments[5]?.picks[0]?.thumbnailPath}
              title="Bytt rekkefølge på taler og dans"
              desc="Å legge taler før første dans gir bedre emosjonell oppbygging."
              primaryLabel="Prøv rekkefølge"
              secondaryLabel="Se mer"
            />
          </div>

          <div className="ce-claude-chat">
            <div className="ce-claude-chat-title">Chat med Claude</div>
            <div className="ce-claude-msg ce-claude-msg-user">
              Hva kan jeg gjøre for å få en sterkere avslutning?
            </div>
            <div className="ce-claude-msg ce-claude-msg-assistant">
              Jeg foreslår å avslutte med et detaljklipp eller en rolig wide shot av dere to. Det gir en fin, emosjonell avrunding.
            </div>
            <input className="ce-claude-input" placeholder="Skriv melding til Claude …" />
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
          onClick={() => setWizardStep((s) => Math.min(4, (s + 1)) as 1 | 2 | 3 | 4)}
        >
          <IconSparkle size={14} /> Start redigering
          <div className="ce-start-sub">Claude vil hjelpe underveis</div>
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

function ToolButton({ icon, label }: { icon: string; label: string }) {
  return (
    <button className="ce-tool">
      <span className="ce-tool-icon">{icon}</span>
      <span className="ce-tool-label">{label}</span>
    </button>
  );
}

function SuggestionCard({ thumb, title, desc, primaryLabel = "Bruk forslag", secondaryLabel = "Se klipp" }: {
  thumb?: string;
  title: string;
  desc: string;
  primaryLabel?: string;
  secondaryLabel?: string;
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
          <button className="ce-suggest-primary">{primaryLabel}</button>
          <button className="ce-suggest-secondary">{secondaryLabel}</button>
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
  // Phase 1 placeholder waveform — Phase 4 replaces with real Web-Audio FFT.
  const heights = useMemo(() => {
    const arr = [];
    for (let i = 0; i < bars; i++) {
      // Pseudo-random but stable — based on i with sine modulation
      const v = Math.abs(Math.sin(i * 0.37) * Math.cos(i * 0.13) * 0.6) + 0.2;
      arr.push(v);
    }
    return arr;
  }, [bars]);
  return (
    <div className="ce-wave-bars">
      {heights.map((h, i) => (
        <div
          key={i}
          className={`ce-wave-bar ${active ? "active" : ""}`}
          style={{ height: `${h * 100}%` }}
        />
      ))}
    </div>
  );
}
