/**
 * StoryView — hovedinnholdet for Story-tab i CreativeEditorView.
 * 3-kolonne layout:
 *
 *   [ Elements sidebar ] [ hovedinnhold ] [ Story Director ]
 *
 * Hovedinnholdet er en vertikal stack av paneler:
 *   STORY ARC
 *   EMOSJONELL FLYT  |  NARRATIVE BEATS
 *   SCENE GRAPH
 *
 * Tre høyrekolonnen har Story Director + Story Balanse.
 *
 * All state er DERIVERT fra picks + chapters — ingen ny lagring.
 * Synkronisering med Rediger-fanen skjer via shared state-callbacks.
 */

import { useState } from "react";
import type { NarrativePick } from "../../hooks/useNarrativeStructure";
import type { ChapterDef } from "../../agents/types";
import { useNarrativeStructure } from "../../hooks/useNarrativeStructure";
import { StoryElementsSidebar, type StoryElementId } from "./StoryElementsSidebar";
import { StoryArcPanel } from "./StoryArcPanel";
import { EmotionalFlowPanel } from "./EmotionalFlowPanel";
import { NarrativeBeatsPanel } from "./NarrativeBeatsPanel";
import { SceneGraphPanel } from "./SceneGraphPanel";
import { StoryDirectorPanel } from "./StoryDirectorPanel";
import { StoryBalancePanel } from "./StoryBalancePanel";

interface Props {
  picks: NarrativePick[];
  chapters: ChapterDef[];
  focusedPickIndex: number | null;
  onFocusPick: (pickIndex: number | null) => void;
  /** Intent & stil-meta (utleder fra agent-config eller manuelt). */
  intentStyle?: { label: string; description: string; tags: string[] };
  /** Prosjekt-info shown i venstre kolonne. */
  projectInfo: {
    project: string;
    client: string;
    duration: string;
    format: string;
    created: string;
    updated: string;
  };
  /** Når "Generer alternativ historie" klikkes. */
  onGenerateAlternative?: () => void;
  /** Når en Story Director-anbefaling klikkes. */
  onApplyRecommendation?: (
    rec: import("../../hooks/useStoryRecommendations").StoryRecommendation,
  ) => void;
  /** Pick-indekser som highlightes (sekundær — ikke focused, men relatert). */
  highlightedPickIndices?: number[];
  /** Tilbakeknapp ned i wizard-footer (forventes wired av parent). */
  onBackToProject?: () => void;
  onStartEditing?: () => void;
}

const DEFAULT_INTENT_STYLE = {
  label: "Cinematic / Emotional",
  description:
    "En tidløs, emosjonell highlight med fokus på ekte øyeblikk og relasjoner.",
  tags: ["Emosjonell", "Cinematisk", "Tidløs", "Naturlig", "Varm fargetone"],
};

export function StoryView({
  picks,
  chapters,
  focusedPickIndex,
  onFocusPick,
  intentStyle = DEFAULT_INTENT_STYLE,
  projectInfo,
  onGenerateAlternative = () => {},
  onApplyRecommendation = () => {},
  highlightedPickIndices = [],
  onBackToProject,
  onStartEditing,
}: Props) {
  const [activeElement, setActiveElement] = useState<StoryElementId>("arc");
  const [focusedBeatId, setFocusedBeatId] = useState<string | null>(null);

  const structure = useNarrativeStructure(picks, chapters);

  return (
    <div style={root} data-testid="story-view">
      {/* Venstre kolonne: Elements + Intent + Project info */}
      <StoryElementsSidebar
        activeElement={activeElement}
        onSelectElement={(id) => {
          setActiveElement(id);
          // Scroll til seksjon-ankret
          const el = document.getElementById(`story-section-${id}`);
          el?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
        intentStyle={intentStyle}
        projectInfo={projectInfo}
        onEditIntent={() => {
          /* Wired av parent senere */
        }}
      />

      {/* Midt-kolonne: paneler stacket vertikalt */}
      <main style={mainCol} data-testid="story-main">
        <div id="story-section-arc">
          <StoryArcPanel
            structure={structure}
            focusedPickIndex={focusedPickIndex}
            onFocusPick={onFocusPick}
            highlightedPickIndices={highlightedPickIndices}
          />
        </div>

        <div style={twoCol}>
          <div id="story-section-emotional-flow" style={{ minWidth: 0 }}>
            <EmotionalFlowPanel picks={picks} />
          </div>
          <div id="story-section-beats" style={{ minWidth: 0 }}>
            <NarrativeBeatsPanel
              beats={structure.beats}
              focusedBeatId={focusedBeatId}
              onSelectBeat={setFocusedBeatId}
            />
          </div>
        </div>

        <div id="story-section-scene-graph">
          <SceneGraphPanel
            structure={structure}
            focusedPickIndex={focusedPickIndex}
            onFocusPick={onFocusPick}
          />
        </div>

        {/* Wizard-footer */}
        <footer style={wizardFooter} data-testid="story-wizard-footer">
          <button style={backBtn} onClick={onBackToProject}>
            ← Tilbake til prosjekt
          </button>
          <div style={wizardSteps}>
            <WizardStep n={1} label="Velg segmenter" active />
            <span style={wizardStepSeparator} />
            <WizardStep n={2} label="Forhåndsvisning" active />
            <span style={wizardStepSeparator} />
            <WizardStep n={3} label="Redigering" />
            <span style={wizardStepSeparator} />
            <WizardStep n={4} label="Eksporter" />
          </div>
          <button style={ctaBtn} onClick={onStartEditing}>
            Start redigering →
          </button>
        </footer>
      </main>

      {/* Høyre kolonne: Director + Balance */}
      <aside style={rightCol} data-testid="story-right-rail">
        <StoryDirectorPanel
          picks={picks}
          structure={structure}
          onGenerateAlternative={onGenerateAlternative}
          onApplyRecommendation={onApplyRecommendation}
          projectBrief={{
            type: projectInfo.project || "Prosjekt",
            intent: intentStyle.label,
          }}
        />
        <StoryBalancePanel picks={picks} structure={structure} />
      </aside>
    </div>
  );
}

function WizardStep({ n, label, active }: { n: number; label: string; active?: boolean }) {
  return (
    <span style={wizardStep} data-testid={`wizard-step-${n}`}>
      <span style={{ ...wizardStepNum, ...(active ? wizardStepNumActive : null) }}>
        {active ? "✓" : n}
      </span>
      <span style={{ ...wizardStepLabel, ...(active ? wizardStepLabelActive : null) }}>
        {label}
      </span>
    </span>
  );
}

const root: React.CSSProperties = {
  display: "flex",
  background: "#0b0b12",
  color: "#e5e5ea",
  height: "100%",
  minHeight: 0,
};

const mainCol: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  overflowY: "auto",
  padding: "16px 18px",
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const twoCol: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 2fr) minmax(280px, 1fr)",
  gap: 12,
  marginBottom: 12,
};

const rightCol: React.CSSProperties = {
  width: 320,
  flexShrink: 0,
  padding: "16px 16px",
  borderLeft: "1px solid #2a2a36",
  background: "#101018",
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const wizardFooter: React.CSSProperties = {
  marginTop: 16,
  padding: "12px 14px",
  background: "#101018",
  border: "1px solid #2a2a36",
  borderRadius: 12,
  display: "grid",
  gridTemplateColumns: "auto 1fr auto",
  alignItems: "center",
  gap: 14,
};

const backBtn: React.CSSProperties = {
  background: "#1c1c26",
  border: "1px solid #2e2e3a",
  color: "#cbcbd5",
  fontSize: 12,
  padding: "8px 14px",
  borderRadius: 8,
  cursor: "pointer",
};

const wizardSteps: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  fontSize: 12,
};

const wizardStep: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  color: "#5d5d6f",
};

const wizardStepNum: React.CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: "50%",
  background: "#22222e",
  border: "1px solid #2e2e3a",
  color: "#7b7b8d",
  fontSize: 11,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 600,
};

const wizardStepNumActive: React.CSSProperties = {
  background: "#a78bfa",
  border: "1px solid #a78bfa",
  color: "white",
};

const wizardStepLabel: React.CSSProperties = {
  color: "#7b7b8d",
};

const wizardStepLabelActive: React.CSSProperties = {
  color: "#cbcbd5",
};

const wizardStepSeparator: React.CSSProperties = {
  flex: "0 0 24px",
  height: 1,
  background: "#2a2a36",
};

const ctaBtn: React.CSSProperties = {
  background: "linear-gradient(135deg, #a78bfa, #7c3aed)",
  border: 0,
  color: "white",
  fontSize: 12.5,
  fontWeight: 600,
  padding: "10px 22px",
  borderRadius: 8,
  cursor: "pointer",
};
