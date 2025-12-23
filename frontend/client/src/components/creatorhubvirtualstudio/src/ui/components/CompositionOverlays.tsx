/**
 * Composition Overlays
 * 
 * Visual composition guides for the camera viewfinder:
 * - Rule of Thirds
 * - Golden Ratio / Fibonacci Spiral
 * - Diagonal Lines
 * - Center Cross
 * - Golden Triangle
 */

import React, { useMemo } from 'react';
import { Box } from '@mui/material';

export type CompositionGuideType = 
  | 'rule_of_thirds'
  | 'golden_ratio'
  | 'golden_spiral'
  | 'diagonal'
  | 'center_cross'
  | 'golden_triangle'
  | 'dynamic_symmetry';

interface CompositionOverlaysProps {
  activeGuides: CompositionGuideType[];
  color?: string;
  opacity?: number;
  width?: number | string;
  height?: number | string;
  aiFeedback?: {
    score: number;
    suggestions: Array<{ message: string; priority: string }>;
    objects?: Array<{ center: [number, number]; bbox: [number, number, number, number] }>;
  };
}

// Rule of Thirds Grid
const RuleOfThirds: React.FC<{ color: string; opacity: number }> = ({ color, opacity }) => (
  <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
    {/* Vertical lines */}
    <line x1="33.33%" y1="0" x2="33.33%" y2="100%" stroke={color} strokeWidth="1" opacity={opacity} />
    <line x1="66.67%" y1="0" x2="66.67%" y2="100%" stroke={color} strokeWidth="1" opacity={opacity} />
    {/* Horizontal lines */}
    <line x1="0" y1="33.33%" x2="100%" y2="33.33%" stroke={color} strokeWidth="1" opacity={opacity} />
    <line x1="0" y1="66.67%" x2="100%" y2="66.67%" stroke={color} strokeWidth="1" opacity={opacity} />
    {/* Power points */}
    <circle cx="33.33%" cy="33.33%" r="4" fill={color} opacity={opacity * 1.5} />
    <circle cx="66.67%" cy="33.33%" r="4" fill={color} opacity={opacity * 1.5} />
    <circle cx="33.33%" cy="66.67%" r="4" fill={color} opacity={opacity * 1.5} />
    <circle cx="66.67%" cy="66.67%" r="4" fill={color} opacity={opacity * 1.5} />
  </svg>
);

// Golden Ratio Grid (Phi Grid)
const GoldenRatio: React.FC<{ color: string; opacity: number }> = ({ color, opacity }) => {
  const phi = 1.618;
  const pos1 = (1 / (1 + phi)) * 100;
  const pos2 = (phi / (1 + phi)) * 100;
  
  return (
    <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
      {/* Vertical lines */}
      <line x1={`${pos1}%`} y1="0" x2={`${pos1}%`} y2="100%" stroke={color} strokeWidth="1" opacity={opacity} />
      <line x1={`${pos2}%`} y1="0" x2={`${pos2}%`} y2="100%" stroke={color} strokeWidth="1" opacity={opacity} />
      {/* Horizontal lines */}
      <line x1="0" y1={`${pos1}%`} x2="100%" y2={`${pos1}%`} stroke={color} strokeWidth="1" opacity={opacity} />
      <line x1="0" y1={`${pos2}%`} x2="100%" y2={`${pos2}%`} stroke={color} strokeWidth="1" opacity={opacity} />
      {/* Power points */}
      <circle cx={`${pos1}%`} cy={`${pos1}%`} r="4" fill={color} opacity={opacity * 1.5} />
      <circle cx={`${pos2}%`} cy={`${pos1}%`} r="4" fill={color} opacity={opacity * 1.5} />
      <circle cx={`${pos1}%`} cy={`${pos2}%`} r="4" fill={color} opacity={opacity * 1.5} />
      <circle cx={`${pos2}%`} cy={`${pos2}%`} r="4" fill={color} opacity={opacity * 1.5} />
    </svg>
  );
};

// Golden Spiral (Fibonacci)
const GoldenSpiral: React.FC<{ color: string; opacity: number }> = ({ color, opacity }) => {
  // Approximate golden spiral using bezier curves
  const spiralPath = `
    M 100 100
    Q 100 61.8, 61.8 61.8
    Q 38.2 61.8, 38.2 38.2
    Q 38.2 23.6, 52.8 23.6
    Q 61.8 23.6, 61.8 32.6
    Q 61.8 38.2, 56.2 38.2
    Q 52.8 38.2, 52.8 34.8
  `;
  
  return (
    <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
      {/* Golden rectangles */}
      <rect x="0" y="0" width="61.8" height="100" fill="none" stroke={color} strokeWidth="0.5" opacity={opacity * 0.5} />
      <rect x="61.8" y="0" width="38.2" height="61.8" fill="none" stroke={color} strokeWidth="0.5" opacity={opacity * 0.5} />
      <rect x="61.8" y="61.8" width="23.6" height="38.2" fill="none" stroke={color} strokeWidth="0.5" opacity={opacity * 0.5} />
      {/* Spiral curve */}
      <path d={spiralPath} fill="none" stroke={color} strokeWidth="1.5" opacity={opacity} />
    </svg>
  );
};

// Diagonal Lines
const DiagonalLines: React.FC<{ color: string; opacity: number }> = ({ color, opacity }) => (
  <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
    {/* Main diagonals */}
    <line x1="0" y1="0" x2="100%" y2="100%" stroke={color} strokeWidth="1" opacity={opacity} />
    <line x1="100%" y1="0" x2="0" y2="100%" stroke={color} strokeWidth="1" opacity={opacity} />
    {/* Reciprocal diagonals (baroque/sinister) */}
    <line x1="0" y1="0" x2="50%" y2="100%" stroke={color} strokeWidth="0.5" opacity={opacity * 0.6} strokeDasharray="4,4" />
    <line x1="50%" y1="0" x2="100%" y2="100%" stroke={color} strokeWidth="0.5" opacity={opacity * 0.6} strokeDasharray="4,4" />
    <line x1="0" y1="0" x2="100%" y2="50%" stroke={color} strokeWidth="0.5" opacity={opacity * 0.6} strokeDasharray="4,4" />
    <line x1="0" y1="50%" x2="100%" y2="100%" stroke={color} strokeWidth="0.5" opacity={opacity * 0.6} strokeDasharray="4,4" />
  </svg>
);

// Center Cross
const CenterCross: React.FC<{ color: string; opacity: number }> = ({ color, opacity }) => (
  <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
    {/* Vertical center line */}
    <line x1="50%" y1="0" x2="50%" y2="100%" stroke={color} strokeWidth="1" opacity={opacity} strokeDasharray="8,4" />
    {/* Horizontal center line */}
    <line x1="0" y1="50%" x2="100%" y2="50%" stroke={color} strokeWidth="1" opacity={opacity} strokeDasharray="8,4" />
    {/* Center marker */}
    <circle cx="50%" cy="50%" r="8" fill="none" stroke={color} strokeWidth="2" opacity={opacity} />
    <circle cx="50%" cy="50%" r="2" fill={color} opacity={opacity} />
  </svg>
);

// Golden Triangle
const GoldenTriangle: React.FC<{ color: string; opacity: number }> = ({ color, opacity }) => (
  <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
    {/* Main diagonal */}
    <line x1="0" y1="100%" x2="100%" y2="0" stroke={color} strokeWidth="1.5" opacity={opacity} />
    {/* Perpendicular from top-left corner */}
    <line x1="0" y1="0" x2="50%" y2="50%" stroke={color} strokeWidth="1" opacity={opacity * 0.8} />
    {/* Perpendicular from bottom-right corner */}
    <line x1="100%" y1="100%" x2="50%" y2="50%" stroke={color} strokeWidth="1" opacity={opacity * 0.8} />
    {/* Intersection point */}
    <circle cx="50%" cy="50%" r="4" fill={color} opacity={opacity * 1.5} />
  </svg>
);

// Dynamic Symmetry (Root Rectangles)
const DynamicSymmetry: React.FC<{ color: string; opacity: number }> = ({ color, opacity }) => (
  <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
    {/* Root 2 rectangle diagonals */}
    <line x1="0" y1="0" x2="70.7%" y2="100%" stroke={color} strokeWidth="1" opacity={opacity * 0.7} />
    <line x1="29.3%" y1="0" x2="100%" y2="100%" stroke={color} strokeWidth="1" opacity={opacity * 0.7} />
    <line x1="0" y1="0" x2="100%" y2="70.7%" stroke={color} strokeWidth="1" opacity={opacity * 0.7} />
    <line x1="0" y1="29.3%" x2="100%" y2="100%" stroke={color} strokeWidth="1" opacity={opacity * 0.7} />
    {/* Armature */}
    <line x1="0" y1="0" x2="100%" y2="100%" stroke={color} strokeWidth="1" opacity={opacity} />
    <line x1="100%" y1="0" x2="0" y2="100%" stroke={color} strokeWidth="1" opacity={opacity} />
  </svg>
);

export const CompositionOverlays: React.FC<CompositionOverlaysProps> = ({
  activeGuides,
  color = '#00ff88',
  opacity = 0.5,
  width = '100%',
  height = '100%',
}) => {
  const guideComponents = useMemo(() => {
    return activeGuides.map((guide) => {
      switch (guide) {
        case 'rule_of_thirds':
          return <RuleOfThirds key={guide} color={color} opacity={opacity} />;
        case 'golden_ratio':
          return <GoldenRatio key={guide} color={color} opacity={opacity} />;
        case 'golden_spiral':
          return <GoldenSpiral key={guide} color={color} opacity={opacity} />;
        case 'diagonal':
          return <DiagonalLines key={guide} color={color} opacity={opacity} />;
        case 'center_cross':
          return <CenterCross key={guide} color={color} opacity={opacity} />;
        case 'golden_triangle':
          return <GoldenTriangle key={guide} color={color} opacity={opacity} />;
        case 'dynamic_symmetry':
          return <DynamicSymmetry key={guide} color={color} opacity={opacity} />;
        default:
          return null;
      }
    });
  }, [activeGuides, color, opacity]);

  return (
    <Box
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        width,
        height,
        pointerEvents: 'none',
        zIndex: 1}}
    >
      {/* AI Feedback Overlay */}
      {aiFeedback && aiFeedback.objects && aiFeedback.objects.map((obj, idx) => (
        <Box
          key={idx}
          sx={{
            position: 'absolute',
            left: `${(obj.center[0] / (width as number || 1920)) * 100}%`,
            top: `${(obj.center[1] / (height as number || 1080)) * 100}%`,
            width: `${(obj.bbox[2] / (width as number || 1920)) * 100}%`,
            height: `${(obj.bbox[3] / (height as number || 1080)) * 100}%`,
            border: `2px solid ${aiFeedback.score >= 80 ? '#4CAF50' : aiFeedback.score >= 60 ? '#FFC107' : '#F44336'}`,
            borderRadius: 1,
            pointerEvents: 'none'}}
        />
      ))}
      {guideComponents}
    </Box>
  );
};

export default CompositionOverlays;

