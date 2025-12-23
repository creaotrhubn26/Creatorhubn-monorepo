import { useTheming } from '../../utils/theming-helper';
import React from 'react';
import { Box, SvgIcon } from '@mui/material';

interface StoryArcStudioLogoProps {
  width?: number | string;
  height?: number | string;
  variant?: 'full' | 'icon-only';
}

export const StoryArcStudioLogo: React.FC<StoryArcStudioLogoProps> = ({ 
  width = 200, 
  height = 60,
  variant = 'full' 
}) => {
  if (variant === 'icon-only') {
    return (
      <SvgIcon 
        sx={{ width: width, height: height }}
        viewBox="0 0 36 36"
      >
        {/* Story Arc Icon Only */}
        <defs>
          <linearGradient id="iconGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{stopColor: '#FF8A00', stopOpacity:  1}} />
            <stop offset="100%" style={{stopColor: '#FFA733', stopOpacity:  1}} />
          </linearGradient>
        </defs>
        
        {/* Timeline base */}
        <rect x="2" y="18" width="32" height="2" fill="url(#iconGradient)" rx="1"/>
        
        {/* Story arc curve */}
        <path d="M 4 18 Q 18 6 32 18" stroke="url(#iconGradient)" strokeWidth="2.5" fill="none"/>
        
        {/* Key moments (beats) */}
        <circle cx="8" cy="18" r="2.5" fill="#FF8A00"/>
        <circle cx="18" cy="10" r="3" fill="#FFA733"/>
        <circle cx="28" cy="18" r="2.5" fill="#FF8A00"/>
        
        {/* Video editing tracks */}
        <rect x="2" y="24" width="32" height="1.5" fill="rgba(255,138,0,0.4)" rx="0.75"/>
        <rect x="2" y="28" width="28" height="1.5" fill="rgba(255,138,0,0.3)" rx="0.75"/>
        <rect x="2" y="32" width="24" height="1.5" fill="rgba(255,138,0,0.2)" rx="0.75"/>
      </SvgIcon>
    );
}

  return (
    <Box 
      sx={{ 
        width: width, 
        height: height,
        display: 'flex',
        alignItems: 'center'
    }}
    >
      <svg width={width} height={height} viewBox="0 0 500 500" xmlns="http: //www.w3.org/2000/svg">
        <defs>
          <linearGradient id="goldA" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#FFF8DC"/>
            <stop offset="0.25" stopColor="#F5D27A"/>
            <stop offset="0.5" stopColor="#D4AF37"/>
            <stop offset="0.75" stopColor="#B8890B"/>
            <stop offset="1" stopColor="#8A6C00"/>
          </linearGradient>
          <filter id="shadowA">
            <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#000" floodOpacity="0.35"/>
          </filter>
        </defs>
        
        {/* Outer lens ring */}
        <circle cx="250" cy="200" r="120" fill="none" stroke="url(#goldA)" strokeWidth="12" filter="url(#shadowA)"/>
        
        {/* Aperture blades */}
        <g fill="url(#goldA)" opacity="0.9" transform="translate(250,200)">
          <path d="M0,-100 L40,-25 A100,100 0 0 1 -40,-25 Z"/>
          <path d="M87,-50 L20,40 A100,100 0 0 1 40,-25 Z"/>
          <path d="M55,85 L-40,25 A100,100 0 0 1 20,40 Z"/>
          <path d="M-55,85 L-20,-40 A100,100 0 0 1 -40,25 Z"/>
          <path d="M-87,-50 L40,-25 A100,100 0 0 1 -20,-40 Z"/>
          <path d="M0,-100 L-40,25 A100,100 0 0 1 -87,-50 Z"/>
        </g>
        
        {/* Timeline markers in center */}
        <rect x="235" y="190" width="6" height="20" fill="url(#goldA)"/>
        <rect x="247" y="190" width="6" height="20" fill="url(#goldA)"/>
        <rect x="259" y="190" width="6" height="20" fill="url(#goldA)"/>
        
        {/* Text */}
        <text x="250" y="360" fontSize="40" fontWeight="800" textAnchor="middle" fill="url(#goldA)" filter="url(#shadowA)">
          Story Arc Studio
        </text>
        <text x="250" y="400" fontSize="18" textAnchor="middle" fill="#E6C45C">
          by CreatorHub Norge
        </text>
      </svg>
    </Box>
  );
};

export default StoryArcStudioLogo;