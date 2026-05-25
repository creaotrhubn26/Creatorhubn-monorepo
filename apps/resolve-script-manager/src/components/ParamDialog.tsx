import { useEffect, useState } from "react";
import type { ScriptMeta } from "../types";
import { IconWarning } from "./Icons";

interface Props {
  script: ScriptMeta | null;
  dryRun: boolean;
  defaults?: Record<string, string>;
  onCancel: () => void;
  onConfirm: (params: Record<string, unknown>) => void;
}

export function ParamDialog({ script, dryRun, defaults, onCancel, onConfirm }: Props) {
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    setValues(defaults ? { ...defaults } : {});
  }, [script?.id, defaults]);

  if (!script) return null;

  function update(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit() {
    const parsed: Record<string, unknown> = {};
    for (const key of script!.requiredInputs) {
      const raw = values[key] ?? "";
      if (raw.startsWith("{") || raw.startsWith("[")) {
        try {
          parsed[key] = JSON.parse(raw);
          continue;
        } catch {
          // fall through to string
        }
      }
      const num = Number(raw);
      parsed[key] = raw === "" ? "" : Number.isFinite(num) && raw.trim() !== "" && !isNaN(num) ? num : raw;
    }
    onConfirm(parsed);
  }

  const hasInputs = script.requiredInputs.length > 0;

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>
          {dryRun ? "Dry Run" : "Run"} — {script.name}
        </h2>
        <div className="desc">{script.description}</div>

        {!dryRun && script.riskLevel === "high" && (
          <div className="dialog-warning">
            <IconWarning /> High-risk operation. This will modify your Resolve project. Run Dry Run first to preview.
          </div>
        )}
        {!dryRun && script.status === "experimental" && (
          <div className="dialog-warning">
            <IconWarning /> Experimental script. Output quality is not guaranteed yet.
          </div>
        )}
        {!dryRun && script.status === "stub" && (
          <div className="dialog-warning">
            This script is a scaffold — Live mode will emit a "scaffold" notice. Dry Run shows the intended plan.
          </div>
        )}

        {hasInputs ? (
          script.requiredInputs.map((key) => (
            <div className="field" key={key}>
              <label htmlFor={`field-${key}`}>{key}</label>
              <input
                id={`field-${key}`}
                type="text"
                value={values[key] ?? ""}
                onChange={(e) => update(key, e.target.value)}
                placeholder={inputHint(key)}
              />
            </div>
          ))
        ) : (
          <div className="desc">No parameters required.</div>
        )}

        <div className="actions">
          <button onClick={onCancel}>Cancel</button>
          <button className="primary" onClick={handleSubmit}>
            {dryRun ? "Dry Run" : "Run"}
          </button>
        </div>
      </div>
    </div>
  );
}

function inputHint(key: string): string {
  switch (key) {
    case "mediaFolderPath":
      return "/Users/you/Footage/Wedding 2026";
    case "backupFolder":
      return "/Users/you/Documents/Resolve Backups";
    case "outputFolder":
      return "/Users/you/Movies/Renders";
    case "projectName":
      return "Lemy_Ole_Wedding";
    case "template":
      return "wedding_film";
    case "timelineName":
      return "Master_Timeline_V01";
    case "frameRate":
      return "25";
    case "clientName":
      return "Couple Name";
    case "musicFile":
      return "/path/to/music.wav";
    default:
      return "";
  }
}
