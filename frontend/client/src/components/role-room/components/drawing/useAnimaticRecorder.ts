/**
 * useAnimaticRecorder — MediaRecorder-livssyklus for å eksportere
 * animatic-playbacken som WebM. Tar en `canvas` som video-kilde og
 * et valgfritt `audioElement` som lyd-kilde, kombinerer dem og spiller
 * inn til ett MediaRecorder-tape.
 *
 * State-maskin:
 *   idle  →  start()  →  recording  →  stop()  →  idle  (resultat-blob i lastBlob)
 *
 * Designvalg:
 *   - Vi støtter `video/webm;codecs=vp9,opus` med fallback til vp8,
 *     deretter ren `video/webm`. Safari < 16.4 har ikke MediaRecorder
 *     for video/webm — vi rapporterer `isSupported=false` og lar UI
 *     vise melding.
 *   - Lyd er valgfritt. Hvis audioElement mangler eller captureStream
 *     ikke er tilgjengelig, spilles bare video-tracken inn.
 *   - Cleanup: stopper MediaRecorder + tracks ved unmount.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type RecorderState = 'idle' | 'preparing' | 'recording' | 'finalizing';

export interface UseAnimaticRecorderOptions {
  canvas: HTMLCanvasElement | null;
  audioElement?: HTMLAudioElement | null;
  /** Hvis satt: bruk denne strømmen som audio-kilde i stedet for å
   *  capture-streame fra audioElement direkte. Brukes når caller vil
   *  rute lyden gjennom Web Audio (f.eks. for fade i opptak). */
  audioStreamOverride?: MediaStream | null;
  /** Bilderate på opptaket. Default 30 fps. */
  frameRate?: number;
  /** Bitrate på video. Default 4 Mbps — fin nok for storyboard-frames. */
  videoBitsPerSecond?: number;
}

export interface AnimaticRecorderController {
  state: RecorderState;
  isSupported: boolean;
  /** Sett etter siste stop(). Trigger nedlasting via downloadLastBlob(). */
  lastBlob: Blob | null;
  /** Sett hvis siste opptak feilet. */
  error: string | null;
  start: () => boolean;
  stop: () => void;
  /** Trigger download av lastBlob hvis den finnes. */
  downloadLastBlob: (filename?: string) => void;
}

function pickMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return null;
}

export function useAnimaticRecorder(options: UseAnimaticRecorderOptions): AnimaticRecorderController {
  const {
    canvas,
    audioElement,
    audioStreamOverride,
    frameRate = 30,
    videoBitsPerSecond = 4_000_000,
  } = options;

  const [state, setState] = useState<RecorderState>('idle');
  const [lastBlob, setLastBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const mimeTypeRef = useRef<string | null>(null);

  // Cache mime-type/support-flag.
  const mimeType = useMemo(() => pickMimeType(), []);
  const isSupported = !!mimeType && typeof MediaRecorder !== 'undefined';

  const cleanup = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try { recorderRef.current.stop(); } catch {}
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    recorderRef.current = null;
  }, []);

  const start = useCallback((): boolean => {
    if (!canvas || !isSupported || !mimeType) {
      setError(!isSupported ? 'Opptak støttes ikke i denne nettleseren' : 'Mangler canvas-kilde');
      return false;
    }
    if (state !== 'idle') return false;

    setError(null);
    setLastBlob(null);
    chunksRef.current = [];
    mimeTypeRef.current = mimeType;

    setState('preparing');
    try {
      // Hent video-track fra canvas.
      const videoStream = (canvas as any).captureStream
        ? (canvas as any).captureStream(frameRate)
        : null;
      if (!videoStream) {
        setError('Canvas.captureStream støttes ikke i denne nettleseren');
        setState('idle');
        return false;
      }
      const combinedTracks: MediaStreamTrack[] = [...videoStream.getVideoTracks()];

      // Lyd er valgfritt. Prioritet: override-stream (typisk fra Web
      // Audio-graf med fade) > audioElement.captureStream > ingen lyd.
      if (audioStreamOverride) {
        combinedTracks.push(...audioStreamOverride.getAudioTracks());
      } else if (audioElement) {
        const captureFn = (audioElement as any).captureStream
          || (audioElement as any).mozCaptureStream;
        if (typeof captureFn === 'function') {
          try {
            const audioStream: MediaStream = captureFn.call(audioElement);
            const audioTracks = audioStream.getAudioTracks();
            combinedTracks.push(...audioTracks);
          } catch {
            // Stille — vi tar opp uten lyd.
          }
        }
      }

      const combined = new MediaStream(combinedTracks);
      streamRef.current = combined;

      const recorder = new MediaRecorder(combined, {
        mimeType,
        videoBitsPerSecond,
      });
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        setState('finalizing');
        const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current ?? 'video/webm' });
        chunksRef.current = [];
        setLastBlob(blob);
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
        recorderRef.current = null;
        setState('idle');
      };
      recorder.onerror = (event: any) => {
        setError(event?.error?.message ?? 'Ukjent MediaRecorder-feil');
        cleanup();
        setState('idle');
      };
      recorderRef.current = recorder;
      recorder.start(250); // dump chunks hvert 250ms
      setState('recording');
      return true;
    } catch (err: any) {
      setError(err?.message ?? 'Klarte ikke starte opptak');
      cleanup();
      setState('idle');
      return false;
    }
  }, [canvas, audioElement, audioStreamOverride, frameRate, videoBitsPerSecond, isSupported, mimeType, state, cleanup]);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    if (recorder.state === 'recording' || recorder.state === 'paused') {
      try { recorder.stop(); } catch {}
    }
  }, []);

  const downloadLastBlob = useCallback((filename = `animatic-${Date.now()}.webm`) => {
    if (!lastBlob) return;
    const url = URL.createObjectURL(lastBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Liten timeout før vi revoker — sørger for at nettleseren har
    // startet nedlastingen.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [lastBlob]);

  // Cleanup ved unmount.
  useEffect(() => () => cleanup(), [cleanup]);

  return {
    state,
    isSupported,
    lastBlob,
    error,
    start,
    stop,
    downloadLastBlob,
  };
}
