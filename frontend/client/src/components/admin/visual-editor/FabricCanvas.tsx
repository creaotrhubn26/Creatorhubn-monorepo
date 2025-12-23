/**
 * FabricCanvas Component
 * Integrates Fabric.js canvas with VisualEditorContext for visual element manipulation
 */

import React, { useEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';
import { Box, Paper } from '@mui/material';
import { useVisualEditor, EditorElement } from './VisualEditorContext';

// Extended types for canvas features
interface CollaborativeCursor {
  userId: string;
  userName: string;
  userColor: string;
  x: number;
  y: number;
  lastUpdate: Date;
}

interface ExtendedState {
  gridSystem?: { visible: boolean };
  collaborativeCursors?: Record<string, CollaborativeCursor>;
}

export const FabricCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const { state, updateElement, selectElement, dispatch } = useVisualEditor();
  
  // Extended state with optional properties
  const extendedState = state as typeof state & ExtendedState;
  
  // Helper functions that may not exist in context
  const addHistoryEntry = (type: string, description: string) => {
    dispatch({ type: 'ADD_HISTORY', payload: { type, description, timestamp: new Date() } } as any);
  };
  
  const updateCollaborativeCursor = (cursor: CollaborativeCursor) => {
    dispatch({ type: 'UPDATE_CURSOR', payload: cursor } as any);
  };

  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize Fabric.js canvas
  useEffect(() => {
    if (!canvasRef.current || fabricCanvasRef.current) return;

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: state.currentProject?.settings.width || 1200,
      height: state.currentProject?.settings.height || 800,
      backgroundColor: state.currentProject?.settings.backgroundColor || '#ffffff',
      selection: true,
      preserveObjectStacking: true,
    });

    // Enable grid if configured
    if (extendedState.gridSystem?.visible) {
      canvas.backgroundColor = '#f5f5f5';
    }

    fabricCanvasRef.current = canvas;
    setIsInitialized(true);

    // Cleanup
    return () => {
      canvas.dispose();
      fabricCanvasRef.current = null;
    };
  }, []);

  // Convert EditorElement to Fabric object
  const createFabricObject = (element: EditorElement): fabric.Object | null => {
    let obj: fabric.Object | null = null;

    switch (element.type) {
      case 'button': case 'card': case 'container': obj = new fabric.Rect({
          left: element.x,
          top: element.y,
          width: element.width,
          height: element.height,
          fill: element.styles.backgroundColor || '#2196f3',
          stroke: element.styles.border || '#1976d2',
          strokeWidth: 2,
          rx: parseInt(element.styles.borderRadius ||  '4'),
          ry: parseInt(element.styles.borderRadius || '4'),
          opacity: element.styles.opacity || 1,
          shadow: element.styles.boxShadow
            ? new fabric.Shadow({
                color: 'rgba(0,0,0,0.3)',
                blur: 10,
                offsetX: 0,
                offsetY: 4,
              })
            : undefined,
        });
        break;

      case 'text': obj = new fabric.IText(element.props.text || 'Text', {
          left: element.x,
          top: element.y,
          fontSize: parseInt(element.styles.fontSize || '16'),
          fontFamily: element.styles.fontFamily || 'Arial',
          fontWeight: element.styles.fontWeight || 'normal',
          fill: element.styles.color || '#000000',
          opacity: element.styles.opacity || 1,
        });
        break;

      case 'image': // For images, we'd need to load the image first
        // Placeholder for now
        obj = new fabric.Rect({
          left: element.x,
          top: element.y,
          width: element.width,
          height: element.height,
          fill: '#e0e0e0',
          stroke: '#9e9e9e',
          strokeWidth: 1,
        });
        break;

      default: obj = new fabric.Rect({
          left: element.x,
          top: element.y,
          width: element.width,
          height: element.height,
          fill: '#cccccc',
          stroke: '#999999',
          strokeWidth: 1,
        });
    }

    if (obj) {
      const elementWithPosition = element as EditorElement & { position?: { locked?: boolean } };
      obj.set({
        id: element.id,
        selectable: !elementWithPosition.position?.locked,
        hasControls: true,
        hasBorders: true,
        lockMovementX: elementWithPosition.position?.locked || false,
        lockMovementY: elementWithPosition.position?.locked || false,
        lockScalingX: elementWithPosition.position?.locked || false,
        lockScalingY: elementWithPosition.position?.locked || false,
        lockRotation: elementWithPosition.position?.locked || false,
      } as any);
    }

    return obj;
  };

  // Sync elements from state to Fabric canvas
  useEffect(() => {
    if (!fabricCanvasRef.current || !isInitialized) return;

    const canvas = fabricCanvasRef.current;

    // Clear existing objects
    canvas.clear();
    canvas.backgroundColor = state.currentProject?.settings.backgroundColor || '#ffffff';

    // Add all elements as Fabric objects
    state.elements.forEach((element) => {
      const obj = createFabricObject(element);
      if (obj) {
        canvas.add(obj);
      }
    });

    canvas.renderAll();
  }, [state.elements, isInitialized]);

  // Handle Fabric object modifications -> update state
  useEffect(() => {
    if (!fabricCanvasRef.current || !isInitialized) return;

    const canvas = fabricCanvasRef.current;

    // Object moved
    const handleObjectModified = (e: any) => {
      const obj = e.target;
      if (!obj || !(obj as any).id) return;

      const elementId = (obj as any).id;

      updateElement(elementId, {
        x: obj.left || 0,
        y: obj.top || 0,
        width: (obj.width || 0) * (obj.scaleX || 1),
        height: (obj.height || 0) * (obj.scaleY || 1),
      });

      addHistoryEntry('MODIFY', `Modified element ${elementId}`);
    };

    // Object selected
    const handleSelection = (e: any) => {
      const obj = e.selected?.[0];
      if (obj && (obj as any).id) {
        selectElement((obj as any).id);
      }
    };

    // Selection cleared
    const handleSelectionCleared = () => {
      selectElement(null);
    };

    // Mouse move for collaborative cursors
    const handleMouseMove = (e: any) => {
      if (e.pointer) {
        updateCollaborativeCursor({
          userId: 'current-user',
          userName: 'Current User',
          userColor: '#2196f3',
          x: e.pointer.x,
          y: e.pointer.y,
          lastUpdate: new Date(),
        });
      }
    };

    canvas.on('object:modified', handleObjectModified);
    canvas.on('selection:created', handleSelection);
    canvas.on('selection:updated', handleSelection);
    canvas.on('selection:cleared', handleSelectionCleared);
    canvas.on('mouse:move', handleMouseMove);

    return () => {
      canvas.off('object:modified', handleObjectModified);
      canvas.off('selection:created', handleSelection);
      canvas.off('selection:updated', handleSelection);
      canvas.off('selection:cleared', handleSelectionCleared);
      canvas.off('mouse:move', handleMouseMove);
    };
  }, [
    isInitialized,
    state.elements,
    updateElement,
    selectElement,
    addHistoryEntry,
    updateCollaborativeCursor,
  ]);

  // Draw grid overlay
  useEffect(() => {
    if (!fabricCanvasRef.current || !isInitialized) return;
    if (!extendedState.gridSystem?.visible) return;

    const canvas = fabricCanvasRef.current;
    const gridSize = 20; // Grid spacing in pixels
    const width = canvas.width || 1200;
    const height = canvas.height || 800;

    // Create grid lines
    const gridLines: fabric.Line[] = [];

    // Vertical lines
    for (let i = 0; i < width / gridSize; i++) {
      const line = new fabric.Line([i * gridSize, 0, i * gridSize, height], {
        stroke: '#e0e0e0',
        strokeWidth: 1,
        selectable: false,
        evented: false,
      });
      gridLines.push(line);
    }

    // Horizontal lines
    for (let i = 0; i < height / gridSize; i++) {
      const line = new fabric.Line([0, i * gridSize, width, i * gridSize], {
        stroke: '#e0e0e0',
        strokeWidth: 1,
        selectable: false,
        evented: false,
      });
      gridLines.push(line);
    }

    // Add grid as background
    const grid = new fabric.Group(gridLines, {
      selectable: false,
      evented: false,
    });

    canvas.add(grid);
    (canvas as any).sendToBack?.(grid);
    canvas.renderAll();

    return () => {
      gridLines.forEach((line) => canvas.remove(line));
      canvas.remove(grid);
    };
  }, [extendedState.gridSystem?.visible, isInitialized]);

  // Render collaborative cursors
  useEffect(() => {
    if (!fabricCanvasRef.current || !isInitialized) return;

    const canvas = fabricCanvasRef.current;
    const cursorsMap = extendedState.collaborativeCursors || {};
    const cursors = Object.values(cursorsMap).filter(
      (c: CollaborativeCursor) => c.userId !== 'current-user',
    );

    // Remove old cursor objects
    const oldCursors = canvas.getObjects().filter((obj: any) => obj.isCursor);
    oldCursors.forEach((obj: any) => canvas.remove(obj));

    // Add new cursor objects
    cursors.forEach((cursor: CollaborativeCursor) => {
      const cursorCircle = new fabric.Circle({
        left: cursor.x,
        top: cursor.y,
        radius: 8,
        fill: cursor.userColor,
        stroke: '#ffffff',
        strokeWidth: 2,
        selectable: false,
        evented: false,
        originX: 'center',
        originY: 'center',
      } as any);

      (cursorCircle as any).isCursor = true;

      const cursorLabel = new fabric.FabricText(cursor.userName, {
        left: cursor.x + 12,
        top: cursor.y - 20,
        fontSize: 12,
        fill: '#ffffff',
        backgroundColor: cursor.userColor,
        selectable: false,
        evented: false,
      } as any);

      (cursorLabel as any).isCursor = true;

      canvas.add(cursorCircle, cursorLabel);
    });

    canvas.renderAll();
  }, [extendedState.collaborativeCursors, isInitialized]);

  // Handle zoom
  useEffect(() => {
    if (!fabricCanvasRef.current || !isInitialized) return;

    const canvas = fabricCanvasRef.current;
    canvas.setZoom(state.zoom);
    canvas.renderAll();
  }, [state.zoom, isInitialized]);

  return (
    <Box sx={{ position: 'relative', overflow: 'auto', flex: 1 }}>
      <Paper
        elevation={3}
        sx={{
          display: 'inline-block',
          m: 2,
          position: 'relative'}}>
        <canvas ref={canvasRef} />
      </Paper>
    </Box>
  );
};
