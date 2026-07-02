import { useCallback, useMemo, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { executeScript, onScriptEvent, convertFileSrc } from "../api";
import type { ScriptEvent } from "../types";

/**
 * Sports Event-agent (MVP A: bevegelse + ambient, uten Apple Vision).
 *
 * Proff, ryddig arbeidsflyt for sports-editorer: (1) kilde & event-profil,
 * (2) skann-innstillinger — ALLE terskler eksponert, (3) triage-kontaktark
 * med forhåndsvisning (godkjenn/forkast — mennesket velger), (4) bygg
 * highlight-timeline. Timelinen er fasit; derfra finpuss + render-vakt/QC.
 *
 * Kaller `event_moment_scan` + `event_highlight_build`.
 */

interface Candidate {
  id: string; clip_path: string; clip_name: string; camera: string;
  t_peak: number; in_s: number; out_s: number; dur_s: number;
  type: "høydepunkt" | "action" | "jubel"; score: number;
  motion: number; ambient: number; why: string[]; thumb: string | null;
}
interface ScanResult {
  candidates: Candidate[];
  summary: { total: number; by_type: Record<string, number>; clips_scanned: number; clips_total: number };
  profile: string; params: Record<string, number>;
}
interface BuildResult { timeline: string; count: number; duration_s: number; order: string }

const PROFILES = [
  { id: "ocr_race", label: "Hinderløp (OCR)", hint: "fall · plask · innsats · brøl" },
  { id: "ball_sport", label: "Ballsport", hint: "rask action · publikum-jubel" },
  { id: "generic", label: "Generisk event", hint: "bevegelse · lyd-topper" },
];

const TYPE_COL: Record<string, string> = { "høydepunkt": "#ff8c00", action: "#4aa3ff", jubel: "#4ad48a" };
const ACCENT = "#ff8c00";
const BG = "#141019", CARD = "#1b1526", LINE = "#2c2340", TXT = "#e9e2f6", DIM = "#9a8bb8";

function mmss(s: number) { const m = Math.floor(s / 60); return `${m}:${Math.floor(s % 60).toString().padStart(2, "0")}`; }

function Spinner({ size = 14 }: { size?: number }) {
  return <span style={{ display: "inline-block", width: size, height: size, border: "2px solid #4a3f7a", borderTopColor: ACCENT, borderRadius: "50%", animation: "svbspin 0.7s linear infinite", flex: "none" }} />;
}

function Section({ n, title, sub, children }: { n: number; title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 12, padding: 16, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12 }}>
        <span style={{ width: 22, height: 22, borderRadius: 6, background: "#241a36", color: ACCENT, fontWeight: 800, fontSize: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>{n}</span>
        <h3 style={{ margin: 0, fontSize: 15, color: TXT }}>{title}</h3>
        {sub && <span style={{ fontSize: 12, color: DIM }}>{sub}</span>}
      </div>
      {children}
    </div>
  );
}

function Slider({ label, val, set, min, max, step, unit }: { label: string; val: number; set: (n: number) => void; min: number; max: number; step: number; unit?: string }) {
  return (
    <label style={{ display: "block", fontSize: 12, color: DIM }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span>{label}</span><span style={{ color: TXT, fontWeight: 600 }}>{val}{unit ?? ""}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={val} onChange={(e) => set(parseFloat(e.target.value))} style={{ width: "100%", accentColor: ACCENT }} />
    </label>
  );
}

export function SportsEventPanel({ onClose }: { onClose: () => void }) {
  const [profile, setProfile] = useState("ocr_race");
  const [sourceDir, setSourceDir] = useState("");
  // skann-parametre (alle eksponert)
  const [fps, setFps] = useState(3);
  const [motionSens, setMotionSens] = useState(1.0);
  const [ambientSens, setAmbientSens] = useState(1.0);
  const [minGap, setMinGap] = useState(3.0);
  const [preS, setPreS] = useState(1.5);
  const [postS, setPostS] = useState(2.5);
  const [maxC, setMaxC] = useState(120);
  const [maxClips, setMaxClips] = useState(0);
  const [advanced, setAdvanced] = useState(false);

  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ pct: number; label: string } | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [approved, setApproved] = useState<Set<string>>(new Set());

  // triage-filter
  const [fType, setFType] = useState<"alle" | "høydepunkt" | "action" | "jubel">("alle");
  const [minScore, setMinScore] = useState(0);
  const [sortBy, setSortBy] = useState<"score" | "tid" | "kamera">("score");
  const [preview, setPreview] = useState<Candidate | null>(null);

  // bygg
  const [order, setOrder] = useState<"chrono" | "score">("chrono");
  const [handles, setHandles] = useState(0);
  const [tlName, setTlName] = useState("Highlight – Sports Event");
  const [build, setBuild] = useState<BuildResult | null>(null);

  const listen = useCallback(async () => onScriptEvent((e: ScriptEvent) => {
    if (e.type === "progress") setProgress({ pct: e.percent ?? (e.total ? (e.current ?? 0) / e.total * 100 : 0), label: e.label ?? "" });
    else if (e.type === "log" || e.type === "warn" || e.type === "error")
      setLog((l) => [`${e.type === "log" ? "" : e.type + ": "}${e.message ?? ""}`, ...l].slice(0, 60));
  }), []);

  const pickDir = useCallback(async () => {
    const f = await openDialog({ directory: true, multiple: false });
    if (typeof f === "string") setSourceDir(f);
  }, []);

  const runScan = useCallback(async () => {
    if (!sourceDir) { setLog(["Velg en mappe med multi-cam-materiale først"]); return; }
    setBusy("scan"); setProgress({ pct: 0, label: "Starter…" }); setLog(["▶ Skanner etter øyeblikk…"]);
    setScan(null); setApproved(new Set()); setBuild(null);
    const un = await listen();
    try {
      const s = await executeScript("event_moment_scan", {
        source_dir: sourceDir, profile, sample_fps: fps, motion_sens: motionSens,
        ambient_sens: ambientSens, min_gap_s: minGap, pre_s: preS, post_s: postS,
        max_candidates: maxC, max_clips: maxClips,
      }, false);
      const v = s.events.find((ev) => ev.type === "result")?.value as ScanResult | undefined;
      if (s.succeeded && v) setScan(v);
    } finally { un(); setBusy(null); setProgress(null); }
  }, [sourceDir, profile, fps, motionSens, ambientSens, minGap, preS, postS, maxC, maxClips, listen]);

  const visible = useMemo(() => {
    if (!scan) return [];
    let c = scan.candidates.filter((x) => (fType === "alle" || x.type === fType) && x.score >= minScore);
    c = [...c].sort((a, b) => sortBy === "score" ? b.score - a.score : sortBy === "tid" ? a.t_peak - b.t_peak : a.camera.localeCompare(b.camera));
    return c;
  }, [scan, fType, minScore, sortBy]);

  const toggle = useCallback((id: string) => setApproved((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; }), []);
  const approveVisible = useCallback(() => setApproved((s) => { const n = new Set(s); visible.forEach((c) => n.add(c.id)); return n; }), [visible]);

  const runBuild = useCallback(async () => {
    if (!scan || approved.size === 0) return;
    const items = scan.candidates.filter((c) => approved.has(c.id))
      .map((c) => ({ clip_path: c.clip_path, in_s: c.in_s, out_s: c.out_s, score: c.score, camera: c.camera }));
    setBusy("build"); setLog((l) => [`▶ Bygger highlight-timeline (${items.length} øyeblikk)…`, ...l]); setBuild(null);
    const un = await listen();
    try {
      const s = await executeScript("event_highlight_build", { approved: items, timeline_name: tlName, order, handles_s: handles }, false);
      const v = s.events.find((ev) => ev.type === "result")?.value as BuildResult | undefined;
      if (s.succeeded && v) setBuild(v);
    } finally { un(); setBusy(null); }
  }, [scan, approved, tlName, order, handles, listen]);

  const btn = (bg: string): React.CSSProperties => ({ background: bg, border: "none", color: bg === ACCENT ? "#1a1400" : "#fff", borderRadius: 8, padding: "8px 16px", cursor: busy ? "default" : "pointer", fontSize: 13, fontWeight: 700, opacity: busy ? 0.6 : 1 });
  const chip = (active: boolean): React.CSSProperties => ({ background: active ? "#241a36" : "transparent", border: `1px solid ${active ? ACCENT : LINE}`, color: active ? ACCENT : DIM, borderRadius: 999, padding: "4px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600 });

  return (
    <div style={{ padding: 20, color: TXT, background: BG, minHeight: "100%" }}>
      <style>{`@keyframes svbspin { to { transform: rotate(360deg) } }`}</style>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>🏅 Sports Event</h2>
        <span style={{ fontSize: 12, color: DIM, background: "#241a36", borderRadius: 6, padding: "2px 8px" }}>MVP · bevegelse + ambient</span>
        <button onClick={onClose} style={{ marginLeft: "auto", background: "#26202e", border: `1px solid ${LINE}`, color: TXT, borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 13 }}>Lukk</button>
      </div>
      <p style={{ color: DIM, fontSize: 13, marginTop: 0, maxWidth: 720 }}>
        Finn høydepunkt-øyeblikk i multi-cam-materiale (uten scoreboard eller data), triager kandidatene selv,
        og bygg en highlight-timeline. AI foreslår — du bestemmer. Timelinen er fasit; finpuss + render-vakt til slutt.
      </p>

      {/* 1 — Kilde & profil */}
      <Section n={1} title="Kilde & event-profil">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {PROFILES.map((p) => (
            <button key={p.id} onClick={() => setProfile(p.id)} style={{ ...chip(profile === p.id), padding: "6px 14px", textAlign: "left" }}>
              <div style={{ fontWeight: 700 }}>{p.label}</div>
              <div style={{ fontSize: 10, opacity: 0.8 }}>{p.hint}</div>
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={pickDir} style={{ background: "#2a2340", border: `1px solid ${LINE}`, color: TXT, borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 13 }}>Velg mappe med multi-cam…</button>
          <span style={{ fontSize: 12, color: sourceDir ? TXT : DIM, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 420 }}>{sourceDir || "ingen mappe valgt"}</span>
        </div>
      </Section>

      {/* 2 — Skann-innstillinger */}
      <Section n={2} title="Skann-innstillinger" sub="alle terskler er justerbare">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 8 }}>
          <Slider label="Bevegelses-følsomhet" val={motionSens} set={setMotionSens} min={0.4} max={2.0} step={0.1} />
          <Slider label="Ambient-følsomhet (brøl)" val={ambientSens} set={setAmbientSens} min={0.4} max={2.0} step={0.1} />
          <Slider label="Maks kandidater" val={maxC} set={setMaxC} min={20} max={400} step={10} />
        </div>
        <button onClick={() => setAdvanced((a) => !a)} style={{ background: "none", border: "none", color: DIM, cursor: "pointer", fontSize: 12, padding: 0, marginBottom: advanced ? 10 : 0 }}>{advanced ? "▾ Skjul avansert" : "▸ Avansert (fps, avstand, rull, maks klipp)"}</button>
        {advanced && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            <Slider label="Analyse-fps (lavere = raskere)" val={fps} set={setFps} min={1} max={8} step={1} />
            <Slider label="Min. avstand mellom øyeblikk" val={minGap} set={setMinGap} min={1} max={10} step={0.5} unit=" s" />
            <Slider label="Maks klipp (0 = alle)" val={maxClips} set={setMaxClips} min={0} max={60} step={1} />
            <Slider label="Før-rull" val={preS} set={setPreS} min={0.5} max={5} step={0.5} unit=" s" />
            <Slider label="Etter-rull" val={postS} set={setPostS} min={0.5} max={6} step={0.5} unit=" s" />
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 14 }}>
          <button onClick={runScan} disabled={!!busy} style={btn(ACCENT)}>{busy === "scan" ? <><Spinner /> Skanner…</> : "🔍 Skann etter øyeblikk"}</button>
          {progress && (
            <div style={{ flex: 1, maxWidth: 360 }}>
              <div style={{ height: 6, background: "#241a36", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${progress.pct}%`, height: "100%", background: ACCENT, transition: "width .2s" }} />
              </div>
              <div style={{ fontSize: 11, color: DIM, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{progress.label}</div>
            </div>
          )}
        </div>
        {log.length > 0 && (
          <div style={{ marginTop: 10, maxHeight: 70, overflow: "auto", fontSize: 11, color: DIM, fontFamily: "monospace" }}>
            {log.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        )}
      </Section>

      {/* 3 — Triage */}
      {scan && (
        <Section n={3} title="Kandidater — triage" sub={`${scan.summary.clips_scanned} klipp skannet`}>
          {/* summary + type-fordeling */}
          <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: TXT, fontWeight: 700 }}>{scan.summary.total} kandidater</span>
            <span style={{ fontSize: 13, color: "#4ad48a", fontWeight: 700 }}>✓ {approved.size} godkjent</span>
            {Object.entries(scan.summary.by_type).map(([t, n]) => (
              <span key={t} style={{ fontSize: 12, color: TYPE_COL[t] ?? DIM }}>● {t} {n}</span>
            ))}
          </div>
          {/* verktøylinje */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
            {(["alle", "høydepunkt", "action", "jubel"] as const).map((t) => (
              <button key={t} onClick={() => setFType(t)} style={chip(fType === t)}>{t}</button>
            ))}
            <span style={{ width: 1, height: 20, background: LINE }} />
            <label style={{ fontSize: 12, color: DIM, display: "flex", alignItems: "center", gap: 6 }}>
              min score {minScore.toFixed(2)}
              <input type="range" min={0} max={1} step={0.05} value={minScore} onChange={(e) => setMinScore(parseFloat(e.target.value))} style={{ accentColor: ACCENT, width: 90 }} />
            </label>
            <label style={{ fontSize: 12, color: DIM, display: "flex", alignItems: "center", gap: 4 }}>
              sorter
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as "score" | "tid" | "kamera")} style={{ background: "#0f0b1c", border: `1px solid ${LINE}`, color: TXT, borderRadius: 6, padding: "3px 6px", fontSize: 12 }}>
                <option value="score">score</option><option value="tid">tid</option><option value="kamera">kamera</option>
              </select>
            </label>
            <button onClick={approveVisible} style={{ ...chip(false), marginLeft: "auto", color: "#4ad48a", borderColor: "#2a8f4e" }}>Godkjenn alle synlige ({visible.length})</button>
            <button onClick={() => setApproved(new Set())} style={chip(false)}>Nullstill</button>
          </div>
          {/* kontaktark */}
          {visible.length === 0 ? (
            <div style={{ color: DIM, fontSize: 13, padding: 20, textAlign: "center" }}>Ingen kandidater matcher filteret.</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 12 }}>
              {visible.map((c) => {
                const on = approved.has(c.id);
                return (
                  <div key={c.id} style={{ background: "#0f0b1c", border: `1px solid ${on ? "#2a8f4e" : LINE}`, borderRadius: 10, overflow: "hidden", outline: on ? "1px solid #2a8f4e" : "none" }}>
                    <div style={{ position: "relative", cursor: "pointer", background: "#000" }} onClick={() => setPreview(c)}>
                      {c.thumb ? <img src={convertFileSrc(c.thumb)} alt="" style={{ width: "100%", display: "block", aspectRatio: "16/9", objectFit: "cover" }} /> : <div style={{ aspectRatio: "16/9" }} />}
                      <span style={{ position: "absolute", top: 6, left: 6, fontSize: 10, fontWeight: 800, color: "#000", background: TYPE_COL[c.type] ?? "#ccc", borderRadius: 4, padding: "1px 6px" }}>{c.type}</span>
                      <span style={{ position: "absolute", top: 6, right: 6, fontSize: 10, color: "#fff", background: "rgba(0,0,0,.6)", borderRadius: 4, padding: "1px 6px" }}>▶ {mmss(c.t_peak)}</span>
                      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 4, background: "rgba(0,0,0,.4)" }}>
                        <div style={{ width: `${c.score * 100}%`, height: "100%", background: ACCENT }} />
                      </div>
                    </div>
                    <div style={{ padding: "8px 10px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: DIM }}>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 120 }}>{c.camera}</span>
                        <span style={{ color: TXT, fontWeight: 700 }}>{c.score.toFixed(2)}</span>
                      </div>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", margin: "5px 0" }}>
                        {c.why.map((w, i) => <span key={i} style={{ fontSize: 9, color: DIM, background: "#181328", borderRadius: 4, padding: "1px 5px" }}>{w}</span>)}
                      </div>
                      <button onClick={() => toggle(c.id)} style={{ width: "100%", marginTop: 4, background: on ? "#2a8f4e" : "#241a36", border: `1px solid ${on ? "#2a8f4e" : LINE}`, color: on ? "#fff" : DIM, borderRadius: 6, padding: "5px 0", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>{on ? "✓ Godkjent" : "Godkjenn"}</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>
      )}

      {/* 4 — Bygg */}
      {scan && (
        <Section n={4} title="Bygg highlight-timeline" sub="fra godkjente øyeblikk">
          <div style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
            <label style={{ fontSize: 12, color: DIM }}>Rekkefølge
              <select value={order} onChange={(e) => setOrder(e.target.value as "chrono" | "score")} style={{ display: "block", marginTop: 4, background: "#0f0b1c", border: `1px solid ${LINE}`, color: TXT, borderRadius: 6, padding: "6px 8px", fontSize: 12 }}>
                <option value="chrono">Kronologisk (kamera/tid)</option><option value="score">Etter score (best først)</option>
              </select>
            </label>
            <label style={{ fontSize: 12, color: DIM }}>Handles (sek)
              <input type="number" min={0} max={3} step={0.5} value={handles} onChange={(e) => setHandles(parseFloat(e.target.value) || 0)} style={{ display: "block", marginTop: 4, width: 80, background: "#0f0b1c", border: `1px solid ${LINE}`, color: TXT, borderRadius: 6, padding: "6px 8px", fontSize: 12 }} />
            </label>
            <label style={{ fontSize: 12, color: DIM, flex: 1, minWidth: 200 }}>Timeline-navn
              <input value={tlName} onChange={(e) => setTlName(e.target.value)} style={{ display: "block", marginTop: 4, width: "100%", background: "#0f0b1c", border: `1px solid ${LINE}`, color: TXT, borderRadius: 6, padding: "6px 8px", fontSize: 12 }} />
            </label>
            <button onClick={runBuild} disabled={!!busy || approved.size === 0} style={{ ...btn(ACCENT), opacity: (busy || approved.size === 0) ? 0.5 : 1 }}>{busy === "build" ? <><Spinner /> Bygger…</> : `🎬 Bygg highlight (${approved.size})`}</button>
          </div>
          {build && (
            <div style={{ marginTop: 14, padding: 12, background: "#0f0b1c", border: "1px solid #2a8f4e", borderRadius: 8, fontSize: 13, color: TXT }}>
              ✓ Bygde <b>«{build.timeline}»</b> · {build.count} øyeblikk · {build.duration_s}s ({build.order})
              <div style={{ color: DIM, fontSize: 12, marginTop: 4 }}>Neste: finpuss klippene, legg musikk, og bruk <b>Render-vakt + Leverings-QC</b> (Social 9:16-fanen) for å rendre hele timelinen og verifisere.</div>
            </div>
          )}
        </Section>
      )}

      {/* forhåndsvisning */}
      {preview && (
        <div onClick={() => setPreview(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 12, padding: 14, maxWidth: "80vw", maxHeight: "88vh" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: TXT }}><b style={{ color: TYPE_COL[preview.type] }}>{preview.type}</b> · {preview.camera} · {mmss(preview.t_peak)} · score {preview.score.toFixed(2)}</span>
              <button onClick={() => setPreview(null)} style={{ background: "#26202e", border: `1px solid ${LINE}`, color: TXT, borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontSize: 12 }}>Lukk</button>
            </div>
            <video src={convertFileSrc(preview.clip_path)} controls autoPlay style={{ maxWidth: "76vw", maxHeight: "72vh", display: "block", background: "#000" }}
              onLoadedMetadata={(e) => { (e.currentTarget as HTMLVideoElement).currentTime = preview.in_s; }} />
            <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
              <button onClick={() => { toggle(preview.id); }} style={{ background: approved.has(preview.id) ? "#2a8f4e" : "#241a36", border: `1px solid ${approved.has(preview.id) ? "#2a8f4e" : LINE}`, color: approved.has(preview.id) ? "#fff" : DIM, borderRadius: 6, padding: "6px 16px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>{approved.has(preview.id) ? "✓ Godkjent" : "Godkjenn"}</button>
              <span style={{ fontSize: 11, color: DIM, alignSelf: "center" }}>Klippet spilles fra øyeblikkets inn-punkt ({mmss(preview.in_s)}–{mmss(preview.out_s)}).</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
