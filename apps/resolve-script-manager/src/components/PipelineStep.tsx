import type { ScriptMeta, WorkflowStep } from "../types";

export type StepStatus = "pending" | "running" | "success" | "failed";

interface Props {
  step: WorkflowStep;
  script: ScriptMeta | undefined;
  busy: boolean;
  /** Visual progress indicator (#235). Computed in App.tsx from run history. */
  runStatus?: StepStatus;
  /** When runStatus === "running", optional 0..100 % progress to render as bar. */
  runProgress?: number;
  /** Timestamp of last completion, useful for tooltip. */
  lastFinishedAt?: number | string;
  onDryRun: () => void;
  onRun: () => void;
}

const STATUS_ICON: Record<StepStatus, string> = {
  pending: "⏳",
  running: "▶",
  success: "✓",
  failed: "✕",
};

const STATUS_COLOR: Record<StepStatus, string> = {
  pending: "#7660a0",
  running: "#ffcc55",
  success: "#3fc77f",
  failed: "#ef4f6f",
};

export function PipelineStep({
  step, script, busy, runStatus = "pending", runProgress,
  lastFinishedAt, onDryRun, onRun,
}: Props) {
  const icon = STATUS_ICON[runStatus];
  const color = STATUS_COLOR[runStatus];
  const formatFinished = (ts: number | string) => {
    if (typeof ts === "string") {
      // ISO timestamp from history
      const d = new Date(ts);
      return isNaN(d.getTime()) ? "" : d.toLocaleTimeString();
    }
    return new Date(ts * 1000).toLocaleTimeString();
  };
  const tooltip = (() => {
    if (runStatus === "success" && lastFinishedAt) {
      return `Completed ${formatFinished(lastFinishedAt)}`;
    }
    if (runStatus === "failed" && lastFinishedAt) {
      return `Failed ${formatFinished(lastFinishedAt)}`;
    }
    if (runStatus === "running") {
      return runProgress !== undefined ? `Running — ${runProgress}%` : "Running…";
    }
    return "Not yet run";
  })();

  return (
    <div className="pipeline-step" style={{ position: "relative" }}>
      <div
        className="order"
        title={tooltip}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          background: runStatus === "pending" ? undefined : color,
          color: runStatus === "pending" ? undefined : "white",
          fontWeight: 700,
          // Subtle pulse animation when running
          animation: runStatus === "running" ? "stepPulse 1.2s ease-in-out infinite" : undefined,
        }}
      >
        {runStatus === "pending" ? step.order : icon}
      </div>
      <div className="meta">
        <div className="name">{step.label}</div>
        <div className="status-row">
          {script && <span className={`chip ${script.status}`}>{script.status}</span>}
          {script && <span className={`chip risk-${script.riskLevel}`}>risk: {script.riskLevel}</span>}
          {!script && <span className="chip">missing in registry</span>}
          {runStatus !== "pending" && (
            <span
              className="chip"
              style={{ background: `${color}22`, color, border: `1px solid ${color}` }}
              title={tooltip}
            >
              {icon} {runStatus}
            </span>
          )}
        </div>
        {/* Running progress bar (#235) */}
        {runStatus === "running" && runProgress !== undefined && (
          <div style={{
            marginTop: 4, height: 2, background: "rgba(255,204,85,0.2)",
            borderRadius: 1, overflow: "hidden",
          }}>
            <div style={{
              width: `${Math.max(0, Math.min(100, runProgress))}%`,
              height: "100%", background: color, transition: "width 200ms ease-out",
            }} />
          </div>
        )}
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
