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
import {
  fetchMyProductions,
  fetchRoleRoomScenes,
  fetchRoleRoomEquipment,
  fetchRoleRoomLiveSetState,
  type RoleRoomProduction,
  type RoleRoomScene,
  type RoleRoomEquipment,
  type RoleRoomProjectSettings,
  type RoleRoomClip,
} from "../api";

interface ProjectContext {
  scenes: RoleRoomScene[];
  equipment: RoleRoomEquipment[];
  projectSettings: RoleRoomProjectSettings | null;
  clips: RoleRoomClip[];
}

export function RoleRoomProjectSync() {
  const [productions, setProductions] = useState<RoleRoomProduction[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [context, setContext] = useState<ProjectContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  }, [selected]);

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
          {context.projectSettings.frameRate && <>{context.projectSettings.frameRate} fps · </>}
          {context.projectSettings.colorScience && <>{context.projectSettings.colorScience}</>}
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
