import { useCallback, useState } from "react";
import {
  launchResolve,
  openResolvePreferences,
  revealResolveConfigs,
  runHealthCheck,
} from "../api";
import type { HealthStatus } from "../types";
import { IconCheck } from "./Icons";

interface Props {
  health: HealthStatus | null;
  onClose: () => void;
  onHealthRefreshed: (health: HealthStatus) => void;
}

type StepState = "pending" | "running" | "ok" | "warn";

interface Step {
  id: string;
  label: string;
  state: StepState;
  detail?: string;
}

function deriveSteps(health: HealthStatus | null): Step[] {
  return [
    {
      id: "module",
      label: "DaVinci Resolve installation found",
      state: health?.scriptingModuleFound ? "ok" : "warn",
      detail: health?.scriptingModulePath ?? "Install Resolve from blackmagicdesign.com",
    },
    {
      id: "lib",
      label: "fusionscript.so located",
      state: health?.fusionscriptLibPath ? "ok" : "warn",
      detail: health?.fusionscriptLibPath ?? "Bridge couldn't find the dlopen target",
    },
    {
      id: "running",
      label: "Resolve is running",
      state: health?.resolveRunning ? "ok" : "warn",
      detail: health?.resolveRunning ? "Connected" : "Open Resolve and load (or create) a project",
    },
    {
      id: "scripting",
      label: "External scripting is enabled",
      state: health?.resolveRunning ? (health?.resolveRunning ? "ok" : "warn") : "pending",
      detail:
        "Preferences → System → General → 'External scripting using' → Local. " +
        "If you don't see the setting in Resolve 20, scroll down or resize the window.",
    },
    {
      id: "project",
      label: "Project open",
      state: health?.projectOpen ? "ok" : "warn",
      detail: health?.projectName ?? "Open or create a project from the Project Manager",
    },
  ];
}

export function ResolveSetupModal({ health, onClose, onHealthRefreshed }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const steps = deriveSteps(health);

  const runAction = useCallback(
    async (label: string, fn: () => Promise<string>) => {
      setBusy(label);
      setToast(null);
      try {
        const result = await fn();
        setToast({ kind: "success", text: result });
      } catch (e) {
        setToast({ kind: "error", text: String(e) });
      } finally {
        setBusy(null);
      }
    },
    [],
  );

  const verify = useCallback(async () => {
    setBusy("Verifying");
    setToast(null);
    try {
      const summary = await runHealthCheck();
      const resultEvent = summary.events.find((e) => e.type === "result");
      if (resultEvent?.value) {
        const newHealth = resultEvent.value as HealthStatus;
        onHealthRefreshed(newHealth);
        if (newHealth.resolveRunning && newHealth.projectOpen) {
          setToast({ kind: "success", text: `Connected · ${newHealth.projectName ?? "(no name)"}` });
        } else {
          setToast({
            kind: "error",
            text: !newHealth.resolveRunning
              ? "Resolve still not reachable. Confirm External Scripting is Local + Resolve is past the welcome screen."
              : "Resolve connected but no project is open.",
          });
        }
      }
    } catch (e) {
      setToast({ kind: "error", text: String(e) });
    } finally {
      setBusy(null);
    }
  }, [onHealthRefreshed]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 580 }}>
        <h2>Resolve Setup</h2>
        <div className="desc">
          External scripting må aktiveres i Resolve én gang. Etter det husker Resolve valget.
          Bruk knappene under for å åpne Preferences raskere — du må fortsatt klikke "Local" og
          "Save" selv (Resolve tillater ikke at toggelen endres automatisk).
        </div>

        <ol className="setup-steps">
          {steps.map((step, i) => (
            <li key={step.id} className={`setup-step setup-step-${step.state}`}>
              <span className="setup-step-marker">
                {step.state === "ok" ? <IconCheck /> : step.state === "warn" ? "!" : `${i + 1}`}
              </span>
              <div>
                <div className="setup-step-label">{step.label}</div>
                {step.detail && <div className="setup-step-detail">{step.detail}</div>}
              </div>
            </li>
          ))}
        </ol>

        <div className="setup-actions">
          <button
            className="small"
            disabled={!!busy}
            onClick={() => runAction("Launching Resolve", launchResolve)}
          >
            1. Open Resolve
          </button>
          <button
            className="small"
            disabled={!!busy}
            onClick={() => runAction("Opening Preferences", openResolvePreferences)}
          >
            2. Auto-open Preferences (cmd+,)
          </button>
          <button
            className="small"
            disabled={!!busy}
            onClick={() => runAction("Revealing configs", revealResolveConfigs)}
          >
            Reveal configs in Finder
          </button>
          <button className="small primary" disabled={!!busy} onClick={verify}>
            <IconCheck /> Verify connection
          </button>
        </div>

        {toast && (
          <div className={`dialog-warning`} style={{
            marginTop: 12,
            borderColor: toast.kind === "success" ? "var(--success)" : "var(--danger)",
            color: toast.kind === "success" ? "var(--success)" : "var(--danger)",
            background: toast.kind === "success" ? "rgba(76,175,80,.08)" : "rgba(239,68,68,.08)",
          }}>
            {toast.text}
          </div>
        )}

        <div className="actions">
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
