/**
 * useTouchGestures - Comprehensive touch gesture support for iPad/tablet
 * 
 * Gestures:
 * - Pinch-to-zoom
 * - Two-finger pan
 * - Swipe (horizontal/vertical)
 * - Long-press (context menu)
 * - Double-tap (quick actions)
 * - Single tap (selection)
 */

import { useRef, useCallback, useEffect, useState } from 'react';

// =============================================================================
// Types
// =============================================================================

export interface Point {
  x: number;
  y: number;
}

export interface GestureState {
  // Pinch
  scale: number;
  initialScale: number;
  // Pan
  translateX: number;
  translateY: number;
  // Touch info
  touchCount: number;
  isGesturing: boolean;
}

export interface SwipeDirection {
  horizontal: 'left' | 'right' | null;
  vertical: 'up' | 'down' | null;
}

export interface TouchGestureCallbacks {
  // Pinch zoom
  onPinchStart?: (scale: number, center: Point) => void;
  onPinch?: (scale: number, center: Point) => void;
  onPinchEnd?: (finalScale: number) => void;
  
  // Two-finger pan
  onPanStart?: (point: Point) => void;
  onPan?: (delta: Point, point: Point) => void;
  onPanEnd?: () => void;
  
  // Swipe
  onSwipe?: (direction: SwipeDirection, velocity: number) => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  
  // Long press (context menu)
  onLongPress?: (point: Point, element: HTMLElement) => void;
  
  // Double tap
  onDoubleTap?: (point: Point) => void;
  
  // Single tap
  onTap?: (point: Point) => void;
}

export interface UseTouchGesturesOptions {
  // Minimum distance to trigger swipe (px)
  swipeThreshold?: number;
  // Minimum velocity for swipe (px/ms)
  swipeVelocityThreshold?: number;
  // Long press duration (ms)
  longPressDuration?: number;
  // Double tap max interval (ms)
  doubleTapInterval?: number;
  // Minimum scale change to trigger pinch
  pinchThreshold?: number;
  // Enable/disable specific gestures
  enablePinch?: boolean;
  enablePan?: boolean;
  enableSwipe?: boolean;
  enableLongPress?: boolean;
  enableDoubleTap?: boolean;
}

export interface UseTouchGesturesReturn {
  // Ref to attach to element
  ref: React.RefObject<HTMLElement>;
  // Current gesture state
  gestureState: GestureState;
  // Is currently in a gesture
  isGesturing: boolean;
  // Reset gesture state
  reset: () => void;
  // Touch event handlers (for manual attachment)
  handlers: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
    onTouchCancel: (e: React.TouchEvent) => void;
  };
}

// =============================================================================
// Utilities
// =============================================================================

const getDistance = (p1: Point, p2: Point): number => {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
};

const getCenter = (p1: Point, p2: Point): Point => ({
  x: (p1.x + p2.x) / 2,
  y: (p1.y + p2.y) / 2,
});

const getTouchPoint = (touch: Touch): Point => ({
  x: touch.clientX,
  y: touch.clientY,
});

// =============================================================================
// Hook Implementation
// =============================================================================

const DEFAULT_OPTIONS: Required<UseTouchGesturesOptions> = {
  swipeThreshold: 50,
  swipeVelocityThreshold: 0.3,
  longPressDuration: 500,
  doubleTapInterval: 300,
  pinchThreshold: 0.02,
  enablePinch: true,
  enablePan: true,
  enableSwipe: true,
  enableLongPress: true,
  enableDoubleTap: true,
};

export const useTouchGestures = (
  callbacks: TouchGestureCallbacks,
  options: UseTouchGesturesOptions = {}
): UseTouchGesturesReturn => {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const ref = useRef<HTMLElement>(null);
  
  // Gesture state
  const [gestureState, setGestureState] = useState<GestureState>({
    scale: 1,
    initialScale: 1,
    translateX: 0,
    translateY: 0,
    touchCount: 0,
    isGesturing: false,
  });
  
  // Internal refs for tracking
  const touchStartTime = useRef<number>(0);
  const touchStartPoint = useRef<Point | null>(null);
  const lastTapTime = useRef<number>(0);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const initialPinchDistance = useRef<number>(0);
  const lastPanPoint = useRef<Point | null>(null);
  const isPinching = useRef(false);
  const isPanning = useRef(false);
  const gestureStarted = useRef(false);
  
  // Clear long press timer
  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);
  
  // Reset all state
  const reset = useCallback(() => {
    setGestureState({
      scale: 1,
      initialScale: 1,
      translateX: 0,
      translateY: 0,
      touchCount: 0,
      isGesturing: false,
    });
    clearLongPress();
    isPinching.current = false;
    isPanning.current = false;
    gestureStarted.current = false;
  }, [clearLongPress]);
  
  // Touch Start Handler
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touches = e.touches;
    const touchCount = touches.length;
    
    touchStartTime.current = Date.now();
    setGestureState(prev => ({ ...prev, touchCount }));
    
    if (touchCount === 1) {
      // Single finger touch
      const point = getTouchPoint(touches[0]);
      touchStartPoint.current = point;
      
      // Check for double tap
      if (opts.enableDoubleTap) {
        const now = Date.now();
        if (now - lastTapTime.current < opts.doubleTapInterval) {
          // Double tap detected
          callbacks.onDoubleTap?.(point);
          lastTapTime.current = 0;
          return;
        }
      }
      
      // Start long press timer
      if (opts.enableLongPress) {
        clearLongPress();
        longPressTimer.current = setTimeout(() => {
          if (touchStartPoint.current) {
            callbacks.onLongPress?.(touchStartPoint.current, e.target as HTMLElement);
            gestureStarted.current = true;
          }
        }, opts.longPressDuration);
      }
    } else if (touchCount === 2) {
      // Two finger touch - prepare for pinch or pan
      clearLongPress();
      gestureStarted.current = true;
      
      const p1 = getTouchPoint(touches[0]);
      const p2 = getTouchPoint(touches[1]);
      
      if (opts.enablePinch) {
        initialPinchDistance.current = getDistance(p1, p2);
        setGestureState(prev => ({ ...prev, initialScale: prev.scale }));
        callbacks.onPinchStart?.(gestureState.scale, getCenter(p1, p2));
        isPinching.current = true;
      }
      
      if (opts.enablePan) {
        const center = getCenter(p1, p2);
        lastPanPoint.current = center;
        callbacks.onPanStart?.(center);
        isPanning.current = true;
      }
      
      setGestureState(prev => ({ ...prev, isGesturing: true }));
    }
  }, [opts, callbacks, gestureState.scale, clearLongPress]);
  
  // Touch Move Handler
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touches = e.touches;
    const touchCount = touches.length;
    
    // Cancel long press on movement
    if (touchStartPoint.current) {
      const currentPoint = getTouchPoint(touches[0]);
      const distance = getDistance(touchStartPoint.current, currentPoint);
      if (distance > 10) {
        clearLongPress();
      }
    }
    
    if (touchCount === 2) {
      const p1 = getTouchPoint(touches[0]);
      const p2 = getTouchPoint(touches[1]);
      
      // Handle pinch
      if (opts.enablePinch && isPinching.current && initialPinchDistance.current > 0) {
        const currentDistance = getDistance(p1, p2);
        const scaleChange = currentDistance / initialPinchDistance.current;
        const newScale = gestureState.initialScale * scaleChange;
        
        if (Math.abs(scaleChange - 1) > opts.pinchThreshold) {
          setGestureState(prev => ({ ...prev, scale: newScale }));
          callbacks.onPinch?.(newScale, getCenter(p1, p2));
        }
      }
      
      // Handle pan
      if (opts.enablePan && isPanning.current && lastPanPoint.current) {
        const center = getCenter(p1, p2);
        const deltaX = center.x - lastPanPoint.current.x;
        const deltaY = center.y - lastPanPoint.current.y;
        
        setGestureState(prev => ({
          ...prev,
          translateX: prev.translateX + deltaX,
          translateY: prev.translateY + deltaY,
        }));
        
        callbacks.onPan?.({ x: deltaX, y: deltaY }, center);
        lastPanPoint.current = center;
      }
      
      // Prevent default to stop page scrolling during gesture
      e.preventDefault();
    }
  }, [opts, callbacks, gestureState.initialScale, clearLongPress]);
  
  // Touch End Handler
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const touchDuration = Date.now() - touchStartTime.current;
    const touches = e.changedTouches;
    
    clearLongPress();
    
    // Handle pinch end
    if (isPinching.current) {
      callbacks.onPinchEnd?.(gestureState.scale);
      isPinching.current = false;
    }
    
    // Handle pan end
    if (isPanning.current) {
      callbacks.onPanEnd?.();
      isPanning.current = false;
    }
    
    // Handle swipe detection
    if (opts.enableSwipe && touchStartPoint.current && touches.length > 0 && !gestureStarted.current) {
      const endPoint = getTouchPoint(touches[0]);
      const deltaX = endPoint.x - touchStartPoint.current.x;
      const deltaY = endPoint.y - touchStartPoint.current.y;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      const velocity = distance / touchDuration;
      
      if (distance > opts.swipeThreshold && velocity > opts.swipeVelocityThreshold) {
        const direction: SwipeDirection = {
          horizontal: Math.abs(deltaX) > Math.abs(deltaY)
            ? (deltaX > 0 ? 'right' : 'left')
            : null,
          vertical: Math.abs(deltaY) > Math.abs(deltaX)
            ? (deltaY > 0 ? 'down' : 'up')
            : null,
        };
        
        callbacks.onSwipe?.(direction, velocity);
        
        if (direction.horizontal === 'left') callbacks.onSwipeLeft?.();
        if (direction.horizontal === 'right') callbacks.onSwipeRight?.();
        if (direction.vertical === 'up') callbacks.onSwipeUp?.();
        if (direction.vertical === 'down') callbacks.onSwipeDown?.();
      }
    }
    
    // Handle tap
    if (
      !gestureStarted.current &&
      touchDuration < opts.longPressDuration &&
      touchStartPoint.current
    ) {
      const endPoint = getTouchPoint(touches[0]);
      const distance = getDistance(touchStartPoint.current, endPoint);
      
      if (distance < 10) {
        // It's a tap
        callbacks.onTap?.(touchStartPoint.current);
        lastTapTime.current = Date.now();
      }
    }
    
    // Reset if no more touches
    if (e.touches.length === 0) {
      setGestureState(prev => ({ ...prev, touchCount: 0, isGesturing: false }));
      gestureStarted.current = false;
      touchStartPoint.current = null;
      lastPanPoint.current = null;
      initialPinchDistance.current = 0;
    }
  }, [opts, callbacks, gestureState.scale, clearLongPress]);
  
  // Touch Cancel Handler
  const handleTouchCancel = useCallback(() => {
    clearLongPress();
    reset();
  }, [clearLongPress, reset]);
  
  // Attach handlers to ref element
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    
    const touchStartHandler = (e: TouchEvent) => {
      handleTouchStart(e as unknown as React.TouchEvent);
    };
    const touchMoveHandler = (e: TouchEvent) => {
      handleTouchMove(e as unknown as React.TouchEvent);
    };
    const touchEndHandler = (e: TouchEvent) => {
      handleTouchEnd(e as unknown as React.TouchEvent);
    };
    const touchCancelHandler = () => {
      handleTouchCancel();
    };
    
    element.addEventListener('touchstart', touchStartHandler, { passive: false });
    element.addEventListener('touchmove', touchMoveHandler, { passive: false });
    element.addEventListener('touchend', touchEndHandler, { passive: false });
    element.addEventListener('touchcancel', touchCancelHandler, { passive: false });
    
    return () => {
      element.removeEventListener('touchstart', touchStartHandler);
      element.removeEventListener('touchmove', touchMoveHandler);
      element.removeEventListener('touchend', touchEndHandler);
      element.removeEventListener('touchcancel', touchCancelHandler);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, handleTouchCancel]);
  
  return {
    ref: ref as React.RefObject<HTMLElement>,
    gestureState,
    isGesturing: gestureState.isGesturing,
    reset,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onTouchCancel: handleTouchCancel,
    },
  };
};

// =============================================================================
// Specialized Hooks
// =============================================================================

/**
 * usePinchZoom - Simplified hook for pinch-to-zoom only
 */
export interface UsePinchZoomOptions {
  minScale?: number;
  maxScale?: number;
  initialScale?: number;
  onScaleChange?: (scale: number) => void;
}

export interface UsePinchZoomReturn {
  ref: React.RefObject<HTMLElement>;
  scale: number;
  setScale: (scale: number) => void;
  reset: () => void;
}

export const usePinchZoom = (options: UsePinchZoomOptions = {}): UsePinchZoomReturn => {
  const { minScale = 0.5, maxScale = 3, initialScale = 1, onScaleChange } = options;
  const [scale, setScaleState] = useState(initialScale);
  
  const setScale = useCallback((newScale: number) => {
    const clampedScale = Math.min(maxScale, Math.max(minScale, newScale));
    setScaleState(clampedScale);
    onScaleChange?.(clampedScale);
  }, [minScale, maxScale, onScaleChange]);
  
  const { ref, reset: resetGestures } = useTouchGestures({
    onPinch: (newScale) => {
      setScale(newScale);
    },
  }, {
    enablePan: false,
    enableSwipe: false,
    enableLongPress: false,
    enableDoubleTap: false,
  });
  
  const reset = useCallback(() => {
    setScaleState(initialScale);
    resetGestures();
  }, [initialScale, resetGestures]);
  
  return {
    ref: ref as React.RefObject<HTMLElement>,
    scale,
    setScale,
    reset,
  };
};

/**
 * useSwipeNavigation - Simplified hook for swipe navigation
 */
export interface UseSwipeNavigationOptions {
  onNext?: () => void;
  onPrevious?: () => void;
  direction?: 'horizontal' | 'vertical';
}

export const useSwipeNavigation = (options: UseSwipeNavigationOptions = {}) => {
  const { onNext, onPrevious, direction = 'horizontal' } = options;
  
  const { ref, handlers } = useTouchGestures({
    onSwipeLeft: direction === 'horizontal' ? onNext : undefined,
    onSwipeRight: direction === 'horizontal' ? onPrevious : undefined,
    onSwipeUp: direction === 'vertical' ? onNext : undefined,
    onSwipeDown: direction ==='vertical' ? onPrevious : undefined,
  }, {
    enablePinch: false,
    enablePan: false,
    enableLongPress: false,
    enableDoubleTap: false,
  });
  
  return { ref, handlers };
};

/**
 * useLongPressMenu - Hook for long-press context menu
 */
export interface UseLongPressMenuOptions {
  onOpen: (point: Point, element: HTMLElement) => void;
  duration?: number;
}

export const useLongPressMenu = (options: UseLongPressMenuOptions) => {
  const { onOpen, duration = 500 } = options;
  
  const { ref, handlers } = useTouchGestures({
    onLongPress: onOpen,
  }, {
    enablePinch: false,
    enablePan: false,
    enableSwipe: false,
    enableDoubleTap: false,
    longPressDuration: duration,
  });
  
  return { ref, handlers };
};

export default useTouchGestures;

