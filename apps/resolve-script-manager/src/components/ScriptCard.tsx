import type { ScriptMeta, RunRecord } from "../types";
import { IconCheck, IconX } from "./Icons";

interface Props {
  script: ScriptMeta;
  lastRun: RunRecord | null;
  busy: boolean;
  onDryRun: () => void;
  onRun: () => void;
}

function formatTime(iso: string | undefined): string {
  if (!iso) return "never";
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

export function ScriptCard({ script, lastRun, busy, onDryRun, onRun }: Props) {
  return (
    <div className="script-card">
      <div className="card-header">
        <div className="card-title">{script.name}</div>
        <span className={`chip ${script.status}`}>{script.status}</span>
      </div>
      <div className="card-desc">{script.description}</div>

      <div className="card-meta">
        <span className={`chip risk-${script.riskLevel}`}>risk: {script.riskLevel}</span>
        {script.requiresProject && <span className="chip">needs project</span>}
        {script.requiresTimeline && <span className="chip">needs timeline</span>}
        {script.requiresEnv?.map((env) => (
          <span key={env} className="chip" title={`Requires ${env}`}>
            env: {env}
          </span>
        ))}
      </div>

      {script.resolvePageDependency && (
        <div className="resolve-page-hint">
          Resolve page: <strong>{script.resolvePageDependency}</strong>
        </div>
      )}

      {script.requiredInputs.length > 0 && (
        <div className="resolve-page-hint">
          Required inputs: {script.requiredInputs.join(", ")}
        </div>
      )}

      <div className="resolve-page-hint">
        Last run: {lastRun ? (
          <>{formatTime(lastRun.startedAt)} · {lastRun.succeeded ? <IconCheck /> : <IconX />}</>
        ) : "never"}
      </div>

      <div className="card-actions">
        <button className="small" onClick={onDryRun} disabled={busy || !script.dryRunSupported}>
          Dry Run
        </button>
        <button className="small primary" onClick={onRun} disabled={busy}>
          Run
        </button>
      </div>
    </div>
  );
}
