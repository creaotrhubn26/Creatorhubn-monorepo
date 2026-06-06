/**
 * exportMockupVideo — ren, rammuavhengig kjerne for "video → mockup → video".
 *
 * Tar en spilbar HTMLVideoElement-kilde, tegner hver frame inn i en device-
 * mockup på en offscreen-canvas, og spiller canvasen inn til én video-blob via
 * MediaRecorder. Ingen React — [[useMockupVideoExporter]] er kun et tynt
 * hook-lag oppå denne, og Playwright-testen kaller den direkte.
 *
 * Robusthet:
 *   - Velger beste støttede mime-type (webm vp9 → vp8 → mp4), feiler tydelig
 *     hvis MediaRecorder/captureStream mangler.
 *   - `maxDurationMs` som sikkerhetsnett mot kilder uten 'ended' (f.eks. live
 *     streams eller loop=true) — opptaket stoppes uansett.
 *   - Stopper og rydder alle tracks/timere i `finally`, også ved feil/abort.
 *   - `signal` (AbortSignal) avbryter rent.
 */

import { renderMockupFrame, type MockupRenderOptions } from './renderMockupFrame';
import { getDeviceGeometry } from './deviceGeometry';

export interface ExportMockupVideoOptions extends MockupRenderOptions {
  /** Oppløsnings-multiplier på device-geometrien. Default 5 (≈ 1080p skjerm). */
  pixelRatio?: number;
  /** Bilderate på opptaket. Default 30. */
  frameRate?: number;
  /** Video-bitrate. Default 8 Mbps. */
  videoBitsPerSecond?: number;
  /** Ta med kildens lydspor hvis det finnes. Default true. */
  includeAudio?: boolean;
  /** Hardt tak på opptakslengde (ms). Default 5 min. */
  maxDurationMs?: number;
  /** Valgfri canvas å tegne på (ellers lages en offscreen). */
  canvas?: HTMLCanvasElement;
  /** Avbryt opptaket. */
  signal?: AbortSignal;
  /** Framdrift 0..1 basert på kildens currentTime/duration. */
  onProgress?: (progress: number) => void;
}

export interface ExportMockupVideoResult {
  blob: Blob;
  mimeType: string;
  /** Filending som matcher mime ('webm' | 'mp4'). */
  extension: string;
  width: number;
  height: number;
}

const MIME_CANDIDATES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4',
];

export function pickMockupMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const mime of MIME_CANDIDATES) {
    try {
      if (MediaRecorder.isTypeSupported(mime)) return mime;
    } catch {
      // Eldre Safari kaster i stedet for å returnere false.
    }
  }
  return null;
}

/** Sann hvis nettleseren har alt vi trenger for eksport. */
export function isMockupExportSupported(): boolean {
  if (typeof MediaRecorder === 'undefined') return false;
  if (typeof document === 'undefined') return false;
  const probe = document.createElement('canvas');
  if (typeof (probe as any).captureStream !== 'function') return false;
  return pickMockupMimeType() !== null;
}

/**
 * Kjør eksporten. Resolver med resultat-blob når kilden er ferdig (eller
 * maxDurationMs nås), rejecter ved feil/abort.
 */
export function exportMockupVideo(
  source: HTMLVideoElement,
  options: ExportMockupVideoOptions,
): Promise<ExportMockupVideoResult> {
  const {
    pixelRatio = 5,
    frameRate = 30,
    videoBitsPerSecond = 8_000_000,
    includeAudio = true,
    maxDurationMs = 5 * 60 * 1000,
    canvas: providedCanvas,
    signal,
    onProgress,
    ...renderOpts
  } = options;

  return new Promise<ExportMockupVideoResult>((resolve, reject) => {
    const mime = pickMockupMimeType();
    if (!mime) {
      reject(new Error('MediaRecorder/codec ikke støttet i denne nettleseren'));
      return;
    }
    if (!source.videoWidth || !source.videoHeight) {
      reject(new Error('Kilde-videoen har ikke lastet metadata (videoWidth=0)'));
      return;
    }

    // Lerret-dimensjoner: device-geometri + evt. margin når det er bakgrunn.
    const geom = getDeviceGeometry(renderOpts.variant, pixelRatio);
    const hasBg = (renderOpts.background?.kind ?? 'none') !== 'none';
    const pad = hasBg ? (renderOpts.padding ?? 0.08) : 0;
    const width = Math.round(geom.width / (1 - pad * 2));
    const height = Math.round(geom.height / (1 - pad * 2));

    const canvas = providedCanvas ?? document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Klarte ikke hente 2D-kontekst'));
      return;
    }

    const chunks: Blob[] = [];
    let raf: number | null = null;
    let stopTimer: ReturnType<typeof setTimeout> | null = null;
    let stream: MediaStream | null = null;
    let recorder: MediaRecorder | null = null;
    let settled = false;

    const cleanup = () => {
      if (raf != null) cancelAnimationFrame(raf);
      if (stopTimer != null) clearTimeout(stopTimer);
      source.removeEventListener('ended', onEnded);
      if (signal) signal.removeEventListener('abort', onAbort);
      if (stream) stream.getTracks().forEach((t) => t.stop());
      try { source.pause(); } catch {}
    };

    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    };

    function onAbort() {
      fail(new Error('Eksport avbrutt'));
    }

    const stopRecording = () => {
      if (recorder && recorder.state !== 'inactive') {
        try { recorder.stop(); } catch {}
      }
    };

    function onEnded() {
      if (raf != null) {
        cancelAnimationFrame(raf);
        raf = null;
      }
      // Render sluttbildet før vi lukker.
      renderMockupFrame(ctx!, source, width, height, renderOpts);
      stopRecording();
    }

    try {
      if (signal?.aborted) {
        reject(new Error('Eksport avbrutt før start'));
        return;
      }

      const videoStream: MediaStream | null =
        typeof (canvas as any).captureStream === 'function'
          ? (canvas as HTMLCanvasElement).captureStream(frameRate)
          : null;
      if (!videoStream) {
        reject(new Error('Canvas.captureStream ikke støttet'));
        return;
      }

      const tracks: MediaStreamTrack[] = [...videoStream.getVideoTracks()];

      if (includeAudio) {
        const captureFn =
          (source as any).captureStream || (source as any).mozCaptureStream;
        if (typeof captureFn === 'function') {
          try {
            const srcStream: MediaStream = captureFn.call(source);
            tracks.push(...srcStream.getAudioTracks());
          } catch {
            // Stille — vi tar opp uten lyd.
          }
        }
      }

      stream = new MediaStream(tracks);
      recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond });

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      recorder.onerror = (e: any) => {
        fail(new Error(e?.error?.message ?? 'MediaRecorder-feil'));
      };
      recorder.onstop = () => {
        if (settled) return;
        settled = true;
        cleanup();
        const blob = new Blob(chunks, { type: mime });
        resolve({
          blob,
          mimeType: mime,
          extension: mime.startsWith('video/mp4') ? 'mp4' : 'webm',
          width,
          height,
        });
      };

      if (signal) signal.addEventListener('abort', onAbort, { once: true });
      source.addEventListener('ended', onEnded);

      const renderLoop = () => {
        renderMockupFrame(ctx!, source, width, height, renderOpts);
        const dur = source.duration || 0;
        if (dur > 0 && onProgress) onProgress(Math.min(1, source.currentTime / dur));
        raf = requestAnimationFrame(renderLoop);
      };

      const begin = () => {
        recorder!.start(250);
        raf = requestAnimationFrame(renderLoop);
        // Sikkerhetsnett: stopp uansett etter maxDurationMs.
        stopTimer = setTimeout(() => stopRecording(), maxDurationMs);
        source.play().catch((err) => fail(new Error(err?.message ?? 'play() feilet')));
      };

      // Spol til start; begynn når vi har minst én frame.
      const startWhenReady = () => {
        if (source.readyState >= 2) begin();
        else source.addEventListener('canplay', begin, { once: true });
      };

      if (source.currentTime !== 0) {
        source.addEventListener('seeked', startWhenReady, { once: true });
        try { source.currentTime = 0; } catch { startWhenReady(); }
      } else {
        startWhenReady();
      }
    } catch (err: any) {
      fail(new Error(err?.message ?? 'Klarte ikke starte eksport'));
    }
  });
}
