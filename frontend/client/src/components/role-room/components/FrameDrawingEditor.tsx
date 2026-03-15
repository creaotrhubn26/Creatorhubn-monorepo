/**
 * FrameDrawingEditor - Storyboard frame drawing interface
 * 
 * Wraps PencilCanvas for storyboard frame sketching on iPad
 * Integrates with StoryboardStore for persistence
 */

import { useState, useCallback, useMemo, useRef, useEffect, type FC } from 'react';
import {
  Box,
  Paper,
  IconButton,
  Stack,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  Chip,
  Divider,
  ToggleButtonGroup,
  ToggleButton,
  Fade,
  Alert,
} from '@mui/material';
import {
  Save,
  Close,
  Undo,
  Redo,
  Delete,
  Fullscreen,
  FullscreenExit,
  AspectRatio,
  Brush,
  Create,
  Highlight,
  AutoAwesome,
  TouchApp,
  Image as ImageIcon,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';

import {
  PencilCanvas,
  type BrushSettings,
  type BrushType,
  type PencilCanvasHandle,
} from './PencilCanvas';
import {
  PencilCanvasPro,
  type ReferenceImage,
  type PencilCanvasProHandle,
} from './PencilCanvasPro';
import { type ProBrushType } from './drawing/AdvancedBrushEngine';
import type { PencilStroke } from '../hooks/useApplePencil';
import { useDeviceDetection } from '../hooks/useDeviceDetection';
import {
  useStoryboardStore,
  type FrameDrawingData,
  type FrameImageSource,
  type StoryboardFrame,
} from '../state/storyboardStore';

// =============================================================================
// Types
// =============================================================================

export interface FrameDrawingEditorProps {
  frameId?: string;
  storyboardId?: string;
  aspectRatio?: '16:9' | '4:3' | '2.35:1' | '1:1' | '9:16';
  initialImage?: string;
  initialStrokes?: PencilStroke[];
  onSave?: (drawingData: FrameDrawingData, imageDataUrl: string) => void;
  onCancel?: () => void;
  mode?: 'dialog' | 'inline' | 'fullscreen';
  sceneId?: string; // Link to manuscript scene
  manuscriptId?: string;
  /** Enable pro mode with watercolor, reference images, advanced brushes */
  proMode?: boolean;
  /** Reference image for tracing (pro mode only) */
  referenceImage?: ReferenceImage;
}

interface CanvasDimensions {
  width: number;
  height: number;
}

interface ViewportSize {
  width: number;
  height: number;
}

// =============================================================================
// Styled Components
// =============================================================================

const EditorContainer = styled(Paper)(({ theme }) => ({
  backgroundColor: '#1a1a2e',
  borderRadius: theme.spacing(2),
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  maxWidth: '100vw',
  maxHeight: '100dvh',
}));

const ToolbarContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: theme.spacing(1),
  padding: theme.spacing(1, 2),
  backgroundColor: 'rgba(8, 11, 24, 0.96)',
  borderBottom: '1px solid rgba(255,255,255,0.1)',
  position: 'relative',
  zIndex: 5,
  isolation: 'isolate',
  overflow: 'hidden',
  [theme.breakpoints.down('md')]: {
    padding: theme.spacing(1, 1.25),
  },
}));

const CanvasWrapper = styled(Box)(({ theme }) => ({
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#0f0f1a',
  position: 'relative',
  padding: theme.spacing(0.5),
  overflow: 'hidden',
  [theme.breakpoints.down('md')]: {
    padding: theme.spacing(0.25),
  },
}));

const StatusBar = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  flexWrap: 'wrap',
  gap: theme.spacing(1),
  padding: theme.spacing(0.5, 2),
  backgroundColor: 'rgba(0,0,0,0.2)',
  borderTop: '1px solid rgba(255,255,255,0.1)',
  [theme.breakpoints.down('md')]: {
    padding: theme.spacing(0.75, 1.25),
  },
}));

// =============================================================================
// Aspect Ratio Helpers
// =============================================================================

const ASPECT_RATIOS: Record<string, number> = {
  '16:9': 16 / 9,
  '4:3': 4 / 3,
  '2.35:1': 2.35,
  '1:1': 1,
  '9:16': 9 / 16,
};

const STANDARD_BRUSH_OPTIONS: BrushType[] = ['pen', 'marker', 'highlighter'];
const PRO_BRUSH_OPTIONS: ProBrushType[] = ['pen', 'marker', 'highlighter'];

function isBrushType(value: string): value is BrushType {
  return (STANDARD_BRUSH_OPTIONS as string[]).includes(value);
}

function isProBrushType(value: string): value is ProBrushType {
  return (PRO_BRUSH_OPTIONS as string[]).includes(value);
}

function getCanvasDimensions(
  aspectRatio: string,
  containerWidth: number,
  containerHeight: number
): CanvasDimensions {
  const ratio = ASPECT_RATIOS[aspectRatio] || 16 / 9;
  const edgePadding = containerWidth < 900 ? 14 : 24;
  const maxWidth = Math.max(240, containerWidth - edgePadding);
  const maxHeight = Math.max(160, containerHeight - edgePadding);

  let width = maxWidth;
  let height = width / ratio;

  if (height > maxHeight) {
    height = maxHeight;
    width = height * ratio;
  }

  return { width: Math.floor(width), height: Math.floor(height) };
}

function getInitialViewport(): ViewportSize {
  if (typeof window === 'undefined') {
    return { width: 1280, height: 800 };
  }
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

// =============================================================================
// Main Component
// =============================================================================

export const FrameDrawingEditor: FC<FrameDrawingEditorProps> = ({
  frameId,
  storyboardId,
  aspectRatio = '16:9',
  initialImage,
  initialStrokes,
  onSave,
  onCancel,
  mode = 'dialog',
  sceneId,
  manuscriptId,
  proMode = true, // Default to pro mode with advanced brushes
  referenceImage: initialReferenceImage,
}) => {
  const device = useDeviceDetection();
  const containerRef = useRef<HTMLDivElement>(null);
  const standardCanvasRef = useRef<PencilCanvasHandle | null>(null);
  const proCanvasRef = useRef<PencilCanvasProHandle | null>(null);
  
  // Store actions
  const { updateFrame } = useStoryboardStore();

  // State
  const [strokes, setStrokes] = useState<PencilStroke[]>(initialStrokes || []);
  const [brushSettings, setBrushSettings] = useState<BrushSettings>({
    type: 'pen',
    size: 3,
    color: '#ffffff',
    opacity: 1,
  });
  const [brushType, setBrushType] = useState<BrushType>('pen');
  const [proBrushType, setProBrushType] = useState<ProBrushType>('pen');
  const [autoEnhance, setAutoEnhance] = useState(false);
  const [highlightMode, setHighlightMode] = useState(false);
  const [referenceImage, setReferenceImage] = useState<ReferenceImage | null>(initialReferenceImage || null);
  const [isFullscreen, setIsFullscreen] = useState(mode === 'fullscreen');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [lastSavedImage, setLastSavedImage] = useState<string | null>(null);
  const [viewport, setViewport] = useState<ViewportSize>(getInitialViewport);
  const [editorContainerSize, setEditorContainerSize] = useState<ViewportSize>({ width: 0, height: 0 });

  useEffect(() => {
    let rafId: number | null = null;
    const handleResize = () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      rafId = window.requestAnimationFrame(() => {
        const next = getInitialViewport();
        setViewport((prev) => (
          Math.abs(prev.width - next.width) >= 2 || Math.abs(prev.height - next.height) >= 2
            ? next
            : prev
        ));
        rafId = null;
      });
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, []);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const [entry] = entries;
      if (!entry) return;
      const nextWidth = Math.floor(entry.contentRect.width);
      const nextHeight = Math.floor(entry.contentRect.height);
      setEditorContainerSize((prev) => (
        Math.abs(prev.width - nextWidth) >= 2 || Math.abs(prev.height - nextHeight) >= 2
          ? { width: nextWidth, height: nextHeight }
          : prev
      ));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const isCompactUi = viewport.width < 1200 || device.isIPad;
  const isDesktopCanvasPriority = !device.isIPad && viewport.width >= 1366;
  const horizontalPadding = isFullscreen ? 0 : (viewport.width < 900 ? 10 : 20);
  const verticalPadding = isFullscreen ? 0 : (viewport.height < 900 ? 8 : 14);
  const editorMaxWidth = viewport.width >= 5120
    ? 4600
    : viewport.width >= 3840
      ? 3300
      : viewport.width >= 2560
        ? 2500
        : viewport.width >= 1920
          ? 1950
          : viewport.width >= 1366
            ? 1560
            : 1180;
  const editorWidth = isFullscreen
    ? viewport.width
    : Math.max(320, Math.min(viewport.width - horizontalPadding * 2, editorMaxWidth));
  const editorHeight = isFullscreen
    ? viewport.height
    : Math.max(540, viewport.height - verticalPadding * 2);
  const showEmbeddedCanvasToolbar = true;
  const drawingToolsPanelWidth = viewport.width >= 3840
    ? 360
    : viewport.width >= 2560
      ? 320
      : viewport.width >= 1920
        ? 288
        : 264;
  const initialToolsPanelCollapsed = isDesktopCanvasPriority;

  // Calculate canvas dimensions based on container and aspect ratio
  const canvasDimensions = useMemo(() => {
    const measuredWidth = editorContainerSize.width || editorWidth;
    const measuredHeight = editorContainerSize.height || editorHeight;
    const chromeHeight = (isCompactUi ? 210 : 144)
      + (isCompactUi ? 68 : 0)
      + (device.isIPad && device.hasPencilSupport ? 42 : 0);
    const availableWidth = Math.max(320, measuredWidth - (isCompactUi ? 12 : 20));
    const availableHeight = Math.max(220, measuredHeight - chromeHeight);
    return getCanvasDimensions(aspectRatio, availableWidth, availableHeight);
  }, [
    aspectRatio,
    editorContainerSize.width,
    editorContainerSize.height,
    editorWidth,
    editorHeight,
    isCompactUi,
    showEmbeddedCanvasToolbar,
    device.isIPad,
    device.hasPencilSupport,
  ]);

  const getCanvasApi = useCallback(() => (
    proMode ? proCanvasRef.current : standardCanvasRef.current
  ), [proMode]);

  useEffect(() => {
    setBrushSettings((prev) => {
      const nextType: BrushType = highlightMode ? 'highlighter' : brushType;
      const nextOpacity = highlightMode ? 0.35 : prev.opacity;
      const nextSize = autoEnhance ? Math.max(prev.size, 4) : prev.size;
      if (prev.type === nextType && prev.opacity === nextOpacity && prev.size === nextSize) {
        return prev;
      }
      return {
        ...prev,
        type: nextType,
        opacity: nextOpacity,
        size: nextSize,
      };
    });
  }, [brushType, highlightMode, autoEnhance]);

  const handleUndo = useCallback(() => {
    getCanvasApi()?.undo();
  }, [getCanvasApi]);

  const handleRedo = useCallback(() => {
    getCanvasApi()?.redo();
  }, [getCanvasApi]);

  const handleClear = useCallback(() => {
    getCanvasApi()?.clear();
    setHasUnsavedChanges(true);
  }, [getCanvasApi]);

  useEffect(() => {
    if (proMode) {
      proCanvasRef.current?.setBrush({
        type: proBrushType,
        size: brushSettings.size,
        color: brushSettings.color,
        opacity: brushSettings.opacity,
      });
      return;
    }
    standardCanvasRef.current?.setBrush(brushSettings);
  }, [proMode, proBrushType, brushSettings]);

  const handleSaveFromToolbar = useCallback(() => {
    getCanvasApi()?.save();
  }, [getCanvasApi]);

  // Handle stroke changes
  const handleStrokesChange = useCallback((newStrokes: PencilStroke[]) => {
    setStrokes(newStrokes);
    setHasUnsavedChanges(true);
  }, []);

  // Handle save
  const handleSave = useCallback((imageData: string) => {
    const normalizedBrushSettings: NonNullable<FrameDrawingData['brushSettings']> = {
      type: proMode ? proBrushType : brushSettings.type,
      size: brushSettings.size,
      color: brushSettings.color,
      opacity: brushSettings.opacity,
    };
    const drawingData: FrameDrawingData = {
      dataUrl: imageData,
      strokes: JSON.stringify(strokes),
      brushSettings: normalizedBrushSettings,
      deviceType: device.hasPencilSupport ? 'pencil' : device.hasTouchScreen ? 'touch' : 'mouse',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Update frame in store if we have a frame ID
    if (frameId && storyboardId) {
      const imageSource: FrameImageSource = 'drawn';
      const framePatch: Partial<StoryboardFrame> = {
        imageUrl: imageData,
        drawingData,
        imageSource,
        updatedAt: new Date().toISOString(),
      };
      updateFrame(frameId, framePatch);
    }

    // Call external save handler
    onSave?.(drawingData, imageData);
    
    setLastSavedImage(imageData);
    setHasUnsavedChanges(false);
  }, [strokes, proMode, proBrushType, brushSettings, device, frameId, storyboardId, updateFrame, onSave]);

  // Handle cancel with unsaved changes check
  const handleCancel = useCallback(() => {
    if (hasUnsavedChanges) {
      setShowDiscardDialog(true);
    } else {
      onCancel?.();
    }
  }, [hasUnsavedChanges, onCancel]);

  // Discard changes and close
  const handleDiscardChanges = useCallback(() => {
    setShowDiscardDialog(false);
    setHasUnsavedChanges(false);
    onCancel?.();
  }, [onCancel]);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  // Render the editor content
  const editorContent = (
    <EditorContainer
      ref={containerRef}
      sx={{
        width: isFullscreen ? '100vw' : `${editorWidth}px`,
        height: isFullscreen ? '100dvh' : `${editorHeight}px`,
        borderRadius: isFullscreen ? 0 : 3,
        mx: isFullscreen ? 0 : 'auto',
      }}
    >
      {/* Toolbar */}
      <ToolbarContainer>
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{
            flex: '1 1 520px',
            minWidth: 0,
            flexWrap: 'wrap',
            columnGap: 1,
            rowGap: 1,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Brush sx={{ color: '#8b5cf6' }} />
            <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 600 }}>
              Frame Drawing
            </Typography>
          </Box>
          
          {frameId && (
            <Chip 
              label={`Frame: ${frameId.slice(-6)}`} 
              size="small" 
              sx={{ bgcolor: 'rgba(139,92,246,0.2)', color: '#8b5cf6' }}
            />
          )}
          
          {sceneId && (
            <Chip 
              label={`Scene: ${sceneId}`} 
              size="small" 
              sx={{ bgcolor: 'rgba(6,182,212,0.2)', color: '#06b6d4' }}
            />
          )}

          {manuscriptId && (
            <Chip
              icon={<ImageIcon sx={{ fontSize: 14 }} />}
              label={`Manus: ${manuscriptId.slice(-6)}`}
              size="small"
              sx={{ bgcolor: 'rgba(217,119,6,0.2)', color: '#fbbf24' }}
            />
          )}

          {lastSavedImage && (
            <Chip
              icon={<Save sx={{ fontSize: 14 }} />}
              label="Saved"
              size="small"
              sx={{ bgcolor: 'rgba(34,197,94,0.2)', color: '#4ade80' }}
            />
          )}

          <Chip
            icon={device.hasPencilSupport ? <Create sx={{ fontSize: 14 }} /> : <TouchApp sx={{ fontSize: 14 }} />}
            label={device.hasPencilSupport ? 'Apple Pencil' : device.hasTouchScreen ? 'Touch' : 'Mouse'}
            size="small"
            sx={{ 
              bgcolor: device.hasPencilSupport ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.1)',
              color: device.hasPencilSupport ? '#22c55e' : 'rgba(255,255,255,0.6)',
            }}
          />
        </Stack>

        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{
            flex: '1 1 520px',
            minWidth: 0,
            justifyContent: { xs: 'flex-start', md: 'flex-end' },
            flexWrap: 'wrap',
            columnGap: 1,
            rowGap: 1,
          }}
        >
          <ToggleButtonGroup
            size="small"
            exclusive
            value={proMode ? proBrushType : brushType}
            onChange={(_, value: string | null) => {
              if (!value) return;
              if (proMode && isProBrushType(value)) {
                setProBrushType(value);
                return;
              }
              if (isBrushType(value)) {
                setBrushType(value);
              }
            }}
            sx={{
              maxWidth: '100%',
              '& .MuiToggleButton-root': {
                color: 'rgba(255,255,255,0.7)',
                borderColor: 'rgba(255,255,255,0.2)',
                px: { xs: 1, md: 1.5 },
                fontSize: { xs: '0.75rem', md: '0.875rem' },
              },
            }}
          >
            <ToggleButton value="pen">Pen</ToggleButton>
            <ToggleButton value={proMode ? 'marker' : 'marker'}>Marker</ToggleButton>
            <ToggleButton value={proMode ? 'highlighter' : 'highlighter'}>Highlight</ToggleButton>
          </ToggleButtonGroup>

          <ToggleButtonGroup
            size="small"
            value={[highlightMode ? 'highlight' : null, autoEnhance ? 'enhance' : null].filter(Boolean)}
            onChange={(_, values: string[]) => {
              setHighlightMode(values.includes('highlight'));
              setAutoEnhance(values.includes('enhance'));
            }}
            sx={{
              '& .MuiToggleButton-root': {
                color: 'rgba(255,255,255,0.7)',
                borderColor: 'rgba(255,255,255,0.2)',
              },
            }}
          >
            <ToggleButton value="highlight">
              <Tooltip title="Highlight Mode"><Highlight sx={{ fontSize: 16 }} /></Tooltip>
            </ToggleButton>
            <ToggleButton value="enhance">
              <Tooltip title="Auto Enhance"><AutoAwesome sx={{ fontSize: 16 }} /></Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>

          <Tooltip title="Undo">
            <span>
              <IconButton onClick={handleUndo} sx={{ color: 'rgba(255,255,255,0.87)' }} disabled={!strokes.length}>
                <Undo />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Redo">
            <span>
              <IconButton onClick={handleRedo} sx={{ color: 'rgba(255,255,255,0.87)' }} disabled={!strokes.length}>
                <Redo />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Clear">
            <IconButton onClick={handleClear} sx={{ color: 'rgba(255,255,255,0.87)' }}>
              <Delete />
            </IconButton>
          </Tooltip>

          <Tooltip title="Aspect Ratio">
            <Chip
              icon={<AspectRatio sx={{ fontSize: 14 }} />}
              label={aspectRatio}
              size="small"
              sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: '#fff' }}
            />
          </Tooltip>

          <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

          <Tooltip title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}>
            <IconButton onClick={toggleFullscreen} sx={{ color: 'rgba(255,255,255,0.87)' }}>
              {isFullscreen ? <FullscreenExit /> : <Fullscreen />}
            </IconButton>
          </Tooltip>

          <Tooltip title="Cancel">
            <IconButton onClick={handleCancel} sx={{ color: 'rgba(255,255,255,0.87)' }}>
              <Close />
            </IconButton>
          </Tooltip>
        </Stack>
      </ToolbarContainer>

      {/* iPad drawing tip */}
      {device.isIPad && device.hasPencilSupport && (
        <Fade in>
          <Alert 
            severity="info" 
            sx={{ 
              borderRadius: 0, 
              bgcolor: 'rgba(59,130,246,0.1)', 
              color: '#60a5fa',
              '& .MuiAlert-icon': { color: '#60a5fa' },
            }}
          >
            Apple Pencil detected! Use pressure for line width and tilt for brush effects.
          </Alert>
        </Fade>
      )}

      {/* Canvas Area */}
      <CanvasWrapper>
        {proMode ? (
          <PencilCanvasPro
            ref={proCanvasRef}
            width={canvasDimensions.width}
            height={canvasDimensions.height}
            backgroundImage={initialImage}
            referenceImage={referenceImage || undefined}
            initialStrokes={strokes}
            brushSettings={{
              type: proBrushType,
              size: brushSettings.size,
              color: brushSettings.color,
              opacity: brushSettings.opacity,
            }}
            showToolbar={showEmbeddedCanvasToolbar}
            showPressureIndicator={device.hasPencilSupport}
            showReferenceImageControls={true}
            initialToolsPanelCollapsed={initialToolsPanelCollapsed}
            drawingToolsPanelWidth={drawingToolsPanelWidth}
            drawingToolsPanelCollapsedWidth={64}
            palmRejection="smart"
            onStrokesChange={handleStrokesChange}
            onSave={handleSave}
            onReferenceImageChange={setReferenceImage}
          />
        ) : (
          <PencilCanvas
            ref={standardCanvasRef}
            width={canvasDimensions.width}
            height={canvasDimensions.height}
            backgroundImage={initialImage}
            initialStrokes={strokes}
            brushSettings={brushSettings}
            showToolbar={showEmbeddedCanvasToolbar}
            showPressureIndicator={device.hasPencilSupport}
            palmRejection="smart"
            onStrokesChange={handleStrokesChange}
            onSave={handleSave}
          />
        )}
      </CanvasWrapper>

      {/* Status Bar */}
      <StatusBar>
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{ flexWrap: 'wrap', flex: '1 1 320px', minWidth: 0 }}
        >
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
            {canvasDimensions.width} × {canvasDimensions.height}px
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
            Strokes: {strokes.length}
          </Typography>
          {hasUnsavedChanges && (
            <Chip 
              label="Unsaved" 
              size="small" 
              sx={{ bgcolor: 'rgba(245,158,11,0.2)', color: '#f59e0b', height: 20 }}
            />
          )}
        </Stack>

        <Stack
          direction="row"
          spacing={1}
          sx={{ flexWrap: 'wrap', justifyContent: { xs: 'flex-start', md: 'flex-end' }, flex: '1 1 280px' }}
        >
          <Button
            variant="outlined"
            size="small"
            onClick={handleCancel}
            sx={{ color: 'rgba(255,255,255,0.87)', borderColor: 'rgba(255,255,255,0.2)' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            size="small"
            startIcon={<Save />}
            disabled={!hasUnsavedChanges}
            sx={{ bgcolor: '#8b5cf6', '&:hover': { bgcolor: '#7c3aed' } }}
            onClick={handleSaveFromToolbar}
          >
            Save to Frame
          </Button>
        </Stack>
      </StatusBar>

      {/* Discard Changes Dialog */}
      <Dialog
        open={showDiscardDialog}
        onClose={() => setShowDiscardDialog(false)}
        PaperProps={{
          sx: { bgcolor: '#1a1a2e', backgroundImage: 'none' },
        }}
      >
        <DialogTitle sx={{ color: '#fff' }}>Discard Changes?</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'rgba(255,255,255,0.87)' }}>
            You have unsaved changes. Are you sure you want to discard them?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDiscardDialog(false)} sx={{ color: 'rgba(255,255,255,0.87)' }}>
            Keep Editing
          </Button>
          <Button onClick={handleDiscardChanges} color="error">
            Discard
          </Button>
        </DialogActions>
      </Dialog>
    </EditorContainer>
  );

  // Render based on mode
  if (mode === 'dialog') {
    return (
      <Dialog
        open
        onClose={handleCancel}
        fullScreen={isFullscreen}
        maxWidth={false}
        fullWidth={false}
        PaperProps={{
          sx: {
            bgcolor: 'transparent',
            backgroundImage: 'none',
            boxShadow: 'none',
            overflow: 'visible',
            m: isFullscreen ? 0 : { xs: 0.5, sm: 1.5, md: 2 },
            width: 'fit-content',
            maxWidth: '100vw',
          },
        }}
      >
        {editorContent}
      </Dialog>
    );
  }

  return editorContent;
};

// =============================================================================
// Quick Drawing Button Component
// =============================================================================

export interface QuickDrawButtonProps {
  frameId: string;
  storyboardId: string;
  aspectRatio?: '16:9' | '4:3' | '2.35:1' | '1:1' | '9:16';
  existingImage?: string;
  onDrawingComplete?: (drawingData: FrameDrawingData, imageDataUrl: string) => void;
}

export const QuickDrawButton: FC<QuickDrawButtonProps> = ({
  frameId,
  storyboardId,
  aspectRatio = '16:9',
  existingImage,
  onDrawingComplete,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const device = useDeviceDetection();

  return (
    <>
      <Tooltip title={device.hasPencilSupport ? 'Draw with Apple Pencil' : 'Draw Frame'}>
        <IconButton
          onClick={() => setIsOpen(true)}
          sx={{
            bgcolor: 'rgba(139,92,246,0.1)',
            '&:hover': { bgcolor: 'rgba(139,92,246,0.2)' },
          }}
        >
          <Brush sx={{ color: '#8b5cf6' }} />
        </IconButton>
      </Tooltip>

      {isOpen && (
        <FrameDrawingEditor
          frameId={frameId}
          storyboardId={storyboardId}
          aspectRatio={aspectRatio}
          initialImage={existingImage}
          mode="dialog"
          onSave={(data, imageUrl) => {
            onDrawingComplete?.(data, imageUrl);
            setIsOpen(false);
          }}
          onCancel={() => setIsOpen(false)}
        />
      )}
    </>
  );
};

export default FrameDrawingEditor;
