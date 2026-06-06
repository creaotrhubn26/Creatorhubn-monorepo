/**
 * StoryElementsSidebar — venstre menyseksjon i Story-fanen.
 * Mockup-treff: "STORY ELEMENTER" + "INTENT & STIL" + "PROSJEKTINFORMASJON".
 *
 * Hver element-rad scroller til/aktiverer korresponderende panel i hoved-
 * arealet. State holdes lokalt; scroll-handling skjer via id-ankre.
 */

import TimelineOutlinedIcon from "@mui/icons-material/TimelineOutlined";
import MenuBookOutlinedIcon from "@mui/icons-material/MenuBookOutlined";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import PeopleOutlineOutlinedIcon from "@mui/icons-material/PeopleOutlineOutlined";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import LabelOutlinedIcon from "@mui/icons-material/LabelOutlined";
import ViewColumnOutlinedIcon from "@mui/icons-material/ViewColumnOutlined";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import PaletteOutlinedIcon from "@mui/icons-material/PaletteOutlined";
import type { SvgIconComponent } from "@mui/icons-material";

export type StoryElementId =
  | "arc"
  | "beats"
  | "scene-graph"
  | "characters"
  | "emotional-flow"
  | "theme"
  | "content-pillars"
  | "visual-motifs"
  | "intent-style";

interface Props {
  activeElement: StoryElementId;
  onSelectElement: (id: StoryElementId) => void;
  intentStyle: { label: string; description: string; tags: string[] };
  projectInfo: {
    project: string;
    client: string;
    duration: string;
    format: string;
    created: string;
    updated: string;
  };
  onEditIntent: () => void;
}

interface ElementDef {
  id: StoryElementId;
  label: string;
  Icon: SvgIconComponent;
}

const ELEMENTS: ElementDef[] = [
  { id: "arc", label: "Story Arc", Icon: TimelineOutlinedIcon },
  { id: "beats", label: "Narrative Beats", Icon: MenuBookOutlinedIcon },
  { id: "scene-graph", label: "Scene Graph", Icon: AccountTreeOutlinedIcon },
  { id: "characters", label: "Karakterer", Icon: PeopleOutlineOutlinedIcon },
  { id: "emotional-flow", label: "Emosjonell flyt", Icon: FavoriteBorderIcon },
  { id: "theme", label: "Tema & Budskap", Icon: LabelOutlinedIcon },
  { id: "content-pillars", label: "Innholdspilarer", Icon: ViewColumnOutlinedIcon },
  { id: "visual-motifs", label: "Visuelle motiver", Icon: AutoAwesomeOutlinedIcon },
  { id: "intent-style", label: "Intent & Stil", Icon: PaletteOutlinedIcon },
];

export function StoryElementsSidebar({
  activeElement,
  onSelectElement,
  intentStyle,
  projectInfo,
  onEditIntent,
}: Props) {
  return (
    <aside style={sidebar} data-testid="story-elements-sidebar">
      <section>
        <div style={sectionLabel}>STORY ELEMENTER</div>
        <nav style={menu} role="list">
          {ELEMENTS.map((el) => {
            const active = el.id === activeElement;
            return (
              <button
                key={el.id}
                role="listitem"
                onClick={() => onSelectElement(el.id)}
                style={{
                  ...menuItem,
                  ...(active ? menuItemActive : null),
                }}
                data-testid={`story-element-${el.id}`}
                aria-current={active ? "true" : undefined}
              >
                <el.Icon sx={{ fontSize: 16, color: active ? "#a78bfa" : "#7b7b8d" }} />
                <span>{el.label}</span>
              </button>
            );
          })}
        </nav>
      </section>

      <section style={{ marginTop: 16 }}>
        <div style={sectionHeader}>
          <span style={sectionLabel}>INTENT &amp; STIL</span>
          <button style={editLink} onClick={onEditIntent}>
            Rediger
          </button>
        </div>
        <div style={intentBody} data-testid="intent-style">
          <div style={intentTitle}>{intentStyle.label}</div>
          <div style={intentDesc}>{intentStyle.description}</div>
          <div style={tagRow}>
            {intentStyle.tags.map((tag) => (
              <span key={tag} style={tagPill}>
                {tag}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section style={{ marginTop: 16 }}>
        <div style={sectionLabel}>PROSJEKTINFORMASJON</div>
        <dl style={infoGrid} data-testid="project-info">
          <Row label="Prosjekt" value={projectInfo.project} />
          <Row label="Kunde" value={projectInfo.client} />
          <Row label="Varighet (mål)" value={projectInfo.duration} />
          <Row label="Format" value={projectInfo.format} />
          <Row label="Opprettet" value={projectInfo.created} />
          <Row label="Sist oppdatert" value={projectInfo.updated} />
        </dl>
      </section>
    </aside>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt style={infoLabel}>{label}</dt>
      <dd style={infoValue}>{value}</dd>
    </>
  );
}

const sidebar: React.CSSProperties = {
  background: "#101018",
  borderRight: "1px solid #2a2a36",
  padding: "14px 14px",
  width: 220,
  flexShrink: 0,
  overflowY: "auto",
};

const sectionHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 8,
};

const sectionLabel: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: 0.8,
  color: "#5d5d6f",
  marginBottom: 8,
  display: "block",
};

const menu: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
};

const menuItem: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "8px 10px",
  background: "transparent",
  border: 0,
  borderRadius: 6,
  color: "#a8a8b8",
  fontSize: 12.5,
  cursor: "pointer",
  textAlign: "left",
  width: "100%",
};

const menuItemActive: React.CSSProperties = {
  background: "#1c1c26",
  color: "#e5e5ea",
};

const editLink: React.CSSProperties = {
  background: "transparent",
  border: 0,
  color: "#a78bfa",
  fontSize: 10.5,
  cursor: "pointer",
};

const intentBody: React.CSSProperties = {
  background: "#1c1c26",
  borderRadius: 8,
  padding: "10px 12px",
};

const intentTitle: React.CSSProperties = {
  fontSize: 12.5,
  fontWeight: 600,
  color: "#e5e5ea",
};

const intentDesc: React.CSSProperties = {
  fontSize: 11,
  color: "#a8a8b8",
  marginTop: 4,
  lineHeight: 1.45,
};

const tagRow: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 4,
  marginTop: 8,
};

const tagPill: React.CSSProperties = {
  background: "#22222e",
  border: "1px solid #2e2e3a",
  color: "#cbcbd5",
  fontSize: 10,
  padding: "2px 8px",
  borderRadius: 999,
};

const infoGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "auto 1fr",
  gap: "4px 10px",
  margin: 0,
  fontSize: 11,
};

const infoLabel: React.CSSProperties = {
  color: "#7b7b8d",
};

const infoValue: React.CSSProperties = {
  margin: 0,
  color: "#cbcbd5",
};
