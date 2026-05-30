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
  | 'gallery_image' | 'storyboard_frame';

export type CommentStatus = 'open' | 'in_progress' | 'resolved' | 'wontfix';
export type CommentPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface PostCommentItem {
  id: string;
  projectId: string;
  anchorType: CommentAnchorType | string;
  anchorRef: string | null;
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
}: Props) {
  const [comments, setComments] = useState<PostCommentItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedView, setExpandedView] = useState(false);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
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

  const refresh = useCallback(async () => {
    const data = await fetchComments();
    if (!data) return;
    // Filter til kun denne post-anchor-en
    const forThis = data.comments.filter(c =>
      c.anchorType === anchorType && c.anchorRef === anchorRef);
    setComments(forThis);
    lastServerTimeRef.current = data.serverTime;
    setLoaded(true);
  }, [fetchComments, anchorType, anchorRef]);

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
        if (c.anchorType === anchorType && c.anchorRef === anchorRef) {
          map.set(c.id, c);
        }
      }
      return Array.from(map.values()).sort(
        (a, b) => a.createdAt.localeCompare(b.createdAt),
      );
    });
  }, [fetchComments, anchorType, anchorRef]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (pollingIntervalMs <= 0) return;
    const id = window.setInterval(() => void poll(), pollingIntervalMs);
    return () => clearInterval(id);
  }, [poll, pollingIntervalMs]);

  const handlePost = async () => {
    const text = draft.trim();
    if (!text) return;
    setPosting(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/editor-comments`, {
        method: 'POST',
        headers: {
          ...buildAuthHeaders(auth),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          anchorType,
          anchorRef,
          commentText: text,
          authorDisplayName: draftAuthor || undefined,
          priority: text.includes('!urgent') ? 'urgent'
            : text.includes('!high') ? 'high' : 'normal',
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDraft('');
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPosting(false);
    }
  };

  const handleResolve = async (commentId: string) => {
    try {
      await fetch(`${apiBase}/editor-comments/${commentId}`, {
        method: 'PATCH',
        headers: {
          ...buildAuthHeaders(auth),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'resolved' }),
      });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const visibleComments = expandedView
    ? comments
    : comments.slice(0, defaultVisibleCount);
  const hiddenCount = Math.max(0, comments.length - defaultVisibleCount);
  const unresolvedCount = comments.filter(
    c => c.status === 'open' || c.status === 'in_progress').length;

  return (
    <div className={className} style={baseSx}>
      <div style={headerSx}>
        <span style={titleSx}>
          {comments.length === 0
            ? 'Ingen kommentarer enda'
            : `${comments.length} ${comments.length === 1 ? 'kommentar' : 'kommentarer'}`}
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
          {visibleComments.map(c => (
            <CommentRow key={c.id} comment={c}
                          onResolve={() => void handleResolve(c.id)} />
          ))}
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
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        void handlePost();
                      }
                    }}
                    rows={2}
                    placeholder="Skriv kommentar …"
                    style={{ ...inputSx, minHeight: 50, resize: 'vertical' }} />
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

function CommentRow({ comment, onResolve }: {
  comment: PostCommentItem; onResolve: () => void;
}) {
  const isResolved = comment.status === 'resolved' || comment.status === 'wontfix';
  return (
    <div style={{
      ...rowSx,
      background: isResolved ? 'rgba(74,212,138,0.05)' : 'rgba(255,255,255,0.03)',
      borderColor: isResolved ? 'rgba(74,212,138,0.15)' : 'rgba(160,48,192,0.15)',
    }}>
      <div style={rowHeaderSx}>
        <span style={authorSx}>{comment.authorDisplayName}</span>
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
          {!isResolved && (
            <button onClick={onResolve} style={resolveBtnSx}
                    title="Markér som løst">
              ✓
            </button>
          )}
        </span>
      </div>
      <div style={textSx}>{comment.commentText}</div>
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

const rowSx: React.CSSProperties = {
  padding: 8, borderRadius: 4,
  border: '1px solid',
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
