/**
 * 2D Shot Planner Types
 * 
 * Comprehensive type definitions for the visual shot planning system.
 * Supports floor plans, cameras, actors, props, and shot configurations.
 */

// =============================================================================
// Basic Geometry Types
// =============================================================================

export interface Point2D {
  x: number;
  y: number;
}

export interface Size2D {
  width: number;
  height: number;
}

export interface Bounds2D {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Transform2D {
  position: Point2D;
  rotation: number; // degrees
  scale: number;
}

// =============================================================================
// Camera Types
// =============================================================================

export type ShotType = 
  | 'EWS'  // Extreme Wide Shot
  | 'WS'   // Wide Shot
  | 'MWS'  // Medium Wide Shot
  | 'MS'   // Medium Shot
  | 'MCU'  // Medium Close-Up
  | 'CU'   // Close-Up
  | 'BCU'  // Big Close-Up
  | 'ECU'  // Extreme Close-Up
  | 'OTS'  // Over-the-Shoulder
  | 'POV'  // Point of View
  | 'Insert' // Insert/Detail
  | 'Two-Shot'
  | 'Group';

export type CameraHeight = 
  | 'Ground Level'
  | 'Low Angle'
  | 'Eye Level'
  | 'High Angle'
  | 'Birds Eye'
  | 'Dutch Angle'
  | 'Worms Eye';

export type CameraAngleType = 
  | 'Straight On'
  | 'Profile'
  | '3/4 Front'
  | '3/4 Back'
  | 'Back'
  | 'Over Shoulder';

export type CameraMovement = 
  | 'Static'
  | 'Pan Left'
  | 'Pan Right'
  | 'Tilt Up'
  | 'Tilt Down'
  | 'Dolly In'
  | 'Dolly Out'
  | 'Truck Left'
  | 'Truck Right'
  | 'Pedestal Up'
  | 'Pedestal Down'
  | 'Zoom In'
  | 'Zoom Out'
  | 'Arc Left'
  | 'Arc Right'
  | 'Follow'
  | 'Crane Up'
  | 'Crane Down'
  | 'Steadicam'
  | 'Handheld';

export type LensType = 
  | '14mm' | '18mm' | '21mm' | '24mm' | '28mm' | '35mm' 
  | '50mm' | '65mm' | '85mm' | '100mm' | '135mm' | '200mm';

export interface CameraFrustum {
  nearDistance: number;  // meters
  farDistance: number;   // meters
  fov: number;           // degrees (calculated from lens)
}

export interface Camera2D {
  id: string;
  name: string;           // 'Cam A', 'Cam B', etc.
  label: string;          // Display label
  position: Point2D;
  rotation: number;       // degrees, 0 = pointing right
  color: string;          // Frustum color
  
  // Camera settings
  shotType: ShotType;
  lens: LensType;
  height: CameraHeight;
  angle: CameraAngleType;
  movement: CameraMovement;
  
  // Frustum visualization
  frustum: CameraFrustum;
  showFrustum: boolean;
  frustumOpacity: number;
  
  // Focus & Depth of Field
  focusDistance?: number;  // Distance to focus plane (in scene units)
  depthOfField?: number;   // DoF range (in scene units)
  bladeCount?: number;     // Aperture blade count for bokeh preview
  
  // Motion path (for animated shots)
  motionPath?: Point2D[];  // Keyframe positions for camera movement
  
  // State
  isSelected: boolean;
  isActive: boolean;      // Currently shooting camera
  locked: boolean;
  visible: boolean;
  zIndex: number;
}

// Lens to FOV mapping (full frame equivalent)
export const LENS_FOV_MAP: Record<LensType, number> = {
  '14mm': 114,
  '18mm': 100,
  '21mm': 92,
  '24mm': 84,
  '28mm': 75,
  '35mm': 63,
  '50mm': 46,
  '65mm': 36,
  '85mm': 28,
  '100mm': 24,
  '135mm': 18,
  '200mm': 12,
};

// =============================================================================
// Actor/Character Types
// =============================================================================

export type ActorPose = 
  | 'Standing'
  | 'Sitting'
  | 'Walking'
  | 'Running'
  | 'Crouching'
  | 'Lying'
  | 'Custom';

export type ActorFacing = 
  | 'Front'
  | 'Back'
  | 'Left'
  | 'Right'
  | '3/4 Front Left'
  | '3/4 Front Right'
  | '3/4 Back Left'
  | '3/4 Back Right';

export interface Actor2D {
  id: string;
  name: string;
  characterName?: string;
  position: Point2D;
  rotation: number;
  scale: number;
  
  // Appearance
  color: string;
  spriteUrl?: string;
  pose: ActorPose;
  facing: ActorFacing;
  
  // Movement path
  movementPath?: Point2D[];
  showMovementPath: boolean;
  
  // State
  isSelected: boolean;
  locked: boolean;
  visible: boolean;
  zIndex: number;
  
  // Grouping for multi-character shots
  groupId?: string;
}

// =============================================================================
// Prop/Asset Types
// =============================================================================

export type PropCategory = 
  | 'Furniture'
  | 'Vehicle'
  | 'Lighting Equipment'
  | 'Set Dressing'
  | 'Hand Props'
  | 'Weapon'
  | 'Food & Drink'
  | 'Electronics'
  | 'Nature'
  | 'Door/Window'
  | 'Custom';

export interface Prop2D {
  id: string;
  name: string;
  category: PropCategory;
  position: Point2D;
  rotation: number;
  scale: number;
  size: Size2D;
  
  // Appearance
  color: string;
  spriteUrl?: string;
  shapeType: 'rectangle' | 'circle' | 'polygon' | 'sprite';
  polygonPoints?: Point2D[];
  
  // State
  isSelected: boolean;
  locked: boolean;
  visible: boolean;
  zIndex: number;
}

// =============================================================================
// Floor Plan / Set Types
// =============================================================================

export interface Wall2D {
  id: string;
  start: Point2D;
  end: Point2D;
  thickness: number;
  color: string;
  hasDoor?: boolean;
  hasWindow?: boolean;
  doorPosition?: number; // 0-1 along wall
  windowPosition?: number;
}

export interface Room2D {
  id: string;
  name: string;
  points: Point2D[];  // Polygon vertices
  color: string;
  fillOpacity: number;
  walls: Wall2D[];
}

export interface FloorPlan {
  id: string;
  name: string;
  imageUrl?: string;
  rooms: Room2D[];
  gridSize: number;      // meters per grid cell
  showGrid: boolean;
  gridOpacity: number;
  scale: number;         // pixels per meter
  bounds: Bounds2D;
}

// =============================================================================
// Shot Configuration
// =============================================================================

export interface FramingGuide {
  type: 'rule-of-thirds' | 'golden-ratio' | 'center' | 'diagonal' | 'custom';
  visible: boolean;
  opacity: number;
}

export interface Shot2D {
  id: string;
  number: number;        // Shot number in sequence
  name: string;
  description: string;
  
  // Camera reference
  cameraId: string;
  
  // Shot settings (override camera defaults)
  shotType: ShotType;
  lens: LensType;
  height: CameraHeight;
  angle: CameraAngleType;
  movement: CameraMovement;
  
  // Timing
  duration?: number;     // seconds
  
  // Visual
  thumbnailUrl?: string;
  previewImageUrl?: string;
  framingGuide: FramingGuide;
  
  // Subjects
  subjectActorIds: string[];
  
  // 180° rule
  lineOfAction?: {
    start: Point2D;
    end: Point2D;
    safe: boolean;       // Is camera on safe side?
  };
  
  // Director notes
  directorNotes?: string;
  technicalNotes?: string;
  
  // Measurements & guides
  measurementLines?: {
    id: string;
    start: Point2D;
    end: Point2D;
    label?: string;
  }[];
  
  // Status
  status: 'Planned' | 'Setup' | 'Rehearsal' | 'Shot' | 'Printed';
  notes?: string;
  
  // Grouping
  category?: 'Establishing' | 'Coverage' | 'Details' | 'Inserts' | 'Custom';
}

// =============================================================================
// Scene State
// =============================================================================

export interface SceneViewport {
  offset: Point2D;       // Pan offset
  zoom: number;          // Zoom level (1 = 100%)
  minZoom: number;
  maxZoom: number;
}

export interface Scene2D {
  id: string;
  name: string;
  description?: string;
  location: string;
  
  // Manuscript integration
  manuscriptSceneId?: string;  // Link to manuscript scene
  manuscriptId?: string;       // Link to manuscript for quick access
  
  // Floor plan
  floorPlan: FloorPlan;
  
  // Elements
  cameras: Camera2D[];
  actors: Actor2D[];
  props: Prop2D[];
  
  // Shots
  shots: Shot2D[];
  activeShotId: string | null;
  
  // Annotations (Apple Pencil drawings)
  annotations?: AnnotationData[];
  
  // Viewport
  viewport: SceneViewport;
  
  // Display settings
  showGrid: boolean;
  showRulers: boolean;
  showLineOfAction: boolean;
  show180Line: boolean;
  showFrustums: boolean;      // NEW: Show all camera frustums
  showMotionPaths: boolean;   // NEW: Show camera motion paths
  showMeasurements: boolean;  // NEW: Show measurement lines
  snapToGrid: boolean;
  gridSize: number;
  
  // Measurement
  measurementUnit: 'meters' | 'feet';
  pixelsPerMeter: number;
}

// =============================================================================
// Annotation Types
// =============================================================================

export interface AnnotationStroke {
  x: number[];
  y: number[];
  pressure: number[];
  tilt?: { x: number; y: number }[];
  brushType: string;
  color: string;
  size: number;
}

export interface AnnotationData {
  id: string;
  strokes: AnnotationStroke[];
  timestamp: number;
}

// =============================================================================
// Asset Library Types
// =============================================================================

export type AssetType = 'camera' | 'actor' | 'prop' | 'furniture' | 'vehicle' | 'nature';

export interface Asset2DDefinition {
  id: string;
  name: string;
  type: AssetType;
  category: string;
  thumbnailUrl: string;
  spriteUrl?: string;
  defaultSize: Size2D;
  defaultColor: string;
  tags: string[];
}

export interface AssetLibrary {
  cameras: Asset2DDefinition[];
  actors: Asset2DDefinition[];
  props: Asset2DDefinition[];
  furniture: Asset2DDefinition[];
  vehicles: Asset2DDefinition[];
  nature: Asset2DDefinition[];
}

// =============================================================================
// Event Types
// =============================================================================

export type PlannerTool = 
  | 'select'
  | 'pan'
  | 'camera'
  | 'actor'
  | 'prop'
  | 'wall'
  | 'measure'
  | 'path';

export interface DragState {
  isDragging: boolean;
  elementId: string | null;
  elementType: 'camera' | 'actor' | 'prop' | null;
  startPosition: Point2D | null;
  currentPosition: Point2D | null;
}

export interface SelectionState {
  selectedIds: string[];
  selectionType: 'camera' | 'actor' | 'prop' | 'mixed' | null;
  selectionBounds: Bounds2D | null;
}

// =============================================================================
// History/Undo Types
// =============================================================================

export interface HistoryEntry {
  id: string;
  timestamp: number;
  action: string;
  state: Partial<Scene2D>;
}

// =============================================================================
// Cinematography Utilities
// =============================================================================

/**
 * Calculate optimal focus distance and depth of field based on focal length
 * Following professional cinematography guidelines for subject distance
 * 
 * @param focalLength - Lens focal length in mm
 * @returns Object with focusDistance and depthOfField in meters
 */
export const calculateFocusFromFocalLength = (focalLength: number): { focusDistance: number; depthOfField: number } => {
  if (focalLength <= 14) {
    // Ultra-wide (14mm and below)
    // Used for: Establishing shots, dramatic perspectives
    return { focusDistance: 5.0, depthOfField: 8.0 };
  } else if (focalLength <= 24) {
    // Wide angle (15-24mm)
    // Used for: Wide shots, group scenes, coverage
    return { focusDistance: 4.0, depthOfField: 5.0 };
  } else if (focalLength <= 35) {
    // Standard wide (25-35mm)
    // Used for: Medium wide shots, walk & talks
    return { focusDistance: 3.5, depthOfField: 3.0 };
  } else if (focalLength <= 50) {
    // Standard (36-50mm)
    // Used for: Medium shots, natural perspective
    return { focusDistance: 2.5, depthOfField: 1.8 };
  } else if (focalLength <= 85) {
    // Portrait (51-85mm)
    // Used for: Close-ups, flattering portraits
    return { focusDistance: 1.8, depthOfField: 0.8 };
  } else if (focalLength <= 135) {
    // Telephoto (86-135mm)
    // Used for: Tight close-ups, compression
    return { focusDistance: 1.2, depthOfField: 0.4 };
  } else {
    // Long telephoto (135mm+)
    // Used for: Extreme close-ups, distant subjects
    return { focusDistance: 0.8, depthOfField: 0.2 };
  }
};

/**
 * Extract numeric focal length from lens type string
 * 
 * @param lensType - Lens type like "24mm", "50mm", etc.
 * @returns Numeric focal length value
 */
export const getFocalLengthFromLensType = (lensType: LensType): number => {
  const match = lensType.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 35; // Default to 35mm
};

// =============================================================================
// Default Values
// =============================================================================

export const DEFAULT_CAMERA: Omit<Camera2D, 'id' | 'name' | 'position'> = {
  label: 'Camera',
  rotation: 0,
  color: '#4FC3F7',
  shotType: 'MS',
  lens: '35mm',
  height: 'Eye Level',
  angle: 'Straight On',
  movement: 'Static',
  frustum: {
    nearDistance: 1,
    farDistance: 10,
    fov: LENS_FOV_MAP['35mm'],
  },
  showFrustum: true,
  frustumOpacity: 0.3,
  isSelected: false,
  isActive: false,
  locked: false,
  visible: true,
  zIndex: 100,
};

export const DEFAULT_ACTOR: Omit<Actor2D, 'id' | 'name' | 'position'> = {
  rotation: 0,
  scale: 1,
  color: '#4A5568',
  pose: 'Standing',
  facing: 'Front',
  showMovementPath: false,
  isSelected: false,
  locked: false,
  visible: true,
  zIndex: 50,
};

export const DEFAULT_PROP: Omit<Prop2D, 'id' | 'name' | 'position'> = {
  category: 'Furniture',
  rotation: 0,
  scale: 1,
  size: { width: 50, height: 50 },
  color: '#8B7355',
  shapeType: 'rectangle',
  isSelected: false,
  locked: false,
  visible: true,
  zIndex: 10,
};

export const DEFAULT_SCENE: Omit<Scene2D, 'id' | 'name'> = {
  location: '',
  floorPlan: {
    id: 'default',
    name: 'Floor Plan',
    rooms: [],
    gridSize: 1,
    showGrid: true,
    gridOpacity: 0.2,
    scale: 50,
    bounds: { x: 0, y: 0, width: 1000, height: 800 },
  },
  cameras: [],
  actors: [],
  props: [],
  shots: [],
  activeShotId: null,
  viewport: {
    offset: { x: 0, y: 0 },
    zoom: 1,
    minZoom: 0.1,
    maxZoom: 5,
  },
  showGrid: true,
  showRulers: true,
  showLineOfAction: true,
  show180Line: true,
  showFrustums: false,
  showMotionPaths: false,
  showMeasurements: false,
  snapToGrid: true,
  gridSize: 50,
  measurementUnit: 'meters',
  pixelsPerMeter: 50,
};

// =============================================================================
// Camera Color Presets
// =============================================================================

export const CAMERA_COLORS = [
  { name: 'Blue', hex: '#4FC3F7' },
  { name: 'Green', hex: '#81C784' },
  { name: 'Yellow', hex: '#FFD54F' },
  { name: 'Orange', hex: '#FFB74D' },
  { name: 'Red', hex: '#E57373' },
  { name: 'Purple', hex: '#BA68C8' },
  { name: 'Cyan', hex: '#4DD0E1' },
  { name: 'Pink', hex: '#F06292' },
];

// =============================================================================
// Shot Type Display Info
// =============================================================================

export const SHOT_TYPE_INFO: Record<ShotType, { abbr: string; description: string }> = {
  'EWS': { abbr: 'EWS', description: 'Extreme Wide Shot - Full environment' },
  'WS': { abbr: 'WS', description: 'Wide Shot - Full body with space' },
  'MWS': { abbr: 'MWS', description: 'Medium Wide Shot - Full body' },
  'MS': { abbr: 'MS', description: 'Medium Shot - Waist up' },
  'MCU': { abbr: 'MCU', description: 'Medium Close-Up - Chest up' },
  'CU': { abbr: 'CU', description: 'Close-Up - Face/head' },
  'BCU': { abbr: 'BCU', description: 'Big Close-Up - Part of face' },
  'ECU': { abbr: 'ECU', description: 'Extreme Close-Up - Detail' },
  'OTS': { abbr: 'OTS', description: 'Over-the-Shoulder' },
  'POV': { abbr: 'POV', description: 'Point of View' },
  'Insert': { abbr: 'Detail', description: 'Insert/Detail shot' },
  'Two-Shot': { abbr: '2-Shot', description: 'Two characters' },
  'Group': { abbr: 'Group', description: 'Multiple characters' },
};
