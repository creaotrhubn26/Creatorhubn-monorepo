import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Slider,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  decompose,
  float32ToRgba,
  gaussianBlur,
  rgbaToFloat32,
  visualiseSignedBand,
  type DecomposeOptions,
  type DecompositionBands,
  type Float32Image,
  type Rgba8Buffer,
} from '../../lib/frequency-sep/decomposition';
import {
  beginStroke,
  DEFAULT_BRUSH_SETTINGS,
  extendStroke,
  forEachStampPixel,
  type BrushSample,
  type BrushSettings,
  type BrushStamp,
  type StrokeState,
} from '../../lib/frequency-sep/brush';
import {
  makeBlurLowOp,
  makeCloneOp,
  makeDodgeBurnOp,
  makeHealOp,
  makeSmoothMidOp,
  type BrushOp,
  type DodgeBurnRange,
} from '../../lib/frequency-sep/brush-modes';
import {
  emptyRect,
  paintBandsToRgba,
  stampRect,
  unionRect,
  type Rect,
} from '../../lib/frequency-sep/compositor';
import {
  normalisePointerInput,
  shouldStartStroke,
} from '../../lib/frequency-sep/pointer-input';
import {
  beginStrokeRecorder,
  canBrushRedo,
  canBrushUndo,
  createBrushHistory,
  finishStrokeRecorder,
  pushBrushPatch,
  redoBrushStroke,
  undoBrushStroke,
  recordRectInStroke,
  type BrushHistory,
  type StrokeRecorder,
} from '../../lib/frequency-sep/brush-history';

export type BrushMode = 'blur-low' | 'smooth-mid' | 'heal' | 'clone' | 'dodge' | 'burn';
export type ViewBand = 'composite' | 'low' | 'mid' | 'high';

export interface FrequencySepEditorProps {
  /** 8-bit RGBA source — e.g. `ctx.getImageData(...)` from a decoded image. */
  source: Rgba8Buffer;
  /** Fires whenever the user commits the current edit (toolbar button). */
  onCommit?: (edited: Rgba8Buffer) => void;
  initialBrushSettings?: Partial<BrushSettings>;
  initialDecompose?: Partial<DecomposeOptions>;
}

const MODE_LABELS: Record<BrushMode, string> = {
  'blur-low': 'Jevn tone (low)',
  'smooth-mid': 'Glatt mid',
  heal: 'Heal',
  clone: 'Klon',
  dodge: 'Dodge',
  burn: 'Burn',
};

const VIEW_LABELS: Record<ViewBand, string> = {
  composite: 'Ferdig',
  low: 'Low',
  mid: 'Mid',
  high: 'High',
};

const DEFAULT_DECOMPOSE: DecomposeOptions = {
  lowSigma: 12,
  midSigma: 3,
  useBilateralLow: false,
  bilateralRangeSigma: 0.08,
};

/**
 * Wire-up component that takes a raw 8-bit image, runs it through the
 * float32 frequency-separation pipeline, and exposes a brush UI on top
 * of a canvas. Each brush stroke mutates the band buffers in place and
 * repaints only the touched rectangle, so feedback stays snappy even
 * on larger stills.
 *
 * This component is the mouse-driven skeleton — A2.5 upgrades pointer
 * handling to the Pointer Events API for real stylus pressure, and
 * A2.6 wires per-stroke undo into the enhancer-session history.
 */
export function FrequencySepEditor(props: FrequencySepEditorProps) {
  const { source, onCommit } = props;

  const [mode, setMode] = useState<BrushMode>('blur-low');
  const [view, setView] = useState<ViewBand>('composite');
  const [brushSettings, setBrushSettings] = useState<BrushSettings>(() => ({
    ...DEFAULT_BRUSH_SETTINGS,
    ...props.initialBrushSettings,
  }));
  const [decomposeOpts, setDecomposeOpts] = useState<DecomposeOptions>(() => ({
    ...DEFAULT_DECOMPOSE,
    ...props.initialDecompose,
  }));
  const [textureSigma, setTextureSigma] = useState(6);
  const [dodgeBurnRange, setDodgeBurnRange] = useState<DodgeBurnRange>('midtones');
  const [dodgeBurnAmount, setDodgeBurnAmount] = useState(0.04);
  /** Image-space source anchor for heal/clone, set via alt-click. */
  const [sourceAnchor, setSourceAnchor] = useState<{ x: number; y: number } | null>(null);
  /** Per-stroke locked offset (anchor − first stamp). Reset at stroke start. */
  const strokeOffsetRef = useRef<{ dx: number; dy: number } | null>(null);

  // --- refs that hold the heavy mutable state --------------------------------
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const bandsRef = useRef<DecompositionBands | null>(null);
  /** Reusable ImageData backing the visible canvas — allocated once via
   *  `ctx.createImageData` so its `.data` is the ArrayBuffer-backed storage
   *  that `putImageData` expects. We mutate `.data` in place. */
  const imageDataRef = useRef<ImageData | null>(null);
  /** Cached blurred-low / blurred-mid for blur-low / smooth-mid modes. Recomputed
   *  on stroke start so each stroke uses a fresh reference blur. */
  const blurredLowRef = useRef<Float32Image | null>(null);
  const blurredMidRef = useRef<Float32Image | null>(null);
  const strokeStateRef = useRef<StrokeState>(beginStroke());
  const drawingRef = useRef(false);

  // --- brush history ---------------------------------------------------------
  const [brushHistory, setBrushHistory] = useState<BrushHistory>(() =>
    createBrushHistory(),
  );
  const recorderRef = useRef<StrokeRecorder | null>(null);

  const { width, height } = source;

  // --- decompose whenever source or decomposition opts change ----------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const float = rgbaToFloat32(source);
    const bands = decompose(float, decomposeOpts);
    bandsRef.current = bands;
    const imageData = ctx.createImageData(width, height);
    paintBandsToRgba(
      bands,
      { x0: 0, y0: 0, x1: width - 1, y1: height - 1 },
      imageData.data,
    );
    imageDataRef.current = imageData;
    drawView();
    // Drop stale blur caches — sigmas and bands both changed.
    blurredLowRef.current = null;
    blurredMidRef.current = null;
    // Brush history references the previous bands' chunk data — those
    // Float32Arrays now point at pixels that no longer exist in the
    // current decomposition, so replaying them would corrupt state.
    setBrushHistory(createBrushHistory());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, decomposeOpts]);

  // Redraw whenever the view-band selector changes.
  useEffect(() => {
    drawView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  /** Paint the currently selected band into the visible canvas. */
  const drawView = useCallback(() => {
    const canvas = canvasRef.current;
    const bands = bandsRef.current;
    const imageData = imageDataRef.current;
    if (!canvas || !bands || !imageData) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (view === 'composite') {
      ctx.putImageData(imageData, 0, 0);
      return;
    }
    let band: Float32Image | null = null;
    if (view === 'low') band = bands.low;
    else if (view === 'mid' && bands.kind === 'three-band') band = bands.mid;
    else if (view === 'high') band = bands.high;
    if (!band) {
      ctx.putImageData(imageData, 0, 0);
      return;
    }
    const rendered = view === 'low' ? band : visualiseSignedBand(band);
    const bytes = float32ToRgba(rendered);
    // Reuse a one-off ImageData via ctx.createImageData so the data-array
    // generic parameter matches the DOM lib (`Uint8ClampedArray<ArrayBuffer>`).
    const out = ctx.createImageData(bytes.width, bytes.height);
    out.data.set(bytes.data);
    ctx.putImageData(out, 0, 0);
  }, [view]);

  /** Repaint a dirty rect of the composite into the ImageData buffer and blit. */
  const repaintRect = useCallback(
    (rect: Rect) => {
      const canvas = canvasRef.current;
      const bands = bandsRef.current;
      const imageData = imageDataRef.current;
      if (!canvas || !bands || !imageData) return;
      if (view !== 'composite') {
        // Band previews redraw in full via `drawView`; live-brush feedback
        // is only shown on the composite because the individual bands are
        // diagnostic rather than interactive.
        return;
      }
      paintBandsToRgba(bands, rect, imageData.data);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const w = rect.x1 - rect.x0 + 1;
      const h = rect.y1 - rect.y0 + 1;
      if (w <= 0 || h <= 0) return;
      ctx.putImageData(imageData, 0, 0, rect.x0, rect.y0, w, h);
    },
    [view],
  );

  /** Build the op callback for the current mode, closing over any cached state. */
  const buildOp = useCallback((): BrushOp | null => {
    const bands = bandsRef.current;
    if (!bands) return null;
    switch (mode) {
      case 'blur-low': {
        if (!blurredLowRef.current) {
          blurredLowRef.current = gaussianBlur(bands.low, textureSigma);
        }
        return makeBlurLowOp(bands, blurredLowRef.current);
      }
      case 'smooth-mid': {
        if (bands.kind !== 'three-band') return null;
        if (!blurredMidRef.current) {
          blurredMidRef.current = gaussianBlur(bands.mid, Math.max(1, textureSigma / 2));
        }
        return makeSmoothMidOp(bands, blurredMidRef.current);
      }
      case 'heal':
      case 'clone': {
        const offset = strokeOffsetRef.current;
        if (!offset) return null;
        return mode === 'heal'
          ? makeHealOp(bands, offset)
          : makeCloneOp(bands, offset);
      }
      case 'dodge':
        return makeDodgeBurnOp(bands.low, dodgeBurnAmount, dodgeBurnRange);
      case 'burn':
        return makeDodgeBurnOp(bands.low, -dodgeBurnAmount, dodgeBurnRange);
      default:
        return null;
    }
  }, [mode, textureSigma, dodgeBurnAmount, dodgeBurnRange]);

  /** Apply a batch of stamps: snapshot the pre-state into the history
   *  recorder, run ops, union their footprints, repaint once. Recording
   *  MUST happen before the op — `recordRectInStroke` captures the
   *  bands' current chunk data, so calling it post-op would stash the
   *  already-mutated state and break undo. */
  const applyStamps = useCallback(
    (stamps: BrushStamp[]) => {
      if (stamps.length === 0) return;
      const op = buildOp();
      if (!op) return;
      const recorder = recorderRef.current;
      let dirty: Rect = emptyRect();
      for (const s of stamps) {
        const r = stampRect(s.cx, s.cy, s.radius, width, height);
        if (recorder) recordRectInStroke(recorder, r);
        forEachStampPixel(s, { width, height }, op);
        dirty = unionRect(dirty, r);
      }
      repaintRect(dirty);
    },
    [buildOp, repaintRect, width, height],
  );

  // --- pointer handling (Pointer Events API for stylus pressure + tilt) ------
  // `activePointerIdRef` tracks the single pointer currently painting a stroke
  // so secondary fingers / mouse clicks during a stylus stroke get ignored.
  const activePointerIdRef = useRef<number | null>(null);
  /** True while a pen pointer is down — used for palm rejection against touch. */
  const penDownRef = useRef(false);

  const toImageCoords = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const sx = canvas.width / rect.width;
      const sy = canvas.height / rect.height;
      return {
        x: (clientX - rect.left) * sx,
        y: (clientY - rect.top) * sy,
      };
    },
    [],
  );

  /** Convert a PointerEvent-shaped object to a stroke sample in image coords. */
  const pointerEventToSample = useCallback(
    (e: {
      clientX: number;
      clientY: number;
      pointerType: string;
      pressure: number;
      tiltX?: number;
      tiltY?: number;
    }): BrushSample => {
      const pt = toImageCoords(e.clientX, e.clientY);
      const norm = normalisePointerInput({
        pointerType: e.pointerType,
        pressure: e.pressure,
        tiltX: e.tiltX,
        tiltY: e.tiltY,
      });
      return {
        x: pt.x,
        y: pt.y,
        pressure: norm.pressure,
        tiltX: norm.tiltX,
        tiltY: norm.tiltY,
      };
    },
    [toImageCoords],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      // Alt-click (or alt-tap with stylus) sets the clone/heal source anchor.
      if (e.altKey) {
        setSourceAnchor(toImageCoords(e.clientX, e.clientY));
        return;
      }
      if (
        !shouldStartStroke(
          e.pointerType,
          e.isPrimary,
          activePointerIdRef.current,
          penDownRef.current && e.pointerType !== 'pen',
        )
      ) {
        return;
      }

      // Lock the pointer to this canvas — stroke keeps firing move events
      // even if the cursor/pen briefly leaves the bounding rect, which
      // happens constantly near the image edge.
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Some browsers throw on already-captured pointers; non-fatal.
      }
      activePointerIdRef.current = e.pointerId;
      if (e.pointerType === 'pen') penDownRef.current = true;

      const sample = pointerEventToSample(e);

      if ((mode === 'heal' || mode === 'clone') && sourceAnchor) {
        strokeOffsetRef.current = {
          dx: sourceAnchor.x - sample.x,
          dy: sourceAnchor.y - sample.y,
        };
      } else {
        strokeOffsetRef.current = null;
      }
      // Invalidate blur caches at stroke start so blur-low uses current band state.
      blurredLowRef.current = null;
      blurredMidRef.current = null;
      drawingRef.current = true;
      strokeStateRef.current = beginStroke();
      // Begin a history recorder for this stroke — it lazily snapshots
      // each chunk the first time a stamp touches it.
      const bands = bandsRef.current;
      if (bands) {
        recorderRef.current = beginStrokeRecorder(bands, MODE_LABELS[mode]);
      }
      const result = extendStroke(strokeStateRef.current, sample, brushSettings);
      strokeStateRef.current = result.state;
      applyStamps(result.stamps);
    },
    [
      toImageCoords,
      pointerEventToSample,
      mode,
      sourceAnchor,
      brushSettings,
      applyStamps,
    ],
  );

  /** Overlay canvas shows the brush cursor circle (semi-transparent outline). */
  const drawOverlayCursor = useCallback(
    (clientX: number, clientY: number) => {
      const overlay = overlayRef.current;
      if (!overlay) return;
      const ctx = overlay.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, overlay.width, overlay.height);
      const rect = overlay.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const displayScale = overlay.width / rect.width;
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x * displayScale, y * displayScale, brushSettings.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.beginPath();
      ctx.arc(
        x * displayScale,
        y * displayScale,
        brushSettings.radius * brushSettings.hardness,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
      ctx.restore();
    },
    [brushSettings.radius, brushSettings.hardness],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      // Always keep the brush-cursor overlay tracking the primary hover pointer
      // so the user can see footprint/hardness before pressing.
      drawOverlayCursor(e.clientX, e.clientY);

      if (!drawingRef.current) return;
      if (e.pointerId !== activePointerIdRef.current) return;

      // iPad Pencil fires at 240Hz internally but pointermove bundles them
      // into 60Hz events. `getCoalescedEvents()` exposes the full sample set;
      // feeding every one through the stroke interpolator gives visibly
      // smoother curves on fast strokes.
      const native = e.nativeEvent;
      const coalesced: PointerEvent[] =
        typeof native.getCoalescedEvents === 'function'
          ? native.getCoalescedEvents()
          : [];
      const samples = coalesced.length > 0 ? coalesced : [native];

      for (const evt of samples) {
        const sample = pointerEventToSample(evt);
        const result = extendStroke(strokeStateRef.current, sample, brushSettings);
        strokeStateRef.current = result.state;
        applyStamps(result.stamps);
      }
    },
    [pointerEventToSample, brushSettings, applyStamps, drawOverlayCursor],
  );

  const endStroke = useCallback(
    (e?: React.PointerEvent<HTMLCanvasElement>) => {
      if (e && e.pointerId !== activePointerIdRef.current) return;
      const wasDrawing = drawingRef.current;
      drawingRef.current = false;
      strokeStateRef.current = beginStroke();

      // Close out the history recorder and push the resulting patch.
      // If the user pressed and released without drawing anything (no
      // chunks touched), `finishStrokeRecorder` returns null and we
      // skip the push — avoids polluting history with empty entries.
      if (wasDrawing && recorderRef.current) {
        const patch = finishStrokeRecorder(recorderRef.current);
        recorderRef.current = null;
        if (patch) {
          setBrushHistory((prev) => pushBrushPatch(prev, patch));
        }
      } else {
        recorderRef.current = null;
      }

      if (e) {
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
          // Pointer may already be released; fine.
        }
        if (e.pointerType === 'pen') penDownRef.current = false;
      }
      activePointerIdRef.current = null;
    },
    [],
  );

  // --- undo / redo ------------------------------------------------------------
  const handleUndo = useCallback(() => {
    const bands = bandsRef.current;
    if (!bands) return;
    setBrushHistory((prev) => {
      const { history, patch } = undoBrushStroke(prev, bands);
      if (patch) repaintRect(patch.rect);
      return history;
    });
  }, [repaintRect]);

  const handleRedo = useCallback(() => {
    const bands = bandsRef.current;
    if (!bands) return;
    setBrushHistory((prev) => {
      const { history, patch } = redoBrushStroke(prev, bands);
      if (patch) repaintRect(patch.rect);
      return history;
    });
  }, [repaintRect]);

  // Keyboard shortcuts: Cmd/Ctrl+Z undo, Cmd/Ctrl+Shift+Z redo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key.toLowerCase() !== 'z') return;
      e.preventDefault();
      if (e.shiftKey) handleRedo();
      else handleUndo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleUndo, handleRedo]);

  // --- commit -----------------------------------------------------------------
  const handleCommit = useCallback(() => {
    const imageData = imageDataRef.current;
    if (!imageData || !onCommit) return;
    onCommit({
      data: new Uint8ClampedArray(imageData.data),
      width,
      height,
    });
  }, [onCommit, width, height]);

  // --- mode-specific validation ----------------------------------------------
  const needsSource = mode === 'heal' || mode === 'clone';
  const isThreeBand = bandsRef.current?.kind === 'three-band';
  const canUseSmoothMid = isThreeBand;

  const modeHelp = useMemo(() => {
    if (needsSource && !sourceAnchor) {
      return 'Alt-klikk på rent område for å sette kilde.';
    }
    if (mode === 'smooth-mid' && !canUseSmoothMid) {
      return 'Skru på mid-bånd nedenfor for å bruke denne.';
    }
    return null;
  }, [needsSource, sourceAnchor, mode, canUseSmoothMid]);

  return (
    <Stack direction="row" spacing={2} sx={{ width: '100%', alignItems: 'stretch' }}>
      <Box
        sx={{
          flex: 1,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: '#0a0a0a',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ position: 'relative', maxWidth: '100%', maxHeight: '100%' }}>
          <canvas
            ref={canvasRef}
            width={width}
            height={height}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endStroke}
            onPointerCancel={endStroke}
            onPointerLeave={(e) => {
              // With pointer capture active the pointer keeps firing move
              // events even after leaving the bounding rect — leaving is a
              // normal part of the stroke, don't end it. Without capture
              // (e.g. mouse hover), a leave really means the stroke is over.
              if (!e.currentTarget.hasPointerCapture(e.pointerId)) {
                endStroke(e);
              }
            }}
            // touchAction: 'none' prevents iPad Safari from interpreting a
            // drag as a page pan/zoom — without this, finger drawing scrolls
            // the page instead of painting.
            style={{
              display: 'block',
              maxWidth: '100%',
              maxHeight: '80vh',
              touchAction: 'none',
            }}
          />
          <canvas
            ref={overlayRef}
            width={width}
            height={height}
            style={{
              display: 'block',
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              maxWidth: '100%',
              maxHeight: '80vh',
            }}
          />
        </Box>
      </Box>

      <Paper
        elevation={1}
        sx={{ width: 280, p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <FormControl size="small">
          <InputLabel>Modus</InputLabel>
          <Select
            value={mode}
            label="Modus"
            onChange={(e) => setMode(e.target.value as BrushMode)}
          >
            {(Object.keys(MODE_LABELS) as BrushMode[]).map((m) => (
              <MenuItem
                key={m}
                value={m}
                disabled={m === 'smooth-mid' && !canUseSmoothMid}
              >
                {MODE_LABELS[m]}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {modeHelp && (
          <Typography variant="caption" color="text.secondary">
            {modeHelp}
          </Typography>
        )}

        <Box>
          <Typography variant="caption">Radius: {brushSettings.radius} px</Typography>
          <Slider
            size="small"
            min={2}
            max={120}
            value={brushSettings.radius}
            onChange={(_, v) =>
              setBrushSettings((s) => ({ ...s, radius: Array.isArray(v) ? v[0] : v }))
            }
          />
        </Box>

        <Box>
          <Typography variant="caption">
            Hardhet: {brushSettings.hardness.toFixed(2)}
          </Typography>
          <Slider
            size="small"
            min={0}
            max={1}
            step={0.01}
            value={brushSettings.hardness}
            onChange={(_, v) =>
              setBrushSettings((s) => ({ ...s, hardness: Array.isArray(v) ? v[0] : v }))
            }
          />
        </Box>

        <Box>
          <Typography variant="caption">Flow: {brushSettings.flow.toFixed(2)}</Typography>
          <Slider
            size="small"
            min={0}
            max={1}
            step={0.01}
            value={brushSettings.flow}
            onChange={(_, v) =>
              setBrushSettings((s) => ({ ...s, flow: Array.isArray(v) ? v[0] : v }))
            }
          />
        </Box>

        {(mode === 'blur-low' || mode === 'smooth-mid') && (
          <Box>
            <Typography variant="caption">Glatt-sigma: {textureSigma} px</Typography>
            <Slider
              size="small"
              min={1}
              max={30}
              value={textureSigma}
              onChange={(_, v) => {
                setTextureSigma(Array.isArray(v) ? v[0] : v);
                blurredLowRef.current = null;
                blurredMidRef.current = null;
              }}
            />
          </Box>
        )}

        {(mode === 'dodge' || mode === 'burn') && (
          <>
            <Box>
              <Typography variant="caption">
                Styrke: {dodgeBurnAmount.toFixed(3)}
              </Typography>
              <Slider
                size="small"
                min={0.01}
                max={0.2}
                step={0.005}
                value={dodgeBurnAmount}
                onChange={(_, v) =>
                  setDodgeBurnAmount(Array.isArray(v) ? v[0] : v)
                }
              />
            </Box>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={dodgeBurnRange}
              onChange={(_, v) => v && setDodgeBurnRange(v)}
            >
              <ToggleButton value="shadows">Skygger</ToggleButton>
              <ToggleButton value="midtones">Mid</ToggleButton>
              <ToggleButton value="highlights">Høylys</ToggleButton>
              <ToggleButton value="all">Alt</ToggleButton>
            </ToggleButtonGroup>
          </>
        )}

        <Box>
          <Typography variant="caption">Visning</Typography>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={view}
            onChange={(_, v) => v && setView(v)}
            sx={{ width: '100%' }}
          >
            {(Object.keys(VIEW_LABELS) as ViewBand[]).map((v) => (
              <ToggleButton
                key={v}
                value={v}
                disabled={v === 'mid' && !canUseSmoothMid}
                sx={{ flex: 1 }}
              >
                {VIEW_LABELS[v]}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>

        <Box>
          <Typography variant="caption">
            Low-sigma: {decomposeOpts.lowSigma} px
          </Typography>
          <Slider
            size="small"
            min={4}
            max={40}
            value={decomposeOpts.lowSigma}
            onChange={(_, v) =>
              setDecomposeOpts((o) => ({
                ...o,
                lowSigma: Array.isArray(v) ? v[0] : v,
              }))
            }
          />
        </Box>

        <Box>
          <Typography variant="caption">
            Mid-sigma: {decomposeOpts.midSigma ?? 0} px (0 = kun to-band)
          </Typography>
          <Slider
            size="small"
            min={0}
            max={Math.max(1, decomposeOpts.lowSigma - 1)}
            value={decomposeOpts.midSigma ?? 0}
            onChange={(_, v) =>
              setDecomposeOpts((o) => ({
                ...o,
                midSigma: (Array.isArray(v) ? v[0] : v) || undefined,
              }))
            }
          />
        </Box>

        <Tooltip title="Bruker bilateral filter i stedet for ren Gauss for low-bånd. Bevarer harde kanter (kjevelinje, øyefransjer).">
          <Button
            size="small"
            variant={decomposeOpts.useBilateralLow ? 'contained' : 'outlined'}
            onClick={() =>
              setDecomposeOpts((o) => ({ ...o, useBilateralLow: !o.useBilateralLow }))
            }
          >
            {decomposeOpts.useBilateralLow ? 'Bilateral low: på' : 'Bilateral low: av'}
          </Button>
        </Tooltip>

        <Stack direction="row" spacing={1} sx={{ mt: 'auto' }}>
          <Tooltip title="Angre siste strøk (⌘Z)">
            <span style={{ flex: 1 }}>
              <Button
                fullWidth
                variant="outlined"
                size="small"
                onClick={handleUndo}
                disabled={!canBrushUndo(brushHistory)}
              >
                Angre
              </Button>
            </span>
          </Tooltip>
          <Tooltip title="Gjenta strøk (⌘⇧Z)">
            <span style={{ flex: 1 }}>
              <Button
                fullWidth
                variant="outlined"
                size="small"
                onClick={handleRedo}
                disabled={!canBrushRedo(brushHistory)}
              >
                Gjenta
              </Button>
            </span>
          </Tooltip>
        </Stack>

        <Button variant="contained" onClick={handleCommit} disabled={!onCommit}>
          Bruk endringer
        </Button>
      </Paper>
    </Stack>
  );
}
