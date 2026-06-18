/**
 * AudioMixPanel — Audio Repair + Mix-panel for Role Room Script Manager.
 *
 * Full overlay/modal i Resolve-mørk Role Room-brand (lilla #a030c0).
 * Tre seksjoner:
 *   1. Stemmer — per taler (Mette, Kai): analyse (AI) + reparasjons-knapper
 *      som mapper til vo_repair-moduser. Anbefalte fikser highlightes etter
 *      vo_analyze.
 *   2. Mix-panel — sliders brukeren tweaker selv + "Bygg master" (vo_mix_master).
 *   3. Metering — før/etter (SNR, LUFS, TP) hentet fra script-resultater.
 *
 * Backend via executeScript(id, params, false) fra ../api. Live-progress
 * leses via onScriptEvent ("script-event" Tauri-event).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import CloseIcon from "@mui/icons-material/Close";
import GraphicEqIcon from "@mui/icons-material/GraphicEq";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import TuneIcon from "@mui/icons-material/Tune";
import BuildIcon from "@mui/icons-material/Build";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { executeScript, onScriptEvent } from "../api";
import type { RunSummary, ScriptEvent } from "../types";
import { ROLE_ROOM_BRAND } from "../lib/lowerThirdTypes";

// ─── Props ────────────────────────────────────────────────────────────────

export interface AudioMixPanelProps {
  /** Lukker modalen (App.tsx setShowAudioMixPanel(false)). */
  onClose: () => void;
  /** Valgfri prosjekt-id som sendes til vo_mix_master. */
  projectId?: string;
}

// ─── Delt kontrakt-typer (speiler script-resultatene) ───────────────────────

type RepairMode =
  | "auto"
  | "denoise"
  | "level"
  | "deartifact"
  | "deess"
  | "warmth"
  | "dewind";

type RecommendKey = "level" | "denoise" | "deartifact" | "deess" | "warmth" | "dewind";

interface AnalyzeClip {
  path: string;
  noiseDb: number;
  snrDb: number;
  lufs: number;
  peakDb: number;
  issues: string[];
  recommended: RecommendKey[];
}

interface AnalyzeResult {
  clips: AnalyzeClip[];
}

interface RepairMeter {
  noiseDb: number;
  snrDb: number;
  lufs: number;
}

interface RepairResult {
  outputPath: string;
  mode: RepairMode;
  before: RepairMeter;
  after: RepairMeter;
}

interface MasterResult {
  masterPath: string;
  lufs: number;
  truePeak: number;
  lra: number;
  placed: boolean;
}

// ─── Lokal taler-modell ─────────────────────────────────────────────────────

interface Speaker {
  id: string;
  name: string;
  /** Innspilt VO-fil (wav) for taleren. */
  inputPath: string | null;
  /** Sist analyserte klipp (issues + recommended + meter). */
  analysis: AnalyzeClip | null;
  /** Sist reparerte resultat (before/after meter). */
  lastRepair: RepairResult | null;
  /** Plassering i tidslinje (sek) — brukes ved master-bygg. */
  startSec: number;
}

const INITIAL_SPEAKERS: Speaker[] = [
  { id: "mette", name: "Mette", inputPath: null, analysis: null, lastRepair: null, startSec: 0 },
  { id: "kai", name: "Kai", inputPath: null, analysis: null, lastRepair: null, startSec: 0 },
];

// ─── Reparasjons-knapper (matcher Daniels diagnoser → vo_repair-moduser) ─────

interface RepairButtonDef {
  mode: RepairMode;
  label: string;
  /** Hvilken recommended-nøkkel som highlighter denne knappen. */
  recKey?: RecommendKey;
}

const REPAIR_BUTTONS: RepairButtonDef[] = [
  { mode: "level", label: "For lav / ujevn", recKey: "level" },
  { mode: "denoise", label: "Fortsatt støy / sus / rumling", recKey: "denoise" },
  { mode: "deartifact", label: "Robotisk / vassen", recKey: "deartifact" },
  { mode: "dewind", label: "Vind / blåsing", recKey: "dewind" },
  { mode: "deess", label: "De-ess", recKey: "deess" },
  { mode: "warmth", label: "Varme", recKey: "warmth" },
  { mode: "auto", label: "Auto (AI)" },
];

// ─── Mix-slider-modell ──────────────────────────────────────────────────────

interface MixSettings {
  voLevelDb: number;
  duckDepthDb: number;
  duckReleaseMs: number;
  warmthDb: number;
  presenceDb: number;
  airDb: number;
  loudnessTarget: number;
  truePeak: number;
}

const DEFAULT_MIX: MixSettings = {
  voLevelDb: 0,
  duckDepthDb: 12,
  duckReleaseMs: 450,
  warmthDb: 0,
  presenceDb: 0,
  airDb: 0,
  loudnessTarget: -16,
  truePeak: -2,
};

// ─── Hjelp: les result-payload fra RunSummary ────────────────────────────────

function readResult<T>(summary: RunSummary): T | undefined {
  const ev = summary.events.find((e) => e.type === "result");
  if (ev?.value && typeof ev.value === "object") return ev.value as T;
  return undefined;
}

function outputPathFor(inputPath: string, mode: RepairMode): string {
  const dot = inputPath.lastIndexOf(".");
  const base = dot > 0 ? inputPath.slice(0, dot) : inputPath;
  const ext = dot > 0 ? inputPath.slice(dot) : ".wav";
  return `${base}__${mode}${ext}`;
}

function fmtDb(v: number | undefined): string {
  return v === undefined || Number.isNaN(v) ? "–" : `${v.toFixed(1)} dB`;
}
function fmtLufs(v: number | undefined): string {
  return v === undefined || Number.isNaN(v) ? "–" : `${v.toFixed(1)} LUFS`;
}

// ─── Gjenbrukbar slider-rad (RangeRow-mønster) ──────────────────────────────

function RangeRow({
  label,
  min,
  max,
  step,
  value,
  unit,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 6,
        fontSize: 11,
        color: ROLE_ROOM_BRAND.textSecondary,
      }}
    >
      <span style={{ minWidth: 116 }}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ flex: 1, accentColor: ROLE_ROOM_BRAND.primaryLila }}
      />
      <span
        style={{
          minWidth: 64,
          textAlign: "right",
          color: ROLE_ROOM_BRAND.textPrimary,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
        {unit ? ` ${unit}` : ""}
      </span>
    </div>
  );
}

// ─── Metering-rad (før/etter) ───────────────────────────────────────────────

function MeterStat({ label, before, after }: { label: string; before: string; after: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 11 }}>
      <span style={{ minWidth: 48, color: ROLE_ROOM_BRAND.textTertiary }}>{label}</span>
      <span style={{ color: ROLE_ROOM_BRAND.textSecondary, minWidth: 78 }}>{before}</span>
      <span style={{ color: ROLE_ROOM_BRAND.textTertiary }}>→</span>
      <span style={{ color: ROLE_ROOM_BRAND.primaryLila, fontWeight: 600 }}>{after}</span>
    </div>
  );
}

// ─── Shared inline-styles ───────────────────────────────────────────────────

const cardSx: React.CSSProperties = {
  background: ROLE_ROOM_BRAND.surfaceGradient,
  border: "1px solid rgba(160,48,192,0.20)",
  borderRadius: 8,
  padding: 14,
};

const sectionTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: ROLE_ROOM_BRAND.textPrimary,
  margin: "0 0 10px",
  display: "flex",
  alignItems: "center",
  gap: 6,
};

const buttonSecondary: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(160,48,192,0.40)",
  color: ROLE_ROOM_BRAND.textPrimary,
  padding: "6px 10px",
  fontSize: 11,
  fontWeight: 600,
  borderRadius: 4,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
};

// ─── Hovedkomponent ─────────────────────────────────────────────────────────

export default function AudioMixPanel({ onClose, projectId }: AudioMixPanelProps) {
  const [speakers, setSpeakers] = useState<Speaker[]>(INITIAL_SPEAKERS);
  const [mix, setMix] = useState<MixSettings>(DEFAULT_MIX);
  const [strength, setStrength] = useState(60);
  const [wetDry, setWetDry] = useState(85);
  const [referencePath, setReferencePath] = useState<string | null>(null);

  // Felles musikk/vignette for master
  const [musicPath, setMusicPath] = useState<string | null>(null);
  const [vignettePath, setVignettePath] = useState<string | null>(null);
  const [master, setMaster] = useState<MasterResult | null>(null);

  // Busy + live-progress
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ percent: number; label: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Map runId → om vi følger den. Vi viser bare nyeste aktive run-progress.
  const activeRunId = useRef<string | null>(null);

  // ── Live-progress via onScriptEvent ──
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    onScriptEvent((event: ScriptEvent) => {
      if (event.type === "started") {
        activeRunId.current = event.runId;
        setProgress({ percent: 0, label: event.label ?? "Starter …" });
      } else if (event.type === "progress" && event.runId === activeRunId.current) {
        setProgress({
          percent: typeof event.percent === "number" ? event.percent : 0,
          label: event.label ?? "Arbeider …",
        });
      } else if (event.type === "finished" && event.runId === activeRunId.current) {
        activeRunId.current = null;
        setProgress(null);
      }
    })
      .then((u) => {
        unlisten = u;
      })
      .catch(() => {
        /* ignore listener setup-feil */
      });
    return () => {
      unlisten?.();
    };
  }, []);

  // ── Generisk kjøre-wrapper ──
  const runScript = useCallback(
    async <T,>(
      scriptId: string,
      params: Record<string, unknown>,
      busyLabel: string,
    ): Promise<T | undefined> => {
      setBusy(busyLabel);
      setError(null);
      try {
        const summary = await executeScript(scriptId, params, false);
        if (!summary.succeeded) {
          const errEv = summary.events.find((e) => e.type === "error");
          setError(errEv?.message ?? `${scriptId} feilet (exit ${summary.exit_code ?? "?"}).`);
          return undefined;
        }
        return readResult<T>(summary);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return undefined;
      } finally {
        setBusy(null);
        setProgress(null);
      }
    },
    [],
  );

  // ── Patch en taler ──
  const patchSpeaker = useCallback((id: string, patch: Partial<Speaker>) => {
    setSpeakers((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  // ── Filvalg ──
  const pickWav = useCallback(async (): Promise<string | null> => {
    const sel = await openDialog({
      multiple: false,
      filters: [{ name: "Audio", extensions: ["wav", "aif", "aiff", "flac", "mp3"] }],
    });
    return typeof sel === "string" ? sel : null;
  }, []);

  // ── Analyse (AI) for én taler ──
  const handleAnalyze = useCallback(
    async (sp: Speaker) => {
      if (!sp.inputPath) {
        setError(`Velg en lydfil for ${sp.name} først.`);
        return;
      }
      const res = await runScript<AnalyzeResult>(
        "vo_analyze",
        {
          inputs: [sp.inputPath],
          ...(referencePath ? { referencePath } : {}),
        },
        `Analyserer ${sp.name} …`,
      );
      const clip = res?.clips?.[0];
      if (clip) patchSpeaker(sp.id, { analysis: clip });
    },
    [runScript, patchSpeaker, referencePath],
  );

  // ── Reparasjon for én taler/modus ──
  const handleRepair = useCallback(
    async (sp: Speaker, mode: RepairMode) => {
      if (!sp.inputPath) {
        setError(`Velg en lydfil for ${sp.name} først.`);
        return;
      }
      const outputPath = outputPathFor(sp.inputPath, mode);
      const res = await runScript<RepairResult>(
        "vo_repair",
        {
          inputPath: sp.inputPath,
          outputPath,
          mode,
          strength,
          wetDry,
          ...(referencePath ? { referencePath } : {}),
        },
        `Reparerer ${sp.name} (${mode}) …`,
      );
      if (res) patchSpeaker(sp.id, { lastRepair: res });
    },
    [runScript, patchSpeaker, strength, wetDry, referencePath],
  );

  // ── Bygg master ──
  const handleBuildMaster = useCallback(
    async (placeInResolve: boolean) => {
      if (!musicPath) {
        setError("Velg en musikk-fil for masteren først.");
        return;
      }
      const voClips = speakers
        .map((s) => {
          // Bruk reparert versjon hvis den finnes, ellers råfilen.
          const path = s.lastRepair?.outputPath ?? s.inputPath;
          return path ? { path, startSec: s.startSec, speaker: s.name } : null;
        })
        .filter((c): c is { path: string; startSec: number; speaker: string } => c !== null);

      if (voClips.length === 0) {
        setError("Ingen VO-klipp valgt — velg minst én talers lydfil.");
        return;
      }

      const res = await runScript<MasterResult>(
        "vo_mix_master",
        {
          projectId: projectId ?? "audio-mix-panel",
          voClips,
          musicPath,
          ...(vignettePath ? { vignettePath } : {}),
          voLevelDb: mix.voLevelDb,
          duckDepthDb: mix.duckDepthDb,
          duckReleaseMs: mix.duckReleaseMs,
          warmthDb: mix.warmthDb,
          presenceDb: mix.presenceDb,
          airDb: mix.airDb,
          loudnessTarget: mix.loudnessTarget,
          truePeak: mix.truePeak,
          timelineName: "Audio Mix Master",
          placeInResolve,
        },
        placeInResolve ? "Bygger master + plasserer i Resolve …" : "Bygger master …",
      );
      if (res) setMaster(res);
    },
    [runScript, speakers, musicPath, vignettePath, mix, projectId],
  );

  const updateMix = useCallback((patch: Partial<MixSettings>) => {
    setMix((prev) => ({ ...prev, ...patch }));
  }, []);

  // ── Render ──
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 5800,
        background: "rgba(8,4,20,0.92)",
        backdropFilter: "blur(10px)",
        display: "flex",
        flexDirection: "column",
        color: ROLE_ROOM_BRAND.textPrimary,
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      {/* Header */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: ROLE_ROOM_BRAND.surfaceGradient,
          borderBottom: "1px solid rgba(160,48,192,0.20)",
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 18px",
        }}
      >
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            background: ROLE_ROOM_BRAND.signatureGradient,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <GraphicEqIcon sx={{ fontSize: 20, color: "#fff" }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Audio Repair + Mix</div>
          <div style={{ fontSize: 11, color: ROLE_ROOM_BRAND.textTertiary }}>
            Reparér stemmer, dukk musikk og bygg en mastret miks
          </div>
        </div>
        {busy && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 11,
              color: ROLE_ROOM_BRAND.textSecondary,
            }}
          >
            <span>{busy}</span>
            {progress && (
              <span style={{ color: ROLE_ROOM_BRAND.primaryLila, fontWeight: 600 }}>
                {Math.round(progress.percent)}%
              </span>
            )}
          </div>
        )}
        <button
          onClick={onClose}
          aria-label="Lukk"
          style={{
            background: "transparent",
            border: 0,
            color: ROLE_ROOM_BRAND.textSecondary,
            cursor: "pointer",
            display: "inline-flex",
            padding: 4,
          }}
        >
          <CloseIcon sx={{ fontSize: 20 }} />
        </button>
      </div>

      {/* Progress-bar */}
      {progress && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ height: 3, background: "rgba(160,48,192,0.15)" }}
        >
          <div
            style={{
              height: "100%",
              width: `${Math.max(0, Math.min(100, progress.percent))}%`,
              background: ROLE_ROOM_BRAND.signatureGradient,
              transition: "width 0.2s ease",
            }}
          />
        </div>
      )}

      {/* Body */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ flex: 1, overflowY: "auto", padding: 18 }}
      >
        {error && (
          <div
            style={{
              background: "rgba(239,79,111,0.15)",
              border: "1px solid rgba(239,79,111,0.35)",
              color: "#ef4f6f",
              borderRadius: 6,
              padding: "8px 12px",
              fontSize: 12,
              marginBottom: 14,
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(380px, 1fr) minmax(360px, 460px)",
            gap: 18,
            alignItems: "start",
          }}
        >
          {/* ─── Venstre kolonne: Stemmer ─── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={cardSx}>
              <h3 style={sectionTitle}>
                <TuneIcon sx={{ fontSize: 16, color: ROLE_ROOM_BRAND.primaryLila }} />
                Reparasjons-styrke
              </h3>
              <RangeRow
                label="Styrke"
                min={0}
                max={100}
                step={1}
                value={strength}
                unit="%"
                onChange={setStrength}
              />
              <RangeRow
                label="Wet / Dry"
                min={0}
                max={100}
                step={1}
                value={wetDry}
                unit="%"
                onChange={setWetDry}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                <button
                  style={buttonSecondary}
                  disabled={!!busy}
                  onClick={async () => {
                    const p = await pickWav();
                    if (p) setReferencePath(p);
                  }}
                >
                  <FolderOpenIcon sx={{ fontSize: 13 }} />
                  Referanse-stemme
                </button>
                <span
                  style={{
                    fontSize: 10.5,
                    color: ROLE_ROOM_BRAND.textTertiary,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={referencePath ?? ""}
                >
                  {referencePath ? referencePath.split("/").pop() : "ingen referanse"}
                </span>
              </div>
            </div>

            {speakers.map((sp) => (
              <SpeakerCard
                key={sp.id}
                speaker={sp}
                busy={!!busy}
                onPickFile={async () => {
                  const p = await pickWav();
                  if (p) patchSpeaker(sp.id, { inputPath: p });
                }}
                onAnalyze={() => void handleAnalyze(sp)}
                onRepair={(mode) => void handleRepair(sp, mode)}
              />
            ))}
          </div>

          {/* ─── Høyre kolonne: Mix-panel + master + metering ─── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={cardSx}>
              <h3 style={sectionTitle}>
                <TuneIcon sx={{ fontSize: 16, color: ROLE_ROOM_BRAND.primaryLila }} />
                Mix-panel
              </h3>
              <RangeRow
                label="VO-nivå"
                min={-12}
                max={12}
                step={0.5}
                value={mix.voLevelDb}
                unit="dB"
                onChange={(v) => updateMix({ voLevelDb: v })}
              />
              <RangeRow
                label="Duck-dybde"
                min={0}
                max={24}
                step={0.5}
                value={mix.duckDepthDb}
                unit="dB"
                onChange={(v) => updateMix({ duckDepthDb: v })}
              />
              <RangeRow
                label="Duck-release"
                min={50}
                max={1200}
                step={10}
                value={mix.duckReleaseMs}
                unit="ms"
                onChange={(v) => updateMix({ duckReleaseMs: v })}
              />
              <RangeRow
                label="Varme"
                min={-6}
                max={6}
                step={0.5}
                value={mix.warmthDb}
                unit="dB"
                onChange={(v) => updateMix({ warmthDb: v })}
              />
              <RangeRow
                label="Presence"
                min={-6}
                max={6}
                step={0.5}
                value={mix.presenceDb}
                unit="dB"
                onChange={(v) => updateMix({ presenceDb: v })}
              />
              <RangeRow
                label="Luft"
                min={-6}
                max={6}
                step={0.5}
                value={mix.airDb}
                unit="dB"
                onChange={(v) => updateMix({ airDb: v })}
              />
              <RangeRow
                label="Loudness-mål"
                min={-27}
                max={-12}
                step={0.5}
                value={mix.loudnessTarget}
                unit="LUFS"
                onChange={(v) => updateMix({ loudnessTarget: v })}
              />
              <RangeRow
                label="True Peak"
                min={-6}
                max={0}
                step={0.1}
                value={mix.truePeak}
                unit="dBTP"
                onChange={(v) => updateMix({ truePeak: v })}
              />

              {/* Musikk / vignette filvalg */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
                <FilePickRow
                  label="Musikk"
                  path={musicPath}
                  busy={!!busy}
                  onPick={async () => {
                    const p = await pickWav();
                    if (p) setMusicPath(p);
                  }}
                />
                <FilePickRow
                  label="Vignett"
                  path={vignettePath}
                  busy={!!busy}
                  onPick={async () => {
                    const p = await pickWav();
                    if (p) setVignettePath(p);
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button
                  onClick={() => void handleBuildMaster(false)}
                  disabled={!!busy || !musicPath}
                  style={{
                    flex: 1,
                    background: busy
                      ? "rgba(110,63,199,0.20)"
                      : ROLE_ROOM_BRAND.signatureGradient,
                    border: 0,
                    color: "#fff",
                    padding: "9px 14px",
                    fontSize: 12,
                    fontWeight: 700,
                    borderRadius: 4,
                    cursor: busy ? "wait" : !musicPath ? "not-allowed" : "pointer",
                    opacity: !musicPath ? 0.4 : 1,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  <BuildIcon sx={{ fontSize: 14 }} />
                  Bygg master
                </button>
                <button
                  onClick={() => void handleBuildMaster(true)}
                  disabled={!!busy || !musicPath}
                  style={{
                    ...buttonSecondary,
                    opacity: !musicPath ? 0.4 : 1,
                    cursor: busy ? "wait" : !musicPath ? "not-allowed" : "pointer",
                  }}
                >
                  + plasser i Resolve
                </button>
              </div>
            </div>

            {/* Master-resultat + metering */}
            <div style={cardSx}>
              <h3 style={sectionTitle}>
                <GraphicEqIcon sx={{ fontSize: 16, color: ROLE_ROOM_BRAND.primaryLila }} />
                Master-metering
              </h3>
              {master ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", gap: 18, fontSize: 11 }}>
                    <span>
                      <span style={{ color: ROLE_ROOM_BRAND.textTertiary }}>LUFS </span>
                      <strong style={{ color: ROLE_ROOM_BRAND.primaryLila }}>
                        {master.lufs.toFixed(1)}
                      </strong>
                    </span>
                    <span>
                      <span style={{ color: ROLE_ROOM_BRAND.textTertiary }}>TP </span>
                      <strong style={{ color: ROLE_ROOM_BRAND.primaryLila }}>
                        {master.truePeak.toFixed(1)} dBTP
                      </strong>
                    </span>
                    <span>
                      <span style={{ color: ROLE_ROOM_BRAND.textTertiary }}>LRA </span>
                      <strong style={{ color: ROLE_ROOM_BRAND.primaryLila }}>
                        {master.lra.toFixed(1)}
                      </strong>
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 10.5,
                      color: ROLE_ROOM_BRAND.textTertiary,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={master.masterPath}
                  >
                    {master.masterPath}
                  </div>
                  {master.placed && (
                    <div style={{ fontSize: 11, color: "#4ad48a" }}>
                      Plassert i Resolve-tidslinje.
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: 11.5, color: ROLE_ROOM_BRAND.textTertiary }}>
                  Bygg masteren for å se LUFS / True Peak / LRA.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub: filvalg-rad ───────────────────────────────────────────────────────

function FilePickRow({
  label,
  path,
  busy,
  onPick,
}: {
  label: string;
  path: string | null;
  busy: boolean;
  onPick: () => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <button style={{ ...buttonSecondary, minWidth: 92 }} disabled={busy} onClick={onPick}>
        <FolderOpenIcon sx={{ fontSize: 13 }} />
        {label}
      </button>
      <span
        style={{
          fontSize: 10.5,
          color: ROLE_ROOM_BRAND.textTertiary,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={path ?? ""}
      >
        {path ? path.split("/").pop() : "ingen fil"}
      </span>
    </div>
  );
}

// ─── Sub: taler-kort ────────────────────────────────────────────────────────

function SpeakerCard({
  speaker,
  busy,
  onPickFile,
  onAnalyze,
  onRepair,
}: {
  speaker: Speaker;
  busy: boolean;
  onPickFile: () => void;
  onAnalyze: () => void;
  onRepair: (mode: RepairMode) => void;
}) {
  const { analysis, lastRepair } = speaker;
  const recommended = analysis?.recommended ?? [];

  return (
    <div style={cardSx}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <h3 style={{ ...sectionTitle, margin: 0, flex: 1 }}>{speaker.name}</h3>
        <button style={buttonSecondary} disabled={busy} onClick={onPickFile}>
          <FolderOpenIcon sx={{ fontSize: 13 }} />
          {speaker.inputPath ? "Bytt fil" : "Velg fil"}
        </button>
        <button
          onClick={onAnalyze}
          disabled={busy || !speaker.inputPath}
          style={{
            background: ROLE_ROOM_BRAND.signatureGradient,
            border: 0,
            color: "#fff",
            padding: "6px 11px",
            fontSize: 11,
            fontWeight: 600,
            borderRadius: 4,
            cursor: busy ? "wait" : !speaker.inputPath ? "not-allowed" : "pointer",
            opacity: !speaker.inputPath ? 0.4 : 1,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <AutoAwesomeIcon sx={{ fontSize: 13 }} />
          Analyser (AI)
        </button>
      </div>

      {speaker.inputPath && (
        <div
          style={{
            fontSize: 10.5,
            color: ROLE_ROOM_BRAND.textTertiary,
            marginBottom: 8,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={speaker.inputPath}
        >
          {speaker.inputPath.split("/").pop()}
        </div>
      )}

      {/* Issues + anbefalinger fra analyse */}
      {analysis && (
        <div style={{ marginBottom: 10 }}>
          {analysis.issues.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
              {analysis.issues.map((iss, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: 10,
                    background: "rgba(240,165,0,0.15)",
                    border: "1px solid rgba(240,165,0,0.35)",
                    color: "#f0a500",
                    padding: "2px 7px",
                    borderRadius: 10,
                  }}
                >
                  {iss}
                </span>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: "#4ad48a", marginBottom: 6 }}>
              Ingen tydelige problemer funnet.
            </div>
          )}
          <div
            style={{
              display: "flex",
              gap: 12,
              fontSize: 10.5,
              color: ROLE_ROOM_BRAND.textSecondary,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <span>SNR {fmtDb(analysis.snrDb)}</span>
            <span>Støy {fmtDb(analysis.noiseDb)}</span>
            <span>{fmtLufs(analysis.lufs)}</span>
            <span>Peak {fmtDb(analysis.peakDb)}</span>
          </div>
        </div>
      )}

      {/* Reparasjons-knapper — highlight de anbefalte */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {REPAIR_BUTTONS.map((btn) => {
          const isRecommended = btn.recKey ? recommended.includes(btn.recKey) : false;
          const isAuto = btn.mode === "auto";
          return (
            <button
              key={btn.mode}
              onClick={() => onRepair(btn.mode)}
              disabled={busy || !speaker.inputPath}
              title={isRecommended ? "Anbefalt av AI-analysen" : undefined}
              style={{
                background: isRecommended
                  ? ROLE_ROOM_BRAND.signatureGradient
                  : isAuto
                    ? "rgba(110,63,199,0.22)"
                    : "rgba(255,255,255,0.06)",
                border: isRecommended
                  ? "1px solid transparent"
                  : "1px solid rgba(160,48,192,0.40)",
                boxShadow: isRecommended ? "0 0 0 1px rgba(160,48,192,0.6)" : undefined,
                color: isRecommended ? "#fff" : ROLE_ROOM_BRAND.textPrimary,
                padding: "5px 10px",
                fontSize: 11,
                fontWeight: isRecommended ? 700 : 600,
                borderRadius: 4,
                cursor: busy ? "wait" : !speaker.inputPath ? "not-allowed" : "pointer",
                opacity: !speaker.inputPath ? 0.45 : 1,
              }}
            >
              {btn.label}
              {isRecommended ? " ★" : ""}
            </button>
          );
        })}
      </div>

      {/* Før/etter-metering fra siste reparasjon */}
      {lastRepair && (
        <div
          style={{
            marginTop: 10,
            paddingTop: 10,
            borderTop: "1px solid rgba(160,48,192,0.18)",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <div style={{ fontSize: 10.5, color: ROLE_ROOM_BRAND.textTertiary, marginBottom: 2 }}>
            Siste reparasjon: {lastRepair.mode}
          </div>
          <MeterStat
            label="SNR"
            before={fmtDb(lastRepair.before.snrDb)}
            after={fmtDb(lastRepair.after.snrDb)}
          />
          <MeterStat
            label="Støy"
            before={fmtDb(lastRepair.before.noiseDb)}
            after={fmtDb(lastRepair.after.noiseDb)}
          />
          <MeterStat
            label="LUFS"
            before={fmtLufs(lastRepair.before.lufs)}
            after={fmtLufs(lastRepair.after.lufs)}
          />
          <div
            style={{
              fontSize: 10,
              color: ROLE_ROOM_BRAND.textTertiary,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={lastRepair.outputPath}
          >
            → {lastRepair.outputPath.split("/").pop()}
          </div>
        </div>
      )}
    </div>
  );
}
