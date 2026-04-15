// @ts-nocheck
import { useState, useCallback, type FC, type MouseEvent, type ReactElement, type ReactNode } from "react";
import { Box, Typography, IconButton, Chip, Tooltip, LinearProgress, alpha } from "@mui/material";
import { PhotoCamera, Videocam, CameraRoll, Check, PlayArrow, Schedule, Star, StarBorder, Notes, Lightbulb, CameraAlt, Wallpaper, Timer, Add, Remove } from "@mui/icons-material";
import { motion, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import type { CastingShot, ShotStatus, MediaType, ShotPriority } from "../models/casting";

interface InteractiveShotCardProps {
  shot: CastingShot;
  index: number;
  isActive?: boolean;
  timeRemaining?: number;
  onStatusChange: (shotId: string, status: ShotStatus) => void;
  onTap?: (shot: CastingShot) => void;
  onHold?: (shot: CastingShot) => void;
  onSwipe?: (shot: CastingShot, direction: 'left' | 'right') => void;
  onNotesClick?: (shot: CastingShot) => void;
  getRoleName?: (roleId: string) => string;
  showRecommendations?: boolean;
  compactMode?: boolean;
}

const statusConfig: Record<ShotStatus, { label: string; color: string; bgColor: string; icon: ReactNode }> = {
  not_started: { 
    label: 'Venter', 
    color: '#78909c', 
    bgColor: 'rgba(120,144,156,0.15)',
    icon: <Schedule sx={{ fontSize: 18 }} />
  },
  in_progress: { 
    label: 'Pågår', 
    color: '#9333ea', 
    bgColor: 'rgba(147,51,234,0.15)',
    icon: <PlayArrow sx={{ fontSize: 18 }} />
  },
  completed: { 
    label: 'Fullført', 
    color: '#4caf50', 
    bgColor: 'rgba(76,175,80,0.15)',
    icon: <Check sx={{ fontSize: 18 }} />
  },
};

const priorityConfig: Record<ShotPriority, { label: string; color: string; weight: number }> = {
  critical: { label: 'Kritisk', color: '#f44336', weight: 3 },
  important: { label: 'Viktig', color: '#9333ea', weight: 2 },
  nice_to_have: { label: 'Bonus', color: '#9e9e9e', weight: 1 },
};

const mediaTypeConfig: Record<MediaType, { label: string; icon: ReactNode; color: string }> = {
  photo: { label: 'Foto', icon: <PhotoCamera sx={{ fontSize: 16 }} />, color: '#2196f3' },
  video: { label: 'Video', icon: <Videocam sx={{ fontSize: 16 }} />, color: '#e91e63' },
  hybrid: { label: 'Hybrid', icon: <CameraRoll sx={{ fontSize: 16 }} />, color: '#9c27b0' },
};

export const InteractiveShotCard: FC<InteractiveShotCardProps> = ({
  shot,
  index,
  isActive = false,
  timeRemaining,
  onStatusChange,
  onTap,
  onHold,
  onSwipe,
  onNotesClick,
  getRoleName,
  showRecommendations = true,
  compactMode = false,
}) => {
  const [isHolding, setIsHolding] = useState(false);
  const [holdTimer, setHoldTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  
  const x = useMotionValue(0);
  const background = useTransform(
    x,
    [-100, 0, 100],
    [
      'rgba(76,175,80,0.3)',
      'transparent',
      'rgba(244,67,54,0.3)'
    ]
  );
  
  const status = shot.status || 'not_started';
  const priority = shot.priority || 'important';
  const mediaType = shot.mediaType || 'photo';
  const statusInfo = statusConfig[status];
  const priorityInfo = priorityConfig[priority];
  const mediaInfo = mediaTypeConfig[mediaType];
  
  const handleTapStart = useCallback(() => {
    const timer = setTimeout(() => {
      setIsHolding(true);
      if (onHold) {
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
        onHold(shot);
      }
    }, 500);
    setHoldTimer(timer);
  }, [shot, onHold]);
  
  const handleTapEnd = useCallback(() => {
    if (holdTimer) {
      clearTimeout(holdTimer);
      setHoldTimer(null);
    }
    if (!isHolding && onTap) {
      onTap(shot);
    }
    setIsHolding(false);
  }, [holdTimer, isHolding, onTap, shot]);
  
  const handleDragEnd = useCallback((event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (Math.abs(info.offset.x) > 80) {
      const direction = info.offset.x > 0 ? 'right' : 'left';
      if (onSwipe) {
        onSwipe(shot, direction);
      }
      if (direction === 'left') {
        const newStatus: ShotStatus = status === 'not_started' ? 'in_progress' : 
                                      status === 'in_progress' ? 'completed' : 'completed';
        onStatusChange(shot.id, newStatus);
        if (navigator.vibrate) {
          navigator.vibrate([30, 50, 30]);
        }
      }
    }
  }, [shot, status, onSwipe, onStatusChange]);

  const cycleStatus = useCallback(() => {
    const statusOrder: ShotStatus[] = ['not_started', 'in_progress', 'completed'];
    const currentIndex = statusOrder.indexOf(status);
    const nextStatus = statusOrder[(currentIndex + 1) % statusOrder.length];
    onStatusChange(shot.id, nextStatus);
    if (nextStatus === 'completed' && navigator.vibrate) {
      navigator.vibrate([50, 30, 50]);
    }
  }, [status, shot.id, onStatusChange]);

  const hasRecommendations = shot.lensRecommendation || shot.lightingSetup || shot.backgroundRecommendation;
  const isCritical = priority === 'critical' && status !== 'completed';
  const isLowTime = timeRemaining !== undefined && timeRemaining < 10;

  return (
    <motion.div
      style={{ x, background }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.3}
      onDragEnd={handleDragEnd}
      onTapStart={handleTapStart}
      onTap={handleTapEnd}
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ 
        opacity: 1, 
        y: 0,
        boxShadow: isActive ? '0 0 0 2px #e91e63' : 'none',
      }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.2 }}
    >
      <Box
        sx={{
          bgcolor: isCritical && isLowTime 
            ? alpha('#f44336', 0.1) 
            : status === 'completed' 
              ? alpha('#4caf50', 0.05) 
              : 'rgba(30,30,35,0.95)',
          borderRadius: 3,
          p: compactMode ? 1.5 : 2,
          border: `1px solid ${isCritical ? '#f44336' : isActive ? '#e91e63' : 'rgba(255,255,255,0.08)'}`,
          position: 'relative',
          overflow: 'hidden',
          transition: 'all 0.2s ease',
          minHeight: compactMode ? 80 : 120,
          touchAction: 'pan-y',
          userSelect: 'none',
          cursor: 'pointer',
          '&:hover': {
            borderColor: 'rgba(255,255,255,0.2)',
            bgcolor: 'rgba(40,40,45,0.95)',
          },
        }}
      >
        {status === 'completed' && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 3,
              bgcolor: '#4caf50',
            }}
          />
        )}

        {isCritical && (shot.status || 'not_started') !== 'completed' && (
          <Box
            component={motion.div}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
            }}
          >
            <Star sx={{ color: '#f44336', fontSize: 20 }} />
          </Box>
        )}

        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
          <Box
            onClick={(e: MouseEvent) => { e.stopPropagation(); cycleStatus(); }}
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              bgcolor: statusInfo.bgColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              border: `2px solid ${statusInfo.color}`,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              '&:hover': {
                transform: 'scale(1.05)',
              },
              '&:active': {
                transform: 'scale(0.95)',
              },
            }}
          >
            {status === 'completed' ? (
              <Check sx={{ color: statusInfo.color, fontSize: 28 }} />
            ) : (
              <Typography 
                variant="h6" 
                sx={{ 
                  color: statusInfo.color, 
                  fontWeight: 700,
                  fontSize: 18,
                }}
              >
                {index + 1}
              </Typography>
            )}
          </Box>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5, flexWrap: 'wrap' }}>
              <Chip
                icon={mediaInfo.icon as ReactElement}
                label={mediaInfo.label}
                size="small"
                sx={{
                  bgcolor: alpha(mediaInfo.color, 0.15),
                  color: mediaInfo.color,
                  height: 22,
                  fontSize: 11,
                  fontWeight: 600,
                  '& .MuiChip-icon': { color: mediaInfo.color },
                }}
              />
              <Chip
                label={shot.shotType}
                size="small"
                sx={{
                  bgcolor: 'rgba(255,255,255,0.08)',
                  color: '#fff',
                  height: 22,
                  fontSize: 11,
                }}
              />
              {shot.duration && (
                <Chip
                  icon={<Timer sx={{ fontSize: 12 }} />}
                  label={`${shot.duration}s`}
                  size="small"
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.05)',
                    color: 'rgba(255,255,255,0.87)',
                    height: 22,
                    fontSize: 11,
                    '& .MuiChip-icon': { color: 'rgba(255,255,255,0.87)' },
                  }}
                />
              )}
            </Box>

            <Typography
              variant="body2"
              sx={{
                color: '#fff',
                fontWeight: 500,
                fontSize: compactMode ? 13 : 14,
                mb: 0.5,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                textDecoration: status === 'completed' ? 'line-through' : 'none',
                opacity: status === 'completed' ? 0.6 : 1,
              }}
            >
              {shot.description || `${shot.shotType} - ${shot.cameraAngle}`}
            </Typography>

            {!compactMode && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                <Typography
                  variant="caption"
                  sx={{
                    color: 'rgba(255,255,255,0.87)',
                    fontSize: 11,
                  }}
                >
                  {shot.cameraAngle} • {shot.cameraMovement}
                </Typography>
                {shot.focalLength && (
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'rgba(255,255,255,0.87)',
                      fontSize: 11,
                    }}
                  >
                    {shot.focalLength}mm
                  </Typography>
                )}
              </Box>
            )}

            {showRecommendations && hasRecommendations && !compactMode && (
              <Box 
                sx={{ 
                  mt: 1.5, 
                  pt: 1.5, 
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                  display: 'flex',
                  gap: 1.5,
                  flexWrap: 'wrap',
                }}
              >
                {shot.lensRecommendation && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <CameraAlt sx={{ fontSize: 14, color: '#64b5f6' }} />
                    <Typography variant="caption" sx={{ color: '#64b5f6', fontSize: 11 }}>
                      {shot.lensRecommendation}
                    </Typography>
                  </Box>
                )}
                {shot.lightingSetup && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Lightbulb sx={{ fontSize: 14, color: '#c084fc' }} />
                    <Typography variant="caption" sx={{ color: '#c084fc', fontSize: 11 }}>
                      {shot.lightingSetup}
                    </Typography>
                  </Box>
                )}
                {shot.backgroundRecommendation && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Wallpaper sx={{ fontSize: 14, color: '#81c784' }} />
                    <Typography variant="caption" sx={{ color: '#81c784', fontSize: 11 }}>
                      {shot.backgroundRecommendation}
                    </Typography>
                  </Box>
                )}
              </Box>
            )}
          </Box>

          {onNotesClick && (
            <Tooltip title="Feltnotater">
              <IconButton
                onClick={(e: MouseEvent) => { e.stopPropagation(); onNotesClick(shot); }}
                size="small"
                sx={{
                  color: shot.fieldNotes ? '#e91e63' : 'rgba(255,255,255,0.4)',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' },
                }}
              >
                <Notes sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        {shot.takesCount !== undefined && shot.takesCount > 0 && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 8,
              right: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              bgcolor: 'rgba(0,0,0,0.4)',
              borderRadius: 1,
              px: 1,
              py: 0.25,
            }}
          >
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: 10 }}>
              Take {shot.takesCount}
            </Typography>
          </Box>
        )}

        {status === 'in_progress' && (
          <LinearProgress
            variant="indeterminate"
            sx={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 2,
              bgcolor: 'rgba(147,51,234,0.2)',
              '& .MuiLinearProgress-bar': {
                bgcolor: '#9333ea',
              },
            }}
          />
        )}
      </Box>
    </motion.div>
  );
};

export default InteractiveShotCard;
