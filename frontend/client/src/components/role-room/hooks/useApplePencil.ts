/**
 * useApplePencil Hook
 * 
 * Provides Apple Pencil integration with pressure, tilt, and gesture support
 */

import { useRef, useEffect, useLayoutEffect, type RefObject } from 'react';

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
  brush?: {
    type: string;
    size: number;
    color: string;
    opacity: number;
    hardness: number;
    flow: number;
    wetness: number;
    grain: number;
    tiltSensitivity: number;
    pressureSensitivity: number;
  };
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
  ref: RefObject<HTMLElement | null>;
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
  const ref = useRef<HTMLElement | null>(null);
  const currentStroke = useRef<PencilStroke | null>(null);
  const callbacksRef = useRef<ApplePencilCallbacks>(callbacks);
  const configRef = useRef<ApplePencilConfig>(config);
  const smoothedPressureRef = useRef<number>(0.5);
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

  const shouldIgnorePointerEvent = (event: PointerEvent): boolean => {
    const target = event.target;
    return target instanceof Element && Boolean(target.closest('[data-pencil-ignore="true"]'));
  };

  const createPoint = (event: PointerEvent, element: HTMLElement): PencilPoint => {
    const rect = element.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      pressure: event.pressure || 0.5,
      tiltX: event.tiltX || 0,
      tiltY: event.tiltY || 0,
      timestamp: Date.now(),
    };
  };

  useLayoutEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  useLayoutEffect(() => {
    configRef.current = config;
  }, [
    config.palmRejection,
    config.minPressure,
    config.pressureSmoothing,
    config.enableHover,
    config.enableDoubleTap,
  ]);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const getSmoothedPressure = (rawPressure: number): number => {
      const smoothing = Math.min(Math.max(configRef.current.pressureSmoothing ?? 0, 0), 0.95);
      const next = smoothedPressureRef.current * smoothing + rawPressure * (1 - smoothing);
      smoothedPressureRef.current = next;
      return next;
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (shouldIgnorePointerEvent(event)) return;
      event.preventDefault();
      const inputType = getInputType(event);
      const currentConfig = configRef.current;

      if (inputType === 'touch') {
        if (currentConfig.palmRejection === 'pencil-only') return;
        if (currentConfig.palmRejection === 'smart' && state.current.currentInputType === 'pen') return;
      }

      const point = createPoint(event, element);
      const minPressure = currentConfig.minPressure ?? 0;
      point.pressure = inputType === 'pen'
        ? Math.max(minPressure, point.pressure)
        : point.pressure;
      point.pressure = getSmoothedPressure(point.pressure);
      
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
      
      try {
        if (event.target && 'setPointerCapture' in (event.target as Element)) {
          (event.target as Element).setPointerCapture(event.pointerId);
        }
      } catch {
        // Ignore capture failures on unsupported targets
      }

      callbacksRef.current.onStrokeStart?.(point, inputType);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!state.current.isDrawing && shouldIgnorePointerEvent(event)) return;
      event.preventDefault();
      const point = createPoint(event, element);
      const inputType = getInputType(event);
      const minPressure = configRef.current.minPressure ?? 0;
      point.pressure = inputType === 'pen'
        ? Math.max(minPressure, point.pressure)
        : point.pressure;
      point.pressure = getSmoothedPressure(point.pressure);

      if (state.current.isDrawing && currentStroke.current) {
        currentStroke.current.points.push(point);
        state.current.currentPressure = point.pressure;
        callbacksRef.current.onStrokeMove?.(point, inputType);
      } else {
        // Hover (Pencil 2 feature)
        if ((configRef.current.enableHover ?? true) && inputType === 'pen' && !state.current.isDrawing) {
          if (!state.current.isHovering) {
            state.current.isHovering = true;
            callbacksRef.current.onHoverStart?.(point);
          } else {
            callbacksRef.current.onHoverMove?.(point);
          }
        }
      }
    };

    const handlePointerUp = (event: PointerEvent) => {
      event.preventDefault();
      const inputType = getInputType(event);
      
      if (state.current.isDrawing && currentStroke.current) {
        // Capture a final point at pointer-up so features like hold-to-straight-line
        // can reliably read the end timestamp even when there were no move events.
        const finalPoint = createPoint(event, element);
        const minPressure = configRef.current.minPressure ?? 0;
        finalPoint.pressure = inputType === 'pen'
          ? Math.max(minPressure, finalPoint.pressure)
          : finalPoint.pressure;
        currentStroke.current.points.push(finalPoint);
        state.current.currentPressure = finalPoint.pressure;

        callbacksRef.current.onStrokeEnd?.(currentStroke.current, inputType);
        currentStroke.current = null;
        state.current.isDrawing = false;
        state.current.isActive = false;
        state.current.currentInputType = null;
        state.current.currentPressure = 0;
        smoothedPressureRef.current = 0.5;
      }

      try {
        if (event.target && 'releasePointerCapture' in (event.target as Element)) {
          (event.target as Element).releasePointerCapture(event.pointerId);
        }
      } catch {
        // Ignore release failures on unsupported targets
      }
    };

    const handlePointerLeave = () => {
      if (state.current.isHovering) {
        state.current.isHovering = false;
        callbacksRef.current.onHoverEnd?.();
      }
    };

    // Attach event listeners
    element.addEventListener('pointerdown', handlePointerDown);
    element.addEventListener('pointermove', handlePointerMove);
    element.addEventListener('pointerup', handlePointerUp);
    element.addEventListener('pointerleave', handlePointerLeave);

    return () => {
      element.removeEventListener('pointerdown', handlePointerDown);
      element.removeEventListener('pointermove', handlePointerMove);
      element.removeEventListener('pointerup', handlePointerUp);
      element.removeEventListener('pointerleave', handlePointerLeave);
    };
  }, []);

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
