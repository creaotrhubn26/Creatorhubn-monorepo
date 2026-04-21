import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PreviewRenderer } from '../../services/preview-shader/preview-renderer';
import {
  mapSettingsToUniforms,
  type PreviewSliderInput,
} from '../../services/preview-shader/shader-uniforms';
import type { LutAtlas } from '../../services/preview-shader/lut-atlas';
import type { LutTonalMix } from '../../lib/enhancer-session/module-contract';

export interface RealtimePreviewCanvasProps {
  imageUrl: string;
  settings: PreviewSliderInput;
  lutAtlas?: LutAtlas | null;
  lutStrength?: number;
  lutTonalMix?: LutTonalMix;
  alt?: string;
  onWebGLUnavailable?: () => void;
  onImageError?: () => void;
}

type LoadState = 'idle' | 'loading' | 'ready' | 'image_error' | 'webgl_unavailable';

export function RealtimePreviewCanvas(props: RealtimePreviewCanvasProps) {
  const {
    imageUrl,
    settings,
    lutAtlas = null,
    lutStrength = 0,
    lutTonalMix = 'all',
    alt,
    onWebGLUnavailable,
    onImageError,
  } = props;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<PreviewRenderer | null>(null);
  const rafRef = useRef<number | null>(null);
  const [state, setState] = useState<LoadState>('idle');

  const uniforms = useMemo(() => mapSettingsToUniforms(settings), [settings]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageUrl) return;

    let cancelled = false;
    setState('loading');

    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.decoding = 'async';
    image.onload = () => {
      if (cancelled) return;
      if (!rendererRef.current) {
        const renderer = PreviewRenderer.create(canvas);
        if (!renderer) {
          setState('webgl_unavailable');
          onWebGLUnavailable?.();
          return;
        }
        rendererRef.current = renderer;
      }
      rendererRef.current.setImage(image);
      rendererRef.current.render(mapSettingsToUniforms(settings));
      setState('ready');
    };
    image.onerror = () => {
      if (cancelled) return;
      setState('image_error');
      onImageError?.();
    };
    image.src = imageUrl;

    return () => {
      cancelled = true;
    };
    // settings intentionally excluded — a URL swap loads new pixels, and
    // a settings change is handled by the next effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl]);

  useEffect(() => {
    if (state !== 'ready') return;
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.setLut({ atlas: lutAtlas, strength: lutStrength, tonalMix: lutTonalMix });
  }, [lutAtlas, lutStrength, lutTonalMix, state]);

  useEffect(() => {
    if (state !== 'ready') return;
    const renderer = rendererRef.current;
    if (!renderer) return;

    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      renderer.render(uniforms);
      rafRef.current = null;
    });

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [uniforms, state, lutAtlas, lutStrength, lutTonalMix]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, []);

  if (state === 'webgl_unavailable' || state === 'image_error') {
    return (
      <img
        src={imageUrl}
        alt={alt || 'Original'}
        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      aria-label={alt || 'Realtime preview'}
      style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
    />
  );
}
