/**
 * QcPreflightPanel — orkestrert QC før render.
 *
 * Kaller registry-scriptet `qc_preflight` (orkestrator) som aggregerer alle
 * QC-sjekkene (audio-hull, loudness/TP, stille seksjoner, timeline-gaps,
 * jump/flash cuts, unheard speech, lengde+kapittel) til pass/warn/fail per
 * sjekk + en samlet overall. Viser grønn/gul/rød status-prikk per sjekk med
 * klikkbare tidskode-items, og en toggle for treg SyncNet lip-sync-analyse.
 *
 * Åpnes fra App.tsx via state `showQcPreflight` + CommandPalette-kommando
 * "QC Preflight". Krever et åpent Resolve-prosjekt med aktiv timeline.
 */

import { useEffect, useState } from "react";
import { executeScript, onScriptEvent } from "../api";
import type { ScriptEvent } from "../types";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import WarningIcon from "@mui/icons-material/Warning";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";

interface Props {
  onClose: () => void;
}

type CheckStatus = "pass" | "warn" | "fail";

interface CheckItem {
  timeline?: string;
  note?: string;
}

interface QcCheck {
  name: string;
  status: CheckStatus;
  detail?: string;
  items?: CheckItem[];
}

interface QcPreflightResult {
  checks: QcCheck[];
  overall: CheckStatus;
}

const STATUS_COLOR: Record<CheckStatus, string> = {
  pass: "var(--success)",
  warn: "var(--warning)",
  fail: "var(--danger)",
};

const STATUS_LABEL: Record<CheckStatus, string> = {
  pass: "Klar for render",
  warn: "Se over advarsler",
  fail: "Problemer må fikses",
};

function StatusDot({ status, size = 12 }: { status: CheckStatus; size?: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: STATUS_COLOR[status],
        boxShadow: `0 0 6px ${STATUS_COLOR[status]}`,
        flexShrink: 0,
        display: "inline-block",
      }}
    />
  );
}

function OverallIcon({ status }: { status: CheckStatus }) {
  if (status === "pass") return <CheckCircleIcon sx={{ fontSize: 22, color: "var(--success)" }} />;
  if (status === "warn") return <WarningIcon sx={{ fontSize: 22, color: "var(--warning)" }} />;
  return <ErrorIcon sx={{ fontSize: 22, color: "var(--danger)" }} />;
}

export default function QcPreflightPanel({ onClose }: Props) {
  const [loudnessTarget, setLoudnessTarget] = useState(-16);
  const [truePeak, setTruePeak] = useState(-2);
  const [runSyncNet, setRunSyncNet] = useState(false);

  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const [msg, setMsg] = useState("");
  const [result, setResult] = useState<QcPreflightResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [busy, onClose]);

  const runQc = async () => {
    setBusy(true); setPct(0); setMsg("Starter QC …"); setError(null); setResult(null);
    const unsub = onScriptEvent((ev: ScriptEvent) => {
      if (ev.type === "progress") {
        const p = ev.total ? Math.round(((ev.current ?? 0) / ev.total) * 100) : 0;
        setPct(p); setMsg(ev.message || "");
      }
    });
    try {
      const sum = await executeScript(
        "qc_preflight",
        { loudnessTarget, truePeak, runSyncNet },
        false,
      );
      const r = sum.events.find((e) => e.type === "result");
      const val = r?.value as QcPreflightResult | undefined;
      if (val) setResult(val);
      else setError("Ingen data returnert");
    } catch (err) {
      setError(String(err));
    } finally {
      unsub.then((u) => u());
      setBusy(false);
    }
  };

  const counts = result
    ? result.checks.reduce(
        (acc, c) => { acc[c.status] += 1; return acc; },
        { pass: 0, warn: 0, fail: 0 } as Record<CheckStatus, number>,
      )
    : null;

  return (
    <div className="modal-backdrop anim-fade-in" onClick={!busy ? onClose : undefined}>
      <div className="modal anim-slide-up" onClick={(e) => e.stopPropagation()}
           style={{ maxWidth: 720, width: "min(96vw, 720px)", maxHeight: "90vh", overflowY: "auto" }}>
        <h2 style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <FactCheckIcon sx={{ fontSize: 22 }} /> QC Preflight
        </h2>
        <p style={{ fontSize: 12, opacity: 0.75, marginTop: -4 }}>
          Kjører alle QC-sjekker på gjeldende timeline før render: audio-hull, loudness/true-peak,
          stille seksjoner, timeline-gaps, jump/flash cuts, «snakker men høres ikke» + lengde/kapittel.
        </p>

        {/* Innstillinger */}
        <div style={{ display: "flex", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
          <div className="field" style={{ flex: "1 1 160px" }}>
            <label>Loudness-mål (LUFS)</label>
            <input
              type="number"
              value={loudnessTarget}
              step={1}
              disabled={busy}
              onChange={(e) => setLoudnessTarget(Number(e.target.value))}
            />
          </div>
          <div className="field" style={{ flex: "1 1 160px" }}>
            <label>True peak (dBTP)</label>
            <input
              type="number"
              value={truePeak}
              step={0.5}
              disabled={busy}
              onChange={(e) => setTruePeak(Number(e.target.value))}
            />
          </div>
        </div>

        <label
          className="preflight-question"
          style={{
            display: "flex", alignItems: "center", gap: 8, marginTop: 12,
            fontSize: 12, cursor: busy ? "default" : "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={runSyncNet}
            disabled={busy}
            onChange={(e) => setRunSyncNet(e.target.checked)}
          />
          <span>
            Kjør SyncNet lip-sync (tregt)
            <span style={{ color: "var(--text-muted)", marginLeft: 6 }}>
              — dyp lip-sync-analyse, kan ta flere minutter
            </span>
          </span>
        </label>

        {!busy && (
          <button className="primary" onClick={runQc}
                  style={{ width: "100%", marginTop: 16, display: "inline-flex",
                           alignItems: "center", justifyContent: "center", gap: 6 }}>
            <PlayArrowIcon sx={{ fontSize: 18 }} /> Kjør QC
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
              <WarningIcon sx={{ fontSize: 14 }} />
              {runSyncNet
                ? "SyncNet er aktivert — dette kan ta flere minutter."
                : "Skanning av lang timeline kan ta 1-3 min."}
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
            {/* Overall — stort øverst */}
            <div style={{
              background:
                result.overall === "pass" ? "rgba(74, 212, 138, 0.10)"
                  : result.overall === "warn" ? "rgba(240, 165, 0, 0.10)"
                  : "rgba(239, 79, 111, 0.10)",
              border: `1px solid ${STATUS_COLOR[result.overall]}`,
              padding: 16, borderRadius: 8,
            }}>
              <div style={{ fontSize: 18, fontWeight: 700, display: "inline-flex",
                            alignItems: "center", gap: 8 }}>
                <OverallIcon status={result.overall} />
                {STATUS_LABEL[result.overall]}
              </div>
              {counts && (
                <div style={{ fontSize: 12, opacity: 0.85, marginTop: 6 }}>
                  {counts.pass} bestått · {counts.warn} advarsler · {counts.fail} feil
                  {" "}— {result.checks.length} sjekker
                </div>
              )}
            </div>

            {/* Per-sjekk-rader */}
            {result.checks.map((check, ci) => (
              <div key={ci} style={{ background: "var(--bg-3)", padding: 12, borderRadius: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <StatusDot status={check.status} />
                  <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{check.name}</span>
                  <span style={{
                    fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5,
                    color: STATUS_COLOR[check.status], fontWeight: 700,
                  }}>
                    {check.status}
                  </span>
                </div>

                {check.detail && (
                  <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 6, marginLeft: 20 }}>
                    {check.detail}
                  </div>
                )}

                {check.items && check.items.length > 0 && (
                  <div style={{
                    display: "flex", flexDirection: "column", gap: 4, marginTop: 8, marginLeft: 20,
                    fontFamily: "ui-monospace, monospace", fontSize: 11,
                  }}>
                    {check.items.map((item, ii) => (
                      <button
                        key={ii}
                        type="button"
                        title="Kopier tidskode"
                        onClick={() => {
                          if (item.timeline) void navigator.clipboard?.writeText(item.timeline);
                        }}
                        style={{
                          display: "flex", gap: 8, alignItems: "baseline", textAlign: "left",
                          background: "var(--bg-2)", border: "1px solid var(--border)",
                          borderRadius: 4, padding: "4px 8px", cursor: "pointer",
                          color: "var(--text)", width: "100%",
                        }}
                      >
                        <span style={{ minWidth: 90, color: "var(--accent)", fontWeight: 600 }}>
                          {item.timeline || "—"}
                        </span>
                        <span style={{ color: "var(--text-dim)" }}>{item.note || ""}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={runQc} className="primary"
                      style={{ flex: 1, display: "inline-flex", alignItems: "center",
                               justifyContent: "center", gap: 6 }}>
                <PlayArrowIcon sx={{ fontSize: 16 }} /> Kjør QC på nytt
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
