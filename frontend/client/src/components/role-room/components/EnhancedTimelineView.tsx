import { useState, useRef, useEffect, useMemo, type FC } from 'react';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Chip,
  Tooltip,
  IconButton,
  Slider,
  alpha,
} from '@mui/material';
import {
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  Mic as MicIcon,
  Videocam as VideocamIcon,
} from '@mui/icons-material';
import type { SceneBreakdown, CastingShot, ShotList } from '../models/casting';

interface EnhancedTimelineViewProps {
  scenes: SceneBreakdown[];
  shotLists: ShotList[];
  onSceneSelect: (scene: SceneBreakdown) => void;
  onShotSelect?: (shot: CastingShot, scene: SceneBreakdown) => void;
  selectedScene?: SceneBreakdown;
  selectedShot?: CastingShot;
}

interface ShotBlock {
  shot: CastingShot;
  scene: SceneBreakdown;
  color: string;
  startTime: number;
  duration: number;
}

const SHOT_COLORS: Record<string, string> = {
  'Wide': '#4caf50',
  'Medium': '#9333ea',
  'Close-up': '#2196f3',
  'Extreme Close-up': '#9c27b0',
  'Establishing': '#00bcd4',
  'Detail': '#f44336',
  'Two Shot': '#ffc107',
  'Over Shoulder': '#3f51b5',
};

export const EnhancedTimelineView: FC<EnhancedTimelineViewProps> = ({
  scenes,
  shotLists,
  onSceneSelect,
  onShotSelect,
  selectedScene,
  selectedShot,
}) => {
  const [zoom, setZoom] = useState(1);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState(0);

  // Build shot blocks from shot lists
  const shotBlocks = useMemo(() => {
    const blocks: ShotBlock[] = [];
    let cumulativeTime = 0;

    scenes.forEach(scene => {
      const shotList = shotLists.find(sl => sl.sceneId === scene.id);
      const shots = shotList?.shots || [];

      if (shots.length === 0) {
        // Legg til placeholder block for scener uten shots
        blocks.push({
          shot: {
            id: `placeholder-${scene.id}`,
            shotType: 'Wide',
            cameraAngle: 'Eye Level',
            cameraMovement: 'Static',
            roleId: '',
            sceneId: scene.id,
            duration: scene.estimatedDuration || 60,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          } as CastingShot,
          scene,
          color: 'rgba(100, 100, 100, 0.3)',
          startTime: cumulativeTime,
          duration: scene.estimatedDuration || 60,
        });
        cumulativeTime += scene.estimatedDuration || 60;
      } else {
        shots.forEach(shot => {
          blocks.push({
            shot,
            scene,
            color: SHOT_COLORS[shot.shotType] || '#9e9e9e',
            startTime: cumulativeTime,
            duration: shot.duration || 10,
          });
          cumulativeTime += shot.duration || 10;
        });
      }
    });

    return blocks;
  }, [scenes, shotLists]);

  // Calculate total duration
  const totalDuration = useMemo(() => {
    return shotBlocks.reduce((sum, block) => sum + block.duration, 0);
  }, [shotBlocks]);

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Group shots by scene for scene markers
  const sceneMarkers = useMemo(() => {
    const markers: Array<{ scene: SceneBreakdown; startTime: number; endTime: number }> = [];
    let currentTime = 0;

    scenes.forEach(scene => {
      const shotList = shotLists.find(sl => sl.sceneId === scene.id);
      const shots = shotList?.shots || [];
      const sceneDuration = shots.length > 0 
        ? shots.reduce((sum, shot) => sum + (shot.duration || 10), 0)
        : (scene.estimatedDuration || 60);
      
      markers.push({
        scene,
        startTime: currentTime,
        endTime: currentTime + sceneDuration,
      });
      
      currentTime += sceneDuration;
    });

    return markers;
  }, [scenes, shotLists]);

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: '#0f3460',
        position: 'relative',
      }}
    >
      {/* Timeline header */}
      <Box
        sx={{
          p: 1,
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', fontWeight: 600 }}>
          TIMELINE - SCENEPLAN
        </Typography>
        
        <Stack direction="row" spacing={1} alignItems="center">
          <IconButton size="small" onClick={() => setZoom(Math.max(0.5, zoom - 0.25))} sx={{ color: '#fff' }}>
            <ZoomOutIcon fontSize="small" />
          </IconButton>
          <Typography variant="caption" sx={{ color: '#fff', minWidth: 40, textAlign: 'center' }}>
            {Math.round(zoom * 100)}%
          </Typography>
          <IconButton size="small" onClick={() => setZoom(Math.min(3, zoom + 0.25))} sx={{ color: '#fff' }}>
            <ZoomInIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Box>

      {/* Scene labels with colored dot */}
      <Box
        sx={{
          height: 30,
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {sceneMarkers.map((marker, idx) => {
          const width = ((marker.endTime - marker.startTime) / Math.max(totalDuration, 1)) * 100;
          const left = (marker.startTime / Math.max(totalDuration, 1)) * 100;
          const isSelected = selectedScene?.id === marker.scene.id;
          
          return (
            <Box
              key={marker.scene.id}
              sx={{
                position: 'absolute',
                left: `${left}%`,
                width: `${Math.max(width, 5)}%`,
                height: '100%',
                borderRight: '1px solid rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                pl: 1,
                gap: 1,
                cursor: 'pointer',
                bgcolor: isSelected ? 'rgba(233, 30, 99, 0.2)' : 'transparent',
                '&:hover': {
                  bgcolor: 'rgba(255,255,255,0.05)',
                },
              }}
              onClick={() => onSceneSelect(marker.scene)}
            >
              {/* Farget prikk */}
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: isSelected ? '#e91e63' : 'rgba(255,255,255,0.5)',
                  flexShrink: 0,
                }}
              />
              <Typography
                variant="caption"
                sx={{
                  color: isSelected ? '#e91e63' : 'rgba(255,255,255,0.6)',
                  fontWeight: isSelected ? 700 : 400,
                  fontSize: '0.65rem',
                  whiteSpace: 'nowrap',
                }}
              >
                SCENE {marker.scene.sceneNumber}
              </Typography>
            </Box>
          );
        })}
      </Box>

      {/* Shot blocks timeline */}
      <Box
        ref={timelineRef}
        sx={{
          flex: 1,
          position: 'relative',
          overflow: 'auto',
          p: 1,
        }}
      >
        {/* Audio track */}
        <Box sx={{ mb: 1, position: 'relative', height: 40 }}>
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5 }}>
            <MicIcon sx={{ fontSize: 14, color: 'rgba(255,255,255,0.87)' }} />
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
              Audio
            </Typography>
          </Stack>
          <Box
            sx={{
              height: 24,
              bgcolor: 'rgba(0,0,0,0.3)',
              borderRadius: 1,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Audio waveform placeholder */}
            <Box
              sx={{
                position: 'absolute',
                left: 0,
                right: 0,
                height: '100%',
                background: 'linear-gradient(90deg, rgba(100,181,246,0.3) 0%, rgba(100,181,246,0.1) 50%, rgba(100,181,246,0.3) 100%)',
              }}
            />
          </Box>
        </Box>

        {/* Video track - Shot blocks */}
        <Box sx={{ mb: 1, position: 'relative' }}>
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5 }}>
            <VideocamIcon sx={{ fontSize: 14, color: 'rgba(255,255,255,0.87)' }} />
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
              Video
            </Typography>
          </Stack>
          
          <Box
            sx={{
              position: 'relative',
              height: 60,
              display: 'flex',
              gap: 0.5,
            }}
          >
            {shotBlocks.map((block, idx) => {
              const widthPercent = (block.duration / totalDuration) * 100;
              const isSelected = selectedShot?.id === block.shot.id;
              
              return (
                <Tooltip
                  key={block.shot.id}
                  title={
                    <Box>
                      <Typography variant="caption" sx={{ fontWeight: 600 }}>
                        {block.shot.shotType}
                      </Typography>
                      <Typography variant="caption" display="block">
                        Scene {block.scene.sceneNumber}
                      </Typography>
                      <Typography variant="caption" display="block">
                        {formatTime(block.duration)}
                      </Typography>
                    </Box>
                  }
                >
                  <Box
                    onClick={() => {
                      onSceneSelect(block.scene);
                      if (onShotSelect) {
                        onShotSelect(block.shot, block.scene);
                      }
                    }}
                    sx={{
                      flex: `0 0 ${widthPercent}%`,
                      height: '100%',
                      bgcolor: block.color,
                      border: isSelected ? '2px solid #e91e63' : 'none',
                      borderRadius: 0.5,
                      cursor: 'pointer',
                      position: 'relative',
                      overflow: 'hidden',
                      transition: 'all 0.2s',
                      '&:hover': {
                        transform: 'scaleY(1.1)',
                        zIndex: 10,
                        boxShadow: `0 0 8px ${block.color}`,
                      },
                    }}
                  >
                    {/* Shot label */}
                    {widthPercent > 5 && (
                      <Typography
                        variant="caption"
                        sx={{
                          position: 'absolute',
                          top: 2,
                          left: 4,
                          color: '#fff',
                          fontSize: '0.65rem',
                          fontWeight: 600,
                          textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                        }}
                      >
                        SHOT {idx + 1}
                      </Typography>
                    )}
                    
                    {/* Duration label */}
                    {widthPercent > 8 && (
                      <Typography
                        variant="caption"
                        sx={{
                          position: 'absolute',
                          bottom: 2,
                          right: 4,
                          color: 'rgba(255,255,255,0.9)',
                          fontSize: '0.6rem',
                          textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                        }}
                      >
                        {formatTime(block.duration)}
                      </Typography>
                    )}
                  </Box>
                </Tooltip>
              );
            })}
          </Box>
        </Box>

        {/* Time ruler */}
        <Box
          sx={{
            height: 20,
            position: 'relative',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            mt: 1,
          }}
        >
          {Array.from({ length: Math.ceil(totalDuration / 60) + 1 }).map((_, idx) => {
            const timeInSeconds = idx * 60;
            const position = (timeInSeconds / totalDuration) * 100;
            
            return (
              <Box
                key={idx}
                sx={{
                  position: 'absolute',
                  left: `${position}%`,
                  transform: 'translateX(-50%)',
                }}
              >
                <Box
                  sx={{
                    width: 1,
                    height: 6,
                    bgcolor: 'rgba(255,255,255,0.6)',
                    mb: 0.5,
                  }}
                />
                <Typography
                  variant="caption"
                  sx={{
                    color: 'rgba(255,255,255,0.87)',
                    fontSize: '0.6rem',
                  }}
                >
                  {formatTime(timeInSeconds)}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* Current time indicator */}
      <Box
        sx={{
          position: 'absolute',
          left: `${(currentTime / totalDuration) * 100}%`,
          top: 30,
          bottom: 0,
          width: 2,
          bgcolor: '#e91e63',
          pointerEvents: 'none',
          zIndex: 100,
        }}
      >
        <Box
          sx={{
            width: 12,
            height: 12,
            bgcolor: '#e91e63',
            borderRadius: '50%',
            position: 'absolute',
            top: -6,
            left: -5,
          }}
        />
      </Box>
    </Box>
  );
};

export default EnhancedTimelineView;
