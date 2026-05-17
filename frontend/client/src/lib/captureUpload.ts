// Slice 9X.16 — multipart upload helper for capture-assets fra web-UI.
// Implementerer den eksisterende /api/capture/assets/:id/upload/{start,parts,complete}-
// kontrakten, men pakket som en enkelt `uploadFile()`-call frontend kan
// kjøre per fil med progress-callback.
//
// Flow per fil:
//   1. POST /api/capture/sessions/:sessionId/assets — register asset
//   2. POST /api/capture/assets/:assetId/upload/start — get multipart-init
//   3. For hver chunk: POST /api/capture/assets/:assetId/upload/parts → signed PUT URL
//   4. PUT chunk direkte til R2/S3, samle ETag
//   5. POST /api/capture/assets/:assetId/upload/complete — finalize

import { apiRequest } from './queryClient';

const DEFAULT_PART_SIZE = 8 * 1024 * 1024; // 8MB
const MAX_PARALLEL_PARTS = 3;

// Slice 9X.20 — EXIF auto-tagging
// Parser EXIF i nettleseren før upload (kun første 256KB trengs for JPEG,
// noe mer for RAW). Sender deretter til backend slik at capture_assets får
// tags som "canon-eos-r5", "85mm", "iso-1600", "f-2-8", "2026-05".
interface ExtractedExif {
  cameraMake?: string;
  cameraModel?: string;
  lensModel?: string;
  lensMake?: string;
  iso?: number;
  aperture?: number;
  shutterSpeed?: string;
  shutterSpeedSec?: number;
  focalLength?: number;
  focalLengthIn35mm?: number;
  captureDate?: string;
  gpsLat?: number;
  gpsLng?: number;
  gpsAlt?: number;
  orientation?: number;
  flashFired?: boolean;
  whiteBalance?: string;
  exposureMode?: string;
  meteringMode?: string;
  software?: string;
}

async function parseExifFromFile(file: File): Promise<ExtractedExif | null> {
  try {
    // Dynamic import så exifr ikke laster med initial bundle
    const { default: exifr } = await import('exifr');
    // Parse first 512KB — enough for EXIF in JPEG/HEIC + most RAW formats
    const slice = file.slice(0, 512 * 1024);
    const buffer = await slice.arrayBuffer();
    // exifr aksepterer `pick` ALENE (filtrerer på tvers av alle segments) eller
    // segment-flags som standalone. Vi bruker pick + gps for kompakt output.
    const raw = await exifr.parse(buffer as ArrayBuffer, {
      gps: true,
      pick: [
        'Make', 'Model', 'LensModel', 'LensMake',
        'ISO', 'ISOSpeedRatings',
        'FNumber', 'ApertureValue',
        'ExposureTime', 'ShutterSpeedValue',
        'FocalLength', 'FocalLengthIn35mmFormat',
        'DateTimeOriginal', 'CreateDate',
        'Orientation', 'Flash',
        'WhiteBalance', 'ExposureMode', 'MeteringMode',
        'Software',
        'latitude', 'longitude', 'altitude',
      ],
    } as any);
    if (!raw) return null;

    // Konstruer shutter-speed-string fra ExposureTime
    let shutterSpeed: string | undefined;
    let shutterSpeedSec: number | undefined;
    if (typeof raw.ExposureTime === 'number') {
      shutterSpeedSec = raw.ExposureTime;
      if (raw.ExposureTime >= 1) {
        shutterSpeed = `${raw.ExposureTime}s`;
      } else {
        shutterSpeed = `1/${Math.round(1 / raw.ExposureTime)}`;
      }
    }

    const captureDate = raw.DateTimeOriginal ?? raw.CreateDate;
    const captureDateISO = captureDate instanceof Date
      ? captureDate.toISOString()
      : (typeof captureDate === 'string' ? captureDate : undefined);

    const result: ExtractedExif = {
      cameraMake: raw.Make,
      cameraModel: raw.Model,
      lensModel: raw.LensModel,
      lensMake: raw.LensMake,
      iso: raw.ISO ?? raw.ISOSpeedRatings,
      aperture: raw.FNumber ?? raw.ApertureValue,
      shutterSpeed,
      shutterSpeedSec,
      focalLength: raw.FocalLength,
      focalLengthIn35mm: raw.FocalLengthIn35mmFormat,
      captureDate: captureDateISO,
      gpsLat: raw.latitude,
      gpsLng: raw.longitude,
      gpsAlt: raw.altitude,
      orientation: raw.Orientation,
      flashFired: typeof raw.Flash === 'number' ? (raw.Flash & 1) === 1 : undefined,
      whiteBalance: typeof raw.WhiteBalance === 'number'
        ? (raw.WhiteBalance === 0 ? 'auto' : 'manual') : undefined,
      exposureMode: typeof raw.ExposureMode === 'number'
        ? ['auto', 'manual', 'auto-bracket'][raw.ExposureMode] : undefined,
      meteringMode: typeof raw.MeteringMode === 'number'
        ? ['unknown', 'average', 'center-weighted', 'spot', 'multi-spot', 'pattern', 'partial'][raw.MeteringMode]
        : undefined,
      software: raw.Software,
    };

    // Fjern undefined-verdier
    return Object.fromEntries(
      Object.entries(result).filter(([, v]) => v !== undefined && v !== null && v !== ''),
    ) as ExtractedExif;
  } catch (err) {
    console.warn('[exif] parse failed (non-fatal):', err);
    return null;
  }
}

export type { ExtractedExif };
export { parseExifFromFile };

export interface UploadProgress {
  bytesUploaded: number;
  totalBytes: number;
  pct: number;
  phase: 'registering' | 'starting' | 'uploading' | 'completing' | 'done' | 'error';
}

export interface UploadResult {
  assetId: string;
  key: string;
  sizeBytes: number;
  exif?: ExtractedExif | null;
  tags?: string[];
}

interface MultipartStartResponse {
  uploadId: string;
  key: string;
  partSize: number;
  partUrls?: Array<{ partNumber: number; url: string }>;
}

interface MultipartPartsResponse {
  partUrls: Array<{ partNumber: number; url: string }>;
}

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function readFileToBuffer(file: File): Promise<ArrayBuffer> {
  return await file.arrayBuffer();
}

async function putChunkWithRetry(
  url: string,
  blob: Blob,
  attempts = 3,
): Promise<string> {
  let lastErr: unknown = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        method: 'PUT',
        body: blob,
        // Ingen custom headers — signed URL spesifiserer alt nødvendig
      });
      if (!res.ok) {
        throw new Error(`PUT chunk failed ${res.status}`);
      }
      const etag = res.headers.get('ETag') || res.headers.get('etag');
      if (!etag) {
        throw new Error('No ETag in chunk response');
      }
      return etag.replace(/"/g, '');
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500 * Math.pow(2, i)));
      }
    }
  }
  throw lastErr ?? new Error('PUT chunk failed');
}

/**
 * Last opp én fil til en capture-session via multipart-flow. Kaller
 * onProgress jevnlig så caller kan oppdatere progress-bar.
 */
export async function uploadFileToSession(args: {
  sessionId: string;
  file: File;
  onProgress?: (p: UploadProgress) => void;
}): Promise<UploadResult> {
  const { sessionId, file, onProgress } = args;
  const totalBytes = file.size;
  const emit = (phase: UploadProgress['phase'], bytesUploaded: number) => {
    onProgress?.({
      bytesUploaded,
      totalBytes,
      pct: totalBytes > 0 ? Math.round((bytesUploaded / totalBytes) * 100) : 0,
      phase,
    });
  };

  try {
    emit('registering', 0);

    // Slice 9X.20 — parse EXIF parallelt med register-asset.
    // Bruk EXIF DateTimeOriginal som captureTime hvis tilgjengelig så
    // capture_assets.capture_time matcher når kameraet faktisk tok bildet
    // (ikke når Stine lastet opp).
    const exifPromise = parseExifFromFile(file);
    const exif = await exifPromise;
    const captureTime = exif?.captureDate
      ? new Date(exif.captureDate).toISOString()
      : new Date(file.lastModified || Date.now()).toISOString();

    // 1. Register asset
    const registered = await apiRequest(`/api/capture/sessions/${sessionId}/assets`, {
      method: 'POST',
      body: JSON.stringify({
        originalFilename: file.name,
        captureTime,
        mime: file.type || 'application/octet-stream',
        sizeBytes: totalBytes,
      }),
      headers: { 'Content-Type': 'application/json' },
    }) as { id: string };

    const assetId = registered.id;

    // 2. Start multipart upload
    emit('starting', 0);
    const startRes = await apiRequest(`/api/capture/assets/${assetId}/upload/start`, {
      method: 'POST',
      body: JSON.stringify({
        kind: 'full',
        sizeBytes: totalBytes,
        mime: file.type || 'application/octet-stream',
        preferredPartSize: DEFAULT_PART_SIZE,
      }),
      headers: { 'Content-Type': 'application/json' },
    }) as MultipartStartResponse;

    const { uploadId, key, partSize } = startRes;
    const effectivePartSize = partSize || DEFAULT_PART_SIZE;
    const partCount = Math.max(1, Math.ceil(totalBytes / effectivePartSize));
    const partNumbers = Array.from({ length: partCount }, (_, i) => i + 1);

    // 3. Get signed URLs for all parts (or use partUrls if already returned)
    let partUrls = startRes.partUrls;
    if (!partUrls || partUrls.length < partCount) {
      const partsRes = await apiRequest(`/api/capture/assets/${assetId}/upload/parts`, {
        method: 'POST',
        body: JSON.stringify({ uploadId, key, partNumbers }),
        headers: { 'Content-Type': 'application/json' },
      }) as MultipartPartsResponse;
      partUrls = partsRes.partUrls;
    }
    const urlMap = new Map(partUrls.map((p) => [p.partNumber, p.url]));

    // 4. Upload chunks (parallelt med begrenset concurrency)
    const completedParts: Array<{ partNumber: number; etag: string }> = [];
    let bytesUploaded = 0;

    async function uploadOne(partNumber: number): Promise<void> {
      const start = (partNumber - 1) * effectivePartSize;
      const end = Math.min(start + effectivePartSize, totalBytes);
      const chunk = file.slice(start, end);
      const url = urlMap.get(partNumber);
      if (!url) throw new Error(`No signed URL for part ${partNumber}`);
      const etag = await putChunkWithRetry(url, chunk);
      completedParts.push({ partNumber, etag });
      bytesUploaded += chunk.size;
      emit('uploading', bytesUploaded);
    }

    // Process in batches of MAX_PARALLEL_PARTS
    for (let i = 0; i < partNumbers.length; i += MAX_PARALLEL_PARTS) {
      const batch = partNumbers.slice(i, i + MAX_PARALLEL_PARTS);
      await Promise.all(batch.map(uploadOne));
    }

    completedParts.sort((a, b) => a.partNumber - b.partNumber);

    // 5. Compute checksum + complete
    emit('completing', totalBytes);
    const buffer = await readFileToBuffer(file);
    const checksumSha256 = await sha256Hex(buffer);

    await apiRequest(`/api/capture/assets/${assetId}/upload/complete`, {
      method: 'POST',
      body: JSON.stringify({
        kind: 'full',
        uploadId,
        key,
        parts: completedParts,
        checksumSha256,
        sizeBytes: totalBytes,
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    // Slice 9X.20 — send EXIF til backend etter complete (best-effort).
    // Tags genereres server-side fra EXIF-feltene.
    let serverTags: string[] | undefined;
    if (exif && Object.keys(exif).length > 0) {
      try {
        const exifResult = await apiRequest(`/api/capture/assets/${assetId}/exif`, {
          method: 'POST',
          body: JSON.stringify({ exif }),
          headers: { 'Content-Type': 'application/json' },
        }) as { tags: string[]; exif: ExtractedExif };
        serverTags = exifResult.tags;
      } catch (exifErr) {
        console.warn('[exif] backend save failed (non-fatal):', exifErr);
      }
    }

    emit('done', totalBytes);

    return { assetId, key, sizeBytes: totalBytes, exif, tags: serverTags };
  } catch (err) {
    emit('error', 0);
    throw err;
  }
}
