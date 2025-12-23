/**
 * InteractiveFrameViewer - Frame viewer with interactive annotations
 * 
 * Combines the frame image with the annotation overlay system.
 * Supports context menu integration for adding annotations.
 */

import React, { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  IconButton,
  Stack,
  Divider,
} from '@mui/material';
import {
  TrendingFlat,
  Person,
  Videocam,
  Lightbulb,
  CropFree,
  PanTool,
  Close,
  RotateLeft,
  RotateRight,
} from '@mui/icons-material';
import { 
  FrameAnnotationOverlay, 
  AnnotationType,
  FrameAnnotation,
} from './FrameAnnotationOverlay';
import { useStoryboardStore, StoryboardFrame, FrameAnnotationData } from '../../state/storyboardStore';

// =============================================================================
// Types
// =============================================================================

interface InteractiveFrameViewerProps {
  frame: StoryboardFrame;
  height?: number | string;
  showToolbar?: boolean;
  readOnly?: boolean;
}

// =============================================================================
// Main Component
// =============================================================================

export const InteractiveFrameViewer: React.FC<InteractiveFrameViewerProps> = ({
  frame,
  height = 400,
  showToolbar = true,
  readOnly = false,
}) => {
  const { addAnnotation, updateAnnotation, deleteAnnotation } = useStoryboardStore();
  const [placementMode, setPlacementMode] = useState<AnnotationType | null>(null);
  const [arrowRotation, setArrowRotation] = useState(0);

  // Convert store annotations to overlay format
  const annotations: FrameAnnotation[] = (frame.annotations || []).map((a) => ({
    ...a,
    rotation: a.type === 'arrow' ? arrowRotation : a.rotation,
  }));

  // Handle adding annotation
  const handleAddAnnotation = useCallback((
    annotation: Omit<FrameAnnotation, 'id' | 'createdAt'>
  ) => {
    const annotationData: Omit<FrameAnnotationData, 'id' | 'createdAt'> = {
      type: annotation.type,
      x: annotation.x,
      y: annotation.y,
      rotation: annotation.type === 'arrow' ? arrowRotation : annotation.rotation,
      label: annotation.label,
      notes: annotation.notes,
      color: annotation.color,
      isNew: true,
    };
    addAnnotation(frame.id, annotationData);
  }, [frame.id, addAnnotation, arrowRotation]);

  // Handle updating annotation
  const handleUpdateAnnotation = useCallback((
    id: string,
    updates: Partial<FrameAnnotation>
  ) => {
    updateAnnotation(frame.id, id, updates);
  }, [frame.id, updateAnnotation]);

  // Handle deleting annotation
  const handleDeleteAnnotation = useCallback((id: string) => {
    deleteAnnotation(frame.id, id);
  }, [frame.id, deleteAnnotation]);

  // Handle placement complete
  const handlePlacementComplete = useCallback(() => {
    setPlacementMode(null);
  }, []);

  // Handle tool selection
  const handleToolChange = useCallback((
    _event: React.MouseEvent<HTMLElement>,
    newTool: AnnotationType | null
  ) => {
    setPlacementMode(newTool);
  }, []);

  // Rotate arrow
  const rotateArrow = useCallback((direction: 'left' | 'right') => {
    setArrowRotation(prev => {
      const delta = direction === 'left' ? -45 : 45;
      return (prev + delta + 360) % 360;
    });
  }, []);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Annotation Toolbar */}
      {showToolbar && !readOnly && (
        <Paper
          elevation={0}
          sx={{
            p: 1,
            mb: 1,
            bgcolor: '#1a1a2e',
            display: 'flex',
            alignItems: 'center',
            gap: 2}}
        >
          <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
            Add Annotation:
          </Typography>
          
          <ToggleButtonGroup
            value={placementMode}
            exclusive
            onChange={handleToolChange}
            size="small"
          >
            <ToggleButton value="arrow">
              <Tooltip title="Motion Arrow">
                <TrendingFlat fontSize="small" sx={{ transform: `rotate(${arrowRotation}deg)` }} />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="actor">
              <Tooltip title="Actor Position">
                <Person fontSize="small" />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="camera">
              <Tooltip title="Camera">
                <Videocam fontSize="small" />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="light">
              <Tooltip title="Light Source">
                <Lightbulb fontSize="small" />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="focus">
              <Tooltip title="Focus Area">
                <CropFree fontSize="small" />
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>

          {/* Arrow rotation controls */}
          {placementMode === 'arrow' && (
            <>
              <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <Typography variant="caption" color="text.secondary">
                  Rotate:
                </Typography>
                <IconButton size="small" onClick={() => rotateArrow('left')}>
                  <RotateLeft fontSize="small" />
                </IconButton>
                <Typography variant="caption" sx={{ minWidth: 40, textAlign: 'center' }}>
                  {arrowRotation}deg
                </Typography>
                <IconButton size="small" onClick={() => rotateArrow('right')}>
                  <RotateRight fontSize="small" />
                </IconButton>
              </Stack>
            </>
          )}

          {/* Cancel button */}
          {placementMode && (
            <>
              <Box sx={{ flex: 1 }} />
              <IconButton size="small" onClick={() => setPlacementMode(null)}>
                <Close fontSize="small" />
              </IconButton>
            </>
          )}

          {/* Annotation count */}
          <Box sx={{ flex: 1 }} />
          <Typography variant="caption" color="text.secondary">
            {annotations.length} annotation{annotations.length !== 1 ? 's' : ', '}
          </Typography>
        </Paper>
      )}

      {/* Frame with Annotations */}
      <Box
        sx={{
          flex: 1,
          bgcolor: '#0a0a0f',
          borderRadius: 1,
          overflow: 'hidden',
          position: 'relative',
          height: typeof height ==='number' ? height : height}}
      >
        <FrameAnnotationOverlay
          frameId={frame.id}
          imageUrl={frame.imageUrl}
          annotations={annotations}
          onAddAnnotation={handleAddAnnotation}
          onUpdateAnnotation={handleUpdateAnnotation}
          onDeleteAnnotation={handleDeleteAnnotation}
          placementMode={placementMode}
          onPlacementComplete={handlePlacementComplete}
          readOnly={readOnly}
        />
      </Box>
    </Box>
  );
};

export default InteractiveFrameViewer;

