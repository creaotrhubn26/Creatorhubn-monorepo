/**
 * useApplePencil Hook
 * 
 * Provides Apple Pencil integration with pressure, tilt, and gesture support
 */

import { useRef, useEffect, useCallback, useState, RefObject } from 'react';

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
  /** Unique identifier for selection, undo, serialization */
  id: string;
  /** Deterministic seed derived at stroke start for replay */
  seed: number;
  /** Which layer this stroke belongs to */
  layerId: string;
  points: PencilPoint[];
  inputType: InputType;
  color: string;
  width: number;
  opacity: number;
  /** Snapshot of brush settings used when stroke was drawn */
  brushSettings?: Record<string, unknown>;
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
  const currentStrokeRef = useRef<PencilStroke | null>(null);
  /** Monotonic counter for deterministic stroke IDs within a session */
  const strokeCounter = useRef(0);

  // B-1 fix: Use React state so changes trigger re-renders for JSX consumers
  const [pencilState, setPencilState] = useState<ApplePencilState>({
    isDrawing: false,
    isHovering: false,
    currentInputType: null,
    isPencilConnected: false,
    isActive: false,
    currentPressure: 0,
  });
  // Internal ref mirrors state for use inside event handlers without stale closures
  const stateRef = useRef(pencilState);
  stateRef.current = pencilState;

  // P-1 fix: Store callbacks in a ref so the effect dependency is stable
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  const configRef = useRef(config);
  configRef.current = config;

  // P-5 fix: Cache bounding rect, invalidate on resize/scroll
  const rectCacheRef = useRef<{ rect: DOMRect; ts: number } | null>(null);
  const getCachedRect = useCallback((canvas: HTMLCanvasElement): DOMRect => {
    const now = Date.now();
    // Refresh every 500ms or on first call
    if (!rectCacheRef.current || now - rectCacheRef.current.ts > 500) {
      rectCacheRef.current = { rect: canvas.getBoundingClientRect(), ts: now };
    }
    return rectCacheRef.current!.rect;
  }, []);

  const getInputType = useCallback((event: PointerEvent): InputType => {
    if (event.pointerType === 'pen') return 'pen';
    if (event.pointerType === 'touch') return 'touch';
    return 'mouse';
  }, []);

  const createPoint = useCallback((event: PointerEvent, canvas: HTMLCanvasElement): PencilPoint => {
    const rect = getCachedRect(canvas);
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      pressure: event.pressure || 0.5,
      tiltX: event.tiltX || 0,
      tiltY: event.tiltY || 0,
      timestamp: Date.now(),
    };
  }, [getCachedRect]);

  // Invalidate rect cache on resize/scroll
  useEffect(() => {
    const invalidate = () => { rectCacheRef.current = null; };
    window.addEventListener('resize', invalidate);
    window.addEventListener('scroll', invalidate, true);
    return () => {
      window.removeEventListener('resize', invalidate);
      window.removeEventListener('scroll', invalidate, true);
    };
  }, []);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    // B-4 fix: Check palm rejection to ignore non-pencil input
    const shouldReject = (event: PointerEvent): boolean => {
      const mode = configRef.current.palmRejection;
      if (mode === 'pencil-only' && event.pointerType !== 'pen') return true;
      if (mode === 'smart' && event.pointerType === 'touch') {
        // In smart mode, reject touches when a pen is connected
        if (stateRef.current.isPencilConnected) return true;
      }
      return false;
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (shouldReject(event)) return;
      event.preventDefault();
      const inputType = getInputType(event);
      const point = createPoint(event, canvas);

      const newState: ApplePencilState = {
        isDrawing: true,
        isActive: true,
        isHovering: false,
        currentInputType: inputType,
        currentPressure: point.pressure,
        isPencilConnected: inputType === 'pen' || stateRef.current.isPencilConnected,
      };
      setPencilState(newState);

      currentStrokeRef.current = {
        id: `stroke-${Date.now()}-${++strokeCounter.current}`,
        seed: (point.x * 73856093 ^ point.y * 19349663 ^ point.timestamp) >>> 0,
        layerId: 'default',
        points: [point],
        inputType,
        color: '#000000',
        width: 2,
        opacity: 1,
      };

      callbacksRef.current.onStrokeStart?.(point, inputType);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (shouldReject(event)) return;
      event.preventDefault();
      const point = createPoint(event, canvas);
      const inputType = getInputType(event);

      if (stateRef.current.isDrawing && currentStrokeRef.current) {
        currentStrokeRef.current.points.push(point);
        // Throttle state updates — only update pressure (avoids re-render flood)
        setPencilState(prev => prev.currentPressure === point.pressure ? prev : { ...prev, currentPressure: point.pressure });
        callbacksRef.current.onStrokeMove?.(point, inputType);
      } else {
        // B-5 fix: Check enableHover config
        if (configRef.current.enableHover !== false && inputType === 'pen' && !stateRef.current.isDrawing) {
          if (!stateRef.current.isHovering) {
            setPencilState(prev => ({ ...prev, isHovering: true }));
            callbacksRef.current.onHoverStart?.(point);
          } else {
            callbacksRef.current.onHoverMove?.(point);
          }
        }
      }
    };

    // B-3 fix: Finish stroke regardless of where pointer lifts
    const finishStroke = (event: PointerEvent) => {
      const inputType = getInputType(event);

      if (stateRef.current.isDrawing && currentStrokeRef.current) {
        callbacksRef.current.onStrokeEnd?.(currentStrokeRef.current, inputType);
        currentStrokeRef.current = null;
        setPencilState(prev => ({
          ...prev,
          isDrawing: false,
          isActive: false,
          currentInputType: null,
          currentPressure: 0,
        }));
      }
    };

    const handlePointerUp = (event: PointerEvent) => {
      event.preventDefault();
      finishStroke(event);
    };

    // B-2 fix: Handle pointercancel (palm, system alert, etc.)
    const handlePointerCancel = (event: PointerEvent) => {
      finishStroke(event);
    };

    const handlePointerLeave = () => {
      if (stateRef.current.isHovering) {
        setPencilState(prev => ({ ...prev, isHovering: false }));
        callbacksRef.current.onHoverEnd?.();
      }
    };

    // Double-tap detection (B-5 fix: check enableDoubleTap config)
    let lastTapTime = 0;
    const handleDoubleTap = (event: PointerEvent) => {
      if (configRef.current.enableDoubleTap === false) return;
      if (event.pointerType !== 'pen') return;
      const now = Date.now();
      if (now - lastTapTime < 300) {
        callbacksRef.current.onDoubleTap?.();
        lastTapTime = 0;
      } else {
        lastTapTime = now;
      }
    };

    // Attach event listeners
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('pointercancel', handlePointerCancel);  // B-2
    canvas.addEventListener('pointerleave', handlePointerLeave);
    canvas.addEventListener('pointerdown', handleDoubleTap);
    // B-3 fix: Listen for pointerup on window to catch lifts outside canvas
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerup', handlePointerUp);
      canvas.removeEventListener('pointercancel', handlePointerCancel);
      canvas.removeEventListener('pointerleave', handlePointerLeave);
      canvas.removeEventListener('pointerdown', handleDoubleTap);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  // P-1 fix: No dependency on `callbacks` — we use callbacksRef which is always stable
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getInputType, createPoint]);

  const getStrokeWidth = useCallback((pressure: number, baseWidth: number): number => {
    return baseWidth * (0.5 + pressure * 0.5);
  }, []);

  const getOpacity = useCallback((pressure: number, baseOpacity: number): number => {
    return baseOpacity * (0.3 + pressure * 0.7);
  }, []);

  return {
    ref,
    // B-1 fix: Return React state (reactive) instead of ref.current (stale)
    state: pencilState,
    currentStroke: currentStrokeRef.current,
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
