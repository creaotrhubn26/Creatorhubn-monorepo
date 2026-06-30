import { useCallback, useEffect, useRef, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { executeScript, onScriptEvent, convertFileSrc } from "../api";
import type { ScriptEvent } from "../types";

/**
 * Social Vertikal (B-kamera) — veiviser som lager en 9:16-versjon av en ferdig
 * landscape-edit ved å bytte bildet til vertikalt B-kamera, tids-matchet +
 * frame-presist lip-synket. Sluttilstand: kun gradering/finredigering gjenstår.
 *
 * Kjører de registrerte svb_*-scriptene stegvis med kontrollpunkter. Config
 * ("Prosjekt-kilder") lagres i localStorage og deles med andre verktøy.
 */

const CONFIG_KEY = "svb.projectSources";

interface ProjectSources {
  refTimeline: string;
  outTimeline: string;
  workDir: string;
  acamDir: string;
  bcamDir: string;
  musicDir: string;
  recorderDir: string;
  acamFilenameTimeRe: string;
  offset: string; // tom = kalibrer
  outW: number;
  outH: number;
  fps: number;
  fillZoom: number;
  corrMin: number;
}

const DEFAULTS: ProjectSources = {
  refTimeline: "Timeline 5",
  outTimeline: "Social 9x16",
  workDir: "",
  acamDir: "",
  bcamDir: "",
  musicDir: "",
  recorderDir: "",
  acamFilenameTimeRe: "_(\\d{6})\\w\\w_CANON",
  offset: "",
  outW: 1080,
  outH: 1920,
  fps: 25,
  fillZoom: 1.778,
  corrMin: 0.6,
};

function loadConfig(): ProjectSources {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULTS };
}

interface StepDef {
  id: string;
  scriptId: string;
  label: string;
  gate?: boolean; // krever eksplisitt "Godkjenn" før neste
  buildParams: (c: ProjectSources, state: WizardState) => Record<string, unknown>;
}

interface WizardState {
  reframePans: Record<string, number>;
  cameraMoves: Record<string, string>; // tlIn -> mov-sti
}

const STEPS: StepDef[] = [
  { id: "inspect", scriptId: "svb_inspect", label: "1 · Inspiser referanse-timeline",
    buildParams: (c) => ({ refTimeline: c.refTimeline, workDir: c.workDir }) },
  { id: "match", scriptId: "svb_match", label: "2 · Match B-kamera (tid-på-døgn)", gate: true,
    buildParams: (c) => ({ workDir: c.workDir, bcamDir: c.bcamDir, acamFilenameTimeRe: c.acamFilenameTimeRe,
      offset: c.offset.trim() === "" ? null : Number(c.offset), fps: c.fps }) },
  { id: "reframe", scriptId: "svb_reframe", label: "3 · Reframe fallbacks (YOLO)",
    buildParams: (c) => ({ workDir: c.workDir, acamDir: c.acamDir, outW: c.outW, outH: c.outH }) },
  { id: "build", scriptId: "svb_build", label: "4 · Bygg vertikal timeline",
    buildParams: (c, s) => ({ workDir: c.workDir, outTimeline: c.outTimeline, bcamDir: c.bcamDir,
      outW: c.outW, outH: c.outH, fps: c.fps, fillZoom: c.fillZoom, applyLipsync: false,
      reframePans: s.reframePans, cameraMoves: s.cameraMoves }) },
  { id: "lipsync", scriptId: "svb_lipsync", label: "5 · Lip-sync (envelope-korr)", gate: true,
    buildParams: (c) => ({ workDir: c.workDir, acamDir: c.acamDir, bcamDir: c.bcamDir, corrMin: c.corrMin }) },
  { id: "build2", scriptId: "svb_build", label: "6 · Bygg på nytt m/ lip-sync",
    buildParams: (c, s) => ({ workDir: c.workDir, outTimeline: c.outTimeline, bcamDir: c.bcamDir,
      outW: c.outW, outH: c.outH, fps: c.fps, fillZoom: c.fillZoom, applyLipsync: true,
      reframePans: s.reframePans, cameraMoves: s.cameraMoves }) },
  { id: "master", scriptId: "svb_master_audio", label: "7 · Master-lyd (render)",
    buildParams: (c) => ({ workDir: c.workDir, refTimeline: c.refTimeline, outTimeline: c.outTimeline, audioEndSec: 0 }) },
  { id: "verify", scriptId: "svb_verify", label: "8 · Verifiser (stills)",
    buildParams: (c) => ({ workDir: c.workDir, outTimeline: c.outTimeline, fps: c.fps }) },
];

type StepStatus = "idle" | "running" | "done" | "approved" | "error";

export function SocialVerticalPanel({ onClose }: { onClose: () => void }) {
  const [cfg, setCfg] = useState<ProjectSources>(loadConfig);
  const [status, setStatus] = useState<Record<string, StepStatus>>({});
  const [results, setResults] = useState<Record<string, any>>({});
  const [log, setLog] = useState<string[]>([]);
  const [progress, setProgress] = useState<{ pct: number; label: string } | null>(null);
  const [activeStep, setActiveStep] = useState<string | null>(null);
  const stateRef = useRef<WizardState>({ reframePans: {}, cameraMoves: {} });
  const [camMoves, setCamMoves] = useState<Record<string, { status: "idle" | "running" | "done" | "error"; path?: string; previews?: string[]; sizeBytes?: number }>>({});

  useEffect(() => { localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg)); }, [cfg]);

  const upd = (k: keyof ProjectSources, v: string | number) => setCfg((p) => ({ ...p, [k]: v }));

  const pickDir = useCallback(async (k: keyof ProjectSources) => {
    const picked = await openDialog({ directory: true, multiple: false });
    if (typeof picked === "string") upd(k, picked);
  }, []);

  const stepIndex = (id: string) => STEPS.findIndex((s) => s.id === id);
  const canRun = (id: string): boolean => {
    const idx = stepIndex(id);
    if (idx === 0) return true;
    const prev = STEPS[idx - 1];
    const ps = status[prev.id];
    return prev.gate ? ps === "approved" : (ps === "done" || ps === "approved");
  };

  const runStep = useCallback(async (step: StepDef) => {
    if (!cfg.workDir) { setLog((l) => [...l, "⚠️ Sett Arbeidsmappe først."]); return; }
    setActiveStep(step.id);
    setStatus((s) => ({ ...s, [step.id]: "running" }));
    setLog([`▶ ${step.label}`]);
    setProgress(null);
    const unlisten = await onScriptEvent((e: ScriptEvent) => {
      if (e.type === "progress") setProgress({ pct: e.percent ?? 0, label: e.label ?? "" });
      else if (e.type === "log" || e.type === "warn" || e.type === "error" || e.type === "stderr")
        setLog((l) => [...l, `${e.type === "log" ? "" : e.type + ": "}${e.message ?? ""}`].slice(-200));
    });
    try {
      const params = step.buildParams(cfg, stateRef.current);
      const summary = await executeScript(step.scriptId, params, false);
      const resultEv = summary.events.find((e) => e.type === "result");
      const value = (resultEv?.value as any) ?? null;
      setResults((r) => ({ ...r, [step.id]: value }));
      if (step.id === "reframe" && value?.rows) {
        const pans: Record<string, number> = {};
        for (const row of value.rows) pans[String(row.tlIn)] = row.pan;
        stateRef.current.reframePans = pans;
      }
      setStatus((s) => ({ ...s, [step.id]: summary.succeeded ? "done" : "error" }));
      if (!summary.succeeded) setLog((l) => [...l, "✖ Script feilet (se logg over)."]);
    } catch (err) {
      setStatus((s) => ({ ...s, [step.id]: "error" }));
      setLog((l) => [...l, `✖ ${String(err)}`]);
    } finally {
      unlisten();
      setProgress(null);
      setActiveStep(null);
    }
  }, [cfg]);

  const approve = (id: string) => setStatus((s) => ({ ...s, [id]: "approved" }));

  const runCamMove = useCallback(async (row: any, zoom: number, drift: string, profile = "4") => {
    if (!cfg.workDir || !cfg.acamDir) { setLog((l) => [...l, "⚠️ Sett arbeidsmappe + A-kamera-mappe først."]); return; }
    const key = String(row.tlIn);
    const base = String(row.aFile).split("/").pop();
    const outPath = `${cfg.workDir}/cam_move_${key.replace(/[^0-9]/g, "_")}.mov`;
    setCamMoves((m) => ({ ...m, [key]: { status: "running" } }));
    setActiveStep("cam:" + key);
    setLog((l) => [...l, `▶ Kamera-flytt ${key}s (zoom ${zoom}, drift ${drift})`]);
    const unlisten = await onScriptEvent((e: ScriptEvent) => {
      if (e.type === "log" || e.type === "error" || e.type === "warn")
        setLog((l) => [...l, e.message ?? ""].slice(-200));
    });
    try {
      const params = {
        srcFile: `${cfg.acamDir}/${base}`, outPath,
        srcInS: (row.aSrcInF ?? 0) / cfg.fps, frames: row.durF,
        outW: cfg.outW, outH: cfg.outH, zoom, drift, proresProfile: profile,
      };
      const summary = await executeScript("svb_camera_move", params, false);
      if (summary.succeeded) {
        const rv = summary.events.find((e) => e.type === "result")?.value as any;
        const previews = (rv?.previews ?? []) as string[];
        const sizeBytes = (rv?.sizeBytes ?? 0) as number;
        stateRef.current.cameraMoves[key] = outPath;
        setCamMoves((m) => ({ ...m, [key]: { status: "done", path: outPath, previews, sizeBytes } }));
        setLog((l) => [...l, `✓ Kamera-flytt klar for ${key}s — bygg på nytt (steg 4/6) for å ta det inn.`]);
      } else {
        setCamMoves((m) => ({ ...m, [key]: { status: "error" } }));
        setLog((l) => [...l, "✖ Kamera-flytt feilet."]);
      }
    } catch (err) {
      setCamMoves((m) => ({ ...m, [key]: { status: "error" } }));
      setLog((l) => [...l, `✖ ${String(err)}`]);
    } finally {
      unlisten();
      setActiveStep(null);
    }
  }, [cfg]);

  const cfgRow = (label: string, k: keyof ProjectSources, opts?: { dir?: boolean; num?: boolean; ph?: string }) => (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
      <span style={{ opacity: 0.8 }}>{label}</span>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          style={{ flex: 1, padding: "6px 8px", background: "#1a1a1f", color: "#eee", border: "1px solid #333", borderRadius: 6 }}
          value={String(cfg[k] ?? "")} placeholder={opts?.ph}
          onChange={(e) => upd(k, opts?.num ? Number(e.target.value) : e.target.value)}
        />
        {opts?.dir && <button onClick={() => pickDir(k)} style={btnSmall}>Velg…</button>}
      </div>
    </label>
  );

  const busyLabel = activeStep
    ? (activeStep.startsWith("cam:")
        ? `Kamera-flytt ${activeStep.slice(4)}s rendres…`
        : `Kjører: ${STEPS.find((s) => s.id === activeStep)?.label ?? activeStep}…`)
    : null;

  return (
    <div style={{ padding: 20, color: "#eee", maxWidth: 1100, margin: "0 auto" }}>
      <style>{`@keyframes svbspin { to { transform: rotate(360deg) } }`}</style>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>Social Vertikal (B-kamera)</h2>
        <button onClick={onClose} style={btnSmall}>Lukk</button>
      </div>
      <p style={{ opacity: 0.7, fontSize: 13, marginTop: 0 }}>
        Lag en 9:16-versjon av en ferdig landscape-edit med eget vertikalt B-kamera. Kjør stegene i
        rekkefølge og godkjenn kontrollpunktene. Til slutt gjenstår kun gradering/finredigering.
      </p>
      {busyLabel && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", marginBottom: 12,
          background: "#241f3a", border: "1px solid #4a3f7a", borderRadius: 8 }}>
          <Spinner size={18} />
          <span style={{ fontWeight: 600 }}>{busyLabel}</span>
          <span style={{ opacity: 0.6, fontSize: 12 }}>— se logg nederst for detaljer (dette kan ta tid)</span>
        </div>
      )}

      {/* PROSJEKT-KILDER (delt config) */}
      <details open style={{ ...card, marginBottom: 16 }}>
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>Prosjekt-kilder (lagres + deles på tvers av verktøy)</summary>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
          {cfgRow("Referanse-timeline (ferdig edit)", "refTimeline", { ph: "Timeline 5" })}
          {cfgRow("Output-timeline (navn)", "outTimeline", { ph: "Social 9x16" })}
          {cfgRow("Arbeidsmappe", "workDir", { dir: true })}
          {cfgRow("A-kamera-mappe (kilde-edit)", "acamDir", { dir: true })}
          {cfgRow("B-kamera-mappe (vertikalt)", "bcamDir", { dir: true })}
          {cfgRow("Musikk-mappe", "musicDir", { dir: true })}
          {cfgRow("Opptaker-mappe (Tascam o.l.)", "recorderDir", { dir: true })}
          {cfgRow("A-kam filnavn-regex (HHMMSS)", "acamFilenameTimeRe")}
          {cfgRow("Klokke-offset sek (tom = kalibrer)", "offset", { ph: "auto" })}
          <div style={{ display: "flex", gap: 8 }}>
            {cfgRow("Bredde", "outW", { num: true })}
            {cfgRow("Høyde", "outH", { num: true })}
            {cfgRow("FPS", "fps", { num: true })}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {cfgRow("Fyll-zoom (B)", "fillZoom", { num: true })}
            {cfgRow("Min lip-sync corr", "corrMin", { num: true })}
          </div>
        </div>
      </details>

      {/* STEPPER */}
      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {STEPS.map((step) => {
            const st = status[step.id] ?? "idle";
            const enabled = canRun(step.id) && activeStep === null;
            return (
              <div key={step.id} style={{ ...card, opacity: canRun(step.id) || st !== "idle" ? 1 : 0.5,
                border: st === "running" ? "1px solid #7c5cff" : card.border,
                boxShadow: st === "running" ? "0 0 0 2px rgba(124,92,255,0.25)" : undefined }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{step.label}</span>
                  <span style={{ fontSize: 11, opacity: 0.9, display: "flex", alignItems: "center", gap: 6 }}>
                    {st === "running" && <Spinner />}{statusBadge(st)}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <button disabled={!enabled} onClick={() => runStep(step)} style={enabled ? btn : btnDisabled}>
                    {st === "running" ? "Kjører…" : st === "done" || st === "approved" ? "Kjør på nytt" : "Kjør"}
                  </button>
                  {step.gate && st === "done" && (
                    <button onClick={() => approve(step.id)} style={btnApprove}>Godkjenn ✓</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* RESULT + LOGG */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {progress && (
            <div style={card}>
              <div style={{ fontSize: 12, marginBottom: 6 }}>{progress.label} — {progress.pct}%</div>
              <div style={{ height: 6, background: "#222", borderRadius: 4 }}>
                <div style={{ height: 6, width: `${progress.pct}%`, background: "#7c5cff", borderRadius: 4 }} />
              </div>
            </div>
          )}
          <ResultView results={results} />
          <CamMoveSection
            rows={(results["match"]?.rows ?? []).filter((r: any) => !r.bFull)}
            camMoves={camMoves}
            disabled={activeStep !== null}
            fps={cfg.fps} outW={cfg.outW} outH={cfg.outH}
            onRun={runCamMove}
          />
          <div style={{ ...card, fontFamily: "monospace", fontSize: 11, maxHeight: 260, overflow: "auto", whiteSpace: "pre-wrap" }}>
            {log.length ? log.join("\n") : "Logg vises her når du kjører et steg."}
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultView({ results }: { results: Record<string, any> }) {
  const match = results["match"];
  const lipsync = results["lipsync"];
  const build = results["build2"] ?? results["build"];
  const verify = results["verify"];
  const inspect = results["inspect"];
  return (
    <>
      {inspect && (
        <div style={card}>
          <b>Inspeksjon:</b> {inspect.timeline} — {inspect.clipCount} klipp, V{inspect.videoTracks}/A{inspect.audioTracks} @ {inspect.fps}fps
        </div>
      )}
      {match && (
        <div style={card}>
          <b>Shot-kart:</b> {match.shots} shots · {match.bFull} B-treff · {match.fallbacks} fallback · offset {match.offset ?? "?"}s
          <div style={{ maxHeight: 220, overflow: "auto", marginTop: 8 }}>
            <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
              <thead><tr><th style={th}>TL</th><th style={th}>A-fil</th><th style={th}>B</th><th style={th}>status</th></tr></thead>
              <tbody>
                {(match.rows ?? []).map((r: any, i: number) => (
                  <tr key={i} style={{ background: r.bFull ? "transparent" : "#3a2a00" }}>
                    <td style={td}>{r.tlIn}s</td><td style={td}>{(r.aFile || "").slice(-20)}</td>
                    <td style={td}>{r.b || "—"}</td>
                    <td style={td}>{r.bFull ? "✓ B" : "fallback"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {lipsync && (
        <div style={card}>
          <b>Lip-sync:</b> {lipsync.applied}/{lipsync.pairs} par justert (corr ≥ {lipsync.corrMin})
          <div style={{ maxHeight: 180, overflow: "auto", marginTop: 8 }}>
            <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
              <thead><tr><th style={th}>B</th><th style={th}>corr</th><th style={th}>offset</th><th style={th}></th></tr></thead>
              <tbody>
                {(lipsync.rows ?? []).map((r: any, i: number) => (
                  <tr key={i}><td style={td}>{r.b}</td><td style={td}>{r.corr}</td>
                    <td style={td}>{r.offS > 0 ? "+" : ""}{r.offS}s ({r.offF}f)</td>
                    <td style={td}>{r.apply ? "✓" : "—"}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {build && (
        <div style={card}>
          <b>Bygg:</b> {build.clips} klipp ({build.bClips} B, {build.aFallback} fallback, {build.cameraMoves} kamera-flytt) ·
          kontiguitets-brudd {build.contiguityBreaks} · slutt {build.videoEndSec}s · lip-sync {build.lipsyncApplied ? "på" : "av"}
          {build.contiguityBreaks > 0 && <div style={{ color: "#ff8" }}>⚠️ Kontiguitets-brudd — sjekk plan/frames.</div>}
        </div>
      )}
      {verify && (
        <div style={card}>
          <b>Verifisering:</b> {verify.clips} klipp · brudd {verify.contiguityBreaks} · video {verify.videoEndSec}s · lyd {verify.audioEndSec}s
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(90px,1fr))", gap: 6, marginTop: 8 }}>
            {(verify.stills ?? []).map((p: string, i: number) => (
              <img key={i} src={convertFileSrc(p)} alt={`shot ${i}`} style={{ width: "100%", borderRadius: 4 }} />
            ))}
          </div>
          <div style={{ marginTop: 8, color: "#9f9" }}>Spill av i Resolve for lip-sync. Deretter: kun gradering + finredigering gjenstår.</div>
        </div>
      )}
    </>
  );
}

function CamMoveSection({ rows, camMoves, disabled, fps, outW, outH, onRun }: {
  rows: any[];
  camMoves: Record<string, { status: string; path?: string; previews?: string[]; sizeBytes?: number }>;
  disabled: boolean;
  fps: number; outW: number; outH: number;
  onRun: (row: any, zoom: number, drift: string, profile: string) => void;
}) {
  const [profile, setProfile] = useState("4");
  if (!rows.length) return null;
  const totalEstMB = rows.reduce((sum, r) => sum + estBytesMB(profile, r.durF, fps, outW, outH), 0);
  return (
    <details style={card}>
      <summary style={{ cursor: "pointer", fontWeight: 600 }}>
        Kamera-flytt for fallback-shots (valgfritt) — {rows.length} kandidater
      </summary>
      <p style={{ fontSize: 11, opacity: 0.7, margin: "8px 0" }}>
        For intensjonelt uskarpe shots / dekningshull: lag et bevisst keyframet kamera-flytt (push-in + drift)
        i stedet for statisk crop. Ingen fargekorreksjon bakes inn — graderer likt som nabo-klippene.
        Etter at du har laget dem, kjør «Bygg på nytt» (steg 4/6) for å ta dem inn.
      </p>
      <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        Kvalitet:
        <select value={profile} onChange={(e) => setProfile(e.target.value)} style={inputSm}>
          <option value="4">ProRes 4444 — null tap (anbefalt)</option>
          <option value="5">ProRes 4444 XQ — maks</option>
          <option value="3">ProRes 422 HQ — mindre fil</option>
        </select>
      </label>
      <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 6 }}>Estimert total: ~{totalEstMB.toFixed(0)} MB</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {rows.map((r) => (
          <CamMoveRow key={String(r.tlIn)} row={r} state={camMoves[String(r.tlIn)]} disabled={disabled}
            profile={profile} fps={fps} outW={outW} outH={outH}
            onRun={(row, zoom, drift) => onRun(row, zoom, drift, profile)} />
        ))}
      </div>
    </details>
  );
}

function CamMoveRow({ row, state, disabled, profile, fps, outW, outH, onRun }: {
  row: any;
  state?: { status: string; path?: string; previews?: string[]; sizeBytes?: number };
  disabled: boolean;
  profile: string; fps: number; outW: number; outH: number;
  onRun: (row: any, zoom: number, drift: string) => void;
}) {
  const [zoom, setZoom] = useState(0.12);
  const [drift, setDrift] = useState("left");
  const st = state?.status ?? "idle";
  const estMB = estBytesMB(profile, row.durF, fps, outW, outH);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "6px 0", borderBottom: "1px solid #222" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, flexWrap: "wrap" }}>
        <span style={{ width: 56 }}>{row.tlIn}s</span>
        <span style={{ flex: 1, opacity: 0.8 }}>{String(row.aFile).slice(-18)} · {row.durF}f</span>
        <label>zoom <input type="number" step="0.02" value={zoom} onChange={(e) => setZoom(Number(e.target.value))}
          style={{ width: 56, ...inputSm }} /></label>
        <select value={drift} onChange={(e) => setDrift(e.target.value)} style={inputSm}>
          <option value="left">drift venstre</option>
          <option value="right">drift høyre</option>
          <option value="none">ingen drift</option>
        </select>
        <span style={{ fontSize: 11, opacity: 0.7, width: 110, textAlign: "right" }}>
          {st === "done" && state?.sizeBytes ? `${(state.sizeBytes / 1e6).toFixed(0)} MB` : `~${estMB.toFixed(0)} MB est.`}
        </span>
        <button disabled={disabled} onClick={() => onRun(row, zoom, drift)} style={disabled ? btnDisabled : btnSmall}>
          {st === "running" ? "Rendrer…" : st === "done" ? "Lag på nytt" : "Lag"}
        </button>
        {st === "running" && <Spinner />}
        <span>{st === "done" ? "✓" : st === "error" ? "✖" : ""}</span>
      </div>
      {state?.previews && state.previews.length > 0 && (
        <div style={{ display: "flex", gap: 4 }}>
          {state.previews.map((p, i) => (
            <div key={i} style={{ textAlign: "center" }}>
              <img src={convertFileSrc(p)} alt={`preview ${i}`}
                style={{ width: 64, height: 114, objectFit: "cover", borderRadius: 4, border: "1px solid #333" }} />
              <div style={{ fontSize: 9, opacity: 0.6 }}>{["start", "midt", "slutt"][i] ?? ""}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function statusBadge(s: StepStatus): string {
  return s === "done" ? "✓ ferdig" : s === "approved" ? "✓ godkjent" : s === "running" ? "⏳" : s === "error" ? "✖ feil" : "—";
}

function Spinner({ size = 14 }: { size?: number }) {
  return <span style={{ display: "inline-block", width: size, height: size, border: "2px solid #4a3f7a",
    borderTopColor: "#a78bfa", borderRadius: "50%", animation: "svbspin 0.7s linear infinite", flex: "none" }} />;
}

// Grov estimat-bitrate (Mbps) for ProRes @ 1920x1080@30 — skaleres med pikselantall + fps.
function estBytesMB(profile: string, durF: number, fps: number, w: number, h: number): number {
  const base = profile === "5" ? 500 : profile === "3" ? 220 : 330; // 4444 XQ / 422 HQ / 4444
  const mbps = base * ((w * h) / (1920 * 1080)) * ((fps || 25) / 30);
  const sec = (durF || 0) / (fps || 25);
  return (mbps * sec) / 8;
}

const card: React.CSSProperties = { background: "#16161b", border: "1px solid #2a2a33", borderRadius: 8, padding: 12 };
const btn: React.CSSProperties = { padding: "6px 12px", background: "#7c5cff", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12 };
const btnDisabled: React.CSSProperties = { ...btn, background: "#333", color: "#888", cursor: "not-allowed" };
const btnApprove: React.CSSProperties = { ...btn, background: "#2a8f4e" };
const btnSmall: React.CSSProperties = { padding: "4px 10px", background: "#26262e", color: "#ddd", border: "1px solid #333", borderRadius: 6, cursor: "pointer", fontSize: 12 };
const inputSm: React.CSSProperties = { padding: "3px 6px", background: "#1a1a1f", color: "#eee", border: "1px solid #333", borderRadius: 6, fontSize: 12 };
const th: React.CSSProperties = { textAlign: "left", padding: "2px 4px", borderBottom: "1px solid #333", opacity: 0.7 };
const td: React.CSSProperties = { padding: "2px 4px", borderBottom: "1px solid #222" };
