export interface EaseVerseProToolsMarker {
  name: string;
  startSeconds: number;
  endSeconds?: number;
  timecode?: string;
  color?: string;
}

export interface EaseVerseProToolsSyncPayload {
  externalTrackId: string;
  projectId?: string;
  bpm?: number;
  markers: EaseVerseProToolsMarker[];
  updatedAt?: string;
}

export interface EaseVerseProToolsSyncResult {
  configured: boolean;
  synced: boolean;
  status?: number;
  storage?: string;
  reason?: "missing_api_url" | "missing_api_key" | "invalid_track" | "track_not_linked" | "http_error" | "timeout" | "network_error";
}

type FetchLike = typeof fetch;

/**
 * Mirrors the canonical Companion marker snapshot to EaseVerse. This is
 * deliberately best-effort: CreatorHub remains the source of truth for the
 * Workspace/Sound Room write even when the external service is unavailable.
 */
export async function pushProToolsSyncToEaseVerse(
  payload: EaseVerseProToolsSyncPayload,
  options: {
    apiUrl?: string;
    apiKey?: string;
    fetchImpl?: FetchLike;
    timeoutMs?: number;
  } = {},
): Promise<EaseVerseProToolsSyncResult> {
  const apiUrl = (options.apiUrl ?? process.env.EASEVERSE_API_URL ?? "").trim().replace(/\/+$/, "");
  const apiKey = (options.apiKey ?? process.env.EASEVERSE_API_KEY ?? "").trim();
  const externalTrackId = String(payload.externalTrackId || "").trim();

  if (!apiUrl) return { configured: false, synced: false, reason: "missing_api_url" };
  if (!apiKey) return { configured: false, synced: false, reason: "missing_api_key" };
  if (!externalTrackId) return { configured: true, synced: false, reason: "invalid_track" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 6000);
  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl(`${apiUrl}/api/v1/collab/protools`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        externalTrackId,
        projectId: payload.projectId || undefined,
        source: "creatorhub-protools-companion",
        bpm: Number.isFinite(payload.bpm) ? Math.round(payload.bpm as number) : undefined,
        markers: Array.isArray(payload.markers) ? payload.markers : [],
        takeScores: [],
        pronunciationFeedback: [],
        updatedAt: payload.updatedAt || new Date().toISOString(),
      }),
      signal: controller.signal,
    });
    const body: any = await response.json().catch(() => null);
    if (!response.ok) return { configured: true, synced: false, status: response.status, reason: "http_error" };
    return {
      configured: true,
      synced: true,
      status: response.status,
      storage: typeof body?.storage === "string" ? body.storage : undefined,
    };
  } catch (error: any) {
    return {
      configured: true,
      synced: false,
      reason: error?.name === "AbortError" ? "timeout" : "network_error",
    };
  } finally {
    clearTimeout(timer);
  }
}
