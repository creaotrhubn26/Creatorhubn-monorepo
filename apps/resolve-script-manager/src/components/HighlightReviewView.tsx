/**
 * HighlightReviewView — interactive review for extract_highlight_from_film's
 * interactiveReview mode. Each shot plays as a looping <video> between its
 * startSec/endSec. User can keep/skip, adjust in/out by ±0.25s, split a shot
 * in two, merge two adjacent shots, reorder, then build the final Resolve
 * timeline from approved picks.
 *
 * Keyboard shortcuts (#201):
 *   Space     — play/pause focused clip
 *   K         — keep (approve) focused
 *   X         — skip (un-approve) focused
 *   J / ←     — focus previous
 *   L / →     — focus next
 *   S         — split focused at current playhead
 *   M         — merge focused with next pick
 *   Cmd+Z     — undo
 *   Cmd+⇧+Z   — redo
 *   Cmd+A     — approve all
 *   Cmd+⌥+A   — skip all
 *
 * State persistence (#210): pick state is auto-saved to localStorage every
 * 5 seconds (keyed on sourceVideo path). Page refresh restores the user's
 * latest edits without needing to re-run the extract.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { executeScript } from "../api";

interface Pick {
  index: number;
  startSec: number;
  endSec: number;
  durationSec?: number;
  motion?: number;
  audio?: number;
  score?: number;
  thumbnailPath?: string;
  chapter?: string;
}

interface PicksPayload {
  sourceVideo: string;
  timelineName?: string;
  fps?: number;
  picks: Pick[];
}

interface ReviewState extends Pick {
  approved: boolean;
}

interface HistoryEntry {
  picks: ReviewState[];
  description: string;
}

interface Props {
  picksPath: string;
  onClose: () => void;
  onBuilt: (result: unknown) => void;
}

const HISTORY_DEPTH = 30;
const AUTOSAVE_INTERVAL_MS = 5_000;
const LOW_SCORE_THRESHOLD = 0.30;
const MID_SCORE_THRESHOLD = 0.55;

function localStorageKey(sourceVideo: string): string {
  return `highlight-review:${sourceVideo}`;
}

export function HighlightReviewView({ picksPath, onClose, onBuilt }: Props) {
  const [payload, setPayload] = useState<PicksPayload | null>(null);
  const [picks, setPicksRaw] = useState<ReviewState[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [filterLowScore, setFilterLowScore] = useState(false);

  // Undo/redo history stack (#211)
  const historyRef = useRef<HistoryEntry[]>([]);
  const historyIndexRef = useRef<number>(-1);

  const setPicks = useCallback(
    (
      updater: ReviewState[] | ((prev: ReviewState[]) => ReviewState[]),
      historyDescription?: string,
    ) => {
      setPicksRaw((prev) => {
        const next = typeof updater === "function" ? (updater as (p: ReviewState[]) => ReviewState[])(prev) : updater;
        if (historyDescription) {
          // Push new entry, drop redo branch
          const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
          newHistory.push({ picks: prev, description: historyDescription });
          if (newHistory.length > HISTORY_DEPTH) newHistory.shift();
          historyRef.current = newHistory;
          historyIndexRef.current = newHistory.length - 1;
        }
        return next;
      });
    },
    [],
  );

  const undo = useCallback(() => {
    if (historyIndexRef.current < 0) return;
    const entry = historyRef.current[historyIndexRef.current];
    if (!entry) return;
    historyIndexRef.current -= 1;
    setPicksRaw(entry.picks);
  }, []);

  const redo = useCallback(() => {
    const nextIdx = historyIndexRef.current + 1;
    if (nextIdx >= historyRef.current.length) return;
    // Redo restores the picks state stored "above" the change pointer.
    // Simplest model: history stores undo-targets, so redo just re-applies
    // the current picks-snapshot one step ahead. We approximate by jumping
    // to the next state and popping into picksRaw without rewriting history.
    historyIndexRef.current = nextIdx;
    setPicksRaw(historyRef.current[nextIdx].picks);
  }, []);

  // Load picks payload from cache file
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const url = convertFileSrc(picksPath);
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Could not load picks (HTTP ${res.status})`);
        const data = (await res.json()) as PicksPayload;
        if (cancelled) return;
        setPayload(data);
        // Restore from localStorage if a saved review exists for this source
        const savedKey = localStorageKey(data.sourceVideo);
        const saved = localStorage.getItem(savedKey);
        if (saved) {
          try {
            const parsed = JSON.parse(saved) as ReviewState[];
            if (Array.isArray(parsed) && parsed.length > 0) {
              setPicksRaw(parsed);
              return;
            }
          } catch {
            // fall through to fresh load
          }
        }
        setPicksRaw((data.picks || []).map((p) => ({ ...p, approved: true })));
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [picksPath]);

  // Auto-save to localStorage every 5s (#210)
  useEffect(() => {
    if (!payload?.sourceVideo || picks.length === 0) return;
    const key = localStorageKey(payload.sourceVideo);
    const id = setInterval(() => {
      try {
        localStorage.setItem(key, JSON.stringify(picks));
      } catch {
        // quota or storage disabled — silent
      }
    }, AUTOSAVE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [picks, payload?.sourceVideo]);

  const sourceSrc = useMemo(
    () => (payload?.sourceVideo ? convertFileSrc(payload.sourceVideo) : ""),
    [payload?.sourceVideo],
  );

  const visiblePicks = useMemo(
    () => (filterLowScore ? picks.filter((p) => (p.score ?? 0) < LOW_SCORE_THRESHOLD) : picks),
    [picks, filterLowScore],
  );

  const approvedCount = picks.filter((p) => p.approved).length;
  const approvedDuration = picks
    .filter((p) => p.approved)
    .reduce((sum, p) => sum + (p.endSec - p.startSec), 0);

  const updatePick = useCallback(
    (index: number, patch: Partial<ReviewState>, historyDescription?: string) => {
      setPicks(
        (prev) => prev.map((p) => (p.index === index ? { ...p, ...patch } : p)),
        historyDescription,
      );
    },
    [setPicks],
  );

  // Bulk actions (#209)
  const approveAll = useCallback(() => {
    setPicks((prev) => prev.map((p) => ({ ...p, approved: true })), "approve all");
  }, [setPicks]);
  const skipAll = useCallback(() => {
    setPicks((prev) => prev.map((p) => ({ ...p, approved: false })), "skip all");
  }, [setPicks]);

  // Split focused pick at half-way between its current start/end (#204)
  const splitFocused = useCallback(() => {
    const target = visiblePicks[focusedIndex];
    if (!target) return;
    const mid = (target.startSec + target.endSec) / 2;
    if (mid - target.startSec < 0.5 || target.endSec - mid < 0.5) return; // too short to split
    setPicks((prev) => {
      const targetIdx = prev.findIndex((p) => p.index === target.index);
      if (targetIdx < 0) return prev;
      const maxIdx = Math.max(...prev.map((p) => p.index));
      const left = { ...target, endSec: mid, durationSec: mid - target.startSec };
      const right = { ...target, index: maxIdx + 1, startSec: mid, durationSec: target.endSec - mid };
      return [...prev.slice(0, targetIdx), left, right, ...prev.slice(targetIdx + 1)];
    }, "split pick");
  }, [visiblePicks, focusedIndex, setPicks]);

  // Merge focused pick with the next one (#205)
  const mergeFocused = useCallback(() => {
    const target = visiblePicks[focusedIndex];
    const next = visiblePicks[focusedIndex + 1];
    if (!target || !next) return;
    setPicks((prev) => {
      const tIdx = prev.findIndex((p) => p.index === target.index);
      const nIdx = prev.findIndex((p) => p.index === next.index);
      if (tIdx < 0 || nIdx < 0) return prev;
      const merged = {
        ...target,
        startSec: Math.min(target.startSec, next.startSec),
        endSec: Math.max(target.endSec, next.endSec),
        durationSec: Math.max(target.endSec, next.endSec) - Math.min(target.startSec, next.startSec),
        approved: target.approved && next.approved,
      };
      // Remove both originals and insert merged at target's position
      const lowerIdx = Math.min(tIdx, nIdx);
      const others = prev.filter((_, i) => i !== tIdx && i !== nIdx);
      others.splice(lowerIdx, 0, merged);
      return others;
    }, "merge picks");
  }, [visiblePicks, focusedIndex, setPicks]);

  // Reorder (drag-and-drop) — #203
  const reorderPicks = useCallback(
    (fromIdx: number, toIdx: number) => {
      if (fromIdx === toIdx) return;
      setPicks((prev) => {
        const from = visiblePicks[fromIdx];
        const to = visiblePicks[toIdx];
        if (!from || !to) return prev;
        const fromGlobal = prev.findIndex((p) => p.index === from.index);
        const toGlobal = prev.findIndex((p) => p.index === to.index);
        if (fromGlobal < 0 || toGlobal < 0) return prev;
        const next = [...prev];
        const [moved] = next.splice(fromGlobal, 1);
        next.splice(toGlobal, 0, moved);
        return next;
      }, "reorder picks");
    },
    [visiblePicks, setPicks],
  );

  // Keyboard shortcuts (#201 + #211)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName?.toUpperCase();
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (meta && e.key.toLowerCase() === "a") {
        e.preventDefault();
        if (e.altKey) skipAll();
        else approveAll();
        return;
      }
      const target = visiblePicks[focusedIndex];
      switch (e.key.toLowerCase()) {
        case " ":
        case "spacebar":
          e.preventDefault();
          document.dispatchEvent(new CustomEvent("hr:toggle-play", { detail: target?.index }));
          break;
        case "k":
          if (target) updatePick(target.index, { approved: true }, "keep");
          break;
        case "x":
          if (target) updatePick(target.index, { approved: false }, "skip");
          break;
        case "j":
        case "arrowleft":
          setFocusedIndex((i) => Math.max(0, i - 1));
          break;
        case "l":
        case "arrowright":
          setFocusedIndex((i) => Math.min(visiblePicks.length - 1, i + 1));
          break;
        case "s":
          splitFocused();
          break;
        case "m":
          mergeFocused();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visiblePicks, focusedIndex, updatePick, undo, redo, approveAll, skipAll, splitFocused, mergeFocused]);

  async function buildTimeline() {
    if (!payload) return;
    const approved = picks.filter((p) => p.approved);
    if (approved.length === 0) {
      setError("Du har ikke approved noen klipp ennå");
      return;
    }
    setBuilding(true);
    setError(null);
    try {
      const result = await executeScript("build_highlight_from_picks", {
        picks: approved.map((p) => ({
          startSec: p.startSec,
          endSec: p.endSec,
          index: p.index,
        })),
        sourceVideo: payload.sourceVideo,
        timelineName: payload.timelineName,
      }, false);
      const err = result.events.find((e) => e.type === "error")?.value as { message?: string } | undefined;
      if (err?.message) {
        setError(err.message);
        return;
      }
      // Clear localStorage on successful build (#210)
      try {
        localStorage.removeItem(localStorageKey(payload.sourceVideo));
      } catch { /* ignore */ }
      onBuilt(result.events.find((e) => e.type === "result")?.value);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBuilding(false);
    }
  }

  if (!payload) {
    return (
      <div className="modal-backdrop anim-fade-in" onClick={onClose}>
        <div className="modal anim-slide-up" style={{ width: 400 }} onClick={(e) => e.stopPropagation()}>
          {error ? <div style={{ color: "#ef4f6f" }}>{error}</div> : <div>Laster picks…</div>}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(10,5,24,0.96)",
      zIndex: 200, overflow: "auto", padding: 16,
    }}>
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        {/* Sticky toolbar (#206) */}
        <div style={{
          position: "sticky", top: 0, zIndex: 10,
          background: "rgba(10,5,24,0.98)", padding: "12px 0 12px 0",
          marginBottom: 16, borderBottom: "1px solid #2c1860",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 18 }}>Review highlight picks</h2>
              <div style={{ fontSize: 12, color: "#b8a8d8", marginTop: 4 }}>
                {payload.sourceVideo.split("/").pop()} · {payload.picks.length} kandidater
                {filterLowScore && ` · viser ${visiblePicks.length} med score < ${LOW_SCORE_THRESHOLD}`}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ fontSize: 13, color: "#d8c8e8" }}>
                <strong style={{ color: "#a030c0" }}>{approvedCount}</strong>/{picks.length} approved ·{" "}
                <strong>{approvedDuration.toFixed(1)}s</strong>
              </div>
              <button onClick={approveAll} disabled={building} style={smallBtn}>Approve all</button>
              <button onClick={skipAll} disabled={building} style={smallBtn}>Skip all</button>
              <label style={{ fontSize: 12, color: "#b8a8d8", display: "flex", alignItems: "center", gap: 4 }}>
                <input
                  type="checkbox"
                  checked={filterLowScore}
                  onChange={(e) => setFilterLowScore(e.target.checked)}
                  disabled={building}
                />
                Vis kun lavt-score
              </label>
              <button onClick={undo} disabled={building || historyIndexRef.current < 0}
                title="Cmd+Z" style={smallBtn}>↶ Undo</button>
              <button onClick={redo} disabled={building || historyIndexRef.current + 1 >= historyRef.current.length}
                title="Cmd+Shift+Z" style={smallBtn}>↷ Redo</button>
              <button onClick={onClose} disabled={building} style={{
                background: "transparent", border: "1px solid #2c1860",
                color: "#b8a8d8", padding: "6px 14px", borderRadius: 6,
                cursor: building ? "default" : "pointer", fontSize: 12,
              }}>Avbryt</button>
              <button onClick={buildTimeline} disabled={building || approvedCount === 0} style={{
                background: "#a030c0", border: "none", color: "white",
                padding: "8px 16px", borderRadius: 6, fontSize: 13, fontWeight: 600,
                cursor: building || approvedCount === 0 ? "default" : "pointer",
              }}>
                {building ? "Bygger…" : `Bygg timeline med ${approvedCount} klipp`}
              </button>
            </div>
          </div>
          <div style={{ marginTop: 6, fontSize: 10, color: "#7660a0" }}>
            Tastatur: <kbd style={kbd}>K</kbd> keep · <kbd style={kbd}>X</kbd> skip ·{" "}
            <kbd style={kbd}>J</kbd>/<kbd style={kbd}>L</kbd> bla ·{" "}
            <kbd style={kbd}>Space</kbd> play · <kbd style={kbd}>S</kbd> split ·{" "}
            <kbd style={kbd}>M</kbd> merge · <kbd style={kbd}>⌘Z</kbd> undo
          </div>
        </div>

        {error && (
          <div style={{
            padding: 10, marginBottom: 12,
            background: "rgba(239,79,111,0.1)", border: "1px solid #ef4f6f",
            color: "#ef4f6f", borderRadius: 6, fontSize: 13,
          }}>{error}</div>
        )}

        {/* Preload next 3 clip ranges in hidden players for faster bla (#202) */}
        <div style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}>
          {[1, 2, 3].map((offset) => {
            const next = visiblePicks[focusedIndex + offset];
            if (!next) return null;
            return (
              <video key={`preload-${next.index}`} src={sourceSrc} preload="auto"
                     muted playsInline aria-hidden="true" />
            );
          })}
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))",
          gap: 12,
        }}>
          {visiblePicks.map((p, displayIdx) => (
            <ShotCard
              key={p.index}
              sourceSrc={sourceSrc}
              pick={p}
              displayIndex={displayIdx}
              isFocused={displayIdx === focusedIndex}
              onFocus={() => setFocusedIndex(displayIdx)}
              onChange={(patch, desc) => updatePick(p.index, patch, desc)}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", String(displayIdx));
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const from = parseInt(e.dataTransfer.getData("text/plain"), 10);
                if (!isNaN(from)) reorderPicks(from, displayIdx);
              }}
              disabled={building}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function scoreColor(score: number | undefined): string {
  const s = score ?? 0;
  if (s < LOW_SCORE_THRESHOLD) return "#ef4f6f";    // rød
  if (s < MID_SCORE_THRESHOLD) return "#f0b030";    // gul
  return "#3fc77f";                                 // grønn
}

function ShotCard({
  sourceSrc,
  pick,
  displayIndex,
  isFocused,
  onFocus,
  onChange,
  onDragStart,
  onDragOver,
  onDrop,
  disabled,
}: {
  sourceSrc: string;
  pick: { index: number; startSec: number; endSec: number; score?: number;
          motion?: number; audio?: number; chapter?: string; approved: boolean };
  displayIndex: number;
  isFocused: boolean;
  onFocus: () => void;
  onChange: (patch: Partial<{ startSec: number; endSec: number; approved: boolean }>,
             historyDescription?: string) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  disabled: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTimeUpdate = () => {
      if (v.currentTime >= pick.endSec) {
        v.currentTime = pick.startSec;
      }
    };
    v.addEventListener("timeupdate", onTimeUpdate);
    return () => { v.removeEventListener("timeupdate", onTimeUpdate); };
  }, [pick.startSec, pick.endSec]);

  // Space-key toggle dispatched from global handler
  useEffect(() => {
    if (!isFocused) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail !== pick.index) return;
      const v = videoRef.current;
      if (!v) return;
      if (v.paused) { v.currentTime = pick.startSec; v.play(); setPlaying(true); }
      else { v.pause(); setPlaying(false); }
    };
    document.addEventListener("hr:toggle-play", handler);
    return () => document.removeEventListener("hr:toggle-play", handler);
  }, [isFocused, pick.index, pick.startSec]);

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.currentTime = pick.startSec;
      v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  }

  function adjustStart(delta: number) {
    const newStart = Math.max(0, Math.min(pick.endSec - 0.25, pick.startSec + delta));
    onChange({ startSec: parseFloat(newStart.toFixed(2)) }, "adjust start");
  }
  function adjustEnd(delta: number) {
    const newEnd = Math.max(pick.startSec + 0.25, pick.endSec + delta);
    onChange({ endSec: parseFloat(newEnd.toFixed(2)) }, "adjust end");
  }

  const dur = pick.endSec - pick.startSec;
  const borderColor = pick.approved
    ? (isFocused ? "#ffcc55" : "#a030c0")
    : (isFocused ? "#ffcc55" : "#2c1860");

  return (
    <div
      onClick={onFocus}
      draggable={!disabled}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={{
        background: "rgba(26,13,69,0.6)",
        border: `2px solid ${borderColor}`,
        borderRadius: 10, overflow: "hidden",
        opacity: pick.approved ? 1 : 0.5,
        cursor: disabled ? "default" : "grab",
        outline: isFocused ? "2px solid rgba(255,204,85,0.4)" : "none",
      }}>
      <div style={{ position: "relative", background: "black", aspectRatio: "16/9" }}>
        <video
          ref={videoRef}
          src={sourceSrc}
          muted
          playsInline
          preload="metadata"
          style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
          onLoadedMetadata={(e) => {
            (e.target as HTMLVideoElement).currentTime = pick.startSec;
          }}
        />
        <button
          onClick={(e) => { e.stopPropagation(); togglePlay(); }}
          disabled={disabled}
          style={{
            position: "absolute", inset: 0, background: "transparent",
            border: "none", cursor: disabled ? "default" : "pointer",
            color: "white", fontSize: 32,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          {playing ? "" : "▶"}
        </button>
        {/* Color-coded score badge — #207 */}
        <div style={{
          position: "absolute", top: 6, left: 6, padding: "2px 6px",
          background: scoreColor(pick.score), color: "white", fontSize: 10,
          fontWeight: 700, borderRadius: 4, letterSpacing: 0.4,
        }}>
          {(pick.score ?? 0).toFixed(2)}
        </div>
        {pick.chapter && (
          <div style={{
            position: "absolute", top: 6, right: 6, padding: "2px 6px",
            background: "rgba(0,0,0,0.6)", color: "#d8c8e8", fontSize: 10,
            borderRadius: 4,
          }}>{pick.chapter}</div>
        )}
      </div>

      <div style={{ padding: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: "#8674a8" }}>
            #{pick.index} · {dur.toFixed(1)}s · pos {displayIndex + 1}
          </span>
          <label
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={pick.approved}
              onChange={(e) => onChange({ approved: e.target.checked },
                                        e.target.checked ? "keep" : "skip")}
              disabled={disabled}
            />
            Bruk
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 11 }}>
          <div>
            <div style={{ color: "#8674a8", marginBottom: 2 }}>Fra sekund</div>
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <button onClick={(e) => { e.stopPropagation(); adjustStart(-0.25); }}
                      disabled={disabled} style={btnStyle}>−</button>
              <input
                type="number"
                step="0.1"
                value={pick.startSec}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (!isNaN(v) && v < pick.endSec) onChange({ startSec: v }, "edit start");
                }}
                onClick={(e) => e.stopPropagation()}
                disabled={disabled}
                style={numInputStyle}
              />
              <button onClick={(e) => { e.stopPropagation(); adjustStart(+0.25); }}
                      disabled={disabled} style={btnStyle}>+</button>
            </div>
          </div>
          <div>
            <div style={{ color: "#8674a8", marginBottom: 2 }}>Til sekund</div>
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <button onClick={(e) => { e.stopPropagation(); adjustEnd(-0.25); }}
                      disabled={disabled} style={btnStyle}>−</button>
              <input
                type="number"
                step="0.1"
                value={pick.endSec}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (!isNaN(v) && v > pick.startSec) onChange({ endSec: v }, "edit end");
                }}
                onClick={(e) => e.stopPropagation()}
                disabled={disabled}
                style={numInputStyle}
              />
              <button onClick={(e) => { e.stopPropagation(); adjustEnd(+0.25); }}
                      disabled={disabled} style={btnStyle}>+</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  width: 22, height: 22, padding: 0,
  background: "rgba(160,48,192,0.2)", border: "1px solid #a030c0",
  color: "#a030c0", borderRadius: 4, cursor: "pointer", fontSize: 13,
};

const numInputStyle: React.CSSProperties = {
  flex: 1, minWidth: 0, padding: "3px 6px",
  background: "#0a0518", border: "1px solid #2c1860",
  color: "#f0eaff", borderRadius: 4, fontSize: 11,
};

const smallBtn: React.CSSProperties = {
  background: "transparent", border: "1px solid #2c1860",
  color: "#b8a8d8", padding: "4px 10px", borderRadius: 4,
  cursor: "pointer", fontSize: 11,
};

const kbd: React.CSSProperties = {
  padding: "1px 5px", border: "1px solid #2c1860", borderRadius: 3,
  background: "rgba(26,13,69,0.5)", fontFamily: "monospace", fontSize: 10,
};
