/**
 * DrawingOverlay — frihånds-tegning oppå et videoframe.
 *
 * Bruker en HTMLCanvasElement absolutt-posisjonert oppå <video>. Lagrer
 * tegninger som DrawingPath[] som serialiseres til JSONB på server-siden.
 *
 * Brukes både i compose-modus (enabled=true, brukeren tegner) og i
 * read-only replay-modus (enabled=false, viser bare).
 */

import { danceFlowColors } from './danceFlowTheme';
import React from 'react';

export interface DrawingPath {
  /** Tegning-verktøy. V1 støtter kun 'pen'; pil/sirkel kan komme senere. */
  tool: 'pen';
  color: string;
  width: number;
  /** Punkter som [0..1] normaliserte koordinater (uavhengig av canvas-størrelse). */
  points: Array<{ x: number; y: number }>;
}

export interface DrawingOverlayProps {
  paths: DrawingPath[];
  onPathsChange: (paths: DrawingPath[]) => void;
  enabled: boolean;
  readOnly?: boolean;
  defaultColor?: string;
  defaultWidth?: number;
}

export const DrawingOverlay: React.FC<DrawingOverlayProps> = ({
  paths,
  onPathsChange,
  enabled,
  readOnly = false,
  defaultColor = danceFlowColors.gold,
  defaultWidth = 3,
}) => {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = React.useRef<HTMLDivElement | null>(null);
  const isDrawingRef = React.useRef(false);
  const currentPathRef = React.useRef<DrawingPath | null>(null);
  // Sprint A.7: hvilket event-system trekker streken nå. I ekte browsere
  // fyrer både pointer- og mouse-events for samme musebevegelse — uten
  // dette tracker-flagget ville hvert punkt blitt registrert to ganger.
  const eventSourceRef = React.useRef<'pointer' | 'mouse' | null>(null);

  // Re-tegn alle paths når størrelse, paths eller enabled endres.
  const redraw = React.useCallback(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const path of paths) {
      if (path.points.length < 2) continue;
      ctx.strokeStyle = path.color;
      ctx.lineWidth = path.width;
      ctx.beginPath();
      const start = path.points[0];
      ctx.moveTo(start.x * rect.width, start.y * rect.height);
      for (let i = 1; i < path.points.length; i += 1) {
        const p = path.points[i];
        ctx.lineTo(p.x * rect.width, p.y * rect.height);
      }
      ctx.stroke();
    }
    // Pågående path under draw.
    const cur = currentPathRef.current;
    if (cur && cur.points.length > 1) {
      ctx.strokeStyle = cur.color;
      ctx.lineWidth = cur.width;
      ctx.beginPath();
      const start = cur.points[0];
      ctx.moveTo(start.x * rect.width, start.y * rect.height);
      for (let i = 1; i < cur.points.length; i += 1) {
        const p = cur.points[i];
        ctx.lineTo(p.x * rect.width, p.y * rect.height);
      }
      ctx.stroke();
    }
  }, [paths]);

  React.useEffect(() => { redraw(); }, [redraw, enabled]);

  React.useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return undefined;
    const ro = new ResizeObserver(() => redraw());
    ro.observe(wrapper);
    return () => ro.disconnect();
  }, [redraw]);

  const startStrokeAt = (clientX: number, clientY: number): void => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
    isDrawingRef.current = true;
    currentPathRef.current = {
      tool: 'pen',
      color: defaultColor,
      width: defaultWidth,
      points: [{ x, y }],
    };
    redraw();
  };

  const extendStrokeAt = (clientX: number, clientY: number): void => {
    if (!isDrawingRef.current || !currentPathRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
    currentPathRef.current.points.push({ x, y });
    redraw();
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>): void => {
    if (!enabled || readOnly) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (canvas) {
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        // setPointerCapture kan kaste i e2e med syntetiske events — ignorer
      }
    }
    eventSourceRef.current = 'pointer';
    startStrokeAt(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>): void => {
    if (eventSourceRef.current !== 'pointer') return;
    extendStrokeAt(e.clientX, e.clientY);
  };

  // Sprint A.7: Playwright `page.mouse`-events oversetter ikke pålitelig til
  // pointer events i CDP-driven Chromium. Vi lytter også på mouse-eventene
  // direkte slik at både ekte touch/stylus (via pointer) og e2e-tester
  // (via mouse) trigger samme tegne-logikk. eventSourceRef sikrer at vi
  // bare bruker én kilde per stroke, så ikke pointer+mouse begge pusher
  // samme punkt i ekte browsere.
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>): void => {
    if (!enabled || readOnly) return;
    if (isDrawingRef.current) return; // pointer event tok turen først
    e.preventDefault();
    eventSourceRef.current = 'mouse';
    startStrokeAt(e.clientX, e.clientY);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>): void => {
    if (eventSourceRef.current !== 'mouse') return;
    extendStrokeAt(e.clientX, e.clientY);
  };

  const finishStroke = (): void => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    eventSourceRef.current = null;
    const cur = currentPathRef.current;
    currentPathRef.current = null;
    if (cur && cur.points.length >= 2) {
      onPathsChange([...paths, cur]);
    }
  };

  return (
    <div
      ref={wrapperRef}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: enabled && !readOnly ? 'auto' : 'none',
      }}
    >
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishStroke}
        onPointerLeave={finishStroke}
        onPointerCancel={finishStroke}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={finishStroke}
        onMouseLeave={finishStroke}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          touchAction: 'none',
        }}
        data-testid="drawing-overlay-canvas"
      />
    </div>
  );
};

export default DrawingOverlay;
