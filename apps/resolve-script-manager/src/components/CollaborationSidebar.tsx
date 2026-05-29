/**
 * CollaborationSidebar — Role Room-brandet sidebar i agent-editor for
 * real-time team-kommunikasjon med kontekst-forankrede kommentarer.
 *
 * Funksjoner:
 *  - Sticky-sidebar (kan vises fra header-knapp)
 *  - Polling-basert real-time (3 sek interval — V2 bytter til WebSocket)
 *  - Tråder + reply
 *  - @-mention parsing med auto-complete (V2)
 *  - Status-workflow: open → in-progress → resolved → wontfix
 *  - Klikk på kommentar med timestamp → callback til editor som
 *    hopper til den tiden
 *  - Filter: alle / open / @me / resolved
 *  - "Kommenter ved {time}"-knapp som pre-fyller anchor
 */

import { useEffect, useRef, useState } from "react";
import CloseIcon from "@mui/icons-material/Close";
import SendIcon from "@mui/icons-material/Send";
import RefreshIcon from "@mui/icons-material/Refresh";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ReplyIcon from "@mui/icons-material/Reply";
import AlternateEmailIcon from "@mui/icons-material/AlternateEmail";
import { editorCommentsService } from "../services/editorCommentsService";
import {
  formatTimestamp, priorityColor, statusColor,
} from "../lib/editorCommentTypes";
import type {
  EditorComment, AnchorType, CommentStatus,
  CommentPriority,
} from "../lib/editorCommentTypes";
import { ROLE_ROOM_BRAND } from "../lib/lowerThirdTypes";

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  agentKind?: string;
  /** Current playback-time eller -valgt-time, pre-fyller anchor på ny komment. */
  currentTimeSec?: number;
  /** Når brukeren klikker en komment med timestamp, hopper editoren til den tiden. */
  onJumpToTime?: (sec: number) => void;
}

type Filter = "all" | "open" | "mine" | "resolved";

export function CollaborationSidebar({
  open, onClose, projectId, agentKind,
  currentTimeSec, onJumpToTime,
}: Props) {
  const [comments, setComments] = useState<EditorComment[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("open");
  const [newCommentText, setNewCommentText] = useState("");
  const [replyToCommentId, setReplyToCommentId] = useState<string | null>(null);
  const [useTimestampAnchor, setUseTimestampAnchor] = useState(true);
  const [posting, setPosting] = useState(false);
  const [unreadMentions, setUnreadMentions] = useState(0);
  const pollIntervalRef = useRef<number | null>(null);
  const lastServerTimeRef = useRef<string | null>(null);

  // Hent kommentarer + start polling
  useEffect(() => {
    if (!open || !projectId) return;
    void refresh();
    void loadUnreadMentions();
    pollIntervalRef.current = window.setInterval(() => {
      void poll();
    }, 3000);
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [open, projectId]);

  const refresh = async () => {
    setLoaded(false);
    try {
      const res = await editorCommentsService.list(projectId);
      setComments(res.comments);
      lastServerTimeRef.current = res.serverTime;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoaded(true);
    }
  };

  const poll = async () => {
    if (!lastServerTimeRef.current) return;
    try {
      const res = await editorCommentsService.list(
        projectId, lastServerTimeRef.current);
      lastServerTimeRef.current = res.serverTime;
      if (res.comments.length === 0) return;
      // Merge: replace existing comments by id, append new
      setComments(prev => {
        const map = new Map(prev.map(c => [c.id, c]));
        for (const c of res.comments) {
          map.set(c.id, c);
        }
        const all = Array.from(map.values());
        all.sort((a, b) => {
          // Top-level first by createdAt asc; replies under their parent
          if (a.parentId === null && b.parentId === null) {
            return a.createdAt.localeCompare(b.createdAt);
          }
          if (a.parentId === null) return -1;
          if (b.parentId === null) return 1;
          return a.createdAt.localeCompare(b.createdAt);
        });
        return all;
      });
    } catch { /* polling skal ikke vise feil */ }
  };

  const loadUnreadMentions = async () => {
    try {
      const res = await editorCommentsService.listMentions(true);
      setUnreadMentions(res.unreadCount);
    } catch { /* ignore */ }
  };

  const handlePost = async () => {
    const text = newCommentText.trim();
    if (!text) return;
    setPosting(true);
    setError(null);
    try {
      // Detect priority-flags i tekst
      let priority: CommentPriority = "normal";
      if (text.includes("!urgent")) priority = "urgent";
      else if (text.includes("!high")) priority = "high";

      const anchorType: AnchorType =
        replyToCommentId ? "general"
        : useTimestampAnchor && currentTimeSec !== undefined ? "timestamp"
        : "general";
      const timestampSec = anchorType === "timestamp" ? currentTimeSec : undefined;

      await editorCommentsService.create({
        projectId,
        anchorType,
        timestampSec,
        agentKind,
        commentText: text,
        parentId: replyToCommentId ?? undefined,
        priority,
      });
      setNewCommentText("");
      setReplyToCommentId(null);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPosting(false);
    }
  };

  const handleStatusChange = async (comment: EditorComment, status: CommentStatus) => {
    try {
      await editorCommentsService.update(comment.id, { status });
      setComments(prev => prev.map(c =>
        c.id === comment.id ? { ...c, status } : c));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleDelete = async (comment: EditorComment) => {
    if (!confirm("Slett kommentaren?")) return;
    try {
      await editorCommentsService.delete(comment.id);
      setComments(prev => prev.filter(c => c.id !== comment.id
                                            && c.parentId !== comment.id));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  // Filtrer + bygg tråder
  const filteredComments = comments.filter(c => {
    if (c.parentId !== null) return false; // only top-level for liste
    if (filter === "open") return c.status === "open" || c.status === "in_progress";
    if (filter === "resolved") return c.status === "resolved" || c.status === "wontfix";
    if (filter === "mine") {
      // Krever ikke @mention-detection mot egen userId pga kompleksitet —
      // i V1: vis kommentarer hvor jeg er assignedTo eller authorId.
      // Faktisk @mention-detection kommer i V2.
      return false; // disabled for V1 — vis "Inboks (V2)"
    }
    return true;
  });

  const getReplies = (parentId: string) =>
    comments.filter(c => c.parentId === parentId);

  if (!open) return null;

  return (
    <div onClick={onClose}
         style={{
           position: "fixed", inset: 0, zIndex: 5800,
           background: "rgba(8,4,20,0.55)",
           display: "flex", justifyContent: "flex-end",
         }}>
      <div onClick={e => e.stopPropagation()}
           style={{
             width: "min(480px, 92vw)",
             height: "100vh",
             background: ROLE_ROOM_BRAND.surfaceGradient,
             borderLeft: `1px solid rgba(160,48,192,0.30)`,
             display: "flex", flexDirection: "column",
             color: ROLE_ROOM_BRAND.textPrimary,
             boxShadow: "-10px 0 40px rgba(0,0,0,0.5)",
           }}>

        {/* Header */}
        <div style={{
          padding: "12px 18px",
          borderBottom: "1px solid rgba(160,48,192,0.20)",
          background: "linear-gradient(180deg, rgba(20,12,40,0.85), rgba(10,5,24,0.85))",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 14,
              background: ROLE_ROOM_BRAND.signatureGradient,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}>
              <ReplyIcon sx={{ fontSize: 14, color: "#fff" }} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>
                Diskusjon
              </div>
              <div style={{ fontSize: 10, color: ROLE_ROOM_BRAND.textTertiary }}>
                {comments.filter(c => c.parentId === null).length} tråder ·
                {" "}live-polling
                {unreadMentions > 0 && (
                  <span style={{ color: ROLE_ROOM_BRAND.primaryLila,
                                   fontWeight: 600, marginLeft: 6 }}>
                    · {unreadMentions} @-mentions
                  </span>
                )}
              </div>
            </div>
          </div>
          <div style={{ display: "inline-flex", gap: 6 }}>
            <button onClick={() => void refresh()}
                    title="Oppdater"
                    style={miniBtn}>
              <RefreshIcon sx={{ fontSize: 13 }} />
            </button>
            <button onClick={onClose}
                    style={miniBtn}>
              <CloseIcon sx={{ fontSize: 14 }} />
            </button>
          </div>
        </div>

        {error && (
          <div style={{ padding: "8px 18px",
                          background: "rgba(239,79,111,0.15)",
                          color: "#ef4f6f", fontSize: 11 }}>
            {error}
          </div>
        )}

        {/* Filter-bar */}
        <div style={{
          padding: "8px 18px",
          borderBottom: "1px solid rgba(160,48,192,0.10)",
          display: "flex", gap: 4,
        }}>
          {(["open", "all", "mine", "resolved"] as Filter[]).map(f => (
            <button key={f}
                    onClick={() => setFilter(f)}
                    style={{
                      background: filter === f
                        ? ROLE_ROOM_BRAND.signatureGradient
                        : "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: filter === f ? "#fff" : ROLE_ROOM_BRAND.textPrimary,
                      padding: "4px 10px", borderRadius: 3,
                      fontSize: 10.5, cursor: "pointer",
                      textTransform: "capitalize",
                    }}>
              {f === "mine" ? "@meg" : f === "all" ? "Alle" : f}
            </button>
          ))}
        </div>

        {/* Comments-list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px" }}>
          {!loaded && (
            <div style={{ textAlign: "center", padding: 30, fontSize: 11.5,
                            color: ROLE_ROOM_BRAND.textTertiary }}>Laster …</div>
          )}
          {loaded && filteredComments.length === 0 && (
            <div style={{ textAlign: "center", padding: 30, fontSize: 11.5,
                            color: ROLE_ROOM_BRAND.textTertiary, lineHeight: 1.6 }}>
              {filter === "open"
                ? "Ingen åpne tråder. Start en!"
                : filter === "resolved"
                  ? "Ingen løste tråder enda."
                  : filter === "mine"
                    ? "@meg-filter kommer i V2"
                    : "Ingen kommentarer enda."}
            </div>
          )}
          {filteredComments.map(c => (
            <CommentThread key={c.id}
                            comment={c}
                            replies={getReplies(c.id)}
                            onJumpToTime={onJumpToTime}
                            onStatusChange={(s) => void handleStatusChange(c, s)}
                            onReply={() => setReplyToCommentId(c.id)}
                            onDelete={() => void handleDelete(c)} />
          ))}
        </div>

        {/* Composer */}
        <div style={{
          padding: 14,
          borderTop: "1px solid rgba(160,48,192,0.20)",
          background: "rgba(0,0,0,0.3)",
        }}>
          {replyToCommentId && (
            <div style={{
              padding: "6px 10px", marginBottom: 6, borderRadius: 4,
              background: "rgba(160,48,192,0.10)",
              border: "1px solid rgba(160,48,192,0.20)",
              fontSize: 10.5, display: "flex",
              justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ color: ROLE_ROOM_BRAND.textSecondary }}>
                Svarer på tråd {replyToCommentId.slice(0, 6)} …
              </span>
              <button onClick={() => setReplyToCommentId(null)}
                      style={{ background: "transparent", border: 0,
                                color: ROLE_ROOM_BRAND.textTertiary,
                                cursor: "pointer", padding: 0,
                                display: "inline-flex" }}>
                <CloseIcon sx={{ fontSize: 12 }} />
              </button>
            </div>
          )}
          <textarea value={newCommentText}
                    onChange={e => setNewCommentText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        void handlePost();
                      }
                    }}
                    rows={3}
                    placeholder="Skriv kommentar … @navn for tagging, !urgent / !high for prioritet"
                    style={{
                      width: "100%",
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(160,48,192,0.18)",
                      borderRadius: 4, padding: "8px 10px",
                      color: ROLE_ROOM_BRAND.textPrimary, fontSize: 12,
                      resize: "vertical", minHeight: 60,
                      fontFamily: "inherit",
                    }} />
          <div style={{ display: "flex", justifyContent: "space-between",
                          alignItems: "center", marginTop: 6 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              {!replyToCommentId && currentTimeSec !== undefined && (
                <label style={{ display: "inline-flex", alignItems: "center",
                                  gap: 4, fontSize: 10.5,
                                  color: ROLE_ROOM_BRAND.textSecondary,
                                  cursor: "pointer" }}>
                  <input type="checkbox" checked={useTimestampAnchor}
                         onChange={e => setUseTimestampAnchor(e.target.checked)} />
                  <AccessTimeIcon sx={{ fontSize: 11 }} />
                  Forankre ved {formatTimestamp(currentTimeSec)}
                </label>
              )}
            </div>
            <button onClick={() => void handlePost()}
                    disabled={posting || !newCommentText.trim()}
                    style={{
                      background: posting || !newCommentText.trim()
                        ? "rgba(110,63,199,0.20)"
                        : ROLE_ROOM_BRAND.signatureGradient,
                      border: 0, color: "#fff",
                      padding: "6px 14px", fontSize: 11.5, fontWeight: 600,
                      borderRadius: 4,
                      cursor: posting || !newCommentText.trim()
                        ? "not-allowed" : "pointer",
                      display: "inline-flex", alignItems: "center", gap: 6,
                    }}>
              <SendIcon sx={{ fontSize: 12 }} />
              {posting ? "Sender …" : "Send (⌘↵)"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CommentThread({ comment, replies, onJumpToTime, onStatusChange, onReply, onDelete }: {
  comment: EditorComment;
  replies: EditorComment[];
  onJumpToTime?: (sec: number) => void;
  onStatusChange: (s: CommentStatus) => void;
  onReply: () => void;
  onDelete: () => void;
}) {
  const pColor = priorityColor(comment.priority);
  const sColor = statusColor(comment.status);
  const hasTimestamp = comment.timestampSec !== null;
  return (
    <div style={{
      padding: 12, marginBottom: 10, borderRadius: 6,
      background: comment.status === "resolved"
        ? "rgba(74,212,138,0.05)"
        : "rgba(255,255,255,0.03)",
      border: comment.status === "resolved"
        ? "1px solid rgba(74,212,138,0.20)"
        : "1px solid rgba(160,48,192,0.20)",
    }}>
      {/* Header-rad */}
      <div style={{ display: "flex", alignItems: "center", gap: 6,
                      marginBottom: 6 }}>
        <span style={{ fontSize: 11.5, fontWeight: 600,
                         color: ROLE_ROOM_BRAND.primaryLila }}>
          {comment.authorDisplayName}
        </span>
        <span style={{ fontSize: 9.5, color: ROLE_ROOM_BRAND.textTertiary }}>
          {new Date(comment.createdAt).toLocaleTimeString("nb", {
            hour: "2-digit", minute: "2-digit",
          })}
        </span>
        {hasTimestamp && comment.timestampSec !== null && (
          <button onClick={() => onJumpToTime?.(comment.timestampSec!)}
                  title="Hopp til denne tiden i editoren"
                  style={{
                    background: "rgba(160,48,192,0.18)",
                    border: "1px solid rgba(160,48,192,0.30)",
                    color: ROLE_ROOM_BRAND.textPrimary,
                    padding: "2px 8px", borderRadius: 3,
                    fontSize: 9.5, fontWeight: 600, cursor: "pointer",
                    display: "inline-flex", alignItems: "center", gap: 3,
                  }}>
            <PlayCircleOutlineIcon sx={{ fontSize: 10 }} />
            {formatTimestamp(comment.timestampSec)}
          </button>
        )}
        <span style={{ marginLeft: "auto", display: "inline-flex",
                         alignItems: "center", gap: 4 }}>
          {comment.priority !== "normal" && (
            <span style={{
              fontSize: 9, padding: "1px 5px", borderRadius: 3,
              background: pColor + "33",
              color: pColor,
              fontWeight: 600, textTransform: "uppercase",
            }}>
              {comment.priority}
            </span>
          )}
          <span style={{
            fontSize: 9, padding: "1px 5px", borderRadius: 3,
            background: sColor + "33",
            color: sColor,
            fontWeight: 600, textTransform: "uppercase",
          }}>
            {comment.status.replace("_", " ")}
          </span>
        </span>
      </div>

      {/* Comment-text */}
      <div style={{ fontSize: 12, lineHeight: 1.5,
                      color: ROLE_ROOM_BRAND.textPrimary,
                      whiteSpace: "pre-wrap",
                      marginBottom: 8 }}>
        {renderWithMentions(comment.commentText)}
      </div>

      {/* Actions-rad */}
      <div style={{ display: "flex", gap: 4, fontSize: 10 }}>
        <button onClick={onReply} style={actionBtn}>
          <ReplyIcon sx={{ fontSize: 10 }} /> Svar
        </button>
        {comment.status === "open" && (
          <button onClick={() => onStatusChange("in_progress")}
                  style={actionBtn}>
            Start
          </button>
        )}
        {comment.status === "open" || comment.status === "in_progress" ? (
          <button onClick={() => onStatusChange("resolved")}
                  style={{ ...actionBtn,
                            color: "#4ad48a",
                            borderColor: "rgba(74,212,138,0.30)" }}>
            <CheckCircleIcon sx={{ fontSize: 10 }} /> Resolve
          </button>
        ) : null}
        <button onClick={onDelete}
                style={{ ...actionBtn,
                          color: "#ef4f6f", marginLeft: "auto",
                          borderColor: "rgba(239,79,111,0.30)" }}>
          <DeleteOutlineIcon sx={{ fontSize: 10 }} />
        </button>
      </div>

      {/* Replies */}
      {replies.length > 0 && (
        <div style={{ marginTop: 8, marginLeft: 16,
                        borderLeft: `2px solid rgba(160,48,192,0.18)`,
                        paddingLeft: 10 }}>
          {replies.map(r => (
            <div key={r.id} style={{ marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center",
                              gap: 4, marginBottom: 2 }}>
                <span style={{ fontSize: 11, fontWeight: 600,
                                 color: ROLE_ROOM_BRAND.primaryLila }}>
                  {r.authorDisplayName}
                </span>
                <span style={{ fontSize: 9, color: ROLE_ROOM_BRAND.textTertiary }}>
                  {new Date(r.createdAt).toLocaleTimeString("nb", {
                    hour: "2-digit", minute: "2-digit",
                  })}
                </span>
              </div>
              <div style={{ fontSize: 11.5, lineHeight: 1.5,
                              color: ROLE_ROOM_BRAND.textPrimary,
                              whiteSpace: "pre-wrap" }}>
                {renderWithMentions(r.commentText)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Render kommentar-tekst med @mentions highlightet som lilla pills. */
function renderWithMentions(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(@(?:"[^"]+"|[a-zA-Z0-9_\-.]+))/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(text.slice(lastIdx, match.index));
    }
    const display = match[1].replace(/^@"?/, "").replace(/"$/, "");
    parts.push(
      <span key={key++} style={{
        background: "rgba(160,48,192,0.20)",
        color: ROLE_ROOM_BRAND.primaryLila,
        padding: "0 4px", borderRadius: 2,
        fontWeight: 600,
        display: "inline-flex", alignItems: "center", gap: 2,
      }}>
        <AlternateEmailIcon sx={{ fontSize: 10 }} />{display}
      </span>
    );
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < text.length) {
    parts.push(text.slice(lastIdx));
  }
  return parts.length === 0 ? text : parts;
}

const miniBtn: React.CSSProperties = {
  background: "transparent", border: 0,
  color: ROLE_ROOM_BRAND.textSecondary, cursor: "pointer",
  padding: 4, borderRadius: 3,
  display: "inline-flex", alignItems: "center",
};

const actionBtn: React.CSSProperties = {
  background: "transparent",
  border: "1px solid rgba(255,255,255,0.10)",
  color: ROLE_ROOM_BRAND.textSecondary,
  padding: "3px 8px", borderRadius: 3,
  fontSize: 10, fontWeight: 600, cursor: "pointer",
  display: "inline-flex", alignItems: "center", gap: 3,
};

export default CollaborationSidebar;
