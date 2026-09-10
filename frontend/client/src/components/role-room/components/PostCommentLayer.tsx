/**
 * PostCommentLayer — drop-in komponent for content production-UI som
 * lar klient + producer kommentere direkte på en post.
 *
 * Hektes inn under hver post-kort i marketing-plan / feed-plan /
 * content production-UI. Bruker samme role_room_editor_comments-tabell
 * som Post Agent's Collaboration Sidebar, slik at:
 *   - Klient ser kommentarer i web (denne komponenten)
 *   - Bjarne ser samme kommentarer i Tauri-app's CollaborationSidebar
 *
 * En kommentar pr (project_id, anchor_type, anchor_ref). anchor_ref
 * er typisk feed-plan-post-ID, marketing-plan-slice-ID, e.l.
 *
 * Real-time: polling 5 sek interval. Auth via `auth`-prop —
 * Bearer-token for team (Bjarne) eller client-portal-sessionToken
 * for klient (magic-link). Backend (resolveActor) skiller mellom dem.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export type CommentAnchorType =
  | 'content_post' | 'marketing_plan_post' | 'feed_plan_post'
  | 'gallery_image' | 'storyboard_frame' | 'timestamp'
  // Screenplay/manus-anker (matcher VALID_ANCHOR_TYPES i backend):
  | 'manuscript' | 'manuscript_scene' | 'screenplay_line' | 'beat';

export type CommentStatus = 'open' | 'in_progress' | 'resolved' | 'wontfix';
export type CommentPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface PostCommentItem {
  id: string;
  projectId: string;
  anchorType: CommentAnchorType | string;
  anchorRef: string | null;
  timestampSec?: number | null;
  commentText: string;
  parentId: string | null;
  status: CommentStatus;
  priority: CommentPriority;
  authorDisplayName: string;
  authorId: string | null;
  createdAt: string;
  updatedAt: string;
  replyCount: number;
}

/**
 * Auth-modus:
 *  - 'bearer'         → Bjarne/team. Sender Authorization: Bearer <token>.
 *  - 'client-portal'  → Klient via magic-link. Sender X-Client-Portal-Token.
 */
export type PostCommentAuth =
  | { kind: 'bearer'; token: string }
  | { kind: 'client-portal'; sessionToken: string };

interface Props {
  /** casting_projects.id som posten tilhører. */
  projectId: string;
  /** Hva slags ting kommenterer vi på? (matcher VALID_ANCHOR_TYPES). */
  anchorType: CommentAnchorType;
  /** Unik ref til posten — typisk feed-plan-post-id, marketing-slice-id. */
  anchorRef: string;
  /** Auth-modus — Bearer (team) eller client-portal (magic-link). */
  auth: PostCommentAuth;
  /** Optional: pre-fyll author-display-name (typisk client_name). */
  authorDisplayName?: string;
  /** Optional CSS-overrider. */
  className?: string;
  /** Vis kun X kommentarer som default; "vis alle" knapp for resten. */
  defaultVisibleCount?: number;
  /** Skjul composer (read-only mode). */
  readOnly?: boolean;
  /** Polling-interval i ms (default 5000). 0 = ingen polling. */
  pollingIntervalMs?: number;
  /** Base-URL for API (default /api/role-room). */
  apiBase?: string;
  /** Når en video er aktiv: nåværende avspillingstid (sekund).
   *  Composer får da en "Knytt til 0:32"-toggle som lagrer comment
   *  som timestamp-anchor i stedet for post-anchor. */
  currentTimeSec?: number | null;
  /** Når satt — timestamp-comment-badges blir klikkbare. */
  onSeek?: (sec: number) => void;
  /** Ved endring av timestamp-comments som rendres — for å vise
   *  markører på video-timeline. Liste sorteres etter sec. */
  onTimestampCommentsChanged?: (markers: Array<{ sec: number; label: string }>) => void;
  /** Called after a successful create/status update so parent indexes refresh. */
  onChanged?: () => void;
  /** Focus the composer when a newly selected annotation opens. */
  autoFocusComposer?: boolean;
  composerPlaceholder?: string;
}

function buildAuthHeaders(auth: PostCommentAuth): Record<string, string> {
  if (auth.kind === 'bearer') {
    return { Authorization: `Bearer ${auth.token}` };
  }
  return { 'X-Client-Portal-Token': auth.sessionToken };
}

export function PostCommentLayer({
  projectId, anchorType, anchorRef, auth, authorDisplayName,
  className, defaultVisibleCount = 3, readOnly = false,
  pollingIntervalMs = 5000,
  apiBase = '/api/role-room',
  currentTimeSec, onSeek, onTimestampCommentsChanged,
  onChanged, autoFocusComposer = false, composerPlaceholder,
}: Props) {
  const [attachToTimestamp, setAttachToTimestamp] = useState(false);
  const [comments, setComments] = useState<PostCommentItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedView, setExpandedView] = useState(false);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [draftAuthor, setDraftAuthor] = useState(authorDisplayName ?? '');
  const lastServerTimeRef = useRef<string | null>(null);

  const fetchComments = useCallback(async (since?: string): Promise<{
    comments: PostCommentItem[]; serverTime: string;
  } | null> => {
    try {
      const u = new URLSearchParams({ projectId });
      if (since) u.set('since', since);
      const res = await fetch(`${apiBase}/editor-comments?${u}`, {
        headers: buildAuthHeaders(auth),
      });
      if (!res.ok) {
        if (res.status === 401) setError('Sesjon utløpt — last siden på nytt');
        else setError(`HTTP ${res.status}`);
        return null;
      }
      return await res.json() as { comments: PostCommentItem[]; serverTime: string };
    } catch (e) {
      setError((e as Error).message);
      return null;
    }
  }, [projectId, apiBase, auth]);

  const belongsToThisPost = useCallback((c: PostCommentItem) => {
    if (c.anchorRef !== anchorRef) return false;
    return c.anchorType === anchorType || c.anchorType === 'timestamp';
  }, [anchorType, anchorRef]);

  const refresh = useCallback(async () => {
    const data = await fetchComments();
    if (!data) return;
    const forThis = data.comments.filter(belongsToThisPost);
    setComments(forThis);
    lastServerTimeRef.current = data.serverTime;
    setLoaded(true);
  }, [fetchComments, belongsToThisPost]);

  const poll = useCallback(async () => {
    const since = lastServerTimeRef.current;
    if (!since) return;
    const data = await fetchComments(since);
    if (!data) return;
    lastServerTimeRef.current = data.serverTime;
    if (data.comments.length === 0) return;
    setComments(prev => {
      const map = new Map(prev.map(c => [c.id, c]));
      for (const c of data.comments) {
        if (belongsToThisPost(c)) {
          map.set(c.id, c);
        }
      }
      return Array.from(map.values()).sort(
        (a, b) => a.createdAt.localeCompare(b.createdAt),
      );
    });
  }, [fetchComments, belongsToThisPost]);

  // Rapporter timestamp-markører til parent (PostVideoPreview)
  useEffect(() => {
    if (!onTimestampCommentsChanged) return;
    const markers = comments
      .filter(c => c.anchorType === 'timestamp' && typeof c.timestampSec === 'number')
      .map(c => ({
        sec: c.timestampSec as number,
        label: c.commentText.slice(0, 60),
      }))
      .sort((a, b) => a.sec - b.sec);
    onTimestampCommentsChanged(markers);
  }, [comments, onTimestampCommentsChanged]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (pollingIntervalMs <= 0) return;
    const id = window.setInterval(() => void poll(), pollingIntervalMs);
    return () => clearInterval(id);
  }, [poll, pollingIntervalMs]);

  const handlePost = async (parentId?: string) => {
    const text = (parentId ? replyDraft : draft).trim();
    if (!text) return;
    setPosting(true);
    setError(null);
    const useTimestamp = attachToTimestamp
      && typeof currentTimeSec === 'number'
      && currentTimeSec > 0;
    try {
      const res = await fetch(`${apiBase}/editor-comments`, {
        method: 'POST',
        headers: {
          ...buildAuthHeaders(auth),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          anchorType: useTimestamp ? 'timestamp' : anchorType,
          anchorRef,
          timestampSec: useTimestamp ? currentTimeSec : undefined,
          commentText: text,
          parentId,
          authorDisplayName: draftAuthor || undefined,
          priority: text.includes('!urgent') ? 'urgent'
            : text.includes('!high') ? 'high' : 'normal',
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (parentId) {
        setReplyDraft('');
        setReplyingTo(null);
      } else {
        setDraft('');
      }
      setAttachToTimestamp(false);
      await refresh();
      onChanged?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPosting(false);
    }
  };

  const handleStatus = async (commentId: string, status: 'open' | 'resolved') => {
    setError(null);
    try {
      const res = await fetch(`${apiBase}/editor-comments/${commentId}`, {
        method: 'PATCH',
        headers: {
          ...buildAuthHeaders(auth),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await refresh();
      onChanged?.();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const topLevelComments = comments.filter((comment) => comment.parentId == null);
  const visibleComments = expandedView
    ? topLevelComments
    : topLevelComments.slice(0, defaultVisibleCount);
  const hiddenCount = Math.max(0, topLevelComments.length - defaultVisibleCount);
  const unresolvedCount = topLevelComments.filter(
    c => c.status === 'open' || c.status === 'in_progress').length;

  return (
    <div className={className} style={baseSx}>
      <div style={headerSx}>
        <span style={titleSx}>
          {topLevelComments.length === 0
            ? 'Ingen kommentarer enda'
            : `${topLevelComments.length} ${topLevelComments.length === 1 ? 'tråd' : 'tråder'}`}
        </span>
        {unresolvedCount > 0 && (
          <span style={badgeSx}>{unresolvedCount} uløst</span>
        )}
      </div>

      {!loaded && (
        <div style={{ ...emptyStateSx }}>Laster …</div>
      )}

      {loaded && visibleComments.length > 0 && (
        <div style={listSx}>
          {visibleComments.map(c => {
            const replies = comments.filter((reply) => reply.parentId === c.id);
            return (
              <div key={c.id} style={threadSx}>
                <CommentRow
                  comment={c}
                  onStatus={(status) => void handleStatus(c.id, status)}
                  onReply={() => {
                    setReplyingTo((current) => current === c.id ? null : c.id);
                    setReplyDraft('');
                  }}
                  onSeek={onSeek}
                />
                {replies.map((reply) => (
                  <CommentRow key={reply.id} comment={reply} reply />
                ))}
                {replyingTo === c.id && !readOnly && (
                  <div style={replyComposerSx}>
                    <textarea
                      autoFocus
                      value={replyDraft}
                      onChange={(event) => setReplyDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                          setReplyingTo(null);
                          setReplyDraft('');
                        }
                        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                          event.preventDefault();
                          void handlePost(c.id);
                        }
                      }}
                      aria-label={`Svar til ${c.authorDisplayName}`}
                      rows={2}
                      placeholder="Skriv et svar …"
                      style={{ ...inputSx, minHeight: 44, resize: 'vertical' }}
                    />
                    <div style={composerActionsSx}>
                      <button onClick={() => setReplyingTo(null)} style={secondaryBtnSx}>Avbryt</button>
                      <button
                        onClick={() => void handlePost(c.id)}
                        disabled={posting || !replyDraft.trim()}
                        style={{ ...primaryBtnSx, opacity: posting || !replyDraft.trim() ? 0.4 : 1 }}
                      >Svar</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {hiddenCount > 0 && !expandedView && (
            <button onClick={() => setExpandedView(true)} style={expandBtnSx}>
              Vis {hiddenCount} flere
            </button>
          )}
        </div>
      )}

      {error && (
        <div style={errorSx}>{error}</div>
      )}

      {!readOnly && (
        <div style={composerSx}>
          {!authorDisplayName && (
            <input value={draftAuthor}
                   onChange={e => setDraftAuthor(e.target.value)}
                   placeholder="Ditt navn"
                   style={inputSx} />
          )}
          <textarea value={draft}
                    autoFocus={autoFocusComposer}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        void handlePost();
                      }
                    }}
                    rows={2}
                    placeholder={attachToTimestamp
                      ? `Skriv kommentar (knyttes til ${formatTime(currentTimeSec ?? 0)}) …`
                      : (composerPlaceholder ?? 'Skriv kommentar …')}
                    style={{ ...inputSx, minHeight: 50, resize: 'vertical' }} />
          {typeof currentTimeSec === 'number' && currentTimeSec > 0 && (
            <label style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 10.5, color: 'rgba(200,188,216,0.85)',
              cursor: 'pointer', marginTop: 2, marginBottom: 4,
            }}>
              <input type="checkbox" checked={attachToTimestamp}
                     onChange={(e) => setAttachToTimestamp(e.target.checked)} />
              Knytt til {formatTime(currentTimeSec)} i videoen
            </label>
          )}
          <div style={composerActionsSx}>
            <span style={hintSx}>
              ⌘↵ for å sende · !urgent / !high for prioritet
            </span>
            <button onClick={() => void handlePost()}
                    disabled={posting || !draft.trim()}
                    style={{
                      ...primaryBtnSx,
                      opacity: posting || !draft.trim() ? 0.4 : 1,
                      cursor: posting || !draft.trim() ? 'not-allowed' : 'pointer',
                    }}>
              {posting ? 'Sender …' : 'Send'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CommentRow({ comment, onStatus, onReply, onSeek, reply = false }: {
  comment: PostCommentItem;
  onStatus?: (status: 'open' | 'resolved') => void;
  onReply?: () => void;
  onSeek?: (sec: number) => void;
  reply?: boolean;
}) {
  const isResolved = comment.status === 'resolved' || comment.status === 'wontfix';
  const isTimestamp = comment.anchorType === 'timestamp'
    && typeof comment.timestampSec === 'number';
  return (
    <div style={{
      ...rowSx,
      ...(reply ? replyRowSx : {}),
      background: isResolved ? 'rgba(74,212,138,0.05)' : 'rgba(255,255,255,0.03)',
      borderColor: isResolved ? 'rgba(74,212,138,0.15)' : 'rgba(160,48,192,0.15)',
    }}>
      <div style={rowHeaderSx}>
        <span style={authorSx}>{comment.authorDisplayName}</span>
        {isTimestamp && (
          <button onClick={() => onSeek?.(comment.timestampSec as number)}
                  disabled={!onSeek}
                  title={onSeek ? `Hopp til ${formatTime(comment.timestampSec as number)}` : undefined}
                  style={{
                    background: 'rgba(160,48,192,0.22)',
                    border: '1px solid rgba(160,48,192,0.42)',
                    color: '#c8a8e8',
                    padding: '1px 6px', borderRadius: 3,
                    fontSize: 10, fontWeight: 700,
                    cursor: onSeek ? 'pointer' : 'default',
                  }}>
            ⏱ {formatTime(comment.timestampSec as number)}
          </button>
        )}
        <span style={timeSx}>
          {new Date(comment.createdAt).toLocaleString('nb', {
            day: '2-digit', month: 'short',
            hour: '2-digit', minute: '2-digit',
          })}
        </span>
        {comment.priority !== 'normal' && (
          <span style={{
            ...pillSx,
            background: priorityBg(comment.priority),
            color: priorityColor(comment.priority),
          }}>{comment.priority}</span>
        )}
        <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 4 }}>
          <span style={{
            ...pillSx,
            background: statusBg(comment.status),
            color: statusColor(comment.status),
          }}>
            {comment.status.replace('_', ' ')}
          </span>
          {!reply && onStatus && (
            <button
              onClick={() => onStatus(isResolved ? 'open' : 'resolved')}
              style={resolveBtnSx}
              title={isResolved ? 'Gjenåpne tråden' : 'Marker som løst'}
            >
              {isResolved ? '↺' : '✓'}
            </button>
          )}
        </span>
      </div>
      <div style={textSx}>{comment.commentText}</div>
      {!reply && onReply && (
        <button onClick={onReply} style={replyBtnSx}>
          Svar{comment.replyCount > 0 ? ` (${comment.replyCount})` : ''}
        </button>
      )}
    </div>
  );
}

// ──────────────── Styling — matches Role Room dark-lilla brand ────────────────

const baseSx: React.CSSProperties = {
  marginTop: 12, padding: 10,
  background: 'rgba(20,12,40,0.55)',
  border: '1px solid rgba(160,48,192,0.20)',
  borderRadius: 6,
  color: 'rgba(232,224,240,0.95)',
  fontFamily: "system-ui, -apple-system, 'Helvetica Neue', sans-serif",
  fontSize: 12,
};

const headerSx: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  fontSize: 11, marginBottom: 8,
};

const titleSx: React.CSSProperties = {
  fontWeight: 600, color: 'rgba(200,188,216,0.9)',
};

const badgeSx: React.CSSProperties = {
  padding: '2px 8px', borderRadius: 999,
  background: 'rgba(160,48,192,0.25)',
  color: '#c8a8e8', fontSize: 10, fontWeight: 600,
};

const listSx: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 6,
  marginBottom: 8,
};

const threadSx: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 5,
};

const rowSx: React.CSSProperties = {
  padding: 8, borderRadius: 4,
  border: '1px solid',
};

const replyRowSx: React.CSSProperties = {
  marginLeft: 18,
  borderLeftWidth: 2,
  background: 'rgba(255,255,255,0.018)',
};

const replyComposerSx: React.CSSProperties = {
  marginLeft: 18,
  padding: 8,
  borderLeft: '2px solid rgba(160,48,192,0.25)',
};

const rowHeaderSx: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  marginBottom: 4,
};

const authorSx: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: '#a030c0',
};

const timeSx: React.CSSProperties = {
  fontSize: 9.5, color: 'rgba(168,156,184,0.7)',
};

const pillSx: React.CSSProperties = {
  fontSize: 9, padding: '1px 6px', borderRadius: 3,
  fontWeight: 600, textTransform: 'uppercase',
};

const textSx: React.CSSProperties = {
  fontSize: 11.5, lineHeight: 1.4,
  color: 'rgba(232,224,240,0.92)',
  whiteSpace: 'pre-wrap',
};

const resolveBtnSx: React.CSSProperties = {
  background: 'rgba(74,212,138,0.18)',
  border: '1px solid rgba(74,212,138,0.30)',
  color: '#4ad48a', borderRadius: 3,
  padding: '0 6px', fontSize: 10, fontWeight: 700,
  cursor: 'pointer',
};

const replyBtnSx: React.CSSProperties = {
  marginTop: 6, padding: 0,
  border: 0, background: 'transparent',
  color: '#c8a8e8', fontSize: 10.5, fontWeight: 600,
  cursor: 'pointer',
};

const secondaryBtnSx: React.CSSProperties = {
  border: 0, background: 'transparent', color: 'rgba(200,188,216,0.8)',
  fontSize: 10.5, cursor: 'pointer',
};

const composerSx: React.CSSProperties = {
  marginTop: 6, paddingTop: 8,
  borderTop: '1px solid rgba(160,48,192,0.12)',
};

const composerActionsSx: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between',
  alignItems: 'center', marginTop: 4,
};

const hintSx: React.CSSProperties = {
  fontSize: 9, color: 'rgba(168,156,184,0.7)',
};

const inputSx: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(160,48,192,0.18)',
  borderRadius: 3, padding: '6px 8px',
  color: 'rgba(232,224,240,0.95)', fontSize: 11.5,
  fontFamily: 'inherit', marginBottom: 4,
};

const primaryBtnSx: React.CSSProperties = {
  background: 'linear-gradient(135deg, #6e3fc7, #a030c0)',
  border: 0, color: '#fff',
  padding: '5px 12px', fontSize: 11, fontWeight: 600,
  borderRadius: 3,
};

const expandBtnSx: React.CSSProperties = {
  background: 'transparent',
  border: '1px dashed rgba(160,48,192,0.30)',
  color: 'rgba(200,188,216,0.9)',
  padding: '4px 10px', fontSize: 10.5, fontWeight: 600,
  borderRadius: 3, cursor: 'pointer',
  alignSelf: 'flex-start',
};

const emptyStateSx: React.CSSProperties = {
  fontSize: 10.5, color: 'rgba(168,156,184,0.7)',
  fontStyle: 'italic',
};

const errorSx: React.CSSProperties = {
  padding: 6, borderRadius: 3,
  background: 'rgba(239,79,111,0.10)',
  color: '#ef4f6f', fontSize: 10.5,
  marginBottom: 6,
};

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function priorityBg(p: CommentPriority): string {
  switch (p) {
    case 'urgent': return 'rgba(239,79,111,0.20)';
    case 'high': return 'rgba(240,165,0,0.20)';
    default: return 'rgba(160,48,192,0.20)';
  }
}

function priorityColor(p: CommentPriority): string {
  switch (p) {
    case 'urgent': return '#ef4f6f';
    case 'high': return '#f0a500';
    default: return '#a030c0';
  }
}

function statusBg(s: CommentStatus): string {
  switch (s) {
    case 'resolved': return 'rgba(74,212,138,0.18)';
    case 'in_progress': return 'rgba(240,165,0,0.18)';
    case 'wontfix': return 'rgba(168,156,184,0.15)';
    default: return 'rgba(160,48,192,0.18)';
  }
}

function statusColor(s: CommentStatus): string {
  switch (s) {
    case 'resolved': return '#4ad48a';
    case 'in_progress': return '#f0a500';
    case 'wontfix': return '#a89cb8';
    default: return '#a030c0';
  }
}

export default PostCommentLayer;
