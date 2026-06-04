/**
 * MultiAgentDirectorDialog — next-level AI Creative Director.
 *
 * Brukeren skriver et HØYTNIVÅ-mål ("touche opp alle bryllups-stills
 * til Cinematic-look og push dem tilbake til timeline"), og Claude
 * planlegger + utfører oppgavene autonomt via Photoshop-broen:
 *   - Lister picks (resolve.listInbox eller Story-tab-picks)
 *   - For hvert item: see_canvas → analyser → tools → resolve.exportBack
 *   - Tracker progress + lar brukeren stoppe mid-loop
 *
 * Forskjell fra PhotoshopAgentDialog: denne er ITERATIV (designet for
 * multi-step loops), har strukturert progress-tracking per item, og
 * høyere iteration-budget. PhotoshopAgentDialog er for single-turn
 * conversation.
 */

import { useState, useRef, useEffect } from "react";
import {
  claudeProxyService,
  type ClaudeMessage,
  type ClaudeContentBlock,
} from "../services/claudeProxyService";
import {
  PHOTOSHOP_TOOLS,
  runAllPhotoshopTools,
  extractToolUses,
} from "../agents/photoshopTools";
import CloseIcon from "@mui/icons-material/Close";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import StopIcon from "@mui/icons-material/Stop";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import BookmarkIcon from "@mui/icons-material/BookmarkOutlined";
import DeleteIcon from "@mui/icons-material/DeleteOutlineOutlined";
import {
  BUILTIN_PRESETS,
  deletePreset as deletePresetFn,
  listPresets,
  savePreset,
  touchPreset,
  type DirectorPreset,
} from "../lib/directorPresets";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface ProgressStep {
  id: string;
  iterationId: number;
  kind: "thinking" | "tool" | "result" | "error";
  label: string;
  detail?: string;
  timestamp: number;
}

interface IterationCard {
  id: number;
  status: "working" | "done" | "error";
  steps: ProgressStep[];
}

const MAX_ITERATIONS = 30;

const DIRECTOR_SYSTEM_PROMPT = `Du er Multi-Agent AI Creative Director for Post Agent — Claude-bron mot Photoshop OG DaVinci Resolve 21. Brukeren gir deg et HØYTNIVÅ-mål, og du planlegger + utfører autonomt ved å kalle photoshop_*-tools i en iterativ loop.

GENERELL STRATEGI:
1. Forstå målet kort (1 setning til brukeren før du starter).
2. KARTLEGG state FØR du handler — én call dekker det meste:
   • Resolve project-state: photoshop_resolve_project_get_setting uten key → full settings-dict
   • Timeline-state: photoshop_resolve_timeline_get_setting uten key → fps/resolusjon/farger
   • Hvilken page er Resolve på: photoshop_resolve_page_current
   • Hva ligger på timeline-track: photoshop_resolve_timeline_get_item_list_in_track
   • Hva er i Media Pool: photoshop_resolve_media_pool_list_items
   • Hvilke Photoshop-layers: photoshop_list_layers + photoshop_selection_info
3. Bruk photoshop_see_canvas KUN når visuell forståelse er nødvendig (kostbart).
4. Etter hvert tool-call: gi 1-setnings statusoppdatering.
5. Når ferdig: oppsummer + pek brukeren mot resultatet.

SMART ROUTING — Resolve 21 native vs Photoshop:
Resolve 21 har enorm innebygd AI. Velg Resolve native FØRST når:

  • Eksport av video/timeline → photoshop_resolve_quick_export_run (list presets først)
  • Custom render-job → photoshop_resolve_render_add_job + start_render
  • Face/object-detection per klipp → photoshop_resolve_intellisearch_analyze (triggér) + read_intellisearch (les)
  • Slate-detection → photoshop_resolve_slate_analyze (16 marker-farger)
  • AI reframe → photoshop_resolve_timeline_smart_reframe
  • Magic Mask på person/objekt → photoshop_resolve_magic_mask_create / regenerate
  • Voice Isolation (rens dialog-spor) → photoshop_resolve_voice_set_isolation_state (0-100 amount)
  • Audio transkripsjon / klassifisering → photoshop_resolve_audio_transcribe / classify
  • Generere voice fra tekst → photoshop_resolve_speech_generate
  • Dolby Vision-analyse → photoshop_resolve_dolby_vision_analyze
  • Color-grading lagret som preset → photoshop_resolve_power_grade_create + export, eller graph.applyLUT / graph.applyGradeFromDRX
  • Subtitle fra ekstern .srt → photoshop_resolve_subtitle_import_from_file
  • Auto-subtitles fra audio → photoshop_resolve_subtitles_create_from_audio

Velg PHOTOSHOP når:
  • Generative Fill / Expand (kun Firefly) → gen_fill / gen_expand + suggest_firefly_prompts
  • PSD-template med smart-objects/text → scan_template + render_template + batch_render
  • Multi-aspect export fra master-PSD → multi_aspect_export
  • Ikke-destruktive adjustment-layers → add_adjustment / apply_style
  • Vision-analyse av canvas → see_canvas (vision-content i tool_result)
  • Mask fra PNG → selection_from_mask
  • Tryggere AI-eksperimenter med rollback → history_snapshot FØR risikable endringer, revert hvis brukeren ikke liker

HYBRID-flyter:
  • "Touch up stills til timeline" → resolve.openLatest → adjustment/gen.fill → resolve.exportBack (auto-replace via Tier 1 bidir-sync)
  • "Sosial-pakke fra timeline" → resolve.quickExportRun (video) + photoshop.multiAspectExport (poster)
  • "Fix klipp uten face-signal" → resolve.intellisearchAnalyze + readIntellisearch → loop dårlige → openLatest → gen.fill ny reaction-shot → exportBack

WORKFLOW-ORGANISERING (bruk Resolve clip-colors og markers for state-sporing):
  • Merk uvurderte klipp Yellow: photoshop_resolve_clip_set_color {color: "Yellow"}
  • Merk klipp med dårlig audio Red, gode Green
  • Bytt page før visse operasjoner: photoshop_resolve_page_open {name: "color"} for graph-tools, "fairlight" for audio
  • Flytt playhead presist: photoshop_resolve_timeline_set_current_timecode {timecode: "HH:MM:SS:FF"}
  • Hent current playhead: photoshop_resolve_timeline_get_current_timecode

VIKTIGE BEGRENSNINGER:
- Iterasjons-budsjett: ${MAX_ITERATIONS}. Bruk dem klokt — én "full snapshot"-call > fem småspørringer.
- Resolve-tools krever at watch-resolve-commands.lua kjører i Resolve. Hvis du får timeout-feil → fortell brukeren.
- SetSetting/SetClipProperty godtar KUN strings — konverter numbers ("24"-string, ikke 24-number).
- Aldri gjett file-paths, layer-navn eller preset-navn — list dem først.
- Hvis brukeren stopper sesjonen, respekter det og avslutt elegant.
- Hold tone og rapport på norsk.

TOOL-DOMENER (sjekk tools-listen for nøyaktige navn — det er over 80 photoshop_*-tools):
  • VISION: see_canvas
  • PHOTOSHOP INTROSPEKSJON: list_layers, selection_info
  • PHOTOSHOP EDIT: open/save/export_document, replace_smart_object, set_text, toggle_layer, add_adjustment, apply_style, history_snapshot/revert
  • TEMPLATES: scan_template, render_template, batch_render, multi_aspect_export
  • FIREFLY: selection_select/from_mask, gen_fill, gen_expand, suggest_firefly_prompts
  • RESOLVE BRO: resolve_list_inbox, resolve_open_latest, resolve_export_back
  • RESOLVE INTROSPEKSJON: resolve_project_info, resolve_project_get_setting, resolve_timeline_get_setting, resolve_timeline_get_current_item, resolve_timeline_get_current_timecode, resolve_timeline_get_item_list_in_track, resolve_clip_get_property, resolve_clip_get_color, resolve_page_current, resolve_media_pool_list_items, resolve_read_intellisearch
  • RESOLVE AI: resolve_intellisearch_analyze, resolve_slate_analyze, resolve_magic_mask_*, resolve_timeline_smart_reframe, resolve_dolby_vision_analyze, resolve_audio_transcribe/classify, resolve_speech_generate, resolve_voice_get/set_isolation_state, resolve_subtitles_create_from_audio
  • RESOLVE COLOR: resolve_lut_refresh, resolve_graph_get_nodes, resolve_graph_apply_lut, resolve_graph_apply_grade_from_drx, resolve_graph_reset_all_grades, resolve_graph_set_node_enabled, resolve_grades_copy_to_timeline, resolve_grades_export_lut, resolve_power_grade_list/create/export, resolve_gallery_import_stills
  • RESOLVE EDIT: resolve_subtitle_import_from_file, resolve_track_*, resolve_markers_*, resolve_project_set_setting, resolve_timeline_set_setting, resolve_clip_set_property, resolve_clip_set_color, resolve_clip_clear_color
  • RESOLVE NAVIGATION: resolve_page_open, resolve_timeline_set_current_timecode
  • RESOLVE EXPORT: resolve_quick_export_list/run, resolve_render_add_job/list/start/stop/status/delete`;

export function MultiAgentDirectorDialog({ open, onClose }: Props) {
  const [goal, setGoal] = useState("");
  const [steps, setSteps] = useState<ProgressStep[]>([]);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [presets, setPresets] = useState<DirectorPreset[]>([]);
  const [appliedPresetId, setAppliedPresetId] = useState<string | null>(null);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");
  const stopRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) setPresets(listPresets());
  }, [open]);

  const applyPreset = (preset: { id?: string; goal: string }) => {
    setGoal(preset.goal);
    setAppliedPresetId(preset.id ?? null);
  };

  const handleSavePreset = () => {
    const name = newPresetName.trim();
    if (!name || !goal.trim()) return;
    try {
      savePreset({ name, goal });
      setPresets(listPresets());
      setSaveModalOpen(false);
      setNewPresetName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDeletePreset = (id: string) => {
    deletePresetFn(id);
    setPresets(listPresets());
    if (appliedPresetId === id) setAppliedPresetId(null);
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [steps.length]);

  const currentIterationRef = useRef(0);

  const addStep = (s: Omit<ProgressStep, "id" | "timestamp" | "iterationId">) => {
    setSteps((prev) => [
      ...prev,
      {
        ...s,
        iterationId: currentIterationRef.current,
        id: `${Date.now()}-${prev.length}`,
        timestamp: Date.now(),
      },
    ]);
  };

  const handleStop = () => {
    stopRef.current = true;
    addStep({ kind: "result", label: "Stoppet av bruker" });
  };

  const handleStart = async () => {
    if (!goal.trim()) return;
    setRunning(true);
    setCompleted(false);
    setError(null);
    setSteps([]);
    stopRef.current = false;
    if (appliedPresetId) {
      touchPreset(appliedPresetId);
      setPresets(listPresets());
    }

    const messages: ClaudeMessage[] = [{ role: "user", content: goal.trim() }];
    let iterations = 0;
    currentIterationRef.current = 0;

    try {
      while (iterations < MAX_ITERATIONS) {
        if (stopRef.current) break;
        iterations += 1;
        currentIterationRef.current = iterations;

        addStep({ kind: "thinking", label: `Iterasjon ${iterations}: Claude planlegger…` });

        const response = await claudeProxyService.sendRaw({
          systemPrompt: DIRECTOR_SYSTEM_PROMPT,
          messages,
          tools: PHOTOSHOP_TOOLS as never,
          maxTokens: 2000,
        });

        // Vis tekst-blokker som Claude skriver
        for (const block of response.content) {
          if (block.type === "text" && block.text.trim()) {
            addStep({ kind: "result", label: "Claude", detail: block.text.trim() });
          }
        }

        // Hvis ingen tool-use → ferdig
        const tools = extractToolUses(response.content);
        if (tools.length === 0) {
          break;
        }

        // Logg hvert tool-call før eksekvering
        for (const t of tools) {
          addStep({
            kind: "tool",
            label: t.name,
            detail: JSON.stringify(t.input).slice(0, 200),
          });
        }

        // Kjør alle tool-calls
        const results = await runAllPhotoshopTools(response.content as unknown as ClaudeContentBlock[]);

        // Akkumuler conversation: assistant-respons + tool-resultater
        messages.push({ role: "assistant", content: response.content });
        messages.push({
          role: "user",
          content: results.map((r) => ({
            type: "tool_result" as const,
            tool_use_id: r.tool_use_id,
            content: r.content,
            is_error: r.is_error,
          })),
        });

        // Hvis Claude svarte med end_turn (ingen tools), break
        if (response.stop_reason === "end_turn") break;
      }

      setCompleted(true);
      if (iterations >= MAX_ITERATIONS) {
        addStep({
          kind: "error",
          label: `Stoppet ved iterasjons-grense (${MAX_ITERATIONS})`,
          detail: "Øk MAX_ITERATIONS eller bryt målet i mindre biter.",
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      addStep({ kind: "error", label: "Feil", detail: msg });
    } finally {
      setRunning(false);
    }
  };

  if (!open) return null;

  return (
    <div style={backdrop} data-testid="multi-agent-director-dialog">
      <div style={dialog}>
        <header style={dialogHeader}>
          <div style={dialogTitle}>
            <AutoAwesomeIcon sx={{ fontSize: 18, color: "#a78bfa" }} />
            <span>Multi-Agent Creative Director</span>
            <span style={betaBadge}>BETA</span>
          </div>
          <button style={closeBtn} onClick={onClose} aria-label="Lukk" data-testid="mad-close">
            <CloseIcon sx={{ fontSize: 18 }} />
          </button>
        </header>

        <div style={body}>
          {!running && !completed && (
            <>
              {(presets.length > 0 || BUILTIN_PRESETS.length > 0) && (
                <div data-testid="mad-presets-section">
                  <div style={presetsHeader}>
                    <BookmarkIcon sx={{ fontSize: 14, color: "#a78bfa" }} />
                    <span style={presetsLabel}>Lagrede flows</span>
                    <span style={presetsHint}>Klikk for å plugge inn som goal</span>
                  </div>
                  <div style={presetsList}>
                    {presets.map((p) => (
                      <div
                        key={p.id}
                        style={{
                          ...presetCard,
                          ...(appliedPresetId === p.id ? presetCardActive : null),
                        }}
                        data-testid={`mad-preset-${p.id}`}
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
                          data-testid={`mad-preset-builtin-${p.name}`}
                        >
                          <span style={presetName}>{p.name}</span>
                          <span style={presetBuiltinBadge}>BUILTIN</span>
                        </button>
                      ))}
                  </div>
                </div>
              )}

              <label style={fieldLabel}>
                Hva vil du at AI Creative Director skal gjøre?
                <span style={fieldHint}>
                  Eksempler: "Touche opp alle bryllups-stills med Cinematic-look og send dem
                  tilbake til Resolve" eller "Lag 4 aspect-varianter av aktiv PSD og legg dem på
                  Desktop"
                </span>
              </label>
              <textarea
                data-testid="mad-goal-input"
                style={textarea}
                rows={4}
                placeholder="Skriv målet ditt her…"
                value={goal}
                onChange={(e) => {
                  setGoal(e.target.value);
                  setAppliedPresetId(null);
                }}
              />
              <div style={actionRow}>
                <button style={secondaryBtn} onClick={onClose}>
                  Avbryt
                </button>
                <button
                  style={secondaryBtn}
                  onClick={() => setSaveModalOpen(true)}
                  disabled={!goal.trim()}
                  data-testid="mad-save-preset"
                >
                  <BookmarkIcon sx={{ fontSize: 14 }} /> Lagre som flow
                </button>
                <button
                  style={primaryBtn}
                  onClick={handleStart}
                  disabled={!goal.trim()}
                  data-testid="mad-start"
                >
                  <PlayArrowIcon sx={{ fontSize: 16 }} /> Start
                </button>
              </div>

              {saveModalOpen && (
                <div style={saveOverlay} data-testid="mad-save-modal">
                  <div style={saveModal}>
                    <div style={saveModalTitle}>Lagre som flow</div>
                    <input
                      data-testid="mad-preset-name-input"
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
                        data-testid="mad-confirm-save-preset"
                      >
                        Lagre
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {(running || completed) && (
            <>
              <div style={goalBanner} data-testid="mad-goal-banner">
                <span style={goalLabel}>MÅL</span>
                <span style={goalText}>{goal}</span>
              </div>

              <div style={progressList} ref={scrollRef} data-testid="mad-progress">
                {groupByIteration(steps, running).map((card) => (
                  <div
                    key={card.id}
                    style={iterationCardStyle(card.status)}
                    data-testid={`mad-iteration-${card.id}`}
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
                          data-testid={`mad-step-${s.kind}`}
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
                {running && (
                  <div style={{ ...progressItem, ...stepStyle("thinking") }} data-testid="mad-running">
                    <div style={stepHeader}>
                      <span style={stepKindBadge("thinking")}>WORKING</span>
                      <span style={stepLabel}>Claude tenker…</span>
                    </div>
                  </div>
                )}
              </div>

              <div style={actionRow}>
                {running && (
                  <button
                    style={secondaryBtn}
                    onClick={handleStop}
                    data-testid="mad-stop"
                  >
                    <StopIcon sx={{ fontSize: 16 }} /> Stopp
                  </button>
                )}
                {completed && (
                  <>
                    <button
                      style={secondaryBtn}
                      onClick={() => {
                        setCompleted(false);
                        setSteps([]);
                        setError(null);
                      }}
                      data-testid="mad-new"
                    >
                      Nytt mål
                    </button>
                    <button style={primaryBtn} onClick={onClose} data-testid="mad-done">
                      Ferdig
                    </button>
                  </>
                )}
              </div>

              {error && (
                <div style={errorBox} data-testid="mad-error">
                  {error}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function groupByIteration(steps: ProgressStep[], running: boolean): IterationCard[] {
  const byId = new Map<number, IterationCard>();
  for (const s of steps) {
    let card = byId.get(s.iterationId);
    if (!card) {
      card = { id: s.iterationId, status: "working", steps: [] };
      byId.set(s.iterationId, card);
    }
    card.steps.push(s);
    if (s.kind === "error") card.status = "error";
  }
  const cards = Array.from(byId.values()).sort((a, b) => a.id - b.id);
  // Marker alle ferdige unntatt siste hvis vi fortsatt kjører
  cards.forEach((c, i) => {
    if (c.status === "error") return;
    const isLast = i === cards.length - 1;
    if (running && isLast) {
      c.status = "working";
    } else {
      c.status = "done";
    }
  });
  return cards;
}

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
  if (status === "error") {
    return { ...base, borderColor: "#f472b650" };
  }
  if (status === "working") {
    return { ...base, borderColor: "#a78bfa50" };
  }
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

const betaBadge: React.CSSProperties = {
  fontSize: 9,
  background: "#a78bfa20",
  border: "1px solid #a78bfa50",
  color: "#a78bfa",
  padding: "1px 6px",
  borderRadius: 6,
  fontWeight: 600,
  letterSpacing: 0.4,
};

const closeBtn: React.CSSProperties = {
  background: "transparent",
  border: 0,
  color: "#9ca3af",
  cursor: "pointer",
  padding: 4,
  display: "inline-flex",
};

const body: React.CSSProperties = {
  padding: 18,
  display: "flex",
  flexDirection: "column",
  gap: 14,
  overflowY: "auto",
  flex: 1,
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

const textarea: React.CSSProperties = {
  background: "#0b0b12",
  border: "1px solid #2a2a36",
  borderRadius: 8,
  color: "#e5e5ea",
  padding: "10px 12px",
  fontSize: 13,
  fontFamily: "inherit",
  resize: "vertical",
  minHeight: 100,
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

const progressList: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  maxHeight: 400,
  overflowY: "auto",
  background: "#0b0b12",
  border: "1px solid #2a2a36",
  borderRadius: 8,
  padding: 10,
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
  marginBottom: 8,
};

const presetsLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0.8,
  color: "#9ca3af",
  textTransform: "uppercase",
};

const presetsHint: React.CSSProperties = {
  fontSize: 10,
  color: "#7b7b8d",
  marginLeft: 4,
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
