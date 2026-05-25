/**
 * RoleRoomProjectSync — minimal end-to-end test surface for the Role Room
 * API consumers. Lists the signed-in user's productions, lets them pick one,
 * and shows the live counts of scenes/equipment/clips fetched from the
 * Post Agent backend.
 *
 * This is the seam where future features hook in:
 *  - Click "Create bins from scenes" → call Python script with scenes JSON
 *  - Click "Apply project settings" → set Resolve resolution/fps from equipment
 *  - Click "Ingest captured clips" → import live-set clips with scene metadata
 */

import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  executeScript,
  fetchClipDownloadUrls,
  fetchMyProductions,
  fetchRoleRoomScenes,
  fetchRoleRoomEquipment,
  fetchRoleRoomLiveSetState,
  downloadClip,
  probeMediaFiles,
  type RoleRoomProduction,
  type RoleRoomScene,
  type RoleRoomEquipment,
  type RoleRoomProjectSettings,
  type RoleRoomClip,
  type ProbeSummary,
} from "../api";
import type { MountedCard } from "../types";
import { WeddingPipeline, isWeddingProjectType } from "./WeddingPipeline";

interface ProjectContext {
  scenes: RoleRoomScene[];
  equipment: RoleRoomEquipment[];
  projectSettings: RoleRoomProjectSettings | null;
  clips: RoleRoomClip[];
}

type ProjectSyncShotPlan = {
  index: number;
  time: number;
  durationSeconds?: number;
  motionScore?: number | null;
  name: string;
};

function classifyExpectedStandard(fps: number | null | undefined): string | null {
  if (fps == null) return null;
  if (Math.abs(fps - 25) < 0.02 || Math.abs(fps - 50) < 0.02) return "PAL";
  if (Math.abs(fps - 29.97) < 0.05 || Math.abs(fps - 30) < 0.02 || Math.abs(fps - 59.94) < 0.05 || Math.abs(fps - 60) < 0.02) return "NTSC";
  if (Math.abs(fps - 23.976) < 0.05 || Math.abs(fps - 24) < 0.02) return "Cinema";
  return null;
}

export function RoleRoomProjectSync() {
  const [productions, setProductions] = useState<RoleRoomProduction[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [context, setContext] = useState<ProjectContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [probing, setProbing] = useState(false);
  const [probeResult, setProbeResult] = useState<ProbeSummary | null>(null);
  const [creatingBins, setCreatingBins] = useState(false);
  const [binResult, setBinResult] = useState<{ created: string[]; skipped: string[]; failed: number } | null>(null);
  const [applyingSettings, setApplyingSettings] = useState(false);
  const [settingsResult, setSettingsResult] = useState<{ applied: number; skipped: number; failed: number } | null>(null);
  const [ingesting, setIngesting] = useState(false);
  const [ingestProgress, setIngestProgress] = useState<{ done: number; total: number; phase: string } | null>(null);
  const [ingestResult, setIngestResult] = useState<{ imported: number; failed: number; binsCreated: number } | null>(null);

  // Analyze finished/exported video
  const [analyzePath, setAnalyzePath] = useState<string>("");
  const [analyzeThreshold, setAnalyzeThreshold] = useState<number>(0.4);
  const [analyzeNarrate, setAnalyzeNarrate] = useState<boolean>(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeResult, setAnalyzeResult] = useState<{
    cuts: number;
    markersAdded: number;
    timelineName: string;
    samplePlan?: Array<{ index: number; time: number; durationSeconds?: number; motionScore?: number | null; name: string }>;
  } | null>(null);

  // Source-matching state
  const [sourceFolders, setSourceFolders] = useState<string[]>([]);
  const [sourceSongPath, setSourceSongPath] = useState<string | null>(null);
  const [matching, setMatching] = useState(false);
  const [matchResult, setMatchResult] = useState<{
    sourceCount: number;
    sourceFrameCount: number;
    confidenceBreakdown: { high?: number; medium?: number; low?: number; none?: number };
    matches: Array<{
      shotIndex: number;
      shotTime: number;
      sourceFile: string | null;
      sourceTime: number | null;
      hashDistance: number | null;
      confidence: "high" | "medium" | "low" | "none";
    }>;
  } | null>(null);

  async function pickSourceFolder() {
    try {
      const { open: openDialog } = await import("@tauri-apps/plugin-dialog");
      const selected = await openDialog({ multiple: false, directory: true });
      if (typeof selected === "string" && selected && !sourceFolders.includes(selected)) {
        setSourceFolders([...sourceFolders, selected]);
        setMatchResult(null);
      }
    } catch (e) {
      console.warn("folder picker failed", e);
    }
  }

  async function runMatchShotsToSource() {
    if (!analyzePath || sourceFolders.length === 0) return;
    setMatching(true);
    setMatchResult(null);
    setError(null);
    try {
      const summary = await executeScript(
        "match_shots_to_source",
        {
          editedVideoPath: analyzePath,
          sourceFolders,
          sceneThreshold: analyzeThreshold,
        },
        false,
      );
      const r = summary.events.find((e) => e.type === "result")?.value as
        | {
            sourceCount?: number;
            sourceFrameCount?: number;
            confidenceBreakdown?: Record<string, number>;
            matches?: unknown[];
          }
        | undefined;
      const err = summary.events.find((e) => e.type === "error")?.value as { message?: string } | undefined;
      if (err?.message) {
        setError(err.message);
        return;
      }
      setMatchResult({
        sourceCount: r?.sourceCount || 0,
        sourceFrameCount: r?.sourceFrameCount || 0,
        confidenceBreakdown: r?.confidenceBreakdown || {},
        matches: (r?.matches || []) as typeof matchResult extends infer T
          ? T extends { matches: infer M }
            ? M
            : never
          : never,
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setMatching(false);
    }
  }

  async function pickAnalyzeFile() {
    try {
      const { open: openDialog } = await import("@tauri-apps/plugin-dialog");
      const selected = await openDialog({
        multiple: false,
        directory: false,
        filters: [{ name: "Video", extensions: ["mp4", "mov", "mxf", "mkv", "m4v"] }],
      });
      if (typeof selected === "string" && selected) {
        setAnalyzePath(selected);
        setAnalyzeResult(null);
      }
    } catch (e) {
      console.warn("file picker failed", e);
    }
  }

  async function runAnalyzeExportedVideo() {
    if (!analyzePath) return;
    setAnalyzing(true);
    setAnalyzeResult(null);
    setError(null);
    try {
      const summary = await executeScript(
        "analyze_exported_video",
        {
          videoPath: analyzePath,
          sceneThreshold: analyzeThreshold,
          narrate: analyzeNarrate,
          // If a YouTube source-song has been fetched via WeddingPipeline,
          // pass its path so analyzer uses pristine beat-grid + auto-align
          // instead of detecting beats from the mixed video audio.
          ...(sourceSongPath ? { sourceSongPath } : {}),
        },
        false,
      );
      const r = summary.events.find((e) => e.type === "result")?.value as
        | { cutCount?: number; markersAdded?: number; timelineName?: string; samplePlan?: unknown[] }
        | undefined;
      const err = summary.events.find((e) => e.type === "error")?.value as { message?: string } | undefined;
      if (err?.message) {
        setError(err.message);
        return;
      }
      setAnalyzeResult({
        cuts: r?.cutCount || 0,
        markersAdded: r?.markersAdded || 0,
        timelineName: r?.timelineName || "(unnamed)",
        samplePlan: r?.samplePlan as ProjectSyncShotPlan[] | undefined,
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAnalyzing(false);
    }
  }

  async function ingestCapturedClips() {
    if (!context || context.clips.length === 0 || !selected) return;
    setIngesting(true);
    setIngestProgress({ done: 0, total: context.clips.length, phase: "Henter download-URLs…" });
    setIngestResult(null);
    setError(null);
    try {
      // Step 1: get presigned URLs from backend
      const clipIds = context.clips.map((c) => c.id);
      const { urls } = await fetchClipDownloadUrls(selected, clipIds);
      const usable = urls.filter((u) => u.downloadUrl);
      if (usable.length === 0) {
        setError("Ingen klipp har gyldig download-URL. Sjekk at R2-konfigurasjon er aktiv på backend.");
        setIngesting(false);
        return;
      }

      // Step 2: get a staging dir from Tauri (use app data dir)
      const baseDir: string = await invoke("get_app_data_dir");
      const stagingDir = `${baseDir.replace(/\/+$/, "")}/staging/${selected}`;

      // Step 3: download all clips in parallel (cap at 4 concurrent for stability)
      const downloaded: Array<{
        localPath: string;
        sceneNumber?: number;
        sceneTitle?: string;
        takeNumber?: number;
      }> = [];
      const concurrency = 4;
      const queue = [...usable];
      let done = 0;
      const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
        while (queue.length > 0) {
          const next = queue.shift();
          if (!next) break;
          const dest = `${stagingDir}/${next.fileName}`;
          try {
            await downloadClip(next.downloadUrl as string, dest);
            downloaded.push({
              localPath: dest,
              sceneNumber: next.sceneNumber,
              sceneTitle: next.sceneTitle,
              takeNumber: next.takeNumber,
            });
          } catch (e) {
            console.warn("download failed", next.fileName, e);
          }
          done++;
          setIngestProgress({ done, total: usable.length, phase: "Laster ned klipp…" });
        }
      });
      await Promise.all(workers);

      if (downloaded.length === 0) {
        setError("Alle nedlastinger feilet. Sjekk nettverket og prøv igjen.");
        setIngesting(false);
        return;
      }

      // Step 4: import into Resolve via Python script
      setIngestProgress({ done: 0, total: downloaded.length, phase: "Importerer i Resolve…" });
      const summary = await executeScript(
        "import_clips_to_scene_bins",
        { clips: downloaded },
        false,
      );
      const result = summary.events.find((e) => e.type === "result")?.value as
        | { imported?: unknown[]; failed?: unknown[]; binsCreated?: string[] }
        | undefined;
      const err = summary.events.find((e) => e.type === "error")?.value as { message?: string } | undefined;
      if (err?.message) {
        setError(err.message);
        return;
      }
      setIngestResult({
        imported: (result?.imported || []).length,
        failed: (result?.failed || []).length,
        binsCreated: (result?.binsCreated || []).length,
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIngesting(false);
      setIngestProgress(null);
    }
  }

  async function applySettingsToResolve() {
    if (!context) return;
    const ps = context.projectSettings;
    const log = probeResult?.dominantLogCurve;
    if (!ps?.resolution && !ps?.frameRate && !log) return;
    setApplyingSettings(true);
    setSettingsResult(null);
    setError(null);
    try {
      const params: Record<string, unknown> = {};
      if (ps?.resolution) params.resolution = ps.resolution;
      if (ps?.frameRate != null) params.frameRate = ps.frameRate;
      if (log?.suggestedCstInputGamma) params.cstInputGamma = log.suggestedCstInputGamma;
      if (log?.suggestedCstInputGamut) params.cstInputGamut = log.suggestedCstInputGamut;
      const summary = await executeScript("apply_project_settings", params, false);
      const result = summary.events.find((e) => e.type === "result")?.value as
        | { applied?: unknown[]; skipped?: unknown[]; failed?: unknown[] }
        | undefined;
      const err = summary.events.find((e) => e.type === "error")?.value as { message?: string } | undefined;
      if (err?.message) {
        setError(err.message);
        return;
      }
      setSettingsResult({
        applied: (result?.applied || []).length,
        skipped: (result?.skipped || []).length,
        failed: (result?.failed || []).length,
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setApplyingSettings(false);
    }
  }

  async function loadProductions() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetchMyProductions();
      setProductions(r.productions || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function loadContext(projectId: string) {
    if (!projectId) {
      setContext(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [scenesR, equipmentR, liveSetR] = await Promise.all([
        fetchRoleRoomScenes(projectId),
        fetchRoleRoomEquipment(projectId),
        fetchRoleRoomLiveSetState(projectId),
      ]);
      setContext({
        scenes: scenesR.scenes || [],
        equipment: equipmentR.equipment || [],
        projectSettings: equipmentR.projectSettings,
        clips: liveSetR.clips || [],
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProductions();
  }, []);

  useEffect(() => {
    void loadContext(selected);
    setProbeResult(null);
  }, [selected]);

  async function createBinsInResolve() {
    if (!context || context.scenes.length === 0) return;
    setCreatingBins(true);
    setBinResult(null);
    setError(null);
    try {
      const summary = await executeScript(
        "create_bins_from_scenes",
        { scenes: context.scenes },
        false,
      );
      const result = summary.events.find((e) => e.type === "result")?.value as
        | { binsCreated?: string[]; binsSkipped?: string[]; binsFailed?: unknown[] }
        | undefined;
      const err = summary.events.find((e) => e.type === "error")?.value as { message?: string } | undefined;
      if (err?.message) {
        setError(err.message);
        return;
      }
      setBinResult({
        created: result?.binsCreated || [],
        skipped: result?.binsSkipped || [],
        failed: (result?.binsFailed || []).length,
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreatingBins(false);
    }
  }

  async function probeMountedCards() {
    setProbing(true);
    setError(null);
    try {
      const cards = await invoke<MountedCard[]>("list_mounted_cards");
      const paths: string[] = [];
      for (const card of cards) {
        for (const clip of card.clips || []) {
          if (clip.path) paths.push(clip.path);
        }
      }
      if (paths.length === 0) {
        setError("Ingen mountede kort funnet — koble til et minnekort først.");
        setProbing(false);
        return;
      }
      const result = await probeMediaFiles(paths);
      setProbeResult(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setProbing(false);
    }
  }

  return (
    <div style={{
      padding: 20,
      borderRadius: 12,
      background: "linear-gradient(135deg, rgba(160,48,192,0.10), rgba(110,63,199,0.04))",
      border: "1px solid rgba(160,48,192,0.30)",
      maxWidth: 720,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <strong style={{ fontSize: 14 }}>Role Room — Project Sync</strong>
        <button
          onClick={() => void loadProductions()}
          disabled={loading}
          style={{
            background: "transparent",
            border: "1px solid rgba(160,48,192,0.4)",
            color: "#a030c0",
            borderRadius: 6,
            padding: "4px 10px",
            cursor: loading ? "default" : "pointer",
            fontSize: 12,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          Refresh
        </button>
      </div>

      {error && (
        <div style={{
          padding: 10,
          background: "rgba(239,79,111,0.10)",
          border: "1px solid rgba(239,79,111,0.4)",
          color: "#ef4f6f",
          borderRadius: 6,
          fontSize: 13,
          marginBottom: 10,
        }}>
          {error}
        </div>
      )}

      <label style={{ fontSize: 11, color: "#b8a8d8", textTransform: "uppercase", letterSpacing: 1 }}>
        Velg produksjon
      </label>
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        disabled={loading || productions.length === 0}
        style={{
          width: "100%",
          padding: "8px 10px",
          marginTop: 4,
          background: "#1a0d45",
          color: "#f0eaff",
          border: "1px solid rgba(160,48,192,0.4)",
          borderRadius: 6,
          fontSize: 13,
        }}
      >
        <option value="">— ingen valgt —</option>
        {productions.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} {p.activeSeats ? `(${p.activeSeats} seats)` : ""}
          </option>
        ))}
      </select>

      {context && (
        <div style={{
          marginTop: 16,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 10,
        }}>
          <Counter label="Scener" value={context.scenes.length} />
          <Counter label="Utstyr" value={context.equipment.length} />
          <Counter label="Klipp" value={context.clips.length} />
          <Counter
            label="Primær kamera"
            value={
              context.projectSettings?.primaryCamera
                ? `${context.projectSettings.primaryCamera.brand || ""} ${context.projectSettings.primaryCamera.model || ""}`.trim() || "–"
                : "–"
            }
            small
          />
        </div>
      )}

      {/* Action: Ingest captured clips from Live Set */}
      {context && context.clips.length > 0 && (
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 6 }}>
          <button
            onClick={ingestCapturedClips}
            disabled={ingesting}
            style={{
              background: "#6e3fc7",
              border: "none",
              color: "white",
              borderRadius: 6,
              padding: "8px 14px",
              cursor: ingesting ? "default" : "pointer",
              fontSize: 13,
              fontWeight: 600,
              alignSelf: "flex-start",
            }}
          >
            {ingesting
              ? ingestProgress
                ? `${ingestProgress.phase} (${ingestProgress.done}/${ingestProgress.total})`
                : "Forbereder ingest…"
              : `Ingest ${context.clips.length} fangede klipp fra Live Set`}
          </button>
          {ingestResult && (
            <div style={{
              padding: 10,
              background: ingestResult.failed > 0 ? "rgba(245,158,11,0.10)" : "rgba(74,212,138,0.10)",
              border: ingestResult.failed > 0 ? "1px solid rgba(245,158,11,0.4)" : "1px solid rgba(74,212,138,0.4)",
              color: ingestResult.failed > 0 ? "#a16207" : "#4ad48a",
              borderRadius: 6,
              fontSize: 12,
            }}>
              <strong>{ingestResult.failed > 0 ? "⚠" : "✓"}</strong>{" "}
              {ingestResult.imported} klipp importert
              {ingestResult.binsCreated > 0 && `, ${ingestResult.binsCreated} nye bins`}
              {ingestResult.failed > 0 && `, ${ingestResult.failed} feilet`}.
            </div>
          )}
        </div>
      )}

      {/* Action: Create bins from scenes in Resolve */}
      {context && context.scenes.length > 0 && (
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 6 }}>
          <button
            onClick={createBinsInResolve}
            disabled={creatingBins}
            style={{
              background: "#a030c0",
              border: "none",
              color: "white",
              borderRadius: 6,
              padding: "8px 14px",
              cursor: creatingBins ? "default" : "pointer",
              fontSize: 13,
              fontWeight: 600,
              alignSelf: "flex-start",
            }}
          >
            {creatingBins ? "Oppretter bins…" : `Opprett ${context.scenes.length} bins fra scener i Resolve`}
          </button>
          {binResult && (
            <div style={{
              padding: 10,
              background: binResult.failed > 0 ? "rgba(245,158,11,0.10)" : "rgba(74,212,138,0.10)",
              border: binResult.failed > 0 ? "1px solid rgba(245,158,11,0.4)" : "1px solid rgba(74,212,138,0.4)",
              color: binResult.failed > 0 ? "#a16207" : "#4ad48a",
              borderRadius: 6,
              fontSize: 12,
            }}>
              <strong>{binResult.failed > 0 ? "⚠" : "✓"}</strong>{" "}
              {binResult.created.length} opprettet
              {binResult.skipped.length > 0 && `, ${binResult.skipped.length} hoppet over (fantes fra før)`}
              {binResult.failed > 0 && `, ${binResult.failed} feilet`}.
            </div>
          )}
        </div>
      )}

      {context && context.projectSettings && (context.projectSettings.resolution || context.projectSettings.frameRate) && (
        <div style={{
          marginTop: 12,
          padding: 10,
          background: "rgba(110,63,199,0.08)",
          borderLeft: "3px solid #6e3fc7",
          borderRadius: 4,
          fontSize: 12,
          color: "#b8a8d8",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong style={{ color: "#f0eaff" }}>Foreslåtte Resolve-innstillinger:</strong>{" "}
            {context.projectSettings.resolution && <>resolution {context.projectSettings.resolution} · </>}
            {context.projectSettings.frameRate && (
              <>
                {context.projectSettings.frameRate} fps
                {(() => {
                  const std = classifyExpectedStandard(context.projectSettings?.frameRate ?? null);
                  return std ? ` (${std})` : "";
                })()}
                {" · "}
              </>
            )}
            {context.projectSettings.colorScience && <>{context.projectSettings.colorScience}</>}
            {probeResult?.dominantLogCurve && (
              <>
                <br />
                <span style={{ color: "#a030c0" }}>
                  + CST: {probeResult.dominantLogCurve.suggestedCstInputGamma}
                  {probeResult.dominantLogCurve.suggestedCstInputGamut && ` / ${probeResult.dominantLogCurve.suggestedCstInputGamut}`}
                </span>
              </>
            )}
          </div>
          <button
            onClick={applySettingsToResolve}
            disabled={applyingSettings}
            style={{
              background: "#6e3fc7",
              border: "none",
              color: "white",
              borderRadius: 6,
              padding: "6px 12px",
              cursor: applyingSettings ? "default" : "pointer",
              fontSize: 12,
              fontWeight: 600,
              flexShrink: 0,
              whiteSpace: "nowrap",
            }}
          >
            {applyingSettings ? "Setter…" : "Sett i Resolve"}
          </button>
        </div>
      )}

      {settingsResult && (
        <div style={{
          marginTop: 8,
          padding: 10,
          background: settingsResult.failed > 0 ? "rgba(245,158,11,0.10)" : "rgba(74,212,138,0.10)",
          border: settingsResult.failed > 0 ? "1px solid rgba(245,158,11,0.4)" : "1px solid rgba(74,212,138,0.4)",
          color: settingsResult.failed > 0 ? "#a16207" : "#4ad48a",
          borderRadius: 6,
          fontSize: 12,
        }}>
          <strong>{settingsResult.failed > 0 ? "⚠" : "✓"}</strong>{" "}
          {settingsResult.applied} satt
          {settingsResult.skipped > 0 && `, ${settingsResult.skipped} allerede korrekt`}
          {settingsResult.failed > 0 && `, ${settingsResult.failed} feilet (Resolve avviste verdien)`}.
        </div>
      )}

      {/* PAL/NTSC file-probe section */}
      {context && (
        <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid rgba(160,48,192,0.20)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <strong style={{ fontSize: 13 }}>Sjekk faktiske file-formater</strong>
            <button
              onClick={probeMountedCards}
              disabled={probing}
              style={{
                background: "#a030c0",
                border: "none",
                color: "white",
                borderRadius: 6,
                padding: "6px 12px",
                cursor: probing ? "default" : "pointer",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {probing ? "Sjekker…" : "Probe mountede kort"}
            </button>
          </div>

          {probeResult && (() => {
            if (!probeResult.ffprobeAvailable) {
              return (
                <div style={{
                  padding: 12,
                  background: "rgba(245,158,11,0.10)",
                  border: "1px solid rgba(245,158,11,0.4)",
                  color: "#a16207",
                  borderRadius: 6,
                  fontSize: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}>
                  <span>ffprobe (ffmpeg) er ikke installert ennå — kreves for format-sjekk.</span>
                  <button
                    onClick={() => window.dispatchEvent(new CustomEvent("trrpa:open-dependencies"))}
                    style={{
                      background: "#a16207",
                      border: "none",
                      color: "white",
                      borderRadius: 6,
                      padding: "6px 12px",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    Installer nå
                  </button>
                </div>
              );
            }
            const expectedStd = classifyExpectedStandard(context.projectSettings?.frameRate ?? null);
            const actualStd = probeResult.dominantStandard;
            const mismatch = expectedStd && actualStd && expectedStd !== actualStd;
            return (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8, marginBottom: 10 }}>
                  <Counter label="Filer sjekket" value={`${probeResult.probedCount}/${probeResult.totalFiles}`} small />
                  <Counter label="Standard" value={actualStd || "–"} small />
                  <Counter label="FPS" value={probeResult.dominantFrameRate?.toFixed(2) || "–"} small />
                  <Counter label="Oppløsning" value={probeResult.dominantResolution || "–"} small />
                </div>

                {mismatch && (
                  <div style={{ padding: 10, background: "rgba(239,79,111,0.10)", border: "1px solid rgba(239,79,111,0.4)", color: "#ef4f6f", borderRadius: 6, fontSize: 12, marginBottom: 8 }}>
                    ⚠ Standard-mismatch: utstyret er konfigurert for <strong>{expectedStd}</strong>, men filene på kortet er <strong>{actualStd}</strong>.
                    Sjekk at kameraet ble satt i riktig modus før shoot.
                  </div>
                )}

                {probeResult.mixedStandards && (
                  <div style={{ padding: 10, background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.4)", color: "#a16207", borderRadius: 6, fontSize: 12, marginBottom: 8 }}>
                    ⚠ Blandet format på kortet (PAL + NTSC + Cinema). Resolve-prosjektet må enten settes til dominant standard, eller klippene må konformes ved import.
                  </div>
                )}

                {!mismatch && !probeResult.mixedStandards && expectedStd && actualStd === expectedStd && (
                  <div style={{ padding: 10, background: "rgba(74,212,138,0.10)", border: "1px solid rgba(74,212,138,0.4)", color: "#4ad48a", borderRadius: 6, fontSize: 12, marginBottom: 8 }}>
                    ✓ Filer matcher utstyrs-standard ({expectedStd}). Trygt å importere.
                  </div>
                )}

                {/* Log-curve detection + CST recommendation */}
                {probeResult.dominantLogCurve && (
                  <div style={{
                    padding: 10,
                    background: "rgba(160,48,192,0.10)",
                    borderLeft: "3px solid #a030c0",
                    borderRadius: 4,
                    fontSize: 12,
                    color: "#d8c8e8",
                    marginBottom: 8,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <strong style={{ color: "#f0eaff", fontSize: 13 }}>
                        Detektert log-kurve: {probeResult.dominantLogCurve.label}
                      </strong>
                      <span style={{ fontSize: 11, color: "#8674a8" }}>
                        sikkerhet {Math.round(probeResult.dominantLogCurve.confidence * 100)}% ({probeResult.dominantLogCurve.source})
                      </span>
                    </div>
                    {(probeResult.dominantLogCurve.suggestedCstInputGamma || probeResult.dominantLogCurve.suggestedCstInputGamut) && (
                      <div style={{ marginTop: 6 }}>
                        <div style={{ color: "#f0eaff", fontWeight: 600 }}>Resolve CST-forslag:</div>
                        <ul style={{ margin: "4px 0 0 18px", padding: 0, color: "#d8c8e8" }}>
                          {probeResult.dominantLogCurve.suggestedCstInputGamma && (
                            <li>Input Gamma: <code>{probeResult.dominantLogCurve.suggestedCstInputGamma}</code></li>
                          )}
                          {probeResult.dominantLogCurve.suggestedCstInputGamut && (
                            <li>Input Gamut: <code>{probeResult.dominantLogCurve.suggestedCstInputGamut}</code></li>
                          )}
                          <li>Output: <code>Rec.709 Gamma 2.4</code> (default leveranse)</li>
                        </ul>
                      </div>
                    )}
                    {probeResult.dominantLogCurve.confidence < 0.7 && (
                      <div style={{ marginTop: 6, fontSize: 11, color: "#a16207" }}>
                        ⚠ Lavt sikkerhetstall — anbefalingen baserer seg på filnavn-mønster, ikke metadata.
                        Bekreft mot kamera-spesifikasjon før du setter CST.
                      </div>
                    )}
                  </div>
                )}

                {probeResult.mixedLogCurves && (
                  <div style={{ padding: 10, background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.4)", color: "#a16207", borderRadius: 6, fontSize: 12, marginBottom: 8 }}>
                    ⚠ Blandet log-kurve på kortet — flere kameraer/profiler. Each clip vil kreve eget input transform i Color page.
                  </div>
                )}

                {probeResult.errorCount > 0 && (
                  <div style={{ fontSize: 11, color: "#8674a8" }}>
                    {probeResult.errorCount} fil(er) kunne ikke probes — sannsynligvis ikke-video eller korrupt.
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Wedding-specific pipeline (only renders for wedding-type productions) */}
      {selected && (() => {
        const prod = productions.find((p) => p.id === selected);
        const isWedding = isWeddingProjectType(prod?.projectType);
        if (!isWedding) return null;
        return (
          <WeddingPipeline
            projectId={selected}
            projectType={prod?.projectType}
            exportedVideoPath={analyzePath}
            onSourceSongReady={(path) => setSourceSongPath(path)}
          />
        );
      })()}

      {/* Analyze exported video → Resolve timeline with markers per cut */}
      <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(160,48,192,0.20)" }}>
        <strong style={{ fontSize: 13, display: "block", marginBottom: 8 }}>
          Analysér ferdig video {sourceSongPath ? <span style={{ fontSize: 10, color: "#ec4899", fontWeight: 400 }}>(med pristine beat-grid)</span> : null}
        </strong>
        <div style={{ fontSize: 11, color: "#8674a8", marginBottom: 10 }}>
          Drop en allerede-redigert video og se din egen edit shot-for-shot i Resolve med markører + Claude-narrasjon.
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <button
            onClick={pickAnalyzeFile}
            disabled={analyzing}
            style={{
              background: "transparent",
              border: "1px solid rgba(160,48,192,0.4)",
              color: "#a030c0",
              borderRadius: 6,
              padding: "6px 12px",
              cursor: analyzing ? "default" : "pointer",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {analyzePath ? "Bytt fil" : "Velg video-fil"}
          </button>
          {analyzePath && (
            <span style={{ fontSize: 12, color: "#d8c8e8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
              {analyzePath.split("/").pop()}
            </span>
          )}
        </div>

        {analyzePath && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8, fontSize: 12, color: "#b8a8d8" }}>
              <label style={{ minWidth: 100 }}>
                Cut-sensitivitet: <strong style={{ color: "#f0eaff" }}>{analyzeThreshold.toFixed(2)}</strong>
              </label>
              <input
                type="range"
                min={0.15}
                max={0.7}
                step={0.05}
                value={analyzeThreshold}
                onChange={(e) => setAnalyzeThreshold(parseFloat(e.target.value))}
                disabled={analyzing}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: 10, color: "#8674a8", whiteSpace: "nowrap" }}>
                {analyzeThreshold < 0.3 ? "fler cuts" : analyzeThreshold > 0.5 ? "færre cuts" : "balansert"}
              </span>
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#d8c8e8", marginBottom: 10 }}>
              <input
                type="checkbox"
                checked={analyzeNarrate}
                onChange={(e) => setAnalyzeNarrate(e.target.checked)}
                disabled={analyzing}
              />
              Narrér hvert shot med Claude Vision (3 bilder + bevegelses-score per shot)
            </label>

            <button
              onClick={runAnalyzeExportedVideo}
              disabled={analyzing}
              style={{
                background: "#a030c0",
                border: "none",
                color: "white",
                borderRadius: 6,
                padding: "8px 14px",
                cursor: analyzing ? "default" : "pointer",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {analyzing ? "Analyserer + importerer…" : "Analysér og importer til Resolve"}
            </button>
          </>
        )}

        {analyzeResult && (
          <div style={{
            marginTop: 10,
            padding: 10,
            background: "rgba(74,212,138,0.10)",
            border: "1px solid rgba(74,212,138,0.4)",
            color: "#4ad48a",
            borderRadius: 6,
            fontSize: 12,
          }}>
            <strong>✓</strong> {analyzeResult.cuts} cuts detektert, {analyzeResult.markersAdded} markører plassert på timeline <code>{analyzeResult.timelineName}</code>.
            {analyzeResult.samplePlan && analyzeResult.samplePlan.length > 0 && (
              <div style={{ marginTop: 8, maxHeight: 160, overflowY: "auto", fontSize: 11, color: "#d8c8e8" }}>
                {analyzeResult.samplePlan.slice(0, 15).map((p) => (
                  <div key={p.index} style={{ padding: "2px 0", display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ color: "#8674a8", minWidth: 50 }}>{Math.floor(p.time / 60)}:{String(Math.floor(p.time % 60)).padStart(2, "0")}</span>
                    <span style={{ flex: 1 }}>{p.name}</span>
                    <span style={{ color: "#8674a8", fontSize: 10, whiteSpace: "nowrap" }}>
                      {p.durationSeconds != null ? `${p.durationSeconds.toFixed(1)}s` : ""}
                      {p.motionScore != null && ` · ${(p.motionScore * 100).toFixed(0)}% bev.`}
                    </span>
                  </div>
                ))}
                {analyzeResult.samplePlan.length > 15 && (
                  <div style={{ color: "#8674a8", padding: "4px 0", textAlign: "center" }}>
                    … og {analyzeResult.samplePlan.length - 15} til (se Resolve-timeline for full liste)
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Match shots to source material */}
        {analyzeResult && analyzePath && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px dashed rgba(160,48,192,0.20)" }}>
            <strong style={{ fontSize: 12, display: "block", marginBottom: 6 }}>
              Match shots til råmateriale
            </strong>
            <div style={{ fontSize: 11, color: "#8674a8", marginBottom: 8 }}>
              Pek på en eller flere raw-footage-mapper. Post Agent finner hvilken kilde + timecode hvert shot kom fra (perceptual hash).
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              {sourceFolders.map((f) => (
                <span key={f} style={{ padding: "3px 8px", background: "rgba(160,48,192,0.15)", color: "#d8c8e8", borderRadius: 4, fontSize: 11, display: "inline-flex", alignItems: "center", gap: 4 }}>
                  {f.split("/").pop()}
                  <button
                    onClick={() => setSourceFolders(sourceFolders.filter((x) => x !== f))}
                    disabled={matching}
                    style={{ background: "transparent", border: "none", color: "#8674a8", cursor: "pointer", padding: 0, fontSize: 14 }}
                  >×</button>
                </span>
              ))}
              <button
                onClick={pickSourceFolder}
                disabled={matching}
                style={{
                  background: "transparent",
                  border: "1px dashed rgba(160,48,192,0.4)",
                  color: "#a030c0",
                  borderRadius: 4,
                  padding: "3px 10px",
                  cursor: matching ? "default" : "pointer",
                  fontSize: 11,
                }}
              >
                + Legg til mappe
              </button>
            </div>

            <button
              onClick={runMatchShotsToSource}
              disabled={matching || sourceFolders.length === 0}
              style={{
                background: "#6e3fc7",
                border: "none",
                color: "white",
                borderRadius: 6,
                padding: "6px 12px",
                cursor: matching || sourceFolders.length === 0 ? "default" : "pointer",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {matching ? "Matcher…" : "Match shots"}
            </button>

            {matchResult && (
              <div style={{
                marginTop: 10,
                padding: 10,
                background: "rgba(110,63,199,0.08)",
                border: "1px solid rgba(110,63,199,0.30)",
                borderRadius: 6,
                fontSize: 11,
                color: "#d8c8e8",
              }}>
                <div style={{ marginBottom: 6, color: "#f0eaff" }}>
                  <strong>{matchResult.sourceCount}</strong> raw-klipp · <strong>{matchResult.sourceFrameCount}</strong> sample-frames indeksert
                </div>
                <div style={{ display: "flex", gap: 12, fontSize: 11, marginBottom: 8 }}>
                  {matchResult.confidenceBreakdown.high ? <span style={{ color: "#4ad48a" }}>✓ {matchResult.confidenceBreakdown.high} høy</span> : null}
                  {matchResult.confidenceBreakdown.medium ? <span style={{ color: "#f59e0b" }}>~ {matchResult.confidenceBreakdown.medium} medium</span> : null}
                  {matchResult.confidenceBreakdown.low ? <span style={{ color: "#ef4f6f" }}>? {matchResult.confidenceBreakdown.low} lav</span> : null}
                  {matchResult.confidenceBreakdown.none ? <span style={{ color: "#8674a8" }}>× {matchResult.confidenceBreakdown.none} ingen</span> : null}
                </div>
                <div style={{ maxHeight: 200, overflowY: "auto" }}>
                  {matchResult.matches.slice(0, 30).map((m) => {
                    const conf = m.confidence;
                    const color = conf === "high" ? "#4ad48a" : conf === "medium" ? "#f59e0b" : conf === "low" ? "#ef4f6f" : "#8674a8";
                    const minutes = Math.floor(m.shotTime / 60);
                    const seconds = Math.floor(m.shotTime % 60);
                    return (
                      <div key={m.shotIndex} style={{ padding: "2px 0", display: "flex", gap: 8, alignItems: "center" }}>
                        <span style={{ color: "#8674a8", minWidth: 40 }}>{minutes}:{String(seconds).padStart(2, "0")}</span>
                        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: m.sourceFile ? "#f0eaff" : "#8674a8" }}>
                          {m.sourceFile || "(ingen match)"}
                          {m.sourceTime != null && ` @ ${m.sourceTime.toFixed(1)}s`}
                        </span>
                        <span style={{ color, fontSize: 10, whiteSpace: "nowrap" }}>
                          {conf === "high" && "≥90%"}
                          {conf === "medium" && "~75%"}
                          {conf === "low" && "<75%"}
                          {conf === "none" && "ingen"}
                        </span>
                      </div>
                    );
                  })}
                  {matchResult.matches.length > 30 && (
                    <div style={{ color: "#8674a8", padding: "4px 0", textAlign: "center" }}>
                      … og {matchResult.matches.length - 30} til
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {loading && (
        <div style={{ marginTop: 10, fontSize: 12, color: "#8674a8" }}>Laster…</div>
      )}
    </div>
  );
}

function Counter({ label, value, small }: { label: string; value: number | string; small?: boolean }) {
  return (
    <div style={{
      padding: 12,
      background: "rgba(0,0,0,0.25)",
      borderRadius: 8,
    }}>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "#8674a8" }}>{label}</div>
      <div style={{
        fontSize: small ? 14 : 22,
        fontWeight: 700,
        color: "#f0eaff",
        marginTop: 2,
        lineHeight: 1.1,
      }}>
        {value}
      </div>
    </div>
  );
}
