/**
 * Vector Graphics Library for Shot Planner
 * 
 * All vector primitives for creating the floorplan, furniture, characters,
 * cameras, and UI elements - no sprites/bitmaps.
 */

import * as PIXI from 'pixi.js';
import { Actor2D, Camera2D, Prop2D, Point2D, Size2D } from './types';

// =============================================================================
// Constants
// =============================================================================

const FLOOR_COLOR = 0xB8BCC4;
const WALL_COLOR = 0x7A8A9A;
const WALL_STROKE = 0x4A5A6A;
const FURNITURE_WOOD = 0x8B7355;
const FURNITURE_FABRIC = 0x6B7280;
const TILE_GRID_COLOR = 0x9AA5B1;

// =============================================================================
// Floor & Walls
// =============================================================================

/**
 * Create complete floorplan with walls, doors, windows, floor tiles
 */
export const createFloorplan = (bounds: { width: number; height: number }): PIXI.Container => {
  const container = new PIXI.Container();
  
  // Floor with tile pattern
  const floor = createTiledFloor(bounds.width, bounds.height, 60);
  container.addChild(floor);
  
  // Outer walls (thick border)
  const walls = new PIXI.Graphics();
  walls.stroke({ width: 12, color: WALL_STROKE });
  walls.fill({ color: WALL_COLOR });
  walls.roundRect(0, 0, bounds.width, bounds.height, 8);
  walls.fill();
  walls.stroke();
  container.addChild(walls);
  
  return container;
};

/**
 * Create tiled floor pattern
 */
export const createTiledFloor = (width: number, height: number, tileSize: number): PIXI.Graphics => {
  const graphics = new PIXI.Graphics();
  
  // Floor base
  graphics.fill({ color: FLOOR_COLOR });
  graphics.rect(0, 0, width, height);
  graphics.fill();
  
  // Tile grid lines
  graphics.stroke({ width: 1, color: TILE_GRID_COLOR, alpha: 0.3 });
  
  // Vertical lines
  for (let x = tileSize; x < width; x += tileSize) {
    graphics.moveTo(x, 0);
    graphics.lineTo(x, height);
  }
  
  // Horizontal lines
  for (let y = tileSize; y < height; y += tileSize) {
    graphics.moveTo(0, y);
    graphics.lineTo(width, y);
  }
  
  graphics.stroke();
  
  return graphics;
};

/**
 * Create interior wall
 */
export const createWall = (start: Point2D, end: Point2D, thickness = 8): PIXI.Graphics => {
  const graphics = new PIXI.Graphics();
  
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const length = Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2);
  
  graphics.fill({ color: WALL_COLOR });
  graphics.stroke({ width: 2, color: WALL_STROKE });
  
  // Draw wall as rotated rectangle
  graphics.rect(0, -thickness / 2, length, thickness);
  graphics.fill();
  graphics.stroke();
  
  graphics.position.set(start.x, start.y);
  graphics.rotation = angle;
  
  return graphics;
};

/**
 * Create doorway opening
 */
export const createDoorway = (position: Point2D, width = 90, isOpen = true): PIXI.Graphics => {
  const graphics = new PIXI.Graphics();
  
  if (isOpen) {
    // Just a gap - draw door frame
    graphics.stroke({ width: 3, color: WALL_STROKE });
    graphics.moveTo(0, 0);
    graphics.lineTo(0, 8);
    graphics.moveTo(width, 0);
    graphics.lineTo(width, 8);
    graphics.stroke();
  } else {
    // Closed door
    graphics.fill({ color: 0x654321 });
    graphics.rect(0, 0, width, 6);
    graphics.fill();
    graphics.stroke({ width: 1, color: 0x4A3A2A });
    graphics.rect(0, 0, width, 6);
    graphics.stroke();
  }
  
  graphics.position.set(position.x, position.y);
  
  return graphics;
};

// =============================================================================
// Furniture
// =============================================================================

/**
 * Create sofa (3-seat)
 */
export const createSofa = (size: Size2D = { width: 200, height: 80 }): PIXI.Graphics => {
  const graphics = new PIXI.Graphics();
  const { width, height } = size;
  
  // Base
  graphics.fill({ color: FURNITURE_FABRIC, alpha: 0.9 });
  graphics.roundRect(0, 0, width, height, 8);
  graphics.fill();
  
  // Cushions (3 sections)
  graphics.stroke({ width: 2, color: 0x4A4A4A, alpha: 0.3 });
  const cushionWidth = width / 3;
  graphics.moveTo(cushionWidth, 5);
  graphics.lineTo(cushionWidth, height - 5);
  graphics.moveTo(cushionWidth * 2, 5);
  graphics.lineTo(cushionWidth * 2, height - 5);
  graphics.stroke();
  
  // Backrest
  graphics.fill({ color: FURNITURE_FABRIC, alpha: 0.8 });
  graphics.roundRect(5, 5, width - 10, 12, 4);
  graphics.fill();
  
  // Border
  graphics.stroke({ width: 2, color: 0x3A3A3A });
  graphics.roundRect(0, 0, width, height, 8);
  graphics.stroke();
  
  return graphics;
};

/**
 * Create coffee table
 */
export const createCoffeeTable = (size: Size2D = { width: 120, height: 60 }): PIXI.Graphics => {
  const graphics = new PIXI.Graphics();
  const { width, height } = size;
  
  // Table top
  graphics.fill({ color: FURNITURE_WOOD });
  graphics.roundRect(0, 0, width, height, 6);
  graphics.fill();
  
  // Wood grain effect (simple lines)
  graphics.stroke({ width: 1, color: 0x6A5A45, alpha: 0.4 });
  for (let i = 10; i < width - 10; i += 20) {
    graphics.moveTo(i, 5);
    graphics.lineTo(i + 15, height - 5);
  }
  graphics.stroke();
  
  // Border
  graphics.stroke({ width: 2, color: 0x5A4A35 });
  graphics.roundRect(0, 0, width, height, 6);
  graphics.stroke();
  
  return graphics;
};

/**
 * Create kitchen counter/island
 */
export const createKitchenCounter = (size: Size2D = { width: 200, height: 60 }): PIXI.Graphics => {
  const graphics = new PIXI.Graphics();
  const { width, height } = size;
  
  // Counter top
  graphics.fill({ color: 0xC8C8C8 });
  graphics.roundRect(0, 0, width, height, 4);
  graphics.fill();
  
  // Counter base
  graphics.fill({ color: 0x4A4A4A });
  graphics.rect(5, height - 10, width - 10, 10);
  graphics.fill();
  
  // Drawers/cabinets
  graphics.stroke({ width: 2, color: 0x3A3A3A });
  const drawerWidth = width / 4;
  for (let i = 1; i < 4; i++) {
    graphics.moveTo(drawerWidth * i, 10);
    graphics.lineTo(drawerWidth * i, height - 10);
  }
  graphics.stroke();
  
  // Border
  graphics.stroke({ width: 2, color: 0x8A8A8A });
  graphics.roundRect(0, 0, width, height, 4);
  graphics.stroke();
  
  return graphics;
};

/**
 * Create bar stool
 */
export const createBarStool = (radius = 18): PIXI.Graphics => {
  const graphics = new PIXI.Graphics();
  
  // Seat
  graphics.fill({ color: 0x2A2A2A });
  graphics.circle(0, 0, radius);
  graphics.fill();
  
  graphics.stroke({ width: 2, color: 0x1A1A1A });
  graphics.circle(0, 0, radius);
  graphics.stroke();
  
  // Center highlight
  graphics.fill({ color: 0x3A3A3A });
  graphics.circle(0, 0, radius * 0.4);
  graphics.fill();
  
  return graphics;
};

/**
 * Create small table prop with items
 */
export const createTableWithItems = (size: Size2D = { width: 80, height: 50 }): PIXI.Container => {
  const container = new PIXI.Container();
  
  // Table
  const table = new PIXI.Graphics();
  table.fill({ color: FURNITURE_WOOD });
  table.roundRect(0, 0, size.width, size.height, 4);
  table.fill();
  table.stroke({ width: 1, color: 0x5A4A35 });
  table.roundRect(0, 0, size.width, size.height, 4);
  table.stroke();
  container.addChild(table);
  
  // Items on table (abstract shapes)
  const item1 = new PIXI.Graphics();
  item1.fill({ color: 0xE8E8E8 });
  item1.roundRect(10, 10, 25, 20, 3);
  item1.fill();
  item1.stroke({ width: 1, color: 0xA8A8A8 });
  item1.roundRect(10, 10, 25, 20, 3);
  item1.stroke();
  container.addChild(item1);
  
  const item2 = new PIXI.Graphics();
  item2.fill({ color: 0xD4D4D4 });
  item2.circle(size.width - 20, size.height - 15, 8);
  item2.fill();
  container.addChild(item2);
  
  return container;
};

// =============================================================================
// Characters (Enhanced)
// =============================================================================

/**
 * Create character with detailed body shape (top-down view)
 */
export const createCharacter = (
  color: number = 0x2D3748,
  scale = 1,
  facing = 0
): PIXI.Graphics => {
  const graphics = new PIXI.Graphics();
  const size = 40 * scale;
  
  // Shadow
  graphics.fill({ color: 0x000000, alpha: 0.2 });
  graphics.ellipse(0, 5, size * 0.45, size * 0.3);
  graphics.fill();
  
  // Body (rounded shape)
  graphics.fill({ color });
  graphics.ellipse(0, 0, size * 0.4, size * 0.5);
  graphics.fill();
  
  // Shoulders (wider at top)
  graphics.fill({ color });
  graphics.ellipse(0, -size * 0.15, size * 0.45, size * 0.25);
  graphics.fill();
  
  // Head
  graphics.fill({ color: 0x3A4A5A });
  graphics.circle(0, -size * 0.4, size * 0.2);
  graphics.fill();
  
  // Direction indicator (nose/facing)
  const noseLength = size * 0.65;
  graphics.fill({ color });
  graphics.moveTo(0, -size * 0.2);
  graphics.lineTo(
    Math.cos(facing - 0.3) * noseLength,
    Math.sin(facing - 0.3) * noseLength
  );
  graphics.lineTo(
    Math.cos(facing + 0.3) * noseLength,
    Math.sin(facing + 0.3) * noseLength
  );
  graphics.closePath();
  graphics.fill();
  
  // Outline
  graphics.stroke({ width: 2, color: 0x1A1A2E, alpha: 0.3 });
  graphics.ellipse(0, 0, size * 0.4, size * 0.5);
  graphics.stroke();
  
  return graphics;
};

// =============================================================================
// Camera Icons (Enhanced)
// =============================================================================

/**
 * Create detailed camera icon
 */
export const createCameraIcon = (
  color: number,
  label: string,
  size = 30
): PIXI.Container => {
  const container = new PIXI.Container();
  
  const graphics = new PIXI.Graphics();
  
  // Camera body
  graphics.fill({ color: 0x2A2A2A });
  graphics.roundRect(-size * 0.7, -size * 0.4, size * 1.2, size * 0.8, 4);
  graphics.fill();
  
  // Lens mount
  graphics.fill({ color: 0x1A1A1A });
  graphics.circle(size * 0.5, 0, size * 0.35);
  graphics.fill();
  
  // Lens glass
  graphics.fill({ color: 0x4A5A6A });
  graphics.circle(size * 0.5, 0, size * 0.25);
  graphics.fill();
  
  // Lens highlight
  graphics.fill({ color: 0x8A9AAA, alpha: 0.6 });
  graphics.circle(size * 0.55, -size * 0.08, size * 0.1);
  graphics.fill();
  
  // Viewfinder
  graphics.fill({ color: 0x3A3A3A });
  graphics.rect(-size * 0.5, -size * 0.5, size * 0.3, size * 0.2);
  graphics.fill();
  
  // Border
  graphics.stroke({ width: 2, color });
  graphics.roundRect(-size * 0.7, -size * 0.4, size * 1.2, size * 0.8, 4);
  graphics.stroke();
  
  container.addChild(graphics);
  
  // Label
  const labelBg = new PIXI.Graphics();
  labelBg.fill({ color, alpha: 0.9 });
  labelBg.roundRect(-25, -size - 12, 50, 18, 4);
  labelBg.fill();
  container.addChild(labelBg);
  
  const text = new PIXI.Text({
    text: label,
    style: {
      fontSize: 12,
      fill: '#FFFFFF',
      fontFamily: 'Inter, Arial, sans-serif',
      fontWeight: 'bold',
    },
  });
  text.anchor.set(0.5);
  text.position.set(0, -size - 3);
  container.addChild(text);
  
  return container;
};

// =============================================================================
// FOV Cone with Range Label
// =============================================================================

/**
 * Create FOV cone with distance range label
 */
export const createFOVCone = (
  color: number,
  fovDegrees: number,
  nearDist: number,
  farDist: number,
  rotation: number,
  showLabel = true
): PIXI.Container => {
  const container = new PIXI.Container();
  
  const graphics = new PIXI.Graphics();
  const fovRad = (fovDegrees * Math.PI) / 180 / 2;
  const rotRad = (rotation * Math.PI) / 180;
  
  // Cone fill
  graphics.fill({ color, alpha: 0.25 });
  graphics.moveTo(0, 0);
  
  const segments = 32;
  for (let i = 0; i <= segments; i++) {
    const angle = rotRad - fovRad + (fovRad * 2 * i) / segments;
    graphics.lineTo(Math.cos(angle) * farDist, Math.sin(angle) * farDist);
  }
  graphics.closePath();
  graphics.fill();
  
  // Cone edges
  graphics.stroke({ width: 2, color, alpha: 0.6 });
  graphics.moveTo(0, 0);
  graphics.lineTo(
    Math.cos(rotRad - fovRad) * farDist,
    Math.sin(rotRad - fovRad) * farDist
  );
  graphics.moveTo(0, 0);
  graphics.lineTo(
    Math.cos(rotRad + fovRad) * farDist,
    Math.sin(rotRad + fovRad) * farDist
  );
  graphics.stroke();
  
  // Far arc
  graphics.stroke({ width: 2, color, alpha: 0.8 });
  graphics.arc(0, 0, farDist, rotRad - fovRad, rotRad + fovRad);
  graphics.stroke();
  
  container.addChild(graphics);
  
  // Distance label
  if (showLabel) {
    const nearM = Math.round(nearDist / 10) / 10;
    const farM = Math.round(farDist / 10) / 10;
    const labelText = `${nearM}m - ${farM}m`;
    
    const labelPos = {
      x: Math.cos(rotRad) * (farDist * 0.5),
      y: Math.sin(rotRad) * (farDist * 0.5),
    };
    
    const text = new PIXI.Text({
      text: labelText,
      style: {
        fontSize: 14,
        fill: '#FFFFFF',
        fontFamily: 'Inter, Arial, sans-serif',
        fontWeight: 'bold',
      },
    });
    text.anchor.set(0.5);
    
    const labelBg = new PIXI.Graphics();
    labelBg.fill({ color: 0x000000, alpha: 0.7 });
    labelBg.roundRect(
      labelPos.x - text.width / 2 - 6,
      labelPos.y - text.height / 2 - 3,
      text.width + 12,
      text.height + 6,
      4
    );
    labelBg.fill();
    
    container.addChild(labelBg);
    text.position.set(labelPos.x, labelPos.y);
    container.addChild(text);
  }
  
  return container;
};

// =============================================================================
// 180° Line of Action (Dashed)
// =============================================================================

/**
 * Create 180° axis line (dashed)
 */
export const create180Line = (
  start: Point2D,
  end: Point2D,
  color = 0x666666
): PIXI.Graphics => {
  const graphics = new PIXI.Graphics();
  
  const length = Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2);
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  
  const dashLength = 15;
  const gapLength = 10;
  let currentDist = 0;
  let drawing = true;
  
  graphics.stroke({ width: 2, color, alpha: 0.7 });
  
  while (currentDist < length) {
    const nextDist = Math.min(
      currentDist + (drawing ? dashLength : gapLength),
      length
    );
    
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
// Small Props
// =============================================================================

/**
 * Create glasses on table
 */
export const createGlasses = (): PIXI.Graphics => {
  const graphics = new PIXI.Graphics();
  
  // Glass 1
  graphics.fill({ color: 0xE8F4F8, alpha: 0.6 });
  graphics.circle(-8, 0, 6);
  graphics.fill();
  graphics.stroke({ width: 1, color: 0xB8D4D8 });
  graphics.circle(-8, 0, 6);
  graphics.stroke();
  
  // Glass 2
  graphics.fill({ color: 0xE8F4F8, alpha: 0.6 });
  graphics.circle(8, 0, 6);
  graphics.fill();
  graphics.stroke({ width: 1, color: 0xB8D4D8 });
  graphics.circle(8, 0, 6);
  graphics.stroke();
  
  return graphics;
};

/**
 * Create small rectangular prop (book, device, etc.)
 */
export const createSmallProp = (
  width: number,
  height: number,
  color: number
): PIXI.Graphics => {
  const graphics = new PIXI.Graphics();
  
  graphics.fill({ color });
  graphics.roundRect(-width / 2, -height / 2, width, height, 2);
  graphics.fill();
  
  graphics.stroke({ width: 1, color: 0x000000, alpha: 0.3 });
  graphics.roundRect(-width / 2, -height / 2, width, height, 2);
  graphics.stroke();
  
  return graphics;
};
