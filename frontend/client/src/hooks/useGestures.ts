/**
 * useGestures Hook
 * React hook for gesture functionality
 */

import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { 
  gestureManager, 
  GestureConfig, 
  GestureState, 
  Gesture,
  GestureEvent
} from'../utils/gestureManager';

export interface UseGesturesOptions {
  config?: Partial<GestureConfig>;
  onGestureCreated?: (data: { gesture: Gesture }) => void;
  onGestureRecognized?: (data: { gesture: Gesture; event: TouchEvent | MouseEvent | KeyboardEvent }) => void;
  onGestureExecuted?: (data: { gesture: Gesture; event: GestureEvent }) => void;
  onGestureExecutionFailed?: (data: { gesture: Gesture; event: GestureEvent; error: string }) => void;
  onGestureRecognitionFailed?: (data: { event: TouchEvent | MouseEvent | KeyboardEvent; error: string }) => void;
  onError?: (error: string) => void;
  onInitialized?: () => void}

export interface UseGesturesReturn {
  createGesture: (gestureData: Partial<Gesture>) => Promise<Gesture>;
  recognizeGesture: (event: TouchEvent | MouseEvent | KeyboardEvent) => Promise<Gesture | null>;
  state: GestureState;
  config: GestureConfig;
  updateConfig: (config: Partial<GestureConfig>) => void;
  isEnabled: boolean;
  isInitialized: boolean;
  hasError: boolean;
  error: string | null;
  gestures: Gesture[];
  activeGestures: Gesture[];
  totalGestures: number;
  totalRecognitions: number;
  successfulRecognitions: number;
  failedRecognitions: number;
  averageRecognitionTime: number;
  averageExecutionTime: number;
  averageAccuracy: number;
  totalErrors: number;
  totalConflicts: number;
  totalOverrides: number;
  getGestures: () => Gesture[]}

/**
 * Hook for gesture functionality
 */
export const useGestures = (options: UseGesturesOptions = {}): UseGesturesReturn => {
  const {
    config = {},
    onGestureCreated,
    onGestureRecognized,
    onGestureExecuted,
    onGestureExecutionFailed,
    onGestureRecognitionFailed,
    onError,
    onInitialized
} = options;

  const [state, setState] = useState<GestureState>({
    isEnabled: false,
    isInitialized: false,
    hasError: false,
    error: null,
    gestures: new Map(),
    activeGestures: new Map(),
    lastUpdate: 0,
    totalGestures: 0,
    totalRecognitions: 0,
    successfulRecognitions: 0,
    failedRecognitions: 0,
    averageRecognitionTime: 0,
    averageExecutionTime: 0,
    averageAccuracy: 0,
    totalErrors: 0,
    totalConflicts: 0,
    totalOverrides: 0
});

  const stateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const eventHandlersRef = useRef<Map<string, Function>>(new Map());

  // Initialize gesture manager
  useEffect(() => {
    // Update configuration
    if (Object.keys(config).length > 0) {
      gestureManager.updateConfig(config);
  }

    // Setup event handlers
    const handleGestureCreated = (data: { gesture: Gesture }) => {
      if (onGestureCreated) {
        onGestureCreated(data);
    }
  };

    const handleGestureRecognized = (data: { gesture: Gesture; event: TouchEvent | MouseEvent | KeyboardEvent }) => {
      if (onGestureRecognized) {
        onGestureRecognized(data);
    }
  };

    const handleGestureExecuted = (data: { gesture: Gesture; event: GestureEvent }) => {
      if (onGestureExecuted) {
        onGestureExecuted(data);
    }
  };

    const handleGestureExecutionFailed = (data: { gesture: Gesture; event: GestureEvent; error: string }) => {
      if (onGestureExecutionFailed) {
        onGestureExecutionFailed(data);
    }
  };

    const handleGestureRecognitionFailed = (data: { event: TouchEvent | MouseEvent | KeyboardEvent; error: string }) => {
      if (onGestureRecognitionFailed) {
        onGestureRecognitionFailed(data);
    }
  };

    const handleError = (data: { error: string }) => {
      if (onError) {
        onError(data.error);
    }
  };

    const handleInitialized = () => {
      if (onInitialized) {
        onInitialized();
    }
  };

    // Store event handlers
    eventHandlersRef.current.set('gesture_created', handleGestureCreated);
    eventHandlersRef.current.set('gesture_recognized', handleGestureRecognized);
    eventHandlersRef.current.set('gesture_executed', handleGestureExecuted);
    eventHandlersRef.current.set('gesture_execution_failed', handleGestureExecutionFailed);
    eventHandlersRef.current.set('gesture_recognition_failed', handleGestureRecognitionFailed);
    eventHandlersRef.current.set('error', handleError);
    eventHandlersRef.current.set('initialized', handleInitialized);

    // Add event listeners
    gestureManager.on('gesture_created', handleGestureCreated);
    gestureManager.on('gesture_recognized', handleGestureRecognized);
    gestureManager.on('gesture_executed', handleGestureExecuted);
    gestureManager.on('gesture_execution_failed', handleGestureExecutionFailed);
    gestureManager.on('gesture_recognition_failed', handleGestureRecognitionFailed);
    gestureManager.on('error', handleError);
    gestureManager.on('initialized', handleInitialized);

    // Update initial state
    setState(gestureManager.getState());

    return () => {
      // Remove event listeners
      eventHandlersRef.current.forEach((handler, event) => {
        gestureManager.off(event, handler);
    });
      eventHandlersRef.current.clear();
  };
}, [config, onGestureCreated, onGestureRecognized, onGestureExecuted, onGestureExecutionFailed, onGestureRecognitionFailed, onError, onInitialized]);

  // Setup state monitoring
  useEffect(() => {
    stateIntervalRef.current = setInterval(() => {
      const currentState = gestureManager.getState();
      setState(currentState);
  }, 100);

    return () => {
      if (stateIntervalRef.current) {
        clearInterval(stateIntervalRef.current);
    }
  };
}, []);

  // Create gesture
  const createGesture = useCallback(async (gestureData: Partial<Gesture>) => {
    return await gestureManager.createGesture(gestureData);
}, []);

  // Recognize gesture
  const recognizeGesture = useCallback(async (event: TouchEvent | MouseEvent | KeyboardEvent) => {
    return await gestureManager.recognizeGesture(event);
}, []);

  // Update configuration
  const updateConfig = useCallback((newConfig: Partial<GestureConfig>) => {
    gestureManager.updateConfig(newConfig);
}, []);

  // Get configuration
  const config = useMemo(() => {
    return gestureManager.getConfig();
}, []);

  // Get gestures
  const getGestures = useCallback(() => {
    return gestureManager.getGestures();
}, []);

  // Memoized return value
  const returnValue = useMemo(() => ({
    createGesture,
    recognizeGesture,
    state,
    config,
    updateConfig,
    isEnabled: state.isEnabled,
    isInitialized: state.isInitialized,
    hasError: state.hasError,
    error: state.error,
    gestures: Array.from(state.gestures.values(, ), ),
    activeGestures: Array.from(state.activeGestures.values(, ), ),
    totalGestures: state.totalGestures,
    totalRecognitions: state.totalRecognitions,
    successfulRecognitions: state.successfulRecognitions,
    failedRecognitions: state.failedRecognitions,
    averageRecognitionTime: state.averageRecognitionTime,
    averageExecutionTime: state.averageExecutionTime,
    averageAccuracy: state.averageAccuracy,
    totalErrors: state.totalErrors,
    totalConflicts: state.totalConflicts,
    totalOverrides: state.totalOverrides,
    getGestures
}), [
    createGesture,
    recognizeGesture,
    state,
    config,
    updateConfig,
    getGestures
  ]);

  return returnValue;
};

export default useGestures;





