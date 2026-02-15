/**
 * FrameDrawingEditor - Storyboard frame drawing interface
 * 
 * Wraps PencilCanvas for storyboard frame sketching on iPad
 * Integrates with StoryboardStore for persistence
 */

import { useState, useCallback, useMemo, useRef, type FC } from 'react';
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

import { PencilCanvas, BrushType, BrushSettings } from './PencilCanvas';
import { PencilCanvasPro, ReferenceImage } from './PencilCanvasPro';
import { ProBrushType, ProBrushSettings } from './drawing/AdvancedBrushEngine';
import { PencilStroke } from '../hooks/useApplePencil';
import { useDeviceDetection } from '../hooks/useDeviceDetection';
import { 
  useStoryboardStore, 
  StoryboardFrame, 
  FrameDrawingData,
  FrameImageSource 
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

// =============================================================================
// Styled Components
// =============================================================================

const EditorContainer = styled(Paper)(({ theme }) => ({
  backgroundColor: '#1a1a2e',
  borderRadius: theme.spacing(2),
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
}));

const ToolbarContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: theme.spacing(1, 2),
  backgroundColor: 'rgba(0,0,0,0.3)',
  borderBottom: '1px solid rgba(255,255,255,0.1)',
}));

const CanvasWrapper = styled(Box)({
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#0f0f1a',
  position: 'relative',
});

const StatusBar = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: theme.spacing(0.5, 2),
  backgroundColor: 'rgba(0,0,0,0.2)',
  borderTop: '1px solid rgba(255,255,255,0.1)',
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

function getCanvasDimensions(
  aspectRatio: string,
  containerWidth: number,
  containerHeight: number
): CanvasDimensions {
  const ratio = ASPECT_RATIOS[aspectRatio] || 16 / 9;
  const maxWidth = containerWidth - 40;
  const maxHeight = containerHeight - 40;

  let width = maxWidth;
  let height = width / ratio;

  if (height > maxHeight) {
    height = maxHeight;
    width = height * ratio;
  }

  return { width: Math.floor(width), height: Math.floor(height) };
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
  
  // Store actions
  const { updateFrame } = useStoryboardStore();

  // State
  const [strokes, setStrokes] = useState<PencilStroke[]>(initialStrokes || []);
  const [brushSettings, setBrushSettings] = useState<Partial<BrushSettings>>({
    type: 'pen',
    size: 3,
    color: '#ffffff',
    opacity: 1,
  });
  const [referenceImage, setReferenceImage] = useState<ReferenceImage | null>(initialReferenceImage || null);
  const [isFullscreen, setIsFullscreen] = useState(mode === 'fullscreen');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [lastSavedImage, setLastSavedImage] = useState<string | null>(null);

  // Calculate canvas dimensions based on container and aspect ratio
  const canvasDimensions = useMemo(() => {
    const containerWidth = isFullscreen ? window.innerWidth : 800;
    const containerHeight = isFullscreen ? window.innerHeight - 120 : 500;
    return getCanvasDimensions(aspectRatio, containerWidth, containerHeight);
  }, [aspectRatio, isFullscreen]);

  // Handle stroke changes
  const handleStrokesChange = useCallback((newStrokes: PencilStroke[]) => {
    setStrokes(newStrokes);
    setHasUnsavedChanges(true);
  }, []);

  // Handle save
  const handleSave = useCallback((imageData: string) => {
    const drawingData: FrameDrawingData = {
      dataUrl: imageData,
      strokes: JSON.stringify(strokes),
      brushSettings: brushSettings as FrameDrawingData['brushSettings'],
      deviceType: device.hasPencilSupport ? 'pencil' : device.hasTouchScreen ? 'touch' : 'mouse',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Update frame in store if we have a frame ID
    if (frameId && storyboardId) {
      updateFrame(frameId, {
        imageUrl: imageData,
        drawingData,
        imageSource: 'drawn' as FrameImageSource,
        updatedAt: new Date().toISOString(),
      });
    }

    // Call external save handler
    onSave?.(drawingData, imageData);
    
    setLastSavedImage(imageData);
    setHasUnsavedChanges(false);
  }, [strokes, brushSettings, device, frameId, storyboardId, updateFrame, onSave]);

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
        width: isFullscreen ? '100vw' : '100%',
        height: isFullscreen ? '100vh' : 'auto',
        maxWidth: isFullscreen ? 'none' : 900,
      }}
    >
      {/* Toolbar */}
      <ToolbarContainer>
        <Stack direction="row" spacing={2} alignItems="center">
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

        <Stack direction="row" spacing={1} alignItems="center">
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
            width={canvasDimensions.width}
            height={canvasDimensions.height}
            backgroundImage={initialImage}
            referenceImage={referenceImage || undefined}
            initialStrokes={strokes}
            showToolbar={true}
            showPressureIndicator={device.hasPencilSupport}
            showReferenceImageControls={true}
            palmRejection="smart"
            onStrokesChange={handleStrokesChange}
            onSave={handleSave}
            onReferenceImageChange={setReferenceImage}
          />
        ) : (
          <PencilCanvas
            width={canvasDimensions.width}
            height={canvasDimensions.height}
            backgroundImage={initialImage}
            initialStrokes={strokes}
            brushSettings={brushSettings}
            showToolbar={true}
            showPressureIndicator={device.hasPencilSupport}
            palmRejection="smart"
            onStrokesChange={handleStrokesChange}
            onSave={handleSave}
          />
        )}
      </CanvasWrapper>

      {/* Status Bar */}
      <StatusBar>
        <Stack direction="row" spacing={2} alignItems="center">
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

        <Stack direction="row" spacing={1}>
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
            onClick={() => {
              // Trigger save from canvas - need to expose method
              // For now we rely on PencilCanvas save button
            }}
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
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: 'transparent',
            backgroundImage: 'none',
            boxShadow: 'none',
            overflow: 'visible',
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
