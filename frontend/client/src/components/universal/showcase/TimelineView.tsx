/**
 * Timeline/Storyboard View Component
 * Videographer-specific horizontal timeline with drag-and-drop
 * Perfect for video editing workflows
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Chip,
  Tooltip,
  Paper,
  Stack,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Slider,
  Divider,
} from '@mui/material';
import {
  Close,
  PlayArrow,
  Pause,
  ZoomIn,
  ZoomOut,
  Add,
  Delete,
  ContentCut,
  BookmarkAdd,
  SwapHoriz,
  Layers,
  Timeline as TimelineIcon,
  ViewModule,
  DragIndicator,
} from '@mui/icons-material';

interface VideoClip {
  id: string;
  title: string;
  thumbnailUrl?: string;
  fileUrl?: string;
  duration: number; // in seconds
  startTime: number; // position in timeline
  version?: string;
  chapter?: string;
}

interface ChapterMarker {
  id: string;
  time: number;
  label: string;
  color: string;
}

interface TimelineViewProps {
  open: boolean;
  clips: VideoClip[];
  onClose: () => void;
  accentColor: string;
  onReorder?: (newOrder: VideoClip[]) => void;
  onChapterAdd?: (marker: ChapterMarker) => void;
  onClipEdit?: (clip: VideoClip) => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  open,
  clips: initialClips,
  onClose,
  accentColor,
  onReorder,
  onChapterAdd,
  onClipEdit
}) => {
  const [clips, setClips] = useState<VideoClip[]>(initialClips);
  const [chapters, setChapters] = useState<ChapterMarker[]>([]);
  const [zoom, setZoom] = useState(1);
  const [playheadPosition, setPlayheadPosition] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [draggedClip, setDraggedClip] = useState<string | null>(null);
  const [showChapterDialog, setShowChapterDialog] = useState(false);
  const [newChapterTime, setNewChapterTime] = useState(0);
  const [newChapterLabel, setNewChapterLabel] = useState('');
  const [viewMode, setViewMode] = useState<'timeline' | 'storyboard'>('timeline');
  
  const timelineRef = useRef<HTMLDivElement>(null);
  const playIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate total duration
  const totalDuration = clips.reduce((sum, clip) => 
    Math.max(sum, clip.startTime + clip.duration), 0
  );

  // Format time (seconds to MM:SS)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2,'0')}`;
  };

  // Play/Pause functionality
  const togglePlay = () => {
    if (isPlaying) {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      playIntervalRef.current = setInterval(() => {
        setPlayheadPosition(prev => {
          if (prev >= totalDuration) {
            if (playIntervalRef.current) clearInterval(playIntervalRef.current);
            setIsPlaying(false);
            return 0;
          }
          return prev + 0.1;
        });
      }, 100);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    };
  }, []);

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, clipId: string) => {
    setDraggedClip(clipId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetClipId: string) => {
    e.preventDefault();
    if (!draggedClip || draggedClip === targetClipId) return;

    const draggedIndex = clips.findIndex(c => c.id === draggedClip);
    const targetIndex = clips.findIndex(c => c.id === targetClipId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const newClips = [...clips];
    const [removed] = newClips.splice(draggedIndex, 1);
    newClips.splice(targetIndex, 0, removed);

    // Recalculate start times
    let currentTime = 0;
    newClips.forEach(clip => {
      clip.startTime = currentTime;
      currentTime += clip.duration;
    });

    setClips(newClips);
    onReorder?.(newClips);
    setDraggedClip(null);
  };

  // Add chapter marker
  const handleAddChapter = () => {
    if (!newChapterLabel) return;

    const newChapter: ChapterMarker = {
      id: Date.now().toString(),
      time: newChapterTime,
      label: newChapterLabel,
      color: accentColor
    };

    setChapters([...chapters, newChapter]);
    onChapterAdd?.(newChapter);
    setShowChapterDialog(false);
    setNewChapterLabel('');
  };

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      fullScreen
      PaperProps={{
        sx: {
          bgcolor: '#0a0a0a',
          color: 'white'
        }
      }}
    >
      {/* Header */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        p: 2,
        borderBottom: `2px solid ${accentColor}`,
        bgcolor: 'rgba(0,0,0,0.8)'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <TimelineIcon sx={{ color: accentColor, fontSize: 32 }} />
          <Box>
            <Typography variant="h6" fontWeight="600">
              {viewMode === 'timeline' ? 'Timeline View' : 'Storyboard View'}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
              {clips.length} clips • {formatTime(totalDuration)} total
            </Typography>
          </Box>
        </Box>

        {/* View Mode Toggle */}
        <Stack direction="row" spacing={1}>
          <Tooltip title="Timeline View">
            <IconButton
              onClick={() => setViewMode('timeline')}
              sx={{
                color: viewMode === 'timeline' ? accentColor : 'rgba(255,255,255,0.5)',
                bgcolor: viewMode === 'timeline' ? `${accentColor}20` : 'transparent'
              }}
            >
              <TimelineIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Storyboard View">
            <IconButton
              onClick={() => setViewMode('storyboard')}
              sx={{
                color: viewMode === 'storyboard' ? accentColor : 'rgba(255,255,255,0.5)',
                bgcolor: viewMode === 'storyboard' ? `${accentColor}20` : 'transparent'
              }}
            >
              <ViewModule />
            </IconButton>
          </Tooltip>
        </Stack>

        <IconButton onClick={onClose} sx={{ color: 'white' }}>
          <Close />
        </IconButton>
      </Box>

      {/* Toolbar */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center',
        p: 2,
        bgcolor: 'rgba(0,0,0,0.6)',
        borderBottom: '1px solid rgba(255,255,255,0.1)'
      }}>
        {/* Playback Controls */}
        <Stack direction="row" spacing={2} alignItems="center">
          <IconButton
            onClick={togglePlay}
            sx={{
              bgcolor: accentColor,
              color: 'white', '&:hover': { bgcolor: `${accentColor}dd` }
            }}
          >
            {isPlaying ? <Pause /> : <PlayArrow />}
          </IconButton>

          <Typography variant="body2" sx={{ minWidth: 100 }}>
            {formatTime(playheadPosition)} / {formatTime(totalDuration)}
          </Typography>

          <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.2)' }} />

          {/* Zoom Controls */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton 
              onClick={() => setZoom(prev => Math.max(prev - 0.25, 0.5))}
              sx={{ color: 'white' }}
              size="small"
            >
              <ZoomOut fontSize="small" />
            </IconButton>
            <Slider
              value={zoom}
              onChange={(_, value) => setZoom(value as number)}
              min={0.5}
              max={3}
              step={0.25}
              sx={{
                width: 100,
                color: accentColor,
                '& .MuiSlider-thumb': {
                  width: 12,
                  height: 12
                }
              }}
            />
            <IconButton 
              onClick={() => setZoom(prev => Math.min(prev + 0.25, 3))}
              sx={{ color: 'white' }}
              size="small"
            >
              <ZoomIn fontSize="small" />
            </IconButton>
            <Chip 
              label={`${Math.round(zoom * 100)}%`}
              size="small"
              onClick={() => setZoom(1)}
              sx={{ bgcolor: `${accentColor}30`, color: 'white', cursor: 'pointer' }}
            />
          </Box>
        </Stack>

        {/* Actions */}
        <Stack direction="row" spacing={1}>
          <Button
            startIcon={<BookmarkAdd />}
            variant="outlined"
            size="small"
            onClick={() => {
              setNewChapterTime(playheadPosition);
              setShowChapterDialog(true);
            }}
            sx={{
              borderColor: `${accentColor}60`,
              color: accentColor,
              '&:hover': { borderColor: accentColor }
            }}
          >
            Add Chapter
          </Button>
          <Button
            startIcon={<Add />}
            variant="outlined"
            size="small"
            sx={{
              borderColor: `${accentColor}60`,
              color: accentColor,
              '&:hover': { borderColor: accentColor }
            }}
          >
            Add Clip
          </Button>
        </Stack>
      </Box>

      {/* Timeline/Storyboard Area */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
        {viewMode === 'timeline' ? (
          <Box ref={timelineRef}>
            {/* Time Ruler */}
            <Box sx={{ 
              position: 'relative',
              height: 40,
              bgcolor: 'rgba(255,255,255,0.05)',
              borderRadius: 1,
              mb: 2,
              overflow: 'hidden'
            }}>
              {/* Time markers */}
              {Array.from({ length: Math.ceil(totalDuration / 10) + 1 }).map((_, i) => (
                <Box
                  key={i}
                  sx={{
                    position: 'absolute',
                    left: `${(i * 10 / totalDuration) * 100}%`,
                    top: 0,
                    height: '100%',
                    borderLeft: '1px solid rgba(255,255,255,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    pl: 1
                  }}
                >
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                    {formatTime(i * 10)}
                  </Typography>
                </Box>
              ))}

              {/* Playhead */}
              <Box
                sx={{
                  position: 'absolute',
                  left: `${(playheadPosition / totalDuration) * 100}%`,
                  top: 0,
                  bottom: 0,
                  width: 2,
                  bgcolor: accentColor,
                  zIndex: 1}}
              />
            </Box>

            {/* Chapter Markers */}
            {chapters.length > 0 && (
              <Box sx={{ position: 'relative', height: 30, mb: 2 }}>
                {chapters.map(chapter => (
                  <Box
                    key={chapter.id}
                    sx={{
                      position: 'absolute',
                      left: `${(chapter.time / totalDuration) * 100}%`,
                      transform: 'translateX(-50%)',
                      top: 0
                    }}
                  >
                    <Chip
                      label={chapter.label}
                      size="small"
                      sx={{
                        bgcolor: `${chapter.color}40`,
                        color: 'white',
                        borderLeft: `3px solid ${chapter.color}`,
                        fontSize: '0.65rem'
                      }}
                    />
                  </Box>
                ))}
              </Box>
            )}

            {/* Video Clips Track */}
            <Box sx={{ 
              position: 'relative',
              height: 120,
              bgcolor: 'rgba(255,255,255,0.05)',
              borderRadius: 2,
              overflow: 'hidden'
            }}>
              {clips.map(clip => (
                <Paper
                  key={clip.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, clip.id)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, clip.id)}
                  sx={{
                    position: 'absolute',
                    left: `${(clip.startTime / totalDuration) * 100}%`,
                    width: `${(clip.duration / totalDuration) * 100}%`,
                    height: '100%',
                    bgcolor: `${accentColor}30`,
                    border: `2px solid ${accentColor}`,
                    borderRadius: 1,
                    cursor: 'grab',
                    overflow: 'hidden',
                    transition: 'transform 0.2s','&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: `0 4px 20px ${accentColor}60`
                    }, '&:active': {
                      cursor: 'grabbing'
                    }
                  }}
                >
                  {/* Thumbnail */}
                  {clip.thumbnailUrl && (
                    <Box
                      component="img"
                      src={clip.thumbnailUrl}
                      sx={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        opacity: 0.6
                      }}
                    />
                  )}

                  {/* Clip Info Overlay */}
                  <Box sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    p: 1
                  }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="caption" noWrap sx={{ color: 'white', fontWeight: 600}}>
                        {clip.title}
                      </Typography>
                      <DragIndicator sx={{ fontSize: 16, color: 'white' }} />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="caption" sx={{ color: 'white' }}>
                        {formatTime(clip.duration)}
                      </Typography>
                      {clip.version && (
                        <Chip
                          label={clip.version}
                          size="small"
                          sx={{
                            height: 16,
                            fontSize: '0.6rem',
                            bgcolor: 'rgba(255,255,255,0.2)',
                            color: 'white'
                          }}
                        />
                      )}
                    </Box>
                  </Box>
                </Paper>
              ))}
            </Box>
          </Box>
        ) : (
          // Storyboard View
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            {clips.map((clip, index) => (
              <Paper
                key={clip.id}
                draggable
                onDragStart={(e) => handleDragStart(e, clip.id)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, clip.id)}
                sx={{
                  width: 200,
                  bgcolor: `${accentColor}20`,
                  border: `2px solid ${accentColor}40`,
                  borderRadius: 2,
                  cursor: 'grab',
                  transition: 'all 0.2s', '&:hover': {
                    transform: 'scale(1.05)',
                    boxShadow: `0 8px 25px ${accentColor}40`
                  }, '&:active': {
                    cursor: 'grabbing'
                  }
                }}
              >
                {/* Thumbnail */}
                <Box sx={{ position: 'relative' }}>
                  {clip.thumbnailUrl ? (
                    <Box
                      component="img"
                      src={clip.thumbnailUrl}
                      sx={{
                        width: '100%',
                        height: 120,
                        objectFit: 'cover'
                      }}
                    />
                  ) : (
                    <Box sx={{ 
                      width: '100%', 
                      height: 120, 
                      bgcolor: 'rgba(255,255,255,0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Layers sx={{ fontSize: 48, color: 'rgba(255,255,255,0.3)' }} />
                    </Box>
                  )}
                  <Chip
                    label={`#${index + 1}`}
                    size="small"
                    sx={{
                      position: 'absolute',
                      top: 8,
                      left: 8,
                      bgcolor: accentColor,
                      color: 'white',
                      fontWeight: 60
                    }}
                  />
                </Box>

                {/* Info */}
                <Box sx={{ p: 1.5 }}>
                  <Typography variant="body2" fontWeight="600" noWrap>
                    {clip.title}
                  </Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                      {formatTime(clip.duration)}
                    </Typography>
                    {clip.version && (
                      <Chip
                        label={clip.version}
                        size="small"
                        sx={{
                          height: 16,
                          fontSize: '0.6rem',
                          bgcolor: `${accentColor}40`
                        }}
                      />
                    )}
                  </Box>
                </Box>
              </Paper>
            ))}
          </Box>
        )}
      </Box>

      {/* Chapter Dialog */}
      <Dialog open={showChapterDialog} onClose={() => setShowChapterDialog(false)}>
        <DialogTitle>Add Chapter Marker</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Chapter Name"
            fullWidth
            value={newChapterLabel}
            onChange={(e) => setNewChapterLabel(e.target.value)}
            sx={{ mt: 2 }}
          />
          <Typography variant="caption" sx={{ mt: 2, display: 'block' }}>
            Time: {formatTime(newChapterTime)}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowChapterDialog(false)}>Cancel</Button>
          <Button onClick={handleAddChapter} variant="contained" sx={{ bgcolor: accentColor }}>
            Add Chapter
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
};

export default TimelineView;


