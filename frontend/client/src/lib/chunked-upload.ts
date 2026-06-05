/**
 * Chunked upload-klient — resumable opplasting for store filer.
 *
 * Splitter en File i N chunks á CHUNK_SIZE, init'er en upload-sesjon
 * mot backend, og laster opp hver chunk sekvensielt med per-chunk retry
 * (3 forsøk med eksponensiell backoff).
 *
 * Upload-tilstand persisteres i localStorage per filnavn+størrelse, slik
 * at hvis sesjonen brytes (nettverkstap, faneClose, browser-restart) kan
 * neste forsøk plukke opp der det stoppet.
 *
 * Rot-fix for B5 i Fredrik-gap-analysen — 80GB bryllups-RAW kan nå
 * overleve hotell-wifi-drop uten å starte på nytt.
 */

const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB per chunk
const MAX_CHUNK_RETRIES = 3;
const BACKOFF_MS = [500, 1500, 3500];

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const persistKeyFor = (file: File): string =>
  `chunked-upload:${file.name}:${file.size}:${file.lastModified}`;

interface PersistedState {
  uploadId: string;
  receivedChunks: number[];
  totalChunks: number;
  startedAt: string;
}

const loadPersistedState = (file: File): PersistedState | null => {
  try {
    const raw = window.localStorage.getItem(persistKeyFor(file));
    return raw ? (JSON.parse(raw) as PersistedState) : null;
  } catch {
    return null;
  }
};

const persistState = (file: File, state: PersistedState): void => {
  try {
    window.localStorage.setItem(persistKeyFor(file), JSON.stringify(state));
  } catch {}
};

const clearPersistedState = (file: File): void => {
  try {
    window.localStorage.removeItem(persistKeyFor(file));
  } catch {}
};

export interface ChunkedUploadResult {
  success: true;
  fileId: string;
  fileName: string;
  size: number;
  downloadUrl: string;
  resumedFromBytes: number;
}

export interface ChunkedUploadOpts {
  authHeaders?: Record<string, string>;
  metadata?: Record<string, unknown>;
  onProgress?: (info: {
    chunkIndex: number;
    receivedCount: number;
    totalChunks: number;
    bytesUploaded: number;
    totalBytes: number;
    /** Gjennomsnittlig kB/s siste 30 sek. null før vi har nok samples. */
    throughputKbps: number | null;
    /** Estimert sekunder igjen til upload er ferdig. null før throughputKbps er klar. */
    etaSeconds: number | null;
  }) => void;
  signal?: AbortSignal;
}

interface InitResponse {
  success: boolean;
  uploadId: string;
  receivedChunks: number[];
  totalChunks: number;
  resumed: boolean;
  expiresAt: string;
  error?: string;
  message?: string;
}

const fetchJson = async <T,>(
  url: string,
  init: RequestInit,
): Promise<T> => {
  const res = await fetch(url, init);
  if (!res.ok) {
    let body = "";
    try {
      body = await res.text();
    } catch {}
    throw new Error(
      `${res.status} ${res.statusText}: ${body || "request failed"}`,
    );
  }
  return (await res.json()) as T;
};

const uploadChunkWithRetry = async (
  uploadId: string,
  chunkIndex: number,
  chunkBlob: Blob,
  authHeaders: Record<string, string>,
  signal?: AbortSignal,
): Promise<void> => {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < MAX_CHUNK_RETRIES; attempt++) {
    if (signal?.aborted) throw new Error("aborted");
    if (BACKOFF_MS[attempt] > 0 && attempt > 0) {
      await sleep(BACKOFF_MS[attempt - 1]);
    }
    try {
      const res = await fetch(
        `/api/chunked-upload/${uploadId}/chunks/${chunkIndex}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/octet-stream",
            ...authHeaders,
          },
          body: chunkBlob,
          signal,
        },
      );
      if (res.ok) return;
      // 4xx unntatt 409 (idempotent duplicate) bør ikke retryes
      const status = res.status;
      const bodyText = await res.text().catch(() => "");
      if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
        throw new Error(`HTTP ${status}: ${bodyText || "client error"}`);
      }
      lastError = new Error(`HTTP ${status}: ${bodyText || "retryable error"}`);
    } catch (err) {
      if (signal?.aborted) throw new Error("aborted");
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw lastError || new Error(`Chunk ${chunkIndex} feilet etter ${MAX_CHUNK_RETRIES} forsøk`);
};

export async function chunkedUpload(
  file: File,
  opts: ChunkedUploadOpts = {},
): Promise<ChunkedUploadResult> {
  const authHeaders = opts.authHeaders || {};
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

  // Sjekk om vi har en pågående upload å resume
  const persisted = loadPersistedState(file);

  // INIT
  const initBody: Record<string, unknown> = {
    fileName: file.name,
    fileSize: file.size,
    chunkSize: CHUNK_SIZE,
    totalChunks,
    mimeType: file.type || "application/octet-stream",
    metadata: opts.metadata || {},
  };
  if (persisted?.uploadId && persisted.totalChunks === totalChunks) {
    initBody.resumeUploadId = persisted.uploadId;
  }

  const init = await fetchJson<InitResponse>("/api/chunked-upload/init", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body: JSON.stringify(initBody),
    signal: opts.signal,
  });
  if (!init.success || !init.uploadId) {
    throw new Error(
      init.message || init.error || "Kunne ikke initialisere chunked upload",
    );
  }

  const uploadId = init.uploadId;
  let receivedSet = new Set<number>(init.receivedChunks || []);
  const startBytes = receivedSet.size * CHUNK_SIZE;

  persistState(file, {
    uploadId,
    receivedChunks: Array.from(receivedSet),
    totalChunks,
    startedAt: persisted?.startedAt || new Date().toISOString(),
  });

  // Throughput-tracking: liste over (timestamp, kumulative bytes)-samples
  // brukt til å beregne gjennomsnittlig opplastingshastighet over siste
  // 30 sek og dermed ETA. Initialiseres med startpunkt slik at vi har
  // første sample umiddelbart.
  const throughputSamples: Array<{ t: number; bytes: number }> = [
    { t: Date.now(), bytes: receivedSet.size * CHUNK_SIZE },
  ];

  // Last opp manglende chunks
  for (let i = 0; i < totalChunks; i++) {
    if (opts.signal?.aborted) {
      throw new Error("aborted");
    }
    if (receivedSet.has(i)) continue;
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunkBlob = file.slice(start, end);

    try {
      await uploadChunkWithRetry(uploadId, i, chunkBlob, authHeaders, opts.signal);
    } catch (err) {
      // Persister hva vi har fått til så langt
      persistState(file, {
        uploadId,
        receivedChunks: Array.from(receivedSet),
        totalChunks,
        startedAt: persisted?.startedAt || new Date().toISOString(),
      });
      throw err;
    }

    receivedSet.add(i);
    persistState(file, {
      uploadId,
      receivedChunks: Array.from(receivedSet),
      totalChunks,
      startedAt: persisted?.startedAt || new Date().toISOString(),
    });

    // ETA-beregning basert på siste 30-sek-vindu av throughput.
    // Throughput-samples (timestamp + cumulative bytes) gjør at vi kan
    // håndtere både hetekjøring og treg-nett-perioder uten å la et
    // gammelt langsomt øyeblikk ødelegge for et nytt, kjapt et.
    const now = Date.now();
    const bytesNow = Math.min(receivedSet.size * CHUNK_SIZE, file.size);
    throughputSamples.push({ t: now, bytes: bytesNow });
    // Behold kun samples fra siste 30 sekunder
    while (
      throughputSamples.length > 1 &&
      now - throughputSamples[0].t > 30_000
    ) {
      throughputSamples.shift();
    }
    let throughputKbps: number | null = null;
    let etaSeconds: number | null = null;
    if (throughputSamples.length >= 2) {
      const first = throughputSamples[0];
      const last = throughputSamples[throughputSamples.length - 1];
      const deltaBytes = last.bytes - first.bytes;
      const deltaMs = last.t - first.t;
      if (deltaMs > 0 && deltaBytes > 0) {
        const bytesPerSec = (deltaBytes / deltaMs) * 1000;
        throughputKbps = Math.round(bytesPerSec / 1024);
        const remaining = file.size - bytesNow;
        if (remaining > 0) {
          etaSeconds = Math.ceil(remaining / bytesPerSec);
        }
      }
    }

    opts.onProgress?.({
      chunkIndex: i,
      receivedCount: receivedSet.size,
      totalChunks,
      bytesUploaded: bytesNow,
      totalBytes: file.size,
      throughputKbps,
      etaSeconds,
    });
  }

  // FINISH
  const finishRes = await fetchJson<{
    success: boolean;
    fileId: string;
    fileName: string;
    size: number;
    downloadUrl: string;
    error?: string;
    message?: string;
  }>(`/api/chunked-upload/${uploadId}/finish`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body: JSON.stringify({}),
    signal: opts.signal,
  });
  if (!finishRes.success) {
    throw new Error(
      finishRes.message || finishRes.error || "Kunne ikke assemblere chunks",
    );
  }

  clearPersistedState(file);

  return {
    success: true,
    fileId: finishRes.fileId,
    fileName: finishRes.fileName,
    size: finishRes.size,
    downloadUrl: finishRes.downloadUrl,
    resumedFromBytes: startBytes,
  };
}

export const CHUNKED_UPLOAD_THRESHOLD_BYTES = 25 * 1024 * 1024; // 25 MB

export const shouldUseChunkedUpload = (file: File): boolean =>
  file.size >= CHUNKED_UPLOAD_THRESHOLD_BYTES;

export const cancelChunkedUpload = async (
  uploadId: string,
  authHeaders: Record<string, string> = {},
): Promise<void> => {
  try {
    await fetch(`/api/chunked-upload/${uploadId}`, {
      method: "DELETE",
      headers: authHeaders,
    });
  } catch {}
};
