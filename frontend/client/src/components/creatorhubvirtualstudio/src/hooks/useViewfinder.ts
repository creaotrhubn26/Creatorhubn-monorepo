/**
 * useViewfinder - React Hook for Viewfinder State Management
 * 
 * Provides:
 * - Viewfinder settings management
 * - Camera state sync
 * - Exposure calculations
 * - DOF calculations
 * - Histogram generation
 * - Real-time updates
 */

import {
  createElement,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useNodes } from '../state/selectors';
import { getActiveCameraId } from '../core/services/viewports';
import {
  DEFAULT_VIEWFINDER_SETTINGS,
  calculateExposureInfo,
  calculateDOF,
  formatCameraInfo,
  generateFrameGuides,
  generateHistogramFromImageData,
  calculateLetterbox,
  getAspectRatioDimensions,
  type ViewfinderSettings,
  type CameraState,
  type ExposureInfo,
  type FocusInfo,
  type CameraInfoDisplay,
  type HistogramData,
  type FrameGuide,
} from '../core/rendering/ViewfinderRenderer';
import { findLensSpec, type LensSpec } from '../core/data/LensSpecifications';

// ============================================================================
// Types
// ============================================================================

export interface UseViewfinderReturn {
  // Settings
  settings: ViewfinderSettings;
  updateSettings: (updates: Partial<ViewfinderSettings>) => void;
  resetSettings: () => void;
  
  // Camera State
  camera: CameraState | null;
  cameraNode: any | null;
  hasCamera: boolean;
  
  // Calculated Values
  exposure: ExposureInfo | null;
  focus: FocusInfo | null;
  cameraInfo: CameraInfoDisplay | null;
  
  // Histogram
  histogram: HistogramData | null;
  updateHistogram: (imageData: ImageData) => void;
  
  // Frame Guides
  getFrameGuides: (width: number, height: number) => FrameGuide[];
  getLetterbox: (containerWidth: number, containerHeight: number) => ReturnType<typeof calculateLetterbox>;
  
  // Render Control
  sceneLuminance: number;
  setSceneLuminance: (value: number) => void;
  
  // Fullscreen
  isFullscreen: boolean;
  toggleFullscreen: () => void;
  
  // Recording (for future use)
  isRecording: boolean;
  recordingDuration: number;
  startRecording: () => void;
  stopRecording: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useViewfinder(): UseViewfinderReturn {
  const nodes = useNodes();
  
  // Settings state
  const [settings, setSettings] = useState<ViewfinderSettings>(DEFAULT_VIEWFINDER_SETTINGS);
  
  // Scene luminance (for exposure calculation)
  const [sceneLuminance, setSceneLuminance] = useState<number>(500);
  
  // Histogram data
  const [histogram, setHistogram] = useState<HistogramData | null>(null);
  
  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const isLensSpec = useCallback((lensSpec: Partial<LensSpec> | null | undefined): lensSpec is LensSpec => {
    return Boolean(
      lensSpec &&
      lensSpec.id &&
      lensSpec.brand &&
      lensSpec.model &&
      lensSpec.mount &&
      lensSpec.focalLength !== undefined &&
      lensSpec.isZoom !== undefined &&
      lensSpec.maxAperture !== undefined &&
      lensSpec.minAperture !== undefined &&
      lensSpec.apertureBlades !== undefined &&
      lensSpec.elements !== undefined &&
      lensSpec.groups !== undefined &&
      lensSpec.minFocusDistance !== undefined &&
      lensSpec.maxMagnification !== undefined &&
      lensSpec.autofocus !== undefined &&
      lensSpec.stabilization !== undefined &&
      lensSpec.length !== undefined &&
      lensSpec.diameter !== undefined &&
      lensSpec.weight !== undefined
    );
  }, []);
  
  // Find active camera
  const activeCameraId = getActiveCameraId();
  const cameraNode = useMemo(() => {
    if (activeCameraId) {
      return nodes.find((n) => n.id === activeCameraId);
    }
    return nodes.find((n) => n.camera);
  }, [nodes, activeCameraId]);
  
  // Build camera state from node
  const camera = useMemo<CameraState | null>(() => {
    if (!cameraNode?.camera) return null;
    
    const cam = cameraNode.camera;
    const userData = cameraNode.userData || {};
    const transform = cameraNode.transform || { position: [0, 1.7, 3], rotation: [0, 0, 0] };
    
    // Try to get lens spec from userData
    let lensSpec = isLensSpec(userData.lensSpecs) ? userData.lensSpecs : undefined;
    if (!lensSpec && userData.attachedLens?.brand && userData.attachedLens?.model) {
      lensSpec = findLensSpec(userData.attachedLens.brand, userData.attachedLens.model) ?? undefined;
    }
    
    return {
      aperture: cam.aperture || 2.8,
      shutter: cam.shutter || 1 / 125,
      iso: cam.iso || 100,
      focalLength: cam.focalLength || 50,
      focusDistance: userData.focusDistance || cam.focusDistance || 3.0,
      sensor: cam.sensor || [36, 24],
      position: transform.position,
      rotation: transform.rotation,
      lensSpec,
    };
  }, [cameraNode, isLensSpec]);
  
  // Calculate exposure info
  const exposure = useMemo<ExposureInfo | null>(() => {
    if (!camera) return null;
    return calculateExposureInfo(camera, sceneLuminance);
  }, [camera, sceneLuminance]);
  
  // Calculate DOF info
  const focus = useMemo<FocusInfo | null>(() => {
    if (!camera) return null;
    return calculateDOF(camera);
  }, [camera]);
  
  // Format camera info for display
  const cameraInfo = useMemo<CameraInfoDisplay | null>(() => {
    if (!camera || !exposure || !focus) return null;
    return formatCameraInfo(camera, exposure, focus);
  }, [camera, exposure, focus]);
  
  // Update settings
  const updateSettings = useCallback((updates: Partial<ViewfinderSettings>) => {
    setSettings((prev) => ({ ...prev, ...updates }));
  }, []);
  
  // Reset settings
  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_VIEWFINDER_SETTINGS);
  }, []);
  
  // Update histogram from image data
  const updateHistogram = useCallback((imageData: ImageData) => {
    const histData = generateHistogramFromImageData(imageData);
    setHistogram(histData);
  }, []);
  
  // Get frame guides
  const getFrameGuides = useCallback((width: number, height: number): FrameGuide[] => {
    if (!settings.showGuides) return [];
    return generateFrameGuides(settings.guideType, width, height);
  }, [settings.showGuides, settings.guideType]);
  
  // Get letterbox dimensions
  const getLetterbox = useCallback((containerWidth: number, containerHeight: number) => {
    const ratio = getAspectRatioDimensions(settings.aspectRatio, settings.customAspectRatio);
    return calculateLetterbox(containerWidth, containerHeight, ratio);
  }, [settings.aspectRatio, settings.customAspectRatio]);
  
  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);
  
  // Recording controls
  const startRecording = useCallback(() => {
    setIsRecording(true);
    setRecordingDuration(0);
    recordingTimerRef.current = setInterval(() => {
      setRecordingDuration((prev) => prev + 1);
    }, 1000);
  }, []);
  
  const stopRecording = useCallback(() => {
    setIsRecording(false);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);
  
  // Estimate scene luminance from lights
  useEffect(() => {
    const lights = nodes.filter((n) => n.light);
    if (lights.length === 0) {
      setSceneLuminance(200); // Low ambient
      return;
    }
    
    // Sum up light power contributions
    let totalPower = 0;
    lights.forEach((light) => {
      const power = light.light?.power || 0.5;
      const wattage = light.userData?.wattage || power * 1000;
      totalPower += wattage;
    });
    
    // Rough luminance estimate based on total power
    // 500W ~ EV 10, 1000W ~ EV 12, 2000W ~ EV 14
    const estimatedLuminance = Math.min(10000, totalPower * 2);
    setSceneLuminance(Math.max(100, estimatedLuminance));
  }, [nodes]);
  
  return {
    settings,
    updateSettings,
    resetSettings,
    camera,
    cameraNode,
    hasCamera: !!camera,
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
  };
}

// ============================================================================
// Viewfinder Context (for sharing state across components)
// ============================================================================

const ViewfinderContext = createContext<UseViewfinderReturn | null>(null);

export function ViewfinderProvider({ children }: { children: ReactNode }) {
  const viewfinder = useViewfinder();

  return createElement(ViewfinderContext.Provider, { value: viewfinder }, children);
}

export function useViewfinderContext(): UseViewfinderReturn {
  const context = useContext(ViewfinderContext);
  if (!context) {
    throw new Error('useViewfinderContext must be used within a ViewfinderProvider');
  }
  return context;
}
