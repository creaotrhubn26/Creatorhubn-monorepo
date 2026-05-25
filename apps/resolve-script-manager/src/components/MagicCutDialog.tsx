import { useCallback, useEffect, useMemo, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { cancelScript, executeScript, onScriptEvent, readProjectTemplate } from "../api";
import { loadSettings } from "./SettingsModal";
import { IconSparkle, IconX } from "./Icons";

interface Props {
  templateId: string;
  templateName: string;
  onClose: () => void;
}

interface PipelineStep {
  scriptId: string;
  label: string;
  weight: number;
  requiresApiKey?: string;
}

interface PipelineDef {
  name: string;
  description: string;
  defaultDurationSec: number;
  steps: PipelineStep[];
}

const MODEL_OPTIONS = [
  { id: "claude-haiku-4-5", label: "Haiku (rask, billig)" },
  { id: "claude-sonnet-4-6", label: "Sonnet (nøyaktig)" },
  { id: "local", label: "Lokal-only (ingen AI)" },
];

export function MagicCutDialog({ templateId, templateName, onClose }: Props) {
  const [pipeline, setPipeline] = useState<PipelineDef | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sourceFolder, setSourceFolder] = useState<string>("");
  const [duration, setDuration] = useState<number>(90);
  const [model, setModel] = useState<string>(MODEL_OPTIONS[0].id);

  const [running, setRunning] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ percent: number; label: string }>({ percent: 0, label: "" });
  const [logTail, setLogTail] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [finishedSummary, setFinishedSummary] = useState<{ completed: number; total: number } | null>(null);

  const hasApiKey = useMemo(() => {
    const s = loadSettings();
    return Boolean(s.ANTHROPIC_API_KEY?.trim());
  }, []);

  const apiKeyNeeded = useMemo(
    () => Boolean(pipeline?.steps.some((s) => s.requiresApiKey === "ANTHROPIC_API_KEY")),
    [pipeline],
  );

  useEffect(() => {
    let cancelled = false;
    readProjectTemplate(templateId)
      .then((t) => {
        if (cancelled) return;
        const p = (t as { magicCutPipeline?: PipelineDef }).magicCutPipeline;
        if (!p) {
          setLoadError(`Template '${templateId}' har ingen magicCutPipeline definert.`);
          return;
        }
        setPipeline(p);
        setDuration(p.defaultDurationSec);
      })
      .catch((e) => !cancelled && setLoadError(String(e)));
    return () => {
      cancelled = true;
    };
  }, [templateId]);

  // Subscribe to events from the orchestrator
  useEffect(() => {
    if (!running || !runId) return;
    let unlisten: (() => void) | null = null;
    onScriptEvent((event) => {
      if (event.runId !== runId) return;
      if (event.type === "progress") {
        setProgress({
          percent: Math.min(100, Math.round(event.percent ?? 0)),
          label: event.label ?? "",
        });
      } else if (event.type === "log") {
        const msg = (event as { message?: string }).message ?? "";
        if (msg) setLogTail((prev) => [...prev.slice(-9), msg]);
      } else if (event.type === "warn") {
        setLogTail((prev) => [...prev.slice(-9), `WARN: ${(event as { message?: string }).message ?? ""}`]);
      } else if (event.type === "error") {
        const msg = (event as { message?: string }).message ?? "Unknown error";
        setError(msg);
        setLogTail((prev) => [...prev.slice(-9), `ERROR: ${msg}`]);
      }
    }).then((u) => {
      unlisten = u;
    });
    return () => {
      unlisten?.();
    };
  }, [running, runId]);

  const handlePickFolder = useCallback(async () => {
    try {
      const picked = await openDialog({ directory: true, multiple: false });
      if (typeof picked === "string") setSourceFolder(picked);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  const handleStart = useCallback(async () => {
    if (!pipeline || !sourceFolder) return;
    if (apiKeyNeeded && !hasApiKey && model !== "local") {
      setError(
        "Pipeline trenger ANTHROPIC_API_KEY for cull + highlight-scoring. Sett den i Settings (5 klikk på versjons-navnet i footeren) eller velg 'Lokal-only'.",
      );
      return;
    }
    setError(null);
    setLogTail([]);
    setFinishedSummary(null);
    setProgress({ percent: 0, label: "Starting…" });
    setRunning(true);
    const generatedRunId = `magic-cut-${Date.now()}`;
    setRunId(generatedRunId);
    try {
      const summary = await executeScript(
        "auto_rough_cut",
        {
          templateId,
          sourceFolder,
          targetDurationSec: duration,
          model,
        },
        false,
      );
      setRunning(false);
      const resultEvent = summary.events.find((e) => e.type === "result");
      const value = resultEvent?.value as { completed?: number; totalSteps?: number } | undefined;
      if (value) {
        setFinishedSummary({ completed: value.completed ?? 0, total: value.totalSteps ?? 0 });
      }
      if (!summary.succeeded) {
        setError(`Pipeline feilet etter ${value?.completed ?? "?"}/${value?.totalSteps ?? "?"} steg.`);
      }
    } catch (e) {
      setRunning(false);
      setError(String(e));
    }
  }, [pipeline, sourceFolder, duration, model, templateId, apiKeyNeeded, hasApiKey]);

  const handleCancel = useCallback(async () => {
    if (!runId) return;
    try {
      await cancelScript(runId);
      setRunning(false);
      setError("Avbrutt av bruker.");
    } catch (e) {
      setError(String(e));
    }
  }, [runId]);

  return (
    <div className="modal-backdrop" onClick={!running ? onClose : undefined}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 600, maxHeight: "88vh" }}>
        <h2>
          <IconSparkle /> Magic Cut · {templateName}
        </h2>

        {loadError && <div className="dialog-warning">{loadError}</div>}

        {!pipeline && !loadError && <div className="empty">Laster pipeline…</div>}

        {pipeline && !running && !finishedSummary && (
          <>
            <div className="desc">{pipeline.description}</div>

            <div className="settings-section">
              <div className="section-title">Pipeline ({pipeline.steps.length} steg)</div>
              <ol className="magic-cut-steplist">
                {pipeline.steps.map((s) => (
                  <li key={s.scriptId}>
                    <strong>{s.label}</strong>
                    {s.requiresApiKey && <span className="card-chip-meta"> · krever {s.requiresApiKey}</span>}
                  </li>
                ))}
              </ol>
            </div>

            <div className="field">
              <label>Footage-mappe</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  value={sourceFolder}
                  onChange={(e) => setSourceFolder(e.target.value)}
                  placeholder="/Volumes/SD/DCIM/100MEDIA"
                  style={{ flex: 1 }}
                />
                <button onClick={handlePickFolder}>Velg…</button>
              </div>
              <div className="settings-help">
                Pek på en mappe med video-filer. Kan være et SD-kort, SSD-backup eller arbeids-mappe.
              </div>
            </div>

            <div className="field">
              <label>Target lengde (sekunder)</label>
              <input
                type="number"
                min={15}
                max={3600}
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value || "0", 10) || pipeline.defaultDurationSec)}
              />
              <div className="settings-help">
                Default for denne template: {pipeline.defaultDurationSec}s. Pipelinen vil prøve å lande nær dette tallet.
              </div>
            </div>

            <div className="field">
              <label>AI-modell</label>
              <select value={model} onChange={(e) => setModel(e.target.value)}>
                {MODEL_OPTIONS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
              {apiKeyNeeded && !hasApiKey && model !== "local" && (
                <div className="dialog-warning" style={{ marginTop: 6 }}>
                  ANTHROPIC_API_KEY er ikke satt. Velg "Lokal-only" eller legg inn nøkkelen i Settings.
                </div>
              )}
            </div>

            {error && <div className="dialog-warning">{error}</div>}

            <div className="actions">
              <button onClick={onClose}>Avbryt</button>
              <button className="primary" onClick={handleStart} disabled={!sourceFolder}>
                <IconSparkle /> Start Magic Cut
              </button>
            </div>
          </>
        )}

        {running && (
          <>
            <div className="cull-running" style={{ padding: 18, flexDirection: "column", alignItems: "flex-start", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%" }}>
                <div className="cull-running-spinner" />
                <strong style={{ flex: 1 }}>{progress.label || "Starter…"}</strong>
                <span className="card-chip-meta">{progress.percent}%</span>
              </div>
              <div style={{ width: "100%", background: "var(--bg-3)", borderRadius: 4, overflow: "hidden", height: 8 }}>
                <div
                  style={{
                    width: `${progress.percent}%`,
                    height: "100%",
                    background: "linear-gradient(90deg, var(--accent), var(--experimental))",
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
              {logTail.length > 0 && (
                <div className="magic-cut-logtail">
                  {logTail.map((l, i) => (
                    <div key={i} className="card-chip-meta">{l}</div>
                  ))}
                </div>
              )}
            </div>
            {error && <div className="dialog-warning" style={{ marginTop: 8 }}>{error}</div>}
            <div className="actions">
              <button onClick={handleCancel}>
                <IconX /> Avbryt
              </button>
            </div>
          </>
        )}

        {finishedSummary && !running && (
          <>
            <h3 style={{ marginTop: 12, color: "var(--success)" }}>
              <IconSparkle /> Ferdig — {finishedSummary.completed}/{finishedSummary.total} steg
            </h3>
            <div className="desc">
              Rough cut er klar. Bytt til Resolve for å se og polere timeline-en.
            </div>
            {error && <div className="dialog-warning">{error}</div>}
            <div className="actions">
              <button onClick={onClose}>Lukk</button>
              <button
                className="primary"
                onClick={() => {
                  setFinishedSummary(null);
                  setLogTail([]);
                  setProgress({ percent: 0, label: "" });
                }}
              >
                Kjør én til
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
