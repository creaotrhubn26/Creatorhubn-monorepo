/**
 * Demo Scene Setup - "The Safehouse"
 * 
 * Creates a complete demo scene matching the screenshot with:
 * - Floorplan (walls, doors, floor tiles)
 * - Furniture (sofa, coffee table, kitchen counter, stools)
 * - 3 Characters positioned around the room
 * - 3 Cameras (A, B, C) with FOV cones
 * - 180° line of action
 * - Props and details
 */

import { Scene2D, Camera2D, Actor2D, Prop2D } from './types';

export const createSafehouseScene = (): Scene2D => {
  const sceneWidth = 900;
  const sceneHeight = 700;
  const pixelsPerMeter = 10; // 10 pixels = 1 meter
  
  return {
    id: 'scene-safehouse',
    name: 'Scene 12: The Safehouse',
    description: 'INT. SAFEHOUSE - NIGHT',
    location: 'Interior Safehouse',
    
    floorPlan: {
      id: 'floorplan-safehouse',
      name: 'Safehouse Layout',
      imageUrl: '', // Using vector graphics instead
      rooms: [],
      gridSize: 60,
      showGrid: false,
      gridOpacity: 0.2,
      scale: pixelsPerMeter,
      bounds: { x: 0, y: 0, width: sceneWidth, height: sceneHeight },
    },
    
    // Cameras
    cameras: [
      {
        id: 'cam-a',
        name: 'Cam A',
        label: 'Cam A',
        position: { x: 200, y: 300 },
        rotation: 45, // pointing toward coffee table
        color: '#FFD700',
        shotType: 'WS',
        lens: '24mm',
        height: 'Eye Level',
        angle: 'Straight On',
        movement: 'Static',
        frustum: {
          nearDistance: 5,
          farDistance: 10,
          fov: 84, // 24mm FOV
        },
        showFrustum: true,
        frustumOpacity: 0.25,
        isSelected: false,
        isActive: true,
        locked: false,
        visible: true,
        zIndex: 0,
      },
      {
        id: 'cam-b',
        name: 'Cam B',
        label: 'Cam B',
        position: { x: 750, y: 280 },
        rotation: 180, // pointing left
        color: '#4FC3F7',
        shotType: 'MS',
        lens: '35mm',
        height: 'Eye Level',
        angle: 'Straight On',
        movement: 'Static',
        frustum: {
          nearDistance: 4,
          farDistance: 8,
          fov: 63, // 35mm FOV
        },
        showFrustum: true,
        frustumOpacity: 0.25,
        isSelected: false,
        isActive: false,
        locked: false,
        visible: true,
        zIndex: 0,
      },
      {
        id: 'cam-c',
        name: 'Cam C',
        label: 'Cam C',
        position: { x: 550, y: 520 },
        rotation: -45, // pointing up-right
        color: '#81C784',
        shotType: 'CU',
        lens: '50mm',
        height: 'Eye Level',
        angle: 'Straight On',
        movement: 'Static',
        frustum: {
          nearDistance: 3,
          farDistance: 6,
          fov: 46, // 50mm FOV
        },
        showFrustum: true,
        frustumOpacity: 0.25,
        isSelected: false,
        isActive: false,
        locked: false,
        visible: true,
        zIndex: 0,
      },
    ],
    
    // Actors (Characters)
    actors: [
      {
        id: 'actor-1',
        name: 'Character 1',
        characterName: 'Alex',
        position: { x: 450, y: 330 },
        rotation: 0,
        scale: 1,
        color: '#2D3748',
        pose: 'Standing',
        facing: '3/4 Back Right',
        showMovementPath: false,
        isSelected: false,
        locked: false,
        visible: true,
        zIndex: 0,
      },
      {
        id: 'actor-2',
        name: 'Character 2',
        characterName: 'Blake',
        position: { x: 530, y: 350 },
        rotation: 0,
        scale: 1,
        color: '#374151',
        pose: 'Standing',
        facing: '3/4 Front Left',
        showMovementPath: false,
        isSelected: false,
        locked: false,
        visible: true,
        zIndex: 0,
      },
      {
        id: 'actor-3',
        name: 'Character 3',
        characterName: 'Charlie',
        position: { x: 620, y: 310 },
        rotation: 0,
        scale: 1,
        color: '#1F2937',
        pose: 'Standing',
        facing: 'Right',
        showMovementPath: false,
        isSelected: false,
        locked: false,
        visible: true,
        zIndex: 0,
      },
    ],
    
    // Props (Furniture and objects)
    props: [
      // Sofa
      {
        id: 'prop-sofa',
        name: 'Sofa',
        category: 'Furniture',
        position: { x: 450, y: 180 },
        rotation: 0,
        scale: 1,
        size: { width: 200, height: 80 },
        color: '#6B7280',
        shapeType: 'rectangle',
        isSelected: false,
        locked: false,
        visible: true,
        zIndex: 0,
      },
      // Coffee table
      {
        id: 'prop-coffee-table',
        name: 'Coffee Table',
        category: 'Furniture',
        position: { x: 450, y: 310 },
        rotation: 0,
        scale: 1,
        size: { width: 120, height: 60 },
        color: '#8B7355',
        shapeType: 'rectangle',
        isSelected: false,
        locked: false,
        visible: true,
        zIndex: 0,
      },
      // Kitchen counter
      {
        id: 'prop-kitchen',
        name: 'Kitchen Counter',
        category: 'Furniture',
        position: { x: 680, y: 150 },
        rotation: 0,
        scale: 1,
        size: { width: 220, height: 60 },
        color: '#C8C8C8',
        shapeType: 'rectangle',
        isSelected: false,
        locked: false,
        visible: true,
        zIndex: 0,
      },
      // Bar stool 1
      {
        id: 'prop-stool-1',
        name: 'Bar Stool 1',
        category: 'Furniture',
        position: { x: 600, y: 200 },
        rotation: 0,
        scale: 1,
        size: { width: 35, height: 35 },
        color: '#2A2A2A',
        shapeType: 'circle',
        isSelected: false,
        locked: false,
        visible: true,
        zIndex: 0,
      },
      // Bar stool 2
      {
        id: 'prop-stool-2',
        name: 'Bar Stool 2',
        category: 'Furniture',
        position: { x: 670, y: 200 },
        rotation: 0,
        scale: 1,
        size: { width: 35, height: 35 },
        color: '#2A2A2A',
        shapeType: 'circle',
        isSelected: false,
        locked: false,
        visible: true,
        zIndex: 0,
      },
      // Small table with items (left side)
      {
        id: 'prop-side-table',
        name: 'Side Table',
        category: 'Furniture',
        position: { x: 180, y: 520 },
        rotation: 0,
        scale: 1,
        size: { width: 70, height: 50 },
        color: '#8B7355',
        shapeType: 'rectangle',
        isSelected: false,
        locked: false,
        visible: true,
        zIndex: 0,
      },
      // Small props on tables
      {
        id: 'prop-glasses',
        name: 'Glasses',
        category: 'Hand Props',
        position: { x: 450, y: 295 },
        rotation: 0,
        scale: 1,
        size: { width: 20, height: 12 },
        color: '#E8F4F8',
        shapeType: 'circle',
        isSelected: false,
        locked: false,
        visible: true,
        zIndex: 1,
      },
      {
        id: 'prop-item-1',
        name: 'Item',
        category: 'Hand Props',
        position: { x: 180, y: 510 },
        rotation: 15,
        scale: 1,
        size: { width: 25, height: 18 },
        color: '#D4D4D4',
        shapeType: 'rectangle',
        isSelected: false,
        locked: false,
        visible: true,
        zIndex: 1,
      },
    ],
    
    shots: [],
    activeShotId: null,
    
    viewport: {
      offset: { x: 50, y: 50 },
      zoom: 1,
      minZoom: 0.1,
      maxZoom: 3,
    },
    
    showGrid: true,
    showRulers: false,
    showLineOfAction: true,
    show180Line: true,
    showFrustums: false,
    showMotionPaths: false,
    showMeasurements: false,
    snapToGrid: true,
    gridSize: 60,
    measurementUnit: 'meters',
    pixelsPerMeter: 10,
  };
};
