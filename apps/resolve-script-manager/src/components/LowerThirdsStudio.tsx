/**
 * LowerThirdsStudio — Role Room-brandet lower-thirds-editor for Post
 * Agent. Bjarne kan lage taler-introduksjoner og navn-overlays med
 * timeline-position, animasjon, style-preset og safe-guides.
 *
 * Brand-identitet: Role Room's mørk-lilla palett. Academy-versjonen
 * forblir uendret — denne er en separat, video-editor-tilpasset
 * variant med fokus på enklere workflow, mindre kompleksitet enn
 * academy-studio-en.
 *
 * Layout (3-kolonner):
 *   - Venstre: items-liste + timeline-scrubber
 *   - Senter: live preview med valgt item rendret i video-flate
 *   - Høyre: edit-panel (title/subtitle/timing/style/animasjon/safe)
 */

import { useEffect, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlineOutlined";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import SaveIcon from "@mui/icons-material/Save";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import SubtitlesIcon from "@mui/icons-material/Subtitles";
import DownloadIcon from "@mui/icons-material/Download";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import { executeScript } from "../api";
import { openPath } from "@tauri-apps/plugin-opener";
import {
  STYLE_PRESETS, ANIMATION_LABELS, POSITION_LABELS,
  newLowerThirdItem, ROLE_ROOM_BRAND,
} from "../lib/lowerThirdTypes";
import type {
  LowerThirdItem, LowerThirdAnimation, LowerThirdPosition,
  StylePresetId,
} from "../lib/lowerThirdTypes";
import type { AgentKind } from "../agents/types";
import { lowerThirdsService } from "../services/lowerThirdsService";

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  agentKind: AgentKind;
  /** Video-varighet i sekunder (for timeline-skalering). */
  videoDurationSec?: number;
}

export function LowerThirdsStudio({
  open, onClose, projectId, agentKind, videoDurationSec = 300,
}: Props) {
  const [items, setItems] = useState<LowerThirdItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewTime, setPreviewTime] = useState(0);
  const [defaultPreset, setDefaultPreset] = useState<StylePresetId>("role-room-signature");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{
    outputDir: string; renderedCount: number;
  } | null>(null);

  // Hent items ved open
  useEffect(() => {
    if (!open || !projectId) return;
    setLoaded(false);
    lowerThirdsService.list(projectId).then(cols => {
      const def = cols.find(c => c.collectionName === "Default");
      if (def) {
        setItems(def.items);
        if (def.defaultStylePreset) setDefaultPreset(def.defaultStylePreset);
      }
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, [open, projectId]);

  const selectedItem = selectedId ? items.find(i => i.id === selectedId) : null;
  // Hva er synlig på preview-time?
  const visibleNow = items.filter(it =>
    it.enabled
    && previewTime >= it.startTime
    && previewTime < it.startTime + it.duration);

  const addItem = () => {
    const item = newLowerThirdItem(defaultPreset);
    item.startTime = Math.round(previewTime);
    setItems(prev => [...prev, item]);
    setSelectedId(item.id);
  };

  const duplicateItem = (id: string) => {
    const src = items.find(i => i.id === id);
    if (!src) return;
    const copy: LowerThirdItem = {
      ...src,
      id: `lt-${Math.random().toString(36).slice(2, 11)}`,
      startTime: src.startTime + src.duration,
    };
    setItems(prev => [...prev, copy]);
    setSelectedId(copy.id);
  };

  const updateItem = (id: string, patch: Partial<LowerThirdItem>) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it));
  };

  const updateItemStyle = (id: string, patch: Partial<LowerThirdItem["style"]>) => {
    setItems(prev => prev.map(it => it.id === id
      ? { ...it, style: { ...it.style, ...patch } } : it));
  };

  const deleteItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const saveAll = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await lowerThirdsService.save({
        projectId,
        collectionName: "Default",
        items,
        agentKind,
        defaultStylePreset: defaultPreset,
      });
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const exportPngs = async () => {
    setExporting(true);
    setSaveError(null);
    setExportResult(null);
    try {
      const summary = await executeScript("render_lower_thirds", {
        items,
        width: 1920,
        height: 1080,
      }, false);
      const result = summary.events.find(e => e.type === "result");
      const v = result?.value as { outputDir: string;
                                    renderedCount: number; } | undefined;
      if (v) setExportResult(v);
    } catch (err) {
      setSaveError(`Eksport feilet: ${(err as Error).message}`);
    } finally {
      setExporting(false);
    }
  };

  const openExportFolder = async () => {
    if (!exportResult?.outputDir) return;
    try {
      await openPath(exportResult.outputDir);
    } catch (err) {
      console.error("Kunne ikke åpne mappe:", err);
    }
  };

  const applyPreset = (id: string, presetId: StylePresetId) => {
    const preset = STYLE_PRESETS[presetId];
    updateItem(id, {
      style: { ...preset.style },
      animation: preset.animation,
      position: preset.position,
      stylePresetId: presetId,
    });
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 5800,
        background: "rgba(8,4,20,0.92)", backdropFilter: "blur(10px)",
        display: "flex", flexDirection: "column",
        color: ROLE_ROOM_BRAND.textPrimary,
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
      onClick={onClose}
    >
      {/* Header med Role Room brand */}
      <div onClick={e => e.stopPropagation()}
           style={{
             background: ROLE_ROOM_BRAND.surfaceGradient,
             borderBottom: `1px solid rgba(160,48,192,0.20)`,
             padding: "12px 22px",
             display: "flex", alignItems: "center", justifyContent: "space-between",
           }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 6,
            background: ROLE_ROOM_BRAND.signatureGradient,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
          }}>
            <SubtitlesIcon sx={{ fontSize: 18, color: "#fff" }} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700,
                            color: ROLE_ROOM_BRAND.textPrimary }}>
              Lower Thirds Studio
            </div>
            <div style={{ fontSize: 10.5, color: ROLE_ROOM_BRAND.textTertiary,
                            display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{
                width: 8, height: 8, borderRadius: 4,
                background: ROLE_ROOM_BRAND.primaryLila,
              }} />
              Role Room-brandet · {items.length} {items.length === 1 ? "item" : "items"}
            </div>
          </div>
        </div>

        <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => void exportPngs()}
                  disabled={exporting || items.length === 0}
                  title="Render hver lower-third som transparent 1920×1080 PNG for import i DaVinci Resolve"
                  style={{
                    background: exporting
                      ? "rgba(255,255,255,0.05)"
                      : "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(160,48,192,0.40)",
                    color: ROLE_ROOM_BRAND.textPrimary,
                    padding: "7px 12px", fontSize: 11.5, fontWeight: 600,
                    borderRadius: 4,
                    cursor: exporting ? "wait"
                          : items.length === 0 ? "not-allowed" : "pointer",
                    opacity: items.length === 0 ? 0.5 : 1,
                    display: "inline-flex", alignItems: "center", gap: 6,
                  }}>
            <DownloadIcon sx={{ fontSize: 13 }} />
            {exporting ? "Renderer …" : "Eksporter PNG"}
          </button>
          <button onClick={() => void saveAll()}
                  disabled={saving}
                  style={{
                    background: saving
                      ? "rgba(110,63,199,0.20)"
                      : ROLE_ROOM_BRAND.signatureGradient,
                    border: 0, color: "#fff",
                    padding: "7px 14px", fontSize: 12, fontWeight: 600,
                    borderRadius: 4, cursor: saving ? "wait" : "pointer",
                    display: "inline-flex", alignItems: "center", gap: 6,
                  }}>
            <SaveIcon sx={{ fontSize: 13 }} />
            {saving ? "Lagrer …" : "Lagre alle"}
          </button>
          <button onClick={onClose}
                  style={{ background: "transparent", border: 0,
                            color: ROLE_ROOM_BRAND.textSecondary,
                            cursor: "pointer", padding: 4,
                            display: "inline-flex", alignItems: "center" }}>
            <CloseIcon />
          </button>
        </div>
      </div>

      {saveError && (
        <div onClick={e => e.stopPropagation()}
             style={{
               padding: "8px 22px",
               background: "rgba(239,79,111,0.15)",
               color: "#ef4f6f", fontSize: 11,
             }}>{saveError}</div>
      )}
      {exportResult && (
        <div onClick={e => e.stopPropagation()}
             style={{
               padding: "8px 22px",
               background: "rgba(74,212,138,0.10)",
               borderTop: "1px solid rgba(74,212,138,0.20)",
               color: "#4ad48a", fontSize: 11,
               display: "flex", alignItems: "center", gap: 10,
             }}>
          <span>
            Renderet {exportResult.renderedCount} PNG-er →{" "}
            <code style={{ opacity: 0.85 }}>{exportResult.outputDir}</code>
          </span>
          <button onClick={() => void openExportFolder()}
                  style={{
                    background: "rgba(74,212,138,0.18)",
                    border: "1px solid rgba(74,212,138,0.40)",
                    color: "#4ad48a", borderRadius: 3,
                    padding: "3px 10px", fontSize: 10.5,
                    cursor: "pointer",
                    display: "inline-flex", alignItems: "center", gap: 4,
                  }}>
            <FolderOpenIcon sx={{ fontSize: 12 }} /> Åpne mappe
          </button>
        </div>
      )}

      {/* Main area */}
      <div onClick={e => e.stopPropagation()}
           style={{ flex: 1, display: "grid",
                     gridTemplateColumns: "280px 1fr 320px",
                     overflow: "hidden" }}>

        {/* LEFT: items-list + timeline */}
        <div style={{
          background: "rgba(255,255,255,0.02)",
          borderRight: `1px solid rgba(160,48,192,0.18)`,
          padding: 14, overflowY: "auto",
        }}>
          <button onClick={addItem}
                  style={{
                    width: "100%",
                    background: ROLE_ROOM_BRAND.signatureGradient,
                    border: 0, color: "#fff",
                    padding: "8px 12px", fontSize: 12, fontWeight: 600,
                    borderRadius: 4, cursor: "pointer", marginBottom: 12,
                    display: "inline-flex", alignItems: "center",
                    justifyContent: "center", gap: 6,
                  }}>
            <AddIcon sx={{ fontSize: 14 }} />
            Nytt item
          </button>

          <div style={{ fontSize: 10, fontWeight: 700,
                          color: ROLE_ROOM_BRAND.textTertiary, marginBottom: 6,
                          letterSpacing: 0.5 }}>
            ITEMS
          </div>
          {!loaded && (
            <div style={{ fontSize: 11, color: ROLE_ROOM_BRAND.textTertiary,
                            textAlign: "center", padding: 20 }}>Laster …</div>
          )}
          {loaded && items.length === 0 && (
            <div style={{ fontSize: 11, color: ROLE_ROOM_BRAND.textTertiary,
                            textAlign: "center", padding: 16, lineHeight: 1.5 }}>
              Ingen items. Klikk "Nytt item" for å starte.
            </div>
          )}
          {items.map(item => (
            <div key={item.id}
                 onClick={() => setSelectedId(item.id)}
                 style={{
                   padding: 8, borderRadius: 4, marginBottom: 4,
                   background: selectedId === item.id
                     ? "rgba(160,48,192,0.18)"
                     : "rgba(255,255,255,0.03)",
                   border: selectedId === item.id
                     ? `1px solid ${ROLE_ROOM_BRAND.primaryLila}40`
                     : "1px solid transparent",
                   cursor: "pointer",
                 }}>
              <div style={{ display: "flex", alignItems: "center",
                              justifyContent: "space-between", gap: 4 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600,
                                  color: item.enabled
                                    ? ROLE_ROOM_BRAND.textPrimary
                                    : ROLE_ROOM_BRAND.textTertiary,
                                  overflow: "hidden", textOverflow: "ellipsis",
                                  whiteSpace: "nowrap" }}>
                    {item.title || "(uten tittel)"}
                  </div>
                  <div style={{ fontSize: 9.5, color: ROLE_ROOM_BRAND.textTertiary }}>
                    {formatTime(item.startTime)} → {formatTime(item.startTime + item.duration)}
                  </div>
                </div>
                <button onClick={e => { e.stopPropagation();
                                       updateItem(item.id, { enabled: !item.enabled }); }}
                        title={item.enabled ? "Skjul" : "Vis"}
                        style={miniBtn}>
                  {item.enabled
                    ? <VisibilityIcon sx={{ fontSize: 12 }} />
                    : <VisibilityOffIcon sx={{ fontSize: 12 }} />}
                </button>
                <button onClick={e => { e.stopPropagation(); duplicateItem(item.id); }}
                        title="Dupliser"
                        style={miniBtn}>
                  <ContentCopyIcon sx={{ fontSize: 12 }} />
                </button>
                <button onClick={e => { e.stopPropagation(); deleteItem(item.id); }}
                        title="Slett"
                        style={{ ...miniBtn, color: "#ef4f6f" }}>
                  <DeleteOutlineIcon sx={{ fontSize: 12 }} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* CENTER: preview + timeline */}
        <div style={{
          background: ROLE_ROOM_BRAND.deepNavy,
          padding: 24,
          display: "flex", flexDirection: "column", gap: 16,
        }}>
          <div style={{ display: "flex", alignItems: "center",
                          justifyContent: "space-between",
                          fontSize: 11, color: ROLE_ROOM_BRAND.textSecondary }}>
            <span>Preview ved {formatTime(previewTime)}</span>
            <span>Video-varighet: {formatTime(videoDurationSec)}</span>
          </div>

          {/* Preview video-flate (16:9) */}
          <div style={{
            position: "relative",
            aspectRatio: "16/9",
            maxHeight: "60vh",
            background: "linear-gradient(135deg, #1a0d2e, #0a0518)",
            border: `1px solid rgba(160,48,192,0.20)`,
            borderRadius: 6, overflow: "hidden",
            margin: "0 auto",
            width: "100%",
            containerType: "size",
          } as React.CSSProperties}>
            {/* Sjakk-mønster for å indikere video-flate */}
            <div style={{
              position: "absolute", inset: 0,
              background: "repeating-linear-gradient(45deg, "
                + "rgba(160,48,192,0.04) 0 20px, "
                + "transparent 20px 40px)",
            }} />
            {/* Tittel-overlay i sentrum så det er klart at dette er placeholder */}
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "rgba(255,255,255,0.08)", fontSize: 24, fontWeight: 700,
            }}>
              VIDEO PREVIEW
            </div>

            {/* Visible lower-thirds */}
            {visibleNow.map(it => (
              <LowerThirdRenderer key={it.id} item={it} />
            ))}
          </div>

          {/* Timeline-scrubber */}
          <div>
            <div style={{ position: "relative", height: 32 }}>
              {/* Item-bars */}
              {items.map(it => {
                const leftPct = (it.startTime / videoDurationSec) * 100;
                const widthPct = (it.duration / videoDurationSec) * 100;
                return (
                  <div key={it.id}
                       onClick={() => setSelectedId(it.id)}
                       title={`${it.title} (${formatTime(it.startTime)} - ${formatTime(it.startTime + it.duration)})`}
                       style={{
                         position: "absolute",
                         left: `${leftPct}%`,
                         width: `${widthPct}%`,
                         top: 6, height: 16,
                         background: selectedId === it.id
                           ? ROLE_ROOM_BRAND.signatureGradient
                           : it.enabled
                             ? "rgba(160,48,192,0.45)"
                             : "rgba(160,48,192,0.18)",
                         borderRadius: 3, cursor: "pointer",
                         fontSize: 9, color: "#fff",
                         padding: "0 4px",
                         overflow: "hidden", whiteSpace: "nowrap",
                         textOverflow: "ellipsis",
                         display: "flex", alignItems: "center",
                       }}>
                    {it.title}
                  </div>
                );
              })}
            </div>
            <input type="range" min={0} max={videoDurationSec} step={0.5}
                   value={previewTime}
                   onChange={e => setPreviewTime(parseFloat(e.target.value))}
                   style={{ width: "100%", accentColor: ROLE_ROOM_BRAND.primaryLila }} />
          </div>

          {/* Default preset-velger */}
          <div style={{
            padding: 10, borderRadius: 6,
            background: "rgba(255,255,255,0.02)",
            border: `1px solid rgba(160,48,192,0.15)`,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700,
                            color: ROLE_ROOM_BRAND.textTertiary, marginBottom: 6,
                            letterSpacing: 0.5 }}>
              DEFAULT STYLE-PRESET FOR NYE ITEMS
            </div>
            <div style={{ display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
                            gap: 6 }}>
              {(Object.keys(STYLE_PRESETS) as StylePresetId[]).map(pid => (
                <button key={pid}
                        onClick={() => setDefaultPreset(pid)}
                        title={STYLE_PRESETS[pid].description}
                        style={{
                          background: defaultPreset === pid
                            ? ROLE_ROOM_BRAND.signatureGradient
                            : "rgba(255,255,255,0.04)",
                          border: defaultPreset === pid
                            ? "1px solid rgba(160,48,192,0.50)"
                            : "1px solid rgba(255,255,255,0.08)",
                          color: defaultPreset === pid ? "#fff"
                            : ROLE_ROOM_BRAND.textPrimary,
                          padding: "5px 8px", borderRadius: 4,
                          fontSize: 10.5, cursor: "pointer",
                          textAlign: "left",
                        }}>
                  {STYLE_PRESETS[pid].label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: edit-panel */}
        <div style={{
          background: "rgba(255,255,255,0.02)",
          borderLeft: `1px solid rgba(160,48,192,0.18)`,
          padding: 16, overflowY: "auto",
        }}>
          {!selectedItem && (
            <div style={{ fontSize: 11, color: ROLE_ROOM_BRAND.textTertiary,
                            textAlign: "center", padding: 30, lineHeight: 1.6 }}>
              Velg et item fra venstre kolonne for å redigere.
            </div>
          )}
          {selectedItem && (
            <ItemEditPanel
              item={selectedItem}
              onChange={(patch) => updateItem(selectedItem.id, patch)}
              onChangeStyle={(p) => updateItemStyle(selectedItem.id, p)}
              onApplyPreset={(pid) => applyPreset(selectedItem.id, pid)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function LowerThirdRenderer({ item }: { item: LowerThirdItem }) {
  // Posisjon-baserte CSS-koordinater i prosent
  const pos = getPositionStyle(item.position);
  return (
    <div style={{
      position: "absolute",
      ...pos,
      width: `${item.style.widthPercent}%`,
      background: item.style.background,
      color: item.style.text,
      opacity: item.style.opacity,
      borderRadius: item.style.borderRadius,
      padding: item.style.padding,
      borderLeft: item.style.accentBarWidth > 0
        ? `${item.style.accentBarWidth}px solid ${item.style.accent}`
        : undefined,
      animation: `lt-${item.animation} ${item.animationDuration}s ease-out`,
    }}>
      <div style={{
        fontSize: `${item.style.fontSize}px`,
        fontWeight: 700, lineHeight: 1.15,
      }}>
        {item.title}
      </div>
      {item.subtitle && (
        <div style={{
          fontSize: `${item.style.subtitleFontSize}px`,
          marginTop: 4, color: item.style.accent,
          fontWeight: 500,
        }}>
          {item.subtitle}
        </div>
      )}
    </div>
  );
}

function ItemEditPanel({ item, onChange, onChangeStyle, onApplyPreset }: {
  item: LowerThirdItem;
  onChange: (patch: Partial<LowerThirdItem>) => void;
  onChangeStyle: (patch: Partial<LowerThirdItem["style"]>) => void;
  onApplyPreset: (presetId: StylePresetId) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <div style={SECTION_TITLE}>INNHOLD</div>
        <input value={item.title}
               onChange={e => onChange({ title: e.target.value })}
               placeholder="Tittel (taler-navn)"
               style={INPUT_SX} />
        <input value={item.subtitle}
               onChange={e => onChange({ subtitle: e.target.value })}
               placeholder="Subtittel (rolle, firma)"
               style={{ ...INPUT_SX, marginTop: 6 }} />
      </div>

      <div>
        <div style={SECTION_TITLE}>TIMING (SEK)</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          <div>
            <label style={LABEL_SX}>Start</label>
            <input type="number" min={0} step={0.5}
                   value={item.startTime}
                   onChange={e => onChange({ startTime: parseFloat(e.target.value) || 0 })}
                   style={INPUT_SX} />
          </div>
          <div>
            <label style={LABEL_SX}>Varighet</label>
            <input type="number" min={1} step={0.5}
                   value={item.duration}
                   onChange={e => onChange({ duration: parseFloat(e.target.value) || 1 })}
                   style={INPUT_SX} />
          </div>
        </div>
      </div>

      <div>
        <div style={SECTION_TITLE}>POSISJON</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
          {(Object.keys(POSITION_LABELS) as LowerThirdPosition[]).slice(0, 6).map(p => (
            <button key={p}
                    onClick={() => onChange({ position: p })}
                    style={{
                      background: item.position === p
                        ? ROLE_ROOM_BRAND.signatureGradient
                        : "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: item.position === p ? "#fff"
                        : ROLE_ROOM_BRAND.textPrimary,
                      padding: "4px 6px", borderRadius: 3,
                      fontSize: 9.5, cursor: "pointer",
                    }}>
              {POSITION_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div style={SECTION_TITLE}>ANIMASJON</div>
        <select value={item.animation}
                onChange={e => onChange({ animation: e.target.value as LowerThirdAnimation })}
                style={INPUT_SX}>
          {(Object.keys(ANIMATION_LABELS) as LowerThirdAnimation[]).map(a => (
            <option key={a} value={a}>{ANIMATION_LABELS[a]}</option>
          ))}
        </select>
        <div style={{ display: "flex", alignItems: "center",
                        gap: 6, marginTop: 6, fontSize: 10.5,
                        color: ROLE_ROOM_BRAND.textSecondary }}>
          <span style={{ minWidth: 50 }}>Varighet</span>
          <input type="range" min={0.1} max={2} step={0.1}
                 value={item.animationDuration}
                 onChange={e => onChange({ animationDuration: parseFloat(e.target.value) })}
                 style={{ flex: 1, accentColor: ROLE_ROOM_BRAND.primaryLila }} />
          <span>{item.animationDuration.toFixed(1)}s</span>
        </div>
      </div>

      <div>
        <div style={SECTION_TITLE}>STYLE-PRESET</div>
        <div style={{ display: "grid",
                        gridTemplateColumns: "1fr 1fr", gap: 4 }}>
          {(Object.keys(STYLE_PRESETS) as StylePresetId[]).map(pid => (
            <button key={pid}
                    onClick={() => onApplyPreset(pid)}
                    title={STYLE_PRESETS[pid].description}
                    style={{
                      background: item.stylePresetId === pid
                        ? ROLE_ROOM_BRAND.signatureGradient
                        : "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: item.stylePresetId === pid ? "#fff"
                        : ROLE_ROOM_BRAND.textPrimary,
                      padding: "5px 6px", borderRadius: 3,
                      fontSize: 9.5, cursor: "pointer",
                      textAlign: "left",
                    }}>
              {STYLE_PRESETS[pid].label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div style={SECTION_TITLE}>FARGER</div>
        <ColorRow label="Bakgrunn" value={item.style.background}
                  onChange={v => onChangeStyle({ background: v })} />
        <ColorRow label="Tekst" value={item.style.text}
                  onChange={v => onChangeStyle({ text: v })} />
        <ColorRow label="Accent" value={item.style.accent}
                  onChange={v => onChangeStyle({ accent: v })} />
      </div>

      <div>
        <div style={SECTION_TITLE}>STØRRELSE</div>
        <RangeRow label="Bredde %" min={20} max={70} step={1}
                  value={item.style.widthPercent}
                  onChange={v => onChangeStyle({ widthPercent: v })} />
        <RangeRow label="Font px" min={14} max={48} step={1}
                  value={item.style.fontSize}
                  onChange={v => onChangeStyle({ fontSize: v })} />
        <RangeRow label="Sub px" min={10} max={24} step={1}
                  value={item.style.subtitleFontSize}
                  onChange={v => onChangeStyle({ subtitleFontSize: v })} />
        <RangeRow label="Padding" min={0} max={40} step={1}
                  value={item.style.padding}
                  onChange={v => onChangeStyle({ padding: v })} />
        <RangeRow label="Radius" min={0} max={20} step={1}
                  value={item.style.borderRadius}
                  onChange={v => onChangeStyle({ borderRadius: v })} />
      </div>
    </div>
  );
}

function ColorRow({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  // For gradient-bakgrunner: vis tekst-input. For hex: color-picker.
  const isGradient = typeof value === "string" && value.includes("gradient");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
      {!isGradient && (
        <input type="color" value={value.startsWith("#") ? value : "#000000"}
               onChange={e => onChange(e.target.value)}
               style={{ width: 24, height: 24, border: 0, borderRadius: 3,
                         cursor: "pointer", padding: 0, background: "transparent" }} />
      )}
      {isGradient && (
        <div style={{ width: 24, height: 24, borderRadius: 3,
                        background: value, border: "1px solid rgba(255,255,255,0.1)" }} />
      )}
      <span style={{ fontSize: 10.5, color: ROLE_ROOM_BRAND.textSecondary,
                       minWidth: 50 }}>{label}</span>
      <input value={value}
             onChange={e => onChange(e.target.value)}
             style={{ ...INPUT_SX, flex: 1, fontSize: 9 }} />
    </div>
  );
}

function RangeRow({ label, min, max, step, value, onChange }: {
  label: string; min: number; max: number; step: number;
  value: number; onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center",
                    gap: 6, marginBottom: 4, fontSize: 10.5,
                    color: ROLE_ROOM_BRAND.textSecondary }}>
      <span style={{ minWidth: 60 }}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
             onChange={e => onChange(parseFloat(e.target.value))}
             style={{ flex: 1, accentColor: ROLE_ROOM_BRAND.primaryLila }} />
      <span style={{ minWidth: 28, textAlign: "right" }}>{value}</span>
    </div>
  );
}

function getPositionStyle(p: LowerThirdPosition): React.CSSProperties {
  const margin = "5%";
  switch (p) {
    case "bottom-left":   return { bottom: margin, left: margin };
    case "bottom-center": return { bottom: margin, left: "50%", transform: "translateX(-50%)" };
    case "bottom-right":  return { bottom: margin, right: margin };
    case "top-left":      return { top: margin, left: margin };
    case "top-center":    return { top: margin, left: "50%", transform: "translateX(-50%)" };
    case "top-right":     return { top: margin, right: margin };
    case "left-center":   return { top: "50%", left: margin, transform: "translateY(-50%)" };
    case "right-center":  return { top: "50%", right: margin, transform: "translateY(-50%)" };
  }
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

const miniBtn: React.CSSProperties = {
  background: "transparent", border: 0,
  color: ROLE_ROOM_BRAND.textSecondary, cursor: "pointer",
  padding: 2, borderRadius: 2,
  display: "inline-flex", alignItems: "center",
};

const INPUT_SX: React.CSSProperties = {
  display: "block", width: "100%",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(160,48,192,0.18)",
  borderRadius: 3, padding: "5px 8px",
  color: ROLE_ROOM_BRAND.textPrimary, fontSize: 11,
};

const SECTION_TITLE: React.CSSProperties = {
  fontSize: 10, fontWeight: 700,
  color: ROLE_ROOM_BRAND.textTertiary,
  marginBottom: 5, letterSpacing: 0.5,
};

const LABEL_SX: React.CSSProperties = {
  display: "block", fontSize: 9.5,
  color: ROLE_ROOM_BRAND.textTertiary, marginBottom: 2,
};

export default LowerThirdsStudio;
