/**
 * Visual Editor Canvas Component
 * Main canvas area for visual editing
 */

import { useTheming } from '../../../utils/theming-helper';
import React, { useRef, useCallback } from 'react';
import { Box, Paper } from '@mui/material';

interface EditorElement {
  id: string;
  type: 'button' | 'text' | 'image' | 'card' | 'container' | 'grid' | 'audio' | 'video';
  x: number;
  y: number;
  width: number;
  height: number;
  styles: Record<string, any>;
  props: Record<string, any>;
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
  onDrop
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);

  // Theming system
  const theming = useTheming('prototype_tester');

  const handleElementClick = useCallback((elementId: string) => {
    onElementSelect(elementId);
  }, [onElementSelect]);

  const handleCanvasClick = useCallback((event: React.MouseEvent) => {
    if (event.target === canvasRef.current) {
      onElementSelect(', ');
}
}, [onElementSelect]);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    if (draggedComponent && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = (event.clientX - rect.left - canvasPan.x) / canvasZoom;
      const y = (event.clientY - rect.top - canvasPan.y) / canvasZoom;
      onDrop({ x, y });
    }
  }, [draggedComponent, canvasPan, canvasZoom, onDrop]);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
  }, []);

  return (
    <Box
      sx={{
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: '#f5f5f5'
      }}
    >
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
          transform: `scale(${canvasZoom}) translate(${canvasPan.x}px, ${canvasPan.y}px)`,
          transformOrigin: '0 0',
          cursor: isDragging ? 'grabbing' : 'default'
    }}
      >
        {/* Grid Background */}
        {showGrid && (
          <Box
            sx={{
              position: 'absolute',
              top:  0,
              left:  0,
              width: '100%',
              height: '100%',
              backgroundImage: `
                linear-gradient(to right, #e0e0e0 1px, transparent 1px),
                linear-gradient(to bottom, #e0e0e0 1px, transparent 1px)
              `,
              backgroundSize: `${gridSize}px ${gridSize}px`,
              pointerEvents: 'none',
              zIndex: 0}}
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
            ...theming.getThemedCardSx()
          }}
        >
          {/* Render Elements */}
          {Object.values(project.elements).map((element) => (
            <Box
              key={element.id}
              onClick={() => handleElementClick(element.id)}
              sx={{
                position: 'absolute',
                left: element.x,
                top: element.y,
                width: element.width,
                height: element.height,
                border: selectedElements.includes(element.id) ? '2px solid #1976d2' : '1px solid transparent',
                cursor: 'pointer',
                ...element.styles,
                '&:hover': {
                  border: '1px solid #1976d2',
                  opacity: 0.8
                }
              }}
            >
              {element.type === 'text' && (
                <Box sx={{ p: 1 }}>
                  {element.props.text || 'Text Element'}
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
                    cursor: 'pointer'
                  }}
                >
                  {element.props.text || 'Button'}
                </Box>
              )}
              {element.type === 'image' && (
                <Box
                  sx={{
                    width: '100%',
                    height: '100%',
                    backgroundColor: '#f0f0f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px dashed #ccc'
                  }}
                >
                  Image
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
                    boxShadow: 1
                  }}
                >
                  <Box sx={{ fontWeight: 'bold', mb: 1 }}>
                    {element.props.title || 'Card Title'}
                  </Box>
                  <Box sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
                    {element.props.content ||'Card content goes here...'}
                  </Box>
                </Box>
              )}
            </Box>
          ))}
        </Paper>
      </Box>
    </Box>
  );
};

export default VisualEditorCanvas;