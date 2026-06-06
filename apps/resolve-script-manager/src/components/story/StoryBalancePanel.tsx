/**
 * StoryBalancePanel — 6 progress bars som visualiserer narrative
 * balanse. Utvidet fra eksisterende 5-dim computeHistorybalance.
 * Mockup-treff: høyre-sidens "STORY BALANSE"-seksjon.
 */

import { useMemo } from "react";
import type { NarrativePick } from "../../hooks/useNarrativeStructure";
import type { NarrativeStructure } from "../../hooks/useNarrativeStructure";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import BoltOutlinedIcon from "@mui/icons-material/BoltOutlined";
import HearingOutlinedIcon from "@mui/icons-material/HearingOutlined";
import TimelineOutlinedIcon from "@mui/icons-material/TimelineOutlined";
import ShuffleOutlinedIcon from "@mui/icons-material/ShuffleOutlined";
import StarBorderOutlinedIcon from "@mui/icons-material/StarBorderOutlined";
import type { SvgIconComponent } from "@mui/icons-material";

interface Props {
  picks: NarrativePick[];
  structure: NarrativeStructure;
}

interface BalanceDimension {
  id: string;
  label: string;
  Icon: SvgIconComponent;
  value: number; // 0..100
}

export function StoryBalancePanel({ picks, structure }: Props) {
  const dimensions = useMemo<BalanceDimension[]>(() => {
    if (picks.length === 0) {
      return [
        { id: "emosjon", label: "Emosjon", Icon: FavoriteBorderIcon, value: 0 },
        { id: "energi", label: "Energi", Icon: BoltOutlinedIcon, value: 0 },
        { id: "intimitet", label: "Intimitet", Icon: HearingOutlinedIcon, value: 0 },
        { id: "historieflyt", label: "Historieflyt", Icon: TimelineOutlinedIcon, value: 0 },
        { id: "variasjon", label: "Variasjon", Icon: ShuffleOutlinedIcon, value: 0 },
        { id: "avslutning", label: "Avslutning", Icon: StarBorderOutlinedIcon, value: 0 },
      ];
    }
    const avg = (selector: (s: Record<string, number | undefined>) => number) => {
      const vals = picks.map((p) => selector((p.signals ?? {}) as any));
      return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100);
    };
    const emosjon = avg((s) => clamp(((s.emotional_peak ?? 0) + (s.audio_events ?? 0)) / 2));
    const energi = avg((s) => clamp(((s.action ?? 0) + (s.audio_events ?? 0)) / 2));
    const intimitet = avg((s) => clamp(((s.faces ?? 0) + (s.bokeh ?? 0)) / 2));
    // Historieflyt: hvor jevnt fordelt picks er over beat-strukturen
    const beatCounts = structure.beats.map((b) => b.picks.length);
    const variance = computeVariance(beatCounts);
    const historieflyt = Math.round(Math.max(0, 100 - variance * 8));
    // Variasjon: spredning i signal-mønster
    const sigSet = new Set<string>();
    picks.forEach((p) => {
      const s = (p.signals ?? {}) as Record<string, number | undefined>;
      const dominant = ["emotional_peak", "action", "faces", "bokeh", "audio_events"]
        .reduce((max, k) => ((s[k] ?? 0) > (s[max] ?? 0) ? k : max), "emotional_peak");
      sigSet.add(dominant);
    });
    const variasjon = Math.round(Math.min(100, (sigSet.size / 5) * 100));
    // Avslutning: kvalitet på siste beat
    const outroBeat = structure.beats.find((b) => b.id === "outro" || b.id === "celebration");
    const outroQuality = outroBeat
      ? Math.round(
          (outroBeat.picks.reduce((sum, p) => sum + p.score, 0) /
            Math.max(outroBeat.picks.length, 1)) *
            100,
        )
      : 50;
    return [
      { id: "emosjon", label: "Emosjon", Icon: FavoriteBorderIcon, value: emosjon },
      { id: "energi", label: "Energi", Icon: BoltOutlinedIcon, value: energi },
      { id: "intimitet", label: "Intimitet", Icon: HearingOutlinedIcon, value: intimitet },
      { id: "historieflyt", label: "Historieflyt", Icon: TimelineOutlinedIcon, value: historieflyt },
      { id: "variasjon", label: "Variasjon", Icon: ShuffleOutlinedIcon, value: variasjon },
      { id: "avslutning", label: "Avslutning", Icon: StarBorderOutlinedIcon, value: outroQuality },
    ];
  }, [picks, structure]);

  const overall = useMemo(() => {
    const avg = dimensions.reduce((sum, d) => sum + d.value, 0) / Math.max(dimensions.length, 1);
    if (avg >= 78) return { label: "Bra balanse!", color: "#34d399" };
    if (avg >= 60) return { label: "OK balanse", color: "#fbbf24" };
    return { label: "Trenger justering", color: "#f87171" };
  }, [dimensions]);

  return (
    <section style={panel} data-testid="story-balance-panel">
      <header style={panelHeader}>
        <h3 style={panelTitle}>
          Story balanse <span style={infoBadge}>i</span>
        </h3>
        <span style={{ ...overallBadge, color: overall.color, borderColor: overall.color }}>
          {overall.label}
        </span>
      </header>

      <div style={list}>
        {dimensions.map((d) => (
          <div key={d.id} style={dimRow} data-testid={`balance-dim-${d.id}`}>
            <div style={dimLabel}>
              <d.Icon sx={{ fontSize: 14, color: "#9ca3af", marginRight: "6px" }} />
              {d.label}
            </div>
            <div style={dimBar}>
              <div
                style={{
                  ...dimBarFill,
                  width: `${d.value}%`,
                  background:
                    d.value >= 75
                      ? "#34d399"
                      : d.value >= 55
                      ? "#fbbf24"
                      : "#f87171",
                }}
              />
            </div>
            <div style={dimValue}>{d.value}%</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function clamp(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function computeVariance(arr: number[]): number {
  if (arr.length === 0) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const sq = arr.map((v) => (v - mean) ** 2).reduce((a, b) => a + b, 0) / arr.length;
  return Math.sqrt(sq);
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
  marginBottom: 14,
};

const panelTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 11,
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

const overallBadge: React.CSSProperties = {
  fontSize: 10.5,
  border: "1px solid",
  borderRadius: 999,
  padding: "2px 10px",
  fontWeight: 600,
};

const list: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const dimRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "100px 1fr 38px",
  alignItems: "center",
  gap: 8,
};

const dimLabel: React.CSSProperties = {
  fontSize: 11.5,
  color: "#cbcbd5",
  display: "flex",
  alignItems: "center",
};

const dimBar: React.CSSProperties = {
  height: 6,
  background: "#22222e",
  borderRadius: 3,
  overflow: "hidden",
};

const dimBarFill: React.CSSProperties = {
  height: "100%",
  borderRadius: 3,
  transition: "width 0.3s",
};

const dimValue: React.CSSProperties = {
  fontSize: 10.5,
  color: "#9ca3af",
  textAlign: "right",
  fontFamily: "ui-monospace, monospace",
};
