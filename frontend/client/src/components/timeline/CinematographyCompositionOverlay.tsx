import React, { useMemo } from 'react';
import { Box } from '@mui/material';

export type CinematographyGuideTarget = 'source' | 'program' | 'both';
export type CinematographyAspectMask =
  | 'none'
  | '16:9'
  | '4:3'
  | '1:1'
  | '1.85:1'
  | '2.39:1'
  | '9:16'
  | '4:5';
export type CinematographySpiralOrientation =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

export interface CinematographyGuideSet {
  ruleOfThirds: boolean;
  centerCrosshair: boolean;
  goldenRatio: boolean;
  goldenSpiral: boolean;
  diagonals: boolean;
  dynamicSymmetry: boolean;
  safeAreas: boolean;
  eyeLine: boolean;
  headroomLeadroom: boolean;
  horizonLine: boolean;
  perspective: boolean;
}

export const DEFAULT_CINEMATOGRAPHY_GUIDES: CinematographyGuideSet = {
  ruleOfThirds: true,
  centerCrosshair: true,
  goldenRatio: false,
  goldenSpiral: false,
  diagonals: false,
  dynamicSymmetry: false,
  safeAreas: false,
  eyeLine: false,
  headroomLeadroom: false,
  horizonLine: false,
  perspective: false,
};

export const CINEMATOGRAPHY_ASPECT_MASKS: readonly CinematographyAspectMask[] = [
  'none',
  '16:9',
  '4:3',
  '1:1',
  '1.85:1',
  '2.39:1',
  '9:16',
  '4:5',
];

export const CINEMATOGRAPHY_SPIRAL_ORIENTATIONS: readonly CinematographySpiralOrientation[] = [
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
];

interface CinematographyCompositionOverlayProps {
  visible: boolean;
  guides: CinematographyGuideSet;
  color: string;
  opacity: number;
  thickness: number;
  spiralOrientation: CinematographySpiralOrientation;
  aspectMask: CinematographyAspectMask;
  testId?: string;
}

const FRAME_WIDTH = 1600;
const FRAME_HEIGHT = 900;
const PHI = 1.61803398875;

const ASPECT_RATIO_LOOKUP: Record<Exclude<CinematographyAspectMask, 'none'>, number> = {
  '16:9': 16 / 9,
  '4:3': 4 / 3,
  '1:1': 1,
  '1.85:1': 1.85,
  '2.39:1': 2.39,
  '9:16': 9 / 16,
  '4:5': 4 / 5,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getAspectMaskArea(
  aspectMask: CinematographyAspectMask,
  frameWidth: number,
  frameHeight: number
): { x: number; y: number; width: number; height: number } | null {
  if (aspectMask === 'none') return null;

  const targetRatio = ASPECT_RATIO_LOOKUP[aspectMask];
  const frameRatio = frameWidth / frameHeight;

  if (Math.abs(targetRatio - frameRatio) < 0.001) {
    return null;
  }

  if (targetRatio > frameRatio) {
    const activeHeight = frameWidth / targetRatio;
    const marginY = (frameHeight - activeHeight) / 2;
    return {
      x: 0,
      y: marginY,
      width: frameWidth,
      height: activeHeight,
    };
  }

  const activeWidth = frameHeight * targetRatio;
  const marginX = (frameWidth - activeWidth) / 2;
  return {
    x: marginX,
    y: 0,
    width: activeWidth,
    height: frameHeight,
  };
}

function buildLogSpiralPath(
  width: number,
  height: number,
  orientation: CinematographySpiralOrientation
): string {
  const turns = 4 * Math.PI;
  const steps = 160;
  const maxRadius = Math.min(width, height) * 0.45;
  const minRadius = maxRadius * 0.02;
  const growth = Math.log(maxRadius / minRadius) / turns;

  const centerByOrientation: Record<CinematographySpiralOrientation, { x: number; y: number }> = {
    'top-left': { x: width * 0.382, y: height * 0.382 },
    'top-right': { x: width * 0.618, y: height * 0.382 },
    'bottom-left': { x: width * 0.382, y: height * 0.618 },
    'bottom-right': { x: width * 0.618, y: height * 0.618 },
  };

  const signByOrientation: Record<CinematographySpiralOrientation, { x: number; y: number }> = {
    'top-left': { x: 1, y: 1 },
    'top-right': { x: -1, y: 1 },
    'bottom-left': { x: 1, y: -1 },
    'bottom-right': { x: -1, y: -1 },
  };

  const center = centerByOrientation[orientation];
  const sign = signByOrientation[orientation];
  const points: string[] = [];

  for (let index = 0; index <= steps; index += 1) {
    const theta = (index / steps) * turns;
    const radius = minRadius * Math.exp(growth * theta);
    const x = center.x + sign.x * radius * Math.cos(theta);
    const y = center.y + sign.y * radius * Math.sin(theta);
    points.push(`${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`);
  }

  return points.join(' ');
}

function buildPerspectiveLines(width: number, height: number): Array<[number, number, number, number]> {
  const cx = width / 2;
  const cy = height / 2;
  return [
    [cx, cy, 0, 0],
    [cx, cy, width / 2, 0],
    [cx, cy, width, 0],
    [cx, cy, width, height / 2],
    [cx, cy, width, height],
    [cx, cy, width / 2, height],
    [cx, cy, 0, height],
    [cx, cy, 0, height / 2],
  ];
}

function buildDynamicSymmetryLines(width: number, height: number): Array<[number, number, number, number]> {
  return [
    [0, 0, width, height],
    [width, 0, 0, height],
    [0, height * 0.5, width * 0.5, 0],
    [width * 0.5, 0, width, height * 0.5],
    [0, height * 0.5, width * 0.5, height],
    [width * 0.5, height, width, height * 0.5],
  ];
}

export default function CinematographyCompositionOverlay({
  visible,
  guides,
  color,
  opacity,
  thickness,
  spiralOrientation,
  aspectMask,
  testId,
}: CinematographyCompositionOverlayProps) {
  const strokeOpacity = clamp(opacity, 0.1, 1);
  const strokeWidth = clamp(thickness, 1, 6);
  const dashedStroke = `${Math.max(4, strokeWidth * 4)} ${Math.max(3, strokeWidth * 2.5)}`;
  const goldenSpiralPath = useMemo(
    () => buildLogSpiralPath(FRAME_WIDTH, FRAME_HEIGHT, spiralOrientation),
    [spiralOrientation]
  );
  const aspectMaskArea = useMemo(
    () => getAspectMaskArea(aspectMask, FRAME_WIDTH, FRAME_HEIGHT),
    [aspectMask]
  );
  const perspectiveLines = useMemo(
    () => buildPerspectiveLines(FRAME_WIDTH, FRAME_HEIGHT),
    []
  );
  const dynamicSymmetryLines = useMemo(
    () => buildDynamicSymmetryLines(FRAME_WIDTH, FRAME_HEIGHT),
    []
  );

  if (!visible) {
    return null;
  }

  const thirdsX = FRAME_WIDTH / 3;
  const thirdsY = FRAME_HEIGHT / 3;
  const goldenX = FRAME_WIDTH / PHI;
  const goldenY = FRAME_HEIGHT / PHI;
  const centerX = FRAME_WIDTH / 2;
  const centerY = FRAME_HEIGHT / 2;

  return (
    <Box
      data-testid={testId}
      sx={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 1,
      }}
      aria-hidden="true"
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${FRAME_WIDTH} ${FRAME_HEIGHT}`}
        preserveAspectRatio="none"
      >
        {aspectMaskArea && (
          <>
            <rect x={0} y={0} width={FRAME_WIDTH} height={aspectMaskArea.y} fill="#000" opacity={0.52} />
            <rect
              x={0}
              y={aspectMaskArea.y + aspectMaskArea.height}
              width={FRAME_WIDTH}
              height={FRAME_HEIGHT - (aspectMaskArea.y + aspectMaskArea.height)}
              fill="#000"
              opacity={0.52}
            />
            <rect x={0} y={0} width={aspectMaskArea.x} height={FRAME_HEIGHT} fill="#000" opacity={0.52} />
            <rect
              x={aspectMaskArea.x + aspectMaskArea.width}
              y={0}
              width={FRAME_WIDTH - (aspectMaskArea.x + aspectMaskArea.width)}
              height={FRAME_HEIGHT}
              fill="#000"
              opacity={0.52}
            />
            <rect
              x={aspectMaskArea.x}
              y={aspectMaskArea.y}
              width={aspectMaskArea.width}
              height={aspectMaskArea.height}
              fill="none"
              stroke={color}
              strokeOpacity={strokeOpacity}
              strokeWidth={strokeWidth}
            />
          </>
        )}

        <g stroke={color} strokeOpacity={strokeOpacity} strokeWidth={strokeWidth} fill="none">
          {guides.ruleOfThirds && (
            <>
              <line x1={thirdsX} y1={0} x2={thirdsX} y2={FRAME_HEIGHT} strokeDasharray={dashedStroke} />
              <line x1={thirdsX * 2} y1={0} x2={thirdsX * 2} y2={FRAME_HEIGHT} strokeDasharray={dashedStroke} />
              <line x1={0} y1={thirdsY} x2={FRAME_WIDTH} y2={thirdsY} strokeDasharray={dashedStroke} />
              <line x1={0} y1={thirdsY * 2} x2={FRAME_WIDTH} y2={thirdsY * 2} strokeDasharray={dashedStroke} />
            </>
          )}

          {guides.centerCrosshair && (
            <>
              <line x1={centerX - 42} y1={centerY} x2={centerX + 42} y2={centerY} />
              <line x1={centerX} y1={centerY - 42} x2={centerX} y2={centerY + 42} />
              <circle cx={centerX} cy={centerY} r={5} fill={color} fillOpacity={strokeOpacity} stroke="none" />
            </>
          )}

          {guides.goldenRatio && (
            <>
              <line x1={goldenX} y1={0} x2={goldenX} y2={FRAME_HEIGHT} strokeDasharray={dashedStroke} />
              <line
                x1={FRAME_WIDTH - goldenX}
                y1={0}
                x2={FRAME_WIDTH - goldenX}
                y2={FRAME_HEIGHT}
                strokeDasharray={dashedStroke}
              />
              <line x1={0} y1={goldenY} x2={FRAME_WIDTH} y2={goldenY} strokeDasharray={dashedStroke} />
              <line
                x1={0}
                y1={FRAME_HEIGHT - goldenY}
                x2={FRAME_WIDTH}
                y2={FRAME_HEIGHT - goldenY}
                strokeDasharray={dashedStroke}
              />
            </>
          )}

          {guides.goldenSpiral && (
            <path d={goldenSpiralPath} />
          )}

          {guides.diagonals && (
            <>
              <line x1={0} y1={0} x2={FRAME_WIDTH} y2={FRAME_HEIGHT} />
              <line x1={FRAME_WIDTH} y1={0} x2={0} y2={FRAME_HEIGHT} />
            </>
          )}

          {guides.dynamicSymmetry &&
            dynamicSymmetryLines.map(([x1, y1, x2, y2], index) => (
              <line
                key={`dynamic-symmetry-${index}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                strokeDasharray={dashedStroke}
              />
            ))}

          {guides.safeAreas && (
            <>
              <rect
                x={FRAME_WIDTH * 0.05}
                y={FRAME_HEIGHT * 0.05}
                width={FRAME_WIDTH * 0.9}
                height={FRAME_HEIGHT * 0.9}
              />
              <rect
                x={FRAME_WIDTH * 0.1}
                y={FRAME_HEIGHT * 0.1}
                width={FRAME_WIDTH * 0.8}
                height={FRAME_HEIGHT * 0.8}
                strokeDasharray={dashedStroke}
              />
            </>
          )}

          {guides.eyeLine && (
            <>
              <line x1={0} y1={FRAME_HEIGHT * 0.33} x2={FRAME_WIDTH} y2={FRAME_HEIGHT * 0.33} />
              <line
                x1={0}
                y1={FRAME_HEIGHT * 0.382}
                x2={FRAME_WIDTH}
                y2={FRAME_HEIGHT * 0.382}
                strokeDasharray={dashedStroke}
              />
            </>
          )}

          {guides.headroomLeadroom && (
            <>
              <line x1={0} y1={FRAME_HEIGHT * 0.14} x2={FRAME_WIDTH} y2={FRAME_HEIGHT * 0.14} />
              <line x1={FRAME_WIDTH * 0.33} y1={0} x2={FRAME_WIDTH * 0.33} y2={FRAME_HEIGHT} />
              <line
                x1={FRAME_WIDTH * 0.66}
                y1={0}
                x2={FRAME_WIDTH * 0.66}
                y2={FRAME_HEIGHT}
                strokeDasharray={dashedStroke}
              />
            </>
          )}

          {guides.horizonLine && (
            <line x1={0} y1={FRAME_HEIGHT * 0.618} x2={FRAME_WIDTH} y2={FRAME_HEIGHT * 0.618} />
          )}

          {guides.perspective &&
            perspectiveLines.map(([x1, y1, x2, y2], index) => (
              <line
                key={`perspective-${index}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                strokeDasharray={dashedStroke}
              />
            ))}
        </g>
      </svg>
    </Box>
  );
}
