/**
 * useAnimaticAudio — synker et HTMLAudioElement med animatic-playback-
 * controlleren slik at artisten kan teste pacing mot en scratch-track
 * (voiceover, midlertidig musikk).
 *
 * Synk-strategi:
 *   - isPlaying styrer audio.play() / audio.pause()
 *   - Når `currentTime` på controlleren spretter mer enn DRIFT_TOLERANCE
 *     fra audio.currentTime, justerer vi (typisk bare ved scrub eller
 *     after-pause-resume).
 *   - playbackSpeed propageres til audio.playbackRate.
 *
 * Vi prøver ikke å være sample-accurate (Web Audio API + AudioBuffer
 * gir det, men er overkill for MVP). `<audio>`-elementet håndteres via
 * ref og kan settes fra useState i UI.
 */

import { useEffect, useRef } from 'react';

export interface UseAnimaticAudioOptions {
  /** Audio-elementet UI rendrer (eller null hvis ingen audio satt). */
  audioElement: HTMLAudioElement | null;
  /** Fra useAnimaticPlayback-controlleren. */
  isPlaying: boolean;
  /** Avspillingstid i sekunder (fra controlleren). */
  currentTime: number;
  /** 1.0 = normal hastighet. */
  playbackSpeed?: number;
  /** Hvor mye audio kan drifte før vi tvinger en re-sync (sekunder). */
  driftTolerance?: number;
}

const DEFAULT_DRIFT_TOLERANCE = 0.2;

export function useAnimaticAudio(options: UseAnimaticAudioOptions): void {
  const {
    audioElement,
    isPlaying,
    currentTime,
    playbackSpeed = 1,
    driftTolerance = DEFAULT_DRIFT_TOLERANCE,
  } = options;

  // Forrige isPlaying-verdi, så vi vet om vi nettopp endret state.
  const wasPlayingRef = useRef(false);

  // Play/pause-sync.
  useEffect(() => {
    if (!audioElement) return;
    if (isPlaying && !wasPlayingRef.current) {
      // Sørg for at audio er synket før play().
      if (Math.abs(audioElement.currentTime - currentTime) > driftTolerance) {
        audioElement.currentTime = currentTime;
      }
      const result = audioElement.play();
      // play() returnerer Promise i moderne nettlesere; vi svelger
      // AbortError som skjer hvis pause() trigges før play() resolver.
      if (result && typeof result.then === 'function') {
        result.catch(() => {});
      }
    } else if (!isPlaying && wasPlayingRef.current) {
      audioElement.pause();
    }
    wasPlayingRef.current = isPlaying;
  }, [audioElement, isPlaying, currentTime, driftTolerance]);

  // Drift-korreksjon ved scrub: hvis controlleren har hoppet og audio
  // ikke er der den skal være, sett currentTime.
  useEffect(() => {
    if (!audioElement) return;
    if (Math.abs(audioElement.currentTime - currentTime) > driftTolerance) {
      audioElement.currentTime = currentTime;
    }
  }, [audioElement, currentTime, driftTolerance]);

  // Hastighet-sync.
  useEffect(() => {
    if (!audioElement) return;
    audioElement.playbackRate = playbackSpeed;
  }, [audioElement, playbackSpeed]);

  // Cleanup: pause audio når komponenten unmountes / audio-elementet bytter.
  useEffect(() => {
    if (!audioElement) return;
    return () => {
      try {
        audioElement.pause();
      } catch {
        // ignore — element kan være fjernet fra DOM allerede
      }
    };
  }, [audioElement]);
}
