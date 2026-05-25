import { useCallback, useEffect, useMemo, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  convertFileSrc,
  executeScript,
  listCullSessions,
  listMountedCards,
  loadCullSession,
  onCardsChanged,
  rescanCards,
  saveCullSession,
  scanFolder,
} from "../api";
import type {
  CullDecision,
  CullDecisionValue,
  CullPreflight as CullPreflightT,
  CullSession,
  CullSessionSummary,
  MountedCard,
  ProjectTemplateSummary,
} from "../types";
import { CullPreflight } from "./CullPreflight";
import { SimilarClipsDialog } from "./SimilarClipsDialog";
import { IconStar } from "./Icons";

const FORMAT_GB = (bytes: number) => `${(bytes / 1_073_741_824).toFixed(1)} GB`;
const FORMAT_MB = (bytes: number) => `${(bytes / 1_048_576).toFixed(0)} MB`;

type Filter = "all" | "keep" | "reject" | "maybe" | "pending" | "highlight";

interface CullViewProps {
  activeTemplate: ProjectTemplateSummary | null;
}

export function CullView({ activeTemplate }: CullViewProps) {
  const [cards, setCards] = useState<MountedCard[]>([]);
  const [selectedSource, setSelectedSource] = useState<MountedCard | null>(null);
  const [showPreflight, setShowPreflight] = useState(false);
  const [session, setSession] = useState<CullSession | null>(null);
  const [running, setRunning] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState<string | null>(null);
  const [showSimilar, setShowSimilar] = useState(false);
  const [resumeMatch, setResumeMatch] = useState<CullSessionSummary | null>(null);
  const [sessionSummaries, setSessionSummaries] = useState<CullSessionSummary[]>([]);

  // Load mounted cards + subscribe to changes
  useEffect(() => {
    listMountedCards().then(setCards).catch((e) => setError(String(e)));
    listCullSessions().then(setSessionSummaries).catch(() => {});
    let unlisten: (() => void) | null = null;
    onCardsChanged((next) => setCards(next)).then((u) => {
      unlisten = u;
    });
    return () => {
      unlisten?.();
    };
  }, []);

  const handlePickFolder = useCallback(async () => {
    try {
      const path = await openDialog({ directory: true, multiple: false });
      if (typeof path !== "string") return;
      const card = await scanFolder(path);
      setSelectedSource(card);
      setShowPreflight(true);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  const handlePickCard = useCallback(
    (card: MountedCard) => {
      const previous = sessionSummaries.find(
        (s) => s.sourcePath === card.mount_path || s.sourceLabel === card.volume_label,
      );
      setSelectedSource(card);
      if (previous) {
        setResumeMatch(previous);
      } else {
        setShowPreflight(true);
      }
    },
    [sessionSummaries],
  );

  const handleResume = useCallback(async () => {
    if (!resumeMatch) return;
    try {
      const loaded = await loadCullSession(resumeMatch.sessionId);
      if (loaded) {
        setSession(loaded);
        setResumeMatch(null);
      }
    } catch (e) {
      setError(String(e));
    }
  }, [resumeMatch]);

  const handleStartFresh = useCallback(() => {
    setResumeMatch(null);
    setShowPreflight(true);
  }, []);

  const handleStartCull = useCallback(
    async (preflight: CullPreflightT, model: string, skipVision: boolean) => {
      if (!selectedSource) return;
      setShowPreflight(false);
      setRunning(true);
      setError(null);
      try {
        const summary = await executeScript(
          "cull_folder",
          {
            sourcePath: selectedSource.mount_path,
            sourceLabel: selectedSource.volume_label,
            preflight,
            model,
            skipVision,
            framesPerClip: 3,
          },
          false,
        );
        const resultEvent = summary.events.find((e) => e.type === "result");
        const rawSession = (resultEvent?.value as { session?: CullSession })?.session;
        if (!rawSession) {
          setError("Cull script returned no session. Check log panel for details.");
          return;
        }
        setSession(rawSession);
        await saveCullSession(rawSession);
      } catch (e) {
        setError(String(e));
      } finally {
        setRunning(false);
      }
    },
    [selectedSource],
  );

  const setClipDecision = useCallback(
    (path: string, decision: CullDecisionValue) => {
      setSession((prev) => {
        if (!prev) return prev;
        const next: CullSession = {
          ...prev,
          updatedAt: new Date().toISOString(),
          decisions: prev.decisions.map((d) =>
            d.clipPath === path ? { ...d, decision, userOverrode: true } : d,
          ),
        };
        void saveCullSession(next);
        return next;
      });
    },
    [],
  );

  const handleBulkAccept = useCallback(() => {
    setSession((prev) => {
      if (!prev) return prev;
      const next: CullSession = {
        ...prev,
        updatedAt: new Date().toISOString(),
        decisions: prev.decisions.map((d) =>
          d.aiSuggestion === "keep" || d.decision === "keep"
            ? { ...d, decision: "keep" }
            : d,
        ),
      };
      void saveCullSession(next);
      return next;
    });
  }, []);

  const handlePlaceOnTimeline = useCallback(async () => {
    if (!session) return;
    setRunning(true);
    setError(null);
    try {
      await executeScript("place_clips_on_timeline", { session }, false);
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  }, [session]);

  const handleDryRunPlacement = useCallback(async () => {
    if (!session) return;
    setRunning(true);
    setError(null);
    try {
      await executeScript("place_clips_on_timeline", { session }, true);
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  }, [session]);

  const counts = useMemo(() => {
    const c = { keep: 0, reject: 0, maybe: 0, pending: 0, highlight: 0, total: 0 };
    session?.decisions.forEach((d) => {
      c.total += 1;
      c[d.decision] += 1;
      if ((d.highlightScore ?? 0) >= 70) c.highlight += 1;
    });
    return c;
  }, [session]);

  const visible = useMemo(() => {
    if (!session) return [];
    const list = session.decisions;
    if (filter === "all") return list;
    if (filter === "highlight") return list.filter((d) => (d.highlightScore ?? 0) >= 70);
    return list.filter((d) => d.decision === filter);
  }, [session, filter]);

  const similarGroupCount = session?.similarGroups?.length ?? 0;

  return (
    <div className="cull-view">
      <div className="cull-header">
        <h2>Cull Assistant</h2>
        <button className="small" onClick={() => rescanCards().then(setCards)} disabled={running}>
          Rescan Cards
        </button>
        <button className="small" onClick={handlePickFolder} disabled={running}>
          Pick Folder…
        </button>
        {session && (
          <button
            className="small ghost"
            onClick={() => {
              setSession(null);
              setSelectedSource(null);
              setFilter("all");
            }}
            disabled={running}
          >
            Back to Sources
          </button>
        )}
      </div>

      {error && <div className="dialog-warning" style={{ margin: 12 }}>{error}</div>}

      {resumeMatch && selectedSource && (
        <div className="resume-banner">
          <div>
            <strong>Resume previous session?</strong>
            <div className="card-chip-meta">
              {resumeMatch.sourceLabel} · {resumeMatch.totalClips} clips · {resumeMatch.kept} kept ·
              {' '}updated {new Date(resumeMatch.updatedAt).toLocaleString()}
            </div>
          </div>
          <div className="cull-actions">
            <button className="small" onClick={handleStartFresh}>Start fresh</button>
            <button className="small primary" onClick={handleResume}>Resume</button>
          </div>
        </div>
      )}

      {!session && (
        <>
          <h3 className="section-title" style={{ margin: "12px 18px 6px" }}>
            Mounted Cards
          </h3>
          {cards.length === 0 ? (
            <div className="empty" style={{ margin: "0 18px" }}>
              No camera cards detected. Plug in an SD/CFexpress card or use Pick Folder above.
            </div>
          ) : (
            <div className="card-tray">
              {cards.map((card) => (
                <button
                  key={card.mount_path}
                  className="card-chip"
                  onClick={() => handlePickCard(card)}
                  disabled={running}
                >
                  <div className="card-chip-title">
                    {card.volume_label}
                    {card.camera_guess && <span className="card-chip-cam">· {card.camera_guess}</span>}
                  </div>
                  <div className="card-chip-meta">
                    {card.total_clips} clips · {FORMAT_GB(card.total_bytes)}
                  </div>
                  <div className="card-chip-meta" style={{ opacity: 0.6 }}>
                    {card.mount_path}
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {running && !session && (
        <div className="cull-running">
          <div className="cull-running-spinner" />
          AI culling {selectedSource?.volume_label}… extracting thumbnails and scoring each clip.
        </div>
      )}

      {session && (
        <div className="cull-session">
          <div className="cull-session-bar">
            <div>
              <strong>{session.sourceLabel}</strong>
              <span className="cull-session-meta">
                {' · '}{counts.total} clips
                {' · '}<span className="chip ready">{counts.keep} keep</span>
                {' '}<span className="chip risk-medium">{counts.maybe} maybe</span>
                {' '}<span className="chip risk-high">{counts.reject} reject</span>
                {counts.pending > 0 && <> <span className="chip">{counts.pending} pending</span></>}
                {counts.highlight > 0 && <> <span className="chip experimental">{counts.highlight} highlight ≥70</span></>}
              </span>
            </div>
            <div className="cull-actions">
              <button className="small" onClick={handleBulkAccept} disabled={running}>
                Accept AI Suggestions
              </button>
              {similarGroupCount > 0 && (
                <button className="small" onClick={() => setShowSimilar(true)} disabled={running}>
                  Review {similarGroupCount} similar group{similarGroupCount === 1 ? "" : "s"}
                </button>
              )}
              <button className="small" onClick={handleDryRunPlacement} disabled={running}>
                Dry-run Timeline
              </button>
              <button className="small primary" onClick={handlePlaceOnTimeline} disabled={running || counts.keep === 0}>
                Place on Timeline ({counts.keep})
              </button>
            </div>
          </div>

          <div className="tabs">
            {(["all", "keep", "maybe", "reject", "pending", "highlight"] as Filter[]).map((f) => (
              <button
                key={f}
                className={`tab ${filter === f ? "active" : ""}`}
                onClick={() => setFilter(f)}
              >
                {f === "highlight" ? "Highlight ≥70" : f}
                <span className="count">
                  {f === "all"
                    ? counts.total
                    : f === "highlight"
                    ? counts.highlight
                    : counts[f as keyof typeof counts]}
                </span>
              </button>
            ))}
          </div>

          {visible.length === 0 ? (
            <div className="empty" style={{ padding: 18 }}>
              No clips match this filter.
            </div>
          ) : (
            <div className="clip-grid">
              {visible.map((decision) => (
                <CullClipCard
                  key={decision.clipPath}
                  decision={decision}
                  onSet={(d) => setClipDecision(decision.clipPath, d)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {showPreflight && selectedSource && (
        <CullPreflight
          sourceLabel={selectedSource.volume_label}
          clipCount={selectedSource.total_clips}
          totalBytes={selectedSource.total_bytes}
          defaultTemplateId={activeTemplate?.id ?? "corporate_video"}
          onCancel={() => setShowPreflight(false)}
          onStart={handleStartCull}
        />
      )}

      {showSimilar && session && (
        <SimilarClipsDialog
          session={session}
          onClose={() => setShowSimilar(false)}
          onUpdate={(next) => {
            setSession(next);
            void saveCullSession(next);
          }}
        />
      )}
    </div>
  );
}

interface ClipCardProps {
  decision: CullDecision;
  onSet: (value: CullDecisionValue) => void;
}

function CullClipCard({ decision, onSet }: ClipCardProps) {
  const thumbSrc = decision.thumbnails[0] ? convertFileSrc(decision.thumbnails[0]) : null;
  const decisionTone =
    decision.decision === "keep"
      ? "ready"
      : decision.decision === "reject"
      ? "risk-high"
      : decision.decision === "maybe"
      ? "risk-medium"
      : "stub";

  return (
    <div className="clip-card">
      <div className="clip-thumb">
        {thumbSrc ? (
          <img src={thumbSrc} alt={decision.clipName} loading="lazy" />
        ) : (
          <div className="clip-thumb-placeholder">no thumb</div>
        )}
        {(decision.highlightScore ?? 0) >= 70 && (
          <span className="clip-badge"><IconStar /> {decision.highlightScore}</span>
        )}
      </div>
      <div className="clip-body">
        <div className="clip-name" title={decision.clipPath}>
          {decision.clipName}
        </div>
        <div className="clip-meta">
          {decision.scene && <span className="chip">{decision.scene}</span>}
          <span className={`chip ${decisionTone}`}>{decision.decision}</span>
          {decision.aiSuggestion && decision.aiSuggestion !== decision.decision && (
            <span className="chip" title="AI suggested">
              ai: {decision.aiSuggestion}
            </span>
          )}
          {decision.userOverrode && <span className="chip">overridden</span>}
        </div>
        <div className="clip-meta clip-meta-small">
          {decision.durationSeconds != null && <span>{decision.durationSeconds.toFixed(1)}s</span>}
          <span>{FORMAT_MB(decision.sizeBytes)}</span>
          {decision.qualityScore != null && <span>Q{decision.qualityScore}</span>}
          {decision.highlightScore != null && <span>H{decision.highlightScore}</span>}
        </div>
        {decision.notes && <div className="clip-notes">{decision.notes}</div>}
        {decision.tags.length > 0 && (
          <div className="clip-meta">
            {decision.tags.slice(0, 4).map((t) => (
              <span key={t} className="chip" style={{ fontSize: 9 }}>
                {t}
              </span>
            ))}
          </div>
        )}
        <div className="clip-actions">
          <button
            className={`small ${decision.decision === "keep" ? "primary" : ""}`}
            onClick={() => onSet("keep")}
          >
            Keep
          </button>
          <button
            className={`small ${decision.decision === "maybe" ? "primary" : ""}`}
            onClick={() => onSet("maybe")}
          >
            Maybe
          </button>
          <button
            className={`small ${decision.decision === "reject" ? "primary" : ""}`}
            onClick={() => onSet("reject")}
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}
