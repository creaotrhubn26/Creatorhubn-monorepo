/**
 * useMockupVideoExporter — tynt React-lag oppå [[exportMockupVideo]].
 *
 * All MediaRecorder-/canvas-logikk bor i den rammuavhengige kjernen
 * `exportMockupVideo()` (lettere å teste i Playwright + gjenbruke utenfor
 * React). Denne hooken eier kun UI-state: status, framdrift, blob, feil.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  exportMockupVideo,
  isMockupExportSupported,
  type ExportMockupVideoOptions,
} from './exportMockupVideo';

export type ExporterState = 'idle' | 'recording' | 'finalizing';

export type MockupExportOptions = Omit<ExportMockupVideoOptions, 'signal' | 'onProgress' | 'canvas'>;

export interface MockupExporterController {
  state: ExporterState;
  isSupported: boolean;
  progress: number;
  lastBlob: Blob | null;
  error: string | null;
  start: (source: HTMLVideoElement, options: MockupExportOptions) => void;
  cancel: () => void;
  downloadLastBlob: (filename?: string) => void;
}

export function useMockupVideoExporter(): MockupExporterController {
  const [state, setState] = useState<ExporterState>('idle');
  const [progress, setProgress] = useState(0);
  const [lastBlob, setLastBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const blobExtRef = useRef<string>('webm');

  const isSupported = isMockupExportSupported();

  const start = useCallback(
    (source: HTMLVideoElement, options: MockupExportOptions) => {
      if (state !== 'idle') return;
      setError(null);
      setLastBlob(null);
      setProgress(0);

      const controller = new AbortController();
      abortRef.current = controller;
      setState('recording');

      exportMockupVideo(source, {
        ...options,
        signal: controller.signal,
        onProgress: (p) => setProgress(p),
      })
        .then((result) => {
          blobExtRef.current = result.extension;
          setLastBlob(result.blob);
          setProgress(1);
          setState('idle');
        })
        .catch((err: Error) => {
          // Abort er en bevisst handling — ikke vis som feil.
          if (err.message.includes('avbrutt')) {
            setState('idle');
            return;
          }
          setError(err.message);
          setState('idle');
        });
    },
    [state],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState('idle');
    setProgress(0);
  }, []);

  const downloadLastBlob = useCallback(
    (filename?: string) => {
      if (!lastBlob) return;
      const ext = blobExtRef.current;
      const name = filename ?? `mockup-video.${ext}`;
      const url = URL.createObjectURL(lastBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    [lastBlob],
  );

  useEffect(() => () => abortRef.current?.abort(), []);

  return { state, isSupported, progress, lastBlob, error, start, cancel, downloadLastBlob };
}
