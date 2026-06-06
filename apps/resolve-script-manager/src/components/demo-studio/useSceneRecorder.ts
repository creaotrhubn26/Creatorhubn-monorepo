/**
 * useSceneRecorder — ekte skjermopptak per scene i Guided Recorder.
 *
 * Bruker getDisplayMedia + MediaRecorder (nettleser-native, ingen nye deps).
 * Ved stopp: blob → base64 → saveDemoRecording (Rust skriver .webm til disk)
 * → returnerer absolutt sti, som settes som scene.recordingPath.
 *
 * ÉN skjermdelings-stream gjenbrukes på tvers av scener (ny MediaRecorder per
 * scene) — brukeren slipper å godkjenne deling 6 ganger. Streamen frigjøres
 * eksplisitt med release() når man er ferdig, eller automatisk hvis brukeren
 * stopper delingen via nettleser-UI (da lagres pågående opptak, ikke mistes).
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
  /** Er en skjermdelings-stream aktiv (gjenbrukes på tvers av scener)? */
  sessionActive: boolean;
  /** Be om skjerm-deling (kun første gang) og start opptak av gitt scene. */
  start: (projectId: string, sceneId: string) => Promise<boolean>;
  /** Stopp + lagre denne scenen. Streamen holdes i live til neste scene. */
  stopAndSave: (projectId: string, sceneId: string) => Promise<string | null>;
  /** Frigjør skjermdelings-streamen helt (når man er ferdig med opptak). */
  release: () => void;
  /** Avbryt uten å lagre (frigjør også streamen). */
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
  const [sessionActive, setSessionActive] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const curRef = useRef<{ projectId: string; sceneId: string } | null>(null);

  /** Stopp streamen helt + nullstill alt. */
  const release = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
    setSessionActive(false);
    setState('idle');
  }, []);

  /** Lagre nåværende chunks til disk for gitt scene. */
  const saveChunks = useCallback(async (projectId: string, sceneId: string): Promise<string | null> => {
    const blob = new Blob(chunksRef.current, { type: 'video/webm' });
    chunksRef.current = [];
    if (blob.size === 0) return null;
    try {
      const b64 = await blobToBase64(blob);
      return await saveDemoRecording(projectId, sceneId, b64);
    } catch (e) {
      setError((e as Error).message || 'Kunne ikke lagre opptak');
      return null;
    }
  }, []);

  /** Få tak i en live stream — gjenbruk eksisterende, ellers be om deling én gang. */
  const ensureStream = useCallback(async (): Promise<MediaStream | null> => {
    const existing = streamRef.current;
    if (existing && existing.getVideoTracks().some((t) => t.readyState === 'live')) return existing;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) {
      setError('Skjermopptak støttes ikke i dette miljøet'); return null;
    }
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: true });
    streamRef.current = stream;
    setSessionActive(true);
    // Brukeren stopper deling via nettleser-UI → lagre pågående opptak, frigjør.
    stream.getVideoTracks()[0]?.addEventListener('ended', () => {
      void (async () => {
        if (recorderRef.current && recorderRef.current.state === 'recording' && curRef.current) {
          setState('saving');
          await new Promise<void>((res) => {
            const r = recorderRef.current!;
            r.onstop = () => res();
            try { r.stop(); } catch { res(); }
          });
          await saveChunks(curRef.current.projectId, curRef.current.sceneId);
        }
        release();
      })();
    });
    return stream;
  }, [release, saveChunks]);

  const start = useCallback(async (projectId: string, sceneId: string): Promise<boolean> => {
    setError(null);
    // Forkast et evt. pågående opptak (f.eks. Retake) uten å frigjøre streamen.
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      try { recorderRef.current.onstop = null; recorderRef.current.stop(); } catch { /* */ }
      recorderRef.current = null;
    }
    chunksRef.current = [];
    try {
      const stream = await ensureStream();
      if (!stream) return false;
      curRef.current = { projectId, sceneId };
      chunksRef.current = [];
      const rec = new MediaRecorder(stream, { mimeType: pickMime(), videoBitsPerSecond: 8_000_000 });
      rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
      recorderRef.current = rec;
      rec.start(250);
      setState('recording');
      return true;
    } catch (e) {
      setError((e as Error).message || 'Kunne ikke starte opptak');
      release();
      return false;
    }
  }, [ensureStream, release]);

  const stopAndSave = useCallback(async (projectId: string, sceneId: string): Promise<string | null> => {
    const rec = recorderRef.current;
    if (!rec || rec.state === 'inactive') { setState(streamRef.current ? 'idle' : 'idle'); return null; }
    setState('saving');
    await new Promise<void>((resolve) => {
      rec.onstop = () => resolve();
      try { rec.stop(); } catch { resolve(); }
    });
    // VIKTIG: ikke stopp stream-tracks her — streamen gjenbrukes til neste scene.
    const path = await saveChunks(projectId, sceneId);
    recorderRef.current = null;
    setState('idle');
    return path;
  }, [saveChunks]);

  const cancel = useCallback(() => { release(); }, [release]);

  return { state, error, sessionActive, start, stopAndSave, release, cancel };
}
