import { useCallback } from "react";
import { cancelScript } from "../api";

export interface RunningScript {
  runId: string;
  scriptId: string;
  percent: number;
  label: string;
  startedAt: number;
}

interface Props {
  scripts: RunningScript[];
  onCancelled: (runId: string) => void;
}

function eta(percent: number, startedAt: number): string {
  if (percent < 5) return "…";
  const elapsedMs = Date.now() - startedAt;
  const estimatedTotalMs = elapsedMs * (100 / percent);
  const remainingMs = estimatedTotalMs - elapsedMs;
  const remainingSec = Math.max(0, Math.floor(remainingMs / 1000));
  if (remainingSec < 60) return `${remainingSec}s left`;
  return `${Math.floor(remainingSec / 60)}m ${remainingSec % 60}s left`;
}

export function RunningScriptsPanel({ scripts, onCancelled }: Props) {
  const handleCancel = useCallback(
    async (runId: string) => {
      try {
        await cancelScript(runId);
      } catch {
        // swallow
      } finally {
        onCancelled(runId);
      }
    },
    [onCancelled],
  );

  if (scripts.length === 0) return null;

  return (
    <div className="running-scripts">
      <div className="running-scripts-header">
        <strong>{scripts.length} running</strong>
      </div>
      {scripts.map((s) => (
        <div key={s.runId} className="running-script">
          <div className="running-script-row">
            <span className="running-script-name">{s.scriptId}</span>
            <span className="running-script-eta">{eta(s.percent, s.startedAt)}</span>
            <button className="small ghost" onClick={() => handleCancel(s.runId)}>
              Cancel
            </button>
          </div>
          <div className="running-script-bar">
            <div className="running-script-progress" style={{ width: `${s.percent}%` }} />
          </div>
          <div className="running-script-label">{s.label || `${s.percent}%`}</div>
        </div>
      ))}
    </div>
  );
}
