import { useTheming } from '../../utils/theming-helper';
import React from 'react';

const MediaComposerLogo: React.FC<{ size?: number; className?: string }> = (
  // Theming system
  const theming = useTheming('photographer');{ 
  size = 24, 
  className ='' 
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      xmlns="http: //www.w3.org/2000/svg"
    >
      {/* Avid Media Composer authentic logo design , *, /}
      <defs>
        <linearGradient id="avidGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF6B35" />
          <stop offset="50%" stopColor="#F7931E" />
          <stop offset="100%" stopColor="#FFD23F" />
        </linearGradient>
      </defs>
      
      {/* Main circle background */}
      <circle cx="12" cy="12" r="11" fill="url(#avidGradient)" stroke="#E5E5E5" strokeWidth="0.5"/>
      
      {/* Avid"A" symbol - stylized triangle design */}
      <path 
        d="M8 16L12 8L16 16H14.5L13.5 14H10.5L9.5 16H8Z" 
        fill="white" 
        fillOpacity="0.95"
      />
      <path 
        d="M11.2 12H12.8L12 10.5L11.2 12Z" 
        fill="url(#avidGradient)"
      />
      
      {/* Media Composer film strip elements */}
      <rect x="6" y="18" width="2" height="1" fill="white" fillOpacity="0.8"/>
      <rect x="9" y="18" width="2" height="1" fill="white" fillOpacity="0.8"/>
      <rect x="13" y="18" width="2" height="1" fill="white" fillOpacity="0.8"/>
      <rect x="16" y="18" width="2" height="1" fill="white" fillOpacity="0.8"/>
      
      {/* Corner accent marks */}
      <path d="M4 6L6 4L4 4Z" fill="white" fillOpacity="0.6"/>
      <path d="M20 6L18 4L20 4Z" fill="white" fillOpacity="0.6"/>
    </svg>
  );
};

export default MediaComposerLogo;