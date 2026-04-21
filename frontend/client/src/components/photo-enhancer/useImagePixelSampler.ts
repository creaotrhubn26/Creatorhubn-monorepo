import { useCallback, useEffect, useRef } from 'react';
import {
  samplePixelFromContext,
  type SampledPixel,
} from '../../lib/enhancer-session/hsl-band-math';

/**
 * Loads an image into a hidden offscreen canvas and exposes a pure
 * sample-at-(u,v) call where (u, v) are normalised [0, 1] coordinates.
 *
 * Why a hidden canvas? The WebGL preview canvas shows the approximated
 * preview — sampling there would classify the already-edited colour,
 * which is the wrong reference for an HSL eyedropper. We want the
 * photographer to pick a colour they see in the *source* image and then
 * target it. Sampling the source via a separate canvas makes that
 * deterministic regardless of what the preview shader is doing.
 */
export interface ImagePixelSampler {
  sampleNormalised: (u: number, v: number) => SampledPixel | null;
  ready: boolean;
}

export function useImagePixelSampler(imageUrl: string | null | undefined): ImagePixelSampler {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const readyRef = useRef(false);
  const dimsRef = useRef({ width: 0, height: 0 });

  useEffect(() => {
    readyRef.current = false;
    if (!imageUrl) return;

    let cancelled = false;
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.decoding = 'async';
    image.onload = () => {
      if (cancelled) return;
      const maxEdge = 1200;
      const scale = Math.min(1, maxEdge / Math.max(image.width, image.height || 1));
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = canvasRef.current ?? document.createElement('canvas');
      canvasRef.current = canvas;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        ctxRef.current = null;
        readyRef.current = false;
        return;
      }
      ctx.drawImage(image, 0, 0, width, height);
      ctxRef.current = ctx;
      dimsRef.current = { width, height };
      readyRef.current = true;
    };
    image.onerror = () => {
      ctxRef.current = null;
      readyRef.current = false;
    };
    image.src = imageUrl;

    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  const sampleNormalised = useCallback((u: number, v: number): SampledPixel | null => {
    const ctx = ctxRef.current;
    const { width, height } = dimsRef.current;
    if (!ctx || width === 0 || height === 0) return null;
    const x = Math.max(0, Math.min(width - 1, Math.round(u * (width - 1))));
    const y = Math.max(0, Math.min(height - 1, Math.round(v * (height - 1))));
    return samplePixelFromContext(ctx, x, y);
  }, []);

  return { sampleNormalised, ready: readyRef.current };
}
