/**
 * FrameEditorPanel - Drawing and annotation editor for storyboard frames
 * 
 * Features:
 * - Canvas drawing (pen, shapes, arrows)
 * - Text annotations
 * - Actor/blocking markers
 * - Undo/redo
 * - Export annotated frame
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Box,
  Paper,
  IconButton,
  Tooltip,
  Stack,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
  Slider,
  Popover,
  Typography,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Edit,
  Timeline,
  ArrowForward,
  CropSquare,
  RadioButtonUnchecked,
  TextFields,
  PersonPin,
  Delete,
  Undo,
  Redo,
  Save,
  Clear,
  ColorLens,
  LineWeight,
  PanTool,
  Brush,
  AutoFixHigh,
} from '@mui/icons-material';
import {
  FrameCanvasEngine,
  ToolType,
  DrawingStyle,
  DEFAULT_STYLE,
  MARKER_COLORS,
} from '../../core/storyboard/FrameCanvasEngine';
import {
  useStoryboardStore,
  useSelectedFrame,
  StoryboardFrame,
} from '../../state/storyboardStore';

// =============================================================================
// Color Palette
// =============================================================================

const COLOR_PALETTE = [
  '#ff4444','#ff8844','#ffcc44','#44ff44','#44ffcc','#44ccff','#4488ff','#8844ff','#ff44ff','#ffffff','#cccccc','#888888','#444444','#000000',
];

// =============================================================================
// Main Component
// =============================================================================

interface FrameEditorPanelProps {
  frame: StoryboardFrame;
  onSave?: (annotatedImageUrl: string) => void;
  onClose?: () => void;
}

export const FrameEditorPanel: React.FC<FrameEditorPanelProps> = ({
  frame,
  onSave,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<FrameCanvasEngine | null>(null);
  
  // State
  const [currentTool, setCurrentTool] = useState<ToolType>('select');
  const [currentStyle, setCurrentStyle] = useState<DrawingStyle>(DEFAULT_STYLE);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [colorAnchor, setColorAnchor] = useState<HTMLElement | null>(null);
  const [textDialogOpen, setTextDialogOpen] = useState(false);
  const [markerDialogOpen, setMarkerDialogOpen] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [markerLabel, setMarkerLabel] = useState('A,');
  const [markerType, setMarkerType] = useState<keyof typeof MARKER_COLORS>('actor');
  const [pendingPosition, setPendingPosition] = useState<{ x: number; y: number } | null>(null);

  // Store
  const { updateFrame } = useStoryboardStore();

  // Initialize canvas engine
  useEffect(() => {
    if (!canvasRef.current) return;

    const engine = new FrameCanvasEngine();
    engineRef.current = engine;

    // Initialize with frame image
    engine.initialize(
      canvasRef.current,
      frame.imageUrl,
      (state) => {
        // Update undo/redo state
        setCanUndo(engine.canUndo());
        setCanRedo(engine.canRedo());
      },
      (objectId) => {
        // Handle selection
      }
    );

    // Load existing annotations if any
    if ((frame as any).canvasState) {
      engine.loadState((frame as any).canvasState);
    }

    return () => {
      engine.destroy();
    };
  }, [frame.id, frame.imageUrl]);

  // Update engine when tool changes
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setTool(currentTool);
    }
  }, [currentTool]);

  // Update engine when style changes
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setStyle(currentStyle);
    }
  }, [currentStyle]);

  // Handle tool change
  const handleToolChange = (_: React.MouseEvent<HTMLElement>, newTool: ToolType | null) => {
    if (newTool) {
      setCurrentTool(newTool);
      
      // Special handling for text and marker tools
      if (newTool === 'text') {
        setTextDialogOpen(true);
      } else if (newTool === 'marker') {
        setMarkerDialogOpen(true);
      }
    }
  };

  // Handle color change
  const handleColorChange = (color: string) => {
    setCurrentStyle((prev) => ({ ...prev, strokeColor: color }));
    setColorAnchor(null);
  };

  // Handle stroke width change
  const handleStrokeWidthChange = (_: Event, value: number | number[]) => {
    setCurrentStyle((prev) => ({ ...prev, strokeWidth: value as number }));
  };

  // Handle undo
  const handleUndo = () => {
    if (engineRef.current?.undo()) {
      setCanUndo(engineRef.current.canUndo());
      setCanRedo(engineRef.current.canRedo());
    }
  };

  // Handle redo
  const handleRedo = () => {
    if (engineRef.current?.redo()) {
      setCanUndo(engineRef.current.canUndo());
      setCanRedo(engineRef.current.canRedo());
    }
  };

  // Handle clear
  const handleClear = () => {
    engineRef.current?.clear();
    setCanUndo(engineRef.current?.canUndo() || false);
    setCanRedo(engineRef.current?.canRedo() || false);
  };

  // Handle delete selected
  const handleDelete = () => {
    engineRef.current?.deleteSelected();
    setCanUndo(engineRef.current?.canUndo() || false);
    setCanRedo(engineRef.current?.canRedo() || false);
  };

  // Handle add text
  const handleAddText = () => {
    if (!textInput.trim() || !canvasRef.current) return;
    
    // Add text at center of canvas
    const rect = canvasRef.current.getBoundingClientRect();
    engineRef.current?.addText(
      { x: rect.width / 2, y: rect.height / 2 },
      textInput.trim()
    );
    
    setTextInput(', ');
    setTextDialogOpen(false);
    setCurrentTool('select');
  };

  // Handle add marker
  const handleAddMarker = () => {
    if (!canvasRef.current) return;
    
    // Add marker at center of canvas
    const rect = canvasRef.current.getBoundingClientRect();
    engineRef.current?.addMarker(
      { x: rect.width / 2, y: rect.height / 2 },
      markerLabel,
      markerType
    );
    
    setMarkerDialogOpen(false);
    setCurrentTool('select');
  };

  // Handle save
  const handleSave = () => {
    if (!engineRef.current) return;
    
    // Get annotated image
    const annotatedImageUrl = engineRef.current.toDataURL('jpeg', 0.9);
    
    // Save canvas state to frame
    const canvasState = engineRef.current.getState();
    updateFrame(frame.id, {
      // Store canvas state for future editing
      ...({ canvasState } as any),
    });
    
    onSave?.(annotatedImageUrl);
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#0a0a12' }}>
      {/* Toolbar */}
      <Paper
        elevation={0}
        sx={{
          p: 1,
          bgcolor: '#1a1a2e',
          borderBottom: 1,
          borderColor: 'divider'}}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          {/* Tool Selection */}
          <ToggleButtonGroup
            value={currentTool}
            exclusive
            onChange={handleToolChange}
            size="small"
          >
            <ToggleButton value="select">
              <Tooltip title="Select (V)"><PanTool fontSize="small" /></Tooltip>
            </ToggleButton>
            <ToggleButton value="pen">
              <Tooltip title="Pen (P)"><Brush fontSize="small" /></Tooltip>
            </ToggleButton>
            <ToggleButton value="line">
              <Tooltip title="Line (L)"><Timeline fontSize="small" /></Tooltip>
            </ToggleButton>
            <ToggleButton value="arrow">
              <Tooltip title="Arrow (A)"><ArrowForward fontSize="small" /></Tooltip>
            </ToggleButton>
            <ToggleButton value="rectangle">
              <Tooltip title="Rectangle (R)"><CropSquare fontSize="small" /></Tooltip>
            </ToggleButton>
            <ToggleButton value="circle">
              <Tooltip title="Circle (C)"><RadioButtonUnchecked fontSize="small" /></Tooltip>
            </ToggleButton>
            <ToggleButton value="text">
              <Tooltip title="Text (T)"><TextFields fontSize="small" /></Tooltip>
            </ToggleButton>
            <ToggleButton value="marker">
              <Tooltip title="Marker (M)"><PersonPin fontSize="small" /></Tooltip>
            </ToggleButton>
            <ToggleButton value="eraser">
              <Tooltip title="Eraser (E)"><AutoFixHigh fontSize="small" /></Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>

          <Divider orientation="vertical" flexItem />

          {/* Color Picker */}
          <Tooltip title="Color">
            <IconButton
              onClick={(e) => setColorAnchor(e.currentTarget)}
              sx={{
                bgcolor: currentStyle.strokeColor,
                width: 32,
                height: 32,
                border: 2,
                borderColor: '#fff', '&:hover': { bgcolor: currentStyle.strokeColor }}}
            >
              <ColorLens sx={{ color: '#fff', fontSize: 16 }} />
            </IconButton>
          </Tooltip>

          {/* Stroke Width */}
          <Box sx={{ width: 100, px: 1 }}>
            <Tooltip title="Stroke Width">
              <Stack direction="row" spacing={1} alignItems="center">
                <LineWeight fontSize="small" sx={{ color: 'text.secondary' }} />
                <Slider
                  value={currentStyle.strokeWidth}
                  onChange={handleStrokeWidthChange}
                  min={1}
                  max={20}
                  size="small"
                />
              </Stack>
            </Tooltip>
          </Box>

          <Divider orientation="vertical" flexItem />

          {/* Actions */}
          <Tooltip title="Undo (Ctrl+Z)">
            <span>
              <IconButton onClick={handleUndo} disabled={!canUndo} size="small">
                <Undo fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Redo (Ctrl+Shift+Z)">
            <span>
              <IconButton onClick={handleRedo} disabled={!canRedo} size="small">
                <Redo fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Delete Selected">
            <IconButton onClick={handleDelete} size="small">
              <Delete fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Clear All">
            <IconButton onClick={handleClear} size="small" color="error">
              <Clear fontSize="small" />
            </IconButton>
          </Tooltip>

          <Box sx={{ flexGrow: 1 }} />

          {/* Save */}
          <Button
            variant="contained"
            startIcon={<Save />}
            onClick={handleSave}
            size="small"
          >
            Save Annotations
          </Button>
        </Stack>
      </Paper>

      {/* Canvas Area */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 2,
          overflow: 'auto'}}
      >
        <Paper
          elevation={4}
          sx={{
            maxWidth: '100%',
            maxHeight: '100%',
            overflow: 'hidden',
            borderRadius: 1}}
        >
          <canvas
            ref={canvasRef}
            width={1920}
            height={1080}
            style={{
              display: 'block',
              maxWidth: '100%',
              maxHeight: 'calc(100vh - 200px)',
              cursor: currentTool === 'select' ? 'default' : 'crosshair'}}
          />
        </Paper>
      </Box>

      {/* Frame Info Footer */}
      <Paper
        elevation={0}
        sx={{
          p: 1,
          bgcolor: '#1a1a2e',
          borderTop: 1,
          borderColor: 'divider'}}
      >
        <Stack direction="row" spacing={2} alignItems="center">
          <Typography variant="caption" color="text.secondary">
            Frame {frame.index + 1}: {frame.title}
          </Typography>
          <Divider orientation="vertical" flexItem />
          <Typography variant="caption" color="text.secondary">
            {frame.shotType} • {frame.cameraAngle}
          </Typography>
          <Divider orientation="vertical" flexItem />
          <Typography variant="caption" color="text.secondary">
            f/{frame.sceneSnapshot.camera.aperture} • {frame.sceneSnapshot.camera.focalLength}mm
          </Typography>
        </Stack>
      </Paper>

      {/* Color Popover */}
      <Popover
        open={Boolean(colorAnchor)}
        anchorEl={colorAnchor}
        onClose={() => setColorAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Box sx={{ p: 1, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.5 }}>
          {COLOR_PALETTE.map((color) => (
            <IconButton
              key={color}
              onClick={() => handleColorChange(color)}
              sx={{
                width: 28,
                height: 28,
                bgcolor: color,
                border: currentStyle.strokeColor === color ? 2 : 1,
                borderColor: currentStyle.strokeColor === color ? 'primary.main' : '#555','&:hover': { bgcolor: color }}}
            />
          ))}
        </Box>
      </Popover>

      {/* Text Dialog */}
      <Dialog open={textDialogOpen} onClose={() => setTextDialogOpen(false)}>
        <DialogTitle>Add Text Annotation</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Enter annotation text..."
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTextDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAddText} disabled={!textInput.trim()}>
            Add Text
          </Button>
        </DialogActions>
      </Dialog>

      {/* Marker Dialog */}
      <Dialog open={markerDialogOpen} onClose={() => setMarkerDialogOpen(false)}>
        <DialogTitle>Add Blocking Marker</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1, minWidth: 300 }}>
            <TextField
              label="Label"
              value={markerLabel}
              onChange={(e) => setMarkerLabel(e.target.value.slice(0, 2))}
              placeholder="A, B, 1, 2..."
              inputProps={{ maxLength: 2 }}
            />
            <Typography variant="subtitle2">Marker Type</Typography>
            <Stack direction="row" spacing={1}>
              {(Object.keys(MARKER_COLORS) as Array<keyof typeof MARKER_COLORS>).map((type) => (
                <Tooltip key={type} title={type.charAt(0).toUpperCase() + type.slice(1)}>
                  <IconButton
                    onClick={() => setMarkerType(type)}
                    sx={{
                      bgcolor: MARKER_COLORS[type],
                      border: markerType === type ? 3 : 1,
                      borderColor: markerType === type ? '#fff' : 'transparent','&:hover': { bgcolor: MARKER_COLORS[type] }}}
                  >
                    <PersonPin sx={{ color: '#fff' }} />
                  </IconButton>
                </Tooltip>
              ))}
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMarkerDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAddMarker}>
            Add Marker
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FrameEditorPanel;

