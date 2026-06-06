// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { Box } from '@mui/material';

export enum GuideType {
  RULE_OF_THIRDS = 'rule_of_thirds',
  GOLDEN_RATIO = 'golden_ratio',
  GOLDEN_SPIRAL = 'golden_spiral',
  CENTERED_CROSS = 'centered_cross',
  DIAGONAL_LINES = 'diagonal_lines',
  GOLDEN_TRIANGLE = 'golden_triangle',
  GRID = 'grid',
  PERSPECTIVE_GUIDES = 'perspective_guides',
  EYE_LINE_GUIDE = 'eye_line_guide',
  FACE_PROPORTIONS = 'face_proportions',
  HEADROOM_LEADROOM = 'headroom_leadroom',
  DYNAMIC_SYMMETRY = 'dynamic_symmetry',
  RADIAL_GRID = 'radial_grid',
  ROOT_RECTANGLES = 'root_rectangles',
  DIAGONAL_METHOD = 'diagonal_method',
  SAFE_ZONES = 'safe_zones',
  ASPECT_RATIO_FRAMES = 'aspect_ratio_frames',
  CENTER_POINT = 'center_point',
  HORIZON_LINE = 'horizon_line',
  CUSTOM_GUIDES = 'custom_guides',
}

interface AnalysisFocusPoint {
  x: number;
  y: number;
  strength?: number;
  type?: string;
}

interface AnalysisResult {
  focus_points?: AnalysisFocusPoint[];
  horizon_line?: number;
}

interface CompositionGuidesProps {
  imageElement: HTMLImageElement;
  zoomLevel?: number;
  panPosition?: { x: number; y: number };
  analysisResult?: AnalysisResult | null;
}

const DEFAULT_GUIDES: GuideType[] = [
  GuideType.RULE_OF_THIRDS,
  GuideType.SAFE_ZONES,
  GuideType.CENTER_POINT,
];

const GUIDE_COLORS: Record<GuideType, string> = {
  [GuideType.RULE_OF_THIRDS]: '#ff8a00',
  [GuideType.GOLDEN_RATIO]: '#ffd166',
  [GuideType.GOLDEN_SPIRAL]: '#ffd166',
  [GuideType.CENTERED_CROSS]: '#64b5f6',
  [GuideType.DIAGONAL_LINES]: '#4db6ac',
  [GuideType.GOLDEN_TRIANGLE]: '#81c784',
  [GuideType.GRID]: '#90a4ae',
  [GuideType.PERSPECTIVE_GUIDES]: '#90caf9',
  [GuideType.EYE_LINE_GUIDE]: '#ba68c8',
  [GuideType.FACE_PROPORTIONS]: '#f06292',
  [GuideType.HEADROOM_LEADROOM]: '#4fc3f7',
  [GuideType.DYNAMIC_SYMMETRY]: '#9ccc65',
  [GuideType.RADIAL_GRID]: '#ce93d8',
  [GuideType.ROOT_RECTANGLES]: '#ffcc80',
  [GuideType.DIAGONAL_METHOD]: '#80cbc4',
  [GuideType.SAFE_ZONES]: '#ffb300',
  [GuideType.ASPECT_RATIO_FRAMES]: '#78909c',
  [GuideType.CENTER_POINT]: '#e57373',
  [GuideType.HORIZON_LINE]: '#4dd0e1',
  [GuideType.CUSTOM_GUIDES]: '#9e9e9e',
};

export default function CompositionGuides({
  imageElement,
  zoomLevel = 1,
  panPosition = { x: 0, y: 0 },
  analysisResult,
}: CompositionGuidesProps) {
  const [activeGuides, setActiveGuides] = useState<GuideType[]>(DEFAULT_GUIDES);
  const width = imageElement.clientWidth || imageElement.naturalWidth || 0;
  const height = imageElement.clientHeight || imageElement.naturalHeight || 0;

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!event.altKey) {
        return;
      }
      if (event.key === '1') {
        toggleGuide(GuideType.RULE_OF_THIRDS, setActiveGuides);
      }
      if (event.key === '2') {
        toggleGuide(GuideType.GOLDEN_RATIO, setActiveGuides);
      }
      if (event.key === '3') {
        toggleGuide(GuideType.DIAGONAL_LINES, setActiveGuides);
      }
      if (event.key === '4') {
        toggleGuide(GuideType.CENTER_POINT, setActiveGuides);
      }
      if (event.key === '5') {
        toggleGuide(GuideType.HORIZON_LINE, setActiveGuides);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const guideElements = useMemo(() => {
    if (width <= 0 || height <= 0) {
      return [];
    }
    const elements: React.ReactNode[] = [];
    const pushLine = (
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      color: string,
      dashArray = '0',
      opacity = 0.65,
      keySuffix = '',
    ) => {
      elements.push(
        <line
          key={`line-${x1}-${y1}-${x2}-${y2}-${keySuffix}`}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={color}
          strokeWidth={1}
          strokeDasharray={dashArray}
          opacity={opacity}
        />,
      );
    };

    if (activeGuides.includes(GuideType.RULE_OF_THIRDS)) {
      const color = GUIDE_COLORS[GuideType.RULE_OF_THIRDS];
      pushLine(width / 3, 0, width / 3, height, color, '4 4', 0.85, 'third-v1');
      pushLine((2 * width) / 3, 0, (2 * width) / 3, height, color, '4 4', 0.85, 'third-v2');
      pushLine(0, height / 3, width, height / 3, color, '4 4', 0.85, 'third-h1');
      pushLine(0, (2 * height) / 3, width, (2 * height) / 3, color, '4 4', 0.85, 'third-h2');
    }

    if (activeGuides.includes(GuideType.GOLDEN_RATIO)) {
      const color = GUIDE_COLORS[GuideType.GOLDEN_RATIO];
      const phi = 1.61803398875;
      const goldenX = width / phi;
      const goldenY = height / phi;
      pushLine(goldenX, 0, goldenX, height, color, '2 6', 0.8, 'gold-v1');
      pushLine(width - goldenX, 0, width - goldenX, height, color, '2 6', 0.8, 'gold-v2');
      pushLine(0, goldenY, width, goldenY, color, '2 6', 0.8, 'gold-h1');
      pushLine(0, height - goldenY, width, height - goldenY, color, '2 6', 0.8, 'gold-h2');
    }

    if (activeGuides.includes(GuideType.DIAGONAL_LINES)) {
      const color = GUIDE_COLORS[GuideType.DIAGONAL_LINES];
      pushLine(0, 0, width, height, color, '5 5', 0.7, 'diag-1');
      pushLine(width, 0, 0, height, color, '5 5', 0.7, 'diag-2');
    }

    if (activeGuides.includes(GuideType.CENTERED_CROSS)) {
      const color = GUIDE_COLORS[GuideType.CENTERED_CROSS];
      pushLine(width / 2, 0, width / 2, height, color, '3 4', 0.75, 'center-v');
      pushLine(0, height / 2, width, height / 2, color, '3 4', 0.75, 'center-h');
    }

    if (activeGuides.includes(GuideType.SAFE_ZONES)) {
      const color = GUIDE_COLORS[GuideType.SAFE_ZONES];
      const horizontalMargin = width * 0.1;
      const verticalMargin = height * 0.1;
      elements.push(
        <rect
          key="safe-zone-rect"
          x={horizontalMargin}
          y={verticalMargin}
          width={width - horizontalMargin * 2}
          height={height - verticalMargin * 2}
          fill="transparent"
          stroke={color}
          strokeWidth={1.25}
          strokeDasharray="6 4"
          opacity={0.85}
        />,
      );
    }

    if (activeGuides.includes(GuideType.CENTER_POINT)) {
      const color = GUIDE_COLORS[GuideType.CENTER_POINT];
      elements.push(
        <circle
          key="center-point"
          cx={width / 2}
          cy={height / 2}
          r={6}
          fill="transparent"
          stroke={color}
          strokeWidth={1.5}
          opacity={0.9}
        />,
      );
    }

    if (activeGuides.includes(GuideType.HORIZON_LINE)) {
      const color = GUIDE_COLORS[GuideType.HORIZON_LINE];
      const horizonY = getHorizonLine(height, analysisResult);
      pushLine(0, horizonY, width, horizonY, color, '8 4', 0.9, 'horizon');
    }

    const focusPoints = analysisResult?.focus_points || [];
    focusPoints.forEach((point, index) => {
      const normalizedX = normalizePoint(point.x, width);
      const normalizedY = normalizePoint(point.y, height);
      const strength = typeof point.strength === 'number' ? point.strength : 0.5;
      const radius = 4 + Math.max(0, Math.min(8, strength * 8));
      elements.push(
        <circle
          key={`focus-${index}`}
          cx={normalizedX}
          cy={normalizedY}
          r={radius}
          fill="rgba(255, 209, 102, 0.15)"
          stroke="#ffd166"
          strokeWidth={1.5}
        />,
      );
    });

    return elements;
  }, [activeGuides, analysisResult, height, width]);

  return (
    <Box
      data-testid="composition-guides-overlay"
      sx={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        transform: `translate(${panPosition.x}px, ${panPosition.y}px) scale(${zoomLevel})`,
        transformOrigin: 'center center',
      }}
    >
      <svg width="100%" height="100%" viewBox={`0 0 ${Math.max(width, 1)} ${Math.max(height, 1)}`}>
        {guideElements}
      </svg>
    </Box>
  );
}

function toggleGuide(guide: GuideType, setActiveGuides: React.Dispatch<React.SetStateAction<GuideType[]>>) {
  setActiveGuides((previous) => {
    if (previous.includes(guide)) {
      return previous.filter((entry) => entry !== guide);
    }
    return [...previous, guide];
  });
}

function getHorizonLine(height: number, analysisResult?: AnalysisResult | null): number {
  const candidate = analysisResult?.horizon_line;
  if (typeof candidate === 'number' && Number.isFinite(candidate)) {
    if (candidate >= 0 && candidate <= 1) {
      return candidate * height;
    }
    if (candidate >= 0 && candidate <= height) {
      return candidate;
    }
  }
  return height / 2;
}

function normalizePoint(value: number, limit: number): number {
  if (!Number.isFinite(value)) {
    return limit / 2;
  }
  if (value >= 0 && value <= 1) {
    return value * limit;
  }
  return Math.max(0, Math.min(limit, value));
}
