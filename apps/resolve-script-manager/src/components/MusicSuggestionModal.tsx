/**
 * MusicSuggestionModal — Director foreslår musikk for nåværende chapter.
 * Samme pattern som BrollSuggestionModal men med:
 *   - BPM-boost-indicator (vises hvis BPM matcher target-range)
 *   - Audio-preview-knapp pr suggestion (30-sek mp3)
 *   - Energy/key/duration-stats i kort
 */

import { useEffect, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import CloseIcon from "@mui/icons-material/Close";
import CheckIcon from "@mui/icons-material/Check";
import ClearIcon from "@mui/icons-material/Clear";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import LibraryMusicIcon from "@mui/icons-material/LibraryMusic";
import { musicService } from "../services/musicService";
import type { MusicSuggestion } from "../lib/musicTypes";
import { ROLE_ROOM_BRAND } from "../lib/lowerThirdTypes";

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  agentKind: string;
  chapterId?: string;
  contextTags: string[];
  targetBpmRange?: [number, number];
  contextDescription?: string;
  onApprove?: (trackId: string, trackPath: string) => void;
}

export function MusicSuggestionModal({
  open, onClose, projectId, agentKind, chapterId,
  contextTags, targetBpmRange, contextDescription, onApprove,
}: Props) {
  const [suggestions, setSuggestions] = useState<MusicSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalTracks, setTotalTracks] = useState(0);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!open || !projectId) return;
    loadSuggestions();
    return () => {
      audioRef.current?.pause();
      setPlayingId(null);
    };
  }, [open, projectId, agentKind, contextTags.join(","),
      targetBpmRange?.join("-")]);

  const loadSuggestions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await musicService.suggest({
        projectId, agentKind, chapterId, contextTags, targetBpmRange, limit: 6,
      });
      setSuggestions(res.suggestions);
      setTotalTracks(res.totalTracks);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (s: MusicSuggestion) => {
    try {
      await musicService.feedback({
        trackId: s.id, approved: true,
        agentKind, chapterId, contextTags,
      });
      audioRef.current?.pause();
      onApprove?.(s.id, s.filePath);
      onClose();
    } catch (e) { setError((e as Error).message); }
  };

  const handleReject = async (s: MusicSuggestion) => {
    try {
      await musicService.feedback({
        trackId: s.id, approved: false,
        agentKind, chapterId, contextTags,
      });
      setSuggestions(prev => prev.filter(x => x.id !== s.id));
    } catch (e) { setError((e as Error).message); }
  };

  const togglePlay = (s: MusicSuggestion) => {
    if (!s.previewAudioPath) return;
    const a = audioRef.current;
    if (!a) return;
    if (playingId === s.id) {
      a.pause(); setPlayingId(null);
    } else {
      a.src = convertFileSrc(s.previewAudioPath);
      void a.play();
      setPlayingId(s.id);
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
      <audio ref={audioRef} onEnded={() => setPlayingId(null)}
             style={{ display: "none" }} />
      <div onClick={e => e.stopPropagation()}
           style={{
             width: "min(950px, 92vw)", maxHeight: "85vh",
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
              <LibraryMusicIcon sx={{ fontSize: 16, color: "#fff" }} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>
                Music-forslag fra Director
              </div>
              <div style={{ fontSize: 10.5,
                              color: ROLE_ROOM_BRAND.textTertiary }}>
                {contextDescription || "Basert på din kontekst + universal læring"}
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

        {/* Context strip */}
        <div style={{ padding: "8px 18px",
                        background: "rgba(160,48,192,0.06)",
                        borderBottom: "1px solid rgba(160,48,192,0.10)",
                        display: "flex", alignItems: "center", gap: 6,
                        flexWrap: "wrap", fontSize: 10.5 }}>
          <span style={{ color: ROLE_ROOM_BRAND.textTertiary,
                            fontWeight: 600 }}>Context:</span>
          {contextTags.map(t => (
            <span key={t} style={{
              padding: "2px 7px", borderRadius: 999,
              background: "rgba(160,48,192,0.18)",
              border: "1px solid rgba(160,48,192,0.30)",
              color: ROLE_ROOM_BRAND.textPrimary,
            }}>{t}</span>
          ))}
          {targetBpmRange && (
            <span style={{
              padding: "2px 7px", borderRadius: 999,
              background: "rgba(74,212,138,0.18)",
              border: "1px solid rgba(74,212,138,0.30)",
              color: "#4ad48a", fontWeight: 600,
            }}>BPM {targetBpmRange[0]}-{targetBpmRange[1]}</span>
          )}
        </div>

        {error && (
          <div style={{ padding: "8px 18px",
                          background: "rgba(239,79,111,0.10)",
                          color: "#ef4f6f", fontSize: 11 }}>{error}</div>
        )}

        {/* Suggestions */}
        <div style={{ flex: 1, overflowY: "auto", padding: 18 }}>
          {loading && (
            <div style={{ textAlign: "center", padding: 40, fontSize: 12,
                            color: ROLE_ROOM_BRAND.textTertiary }}>
              Henter forslag …
            </div>
          )}
          {!loading && suggestions.length === 0 && totalTracks === 0 && (
            <div style={{ textAlign: "center", padding: 40, fontSize: 12,
                            color: ROLE_ROOM_BRAND.textTertiary, lineHeight: 1.6 }}>
              Ingen tracks i Music Library for dette prosjektet enda.
              <br />Last opp music i Library først.
            </div>
          )}
          {!loading && suggestions.length === 0 && totalTracks > 0 && (
            <div style={{ textAlign: "center", padding: 40, fontSize: 12,
                            color: ROLE_ROOM_BRAND.textTertiary, lineHeight: 1.6 }}>
              {totalTracks} tracks i biblioteket, men ingen matcher godt.
              <br />Prøv andre context-tags eller bredere BPM-range.
            </div>
          )}
          {!loading && suggestions.length > 0 && (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 14,
            }}>
              {suggestions.map(s => (
                <MusicSuggestionCard key={s.id} suggestion={s}
                                       playing={playingId === s.id}
                                       onTogglePlay={() => togglePlay(s)}
                                       onApprove={() => void handleApprove(s)}
                                       onReject={() => void handleReject(s)} />
              ))}
            </div>
          )}
        </div>

        <div style={{
          padding: "10px 18px",
          borderTop: "1px solid rgba(160,48,192,0.15)",
          background: "rgba(255,255,255,0.02)",
          fontSize: 10.5, color: ROLE_ROOM_BRAND.textTertiary, lineHeight: 1.5,
        }}>
          Godkjenninger lærer hele systemet. BPM-range + tag-kombinasjoner
          som ofte approves boostes for alle brukere fremover.
        </div>
      </div>
    </div>
  );
}

function MusicSuggestionCard({ suggestion, playing, onTogglePlay, onApprove, onReject }: {
  suggestion: MusicSuggestion;
  playing: boolean;
  onTogglePlay: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const va = suggestion.audioAnalysis;
  const waveSrc = suggestion.waveformImagePath
    ? convertFileSrc(suggestion.waveformImagePath) : null;
  const scorePct = Math.round(suggestion.score * 100);
  const boostPct = Math.round((suggestion.learningBoost - 0.5) * 200);
  const bpmBoostPct = Math.round((suggestion.bpmBoost - 1) * 100);

  return (
    <div style={{
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(160,48,192,0.18)",
      borderRadius: 6, overflow: "hidden",
    }}>
      <div style={{ padding: 10, position: "relative" }}>
        {/* Score badges */}
        <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
          <span style={{
            padding: "3px 8px", borderRadius: 3, fontSize: 9.5,
            fontWeight: 700,
            background: ROLE_ROOM_BRAND.signatureGradient, color: "#fff",
          }}>match {scorePct}%</span>
          {bpmBoostPct > 5 && (
            <span style={{
              padding: "3px 8px", borderRadius: 3, fontSize: 9,
              fontWeight: 600,
              background: "rgba(74,212,138,0.85)", color: "#fff",
            }}>BPM ↑{bpmBoostPct}%</span>
          )}
          {Math.abs(boostPct) > 20 && (
            <span style={{
              padding: "3px 8px", borderRadius: 3, fontSize: 9,
              fontWeight: 600,
              background: boostPct > 0
                ? "rgba(74,212,138,0.85)"
                : "rgba(239,79,111,0.85)",
              color: "#fff",
            }}>{boostPct > 0 ? "↑" : "↓"} læring {Math.abs(boostPct)}%</span>
          )}
        </div>

        {/* Filename + play */}
        <div style={{ display: "flex", alignItems: "center", gap: 8,
                        marginBottom: 6 }}>
          <button onClick={onTogglePlay}
                  disabled={!suggestion.previewAudioPath}
                  style={{
                    width: 30, height: 30, borderRadius: 15,
                    background: playing
                      ? ROLE_ROOM_BRAND.signatureGradient
                      : "rgba(160,48,192,0.18)",
                    border: 0, color: "#fff",
                    cursor: suggestion.previewAudioPath ? "pointer" : "not-allowed",
                    opacity: suggestion.previewAudioPath ? 1 : 0.4,
                    display: "inline-flex", alignItems: "center",
                    justifyContent: "center", flex: "0 0 auto",
                  }}>
            {playing
              ? <PauseIcon sx={{ fontSize: 14 }} />
              : <PlayArrowIcon sx={{ fontSize: 14 }} />}
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11.5, fontWeight: 600,
                            overflow: "hidden", textOverflow: "ellipsis",
                            whiteSpace: "nowrap" }}>
              {suggestion.filePath.split("/").pop()}
            </div>
            <div style={{ fontSize: 9.5,
                            color: ROLE_ROOM_BRAND.textTertiary,
                            display: "flex", gap: 8 }}>
              {va?.bpm && <span>{Math.round(va.bpm)} BPM</span>}
              {va?.key && <span>{va.key}{va.mode === "minor" ? "m" : ""}</span>}
              {suggestion.durationSec > 0 && (
                <span>{Math.floor(suggestion.durationSec / 60)}:{String(Math.floor(suggestion.durationSec % 60)).padStart(2, "0")}</span>
              )}
            </div>
          </div>
        </div>

        {waveSrc && (
          <img src={waveSrc} alt=""
               style={{ width: "100%", height: 24, opacity: 0.7,
                          objectFit: "fill", marginBottom: 6 }} />
        )}

        {/* Tags */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3,
                        marginBottom: 8 }}>
          {suggestion.tags.slice(0, 5).map(t => (
            <span key={t} style={{
              fontSize: 9, padding: "1px 5px", borderRadius: 3,
              background: "rgba(160,48,192,0.15)",
              color: ROLE_ROOM_BRAND.textSecondary,
            }}>{t}</span>
          ))}
        </div>

        {/* Approve / reject */}
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={onApprove}
                  style={{
                    flex: 1, background: "rgba(74,212,138,0.18)",
                    border: "1px solid rgba(74,212,138,0.45)",
                    color: "#4ad48a", padding: "6px 10px",
                    borderRadius: 3, fontSize: 11, fontWeight: 600,
                    cursor: "pointer",
                    display: "inline-flex", alignItems: "center",
                    justifyContent: "center", gap: 4,
                  }}>
            <CheckIcon sx={{ fontSize: 13 }} /> Bruk
          </button>
          <button onClick={onReject}
                  style={{
                    background: "rgba(239,79,111,0.18)",
                    border: "1px solid rgba(239,79,111,0.45)",
                    color: "#ef4f6f", padding: "6px 12px",
                    borderRadius: 3, fontSize: 11, fontWeight: 600,
                    cursor: "pointer",
                    display: "inline-flex", alignItems: "center", gap: 4,
                  }}>
            <ClearIcon sx={{ fontSize: 13 }} /> Avvis
          </button>
        </div>
      </div>
    </div>
  );
}

export default MusicSuggestionModal;
