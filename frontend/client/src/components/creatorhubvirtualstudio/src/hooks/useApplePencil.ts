/**
 * useApplePencil - Apple Pencil support with pressure, tilt, and palm rejection
 * 
 * Features:
 * - Detect Apple Pencil vs finger touch
 * - Pressure sensitivity (0-1)
 * - Tilt detection (altitude & azimuth angles)
 * - Palm rejection (only respond to pencil when drawing)
 * - Hover detection (Pencil 2 when hovering near screen)
 * - Double-tap gesture (Pencil 2)
 * 
 * Uses Pointer Events API which is supported on Safari/iOS 13+
 */

import { useRef, useCallback, useEffect, useState } from 'react';

// =============================================================================
// Types
// =============================================================================

export interface PencilPoint {
  x: number;
  y: number;
  pressure: number;      // 0-1, how hard pencil is pressed
  tiltX: number;         // -90 to 90 degrees, tilt along X axis
  tiltY: number;         // -90 to 90 degrees, tilt along Y axis
  azimuthAngle: number;  // 0 to 2π, rotation around Z axis
  altitudeAngle: number; // 0 to π/2, angle from surface
  twist: number;         // 0 to 359, rotation of pencil
  timestamp: number;
}

export interface PencilStroke {
  id: string;
  points: PencilPoint[];
  startTime: number;
  endTime?: number;
}

export type InputType = 'pencil' | 'touch' | 'mouse';

export interface PencilState {
  isActive: boolean;           // Pencil is currently drawing
  isHovering: boolean;         // Pencil is hovering (Pencil 2)
  isPencilConnected: boolean;  // A pencil has been detected
  currentPressure: number;
  currentTilt: { x: number; y: number };
  inputType: InputType | null;
}

export interface PencilCallbacks {
  // Drawing events
  onStrokeStart?: (point: PencilPoint, inputType: InputType) => void;
  onStrokeMove?: (point: PencilPoint, inputType: InputType) => void;
  onStrokeEnd?: (stroke: PencilStroke, inputType: InputType) => void;
  
  // Hover events (Pencil 2)
  onHoverStart?: (point: PencilPoint) => void;
  onHoverMove?: (point: PencilPoint) => void;
  onHoverEnd?: () => void;
  
  // Pencil 2 double-tap
  onDoubleTap?: () => void;
  
  // Input type change
  onInputTypeChange?: (type: InputType) => void;
}

export interface UseApplePencilOptions {
  // Palm rejection mode
  palmRejection?: 'off' | 'pencil-only' | 'smart';
  
  // Minimum pressure to register (filter accidental touches)
  minPressure?: number;
  
  // Smoothing factor for pressure (0-1, higher = smoother)
  pressureSmoothing?: number;
  
  // Enable hover detection
  enableHover?: boolean;
  
  // Enable double-tap detection
  enableDoubleTap?: boolean;
  
  // Custom pressure curve (for feel adjustment)
  pressureCurve?: (pressure: number) => number;
}

export interface UseApplePencilReturn {
  ref: React.RefObject<HTMLElement>;
  state: PencilState;
  currentStroke: PencilStroke | null;
  
  // Pressure-based calculations
  getStrokeWidth: (basWidth: number) => number;
  getOpacity: (baseOpacity: number) => number;
  
  // Tilt-based calculations
  getTiltAngle: () => number;
  getTiltDirection: () => { x: number; y: number };
  
  // Manual control
  cancelStroke: () => void;
  
  // Handlers for manual attachment
  handlers: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: (e: React.PointerEvent) => void;
    onPointerCancel: (e: React.PointerEvent) => void;
    onPointerEnter: (e: React.PointerEvent) => void;
    onPointerLeave: (e: React.PointerEvent) => void;
  };
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Detect if pointer event is from Apple Pencil
 */
const isPencilInput = (e: PointerEvent | React.PointerEvent): boolean => {
  // Apple Pencil reports as 'pen' pointer type
  if (e.pointerType === 'pen') return true;
  
  // Additional check: pencil has pressure > 0 and tilt
  if (e.pointerType === 'touch' && e.pressure > 0 && e.pressure < 1) {
    // Could be pencil with pressure, but likely just touch
    // Pencil typically has more precise pressure values
    return false;
  }
  
  return false;
};

/**
 * Get input type from pointer event
 */
const getInputType = (e: PointerEvent | React.PointerEvent): InputType => {
  if (e.pointerType === 'pen') return 'pencil';
  if (e.pointerType === 'touch') return 'touch';
  return 'mouse';
};

/**
 * Extract pencil point data from pointer event
 */
const extractPencilPoint = (
  e: PointerEvent | React.PointerEvent,
  element: HTMLElement
): PencilPoint => {
  const rect = element.getBoundingClientRect();
  
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
    pressure: e.pressure || 0.5,
    tiltX: e.tiltX || 0,
    tiltY: e.tiltY || 0,
    // Calculate azimuth and altitude from tilt
    azimuthAngle: Math.atan2(e.tiltY || 0, e.tiltX || 0),
    altitudeAngle: Math.PI / 2 - Math.sqrt(
      Math.pow((e.tiltX || 0) * Math.PI / 180, 2) +
      Math.pow((e.tiltY || 0) * Math.PI / 180, 2)
    ),
    twist: e.twist || 0,
    timestamp: e.timeStamp,
  };
};

/**
 * Default pressure curve (slightly non-linear for natural feel)
 */
const defaultPressureCurve = (pressure: number): number => {
  // Slight ease-in curve for more control at light pressure
  return Math.pow(pressure, 0.8);
};

/**
 * Smooth pressure value to reduce jitter
 */
const smoothPressure = (
  current: number,
  previous: number,
  factor: number
): number => {
  return previous + (current - previous) * (1 - factor);
};

// =============================================================================
// Hook Implementation
// =============================================================================

const DEFAULT_OPTIONS: Required<UseApplePencilOptions> = {
  palmRejection: 'smart',
  minPressure: 0.01,
  pressureSmoothing: 0.3,
  enableHover: true,
  enableDoubleTap: true,
  pressureCurve: defaultPressureCurve,
};

export const useApplePencil = (
  callbacks: PencilCallbacks = {},
  options: UseApplePencilOptions = {}
): UseApplePencilReturn => {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const ref = useRef<HTMLElement>(null);
  
  // State
  const [state, setState] = useState<PencilState>({
    isActive: false,
    isHovering: false,
    isPencilConnected: false,
    currentPressure: 0,
    currentTilt: { x: 0, y: 0 },
    inputType: null,
  });
  
  // Current stroke tracking
  const [currentStroke, setCurrentStroke] = useState<PencilStroke | null>(null);
  const strokeRef = useRef<PencilStroke | null>(null);
  const lastPressureRef = useRef(0);
  const lastInputTypeRef = useRef<InputType | null>(null);
  const doubleTapTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapTimeRef = useRef(0);
  
  // Check if input should be accepted based on palm rejection mode
  const shouldAcceptInput = useCallback((
    inputType: InputType,
    isDrawing: boolean
  ): boolean => {
    switch (opts.palmRejection) {
      case 'off':
        return true;
      case 'pencil-only':
        return inputType === 'pencil';
      case 'smart':
        // If already drawing with pencil, reject touch
        if (isDrawing && lastInputTypeRef.current === 'pencil' && inputType === 'touch') {
          return false;
        }
        // If pencil was recently used, prefer pencil
        if (state.isPencilConnected && inputType === 'touch') {
          // Could add timeout-based logic here
          return true; // For now, allow both
        }
        return true;
      default:
        return true;
    }
  }, [opts.palmRejection, state.isPencilConnected]);
  
  // Handle pointer down (stroke start)
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!ref.current) return;
    
    const inputType = getInputType(e);
    const isPencil = inputType === 'pencil';
    
    // Track that pencil has been used
    if (isPencil) {
      setState(prev => ({ ...prev, isPencilConnected: true }));
    }
    
    // Check palm rejection
    if (!shouldAcceptInput(inputType, false)) {
      return;
    }
    
    // Check minimum pressure for pencil
    if (isPencil && e.pressure < opts.minPressure) {
      return;
    }
    
    const point = extractPencilPoint(e, ref.current);
    const adjustedPoint = {
      ...point,
      pressure: opts.pressureCurve(point.pressure),
    };
    
    // Start new stroke
    const stroke: PencilStroke = {
      id: crypto.randomUUID(),
      points: [adjustedPoint],
      startTime: e.timeStamp,
    };
    
    strokeRef.current = stroke;
    setCurrentStroke(stroke);
    lastInputTypeRef.current = inputType;
    lastPressureRef.current = adjustedPoint.pressure;
    
    setState(prev => ({
      ...prev,
      isActive: true,
      inputType,
      currentPressure: adjustedPoint.pressure,
      currentTilt: { x: point.tiltX, y: point.tiltY },
    }));
    
    // Capture pointer for smooth tracking
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    
    callbacks.onStrokeStart?.(adjustedPoint, inputType);
    
    if (inputType !== lastInputTypeRef.current) {
      callbacks.onInputTypeChange?.(inputType);
    }
  }, [callbacks, opts, shouldAcceptInput]);
  
  // Handle pointer move (stroke continue)
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!ref.current) return;
    
    const inputType = getInputType(e);
    const point = extractPencilPoint(e, ref.current);
    
    // Handle hover (when not actively drawing)
    if (!state.isActive && inputType === 'pencil' && opts.enableHover) {
      // Pencil 2 hover detection
      if (e.pressure === 0 && (e.tiltX !== 0 || e.tiltY !== 0)) {
        if (!state.isHovering) {
          setState(prev => ({ ...prev, isHovering: true }));
          callbacks.onHoverStart?.(point);
        } else {
          callbacks.onHoverMove?.(point);
        }
        return;
      }
    }
    
    // Only process move during active stroke
    if (!state.isActive || !strokeRef.current) return;
    
    // Check palm rejection
    if (!shouldAcceptInput(inputType, true)) {
      return;
    }
    
    // Smooth pressure
    const smoothedPressure = smoothPressure(
      opts.pressureCurve(point.pressure),
      lastPressureRef.current,
      opts.pressureSmoothing
    );
    lastPressureRef.current = smoothedPressure;
    
    const adjustedPoint = {
      ...point,
      pressure: smoothedPressure,
    };
    
    // Add point to stroke
    strokeRef.current.points.push(adjustedPoint);
    setCurrentStroke({ ...strokeRef.current });
    
    setState(prev => ({
      ...prev,
      currentPressure: smoothedPressure,
      currentTilt: { x: point.tiltX, y: point.tiltY },
    }));
    
    callbacks.onStrokeMove?.(adjustedPoint, inputType);
  }, [callbacks, opts, state.isActive, state.isHovering, shouldAcceptInput]);
  
  // Handle pointer up (stroke end)
  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!state.isActive || !strokeRef.current) return;
    
    const inputType = getInputType(e);
    
    // Finalize stroke
    const finalStroke: PencilStroke = {
      ...strokeRef.current,
      endTime: e.timeStamp,
    };
    
    callbacks.onStrokeEnd?.(finalStroke, inputType);
    
    strokeRef.current = null;
    setCurrentStroke(null);
    lastPressureRef.current = 0;
    
    setState(prev => ({
      ...prev,
      isActive: false,
      currentPressure: 0,
    }));
    
    // Release pointer capture
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    
    // Check for double-tap (Pencil 2)
    if (inputType === 'pencil' && opts.enableDoubleTap) {
      const now = Date.now();
      if (now - lastTapTimeRef.current < 300) {
        callbacks.onDoubleTap?.();
        lastTapTimeRef.current = 0;
      } else {
        lastTapTimeRef.current = now;
      }
    }
  }, [callbacks, opts, state.isActive]);
  
  // Handle pointer cancel
  const handlePointerCancel = useCallback((e: React.PointerEvent) => {
    if (strokeRef.current) {
      strokeRef.current = null;
      setCurrentStroke(null);
    }
    
    setState(prev => ({
      ...prev,
      isActive: false,
      isHovering: false,
      currentPressure: 0,
    }));
  }, []);
  
  // Handle pointer enter (hover start)
  const handlePointerEnter = useCallback((e: React.PointerEvent) => {
    if (!opts.enableHover) return;
    
    const inputType = getInputType(e);
    if (inputType === 'pencil' && e.pressure === 0 && ref.current) {
      const point = extractPencilPoint(e, ref.current);
      setState(prev => ({ ...prev, isHovering: true }));
      callbacks.onHoverStart?.(point);
    }
  }, [callbacks, opts.enableHover]);
  
  // Handle pointer leave (hover end)
  const handlePointerLeave = useCallback((e: React.PointerEvent) => {
    if (state.isHovering) {
      setState(prev => ({ ...prev, isHovering: false }));
      callbacks.onHoverEnd?.();
    }
  }, [callbacks, state.isHovering]);
  
  // Cancel current stroke
  const cancelStroke = useCallback(() => {
    if (strokeRef.current) {
      strokeRef.current = null;
      setCurrentStroke(null);
    }
    
    setState(prev => ({
      ...prev,
      isActive: false,
      currentPressure: 0,
    }));
  }, []);
  
  // Calculate stroke width based on pressure
  const getStrokeWidth = useCallback((baseWidth: number): number => {
    const pressure = state.currentPressure || 0.5;
    // Width varies from 50% to 150% of base based on pressure
    return baseWidth * (0.5 + pressure);
  }, [state.currentPressure]);
  
  // Calculate opacity based on pressure
  const getOpacity = useCallback((baseOpacity: number): number => {
    const pressure = state.currentPressure || 0.5;
    // Opacity varies from 30% to 100% of base based on pressure
    return baseOpacity * (0.3 + pressure * 0.7);
  }, [state.currentPressure]);
  
  // Get tilt angle in degrees
  const getTiltAngle = useCallback((): number => {
    const { x, y } = state.currentTilt;
    return Math.sqrt(x * x + y * y);
  }, [state.currentTilt]);
  
  // Get tilt direction (normalized vector)
  const getTiltDirection = useCallback((): { x: number; y: number } => {
    const { x, y } = state.currentTilt;
    const magnitude = Math.sqrt(x * x + y * y);
    if (magnitude === 0) return { x: 0, y: 0 };
    return {
      x: x / magnitude,
      y: y / magnitude,
    };
  }, [state.currentTilt]);
  
  // Attach event listeners
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    
    // Ensure touch-action is set for proper pointer event handling
    element.style.touchAction = 'none';
    
    const pointerDown = (e: PointerEvent) => handlePointerDown(e as unknown as React.PointerEvent);
    const pointerMove = (e: PointerEvent) => handlePointerMove(e as unknown as React.PointerEvent);
    const pointerUp = (e: PointerEvent) => handlePointerUp(e as unknown as React.PointerEvent);
    const pointerCancel = (e: PointerEvent) => handlePointerCancel(e as unknown as React.PointerEvent);
    const pointerEnter = (e: PointerEvent) => handlePointerEnter(e as unknown as React.PointerEvent);
    const pointerLeave = (e: PointerEvent) => handlePointerLeave(e as unknown as React.PointerEvent);
    
    element.addEventListener('pointerdown', pointerDown);
    element.addEventListener('pointermove', pointerMove);
    element.addEventListener('pointerup', pointerUp);
    element.addEventListener('pointercancel', pointerCancel);
    element.addEventListener('pointerenter', pointerEnter);
    element.addEventListener('pointerleave', pointerLeave);
    
    return () => {
      element.removeEventListener('pointerdown', pointerDown);
      element.removeEventListener('pointermove', pointerMove);
      element.removeEventListener('pointerup', pointerUp);
      element.removeEventListener('pointercancel', pointerCancel);
      element.removeEventListener('pointerenter', pointerEnter);
      element.removeEventListener('pointerleave', pointerLeave);
    };
  }, [
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    handlePointerEnter,
    handlePointerLeave,
  ]);
  
  return {
    ref: ref as React.RefObject<HTMLElement>,
    state,
    currentStroke,
    getStrokeWidth,
    getOpacity,
    getTiltAngle,
    getTiltDirection,
    cancelStroke,
    handlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerCancel,
      onPointerEnter: handlePointerEnter,
      onPointerLeave: handlePointerLeave,
    },
  };
};

// =============================================================================
// Pressure-Aware Drawing Utilities
// =============================================================================

/**
 * Draw a pressure-sensitive stroke on canvas
 */
export const drawPressureStroke = (
  ctx: CanvasRenderingContext2D,
  points: PencilPoint[],
  options: {
    baseWidth?: number;
    color?: string;
    opacity?: number;
    lineCap?: CanvasLineCap;
  } = {}
): void => {
  const {
    baseWidth = 4,
    color = '#000000',
    opacity = 1,
    lineCap = 'round',
  } = options;
  
  if (points.length < 2) return;
  
  ctx.lineCap = lineCap;
  ctx.lineJoin = 'round';
  
  for (let i = 1; i < points.length; i++) {
    const p0 = points[i - 1];
    const p1 = points[i];
    
    // Average pressure between points
    const pressure = (p0.pressure + p1.pressure) / 2;
    const width = baseWidth * (0.5 + pressure);
    const alpha = opacity * (0.3 + pressure * 0.7);
    
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = width;
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
  }
  
  ctx.globalAlpha = 1;
};

/**
 * Draw a tilt-aware brush stroke (like a marker or brush)
 */
export const drawTiltStroke = (
  ctx: CanvasRenderingContext2D,
  points: PencilPoint[],
  options: {
    baseWidth?: number;
    baseHeight?: number;
    color?: string;
    opacity?: number;
  } = {}
): void => {
  const {
    baseWidth = 20,
    baseHeight = 8,
    color ='#000000',
    opacity = 0.8,
  } = options;
  
  if (points.length < 1) return;
  
  ctx.fillStyle = color;
  
  for (const point of points) {
    // Calculate ellipse dimensions based on tilt
    const tiltMagnitude = Math.sqrt(point.tiltX ** 2 + point.tiltY ** 2);
    const tiltRatio = Math.min(1, tiltMagnitude / 45); // Normalize to 0-1
    
    // Width increases with tilt (like tilting a marker)
    const width = baseWidth * (1 + tiltRatio * 0.5);
    // Height decreases with tilt
    const height = baseHeight * (1 - tiltRatio * 0.3);
    
    // Rotation based on tilt direction
    const rotation = Math.atan2(point.tiltY, point.tiltX);
    
    // Opacity based on pressure
    const alpha = opacity * (0.3 + point.pressure * 0.7);
    
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(point.x, point.y);
    ctx.rotate(rotation);
    
    ctx.beginPath();
    ctx.ellipse(0, 0, width / 2, height / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  }
  
  ctx.globalAlpha = 1;
};

export default useApplePencil;

