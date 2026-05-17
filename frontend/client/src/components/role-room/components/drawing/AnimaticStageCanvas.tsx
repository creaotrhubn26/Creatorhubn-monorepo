// @ts-nocheck
/**
 * AnimaticStageCanvas — canvas-rendering av aktivt frame med valgfri
 * cross-fade mellom segmenter. Eksternalisert fra AnimaticPlayer for
 * å holde hovedkomponenten under kontroll.
 *
 * Canvas-elementet eksponeres via forwardRef så foreldre-komponenten
 * kan koble det til MediaRecorder (canvas.captureStream()).
 *
 * Stage-container-elementet eksponeres via en separat callback-ref
 * (containerRef-prop) så foreldre kan kalle requestFullscreen() på det.
 */

import React from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import { Fullscreen, FullscreenExit } from '@mui/icons-material';
import type { TimelineSegment } from './animaticTimeline';

export const STAGE_CANVAS_WIDTH = 1280;
export const STAGE_CANVAS_HEIGHT = 720;

export interface AnimaticStageFrame {
  id: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  shotNumber?: string;
}

export interface AnimaticStageCanvasProps {
  frames: AnimaticStageFrame[];
  /** Aktivt frame-indeks (-1 = ingen). */
  activeFrameIndex: number;
  /** Sekunder fra start — driver cross-fade-progresjon. */
  currentTime: number;
  /** Timeline-segmenter fra useAnimaticPlayback. */
  timelineSegments: TimelineSegment[];
  /** Sekunder med cross-fade. 0 = hard cut. */
  transitionDuration: number;
  /** Stage-størrelse i fullscreen vs. inline. */
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  aspectRatio: number;
  stageMaxWidth: number;
  /** Container-ref — foreldre bruker den til fullscreen API. */
  onContainerRef?: (el: HTMLDivElement | null) => void;
  /** Tap på stage — typisk play/pause-toggle (touch-vennlig). */
  onTap?: () => void;
  /** Sveip venstre — neste frame. */
  onSwipeLeft?: () => void;
  /** Sveip høyre — forrige frame. */
  onSwipeRight?: () => void;
}

export const AnimaticStageCanvas = React.forwardRef<
  HTMLCanvasElement,
  AnimaticStageCanvasProps
>((props, forwardedCanvasRef) => {
  const {
    frames,
    activeFrameIndex,
    currentTime,
    timelineSegments,
    transitionDuration,
    isFullscreen,
    onToggleFullscreen,
    aspectRatio,
    stageMaxWidth,
    onContainerRef,
    onTap,
    onSwipeLeft,
    onSwipeRight,
  } = props;

  // Intern canvas-ref + bro til forwarded.
  const internalCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const setCanvasRef = React.useCallback((el: HTMLCanvasElement | null) => {
    internalCanvasRef.current = el;
    if (typeof forwardedCanvasRef === 'function') {
      forwardedCanvasRef(el);
    } else if (forwardedCanvasRef) {
      (forwardedCanvasRef as React.MutableRefObject<HTMLCanvasElement | null>).current = el;
    }
  }, [forwardedCanvasRef]);

  // Pointer-gestures for touch (iPad): tap = play/pause, swipe = frame-nav.
  // Bruker pointer-events i stedet for touch-events så musa også funker.
  const pointerStartRef = React.useRef<{ x: number; y: number; t: number } | null>(null);
  const TAP_MAX_DURATION_MS = 300;
  const TAP_MAX_MOVE_PX = 10;
  const SWIPE_MIN_DX_PX = 50;

  const onPointerDown = React.useCallback((e: React.PointerEvent) => {
    // Hopp over hvis bruker trykker direkte på fullscreen-knappen.
    const target = e.target as HTMLElement;
    if (target.closest('[data-testid="animatic-fullscreen"]')) return;
    pointerStartRef.current = { x: e.clientX, y: e.clientY, t: Date.now() };
  }, []);

  const onPointerUp = React.useCallback((e: React.PointerEvent) => {
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    if (!start) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-testid="animatic-fullscreen"]')) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const dt = Date.now() - start.t;

    // Tap: liten bevegelse, kort tid.
    if (Math.abs(dx) < TAP_MAX_MOVE_PX && Math.abs(dy) < TAP_MAX_MOVE_PX && dt < TAP_MAX_DURATION_MS) {
      onTap?.();
      return;
    }
    // Swipe: betydelig horisontal bevegelse, dominerer over vertikal.
    if (Math.abs(dx) >= SWIPE_MIN_DX_PX && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) onSwipeLeft?.();
      else onSwipeRight?.();
    }
  }, [onTap, onSwipeLeft, onSwipeRight]);

  // Cache av lastede bilder per src — kritisk når cross-fade trigger
  // redraw på hver RAF-tick.
  const imageCacheRef = React.useRef<Map<string, HTMLImageElement>>(new Map());

  const loadImage = React.useCallback((src: string): HTMLImageElement => {
    const cache = imageCacheRef.current;
    const existing = cache.get(src);
    if (existing) return existing;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;
    cache.set(src, img);
    return img;
  }, []);

  // Tegn aktivt frame (med valgfri cross-fade) på hver currentTime-tikk.
  React.useEffect(() => {
    const canvas = internalCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (canvas.width !== STAGE_CANVAS_WIDTH) canvas.width = STAGE_CANVAS_WIDTH;
    if (canvas.height !== STAGE_CANVAS_HEIGHT) canvas.height = STAGE_CANVAS_HEIGHT;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, STAGE_CANVAS_WIDTH, STAGE_CANVAS_HEIGHT);

    if (activeFrameIndex < 0 || timelineSegments.length === 0) return;
    const activeSeg = timelineSegments[activeFrameIndex];
    if (!activeSeg) return;
    const activeFrameMeta = frames[activeFrameIndex];

    const drawPlaceholder = (frameMeta) => {
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = '24px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = frameMeta?.shotNumber
        ? `Shot ${frameMeta.shotNumber}`
        : `Frame ${activeFrameIndex + 1}`;
      ctx.fillText(label, STAGE_CANVAS_WIDTH / 2, STAGE_CANVAS_HEIGHT / 2 - 16);
      ctx.font = '16px system-ui, sans-serif';
      ctx.fillText('Ingen tegning enda', STAGE_CANVAS_WIDTH / 2, STAGE_CANVAS_HEIGHT / 2 + 16);
    };

    const drawFitted = (img: HTMLImageElement, alpha: number) => {
      if (!img.complete || img.naturalWidth === 0) return false;
      const imgRatio = img.width / img.height;
      const canvasRatio = STAGE_CANVAS_WIDTH / STAGE_CANVAS_HEIGHT;
      let drawW: number;
      let drawH: number;
      if (imgRatio > canvasRatio) {
        drawW = STAGE_CANVAS_WIDTH;
        drawH = drawW / imgRatio;
      } else {
        drawH = STAGE_CANVAS_HEIGHT;
        drawW = drawH * imgRatio;
      }
      const x = (STAGE_CANVAS_WIDTH - drawW) / 2;
      const y = (STAGE_CANVAS_HEIGHT - drawH) / 2;
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, x, y, drawW, drawH);
      ctx.globalAlpha = 1;
      return true;
    };

    const drawFrameOrPlaceholder = (frameMeta, alpha = 1) => {
      const src = frameMeta?.imageUrl || frameMeta?.thumbnailUrl;
      if (!src) {
        if (alpha === 1) drawPlaceholder(frameMeta);
        return;
      }
      const img = loadImage(src);
      if (img.complete && img.naturalWidth > 0) {
        drawFitted(img, alpha);
      } else {
        img.onload = () => {
          // Re-tegn etter load. CurrentTime endrer seg ofte under
          // playback så vi får uansett ny tick, men under pause
          // trenger vi denne callbacken.
          requestAnimationFrame(() => {
            const c = internalCanvasRef.current;
            if (!c) return;
            const cx = c.getContext('2d');
            if (!cx) return;
            const segNow = timelineSegments[activeFrameIndex];
            if (segNow && segNow === activeSeg) {
              drawFitted(img, 1);
            }
          });
        };
        if (alpha === 1) drawPlaceholder(frameMeta);
      }
    };

    // Cross-fade: er vi i transitionDuration etter segment-start?
    const timeInSeg = Math.max(0, currentTime - activeSeg.start);
    if (
      transitionDuration > 0 &&
      timeInSeg < transitionDuration &&
      activeFrameIndex > 0
    ) {
      const prevFrameMeta = frames[activeFrameIndex - 1];
      const progress = timeInSeg / transitionDuration;
      drawFrameOrPlaceholder(prevFrameMeta, 1 - progress);
      drawFrameOrPlaceholder(activeFrameMeta, progress);
    } else {
      drawFrameOrPlaceholder(activeFrameMeta, 1);
    }
  }, [currentTime, activeFrameIndex, timelineSegments, frames, transitionDuration, loadImage]);

  return (
    <Box
      ref={onContainerRef}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      sx={{
        position: 'relative',
        width: '100%',
        maxWidth: isFullscreen ? 'none' : stageMaxWidth,
        mx: 'auto',
        aspectRatio: isFullscreen ? 'auto' : String(aspectRatio),
        height: isFullscreen ? '100vh' : 'auto',
        bgcolor: '#000',
        borderRadius: isFullscreen ? 0 : 1,
        border: isFullscreen ? 'none' : '1px solid rgba(255,255,255,0.08)',
        overflow: 'hidden',
        mb: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: onTap ? 'pointer' : 'default',
        touchAction: 'pan-y', // tillater vertikal scroll, gir oss horisontal swipe
        userSelect: 'none',
      }}
      data-testid="animatic-stage"
    >
      <canvas
        ref={setCanvasRef}
        width={STAGE_CANVAS_WIDTH}
        height={STAGE_CANVAS_HEIGHT}
        style={{
          width: isFullscreen ? 'auto' : '100%',
          height: isFullscreen ? '100%' : 'auto',
          maxWidth: '100%',
          maxHeight: '100%',
          display: 'block',
        }}
        data-testid="animatic-stage-canvas"
      />
      <Tooltip title={isFullscreen ? 'Lukk fullskjerm (F)' : 'Fullskjerm (F)'}>
        <IconButton
          size="small"
          onClick={onToggleFullscreen}
          sx={{
            position: 'absolute',
            top: 4,
            right: 4,
            color: 'rgba(255,255,255,0.8)',
            bgcolor: 'rgba(0,0,0,0.4)',
            opacity: 0.6,
            '&:hover': { opacity: 1, bgcolor: 'rgba(0,0,0,0.6)' },
          }}
          data-testid="animatic-fullscreen"
        >
          {isFullscreen ? <FullscreenExit fontSize="small" /> : <Fullscreen fontSize="small" />}
        </IconButton>
      </Tooltip>
    </Box>
  );
});

AnimaticStageCanvas.displayName = 'AnimaticStageCanvas';
