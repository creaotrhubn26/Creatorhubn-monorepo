/**
 * FrameAnnotationOverlay - Interactive annotation layer for storyboard frames
 * 
 * Features:
 * - Click to place annotations at specific positions
 * - Rich animations (entry, hover, state changes)
 * - Hover previews with details
 * - Draggable annotations
 * - Glow effects for lights
 * - Light rays animation
 * - Focus area breathing
 * - Arrow flow animation
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { logger } from '../../core/services/logger';

const log = logger.module('FrameAnnotation, ');
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Tooltip,
  Popper,
  Fade,
  Stack,
  Chip,
  ClickAwayListener,
} from '@mui/material';
import {
  TrendingFlat,
  Person,
  Videocam,
  Lightbulb,
  CropFree,
  Close,
  Delete,
  DragIndicator,
  Edit,
  CheckCircle,
} from '@mui/icons-material';
import { styled, keyframes } from '@mui/material/styles';
import {
  scaleInSpring,
  scaleOutFade,
  hoverLift,
  ripple,
  approvalPulse,
  revisionShake,
  lightRays,
  focusBreathe,
  glowPulse,
  arrowFlow,
  subtleBounce,
  tooltipAppear,
  animationDurations,
  animationEasings,
} from '../animations/storyboardAnimations';

// =============================================================================
// Types
// =============================================================================

export type AnnotationType = 
  | 'arrow'
  | 'actor'
  | 'camera'
  | 'light'
  | 'focus';

export interface FrameAnnotation {
  id: string;
  type: AnnotationType;
  x: number; // Percentage 0-100
  y: number; // Percentage 0-100
  rotation?: number; // Degrees for arrows
  label?: string;
  notes?: string;
  color?: string;
  createdAt: string;
  isNew?: boolean; // For entry animation
  isDeleting?: boolean; // For exit animation
  isSelected?: boolean; // For selection state
}

interface FrameAnnotationOverlayProps {
  frameId: string;
  imageUrl: string;
  annotations: FrameAnnotation[];
  onAddAnnotation: (annotation: Omit<FrameAnnotation, 'id' | , 'createdAt, '>) => void;
  onUpdateAnnotation: (id: string, updates: Partial<FrameAnnotation>) => void;
  onDeleteAnnotation: (id: string) => void;
  placementMode: AnnotationType | null;
  onPlacementComplete: () => void;
  readOnly?: boolean;
}

// =============================================================================
// Additional Animations
// =============================================================================

const pulseAnimation = keyframes`
  0% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
  }
  50% {
    transform: translate(-50%, -50%) scale(1.15);
    opacity: 0.8;
  }
  100% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
  }
`;

const placementPulse = keyframes`
  0%, 100% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 0.6;
  }
  50% {
    transform: translate(-50%, -50%) scale(1.1);
    opacity: 0.9;
  }
`;

const selectionDash = keyframes`
  0% {
    stroke-dashoffset: 0;
  }
  100% {
    stroke-dashoffset: 20;
  }
`;

// =============================================================================
// Styled Components
// =============================================================================

const AnnotationContainer = styled(Box)({
  position: 'relative',
  width: '100%',
  height: '100%',
  overflow: 'hidden',
});

const RippleEffect = styled(Box)({
  position: 'absolute',
  borderRadius: '50%',
  backgroundColor: 'rgba(255, 255, 255, 0.3)',
  pointerEvents: 'none',
  animation: `${ripple} 0.6s ease-out forwards`,
});

const AnnotationMarker = styled(Box, {
  shouldForwardProp: (prop) => !['isNew','isDeleting','isSelected','annotationType'].includes(prop as string),
})<{ isNew?: boolean; isDeleting?: boolean; isSelected?: boolean; annotationType: AnnotationType }>(
  ({ isNew, isDeleting, isSelected, annotationType }) => ({
    position: 'absolute',
    transform: 'translate(-50%, -50%)',
    cursor: 'pointer',
    transition: `all ${animationDurations.fast} ${animationEasings.easeOut}`,
    
    // Entry animation
    ...(isNew && {
      animation: `${scaleInSpring} 0.5s ${animationEasings.spring} forwards`,
    }),
    
    // Exit animation
    ...(isDeleting && {
      animation: `${scaleOutFade} 0.3s ${animationEasings.easeIn} forwards`,
    }),
    
    // Selection state
    ...(isSelected && {
      filter: 'drop-shadow(0 0 8px rgba(33, 150, 243, 0.8))',
    }),
    
    // Hover effect
    , '&:hover': {
      transform: 'translate(-50%, -50%) translateY(-4px) scale(1.1)',
      filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.3))',
      zIndex: 1,
    },
    
    // Type-specific animations
    ...(annotationType === 'light' && !isNew && !isDeleting && {
      '& .light-glow': {
        animation: `${glowPulse} 2s ease-in-out infinite`,
      },
    }),
    
    ...(annotationType === 'focus' && !isNew && !isDeleting && {
      animation: `${focusBreathe} 3s ease-in-out infinite`,
    }),
  })
);

const LightRaysEffect = styled(Box)({
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '200%',
  height: '200%',
  pointerEvents: 'none','& .ray': {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: '100%',
    height: 2,
    background: 'linear-gradient(90deg, rgba(255,193,7,0.4) 0%, transparent 100%)',
    transformOrigin: 'left center',
    animation: `${lightRays} 2s ease-out infinite`,
  },
});

const ArrowFlowLine = styled('svg,')({
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  pointerEvents: 'none','& .flow-path': {
    strokeDasharray: '10 5',
    animation: `${arrowFlow} 1s linear infinite`,
  },
});

const PlacementCursor = styled(Box)({
  position: 'absolute',
  transform: 'translate(-50%, -50%)',
  pointerEvents: 'none',
  animation: `${placementPulse} 1s ease-in-out infinite`,
});

const SelectionRing = styled('svg')({
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  pointerEvents: 'none','& circle': {
    fill: 'none',
    stroke: '#2196F3',
    strokeWidth: 2,
    strokeDasharray: '5 5',
    animation: `${selectionDash} 1s linear infinite`,
  },
});

// =============================================================================
// Annotation Icon Components
// =============================================================================

interface AnnotationIconProps {
  type: AnnotationType;
  rotation?: number;
  label?: string;
  color?: string;
  size?: number;
  showEffects?: boolean;
  isSelected?: boolean;
}

const AnnotationIcon: React.FC<AnnotationIconProps> = ({
  type,
  rotation = 0,
  label,
  color,
  size = 32,
  showEffects = true,
  isSelected = false,
}) => {
  const getIcon = () => {
    switch (type) {
      case 'arrow':
        return (
          <Box
            sx={{
              width: size * 2.5,
              height: size,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transform: `rotate(${rotation}deg)`,
              position: 'relative'}}
          >
            {/* Arrow flow effect */}
            {showEffects && (
              <Box
                sx={{
                  position: 'absolute',
                  width: '100%',
                  height: 4,
                  background: `linear-gradient(90deg, transparent 0%, ${color || '#FF9800'}40 20%, ${color || '#FF9800'} 50%, ${color || '#FF9800'}40 80%, transparent 100%)`,
                  animation: `${arrowFlow} 1s linear infinite`,
                  borderRadius: 2}}
              />
            )}
            <TrendingFlat sx={{ fontSize: size * 1.5, color: color || '#FF9800', position: 'relative', zIndex: 1}} />
          </Box>
        );
      
      case 'actor':
        return (
          <Box
            sx={{
              width: size,
              height: size,
              borderRadius: '50%',
              bgcolor: color || '#4CAF50',
              border: '3px solid white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              transition: 'all 0.2s ease', '&:hover': {
                boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
              }}}
          >
            {label ? (
              <Typography
                variant="caption"
                sx={{ color: 'white', fontWeight: 70, fontSize: size * 0.5 }}
              >
                {label}
              </Typography>
            ) : (
              <Person sx={{ fontSize: size * 0.6, color: 'white' }} />
            )}
          </Box>
        );
      
      case 'camera':
        return (
          <Box
            sx={{
              position: 'relative',
              width: size * 1.5,
              height: size,
              transform: `rotate(${rotation}deg)`}}
          >
            {/* Camera body */}
            <Box
              sx={{
                width: '100%',
                height: '100%',
                bgcolor: color || '#2196F3',
                borderRadius: 1,
                border: '2px solid white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)'}}
            >
              <Videocam sx={{ fontSize: size * 0.7, color: 'white' }} />
            </Box>
            {/* Camera direction indicator */}
            {showEffects && (
              <Box
                sx={{
                  position: 'absolute',
                  right: -size * 0.8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: size * 0.6,
                  height: 2,
                  background: `linear-gradient(90deg, ${color || '#2196F3'}, transparent)`, '&::after': {
                    content: ',""',
                    position: 'absolute',
                    right: 0,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 0,
                    height: 0,
                    borderTop: '4px solid transparent',
                    borderBottom: '4px solid transparent',
                    borderLeft: `6px solid ${color || '#2196F3'}`,
                  }}}
              />
            )}
          </Box>
        );
      
      case 'light':
        return (
          <Box sx={{ position: 'relative' }}>
            {/* Light rays effect */}
            {showEffects && (
              <LightRaysEffect>
                {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
                  <Box
                    key={angle}
                    className="ray"
                    sx={{
                      transform: `rotate(${angle}deg)`,
                      animationDelay: `${i * 0.1}s`,
                      opacity: 0.4}}
                  />
                ))}
              </LightRaysEffect>
            )}
            {/* Light bulb */}
            <Box
              className="light-glow"
              sx={{
                width: size,
                height: size,
                borderRadius: '50%',
                bgcolor: color || '#FFC107',
                border: '3px solid white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                zIndex: 1,
                color: color || '#FFC107'}}
            >
              {label ? (
                <Typography
                  variant="caption"
                  sx={{ color: '#1a1a2e', fontWeight: 70, fontSize: size * 0.45 }}
                >
                  {label}
                </Typography>
              ) : (
                <Lightbulb sx={{ fontSize: size * 0.6, color: '#1a1a2e' }} />
              )}
            </Box>
          </Box>
        );
      
      case 'focus':
        return (
          <Box
            sx={{
              width: size * 2,
              height: size * 2,
              position: 'relative'}}
          >
            {/* Animated corner brackets */}
            <svg
              width="100%"
              height="100%"
              viewBox="0 0 100 100"
              style={{ position: 'absolute', top: 0, left: 0 }}
            >
              {/* Top-left */}
              <path
                d="M 5 25 L 5 5 L 25 5"
                fill="none"
                stroke={color || '#E91E63'}
                strokeWidth="3"
                strokeLinecap="round"
              />
              {/* Top-right */}
              <path
                d="M 75 5 L 95 5 L 95 25"
                fill="none"
                stroke={color || '#E91E63'}
                strokeWidth="3"
                strokeLinecap="round"
              />
              {/* Bottom-right */}
              <path
                d="M 95 75 L 95 95 L 75 95"
                fill="none"
                stroke={color || '#E91E63'}
                strokeWidth="3"
                strokeLinecap="round"
              />
              {/* Bottom-left */}
              <path
                d="M 25 95 L 5 95 L 5 75"
                fill="none"
                stroke={color || '#E91E63'}
                strokeWidth="3"
                strokeLinecap="round"
              />
              {/* Center crosshair */}
              <line x1="40" y1="50" x2="60" y2="50" stroke={color || '#E91E63'} strokeWidth="2" strokeDasharray="4 2" />
              <line x1="50" y1="40" x2="50" y2="60" stroke={color || '#E91E63'} strokeWidth="2" strokeDasharray="4 2" />
            </svg>
            {/* Center icon */}
            <CropFree
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                fontSize: size * 0.8,
                color: color || '#E91E63',
                opacity: 0.3}}
            />
          </Box>
        );
      
      default:
        return null;
    }
  };

  return (
    <Box sx={{ position: 'relative' }}>
      {getIcon()}
      {/* Selection ring */}
      {isSelected && (
        <SelectionRing width={size * 2.5} height={size * 2.5}>
          <circle cx="50%" cy="50%" r={size * 1.1} />
        </SelectionRing>
      )}
    </Box>
  );
};

// =============================================================================
// Hover Preview Component
// =============================================================================

interface AnnotationPreviewProps {
  annotation: FrameAnnotation;
  anchorEl: HTMLElement | null;
  onClose: () => void;
  onDelete: () => void;
  onEdit: () => void;
}

const PreviewPaper = styled(Paper)({
  animation: `${tooltipAppear} 0.2s ${animationEasings.easeOut} forwards`,
});

const AnnotationPreview: React.FC<AnnotationPreviewProps> = ({
  annotation,
  anchorEl,
  onClose,
  onDelete,
  onEdit,
}) => {
  const getTypeLabel = (type: AnnotationType) => {
    switch (type) {
      case 'arrow': return 'Motion Arrow';
      case 'actor': return 'Actor Position';
      case 'camera': return 'Camera';
      case 'light': return 'Light Source';
      case 'focus': return 'Focus Area';
      default: return 'Annotation';
    }
  };

  const getTypeIcon = (type: AnnotationType) => {
    switch (type) {
      case 'arrow': return <TrendingFlat fontSize="small" />;
      case 'actor': return <Person fontSize="small" />;
      case 'camera': return <Videocam fontSize="small" />;
      case 'light': return <Lightbulb fontSize="small" />;
      case 'focus': return <CropFree fontSize="small" />;
      default: return null;
    }
  };

  const getTypeColor = (type: AnnotationType) => {
    switch (type) {
      case 'arrow': return '#FF9800';
      case 'actor': return '#4CAF50';
      case 'camera': return '#2196F3';
      case 'light': return '#FFC107';
      case 'focus': return '#E91E63';
      default: return '#9E9E9E';
    }
  };

  return (
    <Popper
      open={Boolean(anchorEl)}
      anchorEl={anchorEl}
      placement="top"
      transition
      sx={{ zIndex: 1300}}
      modifiers={[
        {
          name: 'offset',
          options: { offset: [0, 10] },
        },
      ]}
    >
      {({ TransitionProps }) => (
        <Fade {...TransitionProps} timeout={150}>
          <PreviewPaper
            elevation={8}
            sx={{
              p: 1.5,
              bgcolor: '#1a1a2e',
              border: 1,
              borderColor: getTypeColor(annotation.type),
              borderLeftWidth: 3,
              maxWidth: 240,
              backdropFilter: 'blur(8px)'}}
          >
            <Stack spacing={1.5}>
              {/* Header */}
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Box sx={{ color: getTypeColor(annotation.type) }}>
                    {getTypeIcon(annotation.type)}
                  </Box>
                  <Typography variant="subtitle2" fontWeight={600}>
                    {getTypeLabel(annotation.type)}
                  </Typography>
                </Stack>
                <IconButton size="small" onClick={onClose} sx={{ opacity: 0.7 }}>
                  <Close sx={{ fontSize: 16 }} />
                </IconButton>
              </Stack>
              
              {/* Label chip */}
              {annotation.label && (
                <Chip
                  label={annotation.label}
                  size="small"
                  sx={{ 
                    alignSelf: 'flex-start',
                    bgcolor: getTypeColor(annotation.type) + '30',
                    color: getTypeColor(annotation.type),
                    fontWeight: 600}}
                />
              )}
              
              {/* Notes */}
              {annotation.notes && (
                <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.4 }}>
                  {annotation.notes}
                </Typography>
              )}
              
              {/* Position info */}
              <Typography variant="caption" color="text.disabled" sx={{ fontFamily: 'monospace' }}>
                X: {Math.round(annotation.x)}% | Y: {Math.round(annotation.y)}%
                {annotation.rotation !== undefined && ` | Rot: ${annotation.rotation}deg`}
              </Typography>
              
              {/* Actions */}
              <Stack direction="row" spacing={0.5} sx={{ pt: 0.5 }}>
                <Tooltip title="Edit">
                  <IconButton 
                    size="small" 
                    onClick={onEdit}
                    sx={{ 
                      bgcolor: 'rgba(255,255,255,0.05)', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' }}}
                  >
                    <Edit sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete">
                  <IconButton 
                    size="small" 
                    onClick={onDelete} 
                    sx={{ 
                      bgcolor: 'rgba(244,67,54,0.1)',
                      color: 'error.main', '&:hover': { bgcolor: 'rgba(244,67,54,0.2)' }}}
                  >
                    <Delete sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Stack>
          </PreviewPaper>
        </Fade>
      )}
    </Popper>
  );
};

// =============================================================================
// Main Component
// =============================================================================

export const FrameAnnotationOverlay: React.FC<FrameAnnotationOverlayProps> = ({
  frameId,
  imageUrl,
  annotations,
  onAddAnnotation,
  onUpdateAnnotation,
  onDeleteAnnotation,
  placementMode,
  onPlacementComplete,
  readOnly = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null);
  const [hoveredAnnotation, setHoveredAnnotation] = useState<string | null>(null);
  const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(null);
  const [previewAnchor, setPreviewAnchor] = useState<HTMLElement | null>(null);
  const [actorCounter, setActorCounter] = useState(1);
  const [lightCounter, setLightCounter] = useState(1);
  const [ripples, setRipples] = useState<Array<{ id: string; x: number; y: number }>>([]);

  // Add ripple effect
  const addRipple = useCallback((x: number, y: number) => {
    const id = crypto.randomUUID();
    setRipples(prev => [...prev, { id, x, y }]);
    setTimeout(() => {
      setRipples(prev => prev.filter(r => r.id !== id));
    }, 600);
  }, []);

  // Track cursor position when in placement mode
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!placementMode || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setCursorPosition({ x, y });
  }, [placementMode]);

  // Handle click to place annotation
  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    // Add ripple effect
    addRipple(x, y);
    
    // Deselect if clicking on empty area
    if (!placementMode) {
      setSelectedAnnotation(null);
      return;
    }
    
    if (readOnly) return;

    let label: string | undefined;
    
    if (placementMode === 'actor') {
      label = String.fromCharCode(64 + actorCounter); // A, B, C...
      setActorCounter(prev => prev + 1);
    } else if (placementMode === 'light') {
      label = String(lightCounter);
      setLightCounter(prev => prev + 1);
    }

    onAddAnnotation({
      type: placementMode,
      x,
      y,
      label,
      isNew: true,
    });

    onPlacementComplete();
    setCursorPosition(null);
  }, [placementMode, actorCounter, lightCounter, onAddAnnotation, onPlacementComplete, readOnly, addRipple]);

  // Handle annotation hover
  const handleAnnotationHover = useCallback((
    annotationId: string,
    event: React.MouseEvent<HTMLDivElement>
  ) => {
    setHoveredAnnotation(annotationId);
    setPreviewAnchor(event.currentTarget);
  }, []);

  const handleAnnotationLeave = useCallback(() => {
    // Delay to allow moving to preview
    setTimeout(() => {
      setHoveredAnnotation(null);
      setPreviewAnchor(null);
    }, 100);
  }, []);

  // Clear isNew flag after animation
  useEffect(() => {
    const newAnnotations = annotations.filter(a => a.isNew);
    if (newAnnotations.length > 0) {
      const timer = setTimeout(() => {
        newAnnotations.forEach(a => {
          onUpdateAnnotation(a.id, { isNew: false });
        });
      }, 1800); // 3 pulses * 600ms
      return () => clearTimeout(timer);
    }
  }, [annotations, onUpdateAnnotation]);

  // Reset counters when frame changes
  useEffect(() => {
    const actorCount = annotations.filter(a => a.type === 'actor').length;
    const lightCount = annotations.filter(a => a.type === 'light').length;
    setActorCounter(actorCount + 1);
    setLightCounter(lightCount + 1);
  }, [frameId]);

  const hoveredAnnotationData = annotations.find(a => a.id === hoveredAnnotation);

  // Handle annotation click for selection
  const handleAnnotationClick = useCallback((e: React.MouseEvent, annotationId: string) => {
    e.stopPropagation();
    setSelectedAnnotation(prev => prev === annotationId ? null : annotationId);
  }, []);

  return (
    <AnnotationContainer
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onClick={handleClick}
      onMouseLeave={() => setCursorPosition(null)}
      sx={{
        cursor: placementMode ? 'crosshair' : 'default'}}
    >
      {/* Frame Image */}
      <Box
        component="img"
        src={imageUrl}
        alt="Storyboard frame"
        sx={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          display: 'block'}}
      />

      {/* Click Ripple Effects */}
      {ripples.map((ripple) => (
        <RippleEffect
          key={ripple.id}
          sx={{
            left: `${ripple.x}%`,
            top: `${ripple.y}%`,
            width: 20,
            height: 20,
            transform: 'translate(-50%, -50%)'}}
        />
      ))}

      {/* Annotations */}
      {annotations.map((annotation) => (
        <AnnotationMarker
          key={annotation.id}
          isNew={annotation.isNew}
          isDeleting={annotation.isDeleting}
          isSelected={selectedAnnotation === annotation.id}
          annotationType={annotation.type}
          sx={{
            left: `${annotation.x}%`,
            top: `${annotation.y}%`}}
          onClick={(e) => handleAnnotationClick(e, annotation.id)}
          onMouseEnter={(e) => handleAnnotationHover(annotation.id, e)}
          onMouseLeave={handleAnnotationLeave}
        >
          <AnnotationIcon
            type={annotation.type}
            rotation={annotation.rotation}
            label={annotation.label}
            color={annotation.color}
            isSelected={selectedAnnotation === annotation.id}
          />
        </AnnotationMarker>
      ))}

      {/* Placement Cursor */}
      {placementMode && cursorPosition && (
        <PlacementCursor
          sx={{
            left: `${cursorPosition.x}%`,
            top: `${cursorPosition.y}%`}}
        >
          <AnnotationIcon
            type={placementMode}
            label={
              placementMode === 'actor'
                ? String.fromCharCode(64 + actorCounter)
                : placementMode === 'light'
                ? String(lightCounter)
                : undefined
            }
            size={28}
            showEffects={false}
          />
        </PlacementCursor>
      )}

      {/* Hover Preview */}
      {hoveredAnnotationData && !readOnly && (
        <ClickAwayListener onClickAway={() => setHoveredAnnotation(null)}>
          <div>
            <AnnotationPreview
              annotation={hoveredAnnotationData}
              anchorEl={previewAnchor}
              onClose={() => setHoveredAnnotation(null)}
              onDelete={() => {
                onDeleteAnnotation(hoveredAnnotationData.id);
                setHoveredAnnotation(null);
              }}
              onEdit={() => {
                // Would open edit dialog
                log.debug('Edit annotation: ', hoveredAnnotationData.id);
              }}
            />
          </div>
        </ClickAwayListener>
      )}

      {/* Placement Mode Indicator */}
      {placementMode && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 8,
            left: '50%',
            transform: 'translateX(-50%)',
            bgcolor: 'rgba(0,0,0,0.8)',
            color: 'white',
            px: 2,
            py: 0.5,
            borderRadius: 2,
            display: 'flex',
            alignItems:'center',
            gap: 1}}
        >
          <AnnotationIcon type={placementMode} size={20} />
          <Typography variant="caption">
            Click to place {placementMode}
          </Typography>
        </Box>
      )}
    </AnnotationContainer>
  );
};

export default FrameAnnotationOverlay;

