import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import type { MockupDoc } from "./mockupStudioModel";
import {
  applyCloudMockupChangeSet,
  createCloudMockupComment,
  createCloudMockupReview,
  createCloudMockupWebhook,
  decideCloudMockupReview,
  exportCloudMockupComments,
  generateCloudMockupChangeSet,
  getCloudMockupReviewSummary,
  inviteCloudMockupCollaborator,
  listCloudMockupChangeSets,
  listCloudMockupCollaborators,
  listCloudMockupComments,
  listCloudMockupNotifications,
  listCloudMockupShares,
  listCloudMockupVersions,
  listCloudMockupWebhooks,
  reactToCloudMockupComment,
  rejectCloudMockupChangeSet,
  removeCloudMockupCollaborator,
  removeCloudMockupWebhook,
  revokeCloudMockupShare,
  sendCloudMockupPresence,
  updateCloudMockupChangeSet,
  updateCloudMockupComment,
  updateCloudMockupShare,
  type CloudMockupChangeOperation,
  type CloudMockupChangeSet,
  type CloudMockupCollaborator,
  type CloudMockupComment,
  type CloudMockupNotification,
  type CloudMockupDecision,
  type CloudMockupPresence,
  type MockupReviewMark,
  type CloudMockupShare,
  type CloudMockupVersion,
  type CloudMockupWebhook,
  type MockupAccessRole,
} from "../../services/cloudMockupProjectsService";
import { applyHydratedMockupChangeSet } from "./mockupChangeSets";

export interface MockupReviewPin {
  id: string;
  number: number;
  x: number;
  y: number;
  status: string;
  author: string;
  anchorKind: "canvas" | "element";
  anchorRef: string | null;
  anchorOffsetX: number | null;
  anchorOffsetY: number | null;
  marks: MockupReviewMark[];
}
export type MockupReviewTool = "select" | "pin" | "freehand" | "arrow" | "rect";
export interface MockupReviewAnchor {
  x: number;
  y: number;
  anchorKind: "canvas" | "element";
  anchorRef: string | null;
  anchorOffsetX: number | null;
  anchorOffsetY: number | null;
  marks: MockupReviewMark[];
}
interface Props {
  project: MockupDoc;
  pendingAnchor: MockupReviewAnchor | null;
  activePinId: string | null;
  reviewTool: MockupReviewTool;
  onPendingAnchorChange: (point: MockupReviewAnchor | null) => void;
  onReviewToolChange: (tool: MockupReviewTool) => void;
  onActivePinChange: (id: string | null) => void;
  onPinsChange: (pins: MockupReviewPin[]) => void;
  onPrepareReview: () => Promise<void>;
  onBuildChangeSetProject: (operations: CloudMockupChangeOperation[]) => Promise<MockupDoc>;
  onApplyProject: (project: MockupDoc) => void;
  onClose: () => void;
  onMessage: (message: string) => void;
}
type Tab = "feedback" | "changes" | "versions" | "people" | "inbox" | "integrations";
const EVENTS = ["review.created", "comment.created", "comment.resolved", "version.created", "review.approved", "review.changes_requested"];

const panel: CSSProperties = {
  width: "clamp(340px, 29vw, 470px)", minWidth: 340, borderLeft: "1px solid rgba(255,255,255,.1)",
  background: "#11141d", color: "#f4f6fb", display: "flex", flexDirection: "column", minHeight: 0,
};
const btn: CSSProperties = {
  border: "1px solid rgba(255,255,255,.14)", borderRadius: 8, background: "#1a1f2c",
  color: "#eef1f8", padding: "8px 10px", cursor: "pointer", font: "600 12px system-ui",
};
const primary: CSSProperties = { ...btn, borderColor: "#20c5d8", background: "#20c5d8", color: "#041319" };
const input: CSSProperties = {
  width: "100%", boxSizing: "border-box", border: "1px solid rgba(255,255,255,.14)",
  borderRadius: 8, background: "#0c0f16", color: "#f4f6fb", padding: "9px 10px", font: "13px system-ui",
};
const card: CSSProperties = { border: "1px solid rgba(255,255,255,.1)", background: "#151a25", borderRadius: 10, padding: 11 };

function fmt(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("no-NO", { dateStyle: "short", timeStyle: "short" });
}
function downloadJson(name: string, value: unknown): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}
function statusLabel(value?: string): string {
  return ({ draft: "Kladd", in_review: "Til gjennomgang", changes_requested: "Endringer ønsket", approved: "Godkjent", superseded: "Erstattet" } as Record<string, string>)[value || ""] || value || "Kladd";
}
function presentChangeValue(value: unknown): string {
  if (typeof value === "boolean") return value ? "På" : "Av";
  if (value == null) return "—";
  return String(value);
}
function parseChangeValue(current: CloudMockupChangeOperation["value"], raw: string): CloudMockupChangeOperation["value"] {
  if (typeof current === "number") {
    const value = Number(raw);
    return Number.isFinite(value) ? value : current;
  }
  if (typeof current === "boolean") return raw === "true";
  return raw;
}


export function MockupReviewPanel({
  project, pendingAnchor, activePinId, reviewTool, onPendingAnchorChange, onReviewToolChange, onActivePinChange, onPinsChange,
  onPrepareReview, onBuildChangeSetProject, onApplyProject, onClose, onMessage,
}: Props) {
  const [tab, setTab] = useState<Tab>("feedback");
  const [versions, setVersions] = useState<CloudMockupVersion[]>([]);
  const [shares, setShares] = useState<CloudMockupShare[]>([]);
  const [comments, setComments] = useState<CloudMockupComment[]>([]);
  const [collaborators, setCollaborators] = useState<CloudMockupCollaborator[]>([]);
  const [changeSets, setChangeSets] = useState<CloudMockupChangeSet[]>([]);
  const [notifications, setNotifications] = useState<CloudMockupNotification[]>([]);
  const [webhooks, setWebhooks] = useState<CloudMockupWebhook[]>([]);
  const [accessRole, setAccessRole] = useState<MockupAccessRole>("viewer");
  const [activeVersionId, setActiveVersionId] = useState("");
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [commentFilter, setCommentFilter] = useState<"all" | "open" | "resolved" | "pinned" | "general">("open");
  const [selectedCommentIds, setSelectedCommentIds] = useState<string[]>([]);
  const [pinsVisible, setPinsVisible] = useState(true);
  const [decisions, setDecisions] = useState<CloudMockupDecision[]>([]);
  const [presence, setPresence] = useState<CloudMockupPresence[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [shareOptions, setShareOptions] = useState({
    accessMode: "approve" as "view" | "comment" | "approve",
    expiresInDays: 30, requireIdentity: true, allowRecordings: true, allowVersionHistory: false,
    notifyPreviousReviewers: true,
  });
  const [invite, setInvite] = useState({ email: "", role: "commenter" as CloudMockupCollaborator["role"] });
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [recentShareUrls, setRecentShareUrls] = useState<Record<string, string>>({});
  const [compareA, setCompareA] = useState("");
  const [compareB, setCompareB] = useState("");
  const [compareMix, setCompareMix] = useState(50);

  const roots = useMemo(() => comments.filter((item) => !item.parentId), [comments]);
  const visibleRoots = useMemo(() => roots.filter((item) => {
    if (commentFilter === "open") return item.status !== "resolved" && item.status !== "wontfix";
    if (commentFilter === "resolved") return item.status === "resolved" || item.status === "wontfix";
    if (commentFilter === "pinned") return item.anchorKind !== "general";
    if (commentFilter === "general") return item.anchorKind === "general";
    return true;
  }), [roots, commentFilter]);
  const replies = useCallback((id: string) => comments.filter((item) => item.parentId === id), [comments]);
  const canApprove = accessRole === "owner" || accessRole === "editor" || accessRole === "approver";
  const canEdit = accessRole === "owner" || accessRole === "editor";
  const activeReviewStatus = versions.find((version) => version.id === activeVersionId)?.reviewStatus;

  const load = useCallback(async (preferredVersion?: string) => {
    if (!project.id) return;
    setError("");
    try {
      const [nextVersions, nextShares, nextCollaborators, inbox, nextWebhooks, summary] = await Promise.all([
        listCloudMockupVersions(project.id), listCloudMockupShares(project.id),
        listCloudMockupCollaborators(project.id).catch(() => []),
        listCloudMockupNotifications().catch(() => ({ notifications: [], unreadCount: 0 })),
        listCloudMockupWebhooks(project.id).catch(() => []),
        getCloudMockupReviewSummary(project.id),
      ]);
      setVersions(nextVersions); setShares(nextShares); setCollaborators(nextCollaborators);
      setNotifications(inbox.notifications); setWebhooks(nextWebhooks); setAccessRole(summary.accessRole);
      setDecisions(summary.decisions); setPresence(summary.presence);
      const target = preferredVersion || activeVersionId || nextVersions[0]?.id || "";
      setActiveVersionId(target);
      if (!compareA && nextVersions[0]) setCompareA(nextVersions[0].id);
      if (!compareB && nextVersions[1]) setCompareB(nextVersions[1].id);
      if (target) {
        const [result, nextChangeSets] = await Promise.all([
          listCloudMockupComments(project.id, target),
          listCloudMockupChangeSets(project.id, target),
        ]);
        setComments(result.comments); setAccessRole(result.accessRole);
        setChangeSets(nextChangeSets);
      } else { setComments([]); setChangeSets([]); }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [project.id, activeVersionId, compareA, compareB]);

  useEffect(() => { void load(); }, [project.id]);
  useEffect(() => {
    onPinsChange((pinsVisible ? visibleRoots : []).filter((item) => item.anchorX != null && item.anchorY != null).map((item) => ({
      id: item.id, number: item.number, x: item.anchorX!, y: item.anchorY!,
      status: item.status, author: item.authorDisplayName,
      anchorKind: item.anchorKind === "element" ? "element" : "canvas",
      anchorRef: item.anchorRef, anchorOffsetX: item.anchorOffsetX, anchorOffsetY: item.anchorOffsetY,
      marks: item.marks || [],
    })));
  }, [visibleRoots, pinsVisible, onPinsChange]);
  useEffect(() => {
    if (!activeVersionId) return;
    const heartbeat = () => void sendCloudMockupPresence(project.id, activeVersionId).catch(() => undefined);
    heartbeat();
    const id = window.setInterval(() => {
      heartbeat();
      void getCloudMockupReviewSummary(project.id).catch(() => undefined);
    }, 10_000);
    return () => clearInterval(id);
  }, [project.id, activeVersionId]);

  const createRound = async () => {
    setBusy("share"); setError("");
    try {
      await onPrepareReview();
      const result = await createCloudMockupReview(project.id, {
        ...shareOptions, label: `Review ${versions.length + 1}`,
      });
      let copied = false;
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(result.url);
          copied = true;
        }
      } catch { /* Reviewet er opprettet selv om WebKit nekter clipboard-tilgang. */ }
      setRecentShareUrls((current) => ({ ...current, [result.shareId]: result.url }));
      setActiveVersionId(result.versionId);
      await load(result.versionId);
      const notified = result.reviewerNotifications?.sent || 0;
      onMessage(copied
        ? `✓ Ny, uforanderlig review-versjon opprettet. Lenken er kopiert.${notified ? ` ${notified} tidligere reviewere varslet.` : ""}`
        : `✓ Ny, uforanderlig review-versjon opprettet. Kopier lenken fra Review Room.${notified ? ` ${notified} tidligere reviewere varslet.` : ""}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(""); }
  };
  const postComment = async (parentId?: string) => {
    const body = parentId ? reply.trim() : draft.trim();
    if (!activeVersionId || !body) return;
    setBusy("comment");
    try {
      await createCloudMockupComment(project.id, {
        versionId: activeVersionId, body, parentId,
        anchorKind: parentId || !pendingAnchor ? "general" : pendingAnchor.anchorKind,
        anchorRef: parentId ? null : pendingAnchor?.anchorRef,
        anchorX: parentId ? null : pendingAnchor?.x,
        anchorY: parentId ? null : pendingAnchor?.y,
        anchorOffsetX: parentId ? null : pendingAnchor?.anchorOffsetX,
        anchorOffsetY: parentId ? null : pendingAnchor?.anchorOffsetY,
        marks: parentId ? [] : pendingAnchor?.marks,
      });
      setDraft(""); setReply(""); setReplyTo(null); onPendingAnchorChange(null);
      await load(activeVersionId);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(""); }
  };
  const decide = async (decision: "approved" | "changes_requested" | "reset") => {
    if (!activeVersionId) return;
    const note = decision === "changes_requested" ? draft.trim() || undefined : undefined;
    setBusy("decision");
    try {
      await decideCloudMockupReview(project.id, activeVersionId, decision, note);
      await load(activeVersionId);
      onMessage(decision === "approved" ? "✓ Versjonen er godkjent." : decision === "reset" ? "Godkjenningen er tilbakestilt." : "Endringer er sendt tilbake.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(""); }
  };
  const copyShare = async (share: CloudMockupShare) => {
    const url = recentShareUrls[share.id];
    if (!url) { onMessage("Av sikkerhetsgrunner kan eldre lenker ikke vises igjen. Opprett en ny lenke."); return; }
    await navigator.clipboard?.writeText(url);
    onMessage("Review-lenken er kopiert.");
  };

  const replaceChangeSet = (next: CloudMockupChangeSet) =>
    setChangeSets((items) => items.map((item) => item.id === next.id ? next : item));
  const toggleChangeComment = (id: string) =>
    setSelectedCommentIds((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);
  const generateChangeSet = async () => {
    if (!activeVersionId || !selectedCommentIds.length) return;
    setBusy("generate-change"); setError("");
    try {
      const created = await generateCloudMockupChangeSet(project.id, activeVersionId, selectedCommentIds);
      setChangeSets((items) => [created, ...items]);
      setSelectedCommentIds([]);
      onMessage("✓ Redigerbart endringsforslag opprettet lokalt fra valgt feedback.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(""); }
  };
  const patchChangeSet = (id: string, patch: Partial<CloudMockupChangeSet>) =>
    setChangeSets((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));
  const patchChangeOperation = (changeSetId: string, operationId: string, raw: string) =>
    setChangeSets((items) => items.map((item) => item.id !== changeSetId ? item : {
      ...item,
      operations: item.operations.map((operation) => operation.id === operationId
        ? { ...operation, value: parseChangeValue(operation.value, raw) } : operation),
    }));
  const persistChangeSet = async (item: CloudMockupChangeSet): Promise<CloudMockupChangeSet> => {
    const saved = await updateCloudMockupChangeSet(project.id, item.id, {
      title: item.title, summary: item.summary, operations: item.operations,
    });
    replaceChangeSet(saved);
    return saved;
  };
  const saveChangeSet = async (item: CloudMockupChangeSet) => {
    setBusy("save-change-" + item.id); setError("");
    try {
      await persistChangeSet(item);
      onMessage("✓ Endringsforslaget er lagret.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(""); }
  };
  const rejectChangeSet = async (item: CloudMockupChangeSet) => {
    setBusy("reject-change-" + item.id); setError("");
    try {
      replaceChangeSet(await rejectCloudMockupChangeSet(project.id, item.id));
      onMessage("Endringsforslaget er avvist. Designet ble ikke endret.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(""); }
  };
  const applyChangeSet = async (item: CloudMockupChangeSet) => {
    setBusy("apply-change-" + item.id); setError("");
    try {
      const saved = await persistChangeSet(item);
      const preparedProject = await onBuildChangeSetProject(saved.operations);
      const result = await applyCloudMockupChangeSet(project.id, saved.id, preparedProject);
      onApplyProject(applyHydratedMockupChangeSet(project, saved.operations, result.project));
      await load(activeVersionId);
      onMessage("✓ Endringene er brukt, kommentarene er løst og en ny versjon er opprettet.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(""); }
  };

  const tabButton = (id: Tab, label: string) => (
    <button key={id} onClick={() => setTab(id)} style={{
      ...btn, flex: 1, border: 0, borderRadius: 0, borderBottom: tab === id ? "2px solid #22d3ee" : "2px solid transparent",
      background: "transparent", color: tab === id ? "#fff" : "#8f99ad", padding: "9px 4px",
    }}>{label}</button>
  );

  return (
    <aside style={panel} aria-label="Review Room">
      <header style={{ padding: "12px 14px 9px", borderBottom: "1px solid rgba(255,255,255,.1)" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 16 }}>Review Room</div>
            <div style={{ color: "#8f99ad", fontSize: 11 }}>{project.name} · {statusLabel(versions.find((v) => v.id === activeVersionId)?.reviewStatus)}</div>
          </div>
          <button onClick={() => void load(activeVersionId)} style={btn} title="Oppdater">↻</button>
          <button onClick={onClose} style={btn} aria-label="Lukk Review Room">×</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", margin: "10px -14px -9px" }}>
          {tabButton("feedback", `Feedback ${roots.length ? `(${roots.length})` : ""}`)}
          {tabButton("changes", changeSets.length ? "Endringer (" + changeSets.length + ")" : "Endringer")}
          {tabButton("versions", "Versjoner")}
          {tabButton("people", "Team")}
          {tabButton("inbox", `Innboks${notifications.some((n) => !n.seenAt) ? " •" : ""}`)}
          {tabButton("integrations", "Koblinger")}
        </div>
      </header>

      <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        {error && <div role="alert" style={{ ...card, borderColor: "#ef6c73", color: "#ffb6ba" }}>{error}</div>}

        {tab === "feedback" && <>
          {!activeVersionId ? (
            <div style={{ ...card, textAlign: "center", padding: 22 }}>
              <div style={{ fontWeight: 750, marginBottom: 6 }}>Start første review-runde</div>
              <div style={{ color: "#98a2b5", fontSize: 12, marginBottom: 14 }}>Det opprettes et låst øyeblikksbilde, slik at kommentarer alltid peker på riktig versjon.</div>
              <button onClick={() => void createRound()} disabled={busy === "share"} style={primary}>{busy ? "Oppretter…" : "Opprett Review Room"}</button>
            </div>
          ) : <>
            <div style={{ display: "flex", gap: 7 }}>
              <select value={activeVersionId} onChange={(e) => { setActiveVersionId(e.target.value); void load(e.target.value); }} style={{ ...input, flex: 1 }}>
                {versions.map((v) => <option key={v.id} value={v.id}>{v.label} · {statusLabel(v.reviewStatus)}</option>)}
              </select>
              <button onClick={() => setPinsVisible((value) => !value)} style={btn}>{pinsVisible ? "Skjul pins" : "Vis pins"}</button>
            </div>
            <div role="toolbar" aria-label="Review-verktøy" style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 5 }}>
              {([
                ["select", "Velg"], ["pin", "Pin"], ["freehand", "Frihånd"], ["arrow", "Pil"], ["rect", "Ramme"],
              ] as Array<[MockupReviewTool, string]>).map(([tool, label]) => (
                <button key={tool} onClick={() => onReviewToolChange(tool)} aria-pressed={reviewTool === tool}
                  style={{ ...btn, padding: "7px 4px", ...(reviewTool === tool ? { background: "#20c5d8", color: "#041319" } : {}) }}>{label}</button>
              ))}
            </div>
            {pendingAnchor && <div style={{ ...card, borderColor: "#20c5d8" }}>
              {pendingAnchor.marks.length ? `${pendingAnchor.marks.length} markering valgt.` : pendingAnchor.anchorKind === "element" ? "Pin festet til et designelement." : `Pin valgt ved ${Math.round(pendingAnchor.x * 100)}%, ${Math.round(pendingAnchor.y * 100)}%.`} Skriv kommentaren under.
            </div>}
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={pendingAnchor ? "Hva skal endres her?" : "Skriv en generell kommentar…"} style={{ ...input, minHeight: 74, resize: "vertical" }} />
            <div style={{ color: "#7f8a9e", fontSize: 11 }}>Tips: bruk @navn for å varsle en samarbeidspartner.</div>
            <div style={{ display: "flex", gap: 7 }}>
              <button onClick={() => void postComment()} disabled={!draft.trim() || busy === "comment"} style={primary}>Send kommentar</button>
              {pendingAnchor && <button onClick={() => onPendingAnchorChange(null)} style={btn}>Fjern pin</button>}
              <div style={{ flex: 1 }} />
              {canApprove && activeReviewStatus !== "in_review" && <button onClick={() => void decide("reset")} disabled={busy === "decision"} style={btn}>Tilbakestill</button>}
              {canApprove && <button onClick={() => void decide("changes_requested")} disabled={busy === "decision"} style={btn}>Be om endringer</button>}
              {canApprove && <button onClick={() => void decide("approved")} disabled={busy === "decision"} style={{ ...primary, background: "#68d391", borderColor: "#68d391" }}>Godkjenn</button>}
            </div>

            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {(["open", "all", "pinned", "general", "resolved"] as const).map((filter) => (
                <button key={filter} onClick={() => setCommentFilter(filter)} aria-pressed={commentFilter === filter}
                  style={{ ...btn, padding: "5px 8px", ...(commentFilter === filter ? { borderColor: "#20c5d8", color: "#7dd3fc" } : {}) }}>
                  {({ open: "Åpne", all: "Alle", pinned: "Festede", general: "Generelle", resolved: "Løste" })[filter]}
                </button>
              ))}
            </div>
            {visibleRoots.length === 0 && <div style={{ color: "#8f99ad", textAlign: "center", padding: 24 }}>Ingen kommentarer i dette filteret.</div>}
            {visibleRoots.map((comment) => (
              <article id={`mockup-comment-${comment.id}`} key={comment.id}
                onClick={() => onActivePinChange(comment.anchorKind === "general" ? null : comment.id)}
                style={{ ...card, cursor: comment.anchorKind === "general" ? "default" : "pointer", opacity: comment.status === "resolved" ? .68 : 1, borderColor: activePinId === comment.id ? "#20c5d8" : "rgba(255,255,255,.1)" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ width: 26, height: 26, display: "grid", placeItems: "center", borderRadius: 999, background: comment.status === "resolved" ? "#45505f" : "#d2a84a", color: "#10131a", fontWeight: 850, fontSize: 12 }}>#{comment.number}</span>
                  <div style={{ flex: 1 }}><b style={{ fontSize: 12 }}>{comment.authorDisplayName}</b><div style={{ color: "#8590a3", fontSize: 10 }}>{fmt(comment.createdAt)} · {comment.anchorKind === "general" ? "Generell" : comment.anchorKind === "element" ? "Festet til element" : "Festet i lerret"}</div></div>
                  <select value={comment.priority} onChange={(e) => void updateCloudMockupComment(project.id, comment.id, { priority: e.target.value as CloudMockupComment["priority"] }).then(() => load(activeVersionId))} style={{ ...input, width: 82, padding: 5 }}>
                    <option value="low">Lav</option><option value="normal">Normal</option><option value="high">Høy</option><option value="urgent">Haster</option>
                  </select>
                </div>
                <p style={{ margin: "9px 0", whiteSpace: "pre-wrap", lineHeight: 1.45, fontSize: 13 }}>{comment.body}</p>
                {comment.attachments.map((attachment) => <div key={attachment.id} style={{ color: "#7dd3fc", fontSize: 11 }}>📎 {attachment.displayName}</div>)}
                {replies(comment.id).map((item) => <div key={item.id} style={{ margin: "8px 0 0 30px", padding: "8px 9px", borderLeft: "2px solid #354052", background: "#10141d", fontSize: 12 }}><b>{item.authorDisplayName}</b><div>{item.body}</div></div>)}
                <div style={{ display: "flex", gap: 5, marginTop: 9, flexWrap: "wrap" }}>
                  {["👍", "❤️", "👀"].map((emoji) => <button key={emoji} onClick={() => void reactToCloudMockupComment(project.id, comment.id, emoji).then(() => load(activeVersionId))} style={{ ...btn, padding: "4px 7px" }}>{emoji} {comment.reactions[emoji] || ""}</button>)}
                  <button onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)} style={{ ...btn, padding: "4px 7px" }}>Svar</button>
                  <button onClick={() => void updateCloudMockupComment(project.id, comment.id, { status: comment.status === "resolved" ? "open" : "resolved" }).then(() => load(activeVersionId))} style={{ ...btn, padding: "4px 7px" }}>{comment.status === "resolved" ? "Åpne igjen" : "Løs"}</button>
                </div>
                {replyTo === comment.id && <div style={{ display: "flex", gap: 6, marginTop: 8 }}><input value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void postComment(comment.id); }} autoFocus placeholder="Skriv et svar…" style={input} /><button onClick={() => void postComment(comment.id)} style={primary}>Send</button></div>}
              </article>
            ))}
            {decisions.length > 0 && <div style={card}>
              <b>Beslutningshistorikk</b>
              {decisions.filter((item) => item.versionId === activeVersionId).map((item) => (
                <div key={item.id} style={{ borderTop: "1px solid rgba(255,255,255,.08)", marginTop: 8, paddingTop: 8, fontSize: 11 }}>
                  <span style={{ color: item.decision === "approved" ? "#86efac" : item.decision === "reset" ? "#cbd5e1" : "#fda4af" }}>{item.decision === "approved" ? "Godkjent" : item.decision === "reset" ? "Tilbakestilt" : "Endringer ønsket"}</span>
                  {" · "}{item.actorDisplayName} · {fmt(item.createdAt)}
                  {item.note && <div style={{ color: "#a8b1c2", marginTop: 3 }}>{item.note}</div>}
                </div>
              ))}
            </div>}
            {presence.length > 0 && <div style={{ color: "#8f99ad", fontSize: 11 }}>Aktive nå: {presence.map((item) => item.displayName).join(", ")}</div>}
          </>}
        </>}

        {tab === "changes" && <>
          <div style={{ ...card, display: "grid", gap: 9, borderColor: "rgba(34,211,238,.35)" }}>
            <div>
              <b>Feedback → redigerbar endring</b>
              <div style={{ color: "#98a2b5", fontSize: 12, marginTop: 4 }}>
                Velg konkrete kommentarer. Forslaget lages lokalt, viser før/etter og endrer ingenting før du godtar.
              </div>
            </div>
            {!activeVersionId && <div style={{ color: "#fbbf24", fontSize: 12 }}>Opprett en review-versjon først.</div>}
            {activeVersionId && !canEdit && <div style={{ color: "#fbbf24", fontSize: 12 }}>Du må være eier eller editor for å lage og bruke endringsforslag.</div>}
            {activeVersionId && canEdit && <>
              <div style={{ display: "grid", gap: 6 }}>
                {roots.filter((comment) => comment.status !== "resolved" && comment.status !== "wontfix").map((comment) => (
                  <label key={comment.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: 8, borderRadius: 8, background: "#0c0f16", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={selectedCommentIds.includes(comment.id)}
                      onChange={() => toggleChangeComment(comment.id)}
                      aria-label={"Velg kommentar #" + comment.number + " for endringsforslag"}
                    />
                    <span style={{ fontSize: 12, lineHeight: 1.4 }}>
                      <b>#{comment.number}</b> {comment.body}
                      <span style={{ display: "block", color: "#758095", fontSize: 10 }}>{comment.anchorKind === "element" ? "Elementforankret" : comment.anchorKind === "canvas" ? "Lerretspunkt" : "Generell"}</span>
                    </span>
                  </label>
                ))}
                {roots.filter((comment) => comment.status !== "resolved" && comment.status !== "wontfix").length === 0 &&
                  <div style={{ color: "#8f99ad", fontSize: 12 }}>Ingen åpne kommentarer i denne versjonen.</div>}
              </div>
              <button
                onClick={() => void generateChangeSet()}
                disabled={!selectedCommentIds.length || busy === "generate-change"}
                style={primary}
              >
                {busy === "generate-change" ? "Bygger forslag…" : "Lag smart endringsforslag (" + selectedCommentIds.length + ")"}
              </button>
            </>}
          </div>

          {changeSets.length === 0 && activeVersionId &&
            <div style={{ color: "#8f99ad", textAlign: "center", padding: 24 }}>Ingen endringsforslag for denne review-versjonen ennå.</div>}

          {changeSets.map((item) => {
            const proposed = item.status === "proposed";
            return <article key={item.id} style={{ ...card, display: "grid", gap: 10, opacity: item.status === "rejected" ? .65 : 1, borderColor: item.status === "applied" ? "#34d399" : "rgba(255,255,255,.1)" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: item.status === "applied" ? "#86efac" : item.status === "rejected" ? "#fda4af" : "#7dd3fc" }}>
                  {item.status === "applied" ? "Brukt" : item.status === "rejected" ? "Avvist" : "Forslag"}
                </span>
                <span style={{ flex: 1 }} />
                <span style={{ color: "#758095", fontSize: 10 }}>{Math.round(item.confidence * 100)}% · lokal motor</span>
              </div>
              {proposed
                ? <input value={item.title} onChange={(event) => patchChangeSet(item.id, { title: event.target.value })} style={{ ...input, fontWeight: 750 }} aria-label="Endringsforslag tittel" />
                : <b>{item.title}</b>}
              {proposed
                ? <textarea value={item.summary} onChange={(event) => patchChangeSet(item.id, { summary: event.target.value })} style={{ ...input, minHeight: 58, resize: "vertical" }} aria-label="Endringsforslag sammendrag" />
                : <div style={{ color: "#a8b1c2", fontSize: 12 }}>{item.summary}</div>}

              <div style={{ display: "grid", gap: 8 }}>
                {item.operations.map((operation) => (
                  <div key={operation.id} style={{ border: "1px solid rgba(255,255,255,.09)", borderRadius: 9, overflow: "hidden" }}>
                    <div style={{ padding: "7px 9px", background: "#10141d", fontSize: 11 }}>
                      <b>{operation.targetLabel}</b> · {operation.label}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "rgba(255,255,255,.08)" }}>
                      <div style={{ background: "#1b1217", padding: 9 }}>
                        <div style={{ color: "#fb7185", fontSize: 9, textTransform: "uppercase", letterSpacing: ".08em" }}>Før</div>
                        <div style={{ marginTop: 4, color: "#fecdd3", fontSize: 12, textDecoration: "line-through", overflowWrap: "anywhere" }}>{presentChangeValue(operation.before)}</div>
                      </div>
                      <div style={{ background: "#0e1b18", padding: 9 }}>
                        <div style={{ color: "#34d399", fontSize: 9, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 4 }}>Etter</div>
                        {!proposed ? <div style={{ color: "#bbf7d0", fontSize: 12, overflowWrap: "anywhere" }}>{presentChangeValue(operation.value)}</div>
                          : typeof operation.value === "boolean" ? (
                            <select value={String(operation.value)} onChange={(event) => patchChangeOperation(item.id, operation.id, event.target.value)} style={{ ...input, padding: 5 }} aria-label={operation.label + " etter"}>
                              <option value="true">På</option><option value="false">Av</option>
                            </select>
                          ) : (
                            <input
                              type={typeof operation.value === "number" ? "number" : "text"}
                              step={typeof operation.value === "number" ? "any" : undefined}
                              value={operation.value == null ? "" : String(operation.value)}
                              onChange={(event) => patchChangeOperation(item.id, operation.id, event.target.value)}
                              style={{ ...input, padding: 5 }}
                              aria-label={operation.label + " etter"}
                            />
                          )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ color: "#758095", fontSize: 10 }}>
                Fra {item.sourceCommentIds.length} kommentar{item.sourceCommentIds.length === 1 ? "" : "er"} · revisjon {item.sourceRevision}
                {item.appliedVersionId ? " · ny versjon " + item.appliedVersionId : ""}
              </div>
              {proposed && canEdit && <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => void saveChangeSet(item)} disabled={busy === "save-change-" + item.id} style={btn}>Lagre</button>
                <button onClick={() => void rejectChangeSet(item)} disabled={busy === "reject-change-" + item.id} style={btn}>Avvis</button>
                <button onClick={() => void applyChangeSet(item)} disabled={busy === "apply-change-" + item.id} style={{ ...primary, flex: 1 }}>
                  {busy === "apply-change-" + item.id ? "Bruker…" : "Godta og bruk"}
                </button>
              </div>}
            </article>;
          })}
        </>}


        {tab === "versions" && <>
          <button onClick={() => void createRound()} disabled={busy === "share"} style={primary}>+ Ny låst review-versjon</button>
          {versions.map((version) => <div key={version.id} style={{ ...card, borderColor: version.id === activeVersionId ? "#20c5d8" : "rgba(255,255,255,.1)" }}>
            <div style={{ display: "flex", gap: 8 }}><b style={{ flex: 1 }}>{version.label}</b><span style={{ fontSize: 11, color: "#a8b1c2" }}>{statusLabel(version.reviewStatus)}</span></div>
            <div style={{ fontSize: 11, color: "#7f8a9e", marginTop: 4 }}>{fmt(version.createdAt)} · revisjon {version.sourceRevision ?? "—"} · {version.commentCount || 0} kommentarer</div>
            <button onClick={() => { setActiveVersionId(version.id); setTab("feedback"); void load(version.id); }} style={{ ...btn, marginTop: 8 }}>Åpne feedback</button>
          </div>)}
          {versions.length > 1 && <div style={card}>
            <b>Sammenlign versjoner</b>
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}><select value={compareA} onChange={(e) => setCompareA(e.target.value)} style={input}>{versions.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}</select><select value={compareB} onChange={(e) => setCompareB(e.target.value)} style={input}>{versions.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}</select></div>
            <div style={{ position: "relative", marginTop: 9, aspectRatio: "1/1", background: "#080b10", overflow: "hidden", borderRadius: 8 }}>
              {versions.find((v) => v.id === compareB)?.preview && <img src={versions.find((v) => v.id === compareB)!.preview!} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />}
              {versions.find((v) => v.id === compareA)?.preview && <img src={versions.find((v) => v.id === compareA)!.preview!} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", clipPath: `inset(0 ${100 - compareMix}% 0 0)` }} />}
              <div style={{ position: "absolute", top: 0, bottom: 0, left: `${compareMix}%`, width: 2, background: "#fff" }} />
            </div>
            <input type="range" min={0} max={100} value={compareMix} onChange={(e) => setCompareMix(Number(e.target.value))} style={{ width: "100%" }} aria-label="Sammenligningsskille" />
          </div>}
          {activeVersionId && <button onClick={() => void exportCloudMockupComments(project.id, activeVersionId).then((data) => downloadJson(`${project.name}-figma-comments.json`, data))} style={btn}>Eksporter Figma-kommentarer (JSON)</button>}
        </>}

        {tab === "people" && <>
          <div style={card}><b>Tilgang</b><div style={{ color: "#8f99ad", fontSize: 12, marginTop: 4 }}>Din rolle: {accessRole}. Inviterte brukere får tilgang når e-postadressen deres matcher innloggingen.</div></div>
          {accessRole === "owner" && <div style={{ ...card, display: "grid", gap: 7 }}>
            <input value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} type="email" placeholder="navn@firma.no" style={input} />
            <select value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value as CloudMockupCollaborator["role"] })} style={input}><option value="editor">Kan redigere</option><option value="commenter">Kan kommentere</option><option value="approver">Kan godkjenne</option><option value="viewer">Kan se</option></select>
            <button onClick={() => void inviteCloudMockupCollaborator(project.id, invite.email, invite.role).then(() => { setInvite({ ...invite, email: "" }); return load(activeVersionId); }).catch((e) => setError(e.message))} disabled={!invite.email} style={primary}>Inviter</button>
          </div>}
          {collaborators.map((person) => <div key={person.id} style={{ ...card, display: "flex", gap: 8, alignItems: "center" }}><div style={{ flex: 1 }}><b>{person.displayName || person.email}</b><div style={{ color: "#8f99ad", fontSize: 11 }}>{person.email} · {person.role} · {person.acceptedAt ? "aktiv" : "invitert"}</div></div>{accessRole === "owner" && <button onClick={() => void removeCloudMockupCollaborator(project.id, person.id).then(() => load(activeVersionId))} style={btn}>Fjern</button>}</div>)}
        </>}

        {tab === "inbox" && <>
          {notifications.length === 0 && <div style={{ color: "#8f99ad", textAlign: "center", padding: 24 }}>Ingen review-varsler.</div>}
          {notifications.map((notice) => <button key={notice.id} onClick={() => { if (notice.versionId) { setActiveVersionId(notice.versionId); setTab("feedback"); void load(notice.versionId); } }} style={{ ...card, textAlign: "left", color: "#eef1f8", cursor: "pointer", opacity: notice.seenAt ? .65 : 1 }}><b>{notice.title}</b><div style={{ marginTop: 4, fontSize: 12 }}>{notice.body}</div><div style={{ color: "#7f8a9e", fontSize: 10, marginTop: 5 }}>{fmt(notice.createdAt)}</div></button>)}
        </>}

        {tab === "integrations" && <>
          <div style={card}>
            <b>Aktive review-lenker</b>
            {shares.length === 0 && <div style={{ color: "#8f99ad", fontSize: 12, marginTop: 5 }}>Ingen aktive lenker.</div>}
            {shares.filter((share) => !share.revokedAt).map((share) => <div key={share.id} style={{ borderTop: "1px solid rgba(255,255,255,.08)", marginTop: 9, paddingTop: 9 }}>
              <div style={{ fontSize: 12 }}>{share.versionLabel || share.versionId} · {share.accessMode} · utløper {fmt(share.expiresAt)}</div>
              <div style={{ display: "flex", gap: 5, marginTop: 6 }}>
                <button onClick={() => void copyShare(share)} style={btn}>Kopier</button>
                <button onClick={() => void updateCloudMockupShare(project.id, share.id, { commentsPaused: !share.commentsPaused }).then(() => load(activeVersionId))} style={btn}>{share.commentsPaused ? "Start kommentarer" : "Pause kommentarer"}</button>
                <button onClick={() => void revokeCloudMockupShare(project.id, share.id).then(() => load(activeVersionId))} style={btn}>Trekk tilbake</button>
              </div>
            </div>)}
          </div>
          <div style={{ ...card, display: "grid", gap: 7 }}>
            <b>Ny review-lenke</b>
            <select value={shareOptions.accessMode} onChange={(e) => setShareOptions({ ...shareOptions, accessMode: e.target.value as typeof shareOptions.accessMode })} style={input}><option value="view">Kun visning</option><option value="comment">Kommentarer</option><option value="approve">Kommentarer + godkjenning</option></select>
            <label><input type="checkbox" checked={shareOptions.requireIdentity} onChange={(e) => setShareOptions({ ...shareOptions, requireIdentity: e.target.checked })} /> Krev navn</label>
            <label><input type="checkbox" checked={shareOptions.allowRecordings} onChange={(e) => setShareOptions({ ...shareOptions, allowRecordings: e.target.checked })} /> Tillat skjermopptak</label>
            <label><input type="checkbox" checked={shareOptions.allowVersionHistory} onChange={(e) => setShareOptions({ ...shareOptions, allowVersionHistory: e.target.checked })} /> Vis versjonshistorikk</label>
            <label><input type="checkbox" checked={shareOptions.notifyPreviousReviewers} onChange={(e) => setShareOptions({ ...shareOptions, notifyPreviousReviewers: e.target.checked })} /> Varsle tidligere reviewere på e-post</label>
            <button onClick={() => void createRound()} style={primary}>Opprett og kopier lenke</button>
          </div>
          {accessRole === "owner" && <div style={{ ...card, display: "grid", gap: 7 }}>
            <b>Webhook</b>
            <div style={{ color: "#8f99ad", fontSize: 11 }}>HTTPS-endepunktet mottar signerte review-, kommentar- og godkjenningshendelser.</div>
            <input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://example.com/webhooks/review" style={input} />
            <button onClick={() => void createCloudMockupWebhook(project.id, webhookUrl, EVENTS).then((result) => { setWebhookSecret(result.signingSecret); setWebhookUrl(""); return load(activeVersionId); }).catch((e) => setError(e.message))} disabled={!webhookUrl} style={primary}>Legg til webhook</button>
            {webhookSecret && <div style={{ padding: 8, background: "#080b10", borderRadius: 7, font: "11px ui-monospace", wordBreak: "break-all" }}>Lagre hemmeligheten nå: {webhookSecret}</div>}
            {webhooks.map((hook) => <div key={hook.id} style={{ display: "flex", gap: 7, alignItems: "center" }}><span style={{ flex: 1, fontSize: 11, wordBreak: "break-all" }}>{hook.url}<br />{hook.failureCount} feil · HTTP {hook.lastStatusCode || "—"}</span><button onClick={() => void removeCloudMockupWebhook(project.id, hook.id).then(() => load(activeVersionId))} style={btn}>Fjern</button></div>)}
          </div>}
        </>}
      </div>
    </aside>
  );
}

export default MockupReviewPanel;
