import { useCallback, useEffect, useMemo, useState } from "react";
import { executeScript, readLookPack } from "../api";
import type { Look, LookPack, ProjectTemplateSummary, ScriptEvent } from "../types";

interface CameraProfileResult {
  totalClips?: number;
  clipsByProfile?: Record<string, number>;
  clipsByProfileSample?: Record<string, string[]>;
  unknownCount?: number;
  unknownSample?: string[];
  suggestedTransforms?: Record<string, string>;
}

interface WbOutliersResult {
  clipsScanned?: number;
  wbExtracted?: number;
  medianKelvin?: number;
  outlierCount?: number;
  outliers?: Record<string, number>;
}

function pickResult<T>(events: ScriptEvent[]): T | null {
  const result = events.find((e) => e.type === "result");
  return result ? ((result.value as T) ?? null) : null;
}

interface ColorViewProps {
  activeTemplate: ProjectTemplateSummary | null;
}

export function ColorView({ activeTemplate }: ColorViewProps) {
  const [lookPack, setLookPack] = useState<LookPack | null>(null);
  const [selectedLookId, setSelectedLookId] = useState<string | null>(null);
  const [sceneMap, setSceneMap] = useState<Record<string, string>>({});
  const [profiles, setProfiles] = useState<CameraProfileResult | null>(null);
  const [wbOutliers, setWbOutliers] = useState<WbOutliersResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const packId = activeTemplate?.lookPackId;

  useEffect(() => {
    readLookPack(packId)
      .then((pack) => {
        setLookPack(pack);
        setSceneMap({ ...pack.sceneToLookMap });
        setSelectedLookId(null);
      })
      .catch((e) => setError(String(e)));
  }, [packId]);

  const looksById = useMemo(() => {
    const map: Record<string, Look> = {};
    lookPack?.looks.forEach((l) => {
      map[l.id] = l;
    });
    return map;
  }, [lookPack]);

  const runScript = useCallback(
    async <T,>(
      scriptId: string,
      params: Record<string, unknown>,
      label: string,
      setter: ((v: T) => void) | null,
    ) => {
      setBusy(label);
      setError(null);
      try {
        const summary = await executeScript(scriptId, params, false);
        if (setter) {
          const r = pickResult<T>(summary.events);
          if (r) setter(r);
        }
      } catch (e) {
        setError(`${label}: ${e}`);
      } finally {
        setBusy(null);
      }
    },
    [],
  );

  const dryRun = useCallback(
    async (scriptId: string, params: Record<string, unknown>) => {
      setBusy(`Dry run · ${scriptId}`);
      setError(null);
      try {
        await executeScript(scriptId, params, true);
      } catch (e) {
        setError(String(e));
      } finally {
        setBusy(null);
      }
    },
    [],
  );

  const selectedLook = selectedLookId ? looksById[selectedLookId] : null;
  const unknownPct = profiles?.totalClips
    ? Math.round(((profiles.unknownCount ?? 0) / profiles.totalClips) * 100)
    : 0;

  return (
    <div className="color-view">
      <div className="color-header">
        <h2>Color Grade Assistant</h2>
        <span className="card-chip-meta">
          {lookPack ? `${lookPack.name} · ${lookPack.version}` : "Loading look pack…"}
        </span>
      </div>

      {error && <div className="dialog-warning" style={{ margin: "0 18px 12px" }}>{error}</div>}

      <div className="color-grid">
        {/* CAMERA PROFILES */}
        <section className="color-card color-card-wide">
          <h3>Camera Profiles</h3>
          {profiles ? (
            <>
              <ul className="audio-stats">
                {Object.entries(profiles.clipsByProfile ?? {}).map(([profile, count]) => (
                  <li key={profile}>
                    <span className="chip ready">{count}</span> {profile}
                    {profiles.suggestedTransforms?.[profile] && (
                      <span className="card-chip-meta" style={{ marginLeft: 6 }}>
                        → {profiles.suggestedTransforms[profile]}
                      </span>
                    )}
                  </li>
                ))}
                {(profiles.unknownCount ?? 0) > 0 && (
                  <li>
                    <span className="chip risk-medium">{profiles.unknownCount}</span> Unknown profile
                    {unknownPct > 5 && (
                      <span className="card-chip-meta" style={{ marginLeft: 6 }}>
                        ({unknownPct}% — recheck filenames or set metadata)
                      </span>
                    )}
                  </li>
                )}
              </ul>
            </>
          ) : (
            <div className="empty">Detect camera profiles to see which logs are in play.</div>
          )}
          <div className="audio-actions">
            <button className="small" disabled={!!busy} onClick={() => dryRun("detect_camera_profiles", {})}>
              Dry Run
            </button>
            <button
              className="small primary"
              disabled={!!busy}
              onClick={() => runScript<CameraProfileResult>("detect_camera_profiles", {}, "Detect Profiles", setProfiles)}
            >
              Detect Camera Profiles
            </button>
          </div>
        </section>

        {/* LOOK STRATEGY */}
        <section className="color-card">
          <h3>Look Strategy</h3>
          {lookPack ? (
            <>
              <label htmlFor="look-pick" className="card-chip-meta">Wedding style</label>
              <select
                id="look-pick"
                value={selectedLookId ?? ""}
                onChange={(e) => setSelectedLookId(e.target.value)}
                disabled={!!busy}
              >
                <option value="">— pick a default look —</option>
                {lookPack.looks.map((look) => (
                  <option key={look.id} value={look.id}>
                    {look.name}
                  </option>
                ))}
              </select>
              {selectedLook && (
                <div className="look-detail">
                  <div className="card-chip-meta">Best for: {selectedLook.bestFor.join(", ")}</div>
                  {selectedLook.components.lut && (
                    <div className="card-chip-meta">LUT: <code>{selectedLook.components.lut}</code></div>
                  )}
                  {selectedLook.components.grain && (
                    <div className="card-chip-meta">Grain: {selectedLook.components.grain}</div>
                  )}
                  {selectedLook.components.outputTransform && (
                    <div className="card-chip-meta">Output: {selectedLook.components.outputTransform}</div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="empty">Loading…</div>
          )}
          <div className="audio-actions">
            <button
              className="small"
              disabled={!!busy || !selectedLookId}
              onClick={() => dryRun("apply_wedding_look_pack", { lookId: selectedLookId })}
            >
              Dry Run (uniform look)
            </button>
            <button
              className="small primary"
              disabled={!!busy || !selectedLookId}
              onClick={() => runScript("apply_wedding_look_pack", { lookId: selectedLookId }, "Apply uniform look", null)}
            >
              Apply
            </button>
          </div>
        </section>

        {/* SCENE LOOKS MAPPING */}
        <section className="color-card">
          <h3>Scene Looks</h3>
          {lookPack ? (
            <div className="scene-mapping">
              {Object.entries(sceneMap).map(([scene, lookId]) => (
                <div key={scene} className="scene-mapping-row">
                  <span className="scene-mapping-scene">{scene.replace("_", " ")}</span>
                  <select
                    value={lookId}
                    onChange={(e) => setSceneMap({ ...sceneMap, [scene]: e.target.value })}
                    disabled={!!busy}
                  >
                    {lookPack.looks.map((look) => (
                      <option key={look.id} value={look.id}>
                        {look.name}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty">Loading…</div>
          )}
          <div className="audio-actions">
            <button
              className="small"
              disabled={!!busy || !lookPack}
              onClick={() => dryRun("apply_wedding_look_pack", { sceneMarkers: sceneMap })}
            >
              Dry Run Scene Looks
            </button>
            <button
              className="small primary"
              disabled={!!busy || !lookPack}
              onClick={() => runScript("apply_wedding_look_pack", { sceneMarkers: sceneMap }, "Apply scene looks", null)}
            >
              Apply Scene Looks
            </button>
          </div>
        </section>

        {/* TECHNICAL TRANSFORM */}
        <section className="color-card">
          <h3>Technical Transform</h3>
          <div className="empty">
            Apply per-camera LUT — uses detected profiles to pick the right Canon C-Log2 / Sony S-Log3 / DJI D-Log transform on the first node of each clip.
          </div>
          <div className="audio-actions">
            <button className="small" disabled={!!busy || !profiles} onClick={() => dryRun("apply_camera_lut", {})}>
              Dry Run
            </button>
            <button
              className="small primary"
              disabled={!!busy || !profiles}
              onClick={() => runScript("apply_camera_lut", {}, "Apply camera LUT", null)}
            >
              Apply Technical Transform
            </button>
          </div>
        </section>

        {/* COLOR GROUPS */}
        <section className="color-card">
          <h3>Color Groups</h3>
          <div className="empty">
            Create Resolve color groups: Canon C80 · Canon R5 · DJI Drone · Low light · Reception · Ceremony. Pre-grade nodes propagate to all clips in a group.
          </div>
          <div className="audio-actions">
            <button className="small" disabled={!!busy} onClick={() => dryRun("create_color_groups", {})}>
              Dry Run
            </button>
            <button
              className="small primary"
              disabled={!!busy}
              onClick={() => runScript("create_color_groups", {}, "Create color groups", null)}
            >
              Create Groups
            </button>
          </div>
        </section>

        {/* WARNINGS */}
        <section className="color-card color-card-wide">
          <h3>Color QC Warnings</h3>
          <div className="color-qc-grid">
            <div>
              <strong>Underexposed</strong>
              <div className="empty">Flag clips with mean luma below threshold</div>
              <button
                className="small"
                disabled={!!busy}
                onClick={() => runScript("flag_underexposed_clips", { thresholdIRE: 25 }, "Flag underexposed", null)}
              >
                Scan
              </button>
            </div>
            <div>
              <strong>White Balance</strong>
              {wbOutliers ? (
                <div className="card-chip-meta">
                  Median: {wbOutliers.medianKelvin}K ·
                  {' '}<span className="chip risk-medium">{wbOutliers.outlierCount} outliers</span>
                </div>
              ) : (
                <div className="empty">Read clip metadata + flag &gt;800K from scene median</div>
              )}
              <button
                className="small"
                disabled={!!busy}
                onClick={() => runScript<WbOutliersResult>("flag_mixed_white_balance", {}, "Flag WB outliers", setWbOutliers)}
              >
                Scan WB
              </button>
            </div>
            <div>
              <strong>Look Review Stills</strong>
              <div className="empty">Export key-scene stills (Bride prep / Ceremony / Reception / Dance) for client look approval</div>
              <button
                className="small primary"
                disabled={!!busy}
                onClick={() => runScript("export_stills_for_look_review", {}, "Export stills", null)}
              >
                Export Stills
              </button>
            </div>
          </div>
        </section>
      </div>

      {busy && (
        <div className="cull-running">
          <div className="cull-running-spinner" />
          {busy}…
        </div>
      )}
    </div>
  );
}
