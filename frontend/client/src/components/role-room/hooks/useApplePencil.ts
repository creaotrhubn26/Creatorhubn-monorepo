/**
 * useApplePencil Hook
 * 
 * Provides Apple Pencil integration with pressure, tilt, and gesture support
 */

import { useRef, useEffect, RefObject } from 'react';

// =============================================================================
// Types
// =============================================================================

export type InputType = 'pen' | 'touch' | 'mouse';

export interface PencilPoint {
  x: number;
  y: number;
  pressure: number;
  tiltX: number;
  tiltY: number;
  timestamp: number;
}

export interface PencilStroke {
  points: PencilPoint[];
  inputType: InputType;
  color: string;
  width: number;
  opacity: number;
}

export interface ApplePencilCallbacks {
  onStrokeStart?: (point: PencilPoint, inputType: InputType) => void;
  onStrokeMove?: (point: PencilPoint, inputType: InputType) => void;
  onStrokeEnd?: (stroke: PencilStroke, inputType: InputType) => void;
  onHoverStart?: (point: PencilPoint) => void;
  onHoverMove?: (point: PencilPoint) => void;
  onHoverEnd?: () => void;
  onDoubleTap?: () => void;
}

export interface ApplePencilConfig {
  palmRejection?: 'off' | 'pencil-only' | 'smart';
  minPressure?: number;
  pressureSmoothing?: number;
  enableHover?: boolean;
  enableDoubleTap?: boolean;
}

export interface ApplePencilState {
  isDrawing: boolean;
  isHovering: boolean;
  currentInputType: InputType | null;
  isPencilConnected: boolean;
  isActive: boolean;
  currentPressure: number;
}

export interface UseApplePencilReturn {
  ref: RefObject<HTMLCanvasElement | null>;
  state: ApplePencilState;
  currentStroke: PencilStroke | null;
  getStrokeWidth: (pressure: number, baseWidth: number) => number;
  getOpacity: (pressure: number, baseOpacity: number) => number;
}

// =============================================================================
// Hook
// =============================================================================

export const useApplePencil = (
  callbacks: ApplePencilCallbacks = {},
  config: ApplePencilConfig = {}
): UseApplePencilReturn => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const currentStroke = useRef<PencilStroke | null>(null);
  const state = useRef<ApplePencilState>({
    isDrawing: false,
    isHovering: false,
    currentInputType: null,
    isPencilConnected: false,
    isActive: false,
    currentPressure: 0,
  });

  const getInputType = (event: PointerEvent): InputType => {
    if (event.pointerType === 'pen') return 'pen';
    if (event.pointerType === 'touch') return 'touch';
    return 'mouse';
  };

  const createPoint = (event: PointerEvent, canvas: HTMLCanvasElement): PencilPoint => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      pressure: event.pressure || 0.5,
      tiltX: event.tiltX || 0,
      tiltY: event.tiltY || 0,
      timestamp: Date.now(),
    };
  };

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const handlePointerDown = (event: PointerEvent) => {
      event.preventDefault();
      const inputType = getInputType(event);
      const point = createPoint(event, canvas);
      
      state.current.isDrawing = true;
      state.current.isActive = true;
      state.current.currentInputType = inputType;
      state.current.currentPressure = point.pressure;
      state.current.isPencilConnected = inputType === 'pen';
      
      currentStroke.current = {
        points: [point],
        inputType,
        color: '#000000',
        width: 2,
        opacity: 1,
      };
      
      callbacks.onStrokeStart?.(point, inputType);
    };

    const handlePointerMove = (event: PointerEvent) => {
      event.preventDefault();
      const point = createPoint(event, canvas);
      const inputType = getInputType(event);

      if (state.current.isDrawing && currentStroke.current) {
        currentStroke.current.points.push(point);
        state.current.currentPressure = point.pressure;
        callbacks.onStrokeMove?.(point, inputType);
      } else {
        // Hover (Pencil 2 feature)
        if (inputType === 'pen' && !state.current.isDrawing) {
          if (!state.current.isHovering) {
            state.current.isHovering = true;
            callbacks.onHoverStart?.(point);
          } else {
            callbacks.onHoverMove?.(point);
          }
        }
      }
    };

    const handlePointerUp = (event: PointerEvent) => {
      event.preventDefault();
      const inputType = getInputType(event);
      
      if (state.current.isDrawing && currentStroke.current) {
        callbacks.onStrokeEnd?.(currentStroke.current, inputType);
        currentStroke.current = null;
        state.current.isDrawing = false;
        state.current.isActive = false;
        state.current.currentInputType = null;
        state.current.currentPressure = 0;
      }
    };

    const handlePointerLeave = () => {
      if (state.current.isHovering) {
        state.current.isHovering = false;
        callbacks.onHoverEnd?.();
      }
    };

    // Attach event listeners
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('pointerleave', handlePointerLeave);

    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerup', handlePointerUp);
      canvas.removeEventListener('pointerleave', handlePointerLeave);
    };
  }, [callbacks]);

  const getStrokeWidth = (pressure: number, baseWidth: number): number => {
    return baseWidth * (0.5 + pressure * 0.5);
  };

  const getOpacity = (pressure: number, baseOpacity: number): number => {
    return baseOpacity * (0.3 + pressure * 0.7);
  };

  return {
    ref,
    state: state.current,
    currentStroke: currentStroke.current,
    getStrokeWidth,
    getOpacity,
  };
};

// =============================================================================
// Drawing Utilities
// =============================================================================

interface DrawingOptions {
  baseWidth: number;
  baseHeight?: number;
  color: string;
  opacity: number;
  lineCap?: CanvasLineCap;
}

export const drawPressureStroke = (
  ctx: CanvasRenderingContext2D,
  points: PencilPoint[],
  options: DrawingOptions
) => {
  if (points.length === 0) return;

  ctx.strokeStyle = options.color;
  ctx.lineCap = options.lineCap || 'round';
  ctx.lineJoin = 'round';
  ctx.globalAlpha = options.opacity;

  for (let i = 0; i < points.length - 1; i++) {
    const point = points[i];
    const nextPoint = points[i + 1];
    const width = options.baseWidth * (0.5 + point.pressure * 0.5);

    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    ctx.lineTo(nextPoint.x, nextPoint.y);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
};

export const drawTiltStroke = (
  ctx: CanvasRenderingContext2D,
  points: PencilPoint[],
  options: DrawingOptions
) => {
  if (points.length === 0) return;

  ctx.strokeStyle = options.color;
  ctx.lineCap = options.lineCap || 'round';
  ctx.lineJoin = 'round';
  ctx.globalAlpha = options.opacity;

  for (let i = 0; i < points.length - 1; i++) {
    const point = points[i];
    const nextPoint = points[i + 1];
    
    // Calculate tilt-based width variation
    const tiltFactor = Math.sqrt(point.tiltX ** 2 + point.tiltY ** 2) / 90;
    const width = options.baseWidth * (0.5 + point.pressure * 0.5) * (1 + tiltFactor * 0.3);

    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    ctx.lineTo(nextPoint.x, nextPoint.y);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
};
