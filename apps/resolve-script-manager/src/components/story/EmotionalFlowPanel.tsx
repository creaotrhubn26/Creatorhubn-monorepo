/**
 * EmotionalFlowPanel — multi-line chart over emosjonelle dimensjoner
 * (Glede, Kjærlighet, Spenning, Nostalgi, Energi, Intimitet) gjennom
 * tidslinjen. Mockup-treff: midt-seksjonen "EMOSJONELL FLYT".
 * Bruker ren SVG — ingen ny dependency.
 */

import { useMemo, useState } from "react";
import type { NarrativePick } from "../../hooks/useNarrativeStructure";

interface Props {
  picks: NarrativePick[];
}

const DIMENSIONS = [
  { id: "glede", label: "Glede", color: "#ec4899" },
  { id: "kjaerlighet", label: "Kjærlighet", color: "#f472b6" },
  { id: "spenning", label: "Spenning", color: "#f59e0b" },
  { id: "nostalgi", label: "Nostalgi", color: "#a78bfa" },
  { id: "energi", label: "Energi", color: "#fbbf24" },
  { id: "intimitet", label: "Intimitet", color: "#34d399" },
] as const;

type DimensionId = (typeof DIMENSIONS)[number]["id"];

const PRIMARY_DIMENSIONS: DimensionId[] = ["glede", "kjaerlighet", "energi"];

export function EmotionalFlowPanel({ picks }: Props) {
  const [showAll, setShowAll] = useState(true);
  const [hoverX, setHoverX] = useState<number | null>(null);

  const series = useMemo(() => buildSeries(picks), [picks]);
  const visibleDimensions = showAll
    ? DIMENSIONS
    : DIMENSIONS.filter((d) => PRIMARY_DIMENSIONS.includes(d.id));

  const width = 800;
  const height = 220;
  const pad = { l: 90, r: 16, t: 12, b: 22 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const totalSec =
    picks.length === 0 ? 1 : Math.max(picks[picks.length - 1].endSec, 1);

  const xAt = (sec: number) => pad.l + (sec / totalSec) * innerW;
  const yAt = (val: number) => pad.t + innerH - val * innerH;

  return (
    <section style={panel} data-testid="emotional-flow-panel">
      <header style={panelHeader}>
        <h3 style={panelTitle}>
          Emosjonell flyt <span style={infoBadge}>i</span>
        </h3>
        <div style={{ display: "flex", gap: 4 }}>
          <button
            onClick={() => setShowAll(true)}
            style={{
              ...togglePill,
              ...(showAll ? togglePillActive : null),
            }}
            data-testid="emotion-toggle-all"
          >
            Vis alle
          </button>
          <button
            onClick={() => setShowAll(false)}
            style={{
              ...togglePill,
              ...(!showAll ? togglePillActive : null),
            }}
            data-testid="emotion-toggle-primary"
          >
            Vis hovedfølelser
          </button>
        </div>
      </header>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: "100%", height }}
        preserveAspectRatio="none"
        onMouseMove={(e) => {
          const r = (e.target as SVGElement).getBoundingClientRect();
          const x = e.clientX - r.left;
          const ratio = (x - pad.l) / innerW;
          if (ratio < 0 || ratio > 1) {
            setHoverX(null);
            return;
          }
          setHoverX(ratio * totalSec);
        }}
        onMouseLeave={() => setHoverX(null)}
        data-testid="emotional-flow-svg"
      >
        {/* Y-axis labels */}
        {visibleDimensions.map((d, i) => {
          const y = pad.t + (i / Math.max(visibleDimensions.length - 1, 1)) * innerH;
          return (
            <text
              key={d.id}
              x={pad.l - 8}
              y={y + 4}
              fontSize={10}
              fill="#7b7b8d"
              textAnchor="end"
              fontFamily="system-ui, sans-serif"
            >
              {d.label}
            </text>
          );
        })}

        {/* Hover vertical line */}
        {hoverX !== null && (
          <>
            <line
              x1={xAt(hoverX)}
              x2={xAt(hoverX)}
              y1={pad.t}
              y2={pad.t + innerH}
              stroke="#4a4a5a"
              strokeWidth={1}
              strokeDasharray="2,3"
            />
            <text
              x={xAt(hoverX) + 4}
              y={pad.t + 10}
              fontSize={10}
              fill="#a8a8b8"
              fontFamily="ui-monospace, monospace"
            >
              {formatTime(hoverX)}
            </text>
          </>
        )}

        {/* Lines per dimension */}
        {visibleDimensions.map((d) => {
          const pts = series[d.id];
          if (pts.length === 0) return null;
          const path = pts
            .map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(p.sec)} ${yAt(p.val)}`)
            .join(" ");
          return (
            <g key={d.id}>
              <path d={path} stroke={d.color} strokeWidth={1.5} fill="none" />
              {pts.map((p, i) => (
                <circle
                  key={i}
                  cx={xAt(p.sec)}
                  cy={yAt(p.val)}
                  r={2}
                  fill={d.color}
                />
              ))}
            </g>
          );
        })}

        {/* X-axis ticks */}
        {[0, 0.25, 0.5, 0.75, 1].map((r, i) => (
          <text
            key={i}
            x={xAt(r * totalSec)}
            y={height - 6}
            fontSize={10}
            fill="#5d5d6f"
            textAnchor={r === 0 ? "start" : r === 1 ? "end" : "middle"}
            fontFamily="ui-monospace, monospace"
          >
            {formatTime(r * totalSec)}
          </text>
        ))}
      </svg>
    </section>
  );
}

interface SeriesPoint {
  sec: number;
  val: number;
}

function buildSeries(picks: NarrativePick[]): Record<DimensionId, SeriesPoint[]> {
  // Derivér emosjonelle dimensjoner fra eksisterende PickSignals.
  // Vekting nær mockupets felter; bruker fallback hvis signal mangler.
  const result: Record<DimensionId, SeriesPoint[]> = {
    glede: [],
    kjaerlighet: [],
    spenning: [],
    nostalgi: [],
    energi: [],
    intimitet: [],
  };
  for (const p of picks) {
    const s = (p.signals ?? {}) as Record<string, number | undefined>;
    const at = (p.startSec + p.endSec) / 2;
    result.glede.push({
      sec: at,
      val: clamp((s.emotional_peak ?? 0) * 0.7 + (s.audio_events ?? 0) * 0.3),
    });
    result.kjaerlighet.push({
      sec: at,
      val: clamp((s.faces ?? 0) * 0.6 + (s.bokeh ?? 0) * 0.4),
    });
    result.spenning.push({
      sec: at,
      val: clamp((s.action ?? 0) * 0.7 + (s.audio_events ?? 0) * 0.3),
    });
    result.nostalgi.push({
      sec: at,
      val: clamp((s.slowmo ?? 0) * 0.5 + (s.bokeh ?? 0) * 0.5),
    });
    result.energi.push({
      sec: at,
      val: clamp((s.action ?? 0) * 0.4 + (s.audio_events ?? 0) * 0.6),
    });
    result.intimitet.push({
      sec: at,
      val: clamp((s.faces ?? 0) * 0.5 + (s.bokeh ?? 0) * 0.5),
    });
  }
  return result;
}

function clamp(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
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
  marginBottom: 6,
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

const togglePill: React.CSSProperties = {
  background: "transparent",
  border: "1px solid #2e2e3a",
  color: "#7b7b8d",
  fontSize: 10.5,
  padding: "4px 10px",
  borderRadius: 14,
  cursor: "pointer",
};

const togglePillActive: React.CSSProperties = {
  background: "#22222e",
  border: "1px solid #a78bfa",
  color: "#e5e5ea",
};
