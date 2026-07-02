import { useCallback, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { executeScript, onScriptEvent, convertFileSrc } from "../api";
import type { ScriptEvent } from "../types";

/**
 * Musikk-ducking / balanse — stabil blokk-basert ducking (ingen pumping) med
 * presets, frekvens-bevisst (spektral) modus, visuell duck-kurve, forhåndslytt
 * (A/B rundt overgangene) og dialog-vs-musikk margin-meter. Kaller
 * `music_duck_balance`.
 */

interface Result {
  out_path: string; blocks: [number, number][]; placed_on_track: number | null;
  timeline_dur_s: number; envelope: number[]; margin_db: number | null; preview_path: string | null;
}

const PRESETS: Record<string, { duck: number; ramp: number; rms: number; pre: number; spectral: boolean }> = {
  "Cinematisk": { duck: -16, ramp: 2.5, rms: -18, pre: 1.1, spectral: true },
  "Radio / VO": { duck: -12, ramp: 1.5, rms: -17, pre: 0.8, spectral: false },
  "Subtil": { duck: -8, ramp: 1.2, rms: -19, pre: 0.6, spectral: true },
};

function Slider({ label, val, set, min, max, step, unit }: { label: string; val: number; set: (n: number) => void; min: number; max: number; step: number; unit: string }) {
  return (
    <label style={{ display: "block", fontSize: 12, color: "#cdbfe6", marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
        <span>{label}</span><span style={{ color: "#8674a8" }}>{val}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={val} onChange={(e) => set(parseFloat(e.target.value))} style={{ width: "100%", accentColor: "#ff8c00" }} />
    </label>
  );
}

// duck-kurve som SVG (envelope i dB, 0 = full, negativt = ducket)
function DuckCurve({ env }: { env: number[] }) {
  if (!env.length) return null;
  const W = 520, H = 54, min = Math.min(-20, ...env);
  const pts = env.map((v, i) => `${(i / (env.length - 1)) * W},${H - ((v - min) / (0 - min)) * (H - 6) - 3}`).join(" ");
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ background: "#0f0b1c", border: "1px solid #2a2340", borderRadius: 6, marginTop: 8 }}>
      <polyline points={`0,${H} ${pts} ${W},${H}`} fill="rgba(255,140,0,0.12)" stroke="#ff8c00" strokeWidth={1.5} />
    </svg>
  );
}

export function MusicDuckPanel() {
  const [musicPath, setMusicPath] = useState("");
  const [duckDb, setDuckDb] = useState(-13);
  const [rampS, setRampS] = useState(2.0);
  const [musicRms, setMusicRms] = useState(-18);
  const [preRoll, setPreRoll] = useState(0.9);
  const [spectral, setSpectral] = useState(false);
  const [track, setTrack] = useState<number | "">("");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [res, setRes] = useState<Result | null>(null);

  const applyPreset = (name: string) => {
    const p = PRESETS[name]; if (!p) return;
    setDuckDb(p.duck); setRampS(p.ramp); setMusicRms(p.rms); setPreRoll(p.pre); setSpectral(p.spectral);
  };

  const pickMusic = useCallback(async () => {
    const f = await openDialog({ multiple: false, filters: [{ name: "Lyd", extensions: ["wav", "mp3", "aif", "aiff", "flac"] }] });
    if (typeof f === "string") setMusicPath(f);
  }, []);

  const build = useCallback(async (mode: "preview" | "file" | "place") => {
    if (!musicPath) { setLog(["Velg en musikk-bed først"]); return; }
    setBusy(true); setLog([`▶ ${mode === "preview" ? "Bygger forhåndslytt" : "Bygger ducket musikk"}…`]); if (mode !== "preview") setRes(null);
    const unlisten = await onScriptEvent((e: ScriptEvent) => {
      if (e.type === "log" || e.type === "warn" || e.type === "error")
        setLog((l) => [`${e.type === "log" ? "" : e.type + ": "}${e.message ?? ""}`, ...l].slice(0, 60));
    });
    try {
      const params: Record<string, unknown> = {
        music_path: musicPath, duck_db: duckDb, ramp_s: rampS, music_rms_db: musicRms, pre_roll_s: preRoll, spectral,
        with_preview: mode === "preview",
      };
      if (mode === "place" && track !== "") params.place_on_track = track;
      const summary = await executeScript("music_duck_balance", params, false);
      const value = summary.events.find((ev) => ev.type === "result")?.value as Result | undefined;
      if (summary.succeeded && value) setRes(value);
    } finally { unlisten(); setBusy(false); }
  }, [musicPath, duckDb, rampS, musicRms, preRoll, spectral, track]);

  const margin = res?.margin_db;
  const marginCol = margin == null ? "#8674a8" : margin >= 8 ? "#4ad48a" : margin >= 4 ? "#f59e0b" : "#ef4f6f";

  return (
    <div style={{ border: "1px solid #2a2340", borderRadius: 10, padding: 14, background: "#181328", marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 14, color: "#e6ddf5" }}>Musikk-ducking / balanse</h3>
        <span style={{ fontSize: 12, color: "#8674a8" }}>· stabil, myk (blokk-basert)</span>
      </div>

      {/* presets */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
        {Object.keys(PRESETS).map((n) => (
          <button key={n} onClick={() => applyPreset(n)} style={{ background: "#241f3a", border: "1px solid #3a3160", color: "#cdbfe6", borderRadius: 999, padding: "4px 12px", cursor: "pointer", fontSize: 12 }}>{n}</button>
        ))}
        <label style={{ marginLeft: "auto", fontSize: 12, color: "#cdbfe6", display: "inline-flex", alignItems: "center", gap: 5 }}>
          <input type="checkbox" checked={spectral} onChange={(e) => setSpectral(e.target.checked)} style={{ accentColor: "#ff8c00" }} />
          Spektral (stemme-frekvenser)
        </label>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <button onClick={pickMusic} style={{ background: "#2a2340", border: "1px solid #3a3160", color: "#e6ddf5", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12 }}>Velg musikk-bed…</button>
        <span style={{ fontSize: 12, color: "#8674a8", alignSelf: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{musicPath ? musicPath.split("/").pop() : "ingen valgt"}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Slider label="Duck-dybde (under stemmen)" val={duckDb} set={setDuckDb} min={-24} max={-4} step={1} unit=" dB" />
        <Slider label="Overgang (tregere = mykere)" val={rampS} set={setRampS} min={0.5} max={4} step={0.1} unit=" s" />
        <Slider label="Musikk-nivå (RMS)" val={musicRms} set={setMusicRms} min={-26} max={-12} step={1} unit=" dB" />
        <Slider label="Pre-roll (dukk før stemmen)" val={preRoll} set={setPreRoll} min={0} max={2} step={0.1} unit=" s" />
      </div>

      {res?.envelope && <DuckCurve env={res.envelope} />}

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
        <button onClick={() => build("preview")} disabled={busy} style={{ background: "#241f3a", border: "1px solid #3a3160", color: "#e6ddf5", borderRadius: 8, padding: "6px 12px", cursor: busy ? "default" : "pointer", fontSize: 12 }}>{busy ? "…" : "🎧 Forhåndslytt"}</button>
        <label style={{ fontSize: 12, color: "#cdbfe6" }}>Spor A
          <input type="number" min={1} max={24} value={track} onChange={(e) => setTrack(e.target.value === "" ? "" : parseInt(e.target.value))} style={{ width: 44, marginLeft: 4, background: "#0f0b1c", border: "1px solid #3a3160", color: "#e6ddf5", borderRadius: 6, padding: "3px 6px" }} placeholder="12" />
        </label>
        <button onClick={() => build("file")} disabled={busy} style={{ marginLeft: "auto", background: "#2a2340", border: "1px solid #3a3160", color: "#e6ddf5", borderRadius: 8, padding: "6px 12px", cursor: busy ? "default" : "pointer", fontSize: 12 }}>Bygg fil</button>
        <button onClick={() => build("place")} disabled={busy || track === ""} style={{ background: "#ff8c00", border: "none", color: "#1a1400", borderRadius: 8, padding: "6px 14px", cursor: busy || track === "" ? "default" : "pointer", fontSize: 12, fontWeight: 700 }}>Bygg + legg på timeline</button>
      </div>

      {/* margin-meter + forhåndslytt-spiller */}
      {res && (margin != null || res.preview_path) && (
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 10 }}>
          {margin != null && (
            <span style={{ fontSize: 12, color: marginCol, fontWeight: 600 }}>
              Stemme {margin >= 0 ? "+" : ""}{margin} dB over musikk {margin >= 8 ? "✓" : "⚠"}
            </span>
          )}
          {res.preview_path && (
            <audio controls src={convertFileSrc(res.preview_path)} style={{ height: 30, flex: 1 }} />
          )}
        </div>
      )}

      {res && !res.preview_path && (
        <div style={{ fontSize: 12, color: "#4ad48a", marginTop: 8 }}>
          ✓ {res.blocks.length} blokker ducket{res.placed_on_track ? ` · lagt på A${res.placed_on_track}` : ` · ${res.out_path.split("/").pop()}`}
        </div>
      )}
      {log.length > 0 && (
        <div style={{ marginTop: 8, maxHeight: 80, overflow: "auto", fontSize: 11, color: "#8674a8", fontFamily: "monospace" }}>
          {log.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}
    </div>
  );
}
