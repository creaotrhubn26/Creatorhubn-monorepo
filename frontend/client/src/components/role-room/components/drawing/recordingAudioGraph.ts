/**
 * recordingAudioGraph — bygger en Web Audio-graf for å rute lyden fra
 * et HTMLAudioElement gjennom en GainNode før den fanges inn i en
 * MediaStream for MediaRecorder. Det gir oss to ting:
 *
 *   1. Fade-in/fade-out på opptak — så hard cut ved start/stop ikke
 *      påvirker hvordan animaticen høres ut for mottakeren.
 *   2. Et felles routing-punkt som senere kan ta imot flere audio-
 *      kilder (per-frame voiceover) i samme stream.
 *
 * Lytting (audible playback) går via en separat GainNode med fast
 * gain=1 så fade ikke påvirker hva brukeren hører under opptak.
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
 * Bygg grafen. Skal kalles én gang per opptak (graf-state er knyttet
 * til AudioContexts livssyklus).
 */
export function createRecordingAudioGraph(
  audioElement: HTMLAudioElement,
): RecordingAudioGraph | null {
  if (typeof AudioContext === 'undefined' && typeof (window as any).webkitAudioContext === 'undefined') {
    return null;
  }
  const Ctx = (typeof AudioContext !== 'undefined' ? AudioContext : (window as any).webkitAudioContext) as typeof AudioContext;
  const context = new Ctx();

  let source: MediaElementAudioSourceNode;
  try {
    source = context.createMediaElementSource(audioElement);
  } catch {
    // I noen tilfeller har samme element allerede vært koblet til en
    // annen AudioContext. Gi opp opp pent.
    context.close();
    return null;
  }

  // Audible-sti: source → audibleGain(=1) → destination (høyttalere).
  const audibleGain = context.createGain();
  audibleGain.gain.value = 1;
  source.connect(audibleGain);
  audibleGain.connect(context.destination);

  // Recording-sti: source → recordGain → MediaStreamDestination.
  const recordGain = context.createGain();
  recordGain.gain.value = 0; // start stum, fadeInRecording() åpner.
  source.connect(recordGain);
  const recordDest = context.createMediaStreamDestination();
  recordGain.connect(recordDest);

  const cleanup = () => {
    try { source.disconnect(); } catch {}
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
