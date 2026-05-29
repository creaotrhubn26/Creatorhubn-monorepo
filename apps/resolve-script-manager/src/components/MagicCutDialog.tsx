import { useCallback, useEffect, useMemo, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { cancelScript, convertFileSrc, executeScript, onScriptEvent, readProjectTemplate } from "../api";
import { loadSettings } from "./SettingsModal";
import { openUrl } from "@tauri-apps/plugin-opener";
import { IconSparkle, IconX, IconCheck, IconMagicCut } from "./Icons";
import { CullTheater, type ClipDecisionEvent } from "./CullTheater";
import { RoleRoomSignInDialog } from "./RoleRoomSignInDialog";

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
  const [musicPath, setMusicPath] = useState<string>("");
  const [duration, setDuration] = useState<number>(90);
  const [model, setModel] = useState<string>(MODEL_OPTIONS[0].id);

  const isMusicVideo = templateId === "music_video";

  const [running, setRunning] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ percent: number; label: string }>({ percent: 0, label: "" });
  const [logTail, setLogTail] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [finishedSummary, setFinishedSummary] = useState<{ completed: number; total: number } | null>(null);
  const [clipDecisions, setClipDecisions] = useState<ClipDecisionEvent[]>([]);
  const [overrides, setOverrides] = useState<Record<string, ClipDecisionEvent["decision"]>>({});
  const [showSignIn, setShowSignIn] = useState(false);
  const [needsSubscription, setNeedsSubscription] = useState(false);
  // Bumped to force re-read of settings after a sign-in flow completes.
  const [authRefreshKey, setAuthRefreshKey] = useState(0);

  const hasAiAccess = useMemo(() => {
    const s = loadSettings();
    // Either route works: Role Room bearer (proxy) OR direct Anthropic key (dev).
    return Boolean(s.RR_BEARER_TOKEN?.trim() || s.ANTHROPIC_API_KEY?.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authRefreshKey]);

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
        // Backend returns 402 "subscription_required" when user lacks Post Agent
        // add-on. Surface this as an actionable CTA instead of cryptic error.
        if (/402|subscription_required|payment_required/i.test(msg)) {
          setNeedsSubscription(true);
        }
      } else if ((event.type as string) === "clip_decision") {
        // Per-clip event from cull_folder.py — feeds CullTheater live grid.
        const c = event as unknown as ClipDecisionEvent;
        setClipDecisions((prev) => [...prev, c]);
      }
    }).then((u) => {
      unlisten = u;
    });
    return () => {
      unlisten?.();
    };
  }, [running, runId]);

  const inCullPhase = progress.label.toLowerCase().includes("cull");

  // Group clips by scene for the alternatives-swap flow. Clips without a
  // scene tag fall into the "_ungrouped" bucket — they don't participate
  // in the swap UI but still appear in the summary grid.
  const scenes = useMemo(() => {
    const map: Record<string, ClipDecisionEvent[]> = {};
    for (const c of clipDecisions) {
      const key = c.scene || "_ungrouped";
      (map[key] ??= []).push(c);
    }
    // Sort each scene's clips by score (best first) so "next alternative"
    // walks downward in quality.
    for (const k of Object.keys(map)) {
      map[k].sort(
        (a, b) => (b.qualityScore ?? 0) - (a.qualityScore ?? 0) || (b.highlightScore ?? 0) - (a.highlightScore ?? 0),
      );
    }
    return map;
  }, [clipDecisions]);

  const recordOverride = useCallback(
    (clip: ClipDecisionEvent, newDecision: ClipDecisionEvent["decision"], reason: string) => {
      try {
        const key = `trrpa.cull_overrides.${templateId}`;
        const existing = JSON.parse(localStorage.getItem(key) ?? "[]") as Array<unknown>;
        existing.push({
          ts: Date.now(),
          clipName: clip.clipName,
          clipPath: clip.clipPath,
          aiSuggestion: clip.aiSuggestion,
          aiDecision: clip.decision,
          qualityScore: clip.qualityScore,
          highlightScore: clip.highlightScore,
          scene: clip.scene,
          userOverride: newDecision,
          reason,
        });
        localStorage.setItem(key, JSON.stringify(existing.slice(-500)));
      } catch {
        /* localStorage failures are non-critical */
      }
    },
    [templateId],
  );

  const toggleOverride = useCallback(
    (clipPath: string, current: ClipDecisionEvent["decision"]) => {
      const next: ClipDecisionEvent["decision"] =
        current === "keep" ? "reject" : current === "reject" ? "maybe" : "keep";
      const clip = clipDecisions.find((d) => d.clipPath === clipPath);
      setOverrides((prev) => ({ ...prev, [clipPath]: next }));
      if (clip) recordOverride(clip, next, "manual_cycle");
    },
    [clipDecisions, recordOverride],
  );

  /**
   * "Reject this hero — show me the next-best in this scene."
   *   - Demote current hero to reject (override)
   *   - Promote next-highest-scored clip in scene to keep
   *   - Train data: store both decisions
   */
  const swapForNextAlternative = useCallback(
    (currentHero: ClipDecisionEvent) => {
      const sceneKey = currentHero.scene || "_ungrouped";
      const sceneClips = scenes[sceneKey] || [];
      // Find next candidate: highest score that isn't already overridden-keep
      const candidates = sceneClips.filter((c) => c.clipPath !== currentHero.clipPath);
      const promoted = candidates.find((c) => (overrides[c.clipPath] ?? c.decision) !== "keep");
      if (!promoted) {
        // No more alternatives — just demote
        setOverrides((prev) => ({ ...prev, [currentHero.clipPath]: "reject" }));
        recordOverride(currentHero, "reject", "no_alternative_available");
        return;
      }
      setOverrides((prev) => ({
        ...prev,
        [currentHero.clipPath]: "reject",
        [promoted.clipPath]: "keep",
      }));
      recordOverride(currentHero, "reject", "swapped_for_alternative");
      recordOverride(promoted, "keep", "promoted_as_alternative");
    },
    [scenes, overrides, recordOverride],
  );

  const handlePickFolder = useCallback(async () => {
    try {
      const picked = await openDialog({ directory: true, multiple: false });
      if (typeof picked === "string") setSourceFolder(picked);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  const handlePickMusic = useCallback(async () => {
    try {
      const picked = await openDialog({
        multiple: false,
        filters: [{ name: "Audio", extensions: ["mp3", "wav", "aac", "m4a", "flac", "ogg"] }],
      });
      if (typeof picked === "string") setMusicPath(picked);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  const handleStart = useCallback(async () => {
    if (!pipeline || !sourceFolder) return;
    if (isMusicVideo && !musicPath) {
      setError("Music video-template krever en musikkfil. Pek på en .mp3/.wav for beat-deteksjon.");
      return;
    }
    if (apiKeyNeeded && !hasAiAccess && model !== "local") {
      // Don't just show an error — open the sign-in flow directly.
      setShowSignIn(true);
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
      // Pre-flight: auto_rough_cut bygger Resolve-timeline. Sjekk at
      // Resolve faktisk er åpen før vi kjører den lange prosessen.
      try {
        const { runHealthCheck } = await import("../api");
        const health = await runHealthCheck();
        const healthResult = health.events.find((e) => e.type === "result");
        const status = (healthResult?.value as any) || {};
        if (!status.resolveRunning) {
          throw new Error("DaVinci Resolve er ikke åpen. Start Resolve, åpne prosjektet ditt og prøv igjen.");
        }
        if (!status.projectOpen) {
          throw new Error("Ingen prosjekt åpent i Resolve. Åpne prosjektet ditt og prøv igjen.");
        }
      } catch (err: any) {
        if (err?.message?.includes("Resolve")) {
          setError(err.message);
          setRunning(false);
          return;
        }
        // Helsesjekk-feil → la auto_rough_cut prøve og gi ekte feil
      }

      const summary = await executeScript(
        "auto_rough_cut",
        {
          templateId,
          sourceFolder,
          targetDurationSec: duration,
          model,
          ...(musicPath ? { musicPath } : {}),
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
  }, [pipeline, sourceFolder, duration, model, templateId, apiKeyNeeded, hasAiAccess, isMusicVideo, musicPath]);

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
    <div className="modal-backdrop anim-fade-in" onClick={!running ? onClose : undefined}>
      <div className="modal anim-slide-up" onClick={(e) => e.stopPropagation()} style={{ width: 600, maxHeight: "88vh" }}>
        <h2>
          <IconMagicCut size={20} /> Magic Cut · {templateName}
        </h2>

        {loadError && <div className="dialog-warning">{loadError}</div>}

        {!pipeline && !loadError && <div className="empty">Laster pipeline…</div>}

        {pipeline && !running && !finishedSummary && (
          <>
            {/* Prominent sign-in banner — first thing user sees when not authed.
                AI-funksjonene gir 402 fra backend uten dette, så vi forhåndsblokker. */}
            {apiKeyNeeded && !hasAiAccess && (
              <div
                className="dialog-warning"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: 14,
                  marginBottom: 12,
                  borderLeft: "4px solid var(--accent)",
                }}
              >
                <IconSparkle />
                <div style={{ flex: 1 }}>
                  <strong style={{ display: "block", marginBottom: 4 }}>
                    Logg inn for å bruke AI-funksjonene
                  </strong>
                  <span className="card-chip-meta">
                    Pipeline-en bruker Claude Vision for cull + highlight-scoring. Du må logge inn med Role Room-kontoen din.
                  </span>
                </div>
                <button
                  className="small primary"
                  type="button"
                  onClick={() => setShowSignIn(true)}
                >
                  Logg inn
                </button>
              </div>
            )}

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

            {isMusicVideo && (
              <div className="field">
                <label>Musikkfil <span style={{ color: "var(--danger)" }}>*</span></label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="text"
                    value={musicPath}
                    onChange={(e) => setMusicPath(e.target.value)}
                    placeholder="/Users/.../song.mp3"
                    style={{ flex: 1 }}
                  />
                  <button onClick={handlePickMusic}>Velg…</button>
                </div>
                <div className="settings-help">
                  Music video-mode: vi detekterer beats fra denne fila og synker kuttene til musikken.
                  Støttede formater: mp3, wav, aac, m4a, flac, ogg.
                </div>
              </div>
            )}

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
              {apiKeyNeeded && !hasAiAccess && model !== "local" && (
                <div className="dialog-warning" style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ flex: 1 }}>
                    Ikke logget inn til Role Room — AI-funksjoner krever det.
                  </span>
                  <button
                    className="small primary"
                    type="button"
                    onClick={() => setShowSignIn(true)}
                  >
                    Logg inn
                  </button>
                </div>
              )}
            </div>

            {error && <div className="dialog-warning">{error}</div>}

            {needsSubscription && (
              <div className="dialog-warning" style={{ display: "flex", alignItems: "center", gap: 12, borderLeft: "4px solid var(--accent)", marginTop: 12 }}>
                <IconSparkle />
                <div style={{ flex: 1 }}>
                  <strong style={{ display: "block", marginBottom: 4 }}>Post Agent er ikke en del av abonnementet ditt</strong>
                  <span className="card-chip-meta">
                    Legg det til som tillegg på Role Room-abonnementet — 299 NOK/mnd + AI-forbruk.
                  </span>
                </div>
                <button
                  className="small primary"
                  type="button"
                  onClick={() => openUrl("https://theroleroom.com/billing/post-agent")}
                >
                  Legg til
                </button>
              </div>
            )}

            <div className="actions">
              <button onClick={onClose}>Avbryt</button>
              <button className="primary" onClick={handleStart} disabled={!sourceFolder}>
                <IconMagicCut /> Start Magic Cut
              </button>
            </div>
          </>
        )}

        {running && (
          <>
            {/* During cull-phase: cinematic theater. Otherwise: compact progress bar + log tail. */}
            {inCullPhase || clipDecisions.length > 0 ? (
              <CullTheater
                decisions={clipDecisions}
                progressPercent={progress.percent}
                progressLabel={progress.label || "Culling…"}
                isActive={running}
              />
            ) : (
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
            )}
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
              <IconMagicCut size={20} /> Ferdig — {finishedSummary.completed}/{finishedSummary.total} steg
            </h3>
            <div className="desc">
              Rough cut er klar i Resolve. Sjekk AI-ens valg under — klikk en kort for å overstyre.
              Override-ene lagres lokalt og brukes til å forbedre fremtidige cull-jobber.
            </div>

            {clipDecisions.length > 0 && (
              <div className="cull-summary">
                <div className="cull-summary-header">
                  <strong>{clipDecisions.length} klipp gjennomgått</strong>
                  <span className="card-chip-meta">
                    {clipDecisions.filter((d) => (overrides[d.clipPath] ?? d.decision) === "keep").length} keep ·{" "}
                    {clipDecisions.filter((d) => (overrides[d.clipPath] ?? d.decision) === "reject").length} skip ·{" "}
                    {clipDecisions.filter((d) => (overrides[d.clipPath] ?? d.decision) === "maybe").length} maybe
                    {Object.keys(overrides).length > 0 && (
                      <> · {Object.keys(overrides).length} overstyrt</>
                    )}
                  </span>
                </div>

                {/* Scene-grouped view: hero per scene + alternatives strip */}
                {Object.entries(scenes).map(([sceneKey, sceneClips]) => {
                  if (sceneKey === "_ungrouped") return null;
                  const hero =
                    sceneClips.find((c) => (overrides[c.clipPath] ?? c.decision) === "keep") ?? sceneClips[0];
                  if (!hero) return null;
                  const alternatives = sceneClips.filter((c) => c.clipPath !== hero.clipPath);
                  const heroDecision = overrides[hero.clipPath] ?? hero.decision;
                  return (
                    <div key={sceneKey} className="cull-summary-scene">
                      <div className="cull-summary-scene-name">
                        {sceneKey.replace(/_/g, " ")} <span className="card-chip-meta">({sceneClips.length})</span>
                      </div>
                      <div className="cull-summary-scene-row">
                        <div className={`cull-summary-hero tone-${heroDecision === "keep" ? "ok" : heroDecision === "reject" ? "danger" : "warning"}`}>
                          {hero.thumbnailPath ? (
                            <img src={convertFileSrc(hero.thumbnailPath)} alt={hero.clipName} />
                          ) : (
                            <div className="cull-summary-placeholder">—</div>
                          )}
                          <div className="cull-summary-hero-meta">
                            <strong>{hero.clipName}</strong>
                            {hero.qualityScore != null && <span className="card-chip-meta"> · Q{hero.qualityScore}</span>}
                            {hero.notes && <div className="card-chip-meta">{hero.notes}</div>}
                          </div>
                          {alternatives.length > 0 && (
                            <button
                              className="small cull-summary-swap-btn"
                              onClick={() => swapForNextAlternative(hero)}
                              title="Prøv neste-beste klipp fra denne scenen"
                            >
                              Prøv neste alternativ →
                            </button>
                          )}
                        </div>
                        {alternatives.length > 0 && (
                          <div className="cull-summary-alternatives">
                            <div className="card-chip-meta">Alternativer:</div>
                            <div className="cull-summary-alt-row">
                              {alternatives.slice(0, 6).map((alt) => {
                                const altDecision = overrides[alt.clipPath] ?? alt.decision;
                                return (
                                  <button
                                    key={alt.clipPath}
                                    className={`cull-summary-alt-tile tone-${altDecision === "keep" ? "ok" : altDecision === "reject" ? "danger" : "warning"}`}
                                    onClick={() => {
                                      // Click to promote this alt to keep, demote current hero
                                      setOverrides((prev) => ({
                                        ...prev,
                                        [hero.clipPath]: "reject",
                                        [alt.clipPath]: "keep",
                                      }));
                                      recordOverride(hero, "reject", "user_picked_alternative");
                                      recordOverride(alt, "keep", "user_picked_alternative");
                                    }}
                                    title={`${alt.clipName} · Q${alt.qualityScore ?? "?"}`}
                                  >
                                    {alt.thumbnailPath ? (
                                      <img src={convertFileSrc(alt.thumbnailPath)} alt={alt.clipName} />
                                    ) : (
                                      <div className="cull-summary-placeholder">—</div>
                                    )}
                                    {alt.qualityScore != null && (
                                      <span className="cull-summary-alt-score">{alt.qualityScore}</span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Ungrouped clips — show as flat grid */}
                {scenes["_ungrouped"] && scenes["_ungrouped"].length > 0 && (
                  <>
                    <div className="cull-summary-scene-name">
                      <em>Uten scene</em>{" "}
                      <span className="card-chip-meta">({scenes["_ungrouped"].length})</span>
                    </div>
                    <div className="cull-summary-grid">
                      {scenes["_ungrouped"].map((c) => {
                        const finalDecision = overrides[c.clipPath] ?? c.decision;
                        const isOverride = overrides[c.clipPath] != null;
                        const tone =
                          finalDecision === "keep" ? "ok" : finalDecision === "reject" ? "danger" : finalDecision === "maybe" ? "warning" : "muted";
                        return (
                          <button
                            key={c.clipPath}
                            className={`cull-summary-tile tone-${tone} ${isOverride ? "override" : ""}`}
                            onClick={() => toggleOverride(c.clipPath, finalDecision)}
                            title={`${c.clipName} · ${finalDecision.toUpperCase()}${c.notes ? ` · ${c.notes}` : ""}`}
                          >
                            {c.thumbnailPath ? (
                              <img src={convertFileSrc(c.thumbnailPath)} alt={c.clipName} />
                            ) : (
                              <div className="cull-summary-placeholder">—</div>
                            )}
                            <div className="cull-summary-overlay">
                              {finalDecision === "keep" && <IconCheck />}
                              {finalDecision === "reject" && <IconX />}
                              {finalDecision === "maybe" && "?"}
                              {c.qualityScore != null && <span>{c.qualityScore}</span>}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            {error && <div className="dialog-warning">{error}</div>}
            <div className="actions">
              <button onClick={onClose}>Lukk</button>
              <button
                className="primary"
                onClick={() => {
                  setFinishedSummary(null);
                  setLogTail([]);
                  setProgress({ percent: 0, label: "" });
                  setClipDecisions([]);
                  setOverrides({});
                }}
              >
                Kjør én til
              </button>
            </div>
          </>
        )}
      </div>

      {showSignIn && (
        <RoleRoomSignInDialog
          onClose={() => setShowSignIn(false)}
          onSignedIn={() => {
            setShowSignIn(false);
            // Force hasAiAccess to re-evaluate against the freshly-stored token
            setAuthRefreshKey((k) => k + 1);
            setError(null);
          }}
        />
      )}
    </div>
  );
}
