/**
 * BrollSuggestionModal — popup som vises når Director foreslår B-roll
 * eller når autopilot trenger context-matching klipp.
 *
 * Viser rangerte forslag med:
 *   - Thumbnail + hover-preview
 *   - Vision-summary
 *   - Score-breakdown (base + universal-læring-boost)
 *   - Tag-overlap-indikator
 *   - Approve / reject-knapper → registrerer i universal-læring-table
 *
 * Når Bjarne godkjenner: feedback sendes, score for tag-kombinasjonen
 * boostes i fremtidige forslag. Når avviser: rejection boostes.
 */

import { useEffect, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import CloseIcon from "@mui/icons-material/Close";
import CheckIcon from "@mui/icons-material/Check";
import ClearIcon from "@mui/icons-material/Clear";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import { brollService } from "../services/brollService";
import type { BrollSuggestion } from "../lib/brollTypes";
import { ROLE_ROOM_BRAND } from "../lib/lowerThirdTypes";

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  agentKind: string;
  chapterId?: string;
  /** Tags som beskriver konteksten der B-roll trengs.
   * F.eks. ["interior", "office", "talking-head", "morning"]. */
  contextTags: string[];
  /** Tilleggs-tekst som forklarer hvorfor Director foreslår B-roll. */
  contextDescription?: string;
  /** Callback når Bjarne godkjenner et klipp — kan trigge auto-pilot
   * eller bare lukke modalen. */
  onApprove?: (clipId: string, clipPath: string) => void;
}

export function BrollSuggestionModal({
  open, onClose, projectId, agentKind, chapterId,
  contextTags, contextDescription, onApprove,
}: Props) {
  const [suggestions, setSuggestions] = useState<BrollSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalClips, setTotalClips] = useState(0);

  useEffect(() => {
    if (!open || !projectId) return;
    loadSuggestions();
  }, [open, projectId, agentKind, contextTags.join(",")]);

  const loadSuggestions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await brollService.suggest({
        projectId, agentKind, chapterId, contextTags, limit: 6,
      });
      setSuggestions(res.suggestions);
      setTotalClips(res.totalClips);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (s: BrollSuggestion) => {
    try {
      await brollService.feedback({
        clipId: s.id, approved: true,
        agentKind, chapterId, contextTags,
      });
      onApprove?.(s.id, s.filePath);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleReject = async (s: BrollSuggestion) => {
    try {
      await brollService.feedback({
        clipId: s.id, approved: false,
        agentKind, chapterId, contextTags,
      });
      setSuggestions(prev => prev.filter(x => x.id !== s.id));
    } catch (e) {
      setError((e as Error).message);
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
          display: "flex", justifyContent: "space-between",
          alignItems: "center",
        }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 6,
              background: ROLE_ROOM_BRAND.signatureGradient,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}>
              <AutoFixHighIcon sx={{ fontSize: 16, color: "#fff" }} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>
                B-roll-forslag fra Director
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

        {/* Context tags strip */}
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
          {!loading && suggestions.length === 0 && totalClips === 0 && (
            <div style={{ textAlign: "center", padding: 40, fontSize: 12,
                            color: ROLE_ROOM_BRAND.textTertiary, lineHeight: 1.6 }}>
              Ingen klipp i B-roll-biblioteket for dette prosjektet enda.
              <br />
              Last opp B-roll i Library først.
            </div>
          )}
          {!loading && suggestions.length === 0 && totalClips > 0 && (
            <div style={{ textAlign: "center", padding: 40, fontSize: 12,
                            color: ROLE_ROOM_BRAND.textTertiary, lineHeight: 1.6 }}>
              {totalClips} klipp i biblioteket, men ingen matcher konteksten godt.
              <br />
              Prøv å justere context-tags eller legg til flere B-roll.
            </div>
          )}
          {!loading && suggestions.length > 0 && (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: 14,
            }}>
              {suggestions.map(s => (
                <SuggestionCard key={s.id} suggestion={s}
                                 onApprove={() => void handleApprove(s)}
                                 onReject={() => void handleReject(s)} />
              ))}
            </div>
          )}
        </div>

        {/* Footer info om universal læring */}
        <div style={{
          padding: "10px 18px",
          borderTop: "1px solid rgba(160,48,192,0.15)",
          background: "rgba(255,255,255,0.02)",
          fontSize: 10.5, color: ROLE_ROOM_BRAND.textTertiary,
          lineHeight: 1.5,
        }}>
          Godkjenninger og avvisninger lærer hele Role Room-systemet. Når
          du sier "ja" til et klipp i en gitt kontekst, vil lignende
          tag-kombinasjoner rangeres høyere for alle brukere fremover.
        </div>
      </div>
    </div>
  );
}

function SuggestionCard({ suggestion, onApprove, onReject }: {
  suggestion: BrollSuggestion;
  onApprove: () => void;
  onReject: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const thumbSrc = suggestion.previewThumbnailPath
    ? convertFileSrc(suggestion.previewThumbnailPath) : null;
  const va = suggestion.visionAnalysis;

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (hovered) { void v.play(); }
    else { v.pause(); v.currentTime = 0; }
  }, [hovered]);

  const scorePct = Math.round(suggestion.score * 100);
  const boostPct = Math.round((suggestion.learningBoost - 0.5) * 200); // -100 til +100

  return (
    <div onMouseEnter={() => setHovered(true)}
         onMouseLeave={() => setHovered(false)}
         style={{
           background: "rgba(255,255,255,0.04)",
           border: "1px solid rgba(160,48,192,0.18)",
           borderRadius: 6, overflow: "hidden",
         }}>
      {/* Thumb / preview */}
      <div style={{ position: "relative", aspectRatio: "16/9",
                      background: "rgba(0,0,0,0.5)", overflow: "hidden" }}>
        {thumbSrc && (
          <img src={thumbSrc} alt=""
               style={{ width: "100%", height: "100%", objectFit: "cover",
                          display: hovered ? "none" : "block" }} />
        )}
        {!thumbSrc && (
          <div style={{ height: "100%",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: ROLE_ROOM_BRAND.textTertiary,
                          fontSize: 11 }}>Ingen preview</div>
        )}
        {/* Score badge */}
        <div style={{
          position: "absolute", top: 6, left: 6,
          padding: "3px 8px", borderRadius: 3, fontSize: 9.5,
          fontWeight: 700,
          background: ROLE_ROOM_BRAND.signatureGradient,
          color: "#fff",
        }}>match {scorePct}%</div>
        {/* Boost indicator hvis universal læring har sterk mening */}
        {Math.abs(boostPct) > 20 && (
          <div style={{
            position: "absolute", top: 6, right: 6,
            padding: "3px 8px", borderRadius: 3, fontSize: 9,
            fontWeight: 600,
            background: boostPct > 0
              ? "rgba(74,212,138,0.85)"
              : "rgba(239,79,111,0.85)",
            color: "#fff",
          }}>{boostPct > 0 ? "↑" : "↓"} læring {Math.abs(boostPct)}%</div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: 10 }}>
        <div style={{ fontSize: 11, lineHeight: 1.4,
                        color: ROLE_ROOM_BRAND.textPrimary,
                        marginBottom: 6,
                        overflow: "hidden", textOverflow: "ellipsis",
                        display: "-webkit-box",
                        WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
          {va?.summary || suggestion.filePath.split("/").pop()}
        </div>
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

export default BrollSuggestionModal;
