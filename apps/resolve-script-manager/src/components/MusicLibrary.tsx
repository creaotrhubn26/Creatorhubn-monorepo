/**
 * MusicLibrary — Role Room-brandet music-bibliotek per prosjekt.
 *
 * Funksjoner:
 *  - Track-liste med waveform-thumbnail (Role Room-lilla) + analyse-status
 *  - Klikk play → audio-preview (30 sek) i toolbar-player
 *  - Klikk track → detail-panel med BPM/key/mode/segmenter/mood-tags
 *  - "+ Legg til track": fil-dialog → preview + librosa-analyse
 *  - Søk på tags + BPM-range filter
 *  - Sort: relevans (default) / dato / bruk / BPM
 *  - License-tagging (royalty-free / commercial / cc / owned)
 */

import { useEffect, useRef, useState } from "react";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { convertFileSrc } from "@tauri-apps/api/core";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import LibraryMusicIcon from "@mui/icons-material/LibraryMusic";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import SearchIcon from "@mui/icons-material/Search";
import SortIcon from "@mui/icons-material/Sort";
import { musicService } from "../services/musicService";
import { executeScript } from "../api";
import { ROLE_ROOM_BRAND } from "../lib/lowerThirdTypes";
import type { MusicTrack } from "../lib/musicTypes";

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
}

type SortMode = "relevance" | "date" | "usage" | "bpm";

export function MusicLibrary({ open, onClose, projectId }: Props) {
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<MusicTrack | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("relevance");
  const [bpmFilter, setBpmFilter] = useState<[number, number] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!open || !projectId) return;
    refresh();
  }, [open, projectId]);

  const refresh = async () => {
    setLoaded(false);
    try {
      const list = await musicService.list(projectId);
      setTracks(list);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoaded(true);
    }
  };

  const handleAddTrack = async () => {
    const picked = await openFileDialog({
      multiple: true,
      title: "Velg music-tracks",
      filters: [{
        name: "Audio",
        extensions: ["mp3", "wav", "flac", "m4a", "aif", "aiff", "ogg"],
      }],
    });
    if (!picked) return;
    const paths = Array.isArray(picked) ? picked : [picked];
    setUploading(true);
    setError(null);

    for (let i = 0; i < paths.length; i++) {
      const filePath = paths[i];
      if (typeof filePath !== "string") continue;
      setUploadProgress(`(${i + 1}/${paths.length}) ${filePath.split("/").pop() ?? ""}`);

      try {
        // 1. Register
        const reg = await musicService.register({ projectId, filePath });

        // 2. Preview + waveform
        try {
          const previewResult = await executeScript("extract_music_preview", {
            audioPath: filePath,
          }, false);
          const pv = previewResult.events.find(e => e.type === "result")?.value as {
            previewAudioPath?: string; waveformImagePath?: string;
            durationSec?: number;
          } | undefined;
          if (pv) {
            await musicService.setAnalysis(reg.id, {
              previewAudioPath: pv.previewAudioPath,
              waveformImagePath: pv.waveformImagePath,
              durationSec: pv.durationSec,
              analysisStatus: "analyzing",
            });
          }
        } catch (e) {
          console.warn("[music] preview-extract feilet:", e);
        }

        // 3. Librosa-analyse
        try {
          const analysisResult = await executeScript("analyze_music_track", {
            audioPath: filePath,
          }, false);
          const av = analysisResult.events.find(e => e.type === "result")?.value as {
            tags?: string[]; durationSec?: number;
            [k: string]: unknown;
          } | undefined;
          if (av) {
            await musicService.setAnalysis(reg.id, {
              audioAnalysis: av,
              tags: av.tags,
              durationSec: av.durationSec,
              analysisStatus: "ready",
            });
          }
        } catch (e) {
          await musicService.setAnalysis(reg.id, {
            analysisStatus: "failed",
            analysisError: (e as Error).message,
          });
        }
      } catch (e) {
        setError(`Feilet på ${filePath}: ${(e as Error).message}`);
      }
    }

    setUploading(false);
    setUploadProgress("");
    await refresh();
  };

  const handleDelete = async (track: MusicTrack) => {
    if (!confirm(`Slett "${track.filePath.split("/").pop()}"?`)) return;
    try {
      await musicService.delete(track.id);
      setTracks(prev => prev.filter(t => t.id !== track.id));
      if (selectedTrack?.id === track.id) setSelectedTrack(null);
      if (playingId === track.id) {
        audioRef.current?.pause();
        setPlayingId(null);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const togglePlay = (track: MusicTrack) => {
    if (!track.previewAudioPath) return;
    const a = audioRef.current;
    if (!a) return;
    if (playingId === track.id) {
      a.pause();
      setPlayingId(null);
    } else {
      a.src = convertFileSrc(track.previewAudioPath);
      void a.play();
      setPlayingId(track.id);
    }
  };

  const filtered = tracks
    .filter(t => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesText = t.tags.some(tt => tt.toLowerCase().includes(q))
          || t.userDescription?.toLowerCase().includes(q)
          || t.filePath.toLowerCase().includes(q);
        if (!matchesText) return false;
      }
      if (bpmFilter) {
        const bpm = t.audioAnalysis?.bpm;
        if (!bpm || bpm < bpmFilter[0] || bpm > bpmFilter[1]) return false;
      }
      return true;
    })
    .sort((a, b) => {
      switch (sortMode) {
        case "date":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "usage":
          return b.usageCount - a.usageCount
            || b.approvalCount - a.approvalCount;
        case "bpm": {
          const ba = a.audioAnalysis?.bpm ?? 0;
          const bb = b.audioAnalysis?.bpm ?? 0;
          return ba - bb;
        }
        default:
          return (b.approvalCount - b.rejectionCount)
            - (a.approvalCount - a.rejectionCount);
      }
    });

  if (!open) return null;

  return (
    <div onClick={onClose}
         style={{
           position: "fixed", inset: 0, zIndex: 5800,
           background: "rgba(8,4,20,0.92)", backdropFilter: "blur(10px)",
           display: "flex", flexDirection: "column",
           color: ROLE_ROOM_BRAND.textPrimary,
         }}>
      <audio ref={audioRef}
             onEnded={() => setPlayingId(null)}
             style={{ display: "none" }} />

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
            <LibraryMusicIcon sx={{ fontSize: 18, color: "#fff" }} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Music Library</div>
            <div style={{ fontSize: 10.5, color: ROLE_ROOM_BRAND.textTertiary,
                            display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{
                width: 8, height: 8, borderRadius: 4,
                background: ROLE_ROOM_BRAND.primaryLila,
              }} />
              {tracks.length} tracks · librosa-analyse · universal læring
            </div>
          </div>
        </div>

        <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => void handleAddTrack()}
                  disabled={uploading}
                  style={{
                    background: uploading
                      ? "rgba(110,63,199,0.20)"
                      : ROLE_ROOM_BRAND.signatureGradient,
                    border: 0, color: "#fff",
                    padding: "7px 14px", fontSize: 12, fontWeight: 600,
                    borderRadius: 4, cursor: uploading ? "wait" : "pointer",
                    display: "inline-flex", alignItems: "center", gap: 6,
                  }}>
            <AddIcon sx={{ fontSize: 13 }} />
            {uploading ? `Analyserer … ${uploadProgress}` : "Legg til tracks"}
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

      {error && (
        <div onClick={e => e.stopPropagation()}
             style={{ padding: "8px 22px",
                       background: "rgba(239,79,111,0.15)",
                       color: "#ef4f6f", fontSize: 11 }}>{error}</div>
      )}

      {/* Toolbar */}
      <div onClick={e => e.stopPropagation()}
           style={{ padding: "10px 22px",
                     borderBottom: "1px solid rgba(160,48,192,0.10)",
                     display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1, position: "relative" }}>
          <SearchIcon sx={{
            position: "absolute", left: 8, top: "50%",
            transform: "translateY(-50%)",
            fontSize: 14, color: ROLE_ROOM_BRAND.textTertiary,
          }} />
          <input value={searchQuery}
                 onChange={e => setSearchQuery(e.target.value)}
                 placeholder="Søk på tags / beskrivelse …"
                 style={{
                   width: "100%",
                   background: "rgba(255,255,255,0.04)",
                   border: "1px solid rgba(160,48,192,0.18)",
                   borderRadius: 4,
                   padding: "6px 8px 6px 28px",
                   color: ROLE_ROOM_BRAND.textPrimary, fontSize: 11.5,
                 }} />
        </div>

        <div style={{ display: "inline-flex", alignItems: "center", gap: 6,
                        fontSize: 10.5, color: ROLE_ROOM_BRAND.textTertiary }}>
          <span>BPM:</span>
          {[null, [60, 90], [90, 120], [120, 140], [140, 180]].map((range, i) => {
            const r = range as [number, number] | null;
            const active = bpmFilter
              ? r?.[0] === bpmFilter[0] && r?.[1] === bpmFilter[1]
              : !range;
            return (
              <button key={i}
                      onClick={() => setBpmFilter(r)}
                      style={{
                        background: active
                          ? ROLE_ROOM_BRAND.signatureGradient
                          : "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        color: active ? "#fff"
                          : ROLE_ROOM_BRAND.textPrimary,
                        padding: "3px 8px", borderRadius: 3,
                        fontSize: 10, cursor: "pointer",
                      }}>
                {r ? `${r[0]}-${r[1]}` : "Alle"}
              </button>
            );
          })}
        </div>

        <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <SortIcon sx={{ fontSize: 14, color: ROLE_ROOM_BRAND.textTertiary }} />
          {(["relevance", "date", "usage", "bpm"] as SortMode[]).map(m => (
            <button key={m}
                    onClick={() => setSortMode(m)}
                    style={{
                      background: sortMode === m
                        ? ROLE_ROOM_BRAND.signatureGradient
                        : "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: sortMode === m ? "#fff"
                        : ROLE_ROOM_BRAND.textPrimary,
                      padding: "4px 10px", borderRadius: 3,
                      fontSize: 10.5, cursor: "pointer",
                    }}>
              {m === "relevance" ? "Relevans"
                : m === "date" ? "Dato"
                : m === "usage" ? "Bruk" : "BPM"}
            </button>
          ))}
        </div>
      </div>

      {/* Track list */}
      <div onClick={e => e.stopPropagation()}
           style={{ flex: 1, overflowY: "auto", padding: 22 }}>
        {!loaded && (
          <div style={{ textAlign: "center", padding: 40, fontSize: 12,
                          color: ROLE_ROOM_BRAND.textTertiary }}>Laster …</div>
        )}
        {loaded && filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: 60, fontSize: 12,
                          color: ROLE_ROOM_BRAND.textTertiary, lineHeight: 1.6 }}>
            {tracks.length === 0
              ? "Ingen tracks enda. Klikk \"Legg til tracks\" for å starte."
              : "Ingen treff. Justér søk eller BPM-filter."}
          </div>
        )}
        {loaded && filtered.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {filtered.map(track => (
              <TrackRow key={track.id} track={track}
                         playing={playingId === track.id}
                         onTogglePlay={() => togglePlay(track)}
                         onClick={() => setSelectedTrack(track)}
                         onDelete={() => void handleDelete(track)} />
            ))}
          </div>
        )}
      </div>

      {selectedTrack && (
        <TrackDetailPanel track={selectedTrack}
                           onClose={() => setSelectedTrack(null)} />
      )}
    </div>
  );
}

function TrackRow({ track, playing, onTogglePlay, onClick, onDelete }: {
  track: MusicTrack;
  playing: boolean;
  onTogglePlay: () => void;
  onClick: () => void;
  onDelete: () => void;
}) {
  const wave = track.waveformImagePath
    ? convertFileSrc(track.waveformImagePath) : null;
  const va = track.audioAnalysis;
  const status = track.analysisStatus;
  const statusColor = status === "ready" ? "#4ad48a"
    : status === "failed" ? "#ef4f6f"
    : status === "analyzing" ? "#f0a500"
    : ROLE_ROOM_BRAND.textTertiary;

  return (
    <div onClick={onClick}
         style={{
           display: "flex", alignItems: "center", gap: 12,
           padding: 10, borderRadius: 4,
           background: "rgba(255,255,255,0.04)",
           border: "1px solid rgba(160,48,192,0.18)",
           cursor: "pointer",
         }}>
      <button onClick={(e) => { e.stopPropagation(); onTogglePlay(); }}
              disabled={!track.previewAudioPath}
              style={{
                width: 36, height: 36, borderRadius: 18,
                background: playing
                  ? ROLE_ROOM_BRAND.signatureGradient
                  : "rgba(160,48,192,0.18)",
                border: 0, color: "#fff",
                cursor: track.previewAudioPath ? "pointer" : "not-allowed",
                opacity: track.previewAudioPath ? 1 : 0.4,
                display: "inline-flex", alignItems: "center",
                justifyContent: "center",
              }}>
        {playing
          ? <PauseIcon sx={{ fontSize: 18 }} />
          : <PlayArrowIcon sx={{ fontSize: 18 }} />}
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600,
                          color: ROLE_ROOM_BRAND.textPrimary,
                          overflow: "hidden", textOverflow: "ellipsis",
                          whiteSpace: "nowrap", flex: 1 }}>
            {track.filePath.split("/").pop()}
          </div>
          <div style={{ fontSize: 9, padding: "1px 6px",
                          borderRadius: 3,
                          background: "rgba(0,0,0,0.4)",
                          color: statusColor, fontWeight: 600,
                          textTransform: "uppercase" }}>
            {status}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 2,
                        fontSize: 10.5, color: ROLE_ROOM_BRAND.textTertiary }}>
          {va?.bpm && <span>{Math.round(va.bpm)} BPM</span>}
          {va?.key && <span>{va.key} {va.mode === "minor" ? "m" : ""}</span>}
          {track.durationSec > 0 && (
            <span>{Math.floor(track.durationSec / 60)}:{String(Math.floor(track.durationSec % 60)).padStart(2, "0")}</span>
          )}
          {track.licenseType && (
            <span style={{
              padding: "0 5px", borderRadius: 2,
              background: "rgba(74,212,138,0.18)",
              color: "#4ad48a",
            }}>{track.licenseType}</span>
          )}
        </div>
        {wave && (
          <img src={wave} alt=""
               style={{ width: "100%", height: 28, marginTop: 4,
                          opacity: 0.7, objectFit: "fill" }} />
        )}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 3,
                      maxWidth: 200 }}>
        {track.tags.slice(0, 4).map(t => (
          <span key={t} style={{
            fontSize: 9, padding: "1px 5px", borderRadius: 3,
            background: "rgba(160,48,192,0.18)",
            color: ROLE_ROOM_BRAND.textPrimary,
          }}>{t}</span>
        ))}
      </div>

      <button onClick={(e) => { e.stopPropagation(); onDelete(); }}
              title="Slett"
              style={{ background: "transparent", border: 0,
                        color: "#ef4f6f", cursor: "pointer", padding: 4,
                        display: "inline-flex", alignItems: "center" }}>
        <DeleteOutlineIcon sx={{ fontSize: 14 }} />
      </button>
    </div>
  );
}

function TrackDetailPanel({ track, onClose }: {
  track: MusicTrack;
  onClose: () => void;
}) {
  const va = track.audioAnalysis;
  const wave = track.waveformImagePath
    ? convertFileSrc(track.waveformImagePath) : null;

  return (
    <div onClick={onClose}
         style={{
           position: "fixed", inset: 0, zIndex: 5900,
           background: "rgba(8,4,20,0.85)", backdropFilter: "blur(10px)",
           display: "flex", alignItems: "center", justifyContent: "center",
         }}>
      <div onClick={e => e.stopPropagation()}
           style={{
             width: "min(800px, 92vw)", maxHeight: "85vh",
             background: ROLE_ROOM_BRAND.surfaceGradient,
             border: "1px solid rgba(160,48,192,0.30)",
             borderRadius: 10, overflow: "hidden",
             color: ROLE_ROOM_BRAND.textPrimary,
             display: "flex", flexDirection: "column",
           }}>
        <div style={{
          padding: "14px 18px",
          borderBottom: "1px solid rgba(160,48,192,0.20)",
          display: "flex", justifyContent: "space-between",
          alignItems: "center",
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>
              {track.filePath.split("/").pop()}
            </div>
            <div style={{ fontSize: 10.5,
                            color: ROLE_ROOM_BRAND.textTertiary }}>
              {track.durationSec.toFixed(1)}s · status: {track.analysisStatus}
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
          {wave && (
            <img src={wave} alt=""
                 style={{ width: "100%", height: 80, marginBottom: 16,
                            objectFit: "fill" }} />
          )}

          <div style={{ display: "grid",
                          gridTemplateColumns: "repeat(4, 1fr)",
                          gap: 10, marginBottom: 16 }}>
            <Stat label="BPM" value={va?.bpm ? `${Math.round(va.bpm)}` : "—"}
                   sub={va?.bpmConfidence
                     ? `${(va.bpmConfidence * 100).toFixed(0)}%`
                     : undefined} />
            <Stat label="Key" value={va?.key ?? "—"}
                   sub={va?.mode} />
            <Stat label="Energy" value={va?.energyAverage
                     ? `${(va.energyAverage * 100).toFixed(0)}%` : "—"} />
            <Stat label="Beats" value={va?.beatCount ? String(va.beatCount) : "—"} />
          </div>

          {/* Energy-curve visualisering */}
          {va?.energyCurve && va.energyCurve.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={sectionTitle}>ENERGY OVER TIME</div>
              <div style={{
                display: "flex", gap: 1, height: 36,
                background: "rgba(0,0,0,0.4)", padding: 4, borderRadius: 3,
              }}>
                {va.energyCurve.map((e, i) => (
                  <div key={i}
                       title={`${(e * 100).toFixed(0)}%`}
                       style={{
                         flex: 1, alignSelf: "flex-end",
                         height: `${Math.max(2, e * 100)}%`,
                         background: ROLE_ROOM_BRAND.primaryLila,
                         opacity: 0.6 + e * 0.4,
                         borderRadius: 1,
                       }} />
                ))}
              </div>
            </div>
          )}

          {/* Segments */}
          {va?.segments && va.segments.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={sectionTitle}>SEGMENTER</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {va.segments.map((s, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "4px 8px",
                    background: "rgba(255,255,255,0.03)",
                    borderRadius: 3, fontSize: 10.5,
                  }}>
                    <span style={{
                      padding: "1px 6px", borderRadius: 2,
                      background: ROLE_ROOM_BRAND.signatureGradient,
                      color: "#fff", fontWeight: 600,
                    }}>{s.type}</span>
                    <span style={{ color: ROLE_ROOM_BRAND.textTertiary }}>
                      {Math.floor(s.start)}s → {Math.floor(s.end)}s
                    </span>
                    <span style={{ marginLeft: "auto",
                                     color: ROLE_ROOM_BRAND.textSecondary }}>
                      energy {(s.energy * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {va?.moodTags && va.moodTags.length > 0 && (
            <KVRow label="Mood">
              {va.moodTags.map(t => (
                <Pill key={t}>{t}</Pill>
              ))}
            </KVRow>
          )}
          {va?.suggestedFor && va.suggestedFor.length > 0 && (
            <KVRow label="Suggested for">
              {va.suggestedFor.map(t => (
                <Pill key={t}>{t}</Pill>
              ))}
            </KVRow>
          )}
          {track.licenseType && (
            <KVRow label="License">
              <Pill green>{track.licenseType}</Pill>
              {track.licenseInfo && (
                <span style={{ fontSize: 10.5,
                                color: ROLE_ROOM_BRAND.textSecondary }}>
                  {track.licenseInfo}
                </span>
              )}
            </KVRow>
          )}

          <div style={{ marginTop: 16, padding: 8, borderRadius: 4,
                          background: "rgba(255,255,255,0.03)",
                          fontSize: 10, color: ROLE_ROOM_BRAND.textTertiary,
                          lineHeight: 1.5 }}>
            Stats: {track.suggestionCount} suggestions ·
            {" "}{track.approvalCount} approved ·
            {" "}{track.rejectionCount} rejected ·
            {" "}{track.usageCount} brukt
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: {
  label: string; value: string; sub?: string;
}) {
  return (
    <div style={{ padding: 10, borderRadius: 4,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(160,48,192,0.15)",
                    textAlign: "center" }}>
      <div style={{ fontSize: 9.5, color: ROLE_ROOM_BRAND.textTertiary,
                      letterSpacing: 0.5, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700,
                      color: ROLE_ROOM_BRAND.textPrimary }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 9.5, color: ROLE_ROOM_BRAND.textTertiary,
                        marginTop: 2 }}>{sub}</div>
      )}
    </div>
  );
}

function KVRow({ label, children }: {
  label: string; children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 10, display: "flex",
                    alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <span style={{ fontSize: 10.5, fontWeight: 600,
                       color: ROLE_ROOM_BRAND.textTertiary,
                       minWidth: 100 }}>{label}:</span>
      {children}
    </div>
  );
}

function Pill({ children, green }: {
  children: React.ReactNode; green?: boolean;
}) {
  return (
    <span style={{
      fontSize: 10, padding: "2px 8px", borderRadius: 999,
      background: green
        ? "rgba(74,212,138,0.18)"
        : "rgba(160,48,192,0.18)",
      color: green ? "#4ad48a" : ROLE_ROOM_BRAND.textPrimary,
    }}>{children}</span>
  );
}

const sectionTitle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700,
  color: ROLE_ROOM_BRAND.textTertiary,
  marginBottom: 5, letterSpacing: 0.5,
};

export default MusicLibrary;
