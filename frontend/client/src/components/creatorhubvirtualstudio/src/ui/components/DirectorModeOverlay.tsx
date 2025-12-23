/**
 * DirectorModeOverlay
 * 
 * Full-screen UI overlay for Director Mode.
 * Provides camera angle selection, controls, and recording.
 * Designed to feel like actually directing a scene.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Button,
  Stack,
  Chip,
  Tooltip,
  Fade,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
  Grid,
  Card,
  CardActionArea,
  CardContent,
} from '@mui/material';
import {
  Close,
  Fullscreen,
  GridView,
  ViewModule,
  PictureInPicture,
  ArrowBack,
  RadioButtonChecked,
  FiberManualRecord,
  Stop,
  Videocam,
  TouchApp,
  Mouse,
  Keyboard,
  Info,
} from '@mui/icons-material';
import { MonitorLayout, monitorFeedService } from '../../core/services/monitorFeedService';
import { multiCameraRecordingService } from '../../core/services/multiCameraRecordingService';
import { CameraControlPanel } from './CameraControlPanel';
import { logger } from '../../core/services/logger';

const log = logger.module('DirectorModeOverlay, ');

// ============================================================================
// Types
// ============================================================================

interface DirectorModeOverlayProps {
  isActive: boolean;
  monitorId: string;
  monitorName: string;
  onExit: () => void;
  cameraCount: number;
  cameras?: Array<{ id: string; name: string }>;
}

interface CameraFeed {
  id: string;
  name: string;
  isLive: boolean;
  isRecording: boolean;
}

// ============================================================================
// Camera Thumbnail Component
// ============================================================================

const CameraThumbnail: React.FC<{
  camera: CameraFeed;
  isSelected: boolean;
  onClick: () => void;
}> = ({ camera, isSelected, onClick }) => {
  return (
    <Card
      onClick={onClick}
      sx={{
        width: 160,
        bgcolor: isSelected ? 'rgba(37, 99, 235, 0.3)' : 'rgba(0, 0, 0, 0.6)',
        border: isSelected ? '3px solid #2563eb' : '2px solid rgba(255,255,255,0.2)',
        borderRadius: 2,
        cursor: 'pointer',
        transition: 'all 0.2s', '&:hover': {
          borderColor: isSelected ? '#2563eb' : 'rgba(255,255,255,0.5)',
          transform: 'scale(1.02)',
        }}}
    >
      <CardActionArea>
        {/* Simulated camera view */}
        <Box
          sx={{
            height: 90,
            bgcolor: '#1a1a1a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative'}}
        >
          <Videocam sx={{ fontSize: 40, color: 'rgba(255,255,255,0.2)' }} />
          
          {/* Live indicator */}
          {camera.isLive && (
            <Chip
              label="LIVE"
              size="small"
              sx={{
                position: 'absolute',
                top: 4,
                left: 4,
                bgcolor: '#ef4444',
                color: '#fff',
                height: 20,
                fontSize: 10}}
            />
          )}
          
          {/* Recording indicator */}
          {camera.isRecording && (
            <Box
              sx={{
                position: 'absolute',
                top: 4,
                right: 4,
                width: 12,
                height: 12,
                borderRadius: '50%',
                bgcolor: '#ef4444',
                animation: 'pulse 1s infinite','@keyframes pulse': {
                  '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.5 },
                }}}
            />
          )}
          
          {/* Selection overlay */}
          {isSelected && (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                bgcolor: 'rgba(37, 99, 235, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'}}
            >
              <Typography variant="caption" sx={{ color: '#fff', fontWeight: 700}}>
                CONTROLLING
              </Typography>
            </Box>
          )}
        </Box>
        
        <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
          <Typography variant="caption" fontWeight={isSelected ? 700 : 400} noWrap>
            {camera.name}
          </Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  );
};

// ============================================================================
// Guidelines Component
// ============================================================================

const DirectorGuidelines: React.FC<{ show: boolean; onDismiss: () => void }> = ({ show, onDismiss }) => {
  if (!show) return null;
  
  return (
    <Fade in={show}>
      <Paper
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          bgcolor: 'rgba(0, 0, 0, 0.95)',
          color: '#fff',
          p: 4,
          borderRadius: 3,
          maxWidth: 500,
          zIndex: 110,
          border: '1px solid rgba(255,255,255,0.2)'}}
        elevation={16}
      >
        <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Info /> Director Mode Guide
        </Typography>
        
        <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.2)' }} />
        
        <Stack spacing={2}>
          <Box>
            <Typography variant="subtitle2" color="primary" gutterBottom>
              1. Select a Camera Angle
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Click on any camera thumbnail at the bottom to select it for control.
              The selected camera will show "CONTROLLING" overlay.
            </Typography>
          </Box>
          
          <Box>
            <Typography variant="subtitle2" color="primary" gutterBottom>
              2. Control Camera Movement
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Use the joysticks on the right panel to control:
            </Typography>
            <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
              <Chip label="DOLLY/TRUCK" size="small" variant="outlined" />
              <Chip label="PAN/TILT" size="small" variant="outlined" />
              <Chip label="ZOOM" size="small" variant="outlined" />
            </Stack>
          </Box>
          
          <Box>
            <Typography variant="subtitle2" color="primary" gutterBottom>
              3. Keyboard Shortcuts
            </Typography>
            <Grid container spacing={1}>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">
                  Arrow Keys: Pan/Tilt
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">
                  WASD: Dolly/Truck
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">
                  Q/E: Roll
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">
                  +/-: Zoom
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">
                  ESC: Exit Director Mode
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">
                  R: Start/Stop Recording
                </Typography>
              </Grid>
            </Grid>
          </Box>
          
          <Box>
            <Typography variant="subtitle2" color="primary" gutterBottom>
              4. Monitor Layout
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Use the layout buttons on the left to switch between single view,
              split screen, grid, or picture-in-picture modes.
            </Typography>
          </Box>
        </Stack>
        
        <Button
          variant="contained"
          fullWidth
          onClick={onDismiss}
          sx={{ mt: 3 }}
        >
          Got it, Start Directing
        </Button>
      </Paper>
    </Fade>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const DirectorModeOverlay: React.FC<DirectorModeOverlayProps> = ({
  isActive,
  monitorId,
  monitorName,
  onExit,
  cameraCount,
  cameras: propCameras,
}) => {
  const [layout, setLayout] = useState<MonitorLayout>('single');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [showGuidelines, setShowGuidelines] = useState(true);
  const [cameras, setCameras] = useState<CameraFeed[]>([]);
  const [activeKeys, setActiveKeys] = useState<Set<string>>(new Set());
  
  // Initialize cameras from props or generate default
  useEffect(() => {
    if (propCameras && propCameras.length > 0) {
      setCameras(propCameras.map((c, i) => ({
        ...c,
        isLive: i === 0,
        isRecording: false,
      })));
      setSelectedCameraId(propCameras[0].id);
    } else {
      // Generate default cameras
      const defaultCameras: CameraFeed[] = [];
      for (let i = 0; i < Math.max(cameraCount, 1); i++) {
        defaultCameras.push({
          id: `cam-${i}`,
          name: `Camera ${i + 1}`,
          isLive: i === 0,
          isRecording: false,
        });
      }
      setCameras(defaultCameras);
      if (defaultCameras.length > 0) {
        setSelectedCameraId(defaultCameras[0].id);
      }
    }
  }, [propCameras, cameraCount]);
  
  // Subscribe to recording state
  useEffect(() => {
    const unsubscribe = multiCameraRecordingService.subscribe((state) => {
      setIsRecording(state.isRecording);
      setRecordingTime(state.elapsedTime);
    });
    return () => unsubscribe();
  }, []);
  
  // Update monitor layout
  useEffect(() => {
    const renderer = monitorFeedService.getRenderer();
    if (renderer) {
      renderer.setConfig({ layout });
    }
  }, [layout]);
  
  // Keyboard controls
  useEffect(() => {
    if (!isActive || showGuidelines) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent default for arrow keys to avoid scrolling
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) {
        e.preventDefault();
      }
      
      // Track active key
      const key = e.key.toLowerCase();
      setActiveKeys(prev => new Set(prev).add(key));
      
      if (!selectedCameraId) return;
      
      switch (key) {
        // Movement (WASD)
        case 'w':
          handleCameraMove('forward,', 0.5);
          break;
        case 's':
          handleCameraMove('backward,', 0.5);
          break;
        case 'a':
          handleCameraMove('left', 0.5);
          break;
        case 'd':
          handleCameraMove('right', 0.5);
          break;
        case ', ': // Space for up
          handleCameraMove('up', 0.5);
          e.preventDefault();
          break;
        case 'shift': // Shift for down
          handleCameraMove('down', 0.5);
          break;
          
        // Rotation (Arrow keys)
        case 'arrowup':
          handleCameraRotate('tilt', 2);
          break;
        case 'arrowdown':
          handleCameraRotate('tilt', -2);
          break;
        case 'arrowleft':
          handleCameraRotate('pan', -2);
          break;
        case 'arrowright':
          handleCameraRotate('pan', 2);
          break;
        case 'q':
          handleCameraRotate('roll', -2);
          break;
        case 'e':
          handleCameraRotate('roll', 2);
          break;
          
        // Zoom
        case '+':
        case '=':
          handleCameraZoom(0.1);
          break;
        case '-':
        case '_':
          handleCameraZoom(-0.1);
          break;
          
        // Camera selection (number keys)
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
          const camIndex = parseInt(key) - 1;
          if (camIndex < cameras.length) {
            handleSelectCamera(cameras[camIndex].id);
          }
          break;
          
        // Recording
        case 'r':
          handleToggleRecording();
          break;
          
        // Reset camera
        case 'home':
          handleCameraReset();
          break;
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      setActiveKeys(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isActive, selectedCameraId, showGuidelines, cameras, handleSelectCamera, handleCameraMove, handleCameraRotate, handleCameraZoom, handleCameraReset]);
  
  const handleLayoutChange = (_: React.MouseEvent<HTMLElement>, newLayout: MonitorLayout | null) => {
    if (newLayout) {
      setLayout(newLayout);
    }
  };
  
  const handleSelectCamera = useCallback((cameraId: string) => {
    setSelectedCameraId(cameraId);
    
    // Update live camera
    setCameras(prev => prev.map(c => ({
      ...c,
      isLive: c.id === cameraId,
    })));
    
    // Update monitor feed
    const renderer = monitorFeedService.getRenderer();
    if (renderer) {
      renderer.setActiveCamera(cameraId);
    }
    
    log.info('Selected camera: ', cameraId);
  }, []);
  
  const handleCameraMove = useCallback((direction: 'forward' | 'backward' | 'left' | 'right' | 'up' | 'down', speed: number) => {
    if (!selectedCameraId) return;
    
    // Dispatch camera move event
    window.dispatchEvent(new CustomEvent('vs-camera-move', {
      detail: { cameraId: selectedCameraId, direction, speed },
    }));
  }, [selectedCameraId]);
  
  const handleCameraRotate = useCallback((axis: 'pan' | 'tilt' | 'roll', amount: number) => {
    if (!selectedCameraId) return;
    
    // Dispatch camera rotate event
    window.dispatchEvent(new CustomEvent('vs-camera-rotate', {
      detail: { cameraId: selectedCameraId, axis, amount },
    }));
  }, [selectedCameraId]);
  
  const handleCameraZoom = useCallback((amount: number) => {
    if (!selectedCameraId) return;
    
    // Dispatch camera zoom event
    window.dispatchEvent(new CustomEvent('vs-camera-zoom', {
      detail: { cameraId: selectedCameraId, amount },
    }));
  }, [selectedCameraId]);
  
  const handleCameraReset = useCallback(() => {
    if (!selectedCameraId) return;
    
    // Dispatch camera reset event
    window.dispatchEvent(new CustomEvent('vs-camera-reset', {
      detail: { cameraId: selectedCameraId },
    }));
  }, [selectedCameraId]);
  
  const handleToggleRecording = async () => {
    if (isRecording) {
      await multiCameraRecordingService.stopAllCameras();
    } else {
      await multiCameraRecordingService.startAllCameras();
    }
  };
  
  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
  };
  
  if (!isActive) return null;
  
  const selectedCamera = cameras.find(c => c.id === selectedCameraId);
  
  return (
    <Fade in={isActive}>
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: 'none',
          zIndex: 100}}
      >
        {/* Guidelines Overlay */}
        <Box sx={{ pointerEvents: showGuidelines ? 'auto' : 'none' }}>
          <DirectorGuidelines show={showGuidelines} onDismiss={() => setShowGuidelines(false)} />
        </Box>
        
        {/* Top Bar - Director Mode Header */}
        <Paper
          sx={{
            position: 'absolute',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            bgcolor: 'rgba(0, 0, 0, 0.9)',
            color: '#fff',
            px: 3,
            py: 1.5,
            borderRadius: 2,
            pointerEvents: 'auto',
            minWidth: 500}}
          elevation={8}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Stack direction="row" alignItems="center" spacing={2}>
              <Chip
                label="DIRECTOR MODE"
                color="error"
                size="small"
                sx={{ 
                  fontWeight: 70,
                  animation: isRecording ? 'pulse 1s infinite' : 'none','@keyframes pulse': {
                    '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.6 },
                  }}}
              />
              <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.2)' }} />
              <Typography variant="body2">
                {selectedCamera ? `Controlling: ${selectedCamera.name}` : 'Select a camera to control'}
              </Typography>
            </Stack>
            
            <Stack direction="row" alignItems="center" spacing={2}>
              {isRecording && (
                <Stack direction="row" alignItems="center" spacing={1}>
                  <RadioButtonChecked sx={{ color: '#ef4444', fontSize: 16 }} />
                  <Typography variant="body2" fontFamily="monospace" color="#ef4444">
                    REC {formatTime(recordingTime)}
                  </Typography>
                </Stack>
              )}
              <Tooltip title="Show Guide">
                <IconButton size="small" onClick={() => setShowGuidelines(true)} sx={{ color: '#fff' }}>
                  <Info />
                </IconButton>
              </Tooltip>
              <Tooltip title="Exit Director Mode (ESC)">
                <IconButton size="small" onClick={onExit} sx={{ color: '#fff' }}>
                  <Close />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>
        </Paper>
        
        {/* Left Side - Layout Options */}
        <Paper
          sx={{
            position: 'absolute',
            left: 16,
            top: '50%',
            transform: 'translateY(-50%)',
            bgcolor: 'rgba(0, 0, 0, 0.9)',
            color: '#fff',
            p: 1.5,
            borderRadius: 2,
            pointerEvents: 'auto'}}
          elevation={8}
        >
          <Stack spacing={1}>
            <Typography variant="caption" color="text.secondary" textAlign="center">
              LAYOUT
            </Typography>
            <Divider sx={{ borderColor: 'rgba(255,255,255,0.2)' }} />
            <ToggleButtonGroup
              orientation="vertical"
              value={layout}
              exclusive
              onChange={handleLayoutChange}
              size="small"
            >
              <ToggleButton value="single" sx={{ color: '#fff' }}>
                <Tooltip title="Single View" placement="right">
                  <Fullscreen />
                </Tooltip>
              </ToggleButton>
              <ToggleButton value="2x1" sx={{ color: '#fff' }}>
                <Tooltip title="2x1 Split" placement="right">
                  <ViewModule />
                </Tooltip>
              </ToggleButton>
              <ToggleButton value="2x2" sx={{ color: '#fff' }}>
                <Tooltip title="2x2 Grid" placement="right">
                  <GridView />
                </Tooltip>
              </ToggleButton>
              <ToggleButton value="pip" sx={{ color: '#fff' }}>
                <Tooltip title="Picture-in-Picture" placement="right">
                  <PictureInPicture />
                </Tooltip>
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>
        </Paper>
        
        {/* Right Side - Camera Controls */}
        {selectedCamera && (
          <Paper
            sx={{
              position: 'absolute',
              right: 16,
              top: '50%',
              transform: 'translateY(-50%)',
              bgcolor: 'rgba(0, 0, 0, 0.9)',
              color: '#fff',
              p: 2,
              borderRadius: 2,
              pointerEvents: 'auto',
              width: 240}}
            elevation={8}
          >
            <CameraControlPanel
              cameraId={selectedCamera.id}
              cameraName={selectedCamera.name}
              isSelected={true}
              onSelect={() => {}}
              onMove={handleCameraMove}
              onRotate={handleCameraRotate}
              onZoom={handleCameraZoom}
              onReset={handleCameraReset}
            />
          </Paper>
        )}
        
        {/* Keyboard Indicator */}
        {activeKeys.size > 0 && (
          <Paper
            sx={{
              position: 'absolute',
              top: 80,
              left: '50%',
              transform: 'translateX(-50%)',
              bgcolor: 'rgba(37, 99, 235, 0.9)',
              color: '#fff',
              px: 2,
              py: 1,
              borderRadius: 2,
              pointerEvents: 'none'}}
            elevation={8}
          >
            <Stack direction="row" alignItems="center" spacing={1}>
              <Keyboard sx={{ fontSize: 18 }} />
              <Stack direction="row" spacing={0.5}>
                {Array.from(activeKeys).map(key => (
                  <Chip
                    key={key}
                    label={key === ', ' ? 'SPACE' : key === 'arrowup' ? 'UP' : key === 'arrowdown' ? 'DOWN' : key === 'arrowleft' ? 'LEFT' : key === 'arrowright' ? 'RIGHT' : key.toUpperCase()}
                    size="small"
                    sx={{
                      bgcolor: 'rgba(255,255,255,0.2)',
                      color: '#fff',
                      fontWeight: 70,
                      fontFamily: 'monospace',
                      minWidth: 32}}
                  />
                ))}
              </Stack>
            </Stack>
          </Paper>
        )}
        
        {/* Bottom Bar - Camera Thumbnails */}
        <Paper
          sx={{
            position: 'absolute',
            bottom: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            bgcolor: 'rgba(0, 0, 0, 0.9)',
            color: '#fff',
            px: 2,
            py: 1.5,
            borderRadius: 2,
            pointerEvents: 'auto',
            maxWidth: 'calc(100vw - 300px)'}}
          elevation={8}
        >
          <Stack spacing={1.5}>
            {/* Instruction */}
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Stack direction="row" alignItems="center" spacing={1}>
                <TouchApp sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="caption" color="text.secondary">
                  Click on a camera to control it
                </Typography>
              </Stack>
              
              <Button
                variant={isRecording ? 'contained' : 'outlined'}
                color={isRecording ? 'error' : 'inherit'}
                size="small"
                startIcon={isRecording ? <Stop /> : <FiberManualRecord />}
                onClick={handleToggleRecording}
                sx={{
                  color: isRecording ? '#fff' : '#ef4444',
                  borderColor: isRecording ? undefined : '#ef4444'}}
              >
                {isRecording ? 'Stop' : `Record All`}
              </Button>
            </Stack>
            
            <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
            
            {/* Camera Thumbnails */}
            <Stack
              direction="row"
              spacing={1.5}
              sx={{
                overflowX: 'auto',
                pb: 1, '&::-webkit-scrollbar': {
                  height: 6,
                }, '&::-webkit-scrollbar-thumb': {
                  bgcolor: 'rgba(255,255,255,0.3)',
                  borderRadius: 3,
                }}}
            >
              {cameras.map((camera) => (
                <CameraThumbnail
                  key={camera.id}
                  camera={camera}
                  isSelected={camera.id === selectedCameraId}
                  onClick={() => handleSelectCamera(camera.id)}
                />
              ))}
            </Stack>
          </Stack>
        </Paper>
        
        {/* Corner Brackets - Cinematic Frame */}
        <Box
          sx={{
            position: 'absolute',
            top: 80,
            left: 80,
            width: 50,
            height: 50,
            borderLeft: '3px solid rgba(255,255,255,0.4)',
            borderTop: '3px solid rgba(255,255,255,0.4)'}}
        />
        <Box
          sx={{
            position: 'absolute',
            top: 80,
            right: 80,
            width: 50,
            height: 50,
            borderRight: '3px solid rgba(255,255,255,0.4)',
            borderTop: '3px solid rgba(255,255,255,0.4)'}}
        />
        <Box
          sx={{
            position: 'absolute',
            bottom: 200,
            left: 80,
            width: 50,
            height: 50,
            borderLeft: '3px solid rgba(255,255,255,0.4)',
            borderBottom: '3px solid rgba(255,255,255,0.4)'}}
        />
        <Box
          sx={{
            position: 'absolute',
            bottom: 200,
            right: 80,
            width: 50,
            height: 50,
            borderRight: '3px solid rgba(255,255,255,0.4)',
            borderBottom:'3px solid rgba(255,255,255,0.4)'}}
        />
      </Box>
    </Fade>
  );
};

export default DirectorModeOverlay;
