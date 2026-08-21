// @ts-nocheck
/**
 * StoryboardBoardPage — piksel-tro implementasjon av mål-designet
 * («Neon City»-mockupen, STORYBOARD_DESIGN.md §4b) med Role Room-brand:
 * mockupens blå aksent er byttet mot fiolett #8b5cf6; chrome-gråtonene og
 * den lyse arbeidsflaten/arket følger mockupen.
 *
 * Fullskjerms-overlay montert fra StoryboardView (workspaceMode 'pro').
 * Gjenbruker eksisterende data og handlinger via props — ingen egen
 * persistens (patchFrame går til samme sync som resten).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getStampConfigForBrush, renderStrokeStamped, stampSegment, resetCtxAfterStamp } from './stampEngine';
import { applyStreamline } from './PencilCanvasPro';
import { Box, Stack, Typography, IconButton, Button, TextField, Menu, MenuItem, Tooltip, Chip } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import PanToolAltIcon from '@mui/icons-material/PanToolAlt';
import BackHandIcon from '@mui/icons-material/BackHand';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import FitScreenIcon from '@mui/icons-material/FitScreen';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import LockIcon from '@mui/icons-material/Lock';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import ShareIcon from '@mui/icons-material/IosShare';
import BrushIcon from '@mui/icons-material/Brush';
import CreateIcon from '@mui/icons-material/Create';
import AutoFixNormalIcon from '@mui/icons-material/AutoFixNormal';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import CropSquareIcon from '@mui/icons-material/CropSquare';
import TitleIcon from '@mui/icons-material/Title';
import GestureIcon from '@mui/icons-material/Gesture';
import NearMeIcon from '@mui/icons-material/NearMe';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import DashboardIcon from '@mui/icons-material/Dashboard';
import DescriptionIcon from '@mui/icons-material/Description';
import ListAltIcon from '@mui/icons-material/ListAlt';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';

const BRAND = '#8b5cf6';
const BRAND_SOFT = 'rgba(139,92,246,0.16)';
const CHROME = '#0b0b0e';
const PANEL = '#141519';
const PANEL_BORDER = 'rgba(255,255,255,0.07)';
const TEXT_DIM = 'rgba(255,255,255,0.55)';
const TEXT_LABEL = 'rgba(255,255,255,0.42)';
const WORKSPACE_BG = '#3c3e44';
const SHEET_BG = '#f7f6f2';

const SHOT_SIZE_OPTIONS = ['EWS', 'WS', 'MS', 'MCU', 'CU'];
const MOVEMENT_OPTIONS = ['Static', 'Pan', 'Tilt', 'Push In', 'Tracking'];
const MOVEMENT_GLYPHS: Record<string, string> = {
  Static: '⊙', Pan: '↔', Tilt: '↕', 'Push In': '→', Tracking: '⇢',
};
const TRANSITIONS = ['Cut', 'Dissolve', 'Match Cut', 'Smash Cut', 'Wipe', 'Fade'];
const FOCUS_OPTIONS = ['Shallow', 'Deep'];
const LABEL_COLORS = ['#ffffff', '#8b5cf6', '#ef6a6a', '#f0c24b', '#3fa46a', '#2fbdb3'];

// Shot size-ikon: enkel figur+ramme-glyf per størrelse (mockupens figurikoner)
const ShotSizeGlyph: React.FC<{ size: string; active: boolean }> = ({ size, active }) => {
  const color = active ? '#fff' : 'rgba(255,255,255,0.6)';
  const figures: Record<string, React.ReactNode> = {
    EWS: <><circle cx="8" cy="7" r="2" /><line x1="8" y1="9" x2="8" y2="15" /><line x1="8" y1="11" x2="5" y2="14" /><line x1="8" y1="11" x2="11" y2="14" /><circle cx="16" cy="7" r="2" /><line x1="16" y1="9" x2="16" y2="15" /></>,
    WS: <><circle cx="12" cy="6" r="2.4" /><line x1="12" y1="8.4" x2="12" y2="16" /><line x1="12" y1="10.5" x2="8.5" y2="14" /><line x1="12" y1="10.5" x2="15.5" y2="14" /><line x1="12" y1="16" x2="9.5" y2="20" /><line x1="12" y1="16" x2="14.5" y2="20" /></>,
    MS: <><circle cx="12" cy="6.5" r="3" /><line x1="12" y1="9.5" x2="12" y2="18" /><line x1="12" y1="12" x2="8" y2="16" /><line x1="12" y1="12" x2="16" y2="16" /></>,
    MCU: <><circle cx="12" cy="8" r="4" /><path d="M 5 20 Q 12 13 19 20" fill="none" /></>,
    CU: <><circle cx="12" cy="10" r="5.5" /><path d="M 4 21 Q 12 15 20 21" fill="none" /></>,
  };
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" stroke={color} strokeWidth="1.6" fill="none" strokeLinecap="round">
      {figures[size] ?? figures.MS}
    </svg>
  );
};

// Inline-tegning i aktiv rute (mockupens kjerne: pensel rett på arket).
// Gjenbruker web-motoren: stamp-preview under strøket, seedet stamp-commit
// ved slipp, StreamLine på posisjonene, strokes lagres som web-JSON-STRENG
// via onCommit → patchFrame (auto-thumbnail regenereres av eksisterende
// effekt siden thumbnailUrl nullstilles).
const parseStrokesJSON = (value: unknown): any[] => {
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

// Lag-rekkefølge på arket (bunn → topp) — matcher mockupens Layers-panel.
const BOARD_LAYERS = ['Drawing', 'Camera / Arrows', 'Dialog', 'Notes'] as const;
const ANNOTATION_COLOR = '#8b5cf6';

const InlineFrameCanvas: React.FC<{
  frame: any;
  brush: { type: string; size: number; color: string; opacity: number; smoothing: number };
  tool: string; // 'draw' | 'arrow' | 'rect' | 'text'
  activeLayer: string;
  hiddenLayers: Record<string, boolean>;
  lockedLayers: Record<string, boolean>;
  layerOpacity: Record<string, number>;
  onCommit: (strokesJSON: string) => void;
}> = ({ frame, brush, tool, activeLayer, hiddenLayers, lockedLayers, layerOpacity, onCommit }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewRef = useRef<HTMLCanvasElement | null>(null);
  const activePointsRef = useRef<any[]>([]);
  const carryRef = useRef(0);
  const strokesRef = useRef<any[]>([]);
  const shapeStartRef = useRef<any | null>(null);

  const buildBrush = useCallback(() => ({
    type: brush.type,
    size: brush.size,
    color: brush.color,
    opacity: brush.opacity,
    hardness: 0.6,
    flow: 0.9,
    wetness: 0,
    grain: brush.type === 'charcoal' ? 0.85 : brush.type === 'pencil' ? 0.7 : 0.3,
    tiltSensitivity: 0.5,
    pressureSensitivity: 0.9,
  }), [brush]);

  const renderCommitted = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fdfdfb';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Lag-sortert rendering: strøk uten boardLayer regnes som Drawing.
    const layerOrder = (stroke: any) => {
      const index = BOARD_LAYERS.indexOf(stroke.boardLayer ?? 'Drawing');
      return index === -1 ? 0 : index;
    };
    const visibleStrokes = [...strokesRef.current]
      .filter((stroke) => !hiddenLayers[stroke.boardLayer ?? 'Drawing'])
      .sort((a, b) => layerOrder(a) - layerOrder(b));
    for (const stroke of visibleStrokes) {
      const strokeLayerOpacity = layerOpacity[stroke.boardLayer ?? 'Drawing'] ?? 1;
      ctx.save();
      ctx.globalAlpha = strokeLayerOpacity;
      // Tekst-annotasjon («PUSH IN»-stil): spesialstrøk med textAnnotation.
      if (stroke.textAnnotation) {
        const anchor = stroke.points?.[0];
        if (anchor) {
          ctx.font = '700 52px Caveat, "Segoe Script", cursive';
          ctx.fillStyle = stroke.color ?? ANNOTATION_COLOR;
          ctx.fillText(String(stroke.textAnnotation).toUpperCase(), anchor.x, anchor.y);
        }
        ctx.restore();
        continue;
      }
      // Lag-opacity multipliseres inn i brush-opacity (stamp-motoren styrer
      // alpha per dab selv, så ctx.globalAlpha alene når ikke frem der).
      const strokeBrush = { ...buildBrush(), ...(stroke.brush ?? {}), size: stroke.width ?? 4, color: stroke.color ?? '#26282e', opacity: (stroke.opacity ?? 1) * strokeLayerOpacity };
      if (strokeBrush.type === 'eraser') {
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (let i = 1; i < (stroke.points?.length ?? 0); i++) {
          const a = stroke.points[i - 1];
          const b = stroke.points[i];
          const pressure = ((a.pressure ?? 0.7) + (b.pressure ?? 0.7)) / 2;
          ctx.lineWidth = Math.max(2, strokeBrush.size * 2 * (0.35 + 0.65 * pressure));
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
        ctx.restore();
        ctx.restore();
        continue;
      }
      const config = getStampConfigForBrush(strokeBrush.type);
      if (config) {
        renderStrokeStamped(ctx, stroke.points ?? [], strokeBrush, config, stroke.id ?? 'stroke');
      } else {
        ctx.save();
        ctx.strokeStyle = strokeBrush.color;
        ctx.globalAlpha = Math.min(1, strokeBrush.opacity * 0.8 * strokeLayerOpacity);
        ctx.lineWidth = strokeBrush.size;
        ctx.lineCap = 'round';
        ctx.beginPath();
        (stroke.points ?? []).forEach((point: any, index: number) => {
          if (index === 0) ctx.moveTo(point.x, point.y);
          else ctx.lineTo(point.x, point.y);
        });
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }
  }, [buildBrush, hiddenLayers, layerOpacity]);

  useEffect(() => {
    strokesRef.current = parseStrokesJSON(frame?.drawingData?.strokes);
    renderCommitted();
  }, [frame?.id, frame?.drawingData?.strokes, renderCommitted]);

  const toCanvasPoint = useCallback((event: React.PointerEvent) => {
    const canvas = previewRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * 1920,
      y: ((event.clientY - rect.top) / rect.height) * 1080,
      pressure: event.pressure > 0 ? event.pressure : 0.7,
      tiltX: (event as any).tiltX ?? 0,
      tiltY: (event as any).tiltY ?? 0,
      timestamp: performance.now(),
    };
  }, []);

  const makeAnnotationStroke = useCallback((points: any[], extra: Record<string, unknown> = {}) => ({
    id: `board-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    points,
    inputType: 'pencil',
    color: ANNOTATION_COLOR,
    width: 7,
    opacity: 0.95,
    boardLayer: 'Camera / Arrows',
    brush: { ...buildBrush(), type: 'ink', size: 7, color: ANNOTATION_COLOR, opacity: 0.95, grain: 0 },
    ...extra,
  }), [buildBrush]);

  const commitStrokes = useCallback((next: any[]) => {
    strokesRef.current = next;
    renderCommitted();
    onCommit(JSON.stringify(next));
  }, [onCommit, renderCommitted]);

  const handlePointerDown = useCallback((event: React.PointerEvent) => {
    if (lockedLayers[activeLayer] && tool === 'draw') return;
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    const point = toCanvasPoint(event);
    if (tool === 'text') {
      const text = window.prompt('Annotasjonstekst (f.eks. PUSH IN):');
      if (text?.trim()) {
        commitStrokes([...strokesRef.current, makeAnnotationStroke([point], { textAnnotation: text.trim() })]);
      }
      return;
    }
    if (tool === 'arrow' || tool === 'rect') {
      shapeStartRef.current = point;
      return;
    }
    activePointsRef.current = [point];
    carryRef.current = 0;
  }, [activeLayer, commitStrokes, lockedLayers, makeAnnotationStroke, toCanvasPoint, tool]);

  const handlePointerMove = useCallback((event: React.PointerEvent) => {
    const previewCtx = previewRef.current?.getContext('2d');
    if (!previewCtx) return;
    // Form-preview for pil/rekt: tegn gummistrikk-form fra start til pekeren.
    if ((tool === 'arrow' || tool === 'rect') && shapeStartRef.current) {
      const current = toCanvasPoint(event);
      const start = shapeStartRef.current;
      previewCtx.clearRect(0, 0, 1920, 1080);
      previewCtx.save();
      previewCtx.strokeStyle = ANNOTATION_COLOR;
      previewCtx.lineWidth = 7;
      previewCtx.lineCap = 'round';
      previewCtx.beginPath();
      if (tool === 'arrow') {
        previewCtx.moveTo(start.x, start.y);
        previewCtx.lineTo(current.x, current.y);
      } else {
        previewCtx.rect(Math.min(start.x, current.x), Math.min(start.y, current.y), Math.abs(current.x - start.x), Math.abs(current.y - start.y));
      }
      previewCtx.stroke();
      previewCtx.restore();
      return;
    }
    if (activePointsRef.current.length === 0) return;
    const point = toCanvasPoint(event);
    const previous = activePointsRef.current[activePointsRef.current.length - 1];
    activePointsRef.current.push(point);
    const liveBrush = buildBrush();
    if (liveBrush.type === 'eraser') {
      previewCtx.save();
      previewCtx.strokeStyle = 'rgba(180,180,180,0.5)';
      previewCtx.lineWidth = liveBrush.size * 2;
      previewCtx.lineCap = 'round';
      previewCtx.beginPath();
      previewCtx.moveTo(previous.x, previous.y);
      previewCtx.lineTo(point.x, point.y);
      previewCtx.stroke();
      previewCtx.restore();
      return;
    }
    const config = getStampConfigForBrush(liveBrush.type);
    if (config) {
      carryRef.current = stampSegment(previewCtx, previous, point, liveBrush, config, carryRef.current);
      resetCtxAfterStamp(previewCtx);
    }
  }, [buildBrush, toCanvasPoint]);

  const handlePointerUp = useCallback((event: React.PointerEvent) => {
    const previewCtx = previewRef.current?.getContext('2d');
    // Pil/rekt: generer annotasjonsstrøk på Camera/Arrows-laget.
    if ((tool === 'arrow' || tool === 'rect') && shapeStartRef.current) {
      const start = shapeStartRef.current;
      shapeStartRef.current = null;
      previewCtx?.clearRect(0, 0, 1920, 1080);
      const end = toCanvasPoint(event);
      if (Math.hypot(end.x - start.x, end.y - start.y) < 12) return;
      const press = (x: number, y: number) => ({ x, y, pressure: 0.85, tiltX: 0, tiltY: 0, timestamp: performance.now() });
      let points: any[];
      if (tool === 'arrow') {
        const angle = Math.atan2(end.y - start.y, end.x - start.x);
        const head = 34;
        points = [
          press(start.x, start.y), press(end.x, end.y),
          press(end.x - head * Math.cos(angle - 0.45), end.y - head * Math.sin(angle - 0.45)),
          press(end.x, end.y),
          press(end.x - head * Math.cos(angle + 0.45), end.y - head * Math.sin(angle + 0.45)),
        ];
      } else {
        const x0 = Math.min(start.x, end.x); const y0 = Math.min(start.y, end.y);
        const x1 = Math.max(start.x, end.x); const y1 = Math.max(start.y, end.y);
        points = [press(x0, y0), press(x1, y0), press(x1, y1), press(x0, y1), press(x0, y0)];
      }
      commitStrokes([...strokesRef.current, makeAnnotationStroke(points)]);
      return;
    }
    const points = activePointsRef.current;
    activePointsRef.current = [];
    previewCtx?.clearRect(0, 0, 1920, 1080);
    if (points.length < 2) return;
    const liveBrush = buildBrush();
    const smoothed = applyStreamline(points, (brush.smoothing / 100) * 0.92);
    const stroke = {
      id: `board-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      points: smoothed,
      inputType: 'pencil',
      color: liveBrush.color,
      width: liveBrush.size,
      opacity: liveBrush.opacity,
      boardLayer: activeLayer,
      brush: liveBrush,
    };
    commitStrokes([...strokesRef.current, stroke]);
  }, [activeLayer, brush.smoothing, buildBrush, commitStrokes, makeAnnotationStroke, toCanvasPoint, tool]);

  return (
    <Box sx={{ position: 'absolute', inset: 0 }}>
      <canvas ref={canvasRef} width={1920} height={1080} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      <canvas
        ref={previewRef} width={1920} height={1080}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', touchAction: 'none', cursor: 'crosshair' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        data-testid="board-inline-canvas"
      />
    </Box>
  );
};

// Enkel animatic-avspilling: frames i sekvens med per-shot-varighet
// (mockupens Animatic-fane; full AnimaticPlayer m/ lyd lever i editoren).
const AnimaticLite: React.FC<{ frames: any[]; onClose: () => void }> = ({ frames, onClose }) => {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const playable = frames.filter((f) => f.thumbnailUrl || f.imageUrl);

  useEffect(() => {
    if (!playing || playable.length === 0) return undefined;
    const duration = Math.max(0.5, playable[index]?.duration ?? 2) * 1000;
    const timer = window.setTimeout(() => setIndex((i) => (i + 1) % playable.length), duration);
    return () => window.clearTimeout(timer);
  }, [playing, index, playable]);

  const current = playable[index];
  return (
    <Box data-testid="board-animatic" sx={{ position: 'fixed', inset: 0, zIndex: 1500, bgcolor: 'rgba(5,5,8,0.96)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <IconButton onClick={onClose} sx={{ position: 'absolute', top: 16, right: 16, color: '#fff' }}><CloseIcon /></IconButton>
      {current ? (
        <Box sx={{ width: 'min(86vw, 1400px)', aspectRatio: '2.39 / 1', backgroundImage: `url(${current.thumbnailUrl || current.imageUrl})`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center', borderRadius: 1 }} />
      ) : (
        <Typography sx={{ color: 'rgba(255,255,255,0.7)' }}>Ingen tegnede frames å spille av ennå.</Typography>
      )}
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 3 }}>
        <IconButton onClick={() => setPlaying((p) => !p)} sx={{ color: '#fff', bgcolor: '#8b5cf6', '&:hover': { bgcolor: '#7c3aed' } }}>
          {playing ? <PauseIcon /> : <PlayArrowIcon />}
        </IconButton>
        <Typography sx={{ color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
          {current ? `Shot ${current.shotNumber} · ${index + 1} / ${playable.length}` : '—'}
        </Typography>
      </Stack>
      <Stack direction="row" spacing={0.5} sx={{ mt: 2, width: 'min(86vw, 1400px)' }}>
        {playable.map((f, i) => (
          <Box key={f.id} onClick={() => { setIndex(i); setPlaying(false); }} sx={{ flexGrow: Math.max(0.5, f.duration ?? 1), height: 5, borderRadius: 2, cursor: 'pointer', bgcolor: i === index ? '#8b5cf6' : 'rgba(255,255,255,0.2)' }} />
        ))}
      </Stack>
    </Box>
  );
};

const PanelLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography sx={{ fontSize: 10.5, letterSpacing: 1.1, fontWeight: 700, color: TEXT_LABEL, textTransform: 'uppercase' }}>
    {children}
  </Typography>
);

// Pensel-tupper (mockupens Brushes-thumbnails): skaft + karakteristisk tupp.
const BrushTipGlyph: React.FC<{ type: string; active: boolean }> = ({ type, active }) => {
  const shaft = active ? '#c4b5fd' : 'rgba(255,255,255,0.55)';
  const tip = active ? '#fff' : 'rgba(255,255,255,0.8)';
  const tips: Record<string, React.ReactNode> = {
    pencil: <path d="M 15 30 L 19 40 L 23 30 Z" fill={tip} />,
    graphite: <path d="M 13 30 L 19 41 L 25 30 Z" fill={tip} opacity="0.85" />,
    charcoal: <path d="M 13 30 Q 15 40 19 41 Q 23 40 25 30 Z" fill={tip} opacity="0.7" />,
    conte: <rect x="14" y="30" width="10" height="10" rx="1.5" fill={tip} opacity="0.85" />,
    ink: <path d="M 17 30 L 19 42 L 21 30 Z" fill={tip} />,
    pen: <path d="M 16 30 L 19 39 L 22 30 Z M 18.4 39 h 1.2 v 3 h -1.2 Z" fill={tip} />,
    marker: <path d="M 14 30 L 16 40 L 24 38 L 24 30 Z" fill={tip} opacity="0.9" />,
  };
  return (
    <svg width="26" height="44" viewBox="0 0 38 44">
      <rect x="14" y="4" width="10" height="27" rx="3" fill={shaft} />
      {tips[type] ?? tips.pencil}
    </svg>
  );
};

// Mockupens ark-tekster er håndskrevet — Caveat lastes idempotent én gang.
const HANDWRITING = '"Caveat", "Segoe Script", "Bradley Hand", cursive';
const ensureHandwritingFont = () => {
  if (typeof document === 'undefined' || document.getElementById('board-handwriting-font')) return;
  const link = document.createElement('link');
  link.id = 'board-handwriting-font';
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Caveat:wght@500;700&display=swap';
  document.head.appendChild(link);
};

export const StoryboardBoardPage: React.FC<{
  projectName?: string;
  sequenceLabel?: string;
  sceneItems: Array<{ id: string; heading: string; shotCount: number; thumbnailUrl?: string }>;
  selectedSceneId?: string;
  onSelectScene?: (sceneId: string) => void;
  frames: any[];
  activeFrameIndex: number;
  onSelectFrame: (index: number) => void;
  onPatchFrame: (frameId: string, patch: Record<string, unknown>) => void;
  onDrawFrame: (frameId: string) => void;
  onAddFrame: () => void;
  onOpenScript?: () => void;
  onOpenShotList?: () => void;
  onClose: () => void;
}> = ({
  projectName = 'The Role Room',
  sequenceLabel,
  sceneItems,
  selectedSceneId,
  onSelectScene,
  frames,
  activeFrameIndex,
  onSelectFrame,
  onPatchFrame,
  onDrawFrame,
  onAddFrame,
  onOpenScript,
  onOpenShotList,
  onClose,
}) => {
  const [zoom, setZoom] = useState(0.75);
  const [zoomMenuAnchor, setZoomMenuAnchor] = useState<HTMLElement | null>(null);
  const [seqMenuAnchor, setSeqMenuAnchor] = useState<HTMLElement | null>(null);
  const [lockedFrames, setLockedFrames] = useState<Record<string, boolean>>({});
  const [animaticOpen, setAnimaticOpen] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<'inspector' | 'comments'>('inspector');
  const panStateRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const [activeTool, setActiveTool] = useState('brush');
  const [handMode, setHandMode] = useState(false);
  const [brushSize, setBrushSize] = useState(12);
  const [brushOpacity, setBrushOpacity] = useState(100);
  const [brushSmoothing, setBrushSmoothing] = useState(32);
  const [brushType, setBrushType] = useState('pencil');
  const [brushColor, setBrushColor] = useState('#26282e');
  const [hiddenLayers, setHiddenLayers] = useState<Record<string, boolean>>({});
  const [lockedLayers, setLockedLayers] = useState<Record<string, boolean>>({});
  const [layerOpacity, setLayerOpacity] = useState<Record<string, number>>({});
  const scrollRef = useRef<HTMLDivElement | null>(null);
  // Undo/redo: snapshot av strokes-JSON per frame (før hver commit).
  const historyRef = useRef<Record<string, { undo: string[]; redo: string[] }>>({});
  const [historyTick, setHistoryTick] = useState(0);

  useEffect(() => { ensureHandwritingFont(); }, []);

  const frame = frames[activeFrameIndex];
  const layers = ['Notes', 'Dialog', 'Drawing', 'Camera / Arrows'];
  const [activeLayer, setActiveLayer] = useState('Drawing');
  const comments = frame?.frameComments ?? [];

  const frameHistory = frame ? (historyRef.current[frame.id] ??= { undo: [], redo: [] }) : null;

  const applyStrokes = useCallback((frameId: string, strokesJSON: string) => {
    onPatchFrame(frameId, {
      drawingData: {
        ...(frames.find((f) => f.id === frameId)?.drawingData ?? {}),
        strokes: strokesJSON,
        width: 1920,
        height: 1080,
        updatedAt: new Date().toISOString(),
      },
      thumbnailUrl: undefined,
      imageSource: 'drawn',
    });
  }, [frames, onPatchFrame]);

  const handleInlineCommit = useCallback((frameId: string, strokesJSON: string) => {
    const history = (historyRef.current[frameId] ??= { undo: [], redo: [] });
    const previous = frames.find((f) => f.id === frameId)?.drawingData?.strokes;
    history.undo.push(typeof previous === 'string' ? previous : '[]');
    history.redo = [];
    setHistoryTick((tick) => tick + 1);
    applyStrokes(frameId, strokesJSON);
  }, [applyStrokes, frames]);

  const handleUndo = useCallback(() => {
    if (!frame || !frameHistory?.undo.length) return;
    const current = typeof frame.drawingData?.strokes === 'string' ? frame.drawingData.strokes : '[]';
    const previous = frameHistory.undo.pop()!;
    frameHistory.redo.push(current);
    setHistoryTick((tick) => tick + 1);
    applyStrokes(frame.id, previous);
  }, [applyStrokes, frame, frameHistory]);

  const handleRedo = useCallback(() => {
    if (!frame || !frameHistory?.redo.length) return;
    const current = typeof frame.drawingData?.strokes === 'string' ? frame.drawingData.strokes : '[]';
    const next = frameHistory.redo.pop()!;
    frameHistory.undo.push(current);
    setHistoryTick((tick) => tick + 1);
    applyStrokes(frame.id, next);
  }, [applyStrokes, frame, frameHistory]);

  const patch = useCallback(
    (fields: Record<string, unknown>) => { if (frame) onPatchFrame(frame.id, fields); },
    [frame, onPatchFrame],
  );

  const setZoomClamped = useCallback((value: number) => {
    setZoom(Math.min(1.5, Math.max(0.3, value)));
  }, []);

  const toolButton = (id: string, icon: React.ReactNode, title: string) => (
    <Tooltip key={id} title={title}>
      <IconButton
        size="small"
        onClick={() => setActiveTool(id)}
        sx={{
          width: 34, height: 34, borderRadius: 1.5,
          color: activeTool === id ? '#fff' : 'rgba(255,255,255,0.62)',
          bgcolor: activeTool === id ? BRAND : 'transparent',
          '&:hover': { bgcolor: activeTool === id ? BRAND : 'rgba(255,255,255,0.06)' },
        }}
      >
        {icon}
      </IconButton>
    </Tooltip>
  );

  const inspectorField = (label: string, control: React.ReactNode) => (
    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ minHeight: 40 }}>
      <PanelLabel>{label}</PanelLabel>
      {control}
    </Stack>
  );

  const inspectorSelect = (value: string, options: string[], onChange: (next: string) => void, width = 118) => (
    <TextField
      select size="small" value={value || ''} onChange={(event) => onChange(event.target.value)}
      sx={{
        width,
        '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 1.5, fontSize: 13 },
        '& fieldset': { borderColor: PANEL_BORDER },
      }}
    >
      <MenuItem value="">—</MenuItem>
      {options.map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}
    </TextField>
  );

  const topTab = (id: string, label: string, icon: React.ReactNode, active: boolean, onClick?: () => void) => (
    <Stack
      key={id} direction="row" spacing={0.75} alignItems="center" onClick={onClick}
      sx={{
        px: 1.75, py: 0.75, borderRadius: 2, cursor: 'pointer', userSelect: 'none',
        bgcolor: active ? 'rgba(255,255,255,0.1)' : 'transparent',
        border: active ? `1px solid ${PANEL_BORDER}` : '1px solid transparent',
        color: active ? '#fff' : TEXT_DIM,
        '&:hover': { color: '#fff' },
      }}
    >
      {icon}
      <Typography sx={{ fontSize: 13.5, fontWeight: 600 }}>{label}</Typography>
    </Stack>
  );

  return (
    <Box data-testid="storyboard-board-page" sx={{ position: 'fixed', inset: 0, zIndex: 1400, display: 'flex', flexDirection: 'column', bgcolor: CHROME, fontFamily: 'Inter, "SF Pro Text", sans-serif' }}>
      {/* ── Topbar ─────────────────────────────────────────────── */}
      <Stack direction="row" alignItems="center" sx={{ height: 56, px: 2, borderBottom: `1px solid ${PANEL_BORDER}`, flexShrink: 0 }}>
        <Box sx={{ width: 34, height: 34, borderRadius: 2, background: `linear-gradient(135deg, ${BRAND}, #6366f1)`, display: 'grid', placeItems: 'center', mr: 2 }}>
          <DashboardIcon sx={{ fontSize: 19, color: '#fff' }} />
        </Box>
        <Typography sx={{ fontSize: 11, letterSpacing: 1, color: TEXT_LABEL, fontWeight: 700, mr: 1 }}>PROJECT</Typography>
        <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#fff', mr: 3 }}>{projectName}</Typography>
        {sequenceLabel && (
          <>
            <Typography sx={{ fontSize: 11, letterSpacing: 1, color: TEXT_LABEL, fontWeight: 700, mr: 1 }}>SEQ.</Typography>
            <Typography
              onClick={(event) => setSeqMenuAnchor(event.currentTarget as HTMLElement)}
              sx={{ fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer' }}
            >
              {sequenceLabel} ▾
            </Typography>
            <Menu anchorEl={seqMenuAnchor} open={Boolean(seqMenuAnchor)} onClose={() => setSeqMenuAnchor(null)}>
              {sceneItems.map((sceneEntry) => (
                <MenuItem
                  key={sceneEntry.id}
                  selected={sceneEntry.id === selectedSceneId}
                  onClick={() => { onSelectScene?.(sceneEntry.id); setSeqMenuAnchor(null); }}
                >
                  {sceneEntry.heading}
                </MenuItem>
              ))}
            </Menu>
          </>
        )}
        <Box sx={{ flex: 1 }} />
        <Stack direction="row" spacing={0.75} sx={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
          {topTab('board', 'Board', <DashboardIcon sx={{ fontSize: 17 }} />, true)}
          {topTab('script', 'Script', <DescriptionIcon sx={{ fontSize: 17 }} />, false, onOpenScript)}
          {topTab('shotlist', 'Shot List', <ListAltIcon sx={{ fontSize: 17 }} />, false, onOpenShotList)}
          {topTab('animatic', 'Animatic', <PlayCircleOutlineIcon sx={{ fontSize: 17 }} />, false, () => setAnimaticOpen(true))}
        </Stack>
        <Tooltip title={typeof window !== 'undefined' ? (window.localStorage.getItem('userEmail') || '') : ''}>
          <Box sx={{ width: 30, height: 30, borderRadius: '50%', mr: 1.5, display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700, color: '#fff', background: `linear-gradient(135deg, ${BRAND}, #6366f1)` }}>
            {(typeof window !== 'undefined' ? (window.localStorage.getItem('userEmail') || 'U') : 'U').slice(0, 2).toUpperCase()}
          </Box>
        </Tooltip>
        <Button size="small" startIcon={<ShareIcon sx={{ fontSize: 16 }} />} sx={{ color: '#fff', bgcolor: 'rgba(255,255,255,0.08)', borderRadius: 2, px: 1.75, textTransform: 'none', fontWeight: 600, mr: 1 }}>
          Share
        </Button>
        <IconButton size="small" sx={{ color: TEXT_DIM, mr: 0.5 }}><MoreHorizIcon /></IconButton>
        <IconButton
          size="small"
          onClick={() => {
            if (document.fullscreenElement) void document.exitFullscreen();
            else void document.documentElement.requestFullscreen();
          }}
          sx={{ color: TEXT_DIM, mr: 0.5 }}
        >
          <FitScreenIcon sx={{ fontSize: 19 }} />
        </IconButton>
        <IconButton size="small" onClick={onClose} data-testid="board-page-close" sx={{ color: TEXT_DIM }}><CloseIcon /></IconButton>
      </Stack>

      {/* ── Hovedrad: scener | arbeidsflate | inspector ────────── */}
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex' }}>
        {/* SCENES */}
        <Box sx={{ width: 256, flexShrink: 0, borderRight: `1px solid ${PANEL_BORDER}`, bgcolor: CHROME, display: 'flex', flexDirection: 'column' }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, py: 1.5 }}>
            <PanelLabel>Scenes</PanelLabel>
            <IconButton size="small" onClick={onAddFrame} sx={{ color: TEXT_DIM }}><AddIcon sx={{ fontSize: 18 }} /></IconButton>
          </Stack>
          <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5, pb: 1.5 }} data-testid="board-scenes-scroll">
            {sceneItems.map((scene, index) => {
              const selected = scene.id === selectedSceneId;
              return (
                <Stack
                  key={scene.id} direction="row" spacing={1.25} alignItems="center"
                  onClick={() => onSelectScene?.(scene.id)}
                  data-testid={`board-page-scene-${index}`}
                  sx={{
                    p: 1, mb: 1, borderRadius: 2, cursor: 'pointer',
                    border: selected ? `1.5px solid ${BRAND}` : `1px solid ${PANEL_BORDER}`,
                    bgcolor: selected ? BRAND_SOFT : 'rgba(255,255,255,0.02)',
                  }}
                >
                  <Box sx={{
                    width: 72, height: 46, borderRadius: 1.5, flexShrink: 0,
                    backgroundImage: scene.thumbnailUrl ? `url(${scene.thumbnailUrl})` : undefined,
                    backgroundSize: 'cover', backgroundPosition: 'center',
                    bgcolor: scene.thumbnailUrl ? undefined : 'rgba(255,255,255,0.06)',
                  }} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: 10.5, color: TEXT_LABEL, fontWeight: 700 }}>{String(index + 1).padStart(2, '0')}</Typography>
                    <Typography noWrap title={scene.heading} sx={{ fontSize: 12.5, fontWeight: 600, color: '#fff' }}>{scene.heading}</Typography>
                    <Typography sx={{ fontSize: 10.5, color: TEXT_DIM }}>{scene.shotCount} {scene.shotCount === 1 ? 'SHOT' : 'SHOTS'}</Typography>
                  </Box>
                  {selected && <Box sx={{ ml: 'auto', width: 8, height: 8, borderRadius: '50%', bgcolor: BRAND }} />}
                </Stack>
              );
            })}
          </Box>
          <Stack direction="row" spacing={0.5} sx={{ px: 1.5, py: 1, borderTop: `1px solid ${PANEL_BORDER}` }}>
            <Tooltip title="Klassisk visning">
              <IconButton size="small" onClick={onClose} sx={{ color: TEXT_DIM }}><DashboardIcon sx={{ fontSize: 17 }} /></IconButton>
            </Tooltip>
            <Tooltip title="Animatic">
              <IconButton size="small" onClick={() => setAnimaticOpen(true)} sx={{ color: TEXT_DIM }}><PlayCircleOutlineIcon sx={{ fontSize: 17 }} /></IconButton>
            </Tooltip>
          </Stack>
        </Box>

        {/* Arbeidsflate */}
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', bgcolor: PANEL }}>
          {/* Verktøyrad */}
          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ height: 46, px: 1.5, borderBottom: `1px solid ${PANEL_BORDER}`, flexShrink: 0 }}>
            {toolButton('select', <NearMeIcon sx={{ fontSize: 18 }} />, 'Velg')}
            {toolButton('brush', <BrushIcon sx={{ fontSize: 18 }} />, 'Pensel')}
            {toolButton('pencil', <CreateIcon sx={{ fontSize: 18 }} />, 'Blyant')}
            {toolButton('eraser', <AutoFixNormalIcon sx={{ fontSize: 18 }} />, 'Viskelær')}
            <Box sx={{ width: 1, height: 22, bgcolor: PANEL_BORDER, mx: 0.75 }} />
            {toolButton('shapes', <TrendingFlatIcon sx={{ fontSize: 20 }} />, 'Pil-annotasjon')}
            {toolButton('rect', <CropSquareIcon sx={{ fontSize: 18 }} />, 'Rektangel')}
            {toolButton('text', <TitleIcon sx={{ fontSize: 18 }} />, 'Tekst')}
            <Box sx={{ width: 1, height: 22, bgcolor: PANEL_BORDER, mx: 0.75 }} />
            {toolButton('lasso', <GestureIcon sx={{ fontSize: 18 }} />, 'Lasso')}
            <Box sx={{ flex: 1 }} />
            {frames.map((_, index) => (
              <Box
                key={index} onClick={() => onSelectFrame(index)}
                sx={{
                  width: 28, height: 28, borderRadius: 1.25, display: 'grid', placeItems: 'center', cursor: 'pointer',
                  fontSize: 12.5, fontWeight: 600,
                  color: index === activeFrameIndex ? '#fff' : TEXT_DIM,
                  bgcolor: index === activeFrameIndex ? 'rgba(255,255,255,0.12)' : 'transparent',
                  border: index === activeFrameIndex ? `1px solid ${PANEL_BORDER}` : '1px solid transparent',
                }}
              >
                {index + 1}
              </Box>
            ))}
            <Tooltip title="Nytt shot">
              <Box onClick={onAddFrame} sx={{ width: 28, height: 28, borderRadius: 1.25, ml: 0.5, cursor: 'pointer', bgcolor: '#000', border: `1px solid ${PANEL_BORDER}`, display: 'grid', placeItems: 'center', color: TEXT_DIM, fontSize: 15 }}>+</Box>
            </Tooltip>
          </Stack>

          {/* Board-arket */}
          <Box
            ref={scrollRef}
            onPointerDown={(event) => {
              if (!handMode) return;
              const el = scrollRef.current;
              if (!el) return;
              panStateRef.current = { x: event.clientX, y: event.clientY, left: el.scrollLeft, top: el.scrollTop };
              (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
            }}
            onPointerMove={(event) => {
              const pan = panStateRef.current;
              const el = scrollRef.current;
              if (!pan || !el || !handMode) return;
              el.scrollLeft = pan.left - (event.clientX - pan.x);
              el.scrollTop = pan.top - (event.clientY - pan.y);
            }}
            onPointerUp={() => { panStateRef.current = null; }}
            sx={{ flex: 1, minHeight: 0, overflow: 'auto', bgcolor: WORKSPACE_BG, position: 'relative', cursor: handMode ? (panStateRef.current ? 'grabbing' : 'grab') : 'default' }}
          >
            {/* Zoom uten transition — width-animasjon gir layout-thrash, og
                design-verktøy zoomer momentant (Figma/Procreate-konvensjon). */}
            <Box sx={{ width: `${Math.round(940 * zoom)}px`, mx: 'auto', my: 3 }}>
              <Box sx={{ bgcolor: SHEET_BG, borderRadius: 1, boxShadow: '0 10px 40px rgba(0,0,0,0.45)', px: `${Math.round(34 * zoom)}px`, py: `${Math.round(28 * zoom)}px` }}>
                {frames.map((rowFrame, index) => {
                  const isActive = index === activeFrameIndex;
                  const image = rowFrame.thumbnailUrl || rowFrame.imageUrl;
                  const scaledFont = (base: number) => `${Math.max(8, Math.round(base * zoom))}px`;
                  return (
                    <Stack
                      key={rowFrame.id} direction="row" spacing={`${Math.round(20 * zoom)}px`}
                      onClick={() => onSelectFrame(index)}
                      onDoubleClick={() => onDrawFrame(rowFrame.id)}
                      data-testid={`board-page-row-${rowFrame.shotNumber}`}
                      sx={{ mb: `${Math.round(26 * zoom)}px`, alignItems: 'flex-start', cursor: 'pointer' }}
                    >
                      <Box sx={{ width: `${Math.round(168 * zoom)}px`, flexShrink: 0 }}>
                        <Box sx={{
                          display: 'inline-block', px: 1, py: 0.25, mb: 1, borderRadius: '4px',
                          border: '1.5px solid #33343a', fontFamily: 'JetBrains Mono, Menlo, monospace',
                          fontWeight: 700, fontSize: scaledFont(13), color: '#26272c', bgcolor: '#fff',
                        }}>
                          {rowFrame.shotNumber}
                        </Box>
                        <Typography sx={{ fontSize: scaledFont(9), letterSpacing: 1, fontWeight: 700, color: '#9a9b a1'.replace(' ', ''), textTransform: 'uppercase' }}>
                          Action / Dialog
                        </Typography>
                        <Typography sx={{ fontFamily: HANDWRITING, fontSize: scaledFont(17), color: '#33343a', lineHeight: 1.3, mb: 1 }}>
                          {rowFrame.description}
                        </Typography>
                        {rowFrame.notes && (
                          <>
                            <Typography sx={{ fontSize: scaledFont(9), letterSpacing: 1, fontWeight: 700, color: '#9a9ba1', textTransform: 'uppercase' }}>
                              Notes / Diagram
                            </Typography>
                            <Typography sx={{ fontFamily: HANDWRITING, fontSize: scaledFont(15), color: '#55565c', lineHeight: 1.3 }}>
                              {rowFrame.notes}
                            </Typography>
                          </>
                        )}
                      </Box>

                      {(() => {
                        const drawingInline = isActive && !lockedFrames[rowFrame.id] && ['brush', 'pencil', 'eraser', 'shapes', 'rect', 'text'].includes(activeTool);
                        const inlineTool = activeTool === 'shapes' ? 'arrow'
                          : activeTool === 'rect' ? 'rect'
                            : activeTool === 'text' ? 'text'
                              : 'draw';
                        const effectiveType = activeTool === 'eraser' ? 'eraser'
                          : activeTool === 'pencil' ? 'pencil'
                            : brushType;
                        return (
                          <Box sx={{
                            flex: 1, minWidth: 0, aspectRatio: '2.39 / 1', borderRadius: '4px',
                            position: 'relative', overflow: 'hidden',
                            border: isActive ? `2px solid ${BRAND}` : '1.5px solid #2b2c31',
                            backgroundImage: !drawingInline && image ? `url(${image})` : undefined,
                            backgroundSize: 'cover', backgroundPosition: 'center',
                            bgcolor: image || drawingInline ? '#fdfdfb' : '#ececea',
                            display: 'grid', placeItems: 'center',
                          }}>
                            {drawingInline && (
                              <InlineFrameCanvas
                                frame={rowFrame}
                                brush={{
                                  type: effectiveType,
                                  size: brushSize,
                                  color: brushColor,
                                  opacity: brushOpacity / 100,
                                  smoothing: brushSmoothing,
                                }}
                                tool={inlineTool}
                                activeLayer={activeLayer}
                                hiddenLayers={hiddenLayers}
                                lockedLayers={lockedLayers}
                                layerOpacity={layerOpacity}
                                onCommit={(strokesJSON) => handleInlineCommit(rowFrame.id, strokesJSON)}
                              />
                            )}
                            {!drawingInline && !image && (
                              <Typography sx={{ fontSize: scaledFont(11), color: '#9a9ba1' }}>
                                Velg pensel og tegn — eller dobbeltklikk for full editor
                              </Typography>
                            )}
                          </Box>
                        );
                      })()}

                      <Box sx={{ width: `${Math.round(118 * zoom)}px`, flexShrink: 0 }}>
                        {[
                          ['CAM / SHOT', rowFrame.shotType || rowFrame.cameraAngle],
                          ['LENS / CAMERA', typeof rowFrame.lensMm === 'number' ? `${rowFrame.lensMm}mm` : '—'],
                          ['MOVEMENT', rowFrame.movement || '—'],
                          ['DURATION', `${rowFrame.duration} SEC`],
                        ].map(([label, value]) => (
                          <Box key={label} sx={{ mb: `${Math.round(10 * zoom)}px` }}>
                            <Typography sx={{ fontSize: scaledFont(8.5), letterSpacing: 1, fontWeight: 700, color: '#9a9ba1' }}>{label}</Typography>
                            <Typography sx={{ fontFamily: HANDWRITING, fontSize: scaledFont(16), color: '#33343a' }}>{value}</Typography>
                          </Box>
                        ))}
                      </Box>
                    </Stack>
                  );
                })}
                <Button size="small" startIcon={<AddIcon />} onClick={onAddFrame} sx={{ color: '#5a5b61', textTransform: 'none', border: '1px solid #d5d4cf', borderRadius: 1.5, px: 1.5, bgcolor: '#fff' }}>
                  Add Shot
                </Button>
              </Box>
            </Box>

            {/* Transport-pille */}
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{
              position: 'sticky', bottom: 14, left: '50%', width: 'fit-content', transform: 'translateX(-50%)',
              px: 1, py: 0.5, borderRadius: 999, bgcolor: 'rgba(15,15,18,0.92)', border: `1px solid ${PANEL_BORDER}`,
              boxShadow: '0 6px 24px rgba(0,0,0,0.5)',
            }}>
              <IconButton size="small" onClick={handleUndo} disabled={!frameHistory?.undo.length} data-testid="board-page-undo" sx={{ color: frameHistory?.undo.length ? '#fff' : 'rgba(255,255,255,0.25)' }}><UndoIcon sx={{ fontSize: 18 }} /></IconButton>
              <IconButton size="small" onClick={handleRedo} disabled={!frameHistory?.redo.length} data-testid="board-page-redo" sx={{ color: frameHistory?.redo.length ? '#fff' : 'rgba(255,255,255,0.25)' }}><RedoIcon sx={{ fontSize: 18 }} /></IconButton>
              <Box sx={{ width: 1, height: 20, bgcolor: PANEL_BORDER, mx: 0.5 }} />
              <IconButton size="small" onClick={() => setHandMode((prev) => !prev)} sx={{ color: handMode ? '#fff' : TEXT_DIM, bgcolor: handMode ? BRAND : 'transparent', borderRadius: 1.5 }}>
                <BackHandIcon sx={{ fontSize: 17 }} />
              </IconButton>
              <IconButton size="small" sx={{ color: TEXT_DIM }}><PanToolAltIcon sx={{ fontSize: 17 }} /></IconButton>
              <Box sx={{ width: 1, height: 20, bgcolor: PANEL_BORDER, mx: 0.5 }} />
              <IconButton size="small" onClick={() => setZoomClamped(zoom - 0.1)} sx={{ color: TEXT_DIM }}><ZoomOutIcon sx={{ fontSize: 18 }} /></IconButton>
              <Typography
                data-testid="board-page-zoom"
                onClick={(event) => setZoomMenuAnchor(event.currentTarget as HTMLElement)}
                sx={{ fontSize: 12.5, color: '#fff', width: 46, textAlign: 'center', fontVariantNumeric: 'tabular-nums', cursor: 'pointer' }}
              >
                {Math.round(zoom * 100)}% ▾
              </Typography>
              <Menu anchorEl={zoomMenuAnchor} open={Boolean(zoomMenuAnchor)} onClose={() => setZoomMenuAnchor(null)}>
                {[0.5, 0.75, 1, 1.25, 1.5].map((preset) => (
                  <MenuItem key={preset} selected={zoom === preset} onClick={() => { setZoom(preset); setZoomMenuAnchor(null); }}>
                    {Math.round(preset * 100)}%
                  </MenuItem>
                ))}
              </Menu>
              <IconButton size="small" onClick={() => setZoomClamped(zoom + 0.1)} sx={{ color: TEXT_DIM }}><ZoomInIcon sx={{ fontSize: 18 }} /></IconButton>
              <IconButton size="small" onClick={() => setZoom(0.75)} sx={{ color: TEXT_DIM }}><FitScreenIcon sx={{ fontSize: 18 }} /></IconButton>
            </Stack>
          </Box>
        </Box>

        {/* INSPECTOR / COMMENTS */}
        <Box sx={{ width: 300, flexShrink: 0, borderLeft: `1px solid ${PANEL_BORDER}`, bgcolor: CHROME, display: 'flex', flexDirection: 'column' }}>
          <Stack direction="row" sx={{ px: 2, pt: 1.5, gap: 2, borderBottom: `1px solid ${PANEL_BORDER}` }}>
            {(['inspector', 'comments'] as const).map((tab) => (
              <Box key={tab} onClick={() => setInspectorTab(tab)} sx={{ pb: 1.25, cursor: 'pointer', borderBottom: inspectorTab === tab ? `2px solid ${BRAND}` : '2px solid transparent' }}>
                <Typography sx={{ fontSize: 12.5, fontWeight: 700, letterSpacing: 0.8, color: inspectorTab === tab ? '#fff' : TEXT_DIM, textTransform: 'uppercase' }}>
                  {tab === 'inspector' ? 'Inspector' : `Comments${comments.length ? ` (${comments.length})` : ''}`}
                </Typography>
              </Box>
            ))}
          </Stack>

          {frame && inspectorTab === 'inspector' && (
            <Box sx={{ flex: 1, overflowY: 'auto', px: 2, py: 1.75 }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2, px: 1.25, py: 1, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.05)', border: `1px solid ${PANEL_BORDER}` }}>
                <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#fff', flex: 1 }}>SHOT {frame.shotNumber}</Typography>
                <IconButton size="small" onClick={() => setLockedFrames((prev) => ({ ...prev, [frame.id]: !prev[frame.id] }))} sx={{ p: 0.25 }}>
                  <LockIcon sx={{ fontSize: 15, color: lockedFrames[frame.id] ? '#f59e0b' : TEXT_DIM }} />
                </IconButton>
                <MoreHorizIcon sx={{ fontSize: 17, color: TEXT_DIM }} />
              </Stack>

              {inspectorField('Camera / Shot', inspectorSelect(frame.shotType || '', SHOT_SIZE_OPTIONS.concat(['OTS', 'POV', 'INSERT']), (next) => patch({ shotType: next || undefined })))}
              {inspectorField('Lens', inspectorSelect(typeof frame.lensMm === 'number' ? `${frame.lensMm}mm` : '', ['14mm', '18mm', '24mm', '28mm', '35mm', '50mm', '85mm', '135mm'], (next) => patch({ lensMm: next ? Number(next.replace('mm', '')) : undefined })))}

              <Box sx={{ mt: 1.5 }}>
                <PanelLabel>Shot Size</PanelLabel>
                <Stack direction="row" spacing={0.75} sx={{ mt: 0.75 }}>
                  {SHOT_SIZE_OPTIONS.map((size) => {
                    const active = frame.shotType === size;
                    return (
                      <Tooltip key={size} title={size}>
                        <Box
                          onClick={() => patch({ shotType: size })}
                          data-testid={`inspector-shot-size-${size}`}
                          sx={{
                            width: 44, height: 40, borderRadius: 1.5, display: 'grid', placeItems: 'center', cursor: 'pointer',
                            bgcolor: active ? BRAND : 'rgba(255,255,255,0.05)',
                            border: `1px solid ${active ? BRAND : PANEL_BORDER}`,
                          }}
                        >
                          <ShotSizeGlyph size={size} active={active} />
                        </Box>
                      </Tooltip>
                    );
                  })}
                </Stack>
              </Box>

              <Box sx={{ mt: 1.75 }}>
                <PanelLabel>Movement</PanelLabel>
                <Stack direction="row" spacing={0.75} sx={{ mt: 0.75 }}>
                  {MOVEMENT_OPTIONS.map((movement) => {
                    const active = frame.movement === movement;
                    return (
                      <Tooltip key={movement} title={movement}>
                        <Box
                          onClick={() => patch({ movement })}
                          sx={{
                            width: 44, height: 36, borderRadius: 1.5, display: 'grid', placeItems: 'center', cursor: 'pointer',
                            fontSize: 16, color: active ? '#fff' : 'rgba(255,255,255,0.65)',
                            bgcolor: active ? BRAND : 'rgba(255,255,255,0.05)',
                            border: `1px solid ${active ? BRAND : PANEL_BORDER}`,
                          }}
                        >
                          {MOVEMENT_GLYPHS[movement]}
                        </Box>
                      </Tooltip>
                    );
                  })}
                </Stack>
              </Box>

              <Box sx={{ mt: 1.75 }}>
                {inspectorField('Duration (sec)', (
                  <TextField
                    size="small" type="number" value={frame.duration ?? 1}
                    onChange={(event) => patch({ duration: Math.max(0.5, Number(event.target.value) || 1) })}
                    inputProps={{ step: 0.5, min: 0.5 }}
                    sx={{ width: 118, '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 1.5, fontSize: 13 }, '& fieldset': { borderColor: PANEL_BORDER } }}
                  />
                ))}
                {inspectorField('Transition', inspectorSelect(frame.transition || 'Cut', TRANSITIONS, (next) => patch({ transition: next || undefined })))}
                {inspectorField('Focus / Depth', inspectorSelect(frame.focusDepth || '', FOCUS_OPTIONS, (next) => patch({ focusDepth: next || undefined })))}
                {inspectorField('Time / Time of day', inspectorSelect(frame.timeOfDay || '', ['Day', 'Night', 'Dawn', 'Dusk'], (next) => patch({ timeOfDay: next || undefined })))}
                {inspectorField('Weather', inspectorSelect(frame.weather || '', ['Clear', 'Rain', 'Snow', 'Overcast', 'Fog'], (next) => patch({ weather: next || undefined })))}
              </Box>

              <Box sx={{ mt: 1.5 }}>
                <PanelLabel>Notes</PanelLabel>
                <TextField
                  size="small" fullWidth multiline minRows={2} placeholder="Add notes…"
                  value={frame.notes || ''}
                  onChange={(event) => patch({ notes: event.target.value || undefined })}
                  sx={{ mt: 0.75, '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 1.5, fontSize: 13 }, '& fieldset': { borderColor: PANEL_BORDER } }}
                />
              </Box>

              <Box sx={{ mt: 1.5 }}>
                <PanelLabel>Tags</PanelLabel>
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 0.75 }}>
                  {(frame.tags ?? []).map((tag: string) => (
                    <Chip
                      key={tag} label={tag} size="small"
                      onDelete={() => patch({ tags: (frame.tags ?? []).filter((t: string) => t !== tag) })}
                      sx={{ bgcolor: 'rgba(255,255,255,0.07)', color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: 0.6 }}
                    />
                  ))}
                  <Chip
                    label="+" size="small" onClick={() => {
                      const next = window.prompt('Ny tag:');
                      if (next?.trim()) patch({ tags: [...(frame.tags ?? []), next.trim().toUpperCase()] });
                    }}
                    sx={{ bgcolor: 'transparent', border: `1px dashed ${PANEL_BORDER}`, color: TEXT_DIM }}
                  />
                </Stack>
              </Box>

              <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                {LABEL_COLORS.map((color) => (
                  <Box
                    key={color}
                    onClick={() => patch({ colorLabel: color })}
                    sx={{
                      width: 22, height: 22, borderRadius: 1, bgcolor: color, cursor: 'pointer',
                      outline: frame.colorLabel === color ? `2px solid ${BRAND}` : '1px solid rgba(255,255,255,0.18)',
                      outlineOffset: 2,
                    }}
                  />
                ))}
                <Box sx={{ width: 22, height: 22, borderRadius: 1, display: 'grid', placeItems: 'center', border: `1px dashed ${PANEL_BORDER}`, color: TEXT_DIM, fontSize: 15, cursor: 'pointer' }}>+</Box>
              </Stack>
            </Box>
          )}

          {frame && inspectorTab === 'comments' && (
            <Box sx={{ flex: 1, overflowY: 'auto', px: 2, py: 1.75 }}>
              {comments.length === 0 && <Typography sx={{ fontSize: 13, color: TEXT_DIM }}>Ingen kommentarer på dette shotet ennå — bruk Review-modusen for tråder med rolle.</Typography>}
              {comments.map((comment: any) => (
                <Box key={comment.id} sx={{ mb: 1.25, p: 1.25, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)', border: `1px solid ${PANEL_BORDER}` }}>
                  <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: '#c4b5fd' }}>{comment.role}</Typography>
                  <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.88)' }}>{comment.text}</Typography>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </Box>

      {animaticOpen && <AnimaticLite frames={frames} onClose={() => setAnimaticOpen(false)} />}

      {/* ── Bunnpaneler: Brushes | Layers | Navigator ──────────── */}
      <Stack direction="row" sx={{ height: 190, flexShrink: 0, borderTop: `1px solid ${PANEL_BORDER}`, bgcolor: CHROME }}>
        {/* Verktøykolonne + Brushes */}
        <Stack direction="row" sx={{ flex: 1.25, borderRight: `1px solid ${PANEL_BORDER}`, minWidth: 0 }}>
          <Stack spacing={0.75} sx={{ width: 56, alignItems: 'center', pt: 1.5, borderRight: `1px solid ${PANEL_BORDER}` }}>
            {toolButton('brush', <BrushIcon sx={{ fontSize: 18 }} />, 'Pensel')}
            {toolButton('eraser', <AutoFixNormalIcon sx={{ fontSize: 18 }} />, 'Viskelær')}
            {toolButton('text', <TitleIcon sx={{ fontSize: 18 }} />, 'Tekst')}
            {toolButton('select', <CropSquareIcon sx={{ fontSize: 18 }} />, 'Utsnitt')}
          </Stack>
          <Box sx={{ flex: 1, minWidth: 0, px: 2, py: 1.25, display: 'flex', gap: 2.5 }}>
            <Box sx={{ minWidth: 0 }}>
              <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 1 }}>
                <PanelLabel>Brushes</PanelLabel>
              </Stack>
              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ width: 176 }}>
                {['pencil', 'graphite', 'charcoal', 'conte', 'ink', 'pen', 'marker'].map((brushOption, index) => {
                  const selected = brushType === brushOption && activeTool !== 'eraser';
                  return (
                    <Tooltip key={brushOption} title={brushOption}>
                      <Box
                        onClick={() => { setBrushType(brushOption); setActiveTool('brush'); }}
                        data-testid={`board-brush-${brushOption}`}
                        sx={{
                          width: 38, height: 46, borderRadius: 1.5, cursor: 'pointer',
                          bgcolor: selected ? BRAND_SOFT : 'rgba(255,255,255,0.04)',
                          border: selected ? `1.5px solid ${BRAND}` : `1px solid ${PANEL_BORDER}`,
                          display: 'grid', placeItems: 'center',
                        }}
                      >
                        <BrushTipGlyph type={brushOption} active={selected} />
                      </Box>
                    </Tooltip>
                  );
                })}
                <Tooltip title="Penselfarge">
                  <Box component="label" sx={{ width: 38, height: 46, borderRadius: 1.5, cursor: 'pointer', border: `1px solid ${PANEL_BORDER}`, display: 'grid', placeItems: 'center' }}>
                    <Box sx={{ width: 20, height: 20, borderRadius: '50%', bgcolor: brushColor, border: '2px solid rgba(255,255,255,0.35)' }} />
                    <input type="color" value={brushColor} onChange={(event) => setBrushColor(event.target.value)} style={{ position: 'absolute', width: 0, height: 0, opacity: 0 }} />
                  </Box>
                </Tooltip>
              </Stack>
            </Box>
            <Box sx={{ flex: 1, minWidth: 140 }}>
              {[
                ['Size', brushSize, 1, 64, (value: number) => setBrushSize(value), `${brushSize} px`],
                ['Opacity', brushOpacity, 5, 100, (value: number) => setBrushOpacity(value), `${brushOpacity}%`],
                ['Smoothing', brushSmoothing, 0, 100, (value: number) => setBrushSmoothing(value), `${brushSmoothing}%`],
              ].map(([label, value, min, max, onChange, display]: any) => (
                <Stack key={label} direction="row" alignItems="center" spacing={1.25} sx={{ mb: 1 }}>
                  <Typography sx={{ fontSize: 11.5, color: TEXT_DIM, width: 68 }}>{label}</Typography>
                  <Box
                    onClick={(event) => {
                      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
                      const ratio = (event.clientX - rect.left) / rect.width;
                      onChange(Math.round(min + ratio * (max - min)));
                    }}
                    sx={{ flex: 1, height: 4, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.12)', position: 'relative', cursor: 'pointer' }}
                  >
                    <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${((value - min) / (max - min)) * 100}%`, borderRadius: 2, bgcolor: BRAND }} />
                  </Box>
                  <Typography sx={{ fontSize: 11.5, color: '#fff', width: 44, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{display}</Typography>
                </Stack>
              ))}
            </Box>
            <Box sx={{ width: 150, borderRadius: 2, bgcolor: '#0f0f12', border: `1px solid ${PANEL_BORDER}`, display: 'grid', placeItems: 'center' }}>
              <svg width="120" height="60" viewBox="0 0 120 60">
                <path d="M 10 40 C 30 10, 45 55, 62 30 S 95 15, 110 32" fill="none" stroke="#fff" strokeWidth={Math.max(2, brushSize / 3)} strokeLinecap="round" opacity={brushOpacity / 100} />
              </svg>
            </Box>
          </Box>
        </Stack>

        {/* Layers */}
        <Box sx={{ flex: 1, borderRight: `1px solid ${PANEL_BORDER}`, px: 2, py: 1.25, minWidth: 0 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <PanelLabel>Layers</PanelLabel>
            <Box sx={{ flex: 1 }} />
            <Typography sx={{ fontSize: 10.5, color: TEXT_DIM }}>Opacity</Typography>
            <Box
              onClick={(event) => {
                const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
                const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
                setLayerOpacity((prev) => ({ ...prev, [activeLayer]: Math.round(ratio * 100) / 100 }));
              }}
              sx={{ width: 64, height: 4, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.12)', position: 'relative', cursor: 'pointer' }}
            >
              <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(layerOpacity[activeLayer] ?? 1) * 100}%`, borderRadius: 2, bgcolor: BRAND }} />
            </Box>
            <Typography sx={{ fontSize: 10.5, color: '#fff', width: 34, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
              {Math.round((layerOpacity[activeLayer] ?? 1) * 100)}%
            </Typography>
          </Stack>
          {layers.map((layer) => {
            const hidden = hiddenLayers[layer];
            const selected = activeLayer === layer;
            return (
              <Stack
                key={layer} direction="row" alignItems="center" spacing={1}
                onClick={() => setActiveLayer(layer)}
                sx={{
                  px: 1, py: 0.6, mb: 0.5, borderRadius: 1.5, cursor: 'pointer',
                  bgcolor: selected ? BRAND : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${selected ? BRAND : PANEL_BORDER}`,
                }}
              >
                <IconButton
                  size="small"
                  data-testid={`board-layer-eye-${layer.replace(/[^a-z]/gi, '')}`}
                  onClick={(event) => { event.stopPropagation(); setHiddenLayers((prev) => ({ ...prev, [layer]: !prev[layer] })); }}
                  sx={{ p: 0.25, color: selected ? '#fff' : TEXT_DIM }}
                >
                  {hidden ? <VisibilityOffIcon sx={{ fontSize: 15 }} /> : <VisibilityIcon sx={{ fontSize: 15 }} />}
                </IconButton>
                <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: selected ? '#fff' : 'rgba(255,255,255,0.8)', flex: 1 }}>{layer}</Typography>
                <IconButton
                  size="small"
                  onClick={(event) => { event.stopPropagation(); setLockedLayers((prev) => ({ ...prev, [layer]: !prev[layer] })); }}
                  sx={{ p: 0.25, color: lockedLayers[layer] ? '#f59e0b' : (selected ? 'rgba(255,255,255,0.7)' : TEXT_LABEL) }}
                >
                  <LockIcon sx={{ fontSize: 13 }} />
                </IconButton>
              </Stack>
            );
          })}
        </Box>

        {/* Navigator */}
        <Box sx={{ flex: 1, px: 2, py: 1.25, minWidth: 0 }}>
          <PanelLabel>Navigator</PanelLabel>
          <Box sx={{ mt: 1, height: 104, borderRadius: 2, bgcolor: '#0f0f12', border: `1px solid ${PANEL_BORDER}`, position: 'relative', overflow: 'hidden', p: 1 }}>
            {/* Mini-representasjon av arket: én stripe per frame */}
            <Box sx={{ width: '55%', mx: 'auto', height: '100%', bgcolor: SHEET_BG, borderRadius: 0.5, p: 0.5 }}>
              {frames.slice(0, 5).map((miniFrame, index) => (
                <Box key={miniFrame.id} sx={{
                  height: `${Math.max(10, 88 / Math.max(frames.length, 3))}%`, mb: '4%', borderRadius: 0.25,
                  backgroundImage: (miniFrame.thumbnailUrl || miniFrame.imageUrl) ? `url(${miniFrame.thumbnailUrl || miniFrame.imageUrl})` : undefined,
                  backgroundSize: 'cover', backgroundPosition: 'center',
                  bgcolor: 'rgba(0,0,0,0.08)',
                  outline: index === activeFrameIndex ? `1.5px solid ${BRAND}` : 'none',
                }} />
              ))}
            </Box>
            <Box sx={{ position: 'absolute', inset: 6, border: `1.5px solid ${BRAND}`, borderRadius: 1, pointerEvents: 'none', opacity: 0.85 }} />
          </Box>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1 }}>
            <IconButton size="small" onClick={() => setZoomClamped(zoom - 0.1)} sx={{ color: TEXT_DIM, p: 0.25 }}><ZoomOutIcon sx={{ fontSize: 16 }} /></IconButton>
            <Box sx={{ flex: 1, height: 4, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.12)', position: 'relative' }}>
              <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${((zoom - 0.3) / 1.2) * 100}%`, borderRadius: 2, bgcolor: BRAND }} />
            </Box>
            <IconButton size="small" onClick={() => setZoomClamped(zoom + 0.1)} sx={{ color: TEXT_DIM, p: 0.25 }}><ZoomInIcon sx={{ fontSize: 16 }} /></IconButton>
            <Typography sx={{ fontSize: 11.5, color: '#fff', width: 36, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{Math.round(zoom * 100)}%</Typography>
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
};

export default StoryboardBoardPage;
