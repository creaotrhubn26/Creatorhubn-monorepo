/**
 * Visual Editor Canvas Component - Performance Optimized
 * Main canvas area with rulers, grid, and element rendering with React.memo optimizations
 */

import { useTheming } from '../../../utils/theming-helper';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Paper, Button, ButtonGroup, Tooltip, Typography, Grid, IconButton } from '@mui/material';
import {
  CropFree as SelectIcon,
  Edit as EditIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  Refresh as RefreshIcon,
  Straighten as ResizeIcon,
  GridOn as GridOnIcon,
  GridOff as GridOffIcon,
} from '@mui/icons-material';

interface EditorElement {
  id: string;
  type: 'button' | 'text' | 'image' | 'card' | 'container' | 'grid' | 'audio' | 'video';
  x: number;
  y: number;
  width: number;
  height: number;
  styles: {
    backgroundColor?: string;
    color?: string;
    padding?: string;
    margin?: string;
    borderRadius?: string;
    fontSize?: string;
    fontWeight?: string;
    lineHeight?: string;
    transform?: string;
    textShadow?: string;
    opacity?: number;
    boxShadow?: string;
    border?: string;
    display?: string;
    gap?: string;
    fontFamily?: string;
    fontStyle?: string;
    background?: string;
    textStroke?: string;
    textAlign?: 'left' | 'center' | 'right' | 'justify';
  };
  props: Record<string, unknown>;
  children?: string[];
  parent?: string;
  icon?: string;
}

interface VisualEditorCanvasProps {
  project: {
    elements: Record<string, EditorElement>;
    pageSettings: {
      width: number;
      height: number;
      backgroundColor: string;
    };
  };
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
  onElementDrag: (elementId: string, position: { x: number; y: number }) => void;
  onElementResize: (elementId: string, size: { width: number; height: number }) => void;
  isDragging: boolean;
  draggedComponent: string | null;
  onDragStart: (componentType: string) => void;
  onDragEnd: () => void;
  onDrop: (position: { x: number; y: number }) => void;
}

interface ElementRendererProps {
  element: EditorElement;
  isSelected: boolean;
  onElementClick: (elementId: string) => void;
  onElementDoubleClick: (elementId: string) => void;
  onElementMouseDown: (event: React.MouseEvent, elementId: string) => void;
}

const getStringProp = (props: Record<string, unknown>, key: string, fallback: string): string => {
  const value = props[key];
  return typeof value === 'string' ? value : fallback;
};

const ElementRenderer = memo(
  ({
    element,
    isSelected,
    onElementClick,
    onElementDoubleClick,
    onElementMouseDown,
  }: ElementRendererProps) => {
    const handleClick = useCallback(
      (event: React.MouseEvent) => {
        event.stopPropagation();
        onElementClick(element.id);
      },
      [element.id, onElementClick],
    );

    const handleDoubleClick = useCallback(
      (event: React.MouseEvent) => {
        event.stopPropagation();
        onElementDoubleClick(element.id);
      },
      [element.id, onElementDoubleClick],
    );

    const elementStyle = useMemo(
      () => ({
        position: 'absolute' as const,
        left: element.x,
        top: element.y,
        width: element.width,
        height: element.height,
        cursor: 'move',
        border: isSelected ? '2px solid #1976d2' : '1px solid transparent',
        borderRadius: '4px',
        '&:hover': { border: '2px solid #42a5f5' },
        ...element.styles,
      }),
      [element, isSelected],
    );

    return (
      <Box
        sx={elementStyle}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onMouseDown={(event) => onElementMouseDown(event, element.id)}
      >
        {element.type === 'text' && (
          <Typography
            sx={{
              width: '100%',
              height: '100%',
              fontSize: element.styles.fontSize ?? '14px',
              fontWeight: element.styles.fontWeight ?? 'normal',
              color: element.styles.color ?? '#222',
              textAlign: element.styles.textAlign ?? 'left',
              ...element.styles,
            }}
          >
            {getStringProp(element.props, 'text', 'Text Element')}
          </Typography>
        )}

        {element.type === 'button' && (
          <Button variant="contained" sx={{ width: '100%', height: '100%', ...element.styles }}>
            {getStringProp(element.props, 'text', 'Button')}
          </Button>
        )}

        {element.type === 'image' && (
          <Box
            sx={{
              width: '100%',
              height: '100%',
              backgroundImage: `url(${getStringProp(element.props, 'src', 'https://via.placeholder.com/320x180')})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              ...element.styles,
            }}
          />
        )}

        {element.type === 'card' && (
          <Paper sx={{ width: '100%', height: '100%', p: 1, ...element.styles }}>
            <Typography variant="subtitle2" fontWeight={600}>
              {getStringProp(element.props, 'title', 'Card Title')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {getStringProp(element.props, 'content', 'Card content...')}
            </Typography>
          </Paper>
        )}

        {element.type === 'grid' && (
          <Grid container spacing={1} sx={{ width: '100%', height: '100%', ...element.styles }}>
            <Grid item xs={6}>
              <Box sx={{ p: 1, bgcolor: '#f5f5f5', height: '100%' }}>
                <Typography variant="caption">Grid Item 1</Typography>
              </Box>
            </Grid>
            <Grid item xs={6}>
              <Box sx={{ p: 1, bgcolor: '#ececec', height: '100%' }}>
                <Typography variant="caption">Grid Item 2</Typography>
              </Box>
            </Grid>
          </Grid>
        )}

        {(element.type === 'container' || element.type === 'audio' || element.type === 'video') && (
          <Box
            sx={{
              width: '100%',
              height: '100%',
              border: '1px dashed #888',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              ...element.styles,
            }}
          >
            <Typography variant="caption" color="text.secondary">
              {element.type.toUpperCase()}
            </Typography>
          </Box>
        )}
      </Box>
    );
  },
);

ElementRenderer.displayName = 'ElementRenderer';

interface RulersProps {
  showRulers: boolean;
  gridSize: number;
  canvasZoom: number;
  canvasPan: { x: number; y: number };
}

const Rulers = memo(({ showRulers, gridSize, canvasZoom, canvasPan }: RulersProps) => {
  if (!showRulers) {
    return null;
  }

  return (
    <>
      <Box
        sx={{
          position: 'absolute',
          left: 20,
          top: 0,
          right: 0,
          height: 20,
          borderBottom: '1px solid #ccc',
          bgcolor: '#f0f0f0',
          backgroundImage: 'linear-gradient(to right, #999 1px, transparent 1px)',
          backgroundSize: `${gridSize * canvasZoom}px 20px`,
          transform: `translateX(${canvasPan.x}px)`,
          zIndex: 2,
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          left: 0,
          top: 20,
          bottom: 0,
          width: 20,
          borderRight: '1px solid #ccc',
          bgcolor: '#f0f0f0',
          backgroundImage: 'linear-gradient(to bottom, #999 1px, transparent 1px)',
          backgroundSize: `20px ${gridSize * canvasZoom}px`,
          transform: `translateY(${canvasPan.y}px)`,
          zIndex: 2,
        }}
      />
    </>
  );
});

Rulers.displayName = 'Rulers';

const VisualEditorCanvasOptimized: React.FC<VisualEditorCanvasProps> = ({
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
  const theming = useTheming('prototype_tester');
  const canvasRef = useRef<HTMLDivElement>(null);
  const [activeDrag, setActiveDrag] = useState<{ id: string; offsetX: number; offsetY: number } | null>(
    null,
  );

  const elements = useMemo(() => Object.values(project.elements), [project.elements]);

  useEffect(() => {
    const handleDelete = (event: KeyboardEvent) => {
      if (event.key !== 'Delete') {
        return;
      }
      selectedElements.forEach((elementId) => onElementDelete(elementId));
    };

    window.addEventListener('keydown', handleDelete);
    return () => window.removeEventListener('keydown', handleDelete);
  }, [selectedElements, onElementDelete]);

  useEffect(() => {
    if (!activeDrag) {
      return;
    }

    const onMouseMoveWindow = (event: MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }

      const rawX = (event.clientX - rect.left - activeDrag.offsetX - canvasPan.x) / canvasZoom;
      const rawY = (event.clientY - rect.top - activeDrag.offsetY - canvasPan.y) / canvasZoom;

      const x = snapToGrid ? Math.round(rawX / gridSize) * gridSize : rawX;
      const y = snapToGrid ? Math.round(rawY / gridSize) * gridSize : rawY;

      onElementDrag(activeDrag.id, { x, y });
    };

    const onMouseUpWindow = () => {
      setActiveDrag(null);
      onDragEnd();
    };

    window.addEventListener('mousemove', onMouseMoveWindow);
    window.addEventListener('mouseup', onMouseUpWindow);

    return () => {
      window.removeEventListener('mousemove', onMouseMoveWindow);
      window.removeEventListener('mouseup', onMouseUpWindow);
    };
  }, [activeDrag, canvasPan, canvasZoom, gridSize, onDragEnd, onElementDrag, snapToGrid]);

  const handleElementClick = useCallback(
    (elementId: string) => {
      onElementSelect(elementId);
    },
    [onElementSelect],
  );

  const handleElementDoubleClick = useCallback(
    (elementId: string) => {
      const current = project.elements[elementId];
      if (!current) {
        return;
      }

      const currentBorder = current.styles.border;
      onElementUpdate(elementId, {
        styles: {
          ...current.styles,
          border: currentBorder ? undefined : '2px solid #ff9800',
        },
      });
    },
    [onElementUpdate, project.elements],
  );

  const handleElementMouseDown = useCallback(
    (event: React.MouseEvent, elementId: string) => {
      event.stopPropagation();
      if (event.button !== 0) {
        return;
      }

      const rect = canvasRef.current?.getBoundingClientRect();
      const element = project.elements[elementId];
      if (!rect || !element) {
        return;
      }

      setActiveDrag({
        id: elementId,
        offsetX: event.clientX - rect.left - (element.x * canvasZoom + canvasPan.x),
        offsetY: event.clientY - rect.top - (element.y * canvasZoom + canvasPan.y),
      });
      onElementSelect(elementId);
      onDragStart(element.type);
    },
    [canvasPan, canvasZoom, onDragStart, onElementSelect, project.elements],
  );

  const handleCanvasClick = useCallback(
    (event: React.MouseEvent) => {
      if (event.target === event.currentTarget) {
        onElementSelect('');
      }
    },
    [onElementSelect],
  );

  const handleCanvasDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const rect = event.currentTarget.getBoundingClientRect();
      const x = (event.clientX - rect.left - canvasPan.x) / canvasZoom;
      const y = (event.clientY - rect.top - canvasPan.y) / canvasZoom;
      onDrop({ x, y });
      onDragEnd();
    },
    [canvasPan, canvasZoom, onDrop, onDragEnd],
  );

  const handleCanvasDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
  }, []);

  const handleZoomIn = useCallback(() => {
    onCanvasZoomChange(Math.min(canvasZoom * 1.2, 5));
  }, [canvasZoom, onCanvasZoomChange]);

  const handleZoomOut = useCallback(() => {
    onCanvasZoomChange(Math.max(canvasZoom / 1.2, 0.1));
  }, [canvasZoom, onCanvasZoomChange]);

  const handleResetZoom = useCallback(() => {
    onCanvasZoomChange(1);
    onCanvasPanChange({ x: 0, y: 0 });
  }, [onCanvasPanChange, onCanvasZoomChange]);

  const resizeSelected = useCallback(
    (factor: number) => {
      selectedElements.forEach((elementId) => {
        const element = project.elements[elementId];
        if (!element) {
          return;
        }

        onElementResize(elementId, {
          width: Math.max(20, Math.round(element.width * factor)),
          height: Math.max(20, Math.round(element.height * factor)),
        });
      });
    },
    [onElementResize, project.elements, selectedElements],
  );

  const canvasStyle = useMemo(
    () => ({
      position: 'relative' as const,
      width: project.pageSettings.width * canvasZoom,
      height: project.pageSettings.height * canvasZoom,
      backgroundColor: project.pageSettings.backgroundColor,
      marginLeft: showRulers ? 20 : 0,
      marginTop: showRulers ? 20 : 0,
      border: '1px solid #ccc',
      backgroundImage: showGrid
        ? 'radial-gradient(circle, rgba(153,153,153,0.5) 1px, transparent 1px)'
        : 'none',
      backgroundSize: `${gridSize * canvasZoom}px ${gridSize * canvasZoom}px`,
      transform: `translate(${canvasPan.x}px, ${canvasPan.y}px)`,
      cursor: activeDrag ? 'grabbing' : 'default',
    }),
    [activeDrag, canvasPan, canvasZoom, gridSize, project.pageSettings, showGrid, showRulers],
  );

  return (
    <Box sx={{ flex: 1, position: 'relative', overflow: 'auto' }}>
      <Box sx={{ position: 'absolute', top: 10, right: 10, zIndex: 10, display: 'flex', gap: 1 }}>
        <ButtonGroup size="small" variant="outlined">
          <Button onClick={handleZoomOut} disabled={canvasZoom <= 0.1}>
            <ZoomOutIcon fontSize="small" />
          </Button>
          <Button onClick={handleResetZoom}>{Math.round(canvasZoom * 100)}%</Button>
          <Button onClick={handleZoomIn} disabled={canvasZoom >= 5}>
            <ZoomInIcon fontSize="small" />
          </Button>
        </ButtonGroup>

        <ButtonGroup size="small" variant="outlined">
          <Tooltip title="Toggle Rulers">
            <Button onClick={() => onShowRulersChange(!showRulers)}>
              {showRulers ? <GridOnIcon fontSize="small" /> : <GridOffIcon fontSize="small" />}
            </Button>
          </Tooltip>
          <Tooltip title="Scale Up Selected">
            <Button onClick={() => resizeSelected(1.1)} disabled={selectedElements.length === 0}>
              <ResizeIcon fontSize="small" />
            </Button>
          </Tooltip>
          <Tooltip title="Delete Selected">
            <Button
              onClick={() => selectedElements.forEach((id) => onElementDelete(id))}
              disabled={selectedElements.length === 0}
            >
              <DeleteIcon fontSize="small" />
            </Button>
          </Tooltip>
        </ButtonGroup>
      </Box>

      <Box sx={{ position: 'absolute', top: 10, left: 10, zIndex: 10, display: 'flex', gap: 1 }}>
        <ButtonGroup size="small" variant="outlined">
          <Tooltip title="Select Tool">
            <Button startIcon={<SelectIcon />} onMouseDown={() => onDragStart('container')}>
              Select
            </Button>
          </Tooltip>
          <Tooltip title="Text Tool">
            <Button startIcon={<EditIcon />} onMouseDown={() => onDragStart('text')}>
              Text
            </Button>
          </Tooltip>
          <Tooltip title="Button Tool">
            <Button startIcon={<AddIcon />} onMouseDown={() => onDragStart('button')}>
              Button
            </Button>
          </Tooltip>
          <Tooltip title="Reset Pan">
            <IconButton size="small" onClick={() => onCanvasPanChange({ x: 0, y: 0 })}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </ButtonGroup>
      </Box>

      <Box sx={{ position: 'relative' }}>
        <Rulers showRulers={showRulers} gridSize={gridSize} canvasZoom={canvasZoom} canvasPan={canvasPan} />

        <Box
          ref={canvasRef}
          sx={canvasStyle}
          onClick={handleCanvasClick}
          onDrop={handleCanvasDrop}
          onDragOver={handleCanvasDragOver}
        >
          {elements.map((element) => (
            <ElementRenderer
              key={element.id}
              element={element}
              isSelected={selectedElements.includes(element.id)}
              onElementClick={handleElementClick}
              onElementDoubleClick={handleElementDoubleClick}
              onElementMouseDown={handleElementMouseDown}
            />
          ))}

          {isDragging && (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                border: '2px dashed #1976d2',
                bgcolor: 'rgba(25, 118, 210, 0.08)',
                pointerEvents: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Typography variant="subtitle1" sx={{ color: theming.colors.primary }}>
                Drop {draggedComponent ?? 'component'} here
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default memo(VisualEditorCanvasOptimized);
