import { useEffect, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import type { ScriptMeta } from "../types";
import { IconWarning } from "./Icons";

/** Input spec normalized from registry — handles both old string format
 *  ['key1', 'key2'] and new object format [{key, label, type, required}].
 */
interface NormalizedInput {
  key: string;
  label: string;
  type: "text" | "number" | "file" | "directory" | "boolean";
}

function normalizeInput(raw: unknown): NormalizedInput | null {
  if (typeof raw === "string") {
    return {
      key: raw,
      label: raw,
      type: fieldPickerKind(raw) || (looksNumeric(raw) ? "number" : "text"),
    };
  }
  if (raw && typeof raw === "object" && "key" in raw) {
    const obj = raw as Record<string, unknown>;
    const key = String(obj.key || "");
    if (!key) return null;
    const explicitType = String(obj.type || "");
    let type: NormalizedInput["type"] = "text";
    if (explicitType === "file" || explicitType === "directory" || explicitType === "number" || explicitType === "boolean") {
      type = explicitType;
    } else {
      type = fieldPickerKind(key) || (looksNumeric(key) ? "number" : "text");
    }
    return {
      key,
      label: String(obj.label || key),
      type,
    };
  }
  return null;
}

function looksNumeric(key: string): boolean {
  const k = key.toLowerCase();
  return (
    k.endsWith("fps") || k.endsWith("rate") || k.endsWith("count") ||
    k.endsWith("limit") || k.endsWith("threshold") || k.endsWith("seconds") ||
    k.endsWith("sec") || k.endsWith("offset") || k === "tempo" || k === "bpm"
  );
}

/** Classify a script-input field name into picker type. Heuristic:
 *  - 'File' suffix → file picker
 *  - 'Folder' / 'Path' / 'Dir' suffix → directory picker
 *  - known specific names mapped explicitly
 *  - anything else → null (plain text input)
 */
function fieldPickerKind(key: string): "file" | "directory" | null {
  const k = key.toLowerCase();
  // Explicit file mappings (preferred — most accurate)
  if (k === "musicfile" || k === "musicpath" || k === "videopath" || k === "editedvideopath" || k === "sourcesongpath" || k === "audiopath") {
    return "file";
  }
  if (
    k === "mediafolderpath" || k === "backupfolder" || k === "outputfolder" ||
    k === "ssdpath" || k === "sourcepath" || k === "folderpath" ||
    k === "destpath" || k === "watchpath" || k === "exportpath"
  ) {
    return "directory";
  }
  // Suffix heuristics
  if (k.endsWith("file") || k.endsWith("filepath")) return "file";
  if (k.endsWith("folder") || k.endsWith("dir") || k.endsWith("directory")) return "directory";
  // Generic 'path' suffix — ambiguous; check for video/audio/song hints to pick file
  if (k.endsWith("path")) {
    if (k.includes("video") || k.includes("audio") || k.includes("song") || k.includes("music") || k.includes("file")) {
      return "file";
    }
    return "directory";
  }
  return null;
}

const FILE_EXT_FILTERS: Record<string, { name: string; extensions: string[] }[]> = {
  musicfile: [{ name: "Audio", extensions: ["wav", "mp3", "m4a", "aac", "flac"] }],
  videopath: [{ name: "Video", extensions: ["mp4", "mov", "mxf", "mkv", "m4v"] }],
  editedvideopath: [{ name: "Video", extensions: ["mp4", "mov", "mxf", "mkv", "m4v"] }],
  sourcesongpath: [{ name: "Audio", extensions: ["wav", "mp3", "m4a", "flac"] }],
  audiopath: [{ name: "Audio", extensions: ["wav", "mp3", "m4a", "flac"] }],
};

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

  const inputs: NormalizedInput[] = (script.requiredInputs ?? [])
    .map(normalizeInput)
    .filter((x): x is NormalizedInput => x !== null);

  function handleSubmit() {
    const parsed: Record<string, unknown> = {};
    for (const inp of inputs) {
      const raw = values[inp.key] ?? "";
      if (raw.startsWith("{") || raw.startsWith("[")) {
        try {
          parsed[inp.key] = JSON.parse(raw);
          continue;
        } catch {
          // fall through to string
        }
      }
      if (inp.type === "number") {
        const num = Number(raw);
        parsed[inp.key] = raw === "" ? "" : Number.isFinite(num) ? num : raw;
        continue;
      }
      const num = Number(raw);
      parsed[inp.key] = raw === "" ? "" : Number.isFinite(num) && raw.trim() !== "" && !isNaN(num) ? num : raw;
    }
    onConfirm(parsed);
  }

  const hasInputs = inputs.length > 0;

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
          inputs.map((inp) => {
            const pickerKind = inp.type === "file" ? "file" : inp.type === "directory" ? "directory" : null;
            const inputType = inp.type === "number" ? "number" : "text";
            return (
              <div className="field" key={inp.key}>
                <label htmlFor={`field-${inp.key}`}>{inp.label}</label>
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    id={`field-${inp.key}`}
                    type={inputType}
                    value={values[inp.key] ?? ""}
                    onChange={(e) => update(inp.key, e.target.value)}
                    placeholder={inputHint(inp.key)}
                    style={{ flex: 1, minWidth: 0 }}
                  />
                  {pickerKind && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const filters = pickerKind === "file" ? FILE_EXT_FILTERS[inp.key.toLowerCase()] : undefined;
                          const picked = await openDialog({
                            multiple: false,
                            directory: pickerKind === "directory",
                            ...(filters ? { filters } : {}),
                          });
                          if (typeof picked === "string" && picked) {
                            update(inp.key, picked);
                          }
                        } catch (err) {
                          console.warn("openDialog failed", err);
                        }
                      }}
                      style={{
                        background: "transparent",
                        border: "1px solid rgba(160,48,192,0.5)",
                        color: "#a030c0",
                        borderRadius: 6,
                        padding: "0 12px",
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                      }}
                    >
                      {pickerKind === "directory" ? "Velg mappe…" : "Velg fil…"}
                    </button>
                  )}
                </div>
              </div>
            );
          })
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
