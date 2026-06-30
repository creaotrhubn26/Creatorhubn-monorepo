import { useCallback, useState } from "react";
import { executeScript, onScriptEvent } from "../api";
import type { ScriptEvent } from "../types";

/**
 * Revisjon-fane — klient-feedback → AI-fiks → evaluer om fulgt → redigerbar spec.
 * Flater: INGEST (fri-tekst → punkter), EVALUERING (grønn/gul sjekkliste), og
 * LYD-KVALITET: dual-system/ekstern-opptaker-søk (recorder-agnostisk, media-pool
 * først), artefakt-skann (pust/bleed/klikk), replikk-rens fra mygg. Bygget fra
 * PetKey-revisjonene (se memory project_revision_feedback_loop). Speiler
 * SyncDoctorPanel: executeScript + onScriptEvent for strømmet logg.
 */

interface FeedbackItem {
  id: string; text: string; target: string; intent: string;
  anchor: string | null; anchor_tc: string | null; anchor_confidence: number;
  status: string; needs_confirm: boolean;
}
interface EvalResult { feedback: string; evaluator: string | null; passed: boolean | null; evidence: string; }
interface RecorderSrc { in_project: Array<{ bin: string; file: string; path: string; dur: string }>; bins: string[]; source: string; count: number; }
interface Artifact { tc: string; t_s: number; type: string; level_db: number | null; severity: string; }
interface MicCand { file: string; offset_s: number; corr: number; }
interface SearchHit { file: string; basename: string; t_s: number; tc: string; text: string; score: number; }

const TARGET_COLOR: Record<string, string> = {
  audio: "#7c5cff", color: "#f59e0b", reframe: "#22b45a", text: "#3b82f6", pacing: "#ef4f6f",
};
const SEV_COLOR: Record<string, string> = { high: "#ef4f6f", med: "#f59e0b" };

export function RevisionPanel({ onClose }: { onClose: () => void }) {
  const [feedback, setFeedback] = useState("");
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [evals, setEvals] = useState<EvalResult[]>([]);
  const [recorders, setRecorders] = useState<RecorderSrc | null>(null);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [audioPath, setAudioPath] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ percent: number; label: string } | null>(null);
  const [log, setLog] = useState<string[]>([]);
  // Rens replikk-veiviser
  const [wizDialogue, setWizDialogue] = useState("");
  const [wizT0, setWizT0] = useState("");
  const [wizT1, setWizT1] = useState("");
  const [cands, setCands] = useState<MicCand[]>([]);
  const [confident, setConfident] = useState<boolean | null>(null);
  const [chosen, setChosen] = useState<MicCand | null>(null);
  const [applied, setApplied] = useState<{ output_path: string; align_corr: number } | null>(null);
  // Søk etter replikk (alle prosjekt-klipp)
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [indexed, setIndexed] = useState<number | null>(null);

  const runScript = useCallback(async (id: string, params: Record<string, unknown>, label: string) => {
    setBusy(label); setProgress(null); setLog((l) => [`▶ ${label}`, ...l].slice(0, 200));
    const unlisten = await onScriptEvent((e: ScriptEvent) => {
      if (e.type === "progress")
        setProgress({ percent: e.percent ?? 0, label: e.label ?? "" });
      else if (e.type === "log" || e.type === "warn" || e.type === "error")
        setLog((l) => [`${e.type === "log" ? "" : e.type + ": "}${e.message ?? ""}`, ...l].slice(0, 200));
    });
    try {
      const summary = await executeScript(id, params, false);
      const value = summary.events.find((e) => e.type === "result")?.value as any;
      return { ok: summary.succeeded, value };
    } finally { unlisten(); setBusy(null); setProgress(null); }
  }, []);

  const analyze = useCallback(async () => {
    if (!feedback.trim()) return;
    const r = await runScript("revision_ingest", { feedback }, "Tolker tilbakemelding…");
    if (r.ok && r.value?.items) { setItems(r.value.items as FeedbackItem[]); setEvals([]); }
  }, [feedback, runScript]);

  // Dual-system: sjekk media-poolen FØRST for ekstern-opptaker-lyd (recorder-agnostisk).
  const findRecorders = useCallback(async () => {
    const r = await runScript("revision_dualsystem_sources", {}, "Søker ekstern-opptaker-lyd i prosjektet…");
    if (r.ok && r.value) setRecorders(r.value as RecorderSrc);
  }, [runScript]);

  const scanArtifacts = useCallback(async () => {
    if (!audioPath.trim()) return;
    const r = await runScript("revision_scan_artifacts", { audio_path: audioPath }, "Skanner artefakter…");
    if (r.ok && r.value?.artifacts) setArtifacts(r.value.artifacts as Artifact[]);
  }, [audioPath, runScript]);

  // Steg 1 av veiviser: skann myggene for replikken
  const scanMics = useCallback(async () => {
    if (!recorders?.in_project.length || !wizDialogue.trim() || !wizT0 || !wizT1) return;
    setCands([]); setChosen(null); setApplied(null); setConfident(null);
    const r = await runScript("revision_tascam_replace", {
      mode: "scan", dialogue_path: wizDialogue, line_t0: Number(wizT0), line_t1: Number(wizT1),
      mic_files: recorders.in_project.map((x) => x.path),
    }, "Skanner mygg for replikken…");
    if (r.ok && r.value) {
      setCands(r.value.candidates as MicCand[]);
      setConfident(!!r.value.confident);
      if (r.value.confident) setChosen(r.value.best as MicCand);
    }
  }, [recorders, wizDialogue, wizT0, wizT1, runScript]);

  // Steg 2: splice valgt mygg-treff inn i dialogen (ukomprimert, synket, nivå-matchet)
  const applySplice = useCallback(async () => {
    if (!chosen) return;
    const out = wizDialogue.replace(/\.wav$/i, "") + "_renset.wav";
    const r = await runScript("revision_tascam_replace", {
      mode: "apply", dialogue_path: wizDialogue, mic_file: chosen.file, mic_offset_s: chosen.offset_s,
      line_dur: Number(wizT1) - Number(wizT0), edit_t0: Number(wizT0), edit_t1: Number(wizT1), output_path: out,
    }, "Splicer ren replikk inn…");
    if (r.ok && r.value) setApplied({ output_path: r.value.output_path, align_corr: r.value.align_corr });
  }, [chosen, wizDialogue, wizT0, wizT1, runScript]);

  // Søk-system: indekser alle prosjekt-klipp, så søk etter en replikk
  const buildIndex = useCallback(async () => {
    const mics = recorders?.in_project.map((x) => x.path) ?? [];
    const r = await runScript("revision_search_index", { audio_paths: mics }, "Indekserer prosjekt-lyd…");
    if (r.ok && r.value) setIndexed(r.value.total_segments ?? 0);
  }, [recorders, runScript]);

  const searchLine = useCallback(async () => {
    if (!query.trim()) return;
    const r = await runScript("revision_search", { query, limit: 25 }, `Søker «${query}»…`);
    if (r.ok && r.value?.hits) setHits(r.value.hits as SearchHit[]);
  }, [query, runScript]);

  const useHit = useCallback((h: SearchHit) => {
    // forhåndsutfyll rens-veiviseren med valgt take
    setChosen({ file: h.file, offset_s: h.t_s, corr: h.score });
  }, []);

  const evaluateDemo = useCallback(async () => {
    const spec = {
      job: "Revisjon", timeline: "(aktiv)", fps: 25, start_tc: "01:00:00:00", duration_s: 102,
      feedback: items.length ? items : [],
      changes: items.slice(0, 6).map((it, i) => ({ id: `c${i}`, feedback_id: it.id, fixer: "auto", evaluator: "manual", expect: {} })),
    };
    const r = await runScript("revision_evaluate", { spec, measurements: {} }, "Evaluerer…");
    if (r.ok && r.value?.results) setEvals(r.value.results as EvalResult[]);
  }, [items, runScript]);

  return (
    <div style={{ padding: 20, maxWidth: 940, margin: "0 auto", color: "#f0eaff" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <h2 style={{ margin: 0 }}>Revisjon <span style={{ fontSize: 13, color: "#8674a8", fontWeight: 400 }}>· feedback → fiks → evaluer</span></h2>
        <button style={btnGhost} onClick={onClose}>← Tilbake</button>
      </div>

      {/* Live status: viser transkripsjon/analyse mens den jobber */}
      {busy && (
        <div style={{ ...card, borderColor: "#7c5cff55", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#7c5cff", boxShadow: "0 0 8px #7c5cff", animation: "pulse 1s infinite" }} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>{progress?.label || busy}</span>
            {progress && <span style={{ marginLeft: "auto", fontSize: 12, color: "#8674a8" }}>{progress.percent}%</span>}
          </div>
          <div style={{ height: 6, background: "#101015", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ height: "100%", width: progress ? `${progress.percent}%` : "100%",
              background: "linear-gradient(90deg,#7c5cff,#a855f7)", borderRadius: 4,
              transition: "width .3s", opacity: progress ? 1 : 0.4 }} />
          </div>
          {log[0] && <div style={{ fontSize: 11, color: "#9a8fb5", marginTop: 8, fontFamily: "monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{log[0]}</div>}
          <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
        </div>
      )}

      {/* 1) Tilbakemelding */}
      <div style={card}>
        <div style={hdr}>1 · Klient-tilbakemelding</div>
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder={"Lim inn tilbakemeldingen…\nf.eks. «Bytt ut første sang. Etter at hun har vasket av skoene, bytt musikk. Bendik er for høy…»"}
          style={{ width: "100%", minHeight: 96, background: "#101015", border: "1px solid #2a2a33", borderRadius: 8, color: "#f0eaff", padding: 10, fontSize: 13, resize: "vertical", boxSizing: "border-box" }}
        />
        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={btnPrimary} onClick={analyze} disabled={!!busy || !feedback.trim()}>Analyser tilbakemelding</button>
          {items.length > 0 && <button style={btnSecondary} onClick={evaluateDemo} disabled={!!busy}>Evaluer mot resultat</button>}
          {busy && <span style={{ alignSelf: "center", fontSize: 12, color: "#8674a8" }}>{busy}</span>}
        </div>
        {items.map((it) => (
          <div key={it.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 0", borderTop: "1px solid #20202a" }}>
            <span style={{ ...chip, background: (TARGET_COLOR[it.target] ?? "#555") + "22", border: `1px solid ${TARGET_COLOR[it.target] ?? "#555"}`, color: TARGET_COLOR[it.target] ?? "#aaa" }}>{it.target}/{it.intent}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13 }}>{it.text}</div>
              {it.anchor && (
                <div style={{ fontSize: 11, color: "#f59e0b", marginTop: 3 }}>
                  ⚓ anker: «{it.anchor}» {it.anchor_tc ? `→ ${it.anchor_tc}` : "· må lokaliseres + bekreftes"}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 2) Lyd-kvalitet: dual-system + artefakter */}
      <div style={card}>
        <div style={hdr}>2 · Lyd-kvalitet</div>

        <div style={{ fontSize: 12, color: "#9a8fb5", marginBottom: 6 }}>
          Dual-system: har du tatt opp lyden med en <b>ekstern opptaker</b> også (Tascam, Zoom, MixPre, DR-10L…)? Systemet sjekker prosjektet først.
        </div>
        <button style={btnSecondary} onClick={findRecorders} disabled={!!busy}>Finn ekstern-opptaker-lyd</button>
        {recorders && (
          <div style={{ marginTop: 8, fontSize: 12 }}>
            <div style={{ color: recorders.count ? "#4ad48a" : "#f59e0b" }}>
              {recorders.count
                ? `✓ ${recorders.count} opptaker-filer i prosjektet (${recorders.bins.length} bins) — kilde: media-pool`
                : "Ingen i prosjektet → pek på opptaker-mappen"}
            </div>
            {recorders.bins.map((b) => (
              <div key={b} style={{ color: "#b8a8d8", marginTop: 2 }}>📁 {b}: {recorders.in_project.filter((x) => x.bin === b).length} filer</div>
            ))}
            <div style={{ color: "#8674a8", marginTop: 4 }}>→ velg en replikk som skal renses, så skannes myggene (envelope-match, konfidans-gate 0.72) og synkes inn.</div>
          </div>
        )}

        {/* Rens replikk-veiviser */}
        {recorders && recorders.count > 0 && (
          <div style={{ marginTop: 12, padding: 12, background: "#101015", border: "1px solid #2a2a33", borderRadius: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#b8a8d8", marginBottom: 8 }}>Rens replikk fra mygg</div>
            <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
              <input value={wizDialogue} onChange={(e) => setWizDialogue(e.target.value)} placeholder="dialog-spor (.wav)"
                style={{ flex: 2, ...inp }} />
              <input value={wizT0} onChange={(e) => setWizT0(e.target.value)} placeholder="fra (s)" style={{ width: 70, ...inp }} />
              <input value={wizT1} onChange={(e) => setWizT1(e.target.value)} placeholder="til (s)" style={{ width: 70, ...inp }} />
              <button style={btnSecondary} onClick={scanMics} disabled={!!busy || !wizDialogue.trim() || !wizT0 || !wizT1}>1 · Skann mygg</button>
            </div>

            {cands.length > 0 && (
              <div style={{ marginTop: 6 }}>
                <div style={{ fontSize: 11, color: confident ? "#4ad48a" : "#f59e0b", marginBottom: 4 }}>
                  {confident ? "✓ trygt treff (korr ≥ 0.72)" : "⚠ ingen trygt treff — bekreft manuelt før splice"}
                </div>
                {cands.map((c, i) => {
                  const ok = c.corr >= 0.72; const sel = chosen?.file === c.file && chosen?.offset_s === c.offset_s;
                  return (
                    <div key={i} onClick={() => setChosen(c)}
                      style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, padding: "4px 6px", borderRadius: 6, cursor: "pointer",
                        background: sel ? "#7c5cff22" : "transparent", border: `1px solid ${sel ? "#7c5cff" : "transparent"}` }}>
                      <span style={{ color: ok ? "#4ad48a" : "#8674a8" }}>{ok ? "✓" : "·"}</span>
                      <span style={{ flex: 1, fontFamily: "monospace" }}>{c.file.split("/").pop()}</span>
                      <span style={{ color: "#8674a8" }}>@ {c.offset_s}s</span>
                      <span style={{ color: ok ? "#4ad48a" : "#b8a8d8", fontWeight: 600 }}>korr {c.corr}</span>
                    </div>
                  );
                })}
                <button style={{ ...btnPrimary, marginTop: 8 }} onClick={applySplice} disabled={!!busy || !chosen}>
                  2 · Splice inn ukomprimert {chosen ? `(${chosen.file.split("/").pop()})` : ""}
                </button>
              </div>
            )}

            {applied && (
              <div style={{ marginTop: 8, fontSize: 12, color: "#4ad48a" }}>
                ✓ Ferdig — synket inn (korr {applied.align_corr}) → <span style={{ fontFamily: "monospace", color: "#b8a8d8" }}>{applied.output_path.split("/").pop()}</span>
                <div style={{ color: "#8674a8", marginTop: 2 }}>Neste: re-miks (duck) + legg på lyd-sporet i timelinen.</div>
              </div>
            )}
          </div>
        )}

        <div style={{ height: 1, background: "#20202a", margin: "12px 0" }} />

        <div style={{ fontSize: 12, color: "#9a8fb5", marginBottom: 6 }}>
          Artefakt-skann: finn pust/bleed/whoosh i pausene + klipp-skjøt-klikk (etter demucs/leveling).
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={audioPath} onChange={(e) => setAudioPath(e.target.value)} placeholder="sti til dialog-spor (.wav)"
            style={{ flex: 1, background: "#101015", border: "1px solid #2a2a33", borderRadius: 8, color: "#f0eaff", padding: "7px 10px", fontSize: 12 }} />
          <button style={btnSecondary} onClick={scanArtifacts} disabled={!!busy || !audioPath.trim()}>Skann artefakter</button>
        </div>
        {artifacts.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 12, color: "#b8a8d8", marginBottom: 4 }}>{artifacts.length} funn ({artifacts.filter((a) => a.severity === "high").length} høye)</div>
            {artifacts.map((a, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, padding: "3px 0" }}>
                <span style={{ ...chip, background: (SEV_COLOR[a.severity] ?? "#555") + "22", border: `1px solid ${SEV_COLOR[a.severity] ?? "#555"}`, color: SEV_COLOR[a.severity] ?? "#aaa" }}>{a.severity}</span>
                <span style={{ fontFamily: "monospace", color: "#f0eaff" }}>{a.tc}</span>
                <span style={{ color: "#8674a8" }}>{a.type}{a.level_db != null ? ` · ${a.level_db} dB` : ""}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Søk etter replikk (alle prosjekt-klipp) */}
      <div style={card}>
        <div style={hdr}>Søk etter replikk · alle prosjekt-klipp</div>
        <div style={{ fontSize: 12, color: "#9a8fb5", marginBottom: 8 }}>
          Søke-systemet analyserer (transkriberer) alle lydklippene i prosjektet. Søk etter en replikk → få alle takene på tvers av alle opptak, så velger du riktig.
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <button style={btnSecondary} onClick={buildIndex} disabled={!!busy}>Indekser prosjekt-lyd</button>
          {indexed != null && <span style={{ alignSelf: "center", fontSize: 12, color: "#4ad48a" }}>✓ {indexed} segmenter indeksert</span>}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={query} onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") searchLine(); }}
            placeholder="skriv replikken… f.eks. «naboen har en katt»" style={{ flex: 1, ...inp }} />
          <button style={btnPrimary} onClick={searchLine} disabled={!!busy || !query.trim()}>Søk</button>
        </div>
        {hits.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 11, color: "#b8a8d8", marginBottom: 4 }}>{hits.length} treff — klikk for å velge take til rens</div>
            {hits.map((h, i) => {
              const sel = chosen?.file === h.file && chosen?.offset_s === h.t_s;
              return (
                <div key={i} onClick={() => useHit(h)}
                  style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, padding: "5px 6px", borderRadius: 6, cursor: "pointer",
                    background: sel ? "#7c5cff22" : "transparent", border: `1px solid ${sel ? "#7c5cff" : "#20202a"}`, marginBottom: 3 }}>
                  <span style={{ color: h.score >= 0.7 ? "#4ad48a" : "#f59e0b", fontWeight: 600, minWidth: 34 }}>{h.score.toFixed(2)}</span>
                  <span style={{ fontFamily: "monospace", color: "#b8a8d8", minWidth: 130 }}>{h.basename} @ {h.tc}</span>
                  <span style={{ flex: 1, color: "#f0eaff" }}>«{h.text}»</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3) Evaluering */}
      {evals.length > 0 && (
        <div style={card}>
          <div style={hdr}>3 · Ble tilbakemeldingen fulgt?</div>
          {evals.map((r, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", padding: "7px 0", borderTop: "1px solid #20202a" }}>
              <span style={{ fontSize: 16 }}>{r.passed === true ? "✅" : r.passed === null ? "⚠️" : "❌"}</span>
              <div style={{ flex: 1, fontSize: 13 }}>{r.feedback}</div>
              <div style={{ fontSize: 11, color: "#8674a8" }}>{r.evidence}</div>
            </div>
          ))}
        </div>
      )}

      {log.length > 0 && (
        <pre style={{ background: "#0c0c10", border: "1px solid #20202a", borderRadius: 8, padding: 10, fontSize: 11, color: "#9a8fb5", maxHeight: 160, overflow: "auto" }}>{log.join("\n")}</pre>
      )}
    </div>
  );
}

const card: React.CSSProperties = { background: "#16161b", border: "1px solid #2a2a33", borderRadius: 10, padding: 14, marginBottom: 12 };
const hdr: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: "#b8a8d8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 };
const chip: React.CSSProperties = { fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, whiteSpace: "nowrap" };
const btnPrimary: React.CSSProperties = { padding: "8px 14px", background: "#7c5cff", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13 };
const btnSecondary: React.CSSProperties = { padding: "8px 14px", background: "#2a2a33", color: "#f0eaff", border: "1px solid #3a3a44", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13 };
const btnGhost: React.CSSProperties = { padding: "6px 12px", background: "transparent", color: "#b8a8d8", border: "1px solid #2a2a33", borderRadius: 8, cursor: "pointer", fontSize: 13 };
const inp: React.CSSProperties = { background: "#0c0c10", border: "1px solid #2a2a33", borderRadius: 6, color: "#f0eaff", padding: "6px 8px", fontSize: 12, boxSizing: "border-box" };
