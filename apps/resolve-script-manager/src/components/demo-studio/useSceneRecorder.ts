/**
 * useSceneRecorder — ekte skjermopptak per scene i Guided Recorder.
 *
 * Bruker getDisplayMedia + MediaRecorder (nettleser-native, ingen nye deps).
 * Ved stopp: blob → base64 → saveDemoRecording (Rust skriver .webm til disk)
 * → returnerer absolutt sti, som settes som scene.recordingPath.
 *
 * Manuell progresjon respekteres: hooken styrer KUN opptak; start/stopp
 * trigges eksplisitt fra recorder-UI (Record / Mark as Done / Retake).
 */

import { useCallback, useRef, useState } from 'react';
import { saveDemoRecording } from '../../api';

export type RecState = 'idle' | 'recording' | 'saving';

export interface SceneRecorder {
  state: RecState;
  error: string | null;
  /** Be brukeren om skjerm-deling og start opptak. */
  start: () => Promise<boolean>;
  /** Stopp + lagre til disk for gitt scene. Returnerer sti eller null. */
  stopAndSave: (projectId: string, sceneId: string) => Promise<string | null>;
  /** Avbryt uten å lagre. */
  cancel: () => void;
}

function pickMime(): string {
  const cands = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  for (const m of cands) { try { if (MediaRecorder.isTypeSupported(m)) return m; } catch { /* */ } }
  return 'video/webm';
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  // Chunket base64 for å unngå call-stack-overflow på store opptak.
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    bin += String.fromCharCode(...buf.subarray(i, i + chunk));
  }
  return btoa(bin);
}

export function useSceneRecorder(): SceneRecorder {
  const [state, setState] = useState<RecState>('idle');
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const cleanup = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
  }, []);

  const start = useCallback(async (): Promise<boolean> => {
    setError(null);
    if (state !== 'idle') return false;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) {
      setError('Skjermopptak støttes ikke i dette miljøet'); return false;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 }, audio: true,
      });
      streamRef.current = stream;
      chunksRef.current = [];
      const rec = new MediaRecorder(stream, { mimeType: pickMime(), videoBitsPerSecond: 8_000_000 });
      rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
      // Hvis brukeren stopper deling via nettleser-UI: behandle som stopp.
      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
      });
      recorderRef.current = rec;
      rec.start(250);
      setState('recording');
      return true;
    } catch (e) {
      setError((e as Error).message || 'Kunne ikke starte opptak');
      cleanup();
      return false;
    }
  }, [state, cleanup]);

  const stopAndSave = useCallback(async (projectId: string, sceneId: string): Promise<string | null> => {
    const rec = recorderRef.current;
    if (!rec || rec.state === 'inactive') { cleanup(); setState('idle'); return null; }
    setState('saving');
    const blob: Blob = await new Promise((resolve) => {
      rec.onstop = () => resolve(new Blob(chunksRef.current, { type: 'video/webm' }));
      try { rec.stop(); } catch { resolve(new Blob(chunksRef.current, { type: 'video/webm' })); }
    });
    streamRef.current?.getTracks().forEach((t) => t.stop());
    try {
      const b64 = await blobToBase64(blob);
      const path = await saveDemoRecording(projectId, sceneId, b64);
      cleanup();
      setState('idle');
      return path;
    } catch (e) {
      setError((e as Error).message || 'Kunne ikke lagre opptak');
      cleanup();
      setState('idle');
      return null;
    }
  }, [cleanup]);

  const cancel = useCallback(() => { cleanup(); setState('idle'); }, [cleanup]);

  return { state, error, start, stopAndSave, cancel };
}
