/**
 * SceneGraphPanel — node-graph der hver primary node er et beat (Scene),
 * og alternativene under er pick-varianter brukeren kan velge mellom.
 * Mockup-treff: nederste seksjon "SCENE GRAPH".
 */

import { useMemo } from "react";
import type { NarrativeStructure, NarrativePick } from "../../hooks/useNarrativeStructure";
import { convertFileSrc } from "@tauri-apps/api/core";

interface Props {
  structure: NarrativeStructure;
  focusedPickIndex: number | null;
  onFocusPick: (pickIndex: number | null) => void;
}

export function SceneGraphPanel({
  structure,
  focusedPickIndex,
  onFocusPick,
}: Props) {
  const { beats } = structure;

  const rows = useMemo(() => {
    // Primary row = første pick per beat
    // Secondary row = neste pick per beat (alternativ)
    const primary = beats.map((b) => ({
      beatId: b.id,
      label: b.label,
      pick: b.picks[0] ?? null,
      timeRange: { start: b.startSec, end: b.endSec },
    }));
    const secondary = beats.map((b) => ({
      beatId: b.id,
      pick: b.picks[1] ?? null,
      label: generateAlternativeLabel(b.picks[1]),
    }));
    return { primary, secondary };
  }, [beats]);

  if (beats.length === 0) {
    return (
      <section style={panel} data-testid="scene-graph-panel">
        <h3 style={panelTitle}>Scene graph</h3>
        <div style={emptyState}>Ingen beats å vise ennå.</div>
      </section>
    );
  }

  return (
    <section style={panel} data-testid="scene-graph-panel">
      <header style={panelHeader}>
        <h3 style={panelTitle}>Scene graph</h3>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <span style={smallLabel}>Vis alternativer</span>
          <button style={iconBtn} aria-label="collapse">−</button>
          <button style={iconBtn} aria-label="expand">+</button>
        </div>
      </header>

      {/* Primary row */}
      <div style={primaryRow} data-testid="scene-graph-primary-row">
        {rows.primary.map((node, i) => (
          <div key={node.beatId} style={{ display: "contents" }}>
            <div
              style={{
                ...sceneNode,
                outline:
                  node.pick && node.pick.index === focusedPickIndex
                    ? "2px solid #f472b6"
                    : "1px solid #2e2e3a",
              }}
              onClick={() => node.pick && onFocusPick(node.pick.index)}
              data-testid={`scene-node-${node.beatId}`}
            >
              <div style={sceneThumb}>
                {node.pick?.thumbnailPath ? (
                  <img
                    src={convertFileSrc(node.pick.thumbnailPath)}
                    alt={node.label}
                    style={sceneThumbImg}
                  />
                ) : (
                  <div style={sceneThumbPlaceholder} />
                )}
              </div>
              <div style={sceneInfo}>
                <div style={sceneLabel}>{node.label}</div>
                <div style={sceneTime}>
                  {formatTimeRange(node.timeRange.start, node.timeRange.end)}
                </div>
              </div>
            </div>
            {i < rows.primary.length - 1 && (
              <div style={connector} aria-hidden>
                →
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Secondary row (alternatives) */}
      <div style={secondaryRow} data-testid="scene-graph-secondary-row">
        {rows.secondary.map((alt, i) => (
          <div key={`alt-${i}`} style={altSlot}>
            {alt.pick ? (
              <>
                <div style={vConnector} aria-hidden>
                  ⋮
                </div>
                <div
                  style={{
                    ...altNode,
                    outline:
                      alt.pick.index === focusedPickIndex
                        ? "2px solid #f472b6"
                        : "1px solid #2e2e3a",
                  }}
                  onClick={() => onFocusPick(alt.pick!.index)}
                  data-testid={`scene-alt-${alt.beatId}`}
                >
                  <div style={altThumb}>
                    {alt.pick.thumbnailPath ? (
                      <img
                        src={convertFileSrc(alt.pick.thumbnailPath)}
                        alt={alt.label}
                        style={sceneThumbImg}
                      />
                    ) : (
                      <div style={sceneThumbPlaceholder} />
                    )}
                  </div>
                  <div style={altInfo}>
                    <div style={altLabel}>{alt.label}</div>
                    <div style={altTime}>{formatTime(alt.pick.startSec)}</div>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ height: 90 }} />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function generateAlternativeLabel(pick: NarrativePick | undefined): string {
  if (!pick) return "—";
  const s = (pick.signals ?? {}) as Record<string, number | undefined>;
  if ((s.faces ?? 0) > 0.6) return "Reaksjon";
  if ((s.action ?? 0) > 0.6) return "Action";
  if ((s.bokeh ?? 0) > 0.5) return "Detalj";
  if ((s.audio_events ?? 0) > 0.6) return "Jubel";
  return "Alternativ";
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

const panelHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 16,
};

const panelTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 0.8,
  textTransform: "uppercase",
  color: "#9ca3af",
};

const smallLabel: React.CSSProperties = {
  fontSize: 11,
  color: "#7b7b8d",
};

const iconBtn: React.CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: 4,
  background: "#22222e",
  border: "1px solid #2e2e3a",
  color: "#a8a8b8",
  cursor: "pointer",
  fontSize: 14,
  lineHeight: 1,
};

const primaryRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginBottom: 28,
};

const secondaryRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(7, 1fr)",
  gap: 8,
  marginTop: -4,
};

const sceneNode: React.CSSProperties = {
  flex: "1 1 0",
  minWidth: 0,
  background: "#1c1c26",
  borderRadius: 8,
  overflow: "hidden",
  cursor: "pointer",
};

const sceneThumb: React.CSSProperties = {
  width: "100%",
  aspectRatio: "16 / 9",
  background: "#0f0f17",
};

const sceneThumbImg: React.CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

const sceneThumbPlaceholder: React.CSSProperties = {
  width: "100%",
  height: "100%",
  background: "linear-gradient(135deg, #2a2a36, #1c1c26)",
};

const sceneInfo: React.CSSProperties = {
  padding: "6px 10px 8px",
};

const sceneLabel: React.CSSProperties = {
  fontSize: 11.5,
  fontWeight: 600,
  color: "#e5e5ea",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const sceneTime: React.CSSProperties = {
  fontSize: 9.5,
  color: "#7b7b8d",
  fontFamily: "ui-monospace, monospace",
  marginTop: 1,
};

const connector: React.CSSProperties = {
  fontSize: 18,
  color: "#3b82f6",
  fontWeight: 600,
  flex: "0 0 18px",
  textAlign: "center",
};

const altSlot: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
};

const vConnector: React.CSSProperties = {
  fontSize: 14,
  color: "#3a3a4a",
  margin: "-22px 0 0 0",
  height: 22,
  lineHeight: "22px",
};

const altNode: React.CSSProperties = {
  background: "#1c1c26",
  borderRadius: 6,
  overflow: "hidden",
  width: "100%",
  cursor: "pointer",
};

const altThumb: React.CSSProperties = {
  width: "100%",
  aspectRatio: "16 / 9",
  background: "#0f0f17",
};

const altInfo: React.CSSProperties = {
  padding: "5px 8px 7px",
};

const altLabel: React.CSSProperties = {
  fontSize: 11,
  color: "#e5e5ea",
  fontWeight: 500,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const altTime: React.CSSProperties = {
  fontSize: 9.5,
  color: "#7b7b8d",
  fontFamily: "ui-monospace, monospace",
};

const emptyState: React.CSSProperties = {
  padding: "30px 16px",
  textAlign: "center",
  color: "#5d5d6f",
  fontSize: 12,
};
