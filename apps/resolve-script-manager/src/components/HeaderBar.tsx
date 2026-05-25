import type { HealthStatus, ProjectTemplateSummary } from "../types";
import { IconSparkle, IconCheck } from "./Icons";

function isSignedInToRoleRoom(): boolean {
  try {
    const raw = localStorage.getItem("trrpa.settings");
    if (!raw) return false;
    const s = JSON.parse(raw) as { RR_BEARER_TOKEN?: string };
    return Boolean(s.RR_BEARER_TOKEN?.trim());
  } catch {
    return false;
  }
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
}

function connectionTone(h: HealthStatus | null): "connected" | "partial" | "disconnected" {
  if (!h) return "disconnected";
  if (h.resolveRunning && h.projectOpen) return "connected";
  if (h.scriptingModuleFound) return "partial";
  return "disconnected";
}

function connectionLabel(h: HealthStatus | null): string {
  if (!h) return "Not checked";
  if (h.resolveRunning && h.projectOpen && h.projectName) {
    return `Connected · ${h.projectName}`;
  }
  if (h.resolveRunning) return "Connected · no project open";
  if (h.scriptingModuleFound) return "Module found · Resolve not running";
  return "Disconnected";
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
}: Props) {
  const tone = connectionTone(health);
  const signedInToRoleRoom = isSignedInToRoleRoom();

  return (
    <header className="header">
      <div className="header-brand">
        <h1>The Role Room — Post Agent</h1>
        <span className="subtitle">DaVinci Resolve pipeline automation</span>
        <span className={`connection-pill ${tone}`}>
          <span className="dot" />
          {connectionLabel(health)}
        </span>
        <span
          className={`connection-pill ${signedInToRoleRoom ? "connected" : "disconnected"}`}
          title={signedInToRoleRoom ? "AI-funksjoner er aktive" : "Logg inn for å bruke AI"}
        >
          {signedInToRoleRoom ? <><IconCheck /> Role Room</> : "Ikke logget inn"}
        </span>
        {projectTemplates.length > 0 && (
          <select
            className="project-template-pick"
            value={activeTemplateId}
            onChange={(e) => onTemplateChange(e.target.value)}
            disabled={busy}
            title="Active project template"
          >
            {projectTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="header-actions">
        <div className="view-switcher">
          <button
            className={view === "pipeline" ? "active" : ""}
            onClick={() => onViewChange("pipeline")}
          >
            Pipeline
          </button>
          <button
            className={view === "cull" ? "active" : ""}
            onClick={() => onViewChange("cull")}
          >
            Cull
          </button>
          <button
            className={view === "audio" ? "active" : ""}
            onClick={() => onViewChange("audio")}
          >
            Audio
          </button>
          <button
            className={view === "color" ? "active" : ""}
            onClick={() => onViewChange("color")}
          >
            Color
          </button>
        </div>
        <button className="small" onClick={onConnect} disabled={busy}>
          Connect to Resolve
        </button>
        <button className="small" onClick={onRefreshProject} disabled={busy}>
          Refresh Project
        </button>
        <button className="small" onClick={onOpenFolder}>
          Open Script Folder
        </button>
        <button className="small primary" onClick={onMagicCut} disabled={busy} title="Auto-generér rough cut fra footage-mappe">
          <IconSparkle /> Magic Cut
        </button>
        <button className="small" onClick={onSetupProject} disabled={busy}>
          Set up Project
        </button>
        <button className="small" onClick={onHealthCheck} disabled={busy}>
          Run Health Check
        </button>
      </div>
    </header>
  );
}
