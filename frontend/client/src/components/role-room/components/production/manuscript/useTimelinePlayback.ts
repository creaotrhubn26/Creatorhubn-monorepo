import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import type { LiveSetStatus } from '..';

export type ProductionTimelineViewMode = 'timeline' | 'grid' | 'list';

export const formatTimelineTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

interface UseTimelinePlaybackOptions {
  totalDuration: number;
  liveSetStatus?: LiveSetStatus | null;
}

export const useTimelinePlayback = ({ totalDuration, liveSetStatus }: UseTimelinePlaybackOptions) => {
  const [timelineCurrentTime, setTimelineCurrentTime] = useState(0);
  const [timelineIsPlaying, setTimelineIsPlaying] = useState(false);
  const [timelineZoom, setTimelineZoom] = useState(1);
  const [timelineViewMode, setTimelineViewMode] = useState<ProductionTimelineViewMode>('timeline');

  const timelineRef = useRef<HTMLDivElement | null>(null);
  const playheadRef = useRef<HTMLDivElement | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const currentTimeRef = useRef(0);

  const updatePlayheadDOM = useCallback((timeSec: number) => {
    const el = playheadRef.current;
    const container = timelineRef.current;
    if (!el || !container) return;
    const duration = Math.max(totalDuration, 0.001);
    const pct = Math.max(0, Math.min(1, timeSec / duration));
    const x = pct * container.clientWidth;
    el.style.transform = `translate3d(${x}px, 0, 0)`;
  }, [totalDuration]);

  const handleTimelinePlay = useCallback(() => {
    setTimelineIsPlaying((playing) => !playing);
  }, []);

  const handleTimelineSeek = useCallback((event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));
    const nextTime = pct * totalDuration;
    currentTimeRef.current = nextTime;
    updatePlayheadDOM(nextTime);
    setTimelineCurrentTime(nextTime);
  }, [totalDuration, updatePlayheadDOM]);

  const handleTimelineZoomIn = useCallback(() => {
    setTimelineZoom((zoom) => Math.min(zoom + 0.5, 4));
  }, []);

  const handleTimelineZoomOut = useCallback(() => {
    setTimelineZoom((zoom) => Math.max(zoom - 0.5, 0.5));
  }, []);

  const handleTimelineViewChange = useCallback((mode: ProductionTimelineViewMode) => {
    setTimelineViewMode(mode);
  }, []);

  const getTotalDuration = useCallback((): number => totalDuration, [totalDuration]);

  const getOvertimeDuration = useCallback((): string => {
    const standardDay = 8 * 60 * 60;
    const overtime = totalDuration - standardDay;
    if (overtime <= 0) return '0:00';
    const hours = Math.floor(overtime / 3600);
    const mins = Math.floor((overtime % 3600) / 60);
    return `${hours}:${String(mins).padStart(2, '0')}`;
  }, [totalDuration]);

  useEffect(() => {
    if (!timelineIsPlaying) return;

    const tick = (ts: number) => {
      if (lastTsRef.current == null) lastTsRef.current = ts;
      const dt = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;

      const duration = Math.max(totalDuration, 0.001);
      let nextTime = currentTimeRef.current + dt;

      if (nextTime >= duration) {
        nextTime = duration;
        currentTimeRef.current = nextTime;
        updatePlayheadDOM(nextTime);
        setTimelineCurrentTime(nextTime);
        setTimelineIsPlaying(false);
        return;
      }

      currentTimeRef.current = nextTime;
      updatePlayheadDOM(nextTime);

      const quant = Math.round(nextTime * 4) / 4;
      setTimelineCurrentTime((prev) => (prev === quant ? prev : quant));

      rafIdRef.current = requestAnimationFrame(tick);
    };

    rafIdRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
      lastTsRef.current = null;
    };
  }, [timelineIsPlaying, totalDuration, updatePlayheadDOM]);

  useEffect(() => {
    if (timelineIsPlaying) return;
    if (!liveSetStatus?.todayProgress) return;
    const pct = liveSetStatus.todayProgress.completedSetups / Math.max(liveSetStatus.todayProgress.totalSetups, 1);
    const nextTime = pct * totalDuration;
    currentTimeRef.current = nextTime;
    updatePlayheadDOM(nextTime);
    setTimelineCurrentTime(nextTime);
  }, [liveSetStatus?.todayProgress, timelineIsPlaying, totalDuration, updatePlayheadDOM]);

  return {
    timelineRef,
    playheadRef,
    timelineCurrentTime,
    timelineIsPlaying,
    timelineZoom,
    timelineViewMode,
    handleTimelinePlay,
    handleTimelineSeek,
    handleTimelineZoomIn,
    handleTimelineZoomOut,
    handleTimelineViewChange,
    formatTime: formatTimelineTime,
    getTotalDuration,
    getOvertimeDuration,
  };
};
