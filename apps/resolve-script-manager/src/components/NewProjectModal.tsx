/**
 * NewProjectModal — one-click "+ Nytt prosjekt fra fil"-flow.
 *
 * 4 stages:
 *   1. Pick file + genre (form)
 *   2. Parallel extract + identify (progress bars)
 *   3. Song-role chooser per identified song
 *      (skip / sync-original / main / under-speeches / under-dance)
 *   4. Selective download → seed editor state → onComplete(picksPath)
 *
 * Selected song roles are written to localStorage under the editor state
 * key (trrpa.creative_editor.<sourceVideo>) so CreativeEditorView picks
 * them up as customAudios on first open.
 */

import { useEffect, useMemo, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { executeScript, onScriptEvent, convertFileSrc } from "../api";
import type { ScriptEvent } from "../types";
import MovieIcon from "@mui/icons-material/Movie";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import ViewModuleIcon from "@mui/icons-material/ViewModule";
import ViewListIcon from "@mui/icons-material/ViewList";

export type SongRole =
  | "skip"
  | "sync_original"
  | "main"
  | "under_speeches"
  | "under_dance";

interface IdentifiedSection {
  startSec: number;
  endSec: number;
  title?: string;
  artist?: string;
  downloadedPath?: string | null;
  key?: string;
  error?: string;
  score?: number;
  query?: string;
  coverArtPath?: string | null;
  frameThumbPath?: string | null;
}

type ViewMode = "grid" | "list";

interface Props {
  onClose: () => void;
  onComplete: (picksPath: string) => void;
}

const GENRES = [
  { id: "wedding", label: "Bryllup" },
  { id: "social",  label: "Social / Reels" },
  { id: "music_video", label: "Musikkvideo" },
  { id: "corporate", label: "Corporate" },
  { id: "documentary", label: "Dokumentar" },
] as const;

const ROLE_OPTIONS: Array<{ id: SongRole; label: string; hint: string }> = [
  { id: "skip", label: "Hopp over", hint: "Ikke bruk i highlight" },
  { id: "sync_original", label: "Sync til original timestamp", hint: "Spiller på samme tid som i kildevideo" },
  { id: "main", label: "Hoved-musikk", hint: "Spiller over hele highlight" },
  { id: "under_speeches", label: "Under taler", hint: "Auto-duck til -22 dB under tale-segmenter" },
  { id: "under_dance", label: "Under dans", hint: "Spiller bare i energiske scener" },
];

type Stage = "form" | "scanning" | "review" | "downloading";

export function NewProjectModal({ onClose, onComplete }: Props) {
  const [stage, setStage] = useState<Stage>("form");

  // Stage 1 — form
  const [videoPath, setVideoPath] = useState<string>("");
  const [genre, setGenre] = useState<typeof GENRES[number]["id"]>("wedding");
  const [autoIdentify, setAutoIdentify] = useState(true);

  // Auto-identify er bare lovlig for personlige videoer (bryllup/familie).
  // Slå av automatisk for corporate/commercial.
  const isPersonalGenre = genre === "wedding";
  useEffect(() => {
    setAutoIdentify(isPersonalGenre);
  }, [isPersonalGenre]);

  // Stage 2 — scanning
  const [extractPct, setExtractPct] = useState(0);
  const [extractMsg, setExtractMsg] = useState("Venter…");
  const [identifyPct, setIdentifyPct] = useState(0);
  const [identifyMsg, setIdentifyMsg] = useState("Venter…");
  const [picksPath, setPicksPath] = useState<string | null>(null);
  const [identified, setIdentified] = useState<IdentifiedSection[]>([]);
  const [scanError, setScanError] = useState<string | null>(null);

  // Stage 3 — role assignment + view mode
  const [songRoles, setSongRoles] = useState<Record<string, SongRole>>({});
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  // Stage 4 — downloading
  const [downloadPct, setDownloadPct] = useState(0);
  const [downloadMsg, setDownloadMsg] = useState("");

  const pickFile = async () => {
    const sel = await openDialog({
      multiple: false,
      directory: false,
      filters: [{ name: "Video", extensions: ["mp4", "mov", "mkv", "m4v", "avi"] }],
    });
    if (typeof sel === "string") setVideoPath(sel);
  };

  const fileName = videoPath ? videoPath.split("/").pop() || videoPath : "";

  const startScan = () => {
    if (!videoPath) return;
    setStage("scanning");
    setScanError(null);

    let extractRunId: string | null = null;
    let identifyRunId: string | null = null;
    const unsubProm = onScriptEvent((ev: ScriptEvent) => {
      if (ev.type === "started" && ev.scriptId) {
        if (ev.scriptId === "extract_highlight_from_film") extractRunId = ev.runId;
        if (ev.scriptId === "identify_and_download_source_songs") identifyRunId = ev.runId;
      }
      if (ev.type === "progress") {
        const pct = ev.total ? Math.round(((ev.current ?? 0) / ev.total) * 100) : 0;
        if (ev.runId === extractRunId) {
          setExtractPct(pct); setExtractMsg(ev.message || "Skanner…");
        } else if (ev.runId === identifyRunId) {
          setIdentifyPct(pct); setIdentifyMsg(ev.message || "Identifiserer…");
        }
      }
    });

    const pExtract = executeScript("extract_highlight_from_film", {
      videoPath,
      genre,
      interactiveReview: true,
    }, false).then((sum) => {
      const r = sum.events.find((e) => e.type === "result");
      const val = r?.value as { picksPath?: string } | undefined;
      if (val?.picksPath) setPicksPath(val.picksPath);
      setExtractPct(100); setExtractMsg("Picks klare");
      return val?.picksPath;
    });

    const pIdentify = autoIdentify
      ? executeScript("identify_and_download_source_songs", {
          videoPath,
          identifyOnly: true,
        }, false).then((sum) => {
          const r = sum.events.find((e) => e.type === "result");
          const val = r?.value as { sections?: IdentifiedSection[] } | undefined;
          const sections = (val?.sections || []).filter((s) => s.title);
          const uniq: IdentifiedSection[] = [];
          const seen = new Set<string>();
          for (const s of sections) {
            const k = s.key || `${s.title}|${s.artist}`;
            if (seen.has(k)) continue;
            seen.add(k);
            uniq.push({ ...s, key: k });
          }
          setIdentified(uniq);
          const roles: Record<string, SongRole> = {};
          for (const s of uniq) roles[s.key!] = "sync_original";
          setSongRoles(roles);
          setIdentifyPct(100); setIdentifyMsg(`${uniq.length} sanger funnet`);
        })
      : Promise.resolve();

    Promise.all([pExtract, pIdentify])
      .then(() => {
        unsubProm.then((u) => u());
        setStage("review");
      })
      .catch((err) => {
        unsubProm.then((u) => u());
        setScanError(String(err));
      });
  };

  const submitDownload = async () => {
    setStage("downloading");
    setDownloadPct(0); setDownloadMsg("Starter…");

    const toDownload = identified.filter((s) => {
      const role = songRoles[s.key!];
      return role && role !== "skip";
    });

    if (toDownload.length === 0) {
      await finalize([]);
      return;
    }

    const selectedKeys = toDownload.map((s) => s.key!);

    const unsubProm = onScriptEvent((ev) => {
      if (ev.type === "progress") {
        const pct = ev.total ? Math.round(((ev.current ?? 0) / ev.total) * 100) : 0;
        setDownloadPct(pct); setDownloadMsg(ev.message || "Laster ned…");
      }
    });

    try {
      const sum = await executeScript("identify_and_download_source_songs", {
        videoPath,
        selectedKeys,
      }, false);
      const r = sum.events.find((e) => e.type === "result");
      const val = r?.value as { sections?: IdentifiedSection[] } | undefined;
      const downloaded = val?.sections || [];

      const customAudios = downloaded
        .filter((s) => s.downloadedPath && s.key && songRoles[s.key] !== "skip")
        .map((s) => ({
          id: `src-${(s.key || s.title || "audio").replace(/\W+/g, "_")}`,
          path: s.downloadedPath!,
          name: `${s.title} — ${s.artist}`,
          startSec: songRoles[s.key!] === "sync_original" ? s.startSec : 0,
          volume: songRoles[s.key!] === "under_speeches" ? 0.25 : 1.0,
          usageRole: songRoles[s.key!],
          sourceStartSec: s.startSec,
          sourceEndSec: s.endSec,
        }));

      if (picksPath) {
        try {
          const stateKey = `trrpa.creative_editor.${videoPath}`;
          const existingRaw = localStorage.getItem(stateKey);
          const existing = existingRaw ? JSON.parse(existingRaw) : {};
          const merged = {
            ...existing,
            customAudios: [
              ...(Array.isArray(existing.customAudios) ? existing.customAudios : []),
              ...customAudios,
            ],
          };
          localStorage.setItem(stateKey, JSON.stringify(merged));
        } catch (err) {
          console.warn("Could not seed editor state:", err);
        }
        unsubProm.then((u) => u());
        await finalize(customAudios);
      }
    } catch (err) {
      unsubProm.then((u) => u());
      setScanError(String(err));
    }
  };

  // Archive picks-cache + register in localStorage savedProjects, then open editor.
  const finalize = async (customAudios: Array<{ id: string; name: string }>) => {
    if (!picksPath) {
      setScanError("Mangler picks-path");
      return;
    }
    try {
      const sum = await executeScript("archive_project", { sourceVideo: videoPath }, false);
      const r = sum.events.find((e) => e.type === "result");
      const val = r?.value as { archivePath?: string; savedAt?: number } | undefined;
      const archivePath = val?.archivePath || picksPath;

      // Lagre i savedProjects-listen
      try {
        const raw = localStorage.getItem("trrpa.savedProjects");
        const list = raw ? JSON.parse(raw) : [];
        const cleanList = Array.isArray(list)
          ? list.filter((p: { sourceVideo?: string }) => p.sourceVideo !== videoPath)
          : [];
        const title = (videoPath.split("/").pop() || "Highlight").replace(/\.[^.]+$/, "");
        const entry = {
          picksPath: archivePath,
          sourceVideo: videoPath,
          title,
          savedAt: val?.savedAt ?? Date.now() / 1000,
          audioCount: customAudios.length,
        };
        cleanList.unshift(entry);
        localStorage.setItem("trrpa.savedProjects", JSON.stringify(cleanList.slice(0, 30)));
      } catch (err) {
        console.warn("Could not update savedProjects:", err);
      }

      onComplete(archivePath);
    } catch (err) {
      // Fallback: open with last-cache pointer if archiving failed
      console.warn("Archive failed, using last-cache:", err);
      onComplete(picksPath);
    }
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape" && (stage === "form" || stage === "review")) onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [stage, onClose]);

  const overallPct = useMemo(() => {
    if (!autoIdentify) return extractPct;
    return Math.round((extractPct + identifyPct) / 2);
  }, [extractPct, identifyPct, autoIdentify]);

  return (
    <div className="modal-backdrop" onClick={stage === "form" || stage === "review" ? onClose : undefined}>
      <div className="modal" onClick={(e) => e.stopPropagation()}
           style={{ maxWidth: 720, width: "min(96vw, 720px)", maxHeight: "90vh", overflowY: "auto" }}>
        <h2>Nytt prosjekt fra fil</h2>

        {scanError && (
          <div style={{ background: "var(--bg-3)", borderLeft: "3px solid var(--danger)",
                        padding: 12, borderRadius: 4, margin: "12px 0" }}>
            <strong>Feil:</strong> {scanError}
          </div>
        )}

        {/* Stage 1 — Form */}
        {stage === "form" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 12 }}>
            <div className="field">
              <label>Kildevideo</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input type="text" readOnly value={fileName || "Ingen valgt"}
                       style={{ flex: 1 }} />
                <button onClick={pickFile}>Velg fil…</button>
              </div>
            </div>

            <div className="field">
              <label>Sjanger</label>
              <select value={genre} onChange={(e) => setGenre(e.target.value as typeof genre)}>
                {GENRES.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
              </select>
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 8,
                             cursor: isPersonalGenre ? "pointer" : "not-allowed",
                             opacity: isPersonalGenre ? 1 : 0.5 }}>
              <input type="checkbox" checked={autoIdentify && isPersonalGenre}
                     disabled={!isPersonalGenre}
                     onChange={(e) => setAutoIdentify(e.target.checked)} />
              <span>
                Auto-identifiser musikk i kildevideo (AcoustID + Chromaprint)
                {!isPersonalGenre && (
                  <span style={{ fontSize: 11, opacity: 0.8, marginLeft: 6 }}>
                    — kun for personlige videoer (bryllup/familie). Commercial bruk = importer eget lisensiert lyd.
                  </span>
                )}
              </span>
            </label>

            <div style={{ background: "var(--bg-3)", padding: 12, borderRadius: 6,
                          fontSize: 12, opacity: 0.85, lineHeight: 1.5 }}>
              <strong>Hva som skjer:</strong>
              <ol style={{ margin: "6px 0 0 18px", padding: 0 }}>
                <li>Scene-detection + ML signal-scoring (~10-30 min)</li>
                {autoIdentify && <li>Audio-fingerprint identifiserer brukte sanger (~5 min)</li>}
                <li>Du velger rolle per sang (sync, hoved, under-tale, …)</li>
                <li>yt-dlp laster ned valgte sanger</li>
                <li>Creative Editor åpner</li>
              </ol>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
              <button onClick={onClose}>Avbryt</button>
              <button className="primary"
                      disabled={!videoPath}
                      onClick={startScan}>
                Start skanning →
              </button>
            </div>
          </div>
        )}

        {/* Stage 2 — Scanning */}
        {stage === "scanning" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 22, marginTop: 12 }}>
            <div>
              <div style={{ fontSize: 13, marginBottom: 4 }}>
                <strong>{fileName}</strong>
              </div>
              <div style={{ fontSize: 11, opacity: 0.6 }}>Total: {overallPct}%</div>
            </div>

            <ProgressLine
              label={<span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <MovieIcon sx={{ fontSize: 14 }} /> Picks (scene + ML signals)
              </span>}
              pct={extractPct} msg={extractMsg} />
            {autoIdentify && (
              <ProgressLine
                label={<span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <MusicNoteIcon sx={{ fontSize: 14 }} /> Identifiser musikk
                </span>}
                pct={identifyPct} msg={identifyMsg} />
            )}

            <div style={{ fontSize: 11, opacity: 0.5, fontStyle: "italic" }}>
              Du kan trygt jobbe med annet i mellomtiden.
            </div>
          </div>
        )}

        {/* Stage 3 — Review */}
        {stage === "review" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 12 }}>
            {identified.length === 0 ? (
              <div style={{ padding: 16, textAlign: "center", opacity: 0.7 }}>
                Ingen kjente sanger identifisert i kildevideoen.
                <br />
                <span style={{ fontSize: 12, opacity: 0.6 }}>
                  Du kan dra inn egne MP3-er i editor etterpå.
                </span>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between",
                               alignItems: "center" }}>
                  <div style={{ fontSize: 13 }}>
                    Vi fant <strong>{identified.length}</strong> sanger. Velg rolle per sang:
                  </div>
                  <div style={{ display: "flex", gap: 4, fontSize: 12 }}>
                    <button onClick={() => setViewMode("grid")}
                            className={viewMode === "grid" ? "primary" : ""}
                            style={{ padding: "4px 10px", display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <ViewModuleIcon sx={{ fontSize: 14 }} /> Grid
                    </button>
                    <button onClick={() => setViewMode("list")}
                            className={viewMode === "list" ? "primary" : ""}
                            style={{ padding: "4px 10px", display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <ViewListIcon sx={{ fontSize: 14 }} /> Liste
                    </button>
                  </div>
                </div>

                {identified.map((s) => {
                  const k = s.key!;
                  const role = songRoles[k] || "sync_original";
                  const fmt = (sec: number) => {
                    const m = Math.floor(sec / 60); const ss = Math.floor(sec % 60);
                    return `${m}:${String(ss).padStart(2, "0")}`;
                  };
                  const coverUrl = s.coverArtPath ? convertFileSrc(s.coverArtPath) : null;
                  const frameUrl = s.frameThumbPath ? convertFileSrc(s.frameThumbPath) : null;

                  if (viewMode === "list") {
                    return (
                      <div key={k} style={{ background: "var(--bg-3)", padding: 10,
                                             borderRadius: 6, display: "flex",
                                             alignItems: "center", gap: 12 }}>
                        <ThumbPair coverUrl={coverUrl} frameUrl={frameUrl} size={36} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ overflow: "hidden", textOverflow: "ellipsis",
                                         whiteSpace: "nowrap" }}>
                            <strong style={{ fontSize: 13 }}>{s.title}</strong>
                            <span style={{ opacity: 0.7, marginLeft: 6, fontSize: 12 }}>
                              — {s.artist}
                            </span>
                          </div>
                          <div style={{ fontSize: 11, opacity: 0.5 }}>
                            {fmt(s.startSec)} – {fmt(s.endSec)}
                          </div>
                        </div>
                        <select value={role}
                                onChange={(e) => setSongRoles({ ...songRoles, [k]: e.target.value as SongRole })}
                                style={{ fontSize: 12, padding: "4px 8px", minWidth: 180 }}>
                          {ROLE_OPTIONS.map((opt) => (
                            <option key={opt.id} value={opt.id}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                    );
                  }

                  return (
                    <div key={k} style={{ background: "var(--bg-3)", padding: 12,
                                           borderRadius: 6 }}>
                      <div style={{ display: "flex", gap: 12, marginBottom: 10 }}>
                        <ThumbPair coverUrl={coverUrl} frameUrl={frameUrl} size={56} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ overflow: "hidden", textOverflow: "ellipsis",
                                         whiteSpace: "nowrap" }}>
                            <strong style={{ fontSize: 14 }}>{s.title}</strong>
                            <span style={{ opacity: 0.7, marginLeft: 6 }}>— {s.artist}</span>
                          </div>
                          <div style={{ fontSize: 11, opacity: 0.5, marginTop: 4 }}>
                            {fmt(s.startSec)} – {fmt(s.endSec)} i kilden
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "grid",
                                     gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                                     gap: 4 }}>
                        {ROLE_OPTIONS.map((opt) => (
                          <label key={opt.id} title={opt.hint}
                                 style={{ display: "flex", alignItems: "center", gap: 6,
                                          padding: "6px 8px", borderRadius: 4,
                                          background: role === opt.id ? "var(--accent-dim)" : "transparent",
                                          cursor: "pointer", fontSize: 12,
                                          border: `1px solid ${role === opt.id ? "var(--accent)" : "var(--bg-4)"}` }}>
                            <input type="radio" name={`role-${k}`}
                                   checked={role === opt.id}
                                   onChange={() => setSongRoles({ ...songRoles, [k]: opt.id })} />
                            <span>{opt.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            <div style={{ display: "flex", justifyContent: "space-between",
                           alignItems: "center", marginTop: 8 }}>
              <button onClick={() => finalize([])}>
                Hopp over — åpne editor uten audio
              </button>
              <button className="primary" onClick={submitDownload}>
                Last ned valgte + åpne editor →
              </button>
            </div>
          </div>
        )}

        {/* Stage 4 — Downloading */}
        {stage === "downloading" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 12 }}>
            <div style={{ fontSize: 13 }}>Laster ned valgte sanger via yt-dlp…</div>
            <ProgressLine label="" pct={downloadPct} msg={downloadMsg} />
          </div>
        )}
      </div>
    </div>
  );
}

function ThumbPair({ coverUrl, frameUrl, size }:
                    { coverUrl: string | null; frameUrl: string | null; size: number }) {
  const fallback = "linear-gradient(135deg, var(--bg-4) 0%, var(--bg-3) 100%)";
  return (
    <div style={{ display: "flex", gap: 2, flex: "0 0 auto" }}>
      <div title="Album-art"
           style={{ width: size, height: size, borderRadius: 4, overflow: "hidden",
                     background: fallback, display: "flex",
                     alignItems: "center", justifyContent: "center",
                     opacity: coverUrl ? 1 : 0.4 }}>
        {coverUrl
          ? <img src={coverUrl} alt="art" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <MusicNoteIcon sx={{ fontSize: size > 50 ? 24 : 18 }} />}
      </div>
      <div title="Scene-frame fra kildevideo"
           style={{ width: size, height: size, borderRadius: 4, overflow: "hidden",
                     background: fallback, display: "flex",
                     alignItems: "center", justifyContent: "center",
                     opacity: frameUrl ? 1 : 0.4 }}>
        {frameUrl
          ? <img src={frameUrl} alt="scene" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <MovieIcon sx={{ fontSize: size > 50 ? 24 : 18 }} />}
      </div>
    </div>
  );
}

function ProgressLine({ label, pct, msg }: { label: React.ReactNode; pct: number; msg: string }) {
  return (
    <div>
      {label && (
        <div style={{ display: "flex", justifyContent: "space-between",
                       fontSize: 12, marginBottom: 4 }}>
          <span>{label}</span>
          <span>{pct}%</span>
        </div>
      )}
      <div style={{ height: 6, background: "var(--bg-3)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: "var(--accent)",
                       transition: "width 0.3s ease" }} />
      </div>
      <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>{msg}</div>
    </div>
  );
}
