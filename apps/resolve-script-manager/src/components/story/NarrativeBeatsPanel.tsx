/**
 * NarrativeBeatsPanel — liste-visning av narrative beats med tidsmerker.
 * Mockup-treff: høyre-sidens "NARRATIVE BEATS"-seksjon.
 */

import type { NarrativeBeat } from "../../hooks/useNarrativeStructure";

interface Props {
  beats: NarrativeBeat[];
  focusedBeatId: string | null;
  onSelectBeat: (id: string | null) => void;
}

const BEAT_COLORS: Record<string, string> = {
  hook: "#a78bfa",
  setup: "#60a5fa",
  build: "#f59e0b",
  peak: "#ec4899",
  celebration: "#34d399",
  outro: "#94a3b8",
};

export function NarrativeBeatsPanel({ beats, focusedBeatId, onSelectBeat }: Props) {
  return (
    <section style={panel} data-testid="narrative-beats-panel">
      <h3 style={panelTitle}>Narrative beats</h3>
      <div style={list}>
        {beats.length === 0 && (
          <div style={emptyState}>Ingen beats ennå — velg footage.</div>
        )}
        {beats.map((b) => (
          <div
            key={b.id}
            style={{
              ...beatItem,
              outline:
                focusedBeatId === b.id
                  ? `1px solid ${BEAT_COLORS[b.id]}`
                  : "1px solid transparent",
              background:
                focusedBeatId === b.id
                  ? "rgba(167,139,250,0.06)"
                  : "transparent",
            }}
            onClick={() => onSelectBeat(focusedBeatId === b.id ? null : b.id)}
            data-testid={`narrative-beat-${b.id}`}
          >
            <span style={{ ...beatDot, background: BEAT_COLORS[b.id] }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={beatLabel}>{b.label}</div>
              <div style={beatTime}>{formatTimeRange(b.startSec, b.endSec)}</div>
              <div style={beatHint}>{b.hint}</div>
            </div>
          </div>
        ))}
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
};

const panelTitle: React.CSSProperties = {
  margin: "0 0 12px",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0.8,
  textTransform: "uppercase",
  color: "#9ca3af",
};

const list: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const beatItem: React.CSSProperties = {
  display: "flex",
  gap: 10,
  padding: "8px 10px",
  borderRadius: 8,
  cursor: "pointer",
  transition: "background 0.1s",
  alignItems: "flex-start",
};

const beatDot: React.CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: "50%",
  marginTop: 4,
  flexShrink: 0,
};

const beatLabel: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "#e5e5ea",
  lineHeight: 1.3,
};

const beatTime: React.CSSProperties = {
  fontSize: 10.5,
  color: "#7b7b8d",
  fontFamily: "ui-monospace, monospace",
  marginTop: 2,
};

const beatHint: React.CSSProperties = {
  fontSize: 11,
  color: "#a8a8b8",
  marginTop: 4,
  lineHeight: 1.4,
};

const emptyState: React.CSSProperties = {
  padding: "20px 12px",
  textAlign: "center",
  color: "#5d5d6f",
  fontSize: 11,
};
