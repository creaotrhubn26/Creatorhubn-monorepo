/**
 * ObjectRemovalEditor — brush-mask UI for the photo enhancer's
 * object-removal axis. The photographer paints over what they want gone
 * (a flash poking into frame, a power cable on the floor, a stray light
 * stand), then hits "Foreslå & fjern" — the request goes to
 * /api/photo-enhancer/inpaint, Claude Vision plans the fill, and the
 * server runs patch_clone / Telea / NS to produce the result.
 *
 * Slice 1 scope: brush + clear, single-shot inpaint, A/B compare,
 * apply-or-cancel. No undo/redo (history arrives in Slice 2). No mask
 * persistence across reopens.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Slider,
  Stack,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import CompareIcon from '@mui/icons-material/Compare';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import type { InpaintRecipe } from '../../lib/enhancer-session/module-contract';

/** Cap on per-session brush history. Each snapshot is a full-resolution
 *  ImageData (RGBA, ~10MB on a 24MP source), so the cap matters — at 20
 *  strokes we're at ~200MB worst case. The photographer can always
 *  Tøm-maske and start over if they need to go further back. */
const MAX_UNDO_DEPTH = 20;

export interface ObjectRemovalEditorProps {
  /** Source image as a data URL or http(s) URL. The editor will load it
   *  into a canvas at native resolution and constrain the display. */
  imageUrl: string;
  /** Called after the photographer accepts the inpainted result. The
   *  parent should update the current image to ``newImageDataUrl``. */
  onApply: (newImageDataUrl: string, recipe: InpaintRecipe, warnings: string[]) => void;
  /** Called when the photographer cancels without applying. */
  onClose: () => void;
}

interface InpaintResponse {
  success: boolean;
  imageBase64?: string;
  imageMime?: string;
  recipe?: InpaintRecipe;
  strategyUsed?: string;
  executorWarnings?: string[];
  error?: string;
  detail?: string;
}

const BRUSH_MIN = 4;
const BRUSH_MAX = 200;
const BRUSH_DEFAULT = 32;

/** Cap displayed image dimensions to fit the dialog viewport while
 *  preserving aspect. The mask is always at native image resolution. */
const DISPLAY_MAX = 920;

export const ObjectRemovalEditor: React.FC<ObjectRemovalEditorProps> = ({
  imageUrl,
  onApply,
  onClose,
}) => {
  const imageCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const inpaintedCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [imgNative, setImgNative] = useState<{ w: number; h: number } | null>(null);
  const [displayScale, setDisplayScale] = useState(1);
  const [brushRadius, setBrushRadius] = useState(BRUSH_DEFAULT);
  const [isPainting, setIsPainting] = useState(false);
  const [lastPoint, setLastPoint] = useState<{ x: number; y: number } | null>(null);
  const [hasMaskContent, setHasMaskContent] = useState(false);

  // Snapshot stacks for undo/redo. Each entry is a full mask ImageData
  // captured at the START of a stroke — so undo restores the mask to
  // exactly the state it had before the most recent stroke began.
  const undoStackRef = useRef<ImageData[]>([]);
  const redoStackRef = useRef<ImageData[]>([]);
  const [historyVersion, setHistoryVersion] = useState(0); // re-render trigger

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    imageDataUrl: string;
    recipe: InpaintRecipe;
    strategyUsed: string;
    executorWarnings: string[];
  } | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);

  const sourceImage = useMemo(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    return img;
  }, []);

  // Load source image, size the canvases, draw it.
  useEffect(() => {
    const img = sourceImage;
    img.onload = () => {
      const native = { w: img.naturalWidth, h: img.naturalHeight };
      setImgNative(native);
      const longSide = Math.max(native.w, native.h);
      const scale = longSide > DISPLAY_MAX ? DISPLAY_MAX / longSide : 1;
      setDisplayScale(scale);

      const imageCanvas = imageCanvasRef.current;
      const maskCanvas = maskCanvasRef.current;
      if (!imageCanvas || !maskCanvas) return;

      // Native-resolution backing store. CSS dimensions are scaled.
      imageCanvas.width = native.w;
      imageCanvas.height = native.h;
      maskCanvas.width = native.w;
      maskCanvas.height = native.h;

      const imgCtx = imageCanvas.getContext('2d');
      if (imgCtx) imgCtx.drawImage(img, 0, 0);

      const maskCtx = maskCanvas.getContext('2d');
      if (maskCtx) {
        maskCtx.fillStyle = 'rgba(0,0,0,0)';
        maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
      }
    };
    img.onerror = () => setError('Kunne ikke laste bildet.');
    img.src = imageUrl;
  }, [imageUrl, sourceImage]);

  /** Convert a pointer event to native-image coordinates. The display
   *  canvas is CSS-scaled so the click position needs both the CSS-to-
   *  native ratio (handled by the canvas's own bounding rect) and the
   *  display-scale we applied. */
  const pointerToNative = useCallback(
    (ev: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = maskCanvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const x = ((ev.clientX - rect.left) / rect.width) * canvas.width;
      const y = ((ev.clientY - rect.top) / rect.height) * canvas.height;
      return { x, y };
    },
    [],
  );

  const stamp = useCallback(
    (x: number, y: number) => {
      const ctx = maskCanvasRef.current?.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = 'rgba(255,255,255,1)';
      ctx.beginPath();
      ctx.arc(x, y, brushRadius / displayScale, 0, Math.PI * 2);
      ctx.fill();
      setHasMaskContent(true);
    },
    [brushRadius, displayScale],
  );

  /** Linear-interpolate stamps between the last pointer position and the
   *  current one so fast strokes don't leave gaps. Spacing is half the
   *  brush radius — same convention as the freq-sep brush. */
  const stampSegment = useCallback(
    (x: number, y: number) => {
      const ctx = maskCanvasRef.current?.getContext('2d');
      if (!ctx) return;
      const radius = brushRadius / displayScale;
      const spacing = Math.max(1, radius * 0.5);
      if (lastPoint) {
        const dx = x - lastPoint.x;
        const dy = y - lastPoint.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const steps = Math.max(1, Math.floor(dist / spacing));
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          const px = lastPoint.x + dx * t;
          const py = lastPoint.y + dy * t;
          ctx.fillStyle = 'rgba(255,255,255,1)';
          ctx.beginPath();
          ctx.arc(px, py, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        ctx.fillStyle = 'rgba(255,255,255,1)';
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      setHasMaskContent(true);
    },
    [brushRadius, displayScale, lastPoint],
  );

  /** Snapshot the current mask canvas before mutating it, so undo can
   *  restore. New snapshots invalidate the redo stack — once the
   *  photographer paints a fresh stroke, redoing forward to a stale
   *  branch would feel wrong. Cap depth so a long session doesn't
   *  accumulate hundreds of full-resolution ImageData snapshots in RAM. */
  const snapshotMaskBeforeStroke = useCallback(() => {
    const ctx = maskCanvasRef.current?.getContext('2d');
    const canvas = maskCanvasRef.current;
    if (!ctx || !canvas) return;
    const snap = ctx.getImageData(0, 0, canvas.width, canvas.height);
    undoStackRef.current.push(snap);
    if (undoStackRef.current.length > MAX_UNDO_DEPTH) {
      undoStackRef.current.shift();
    }
    redoStackRef.current = [];
    setHistoryVersion((v) => v + 1);
  }, []);

  const undo = useCallback(() => {
    const ctx = maskCanvasRef.current?.getContext('2d');
    const canvas = maskCanvasRef.current;
    if (!ctx || !canvas) return;
    const snap = undoStackRef.current.pop();
    if (!snap) return;
    // Capture current state on redo stack before restoring previous.
    redoStackRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    ctx.putImageData(snap, 0, 0);
    // Re-evaluate whether any non-zero pixels remain in the mask.
    const restored = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let anyAlpha = false;
    for (let i = 3; i < restored.data.length; i += 4) {
      if (restored.data[i] > 0) { anyAlpha = true; break; }
    }
    setHasMaskContent(anyAlpha);
    setHistoryVersion((v) => v + 1);
  }, []);

  const redo = useCallback(() => {
    const ctx = maskCanvasRef.current?.getContext('2d');
    const canvas = maskCanvasRef.current;
    if (!ctx || !canvas) return;
    const snap = redoStackRef.current.pop();
    if (!snap) return;
    undoStackRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    ctx.putImageData(snap, 0, 0);
    setHasMaskContent(true);
    setHistoryVersion((v) => v + 1);
  }, []);

  const onPointerDown = useCallback(
    (ev: React.PointerEvent<HTMLCanvasElement>) => {
      if (result) return; // After a result, mask is read-only until reset.
      ev.currentTarget.setPointerCapture(ev.pointerId);
      const p = pointerToNative(ev);
      if (!p) return;
      // Capture pre-stroke state so undo restores to the moment before
      // this stroke began. Done before any stamp is laid down.
      snapshotMaskBeforeStroke();
      setIsPainting(true);
      setLastPoint(p);
      stamp(p.x, p.y);
    },
    [pointerToNative, result, snapshotMaskBeforeStroke, stamp],
  );

  const onPointerMove = useCallback(
    (ev: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isPainting) return;
      const p = pointerToNative(ev);
      if (!p) return;
      stampSegment(p.x, p.y);
      setLastPoint(p);
    },
    [isPainting, pointerToNative, stampSegment],
  );

  const onPointerUp = useCallback(
    (ev: React.PointerEvent<HTMLCanvasElement>) => {
      if (ev.currentTarget.hasPointerCapture(ev.pointerId)) {
        ev.currentTarget.releasePointerCapture(ev.pointerId);
      }
      setIsPainting(false);
      setLastPoint(null);
    },
    [],
  );

  const clearMask = useCallback(() => {
    const ctx = maskCanvasRef.current?.getContext('2d');
    if (!ctx || !maskCanvasRef.current) return;
    // A clear is also a stroke for undo purposes — photographer can undo
    // back to whatever they had painted before they cleared.
    snapshotMaskBeforeStroke();
    ctx.clearRect(0, 0, maskCanvasRef.current.width, maskCanvasRef.current.height);
    setHasMaskContent(false);
    setResult(null);
    setShowOriginal(false);
    setError(null);
  }, [snapshotMaskBeforeStroke]);

  /** Convert the colour mask canvas (white-on-transparent, semi-opaque
   *  red preview) to the binary PNG mask the server expects: white where
   *  the alpha channel is non-zero, black elsewhere. */
  const exportBinaryMaskPng = useCallback(async (): Promise<Blob | null> => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return null;
    const ctx = maskCanvas.getContext('2d');
    if (!ctx) return null;
    const w = maskCanvas.width;
    const h = maskCanvas.height;
    const data = ctx.getImageData(0, 0, w, h);
    const out = new Uint8ClampedArray(w * h * 4);
    for (let i = 0, j = 0; i < data.data.length; i += 4, j += 4) {
      const v = data.data[i + 3] >= 32 ? 255 : 0;
      out[j + 0] = v;
      out[j + 1] = v;
      out[j + 2] = v;
      out[j + 3] = 255;
    }
    const offscreen = document.createElement('canvas');
    offscreen.width = w;
    offscreen.height = h;
    const offCtx = offscreen.getContext('2d');
    if (!offCtx) return null;
    offCtx.putImageData(new ImageData(out, w, h), 0, 0);
    return await new Promise<Blob | null>((resolve) =>
      offscreen.toBlob((b) => resolve(b), 'image/png'),
    );
  }, []);

  const exportImageBlob = useCallback(async (): Promise<Blob | null> => {
    const imageCanvas = imageCanvasRef.current;
    if (!imageCanvas) return null;
    return await new Promise<Blob | null>((resolve) =>
      imageCanvas.toBlob((b) => resolve(b), 'image/jpeg', 0.95),
    );
  }, []);

  const runInpaint = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const [imageBlob, maskBlob] = await Promise.all([
        exportImageBlob(),
        exportBinaryMaskPng(),
      ]);
      if (!imageBlob || !maskBlob) {
        throw new Error('Kunne ikke eksportere bilde + maske fra canvas.');
      }
      const fd = new FormData();
      fd.append('image', imageBlob, 'image.jpg');
      fd.append('mask', maskBlob, 'mask.png');
      fd.append('intensity', '1');

      const res = await fetch('/api/photo-enhancer/inpaint', {
        method: 'POST',
        body: fd,
      });
      const json = (await res.json()) as InpaintResponse;
      if (!res.ok || !json.success || !json.imageBase64 || !json.recipe) {
        throw new Error(
          json.error
            ? `${json.error}${json.detail ? `: ${json.detail}` : ''}`
            : `inpaint feilet (HTTP ${res.status})`,
        );
      }
      const dataUrl = `data:${json.imageMime || 'image/jpeg'};base64,${json.imageBase64}`;

      // Render result into the dedicated canvas so A/B compare can swap
      // it in/out without re-decoding the data URL each toggle.
      await new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          const c = inpaintedCanvasRef.current;
          if (c && imgNative) {
            c.width = imgNative.w;
            c.height = imgNative.h;
            c.getContext('2d')?.drawImage(img, 0, 0);
          }
          resolve();
        };
        img.src = dataUrl;
      });

      setResult({
        imageDataUrl: dataUrl,
        recipe: json.recipe,
        strategyUsed: json.strategyUsed || json.recipe.strategy,
        executorWarnings: json.executorWarnings || [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [exportBinaryMaskPng, exportImageBlob, imgNative]);

  const apply = useCallback(() => {
    if (!result) return;
    const allWarnings = [...result.recipe.warnings, ...result.executorWarnings];
    onApply(result.imageDataUrl, result.recipe, allWarnings);
  }, [onApply, result]);

  // Derived display dimensions for both canvases.
  const displayWidth = imgNative ? imgNative.w * displayScale : 0;
  const displayHeight = imgNative ? imgNative.h * displayScale : 0;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2, minWidth: 360 }}>
      <Stack direction="row" alignItems="center" spacing={2}>
        <Typography variant="h6" sx={{ flex: 1 }}>
          Fjern objekter
        </Typography>
        <IconButton onClick={onClose} size="small" aria-label="Lukk">
          <CloseIcon />
        </IconButton>
      </Stack>

      <Typography variant="body2" color="text.secondary">
        Mal over det du vil fjerne — typisk blits, lys-kabel, lys-stativ eller annet
        utstyr som ble igjen i kanten av frame. Claude planlegger fyll-strategien,
        serveren utfører.
      </Typography>

      {error && <Alert severity="error">{error}</Alert>}

      <Box
        sx={{
          position: 'relative',
          width: displayWidth || '100%',
          height: displayHeight || 'auto',
          alignSelf: 'center',
          backgroundColor: 'grey.900',
          minHeight: 200,
        }}
      >
        <canvas
          ref={imageCanvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: displayWidth,
            height: displayHeight,
            display: result && !showOriginal ? 'none' : 'block',
          }}
        />
        <canvas
          ref={inpaintedCanvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: displayWidth,
            height: displayHeight,
            display: result && !showOriginal ? 'block' : 'none',
          }}
        />
        <canvas
          ref={maskCanvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: displayWidth,
            height: displayHeight,
            opacity: result ? 0 : 0.45,
            mixBlendMode: 'screen',
            cursor: result ? 'default' : 'crosshair',
            touchAction: 'none',
          }}
        />
      </Box>

      <Stack direction="row" spacing={2} alignItems="center">
        <Typography variant="body2" sx={{ minWidth: 80 }}>
          Pensel
        </Typography>
        <Slider
          value={brushRadius}
          min={BRUSH_MIN}
          max={BRUSH_MAX}
          onChange={(_, v) => setBrushRadius(v as number)}
          disabled={Boolean(result)}
          sx={{ flex: 1 }}
        />
        <Typography variant="body2" sx={{ minWidth: 40, textAlign: 'right' }}>
          {brushRadius}px
        </Typography>
      </Stack>

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Button
          startIcon={<UndoIcon />}
          onClick={undo}
          disabled={busy || Boolean(result) || undoStackRef.current.length === 0}
          title="Angre siste pensel-strek"
        >
          Angre
        </Button>
        <Button
          startIcon={<RedoIcon />}
          onClick={redo}
          disabled={busy || Boolean(result) || redoStackRef.current.length === 0}
          title="Gjør om angret strek"
        >
          Gjør om
        </Button>
        <Button
          startIcon={<RestartAltIcon />}
          onClick={clearMask}
          disabled={busy || (!hasMaskContent && !result)}
        >
          Tøm maske
        </Button>
        {!result && (
          <Button
            variant="contained"
            onClick={runInpaint}
            disabled={busy || !hasMaskContent}
            startIcon={busy ? <CircularProgress size={14} /> : undefined}
          >
            {busy ? 'Foreslår…' : 'Foreslå & fjern'}
          </Button>
        )}
        {result && (
          <>
            <Button
              startIcon={<CompareIcon />}
              onClick={() => setShowOriginal((v) => !v)}
              variant={showOriginal ? 'contained' : 'outlined'}
            >
              {showOriginal ? 'Viser original' : 'Vis original'}
            </Button>
            <Button variant="contained" color="primary" onClick={apply}>
              Bruk
            </Button>
          </>
        )}
      </Stack>

      {result && (
        <Stack spacing={1}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Chip size="small" label={`Strategi: ${result.strategyUsed}`} color="primary" />
            {result.recipe.postFreqSepSkin && (
              <Chip size="small" label="+ freq-sep skin" />
            )}
          </Stack>
          {result.recipe.rationale && (
            <Typography variant="body2" color="text.secondary">
              {result.recipe.rationale}
            </Typography>
          )}
          {result.recipe.warnings.map((w, i) => (
            <Alert key={`claude-${i}`} severity="warning">
              {w}
            </Alert>
          ))}
          {result.executorWarnings.map((w, i) => (
            <Alert key={`exec-${i}`} severity="info">
              {w}
            </Alert>
          ))}
        </Stack>
      )}
    </Box>
  );
};

export default ObjectRemovalEditor;
