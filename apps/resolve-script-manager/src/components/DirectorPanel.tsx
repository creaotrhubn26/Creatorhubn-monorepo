/**
 * DirectorPanel — embeddable variant av Multi-Agent Creative Director.
 *
 * Brukes:
 *   - i CreativeEditorView's høyre-rail (passer current pick + story-state
 *     via contextProvider så Claude vet hva som er aktivt)
 *   - inni MultiAgentDirectorDialog (modal-wrapping, App-shell)
 *
 * Logikken lever i useDirectorLoop. Denne komponenten er ren UI.
 */

import { useEffect, useState } from "react";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import StopIcon from "@mui/icons-material/Stop";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import BookmarkIcon from "@mui/icons-material/BookmarkOutlined";
import DeleteIcon from "@mui/icons-material/DeleteOutlineOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import {
  useDirectorLoop,
  type ContextProvider,
  type ProgressStep,
  type IterationCard,
} from "../lib/useDirectorLoop";
import { DIRECTOR_SYSTEM_PROMPT } from "../lib/directorSystemPrompt";
import {
  BUILTIN_PRESETS,
  deletePreset as deletePresetFn,
  listPresets,
  savePreset,
  touchPreset,
  type DirectorPreset,
} from "../lib/directorPresets";

export interface DirectorPanelProps {
  /** Hvis satt blir resultatet av callbacken prependet til goal i hver run. */
  contextProvider?: ContextProvider;
  /** Vis info-strip øverst med contextProvider-snapshot live. */
  showContextPreview?: boolean;
  /** Strammere padding/limits så panelet passer i en sidebar. */
  compact?: boolean;
  /** Overstyr systemprompten — typisk ikke nødvendig. */
  systemPrompt?: string;
}

export function DirectorPanel({
  contextProvider,
  showContextPreview = false,
  compact = false,
  systemPrompt = DIRECTOR_SYSTEM_PROMPT,
}: DirectorPanelProps) {
  const loop = useDirectorLoop({ systemPrompt, contextProvider });
  const [presets, setPresets] = useState<DirectorPreset[]>([]);
  const [appliedPresetId, setAppliedPresetId] = useState<string | null>(null);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");
  const [contextPreview, setContextPreview] = useState<string | null>(null);

  useEffect(() => {
    setPresets(listPresets());
  }, []);

  // Refresh context-preview hver gang knapper rendres så brukeren ser
  // hva som faktisk sendes (lazy: kun når contextProvider er gitt).
  useEffect(() => {
    if (!showContextPreview || !contextProvider) {
      setContextPreview(null);
      return;
    }
    setContextPreview(contextProvider() ?? null);
  }, [showContextPreview, contextProvider, loop.goal, loop.completed]);

  const applyPreset = (preset: { id?: string; goal: string }) => {
    loop.setGoal(preset.goal);
    setAppliedPresetId(preset.id ?? null);
  };

  const handleSavePreset = () => {
    const name = newPresetName.trim();
    if (!name || !loop.goal.trim()) return;
    savePreset({ name, goal: loop.goal });
    setPresets(listPresets());
    setSaveModalOpen(false);
    setNewPresetName("");
  };

  const handleDeletePreset = (id: string) => {
    deletePresetFn(id);
    setPresets(listPresets());
    if (appliedPresetId === id) setAppliedPresetId(null);
  };

  const handleStart = async () => {
    if (appliedPresetId) {
      touchPreset(appliedPresetId);
      setPresets(listPresets());
    }
    await loop.start();
  };

  const styles = compact ? compactStyles : standardStyles;

  return (
    <div style={styles.root} data-testid="director-panel">
      {!loop.running && !loop.completed && (
        <>
          {(presets.length > 0 || BUILTIN_PRESETS.length > 0) && (
            <div data-testid="director-presets-section">
              <div style={presetsHeader}>
                <BookmarkIcon sx={{ fontSize: 14, color: "#a78bfa" }} />
                <span style={presetsLabel}>Lagrede flows</span>
              </div>
              <div style={presetsList}>
                {presets.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      ...presetCard,
                      ...(appliedPresetId === p.id ? presetCardActive : null),
                    }}
                    data-testid={`director-preset-${p.id}`}
                  >
                    <button
                      style={presetUseBtn}
                      onClick={() => applyPreset(p)}
                      title={p.goal}
                    >
                      <span style={presetName}>{p.name}</span>
                      {p.runCount > 0 && (
                        <span style={presetRunCount}>×{p.runCount}</span>
                      )}
                    </button>
                    <button
                      style={presetDeleteBtn}
                      onClick={() => handleDeletePreset(p.id)}
                      aria-label={`Slett ${p.name}`}
                      title="Slett preset"
                    >
                      <DeleteIcon sx={{ fontSize: 14 }} />
                    </button>
                  </div>
                ))}
                {presets.length === 0 &&
                  BUILTIN_PRESETS.map((p) => (
                    <button
                      key={p.name}
                      style={presetCard}
                      onClick={() => applyPreset(p)}
                      title={p.goal}
                      data-testid={`director-preset-builtin-${p.name}`}
                    >
                      <span style={presetName}>{p.name}</span>
                      <span style={presetBuiltinBadge}>BUILTIN</span>
                    </button>
                  ))}
              </div>
            </div>
          )}

          {showContextPreview && contextPreview && (
            <div style={contextPreviewBox} data-testid="director-context-preview">
              <div style={contextHeader}>
                <InfoOutlinedIcon sx={{ fontSize: 12, color: "#60a5fa" }} />
                <span style={contextLabel}>Kontekst som sendes med</span>
              </div>
              <pre style={contextText}>{contextPreview}</pre>
            </div>
          )}

          <label style={fieldLabel}>
            Hva vil du at AI Creative Director skal gjøre?
            {!compact && (
              <span style={fieldHint}>
                Eksempler: "Touche opp aktiv pick med Cinematic-look og send tilbake
                til Resolve" eller "Eksporter alle picks i denne segmentet som 4 aspect-
                varianter til Desktop"
              </span>
            )}
          </label>
          <textarea
            data-testid="director-goal-input"
            style={styles.textarea}
            rows={compact ? 3 : 4}
            placeholder="Skriv målet ditt her…"
            value={loop.goal}
            onChange={(e) => {
              loop.setGoal(e.target.value);
              setAppliedPresetId(null);
            }}
          />
          <div style={actionRow}>
            <button
              style={secondaryBtn}
              onClick={() => setSaveModalOpen(true)}
              disabled={!loop.goal.trim()}
              data-testid="director-save-preset"
            >
              <BookmarkIcon sx={{ fontSize: 14 }} /> Lagre
            </button>
            <button
              style={primaryBtn}
              onClick={handleStart}
              disabled={!loop.goal.trim()}
              data-testid="director-start"
            >
              <PlayArrowIcon sx={{ fontSize: 16 }} /> Start
            </button>
          </div>

          {saveModalOpen && (
            <div style={saveOverlay} data-testid="director-save-modal">
              <div style={saveModal}>
                <div style={saveModalTitle}>Lagre som flow</div>
                <input
                  data-testid="director-preset-name-input"
                  style={inputStyle}
                  placeholder="F.eks. 'Cinematic Wedding Touch-up'"
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  autoFocus
                />
                <div style={{ ...actionRow, marginTop: 12 }}>
                  <button
                    style={secondaryBtn}
                    onClick={() => {
                      setSaveModalOpen(false);
                      setNewPresetName("");
                    }}
                  >
                    Avbryt
                  </button>
                  <button
                    style={primaryBtn}
                    onClick={handleSavePreset}
                    disabled={!newPresetName.trim()}
                    data-testid="director-confirm-save-preset"
                  >
                    Lagre
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {(loop.running || loop.completed) && (
        <>
          <div style={goalBanner} data-testid="director-goal-banner">
            <span style={goalLabel}>MÅL</span>
            <span style={goalText}>{loop.goal}</span>
          </div>
          {loop.lastContextSnapshot && (
            <div style={contextPreviewBoxRunning} data-testid="director-context-snapshot">
              <span style={contextLabelRunning}>KONTEKST</span>
              <span style={contextSnapshotText}>{loop.lastContextSnapshot}</span>
            </div>
          )}

          <div style={styles.progressList} data-testid="director-progress">
            {loop.iterations.map((card) => (
              <div
                key={card.id}
                style={iterationCardStyle(card.status)}
                data-testid={`director-iteration-${card.id}`}
                data-status={card.status}
              >
                <header style={iterationHeader}>
                  <span style={iterationLabel}>Iterasjon {card.id}</span>
                  <span style={iterationStatusBadge(card.status)}>
                    {iterationStatusText(card.status)}
                  </span>
                  <span style={iterationToolCount}>
                    {card.steps.filter((s) => s.kind === "tool").length} tools
                  </span>
                </header>
                <div style={iterationBody}>
                  {card.steps.map((s) => (
                    <div
                      key={s.id}
                      style={{ ...progressItem, ...stepStyle(s.kind) }}
                      data-testid={`director-step-${s.kind}`}
                    >
                      <div style={stepHeader}>
                        <span style={stepKindBadge(s.kind)}>{s.kind.toUpperCase()}</span>
                        <span style={stepLabel}>{s.label}</span>
                      </div>
                      {s.detail && <div style={stepDetail}>{s.detail}</div>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {loop.running && (
              <div
                style={{ ...progressItem, ...stepStyle("thinking") }}
                data-testid="director-running"
              >
                <div style={stepHeader}>
                  <span style={stepKindBadge("thinking")}>WORKING</span>
                  <span style={stepLabel}>Claude tenker…</span>
                </div>
              </div>
            )}
          </div>

          <div style={actionRow}>
            {loop.running && (
              <button style={secondaryBtn} onClick={loop.stop} data-testid="director-stop">
                <StopIcon sx={{ fontSize: 16 }} /> Stopp
              </button>
            )}
            {loop.completed && (
              <button
                style={secondaryBtn}
                onClick={loop.reset}
                data-testid="director-reset"
              >
                <AutoAwesomeIcon sx={{ fontSize: 14 }} /> Nytt mål
              </button>
            )}
          </div>

          {loop.error && (
            <div style={errorBox} data-testid="director-error">
              {loop.error}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// helpers
// ──────────────────────────────────────────────────────────────

function iterationStatusText(status: IterationCard["status"]): string {
  return status === "working" ? "WORKING" : status === "error" ? "FEIL" : "FERDIG";
}

function iterationCardStyle(status: IterationCard["status"]): React.CSSProperties {
  const base: React.CSSProperties = {
    background: "#15151c",
    border: "1px solid #2a2a36",
    borderRadius: 8,
    overflow: "hidden",
  };
  if (status === "error") return { ...base, borderColor: "#f472b650" };
  if (status === "working") return { ...base, borderColor: "#a78bfa50" };
  return { ...base, borderColor: "#34d39940" };
}

function iterationStatusBadge(status: IterationCard["status"]): React.CSSProperties {
  const color = status === "working" ? "#a78bfa" : status === "error" ? "#f472b6" : "#34d399";
  return {
    fontSize: 9,
    background: color + "20",
    border: "1px solid " + color + "50",
    color,
    padding: "2px 6px",
    borderRadius: 4,
    fontWeight: 700,
    letterSpacing: 0.4,
  };
}

function stepStyle(kind: ProgressStep["kind"]): React.CSSProperties {
  switch (kind) {
    case "tool":
      return { borderLeftColor: "#60a5fa" };
    case "result":
      return { borderLeftColor: "#34d399" };
    case "error":
      return { borderLeftColor: "#f472b6", background: "#3f1d1d" };
    case "thinking":
    default:
      return { borderLeftColor: "#a78bfa" };
  }
}

function stepKindBadge(kind: ProgressStep["kind"]): React.CSSProperties {
  const colors: Record<ProgressStep["kind"], string> = {
    thinking: "#a78bfa",
    tool: "#60a5fa",
    result: "#34d399",
    error: "#f472b6",
  };
  return {
    fontSize: 9,
    background: colors[kind] + "20",
    border: "1px solid " + colors[kind] + "50",
    color: colors[kind],
    padding: "2px 6px",
    borderRadius: 4,
    fontWeight: 700,
    letterSpacing: 0.4,
    flexShrink: 0,
  };
}

// ──────────────────────────────────────────────────────────────
// styles
// ──────────────────────────────────────────────────────────────

const standardStyles = {
  root: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
    color: "#e5e5ea",
  } as React.CSSProperties,
  textarea: {
    background: "#0b0b12",
    border: "1px solid #2a2a36",
    borderRadius: 8,
    color: "#e5e5ea",
    padding: "10px 12px",
    fontSize: 13,
    fontFamily: "inherit",
    resize: "vertical",
    minHeight: 100,
  } as React.CSSProperties,
  progressList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    maxHeight: 400,
    overflowY: "auto",
    background: "#0b0b12",
    border: "1px solid #2a2a36",
    borderRadius: 8,
    padding: 10,
  } as React.CSSProperties,
};

const compactStyles = {
  root: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    color: "#e5e5ea",
    fontSize: 12,
  } as React.CSSProperties,
  textarea: {
    background: "#0b0b12",
    border: "1px solid #2a2a36",
    borderRadius: 6,
    color: "#e5e5ea",
    padding: "8px 10px",
    fontSize: 12,
    fontFamily: "inherit",
    resize: "vertical",
    minHeight: 70,
  } as React.CSSProperties,
  progressList: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    maxHeight: 300,
    overflowY: "auto",
    background: "#0b0b12",
    border: "1px solid #2a2a36",
    borderRadius: 6,
    padding: 8,
  } as React.CSSProperties,
};

const fieldLabel: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  fontSize: 12.5,
  fontWeight: 600,
  color: "#cbcbd5",
  gap: 4,
};

const fieldHint: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 400,
  color: "#9ca3af",
};

const actionRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
};

const secondaryBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  background: "#22222e",
  border: "1px solid #2e2e3a",
  color: "#cbcbd5",
  fontSize: 12,
  padding: "8px 14px",
  borderRadius: 8,
  cursor: "pointer",
};

const primaryBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  background: "linear-gradient(135deg, #a78bfa, #7c3aed)",
  border: 0,
  color: "white",
  fontSize: 12,
  fontWeight: 600,
  padding: "8px 16px",
  borderRadius: 8,
  cursor: "pointer",
};

const goalBanner: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 8,
  background: "#1c1c26",
  border: "1px solid #2a2a36",
  borderRadius: 8,
  padding: "10px 12px",
};

const goalLabel: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: 0.8,
  color: "#9ca3af",
  background: "#22222e",
  padding: "2px 6px",
  borderRadius: 4,
  flexShrink: 0,
};

const goalText: React.CSSProperties = {
  fontSize: 12.5,
  color: "#e5e5ea",
  lineHeight: 1.5,
};

const contextPreviewBox: React.CSSProperties = {
  background: "#0e1422",
  border: "1px solid #1e3a5f",
  borderRadius: 6,
  padding: "8px 10px",
};

const contextPreviewBoxRunning: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  background: "#0e1422",
  border: "1px solid #1e3a5f",
  borderRadius: 6,
  padding: "8px 10px",
};

const contextHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  marginBottom: 4,
};

const contextLabel: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: 0.8,
  color: "#60a5fa",
  textTransform: "uppercase",
};

const contextLabelRunning: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: 0.8,
  color: "#60a5fa",
};

const contextText: React.CSSProperties = {
  margin: 0,
  fontSize: 10.5,
  color: "#a8a8b8",
  lineHeight: 1.4,
  fontFamily: "ui-monospace, monospace",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};

const contextSnapshotText: React.CSSProperties = {
  fontSize: 10.5,
  color: "#a8a8b8",
  lineHeight: 1.4,
  fontFamily: "ui-monospace, monospace",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};

const iterationHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "8px 12px",
  background: "#1c1c26",
  borderBottom: "1px solid #2a2a36",
};

const iterationLabel: React.CSSProperties = {
  fontSize: 11.5,
  fontWeight: 700,
  color: "#e5e5ea",
  letterSpacing: 0.4,
};

const iterationToolCount: React.CSSProperties = {
  fontSize: 10,
  color: "#7b7b8d",
  marginLeft: "auto",
};

const iterationBody: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  padding: 8,
};

const progressItem: React.CSSProperties = {
  background: "#1c1c26",
  borderLeft: "3px solid #a78bfa",
  borderRadius: 4,
  padding: "8px 10px",
};

const stepHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const stepLabel: React.CSSProperties = {
  fontSize: 12,
  color: "#e5e5ea",
  fontWeight: 500,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const stepDetail: React.CSSProperties = {
  marginTop: 4,
  fontSize: 11,
  color: "#a8a8b8",
  lineHeight: 1.5,
  fontFamily: "ui-monospace, monospace",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};

const errorBox: React.CSSProperties = {
  fontSize: 11.5,
  color: "#fda4af",
  background: "#3f1d1d",
  border: "1px solid #5a2a2a",
  borderRadius: 6,
  padding: "8px 10px",
};

const inputStyle: React.CSSProperties = {
  background: "#0b0b12",
  border: "1px solid #2a2a36",
  borderRadius: 8,
  color: "#e5e5ea",
  padding: "10px 12px",
  fontSize: 13,
  width: "100%",
  fontFamily: "inherit",
};

const presetsHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  marginBottom: 6,
};

const presetsLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0.8,
  color: "#9ca3af",
  textTransform: "uppercase",
};

const presetsList: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
};

const presetCard: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  background: "#1c1c26",
  border: "1px solid #2a2a36",
  borderRadius: 6,
  padding: 0,
  cursor: "pointer",
  overflow: "hidden",
};

const presetCardActive: React.CSSProperties = {
  borderColor: "#a78bfa",
  background: "#1c1c2c",
};

const presetUseBtn: React.CSSProperties = {
  background: "transparent",
  border: 0,
  color: "#cbcbd5",
  fontSize: 11.5,
  padding: "6px 10px",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
};

const presetDeleteBtn: React.CSSProperties = {
  background: "transparent",
  border: 0,
  borderLeft: "1px solid #2a2a36",
  color: "#7b7b8d",
  fontSize: 11,
  padding: "6px 8px",
  cursor: "pointer",
};

const presetName: React.CSSProperties = {
  color: "#cbcbd5",
};

const presetRunCount: React.CSSProperties = {
  fontSize: 9,
  color: "#a78bfa",
  background: "#a78bfa20",
  padding: "1px 5px",
  borderRadius: 4,
  fontWeight: 700,
};

const presetBuiltinBadge: React.CSSProperties = {
  fontSize: 9,
  color: "#7b7b8d",
  background: "#22222e",
  padding: "1px 5px",
  borderRadius: 4,
  fontWeight: 600,
  letterSpacing: 0.4,
  marginRight: 10,
};

const saveOverlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0, 0, 0, 0.6)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 3500,
};

const saveModal: React.CSSProperties = {
  background: "#15151c",
  border: "1px solid #2a2a36",
  borderRadius: 12,
  padding: 18,
  width: "min(420px, 92vw)",
};

const saveModalTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "#e5e5ea",
  marginBottom: 12,
};
