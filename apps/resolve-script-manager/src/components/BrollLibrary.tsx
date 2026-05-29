/**
 * BrollLibrary — Role Room-brandet B-roll-bibliotek for et prosjekt.
 *
 * Funksjoner:
 *  - Grid med thumbnails (vision-AI-genererte) + analyse-status
 *  - Hover → autoplay 3-sek preview-MP4
 *  - Klikk → full preview-modal med tag-editor, vision-output og slett
 *  - "+ Legg til klipp": fil-dialog → kjør preview-script → kjør
 *    vision-analyse → vises ferdig i grid
 *  - Søk på tags
 *  - Sort: relevans (default) / dato / mest brukt
 */

import { useEffect, useRef, useState } from "react";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { convertFileSrc } from "@tauri-apps/api/core";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import VideoLibraryIcon from "@mui/icons-material/VideoLibrary";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import SearchIcon from "@mui/icons-material/Search";
import SortIcon from "@mui/icons-material/Sort";
import { brollService, getPostAgentBaseUrlForScripts, getBearerForScripts } from "../services/brollService";
import { executeScript } from "../api";
import type { BrollClip } from "../lib/brollTypes";
import { ROLE_ROOM_BRAND } from "../lib/lowerThirdTypes";

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  /** Hvis åpnet fra en agent: bruk konteksten for å rangere klipp +
   * vise match-badges. Tom = generisk library-view. */
  agentContext?: {
    agentKind: string;
    agentName: string;       // f.eks. "Event Agent"
    chapterId: string;
    chapterLabel: string;    // f.eks. "Keynote"
    contextTags: string[];   // chapter.id + priorityHint + look.tags
  };
}

type SortMode = "relevance" | "context" | "date" | "usage";

export function BrollLibrary({ open, onClose, projectId, agentContext }: Props) {
  const [clips, setClips] = useState<BrollClip[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedClip, setSelectedClip] = useState<BrollClip | null>(null);
  const [hoveredClipId, setHoveredClipId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  // Default sort = "context" hvis vi har agent-context, ellers "relevance"
  const [sortMode, setSortMode] = useState<SortMode>(
    agentContext ? "context" : "relevance",
  );
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");

  // Bygg context-tags-set for kjapp lookup
  const contextTagSet = new Set(
    (agentContext?.contextTags ?? []).map(t => t.toLowerCase()),
  );

  /** Beregne match-score for ett klipp mot agent-context.
   * Samme formel som backend /suggest, men uten universal-læring
   * (det er server-side). 0-1 score. */
  const matchScore = (clip: BrollClip): number => {
    if (!agentContext || contextTagSet.size === 0) return 0;
    const clipTags = (clip.tags || []).map(t => t.toLowerCase());
    if (clipTags.length === 0) return 0;
    const overlap = clipTags.filter(t => contextTagSet.has(t)).length;
    return overlap / Math.max(contextTagSet.size, clipTags.length);
  };

  useEffect(() => {
    if (!open || !projectId) return;
    refresh();
  }, [open, projectId]);

  const refresh = async () => {
    setLoaded(false);
    try {
      const list = await brollService.list(projectId);
      setClips(list);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoaded(true);
    }
  };

  const handleAddClip = async () => {
    const picked = await openFileDialog({
      multiple: true,
      title: "Velg B-roll-klipp",
      filters: [{
        name: "Video",
        extensions: ["mp4", "mov", "mkv", "m4v", "avi"],
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
        // Steg 1: registrer i DB
        const reg = await brollService.register({ projectId, filePath });

        // Steg 2: ekstrakt preview (raskere først så user kan se thumbnail)
        try {
          const previewResult = await executeScript("extract_broll_preview", {
            videoPath: filePath,
          }, false);
          const pv = previewResult.events.find(e => e.type === "result")?.value as {
            previewVideoPath?: string; previewThumbnailPath?: string;
            durationSec?: number;
          } | undefined;
          if (pv) {
            await brollService.setAnalysis(reg.id, {
              previewVideoPath: pv.previewVideoPath,
              previewThumbnailPath: pv.previewThumbnailPath,
              analysisStatus: "analyzing",
            });
          }
        } catch (e) {
          console.warn("[broll] preview-extract feilet:", e);
        }

        // Steg 3: vision-analyse
        const baseUrl = getPostAgentBaseUrlForScripts();
        const bearer = getBearerForScripts();
        if (bearer && baseUrl) {
          try {
            const analysisResult = await executeScript("analyze_broll_clip", {
              videoPath: filePath,
              postAgentBaseUrl: baseUrl,
              bearerToken: bearer,
            }, false);
            const av = analysisResult.events.find(e => e.type === "result")?.value as {
              visionAnalysis?: Record<string, unknown>;
              tags?: string[];
            } | undefined;
            if (av?.visionAnalysis) {
              await brollService.setAnalysis(reg.id, {
                visionAnalysis: av.visionAnalysis,
                tags: av.tags,
                analysisStatus: "ready",
              });
            } else {
              await brollService.setAnalysis(reg.id, {
                analysisStatus: "failed",
                analysisError: "Vision-analyse returnerte ingen output",
              });
            }
          } catch (e) {
            await brollService.setAnalysis(reg.id, {
              analysisStatus: "failed",
              analysisError: (e as Error).message,
            });
          }
        } else {
          await brollService.setAnalysis(reg.id, {
            analysisStatus: "failed",
            analysisError: "Ikke innlogget — vision-analyse skipped",
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

  const handleReanalyze = async (clip: BrollClip) => {
    const baseUrl = getPostAgentBaseUrlForScripts();
    const bearer = getBearerForScripts();
    if (!bearer || !baseUrl) {
      setError("Ikke innlogget");
      return;
    }
    try {
      await brollService.setAnalysis(clip.id, { analysisStatus: "analyzing" });
      await refresh();
      const result = await executeScript("analyze_broll_clip", {
        videoPath: clip.filePath,
        postAgentBaseUrl: baseUrl,
        bearerToken: bearer,
      }, false);
      const av = result.events.find(e => e.type === "result")?.value as {
        visionAnalysis?: Record<string, unknown>; tags?: string[];
      } | undefined;
      if (av?.visionAnalysis) {
        await brollService.setAnalysis(clip.id, {
          visionAnalysis: av.visionAnalysis,
          tags: av.tags,
          analysisStatus: "ready",
        });
      }
      await refresh();
    } catch (e) {
      await brollService.setAnalysis(clip.id, {
        analysisStatus: "failed",
        analysisError: (e as Error).message,
      });
      await refresh();
    }
  };

  const handleDelete = async (clip: BrollClip) => {
    if (!confirm(`Slett "${clip.filePath.split("/").pop()}"?`)) return;
    try {
      await brollService.delete(clip.id);
      setClips(prev => prev.filter(c => c.id !== clip.id));
      if (selectedClip?.id === clip.id) setSelectedClip(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleUpdateTags = async (clip: BrollClip, tags: string[]) => {
    try {
      await brollService.update(clip.id, { tags });
      setClips(prev => prev.map(c =>
        c.id === clip.id ? { ...c, tags } : c));
      if (selectedClip?.id === clip.id) {
        setSelectedClip({ ...selectedClip, tags });
      }
    } catch (e) {
      setError((e as Error).message);
    }
  };

  // Filter + sort
  const filteredClips = clips
    .filter(c => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return c.tags.some(t => t.toLowerCase().includes(q))
        || c.userDescription?.toLowerCase().includes(q)
        || c.filePath.toLowerCase().includes(q)
        || c.visionAnalysis?.summary?.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      switch (sortMode) {
        case "date":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "usage":
          return (b.usageCount - a.usageCount)
            || (b.approvalCount - a.approvalCount);
        case "context":
          return matchScore(b) - matchScore(a)
            || (b.approvalCount - a.approvalCount);
        case "relevance":
        default:
          return (b.approvalCount - b.rejectionCount)
            - (a.approvalCount - a.rejectionCount);
      }
    });

  // For agent-context: tell antall klipp som matcher
  const matchingClipsCount = agentContext
    ? clips.filter(c => matchScore(c) > 0.3).length : 0;

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
            <VideoLibraryIcon sx={{ fontSize: 18, color: "#fff" }} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>B-roll Library</div>
            <div style={{ fontSize: 10.5, color: ROLE_ROOM_BRAND.textTertiary,
                            display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{
                width: 8, height: 8, borderRadius: 4,
                background: ROLE_ROOM_BRAND.primaryLila,
              }} />
              {clips.length} klipp · vision-AI-tagging · universal læring
            </div>
          </div>
        </div>

        <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => void handleAddClip()}
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
            {uploading ? `Analyserer … ${uploadProgress}` : "Legg til klipp"}
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
             style={{
               padding: "8px 22px",
               background: "rgba(239,79,111,0.15)",
               color: "#ef4f6f", fontSize: 11,
             }}>{error}</div>
      )}

      {/* Agent-context banner */}
      {agentContext && (
        <div onClick={e => e.stopPropagation()}
             style={{
               padding: "8px 22px",
               background: "rgba(160,48,192,0.10)",
               borderBottom: "1px solid rgba(160,48,192,0.20)",
               display: "flex", alignItems: "center", gap: 10,
               fontSize: 11,
             }}>
          <span style={{ color: ROLE_ROOM_BRAND.textTertiary,
                            fontWeight: 600 }}>For:</span>
          <span style={{
            padding: "2px 8px", borderRadius: 999,
            background: ROLE_ROOM_BRAND.signatureGradient, color: "#fff",
            fontWeight: 600,
          }}>{agentContext.agentName}</span>
          <span style={{ color: ROLE_ROOM_BRAND.textTertiary }}>·</span>
          <span style={{
            padding: "2px 8px", borderRadius: 999,
            background: "rgba(160,48,192,0.20)",
            border: "1px solid rgba(160,48,192,0.30)",
            color: ROLE_ROOM_BRAND.textPrimary,
          }}>{agentContext.chapterLabel}</span>
          <span style={{ color: ROLE_ROOM_BRAND.textTertiary }}>·</span>
          {agentContext.contextTags.slice(0, 5).map(t => (
            <span key={t} style={{
              fontSize: 10, padding: "2px 6px", borderRadius: 999,
              background: "rgba(255,255,255,0.04)",
              color: ROLE_ROOM_BRAND.textSecondary,
            }}>{t}</span>
          ))}
          <span style={{ marginLeft: "auto",
                            color: matchingClipsCount > 0
                              ? "#4ad48a" : ROLE_ROOM_BRAND.textTertiary,
                            fontWeight: 600 }}>
            {matchingClipsCount > 0
              ? `${matchingClipsCount} av ${clips.length} matcher`
              : "Ingen klipp matcher konteksten"}
          </span>
        </div>
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
        <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <SortIcon sx={{ fontSize: 14, color: ROLE_ROOM_BRAND.textTertiary }} />
          {([
            ...(agentContext ? ["context"] : []),
            "relevance", "date", "usage",
          ] as SortMode[]).map(m => (
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
              {m === "context" ? `For ${agentContext?.chapterLabel ?? ""}`
                : m === "relevance" ? "Relevans"
                : m === "date" ? "Dato" : "Bruk"}
            </button>
          ))}
        </div>
      </div>

      {/* Main: grid */}
      <div onClick={e => e.stopPropagation()}
           style={{ flex: 1, overflowY: "auto", padding: 22 }}>
        {!loaded && (
          <div style={{ textAlign: "center", padding: 40, fontSize: 12,
                          color: ROLE_ROOM_BRAND.textTertiary }}>Laster …</div>
        )}
        {loaded && filteredClips.length === 0 && (
          <div style={{ textAlign: "center", padding: 60, fontSize: 12,
                          color: ROLE_ROOM_BRAND.textTertiary, lineHeight: 1.6 }}>
            {clips.length === 0
              ? "Ingen klipp enda. Klikk \"Legg til klipp\" for å starte."
              : `Ingen treff for "${searchQuery}". Prøv andre søkeord.`}
          </div>
        )}
        {loaded && filteredClips.length > 0 && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 14,
          }}>
            {filteredClips.map(c => (
              <ClipCard key={c.id} clip={c}
                        hovered={hoveredClipId === c.id}
                        onHover={() => setHoveredClipId(c.id)}
                        onLeave={() => setHoveredClipId(null)}
                        onClick={() => setSelectedClip(c)}
                        onDelete={() => void handleDelete(c)}
                        contextMatchScore={agentContext ? matchScore(c) : undefined} />
            ))}
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selectedClip && (
        <ClipDetailPanel clip={selectedClip}
                          onClose={() => setSelectedClip(null)}
                          onReanalyze={() => void handleReanalyze(selectedClip)}
                          onUpdateTags={tags =>
                            void handleUpdateTags(selectedClip, tags)} />
      )}
    </div>
  );
}

function ClipCard({ clip, hovered, onHover, onLeave, onClick, onDelete, contextMatchScore }: {
  clip: BrollClip;
  hovered: boolean;
  onHover: () => void;
  onLeave: () => void;
  onClick: () => void;
  onDelete: () => void;
  contextMatchScore?: number;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const thumbSrc = clip.previewThumbnailPath
    ? convertFileSrc(clip.previewThumbnailPath) : null;
  const previewSrc = clip.previewVideoPath
    ? convertFileSrc(clip.previewVideoPath) : null;

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (hovered) { v.currentTime = 0; void v.play(); }
    else { v.pause(); v.currentTime = 0; }
  }, [hovered]);

  const status = clip.analysisStatus;
  const statusColor = status === "ready" ? "#4ad48a"
    : status === "failed" ? "#ef4f6f"
    : status === "analyzing" ? "#f0a500"
    : ROLE_ROOM_BRAND.textTertiary;

  return (
    <div onClick={onClick}
         onMouseEnter={onHover}
         onMouseLeave={onLeave}
         style={{
           background: "rgba(255,255,255,0.04)",
           border: "1px solid rgba(160,48,192,0.18)",
           borderRadius: 6, overflow: "hidden",
           cursor: "pointer",
           transition: "border-color 0.15s",
           position: "relative",
         }}>
      {/* Thumbnail / preview */}
      <div style={{ position: "relative", aspectRatio: "16/9",
                      background: "rgba(0,0,0,0.5)", overflow: "hidden" }}>
        {thumbSrc && !hovered && (
          <img src={thumbSrc} alt=""
               style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        )}
        {previewSrc && hovered && (
          <video ref={videoRef} src={previewSrc}
                 muted loop playsInline
                 style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        )}
        {!thumbSrc && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            height: "100%", color: ROLE_ROOM_BRAND.textTertiary, fontSize: 11,
          }}>
            {status === "analyzing" ? "Analyserer …" : "Ingen preview"}
          </div>
        )}
        {/* Status badge */}
        <div style={{
          position: "absolute", top: 6, left: 6,
          padding: "2px 6px", borderRadius: 3, fontSize: 9,
          fontWeight: 600,
          background: "rgba(0,0,0,0.7)",
          color: statusColor,
          textTransform: "uppercase",
        }}>{status}</div>
        {/* Context-match badge (når åpnet fra agent) */}
        {contextMatchScore !== undefined && contextMatchScore > 0.3 && (
          <div style={{
            position: "absolute", top: 6, left: 70,
            padding: "2px 6px", borderRadius: 3, fontSize: 9,
            fontWeight: 700,
            background: contextMatchScore > 0.6
              ? "rgba(74,212,138,0.85)"
              : "rgba(160,48,192,0.85)",
            color: "#fff",
          }}>match {Math.round(contextMatchScore * 100)}%</div>
        )}
        {/* Duration */}
        {clip.durationSec > 0 && (
          <div style={{
            position: "absolute", bottom: 6, right: 6,
            padding: "2px 6px", borderRadius: 3, fontSize: 9,
            background: "rgba(0,0,0,0.7)", color: "#fff",
          }}>{Math.floor(clip.durationSec)}s</div>
        )}
        {/* Delete-knapp */}
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }}
                title="Slett"
                style={{
                  position: "absolute", top: 6, right: 6,
                  width: 22, height: 22, borderRadius: 11,
                  background: "rgba(0,0,0,0.65)",
                  border: 0, cursor: "pointer",
                  display: "inline-flex", alignItems: "center",
                  justifyContent: "center", color: "#ef4f6f",
                }}>
          <DeleteOutlineIcon sx={{ fontSize: 12 }} />
        </button>
      </div>
      {/* Tags + summary */}
      <div style={{ padding: 8 }}>
        <div style={{ fontSize: 10.5, lineHeight: 1.4,
                        color: ROLE_ROOM_BRAND.textSecondary,
                        overflow: "hidden", textOverflow: "ellipsis",
                        display: "-webkit-box",
                        WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
          {clip.visionAnalysis?.summary
            || clip.userDescription
            || clip.filePath.split("/").pop()}
        </div>
        {clip.tags.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 3,
                          marginTop: 6 }}>
            {clip.tags.slice(0, 4).map(t => (
              <span key={t} style={{
                fontSize: 9, padding: "1px 5px",
                borderRadius: 3,
                background: "rgba(160,48,192,0.18)",
                color: ROLE_ROOM_BRAND.textPrimary,
              }}>{t}</span>
            ))}
            {clip.tags.length > 4 && (
              <span style={{ fontSize: 9, opacity: 0.6 }}>
                +{clip.tags.length - 4}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ClipDetailPanel({ clip, onClose, onReanalyze, onUpdateTags }: {
  clip: BrollClip;
  onClose: () => void;
  onReanalyze: () => void;
  onUpdateTags: (tags: string[]) => void;
}) {
  const [tagsInput, setTagsInput] = useState(clip.tags.join(", "));
  const previewSrc = clip.previewVideoPath
    ? convertFileSrc(clip.previewVideoPath) : null;
  const va = clip.visionAnalysis;

  return (
    <div onClick={onClose}
         style={{
           position: "fixed", inset: 0, zIndex: 5900,
           background: "rgba(8,4,20,0.85)", backdropFilter: "blur(10px)",
           display: "flex", alignItems: "center", justifyContent: "center",
         }}>
      <div onClick={e => e.stopPropagation()}
           style={{
             width: "min(900px, 92vw)", maxHeight: "85vh",
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
              {clip.filePath.split("/").pop()}
            </div>
            <div style={{ fontSize: 10.5,
                            color: ROLE_ROOM_BRAND.textTertiary }}>
              {clip.durationSec.toFixed(1)}s
              {clip.width && clip.height && ` · ${clip.width}×${clip.height}`}
              {clip.fps && ` · ${clip.fps}fps`}
              {" · "}status: {clip.analysisStatus}
            </div>
          </div>
          <button onClick={onClose}
                  style={{ background: "transparent", border: 0,
                            color: ROLE_ROOM_BRAND.textSecondary,
                            cursor: "pointer", padding: 4 }}>
            <CloseIcon />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 18,
                        display: "grid", gridTemplateColumns: "1fr 1fr",
                        gap: 18 }}>
          {/* Left: preview */}
          <div>
            {previewSrc && (
              <video src={previewSrc} controls muted
                     style={{ width: "100%", borderRadius: 6,
                               aspectRatio: "16/9", objectFit: "cover",
                               background: "#000" }} />
            )}
            <div style={{ marginTop: 14 }}>
              <div style={sectionTitle}>EDIT TAGS</div>
              <textarea value={tagsInput}
                        onChange={e => setTagsInput(e.target.value)}
                        onBlur={() => {
                          const tags = tagsInput.split(",")
                            .map(t => t.trim())
                            .filter(t => t.length > 0);
                          onUpdateTags(tags);
                        }}
                        rows={3}
                        placeholder="komma-separert: coffee, morning, close-up …"
                        style={inputSx} />
            </div>
            <button onClick={onReanalyze}
                    style={{
                      marginTop: 10, width: "100%",
                      background: "rgba(110,63,199,0.25)",
                      border: "1px solid rgba(110,63,199,0.50)",
                      color: "#fff", padding: "7px 12px",
                      borderRadius: 4, fontSize: 11.5, fontWeight: 600,
                      cursor: "pointer",
                      display: "inline-flex", alignItems: "center",
                      justifyContent: "center", gap: 6,
                    }}>
              <AutoFixHighIcon sx={{ fontSize: 13 }} />
              Re-analyse med Claude vision
            </button>
          </div>

          {/* Right: vision-analyse-output */}
          <div>
            <div style={sectionTitle}>VISION-AI ANALYSE</div>
            {clip.analysisStatus === "failed" && clip.analysisError && (
              <div style={{ padding: 8, borderRadius: 4,
                              background: "rgba(239,79,111,0.10)",
                              color: "#ef4f6f", fontSize: 11,
                              marginBottom: 8 }}>{clip.analysisError}</div>
            )}
            {va?.summary && (
              <div style={kvBlock}>
                <KV label="Summary" value={va.summary} />
              </div>
            )}
            <div style={kvBlock}>
              <KV label="Scene" value={va?.scene ?? "—"} />
              <KV label="Location" value={va?.location ?? "—"} />
              <KV label="Time-of-day" value={va?.timeOfDay ?? "—"} />
              <KV label="Lighting" value={va?.lighting ?? "—"} />
              <KV label="Motion" value={va?.motion ?? "—"} />
              <KV label="Shot type" value={va?.shotType ?? "—"} />
              <KV label="People" value={
                va?.people
                  ? `Yes${va?.peopleCount ? ` (${va.peopleCount})` : ""}`
                  : "No"} />
            </div>
            {va?.mood && va.mood.length > 0 && (
              <div style={kvBlock}>
                <KV label="Mood" value={va.mood.join(", ")} />
              </div>
            )}
            {va?.objects && va.objects.length > 0 && (
              <div style={kvBlock}>
                <KV label="Objects" value={va.objects.join(", ")} />
              </div>
            )}
            {va?.suggestedFor && va.suggestedFor.length > 0 && (
              <div style={kvBlock}>
                <KV label="Suggested for" value={va.suggestedFor.join(", ")} />
              </div>
            )}
            {va?.colorPalette && va.colorPalette.length > 0 && (
              <div style={kvBlock}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={kvLabel}>Palette:</span>
                  {va.colorPalette.map((c, i) => (
                    <div key={i} style={{
                      width: 18, height: 18, borderRadius: 3,
                      background: c, border: "1px solid rgba(255,255,255,0.1)",
                    }} title={c} />
                  ))}
                </div>
              </div>
            )}
            <div style={{ marginTop: 12, padding: 8, borderRadius: 4,
                            background: "rgba(255,255,255,0.03)",
                            fontSize: 10, color: ROLE_ROOM_BRAND.textTertiary,
                            lineHeight: 1.5 }}>
              Stats: {clip.suggestionCount} suggestions ·
              {" "}{clip.approvalCount} approved ·
              {" "}{clip.rejectionCount} rejected ·
              {" "}{clip.usageCount} brukt
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <span style={kvLabel}>{label}: </span>
      <span style={{ fontSize: 11.5,
                       color: ROLE_ROOM_BRAND.textPrimary }}>{value}</span>
    </div>
  );
}

const kvLabel: React.CSSProperties = {
  fontSize: 10, color: ROLE_ROOM_BRAND.textTertiary,
  letterSpacing: 0.5, fontWeight: 600,
};

const kvBlock: React.CSSProperties = {
  padding: 8, borderRadius: 4,
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(160,48,192,0.10)",
  marginBottom: 8,
};

const inputSx: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(160,48,192,0.18)",
  borderRadius: 3, padding: "5px 8px",
  color: ROLE_ROOM_BRAND.textPrimary, fontSize: 11,
  resize: "vertical", minHeight: 60,
};

const sectionTitle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700,
  color: ROLE_ROOM_BRAND.textTertiary,
  marginBottom: 5, letterSpacing: 0.5,
};

export default BrollLibrary;
