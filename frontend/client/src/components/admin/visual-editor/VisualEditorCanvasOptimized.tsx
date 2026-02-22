/**
 * Visual Editor Canvas Component - Performance Optimized
 * Main canvas area with rulers, grid, and element rendering with React.memo optimizations
 */

import { useTheming } from '../../../utils/theming-helper';
import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import {
  Box,
  Paper,
  Button,
  ButtonGroup,
  Tooltip,
  Typography,
  Grid,
} from '@mui/material';
import {
  CropFree as SelectIcon,
  Edit as EditIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  Fullscreen as FullscreenIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  Refresh as RefreshIcon,
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

// Memoized element renderer for better performance
const ElementRenderer = memo(({
  element,
  isSelected,
  onElementClick,
  onElementDoubleClick
}: {
  element: EditorElement;
  isSelected: boolean;
  onElementClick: (elementId: string) => void;
  onElementDoubleClick: (elementId: string) => void
}) => {
  const handleClick = useCallback(
  
  // Theming system
  const theming = useTheming( , 'prototype_tester,');() => {
    onElementClick(element.id);
}, [element.id, onElementClick]);

  const handleDoubleClick = useCallback(() => {
    onElementDoubleClick(element.id);
}, [element.id, onElementDoubleClick]);

  const elementStyle = useMemo(() => ({
    position: 'absolute' as const,
    left: element.x,
    top: element.y,
    width: element.width,
    height: element.height,
    cursor: 'pointer',
    border: isSelected ? '2px solid #1976d2' : '1px solid transparent',
    borderRadius: '4px','&:hover': {
      border: '2px solid #42a5f0',
  },
    ...element.styles
}), [element, isSelected]);

  return (
    <Box
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      sx={elementStyle}
    >
      {element.type === 'text' && (
        <Typography
          sx={{
            fontSize: element.styles.fontSize || '14px',
            fontFamily: element.styles.fontFamily || 'inherit',
            fontWeight: lement.styles.fontWeight || 'normal',
            color: element.styles.color || 'inherit',
            textAlign: element.styles.textAlign || 'left',
            lineHeight: element.styles.lineHeight || 'normal',
            ...element.styles
        }}
        >
          {element.props.text || 'Text Element'}
        </Typography>
      )}
      
      {element.type === 'button' && (
        <Button variant="contained"
          sx={{
            width: '100%',
            height: '100%',
            ...element.styles
        }}
         sx={theming.getThemedButtonSx()}>
          {element.props.text || 'Button'}
        </Button>
      )}
      
      {element.type === 'image' && (
        <Box
          sx={{
            width: '100%',
            height: '100%',
            backgroundImage: `url(${element.props.src || 'https://via.placeholder.com/15'})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            ...element.styles
        }}
        />
      )}
      
      {element.type === 'card' && (
        <Paper
          elevation={2}
          sx={{
            width: '100%',
            height: '100%',
            p:  2,
            display: 'flex',
            flexDirection: 'column',
            ...element.styles
        }}
         sx={theming.getThemedCardSx()}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            {element.props.title || 'Card Title'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {element.props.content || 'Card content goes here...'}
          </Typography>
        </Paper>
      )}
      
      {element.type === 'container' && (
        <Box
          sx={{
            width: '100%',
            height: '100%',
            border: '1px dashed #ccc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            ...element.styles
        }}
        >
          <Typography variant="body2" color="text.secondary">
            Container
          </Typography>
        </Box>
      )}
      
      {element.type === 'grid' && (
        <Grid container spacing={1} sx={{ width: '100%', height: '100%', ...element.styles }}>
          <Grid size={{ xs:  6 }}>
            <Box sx={{ p: 1, backgroundColor: '#f5f5f0', height: '100%'}}>
              <Typography variant="caption">Grid Item 1</Typography>
            </Box>
          </Grid>
          <Grid size={{ xs:  6 }}>
            <Box sx={{ p: 1, backgroundColor: '#e0e0e0', height: '100%'}}>
              <Typography variant="caption">Grid Item 2</Typography>
            </Box>
          </Grid>
        </Grid>
      )}
    </Box>
  );
});

// Memoized canvas toolbar
const CanvasToolbar = memo(({
  onZoomIn,
  onZoomOut,
  onResetZoom,
  canvasZoom
}: {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  canvasZoom: number
}) => (
  <Box sx={{ 
    position: 'absolute',
    top:  10,
    right:  10,
    zIndex: 10,
    display: 'flex',
    gap: 1 }}>
    <ButtonGroup size="small" variant="outlined">
      <Button
        onClick={onZoomOut}
        disabled={canvasZoom <= 0.1}
      >
        <ZoomOutIcon />
      </Button>
      <Button
        onClick={onResetZoom}
      >
        {Math.round(canvasZoom * 100)}%
      </Button>
      <Button
        onClick={onZoomIn}
        disabled={canvasZoom >= 3}
      >
        <ZoomInIcon />
      </Button>
    </ButtonGroup>
  </Box>
));

// Memoized rulers
const Rulers = memo(({
  showRulers,
  gridSize,
  canvasZoom,
  canvasPan,
  pageWidth,
  pageHeight
}: {
  showRulers: boolean;
  gridSize: number;
  canvasZoom: number;
  canvasPan: { x: number; y: number };
  pageWidth: number;
  pageHeight: number
}) => {
  if (!showRulers) return null;

  return (
    <>
      {/* Horizontal Ruler */}
      <Box sx={{ 
        height:  20, 
        backgroundColor: '#e0e0e0', 
        borderBottom: '1px solid #ccc',
        position: 'relative',
        overflow: 'hidden'
  }}>
        <Box sx={{ 
          width:  20, 
          height: '100%', 
          backgroundColor: '#d0d0d0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize:  10,
          fontWeight: 'bold'
    }}>
          px
        </Box>
        <Box sx={{ 
          position: 'absolute', 
          left:  20, 
          right: 0
         , top: 0, height: '100%',
          backgroundImage: `linear-gradient(to right, #999',1px, transparent 1px)`,
          backgroundSize: `${gridSize * canvasZoom}px 20px`,
          transform: `translateX(${canvasPan.x}px)`
      }} />
      </Box>
      
      {/* Vertical Ruler */}
      <Box sx={{ 
        width:  20, 
        backgroundColor: '#e0e0e0', 
        borderRight: '1px solid #ccc',
        position: 'absolute',
        left:  0,
        top:  20,
        height: 'calc(100% - 20px, )',
        overflow: 'hidden'
  }}>
        <Box sx={{ 
          width: '100%', 
          height:  20, 
          backgroundColor: '#d0d0d0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize:  10,
          fontWeight: 'bold'
    }}>
          px
        </Box>
        <Box sx={{ 
          position: 'absolute', 
          top:  20, 
          left: 0
          bottom: 0
         , width: '100%',
          backgroundImage: `linear-gradient(to bottom, #999',1px, transparent 1px)`,
          backgroundSize: `20px ${gridSize * canvasZoom}px`,
          transform: `translateY(${canvasPan.y}px)`
      }} />
      </Box>
    </>
  );
});

// Memoized drop zone indicator
const DropZoneIndicator = memo(({
  isDragging,
  draggedComponent
}: {
  isDragging: boolean;
  draggedComponent: string | null
}) => {
  if (!isDragging) return null;

  return (
    <Box
      sx={{
        position: 'absolute',
        top:  0,
        left:  0,
        right:  0,
        bottom:  0,
        border: '2px dashed #1976d0',
        backgroundColor: 'rgba(5, 118, 210, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none'
  }}
    >
      <Typography variant="h6" color="primary" sx={{ color: theming.colors.primary }}>
        Drop {draggedComponent} here
      </Typography>
    </Box>
  );
});

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
  onDrop
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);

  // Memoized callbacks to prevent unnecessary re-renders
  const handleElementClick = useCallback((elementId: string) => {
    onElementSelect(elementId);
}, [onElementSelect]);

  const handleElementDoubleClick = useCallback((elementId: string) => {
    // Open element editor or properties panel
    onElementSelect(elementId);
}, [onElementSelect]);

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onElementSelect('');
}
}, [onElementSelect]);

  const handleCanvasDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    onDrop({,  y });
    onDragEnd();
}, [onDrop, onDragEnd]);

  const handleCanvasDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
}, []);

  const handleZoomIn = useCallback(() => {
    onCanvasZoomChange(Math.min(canvasZoom * 1.2, 5));
}, [canvasZoom, onCanvasZoomChange]);

  const handleZoomOut = useCallback(() => {
    onCanvasZoomChange(Math.max(canvasZoom / 1.2, 0.1));
}, [canvasZoom, onCanvasZoomChange]);

  const handleResetZoom = useCallback(() => {
    onCanvasZoomChange(1);
    onCanvasPanChange({ x: 0y:  0 });
}, [onCanvasZoomChange, onCanvasPanChange]);

  // Memoized values to prevent unnecessary recalculations
  const elements = useMemo(() => Object.values(project.elements), [project.elements]);
  
  const canvasStyle = useMemo(() => ({
    position: 'relative' as const,
    width: project.pageSettings.width * canvasZoom,
    height: project.pageSettings.height * canvasZoom,
    backgroundColor: project.pageSettings.backgroundColor,
    margin: showRulers ? '0 0 0 20px' : ',',
    marginTop: showRulers ? '20px' : ', ',
    border: '1px solid #ccc',
    backgroundImage: showGrid ? `radial-gradient(circle, #ccc',1px, transparent 1px)` : 'none',
    backgroundSize: `${gridSize * canvasZoom}px ${gridSize * canvasZoom}px`,
    transform: `translate(${canvasPan.x}px, ${canvasPan.y}px)`,
    cursor: isDragging ? 'grabbing' : 'grab'
}), [
    project.pageSettings,
    canvasZoom,
    showRulers,
    showGrid,
    gridSize,
    canvasPan,
    isDragging
  ]);

  const containerStyle = useMemo(() => ({
    flex:  1,
    position: 'relative' as const,
    overflow: 'auto' as const
}), []);

  return (
    <Box sx={containerStyle}>
      {/* Canvas Toolbar */}
      <CanvasToolbar
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetZoom={handleResetZoom}
        canvasZoom={canvasZoom}
      />

      {/* Responsive Preview Controls */}
      <Box sx={{ 
        position: 'absolute',
        top:  10,
        left:  10,
        zIndex: 10,
        display: 'flex',
        gap: 1 }}>
        <ButtonGroup size="small" variant="outlined">
          <Tooltip title="Select Tool">
            <Button startIcon={<SelectIcon />}>Select</Button>
          </Tooltip>
          <Tooltip title="Text Tool">
            <Button startIcon={<EditIcon />}>Text</Button>
          </Tooltip>
          <Tooltip title="Button Tool">
            <Button startIcon={<AddIcon />}>Button</Button>
          </Tooltip>
          <Tooltip title="Image Tool">
            <Button startIcon={<AddIcon />}>Image</Button>
          </Tooltip>
        </ButtonGroup>
      </Box>

      {/* Advanced Canvas with Rulers */}
      <Box sx={{ position: 'relative'}}>
        {/* Rulers */}
        <Rulers
          showRulers={showRulers}
          gridSize={gridSize}
          canvasZoom={canvasZoom}
          canvasPan={canvasPan}
          pageWidth={project.pageSettings.width}
          pageHeight={project.pageSettings.height}
        />
        
        {/* Main Canvas Area */}
        <Box
          ref={canvasRef}
          sx={canvasStyle}
          onClick={handleCanvasClick}
          onDrop={handleCanvasDrop}
          onDragOver={handleCanvasDragOver}
        >
          {/* Render Elements */}
          {elements.map(element => (
            <ElementRenderer
              key={element.id}
              element={element}
              isSelected={selectedElements.includes(element.id)}
              onElementClick={handleElementClick}
              onElementDoubleClick={handleElementDoubleClick}
            />
          ))}
          
          {/* Drop Zone Indicator */}
          <DropZoneIndicator
            isDragging={isDragging}
            draggedComponent={draggedComponent}
          />
        </Box>
      </Box>
    </Box>
  );
};

// Set display names for debugging
ElementRenderer.displayName = 'ElementRenderer';
CanvasToolbar.displayName = 'CanvasToolbar';
Rulers.displayName = 'Rulers';
DropZoneIndicator.displayName ='DropZoneIndicator';

export default memo(VisualEditorCanvasOptimized);


