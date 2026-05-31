/**
 * SocialCutsStudio — Role Room-brandet repurpose-engine.
 *
 * Workflow:
 *  1. Krever Whisper-transcript (lastes via Caption Studio først)
 *  2. Klikk "Auto-pick standout-moments" → kjør find_standout_moments
 *  3. UI viser topp-6 candidates med score + reason + tekst-snutt
 *  4. Pikk: 9:16/1:1/4:5 aspect, burn-captions on/off
 *  5. "Extract selected" → kjør extract_social_cut per pickede moment
 *  6. Grid med thumbnails + status-workflow (extracted → reviewed →
 *     approved → published)
 *  7. Approve markerer cut som klar for upload/publish
 */

import { useEffect, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import CloseIcon from "@mui/icons-material/Close";
import ContentCutIcon from "@mui/icons-material/ContentCut";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlineOutlined";
import PublishIcon from "@mui/icons-material/Publish";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { executeScript } from "../api";
import { socialCutsService } from "../services/socialCutsService";
import { captionsService } from "../services/captionsService";
import { ROLE_ROOM_BRAND } from "../lib/lowerThirdTypes";
import type { SocialCut, CutAspect, StandoutMoment, CutStatus } from "../lib/socialCutTypes";
import type { WhisperTranscript } from "../lib/captionTypes";

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  sourceVideoPath: string;
  agentKind?: string;
}

export function SocialCutsStudio({
  open, onClose, projectId, sourceVideoPath, agentKind,
}: Props) {
  const [cuts, setCuts] = useState<SocialCut[]>([]);
  const [transcript, setTranscript] = useState<WhisperTranscript | null>(null);
  const [moments, setMoments] = useState<StandoutMoment[]>([]);
  const [selectedMomentIdxs, setSelectedMomentIdxs] = useState<Set<number>>(new Set());
  const [aspect, setAspect] = useState<CutAspect>("9:16");
  const [burnCaptions, setBurnCaptions] = useState(true);
  const [targetDuration, setTargetDuration] = useState(30);
  const [loaded, setLoaded] = useState(false);
  const [findingMoments, setFindingMoments] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<CutStatus | "all">("all");

  useEffect(() => {
    if (!open || !projectId) return;
    refresh();
    loadTranscript();
  }, [open, projectId]);

  const refresh = async () => {
    setLoaded(false);
    try {
      const list = await socialCutsService.list(projectId);
      setCuts(list);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoaded(true);
    }
  };

  const loadTranscript = async () => {
    try {
      const col = await captionsService.get(projectId);
      if (col?.transcript) setTranscript(col.transcript);
    } catch {/* ignore */}
  };

  const findStandoutMoments = async () => {
    if (!transcript) {
      setError("Whisper-transcript mangler. Kjør Caption Studio først for å transcribe video.");
      return;
    }
    setFindingMoments(true);
    setError(null);
    try {
      const summary = await executeScript("find_standout_moments", {
        transcript,
        targetDurationSec: targetDuration,
        minDurationSec: 15,
        maxDurationSec: 60,
        topN: 6,
      }, false);
      const r = summary.events.find(e => e.type === "result")?.value as {
        moments?: StandoutMoment[];
      } | undefined;
      if (r?.moments) {
        setMoments(r.moments);
        setSelectedMomentIdxs(new Set(r.moments.map((_, i) => i)));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setFindingMoments(false);
    }
  };

  const extractSelected = async () => {
    if (selectedMomentIdxs.size === 0 || !sourceVideoPath) return;
    setExtracting(true);
    setError(null);
    const selected = moments.filter((_, i) => selectedMomentIdxs.has(i));

    for (let i = 0; i < selected.length; i++) {
      const m = selected[i];
      setExtractProgress(`(${i + 1}/${selected.length}) ${m.text.slice(0, 40)}…`);
      try {
        // 1. Run extract_social_cut
        const summary = await executeScript("extract_social_cut", {
          videoPath: sourceVideoPath,
          startSec: m.startSec,
          endSec: m.endSec,
          aspectRatio: aspect,
          burnCaptions,
          transcriptSegments: transcript?.segments ?? [],
          faceAware: true,
        }, false);
        const result = summary.events.find(e => e.type === "result")?.value as {
          outputPath?: string; thumbnailPath?: string;
        } | undefined;

        // 2. Persistere i DB
        await socialCutsService.create({
          projectId,
          sourceVideoPath,
          startSec: m.startSec,
          endSec: m.endSec,
          aspectRatio: aspect,
          captionsBurnt: burnCaptions,
          outputPath: result?.outputPath,
          thumbnailPath: result?.thumbnailPath,
          standoutScore: m.score,
          transcriptSnippet: m.text,
          headline: m.text.slice(0, 100),
          agentKind,
        });
      } catch (e) {
        setError(`${m.text.slice(0, 30)}…: ${(e as Error).message}`);
      }
    }

    setExtracting(false);
    setExtractProgress("");
    setMoments([]);
    setSelectedMomentIdxs(new Set());
    await refresh();
  };

  const updateStatus = async (cut: SocialCut, status: CutStatus) => {
    try {
      await socialCutsService.update(cut.id, { status });
      setCuts(prev => prev.map(c => c.id === cut.id ? { ...c, status } : c));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const deleteCut = async (cut: SocialCut) => {
    if (!confirm("Slett denne cuten?")) return;
    try {
      await socialCutsService.delete(cut.id);
      setCuts(prev => prev.filter(c => c.id !== cut.id));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const toggleMoment = (idx: number) => {
    setSelectedMomentIdxs(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const filteredCuts = statusFilter === "all"
    ? cuts : cuts.filter(c => c.status === statusFilter);

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
            <ContentCutIcon sx={{ fontSize: 18, color: "#fff" }} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>
              Social Cuts Studio
            </div>
            <div style={{ fontSize: 10.5, color: ROLE_ROOM_BRAND.textTertiary,
                            display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{
                width: 8, height: 8, borderRadius: 4,
                background: ROLE_ROOM_BRAND.primaryLila,
              }} />
              {cuts.length} cuts · transkript-drevet repurpose
              {!transcript && (
                <span style={{ color: "#f0a500", marginLeft: 6 }}>
                  · ingen transcript (kjør Caption Studio først)
                </span>
              )}
            </div>
          </div>
        </div>

        <button onClick={onClose}
                style={{ background: "transparent", border: 0,
                          color: ROLE_ROOM_BRAND.textSecondary,
                          cursor: "pointer", padding: 4,
                          display: "inline-flex", alignItems: "center" }}>
          <CloseIcon />
        </button>
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
                     display: "flex", alignItems: "center", gap: 14,
                     flexWrap: "wrap" }}>
        <button onClick={() => void findStandoutMoments()}
                disabled={!transcript || findingMoments || !sourceVideoPath}
                style={{
                  background: findingMoments
                    ? "rgba(110,63,199,0.20)"
                    : ROLE_ROOM_BRAND.signatureGradient,
                  border: 0, color: "#fff",
                  padding: "7px 14px", fontSize: 11.5, fontWeight: 600,
                  borderRadius: 4,
                  cursor: findingMoments ? "wait"
                        : (!transcript || !sourceVideoPath) ? "not-allowed"
                        : "pointer",
                  opacity: (!transcript || !sourceVideoPath) ? 0.4 : 1,
                  display: "inline-flex", alignItems: "center", gap: 6,
                }}>
          <AutoFixHighIcon sx={{ fontSize: 13 }} />
          {findingMoments ? "Analyserer …" : "Find standout moments"}
        </button>

        <div style={{ display: "inline-flex", alignItems: "center",
                        gap: 6, fontSize: 11, color: ROLE_ROOM_BRAND.textSecondary }}>
          <span>Target:</span>
          {[15, 30, 60].map(d => (
            <button key={d}
                    onClick={() => setTargetDuration(d)}
                    style={{
                      background: targetDuration === d
                        ? ROLE_ROOM_BRAND.signatureGradient
                        : "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: targetDuration === d ? "#fff" : ROLE_ROOM_BRAND.textPrimary,
                      padding: "3px 8px", borderRadius: 3,
                      fontSize: 10.5, cursor: "pointer",
                    }}>{d}s</button>
          ))}
        </div>

        <div style={{ display: "inline-flex", alignItems: "center",
                        gap: 6, fontSize: 11, color: ROLE_ROOM_BRAND.textSecondary }}>
          <span>Aspect:</span>
          {(["9:16", "1:1", "4:5"] as CutAspect[]).map(a => (
            <button key={a}
                    onClick={() => setAspect(a)}
                    style={{
                      background: aspect === a
                        ? ROLE_ROOM_BRAND.signatureGradient
                        : "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: aspect === a ? "#fff" : ROLE_ROOM_BRAND.textPrimary,
                      padding: "3px 8px", borderRadius: 3,
                      fontSize: 10.5, cursor: "pointer",
                    }}>{a}</button>
          ))}
        </div>

        <label style={{ display: "inline-flex", alignItems: "center",
                          gap: 6, fontSize: 11, color: ROLE_ROOM_BRAND.textSecondary,
                          cursor: "pointer" }}>
          <input type="checkbox" checked={burnCaptions}
                 onChange={e => setBurnCaptions(e.target.checked)} />
          Burn captions
        </label>
      </div>

      {/* Standout-moments review (når moments er funnet) */}
      {moments.length > 0 && (
        <div onClick={e => e.stopPropagation()}
             style={{
               padding: 18,
               background: "rgba(160,48,192,0.06)",
               borderBottom: "1px solid rgba(160,48,192,0.18)",
             }}>
          <div style={{ display: "flex", justifyContent: "space-between",
                          alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700,
                            color: ROLE_ROOM_BRAND.textPrimary }}>
              {moments.length} foreslåtte moments ·
              {" "}{selectedMomentIdxs.size} valgt
            </div>
            <button onClick={() => void extractSelected()}
                    disabled={extracting || selectedMomentIdxs.size === 0}
                    style={{
                      background: extracting
                        ? "rgba(110,63,199,0.20)"
                        : ROLE_ROOM_BRAND.signatureGradient,
                      border: 0, color: "#fff",
                      padding: "7px 14px", fontSize: 11.5, fontWeight: 600,
                      borderRadius: 4,
                      cursor: extracting ? "wait"
                            : selectedMomentIdxs.size === 0 ? "not-allowed"
                            : "pointer",
                      opacity: selectedMomentIdxs.size === 0 ? 0.5 : 1,
                      display: "inline-flex", alignItems: "center", gap: 6,
                    }}>
              <ContentCutIcon sx={{ fontSize: 13 }} />
              {extracting ? `Extracting … ${extractProgress}` : `Extract ${selectedMomentIdxs.size}`}
            </button>
          </div>
          <div style={{ display: "grid",
                          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                          gap: 10 }}>
            {moments.map((m, i) => (
              <MomentCard key={i} moment={m}
                           selected={selectedMomentIdxs.has(i)}
                           onToggle={() => toggleMoment(i)} />
            ))}
          </div>
        </div>
      )}

      {/* Cuts grid */}
      <div onClick={e => e.stopPropagation()}
           style={{ flex: 1, overflowY: "auto", padding: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6,
                        marginBottom: 14, fontSize: 11,
                        color: ROLE_ROOM_BRAND.textSecondary }}>
          <span>Status:</span>
          {(["all", "extracted", "reviewed", "approved", "published"] as const).map(s => (
            <button key={s}
                    onClick={() => setStatusFilter(s)}
                    style={{
                      background: statusFilter === s
                        ? ROLE_ROOM_BRAND.signatureGradient
                        : "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: statusFilter === s ? "#fff" : ROLE_ROOM_BRAND.textPrimary,
                      padding: "3px 10px", borderRadius: 3,
                      fontSize: 10.5, cursor: "pointer",
                      textTransform: "capitalize",
                    }}>{s}</button>
          ))}
        </div>

        {!loaded && (
          <div style={{ textAlign: "center", padding: 30, fontSize: 11.5,
                          color: ROLE_ROOM_BRAND.textTertiary }}>Laster …</div>
        )}
        {loaded && filteredCuts.length === 0 && (
          <div style={{ textAlign: "center", padding: 50, fontSize: 12,
                          color: ROLE_ROOM_BRAND.textTertiary, lineHeight: 1.6 }}>
            {cuts.length === 0
              ? "Ingen cuts enda. Klikk 'Find standout moments' for å starte."
              : `Ingen ${statusFilter}-cuts.`}
          </div>
        )}
        {loaded && filteredCuts.length > 0 && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 14,
          }}>
            {filteredCuts.map(cut => (
              <CutCard key={cut.id} cut={cut}
                        onApprove={() => void updateStatus(cut, "approved")}
                        onReview={() => void updateStatus(cut, "reviewed")}
                        onPublish={() => void updateStatus(cut, "published")}
                        onDelete={() => void deleteCut(cut)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MomentCard({ moment, selected, onToggle }: {
  moment: StandoutMoment;
  selected: boolean;
  onToggle: () => void;
}) {
  const scorePct = Math.round(moment.score * 100);
  return (
    <div onClick={onToggle}
         style={{
           padding: 10, borderRadius: 4,
           background: selected
             ? "rgba(160,48,192,0.20)"
             : "rgba(255,255,255,0.04)",
           border: selected
             ? `1px solid ${ROLE_ROOM_BRAND.primaryLila}88`
             : "1px solid rgba(160,48,192,0.15)",
           cursor: "pointer",
         }}>
      <div style={{ display: "flex", alignItems: "center",
                      justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={selected} readOnly />
          <span style={{
            padding: "2px 7px", borderRadius: 3, fontSize: 10,
            fontWeight: 700,
            background: scorePct > 60
              ? "rgba(74,212,138,0.85)"
              : scorePct > 40
                ? "rgba(160,48,192,0.85)"
                : "rgba(160,48,192,0.40)",
            color: "#fff",
          }}>score {scorePct}</span>
        </div>
        <span style={{ fontSize: 10, color: ROLE_ROOM_BRAND.textTertiary }}>
          {moment.durationSec.toFixed(1)}s · {Math.floor(moment.startSec / 60)}:{String(Math.floor(moment.startSec % 60)).padStart(2, "0")}
        </span>
      </div>
      <div style={{ fontSize: 11.5, lineHeight: 1.4,
                      color: ROLE_ROOM_BRAND.textPrimary,
                      marginBottom: 6 }}>
        "{moment.text.length > 200
          ? moment.text.slice(0, 200) + "…"
          : moment.text}"
      </div>
      <div style={{ fontSize: 9.5, color: ROLE_ROOM_BRAND.textTertiary,
                      fontStyle: "italic" }}>
        {moment.reason}
      </div>
    </div>
  );
}

function CutCard({ cut, onApprove, onReview, onPublish, onDelete }: {
  cut: SocialCut;
  onApprove: () => void;
  onReview: () => void;
  onPublish: () => void;
  onDelete: () => void;
}) {
  const thumbSrc = cut.thumbnailPath
    ? convertFileSrc(cut.thumbnailPath) : null;
  const statusColor =
    cut.status === "published" ? "#4ad48a"
    : cut.status === "approved" ? "#7bdf4f"
    : cut.status === "reviewed" ? "#f0a500"
    : cut.status === "rejected" ? "#ef4f6f"
    : ROLE_ROOM_BRAND.textTertiary;

  return (
    <div style={{
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(160,48,192,0.18)",
      borderRadius: 6, overflow: "hidden",
    }}>
      <div style={{ position: "relative",
                      aspectRatio: cut.aspectRatio === "9:16" ? "9/16"
                        : cut.aspectRatio === "1:1" ? "1/1"
                        : cut.aspectRatio === "4:5" ? "4/5" : "16/9",
                      background: "rgba(0,0,0,0.5)" }}>
        {thumbSrc && (
          <img src={thumbSrc} alt=""
               style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        )}
        {!thumbSrc && (
          <div style={{ display: "flex", alignItems: "center",
                          justifyContent: "center", height: "100%",
                          color: ROLE_ROOM_BRAND.textTertiary,
                          fontSize: 11 }}>(ingen thumbnail)</div>
        )}
        <div style={{
          position: "absolute", top: 6, left: 6,
          padding: "2px 6px", borderRadius: 3, fontSize: 9,
          fontWeight: 700,
          background: "rgba(0,0,0,0.7)",
          color: statusColor,
          textTransform: "uppercase",
        }}>{cut.status}</div>
        {cut.standoutScore && (
          <div style={{
            position: "absolute", top: 6, right: 6,
            padding: "2px 6px", borderRadius: 3, fontSize: 9,
            fontWeight: 700,
            background: ROLE_ROOM_BRAND.signatureGradient,
            color: "#fff",
          }}>{Math.round(cut.standoutScore * 100)}</div>
        )}
        <div style={{
          position: "absolute", bottom: 6, right: 6,
          padding: "2px 6px", borderRadius: 3, fontSize: 9,
          background: "rgba(0,0,0,0.7)", color: "#fff",
        }}>{(cut.endSec - cut.startSec).toFixed(0)}s · {cut.aspectRatio}</div>
      </div>

      <div style={{ padding: 10 }}>
        <div style={{ fontSize: 11, lineHeight: 1.4,
                        color: ROLE_ROOM_BRAND.textPrimary,
                        marginBottom: 6,
                        overflow: "hidden", textOverflow: "ellipsis",
                        display: "-webkit-box",
                        WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
          {cut.headline || cut.transcriptSnippet
            || cut.outputPath?.split("/").pop()}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {cut.status === "extracted" && (
            <button onClick={onReview}
                    title="Markér som reviewed"
                    style={cardActionBtn("rgba(240,165,0,0.18)",
                                          "rgba(240,165,0,0.40)", "#f0a500")}>
              <VisibilityIcon sx={{ fontSize: 11 }} />
              Review
            </button>
          )}
          {(cut.status === "reviewed" || cut.status === "extracted") && (
            <button onClick={onApprove}
                    title="Godkjenn for publish"
                    style={cardActionBtn("rgba(74,212,138,0.18)",
                                          "rgba(74,212,138,0.40)", "#4ad48a")}>
              <CheckCircleOutlineIcon sx={{ fontSize: 11 }} />
              Approve
            </button>
          )}
          {cut.status === "approved" && (
            <button onClick={onPublish}
                    title="Markér som publisert"
                    style={cardActionBtn(ROLE_ROOM_BRAND.signatureGradient,
                                          "rgba(160,48,192,0.50)", "#fff")}>
              <PublishIcon sx={{ fontSize: 11 }} />
              Publish
            </button>
          )}
          <button onClick={onDelete}
                  title="Slett"
                  style={{ ...cardActionBtn("transparent", "transparent",
                                              "#ef4f6f"), flex: 0 }}>
            <DeleteOutlineIcon sx={{ fontSize: 11 }} />
          </button>
        </div>
      </div>
    </div>
  );
}

function cardActionBtn(bg: string, borderColor: string, color: string): React.CSSProperties {
  return {
    flex: 1, background: bg,
    border: `1px solid ${borderColor}`,
    color,
    padding: "4px 8px", fontSize: 10, fontWeight: 600,
    borderRadius: 3, cursor: "pointer",
    display: "inline-flex", alignItems: "center",
    justifyContent: "center", gap: 3,
  };
}

export default SocialCutsStudio;
