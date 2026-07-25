// UnusedClipsStudio — «Ubrukt-materiale»: finn klipp i dag-bins som ikke er
// brukt i gjeldende timeline, flytt dem til UBRUKT/<kamera> (bevart
// kamera-struktur), og resynk tilbake når klipp tas i bruk senere.
//
// Backend: scripts/media/categorize_unused_clips.py (mode=categorize|resync|undo,
// dry-run for analyse). Én kjøring per dag-bin slik at per-kamera-ekskludering
// kan uttrykkes via skipSubBins.

import { useCallback, useEffect, useMemo, useState } from "react";
import { executeScript } from "../api";

const DEFAULT_SKIP = ["Timelines", "Musikk", "Audio", "LD", "Røde_Mikrofon_Opptaker", "THMBNL"];
const TARGET = "UBRUKT";

interface SubBinStat { total: number; used: number; unused: number }

interface CategorizeBin {
  bin: string;
  matchedFor: string;
  totalClips: number;
  used: number;
  unused: number;
  multicamContainers: number;
  bySubBin: Record<string, SubBinStat>;
  unusedNames: string[];
  moved?: number;
  moveFailed?: number;
  movedTo?: string;
}

interface CategorizeResult {
  mode: string;
  timeline: string;
  timelineItemsWithMedia: number;
  bins: CategorizeBin[];
  binsNotFound: string[];
  dryRun: boolean;
}

interface ResyncBin { bin: string; candidates: number; moved: number; note?: string }
interface ResyncResult { mode: string; bins: ResyncBin[] }

interface PlacementHint {
  clip: string;
  prevUsed: { name: string; tc: string } | null;
  nextUsed: { name: string; tc: string } | null;
  estTc: string | null;
}
interface PlacementBin {
  bin: string;
  hints: number;
  noAnchor: number;
  note?: string;
  cameras: Array<{ camera: string; unused: PlacementHint[] }>;
}
interface PlacementResult {
  timeline: string;
  markersAdded?: number;
  bins: PlacementBin[];
}

interface BinChoice { name: string; checked: boolean }

interface MediaPoolBinNode { name: string; depth: number; subBins: MediaPoolBinNode[] }

function resultFrom<T>(summary: { events: Array<{ type: string; value?: unknown }> }): T | undefined {
  return summary.events.find((e) => e.type === "result")?.value as T | undefined;
}

function Bar({ used, unused }: { used: number; unused: number }) {
  const total = Math.max(1, used + unused);
  return (
    <div style={{ display: "flex", height: 6, borderRadius: 3, overflow: "hidden",
                  background: "var(--bg-inset, #1a1726)", flex: 1, minWidth: 60 }}>
      <div style={{ width: `${(used / total) * 100}%`, background: "var(--accent)" }} />
      <div style={{ width: `${(unused / total) * 100}%`, background: "var(--warning, #d97706)", opacity: 0.75 }} />
    </div>
  );
}

export function UnusedClipsStudio({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<"setup" | "analyzing" | "results" | "moving" | "done">("setup");
  const [bins, setBins] = useState<BinChoice[]>([]);
  const [binsLoading, setBinsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [analysis, setAnalysis] = useState<CategorizeBin[]>([]);
  const [timelineName, setTimelineName] = useState<string>("");
  const [resyncCandidates, setResyncCandidates] = useState(0);
  // binName → kameranavn → med i flyttingen?
  const [cameraChecked, setCameraChecked] = useState<Record<string, Record<string, boolean>>>({});
  const [moveSummary, setMoveSummary] = useState<Array<{ bin: string; moved: number; failed: number }>>([]);
  const [placement, setPlacement] = useState<PlacementResult | null>(null);
  const [placementBusy, setPlacementBusy] = useState(false);
  const [placementExpanded, setPlacementExpanded] = useState<Record<string, boolean>>({});

  // Auto-populer dag-bins fra Media Pool (toppnivå under rot, forhåndskryss day/dag)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const summary = await executeScript("get_media_pool_state", { includeClips: false }, false);
        const state = resultFrom<{ rootBin: MediaPoolBinNode }>(summary);
        const top = state?.rootBin?.subBins ?? [];
        if (!cancelled) {
          setBins(top.map((b) => ({ name: b.name, checked: /day|dag/i.test(b.name) })));
        }
      } catch (e) {
        if (!cancelled) setError(`Kunne ikke lese Media Pool: ${String(e)}`);
      } finally {
        if (!cancelled) setBinsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const checkedBins = useMemo(() => bins.filter((b) => b.checked).map((b) => b.name), [bins]);

  const analyse = useCallback(async () => {
    if (checkedBins.length === 0) return;
    setPhase("analyzing");
    setError(null);
    setAnalysis([]);
    try {
      const results: CategorizeBin[] = [];
      for (const bin of checkedBins) {
        const summary = await executeScript(
          "categorize_unused_clips",
          { bins: bin, target: TARGET, skipSubBins: DEFAULT_SKIP.join(",") },
          true, // dry-run
        );
        const r = resultFrom<CategorizeResult>(summary);
        if (!r) throw new Error(`Analysen for «${bin}» ga ikke noe resultat — kjører Resolve med prosjektet åpent?`);
        if (r.binsNotFound.length > 0) throw new Error(`Fant ikke bin «${bin}» i Media Pool.`);
        setTimelineName(r.timeline);
        results.push(...r.bins);
      }
      // Resynk-kandidater (alle valgte bins i én kjøring)
      const resyncSummary = await executeScript(
        "categorize_unused_clips",
        { bins: checkedBins.join(","), target: TARGET, mode: "resync" },
        true,
      );
      const resync = resultFrom<ResyncResult>(resyncSummary);
      setResyncCandidates((resync?.bins ?? []).reduce((s, b) => s + (b.candidates || 0), 0));

      setAnalysis(results);
      setCameraChecked(Object.fromEntries(results.map((b) => [
        b.bin,
        Object.fromEntries(Object.keys(b.bySubBin).map((cam) => [cam, true])),
      ])));
      setPhase("results");
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
      setPhase("setup");
    }
  }, [checkedBins]);

  const plannedCount = useMemo(() => analysis.reduce((sum, b) => {
    const cams = cameraChecked[b.bin] ?? {};
    return sum + Object.entries(b.bySubBin)
      .filter(([cam]) => cams[cam] !== false)
      .reduce((s, [, st]) => s + st.unused, 0);
  }, 0), [analysis, cameraChecked]);

  const execute = useCallback(async () => {
    if (plannedCount === 0) return;
    if (!window.confirm(
      `Flytte ${plannedCount} ubrukte klipp til ${TARGET}/<kamera> i ${analysis.length} bin(s)?\n\n` +
      `Angres enkelt med Angre-knappen etterpå.`,
    )) return;
    setPhase("moving");
    setError(null);
    try {
      const summaries: Array<{ bin: string; moved: number; failed: number }> = [];
      for (const b of analysis) {
        const cams = cameraChecked[b.bin] ?? {};
        const excluded = Object.entries(cams).filter(([, on]) => !on).map(([cam]) => cam);
        const summary = await executeScript(
          "categorize_unused_clips",
          { bins: b.bin, target: TARGET, skipSubBins: [...DEFAULT_SKIP, ...excluded].join(",") },
          false,
        );
        const r = resultFrom<CategorizeResult>(summary);
        const entry = r?.bins?.[0];
        summaries.push({ bin: b.bin, moved: entry?.moved ?? 0, failed: entry?.moveFailed ?? 0 });
      }
      setMoveSummary(summaries);
      setPhase("done");
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
      setPhase("results");
    }
  }, [analysis, cameraChecked, plannedCount]);

  const resync = useCallback(async () => {
    setError(null);
    try {
      const summary = await executeScript(
        "categorize_unused_clips",
        { bins: checkedBins.join(","), target: TARGET, mode: "resync" },
        false,
      );
      const r = resultFrom<ResyncResult>(summary);
      const moved = (r?.bins ?? []).reduce((s, b) => s + (b.moved || 0), 0);
      setToast(`↩ ${moved} klipp flyttet tilbake til kamera-bins`);
      setTimeout(() => setToast(null), 4000);
      await analyse();
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    }
  }, [checkedBins, analyse]);

  const undo = useCallback(async () => {
    if (!window.confirm(`Flytte ALT i ${TARGET}-binnene tilbake til kamera-bins?`)) return;
    setError(null);
    try {
      let total = 0;
      for (const s of moveSummary) {
        const summary = await executeScript(
          "categorize_unused_clips",
          { bins: s.bin, target: TARGET, mode: "undo" },
          false,
        );
        const r = resultFrom<ResyncResult>(summary);
        total += (r?.bins ?? []).reduce((sum, b) => sum + (b.moved || 0), 0);
      }
      setToast(`↩ Angret — ${total} klipp flyttet tilbake`);
      setTimeout(() => setToast(null), 4000);
      setPhase("setup");
      setAnalysis([]);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    }
  }, [moveSummary]);

  // Plasseringsguide: hvor hører de ubrukte klippene hjemme i timelinen?
  const fetchPlacement = useCallback(async () => {
    setPlacementBusy(true);
    setError(null);
    try {
      const summary = await executeScript(
        "unused_clips_placement",
        { bins: checkedBins.join(","), target: TARGET },
        true,
      );
      const r = resultFrom<PlacementResult>(summary);
      if (!r) throw new Error("Plasseringsguiden ga ikke noe resultat.");
      setPlacement(r);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setPlacementBusy(false);
    }
  }, [checkedBins]);

  const setMarkers = useCallback(async () => {
    if (!window.confirm("Setter blå markører i timelinen der de ubrukte klippene hører hjemme — fortsett?")) return;
    setPlacementBusy(true);
    setError(null);
    try {
      const summary = await executeScript(
        "unused_clips_placement",
        { bins: checkedBins.join(","), target: TARGET, markers: "true" },
        false,
      );
      const r = resultFrom<PlacementResult>(summary);
      setToast(`📍 ${r?.markersAdded ?? 0} markører satt i timelinen`);
      setTimeout(() => setToast(null), 4000);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setPlacementBusy(false);
    }
  }, [checkedBins]);

  const busy = phase === "analyzing" || phase === "moving";

  return (
    <div className="modal-backdrop anim-fade-in" onClick={!busy ? onClose : undefined}>
      <div className="modal anim-slide-up" onClick={(e) => e.stopPropagation()}
           style={{ maxWidth: 720, width: "92vw", maxHeight: "86vh", overflowY: "auto" }}>
        <h2>Ubrukt-materiale</h2>
        <p style={{ opacity: 0.75, fontSize: 12, marginTop: -6 }}>
          Finner klipp i dag-binnene som ikke er brukt i gjeldende timeline, og samler dem i{" "}
          <code>{TARGET}/&lt;kamera&gt;</code>. Resynk flytter tilbake klipp du senere tar i bruk.
        </p>

        {error && <div className="dialog-warning">{error}</div>}
        {toast && <div className="chip" style={{ background: "var(--accent-dim)", margin: "6px 0" }}>{toast}</div>}

        {/* ── Oppsett ── */}
        <div className="field">
          <label>Bins som skal analyseres</label>
          {binsLoading ? (
            <div style={{ opacity: 0.6, fontSize: 12 }}>Leser Media Pool …</div>
          ) : bins.length === 0 ? (
            <div className="dialog-warning">Fant ingen bins — kjører Resolve med prosjektet åpent?</div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {bins.map((b) => (
                <label key={b.name} style={{ display: "flex", gap: 5, alignItems: "center", fontSize: 12 }}>
                  <input type="checkbox" checked={b.checked} disabled={busy}
                         onChange={() => setBins((prev) => prev.map((x) =>
                           x.name === b.name ? { ...x, checked: !x.checked } : x))} />
                  {b.name}
                </label>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 11, opacity: 0.6 }} title="Under-bins som aldri telles med (ikke råopptak)">
            Hopper over:
          </span>
          {DEFAULT_SKIP.map((s) => (
            <span key={s} className="chip" style={{ fontSize: 10, opacity: 0.7 }}>{s}</span>
          ))}
        </div>

        <button className="primary" onClick={analyse}
                disabled={busy || checkedBins.length === 0}>
          {phase === "analyzing" ? "Analyserer …" : "⟳ Analyser"}
        </button>

        {/* ── Resultater ── */}
        {(phase === "results" || phase === "moving") && (
          <>
            <div style={{ fontSize: 11, opacity: 0.6, margin: "12px 0 6px" }}>
              Timeline: <strong>{timelineName}</strong> · analyse uten endringer (dry-run)
            </div>

            {resyncCandidates > 0 && (
              <div className="dialog-warning"
                   style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between" }}>
                <span>⚠ {resyncCandidates} klipp i {TARGET} er nå i bruk i timelinen</span>
                <button className="small" onClick={resync} disabled={busy}>↩ Resynk</button>
              </div>
            )}

            {analysis.map((b) => (
              <div key={b.bin} className="card" style={{ padding: 12, marginTop: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <strong style={{ flex: 1 }}>📁 {b.bin}</strong>
                  <span style={{ fontSize: 11, opacity: 0.75 }}>
                    {b.used} brukt · <strong>{b.unused} ubrukt</strong>
                  </span>
                </div>
                <Bar used={b.used} unused={b.unused} />
                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 5 }}>
                  {Object.entries(b.bySubBin).map(([cam, st]) => (
                    <label key={cam}
                           style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                      <input type="checkbox"
                             checked={cameraChecked[b.bin]?.[cam] !== false}
                             disabled={busy}
                             onChange={() => setCameraChecked((prev) => ({
                               ...prev,
                               [b.bin]: { ...prev[b.bin], [cam]: !(prev[b.bin]?.[cam] !== false) },
                             }))} />
                      <span style={{ flex: "0 0 200px", overflow: "hidden", textOverflow: "ellipsis" }}>{cam}</span>
                      <Bar used={st.used} unused={st.unused} />
                      <span style={{ fontSize: 11, opacity: 0.7, flex: "0 0 100px", textAlign: "right" }}>
                        {st.unused}/{st.total} ubrukt
                      </span>
                    </label>
                  ))}
                </div>
                {b.multicamContainers > 0 && (
                  <div style={{ fontSize: 10, opacity: 0.55, marginTop: 6 }}>
                    ⓘ {b.multicamContainers} multicam/compound-klipp — kildeklippene deres kan se ubrukte ut.
                  </div>
                )}
              </div>
            ))}

            <button className="primary" style={{ marginTop: 12, width: "100%" }}
                    onClick={execute} disabled={busy || plannedCount === 0}>
              {phase === "moving" ? "Flytter …" : `Flytt ${plannedCount} klipp → ${TARGET}/<kamera>`}
            </button>
          </>
        )}

        {/* ── Ferdig ── */}
        {phase === "done" && (
          <div className="card" style={{ padding: 14, marginTop: 12 }}>
            <strong>✓ Ferdig</strong>
            {moveSummary.map((s) => (
              <div key={s.bin} style={{ fontSize: 12, marginTop: 5 }}>
                📁 {s.bin}: {s.moved} flyttet til {TARGET}/&lt;kamera&gt;
                {s.failed > 0 && <span style={{ color: "var(--warning, #d97706)" }}> · {s.failed} feilet</span>}
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button className="small ghost" onClick={undo}>↩ Angre alt</button>
              <button className="small" onClick={analyse}>⟳ Analyser på nytt</button>
            </div>
          </div>
        )}

        {/* ── Plasseringsguide (etter kategorisering / når UBRUKT finnes) ── */}
        {(phase === "done" || phase === "results" || resyncCandidates > 0) && (
          <div className="card" style={{ padding: 12, marginTop: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <strong style={{ flex: 1 }}>📍 Plasseringsguide</strong>
              <button className="small" onClick={fetchPlacement} disabled={placementBusy || busy}>
                {placementBusy ? "Beregner …" : placement ? "⟳ Oppdater" : "Vis hvor de hører hjemme"}
              </button>
              {placement && (
                <button className="small ghost" onClick={setMarkers} disabled={placementBusy || busy}>
                  📍 Sett markører i timelinen
                </button>
              )}
            </div>
            {!placement && (
              <div style={{ fontSize: 11, opacity: 0.6, marginTop: 6 }}>
                Finner hvor i timelinen hvert ubrukt klipp hører hjemme — basert på nærmeste
                brukte nabo fra samme kamera. Krever at kategoriseringen er kjørt.
              </div>
            )}
            {placement && placement.bins.map((pb) => (
              <div key={pb.bin} style={{ marginTop: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>
                  📁 {pb.bin}
                  <span style={{ fontWeight: 400, opacity: 0.65 }}>
                    {" "}— {pb.hints} hint{pb.noAnchor > 0 ? ` · ${pb.noAnchor} uten anker` : ""}
                  </span>
                </div>
                {pb.note && <div style={{ fontSize: 11, opacity: 0.6 }}>{pb.note}</div>}
                {pb.cameras.map((cam) => {
                  const key = `${pb.bin}/${cam.camera}`;
                  const expanded = placementExpanded[key] === true;
                  const rows = expanded ? cam.unused : cam.unused.slice(0, 8);
                  return (
                    <div key={key} style={{ marginTop: 6, marginLeft: 8 }}>
                      <div style={{ fontSize: 11, opacity: 0.8 }}>🎥 {cam.camera} ({cam.unused.length} ubrukte)</div>
                      {rows.map((h) => (
                        <div key={h.clip} style={{ fontSize: 11, marginLeft: 12, marginTop: 3,
                                                   borderLeft: "2px solid var(--accent-dim, #4a3a6a)",
                                                   paddingLeft: 8 }}>
                          <div>
                            <span style={{ opacity: 0.9 }}>{h.clip}</span>
                            {h.estTc && <strong style={{ color: "var(--accent)" }}> ≈ {h.estTc}</strong>}
                          </div>
                          <div style={{ opacity: 0.55, fontSize: 10 }}>
                            mellom {h.prevUsed ? `${h.prevUsed.name} @ ${h.prevUsed.tc}` : "—"} og{" "}
                            {h.nextUsed ? `${h.nextUsed.name} @ ${h.nextUsed.tc}` : "—"}
                          </div>
                        </div>
                      ))}
                      {cam.unused.length > 8 && (
                        <button className="small ghost" style={{ marginLeft: 12, marginTop: 4, fontSize: 10 }}
                                onClick={() => setPlacementExpanded((p) => ({ ...p, [key]: !expanded }))}>
                          {expanded ? "Vis færre" : `Vis alle ${cam.unused.length}`}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
            {placement && (
              <div style={{ fontSize: 10, opacity: 0.5, marginTop: 8 }}>
                Basert på opptaks-rekkefølge per kamera (filnavn-sekvens).
              </div>
            )}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
          <button onClick={onClose} disabled={busy}>Lukk</button>
        </div>
      </div>
    </div>
  );
}
