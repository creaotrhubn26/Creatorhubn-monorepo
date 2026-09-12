export interface EaseVerseProToolsMarker {
  id?: string;
  name: string;
  startSeconds: number;
  endSeconds?: number;
  timecode?: string;
  color?: string;
  sectionType?: string;
}

export interface EaseVerseProToolsSyncPayload {
  schemaVersion?: 1;
  eventId?: string;
  revision?: number;
  ownerUserId?: string;
  externalTrackId: string;
  workspaceProjectId?: string;
  audioReviewProjectId?: string;
  easeverseProjectId?: string;
  proToolsSessionId?: string;
  /** @deprecated Use audioReviewProjectId. */
  projectId?: string;
  bpm?: number;
  keySignature?: string;
  timeSignature?: string;
  markers: EaseVerseProToolsMarker[];
  updatedAt?: string;
}

export interface EaseVerseProToolsSyncResult {
  configured: boolean;
  synced: boolean;
  status?: number;
  storage?: string;
  reason?: "missing_api_url" | "missing_api_key" | "invalid_track" | "invalid_audio_url" | "track_not_linked" | "http_error" | "timeout" | "network_error";
}

type FetchLike = typeof fetch;

function config(options: { apiUrl?: string; apiKey?: string }): { apiUrl: string; apiKey: string } {
  return {
    apiUrl: (options.apiUrl ?? process.env.EASEVERSE_API_URL ?? "").trim().replace(/\/+$/, ""),
    apiKey: (options.apiKey ?? process.env.EASEVERSE_API_KEY ?? "").trim(),
  };
}

export async function pushProToolsSyncToEaseVerse(
  payload: EaseVerseProToolsSyncPayload,
  options: { apiUrl?: string; apiKey?: string; fetchImpl?: FetchLike; timeoutMs?: number } = {},
): Promise<EaseVerseProToolsSyncResult> {
  const { apiUrl, apiKey } = config(options);
  const externalTrackId = String(payload.externalTrackId || "").trim();
  if (!apiUrl) return { configured: false, synced: false, reason: "missing_api_url" };
  if (!apiKey) return { configured: false, synced: false, reason: "missing_api_key" };
  if (!externalTrackId) return { configured: true, synced: false, reason: "invalid_track" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 6000);
  try {
    const response = await (options.fetchImpl ?? fetch)(`${apiUrl}/api/v1/collab/protools`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({
        schemaVersion: 1,
        eventId: payload.eventId || undefined,
        revision: Number.isSafeInteger(payload.revision) ? payload.revision : undefined,
        ownerUserId: payload.ownerUserId || undefined,
        externalTrackId,
        projectId: payload.audioReviewProjectId || payload.projectId || undefined,
        integrationContext: {
          creatorhubProjectId: payload.workspaceProjectId || undefined,
          audioReviewProjectId: payload.audioReviewProjectId || payload.projectId || undefined,
          easeverseProjectId: payload.easeverseProjectId || undefined,
          proToolsSessionId: payload.proToolsSessionId || undefined,
        },
        source: "creatorhub-protools-companion",
        bpm: Number.isFinite(payload.bpm) ? Math.round(payload.bpm as number) : undefined,
        keySignature: payload.keySignature || undefined,
        timeSignature: payload.timeSignature || undefined,
        markers: (Array.isArray(payload.markers) ? payload.markers : []).map((marker, index) => ({
          id: marker.id || `marker-${index + 1}`,
          label: marker.name,
          positionMs: Math.max(0, Math.round(marker.startSeconds * 1000)),
          ...(Number.isFinite(marker.endSeconds) ? { endPositionMs: Math.max(0, Math.round((marker.endSeconds as number) * 1000)) } : {}),
          ...(marker.timecode ? { timecode: marker.timecode } : {}),
          ...(marker.color ? { color: marker.color } : {}),
          ...(marker.sectionType ? { sectionType: marker.sectionType } : {}),
        })),
        takeScores: [],
        pronunciationFeedback: [],
        updatedAt: payload.updatedAt || new Date().toISOString(),
      }),
      signal: controller.signal,
    });
    const body: any = await response.json().catch(() => null);
    if (!response.ok) return { configured: true, synced: false, status: response.status, reason: "http_error" };
    return { configured: true, synced: true, status: response.status, storage: typeof body?.storage === "string" ? body.storage : undefined };
  } catch (error: any) {
    return { configured: true, synced: false, reason: error?.name === "AbortError" ? "timeout" : "network_error" };
  } finally {
    clearTimeout(timer);
  }
}

export async function pushApprovedReferenceMixToEaseVerse(
  payload: { ownerUserId: string; externalTrackId: string; url: string; name?: string | null; durationSec?: number | null },
  options: { apiUrl?: string; apiKey?: string; fetchImpl?: FetchLike; timeoutMs?: number } = {},
): Promise<EaseVerseProToolsSyncResult> {
  const { apiUrl, apiKey } = config(options);
  if (!apiUrl) return { configured: false, synced: false, reason: "missing_api_url" };
  if (!apiKey) return { configured: false, synced: false, reason: "missing_api_key" };
  if (!payload.externalTrackId || !payload.ownerUserId || !payload.url) return { configured: true, synced: false, reason: "invalid_track" };
  try {
    if (new URL(payload.url).protocol !== "https:") return { configured: true, synced: false, reason: "invalid_audio_url" };
  } catch {
    return { configured: true, synced: false, reason: "invalid_audio_url" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 6000);
  try {
    const response = await (options.fetchImpl ?? fetch)(`${apiUrl}/api/v1/collab/reference`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({
        schemaVersion: 1,
        ownerUserId: payload.ownerUserId,
        externalTrackId: payload.externalTrackId,
        url: payload.url,
        name: payload.name || undefined,
        durationSec: Number.isFinite(payload.durationSec) ? payload.durationSec : undefined,
      }),
      signal: controller.signal,
    });
    if (!response.ok) return { configured: true, synced: false, status: response.status, reason: "http_error" };
    return { configured: true, synced: true, status: response.status };
  } catch (error: any) {
    return { configured: true, synced: false, reason: error?.name === "AbortError" ? "timeout" : "network_error" };
  } finally {
    clearTimeout(timer);
  }
}
