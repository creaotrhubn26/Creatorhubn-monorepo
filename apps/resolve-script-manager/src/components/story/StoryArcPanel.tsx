/**
 * StoryArcPanel — visualiserer narrativ struktur som energi-kurve.
 * Gjenbruker beregningen fra `useNarrativeStructure` og rendrer den
 * som SVG med 5-6 fase-merker langs x-aksen og thumbnail-strip under.
 * Mockup-treff: "STORY ARC"-seksjonen øverst.
 */

import { useMemo } from "react";
import type { NarrativeStructure } from "../../hooks/useNarrativeStructure";
import { convertFileSrc } from "@tauri-apps/api/core";

interface Props {
  structure: NarrativeStructure;
  focusedPickIndex: number | null;
  onFocusPick: (pickIndex: number | null) => void;
  /** Sekundære highlights — vises som lilla outline (vs pink for focused). */
  highlightedPickIndices?: number[];
}

export function StoryArcPanel({
  structure,
  focusedPickIndex,
  onFocusPick,
  highlightedPickIndices = [],
}: Props) {
  const { beats, arcPoints } = structure;
  const highlightSet = useMemo(
    () => new Set(highlightedPickIndices),
    [highlightedPickIndices],
  );

  // Bygg SVG-path for energi-kurven
  const pathD = useMemo(() => {
    if (arcPoints.length === 0) return "";
    const width = 800;
    const height = 140;
    const pad = 12;
    const pts = arcPoints.map((p) => {
      const x = pad + p.tNorm * (width - pad * 2);
      const y = height - pad - p.energy * (height - pad * 2);
      return [x, y] as const;
    });
    // Smooth Bezier
    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const [x1, y1] = pts[i - 1];
      const [x2, y2] = pts[i];
      const cx = (x1 + x2) / 2;
      d += ` C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`;
    }
    return d;
  }, [arcPoints]);

  if (beats.length === 0) {
    return (
      <section style={panel} data-testid="story-arc-panel">
        <h3 style={panelTitle}>Story arc</h3>
        <div style={emptyState}>Velg footage med picks for å se story arc.</div>
      </section>
    );
  }

  // Sample 7 key picks for thumbnail-strip
  const samplePicks = useMemo(() => {
    const all = beats.flatMap((b) => b.picks);
    if (all.length <= 7) return all;
    const step = all.length / 7;
    return Array.from({ length: 7 }, (_, i) => all[Math.floor(i * step)]);
  }, [beats]);

  return (
    <section style={panel} data-testid="story-arc-panel">
      <header style={panelHeader}>
        <h3 style={panelTitle}>
          Story arc <span style={infoBadge} aria-label="info">i</span>
        </h3>
        <div style={{ display: "flex", gap: 6 }}>
          <button style={chipBtn}>📈 Vis som kurve</button>
        </div>
      </header>

      {/* Beat-labels langs toppen */}
      <div style={beatLabelsRow}>
        {beats.map((b) => (
          <div key={b.id} style={beatLabelCol}>
            <div style={beatLabelText}>{b.label.toUpperCase()}</div>
            <div style={beatLabelTime}>
              {formatTimeRange(b.startSec, b.endSec)}
            </div>
          </div>
        ))}
      </div>

      {/* SVG energy curve */}
      <svg
        viewBox="0 0 800 140"
        style={{ width: "100%", height: 140 }}
        preserveAspectRatio="none"
        data-testid="story-arc-svg"
      >
        <defs>
          <linearGradient id="arcGradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#a78bfa" />
            <stop offset="40%" stopColor="#ec4899" />
            <stop offset="60%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#60a5fa" />
          </linearGradient>
        </defs>
        <path d={pathD} stroke="url(#arcGradient)" strokeWidth={2} fill="none" />
        {arcPoints.map((p, i) => {
          const isFocused = p.pickIndex === focusedPickIndex;
          const isHighlighted = !isFocused && highlightSet.has(p.pickIndex);
          return (
            <circle
              key={i}
              cx={12 + p.tNorm * (800 - 24)}
              cy={140 - 12 - p.energy * (140 - 24)}
              r={isFocused ? 6 : isHighlighted ? 5 : 3}
              fill={isFocused ? "#f472b6" : isHighlighted ? "#c084fc" : "#a78bfa"}
              stroke={isHighlighted ? "#f472b6" : "none"}
              strokeWidth={isHighlighted ? 1.5 : 0}
              style={{ cursor: "pointer" }}
              onClick={() => onFocusPick(p.pickIndex)}
            />
          );
        })}
      </svg>

      {/* Thumbnail-strip */}
      <div style={thumbStrip} data-testid="story-arc-thumbs">
        {samplePicks.map((p) => {
          const isFocused = p.index === focusedPickIndex;
          const isInRecSet = highlightSet.has(p.index);
          // Outline-prioritet: focused > highlighted > ingen.
          // `data-highlighted` markerer alle picks anbefalingen viser til,
          // uavhengig av om de også er focused.
          return (
          <div
            key={p.index}
            style={{
              ...thumb,
              outline: isFocused
                ? "2px solid #f472b6"
                : isInRecSet
                  ? "2px dashed #c084fc"
                  : "1px solid transparent",
            }}
            onClick={() => onFocusPick(p.index)}
            data-testid={`story-thumb-${p.index}`}
            data-highlighted={isInRecSet ? "true" : "false"}
          >
            {p.thumbnailPath ? (
              <img
                src={convertFileSrc(p.thumbnailPath)}
                alt={`Pick ${p.index}`}
                style={thumbImg}
              />
            ) : (
              <div style={thumbPlaceholder} />
            )}
            <div style={thumbCaption}>
              <div style={thumbTime}>{formatTime(p.startSec)}</div>
              <div style={thumbChapter}>{p.chapter ?? "—"}</div>
            </div>
          </div>
          );
        })}
      </div>

      <div style={navHint} aria-hidden>
        ← →
      </div>
    </section>
  );
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatTimeRange(start: number, end: number): string {
  return `${formatTime(start)} – ${formatTime(end)}`;
}

const panel: React.CSSProperties = {
  background: "#15151c",
  border: "1px solid #2a2a36",
  borderRadius: 12,
  padding: "16px 18px",
  marginBottom: 12,
};

const panelHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 14,
};

const panelTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 0.8,
  textTransform: "uppercase",
  color: "#9ca3af",
  display: "flex",
  alignItems: "center",
  gap: 6,
};

const infoBadge: React.CSSProperties = {
  fontSize: 9,
  width: 14,
  height: 14,
  borderRadius: "50%",
  border: "1px solid #3a3a4a",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#666",
};

const chipBtn: React.CSSProperties = {
  background: "#22222e",
  border: "1px solid #2e2e3a",
  color: "#a8a8b8",
  fontSize: 11,
  padding: "4px 10px",
  borderRadius: 14,
  cursor: "pointer",
};

const beatLabelsRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(5, 1fr)",
  gap: 8,
  marginBottom: 6,
};

const beatLabelCol: React.CSSProperties = {
  textAlign: "center",
};

const beatLabelText: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: 0.6,
  color: "#9ca3af",
};

const beatLabelTime: React.CSSProperties = {
  fontSize: 9.5,
  color: "#5d5d6f",
  marginTop: 2,
  fontFamily: "ui-monospace, monospace",
};

const thumbStrip: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(7, 1fr)",
  gap: 8,
  marginTop: 14,
};

const thumb: React.CSSProperties = {
  background: "#1c1c26",
  borderRadius: 6,
  overflow: "hidden",
  cursor: "pointer",
  position: "relative",
};

const thumbImg: React.CSSProperties = {
  width: "100%",
  aspectRatio: "16 / 9",
  objectFit: "cover",
  display: "block",
};

const thumbPlaceholder: React.CSSProperties = {
  width: "100%",
  aspectRatio: "16 / 9",
  background: "linear-gradient(135deg, #2a2a36, #1c1c26)",
};

const thumbCaption: React.CSSProperties = {
  padding: "6px 8px",
};

const thumbTime: React.CSSProperties = {
  fontSize: 10,
  color: "#9ca3af",
  fontFamily: "ui-monospace, monospace",
};

const thumbChapter: React.CSSProperties = {
  fontSize: 11,
  color: "#e5e5ea",
  fontWeight: 500,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const navHint: React.CSSProperties = {
  position: "absolute",
  pointerEvents: "none",
  color: "transparent",
};

const emptyState: React.CSSProperties = {
  padding: "30px 16px",
  textAlign: "center",
  color: "#5d5d6f",
  fontSize: 12,
};
