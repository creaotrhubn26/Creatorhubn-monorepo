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

// Extended Fabric.js object types with custom properties
interface FabricObjectWithId extends fabric.Object {
  id?: string;
}

interface FabricObjectWithCursor extends fabric.Object {
  isCursor?: boolean;
}

interface FabricCanvasWithMethods extends fabric.Canvas {
  sendToBack?: (obj: fabric.Object) => fabric.Canvas;
}

type FabricModifiedEvent = fabric.ModifiedEvent<fabric.TPointerEvent>;
type FabricSelectionEvent = Partial<fabric.TEvent<fabric.TPointerEvent>> & {
  selected?: fabric.FabricObject[];
};

export const FabricCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<FabricCanvasWithMethods | null>(null);
  const { state, updateElement, selectElement, dispatch } = useVisualEditor();
  
  // Extended state with optional properties
  const extendedState = state as typeof state & ExtendedState;
  
  // Helper functions that may not exist in context
  const addHistoryEntry = (type: string, description: string) => {
    // Dispatch history entry to track element modifications in the editor
    dispatch({
      type: 'ADD_HISTORY_ENTRY',
      payload: {
        action: type,
        description: description,
        timestamp: new Date().toISOString(),
      },
    });
  };
  
  const updateCollaborativeCursor = (cursor: CollaborativeCursor) => {
    // Dispatch collaborative cursor update to sync with other users
    dispatch({
      type: 'UPDATE_COLLABORATIVE_CURSORS',
      payload: {
        userId: cursor.userId,
        userName: cursor.userName,
        userColor: cursor.userColor,
        x: cursor.x,
        y: cursor.y,
        timestamp: cursor.lastUpdate.toISOString(),
      },
    });
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

      case 'text': {
        const textContent = typeof element.props.text === 'string' ? element.props.text : 'Text';
        obj = new fabric.IText(textContent, {
          left: element.x,
          top: element.y,
          fontSize: parseInt(element.styles.fontSize || '16'),
          fontFamily: element.styles.fontFamily || 'Arial',
          fontWeight: element.styles.fontWeight || 'normal',
          fill: element.styles.color || '#000000',
          opacity: element.styles.opacity || 1,
        });
        break;
      }

      case 'image': {
        // Load actual image if src is available, otherwise placeholder
        const imgSrc = element.props.src as string | undefined;
        if (imgSrc) {
          // Create a temporary placeholder while the image loads
          const placeholder = new fabric.Rect({
            left: element.x,
            top: element.y,
            width: element.width,
            height: element.height,
            fill: '#e0e0e0',
            stroke: '#9e9e9e',
            strokeWidth: 1,
          });
          const placeholderWithId = placeholder as FabricObjectWithId;
          placeholderWithId.set({ id: element.id });

          // Load real image asynchronously and replace the placeholder
          const imgElement = new Image();
          imgElement.crossOrigin = 'anonymous';
          imgElement.onload = () => {
            if (!fabricCanvasRef.current) return;
            const canvas = fabricCanvasRef.current;
            const fabricImg = new fabric.FabricImage(imgElement, {
              left: element.x,
              top: element.y,
              scaleX: element.width / (imgElement.naturalWidth || element.width),
              scaleY: element.height / (imgElement.naturalHeight || element.height),
              opacity: element.styles.opacity || 1,
            });
            const imgWithId = fabricImg as FabricObjectWithId;
            imgWithId.set({ id: element.id });
            canvas.remove(placeholder);
            canvas.add(fabricImg);
            canvas.renderAll();
          };
          imgElement.onerror = () => {
            // Keep placeholder on error — already on canvas
          };
          imgElement.src = imgSrc;
          obj = placeholder;
        } else {
          // No src: render a labeled placeholder
          obj = new fabric.Rect({
            left: element.x,
            top: element.y,
            width: element.width,
            height: element.height,
            fill: '#e0e0e0',
            stroke: '#9e9e9e',
            strokeWidth: 1,
          });
        }
        break;
      }

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
      const fabricObj = obj as FabricObjectWithId;
      fabricObj.set({
        id: element.id,
        selectable: !elementWithPosition.position?.locked,
        hasControls: true,
        hasBorders: true,
        lockMovementX: elementWithPosition.position?.locked || false,
        lockMovementY: elementWithPosition.position?.locked || false,
        lockScalingX: elementWithPosition.position?.locked || false,
        lockScalingY: elementWithPosition.position?.locked || false,
        lockRotation: elementWithPosition.position?.locked || false,
      });
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
    const handleObjectModified = (e: FabricModifiedEvent) => {
      const obj = e.target as FabricObjectWithId | undefined;
      if (!obj || !obj.id) return;

      const elementId = obj.id;

      updateElement(elementId, {
        x: obj.left || 0,
        y: obj.top || 0,
        width: (obj.width || 0) * (obj.scaleX || 1),
        height: (obj.height || 0) * (obj.scaleY || 1),
      });

      addHistoryEntry('MODIFY', `Modified element ${elementId}`);
    };

    // Object selected
    const handleSelection = (e: FabricSelectionEvent) => {
      const obj = (e.selected?.[0] as FabricObjectWithId) || undefined;
      if (obj && obj.id) {
        selectElement(obj.id);
      }
    };

    // Selection cleared
    const handleSelectionCleared = () => {
      selectElement(null);
    };

    // Mouse move for collaborative cursors
    const handleMouseMove = (e: fabric.TPointerEventInfo) => {
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
    // Use sendToBack if available (Canvas may not have this method in all versions)
    if (canvas.sendToBack) {
      canvas.sendToBack(grid);
    }
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
    const oldCursors = canvas.getObjects().filter((obj) => (obj as FabricObjectWithCursor).isCursor);
    oldCursors.forEach((obj) => canvas.remove(obj));

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
      });

      (cursorCircle as FabricObjectWithCursor).isCursor = true;

      const cursorLabel = new fabric.FabricText(cursor.userName, {
        left: cursor.x + 12,
        top: cursor.y - 20,
        fontSize: 12,
        fill: '#ffffff',
        backgroundColor: cursor.userColor,
        selectable: false,
        evented: false,
      });

      (cursorLabel as FabricObjectWithCursor).isCursor = true;

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
