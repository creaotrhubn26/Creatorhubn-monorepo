/**
 * Shot Planner Canvas - Pixi.js WebGL Canvas Component
 * 
 * Main 2D canvas for the shot planner using Pixi.js for WebGL rendering.
 * Handles:
 * - Floor plan/set visualization
 * - Camera frustum cones
 * - Actor/character placement
 * - Props and furniture
 * - Grid and measurement
 * - Pan, zoom, and selection
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import * as PIXI from 'pixi.js';
import { Box } from '@mui/material';
import {
  Camera2D,
  Actor2D,
  Prop2D,
  Point2D,
  Scene2D,
  PlannerTool,
  LENS_FOV_MAP,
} from './types';
import { useShotPlannerStore, useActiveShot } from './store';
import * as VectorGfx from './vectorGraphics';
import * as visualizations from './visualizations';

// =============================================================================
// Constants
// =============================================================================

const GRID_COLOR = 0x3A4A5A;
const GRID_OPACITY = 0.3;
const SELECTION_COLOR = 0xFF69B4;
const MEASUREMENT_LINE_COLOR = 0xFFD700;

// Z-Index layers
const Z_INDEX = {
  FLOOR: 0,
  GRID: 1,
  PROPS: 10,
  ACTORS: 50,
  CAMERA_FRUSTUM: 80,
  CAMERAS: 100,
  LINE_OF_ACTION: 150,
  SELECTION: 200,
  MEASUREMENT: 250,
  UI: 300,
};

// =============================================================================
// Helper Functions
// =============================================================================

const degToRad = (deg: number) => (deg * Math.PI) / 180;
const radToDeg = (rad: number) => (rad * 180) / Math.PI;

const hexToPixiColor = (hex: string): number => {
  return parseInt(hex.replace('#', ''), 16);
};

// =============================================================================
// Canvas Graphics Creators
// =============================================================================

/**
 * Creates a camera frustum (view cone) graphic
 */
const createCameraFrustum = (
  camera: Camera2D,
  pixelsPerMeter: number
): PIXI.Container => {
  const { frustum, color, rotation } = camera;
  const nearDist = frustum.nearDistance * pixelsPerMeter;
  const farDist = frustum.farDistance * pixelsPerMeter;
  const colorNum = hexToPixiColor(color);
  
  // Use enhanced vector FOV cone with range label
  return VectorGfx.createFOVCone(
    colorNum,
    frustum.fov,
    nearDist,
    farDist,
    rotation,
    true // show distance label
  );
};

/**
 * Creates a camera icon graphic
 */
const createCameraGraphic = (camera: Camera2D, isSelected: boolean): PIXI.Container => {
  const colorNum = hexToPixiColor(camera.color);
  
  // Use enhanced vector camera icon
  const cameraIcon = VectorGfx.createCameraIcon(colorNum, camera.name, 30);
  
  // Selection highlight
  if (isSelected) {
    const selection = new PIXI.Graphics();
    selection.stroke({ width: 3, color: SELECTION_COLOR });
    selection.roundRect(-25, -20, 50, 40, 6);
    selection.stroke();
    cameraIcon.addChildAt(selection, 0);
  }
  
  return cameraIcon;
};

/**
 * Creates an actor/character graphic (top-down view)
 */
const createActorGraphic = (actor: Actor2D, isSelected: boolean): PIXI.Container => {
  const container = new PIXI.Container();
  
  const colorNum = hexToPixiColor(actor.color);
  const facingAngle = getFacingAngle(actor.facing);
  const facingRad = degToRad(facingAngle);
  
  // Use enhanced vector character
  const character = VectorGfx.createCharacter(colorNum, actor.scale, facingRad);
  container.addChild(character);
  
  const size = 40 * actor.scale;
  
  // Selection highlight
  if (isSelected) {
    const selection = new PIXI.Graphics();
    selection.stroke({ width: 3, color: SELECTION_COLOR });
    selection.circle(0, 0, size * 0.6);
    selection.stroke();
    container.addChild(selection);
  }
  
  // Actor name
  const style = new PIXI.TextStyle({
    fontSize: 11,
    fill: '#FFFFFF',
    fontFamily: 'Inter, Arial, sans-serif',
  });
  const label = new PIXI.Text({ text: actor.characterName || actor.name, style });
  label.position.set(-label.width / 2, size * 0.6 + 5);
  
  // Label background
  const labelBg = new PIXI.Graphics();
  labelBg.fill({ color: 0x1A1A2E, alpha: 0.8 });
  labelBg.roundRect(label.x - 3, label.y - 1, label.width + 6, label.height + 2, 3);
  labelBg.fill();
  container.addChild(labelBg);
  container.addChild(label);
  
  return container;
};

/**
 * Get rotation angle based on actor facing direction
 */
const getFacingAngle = (facing: Actor2D['facing']): number => {
  const angles: Record<Actor2D['facing'], number> = {
    'Front': 270,     // Down
    'Back': 90,       // Up
    'Left': 180,      // Left
    'Right': 0,       // Right
    '3/4 Front Left': 225,
    '3/4 Front Right': 315,
    '3/4 Back Left': 135,
    '3/4 Back Right': 45,
  };
  return angles[facing] || 0;
};

/**
 * Creates a prop graphic
 */
const createPropGraphic = (prop: Prop2D, isSelected: boolean): PIXI.Container => {
  const container = new PIXI.Container();
  
  const graphics = new PIXI.Graphics();
  const colorNum = hexToPixiColor(prop.color);
  const { width, height } = prop.size;
  
  if (prop.shapeType === 'circle') {
    const radius = Math.max(width, height) / 2;
    graphics.fill({ color: colorNum });
    graphics.circle(0, 0, radius);
    graphics.fill();
    graphics.stroke({ width: 1, color: 0x000000, alpha: 0.3 });
    graphics.circle(0, 0, radius);
    graphics.stroke();
  } else {
    // Rectangle (default)
    graphics.fill({ color: colorNum });
    graphics.roundRect(-width / 2, -height / 2, width, height, 3);
    graphics.fill();
    graphics.stroke({ width: 1, color: 0x000000, alpha: 0.3 });
    graphics.roundRect(-width / 2, -height / 2, width, height, 3);
    graphics.stroke();
  }
  
  // Selection highlight
  if (isSelected) {
    graphics.stroke({ width: 2, color: SELECTION_COLOR });
    if (prop.shapeType === 'circle') {
      graphics.circle(0, 0, Math.max(width, height) / 2 + 4);
    } else {
      graphics.roundRect(-width / 2 - 4, -height / 2 - 4, width + 8, height + 8, 5);
    }
    graphics.stroke();
  }
  
  container.addChild(graphics);
  
  return container;
};

/**
 * Creates a grid overlay
 */
const createGrid = (
  width: number,
  height: number,
  gridSize: number,
  offset: Point2D,
  zoom: number
): PIXI.Graphics => {
  const graphics = new PIXI.Graphics();
  const scaledGridSize = gridSize * zoom;
  
  if (scaledGridSize < 10) return graphics; // Don't render if too small
  
  // Calculate grid lines based on viewport
  const startX = Math.floor(-offset.x / scaledGridSize) * scaledGridSize;
  const startY = Math.floor(-offset.y / scaledGridSize) * scaledGridSize;
  const endX = startX + width + scaledGridSize * 2;
  const endY = startY + height + scaledGridSize * 2;
  
  graphics.stroke({ width: 1, color: GRID_COLOR, alpha: GRID_OPACITY });
  
  // Vertical lines
  for (let x = startX; x <= endX; x += scaledGridSize) {
    graphics.moveTo(x + offset.x, 0);
    graphics.lineTo(x + offset.x, height);
  }
  
  // Horizontal lines
  for (let y = startY; y <= endY; y += scaledGridSize) {
    graphics.moveTo(0, y + offset.y);
    graphics.lineTo(width, y + offset.y);
  }
  
  graphics.stroke();
  
  return graphics;
};

/**
 * Creates the 180° line of action indicator
 */
const createLineOfAction = (
  start: Point2D,
  end: Point2D,
  safe: boolean
): PIXI.Graphics => {
  const graphics = new PIXI.Graphics();
  
  const color = safe ? 0x4CAF50 : 0xF44336;
  
  // Dashed line
  graphics.stroke({ width: 3, color, alpha: 0.7 });
  
  const dashLength = 15;
  const gapLength = 10;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);
  
  let currentDist = 0;
  let drawing = true;
  
  while (currentDist < distance) {
    const segmentLength = drawing ? dashLength : gapLength;
    const nextDist = Math.min(currentDist + segmentLength, distance);
    
    if (drawing) {
      graphics.moveTo(
        start.x + Math.cos(angle) * currentDist,
        start.y + Math.sin(angle) * currentDist
      );
      graphics.lineTo(
        start.x + Math.cos(angle) * nextDist,
        start.y + Math.sin(angle) * nextDist
      );
    }
    
    currentDist = nextDist;
    drawing = !drawing;
  }
  
  graphics.stroke();
  
  return graphics;
};

// =============================================================================
// Main Canvas Component
// =============================================================================

interface ShotPlannerCanvasProps {
  width: number;
  height: number;
  onCanvasReady?: (app: PIXI.Application) => void;
}

export const ShotPlannerCanvas: React.FC<ShotPlannerCanvasProps> = ({
  width,
  height,
  onCanvasReady,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const mainContainerRef = useRef<PIXI.Container | null>(null);
  
  // Store
  const {
    scene,
    activeTool,
    selection,
    addCamera,
    addActor,
    addProp,
    updateCamera,
    updateActor,
    updateProp,
    setSelection,
    clearSelection,
    setViewport,
    saveToHistory,
    addMeasurementLine,
  } = useShotPlannerStore();
  const storeGet = useShotPlannerStore();  // Get entire store for measurement logic
  
  // Local state for interaction
  const [isDragging, setIsDragging] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [dragTarget, setDragTarget] = useState<{
    id: string;
    type: 'camera' | 'actor' | 'prop';
    startPos: Point2D;
  } | null>(null);
  const [panStart, setPanStart] = useState<Point2D | null>(null);
  const [measureStart, setMeasureStart] = useState<Point2D | null>(null);
  
  // Initialize Pixi Application
  useEffect(() => {
    if (!containerRef.current) return;
    
    const initPixi = async () => {
      const app = new PIXI.Application();
      
      await app.init({
        width,
        height,
        backgroundColor: 0x2A3A4A,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });
      
      containerRef.current?.appendChild(app.canvas);
      appRef.current = app;
      
      // Create main container for pan/zoom
      const mainContainer = new PIXI.Container();
      mainContainer.sortableChildren = true;
      app.stage.addChild(mainContainer);
      mainContainerRef.current = mainContainer;
      
      onCanvasReady?.(app);
    };
    
    initPixi();
    
    return () => {
      if (appRef.current) {
        appRef.current.destroy(true, { children: true, texture: true });
        appRef.current = null;
      }
    };
  }, []);
  
  // Handle resize
  useEffect(() => {
    if (appRef.current) {
      appRef.current.renderer.resize(width, height);
    }
  }, [width, height]);
  
  // Render scene
  useEffect(() => {
    if (!appRef.current || !mainContainerRef.current || !scene) return;
    
    const mainContainer = mainContainerRef.current;
    mainContainer.removeChildren();
    
    const { viewport, gridSize, showGrid, cameras, actors, props, pixelsPerMeter } = scene;
    
    // Apply viewport transform
    mainContainer.position.set(viewport.offset.x, viewport.offset.y);
    mainContainer.scale.set(viewport.zoom);
    
    // Grid
    if (showGrid) {
      const grid = createGrid(width, height, gridSize, viewport.offset, viewport.zoom);
      grid.zIndex = Z_INDEX.GRID;
      mainContainer.addChild(grid);
    }
    
    // Floorplan (vector-based room layout)
    if (scene.floorPlan && !scene.floorPlan.imageUrl) {
      const floorplan = VectorGfx.createFloorplan({
        width: scene.floorPlan.bounds.width,
        height: scene.floorPlan.bounds.height,
      });
      floorplan.position.set(scene.floorPlan.bounds.x, scene.floorPlan.bounds.y);
      floorplan.zIndex = Z_INDEX.FLOOR;
      mainContainer.addChild(floorplan);
    }
    
    // 180° line (horizontal through middle of scene)
    if (scene.show180Line) {
      const centerY = scene.floorPlan.bounds.height / 2;
      const line180 = VectorGfx.create180Line(
        { x: 0, y: centerY },
        { x: scene.floorPlan.bounds.width, y: centerY }
      );
      line180.zIndex = Z_INDEX.LINE_OF_ACTION;
      mainContainer.addChild(line180);
    }
    
    // Props
    props.forEach(prop => {
      if (!prop.visible) return;
      
      const isSelected = selection.selectedIds.includes(prop.id);
      const propGraphic = createPropGraphic(prop, isSelected);
      propGraphic.position.set(prop.position.x, prop.position.y);
      propGraphic.rotation = degToRad(prop.rotation);
      propGraphic.zIndex = Z_INDEX.PROPS + (prop.zIndex || 0);
      propGraphic.eventMode = 'static';
      propGraphic.cursor = 'pointer';
      
      // Make draggable
      propGraphic.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
        if (activeTool === 'select' && !prop.locked) {
          e.stopPropagation();
          setSelection([prop.id], 'prop');
          setIsDragging(true);
          setDragTarget({
            id: prop.id,
            type: 'prop',
            startPos: { x: prop.position.x, y: prop.position.y },
          });
        }
      });
      
      mainContainer.addChild(propGraphic);
    });
    
    // Actors
    actors.forEach(actor => {
      if (!actor.visible) return;
      
      const isSelected = selection.selectedIds.includes(actor.id);
      const actorGraphic = createActorGraphic(actor, isSelected);
      actorGraphic.position.set(actor.position.x, actor.position.y);
      actorGraphic.zIndex = Z_INDEX.ACTORS + (actor.zIndex || 0);
      actorGraphic.eventMode = 'static';
      actorGraphic.cursor = 'pointer';
      
      actorGraphic.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
        if (activeTool === 'select' && !actor.locked) {
          e.stopPropagation();
          setSelection([actor.id], 'actor');
          setIsDragging(true);
          setDragTarget({
            id: actor.id,
            type: 'actor',
            startPos: { x: actor.position.x, y: actor.position.y },
          });
        }
      });
      
      mainContainer.addChild(actorGraphic);
    });
    
    // Camera frustums
    cameras.forEach(camera => {
      if (!camera.visible || !camera.showFrustum) return;
      
      const frustum = createCameraFrustum(camera, pixelsPerMeter);
      frustum.position.set(camera.position.x, camera.position.y);
      frustum.zIndex = Z_INDEX.CAMERA_FRUSTUM;
      mainContainer.addChild(frustum);
    });
    
    // Cameras
    cameras.forEach(camera => {
      if (!camera.visible) return;
      
      const isSelected = selection.selectedIds.includes(camera.id);
      const cameraGraphic = createCameraGraphic(camera, isSelected);
      cameraGraphic.position.set(camera.position.x, camera.position.y);
      cameraGraphic.rotation = degToRad(camera.rotation);
      cameraGraphic.zIndex = Z_INDEX.CAMERAS + (camera.zIndex || 0);
      cameraGraphic.eventMode = 'static';
      cameraGraphic.cursor = 'pointer';
      
      cameraGraphic.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
        if (activeTool === 'select' && !camera.locked) {
          e.stopPropagation();
          setSelection([camera.id], 'camera');
          setIsDragging(true);
          setDragTarget({
            id: camera.id,
            type: 'camera',
            startPos: { x: camera.position.x, y: camera.position.y },
          });
        }
      });
      
      mainContainer.addChild(cameraGraphic);
    });
    
    // 180° line of action (if active shot has subjects)
    const activeShot = scene.shots.find(s => s.id === scene.activeShotId);
    if (activeShot?.lineOfAction && scene.show180Line) {
      const lineGraphic = createLineOfAction(
        activeShot.lineOfAction.start,
        activeShot.lineOfAction.end,
        activeShot.lineOfAction.safe
      );
      lineGraphic.zIndex = Z_INDEX.LINE_OF_ACTION;
      mainContainer.addChild(lineGraphic);
    }
    
    // Advanced visualizations - Camera frustums
    if (scene.showFrustums) {
      const frustumContainer = new PIXI.Container();
      frustumContainer.zIndex = Z_INDEX.CAMERA_FRUSTUM;
      cameras.forEach(camera => {
        if (camera.visible) {
          visualizations.drawCameraFrustum(frustumContainer, camera, pixelsPerMeter);
        }
      });
      mainContainer.addChild(frustumContainer);
    }
    
    // Motion paths visualization
    if (scene.showMotionPaths) {
      const motionContainer = new PIXI.Container();
      motionContainer.zIndex = Z_INDEX.CAMERA_FRUSTUM + 1;
      cameras.forEach(camera => {
        if (camera.visible && camera.motionPath && camera.motionPath.length > 0) {
          visualizations.drawMotionPath(motionContainer, camera.motionPath);
        }
      });
      mainContainer.addChild(motionContainer);
    }
    
    // 180-degree line visualization
    if (scene.show180Line && activeShot && scene.cameras.length > 0) {
      const activeCamera = scene.cameras.find(c => c.id === activeShot.cameraId);
      if (activeCamera) {
        const lineContainer = new PIXI.Container();
        lineContainer.zIndex = Z_INDEX.LINE_OF_ACTION + 1;
        visualizations.draw180DegreeLine(
          lineContainer,
          activeCamera,
          scene.floorPlan.bounds.width,
          scene.floorPlan.bounds.height,
          pixelsPerMeter
        );
        mainContainer.addChild(lineContainer);
      }
    }
    
    // Depth of field visualization
    if (activeShot && scene.cameras.length > 0) {
      const activeCamera = scene.cameras.find(c => c.id === activeShot.cameraId);
      if (activeCamera && activeCamera.focusDistance && activeCamera.depthOfField) {
        const dofContainer = new PIXI.Container();
        dofContainer.zIndex = Z_INDEX.CAMERA_FRUSTUM - 1;
        visualizations.drawDepthOfField(
          dofContainer,
          activeCamera,
          activeCamera.focusDistance,
          activeCamera.depthOfField,
          pixelsPerMeter
        );
        mainContainer.addChild(dofContainer);
      }
    }
    
    // Measurement lines visualization
    if (scene.showMeasurements && activeShot && activeShot.measurementLines) {
      const measureContainer = new PIXI.Container();
      measureContainer.zIndex = Z_INDEX.MEASUREMENT;
      activeShot.measurementLines.forEach(line => {
        visualizations.drawMeasurementLine(
          measureContainer,
          line.start,
          line.end,
          line.label
        );
      });
      mainContainer.addChild(measureContainer);
    }
    
    mainContainer.sortChildren();
    
  }, [scene, selection, activeTool, width, height]);
  
  // Handle canvas interactions
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!scene) return;
    
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = (e.clientX - rect.left - scene.viewport.offset.x) / scene.viewport.zoom;
    const y = (e.clientY - rect.top - scene.viewport.offset.y) / scene.viewport.zoom;
    
    if (activeTool === 'pan' || e.button === 1) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
    } else if (activeTool === 'camera') {
      addCamera({ x, y });
    } else if (activeTool === 'actor') {
      addActor({ x, y });
    } else if (activeTool === 'prop') {
      addProp({ x, y });
    } else if (activeTool === 'measure') {
      // Measurement tool - two-click to create line
      const state = storeGet;
      const activeShot = state.scene?.shots.find(s => s.id === state.scene?.activeShotId);
      if (measureStart === null) {
        setMeasureStart({ x, y });
      } else if (activeShot) {
        // Second click - create measurement
        addMeasurementLine(activeShot.id, measureStart, { x, y }, '');
        saveToHistory('Add measurement');
        setMeasureStart(null);
      }
    } else if (activeTool === 'select' && !isDragging) {
      // Click on empty space - clear selection
      clearSelection();
    }
  }, [scene, activeTool, addCamera, addActor, addProp, clearSelection, isDragging, measureStart, addMeasurementLine, saveToHistory, storeGet]);
  
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!scene) return;
    
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    if (isPanning && panStart) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      setViewport({
        offset: {
          x: scene.viewport.offset.x + dx,
          y: scene.viewport.offset.y + dy,
        },
      });
      setPanStart({ x: e.clientX, y: e.clientY });
    } else if (isDragging && dragTarget) {
      const x = (e.clientX - rect.left - scene.viewport.offset.x) / scene.viewport.zoom;
      const y = (e.clientY - rect.top - scene.viewport.offset.y) / scene.viewport.zoom;
      
      // Snap to grid if enabled
      const snappedX = scene.snapToGrid ? Math.round(x / scene.gridSize) * scene.gridSize : x;
      const snappedY = scene.snapToGrid ? Math.round(y / scene.gridSize) * scene.gridSize : y;
      
      if (dragTarget.type === 'camera') {
        updateCamera(dragTarget.id, { position: { x: snappedX, y: snappedY } });
      } else if (dragTarget.type === 'actor') {
        updateActor(dragTarget.id, { position: { x: snappedX, y: snappedY } });
      } else if (dragTarget.type === 'prop') {
        updateProp(dragTarget.id, { position: { x: snappedX, y: snappedY } });
      }
    }
  }, [scene, isPanning, panStart, isDragging, dragTarget, setViewport, updateCamera, updateActor, updateProp]);
  
  const handlePointerUp = useCallback(() => {
    if (isDragging && dragTarget) {
      saveToHistory(`Move ${dragTarget.type}`);
    }
    setIsPanning(false);
    setPanStart(null);
    setIsDragging(false);
    setDragTarget(null);
  }, [isDragging, dragTarget, saveToHistory]);
  
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!scene) return;
    e.preventDefault();
    
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(
      scene.viewport.minZoom,
      Math.min(scene.viewport.maxZoom, scene.viewport.zoom * delta)
    );
    
    // Zoom towards mouse position
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const worldX = (mouseX - scene.viewport.offset.x) / scene.viewport.zoom;
      const worldY = (mouseY - scene.viewport.offset.y) / scene.viewport.zoom;
      
      const newOffsetX = mouseX - worldX * newZoom;
      const newOffsetY = mouseY - worldY * newZoom;
      
      setViewport({
        zoom: newZoom,
        offset: { x: newOffsetX, y: newOffsetY },
      });
    }
  }, [scene, setViewport]);
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        useShotPlannerStore.getState().deleteSelected();
      } else if (e.key === 'Escape') {
        clearSelection();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        if (e.shiftKey) {
          useShotPlannerStore.getState().redo();
        } else {
          useShotPlannerStore.getState().undo();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
        useShotPlannerStore.getState().copy();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
        // Paste at center of viewport
        if (scene) {
          const centerX = (width / 2 - scene.viewport.offset.x) / scene.viewport.zoom;
          const centerY = (height / 2 - scene.viewport.offset.y) / scene.viewport.zoom;
          useShotPlannerStore.getState().paste({ x: centerX, y: centerY });
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault();
        useShotPlannerStore.getState().duplicate();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault();
        useShotPlannerStore.getState().selectAll();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [scene, width, height, clearSelection]);
  
  return (
    <Box
      ref={containerRef}
      sx={{
        width,
        height,
        overflow: 'hidden',
        cursor: activeTool === 'pan' ? 'grab' : isPanning ? 'grabbing' : 'default',
        touchAction: 'none',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onWheel={handleWheel}
    />
  );
};

export default ShotPlannerCanvas;
