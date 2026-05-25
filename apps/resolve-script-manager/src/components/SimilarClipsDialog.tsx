import { useMemo } from "react";
import { convertFileSrc } from "../api";
import type { CullDecision, CullDecisionValue, CullSession, SimilarGroup } from "../types";
import { IconMusic } from "./Icons";

interface Props {
  session: CullSession;
  onClose: () => void;
  onUpdate: (next: CullSession) => void;
}

function decisionsToMap(decisions: CullDecision[]): Map<string, CullDecision> {
  return new Map(decisions.map((d) => [d.clipPath, d]));
}

function findDecisionByName(decisions: CullDecision[], name: string): CullDecision | undefined {
  return decisions.find((d) => d.clipName === name);
}

export function SimilarClipsDialog({ session, onClose, onUpdate }: Props) {
  const groups = session.similarGroups ?? [];
  const byPath = useMemo(() => decisionsToMap(session.decisions), [session.decisions]);

  function applyDecisionToClip(path: string, decision: CullDecisionValue, next: CullSession): CullSession {
    return {
      ...next,
      decisions: next.decisions.map((d) =>
        d.clipPath === path ? { ...d, decision, userOverrode: true } : d,
      ),
    };
  }

  function applyDecisionToName(name: string, decision: CullDecisionValue, next: CullSession): CullSession {
    return {
      ...next,
      decisions: next.decisions.map((d) =>
        d.clipName === name ? { ...d, decision, userOverrode: true } : d,
      ),
    };
  }

  function pickHero(group: SimilarGroup, heroName: string) {
    let next = { ...session, updatedAt: new Date().toISOString() };
    for (const clipName of group.clipNames) {
      if (clipName === heroName) {
        next = applyDecisionToName(clipName, "keep", next);
      } else {
        next = applyDecisionToName(clipName, "maybe", next);
      }
    }
    onUpdate(next);
  }

  function acceptAiSuggestion(group: SimilarGroup) {
    if (!group.hero) return;
    let next = { ...session, updatedAt: new Date().toISOString() };
    for (const clipName of group.clipNames) {
      if (clipName === group.hero) {
        next = applyDecisionToName(clipName, "keep", next);
      } else if (group.alternates.includes(clipName)) {
        next = applyDecisionToName(clipName, "maybe", next);
      } else if (group.rejects.includes(clipName)) {
        next = applyDecisionToName(clipName, "reject", next);
      } else {
        next = applyDecisionToName(clipName, "maybe", next);
      }
    }
    onUpdate(next);
  }

  function keepAll(group: SimilarGroup) {
    let next = { ...session, updatedAt: new Date().toISOString() };
    for (const clipName of group.clipNames) {
      next = applyDecisionToName(clipName, "keep", next);
    }
    onUpdate(next);
  }

  function setOne(path: string, decision: CullDecisionValue) {
    onUpdate(applyDecisionToClip(path, decision, { ...session, updatedAt: new Date().toISOString() }));
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 820, maxWidth: "95vw", maxHeight: "85vh" }}
      >
        <h2>Review similar clips · {groups.length} group{groups.length === 1 ? "" : "s"}</h2>
        <div className="desc">
          AI har undersøkt scene-tag, start-timecode <em>og lyd-fingerprint</em>. Hvor lyden bekrefter at klippene er fra samme øyeblikk, vises et grønt "audio confirmed"-merke. Du velger hero-takeen og hva som skjer med resten.
        </div>

        {groups.length === 0 ? (
          <div className="empty">No similar groups found.</div>
        ) : (
          <div style={{ overflow: "auto", flex: 1 }}>
            {groups.map((group) => (
              <div key={group.groupId} className="similar-group">
                <div className="similar-group-header">
                  <div>
                    <strong>{group.scene}</strong>
                    {group.startTimecode && <span className="card-chip-cam">@ {group.startTimecode}</span>}
                    <span className="card-chip-meta">{group.clipPaths.length} clips</span>
                    {group.audioConfidence === "confirmed" && (
                      <span className="chip ready" title={group.audioMatchNote ?? undefined} style={{ marginLeft: 6 }}>
                        <IconMusic /> audio confirmed
                      </span>
                    )}
                    {group.audioConfidence === "partial" && (
                      <span className="chip risk-medium" title={group.audioMatchNote ?? undefined} style={{ marginLeft: 6 }}>
                        <IconMusic /> audio partial
                      </span>
                    )}
                    {group.audioConfidence === "metadata_only" && (
                      <span className="chip" title={group.audioMatchNote ?? undefined} style={{ marginLeft: 6 }}>
                        metadata only (audio differs)
                      </span>
                    )}
                    {group.audioConfidence === "unavailable" && (
                      <span className="chip" title="brew install chromaprint to enable audio fingerprinting" style={{ marginLeft: 6 }}>
                        audio: install chromaprint
                      </span>
                    )}
                  </div>
                  <div className="cull-actions">
                    {group.hero && (
                      <button className="small" onClick={() => acceptAiSuggestion(group)}>
                        Accept AI · hero: {group.hero}
                      </button>
                    )}
                    <button className="small" onClick={() => keepAll(group)}>
                      Keep all
                    </button>
                  </div>
                </div>
                {group.audioMatchNote && (
                  <div className="clip-notes" style={{ marginBottom: 4, fontStyle: "italic" }}>
                    🔊 {group.audioMatchNote}
                  </div>
                )}
                {group.heroReasoning && (
                  <div className="clip-notes" style={{ marginBottom: 8 }}>
                    AI: {group.heroReasoning}
                  </div>
                )}
                <div className="similar-group-clips">
                  {group.clipPaths.map((path, idx) => {
                    const name = group.clipNames[idx];
                    const decision = byPath.get(path) ?? findDecisionByName(session.decisions, name);
                    if (!decision) return null;
                    const thumb = decision.thumbnails[0]
                      ? convertFileSrc(decision.thumbnails[0])
                      : null;
                    const isHero = group.hero === name;
                    const isAlternate = group.alternates.includes(name);
                    const isReject = group.rejects.includes(name);
                    return (
                      <div
                        key={path}
                        className={`similar-clip ${isHero ? "hero" : ""}`}
                      >
                        {thumb ? (
                          <img src={thumb} alt={name} loading="lazy" />
                        ) : (
                          <div className="clip-thumb-placeholder" style={{ height: 100 }}>no thumb</div>
                        )}
                        <div className="similar-clip-name" title={path}>{name}</div>
                        <div className="clip-meta">
                          {isHero && <span className="chip ready">hero</span>}
                          {isAlternate && <span className="chip">alt</span>}
                          {isReject && <span className="chip risk-high">reject</span>}
                          {decision.qualityScore != null && <span className="clip-meta-small">Q{decision.qualityScore}</span>}
                          {decision.highlightScore != null && <span className="clip-meta-small">H{decision.highlightScore}</span>}
                          <span className={`chip ${decision.decision === "keep" ? "ready" : decision.decision === "reject" ? "risk-high" : "risk-medium"}`}>
                            {decision.decision}
                          </span>
                        </div>
                        <div className="clip-actions">
                          <button
                            className={`small ${decision.decision === "keep" ? "primary" : ""}`}
                            onClick={() => pickHero(group, name)}
                          >
                            Pick as hero
                          </button>
                          <button className="small" onClick={() => setOne(path, "maybe")}>
                            Maybe
                          </button>
                          <button className="small" onClick={() => setOne(path, "reject")}>
                            Reject
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="actions">
          <button onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
