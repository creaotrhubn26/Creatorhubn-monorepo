import type { PencilPoint, PencilStroke } from '../../hooks/useApplePencil';

export type ShapeIntentPrimitive = 'ellipse' | 'rectangle' | 'line' | 'blob';
export type ShapeIntentCategory = 'Food' | 'Vehicle' | 'Furniture' | 'Prop' | 'Environment';
export type ShapeIntentWorkflowLevel = 'idea' | 'blocking' | 'shot' | 'presentation';

export interface ShapeIntentCanvasSize {
  width: number;
  height: number;
}

export interface ShapeIntentBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

export interface ShapeIntentParameterOption {
  id: string;
  label: string;
  hint: string;
}

export interface ShapeIntentParameter {
  id: string;
  label: string;
  selection: 'single' | 'multi';
  options: ShapeIntentParameterOption[];
  defaultValue: string[];
}

export interface ShapeIntentSuggestion {
  id: string;
  title: string;
  category: ShapeIntentCategory;
  description: string;
  learningFocus: string;
  accentColor: string;
  parameters: ShapeIntentParameter[];
}

export interface ShapeIntentAnalysis {
  primitive: ShapeIntentPrimitive;
  displayLabel: string;
  confidence: number;
  headline: string;
  summary: string;
  bounds: ShapeIntentBounds;
  sourceStroke: PencilStroke;
  sourceStrokeIndex: number;
  sourceStrokeIndexes: number[];
  normalizedGuideLabel: string;
  normalizedGuideStrokes: PencilStroke[];
  suggestions: ShapeIntentSuggestion[];
}

export interface ShapeIntentRankingContext {
  workflowLevel?: ShapeIntentWorkflowLevel;
  pinnedSuggestionIds?: string[];
  preferredSuggestionIds?: string[];
  recentSuggestionIds?: string[];
}

export interface ShapeIntentContextSignal {
  id: string;
  label: string;
  tone: 'workflow' | 'library' | 'recent' | 'pinned';
}

export type ShapeIntentSelections = Record<string, string[]>;
export type ShapeIntentApplyMode = 'rough' | 'construction' | 'clean';

export interface ShapeIntentScaffoldFrame {
  xRatio: number;
  yRatio: number;
  widthRatio: number;
  heightRatio: number;
  baseWidthRatio: number;
  baseHeightRatio: number;
}

export interface ShapeIntentScaffoldDefinition {
  primitive: ShapeIntentPrimitive;
  suggestionId: string;
  selections: ShapeIntentSelections;
  frame: ShapeIntentScaffoldFrame;
}

const FULL_TURN = Math.PI * 2;
const GUIDE_BRUSH_TEMPLATE = {
  type: 'pen',
  size: 4,
  color: '#f6b24d',
  opacity: 0.92,
  hardness: 0.82,
  flow: 0.74,
  wetness: 0.08,
  grain: 0.04,
  tiltSensitivity: 0.12,
  pressureSensitivity: 0.84,
} as const;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const distance = (left: PencilPoint, right: PencilPoint) => Math.hypot(right.x - left.x, right.y - left.y);

const getStrokeBounds = (stroke: PencilStroke): ShapeIntentBounds => {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  stroke.points.forEach((point) => {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  });

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return {
      minX: 0,
      minY: 0,
      maxX: 0,
      maxY: 0,
      width: 0,
      height: 0,
      centerX: 0,
      centerY: 0,
    };
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
};

const getPathLength = (stroke: PencilStroke) => stroke.points.reduce((sum, point, index, points) => (
  index === 0 ? sum : sum + distance(points[index - 1], point)
), 0);

const countDirectionChanges = (stroke: PencilStroke) => {
  let corners = 0;
  for (let index = 2; index < stroke.points.length; index += 1) {
    const previous = stroke.points[index - 2];
    const current = stroke.points[index - 1];
    const next = stroke.points[index];
    const angleA = Math.atan2(current.y - previous.y, current.x - previous.x);
    const angleB = Math.atan2(next.y - current.y, next.x - current.x);
    let delta = Math.abs(angleB - angleA);
    if (delta > Math.PI) {
      delta = FULL_TURN - delta;
    }
    if (delta > (Math.PI / 4.4)) {
      corners += 1;
    }
  }
  return corners;
};

const getEdgeOccupancy = (stroke: PencilStroke, bounds: ShapeIntentBounds) => {
  if (bounds.width <= 0 || bounds.height <= 0) return 0;
  const xTolerance = Math.max(14, bounds.width * 0.18);
  const yTolerance = Math.max(14, bounds.height * 0.18);
  const edgePointCount = stroke.points.filter((point) => (
    Math.abs(point.x - bounds.minX) <= xTolerance
    || Math.abs(point.x - bounds.maxX) <= xTolerance
    || Math.abs(point.y - bounds.minY) <= yTolerance
    || Math.abs(point.y - bounds.maxY) <= yTolerance
  )).length;
  return edgePointCount / Math.max(1, stroke.points.length);
};

interface PrimitiveStrokeAnalysis {
  primitive: ShapeIntentPrimitive;
  confidence: number;
  headline: string;
  summary: string;
  bounds: ShapeIntentBounds;
  stroke: PencilStroke;
  strokeIndex: number;
}

interface CompoundShapeIntentMatch {
  primitive: ShapeIntentPrimitive;
  displayLabel: string;
  confidence: number;
  headline: string;
  summary: string;
  bounds: ShapeIntentBounds;
  sourceStroke: PencilStroke;
  sourceStrokeIndex: number;
  sourceStrokeIndexes: number[];
  normalizedGuideLabel: string;
  normalizedGuideStrokes: PencilStroke[];
  suggestions: ShapeIntentSuggestion[];
}

const getCombinedBounds = (left: ShapeIntentBounds, right: ShapeIntentBounds): ShapeIntentBounds => {
  const minX = Math.min(left.minX, right.minX);
  const minY = Math.min(left.minY, right.minY);
  const maxX = Math.max(left.maxX, right.maxX);
  const maxY = Math.max(left.maxY, right.maxY);
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
};

const getBoundsSeparation = (left: ShapeIntentBounds, right: ShapeIntentBounds) => ({
  xGap: Math.max(0, Math.max(left.minX - right.maxX, right.minX - left.maxX)),
  yGap: Math.max(0, Math.max(left.minY - right.maxY, right.minY - left.maxY)),
});

const createStroke = (
  points: Array<{ x: number; y: number }>,
  color: string,
  width: number,
  opacity: number,
  timestampSeed: number,
): PencilStroke => ({
  inputType: 'pen',
  color,
  width,
  opacity,
  brush: {
    ...GUIDE_BRUSH_TEMPLATE,
    size: width,
    color,
    opacity,
  },
  points: points.map((point, index) => ({
    x: point.x,
    y: point.y,
    pressure: 0.72,
    tiltX: 0,
    tiltY: 0,
    timestamp: timestampSeed + (index * 16),
  })),
});

const createEllipseStroke = (
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
  color: string,
  width: number,
  opacity: number,
  timestampSeed: number,
  rotationDegrees = 0,
  steps = 44,
): PencilStroke => {
  const rotation = (rotationDegrees * Math.PI) / 180;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const points = Array.from({ length: steps + 1 }, (_, index) => {
    const angle = (index / steps) * FULL_TURN;
    const x = Math.cos(angle) * radiusX;
    const y = Math.sin(angle) * radiusY;
    return {
      x: centerX + (x * cos) - (y * sin),
      y: centerY + (x * sin) + (y * cos),
    };
  });
  return createStroke(points, color, width, opacity, timestampSeed);
};

const createLineStroke = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  width: number,
  opacity: number,
  timestampSeed: number,
  segments = 2,
): PencilStroke => {
  const points = Array.from({ length: segments }, (_, index) => {
    const ratio = segments <= 1 ? 0 : index / (segments - 1);
    return {
      x: x1 + ((x2 - x1) * ratio),
      y: y1 + ((y2 - y1) * ratio),
    };
  });
  return createStroke(points, color, width, opacity, timestampSeed);
};

const createRectangleStroke = (
  bounds: ShapeIntentBounds,
  color: string,
  width: number,
  opacity: number,
  timestampSeed: number,
): PencilStroke => createStroke([
  { x: bounds.minX, y: bounds.minY },
  { x: bounds.maxX, y: bounds.minY },
  { x: bounds.maxX, y: bounds.maxY },
  { x: bounds.minX, y: bounds.maxY },
  { x: bounds.minX, y: bounds.minY },
], color, width, opacity, timestampSeed);

const createRoundedRectangleStroke = (
  bounds: ShapeIntentBounds,
  radius: number,
  color: string,
  width: number,
  opacity: number,
  timestampSeed: number,
): PencilStroke => {
  const r = Math.max(4, Math.min(radius, Math.min(bounds.width, bounds.height) * 0.28));
  const points: Array<{ x: number; y: number }> = [];
  const corners = [
    { cx: bounds.maxX - r, cy: bounds.minY + r, start: -Math.PI / 2, end: 0 },
    { cx: bounds.maxX - r, cy: bounds.maxY - r, start: 0, end: Math.PI / 2 },
    { cx: bounds.minX + r, cy: bounds.maxY - r, start: Math.PI / 2, end: Math.PI },
    { cx: bounds.minX + r, cy: bounds.minY + r, start: Math.PI, end: (3 * Math.PI) / 2 },
  ];
  points.push({ x: bounds.minX + r, y: bounds.minY });
  points.push({ x: bounds.maxX - r, y: bounds.minY });
  corners.forEach((corner, index) => {
    const segments = 7;
    for (let step = 0; step <= segments; step += 1) {
      const angle = corner.start + (((corner.end - corner.start) * step) / segments);
      points.push({
        x: corner.cx + (Math.cos(angle) * r),
        y: corner.cy + (Math.sin(angle) * r),
      });
    }
    if (index === 0) {
      points.push({ x: bounds.maxX, y: bounds.maxY - r });
    } else if (index === 1) {
      points.push({ x: bounds.minX + r, y: bounds.maxY });
    } else if (index === 2) {
      points.push({ x: bounds.minX, y: bounds.minY + r });
    }
  });
  points.push({ x: bounds.minX + r, y: bounds.minY });
  return createStroke(points, color, width, opacity, timestampSeed);
};

const expandBounds = (bounds: ShapeIntentBounds, amountX: number, amountY: number): ShapeIntentBounds => ({
  minX: bounds.minX - amountX,
  minY: bounds.minY - amountY,
  maxX: bounds.maxX + amountX,
  maxY: bounds.maxY + amountY,
  width: bounds.width + (amountX * 2),
  height: bounds.height + (amountY * 2),
  centerX: bounds.centerX,
  centerY: bounds.centerY,
});

const getSingleSelection = (selections: ShapeIntentSelections, parameter: ShapeIntentParameter) => (
  selections[parameter.id]?.[0] || parameter.defaultValue[0] || parameter.options[0]?.id || ''
);

const getMultiSelection = (selections: ShapeIntentSelections, parameter: ShapeIntentParameter) => {
  const current = selections[parameter.id];
  if (current && current.length > 0) {
    return current;
  }
  return parameter.defaultValue;
};

const createBoundsFromScaffoldFrame = (
  frame: ShapeIntentScaffoldFrame,
  canvasSize: ShapeIntentCanvasSize,
): ShapeIntentBounds => {
  const width = Math.max(18, canvasSize.width * clamp(frame.widthRatio, 0.02, 1));
  const height = Math.max(18, canvasSize.height * clamp(frame.heightRatio, 0.02, 1));
  const minX = clamp(frame.xRatio, 0, 1) * canvasSize.width;
  const minY = clamp(frame.yRatio, 0, 1) * canvasSize.height;
  const maxX = Math.min(canvasSize.width, minX + width);
  const maxY = Math.min(canvasSize.height, minY + height);
  const resolvedWidth = Math.max(18, maxX - minX);
  const resolvedHeight = Math.max(18, maxY - minY);
  return {
    minX,
    minY,
    maxX: minX + resolvedWidth,
    maxY: minY + resolvedHeight,
    width: resolvedWidth,
    height: resolvedHeight,
    centerX: minX + (resolvedWidth / 2),
    centerY: minY + (resolvedHeight / 2),
  };
};

const ellipseSuggestions: ShapeIntentSuggestion[] = [
  {
    id: 'pizza',
    title: 'Pizza',
    category: 'Food',
    description: 'Turn the ellipse into a readable pizza top view with crust, slices, and topping rhythm.',
    learningFocus: 'Great for practicing perspective ellipses, rim thickness, and clustered surface detail.',
    accentColor: '#f97316',
    parameters: [
      {
        id: 'crust',
        label: 'Crust Thickness',
        selection: 'single',
        defaultValue: ['classic'],
        options: [
          { id: 'thin', label: 'Thin', hint: 'Low rim, flatter profile' },
          { id: 'classic', label: 'Classic', hint: 'Balanced rim and cheese zone' },
          { id: 'deep', label: 'Deep Dish', hint: 'Heavy rim and deep center' },
        ],
      },
      {
        id: 'toppings',
        label: 'Toppings',
        selection: 'multi',
        defaultValue: ['pepperoni', 'cheese'],
        options: [
          { id: 'pepperoni', label: 'Pepperoni', hint: 'Even circular clusters' },
          { id: 'cheese', label: 'Cheese', hint: 'Organic cheese pockets' },
          { id: 'mushroom', label: 'Mushroom', hint: 'Mushroom caps and slices' },
          { id: 'basil', label: 'Basil', hint: 'Small leaf accents' },
        ],
      },
      {
        id: 'cuts',
        label: 'Slice Cuts',
        selection: 'single',
        defaultValue: ['six'],
        options: [
          { id: 'whole', label: 'Whole', hint: 'No slice lines' },
          { id: 'quartered', label: 'Quartered', hint: 'Simple four-way cut' },
          { id: 'six', label: 'Six Slices', hint: 'Classic pizza beat' },
        ],
      },
    ],
  },
  {
    id: 'motorcycle-wheel',
    title: 'Motorcycle Wheel',
    category: 'Vehicle',
    description: 'Use the ellipse as a wheel silhouette with tire mass, hub, and spoke cadence.',
    learningFocus: 'Builds comfort with concentric ellipses, radial spacing, and mechanical read.',
    accentColor: '#60a5fa',
    parameters: [
      {
        id: 'vehicle',
        label: 'Vehicle Type',
        selection: 'single',
        defaultValue: ['motorcycle'],
        options: [
          { id: 'motorcycle', label: 'Motorcycle', hint: 'Chunky tire and clear spokes' },
          { id: 'bicycle', label: 'Bicycle', hint: 'Thin tire and dense spokes' },
          { id: 'car', label: 'Car Rim', hint: 'Thicker rim and fewer spokes' },
        ],
      },
      {
        id: 'spokes',
        label: 'Spokes',
        selection: 'single',
        defaultValue: ['8'],
        options: [
          { id: '5', label: '5', hint: 'Chunky star-like spokes' },
          { id: '8', label: '8', hint: 'Balanced mechanical layout' },
          { id: 'dense', label: 'Dense', hint: 'Many thin spokes' },
        ],
      },
      {
        id: 'tire',
        label: 'Tire Profile',
        selection: 'single',
        defaultValue: ['road'],
        options: [
          { id: 'thin', label: 'Thin', hint: 'Lightweight narrow tire' },
          { id: 'road', label: 'Road', hint: 'Balanced street profile' },
          { id: 'chunky', label: 'Chunky', hint: 'Heavier off-road silhouette' },
        ],
      },
    ],
  },
  {
    id: 'round-table',
    title: 'Round Table',
    category: 'Furniture',
    description: 'Convert the ellipse into a table top with readable thickness and support design.',
    learningFocus: 'Helps with tabletop perspective, support placement, and staging for props or characters.',
    accentColor: '#22c55e',
    parameters: [
      {
        id: 'tabletop',
        label: 'Tabletop Thickness',
        selection: 'single',
        defaultValue: ['standard'],
        options: [
          { id: 'slim', label: 'Slim', hint: 'Light floating surface' },
          { id: 'standard', label: 'Standard', hint: 'General-purpose tabletop' },
          { id: 'heavy', label: 'Heavy', hint: 'Thick cinematic top' },
        ],
      },
      {
        id: 'base',
        label: 'Base',
        selection: 'single',
        defaultValue: ['pedestal'],
        options: [
          { id: 'pedestal', label: 'Pedestal', hint: 'Single central column' },
          { id: 'four-legs', label: 'Four Legs', hint: 'Classic dining layout' },
          { id: 'cafe', label: 'Cafe', hint: 'Cross base with wider feet' },
        ],
      },
      {
        id: 'staging',
        label: 'View',
        selection: 'single',
        defaultValue: ['three-quarter'],
        options: [
          { id: 'top', label: 'Top', hint: 'Flatter overhead board' },
          { id: 'three-quarter', label: '3/4 View', hint: 'More readable tabletop thickness' },
          { id: 'hero', label: 'Hero Low', hint: 'Stronger under-ellipse read' },
        ],
      },
    ],
  },
  {
    id: 'plate',
    title: 'Plate / Bowl',
    category: 'Prop',
    description: 'Build a clean prop read with rim control and optional dish content.',
    learningFocus: 'Good for practicing nested ellipses and prop readability in close-up shots.',
    accentColor: '#e879f9',
    parameters: [
      {
        id: 'rim',
        label: 'Rim Style',
        selection: 'single',
        defaultValue: ['wide'],
        options: [
          { id: 'thin', label: 'Thin Rim', hint: 'Minimal ceramic edge' },
          { id: 'wide', label: 'Wide Rim', hint: 'Clear inner ellipse and rim band' },
          { id: 'bowl', label: 'Bowl', hint: 'Deeper vertical drop' },
        ],
      },
      {
        id: 'content',
        label: 'Contents',
        selection: 'single',
        defaultValue: ['empty'],
        options: [
          { id: 'empty', label: 'Empty', hint: 'Pure construction practice' },
          { id: 'salad', label: 'Salad', hint: 'Leaf clusters and garnish' },
          { id: 'ramen', label: 'Ramen', hint: 'Surface swirl and toppings' },
        ],
      },
      {
        id: 'angle',
        label: 'Angle',
        selection: 'single',
        defaultValue: ['dining'],
        options: [
          { id: 'top', label: 'Top', hint: 'Near-perfect circle' },
          { id: 'dining', label: 'Dining', hint: 'Natural seated perspective' },
          { id: 'dramatic', label: 'Dramatic', hint: 'Compressed ellipse' },
        ],
      },
    ],
  },
  {
    id: 'clock',
    title: 'Clock',
    category: 'Prop',
    description: 'Use the shape as a clock face with ticks and readable hand placement.',
    learningFocus: 'Great for timing props, circular design, and clean icon readability.',
    accentColor: '#facc15',
    parameters: [
      {
        id: 'ticks',
        label: 'Tick Marks',
        selection: 'single',
        defaultValue: ['dense'],
        options: [
          { id: 'minimal', label: 'Minimal', hint: 'Quarter-hour emphasis' },
          { id: 'dense', label: 'Dense', hint: 'Full hour markers' },
          { id: 'roman', label: 'Roman', hint: 'Decorative dial feel' },
        ],
      },
      {
        id: 'hands',
        label: 'Hand Position',
        selection: 'single',
        defaultValue: ['10:10'],
        options: [
          { id: '10:10', label: '10:10', hint: 'Balanced commercial pose' },
          { id: '12:00', label: '12:00', hint: 'Top alignment' },
          { id: '3:15', label: '3:15', hint: 'Asymmetric read' },
        ],
      },
      {
        id: 'mount',
        label: 'Mount',
        selection: 'single',
        defaultValue: ['wall'],
        options: [
          { id: 'wall', label: 'Wall Clock', hint: 'Simple face only' },
          { id: 'prop', label: 'Prop Stand', hint: 'Add a small stand' },
          { id: 'watch', label: 'Watch Face', hint: 'Tighter compact face' },
        ],
      },
    ],
  },
  {
    id: 'head-mass',
    title: 'Head Mass',
    category: 'Prop',
    description: 'Use the ellipse as a head construction mass with jaw weight and eyeline direction.',
    learningFocus: 'Useful for head proportion, tilt, and readable facial staging in blocking passes.',
    accentColor: '#fda4af',
    parameters: [
      {
        id: 'head-shape',
        label: 'Head Shape',
        selection: 'single',
        defaultValue: ['neutral'],
        options: [
          { id: 'neutral', label: 'Neutral', hint: 'Balanced cranium and jaw' },
          { id: 'hero', label: 'Hero', hint: 'Broader jaw and stronger silhouette' },
          { id: 'soft', label: 'Soft', hint: 'Rounder lower face' },
        ],
      },
      {
        id: 'tilt',
        label: 'Tilt',
        selection: 'single',
        defaultValue: ['front'],
        options: [
          { id: 'front', label: 'Front', hint: 'Straight-on head block' },
          { id: 'three-quarter', label: '3/4', hint: 'Asymmetric face turn' },
          { id: 'profile', label: 'Profile', hint: 'Side silhouette focus' },
        ],
      },
      {
        id: 'eyeline',
        label: 'Eyeline',
        selection: 'single',
        defaultValue: ['level'],
        options: [
          { id: 'up', label: 'Up', hint: 'Lift the gaze slightly' },
          { id: 'level', label: 'Level', hint: 'Neutral eyeline' },
          { id: 'down', label: 'Down', hint: 'Lower eyeline for introspection' },
        ],
      },
    ],
  },
  {
    id: 'pendant-lamp',
    title: 'Pendant Lamp',
    category: 'Prop',
    description: 'Turn the ellipse into a hanging interrogation or warehouse lamp with hard top-light falloff.',
    learningFocus: 'Useful for top-light staging, hard pools of value, and directing the eye inside a dark scene.',
    accentColor: '#f8fafc',
    parameters: [
      {
        id: 'shade',
        label: 'Shade',
        selection: 'single',
        defaultValue: ['dome'],
        options: [
          { id: 'dome', label: 'Dome', hint: 'Round industrial shade' },
          { id: 'cone', label: 'Cone', hint: 'Sharper downward cone' },
          { id: 'industrial', label: 'Industrial', hint: 'Heavier rim and housing' },
        ],
      },
      {
        id: 'glow',
        label: 'Glow',
        selection: 'single',
        defaultValue: ['hot'],
        options: [
          { id: 'low', label: 'Low', hint: 'More controlled light pool' },
          { id: 'hot', label: 'Hot', hint: 'Strong table read' },
          { id: 'blown', label: 'Blown', hint: 'Very bright interrogation hit' },
        ],
      },
      {
        id: 'cord',
        label: 'Cord',
        selection: 'single',
        defaultValue: ['long'],
        options: [
          { id: 'short', label: 'Short', hint: 'Shade sits close to ceiling' },
          { id: 'long', label: 'Long', hint: 'Drops deeper into frame' },
          { id: 'off-frame', label: 'Off Frame', hint: 'Cord exits above frame' },
        ],
      },
    ],
  },
  {
    id: 'headlight-glare',
    title: 'Headlight Glare',
    category: 'Environment',
    description: 'Use the ellipse as paired headlights with bloom and low wet-road kickback.',
    learningFocus: 'Great for backlight beats, atmosphere, and selling a wet road with one simple shape family.',
    accentColor: '#f8fafc',
    parameters: [
      {
        id: 'pair',
        label: 'Lights',
        selection: 'single',
        defaultValue: ['pair'],
        options: [
          { id: 'single', label: 'Single', hint: 'One isolated source' },
          { id: 'pair', label: 'Pair', hint: 'Balanced car headlight read' },
          { id: 'offset', label: 'Offset', hint: 'Slightly uneven pair' },
        ],
      },
      {
        id: 'bloom',
        label: 'Bloom',
        selection: 'single',
        defaultValue: ['hot'],
        options: [
          { id: 'soft', label: 'Soft', hint: 'Subtle distant glow' },
          { id: 'hot', label: 'Hot', hint: 'Strong visible headlights' },
          { id: 'blown', label: 'Blown', hint: 'Very bright glare burst' },
        ],
      },
      {
        id: 'spread',
        label: 'Spread',
        selection: 'single',
        defaultValue: ['road'],
        options: [
          { id: 'tight', label: 'Tight', hint: 'Compact glare shape' },
          { id: 'road', label: 'Road', hint: 'Adds wet kickback streaks' },
          { id: 'wide', label: 'Wide', hint: 'Foggy blown halo' },
        ],
      },
    ],
  },
];

const rectangleSuggestions: ShapeIntentSuggestion[] = [
  {
    id: 'alley-wall',
    title: 'Alley Wall',
    category: 'Environment',
    description: 'Turn the box into a receding alley facade with sparse windows and a hard vertical perspective plane.',
    learningFocus: 'Useful for street compression, framing a corridor, and keeping noir city walls readable.',
    accentColor: '#94a3b8',
    parameters: [
      {
        id: 'side',
        label: 'Side',
        selection: 'single',
        defaultValue: ['left'],
        options: [
          { id: 'left', label: 'Left', hint: 'Plane leans away on left side' },
          { id: 'right', label: 'Right', hint: 'Plane leans away on right side' },
          { id: 'deep', label: 'Deep', hint: 'More dramatic corridor taper' },
        ],
      },
      {
        id: 'windows',
        label: 'Windows',
        selection: 'single',
        defaultValue: ['sparse'],
        options: [
          { id: 'dark', label: 'Dark', hint: 'Mostly unlit facade' },
          { id: 'sparse', label: 'Sparse', hint: 'A few hot openings' },
          { id: 'hot', label: 'Hot', hint: 'More active lit windows' },
        ],
      },
      {
        id: 'depth',
        label: 'Depth',
        selection: 'single',
        defaultValue: ['deep'],
        options: [
          { id: 'shallow', label: 'Shallow', hint: 'Less perspective taper' },
          { id: 'deep', label: 'Deep', hint: 'Stronger corridor read' },
          { id: 'hero', label: 'Hero', hint: 'Bigger looming wall mass' },
        ],
      },
    ],
  },
  {
    id: 'window',
    title: 'Window',
    category: 'Environment',
    description: 'Build a readable window frame with pane divisions and frame depth.',
    learningFocus: 'Good for perspective boxes, frame thickness, and negative space.',
    accentColor: '#38bdf8',
    parameters: [
      {
        id: 'frame',
        label: 'Frame',
        selection: 'single',
        defaultValue: ['standard'],
        options: [
          { id: 'thin', label: 'Thin', hint: 'Delicate pane lines' },
          { id: 'standard', label: 'Standard', hint: 'Balanced window frame' },
          { id: 'thick', label: 'Thick', hint: 'Chunky architectural frame' },
        ],
      },
      {
        id: 'panes',
        label: 'Panes',
        selection: 'single',
        defaultValue: ['cross'],
        options: [
          { id: 'single', label: 'Single', hint: 'No muntin split' },
          { id: 'cross', label: 'Cross', hint: 'Four-panel read' },
          { id: 'grid', label: 'Grid', hint: 'Denser pane cadence' },
        ],
      },
      {
        id: 'sill',
        label: 'Sill',
        selection: 'single',
        defaultValue: ['with-sill'],
        options: [
          { id: 'with-sill', label: 'With Sill', hint: 'Add lower sill line' },
          { id: 'flush', label: 'Flush', hint: 'Simple frame only' },
        ],
      },
    ],
  },
  {
    id: 'warehouse-window-bank',
    title: 'Warehouse Window Bank',
    category: 'Environment',
    description: 'Turn the box into a high industrial window bank with blown panes and a hard top-light source.',
    learningFocus: 'Useful for staging noir interiors, top light, and strong negative-space architecture.',
    accentColor: '#e2e8f0',
    parameters: [
      {
        id: 'panes',
        label: 'Pane Rhythm',
        selection: 'single',
        defaultValue: ['factory'],
        options: [
          { id: 'cross', label: 'Cross', hint: 'Simple four-pane split' },
          { id: 'factory', label: 'Factory', hint: 'Tall industrial pane rhythm' },
          { id: 'dense', label: 'Dense', hint: 'More crowded upper grid' },
        ],
      },
      {
        id: 'glow',
        label: 'Glow',
        selection: 'single',
        defaultValue: ['blown'],
        options: [
          { id: 'low', label: 'Low', hint: 'Muted dirty light' },
          { id: 'hazy', label: 'Hazy', hint: 'Soft atmospheric bloom' },
          { id: 'blown', label: 'Blown', hint: 'High-contrast blown panes' },
        ],
      },
      {
        id: 'damage',
        label: 'Wear',
        selection: 'single',
        defaultValue: ['broken'],
        options: [
          { id: 'clean', label: 'Clean', hint: 'Regular intact panes' },
          { id: 'broken', label: 'Broken', hint: 'Uneven damaged sections' },
          { id: 'barred', label: 'Barred', hint: 'Heavier industrial bars' },
        ],
      },
    ],
  },
  {
    id: 'crate-stack',
    title: 'Crate Stack',
    category: 'Prop',
    description: 'Use the box as stacked storage crates or debris blocks for foreground massing.',
    learningFocus: 'Great for foreground framing, perspective overlap, and gritty production texture.',
    accentColor: '#c08457',
    parameters: [
      {
        id: 'stack',
        label: 'Stack Height',
        selection: 'single',
        defaultValue: ['double'],
        options: [
          { id: 'single', label: 'Single', hint: 'One grounded crate' },
          { id: 'double', label: 'Double', hint: 'Balanced stack with overlap' },
          { id: 'pile', label: 'Pile', hint: 'Messier broken stack' },
        ],
      },
      {
        id: 'damage',
        label: 'Damage',
        selection: 'single',
        defaultValue: ['wet'],
        options: [
          { id: 'clean', label: 'Clean', hint: 'Sharper edges and intact planks' },
          { id: 'wet', label: 'Wet', hint: 'Darkened soaked box faces' },
          { id: 'broken', label: 'Broken', hint: 'Split lids and chipped corners' },
        ],
      },
      {
        id: 'perspective',
        label: 'Perspective',
        selection: 'single',
        defaultValue: ['three-quarter'],
        options: [
          { id: 'front', label: 'Front', hint: 'Flatter board read' },
          { id: 'three-quarter', label: '3/4', hint: 'Best for stage blocking' },
          { id: 'hero', label: 'Hero Low', hint: 'Larger looming foreground block' },
        ],
      },
    ],
  },
  {
    id: 'conifer-wall',
    title: 'Conifer Wall',
    category: 'Environment',
    description: 'Turn the box into a dense wall of tall conifers for valley framing, forest pressure, and scale contrast.',
    learningFocus: 'Useful for creature boards where repeated vertical tree rhythm sells distance and makes scale legible.',
    accentColor: '#86efac',
    parameters: [
      {
        id: 'density',
        label: 'Density',
        selection: 'single',
        defaultValue: ['dense'],
        options: [
          { id: 'open', label: 'Open', hint: 'More air between tree silhouettes' },
          { id: 'dense', label: 'Dense', hint: 'Crowded forest-wall read' },
          { id: 'crush', label: 'Crush', hint: 'Very tight packed conifers' },
        ],
      },
      {
        id: 'slope',
        label: 'Slope',
        selection: 'single',
        defaultValue: ['rise'],
        options: [
          { id: 'flat', label: 'Flat', hint: 'More level tree line' },
          { id: 'rise', label: 'Rise', hint: 'Lifts uphill through frame' },
          { id: 'drop', label: 'Drop', hint: 'Falls away into valley' },
        ],
      },
      {
        id: 'breaks',
        label: 'Breaks',
        selection: 'single',
        defaultValue: ['scarred'],
        options: [
          { id: 'clean', label: 'Clean', hint: 'Mostly intact treeline' },
          { id: 'scarred', label: 'Scarred', hint: 'Adds stormfall and cut gaps' },
          { id: 'blasted', label: 'Blasted', hint: 'Harder broken clearings' },
        ],
      },
    ],
  },
  {
    id: 'armored-vehicle',
    title: 'Armored Vehicle',
    category: 'Vehicle',
    description: 'Turn the box into a compact tracked armor block with turret, hull angle, and tread mass.',
    learningFocus: 'Useful for military scale, foreground tech silhouettes, and creature-versus-convoy staging.',
    accentColor: '#d6d3d1',
    parameters: [
      {
        id: 'body',
        label: 'Body',
        selection: 'single',
        defaultValue: ['tank'],
        options: [
          { id: 'tank', label: 'Tank', hint: 'Heavy tracked hull and turret' },
          { id: 'carrier', label: 'Carrier', hint: 'Lower troop-carrier silhouette' },
          { id: 'self-propelled', label: 'SPG', hint: 'Longer artillery profile' },
        ],
      },
      {
        id: 'turret',
        label: 'Turret',
        selection: 'single',
        defaultValue: ['forward'],
        options: [
          { id: 'none', label: 'None', hint: 'Hull-only carrier read' },
          { id: 'forward', label: 'Forward', hint: 'Classic attack stance' },
          { id: 'elevated', label: 'Elevated', hint: 'Gun points upward into frame' },
        ],
      },
      {
        id: 'view',
        label: 'View',
        selection: 'single',
        defaultValue: ['three-quarter'],
        options: [
          { id: 'profile', label: 'Profile', hint: 'Flatter side read' },
          { id: 'three-quarter', label: '3/4', hint: 'Best for board scale and depth' },
          { id: 'hero', label: 'Hero', hint: 'Heavier looming foreground armor' },
        ],
      },
    ],
  },
  {
    id: 'fire-escape',
    title: 'Fire Escape',
    category: 'Environment',
    description: 'Use the box as stacked landings and stairs that silhouette against a dark facade.',
    learningFocus: 'Useful for layered noir architecture, vertical rhythm, and readable exterior detail.',
    accentColor: '#cbd5e1',
    parameters: [
      {
        id: 'flights',
        label: 'Flights',
        selection: 'single',
        defaultValue: ['stacked'],
        options: [
          { id: 'single', label: 'Single', hint: 'One landing and stair run' },
          { id: 'stacked', label: 'Stacked', hint: 'Two-to-three fire-escape levels' },
          { id: 'tall', label: 'Tall', hint: 'Longer vertical run' },
        ],
      },
      {
        id: 'stairs',
        label: 'Stairs',
        selection: 'single',
        defaultValue: ['zigzag'],
        options: [
          { id: 'straight', label: 'Straight', hint: 'Cleaner angled run' },
          { id: 'zigzag', label: 'Zigzag', hint: 'Classic alternating landings' },
          { id: 'dense', label: 'Dense', hint: 'More cluttered stair rhythm' },
        ],
      },
      {
        id: 'landing',
        label: 'Landing',
        selection: 'single',
        defaultValue: ['cage'],
        options: [
          { id: 'narrow', label: 'Narrow', hint: 'Tighter platforms' },
          { id: 'wide', label: 'Wide', hint: 'Broader balcony landings' },
          { id: 'cage', label: 'Cage', hint: 'Railed industrial feel' },
        ],
      },
    ],
  },
  {
    id: 'dumpster-bank',
    title: 'Dumpster Bank',
    category: 'Prop',
    description: 'Turn the box into one or more alley dumpsters with lid rhythm and wet edge highlights.',
    learningFocus: 'Good for foreground clutter, grounded street texture, and blocking a gritty alley.',
    accentColor: '#84cc16',
    parameters: [
      {
        id: 'count',
        label: 'Count',
        selection: 'single',
        defaultValue: ['double'],
        options: [
          { id: 'single', label: 'Single', hint: 'One dominant container' },
          { id: 'double', label: 'Double', hint: 'Two readable bins' },
          { id: 'row', label: 'Row', hint: 'Three or more repeated bins' },
        ],
      },
      {
        id: 'lid',
        label: 'Lid',
        selection: 'single',
        defaultValue: ['shut'],
        options: [
          { id: 'shut', label: 'Shut', hint: 'Cleaner box silhouette' },
          { id: 'open', label: 'Open', hint: 'One raised lid angle' },
          { id: 'mixed', label: 'Mixed', hint: 'Varied lid positions' },
        ],
      },
      {
        id: 'wear',
        label: 'Wear',
        selection: 'single',
        defaultValue: ['wet'],
        options: [
          { id: 'clean', label: 'Clean', hint: 'Sharper edge read' },
          { id: 'wet', label: 'Wet', hint: 'Glossy rain hit on lids' },
          { id: 'beat', label: 'Beat', hint: 'More damaged noisy edges' },
        ],
      },
    ],
  },
  {
    id: 'skyline-cluster',
    title: 'Skyline Cluster',
    category: 'Environment',
    description: 'Turn the box into a layered skyline mass with stepped rooftops, lit windows, and hero towers.',
    learningFocus: 'Useful for noir city staging, value grouping, and building a readable background without over-drawing.',
    accentColor: '#dbeafe',
    parameters: [
      {
        id: 'density',
        label: 'Density',
        selection: 'single',
        defaultValue: ['mid'],
        options: [
          { id: 'open', label: 'Open', hint: 'More breathing room between towers' },
          { id: 'mid', label: 'Mid', hint: 'Balanced skyline pack' },
          { id: 'dense', label: 'Dense', hint: 'Crowded city-wall read' },
        ],
      },
      {
        id: 'glow',
        label: 'Window Glow',
        selection: 'single',
        defaultValue: ['grid'],
        options: [
          { id: 'sparse', label: 'Sparse', hint: 'Scattered isolated windows' },
          { id: 'grid', label: 'Grid', hint: 'Readable lit rhythm' },
          { id: 'blown', label: 'Blown', hint: 'Hot skyline highlights' },
        ],
      },
      {
        id: 'silhouette',
        label: 'Silhouette',
        selection: 'single',
        defaultValue: ['stepped'],
        options: [
          { id: 'flat', label: 'Flat', hint: 'More blocky roofline' },
          { id: 'stepped', label: 'Stepped', hint: 'Varying tower cadence' },
          { id: 'spires', label: 'Spires', hint: 'Adds taller hero peaks' },
        ],
      },
    ],
  },
  {
    id: 'rooftop-parapet',
    title: 'Rooftop Parapet',
    category: 'Environment',
    description: 'Use the box as a rooftop edge with a heavy parapet lip and wet foreground plane.',
    learningFocus: 'Great for foreground framing, depth, and selling a rooftop ledge in a cinematic board.',
    accentColor: '#cbd5e1',
    parameters: [
      {
        id: 'edge',
        label: 'Edge Weight',
        selection: 'single',
        defaultValue: ['heavy'],
        options: [
          { id: 'thin', label: 'Thin', hint: 'Light ledge profile' },
          { id: 'standard', label: 'Standard', hint: 'Balanced rooftop wall' },
          { id: 'heavy', label: 'Heavy', hint: 'Chunky noir foreground lip' },
        ],
      },
      {
        id: 'angle',
        label: 'Angle',
        selection: 'single',
        defaultValue: ['hero'],
        options: [
          { id: 'flat', label: 'Flat', hint: 'Straight horizontal roof edge' },
          { id: 'hero', label: 'Hero', hint: 'Bold diagonal corner read' },
          { id: 'diagonal', label: 'Diagonal', hint: 'Sharper oblique perspective' },
        ],
      },
      {
        id: 'surface',
        label: 'Surface',
        selection: 'single',
        defaultValue: ['mirror'],
        options: [
          { id: 'dry', label: 'Dry', hint: 'Matte rooftop plane' },
          { id: 'wet', label: 'Wet', hint: 'Glossy surface breaks' },
          { id: 'mirror', label: 'Mirror', hint: 'Hard reflected edge light' },
        ],
      },
    ],
  },
  {
    id: 'water-tower',
    title: 'Water Tower',
    category: 'Environment',
    description: 'Turn the box into a rooftop water tower with tank shape, legs, and catwalk rhythm.',
    learningFocus: 'Useful for iconic skyline silhouettes and layered rooftop staging.',
    accentColor: '#94a3b8',
    parameters: [
      {
        id: 'tank',
        label: 'Tank',
        selection: 'single',
        defaultValue: ['riveted'],
        options: [
          { id: 'cylindrical', label: 'Cylindrical', hint: 'Clean tower silhouette' },
          { id: 'riveted', label: 'Riveted', hint: 'Industrial banded tank' },
          { id: 'squat', label: 'Squat', hint: 'Shorter heavier tank' },
        ],
      },
      {
        id: 'legs',
        label: 'Legs',
        selection: 'single',
        defaultValue: ['braced'],
        options: [
          { id: 'open', label: 'Open', hint: 'Cleaner leg spacing' },
          { id: 'braced', label: 'Braced', hint: 'Cross-braced support frame' },
          { id: 'heavy', label: 'Heavy', hint: 'Chunkier industrial support' },
        ],
      },
      {
        id: 'catwalk',
        label: 'Catwalk',
        selection: 'single',
        defaultValue: ['ring'],
        options: [
          { id: 'none', label: 'None', hint: 'Pure tower silhouette' },
          { id: 'ring', label: 'Ring', hint: 'Circular access platform' },
          { id: 'offset', label: 'Offset', hint: 'One-sided maintenance deck' },
        ],
      },
    ],
  },
  {
    id: 'doorway-frame',
    title: 'Doorway Frame',
    category: 'Environment',
    description: 'Use the box as a doorway threshold with open door swing and backlit or fogged air.',
    learningFocus: 'Useful for silhouette reveals, threshold staging, and simple hard-light framing.',
    accentColor: '#e5e7eb',
    parameters: [
      {
        id: 'opening',
        label: 'Opening',
        selection: 'single',
        defaultValue: ['open'],
        options: [
          { id: 'void', label: 'Void', hint: 'Empty dark opening' },
          { id: 'ajar', label: 'Ajar', hint: 'Slightly opened door' },
          { id: 'open', label: 'Open', hint: 'Wide hero threshold' },
        ],
      },
      {
        id: 'light',
        label: 'Light',
        selection: 'single',
        defaultValue: ['fogged'],
        options: [
          { id: 'dark', label: 'Dark', hint: 'Mostly silhouette only' },
          { id: 'backlit', label: 'Backlit', hint: 'Hard brighter doorway' },
          { id: 'fogged', label: 'Fogged', hint: 'Soft smoky threshold' },
        ],
      },
      {
        id: 'frame',
        label: 'Frame',
        selection: 'single',
        defaultValue: ['standard'],
        options: [
          { id: 'standard', label: 'Standard', hint: 'Balanced room-door read' },
          { id: 'thick', label: 'Thick', hint: 'Heavier noir frame' },
          { id: 'industrial', label: 'Industrial', hint: 'Chunkier hard-edged jamb' },
        ],
      },
    ],
  },
  {
    id: 'interrogation-table',
    title: 'Interrogation Table',
    category: 'Furniture',
    description: 'Turn the box into a stark table block with top plane, legs, and optional ashtray or file props.',
    learningFocus: 'Useful for interrogation staging, table perspective, and prop beats in a simple room.',
    accentColor: '#f3f4f6',
    parameters: [
      {
        id: 'top',
        label: 'Top',
        selection: 'single',
        defaultValue: ['heavy'],
        options: [
          { id: 'slim', label: 'Slim', hint: 'Lighter table slab' },
          { id: 'standard', label: 'Standard', hint: 'Balanced desk thickness' },
          { id: 'heavy', label: 'Heavy', hint: 'Chunkier noir table mass' },
        ],
      },
      {
        id: 'view',
        label: 'View',
        selection: 'single',
        defaultValue: ['hero'],
        options: [
          { id: 'profile', label: 'Profile', hint: 'More side-on plane' },
          { id: 'three-quarter', label: '3/4', hint: 'Balanced room read' },
          { id: 'hero', label: 'Hero', hint: 'Strong diagonal tabletop' },
        ],
      },
      {
        id: 'props',
        label: 'Props',
        selection: 'single',
        defaultValue: ['ashtray'],
        options: [
          { id: 'bare', label: 'Bare', hint: 'Just the table silhouette' },
          { id: 'ashtray', label: 'Ashtray', hint: 'Ashtray and one small prop' },
          { id: 'files', label: 'Files', hint: 'Paper/file blocks on table' },
        ],
      },
    ],
  },
  {
    id: 'train-car-side',
    title: 'Train Car Side',
    category: 'Environment',
    description: 'Turn the box into a rain-soaked train carriage flank with window rhythm, metal seams, and platform-side glare.',
    learningFocus: 'Useful for platform chase staging, long perspective planes, and reflective transit surfaces in noir scenes.',
    accentColor: '#dbe4f0',
    parameters: [
      {
        id: 'side',
        label: 'Side Read',
        selection: 'single',
        defaultValue: ['door-side'],
        options: [
          { id: 'profile', label: 'Profile', hint: 'Flatter side view with balanced windows' },
          { id: 'door-side', label: 'Door Side', hint: 'Leaves space for a boarding doorway beat' },
          { id: 'speed', label: 'Speed', hint: 'Adds harder motion rhythm on the panel' },
        ],
      },
      {
        id: 'windows',
        label: 'Windows',
        selection: 'single',
        defaultValue: ['commuter'],
        options: [
          { id: 'sparse', label: 'Sparse', hint: 'Fewer larger windows' },
          { id: 'commuter', label: 'Commuter', hint: 'Regular carriage rhythm' },
          { id: 'lit', label: 'Lit', hint: 'Hotter blown window frames' },
        ],
      },
      {
        id: 'stripe',
        label: 'Stripe',
        selection: 'single',
        defaultValue: ['double'],
        options: [
          { id: 'none', label: 'None', hint: 'Pure carriage metal read' },
          { id: 'single', label: 'Single', hint: 'One guiding body stripe' },
          { id: 'double', label: 'Double', hint: 'Classic twin rail line' },
        ],
      },
    ],
  },
  {
    id: 'carriage-door',
    title: 'Carriage Door',
    category: 'Environment',
    description: 'Use the box as a train door frame with lit interior, doorway swing, and boarding threshold.',
    learningFocus: 'Useful for action beats where one doorway carries the whole focal decision.',
    accentColor: '#f8fafc',
    parameters: [
      {
        id: 'opening',
        label: 'Opening',
        selection: 'single',
        defaultValue: ['open'],
        options: [
          { id: 'closed', label: 'Closed', hint: 'Sealed carriage door' },
          { id: 'mid', label: 'Mid', hint: 'Partially open sliding door' },
          { id: 'open', label: 'Open', hint: 'Wide hero boarding aperture' },
        ],
      },
      {
        id: 'light',
        label: 'Interior Light',
        selection: 'single',
        defaultValue: ['blown'],
        options: [
          { id: 'dark', label: 'Dark', hint: 'Mostly silhouette-only doorway' },
          { id: 'lit', label: 'Lit', hint: 'Readable carriage interior glow' },
          { id: 'blown', label: 'Blown', hint: 'Very hot doorway highlight' },
        ],
      },
      {
        id: 'handle',
        label: 'Handle',
        selection: 'single',
        defaultValue: ['rail'],
        options: [
          { id: 'none', label: 'None', hint: 'Pure frame silhouette' },
          { id: 'bar', label: 'Bar', hint: 'Simple door pull' },
          { id: 'rail', label: 'Rail', hint: 'Vertical boarding rail' },
        ],
      },
    ],
  },
  {
    id: 'door',
    title: 'Door',
    category: 'Environment',
    description: 'Use the box as a door block with paneling and handle placement.',
    learningFocus: 'Teaches proportion, panel rhythm, and handle placement.',
    accentColor: '#fb7185',
    parameters: [
      {
        id: 'style',
        label: 'Door Style',
        selection: 'single',
        defaultValue: ['panel'],
        options: [
          { id: 'panel', label: 'Panel', hint: 'Classic inset panels' },
          { id: 'flush', label: 'Flush', hint: 'Flat contemporary slab' },
          { id: 'double', label: 'Double', hint: 'Split center doors' },
        ],
      },
      {
        id: 'handle',
        label: 'Handle',
        selection: 'single',
        defaultValue: ['knob'],
        options: [
          { id: 'knob', label: 'Knob', hint: 'Round handle' },
          { id: 'lever', label: 'Lever', hint: 'Horizontal handle' },
          { id: 'bar', label: 'Bar', hint: 'Long vertical pull' },
        ],
      },
      {
        id: 'frame',
        label: 'Frame Thickness',
        selection: 'single',
        defaultValue: ['standard'],
        options: [
          { id: 'thin', label: 'Thin', hint: 'Tight edge reveal' },
          { id: 'standard', label: 'Standard', hint: 'Balanced jamb' },
          { id: 'thick', label: 'Thick', hint: 'Chunky doorway' },
        ],
      },
    ],
  },
  {
    id: 'monitor',
    title: 'Monitor',
    category: 'Prop',
    description: 'Turn the rectangle into a screen with bezel and stand choices.',
    learningFocus: 'Useful for modern prop design and clean tech silhouettes.',
    accentColor: '#a78bfa',
    parameters: [
      {
        id: 'bezel',
        label: 'Bezel',
        selection: 'single',
        defaultValue: ['thin'],
        options: [
          { id: 'thin', label: 'Thin', hint: 'Contemporary screen edge' },
          { id: 'standard', label: 'Standard', hint: 'Visible bezel frame' },
          { id: 'chunky', label: 'Chunky', hint: 'Older monitor style' },
        ],
      },
      {
        id: 'stand',
        label: 'Stand',
        selection: 'single',
        defaultValue: ['pedestal'],
        options: [
          { id: 'pedestal', label: 'Pedestal', hint: 'Single center stand' },
          { id: 'arms', label: 'Arms', hint: 'Two angled support legs' },
          { id: 'wall', label: 'Wall Mount', hint: 'No desk stand' },
        ],
      },
      {
        id: 'screen',
        label: 'Screen View',
        selection: 'single',
        defaultValue: ['blank'],
        options: [
          { id: 'blank', label: 'Blank', hint: 'Pure prop silhouette' },
          { id: 'ui', label: 'UI', hint: 'Simple interface boxes' },
          { id: 'video', label: 'Video', hint: 'Framed video screen' },
        ],
      },
    ],
  },
  {
    id: 'sign-board',
    title: 'Sign Board',
    category: 'Environment',
    description: 'Use the rectangle as signage, placard, or hanging board.',
    learningFocus: 'Teaches graphic framing and text hierarchy inside a box.',
    accentColor: '#f59e0b',
    parameters: [
      {
        id: 'mount',
        label: 'Mount',
        selection: 'single',
        defaultValue: ['posts'],
        options: [
          { id: 'posts', label: 'Posts', hint: 'Street sign with supports' },
          { id: 'hang', label: 'Hang', hint: 'Suspended sign' },
          { id: 'easel', label: 'Easel', hint: 'Sidewalk board' },
        ],
      },
      {
        id: 'shape',
        label: 'Corners',
        selection: 'single',
        defaultValue: ['square'],
        options: [
          { id: 'square', label: 'Square', hint: 'Hard corner edges' },
          { id: 'rounded', label: 'Rounded', hint: 'Soft consumer sign' },
          { id: 'banner', label: 'Banner', hint: 'Slight hanging sag' },
        ],
      },
      {
        id: 'copy',
        label: 'Copy Layout',
        selection: 'single',
        defaultValue: ['title'],
        options: [
          { id: 'title', label: 'Title', hint: 'One strong heading' },
          { id: 'stacked', label: 'Stacked', hint: 'Two-line layout' },
          { id: 'icon', label: 'Icon + Text', hint: 'Symbol plus copy' },
        ],
      },
    ],
  },
  {
    id: 'phone',
    title: 'Phone Screen',
    category: 'Prop',
    description: 'Convert the box into a phone body with screen and camera cutouts.',
    learningFocus: 'Useful for handheld prop boards and inset device shots.',
    accentColor: '#14b8a6',
    parameters: [
      {
        id: 'body',
        label: 'Body Style',
        selection: 'single',
        defaultValue: ['rounded'],
        options: [
          { id: 'rounded', label: 'Rounded', hint: 'Soft modern corners' },
          { id: 'slab', label: 'Slab', hint: 'Hard industrial silhouette' },
          { id: 'fold', label: 'Folded', hint: 'Two-part foldable feel' },
        ],
      },
      {
        id: 'camera',
        label: 'Camera',
        selection: 'single',
        defaultValue: ['single'],
        options: [
          { id: 'single', label: 'Single', hint: 'One lens cluster' },
          { id: 'triple', label: 'Triple', hint: 'Three-lens back block' },
          { id: 'notch', label: 'Notch', hint: 'Front notch / sensor bar' },
        ],
      },
      {
        id: 'screen',
        label: 'Screen Content',
        selection: 'single',
        defaultValue: ['blank'],
        options: [
          { id: 'blank', label: 'Blank', hint: 'Construction-only screen' },
          { id: 'message', label: 'Message', hint: 'Bubble-style layout' },
          { id: 'map', label: 'Map', hint: 'Simple route blocks' },
        ],
      },
    ],
  },
  {
    id: 'chair',
    title: 'Chair',
    category: 'Furniture',
    description: 'Convert the rectangle into a readable chair seat with back and leg rhythm.',
    learningFocus: 'Useful for blocking seated scenes and keeping chair silhouettes readable in perspective.',
    accentColor: '#34d399',
    parameters: [
      {
        id: 'chair-style',
        label: 'Chair Style',
        selection: 'single',
        defaultValue: ['dining'],
        options: [
          { id: 'dining', label: 'Dining', hint: 'Classic backrest and four legs' },
          { id: 'stool', label: 'Stool', hint: 'Backless support read' },
          { id: 'lounge', label: 'Lounge', hint: 'Wider relaxed seat' },
        ],
      },
      {
        id: 'back',
        label: 'Back',
        selection: 'single',
        defaultValue: ['open'],
        options: [
          { id: 'open', label: 'Open', hint: 'Simple rails and seat gap' },
          { id: 'solid', label: 'Solid', hint: 'Filled back panel' },
          { id: 'slat', label: 'Slat', hint: 'Repeated slat rhythm' },
        ],
      },
      {
        id: 'legs',
        label: 'Legs',
        selection: 'single',
        defaultValue: ['straight'],
        options: [
          { id: 'straight', label: 'Straight', hint: 'Simple vertical legs' },
          { id: 'splayed', label: 'Splayed', hint: 'Angled stance' },
          { id: 'sled', label: 'Sled', hint: 'Continuous side support' },
        ],
      },
    ],
  },
  {
    id: 'chassis-block',
    title: 'Chassis Block',
    category: 'Vehicle',
    description: 'Turn the rectangle into a simple chassis/body block for vehicle staging.',
    learningFocus: 'Good for vehicle proportion, mass distribution, and wheel-to-body spacing.',
    accentColor: '#60a5fa',
    parameters: [
      {
        id: 'vehicle-body',
        label: 'Vehicle Body',
        selection: 'single',
        defaultValue: ['motorcycle'],
        options: [
          { id: 'motorcycle', label: 'Motorcycle', hint: 'Compact diagonal body block' },
          { id: 'buggy', label: 'Buggy', hint: 'Longer chassis and open cabin' },
          { id: 'cart', label: 'Cart', hint: 'Simple utility body' },
        ],
      },
      {
        id: 'seat',
        label: 'Seat',
        selection: 'single',
        defaultValue: ['single'],
        options: [
          { id: 'single', label: 'Single', hint: 'One rider seat' },
          { id: 'double', label: 'Double', hint: 'Longer two-person seat' },
          { id: 'cargo', label: 'Cargo', hint: 'Flat rear deck' },
        ],
      },
      {
        id: 'tail',
        label: 'Tail',
        selection: 'single',
        defaultValue: ['kick-up'],
        options: [
          { id: 'flat', label: 'Flat', hint: 'Straight low tail' },
          { id: 'kick-up', label: 'Kick Up', hint: 'Raised rear silhouette' },
          { id: 'box', label: 'Box', hint: 'Chunkier squared rear' },
        ],
      },
    ],
  },
];

const lineSuggestions: ShapeIntentSuggestion[] = [
  {
    id: 'sword',
    title: 'Sword / Blade',
    category: 'Prop',
    description: 'Turn the line into a blade with handle and guard rhythm.',
    learningFocus: 'Helps turn a gesture line into a designed prop silhouette.',
    accentColor: '#cbd5e1',
    parameters: [
      {
        id: 'blade',
        label: 'Blade Shape',
        selection: 'single',
        defaultValue: ['straight'],
        options: [
          { id: 'straight', label: 'Straight', hint: 'Classic longsword line' },
          { id: 'katana', label: 'Katana', hint: 'Gentle curve and guard' },
          { id: 'broad', label: 'Broad', hint: 'Heavier silhouette' },
        ],
      },
      {
        id: 'guard',
        label: 'Guard',
        selection: 'single',
        defaultValue: ['cross'],
        options: [
          { id: 'cross', label: 'Cross', hint: 'Traditional crossguard' },
          { id: 'round', label: 'Round', hint: 'Circular tsuba-like guard' },
          { id: 'none', label: 'None', hint: 'Minimal utility blade' },
        ],
      },
      {
        id: 'pommel',
        label: 'Pommel',
        selection: 'single',
        defaultValue: ['round'],
        options: [
          { id: 'round', label: 'Round', hint: 'Simple circular pommel' },
          { id: 'spike', label: 'Spike', hint: 'Aggressive end cap' },
          { id: 'none', label: 'None', hint: 'Tool-like handle finish' },
        ],
      },
    ],
  },
  {
    id: 'horizon-line',
    title: 'Horizon',
    category: 'Environment',
    description: 'Use the line as a horizon anchor with sun, silhouettes, or city blocks.',
    learningFocus: 'Teaches staging and how one line can establish camera height.',
    accentColor: '#f472b6',
    parameters: [
      {
        id: 'scene',
        label: 'Scene',
        selection: 'single',
        defaultValue: ['sunset'],
        options: [
          { id: 'sunset', label: 'Sunset', hint: 'Sun disk and low skyline' },
          { id: 'city', label: 'City', hint: 'Boxy skyline beats' },
          { id: 'ocean', label: 'Ocean', hint: 'Clean sea line and sun' },
        ],
      },
      {
        id: 'foreground',
        label: 'Foreground',
        selection: 'single',
        defaultValue: ['none'],
        options: [
          { id: 'none', label: 'None', hint: 'Pure horizon read' },
          { id: 'posts', label: 'Posts', hint: 'Foreground rhythm markers' },
          { id: 'rocks', label: 'Rocks', hint: 'Simple land silhouette' },
        ],
      },
      {
        id: 'camera',
        label: 'Camera Height',
        selection: 'single',
        defaultValue: ['eye'],
        options: [
          { id: 'low', label: 'Low', hint: 'Lower eye-line feeling' },
          { id: 'eye', label: 'Eye', hint: 'Neutral horizon' },
          { id: 'high', label: 'High', hint: 'Raised camera feel' },
        ],
      },
    ],
  },
  {
    id: 'boom-mic',
    title: 'Boom Mic',
    category: 'Prop',
    description: 'Shape the line into a boom pole with mic body and windscreen.',
    learningFocus: 'Useful for production-board props and line-to-object translation.',
    accentColor: '#fda4af',
    parameters: [
      {
        id: 'mic',
        label: 'Mic Type',
        selection: 'single',
        defaultValue: ['shotgun'],
        options: [
          { id: 'shotgun', label: 'Shotgun', hint: 'Long directional capsule' },
          { id: 'blimp', label: 'Blimp', hint: 'Large windscreen barrel' },
          { id: 'small', label: 'Small Mic', hint: 'Compact capsule' },
        ],
      },
      {
        id: 'pole',
        label: 'Pole',
        selection: 'single',
        defaultValue: ['extended'],
        options: [
          { id: 'compact', label: 'Compact', hint: 'Short collapsed pole' },
          { id: 'extended', label: 'Extended', hint: 'Long reach silhouette' },
          { id: 'angled', label: 'Angled', hint: 'More dynamic pole bend' },
        ],
      },
      {
        id: 'mount',
        label: 'Mount',
        selection: 'single',
        defaultValue: ['shock'],
        options: [
          { id: 'shock', label: 'Shock Mount', hint: 'Visible suspension' },
          { id: 'simple', label: 'Simple', hint: 'Straight attachment' },
        ],
      },
    ],
  },
  {
    id: 'shelf',
    title: 'Shelf',
    category: 'Furniture',
    description: 'Use the line as a shelf top with bracket or hanging supports.',
    learningFocus: 'Good for construction lines and environmental staging props.',
    accentColor: '#34d399',
    parameters: [
      {
        id: 'support',
        label: 'Support',
        selection: 'single',
        defaultValue: ['brackets'],
        options: [
          { id: 'brackets', label: 'Brackets', hint: 'Two angled supports' },
          { id: 'ropes', label: 'Ropes', hint: 'Hanging shelf' },
          { id: 'hidden', label: 'Hidden', hint: 'Floating shelf' },
        ],
      },
      {
        id: 'thickness',
        label: 'Thickness',
        selection: 'single',
        defaultValue: ['standard'],
        options: [
          { id: 'thin', label: 'Thin', hint: 'Light board' },
          { id: 'standard', label: 'Standard', hint: 'Balanced plank' },
          { id: 'chunky', label: 'Chunky', hint: 'Heavy shelf slab' },
        ],
      },
      {
        id: 'props',
        label: 'Shelf Props',
        selection: 'single',
        defaultValue: ['books'],
        options: [
          { id: 'books', label: 'Books', hint: 'Vertical block rhythm' },
          { id: 'plants', label: 'Plants', hint: 'Leaf clusters' },
          { id: 'empty', label: 'Empty', hint: 'Construction only' },
        ],
      },
    ],
  },
  {
    id: 'lane-marking',
    title: 'Road Lane',
    category: 'Environment',
    description: 'Turn the line into a roadway lane mark with converging road edges.',
    learningFocus: 'Helps convert gestures into perspective staging cues.',
    accentColor: '#fde047',
    parameters: [
      {
        id: 'road',
        label: 'Road Type',
        selection: 'single',
        defaultValue: ['street'],
        options: [
          { id: 'street', label: 'Street', hint: 'Neutral city road' },
          { id: 'highway', label: 'Highway', hint: 'Wider edges and dashes' },
          { id: 'alley', label: 'Alley', hint: 'Narrow compressed lane' },
        ],
      },
      {
        id: 'marking',
        label: 'Marking',
        selection: 'single',
        defaultValue: ['dashed'],
        options: [
          { id: 'solid', label: 'Solid', hint: 'Single road stripe' },
          { id: 'dashed', label: 'Dashed', hint: 'Broken lane rhythm' },
          { id: 'double', label: 'Double', hint: 'Two parallel stripes' },
        ],
      },
      {
        id: 'camera',
        label: 'Camera',
        selection: 'single',
        defaultValue: ['push'],
        options: [
          { id: 'push', label: 'Push In', hint: 'Centered forward feel' },
          { id: 'diagonal', label: 'Diagonal', hint: 'Oblique staging' },
          { id: 'top', label: 'Top', hint: 'Flattened design read' },
        ],
      },
    ],
  },
  {
    id: 'light-beam',
    title: 'Light Beam',
    category: 'Environment',
    description: 'Turn the line into a hard volumetric beam cutting through dust, smoke, or rain.',
    learningFocus: 'Useful for noir lighting, eye-direction control, and staging the brightest read in frame.',
    accentColor: '#f8fafc',
    parameters: [
      {
        id: 'spread',
        label: 'Spread',
        selection: 'single',
        defaultValue: ['medium'],
        options: [
          { id: 'narrow', label: 'Narrow', hint: 'Sharper spotlight cone' },
          { id: 'medium', label: 'Medium', hint: 'Balanced god-ray spread' },
          { id: 'wide', label: 'Wide', hint: 'Broader blown light fan' },
        ],
      },
      {
        id: 'intensity',
        label: 'Intensity',
        selection: 'single',
        defaultValue: ['hot'],
        options: [
          { id: 'soft', label: 'Soft', hint: 'Subtle glow edge' },
          { id: 'hot', label: 'Hot', hint: 'High-value beam core' },
          { id: 'blown', label: 'Blown', hint: 'Very bright white center' },
        ],
      },
      {
        id: 'angle',
        label: 'Angle',
        selection: 'single',
        defaultValue: ['diagonal'],
        options: [
          { id: 'vertical', label: 'Vertical', hint: 'Drops straight down' },
          { id: 'diagonal', label: 'Diagonal', hint: 'Cuts across frame' },
          { id: 'cross', label: 'Cross', hint: 'Two beams crossing' },
        ],
      },
    ],
  },
  {
    id: 'platform-light-run',
    title: 'Platform Light Run',
    category: 'Environment',
    description: 'Turn the line into a receding row of platform practicals that drives the eye into a train chase frame.',
    learningFocus: 'Useful for forcing perspective, pacing a long platform, and selling wet-night transit geometry.',
    accentColor: '#f8fafc',
    parameters: [
      {
        id: 'spacing',
        label: 'Spacing',
        selection: 'single',
        defaultValue: ['run'],
        options: [
          { id: 'tight', label: 'Tight', hint: 'Closer repeated fixtures' },
          { id: 'run', label: 'Run', hint: 'Balanced platform light cadence' },
          { id: 'hero', label: 'Hero', hint: 'Longer spacing with stronger recession' },
        ],
      },
      {
        id: 'bloom',
        label: 'Bloom',
        selection: 'single',
        defaultValue: ['hot'],
        options: [
          { id: 'soft', label: 'Soft', hint: 'More controlled practical glow' },
          { id: 'hot', label: 'Hot', hint: 'Strong platform practicals' },
          { id: 'blown', label: 'Blown', hint: 'Hard white chase-light read' },
        ],
      },
      {
        id: 'perspective',
        label: 'Perspective',
        selection: 'single',
        defaultValue: ['vanish'],
        options: [
          { id: 'vanish', label: 'Vanish', hint: 'Long disappearing platform run' },
          { id: 'drop', label: 'Drop', hint: 'More top-down light fall' },
          { id: 'diagonal', label: 'Diagonal', hint: 'Sharper skew across frame' },
        ],
      },
    ],
  },
  {
    id: 'helicopter-silhouette',
    title: 'Helicopter Silhouette',
    category: 'Vehicle',
    description: 'Turn the line into a simple helicopter read with rotor sweep and tail boom.',
    learningFocus: 'Useful for air-support beats and quick aerial scale cues in creature boards.',
    accentColor: '#e5e7eb',
    parameters: [
      {
        id: 'body',
        label: 'Body',
        selection: 'single',
        defaultValue: ['scout'],
        options: [
          { id: 'scout', label: 'Scout', hint: 'Compact utility helicopter read' },
          { id: 'transport', label: 'Transport', hint: 'Longer cabin and tail' },
          { id: 'gunship', label: 'Gunship', hint: 'More aggressive nose silhouette' },
        ],
      },
      {
        id: 'bank',
        label: 'Bank',
        selection: 'single',
        defaultValue: ['rise'],
        options: [
          { id: 'level', label: 'Level', hint: 'Neutral side pass' },
          { id: 'rise', label: 'Rise', hint: 'Climbing aerial angle' },
          { id: 'dive', label: 'Dive', hint: 'More downward chase angle' },
        ],
      },
      {
        id: 'blur',
        label: 'Rotor Blur',
        selection: 'single',
        defaultValue: ['spin'],
        options: [
          { id: 'clean', label: 'Clean', hint: 'Sharper rotor silhouette' },
          { id: 'spin', label: 'Spin', hint: 'Balanced motion blur' },
          { id: 'wash', label: 'Wash', hint: 'More atmospheric rotor sweep' },
        ],
      },
    ],
  },
  {
    id: 'street-lamp-cord',
    title: 'Lamp Cord',
    category: 'Prop',
    description: 'Turn the line into a hanging lamp drop, cable, or simple overhead fixture support.',
    learningFocus: 'Useful for room-top lighting cues and dangling practicals.',
    accentColor: '#e5e7eb',
    parameters: [
      {
        id: 'drop',
        label: 'Drop',
        selection: 'single',
        defaultValue: ['long'],
        options: [
          { id: 'short', label: 'Short', hint: 'Lamp sits higher' },
          { id: 'long', label: 'Long', hint: 'Fixture drops into frame' },
          { id: 'sag', label: 'Sag', hint: 'Looser cable line' },
        ],
      },
      {
        id: 'fixture',
        label: 'Fixture',
        selection: 'single',
        defaultValue: ['simple'],
        options: [
          { id: 'simple', label: 'Simple', hint: 'Plain fixture drop' },
          { id: 'hook', label: 'Hook', hint: 'Visible hanging hook' },
          { id: 'junction', label: 'Junction', hint: 'Small top box detail' },
        ],
      },
      {
        id: 'light',
        label: 'Light',
        selection: 'single',
        defaultValue: ['hot'],
        options: [
          { id: 'off', label: 'Off', hint: 'No active light' },
          { id: 'hot', label: 'Hot', hint: 'Bright active fixture' },
          { id: 'blown', label: 'Blown', hint: 'Very bright top hit' },
        ],
      },
    ],
  },
  {
    id: 'lightning-fork',
    title: 'Lightning Fork',
    category: 'Environment',
    description: 'Turn the line into a branching lightning strike that can anchor the brightest beat in a storm frame.',
    learningFocus: 'Useful for focal hits, weather-driven contrast, and bold directional energy.',
    accentColor: '#f8fafc',
    parameters: [
      {
        id: 'spread',
        label: 'Spread',
        selection: 'single',
        defaultValue: ['forked'],
        options: [
          { id: 'tight', label: 'Tight', hint: 'Cleaner single strike' },
          { id: 'forked', label: 'Forked', hint: 'Balanced branch split' },
          { id: 'wild', label: 'Wild', hint: 'More erratic branching' },
        ],
      },
      {
        id: 'intensity',
        label: 'Intensity',
        selection: 'single',
        defaultValue: ['hot'],
        options: [
          { id: 'soft', label: 'Soft', hint: 'More distant flash read' },
          { id: 'hot', label: 'Hot', hint: 'Strong white strike' },
          { id: 'blown', label: 'Blown', hint: 'Very bright hero hit' },
        ],
      },
      {
        id: 'direction',
        label: 'Direction',
        selection: 'single',
        defaultValue: ['down'],
        options: [
          { id: 'down', label: 'Down', hint: 'Drops straight toward skyline' },
          { id: 'left', label: 'Left', hint: 'Leans left across frame' },
          { id: 'right', label: 'Right', hint: 'Leans right across frame' },
        ],
      },
    ],
  },
  {
    id: 'rain-sheet',
    title: 'Rain Sheet',
    category: 'Environment',
    description: 'Use the line as a storm-rain pass that gives the frame atmosphere and motion.',
    learningFocus: 'Good for weather texture, directional flow, and selling air between camera and subject.',
    accentColor: '#bfdbfe',
    parameters: [
      {
        id: 'density',
        label: 'Density',
        selection: 'single',
        defaultValue: ['mid'],
        options: [
          { id: 'light', label: 'Light', hint: 'Sparse streaks' },
          { id: 'mid', label: 'Mid', hint: 'Balanced rain sheet' },
          { id: 'storm', label: 'Storm', hint: 'Heavy weather curtain' },
        ],
      },
      {
        id: 'angle',
        label: 'Angle',
        selection: 'single',
        defaultValue: ['slant'],
        options: [
          { id: 'vertical', label: 'Vertical', hint: 'Drops straight down' },
          { id: 'slant', label: 'Slant', hint: 'Wind-driven diagonal rain' },
          { id: 'crosswind', label: 'Crosswind', hint: 'Stronger sideways push' },
        ],
      },
      {
        id: 'depth',
        label: 'Depth',
        selection: 'single',
        defaultValue: ['foreground'],
        options: [
          { id: 'background', label: 'Background', hint: 'Subtle far rain' },
          { id: 'mid', label: 'Mid', hint: 'Balanced spatial read' },
          { id: 'foreground', label: 'Foreground', hint: 'Large close streaks' },
        ],
      },
    ],
  },
];

const blobSuggestions: ShapeIntentSuggestion[] = [
  {
    id: 'cloud',
    title: 'Cloud',
    category: 'Environment',
    description: 'Use the blob as a cloud mass with readable lobe rhythm.',
    learningFocus: 'Builds confidence in organizing soft organic silhouettes.',
    accentColor: '#93c5fd',
    parameters: [
      {
        id: 'mass',
        label: 'Mass',
        selection: 'single',
        defaultValue: ['cumulus'],
        options: [
          { id: 'cumulus', label: 'Cumulus', hint: 'Puffy rounded lobes' },
          { id: 'storm', label: 'Storm', hint: 'Heavier flatter base' },
          { id: 'wispy', label: 'Wispy', hint: 'Looser top rhythm' },
        ],
      },
      {
        id: 'depth',
        label: 'Depth',
        selection: 'single',
        defaultValue: ['mid'],
        options: [
          { id: 'flat', label: 'Flat', hint: 'Graphic simple shape' },
          { id: 'mid', label: 'Mid', hint: 'Balanced lobe overlap' },
          { id: 'deep', label: 'Deep', hint: 'Layered cloud mass' },
        ],
      },
      {
        id: 'tail',
        label: 'Trailing Edge',
        selection: 'single',
        defaultValue: ['none'],
        options: [
          { id: 'none', label: 'None', hint: 'Compact cloud' },
          { id: 'wind', label: 'Wind Trail', hint: 'Small trailing drift' },
        ],
      },
    ],
  },
  {
    id: 'bush',
    title: 'Bush',
    category: 'Environment',
    description: 'Use the blob as a bush silhouette with grouped leaf masses.',
    learningFocus: 'Teaches organic grouping and grounding a soft silhouette.',
    accentColor: '#4ade80',
    parameters: [
      {
        id: 'shape',
        label: 'Bush Shape',
        selection: 'single',
        defaultValue: ['round'],
        options: [
          { id: 'round', label: 'Round', hint: 'Compact rounded shrub' },
          { id: 'wide', label: 'Wide', hint: 'Spreading low bush' },
          { id: 'trimmed', label: 'Trimmed', hint: 'Neater manicured form' },
        ],
      },
      {
        id: 'density',
        label: 'Leaf Density',
        selection: 'single',
        defaultValue: ['mid'],
        options: [
          { id: 'light', label: 'Light', hint: 'Airier clusters' },
          { id: 'mid', label: 'Mid', hint: 'Balanced foliage' },
          { id: 'dense', label: 'Dense', hint: 'Heavier shadow mass' },
        ],
      },
      {
        id: 'ground',
        label: 'Grounding',
        selection: 'single',
        defaultValue: ['shadow'],
        options: [
          { id: 'shadow', label: 'Shadow Base', hint: 'Dark lower grounding' },
          { id: 'trunk', label: 'Trunk Peek', hint: 'Visible stems' },
        ],
      },
    ],
  },
  {
    id: 'smoke',
    title: 'Smoke Plume',
    category: 'Environment',
    description: 'Turn the organic shape into a smoke curl with directional flow.',
    learningFocus: 'Good for gesture-to-form transitions and rhythmic tapering.',
    accentColor: '#c4b5fd',
    parameters: [
      {
        id: 'direction',
        label: 'Direction',
        selection: 'single',
        defaultValue: ['up'],
        options: [
          { id: 'up', label: 'Up', hint: 'Vertical rise' },
          { id: 'left', label: 'Left Drift', hint: 'Wind to the left' },
          { id: 'right', label: 'Right Drift', hint: 'Wind to the right' },
        ],
      },
      {
        id: 'density',
        label: 'Density',
        selection: 'single',
        defaultValue: ['mid'],
        options: [
          { id: 'light', label: 'Light', hint: 'Thin transparent smoke' },
          { id: 'mid', label: 'Mid', hint: 'Readable soft plume' },
          { id: 'dense', label: 'Dense', hint: 'Heavy smoke mass' },
        ],
      },
      {
        id: 'origin',
        label: 'Origin',
        selection: 'single',
        defaultValue: ['stack'],
        options: [
          { id: 'stack', label: 'Stack', hint: 'Straight source stem' },
          { id: 'ground', label: 'Ground', hint: 'Low rolling source' },
        ],
      },
    ],
  },
  {
    id: 'fog-bank',
    title: 'Fog Bank',
    category: 'Environment',
    description: 'Use the blob as a low atmospheric haze bank that softens silhouettes and catches light.',
    learningFocus: 'Helps stage depth layers and light shafts without over-describing background detail.',
    accentColor: '#cbd5e1',
    parameters: [
      {
        id: 'spread',
        label: 'Spread',
        selection: 'single',
        defaultValue: ['wide'],
        options: [
          { id: 'tight', label: 'Tight', hint: 'Compact low fog mass' },
          { id: 'wide', label: 'Wide', hint: 'Broad stage-filling haze' },
          { id: 'wall', label: 'Wall', hint: 'Heavier dense fog curtain' },
        ],
      },
      {
        id: 'density',
        label: 'Density',
        selection: 'single',
        defaultValue: ['mid'],
        options: [
          { id: 'light', label: 'Light', hint: 'Transparent floor mist' },
          { id: 'mid', label: 'Mid', hint: 'Readable atmospheric bank' },
          { id: 'heavy', label: 'Heavy', hint: 'Opaque low wall of haze' },
        ],
      },
      {
        id: 'edge',
        label: 'Edge',
        selection: 'single',
        defaultValue: ['soft'],
        options: [
          { id: 'soft', label: 'Soft', hint: 'Diffused soft fade' },
          { id: 'broken', label: 'Broken', hint: 'Torn drifting contour' },
          { id: 'rolling', label: 'Rolling', hint: 'More layered floor boil' },
        ],
      },
    ],
  },
  {
    id: 'city-mist',
    title: 'City Mist',
    category: 'Environment',
    description: 'Turn the blob into a mid-distance city haze bank that softens towers and catches skyline light.',
    learningFocus: 'Useful for depth compression, background separation, and atmospheric noir staging.',
    accentColor: '#e2e8f0',
    parameters: [
      {
        id: 'spread',
        label: 'Spread',
        selection: 'single',
        defaultValue: ['wide'],
        options: [
          { id: 'tight', label: 'Tight', hint: 'Compact mist pocket' },
          { id: 'wide', label: 'Wide', hint: 'Broad skyline haze' },
          { id: 'wall', label: 'Wall', hint: 'Large city fog bank' },
        ],
      },
      {
        id: 'lift',
        label: 'Lift',
        selection: 'single',
        defaultValue: ['mid'],
        options: [
          { id: 'low', label: 'Low', hint: 'Closer to roofline' },
          { id: 'mid', label: 'Mid', hint: 'Balanced skyline veil' },
          { id: 'high', label: 'High', hint: 'Raised glowing mist' },
        ],
      },
      {
        id: 'glow',
        label: 'Glow',
        selection: 'single',
        defaultValue: ['hot'],
        options: [
          { id: 'soft', label: 'Soft', hint: 'Muted bloom' },
          { id: 'hot', label: 'Hot', hint: 'Strong light catch' },
          { id: 'blown', label: 'Blown', hint: 'Very bright fog edge' },
        ],
      },
    ],
  },
  {
    id: 'seated-figure',
    title: 'Seated Figure',
    category: 'Prop',
    description: 'Turn the blob into a seated suspect or witness silhouette with head, back, and arm massing.',
    learningFocus: 'Useful for interrogation boards, table scenes, and readable seated posture under hard light.',
    accentColor: '#f8fafc',
    parameters: [
      {
        id: 'pose',
        label: 'Pose',
        selection: 'single',
        defaultValue: ['lean'],
        options: [
          { id: 'lean', label: 'Lean', hint: 'Forward tense lean' },
          { id: 'wait', label: 'Wait', hint: 'Still seated hold' },
          { id: 'collapsed', label: 'Collapsed', hint: 'More defeated posture' },
        ],
      },
      {
        id: 'facing',
        label: 'Facing',
        selection: 'single',
        defaultValue: ['left'],
        options: [
          { id: 'left', label: 'Left', hint: 'Faces left profile-ish' },
          { id: 'right', label: 'Right', hint: 'Faces right' },
          { id: 'front', label: 'Front', hint: 'More frontal seated read' },
        ],
      },
      {
        id: 'hands',
        label: 'Hands',
        selection: 'single',
        defaultValue: ['clasped'],
        options: [
          { id: 'clasped', label: 'Clasped', hint: 'Hands together near table edge' },
          { id: 'smoke', label: 'Smoke', hint: 'One hand carries cigarette beat' },
          { id: 'open', label: 'Open', hint: 'Looser hand placement' },
        ],
      },
    ],
  },
  {
    id: 'runner-figure',
    title: 'Runner Figure',
    category: 'Prop',
    description: 'Turn the blob into a fast chase silhouette with driving torso lean and motion-leg rhythm.',
    learningFocus: 'Useful for pursuit boards, boarding beats, and keeping action silhouettes readable under hard weather light.',
    accentColor: '#f8fafc',
    parameters: [
      {
        id: 'action',
        label: 'Action',
        selection: 'single',
        defaultValue: ['sprint'],
        options: [
          { id: 'sprint', label: 'Sprint', hint: 'Long pushing stride' },
          { id: 'board', label: 'Board', hint: 'Leaps into a doorway threshold' },
          { id: 'lunge', label: 'Lunge', hint: 'More compressed attack step' },
        ],
      },
      {
        id: 'facing',
        label: 'Facing',
        selection: 'single',
        defaultValue: ['right'],
        options: [
          { id: 'left', label: 'Left', hint: 'Runs toward frame left' },
          { id: 'right', label: 'Right', hint: 'Runs toward frame right' },
          { id: 'away', label: 'Away', hint: 'Runs away from camera' },
        ],
      },
      {
        id: 'blur',
        label: 'Blur',
        selection: 'single',
        defaultValue: ['motion'],
        options: [
          { id: 'clean', label: 'Clean', hint: 'Sharper silhouette edge' },
          { id: 'motion', label: 'Motion', hint: 'Adds one trailing echo' },
          { id: 'streak', label: 'Streak', hint: 'Stronger chase smear' },
        ],
      },
    ],
  },
  {
    id: 'observer-pair',
    title: 'Observer Pair',
    category: 'Prop',
    description: 'Turn the blob into two foreground witnesses or hunters crouched into the frame edge.',
    learningFocus: 'Useful for foreground framing, reaction staging, and selling scale against a distant giant.',
    accentColor: '#f8fafc',
    parameters: [
      {
        id: 'pose',
        label: 'Pose',
        selection: 'single',
        defaultValue: ['crouch'],
        options: [
          { id: 'crouch', label: 'Crouch', hint: 'Low hidden foreground watch' },
          { id: 'scramble', label: 'Scramble', hint: 'Urgent moving pair' },
          { id: 'brace', label: 'Brace', hint: 'More planted defensive read' },
        ],
      },
      {
        id: 'facing',
        label: 'Facing',
        selection: 'single',
        defaultValue: ['right'],
        options: [
          { id: 'left', label: 'Left', hint: 'Foreground pair looks left' },
          { id: 'right', label: 'Right', hint: 'Foreground pair looks right' },
          { id: 'away', label: 'Away', hint: 'Backs turned toward the spectacle' },
        ],
      },
      {
        id: 'spacing',
        label: 'Spacing',
        selection: 'single',
        defaultValue: ['tight'],
        options: [
          { id: 'tight', label: 'Tight', hint: 'Shoulders overlap closely' },
          { id: 'split', label: 'Split', hint: 'Slight separation between figures' },
          { id: 'staggered', label: 'Staggered', hint: 'One forward, one back' },
        ],
      },
    ],
  },
  {
    id: 'titan-colossus',
    title: 'Titan Colossus',
    category: 'Prop',
    description: 'Turn the blob into a huge roaring creature mass with oversized arms and a dominant forward reach.',
    learningFocus: 'Useful for scale design, readable creature silhouette, and one-beat monster staging in a single board.',
    accentColor: '#f8fafc',
    parameters: [
      {
        id: 'pose',
        label: 'Pose',
        selection: 'single',
        defaultValue: ['reach'],
        options: [
          { id: 'reach', label: 'Reach', hint: 'One arm pushes aggressively into frame' },
          { id: 'tower', label: 'Tower', hint: 'Broader looming chest-up read' },
          { id: 'rise', label: 'Rise', hint: 'Emerges upward from the valley' },
        ],
      },
      {
        id: 'roar',
        label: 'Roar',
        selection: 'single',
        defaultValue: ['open'],
        options: [
          { id: 'snarl', label: 'Snarl', hint: 'Tighter grimacing mouth' },
          { id: 'open', label: 'Open', hint: 'Wide heroic roar' },
          { id: 'bellow', label: 'Bellow', hint: 'Huge blown mouth opening' },
        ],
      },
      {
        id: 'surface',
        label: 'Surface',
        selection: 'single',
        defaultValue: ['rockhide'],
        options: [
          { id: 'fur', label: 'Fur', hint: 'Hairier creature silhouette' },
          { id: 'rockhide', label: 'Rockhide', hint: 'Craggy armored texture' },
          { id: 'spined', label: 'Spined', hint: 'Adds sharper silhouette spikes' },
        ],
      },
    ],
  },
  {
    id: 'trench-figure',
    title: 'Noir Figure',
    category: 'Prop',
    description: 'Turn the blob into a trench-coated silhouette for standoff or detective-style staging.',
    learningFocus: 'Builds strong silhouette decisions, coat massing, and stance readability under hard light.',
    accentColor: '#f8fafc',
    parameters: [
      {
        id: 'stance',
        label: 'Stance',
        selection: 'single',
        defaultValue: ['standoff'],
        options: [
          { id: 'standoff', label: 'Standoff', hint: 'Squared shoulders and planted legs' },
          { id: 'advance', label: 'Advance', hint: 'Forward lean and push' },
          { id: 'watch', label: 'Watch', hint: 'Still observational silhouette' },
          { id: 'sprint', label: 'Sprint', hint: 'Long driving trench run' },
        ],
      },
      {
        id: 'coat',
        label: 'Coat',
        selection: 'single',
        defaultValue: ['long'],
        options: [
          { id: 'short', label: 'Short', hint: 'Waist-level coat block' },
          { id: 'long', label: 'Long', hint: 'Classic trench silhouette' },
          { id: 'cape', label: 'Cape', hint: 'Broader draped outer shape' },
        ],
      },
      {
        id: 'hat',
        label: 'Hat',
        selection: 'single',
        defaultValue: ['fedora'],
        options: [
          { id: 'none', label: 'None', hint: 'Bare head silhouette' },
          { id: 'fedora', label: 'Fedora', hint: 'Hard noir hat read' },
          { id: 'hood', label: 'Hood', hint: 'Soft upper silhouette' },
        ],
      },
    ],
  },
  {
    id: 'puddle-reflection',
    title: 'Puddle Reflection',
    category: 'Environment',
    description: 'Use the blob as a wet floor puddle with reflective streaks and broken surface edges.',
    learningFocus: 'Helpful for grounding figures, carrying value shapes, and selling wet surfaces.',
    accentColor: '#93c5fd',
    parameters: [
      {
        id: 'size',
        label: 'Puddle Size',
        selection: 'single',
        defaultValue: ['wide'],
        options: [
          { id: 'tight', label: 'Tight', hint: 'Small isolated puddle' },
          { id: 'wide', label: 'Wide', hint: 'Broad reflective floor patch' },
          { id: 'pool', label: 'Pool', hint: 'Large connected wet area' },
        ],
      },
      {
        id: 'reflection',
        label: 'Reflection',
        selection: 'single',
        defaultValue: ['broken'],
        options: [
          { id: 'dim', label: 'Dim', hint: 'Muted soft reflection' },
          { id: 'broken', label: 'Broken', hint: 'Fragmented light streaks' },
          { id: 'mirror', label: 'Mirror', hint: 'Stronger hard-value read' },
        ],
      },
      {
        id: 'debris',
        label: 'Debris',
        selection: 'single',
        defaultValue: ['scatter'],
        options: [
          { id: 'none', label: 'None', hint: 'Clean water shape only' },
          { id: 'scatter', label: 'Scatter', hint: 'Broken debris around edge' },
          { id: 'heavy', label: 'Heavy', hint: 'More cluttered wet floor' },
        ],
      },
    ],
  },
  {
    id: 'speech-bubble',
    title: 'Speech Bubble',
    category: 'Prop',
    description: 'Turn the blob into a readable speech bubble with tail direction.',
    learningFocus: 'Useful for boards, annotations, and graphic clarity.',
    accentColor: '#fb7185',
    parameters: [
      {
        id: 'tail',
        label: 'Tail Direction',
        selection: 'single',
        defaultValue: ['down-left'],
        options: [
          { id: 'down-left', label: 'Down Left', hint: 'Speaker below-left' },
          { id: 'down-right', label: 'Down Right', hint: 'Speaker below-right' },
          { id: 'straight', label: 'Straight Down', hint: 'Speaker directly below' },
        ],
      },
      {
        id: 'shape',
        label: 'Bubble Shape',
        selection: 'single',
        defaultValue: ['comic'],
        options: [
          { id: 'comic', label: 'Comic', hint: 'Rounded lobe shape' },
          { id: 'smooth', label: 'Smooth', hint: 'Cleaner graphic bubble' },
          { id: 'thought', label: 'Thought', hint: 'Round thought clusters' },
        ],
      },
      {
        id: 'text',
        label: 'Text Layout',
        selection: 'single',
        defaultValue: ['short'],
        options: [
          { id: 'short', label: 'Short', hint: 'One short line' },
          { id: 'stacked', label: 'Stacked', hint: 'Two-line copy block' },
          { id: 'shout', label: 'Shout', hint: 'Larger emphasis text' },
        ],
      },
    ],
  },
  {
    id: 'island',
    title: 'Island / Rock Mass',
    category: 'Environment',
    description: 'Use the blob as an island or rock silhouette with base contour.',
    learningFocus: 'Great for converting loose masses into grounded environment shapes.',
    accentColor: '#fca5a5',
    parameters: [
      {
        id: 'profile',
        label: 'Profile',
        selection: 'single',
        defaultValue: ['island'],
        options: [
          { id: 'island', label: 'Island', hint: 'Low stretched landmass' },
          { id: 'rock', label: 'Rock', hint: 'Chunkier tall silhouette' },
          { id: 'cliff', label: 'Cliff', hint: 'Sharper vertical face' },
        ],
      },
      {
        id: 'surface',
        label: 'Surface',
        selection: 'single',
        defaultValue: ['grass'],
        options: [
          { id: 'grass', label: 'Grass', hint: 'Soft top contour' },
          { id: 'stone', label: 'Stone', hint: 'Angular top' },
          { id: 'trees', label: 'Trees', hint: 'Tree rhythm on top' },
        ],
      },
      {
        id: 'water',
        label: 'Waterline',
        selection: 'single',
        defaultValue: ['yes'],
        options: [
          { id: 'yes', label: 'Waterline', hint: 'Add a simple base line' },
          { id: 'no', label: 'No Waterline', hint: 'Pure silhouette only' },
        ],
      },
    ],
  },
  {
    id: 'shoulders',
    title: 'Shoulders',
    category: 'Prop',
    description: 'Use the blob as a shoulders and upper torso mass for character blocking.',
    learningFocus: 'Builds confidence in connecting head masses to torso rhythm and silhouette width.',
    accentColor: '#fca5a5',
    parameters: [
      {
        id: 'width',
        label: 'Shoulder Width',
        selection: 'single',
        defaultValue: ['standard'],
        options: [
          { id: 'narrow', label: 'Narrow', hint: 'Compact shoulder line' },
          { id: 'standard', label: 'Standard', hint: 'Balanced shoulder spread' },
          { id: 'broad', label: 'Broad', hint: 'Heroic wider stance' },
        ],
      },
      {
        id: 'angle',
        label: 'Angle',
        selection: 'single',
        defaultValue: ['level'],
        options: [
          { id: 'level', label: 'Level', hint: 'Even shoulder line' },
          { id: 'left-up', label: 'Left Up', hint: 'Left shoulder lifted' },
          { id: 'right-up', label: 'Right Up', hint: 'Right shoulder lifted' },
        ],
      },
      {
        id: 'neck',
        label: 'Neck',
        selection: 'single',
        defaultValue: ['visible'],
        options: [
          { id: 'visible', label: 'Visible', hint: 'Small neck opening' },
          { id: 'thick', label: 'Thick', hint: 'Heavier neck mass' },
          { id: 'hidden', label: 'Hidden', hint: 'Head sits lower into torso' },
        ],
      },
    ],
  },
];

const primitiveSuggestionMap: Record<ShapeIntentPrimitive, ShapeIntentSuggestion[]> = {
  ellipse: ellipseSuggestions,
  rectangle: rectangleSuggestions,
  line: lineSuggestions,
  blob: blobSuggestions,
};

const buildNormalizedGuideStrokes = (
  primitive: ShapeIntentPrimitive,
  bounds: ShapeIntentBounds,
  timestampSeed: number,
): PencilStroke[] => {
  const color = '#f6b24d';
  if (primitive === 'ellipse') {
    return [createEllipseStroke(bounds.centerX, bounds.centerY, Math.max(12, bounds.width / 2), Math.max(12, bounds.height / 2), color, 4, 0.9, timestampSeed)];
  }
  if (primitive === 'rectangle') {
    return [createRectangleStroke(bounds, color, 4, 0.9, timestampSeed)];
  }
  if (primitive === 'line') {
    return [createLineStroke(bounds.minX, bounds.centerY, bounds.maxX, bounds.centerY, color, 4, 0.9, timestampSeed)];
  }
  const expanded = expandBounds(bounds, Math.max(10, bounds.width * 0.06), Math.max(10, bounds.height * 0.08));
  return [createEllipseStroke(expanded.centerX, expanded.centerY, Math.max(18, expanded.width / 2), Math.max(18, expanded.height / 2), color, 4, 0.9, timestampSeed)];
};

const createLobeStroke = (
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
  lobeScale: number,
  color: string,
  width: number,
  opacity: number,
  timestampSeed: number,
): PencilStroke => {
  const points = Array.from({ length: 49 }, (_, index) => {
    const angle = (index / 48) * FULL_TURN;
    const lobe = 1 + (Math.sin(angle * 3) * lobeScale);
    return {
      x: centerX + (Math.cos(angle) * radiusX * lobe),
      y: centerY + (Math.sin(angle) * radiusY * lobe),
    };
  });
  return createStroke(points, color, width, opacity, timestampSeed);
};

const buildPizzaStrokes = (bounds: ShapeIntentBounds, suggestion: ShapeIntentSuggestion, selections: ShapeIntentSelections, timestampSeed: number) => {
  const crust = getSingleSelection(selections, suggestion.parameters[0]);
  const toppings = new Set(getMultiSelection(selections, suggestion.parameters[1]));
  const cuts = getSingleSelection(selections, suggestion.parameters[2]);
  const crustRatio = crust === 'thin' ? 0.11 : crust === 'deep' ? 0.24 : 0.17;
  const outer = createEllipseStroke(bounds.centerX, bounds.centerY, bounds.width / 2, bounds.height / 2, '#f8fafc', 4, 0.95, timestampSeed);
  const inner = createEllipseStroke(
    bounds.centerX,
    bounds.centerY,
    Math.max(10, (bounds.width / 2) * (1 - crustRatio)),
    Math.max(10, (bounds.height / 2) * (1 - crustRatio)),
    '#f97316',
    3,
    0.86,
    timestampSeed + 120,
  );
  const sliceCount = cuts === 'whole' ? 0 : cuts === 'quartered' ? 4 : 6;
  const sliceStrokes = Array.from({ length: sliceCount }, (_, index) => {
    const angle = (-Math.PI / 2) + ((FULL_TURN / sliceCount) * index);
    return createLineStroke(
      bounds.centerX,
      bounds.centerY,
      bounds.centerX + (Math.cos(angle) * bounds.width * 0.42),
      bounds.centerY + (Math.sin(angle) * bounds.height * 0.42),
      '#f8fafc',
      2,
      0.78,
      timestampSeed + 260 + (index * 32),
      3,
    );
  });
  const toppingStrokes: PencilStroke[] = [];
  if (toppings.has('pepperoni')) {
    const pepperoniOffsets = [
      [-0.24, -0.18], [0.05, -0.22], [0.28, -0.08], [-0.3, 0.12], [-0.04, 0.08], [0.23, 0.2],
    ];
    pepperoniOffsets.forEach(([offsetX, offsetY], index) => {
      toppingStrokes.push(createEllipseStroke(
        bounds.centerX + (bounds.width * offsetX),
        bounds.centerY + (bounds.height * offsetY),
        bounds.width * 0.06,
        bounds.height * 0.06,
        '#ef4444',
        2.5,
        0.85,
        timestampSeed + 520 + (index * 28),
      ));
    });
  }
  if (toppings.has('cheese')) {
    const cheeseOffsets = [
      [-0.12, -0.04], [0.12, 0.04], [0.02, -0.18], [-0.22, 0.18],
    ];
    cheeseOffsets.forEach(([offsetX, offsetY], index) => {
      toppingStrokes.push(createLobeStroke(
        bounds.centerX + (bounds.width * offsetX),
        bounds.centerY + (bounds.height * offsetY),
        bounds.width * 0.05,
        bounds.height * 0.03,
        0.14,
        '#fde68a',
        2,
        0.8,
        timestampSeed + 760 + (index * 26),
      ));
    });
  }
  if (toppings.has('mushroom')) {
    const mushroomOffsets = [
      [-0.02, -0.03], [0.18, -0.12], [-0.18, 0.08],
    ];
    mushroomOffsets.forEach(([offsetX, offsetY], index) => {
      const cx = bounds.centerX + (bounds.width * offsetX);
      const cy = bounds.centerY + (bounds.height * offsetY);
      toppingStrokes.push(createEllipseStroke(cx, cy, bounds.width * 0.045, bounds.height * 0.025, '#e5e7eb', 2, 0.82, timestampSeed + 900 + (index * 28)));
      toppingStrokes.push(createLineStroke(cx, cy, cx, cy + (bounds.height * 0.04), '#e5e7eb', 2, 0.75, timestampSeed + 920 + (index * 28), 3));
    });
  }
  if (toppings.has('basil')) {
    const basilOffsets = [
      [0.21, -0.21], [-0.25, -0.01], [0.1, 0.19],
    ];
    basilOffsets.forEach(([offsetX, offsetY], index) => {
      toppingStrokes.push(createEllipseStroke(
        bounds.centerX + (bounds.width * offsetX),
        bounds.centerY + (bounds.height * offsetY),
        bounds.width * 0.025,
        bounds.height * 0.045,
        '#22c55e',
        2,
        0.84,
        timestampSeed + 1020 + (index * 30),
        32,
      ));
    });
  }
  return [outer, inner, ...sliceStrokes, ...toppingStrokes];
};

const buildWheelStrokes = (bounds: ShapeIntentBounds, suggestion: ShapeIntentSuggestion, selections: ShapeIntentSelections, timestampSeed: number) => {
  const vehicle = getSingleSelection(selections, suggestion.parameters[0]);
  const spokes = getSingleSelection(selections, suggestion.parameters[1]);
  const tire = getSingleSelection(selections, suggestion.parameters[2]);
  const tireRatio = tire === 'thin' ? 0.08 : tire === 'chunky' ? 0.22 : 0.14;
  const rimRatio = vehicle === 'bicycle' ? 0.83 : vehicle === 'car' ? 0.68 : 0.74;
  const spokeCount = spokes === '5' ? 5 : spokes === 'dense' ? 18 : 8;
  const tireStroke = createEllipseStroke(bounds.centerX, bounds.centerY, bounds.width / 2, bounds.height / 2, '#e5e7eb', 4.5, 0.95, timestampSeed);
  const rimStroke = createEllipseStroke(
    bounds.centerX,
    bounds.centerY,
    (bounds.width / 2) * (1 - tireRatio),
    (bounds.height / 2) * (1 - tireRatio),
    '#60a5fa',
    3,
    0.9,
    timestampSeed + 110,
  );
  const hubStroke = createEllipseStroke(bounds.centerX, bounds.centerY, bounds.width * 0.08, bounds.height * 0.08, '#f8fafc', 2.5, 0.9, timestampSeed + 220);
  const spokeRadiusX = (bounds.width / 2) * rimRatio;
  const spokeRadiusY = (bounds.height / 2) * rimRatio;
  const spokeStrokes = Array.from({ length: spokeCount }, (_, index) => {
    const angle = (-Math.PI / 2) + ((FULL_TURN / spokeCount) * index);
    return createLineStroke(
      bounds.centerX,
      bounds.centerY,
      bounds.centerX + (Math.cos(angle) * spokeRadiusX),
      bounds.centerY + (Math.sin(angle) * spokeRadiusY),
      '#bfdbfe',
      spokes === 'dense' ? 1.5 : 2.2,
      0.8,
      timestampSeed + 320 + (index * 24),
      3,
    );
  });
  return [tireStroke, rimStroke, hubStroke, ...spokeStrokes];
};

const buildRoundTableStrokes = (bounds: ShapeIntentBounds, suggestion: ShapeIntentSuggestion, selections: ShapeIntentSelections, timestampSeed: number) => {
  const tabletop = getSingleSelection(selections, suggestion.parameters[0]);
  const base = getSingleSelection(selections, suggestion.parameters[1]);
  const staging = getSingleSelection(selections, suggestion.parameters[2]);
  const thickness = tabletop === 'slim' ? bounds.height * 0.05 : tabletop === 'heavy' ? bounds.height * 0.14 : bounds.height * 0.09;
  const verticalOffset = staging === 'hero' ? thickness * 1.35 : staging === 'top' ? thickness * 0.5 : thickness;
  const topStroke = createEllipseStroke(bounds.centerX, bounds.centerY, bounds.width / 2, bounds.height / 2, '#f8fafc', 3.5, 0.94, timestampSeed);
  const undersideStroke = createEllipseStroke(
    bounds.centerX,
    bounds.centerY + verticalOffset,
    bounds.width * 0.45,
    bounds.height * 0.22,
    '#94a3b8',
    2.4,
    0.8,
    timestampSeed + 120,
  );
  const supports: PencilStroke[] = [];
  if (base === 'pedestal') {
    supports.push(createLineStroke(bounds.centerX, bounds.centerY + verticalOffset, bounds.centerX, bounds.maxY + (bounds.height * 0.28), '#f8fafc', 3, 0.84, timestampSeed + 260, 3));
    supports.push(createLineStroke(bounds.centerX - (bounds.width * 0.16), bounds.maxY + (bounds.height * 0.28), bounds.centerX + (bounds.width * 0.16), bounds.maxY + (bounds.height * 0.28), '#f8fafc', 2.5, 0.8, timestampSeed + 292, 3));
  } else if (base === 'four-legs') {
    const legOffsets = [-0.32, -0.14, 0.14, 0.32];
    legOffsets.forEach((offset, index) => {
      supports.push(createLineStroke(
        bounds.centerX + (bounds.width * offset),
        bounds.centerY + (bounds.height * 0.04),
        bounds.centerX + (bounds.width * offset * 1.08),
        bounds.maxY + (bounds.height * 0.28),
        '#f8fafc',
        2.3,
        0.8,
        timestampSeed + 260 + (index * 28),
        3,
      ));
    });
  } else {
    supports.push(createLineStroke(bounds.centerX, bounds.centerY + verticalOffset, bounds.centerX, bounds.maxY + (bounds.height * 0.22), '#f8fafc', 2.6, 0.82, timestampSeed + 260, 3));
    supports.push(createLineStroke(bounds.centerX - (bounds.width * 0.18), bounds.maxY + (bounds.height * 0.18), bounds.centerX + (bounds.width * 0.18), bounds.maxY + (bounds.height * 0.18), '#f8fafc', 2.4, 0.82, timestampSeed + 292, 3));
    supports.push(createLineStroke(bounds.centerX - (bounds.width * 0.09), bounds.maxY + (bounds.height * 0.26), bounds.centerX + (bounds.width * 0.09), bounds.maxY + (bounds.height * 0.1), '#f8fafc', 2.1, 0.78, timestampSeed + 324, 3));
  }
  return [topStroke, undersideStroke, ...supports];
};

const buildPlateStrokes = (bounds: ShapeIntentBounds, suggestion: ShapeIntentSuggestion, selections: ShapeIntentSelections, timestampSeed: number) => {
  const rim = getSingleSelection(selections, suggestion.parameters[0]);
  const content = getSingleSelection(selections, suggestion.parameters[1]);
  const angle = getSingleSelection(selections, suggestion.parameters[2]);
  const angleScale = angle === 'top' ? 1 : angle === 'dramatic' ? 0.62 : 0.78;
  const radiusY = (bounds.height / 2) * angleScale;
  const rimRatio = rim === 'thin' ? 0.1 : rim === 'bowl' ? 0.28 : 0.18;
  const outer = createEllipseStroke(bounds.centerX, bounds.centerY, bounds.width / 2, radiusY, '#f8fafc', 3.5, 0.94, timestampSeed);
  const inner = createEllipseStroke(bounds.centerX, bounds.centerY + (rim === 'bowl' ? radiusY * 0.16 : 0), (bounds.width / 2) * (1 - rimRatio), radiusY * (1 - rimRatio), '#cbd5e1', 2.5, 0.82, timestampSeed + 120);
  const contentStrokes: PencilStroke[] = [];
  if (content === 'salad') {
    const saladOffsets = [[-0.1, -0.05], [0.12, 0.04], [-0.18, 0.08], [0.02, -0.12]];
    saladOffsets.forEach(([offsetX, offsetY], index) => {
      contentStrokes.push(createLobeStroke(bounds.centerX + (bounds.width * offsetX), bounds.centerY + (radiusY * offsetY), bounds.width * 0.05, radiusY * 0.06, 0.22, '#4ade80', 2, 0.8, timestampSeed + 260 + (index * 24)));
    });
  } else if (content === 'ramen') {
    contentStrokes.push(createEllipseStroke(bounds.centerX, bounds.centerY, bounds.width * 0.18, radiusY * 0.2, '#f59e0b', 2, 0.8, timestampSeed + 260));
    contentStrokes.push(createLineStroke(bounds.centerX - (bounds.width * 0.12), bounds.centerY - (radiusY * 0.04), bounds.centerX + (bounds.width * 0.12), bounds.centerY + (radiusY * 0.04), '#fde68a', 2, 0.82, timestampSeed + 290, 5));
  }
  return [outer, inner, ...contentStrokes];
};

const buildClockStrokes = (bounds: ShapeIntentBounds, suggestion: ShapeIntentSuggestion, selections: ShapeIntentSelections, timestampSeed: number) => {
  const ticks = getSingleSelection(selections, suggestion.parameters[0]);
  const hands = getSingleSelection(selections, suggestion.parameters[1]);
  const mount = getSingleSelection(selections, suggestion.parameters[2]);
  const face = createEllipseStroke(bounds.centerX, bounds.centerY, bounds.width / 2, bounds.height / 2, '#f8fafc', 3.5, 0.94, timestampSeed);
  const tickCount = ticks === 'minimal' ? 4 : ticks === 'roman' ? 12 : 12;
  const tickStrokes = Array.from({ length: tickCount }, (_, index) => {
    const angle = (-Math.PI / 2) + ((FULL_TURN / tickCount) * index);
    const outerX = bounds.centerX + (Math.cos(angle) * bounds.width * 0.44);
    const outerY = bounds.centerY + (Math.sin(angle) * bounds.height * 0.44);
    const innerScale = ticks === 'minimal' ? 0.34 : 0.38;
    const innerX = bounds.centerX + (Math.cos(angle) * bounds.width * innerScale);
    const innerY = bounds.centerY + (Math.sin(angle) * bounds.height * innerScale);
    return createLineStroke(innerX, innerY, outerX, outerY, '#facc15', ticks === 'minimal' ? 2.6 : 1.7, 0.8, timestampSeed + 120 + (index * 18), 3);
  });
  const handAngles =
    hands === '12:00'
      ? { hour: -Math.PI / 2, minute: -Math.PI / 2 }
      : hands === '3:15'
        ? { hour: 0, minute: Math.PI / 2 }
        : { hour: -2.35, minute: -0.8 };
  const handStrokes = [
    createLineStroke(bounds.centerX, bounds.centerY, bounds.centerX + (Math.cos(handAngles.hour) * bounds.width * 0.18), bounds.centerY + (Math.sin(handAngles.hour) * bounds.height * 0.18), '#f8fafc', 3, 0.9, timestampSeed + 380, 3),
    createLineStroke(bounds.centerX, bounds.centerY, bounds.centerX + (Math.cos(handAngles.minute) * bounds.width * 0.28), bounds.centerY + (Math.sin(handAngles.minute) * bounds.height * 0.28), '#f8fafc', 2, 0.85, timestampSeed + 410, 3),
  ];
  const mountStrokes = mount === 'prop'
    ? [createLineStroke(bounds.centerX - (bounds.width * 0.1), bounds.maxY + (bounds.height * 0.04), bounds.centerX + (bounds.width * 0.1), bounds.maxY + (bounds.height * 0.04), '#cbd5e1', 2.3, 0.76, timestampSeed + 450, 3)]
    : mount === 'watch'
      ? [
          createLineStroke(bounds.centerX, bounds.minY - (bounds.height * 0.12), bounds.centerX, bounds.minY, '#cbd5e1', 2.1, 0.76, timestampSeed + 450, 3),
          createLineStroke(bounds.centerX, bounds.maxY, bounds.centerX, bounds.maxY + (bounds.height * 0.12), '#cbd5e1', 2.1, 0.76, timestampSeed + 482, 3),
        ]
      : [];
  return [face, ...tickStrokes, ...handStrokes, ...mountStrokes];
};

const buildHeadMassStrokes = (bounds: ShapeIntentBounds, suggestion: ShapeIntentSuggestion, selections: ShapeIntentSelections, timestampSeed: number) => {
  const headShape = getSingleSelection(selections, suggestion.parameters[0]);
  const tilt = getSingleSelection(selections, suggestion.parameters[1]);
  const eyeline = getSingleSelection(selections, suggestion.parameters[2]);
  const jawDepth = headShape === 'hero' ? 0.18 : headShape === 'soft' ? 0.1 : 0.14;
  const lowerWidth = headShape === 'hero' ? 0.72 : headShape === 'soft' ? 0.82 : 0.77;
  const turnOffset = tilt === 'three-quarter' ? bounds.width * 0.07 : tilt === 'profile' ? bounds.width * 0.12 : 0;
  const eyelineOffset = eyeline === 'up' ? -bounds.height * 0.07 : eyeline === 'down' ? bounds.height * 0.07 : 0;
  const strokes = [
    createEllipseStroke(
      bounds.centerX + (tilt === 'three-quarter' ? turnOffset * 0.4 : 0),
      bounds.centerY - (bounds.height * 0.04),
      bounds.width * (tilt === 'profile' ? 0.34 : 0.39),
      bounds.height * 0.43,
      '#fca5a5',
      3.5,
      0.96,
      timestampSeed,
      tilt === 'three-quarter' ? 8 : tilt === 'profile' ? 16 : 0,
    ),
    createLineStroke(
      bounds.centerX - (bounds.width * lowerWidth * 0.34),
      bounds.centerY + (bounds.height * 0.1),
      bounds.centerX - (bounds.width * lowerWidth * 0.22),
      bounds.maxY - (bounds.height * jawDepth),
      '#fecaca',
      3.2,
      0.9,
      timestampSeed + 120,
      4,
    ),
    createLineStroke(
      bounds.centerX - (bounds.width * lowerWidth * 0.22),
      bounds.maxY - (bounds.height * jawDepth),
      bounds.centerX + (bounds.width * lowerWidth * 0.22),
      bounds.maxY - (bounds.height * jawDepth),
      '#fecaca',
      3.2,
      0.9,
      timestampSeed + 140,
      4,
    ),
    createLineStroke(
      bounds.centerX + (bounds.width * lowerWidth * 0.22),
      bounds.maxY - (bounds.height * jawDepth),
      bounds.centerX + (bounds.width * lowerWidth * 0.34),
      bounds.centerY + (bounds.height * 0.1),
      '#fecaca',
      3.2,
      0.9,
      timestampSeed + 160,
      4,
    ),
    createLineStroke(
      bounds.centerX - (bounds.width * 0.18),
      bounds.centerY + eyelineOffset,
      bounds.centerX + (bounds.width * 0.18) + turnOffset,
      bounds.centerY + eyelineOffset,
      '#fda4af',
      2.5,
      0.74,
      timestampSeed + 220,
      5,
    ),
  ];

  if (tilt !== 'profile') {
    strokes.push(
      createLineStroke(
        bounds.centerX + (turnOffset * 0.25),
        bounds.minY + (bounds.height * 0.22),
        bounds.centerX + (turnOffset * 0.25),
        bounds.maxY - (bounds.height * 0.16),
        '#fda4af',
        2.2,
        0.52,
        timestampSeed + 260,
        5,
      )
    );
  }

  return strokes;
};

const buildPendantLampStrokes = (bounds: ShapeIntentBounds, suggestion: ShapeIntentSuggestion, selections: ShapeIntentSelections, timestampSeed: number) => {
  const shade = getSingleSelection(selections, suggestion.parameters[0]);
  const glow = getSingleSelection(selections, suggestion.parameters[1]);
  const cord = getSingleSelection(selections, suggestion.parameters[2]);
  const shadeTopY = bounds.minY + (cord === 'short' ? bounds.height * 0.18 : bounds.height * 0.32);
  const shadeHeight = shade === 'industrial' ? bounds.height * 0.18 : bounds.height * 0.14;
  const cordStartY = cord === 'off-frame' ? bounds.minY - (bounds.height * 0.18) : bounds.minY;
  const cordStroke = createLineStroke(bounds.centerX, cordStartY, bounds.centerX, shadeTopY, '#f8fafc', 1.8, 0.72, timestampSeed, 3);
  const strokes: PencilStroke[] = [cordStroke];

  if (shade === 'cone') {
    strokes.push(
      createStroke([
        { x: bounds.centerX - (bounds.width * 0.2), y: shadeTopY },
        { x: bounds.centerX + (bounds.width * 0.2), y: shadeTopY },
        { x: bounds.centerX + (bounds.width * 0.12), y: shadeTopY + shadeHeight },
        { x: bounds.centerX - (bounds.width * 0.12), y: shadeTopY + shadeHeight },
        { x: bounds.centerX - (bounds.width * 0.2), y: shadeTopY },
      ], '#f8fafc', 2.4, 0.86, timestampSeed + 28),
    );
  } else {
    strokes.push(
      createEllipseStroke(bounds.centerX, shadeTopY + (shadeHeight * 0.2), bounds.width * (shade === 'industrial' ? 0.22 : 0.18), shadeHeight * 0.38, '#f8fafc', 2.4, 0.86, timestampSeed + 28),
      createLineStroke(bounds.centerX - (bounds.width * 0.22), shadeTopY + (shadeHeight * 0.24), bounds.centerX - (bounds.width * 0.14), shadeTopY + shadeHeight, '#f8fafc', 2, 0.72, timestampSeed + 54, 2),
      createLineStroke(bounds.centerX + (bounds.width * 0.22), shadeTopY + (shadeHeight * 0.24), bounds.centerX + (bounds.width * 0.14), shadeTopY + shadeHeight, '#f8fafc', 2, 0.72, timestampSeed + 70, 2),
    );
  }

  const glowOpacity = glow === 'low' ? 0.18 : glow === 'blown' ? 0.42 : 0.28;
  const glowCount = glow === 'blown' ? 4 : 2;
  for (let index = 0; index < glowCount; index += 1) {
    const offset = (index - ((glowCount - 1) / 2)) * bounds.width * 0.08;
    strokes.push(
      createLineStroke(
        bounds.centerX + offset,
        shadeTopY + shadeHeight,
        bounds.centerX + (offset * 1.2),
        shadeTopY + shadeHeight + (bounds.height * 0.28),
        '#f8fafc',
        glow === 'blown' ? 2.2 : 1.6,
        glowOpacity,
        timestampSeed + 96 + (index * 18),
        3,
      ),
    );
  }

  return strokes;
};

const buildHeadlightGlareStrokes = (bounds: ShapeIntentBounds, suggestion: ShapeIntentSuggestion, selections: ShapeIntentSelections, timestampSeed: number) => {
  const pair = getSingleSelection(selections, suggestion.parameters[0]);
  const bloom = getSingleSelection(selections, suggestion.parameters[1]);
  const spread = getSingleSelection(selections, suggestion.parameters[2]);
  const lightCount = pair === 'single' ? 1 : 2;
  const xOffsets = lightCount === 1
    ? [0]
    : pair === 'offset'
      ? [-bounds.width * 0.12, bounds.width * 0.08]
      : [-bounds.width * 0.1, bounds.width * 0.1];
  const radiusX = spread === 'tight' ? bounds.width * 0.1 : spread === 'wide' ? bounds.width * 0.16 : bounds.width * 0.13;
  const radiusY = radiusX * 0.68;
  const opacity = bloom === 'soft' ? 0.38 : bloom === 'blown' ? 0.82 : 0.62;
  const strokes: PencilStroke[] = [];

  xOffsets.forEach((offset, index) => {
    const cx = bounds.centerX + offset;
    const cy = bounds.centerY;
    strokes.push(
      createEllipseStroke(cx, cy, radiusX, radiusY, '#f8fafc', 2.2, opacity, timestampSeed + (index * 32)),
      createEllipseStroke(cx, cy, radiusX * 0.46, radiusY * 0.46, '#f8fafc', 1.8, Math.min(0.94, opacity + 0.12), timestampSeed + 12 + (index * 32)),
    );
    if (spread !== 'tight') {
      strokes.push(
        createLineStroke(cx, cy + radiusY, cx + (offset * 0.18), bounds.maxY, '#f8fafc', bloom === 'blown' ? 2 : 1.4, opacity * 0.44, timestampSeed + 18 + (index * 32), 3),
      );
    }
  });

  return strokes;
};

const buildWindowStrokes = (bounds: ShapeIntentBounds, suggestion: ShapeIntentSuggestion, selections: ShapeIntentSelections, timestampSeed: number) => {
  const frame = getSingleSelection(selections, suggestion.parameters[0]);
  const panes = getSingleSelection(selections, suggestion.parameters[1]);
  const sill = getSingleSelection(selections, suggestion.parameters[2]);
  const frameInset = frame === 'thin' ? 10 : frame === 'thick' ? 28 : 18;
  const outer = createRectangleStroke(bounds, '#f8fafc', 3.4, 0.92, timestampSeed);
  const innerBounds = expandBounds(bounds, -frameInset, -frameInset);
  const inner = createRectangleStroke(innerBounds, '#94a3b8', 2.2, 0.8, timestampSeed + 110);
  const paneStrokes: PencilStroke[] = [];
  if (panes !== 'single') {
    paneStrokes.push(createLineStroke(bounds.centerX, innerBounds.minY, bounds.centerX, innerBounds.maxY, '#bfdbfe', 2, 0.78, timestampSeed + 200, 3));
    paneStrokes.push(createLineStroke(innerBounds.minX, bounds.centerY, innerBounds.maxX, bounds.centerY, '#bfdbfe', 2, 0.78, timestampSeed + 232, 3));
  }
  if (panes === 'grid') {
    paneStrokes.push(createLineStroke(innerBounds.minX + (innerBounds.width * 0.25), innerBounds.minY, innerBounds.minX + (innerBounds.width * 0.25), innerBounds.maxY, '#bfdbfe', 1.6, 0.72, timestampSeed + 264, 3));
    paneStrokes.push(createLineStroke(innerBounds.maxX - (innerBounds.width * 0.25), innerBounds.minY, innerBounds.maxX - (innerBounds.width * 0.25), innerBounds.maxY, '#bfdbfe', 1.6, 0.72, timestampSeed + 296, 3));
  }
  const sillStroke = sill === 'with-sill'
    ? [createLineStroke(bounds.minX - (bounds.width * 0.08), bounds.maxY + 10, bounds.maxX + (bounds.width * 0.08), bounds.maxY + 10, '#f8fafc', 2.4, 0.78, timestampSeed + 340, 3)]
    : [];
  return [outer, inner, ...paneStrokes, ...sillStroke];
};

const buildDoorStrokes = (bounds: ShapeIntentBounds, suggestion: ShapeIntentSuggestion, selections: ShapeIntentSelections, timestampSeed: number) => {
  const style = getSingleSelection(selections, suggestion.parameters[0]);
  const handle = getSingleSelection(selections, suggestion.parameters[1]);
  const frame = getSingleSelection(selections, suggestion.parameters[2]);
  const outer = createRectangleStroke(bounds, '#f8fafc', 3.5, 0.94, timestampSeed);
  const jambInset = frame === 'thin' ? 10 : frame === 'thick' ? 24 : 16;
  const innerBounds = expandBounds(bounds, -jambInset, -jambInset);
  const innerStrokes: PencilStroke[] = style === 'flush'
    ? []
    : style === 'double'
      ? [createLineStroke(bounds.centerX, innerBounds.minY, bounds.centerX, innerBounds.maxY, '#cbd5e1', 2.2, 0.82, timestampSeed + 130, 3)]
      : [
          createRectangleStroke(expandBounds(innerBounds, -innerBounds.width * 0.16, -innerBounds.height * 0.14), '#cbd5e1', 2.1, 0.78, timestampSeed + 130),
          createRectangleStroke(expandBounds(innerBounds, -innerBounds.width * 0.16, -(innerBounds.height * 0.56)), '#cbd5e1', 2.1, 0.78, timestampSeed + 190),
        ];
  const handleX = bounds.maxX - (bounds.width * 0.16);
  const handleY = bounds.centerY;
  const handleStrokes = handle === 'bar'
    ? [createLineStroke(handleX, handleY - 28, handleX, handleY + 28, '#fde68a', 2.5, 0.86, timestampSeed + 240, 3)]
    : handle === 'lever'
      ? [createLineStroke(handleX - 10, handleY, handleX + 16, handleY, '#fde68a', 2.5, 0.86, timestampSeed + 240, 3)]
      : [createEllipseStroke(handleX, handleY, 7, 7, '#fde68a', 2.2, 0.86, timestampSeed + 240, 24)];
  return [outer, ...innerStrokes, ...handleStrokes];
};

const buildMonitorStrokes = (bounds: ShapeIntentBounds, suggestion: ShapeIntentSuggestion, selections: ShapeIntentSelections, timestampSeed: number) => {
  const bezel = getSingleSelection(selections, suggestion.parameters[0]);
  const stand = getSingleSelection(selections, suggestion.parameters[1]);
  const screen = getSingleSelection(selections, suggestion.parameters[2]);
  const bezelInset = bezel === 'thin' ? 8 : bezel === 'chunky' ? 26 : 16;
  const outer = createRoundedRectangleStroke(bounds, 18, '#f8fafc', 3.3, 0.94, timestampSeed);
  const inner = createRoundedRectangleStroke(expandBounds(bounds, -bezelInset, -bezelInset), 14, '#93c5fd', 2.2, 0.76, timestampSeed + 120);
  const screenStrokes: PencilStroke[] = [];
  if (screen === 'ui') {
    const innerBounds = expandBounds(bounds, -bezelInset - 12, -bezelInset - 12);
    screenStrokes.push(createRectangleStroke({ ...innerBounds, maxX: innerBounds.minX + (innerBounds.width * 0.4), width: innerBounds.width * 0.4, centerX: innerBounds.minX + (innerBounds.width * 0.2) }, '#cbd5e1', 1.6, 0.6, timestampSeed + 210));
    screenStrokes.push(createLineStroke(innerBounds.minX, innerBounds.centerY, innerBounds.maxX, innerBounds.centerY, '#cbd5e1', 1.6, 0.6, timestampSeed + 240, 3));
  } else if (screen === 'video') {
    const innerBounds = expandBounds(bounds, -bezelInset - 12, -bezelInset - 20);
    screenStrokes.push(createRectangleStroke(innerBounds, '#cbd5e1', 1.8, 0.62, timestampSeed + 210));
    screenStrokes.push(createLineStroke(innerBounds.centerX - 10, innerBounds.centerY - 12, innerBounds.centerX - 10, innerBounds.centerY + 12, '#f8fafc', 2, 0.74, timestampSeed + 244, 3));
    screenStrokes.push(createLineStroke(innerBounds.centerX + 10, innerBounds.centerY, innerBounds.centerX - 10, innerBounds.centerY + 12, '#f8fafc', 2, 0.74, timestampSeed + 276, 3));
  }
  const standStrokes = stand === 'wall'
    ? []
    : stand === 'arms'
      ? [
          createLineStroke(bounds.centerX, bounds.maxY, bounds.centerX - (bounds.width * 0.1), bounds.maxY + (bounds.height * 0.2), '#f8fafc', 2.4, 0.82, timestampSeed + 320, 3),
          createLineStroke(bounds.centerX, bounds.maxY, bounds.centerX + (bounds.width * 0.1), bounds.maxY + (bounds.height * 0.2), '#f8fafc', 2.4, 0.82, timestampSeed + 352, 3),
        ]
      : [
          createLineStroke(bounds.centerX, bounds.maxY, bounds.centerX, bounds.maxY + (bounds.height * 0.18), '#f8fafc', 2.6, 0.82, timestampSeed + 320, 3),
          createLineStroke(bounds.centerX - (bounds.width * 0.1), bounds.maxY + (bounds.height * 0.18), bounds.centerX + (bounds.width * 0.1), bounds.maxY + (bounds.height * 0.18), '#f8fafc', 2.4, 0.8, timestampSeed + 352, 3),
        ];
  return [outer, inner, ...screenStrokes, ...standStrokes];
};

const buildSignBoardStrokes = (bounds: ShapeIntentBounds, suggestion: ShapeIntentSuggestion, selections: ShapeIntentSelections, timestampSeed: number) => {
  const mount = getSingleSelection(selections, suggestion.parameters[0]);
  const shape = getSingleSelection(selections, suggestion.parameters[1]);
  const copy = getSingleSelection(selections, suggestion.parameters[2]);
  const board = shape === 'rounded'
    ? createRoundedRectangleStroke(bounds, 18, '#f8fafc', 3.2, 0.92, timestampSeed)
    : createRectangleStroke(bounds, '#f8fafc', 3.2, 0.92, timestampSeed);
  const copyStrokes: PencilStroke[] = copy === 'icon'
    ? [
        createEllipseStroke(bounds.centerX - (bounds.width * 0.18), bounds.centerY, 16, 16, '#fde68a', 2.2, 0.78, timestampSeed + 110, 24),
        createLineStroke(bounds.centerX - (bounds.width * 0.02), bounds.centerY - 10, bounds.centerX + (bounds.width * 0.18), bounds.centerY - 10, '#cbd5e1', 2, 0.7, timestampSeed + 142, 3),
        createLineStroke(bounds.centerX - (bounds.width * 0.02), bounds.centerY + 8, bounds.centerX + (bounds.width * 0.14), bounds.centerY + 8, '#cbd5e1', 2, 0.7, timestampSeed + 174, 3),
      ]
    : copy === 'stacked'
      ? [
          createLineStroke(bounds.minX + 18, bounds.centerY - 18, bounds.maxX - 18, bounds.centerY - 18, '#cbd5e1', 2.1, 0.72, timestampSeed + 110, 3),
          createLineStroke(bounds.minX + 28, bounds.centerY + 10, bounds.maxX - 28, bounds.centerY + 10, '#cbd5e1', 2.1, 0.72, timestampSeed + 142, 3),
        ]
      : [createLineStroke(bounds.minX + 20, bounds.centerY, bounds.maxX - 20, bounds.centerY, '#cbd5e1', 2.1, 0.72, timestampSeed + 110, 3)];
  const mountStrokes = mount === 'hang'
    ? [
        createLineStroke(bounds.minX + 18, bounds.minY, bounds.minX + 18, bounds.minY - 28, '#f8fafc', 2, 0.74, timestampSeed + 230, 3),
        createLineStroke(bounds.maxX - 18, bounds.minY, bounds.maxX - 18, bounds.minY - 28, '#f8fafc', 2, 0.74, timestampSeed + 262, 3),
      ]
    : mount === 'easel'
      ? [
          createLineStroke(bounds.minX + 24, bounds.maxY, bounds.minX + 8, bounds.maxY + 36, '#f8fafc', 2.3, 0.76, timestampSeed + 230, 3),
          createLineStroke(bounds.maxX - 24, bounds.maxY, bounds.maxX + 8, bounds.maxY + 36, '#f8fafc', 2.3, 0.76, timestampSeed + 262, 3),
        ]
      : [
          createLineStroke(bounds.minX + 22, bounds.maxY, bounds.minX + 22, bounds.maxY + 34, '#f8fafc', 2.4, 0.78, timestampSeed + 230, 3),
          createLineStroke(bounds.maxX - 22, bounds.maxY, bounds.maxX - 22, bounds.maxY + 34, '#f8fafc', 2.4, 0.78, timestampSeed + 262, 3),
        ];
  return [board, ...copyStrokes, ...mountStrokes];
};

const buildPhoneStrokes = (bounds: ShapeIntentBounds, suggestion: ShapeIntentSuggestion, selections: ShapeIntentSelections, timestampSeed: number) => {
  const body = getSingleSelection(selections, suggestion.parameters[0]);
  const camera = getSingleSelection(selections, suggestion.parameters[1]);
  const screen = getSingleSelection(selections, suggestion.parameters[2]);
  const radius = body === 'slab' ? 8 : body === 'fold' ? 10 : 22;
  const outer = createRoundedRectangleStroke(bounds, radius, '#f8fafc', 3.2, 0.92, timestampSeed);
  const screenBounds = expandBounds(bounds, -16, -20);
  const screenStroke = createRoundedRectangleStroke(screenBounds, Math.max(6, radius - 4), '#93c5fd', 2, 0.72, timestampSeed + 120);
  const cameraStrokes = camera === 'triple'
    ? [
        createEllipseStroke(bounds.maxX - 26, bounds.minY + 24, 7, 7, '#f8fafc', 2, 0.84, timestampSeed + 220, 24),
        createEllipseStroke(bounds.maxX - 44, bounds.minY + 24, 7, 7, '#f8fafc', 2, 0.84, timestampSeed + 248, 24),
        createEllipseStroke(bounds.maxX - 35, bounds.minY + 40, 7, 7, '#f8fafc', 2, 0.84, timestampSeed + 276, 24),
      ]
    : camera === 'notch'
      ? [createLineStroke(bounds.centerX - 16, bounds.minY + 10, bounds.centerX + 16, bounds.minY + 10, '#f8fafc', 3, 0.82, timestampSeed + 220, 3)]
      : [createEllipseStroke(bounds.maxX - 24, bounds.minY + 24, 7, 7, '#f8fafc', 2, 0.84, timestampSeed + 220, 24)];
  const screenStrokes: PencilStroke[] = [];
  if (screen === 'message') {
    screenStrokes.push(createRoundedRectangleStroke({
      minX: screenBounds.minX + 18,
      minY: screenBounds.minY + 24,
      maxX: screenBounds.maxX - 18,
      maxY: screenBounds.centerY - 4,
      width: screenBounds.width - 36,
      height: (screenBounds.centerY - 4) - (screenBounds.minY + 24),
      centerX: screenBounds.centerX,
      centerY: ((screenBounds.minY + 24) + (screenBounds.centerY - 4)) / 2,
    }, 12, '#cbd5e1', 1.8, 0.62, timestampSeed + 320));
  } else if (screen === 'map') {
    screenStrokes.push(createLineStroke(screenBounds.minX + 20, screenBounds.maxY - 28, screenBounds.maxX - 20, screenBounds.minY + 28, '#cbd5e1', 1.9, 0.62, timestampSeed + 320, 4));
    screenStrokes.push(createLineStroke(screenBounds.minX + 28, screenBounds.minY + 38, screenBounds.maxX - 32, screenBounds.maxY - 20, '#cbd5e1', 1.7, 0.58, timestampSeed + 352, 4));
  }
  return [outer, screenStroke, ...cameraStrokes, ...screenStrokes];
};

const buildChairStrokes = (bounds: ShapeIntentBounds, suggestion: ShapeIntentSuggestion, selections: ShapeIntentSelections, timestampSeed: number) => {
  const chairStyle = getSingleSelection(selections, suggestion.parameters[0]);
  const back = getSingleSelection(selections, suggestion.parameters[1]);
  const legs = getSingleSelection(selections, suggestion.parameters[2]);
  const seatBounds = {
    ...bounds,
    minY: bounds.centerY - (bounds.height * 0.05),
    maxY: bounds.centerY + (bounds.height * 0.14),
    height: bounds.height * 0.19,
    centerY: bounds.centerY + (bounds.height * 0.045),
  };
  const backHeight = chairStyle === 'stool' ? bounds.height * 0.08 : chairStyle === 'lounge' ? bounds.height * 0.32 : bounds.height * 0.26;
  const backTop = seatBounds.minY - backHeight;
  const legInset = legs === 'splayed' ? bounds.width * 0.06 : legs === 'sled' ? bounds.width * 0.03 : 0;
  const strokes = [
    createRoundedRectangleStroke(seatBounds, bounds.width * 0.08, '#4ade80', 3.4, 0.94, timestampSeed),
  ];

  if (chairStyle !== 'stool') {
    const backBounds = {
      minX: bounds.minX + (bounds.width * 0.08),
      minY: backTop,
      maxX: bounds.maxX - (bounds.width * 0.08),
      maxY: seatBounds.minY,
      width: bounds.width * 0.84,
      height: backHeight,
      centerX: bounds.centerX,
      centerY: backTop + (backHeight / 2),
    };
    strokes.push(createRoundedRectangleStroke(backBounds, bounds.width * 0.06, '#86efac', 3.1, 0.86, timestampSeed + 120));
    if (back === 'slat') {
      [-0.18, 0, 0.18].forEach((offset, index) => {
        strokes.push(createLineStroke(
          bounds.centerX + (bounds.width * offset),
          backTop + (backHeight * 0.08),
          bounds.centerX + (bounds.width * offset),
          seatBounds.minY - (bounds.height * 0.02),
          '#bbf7d0',
          2.1,
          0.64,
          timestampSeed + 180 + (index * 20),
          4,
        ));
      });
    }
  }

  if (legs === 'sled') {
    strokes.push(
      createLineStroke(bounds.minX + (bounds.width * 0.18), seatBounds.maxY, bounds.minX + (bounds.width * 0.08), bounds.maxY, '#86efac', 3, 0.78, timestampSeed + 260, 4),
      createLineStroke(bounds.maxX - (bounds.width * 0.18), seatBounds.maxY, bounds.maxX - (bounds.width * 0.08), bounds.maxY, '#86efac', 3, 0.78, timestampSeed + 280, 4),
      createLineStroke(bounds.minX + (bounds.width * 0.08), bounds.maxY, bounds.maxX - (bounds.width * 0.08), bounds.maxY, '#86efac', 2.6, 0.62, timestampSeed + 300, 4),
    );
  } else {
    strokes.push(
      createLineStroke(bounds.minX + (bounds.width * 0.2), seatBounds.maxY, bounds.minX + (bounds.width * (0.18 - legInset)), bounds.maxY, '#86efac', 3, 0.8, timestampSeed + 260, 4),
      createLineStroke(bounds.maxX - (bounds.width * 0.2), seatBounds.maxY, bounds.maxX - (bounds.width * (0.18 - legInset)), bounds.maxY, '#86efac', 3, 0.8, timestampSeed + 280, 4),
      createLineStroke(bounds.minX + (bounds.width * 0.3), seatBounds.maxY - (bounds.height * 0.02), bounds.minX + (bounds.width * (0.28 + legInset)), bounds.maxY, '#86efac', 2.6, 0.58, timestampSeed + 300, 4),
      createLineStroke(bounds.maxX - (bounds.width * 0.3), seatBounds.maxY - (bounds.height * 0.02), bounds.maxX - (bounds.width * (0.28 + legInset)), bounds.maxY, '#86efac', 2.6, 0.58, timestampSeed + 320, 4),
    );
  }

  return strokes;
};

const buildChassisBlockStrokes = (bounds: ShapeIntentBounds, suggestion: ShapeIntentSuggestion, selections: ShapeIntentSelections, timestampSeed: number) => {
  const body = getSingleSelection(selections, suggestion.parameters[0]);
  const seat = getSingleSelection(selections, suggestion.parameters[1]);
  const tail = getSingleSelection(selections, suggestion.parameters[2]);
  const baseBounds = expandBounds(bounds, bounds.width * 0.02, bounds.height * 0.04);
  const bodyHeight = body === 'buggy' ? baseBounds.height * 0.62 : body === 'cart' ? baseBounds.height * 0.72 : baseBounds.height * 0.54;
  const bodyTop = baseBounds.centerY - (bodyHeight * 0.45);
  const strokes = [
    createRoundedRectangleStroke(
      {
        minX: baseBounds.minX,
        minY: bodyTop,
        maxX: baseBounds.maxX,
        maxY: bodyTop + bodyHeight,
        width: baseBounds.width,
        height: bodyHeight,
        centerX: baseBounds.centerX,
        centerY: bodyTop + (bodyHeight / 2),
      },
      baseBounds.height * 0.1,
      '#93c5fd',
      3.5,
      0.94,
      timestampSeed,
    ),
  ];

  if (seat !== 'cargo') {
    strokes.push(createLineStroke(
      baseBounds.centerX - (baseBounds.width * 0.12),
      bodyTop + (bodyHeight * 0.18),
      baseBounds.centerX + (baseBounds.width * (seat === 'double' ? 0.22 : 0.1)),
      bodyTop + (bodyHeight * 0.18),
      '#bfdbfe',
      2.5,
      0.68,
      timestampSeed + 120,
      4,
    ));
  }

  const tailHeight = tail === 'kick-up' ? baseBounds.height * 0.12 : tail === 'box' ? baseBounds.height * 0.16 : baseBounds.height * 0.08;
  strokes.push(createLineStroke(
    baseBounds.centerX + (baseBounds.width * 0.12),
    bodyTop + (bodyHeight * 0.5),
    baseBounds.maxX - (baseBounds.width * 0.06),
    bodyTop + (bodyHeight * 0.5) - tailHeight,
    '#dbeafe',
    2.6,
    0.7,
    timestampSeed + 160,
    4,
  ));
  strokes.push(createLineStroke(
    baseBounds.minX + (baseBounds.width * 0.08),
    bodyTop + (bodyHeight * 0.64),
    baseBounds.maxX - (baseBounds.width * 0.08),
    bodyTop + (bodyHeight * 0.64),
    '#dbeafe',
    2.2,
    0.54,
    timestampSeed + 200,
    4,
  ));

  return strokes;
};

const buildSwordStrokes = (bounds: ShapeIntentBounds, suggestion: ShapeIntentSuggestion, selections: ShapeIntentSelections, timestampSeed: number) => {
  const blade = getSingleSelection(selections, suggestion.parameters[0]);
  const guard = getSingleSelection(selections, suggestion.parameters[1]);
  const pommel = getSingleSelection(selections, suggestion.parameters[2]);
  const centerY = bounds.centerY;
  const startX = bounds.minX;
  const endX = bounds.maxX;
  const bladeCurve = blade === 'katana' ? -18 : 0;
  const bladeStroke = createStroke([
    { x: startX, y: centerY },
    { x: startX + (bounds.width * 0.28), y: centerY + (bladeCurve * 0.4) },
    { x: startX + (bounds.width * 0.7), y: centerY + (bladeCurve * 0.8) },
    { x: endX, y: centerY + bladeCurve },
  ], '#f8fafc', blade === 'broad' ? 4.4 : 3.2, 0.92, timestampSeed);
  const guardStrokes = guard === 'none'
    ? []
    : guard === 'round'
      ? [createEllipseStroke(startX + (bounds.width * 0.18), centerY, 12, 12, '#fde68a', 2.2, 0.82, timestampSeed + 110, 24)]
      : [createLineStroke(startX + (bounds.width * 0.15), centerY - 14, startX + (bounds.width * 0.15), centerY + 14, '#fde68a', 2.6, 0.82, timestampSeed + 110, 3)];
  const handleStroke = createLineStroke(startX + (bounds.width * 0.15), centerY, startX - (bounds.width * 0.08), centerY, '#f59e0b', 3, 0.82, timestampSeed + 150, 3);
  const pommelStrokes = pommel === 'none'
    ? []
    : pommel === 'spike'
      ? [createLineStroke(startX - (bounds.width * 0.08), centerY, startX - (bounds.width * 0.14), centerY - 10, '#cbd5e1', 2.2, 0.78, timestampSeed + 190, 3)]
      : [createEllipseStroke(startX - (bounds.width * 0.1), centerY, 7, 7, '#cbd5e1', 2, 0.78, timestampSeed + 190, 24)];
  return [bladeStroke, ...guardStrokes, handleStroke, ...pommelStrokes];
};

const buildHorizonStrokes = (bounds: ShapeIntentBounds, suggestion: ShapeIntentSuggestion, selections: ShapeIntentSelections, timestampSeed: number) => {
  const scene = getSingleSelection(selections, suggestion.parameters[0]);
  const foreground = getSingleSelection(selections, suggestion.parameters[1]);
  const horizon = createLineStroke(bounds.minX, bounds.centerY, bounds.maxX, bounds.centerY, '#f8fafc', 2.6, 0.82, timestampSeed, 5);
  const sceneStrokes: PencilStroke[] = [];
  if (scene === 'sunset' || scene === 'ocean') {
    sceneStrokes.push(createEllipseStroke(bounds.centerX + (bounds.width * 0.12), bounds.centerY - 18, 18, 18, '#f59e0b', 2.2, 0.84, timestampSeed + 110, 24));
  }
  if (scene === 'city') {
    sceneStrokes.push(createStroke([
      { x: bounds.minX + 28, y: bounds.centerY },
      { x: bounds.minX + 28, y: bounds.centerY - 22 },
      { x: bounds.minX + 46, y: bounds.centerY - 22 },
      { x: bounds.minX + 46, y: bounds.centerY - 10 },
      { x: bounds.minX + 64, y: bounds.centerY - 10 },
      { x: bounds.minX + 64, y: bounds.centerY - 30 },
      { x: bounds.minX + 84, y: bounds.centerY - 30 },
      { x: bounds.minX + 84, y: bounds.centerY },
    ], '#cbd5e1', 2, 0.72, timestampSeed + 110));
  }
  if (foreground === 'posts') {
    sceneStrokes.push(createLineStroke(bounds.minX + 24, bounds.centerY + 10, bounds.minX + 24, bounds.maxY + 18, '#94a3b8', 2.2, 0.74, timestampSeed + 180, 3));
    sceneStrokes.push(createLineStroke(bounds.maxX - 24, bounds.centerY + 10, bounds.maxX - 24, bounds.maxY + 18, '#94a3b8', 2.2, 0.74, timestampSeed + 212, 3));
  } else if (foreground === 'rocks') {
    sceneStrokes.push(createLobeStroke(bounds.minX + 34, bounds.maxY + 6, 18, 10, 0.18, '#94a3b8', 2, 0.72, timestampSeed + 180));
  }
  return [horizon, ...sceneStrokes];
};

const buildBoomMicStrokes = (bounds: ShapeIntentBounds, suggestion: ShapeIntentSuggestion, selections: ShapeIntentSelections, timestampSeed: number) => {
  const mic = getSingleSelection(selections, suggestion.parameters[0]);
  const pole = getSingleSelection(selections, suggestion.parameters[1]);
  const startX = bounds.minX;
  const endX = bounds.maxX;
  const angleOffset = pole === 'angled' ? -18 : 0;
  const poleStroke = createStroke([
    { x: startX, y: bounds.centerY },
    { x: startX + (bounds.width * 0.34), y: bounds.centerY + (angleOffset * 0.35) },
    { x: endX - 32, y: bounds.centerY + angleOffset },
  ], '#f8fafc', pole === 'compact' ? 2.4 : 3, 0.86, timestampSeed);
  const micRadiusX = mic === 'blimp' ? 24 : mic === 'small' ? 12 : 18;
  const micRadiusY = mic === 'blimp' ? 12 : mic === 'small' ? 7 : 8;
  const micStroke = createEllipseStroke(endX - 12, bounds.centerY + angleOffset, micRadiusX, micRadiusY, '#cbd5e1', 2.4, 0.84, timestampSeed + 110, angleOffset * 0.8, 24);
  const shockMount = getSingleSelection(selections, suggestion.parameters[2]) === 'shock'
    ? [createLineStroke(endX - 36, bounds.centerY + angleOffset - 10, endX - 6, bounds.centerY + angleOffset + 10, '#fde68a', 1.8, 0.72, timestampSeed + 160, 3)]
    : [];
  return [poleStroke, micStroke, ...shockMount];
};

const buildShelfStrokes = (bounds: ShapeIntentBounds, suggestion: ShapeIntentSuggestion, selections: ShapeIntentSelections, timestampSeed: number) => {
  const support = getSingleSelection(selections, suggestion.parameters[0]);
  const thickness = getSingleSelection(selections, suggestion.parameters[1]);
  const props = getSingleSelection(selections, suggestion.parameters[2]);
  const offsetY = thickness === 'thin' ? 8 : thickness === 'chunky' ? 20 : 13;
  const top = createLineStroke(bounds.minX, bounds.centerY - offsetY, bounds.maxX, bounds.centerY - offsetY, '#f8fafc', 2.6, 0.86, timestampSeed, 4);
  const bottom = createLineStroke(bounds.minX, bounds.centerY + offsetY, bounds.maxX, bounds.centerY + offsetY, '#f8fafc', 2.4, 0.76, timestampSeed + 50, 4);
  const supportStrokes = support === 'hidden'
    ? []
    : support === 'ropes'
      ? [
          createLineStroke(bounds.minX + 18, bounds.centerY - offsetY, bounds.minX + 18, bounds.minY - 18, '#cbd5e1', 2, 0.74, timestampSeed + 120, 3),
          createLineStroke(bounds.maxX - 18, bounds.centerY - offsetY, bounds.maxX - 18, bounds.minY - 18, '#cbd5e1', 2, 0.74, timestampSeed + 150, 3),
        ]
      : [
          createLineStroke(bounds.minX + 24, bounds.centerY + offsetY, bounds.minX + 12, bounds.maxY + 18, '#cbd5e1', 2, 0.74, timestampSeed + 120, 3),
          createLineStroke(bounds.maxX - 24, bounds.centerY + offsetY, bounds.maxX - 12, bounds.maxY + 18, '#cbd5e1', 2, 0.74, timestampSeed + 150, 3),
        ];
  const propStrokes: PencilStroke[] = props === 'books'
    ? [
        createLineStroke(bounds.minX + 42, bounds.centerY - offsetY - 22, bounds.minX + 42, bounds.centerY - offsetY, '#fde68a', 3, 0.76, timestampSeed + 200, 3),
        createLineStroke(bounds.minX + 58, bounds.centerY - offsetY - 18, bounds.minX + 58, bounds.centerY - offsetY, '#fde68a', 3, 0.76, timestampSeed + 228, 3),
      ]
    : props === 'plants'
      ? [createLobeStroke(bounds.minX + 52, bounds.centerY - offsetY - 8, 16, 18, 0.22, '#4ade80', 2, 0.76, timestampSeed + 200)]
      : [];
  return [top, bottom, ...supportStrokes, ...propStrokes];
};

const buildLaneStrokes = (bounds: ShapeIntentBounds, suggestion: ShapeIntentSuggestion, selections: ShapeIntentSelections, timestampSeed: number) => {
  const road = getSingleSelection(selections, suggestion.parameters[0]);
  const marking = getSingleSelection(selections, suggestion.parameters[1]);
  const camera = getSingleSelection(selections, suggestion.parameters[2]);
  const laneOffset = road === 'highway' ? bounds.width * 0.18 : road === 'alley' ? bounds.width * 0.08 : bounds.width * 0.12;
  const vanishX = camera === 'diagonal' ? bounds.centerX + (bounds.width * 0.18) : bounds.centerX;
  const leftEdge = createLineStroke(bounds.centerX - laneOffset, bounds.maxY + 16, vanishX - 8, bounds.minY - 10, '#cbd5e1', 2.2, 0.78, timestampSeed, 4);
  const rightEdge = createLineStroke(bounds.centerX + laneOffset, bounds.maxY + 16, vanishX + 8, bounds.minY - 10, '#cbd5e1', 2.2, 0.78, timestampSeed + 32, 4);
  const centerStrokes: PencilStroke[] = [];
  if (marking === 'double') {
    centerStrokes.push(createLineStroke(bounds.centerX - 8, bounds.maxY + 16, vanishX - 4, bounds.minY - 10, '#fde68a', 1.8, 0.8, timestampSeed + 80, 4));
    centerStrokes.push(createLineStroke(bounds.centerX + 8, bounds.maxY + 16, vanishX + 4, bounds.minY - 10, '#fde68a', 1.8, 0.8, timestampSeed + 112, 4));
  } else if (marking === 'solid') {
    centerStrokes.push(createLineStroke(bounds.centerX, bounds.maxY + 16, vanishX, bounds.minY - 10, '#fde68a', 1.8, 0.8, timestampSeed + 80, 4));
  } else {
    const dashSegments = 4;
    for (let index = 0; index < dashSegments; index += 1) {
      const startRatio = index / dashSegments;
      const endRatio = startRatio + 0.12;
      centerStrokes.push(createLineStroke(
        bounds.centerX + ((vanishX - bounds.centerX) * startRatio),
        bounds.maxY + 16 + (((bounds.minY - 10) - (bounds.maxY + 16)) * startRatio),
        bounds.centerX + ((vanishX - bounds.centerX) * endRatio),
        bounds.maxY + 16 + (((bounds.minY - 10) - (bounds.maxY + 16)) * endRatio),
        '#fde68a',
        1.8,
        0.8,
        timestampSeed + 80 + (index * 36),
        3,
      ));
    }
  }
  return [leftEdge, rightEdge, ...centerStrokes];
};

const buildCloudStrokes = (bounds: ShapeIntentBounds, suggestion: ShapeIntentSuggestion, selections: ShapeIntentSelections, timestampSeed: number) => {
  const mass = getSingleSelection(selections, suggestion.parameters[0]);
  const depth = getSingleSelection(selections, suggestion.parameters[1]);
  const tail = getSingleSelection(selections, suggestion.parameters[2]);
  const lobeScale = mass === 'storm' ? 0.12 : mass === 'wispy' ? 0.26 : 0.18;
  const base = createLobeStroke(bounds.centerX, bounds.centerY, bounds.width / 2, bounds.height / 2, lobeScale, '#f8fafc', 3.1, depth === 'deep' ? 0.94 : 0.84, timestampSeed);
  const tailStrokes = tail === 'wind'
    ? [createLineStroke(bounds.maxX - 12, bounds.centerY + 8, bounds.maxX + 34, bounds.centerY + 18, '#cbd5e1', 2.1, 0.7, timestampSeed + 110, 3)]
    : [];
  return [base, ...tailStrokes];
};

const buildBushStrokes = (bounds: ShapeIntentBounds, suggestion: ShapeIntentSuggestion, selections: ShapeIntentSelections, timestampSeed: number) => {
  const shape = getSingleSelection(selections, suggestion.parameters[0]);
  const density = getSingleSelection(selections, suggestion.parameters[1]);
  const grounding = getSingleSelection(selections, suggestion.parameters[2]);
  const widthScale = shape === 'wide' ? 1.12 : 1;
  const heightScale = shape === 'trimmed' ? 0.78 : 1;
  const outer = createLobeStroke(bounds.centerX, bounds.centerY, (bounds.width / 2) * widthScale, (bounds.height / 2) * heightScale, density === 'dense' ? 0.08 : 0.18, '#4ade80', 3, 0.82, timestampSeed);
  const groundingStrokes = grounding === 'trunk'
    ? [
        createLineStroke(bounds.centerX - 10, bounds.maxY, bounds.centerX - 16, bounds.maxY + 18, '#854d0e', 2.2, 0.72, timestampSeed + 110, 3),
        createLineStroke(bounds.centerX + 10, bounds.maxY, bounds.centerX + 16, bounds.maxY + 18, '#854d0e', 2.2, 0.72, timestampSeed + 142, 3),
      ]
    : [createLineStroke(bounds.minX + 8, bounds.maxY + 10, bounds.maxX - 8, bounds.maxY + 10, '#166534', 2.4, 0.62, timestampSeed + 110, 3)];
  return [outer, ...groundingStrokes];
};

const buildSmokeStrokes = (bounds: ShapeIntentBounds, suggestion: ShapeIntentSuggestion, selections: ShapeIntentSelections, timestampSeed: number) => {
  const direction = getSingleSelection(selections, suggestion.parameters[0]);
  const density = getSingleSelection(selections, suggestion.parameters[1]);
  const origin = getSingleSelection(selections, suggestion.parameters[2]);
  const driftX = direction === 'left' ? -bounds.width * 0.16 : direction === 'right' ? bounds.width * 0.16 : 0;
  const plume = createStroke([
    { x: bounds.centerX, y: bounds.maxY },
    { x: bounds.centerX + (driftX * 0.2), y: bounds.centerY + (bounds.height * 0.2) },
    { x: bounds.centerX + (driftX * 0.55), y: bounds.centerY - (bounds.height * 0.12) },
    { x: bounds.centerX + driftX, y: bounds.minY },
  ], '#e2e8f0', density === 'dense' ? 4 : 2.8, density === 'dense' ? 0.86 : 0.66, timestampSeed);
  const curl = createEllipseStroke(bounds.centerX + driftX, bounds.centerY - (bounds.height * 0.12), bounds.width * 0.14, bounds.height * 0.16, '#c4b5fd', 2.2, 0.66, timestampSeed + 120, 18);
  const originStroke = origin === 'ground'
    ? [createLobeStroke(bounds.centerX, bounds.maxY + 12, bounds.width * 0.12, bounds.height * 0.06, 0.14, '#94a3b8', 2, 0.56, timestampSeed + 210)]
    : [createLineStroke(bounds.centerX, bounds.maxY + 18, bounds.centerX, bounds.maxY - 4, '#94a3b8', 2, 0.56, timestampSeed + 210, 3)];
  return [plume, curl, ...originStroke];
};

const buildSpeechBubbleStrokes = (bounds: ShapeIntentBounds, suggestion: ShapeIntentSuggestion, selections: ShapeIntentSelections, timestampSeed: number) => {
  const tail = getSingleSelection(selections, suggestion.parameters[0]);
  const shape = getSingleSelection(selections, suggestion.parameters[1]);
  const text = getSingleSelection(selections, suggestion.parameters[2]);
  const bubble = shape === 'smooth'
    ? createEllipseStroke(bounds.centerX, bounds.centerY, bounds.width / 2, bounds.height / 2, '#f8fafc', 3, 0.9, timestampSeed)
    : shape === 'thought'
      ? createLobeStroke(bounds.centerX, bounds.centerY, bounds.width / 2, bounds.height / 2, 0.14, '#f8fafc', 3, 0.9, timestampSeed)
      : createLobeStroke(bounds.centerX, bounds.centerY, bounds.width / 2, bounds.height / 2, 0.08, '#f8fafc', 3, 0.9, timestampSeed);
  const tailTarget = tail === 'down-right'
    ? { x: bounds.maxX - 18, y: bounds.maxY + 26 }
    : tail === 'straight'
      ? { x: bounds.centerX, y: bounds.maxY + 30 }
      : { x: bounds.minX + 18, y: bounds.maxY + 26 };
  const tailStroke = createStroke([
    { x: bounds.centerX, y: bounds.maxY - 2 },
    { x: tailTarget.x, y: tailTarget.y },
    { x: bounds.centerX + 10, y: bounds.maxY - 4 },
  ], '#f8fafc', 2.4, 0.84, timestampSeed + 110);
  const textStrokes = text === 'shout'
    ? [createLineStroke(bounds.minX + 20, bounds.centerY, bounds.maxX - 20, bounds.centerY, '#fb7185', 2.4, 0.74, timestampSeed + 160, 4)]
    : text === 'stacked'
      ? [
          createLineStroke(bounds.minX + 22, bounds.centerY - 12, bounds.maxX - 22, bounds.centerY - 12, '#cbd5e1', 2, 0.66, timestampSeed + 160, 3),
          createLineStroke(bounds.minX + 30, bounds.centerY + 10, bounds.maxX - 30, bounds.centerY + 10, '#cbd5e1', 2, 0.66, timestampSeed + 190, 3),
        ]
      : [createLineStroke(bounds.minX + 24, bounds.centerY, bounds.maxX - 36, bounds.centerY, '#cbd5e1', 2, 0.66, timestampSeed + 160, 3)];
  return [bubble, tailStroke, ...textStrokes];
};

const buildIslandStrokes = (bounds: ShapeIntentBounds, suggestion: ShapeIntentSuggestion, selections: ShapeIntentSelections, timestampSeed: number) => {
  const profile = getSingleSelection(selections, suggestion.parameters[0]);
  const surface = getSingleSelection(selections, suggestion.parameters[1]);
  const water = getSingleSelection(selections, suggestion.parameters[2]);
  const heightScale = profile === 'rock' ? 1.08 : profile === 'cliff' ? 1.28 : 0.74;
  const top = createLobeStroke(bounds.centerX, bounds.centerY, bounds.width / 2, (bounds.height / 2) * heightScale, profile === 'cliff' ? 0.08 : 0.18, '#f8fafc', 3, 0.86, timestampSeed);
  const surfaceStrokes = surface === 'trees'
    ? [
        createLobeStroke(bounds.centerX - (bounds.width * 0.16), bounds.minY + 22, 16, 18, 0.16, '#4ade80', 2, 0.72, timestampSeed + 120),
        createLobeStroke(bounds.centerX + (bounds.width * 0.12), bounds.minY + 16, 14, 16, 0.16, '#4ade80', 2, 0.72, timestampSeed + 150),
      ]
    : surface === 'stone'
      ? [createLineStroke(bounds.minX + 18, bounds.centerY - 18, bounds.maxX - 18, bounds.centerY - 8, '#cbd5e1', 2, 0.7, timestampSeed + 120, 4)]
      : [createLineStroke(bounds.minX + 14, bounds.centerY - 18, bounds.maxX - 14, bounds.centerY - 18, '#4ade80', 2, 0.7, timestampSeed + 120, 4)];
  const waterStroke = water === 'yes'
    ? [createLineStroke(bounds.minX - 18, bounds.maxY + 14, bounds.maxX + 18, bounds.maxY + 14, '#60a5fa', 2, 0.62, timestampSeed + 180, 3)]
    : [];
  return [top, ...surfaceStrokes, ...waterStroke];
};

const buildShouldersStrokes = (bounds: ShapeIntentBounds, suggestion: ShapeIntentSuggestion, selections: ShapeIntentSelections, timestampSeed: number) => {
  const width = getSingleSelection(selections, suggestion.parameters[0]);
  const angle = getSingleSelection(selections, suggestion.parameters[1]);
  const neck = getSingleSelection(selections, suggestion.parameters[2]);
  const shoulderWidth = width === 'broad' ? 0.96 : width === 'narrow' ? 0.72 : 0.84;
  const neckInset = neck === 'hidden' ? 0.02 : neck === 'thick' ? 0.12 : 0.08;
  const leftLift = angle === 'left-up' ? -bounds.height * 0.08 : angle === 'right-up' ? bounds.height * 0.03 : 0;
  const rightLift = angle === 'right-up' ? -bounds.height * 0.08 : angle === 'left-up' ? bounds.height * 0.03 : 0;
  return [
    createStroke([
      { x: bounds.centerX - (bounds.width * shoulderWidth * 0.5), y: bounds.centerY + leftLift },
      { x: bounds.centerX - (bounds.width * 0.18), y: bounds.minY + (bounds.height * (neckInset + 0.08)) },
      { x: bounds.centerX, y: bounds.minY + (bounds.height * neckInset) },
      { x: bounds.centerX + (bounds.width * 0.18), y: bounds.minY + (bounds.height * (neckInset + 0.08)) },
      { x: bounds.centerX + (bounds.width * shoulderWidth * 0.5), y: bounds.centerY + rightLift },
      { x: bounds.centerX + (bounds.width * 0.28), y: bounds.maxY - (bounds.height * 0.04) },
      { x: bounds.centerX - (bounds.width * 0.28), y: bounds.maxY - (bounds.height * 0.04) },
      { x: bounds.centerX - (bounds.width * shoulderWidth * 0.5), y: bounds.centerY + leftLift },
    ], '#fca5a5', 3.4, 0.92, timestampSeed),
    createLineStroke(
      bounds.centerX - (bounds.width * 0.16),
      bounds.minY + (bounds.height * neckInset),
      bounds.centerX + (bounds.width * 0.16),
      bounds.minY + (bounds.height * neckInset),
      '#fecaca',
      2.4,
      0.62,
      timestampSeed + 120,
      4,
    ),
  ];
};

const buildWarehouseWindowBankStrokes = (bounds: ShapeIntentBounds, suggestion: ShapeIntentSuggestion, selections: ShapeIntentSelections, timestampSeed: number) => {
  const panes = getSingleSelection(selections, suggestion.parameters[0]);
  const glow = getSingleSelection(selections, suggestion.parameters[1]);
  const damage = getSingleSelection(selections, suggestion.parameters[2]);
  const outer = createRectangleStroke(bounds, '#f8fafc', 3.6, 0.96, timestampSeed);
  const insetX = damage === 'barred' ? 10 : 14;
  const insetY = 10;
  const innerBounds = expandBounds(bounds, -insetX, -insetY);
  const verticalDivisions = panes === 'cross' ? 2 : panes === 'dense' ? 6 : 4;
  const horizontalDivisions = panes === 'cross' ? 2 : 2;
  const gridStrokes: PencilStroke[] = [createRectangleStroke(innerBounds, '#cbd5e1', 2.3, 0.78, timestampSeed + 32)];

  for (let index = 1; index < verticalDivisions; index += 1) {
    const x = innerBounds.minX + ((innerBounds.width / verticalDivisions) * index);
    gridStrokes.push(createLineStroke(x, innerBounds.minY, x, innerBounds.maxY, '#cbd5e1', damage === 'barred' ? 2.3 : 1.8, 0.72, timestampSeed + 64 + (index * 18), 3));
  }
  for (let index = 1; index < horizontalDivisions; index += 1) {
    const y = innerBounds.minY + ((innerBounds.height / horizontalDivisions) * index);
    gridStrokes.push(createLineStroke(innerBounds.minX, y, innerBounds.maxX, y, '#cbd5e1', 1.8, 0.72, timestampSeed + 160 + (index * 18), 3));
  }

  if (damage === 'broken') {
    gridStrokes.push(
      createLineStroke(innerBounds.minX + (innerBounds.width * 0.18), innerBounds.minY + 8, innerBounds.minX + (innerBounds.width * 0.28), innerBounds.maxY - 8, '#f8fafc', 1.8, 0.55, timestampSeed + 220, 5),
      createLineStroke(innerBounds.maxX - (innerBounds.width * 0.14), innerBounds.minY + 10, innerBounds.maxX - (innerBounds.width * 0.22), innerBounds.maxY - 18, '#f8fafc', 1.8, 0.48, timestampSeed + 248, 5),
    );
  }

  const glowOpacity = glow === 'low' ? 0.22 : glow === 'hazy' ? 0.34 : 0.46;
  const glowCount = glow === 'blown' ? 6 : glow === 'hazy' ? 4 : 2;
  const glowStrokes = Array.from({ length: glowCount }, (_, index) => {
    const x = innerBounds.minX + ((innerBounds.width / Math.max(2, glowCount - 1)) * index);
    const spread = glow === 'blown' ? bounds.width * 0.08 : bounds.width * 0.05;
    return createLineStroke(
      x,
      innerBounds.minY + 2,
      x + spread,
      bounds.maxY + (bounds.height * 0.24),
      '#f8fafc',
      glow === 'blown' ? 3.1 : 2.4,
      glowOpacity,
      timestampSeed + 320 + (index * 20),
      3,
    );
  });

  return [outer, ...gridStrokes, ...glowStrokes];
};

const buildAlleyWallStrokes = (bounds: ShapeIntentBounds, suggestion: ShapeIntentSuggestion, selections: ShapeIntentSelections, timestampSeed: number) => {
  const side = getSingleSelection(selections, suggestion.parameters[0]);
  const windows = getSingleSelection(selections, suggestion.parameters[1]);
  const depth = getSingleSelection(selections, suggestion.parameters[2]);
  const left = side === 'right' ? bounds.minX + (bounds.width * 0.18) : bounds.minX;
  const right = side === 'left' ? bounds.maxX - (bounds.width * 0.18) : bounds.maxX;
  const taper = depth === 'hero' ? 0.18 : depth === 'shallow' ? 0.06 : 0.12;
  const leanLeft = side === 'right' ? bounds.width * taper : 0;
  const leanRight = side === 'left' ? bounds.width * taper : 0;
  const plane = createStroke([
    { x: left + leanLeft, y: bounds.minY },
    { x: right - leanRight, y: bounds.minY },
    { x: right, y: bounds.maxY },
    { x: left, y: bounds.maxY },
    { x: left + leanLeft, y: bounds.minY },
  ], '#f8fafc', 2.7, 0.84, timestampSeed);
  const seam = createLineStroke(
    left + ((right - left) * (side === 'right' ? 0.24 : 0.72)),
    bounds.minY,
    left + ((right - left) * (side === 'right' ? 0.12 : 0.88)),
    bounds.maxY,
    '#cbd5e1',
    1.6,
    0.48,
    timestampSeed + 30,
    3,
  );
  const windowCount = windows === 'hot' ? 8 : windows === 'dark' ? 2 : 4;
  const windowOpacity = windows === 'hot' ? 0.58 : windows === 'dark' ? 0.18 : 0.34;
  const windowStrokes = Array.from({ length: windowCount }, (_, index) => {
    const row = Math.floor(index / 2);
    const col = index % 2;
    const width = bounds.width * 0.12;
    const height = bounds.height * 0.05;
    const x = left + (bounds.width * (side === 'right' ? 0.18 : 0.48)) + (col * bounds.width * 0.14);
    const y = bounds.minY + (bounds.height * (0.18 + (row * 0.14)));
    return createRectangleStroke({
      minX: x,
      maxX: x + width,
      minY: y,
      maxY: y + height,
      width,
      height,
      centerX: x + (width / 2),
      centerY: y + (height / 2),
    }, '#f8fafc', 1, windowOpacity, timestampSeed + 60 + (index * 12));
  });
  return [plane, seam, ...windowStrokes];
};

const buildCrateStackStrokes = (bounds: ShapeIntentBounds, suggestion: ShapeIntentSuggestion, selections: ShapeIntentSelections, timestampSeed: number) => {
  const stack = getSingleSelection(selections, suggestion.parameters[0]);
  const damage = getSingleSelection(selections, suggestion.parameters[1]);
  const perspective = getSingleSelection(selections, suggestion.parameters[2]);
  const baseDepth = perspective === 'hero' ? 0.16 : perspective === 'front' ? 0.08 : 0.12;
  const crateDefinitions = stack === 'single'
    ? [{ x: 0, y: 0, scale: 1 }]
    : stack === 'pile'
      ? [{ x: -0.12, y: 0.18, scale: 0.74 }, { x: 0.14, y: 0.12, scale: 0.8 }, { x: 0, y: -0.08, scale: 1 }]
      : [{ x: 0, y: 0.12, scale: 0.88 }, { x: 0, y: -0.12, scale: 1 }];
  const strokeColor = damage === 'wet' ? '#cbd5e1' : '#e5e7eb';
  const scratchesOpacity = damage === 'clean' ? 0.24 : damage === 'wet' ? 0.38 : 0.48;
  const strokes: PencilStroke[] = [];

  crateDefinitions.forEach((definition, index) => {
    const crateBounds = expandBounds({
      ...bounds,
      minX: bounds.centerX - ((bounds.width * definition.scale) / 2) + (bounds.width * definition.x),
      maxX: bounds.centerX + ((bounds.width * definition.scale) / 2) + (bounds.width * definition.x),
      minY: bounds.centerY - ((bounds.height * definition.scale) / 2) + (bounds.height * definition.y),
      maxY: bounds.centerY + ((bounds.height * definition.scale) / 2) + (bounds.height * definition.y),
      width: bounds.width * definition.scale,
      height: bounds.height * definition.scale,
      centerX: bounds.centerX + (bounds.width * definition.x),
      centerY: bounds.centerY + (bounds.height * definition.y),
    }, 0, 0);
    strokes.push(createRectangleStroke(crateBounds, strokeColor, 2.8, 0.9, timestampSeed + (index * 110)));
    strokes.push(createLineStroke(crateBounds.minX, crateBounds.minY + (crateBounds.height * baseDepth), crateBounds.maxX, crateBounds.minY + (crateBounds.height * baseDepth), strokeColor, 2, 0.72, timestampSeed + 36 + (index * 110), 3));
    strokes.push(createLineStroke(crateBounds.minX + (crateBounds.width * 0.2), crateBounds.minY, crateBounds.minX + (crateBounds.width * 0.2), crateBounds.maxY, strokeColor, 1.6, 0.62, timestampSeed + 54 + (index * 110), 3));
    strokes.push(createLineStroke(crateBounds.minX + (crateBounds.width * 0.5), crateBounds.minY, crateBounds.minX + (crateBounds.width * 0.5), crateBounds.maxY, strokeColor, 1.6, 0.62, timestampSeed + 72 + (index * 110), 3));
    if (damage !== 'clean') {
      strokes.push(createLineStroke(crateBounds.minX + (crateBounds.width * 0.1), crateBounds.centerY, crateBounds.maxX - (crateBounds.width * 0.16), crateBounds.centerY + (crateBounds.height * 0.06), '#f8fafc', 1.5, scratchesOpacity, timestampSeed + 90 + (index * 110), 4));
    }
    if (damage === 'broken') {
      strokes.push(createLineStroke(crateBounds.maxX - (crateBounds.width * 0.22), crateBounds.minY + (crateBounds.height * 0.14), crateBounds.maxX, crateBounds.minY + (crateBounds.height * 0.28), '#f8fafc', 1.8, 0.42, timestampSeed + 108 + (index * 110), 3));
    }
  });

  return strokes;
};

const buildConiferWallStrokes = (bounds: ShapeIntentBounds, suggestion: ShapeIntentSuggestion, selections: ShapeIntentSelections, timestampSeed: number) => {
  const density = getSingleSelection(selections, suggestion.parameters[0]);
  const slope = getSingleSelection(selections, suggestion.parameters[1]);
  const breaks = getSingleSelection(selections, suggestion.parameters[2]);
  const treeCount = density === 'open' ? 8 : density === 'crush' ? 18 : 13;
  const slopeOffset = slope === 'rise' ? -0.18 : slope === 'drop' ? 0.18 : 0;
  const strokes: PencilStroke[] = [];

  for (let index = 0; index < treeCount; index += 1) {
    const t = treeCount <= 1 ? 0.5 : index / (treeCount - 1);
    const x = bounds.minX + (bounds.width * t);
    const localSlope = bounds.height * slopeOffset * (t - 0.5);
    const treeHeight = bounds.height * (0.46 + ((index % 4) * 0.08));
    const apexY = bounds.minY + (bounds.height * 0.04) + localSlope + ((index % 3) * bounds.height * 0.01);
    const baseY = bounds.maxY - (bounds.height * (0.06 + ((index % 2) * 0.02)));
    const treeWidth = bounds.width * (density === 'crush' ? 0.05 : 0.065);
    strokes.push(
      createStroke([
        { x, y: apexY },
        { x: x - treeWidth, y: apexY + (treeHeight * 0.34) },
        { x: x + (treeWidth * 0.1), y: apexY + (treeHeight * 0.28) },
        { x: x - (treeWidth * 1.14), y: apexY + (treeHeight * 0.62) },
        { x: x + (treeWidth * 0.16), y: baseY },
        { x: x + (treeWidth * 1.08), y: apexY + (treeHeight * 0.6) },
        { x: x - (treeWidth * 0.1), y: apexY + (treeHeight * 0.28) },
        { x: x + treeWidth, y: apexY + (treeHeight * 0.34) },
        { x, y: apexY },
      ], '#f8fafc', 1.8, 0.72, timestampSeed + (index * 18)),
      createLineStroke(x, apexY + (treeHeight * 0.2), x, baseY + (bounds.height * 0.02), '#cbd5e1', 1.1, 0.4, timestampSeed + 6 + (index * 18), 3),
    );
  }

  if (breaks !== 'clean') {
    const fallenCount = breaks === 'blasted' ? 6 : 3;
    for (let index = 0; index < fallenCount; index += 1) {
      const startX = bounds.minX + (bounds.width * (0.08 + (index * 0.18)));
      const startY = bounds.maxY - (bounds.height * (0.14 + ((index % 2) * 0.06)));
      strokes.push(
        createLineStroke(startX, startY, startX + (bounds.width * 0.16), startY + (bounds.height * 0.08), '#cbd5e1', 1.6, breaks === 'blasted' ? 0.4 : 0.28, timestampSeed + 300 + (index * 20), 4),
      );
    }
  }

  return strokes;
};

const buildArmoredVehicleStrokes = (bounds: ShapeIntentBounds, suggestion: ShapeIntentSuggestion, selections: ShapeIntentSelections, timestampSeed: number) => {
  const body = getSingleSelection(selections, suggestion.parameters[0]);
  const turret = getSingleSelection(selections, suggestion.parameters[1]);
  const view = getSingleSelection(selections, suggestion.parameters[2]);
  const hullTopY = bounds.minY + (view === 'hero' ? bounds.height * 0.34 : view === 'profile' ? bounds.height * 0.42 : bounds.height * 0.38);
  const noseX = view === 'profile' ? bounds.maxX - (bounds.width * 0.08) : bounds.maxX;
  const rearX = bounds.minX + (view === 'hero' ? bounds.width * 0.06 : bounds.width * 0.12);
  const hullStroke = createStroke([
    { x: rearX, y: bounds.maxY - (bounds.height * 0.08) },
    { x: bounds.minX + (bounds.width * 0.18), y: hullTopY + (bounds.height * 0.04) },
    { x: bounds.centerX + (bounds.width * 0.08), y: hullTopY },
    { x: noseX, y: hullTopY + (view === 'profile' ? bounds.height * 0.02 : bounds.height * 0.08) },
    { x: bounds.maxX - (bounds.width * 0.06), y: bounds.maxY - (bounds.height * 0.06) },
    { x: rearX, y: bounds.maxY - (bounds.height * 0.08) },
  ], '#f8fafc', 2.4, 0.84, timestampSeed);
  const treadY = bounds.maxY - (bounds.height * 0.02);
  const treadStroke = createLineStroke(bounds.minX + (bounds.width * 0.1), treadY, bounds.maxX - (bounds.width * 0.1), treadY, '#cbd5e1', 2.2, 0.64, timestampSeed + 24, 4);
  const wheelStrokes = Array.from({ length: 4 }, (_, index) => {
    const cx = bounds.minX + (bounds.width * (0.24 + (index * 0.18)));
    return createEllipseStroke(cx, treadY - (bounds.height * 0.02), bounds.width * 0.04, bounds.height * 0.035, '#cbd5e1', 1.1, 0.4, timestampSeed + 48 + (index * 10), 14);
  });
  const turretStrokes: PencilStroke[] = [];
  if (turret !== 'none') {
    const turretBounds = {
      minX: bounds.centerX - (bounds.width * 0.14),
      maxX: bounds.centerX + (bounds.width * 0.08),
      minY: hullTopY - (bounds.height * 0.12),
      maxY: hullTopY - (bounds.height * 0.02),
      width: bounds.width * 0.22,
      height: bounds.height * 0.1,
      centerX: bounds.centerX - (bounds.width * 0.03),
      centerY: hullTopY - (bounds.height * 0.07),
    };
    turretStrokes.push(createRoundedRectangleStroke(turretBounds, 6, '#f8fafc', 1.8, 0.76, timestampSeed + 94));
    const gunEndY = turret === 'elevated' ? turretBounds.centerY - (bounds.height * 0.14) : turretBounds.centerY - (bounds.height * 0.02);
    const gunEndX = body === 'carrier' ? bounds.maxX - (bounds.width * 0.06) : bounds.maxX + (bounds.width * 0.12);
    turretStrokes.push(createLineStroke(turretBounds.maxX, turretBounds.centerY, gunEndX, gunEndY, '#f8fafc', 1.8, 0.74, timestampSeed + 116, 3));
  }
  if (body === 'self-propelled') {
    turretStrokes.push(createLineStroke(bounds.centerX, hullTopY - (bounds.height * 0.08), bounds.maxX + (bounds.width * 0.18), hullTopY - (bounds.height * 0.16), '#f8fafc', 1.6, 0.58, timestampSeed + 138, 3));
  }
  return [hullStroke, treadStroke, ...wheelStrokes, ...turretStrokes];
};

const buildFireEscapeStrokes = (bounds: ShapeIntentBounds, suggestion: ShapeIntentSuggestion, selections: ShapeIntentSelections, timestampSeed: number) => {
  const flights = getSingleSelection(selections, suggestion.parameters[0]);
  const stairs = getSingleSelection(selections, suggestion.parameters[1]);
  const landing = getSingleSelection(selections, suggestion.parameters[2]);
  const levels = flights === 'single' ? 1 : flights === 'tall' ? 4 : 3;
  const landingWidth = landing === 'wide' ? bounds.width * 0.62 : landing === 'narrow' ? bounds.width * 0.44 : bounds.width * 0.54;
  const strokes: PencilStroke[] = [];

  for (let level = 0; level < levels; level += 1) {
    const y = bounds.minY + (bounds.height * (0.16 + (level * (0.18 + (flights === 'tall' ? 0.04 : 0)))));
    const leftX = bounds.centerX - (landingWidth / 2);
    const rightX = bounds.centerX + (landingWidth / 2);
    strokes.push(
      createLineStroke(leftX, y, rightX, y, '#f8fafc', 2.1, 0.76, timestampSeed + (level * 40), 3),
      createLineStroke(leftX, y, leftX, y + (bounds.height * 0.08), '#cbd5e1', 1.4, 0.54, timestampSeed + 12 + (level * 40), 2),
      createLineStroke(rightX, y, rightX, y + (bounds.height * 0.08), '#cbd5e1', 1.4, 0.54, timestampSeed + 18 + (level * 40), 2),
    );
    if (landing === 'cage') {
      strokes.push(
        createLineStroke(leftX, y - (bounds.height * 0.04), leftX, y + (bounds.height * 0.02), '#cbd5e1', 1.1, 0.46, timestampSeed + 24 + (level * 40), 2),
        createLineStroke(rightX, y - (bounds.height * 0.04), rightX, y + (bounds.height * 0.02), '#cbd5e1', 1.1, 0.46, timestampSeed + 30 + (level * 40), 2),
      );
    }
  }

  const stairRuns = stairs === 'straight' ? levels : levels + 1;
  for (let index = 0; index < stairRuns; index += 1) {
    const startY = bounds.minY + (bounds.height * (0.2 + (index * 0.16)));
    const direction = stairs === 'dense' ? (index % 2 === 0 ? 1 : -1) : (index % 2 === 0 ? -1 : 1);
    strokes.push(
      createLineStroke(
        bounds.centerX + (direction * bounds.width * 0.18),
        startY,
        bounds.centerX - (direction * bounds.width * 0.12),
        startY + (bounds.height * 0.12),
        '#f8fafc',
        1.8,
        0.72,
        timestampSeed + 180 + (index * 26),
        4,
      ),
    );
  }

  return strokes;
};

const buildDumpsterBankStrokes = (bounds: ShapeIntentBounds, suggestion: ShapeIntentSuggestion, selections: ShapeIntentSelections, timestampSeed: number) => {
  const count = getSingleSelection(selections, suggestion.parameters[0]);
  const lid = getSingleSelection(selections, suggestion.parameters[1]);
  const wear = getSingleSelection(selections, suggestion.parameters[2]);
  const dumpsterCount = count === 'single' ? 1 : count === 'row' ? 3 : 2;
  const strokes: PencilStroke[] = [];
  const width = bounds.width / (dumpsterCount + 0.35);
  const height = bounds.height * 0.72;

  for (let index = 0; index < dumpsterCount; index += 1) {
    const x = bounds.minX + (index * width * 0.92);
    const dumpsterBounds = {
      minX: x,
      maxX: x + width,
      minY: bounds.maxY - height,
      maxY: bounds.maxY,
      width,
      height,
      centerX: x + (width / 2),
      centerY: bounds.maxY - (height / 2),
    };
    strokes.push(createRoundedRectangleStroke(dumpsterBounds, 8, '#f8fafc', 2.4, 0.8, timestampSeed + (index * 52)));
    const lidOpen = lid === 'open' || (lid === 'mixed' && index % 2 === 0);
    if (lidOpen) {
      strokes.push(
        createLineStroke(dumpsterBounds.minX + 4, dumpsterBounds.minY, dumpsterBounds.minX - (width * 0.12), dumpsterBounds.minY - (height * 0.18), '#cbd5e1', 1.7, 0.58, timestampSeed + 16 + (index * 52), 3),
        createLineStroke(dumpsterBounds.maxX - 4, dumpsterBounds.minY, dumpsterBounds.maxX + (width * 0.04), dumpsterBounds.minY - (height * 0.12), '#cbd5e1', 1.7, 0.58, timestampSeed + 24 + (index * 52), 3),
      );
    } else {
      strokes.push(createLineStroke(dumpsterBounds.minX + 4, dumpsterBounds.minY, dumpsterBounds.maxX - 4, dumpsterBounds.minY, '#cbd5e1', 1.5, 0.46, timestampSeed + 18 + (index * 52), 3));
    }
    if (wear !== 'clean') {
      strokes.push(createLineStroke(dumpsterBounds.minX + (width * 0.18), dumpsterBounds.centerY, dumpsterBounds.maxX - (width * 0.12), dumpsterBounds.centerY + (height * 0.08), '#f8fafc', 1.3, wear === 'beat' ? 0.44 : 0.32, timestampSeed + 32 + (index * 52), 4));
    }
  }

  return strokes;
};

const buildLightBeamStrokes = (bounds: ShapeIntentBounds, suggestion: ShapeIntentSuggestion, selections: ShapeIntentSelections, timestampSeed: number) => {
  const spread = getSingleSelection(selections, suggestion.parameters[0]);
  const intensity = getSingleSelection(selections, suggestion.parameters[1]);
  const angle = getSingleSelection(selections, suggestion.parameters[2]);
  const spreadAmount = spread === 'narrow' ? 0.05 : spread === 'wide' ? 0.16 : 0.1;
  const opacity = intensity === 'soft' ? 0.22 : intensity === 'blown' ? 0.5 : 0.38;
  const width = intensity === 'blown' ? 3.4 : intensity === 'soft' ? 2.2 : 2.8;
  const beamCount = angle === 'cross' ? 6 : 4;
  const startX = angle === 'vertical' ? bounds.centerX : bounds.minX + (bounds.width * 0.18);
  const endX = angle === 'vertical' ? bounds.centerX + (bounds.width * spreadAmount) : bounds.maxX - (bounds.width * 0.08);
  const diagonalOffset = angle === 'vertical' ? 0 : bounds.width * 0.12;
  const strokes: PencilStroke[] = [];

  for (let index = 0; index < beamCount; index += 1) {
    const t = beamCount === 1 ? 0.5 : index / (beamCount - 1);
    const offset = ((t - 0.5) * spreadAmount * bounds.width);
    strokes.push(
      createLineStroke(
        startX + offset - diagonalOffset,
        bounds.minY,
        endX + offset,
        bounds.maxY,
        '#f8fafc',
        width,
        opacity,
        timestampSeed + (index * 24),
        3,
      )
    );
  }

  if (angle === 'cross') {
    for (let index = 0; index < 3; index += 1) {
      const t = index / 2;
      const offset = ((t - 0.5) * spreadAmount * bounds.width * 0.8);
      strokes.push(
        createLineStroke(
          bounds.maxX - offset,
          bounds.minY,
          bounds.minX + (bounds.width * 0.22) - offset,
          bounds.maxY,
          '#f8fafc',
          width - 0.4,
          opacity * 0.84,
          timestampSeed + 160 + (index * 24),
          3,
        )
      );
    }
  }

  return strokes;
};

const buildLampCordStrokes = (bounds: ShapeIntentBounds, suggestion: ShapeIntentSuggestion, selections: ShapeIntentSelections, timestampSeed: number) => {
  const drop = getSingleSelection(selections, suggestion.parameters[0]);
  const fixture = getSingleSelection(selections, suggestion.parameters[1]);
  const light = getSingleSelection(selections, suggestion.parameters[2]);
  const bottomY = bounds.minY + (drop === 'short' ? bounds.height * 0.42 : drop === 'sag' ? bounds.height * 0.58 : bounds.height * 0.7);
  const linePoints = drop === 'sag'
    ? [
        { x: bounds.centerX - (bounds.width * 0.12), y: bounds.minY },
        { x: bounds.centerX + (bounds.width * 0.04), y: bounds.minY + (bounds.height * 0.26) },
        { x: bounds.centerX, y: bottomY },
      ]
    : [
        { x: bounds.centerX, y: bounds.minY },
        { x: bounds.centerX, y: bottomY },
      ];
  const strokes: PencilStroke[] = [
    createStroke(linePoints, '#f8fafc', 1.8, 0.74, timestampSeed),
  ];
  if (fixture !== 'simple') {
    strokes.push(createLineStroke(bounds.centerX - (bounds.width * 0.08), bounds.minY + 2, bounds.centerX + (bounds.width * 0.08), bounds.minY + 2, '#cbd5e1', 1.4, 0.5, timestampSeed + 16, 2));
  }
  if (light !== 'off') {
    strokes.push(createLineStroke(bounds.centerX, bottomY, bounds.centerX, bottomY + (bounds.height * 0.2), '#f8fafc', light === 'blown' ? 2.2 : 1.4, light === 'blown' ? 0.34 : 0.18, timestampSeed + 32, 3));
  }
  return strokes;
};

const buildFogBankStrokes = (bounds: ShapeIntentBounds, suggestion: ShapeIntentSuggestion, selections: ShapeIntentSelections, timestampSeed: number) => {
  const spread = getSingleSelection(selections, suggestion.parameters[0]);
  const density = getSingleSelection(selections, suggestion.parameters[1]);
  const edge = getSingleSelection(selections, suggestion.parameters[2]);
  const lobeScale = edge === 'broken' ? 0.24 : edge === 'rolling' ? 0.18 : 0.12;
  const opacity = density === 'light' ? 0.34 : density === 'heavy' ? 0.54 : 0.44;
  const widthScale = spread === 'tight' ? 0.82 : spread === 'wall' ? 1.18 : 1;
  const heightScale = spread === 'wall' ? 0.7 : 0.52;
  const yOffset = density === 'heavy' ? bounds.height * 0.08 : 0;
  return [
    createLobeStroke(bounds.centerX - (bounds.width * 0.18), bounds.centerY + yOffset, bounds.width * 0.3 * widthScale, bounds.height * heightScale * 0.36, lobeScale, '#f8fafc', 2.4, opacity, timestampSeed),
    createLobeStroke(bounds.centerX + (bounds.width * 0.04), bounds.centerY + yOffset, bounds.width * 0.34 * widthScale, bounds.height * heightScale * 0.34, lobeScale, '#e2e8f0', 2.3, opacity * 0.94, timestampSeed + 44),
    createLobeStroke(bounds.centerX + (bounds.width * 0.28), bounds.centerY + yOffset, bounds.width * 0.26 * widthScale, bounds.height * heightScale * 0.28, lobeScale, '#cbd5e1', 2.1, opacity * 0.9, timestampSeed + 88),
  ];
};

const buildTrenchFigureStrokes = (bounds: ShapeIntentBounds, suggestion: ShapeIntentSuggestion, selections: ShapeIntentSelections, timestampSeed: number) => {
  const stance = getSingleSelection(selections, suggestion.parameters[0]);
  const coat = getSingleSelection(selections, suggestion.parameters[1]);
  const hat = getSingleSelection(selections, suggestion.parameters[2]);
  const shoulderWidth = stance === 'standoff' ? 0.34 : stance === 'advance' ? 0.3 : stance === 'sprint' ? 0.26 : 0.28;
  const legSpread = stance === 'standoff' ? 0.22 : stance === 'advance' ? 0.16 : stance === 'sprint' ? 0.32 : 0.12;
  const coatLength = coat === 'short' ? 0.52 : coat === 'cape' ? 0.76 : 0.66;
  const headRadiusX = bounds.width * 0.12;
  const headRadiusY = bounds.height * 0.09;
  const coatBottomY = bounds.minY + (bounds.height * coatLength);
  const centerX = bounds.centerX;
  const silhouetteColor = '#f8fafc';
  const strokes: PencilStroke[] = [
    createEllipseStroke(centerX, bounds.minY + (bounds.height * 0.16), headRadiusX, headRadiusY, silhouetteColor, 3, 0.94, timestampSeed),
    createLineStroke(centerX - (bounds.width * shoulderWidth), bounds.minY + (bounds.height * 0.28), centerX - (bounds.width * 0.18), coatBottomY, silhouetteColor, 3.1, 0.92, timestampSeed + 34, 4),
    createLineStroke(centerX + (bounds.width * shoulderWidth), bounds.minY + (bounds.height * 0.28), centerX + (bounds.width * 0.18), coatBottomY, silhouetteColor, 3.1, 0.92, timestampSeed + 68, 4),
    createLineStroke(centerX - (bounds.width * shoulderWidth), bounds.minY + (bounds.height * 0.28), centerX + (bounds.width * shoulderWidth), bounds.minY + (bounds.height * 0.28), silhouetteColor, 2.5, 0.84, timestampSeed + 92, 3),
    createLineStroke(centerX, bounds.minY + (bounds.height * 0.28), centerX, coatBottomY - (bounds.height * 0.06), silhouetteColor, 2.6, 0.78, timestampSeed + 118, 3),
    createLineStroke(centerX - (bounds.width * 0.08), coatBottomY, centerX - (bounds.width * legSpread), bounds.maxY - (stance === 'sprint' ? bounds.height * 0.1 : 0), silhouetteColor, 2.8, 0.9, timestampSeed + 146, 4),
    createLineStroke(centerX + (bounds.width * 0.08), coatBottomY, centerX + (bounds.width * legSpread), bounds.maxY, silhouetteColor, 2.8, 0.9, timestampSeed + 180, 4),
  ];

  if (coat !== 'short') {
    strokes.push(createLineStroke(centerX - (bounds.width * 0.1), coatBottomY - (bounds.height * 0.08), centerX + (bounds.width * 0.12), coatBottomY - (bounds.height * 0.06), '#cbd5e1', 2.2, 0.54, timestampSeed + 210, 4));
  }
  if (hat === 'fedora') {
    strokes.push(
      createLineStroke(centerX - (headRadiusX * 1.2), bounds.minY + (bounds.height * 0.11), centerX + (headRadiusX * 1.2), bounds.minY + (bounds.height * 0.11), silhouetteColor, 2.2, 0.88, timestampSeed + 236, 3),
      createLineStroke(centerX - (headRadiusX * 0.5), bounds.minY + (bounds.height * 0.05), centerX + (headRadiusX * 0.5), bounds.minY + (bounds.height * 0.05), silhouetteColor, 2.1, 0.8, timestampSeed + 264, 3),
    );
  } else if (hat === 'hood') {
    strokes.push(createLobeStroke(centerX, bounds.minY + (bounds.height * 0.15), headRadiusX * 1.2, headRadiusY * 1.28, 0.12, '#e2e8f0', 2.2, 0.6, timestampSeed + 236));
  }
  if (stance === 'advance') {
    strokes.push(createLineStroke(centerX + (bounds.width * 0.1), bounds.minY + (bounds.height * 0.44), centerX + (bounds.width * 0.24), bounds.minY + (bounds.height * 0.54), '#cbd5e1', 2.2, 0.62, timestampSeed + 292, 4));
  } else if (stance === 'sprint') {
    strokes.push(
      createLineStroke(centerX + (bounds.width * 0.12), bounds.minY + (bounds.height * 0.42), centerX + (bounds.width * 0.28), bounds.minY + (bounds.height * 0.34), '#cbd5e1', 2.2, 0.72, timestampSeed + 292, 4),
      createLineStroke(centerX - (bounds.width * 0.1), bounds.minY + (bounds.height * 0.46), centerX - (bounds.width * 0.24), bounds.minY + (bounds.height * 0.58), '#cbd5e1', 2, 0.62, timestampSeed + 320, 4),
      createLineStroke(centerX - (bounds.width * 0.04), coatBottomY - (bounds.height * 0.06), centerX - (bounds.width * 0.26), coatBottomY - (bounds.height * 0.02), '#cbd5e1', 1.8, 0.34, timestampSeed + 348, 4),
      createLineStroke(centerX + (bounds.width * 0.02), coatBottomY, centerX + (bounds.width * 0.24), coatBottomY + (bounds.height * 0.04), '#cbd5e1', 1.8, 0.28, timestampSeed + 374, 4),
    );
  }

  return strokes;
};

const buildPuddleReflectionStrokes = (bounds: ShapeIntentBounds, suggestion: ShapeIntentSuggestion, selections: ShapeIntentSelections, timestampSeed: number) => {
  const size = getSingleSelection(selections, suggestion.parameters[0]);
  const reflection = getSingleSelection(selections, suggestion.parameters[1]);
  const debris = getSingleSelection(selections, suggestion.parameters[2]);
  const widthScale = size === 'tight' ? 0.74 : size === 'pool' ? 1.14 : 1;
  const opacity = reflection === 'dim' ? 0.38 : reflection === 'mirror' ? 0.72 : 0.58;
  const baseStroke = createLobeStroke(
    bounds.centerX,
    bounds.centerY,
    bounds.width * 0.48 * widthScale,
    bounds.height * 0.28,
    0.14,
    '#f8fafc',
    2.6,
    opacity,
    timestampSeed,
  );
  const reflectionCount = reflection === 'mirror' ? 5 : reflection === 'dim' ? 2 : 3;
  const reflectionStrokes = Array.from({ length: reflectionCount }, (_, index) => {
    const x = bounds.minX + (bounds.width * (0.2 + (index * 0.18)));
    const streakHeight = reflection === 'mirror' ? bounds.height * 0.34 : bounds.height * 0.22;
    return createLineStroke(
      x,
      bounds.centerY - (streakHeight * 0.25),
      x + (bounds.width * 0.04),
      bounds.centerY + streakHeight,
      '#f8fafc',
      reflection === 'mirror' ? 2.2 : 1.7,
      opacity * 0.9,
      timestampSeed + 44 + (index * 22),
      4,
    );
  });
  const debrisStrokes: PencilStroke[] = [];
  if (debris !== 'none') {
    const debrisCount = debris === 'heavy' ? 6 : 3;
    for (let index = 0; index < debrisCount; index += 1) {
      const x = bounds.minX + (bounds.width * (0.08 + ((index % 3) * 0.24)));
      const y = bounds.maxY - (bounds.height * (0.06 + (Math.floor(index / 3) * 0.12)));
      debrisStrokes.push(createLineStroke(x, y, x + (bounds.width * 0.06), y + (bounds.height * 0.02), '#cbd5e1', 1.6, 0.34, timestampSeed + 160 + (index * 18), 3));
    }
  }
  return [baseStroke, ...reflectionStrokes, ...debrisStrokes];
};

const buildSkylineClusterStrokes = (bounds: ShapeIntentBounds, suggestion: ShapeIntentSuggestion, selections: ShapeIntentSelections, timestampSeed: number) => {
  const density = getSingleSelection(selections, suggestion.parameters[0]);
  const glow = getSingleSelection(selections, suggestion.parameters[1]);
  const silhouette = getSingleSelection(selections, suggestion.parameters[2]);
  const towerCount = density === 'open' ? 6 : density === 'dense' ? 11 : 8;
  const towerWidth = bounds.width / towerCount;
  const strokes: PencilStroke[] = [];
  const glowOpacity = glow === 'sparse' ? 0.28 : glow === 'blown' ? 0.56 : 0.42;
  const heroLift = silhouette === 'spires' ? 0.34 : silhouette === 'flat' ? 0.18 : 0.26;

  for (let index = 0; index < towerCount; index += 1) {
    const x = bounds.minX + (towerWidth * index);
    const width = towerWidth * (index % 3 === 0 ? 1.05 : 0.86);
    const heightFactor = silhouette === 'flat'
      ? 0.46 + ((index % 2) * 0.06)
      : 0.44 + ((index % 4) * 0.08) + (index === Math.floor(towerCount / 2) ? heroLift : 0);
    const buildingBounds = {
      minX: x,
      maxX: x + width,
      minY: bounds.maxY - (bounds.height * heightFactor),
      maxY: bounds.maxY,
      width,
      height: bounds.height * heightFactor,
      centerX: x + (width / 2),
      centerY: bounds.maxY - ((bounds.height * heightFactor) / 2),
    };
    strokes.push(createRectangleStroke(buildingBounds, '#f8fafc', 2.1, 0.78, timestampSeed + (index * 44)));
    if (silhouette !== 'flat' && (index % 3 === 1 || index === Math.floor(towerCount / 2))) {
      strokes.push(
        createLineStroke(
          buildingBounds.centerX,
          buildingBounds.minY,
          buildingBounds.centerX,
          buildingBounds.minY - (buildingBounds.height * 0.16),
          '#f8fafc',
          1.7,
          0.7,
          timestampSeed + 18 + (index * 44),
          3,
        ),
      );
    }

    const rows = Math.max(2, Math.round(buildingBounds.height / 26));
    const cols = Math.max(1, Math.round(buildingBounds.width / 18));
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const shouldDraw = glow === 'sparse'
          ? (row + col + index) % 4 === 0
          : glow === 'blown'
            ? (row + col + index) % 2 === 0
            : (row + col + index) % 3 !== 0;
        if (!shouldDraw) continue;
        const windowWidth = Math.max(2, buildingBounds.width * 0.12);
        const windowHeight = Math.max(2, buildingBounds.height * 0.04);
        const windowX = buildingBounds.minX + (buildingBounds.width * 0.14) + (col * buildingBounds.width * 0.22);
        const windowY = buildingBounds.minY + (buildingBounds.height * 0.12) + (row * buildingBounds.height * 0.12);
        strokes.push(
          createRectangleStroke(
            {
              minX: windowX,
              maxX: windowX + windowWidth,
              minY: windowY,
              maxY: windowY + windowHeight,
              width: windowWidth,
              height: windowHeight,
              centerX: windowX + (windowWidth / 2),
              centerY: windowY + (windowHeight / 2),
            },
            '#f8fafc',
            1,
            glowOpacity,
            timestampSeed + 240 + (index * 20) + (row * 6) + col,
          ),
        );
      }
    }
  }

  return strokes;
};

const buildRooftopParapetStrokes = (bounds: ShapeIntentBounds, suggestion: ShapeIntentSuggestion, selections: ShapeIntentSelections, timestampSeed: number) => {
  const edge = getSingleSelection(selections, suggestion.parameters[0]);
  const angle = getSingleSelection(selections, suggestion.parameters[1]);
  const surface = getSingleSelection(selections, suggestion.parameters[2]);
  const edgeWeight = edge === 'thin' ? 0.12 : edge === 'standard' ? 0.18 : 0.24;
  const topY = bounds.minY + (bounds.height * (angle === 'flat' ? 0.54 : 0.42));
  const leftInset = angle === 'flat' ? bounds.width * 0.02 : angle === 'diagonal' ? bounds.width * 0.18 : bounds.width * 0.08;
  const rightInset = angle === 'diagonal' ? bounds.width * 0.04 : bounds.width * 0.18;
  const topStroke = createStroke([
    { x: bounds.minX + leftInset, y: topY },
    { x: bounds.maxX - rightInset, y: topY + (angle === 'flat' ? 0 : bounds.height * 0.1) },
    { x: bounds.maxX, y: bounds.maxY - (bounds.height * 0.06) },
    { x: bounds.minX, y: bounds.maxY - (bounds.height * 0.02) },
    { x: bounds.minX + leftInset, y: topY },
  ], '#f8fafc', 3.2, 0.9, timestampSeed);
  const lipStroke = createLineStroke(
    bounds.minX + leftInset,
    topY + (bounds.height * edgeWeight),
    bounds.maxX - rightInset,
    topY + (bounds.height * edgeWeight) + (angle === 'flat' ? 0 : bounds.height * 0.08),
    '#cbd5e1',
    2.2,
    0.72,
    timestampSeed + 44,
    4,
  );
  const surfaceStrokes: PencilStroke[] = [];
  if (surface !== 'dry') {
    const streakCount = surface === 'mirror' ? 5 : 3;
    for (let index = 0; index < streakCount; index += 1) {
      const x = bounds.minX + (bounds.width * (0.14 + (index * 0.16)));
      surfaceStrokes.push(
        createLineStroke(
          x,
          bounds.maxY - (bounds.height * 0.24),
          x + (bounds.width * 0.08),
          bounds.maxY - (bounds.height * 0.02),
          '#f8fafc',
          surface === 'mirror' ? 2 : 1.5,
          surface === 'mirror' ? 0.46 : 0.28,
          timestampSeed + 96 + (index * 24),
          4,
        ),
      );
    }
  }
  return [topStroke, lipStroke, ...surfaceStrokes];
};

const buildWaterTowerStrokes = (bounds: ShapeIntentBounds, suggestion: ShapeIntentSuggestion, selections: ShapeIntentSelections, timestampSeed: number) => {
  const tank = getSingleSelection(selections, suggestion.parameters[0]);
  const legs = getSingleSelection(selections, suggestion.parameters[1]);
  const catwalk = getSingleSelection(selections, suggestion.parameters[2]);
  const tankHeight = tank === 'squat' ? bounds.height * 0.3 : bounds.height * 0.38;
  const tankWidth = tank === 'cylindrical' ? bounds.width * 0.58 : bounds.width * 0.62;
  const tankBounds = {
    minX: bounds.centerX - (tankWidth / 2),
    maxX: bounds.centerX + (tankWidth / 2),
    minY: bounds.minY + (bounds.height * 0.08),
    maxY: bounds.minY + (bounds.height * 0.08) + tankHeight,
    width: tankWidth,
    height: tankHeight,
    centerX: bounds.centerX,
    centerY: bounds.minY + (bounds.height * 0.08) + (tankHeight / 2),
  };
  const strokes: PencilStroke[] = [
    createEllipseStroke(tankBounds.centerX, tankBounds.minY + 6, tankBounds.width / 2, tankHeight * 0.12, '#f8fafc', 2.4, 0.82, timestampSeed),
    createRectangleStroke(tankBounds, '#f8fafc', 2.6, 0.82, timestampSeed + 24),
    createEllipseStroke(tankBounds.centerX, tankBounds.maxY, tankBounds.width / 2, tankHeight * 0.12, '#cbd5e1', 2, 0.68, timestampSeed + 48),
  ];
  if (tank !== 'cylindrical') {
    strokes.push(createLineStroke(tankBounds.minX, tankBounds.centerY, tankBounds.maxX, tankBounds.centerY, '#cbd5e1', 1.8, 0.54, timestampSeed + 72, 3));
  }
  const legSpread = legs === 'heavy' ? 0.36 : legs === 'open' ? 0.44 : 0.4;
  const legWidth = legs === 'heavy' ? 2.4 : 1.9;
  const legTopY = tankBounds.maxY;
  const legBottomY = bounds.maxY;
  const leftOuterX = bounds.centerX - (bounds.width * legSpread);
  const leftInnerX = bounds.centerX - (bounds.width * 0.16);
  const rightInnerX = bounds.centerX + (bounds.width * 0.16);
  const rightOuterX = bounds.centerX + (bounds.width * legSpread);
  strokes.push(
    createLineStroke(leftInnerX, legTopY, leftOuterX, legBottomY, '#f8fafc', legWidth, 0.82, timestampSeed + 96, 3),
    createLineStroke(rightInnerX, legTopY, rightOuterX, legBottomY, '#f8fafc', legWidth, 0.82, timestampSeed + 124, 3),
    createLineStroke(leftInnerX + (bounds.width * 0.06), legTopY, bounds.centerX - (bounds.width * 0.06), legBottomY, '#f8fafc', legWidth - 0.2, 0.74, timestampSeed + 152, 3),
    createLineStroke(bounds.centerX + (bounds.width * 0.06), legTopY, rightInnerX - (bounds.width * 0.06), legBottomY, '#f8fafc', legWidth - 0.2, 0.74, timestampSeed + 180, 3),
  );
  if (legs === 'braced' || legs === 'heavy') {
    strokes.push(
      createLineStroke(leftOuterX, bounds.centerY + (bounds.height * 0.08), bounds.centerX, legBottomY - (bounds.height * 0.08), '#cbd5e1', 1.7, 0.56, timestampSeed + 206, 3),
      createLineStroke(rightOuterX, bounds.centerY + (bounds.height * 0.08), bounds.centerX, legBottomY - (bounds.height * 0.08), '#cbd5e1', 1.7, 0.56, timestampSeed + 232, 3),
    );
  }
  if (catwalk !== 'none') {
    const catwalkY = tankBounds.maxY - (tankHeight * 0.02);
    const offset = catwalk === 'offset' ? bounds.width * 0.16 : 0;
    strokes.push(
      createLineStroke(tankBounds.minX - (tankWidth * 0.12), catwalkY, tankBounds.maxX + (tankWidth * 0.12) + offset, catwalkY, '#cbd5e1', 1.8, 0.6, timestampSeed + 260, 3),
    );
  }
  return strokes;
};

const buildDoorwayFrameStrokes = (bounds: ShapeIntentBounds, suggestion: ShapeIntentSuggestion, selections: ShapeIntentSelections, timestampSeed: number) => {
  const opening = getSingleSelection(selections, suggestion.parameters[0]);
  const light = getSingleSelection(selections, suggestion.parameters[1]);
  const frame = getSingleSelection(selections, suggestion.parameters[2]);
  const inset = frame === 'thick' ? 18 : frame === 'industrial' ? 24 : 12;
  const outer = createRectangleStroke(bounds, '#f8fafc', 3.1, 0.86, timestampSeed);
  const inner = expandBounds(bounds, -inset, -inset);
  const innerStroke = createRectangleStroke(inner, '#cbd5e1', 2, 0.54, timestampSeed + 24);
  const strokes: PencilStroke[] = [outer, innerStroke];
  if (opening === 'ajar') {
    strokes.push(
      createLineStroke(inner.minX + (inner.width * 0.12), inner.minY, inner.maxX - (inner.width * 0.16), inner.minY + (inner.height * 0.1), '#f8fafc', 2.1, 0.72, timestampSeed + 52, 3),
      createLineStroke(inner.maxX - (inner.width * 0.16), inner.minY + (inner.height * 0.1), inner.maxX - (inner.width * 0.16), inner.maxY, '#f8fafc', 2.1, 0.72, timestampSeed + 70, 3),
    );
  }
  if (light !== 'dark') {
    const glowOpacity = light === 'backlit' ? 0.42 : 0.28;
    strokes.push(
      createLineStroke(inner.centerX, inner.minY + 4, inner.centerX, inner.maxY + (bounds.height * 0.1), '#f8fafc', light === 'backlit' ? 2.6 : 2, glowOpacity, timestampSeed + 96, 3),
    );
    if (light === 'fogged') {
      strokes.push(createLobeStroke(inner.centerX, inner.centerY, inner.width * 0.22, inner.height * 0.24, 0.18, '#f8fafc', 1.6, 0.24, timestampSeed + 128));
    }
  }
  return strokes;
};

const buildTrainCarSideStrokes = (bounds: ShapeIntentBounds, suggestion: ShapeIntentSuggestion, selections: ShapeIntentSelections, timestampSeed: number) => {
  const side = getSingleSelection(selections, suggestion.parameters[0]);
  const windows = getSingleSelection(selections, suggestion.parameters[1]);
  const stripe = getSingleSelection(selections, suggestion.parameters[2]);
  const bodyStroke = createRoundedRectangleStroke(bounds, 12, '#f8fafc', 2.8, 0.84, timestampSeed);
  const roofLine = createLineStroke(bounds.minX + (bounds.width * 0.02), bounds.minY + (bounds.height * 0.06), bounds.maxX - (bounds.width * 0.02), bounds.minY + (bounds.height * 0.06), '#cbd5e1', 1.8, 0.5, timestampSeed + 20, 3);
  const seamX = side === 'door-side' ? bounds.maxX - (bounds.width * 0.24) : side === 'speed' ? bounds.maxX - (bounds.width * 0.18) : bounds.centerX;
  const seamStroke = createLineStroke(seamX, bounds.minY + (bounds.height * 0.12), seamX, bounds.maxY - (bounds.height * 0.08), '#cbd5e1', 1.6, 0.54, timestampSeed + 42, 3);
  const stripes: PencilStroke[] = [];
  if (stripe !== 'none') {
    stripes.push(
      createLineStroke(bounds.minX + (bounds.width * 0.06), bounds.centerY + (bounds.height * 0.14), bounds.maxX - (bounds.width * 0.04), bounds.centerY + (bounds.height * 0.1), '#cbd5e1', 1.7, 0.56, timestampSeed + 64, 4),
    );
    if (stripe === 'double') {
      stripes.push(
        createLineStroke(bounds.minX + (bounds.width * 0.06), bounds.centerY + (bounds.height * 0.2), bounds.maxX - (bounds.width * 0.05), bounds.centerY + (bounds.height * 0.16), '#cbd5e1', 1.4, 0.42, timestampSeed + 86, 4),
      );
    }
  }
  const windowCount = windows === 'sparse' ? 3 : windows === 'lit' ? 5 : 4;
  const windowRightMargin = side === 'door-side' ? 0.3 : 0.12;
  const windowZoneWidth = bounds.width * (1 - windowRightMargin - 0.12);
  const windowStartX = bounds.minX + (bounds.width * 0.08);
  const windowWidth = windowZoneWidth / windowCount * 0.68;
  const windowHeight = bounds.height * 0.18;
  const windowStrokes = Array.from({ length: windowCount }, (_, index) => {
    const x = windowStartX + ((windowZoneWidth / windowCount) * index);
    const glowOpacity = windows === 'lit' && index % 2 === 0 ? 0.6 : windows === 'commuter' ? 0.42 : 0.3;
    return [
      createRoundedRectangleStroke({
        minX: x,
        maxX: x + windowWidth,
        minY: bounds.minY + (bounds.height * 0.18),
        maxY: bounds.minY + (bounds.height * 0.18) + windowHeight,
        width: windowWidth,
        height: windowHeight,
        centerX: x + (windowWidth / 2),
        centerY: bounds.minY + (bounds.height * 0.18) + (windowHeight / 2),
      }, 5, '#f8fafc', 1.6, 0.56, timestampSeed + 120 + (index * 16)),
      createLineStroke(x + (windowWidth * 0.12), bounds.minY + (bounds.height * 0.18) + (windowHeight * 0.5), x + (windowWidth * 0.88), bounds.minY + (bounds.height * 0.18) + (windowHeight * 0.5), '#f8fafc', 1.1, glowOpacity, timestampSeed + 128 + (index * 16), 3),
    ];
  }).flat();
  const motionStrokes: PencilStroke[] = [];
  if (side === 'speed') {
    for (let index = 0; index < 4; index += 1) {
      const y = bounds.minY + (bounds.height * (0.26 + (index * 0.14)));
      motionStrokes.push(
        createLineStroke(bounds.minX + (bounds.width * 0.02), y, bounds.minX + (bounds.width * 0.2), y - (bounds.height * 0.03), '#cbd5e1', 1.2, 0.22, timestampSeed + 220 + (index * 10), 3),
      );
    }
  }
  return [bodyStroke, roofLine, seamStroke, ...stripes, ...windowStrokes, ...motionStrokes];
};

const buildCarriageDoorStrokes = (bounds: ShapeIntentBounds, suggestion: ShapeIntentSuggestion, selections: ShapeIntentSelections, timestampSeed: number) => {
  const opening = getSingleSelection(selections, suggestion.parameters[0]);
  const light = getSingleSelection(selections, suggestion.parameters[1]);
  const handle = getSingleSelection(selections, suggestion.parameters[2]);
  const outer = createRoundedRectangleStroke(bounds, 10, '#f8fafc', 2.7, 0.84, timestampSeed);
  const inset = expandBounds(bounds, -Math.max(8, bounds.width * 0.08), -Math.max(8, bounds.height * 0.06));
  const centerSplitX = inset.centerX + (opening === 'mid' ? bounds.width * 0.06 : 0);
  const innerFrames: PencilStroke[] = [];
  if (opening === 'closed') {
    innerFrames.push(
      createLineStroke(centerSplitX, inset.minY, centerSplitX, inset.maxY, '#cbd5e1', 1.8, 0.62, timestampSeed + 28, 3),
    );
  } else if (opening === 'mid') {
    innerFrames.push(
      createLineStroke(inset.minX + (inset.width * 0.14), inset.minY, inset.minX + (inset.width * 0.14), inset.maxY, '#cbd5e1', 1.8, 0.62, timestampSeed + 28, 3),
      createLineStroke(inset.minX + (inset.width * 0.52), inset.minY, inset.minX + (inset.width * 0.52), inset.maxY, '#cbd5e1', 1.8, 0.62, timestampSeed + 52, 3),
    );
  } else {
    innerFrames.push(
      createLineStroke(inset.minX + (inset.width * 0.12), inset.minY, inset.minX + (inset.width * 0.12), inset.maxY, '#cbd5e1', 1.8, 0.62, timestampSeed + 28, 3),
      createLineStroke(inset.minX + (inset.width * 0.58), inset.minY, inset.minX + (inset.width * 0.58), inset.maxY, '#cbd5e1', 1.8, 0.62, timestampSeed + 52, 3),
    );
  }
  const glowStrokes: PencilStroke[] = [];
  if (light !== 'dark') {
    const glowOpacity = light === 'blown' ? 0.48 : 0.32;
    glowStrokes.push(
      createLineStroke(inset.centerX + (opening === 'open' ? inset.width * 0.18 : 0), inset.minY + 4, inset.centerX + (opening === 'open' ? inset.width * 0.18 : 0), inset.maxY + (bounds.height * 0.1), '#f8fafc', light === 'blown' ? 2.6 : 2.1, glowOpacity, timestampSeed + 82, 3),
      createLobeStroke(inset.centerX + (opening === 'open' ? inset.width * 0.18 : 0), inset.centerY, inset.width * 0.16, inset.height * 0.24, 0.14, '#f8fafc', 1.6, glowOpacity * 0.68, timestampSeed + 106),
    );
  }
  const handleStrokes: PencilStroke[] = [];
  if (handle !== 'none') {
    const handleX = handle === 'rail' ? inset.maxX - (inset.width * 0.16) : inset.centerX + (inset.width * 0.04);
    handleStrokes.push(
      createLineStroke(handleX, inset.minY + (inset.height * 0.26), handleX, inset.minY + (inset.height * 0.68), '#f8fafc', handle === 'rail' ? 2 : 1.6, 0.72, timestampSeed + 132, 3),
    );
  }
  return [outer, ...innerFrames, ...glowStrokes, ...handleStrokes];
};

const buildInterrogationTableStrokes = (bounds: ShapeIntentBounds, suggestion: ShapeIntentSuggestion, selections: ShapeIntentSelections, timestampSeed: number) => {
  const top = getSingleSelection(selections, suggestion.parameters[0]);
  const view = getSingleSelection(selections, suggestion.parameters[1]);
  const props = getSingleSelection(selections, suggestion.parameters[2]);
  const thickness = top === 'slim' ? bounds.height * 0.08 : top === 'heavy' ? bounds.height * 0.16 : bounds.height * 0.12;
  const frontY = bounds.minY + (view === 'profile' ? bounds.height * 0.44 : bounds.height * 0.5);
  const leftInset = view === 'hero' ? bounds.width * 0.06 : view === 'profile' ? bounds.width * 0.12 : bounds.width * 0.08;
  const rightInset = view === 'hero' ? bounds.width * 0.22 : view === 'profile' ? bounds.width * 0.12 : bounds.width * 0.16;
  const topPlane = createStroke([
    { x: bounds.minX + leftInset, y: frontY },
    { x: bounds.maxX - rightInset, y: frontY - (bounds.height * 0.04) },
    { x: bounds.maxX, y: frontY + thickness },
    { x: bounds.minX + (bounds.width * 0.1), y: frontY + thickness + (bounds.height * 0.04) },
    { x: bounds.minX + leftInset, y: frontY },
  ], '#f8fafc', 2.8, 0.86, timestampSeed);
  const frontEdge = createLineStroke(bounds.minX + (bounds.width * 0.1), frontY + thickness + (bounds.height * 0.04), bounds.maxX, frontY + thickness, '#cbd5e1', 2, 0.62, timestampSeed + 28, 3);
  const legStrokes = [
    createLineStroke(bounds.minX + (bounds.width * 0.2), frontY + thickness, bounds.minX + (bounds.width * 0.16), bounds.maxY, '#f8fafc', 2.2, 0.74, timestampSeed + 52, 3),
    createLineStroke(bounds.maxX - (bounds.width * 0.14), frontY + thickness, bounds.maxX - (bounds.width * 0.1), bounds.maxY, '#f8fafc', 2.2, 0.74, timestampSeed + 74, 3),
  ];
  const propStrokes: PencilStroke[] = [];
  if (props === 'ashtray') {
    propStrokes.push(
      createEllipseStroke(bounds.centerX, frontY + (thickness * 0.36), bounds.width * 0.06, bounds.height * 0.03, '#f8fafc', 1.5, 0.68, timestampSeed + 100, 24),
      createRoundedRectangleStroke({
        minX: bounds.maxX - (bounds.width * 0.22),
        maxX: bounds.maxX - (bounds.width * 0.08),
        minY: frontY + (thickness * 0.3),
        maxY: frontY + (thickness * 0.6),
        width: bounds.width * 0.14,
        height: thickness * 0.3,
        centerX: bounds.maxX - (bounds.width * 0.15),
        centerY: frontY + (thickness * 0.45),
      }, 4, '#cbd5e1', 1.3, 0.46, timestampSeed + 122),
    );
  } else if (props === 'files') {
    propStrokes.push(
      createRectangleStroke({
        minX: bounds.minX + (bounds.width * 0.28),
        maxX: bounds.minX + (bounds.width * 0.48),
        minY: frontY + (thickness * 0.2),
        maxY: frontY + (thickness * 0.5),
        width: bounds.width * 0.2,
        height: thickness * 0.3,
        centerX: bounds.minX + (bounds.width * 0.38),
        centerY: frontY + (thickness * 0.35),
      }, '#cbd5e1', 1.4, 0.5, timestampSeed + 100),
    );
  }
  return [topPlane, frontEdge, ...legStrokes, ...propStrokes];
};

const buildPlatformLightRunStrokes = (bounds: ShapeIntentBounds, suggestion: ShapeIntentSuggestion, selections: ShapeIntentSelections, timestampSeed: number) => {
  const spacing = getSingleSelection(selections, suggestion.parameters[0]);
  const bloom = getSingleSelection(selections, suggestion.parameters[1]);
  const perspective = getSingleSelection(selections, suggestion.parameters[2]);
  const fixtureCount = spacing === 'tight' ? 8 : spacing === 'hero' ? 5 : 6;
  const opacity = bloom === 'soft' ? 0.32 : bloom === 'blown' ? 0.72 : 0.54;
  const width = bloom === 'blown' ? 2.2 : 1.6;
  const startX = perspective === 'diagonal' ? bounds.minX + (bounds.width * 0.08) : bounds.minX + (bounds.width * 0.16);
  const endX = perspective === 'drop' ? bounds.centerX : bounds.minX + (bounds.width * 0.46);
  const startY = bounds.minY + (perspective === 'drop' ? bounds.height * 0.02 : bounds.height * 0.08);
  const endY = bounds.minY + (bounds.height * 0.58);
  const fixtures: PencilStroke[] = [];
  for (let index = 0; index < fixtureCount; index += 1) {
    const t = fixtureCount <= 1 ? 0.5 : index / (fixtureCount - 1);
    const x = startX + ((endX - startX) * t);
    const y = startY + ((endY - startY) * t);
    const lightWidth = bounds.width * (0.05 - (t * 0.024));
    const lightHeight = bounds.height * (0.025 - (t * 0.012));
    fixtures.push(
      createRoundedRectangleStroke({
        minX: x - (lightWidth / 2),
        maxX: x + (lightWidth / 2),
        minY: y - (lightHeight / 2),
        maxY: y + (lightHeight / 2),
        width: lightWidth,
        height: lightHeight,
        centerX: x,
        centerY: y,
      }, 4, '#f8fafc', width, opacity, timestampSeed + (index * 22)),
    );
    if (bloom !== 'soft') {
      fixtures.push(
        createLineStroke(x, y, x - (bounds.width * 0.04), y + (bounds.height * 0.1), '#f8fafc', 1.3, opacity * 0.34, timestampSeed + 10 + (index * 22), 3),
      );
    }
  }
  const guideLine = createLineStroke(startX, startY, endX, endY, '#cbd5e1', 1.1, 0.18, timestampSeed + 200, 3);
  return [guideLine, ...fixtures];
};

const buildHelicopterSilhouetteStrokes = (bounds: ShapeIntentBounds, suggestion: ShapeIntentSuggestion, selections: ShapeIntentSelections, timestampSeed: number) => {
  const body = getSingleSelection(selections, suggestion.parameters[0]);
  const bank = getSingleSelection(selections, suggestion.parameters[1]);
  const blur = getSingleSelection(selections, suggestion.parameters[2]);
  const noseLift = bank === 'rise' ? -bounds.height * 0.06 : bank === 'dive' ? bounds.height * 0.06 : 0;
  const bodyScale = body === 'transport' ? 1.18 : body === 'gunship' ? 0.92 : 1;
  const bodyStroke = createStroke([
    { x: bounds.minX + (bounds.width * 0.18), y: bounds.centerY + noseLift },
    { x: bounds.centerX - (bounds.width * 0.06), y: bounds.centerY - (bounds.height * 0.12) + noseLift },
    { x: bounds.centerX + (bounds.width * 0.12 * bodyScale), y: bounds.centerY - (bounds.height * 0.1) },
    { x: bounds.maxX - (bounds.width * 0.18), y: bounds.centerY + noseLift },
    { x: bounds.centerX + (bounds.width * 0.06), y: bounds.centerY + (bounds.height * 0.12) + noseLift },
    { x: bounds.minX + (bounds.width * 0.18), y: bounds.centerY + noseLift },
  ], '#f8fafc', 1.9, 0.76, timestampSeed);
  const tailStroke = createLineStroke(bounds.maxX - (bounds.width * 0.16), bounds.centerY + noseLift, bounds.maxX + (bounds.width * 0.18), bounds.centerY - (bounds.height * 0.02) + noseLift, '#f8fafc', 1.4, 0.68, timestampSeed + 22, 3);
  const rotorStroke = createLineStroke(bounds.centerX - (bounds.width * 0.34), bounds.centerY - (bounds.height * 0.12), bounds.centerX + (bounds.width * 0.34), bounds.centerY - (bounds.height * 0.14), '#f8fafc', 1.6, blur === 'clean' ? 0.72 : 0.42, timestampSeed + 44, 3);
  const tailRotor = createLineStroke(bounds.maxX + (bounds.width * 0.18), bounds.centerY - (bounds.height * 0.02) + noseLift, bounds.maxX + (bounds.width * 0.26), bounds.centerY - (bounds.height * 0.04) + noseLift, '#cbd5e1', 1.1, 0.5, timestampSeed + 60, 3);
  const blurStroke = blur === 'clean'
    ? []
    : [createLineStroke(bounds.centerX - (bounds.width * 0.42), bounds.centerY - (bounds.height * 0.14), bounds.centerX + (bounds.width * 0.42), bounds.centerY - (bounds.height * 0.16), '#cbd5e1', blur === 'wash' ? 2.4 : 2, blur === 'wash' ? 0.18 : 0.24, timestampSeed + 74, 3)];
  return [bodyStroke, tailStroke, rotorStroke, tailRotor, ...blurStroke];
};

const buildLightningForkStrokes = (bounds: ShapeIntentBounds, suggestion: ShapeIntentSuggestion, selections: ShapeIntentSelections, timestampSeed: number) => {
  const spread = getSingleSelection(selections, suggestion.parameters[0]);
  const intensity = getSingleSelection(selections, suggestion.parameters[1]);
  const direction = getSingleSelection(selections, suggestion.parameters[2]);
  const horizontalDrift = direction === 'left' ? -bounds.width * 0.16 : direction === 'right' ? bounds.width * 0.16 : 0;
  const branchScale = spread === 'tight' ? 0.08 : spread === 'wild' ? 0.2 : 0.14;
  const opacity = intensity === 'soft' ? 0.44 : intensity === 'blown' ? 0.92 : 0.72;
  const width = intensity === 'blown' ? 3.1 : intensity === 'soft' ? 2 : 2.5;
  const mainPoints = [
    { x: bounds.centerX, y: bounds.minY },
    { x: bounds.centerX + (horizontalDrift * 0.2), y: bounds.minY + (bounds.height * 0.18) },
    { x: bounds.centerX - (bounds.width * 0.05) + (horizontalDrift * 0.4), y: bounds.minY + (bounds.height * 0.38) },
    { x: bounds.centerX + (horizontalDrift * 0.6), y: bounds.minY + (bounds.height * 0.56) },
    { x: bounds.centerX + horizontalDrift, y: bounds.maxY },
  ];
  const strokes: PencilStroke[] = [
    createStroke(mainPoints, '#f8fafc', width, opacity, timestampSeed),
  ];
  const branchCount = spread === 'wild' ? 4 : spread === 'tight' ? 1 : 2;
  for (let index = 0; index < branchCount; index += 1) {
    const branchStart = mainPoints[Math.min(mainPoints.length - 2, 1 + index)];
    const branchDirection = index % 2 === 0 ? 1 : -1;
    strokes.push(
      createStroke([
        { x: branchStart.x, y: branchStart.y },
        { x: branchStart.x + (bounds.width * branchScale * branchDirection), y: branchStart.y + (bounds.height * 0.12) },
        { x: branchStart.x + (bounds.width * branchScale * 1.2 * branchDirection), y: branchStart.y + (bounds.height * 0.24) },
      ], '#f8fafc', width - 0.5, opacity * 0.84, timestampSeed + 44 + (index * 28)),
    );
  }
  return strokes;
};

const buildRainSheetStrokes = (bounds: ShapeIntentBounds, suggestion: ShapeIntentSuggestion, selections: ShapeIntentSelections, timestampSeed: number) => {
  const density = getSingleSelection(selections, suggestion.parameters[0]);
  const angle = getSingleSelection(selections, suggestion.parameters[1]);
  const depth = getSingleSelection(selections, suggestion.parameters[2]);
  const streakCount = density === 'light' ? 8 : density === 'storm' ? 22 : 14;
  const offsetX = angle === 'vertical' ? 0 : angle === 'crosswind' ? bounds.width * 0.08 : bounds.width * 0.04;
  const streakHeight = depth === 'foreground' ? bounds.height * 0.34 : depth === 'background' ? bounds.height * 0.16 : bounds.height * 0.24;
  const width = depth === 'foreground' ? 1.6 : 1.2;
  const opacity = density === 'storm' ? 0.38 : 0.24;
  return Array.from({ length: streakCount }, (_, index) => {
    const t = streakCount <= 1 ? 0.5 : index / (streakCount - 1);
    const startX = bounds.minX + (bounds.width * t);
    const startY = bounds.minY + ((index % 4) * bounds.height * 0.04);
    return createLineStroke(
      startX,
      startY,
      startX + offsetX,
      startY + streakHeight,
      '#e2e8f0',
      width,
      opacity,
      timestampSeed + (index * 10),
      3,
    );
  });
};

const buildCityMistStrokes = (bounds: ShapeIntentBounds, suggestion: ShapeIntentSuggestion, selections: ShapeIntentSelections, timestampSeed: number) => {
  const spread = getSingleSelection(selections, suggestion.parameters[0]);
  const lift = getSingleSelection(selections, suggestion.parameters[1]);
  const glow = getSingleSelection(selections, suggestion.parameters[2]);
  const widthScale = spread === 'tight' ? 0.78 : spread === 'wall' ? 1.22 : 1;
  const yLift = lift === 'low' ? bounds.height * 0.1 : lift === 'high' ? -bounds.height * 0.08 : 0;
  const glowOpacity = glow === 'soft' ? 0.32 : glow === 'blown' ? 0.54 : 0.42;
  return [
    createLobeStroke(bounds.centerX - (bounds.width * 0.2), bounds.centerY + yLift, bounds.width * 0.28 * widthScale, bounds.height * 0.18, 0.18, '#f8fafc', 2.2, glowOpacity, timestampSeed),
    createLobeStroke(bounds.centerX + (bounds.width * 0.04), bounds.centerY + yLift, bounds.width * 0.36 * widthScale, bounds.height * 0.2, 0.16, '#e2e8f0', 2.1, glowOpacity * 0.94, timestampSeed + 34),
    createLobeStroke(bounds.centerX + (bounds.width * 0.26), bounds.centerY + yLift, bounds.width * 0.22 * widthScale, bounds.height * 0.15, 0.2, '#cbd5e1', 1.8, glowOpacity * 0.84, timestampSeed + 68),
  ];
};

const buildSeatedFigureStrokes = (bounds: ShapeIntentBounds, suggestion: ShapeIntentSuggestion, selections: ShapeIntentSelections, timestampSeed: number) => {
  const pose = getSingleSelection(selections, suggestion.parameters[0]);
  const facing = getSingleSelection(selections, suggestion.parameters[1]);
  const hands = getSingleSelection(selections, suggestion.parameters[2]);
  const direction = facing === 'right' ? 1 : facing === 'front' ? 0 : -1;
  const headCenterX = bounds.centerX + (direction * bounds.width * 0.1);
  const headCenterY = bounds.minY + (bounds.height * 0.18);
  const shoulderY = bounds.minY + (bounds.height * 0.3);
  const torsoBottomY = bounds.minY + (bounds.height * (pose === 'collapsed' ? 0.7 : 0.62));
  const lean = pose === 'lean' ? bounds.width * 0.12 : pose === 'collapsed' ? bounds.width * 0.18 : bounds.width * 0.06;
  const silhouetteColor = '#f8fafc';
  const strokes: PencilStroke[] = [
    createEllipseStroke(headCenterX, headCenterY, bounds.width * 0.11, bounds.height * 0.08, silhouetteColor, 2.8, 0.9, timestampSeed),
    createStroke([
      { x: bounds.centerX - (bounds.width * 0.18), y: shoulderY },
      { x: bounds.centerX + (bounds.width * 0.06), y: shoulderY - (bounds.height * 0.04) },
      { x: bounds.centerX + lean, y: torsoBottomY },
      { x: bounds.centerX - (bounds.width * 0.08), y: bounds.maxY },
      { x: bounds.centerX - (bounds.width * 0.2), y: torsoBottomY },
      { x: bounds.centerX - (bounds.width * 0.18), y: shoulderY },
    ], silhouetteColor, 3, 0.86, timestampSeed + 30),
    createLineStroke(bounds.centerX - (bounds.width * 0.06), torsoBottomY - (bounds.height * 0.02), bounds.centerX - (bounds.width * 0.18), bounds.maxY, silhouetteColor, 2.2, 0.74, timestampSeed + 72, 3),
    createLineStroke(bounds.centerX + (bounds.width * 0.04), torsoBottomY, bounds.centerX + (bounds.width * 0.12), bounds.maxY, silhouetteColor, 2.2, 0.74, timestampSeed + 94, 3),
  ];
  if (hands === 'clasped' || hands === 'smoke') {
    strokes.push(
      createLineStroke(bounds.centerX - (bounds.width * 0.02), bounds.minY + (bounds.height * 0.44), bounds.centerX + (bounds.width * 0.18), bounds.minY + (bounds.height * 0.54), '#cbd5e1', 1.8, 0.62, timestampSeed + 120, 3),
    );
  }
  if (hands === 'smoke') {
    strokes.push(
      createLineStroke(bounds.centerX + (bounds.width * 0.18), bounds.minY + (bounds.height * 0.52), bounds.centerX + (bounds.width * 0.22), bounds.minY + (bounds.height * 0.48), '#f8fafc', 1.2, 0.74, timestampSeed + 146, 2),
    );
  }
  return strokes;
};

const buildRunnerFigureStrokes = (bounds: ShapeIntentBounds, suggestion: ShapeIntentSuggestion, selections: ShapeIntentSelections, timestampSeed: number) => {
  const action = getSingleSelection(selections, suggestion.parameters[0]);
  const facing = getSingleSelection(selections, suggestion.parameters[1]);
  const blur = getSingleSelection(selections, suggestion.parameters[2]);
  const direction = facing === 'left' ? -1 : facing === 'away' ? 0 : 1;
  const headX = direction === 0 ? bounds.centerX : bounds.centerX + (direction * bounds.width * 0.1);
  const headY = bounds.minY + (bounds.height * 0.18);
  const shoulderY = bounds.minY + (bounds.height * 0.3);
  const hipY = bounds.minY + (bounds.height * (action === 'board' ? 0.58 : 0.62));
  const stride = action === 'board' ? 0.28 : action === 'lunge' ? 0.22 : 0.34;
  const torsoLean = direction === 0 ? bounds.width * 0.04 : direction * bounds.width * (action === 'board' ? 0.18 : 0.14);
  const silhouetteColor = '#f8fafc';
  const body = createStroke([
    { x: bounds.centerX - (bounds.width * 0.1), y: shoulderY + (direction === 0 ? 0 : bounds.height * 0.02) },
    { x: bounds.centerX + (direction === 0 ? bounds.width * 0.08 : bounds.width * 0.12 * direction), y: shoulderY - (bounds.height * 0.04) },
    { x: bounds.centerX + torsoLean, y: hipY },
    { x: bounds.centerX - (bounds.width * 0.04), y: bounds.maxY - (bounds.height * 0.04) },
    { x: bounds.centerX - (bounds.width * 0.16), y: hipY + (bounds.height * 0.06) },
    { x: bounds.centerX - (bounds.width * 0.1), y: shoulderY + (direction === 0 ? 0 : bounds.height * 0.02) },
  ], silhouetteColor, 2.8, 0.84, timestampSeed + 24);
  const leadFootX = direction === 0 ? bounds.centerX + (bounds.width * 0.1) : bounds.centerX + (direction * bounds.width * stride);
  const rearFootX = direction === 0 ? bounds.centerX - (bounds.width * 0.08) : bounds.centerX - (direction * bounds.width * 0.08);
  const armLeadX = direction === 0 ? bounds.centerX + (bounds.width * 0.18) : bounds.centerX + (direction * bounds.width * 0.2);
  const armRearX = direction === 0 ? bounds.centerX - (bounds.width * 0.16) : bounds.centerX - (direction * bounds.width * 0.14);
  const strokes: PencilStroke[] = [
    createEllipseStroke(headX, headY, bounds.width * 0.09, bounds.height * 0.07, silhouetteColor, 2.4, 0.88, timestampSeed),
    body,
    createLineStroke(bounds.centerX + (direction === 0 ? bounds.width * 0.02 : direction * bounds.width * 0.04), hipY - (bounds.height * 0.02), leadFootX, bounds.maxY, silhouetteColor, 2.4, 0.82, timestampSeed + 52, 3),
    createLineStroke(bounds.centerX - (bounds.width * 0.06), hipY + (bounds.height * 0.02), rearFootX, bounds.maxY - (bounds.height * 0.12), silhouetteColor, 2.1, 0.72, timestampSeed + 74, 3),
    createLineStroke(bounds.centerX + (direction === 0 ? bounds.width * 0.02 : direction * bounds.width * 0.02), shoulderY + (bounds.height * 0.04), armLeadX, shoulderY + (bounds.height * 0.16), silhouetteColor, 2.1, 0.72, timestampSeed + 96, 3),
    createLineStroke(bounds.centerX - (bounds.width * 0.02), shoulderY + (bounds.height * 0.06), armRearX, shoulderY + (bounds.height * 0.12), silhouetteColor, 1.9, 0.62, timestampSeed + 118, 3),
  ];
  if (blur !== 'clean') {
    const echoOffset = blur === 'streak' ? bounds.width * 0.08 : bounds.width * 0.04;
    strokes.push(
      createLineStroke(headX - (direction * echoOffset * 0.8), headY + (bounds.height * 0.02), headX - (direction * echoOffset * 0.2), headY + (bounds.height * 0.06), '#cbd5e1', 1.4, blur === 'streak' ? 0.28 : 0.18, timestampSeed + 142, 3),
      createLineStroke(bounds.centerX - (direction * echoOffset), shoulderY + (bounds.height * 0.06), bounds.centerX + torsoLean - (direction * echoOffset * 0.2), hipY, '#cbd5e1', 1.6, blur === 'streak' ? 0.24 : 0.16, timestampSeed + 164, 3),
    );
  }
  return strokes;
};

const buildObserverPairStrokes = (bounds: ShapeIntentBounds, suggestion: ShapeIntentSuggestion, selections: ShapeIntentSelections, timestampSeed: number) => {
  const pose = getSingleSelection(selections, suggestion.parameters[0]);
  const facing = getSingleSelection(selections, suggestion.parameters[1]);
  const spacing = getSingleSelection(selections, suggestion.parameters[2]);
  const direction = facing === 'left' ? -1 : facing === 'away' ? 0 : 1;
  const separation = spacing === 'tight' ? 0.14 : spacing === 'staggered' ? 0.24 : 0.2;
  const rearYOffset = spacing === 'staggered' ? bounds.height * 0.08 : 0;
  const bodyLean = pose === 'scramble' ? bounds.width * 0.08 : pose === 'brace' ? bounds.width * 0.02 : bounds.width * 0.04;
  const firstCenterX = bounds.centerX - (bounds.width * separation);
  const secondCenterX = bounds.centerX + (bounds.width * 0.06);
  const buildObserver = (centerX: number, centerY: number, seedOffset: number) => {
    const headX = centerX + (direction * bounds.width * 0.04);
    const headY = centerY - (bounds.height * 0.14);
    return [
      createEllipseStroke(headX, headY, bounds.width * 0.06, bounds.height * 0.05, '#f8fafc', 1.8, 0.84, timestampSeed + seedOffset),
      createStroke([
        { x: centerX - (bounds.width * 0.1), y: centerY - (bounds.height * 0.04) },
        { x: centerX + (direction * bodyLean), y: centerY - (bounds.height * 0.1) },
        { x: centerX + (bounds.width * 0.12), y: centerY + (bounds.height * 0.08) },
        { x: centerX + (bounds.width * 0.02), y: bounds.maxY },
        { x: centerX - (bounds.width * 0.12), y: bounds.maxY - (bounds.height * 0.04) },
        { x: centerX - (bounds.width * 0.1), y: centerY - (bounds.height * 0.04) },
      ], '#f8fafc', 2.2, 0.78, timestampSeed + seedOffset + 16),
      createLineStroke(centerX - (bounds.width * 0.02), centerY + (bounds.height * 0.08), centerX - (bounds.width * 0.08), bounds.maxY, '#cbd5e1', 1.5, 0.54, timestampSeed + seedOffset + 36, 3),
      createLineStroke(centerX + (bounds.width * 0.06), centerY + (bounds.height * 0.08), centerX + (bounds.width * 0.12), bounds.maxY - (bounds.height * 0.02), '#cbd5e1', 1.5, 0.54, timestampSeed + seedOffset + 54, 3),
    ];
  };
  return [
    ...buildObserver(firstCenterX, bounds.centerY + rearYOffset, 0),
    ...buildObserver(secondCenterX, bounds.centerY, 94),
  ];
};

const buildTitanColossusStrokes = (bounds: ShapeIntentBounds, suggestion: ShapeIntentSuggestion, selections: ShapeIntentSelections, timestampSeed: number) => {
  const pose = getSingleSelection(selections, suggestion.parameters[0]);
  const roar = getSingleSelection(selections, suggestion.parameters[1]);
  const surface = getSingleSelection(selections, suggestion.parameters[2]);
  const armReach = pose === 'reach' ? bounds.width * 0.42 : pose === 'tower' ? bounds.width * 0.28 : bounds.width * 0.34;
  const torsoTopY = bounds.minY + (bounds.height * 0.18);
  const shoulderY = bounds.minY + (bounds.height * 0.28);
  const torsoBottomY = bounds.minY + (bounds.height * 0.72);
  const mouthHeight = roar === 'bellow' ? bounds.height * 0.14 : roar === 'open' ? bounds.height * 0.1 : bounds.height * 0.06;
  const textureOpacity = surface === 'spined' ? 0.48 : surface === 'rockhide' ? 0.34 : 0.22;
  const silhouette = createStroke([
    { x: bounds.centerX - (bounds.width * 0.18), y: torsoTopY },
    { x: bounds.centerX - (bounds.width * 0.34), y: shoulderY },
    { x: bounds.centerX - armReach, y: bounds.centerY + (bounds.height * 0.06) },
    { x: bounds.centerX - (bounds.width * 0.22), y: torsoBottomY },
    { x: bounds.centerX - (bounds.width * 0.12), y: bounds.maxY },
    { x: bounds.centerX + (bounds.width * 0.08), y: bounds.maxY - (bounds.height * 0.06) },
    { x: bounds.centerX + (bounds.width * 0.16), y: torsoBottomY },
    { x: bounds.centerX + armReach, y: bounds.centerY - (bounds.height * 0.02) },
    { x: bounds.centerX + (bounds.width * 0.28), y: shoulderY - (bounds.height * 0.02) },
    { x: bounds.centerX + (bounds.width * 0.12), y: torsoTopY - (bounds.height * 0.04) },
    { x: bounds.centerX - (bounds.width * 0.18), y: torsoTopY },
  ], '#f8fafc', 2.8, 0.84, timestampSeed);
  const head = createLobeStroke(bounds.centerX, bounds.minY + (bounds.height * 0.18), bounds.width * 0.15, bounds.height * 0.11, 0.12, '#f8fafc', 2.4, 0.82, timestampSeed + 24);
  const mouth = createEllipseStroke(bounds.centerX, bounds.minY + (bounds.height * 0.26), bounds.width * 0.08, mouthHeight, '#111827', 1.8, 0.82, timestampSeed + 48, 18);
  const reachArm = createStroke([
    { x: bounds.centerX + (bounds.width * 0.16), y: shoulderY + (bounds.height * 0.02) },
    { x: bounds.centerX + (bounds.width * 0.28), y: bounds.centerY - (bounds.height * 0.02) },
    { x: bounds.centerX + armReach, y: bounds.centerY - (bounds.height * 0.06) },
    { x: bounds.centerX + (armReach * 0.94), y: bounds.centerY + (bounds.height * 0.08) },
    { x: bounds.centerX + (bounds.width * 0.22), y: bounds.centerY + (bounds.height * 0.06) },
  ], '#f8fafc', 2.6, 0.82, timestampSeed + 72);
  const leftArm = createStroke([
    { x: bounds.centerX - (bounds.width * 0.2), y: shoulderY + (bounds.height * 0.02) },
    { x: bounds.centerX - (bounds.width * 0.34), y: bounds.centerY + (bounds.height * 0.02) },
    { x: bounds.centerX - armReach, y: bounds.centerY + (bounds.height * 0.12) },
    { x: bounds.centerX - (armReach * 0.86), y: bounds.centerY + (bounds.height * 0.18) },
  ], '#f8fafc', 2.2, 0.66, timestampSeed + 94);
  const textureStrokes: PencilStroke[] = [];
  const textureCount = surface === 'fur' ? 12 : surface === 'spined' ? 16 : 10;
  for (let index = 0; index < textureCount; index += 1) {
    const x = bounds.minX + (bounds.width * (0.16 + ((index % 5) * 0.14)));
    const y = torsoTopY + (bounds.height * (0.04 + (Math.floor(index / 5) * 0.16)));
    textureStrokes.push(
      createLineStroke(x, y, x + (bounds.width * 0.05), y + (surface === 'spined' ? -bounds.height * 0.03 : bounds.height * 0.03), '#cbd5e1', surface === 'spined' ? 1.6 : 1.3, textureOpacity, timestampSeed + 130 + (index * 12), 3),
    );
  }
  return [silhouette, head, mouth, reachArm, leftArm, ...textureStrokes];
};

const buildGuideStrokesForSuggestion = (
  analysis: ShapeIntentAnalysis,
  suggestion: ShapeIntentSuggestion,
  selections: ShapeIntentSelections,
): PencilStroke[] => {
  const bounds = analysis.bounds;
  const timestampSeed = Date.now();
  switch (suggestion.id) {
    case 'pizza':
      return buildPizzaStrokes(bounds, suggestion, selections, timestampSeed);
    case 'motorcycle-wheel':
      return buildWheelStrokes(bounds, suggestion, selections, timestampSeed);
    case 'round-table':
      return buildRoundTableStrokes(bounds, suggestion, selections, timestampSeed);
    case 'plate':
      return buildPlateStrokes(bounds, suggestion, selections, timestampSeed);
    case 'clock':
      return buildClockStrokes(bounds, suggestion, selections, timestampSeed);
    case 'head-mass':
      return buildHeadMassStrokes(bounds, suggestion, selections, timestampSeed);
    case 'pendant-lamp':
      return buildPendantLampStrokes(bounds, suggestion, selections, timestampSeed);
    case 'headlight-glare':
      return buildHeadlightGlareStrokes(bounds, suggestion, selections, timestampSeed);
    case 'alley-wall':
      return buildAlleyWallStrokes(bounds, suggestion, selections, timestampSeed);
    case 'train-car-side':
      return buildTrainCarSideStrokes(bounds, suggestion, selections, timestampSeed);
    case 'carriage-door':
      return buildCarriageDoorStrokes(bounds, suggestion, selections, timestampSeed);
    case 'window':
      return buildWindowStrokes(bounds, suggestion, selections, timestampSeed);
    case 'warehouse-window-bank':
      return buildWarehouseWindowBankStrokes(bounds, suggestion, selections, timestampSeed);
    case 'conifer-wall':
      return buildConiferWallStrokes(bounds, suggestion, selections, timestampSeed);
    case 'armored-vehicle':
      return buildArmoredVehicleStrokes(bounds, suggestion, selections, timestampSeed);
    case 'fire-escape':
      return buildFireEscapeStrokes(bounds, suggestion, selections, timestampSeed);
    case 'dumpster-bank':
      return buildDumpsterBankStrokes(bounds, suggestion, selections, timestampSeed);
    case 'skyline-cluster':
      return buildSkylineClusterStrokes(bounds, suggestion, selections, timestampSeed);
    case 'rooftop-parapet':
      return buildRooftopParapetStrokes(bounds, suggestion, selections, timestampSeed);
    case 'water-tower':
      return buildWaterTowerStrokes(bounds, suggestion, selections, timestampSeed);
    case 'doorway-frame':
      return buildDoorwayFrameStrokes(bounds, suggestion, selections, timestampSeed);
    case 'interrogation-table':
      return buildInterrogationTableStrokes(bounds, suggestion, selections, timestampSeed);
    case 'door':
      return buildDoorStrokes(bounds, suggestion, selections, timestampSeed);
    case 'monitor':
      return buildMonitorStrokes(bounds, suggestion, selections, timestampSeed);
    case 'sign-board':
      return buildSignBoardStrokes(bounds, suggestion, selections, timestampSeed);
    case 'phone':
      return buildPhoneStrokes(bounds, suggestion, selections, timestampSeed);
    case 'chair':
      return buildChairStrokes(bounds, suggestion, selections, timestampSeed);
    case 'chassis-block':
      return buildChassisBlockStrokes(bounds, suggestion, selections, timestampSeed);
    case 'sword':
      return buildSwordStrokes(bounds, suggestion, selections, timestampSeed);
    case 'horizon-line':
      return buildHorizonStrokes(bounds, suggestion, selections, timestampSeed);
    case 'boom-mic':
      return buildBoomMicStrokes(bounds, suggestion, selections, timestampSeed);
    case 'shelf':
      return buildShelfStrokes(bounds, suggestion, selections, timestampSeed);
    case 'lane-marking':
      return buildLaneStrokes(bounds, suggestion, selections, timestampSeed);
    case 'light-beam':
      return buildLightBeamStrokes(bounds, suggestion, selections, timestampSeed);
    case 'helicopter-silhouette':
      return buildHelicopterSilhouetteStrokes(bounds, suggestion, selections, timestampSeed);
    case 'platform-light-run':
      return buildPlatformLightRunStrokes(bounds, suggestion, selections, timestampSeed);
    case 'street-lamp-cord':
      return buildLampCordStrokes(bounds, suggestion, selections, timestampSeed);
    case 'lightning-fork':
      return buildLightningForkStrokes(bounds, suggestion, selections, timestampSeed);
    case 'rain-sheet':
      return buildRainSheetStrokes(bounds, suggestion, selections, timestampSeed);
    case 'cloud':
      return buildCloudStrokes(bounds, suggestion, selections, timestampSeed);
    case 'bush':
      return buildBushStrokes(bounds, suggestion, selections, timestampSeed);
    case 'smoke':
      return buildSmokeStrokes(bounds, suggestion, selections, timestampSeed);
    case 'fog-bank':
      return buildFogBankStrokes(bounds, suggestion, selections, timestampSeed);
    case 'city-mist':
      return buildCityMistStrokes(bounds, suggestion, selections, timestampSeed);
    case 'seated-figure':
      return buildSeatedFigureStrokes(bounds, suggestion, selections, timestampSeed);
    case 'runner-figure':
      return buildRunnerFigureStrokes(bounds, suggestion, selections, timestampSeed);
    case 'observer-pair':
      return buildObserverPairStrokes(bounds, suggestion, selections, timestampSeed);
    case 'titan-colossus':
      return buildTitanColossusStrokes(bounds, suggestion, selections, timestampSeed);
    case 'trench-figure':
      return buildTrenchFigureStrokes(bounds, suggestion, selections, timestampSeed);
    case 'puddle-reflection':
      return buildPuddleReflectionStrokes(bounds, suggestion, selections, timestampSeed);
    case 'speech-bubble':
      return buildSpeechBubbleStrokes(bounds, suggestion, selections, timestampSeed);
    case 'island':
      return buildIslandStrokes(bounds, suggestion, selections, timestampSeed);
    case 'shoulders':
      return buildShouldersStrokes(bounds, suggestion, selections, timestampSeed);
    case 'crate-stack':
      return buildCrateStackStrokes(bounds, suggestion, selections, timestampSeed);
    default:
      return analysis.normalizedGuideStrokes;
  }
};

const strokeToPolyline = (stroke: PencilStroke) => {
  const points = stroke.points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
  return `<polyline points="${points}" fill="none" stroke="${stroke.color}" stroke-width="${stroke.width.toFixed(2)}" stroke-linecap="round" stroke-linejoin="round" opacity="${stroke.opacity.toFixed(3)}" />`;
};

const allShapeIntentSuggestions = Object.values(primitiveSuggestionMap).flat();

const workflowSuggestionBoosts: Record<ShapeIntentWorkflowLevel, Partial<Record<string, number>>> = {
  idea: {
    pizza: 8,
    'speech-bubble': 8,
    cloud: 6,
    bush: 6,
  },
  blocking: {
    'round-table': 28,
    window: 22,
    'alley-wall': 24,
    'conifer-wall': 22,
    'armored-vehicle': 18,
    'train-car-side': 18,
    'carriage-door': 18,
    'interrogation-table': 22,
    'doorway-frame': 20,
    'fire-escape': 18,
    'dumpster-bank': 18,
    'crate-stack': 18,
    door: 20,
    shelf: 16,
    'lane-marking': 14,
    'sign-board': 12,
    'helicopter-silhouette': 10,
    monitor: 10,
  },
  shot: {
    'trench-figure': 28,
    'titan-colossus': 28,
    'observer-pair': 22,
    'seated-figure': 24,
    'light-beam': 26,
    'conifer-wall': 22,
    'armored-vehicle': 22,
    'helicopter-silhouette': 18,
    'warehouse-window-bank': 24,
    'alley-wall': 24,
    'train-car-side': 24,
    'carriage-door': 22,
    'doorway-frame': 22,
    'interrogation-table': 22,
    'platform-light-run': 24,
    'skyline-cluster': 24,
    'rooftop-parapet': 24,
    'lightning-fork': 22,
    'rain-sheet': 20,
    'city-mist': 18,
    'water-tower': 16,
    'fire-escape': 18,
    'dumpster-bank': 16,
    'runner-figure': 22,
    'puddle-reflection': 20,
    'fog-bank': 18,
    'crate-stack': 16,
    smoke: 16,
  },
  presentation: {
    'light-beam': 24,
    'warehouse-window-bank': 22,
    'alley-wall': 24,
    'train-car-side': 24,
    'carriage-door': 22,
    'doorway-frame': 22,
    'interrogation-table': 22,
    'platform-light-run': 24,
    'skyline-cluster': 24,
    'rooftop-parapet': 24,
    'lightning-fork': 22,
    'rain-sheet': 20,
    'city-mist': 18,
    'water-tower': 16,
    'fire-escape': 18,
    'dumpster-bank': 16,
    'seated-figure': 20,
    'runner-figure': 22,
    'trench-figure': 20,
    'titan-colossus': 28,
    'observer-pair': 22,
    'conifer-wall': 22,
    'armored-vehicle': 22,
    'helicopter-silhouette': 18,
    'puddle-reflection': 18,
    'fog-bank': 16,
    smoke: 16,
    monitor: 18,
    'sign-board': 16,
    window: 12,
    door: 12,
    phone: 10,
    clock: 8,
  },
};

const getUniqueSuggestionIds = (suggestionIds: string[] | undefined): string[] => {
  if (!suggestionIds?.length) {
    return [];
  }
  const seen = new Set<string>();
  return suggestionIds.filter((suggestionId) => {
    if (!suggestionId || seen.has(suggestionId)) {
      return false;
    }
    seen.add(suggestionId);
    return true;
  });
};

const rankShapeIntentSuggestions = (
  suggestions: ShapeIntentSuggestion[],
  context: ShapeIntentRankingContext | undefined,
): ShapeIntentSuggestion[] => {
  if (suggestions.length <= 1 || !context) {
    return suggestions;
  }

  const preferredSuggestionIds = getUniqueSuggestionIds(context.preferredSuggestionIds);
  const recentSuggestionIds = getUniqueSuggestionIds(context.recentSuggestionIds);
  const pinnedSuggestionIds = getUniqueSuggestionIds(context.pinnedSuggestionIds);
  const workflowBoosts = context.workflowLevel ? workflowSuggestionBoosts[context.workflowLevel] : {};

  return [...suggestions]
    .map((suggestion, index) => {
      const workflowBoost = workflowBoosts[suggestion.id] || 0;
      const preferredIndex = preferredSuggestionIds.indexOf(suggestion.id);
      const recentIndex = recentSuggestionIds.indexOf(suggestion.id);
      const pinnedIndex = pinnedSuggestionIds.indexOf(suggestion.id);
      const preferredBoost = preferredIndex >= 0 ? 120 - preferredIndex : 0;
      const recentBoost = recentIndex >= 0 ? 56 - recentIndex : 0;
      const pinnedBoost = pinnedIndex >= 0 ? 180 - pinnedIndex : 0;
      return {
        suggestion,
        index,
        score: workflowBoost + preferredBoost + recentBoost + pinnedBoost,
      };
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.index - right.index;
    })
    .map((entry) => entry.suggestion);
};

const getShapeIntentSuggestionsByIds = (suggestionIds: string[]): ShapeIntentSuggestion[] => (
  suggestionIds
    .map((suggestionId) => allShapeIntentSuggestions.find((suggestion) => suggestion.id === suggestionId))
    .filter((suggestion): suggestion is ShapeIntentSuggestion => Boolean(suggestion))
);

const analyzePrimitiveStroke = (
  stroke: PencilStroke,
  strokeIndex: number,
  canvasSize: ShapeIntentCanvasSize,
): PrimitiveStrokeAnalysis | null => {
  const bounds = getStrokeBounds(stroke);
  if (Math.max(bounds.width, bounds.height) < 18 || (bounds.width < 6 && bounds.height < 6)) {
    return null;
  }

  const firstPoint = stroke.points[0];
  const lastPoint = stroke.points[stroke.points.length - 1];
  const diagonal = Math.max(1, Math.hypot(bounds.width, bounds.height));
  const closureRatio = distance(firstPoint, lastPoint) / diagonal;
  const pathLength = getPathLength(stroke);
  const endpointDistance = Math.max(1, distance(firstPoint, lastPoint));
  const linearity = pathLength / endpointDistance;
  const directionChanges = countDirectionChanges(stroke);
  const edgeOccupancy = getEdgeOccupancy(stroke, bounds);
  const aspectRatio = Math.max(bounds.width, bounds.height) / Math.max(1, Math.min(bounds.width, bounds.height));

  let primitive: ShapeIntentPrimitive = 'blob';
  let confidence = 0.56;
  let headline = 'Organic silhouette detected';
  let summary = 'This sketch reads as a loose blob. Try turning it into an environment mass, bubble, or soft prop.';

  if (closureRatio < 0.24 && directionChanges >= 3 && edgeOccupancy > 0.66) {
    primitive = 'rectangle';
    confidence = clamp(0.68 + (edgeOccupancy * 0.18), 0.68, 0.94);
    headline = 'Boxy frame detected';
    summary = 'Your latest sketch reads like a box. Good base for windows, doors, screens, and signage.';
  } else if (closureRatio < 0.24) {
    primitive = 'ellipse';
    confidence = clamp(0.7 + ((1 / clamp(aspectRatio, 1, 2.2)) * 0.16), 0.7, 0.94);
    headline = 'Ellipse detected';
    summary = 'The stroke closes like a readable ellipse. Great seed for food, wheels, tables, and circular props.';
  } else if ((bounds.width > bounds.height * 2.6 || bounds.height > bounds.width * 2.6) && linearity < 1.55) {
    primitive = 'line';
    confidence = clamp(0.66 + ((1.55 - linearity) * 0.16), 0.66, 0.9);
    headline = 'Gesture line detected';
    summary = 'This stroke reads like a long directional line. Use it as the spine for props, roads, or staging cues.';
  } else {
    primitive = 'blob';
    confidence = clamp(0.58 + ((pathLength / diagonal) * 0.04), 0.58, 0.84);
    headline = 'Organic mass detected';
    summary = 'The outline is looser and more organic. That is ideal for clouds, bushes, smoke, and speech bubbles.';
  }

  return {
    primitive,
    confidence,
    headline,
    summary,
    bounds: {
      ...bounds,
      minX: clamp(bounds.minX, 0, canvasSize.width),
      minY: clamp(bounds.minY, 0, canvasSize.height),
      maxX: clamp(bounds.maxX, 0, canvasSize.width),
      maxY: clamp(bounds.maxY, 0, canvasSize.height),
      centerX: clamp(bounds.centerX, 0, canvasSize.width),
      centerY: clamp(bounds.centerY, 0, canvasSize.height),
    },
    stroke,
    strokeIndex,
  };
};

const getCompoundShapeIntentMatch = (
  latest: PrimitiveStrokeAnalysis,
  previous: PrimitiveStrokeAnalysis,
): CompoundShapeIntentMatch | null => {
  const { xGap, yGap } = getBoundsSeparation(latest.bounds, previous.bounds);
  const maxWidth = Math.max(latest.bounds.width, previous.bounds.width);
  const maxHeight = Math.max(latest.bounds.height, previous.bounds.height);
  if (xGap > Math.max(28, maxWidth * 0.55) || yGap > Math.max(28, maxHeight * 0.65)) {
    return null;
  }

  const pair = [latest.primitive, previous.primitive].sort().join(':');

  if (pair === 'ellipse:line') {
    const ellipse = latest.primitive === 'ellipse' ? latest : previous;
    const line = latest.primitive === 'line' ? latest : previous;
    const centerOffsetX = Math.abs(line.bounds.centerX - ellipse.bounds.centerX) / Math.max(ellipse.bounds.width, 1);
    const centerOffsetY = Math.abs(line.bounds.centerY - ellipse.bounds.centerY) / Math.max(ellipse.bounds.height, 1);
    const verticalLine = line.bounds.height > line.bounds.width * 1.6;
    const horizontalLine = line.bounds.width > line.bounds.height * 1.6;
    const lineStartsBelow = line.bounds.minY >= ellipse.bounds.centerY;
    const crossesEllipse = !(
      line.bounds.maxX < ellipse.bounds.minX
      || line.bounds.minX > ellipse.bounds.maxX
      || line.bounds.maxY < ellipse.bounds.minY
      || line.bounds.minY > ellipse.bounds.maxY
    );
    const suggestionIds = verticalLine && centerOffsetX <= 0.35 && lineStartsBelow
      ? ['round-table', 'clock', 'motorcycle-wheel']
      : horizontalLine && centerOffsetY <= 0.45
        ? ['motorcycle-wheel', 'clock', 'round-table']
        : crossesEllipse
          ? ['clock', 'motorcycle-wheel', 'round-table']
          : ['motorcycle-wheel', 'round-table', 'clock'];
    return {
      primitive: ellipse.primitive,
      displayLabel: 'ellipse + line',
      confidence: clamp(Math.max(ellipse.confidence, line.confidence) + 0.06, 0.76, 0.97),
      headline: 'Ellipse + guide line detected',
      summary: verticalLine && lineStartsBelow
        ? 'The pairing reads like a tabletop with a supporting stem. Great for tables, clocks on stands, and wheel studies.'
        : 'The pairing reads like a circular form with a structural guide. Great for wheels, clocks, and staged round props.',
      bounds: getCombinedBounds(ellipse.bounds, line.bounds),
      sourceStroke: latest.stroke,
      sourceStrokeIndex: latest.strokeIndex,
      sourceStrokeIndexes: [previous.strokeIndex, latest.strokeIndex].sort((left, right) => left - right),
      normalizedGuideLabel: 'Compound guide',
      normalizedGuideStrokes: buildNormalizedGuideStrokes(
        ellipse.primitive,
        getCombinedBounds(ellipse.bounds, line.bounds),
        Date.now(),
      ),
      suggestions: getShapeIntentSuggestionsByIds(suggestionIds),
    };
  }

  if (pair === 'line:rectangle') {
    const rectangle = latest.primitive === 'rectangle' ? latest : previous;
    const line = latest.primitive === 'line' ? latest : previous;
    const centered = Math.abs(line.bounds.centerX - rectangle.bounds.centerX) <= Math.max(rectangle.bounds.width * 0.22, 18);
    const lineBelow = line.bounds.minY >= rectangle.bounds.maxY - Math.max(12, rectangle.bounds.height * 0.12);
    const lineAbove = line.bounds.maxY <= rectangle.bounds.minY + Math.max(12, rectangle.bounds.height * 0.12);
    const suggestionIds = centered && lineBelow
      ? ['monitor', 'sign-board', 'door']
      : lineAbove
        ? ['sign-board', 'window', 'monitor']
        : ['monitor', 'window', 'sign-board'];
    return {
      primitive: rectangle.primitive,
      displayLabel: 'rectangle + line',
      confidence: clamp(Math.max(rectangle.confidence, line.confidence) + 0.06, 0.74, 0.96),
      headline: 'Rectangle + support line detected',
      summary: lineBelow
        ? 'The pairing reads like a framed panel with a support. Great for monitors, signs, and staged environment props.'
        : 'The pairing reads like a framed box with a guide line. Good for signage, screens, and architectural panels.',
      bounds: getCombinedBounds(rectangle.bounds, line.bounds),
      sourceStroke: latest.stroke,
      sourceStrokeIndex: latest.strokeIndex,
      sourceStrokeIndexes: [previous.strokeIndex, latest.strokeIndex].sort((left, right) => left - right),
      normalizedGuideLabel: 'Compound guide',
      normalizedGuideStrokes: buildNormalizedGuideStrokes(
        rectangle.primitive,
        getCombinedBounds(rectangle.bounds, line.bounds),
        Date.now(),
      ),
      suggestions: getShapeIntentSuggestionsByIds(suggestionIds),
    };
  }

  if (pair === 'blob:line') {
    const blob = latest.primitive === 'blob' ? latest : previous;
    const line = latest.primitive === 'line' ? latest : previous;
    const tailBelow = line.bounds.centerY >= blob.bounds.centerY;
    const verticalLine = line.bounds.height > line.bounds.width * 1.4;
    const suggestionIds = tailBelow && verticalLine
      ? ['speech-bubble', 'smoke', 'cloud']
      : verticalLine
        ? ['smoke', 'speech-bubble', 'cloud']
        : ['speech-bubble', 'cloud', 'bush'];
    return {
      primitive: blob.primitive,
      displayLabel: 'blob + line',
      confidence: clamp(Math.max(blob.confidence, line.confidence) + 0.05, 0.7, 0.93),
      headline: 'Organic mass + tail line detected',
      summary: tailBelow
        ? 'The pairing reads like a soft mass with a directed tail. Good for speech bubbles, smoke plumes, and soft atmospheric beats.'
        : 'The pairing reads like a soft mass with a gesture line. Good for clouds, bubbles, and environment accents.',
      bounds: getCombinedBounds(blob.bounds, line.bounds),
      sourceStroke: latest.stroke,
      sourceStrokeIndex: latest.strokeIndex,
      sourceStrokeIndexes: [previous.strokeIndex, latest.strokeIndex].sort((left, right) => left - right),
      normalizedGuideLabel: 'Compound guide',
      normalizedGuideStrokes: buildNormalizedGuideStrokes(
        blob.primitive,
        getCombinedBounds(blob.bounds, line.bounds),
        Date.now(),
      ),
      suggestions: getShapeIntentSuggestionsByIds(suggestionIds),
    };
  }

  return null;
};

export const getShapeIntentDefaultSelections = (suggestion: ShapeIntentSuggestion): ShapeIntentSelections => (
  suggestion.parameters.reduce<ShapeIntentSelections>((result, parameter) => {
    result[parameter.id] = [...parameter.defaultValue];
    return result;
  }, {})
);

export const summarizeShapeIntentSelections = (
  suggestion: ShapeIntentSuggestion,
  selections: ShapeIntentSelections,
) => suggestion.parameters.map((parameter) => {
  const selectedIds = parameter.selection === 'multi'
    ? getMultiSelection(selections, parameter)
    : [getSingleSelection(selections, parameter)];
  const labels = selectedIds
    .map((selectionId) => parameter.options.find((option) => option.id === selectionId)?.label)
    .filter((value): value is string => Boolean(value));
  return `${parameter.label}: ${labels.join(', ')}`;
}).join(' · ');

export const analyzeShapeIntent = (
  strokes: PencilStroke[],
  canvasSize: ShapeIntentCanvasSize,
  rankingContext?: ShapeIntentRankingContext,
): ShapeIntentAnalysis | null => {
  const qualifyingStrokeAnalyses: PrimitiveStrokeAnalysis[] = [];
  for (let index = strokes.length - 1; index >= 0; index -= 1) {
    if (strokes[index].points.length < 4) {
      continue;
    }
    const analysis = analyzePrimitiveStroke(strokes[index], index, canvasSize);
    if (analysis) {
      qualifyingStrokeAnalyses.push(analysis);
    }
    if (qualifyingStrokeAnalyses.length >= 2) {
      break;
    }
  }

  if (qualifyingStrokeAnalyses.length === 0) {
    return null;
  }

  const latestAnalysis = qualifyingStrokeAnalyses[0];
  const previousAnalysis = qualifyingStrokeAnalyses[1];
  if (latestAnalysis?.primitive === 'line' && previousAnalysis) {
    const compoundMatch = getCompoundShapeIntentMatch(latestAnalysis, previousAnalysis);
    if (compoundMatch) {
      return {
        ...compoundMatch,
        suggestions: rankShapeIntentSuggestions(compoundMatch.suggestions, rankingContext),
      };
    }
  }

  const {
    primitive,
    confidence,
    headline,
    summary,
    bounds: clampedBounds,
    stroke: sourceStroke,
    strokeIndex: sourceStrokeIndex,
  } = latestAnalysis;
  const normalizedGuideLabel = primitive === 'ellipse'
    ? 'Perfect Ellipse'
    : primitive === 'rectangle'
      ? 'Straighten Box'
      : primitive === 'line'
        ? 'Clean Gesture Line'
        : 'Organize Mass';

  return {
    primitive,
    displayLabel: primitive,
    confidence,
    headline,
    summary,
    bounds: clampedBounds,
    sourceStroke,
    sourceStrokeIndex,
    sourceStrokeIndexes: [sourceStrokeIndex],
    normalizedGuideLabel,
    normalizedGuideStrokes: buildNormalizedGuideStrokes(primitive, clampedBounds, Date.now()),
    suggestions: rankShapeIntentSuggestions(primitiveSuggestionMap[primitive], rankingContext),
  };
};

export const getShapeIntentSuggestionById = (
  analysis: ShapeIntentAnalysis | null,
  suggestionId: string | undefined,
) => analysis?.suggestions.find((suggestion) => suggestion.id === suggestionId) || null;

export const getShapeIntentSuggestionDefinitionById = (
  suggestionId: string | undefined,
): ShapeIntentSuggestion | null => (
  suggestionId
    ? allShapeIntentSuggestions.find((suggestion) => suggestion.id === suggestionId) || null
    : null
);

export const getShapeIntentSuggestionContextSignals = (
  suggestion: ShapeIntentSuggestion | null,
  context?: ShapeIntentRankingContext,
): ShapeIntentContextSignal[] => {
  if (!suggestion || !context) {
    return [];
  }

  const signals: ShapeIntentContextSignal[] = [];
  const workflowBoost = context.workflowLevel ? workflowSuggestionBoosts[context.workflowLevel]?.[suggestion.id] || 0 : 0;
  if (workflowBoost > 0 && context.workflowLevel) {
    signals.push({
      id: 'workflow',
      label: `${context.workflowLevel.toUpperCase()} fit`,
      tone: 'workflow',
    });
  }

  if (getUniqueSuggestionIds(context.pinnedSuggestionIds).includes(suggestion.id)) {
    signals.push({
      id: 'pinned',
      label: 'Pinned preset',
      tone: 'pinned',
    });
  }

  if (getUniqueSuggestionIds(context.preferredSuggestionIds).includes(suggestion.id)) {
    signals.push({
      id: 'library',
      label: 'Library match',
      tone: 'library',
    });
  }

  if (getUniqueSuggestionIds(context.recentSuggestionIds).includes(suggestion.id)) {
    signals.push({
      id: 'recent',
      label: 'Recent scaffold',
      tone: 'recent',
    });
  }

  return signals;
};

export const createShapeIntentAnalysisFromScaffold = (
  scaffold: ShapeIntentScaffoldDefinition,
  canvasSize: ShapeIntentCanvasSize,
): ShapeIntentAnalysis | null => {
  const suggestion = getShapeIntentSuggestionDefinitionById(scaffold.suggestionId);
  if (!suggestion) {
    return null;
  }
  const bounds = createBoundsFromScaffoldFrame(scaffold.frame, canvasSize);
  return {
    primitive: scaffold.primitive,
    displayLabel: scaffold.primitive,
    confidence: 1,
    headline: `${suggestion.title} scaffold`,
    summary: suggestion.description,
    bounds,
    sourceStroke: {
      inputType: 'pen',
      color: '#f6b24d',
      width: 1,
      opacity: 1,
      points: [
        { x: bounds.minX, y: bounds.minY, pressure: 0.7, tiltX: 0, tiltY: 0, timestamp: Date.now() },
        { x: bounds.maxX, y: bounds.maxY, pressure: 0.7, tiltX: 0, tiltY: 0, timestamp: Date.now() + 16 },
      ],
    },
    sourceStrokeIndex: -1,
    sourceStrokeIndexes: [],
    normalizedGuideLabel: 'Scaffold Guide',
    normalizedGuideStrokes: buildNormalizedGuideStrokes(scaffold.primitive, bounds, Date.now()),
    suggestions: primitiveSuggestionMap[scaffold.primitive],
  };
};

export const buildShapeIntentGuideStrokesFromScaffold = (
  scaffold: ShapeIntentScaffoldDefinition,
  canvasSize: ShapeIntentCanvasSize,
): PencilStroke[] => {
  const analysis = createShapeIntentAnalysisFromScaffold(scaffold, canvasSize);
  const suggestion = getShapeIntentSuggestionDefinitionById(scaffold.suggestionId);
  if (!analysis || !suggestion) {
    return [];
  }
  return buildGuideStrokesForSuggestion(analysis, suggestion, scaffold.selections);
};

export const buildShapeIntentGuideStrokes = (
  analysis: ShapeIntentAnalysis,
  suggestion: ShapeIntentSuggestion,
  selections: ShapeIntentSelections,
) => buildGuideStrokesForSuggestion(analysis, suggestion, selections);

export const buildShapeIntentReferenceDataUrl = (
  analysis: ShapeIntentAnalysis,
  suggestion: ShapeIntentSuggestion,
  selections: ShapeIntentSelections,
  canvasSize: ShapeIntentCanvasSize,
  previewStrokesOverride?: PencilStroke[],
  subtitleOverride?: string,
) => {
  const previewStrokes = previewStrokesOverride || buildGuideStrokesForSuggestion(analysis, suggestion, selections);
  const subtitle = subtitleOverride || summarizeShapeIntentSelections(suggestion, selections);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${canvasSize.width}" height="${canvasSize.height}" viewBox="0 0 ${canvasSize.width} ${canvasSize.height}">
      <defs>
        <linearGradient id="shape-intent-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="rgba(11,15,25,0.86)" />
          <stop offset="100%" stop-color="rgba(22,28,45,0.96)" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${canvasSize.width}" height="${canvasSize.height}" fill="url(#shape-intent-bg)" />
      <rect x="${Math.max(12, analysis.bounds.minX - 20)}" y="${Math.max(12, analysis.bounds.minY - 20)}" width="${Math.max(40, analysis.bounds.width + 40)}" height="${Math.max(40, analysis.bounds.height + 40)}" rx="18" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.08)" />
      ${previewStrokes.map(strokeToPolyline).join('')}
      <text x="28" y="42" fill="#f8fafc" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="700" letter-spacing="1.2">${suggestion.title}</text>
      <text x="28" y="70" fill="${suggestion.accentColor}" font-family="Inter, Arial, sans-serif" font-size="13" font-weight="700" letter-spacing="1.4">${suggestion.category.toUpperCase()}</text>
      <text x="28" y="${canvasSize.height - 40}" fill="rgba(226,232,240,0.82)" font-family="Inter, Arial, sans-serif" font-size="14">${subtitle}</text>
    </svg>
  `.trim();
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

export const buildShapeIntentOverlayDataUrl = (
  strokes: PencilStroke[],
  canvasSize: ShapeIntentCanvasSize,
) => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${canvasSize.width}" height="${canvasSize.height}" viewBox="0 0 ${canvasSize.width} ${canvasSize.height}">
      ${strokes.map(strokeToPolyline).join('')}
    </svg>
  `.trim();
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};
