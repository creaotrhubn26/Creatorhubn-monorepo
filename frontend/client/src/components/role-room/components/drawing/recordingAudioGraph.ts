/**
 * recordingAudioGraph — Web Audio-mikser som ruter N audio-kilder
 * gjennom en master-GainNode før de fanges inn i en MediaStream for
 * MediaRecorder. Tre roller:
 *
 *   1. Fade-in/fade-out på opptak — så hard cut ved start/stop ikke
 *      påvirker hvordan animaticen høres ut for mottakeren.
 *   2. Multi-track mixing — scene-level scratch-track + per-frame
 *      voiceover + SFX-events kan alle eksistere samtidig.
 *   3. Felles routing-punkt så SFX/voiceover-kilder kan legges til
 *      og fjernes dynamisk mens grafen lever.
 *
 * Lytting (audible playback) går via en separat audibleGain (=1) så
 * record-fade ikke påvirker hva brukeren hører.
 *
 * NB: createMediaElementSource kan bare kalles én gang per element
 * per AudioContext, så caller må holde grafen i live mellom upload
 * og opptak hvis flere kilder skal mikses inn.
 */

export const RECORDING_FADE_DURATION = 0.15; // sekunder

export interface RecordingAudioGraph {
  context: AudioContext;
  /** Stream som MediaRecorder skal bruke som audio-kilde. */
  recordingStream: MediaStream;
  /** GainNode mellom kilde og recording-destination — for fade. */
  recordGain: GainNode;
  /** Rydd opp: koble fra noder + lukk context. */
  cleanup: () => void;
}

/**
 * Bygg grafen. Caller leverer N audio-kilder; minst én må være satt
 * for at grafen skal være meningsfull.
 */
export function createRecordingAudioGraph(
  audioElements: HTMLAudioElement[],
): RecordingAudioGraph | null {
  if (typeof AudioContext === 'undefined' && typeof (window as any).webkitAudioContext === 'undefined') {
    return null;
  }
  const valid = audioElements.filter(Boolean);
  if (valid.length === 0) return null;

  const Ctx = (typeof AudioContext !== 'undefined' ? AudioContext : (window as any).webkitAudioContext) as typeof AudioContext;
  const context = new Ctx();
  // Safari kan starte i 'suspended' state. Resume tvinger en aktiv
  // kontekst etter user-gesture (createRecordingAudioGraph kalles fra
  // record-knapp-click så vi er innenfor gesturen).
  if (context.state === 'suspended' && typeof context.resume === 'function') {
    context.resume().catch(() => {});
  }

  const audibleGain = context.createGain();
  audibleGain.gain.value = 1;
  audibleGain.connect(context.destination);

  const recordGain = context.createGain();
  recordGain.gain.value = 0; // fadeInRecording() åpner.
  const recordDest = context.createMediaStreamDestination();
  recordGain.connect(recordDest);

  const sources: MediaElementAudioSourceNode[] = [];
  for (const el of valid) {
    let source: MediaElementAudioSourceNode;
    try {
      source = context.createMediaElementSource(el);
    } catch {
      // Element er allerede koblet til en annen context — hopp over.
      continue;
    }
    source.connect(audibleGain);
    source.connect(recordGain);
    sources.push(source);
  }

  if (sources.length === 0) {
    try { context.close(); } catch {}
    return null;
  }

  const cleanup = () => {
    for (const s of sources) {
      try { s.disconnect(); } catch {}
    }
    try { audibleGain.disconnect(); } catch {}
    try { recordGain.disconnect(); } catch {}
    try { context.close(); } catch {}
  };

  return {
    context,
    recordingStream: recordDest.stream,
    recordGain,
    cleanup,
  };
}

/**
 * Ramp recording-gain fra 0 til 1 over `duration` sekunder.
 */
export function fadeInRecording(graph: RecordingAudioGraph, duration = RECORDING_FADE_DURATION): void {
  const now = graph.context.currentTime;
  graph.recordGain.gain.cancelScheduledValues(now);
  graph.recordGain.gain.setValueAtTime(0, now);
  graph.recordGain.gain.linearRampToValueAtTime(1, now + duration);
}

/**
 * Ramp recording-gain fra nåværende verdi til 0 over `duration`
 * sekunder. Kaller `onComplete` etter rampen er ferdig så caller kan
 * trygt stoppe MediaRecorder uten å klippe lyden.
 */
export function fadeOutRecording(
  graph: RecordingAudioGraph,
  onComplete: () => void,
  duration = RECORDING_FADE_DURATION,
): void {
  const now = graph.context.currentTime;
  graph.recordGain.gain.cancelScheduledValues(now);
  graph.recordGain.gain.setValueAtTime(graph.recordGain.gain.value, now);
  graph.recordGain.gain.linearRampToValueAtTime(0, now + duration);
  // setTimeout er enklere enn å lytte på AudioParam-events (som ikke
  // finnes på alle browsere). Litt ekstra margin.
  setTimeout(onComplete, duration * 1000 + 30);
}
