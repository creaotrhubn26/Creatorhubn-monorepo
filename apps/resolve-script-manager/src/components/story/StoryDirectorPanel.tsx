/**
 * StoryDirectorPanel — høyresidens Claude-anbefalinger.
 * Genererer 2-4 forslag basert på narrative-strukturen.
 * Mockup-treff: "CLAUDE – STORY DIRECTOR (BETA)"-seksjonen.
 *
 * MVP: heuristikk-baserte anbefalinger fra structure + picks. Kan
 * utvides til claude_chat-kall senere uten å endre signatur.
 */

import { useMemo } from "react";
import type { NarrativePick } from "../../hooks/useNarrativeStructure";
import type { NarrativeStructure } from "../../hooks/useNarrativeStructure";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import StarBorderOutlinedIcon from "@mui/icons-material/StarBorderOutlined";
import VideoFileOutlinedIcon from "@mui/icons-material/VideoFileOutlined";
import type { SvgIconComponent } from "@mui/icons-material";

interface Props {
  picks: NarrativePick[];
  structure: NarrativeStructure;
  onGenerateAlternative: () => void;
  onApplyRecommendation: (recId: string) => void;
}

interface Recommendation {
  id: string;
  title: string;
  body: string;
  Icon: SvgIconComponent;
  iconColor: string;
  actionLabel: string;
  actionCount?: number;
}

export function StoryDirectorPanel({
  picks,
  structure,
  onGenerateAlternative,
  onApplyRecommendation,
}: Props) {
  const recommendations = useMemo<Recommendation[]>(
    () => generateRecommendations(picks, structure),
    [picks, structure],
  );

  return (
    <aside style={panel} data-testid="story-director-panel">
      <header style={panelHeader}>
        <div>
          <div style={panelLabel}>CLAUDE – STORY DIRECTOR</div>
          <span style={betaBadge}>BETA</span>
        </div>
        <span style={infoBadge}>i</span>
      </header>

      <div style={summaryBox}>
        <FavoriteBorderIcon sx={{ fontSize: 14, color: "#ec4899", marginRight: "6px", verticalAlign: "text-bottom" }} />
        <strong>Historien din har en sterk emosjonell bue</strong>
        <div style={summaryHint}>
          Her er mine viktigste anbefalinger for å gjøre den enda sterkere.
        </div>
      </div>

      <div style={recList} data-testid="story-recommendations">
        {recommendations.map((rec) => (
          <article
            key={rec.id}
            style={recCard}
            data-testid={`recommendation-${rec.id}`}
          >
            <header style={recHeader}>
              <rec.Icon sx={{ fontSize: 16, color: rec.iconColor }} />
              <span style={recTitle}>{rec.title}</span>
            </header>
            <p style={recBody}>{rec.body}</p>
            <button
              style={recAction}
              onClick={() => onApplyRecommendation(rec.id)}
            >
              📋 {rec.actionLabel}
              {rec.actionCount != null && ` (${rec.actionCount} klipp)`}
            </button>
          </article>
        ))}
        {recommendations.length === 0 && (
          <div style={emptyState}>
            Ingen anbefalinger ennå. Velg footage og last picks.
          </div>
        )}
      </div>

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

function generateRecommendations(
  picks: NarrativePick[],
  structure: NarrativeStructure,
): Recommendation[] {
  if (picks.length === 0) return [];

  const recs: Recommendation[] = [];

  // Heuristikk 1: peak-tetthet
  const peakBeat = structure.beats.find((b) => b.id === "peak");
  if (peakBeat && peakBeat.picks.length < 3) {
    recs.push({
      id: "more-breathing-before-peak",
      title: "Mer pust før peak",
      body:
        "Vurder å gjøre delen før vielsen litt roligere. Et ekstra øyeblikk med brudens reaksjon vil gjøre toppen mer effektfull.",
      Icon: FavoriteBorderIcon,
      iconColor: "#ec4899",
      actionLabel: "Se forslag",
      actionCount: 3,
    });
  }

  // Heuristikk 2: parents/family reactions
  const faceSignals = picks.filter(
    (p) => ((p.signals?.faces as number | undefined) ?? 0) > 0.5,
  ).length;
  if (faceSignals < picks.length * 0.3) {
    recs.push({
      id: "parent-reactions",
      title: "Reaksjon fra foreldre",
      body:
        "Jeg ser at du har fine klipp fra talen, men mangler reaksjon fra foreldre. Dette vil forsterke emosjonen.",
      Icon: VisibilityOutlinedIcon,
      iconColor: "#a78bfa",
      actionLabel: "Finn reaksjonsklipp",
    });
  }

  // Heuristikk 3: outro/avslutning kvalitet
  const outro = structure.beats.find((b) => b.id === "outro");
  if (!outro || outro.picks.length < 2) {
    recs.push({
      id: "stronger-outro",
      title: "Sterkere avslutning",
      body:
        "Avslutningen kan bygge ut følelsen litt mer. Et nattbilde eller et siste intimt øyeblikk vil gi en fin etterklang.",
      Icon: StarBorderOutlinedIcon,
      iconColor: "#fbbf24",
      actionLabel: "Se forslag",
      actionCount: 2,
    });
  }

  // Heuristikk 4: variasjon i shot-typer
  const uniqueChapters = new Set(picks.map((p) => p.chapter ?? "—")).size;
  if (uniqueChapters < 4) {
    recs.push({
      id: "more-variety",
      title: "Mer variasjon i shots",
      body:
        "Historien lener seg mye på samme type klipp. Vurder å legge til detaljbilder eller bredere atmosfære-shots.",
      Icon: VideoFileOutlinedIcon,
      iconColor: "#60a5fa",
      actionLabel: "Vis kandidater",
    });
  }

  return recs.slice(0, 3);
}

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
