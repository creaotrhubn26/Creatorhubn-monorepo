/**
 * GuidedWeddingWizard — fullstendig onboarding for bryllups-prosjekt.
 *
 * 8 steg, hvert et med læring-hook (manuelle korreksjoner skrives til
 * trrpa.learnings.global slik at Claude lærer fra sessionen).
 *
 *   1. Materialet      — mappe-pick + multicam-deteksjon + 3 timeline-valg
 *   2. Ekstern lyd     — TODO (placeholder)
 *   3. Sanger + kultur — TODO
 *   4. Personer        — TODO (face-clustering)
 *   5. Stil            — TODO (storytelling/cinematic/energetic + FlowMap)
 *   6. Live-arbeid     — TODO (Harry-Potter preview-stream)
 *   7. Color/LUT       — TODO
 *   8. Klar i Resolve  — TODO
 */

import { useEffect, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { executeScript, onScriptEvent } from "../api";
import type { ScriptEvent } from "../types";

interface Props {
  onClose: () => void;
  onComplete: (sourceVideo: string) => void;
}

interface MulticamGroup {
  startSec: number;
  durationSec: number;
  angles: string[];
  confidence: number;
}

interface ScanResult {
  folder: string;
  clipCount: number;
  multicamGroups: MulticamGroup[];
  multicamGroupCount: number;
}

type Step = "material" | "audio" | "music" | "persons" | "style" | "live" | "color" | "done";

const STEPS: Array<{ id: Step; label: string; n: number }> = [
  { id: "material", label: "Materialet",      n: 1 },
  { id: "audio",    label: "Ekstern lyd",     n: 2 },
  { id: "music",    label: "Sanger + kultur", n: 3 },
  { id: "persons",  label: "Personer",        n: 4 },
  { id: "style",    label: "Stil",            n: 5 },
  { id: "live",     label: "Live-arbeid",     n: 6 },
  { id: "color",    label: "Color / LUT",     n: 7 },
];

export function GuidedWeddingWizard({ onClose, onComplete }: Props) {
  const [step, setStep] = useState<Step>("material");

  // Steg 1: Material state
  const [folder, setFolder] = useState<string>("");
  const [scanning, setScanning] = useState(false);
  const [scanPct, setScanPct] = useState(0);
  const [scanMsg, setScanMsg] = useState("");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  // User choices
  const [enableMulticam, setEnableMulticam] = useState(true);
  const [makeLongFilm, setMakeLongFilm] = useState(true);
  const [makeHighlight, setMakeHighlight] = useState(true);
  const [makeTeaser, setMakeTeaser] = useState(true);

  // Steg 2: Ekstern lyd state
  const [hasExternal, setHasExternal] = useState<boolean | null>(null);
  const [externalFolder, setExternalFolder] = useState<string>("");
  const [matchPct, setMatchPct] = useState(0);
  const [matchMsg, setMatchMsg] = useState("");
  const [matching, setMatching] = useState(false);
  const [matchResult, setMatchResult] = useState<{
    matches: Array<{ externalAudio: string; clipPath: string; offsetSec: number; confidence: number }>;
    matchCount: number;
  } | null>(null);
  const [matchError, setMatchError] = useState<string | null>(null);
  // Bruker-overrides: matchIndex → "correct" | "wrong" (læring)
  const [matchOverrides, setMatchOverrides] = useState<Record<number, "correct" | "wrong">>({});

  // Læring: record decisions
  const recordLearning = (note: string) => {
    try {
      const entry = { ts: Date.now(), kind: "wizard_choice", note };
      const raw = localStorage.getItem("trrpa.learnings.global");
      const list = raw ? JSON.parse(raw) : [];
      list.unshift(entry);
      localStorage.setItem("trrpa.learnings.global", JSON.stringify(list.slice(0, 200)));
    } catch { /* non-critical */ }
  };

  // ESC closes
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !scanning) onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [scanning, onClose]);

  const pickFolder = async () => {
    const sel = await openDialog({
      multiple: false,
      directory: true,
      title: "Pek mappa der bryllups-materialet ligger",
    });
    if (typeof sel === "string") setFolder(sel);
  };

  const startScan = async () => {
    if (!folder) return;
    setScanning(true);
    setScanError(null);
    setScanResult(null);
    setScanPct(0);

    const unsubProm = onScriptEvent((ev: ScriptEvent) => {
      if (ev.type === "progress") {
        const pct = ev.total ? Math.round(((ev.current ?? 0) / ev.total) * 100) : 0;
        setScanPct(pct); setScanMsg(ev.message || "");
      }
    });

    try {
      const sum = await executeScript("scan_folder_multicam", {
        folder,
        audioVerify: true,
      }, false);
      const r = sum.events.find((e) => e.type === "result");
      const val = r?.value as ScanResult | undefined;
      if (val) setScanResult(val);
      else setScanError("Skanningen returnerte ingen data");
    } catch (err) {
      setScanError(String(err));
    } finally {
      unsubProm.then((u) => u());
      setScanning(false);
    }
  };

  const goNext = () => {
    // Record user choices for læring
    if (scanResult) {
      const choices = [
        `multicam=${enableMulticam}`,
        `longFilm=${makeLongFilm}`,
        `highlight=${makeHighlight}`,
        `teaser=${makeTeaser}`,
        `clipCount=${scanResult.clipCount}`,
        `multicamGroups=${scanResult.multicamGroupCount}`,
      ];
      recordLearning(`Steg 1 valg: ${choices.join(", ")}`);
    }
    // Move to next step
    const cur = STEPS.findIndex((s) => s.id === step);
    if (cur < STEPS.length - 1) setStep(STEPS[cur + 1].id);
    else onComplete(folder);
  };

  const currentStepN = STEPS.find((s) => s.id === step)?.n ?? 1;

  return (
    <div className="modal-backdrop" onClick={!scanning ? onClose : undefined}>
      <div className="modal" onClick={(e) => e.stopPropagation()}
           style={{ maxWidth: 860, width: "min(96vw, 860px)", maxHeight: "92vh",
                     overflowY: "auto" }}>
        <h2>Nytt bryllup — {STEPS[currentStepN - 1].label}</h2>

        {/* Step-progress strip */}
        <div style={{ display: "flex", gap: 4, margin: "12px 0 20px", flexWrap: "wrap" }}>
          {STEPS.map((s) => (
            <div key={s.id}
                 style={{ flex: 1, minWidth: 80, padding: "6px 10px", borderRadius: 6,
                           background: s.n < currentStepN ? "var(--accent-dim)"
                                     : s.n === currentStepN ? "var(--accent)"
                                     : "var(--bg-3)",
                           color: s.n === currentStepN ? "white" : "inherit",
                           fontSize: 11, textAlign: "center",
                           opacity: s.n > currentStepN ? 0.5 : 1 }}>
              {s.n}. {s.label}
            </div>
          ))}
        </div>

        {/* ────── Step 1: Materialet ────── */}
        {step === "material" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="field">
              <label>Mappe med bryllups-materialet</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input readOnly value={folder || "Ingen valgt"} style={{ flex: 1 }} />
                <button onClick={pickFolder} disabled={scanning}>Pek på mappe…</button>
              </div>
              <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>
                Jeg skanner alle .mp4/.mov/.mkv-filer (også undermapper). For
                multicam-deteksjon bruker jeg tids-metadata + audio-correlation.
              </div>
            </div>

            {!scanResult && !scanning && folder && (
              <button className="primary" onClick={startScan}>
                🔍 Skanne mappa
              </button>
            )}

            {scanning && (
              <div>
                <div style={{ height: 6, background: "var(--bg-3)", borderRadius: 3,
                               overflow: "hidden", marginBottom: 6 }}>
                  <div style={{ width: `${scanPct}%`, height: "100%",
                                 background: "var(--accent)", transition: "width 0.3s" }} />
                </div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>{scanMsg} — {scanPct}%</div>
              </div>
            )}

            {scanError && (
              <div style={{ background: "var(--bg-3)", borderLeft: "3px solid var(--danger)",
                             padding: 10, borderRadius: 4 }}>
                <strong>Feil:</strong> {scanError}
              </div>
            )}

            {scanResult && (
              <>
                <div style={{ background: "var(--bg-3)", padding: 14, borderRadius: 8 }}>
                  <strong>Skanning ferdig:</strong>
                  <ul style={{ margin: "8px 0 0 18px", padding: 0, fontSize: 13,
                                lineHeight: 1.7 }}>
                    <li>{scanResult.clipCount} videoklipp funnet</li>
                    <li>
                      {scanResult.multicamGroupCount > 0
                        ? `${scanResult.multicamGroupCount} multicam-grupper (${scanResult.multicamGroups.reduce((a, g) => a + g.angles.length, 0)} totale vinkler)`
                        : "Ingen multicam-grupper oppdaget"}
                    </li>
                  </ul>
                </div>

                {scanResult.multicamGroupCount > 0 && (
                  <div style={{ background: "var(--bg-3)", padding: 14, borderRadius: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                      Multicam-grupper:
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6,
                                   maxHeight: 180, overflowY: "auto" }}>
                      {scanResult.multicamGroups.slice(0, 10).map((g, i) => (
                        <div key={i} style={{ fontSize: 11, opacity: 0.85,
                                                fontFamily: "ui-monospace, monospace" }}>
                          <span style={{ color: g.confidence > 0.8 ? "#4ad48a"
                                                    : g.confidence > 0.6 ? "#f0a500"
                                                    : "#ef4f6f" }}>
                            ● {(g.confidence * 100).toFixed(0)}%
                          </span>{" "}
                          {g.angles.length} vinkler · {g.durationSec.toFixed(0)}s ·{" "}
                          {g.angles.map((p) => p.split("/").pop()).join(", ")}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ background: "var(--bg-3)", padding: 14, borderRadius: 8,
                               display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Hva skal lages?</div>

                  {scanResult.multicamGroupCount > 0 && (
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                      <input type="checkbox" checked={enableMulticam}
                             onChange={(e) => setEnableMulticam(e.target.checked)} />
                      <span>
                        <strong>Multicam-redigering</strong> — sync vinkler + auto-cut basert på audio + face-focus
                      </span>
                    </label>
                  )}

                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                    <input type="checkbox" checked={makeLongFilm}
                           onChange={(e) => setMakeLongFilm(e.target.checked)} />
                    <span>
                      <strong>Lang film (~60 min)</strong> — alt material syncet, sendt til Resolve
                    </span>
                  </label>

                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                    <input type="checkbox" checked={makeHighlight}
                           onChange={(e) => setMakeHighlight(e.target.checked)} />
                    <span>
                      <strong>Highlight (~15 min)</strong> — AI plukker beste øyeblikk
                    </span>
                  </label>

                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                    <input type="checkbox" checked={makeTeaser}
                           onChange={(e) => setMakeTeaser(e.target.checked)} />
                    <span>
                      <strong>Teaser social (~30s, 9:16)</strong> — for Reels/TikTok
                    </span>
                  </label>
                </div>

                <div style={{ fontSize: 11, opacity: 0.6, fontStyle: "italic",
                               background: "var(--bg-3)", padding: 10, borderRadius: 6 }}>
                  💡 Hvis jeg gjør feil — korriger det. Jeg lærer av valgene dine.
                </div>
              </>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
              <button onClick={onClose} disabled={scanning}>Avbryt</button>
              <button className="primary" onClick={goNext}
                      disabled={scanning || !scanResult}>
                Neste: Ekstern lyd →
              </button>
            </div>
          </div>
        )}

        {/* ────── Step 2: Ekstern lyd ────── */}
        {step === "audio" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 14, lineHeight: 1.5 }}>
              Har du tatt opp lyd fra en ekstern opptaker (lavalier, zoom-recorder) for taler?
              Hvis ja, finner jeg klippene og syncer lyden mot kamera-audio.
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => setHasExternal(false)}
                className={hasExternal === false ? "primary" : ""}
                style={{ flex: 1, padding: "12px 18px" }}
              >
                Nei, bare kamera-audio
              </button>
              <button
                onClick={() => setHasExternal(true)}
                className={hasExternal === true ? "primary" : ""}
                style={{ flex: 1, padding: "12px 18px" }}
              >
                Ja, jeg har eksterne opptak
              </button>
            </div>

            {hasExternal === true && (
              <>
                <div className="field">
                  <label>Mappe med ekstern lyd (.wav, .mp3, .m4a, etc.)</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input readOnly value={externalFolder || "Ingen valgt"} style={{ flex: 1 }} />
                    <button onClick={async () => {
                      const sel = await openDialog({
                        multiple: false, directory: true,
                        title: "Pek mappa med eksterne lyd-opptak",
                      });
                      if (typeof sel === "string") setExternalFolder(sel);
                    }} disabled={matching}>Pek på mappe…</button>
                  </div>
                </div>

                {externalFolder && !matchResult && !matching && (
                  <button className="primary" onClick={async () => {
                    if (!scanResult) return;
                    setMatching(true);
                    setMatchError(null);
                    setMatchPct(0);
                    const unsubProm = onScriptEvent((ev: ScriptEvent) => {
                      if (ev.type === "progress") {
                        const pct = ev.total ? Math.round(((ev.current ?? 0) / ev.total) * 100) : 0;
                        setMatchPct(pct); setMatchMsg(ev.message || "");
                      }
                    });
                    try {
                      const sum = await executeScript("match_external_audio_to_clips", {
                        externalAudioFolder: externalFolder,
                        clips: scanResult ? (scanResult as unknown as { clips?: Array<{ path: string }> }).clips || [] : [],
                      }, false);
                      const r = sum.events.find((e) => e.type === "result");
                      const val = r?.value as typeof matchResult;
                      if (val) setMatchResult(val);
                    } catch (err) {
                      setMatchError(String(err));
                    } finally {
                      unsubProm.then((u) => u());
                      setMatching(false);
                    }
                  }}>
                    🔊 Match audio mot klipp
                  </button>
                )}

                {matching && (
                  <div>
                    <div style={{ height: 6, background: "var(--bg-3)", borderRadius: 3,
                                   overflow: "hidden", marginBottom: 6 }}>
                      <div style={{ width: `${matchPct}%`, height: "100%",
                                     background: "var(--accent)", transition: "width 0.3s" }} />
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.7 }}>{matchMsg} — {matchPct}%</div>
                  </div>
                )}

                {matchError && (
                  <div style={{ background: "var(--bg-3)", borderLeft: "3px solid var(--danger)",
                                 padding: 10, borderRadius: 4 }}>
                    <strong>Feil:</strong> {matchError}
                  </div>
                )}

                {matchResult && matchResult.matches.length > 0 && (
                  <div style={{ background: "var(--bg-3)", padding: 14, borderRadius: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
                      Fant {matchResult.matchCount} sync-kandidater — kryss av om noe er feil:
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6,
                                   maxHeight: 280, overflowY: "auto" }}>
                      {matchResult.matches.slice(0, 30).map((m, i) => {
                        const ext = m.externalAudio.split("/").pop() || "";
                        const clip = m.clipPath.split("/").pop() || "";
                        const override = matchOverrides[i];
                        return (
                          <div key={i} style={{ display: "flex", alignItems: "center",
                                                  gap: 10, padding: "6px 8px", borderRadius: 4,
                                                  background: override === "wrong" ? "rgba(239, 79, 111, 0.10)" : "transparent",
                                                  opacity: override === "wrong" ? 0.6 : 1 }}>
                            <span style={{ color: m.confidence > 0.7 ? "#4ad48a"
                                                     : m.confidence > 0.5 ? "#f0a500"
                                                     : "#ef4f6f", fontSize: 12, minWidth: 44 }}>
                              {(m.confidence * 100).toFixed(0)}%
                            </span>
                            <span style={{ fontSize: 12, fontFamily: "ui-monospace, monospace",
                                            flex: 1, overflow: "hidden", textOverflow: "ellipsis",
                                            whiteSpace: "nowrap" }}>
                              {ext} → {clip} <span style={{ opacity: 0.5 }}>(offset {m.offsetSec.toFixed(2)}s)</span>
                            </span>
                            <button onClick={() => {
                              setMatchOverrides(prev => ({ ...prev, [i]: "wrong" }));
                              recordLearning(`Steg 2: Avvist match (conf ${(m.confidence * 100).toFixed(0)}%): ${ext} ↔ ${clip}`);
                            }} title="Feil match — Claude lærer"
                                     style={{ padding: "2px 8px", fontSize: 11 }}>
                              ✕
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {matchResult && matchResult.matches.length === 0 && (
                  <div style={{ background: "var(--bg-3)", padding: 14, borderRadius: 8,
                                 fontSize: 12, opacity: 0.8 }}>
                    Fant ingen klare matches. Sjekk at lyd-filene er fra samme tidsperiode
                    som videoene, og at lyden er hørbar (ikke bare bakgrunnsstøy).
                  </div>
                )}

                <div style={{ fontSize: 11, opacity: 0.6, fontStyle: "italic",
                               background: "var(--bg-3)", padding: 10, borderRadius: 6 }}>
                  💡 Hvis jeg matcher feil — klikk ✕. Jeg lærer å unngå lignende feil neste gang.
                </div>
              </>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
              <button onClick={() => setStep("material")} disabled={matching}>← Tilbake</button>
              <button className="primary" onClick={() => {
                recordLearning(`Steg 2: hasExternal=${hasExternal} matches=${matchResult?.matchCount || 0} wrong=${Object.values(matchOverrides).filter(v => v === "wrong").length}`);
                setStep("music");
              }} disabled={hasExternal === null || matching}>
                Neste: Sanger →
              </button>
            </div>
          </div>
        )}

        {/* ────── Step 3-7: TODO placeholders ────── */}
        {step !== "material" && step !== "audio" && (
          <div style={{ padding: 32, textAlign: "center", opacity: 0.7 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🚧</div>
            <div style={{ fontSize: 15, marginBottom: 6 }}>
              <strong>Steg {currentStepN}: {STEPS[currentStepN - 1].label}</strong>
            </div>
            <div style={{ fontSize: 12, opacity: 0.7, maxWidth: 420, margin: "0 auto 20px" }}>
              Dette steget bygges i neste iterasjon. For nå hopper vi videre.
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button onClick={() => {
                const cur = STEPS.findIndex((s) => s.id === step);
                if (cur > 0) setStep(STEPS[cur - 1].id);
              }}>← Tilbake</button>
              <button className="primary" onClick={goNext}>
                {step === "color" ? "Ferdig — start prosjekt" : "Neste →"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
