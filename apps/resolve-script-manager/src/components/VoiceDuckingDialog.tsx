/**
 * VoiceDuckingDialog — modal for å mikse voice + music med sidechain-
 * compress voice-ducking. Kjører apply_voice_ducking.py.
 *
 * Role Room-brandet, har slidere for ratio/threshold/attack/release/
 * makeup-gain/music-base-gain.
 */

import { useState } from "react";
import { open as openFileDialog, save as saveFileDialog } from "@tauri-apps/plugin-dialog";
import CloseIcon from "@mui/icons-material/Close";
import GraphicEqIcon from "@mui/icons-material/GraphicEq";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import { openPath } from "@tauri-apps/plugin-opener";
import { executeScript } from "../api";
import { ROLE_ROOM_BRAND } from "../lib/lowerThirdTypes";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Pre-filled voice-track (typisk source-video fra editor). */
  initialVoicePath?: string;
  /** Pre-filled music-track (typisk fra Music Library suggestion). */
  initialMusicPath?: string;
}

interface DuckingResult {
  outputPath: string;
  sizeMB: number;
  params: Record<string, number>;
}

export function VoiceDuckingDialog({
  open, onClose, initialVoicePath = "", initialMusicPath = "",
}: Props) {
  const [voicePath, setVoicePath] = useState(initialVoicePath);
  const [musicPath, setMusicPath] = useState(initialMusicPath);
  const [outputPath, setOutputPath] = useState("");

  // Broadcast-standard defaults
  const [ratio, setRatio] = useState(4);
  const [threshold, setThreshold] = useState(-25);
  const [attackMs, setAttackMs] = useState(5);
  const [releaseMs, setReleaseMs] = useState(400);
  const [makeupDb, setMakeupDb] = useState(3);
  const [musicGainDb, setMusicGainDb] = useState(-5);
  const [voiceBoostDb, setVoiceBoostDb] = useState(0);

  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<DuckingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pickVoice = async () => {
    const picked = await openFileDialog({
      multiple: false,
      title: "Velg voice/narrasjon-track (eller video med voice)",
      filters: [{ name: "Audio/Video",
                    extensions: ["mp4", "mov", "wav", "mp3", "m4a", "flac"] }],
    });
    if (typeof picked === "string") setVoicePath(picked);
  };

  const pickMusic = async () => {
    const picked = await openFileDialog({
      multiple: false,
      title: "Velg music-track",
      filters: [{ name: "Audio",
                    extensions: ["mp3", "wav", "flac", "m4a", "aif"] }],
    });
    if (typeof picked === "string") setMusicPath(picked);
  };

  const pickOutput = async () => {
    const picked = await saveFileDialog({
      defaultPath: "mixed_with_ducking.mp4",
      filters: [{ name: "MP4", extensions: ["mp4"] }],
    });
    if (typeof picked === "string") setOutputPath(picked);
  };

  const runDucking = async () => {
    if (!voicePath || !musicPath || !outputPath) {
      setError("Voice, music og output-path er påkrevd");
      return;
    }
    setProcessing(true);
    setError(null);
    setResult(null);
    try {
      const summary = await executeScript("apply_voice_ducking", {
        voicePath, musicPath, outputPath,
        ratio, threshold, attackMs, releaseMs, makeupDb,
        musicGainDb, voiceBoostDb,
      }, false);
      const r = summary.events.find(e => e.type === "result")?.value as DuckingResult | undefined;
      if (r) setResult(r);
      else throw new Error("Ingen output-result fra ffmpeg");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProcessing(false);
    }
  };

  if (!open) return null;

  return (
    <div onClick={onClose}
         style={{
           position: "fixed", inset: 0, zIndex: 5900,
           background: "rgba(8,4,20,0.92)", backdropFilter: "blur(10px)",
           display: "flex", alignItems: "center", justifyContent: "center",
         }}>
      <div onClick={e => e.stopPropagation()}
           style={{
             width: "min(720px, 92vw)", maxHeight: "90vh",
             background: ROLE_ROOM_BRAND.surfaceGradient,
             border: "1px solid rgba(160,48,192,0.30)",
             borderRadius: 10, overflow: "hidden",
             color: ROLE_ROOM_BRAND.textPrimary,
             display: "flex", flexDirection: "column",
           }}>
        {/* Header */}
        <div style={{
          padding: "14px 18px",
          borderBottom: "1px solid rgba(160,48,192,0.20)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 6,
              background: ROLE_ROOM_BRAND.signatureGradient,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}>
              <GraphicEqIcon sx={{ fontSize: 16, color: "#fff" }} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>
                Voice Ducking
              </div>
              <div style={{ fontSize: 10.5,
                              color: ROLE_ROOM_BRAND.textTertiary }}>
                Sidechain-compress music under voice (broadcast-standard)
              </div>
            </div>
          </div>
          <button onClick={onClose}
                  style={{ background: "transparent", border: 0,
                            color: ROLE_ROOM_BRAND.textSecondary,
                            cursor: "pointer", padding: 4 }}>
            <CloseIcon />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 18 }}>
          {/* File-pickers */}
          <FilePicker label="Voice-track (eller video)"
                       path={voicePath} onPick={pickVoice} />
          <FilePicker label="Music-track" path={musicPath} onPick={pickMusic} />
          <FilePicker label="Output" path={outputPath} onPick={pickOutput} />

          {/* Compressor params */}
          <div style={{ marginTop: 18 }}>
            <div style={sectionTitle}>COMPRESSOR-PARAMS</div>
            <RangeRow label="Ratio" min={1} max={12} step={0.5}
                      value={ratio} onChange={setRatio} unit=":1" />
            <RangeRow label="Threshold" min={-50} max={0} step={1}
                      value={threshold} onChange={setThreshold} unit="dB" />
            <RangeRow label="Attack" min={1} max={50} step={1}
                      value={attackMs} onChange={setAttackMs} unit="ms" />
            <RangeRow label="Release" min={50} max={2000} step={10}
                      value={releaseMs} onChange={setReleaseMs} unit="ms" />
            <RangeRow label="Makeup" min={0} max={12} step={0.5}
                      value={makeupDb} onChange={setMakeupDb} unit="dB" />
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={sectionTitle}>VOLUME-BALANSE</div>
            <RangeRow label="Music base" min={-20} max={0} step={1}
                      value={musicGainDb} onChange={setMusicGainDb} unit="dB" />
            <RangeRow label="Voice boost" min={-6} max={12} step={1}
                      value={voiceBoostDb} onChange={setVoiceBoostDb} unit="dB" />
          </div>

          {error && (
            <div style={{ marginTop: 12, padding: 8, borderRadius: 4,
                            background: "rgba(239,79,111,0.10)",
                            color: "#ef4f6f", fontSize: 11 }}>
              {error}
            </div>
          )}

          {result && (
            <div style={{ marginTop: 14, padding: 10, borderRadius: 4,
                            background: "rgba(74,212,138,0.10)",
                            border: "1px solid rgba(74,212,138,0.30)",
                            color: "#4ad48a", fontSize: 11.5,
                            display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1 }}>
                Ferdig: {result.sizeMB} MB · ratio {result.params.ratio}:1
                · threshold {result.params.thresholdDb}dB
              </div>
              <button onClick={() => void openPath(
                          result.outputPath.replace(/\/[^/]+$/, ""))}
                      style={{
                        background: "rgba(74,212,138,0.18)",
                        border: "1px solid rgba(74,212,138,0.40)",
                        color: "#4ad48a", borderRadius: 3,
                        padding: "4px 10px", fontSize: 10.5,
                        cursor: "pointer",
                        display: "inline-flex", alignItems: "center", gap: 4,
                      }}>
                <FolderOpenIcon sx={{ fontSize: 12 }} /> Åpne mappe
              </button>
            </div>
          )}
        </div>

        <div style={{
          padding: "12px 18px",
          borderTop: "1px solid rgba(160,48,192,0.20)",
          display: "flex", justifyContent: "flex-end", gap: 8,
        }}>
          <button onClick={onClose}
                  style={{
                    background: "transparent",
                    border: "1px solid rgba(255,255,255,0.15)",
                    color: ROLE_ROOM_BRAND.textPrimary,
                    padding: "8px 14px", fontSize: 12, fontWeight: 600,
                    borderRadius: 4, cursor: "pointer",
                  }}>
            Lukk
          </button>
          <button onClick={() => void runDucking()}
                  disabled={processing || !voicePath || !musicPath || !outputPath}
                  style={{
                    background: processing
                      ? "rgba(110,63,199,0.20)"
                      : ROLE_ROOM_BRAND.signatureGradient,
                    border: 0, color: "#fff",
                    padding: "8px 16px", fontSize: 12, fontWeight: 600,
                    borderRadius: 4,
                    cursor: processing ? "wait" : (!voicePath || !musicPath || !outputPath) ? "not-allowed" : "pointer",
                    opacity: (!voicePath || !musicPath || !outputPath) ? 0.5 : 1,
                    display: "inline-flex", alignItems: "center", gap: 6,
                  }}>
            <PlayArrowIcon sx={{ fontSize: 14 }} />
            {processing ? "Mikser …" : "Kjør ducking"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FilePicker({ label, path, onPick }: {
  label: string; path: string; onPick: () => void;
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      <label style={sectionTitle}>{label}</label>
      <div style={{ display: "flex", gap: 6 }}>
        <input value={path} readOnly
               placeholder="(ikke valgt)"
               style={{
                 flex: 1,
                 background: "rgba(255,255,255,0.04)",
                 border: "1px solid rgba(160,48,192,0.18)",
                 borderRadius: 3, padding: "6px 8px",
                 color: ROLE_ROOM_BRAND.textPrimary, fontSize: 11,
                 fontFamily: "monospace",
               }} />
        <button onClick={onPick}
                style={{
                  background: "rgba(160,48,192,0.18)",
                  border: "1px solid rgba(160,48,192,0.40)",
                  color: "#fff", padding: "6px 12px", fontSize: 11,
                  borderRadius: 3, cursor: "pointer", fontWeight: 600,
                }}>
          Velg
        </button>
      </div>
    </div>
  );
}

function RangeRow({ label, min, max, step, value, onChange, unit }: {
  label: string; min: number; max: number; step: number;
  value: number; onChange: (v: number) => void; unit?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8,
                    marginBottom: 5, fontSize: 11,
                    color: ROLE_ROOM_BRAND.textSecondary }}>
      <span style={{ minWidth: 80 }}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
             onChange={e => onChange(parseFloat(e.target.value))}
             style={{ flex: 1, accentColor: ROLE_ROOM_BRAND.primaryLila }} />
      <span style={{ minWidth: 50, textAlign: "right",
                       fontWeight: 600,
                       color: ROLE_ROOM_BRAND.textPrimary }}>
        {value}{unit}
      </span>
    </div>
  );
}

const sectionTitle: React.CSSProperties = {
  display: "block", fontSize: 10, fontWeight: 700,
  color: ROLE_ROOM_BRAND.textTertiary,
  marginBottom: 4, letterSpacing: 0.5,
};

export default VoiceDuckingDialog;
