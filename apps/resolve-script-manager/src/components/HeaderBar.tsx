import { useEffect, useState } from "react";
import type { HealthStatus, ProjectTemplateSummary } from "../types";
import { IconGear, IconBox, IconEye, IconMagicCut } from "./Icons";
import { UserProfile } from "./UserProfile";
import { useDepHealth, type DepHealth } from "../hooks/useDepHealth";
import { PhotoshopStatusPill } from "./PhotoshopStatusPill";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";
import BrushOutlinedIcon from "@mui/icons-material/BrushOutlined";
import AddIcon from "@mui/icons-material/Add";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import HistoryIcon from "@mui/icons-material/History";
import WavingHandOutlinedIcon from "@mui/icons-material/WavingHandOutlined";
import HelpOutlineOutlinedIcon from "@mui/icons-material/HelpOutlineOutlined";
import FeedbackOutlinedIcon from "@mui/icons-material/FeedbackOutlined";

function DepHealthPill({ onOpen }: { onOpen: () => void }) {
  const { state } = useDepHealth();
  const colorByStatus: Record<DepHealth, { bg: string; border: string; dot: string; text: string }> = {
    green: { bg: "rgba(74,212,138,0.12)", border: "rgba(74,212,138,0.45)", dot: "#4ad48a", text: "#4ad48a" },
    amber: { bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.45)", dot: "#f59e0b", text: "#f59e0b" },
    red: { bg: "rgba(239,79,111,0.12)", border: "rgba(239,79,111,0.45)", dot: "#ef4f6f", text: "#ef4f6f" },
    unknown: { bg: "rgba(184,168,216,0.08)", border: "rgba(184,168,216,0.25)", dot: "#8674a8", text: "#b8a8d8" },
  };
  const c = colorByStatus[state.status];
  const labels: Record<DepHealth, string> = {
    green: "Deps OK",
    amber: "Deps: valgfritt mangler",
    red: "Deps: mangler",
    unknown: "Deps: sjekker…",
  };
  return (
    <button
      onClick={onOpen}
      title={state.message}
      style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        color: c.text,
        borderRadius: 999,
        padding: "3px 10px 3px 8px",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 11,
        fontWeight: 600,
        marginLeft: 8,
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: c.dot }} />
      {labels[state.status]}
    </button>
  );
}

function readSignedIn(): boolean {
  try {
    const raw = localStorage.getItem("trrpa.settings");
    if (!raw) return false;
    const s = JSON.parse(raw) as { RR_BEARER_TOKEN?: string };
    return Boolean(s.RR_BEARER_TOKEN?.trim());
  } catch {
    return false;
  }
}

function useSignedIn(): boolean {
  const [signedIn, setSignedIn] = useState<boolean>(() => readSignedIn());
  useEffect(() => {
    const handler = () => setSignedIn(readSignedIn());
    window.addEventListener("trrpa:auth-changed", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("trrpa:auth-changed", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);
  return signedIn;
}

interface Props {
  health: HealthStatus | null;
  busy: boolean;
  onHealthCheck: () => void;
  onOpenFolder: () => void;
  onRefreshProject: () => void;
  onConnect: () => void;
  view: "pipeline" | "cull" | "audio" | "color";
  onViewChange: (next: "pipeline" | "cull" | "audio" | "color") => void;
  projectTemplates: ProjectTemplateSummary[];
  activeTemplateId: string;
  onTemplateChange: (id: string) => void;
  onSetupProject: () => void;
  onMagicCut: () => void;
  onOpenCreativeEditor: () => void;
  onOpenSettings: () => void;
  onOpenDependencies: () => void;
  onOpenWatch: () => void;
  onOpenPhotoshopBridge: () => void;
  onOpenPhotoshopTemplates: () => void;
  onOpenPhotoshopAgent: () => void;
  onOpenPsdGallery: () => void;
  onOpenPhotoshopHealth: () => void;
  onOpenPhotoshopTour: () => void;
  onOpenFeedback: () => void;
  onOpenHelp: () => void;
  onOpenPhotoshopSetup: () => void;
  onOpenPhotoshopScaffold: () => void;
  onOpenAiImage: () => void;
  onOpenArtDirector: () => void;
  onOpenCreations: () => void;
  onSignIn: () => void;
  onSignedOut: () => void;
  advancedMode: boolean;
}

function connectionTone(h: HealthStatus | null): "connected" | "partial" | "disconnected" {
  if (!h) return "disconnected";
  if (h.resolveRunning && h.projectOpen) return "connected";
  if (h.scriptingModuleFound) return "partial";
  return "disconnected";
}

function connectionLabel(h: HealthStatus | null): string {
  if (!h) return "Resolve: ikke koblet";
  if (h.resolveRunning && h.projectOpen && h.projectName) return `Resolve · ${h.projectName}`;
  if (h.resolveRunning) return "Resolve åpen, ingen prosjekt";
  if (h.scriptingModuleFound) return "Resolve ikke startet";
  return "Resolve ikke funnet";
}

export function HeaderBar({
  health,
  busy,
  onHealthCheck,
  onOpenFolder,
  onRefreshProject,
  onConnect,
  view,
  onViewChange,
  projectTemplates,
  activeTemplateId,
  onTemplateChange,
  onSetupProject,
  onMagicCut,
  onOpenCreativeEditor,
  onOpenSettings,
  onOpenDependencies,
  onOpenWatch,
  onOpenPhotoshopBridge,
  onOpenPhotoshopTemplates,
  onOpenPhotoshopAgent,
  onOpenPsdGallery,
  onOpenPhotoshopHealth,
  onOpenPhotoshopTour,
  onOpenFeedback,
  onOpenHelp,
  onOpenPhotoshopSetup,
  onOpenPhotoshopScaffold,
  onOpenAiImage,
  onOpenArtDirector,
  onOpenCreations,
  onSignIn,
  onSignedOut,
  advancedMode,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const tone = connectionTone(health);
  const signedIn = useSignedIn();

  return (
    <header className="header">
      <div className="header-brand">
        <h1>Post Agent</h1>
        <span className={`connection-pill ${tone}`} title={connectionLabel(health)}>
          <span className="dot" />
          {connectionLabel(health)}
        </span>
        <DepHealthPill onOpen={onOpenDependencies} />
        <PhotoshopStatusPill onClick={onOpenPhotoshopBridge} />
      </div>

      <div className="header-actions">
        {advancedMode && (
          <div className="view-switcher">
            <button className={view === "pipeline" ? "active" : ""} onClick={() => onViewChange("pipeline")}>Pipeline</button>
            <button className={view === "cull" ? "active" : ""} onClick={() => onViewChange("cull")}>Cull</button>
            <button className={view === "audio" ? "active" : ""} onClick={() => onViewChange("audio")}>Audio</button>
            <button className={view === "color" ? "active" : ""} onClick={() => onViewChange("color")}>Color</button>
          </div>
        )}

        {projectTemplates.length > 0 && (
          <select
            className="project-template-pick"
            value={activeTemplateId}
            onChange={(e) => onTemplateChange(e.target.value)}
            disabled={busy}
            title="Aktiv prosjekt-mal"
          >
            {projectTemplates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        )}

        <UserProfile signedIn={signedIn} onSignIn={onSignIn} onSignedOut={onSignedOut} />

        <div className="header-menu-wrap">
          <button
            className="small icon-button"
            onClick={() => setMenuOpen((s) => !s)}
            title="Innstillinger & verktøy"
          >
            <IconGear />
          </button>

          {menuOpen && (
            <>
              <div className="header-menu-backdrop" onClick={() => setMenuOpen(false)} />
              <div className="header-menu">
                <button onClick={() => { setMenuOpen(false); onOpenSettings(); }}>
                  <IconGear /> Settings
                </button>
                <button onClick={() => { setMenuOpen(false); onOpenDependencies(); }}>
                  <IconBox /> Dependencies
                </button>
                <button onClick={() => { setMenuOpen(false); onOpenWatch(); }}>
                  <IconEye /> Watch Folder
                </button>
                <button
                  onClick={() => { setMenuOpen(false); onOpenPhotoshopHealth(); }}
                  style={{
                    background: "linear-gradient(135deg, rgba(74,212,138,0.18), rgba(34,180,90,0.18))",
                    border: "1px solid rgba(74,212,138,0.40)",
                    color: "#dafce6",
                    fontWeight: 600,
                  }}
                >
                  <CheckCircleOutlinedIcon fontSize="small" /> Helse-sjekk Photoshop…
                </button>
                <button
                  onClick={() => { setMenuOpen(false); onOpenPhotoshopSetup(); }}
                  style={{
                    background: "linear-gradient(135deg, rgba(59,130,246,0.16), rgba(37,99,235,0.16))",
                    border: "1px solid rgba(59,130,246,0.40)",
                    color: "#dbeafe",
                    fontWeight: 600,
                  }}
                >
                  <BuildOutlinedIcon fontSize="small" /> Photoshop-oppsett (kom i gang)
                </button>
                <button onClick={() => { setMenuOpen(false); onOpenPhotoshopBridge(); }}>
                  Photoshop Bridge…
                </button>
                <button onClick={() => { setMenuOpen(false); onOpenPhotoshopTemplates(); }}>
                  Photoshop Templates…
                </button>
                <button onClick={() => { setMenuOpen(false); onOpenPhotoshopScaffold(); }}>
                  <AddIcon fontSize="small" /> Lag template fra startpunkt…
                </button>
                <button onClick={() => { setMenuOpen(false); onOpenAiImage(); }}>
                  <AutoAwesomeIcon fontSize="small" /> AI image generation…
                </button>
                <button
                  onClick={() => { setMenuOpen(false); onOpenArtDirector(); }}
                  style={{
                    background: "linear-gradient(135deg, rgba(167,139,250,0.22), rgba(110,63,199,0.22))",
                    border: "1px solid rgba(167,139,250,0.45)",
                    color: "#e8e0ff",
                    fontWeight: 600,
                  }}
                >
                  <AutoAwesomeIcon fontSize="small" /> AI Creative Director…
                </button>
                <button onClick={() => { setMenuOpen(false); onOpenCreations(); }}>
                  <HistoryIcon fontSize="small" /> Mine AI-kreasjoner…
                </button>
                <button
                  onClick={() => { setMenuOpen(false); onOpenPhotoshopAgent(); }}
                  style={{
                    background: "linear-gradient(135deg, rgba(167,139,250,0.18), rgba(110,63,199,0.18))",
                    border: "1px solid rgba(167,139,250,0.35)",
                    color: "#e8e0ff",
                    fontWeight: 600,
                  }}
                >
                  <BrushOutlinedIcon fontSize="small" /> Photoshop Agent…
                </button>
                <button onClick={() => { setMenuOpen(false); onOpenPsdGallery(); }}>
                  PSD-galleri…
                </button>
                <button onClick={() => { setMenuOpen(false); onOpenPhotoshopTour(); }}>
                  <WavingHandOutlinedIcon fontSize="small" /> Vis Photoshop-tour på nytt
                </button>
                <button onClick={() => { setMenuOpen(false); onOpenHelp(); }}>
                  <HelpOutlineOutlinedIcon fontSize="small" /> Hjelp + dokumentasjon
                </button>
                <button onClick={() => { setMenuOpen(false); onOpenFeedback(); }}>
                  <FeedbackOutlinedIcon fontSize="small" /> Send feedback
                </button>
                <div className="header-menu-divider" />
                <button onClick={() => { setMenuOpen(false); onConnect(); }} disabled={busy}>
                  Connect to Resolve
                </button>
                <button onClick={() => { setMenuOpen(false); onRefreshProject(); }} disabled={busy}>
                  Refresh Project
                </button>
                <button onClick={() => { setMenuOpen(false); onHealthCheck(); }} disabled={busy}>
                  Run Health Check
                </button>
                <button onClick={() => { setMenuOpen(false); onOpenFolder(); }}>
                  Open Script Folder
                </button>
                <button onClick={() => { setMenuOpen(false); onSetupProject(); }} disabled={busy}>
                  Set up Project (Smart Onboarding)
                </button>
                <div className="header-menu-divider" />
                <button onClick={() => { setMenuOpen(false); onMagicCut(); }} disabled={busy}>
                  <IconMagicCut /> Magic Cut (current template)
                </button>
                <div className="header-menu-divider" />
                <button
                  onClick={() => { setMenuOpen(false); onOpenCreativeEditor(); }}
                  disabled={busy}
                  style={{
                    background: "linear-gradient(135deg, rgba(160,48,192,0.20), rgba(110,63,199,0.20))",
                    border: "1px solid rgba(160,48,192,0.40)",
                    color: "#f0eaff",
                    fontWeight: 600,
                  }}
                >
                  🎬 Creative Editor (Story-driven)
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
