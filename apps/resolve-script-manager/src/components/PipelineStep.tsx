import type { ScriptMeta, WorkflowStep } from "../types";

interface Props {
  step: WorkflowStep;
  script: ScriptMeta | undefined;
  busy: boolean;
  onDryRun: () => void;
  onRun: () => void;
}

export function PipelineStep({ step, script, busy, onDryRun, onRun }: Props) {
  return (
    <div className="pipeline-step">
      <div className="order">{step.order}</div>
      <div className="meta">
        <div className="name">{step.label}</div>
        <div className="status-row">
          {script && <span className={`chip ${script.status}`}>{script.status}</span>}
          {script && <span className={`chip risk-${script.riskLevel}`}>risk: {script.riskLevel}</span>}
          {!script && <span className="chip">missing in registry</span>}
        </div>
      </div>
      <div className="actions">
        <button className="small" onClick={onDryRun} disabled={busy || !script}>
          Dry Run
        </button>
        <button className="small primary" onClick={onRun} disabled={busy || !script}>
          Run
        </button>
      </div>
    </div>
  );
}
