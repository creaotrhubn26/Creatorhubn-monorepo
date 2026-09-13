import { useCallback, useEffect, useRef, useState } from "react";

import {
  executeScript,
  fetchVideoRoomResolveMarkers,
  pushVideoRoomResolveMarkers,
} from "../api";
import type { ResolveState } from "../hooks/useResolveSync";
import {
  loadVideoRoomMarkerSyncConfig,
  markerSnapshotSignature,
  resolveMarkersToVideoRoom,
  VIDEO_ROOM_SYNC_CONFIG_EVENT,
  VIDEO_ROOM_SYNC_STATUS_EVENT,
  videoRoomMarkersForResolve,
  type VideoRoomMarkerSyncConfig,
  type VideoRoomMarkerSyncStatus,
} from "../services/videoRoomMarkerSyncService";

function publishStatus(status: VideoRoomMarkerSyncStatus): void {
  window.dispatchEvent(new CustomEvent(VIDEO_ROOM_SYNC_STATUS_EVENT, { detail: status }));
}

async function pollResolve(): Promise<ResolveState | null> {
  const summary = await executeScript("poll_resolve_state", {}, false);
  const error = summary.events.find((event) => event.type === "error");
  if (error) throw new Error((error.value as { message?: string })?.message || "Resolve-poll feilet");
  return (summary.events.find((event) => event.type === "result")?.value as ResolveState | undefined) || null;
}

async function pushCloudMarkers(markers: ReturnType<typeof videoRoomMarkersForResolve>): Promise<void> {
  const summary = await executeScript("push_markers_to_resolve", { markers: markers.map((marker) => ({
    id: marker.id,
    sec: marker.timeSec,
    label: marker.label,
    color: marker.color,
    comment: marker.comment,
  })), removeMissingCreatorHub: true }, false);
  const error = summary.events.find((event) => event.type === "error");
  if (error) throw new Error((error.value as { message?: string })?.message || "Marker-push feilet");
  const result = summary.events.find((event) => event.type === "result")?.value as { failed?: number; conflicts?: number } | undefined;
  if (result?.failed) throw new Error(`${result.failed} Video Room-markører feilet ved plassering i Resolve.`);
  if (result?.conflicts) throw new Error(`${result.conflicts} Video Room-markører kolliderer med en annen markør på samme frame.`);
}

export function VideoRoomMarkerSyncBridge(): null {
  const [config, setConfig] = useState<VideoRoomMarkerSyncConfig | null>(() => loadVideoRoomMarkerSyncConfig());
  const running = useRef(false);
  const connectedKey = useRef("");
  const lastLocalSignature = useRef("");
  const lastCloudSignature = useRef("");

  useEffect(() => {
    const reload = () => setConfig(loadVideoRoomMarkerSyncConfig());
    window.addEventListener(VIDEO_ROOM_SYNC_CONFIG_EVENT, reload);
    window.addEventListener("storage", reload);
    return () => {
      window.removeEventListener(VIDEO_ROOM_SYNC_CONFIG_EVENT, reload);
      window.removeEventListener("storage", reload);
    };
  }, []);

  const syncOnce = useCallback(async () => {
    if (!config?.enabled || running.current) return;
    running.current = true;
    const key = `${config.projectId}:${config.versionId}`;
    try {
      publishStatus({ state: "connecting", message: `Synker ${config.projectName} · ${config.versionLabel}` });
      let resolveState = await pollResolve();
      if (!resolveState?.connected || !resolveState.timelineName) {
        publishStatus({ state: "resolve_closed", message: "Åpne et Resolve-prosjekt med en aktiv timeline." });
        return;
      }
      if (!config.resolveProjectName || !config.resolveTimelineName) {
        throw new Error("Stopp og start sync på nytt for å binde den til riktig Resolve-timeline.");
      }
      if (resolveState.projectName !== config.resolveProjectName || resolveState.timelineName !== config.resolveTimelineName) {
        throw new Error(`Sync er bundet til ${config.resolveProjectName} · ${config.resolveTimelineName}. Bytt tilbake i Resolve eller start sync på nytt.`);
      }

      if (connectedKey.current !== key) {
        // First connect: canonical review feedback wins over a potentially
        // stale local copy. Unmanaged native markers remain and are uploaded
        // after the cloud markers have been applied.
        const cloud = await fetchVideoRoomResolveMarkers(config.projectId, config.versionId);
        await pushCloudMarkers(videoRoomMarkersForResolve(cloud.markers));
        resolveState = await pollResolve();
        connectedKey.current = key;
        lastCloudSignature.current = markerSnapshotSignature(cloud.markers);
      } else {
        // Subsequent loops publish local edits first. The following cloud pull
        // therefore contains those edits plus any new browser feedback.
        const local = resolveMarkersToVideoRoom(resolveState);
        const localSignature = markerSnapshotSignature(local);
        if (local.length && localSignature !== lastLocalSignature.current) {
          await pushVideoRoomResolveMarkers(config.projectId, config.versionId, local);
          lastLocalSignature.current = localSignature;
        }
      }

      const cloud = await fetchVideoRoomResolveMarkers(config.projectId, config.versionId);
      const cloudSignature = markerSnapshotSignature(cloud.markers);
      if (cloudSignature !== lastCloudSignature.current) {
        await pushCloudMarkers(videoRoomMarkersForResolve(cloud.markers));
        lastCloudSignature.current = cloudSignature;
        resolveState = await pollResolve();
      }

      if (!resolveState?.connected || !resolveState.timelineName) {
        throw new Error("Resolve mistet aktiv timeline under synk.");
      }
      const local = resolveMarkersToVideoRoom(resolveState);
      if (local.length) {
        const localSignature = markerSnapshotSignature(local);
        if (localSignature !== lastLocalSignature.current) {
          await pushVideoRoomResolveMarkers(config.projectId, config.versionId, local);
          lastLocalSignature.current = localSignature;
        }
      } else {
        lastLocalSignature.current = "[]";
      }
      publishStatus({ state: "synced", message: `${config.projectName} · ${config.versionLabel}`, markerCount: cloud.markers.length, syncedAt: Date.now() });
    } catch (error) {
      publishStatus({ state: "error", message: (error as Error).message || "Video Room-sync feilet" });
    } finally {
      running.current = false;
    }
  }, [config]);

  useEffect(() => {
    connectedKey.current = "";
    lastLocalSignature.current = "";
    lastCloudSignature.current = "";
    if (!config?.enabled) {
      publishStatus({ state: "disabled", message: "Video Room-sync er av." });
      return;
    }
    void syncOnce();
    const interval = window.setInterval(() => void syncOnce(), 8_000);
    return () => window.clearInterval(interval);
  }, [config?.enabled, config?.projectId, config?.versionId, syncOnce]);

  return null;
}
