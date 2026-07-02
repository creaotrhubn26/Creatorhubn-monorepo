import { useCallback, useState } from "react";
import { executeScript, onScriptEvent } from "../api";
import type { ScriptEvent } from "../types";

/**
 * Render-vakt + Leverings-QC + «Fullfører replikken?»-vakt.
 *
 * Filosofi (fra PetKey-lærdommen): timelinen er fasit. AI rører den ikke —
 * AI passer på at menneskets håndverk (sync, take-valg, rettede undertekster)
 * overlever helt ut i fila. Rendrer HELE timelinen i én pass (aldri re-mux),
 * så verifiserer AI output mot timeline-underteksten og sjekker at ingen
 * replikk er avkuttet.
 */

const COL: Record<string, string> = { green: "#4ad48a", yellow: "#f59e0b", amber: "#f59e0b", red: "#ef4f6f" };

interface RenderRes {
  ok: boolean; out_path?: string; duration_s?: number; has_video: boolean; has_audio: boolean;
  width?: number; height?: number; format: string; codec: string; fixes: string[]; warnings: string[]; timeline: string;
}
interface QCLine { t: number; end: number; sub_text: string; heard_text: string; drift_s: number | null; coverage: number; status: string; note: string }
interface QCRes { lines: QCLine[]; summary: { green: number; yellow: number; red: number; total: number; median_drift_s: number | null }; video_path: string }
interface ClipRow { track: number; name: string; end_s: number; right_room_s: number; continues: boolean; heard_after: string; status: string; note: string }
interface ClipRes { clips: ClipRow[]; summary: { flagged: number; checked: number }; timeline: string }

function fmt(t: number) { const m = Math.floor(t / 60), s = t % 60; return `${m}:${s.toFixed(1).padStart(4, "0")}`; }

export function RenderQCPanel() {
  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [render, setRender] = useState<RenderRes | null>(null);
  const [qc, setQc] = useState<QCRes | null>(null);
  const [clips, setClips] = useState<ClipRes | null>(null);

  const listen = useCallback(async () => onScriptEvent((e: ScriptEvent) => {
    if (e.type === "log" || e.type === "warn" || e.type === "error")
      setLog((l) => [`${e.type === "log" ? "" : e.type + ": "}${e.message ?? ""}`, ...l].slice(0, 40));
  }), []);

  // ett-klikk: render hele timeline → så QC på det som ble rendret
  const renderAndVerify = useCallback(async () => {
    setBusy("render"); setLog(["▶ Rendrer hele timelinen fra start til slutt…"]); setRender(null); setQc(null);
    const un = await listen();
    try {
      const rs = await executeScript("render_timeline_safe", {}, false);
      const rv = rs.events.find((ev) => ev.type === "result")?.value as RenderRes | undefined;
      if (!rs.succeeded || !rv) return;
      setRender(rv);
      if (rv.ok && rv.out_path) {
        setBusy("qc"); setLog((l) => ["▶ Verifiserer levering mot timeline-undertekst…", ...l]);
        const qs = await executeScript("delivery_qc", { video_path: rv.out_path }, false);
        const qv = qs.events.find((ev) => ev.type === "result")?.value as QCRes | undefined;
        if (qs.succeeded && qv) setQc(qv);
      }
    } finally { un(); setBusy(null); }
  }, [listen]);

  const checkOnly = useCallback(async () => {
    setBusy("check"); const un = await listen();
    try {
      const rs = await executeScript("render_timeline_safe", { check_only: true }, false);
      const rv = rs.events.find((ev) => ev.type === "result")?.value as RenderRes | undefined;
      if (rs.succeeded && rv) setRender(rv);
    } finally { un(); setBusy(null); }
  }, [listen]);

  const completion = useCallback(async () => {
    setBusy("clip"); setLog(["▶ Sjekker om noen replikk er avkuttet…"]); setClips(null);
    const un = await listen();
    try {
      const cs = await executeScript("clip_completion_check", {}, false);
      const cv = cs.events.find((ev) => ev.type === "result")?.value as ClipRes | undefined;
      if (cs.succeeded && cv) setClips(cv);
    } finally { un(); setBusy(null); }
  }, [listen]);

  const S = qc?.summary;

  return (
    <div style={{ border: "1px solid #2a2340", borderRadius: 10, padding: 14, background: "#181328", marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <h3 style={{ margin: 0, fontSize: 14, color: "#e6ddf5" }}>Render-vakt + Leverings-QC</h3>
        <span style={{ fontSize: 12, color: "#8674a8" }}>· timelinen er fasit, AI verifiserer</span>
      </div>
      <p style={{ fontSize: 11, color: "#8674a8", margin: "0 0 10px" }}>
        Rendrer hele timelinen i én pass (aldri re-mux) og lar AI sjekke at hver replikk kom med, ligger i sync og ikke er avkuttet.
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <button onClick={renderAndVerify} disabled={!!busy} style={{ background: "#ff8c00", border: "none", color: "#1a1400", borderRadius: 8, padding: "7px 14px", cursor: busy ? "default" : "pointer", fontSize: 12, fontWeight: 700 }}>
          {busy === "render" ? "Rendrer…" : busy === "qc" ? "Verifiserer…" : "🎬 Rendre hele timeline + verifiser"}
        </button>
        <button onClick={checkOnly} disabled={!!busy} style={{ background: "#241f3a", border: "1px solid #3a3160", color: "#cdbfe6", borderRadius: 8, padding: "7px 12px", cursor: busy ? "default" : "pointer", fontSize: 12 }}>
          {busy === "check" ? "…" : "Sjekk oppsett"}
        </button>
        <button onClick={completion} disabled={!!busy} style={{ background: "#241f3a", border: "1px solid #3a3160", color: "#cdbfe6", borderRadius: 8, padding: "7px 12px", cursor: busy ? "default" : "pointer", fontSize: 12 }}>
          {busy === "clip" ? "…" : "«Fullfører replikken?»"}
        </button>
      </div>

      {/* render-vakt status */}
      {render && (
        <div style={{ fontSize: 12, marginBottom: 10, padding: 8, borderRadius: 8, background: "#0f0b1c", border: `1px solid ${render.ok ? "rgba(74,212,138,0.4)" : "rgba(239,79,111,0.4)"}` }}>
          <div style={{ color: render.ok ? COL.green : COL.red, fontWeight: 600 }}>
            {render.ok ? "✓" : "⚠"} {render.format}/{render.codec}
            {render.width ? ` · ${render.width}×${render.height}` : ""}
            {render.duration_s ? ` · ${render.duration_s}s` : ""}
            {` · ${render.has_video ? "video✓" : "INGEN VIDEO"} ${render.has_audio ? "lyd✓" : "ingen lyd"}`}
          </div>
          {render.fixes.map((f, i) => <div key={i} style={{ color: "#8674a8" }}>· {f}</div>)}
          {render.warnings.map((w, i) => <div key={i} style={{ color: COL.amber }}>⚠ {w}</div>)}
        </div>
      )}

      {/* QC-oppsummering + linjer */}
      {S && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", gap: 12, fontSize: 12, marginBottom: 6 }}>
            <span style={{ color: COL.green }}>● {S.green} sync</span>
            <span style={{ color: COL.yellow }}>● {S.yellow} driver</span>
            <span style={{ color: COL.red }}>● {S.red} problem</span>
            {S.median_drift_s != null && <span style={{ color: "#8674a8", marginLeft: "auto" }}>median-drift {S.median_drift_s}s</span>}
          </div>
          <div style={{ maxHeight: 220, overflow: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
            {qc!.lines.filter((l) => l.status !== "green").concat(qc!.lines.filter((l) => l.status === "green")).map((l, i) => (
              <div key={i} style={{ display: "flex", gap: 8, fontSize: 11, padding: "4px 6px", borderRadius: 6, background: "#0f0b1c", borderLeft: `3px solid ${COL[l.status]}` }}>
                <span style={{ color: "#8674a8", minWidth: 42, fontFamily: "monospace" }}>{fmt(l.t)}</span>
                <span style={{ color: "#e6ddf5", flex: 1 }}>
                  {l.sub_text}
                  <span style={{ color: COL[l.status], marginLeft: 6 }}>
                    {l.drift_s != null ? `${l.drift_s > 0 ? "+" : ""}${l.drift_s}s` : ""}
                  </span>
                  {l.status !== "green" && <div style={{ color: "#8674a8" }}>{l.note}</div>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* completion-vakt */}
      {clips && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 12, color: clips.summary.flagged ? COL.red : COL.green, marginBottom: 6 }}>
            {clips.summary.flagged ? `⚠ ${clips.summary.flagged} replikk kan være avkuttet` : "✓ Alle replikker ser hele ut"} · {clips.summary.checked} sjekket
          </div>
          {clips.clips.filter((c) => c.status !== "green").map((c, i) => (
            <div key={i} style={{ display: "flex", gap: 8, fontSize: 11, padding: "4px 6px", borderRadius: 6, background: "#0f0b1c", borderLeft: `3px solid ${COL[c.status]}`, marginBottom: 3 }}>
              <span style={{ color: "#8674a8", minWidth: 42, fontFamily: "monospace" }}>A{c.track} {fmt(c.end_s)}</span>
              <span style={{ color: "#e6ddf5", flex: 1 }}>{c.name}<div style={{ color: "#8674a8" }}>{c.note}</div></span>
            </div>
          ))}
        </div>
      )}

      {log.length > 0 && (
        <div style={{ marginTop: 8, maxHeight: 70, overflow: "auto", fontSize: 11, color: "#8674a8", fontFamily: "monospace" }}>
          {log.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}
    </div>
  );
}
