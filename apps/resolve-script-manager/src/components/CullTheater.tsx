/**
 * Live cull visualisation — "Magic Cut Theater".
 *
 * Listens for `clip_decision` events from cull_folder.py and renders:
 *   - Spotlight (large) of the most-recently-judged clip with the AI's reasoning
 *   - Recent-history grid behind it (last ~24 clips, fade-in)
 *   - Running tally + cost estimate
 *
 * cull_folder.py emits one `clip_decision` event per clip with thumbnailPath
 * pointing into ~/Library/Application Support/.../thumbnails/. We use Tauri's
 * convertFileSrc() to expose those local files to the webview via the asset
 * protocol.
 */

import { useEffect, useMemo, useState } from "react";
import { convertFileSrc } from "../api";
import { IconCheck, IconX, IconWarning, IconSparkle, IconStar } from "./Icons";

interface ClipDecisionEvent {
  type: "clip_decision";
  clipName: string;
  clipPath: string;
  thumbnailPath: string | null;
  decision: "keep" | "reject" | "maybe" | "pending";
  aiSuggestion?: string | null;
  qualityScore?: number | null;
  highlightScore?: number | null;
  scene?: string | null;
  tags?: string[];
  notes?: string | null;
  index?: number;
  total?: number;
}

interface Props {
  /**
   * Stream of clip_decision events. Parent (MagicCutDialog) subscribes to
   * script-event and pushes matching events into this prop as they arrive.
   */
  decisions: ClipDecisionEvent[];
  /** Overall pipeline progress 0..100 — drawn as the top bar. */
  progressPercent: number;
  progressLabel: string;
  /** True while we're still in cull phase (controls the spotlight UI). */
  isActive: boolean;
}

function decisionTone(d: ClipDecisionEvent["decision"]): "ok" | "danger" | "warning" | "muted" {
  if (d === "keep") return "ok";
  if (d === "reject") return "danger";
  if (d === "maybe") return "warning";
  return "muted";
}

function decisionLabel(d: ClipDecisionEvent["decision"]): string {
  if (d === "keep") return "KEEP";
  if (d === "reject") return "SKIP";
  if (d === "maybe") return "MAYBE";
  return "…";
}

function buildNarration(c: ClipDecisionEvent): string {
  // Compose a natural-language sentence from notes + decision so it feels
  // like the AI is talking us through the cut. Falls back to terse text
  // when notes are missing.
  const note = (c.notes ?? "").trim();
  const sceneTag = c.scene ? ` (${c.scene.replace(/_/g, " ")})` : "";
  if (c.decision === "keep") {
    if (note) return `Picking this one${sceneTag} — ${note}`;
    return `Picking ${c.clipName}${sceneTag} — good shot.`;
  }
  if (c.decision === "reject") {
    if (note) return `Skipping${sceneTag} — ${note}`;
    return `Skipping ${c.clipName}${sceneTag}.`;
  }
  if (c.decision === "maybe") {
    if (note) return `Marking as maybe${sceneTag} — ${note}`;
    return `Could go either way${sceneTag}.`;
  }
  return note || "Reviewing…";
}

export function CullTheater({ decisions, progressPercent, progressLabel, isActive }: Props) {
  const spotlight = decisions.length > 0 ? decisions[decisions.length - 1] : null;
  const history = useMemo(() => decisions.slice(0, -1).slice(-23).reverse(), [decisions]);

  // Force a re-render keyed by spotlight clipPath so fade-in animation
  // re-plays each time a new clip lands.
  const [spotlightKey, setSpotlightKey] = useState(0);
  useEffect(() => {
    setSpotlightKey((k) => k + 1);
  }, [spotlight?.clipPath]);

  const tally = useMemo(() => {
    const t = { keep: 0, reject: 0, maybe: 0, pending: 0 };
    for (const d of decisions) t[d.decision] += 1;
    return t;
  }, [decisions]);

  return (
    <div className="cull-theater">
      {/* Progress bar */}
      <div className="cull-theater-progress">
        <div className="cull-theater-progress-row">
          <strong>{progressLabel || "Culling…"}</strong>
          <span className="card-chip-meta">{Math.round(progressPercent)}%</span>
        </div>
        <div className="cull-theater-bar">
          <div
            className="cull-theater-bar-fill"
            style={{ width: `${Math.min(100, progressPercent)}%` }}
          />
        </div>
      </div>

      {/* Spotlight — the clip currently being judged */}
      {spotlight ? (
        <div className={`cull-theater-spotlight tone-${decisionTone(spotlight.decision)}`} key={spotlightKey}>
          <div className="cull-theater-spotlight-thumb">
            {spotlight.thumbnailPath ? (
              <img src={convertFileSrc(spotlight.thumbnailPath)} alt={spotlight.clipName} />
            ) : (
              <div className="cull-theater-thumb-placeholder">
                {isActive ? "…" : "✗"}
              </div>
            )}
          </div>
          <div className="cull-theater-spotlight-meta">
            <div className="cull-theater-spotlight-decision">
              {spotlight.decision === "keep" && <><IconCheck /> KEEP</>}
              {spotlight.decision === "reject" && <><IconX /> SKIP</>}
              {spotlight.decision === "maybe" && <><IconWarning /> MAYBE</>}
              {spotlight.decision === "pending" && <>…</>}
            </div>
            <div className="cull-theater-spotlight-name">{spotlight.clipName}</div>
            {(spotlight.qualityScore != null || spotlight.highlightScore != null) && (
              <div className="cull-theater-spotlight-scores">
                {spotlight.qualityScore != null && (
                  <span>Quality {spotlight.qualityScore}/10</span>
                )}
                {spotlight.highlightScore != null && (
                  <span><IconStar /> {spotlight.highlightScore}/10</span>
                )}
              </div>
            )}
            {spotlight.scene && (
              <div className="cull-theater-spotlight-scene">
                {spotlight.scene.replace(/_/g, " ")}
              </div>
            )}
            <div className="cull-theater-narration">
              <IconSparkle /> {buildNarration(spotlight)}
            </div>
            {spotlight.tags && spotlight.tags.length > 0 && (
              <div className="cull-theater-tags">
                {spotlight.tags.slice(0, 5).map((t) => (
                  <span key={t} className="cull-theater-tag">{t}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="cull-theater-spotlight tone-muted">
          <div className="cull-theater-thumb-placeholder large">…</div>
          <div className="cull-theater-spotlight-meta">
            <div className="cull-theater-narration">
              <IconSparkle /> Venter på første klipp…
            </div>
          </div>
        </div>
      )}

      {/* Recent-history strip */}
      {history.length > 0 && (
        <div className="cull-theater-strip">
          {history.map((c) => (
            <div
              key={c.clipPath}
              className={`cull-theater-tile tone-${decisionTone(c.decision)}`}
              title={`${c.clipName} · ${decisionLabel(c.decision)}${c.notes ? ` · ${c.notes.slice(0, 100)}` : ""}`}
            >
              {c.thumbnailPath ? (
                <img src={convertFileSrc(c.thumbnailPath)} alt={c.clipName} />
              ) : (
                <div className="cull-theater-thumb-placeholder small">
                  {c.decision === "reject" ? "✗" : "…"}
                </div>
              )}
              {c.qualityScore != null && (
                <span className="cull-theater-tile-score">{c.qualityScore}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tally */}
      <div className="cull-theater-tally">
        <span className="chip ready">{tally.keep} keep</span>
        <span className="chip risk-high">{tally.reject} skip</span>
        <span className="chip needs-check">{tally.maybe} maybe</span>
        {tally.pending > 0 && (
          <span className="chip stub">{tally.pending} pending</span>
        )}
      </div>
    </div>
  );
}

export type { ClipDecisionEvent };
