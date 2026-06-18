/**
 * ColorAutopilotPanel — scope-analyse + ekte CDL-autopilot for fargekorreksjon.
 *
 * To registry-scripts (bridge-mønster):
 *  1) `analyze_timeline_scopes` — per V1-klipp: hent KILDE-fil + kilde-in
 *     (GetSourceStartFrame/50fps), ekstraher sampleSec via ffmpeg (-ss kilde-tid)
 *     og mål med ÉN ffmpeg-pass: signalstats (YAVG/YMIN/YMAX/UAVG/VAVG/SATMAX) +
 *     ekte RGB-parade via extractplanes (R/G/B-max). Returnerer per-klipp scopes
 *     + flagg (under/over/redClip/greenClip/blueClip/cast/oversat).
 *  2) `color_autopilot` — EKTE pilot: beregn + ANVEND CDL via item.SetCDL på
 *     Node 1 (Primary). Eksponering (slope mot mål-IRE), WB-cast (per-kanal slope
 *     fra U/V-avvik), oversaturasjon (Saturation). Re-måler before/after IRE.
 *
 * Åpnes fra App.tsx via `showColorAutopilot` + CommandPalette «Color Autopilot».
 * Krever et åpent Resolve-prosjekt med aktiv timeline.
 */

import { useEffect, useState } from "react";
import { executeScript, onScriptEvent } from "../api";
import type { ScriptEvent } from "../types";
import { loadSettings } from "./SettingsModal";
import GraphicEqIcon from "@mui/icons-material/GraphicEq";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import ScienceIcon from "@mui/icons-material/Science";
import WarningIcon from "@mui/icons-material/Warning";
import BuildIcon from "@mui/icons-material/Build";
import TuneIcon from "@mui/icons-material/Tune";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import AccountTreeIcon from "@mui/icons-material/AccountTree";

interface Props {
  onClose: () => void;
}

// ─── Resultat-typer (speiler script-kontrakten) ──────────────────────────────

type ScopeFlag =
  | "under"
  | "over"
  | "redClip"
  | "greenClip"
  | "blueClip"
  | "cast"
  | "oversat";

interface ScopeClip {
  index: number;
  timeline: string;
  sourceTC?: string;
  yavg: number;
  ire: number;
  ymax?: number;
  rmax?: number;
  gmax?: number;
  bmax?: number;
  uavg?: number;
  vavg?: number;
  satmax?: number;
  flags: ScopeFlag[];
}

interface AnalyzeResult {
  clips: ScopeClip[];
  summary?: {
    total?: number;
    flagged?: number;
    underexposed?: number;
    overexposed?: number;
    clipped?: number;
    cast?: number;
    oversat?: number;
    note?: string;
  };
}

interface CorrectedClip {
  timeline: string;
  before: number; // IRE
  after: number; // IRE
  what: string[]; // beskrivelse av hva som ble gjort
}

interface AutopilotResult {
  corrected: CorrectedClip[];
  skipped: Array<{ timeline: string; reason?: string }>;
  summary?: {
    correctedCount?: number;
    skippedCount?: number;
    applied?: boolean;
    note?: string;
  };
}

// ─── Flagg-metadata ──────────────────────────────────────────────────────────

const FLAG_META: Record<ScopeFlag, { label: string; color: string }> = {
  under: { label: "Undereksponert", color: "var(--warning)" },
  over: { label: "Overeksponert", color: "var(--warning)" },
  redClip: { label: "Rød-kanal klipper", color: "var(--danger)" },
  greenClip: { label: "Grønn-kanal klipper", color: "var(--danger)" },
  blueClip: { label: "Blå-kanal klipper", color: "var(--danger)" },
  cast: { label: "Fargestikk", color: "var(--accent)" },
  oversat: { label: "Overmettet", color: "var(--accent)" },
};

/**
 * Flagg som NORMALT lar seg auto-korrigere via CDL (eksponering, cast, metning).
 * De resterende krever manuelt arbeid og listes i «Guidet manuell».
 */
const AUTO_FIXABLE: ScopeFlag[] = ["under", "over", "cast", "oversat"];

/** UI-only-flagg → verktøy-anbefaling (per-kanal klipping løses ikke trygt med CDL). */
const MANUAL_GUIDE: Record<string, { title: string; tool: string }> = {
  redClip: {
    title: "Rød-kanal klipper (utbrent rød)",
    tool: "Curves → R-kanal: trekk toppen ned + legg på Soft Clip (Highlight) på Node 1.",
  },
  greenClip: {
    title: "Grønn-kanal klipper",
    tool: "Curves → G-kanal: demp toppen + Soft Clip Highlight.",
  },
  blueClip: {
    title: "Blå-kanal klipper",
    tool: "Curves → B-kanal: demp toppen + Soft Clip Highlight.",
  },
  skin: {
    title: "Hudtone-justering",
    tool: "Color Slice (Hue vs Hue/Sat) eller Magic Mask på person → egen node for hud.",
  },
  dress: {
    title: "Utbrent kjole / lyst plagg",
    tool: "Magic Mask på plagget → ny node → Light/Exposure ned (Gain/Lift) for å hente detalj.",
  },
};

function StatusDot({ color, size = 9 }: { color: string; size?: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        boxShadow: `0 0 5px ${color}`,
        flexShrink: 0,
        display: "inline-block",
      }}
    />
  );
}

function FlagPill({ flag }: { flag: ScopeFlag }) {
  const meta = FLAG_META[flag];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 10,
        fontWeight: 600,
        padding: "2px 7px",
        borderRadius: 10,
        background: "var(--bg-2)",
        border: `1px solid ${meta.color}`,
        color: meta.color,
        whiteSpace: "nowrap",
      }}
    >
      <StatusDot color={meta.color} size={6} />
      {meta.label}
    </span>
  );
}

function ireColor(ire: number): string {
  if (ire < 25) return "var(--warning)";
  if (ire > 75) return "var(--warning)";
  return "var(--success)";
}

export default function ColorAutopilotPanel({ onClose }: Props) {
  // Parametre
  const [strength, setStrength] = useState(60); // 0-100
  const [targetIRE, setTargetIRE] = useState(45); // 35-55
  const [onlyFlagged, setOnlyFlagged] = useState(true);

  // Kjøre-state
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [analysis, setAnalysis] = useState<AnalyzeResult | null>(null);
  const [autopilot, setAutopilot] = useState<AutopilotResult | null>(null);
  const [lastMode, setLastMode] = useState<"analyze" | "apply" | "dry" | null>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [busy, onClose]);

  // ── Analyser scopes ────────────────────────────────────────────────────────
  const runAnalyze = async () => {
    setBusy(true);
    setPct(0);
    setMsg("Analyserer scopes …");
    setError(null);
    setAutopilot(null);
    setLastMode("analyze");
    const unsub = onScriptEvent((ev: ScriptEvent) => {
      if (ev.type === "progress") {
        const p = ev.total ? Math.round(((ev.current ?? 0) / ev.total) * 100) : 0;
        setPct(p);
        setMsg(ev.message || "");
      }
    });
    try {
      const sum = await executeScript(
        "analyze_timeline_scopes",
        { trackIndex: 1, sampleSec: 2 },
        false,
      );
      const r = sum.events.find((e) => e.type === "result");
      const val = r?.value as AnalyzeResult | undefined;
      if (val) setAnalysis(val);
      else setError("Ingen scope-data returnert");
    } catch (err) {
      setError(String(err));
    } finally {
      unsub.then((u) => u());
      setBusy(false);
    }
  };

  // ── Kjør autopilot (apply eller tørrkjør) ───────────────────────────────────
  const runAutopilot = async (apply: boolean) => {
    setBusy(true);
    setPct(0);
    setMsg(apply ? "Korrigerer farger …" : "Beregner (tørrkjør) …");
    setError(null);
    setLastMode(apply ? "apply" : "dry");
    const unsub = onScriptEvent((ev: ScriptEvent) => {
      if (ev.type === "progress") {
        const p = ev.total ? Math.round(((ev.current ?? 0) / ev.total) * 100) : 0;
        setPct(p);
        setMsg(ev.message || "");
      }
    });
    try {
      const sum = await executeScript(
        "color_autopilot",
        {
          strength,
          targetIRE,
          apply,
          nodeIndex: 1,
          onlyFlagged,
        },
        false,
      );
      const r = sum.events.find((e) => e.type === "result");
      const val = r?.value as AutopilotResult | undefined;
      if (val) setAutopilot(val);
      else setError("Ingen autopilot-data returnert");
    } catch (err) {
      setError(String(err));
    } finally {
      unsub.then((u) => u());
      setBusy(false);
    }
  };

  // ── Per-node: kjør / nullstill / toggle ÉN node i .drx-treet ────────────────
  const NODE_LABELS: Record<number, string> = {
    1: "Node 1 — Eksponering & WB",
    2: "Node 2 — LUT / CST",
    3: "Node 3 — Hud (kun ansikt)",
    4: "Node 4 — Vignett & Grain",
  };
  const runNode = async (
    node: number,
    action: "correct" | "reset" | "toggle",
    enabled?: boolean,
  ) => {
    setBusy(true);
    setPct(0);
    setError(null);
    const verb =
      action === "reset"
        ? "Nullstiller"
        : action === "toggle"
          ? enabled
            ? "Slår på"
            : "Slår av"
          : "Korrigerer";
    setMsg(`${verb} ${NODE_LABELS[node] ?? `Node ${node}`} …`);
    setLastMode(action === "correct" ? "apply" : "dry");
    const unsub = onScriptEvent((ev: ScriptEvent) => {
      if (ev.type === "progress") {
        const p = ev.total ? Math.round(((ev.current ?? 0) / ev.total) * 100) : 0;
        setPct(p);
        setMsg(ev.message || "");
      }
    });
    try {
      const params: Record<string, unknown> =
        action === "correct"
          ? { strength, targetIRE, apply: true, nodeIndex: node, onlyFlagged }
          : action === "toggle"
            ? { action: "toggle", nodeIndex: node, enabled: !!enabled }
            : { action: "reset", nodeIndex: node };
      const sum = await executeScript("color_autopilot", params, false);
      const r = sum.events.find((e) => e.type === "result");
      const val = r?.value as (AutopilotResult & { summary?: string }) | undefined;
      if (action === "correct" && val && Array.isArray(val.corrected)) setAutopilot(val);
      setMsg(typeof val?.summary === "string" ? val.summary : "Ferdig.");
    } catch (err) {
      setError(String(err));
    } finally {
      unsub.then((u) => u());
      setBusy(false);
    }
  };

  // ── Legg merkevare-PowerGrade (.drx) på alle klipp — fast default ────────────
  const [drxMissing, setDrxMissing] = useState(false);
  const applyPowergradeAll = async () => {
    const drxPath = loadSettings().BRAND_GRADE_DRX?.trim();
    if (!drxPath) {
      setDrxMissing(true);
      setError("Ingen PowerGrade-.drx satt — legg den inn i Innstillinger (BRAND_GRADE_DRX).");
      return;
    }
    setDrxMissing(false);
    setBusy(true);
    setPct(0);
    setError(null);
    setMsg("Propagerer PowerGrade til alle klipp …");
    setLastMode("apply");
    const unsub = onScriptEvent((ev: ScriptEvent) => {
      if (ev.type === "progress") {
        const p = ev.total ? Math.round(((ev.current ?? 0) / ev.total) * 100) : 0;
        setPct(p);
        setMsg(ev.message || "");
      }
    });
    try {
      const sum = await executeScript("apply_powergrade_all", { drxPath }, false);
      const r = sum.events.find((e) => e.type === "result");
      const val = r?.value as
        | { applied?: number; already?: number; verifiedWithGrade?: number; totalClips?: number }
        | undefined;
      if (val) {
        setMsg(
          `PowerGrade: ${val.applied ?? 0} lagt på · ${val.already ?? 0} allerede · ` +
            `${val.verifiedWithGrade ?? 0}/${val.totalClips ?? 0} verifisert.`,
        );
      }
    } catch (err) {
      setError(String(err));
    } finally {
      unsub.then((u) => u());
      setBusy(false);
    }
  };

  // ── Kjør hele treet: Node 1 → 3 → (Node 4 på) sekvensielt ───────────────────
  const runFullTree = async () => {
    await runNode(1, "correct");
    await runNode(3, "correct");
    await runNode(4, "toggle", true);
  };

  // ── Avledet: hvilke manuelle flagg finnes i analysen ────────────────────────
  const manualFlagsPresent = analysis
    ? Array.from(
        new Set(
          analysis.clips
            .flatMap((c) => c.flags)
            .filter((f) => !AUTO_FIXABLE.includes(f)),
        ),
      )
    : [];

  return (
    <div className="modal-backdrop anim-fade-in" onClick={!busy ? onClose : undefined}>
      <div
        className="modal anim-slide-up"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 820, width: "min(96vw, 820px)", maxHeight: "90vh", overflowY: "auto" }}
      >
        <h2 style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <GraphicEqIcon sx={{ fontSize: 22 }} /> Color Autopilot
        </h2>
        <p style={{ fontSize: 12, opacity: 0.75, marginTop: -4 }}>
          Måler scopes per klipp (luma/IRE, RGB-parade, U/V-cast, metning) og kjører en
          konservativ CDL-autopilot på Node 1 (Primary): eksponering mot mål-IRE, hvitbalanse
          fra fargestikk og demping av overmetning. Per-kanal klipp og hud/plagg løses manuelt.
        </p>

        {/* ── Innstillinger ─────────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 16, marginTop: 14, flexWrap: "wrap" }}>
          <div className="field" style={{ flex: "1 1 260px" }}>
            <label>
              Styrke <span style={{ color: "var(--accent)", fontWeight: 700 }}>{strength}</span>
            </label>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={strength}
              disabled={busy}
              onChange={(e) => setStrength(Number(e.target.value))}
              style={{ width: "100%" }}
            />
            <div style={{ fontSize: 10, opacity: 0.6, marginTop: 2 }}>
              Hvor aggressivt CDL-justeringene skaleres (0 = ingen, 100 = full).
            </div>
          </div>
          <div className="field" style={{ flex: "1 1 260px" }}>
            <label>
              Mål-IRE <span style={{ color: "var(--accent)", fontWeight: 700 }}>{targetIRE}</span>
            </label>
            <input
              type="range"
              min={35}
              max={55}
              step={1}
              value={targetIRE}
              disabled={busy}
              onChange={(e) => setTargetIRE(Number(e.target.value))}
              style={{ width: "100%" }}
            />
            <div style={{ fontSize: 10, opacity: 0.6, marginTop: 2 }}>
              Mål for midttone-luma (IRE). Eksponering løftes/dempes mot dette.
            </div>
          </div>
        </div>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 12,
            fontSize: 12,
            cursor: busy ? "default" : "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={onlyFlagged}
            disabled={busy}
            onChange={(e) => setOnlyFlagged(e.target.checked)}
          />
          <span>
            Kun flaggede klipp
            <span style={{ color: "var(--text-muted)", marginLeft: 6 }}>
              — rør bare klipp som scopen har flagget (konservativt). Skru av for å korrigere alle.
            </span>
          </span>
        </label>

        {/* ── Knapper ───────────────────────────────────────────────────────── */}
        {!busy && (
          <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
            <button
              onClick={runAnalyze}
              style={{
                flex: "1 1 180px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <ScienceIcon sx={{ fontSize: 18 }} /> Analyser scopes
            </button>
            <button
              className="primary"
              onClick={() => runAutopilot(true)}
              style={{
                flex: "1 1 180px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <AutoFixHighIcon sx={{ fontSize: 18 }} /> Kjør autopilot (auto-korriger)
            </button>
            <button
              onClick={() => runAutopilot(false)}
              style={{
                flex: "1 1 180px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <PlayArrowIcon sx={{ fontSize: 18 }} /> Tørrkjør (beregn uten å sette)
            </button>
          </div>
        )}

        {/* ── Fast knapp: legg merkevare-PowerGrade (.drx) på alle klipp ─────── */}
        {!busy && (
          <div style={{ marginTop: 14 }}>
            <button
              className="primary"
              onClick={applyPowergradeAll}
              style={{
                width: "100%",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <AccountTreeIcon sx={{ fontSize: 18 }} /> Legg PowerGrade på alle klipp
            </button>
            <div style={{ fontSize: 10, opacity: 0.55, marginTop: 4, textAlign: "center" }}>
              {drxMissing
                ? "Sett BRAND_GRADE_DRX i Innstillinger først."
                : "Propagerer hele node-treet (BRAND_GRADE_DRX) til alle V1-klipp — merkevare-default."}
            </div>
          </div>
        )}

        {/* ── Per node (én knapp per lag i .drx-treet) ───────────────────────── */}
        {!busy && (
          <div
            style={{
              marginTop: 18,
              padding: 14,
              background: "var(--bg-3)",
              border: "1px solid var(--border)",
              borderRadius: 8,
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 4,
              }}
            >
              <TuneIcon sx={{ fontSize: 18, color: "var(--accent)" }} /> Per node
            </div>
            <p style={{ fontSize: 11, opacity: 0.7, marginTop: 0, marginBottom: 12 }}>
              Styr hvert lag i PowerGrade-treet hver for seg. Hver node har «kjør» og en
              ↺ for å nullstille kun den noden (resten av treet røres ikke).
            </p>

            {/* Node 1 — Eksponering & WB (Primary-CDL) */}
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
              <button
                onClick={() => runNode(1, "correct")}
                style={{ flex: 1, justifyContent: "flex-start", textAlign: "left" }}
              >
                <strong>Node 1</strong> — Eksponering &amp; WB
              </button>
              <button
                onClick={() => runNode(1, "reset")}
                title="Nullstill Node 1 (nøytral CDL)"
                style={{ flexShrink: 0, padding: "0 10px" }}
              >
                <RestartAltIcon sx={{ fontSize: 16 }} />
              </button>
            </div>

            {/* Node 3 — Hud (qualifier-begrenset i .drx) */}
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
              <button
                onClick={() => runNode(3, "correct")}
                style={{ flex: 1, justifyContent: "flex-start", textAlign: "left" }}
              >
                <strong>Node 3</strong> — Hud (kun ansikt)
              </button>
              <button
                onClick={() => runNode(3, "reset")}
                title="Nullstill Node 3"
                style={{ flexShrink: 0, padding: "0 10px" }}
              >
                <RestartAltIcon sx={{ fontSize: 16 }} />
              </button>
            </div>

            {/* Node 4 — Vignett & Grain (på/av-toggle) */}
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
              <span style={{ flex: 1, fontSize: 12 }}>
                <strong>Node 4</strong> — Vignett &amp; Grain
              </span>
              <button onClick={() => runNode(4, "toggle", true)} style={{ flexShrink: 0 }}>
                Slå på
              </button>
              <button onClick={() => runNode(4, "toggle", false)} style={{ flexShrink: 0 }}>
                Slå av
              </button>
            </div>

            {/* Hele treet sekvensielt */}
            <button
              className="primary"
              onClick={runFullTree}
              style={{
                width: "100%",
                marginTop: 6,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <AccountTreeIcon sx={{ fontSize: 18 }} /> Kjør hele treet (Node 1 → 3 → 4)
            </button>

            <p style={{ fontSize: 10, opacity: 0.55, marginTop: 8, marginBottom: 0 }}>
              Node 2 (LUT/CST) settes via .drx-en din — bruk «Legg PowerGrade på alle klipp»
              over for å propagere hele treet på nytt.
            </p>
          </div>
        )}

        {/* ── Progress ──────────────────────────────────────────────────────── */}
        {busy && (
          <div style={{ marginTop: 16 }}>
            <div style={{ height: 6, background: "var(--bg-3)", borderRadius: 3, overflow: "hidden" }}>
              <div
                style={{
                  width: `${pct}%`,
                  height: "100%",
                  background: "var(--accent)",
                  transition: "width 0.3s",
                }}
              />
            </div>
            <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>
              {msg} — {pct}%
            </div>
            <div
              style={{
                fontSize: 11,
                opacity: 0.5,
                marginTop: 8,
                fontStyle: "italic",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <WarningIcon sx={{ fontSize: 14 }} />
              ffmpeg-måling per klipp kan ta litt tid på lange timelines.
            </div>
          </div>
        )}

        {/* ── Feil ──────────────────────────────────────────────────────────── */}
        {error && (
          <div
            style={{
              marginTop: 16,
              background: "var(--bg-3)",
              borderLeft: "3px solid var(--danger)",
              padding: 10,
              borderRadius: 4,
              fontSize: 12,
            }}
          >
            <strong>Feil:</strong> {error}
          </div>
        )}

        {/* ── Autopilot-resultat (before→after) ─────────────────────────────── */}
        {autopilot && !busy && (
          <div style={{ marginTop: 18 }}>
            <div
              style={{
                background:
                  lastMode === "dry" ? "rgba(96, 165, 250, 0.10)" : "rgba(74, 212, 138, 0.10)",
                border: `1px solid ${lastMode === "dry" ? "var(--accent)" : "var(--success)"}`,
                padding: 14,
                borderRadius: 8,
              }}
            >
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {lastMode === "dry" ? (
                  <ScienceIcon sx={{ fontSize: 20, color: "var(--accent)" }} />
                ) : (
                  <AutoFixHighIcon sx={{ fontSize: 20, color: "var(--success)" }} />
                )}
                {lastMode === "dry" ? "Tørrkjør — beregnet (ingenting satt)" : "Autopilot kjørt"}
              </div>
              <div style={{ fontSize: 12, opacity: 0.85, marginTop: 6 }}>
                {autopilot.corrected.length} korrigert · {autopilot.skipped.length} hoppet over
                {autopilot.summary?.note ? ` — ${autopilot.summary.note}` : ""}
              </div>
            </div>

            {autopilot.corrected.length > 0 && (
              <div style={{ marginTop: 12, overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ textAlign: "left", color: "var(--text-dim)" }}>
                      <th style={{ padding: "6px 8px", fontWeight: 600 }}>Klipp (timeline)</th>
                      <th style={{ padding: "6px 8px", fontWeight: 600 }}>IRE før→etter</th>
                      <th style={{ padding: "6px 8px", fontWeight: 600 }}>Hva ble gjort</th>
                    </tr>
                  </thead>
                  <tbody>
                    {autopilot.corrected.map((c, i) => (
                      <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                        <td
                          style={{
                            padding: "6px 8px",
                            fontFamily: "ui-monospace, monospace",
                            color: "var(--accent)",
                          }}
                        >
                          {c.timeline}
                        </td>
                        <td style={{ padding: "6px 8px", fontFamily: "ui-monospace, monospace" }}>
                          <span style={{ color: ireColor(c.before) }}>{c.before.toFixed(0)}</span>
                          <span style={{ opacity: 0.5 }}> → </span>
                          <span style={{ color: ireColor(c.after), fontWeight: 700 }}>
                            {c.after.toFixed(0)}
                          </span>
                        </td>
                        <td style={{ padding: "6px 8px", color: "var(--text-dim)" }}>
                          {c.what.join(" · ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {autopilot.skipped.length > 0 && (
              <div style={{ fontSize: 11, opacity: 0.6, marginTop: 8 }}>
                Hoppet over: {autopilot.skipped.map((s) => s.timeline).join(", ")}
              </div>
            )}
          </div>
        )}

        {/* ── Scope-analyse per klipp ───────────────────────────────────────── */}
        {analysis && !busy && (
          <div style={{ marginTop: 18 }}>
            <div
              style={{
                background: "var(--bg-3)",
                border: "1px solid var(--border)",
                padding: 14,
                borderRadius: 8,
              }}
            >
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <ScienceIcon sx={{ fontSize: 20, color: "var(--accent)" }} /> Scope-analyse
              </div>
              <div style={{ fontSize: 12, opacity: 0.85, marginTop: 6 }}>
                {analysis.summary?.total ?? analysis.clips.length} klipp
                {typeof analysis.summary?.flagged === "number"
                  ? ` · ${analysis.summary.flagged} flagget`
                  : ""}
                {analysis.summary?.note ? ` — ${analysis.summary.note}` : ""}
              </div>
            </div>

            <div style={{ marginTop: 12, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "var(--text-dim)" }}>
                    <th style={{ padding: "6px 8px", fontWeight: 600 }}>#</th>
                    <th style={{ padding: "6px 8px", fontWeight: 600 }}>Timeline</th>
                    <th style={{ padding: "6px 8px", fontWeight: 600 }}>IRE</th>
                    <th style={{ padding: "6px 8px", fontWeight: 600 }}>R/G/B max</th>
                    <th style={{ padding: "6px 8px", fontWeight: 600 }}>Sat</th>
                    <th style={{ padding: "6px 8px", fontWeight: 600 }}>Flagg</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.clips.map((c) => (
                    <tr key={c.index} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={{ padding: "6px 8px", opacity: 0.6 }}>{c.index}</td>
                      <td
                        style={{
                          padding: "6px 8px",
                          fontFamily: "ui-monospace, monospace",
                          color: "var(--accent)",
                        }}
                      >
                        {c.timeline}
                      </td>
                      <td
                        style={{
                          padding: "6px 8px",
                          fontFamily: "ui-monospace, monospace",
                          color: ireColor(c.ire),
                          fontWeight: 600,
                        }}
                      >
                        {c.ire.toFixed(0)}
                      </td>
                      <td
                        style={{
                          padding: "6px 8px",
                          fontFamily: "ui-monospace, monospace",
                          fontSize: 11,
                        }}
                      >
                        <span style={{ color: c.rmax != null && c.rmax >= 253 ? "var(--danger)" : "#e57373" }}>
                          {c.rmax ?? "—"}
                        </span>
                        <span style={{ opacity: 0.4 }}>/</span>
                        <span style={{ color: c.gmax != null && c.gmax >= 253 ? "var(--danger)" : "#81c784" }}>
                          {c.gmax ?? "—"}
                        </span>
                        <span style={{ opacity: 0.4 }}>/</span>
                        <span style={{ color: c.bmax != null && c.bmax >= 253 ? "var(--danger)" : "#64b5f6" }}>
                          {c.bmax ?? "—"}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: "6px 8px",
                          fontFamily: "ui-monospace, monospace",
                          fontSize: 11,
                          opacity: 0.8,
                        }}
                      >
                        {c.satmax ?? "—"}
                      </td>
                      <td style={{ padding: "6px 8px" }}>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {c.flags.length === 0 ? (
                            <span style={{ fontSize: 10, color: "var(--success)" }}>OK</span>
                          ) : (
                            c.flags.map((f) => <FlagPill key={f} flag={f} />)
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Guidet manuell (UI-only-fikser) ───────────────────────────────── */}
        {analysis && !busy && manualFlagsPresent.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
              }}
            >
              <BuildIcon sx={{ fontSize: 18, color: "var(--warning)" }} /> Guidet manuell
            </div>
            <p style={{ fontSize: 11, opacity: 0.7, marginTop: -4, marginBottom: 10 }}>
              Disse løses ikke trygt med CDL-autopilot — gjør dem for hånd i Color-siden:
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {/* Per-kanal klipp fra analyse */}
              {manualFlagsPresent
                .filter((f) => MANUAL_GUIDE[f])
                .map((f) => (
                  <div
                    key={f}
                    style={{
                      background: "var(--bg-3)",
                      border: "1px solid var(--border)",
                      borderLeft: "3px solid var(--warning)",
                      borderRadius: 6,
                      padding: "8px 10px",
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{MANUAL_GUIDE[f].title}</div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 3 }}>
                      {MANUAL_GUIDE[f].tool}
                    </div>
                  </div>
                ))}
              {/* Statiske guider som scopen ikke kan auto-oppdage */}
              {(["skin", "dress"] as const).map((k) => (
                <div
                  key={k}
                  style={{
                    background: "var(--bg-3)",
                    border: "1px solid var(--border)",
                    borderLeft: "3px solid var(--accent)",
                    borderRadius: 6,
                    padding: "8px 10px",
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{MANUAL_GUIDE[k].title}</div>
                  <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 3 }}>
                    {MANUAL_GUIDE[k].tool}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Lukk ──────────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
          <button onClick={onClose} disabled={busy}>
            Lukk
          </button>
        </div>
      </div>
    </div>
  );
}
