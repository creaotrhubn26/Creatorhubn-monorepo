/**
 * ReviewSessionsStudio — Role Room-brandet for klient-review.
 *
 * Workflow:
 *  1. Lag ny review-session (sett tittel, klientnavn, hvilke ting som
 *     er synlige, expires_at)
 *  2. Kopier den genererte URL-en og send til klient
 *  3. Klient åpner /review/:token, ser cuts, approve/reject/kommenterer
 *  4. Bjarne ser kommentarer i Studio, markerer som addressed
 */

import { useEffect, useState } from "react";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlineOutlined";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import GroupsIcon from "@mui/icons-material/Groups";
import CheckIcon from "@mui/icons-material/Check";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { openPath } from "@tauri-apps/plugin-opener";
import { reviewService } from "../services/reviewService";
import {
  DEFAULT_VISIBILITY,
} from "../lib/reviewTypes";
import type {
  ReviewSession, ReviewComment, ReviewVisibilitySettings,
} from "../lib/reviewTypes";
import { ROLE_ROOM_BRAND } from "../lib/lowerThirdTypes";

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  agentKind?: string;
}

export function ReviewSessionsStudio({ open, onClose, projectId, agentKind }: Props) {
  const [sessions, setSessions] = useState<ReviewSession[]>([]);
  const [activeSession, setActiveSession] = useState<ReviewSession | null>(null);
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Create-form state
  const [newSessionTitle, setNewSessionTitle] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newExpiresIn, setNewExpiresIn] = useState(30);
  const [newVisibility, setNewVisibility] = useState<ReviewVisibilitySettings>(
    { ...DEFAULT_VISIBILITY });

  useEffect(() => {
    if (!open || !projectId) return;
    refresh();
  }, [open, projectId]);

  useEffect(() => {
    if (!activeSession) {
      setComments([]);
      return;
    }
    loadComments(activeSession.id);
  }, [activeSession?.id]);

  const refresh = async () => {
    setLoaded(false);
    try {
      const list = await reviewService.listSessions(projectId);
      setSessions(list);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoaded(true);
    }
  };

  const loadComments = async (sessionId: string) => {
    try {
      const list = await reviewService.listComments(sessionId);
      setComments(list);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    try {
      const result = await reviewService.createSession({
        projectId,
        sessionTitle: newSessionTitle || undefined,
        clientName: newClientName || undefined,
        clientEmail: newClientEmail || undefined,
        agentKind,
        visibilitySettings: newVisibility,
        expiresInDays: newExpiresIn,
      });
      // Copy URL to clipboard automatically
      const url = reviewService.publicUrlFor(result.token);
      try { await navigator.clipboard.writeText(url); } catch { /* ignore */ }
      setCopiedToken(result.token);
      setShowCreateForm(false);
      // Reset form
      setNewSessionTitle("");
      setNewClientName("");
      setNewClientEmail("");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (session: ReviewSession) => {
    if (!confirm(`Slett review-session "${session.sessionTitle || session.id}"?`)) return;
    try {
      await reviewService.deleteSession(session.id);
      setSessions(prev => prev.filter(s => s.id !== session.id));
      if (activeSession?.id === session.id) setActiveSession(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleCopyUrl = async (session: ReviewSession) => {
    const url = reviewService.publicUrlFor(session.token);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedToken(session.token);
      setTimeout(() => setCopiedToken(null), 2000);
    } catch (e) {
      setError(`Clipboard: ${(e as Error).message}`);
    }
  };

  const handleOpenInBrowser = async (session: ReviewSession) => {
    const url = reviewService.publicUrlFor(session.token);
    try {
      await openPath(url);
    } catch (e) {
      setError(`Kunne ikke åpne: ${(e as Error).message}`);
    }
  };

  const handleAddressComment = async (commentId: string) => {
    try {
      await reviewService.markCommentAddressed(commentId);
      setComments(prev => prev.map(c =>
        c.id === commentId
          ? { ...c, addressed: true, addressedAt: new Date().toISOString() }
          : c));
    } catch (e) {
      setError((e as Error).message);
    }
  };

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
            <GroupsIcon sx={{ fontSize: 18, color: "#fff" }} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>
              Client Review Portal
            </div>
            <div style={{ fontSize: 10.5, color: ROLE_ROOM_BRAND.textTertiary,
                            display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{
                width: 8, height: 8, borderRadius: 4,
                background: ROLE_ROOM_BRAND.primaryLila,
              }} />
              {sessions.length} review-sessions · signed-token-auth
            </div>
          </div>
        </div>

        <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => setShowCreateForm(true)}
                  style={{
                    background: ROLE_ROOM_BRAND.signatureGradient,
                    border: 0, color: "#fff",
                    padding: "7px 14px", fontSize: 12, fontWeight: 600,
                    borderRadius: 4, cursor: "pointer",
                    display: "inline-flex", alignItems: "center", gap: 6,
                  }}>
            <AddIcon sx={{ fontSize: 13 }} />
            Ny review
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

      {/* Main 2-cols */}
      <div onClick={e => e.stopPropagation()}
           style={{ flex: 1, display: "grid",
                     gridTemplateColumns: "320px 1fr",
                     overflow: "hidden" }}>

        {/* LEFT: sessions list */}
        <div style={{ background: "rgba(255,255,255,0.02)",
                        borderRight: `1px solid rgba(160,48,192,0.18)`,
                        padding: 14, overflowY: "auto" }}>
          <div style={{ fontSize: 10, fontWeight: 700,
                          color: ROLE_ROOM_BRAND.textTertiary,
                          marginBottom: 6, letterSpacing: 0.5 }}>
            SESSIONS
          </div>
          {!loaded && (
            <div style={{ fontSize: 11, color: ROLE_ROOM_BRAND.textTertiary,
                            textAlign: "center", padding: 20 }}>Laster …</div>
          )}
          {loaded && sessions.length === 0 && (
            <div style={{ fontSize: 11, color: ROLE_ROOM_BRAND.textTertiary,
                            textAlign: "center", padding: 16, lineHeight: 1.5 }}>
              Ingen review-sessions enda. Klikk "Ny review" for å starte.
            </div>
          )}
          {sessions.map(s => (
            <div key={s.id}
                 onClick={() => setActiveSession(s)}
                 style={{
                   padding: 10, marginBottom: 4, borderRadius: 4,
                   background: activeSession?.id === s.id
                     ? "rgba(160,48,192,0.18)"
                     : "rgba(255,255,255,0.03)",
                   border: activeSession?.id === s.id
                     ? `1px solid ${ROLE_ROOM_BRAND.primaryLila}55`
                     : "1px solid transparent",
                   cursor: "pointer",
                 }}>
              <div style={{ display: "flex", justifyContent: "space-between",
                              alignItems: "flex-start", gap: 6 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 600,
                                  overflow: "hidden", textOverflow: "ellipsis",
                                  whiteSpace: "nowrap" }}>
                    {s.sessionTitle || "(uten tittel)"}
                  </div>
                  <div style={{ fontSize: 9.5,
                                  color: ROLE_ROOM_BRAND.textTertiary,
                                  marginTop: 2 }}>
                    {s.clientName || "(ingen klient)"} · {s.status}
                  </div>
                  <div style={{ fontSize: 9, color: ROLE_ROOM_BRAND.textTertiary,
                                  marginTop: 2, display: "flex", gap: 8 }}>
                    <span>{s.viewCount} visninger</span>
                    {s.commentCount > 0 && (
                      <span style={{ color: ROLE_ROOM_BRAND.primaryLila,
                                       fontWeight: 600 }}>
                        💬 {s.commentCount} kommentarer
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CENTER: session detail / create form */}
        <div style={{ background: ROLE_ROOM_BRAND.deepNavy,
                        padding: 22, overflowY: "auto" }}>
          {showCreateForm && (
            <CreateForm
              title={newSessionTitle}
              setTitle={setNewSessionTitle}
              clientName={newClientName}
              setClientName={setNewClientName}
              clientEmail={newClientEmail}
              setClientEmail={setNewClientEmail}
              expiresIn={newExpiresIn}
              setExpiresIn={setNewExpiresIn}
              visibility={newVisibility}
              setVisibility={setNewVisibility}
              onCreate={handleCreate}
              onCancel={() => setShowCreateForm(false)}
              creating={creating}
            />
          )}
          {!showCreateForm && activeSession && (
            <SessionDetail
              session={activeSession}
              comments={comments}
              copiedToken={copiedToken}
              onCopyUrl={() => void handleCopyUrl(activeSession)}
              onOpenInBrowser={() => void handleOpenInBrowser(activeSession)}
              onDelete={() => void handleDelete(activeSession)}
              onAddressComment={(id) => void handleAddressComment(id)}
              onUpdateStatus={async (status) => {
                try {
                  await reviewService.updateSession(activeSession.id, { status });
                  await refresh();
                  setActiveSession({ ...activeSession, status });
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            />
          )}
          {!showCreateForm && !activeSession && (
            <div style={{ textAlign: "center", padding: 60, fontSize: 12,
                            color: ROLE_ROOM_BRAND.textTertiary, lineHeight: 1.6 }}>
              Velg en review-session fra venstre, eller klikk "Ny review"
              for å lage en ny.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateForm({
  title, setTitle, clientName, setClientName,
  clientEmail, setClientEmail, expiresIn, setExpiresIn,
  visibility, setVisibility, onCreate, onCancel, creating,
}: {
  title: string; setTitle: (v: string) => void;
  clientName: string; setClientName: (v: string) => void;
  clientEmail: string; setClientEmail: (v: string) => void;
  expiresIn: number; setExpiresIn: (v: number) => void;
  visibility: ReviewVisibilitySettings;
  setVisibility: (v: ReviewVisibilitySettings) => void;
  onCreate: () => void;
  onCancel: () => void;
  creating: boolean;
}) {
  return (
    <div style={{ maxWidth: 600 }}>
      <div style={sectionTitle}>NY REVIEW-SESSION</div>
      <Row label="Tittel">
        <input value={title} onChange={e => setTitle(e.target.value)}
               placeholder="F.eks. 'Podcast-episode 47 — klient-review'"
               style={inputSx} />
      </Row>
      <Row label="Klient-navn">
        <input value={clientName} onChange={e => setClientName(e.target.value)}
               placeholder="Klientens navn (forhåndsutfyller comment-form)"
               style={inputSx} />
      </Row>
      <Row label="Klient-epost">
        <input value={clientEmail} onChange={e => setClientEmail(e.target.value)}
               placeholder="(optional) for sporing"
               style={inputSx} />
      </Row>
      <Row label="Utløper om">
        <select value={expiresIn}
                onChange={e => setExpiresIn(parseInt(e.target.value))}
                style={inputSx}>
          <option value={7}>7 dager</option>
          <option value={14}>14 dager</option>
          <option value={30}>30 dager (default)</option>
          <option value={60}>60 dager</option>
          <option value={90}>90 dager</option>
          <option value={365}>1 år</option>
        </select>
      </Row>

      <div style={{ ...sectionTitle, marginTop: 16 }}>
        HVA KAN KLIENT SE / GJØRE?
      </div>
      <Checkbox label="Vis cuts (sosial-clips)"
                checked={visibility.showCuts}
                onChange={v => setVisibility({ ...visibility, showCuts: v })} />
      <Checkbox label="Vis captions"
                checked={visibility.showCaptions}
                onChange={v => setVisibility({ ...visibility, showCaptions: v })} />
      <Checkbox label="Tillat approve"
                checked={visibility.allowApprove}
                onChange={v => setVisibility({ ...visibility, allowApprove: v })} />
      <Checkbox label="Tillat reject"
                checked={visibility.allowReject}
                onChange={v => setVisibility({ ...visibility, allowReject: v })} />
      <Checkbox label="Tillat kommentarer"
                checked={visibility.allowComments}
                onChange={v => setVisibility({ ...visibility, allowComments: v })} />

      <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
        <button onClick={onCancel}
                style={{
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.15)",
                  color: ROLE_ROOM_BRAND.textPrimary,
                  padding: "8px 14px", fontSize: 12, fontWeight: 600,
                  borderRadius: 4, cursor: "pointer",
                }}>Avbryt</button>
        <button onClick={onCreate}
                disabled={creating}
                style={{
                  background: creating
                    ? "rgba(110,63,199,0.20)"
                    : ROLE_ROOM_BRAND.signatureGradient,
                  border: 0, color: "#fff",
                  padding: "8px 16px", fontSize: 12, fontWeight: 600,
                  borderRadius: 4,
                  cursor: creating ? "wait" : "pointer",
                  display: "inline-flex", alignItems: "center", gap: 6,
                }}>
          {creating ? "Lager …" : "Lag review-link"}
        </button>
      </div>
    </div>
  );
}

function SessionDetail({
  session, comments, copiedToken,
  onCopyUrl, onOpenInBrowser, onDelete,
  onAddressComment, onUpdateStatus,
}: {
  session: ReviewSession;
  comments: ReviewComment[];
  copiedToken: string | null;
  onCopyUrl: () => void;
  onOpenInBrowser: () => void;
  onDelete: () => void;
  onAddressComment: (id: string) => void;
  onUpdateStatus: (status: ReviewSession["status"]) => Promise<void>;
}) {
  const url = reviewService.publicUrlFor(session.token);
  const unaddressedCount = comments.filter(c => !c.addressed).length;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between",
                      alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
            {session.sessionTitle || "(uten tittel)"}
          </div>
          <div style={{ fontSize: 11, color: ROLE_ROOM_BRAND.textTertiary }}>
            For: {session.clientName || "(ingen klient satt)"}
            {session.clientEmail && ` · ${session.clientEmail}`}
            {" · Utløper "}
            {new Date(session.expiresAt).toLocaleDateString("nb")}
          </div>
        </div>
        <button onClick={onDelete}
                title="Slett session"
                style={{ background: "transparent", border: 0,
                          color: "#ef4f6f", cursor: "pointer", padding: 4,
                          display: "inline-flex", alignItems: "center" }}>
          <DeleteOutlineIcon sx={{ fontSize: 16 }} />
        </button>
      </div>

      {/* URL-box */}
      <div style={{
        background: "rgba(160,48,192,0.10)",
        border: "1px solid rgba(160,48,192,0.30)",
        borderRadius: 6, padding: 12, marginBottom: 16,
      }}>
        <div style={{ fontSize: 10, fontWeight: 700,
                        color: ROLE_ROOM_BRAND.textTertiary,
                        marginBottom: 6, letterSpacing: 0.5 }}>
          KLIENT-URL
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <input value={url} readOnly
                 style={{
                   flex: 1, background: "rgba(0,0,0,0.4)",
                   border: "1px solid rgba(255,255,255,0.08)",
                   borderRadius: 3, padding: "7px 10px",
                   color: ROLE_ROOM_BRAND.textPrimary, fontSize: 11,
                   fontFamily: "monospace",
                 }} />
          <button onClick={onCopyUrl}
                  style={{
                    background: copiedToken === session.token
                      ? "rgba(74,212,138,0.18)"
                      : ROLE_ROOM_BRAND.signatureGradient,
                    border: 0, color: "#fff",
                    padding: "7px 12px", fontSize: 11, fontWeight: 600,
                    borderRadius: 3, cursor: "pointer",
                    display: "inline-flex", alignItems: "center", gap: 4,
                  }}>
            {copiedToken === session.token
              ? <><CheckIcon sx={{ fontSize: 13 }} /> Kopiert</>
              : <><ContentCopyIcon sx={{ fontSize: 13 }} /> Kopier</>}
          </button>
          <button onClick={onOpenInBrowser}
                  title="Åpne i nettleser"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(160,48,192,0.40)",
                    color: ROLE_ROOM_BRAND.textPrimary,
                    padding: "7px 10px", fontSize: 11,
                    borderRadius: 3, cursor: "pointer",
                    display: "inline-flex", alignItems: "center",
                  }}>
            <OpenInNewIcon sx={{ fontSize: 13 }} />
          </button>
        </div>
      </div>

      {/* Stats + status-controls */}
      <div style={{ display: "grid",
                      gridTemplateColumns: "repeat(4, 1fr)",
                      gap: 10, marginBottom: 16 }}>
        <Stat label="Status" value={session.status} highlight />
        <Stat label="Visninger" value={String(session.viewCount)} />
        <Stat label="Kommentarer" value={String(comments.length)} />
        <Stat label="Uadresserte"
              value={String(unaddressedCount)}
              highlight={unaddressedCount > 0} />
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
        {(["draft", "active", "completed"] as const).map(s => (
          <button key={s}
                  onClick={() => void onUpdateStatus(s)}
                  disabled={session.status === s}
                  style={{
                    background: session.status === s
                      ? ROLE_ROOM_BRAND.signatureGradient
                      : "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: session.status === s ? "#fff" : ROLE_ROOM_BRAND.textPrimary,
                    padding: "5px 12px", borderRadius: 3,
                    fontSize: 11, cursor: session.status === s ? "default" : "pointer",
                    textTransform: "capitalize",
                  }}>
            {s}
          </button>
        ))}
      </div>

      {/* Comments */}
      <div style={sectionTitle}>KLIENT-KOMMENTARER</div>
      {comments.length === 0 && (
        <div style={{ padding: 20, fontSize: 11.5,
                        color: ROLE_ROOM_BRAND.textTertiary,
                        textAlign: "center", lineHeight: 1.6 }}>
          Ingen kommentarer enda. Send URL-en til klient og venter.
        </div>
      )}
      {comments.map(c => (
        <div key={c.id} style={{
          padding: 10, marginBottom: 6, borderRadius: 4,
          background: c.addressed
            ? "rgba(255,255,255,0.02)"
            : "rgba(160,48,192,0.08)",
          border: c.addressed
            ? "1px solid rgba(255,255,255,0.04)"
            : "1px solid rgba(160,48,192,0.20)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between",
                          alignItems: "flex-start", gap: 6, marginBottom: 4 }}>
            <div>
              <span style={{ fontSize: 11, fontWeight: 600,
                                color: ROLE_ROOM_BRAND.primaryLila }}>
                {c.clientName}
              </span>
              <span style={{ fontSize: 9.5, marginLeft: 6,
                                color: ROLE_ROOM_BRAND.textTertiary }}>
                {new Date(c.createdAt).toLocaleString("nb")}
              </span>
              {c.cutId && (
                <span style={{ fontSize: 9, marginLeft: 6,
                                  padding: "1px 6px", borderRadius: 2,
                                  background: "rgba(255,255,255,0.05)",
                                  color: ROLE_ROOM_BRAND.textSecondary }}>
                  cut #{c.cutId.slice(0, 6)}
                </span>
              )}
            </div>
            {!c.addressed && (
              <button onClick={() => onAddressComment(c.id)}
                      title="Markér som addressed"
                      style={{
                        background: "rgba(74,212,138,0.18)",
                        border: "1px solid rgba(74,212,138,0.40)",
                        color: "#4ad48a", borderRadius: 3,
                        padding: "3px 8px", fontSize: 9.5, fontWeight: 600,
                        cursor: "pointer",
                        display: "inline-flex", alignItems: "center", gap: 3,
                      }}>
                <VisibilityIcon sx={{ fontSize: 10 }} /> Markér addressed
              </button>
            )}
            {c.addressed && (
              <span style={{ fontSize: 9, color: "#4ad48a", fontWeight: 600 }}>
                ✓ addressed
              </span>
            )}
          </div>
          <div style={{ fontSize: 11.5, color: ROLE_ROOM_BRAND.textPrimary,
                          lineHeight: 1.4, whiteSpace: "pre-wrap" }}>
            {c.commentText}
          </div>
        </div>
      ))}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={sectionTitle}>{label}</label>
      {children}
    </div>
  );
}

function Checkbox({ label, checked, onChange }: {
  label: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8,
                      fontSize: 11.5, color: ROLE_ROOM_BRAND.textPrimary,
                      marginBottom: 5, cursor: "pointer" }}>
      <input type="checkbox" checked={checked}
             onChange={e => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function Stat({ label, value, highlight }: {
  label: string; value: string; highlight?: boolean;
}) {
  return (
    <div style={{
      padding: 10, borderRadius: 4,
      background: highlight
        ? "rgba(160,48,192,0.10)"
        : "rgba(255,255,255,0.04)",
      border: highlight
        ? "1px solid rgba(160,48,192,0.30)"
        : "1px solid rgba(160,48,192,0.15)",
      textAlign: "center",
    }}>
      <div style={{ fontSize: 9.5, color: ROLE_ROOM_BRAND.textTertiary,
                      letterSpacing: 0.5, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700,
                      color: highlight
                        ? ROLE_ROOM_BRAND.primaryLila
                        : ROLE_ROOM_BRAND.textPrimary,
                      textTransform: "capitalize" }}>
        {value}
      </div>
    </div>
  );
}

const sectionTitle: React.CSSProperties = {
  display: "block", fontSize: 10, fontWeight: 700,
  color: ROLE_ROOM_BRAND.textTertiary,
  marginBottom: 5, letterSpacing: 0.5,
};

const inputSx: React.CSSProperties = {
  display: "block", width: "100%",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(160,48,192,0.18)",
  borderRadius: 3, padding: "6px 10px",
  color: ROLE_ROOM_BRAND.textPrimary, fontSize: 12,
};

export default ReviewSessionsStudio;
