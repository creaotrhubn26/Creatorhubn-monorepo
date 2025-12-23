/**
 * Video Production Guides
 * 
 * Safe zone overlays for video production:
 * - Title Safe (90%)
 * - Action Safe (93%)
 * - Aspect Ratio Masks
 * - Center Markers
 */

import React, { useMemo } from 'react';
import { Box } from '@mui/material';

export type AspectRatioType = 
  | '16:9'
  | '4:3'
  | '21:9'
  | '2.35:1'
  | '1.85:1'
  | '1:1'
  | '9:16'
  | '4:5'
  | 'custom';

interface VideoProductionGuidesProps {
  showTitleSafe?: boolean;
  showActionSafe?: boolean;
  showAspectRatioMask?: boolean;
  showCenterMarkers?: boolean;
  aspectRatio?: AspectRatioType;
  customAspectRatio?: number; // width/height
  titleSafePercent?: number; // default 90%
  actionSafePercent?: number; // default 93%
  color?: string;
  opacity?: number;
  width?: number | string;
  height?: number | string;
}

// Title Safe Zone (90% of frame)
const TitleSafeZone: React.FC<{ percent: number; color: string; opacity: number }> = ({
  percent,
  color,
  opacity,
}) => {
  const offset = (100 - percent) / 2;
  
  return (
    <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
      <rect
        x={`${offset}%`}
        y={`${offset}%`}
        width={`${percent}%`}
        height={`${percent}%`}
        fill="none"
        stroke={color}
        strokeWidth="1"
        strokeDasharray="8,4"
        opacity={opacity}
      />
      {/* Corner markers */}
      {[
        { x: offset, y: offset },
        { x: 100 - offset, y: offset },
        { x: offset, y: 100 - offset },
        { x: 100 - offset, y: 100 - offset },
      ].map((corner, i) => (
        <g key={i}>
          <line
            x1={`${corner.x}%`}
            y1={`${corner.y}%`}
            x2={`${corner.x + (i % 2 === 0 ? 2 : -2)}%`}
            y2={`${corner.y}%`}
            stroke={color}
            strokeWidth="2"
            opacity={opacity}
          />
          <line
            x1={`${corner.x}%`}
            y1={`${corner.y}%`}
            x2={`${corner.x}%`}
            y2={`${corner.y + (i < 2 ? 2 : -2)}%`}
            stroke={color}
            strokeWidth="2"
            opacity={opacity}
          />
        </g>
      ))}
      {/* Label */}
      <text
        x={`${offset + 1}%`}
        y={`${offset + 3}%`}
        fill={color}
        fontSize="10"
        opacity={opacity}
      >
        Title Safe ({percent}%)
      </text>
    </svg>
  );
};

// Action Safe Zone (93% of frame)
const ActionSafeZone: React.FC<{ percent: number; color: string; opacity: number }> = ({
  percent,
  color,
  opacity,
}) => {
  const offset = (100 - percent) / 2;
  
  return (
    <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
      <rect
        x={`${offset}%`}
        y={`${offset}%`}
        width={`${percent}%`}
        height={`${percent}%`}
        fill="none"
        stroke={color}
        strokeWidth="1"
        opacity={opacity}
      />
      {/* Label */}
      <text
        x={`${offset + 1}%`}
        y={`${100 - offset - 1}%`}
        fill={color}
        fontSize="10"
        opacity={opacity}
      >
        Action Safe ({percent}%)
      </text>
    </svg>
  );
};

// Aspect Ratio Mask (letterboxing/pillarboxing)
const AspectRatioMask: React.FC<{
  aspectRatio: AspectRatioType;
  customRatio?: number;
  color: string;
  opacity: number;
}> = ({ aspectRatio, customRatio, color, opacity }) => {
  const ratioValue = useMemo(() => {
    switch (aspectRatio) {
      case '16:9': return 16 / 9;
      case '4:3': return 4 / 3;
      case '21:9': return 21 / 9;
      case '2.35:1': return 2.35;
      case '1.85:1': return 1.85;
      case '1:1': return 1;
      case '9:16': return 9 / 16;
      case '4:5': return 4 / 5;
      case 'custom': return customRatio || 16 / 9;
      default: return 16 / 9;
    }
  }, [aspectRatio, customRatio]);

  // Assuming container is 16:9 (common viewfinder)
  const containerRatio = 16 / 9;
  
  const maskStyle = useMemo(() => {
    if (ratioValue > containerRatio) {
      // Letterbox (black bars top/bottom)
      const visibleHeight = (containerRatio / ratioValue) * 100;
      const barHeight = (100 - visibleHeight) / 2;
      return {
        type: 'letterbox',
        barHeight,
        barWidth: 0,
      };
    } else if (ratioValue < containerRatio) {
      // Pillarbox (black bars left/right)
      const visibleWidth = (ratioValue / containerRatio) * 100;
      const barWidth = (100 - visibleWidth) / 2;
      return {
        type: 'pillarbox',
        barHeight: 0,
        barWidth,
      };
    }
    return { type: 'none', barHeight: 0, barWidth: 0 };
  }, [ratioValue, containerRatio]);

  if (maskStyle.type === 'none') return null;

  return (
    <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
      {maskStyle.type === 'letterbox' && (
        <>
          <rect x="0" y="0" width="100%" height={`${maskStyle.barHeight}%`} fill={color} opacity={opacity * 0.8} />
          <rect x="0" y={`${100 - maskStyle.barHeight}%`} width="100%" height={`${maskStyle.barHeight}%`} fill={color} opacity={opacity * 0.8} />
          {/* Border lines */}
          <line x1="0" y1={`${maskStyle.barHeight}%`} x2="100%" y2={`${maskStyle.barHeight}%`} stroke="#fff" strokeWidth="1" opacity={opacity * 0.5} />
          <line x1="0" y1={`${100 - maskStyle.barHeight}%`} x2="100%" y2={`${100 - maskStyle.barHeight}%`} stroke="#fff" strokeWidth="1" opacity={opacity * 0.5} />
        </>
      )}
      {maskStyle.type === 'pillarbox' && (
        <>
          <rect x="0" y="0" width={`${maskStyle.barWidth}%`} height="100%" fill={color} opacity={opacity * 0.8} />
          <rect x={`${100 - maskStyle.barWidth}%`} y="0" width={`${maskStyle.barWidth}%`} height="100%" fill={color} opacity={opacity * 0.8} />
          {/* Border lines */}
          <line x1={`${maskStyle.barWidth}%`} y1="0" x2={`${maskStyle.barWidth}%`} y2="100%" stroke="#fff" strokeWidth="1" opacity={opacity * 0.5} />
          <line x1={`${100 - maskStyle.barWidth}%`} y1="0" x2={`${100 - maskStyle.barWidth}%`} y2="100%" stroke="#fff" strokeWidth="1" opacity={opacity * 0.5} />
        </>
      )}
      {/* Aspect ratio label */}
      <text
        x="50%"
        y={maskStyle.type === 'letterbox' ? `${maskStyle.barHeight / 2 + 1}%` : '4%'}
        fill="#fff"
        fontSize="12"
        textAnchor="middle"
        opacity={opacity}
      >
        {aspectRatio}
      </text>
    </svg>
  );
};

// Center Markers
const CenterMarkers: React.FC<{ color: string; opacity: number }> = ({ color, opacity }) => (
  <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
    {/* Center crosshair */}
    <line x1="48%" y1="50%" x2="52%" y2="50%" stroke={color} strokeWidth="2" opacity={opacity} />
    <line x1="50%" y1="48%" x2="50%" y2="52%" stroke={color} strokeWidth="2" opacity={opacity} />
    <circle cx="50%" cy="50%" r="1%" fill="none" stroke={color} strokeWidth="1" opacity={opacity} />
    
    {/* Edge center markers */}
    {/* Top */}
    <line x1="50%" y1="0" x2="50%" y2="3%" stroke={color} strokeWidth="1" opacity={opacity * 0.7} />
    {/* Bottom */}
    <line x1="50%" y1="97%" x2="50%" y2="100%" stroke={color} strokeWidth="1" opacity={opacity * 0.7} />
    {/* Left */}
    <line x1="0" y1="50%" x2="2%" y2="50%" stroke={color} strokeWidth="1" opacity={opacity * 0.7} />
    {/* Right */}
    <line x1="98%" y1="50%" x2="100%" y2="50%" stroke={color} strokeWidth="1" opacity={opacity * 0.7} />
    
    {/* Corner markers */}
    {[
      { x: 0, y: 0, dx: 1, dy: 1 },
      { x: 100, y: 0, dx: -1, dy: 1 },
      { x: 0, y: 100, dx: 1, dy: -1 },
      { x: 100, y: 100, dx: -1, dy: -1 },
    ].map((corner, i) => (
      <g key={i}>
        <line
          x1={`${corner.x}%`}
          y1={`${corner.y}%`}
          x2={`${corner.x + corner.dx * 5}%`}
          y2={`${corner.y}%`}
          stroke={color}
          strokeWidth="2"
          opacity={opacity * 0.8}
        />
        <line
          x1={`${corner.x}%`}
          y1={`${corner.y}%`}
          x2={`${corner.x}%`}
          y2={`${corner.y + corner.dy * 5}%`}
          stroke={color}
          strokeWidth="2"
          opacity={opacity * 0.8}
        />
      </g>
    ))}
  </svg>
);

// Main Video Production Guides Component
export const VideoProductionGuides: React.FC<VideoProductionGuidesProps> = ({
  showTitleSafe = true,
  showActionSafe = true,
  showAspectRatioMask = false,
  showCenterMarkers = true,
  aspectRatio = '16:9',
  customAspectRatio,
  titleSafePercent = 90,
  actionSafePercent = 93,
  color = '#ffffff',
  opacity = 0.5,
  width = '100%',
  height = '100%',
}) => {
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
      {showAspectRatioMask && (
        <AspectRatioMask
          aspectRatio={aspectRatio}
          customRatio={customAspectRatio}
          color="#000000"
          opacity={opacity}
        />
      )}
      
      {showActionSafe && (
        <ActionSafeZone
          percent={actionSafePercent}
          color="#ff8800"
          opacity={opacity}
        />
      )}
      
      {showTitleSafe && (
        <TitleSafeZone
          percent={titleSafePercent}
          color="#ffcc00"
          opacity={opacity}
        />
      )}
      
      {showCenterMarkers && (
        <CenterMarkers
          color={color}
          opacity={opacity}
        />
      )}
    </Box>
  );
};

export default VideoProductionGuides;

