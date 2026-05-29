/**
 * CaptionStudio — Role Room-brandet caption-editor med Whisper-
 * transkripsjon, segment-redigering, style-presets og SRT/VTT-eksport.
 *
 * Workflow:
 *  1. Bjarne åpner Studio fra agent-editor header
 *  2. Klikk "Transcribe" → Whisper kjøres på sourcePath
 *  3. Segments rendres i venstre kolonne med klikkbar timestamp
 *  4. Klikk på segment → preview hopper til den tiden, edit-panel
 *     viser tekst + style-controls
 *  5. Eksporter SRT (universal), VTT (web) eller burnt-in (via ffmpeg)
 */

import { useEffect, useState } from "react";
import CloseIcon from "@mui/icons-material/Close";
import SaveIcon from "@mui/icons-material/Save";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import DownloadIcon from "@mui/icons-material/Download";
import SubtitlesIcon from "@mui/icons-material/Subtitles";
import { save as saveFileDialog } from "@tauri-apps/plugin-dialog";
import { executeScript } from "../api";
import { captionsService } from "../services/captionsService";
import {
  CAPTION_STYLE_PRESETS, DEFAULT_CAPTION_STYLE, POSITION_LABELS,
  findActiveSegment, transcriptToSrt, transcriptToVtt,
} from "../lib/captionTypes";
import type {
  CaptionStyle, CaptionStylePresetId, CaptionPosition,
  WhisperTranscript, WhisperSegment,
} from "../lib/captionTypes";
import { ROLE_ROOM_BRAND } from "../lib/lowerThirdTypes";

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  sourceVideoPath: string;
  videoDurationSec?: number;
  /** Callback når transcript er hentet — brukes til å mate Director-chat. */
  onTranscriptLoaded?: (transcript: WhisperTranscript) => void;
}

export function CaptionStudio({
  open, onClose, projectId, sourceVideoPath, videoDurationSec = 300,
  onTranscriptLoaded,
}: Props) {
  const [transcript, setTranscript] = useState<WhisperTranscript | null>(null);
  const [style, setStyle] = useState<CaptionStyle>(DEFAULT_CAPTION_STYLE);
  const [stylePresetId, setStylePresetId] = useState<CaptionStylePresetId>("role-room-default");
  const [whisperModel, setWhisperModel] = useState<string>("base");
  const [transcribing, setTranscribing] = useState(false);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const [previewTime, setPreviewTime] = useState(0);
  const [selectedSegmentId, setSelectedSegmentId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Load saved transcript ved open
  useEffect(() => {
    if (!open || !projectId) return;
    captionsService.get(projectId).then(col => {
      if (col?.transcript?.segments) {
        setTranscript(col.transcript);
        if (col.style && Object.keys(col.style).length > 0) {
          setStyle({ ...DEFAULT_CAPTION_STYLE, ...col.style });
        }
        if (col.stylePresetId) setStylePresetId(col.stylePresetId);
        if (col.whisperModel) setWhisperModel(col.whisperModel);
        onTranscriptLoaded?.(col.transcript);
      }
    }).catch(() => {});
  }, [open, projectId, onTranscriptLoaded]);

  const transcribe = async () => {
    if (!sourceVideoPath) {
      setTranscribeError("Mangler source-video — velg en når du åpner agent");
      return;
    }
    setTranscribing(true);
    setTranscribeError(null);
    try {
      const summary = await executeScript("transcribe_whisper", {
        audioPath: sourceVideoPath,
        model: whisperModel,
        language: "auto",
        wordTimestamps: true,
      }, false);
      const result = summary.events.find(e => e.type === "result");
      const v = result?.value as WhisperTranscript | undefined;
      if (!v?.segments) throw new Error("Ingen transcript-output");
      setTranscript(v);
      onTranscriptLoaded?.(v);
    } catch (err) {
      setTranscribeError((err as Error).message);
    } finally {
      setTranscribing(false);
    }
  };

  const applyPreset = (pid: CaptionStylePresetId) => {
    setStylePresetId(pid);
    setStyle({ ...CAPTION_STYLE_PRESETS[pid].style });
  };

  const updateStyle = (patch: Partial<CaptionStyle>) => {
    setStyle(prev => ({ ...prev, ...patch }));
    setStylePresetId("role-room-default"); // mark som custom-edited
  };

  const updateSegmentText = (id: number, text: string) => {
    if (!transcript) return;
    setTranscript({
      ...transcript,
      segments: transcript.segments.map(s => s.id === id ? { ...s, text } : s),
    });
  };

  const saveAll = async () => {
    if (!transcript) return;
    setSaving(true);
    try {
      await captionsService.save({
        projectId,
        sourceVideoPath,
        transcript,
        style,
        stylePresetId,
        whisperModel,
        language: transcript.language,
      });
    } catch (err) {
      setTranscribeError(`Lagring feilet: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const exportFile = async (kind: "srt" | "vtt") => {
    if (!transcript) return;
    setExporting(true);
    try {
      const content = kind === "srt"
        ? transcriptToSrt(transcript)
        : transcriptToVtt(transcript);
      const defaultName = `captions.${kind}`;
      const path = await saveFileDialog({
        defaultPath: defaultName,
        filters: [{ name: kind.toUpperCase(),
                     extensions: [kind] }],
      });
      if (path && typeof path === "string") {
        await executeScript("write_text_to_file", {
          content, outputPath: path,
        }, false);
      }
    } catch (err) {
      setTranscribeError(`Eksport feilet: ${(err as Error).message}`);
    } finally {
      setExporting(false);
    }
  };

  const activeSegment = transcript
    ? findActiveSegment(transcript, previewTime, style.trailingHoldSec)
    : null;
  const selectedSegment = selectedSegmentId != null && transcript
    ? transcript.segments.find(s => s.id === selectedSegmentId) ?? null
    : null;

  if (!open) return null;

  return (
    <div onClick={onClose}
         style={{
           position: "fixed", inset: 0, zIndex: 5800,
           background: "rgba(8,4,20,0.92)", backdropFilter: "blur(10px)",
           display: "flex", flexDirection: "column",
           color: ROLE_ROOM_BRAND.textPrimary,
         }}>

      {/* Header */}
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
            <div style={{ fontSize: 15, fontWeight: 700 }}>
              Caption Studio
            </div>
            <div style={{ fontSize: 10.5, color: ROLE_ROOM_BRAND.textTertiary,
                            display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{
                width: 8, height: 8, borderRadius: 4,
                background: ROLE_ROOM_BRAND.primaryLila,
              }} />
              Role Room-brandet · Whisper-drevet
              {transcript && ` · ${transcript.segments.length} segments · ${transcript.language}`}
            </div>
          </div>
        </div>

        <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          {transcript && (
            <>
              <button onClick={() => void exportFile("srt")}
                      disabled={exporting}
                      title="Eksporter SRT (universal subtitle-format)"
                      style={buttonSecondary}>
                <DownloadIcon sx={{ fontSize: 13 }} /> SRT
              </button>
              <button onClick={() => void exportFile("vtt")}
                      disabled={exporting}
                      title="Eksporter VTT (web-native)"
                      style={buttonSecondary}>
                <DownloadIcon sx={{ fontSize: 13 }} /> VTT
              </button>
            </>
          )}
          <button onClick={() => void saveAll()}
                  disabled={saving || !transcript}
                  style={{
                    background: saving
                      ? "rgba(110,63,199,0.20)"
                      : ROLE_ROOM_BRAND.signatureGradient,
                    border: 0, color: "#fff",
                    padding: "7px 14px", fontSize: 12, fontWeight: 600,
                    borderRadius: 4,
                    cursor: saving ? "wait" : transcript ? "pointer" : "not-allowed",
                    opacity: !transcript ? 0.4 : 1,
                    display: "inline-flex", alignItems: "center", gap: 6,
                  }}>
            <SaveIcon sx={{ fontSize: 13 }} />
            {saving ? "Lagrer …" : "Lagre"}
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

      {transcribeError && (
        <div onClick={e => e.stopPropagation()}
             style={{
               padding: "8px 22px",
               background: "rgba(239,79,111,0.15)",
               color: "#ef4f6f", fontSize: 11,
             }}>{transcribeError}</div>
      )}

      {/* Main 3-col area */}
      <div onClick={e => e.stopPropagation()}
           style={{ flex: 1, display: "grid",
                     gridTemplateColumns: "320px 1fr 300px",
                     overflow: "hidden" }}>

        {/* LEFT: transcript-list */}
        <div style={{
          background: "rgba(255,255,255,0.02)",
          borderRight: `1px solid rgba(160,48,192,0.18)`,
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}>
          <div style={{ padding: 14, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            {!transcript && (
              <>
                <div style={{ fontSize: 10.5, color: ROLE_ROOM_BRAND.textTertiary,
                                marginBottom: 8, lineHeight: 1.5 }}>
                  Velg Whisper-model: større = mer nøyaktig men tregere
                </div>
                <select value={whisperModel}
                        onChange={e => setWhisperModel(e.target.value)}
                        style={{ ...inputSx, marginBottom: 8 }}>
                  <option value="tiny">tiny (raskest, ok kvalitet)</option>
                  <option value="base">base (anbefalt — balansert)</option>
                  <option value="small">small (bedre kvalitet)</option>
                  <option value="medium">medium (presist, tregere)</option>
                  <option value="large-v3">large-v3 (beste, krever GPU)</option>
                </select>
              </>
            )}
            <button onClick={() => void transcribe()}
                    disabled={transcribing || !sourceVideoPath}
                    style={{
                      width: "100%",
                      background: transcribing
                        ? "rgba(110,63,199,0.20)"
                        : ROLE_ROOM_BRAND.signatureGradient,
                      border: 0, color: "#fff",
                      padding: "9px 12px", fontSize: 12, fontWeight: 600,
                      borderRadius: 4,
                      cursor: transcribing ? "wait"
                            : sourceVideoPath ? "pointer" : "not-allowed",
                      opacity: !sourceVideoPath ? 0.5 : 1,
                      display: "inline-flex", alignItems: "center",
                      justifyContent: "center", gap: 6,
                    }}>
              <AutoFixHighIcon sx={{ fontSize: 14 }} />
              {transcribing ? "Transcriberer …"
                : transcript ? "Re-transcribe" : "Transcribe"}
            </button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: 10 }}>
            {!transcript && !transcribing && (
              <div style={{ textAlign: "center", padding: 30, fontSize: 11,
                              color: ROLE_ROOM_BRAND.textTertiary, lineHeight: 1.6 }}>
                Ingen transkript enda. Klikk "Transcribe" for å starte.
                {!sourceVideoPath && (
                  <div style={{ marginTop: 8, color: "#f0a500" }}>
                    Source-video ikke satt
                  </div>
                )}
              </div>
            )}
            {transcript?.segments.map(seg => {
              const isActive = activeSegment?.id === seg.id;
              const isSelected = selectedSegmentId === seg.id;
              return (
                <div key={seg.id}
                     onClick={() => {
                       setSelectedSegmentId(seg.id);
                       setPreviewTime(seg.start);
                     }}
                     style={{
                       padding: "6px 8px", marginBottom: 3,
                       borderRadius: 3, cursor: "pointer",
                       background: isSelected
                         ? "rgba(160,48,192,0.20)"
                         : isActive
                           ? "rgba(160,48,192,0.10)"
                           : "transparent",
                       border: isActive
                         ? `1px solid ${ROLE_ROOM_BRAND.primaryLila}55`
                         : "1px solid transparent",
                     }}>
                  <div style={{ fontSize: 9.5, color: ROLE_ROOM_BRAND.textTertiary,
                                  marginBottom: 2 }}>
                    {formatTime(seg.start)} → {formatTime(seg.end)}
                  </div>
                  <div style={{ fontSize: 11.5, lineHeight: 1.4,
                                  color: ROLE_ROOM_BRAND.textPrimary }}>
                    {seg.text}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CENTER: preview + timeline */}
        <div style={{
          background: ROLE_ROOM_BRAND.deepNavy,
          padding: 24, display: "flex", flexDirection: "column", gap: 16,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between",
                          fontSize: 11, color: ROLE_ROOM_BRAND.textSecondary }}>
            <span>Preview @ {formatTime(previewTime)}</span>
            <span>{transcript ? `${formatTime(transcript.durationSec)} totalt` : `${formatTime(videoDurationSec)}`}</span>
          </div>

          {/* 16:9 preview-flate */}
          <div style={{
            position: "relative",
            aspectRatio: "16/9", maxHeight: "60vh",
            background: "linear-gradient(135deg, #1a0d2e, #0a0518)",
            border: `1px solid rgba(160,48,192,0.20)`,
            borderRadius: 6, overflow: "hidden",
            margin: "0 auto", width: "100%",
            containerType: "size",
          } as React.CSSProperties}>
            {/* Sjakk-mønster */}
            <div style={{
              position: "absolute", inset: 0,
              background: "repeating-linear-gradient(45deg, "
                + "rgba(160,48,192,0.04) 0 20px, transparent 20px 40px)",
            }} />
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "rgba(255,255,255,0.08)", fontSize: 24, fontWeight: 700,
            }}>VIDEO PREVIEW</div>

            {/* Active caption-overlay */}
            {activeSegment && (
              <CaptionRenderer segment={activeSegment} style={style} />
            )}
          </div>

          {/* Timeline-scrubber + segment-bars */}
          {transcript && (
            <div>
              <div style={{ position: "relative", height: 26,
                              background: "rgba(0,0,0,0.4)", borderRadius: 3,
                              overflow: "hidden" }}>
                {transcript.segments.map(s => {
                  const leftPct = (s.start / transcript.durationSec) * 100;
                  const widthPct = ((s.end - s.start) / transcript.durationSec) * 100;
                  return (
                    <div key={s.id}
                         onClick={() => {
                           setSelectedSegmentId(s.id);
                           setPreviewTime(s.start);
                         }}
                         title={s.text}
                         style={{
                           position: "absolute",
                           left: `${leftPct}%`, width: `${widthPct}%`,
                           top: 3, height: 20,
                           background: selectedSegmentId === s.id
                             ? ROLE_ROOM_BRAND.signatureGradient
                             : "rgba(160,48,192,0.40)",
                           borderRadius: 2, cursor: "pointer",
                         }} />
                  );
                })}
              </div>
              <input type="range" min={0} max={transcript.durationSec}
                     step={0.1} value={previewTime}
                     onChange={e => setPreviewTime(parseFloat(e.target.value))}
                     style={{ width: "100%", marginTop: 4,
                                accentColor: ROLE_ROOM_BRAND.primaryLila }} />
            </div>
          )}

          {/* Style-preset velger */}
          <div style={{
            padding: 10, borderRadius: 6,
            background: "rgba(255,255,255,0.02)",
            border: `1px solid rgba(160,48,192,0.15)`,
          }}>
            <div style={sectionTitle}>STYLE-PRESET</div>
            <div style={{ display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
                            gap: 6 }}>
              {(Object.keys(CAPTION_STYLE_PRESETS) as CaptionStylePresetId[]).map(pid => (
                <button key={pid}
                        onClick={() => applyPreset(pid)}
                        title={CAPTION_STYLE_PRESETS[pid].description}
                        style={{
                          background: stylePresetId === pid
                            ? ROLE_ROOM_BRAND.signatureGradient
                            : "rgba(255,255,255,0.04)",
                          border: stylePresetId === pid
                            ? "1px solid rgba(160,48,192,0.50)"
                            : "1px solid rgba(255,255,255,0.08)",
                          color: stylePresetId === pid ? "#fff"
                            : ROLE_ROOM_BRAND.textPrimary,
                          padding: "5px 8px", borderRadius: 3,
                          fontSize: 10.5, cursor: "pointer", textAlign: "left",
                        }}>
                  {CAPTION_STYLE_PRESETS[pid].label}
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
          {selectedSegment && (
            <div style={{ marginBottom: 14 }}>
              <div style={sectionTitle}>SEGMENT-TEKST</div>
              <textarea value={selectedSegment.text}
                        onChange={e => updateSegmentText(selectedSegment.id, e.target.value)}
                        rows={3}
                        style={{ ...inputSx, resize: "vertical", minHeight: 60 }} />
              <div style={{ fontSize: 9.5, color: ROLE_ROOM_BRAND.textTertiary,
                              marginTop: 4 }}>
                {formatTime(selectedSegment.start)} → {formatTime(selectedSegment.end)}
                {selectedSegment.words && ` · ${selectedSegment.words.length} ord`}
              </div>
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <div style={sectionTitle}>POSISJON</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr",
                            gap: 4 }}>
              {(Object.keys(POSITION_LABELS) as CaptionPosition[]).map(p => (
                <button key={p}
                        onClick={() => updateStyle({ position: p })}
                        style={{
                          background: style.position === p
                            ? ROLE_ROOM_BRAND.signatureGradient
                            : "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.08)",
                          color: style.position === p ? "#fff"
                            : ROLE_ROOM_BRAND.textPrimary,
                          padding: "4px 6px", borderRadius: 3,
                          fontSize: 10, cursor: "pointer",
                        }}>
                  {POSITION_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={sectionTitle}>FONT</div>
            <RangeRow label="Size px" min={16} max={72} step={1}
                      value={style.fontSize}
                      onChange={v => updateStyle({ fontSize: v })} />
            <RangeRow label="Weight" min={400} max={900} step={100}
                      value={style.fontWeight}
                      onChange={v => updateStyle({ fontWeight: v as 400 | 600 | 700 | 900 })} />
            <RangeRow label="Letter-sp" min={-2} max={6} step={0.25}
                      value={style.letterSpacing}
                      onChange={v => updateStyle({ letterSpacing: v })} />
            <RangeRow label="Max-lines" min={1} max={3} step={1}
                      value={style.maxLines}
                      onChange={v => updateStyle({ maxLines: v })} />
            <RangeRow label="Width %" min={20} max={95} step={1}
                      value={style.maxLineWidthPct}
                      onChange={v => updateStyle({ maxLineWidthPct: v })} />
            <label style={{ display: "flex", alignItems: "center", gap: 6,
                              fontSize: 10.5, color: ROLE_ROOM_BRAND.textSecondary,
                              marginTop: 6, cursor: "pointer" }}>
              <input type="checkbox" checked={style.uppercase}
                     onChange={e => updateStyle({ uppercase: e.target.checked })} />
              UPPERCASE
            </label>
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={sectionTitle}>FARGER</div>
            <ColorRow label="Tekst" value={style.color}
                      onChange={v => updateStyle({ color: v })} />
            <ColorRow label="Bakgrunn" value={style.backgroundColor}
                      onChange={v => updateStyle({ backgroundColor: v })} />
            <ColorRow label="Stroke" value={style.strokeColor}
                      onChange={v => updateStyle({ strokeColor: v })} />
            <RangeRow label="Stroke-w" min={0} max={6} step={0.5}
                      value={style.strokeWidth}
                      onChange={v => updateStyle({ strokeWidth: v })} />
            <RangeRow label="Padding" min={0} max={40} step={1}
                      value={style.padding}
                      onChange={v => updateStyle({ padding: v })} />
            <RangeRow label="Radius" min={0} max={20} step={1}
                      value={style.borderRadius}
                      onChange={v => updateStyle({ borderRadius: v })} />
          </div>
        </div>
      </div>
    </div>
  );
}

function CaptionRenderer({ segment, style }: {
  segment: WhisperSegment; style: CaptionStyle;
}) {
  const posSx: React.CSSProperties = (() => {
    switch (style.position) {
      case "bottom-center":
        return { bottom: "8%", left: "50%", transform: "translateX(-50%)" };
      case "bottom-left":   return { bottom: "8%", left: "5%" };
      case "bottom-right":  return { bottom: "8%", right: "5%" };
      case "top-center":
        return { top: "8%", left: "50%", transform: "translateX(-50%)" };
      case "middle":
        return { top: "50%", left: "50%",
                  transform: "translate(-50%, -50%)" };
    }
  })();
  const displayText = style.uppercase ? segment.text.toUpperCase() : segment.text;
  // Skaler font basert på container (16:9 preview er ~800px bred)
  const cqwScale = style.fontSize / 1920 * 100;
  return (
    <div style={{
      position: "absolute",
      ...posSx,
      maxWidth: `${style.maxLineWidthPct}%`,
      background: style.backgroundColor,
      color: style.color,
      fontFamily: style.fontFamily,
      fontSize: `${cqwScale}cqw`,
      fontWeight: style.fontWeight,
      letterSpacing: style.letterSpacing,
      padding: style.padding,
      borderRadius: style.borderRadius,
      textAlign: "center",
      WebkitTextStroke: style.strokeWidth > 0
        ? `${style.strokeWidth}px ${style.strokeColor}` : undefined,
      textShadow: style.strokeWidth === 0
        ? "0 1px 4px rgba(0,0,0,0.55)" : undefined,
      lineHeight: 1.25,
      pointerEvents: "none",
    }}>
      {displayText}
    </div>
  );
}

function ColorRow({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
      <input type="color"
             value={value.startsWith("#") ? value : "#000000"}
             onChange={e => onChange(e.target.value)}
             style={{ width: 24, height: 24, border: 0, borderRadius: 3,
                       cursor: "pointer", padding: 0, background: "transparent" }} />
      <span style={{ fontSize: 10.5, color: ROLE_ROOM_BRAND.textSecondary,
                       minWidth: 50 }}>{label}</span>
      <input value={value} onChange={e => onChange(e.target.value)}
             style={{ ...inputSx, flex: 1, fontSize: 9.5 }} />
    </div>
  );
}

function RangeRow({ label, min, max, step, value, onChange }: {
  label: string; min: number; max: number; step: number;
  value: number; onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6,
                    marginBottom: 4, fontSize: 10.5,
                    color: ROLE_ROOM_BRAND.textSecondary }}>
      <span style={{ minWidth: 60 }}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
             onChange={e => onChange(parseFloat(e.target.value))}
             style={{ flex: 1, accentColor: ROLE_ROOM_BRAND.primaryLila }} />
      <span style={{ minWidth: 32, textAlign: "right" }}>{value}</span>
    </div>
  );
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

const inputSx: React.CSSProperties = {
  display: "block", width: "100%",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(160,48,192,0.18)",
  borderRadius: 3, padding: "5px 8px",
  color: ROLE_ROOM_BRAND.textPrimary, fontSize: 11,
};

const sectionTitle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700,
  color: ROLE_ROOM_BRAND.textTertiary,
  marginBottom: 5, letterSpacing: 0.5,
};

const buttonSecondary: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(160,48,192,0.40)",
  color: ROLE_ROOM_BRAND.textPrimary,
  padding: "6px 10px", fontSize: 11, fontWeight: 600,
  borderRadius: 4, cursor: "pointer",
  display: "inline-flex", alignItems: "center", gap: 4,
};

export default CaptionStudio;
