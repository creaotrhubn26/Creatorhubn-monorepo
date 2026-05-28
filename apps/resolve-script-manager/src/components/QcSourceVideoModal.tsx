/**
 * QcSourceVideoModal — standalone QC av en video-fil via ffmpeg.
 * Krever ikke Resolve. Plukker en fil → kjører qc_source_video → viser
 * gaps + stille intervaller med fmt'd tidsstemplet liste.
 */

import { useEffect, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { executeScript, onScriptEvent } from "../api";
import type { ScriptEvent } from "../types";
import SearchIcon from "@mui/icons-material/Search";
import WarningIcon from "@mui/icons-material/Warning";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import StopIcon from "@mui/icons-material/Stop";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import PlaceIcon from "@mui/icons-material/Place";

interface Props {
  onClose: () => void;
}

interface Interval { startSec: number; endSec: number; durationSec: number }
interface QcResult {
  videoPath: string;
  durationSec: number;
  blackIntervals: Interval[];
  silentIntervals: Interval[];
  blackCount: number;
  silentCount: number;
  totalBlackSec: number;
  totalSilentSec: number;
  verdict: "clean" | "minor_issues" | "major_issues";
}

const fmtTime = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = Math.floor(s % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`
    : `${m}:${String(ss).padStart(2, "0")}`;
};

export function QcSourceVideoModal({ onClose }: Props) {
  const [videoPath, setVideoPath] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const [msg, setMsg] = useState("");
  const [result, setResult] = useState<QcResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [busy, onClose]);

  const pickFile = async () => {
    const sel = await openDialog({
      multiple: false, directory: false,
      filters: [{ name: "Video", extensions: ["mp4", "mov", "mkv", "m4v", "avi"] }],
    });
    if (typeof sel === "string") {
      setVideoPath(sel);
      setResult(null);
      setError(null);
    }
  };

  const runQc = async () => {
    if (!videoPath) return;
    setBusy(true); setPct(0); setMsg("Starter …"); setError(null); setResult(null);
    const unsub = onScriptEvent((ev: ScriptEvent) => {
      if (ev.type === "progress") {
        const p = ev.total ? Math.round(((ev.current ?? 0) / ev.total) * 100) : 0;
        setPct(p); setMsg(ev.message || "");
      }
    });
    try {
      const sum = await executeScript("qc_source_video", { videoPath }, false);
      const r = sum.events.find((e) => e.type === "result");
      const val = r?.value as QcResult | undefined;
      if (val) setResult(val);
      else setError("Ingen data returnert");
    } catch (err) {
      setError(String(err));
    } finally {
      unsub.then((u) => u());
      setBusy(false);
    }
  };

  const fileName = videoPath ? videoPath.split("/").pop() || videoPath : "";

  return (
    <div className="modal-backdrop" onClick={!busy ? onClose : undefined}>
      <div className="modal" onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 720, width: "min(96vw, 720px)", maxHeight: "90vh", overflowY: "auto" }}>
        <h2 style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <SearchIcon sx={{ fontSize: 22 }} /> QC av video
        </h2>
        <p style={{ fontSize: 12, opacity: 0.75, marginTop: -4 }}>
          Sjekker for svarte intervaller + stille perioder. Bruker ffmpeg lokalt — krever ikke Resolve.
        </p>

        <div className="field" style={{ marginTop: 12 }}>
          <label>Video-fil</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input type="text" readOnly value={fileName || "Ingen valgt"} style={{ flex: 1 }} />
            <button onClick={pickFile} disabled={busy}>Velg fil…</button>
          </div>
        </div>

        {videoPath && !busy && !result && (
          <button className="primary" onClick={runQc}
                  style={{ width: "100%", marginTop: 12, display: "inline-flex",
                            alignItems: "center", justifyContent: "center", gap: 6 }}>
            <SearchIcon sx={{ fontSize: 16 }} /> Start QC
          </button>
        )}

        {busy && (
          <div style={{ marginTop: 16 }}>
            <div style={{ height: 6, background: "var(--bg-3)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: "var(--accent)",
                              transition: "width 0.3s" }} />
            </div>
            <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>{msg} — {pct}%</div>
            <div style={{ fontSize: 11, opacity: 0.5, marginTop: 8, fontStyle: "italic",
                            display: "inline-flex", alignItems: "center", gap: 4 }}>
              <WarningIcon sx={{ fontSize: 14 }} /> Skanning av lang film kan ta 1-3 min (avhenger av varighet)
            </div>
          </div>
        )}

        {error && (
          <div style={{ marginTop: 16, background: "var(--bg-3)", borderLeft: "3px solid var(--danger)",
                          padding: 10, borderRadius: 4 }}>
            <strong>Feil:</strong> {error}
          </div>
        )}

        {result && (
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: result.verdict === "clean" ? "rgba(74, 212, 138, 0.10)"
                                          : result.verdict === "minor_issues" ? "rgba(240, 165, 0, 0.10)"
                                          : "rgba(239, 79, 111, 0.10)",
                            border: `1px solid ${
                              result.verdict === "clean" ? "#4ad48a"
                                : result.verdict === "minor_issues" ? "#f0a500" : "#ef4f6f"}`,
                            padding: 14, borderRadius: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 600, display: "inline-flex",
                              alignItems: "center", gap: 6 }}>
                {result.verdict === "clean" ? (
                  <><CheckCircleIcon sx={{ fontSize: 16, color: "#4ad48a" }} /> Clean — ingen problemer</>
                ) : result.verdict === "minor_issues" ? (
                  <><WarningIcon sx={{ fontSize: 16, color: "#f0a500" }} /> Minor issues</>
                ) : (
                  <><ErrorIcon sx={{ fontSize: 16, color: "#ef4f6f" }} /> Major issues</>
                )}
              </div>
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
                Varighet: {fmtTime(result.durationSec)} ·{" "}
                {result.blackCount} svarte ({result.totalBlackSec.toFixed(1)}s) ·{" "}
                {result.silentCount} stille ({result.totalSilentSec.toFixed(1)}s)
              </div>
            </div>

            {result.blackIntervals.length > 0 && (
              <div style={{ background: "var(--bg-3)", padding: 12, borderRadius: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8,
                                 display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <StopIcon sx={{ fontSize: 14 }} /> Svarte intervaller ({result.blackIntervals.length})
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4,
                                fontFamily: "ui-monospace, monospace", fontSize: 11 }}>
                  {result.blackIntervals.slice(0, 20).map((b, i) => (
                    <div key={i} style={{ display: "flex", gap: 8 }}>
                      <span style={{ minWidth: 100 }}>
                        {fmtTime(b.startSec)} → {fmtTime(b.endSec)}
                      </span>
                      <span style={{ color: b.durationSec > 2 ? "#ef4f6f"
                                                  : b.durationSec > 1 ? "#f0a500" : "#8674a8" }}>
                        ({b.durationSec.toFixed(2)}s)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.silentIntervals.length > 0 && (
              <div style={{ background: "var(--bg-3)", padding: 12, borderRadius: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8,
                                 display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <MusicNoteIcon sx={{ fontSize: 14 }} /> Stille intervaller ({result.silentIntervals.length})
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4,
                                fontFamily: "ui-monospace, monospace", fontSize: 11 }}>
                  {result.silentIntervals.slice(0, 20).map((s, i) => (
                    <div key={i} style={{ display: "flex", gap: 8 }}>
                      <span style={{ minWidth: 100 }}>
                        {fmtTime(s.startSec)} → {fmtTime(s.endSec)}
                      </span>
                      <span style={{ color: s.durationSec > 30 ? "#ef4f6f"
                                                  : s.durationSec > 10 ? "#f0a500" : "#8674a8" }}>
                        ({s.durationSec.toFixed(1)}s)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { setResult(null); setVideoPath(""); }} style={{ flex: 1 }}>
                Sjekk en annen fil
              </button>
              <button className="primary"
                      onClick={async () => {
                if (!confirm("Dette krever at videoen finnes som en TIMELINE i et åpent Resolve-prosjekt med samme navn. Vil du fortsette?")) return;
                try {
                  const base = videoPath.split("/").pop()?.replace(/\.[^.]+$/, "") || "";
                  await executeScript("mark_qc_issues_on_timeline", {
                    timelineName: base,
                    removeOldQc: true,
                  }, false);
                  alert(`✓ Markers lagt til (røde = svart-gap, gule = stille).\nNavigér via Resolve sin marker-liste.`);
                } catch (e) {
                  alert(`Feil: ${e}\n\nSjekk at Resolve er åpen + timeline '${videoPath.split("/").pop()?.replace(/\.[^.]+$/, "")}' eksisterer.`);
                }
              }} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <PlaceIcon sx={{ fontSize: 14 }} /> Legg markers i Resolve
              </button>
            </div>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <button onClick={onClose} disabled={busy}>Lukk</button>
        </div>
      </div>
    </div>
  );
}
