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
  fetchMyProductions,
  fetchRoleRoomScenes,
  fetchRoleRoomEquipment,
  fetchRoleRoomLiveSetState,
  probeMediaFiles,
  type RoleRoomProduction,
  type RoleRoomScene,
  type RoleRoomEquipment,
  type RoleRoomProjectSettings,
  type RoleRoomClip,
  type ProbeSummary,
} from "../api";
import type { MountedCard } from "../types";

interface ProjectContext {
  scenes: RoleRoomScene[];
  equipment: RoleRoomEquipment[];
  projectSettings: RoleRoomProjectSettings | null;
  clips: RoleRoomClip[];
}

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

      {context && context.projectSettings && (context.projectSettings.resolution || context.projectSettings.frameRate) && (
        <div style={{
          marginTop: 12,
          padding: 10,
          background: "rgba(110,63,199,0.08)",
          borderLeft: "3px solid #6e3fc7",
          borderRadius: 4,
          fontSize: 12,
          color: "#b8a8d8",
        }}>
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
