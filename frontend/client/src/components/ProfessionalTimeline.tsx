import React, { useState, useCallback, useRef, useMemo } from 'react';
import { Box, Menu, MenuItem, Divider, Typography, Chip, Tooltip, TextField, Select } from '@mui/material';
import { BeatClip, Track } from '../services/storyArcDataIntegration';

export interface TimelineMarker {
  id: string;
  time: number;
  color?: string;
  label?: string;
}

export interface TrackState {
  locked?: boolean;
  mute?: boolean;
  solo?: boolean;
  visible?: boolean;
  type?: 'video' | 'audio' | 'adjustment' | 'subtitle' | 'graphics';
}

export interface TimelineTransition {
  id: string;
  time: number;
  trackId: string;
  type: string;
  duration?: number;
}

interface ProfessionalTimelineProps {
  clips: BeatClip[];
  tracks: Track[];
  zoom: number;
  trackHeightScale?: number;
  currentTime: number;
  totalDuration: number;
  isPlaying: boolean;
  selectedClips: Set<string>;
  onClipSelect: (clipId: string, multiSelect?: boolean) => void;
  onClipMove: (clipId: string, newStart: number, newTrackId: string) => void;
  onClipResize?: (clipId: string, newStart: number, newDuration: number) => void;
  onTimelineClick: (time: number) => void;
  onCurrentTimeChange?: (time: number) => void;
  onZoomChange?: (zoom: number) => void;
  markers?: TimelineMarker[];
  trackStates?: Record<string, TrackState>;
  onTrackToggle?: (trackId: string, changes: Partial<TrackState>) => void;
  onTrackRename?: (trackId: string, name: string) => void;
  onTrackTypeChange?: (trackId: string, type: TrackState['type']) => void;
  transitions?: TimelineTransition[];
  // Metadata & filtering
  clipMetadata?: Record<string, { camera?: string; shotName?: string; scene?: string; take?: string; tags?: string[] }>;
  filterTags?: string[];
  searchQuery?: string;
  // Context menu actions
  onContextMenuAction?: (action: string, payload: any) => void;
  // Collaboration
  reviewerMode?: boolean;
  collabLocks?: Record<string, { user?: string }>;
  // Compare overlay
  compareClips?: BeatClip[];
}

type DragMode = 'move' | 'resize-left' | 'resize-right';

interface DragState {
  clipId: string;
  startX: number;
  startTime: number;
  originalTrackId: string;
  originalDuration: number;
  mode: DragMode;
}

const RULER_HEIGHT = 24;
const SNAP_PX = 6;
const HEADER_WIDTH = 160;

export default function ProfessionalTimeline({
  clips,
  tracks,
  zoom,
  trackHeightScale = 1,
  currentTime,
  totalDuration,
  isPlaying,
  selectedClips,
  onClipSelect,
  onClipMove,
  onClipResize,
  onTimelineClick,
  onCurrentTimeChange,
  onZoomChange,
  markers = [],
  trackStates = {},
  onTrackToggle,
  onTrackRename,
  onTrackTypeChange,
  transitions = [],
  clipMetadata = {},
  filterTags = [],
  searchQuery = '',
  onContextMenuAction,
  reviewerMode = false,
  collabLocks = {},
  compareClips = [],
}: ProfessionalTimelineProps) {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<HTMLDivElement>(null);
  const isScrubbingRef = useRef(false);

  // Context menu state
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [menuClipId, setMenuClipId] = useState<string | null>(null);

  const pixelsPerSecond = useMemo(() => Math.max(5, zoom * 10), [zoom]);
  const timeToPixels = useCallback((t: number) => t * pixelsPerSecond, [pixelsPerSecond]);
  const pixelsToTime = useCallback((px: number) => px / pixelsPerSecond, [pixelsPerSecond]);
  const timelineWidth = useMemo(() => Math.max(800, timeToPixels(totalDuration)), [timeToPixels, totalDuration]);
  const effectiveTrackHeights = useMemo(() =>
    tracks.map(t => ({ id: t.id, height: Math.max(24, Math.round(t.height * trackHeightScale)) })),
    [tracks, trackHeightScale]
  );

  const gridLines = useMemo(() => {
    const lines: { time: number; position: number; isMain: boolean }[] = [];
    const base = Math.max(1, Math.round(30 / Math.max(zoom, 0.1)));
    const step = base <= 1 ? 1 : base <= 5 ? 5 : base <= 10 ? 10 : 30;
    for (let t = 0; t <= totalDuration; t += step) {
      lines.push({ time: t, position: timeToPixels(t), isMain: t % (step * 4) === 0 });
    }
    return lines;
  }, [zoom, totalDuration, timeToPixels]);

  const snapPx = useCallback((px: number, ignoreClipId?: string) => {
    const targets: number[] = [];
    // grid
    for (const line of gridLines) targets.push(line.position);
    // clip edges
    for (const c of clips) {
      if (c.id === ignoreClipId) continue;
      targets.push(timeToPixels(c.start));
      targets.push(timeToPixels(c.start + c.duration));
    }
    // markers
    for (const m of markers) targets.push(timeToPixels(m.time));

    if (targets.length === 0) return px;
    let best = px, bestDelta = Infinity;
    for (const t of targets) {
      const d = Math.abs(px - t);
      if (d < bestDelta) { bestDelta = d; best = t; }
    }
    return bestDelta <= SNAP_PX ? best : px;
  }, [gridLines, clips, markers, timeToPixels]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragState || !timelineRef.current) return;

    // Determine target track by Y for move
    const top = timelineRef.current.getBoundingClientRect().top + RULER_HEIGHT;
    const yRel = e.clientY - top;
    let newTrackId = dragState.originalTrackId;
    let cursor = 0;
    for (const tr of tracks) {
      const h = Math.max(24, Math.round(tr.height * trackHeightScale));
      if (yRel >= cursor && yRel < cursor + h) { newTrackId = tr.id; break; }
      cursor += h;
    }

    // X → time
    const rect = timelineRef.current.getBoundingClientRect();
    const currentX = e.clientX - rect.left + timelineRef.current.scrollLeft;
    const deltaX = currentX - dragState.startX;

    if (dragState.mode === 'move') {
      let newStartPx = timeToPixels(Math.max(0, dragState.startTime + pixelsToTime(deltaX)));
      newStartPx = snapPx(newStartPx, dragState.clipId);
      const newStart = Math.max(0, pixelsToTime(newStartPx));
      onClipMove(dragState.clipId, newStart, newTrackId);
      return;
    }

    if (!onClipResize) return;
    const originalEnd = dragState.startTime + dragState.originalDuration;

    if (dragState.mode === 'resize-left') {
      const newStartRaw = Math.max(0, dragState.startTime + pixelsToTime(deltaX));
      const newStartPx = snapPx(timeToPixels(newStartRaw), dragState.clipId);
      const newStart = Math.min(originalEnd - 0.1, Math.max(0, pixelsToTime(newStartPx)));
      const newDuration = Math.max(0.1, originalEnd - newStart);
      onClipResize(dragState.clipId, newStart, newDuration);
      return;
    }

    if (dragState.mode === 'resize-right') {
      const newEndRaw = Math.max(dragState.startTime + 0.1, originalEnd + pixelsToTime(deltaX));
      const newEndPx = snapPx(timeToPixels(newEndRaw), dragState.clipId);
      const newEnd = Math.max(dragState.startTime + 0.1, pixelsToTime(newEndPx));
      const newDuration = Math.max(0.1, newEnd - dragState.startTime);
      onClipResize(dragState.clipId, dragState.startTime, newDuration);
      return;
    }
  }, [dragState, tracks, onClipMove, onClipResize, pixelsToTime, timeToPixels, snapPx, trackHeightScale]);

  const handleMouseUp = useCallback(() => {
    setDragState(null);
    window.removeEventListener('mousemove, ', handleMouseMove);
    window.removeEventListener('mouseup,', handleMouseUp);
  }, [handleMouseMove]);

  const beginDrag = useCallback((e: React.MouseEvent, clipId: string, mode: DragMode = 'move') => {
    e.preventDefault();
    e.stopPropagation();
    if (reviewerMode) return;
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return;
    if (trackStates[clip.trackId]?.locked) return;
    setDragState({ clipId, startX: e.clientX - rect.left + timelineRef.current.scrollLeft, startTime: clip.start, originalTrackId: clip.trackId, originalDuration: clip.duration, mode });
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [clips, handleMouseMove, handleMouseUp, reviewerMode, trackStates]);

  const handleTimelineClickLocal = useCallback((e: React.MouseEvent) => {
    if (!timelineRef.current || dragState) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + timelineRef.current.scrollLeft;
    const t = Math.max(0, Math.min(totalDuration, pixelsToTime(x)));
    onTimelineClick(t);
    onCurrentTimeChange?.(t);
  }, [dragState, pixelsToTime, totalDuration, onTimelineClick, onCurrentTimeChange]);

  // Ruler scrubbing (click + drag)
  const onRulerMouseDown = useCallback((e: React.MouseEvent) => {
    if (!timelineRef.current) return;
    isScrubbingRef.current = true;
    const rect = timelineRef.current.getBoundingClientRect();
    const update = (ev: MouseEvent) => {
      if (!timelineRef.current) return;
      const x = ev.clientX - rect.left + timelineRef.current.scrollLeft;
      const t = Math.max(0, Math.min(totalDuration, pixelsToTime(x)));
      onTimelineClick(t);
      onCurrentTimeChange?.(t);
    };
    const up = () => {
      isScrubbingRef.current = false;
      window.removeEventListener('mousemove', update);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', update);
    window.addEventListener('mouseup', up);
  }, [pixelsToTime, totalDuration, onTimelineClick, onCurrentTimeChange]);

  // Wheel zoom (Ctrl/Cmd + wheel)
  const onWheel = useCallback((e: React.WheelEvent) => {
    if (!timelineRef.current || !onZoomChange) return;
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const rect = timelineRef.current.getBoundingClientRect();
    const cursorX = e.clientX - rect.left + timelineRef.current.scrollLeft;
    const anchorTime = pixelsToTime(cursorX);
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    const nextZoom = Math.min(8, Math.max(0.25, zoom * factor));
    const nextPps = Math.max(5, nextZoom * 10);
    const nextX = anchorTime * nextPps;
    // adjust scroll to keep anchor
    timelineRef.current.scrollLeft += (nextX - cursorX);
    onZoomChange(nextZoom);
  }, [onZoomChange, zoom, pixelsToTime]);

  const visibleClips = useMemo(() => {
    return clips.filter(clip => {
      const meta = clipMetadata[clip.id] || {};
      const tags = (meta.tags || []).map(t => t.toLowerCase());
      const hasTag = !filterTags.length || filterTags.some(t => tags.includes(t.toLowerCase()));
      const haystack = [clip.name, meta.shotName, meta.scene, meta.take, ...(meta.tags || [])]
        .filter(Boolean)
        .map(v => (', ' + v).toLowerCase());
      const matchesSearch = !searchQuery || haystack.some(v => v.includes(searchQuery.toLowerCase()));
      return hasTag && matchesSearch;
    });
  }, [clips, clipMetadata, filterTags, searchQuery]);

  const trackOffsets = useMemo(() => {
    const offsets: Record<string, { top: number; height: number }> = {};
    let y = 0;
    for (const t of tracks) {
      const h = Math.max(24, Math.round(t.height * trackHeightScale));
      offsets[t.id] = { top: y, height: h };
      y += h;
    }
    return offsets;
  }, [tracks, trackHeightScale]);

  const openContextMenu = (e: React.MouseEvent, clipId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuClipId(clipId);
    setMenuAnchor(e.currentTarget as HTMLElement);
  };
  const closeContextMenu = () => {
    setMenuClipId(null);
    setMenuAnchor(null);
  };

  const handleMenu = (action: string, extra?: any) => {
    if (!menuClipId || !onContextMenuAction) { closeContextMenu(); return; }
    onContextMenuAction(action, { clipId: menuClipId, ...extra });
    closeContextMenu();
  };

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Ruler */}
      <Box ref={rulerRef} sx={{ height: RULER_HEIGHT, borderBottom: 1, borderColor: 'divider', position: 'relative', cursor: 'ew-resize' }} onMouseDown={onRulerMouseDown}>
        <Box sx={{ position: 'absolute', inset: 0 }}>
          {gridLines.map((line) => (
            <Box key={line.time} sx={{ position: 'absolute', left: HEADER_WIDTH + line.position, top: 0, bottom: 0, width: 1, bgcolor: line.isMain ? 'divider' : 'rgba(0,0,0,0.06)' }} />
          ))}
          {/* Markers */}
          {markers.map(m => {
            const isFaceMarker = m.label?.includes('Face') || m.color === '#10b981';
            return (
              <Tooltip key={m.id} title={m.label || `Marker @ ${m.time.toFixed(2)}s`} arrow>
                <Box
                  onClick={(e) => {
                    e.stopPropagation();
                    onTimelineClick(m.time);
                    onCurrentTimeChange?.(m.time);
                  }}
                  title={m.label || ', '}
                  sx={{
                    position: 'absolute',
                    left: HEADER_WIDTH + timeToPixels(m.time) - (isFaceMarker ? 4 : 1),
                    top: 0,
                    width: isFaceMarker ? 8 : 2,
                    height: '100%',
                    bgcolor: m.color || 'warning.main',
                    cursor: 'pointer', '&:hover': {
                      width: isFaceMarker ? 10 : 3,
                      opacity: 0.9,
                      zIndex: 1,
                    },
                    // Face marker special styling
                    ...(isFaceMarker && {
                      borderRadius: '2px 2px 0 0',
                      boxShadow: '0 0 4px rgba(16, 185, 129, 0.5)',
                    })}}
                >
                  {/* Face marker indicator */}
                  {isFaceMarker && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 2,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        bgcolor: '#10b981',
                        border: '1px solid white',
                        boxShadow: '0 0 2px rgba(0,0,0,0.3)'}}
                    />
                  )}
                </Box>
              </Tooltip>
            );
          })}
          {/* Playhead */}
          <Box sx={{ position: 'absolute', left: HEADER_WIDTH + timeToPixels(currentTime), top: 0, bottom: 0, width: 2, bgcolor: 'error.main' }} />
        </Box>
      </Box>

      {/* Timeline area */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Track headers */}
        <Box sx={{ width: HEADER_WIDTH, borderRight: 1, borderColor: 'divider' }}>
          {tracks.map((t) => {
            const h = Math.max(24, Math.round(t.height * trackHeightScale));
            const st = trackStates[t.id] || {};
            const headerType: NonNullable<TrackState['type']> = (st.type as any) || (t.type === 'audio' ? 'audio' : 'video');
            return (
              <Box key={t.id} sx={{ height: h, display: 'flex', alignItems: 'center', px: 1, gap: 0.5, borderBottom: 1, borderColor: 'divider' }}>
                <TextField
                  variant="standard"
                  size="small"
                  value={t.name}
                  onChange={(e) => onTrackRename?.(t.id, e.target.value)}
                  inputProps={{ style: { fontSize: 12, padding: 0 } }}
                  sx={{ flex: 1, mr: 0.5 }}
                />
                <Select
                  variant="standard"
                  size="small"
                  value={headerType}
                  onChange={(e) => onTrackTypeChange?.(t.id, e.target.value as TrackState['type'])}
                  displayEmpty
                  sx={{ fontSize: 12, minWidth: 70 }}
                >
                  <MenuItem value="video">Video</MenuItem>
                  <MenuItem value="audio">Audio</MenuItem>
                  <MenuItem value="adjustment">Adj</MenuItem>
                  <MenuItem value="subtitle">Sub</MenuItem>
                  <MenuItem value="graphics">GFX</MenuItem>
                </Select>
                <Tooltip title={st.locked ? 'Unlock' : 'Lock'}>
                  <Chip size="small" label="L" color={st.locked ? 'default' : 'primary'} variant={st.locked ? 'outlined' : 'filled'} onClick={() => onTrackToggle?.(t.id, { locked: !st.locked })} />
                </Tooltip>
                <Tooltip title={st.mute ? 'Unmute' : 'Mute'}>
                  <Chip size="small" label="M" color={st.mute ? 'default' : 'primary'} variant={st.mute ? 'outlined' : 'filled'} onClick={() => onTrackToggle?.(t.id, { mute: !st.mute })} />
                </Tooltip>
                <Tooltip title={st.solo ? 'Unsolo' : 'Solo'}>
                  <Chip size="small" label="S" color={st.solo ? 'default' : 'primary'} variant={st.solo ? 'outlined' : 'filled'} onClick={() => onTrackToggle?.(t.id, { solo: !st.solo })} />
                </Tooltip>
                <Tooltip title={st.visible === false ? 'Show' : 'Hide'}>
                  <Chip size="small" label="V" color={st.visible === false ? 'default' : 'primary'} variant={st.visible === false ? 'outlined' : 'filled'} onClick={() => onTrackToggle?.(t.id, { visible: !(st.visible !== false) })} />
                </Tooltip>
              </Box>
            );
          })}
        </Box>

        {/* Tracks content */}
        <Box sx={{ flex: 1, position: 'relative', overflow: 'auto' }} ref={timelineRef} onWheel={onWheel} onClick={handleTimelineClickLocal}>
          <Box sx={{ position: 'relative', width: timelineWidth + HEADER_WIDTH, height: tracks.reduce((a, t) => a + Math.max(24, Math.round(t.height * trackHeightScale)), 0) }}>
            {/* Grid vertical lines duplicated in content for alignment */}
            {gridLines.map((line) => (
              <Box key={`g-${line.time}`} sx={{ position: 'absolute', left: HEADER_WIDTH + line.position, top: 0, bottom: 0, width: 1, bgcolor: line.isMain ? 'divider' : 'rgba(0,0,0,0.04)' }} />
            ))}

            {/* Compare overlay */}
            {compareClips.map(c => {
              const off = trackOffsets[c.trackId];
              if (!off) return null;
              return (
                <Box key={`ghost-${c.id}`} sx={{ position: 'absolute', left: HEADER_WIDTH + timeToPixels(c.start), top: off.top, width: timeToPixels(c.duration), height: off.height - 4, bgcolor: 'rgba(0,0,0,0.08)', border: '1px dashed rgba(0,0,0,0.2)', pointerEvents: 'none' }} />
              );
            })}

            {/* Tracks rows backgrounds */}
            {tracks.map((t) => {
              const off = trackOffsets[t.id];
              return (
                <Box key={`row-${t.id}`} sx={{ position: 'absolute', left: HEADER_WIDTH, top: off.top, right: 0, height: off.height, bgcolor: t.type === 'audio' ? 'rgba(0,0,0,0.03)' : 'transparent', borderBottom: '1px solid', borderColor: 'divider' }} />
              );
            })}

            {/* Transitions */}
            {transitions.map(tr => {
              const off = trackOffsets[tr.trackId];
              if (!off) return null;
              return (
                <Tooltip key={tr.id} title={`${tr.type} @ ${tr.time.toFixed(2)}s`}>
                  <Box sx={{ position: 'absolute', left: HEADER_WIDTH + timeToPixels(tr.time), top: off.top, height: off.height, width: 2, bgcolor: 'info.main' }} />
                </Tooltip>
              );
            })}

            {/* Clips */}
            {visibleClips.map(clip => {
              const off = trackOffsets[clip.trackId];
              if (!off) return null;
              const leftPx = HEADER_WIDTH + timeToPixels(clip.start);
              const widthPx = Math.max(4, timeToPixels(clip.duration));
              const selected = selectedClips.has(clip.id);
              const locked = trackStates[clip.trackId]?.locked;
              return (
                <Box
                  key={clip.id}
                  onMouseDown={(e) => {
                    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                    const xWithin = e.clientX - rect.left;
                    if (reviewerMode || locked) return; // block edits
                    if (xWithin < 6) return beginDrag(e, clip.id, 'resize-left');
                    if (xWithin > rect.width - 6) return beginDrag(e, clip.id, 'resize-right');
                    beginDrag(e, clip.id, 'move');
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onClipSelect(clip.id, e.metaKey || e.ctrlKey || e.shiftKey);
                  }}
                  onContextMenu={(e) => openContextMenu(e, clip.id)}
                  sx={{ position: 'absolute', left: leftPx, top: off.top + 2, width: widthPx, height: off.height - 4, bgcolor: selected ? 'primary.main' : clip.color || 'grey.500', opacity: trackStates[clip.trackId]?.visible === false ? 0.4 : 1, color: 'white', borderRadius: 0.5, boxShadow: selected ? 2 : 0, cursor: reviewerMode || locked ? 'not-allowed' : 'grab' }}
                >
                  {/* Label + metadata */}
                  <Box sx={{ px: 0.5, py: 0.25, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography variant="caption" sx={{ fontWeight: 600, textShadow: '0 1px 1px rgba(0,0,0,0.4)' }} noWrap>
                      {clip.name}
                    </Typography>
                    {/* Enhanced audio indicator */}
                    {(clip as any).enhanced && (clip as any).metadata?.originalName && (
                      <Tooltip title={`Enhanced from: ${(clip as any).metadata.originalName}`}>
                        <Chip 
                          size="small" 
                          label="ENH" 
                          sx={{ 
                            height: 16, 
                            fontSize: 10, 
                            bgcolor: 'rgba(22, 163, 74, 0.8)', 
                            color: '#fff',
                            fontWeight: 60
                          }} 
                        />
                      </Tooltip>
                    )}
                    {/* Angle/Camera indicator */}
                    {clipMetadata[clip.id]?.camera && (
                      <Chip 
                        size="small" 
                        label={clipMetadata[clip.id]!.camera!} 
                        sx={{ 
                          height: 16, 
                          fontSize: 10, 
                          bgcolor: 'rgba(59, 130, 246, 0.8)', 
                          color: '#fff',
                          fontWeight: 60
                        }} 
                      />
                    )}
                    {!!clipMetadata[clip.id]?.shotName && (
                      <Chip size="small" label={clipMetadata[clip.id]!.shotName!} sx={{ height: 16, fontSize: 10, bgcolor: 'rgba(0,0,0,0.25)', color: '#fff' }} />
                    )}
                    {/* Sync confidence indicator */}
                    {(clip as any).metadata?.syncConfidence !== undefined && (
                      <Tooltip title={`Sync confidence: ${((clip as any).metadata.syncConfidence * 100).toFixed(0)}%`}>
                        <Chip 
                          size="small" 
                          label={`Sync ${((clip as any).metadata.syncConfidence * 100).toFixed(0)}%`}
                          sx={{ 
                            height: 16, 
                            fontSize: 10, 
                            bgcolor: (clip as any).metadata.syncConfidence > 0.8 
                              ? 'rgba(76, 175, 80, 0.8)' 
                              : (clip as any).metadata.syncConfidence > 0.6 
                              ? 'rgba(255, 152, 0, 0.8)' : 'rgba(244, 67, 54, 0.8)',
                            color: '#fff',
                            fontWeight: 60
                          }} 
                        />
                      </Tooltip>
                    )}
                    {(clipMetadata[clip.id]?.tags || (clip as any).tags || []).slice(0, 2).map((tag: string) => (
                      <Chip key={tag} size="small" label={tag} sx={{ height: 16, fontSize: 10, bgcolor: 'rgba(0,0,0,0.2)', color: '#fff' }} />
                    ))}
                    {collabLocks[clip.id] && (
                      <Tooltip title={`Locked by ${collabLocks[clip.id]?.user || 'someone'}`}>
                        <Chip size="small" label="LOCK" color="warning" sx={{ height: 16, fontSize: 10 }} />
                      </Tooltip>
                    )}
                  </Box>
                  {/* Resize handles visuals */}
                  {!reviewerMode && !locked && (
                    <>
                      <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, bgcolor: 'rgba(255,255,255,0.35)' }} />
                      <Box sx={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 4, bgcolor: 'rgba(255,255,255,0.35)' }} />
                    </>
                  )}
                </Box>
              );
            })}
          </Box>
        </Box>
      </Box>

      {/* Context menu */}
      <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={closeContextMenu} anchorOrigin={{ horizontal: 'left', vertical: 'bottom' }}>
        <MenuItem onClick={() => handleMenu('edit-metadata')}>Edit metadata…</MenuItem>
        {!reviewerMode && (
          <>
            <MenuItem onClick={() => handleMenu('split')}>Split at playhead</MenuItem>
            <MenuItem onClick={() => handleMenu('duplicate')}>Duplicate</MenuItem>
            <MenuItem onClick={() => handleMenu('delete')}>Delete</MenuItem>
            <Divider />
            <MenuItem onClick={() => handleMenu('color', { color: '#9c27b0' })}>Label: Purple</MenuItem>
            <MenuItem onClick={() => handleMenu('color', { color: '#03a9f4' })}>Label: Blue</MenuItem>
          </>
        )}
        <Divider />
        <MenuItem onClick={() => handleMenu('add-comment')}>Add comment…</MenuItem>
        {reviewerMode && (
          <>
            <Divider />
            <MenuItem onClick={() => handleMenu('review-approve')}>Approve</MenuItem>
            <MenuItem onClick={() => handleMenu('review-request-changes')}>Request changes</MenuItem>
          </>
        )}
      </Menu>
    </Box>
  );
}
