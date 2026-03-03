/**
 * ViewfinderView - Professional Camera Viewfinder Component
 * 
 * A full-featured viewfinder showing:
 * - Live camera POV render
 * - Exposure simulation
 * - Lens effects (vignetting, distortion)
 * - Frame guides (thirds, golden, safe areas)
 * - Focus peaking
 * - Zebra patterns for overexposure
 * - Histogram overlay
 * - Camera info HUD
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { logger } from '../../core/services/logger';

const log = logger.module('ViewfinderView');
import {
  Box,
  IconButton,
  Tooltip,
  Paper,
  Typography,
  Stack,
  Slider,
  Collapse,
  Divider,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
  Settings as SettingsIcon,
  CameraAlt as CameraIcon,
  GridOn as GridIcon,
  Brightness6 as ExposureIcon,
  FilterCenterFocus as FocusIcon,
  Videocam as RecordIcon,
  Stop as StopIcon,
  Tune as TuneIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  PhotoCamera as PhotoIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  CenterFocusStrong as ResetIcon,
} from '@mui/icons-material';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useViewfinder, ViewfinderProvider } from '../../hooks/useViewfinder';
import { useNodes, useActions } from '../../state/selectors';
import { getThreeScene, getActiveCameraId, setActiveCameraId } from '../../core/services/viewports';
import {
  FrameGuidesOverlay,
  CameraInfoHUD,
  HistogramOverlay,
  ExposureWarning,
  FocusIndicator,
  LetterboxOverlay,
  RecordingIndicator,
  ViewfinderToggleButtons,
  AspectRatioSelector,
} from '../components/ViewfinderOverlays';
import {
  ZEBRA_SHADER,
  FOCUS_PEAKING_SHADER,
  LENS_EFFECTS_SHADER,
} from '../../core/rendering/ViewfinderRenderer';
import { useTabletSupport } from '../../providers/TabletSupportProvider';
import { TouchIconButton, TouchSlider, TouchPinchZoom } from '../components/TabletAwarePanels';
import { useAccessibility, VisuallyHidden } from '../../providers/AccessibilityProvider';
import { useVirtualStudio } from '../../../VirtualStudioContext';

// ============================================================================
// THREE.js Imports
// ============================================================================

let THREE: any = null;
try {
  THREE = require('three');
} catch (e) {
  log.warn('THREE.js not available');
}

// ============================================================================
// Camera POV Renderer Component
// ============================================================================

interface CameraPOVRendererProps {
  cameraNode: any;
  onHistogramUpdate?: (imageData: ImageData) => void;
  settings: ReturnType<typeof useViewfinder>['settings'];
  exposure: ReturnType<typeof useViewfinder>['exposure'];
}

function CameraPOVRenderer({ 
  cameraNode, 
  onHistogramUpdate, 
  settings,
  exposure,
}: CameraPOVRendererProps) {
  const { gl, scene, size } = useThree();
  const cameraRef = useRef<any>(null);
  const targetRef = useRef<any>(null);
  
  // Create perspective camera matching the camera node
  useEffect(() => {
    if (!THREE || !cameraNode?.camera) return;
    
    const cam = cameraNode.camera;
    const sensor = cam.sensor || [36, 24];
    const focalLength = cam.focalLength || 50;
    
    // Calculate FOV from sensor and focal length
    const fovRad = 2 * Math.atan(sensor[1] / 2 / focalLength);
    const fovDeg = (fovRad * 180) / Math.PI;
    
    // Create camera
    const camera = new THREE.PerspectiveCamera(fovDeg, size.width / size.height, 0.1, 1000);
    camera.position.set(
      cameraNode.transform.position[0],
      cameraNode.transform.position[1],
      cameraNode.transform.position[2]
    );
    
    // Look at subject (default: origin at camera height)
    const lookAtY = cameraNode.transform.position[1];
    camera.lookAt(0, lookAtY, 0);
    
    cameraRef.current = camera;
    
    // Create render target for histogram sampling
    targetRef.current = new THREE.WebGLRenderTarget(size.width, size.height);
    
    return () => {
      targetRef.current?.dispose();
    };
  }, [cameraNode?.id, size.width, size.height]);
  
  // Update camera on node changes
  useEffect(() => {
    if (!cameraRef.current || !cameraNode?.camera) return;
    
    const cam = cameraNode.camera;
    const sensor = cam.sensor || [36, 24];
    const focalLength = cam.focalLength || 50;
    
    const fovRad = 2 * Math.atan(sensor[1] / 2 / focalLength);
    cameraRef.current.fov = (fovRad * 180) / Math.PI;
    cameraRef.current.updateProjectionMatrix();
    
    cameraRef.current.position.set(
      cameraNode.transform.position[0],
      cameraNode.transform.position[1],
      cameraNode.transform.position[2]
    );
    
    const lookAtY = cameraNode.transform.position[1];
    cameraRef.current.lookAt(0, lookAtY, 0);
  }, [cameraNode]);
  
  // Render loop
  useFrame(() => {
    if (!cameraRef.current || !targetRef.current) return;
    
    // Apply exposure adjustment
    const exposureValue = settings.simulateExposure && exposure 
      ? Math.pow(2, -exposure.stops) 
      : 1;
    gl.toneMappingExposure = exposureValue;
    
    // Render to target
    gl.setRenderTarget(targetRef.current);
    gl.render(scene, cameraRef.current);
    gl.setRenderTarget(null);
    
    // Also render to screen
    gl.render(scene, cameraRef.current);
    
    // Sample for histogram (every 30 frames)
    if (onHistogramUpdate && Math.random() < 0.033) {
      const pixels = new Uint8Array(size.width * size.height * 4);
      gl.readRenderTargetPixels(targetRef.current, 0, 0, size.width, size.height, pixels);
      const imageData = new ImageData(
        new Uint8ClampedArray(pixels.buffer),
        size.width,
        size.height
      );
      onHistogramUpdate(imageData);
    }
  });
  
  return null;
}

// ============================================================================
// Scene Content (lights and models from the main scene)
// ============================================================================

function SceneContent({ nodes }: { nodes: any[] }) {
  return (
    <>
      {/* Ambient light */}
      <ambientLight intensity={0.3} />
      
      {/* Scene lights */}
      {nodes
        .filter((n) => n.light && n.visible !== false)
        .map((node) => {
          const power = (node.light?.power || 0.5) * 2;
          const cct = node.light?.cct || 5600;
          
          // CCT to approximate RGB
          const temp = cct / 100;
          let r = 1, g = 1, b = 1;
          if (temp <= 66) {
            r = 1;
            g = Math.max(0, Math.min(1, (99.4708025861 * Math.log(temp) - 161.1195681661) / 255));
            b = temp <= 19 ? 0 : Math.max(0, Math.min(1, (138.5177312231 * Math.log(temp - 10) - 305.0447927307) / 255));
          } else {
            r = Math.max(0, Math.min(1, (329.698727446 * Math.pow(temp - 60, -0.1332047592)) / 255));
            g = Math.max(0, Math.min(1, (288.1221695283 * Math.pow(temp - 60, -0.0755148492)) / 255));
            b = 1;
          }
          
          return (
            <pointLight
              key={node.id}
              position={node.transform.position}
              intensity={power}
              color={`rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`}
              distance={10}
              decay={2}
            />
          );
        })}
      
      {/* Scene models */}
      {nodes
        .filter((n) => n.model && n.visible !== false)
        .map((node) => (
          <mesh key={node.id} position={node.transform.position}>
            <capsuleGeometry args={[0.25, node.model?.height || 1.75 - 0.5, 8, 16]} />
            <meshStandardMaterial color="#e0c0a0" />
          </mesh>
        ))}
      
      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#333333" />
      </mesh>
    </>
  );
}

// ============================================================================
// Main Viewfinder Canvas
// ============================================================================

interface ViewfinderCanvasProps {
  width: number;
  height: number;
  cameraNode: any;
  nodes: any[];
  settings: ReturnType<typeof useViewfinder>['settings'];
  exposure: ReturnType<typeof useViewfinder>['exposure'];
  onHistogramUpdate?: (imageData: ImageData) => void;
}

function ViewfinderCanvas({
  width,
  height,
  cameraNode,
  nodes,
  settings,
  exposure,
  onHistogramUpdate,
}: ViewfinderCanvasProps) {
  if (!cameraNode?.camera) {
    return (
      <Box
        sx={{
          width,
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: '#1a1a1a',
          color: 'white'}}
      >
        <Stack alignItems="center" spacing={2}>
          <CameraIcon sx={{ fontSize: 64, opacity: 0.3 }} />
          <Typography variant="body2" sx={{ opacity: 0.5 }}>
            No camera in scene
          </Typography>
        </Stack>
      </Box>
    );
  }
  
  return (
    <Canvas
      style={{ width, height }}
      gl={{
        antialias: true,
        preserveDrawingBuffer: true,
        toneMapping: THREE?.ACESFilmicToneMapping}}
    >
      <CameraPOVRenderer
        cameraNode={cameraNode}
        onHistogramUpdate={onHistogramUpdate}
        settings={settings}
        exposure={exposure}
      />
      <SceneContent nodes={nodes} />
    </Canvas>
  );
}

// ============================================================================
// Settings Panel
// ============================================================================

interface ViewfinderSettingsPanelProps {
  settings: ReturnType<typeof useViewfinder>['settings'];
  onUpdate: (updates: Partial<ReturnType<typeof useViewfinder>['settings']>) => void;
  sceneLuminance: number;
  onSceneLuminanceChange: (value: number) => void;
}

function ViewfinderSettingsPanel({ 
  settings, 
  onUpdate, 
  sceneLuminance, 
  onSceneLuminanceChange 
}: ViewfinderSettingsPanelProps) {
  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="subtitle2" gutterBottom>
        Viewfinder Settings
      </Typography>
      
      <Stack spacing={2}>
        {/* Guide Type */}
        <Box>
          <Typography variant="caption" color="text.secondary">
            Guide Type
          </Typography>
          <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
            {(['thirds','golden','safe_areas','crosshair','all'] as const).map((type) => (
              <Box
                key={type}
                onClick={() => onUpdate({ guideType: type })}
                sx={{
                  px: 1,
                  py: 0.5,
                  borderRadius: 1,
                  cursor: 'pointer',
                  bgcolor: settings.guideType === type ? 'primary.main' : 'action.hover',
                  color: settings.guideType === type ? 'white' : 'text.secondary',
                  fontSize: 11,
                  textTransform: 'capitalize'}}
              >
                {type.replace('_', ' ')}
              </Box>
            ))}
          </Stack>
        </Box>
        
        {/* Zebra Threshold */}
        <Box>
          <Typography variant="caption" color="text.secondary">
            Zebra Threshold: {settings.zebraThreshold}%
          </Typography>
          <Slider
            size="small"
            value={settings.zebraThreshold}
            onChange={(_, v) => onUpdate({ zebraThreshold: v as number })}
            min={50}
            max={100}
          />
        </Box>
        
        {/* Focus Peaking Threshold */}
        <Box>
          <Typography variant="caption" color="text.secondary">
            Focus Peaking Sensitivity: {settings.focusPeakingThreshold}
          </Typography>
          <Slider
            size="small"
            value={settings.focusPeakingThreshold}
            onChange={(_, v) => onUpdate({ focusPeakingThreshold: v as number })}
            min={10}
            max={100}
          />
        </Box>
        
        {/* Scene Luminance */}
        <Box>
          <Typography variant="caption" color="text.secondary">
            Scene Luminance: {sceneLuminance} cd/m²
          </Typography>
          <Slider
            size="small"
            value={sceneLuminance}
            onChange={(_, v) => onSceneLuminanceChange(v as number)}
            min={50}
            max={5000}
            scale={(x) => x ** 2}
          />
        </Box>
        
        <Divider />
        
        {/* Histogram Position */}
        <Box>
          <Typography variant="caption" color="text.secondary">
            Histogram Position
          </Typography>
          <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
            {(['top-left','top-right','bottom-left','bottom-right'] as const).map((pos) => (
              <Box
                key={pos}
                onClick={() => onUpdate({ histogramPosition: pos })}
                sx={{
                  px: 1,
                  py: 0.5,
                  borderRadius: 1,
                  cursor: 'pointer',
                  bgcolor: settings.histogramPosition === pos ? 'primary.main' : 'action.hover',
                  color: settings.histogramPosition === pos ? 'white' : 'text.secondary',
                  fontSize: 10}}
              >
                {pos.replace('-', ', ')}
              </Box>
            ))}
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
}

// ============================================================================
// Main ViewfinderView Component
// ============================================================================

interface ViewfinderViewProps {
  width?: number | string;
  height?: number | string;
  showToolbar?: boolean;
  defaultFullscreen?: boolean;
}

export function ViewfinderViewInner({
  width = '100%',
  height = 400,
  showToolbar = true,
  defaultFullscreen = false,
}: ViewfinderViewProps) {
  // Tablet support
  const { shouldUseTouch } = useTabletSupport();
  const isTouch = shouldUseTouch();

  // Toast notifications
  const { addToast } = useVirtualStudio();

  // Accessibility
  const { announce, settings: a11ySettings } = useAccessibility();

  const nodes = useNodes();
  const viewfinder = useViewfinder();
  const containerRef = useRef<HTMLDivElement>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  
  // Touch zoom state
  const [touchZoom, setTouchZoom] = useState(1);
  const lastTouchDistance = useRef<number | null>(null);
  const initialZoom = useRef(1);
  const lastTapTime = useRef(0);
  
  const {
    settings,
    updateSettings,
    camera,
    cameraNode,
    hasCamera,
    exposure,
    focus,
    cameraInfo,
    histogram,
    updateHistogram,
    getFrameGuides,
    getLetterbox,
    sceneLuminance,
    setSceneLuminance,
    isFullscreen,
    toggleFullscreen,
    isRecording,
    recordingDuration,
    startRecording,
    stopRecording,
  } = viewfinder;
  
  // Measure container
  useEffect(() => {
    if (!containerRef.current) return;
    
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);
  
  // Calculate letterbox
  const letterbox = useMemo(() => {
    if (containerSize.width === 0 || containerSize.height === 0) {
      return { width: 0, height: 0, x: 0, y: 0 };
    }
    return getLetterbox(containerSize.width, containerSize.height);
  }, [containerSize, getLetterbox]);
  
  // Get frame guides
  const frameGuides = useMemo(() => {
    return getFrameGuides(letterbox.width, letterbox.height);
  }, [getFrameGuides, letterbox]);
  
  // Take snapshot
  const handleSnapshot = useCallback(() => {
    if (!containerRef.current) return;
    
    const canvas = containerRef.current.querySelector('canvas');
    if (!canvas) return;
    
    const link = document.createElement('a');
    const filename = `viewfinder-${Date.now()}.png`;
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
    announce('Snapshot captured');
    addToast({
      message: 'Snapshot saved',
      type: 'success',
      duration: 2000,
    });
  }, [announce, addToast]);

  // Wrapped recording handlers with toasts
  const handleStartRecording = useCallback(() => {
    startRecording();
    addToast({
      message: 'Recording started',
      type: 'info',
      duration: 1500,
    });
  }, [startRecording, addToast]);

  const handleStopRecording = useCallback(() => {
    stopRecording();
    addToast({
      message: 'Recording saved',
      type: 'success',
      duration: 2000,
    });
  }, [stopRecording, addToast]);

  // Wrapped fullscreen handler with toast
  const handleToggleFullscreen = useCallback(() => {
    toggleFullscreen();
    addToast({
      message: isFullscreen ? 'Exited fullscreen' : 'Entered fullscreen',
      type: 'info',
      duration: 1500,
    });
  }, [toggleFullscreen, isFullscreen, addToast]);

  // Touch handlers for pinch-zoom
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Double tap detection
    if (e.touches.length === 1 && isTouch) {
      const now = Date.now();
      if (now - lastTapTime.current < 300) {
        // Double tap - reset zoom
        setTouchZoom(1);
      }
      lastTapTime.current = now;
    }

    // Pinch start
    if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      lastTouchDistance.current = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );
      initialZoom.current = touchZoom;
    }
  }, [isTouch, touchZoom]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastTouchDistance.current !== null) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );

      const scale = distance / lastTouchDistance.current;
      const newZoom = Math.max(0.5, Math.min(3, initialZoom.current * scale));
      setTouchZoom(newZoom);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    lastTouchDistance.current = null;
  }, []);

  // Reset zoom
  const handleResetZoom = useCallback(() => {
    setTouchZoom(1);
  }, []);
  
  return (
    <Paper
      ref={containerRef}
      elevation={3}
      sx={{
        width: isFullscreen ? '100vw' : width,
        height: isFullscreen ? '100vh' : height,
        position: isFullscreen ? 'fixed' : 'relative',
        top: isFullscreen ? 0 : 'auto',
        left: isFullscreen ? 0 : 'auto',
        zIndex: isFullscreen ? 9999 : 'auto',
        bgcolor: '#000',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'}}
    >
      {/* Toolbar */}
      {showToolbar && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            px: 1,
            py: 0.5,
            bgcolor: 'rgba(0,0,0,0.8)',
            borderBottom: '1px solid rgba(255,255,255,0.1)'}}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <CameraIcon sx={{ color: 'white', fontSize: 20 }} />
            <Typography variant="caption" sx={{ color: 'white' }}>
              Viewfinder
            </Typography>
            {hasCamera && (
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                ({cameraNode?.name || 'Camera'})
              </Typography>
            )}
          </Stack>
          
          <Stack direction="row" spacing={isTouch ? 1 : 0.5}>
            <Tooltip title={isTouch ? '' : 'Take Snapshot'} enterDelay={isTouch ? 99999 : 300}>
              <TouchIconButton 
                touchSize={isTouch ? 'medium' : 'small'} 
                onClick={handleSnapshot} 
                sx={{ color: 'white' }}
              >
                <PhotoIcon fontSize="small" />
              </TouchIconButton>
            </Tooltip>
            
            <Tooltip
              title={isTouch ? '' : isRecording ? 'Stop Recording' : 'Start Recording'}
              enterDelay={isTouch ? 99999 : 300}
            >
              <TouchIconButton
                touchSize={isTouch ? 'medium' : 'small'}
                onClick={isRecording ? stopRecording : startRecording}
                sx={{ color: isRecording ? 'red' : 'white' }}
              >
                {isRecording ? <StopIcon fontSize="small" /> : <RecordIcon fontSize="small" />}
              </TouchIconButton>
            </Tooltip>

            {/* Zoom controls for touch */}
            {isTouch && (
              <>
                <TouchIconButton
                  touchSize="medium"
                  onClick={() => setTouchZoom(Math.min(3, touchZoom * 1.25))}
                  sx={{ color: 'white' }}
                >
                  <ZoomInIcon fontSize="small" />
                </TouchIconButton>
                <TouchIconButton
                  touchSize="medium"
                  onClick={() => setTouchZoom(Math.max(0.5, touchZoom / 1.25))}
                  sx={{ color: 'white' }}
                >
                  <ZoomOutIcon fontSize="small" />
                </TouchIconButton>
                {touchZoom !== 1 && (
                  <TouchIconButton
                    touchSize="medium"
                    onClick={handleResetZoom}
                    sx={{ color: 'white' }}
                  >
                    <ResetIcon fontSize="small" />
                  </TouchIconButton>
                )}
              </>
            )}
            
            <Tooltip title={isTouch ? '' : 'Settings'} enterDelay={isTouch ? 99999 : 300}>
              <TouchIconButton
                touchSize={isTouch ? 'medium' : 'small'}
                onClick={() => setShowSettings(!showSettings)}
                sx={{ color: showSettings ? 'primary.main' : 'white' }}
              >
                <SettingsIcon fontSize="small" />
              </TouchIconButton>
            </Tooltip>
            
            <Tooltip
              title={isTouch ? '' : isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              enterDelay={isTouch ? 99999 : 300}
            >
              <TouchIconButton 
                touchSize={isTouch ? 'medium' : 'small'} 
                onClick={toggleFullscreen} 
                sx={{ color: 'white' }}
              >
                {isFullscreen ? (
                  <FullscreenExitIcon fontSize="small" />
                ) : (
                  <FullscreenIcon fontSize="small" />
                )}
              </TouchIconButton>
            </Tooltip>
          </Stack>
        </Box>
      )}
      
      {/* Settings Panel (Collapsible) */}
      <Collapse in={showSettings}>
        <Box sx={{ bgcolor: 'rgba(30,30,30,0.95)', maxHeight: 200, overflow: 'auto' }}>
          <ViewfinderSettingsPanel
            settings={settings}
            onUpdate={updateSettings}
            sceneLuminance={sceneLuminance}
            onSceneLuminanceChange={setSceneLuminance}
          />
        </Box>
      </Collapse>
      
      {/* Viewfinder Content */}
      <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {/* Letterbox Background */}
        <Box sx={{ position: 'absolute', inset: 0, bgcolor: '#000' }} />
        
        {/* Canvas Container */}
        <Box
          sx={{
            position: 'absolute',
            left: letterbox.x,
            top: letterbox.y,
            width: letterbox.width,
            height: letterbox.height}}
        >
          {/* Main Canvas */}
          <ViewfinderCanvas
            width={letterbox.width}
            height={letterbox.height}
            cameraNode={cameraNode}
            nodes={nodes}
            settings={settings}
            exposure={exposure}
            onHistogramUpdate={settings.showHistogram ? updateHistogram : undefined}
          />
          
          {/* Frame Guides Overlay */}
          {settings.showGuides && letterbox.width > 0 && (
            <FrameGuidesOverlay
              guides={frameGuides}
              width={letterbox.width}
              height={letterbox.height}
            />
          )}
          
          {/* Aspect Ratio Selector */}
          <AspectRatioSelector
            current={settings.aspectRatio}
            onChange={(ratio) => updateSettings({ aspectRatio: ratio })}
          />
          
          {/* Recording Indicator */}
          <RecordingIndicator isRecording={isRecording} duration={recordingDuration} />
          
          {/* Exposure Warning */}
          {exposure && <ExposureWarning exposure={exposure} />}
          
          {/* Focus Indicator */}
          {focus && camera && (
            <FocusIndicator focus={focus} focusDistance={camera.focusDistance} />
          )}
          
          {/* Histogram Overlay */}
          {settings.showHistogram && histogram && (
            <HistogramOverlay
              data={histogram}
              position={settings.histogramPosition}
            />
          )}
          
          {/* Toggle Buttons */}
          <ViewfinderToggleButtons
            settings={settings}
            onSettingsChange={updateSettings}
          />
          
          {/* Camera Info HUD */}
          {settings.showInfo && cameraInfo && exposure && (
            <CameraInfoHUD
              info={cameraInfo}
              exposure={exposure}
              position="bottom"
            />
          )}
        </Box>
        
        {/* Letterbox Bars */}
        <LetterboxOverlay
          containerWidth={containerSize.width}
          containerHeight={containerSize.height - (showToolbar ? 40 : 0) - (showSettings ? 200 : 0)}
          viewportX={letterbox.x}
          viewportY={letterbox.y}
          viewportWidth={letterbox.width}
          viewportHeight={letterbox.height}
        />
      </Box>
    </Paper>
  );
}

// ============================================================================
// Wrapped Export with Provider
// ============================================================================

export default function ViewfinderView(props: ViewfinderViewProps) {
  return (
    <ViewfinderProvider>
      <ViewfinderViewInner {...props} />
    </ViewfinderProvider>
  );
}

// ============================================================================
// Quick Viewfinder Panel (for sidebar)
// ============================================================================

export function ViewfinderPanel() {
  return (
    <Box sx={{ p: 1 }}>
      <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 700}}>
        Camera Viewfinder
      </Typography>
      <ViewfinderView height={300} showToolbar={true} />
    </Box>
  );
}
