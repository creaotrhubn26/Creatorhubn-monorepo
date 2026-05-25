import { useCallback, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { executeScript } from "../api";
import type { ScriptEvent } from "../types";
import { RetakeReview, type RetakeResult } from "./RetakeReview";
import { TranscriptionReview, type TranscriptionResult } from "./TranscriptionReview";

type DeliveryTarget = "wedding" | "youtube" | "instagram" | "podcast" | "broadcast";

interface SourcesResult {
  totalItemsScanned?: number;
  summary?: Record<string, number>;
  warnings?: string[];
}

interface LoudnessResult {
  averageLufs?: number;
  maxTruePeak?: number;
  clipsBelowTarget?: Array<{ name: string; lufs: number }>;
  clipsAboveTruePeak?: Array<{ name: string; truePeak: number }>;
  clipsMeasured?: number;
  target?: { integrated: number; truePeak: number; lra: number };
}

interface ClippingResult {
  clippedCount?: number;
  cleanCount?: number;
  flagged?: Array<{ name: string; peakDb: number }>;
}

interface LowDialogueResult {
  lowDialogueCount?: number;
  flagged?: Array<{ name: string; lufs: number }>;
}

function pickResult<T>(events: ScriptEvent[]): T | null {
  const result = events.find((e) => e.type === "result");
  return result ? ((result.value as T) ?? null) : null;
}

export function AudioView() {
  const [delivery, setDelivery] = useState<DeliveryTarget>("wedding");
  const [busy, setBusy] = useState<string | null>(null);
  const [sources, setSources] = useState<SourcesResult | null>(null);
  const [loudness, setLoudness] = useState<LoudnessResult | null>(null);
  const [clipping, setClipping] = useState<ClippingResult | null>(null);
  const [lowDialogue, setLowDialogue] = useState<LowDialogueResult | null>(null);
  const [reportPath, setReportPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retakes, setRetakes] = useState<RetakeResult | null>(null);
  const [heroSelections, setHeroSelections] = useState<Record<string, string>>({});
  const [transcription, setTranscription] = useState<TranscriptionResult | null>(null);

  const runStep = useCallback(
    async <T,>(
      scriptId: string,
      params: Record<string, unknown>,
      label: string,
      setter: (v: T) => void,
    ) => {
      setBusy(label);
      setError(null);
      try {
        const summary = await executeScript(scriptId, params, false);
        const r = pickResult<T>(summary.events);
        if (r) setter(r);
      } catch (e) {
        setError(`${label}: ${e}`);
      } finally {
        setBusy(null);
      }
    },
    [],
  );

  const runDryRun = useCallback(
    async (scriptId: string, params: Record<string, unknown>) => {
      setBusy(`Dry run · ${scriptId}`);
      try {
        await executeScript(scriptId, params, true);
      } catch (e) {
        setError(String(e));
      } finally {
        setBusy(null);
      }
    },
    [],
  );

  const runRetakeDetection = useCallback(async () => {
    try {
      const picked = await openDialog({
        directory: false,
        multiple: false,
        filters: [{ name: "Audio", extensions: ["wav", "aif", "aiff", "mp3", "flac", "m4a"] }],
      });
      if (typeof picked !== "string") return;
      setBusy("Detecting retakes");
      setError(null);
      const summary = await executeScript("detect_retakes", { audioPath: picked }, false);
      const result = summary.events.find((e) => e.type === "result")?.value as RetakeResult | undefined;
      if (result) {
        setRetakes(result);
        setHeroSelections({});
      } else {
        setError("Retake detection returned no result. Check the log panel.");
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  }, []);

  const runTranscription = useCallback(async () => {
    try {
      const picked = await openDialog({
        directory: false,
        multiple: false,
        filters: [{ name: "Audio", extensions: ["wav", "aif", "aiff", "mp3", "flac", "m4a", "mov", "mp4"] }],
      });
      if (typeof picked !== "string") return;
      setBusy("Transcribing (WhisperX)");
      setError(null);
      const summary = await executeScript("transcribe_audio", { audioPath: picked, model: "base", language: "auto" }, false);
      const result = summary.events.find((e) => e.type === "result")?.value as TranscriptionResult | undefined;
      if (result) setTranscription(result);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  }, []);

  const handlePickHero = useCallback((groupId: string, takeId: string) => {
    setHeroSelections((prev) => ({ ...prev, [groupId]: takeId }));
  }, []);

  const runQcReport = useCallback(async () => {
    setBusy("Audio QC Report");
    setError(null);
    try {
      const summary = await executeScript("generate_audio_qc_report", {
        deliveryTarget: delivery,
        sourcesResult: sources,
        loudnessResult: loudness,
        clippingResult: clipping,
        lowDialogueResult: lowDialogue,
      }, false);
      const r = summary.events.find((e) => e.type === "result")?.value as { markdownPath?: string } | undefined;
      if (r?.markdownPath) setReportPath(r.markdownPath);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  }, [delivery, sources, loudness, clipping, lowDialogue]);

  const target = loudness?.target;

  return (
    <div className="audio-view">
      <div className="audio-header">
        <h2>Post Audio Assistant</h2>
        <div className="audio-delivery">
          <label htmlFor="delivery-target">Delivery target:</label>
          <select
            id="delivery-target"
            value={delivery}
            onChange={(e) => setDelivery(e.target.value as DeliveryTarget)}
            disabled={!!busy}
          >
            <option value="wedding">Wedding Film (−16 LUFS)</option>
            <option value="youtube">YouTube (−14 LUFS)</option>
            <option value="instagram">Instagram Reel (−14 LUFS)</option>
            <option value="podcast">Podcast (−16 LUFS)</option>
            <option value="broadcast">Broadcast (−23 LUFS)</option>
          </select>
        </div>
      </div>

      {error && <div className="dialog-warning" style={{ margin: "0 18px 12px" }}>{error}</div>}

      <div className="audio-grid">
        {/* SOURCES */}
        <section className="audio-card">
          <h3>1 · Audio Sources</h3>
          {sources?.summary ? (
            <>
              <ul className="audio-stats">
                {Object.entries(sources.summary).map(([label, count]) => (
                  <li key={label}>
                    <span className={`chip ${label === "unknown" ? "risk-medium" : "ready"}`}>
                      {count}
                    </span>
                    {label.replace("_", " ")}
                  </li>
                ))}
              </ul>
              {sources.warnings?.map((w, i) => (
                <div key={i} className="dialog-warning" style={{ fontSize: 11 }}>{w}</div>
              ))}
            </>
          ) : (
            <div className="empty">Click Detect Sources to scan Media Pool.</div>
          )}
          <div className="audio-actions">
            <button
              className="small"
              disabled={!!busy}
              onClick={() => runDryRun("detect_audio_sources", {})}
            >
              Dry Run
            </button>
            <button
              className="small primary"
              disabled={!!busy}
              onClick={() => runStep<SourcesResult>("detect_audio_sources", {}, "Detect Sources", setSources)}
            >
              Detect Sources
            </button>
          </div>
        </section>

        {/* LOUDNESS */}
        <section className="audio-card">
          <h3>2 · Loudness (LUFS)</h3>
          {loudness ? (
            <div className="audio-loudness">
              <div>Average: <strong>{loudness.averageLufs} LUFS</strong></div>
              <div>Max true peak: <strong>{loudness.maxTruePeak} dBTP</strong></div>
              {target && (
                <div className="card-chip-meta">
                  Target: {target.integrated} LUFS, peak ≤ {target.truePeak} dBTP
                </div>
              )}
              <div className="card-chip-meta" style={{ marginTop: 4 }}>
                {loudness.clipsMeasured} clips measured ·{" "}
                {loudness.clipsBelowTarget?.length ?? 0} below target ·{" "}
                {loudness.clipsAboveTruePeak?.length ?? 0} above peak ceiling
              </div>
            </div>
          ) : (
            <div className="empty">Run loudness analysis to populate.</div>
          )}
          <div className="audio-actions">
            <button
              className="small"
              disabled={!!busy}
              onClick={() => runDryRun("analyze_loudness", { deliveryTarget: delivery })}
            >
              Dry Run
            </button>
            <button
              className="small primary"
              disabled={!!busy}
              onClick={() => runStep<LoudnessResult>(
                "analyze_loudness",
                { deliveryTarget: delivery, sampleSize: 30 },
                "Analyze Loudness",
                setLoudness,
              )}
            >
              Run (30 clips)
            </button>
          </div>
        </section>

        {/* CLIPPING */}
        <section className="audio-card">
          <h3>3 · Clipping</h3>
          {clipping ? (
            <div>
              <div>
                <span className="chip risk-high">{clipping.clippedCount}</span> clips clipped
                {' '}<span className="chip ready">{clipping.cleanCount}</span> clean
              </div>
              {clipping.flagged?.slice(0, 5).map((f) => (
                <div key={f.name} className="card-chip-meta">{f.name} — {f.peakDb.toFixed(1)} dBFS</div>
              ))}
            </div>
          ) : (
            <div className="empty">Scan for digital clipping.</div>
          )}
          <div className="audio-actions">
            <button
              className="small"
              disabled={!!busy}
              onClick={() => runDryRun("flag_clipping", {})}
            >
              Dry Run
            </button>
            <button
              className="small primary"
              disabled={!!busy}
              onClick={() => runStep<ClippingResult>("flag_clipping", { thresholdDb: -0.1 }, "Flag Clipping", setClipping)}
            >
              Flag Clipping
            </button>
          </div>
        </section>

        {/* LOW DIALOGUE */}
        <section className="audio-card">
          <h3>4 · Low Dialogue</h3>
          {lowDialogue ? (
            <div>
              <div>
                <span className="chip risk-medium">{lowDialogue.lowDialogueCount}</span> clips under threshold
              </div>
              {lowDialogue.flagged?.slice(0, 5).map((f) => (
                <div key={f.name} className="card-chip-meta">{f.name} — {f.lufs.toFixed(1)} LUFS</div>
              ))}
            </div>
          ) : (
            <div className="empty">Find quiet clips that need cleanup.</div>
          )}
          <div className="audio-actions">
            <button
              className="small"
              disabled={!!busy}
              onClick={() => runDryRun("flag_low_dialogue", {})}
            >
              Dry Run
            </button>
            <button
              className="small primary"
              disabled={!!busy}
              onClick={() => runStep<LowDialogueResult>(
                "flag_low_dialogue",
                { thresholdLufs: -28 },
                "Flag Low Dialogue",
                setLowDialogue,
              )}
            >
              Flag Low Dialogue
            </button>
          </div>
        </section>

        {/* MUSIC DUCKING */}
        <section className="audio-card">
          <h3>5 · Music Ducking Plan</h3>
          <div className="empty">
            Export a dialogue stem first, then point this script at the WAV. It detects speech regions and builds a ducking plan with Yellow timeline markers.
          </div>
          <div className="audio-actions">
            <button
              className="small"
              disabled={!!busy}
              onClick={() => runDryRun("generate_music_ducking_plan", { audioPath: "/path/to/stem.wav" })}
            >
              Dry Run
            </button>
          </div>
        </section>

        {/* RETAKE DETECTION */}
        <section className="audio-card audio-card-wide">
          <h3>6 · Retake Detection</h3>
          <div className="empty" style={{ marginBottom: 4 }}>
            Pek på en lang lyd-fil (vows / tale / intervju / podcast-episode). AI-en finner alle gjentakelser av samme innhold (retakes) basert på audio-fingerprint, og du kan høre hver enkelt take for å velge den beste.
          </div>
          {retakes && (
            <RetakeReview result={retakes} onPickHero={handlePickHero} />
          )}
          {Object.keys(heroSelections).length > 0 && (
            <div className="card-chip-meta" style={{ marginTop: 8 }}>
              {Object.keys(heroSelections).length} hero-take{Object.keys(heroSelections).length === 1 ? "" : "s"} valgt — kan brukes av place_clips_on_timeline / ducking i v2
            </div>
          )}
          <div className="audio-actions">
            <button
              className="small primary"
              onClick={runRetakeDetection}
              disabled={!!busy}
            >
              {retakes ? "Velg en annen lyd-fil…" : "Velg lyd-fil + Detect Retakes"}
            </button>
            {retakes && (
              <button
                className="small ghost"
                onClick={() => { setRetakes(null); setHeroSelections({}); }}
                disabled={!!busy}
              >
                Clear
              </button>
            )}
          </div>
        </section>

        {/* TRANSCRIPTION */}
        <section className="audio-card audio-card-wide">
          <h3>7 · Transcription (WhisperX)</h3>
          <div className="empty" style={{ marginBottom: 4 }}>
            Lokal transkripsjon via WhisperX (gratis, kjører på Apple Silicon). Velg en lydfil (vows, tale, intervju, podcast-episode) — får tilbake per-segment timestamps + tekst + talere. Krever <code>pip3 install whisperx</code> én gang.
          </div>
          {transcription && (
            <TranscriptionReview result={transcription} />
          )}
          <div className="audio-actions">
            <button
              className="small primary"
              onClick={runTranscription}
              disabled={!!busy}
            >
              {transcription ? "Velg en annen lydfil…" : "Velg lydfil + Transcribe"}
            </button>
            {transcription && (
              <button
                className="small ghost"
                onClick={() => setTranscription(null)}
                disabled={!!busy}
              >
                Clear
              </button>
            )}
          </div>
        </section>

        {/* QC REPORT */}
        <section className="audio-card audio-card-wide">
          <h3>8 · Audio QC Report</h3>
          {reportPath ? (
            <div>
              Written to: <code>{reportPath}</code>
            </div>
          ) : (
            <div className="empty">
              Runs after steps 1–4 — stitches everything into one Markdown + JSON report against the chosen delivery target.
            </div>
          )}
          <div className="audio-actions">
            <button
              className="small primary"
              disabled={!!busy || !sources}
              onClick={runQcReport}
            >
              Generate QC Report
            </button>
          </div>
        </section>
      </div>

      {busy && (
        <div className="cull-running">
          <div className="cull-running-spinner" />
          {busy}…
        </div>
      )}
    </div>
  );
}
