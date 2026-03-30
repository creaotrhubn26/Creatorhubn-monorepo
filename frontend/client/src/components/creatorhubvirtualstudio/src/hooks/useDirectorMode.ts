/**
 * useDirectorMode Hook
 * 
 * Provides easy access to Director Mode functionality.
 * Handles state management, keyboard shortcuts, and service connections.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  directorModeService,
  type DirectorModeState,
} from '../core/services/directorModeService';
import {
  multiCameraRecordingService,
  type CameraRecording,
} from '../core/services/multiCameraRecordingService';
import {
  monitorFeedService,
  type MonitorLayout,
} from '../core/services/monitorFeedService';

// ============================================================================
// Types
// ============================================================================

export interface DirectorModeHookState {
  // Director Mode state
  isActive: boolean;
  isAnimating: boolean;
  monitorId: string | null;
  monitorName: string;
  
  // Recording state
  isRecording: boolean;
  recordingTime: number;
  completedRecordings: CameraRecording[];
  
  // Layout state
  layout: MonitorLayout;
  
  // Selected camera
  selectedCameraId: string | null;
}

export interface DirectorModeHookActions {
  // Director Mode
  enterDirectorMode: (monitorId: string) => boolean;
  exitDirectorMode: () => boolean;
  
  // Layout
  setLayout: (layout: MonitorLayout) => void;
  
  // Camera selection
  selectCamera: (cameraId: string) => void;
  cycleCamera: () => void;
  
  // Camera controls
  moveCamera: (direction: 'forward' | 'backward' | 'left' | 'right' | 'up' | 'down', speed?: number) => void;
  rotateCamera: (axis: 'pan' | 'tilt' | 'roll', amount?: number) => void;
  zoomCamera: (amount?: number) => void;
  resetCamera: () => void;
  
  // Recording
  startRecording: () => Promise<boolean>;
  stopRecording: () => Promise<CameraRecording[]>;
  toggleRecording: () => Promise<void>;
  downloadRecording: (recording: CameraRecording) => void;
  downloadAllRecordings: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useDirectorMode(): [DirectorModeHookState, DirectorModeHookActions] {
  // State
  const [directorState, setDirectorState] = useState<DirectorModeState>(directorModeService.getState());
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [completedRecordings, setCompletedRecordings] = useState<CameraRecording[]>([]);
  const [layout, setLayoutState] = useState<MonitorLayout>('single');
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  
  // Subscribe to director mode state
  useEffect(() => {
    const unsubscribe = directorModeService.subscribe((state) => {
      setDirectorState(state);
    });
    return () => {
      unsubscribe();
    };
  }, []);
  
  // Subscribe to recording state
  useEffect(() => {
    const unsubscribe = multiCameraRecordingService.subscribe((state) => {
      setIsRecording(state.isRecording);
      setRecordingTime(state.elapsedTime);
    });
    return () => {
      unsubscribe();
    };
  }, []);
  
  // Actions
  const enterDirectorMode = useCallback((monitorId: string) => {
    return directorModeService.enterDirectorMode(monitorId);
  }, []);
  
  const exitDirectorMode = useCallback(() => {
    return directorModeService.exitDirectorMode();
  }, []);
  
  const setLayout = useCallback((newLayout: MonitorLayout) => {
    setLayoutState(newLayout);
    const renderer = monitorFeedService.getRenderer();
    if (renderer) {
      renderer.setConfig({ layout: newLayout });
    }
  }, []);
  
  const selectCamera = useCallback((cameraId: string) => {
    setSelectedCameraId(cameraId);
    const renderer = monitorFeedService.getRenderer();
    if (renderer) {
      renderer.setActiveCamera(cameraId);
    }
  }, []);
  
  const cycleCamera = useCallback(() => {
    const renderer = monitorFeedService.getRenderer();
    if (renderer) {
      renderer.cycleCamera();
    }
  }, []);
  
  const moveCamera = useCallback((direction: 'forward' | 'backward' | 'left' | 'right' | 'up' | 'down', speed = 0.5) => {
    if (!selectedCameraId) return;
    window.dispatchEvent(new CustomEvent('vs-camera-move', {
      detail: { cameraId: selectedCameraId, direction, speed },
    }));
  }, [selectedCameraId]);
  
  const rotateCamera = useCallback((axis: 'pan' | 'tilt' |'roll', amount = 2) => {
    if (!selectedCameraId) return;
    window.dispatchEvent(new CustomEvent('vs-camera-rotate', {
      detail: { cameraId: selectedCameraId, axis, amount },
    }));
  }, [selectedCameraId]);
  
  const zoomCamera = useCallback((amount = 0.1) => {
    if (!selectedCameraId) return;
    window.dispatchEvent(new CustomEvent('vs-camera-zoom', {
      detail: { cameraId: selectedCameraId, amount },
    }));
  }, [selectedCameraId]);
  
  const resetCamera = useCallback(() => {
    if (!selectedCameraId) return;
    window.dispatchEvent(new CustomEvent('vs-camera-reset', {
      detail: { cameraId: selectedCameraId },
    }));
  }, [selectedCameraId]);
  
  const startRecording = useCallback(async () => {
    return await multiCameraRecordingService.startAllCameras();
  }, []);
  
  const stopRecording = useCallback(async () => {
    const recordings = await multiCameraRecordingService.stopAllCameras();
    setCompletedRecordings(prev => [...prev, ...recordings]);
    return recordings;
  }, []);
  
  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);
  
  const downloadRecording = useCallback((recording: CameraRecording) => {
    multiCameraRecordingService.downloadRecording(recording);
  }, []);
  
  const downloadAllRecordings = useCallback(() => {
    completedRecordings.forEach(rec => {
      if (rec.blob) {
        multiCameraRecordingService.downloadRecording(rec);
      }
    });
  }, [completedRecordings]);
  
  // Compose state and actions
  const state: DirectorModeHookState = {
    isActive: directorState.isActive,
    isAnimating: directorState.isAnimating,
    monitorId: directorState.monitorId,
    monitorName: directorState.monitorName,
    isRecording,
    recordingTime,
    completedRecordings,
    layout,
    selectedCameraId,
  };
  
  const actions: DirectorModeHookActions = {
    enterDirectorMode,
    exitDirectorMode,
    setLayout,
    selectCamera,
    cycleCamera,
    moveCamera,
    rotateCamera,
    zoomCamera,
    resetCamera,
    startRecording,
    stopRecording,
    toggleRecording,
    downloadRecording,
    downloadAllRecordings,
  };
  
  return [state, actions];
}

export default useDirectorMode;
