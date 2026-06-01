/**
 * StoryDirectorPanel — høyresidens Claude-anbefalinger.
 *
 * Genererer 2-4 forslag fra Claude (via post-agent-proxy) med
 * heuristikk-fallback. Se `useStoryRecommendations` for detaljer om
 * source-badge (heuristikk / claude / fallback).
 *
 * Mockup-treff: "CLAUDE – STORY DIRECTOR (BETA)"-seksjonen.
 */

import type { NarrativePick } from "../../hooks/useNarrativeStructure";
import type { NarrativeStructure } from "../../hooks/useNarrativeStructure";
import {
  useStoryRecommendations,
  type RecommendationCategory,
  type StoryRecommendation,
} from "../../hooks/useStoryRecommendations";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import StarBorderOutlinedIcon from "@mui/icons-material/StarBorderOutlined";
import VideoFileOutlinedIcon from "@mui/icons-material/VideoFileOutlined";
import TimelineOutlinedIcon from "@mui/icons-material/TimelineOutlined";
import type { SvgIconComponent } from "@mui/icons-material";

interface Props {
  picks: NarrativePick[];
  structure: NarrativeStructure;
  onGenerateAlternative: () => void;
  onApplyRecommendation: (recId: string) => void;
  /** Brief sendt til Claude for å forme ton + språk. */
  projectBrief?: { type: string; intent?: string };
}

const ICON_BY_CATEGORY: Record<RecommendationCategory, { Icon: SvgIconComponent; color: string }> = {
  emotion: { Icon: FavoriteBorderIcon, color: "#ec4899" },
  variety: { Icon: VideoFileOutlinedIcon, color: "#60a5fa" },
  structure: { Icon: VisibilityOutlinedIcon, color: "#a78bfa" },
  ending: { Icon: StarBorderOutlinedIcon, color: "#fbbf24" },
  pacing: { Icon: TimelineOutlinedIcon, color: "#34d399" },
};

export function StoryDirectorPanel({
  picks,
  structure,
  onGenerateAlternative,
  onApplyRecommendation,
  projectBrief,
}: Props) {
  const { recommendations, summary, source, loading, error } = useStoryRecommendations({
    picks,
    structure,
    projectBrief,
  });

  return (
    <aside style={panel} data-testid="story-director-panel" data-source={source}>
      <header style={panelHeader}>
        <div>
          <div style={panelLabel}>CLAUDE – STORY DIRECTOR</div>
          <span style={betaBadge}>
            {source === "claude" ? "LIVE" : source === "fallback" ? "OFFLINE" : "BETA"}
          </span>
        </div>
        <span style={infoBadge} title={error ?? undefined}>i</span>
      </header>

      <div style={summaryBox}>
        <FavoriteBorderIcon sx={{ fontSize: 14, color: "#ec4899", marginRight: "6px", verticalAlign: "text-bottom" }} />
        <strong>{summary}</strong>
        <div style={summaryHint}>
          {loading
            ? "Claude leser strukturen din…"
            : "Her er mine viktigste anbefalinger for å gjøre den enda sterkere."}
        </div>
      </div>

      <div style={recList} data-testid="story-recommendations">
        {recommendations.map((rec) => {
          const { Icon, color } = ICON_BY_CATEGORY[rec.category];
          return (
            <article
              key={rec.id}
              style={recCard}
              data-testid={`recommendation-${rec.id}`}
              data-category={rec.category}
            >
              <header style={recHeader}>
                <Icon sx={{ fontSize: 16, color }} />
                <span style={recTitle}>{rec.title}</span>
              </header>
              <p style={recBody}>{rec.body}</p>
              <button
                style={recAction}
                onClick={() => onApplyRecommendation(rec.id)}
              >
                Se forslag
                {rec.actionCount != null && ` (${rec.actionCount} klipp)`}
              </button>
            </article>
          );
        })}
        {recommendations.length === 0 && (
          <div style={emptyState}>
            Ingen anbefalinger ennå. Velg footage og last picks.
          </div>
        )}
      </div>

      {error && (
        <div style={errorHint} data-testid="story-director-error">
          {error}
        </div>
      )}

      <button
        style={generateBtn}
        onClick={onGenerateAlternative}
        data-testid="generate-alternative-story"
      >
        <AutoAwesomeIcon sx={{ fontSize: 14, marginRight: "6px", verticalAlign: "text-bottom" }} />
        Generer alternativ historie
      </button>
    </aside>
  );
}

// Bevarer eksisterende type-eksporter for konsumenter (ingen i dag, men
// dokumentasjon-sak).
export type { StoryRecommendation };

const panel: React.CSSProperties = {
  background: "#15151c",
  border: "1px solid #2a2a36",
  borderRadius: 12,
  padding: "16px 18px",
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const panelHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
};

const panelLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0.8,
  color: "#9ca3af",
  display: "inline-block",
  marginRight: 6,
};

const betaBadge: React.CSSProperties = {
  fontSize: 9,
  background: "#a78bfa20",
  border: "1px solid #a78bfa50",
  color: "#a78bfa",
  padding: "1px 6px",
  borderRadius: 6,
  fontWeight: 600,
  letterSpacing: 0.4,
  verticalAlign: "middle",
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

const summaryBox: React.CSSProperties = {
  background: "#1c1c26",
  border: "1px solid #2a2a36",
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 12,
  color: "#e5e5ea",
};

const summaryHint: React.CSSProperties = {
  marginTop: 6,
  fontSize: 11,
  color: "#9ca3af",
};

const recList: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const recCard: React.CSSProperties = {
  background: "#1c1c26",
  border: "1px solid #2a2a36",
  borderRadius: 10,
  padding: "12px 14px",
};

const recHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginBottom: 6,
};

const recTitle: React.CSSProperties = {
  fontSize: 12.5,
  fontWeight: 600,
  color: "#e5e5ea",
};

const recBody: React.CSSProperties = {
  margin: 0,
  fontSize: 11.5,
  lineHeight: 1.5,
  color: "#a8a8b8",
};

const recAction: React.CSSProperties = {
  marginTop: 10,
  background: "#22222e",
  border: "1px solid #2e2e3a",
  color: "#cbcbd5",
  fontSize: 11,
  padding: "5px 10px",
  borderRadius: 6,
  cursor: "pointer",
};

const errorHint: React.CSSProperties = {
  fontSize: 10,
  color: "#a3a3b8",
  background: "#22222e",
  border: "1px solid #2e2e3a",
  borderRadius: 6,
  padding: "6px 8px",
};

const generateBtn: React.CSSProperties = {
  background: "linear-gradient(135deg, #a78bfa, #7c3aed)",
  border: 0,
  color: "white",
  fontSize: 12,
  fontWeight: 600,
  padding: "10px 14px",
  borderRadius: 8,
  cursor: "pointer",
};

const emptyState: React.CSSProperties = {
  padding: "16px 8px",
  textAlign: "center",
  color: "#5d5d6f",
  fontSize: 11,
};
