import { useEffect, useState } from "react";
import type { HealthStatus, ProjectTemplateSummary } from "../types";
import { IconGear, IconBox, IconEye, IconMagicCut } from "./Icons";
import { UserProfile } from "./UserProfile";

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
  onOpenSettings: () => void;
  onOpenDependencies: () => void;
  onOpenWatch: () => void;
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
  onOpenSettings,
  onOpenDependencies,
  onOpenWatch,
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
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
