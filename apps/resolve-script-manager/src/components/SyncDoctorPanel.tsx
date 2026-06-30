import { useCallback, useState } from "react";
import { executeScript, onScriptEvent, convertFileSrc } from "../api";
import type { ScriptEvent } from "../types";

/**
 * Lip-sync — analyser en ferdig timeline for bilde-vs-lyd desync (dual-system).
 * Flyt: Analyser → hvis funn: "Fant N usynkede seksjoner — marker i timeline?" → Marker / Fjern.
 * Read-only analyse; markering endrer kun markører (customData svblip), ikke editen.
 */

interface Section {
  tlStartRel: number; tlEndRel: number; file: string;
  offsetSec: number; offsetFrames: number; corr: number;
  tcStart: string; tcEnd: string; durSec: number;
}
interface Repeat {
  tcStart: string; tcEnd: string; track: number; file: string; backSec: number;
}
interface ScanResult {
  found: number; sections: Section[]; regionSec: number[]; note: string;
  foundRepeats?: number; repeats?: Repeat[];
}

export function SyncDoctorPanel({ onClose }: { onClose: () => void }) {
  const [timelineName, setTimelineName] = useState("");
  const [useInOut, setUseInOut] = useState(true);
  const [threshold, setThreshold] = useState(2);
  const [corrMin, setCorrMin] = useState(0.45);
  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [marked, setMarked] = useState<string | null>(null);
  const [beforePath, setBeforePath] = useState("");
  const [afterPath, setAfterPath] = useState("");
  const [proofPath, setProofPath] = useState("");
  const [trans, setTrans] = useState<{ segments: number; corrected: number; foundRepeats: number;
    transcript: { tc: string; text: string }[]; repeats: { tcFirst: string; tcRepeat: string; text: string; sim: number }[];
    note: string } | null>(null);

  const runScript = useCallback(async (id: string, params: Record<string, unknown>, label: string) => {
    setBusy(label); setLog((l) => [`▶ ${label}`, ...l].slice(0, 1).concat(l));
    const unlisten = await onScriptEvent((e: ScriptEvent) => {
      if (e.type === "log" || e.type === "warn" || e.type === "error")
        setLog((l) => [...l, `${e.type === "log" ? "" : e.type + ": "}${e.message ?? ""}`].slice(-200));
    });
    try {
      const summary = await executeScript(id, params, false);
      const value = summary.events.find((e) => e.type === "result")?.value as any;
      return { ok: summary.succeeded, value };
    } finally {
      unlisten(); setBusy(null);
    }
  }, []);

  const analyze = useCallback(async () => {
    setScan(null); setMarked(null); setLog([]);
    const r = await runScript("lipsync_scan",
      { timelineName: timelineName.trim(), useInOut, thresholdFrames: threshold, corrMin },
      "Analyserer lip-sync…");
    if (r.ok && r.value) setScan(r.value);
  }, [runScript, timelineName, useInOut, threshold, corrMin]);

  const mark = useCallback(async () => {
    if (!scan) return;
    const r = await runScript("lipsync_mark",
      { timelineName: timelineName.trim(), action: "mark", sections: scan.sections },
      "Markerer i timeline…");
    if (r.ok && r.value) setMarked(`✓ La inn ${r.value.added} markør(er) i timelinen.`);
  }, [runScript, scan, timelineName]);

  const clear = useCallback(async () => {
    const r = await runScript("lipsync_mark",
      { timelineName: timelineName.trim(), action: "clear" }, "Fjerner markører…");
    if (r.ok) setMarked("✓ Markører fjernet.");
  }, [runScript, timelineName]);

  const renderProof = useCallback(async (label: "before" | "after") => {
    const r = await runScript("lipsync_proof",
      { timelineName: timelineName.trim(), mode: "render", label }, `Render ${label === "before" ? "FØR" : "ETTER"}-bevis…`);
    if (r.ok && r.value?.clip) (label === "before" ? setBeforePath : setAfterPath)(r.value.clip);
  }, [runScript, timelineName]);

  const combineProof = useCallback(async () => {
    if (!beforePath || !afterPath) return;
    const r = await runScript("lipsync_proof", { mode: "combine", beforePath, afterPath }, "Setter sammen før/etter…");
    if (r.ok && r.value?.proof) setProofPath(r.value.proof);
  }, [runScript, beforePath, afterPath]);

  const transcribe = useCallback(async (correct: boolean) => {
    setTrans(null);
    const r = await runScript("lipsync_transcribe",
      { timelineName: timelineName.trim(), correct, language: "no", recreate: false },
      correct ? "Transkriberer + retter (Claude)…" : "Transkriberer (Resolve 21)…");
    if (r.ok && r.value) setTrans(r.value);
  }, [runScript, timelineName]);

  return (
    <div style={{ padding: 20, color: "#eee", maxWidth: 900, margin: "0 auto" }}>
      <style>{`@keyframes svbspin { to { transform: rotate(360deg) } }`}</style>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>Lip-sync</h2>
        <button onClick={onClose} style={btnSm}>Lukk</button>
      </div>
      <p style={{ opacity: 0.7, fontSize: 13 }}>
        Analyserer en ferdig timeline for bilde som ikke matcher lyden (dual-system: kamera-scratch vs opptaker-master).
        Finner den noe, spør den om å markere det i timelinen. Analysen er read-only.
      </p>

      <div style={{ ...card, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <label style={lbl}>Timeline (tom = aktiv)
          <input value={timelineName} onChange={(e) => setTimelineName(e.target.value)} placeholder="aktiv timeline" style={inp} /></label>
        <label style={{ ...lbl, flexDirection: "row", alignItems: "center", gap: 8 }}>
          <input type="checkbox" checked={useInOut} onChange={(e) => setUseInOut(e.target.checked)} />
          Kun in/out-området</label>
        <label style={lbl}>Terskel (frames)
          <input type="number" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} style={inp} /></label>
        <label style={lbl}>Min korrelasjon
          <input type="number" step="0.05" value={corrMin} onChange={(e) => setCorrMin(Number(e.target.value))} style={inp} /></label>
      </div>

      <div style={{ display: "flex", gap: 8, margin: "12px 0", alignItems: "center" }}>
        <button onClick={analyze} disabled={!!busy} style={busy ? btnDis : btnPrimary}>
          {busy === "Analyserer lip-sync…" ? "Analyserer…" : "Analyser"}
        </button>
        {busy && <><Spinner /><span style={{ fontSize: 12, opacity: 0.8 }}>{busy}</span></>}
      </div>

      {scan && (scan.foundRepeats ?? 0) > 0 && (
        <div style={{ ...card, borderColor: "#c0392b", background: "#2a1410" }}>
          <b style={{ color: "#ff9b8a" }}>⛔ Fant {scan.foundRepeats} GJENTAKELSE(R) i lyden — fiks disse FØRST</b>
          <div style={{ fontSize: 11, opacity: 0.85, margin: "4px 0 8px" }}>
            Duplisert tale er ofte selve årsaken til «lip-sync off». Offset-funn under kan være falske ved repetitiv lyd —
            fiks gjentakelsen, kjør analyse på nytt.
          </div>
          <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
            <thead><tr><th style={th}>Ved</th><th style={th}>Hopper tilbake</th><th style={th}>Spor</th><th style={th}>Kilde</th></tr></thead>
            <tbody>
              {(scan.repeats ?? []).map((r, i) => (
                <tr key={i}><td style={td}>{r.tcStart}</td><td style={td}>{r.backSec}s</td><td style={td}>A{r.track}</td><td style={td}>{r.file.slice(-24)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {scan && scan.found === 0 && (scan.foundRepeats ?? 0) === 0 && (
        <div style={{ ...card, borderColor: "#2a8f4e", color: "#9f9" }}>
          ✓ Ingen gjentakelse og ingen desync over terskelen funnet i {scan.regionSec[0]}–{scan.regionSec[1]}s.
        </div>
      )}

      {scan && scan.found > 0 && (
        <div style={{ ...card, borderColor: "#b8860b", background: "#2a2410" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 16 }}>⚠️</span>
            <b>Fant {scan.found} usynkede seksjon(er) — skal jeg markere dem i timelinen?</b>
          </div>
          <div style={{ display: "flex", gap: 8, margin: "10px 0" }}>
            <button onClick={mark} disabled={!!busy} style={busy ? btnDis : btnPrimary}>Marker i timeline</button>
            <button onClick={clear} disabled={!!busy} style={busy ? btnDis : btnSm}>Fjern markører</button>
          </div>
          {marked && <div style={{ color: "#9f9", marginBottom: 8 }}>{marked}</div>}
          <div style={{ maxHeight: 280, overflow: "auto" }}>
            <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
              <thead><tr><th style={th}>Fra</th><th style={th}>Til</th><th style={th}>Lengde</th><th style={th}>Kilde</th><th style={th}>Offset</th><th style={th}>corr</th></tr></thead>
              <tbody>
                {scan.sections.map((s, i) => (
                  <tr key={i}>
                    <td style={td}>{s.tcStart}</td><td style={td}>{s.tcEnd}</td><td style={td}>{s.durSec}s</td>
                    <td style={td}>{s.file.slice(-22)}</td>
                    <td style={td}>{s.offsetFrames > 0 ? "+" : ""}{s.offsetFrames}f ({s.offsetSec}s)</td>
                    <td style={td}>{s.corr}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={card}>
        <b>Transkripsjon (Resolve 21 native) + tekst-sjekk</b>
        <div style={{ fontSize: 11, opacity: 0.7, margin: "4px 0 8px" }}>
          Bruker Resolves egen transkripsjon (Text-Based Editing). «+ ret» kjører Claude-korrektur av
          staving/navn og skriver tilbake til undertekstene. Les transkriptet her og bekreft at det matcher
          det du ser i Resolve — så vet vi at vi er på samme resultat.
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => transcribe(false)} disabled={!!busy} style={busy ? btnDis : btnSm}>Transkribér</button>
          <button onClick={() => transcribe(true)} disabled={!!busy} style={busy ? btnDis : btnSm}>Transkribér + ret (Claude)</button>
        </div>
        {trans && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 12, opacity: 0.9 }}>
              {trans.segments} segmenter{trans.corrected ? ` · ${trans.corrected} rettet` : ""}
              {trans.foundRepeats > 0 && <span style={{ color: "#ff9b8a" }}> · ⚠️ {trans.foundRepeats} gjentatt(e) frase(r)</span>}
            </div>
            {trans.foundRepeats > 0 && (
              <div style={{ ...card, borderColor: "#c0392b", background: "#2a1410", marginTop: 6 }}>
                {trans.repeats.map((r, i) => (
                  <div key={i} style={{ fontSize: 11 }}>🔁 {r.tcFirst} → {r.tcRepeat}: «{r.text}» ({r.sim})</div>
                ))}
              </div>
            )}
            <div style={{ maxHeight: 240, overflow: "auto", marginTop: 6, fontSize: 11 }}>
              {trans.transcript.map((s, i) => {
                const rep = trans.repeats.some((r) => r.tcRepeat === s.tc);
                return (
                  <div key={i} style={{ padding: "2px 4px", background: rep ? "#3a2a00" : "transparent", borderBottom: "1px solid #222" }}>
                    <span style={{ opacity: 0.6, marginRight: 8 }}>{s.tc}</span>{s.text}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div style={card}>
        <b>Bevis-klipp til kunde (før/etter)</b>
        <div style={{ fontSize: 11, opacity: 0.7, margin: "4px 0 8px" }}>
          Sett in/out (I/O) i Resolve rundt området. Render <b>FØR</b> du fikser, fiks, render <b>ETTER</b>, så sett sammen
          (rød ramme = før, grønn = etter) — klart å sende kunden.
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button onClick={() => renderProof("before")} disabled={!!busy} style={busy ? btnDis : btnSm}>
            Render FØR {beforePath && "✓"}</button>
          <button onClick={() => renderProof("after")} disabled={!!busy} style={busy ? btnDis : btnSm}>
            Render ETTER {afterPath && "✓"}</button>
          <button onClick={combineProof} disabled={!!busy || !beforePath || !afterPath}
            style={(!!busy || !beforePath || !afterPath) ? btnDis : btnPrimary}>Sett sammen før/etter</button>
        </div>
        {proofPath && (
          <video src={convertFileSrc(proofPath)} controls style={{ width: "100%", marginTop: 10, borderRadius: 6 }} />
        )}
      </div>

      <div style={{ ...card, fontFamily: "monospace", fontSize: 11, maxHeight: 200, overflow: "auto", whiteSpace: "pre-wrap", marginTop: 12 }}>
        {log.length ? log.join("\n") : "Logg vises her når du analyserer."}
      </div>
    </div>
  );
}

function Spinner() {
  return <span style={{ display: "inline-block", width: 16, height: 16, border: "2px solid #4a3f7a",
    borderTopColor: "#a78bfa", borderRadius: "50%", animation: "svbspin 0.7s linear infinite" }} />;
}

const card: React.CSSProperties = { background: "#16161b", border: "1px solid #2a2a33", borderRadius: 8, padding: 12, marginBottom: 8 };
const lbl: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4, fontSize: 12, opacity: 0.95 };
const inp: React.CSSProperties = { padding: "6px 8px", background: "#1a1a1f", color: "#eee", border: "1px solid #333", borderRadius: 6 };
const btnPrimary: React.CSSProperties = { padding: "7px 14px", background: "#7c5cff", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13 };
const btnSm: React.CSSProperties = { padding: "6px 12px", background: "#26262e", color: "#ddd", border: "1px solid #333", borderRadius: 6, cursor: "pointer", fontSize: 12 };
const btnDis: React.CSSProperties = { ...btnPrimary, background: "#333", color: "#888", cursor: "not-allowed" };
const th: React.CSSProperties = { textAlign: "left", padding: "3px 5px", borderBottom: "1px solid #333", opacity: 0.7, position: "sticky", top: 0, background: "#16161b" };
const td: React.CSSProperties = { padding: "3px 5px", borderBottom: "1px solid #222" };
