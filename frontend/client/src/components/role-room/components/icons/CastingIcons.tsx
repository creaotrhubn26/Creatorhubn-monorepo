/**
 * Custom SVG Icons for Casting Planner Navigation
 * These icons provide a consistent, unique visual language for the application
 */

import React from 'react';
import { useTheme, useMediaQuery } from '@mui/material';

interface IconProps {
  sx?: any; // Accept MUI sx prop format including responsive values
  className?: string;
  style?: React.CSSProperties;
  [key: string]: any;
}

// Helper hook to extract fontSize from sx prop (handles responsive values)
const useIconStyle = (sx?: any, style?: React.CSSProperties): React.CSSProperties => {
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.only('xs'));
  const isSm = useMediaQuery(theme.breakpoints.only('sm'));
  const isMd = useMediaQuery(theme.breakpoints.only('md'));
  const isLg = useMediaQuery(theme.breakpoints.only('lg'));
  
  let fontSize = '1em';
  
  if (sx?.fontSize) {
    // If it's a simple value, use it directly
    if (typeof sx.fontSize === 'string' || typeof sx.fontSize === 'number') {
      fontSize = typeof sx.fontSize === 'number' ? `${sx.fontSize}px` : sx.fontSize;
    }
    // Handle responsive object { xs, sm, md, lg, xl }
    else if (typeof sx.fontSize === 'object') {
      if (isXs && sx.fontSize.xs) fontSize = typeof sx.fontSize.xs === 'number' ? `${sx.fontSize.xs}px` : sx.fontSize.xs;
      else if (isSm && sx.fontSize.sm) fontSize = typeof sx.fontSize.sm === 'number' ? `${sx.fontSize.sm}px` : sx.fontSize.sm;
      else if (isMd && sx.fontSize.md) fontSize = typeof sx.fontSize.md === 'number' ? `${sx.fontSize.md}px` : sx.fontSize.md;
      else if (isLg && sx.fontSize.lg) fontSize = typeof sx.fontSize.lg === 'number' ? `${sx.fontSize.lg}px` : sx.fontSize.lg;
      else if (sx.fontSize.xl) fontSize = typeof sx.fontSize.xl === 'number' ? `${sx.fontSize.xl}px` : sx.fontSize.xl;
      else {
        // Fallback to first available
        const firstValue = sx.fontSize.xs || sx.fontSize.sm || sx.fontSize.md || sx.fontSize.lg || sx.fontSize.xl;
        fontSize = typeof firstValue === 'number' ? `${firstValue}px` : (firstValue || '1em');
      }
    }
  }

  return {
    width: fontSize,
    height: fontSize,
    display: 'block',
    fill: 'currentColor',
    color: sx?.color,
    ...style,
  };
};

// Dashboard/Overview Icon - Grid with film strip elements
export const DashboardCustomIcon: React.FC<IconProps> = ({ sx, style, ...props }) => {
  const iconStyle = useIconStyle(sx, style);
  return (
    <svg viewBox="0 0 24 24" style={iconStyle} {...props}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.9" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.7" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.7" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.5" />
      <circle cx="6.5" cy="6.5" r="1" fill="currentColor" opacity="0.3" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" opacity="0.3" />
    </svg>
  );
};

// Roles Icon - Theater masks combined
export const RolesIcon: React.FC<IconProps> = ({ sx, style, ...props }) => {
  const iconStyle = useIconStyle(sx, style);
  return (
    <svg viewBox="0 0 24 24" style={iconStyle} {...props}>
      <path d="M9 2C5.5 2 3 5 3 8.5c0 4 3.5 6.5 6 6.5s3.5-1 3.5-1" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="6" cy="7" r="1" fill="currentColor" />
      <circle cx="10" cy="7" r="1" fill="currentColor" />
      <path d="M6 10.5 Q8 13 10 10.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M15 8c3.5 0 6 3 6 6.5 0 4-3.5 6.5-6 6.5s-6-2.5-6-6.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity="0.8" />
      <circle cx="13" cy="13" r="1" fill="currentColor" opacity="0.8" />
      <circle cx="17" cy="13" r="1" fill="currentColor" opacity="0.8" />
      <path d="M13 17.5 Q15 15 17 17.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
    </svg>
  );
};

// Candidates Icon - Person with star/talent badge
export const CandidatesIcon: React.FC<IconProps> = ({ sx, style, ...props }) => {
  const iconStyle = useIconStyle(sx, style);
  return (
    <svg viewBox="0 0 24 24" style={iconStyle} {...props}>
      <circle cx="10" cy="7" r="4" fill="currentColor" />
      <path d="M3 21v-2c0-3 3-5 7-5s7 2 7 5v2" fill="currentColor" opacity="0.8" />
      <path d="M19 2l1.2 2.4 2.8.4-2 2 .5 2.8L19 8.4l-2.5 1.2.5-2.8-2-2 2.8-.4z" fill="currentColor" />
    </svg>
  );
};

// Auditions Icon - Microphone with sound waves
export const AuditionsIcon: React.FC<IconProps> = ({ sx, style, ...props }) => {
  const iconStyle = useIconStyle(sx, style);
  return (
    <svg viewBox="0 0 24 24" style={iconStyle} {...props}>
      <rect x="9" y="2" width="6" height="10" rx="3" fill="currentColor" />
      <path d="M6 9v2a6 6 0 0012 0V9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="12" y1="17" x2="12" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="8" y1="21" x2="16" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M18 5c1 1 1.5 2.5 1.5 4s-.5 3-1.5 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <path d="M20 3c1.5 1.5 2.5 4 2.5 6s-1 4.5-2.5 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
    </svg>
  );
};

// Team/Crew Icon - Multiple people with clapperboard element
export const TeamIcon: React.FC<IconProps> = ({ sx, style, ...props }) => {
  const iconStyle = useIconStyle(sx, style);
  return (
    <svg viewBox="0 0 24 24" style={iconStyle} {...props}>
      <circle cx="12" cy="6" r="3.5" fill="currentColor" />
      <path d="M5 20v-2c0-2.5 3-4.5 7-4.5s7 2 7 4.5v2" fill="currentColor" opacity="0.85" />
      <circle cx="4" cy="8" r="2.5" fill="currentColor" opacity="0.6" />
      <path d="M0 18v-1c0-1.5 1.5-3 4-3" fill="currentColor" opacity="0.5" />
      <circle cx="20" cy="8" r="2.5" fill="currentColor" opacity="0.6" />
      <path d="M24 18v-1c0-1.5-1.5-3-4-3" fill="currentColor" opacity="0.5" />
      <rect x="17" y="2" width="5" height="4" rx="0.5" fill="currentColor" opacity="0.7" />
      <line x1="17" y1="3.5" x2="22" y2="2" stroke="currentColor" strokeWidth="0.8" opacity="0.5" />
    </svg>
  );
};

// Locations Icon - Map pin with building
export const LocationsIcon: React.FC<IconProps> = ({ sx, style, ...props }) => {
  const iconStyle = useIconStyle(sx, style);
  return (
    <svg viewBox="0 0 24 24" style={iconStyle} {...props}>
      <path d="M12 2C8 2 5 5.5 5 9.5c0 5 7 12.5 7 12.5s7-7.5 7-12.5C19 5.5 16 2 12 2z" fill="currentColor" opacity="0.9" />
      <rect x="9" y="6" width="6" height="5" fill="white" opacity="0.9" />
      <rect x="10" y="7" width="1.5" height="1.5" fill="currentColor" opacity="0.7" />
      <rect x="12.5" y="7" width="1.5" height="1.5" fill="currentColor" opacity="0.7" />
      <rect x="10.75" y="9.5" width="2.5" height="1.5" fill="currentColor" opacity="0.7" />
    </svg>
  );
};

// Equipment/Props Icon - Camera with gear
export const EquipmentIcon: React.FC<IconProps> = ({ sx, style, ...props }) => {
  const iconStyle = useIconStyle(sx, style);
  return (
    <svg viewBox="0 0 24 24" style={iconStyle} {...props}>
      <rect x="2" y="7" width="14" height="11" rx="2" fill="currentColor" />
      <circle cx="9" cy="12.5" r="3.5" fill="white" opacity="0.3" />
      <circle cx="9" cy="12.5" r="2" fill="currentColor" opacity="0.5" />
      <rect x="3" y="5" width="4" height="2" rx="0.5" fill="currentColor" opacity="0.8" />
      <circle cx="19" cy="7" r="4" fill="currentColor" opacity="0.85" />
      <circle cx="19" cy="7" r="2" fill="white" opacity="0.2" />
      <rect x="18.25" y="2" width="1.5" height="2" fill="currentColor" opacity="0.85" />
      <rect x="18.25" y="10" width="1.5" height="2" fill="currentColor" opacity="0.85" />
      <rect x="14" y="6.25" width="2" height="1.5" fill="currentColor" opacity="0.85" />
      <rect x="22" y="6.25" width="2" height="1.5" fill="currentColor" opacity="0.85" />
    </svg>
  );
};

// Calendar Icon - Calendar with film strip marks
export const CalendarCustomIcon: React.FC<IconProps> = ({ sx, style, ...props }) => {
  const iconStyle = useIconStyle(sx, style);
  return (
    <svg viewBox="0 0 24 24" style={iconStyle} {...props}>
      <rect x="3" y="4" width="18" height="18" rx="2" fill="currentColor" opacity="0.85" />
      <rect x="3" y="4" width="18" height="5" rx="2" fill="currentColor" />
      <rect x="7" y="2" width="2" height="4" rx="1" fill="currentColor" />
      <rect x="15" y="2" width="2" height="4" rx="1" fill="currentColor" />
      <rect x="5" y="11" width="3" height="3" rx="0.5" fill="white" opacity="0.3" />
      <rect x="10" y="11" width="3" height="3" rx="0.5" fill="white" opacity="0.3" />
      <rect x="15" y="11" width="3" height="3" rx="0.5" fill="white" opacity="0.5" />
      <rect x="5" y="16" width="3" height="3" rx="0.5" fill="white" opacity="0.3" />
      <rect x="10" y="16" width="3" height="3" rx="0.5" fill="white" opacity="0.3" />
      <rect x="15" y="16" width="3" height="3" rx="0.5" fill="white" opacity="0.3" />
    </svg>
  );
};

// Shot List Icon - Person with camera and clipboard
export const ShotListIcon: React.FC<IconProps> = ({ sx, style, ...props }) => {
  const iconStyle = useIconStyle(sx, style);
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={iconStyle} {...props}>
      <circle cx="12" cy="8" r="3" />
      <path d="M5 20v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2" />
      <rect x="15" y="3" width="4" height="3" rx="0.5" />
      <circle cx="17" cy="4.5" r="0.8" />
      <line x1="15" y1="4.5" x2="13" y2="4.5" />
      <line x1="16" y1="6" x2="16" y2="7" />
      <rect x="3" y="5" width="3" height="5" rx="0.5" />
      <line x1="4" y1="6.5" x2="5" y2="6.5" />
      <line x1="4" y1="7.5" x2="5" y2="7.5" />
      <line x1="4" y1="8.5" x2="5" y2="8.5" />
      <line x1="4" y1="9.5" x2="5" y2="9.5" />
    </svg>
  );
};

// Story Arc Icon - Connected nodes with flow
export const StoryArcIcon: React.FC<IconProps> = ({ sx, style, ...props }) => {
  const iconStyle = useIconStyle(sx, style);
  return (
    <svg viewBox="0 0 24 24" style={iconStyle} {...props}>
      <path d="M3 18 Q6 4 12 12 Q18 20 21 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      <circle cx="3" cy="18" r="2.5" fill="currentColor" />
      <circle cx="8" cy="8" r="2" fill="currentColor" opacity="0.8" />
      <circle cx="12" cy="12" r="2.5" fill="currentColor" />
      <circle cx="16" cy="16" r="2" fill="currentColor" opacity="0.8" />
      <circle cx="21" cy="6" r="2.5" fill="currentColor" />
      <rect x="10" y="18" width="8" height="5" rx="1" fill="currentColor" opacity="0.6" />
      <line x1="14" y1="18" x2="14" y2="23" stroke="white" strokeWidth="0.5" opacity="0.5" />
    </svg>
  );
};

// Share/Distribution Icon - Network with nodes
export const ShareCustomIcon: React.FC<IconProps> = ({ sx, style, ...props }) => {
  const iconStyle = useIconStyle(sx, style);
  return (
    <svg viewBox="0 0 24 24" style={iconStyle} {...props}>
      <circle cx="12" cy="12" r="3" fill="currentColor" />
      <line x1="12" y1="9" x2="12" y2="4" stroke="currentColor" strokeWidth="2" />
      <line x1="14.5" y1="13.5" x2="19" y2="18" stroke="currentColor" strokeWidth="2" />
      <line x1="9.5" y1="13.5" x2="5" y2="18" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="3" r="2.5" fill="currentColor" opacity="0.85" />
      <circle cx="20" cy="19" r="2.5" fill="currentColor" opacity="0.85" />
      <circle cx="4" cy="19" r="2.5" fill="currentColor" opacity="0.85" />
      <circle cx="6" cy="6" r="1.5" fill="currentColor" opacity="0.4" />
      <circle cx="18" cy="6" r="1.5" fill="currentColor" opacity="0.4" />
    </svg>
  );
};

// Offers Icon - Handshake with document
export const OffersIcon: React.FC<IconProps> = ({ sx, style, ...props }) => {
  const iconStyle = useIconStyle(sx, style);
  return (
    <svg viewBox="0 0 24 24" style={iconStyle} {...props}>
      <path d="M7 11l2-2 3 2 4-3 2 2" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 14l5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M22 14l-5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <rect x="6" y="15" width="12" height="7" rx="1" fill="currentColor" opacity="0.7" />
      <line x1="8" y1="17" x2="16" y2="17" stroke="white" strokeWidth="1" opacity="0.5" />
      <line x1="8" y1="19" x2="14" y2="19" stroke="white" strokeWidth="1" opacity="0.5" />
    </svg>
  );
};

// Contracts Icon - Document with seal
export const ContractsIcon: React.FC<IconProps> = ({ sx, style, ...props }) => {
  const iconStyle = useIconStyle(sx, style);
  return (
    <svg viewBox="0 0 24 24" style={iconStyle} {...props}>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" fill="currentColor" opacity="0.85" />
      <path d="M14 2v6h6" fill="currentColor" opacity="0.6" />
      <line x1="6" y1="11" x2="14" y2="11" stroke="white" strokeWidth="1" opacity="0.5" />
      <line x1="6" y1="14" x2="12" y2="14" stroke="white" strokeWidth="1" opacity="0.5" />
      <circle cx="16" cy="17" r="3.5" fill="currentColor" />
      <circle cx="16" cy="17" r="2" fill="white" opacity="0.3" />
      <path d="M14.5 17l1 1 2-2" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

// Consents Icon - Shield with checkmark
export const ConsentsIcon: React.FC<IconProps> = ({ sx, style, ...props }) => {
  const iconStyle = useIconStyle(sx, style);
  return (
    <svg viewBox="0 0 24 24" style={iconStyle} {...props}>
      <path d="M12 2L4 6v6c0 5.5 3.5 10.7 8 12 4.5-1.3 8-6.5 8-12V6z" fill="currentColor" opacity="0.85" />
      <path d="M12 4L6 7v5c0 4.5 2.8 8.5 6 9.5V4z" fill="currentColor" opacity="0.5" />
      <path d="M9 12l2 2 4-4" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

// Project Icon - Clapperboard
export const ProjectIcon: React.FC<IconProps> = ({ sx, style, ...props }) => {
  const iconStyle = useIconStyle(sx, style);
  return (
    <svg viewBox="0 0 24 24" style={iconStyle} {...props}>
      <rect x="2" y="8" width="20" height="13" rx="2" fill="currentColor" opacity="0.85" />
      <path d="M2 8l20-4v4H2z" fill="currentColor" />
      <rect x="4" y="4.8" width="3" height="3.2" fill="white" opacity="0.3" transform="skewY(-11)" />
      <rect x="10" y="3.6" width="3" height="3.2" fill="white" opacity="0.3" transform="skewY(-11)" />
      <rect x="16" y="2.4" width="3" height="3.2" fill="white" opacity="0.3" transform="skewY(-11)" />
      <rect x="4" y="10" width="8" height="2" rx="0.5" fill="white" opacity="0.3" />
      <rect x="4" y="14" width="12" height="2" rx="0.5" fill="white" opacity="0.3" />
      <rect x="4" y="18" width="6" height="1.5" rx="0.5" fill="white" opacity="0.3" />
    </svg>
  );
};

// Stats/Analytics Icon - Bar chart with trend line
export const StatsIcon: React.FC<IconProps> = ({ sx, style, ...props }) => {
  const iconStyle = useIconStyle(sx, style);
  return (
    <svg viewBox="0 0 24 24" style={iconStyle} {...props}>
      {/* Bar chart bars */}
      <rect x="3" y="14" width="4" height="8" rx="1" fill="currentColor" opacity="0.6" />
      <rect x="10" y="10" width="4" height="12" rx="1" fill="currentColor" opacity="0.8" />
      <rect x="17" y="6" width="4" height="16" rx="1" fill="currentColor" />
      {/* Trend line */}
      <path d="M4 12 L12 6 L20 3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
      {/* Data points */}
      <circle cx="4" cy="12" r="2" fill="currentColor" />
      <circle cx="12" cy="6" r="2" fill="currentColor" />
      <circle cx="20" cy="3" r="2" fill="currentColor" />
    </svg>
  );
};

// Analytics/Insights Icon - Chart with magnifying glass
export const AnalyticsIcon: React.FC<IconProps> = ({ sx, style, ...props }) => {
  const iconStyle = useIconStyle(sx, style);
  return (
    <svg viewBox="0 0 24 24" style={iconStyle} {...props}>
      {/* Chart area */}
      <rect x="2" y="3" width="14" height="14" rx="2" fill="currentColor" opacity="0.3" />
      {/* Chart bars */}
      <rect x="4" y="11" width="2" height="4" rx="0.5" fill="currentColor" />
      <rect x="8" y="8" width="2" height="7" rx="0.5" fill="currentColor" />
      <rect x="12" y="5" width="2" height="10" rx="0.5" fill="currentColor" />
      {/* Magnifying glass */}
      <circle cx="17" cy="17" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <line x1="20" y1="20" x2="23" y2="23" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      {/* Sparkle in magnifier */}
      <circle cx="17" cy="17" r="1.5" fill="currentColor" opacity="0.5" />
    </svg>
  );
};

// Trending/Growth Icon - Arrow trending upward
export const TrendingIcon: React.FC<IconProps> = ({ sx, style, ...props }) => {
  const iconStyle = useIconStyle(sx, style);
  return (
    <svg viewBox="0 0 24 24" style={iconStyle} {...props}>
      {/* Trend line */}
      <path d="M3 17 L9 11 L13 15 L21 7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Arrow head */}
      <path d="M15 7 L21 7 L21 13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Background gradient bars */}
      <rect x="3" y="19" width="4" height="2" rx="0.5" fill="currentColor" opacity="0.3" />
      <rect x="10" y="19" width="4" height="2" rx="0.5" fill="currentColor" opacity="0.5" />
      <rect x="17" y="19" width="4" height="2" rx="0.5" fill="currentColor" opacity="0.7" />
    </svg>
  );
};

// Props/Inventory Icon - Box with items
export const PropsIcon: React.FC<IconProps> = ({ sx, style, ...props }) => {
  const iconStyle = useIconStyle(sx, style);
  return (
    <svg viewBox="0 0 24 24" fill="none" style={iconStyle} {...props}>
      {/* Box base */}
      <path d="M20 7L12 3L4 7V17L12 21L20 17V7Z" stroke="currentColor" strokeWidth="1.5" fill="none" />
      {/* Box center line */}
      <path d="M12 12V21" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 12L20 7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 12L4 7" stroke="currentColor" strokeWidth="1.5" />
      {/* Star highlight on item */}
      <circle cx="12" cy="9" r="2" fill="#ff9800" />
    </svg>
  );
};

// Contact/Person Icon - Person silhouette with info badge
export const ContactIcon: React.FC<IconProps> = ({ sx, style, ...props }) => {
  const iconStyle = useIconStyle(sx, style);
  return (
    <svg viewBox="0 0 24 24" fill="none" style={iconStyle} {...props}>
      {/* Person silhouette */}
      <circle cx="12" cy="8" r="4" fill="currentColor" />
      <path d="M20 21C20 17.134 16.418 14 12 14C7.582 14 4 17.134 4 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
      {/* Info badge */}
      <circle cx="18" cy="6" r="4" fill="#00d4ff" />
      <path d="M18 4.5V5.5M18 7V8.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
};

// Split Sheet/Revenue Icon - Pie chart with money symbol
export const SplitSheetIcon: React.FC<IconProps> = ({ sx, style, ...props }) => {
  const iconStyle = useIconStyle(sx, style);
  return (
    <svg viewBox="0 0 24 24" fill="none" style={iconStyle} {...props}>
      {/* Pie chart */}
      <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M12 2V12H22C22 6.48 17.52 2 12 2Z" fill="#9f7aea" stroke="currentColor" strokeWidth="1.5" />
      {/* Divider lines */}
      <path d="M12 12L7 18" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 12L5 8" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
};

// Folder/Project Icon - Folder with film strip
export const FolderProjectIcon: React.FC<IconProps> = ({ sx, style, ...props }) => {
  const iconStyle = useIconStyle(sx, style);
  return (
    <svg viewBox="0 0 24 24" fill="none" style={iconStyle} {...props}>
      {/* Folder */}
      <path d="M2 6C2 4.89543 2.89543 4 4 4H9L11 6H20C21.1046 6 22 6.89543 22 8V18C22 19.1046 21.1046 20 20 20H4C2.89543 20 2 19.1046 2 18V6Z" stroke="currentColor" strokeWidth="1.5" fill="none" />
      {/* Film strip holes */}
      <rect x="5" y="10" width="2" height="2" rx="0.5" fill="currentColor" />
      <rect x="5" y="14" width="2" height="2" rx="0.5" fill="currentColor" />
      <rect x="17" y="10" width="2" height="2" rx="0.5" fill="currentColor" />
      <rect x="17" y="14" width="2" height="2" rx="0.5" fill="currentColor" />
      {/* Play symbol */}
      <path d="M10 10L14 12.5L10 15V10Z" fill="#00d4ff" />
    </svg>
  );
};

// Email Icon - Envelope with @ symbol
export const EmailIcon: React.FC<IconProps> = ({ sx, style, ...props }) => {
  const iconStyle = useIconStyle(sx, style);
  return (
    <svg viewBox="0 0 24 24" fill="none" style={iconStyle} {...props}>
      {/* Envelope */}
      <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
      {/* Mail flap */}
      <path d="M2 6L12 13L22 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
};

// Phone Icon - Modern smartphone
export const PhoneIcon: React.FC<IconProps> = ({ sx, style, ...props }) => {
  const iconStyle = useIconStyle(sx, style);
  return (
    <svg viewBox="0 0 24 24" fill="none" style={iconStyle} {...props}>
      {/* Phone body */}
      <rect x="5" y="2" width="14" height="20" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
      {/* Screen */}
      <rect x="7" y="4" width="10" height="14" rx="1" fill="currentColor" opacity="0.2" />
      {/* Home button/notch */}
      <rect x="10" y="19" width="4" height="1" rx="0.5" fill="currentColor" />
    </svg>
  );
};

// Event/Calendar Icon - Calendar with checkmark
export const EventIcon: React.FC<IconProps> = ({ sx, style, ...props }) => {
  const iconStyle = useIconStyle(sx, style);
  return (
    <svg viewBox="0 0 24 24" fill="none" style={iconStyle} {...props}>
      {/* Calendar body */}
      <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
      {/* Calendar hooks */}
      <path d="M8 2V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M16 2V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      {/* Divider line */}
      <path d="M3 9H21" stroke="currentColor" strokeWidth="1.5" />
      {/* Checkmark */}
      <path d="M8 14L11 17L16 12" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

// Business/Company Icon - Building with briefcase
export const CompanyIcon: React.FC<IconProps> = ({ sx, style, ...props }) => {
  const iconStyle = useIconStyle(sx, style);
  return (
    <svg viewBox="0 0 24 24" fill="none" style={iconStyle} {...props}>
      {/* Building */}
      <path d="M3 21H21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="5" y="3" width="14" height="18" stroke="currentColor" strokeWidth="1.5" fill="none" />
      {/* Windows */}
      <rect x="8" y="6" width="3" height="3" fill="currentColor" />
      <rect x="13" y="6" width="3" height="3" fill="currentColor" />
      <rect x="8" y="11" width="3" height="3" fill="currentColor" />
      <rect x="13" y="11" width="3" height="3" fill="currentColor" />
      {/* Door */}
      <rect x="10" y="16" width="4" height="5" fill="#00d4ff" />
    </svg>
  );
};

// Address/Home icon (house with location pin)
export const AddressIcon: React.FC<IconProps> = ({ sx, style, ...props }) => {
  const iconStyle = useIconStyle(sx, style);
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" style={iconStyle} {...props}>
      <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
      <circle cx="17" cy="17" r="4" fill="none" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="17" cy="17" r="1.5" fill="currentColor"/>
    </svg>
  );
};

// Notes/Description icon (notepad with lines)
export const NotesIcon: React.FC<IconProps> = ({ sx, style, ...props }) => {
  const iconStyle = useIconStyle(sx, style);
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" style={iconStyle} {...props}>
      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10H7v-2h10v2zm0-4H7V7h10v2z"/>
      <path d="M17 13H7v2h10v-2z" opacity="0.5"/>
    </svg>
  );
};

// Capacity/Group size icon (people count)
export const CapacityIcon: React.FC<IconProps> = ({ sx, style, ...props }) => {
  const iconStyle = useIconStyle(sx, style);
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" style={iconStyle} {...props}>
      <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
      <text x="12" y="22" fontSize="6" textAnchor="middle" fill="currentColor" fontWeight="bold">N</text>
    </svg>
  );
};

// Quantity icon (stack/number)
export const QuantityIcon: React.FC<IconProps> = ({ sx, style, ...props }) => {
  const iconStyle = useIconStyle(sx, style);
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" style={iconStyle} {...props}>
      <path d="M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm-6 4h4V4h-4v4zm6 6h4v-4h-4v4zm0 6h4v-4h-4v4z"/>
    </svg>
  );
};

// Storage/Location icon (box with location)
export const StorageIcon: React.FC<IconProps> = ({ sx, style, ...props }) => {
  const iconStyle = useIconStyle(sx, style);
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" style={iconStyle} {...props}>
      <path d="M20 2H4c-1 0-2 .9-2 2v3.01c0 .72.43 1.34 1 1.69V20c0 1.1 1.1 2 2 2h14c.9 0 2-.9 2-2V8.7c.57-.35 1-.97 1-1.69V4c0-1.1-1-2-2-2zm-5 12H9v-2h6v2zm5-7H4V4h16v3z"/>
    </svg>
  );
};

// Category icon (tag/folder)
export const CategoryCustomIcon: React.FC<IconProps> = ({ sx, style, ...props }) => {
  const iconStyle = useIconStyle(sx, style);
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" style={iconStyle} {...props}>
      <path d="M12 2l-5.5 9h11L12 2zm0 3.84L13.93 9h-3.87L12 5.84zM17.5 13c-2.49 0-4.5 2.01-4.5 4.5s2.01 4.5 4.5 4.5 4.5-2.01 4.5-4.5-2.01-4.5-4.5-4.5zm0 7c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5zM3 21.5h8v-8H3v8zm2-6h4v4H5v-4z"/>
    </svg>
  );
};

// Rate/Money icon (dollar with circle)
export const RateIcon: React.FC<IconProps> = ({ sx, style, ...props }) => {
  const iconStyle = useIconStyle(sx, style);
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" style={iconStyle} {...props}>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z"/>
    </svg>
  );
};

// Person/Name icon (single person with ID badge)
export const PersonNameIcon: React.FC<IconProps> = ({ sx, style, ...props }) => {
  const iconStyle = useIconStyle(sx, style);
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" style={iconStyle} {...props}>
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
      <rect x="15" y="3" width="6" height="4" rx="0.5" fill="currentColor" opacity="0.5"/>
      <line x1="16" y1="4.5" x2="20" y2="4.5" stroke="#fff" strokeWidth="0.75"/>
      <line x1="16" y1="5.75" x2="19" y2="5.75" stroke="#fff" strokeWidth="0.75"/>
    </svg>
  );
};

// Export all icons as a collection for easy access
export const CastingIcons = {
  Dashboard: DashboardCustomIcon,
  Roles: RolesIcon,
  Candidates: CandidatesIcon,
  Auditions: AuditionsIcon,
  Team: TeamIcon,
  Locations: LocationsIcon,
  Equipment: EquipmentIcon,
  Calendar: CalendarCustomIcon,
  ShotList: ShotListIcon,
  StoryArc: StoryArcIcon,
  Share: ShareCustomIcon,
  Offers: OffersIcon,
  Contracts: ContractsIcon,
  Consents: ConsentsIcon,
  Project: ProjectIcon,
  Stats: StatsIcon,
  Analytics: AnalyticsIcon,
  Trending: TrendingIcon,
  Props: PropsIcon,
  Contact: ContactIcon,
  SplitSheet: SplitSheetIcon,
  FolderProject: FolderProjectIcon,
  Email: EmailIcon,
  Phone: PhoneIcon,
  Event: EventIcon,
  Company: CompanyIcon,
  Address: AddressIcon,
  Notes: NotesIcon,
  Capacity: CapacityIcon,
  Quantity: QuantityIcon,
  Storage: StorageIcon,
  Category: CategoryCustomIcon,
  Rate: RateIcon,
  PersonName: PersonNameIcon,
};

export default CastingIcons;
