import { useEffect, useMemo, useState } from "react";

import { executeScript, fetchVideoRoomNleProjects, type VideoRoomNleProject } from "../api";
import type { ResolveState } from "../hooks/useResolveSync";
import {
  loadVideoRoomMarkerSyncConfig,
  saveVideoRoomMarkerSyncConfig,
  VIDEO_ROOM_SYNC_STATUS_EVENT,
  type VideoRoomMarkerSyncStatus,
} from "../services/videoRoomMarkerSyncService";

export function VideoRoomResolveSyncSettings({ preferredProjectId }: { preferredProjectId?: string }) {
  const saved = loadVideoRoomMarkerSyncConfig();
  const [projects, setProjects] = useState<VideoRoomNleProject[]>([]);
  const [projectId, setProjectId] = useState(saved?.projectId || preferredProjectId || "");
  const [versionId, setVersionId] = useState(saved?.versionId || "");
  const [enabled, setEnabled] = useState(saved?.enabled ?? false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<VideoRoomMarkerSyncStatus>({ state: saved?.enabled ? "connecting" : "disabled", message: saved?.enabled ? "Kobler til …" : "Sync er av." });
  const project = useMemo(() => projects.find((candidate) => candidate.id === projectId) || null, [projects, projectId]);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const result = await fetchVideoRoomNleProjects();
      setProjects(result.projects || []);
    } catch (loadError) {
      setError((loadError as Error).message || "Kunne ikke laste Video Room-prosjekter");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    const listener = (event: Event) => setStatus((event as CustomEvent<VideoRoomMarkerSyncStatus>).detail);
    window.addEventListener(VIDEO_ROOM_SYNC_STATUS_EVENT, listener);
    return () => window.removeEventListener(VIDEO_ROOM_SYNC_STATUS_EVENT, listener);
  }, []);
  useEffect(() => {
    if (!preferredProjectId || !projects.some((candidate) => candidate.id === preferredProjectId)) return;
    if (!saved?.enabled) setProjectId(preferredProjectId);
  }, [preferredProjectId, projects]);
  useEffect(() => {
    if (!project) return;
    if (!project.versions.some((version) => version.id === versionId)) setVersionId(project.versions[0]?.id || "");
  }, [project, versionId]);

  const persist = async (nextEnabled: boolean) => {
    const selectedProject = projects.find((candidate) => candidate.id === projectId);
    const version = selectedProject?.versions.find((candidate) => candidate.id === versionId);
    if (!selectedProject || !version || !selectedProject.canEdit) return;
    let resolveProjectName = saved?.resolveProjectName;
    let resolveTimelineName = saved?.resolveTimelineName;
    if (nextEnabled) {
      setError(null);
      const summary = await executeScript("poll_resolve_state", {}, false);
      const resolveState = summary.events.find((event) => event.type === "result")?.value as ResolveState | undefined;
      if (!resolveState?.connected || !resolveState.projectName || !resolveState.timelineName) {
        setError("Åpne riktig Resolve-prosjekt og timeline før du starter sync.");
        return;
      }
      resolveProjectName = resolveState.projectName;
      resolveTimelineName = resolveState.timelineName;
    }
    setEnabled(nextEnabled);
    saveVideoRoomMarkerSyncConfig({
      enabled: nextEnabled,
      projectId: selectedProject.id,
      projectName: selectedProject.name,
      versionId: version.id,
      versionLabel: version.label,
      resolveProjectName,
      resolveTimelineName,
    });
  };

  const statusColor = status.state === "synced" ? "#4ad48a" : status.state === "error" ? "#ef4f6f" : "#f0a500";
  return (
    <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid rgba(160,48,192,0.20)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div>
          <strong style={{ fontSize: 13 }}>Video Room ↔ Resolve-markører</strong>
          <div style={{ color: "#8674a8", fontSize: 11, marginTop: 2 }}>Kjører videre i bakgrunnen når du bytter visning i appen.</div>
        </div>
        <button onClick={() => void load()} disabled={loading} style={{ background: "transparent", color: "#a030c0", border: "1px solid rgba(160,48,192,0.4)", borderRadius: 6, padding: "4px 9px", fontSize: 11, cursor: "pointer" }}>
          {loading ? "Laster …" : "Oppdater"}
        </button>
      </div>
      {error && <div style={{ color: "#ef4f6f", fontSize: 11, marginTop: 7 }}>{error}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr) auto", gap: 8, marginTop: 9 }}>
        <select value={projectId} onChange={(event) => { if (enabled) void persist(false); setProjectId(event.target.value); setEnabled(false); }} style={{ minWidth: 0, background: "#1a0d45", color: "#f0eaff", border: "1px solid rgba(160,48,192,0.4)", borderRadius: 6, padding: "7px 8px" }}>
          <option value="">Velg Video Room</option>
          {projects.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}{candidate.canEdit ? "" : " (les)"}</option>)}
        </select>
        <select value={versionId} onChange={(event) => { if (enabled) void persist(false); setVersionId(event.target.value); setEnabled(false); }} disabled={!project} style={{ minWidth: 0, background: "#1a0d45", color: "#f0eaff", border: "1px solid rgba(160,48,192,0.4)", borderRadius: 6, padding: "7px 8px" }}>
          <option value="">Velg versjon</option>
          {(project?.versions || []).map((version) => <option key={version.id} value={version.id}>{version.label} · {version.status}</option>)}
        </select>
        <button onClick={() => void persist(!enabled)} disabled={!project?.canEdit || !versionId} style={{ background: enabled ? "rgba(239,79,111,0.16)" : "#6e3fc7", color: enabled ? "#ef4f6f" : "white", border: enabled ? "1px solid rgba(239,79,111,0.4)" : "none", borderRadius: 6, padding: "7px 12px", fontWeight: 600, cursor: project?.canEdit && versionId ? "pointer" : "default", whiteSpace: "nowrap" }}>
          {enabled ? "Stopp sync" : "Start sync"}
        </button>
      </div>
      {project && !project.canEdit && <div style={{ color: "#f0a500", fontSize: 11, marginTop: 7 }}>Du har lesetilgang, men trenger editorrettighet for å sende Resolve-markører inn.</div>}
      <div style={{ color: enabled ? statusColor : "#8674a8", fontSize: 11, marginTop: 7 }}>
        {enabled ? status.message : "Sync er av."}{enabled && status.markerCount != null ? ` · ${status.markerCount} markører` : ""}
      </div>
    </div>
  );
}
