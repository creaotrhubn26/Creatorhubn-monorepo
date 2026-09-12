import type { ResolveMarker, ResolveState } from "../hooks/useResolveSync";
import type { VideoRoomNleMarker } from "../api";

export const VIDEO_ROOM_SYNC_CONFIG_KEY = "trrpa.videoRoomResolveSync";
export const VIDEO_ROOM_SYNC_CONFIG_EVENT = "trrpa:video-room-sync-config-changed";
export const VIDEO_ROOM_SYNC_STATUS_EVENT = "trrpa:video-room-sync-status";

export interface VideoRoomMarkerSyncConfig {
  enabled: boolean;
  projectId: string;
  projectName: string;
  versionId: string;
  versionLabel: string;
  resolveProjectName?: string;
  resolveTimelineName?: string;
}

export interface VideoRoomMarkerSyncStatus {
  state: "disabled" | "connecting" | "synced" | "resolve_closed" | "error";
  message: string;
  syncedAt?: number;
  markerCount?: number;
}

export function loadVideoRoomMarkerSyncConfig(): VideoRoomMarkerSyncConfig | null {
  try {
    const raw = localStorage.getItem(VIDEO_ROOM_SYNC_CONFIG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<VideoRoomMarkerSyncConfig>;
    if (!parsed.projectId || !parsed.versionId) return null;
    return {
      enabled: parsed.enabled !== false,
      projectId: parsed.projectId,
      projectName: parsed.projectName || parsed.projectId,
      versionId: parsed.versionId,
      versionLabel: parsed.versionLabel || parsed.versionId,
      resolveProjectName: parsed.resolveProjectName || undefined,
      resolveTimelineName: parsed.resolveTimelineName || undefined,
    };
  } catch {
    return null;
  }
}

export function saveVideoRoomMarkerSyncConfig(config: VideoRoomMarkerSyncConfig | null): void {
  if (config) localStorage.setItem(VIDEO_ROOM_SYNC_CONFIG_KEY, JSON.stringify(config));
  else localStorage.removeItem(VIDEO_ROOM_SYNC_CONFIG_KEY);
  window.dispatchEvent(new CustomEvent(VIDEO_ROOM_SYNC_CONFIG_EVENT));
}

function hashMarker(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function resolveMarkersToVideoRoom(state: ResolveState): VideoRoomNleMarker[] {
  return state.markers.flatMap((marker: ResolveMarker) => {
    const customData = marker.customData?.trim() || "";
    let id: string;
    if (customData.startsWith("ce:creatorhub:") || customData.startsWith("ce:resolve-native:")) {
      id = customData.slice(3);
    } else if (customData) {
      // Markers owned by other Post Agent/AI tools are not review comments.
      return [];
    } else {
      id = `resolve-native:${hashMarker(`${state.timelineName || "timeline"}|${marker.frame}|${marker.name}|${marker.note}|${marker.color}`)}`;
    }
    const prefixedCompleted = /^\[FERDIG\]\s*/i.test(marker.name);
    const withoutCompleted = marker.name.replace(/^\[FERDIG\]\s*/i, "");
    const prefixedMustFix = /^\[MÅ FIKSES\]\s*/i.test(withoutCompleted);
    const title = withoutCompleted.replace(/^\[MÅ FIKSES\]\s*/i, "").trim() || marker.note.trim() || "Resolve-markør";
    return [{
      id,
      timecodeSec: Math.max(0, marker.sec),
      title,
      note: marker.note || title,
      color: marker.color || "Blue",
      completed: prefixedCompleted || marker.color === "Green",
      mustFix: prefixedMustFix || ["Red", "Pink"].includes(marker.color),
    }];
  });
}

export function videoRoomMarkersForResolve(markers: VideoRoomNleMarker[]): Array<{
  id: string; timeSec: number; label: string; color: string; comment: string;
}> {
  return markers.map((marker) => ({
    id: marker.id,
    timeSec: Math.max(0, Number(marker.timecodeSec) || 0),
    label: `${marker.completed ? "[FERDIG] " : marker.mustFix ? "[MÅ FIKSES] " : ""}${marker.title || "Video Room"}`,
    color: marker.completed ? "Green" : marker.mustFix ? "Red" : marker.color || "Blue",
    comment: marker.note || marker.title || "Video Room",
  }));
}

export function markerSnapshotSignature(markers: unknown[]): string {
  return JSON.stringify(markers);
}
