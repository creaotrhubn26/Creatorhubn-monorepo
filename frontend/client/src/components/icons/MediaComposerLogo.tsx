import React from 'react';

interface MediaComposerLogoProps {
  size?: number;
  className?: string;
}

const MediaComposerLogo: React.FC<MediaComposerLogoProps> = ({ size = 24, className = '' }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Media Composer logo"
    >
      <defs>
        <linearGradient id="avidGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF6B35" />
          <stop offset="50%" stopColor="#F7931E" />
          <stop offset="100%" stopColor="#FFD23F" />
        </linearGradient>
      </defs>

      <circle cx="12" cy="12" r="11" fill="url(#avidGradient)" stroke="#E5E5E5" strokeWidth="0.5" />

      <path d="M8 16L12 8L16 16H14.5L13.5 14H10.5L9.5 16H8Z" fill="white" fillOpacity="0.95" />
      <path d="M11.2 12H12.8L12 10.5L11.2 12Z" fill="url(#avidGradient)" />

      <rect x="6" y="18" width="2" height="1" fill="white" fillOpacity="0.8" />
      <rect x="9" y="18" width="2" height="1" fill="white" fillOpacity="0.8" />
      <rect x="13" y="18" width="2" height="1" fill="white" fillOpacity="0.8" />
      <rect x="16" y="18" width="2" height="1" fill="white" fillOpacity="0.8" />

      <path d="M4 6L6 4L4 4Z" fill="white" fillOpacity="0.6" />
      <path d="M20 6L18 4L20 4Z" fill="white" fillOpacity="0.6" />
    </svg>
  );
};

export default MediaComposerLogo;
