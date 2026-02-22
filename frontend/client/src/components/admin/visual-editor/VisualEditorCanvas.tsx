/**
 * Visual Editor Canvas Component
 * Main canvas area for visual editing with inline editing, drag, resize, rulers, snap-to-grid
 */

import { useTheming } from '../../../utils/theming-helper';
import React, { useRef, useCallback, useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
} from '@mui/material';

interface EditorElement {
  id: string;
  type: 'button' | 'text' | 'image' | 'card' | 'container' | 'grid' | 'audio' | 'video';
  x: number;
  y: number;
  width: number;
  height: number;
  styles: Record<string, unknown>;
  props: Record<string, unknown>;
  children?: string[];
  parent?: string;
  icon?: string;
}

interface EditorProject {
  id: string;
  name: string;
  elements: Record<string, EditorElement>;
  pageSettings: {
    width: number;
    height: number;
    backgroundColor: string;
  };
}

interface VisualEditorCanvasProps {
  project: EditorProject;
  selectedElements: string[];
  onElementSelect: (elementId: string) => void;
  onElementUpdate: (elementId: string, updates: Partial<EditorElement>) => void;
  onElementDelete: (elementId: string) => void;
  showGrid: boolean;
  snapToGrid: boolean;
  gridSize: number;
  canvasZoom: number;
  onCanvasZoomChange: (zoom: number) => void;
  canvasPan: { x: number; y: number };
  onCanvasPanChange: (pan: { x: number; y: number }) => void;
  showRulers: boolean;
  onShowRulersChange: (show: boolean) => void;
  onElementDrag: (elementId: string, deltaX: number, deltaY: number) => void;
  onElementResize: (elementId: string, width: number, height: number) => void;
  isDragging: boolean;
  draggedComponent: string | null;
  onDragStart: (componentType: string) => void;
  onDragEnd: () => void;
  onDrop: (position: { x: number; y: number }) => void;
}

// Ruler bar thickness constant
const RULER_SIZE = 20;

// Ruler tick marks component
const Ruler: React.FC<{
  orientation: 'horizontal' | 'vertical';
  size: number;
  zoom: number;
  gridSize: number;
}> = ({ orientation, size, zoom, gridSize }) => {
  const ticks: React.ReactNode[] = [];
  const scaledGridSize = gridSize * zoom;
  const tickCount = Math.ceil(size / scaledGridSize) + 1;

  for (let i = 0; i < tickCount; i++) {
    const pos = i * scaledGridSize;
    const isMajor = i % 5 === 0;
    const value = Math.round(i * gridSize);

    if (orientation === 'horizontal') {
      ticks.push(
        <Box
          key={i}
          sx={{
            position: 'absolute',
            left: pos,
            bottom: 0,
            width: 1,
            height: isMajor ? 12 : 6,
            bgcolor: isMajor ? 'text.secondary' : '#ccc',
          }}
        />,
      );
      if (isMajor) {
        ticks.push(
          <Typography
            key={`label-${i}`}
            variant="caption"
            sx={{
              position: 'absolute',
              left: pos + 2,
              top: 0,
              fontSize: '9px',
              color: 'text.disabled',
              userSelect: 'none',
            }}
          >
            {value}
          </Typography>,
        );
      }
    } else {
      ticks.push(
        <Box
          key={i}
          sx={{
            position: 'absolute',
            top: pos,
            right: 0,
            height: 1,
            width: isMajor ? 12 : 6,
            bgcolor: isMajor ? 'text.secondary' : '#ccc',
          }}
        />,
      );
      if (isMajor) {
        ticks.push(
          <Typography
            key={`label-${i}`}
            variant="caption"
            sx={{
              position: 'absolute',
              top: pos + 2,
              left: 1,
              fontSize: '9px',
              color: 'text.disabled',
              userSelect: 'none',
              writingMode: 'vertical-lr',
            }}
          >
            {value}
          </Typography>,
        );
      }
    }
  }

  return (
    <Box
      sx={{
        position: 'absolute',
        ...(orientation === 'horizontal'
          ? { top: 0, left: RULER_SIZE, height: RULER_SIZE, width: '100%' }
          : { top: RULER_SIZE, left: 0, width: RULER_SIZE, height: '100%' }),
        bgcolor: '#fafafa',
        borderBottom: orientation === 'horizontal' ? '1px solid #ddd' : undefined,
        borderRight: orientation === 'vertical' ? '1px solid #ddd' : undefined,
        overflow: 'hidden',
        zIndex: 10,
      }}
    >
      {ticks}
    </Box>
  );
};



// Resize handle positions
type HandlePosition = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w';

const HANDLE_SIZE = 8;

const handleCursors: Record<HandlePosition, string> = {
  nw: 'nwse-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  se: 'nwse-resize',
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
};

const handlePositions = (w: number, h: number): Record<HandlePosition, { left: number; top: number }> => ({
  nw: { left: -HANDLE_SIZE / 2, top: -HANDLE_SIZE / 2 },
  ne: { left: w - HANDLE_SIZE / 2, top: -HANDLE_SIZE / 2 },
  sw: { left: -HANDLE_SIZE / 2, top: h - HANDLE_SIZE / 2 },
  se: { left: w - HANDLE_SIZE / 2, top: h - HANDLE_SIZE / 2 },
  n: { left: w / 2 - HANDLE_SIZE / 2, top: -HANDLE_SIZE / 2 },
  s: { left: w / 2 - HANDLE_SIZE / 2, top: h - HANDLE_SIZE / 2 },
  e: { left: w - HANDLE_SIZE / 2, top: h / 2 - HANDLE_SIZE / 2 },
  w: { left: -HANDLE_SIZE / 2, top: h / 2 - HANDLE_SIZE / 2 },
});

const VisualEditorCanvas: React.FC<VisualEditorCanvasProps> = ({
  project,
  selectedElements,
  onElementSelect,
  onElementUpdate,
  onElementDelete,
  showGrid,
  snapToGrid,
  gridSize,
  canvasZoom,
  onCanvasZoomChange,
  canvasPan,
  onCanvasPanChange,
  showRulers,
  onShowRulersChange,
  onElementDrag,
  onElementResize,
  isDragging,
  draggedComponent,
  onDragStart,
  onDragEnd,
  onDrop,
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);

  // Theming system
  const theming = useTheming('prototype_tester');

  // Inline editing state
  const [editingElementId, setEditingElementId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // Drag state for element moving
  const [dragState, setDragState] = useState<{
    elementId: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  // Resize state
  const [resizeState, setResizeState] = useState<{
    elementId: string;
    handle: HandlePosition;
    startMouseX: number;
    startMouseY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
  } | null>(null);

  // Snap helper
  const snapValue = useCallback(
    (value: number): number => {
      if (!snapToGrid) return value;
      return Math.round(value / gridSize) * gridSize;
    },
    [snapToGrid, gridSize],
  );

  // --- Element click: select, or double-click for inline editing ---
  const handleElementClick = useCallback(
    (elementId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      onElementSelect(elementId);
    },
    [onElementSelect],
  );

  const handleElementDoubleClick = useCallback(
    (elementId: string, element: EditorElement, e: React.MouseEvent) => {
      e.stopPropagation();
      if (element.type === 'text' || element.type === 'button') {
        setEditingElementId(elementId);
        setEditValue(String(element.props.text ?? ''));
      }
    },
    [],
  );

  // Commit inline edit
  const commitInlineEdit = useCallback(() => {
    if (editingElementId) {
      onElementUpdate(editingElementId, { props: { text: editValue } } as Partial<EditorElement>);
      setEditingElementId(null);
      setEditValue('');
    }
  }, [editingElementId, editValue, onElementUpdate]);

  // --- Canvas click to deselect ---
  const handleCanvasClick = useCallback(
    (event: React.MouseEvent) => {
      if (event.target === canvasRef.current) {
        onElementSelect(''); // Deselect all
        commitInlineEdit();
      }
    },
    [onElementSelect, commitInlineEdit],
  );

  // --- Keyboard: Delete key removes selected, Escape deselects ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editingElementId) {
        if (e.key === 'Escape') {
          setEditingElementId(null);
          setEditValue('');
        }
        if (e.key === 'Enter') {
          commitInlineEdit();
        }
        return; // Don't intercept typing while editing
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        selectedElements.forEach((id) => onElementDelete(id));
      }
      if (e.key === 'Escape') {
        onElementSelect('');
      }
      // Toggle rulers with R key
      if (e.key === 'r' && !e.ctrlKey && !e.metaKey) {
        onShowRulersChange(!showRulers);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedElements,
    onElementDelete,
    onElementSelect,
    editingElementId,
    commitInlineEdit,
    showRulers,
    onShowRulersChange,
  ]);

  // --- Wheel zoom ---
  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = -e.deltaY * 0.001;
        const newZoom = Math.min(3, Math.max(0.1, canvasZoom + delta));
        onCanvasZoomChange(newZoom);
      }
    };
    canvasEl.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvasEl.removeEventListener('wheel', handleWheel);
  }, [canvasZoom, onCanvasZoomChange]);

  // --- Drag handling (element move) ---
  const handleDragStartElement = useCallback(
    (elementId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const element = project.elements[elementId];
      if (!element) return;
      onDragStart(element.type);
      setDragState({
        elementId,
        startX: e.clientX,
        startY: e.clientY,
        origX: element.x,
        origY: element.y,
      });
    },
    [project.elements, onDragStart],
  );

  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = (e.clientX - dragState.startX) / canvasZoom;
      const deltaY = (e.clientY - dragState.startY) / canvasZoom;
      const newX = snapValue(dragState.origX + deltaX);
      const newY = snapValue(dragState.origY + deltaY);

      onElementDrag(dragState.elementId, newX - dragState.origX, newY - dragState.origY);
      onElementUpdate(dragState.elementId, { x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setDragState(null);
      onDragEnd();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, canvasZoom, snapValue, onElementDrag, onElementUpdate, onDragEnd]);

  // --- Resize handling ---
  const handleResizeStart = useCallback(
    (elementId: string, handle: HandlePosition, e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const element = project.elements[elementId];
      if (!element) return;
      setResizeState({
        elementId,
        handle,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        origX: element.x,
        origY: element.y,
        origW: element.width,
        origH: element.height,
      });
    },
    [project.elements],
  );

  useEffect(() => {
    if (!resizeState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = (e.clientX - resizeState.startMouseX) / canvasZoom;
      const dy = (e.clientY - resizeState.startMouseY) / canvasZoom;
      let newX = resizeState.origX;
      let newY = resizeState.origY;
      let newW = resizeState.origW;
      let newH = resizeState.origH;
      const h = resizeState.handle;

      if (h.includes('e')) newW = Math.max(20, resizeState.origW + dx);
      if (h.includes('w')) {
        newW = Math.max(20, resizeState.origW - dx);
        newX = resizeState.origX + (resizeState.origW - newW);
      }
      if (h.includes('s')) newH = Math.max(20, resizeState.origH + dy);
      if (h.includes('n')) {
        newH = Math.max(20, resizeState.origH - dy);
        newY = resizeState.origY + (resizeState.origH - newH);
      }

      newX = snapValue(newX);
      newY = snapValue(newY);
      newW = snapValue(newW);
      newH = snapValue(newH);

      onElementUpdate(resizeState.elementId, { x: newX, y: newY, width: newW, height: newH });
      onElementResize(resizeState.elementId, newW, newH);
    };

    const handleMouseUp = () => {
      setResizeState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizeState, canvasZoom, snapValue, onElementUpdate, onElementResize]);

  // --- Drop from component library ---
  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      if (draggedComponent && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const x = snapValue((event.clientX - rect.left - canvasPan.x) / canvasZoom);
        const y = snapValue((event.clientY - rect.top - canvasPan.y) / canvasZoom);
        onDrop({ x, y });
      }
    },
    [draggedComponent, canvasPan, canvasZoom, onDrop, snapValue],
  );

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
  }, []);

  // Ruler offset (shift canvas content when rulers are visible)
  const rulerOffset = showRulers ? RULER_SIZE : 0;

  return (
    <Box
      sx={{
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: '#f5f5f5',
      }}
    >
      {/* Horizontal Ruler */}
      {showRulers && (
        <Ruler
          orientation="horizontal"
          size={project.pageSettings.width * canvasZoom + 200}
          zoom={canvasZoom}
          gridSize={gridSize}
        />
      )}

      {/* Vertical Ruler */}
      {showRulers && (
        <Ruler
          orientation="vertical"
          size={project.pageSettings.height * canvasZoom + 200}
          zoom={canvasZoom}
          gridSize={gridSize}
        />
      )}

      {/* Canvas Container */}
      <Box
        ref={canvasRef}
        onClick={handleCanvasClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        sx={{
          position: 'relative',
          width: '100%',
          height: '100%',
          marginTop: `${rulerOffset}px`,
          marginLeft: `${rulerOffset}px`,
          transform: `scale(${canvasZoom}) translate(${canvasPan.x}px, ${canvasPan.y}px)`,
          transformOrigin: '0 0',
          cursor: isDragging ? 'grabbing' : dragState ? 'move' : 'default',
        }}
      >
        {/* Grid Background */}
        {showGrid && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              backgroundImage: `
                linear-gradient(to right, #e0e0e0 1px, transparent 1px),
                linear-gradient(to bottom, #e0e0e0 1px, transparent 1px)
              `,
              backgroundSize: `${gridSize}px ${gridSize}px`,
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />
        )}

        {/* Page Background */}
        <Paper
          elevation={2}
          sx={{
            position: 'absolute',
            top: 20,
            left: 20,
            width: project.pageSettings.width,
            height: project.pageSettings.height,
            backgroundColor: project.pageSettings.backgroundColor,
            border: '1px solid #ccc',
            zIndex: 1,
            ...theming.getThemedCardSx(),
          }}
        >
          {/* Render Elements */}
          {Object.values(project.elements).map((element) => {
            const isSelected = selectedElements.includes(element.id);
            const isEditing = editingElementId === element.id;
            const handles = handlePositions(element.width, element.height);

            return (
              <Box
                key={element.id}
                onClick={(e) => handleElementClick(element.id, e)}
                onDoubleClick={(e) => handleElementDoubleClick(element.id, element, e)}
                onMouseDown={(e) => {
                  if (!isEditing && e.button === 0) {
                    handleDragStartElement(element.id, e);
                  }
                }}
                sx={{
                  position: 'absolute',
                  left: element.x,
                  top: element.y,
                  width: element.width,
                  height: element.height,
                  border: isSelected
                    ? '2px solid #1976d2'
                    : '1px solid transparent',
                  cursor: isEditing ? 'text' : 'pointer',
                  ...(element.styles as Record<string, unknown>),
                  '&:hover': {
                    border: isSelected ? '2px solid #1976d2' : '1px solid #1976d2',
                    opacity: 0.9,
                  },
                }}
              >
                {/* Inline editing for text / button */}
                {isEditing && (element.type === 'text' || element.type === 'button') ? (
                  <TextField
                    autoFocus
                    multiline={element.type === 'text'}
                    variant="standard"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={commitInlineEdit}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        commitInlineEdit();
                      }
                      if (e.key === 'Escape') {
                        setEditingElementId(null);
                        setEditValue('');
                      }
                    }}
                    sx={{
                      width: '100%',
                      height: '100%',
                      '& .MuiInputBase-root': {
                        height: '100%',
                        fontSize: (element.styles as Record<string, unknown>).fontSize ?? '16px',
                        color: element.type === 'button' ? 'white' : 'inherit',
                        p: 1,
                      },
                      '& .MuiInput-underline:before': { borderBottom: 'none' },
                      '& .MuiInput-underline:after': { borderBottom: '2px solid #1976d2' },
                    }}
                    InputProps={{ disableUnderline: element.type === 'button' }}
                  />
                ) : (
                  <>
                    {element.type === 'text' && (
                      <Box sx={{ p: 1 }}>
                        {String(element.props.text ?? 'Text Element')}
                      </Box>
                    )}
                    {element.type === 'button' && (
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          height: '100%',
                          backgroundColor: '#1976d2',
                          color: 'white',
                          borderRadius: 1,
                          cursor: 'pointer',
                        }}
                      >
                        {String(element.props.text ?? 'Button')}
                      </Box>
                    )}
                    {element.type === 'image' && (
                      <Box
                        sx={{
                          width: '100%',
                          height: '100%',
                          overflow: 'hidden',
                        }}
                      >
                        {element.props.src ? (
                          <Box
                            component="img"
                            src={String(element.props.src)}
                            alt={String(element.props.alt ?? 'Image')}
                            sx={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                            }}
                          />
                        ) : (
                          <Box
                            sx={{
                              width: '100%',
                              height: '100%',
                              backgroundColor: '#f0f0f0',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              border: '1px dashed #ccc',
                            }}
                          >
                            Image
                          </Box>
                        )}
                      </Box>
                    )}
                    {element.type === 'card' && (
                      <Box
                        sx={{
                          width: '100%',
                          height: '100%',
                          backgroundColor: 'white',
                          border: '1px solid #e0e0e0',
                          borderRadius: 1,
                          p: 2,
                          boxShadow: 1,
                        }}
                      >
                        <Box sx={{ fontWeight: 'bold', mb: 1 }}>
                          {String(element.props.title ?? 'Card Title')}
                        </Box>
                        <Box sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
                          {String(element.props.content ?? 'Card content goes here...')}
                        </Box>
                      </Box>
                    )}
                  </>
                )}

                {/* Resize handles — only when selected and not editing */}
                {isSelected && !isEditing &&
                  (Object.entries(handles) as Array<[HandlePosition, { left: number; top: number }]>).map(
                    ([pos, coords]) => (
                      <Box
                        key={pos}
                        onMouseDown={(e) => handleResizeStart(element.id, pos, e)}
                        sx={{
                          position: 'absolute',
                          left: coords.left,
                          top: coords.top,
                          width: HANDLE_SIZE,
                          height: HANDLE_SIZE,
                          bgcolor: 'white',
                          border: '2px solid #1976d2',
                          borderRadius: '2px',
                          cursor: handleCursors[pos],
                          zIndex: 20,
                          '&:hover': { bgcolor: '#1976d2' },
                        }}
                      />
                    ),
                  )}
              </Box>
            );
          })}
        </Paper>
      </Box>
    </Box>
  );
};

export default VisualEditorCanvas;