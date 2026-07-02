import { useCallback, useState } from "react";
import { executeScript, onScriptEvent } from "../api";
import type { ScriptEvent } from "../types";

/**
 * SoMe Lengde-sjekk — indikator som skanner timelinen mot SoMe-mållengder
 * (15/30/60/90s) og flagger for lang B-roll (partier uten dialog), med
 * trim-forslag for å nå nærmeste kortere mål. Kaller `some_length_check`.
 */

interface Target { sec: number; label: string; ok: boolean; over_by_s: number }
interface Gap { start_s: number; end_s: number; dur_s: number; too_long: boolean }
interface Trim { start_s: number; end_s: number; dur_s: number; suggest_trim_s: number }
interface Result {
  duration_s: number;
  targets: Target[];
  broll_gaps: Gap[];
  trim_candidates: Trim[];
  total_broll_s: number;
  total_dialogue_s: number;
  next_shorter_target: number | null;
  headroom_to_next_shorter_s: number;
  dialogue_source: string;
  status: "green" | "amber" | "red";
}

const COL = {
  green: { dot: "#4ad48a", bg: "rgba(74,212,138,0.12)", bd: "rgba(74,212,138,0.4)" },
  amber: { dot: "#f59e0b", bg: "rgba(245,158,11,0.12)", bd: "rgba(245,158,11,0.4)" },
  red: { dot: "#ef4f6f", bg: "rgba(239,79,111,0.12)", bd: "rgba(239,79,111,0.4)" },
};

export function SoMeLengthCheck() {
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Result | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const check = useCallback(async () => {
    setBusy(true); setErr(null);
    const unlisten = await onScriptEvent((_e: ScriptEvent) => {});
    try {
      const summary = await executeScript("some_length_check", {}, false);
      const value = summary.events.find((e) => e.type === "result")?.value as Result | undefined;
      if (!summary.succeeded || !value) {
        setErr(summary.events.find((e) => e.type === "error")?.message ?? "Sjekk feilet");
      } else {
        setRes(value);
      }
    } catch (e) {
      setErr(String(e));
    } finally { unlisten(); setBusy(false); }
  }, []);

  const c = res ? COL[res.status] : COL.amber;

  return (
    <div style={{ border: "1px solid #2a2340", borderRadius: 10, padding: 14, background: "#181328", marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: res ? 12 : 0 }}>
        <h3 style={{ margin: 0, fontSize: 14, color: "#e6ddf5" }}>SoMe Lengde-sjekk</h3>
        <span style={{ fontSize: 12, color: "#8674a8" }}>· format + for lang B-roll</span>
        <button onClick={check} disabled={busy} style={{
          marginLeft: "auto", background: "#2a2340", border: "1px solid #3a3160", color: "#e6ddf5",
          borderRadius: 8, padding: "5px 12px", cursor: busy ? "default" : "pointer", fontSize: 12, fontWeight: 600,
        }}>{busy ? "Skanner…" : "Sjekk timeline"}</button>
      </div>

      {err && <div style={{ color: "#ef4f6f", fontSize: 12 }}>{err}</div>}

      {res && (
        <>
          {/* varighet + status */}
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 30, fontWeight: 700, color: c.dot }}>{res.duration_s.toFixed(1)}s</span>
            <span style={{ fontSize: 12, color: "#8674a8" }}>
              dialog {res.total_dialogue_s.toFixed(0)}s · B-roll {res.total_broll_s.toFixed(0)}s
            </span>
          </div>

          {/* format-chips */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {res.targets.map((t) => {
              const col = t.ok ? COL.green : COL.red;
              return (
                <div key={t.sec} title={t.label} style={{
                  background: col.bg, border: `1px solid ${col.bd}`, color: col.dot,
                  borderRadius: 999, padding: "4px 12px", fontSize: 12, fontWeight: 600,
                  display: "inline-flex", alignItems: "center", gap: 6,
                }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: col.dot }} />
                  {t.sec}s {t.ok ? "✓" : `+${t.over_by_s.toFixed(0)}s`}
                </div>
              );
            })}
          </div>

          {/* trim-forslag for å nå nærmeste kortere mål */}
          {res.trim_candidates.length > 0 && res.next_shorter_target != null && (
            <div style={{ background: COL.amber.bg, border: `1px solid ${COL.amber.bd}`, borderRadius: 8, padding: "10px 12px", marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: "#f59e0b", fontWeight: 600, marginBottom: 6 }}>
                For å nå {res.next_shorter_target}s: kort {res.headroom_to_next_shorter_s.toFixed(1)}s fra B-roll
              </div>
              {res.trim_candidates.map((tc, i) => (
                <div key={i} style={{ fontSize: 12, color: "#cdbfe6", marginTop: 3 }}>
                  B-roll {tc.start_s.toFixed(0)}–{tc.end_s.toFixed(0)}s ({tc.dur_s.toFixed(0)}s) → kort ~<b>{tc.suggest_trim_s.toFixed(0)}s</b>
                </div>
              ))}
            </div>
          )}

          {/* for lang B-roll */}
          {res.broll_gaps.filter((g) => g.too_long).length > 0 && (
            <div style={{ fontSize: 12, color: "#8674a8" }}>
              <span style={{ color: "#f59e0b" }}>⚠ For lang B-roll:</span>{" "}
              {res.broll_gaps.filter((g) => g.too_long).map((g) => `${g.start_s.toFixed(0)}–${g.end_s.toFixed(0)}s (${g.dur_s.toFixed(0)}s)`).join(", ")}
            </div>
          )}
          <div style={{ fontSize: 11, color: "#5a4f78", marginTop: 8 }}>dialog-kilde: {res.dialogue_source}</div>
        </>
      )}
    </div>
  );
}
