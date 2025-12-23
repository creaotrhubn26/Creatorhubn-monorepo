/**
 * AnimatedFrameCard - Storyboard frame card with rich animations
 * 
 * Features:
 * - Slide in/out animations
 * - 3D flip transitions
 * - Hover lift effect
 * - Status change animations (approval burst, revision shake)
 * - Drag feedback with tilt
 * - Selection ring
 * - Duration stretch animation
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Box,
  Card,
  CardMedia,
  CardContent,
  Typography,
  IconButton,
  Tooltip,
  Chip,
  Stack,
  Badge,
} from '@mui/material';
import {
  PlayArrow,
  Edit,
  Delete,
  ContentCopy,
  DragIndicator,
  CheckCircle,
  Pending,
  WarningAmber,
  Comment,
  Timer,
  Videocam,
  Lock,
} from '@mui/icons-material';
import { styled, keyframes } from '@mui/material/styles';
import {
  slideInRight,
  slideOutLeft,
  popIn,
  cardFlip,
  revisionShake,
  approvalPulse,
  lockWiggle,
  durationStretch,
  staggerFadeIn,
  fadeInUp,
  subtleBounce,
  animationDurations,
  animationEasings,
  getStaggerDelay,
} from '../animations/storyboardAnimations';

// =============================================================================
// Types
// =============================================================================

export type FrameStatus = 'draft' | 'pending' | 'approved' | 'revision';

export interface AnimatedFrameCardProps {
  id: string;
  index: number;
  imageUrl: string;
  title: string;
  duration: number; // Seconds
  status: FrameStatus;
  cameraAngle?: string;
  notes?: string;
  commentCount?: number;
  isNew?: boolean;
  isDeleting?: boolean;
  isSelected?: boolean;
  isDragging?: boolean;
  isLocked?: boolean;
  onSelect?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onPlay?: () => void;
  onStatusChange?: (status: FrameStatus) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

// =============================================================================
// Additional Animations
// =============================================================================

const approvalBurstKeyframes = keyframes`
  0% {
    transform: scale(0);
    opacity: 1;
  }
  100% {
    transform: scale(3);
    opacity: 0;
  }
`;

const selectionGlow = keyframes`
  0%, 100% {
    box-shadow: 0 0 0 3px rgba(33, 150, 243, 0.5);
  }
  50% {
    box-shadow: 0 0 0 5px rgba(33, 150, 243, 0.8);
  }
`;

const dragTilt = keyframes`
  0% {
    transform: scale(1.05) rotate(0deg);
  }
  50% {
    transform: scale(1.05) rotate(2deg);
  }
  100% {
    transform: scale(1.05) rotate(-2deg);
  }
`;

// =============================================================================
// Styled Components
// =============================================================================

interface StyledCardProps {
  $isNew?: boolean;
  $isDeleting?: boolean;
  $isSelected?: boolean;
  $isDragging?: boolean;
  $hasRevision?: boolean;
  $hasApproval?: boolean;
  $index?: number;
}

const StyledCard = styled(Card, {
  shouldForwardProp: (prop) => !prop.toString().startsWith('$, '),
})<StyledCardProps>(({ 
  $isNew, 
  $isDeleting, 
  $isSelected, 
  $isDragging,
  $hasRevision,
  $hasApproval,
  $index = 0,
}) => ({
  position: 'relative',
  cursor: 'pointer',
  transition: `all ${animationDurations.fast} ${animationEasings.easeOut}`,
  backgroundColor: '#1a1a2e',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  overflow: 'hidden',
  
  // Entry animation with stagger
  ...($isNew && {
    animation: `${slideInRight} 0.4s ${animationEasings.spring} forwards`,
    animationDelay: getStaggerDelay($index, 0.05),
  }),
  
  // Exit animation
  ...($isDeleting && {
    animation: `${slideOutLeft} 0.3s ${animationEasings.easeIn} forwards`,
  }),
  
  // Selection state
  ...($isSelected && {
    animation: `${selectionGlow} 1.5s ease-in-out infinite`,
    borderColor: '#2196F3',
  }),
  
  // Dragging state
  ...($isDragging && {
    animation: `${dragTilt} 0.3s ease-in-out infinite alternate`,
    opacity: 0.9,
    boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
    zIndex: 100,
  }),
  
  // Revision shake
  ...($hasRevision && {
    animation: `${revisionShake} 0.5s ease-in-out`,
  }),
  
  // Approval pulse
  ...($hasApproval && {
    animation: `${approvalPulse} 0.6s ease-out`,
  }),
  
  // Hover effect
  , '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: '0 12px 24px rgba(0,0,0,0.3)',
    borderColor: 'rgba(255,255,255,0.2)',
  },
}));

const FrameNumber = styled(Box)({
  position: 'absolute',
  top: 8,
  left: 8,
  width: 28,
  height: 28,
  borderRadius: '50%',
  backgroundColor: 'rgba(0,0,0,0.7)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 70,
  fontSize: 12,
  color: '#fff',
  backdropFilter: 'blur(4px)',
});

const StatusBadge = styled(Chip, {
  shouldForwardProp: (prop) => prop !== 'status',
})<{ status: FrameStatus }>(({ status }) => {
  const colors = {
    draft: { bg: 'rgba(158,158,158,0.2)', color: '#9E9E9E' },
    pending: { bg: 'rgba(255,193,7,0.2)', color: '#FFC107' },
    approved: { bg: 'rgba(76,175,80,0.2)', color: '#4CAF50' },
    revision: { bg: 'rgba(244,67,54,0.2)', color: '#F44336' },
  };
  
  return {
    backgroundColor: colors[status].bg,
    color: colors[status].color,
    fontWeight: 600,
    fontSize: 10,
    height: 22,
  };
});

const ApprovalBurst = styled(Box)({
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 40,
  height: 40,
  borderRadius: '50%',
  backgroundColor: 'rgba(76, 175, 80, 0.5)',
  pointerEvents: 'none',
  animation: `${approvalBurstKeyframes} 0.6s ease-out forwards`,
});

const DurationBadge = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'isStretching',
})<{ isStretching?: boolean }>(({ isStretching }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: '2px 8px',
  borderRadius: 4,
  backgroundColor: 'rgba(0,0,0,0.5)',
  fontSize: 11,
  fontFamily: 'monospace',
  ...(isStretching && {
    animation: `${durationStretch} 0.3s ease-out`,
  }),
}));

const ActionOverlay = styled(Box)({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(0,0,0,0.5)',
  opacity: 0,
  transition: 'opacity 0.2s ease','&:hover': {
    opacity: 1,
  },
});

const LockOverlay = styled(Box)({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(0,0,0,0.6)',
  backdropFilter: 'blur(2px)','& .lock-icon': {
    animation: `${lockWiggle} 0.5s ease-in-out`,
  },
});

// =============================================================================
// Component
// =============================================================================

export const AnimatedFrameCard: React.FC<AnimatedFrameCardProps> = ({
  id,
  index,
  imageUrl,
  title,
  duration,
  status,
  cameraAngle,
  notes,
  commentCount = 0,
  isNew = false,
  isDeleting = false,
  isSelected = false,
  isDragging = false,
  isLocked = false,
  onSelect,
  onEdit,
  onDelete,
  onDuplicate,
  onPlay,
  onStatusChange,
  onDragStart,
  onDragEnd,
}) => {
  const [showApprovalBurst, setShowApprovalBurst] = useState(false);
  const [hasRevision, setHasRevision] = useState(false);
  const [hasApproval, setHasApproval] = useState(false);
  const [isStretching, setIsStretching] = useState(false);
  const [showLockWiggle, setShowLockWiggle] = useState(false);
  const prevStatus = useRef(status);

  // Handle status change animations
  useEffect(() => {
    if (prevStatus.current !== status) {
      if (status === 'approved') {
        setShowApprovalBurst(true);
        setHasApproval(true);
        setTimeout(() => {
          setShowApprovalBurst(false);
          setHasApproval(false);
        }, 600);
      } else if (status === 'revision') {
        setHasRevision(true);
        setTimeout(() => setHasRevision(false), 500);
      }
      prevStatus.current = status;
    }
  }, [status]);

  // Handle locked click
  const handleLockedClick = useCallback(() => {
    if (isLocked) {
      setShowLockWiggle(true);
      setTimeout(() => setShowLockWiggle(false), 500);
    }
  }, [isLocked]);

  // Format duration
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get status icon
  const getStatusIcon = () => {
    switch (status) {
      case 'approved':
        return <CheckCircle sx={{ fontSize: 14, color: '#4CAF50' }} />;
      case 'pending':
        return <Pending sx={{ fontSize: 14, color: '#FFC107' }} />;
      case 'revision':
        return <WarningAmber sx={{ fontSize: 14, color: '#F44336' }} />;
      default:
        return null;
    }
  };

  return (
    <StyledCard
      $isNew={isNew}
      $isDeleting={isDeleting}
      $isSelected={isSelected}
      $isDragging={isDragging}
      $hasRevision={hasRevision}
      $hasApproval={hasApproval}
      $index={index}
      onClick={isLocked ? handleLockedClick : onSelect}
      draggable={!isLocked}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      {/* Frame Image */}
      <Box sx={{ position: 'relative', paddingTop: '56.25%' }}>
        <CardMedia
          component="img"
          image={imageUrl}
          alt={title}
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover'}}
        />
        
        {/* Frame Number */}
        <FrameNumber>{index + 1}</FrameNumber>
        
        {/* Duration Badge */}
        <Box sx={{ position: 'absolute', bottom: 8, right: 8 }}>
          <DurationBadge isStretching={isStretching}>
            <Timer sx={{ fontSize: 12 }} />
            {formatDuration(duration)}
          </DurationBadge>
        </Box>
        
        {/* Camera Angle */}
        {cameraAngle && (
          <Box
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              bgcolor: 'rgba(0,0,0,0.5)',
              borderRadius: 1,
              px: 1,
              py: 0.25,
              fontSize: 10}}
          >
            <Videocam sx={{ fontSize: 12 }} />
            {cameraAngle}
          </Box>
        )}
        
        {/* Action Overlay */}
        {!isLocked && (
          <ActionOverlay>
            <Stack direction="row" spacing={1}>
              <Tooltip title="Play">
                <IconButton
                  size="small"
                  onClick={(e) => { e.stopPropagation(); onPlay?.(); }}
                  sx={{ bgcolor: 'rgba(255,255,255,0.1)' }}
                >
                  <PlayArrow />
                </IconButton>
              </Tooltip>
              <Tooltip title="Edit">
                <IconButton
                  size="small"
                  onClick={(e) => { e.stopPropagation(); onEdit?.(); }}
                  sx={{ bgcolor: 'rgba(255,255,255,0.1)' }}
                >
                  <Edit />
                </IconButton>
              </Tooltip>
              <Tooltip title="Duplicate">
                <IconButton
                  size="small"
                  onClick={(e) => { e.stopPropagation(); onDuplicate?.(); }}
                  sx={{ bgcolor: 'rgba(255,255,255,0.1)' }}
                >
                  <ContentCopy />
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete">
                <IconButton
                  size="small"
                  onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
                  sx={{ bgcolor: 'rgba(244,67,54,0.2)', color: '#F44336' }}
                >
                  <Delete />
                </IconButton>
              </Tooltip>
            </Stack>
          </ActionOverlay>
        )}
        
        {/* Lock Overlay */}
        {isLocked && (
          <LockOverlay onClick={handleLockedClick}>
            <Lock 
              className={showLockWiggle ? 'lock-icon' : ', '} 
              sx={{ fontSize: 40, color: 'rgba(255,255,255,0.5)' }} 
            />
          </LockOverlay>
        )}
        
        {/* Approval Burst Effect */}
        {showApprovalBurst && <ApprovalBurst />}
      </Box>
      
      {/* Card Content */}
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Stack spacing={1}>
          {/* Title Row */}
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="subtitle2" noWrap sx={{ flex: 1, fontWeight: 600}}>
              {title}
            </Typography>
            {getStatusIcon()}
          </Stack>
          
          {/* Status & Comments Row */}
          <Stack direction="row" alignItems="center" spacing={1}>
            <StatusBadge 
              status={status} 
              label={status.charAt(0).toUpperCase() + status.slice(1)}
              size="small"
            />
            {commentCount > 0 && (
              <Badge badgeContent={commentCount} color="primary" max={99}>
                <Comment sx={{ fontSize: 16, color: 'text.secondary' }} />
              </Badge>
            )}
          </Stack>
          
          {/* Notes Preview */}
          {notes && (
            <Typography 
              variant="caption" 
              color="text.secondary"
              sx={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                lineHeight: 1.3}}
            >
              {notes}
            </Typography>
          )}
        </Stack>
      </CardContent>
      
      {/* Drag Handle */}
      <Box
        sx={{
          position: 'absolute',
          top: '50%',
          left: 4,
          transform: 'translateY(-50%)',
          opacity: 0,
          transition: 'opacity 0.2s','.MuiCard-root: hover &': { opacity: 0.7 }}}
      >
        <DragIndicator sx={{ fontSize: 20, color: 'text.secondary' }} />
      </Box>
    </StyledCard>
  );
};

export default AnimatedFrameCard;

