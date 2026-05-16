/**
 * useAnimaticPlayback — RAF-basert avspilling av storyboard-frames
 * som en animatic. Mater hver frame med dens egen `duration` og
 * tilbyr play/pause/seek-API.
 *
 * Designprinsipper:
 *   - Tidsbasert (real-time delta), ikke fix-interval. Det betyr at
 *     pacingen forblir korrekt selv om tab er bakgrunnet (RAF stopper
 *     da, men dt-akkumulering hopper ikke fremover).
 *   - Pure-logic-tidslinjen i `animaticTimeline.ts` brukes til oppslag.
 *   - Cleanup av RAF i useEffect — ingen lekkasje ved unmount.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildAnimaticTimeline,
  findActiveSegment,
  clampTime,
  getFrameStartTime,
  type AnimaticFrameInput,
  type AnimaticTimeline,
  type TimelineSegment,
} from './animaticTimeline';

export interface UseAnimaticPlaybackOptions {
  frames: AnimaticFrameInput[];
  /** Default 1.0. 2.0 = dobbel hastighet. */
  playbackSpeed?: number;
  /** Hvis true: hopp tilbake til 0 etter slutt. Default false (pauser). */
  loop?: boolean;
  /** Kalles når aktivt frame endrer seg (nyttig for dialog-sync). */
  onActiveFrameChange?: (segment: TimelineSegment) => void;
}

export interface AnimaticPlaybackController {
  timeline: AnimaticTimeline;
  /** Sekunder fra start. */
  currentTime: number;
  /** Total varighet i sekunder. */
  totalDuration: number;
  /** Indeks for frame som vises akkurat nå (-1 hvis tom). */
  activeFrameIndex: number;
  /** Hele aktiv segment (frameId, start, end, duration). */
  activeSegment: TimelineSegment | null;
  isPlaying: boolean;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  /** Hopp til absolutt tid (sekunder). Klampes til [0, totalDuration]. */
  seek: (timeSeconds: number) => void;
  /** Hopp til starten av et frame. */
  seekToFrame: (frameIndex: number) => void;
}

export function useAnimaticPlayback(options: UseAnimaticPlaybackOptions): AnimaticPlaybackController {
  const { frames, playbackSpeed = 1, loop = false, onActiveFrameChange } = options;

  const timeline = useMemo(() => buildAnimaticTimeline(frames), [frames]);
  const totalDuration = timeline.totalDuration;

  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Refs for verdier som RAF-loop trenger uten å trigge re-runs.
  const rafRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);
  const currentTimeRef = useRef(0);
  const speedRef = useRef(playbackSpeed);
  const loopRef = useRef(loop);
  const totalRef = useRef(totalDuration);

  // Hold ref-er i sync med props uten å forstyrre loopen.
  useEffect(() => { speedRef.current = playbackSpeed; }, [playbackSpeed]);
  useEffect(() => { loopRef.current = loop; }, [loop]);
  useEffect(() => { totalRef.current = totalDuration; }, [totalDuration]);
  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);

  // Hvis frame-sekvensen endrer seg slik at currentTime ligger utenfor,
  // klamp inn igjen.
  useEffect(() => {
    if (currentTimeRef.current > totalDuration) {
      setCurrentTime(totalDuration);
    }
  }, [totalDuration]);

  const stopRaf = useCallback(() => {
    if (rafRef.current !== null) {
      if (typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = null;
    }
    lastTimestampRef.current = null;
  }, []);

  const tick = useCallback((timestamp: number) => {
    if (lastTimestampRef.current === null) {
      lastTimestampRef.current = timestamp;
      rafRef.current = requestAnimationFrame(tick);
      return;
    }
    const dt = (timestamp - lastTimestampRef.current) / 1000;
    lastTimestampRef.current = timestamp;
    const next = currentTimeRef.current + dt * speedRef.current;
    if (next >= totalRef.current) {
      if (loopRef.current && totalRef.current > 0) {
        const wrapped = next % totalRef.current;
        currentTimeRef.current = wrapped;
        setCurrentTime(wrapped);
        rafRef.current = requestAnimationFrame(tick);
      } else {
        currentTimeRef.current = totalRef.current;
        setCurrentTime(totalRef.current);
        setIsPlaying(false);
        stopRaf();
      }
      return;
    }
    currentTimeRef.current = next;
    setCurrentTime(next);
    rafRef.current = requestAnimationFrame(tick);
  }, [stopRaf]);

  const play = useCallback(() => {
    if (totalDuration <= 0) return;
    if (currentTimeRef.current >= totalDuration) {
      // Hvis vi har spilt til slutt: start fra begynnelsen.
      currentTimeRef.current = 0;
      setCurrentTime(0);
    }
    setIsPlaying(true);
  }, [totalDuration]);

  const pause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const toggle = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const seek = useCallback((timeSeconds: number) => {
    const clamped = clampTime(timeline, timeSeconds);
    currentTimeRef.current = clamped;
    lastTimestampRef.current = null; // unngå dt-spike etter sprang
    setCurrentTime(clamped);
  }, [timeline]);

  const seekToFrame = useCallback((frameIndex: number) => {
    seek(getFrameStartTime(timeline, frameIndex));
  }, [seek, timeline]);

  // RAF lifecycle: start/stop basert på isPlaying.
  useEffect(() => {
    if (!isPlaying) {
      stopRaf();
      return;
    }
    if (typeof requestAnimationFrame !== 'function') return;
    lastTimestampRef.current = null;
    rafRef.current = requestAnimationFrame(tick);
    return () => stopRaf();
  }, [isPlaying, tick, stopRaf]);

  // Cleanup ved unmount.
  useEffect(() => () => stopRaf(), [stopRaf]);

  const activeSegment = useMemo(
    () => findActiveSegment(timeline, currentTime),
    [timeline, currentTime],
  );

  // Notify når aktiv frame skifter.
  const lastNotifiedFrameRef = useRef<number>(-1);
  useEffect(() => {
    if (!activeSegment) return;
    if (activeSegment.frameIndex === lastNotifiedFrameRef.current) return;
    lastNotifiedFrameRef.current = activeSegment.frameIndex;
    onActiveFrameChange?.(activeSegment);
  }, [activeSegment, onActiveFrameChange]);

  return {
    timeline,
    currentTime,
    totalDuration,
    activeFrameIndex: activeSegment?.frameIndex ?? -1,
    activeSegment,
    isPlaying,
    play,
    pause,
    toggle,
    seek,
    seekToFrame,
  };
}
