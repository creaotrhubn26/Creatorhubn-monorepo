/**
 * Accessible3DControls - WCAG 2.2 Compliant 3D Scene Controls
 * 
 * Provides keyboard alternatives for 3D interactions (WCAG 2.5.7):
 * - Camera orbit/pan/zoom via keyboard
 * - Object selection via keyboard
 * - Object transform via keyboard
 * - Screen reader descriptions of scene state
 */

import React, { useCallback, useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Tooltip,
  Slider,
  Stack,
  Divider,
  Collapse,
  Button,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  ZoomIn,
  ZoomOut,
  RotateLeft,
  RotateRight,
  ArrowUpward,
  ArrowDownward,
  ArrowBack,
  ArrowForward,
  CenterFocusStrong,
  Visibility,
  VisibilityOff,
  Keyboard,
  ThreeSixty,
  OpenWith,
  Height,
  Refresh,
} from '@mui/icons-material';
import { useAccessibility, VisuallyHidden } from '../../providers/AccessibilityProvider';

// ============================================================================
// Types
// ============================================================================

export interface Camera3DState {
  position: [number, number, number];
  target: [number, number, number];
  zoom: number;
  fov: number;
}

export interface Object3DState {
  id: string;
  name: string;
  type: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  visible: boolean;
}

export interface Accessible3DControlsProps {
  // Camera controls
  cameraState: Camera3DState;
  onCameraChange: (state: Partial<Camera3DState>) => void;
  onCameraReset: () => void;
  
  // Object controls
  selectedObject: Object3DState | null;
  objects: Object3DState[];
  onObjectSelect: (id: string | null) => void;
  onObjectTransform: (id: string, transform: Partial<Object3DState>) => void;
  
  // Settings
  enableKeyboardControls?: boolean;
  showPanel?: boolean;
  position?: 'left' | 'right';
  
  // Callbacks
  onNavigateToObject?: (id: string) => void;
}

// ============================================================================
// Component
// ============================================================================

export function Accessible3DControls({
  cameraState,
  onCameraChange,
  onCameraReset,
  selectedObject,
  objects,
  onObjectSelect,
  onObjectTransform,
  enableKeyboardControls = true,
  showPanel = true,
  position = 'right',
  onNavigateToObject,
}: Accessible3DControlsProps) {
  const { announce, settings, registerShortcut, unregisterShortcut } = useAccessibility();
  const [isExpanded, setIsExpanded] = useState(true);
  const [transformMode, setTransformMode] = useState<'position' | 'rotation' | 'scale'>('position');
  const [showSceneDescription, setShowSceneDescription] = useState(false);
  
  // Movement step sizes
  const cameraStep = 0.5;
  const rotationStep = 15; // degrees
  const zoomStep = 0.1;
  const objectStep = 0.1;
  const objectRotationStep = 15;
  const objectScaleStep = 0.1;

  // ============================================================================
  // Camera Controls
  // ============================================================================

  const moveCameraForward = useCallback(() => {
    const [x, y, z] = cameraState.position;
    const [tx, ty, tz] = cameraState.target;
    const dx = tx - x;
    const dz = tz - z;
    const length = Math.sqrt(dx * dx + dz * dz);
    const newX = x + (dx / length) * cameraStep;
    const newZ = z + (dz / length) * cameraStep;
    onCameraChange({ position: [newX, y, newZ] });
    announce('Camera moved forward ');
  }, [cameraState, onCameraChange, announce]);

  const moveCameraBackward = useCallback(() => {
    const [x, y, z] = cameraState.position;
    const [tx, ty, tz] = cameraState.target;
    const dx = tx - x;
    const dz = tz - z;
    const length = Math.sqrt(dx * dx + dz * dz);
    const newX = x - (dx / length) * cameraStep;
    const newZ = z - (dz / length) * cameraStep;
    onCameraChange({ position: [newX, y, newZ] });
    announce('Camera moved backward');
  }, [cameraState, onCameraChange, announce]);

  const moveCameraUp = useCallback(() => {
    const [x, y, z] = cameraState.position;
    onCameraChange({ position: [x, y + cameraStep, z] });
    announce('Camera moved up');
  }, [cameraState.position, onCameraChange, announce]);

  const moveCameraDown = useCallback(() => {
    const [x, y, z] = cameraState.position;
    onCameraChange({ position: [x, Math.max(0.1, y - cameraStep), z] });
    announce('Camera moved down');
  }, [cameraState.position, onCameraChange, announce]);

  const rotateCameraLeft = useCallback(() => {
    // Orbit left around target
    const [x, y, z] = cameraState.position;
    const [tx, ty, tz] = cameraState.target;
    const dx = x - tx;
    const dz = z - tz;
    const angle = Math.atan2(dz, dx) + (rotationStep * Math.PI) / 180;
    const distance = Math.sqrt(dx * dx + dz * dz);
    const newX = tx + Math.cos(angle) * distance;
    const newZ = tz + Math.sin(angle) * distance;
    onCameraChange({ position: [newX, y, newZ] });
    announce('Camera rotated left');
  }, [cameraState, onCameraChange, announce]);

  const rotateCameraRight = useCallback(() => {
    // Orbit right around target
    const [x, y, z] = cameraState.position;
    const [tx, ty, tz] = cameraState.target;
    const dx = x - tx;
    const dz = z - tz;
    const angle = Math.atan2(dz, dx) - (rotationStep * Math.PI) / 180;
    const distance = Math.sqrt(dx * dx + dz * dz);
    const newX = tx + Math.cos(angle) * distance;
    const newZ = tz + Math.sin(angle) * distance;
    onCameraChange({ position: [newX, y, newZ] });
    announce('Camera rotated right');
  }, [cameraState, onCameraChange, announce]);

  const zoomIn = useCallback(() => {
    onCameraChange({ zoom: Math.min(5, cameraState.zoom + zoomStep) });
    announce(`Zoom: ${Math.round((cameraState.zoom + zoomStep) * 100)}%`);
  }, [cameraState.zoom, onCameraChange, announce]);

  const zoomOut = useCallback(() => {
    onCameraChange({ zoom: Math.max(0.1, cameraState.zoom - zoomStep) });
    announce(`Zoom: ${Math.round((cameraState.zoom - zoomStep) * 100)}%`);
  }, [cameraState.zoom, onCameraChange, announce]);

  const resetCamera = useCallback(() => {
    onCameraReset();
    announce('Camera reset to default position');
  }, [onCameraReset, announce]);

  // ============================================================================
  // Object Controls
  // ============================================================================

  const selectNextObject = useCallback(() => {
    if (objects.length === 0) {
      announce('No objects in scene');
      return;
    }
    
    const currentIndex = selectedObject
      ? objects.findIndex((o) => o.id === selectedObject.id)
      : -1;
    const nextIndex = (currentIndex + 1) % objects.length;
    const nextObject = objects[nextIndex];
    onObjectSelect(nextObject.id);
    announce(`Selected: ${nextObject.name} (${nextObject.type})`);
  }, [objects, selectedObject, onObjectSelect, announce]);

  const selectPreviousObject = useCallback(() => {
    if (objects.length === 0) {
      announce('No objects in scene');
      return;
    }
    
    const currentIndex = selectedObject
      ? objects.findIndex((o) => o.id === selectedObject.id)
      : 0;
    const prevIndex = (currentIndex - 1 + objects.length) % objects.length;
    const prevObject = objects[prevIndex];
    onObjectSelect(prevObject.id);
    announce(`Selected: ${prevObject.name} (${prevObject.type})`);
  }, [objects, selectedObject, onObjectSelect, announce]);

  const clearSelection = useCallback(() => {
    onObjectSelect(null);
    announce('Selection cleared');
  }, [onObjectSelect, announce]);

  const moveSelectedObject = useCallback(
    (axis: 'x' | 'y' | 'z', direction: 1 | -1) => {
      if (!selectedObject) {
        announce('No object selected');
        return;
      }

      const delta = objectStep * direction;
      const newPosition: [number, number, number] = [...selectedObject.position];
      const axisIndex = { x: 0, y: 1, z: 2 }[axis];
      newPosition[axisIndex] += delta;

      onObjectTransform(selectedObject.id, { position: newPosition });
      announce(
        `${selectedObject.name} moved ${direction > 0 ? 'positive' : 'negative'} ${axis.toUpperCase()}`
      );
    },
    [selectedObject, onObjectTransform, announce]
  );

  const rotateSelectedObject = useCallback(
    (axis: 'x' | 'y' | 'z', direction: 1 | -1) => {
      if (!selectedObject) {
        announce('No object selected');
        return;
      }

      const delta = (objectRotationStep * Math.PI / 180) * direction;
      const newRotation: [number, number, number] = [...selectedObject.rotation];
      const axisIndex = { x: 0, y: 1, z: 2 }[axis];
      newRotation[axisIndex] += delta;

      onObjectTransform(selectedObject.id, { rotation: newRotation });
      announce(
        `${selectedObject.name} rotated ${direction > 0 ? 'clockwise' : 'counter-clockwise'} around ${axis.toUpperCase()}`
      );
    },
    [selectedObject, onObjectTransform, announce]
  );

  const scaleSelectedObject = useCallback(
    (direction: 1 | -1, uniform: boolean = true) => {
      if (!selectedObject) {
        announce('No object selected');
        return;
      }

      const delta = objectScaleStep * direction;
      const newScale: [number, number, number] = uniform
        ? [
            Math.max(0.1, selectedObject.scale[0] + delta),
            Math.max(0.1, selectedObject.scale[1] + delta),
            Math.max(0.1, selectedObject.scale[2] + delta),
          ]
        : [...selectedObject.scale];

      onObjectTransform(selectedObject.id, { scale: newScale });
      announce(
        `${selectedObject.name} scaled ${direction > 0 ? 'up' : 'down'}`
      );
    },
    [selectedObject, onObjectTransform, announce]
  );

  // ============================================================================
  // Keyboard Shortcuts
  // ============================================================================

  useEffect(() => {
    if (!enableKeyboardControls) return;

    // Camera shortcuts
    registerShortcut({ key: 'w', action: moveCameraForward, description: 'Move camera forward', category: 'Camera' });
    registerShortcut({ key: 's', action: moveCameraBackward, description: 'Move camera backward', category: 'Camera' });
    registerShortcut({ key: 'q', action: moveCameraUp, description: 'Move camera up', category: 'Camera' });
    registerShortcut({ key: 'e', action: moveCameraDown, description: 'Move camera down', category: 'Camera' });
    registerShortcut({ key: 'a', action: rotateCameraLeft, description: 'Rotate camera left', category: 'Camera' });
    registerShortcut({ key: 'd', action: rotateCameraRight, description: 'Rotate camera right', category: 'Camera' });
    registerShortcut({ key: '=', action: zoomIn, description: 'Zoom in', category: 'Camera' });
    registerShortcut({ key: '-', action: zoomOut, description: 'Zoom out', category: 'Camera' });
    registerShortcut({ key: '0', action: resetCamera, description: 'Reset camera', category: 'Camera' });

    // Selection shortcuts
    registerShortcut({ key: 'Tab', action: selectNextObject, description: 'Select next object', category: 'Selection' });
    registerShortcut({ key: 'Tab', modifiers: ['shift'], action: selectPreviousObject, description: 'Select previous object', category: 'Selection' });
    registerShortcut({ key: 'Escape', action: clearSelection, description: 'Clear selection', category: 'Selection' });

    // Object transform shortcuts (when object is selected)
    registerShortcut({ key: 'ArrowRight', action: () => moveSelectedObject('x', 1), description: 'Move right', category: 'Transform' });
    registerShortcut({ key: 'ArrowLeft', action: () => moveSelectedObject('x', -1), description: 'Move left', category: 'Transform' });
    registerShortcut({ key: 'ArrowUp', action: () => moveSelectedObject('z', -1), description: 'Move forward', category: 'Transform' });
    registerShortcut({ key: 'ArrowDown', action: () => moveSelectedObject('z', 1), description: 'Move backward', category: 'Transform' });
    registerShortcut({ key: 'ArrowUp', modifiers: ['shift'], action: () => moveSelectedObject('y', 1), description: 'Move up', category: 'Transform' });
    registerShortcut({ key: 'ArrowDown', modifiers: ['shift'], action: () => moveSelectedObject('y', -1), description: 'Move down', category: 'Transform' });
    registerShortcut({ key: '[', action: () => rotateSelectedObject('y', -1), description: 'Rotate left', category: 'Transform' });
    registerShortcut({ key: ']', action: () => rotateSelectedObject('y', 1), description: 'Rotate right', category: 'Transform' });
    registerShortcut({ key: '+', action: () => scaleSelectedObject(1), description: 'Scale up', category: 'Transform' });
    registerShortcut({ key: '_', action: () => scaleSelectedObject(-1), description: 'Scale down', category: 'Transform' });

    return () => {
      // Cleanup shortcuts
      unregisterShortcut('w');
      unregisterShortcut('s');
      unregisterShortcut('q');
      unregisterShortcut('e');
      unregisterShortcut('a');
      unregisterShortcut('d');
      unregisterShortcut('=');
      unregisterShortcut('-');
      unregisterShortcut('0');
      unregisterShortcut('tab');
      unregisterShortcut('shift+tab');
      unregisterShortcut('escape');
      unregisterShortcut('arrowright');
      unregisterShortcut('arrowleft');
      unregisterShortcut('arrowup');
      unregisterShortcut('arrowdown');
      unregisterShortcut('shift+arrowup');
      unregisterShortcut('shift+arrowdown');
      unregisterShortcut('[');
      unregisterShortcut(']');
      unregisterShortcut('+');
      unregisterShortcut('_');
    };
  }, [
    enableKeyboardControls,
    registerShortcut,
    unregisterShortcut,
    moveCameraForward,
    moveCameraBackward,
    moveCameraUp,
    moveCameraDown,
    rotateCameraLeft,
    rotateCameraRight,
    zoomIn,
    zoomOut,
    resetCamera,
    selectNextObject,
    selectPreviousObject,
    clearSelection,
    moveSelectedObject,
    rotateSelectedObject,
    scaleSelectedObject,
  ]);

  // ============================================================================
  // Scene Description for Screen Readers
  // ============================================================================

  const getSceneDescription = useCallback(() => {
    const objectCount = objects.length;
    const visibleCount = objects.filter((o) => o.visible).length;
    const lightCount = objects.filter((o) => o.type === 'light').length;
    const cameraHeight = cameraState.position[1].toFixed(1);
    const zoomPercent = Math.round(cameraState.zoom * 100);

    return `Scene contains ${objectCount} objects, ${visibleCount} visible. ${lightCount} lights. Camera at height ${cameraHeight}m, zoom ${zoomPercent}%. ${
      selectedObject ? `Selected: ${selectedObject.name}` : 'Nothing selected'
    }.`;
  }, [objects, cameraState, selectedObject]);

  if (!showPanel) {
    return (
      <>
        {/* Hidden description for screen readers */}
        <VisuallyHidden>
          <div role="status" aria-live="polite">
            {getSceneDescription()}
          </div>
        </VisuallyHidden>
      </>
    );
  }

  return (
    <Paper
      elevation={3}
      sx={{
        position: 'absolute',
        top: 16,
        [position]: 16,
        width: 280,
        maxHeight: 'calc(100% - 32px)',
        overflow: 'auto',
        bgcolor: 'background.paper',
        zIndex: 1}}
      role="region"
      aria-label="3D Scene Controls"
    >
      {/* Header */}
      <Box
        sx={{
          p: 1.5,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: 1,
          borderColor: 'divider'}}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Keyboard fontSize="small" />
          <Typography variant="subtitle2">Keyboard Controls</Typography>
        </Box>
        <IconButton
          size="small"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-label={isExpanded ? 'Collapse controls' : 'Expand controls'}
          aria-expanded={isExpanded}
        >
          {isExpanded ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
        </IconButton>
      </Box>

      <Collapse in={isExpanded}>
        {/* Scene Description Toggle */}
        <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
          <Button
            size="small"
            fullWidth
            onClick={() => {
              setShowSceneDescription(!showSceneDescription);
              if (!showSceneDescription) {
                announce(getSceneDescription());
              }
            }}
            startIcon={<Visibility />}
          >
            {showSceneDescription ? 'Hide' : 'Show'} Scene Description
          </Button>
          <Collapse in={showSceneDescription}>
            <Typography variant="body2" sx={{ mt: 1, p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
              {getSceneDescription()}
            </Typography>
          </Collapse>
        </Box>

        {/* Camera Controls */}
        <Box sx={{ p: 1.5 }}>
          <Typography variant="caption" color="text.secondary" gutterBottom>
            Camera Controls
          </Typography>
          
          {/* Movement */}
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 1 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0.5 }}>
              <Box />
              <Tooltip title="Move forward (W)">
                <IconButton onClick={moveCameraForward} size="small" aria-label="Move camera forward">
                  <ArrowUpward />
                </IconButton>
              </Tooltip>
              <Box />
              <Tooltip title="Rotate left (A)">
                <IconButton onClick={rotateCameraLeft} size="small" aria-label="Rotate camera left">
                  <RotateLeft />
                </IconButton>
              </Tooltip>
              <Tooltip title="Reset camera (0)">
                <IconButton onClick={resetCamera} size="small" aria-label="Reset camera">
                  <CenterFocusStrong />
                </IconButton>
              </Tooltip>
              <Tooltip title="Rotate right (D)">
                <IconButton onClick={rotateCameraRight} size="small" aria-label="Rotate camera right">
                  <RotateRight />
                </IconButton>
              </Tooltip>
              <Box />
              <Tooltip title="Move backward (S)">
                <IconButton onClick={moveCameraBackward} size="small" aria-label="Move camera backward">
                  <ArrowDownward />
                </IconButton>
              </Tooltip>
              <Box />
            </Box>
          </Box>

          {/* Height & Zoom */}
          <Stack direction="row" spacing={1} justifyContent="center" sx={{ mb: 1 }}>
            <Tooltip title="Move up (Q)">
              <IconButton onClick={moveCameraUp} size="small" aria-label="Move camera up">
                <Height sx={{ transform: 'rotate(180deg)' }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Move down (E)">
              <IconButton onClick={moveCameraDown} size="small" aria-label="Move camera down">
                <Height />
              </IconButton>
            </Tooltip>
            <Divider orientation="vertical" flexItem />
            <Tooltip title="Zoom out (-)">
              <IconButton onClick={zoomOut} size="small" aria-label="Zoom out">
                <ZoomOut />
              </IconButton>
            </Tooltip>
            <Tooltip title="Zoom in (=)">
              <IconButton onClick={zoomIn} size="small" aria-label="Zoom in">
                <ZoomIn />
              </IconButton>
            </Tooltip>
          </Stack>

          <Typography variant="caption" color="text.secondary">
            Zoom: {Math.round(cameraState.zoom * 100)}%
          </Typography>
        </Box>

        <Divider />

        {/* Object Selection */}
        <Box sx={{ p: 1.5 }}>
          <Typography variant="caption" color="text.secondary" gutterBottom>
            Object Selection (Tab / Shift+Tab)
          </Typography>
          
          <Stack direction="row" spacing={1} sx={{ my: 1 }}>
            <Button
              size="small"
              variant="outlined"
              onClick={selectPreviousObject}
              startIcon={<ArrowBack />}
              aria-label="Select previous object"
            >
              Prev
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={selectNextObject}
              endIcon={<ArrowForward />}
              aria-label="Select next object"
            >
              Next
            </Button>
          </Stack>

          {selectedObject ? (
            <Paper variant="outlined" sx={{ p: 1, mt: 1 }}>
              <Typography variant="body2" fontWeight="bold">
                {selectedObject.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Type: {selectedObject.type}
              </Typography>
              <Button
                size="small"
                color="error"
                onClick={clearSelection}
                sx={{ mt: 1 }}
              >
                Clear Selection (Esc)
              </Button>
            </Paper>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              No object selected. Press Tab to select.
            </Typography>
          )}
        </Box>

        {/* Object Transform */}
        {selectedObject && (
          <>
            <Divider />
            <Box sx={{ p: 1.5 }}>
              <Typography variant="caption" color="text.secondary" gutterBottom>
                Transform: {selectedObject.name}
              </Typography>

              <ToggleButtonGroup
                value={transformMode}
                exclusive
                onChange={(_, mode) => mode && setTransformMode(mode)}
                size="small"
                fullWidth
                sx={{ my: 1 }}
                aria-label="Transform mode"
              >
                <ToggleButton value="position" aria-label="Position mode">
                  <OpenWith fontSize="small" />
                </ToggleButton>
                <ToggleButton value="rotation" aria-label="Rotation mode">
                  <ThreeSixty fontSize="small" />
                </ToggleButton>
                <ToggleButton value="scale" aria-label="Scale mode">
                  <Height fontSize="small" />
                </ToggleButton>
              </ToggleButtonGroup>

              {transformMode === 'position' && (
                <Stack spacing={1}>
                  <Typography variant="caption">Arrow keys to move</Typography>
                  <Stack direction="row" justifyContent="center" spacing={0.5}>
                    <IconButton onClick={() => moveSelectedObject('x', -1)} size="small" aria-label="Move left">
                      <ArrowBack />
                    </IconButton>
                    <IconButton onClick={() => moveSelectedObject('z', -1)} size="small" aria-label="Move forward">
                      <ArrowUpward />
                    </IconButton>
                    <IconButton onClick={() => moveSelectedObject('z', 1)} size="small" aria-label="Move backward">
                      <ArrowDownward />
                    </IconButton>
                    <IconButton onClick={() => moveSelectedObject('x', 1)} size="small" aria-label="Move right">
                      <ArrowForward />
                    </IconButton>
                  </Stack>
                </Stack>
              )}

              {transformMode === 'rotation' && (
                <Stack spacing={1}>
                  <Typography variant="caption">[ and ] to rotate</Typography>
                  <Stack direction="row" justifyContent="center" spacing={1}>
                    <IconButton onClick={() => rotateSelectedObject('y', -1)} size="small" aria-label="Rotate left">
                      <RotateLeft />
                    </IconButton>
                    <IconButton onClick={() => rotateSelectedObject('y', 1)} size="small" aria-label="Rotate right">
                      <RotateRight />
                    </IconButton>
                  </Stack>
                </Stack>
              )}

              {transformMode ==='scale' && (
                <Stack spacing={1}>
                  <Typography variant="caption">+ and - to scale</Typography>
                  <Stack direction="row" justifyContent="center" spacing={1}>
                    <Button
                      onClick={() => scaleSelectedObject(-1)}
                      size="small"
                      variant="outlined"
                      aria-label="Scale down"
                    >
                      Smaller
                    </Button>
                    <Button
                      onClick={() => scaleSelectedObject(1)}
                      size="small"
                      variant="outlined"
                      aria-label="Scale up"
                    >
                      Larger
                    </Button>
                  </Stack>
                </Stack>
              )}
            </Box>
          </>
        )}

        {/* Keyboard Shortcuts Legend */}
        <Divider />
        <Box sx={{ p: 1.5 }}>
          <Typography variant="caption" color="text.secondary">
            Keyboard Shortcuts
          </Typography>
          <Typography variant="caption" component="div" sx={{ mt: 1, lineHeight: 1.8 }}>
            <strong>Camera:</strong> WASD move, QE up/down, +/- zoom
            <br />
            <strong>Select:</strong> Tab/Shift+Tab, Esc clear
            <br />
            <strong>Move:</strong> Arrow keys
            <br />
            <strong>Rotate:</strong> [ ] brackets
            <br />
            <strong>Scale:</strong> +/- keys
          </Typography>
        </Box>
      </Collapse>
    </Paper>
  );
}

export default Accessible3DControls;

