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
import { invoke } from "@tauri-apps/api/core";
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

  // Steg 3: Sanger + kultur
  type SongRole = "main" | "entry" | "first_dance" | "dance" | "exit";
  type WishedSong = { id: string; title: string; artist: string; role: SongRole };
  const [culture, setCulture] = useState<string>("");
  const [cultureOther, setCultureOther] = useState<string>("");
  const [wishedSongs, setWishedSongs] = useState<WishedSong[]>([]);
  const [newSongTitle, setNewSongTitle] = useState("");
  const [newSongArtist, setNewSongArtist] = useState("");
  const [musicSuggestBusy, setMusicSuggestBusy] = useState(false);
  const [musicSuggestError, setMusicSuggestError] = useState<string | null>(null);

  // Steg 4: Personer — face-clustering
  type FaceCluster = { id: string; thumbnail: string; occurrences: number; clips: Array<{ clip: string; timeSec: number }> };
  const [facesScanning, setFacesScanning] = useState(false);
  const [facesPct, setFacesPct] = useState(0);
  const [facesMsg, setFacesMsg] = useState("");
  const [faceClusters, setFaceClusters] = useState<FaceCluster[]>([]);
  const [facesError, setFacesError] = useState<string | null>(null);
  const [faceLabels, setFaceLabels] = useState<Record<string, string>>({});  // clusterId → label

  const PERSON_SUGGESTIONS = [
    "Brud", "Brudgom", "Brudens mor", "Brudens far", "Brudgom mor", "Brudgom far",
    "Brudens søster", "Brudgom søster", "Brudens bror", "Brudgom bror",
    "Forlover", "Brudepike", "Prest", "Annet",
  ];

  // Steg 5: Stil
  type Style = "storytelling" | "cinematic" | "energetic" | "balanced";
  const [chosenStyle, setChosenStyle] = useState<Style>("balanced");

  // Steg 6: Live-arbeid
  const [liveRunning, setLiveRunning] = useState(false);
  const [livePct, setLivePct] = useState(0);
  const [liveMsg, setLiveMsg] = useState("");
  const [livePicks, setLivePicks] = useState<Array<{ index: number; chapter: string; thumbPath?: string }>>([]);
  const [livePicksPath, setLivePicksPath] = useState<string | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);

  // Steg 7: Color / LUT
  const [logGamma, setLogGamma] = useState<{ isLog: boolean; profile: string; suggestedLut?: string } | null>(null);
  const [applyLut, setApplyLut] = useState(false);
  const [logCheckBusy, setLogCheckBusy] = useState(false);

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

        {/* ────── Step 3: Sanger + kultur ────── */}
        {step === "music" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 14, lineHeight: 1.5 }}>
              Hvilken kultur er bryllupet? Jeg foreslår sanger basert på det.
            </div>

            <div className="field">
              <label>Kultur</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                {["Pakistansk", "Indisk", "Norsk", "Tyrkisk", "Arabisk", "Afghansk"].map((c) => (
                  <button key={c}
                          className={culture === c ? "primary" : ""}
                          onClick={() => setCulture(c)}
                          style={{ padding: "8px 10px", fontSize: 12 }}>
                    {c}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "center" }}>
                <button onClick={() => setCulture("annet")}
                        className={culture === "annet" ? "primary" : ""}
                        style={{ padding: "8px 10px", fontSize: 12 }}>
                  Annet
                </button>
                {culture === "annet" && (
                  <input type="text" placeholder="F.eks. afghansk, somalisk, etc."
                         value={cultureOther}
                         onChange={(e) => setCultureOther(e.target.value)}
                         style={{ flex: 1 }} />
                )}
              </div>
            </div>

            <div style={{ background: "var(--bg-3)", padding: 14, borderRadius: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                Brudeparets ønsker (specifikke sanger)
              </div>
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                <input type="text" placeholder="Sang-tittel"
                       value={newSongTitle}
                       onChange={(e) => setNewSongTitle(e.target.value)}
                       style={{ flex: 2 }} />
                <input type="text" placeholder="Artist"
                       value={newSongArtist}
                       onChange={(e) => setNewSongArtist(e.target.value)}
                       style={{ flex: 2 }} />
                <button onClick={() => {
                  if (!newSongTitle.trim()) return;
                  setWishedSongs((prev) => [...prev, {
                    id: `s-${Date.now()}`,
                    title: newSongTitle.trim(),
                    artist: newSongArtist.trim(),
                    role: "main",
                  }]);
                  setNewSongTitle(""); setNewSongArtist("");
                }}>+ Legg til</button>
              </div>

              {wishedSongs.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                  {wishedSongs.map((s) => (
                    <div key={s.id} style={{ display: "flex", alignItems: "center",
                                              gap: 8, padding: 8, borderRadius: 4,
                                              background: "rgba(160, 48, 192, 0.08)" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden",
                                       textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {s.title}
                        </div>
                        {s.artist && (
                          <div style={{ fontSize: 11, opacity: 0.7 }}>{s.artist}</div>
                        )}
                      </div>
                      <select value={s.role}
                              onChange={(e) => setWishedSongs((prev) => prev.map(x =>
                                x.id === s.id ? { ...x, role: e.target.value as SongRole } : x))}
                              style={{ fontSize: 11, padding: "4px 6px" }}>
                        <option value="main">Hoved-musikk</option>
                        <option value="entry">Inntog</option>
                        <option value="first_dance">Første dans</option>
                        <option value="dance">Dans-sekvens</option>
                        <option value="exit">Avslutning</option>
                      </select>
                      <button onClick={() => setWishedSongs((prev) => prev.filter(x => x.id !== s.id))}
                              title="Fjern" style={{ padding: "4px 8px", fontSize: 12 }}>
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              disabled={musicSuggestBusy || !culture}
              onClick={async () => {
                if (!culture) return;
                setMusicSuggestBusy(true);
                setMusicSuggestError(null);
                try {
                  const cultureLabel = culture === "annet" ? cultureOther.trim() : culture;
                  const resp = await invoke<{
                    content?: Array<{ type: string; input?: { suggestions?: Array<{ title: string; artist: string; role: SongRole; reason?: string }> } }>;
                  }>("claude_chat", {
                    messages: [{ role: "user", content: `Foreslå 5 sanger til en ${cultureLabel} bryllups-highlight. Variér roller.` }],
                    system: `Du er en musikk-kurator for bryllupsvideo. Du kjenner kulturelle sanger som er ikoniske og hyppig brukt i ${cultureLabel} bryllup. Foreslå 5 sanger med:
- title (originaltittel)
- artist
- role (main / entry / first_dance / dance / exit)
- reason (1 setning på norsk hvorfor)

KUN reelle, kjente sanger. Du MÅ kalle suggest_songs-tool.`,
                    model: "claude-opus-4-7",
                    maxTokens: 800,
                    tools: [{
                      name: "suggest_songs",
                      description: "Return 5 song suggestions",
                      input_schema: {
                        type: "object",
                        properties: {
                          suggestions: {
                            type: "array", minItems: 5, maxItems: 5,
                            items: {
                              type: "object",
                              properties: {
                                title: { type: "string" },
                                artist: { type: "string" },
                                role: { type: "string", enum: ["main", "entry", "first_dance", "dance", "exit"] },
                                reason: { type: "string" },
                              },
                              required: ["title", "artist", "role"],
                            },
                          },
                        },
                        required: ["suggestions"],
                      },
                    }],
                  });
                  const toolUse = resp?.content?.find((c) => c.type === "tool_use");
                  const sugg = toolUse?.input?.suggestions;
                  if (Array.isArray(sugg)) {
                    setWishedSongs((prev) => [
                      ...prev,
                      ...sugg.map((s, i) => ({
                        id: `ai-${Date.now()}-${i}`,
                        title: s.title, artist: s.artist, role: s.role || "main",
                      })),
                    ]);
                    recordLearning(`Steg 3: AI foreslo ${sugg.length} ${cultureLabel}-sanger`);
                  }
                } catch (err) {
                  setMusicSuggestError(String(err));
                } finally {
                  setMusicSuggestBusy(false);
                }
              }}
              style={{ padding: "10px 14px" }}
            >
              {musicSuggestBusy ? "✨ Henter forslag…"
                : !culture ? "Velg kultur først"
                : `✨ Få anbefalinger for ${culture === "annet" ? cultureOther || "kultur" : culture}`}
            </button>

            {musicSuggestError && (
              <div style={{ background: "var(--bg-3)", borderLeft: "3px solid var(--danger)",
                             padding: 10, borderRadius: 4 }}>
                <strong>Feil:</strong> {musicSuggestError}
              </div>
            )}

            <div style={{ fontSize: 11, opacity: 0.6, fontStyle: "italic",
                           background: "var(--bg-3)", padding: 10, borderRadius: 6 }}>
              💡 AI-forslag kan være feil. Fjern de som ikke passer — jeg lærer hva du foretrekker.
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
              <button onClick={() => setStep("audio")}>← Tilbake</button>
              <button className="primary" onClick={() => {
                recordLearning(`Steg 3: culture=${culture === "annet" ? cultureOther : culture} songs=${wishedSongs.length}`);
                setStep("persons");
              }}>
                Neste: Personer →
              </button>
            </div>
          </div>
        )}

        {/* ────── Step 4: Personer ────── */}
        {step === "persons" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 14, lineHeight: 1.5 }}>
              Hvilke personer er viktige å ha fokus på? Jeg skanner gjennom klippene
              og finner unike ansikter — du labeler hvem som er hvem.
            </div>

            {faceClusters.length === 0 && !facesScanning && (
              <button
                className="primary"
                disabled={!scanResult}
                onClick={async () => {
                  if (!scanResult) return;
                  setFacesScanning(true);
                  setFacesError(null);
                  setFacesPct(0);
                  const unsubProm = onScriptEvent((ev: ScriptEvent) => {
                    if (ev.type === "progress") {
                      const pct = ev.total ? Math.round(((ev.current ?? 0) / ev.total) * 100) : 0;
                      setFacesPct(pct); setFacesMsg(ev.message || "");
                    }
                  });
                  try {
                    const sum = await executeScript("cluster_faces_from_clips", {
                      clips: scanResult ? (scanResult as unknown as { clips?: Array<{ path: string }> }).clips || [] : [],
                      sampleIntervalSec: 10,
                      maxFramesPerClip: 8,
                    }, false);
                    const r = sum.events.find((e) => e.type === "result");
                    const val = r?.value as { clusters?: FaceCluster[] } | undefined;
                    if (val?.clusters) setFaceClusters(val.clusters);
                  } catch (err) {
                    setFacesError(String(err));
                  } finally {
                    unsubProm.then((u) => u());
                    setFacesScanning(false);
                  }
                }}
              >
                👥 Skanne ansikter
              </button>
            )}

            {facesScanning && (
              <div>
                <div style={{ height: 6, background: "var(--bg-3)", borderRadius: 3,
                               overflow: "hidden", marginBottom: 6 }}>
                  <div style={{ width: `${facesPct}%`, height: "100%",
                                 background: "var(--accent)", transition: "width 0.3s" }} />
                </div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>{facesMsg} — {facesPct}%</div>
              </div>
            )}

            {facesError && (
              <div style={{ background: "var(--bg-3)", borderLeft: "3px solid var(--danger)",
                             padding: 10, borderRadius: 4 }}>
                <strong>Feil:</strong> {facesError}
              </div>
            )}

            {faceClusters.length > 0 && (
              <div style={{ background: "var(--bg-3)", padding: 14, borderRadius: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
                  Fant {faceClusters.length} unike personer. Hvem er hvem?
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                                gap: 12 }}>
                  {faceClusters.slice(0, 18).map((c) => {
                    const thumbUrl = c.thumbnail.startsWith("/")
                      ? `http://asset.localhost${c.thumbnail}` : c.thumbnail;
                    return (
                      <div key={c.id} style={{ background: "rgba(0,0,0,0.3)",
                                                 padding: 8, borderRadius: 6 }}>
                        <div style={{ width: "100%", aspectRatio: "1 / 1",
                                       borderRadius: 4, overflow: "hidden",
                                       background: "rgba(26, 13, 69, 0.4)",
                                       display: "flex", alignItems: "center",
                                       justifyContent: "center", marginBottom: 6 }}>
                          <img src={thumbUrl} alt={c.id}
                               style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        </div>
                        <div style={{ fontSize: 10, opacity: 0.6, marginBottom: 4 }}>
                          {c.occurrences} obs
                        </div>
                        <input
                          type="text"
                          list={`person-suggestions-${c.id}`}
                          placeholder="Hvem er dette?"
                          value={faceLabels[c.id] || ""}
                          onChange={(e) => setFaceLabels(prev => ({ ...prev, [c.id]: e.target.value }))}
                          style={{ width: "100%", fontSize: 11, padding: "4px 6px" }}
                        />
                        <datalist id={`person-suggestions-${c.id}`}>
                          {PERSON_SUGGESTIONS.map((s) => <option key={s} value={s} />)}
                        </datalist>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ fontSize: 11, opacity: 0.6, fontStyle: "italic",
                           background: "var(--bg-3)", padding: 10, borderRadius: 6 }}>
              💡 Du kan hoppe over personer du ikke kjenner. Claude bruker label-ene
              til å prioritere klipp i highlight (f.eks. flere shot av brudens mor).
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
              <button onClick={() => setStep("music")} disabled={facesScanning}>← Tilbake</button>
              <button className="primary" onClick={() => {
                const labeledCount = Object.values(faceLabels).filter(v => v.trim()).length;
                recordLearning(`Steg 4: labeled ${labeledCount}/${faceClusters.length} personer`);
                setStep("style");
              }} disabled={facesScanning}>
                Neste: Stil →
              </button>
            </div>
          </div>
        )}

        {/* ────── Step 5: Stil ────── */}
        {step === "style" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 14, lineHeight: 1.5 }}>
              Hvilken fremtoning ønsker du i highlighten? Stil-valget styrer hvordan
              Claude prioriterer klipp + rytme i flowmap.
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
              {([
                { id: "storytelling", icon: "📖", name: "Storytelling",
                  desc: "Rolig tempo, mer dialog/tale, kronologisk. Familie-vekt." },
                { id: "cinematic", icon: "🎬", name: "Cinematic",
                  desc: "Slow-mo, bokeh, color-grade. Visuell vekt over hastighet." },
                { id: "energetic", icon: "⚡", name: "Energisk",
                  desc: "Kort cuts, beat-sync, dans-fokus. Høyere BPM, mer action." },
                { id: "balanced", icon: "⚖", name: "Balansert",
                  desc: "Storytelling + energi mix. Default for de fleste bryllup." },
              ] as Array<{ id: Style; icon: string; name: string; desc: string }>).map((opt) => (
                <button key={opt.id}
                        onClick={() => setChosenStyle(opt.id)}
                        className={chosenStyle === opt.id ? "primary" : ""}
                        style={{ display: "flex", flexDirection: "column",
                                  alignItems: "flex-start", gap: 4, padding: 14,
                                  textAlign: "left" }}>
                  <div style={{ fontSize: 18 }}>{opt.icon}</div>
                  <div style={{ fontWeight: 600 }}>{opt.name}</div>
                  <div style={{ fontSize: 11, opacity: 0.8, lineHeight: 1.4 }}>{opt.desc}</div>
                </button>
              ))}
            </div>

            <div style={{ background: "var(--bg-3)", padding: 14, borderRadius: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                Forhåndsvisning av rytme (FlowMap)
              </div>
              {/* Mini FlowMap preview — visualiserer fremtidig rytme basert på stil */}
              <div style={{ display: "flex", height: 60, alignItems: "flex-end",
                              gap: 2, marginBottom: 8 }}>
                {Array.from({ length: 40 }).map((_, i) => {
                  // Generate styling-aware preview heights
                  let h = 0.5;
                  if (chosenStyle === "energetic") h = 0.3 + Math.abs(Math.sin(i * 0.6)) * 0.7;
                  else if (chosenStyle === "cinematic") h = 0.4 + Math.sin(i * 0.2 + 1) * 0.3 + 0.1;
                  else if (chosenStyle === "storytelling") h = 0.4 + Math.sin(i * 0.15) * 0.25;
                  else h = 0.3 + Math.abs(Math.sin(i * 0.35)) * 0.5;
                  return (
                    <div key={i}
                          style={{ flex: 1, background: "var(--accent)",
                                    height: `${h * 100}%`, borderRadius: 1,
                                    opacity: 0.7 + h * 0.3 }} />
                  );
                })}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between",
                              fontSize: 10, opacity: 0.6 }}>
                <span>Intro</span><span>Build</span><span>Peak</span><span>Outro</span>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
              <button onClick={() => setStep("persons")}>← Tilbake</button>
              <button className="primary" onClick={() => {
                recordLearning(`Steg 5: chose style=${chosenStyle}`);
                setStep("live");
              }}>
                Neste: Live-arbeid →
              </button>
            </div>
          </div>
        )}

        {/* ────── Step 6: Live-arbeid (Harry Potter mode) ────── */}
        {step === "live" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 14, lineHeight: 1.5 }}>
              Nå starter jeg å arbeide. Du kan se hvert klipp som blir valgt i sanntid —
              som om jeg redigerer foran øynene dine.
            </div>

            {!livePicksPath && !liveRunning && (
              <button className="primary"
                      disabled={!scanResult}
                      onClick={async () => {
                if (!scanResult) return;
                const firstClip = (scanResult as unknown as { clips?: Array<{ path: string }> }).clips?.[0]?.path;
                if (!firstClip) return;
                setLiveRunning(true);
                setLiveError(null);
                setLivePct(0);
                setLivePicks([]);
                const unsubProm = onScriptEvent((ev: ScriptEvent) => {
                  if (ev.type === "progress") {
                    const pct = ev.total ? Math.round(((ev.current ?? 0) / ev.total) * 100) : 0;
                    setLivePct(pct); setLiveMsg(ev.message || "");
                  }
                  // Når Python sender en "pick"-event som log med spesial-format kan vi
                  // parse det. For nå viser vi bare progress.
                });
                try {
                  const sum = await executeScript("extract_highlight_from_film", {
                    videoPath: firstClip,
                    genre: "wedding",
                    interactiveReview: true,
                  }, false);
                  const r = sum.events.find((e) => e.type === "result");
                  const val = r?.value as { picksPath?: string; picks?: Array<{ index: number; chapter: string }> } | undefined;
                  if (val?.picksPath) setLivePicksPath(val.picksPath);
                  if (val?.picks) setLivePicks(val.picks.map(p => ({ index: p.index, chapter: p.chapter })));
                } catch (err) {
                  setLiveError(String(err));
                } finally {
                  unsubProm.then((u) => u());
                  setLiveRunning(false);
                }
              }}>
                🎬 Start Claude
              </button>
            )}

            {(liveRunning || livePicksPath) && (
              <div style={{ background: "var(--bg-3)", padding: 14, borderRadius: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between",
                                fontSize: 12, marginBottom: 6 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {liveRunning ? <span style={{ color: "#f0a500" }}>🟡</span>
                                  : <span style={{ color: "#4ad48a" }}>🟢</span>}
                    {liveRunning ? "Claude redigerer …" : "Ferdig"}
                  </span>
                  <span>{livePct}%</span>
                </div>
                <div style={{ height: 6, background: "var(--bg-4)", borderRadius: 3,
                                overflow: "hidden", marginBottom: 8 }}>
                  <div style={{ width: `${livePct}%`, height: "100%",
                                  background: "var(--accent)", transition: "width 0.4s" }} />
                </div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>{liveMsg}</div>
                {livePicks.length > 0 && (
                  <div style={{ marginTop: 12, fontSize: 11 }}>
                    <strong>{livePicks.length} klipp valgt</strong>{" "}
                    <span style={{ opacity: 0.6 }}>
                      ({Array.from(new Set(livePicks.map(p => p.chapter))).join(" · ")})
                    </span>
                  </div>
                )}
              </div>
            )}

            {liveError && (
              <div style={{ background: "var(--bg-3)", borderLeft: "3px solid var(--danger)",
                              padding: 10, borderRadius: 4 }}>
                <strong>Feil:</strong> {liveError}
              </div>
            )}

            <div style={{ fontSize: 11, opacity: 0.6, fontStyle: "italic",
                            background: "var(--bg-3)", padding: 10, borderRadius: 6 }}>
              💡 Etter dette skannes filmen for log-gamma + LUT-anbefaling.
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
              <button onClick={() => setStep("style")} disabled={liveRunning}>← Tilbake</button>
              <button className="primary" onClick={() => {
                recordLearning(`Steg 6: extracted ${livePicks.length} picks`);
                setStep("color");
              }} disabled={liveRunning || !livePicksPath}>
                Neste: Color / LUT →
              </button>
            </div>
          </div>
        )}

        {/* ────── Step 7: Color / LUT ────── */}
        {step === "color" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 14, lineHeight: 1.5 }}>
              Sjekker om filmen er tatt opp i log-gamma. Hvis ja, foreslår jeg en LUT
              som matcher kameraet ditt. Vi bruker din egen LUT-mappe i Resolve.
            </div>

            {!logGamma && !logCheckBusy && (
              <button className="primary"
                      disabled={!scanResult}
                      onClick={async () => {
                if (!scanResult) return;
                const firstClip = (scanResult as unknown as { clips?: Array<{ path: string }> }).clips?.[0]?.path;
                if (!firstClip) return;
                setLogCheckBusy(true);
                try {
                  const sum = await executeScript("detect_log_gamma", {
                    videoPath: firstClip,
                  }, false);
                  const r = sum.events.find((e) => e.type === "result");
                  const val = r?.value as { isLog: boolean; profile: string; suggestedLut?: string } | undefined;
                  if (val) setLogGamma(val);
                } catch { /* noop */ }
                setLogCheckBusy(false);
              }}>
                🎨 Sjekk log-gamma
              </button>
            )}

            {logCheckBusy && (
              <div style={{ fontSize: 12, opacity: 0.7 }}>Sjekker log-profil …</div>
            )}

            {logGamma && (
              <div style={{ background: "var(--bg-3)", padding: 14, borderRadius: 8 }}>
                <div style={{ fontSize: 13, marginBottom: 8 }}>
                  <strong>Resultat:</strong> {logGamma.isLog
                    ? <span style={{ color: "#f0a500" }}>📹 Log-gamma oppdaget</span>
                    : <span style={{ color: "#4ad48a" }}>✓ Allerede gradet ({logGamma.profile})</span>}
                </div>
                <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 8 }}>
                  Profil: {logGamma.profile}
                </div>
                {logGamma.isLog && logGamma.suggestedLut && (
                  <>
                    <div style={{ fontSize: 12, marginBottom: 8 }}>
                      Foreslått LUT: <code>{logGamma.suggestedLut}</code>
                    </div>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                      <input type="checkbox" checked={applyLut}
                              onChange={(e) => setApplyLut(e.target.checked)} />
                      <span>Apply LUT i Resolve-timeline</span>
                    </label>
                  </>
                )}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
              <button onClick={() => setStep("live")}>← Tilbake</button>
              <button className="primary" onClick={() => {
                recordLearning(`Steg 7: isLog=${logGamma?.isLog} applyLut=${applyLut}`);
                if (livePicksPath) onComplete(livePicksPath);
                else onComplete(folder);
              }}>
                Ferdig — åpne Creative Editor →
              </button>
            </div>
          </div>
        )}

        {/* Catch-all (skulle aldri trigge) */}
        {!["material","audio","music","persons","style","live","color"].includes(step) && (
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
