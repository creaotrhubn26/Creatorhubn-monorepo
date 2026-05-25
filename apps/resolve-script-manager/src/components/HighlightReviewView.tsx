/**
 * HighlightReviewView — interactive review for extract_highlight_from_film's
 * interactiveReview mode. Each shot plays as a looping <video> between its
 * startSec/endSec. User can keep/skip, adjust in/out by ±0.25s, then build
 * the final Resolve timeline from approved picks.
 *
 * Wire-up: when extract_highlight_from_film returns reviewMode=true, App.tsx
 * opens this component with the picksPath. It loads the cached JSON, renders
 * the review grid, and calls build_highlight_from_picks on submit.
 */

import { useEffect, useMemo, useRef, useState } from "react";
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

interface Props {
  picksPath: string;
  onClose: () => void;
  onBuilt: (result: unknown) => void;
}

export function HighlightReviewView({ picksPath, onClose, onBuilt }: Props) {
  const [payload, setPayload] = useState<PicksPayload | null>(null);
  const [picks, setPicks] = useState<ReviewState[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);

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
        setPicks((data.picks || []).map((p) => ({ ...p, approved: true })));
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [picksPath]);

  const sourceSrc = useMemo(
    () => (payload?.sourceVideo ? convertFileSrc(payload.sourceVideo) : ""),
    [payload?.sourceVideo],
  );

  const approvedCount = picks.filter((p) => p.approved).length;
  const approvedDuration = picks
    .filter((p) => p.approved)
    .reduce((sum, p) => sum + (p.endSec - p.startSec), 0);

  function updatePick(index: number, patch: Partial<ReviewState>) {
    setPicks((prev) => prev.map((p) => (p.index === index ? { ...p, ...patch } : p)));
  }

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
      onBuilt(result.events.find((e) => e.type === "result")?.value);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBuilding(false);
    }
  }

  if (!payload) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal" style={{ width: 400 }} onClick={(e) => e.stopPropagation()}>
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18 }}>Review highlight picks</h2>
            <div style={{ fontSize: 12, color: "#b8a8d8", marginTop: 4 }}>
              {payload.sourceVideo.split("/").pop()} · {payload.picks.length} kandidater
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ fontSize: 13, color: "#d8c8e8" }}>
              <strong style={{ color: "#a030c0" }}>{approvedCount}</strong>/{picks.length} approved ·{" "}
              <strong>{approvedDuration.toFixed(1)}s</strong>
            </div>
            <button onClick={onClose} disabled={building} style={{
              background: "transparent", border: "1px solid #2c1860",
              color: "#b8a8d8", padding: "6px 14px", borderRadius: 6,
              cursor: building ? "default" : "pointer", fontSize: 12,
            }}>
              Avbryt
            </button>
            <button onClick={buildTimeline} disabled={building || approvedCount === 0} style={{
              background: "#a030c0", border: "none", color: "white",
              padding: "8px 16px", borderRadius: 6, fontSize: 13, fontWeight: 600,
              cursor: building || approvedCount === 0 ? "default" : "pointer",
            }}>
              {building ? "Bygger…" : `Bygg timeline med ${approvedCount} klipp`}
            </button>
          </div>
        </div>

        {error && (
          <div style={{
            padding: 10, marginBottom: 12,
            background: "rgba(239,79,111,0.1)", border: "1px solid #ef4f6f",
            color: "#ef4f6f", borderRadius: 6, fontSize: 13,
          }}>{error}</div>
        )}

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))",
          gap: 12,
        }}>
          {picks.map((p) => (
            <ShotCard
              key={p.index}
              sourceSrc={sourceSrc}
              pick={p}
              onChange={(patch) => updatePick(p.index, patch)}
              disabled={building}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ShotCard({
  sourceSrc,
  pick,
  onChange,
  disabled,
}: {
  sourceSrc: string;
  pick: ReviewState;
  onChange: (patch: Partial<ReviewState>) => void;
  disabled: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);

  // Loop the video between startSec/endSec
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
    onChange({ startSec: parseFloat(newStart.toFixed(2)) });
  }
  function adjustEnd(delta: number) {
    const newEnd = Math.max(pick.startSec + 0.25, pick.endSec + delta);
    onChange({ endSec: parseFloat(newEnd.toFixed(2)) });
  }

  const dur = pick.endSec - pick.startSec;
  const borderColor = pick.approved ? "#a030c0" : "#2c1860";

  return (
    <div style={{
      background: "rgba(26,13,69,0.6)",
      border: `2px solid ${borderColor}`,
      borderRadius: 10, overflow: "hidden",
      opacity: pick.approved ? 1 : 0.5,
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
          onClick={togglePlay}
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
      </div>

      <div style={{ padding: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: "#8674a8" }}>
            #{pick.index} · {dur.toFixed(1)}s · score {pick.score?.toFixed(2) ?? "?"}
          </span>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={pick.approved}
              onChange={(e) => onChange({ approved: e.target.checked })}
              disabled={disabled}
            />
            Bruk
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 11 }}>
          <div>
            <div style={{ color: "#8674a8", marginBottom: 2 }}>Fra sekund</div>
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <button onClick={() => adjustStart(-0.25)} disabled={disabled} style={btnStyle}>−</button>
              <input
                type="number"
                step="0.1"
                value={pick.startSec}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (!isNaN(v) && v < pick.endSec) onChange({ startSec: v });
                }}
                disabled={disabled}
                style={numInputStyle}
              />
              <button onClick={() => adjustStart(+0.25)} disabled={disabled} style={btnStyle}>+</button>
            </div>
          </div>
          <div>
            <div style={{ color: "#8674a8", marginBottom: 2 }}>Til sekund</div>
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <button onClick={() => adjustEnd(-0.25)} disabled={disabled} style={btnStyle}>−</button>
              <input
                type="number"
                step="0.1"
                value={pick.endSec}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (!isNaN(v) && v > pick.startSec) onChange({ endSec: v });
                }}
                disabled={disabled}
                style={numInputStyle}
              />
              <button onClick={() => adjustEnd(+0.25)} disabled={disabled} style={btnStyle}>+</button>
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
