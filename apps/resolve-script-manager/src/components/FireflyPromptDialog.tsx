/**
 * FireflyPromptDialog — UI rundt fireflyPromptHelper.
 *
 * Flyt:
 *   1. Brukeren velger intent (expand/remove/replace/...)
 *   2. Kan fylle inn kontekst (scene, style, time-of-day, fri-tekst)
 *   3. Klikker "Generer forslag" (local) eller "Spør Claude" (claude-mode)
 *   4. Ser 1-4 forslag inline med rasjonale
 *   5. Klikker "Bruk denne prompten" → onApply(prompt) lukker dialogen
 *
 * Parent-komponent kan så plugge prompten direkte inn i en
 * `photoshop.generativeFill(prompt)` eller `photoshop.generativeExpand({prompt, ...})`-call.
 */

import { useState } from "react";
import {
  suggestPromptsLocal,
  suggestPromptsViaClaude,
  extractContextFromAppInfo,
  type FireflyIntent,
  type FireflyContext,
  type FireflyPromptSuggestion,
} from "../lib/fireflyPromptHelper";
import { photoshop } from "../services/photoshopBridgeService";
import CloseIcon from "@mui/icons-material/Close";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import RefreshIcon from "@mui/icons-material/Refresh";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Når brukeren velger en prompt — parent plugger den inn i gen.fill/gen.expand. */
  onApply: (prompt: string) => void;
  /** Forhåndsutfylt intent. Brukeren kan endre. */
  initialIntent?: FireflyIntent;
  /** Forhåndsutfylt kontekst. */
  initialContext?: FireflyContext;
}

const INTENT_LABELS: Record<FireflyIntent, string> = {
  expand_background: "Utvid bakgrunn",
  remove_object: "Fjern objekt",
  replace_background: "Erstatt bakgrunn",
  add_element: "Legg til element",
  fix_edges: "Fiks kanter",
  stylize: "Stilisér",
  generate_subject: "Generer subjekt",
};

const SCENE_TYPES: Array<{ value: NonNullable<FireflyContext["scene_type"]>; label: string }> = [
  { value: "wedding", label: "Bryllup" },
  { value: "portrait", label: "Portrett" },
  { value: "landscape", label: "Landskap" },
  { value: "product", label: "Produkt" },
  { value: "interior", label: "Interiør" },
  { value: "event", label: "Event" },
  { value: "studio", label: "Studio" },
  { value: "outdoor", label: "Utendørs" },
  { value: "urban", label: "Urban" },
];

const TIME_OPTIONS: Array<{ value: NonNullable<FireflyContext["time_of_day"]>; label: string }> = [
  { value: "morning", label: "Morgen" },
  { value: "midday", label: "Midt på dagen" },
  { value: "golden_hour", label: "Golden hour" },
  { value: "blue_hour", label: "Blue hour" },
  { value: "night", label: "Natt" },
];

const COMMON_STYLE_TAGS = [
  "cinematic", "natural", "vibrant", "moody", "warm", "cool",
  "timeless", "documentary", "editorial", "dreamy",
];

export function FireflyPromptDialog({
  open,
  onClose,
  onApply,
  initialIntent = "expand_background",
  initialContext = {},
}: Props) {
  const [intent, setIntent] = useState<FireflyIntent>(initialIntent);
  const [userIntent, setUserIntent] = useState(initialContext.user_intent ?? "");
  const [sceneType, setSceneType] = useState<FireflyContext["scene_type"]>(initialContext.scene_type);
  const [timeOfDay, setTimeOfDay] = useState<FireflyContext["time_of_day"]>(initialContext.time_of_day);
  const [subjectDesc, setSubjectDesc] = useState(initialContext.subject_description ?? "");
  const [lighting, setLighting] = useState(initialContext.lighting ?? "");
  const [styleTags, setStyleTags] = useState<string[]>(initialContext.style_tags ?? []);
  const [suggestions, setSuggestions] = useState<FireflyPromptSuggestion[]>([]);
  const [source, setSource] = useState<"local" | "claude" | "idle">("idle");
  const [loading, setLoading] = useState(false);
  const [contextLoading, setContextLoading] = useState(false);
  const [contextNote, setContextNote] = useState<string | null>(null);
  const [targetAspect, setTargetAspect] = useState<string | undefined>(initialContext.target_aspect);
  const [error, setError] = useState<string | null>(null);

  const handleFetchContext = async () => {
    setError(null);
    setContextLoading(true);
    try {
      const info = await photoshop.appInfo();
      const ctx = extractContextFromAppInfo(info);
      const notes: string[] = [];
      if (ctx.scene_type && ctx.scene_type !== sceneType) {
        setSceneType(ctx.scene_type);
        notes.push(`scene: ${ctx.scene_type}`);
      }
      if (ctx.target_aspect) {
        setTargetAspect(ctx.target_aspect);
        notes.push(`aspect: ${ctx.target_aspect}`);
      }
      if (info.active_document?.name) {
        notes.push(`fra "${info.active_document.name}"`);
      }
      setContextNote(notes.length > 0 ? `Hentet: ${notes.join(", ")}` : "Ingen ny kontekst funnet");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setContextLoading(false);
    }
  };

  if (!open) return null;

  const ctx: FireflyContext = {
    user_intent: userIntent.trim() || undefined,
    scene_type: sceneType,
    time_of_day: timeOfDay,
    subject_description: subjectDesc.trim() || undefined,
    lighting: lighting.trim() || undefined,
    style_tags: styleTags.length > 0 ? styleTags : undefined,
    target_aspect: targetAspect,
  };

  const handleGenerateLocal = () => {
    setError(null);
    setSuggestions(suggestPromptsLocal(intent, ctx));
    setSource("local");
  };

  const handleGenerateClaude = async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await suggestPromptsViaClaude(intent, ctx);
      setSuggestions(result);
      setSource("claude");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const toggleStyleTag = (tag: string) => {
    setStyleTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  return (
    <div style={backdrop} data-testid="firefly-prompt-dialog">
      <div style={dialog}>
        <header style={dialogHeader}>
          <div style={dialogTitle}>
            <AutoAwesomeIcon sx={{ fontSize: 18, color: "#a78bfa" }} />
            <span>Firefly Prompt Assistant</span>
          </div>
          <button style={closeBtn} onClick={onClose} aria-label="Lukk" data-testid="ff-close">
            <CloseIcon sx={{ fontSize: 18 }} />
          </button>
        </header>

        <div style={dialogBody}>
          {/* Auto-context fetch */}
          <div style={contextRow}>
            <button
              style={contextBtn}
              onClick={handleFetchContext}
              disabled={contextLoading}
              data-testid="ff-fetch-context"
            >
              <RefreshIcon sx={{ fontSize: 14, marginRight: "6px", verticalAlign: "text-bottom" }} />
              {contextLoading ? "Henter…" : "Hent kontekst fra Photoshop"}
            </button>
            {contextNote && (
              <span style={contextNoteStyle} data-testid="ff-context-note">
                {contextNote}
              </span>
            )}
            {targetAspect && (
              <span style={aspectBadge} data-testid="ff-aspect-badge">
                {targetAspect}
              </span>
            )}
          </div>

          {/* Intent */}
          <label style={fieldLabel}>
            Hva vil du gjøre?
            <select
              data-testid="ff-intent"
              style={selectStyle}
              value={intent}
              onChange={(e) => setIntent(e.target.value as FireflyIntent)}
            >
              {(Object.keys(INTENT_LABELS) as FireflyIntent[]).map((key) => (
                <option key={key} value={key}>
                  {INTENT_LABELS[key]}
                </option>
              ))}
            </select>
          </label>

          {/* Fri-tekst */}
          <label style={fieldLabel}>
            Beskriv hva du tenker (valgfri)
            <input
              data-testid="ff-user-intent"
              type="text"
              placeholder="F.eks. 'utvid mot havsiden' eller 'erstatt bakgrunn med solnedgang'"
              style={inputStyle}
              value={userIntent}
              onChange={(e) => setUserIntent(e.target.value)}
            />
          </label>

          {/* Scene + Time of day */}
          <div style={twoColRow}>
            <label style={fieldLabel}>
              Scene-type
              <select
                data-testid="ff-scene"
                style={selectStyle}
                value={sceneType ?? ""}
                onChange={(e) =>
                  setSceneType((e.target.value || undefined) as FireflyContext["scene_type"])
                }
              >
                <option value="">— ingen —</option>
                {SCENE_TYPES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label style={fieldLabel}>
              Tid på dagen
              <select
                data-testid="ff-time"
                style={selectStyle}
                value={timeOfDay ?? ""}
                onChange={(e) =>
                  setTimeOfDay((e.target.value || undefined) as FireflyContext["time_of_day"])
                }
              >
                <option value="">— ingen —</option>
                {TIME_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Subject + Lighting */}
          <div style={twoColRow}>
            <label style={fieldLabel}>
              Hva er i bildet i dag?
              <input
                data-testid="ff-subject"
                type="text"
                placeholder="F.eks. 'brudepar utendørs'"
                style={inputStyle}
                value={subjectDesc}
                onChange={(e) => setSubjectDesc(e.target.value)}
              />
            </label>
            <label style={fieldLabel}>
              Lyssetting (valgfri)
              <input
                data-testid="ff-lighting"
                type="text"
                placeholder="F.eks. 'soft window light'"
                style={inputStyle}
                value={lighting}
                onChange={(e) => setLighting(e.target.value)}
              />
            </label>
          </div>

          {/* Style tags */}
          <div>
            <div style={fieldLabelText}>Stil-tags (multi)</div>
            <div style={tagRow} data-testid="ff-style-tags">
              {COMMON_STYLE_TAGS.map((tag) => {
                const active = styleTags.includes(tag);
                return (
                  <button
                    key={tag}
                    data-testid={`ff-tag-${tag}`}
                    data-active={active ? "true" : "false"}
                    onClick={() => toggleStyleTag(tag)}
                    style={{ ...tagBtn, ...(active ? tagBtnActive : null) }}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Suggest actions */}
          <div style={actionRow}>
            <button
              style={secondaryBtn}
              onClick={handleGenerateLocal}
              disabled={loading}
              data-testid="ff-suggest-local"
            >
              Generer forslag (lokal)
            </button>
            <button
              style={primaryBtn}
              onClick={handleGenerateClaude}
              disabled={loading}
              data-testid="ff-suggest-claude"
            >
              {loading ? "Claude jobber…" : "Spør Claude"}
            </button>
          </div>

          {error && (
            <div style={errorBox} data-testid="ff-error">
              {error}
            </div>
          )}

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div data-testid="ff-suggestions">
              <div style={sectionHeader}>
                Forslag <span style={sourceBadge}>{source === "claude" ? "CLAUDE" : "LOCAL"}</span>
              </div>
              {suggestions.map((s, i) => (
                <div
                  key={i}
                  style={suggestionCard}
                  data-testid={`ff-suggestion-${i}`}
                >
                  <div style={promptText} data-testid={`ff-suggestion-${i}-prompt`}>
                    {s.prompt || <em style={{ color: "#7b7b8d" }}>(tom prompt — auto-fill)</em>}
                  </div>
                  <div style={rationaleText}>{s.rationale}</div>
                  <button
                    style={applyBtn}
                    data-testid={`ff-apply-${i}`}
                    onClick={() => {
                      onApply(s.prompt);
                      onClose();
                    }}
                  >
                    Bruk denne prompten →
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const backdrop: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0, 0, 0, 0.6)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 3000,
  padding: 20,
};

const dialog: React.CSSProperties = {
  background: "#15151c",
  border: "1px solid #2a2a36",
  borderRadius: 12,
  width: "min(720px, 96vw)",
  maxHeight: "min(90vh, 900px)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  color: "#e5e5ea",
};

const dialogHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "14px 18px",
  borderBottom: "1px solid #2a2a36",
  background: "#1c1c26",
};

const dialogTitle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 14,
  fontWeight: 600,
};

const closeBtn: React.CSSProperties = {
  background: "transparent",
  border: 0,
  color: "#9ca3af",
  cursor: "pointer",
  padding: 4,
  display: "inline-flex",
};

const dialogBody: React.CSSProperties = {
  padding: 18,
  display: "flex",
  flexDirection: "column",
  gap: 14,
  overflowY: "auto",
};

const fieldLabel: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  fontSize: 12,
  fontWeight: 600,
  color: "#cbcbd5",
  gap: 4,
};

const fieldLabelText: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "#cbcbd5",
  marginBottom: 6,
};

const selectStyle: React.CSSProperties = {
  background: "#0b0b12",
  border: "1px solid #2a2a36",
  borderRadius: 6,
  color: "#e5e5ea",
  padding: "8px 10px",
  fontSize: 12.5,
};

const inputStyle: React.CSSProperties = {
  background: "#0b0b12",
  border: "1px solid #2a2a36",
  borderRadius: 6,
  color: "#e5e5ea",
  padding: "8px 10px",
  fontSize: 12.5,
};

const twoColRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
};

const tagRow: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
};

const tagBtn: React.CSSProperties = {
  background: "#1c1c26",
  border: "1px solid #2a2a36",
  borderRadius: 999,
  color: "#a8a8b8",
  fontSize: 11,
  padding: "5px 12px",
  cursor: "pointer",
};

const tagBtnActive: React.CSSProperties = {
  background: "#a78bfa20",
  borderColor: "#a78bfa",
  color: "#e5e5ea",
};

const actionRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
};

const secondaryBtn: React.CSSProperties = {
  background: "#22222e",
  border: "1px solid #2e2e3a",
  color: "#cbcbd5",
  fontSize: 12,
  padding: "8px 14px",
  borderRadius: 8,
  cursor: "pointer",
};

const primaryBtn: React.CSSProperties = {
  background: "linear-gradient(135deg, #a78bfa, #7c3aed)",
  border: 0,
  color: "white",
  fontSize: 12,
  fontWeight: 600,
  padding: "8px 16px",
  borderRadius: 8,
  cursor: "pointer",
};

const errorBox: React.CSSProperties = {
  fontSize: 11.5,
  color: "#fda4af",
  background: "#3f1d1d",
  border: "1px solid #5a2a2a",
  borderRadius: 6,
  padding: "8px 10px",
};

const sectionHeader: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0.8,
  color: "#9ca3af",
  textTransform: "uppercase",
  marginTop: 4,
  marginBottom: 8,
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const sourceBadge: React.CSSProperties = {
  fontSize: 9,
  background: "#a78bfa20",
  border: "1px solid #a78bfa50",
  color: "#a78bfa",
  padding: "1px 6px",
  borderRadius: 6,
  letterSpacing: 0.4,
};

const suggestionCard: React.CSSProperties = {
  background: "#1c1c26",
  border: "1px solid #2a2a36",
  borderRadius: 10,
  padding: "12px 14px",
  marginBottom: 10,
};

const promptText: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: "#e5e5ea",
  marginBottom: 6,
  fontFamily: "ui-monospace, monospace",
};

const rationaleText: React.CSSProperties = {
  fontSize: 11.5,
  lineHeight: 1.5,
  color: "#a8a8b8",
  marginBottom: 10,
};

const applyBtn: React.CSSProperties = {
  background: "#22222e",
  border: "1px solid #2e2e3a",
  color: "#cbcbd5",
  fontSize: 11.5,
  padding: "6px 12px",
  borderRadius: 6,
  cursor: "pointer",
};

const contextRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

const contextBtn: React.CSSProperties = {
  background: "#22222e",
  border: "1px solid #2e2e3a",
  color: "#cbcbd5",
  fontSize: 11.5,
  padding: "6px 12px",
  borderRadius: 6,
  cursor: "pointer",
};

const contextNoteStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#9ca3af",
  fontStyle: "italic",
};

const aspectBadge: React.CSSProperties = {
  fontSize: 10,
  background: "#a78bfa20",
  border: "1px solid #a78bfa50",
  color: "#a78bfa",
  padding: "2px 8px",
  borderRadius: 6,
  fontWeight: 600,
  letterSpacing: 0.4,
  fontFamily: "ui-monospace, monospace",
};
