import { useTheming } from '../../utils/theming-helper';
import { useProfessionConfig } from '../../hooks/useProfessionConfig';
import { useSnackbar } from 'notistack';
import { KeyboardShortcutsTutorial } from './KeyboardShortcutsTutorial';
import { useTutorialPreferences } from '../../hooks/useTutorialPreferences';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Button,
  TextField,
  InputAdornment,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Paper,
  IconButton,
  Tooltip,
  Divider,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Alert,
} from '@mui/material';
import {
  Keyboard,
  Search,
  HelpOutline,
  Star,
  FilterList,
  Build,
  Brush,
  CameraAlt,
  Apple,
  Computer,
  Announcement,
  CropFree,
  AspectRatio,
  GridOn,
  Straighten,
  ZoomIn,
  Rotate90DegreesCcw,
  FlipCameraAndroid,
  Tune,
  Palette,
  Layers,
  AutoMode,
  CenterFocusStrong,
  ShowChart,
  BarChart,
  Thermostat,
  RocketLaunch,
  CameraEnhance,
  MovieFilter,
  Print,
  PhoneAndroid,
  BusinessCenter,
  Analytics,
  Visibility,
  FileDownload,
  Image,
  VideoFile,
  Settings,
  PhotoSizeSelectActual,
  HighQuality,
  Speed as SpeedIcon,
  TrendingUp,
  Insights,
  Campaign,
  Schedule,
  Timeline,
  Update,
  Psychology,
  SentimentSatisfied,
  GetApp,
  CloudDownload,
  FilePresent,
  ExtensionOutlined,
  LibraryBooks,
  ImportExport,
  MusicNote,
} from '@mui/icons-material';

interface KeyboardShortcut {
  id: string;
  action: string;
  shortcutWin: string;
  shortcutMac: string;
  description: string;
  category: string;
  isFavorite?: boolean;
  isNew?: boolean
}

interface Software {
  id: string;
  name: string;
  description?: string;
  icon: any;
  color: string;
  shortcuts: KeyboardShortcut[]
}

// Official Adobe Lightroom logo - Adobe's exact brand colors
const LightroomLogo = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 240 234" fill="currentColor">
    <path d="M10 10h220c5.52 0 10 4.48 10 10v194c0 5.52-4.48 10-10 10H10c-5.52 0-10-4.48-10-10V20c0-5.52 4.48-10 10-10z" fill="#31A8FF"/>
    <path d="M54 180h102l-6-12H66V66h-12v114zm92-78c15.44 0 24.44 7.44 24.44 20.44V186h-11.2v-7.44c-3.2 5.76-9.6 8.32-18.24 8.32-12.8 0-21.12-6.4-21.12-16.64 0-10.88 8.96-16.96 24.32-16.96h14.4v-2.24c0-8.32-4.8-12.8-14.08-12.8-7.68 0-13.44 2.56-17.92 6.72l-5.12-8.96C126.4 132.16 135.04 102 146 102zm12.48 54.4v-9.28h-13.12c-8.96 0-13.44 2.56-13.44 8 0 5.12 4.48 8.32 12.16 8.32 7.04 0 14.4-2.24 14.4-7.04z" fill="white"/>
  </svg>
);

// Official Adobe Photoshop logo - Adobe's exact brand colors  
const PhotoshopLogo = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 240 234" fill="currentColor">
    <path d="M10 10h220c5.52 0 10 4.48 10 10v194c0 5.52-4.48 10-10 10H10c-5.52 0-10-4.48-10-10V20c0-5.52 4.48-10 10-10z" fill="#001E36"/>
    <path d="M54 143v43h-12V66h30.96c20.48 0 33.28 10.88 33.28 28.16 0 18.56-14.08 30.08-35.84 30.08H54zm0-11.2h17.28c14.72 0 22.4-7.04 22.4-18.24 0-10.56-7.68-17.28-22.4-17.28H54v35.52zm92.32 28.8c7.68 0 13.44-2.56 17.92-6.72l5.12 8.96c-5.76 5.44-14.4 8.96-24.32 8.96-18.24 0-30.08-11.52-30.08-28.8s11.84-28.8 28.8-28.8c16.32 0 26.88 10.88 26.88 27.52 0 1.92-.32 4.16-.64 5.76h-43.52c1.28 8.96 7.68 13.12 19.84 13.12zm-18.56-20.48h32c-.64-8.32-6.08-12.48-15.36-12.48-9.6 0-15.36 4.16-16.64 12.48z" fill="#31A8FF"/>
  </svg>
);

// Official Capture One logo - Phase One's exact brand colors
const CaptureOneLogo = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 240 234" fill="currentColor">
    <path d="M10 10h220c5.52 0 10 4.48 10 10v194c0 5.52-4.48 10-10 10H10c-5.52 0-10-4.48-10-10V20c0-5.52 4.48-10 10-10z" fill="#000000"/>
    <path d="M120 186c-32.4 0-58.8-26.4-58.8-58.8 0-32.4 26.4-58.8 58.8-58.8 16.32 0 31.04 6.72 41.76 17.44l-8.48 8.48c-8.32-8.32-19.84-13.44-33.28-13.44-25.92 0-47.04 21.12-47.04 47.04s21.12 47.04 47.04 47.04c13.44 0 24.96-5.12 33.28-13.44l8.48 8.48C151.04 179.28 136.32 186 120 186z" fill="white"/>
    <path d="M178.8 186V66h11.76v108.24h26.88V186H178.8z" fill="white"/>
  </svg>
);

// Official Adobe Premiere Pro logo - Adobe's exact brand colors
const PremiereLogo = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 240 234" fill="currentColor">
    <path d="M10 10h220c5.52 0 10 4.48 10 10v194c0 5.52-4.48 10-10 10H10c-5.52 0-10-4.48-10-10V20c0-5.52 4.48-10 10-10z" fill="#9966FF"/>
    <path d="M54 143v43h-12V66h30.96c20.48 0 33.28 10.88 33.28 28.16 0 18.56-14.08 30.08-35.84 30.08H54zm0-11.2h17.28c14.72 0 22.4-7.04 22.4-18.24 0-10.56-7.68-17.28-22.4-17.28H54v35.52zm92.32 28.8c7.68 0 13.44-2.56 17.92-6.72l5.12 8.96c-5.76 5.44-14.4 8.96-24.32 8.96-18.24 0-30.08-11.52-30.08-28.8s11.84-28.8 28.8-28.8c16.32 0 26.88 10.88 26.88 27.52 0 1.92-.32 4.16-.64 5.76h-43.52c1.28 8.96 7.68 13.12 19.84 13.12zm-18.56-20.48h32c-.64-8.32-6.08-12.48-15.36-12.48-9.6 0-15.36 4.16-16.64 12.48z" fill="white"/>
  </svg>
);

// Official BlackMagic DaVinci Resolve logo - BlackMagic's exact brand colors
const DaVinciLogo = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 240 234" fill="currentColor">
    <path d="M10 10h220c5.52 0 10 4.48 10 10v194c0 5.52-4.48 10-10 10H10c-5.52 0-10-4.48-10-10V20c0-5.52 4.48-10 10-10z" fill="#FF3B3B"/>
    <circle cx="120" cy="117" r="70" fill="none" stroke="white" strokeWidth="8"/>
    <circle cx="120" cy="117" r="40" fill="none" stroke="white" strokeWidth="6"/>
    <rect x="100" y="97" width="40" height="40" fill="white" rx="4"/>
  </svg>
);

// Official Apple Final Cut Pro logo - Apple's exact brand colors
const FinalCutLogo = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 240 234" fill="currentColor">
    <path d="M10 10h220c5.52 0 10 4.48 10 10v194c0 5.52-4.48 10-10 10H10c-5.52 0-10-4.48-10-10V20c0-5.52 4.48-10 10-10z" fill="#007AFF"/>
    <path d="M40 117 L120 37 L200 117 L120 197 Z" fill="white" strokeWidth="4" stroke="#007AFF"/>
    <path d="M80 117 L120 77 L160 117 L120 157 Z" fill="#007AFF"/>
  </svg>
);

// Official Apple Logic Pro logo - Apple's exact brand colors
const LogicLogo = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 240 234" fill="currentColor">
    <path d="M10 10h220c5.52 0 10 4.48 10 10v194c0 5.52-4.48 10-10 10H10c-5.52 0-10-4.48-10-10V20c0-5.52 4.48-10 10-10z" fill="#34C759"/>
    <circle cx="120" cy="117" r="60" fill="none" stroke="white" strokeWidth="12"/>
    <circle cx="120" cy="117" r="20" fill="white"/>
    <rect x="100" y="40" width="40" height="20" fill="white" rx="10"/>
  </svg>
);

// Official Avid Pro Tools logo - Avid's exact brand colors
const ProToolsLogo = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 240 234" fill="currentColor">
    <path d="M10 10h220c5.52 0 10 4.48 10 10v194c0 5.52-4.48 10-10 10H10c-5.52 0-10-4.48-10-10V20c0-5.52 4.48-10 10-10z" fill="#FF6B35"/>
    <path d="M40 117 Q40 60 80 60 Q120 60 120 117 Q120 174 80 174 Q40 174 40 117" fill="white"/>
    <path d="M120 60 Q200 60 200 117 Q200 174 120 174" fill="none" stroke="white" strokeWidth="12"/>
  </svg>
);

// Cubase and Ableton logos removed - using MusicNote icon instead

// Official Avid Media Composer logo - Avid's exact brand colors
const MediaComposerLogo = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 240 234" fill="currentColor">
    <path d="M10 10h220c5.52 0 10 4.48 10 10v194c0 5.52-4.48 10-10 10H10c-5.52 0-10-4.48-10-10V20c0-5.52 4.48-10 10-10z" fill="#FF6B35"/>
    <path d="M60 66h120v11.2H82.4v34.56h80v11.2h-80v35.84h100.8V170H60V66z" fill="white"/>
    <path d="M50 190h140l-20-20H70l-20 20z" fill="white"/>
    <circle cx="190" cy="190" r="15" fill="white"/>
    <path d="M175 205h30v10h-30z" fill="white"/>
  </svg>
);

const softwareData: Software[] = [
  {
    id: 'lightroom',
    name: 'Adobe Lightroom',
    icon: LightroomLogo,
    color: '#31A8F0', // Adobe's official Lightroom blue
    shortcuts: [
      // Basic Navigation & View
      { id: 'lr_', action: 'Import Images', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Open import dialog', category: 'Import/Export', isFavorite: true },
      { id: 'lr_', action: 'Export Images', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Open export dialog', category: 'Import/Export', isFavorite: true },
      { id: 'lr_', action: 'Grid View', shortcutWin: ',', shortcutMac: '', description: 'Switch to grid view', category: 'View', isFavorite: true },
      { id: 'lr_', action: 'Loupe View', shortcutWin: ',', shortcutMac: '', description: 'Switch to loupe view', category: 'View', isFavorite: true },
      { id: 'lr_', action: 'Compare View', shortcutWin: ',', shortcutMac: '', description: 'Switch to compare view', category: 'View'},
      { id: 'lr_', action: 'Survey View', shortcutWin: ',', shortcutMac: '', description: 'Switch to survey view', category: 'View'},
      { id: 'lr_', action: 'Fullscreen', shortcutWin: ',', shortcutMac: '', description: 'Cycle through screen modes', category: 'View'},
      { id: 'lr_', action: 'Lights Out', shortcutWin: ',', shortcutMac: '', description: 'Dim or darken interface', category: 'View'},
      { id: 'lr_', action: 'Hide All Panels', shortcutWin: 'Shift+Tab', shortcutMac: 'Shift+Tab', description: 'Hide all panels', category: 'View', isFavorite: true },
      { id: 'lr_10', action: 'Show/Hide Toolbar', shortcutWin: ',', shortcutMac: '', description: 'Toggle toolbar visibility', category: 'View'},
      
      // Module Navigation
      { id: 'lr_11', action: 'Library Module', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Switch to Library module', category: 'Modules'},
      { id: 'lr_12', action: 'Develop Module', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Switch to Develop module', category: 'Modules', isFavorite: true },
      { id: 'lr_13', action: 'Map Module', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Switch to Map module', category: 'Modules'},
      { id: 'lr_14', action: 'Book Module', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Switch to Book module', category: 'Modules'},
      { id: 'lr_15', action: 'Slideshow Module', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Switch to Slideshow module', category: 'Modules'},
      { id: 'lr_16', action: 'Print Module', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Switch to Print module', category: 'Modules'},
      { id: 'lr_17', action: 'Web Module', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Switch to Web module', category: 'Modules'},
      
      // Organization & Rating
      { id: 'lr_18', action: 'Flag as Pick', shortcutWin: ',', shortcutMac: '', description: 'Mark image as pick', category: 'Organization', isFavorite: true },
      { id: 'lr_19', action: 'Flag as Reject', shortcutWin: ',', shortcutMac: '', description: 'Mark image as reject', category: 'Organization', isFavorite: true },
      { id: 'lr_20', action: 'Remove Flag', shortcutWin: ',', shortcutMac: '', description: 'Remove flag', category: 'Organization'},
      { id: 'lr_21', action: '1 Star', shortcutWin: ',', shortcutMac: '', description: 'Rate 1 star', category: 'Organization'},
      { id: 'lr_22', action: '2 Stars', shortcutWin: ',', shortcutMac: '', description: 'Rate 2 stars', category: 'Organization'},
      { id: 'lr_23', action: '3 Stars', shortcutWin: ',', shortcutMac: '', description: 'Rate 3 stars', category: 'Organization'},
      { id: 'lr_24', action: '4 Stars', shortcutWin: ',', shortcutMac: '', description: 'Rate 4 stars', category: 'Organization'},
      { id: 'lr_25', action: '5 Stars', shortcutWin: ',', shortcutMac: '', description: 'Rate 5 stars', category: 'Organization', isFavorite: true },
      { id: 'lr_26', action: 'Red Label', shortcutWin: ',', shortcutMac: '', description: 'Apply red color label', category: 'Organization'},
      { id: 'lr_27', action: 'Yellow Label', shortcutWin: ',', shortcutMac: '', description: 'Apply yellow color label', category: 'Organization'},
      { id: 'lr_28', action: 'Green Label', shortcutWin: ',', shortcutMac: '', description: 'Apply green color label', category: 'Organization'},
      { id: 'lr_29', action: 'Blue Label', shortcutWin: ',', shortcutMac: '', description: 'Apply blue color label', category: 'Organization'},
      
      // Editing & Development
      { id: 'lr_30', action: 'Auto Tone', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Auto adjust tone', category: 'Editing', isFavorite: true, isNew: true },
      { id: 'lr_31', action: 'Auto White Balance', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Auto white balance', category: 'Editing', isFavorite: true, isNew: true },
      { id: 'lr_32', action: 'Reset All Settings', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Reset all adjustments', category: 'Editing'},
      { id: 'lr_33', action: 'Copy Settings', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Copy development settings', category: 'Editing', isFavorite: true },
      { id: 'lr_34', action: 'Paste Settings', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Paste development settings', category: 'Editing', isFavorite: true },
      { id: 'lr_35', action: 'Crop Tool', shortcutWin: ',', shortcutMac: '', description: 'Activate crop tool', category: 'Editing', isFavorite: true },
      { id: 'lr_36', action: 'Spot Removal', shortcutWin: ',', shortcutMac: '', description: 'Activate spot removal tool', category: 'Editing', isFavorite: true },
      { id: 'lr_37', action: 'Red Eye Correction', shortcutWin: ',', shortcutMac: '', description: 'Activate red eye tool', category: 'Editing'},
      { id: 'lr_38', action: 'Convert to B&', shortcutWin: ',', shortcutMac: '', description: 'Convert to black and white', category: 'Editing', isFavorite: true },
      { id: 'lr_39', action: 'Masking', shortcutWin: 'Shift+', shortcutMac: 'Shift+', description: 'Open masking panel', category: 'Editing', isNew: true },
      { id: 'lr_46', action: 'Lens Blur', shortcutWin: 'Shift+', shortcutMac: 'Shift+', description: 'Apply lens blur', category: 'Editing', isNew: true },
      { id: 'lr_47', action: 'Generative Remove', shortcutWin: 'Shift+', shortcutMac: 'Shift+', description: 'Generative remove tool', category: 'Editing', isNew: true },
      { id: 'lr_48', action: 'Adaptive Presets', shortcutWin: 'Shift+', shortcutMac: 'Shift+', description: 'Apply adaptive presets', category: 'Editing', isNew: true },
      
      // Navigation
      { id: 'lr_40', action: 'Next Photo', shortcutWin: 'Right Arrow', shortcutMac: 'Right Arrow', description: 'Navigate to next photo', category: 'Navigation', isFavorite: true },
      { id: 'lr_41', action: 'Previous Photo', shortcutWin: 'Left Arrow', shortcutMac: 'Left Arrow', description: 'Navigate to previous photo', category: 'Navigation', isFavorite: true },
      { id: 'lr_42', action: 'Zoom I', shortcutWin: 'Ctrl++', shortcutMac: 'Cmd++', description: 'Zoom in on photo', category: 'Navigation'},
      { id: 'lr_43', action: 'Zoom Out', shortcutWin: 'Ctrl+, -', shortcutMac: 'Cmd+, -', description: 'Zoom out of photo', category: 'Navigation'},
      { id: 'lr_44', action: 'Fit to Window', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Fit photo to window', category: 'Navigation'},
      { id: 'lr_45', action: 'Actual Size', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'View at 100% size', category: 'Navigation'},
      { id: 'lr_76', action: 'First Photo', shortcutWin: 'Home', shortcutMac: 'Home', description: 'Go to first photo', category: 'Navigation'},
      { id: 'lr_77', action: 'Last Photo', shortcutWin: 'End', shortcutMac: 'End', description: 'Go to last photo', category: 'Navigation'},
      { id: 'lr_78', action: 'Page U', shortcutWin: 'Page U', shortcutMac: 'Page U', description: 'Previous page of photos', category: 'Navigation'},
      { id: 'lr_79', action: 'Page Down', shortcutWin: 'Page Down', shortcutMac: 'Page Down', description: 'Next page of photos', category: 'Navigation'},
      { id: 'lr_80', action: 'Hand Tool', shortcutWin: ',', shortcutMac: '', description: 'Activate hand tool for panning', category: 'Navigation'},
      { id: 'lr_81', action: 'Zoom Tool', shortcutWin: ',', shortcutMac: '', description: 'Activate zoom tool', category: 'Navigation'},
      
      // Rating & Flagging
      { id: 'lr_49', action: 'Set 1 Star', shortcutWin: ',', shortcutMac: '', description: 'Rate photo 1 star', category: 'Rating', isFavorite: true },
      { id: 'lr_50', action: 'Set 2 Stars', shortcutWin: ',', shortcutMac: '', description: 'Rate photo 2 stars', category: 'Rating', isFavorite: true },
      { id: 'lr_51', action: 'Set 3 Stars', shortcutWin: ',', shortcutMac: '', description: 'Rate photo 3 stars', category: 'Rating', isFavorite: true },
      { id: 'lr_52', action: 'Set 4 Stars', shortcutWin: ',', shortcutMac: '', description: 'Rate photo 4 stars', category: 'Rating', isFavorite: true },
      { id: 'lr_53', action: 'Set 5 Stars', shortcutWin: ',', shortcutMac: '', description: 'Rate photo 5 stars', category: 'Rating', isFavorite: true },
      { id: 'lr_54', action: 'Remove Rating', shortcutWin: ',', shortcutMac: '', description: 'Remove star rating', category: 'Rating'},
      { id: 'lr_55', action: 'Flag as Pick', shortcutWin: ',', shortcutMac: '', description: 'Flag photo as pick', category: 'Rating', isFavorite: true },
      { id: 'lr_56', action: 'Flag as Reject', shortcutWin: ',', shortcutMac: '', description: 'Flag photo as reject', category: 'Rating', isFavorite: true },
      { id: 'lr_57', action: 'Remove Flag', shortcutWin: ',', shortcutMac: '', description: 'Remove flag from photo', category: 'Rating'},
      
      // Collections & Keywords
      { id: 'lr_58', action: 'Add to Collection', shortcutWin: ',', shortcutMac: '', description: 'Add to quick collection', category: 'Organization', isFavorite: true },
      { id: 'lr_59', action: 'Add Keyword', shortcutWin: 'Shift+', shortcutMac: 'Shift+', description: 'Add keyword to photo', category: 'Organization'},
      { id: 'lr_60', action: 'Keyword Shortcuts', shortcutWin: 'Alt+1-', shortcutMac: 'Opt+1-', description: 'Apply keyword shortcuts', category: 'Organization'},
      
      // Quick Develop
      { id: 'lr_61', action: 'Auto Settings', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Apply auto tone settings', category: 'Quick Develop' },
      { id: 'lr_62', action: 'Increase Exposure', shortcutWin: 'Ctrl+Shift+Plus', shortcutMac: 'Cmd+Shift+Plus', description: 'Increase exposure in steps', category: 'Quick Develop' },
      { id: 'lr_63', action: 'Decrease Exposure', shortcutWin: 'Ctrl+Shift+Minus', shortcutMac: 'Cmd+Shift+Minus', description: 'Decrease exposure in steps', category: 'Quick Develop' },
      
      // Module Navigation
      { id: 'lr_64', action: 'Library Module', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Switch to Library module', category: 'Modules', isFavorite: true },
      { id: 'lr_65', action: 'Develop Module', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Switch to Develop module', category: 'Modules', isFavorite: true },
      { id: 'lr_66', action: 'Map Module', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Switch to Map module', category: 'Modules'},
      { id: 'lr_67', action: 'Book Module', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Switch to Book module', category: 'Modules'},
      { id: 'lr_68', action: 'Slideshow Module', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Switch to Slideshow module', category: 'Modules'},
      { id: 'lr_69', action: 'Print Module', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Switch to Print module', category: 'Modules'},
      { id: 'lr_70', action: 'Web Module', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Switch to Web module', category: 'Modules'},
      
      // View Options
      { id: 'lr_71', action: 'Grid View', shortcutWin: ',', shortcutMac: '', description: 'Switch to Grid view', category: 'View', isFavorite: true },
      { id: 'lr_72', action: 'Loupe View', shortcutWin: ',', shortcutMac: '', description: 'Switch to Loupe view', category: 'View', isFavorite: true },
      { id: 'lr_73', action: 'Compare View', shortcutWin: ',', shortcutMac: '', description: 'Switch to Compare view', category: 'View'},
      { id: 'lr_74', action: 'Survey View', shortcutWin: ',', shortcutMac: '', description: 'Switch to Survey view', category: 'View'},
      { id: 'lr_75', action: 'Fullscreen', shortcutWin: ',', shortcutMac: '', description: 'Toggle fullscreen mode', category: 'View'},
      
      // Additional Basic Panel Shortcuts
      { id: 'lr_82', action: 'Basic Panel', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Show Basic panel', category: 'Panels'},
      { id: 'lr_83', action: 'Tone Curve Panel', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Show Tone Curve panel', category: 'Panels'},
      { id: 'lr_84', action: 'HSL/Color Panel', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Show HSL/Color panel', category: 'Panels'},
      { id: 'lr_85', action: 'Split Toning Panel', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Show Split Toning panel', category: 'Panels'},
      { id: 'lr_86', action: 'Detail Panel', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Show Detail panel', category: 'Panels'},
      { id: 'lr_87', action: 'Lens Corrections Panel', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Show Lens Corrections panel', category: 'Panels'},
      { id: 'lr_88', action: 'Effects Panel', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Show Effects panel', category: 'Panels'},
      { id: 'lr_89', action: 'Camera Calibration Panel', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Show Camera Calibration panel', category: 'Panels'},
      { id: 'lr_90', action: 'Presets Panel', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Show Presets panel', category: 'Panels'},
      
      // Tools
      { id: 'lr_91', action: 'Crop Tool', shortcutWin: ',', shortcutMac: '', description: 'Activate crop tool', category: 'Tools', isFavorite: true },
      { id: 'lr_92', action: 'Spot Removal Tool', shortcutWin: ',', shortcutMac: '', description: 'Activate spot removal tool', category: 'Tools', isFavorite: true },
      { id: 'lr_93', action: 'Red Eye Correction', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Red eye correction tool', category: 'Tools'},
      { id: 'lr_94', action: 'Graduated Filter', shortcutWin: ',', shortcutMac: '', description: 'Graduated filter tool', category: 'Tools', isFavorite: true },
      { id: 'lr_95', action: 'Radial Filter', shortcutWin: 'Shift+', shortcutMac: 'Shift+', description: 'Radial filter tool', category: 'Tools', isFavorite: true },
      { id: 'lr_96', action: 'Adjustment Brush', shortcutWin: ',', shortcutMac: '', description: 'Adjustment brush tool', category: 'Tools', isFavorite: true },
      { id: 'lr_97', action: 'Masking', shortcutWin: 'Shift+', shortcutMac: 'Shift+', description: 'Masking tool', category: 'Tools'},
      
      // Develop Shortcuts
      { id: 'lr_98', action: 'Auto Tone', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Apply auto tone', category: 'Develop', isFavorite: true },
      { id: 'lr_99', action: 'Auto White Balance', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Apply auto white balance', category: 'Develop'},
      { id: 'lr_100', action: 'Reset', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Reset all settings', category: 'Develop'},
      { id: 'lr_101', action: 'Copy Settings', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Copy develop settings', category: 'Develop', isFavorite: true },
      { id: 'lr_102', action: 'Paste Settings', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Paste develop settings', category: 'Develop', isFavorite: true },
      { id: 'lr_103', action: 'Paste Previous', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Paste settings from previous', category: 'Develop'},
      { id: 'lr_104', action: 'Sync Settings', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Sync settings', category: 'Develop'},
      
      // Export & Print
      { id: 'lr_105', action: 'Export', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Export photos', category: 'Export', isFavorite: true },
      { id: 'lr_106', action: 'Export with Previous', shortcutWin: 'Ctrl+Alt+Shift+', shortcutMac: 'Cmd+Opt+Shift+', description: 'Export with previous settings', category: 'Export'},
      { id: 'lr_107', action: 'Print', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Print photo', category: 'Print'},
      { id: 'lr_108', action: 'Page Setup', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Page setup for printing', category: 'Print'},
      
      // Library Shortcuts
      { id: 'lr_109', action: 'Import Photos', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Import photos and video', category: 'Library', isFavorite: true },
      { id: 'lr_110', action: 'Tethered Capture', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Start tethered capture', category: 'Library'},
      { id: 'lr_111', action: 'Show in Finder/Explorer', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Show in Finder/Explorer', category: 'Library'},
      { id: 'lr_112', action: 'Go to Folder', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Go to folder in Library', category: 'Library'},
      { id: 'lr_113', action: 'New Collection', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Create new collection', category: 'Collections'},
      { id: 'lr_114', action: 'New Smart Collection', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Create new smart collection', category: 'Collections'},
      
      // Color Labels
      { id: 'lr_115', action: 'Red Label', shortcutWin: ',', shortcutMac: '', description: 'Apply red color label', category: 'Labels'},
      { id: 'lr_116', action: 'Yellow Label', shortcutWin: ',', shortcutMac: '', description: 'Apply yellow color label', category: 'Labels'},
      { id: 'lr_117', action: 'Green Label', shortcutWin: ',', shortcutMac: '', description: 'Apply green color label', category: 'Labels'},
      { id: 'lr_118', action: 'Blue Label', shortcutWin: ',', shortcutMac: '', description: 'Apply blue color label', category: 'Labels'},
      
      // Advanced Navigation
      { id: 'lr_119', action: 'Toggle Info Overlay', shortcutWin: ',', shortcutMac: '', description: 'Toggle info overlay', category: 'View'},
      { id: 'lr_120', action: 'Cycle Info Overlay', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Cycle info overlay styles', category: 'View'},
      { id: 'lr_121', action: 'Show Clipping', shortcutWin: ',', shortcutMac: '', description: 'Show clipping indicators', category: 'View'},
      { id: 'lr_122', action: 'Toggle Filmstrip', shortcutWin: 'F', shortcutMac: 'F', description: 'Toggle filmstrip', category: 'View'},
      { id: 'lr_123', action: 'Toggle Left Panels', shortcutWin: 'Tab', shortcutMac: 'Tab', description: 'Toggle left panels', category: 'Panels'},
      { id: 'lr_124', action: 'Toggle Right Panels', shortcutWin: 'Shift+Tab', shortcutMac: 'Shift+Tab', description: 'Toggle right panels', category: 'Panels'},
      { id: 'lr_125', action: 'Toggle All Panels', shortcutWin: 'Shift+', shortcutMac: 'Shift+', description: 'Toggle all panels', category: 'Panels'},
      
      // Target Adjustments
      { id: 'lr_126', action: 'TAT Tone Curve', shortcutWin: 'Ctrl+Alt+Shift+', shortcutMac: 'Cmd+Opt+Shift+', description: 'Target adjustment tone curve', category: 'Target Adjustments' },
      { id: 'lr_127', action: 'TAT HSL Hue', shortcutWin: 'Ctrl+Alt+Shift+', shortcutMac: 'Cmd+Opt+Shift+', description: 'Target adjustment HSL hue', category: 'Target Adjustments' },
      { id: 'lr_128', action: 'TAT HSL Saturation', shortcutWin: 'Ctrl+Alt+Shift+', shortcutMac: 'Cmd+Opt+Shift+', description: 'Target adjustment HSL saturation', category: 'Target Adjustments' },
      { id: 'lr_129', action: 'TAT HSL Luminance', shortcutWin: 'Ctrl+Alt+Shift+', shortcutMac: 'Cmd+Opt+Shift+', description: 'Target adjustment HSL luminance', category: 'Target Adjustments' },
      { id: 'lr_130', action: 'TAT B&W Mix', shortcutWin: 'Ctrl+Alt+Shift+', shortcutMac: 'Cmd+Opt+Shift+', description: 'Target adjustment B&W mix', category: 'Target Adjustments' },
      
      // Slideshow
      { id: 'lr_131', action: 'Play Slideshow', shortcutWin: 'Ctrl+Enter', shortcutMac: 'Cmd+Return', description: 'Play slideshow', category: 'Slideshow'},
      { id: 'lr_132', action: 'Pause Slideshow', shortcutWin: 'Space', shortcutMac: 'Space', description: 'Pause slideshow', category: 'Slideshow'},
      { id: 'lr_133', action: 'End Slideshow', shortcutWin: 'Escape', shortcutMac: 'Escape', description: 'End slideshow', category: 'Slideshow'},
      
      // Histogram
      { id: 'lr_134', action: 'Show Histogram', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Show histogram', category: 'Histogram'},
      { id: 'lr_135', action: 'Show RGB Values', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Show RGB values in histogram', category: 'Histogram'},
      
      // Before/After Views
      { id: 'lr_136', action: 'Before View', shortcutWin: '\\', shortcutMac: '\\', description: 'Show before view', category: 'Before/After' },
      { id: 'lr_137', action: 'Before/After Left/Right', shortcutWin: ',', shortcutMac: '', description: 'Before/after left/right', category: 'Before/After' },
      { id: 'lr_138', action: 'Before/After Top/Bottom', shortcutWin: 'Alt+', shortcutMac: 'Opt+', description: 'Before/after top/bottom', category: 'Before/After' },
      { id: 'lr_139', action: 'Before/After Split', shortcutWin: 'Shift+', shortcutMac: 'Shift+', description: 'Before/after split view', category: 'Before/After' },
      
      // Synchronization
      { id: 'lr_140', action: 'Auto Sync', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Toggle auto sync', category: 'Sync'},
      { id: 'lr_141', action: 'Match Total Exposures', shortcutWin: 'Ctrl+Alt+Shift+', shortcutMac: 'Cmd+Opt+Shift+', description: 'Match total exposures', category: 'Sync'},
      
      // Video
      { id: 'lr_142', action: 'Play/Pause Video', shortcutWin: 'Space', shortcutMac: 'Space', description: 'Play/pause video', category: 'Video'},
      { id: 'lr_143', action: 'Trim Video Start', shortcutWin: 'Shift+', shortcutMac: 'Shift+', description: 'Set video start trim', category: 'Video'},
      { id: 'lr_144', action: 'Trim Video End', shortcutWin: 'Shift+', shortcutMac: 'Shift+', description: 'Set video end trim', category: 'Video'},
      
      // Preferences & Settings
      { id: 'lr_145', action: 'Preferences', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Open preferences', category: 'Settings'},
      { id: 'lr_146', action: 'Catalog Settings', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Open catalog settings', category: 'Settings'},
      
      // Web Module
      { id: 'lr_147', action: 'Reload Web Gallery', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Reload web gallery', category: 'Web'},
      { id: 'lr_148', action: 'Preview in Browser', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Preview in browser', category: 'Web'},
      
      // Misc Advanced
      { id: 'lr_149', action: 'Edit in Photoshop', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Edit in Photoshop', category: 'External Editing' },
      { id: 'lr_150', action: 'Open as Smart Object', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Open as Smart Object in Photoshop', category: 'External Editing' }
    ]
},
  {
    id: 'photoshop',
    name: 'Adobe Photoshop',
    icon: PhotoshopLogo,
    color: '#001E30', // Adobe's official Photoshop dark blue
    shortcuts: [
      // File Operations
      { id: 'ps_', action: 'New Document', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Create new document', category: 'File', isFavorite: true },
      { id: 'ps_', action: 'Open File', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Open existing file', category: 'File', isFavorite: true },
      { id: 'ps_', action: 'Save', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Save current document', category: 'File', isFavorite: true },
      { id: 'ps_', action: 'Save A', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Save with new name', category: 'File'},
      { id: 'ps_', action: 'Export A', shortcutWin: 'Ctrl+Alt+Shift+', shortcutMac: 'Cmd+Opt+Shift+', description: 'Export image for web', category: 'File', isFavorite: true },
      { id: 'ps_', action: 'Close', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Close current document', category: 'File'},

      // Tools
      { id: 'ps_', action: 'Move Tool', shortcutWin: ',', shortcutMac: '', description: 'Select move tool', category: 'Tools', isFavorite: true },
      { id: 'ps_', action: 'Rectangular Marquee', shortcutWin: ',', shortcutMac: '', description: 'Rectangular selection tool', category: 'Tools', isFavorite: true },
      { id: 'ps_', action: 'Lasso Tool', shortcutWin: ',', shortcutMac: '', description: 'Freehand selection tool', category: 'Tools'},
      { id: 'ps_10', action: 'Quick Selection', shortcutWin: ',', shortcutMac: '', description: 'Quick selection tool', category: 'Tools', isFavorite: true },
      { id: 'ps_11', action: 'Crop Tool', shortcutWin: ',', shortcutMac: '', description: 'Crop and straighten tool', category: 'Tools', isFavorite: true },
      { id: 'ps_12', action: 'Spot Healing Brush', shortcutWin: ',', shortcutMac: '', description: 'Healing brush tool', category: 'Tools', isFavorite: true },
      { id: 'ps_13', action: 'Brush Tool', shortcutWin: ',', shortcutMac: '', description: 'Paint brush tool', category: 'Tools', isFavorite: true },
      { id: 'ps_14', action: 'Clone Stamp', shortcutWin: ',', shortcutMac: '', description: 'Clone stamp tool', category: 'Tools', isFavorite: true },
      { id: 'ps_15', action: 'Eraser Tool', shortcutWin: ',', shortcutMac: '', description: 'Eraser tool', category: 'Tools'},
      { id: 'ps_16', action: 'Gradient Tool', shortcutWin: ',', shortcutMac: '', description: 'Gradient and paint bucket', category: 'Tools'},
      { id: 'ps_17', action: 'Dodge Tool', shortcutWin: ',', shortcutMac: '', description: 'Dodge, burn, sponge tools', category: 'Tools'},
      { id: 'ps_18', action: 'Pen Tool', shortcutWin: ',', shortcutMac: '', description: 'Path creation tool', category: 'Tools'},
      { id: 'ps_19', action: 'Type Tool', shortcutWin: ',', shortcutMac: '', description: 'Text tool', category: 'Tools'},
      { id: 'ps_20', action: 'Hand Tool', shortcutWin: ',', shortcutMac: '', description: 'Pan around image', category: 'Tools'},
      { id: 'ps_21', action: 'Zoom Tool', shortcutWin: ',', shortcutMac: '', description: 'Zoom in/out tool', category: 'Tools'},

      // Layers
      { id: 'ps_22', action: 'New Layer', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Create new layer', category: 'Layers', isFavorite: true },
      { id: 'ps_23', action: 'Duplicate Layer', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Duplicate current layer', category: 'Layers', isFavorite: true },
      { id: 'ps_24', action: 'Delete Layer', shortcutWin: 'Delete', shortcutMac: 'Delete', description: 'Delete selected layer', category: 'Layers'},
      { id: 'ps_25', action: 'Merge Down', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Merge with layer below', category: 'Layers'},
      { id: 'ps_26', action: 'Flatten Image', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Flatten all layers', category: 'Layers'},
      { id: 'ps_27', action: 'Group Layers', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Group selected layers', category: 'Layers'},
      { id: 'ps_28', action: 'Ungroup Layers', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Ungroup layer group', category: 'Layers'},

      // Editing
      { id: 'ps_29', action: 'Undo', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Undo last action', category: 'Editing', isFavorite: true },
      { id: 'ps_30', action: 'Step Backward', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Step backward in history', category: 'Editing', isFavorite: true },
      { id: 'ps_31', action: 'Step Forward', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Step forward in history', category: 'Editing'},
      { id: 'ps_32', action: 'Copy', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Copy selection', category: 'Editing', isFavorite: true },
      { id: 'ps_33', action: 'Paste', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Paste clipboard', category: 'Editing', isFavorite: true },
      { id: 'ps_34', action: 'Free Transform', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Transform selection or layer', category: 'Editing', isFavorite: true },
      { id: 'ps_35', action: 'Content-Aware Fill', shortcutWin: 'Shift+F', shortcutMac: 'Shift+F', description: 'Content-aware fill workspace', category: 'Editing', isFavorite: true, isNew: true },
      { id: 'ps_52', action: 'Generative Fill', shortcutWin: 'Shift+', shortcutMac: 'Shift+', description: ',', category: 'Editing', isFavorite: true, isNew: true },
      { id: 'ps_53', action: 'Generative Expand', shortcutWin: 'Shift+', shortcutMac: 'Shift+', description: ',', category: 'Editing', isNew: true },
      { id: 'ps_54', action: 'Enhanced Remove Tool', shortcutWin: 'Shift+', shortcutMac: 'Shift+', description: ',', category: 'Editing', isNew: true },

      // Adjustments
      { id: 'ps_36', action: 'Levels', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Open levels adjustment', category: 'Adjustments', isFavorite: true },
      { id: 'ps_37', action: 'Curves', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Open curves adjustment', category: 'Adjustments', isFavorite: true },
      { id: 'ps_38', action: 'Hue/Saturation', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Hue/Saturation adjustment', category: 'Adjustments'},
      { id: 'ps_39', action: 'Color Balance', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Color balance adjustment', category: 'Adjustments'},
      { id: 'ps_40', action: 'Desaturate', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Remove color saturation', category: 'Adjustments'},
      { id: 'ps_41', action: 'Invert', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Invert colors', category: 'Adjustments'},

      // Selection
      { id: 'ps_42', action: 'Select All', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Select entire image', category: 'Selection', isFavorite: true },
      { id: 'ps_43', action: 'Deselect', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Remove selection', category: 'Selection', isFavorite: true },
      { id: 'ps_44', action: 'Reselect', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Restore last selection', category: 'Selection'},
      { id: 'ps_45', action: 'Inverse Selection', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Invert selection', category: 'Selection', isFavorite: true },
      { id: 'ps_46', action: 'Feather Selection', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Feather selection edges', category: 'Selection'},

      // View
      { id: 'ps_47', action: 'Zoom I', shortcutWin: 'Ctrl++', shortcutMac: 'Cmd++', description: 'Zoom into image', category: 'View'},
      { id: 'ps_48', action: 'Zoom Out', shortcutWin: 'Ctrl+, -', shortcutMac: 'Cmd+, -', description: 'Zoom out of image', category: 'View'},
      { id: 'ps_49', action: 'Fit on Screen', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Fit image to window', category: 'View', isFavorite: true },
      { id: 'ps_50', action: 'Actual Pixels', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'View at 100% size', category: 'View'},
      { id: 'ps_51', action: 'Screen Mode', shortcutWin: ',', shortcutMac: '', description: 'Cycle through screen modes', category: 'View'},
      
      // Panels & Windows
      { id: 'ps_55', action: 'Layers Panel', shortcutWin: 'F', shortcutMac: 'F', description: 'Toggle Layers panel', category: 'Panels', isFavorite: true },
      { id: 'ps_56', action: 'Actions Panel', shortcutWin: 'Alt+F', shortcutMac: 'Opt+F', description: 'Toggle Actions panel', category: 'Panels'},
      { id: 'ps_57', action: 'Brushes Panel', shortcutWin: 'F', shortcutMac: 'F', description: 'Toggle Brushes panel', category: 'Panels'},
      { id: 'ps_58', action: 'Color Panel', shortcutWin: 'F', shortcutMac: 'F', description: 'Toggle Color panel', category: 'Panels'},
      { id: 'ps_59', action: 'History Panel', shortcutWin: 'Alt+F1', shortcutMac: 'Opt+F1', description: 'Toggle History panel', category: 'Panels'},
      { id: 'ps_60', action: 'Info Panel', shortcutWin: 'F', shortcutMac: 'F', description: 'Toggle Info panel', category: 'Panels'},
      { id: 'ps_61', action: 'Navigator Panel', shortcutWin: 'F1', shortcutMac: 'F1', description: 'Toggle Navigator panel', category: 'Panels'},
      { id: 'ps_62', action: 'Swatches Panel', shortcutWin: 'F1', shortcutMac: 'F1', description: 'Toggle Swatches panel', category: 'Panels'},
      
      // Filters
      { id: 'ps_63', action: 'Last Filter', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Repeat last filter', category: 'Filters', isFavorite: true },
      { id: 'ps_64', action: 'Fade Filter', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Fade last filter', category: 'Filters'},
      { id: 'ps_65', action: 'Gaussian Blur', shortcutWin: 'Ctrl+Alt+Shift+', shortcutMac: 'Cmd+Opt+Shift+', description: 'Quick Gaussian blur', category: 'Filters'},
      { id: 'ps_66', action: 'Unsharp Mask', shortcutWin: 'Ctrl+Alt+Shift+', shortcutMac: 'Cmd+Opt+Shift+', description: 'Unsharp mask filter', category: 'Filters'},
      
      // Advanced Tools
      { id: 'ps_67', action: 'Puppet Warp', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Puppet warp tool', category: 'Transform'},
      { id: 'ps_68', action: 'Liquify', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Liquify filter', category: 'Transform', isFavorite: true },
      { id: 'ps_69', action: 'Camera Raw Filter', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Camera Raw filter', category: 'Filters', isFavorite: true },
      { id: 'ps_70', action: 'Perspective Warp', shortcutWin: 'Ctrl+Alt+Shift+', shortcutMac: 'Cmd+Opt+Shift+', description: 'Perspective warp', category: 'Transform'},
      
      // Blend Modes
      { id: 'ps_71', action: 'Cycle Blend Modes', shortcutWin: 'Shift+Plus', shortcutMac: 'Shift+Plus', description: 'Cycle through blend modes', category: 'Blending'},
      { id: 'ps_72', action: 'Normal Blend', shortcutWin: 'Shift+Alt+', shortcutMac: 'Shift+Opt+', description: 'Normal blend mode', category: 'Blending'},
      { id: 'ps_73', action: 'Multiply Blend', shortcutWin: 'Shift+Alt+', shortcutMac: 'Shift+Opt+', description: 'Multiply blend mode', category: 'Blending'},
      { id: 'ps_74', action: 'Screen Blend', shortcutWin: 'Shift+Alt+', shortcutMac: 'Shift+Opt+', description: 'Screen blend mode', category: 'Blending'},
      { id: 'ps_75', action: 'Overlay Blend', shortcutWin: 'Shift+Alt+', shortcutMac: 'Shift+Opt+', description: 'Overlay blend mode', category: 'Blending'},
      
      // Masks & Channels
      { id: 'ps_76', action: 'Add Layer Mask', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Add layer mask', category: 'Masks', isFavorite: true },
      { id: 'ps_77', action: 'Delete Layer Mask', shortcutWin: 'Ctrl+Shift+Delete', shortcutMac: 'Cmd+Shift+Delete', description: 'Delete layer mask', category: 'Masks'},
      { id: 'ps_78', action: 'Apply Layer Mask', shortcutWin: 'Ctrl+Shift+Alt+Delete', shortcutMac: 'Cmd+Shift+Opt+Delete', description: 'Apply layer mask', category: 'Masks'},
      { id: 'ps_79', action: 'Load Selection', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Load channel as selection', category: 'Channels'},
      
      // Typography
      { id: 'ps_80', action: 'Character Panel', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Character formatting', category: 'Typography'},
      { id: 'ps_81', action: 'Paragraph Panel', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Paragraph formatting', category: 'Typography'},
      { id: 'ps_82', action: 'Increase Font Size', shortcutWin: 'Ctrl+Shift+>', shortcutMac: 'Cmd+Shift+>', description: 'Increase font size', category: 'Typography'},
      { id: 'ps_83', action: 'Decrease Font Size', shortcutWin: 'Ctrl+Shift+, <', shortcutMac: 'Cmd+Shift+, <', description: 'Decrease font size', category: 'Typography'},
      
      // Smart Objects & Artboards
      { id: 'ps_84', action: 'Convert to Smart Object', shortcutWin: 'Ctrl+Alt+Shift+', shortcutMac: 'Cmd+Opt+Shift+', description: 'Convert to smart object', category: 'Smart Objects' },
      { id: 'ps_85', action: 'Edit Smart Object', shortcutWin: 'Ctrl+Alt+Shift+', shortcutMac: 'Cmd+Opt+Shift+', description: 'Edit smart object contents', category: 'Smart Objects' },
      { id: 'ps_86', action: 'New Artboard', shortcutWin: 'Ctrl+Shift+Alt+', shortcutMac: 'Cmd+Shift+Opt+', description: 'Create new artboard', category: 'Artboards'},
      
      // Complete Tool Set
      { id: 'ps_87', action: 'Move Tool', shortcutWin: ',', shortcutMac: '', description: 'Move tool', category: 'Tools', isFavorite: true },
      { id: 'ps_88', action: 'Marquee Tools', shortcutWin: ',', shortcutMac: '', description: 'Rectangular/Elliptical marquee', category: 'Tools', isFavorite: true },
      { id: 'ps_89', action: 'Lasso Tools', shortcutWin: ',', shortcutMac: '', description: 'Lasso selection tools', category: 'Tools', isFavorite: true },
      { id: 'ps_90', action: 'Quick Selection', shortcutWin: ',', shortcutMac: '', description: 'Quick selection/Magic wand', category: 'Tools', isFavorite: true },
      { id: 'ps_91', action: 'Crop Tool', shortcutWin: ',', shortcutMac: '', description: 'Crop tool', category: 'Tools', isFavorite: true },
      { id: 'ps_92', action: 'Eyedropper Tool', shortcutWin: ',', shortcutMac: '', description: 'Eyedropper tool', category: 'Tools', isFavorite: true },
      { id: 'ps_93', action: 'Healing Tools', shortcutWin: ',', shortcutMac: '', description: 'Healing brush tools', category: 'Tools', isFavorite: true },
      { id: 'ps_94', action: 'Brush Tool', shortcutWin: ',', shortcutMac: '', description: 'Brush/Pencil tools', category: 'Tools', isFavorite: true },
      { id: 'ps_95', action: 'Clone Stamp', shortcutWin: ',', shortcutMac: '', description: 'Clone stamp tool', category: 'Tools', isFavorite: true },
      { id: 'ps_96', action: 'History Brush', shortcutWin: ',', shortcutMac: '', description: 'History brush tool', category: 'Tools'},
      { id: 'ps_97', action: 'Eraser Tool', shortcutWin: ',', shortcutMac: '', description: 'Eraser tools', category: 'Tools', isFavorite: true },
      { id: 'ps_98', action: 'Gradient Tool', shortcutWin: ',', shortcutMac: '', description: 'Gradient/Paint bucket', category: 'Tools', isFavorite: true },
      { id: 'ps_99', action: 'Dodge/Burn', shortcutWin: ',', shortcutMac: '', description: 'Dodge/Burn/Sponge tools', category: 'Tools'},
      { id: 'ps_100', action: 'Pen Tool', shortcutWin: ',', shortcutMac: '', description: 'Pen tools', category: 'Tools', isFavorite: true },
      { id: 'ps_101', action: 'Type Tool', shortcutWin: ',', shortcutMac: '', description: 'Type tools', category: 'Tools', isFavorite: true },
      { id: 'ps_102', action: 'Path Selection', shortcutWin: ',', shortcutMac: '', description: 'Path selection tools', category: 'Tools'},
      { id: 'ps_103', action: 'Shape Tools', shortcutWin: ',', shortcutMac: '', description: 'Shape tools', category: 'Tools'},
      { id: 'ps_104', action: 'Hand Tool', shortcutWin: ',', shortcutMac: '', description: 'Hand tool', category: 'Tools'},
      { id: 'ps_105', action: 'Zoom Tool', shortcutWin: ',', shortcutMac: '', description: 'Zoom tool', category: 'Tools'},
      
      // Color & Swatches
      { id: 'ps_106', action: 'Default Colors', shortcutWin: ',', shortcutMac: '', description: 'Reset to default colors', category: 'Color', isFavorite: true },
      { id: 'ps_107', action: 'Switch Colors', shortcutWin: ',', shortcutMac: '', description: 'Switch foreground/background', category: 'Color', isFavorite: true },
      { id: 'ps_108', action: 'Color Picker', shortcutWin: 'Alt+Click', shortcutMac: 'Opt+Click', description: 'Pick color while painting', category: 'Color'},
      { id: 'ps_109', action: 'Fill Foreground', shortcutWin: 'Alt+Backspace', shortcutMac: 'Opt+Delete', description: 'Fill with foreground color', category: 'Color', isFavorite: true },
      { id: 'ps_110', action: 'Fill Background', shortcutWin: 'Ctrl+Backspace', shortcutMac: 'Cmd+Delete', description: 'Fill with background color', category: 'Color', isFavorite: true },
      { id: 'ps_111', action: 'Fill from History', shortcutWin: 'Ctrl+Alt+Backspace', shortcutMac: 'Cmd+Opt+Delete', description: 'Fill from history', category: 'Color'},
      
      // Brush Controls
      { id: 'ps_112', action: 'Increase Brush Size', shortcutWin: ']', shortcutMac: ']', description: 'Increase brush size', category: 'Brush', isFavorite: true },
      { id: 'ps_113', action: 'Decrease Brush Size', shortcutWin: '[', shortcutMac: '[', description: 'Decrease brush size', category: 'Brush', isFavorite: true },
      { id: 'ps_114', action: 'Increase Brush Hardness', shortcutWin: 'Shift+]', shortcutMac: 'Shift+]', description: 'Increase brush hardness', category: 'Brush'},
      { id: 'ps_115', action: 'Decrease Brush Hardness', shortcutWin: 'Shift+[', shortcutMac: 'Shift+[', description: 'Decrease brush hardness', category: 'Brush'},
      { id: 'ps_116', action: 'Previous Brush', shortcutWin: ',', shortcutMac: '', description: 'Previous brush preset', category: 'Brush'},
      { id: 'ps_117', action: 'Next Brush', shortcutWin: '.', shortcutMac: '.', description: 'Next brush preset', category: 'Brush'},
      { id: 'ps_118', action: 'First Brush', shortcutWin: 'Shift+', shortcutMac: 'Shift+', description: 'First brush preset', category: 'Brush'},
      { id: 'ps_119', action: 'Last Brush', shortcutWin: 'Shift+.', shortcutMac: 'Shift+.', description: 'Last brush preset', category: 'Brush'},
      
      // Layer Operations Advanced
      { id: 'ps_120', action: 'Group Layers', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Group selected layers', category: 'Layers', isFavorite: true },
      { id: 'ps_121', action: 'Ungroup Layers', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Ungroup layers', category: 'Layers'},
      { id: 'ps_122', action: 'Merge Down', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Merge layer down', category: 'Layers', isFavorite: true },
      { id: 'ps_123', action: 'Merge Visible', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Merge visible layers', category: 'Layers'},
      { id: 'ps_124', action: 'Flatten Image', shortcutWin: 'Ctrl+Shift+Alt+', shortcutMac: 'Cmd+Shift+Opt+', description: 'Flatten image', category: 'Layers'},
      { id: 'ps_125', action: 'Link Layers', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Link selected layers', category: 'Layers'},
      { id: 'ps_126', action: 'Select All Layers', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Select all layers', category: 'Layers'},
      { id: 'ps_127', action: 'Select Similar Layers', shortcutWin: 'Alt+Right Click', shortcutMac: 'Opt+Right Click', description: 'Select similar layers', category: 'Layers'},
      
      // Transform Tools
      { id: 'ps_128', action: 'Free Transform', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Free transform', category: 'Transform', isFavorite: true },
      { id: 'ps_129', action: 'Transform Again', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Repeat last transform', category: 'Transform'},
      { id: 'ps_130', action: 'Scale', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Scale transformation', category: 'Transform'},
      { id: 'ps_131', action: 'Rotate', shortcutWin: 'Ctrl+Shift+Alt+', shortcutMac: 'Cmd+Shift+Opt+', description: 'Rotate transformation', category: 'Transform'},
      { id: 'ps_132', action: 'Skew', shortcutWin: 'Ctrl+Alt+Shift+', shortcutMac: 'Cmd+Opt+Shift+', description: 'Skew transformation', category: 'Transform'},
      { id: 'ps_133', action: 'Distort', shortcutWin: 'Ctrl+Alt+Shift+', shortcutMac: 'Cmd+Opt+Shift+', description: 'Distort transformation', category: 'Transform'},
      { id: 'ps_134', action: 'Perspective', shortcutWin: 'Ctrl+Alt+Shift+', shortcutMac: 'Cmd+Opt+Shift+', description: 'Perspective transformation', category: 'Transform'},
      
      // Adjustment Layers
      { id: 'ps_135', action: 'Curves Adjustment', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Curves adjustment', category: 'Adjustments', isFavorite: true },
      { id: 'ps_136', action: 'Levels Adjustment', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Levels adjustment', category: 'Adjustments', isFavorite: true },
      { id: 'ps_137', action: 'Hue/Saturation', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Hue/Saturation adjustment', category: 'Adjustments', isFavorite: true },
      { id: 'ps_138', action: 'Color Balance', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Color balance adjustment', category: 'Adjustments'},
      { id: 'ps_139', action: 'Brightness/Contrast', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Brightness/Contrast', category: 'Adjustments'},
      { id: 'ps_140', action: 'Desaturate', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Desaturate image', category: 'Adjustments'},
      { id: 'ps_141', action: 'Invert', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Invert colors', category: 'Adjustments'},
      { id: 'ps_142', action: 'Auto Tone', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Auto tone adjustment', category: 'Adjustments'},
      { id: 'ps_143', action: 'Auto Contrast', shortcutWin: 'Ctrl+Alt+Shift+', shortcutMac: 'Cmd+Opt+Shift+', description: 'Auto contrast', category: 'Adjustments'},
      { id: 'ps_144', action: 'Auto Color', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Auto color correction', category: 'Adjustments'},
      
      // Channel Operations
      { id: 'ps_145', action: 'Channel Mixer', shortcutWin: 'Ctrl+Alt+Shift+', shortcutMac: 'Cmd+Opt+Shift+', description: 'Channel mixer', category: 'Channels'},
      { id: 'ps_146', action: 'Red Channel', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'View red channel', category: 'Channels'},
      { id: 'ps_147', action: 'Green Channel', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'View green channel', category: 'Channels'},
      { id: 'ps_148', action: 'Blue Channel', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'View blue channel', category: 'Channels'},
      { id: 'ps_149', action: 'Composite Channel', shortcutWin: 'Ctrl+~', shortcutMac: 'Cmd+~', description: 'View composite RG', category: 'Channels'},
      
      // Path Operations
      { id: 'ps_150', action: 'Make Work Path', shortcutWin: 'Ctrl+Alt+Enter', shortcutMac: 'Cmd+Opt+Return', description: 'Make work path from selection', category: 'Paths'},
      { id: 'ps_151', action: 'Make Selection from Path', shortcutWin: 'Ctrl+Enter', shortcutMac: 'Cmd+Return', description: 'Make selection from path', category: 'Paths'},
      { id: 'ps_152', action: 'Fill Path', shortcutWin: 'Ctrl+Shift+Enter', shortcutMac: 'Cmd+Shift+Return', description: 'Fill path', category: 'Paths'},
      { id: 'ps_153', action: 'Stroke Path', shortcutWin: 'Ctrl+Alt+Shift+Enter', shortcutMac: 'Cmd+Opt+Shift+Return', description: 'Stroke path', category: 'Paths'},
      
      // Guide and Grid
      { id: 'ps_154', action: 'Show Guides', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Show/hide guides', category: 'Guides'},
      { id: 'ps_155', action: 'Lock Guides', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Lock guides', category: 'Guides'},
      { id: 'ps_156', action: 'Show Grid', shortcutWin: 'Ctrl+\\', shortcutMac: 'Cmd+\\', description: 'Show/hide grid', category: 'Grid'},
      { id: 'ps_157', action: 'Snap to Grid', shortcutWin: 'Ctrl+Shift+\\', shortcutMac: 'Cmd+Shift+\\', description: 'Snap to grid', category: 'Grid'},
      { id: 'ps_158', action: 'Show Rulers', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Show/hide rulers', category: 'Rulers'},
      
      // Document Navigation
      { id: 'ps_159', action: 'Next Document', shortcutWin: 'Ctrl+Tab', shortcutMac: 'Cmd+Tab', description: 'Next document tab', category: 'Navigation'},
      { id: 'ps_160', action: 'Previous Document', shortcutWin: 'Ctrl+Shift+Tab', shortcutMac: 'Cmd+Shift+Tab', description: 'Previous document tab', category: 'Navigation'},
      { id: 'ps_161', action: 'Rotate View Clockwise', shortcutWin: ',', shortcutMac: '', description: 'Rotate view clockwise', category: 'Navigation'},
      { id: 'ps_162', action: 'Rotate View Counter-clockwise', shortcutWin: 'Shift+', shortcutMac: 'Shift+', description: 'Rotate view counter-clockwise', category: 'Navigation'},
      { id: 'ps_163', action: 'Reset View', shortcutWin: 'Escape', shortcutMac: 'Escape', description: 'Reset view rotation', category: 'Navigation'},
      
      // Advanced Selections
      { id: 'ps_164', action: 'Color Range', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Select color range', category: 'Selection'},
      { id: 'ps_165', action: 'Refine Edge', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Refine selection edge', category: 'Selection'},
      { id: 'ps_166', action: 'Contract Selection', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Contract selection', category: 'Selection'},
      { id: 'ps_167', action: 'Expand Selection', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Expand selection', category: 'Selection'},
      { id: 'ps_168', action: 'Border Selection', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Border selection', category: 'Selection'},
      { id: 'ps_169', action: 'Smooth Selection', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Smooth selection', category: 'Selection'},
      
      // Actions and History
      { id: 'ps_170', action: 'Play Action', shortcutWin: 'F', shortcutMac: 'F', description: 'Play selected action', category: 'Actions'},
      { id: 'ps_171', action: 'Step Backward', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Step backward in history', category: 'History', isFavorite: true },
      { id: 'ps_172', action: 'Step Forward', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Step forward in history', category: 'History', isFavorite: true },
      
      // Content-Aware Features
      { id: 'ps_173', action: 'Content-Aware Fill', shortcutWin: 'Shift+F', shortcutMac: 'Shift+F', description: 'Content-aware fill', category: 'Content-Aware', isFavorite: true },
      { id: 'ps_174', action: 'Content-Aware Scale', shortcutWin: 'Ctrl+Alt+Shift+', shortcutMac: 'Cmd+Opt+Shift+', description: 'Content-aware scale', category: 'Content-Aware'},
      { id: 'ps_175', action: 'Content-Aware Move', shortcutWin: 'Shift+', shortcutMac: 'Shift+', description: 'Content-aware move tool', category: 'Content-Aware'}
    ]
},
  {
    id: 'captureone',
    name: 'Capture One',
    icon: CaptureOneLogo,
    color: '#000000', // Phase One's official Capture One black
    shortcuts: [
      // File Operations
      { id: 'c1_', action: 'Import Images', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Import new images', category: 'Import/Export', isFavorite: true },
      { id: 'c1_', action: 'Process Queue', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Start processing queue', category: 'Import/Export', isFavorite: true },
      { id: 'c1_', action: 'New Session', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Create new session', category: 'File'},
      { id: 'c1_5', action: 'AI Subject Masking', shortcutWin: 'Shift+', shortcutMac: 'Shift+', description: ',', category: 'AI Tools', isFavorite: true, isNew: true },
      { id: 'c1_5', action: 'AI Keyword Tagging', shortcutWin: 'Shift+', shortcutMac: 'Shift+', description: ',', category: 'AI Tools', isNew: true },
      { id: 'c1_5', action: 'Speed Edit', shortcutWin: 'Shift+', shortcutMac: 'Shift+', description: ',', category: 'Workflow', isNew: true },
      { id: 'c1_', action: 'Open Session', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Open existing session', category: 'File'},
      { id: 'c1_', action: 'Save Session', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Save current session', category: 'File'},
      
      // Basic Adjustments
      { id: 'c1_', action: 'Exposure Tool', shortcutWin: ',', shortcutMac: '', description: 'Exposure adjustment tool', category: 'Basic Adjustments', isFavorite: true },
      { id: 'c1_', action: 'Contrast Tool', shortcutWin: ',', shortcutMac: '', description: 'Contrast adjustment tool', category: 'Basic Adjustments', isFavorite: true },
      { id: 'c1_', action: 'Highlights Tool', shortcutWin: ',', shortcutMac: '', description: 'Highlights adjustment tool', category: 'Basic Adjustments', isFavorite: true },
      { id: 'c1_', action: 'Shadows Tool', shortcutWin: ',', shortcutMac: '', description: 'Shadows adjustment tool', category: 'Basic Adjustments', isFavorite: true },
      { id: 'c1_1', action: 'Whites Tool', shortcutWin: ',', shortcutMac: '', description: 'Whites adjustment tool', category: 'Basic Adjustments' },
      { id: 'c1_1', action: 'Blacks Tool', shortcutWin: ',', shortcutMac: '', description: 'Blacks adjustment tool', category: 'Basic Adjustments' },
      { id: 'c1_1', action: 'Vibrance Tool', shortcutWin: ',', shortcutMac: '', description: 'Vibrance adjustment tool', category: 'Basic Adjustments' },
      { id: 'c1_1', action: 'Saturation Tool', shortcutWin: 'Shift+', shortcutMac: 'Shift+', description: 'Saturation adjustment tool', category: 'Basic Adjustments' },
      
      // Color Tools
      { id: 'c1_1', action: 'White Balance', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'White balance picker', category: 'Color', isFavorite: true },
      { id: 'c1_1', action: 'Color Balance', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Color balance tool', category: 'Color'},
      { id: 'c1_1', action: 'Color Editor', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Advanced color editor', category: 'Color', isFavorite: true },
      { id: 'c1_1', action: 'LCH Editor', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'LCH color editor', category: 'Color'},
      
      // Local Adjustments
      { id: 'c1_1', action: 'Masking Tool', shortcutWin: ',', shortcutMac: '', description: 'Masking tool', category: 'Local Adjustments', isFavorite: true },
      { id: 'c1_1', action: 'Adjustment Layer', shortcutWin: ',', shortcutMac: '', description: 'Create adjustment layer', category: 'Local Adjustments', isFavorite: true },
      { id: 'c1_2', action: 'Clone Layer', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Clone layer', category: 'Local Adjustments' },
      { id: 'c1_2', action: 'Heal Layer', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Heal layer', category: 'Local Adjustments' },
      
      // Lens Corrections
      { id: 'c1_2', action: 'Lens Correction', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Lens correction tool', category: 'Lens Corrections', isFavorite: true },
      { id: 'c1_2', action: 'Keystone Correction', shortcutWin: ',', shortcutMac: '', description: 'Keystone correction', category: 'Lens Corrections' },
      { id: 'c1_2', action: 'Chromatic Aberration', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Chromatic aberration correction', category: 'Lens Corrections' },
      
      // Viewing & Navigation
      { id: 'c1_2', action: 'Before/After', shortcutWin: 'Space', shortcutMac: 'Space', description: 'Toggle before/after view', category: 'Viewing', isFavorite: true },
      { id: 'c1_2', action: 'Next Variant', shortcutWin: 'Right Arrow', shortcutMac: 'Right Arrow', description: 'Next variant', category: 'Navigation', isFavorite: true },
      { id: 'c1_2', action: 'Previous Variant', shortcutWin: 'Left Arrow', shortcutMac: 'Left Arrow', description: 'Previous variant', category: 'Navigation', isFavorite: true },
      { id: 'c1_2', action: 'Zoom I', shortcutWin: 'Ctrl++', shortcutMac: 'Cmd++', description: 'Zoom in', category: 'Viewing'},
      { id: 'c1_2', action: 'Zoom Out', shortcutWin: 'Ctrl+, -', shortcutMac: 'Cmd+, -', description: 'Zoom out', category: 'Viewing'},
      { id: 'c1_3', action: 'Fit to View', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Fit image to view', category: 'Viewing'},
      { id: 'c1_3', action: '100% View', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: '100% zoom view', category: 'Viewing'},
      { id: 'c1_3', action: 'Focus View', shortcutWin: ',', shortcutMac: '', description: 'Focus view mode', category: 'Viewing'},
      
      // Ratings & Selection
      { id: 'c1_3', action: '1 Star', shortcutWin: ',', shortcutMac: '', description: 'Rate 1 star', category: 'Rating', isFavorite: true },
      { id: 'c1_3', action: '2 Stars', shortcutWin: ',', shortcutMac: '', description: 'Rate 2 stars', category: 'Rating', isFavorite: true },
      { id: 'c1_3', action: '3 Stars', shortcutWin: ',', shortcutMac: '', description: 'Rate 3 stars', category: 'Rating', isFavorite: true },
      { id: 'c1_3', action: '4 Stars', shortcutWin: ',', shortcutMac: '', description: 'Rate 4 stars', category: 'Rating', isFavorite: true },
      { id: 'c1_3', action: '5 Stars', shortcutWin: ',', shortcutMac: '', description: 'Rate 5 stars', category: 'Rating', isFavorite: true },
      { id: 'c1_3', action: 'Remove Rating', shortcutWin: ',', shortcutMac: '', description: 'Remove rating', category: 'Rating'},
      { id: 'c1_3', action: 'Select Image', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Select/deselect image', category: 'Selection'},
      
      // Styles & Presets
      { id: 'c1_4', action: 'Apply Style', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Apply style/preset', category: 'Styles', isFavorite: true },
      { id: 'c1_4', action: 'Copy Adjustments', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Copy adjustments', category: 'Styles', isFavorite: true },
      { id: 'c1_4', action: 'Paste Adjustments', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Paste adjustments', category: 'Styles', isFavorite: true },
      { id: 'c1_4', action: 'Reset All', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Reset all adjustments', category: 'Styles'},
      
      // Tethering & Capture
      { id: 'c1_4', action: 'Start Tethering', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Start tethered capture', category: 'Tethering'},
      { id: 'c1_4', action: 'Trigger Capture', shortcutWin: 'F1', shortcutMac: 'F1', description: 'Trigger camera capture', category: 'Tethering', isFavorite: true },
      { id: 'c1_4', action: 'Auto Advance', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Toggle auto advance', category: 'Tethering'},
      
      // Output & Processing
      { id: 'c1_4', action: 'Add to Process Queue', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Add to process queue', category: 'Output', isFavorite: true },
      { id: 'c1_4', action: 'Recipe Proofing', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Recipe proofing mode', category: 'Output'},
      { id: 'c1_4', action: 'Export Variant', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Export current variant', category: 'Output'},
      
      // Complete Tool Set
      { id: 'c1_5', action: 'Pan Tool', shortcutWin: 'Space+Drag', shortcutMac: 'Space+Drag', description: 'Pan around image', category: 'Tools'},
      { id: 'c1_5', action: 'Rotate Tool', shortcutWin: ',', shortcutMac: '', description: 'Rotate image view', category: 'Tools'},
      { id: 'c1_5', action: 'Loupe Tool', shortcutWin: ',', shortcutMac: '', description: 'Loupe inspection tool', category: 'Tools'},
      { id: 'c1_5', action: 'Crop Tool', shortcutWin: 'Shift+', shortcutMac: 'Shift+', description: 'Crop tool', category: 'Tools', isFavorite: true },
      
      // Advanced Viewing
      { id: 'c1_5', action: 'Solo View', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Solo view mode', category: 'Viewing'},
      { id: 'c1_5', action: 'Full Screen', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Full screen mode', category: 'Viewing'},
      { id: 'c1_5', action: 'Show Info', shortcutWin: ',', shortcutMac: '', description: 'Show image info', category: 'Viewing'},
      { id: 'c1_6', action: 'Show Histogram', shortcutWin: 'Shift+', shortcutMac: 'Shift+', description: 'Show histogram', category: 'Viewing'},
      { id: 'c1_6', action: 'Show Levels', shortcutWin: 'Shift+', shortcutMac: 'Shift+', description: 'Show levels display', category: 'Viewing'},
      { id: 'c1_6', action: 'Show Shadow/Highlight', shortcutWin: ',', shortcutMac: '', description: 'Show shadow/highlight warning', category: 'Viewing'},
      { id: 'c1_6', action: 'Show Focus Mask', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Show focus mask overlay', category: 'Viewing'},
      
      // Color & Profile Management
      { id: 'c1_6', action: 'ICC Profile', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Assign ICC profile', category: 'Color Management' },
      { id: 'c1_6', action: 'Soft Proofing', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Toggle soft proofing', category: 'Color Management' },
      { id: 'c1_6', action: 'Gamut Warning', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Show gamut warning', category: 'Color Management' },
      
      // Session Management
      { id: 'c1_6', action: 'New Session from Folder', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Create session from folder', category: 'Session'},
      { id: 'c1_6', action: 'Save Session A', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Save session with new name', category: 'Session'},
      { id: 'c1_6', action: 'Close Session', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Close current session', category: 'Session'},
      { id: 'c1_7', action: 'Recent Sessions', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Open recent sessions', category: 'Session'},
      
      // Advanced Local Adjustments
      { id: 'c1_7', action: 'Gradient Mask', shortcutWin: ',', shortcutMac: '', description: 'Gradient mask tool', category: 'Local Adjustments' },
      { id: 'c1_7', action: 'Radial Mask', shortcutWin: 'Shift+', shortcutMac: 'Shift+', description: 'Radial mask tool', category: 'Local Adjustments' },
      { id: 'c1_7', action: 'Luminosity Mask', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Luminosity mask', category: 'Local Adjustments' },
      { id: 'c1_7', action: 'Color Range Mask', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Color range mask', category: 'Local Adjustments' },
      { id: 'c1_7', action: 'Invert Mask', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Invert active mask', category: 'Local Adjustments' },
      { id: 'c1_7', action: 'Feather Mask', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Feather mask edges', category: 'Local Adjustments' },
      
      // Professional Color Tools
      { id: 'c1_7', action: 'Color Wheel', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Open color wheel', category: 'Color'},
      { id: 'c1_7', action: 'Shadow/Midtone/Highlight', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Shadow/midtone/highlight tool', category: 'Color'},
      { id: 'c1_7', action: 'Film Grain', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Add film grain', category: 'Effects'},
      { id: 'c1_8', action: 'Vignetting', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Vignetting tool', category: 'Effects'},
      
      // Batch Operations
      { id: 'c1_8', action: 'Select All Images', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Select all images', category: 'Batch'},
      { id: 'c1_8', action: 'Select None', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Deselect all', category: 'Batch'},
      { id: 'c1_8', action: 'Select Similar', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Select similar images', category: 'Batch'},
      { id: 'c1_8', action: 'Auto Apply', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Auto apply adjustments', category: 'Batch'},
      { id: 'c1_8', action: 'Sync All', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Sync to all selected', category: 'Batch'},
      
      // Professional Output
      { id: 'c1_8', action: 'Recipe Manager', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Open recipe manager', category: 'Output'},
      { id: 'c1_8', action: 'Output Location', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Set output location', category: 'Output'},
      { id: 'c1_8', action: 'Watermark', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Add watermark', category: 'Output'},
      { id: 'c1_8', action: 'Copyright Info', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Add copyright info', category: 'Output'},
      
      // Lens and Perspective
      { id: 'c1_9', action: 'Lens Profile', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Apply lens profile', category: 'Lens Corrections' },
      { id: 'c1_9', action: 'Distortion Correction', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Correct lens distortion', category: 'Lens Corrections' },
      { id: 'c1_9', action: 'Vignetting Correction', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Correct vignetting', category: 'Lens Corrections' },
      { id: 'c1_9', action: 'Purple Fringing', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Remove purple fringing', category: 'Lens Corrections' },
      { id: 'c1_9', action: 'Diffraction Correction', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Diffraction correction', category: 'Lens Corrections' },
      
      // Metadata and Keywords
      { id: 'c1_9', action: 'IPTC Metadata', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Edit IPTC metadata', category: 'Metadata'},
      { id: 'c1_9', action: 'EXIF Data', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'View EXIF data', category: 'Metadata'},
      { id: 'c1_9', action: 'GPS Data', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'View GPS data', category: 'Metadata'},
      { id: 'c1_9', action: 'Color Tag Red', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Apply red color tag', category: 'Tags'},
      { id: 'c1_9', action: 'Color Tag Orange', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Apply orange color tag', category: 'Tags'},
      { id: 'c1_10', action: 'Color Tag Yellow', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Apply yellow color tag', category: 'Tags'},
      { id: 'c1_10', action: 'Color Tag Green', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Apply green color tag', category: 'Tags'},
      { id: 'c1_10', action: 'Color Tag Blue', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Apply blue color tag', category: 'Tags'},
      
      // Professional Workflow
      { id: 'c1_10', action: 'Compare Mode', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Compare multiple images', category: 'Workflow'},
      { id: 'c1_10', action: 'Reference Image', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Set reference image', category: 'Workflow'},
      { id: 'c1_10', action: 'Screen Proofing', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Screen proofing mode', category: 'Workflow'},
      { id: 'c1_10', action: 'Print Proofing', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Print proofing mode', category: 'Workflow'},
      
      // Workspace and Interface
      { id: 'c1_10', action: 'Hide/Show Tools', shortcutWin: 'Tab', shortcutMac: 'Tab', description: 'Hide/show tool tabs', category: 'Interface'},
      { id: 'c1_10', action: 'Hide/Show Browser', shortcutWin: 'Shift+Tab', shortcutMac: 'Shift+Tab', description: 'Hide/show browser', category: 'Interface'},
      { id: 'c1_10', action: 'Workspace Manager', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Manage workspaces', category: 'Interface'},
      { id: 'c1_11', action: 'Customize Interface', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Customize interface', category: 'Interface'},
      
      // Advanced Features
      { id: 'c1_11', action: 'Focus Stack', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Focus stacking', category: 'Advanced'},
      { id: 'c1_11', action: 'HDR Merge', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'HDR merge', category: 'Advanced'},
      { id: 'c1_11', action: 'Panorama Stitch', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Panorama stitching', category: 'Advanced'},
      { id: 'c1_11', action: 'Noise Reduction', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Advanced noise reduction', category: 'Advanced'},
      { id: 'c1_11', action: 'Moiré Reduction', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Moiré pattern reduction', category: 'Advanced'},
      
      // Capture and Live View
      { id: 'c1_11', action: 'Live View', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Toggle live view', category: 'Capture'},
      { id: 'c1_11', action: 'Focus Peaking', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Toggle focus peaking', category: 'Capture'},
      { id: 'c1_11', action: 'Exposure Warning', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Exposure warning overlay', category: 'Capture'},
      { id: 'c1_11', action: 'Grid Overlay', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Grid overlay in live view', category: 'Capture'},
      { id: 'c1_12', action: 'Camera Settings', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Camera settings panel', category: 'Capture'},

      // Workspace & View
      { id: 'c1_', action: 'Browser View', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Show/hide browser', category: 'View', isFavorite: true },
      { id: 'c1_', action: 'Viewer View', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Show/hide viewer', category: 'View', isFavorite: true },
      { id: 'c1_', action: 'Tools View', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Show/hide tools tab', category: 'View'},
      { id: 'c1_', action: 'Fullscreen', shortcutWin: ',', shortcutMac: '', description: 'Toggle fullscreen mode', category: 'View'},
      { id: 'c1_1', action: 'Next Workspace', shortcutWin: 'Ctrl+Tab', shortcutMac: 'Cmd+Tab', description: 'Switch to next workspace', category: 'View'},

      // Navigation
      { id: 'c1_1', action: 'Next Image', shortcutWin: 'Right Arrow', shortcutMac: 'Right Arrow', description: 'Navigate to next image', category: 'Navigation', isFavorite: true },
      { id: 'c1_1', action: 'Previous Image', shortcutWin: 'Left Arrow', shortcutMac: 'Left Arrow', description: 'Navigate to previous image', category: 'Navigation', isFavorite: true },
      { id: 'c1_1', action: 'First Image', shortcutWin: 'Home', shortcutMac: 'Home', description: 'Go to first image', category: 'Navigation'},
      { id: 'c1_1', action: 'Last Image', shortcutWin: 'End', shortcutMac: 'End', description: 'Go to last image', category: 'Navigation'},

      // Rating & Organization  
      { id: 'c1_1', action: '1 Star', shortcutWin: ',', shortcutMac: '', description: 'Rate 1 star', category: 'Organization'},
      { id: 'c1_1', action: '2 Stars', shortcutWin: ',', shortcutMac: '', description: 'Rate 2 stars', category: 'Organization'},
      { id: 'c1_1', action: '3 Stars', shortcutWin: ',', shortcutMac: '', description: 'Rate 3 stars', category: 'Organization'},
      { id: 'c1_1', action: '4 Stars', shortcutWin: ',', shortcutMac: '', description: 'Rate 4 stars', category: 'Organization'},
      { id: 'c1_1', action: '5 Stars', shortcutWin: ',', shortcutMac: '', description: 'Rate 5 stars', category: 'Organization', isFavorite: true },
      { id: 'c1_2', action: 'Red Color Tag', shortcutWin: 'F', shortcutMac: 'F', description: 'Apply red color tag', category: 'Organization'},
      { id: 'c1_2', action: 'Yellow Color Tag', shortcutWin: 'F', shortcutMac: 'F', description: 'Apply yellow color tag', category: 'Organization'},
      { id: 'c1_2', action: 'Green Color Tag', shortcutWin: 'F', shortcutMac: 'F', description: 'Apply green color tag', category: 'Organization'},
      { id: 'c1_2', action: 'Blue Color Tag', shortcutWin: 'F', shortcutMac: 'F', description: 'Apply blue color tag', category: 'Organization'},

      // Editing & Adjustments
      { id: 'c1_2', action: 'Auto Adjust', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Auto adjust exposure', category: 'Editing', isFavorite: true },
      { id: 'c1_2', action: 'Reset All', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Reset all adjustments', category: 'Editing'},
      { id: 'c1_2', action: 'Copy Adjustments', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Copy adjustments', category: 'Editing', isFavorite: true },
      { id: 'c1_2', action: 'Paste Adjustments', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Paste adjustments', category: 'Editing', isFavorite: true },
      { id: 'c1_2', action: 'Crop Tool', shortcutWin: ',', shortcutMac: '', description: 'Activate crop tool', category: 'Editing', isFavorite: true },
      { id: 'c1_2', action: 'Local Adjustments', shortcutWin: ',', shortcutMac: '', description: 'Activate local adjustment tool', category: 'Editing', isFavorite: true },
      { id: 'c1_3', action: 'Healing Tool', shortcutWin: ',', shortcutMac: '', description: 'Activate healing tool', category: 'Editing', isFavorite: true },

      // Zoom & Navigation
      { id: 'c1_3', action: 'Zoom I', shortcutWin: 'Ctrl++', shortcutMac: 'Cmd++', description: 'Zoom into image', category: 'Zoom'},
      { id: 'c1_3', action: 'Zoom Out', shortcutWin: 'Ctrl+, -', shortcutMac: 'Cmd+, -', description: 'Zoom out of image', category: 'Zoom'},
      { id: 'c1_3', action: 'Zoom to 100, %', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Zoom to actual size', category: 'Zoom', isFavorite: true },
      { id: 'c1_3', action: 'Fit to View', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Fit image to viewer', category: 'Zoom'},

      // Collections & Albums
      { id: 'c1_3', action: 'New Collection', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Create new collection', category: 'Organization'},
      { id: 'c1_3', action: 'New Smart Album', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Create smart album', category: 'Organization'},

      // Advanced Tools
      { id: 'c1_3', action: 'Lens Correction', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Enable lens correction', category: 'Correction'},
      { id: 'c1_3', action: 'Keystone Correction', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Enable keystone correction', category: 'Correction'},
      { id: 'c1_3', action: 'Clone/Heal', shortcutWin: 'Shift+', shortcutMac: 'Shift+', description: 'Toggle clone/heal mode', category: 'Editing', isNew: true },
      { id: 'c1_4', action: 'Focus Mask', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Show focus mask overlay', category: 'View', isNew: true }
    ]
},
  {
    id: 'davinci',
    name: 'DaVinci Resolve',
    description: 'Professional video editing and color grading',
    icon: DaVinciLogo,
    color: '#FF2D55',
    shortcuts: [
      // File & Project Management
      { id: 'dv_', action: 'New Project', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Create new project', category: 'File', isFavorite: true },
      { id: 'dv_', action: 'Open Project', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Open existing project', category: 'File'},
      { id: 'dv_', action: 'Save Project', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Save current project', category: 'File', isFavorite: true },
      { id: 'dv_', action: 'Import Media', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Import media files', category: 'File', isFavorite: true },
      { id: 'dv_', action: 'Export', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Export/render project', category: 'File', isFavorite: true },
      
      // Playback Controls
      { id: 'dv_', action: 'Play/Pause', shortcutWin: 'Space', shortcutMac: 'Space', description: 'Play or pause timeline', category: 'Playback', isFavorite: true },
      { id: 'dv_', action: 'Play Backward', shortcutWin: ',', shortcutMac: '', description: 'Play backwards', category: 'Playback', isFavorite: true },
      { id: 'dv_', action: 'Play Forward', shortcutWin: ',', shortcutMac: '', description: 'Play forwards', category: 'Playback', isFavorite: true },
      { id: 'dv_', action: 'Stop', shortcutWin: ',', shortcutMac: '', description: 'Stop playback', category: 'Playback', isFavorite: true },
      { id: 'dv_10', action: 'Go to Beginning', shortcutWin: 'Home', shortcutMac: 'Home', description: 'Go to timeline start', category: 'Playback'},
      { id: 'dv_11', action: 'Go to End', shortcutWin: 'End', shortcutMac: 'End', description: 'Go to timeline end', category: 'Playback'},
      { id: 'dv_12', action: 'Next Frame', shortcutWin: 'Right Arrow', shortcutMac: 'Right Arrow', description: 'Move one frame forward', category: 'Playback'},
      { id: 'dv_13', action: 'Previous Frame', shortcutWin: 'Left Arrow', shortcutMac: 'Left Arrow', description: 'Move one frame backward', category: 'Playback'},
      { id: 'dv_14', action: 'Next Edit', shortcutWin: 'Page Down', shortcutMac: 'Page Down', description: 'Jump to next edit', category: 'Playback'},
      { id: 'dv_15', action: 'Previous Edit', shortcutWin: 'Page U', shortcutMac: 'Page U', description: 'Jump to previous edit', category: 'Playback'},
      
      // Timeline Editing
      { id: 'dv_16', action: 'Cut/Blade', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Cut clip at playhead', category: 'Editing', isFavorite: true },
      { id: 'dv_17', action: 'Ripple Delete', shortcutWin: 'Shift+Delete', shortcutMac: 'Shift+Delete', description: 'Delete and close gap', category: 'Editing', isFavorite: true },
      { id: 'dv_18', action: 'Insert', shortcutWin: 'F', shortcutMac: 'F', description: 'Insert clip at timeline', category: 'Editing', isFavorite: true },
      { id: 'dv_19', action: 'Overwrite', shortcutWin: 'F1', shortcutMac: 'F1', description: 'Overwrite clip on timeline', category: 'Editing', isFavorite: true },
      { id: 'dv_20', action: 'Replace', shortcutWin: 'F1', shortcutMac: 'F1', description: 'Replace selected clip', category: 'Editing'},
      { id: 'dv_21', action: 'Fit to Fill', shortcutWin: 'F1', shortcutMac: 'F1', description: 'Fit clip to fill gap', category: 'Editing'},
      { id: 'dv_22', action: 'Link/Unlink', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Link or unlink clips', category: 'Editing'},
      { id: 'dv_23', action: 'Group Clips', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Group selected clips', category: 'Editing'},
      { id: 'dv_24', action: 'Ungroup Clips', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Ungroup clips', category: 'Editing'},
      
      // Tools
      { id: 'dv_25', action: 'Selection Tool', shortcutWin: ',', shortcutMac: '', description: 'Arrow selection tool', category: 'Tools', isFavorite: true },
      { id: 'dv_26', action: 'Trim Tool', shortcutWin: ',', shortcutMac: '', description: 'Trim edit tool', category: 'Tools', isFavorite: true },
      { id: 'dv_27', action: 'Blade Tool', shortcutWin: ',', shortcutMac: '', description: 'Blade/razor tool', category: 'Tools', isFavorite: true },
      { id: 'dv_28', action: 'Slip Tool', shortcutWin: ',', shortcutMac: '', description: 'Slip edit tool', category: 'Tools'},
      { id: 'dv_29', action: 'Slide Tool', shortcutWin: 'Shift+', shortcutMac: 'Shift+', description: 'Slide edit tool', category: 'Tools'},
      { id: 'dv_30', action: 'Hand Tool', shortcutWin: ',', shortcutMac: '', description: 'Hand/pan tool', category: 'Tools'},
      { id: 'dv_31', action: 'Zoom Tool', shortcutWin: ',', shortcutMac: '', description: 'Zoom tool', category: 'Tools'},
      
      // Workspaces
      { id: 'dv_32', action: 'Media Pool', shortcutWin: 'Shift+', shortcutMac: 'Shift+', description: 'Switch to Media page', category: 'Workspaces', isFavorite: true },
      { id: 'dv_33', action: 'Cut Page', shortcutWin: 'Shift+', shortcutMac: 'Shift+', description: 'Switch to Cut page', category: 'Workspaces', isFavorite: true },
      { id: 'dv_34', action: 'Edit Page', shortcutWin: 'Shift+', shortcutMac: 'Shift+', description: 'Switch to Edit page', category: 'Workspaces', isFavorite: true },
      { id: 'dv_35', action: 'Fusion Page', shortcutWin: 'Shift+', shortcutMac: 'Shift+', description: 'Switch to Fusion page', category: 'Workspaces'},
      { id: 'dv_36', action: 'Color Page', shortcutWin: 'Shift+', shortcutMac: 'Shift+', description: 'Switch to Color page', category: 'Workspaces', isFavorite: true },
      { id: 'dv_37', action: 'Fairlight Page', shortcutWin: 'Shift+', shortcutMac: 'Shift+', description: 'Switch to Fairlight page', category: 'Workspaces'},
      { id: 'dv_38', action: 'Deliver Page', shortcutWin: 'Shift+', shortcutMac: 'Shift+', description: 'Switch to Deliver page', category: 'Workspaces'},
      
      // Timeline Navigation
      { id: 'dv_39', action: 'Zoom Timeline I', shortcutWin: 'Ctrl++', shortcutMac: 'Cmd++', description: 'Zoom timeline in', category: 'Timeline'},
      { id: 'dv_40', action: 'Zoom Timeline Out', shortcutWin: 'Ctrl+, -', shortcutMac: 'Cmd+, -', description: 'Zoom timeline out', category: 'Timeline'},
      { id: 'dv_41', action: 'Fit Timeline', shortcutWin: 'Shift+', shortcutMac: 'Shift+', description: 'Fit timeline to window', category: 'Timeline'},
      { id: 'dv_42', action: 'Select All', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Select all clips', category: 'Selection'},
      { id: 'dv_43', action: 'Deselect All', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Deselect all clips', category: 'Selection'},
      
      // Markers
      { id: 'dv_44', action: 'Add Marker', shortcutWin: ',', shortcutMac: '', description: 'Add marker at playhead', category: 'Markers', isFavorite: true },
      { id: 'dv_45', action: 'Delete Marker', shortcutWin: 'Shift+', shortcutMac: 'Shift+', description: 'Delete marker', category: 'Markers'},
      { id: 'dv_46', action: 'Next Marker', shortcutWin: 'Shift+Right', shortcutMac: 'Shift+Right', description: 'Go to next marker', category: 'Markers'},
      { id: 'dv_47', action: 'Previous Marker', shortcutWin: 'Shift+Left', shortcutMac: 'Shift+Left', description: 'Go to previous marker', category: 'Markers'},
      
      // Color Correction
      { id: 'dv_48', action: 'Reset Node', shortcutWin: 'Ctrl+Home', shortcutMac: 'Cmd+Home', description: 'Reset color node', category: 'Color'},
      { id: 'dv_49', action: 'Add Node', shortcutWin: 'Alt+', shortcutMac: 'Opt+', description: 'Add serial node', category: 'Color'},
      { id: 'dv_50', action: 'Add Parallel Node', shortcutWin: 'Alt+', shortcutMac: 'Opt+', description: 'Add parallel node', category: 'Color'},
      { id: 'dv_51', action: 'Delete Node', shortcutWin: 'Delete', shortcutMac: 'Delete', description: 'Delete selected node', category: 'Color'},
      { id: 'dv_52', action: 'Enable/Disable Node', shortcutWin: ',', shortcutMac: '', description: 'Enable or disable node', category: 'Color'},
      
      // Audio
      { id: 'dv_53', action: 'Solo Track', shortcutWin: ',', shortcutMac: '', description: 'Solo audio track', category: 'Audio'},
      { id: 'dv_54', action: 'Mute Track', shortcutWin: ',', shortcutMac: '', description: 'Mute audio track', category: 'Audio'},
      { id: 'dv_55', action: 'Record Audio', shortcutWin: 'Shift+', shortcutMac: 'Shift+', description: 'Start audio recording', category: 'Audio'},
      
      // Advanced Features (2025)
      { id: 'dv_56', action: 'Neural Engine', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: ',', category: 'AI Tools', isNew: true },
      { id: 'dv_57', action: 'Auto Color Match', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: ',', category: 'AI Tools', isNew: true },
      { id: 'dv_58', action: 'Smart Reframe', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: ',', category: 'AI Tools', isNew: true }
    ]
},
  {
    id: 'premiere',
    name: 'Adobe Premiere Pro',
    description: 'Professional video editing software',
    icon: PremiereLogo,
    color: '#9999FF',
    shortcuts: [
      // File Management
      { id: 'pp_', action: 'New Project', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Create new project', category: 'File', isFavorite: true },
      { id: 'pp_', action: 'Open Project', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Open project', category: 'File'},
      { id: 'pp_', action: 'Save', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Save project', category: 'File', isFavorite: true },
      { id: 'pp_', action: 'Save A', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Save project as', category: 'File'},
      { id: 'pp_', action: 'Import', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Import media', category: 'File', isFavorite: true },
      { id: 'pp_', action: 'Export Media', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Export/render media', category: 'File', isFavorite: true },
      
      // Playback
      { id: 'pp_', action: 'Play/Pause', shortcutWin: 'Space', shortcutMac: 'Space', description: 'Play or pause', category: 'Playback', isFavorite: true },
      { id: 'pp_', action: 'Play In to Out', shortcutWin: 'Shift+Space', shortcutMac: 'Shift+Space', description: 'Play from in to out point', category: 'Playback'},
      { id: 'pp_', action: 'Play Around', shortcutWin: 'Shift+', shortcutMac: 'Shift+', description: 'Play around playhead', category: 'Playback'},
      { id: 'pp_10', action: 'Shuttle Left', shortcutWin: ',', shortcutMac: '', description: 'Shuttle backwards', category: 'Playback', isFavorite: true },
      { id: 'pp_11', action: 'Pause', shortcutWin: ',', shortcutMac: '', description: 'Pause', category: 'Playback', isFavorite: true },
      { id: 'pp_12', action: 'Shuttle Right', shortcutWin: ',', shortcutMac: '', description: 'Shuttle forwards', category: 'Playback', isFavorite: true },
      { id: 'pp_13', action: 'Step Forward', shortcutWin: 'Right Arrow', shortcutMac: 'Right Arrow', description: 'Step one frame forward', category: 'Playback'},
      { id: 'pp_14', action: 'Step Backward', shortcutWin: 'Left Arrow', shortcutMac: 'Left Arrow', description: 'Step one frame backward', category: 'Playback'},
      { id: 'pp_15', action: 'Go to In Point', shortcutWin: 'Shift+', shortcutMac: 'Shift+', description: 'Go to in point', category: 'Playback'},
      { id: 'pp_16', action: 'Go to Out Point', shortcutWin: 'Shift+', shortcutMac: 'Shift+', description: 'Go to out point', category: 'Playback'},
      
      // Editing
      { id: 'pp_17', action: 'Razor Tool', shortcutWin: ',', shortcutMac: '', description: 'Activate razor tool', category: 'Tools', isFavorite: true },
      { id: 'pp_18', action: 'Selection Tool', shortcutWin: ',', shortcutMac: '', description: 'Selection tool', category: 'Tools', isFavorite: true },
      { id: 'pp_19', action: 'Track Select Forward', shortcutWin: 'Shift+', shortcutMac: 'Shift+', description: 'Track select forward tool', category: 'Tools'},
      { id: 'pp_20', action: 'Track Select Backward', shortcutWin: 'Shift+', shortcutMac: 'Shift+', description: 'Track select backward tool', category: 'Tools'},
      { id: 'pp_21', action: 'Ripple Edit', shortcutWin: ',', shortcutMac: '', description: 'Ripple edit tool', category: 'Tools'},
      { id: 'pp_22', action: 'Rolling Edit', shortcutWin: ',', shortcutMac: '', description: 'Rolling edit tool', category: 'Tools'},
      { id: 'pp_23', action: 'Rate Stretch', shortcutWin: ',', shortcutMac: '', description: 'Rate stretch tool', category: 'Tools'},
      { id: 'pp_24', action: 'Slip Tool', shortcutWin: ',', shortcutMac: '', description: 'Slip tool', category: 'Tools'},
      { id: 'pp_25', action: 'Slide Tool', shortcutWin: ',', shortcutMac: '', description: 'Slide tool', category: 'Tools'},
      { id: 'pp_26', action: 'Pen Tool', shortcutWin: ',', shortcutMac: '', description: 'Pen tool', category: 'Tools'},
      { id: 'pp_27', action: 'Hand Tool', shortcutWin: ',', shortcutMac: '', description: 'Hand tool', category: 'Tools'},
      { id: 'pp_28', action: 'Zoom Tool', shortcutWin: ',', shortcutMac: '', description: 'Zoom tool', category: 'Tools'},
      
      // Timeline Editing
      { id: 'pp_29', action: 'Cut', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Cut at playhead', category: 'Editing', isFavorite: true },
      { id: 'pp_30', action: 'Ripple Delete', shortcutWin: 'Shift+Delete', shortcutMac: 'Shift+Delete', description: 'Ripple delete', category: 'Editing', isFavorite: true },
      { id: 'pp_31', action: 'Lift', shortcutWin: ',', shortcutMac: '', description: 'Lift selection', category: 'Editing'},
      { id: 'pp_32', action: 'Extract', shortcutWin: "'", shortcutMac: "',", description: 'Extract selection', category: 'Editing'},
      { id: 'pp_33', action: 'Insert', shortcutWin: ',', shortcutMac: '', description: 'Insert clip', category: 'Editing', isFavorite: true },
      { id: 'pp_34', action: 'Overwrite', shortcutWin: '.', shortcutMac: '.', description: 'Overwrite clip', category: 'Editing', isFavorite: true },
      { id: 'pp_35', action: 'Duplicate', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Duplicate clip', category: 'Editing'},
      
      // Marks
      { id: 'pp_36', action: 'Mark I', shortcutWin: ',', shortcutMac: '', description: 'Set in point', category: 'Marks', isFavorite: true },
      { id: 'pp_37', action: 'Mark Out', shortcutWin: ',', shortcutMac: '', description: 'Set out point', category: 'Marks', isFavorite: true },
      { id: 'pp_38', action: 'Clear I', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Clear in point', category: 'Marks'},
      { id: 'pp_39', action: 'Clear Out', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Clear out point', category: 'Marks'},
      { id: 'pp_40', action: 'Clear In/Out', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Clear in and out points', category: 'Marks'},
      { id: 'pp_41', action: 'Add Marker', shortcutWin: ',', shortcutMac: '', description: 'Add marker', category: 'Marks', isFavorite: true },
      
      // Timeline Navigation
      { id: 'pp_42', action: 'Zoom I', shortcutWin: ', =', shortcutMac: ', =', description: 'Zoom timeline in', category: 'Timeline'},
      { id: 'pp_43', action: 'Zoom Out', shortcutWin: ', -', shortcutMac: ', -', description: 'Zoom timeline out', category: 'Timeline'},
      { id: 'pp_44', action: 'Zoom to Sequence', shortcutWin: '\\', shortcutMac: '\\', description: 'Zoom to fit sequence', category: 'Timeline'},
      { id: 'pp_45', action: 'Maximize Panel', shortcutWin: ', `', shortcutMac: ', `', description: 'Maximize active panel', category: 'Interface'},
      
      // Audio
      { id: 'pp_46', action: 'Audio Gain', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Adjust audio gain', category: 'Audio'},
      { id: 'pp_47', action: 'Audio Mixer', shortcutWin: 'Shift+', shortcutMac: 'Shift+', description: 'Open audio mixer', category: 'Audio'},
      
      // Effects
      { id: 'pp_48', action: 'Effects Panel', shortcutWin: 'Shift+', shortcutMac: 'Shift+', description: 'Open effects panel', category: 'Effects'},
      { id: 'pp_49', action: 'Effect Controls', shortcutWin: 'Shift+', shortcutMac: 'Shift+', description: 'Effect controls panel', category: 'Effects'},
      
      // Workspace
      { id: 'pp_50', action: 'Assembly Workspace', shortcutWin: 'Alt+Shift+', shortcutMac: 'Opt+Shift+', description: 'Assembly workspace', category: 'Workspace'},
      { id: 'pp_51', action: 'Editing Workspace', shortcutWin: 'Alt+Shift+', shortcutMac: 'Opt+Shift+', description: 'Editing workspace', category: 'Workspace', isFavorite: true },
      { id: 'pp_52', action: 'Color Workspace', shortcutWin: 'Alt+Shift+', shortcutMac: 'Opt+Shift+', description: 'Color workspace', category: 'Workspace'},
      { id: 'pp_53', action: 'Effects Workspace', shortcutWin: 'Alt+Shift+', shortcutMac: 'Opt+Shift+', description: 'Effects workspace', category: 'Workspace'},
      { id: 'pp_54', action: 'Audio Workspace', shortcutWin: 'Alt+Shift+', shortcutMac: 'Opt+Shift+', description: 'Audio workspace', category: 'Workspace'},
      
      // Advanced Features (2025)
      { id: 'pp_55', action: 'Auto Reframe', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: ',', category: 'AI Tools', isNew: true },
      { id: 'pp_56', action: 'Scene Edit Detection', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: ',', category: 'AI Tools', isNew: true },
      { id: 'pp_57', action: 'Auto Color', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: ',', category: 'AI Tools', isNew: true }
    ]
},
  {
    id: 'finalcut',
    name: 'Final Cut Pro',
    description: 'Professional video editing for Mac',
    icon: FinalCutLogo,
    color: '#5856D6',
    shortcuts: [
      // File Management
      { id: 'fcp_', action: 'New Project', shortcutWin: 'Cmd+', shortcutMac: 'Cmd+', description: 'Create new project', category: 'File', isFavorite: true },
      { id: 'fcp_', action: 'Open Project', shortcutWin: 'Cmd+', shortcutMac: 'Cmd+', description: 'Open project', category: 'File'},
      { id: 'fcp_', action: 'Save', shortcutWin: 'Cmd+', shortcutMac: 'Cmd+', description: 'Save project', category: 'File', isFavorite: true },
      { id: 'fcp_', action: 'Import Media', shortcutWin: 'Cmd+', shortcutMac: 'Cmd+', description: 'Import media files', category: 'File', isFavorite: true },
      { id: 'fcp_', action: 'Share', shortcutWin: 'Cmd+', shortcutMac: 'Cmd+', description: 'Export/share project', category: 'File', isFavorite: true },
      
      // Playback
      { id: 'fcp_', action: 'Play/Pause', shortcutWin: 'Space', shortcutMac: 'Space', description: 'Play or pause', category: 'Playback', isFavorite: true },
      { id: 'fcp_', action: 'Play Reverse', shortcutWin: ',', shortcutMac: '', description: 'Play in reverse', category: 'Playback', isFavorite: true },
      { id: 'fcp_', action: 'Pause', shortcutWin: ',', shortcutMac: '', description: 'Pause playback', category: 'Playback', isFavorite: true },
      { id: 'fcp_', action: 'Play Forward', shortcutWin: ',', shortcutMac: '', description: 'Play forward', category: 'Playback', isFavorite: true },
      { id: 'fcp_10', action: 'Previous Frame', shortcutWin: 'Left Arrow', shortcutMac: 'Left Arrow', description: 'Go back one frame', category: 'Playback'},
      { id: 'fcp_11', action: 'Next Frame', shortcutWin: 'Right Arrow', shortcutMac: 'Right Arrow', description: 'Go forward one frame', category: 'Playback'},
      { id: 'fcp_12', action: 'Previous Edit', shortcutWin: ',', shortcutMac: '', description: 'Go to previous edit', category: 'Playback'},
      { id: 'fcp_13', action: 'Next Edit', shortcutWin: "',", shortcutMac: "',", description: 'Go to next edit', category: 'Playback'},
      
      // Editing
      { id: 'fcp_14', action: 'Blade Tool', shortcutWin: ',', shortcutMac: '', description: 'Activate blade tool', category: 'Tools', isFavorite: true },
      { id: 'fcp_15', action: 'Select Tool', shortcutWin: ',', shortcutMac: '', description: 'Select tool', category: 'Tools', isFavorite: true },
      { id: 'fcp_16', action: 'Trim Tool', shortcutWin: ',', shortcutMac: '', description: 'Trim tool', category: 'Tools', isFavorite: true },
      { id: 'fcp_17', action: 'Position Tool', shortcutWin: ',', shortcutMac: '', description: 'Position tool', category: 'Tools'},
      { id: 'fcp_18', action: 'Range Tool', shortcutWin: ',', shortcutMac: '', description: 'Range selection tool', category: 'Tools'},
      { id: 'fcp_19', action: 'Hand Tool', shortcutWin: ',', shortcutMac: '', description: 'Hand tool', category: 'Tools'},
      { id: 'fcp_20', action: 'Zoom Tool', shortcutWin: ',', shortcutMac: '', description: 'Zoom tool', category: 'Tools'},
      
      // Timeline Editing
      { id: 'fcp_21', action: 'Connect to Primary Storyline', shortcutWin: ',', shortcutMac: '', description: 'Connect clip to primary storyline', category: 'Editing', isFavorite: true },
      { id: 'fcp_22', action: 'Insert', shortcutWin: ',', shortcutMac: '', description: 'Insert clip', category: 'Editing', isFavorite: true },
      { id: 'fcp_23', action: 'Append', shortcutWin: ',', shortcutMac: '', description: 'Append to end', category: 'Editing', isFavorite: true },
      { id: 'fcp_24', action: 'Overwrite', shortcutWin: ',', shortcutMac: '', description: 'Overwrite clip', category: 'Editing', isFavorite: true },
      { id: 'fcp_25', action: 'Replace', shortcutWin: 'Shift+', shortcutMac: 'Shift+', description: 'Replace clip', category: 'Editing'},
      { id: 'fcp_26', action: 'Lift from Storyline', shortcutWin: 'Shift+Cmd+U', shortcutMac: 'Shift+Cmd+U', description: 'Lift from primary storyline', category: 'Editing'},
      { id: 'fcp_27', action: 'Overwrite to Storyline', shortcutWin: 'Shift+Cmd+Down', shortcutMac: 'Shift+Cmd+Down', description: 'Overwrite to primary storyline', category: 'Editing'},
      
      // Marks
      { id: 'fcp_28', action: 'Set Range Start', shortcutWin: ',', shortcutMac: '', description: 'Set range start', category: 'Marks', isFavorite: true },
      { id: 'fcp_29', action: 'Set Range End', shortcutWin: ',', shortcutMac: '', description: 'Set range end', category: 'Marks', isFavorite: true },
      { id: 'fcp_30', action: 'Add Marker', shortcutWin: ',', shortcutMac: '', description: 'Add marker', category: 'Marks', isFavorite: true },
      { id: 'fcp_31', action: 'Delete Marker', shortcutWin: 'Cmd+', shortcutMac: 'Cmd+', description: 'Delete marker', category: 'Marks'},
      { id: 'fcp_32', action: 'Go to Range Start', shortcutWin: 'Shift+', shortcutMac: 'Shift+', description: 'Go to range start', category: 'Navigation'},
      { id: 'fcp_33', action: 'Go to Range End', shortcutWin: 'Shift+', shortcutMac: 'Shift+', description: 'Go to range end', category: 'Navigation'},
      
      // Timeline Navigation
      { id: 'fcp_34', action: 'Zoom I', shortcutWin: 'Cmd++', shortcutMac: 'Cmd++', description: 'Zoom timeline in', category: 'Timeline'},
      { id: 'fcp_35', action: 'Zoom Out', shortcutWin: 'Cmd+, -', shortcutMac: 'Cmd+, -', description: 'Zoom timeline out', category: 'Timeline'},
      { id: 'fcp_36', action: 'Zoom to Fit', shortcutWin: 'Shift+', shortcutMac: 'Shift+', description: 'Zoom to fit timeline', category: 'Timeline'},
      { id: 'fcp_37', action: 'Zoom to Selection', shortcutWin: 'Shift+Cmd+', shortcutMac: 'Shift+Cmd+', description: 'Zoom to selection', category: 'Timeline'},
      
      // Audio
      { id: 'fcp_38', action: 'Expand Audio', shortcutWin: 'Ctrl+', shortcutMac: 'Ctrl+', description: 'Expand audio components', category: 'Audio'},
      { id: 'fcp_39', action: 'Solo', shortcutWin: 'Option+', shortcutMac: 'Option+', description: 'Solo audio', category: 'Audio'},
      { id: 'fcp_40', action: 'Mute', shortcutWin: 'Shift+', shortcutMac: 'Shift+', description: 'Mute clip', category: 'Audio'},
      
      // Effects & Color
      { id: 'fcp_41', action: 'Effects Browser', shortcutWin: 'Cmd+', shortcutMac: 'Cmd+', description: 'Open effects browser', category: 'Effects'},
      { id: 'fcp_42', action: 'Color Inspector', shortcutWin: 'Cmd+', shortcutMac: 'Cmd+', description: 'Open color inspector', category: 'Color'},
      { id: 'fcp_43', action: 'Video Inspector', shortcutWin: 'Cmd+', shortcutMac: 'Cmd+', description: 'Open video inspector', category: 'Effects'},
      
      // Organization
      { id: 'fcp_44', action: 'Event Browser', shortcutWin: 'Cmd+', shortcutMac: 'Cmd+', description: 'Show event browser', category: 'Organization', isFavorite: true },
      { id: 'fcp_45', action: 'Browser', shortcutWin: 'Cmd+', shortcutMac: 'Cmd+', description: 'Show browser', category: 'Organization'},
      { id: 'fcp_46', action: 'Timeline', shortcutWin: 'Cmd+', shortcutMac: 'Cmd+', description: 'Show timeline', category: 'Organization', isFavorite: true },
      { id: 'fcp_47', action: 'Create Keyword Collection', shortcutWin: 'Cmd+', shortcutMac: 'Cmd+', description: 'Create keyword collection', category: 'Organization'},
      { id: 'fcp_48', action: 'New Compound Clip', shortcutWin: 'Option+', shortcutMac: 'Option+', description: 'Create compound clip', category: 'Organization'},
      
      // Advanced Features (2025)
      { id: 'fcp_49', action: 'Machine Learning Analysis', shortcutWin: 'Cmd+Shift+', shortcutMac: 'Cmd+Shift+', description: ',', category: 'AI Tools', isNew: true },
      { id: 'fcp_50', action: 'Auto Color Balance', shortcutWin: 'Cmd+Shift+', shortcutMac: 'Cmd+Shift+', description: ',', category: 'AI Tools', isNew: true }
    ]
},
  {
    id: 'logic',
    name: 'Logic Pro',
    description: 'Professional music production for Mac',
    icon: LogicLogo,
    color: '#C4C4C4',
    shortcuts: [
      // File & Project
      { id: 'logic_', action: 'New Project', shortcutWin: 'Cmd+', shortcutMac: 'Cmd+', description: 'Create new project', category: 'File', isFavorite: true },
      { id: 'logic_', action: 'Open Project', shortcutWin: 'Cmd+', shortcutMac: 'Cmd+', description: 'Open project', category: 'File'},
      { id: 'logic_', action: 'Save', shortcutWin: 'Cmd+', shortcutMac: 'Cmd+', description: 'Save project', category: 'File', isFavorite: true },
      { id: 'logic_', action: 'Save A', shortcutWin: 'Cmd+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Save project as', category: 'File'},
      { id: 'logic_', action: 'Import Audio', shortcutWin: 'Cmd+', shortcutMac: 'Cmd+', description: 'Import audio files', category: 'File', isFavorite: true },
      { id: 'logic_', action: 'Bounce', shortcutWin: 'Cmd+', shortcutMac: 'Cmd+', description: 'Bounce project', category: 'File', isFavorite: true },
      
      // Transport
      { id: 'logic_', action: 'Play/Stop', shortcutWin: 'Space', shortcutMac: 'Space', description: 'Play or stop', category: 'Transport', isFavorite: true },
      { id: 'logic_', action: 'Pause', shortcutWin: 'Enter', shortcutMac: 'Enter', description: 'Pause playback', category: 'Transport'},
      { id: 'logic_', action: 'Record', shortcutWin: ',', shortcutMac: '', description: 'Start recording', category: 'Transport', isFavorite: true },
      { id: 'logic_10', action: 'Stop and Go to Last Position', shortcutWin: '.', shortcutMac: '.', description: 'Stop and return', category: 'Transport'},
      { id: 'logic_11', action: 'Go to Beginning', shortcutWin: 'Return', shortcutMac: 'Return', description: 'Go to project start', category: 'Transport'},
      { id: 'logic_12', action: 'Rewind', shortcutWin: ',', shortcutMac: '', description: 'Rewind', category: 'Transport'},
      { id: 'logic_13', action: 'Fast Forward', shortcutWin: ', /', shortcutMac: ', /', description: 'Fast forward', category: 'Transport'},
      { id: 'logic_14', action: 'Set Locators by Selection', shortcutWin: 'Cmd+', shortcutMac: 'Cmd+', description: 'Set cycle locators', category: 'Transport'},
      { id: 'logic_15', action: 'Toggle Cycle', shortcutWin: ',', shortcutMac: '', description: 'Toggle cycle mode', category: 'Transport', isFavorite: true },
      
      // Tracks & Arrangement
      { id: 'logic_16', action: 'New Track', shortcutWin: 'Cmd+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Create new track', category: 'Tracks', isFavorite: true },
      { id: 'logic_17', action: 'Delete Track', shortcutWin: 'Cmd+Delete', shortcutMac: 'Cmd+Delete', description: 'Delete selected track', category: 'Tracks'},
      { id: 'logic_18', action: 'Duplicate Track', shortcutWin: 'Cmd+', shortcutMac: 'Cmd+', description: 'Duplicate track', category: 'Tracks'},
      { id: 'logic_19', action: 'Track Stack', shortcutWin: 'Cmd+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Create track stack', category: 'Tracks'},
      { id: 'logic_20', action: 'Solo', shortcutWin: ',', shortcutMac: '', description: 'Solo track', category: 'Tracks', isFavorite: true },
      { id: 'logic_21', action: 'Mute', shortcutWin: ',', shortcutMac: '', description: 'Mute track', category: 'Tracks', isFavorite: true },
      { id: 'logic_22', action: 'Record Enable', shortcutWin: 'Cmd+', shortcutMac: 'Cmd+', description: 'Enable track recording', category: 'Tracks'},
      { id: 'logic_23', action: 'Freeze Track', shortcutWin: 'Cmd+', shortcutMac: 'Cmd+', description: 'Freeze track', category: 'Tracks'},
      
      // Editing
      { id: 'logic_24', action: 'Cut', shortcutWin: 'Cmd+', shortcutMac: 'Cmd+', description: 'Cut selection', category: 'Edit', isFavorite: true },
      { id: 'logic_25', action: 'Copy', shortcutWin: 'Cmd+', shortcutMac: 'Cmd+', description: 'Copy selection', category: 'Edit', isFavorite: true },
      { id: 'logic_26', action: 'Paste', shortcutWin: 'Cmd+', shortcutMac: 'Cmd+', description: 'Paste', category: 'Edit', isFavorite: true },
      { id: 'logic_27', action: 'Split by Playhead', shortcutWin: 'Cmd+', shortcutMac: 'Cmd+', description: 'Split regions at playhead', category: 'Edit', isFavorite: true },
      { id: 'logic_28', action: 'Join Regions', shortcutWin: 'Cmd+', shortcutMac: 'Cmd+', description: 'Join selected regions', category: 'Edit'},
      { id: 'logic_29', action: 'Repeat Regions', shortcutWin: 'Cmd+', shortcutMac: 'Cmd+', description: 'Repeat regions', category: 'Edit'},
      { id: 'logic_30', action: 'Fade Tool', shortcutWin: ',', shortcutMac: '', description: 'Fade tool', category: 'Edit'},
      { id: 'logic_31', action: 'Scissors Tool', shortcutWin: 'Cmd+', shortcutMac: 'Cmd+', description: 'Scissors tool', category: 'Edit', isFavorite: true },
      { id: 'logic_32', action: 'Glue Tool', shortcutWin: 'Cmd+', shortcutMac: 'Cmd+', description: 'Glue tool', category: 'Edit'},
      
      // Windows & Views
      { id: 'logic_33', action: 'Track Area', shortcutWin: 'Cmd+', shortcutMac: 'Cmd+', description: 'Show track area', category: 'Windows', isFavorite: true },
      { id: 'logic_34', action: 'Piano Roll Editor', shortcutWin: 'Cmd+', shortcutMac: 'Cmd+', description: 'Open piano roll', category: 'Windows', isFavorite: true },
      { id: 'logic_35', action: 'Score Editor', shortcutWin: 'Cmd+', shortcutMac: 'Cmd+', description: 'Open score editor', category: 'Windows'},
      { id: 'logic_36', action: 'Audio Editor', shortcutWin: 'Cmd+', shortcutMac: 'Cmd+', description: 'Open audio editor', category: 'Windows'},
      { id: 'logic_37', action: 'Step Editor', shortcutWin: 'Cmd+', shortcutMac: 'Cmd+', description: 'Open step editor', category: 'Windows'},
      { id: 'logic_38', action: 'Environment', shortcutWin: 'Cmd+', shortcutMac: 'Cmd+', description: 'Open environment', category: 'Windows'},
      { id: 'logic_39', action: 'Mixer', shortcutWin: 'Cmd+', shortcutMac: 'Cmd+', description: 'Open mixer', category: 'Windows', isFavorite: true },
      { id: 'logic_40', action: 'Library', shortcutWin: ',', shortcutMac: '', description: 'Toggle library', category: 'Windows', isFavorite: true },
      { id: 'logic_41', action: 'Browser', shortcutWin: ',', shortcutMac: '', description: 'Toggle browser', category: 'Windows'},
      { id: 'logic_42', action: 'Inspector', shortcutWin: ',', shortcutMac: '', description: 'Toggle inspector', category: 'Windows'},
      
      // MIDI Editing
      { id: 'logic_43', action: 'Quantize', shortcutWin: ',', shortcutMac: '', description: 'Quantize MID', category: 'MID', isFavorite: true },
      { id: 'logic_44', action: 'Velocity Tool', shortcutWin: 'Cmd+', shortcutMac: 'Cmd+', description: 'Velocity tool', category: 'MIDI'},
      { id: 'logic_45', action: 'Transform Window', shortcutWin: 'Cmd+', shortcutMac: 'Cmd+', description: 'MIDI transform', category: 'MIDI'},
      { id: 'logic_46', action: 'Note Velocity +', shortcutWin: 'Cmd+U', shortcutMac: 'Cmd+U', description: 'Increase velocity', category: 'MIDI'},
      { id: 'logic_47', action: 'Note Velocity -', shortcutWin: 'Cmd+Down', shortcutMac: 'Cmd+Down', description: 'Decrease velocity', category: 'MIDI'},
      { id: 'logic_48', action: 'Transpose +', shortcutWin: 'Shift+U', shortcutMac: 'Shift+U', description: 'Transpose up semitone', category: 'MIDI'},
      { id: 'logic_49', action: 'Transpose -', shortcutWin: 'Shift+Down', shortcutMac: 'Shift+Down', description: 'Transpose down semitone', category: 'MIDI'},
      
      // Audio Processing
      { id: 'logic_50', action: 'Normalize', shortcutWin: 'Cmd+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Normalize audio', category: 'Audio'},
      { id: 'logic_51', action: 'Reverse', shortcutWin: 'Cmd+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Reverse audio', category: 'Audio'},
      { id: 'logic_52', action: 'Time Stretch', shortcutWin: 'Cmd+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Time stretch', category: 'Audio'},
      { id: 'logic_53', action: 'Pitch Shift', shortcutWin: 'Cmd+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Pitch shift', category: 'Audio'},
      
      // Advanced Features (2025)
      { id: 'logic_54', action: 'Smart Tempo', shortcutWin: 'Cmd+Shift+', shortcutMac: 'Cmd+Shift+', description: ',', category: 'AI Tools', isNew: true },
      { id: 'logic_55', action: 'Auto Drummer A', shortcutWin: 'Cmd+Shift+', shortcutMac: 'Cmd+Shift+', description: ',', category: 'AI Tools', isNew: true }
    ]
},
  {
    id: 'protools',
    name: 'Avid Pro Tools',
    description: 'Industry standard digital audio workstation for professional music production and post-production',
    icon: ProToolsLogo,
    color: '#7B61FF',
    shortcuts: [
      // File Operations & Session Management
      { id: 'pt_', action: 'New Session', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Create new session', category: 'File', isFavorite: true },
      { id: 'pt_', action: 'Open Session', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Open existing session', category: 'File'},
      { id: 'pt_', action: 'Save Session', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Save current session', category: 'File', isFavorite: true },
      { id: 'pt_', action: 'Save Session A', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Save session with new name', category: 'File'},
      { id: 'pt_', action: 'Save Session Copy', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Save session copy in place', category: 'File'},
      { id: 'pt_', action: 'Revert to Saved', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Revert to last saved version', category: 'File'},
      { id: 'pt_', action: 'Close Session', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Close current session', category: 'File'},
      { id: 'pt_', action: 'Import Audio', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Import audio files', category: 'File', isFavorite: true },
      { id: 'pt_', action: 'Import Session Data', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Import session data from another session', category: 'File'},
      { id: 'pt_10', action: 'Import MID', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Import MIDI file', category: 'File'},
      { id: 'pt_11', action: 'Export Selected', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Export selected audio', category: 'File'},
      { id: 'pt_12', action: 'Bounce to Disk', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Bounce mix to disk', category: 'File', isFavorite: true },
      { id: 'pt_13', action: 'Export MID', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Export MIDI data', category: 'File'},
      { id: 'pt_14', action: 'Print to Video', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Print mix to video file', category: 'File'},
      
      // Transport Controls
      { id: 'pt_15', action: 'Play/Stop', shortcutWin: 'Space', shortcutMac: 'Space', description: 'Toggle play/stop', category: 'Transport', isFavorite: true },
      { id: 'pt_16', action: 'Record', shortcutWin: 'Ctrl+Space', shortcutMac: 'Cmd+Space', description: 'Start recording', category: 'Transport', isFavorite: true },
      { id: 'pt_17', action: 'Record Toggle', shortcutWin: 'F1', shortcutMac: 'F1', description: 'Toggle record enable', category: 'Transport'},
      { id: 'pt_18', action: 'Fast Forward', shortcutWin: 'Ctrl+]', shortcutMac: 'Cmd+]', description: 'Fast forward', category: 'Transport'},
      { id: 'pt_19', action: 'Rewind', shortcutWin: 'Ctrl+[', shortcutMac: 'Cmd+[', description: 'Rewind', category: 'Transport'},
      { id: 'pt_20', action: 'Return to Zero', shortcutWin: 'Enter', shortcutMac: 'Enter', description: 'Return to session start', category: 'Transport', isFavorite: true },
      { id: 'pt_21', action: 'Go to End', shortcutWin: 'Ctrl+Return', shortcutMac: 'Cmd+Return', description: 'Go to session end', category: 'Transport'},
      { id: 'pt_22', action: 'Half Speed', shortcutWin: 'Shift+Space', shortcutMac: 'Shift+Space', description: 'Half speed playback', category: 'Transport'},
      { id: 'pt_23', action: 'Play from Edit Point', shortcutWin: 'Alt+Space', shortcutMac: 'Opt+Space', description: 'Play from edit cursor position', category: 'Transport'},
      { id: 'pt_24', action: 'Play to Edit Point', shortcutWin: 'Shift+Alt+Space', shortcutMac: 'Shift+Opt+Space', description: 'Play to edit cursor position', category: 'Transport'},
      { id: 'pt_25', action: 'Loop Playback', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Toggle loop playback', category: 'Transport', isFavorite: true },
      { id: 'pt_26', action: 'Pre-Roll', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Toggle pre-roll', category: 'Transport'},
      { id: 'pt_27', action: 'Post-Roll', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Toggle post-roll', category: 'Transport'},
      { id: 'pt_28', action: 'Online', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Toggle online status', category: 'Transport'},
      
      // Track Operations
      { id: 'pt_29', action: 'New Track', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Create new track', category: 'Tracks', isFavorite: true },
      { id: 'pt_30', action: 'New Audio Track', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Create new audio track', category: 'Tracks'},
      { id: 'pt_31', action: 'New Aux Track', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Create new auxiliary track', category: 'Tracks'},
      { id: 'pt_32', action: 'New MIDI Track', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Create new MIDI track', category: 'Tracks'},
      { id: 'pt_33', action: 'New Instrument Track', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Create new instrument track', category: 'Tracks'},
      { id: 'pt_34', action: 'New Master Fader', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Create master fader track', category: 'Tracks'},
      { id: 'pt_35', action: 'Duplicate Track', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Duplicate selected track', category: 'Tracks'},
      { id: 'pt_36', action: 'Delete Track', shortcutWin: 'Ctrl+Shift+Delete', shortcutMac: 'Cmd+Shift+Delete', description: 'Delete selected track', category: 'Tracks'},
      { id: 'pt_37', action: 'Track Solo', shortcutWin: ',', shortcutMac: '', description: 'Solo selected track', category: 'Tracks', isFavorite: true },
      { id: 'pt_38', action: 'Track Mute', shortcutWin: ',', shortcutMac: '', description: 'Mute selected track', category: 'Tracks', isFavorite: true },
      { id: 'pt_39', action: 'Record Enable', shortcutWin: ',', shortcutMac: '', description: 'Record enable track', category: 'Tracks', isFavorite: true },
      { id: 'pt_40', action: 'Input Monitor', shortcutWin: ',', shortcutMac: '', description: 'Toggle input monitoring', category: 'Tracks'},
      { id: 'pt_41', action: 'Track Height Small', shortcutWin: 'Ctrl+Alt+Down', shortcutMac: 'Cmd+Opt+Down', description: 'Set track height to small', category: 'Tracks'},
      { id: 'pt_42', action: 'Track Height Medium', shortcutWin: 'Ctrl+Alt+U', shortcutMac: 'Cmd+Opt+U', description: 'Set track height to medium', category: 'Tracks'},
      { id: 'pt_43', action: 'Track Height Large', shortcutWin: 'Ctrl+Alt+Shift+U', shortcutMac: 'Cmd+Opt+Shift+U', description: 'Set track height to large', category: 'Tracks'},
      { id: 'pt_44', action: 'Show All Tracks', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Show all tracks', category: 'Tracks'},
      { id: 'pt_45', action: 'Hide Track', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Hide selected track', category: 'Tracks'},
      { id: 'pt_46', action: 'Make Inactive', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Make track inactive', category: 'Tracks'},
      
      // Editing Tools & Operations
      { id: 'pt_47', action: 'Trim Tool', shortcutWin: 'F', shortcutMac: 'F', description: 'Activate trim tool', category: 'Tools', isFavorite: true },
      { id: 'pt_48', action: 'Selector Tool', shortcutWin: 'F', shortcutMac: 'F', description: 'Activate selector tool', category: 'Tools', isFavorite: true },
      { id: 'pt_49', action: 'Grabber Tool', shortcutWin: 'F', shortcutMac: 'F', description: 'Activate grabber tool', category: 'Tools', isFavorite: true },
      { id: 'pt_50', action: 'Scrubber Tool', shortcutWin: 'F', shortcutMac: 'F', description: 'Activate scrubber tool', category: 'Tools'},
      { id: 'pt_51', action: 'Pencil Tool', shortcutWin: 'F1', shortcutMac: 'F1', description: 'Activate pencil tool', category: 'Tools'},
      { id: 'pt_52', action: 'Smart Tool', shortcutWin: 'F6+F', shortcutMac: 'F6+F', description: ',', category: 'Tools', isFavorite: true },
      { id: 'pt_53', action: 'Zoom Tool', shortcutWin: 'F', shortcutMac: 'F', description: 'Activate zoom tool', category: 'Tools'},
      { id: 'pt_54', action: 'Cut', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Cut selection', category: 'Edit', isFavorite: true },
      { id: 'pt_55', action: 'Copy', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Copy selection', category: 'Edit', isFavorite: true },
      { id: 'pt_56', action: 'Paste', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Paste at cursor position', category: 'Edit', isFavorite: true },
      { id: 'pt_57', action: 'Clear', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Clear selection', category: 'Edit'},
      { id: 'pt_58', action: 'Duplicate', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Duplicate selection', category: 'Edit', isFavorite: true },
      { id: 'pt_59', action: 'Repeat', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Repeat last operation', category: 'Edit'},
      { id: 'pt_60', action: 'Separate Region', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Separate region at cursor', category: 'Edit', isFavorite: true },
      { id: 'pt_61', action: 'Heal Separation', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Heal region separation', category: 'Edit'},
      { id: 'pt_62', action: 'Trim to Selection', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Trim region to selection', category: 'Edit'},
      { id: 'pt_63', action: 'TCE Edit to Timeline', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Commit TCE edit to timeline', category: 'Edit'},
      { id: 'pt_64', action: 'Consolidate', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Consolidate selection', category: 'Edit'},
      
      // Selection & Navigation
      { id: 'pt_65', action: 'Select All', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Select all regions', category: 'Selection'},
      { id: 'pt_66', action: 'Select All on Track', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Select all regions on track', category: 'Selection'},
      { id: 'pt_67', action: 'Extend Selection Left', shortcutWin: 'Shift+Left', shortcutMac: 'Shift+Left', description: 'Extend selection to the left', category: 'Selection'},
      { id: 'pt_68', action: 'Extend Selection Right', shortcutWin: 'Shift+Right', shortcutMac: 'Shift+Right', description: 'Extend selection to the right', category: 'Selection'},
      { id: 'pt_69', action: 'Move Cursor Left', shortcutWin: 'Left', shortcutMac: 'Left', description: 'Move cursor to the left', category: 'Navigation'},
      { id: 'pt_70', action: 'Move Cursor Right', shortcutWin: 'Right', shortcutMac: 'Right', description: 'Move cursor to the right', category: 'Navigation'},
      { id: 'pt_71', action: 'Next Edit', shortcutWin: 'Tab', shortcutMac: 'Tab', description: 'Go to next edit point', category: 'Navigation', isFavorite: true },
      { id: 'pt_72', action: 'Previous Edit', shortcutWin: 'Shift+Tab', shortcutMac: 'Shift+Tab', description: 'Go to previous edit point', category: 'Navigation', isFavorite: true },
      { id: 'pt_73', action: 'Next Region', shortcutWin: 'Ctrl+Tab', shortcutMac: 'Cmd+Tab', description: 'Select next region', category: 'Navigation'},
      { id: 'pt_74', action: 'Previous Region', shortcutWin: 'Ctrl+Shift+Tab', shortcutMac: 'Cmd+Shift+Tab', description: 'Select previous region', category: 'Navigation'},
      { id: 'pt_75', action: 'Next Track', shortcutWin: 'Down', shortcutMac: 'Down', description: 'Move to next track', category: 'Navigation'},
      { id: 'pt_76', action: 'Previous Track', shortcutWin: 'U', shortcutMac: 'U', description: 'Move to previous track', category: 'Navigation'},
      
      // Windows & Views
      { id: 'pt_77', action: 'Edit Window', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Show edit window', category: 'Windows', isFavorite: true },
      { id: 'pt_78', action: 'Mix Window', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Show mix window', category: 'Windows', isFavorite: true },
      { id: 'pt_79', action: 'MIDI Editor', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Show MIDI editor window', category: 'Windows', isFavorite: true },
      { id: 'pt_80', action: 'Score Editor', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Show score editor window', category: 'Windows'},
      { id: 'pt_81', action: 'Transport Window', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Show transport window', category: 'Windows'},
      { id: 'pt_82', action: 'Big Counter', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Show big counter window', category: 'Windows'},
      { id: 'pt_83', action: 'Task Manager', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Show task manager window', category: 'Windows'},
      { id: 'pt_84', action: 'Workspace Browser', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Show workspace browser', category: 'Windows'},
      { id: 'pt_85', action: 'Project Browser', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Show project browser', category: 'Windows'},
      { id: 'pt_86', action: 'Plug-ins Window', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Show plug-ins window', category: 'Windows'},
      { id: 'pt_87', action: 'Memory Locations', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Memory locations window', category: 'Windows'},
      { id: 'pt_88', action: 'Machine Control', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Machine control window', category: 'Windows'},
      { id: 'pt_89', action: 'MIDI Event List', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'MIDI event list window', category: 'Windows'},
      { id: 'pt_90', action: 'Tempo Operations', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Tempo operations window', category: 'Windows'},
      
      // Audio Processing & Effects
      { id: 'pt_91', action: 'AudioSuite', shortcutWin: 'Ctrl+Shift+Alt+', shortcutMac: 'Cmd+Shift+Opt+', description: 'Open AudioSuite menu', category: 'Audio'},
      { id: 'pt_92', action: 'Elastic Audio', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Toggle Elastic Audio analysis', category: 'Audio'},
      { id: 'pt_93', action: 'Real-Time Properties', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Real-time properties window', category: 'Audio'},
      { id: 'pt_94', action: 'Strip Silence', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Strip silence dialog', category: 'Audio'},
      { id: 'pt_95', action: 'Time Compression/Expansion', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Time compression/expansion dialog', category: 'Audio'},
      { id: 'pt_96', action: 'Pitch Shift', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Pitch shift dialog', category: 'Audio'},
      { id: 'pt_97', action: 'Reverse', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Reverse audio selection', category: 'Audio'},
      { id: 'pt_98', action: 'Normalize', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Normalize audio selection', category: 'Audio'},
      { id: 'pt_99', action: 'Gain', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Apply gain to selection', category: 'Audio'},
      { id: 'pt_100', action: 'DC Offset Removal', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Remove DC offset', category: 'Audio'},
      { id: 'pt_101', action: 'Invert', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Invert audio polarity', category: 'Audio'},
      { id: 'pt_102', action: 'Fade I', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Create fade in', category: 'Audio'},
      { id: 'pt_103', action: 'Fade Out', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Create fade out', category: 'Audio'},
      { id: 'pt_104', action: 'Crossfade', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Create crossfade', category: 'Audio'},
      
      // MIDI Operations
      { id: 'pt_105', action: 'MIDI Real-Time Properties', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'MIDI real-time properties', category: 'MIDI'},
      { id: 'pt_106', action: 'Change Velocity', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Change MIDI note velocity', category: 'MIDI'},
      { id: 'pt_107', action: 'Change Duration', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Change MIDI note duration', category: 'MIDI'},
      { id: 'pt_108', action: 'Transpose', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Transpose MIDI notes', category: 'MIDI'},
      { id: 'pt_109', action: 'Select/Split Notes', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Select or split MIDI notes', category: 'MIDI'},
      { id: 'pt_110', action: 'Input Quantize', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Input quantize settings', category: 'MIDI'},
      { id: 'pt_111', action: 'Grid/Groove Quantize', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Grid or groove quantize', category: 'MIDI'},
      { id: 'pt_112', action: 'Restore Performance', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Restore MIDI performance', category: 'MIDI'},
      { id: 'pt_113', action: 'Flatten Performance', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Flatten MIDI performance', category: 'MIDI'},
      { id: 'pt_114', action: 'Step Input', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'MIDI step input mode', category: 'MIDI'},
      
      // Automation
      { id: 'pt_115', action: 'Automation Safe', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Toggle automation safe mode', category: 'Automation'},
      { id: 'pt_116', action: 'Write Enable', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Enable automation writing', category: 'Automation'},
      { id: 'pt_117', action: 'Touch/Latch', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Toggle touch/latch automation', category: 'Automation'},
      { id: 'pt_118', action: 'Trim Mode', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Automation trim mode', category: 'Automation'},
      { id: 'pt_119', action: 'Suspend', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Suspend automation', category: 'Automation'},
      
      // Zoom & Display
      { id: 'pt_120', action: 'Zoom I', shortcutWin: ',', shortcutMac: '', description: 'Zoom in horizontally', category: 'Zoom'},
      { id: 'pt_121', action: 'Zoom Out', shortcutWin: ',', shortcutMac: '', description: 'Zoom out horizontally', category: 'Zoom'},
      { id: 'pt_122', action: 'Zoom Toggle', shortcutWin: ',', shortcutMac: '', description: 'Toggle between zoom levels', category: 'Zoom'},
      { id: 'pt_123', action: 'Fit to Window', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Fit session content to window', category: 'Zoom'},
      { id: 'pt_124', action: 'Fit Selection', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Fit selection to window', category: 'Zoom'},
      { id: 'pt_125', action: 'Zoom Preset 1', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Recall zoom preset 1', category: 'Zoom'},
      { id: 'pt_126', action: 'Zoom Preset 2', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Recall zoom preset 2', category: 'Zoom'},
      { id: 'pt_127', action: 'Zoom Preset 3', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Recall zoom preset 3', category: 'Zoom'},
      { id: 'pt_128', action: 'Zoom Preset 4', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Recall zoom preset 4', category: 'Zoom'},
      { id: 'pt_129', action: 'Zoom Preset 5', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Recall zoom preset 5', category: 'Zoom'},
      { id: 'pt_130', action: 'Vertical Zoom I', shortcutWin: 'Ctrl+Alt+]', shortcutMac: 'Cmd+Opt+]', description: 'Zoom in vertically', category: 'Zoom'},
      { id: 'pt_131', action: 'Vertical Zoom Out', shortcutWin: 'Ctrl+Alt+[', shortcutMac: 'Cmd+Opt+[', description: 'Zoom out vertically', category: 'Zoom'},
      
      // Memory Locations & Markers
      { id: 'pt_132', action: 'Memory Location 1', shortcutWin: 'Keypad 1', shortcutMac: 'Keypad 1', description: 'Recall memory location 1', category: 'Memory'},
      { id: 'pt_133', action: 'Memory Location 2', shortcutWin: 'Keypad 2', shortcutMac: 'Keypad 2', description: 'Recall memory location 2', category: 'Memory'},
      { id: 'pt_134', action: 'Memory Location 3', shortcutWin: 'Keypad 3', shortcutMac: 'Keypad 3', description: 'Recall memory location 3', category: 'Memory'},
      { id: 'pt_135', action: 'Memory Location 4', shortcutWin: 'Keypad 4', shortcutMac: 'Keypad 4', description: 'Recall memory location 4', category: 'Memory'},
      { id: 'pt_136', action: 'Memory Location 5', shortcutWin: 'Keypad 5', shortcutMac: 'Keypad 5', description: 'Recall memory location 5', category: 'Memory'},
      { id: 'pt_137', action: 'Store Memory Location', shortcutWin: 'Enter (Keypad, )', shortcutMac: 'Enter (Keypad, )', description: 'Store current position as memory location', category: 'Memory'},
      { id: 'pt_138', action: 'Next Marker', shortcutWin: 'Ctrl+Right', shortcutMac: 'Cmd+Right', description: 'Go to next marker', category: 'Memory'},
      { id: 'pt_139', action: 'Previous Marker', shortcutWin: 'Ctrl+Left', shortcutMac: 'Cmd+Left', description: 'Go to previous marker', category: 'Memory'},
      { id: 'pt_140', action: 'Add Marker', shortcutWin: 'Keypad , +', shortcutMac: 'Keypad , +', description: 'Add marker at current position', category: 'Memory'},
      { id: 'pt_141', action: 'Delete Marker', shortcutWin: 'Keypad , -', shortcutMac: 'Keypad , -', description: 'Delete marker at current position', category: 'Memory'},
      
      // Advanced Pro Tools Features (2025)
      { id: 'pt_142', action: 'Pro Tools Carbon', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: ',', category: 'Advanced', isNew: true },
      { id: 'pt_143', action: 'Dolby Atmos Renderer', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: ',', category: 'Advanced', isNew: true },
      { id: 'pt_144', action: 'AI Audio Analysis', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: ',', category: 'AI Tools', isNew: true },
      { id: 'pt_145', action: 'Smart Fade Assistant', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: ',', category: 'AI Tools', isNew: true },
      { id: 'pt_146', action: 'Auto Dialogue Replacement', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: ',', category: 'AI Tools', isNew: true },
      { id: 'pt_147', action: 'Neural DSP Integration', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: ',', category: 'AI Tools', isNew: true },
      { id: 'pt_148', action: 'Cloud Collaboration', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: ',', category: 'Advanced', isNew: true },
      { id: 'pt_149', action: 'HDX Performance Monitor', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: ',', category: 'Advanced', isNew: true },
      { id: 'pt_150', action: 'VENUE Integration', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: ',', category: 'Advanced', isNew: true }
    ]
},
  {
    id: 'cubase',
    name: 'Steinberg Cubase',
    description: 'Complete music production suite',
    icon: MusicNote,
    color: '#FF6B35',

    shortcuts: [
      // File Management
      { id: 'cb_', action: 'New Project', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Create new project', category: 'File', isFavorite: true },
      { id: 'cb_', action: 'Open Project', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Open project', category: 'File'},
      { id: 'cb_', action: 'Save', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Save project', category: 'File', isFavorite: true },
      { id: 'cb_', action: 'Save A', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Save project as', category: 'File'},
      { id: 'cb_', action: 'Import Audio', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Import audio file', category: 'File', isFavorite: true },
      { id: 'cb_', action: 'Export Audio Mixdown', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Export audio mixdown', category: 'File', isFavorite: true },
      
      // Transport
      { id: 'cb_', action: 'Play/Stop', shortcutWin: 'Space', shortcutMac: 'Space', description: 'Play or stop', category: 'Transport', isFavorite: true },
      { id: 'cb_', action: 'Record', shortcutWin: ', *', shortcutMac: ', *', description: 'Start recording', category: 'Transport', isFavorite: true },
      { id: 'cb_', action: 'Stop', shortcutWin: ',', shortcutMac: '', description: 'Stop playback', category: 'Transport'},
      { id: 'cb_10', action: 'Return to Zero', shortcutWin: '.', shortcutMac: '.', description: 'Return to start', category: 'Transport'},
      { id: 'cb_11', action: 'Cycle', shortcutWin: ', /', shortcutMac: ', /', description: 'Toggle cycle mode', category: 'Transport', isFavorite: true },
      { id: 'cb_12', action: 'Metronome', shortcutWin: ',', shortcutMac: '', description: 'Toggle metronome', category: 'Transport'},
      
      // Track Operations
      { id: 'cb_13', action: 'Add Track', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Add new track', category: 'Tracks', isFavorite: true },
      { id: 'cb_14', action: 'Duplicate Track', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Duplicate track', category: 'Tracks'},
      { id: 'cb_15', action: 'Delete Track', shortcutWin: 'Delete', shortcutMac: 'Delete', description: 'Delete selected track', category: 'Tracks'},
      { id: 'cb_16', action: 'Solo', shortcutWin: ',', shortcutMac: '', description: 'Solo track', category: 'Tracks', isFavorite: true },
      { id: 'cb_17', action: 'Mute', shortcutWin: ',', shortcutMac: '', description: 'Mute track', category: 'Tracks', isFavorite: true },
      { id: 'cb_18', action: 'Record Enable', shortcutWin: ',', shortcutMac: '', description: 'Record enable track', category: 'Tracks'},
      { id: 'cb_19', action: 'Monitor', shortcutWin: 'Shift+', shortcutMac: 'Shift+', description: 'Toggle monitoring', category: 'Tracks'},
      
      // Editing
      { id: 'cb_20', action: 'Cut', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Cut selection', category: 'Edit', isFavorite: true },
      { id: 'cb_21', action: 'Copy', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Copy selection', category: 'Edit', isFavorite: true },
      { id: 'cb_22', action: 'Paste', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Paste', category: 'Edit', isFavorite: true },
      { id: 'cb_23', action: 'Split at Cursor', shortcutWin: 'Alt+', shortcutMac: 'Opt+', description: 'Split at cursor', category: 'Edit', isFavorite: true },
      { id: 'cb_24', action: 'Glue', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Glue events', category: 'Edit'},
      { id: 'cb_25', action: 'Quantize', shortcutWin: ',', shortcutMac: '', description: 'Quantize MID', category: 'Edit', isFavorite: true },
      { id: 'cb_26', action: 'Repeat', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Repeat selection', category: 'Edit'},
      
      // Windows & Editors
      { id: 'cb_27', action: 'Project Window', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Project window', category: 'Windows', isFavorite: true },
      { id: 'cb_28', action: 'MixConsole', shortcutWin: 'F', shortcutMac: 'F', description: 'Open MixConsole', category: 'Windows', isFavorite: true },
      { id: 'cb_29', action: 'Key Editor', shortcutWin: 'Ctrl+Enter', shortcutMac: 'Cmd+Return', description: 'Open key editor', category: 'Windows', isFavorite: true },
      { id: 'cb_30', action: 'Audio Editor', shortcutWin: 'Ctrl+Shift+Enter', shortcutMac: 'Cmd+Shift+Return', description: 'Open audio editor', category: 'Windows'},
      { id: 'cb_31', action: 'Drum Editor', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Open drum editor', category: 'Windows'},
      { id: 'cb_32', action: 'Score Editor', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Open score editor', category: 'Windows'},
      { id: 'cb_33', action: 'MediaBay', shortcutWin: 'F', shortcutMac: 'F', description: 'Open MediaBay', category: 'Windows'},
      { id: 'cb_34', action: 'VST Instruments', shortcutWin: 'F1', shortcutMac: 'F1', description: 'VST instruments window', category: 'Windows'},
      
      // MIDI Features
      { id: 'cb_35', action: 'Transpose', shortcutWin: 'Shift+', shortcutMac: 'Shift+', description: 'Transpose MID', category: 'MIDI'},
      { id: 'cb_36', action: 'Velocity', shortcutWin: 'Shift+', shortcutMac: 'Shift+', description: 'Velocity editor', category: 'MIDI'},
      { id: 'cb_37', action: 'Logical Editor', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'MIDI logical editor', category: 'MIDI'},
      
      // Advanced Features (2025)
      { id: 'cb_38', action: 'Spectral Layers Integration', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: ',', category: 'AI Tools', isNew: true },
      { id: 'cb_39', action: 'Auto Composition', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: ',', category: 'AI Tools', isNew: true }
    ]
},
  {
    id: 'ableton',
    name: 'Ableton Live',
    description: 'Live performance and production',
    icon: MusicNote,
    color: '#FF8C00',
    shortcuts: [
      // File Operations
      { id: 'ab_', action: 'New Live Set', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Create new live set', category: 'File', isFavorite: true },
      { id: 'ab_', action: 'Open Live Set', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Open live set', category: 'File'},
      { id: 'ab_', action: 'Save Live Set', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Save live set', category: 'File', isFavorite: true },
      { id: 'ab_', action: 'Save Live Set A', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Save live set as', category: 'File'},
      { id: 'ab_', action: 'Export Audio/Video', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Export audio/video', category: 'File', isFavorite: true },
      
      // Transport
      { id: 'ab_', action: 'Play/Stop', shortcutWin: 'Space', shortcutMac: 'Space', description: 'Play or stop', category: 'Transport', isFavorite: true },
      { id: 'ab_', action: 'Record', shortcutWin: 'F', shortcutMac: 'F', description: 'Start recording', category: 'Transport', isFavorite: true },
      { id: 'ab_', action: 'Tap Tempo', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Tap tempo', category: 'Transport'},
      { id: 'ab_', action: 'Continue Playback', shortcutWin: 'F1', shortcutMac: 'F1', description: 'Continue playback', category: 'Transport'},
      { id: 'ab_10', action: 'New', shortcutWin: 'F1', shortcutMac: 'F1', description: 'Create new from stop', category: 'Transport'},
      
      // View Controls
      { id: 'ab_11', action: 'Session View', shortcutWin: 'F1', shortcutMac: 'F1', description: 'Switch to session view', category: 'Views', isFavorite: true },
      { id: 'ab_12', action: 'Arrangement View', shortcutWin: 'F1', shortcutMac: 'F1', description: 'Switch to arrangement view', category: 'Views', isFavorite: true },
      { id: 'ab_13', action: 'Detail View', shortcutWin: 'Shift+Tab', shortcutMac: 'Shift+Tab', description: 'Toggle detail view', category: 'Views'},
      { id: 'ab_14', action: 'Browser', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Toggle browser', category: 'Views', isFavorite: true },
      { id: 'ab_15', action: 'Info View', shortcutWin: 'Shift+, ?', shortcutMac: 'Shift+, ?', description: 'Toggle info view', category: 'Views'},
      
      // Track Operations
      { id: 'ab_16', action: 'Insert Audio Track', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Insert audio track', category: 'Tracks', isFavorite: true },
      { id: 'ab_17', action: 'Insert MIDI Track', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Insert MIDI track', category: 'Tracks', isFavorite: true },
      { id: 'ab_18', action: 'Insert Return Track', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Insert return track', category: 'Tracks'},
      { id: 'ab_19', action: 'Group Tracks', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Group selected tracks', category: 'Tracks'},
      { id: 'ab_20', action: 'Ungroup Tracks', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Ungroup tracks', category: 'Tracks'},
      { id: 'ab_21', action: 'Delete Track', shortcutWin: 'Ctrl+Delete', shortcutMac: 'Cmd+Delete', description: 'Delete track', category: 'Tracks'},
      
      // Clip Operations
      { id: 'ab_22', action: 'Duplicate Clip', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Duplicate clip', category: 'Clips', isFavorite: true },
      { id: 'ab_23', action: 'Delete Clip', shortcutWin: 'Delete', shortcutMac: 'Delete', description: 'Delete clip', category: 'Clips'},
      { id: 'ab_24', action: 'Consolidate Clip', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Consolidate clip', category: 'Clips'},
      { id: 'ab_25', action: 'Reverse Clip', shortcutWin: ',', shortcutMac: '', description: 'Reverse audio clip', category: 'Clips'},
      { id: 'ab_26', action: 'Warp Clip', shortcutWin: ',', shortcutMac: '', description: 'Toggle warp', category: 'Clips'},
      { id: 'ab_27', action: 'Quantize', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Quantize MID', category: 'Clips', isFavorite: true },
      
      // Device Operations
      { id: 'ab_28', action: 'Group Device', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Group devices', category: 'Devices'},
      { id: 'ab_29', action: 'Ungroup Device', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Ungroup devices', category: 'Devices'},
      { id: 'ab_30', action: 'Enable/Disable Device', shortcutWin: ',', shortcutMac: '', description: 'Enable/disable device', category: 'Devices'},
      
      // Loop & Automation
      { id: 'ab_31', action: 'Set Loop', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Set loop brace', category: 'Loop'},
      { id: 'ab_32', action: 'Toggle Loop', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: 'Toggle loop', category: 'Loop', isFavorite: true },
      { id: 'ab_33', action: 'Automation Arm', shortcutWin: ',', shortcutMac: '', description: 'Automation arm', category: 'Automation', isFavorite: true },
      { id: 'ab_34', action: 'Re-enable Automation', shortcutWin: 'Shift+', shortcutMac: 'Shift+', description: 'Re-enable automation', category: 'Automation'},
      
      // Advanced Features (2025)
      { id: 'ab_35', action: 'Operator 2.0 A', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: ',', category: 'AI Tools', isNew: true },
      { id: 'ab_36', action: 'Live Looping A', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: ',', category: 'AI Tools', isNew: true }
    ]
},
  {
    id: 'mediacomposer',
    name: 'Avid Media Composer',
    description: 'Industry standard professional video editing and post-production system',
    icon: MediaComposerLogo,
    color: '#FF2D92',
    shortcuts: [
      // File Operations & Project Management
      { id: 'mc_', action: 'New Project', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Create new project', category: 'File', isFavorite: true },
      { id: 'mc_', action: 'Open Bin', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Open bin', category: 'File'},
      { id: 'mc_', action: 'Save', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Save project', category: 'File', isFavorite: true },
      { id: 'mc_', action: 'Import', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Import media', category: 'File', isFavorite: true },
      { id: 'mc_', action: 'Output', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Output to tape/file', category: 'File', isFavorite: true },
      { id: 'mc_', action: 'Batch Capture', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Batch capture', category: 'File'},
      { id: 'mc_', action: 'Media Tool', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Open Media Tool', category: 'File'},
      { id: 'mc_', action: 'Send T', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: 'Send to Avid products', category: 'File'},
      
      // Transport Controls & Playback
      { id: 'mc_', action: 'Play/Pause', shortcutWin: 'Space', shortcutMac: 'Space', description: 'Play or pause', category: 'Transport', isFavorite: true },
      { id: 'mc_10', action: 'Play Reverse', shortcutWin: ',', shortcutMac: '', description: 'Play in reverse', category: 'Transport', isFavorite: true },
      { id: 'mc_11', action: 'Pause', shortcutWin: ',', shortcutMac: '', description: 'Pause playback', category: 'Transport', isFavorite: true },
      { id: 'mc_12', action: 'Play Forward', shortcutWin: ',', shortcutMac: '', description: 'Play forward', category: 'Transport', isFavorite: true },
      { id: 'mc_13', action: 'Step Forward 1 Frame', shortcutWin: 'Right Arrow', shortcutMac: 'Right Arrow', description: 'Step forward one frame', category: 'Transport'},
      { id: 'mc_14', action: 'Step Back 1 Frame', shortcutWin: 'Left Arrow', shortcutMac: 'Left Arrow', description: 'Step back one frame', category: 'Transport'},
      { id: 'mc_15', action: 'Step Forward 10 Frames', shortcutWin: 'Shift+Right', shortcutMac: 'Shift+Right', description: 'Step forward 10 frames', category: 'Transport'},
      { id: 'mc_16', action: 'Step Back 10 Frames', shortcutWin: 'Shift+Left', shortcutMac: 'Shift+Left', description: 'Step back 10 frames', category: 'Transport'},
      { id: 'mc_17', action: 'Go to Start', shortcutWin: 'Home', shortcutMac: 'Home', description: 'Go to start of sequence', category: 'Transport'},
      { id: 'mc_18', action: 'Go to End', shortcutWin: 'End', shortcutMac: 'End', description: 'Go to end of sequence', category: 'Transport'},
      { id: 'mc_19', action: 'Mark I', shortcutWin: ',', shortcutMac: '', description: 'Mark in point', category: 'Transport', isFavorite: true },
      { id: 'mc_20', action: 'Mark Out', shortcutWin: ',', shortcutMac: '', description: 'Mark out point', category: 'Transport', isFavorite: true },
      { id: 'mc_21', action: 'Clear I', shortcutWin: 'Shift+', shortcutMac: 'Shift+', description: 'Clear in point', category: 'Transport'},
      { id: 'mc_22', action: 'Clear Out', shortcutWin: 'Shift+', shortcutMac: 'Shift+', description: 'Clear out point', category: 'Transport'},
      { id: 'mc_23', action: 'Clear In and Out', shortcutWin: 'Shift+', shortcutMac: 'Shift+', description: 'Clear both in and out points', category: 'Transport'},
      { id: 'mc_24', action: 'Go to I', shortcutWin: ',', shortcutMac: '', description: 'Go to in point', category: 'Transport'},
      { id: 'mc_25', action: 'Go to Out', shortcutWin: ',', shortcutMac: '', description: 'Go to out point', category: 'Transport'},
      
      // Editing & Splicing
      { id: 'mc_26', action: 'Splice-I', shortcutWin: ',', shortcutMac: '', description: 'Splice segment into timeline', category: 'Editing', isFavorite: true },
      { id: 'mc_27', action: 'Overwrite', shortcutWin: ',', shortcutMac: '', description: 'Overwrite segment in timeline', category: 'Editing', isFavorite: true },
      { id: 'mc_28', action: 'Replace', shortcutWin: ',', shortcutMac: '', description: 'Replace segment', category: 'Editing', isFavorite: true },
      { id: 'mc_29', action: 'Extract', shortcutWin: ',', shortcutMac: '', description: 'Extract segment', category: 'Editing', isFavorite: true },
      { id: 'mc_30', action: 'Lift', shortcutWin: ',', shortcutMac: '', description: 'Lift segment', category: 'Editing', isFavorite: true },
      { id: 'mc_31', action: 'Match Frame', shortcutWin: ',', shortcutMac: '', description: 'Match frame in source', category: 'Editing', isFavorite: true },
      { id: 'mc_32', action: 'Find Bin', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Find bin for clip', category: 'Editing'},
      { id: 'mc_33', action: 'Reverse Match Frame', shortcutWin: 'Shift+', shortcutMac: 'Shift+', description: 'Reverse match frame', category: 'Editing'},
      { id: 'mc_34', action: 'Add Edit', shortcutWin: ',', shortcutMac: '', description: 'Add edit at position indicator', category: 'Editing', isFavorite: true },
      { id: 'mc_35', action: 'Extend Edit', shortcutWin: ',', shortcutMac: '', description: 'Extend edit to position indicator', category: 'Editing'},
      
      // Timeline Navigation & Selection
      { id: 'mc_36', action: 'Track Forward', shortcutWin: 'Down Arrow', shortcutMac: 'Down Arrow', description: 'Move to track below', category: 'Navigation'},
      { id: 'mc_37', action: 'Track Backward', shortcutWin: 'Up Arrow', shortcutMac: 'Up Arrow', description: 'Move to track above', category: 'Navigation'},
      { id: 'mc_38', action: 'Next Edit', shortcutWin: 'Page Down', shortcutMac: 'Page Down', description: 'Go to next edit', category: 'Navigation'},
      { id: 'mc_39', action: 'Previous Edit', shortcutWin: 'Page U', shortcutMac: 'Page U', description: 'Go to previous edit', category: 'Navigation'},
      { id: 'mc_40', action: 'Select All', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Select all segments', category: 'Selection'},
      { id: 'mc_41', action: 'Deselect All', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Deselect all segments', category: 'Selection'},
      { id: 'mc_42', action: 'Select In to Out', shortcutWin: ',', shortcutMac: '', description: 'Select from in to out', category: 'Selection'},
      { id: 'mc_43', action: 'Select Left', shortcutWin: 'Shift+Page U', shortcutMac: 'Shift+Page U', description: 'Select to left of position', category: 'Selection'},
      { id: 'mc_44', action: 'Select Right', shortcutWin: 'Shift+Page Down', shortcutMac: 'Shift+Page Down', description: 'Select to right of position', category: 'Selection'},
      
      // Trimming & Fine Editing
      { id: 'mc_45', action: 'Trim Mode', shortcutWin: ',', shortcutMac: '', description: 'Enter trim mode', category: 'Trimming', isFavorite: true },
      { id: 'mc_46', action: 'Trim +1 Frame', shortcutWin: ']', shortcutMac: ']', description: 'Trim head +1 frame', category: 'Trimming'},
      { id: 'mc_47', action: 'Trim -1 Frame', shortcutWin: '[', shortcutMac: '[', description: 'Trim head -1 frame', category: 'Trimming'},
      { id: 'mc_48', action: 'Trim +5 Frames', shortcutWin: 'Shift+]', shortcutMac: 'Shift+]', description: 'Trim head +5 frames', category: 'Trimming'},
      { id: 'mc_49', action: 'Trim -5 Frames', shortcutWin: 'Shift+[', shortcutMac: 'Shift+[', description: 'Trim head -5 frames', category: 'Trimming'},
      { id: 'mc_50', action: 'Slip +1 Frame', shortcutWin: 'Alt+]', shortcutMac: 'Opt+]', description: 'Slip segment +1 frame', category: 'Trimming'},
      { id: 'mc_51', action: 'Slip -1 Frame', shortcutWin: 'Alt+[', shortcutMac: 'Opt+[', description: 'Slip segment -1 frame', category: 'Trimming'},
      { id: 'mc_52', action: 'Slide +1 Frame', shortcutWin: 'Alt+Shift+]', shortcutMac: 'Opt+Shift+]', description: 'Slide segment +1 frame', category: 'Trimming'},
      { id: 'mc_53', action: 'Slide -1 Frame', shortcutWin: 'Alt+Shift+[', shortcutMac: 'Opt+Shift+[', description: 'Slide segment -1 frame', category: 'Trimming'},
      
      // Audio Operations
      { id: 'mc_54', action: 'Audio Mixdown', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Audio mixdown', category: 'Audio'},
      { id: 'mc_55', action: 'Audio Punch-I', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Audio punch-in', category: 'Audio'},
      { id: 'mc_56', action: 'Audio Tool', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Open Audio Tool', category: 'Audio', isFavorite: true },
      { id: 'mc_57', action: 'Audio EQ Tool', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Open Audio EQ Tool', category: 'Audio'},
      
      // Effects & Color Correction
      { id: 'mc_58', action: 'Color Correction', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Open Color Correction', category: 'Effects', isFavorite: true },
      { id: 'mc_59', action: 'Effect Editor', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Open Effect Editor', category: 'Effects', isFavorite: true },
      { id: 'mc_60', action: 'Apply Effect', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Apply selected effect', category: 'Effects'},
      { id: 'mc_61', action: 'Remove Effect', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Remove selected effect', category: 'Effects'},
      
      // Window Management
      { id: 'mc_62', action: 'New Bin', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Create new bin', category: 'Windows', isFavorite: true },
      { id: 'mc_63', action: 'Composer Window', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Open Composer window', category: 'Windows'},
      { id: 'mc_64', action: 'Timeline Window', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Open Timeline window', category: 'Windows', isFavorite: true },
      { id: 'mc_65', action: 'Project Window', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Open Project window', category: 'Windows'},
      { id: 'mc_66', action: 'Console', shortcutWin: 'Ctrl+', shortcutMac: 'Cmd+', description: 'Open Console', category: 'Windows'},
      
      // Advanced Features (2025)
      { id: 'mc_67', action: 'Symphony Option', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: ',', category: 'AI Tools', isNew: true },
      { id: 'mc_68', action: 'Smart Bins', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: ',', category: 'AI Tools', isNew: true },
      { id: 'mc_69', action: 'Script Sync', shortcutWin: 'Ctrl+Alt+', shortcutMac: 'Cmd+Opt+', description: ', ', category: 'AI Tools', isNew: true },
      { id: 'mc_70', action: 'Phrase Find', shortcutWin: 'Ctrl+Shift+', shortcutMac: 'Cmd+Shift+', description: ', ', category: 'AI Tools', isNew: true }
    ]
}
];

interface KeyboardShortcutsToolsProps {
  profession?: string;
}

export default function KeyboardShortcutsTools({ profession }: KeyboardShortcutsToolsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showTutorial, setShowTutorial] = useState(false);
  const [selectedSoftware, setSelectedSoftware] = useState('lightroom');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [favoriteShortcuts, setFavoriteShortcuts] = useState<string[]>([]);
  const [expandedAccordion, setExpandedAccordion] = useState<string | false>('shortcuts');
  const [platform, setPlatform] = useState<'windows' | 'mac'>('windows');
  
  // Profession-specific functionality
  const { config: professionConfig } = useProfessionConfig({ profession: profession || 'photographer' });
  const { enqueueSnackbar } = useSnackbar();
  
  // Theming system
  const theming = useTheming();

  // Database-persistent tutorial preferences
  const { isDismissed, isLoading: tutorialLoading, dismissTutorial } = useTutorialPreferences('keyboard-shortcuts');

  // Show tutorial on first visit (after data loads)
  useEffect(() => {
    if (!tutorialLoading && !isDismissed) {
      // Show tutorial after brief delay for better UX
      const timer = setTimeout(() => {
        setShowTutorial(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [tutorialLoading, isDismissed]);

  // Handle tutorial dismissal
  const handleTutorialDismiss = async () => {
    try {
      await dismissTutorial('keyboard-shortcuts', profession);
    } catch (error) {
      console.error('Error dismissing tutorial:', error);
    }
  };

  const [selectedCompositionTechnique, setSelectedCompositionTechnique] = useState('rule-of-thirds');
  const [selectedToolExplanation, setSelectedToolExplanation] = useState<string | null>(null);

  // Copy shortcut to clipboard with toast notification
  const copyShortcutToClipboard = (shortcut: string) => {
    navigator.clipboard.writeText(shortcut)
      .then(() => {
        enqueueSnackbar('Snarvei kopiert til utklippstavle! 📋', { variant: 'success' });
      })
      .catch(() => {
        enqueueSnackbar('Kunne ikke kopiere snarvei', { variant: 'error' });
      });
  };

  const currentSoftware = softwareData.find(sw => sw.id === selectedSoftware);
  const shortcuts = currentSoftware?.shortcuts || [];

  // Filter shortcuts
  const filteredShortcuts = shortcuts.filter(shortcut => {
    const currentShortcut = platform === 'windows' ? shortcut.shortcutWin : shortcut.shortcutMac;
    const matchesSearch = !searchQuery || 
      shortcut.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      currentShortcut.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shortcut.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = selectedCategory === 'all' || shortcut.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
});

  // Get unique categories
  const categories = ['all', ...Array.from(new Set(shortcuts.map(s => s.category)))];

  const toggleFavorite = (shortcutId: string) => {
    const isCurrentlyFavorite = favoriteShortcuts.includes(shortcutId);
    setFavoriteShortcuts(prev => 
      prev.includes(shortcutId) 
        ? prev.filter(id => id !== shortcutId)
        : [...prev, shortcutId]
    );
    
    // Show toast notification
    if (isCurrentlyFavorite) {
      enqueueSnackbar('Fjernet fra favoritter', { variant: 'info' });
    } else {
      enqueueSnackbar('Lagt til i favoritter ⭐', { variant: 'success' });
    }
  };

  // Interactive Tool Explanations
  const technicalTools = [
    {
      id: 'curves',
      name: 'Curves (Kurver, )',
      icon: ShowChart,
      category: 'Tonjustering',
      description: 'Presist kontroll over lyse og mørke toner i bildet',
      explanation: {
        how: 'Kurver justerer forholdet mellom input (original) og output (justert) lysstyrke. En diagonal linje = ingen endring.',
        purpose: 'Gir deg presist kontroll over kontrast, lyse områder, mørke områder og mellomtoner samtidig.',
        usage: 'Dra punkter på, kurven: Opp = lysere, Ned = mørkere. Venstre side = mørke toner, høyre side = lyse toner.',
        tips: 'S-kurve (opp i lys, ned i mørk) øker kontrast. Motsatt reduserer kontrast.'
},
      visual: '📈 Diagonal linje = original | S-kurve = mer kontrast | Omvendt S = mykere'
},
    {
      id: 'histogram',
      name: 'Histogram',
      icon: BarChart,
      category: 'Analyse',
      description: 'Viser fordelingen av lyse og mørke toner i bildet',
      explanation: {
        how: 'Histogram er en graf som viser hvor mange piksler som har hver lysstyrke-verdi fra 0 (svart) til 255 (hvitt).',
        purpose: 'Hjelper deg å se om bildet er riktig eksponert og om du mister detaljer i lyse eller mørke områder.',
        usage: 'Venstre side = mørke toner, midten = mellomtoner, høyre side = lyse toner. Høyde = hvor mange piksler.',
        tips: 'Histogram som "klemmes" mot venstre = undereksponert. Mot høyre = overeksponert.'
},
      visual: '📊 Venstre = mørkt | Midten = mellomtoner | Høyre = lyst'
},
    {
      id: 'white-balance',
      name: 'White Balance (Hvitbalanse, )',
      icon: Thermostat,
      category: 'Farjustering',
      description: 'Justerer fargegjengivelse basert på lyskildens farge',
      explanation: {
        how: 'Kompenserer for fargetemperaturen til lyset i scenen ved å justere blå/gul og grønn/magenta balanse.',
        purpose: 'Sikrer at hvite objekter ser hvite ut uavhengig av lyskildens naturlige fargekast.',
        usage: 'Temperatur: Varm (gul) ← → Kald (blå). Tint: Grønn ← → Magenta. Bruk pipette på hvitt område.',
        tips: 'Sollys ≈ 550, 0Tungsten ≈ 3200K, Blits ≈ 5500K, Skygge ≈ 7000K'
},
      visual: '🌡️ 3200K = varmt lys | 5500K = dagslys | 7000K = kaldt lys'
},
    {
      id: 'exposure',
      name: 'Exposure (Eksponering, )',
      icon: 'Brightness',
      category: 'Grunnleggende',
      description: 'Kontrollerer den totale lysstyrken i bildet',
      explanation: {
        how: 'Simulerer endring av kameraets eksponering ved å multiplisere alle pikselverdier med en faktor.',
        purpose: 'Korrigerer feil eksponering fra kameraet eller justerer lysstyrken kreativt.',
        usage: '+1 stop dobler lysstyrken, -1 stop halverer den. Hver stop = dobbelt/halv lysmengde.',
        tips: 'Start med Exposure, deretter Highlights/Shadows for finere kontroll.'
},
      visual: '☀️ +1 stop = dobbelt lys | 0 = original | -1 stop = halv lys'
},
    {
      id: 'highlights-shadows',
      name: 'Highlights & Shadows',
      icon: 'Contrast',
      category: 'Tonjustering',
      description: 'Justerer lyse og mørke områder separat',
      explanation: {
        how: 'Highlights justerer kun de lyseste tonene, Shadows kun de mørkeste, uten å påvirke mellomtonene like mye.',
        purpose: 'Redder detaljer i overeksponerte himler eller undereksponerte ansikter.',
        usage: 'Highlights negativt (-100) for å hente tilbake detaljer. Shadows positivt (+100) for å lyse opp mørke områder.',
        tips: 'Disse er mer skånsomme enn Exposure fordi de er målrettet mot spesifikke toneområder.'
},
      visual: '🔆 Highlights påvirker kun lyse toner | 🌑 Shadows påvirker kun mørke toner'
},
    {
      id: 'saturation-vibrance',
      name: 'Saturation & Vibrance',
      icon: 'ColorLens',
      category: 'Farjustering',
      description: 'Kontrollerer fargenes intensitet og livlighet',
      explanation: {
        how: 'Saturation øker alle farger likt. Vibrance øker kun svake farger og beskytter hudtoner.',
        purpose: 'Gjør farger mer levende eller dempet. Vibrance er tryggere for portretter.',
        usage: 'Vibrance først for naturlig fargeøkning. Saturation for dramatisk effekt på alle farger.',
        tips: 'Vibrance beskytter hudtoner fra å bli for orange/rød. Saturation kan gjøre huden unaturlig.'
},
      visual: 'Saturation = alle farger | Vibrance = kun svake farger + hudtonebeskyttelse'
},
    {
      id: 'masking-layers',
      name: 'Masking & Layers (Lag og masker, )',
      icon: 'Layers',
      category: 'Avansert',
      description: 'Selektive justeringer med presise masker og lag',
      explanation: {
        how: 'Masker lar deg anvende justeringer kun på spesifikke områder. Hvitt på masken = full effekt, svart = ingen effekt, grått = delvis effekt.',
        purpose: 'Gjør selektive justeringer uten å påvirke resten av bildet. Essential for portrettretusjering og kreativ redigering.',
        usage: 'Lag maske → Male med hvit/svart pensel → Juster opacity for subtilhet → Kombiner flere lag for komplekse effekter.',
        tips: 'Bruk myk pensel for naturlige overganger. Alt+klikk på maske for å se den. Shift+klikk for å deaktivere temporært.'
},
      visual: 'Svart maske = skjult | Hvit maske = synlig | Grå maske = delvis synlig'
},
    {
      id: 'batch-processing',
      name: 'Batch Processing (Satsvis behandling, )',
      icon: 'AutoMode',
      category: 'Arbeidsflyt',
      description: 'Behandle hundrevis av bilder automatisk med identiske innstillinger',
      explanation: {
        how: 'Juster ett bilde perfekt, kopier innstillingene, og anvend dem automatisk på alle lignende bilder fra samme fotoshoot.',
        purpose: 'Spar timer ved å behandle hele bryllup, events eller produktshoot med konsistente innstillinger.',
        usage: 'Lightroom: Sync Settings → Select All → Apply. Actions i Photoshop for komplekse oppgaver. Presets for vanlige looks.',
        tips: 'Lag presets for dine signature-looks. Test på noen få bilder først. Bruk Smart Previews for raskere prosessering.'
},
      visual: '1 bilde justert → Kopier innstillinger → Anvend på 100+ bilder'
},
    {
      id: 'frequency-separation',
      name: 'Frequency Separation',
      icon: 'Tune',
      category: 'Retusjering',
      description: 'Separer tekstur fra farge/tone for avansert hudretusjering',
      explanation: {
        how: 'Deler bildet i to, lag: høy frekvens (tekstur/detaljer) og lav frekvens (farge/toner). Retusjér hver separat.',
        purpose: 'Jevn ut hudtone uten å miste naturlig hudtekstur. Professional standard for portrettretusjering.',
        usage: 'Lag high/low frequency lag → Retusjér farger på low freq → Retusjér tekstur på high freq → Blend naturlig.',
        tips: 'Gaussian Blur radius = 3-5 piksler for high freq. Bruk myk pensel på 20% opacity. Bevar naturlige skygger.'
},
      visual: 'Høy frekvens = tekstur | Lav frekvens = farge/tone | Kombinert = naturlig hud'
},
    {
      id: 'color-grading',
      name: 'Color Grading (Fargegradere, )',
      icon: 'Palette',
      category: 'Kreativ',
      description: 'Profesjonell fargestemning og filmlook',
      explanation: {
        how: 'Justerer farger i shadows, midtones og highlights separat. Skaper konsistent mood og stil across hele prosjektet.',
        purpose: 'Gir bildene professional filmlook og branded identitet. Skiller ditt arbeid fra amatører.',
        usage: 'Color Wheels: Shadows→blå/cyan, Highlights→gul/orange for filmlook. HSL for spesifikke farger. LUTs for konsistens.',
        tips: 'Subtle er bedre - start med 10-20% styrke. Match fargetemperatur før grading. Bevar hudtoner naturlige.'
},
      visual: 'Shadows = blå/cyan | Highlights = gul/orange | Cinematisk look'
},
    {
      id: 'sharpening-workflow',
      name: 'Smart Sharpening Workflow',
      icon: 'CenterFocusStrong',
      category: 'Output',
      description: '3-stegs skarphetsstrategi for optimal bildekvalitet',
      explanation: {
        how: 'Capture Sharpening (RAW) → Creative Sharpening (selektiv) → Output Sharpening (medium-spesifik).',
        purpose: 'Maksimal skarphet uten artifakter. Forskjellige teknikker for print vs web vs social media.',
        usage: 'Lightroom Detail panel for capture. High Pass Filter i Photoshop for creative. Unsharp Mask for output.',
        tips: 'Zoom til 100% når du skarpner. Mask for å unngå himmel/jevne områder. Forskjellige innstillinger for print vs web.'
},
      visual: 'Capture → Creative → Output = Perfekt skarphet for medium'
}
  ];

  const getIconComponent = (iconName: string | React.ComponentType<any>): React.ComponentType<any> => {
    if (typeof iconName !== 'string') return iconName;
    
    const iconMap: { [key: string]: React.ComponentType<any> } = {
      'ShowChart': Tune,
      'BarChart': Tune,
      'Thermostat': Tune,
      'Brightness6': Tune,
      'Contrast': Tune,
      'ColorLens': Palette,
      'Layers': Layers,
      'AutoMode': AutoMode,
      'CenterFocusStrong': CenterFocusStrong
    };
    return iconMap[iconName] || Tune;
  };

  return (
    <Box sx={{ maxWidth: '100%', mx: 'auto' }}>
      {/* Modern Premium Header */}
      <Paper 
        elevation={12}
        sx={{ 
          mb:  3, 
          p:  3, 
          background: 'linear-gradient(135deg, #ff6b35, #f7931e)',
          borderRadius:  3,
          color: 'white',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(25,107,53,0.3)',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="0.1"%3E%3Cpath d="M30 30m-20 0a0,20 0 1,1 40,0a20,20 0 1,1 -40,0"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
            opacity: 0.2
          },
          ...theming.getThemedCardSx()
        }}
      >
  <Box sx={{ position: 'relative', zIndex: 1}}>
    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
      <Box sx={{ background: 'rgba(25,255,255,0.2)', borderRadius: 2, p: 1.5, mr: 2, backdropFilter: 'blur(10px)' }}>
        <Keyboard sx={{ fontSize: 32, color: 'white' }} />
      </Box>

      <Box sx={{ flex: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <CameraAlt sx={{ fontSize: 32, color: 'white' }} />
          <Typography
            variant="h4"
            sx={{
              fontWeight: 700,
              textShadow: '0 2px 4px rgba(0,0,0,0.1)',
              color: 'white'
            }}
          >
            {professionConfig?.name || 'Kreative Verktøy'}
          </Typography>
        </Box>

        <Typography
          variant="body1"
          sx={{ opacity: 0.9, fontWeight: 400, textShadow: '0 1px 2px rgba(0,0,0,0.1)' }}
        >
          Mestre keyboard shortcuts og workflow-teknikker for {professionConfig?.name?.toLowerCase() || 'kreative'}
        </Typography>
      </Box>

      {/* Tutorial Help Button */}
      <Tooltip title="Open Tutorial Guide" arrow>
        <IconButton
          onClick={() => setShowTutorial(true)}
          sx={{
            background: 'rgba(255,255,255,0.2)',
            backdropFilter: 'blur(10px)',
            color: 'white',
            '&:hover': {
              background: 'rgba(255,255,255,0.3)'
            }
          }}
        >
          <HelpOutline />
        </IconButton>
      </Tooltip>
    </Box>

    {/* Feature Stats - Kompakt design */}
    <Grid container spacing={1.5} sx={{ mt: 1.5 }}>
      <Grid item xs={4}>
        <Box
          sx={{
            background: 'rgba(25,255,255,0.15)',
            borderRadius: 1,
            p: 1.5,
            backdropFilter: 'blur(10px)',
            textAlign: 'center' }}
        >
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.2, color: theming.colors.primary }}>
            3
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.9 }}>
            Programmer
          </Typography>
        </Box>
      </Grid>

      <Grid item xs={4}>
        <Box
          sx={{
            background: 'rgba(25,255,255,0.15)',
            borderRadius: 1,
            p: 1.5,
            backdropFilter: 'blur(10px)',
            textAlign: 'center' }}
        >
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.2, color: theming.colors.primary }}>
            {shortcuts.length}
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.9 }}>
            Snarveier
          </Typography>
        </Box>
      </Grid>     
      <Grid item xs={4}>
        <Box
          sx={{
            background: 'rgba(25,255,255,0.15)',
            borderRadius: 1,
            p: 1.5,
            backdropFilter: 'blur(10px)',
            textAlign: 'center' }}
        >
          {/* TODO: Add third metric */}
        </Box>
      </Grid>
    </Grid>
  </Box>
          {/* New Features Alert */}
          <Alert 
            severity="info" 
            icon={<Announcement />}
            sx={{ 
              mt: 3, 
              background: 'rgba(25,255,255,0.15)',
              color: 'white',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(25,255,255,0.2)',
              '& .MuiAlert-icon': { color: 'white' }
            }}
          >
            <Typography variant="subtitle2" fontWeight="bold">
              Nye 2025-funksjoner tilgjengelig!
            </Typography>
            <Typography variant="body2">
              Oppdaterte verktøy med masking-snarveier og forbedrete workflow-teknikker
            </Typography>
          </Alert>
      </Paper>

      {/* Modern Platform Selector */}
      <Paper 
        elevation={6}
        sx={{ 
          mb: 4, 
          p: 4, 
          borderRadius: 3,
          background: 'rgba(25,255,255,0.9)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(25,107,53,0.1)',
          ...theming.getThemedCardSx()
        }}
      >
      <Typography 
        variant="h6" 
        sx={{ 
          mb: 3, 
          fontWeight: 700, 
          display: 'flex', 
          alignItems: 'center', 
          gap: 2,
          color: theming.colors.primary
        }}
      >
        <Computer sx={{ fontSize: 28, color: theming.colors.primary }} />
        Velg Platform
      </Typography>
        <ToggleButtonGroup
          value={platform}
          exclusive
          onChange={(e: React.MouseEvent<HTMLElement>, newPlatform: string) => newPlatform && setPlatform(newPlatform as 'windows' | 'mac')}
          size="large"
          sx={{
            mb:  3,
            width: '100%','& .MuiToggleButton-root': {
              px:  6,
              py:  3,
              borderRadius: '16px !important',
              border: '2px solid',
              borderColor: '#ff6b30',
              color: '#ff6b30',
              fontWeight: 600,
              fontSize: '1.1rem',
              flex: 1,
              transition: 'all 0.3s ease',
              '&.Mui-selected': {
                background: 'linear-gradient(135deg, #ff6b35, #f7931e)',
                color: 'white',
                borderColor: '#ff6b30',
                boxShadow: '0 4px 16px rgba(25,107,53,0.3)','&:hover': {
                  background: 'linear-gradient(135deg, #e55a2b, #e8861d)'
          }
        }, '&:hover': {
                backgroundColor: 'rgba(25,107,53,0.1)',
                transform: 'translateY(-2px)',
                boxShadow: '0 4px 12px rgba(25,107,53,0.2)'
        }
      }
    }}
        >
          <ToggleButton value="windows">
            <Computer sx={{ mr: 2, fontSize: 24}} />
            Windows
          </ToggleButton>
          <ToggleButton value="mac">
            <Apple sx={{ mr: 2, fontSize: 24}} />
            macOS
          </ToggleButton>
        </ToggleButtonGroup>
        
        {/* Platform Description */}
        <Box sx={{ 
          mt: 2,
    p: 22,
    background: `linear-gradient(135deg, ${platform === 'windows' ? '#0078d4' : '#007aff'}20, transparent)`,
          borderRadius:  2,
          border: `1px solid ${platform === 'windows' ? '#0078d4' : '#007aff'}30`
  }}>
          <Typography variant="body2" sx={{ 
            color: platform === 'windows' ? '#0078d4' : '#007aff',
            fontWeight: 600,
            textAlign: 'center'
  }}>
            {platform === 'windows' 
              ? '⌨️ Viser Windows-snarveier (Ctrl, Alt, Shift)' 
              : '⌨️ Viser macOS-snarveier (Cmd, Opt, Shift)'}
          </Typography>
        </Box>
      </Paper>

      {/* Modern Software Selection */}
      <Paper 
        elevation={8}
        sx={{ 
          mb:  4, 
          p:  4, 
          borderRadius:  3,
          background: 'linear-gradient(135deg, rgba(255,255,255,0.95), rgba(255,255,255,0.85))',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(25,107,53,0.1)',
          boxShadow: '0 8px 32px rgba(25,107,53,0.1)',
          ...theming.getThemedCardSx()
        }}
      >
        <Typography variant="h5" sx={{ 
          mb:  4, 
          fontWeight: 700, 
          display: 'flex', 
          alignItems: 'center', 
          gap:  2,
          color: '#ff6b35'
}}>
          <Build sx={{ fontSize: 32, color: theming.colors.primary }} />
          Velg Programvare
        </Typography>
        
        <Grid container spacing={3}>
          {softwareData.map((software) => {
            const SoftwareIcon = software.icon;
            const isSelected = selectedSoftware === software.id;
            
            return (
              <Grid item xs={12} sm={6} md={4} key={software.id}>
                <Card
                  elevation={isSelected ? 12 : 4}
                  onClick={() => {
                    setSelectedSoftware(software.id);
                    setSelectedCategory('all');
                  }}
                  sx={{
                    ...theming.getThemedCardSx(),
                    height: 10,
                    cursor: 'pointer',
                    position: 'relative',
                    overflow: 'hidden',
                    borderRadius:  3,
                    border: `2px solid ${isSelected ? software.color : 'transparent'}`,
                    background: isSelected 
                      ? `linear-gradient(135deg, ${software.color}, ${software.color}dd)` 
                      : 'rgba(255,255,255,0.9)',
                    color: isSelected ? 'white' : software.color,
                    transition: 'all 0.4s cubic-bezier(0, .0, 0.2, 1)',
                    transform: isSelected ? 'translateY(-4px) scale(1.02)' : 'translateY(0) scale(1)',
                    boxShadow: isSelected 
                      ? `0 12px 32px ${software.color}40` 
                      : '0 4px 16px rgba(0,0,0,0.08)','&:hover': {
                        transform: 'translateY(-6px) scale(1.03)',
                      boxShadow: `0 16px 40px ${software.color}50`,
                      border: `2px solid ${software.color}`,
                      background: isSelected 
                        ? `linear-gradient(135deg, ${software.color}, ${software.color}cc)` 
                        : `linear-gradient(135deg, ${software.color}10, ${software.color}05)`
              }, '&::before': {
                      content: ', "',
                      position: 'absolute',
                      top:  0,
                      left:  0,
                      right:  0,
                      bottom:  0,
                      background: isSelected 
                        ? 'url("data:image/svg+xml,%3Csvg width="40" height="40" viewBox="0 0 40 40" xmlns="http: //www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="0.1"%3E%3Cpath d="M20 20m-16 0a6,16 0 1,1 32,0a16,16 0 1,1 -32,0"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")'
                        : 'none',
                      opacity: 0.3
                    }
                  }}
                >
                  <CardContent sx={{ 
                    height: '100%', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    gap: 1.5,
                    position: 'relative',
                    zIndex: 1,  ...theming.getThemedCardSx() }}>
                    <SoftwareIcon sx={{ fontSize: 36}} />
                    <Typography variant="h6" sx={{ 
                      fontWeight: 700,
                      textAlign: 'center'
            }}>
                      {software.name}
                    </Typography>
                    <Chip 
                      label={`${software.shortcuts.length} snarveier`}
                      size="small" 
                      sx={{ 
                        bgcolor: isSelected ? 'rgba(25,255,255,0.25)' : `${software.color}20`,
                        color: isSelected ? 'white' : software.color,
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        backdropFilter: 'blur(10px)',
                        border: `1px solid ${isSelected ? 'rgba(25,255,255,0.3)' : software.color + '30'}`
                }}
                    />
                  </CardContent>
                </Card>
              </Grid>
          );
    })}
        </Grid>
      </Paper>

      {/* Modern Search and Filters */}
      <Paper 
        elevation={6}
        sx={{ 
          mb:  4, 
          p:  4, 
          borderRadius:  3,
          background: 'linear-gradient(135deg, rgba(255,255,255,0.98), rgba(255,255,255,0.92))',
          backdropFilter: 'blur(15px)',
          border: '1px solid rgba(25,107,53,0.1)',
          boxShadow: '0 8px 32px rgba(25,107,53,0.08)',
          ...theming.getThemedCardSx()
        }}
      >
        <Grid container spacing={4} alignItems="center">
          <Grid item xs={12} md={6}>
            <Box sx={{ position: 'relative' }}>
              <Typography variant="h6" sx={{  
                mb: 2,
    fontWeight: 700, 
                color: '#ff6b30',
                display: 'flex',
                alignItems: 'center',
                gap: 1  }}>
                <Search sx={{ fontSize: 24}} />
                Søk i Snarveier
              </Typography>
              <TextField
                fullWidth
                variant="outlined"
                placeholder="Søk etter handling, snarvei eller beskrivelse..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius:  3,
                    background: 'rgba(25,255,255,0.8)',
                    backdropFilter: 'blur(10px)',
                    border: '2px solid transparent',
                    transition: 'all 0.3s ease','&:hover': {
                      border: '2px solid rgba(25,107,53,0.3)',
                      background: 'rgba(25,255,255,0.95)'
              }, '&.Mui-focused': {
                      border: '2px solid #ff6b30',
                      background: 'rgba(25,255,255,1)',
                      boxShadow: '0 0 20px rgba(25,107,53,0.2)'
              }
            }, '& .MuiInputBase-input': {
                    py:  2,
                    fontSize: '1.1rem'
          }
          }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search sx={{ color: '#ff6b35'}} />
                    </InputAdornment>
                  )}}
              />
            </Box>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Typography variant="h6" sx={{ 
              mb: 2,
    fontWeight: 700, 
              color: '#ff6b35',
              display: 'flex',
              alignItems: 'center',
              gap: 1 }}>
              <FilterList sx={{ fontSize: 24}} />
              Filtrer Kategorier
            </Typography>
            <Box sx={{ 
              display: 'flex', 
              gap: 1.5,
        flexWrap: 'wrap', 
              alignItems: 'center'
    }}>
              {categories.map((category) => {
                const isSelected = selectedCategory === category;
                return (
                  <Chip
                    key={category}
                    label={category === 'all' ? 'Alle kategorier' : category}
                    onClick={() => setSelectedCategory(category)}
                    sx={{
                      px:  1,
                      py: 0.5,
                      height:  40,
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      borderRadius:  5,
                      border: `2px solid ${currentSoftware?.color || '#ff6b30'}`,
                      background: isSelected 
                        ? `linear-gradient(135deg, ${currentSoftware?.color || '#ff6b35'}, ${currentSoftware?.color || '#ff6b35'}dd)` 
                        : 'rgba(255,255,255,0.8)',
                      color: isSelected ? 'white' : (currentSoftware?.color || '#ff6b35'),
                      backdropFilter: 'blur(10px)',
                      transition: 'all 0.3s cubic-bezier(0, .0, 0.2, 1)',
                      cursor: 'pointer','&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: `0 6px 20px ${currentSoftware?.color || '#ff6b30'}40`,
                        background: isSelected 
                          ? `linear-gradient(135deg, ${currentSoftware?.color || '#ff6b35'}dd, ${currentSoftware?.color || '#ff6b35'}cc)` 
                          : `linear-gradient(135deg, ${currentSoftware?.color || '#ff6b35'}15, ${currentSoftware?.color || '#ff6b35'}08)`
                }
              }}
                  />
              );
        })}
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Shortcuts List */}
      <Accordion 
        expanded={expandedAccordion === 'shortcuts'}
        onChange={(e, isExpanded) => setExpandedAccordion(isExpanded ? 'shortcuts' : false)}
        elevation={3}
        sx={{ 
          borderRadius: 2, '&:before': { display: 'none' }
  }}
      >
        <AccordionSummary
          expandIcon={theming.getThemedIcon('expandMore')}
          sx={{ 
            backgroundColor: `${currentSoftware?.color}12`,
            borderRadius: expandedAccordion === 'shortcuts' ? '8px 8px 0 0' : '8px',
            minHeight: 72 }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
            {currentSoftware && React.createElement(currentSoftware.icon, { 
              sx: { color: currentSoftware.color, mr: 2, fontSize: 28}
      })}
            <Box sx={{ flexGrow:  1 }}>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5, color: theming.colors.primary }}>
                {currentSoftware?.name} - Tastatursnarveier
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {filteredShortcuts.length} snarveier funnet
                {selectedCategory !== 'all' && ` i kategorien "${selectedCategory},"`}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <Chip 
                label={`${filteredShortcuts.length} resultater`}
                size="small" 
                color="primary"
              />
              {favoriteShortcuts.length > 0 && (
                <Chip 
                  label={`${favoriteShortcuts.length} favoritter`}
                  size="small" 
                  variant="outlined"
                  icon={<Star sx={{ fontSize: 16 }} />}
                />
              )}
            </Stack>
          </Box>
        </AccordionSummary>
        <AccordionDetails sx={{ p:  0 }}>
          <List>
            {filteredShortcuts.map((shortcut, index) => (
              <React.Fragment key={shortcut.id}>
                <ListItem sx={{ py: 2, px: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                    <Box sx={{ flexGrow:  1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                        <Typography variant="h6" sx={{  fontWeight: 600}}>
                          {shortcut.action}
                        </Typography>
                        <Chip 
                          label={shortcut.category}
                          size="small" 
                          variant="outlined"
                          sx={{ 
                            borderColor: currentSoftware?.color,
                            color: currentSoftware?.color
                  }}
                        />
                        {shortcut.isFavorite && (
                          <Chip 
                            label="Populær" 
                            size="small" 
                            color="warning"
                            icon={<Star sx={{ fontSize: 16}} />}
                          />
                        )}
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb:  1 }}>
                        {shortcut.description}
                      </Typography>
                      <Box sx={{ 
                        display: 'inline-flex', 
                        alignItems: 'center',
                        gap:  1,
                        bgcolor: 'grey.10',
                        px:  2,
                        py:  1,
                        borderRadius:  1,
                        fontFamily: 'monospace',
                        fontWeight: 600,
                        fontSize: '1rem',
                        border: `2px solid ${currentSoftware?.color}30`
                }}>
                        <Keyboard sx={{ mr: 1, fontSize: 20, color: currentSoftware?.color }} />
                        {platform === 'windows' ? shortcut.shortcutWin : shortcut.shortcutMac}
                        {shortcut.isNew && (
                          <Chip 
                            label="NEW" 
                            size="small" 
                            color="success" 
                            sx={{ ml: 1, fontSize: '10px', height: '20px' }}
                          />
                        )}
                      </Box>
                    </Box>
                      <Box sx={{ display: 'flex', gap:  1 }}>
                      <Tooltip title="Copy shortcut">
                        <IconButton 
                          onClick={() => copyShortcutToClipboard(platform === 'windows' ? shortcut.shortcutWin : shortcut.shortcutMac)}
                          size="small"
                          sx={{ color: currentSoftware?.color }}
                        >
                          {theming.getThemedIcon('contentCopy')}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={favoriteShortcuts.includes(shortcut.id) ? "Fjern fra favoritter" : "Legg til favoritter"}>
                        <IconButton 
                          onClick={() => toggleFavorite(shortcut.id)}
                          size="small"
                          sx={{ color: currentSoftware?.color }}
                        >
                          {favoriteShortcuts.includes(shortcut.id) ? theming.getThemedIcon('star') : theming.getThemedIcon('starBorder')}
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                </ListItem>
                {index < filteredShortcuts.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
          
          {filteredShortcuts.length === 0 && (
            <Box sx={{ p:  4, textAlign: 'center' }}>
              <Typography variant="h6" color="text.secondary" sx={{  mb:  1  }}>
                Ingen snarveier funnet
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Prøv å endre søkekriterier eller kategori
              </Typography>
            </Box>
          )}
        </AccordionDetails>
      </Accordion>

      {/* Custom Actions & Retouching Shortcuts Section */}
      <Accordion 
        expanded={expandedAccordion === 'custom'}
        onChange={(e, isExpanded) => setExpandedAccordion(isExpanded ? 'custom' : false)}
        elevation={3}
        sx={{ 
          mt:  3,
          borderRadius: 2, '&:before': { display: 'none' }
  }}
      >
        <AccordionSummary
          expandIcon={theming.getThemedIcon('expandMore')}
          sx={{ 
            backgroundColor: '#ff8c001',
            borderRadius: expandedAccordion === 'custom' ? '8px 8px 0 0' : '8px',
            minHeight: 72 }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
            <Build sx={{ color: '#ff8c00', mr: 2, fontSize: 28}} />
            <Box sx={{ flexGrow:  1 }}>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5, color: theming.colors.primary }}>
                Custom Actions & Retouching Shortcuts
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Create your own actions and retouching workflow shortcuts
              </Typography>
            </Box>
            <Chip 
              label="Advanced" 
              size="small" 
              color="warning"
            />
          </Box>
        </AccordionSummary>
        <AccordionDetails sx={{ p:  4 }}>
          <Grid container spacing={4}>
            <Grid item xs={12} md={6}>
              <Card sx={{ p:  3, border: '2px solid #e3f2fd' ,  ...theming.getThemedCardSx() }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: theming.colors.primary }}>
                  🎨 Photoshop Actions
                </Typography>
                <Typography variant="body2" sx={{ mb:  2 }}>
                  Create custom actions for repetitive retouching tasks: </Typography>
                <List dense>
                  <ListItem>
                    <ListItemText 
                      primary="F1-F12" 
                      secondary="Assign to custom actions (Window → Actions → Record)"
                      primaryTypographyProps={{ fontFamily: 'monospace', color: '#1976d0', fontWeight: 600}}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary="Ctrl+F1-F12" 
                      secondary="Complex multi-step retouching workflows"
                      primaryTypographyProps={{ fontFamily: 'monospace', color: '#1976d0', fontWeight: 600}}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary="Alt+F1-F12" 
                      secondary="Layer styles and adjustment presets"
                      primaryTypographyProps={{ fontFamily: 'monospace', color: '#1976d0', fontWeight: 600}}
                    />
                  </ListItem>
                </List>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Card sx={{ p:  3, border: '2px solid #fff3e0' ,  ...theming.getThemedCardSx() }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: theming.colors.primary }}>
                  Lightroom Develop Presets
                </Typography>
                <Typography variant="body2" sx={{ mb:  2 }}>
                  Speed up your editing with custom develop shortcuts: </Typography>
                <List dense>
                  <ListItem>
                    <ListItemText 
                      primary="Ctrl+Alt+1-9" 
                      secondary="Apply custom develop presets"
                      primaryTypographyProps={{ fontFamily: 'monospace', color: '#ff8c00', fontWeight: 600}}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary="Ctrl+Shift+Alt+1-9" 
                      secondary="Apply presets to selection"
                      primaryTypographyProps={{ fontFamily: 'monospace', color: '#ff8c00', fontWeight: 600}}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary="Custom shortcuts" 
                      secondary="Edit → Preferences → Shortcuts"
                      primaryTypographyProps={{ fontFamily: 'monospace', color: '#ff8c00', fontWeight: 600}}
                    />
                  </ListItem>
                </List>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Card sx={{ p:  3, border: '2px solid #ffebee' ,  ...theming.getThemedCardSx() }}>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: theming.colors.primary }}>
                  Capture One Custom Shortcuts
                </Typography>
                <Typography variant="body2" sx={{ mb:  2 }}>
                  Set up your personal workflow shortcuts: </Typography>
                <List dense>
                  <ListItem>
                    <ListItemText 
                      primary="Edit → Edit Keyboard Shortcuts" 
                      secondary="Complete customization interface"
                      primaryTypographyProps={{ fontFamily: 'monospace', color: '#d32f20', fontWeight: 600}}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary="Assign to Styles" 
                      secondary="Quickly apply your favorite looks"
                      primaryTypographyProps={{ fontFamily: 'monospace', color: '#d32f20', fontWeight: 600}}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary="Custom Tool Shortcuts" 
                      secondary="Personalize cursor tool activation"
                      primaryTypographyProps={{ fontFamily: 'monospace', color: '#d32f20', fontWeight: 600}}
                    />
                  </ListItem>
                </List>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Card sx={{ p:  3, border: '2px solid #f3e5f5' ,  ...theming.getThemedCardSx() }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: theming.colors.primary }}>
                  Retouching Workflow Shortcuts
                </Typography>
                <Typography variant="body2" sx={{ mb:  2 }}>
                  Pro retouching combinations you should master: </Typography>
                <List dense>
                  <ListItem>
                    <ListItemText 
                      primary={platform === 'windows' ? 'Ctrl+Alt+Shift+E' : 'Cmd+Opt+Shift+'}
                      secondary="Merge visible to new layer (Photoshop)"
                      primaryTypographyProps={{ fontFamily: 'monospace', color: '#7b1fa0', fontWeight: 600}}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary={platform === 'windows' ? 'Alt+Click layer mask' : 'Opt+Click layer mask'}
                      secondary="View mask in isolation"
                      primaryTypographyProps={{ fontFamily: 'monospace', color: '#7b1fa0', fontWeight: 600}}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary={platform === 'windows' ? 'Shift+F5' : 'Shift+F5'}
                      secondary="Content-Aware Fill workspace"
                      primaryTypographyProps={{ fontFamily: 'monospace', color: '#7b1fa0', fontWeight: 600}}
                    />
                  </ListItem>
                </List>
              </Card>
            </Grid>
          </Grid>
          
          <Divider sx={{ my:  4 }} />
          
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: theming.colors.primary }}>
            🛠️ How to Create Custom Actions
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1, color: '#1976d2' }}>
                Photoshop Actions
              </Typography>
              <Typography variant="body2" sx={{ mb:  1 }}>
                1. Open Actions panel (Window → Actions)
              </Typography>
              <Typography variant="body2" sx={{ mb:  1 }}>
                2. Click "Create new action" button
              </Typography>
              <Typography variant="body2" sx={{ mb:  1 }}>
                3. Assign Function Key (F1-F12)
              </Typography>
              <Typography variant="body2">
                4. Record your retouching steps
              </Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1, color: '#ff8c00' }}>
                Lightroom Presets
              </Typography>
              <Typography variant="body2" sx={{ mb:  1 }}>
                1. Make your adjustments in Develop module
              </Typography>
              <Typography variant="body2" sx={{ mb:  1 }}>
                2. Click "+" in Presets panel
              </Typography>
              <Typography variant="body2" sx={{ mb:  1 }}>
                3. Choose which settings to include
              </Typography>
              <Typography variant="body2">
                4. Assign keyboard shortcut if desired
              </Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1, color: '#d32f2f' }}>
                Capture One Shortcuts
              </Typography>
              <Typography variant="body2" sx={{ mb:  1 }}>
                1. Go to Edit → Edit Keyboard Shortcuts
              </Typography>
              <Typography variant="body2" sx={{ mb:  1 }}>
                2. Search for the command you want
              </Typography>
              <Typography variant="body2" sx={{ mb:  1 }}>
                3. Click in shortcut field and press keys
              </Typography>
              <Typography variant="body2">
                4. Click "Summarize" to export your list
              </Typography>
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Interactive Composition Guide */}
      <Accordion 
        expanded={expandedAccordion === 'composition'}
        onChange={(e, isExpanded) => setExpandedAccordion(isExpanded ? 'composition' : false)}
        elevation={3}
        sx={{ 
          mt:  3,
          borderRadius: 2, '&:before': { display: 'none' }
  }}
      >
        <AccordionSummary
          expandIcon={theming.getThemedIcon('expandMore')}
          sx={{ 
            backgroundColor: '#f3e5f5',
            borderRadius: expandedAccordion === 'composition' ? '8px 8px 0 0' : '8px',
            minHeight: 72 }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
            <CropFree sx={{ color: '#9c27b0', mr: 2, fontSize: 28}} />
            <Box sx={{ flexGrow:  1 }}>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5, color: theming.colors.primary }}>
                Interactive Composition Guide
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Learn composition techniques with keyboard shortcuts for better image editing
              </Typography>
            </Box>
            <Chip 
              label="Interactive" 
              size="small" 
              color="secondary"
            />
          </Box>
        </AccordionSummary>
        <AccordionDetails sx={{ p:  4 }}>
          {/* Composition Technique Selector */}
          <Typography variant="h6" sx={{ mb:  3, fontWeight: 600, color: theming.colors.primary }}>
            Select Composition Technique
          </Typography>
          <Grid container spacing={2} sx={{ mb:  4 }}>
            {[
              { id: 'rule-of-thirds', name: 'Rule of Thirds', icon: GridOn, color: '#2196f3' },
              { id: 'leading-lines', name: 'Leading Lines', icon: Straighten, color: '#ff9800' },
              { id: 'framing', name: 'Natural Framing', icon: CropFree, color: '#4caf50' },
              { id: 'symmetry', name: 'Symmetry & Balance', icon: FlipCameraAndroid, color: '#9c27b0' },
              { id: 'cropping', name: 'Creative Cropping', icon: AspectRatio, color: '#f44336' },
              { id: 'exposure', name: 'Exposure & Focus', icon: Tune, color: '#795548' }
            ].map((technique) => (
              <Grid item xs={12} sm={6} md={4} key={technique.id}>
                <Button
                  variant={selectedCompositionTechnique === technique.id ? 'contained' : 'outlined'}
                  onClick={() => setSelectedCompositionTechnique(technique.id)}
                  fullWidth
                  startIcon={<technique.icon />}
                  sx={{
                    py:  2,
                    borderRadius:  3,
                    borderColor: technique.color,
                    color: selectedCompositionTechnique === technique.id ? 'white' : technique.color,
                    backgroundColor: selectedCompositionTechnique === technique.id ? technique.color : 'transparent','&:hover': {
                      backgroundColor: selectedCompositionTechnique === technique.id ? technique.color + 'dd' : technique.color + '15'
            }
            }}
                >
                  {technique.name}
                </Button>
              </Grid>
            ))}
          </Grid>

          {/* Interactive Composition Content */}
          {selectedCompositionTechnique === 'rule-of-thirds' && (
            <Card sx={{ p:  4, border: '2px solid #2196f0', borderRadius:  3 ,  ...theming.getThemedCardSx() }}>
              <Typography variant="h6" sx={{ mb:  3, fontWeight: 600, color: theming.colors.primary }}>
                📐 Rule of Thirds with Keyboard Shortcuts
              </Typography>
              
              <Grid container spacing={4}>
                <Grid item xs={12} md={6}>
                  {/* Visual Grid Representation */}
                  <Box sx={{
                    position: 'relative',
                    width: '100%',
                    height: 30,
                    backgroundColor: '#f5f5f5',
                    borderRadius:  2,
                    overflow: 'hidden',
                    border: '3px solid #2196f3'
          }}>
                    {/* Rule of thirds grid overlay */}
                    <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
                      {/* Vertical lines */}
                      <line x1="33.33%" y1="0%" x2="33.33%" y2="100%" stroke="#2196f3" strokeWidth="2" strokeDasharray="5,5" />
                      <line x1="66.66%" y1="0%" x2="66.66%" y2="100%" stroke="#2196f3" strokeWidth="2" strokeDasharray="5,5" />
                      {/* Horizontal lines */}
                      <line x1="0%" y1="33.33%" x2="100%" y2="33.33%" stroke="#2196f3" strokeWidth="2" strokeDasharray="5,5" />
                      <line x1="0%" y1="66.66%" x2="100%" y2="66.66%" stroke="#2196f3" strokeWidth="2" strokeDasharray="5,5" />
                      {/* Intersection points */}
                      <circle cx="33.33%" cy="33.33%" r="8" fill="#ff4444" />
                      <circle cx="66.66%" cy="33.33%" r="8" fill="#ff4444" />
                      <circle cx="33.33%" cy="66.66%" r="8" fill="#ff4444" />
                      <circle cx="66.66%" cy="66.66%" r="8" fill="#ff4444" />
                    </svg>
                    
                    {/* Sample subject placement */}
                    <Box sx={{
                      position: 'absolute',
                      top: '28%',
                      left: '28%',
                      width:  40,
                      height:  40,
                      backgroundColor: '#4caf50',
                      borderRadius: '50%',
                      border: '3px solid white',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
              }} />
                    
                    <Typography variant="caption" sx={{
                      position: 'absolute',
                      bottom:  8,
                      right:  8,
                      backgroundColor: 'rgba(25,255,255,0.9)',
                      px:  1,
                      py: 0.5,
                      borderRadius:  1,
                      fontSize: '11px'
            }}>
                      Power Points (Red) - Subject Placement (Green)
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb:  2 }}>
                    Essential Shortcuts for Rule of Thirds: </Typography>
                  
                  <List>
                    <ListItem sx={{ py: 1 }}>
                      <ListItemText 
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                            <Box sx={{ 
                              display: 'flex', alignItems: 'center', gap:  1,
                              fontFamily: 'monospace', 
                              backgroundColor: '#e3f2fd',
                              px: 2, py: 1, borderRadius: 1,
                              fontWeight: 600, color: '#1976d2'
                    }}>
                              <CropFree sx={{ fontSize: 16}} />
                              {platform === 'windows' ? 'R' : 'R'}
                            </Box>
                            <Typography variant="body2" fontWeight={600}>
                              Crop Tool - Position on power points
                            </Typography>
                          </Box>
                  }
                        secondary="Activate crop tool to reposition your subject along the rule of thirds lines"
                      />
                    </ListItem>
                    
                    <ListItem sx={{ py:  1 }}>
                      <ListItemText 
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                            <Box sx={{ 
                              display: 'flex', alignItems: 'center', gap:  1,
                              fontFamily: 'monospace', 
                              backgroundColor: '#e3f2fd',
                              px: 2, py: 1, borderRadius: 1,
                              fontWeight: 600, color: '#1976d2'
                    }}>
                              <GridOn sx={{ fontSize: 16}} />
                              {platform === 'windows' ? 'Ctrl+;' : 'Cmd+;'}
                            </Box>
                            <Typography variant="body2" fontWeight={600}>
                              Show/Hide Grid - Visual guide
                            </Typography>
                          </Box>
                  }
                        secondary="Toggle overlay grid to see rule of thirds lines while editing"
                      />
                    </ListItem>
                    
                    <ListItem sx={{ py:  1 }}>
                      <ListItemText 
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                            <Box sx={{ 
                              display: 'flex', alignItems: 'center', gap:  1,
                              fontFamily: 'monospace', 
                              backgroundColor: '#e3f2fd',
                              px: 2, py: 1, borderRadius: 1,
                              fontWeight: 600, color: '#1976d2'
                    }}>
                              <AspectRatio sx={{ fontSize: 16}} />
                              {platform === 'windows' ? 'O' : 'O'}
                            </Box>
                            <Typography variant="body2" fontWeight={600}>
                              Cycle Overlays - Different grids
                            </Typography>
                          </Box>
                  }
                        secondary="Cycle through rule of thirds, golden ratio, diagonal lines"
                      />
                    </ListItem>
                  </List>
                  
                  <Alert severity="info" sx={{ mt:  2 }}>
                    <Typography variant="body2" fontWeight={600}>
                      💡 Pro Tip: Place your main subject at intersection points (red dots) for maximum visual impact
                    </Typography>
                  </Alert>
                </Grid>
              </Grid>
            </Card>
)}

          {selectedCompositionTechnique === 'leading-lines' && (
            <Card sx={{ p:  4, border: '2px solid #ff9800', borderRadius:  3 ,  ...theming.getThemedCardSx() }}>
              <Typography variant="h6" sx={{ mb:  3, fontWeight: 600, color: theming.colors.primary }}>
                📏 Leading Lines with Perspective Correction
              </Typography>
              
              <Grid container spacing={4}>
                <Grid item xs={12} md={6}>
                  <Box sx={{
                    position: 'relative',
                    width: '100%',
                    height: 30,
                    backgroundColor: '#f5f5f5',
                    borderRadius:  2,
                    overflow: 'hidden',
                    border: '3px solid #ff9800'
          }}>
                    <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
                      {/* Leading lines converging to a point */}
                      <line x1="0%" y1="100%" x2="75%" y2="40%" stroke="#ff9800" strokeWidth="4" />
                      <line x1="100%" y1="100%" x2="75%" y2="40%" stroke="#ff9800" strokeWidth="4" />
                      <line x1="20%" y1="0%" x2="75%" y2="40%" stroke="#ff9800" strokeWidth="3" strokeDasharray="3,2" />
                      <line x1="80%" y1="0%" x2="75%" y2="40%" stroke="#ff9800" strokeWidth="3" strokeDasharray="3,2" />
                      {/* Focal point */}
                      <circle cx="75%" cy="40%" r="12" fill="#4caf50" stroke="white" strokeWidth="3" />
                    </svg>
                    <Typography variant="caption" sx={{
                      position: 'absolute',
                      bottom:  8,
                      right:  8,
                      backgroundColor: 'rgba(25,255,255,0.9)',
                      px: 1, py: 0, borderRadius: 1, fontSize: '11px'
            }}>
                      Lines Guide Eye to Subject (Green)
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb:  2 }}>
                    Perspective & Line Correction Shortcuts: </Typography>
                  
                  <List>
                    <ListItem sx={{ py: 1 }}>
                      <ListItemText 
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                            <Box sx={{ 
                              display: 'flex', alignItems: 'center', gap:  1,
                              fontFamily: 'monospace', backgroundColor: '#fff3e0',
                              px: 2, py: 1, borderRadius: 1, fontWeight: 600, color: '#f57c00'
                    }}>
                              <CropFree sx={{ fontSize: 16}} />
                              {platform === 'windows' ? 'Shift+T' : 'Shift+T'}
                            </Box>
                            <Typography variant="body2" fontWeight={600}>
                              Perspective Crop - Fix converging lines
                            </Typography>
                          </Box>
                  }
                        secondary="Fix perspective distortion to strengthen leading lines"
                      />
                    </ListItem>
                    
                    <ListItem sx={{ py:  1 }}>
                      <ListItemText 
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                            <Box sx={{ 
                              display: 'flex', alignItems: 'center', gap:  1,
                              fontFamily: 'monospace', backgroundColor: '#fff3e0',
                              px: 2, py: 1, borderRadius: 1, fontWeight: 600, color: '#f57c00'
                    }}>
                              <Tune sx={{ fontSize: 16}} />
                              {platform === 'windows' ? 'Ctrl+Shift+L' : 'Cmd+Shift+L'}
                            </Box>
                            <Typography variant="body2" fontWeight={600}>
                              Lens Corrections - Auto perspective
                            </Typography>
                          </Box>
                  }
                        secondary="Automatically correct wide-angle distortion affecting leading lines"
                      />
                    </ListItem>
                    
                    <ListItem sx={{ py:  1 }}>
                      <ListItemText 
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                            <Box sx={{ 
                              display: 'flex', alignItems: 'center', gap:  1,
                              fontFamily: 'monospace', backgroundColor: '#fff3e0',
                              px: 2, py: 1, borderRadius: 1, fontWeight: 600, color: '#f57c00'
                    }}>
                              <Rotate90DegreesCcw sx={{ fontSize: 16}} />
                              {platform === 'windows' ? 'Ctrl+Alt+Shift+T' : 'Cmd+Opt+Shift+T'}
                            </Box>
                            <Typography variant="body2" fontWeight={600}>
                              Transform Again - Repeat adjustments
                            </Typography>
                          </Box>
                  }
                        secondary="Repeat the last transformation for consistent perspective correction"
                      />
                    </ListItem>
                  </List>
                </Grid>
              </Grid>
            </Card>
          )}

          {selectedCompositionTechnique === 'framing' && (
            <Card sx={{ p:  4, border: '2px solid #4caf50', borderRadius:  3 ,  ...theming.getThemedCardSx() }}>
              <Typography variant="h6" sx={{ mb:  3, fontWeight: 600, color: theming.colors.primary }}>
                🖼️ Natural Framing Techniques
              </Typography>
              
              <Grid container spacing={4}>
                <Grid item xs={12} md={6}>
                  <Box sx={{
                    position: 'relative',
                    width: '100%',
                    height: 30,
                    backgroundColor: '#f5f5f5',
                    borderRadius:  2,
                    overflow: 'hidden',
                    border: '3px solid #4caf50'
          }}>
                    {/* Natural frame representation */}
                    <Box sx={{
                      position: 'absolute',
                      top: 0, left: 0, right: 0, bottom: 0,
                      border: '40px solid #8d6e60',
                      borderRadius: '20px 20px 60px 60px'
            }} />
                    <Box sx={{
                      position: 'absolute',
                      top: '45%', left: '50%',
                      transform: 'translate(-5%, -50%)',
                      width:  60, height:  60,
                      backgroundColor: '#4caf50',
                      borderRadius: '50, %',
                      border: '3px solid white'
            }} />
                    <Typography variant="caption" sx={{
                      position: 'absolute',
                      bottom:  8, right:  8,
                      backgroundColor: 'rgba(25,255,255,0.9)',
                      px: 1, py: 0, borderRadius: 1, fontSize: '11px'
            }}>
                      Natural Frame (Brown) - Subject (Green)
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb:  2 }}>
                    Framing Enhancement Shortcuts: </Typography>
                  
                  <List>
                    <ListItem sx={{ py: 1 }}>
                      <ListItemText 
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                            <Box sx={{ 
                              display: 'flex', alignItems: 'center', gap:  1,
                              fontFamily: 'monospace', backgroundColor: '#e8f5e0',
                              px: 2, py: 1, borderRadius: 1, fontWeight: 600, color: '#2e7d32'
                    }}>
                              <Brush sx={{ fontSize: 16}} />
                              {platform === 'windows' ? 'Q' : 'Q'}
                            </Box>
                            <Typography variant="body2" fontWeight={600}>
                              Spot Removal Tool - Clean distracting elements
                            </Typography>
                          </Box>
                  }
                        secondary="Remove unwanted elements that break natural framing"
                      />
                    </ListItem>
                    
                    <ListItem sx={{ py:  1 }}>
                      <ListItemText 
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                            <Box sx={{ 
                              display: 'flex', alignItems: 'center', gap:  1,
                              fontFamily: 'monospace', backgroundColor: '#e8f5e0',
                              px: 2, py: 1, borderRadius: 1, fontWeight: 600, color: '#2e7d32'
                    }}>
                              <Palette sx={{ fontSize: 16}} />
                              {platform === 'windows' ? 'K' : 'K'}
                            </Box>
                            <Typography variant="body2" fontWeight={600}>
                              Adjustment Brush - Enhance frame areas
                            </Typography>
                          </Box>
                  }
                        secondary="Selectively adjust frame areas to enhance the framing effect"
                      />
                    </ListItem>
                    
                    <ListItem sx={{ py:  1 }}>
                      <ListItemText 
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                            <Box sx={{ 
                              display: 'flex', alignItems: 'center', gap:  1,
                              fontFamily: 'monospace', backgroundColor: '#e8f5e0',
                              px: 2, py: 1, borderRadius: 1, fontWeight: 600, color: '#2e7d32'
                    }}>
                              <CameraAlt sx={{ fontSize: 16}} />
                              {platform === 'windows' ? 'Ctrl+Alt+4' : 'Cmd+Opt+4'}
                            </Box>
                            <Typography variant="body2" fontWeight={600}>
                              Vignetting - Add subtle edge darkening
                            </Typography>
                          </Box>
                  }
                        secondary="Create artificial framing with post-crop vignetting"
                      />
                    </ListItem>
                  </List>
                </Grid>
              </Grid>
            </Card>
          )}

          {selectedCompositionTechnique === 'symmetry' && (
            <Card sx={{ p:  4, border: '2px solid #9c27b0', borderRadius:  3 ,  ...theming.getThemedCardSx() }}>
              <Typography variant="h6" sx={{ mb:  3, fontWeight: 600, color: theming.colors.primary }}>
                ⚖️ Symmetry & Balance with Precision Tools
              </Typography>
              
              <Grid container spacing={4}>
                <Grid item xs={12} md={6}>
                  <Box sx={{
                    position: 'relative',
                    width: '100%',
                    height: 30,
                    backgroundColor: '#f5f5f5',
                    borderRadius:  2,
                    overflow: 'hidden',
                    border: '3px solid #9c27b0'
          }}>
                    <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
                      {/* Center line */}
                      <line x1="50%" y1="0%" x2="50%" y2="100%" stroke="#9c27b0" strokeWidth="3" strokeDasharray="10,5" />
                      {/* Left side elements */}
                      <rect x="15%" y="20%" width="25%" height="60%" fill="#e1bee7" stroke="#9c27b0" strokeWidth="2" />
                      {/* Right side elements (mirrored) */}
                      <rect x="60%" y="20%" width="25%" height="60%" fill="#e1bee7" stroke="#9c27b0" strokeWidth="2" />
                      {/* Balance indicator */}
                      <circle cx="25%" cy="50%" r="8" fill="#4caf50" />
                      <circle cx="75%" cy="50%" r="8" fill="#4caf50" />
                    </svg>
                    <Typography variant="caption" sx={{
                      position: 'absolute',
                      bottom:  8, right:  8,
                      backgroundColor: 'rgba(25,255,255,0.9)',
                      px: 1, py: 0, borderRadius: 1, fontSize: '11px'
            }}>
                      Perfect Symmetry with Center Guide
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb:  2 }}>
                    Symmetry & Balance Shortcuts: </Typography>
                  
                  <List>
                    <ListItem sx={{ py: 1 }}>
                      <ListItemText 
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                            <Box sx={{ 
                              display: 'flex', alignItems: 'center', gap:  1,
                              fontFamily: 'monospace', backgroundColor: '#f3e5f0',
                              px: 2, py: 1, borderRadius: 1, fontWeight: 600, color: '#7b1fa2'
                    }}>
                              <Straighten sx={{ fontSize: 16}} />
                              {platform === 'windows' ? 'Ctrl+Shift+;' : 'Cmd+Shift+;'}
                            </Box>
                            <Typography variant="body2" fontWeight={600}>
                              Show Guides - Perfect alignment
                            </Typography>
                          </Box>
                  }
                        secondary="Display guides for precise symmetrical positioning"
                      />
                    </ListItem>
                    
                    <ListItem sx={{ py:  1 }}>
                      <ListItemText 
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                            <Box sx={{ 
                              display: 'flex', alignItems: 'center', gap:  1,
                              fontFamily: 'monospace', backgroundColor: '#f3e5f0',
                              px: 2, py: 1, borderRadius: 1, fontWeight: 600, color: '#7b1fa2'
                    }}>
                              <FlipCameraAndroid sx={{ fontSize: 16}} />
                              {platform === 'windows' ? 'Ctrl+T' : 'Cmd+T'}
                            </Box>
                            <Typography variant="body2" fontWeight={600}>
                              Transform Tool - Flip & mirror
                            </Typography>
                          </Box>
                  }
                        secondary="Use transform controls for precise mirroring and flipping"
                      />
                    </ListItem>
                    
                    <ListItem sx={{ py:  1 }}>
                      <ListItemText 
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                            <Box sx={{ 
                              display: 'flex', alignItems: 'center', gap:  1,
                              fontFamily: 'monospace', backgroundColor: '#f3e5f0',
                              px: 2, py: 1, borderRadius: 1, fontWeight: 600, color: '#7b1fa2'
                    }}>
                              <Straighten sx={{ fontSize: 16}} />
                              {platform === 'windows' ? 'Ctrl+A' : 'Cmd+A'}
                            </Box>
                            <Typography variant="body2" fontWeight={600}>
                              Angle Tool - Straighten horizons
                            </Typography>
                          </Box>
                  }
                        secondary="Perfect horizontal alignment for symmetrical compositions"
                      />
                    </ListItem>
                  </List>
                </Grid>
              </Grid>
            </Card>
          )}

          {selectedCompositionTechnique === 'cropping' && (
            <Card sx={{ p:  4, border: '2px solid #f44336', borderRadius:  3 ,  ...theming.getThemedCardSx() }}>
              <Typography variant="h6" sx={{ mb:  3, fontWeight: 600, color: theming.colors.primary }}>
                ✂️ Creative Cropping Techniques
              </Typography>
              
              <Grid container spacing={4}>
                <Grid item xs={12} md={6}>
                  <Box sx={{
                    position: 'relative',
                    width: '100%',
                    height: 30,
                    backgroundColor: '#f5f5f5',
                    borderRadius:  2,
                    overflow: 'hidden',
                    border: '3px solid #f44336'
          }}>
                    {/* Multiple crop ratios visualization */}
                    <Box sx={{
                      position: 'absolute',
                      top: '10%', left: '10%',
                      width: '80%', height: '45%',
                      border: '3px solid #f44336',
                      backgroundColor: 'rgba(24, 67, 54, 0.1)'
              }}>
                      <Typography variant="caption" sx={{
                        position: 'absolute',
                        top:  4, left:  4,
                        fontSize: '10px', fontWeight: 600, color: '#f44336'
              }}>
                        16: 9 Widescreen
                      </Typography>
                    </Box>
                    
                    <Box sx={{
                      position: 'absolute',
                      top: '25%', left: '25%',
                      width: '50%', height: '50%',
                      border: '3px solid #ff9800',
                      backgroundColor: 'rgba(25, 1520.1)'
              }}>
                      <Typography variant="caption" sx={{
                        position: 'absolute',
                        top:  4, left:  4,
                        fontSize: '10px', fontWeight: 600, color: '#ff9800'
              }}>
                        1: 1 Square
                      </Typography>
                    </Box>
                    
                    <Box sx={{
                      position: 'absolute',
                      top: '30%', left: '35%',
                      width: '30%', height: '40%',
                      border: '3px solid #4caf50',
                      backgroundColor: 'rgba(6, 175, 80, 0.1)'
              }}>
                      <Typography variant="caption" sx={{
                        position: 'absolute',
                        top:  4, left:  4,
                        fontSize: '10px', fontWeight: 600, color: '#4caf50'
              }}>
                        4: 5 Portrait
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb:  2 }}>
                    Advanced Cropping Shortcuts: </Typography>
                  
                  <List>
                    <ListItem sx={{ py: 1 }}>
                      <ListItemText 
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                            <Box sx={{ 
                              display: 'flex', alignItems: 'center', gap:  1,
                              fontFamily: 'monospace', backgroundColor: '#ffebee',
                              px: 2, py: 1, borderRadius: 1, fontWeight: 600, color: '#c62828'
                    }}>
                              <AspectRatio sx={{ fontSize: 16}} />
                              {platform === 'windows' ? 'R' : 'R'}
                            </Box>
                            <Typography variant="body2" fontWeight={600}>
                              Crop Tool - Multiple aspect ratios
                            </Typography>
                          </Box>
                  }
                        secondary="Press 'A' while in crop mode to cycle through aspect ratios"
                      />
                    </ListItem>
                    
                    <ListItem sx={{ py:  1 }}>
                      <ListItemText 
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                            <Box sx={{ 
                              display: 'flex', alignItems: 'center', gap:  1,
                              fontFamily: 'monospace', backgroundColor: '#ffebee',
                              px: 2, py: 1, borderRadius: 1, fontWeight: 600, color: '#c62828'
                    }}>
                              <Rotate90DegreesCcw sx={{ fontSize: 16}} />
                              {platform === 'windows' ? 'X' : 'X'}
                            </Box>
                            <Typography variant="body2" fontWeight={600}>
                              Rotate Crop - Switch orientation
                            </Typography>
                          </Box>
                  }
                        secondary="Rotate crop overlay between landscape and portrait"
                      />
                    </ListItem>
                    
                    <ListItem sx={{ py:  1 }}>
                      <ListItemText 
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                            <Box sx={{ 
                              display: 'flex', alignItems: 'center', gap:  1,
                              fontFamily: 'monospace', backgroundColor: '#ffebee',
                              px: 2, py: 1, borderRadius: 1, fontWeight: 600, color: '#c62828'
                    }}>
                              <CropFree sx={{ fontSize: 16}} />
                              {platform === 'windows' ? 'Ctrl+Alt+R' : 'Cmd+Opt+R'}
                            </Box>
                            <Typography variant="body2" fontWeight={600}>
                              Reset Crop - Return to original
                            </Typography>
                          </Box>
                  }
                        secondary="Reset crop to original image dimensions"
                      />
                    </ListItem>
                  </List>
                </Grid>
              </Grid>
            </Card>
          )}

          {selectedCompositionTechnique === 'exposure' && (
            <Card sx={{ p:  4, border: '2px solid #795548', borderRadius:  3 ,  ...theming.getThemedCardSx() }}>
              <Typography variant="h6" sx={{ mb:  3, fontWeight: 600, color: theming.colors.primary }}>
                💡 Exposure & Focus for Visual Impact
              </Typography>
              
              <Grid container spacing={4}>
                <Grid item xs={12} md={6}>
                  <Box sx={{
                    position: 'relative',
                    width: '100%',
                    height: 30,
                    backgroundColor: '#f5f5f5',
                    borderRadius:  2,
                    overflow: 'hidden',
                    border: '3px solid #795548',
                    background: 'radial-gradient(circle at 50% 4%, #ffffff 20%, #cccccc 40%, #888888 70%, #333333 100%)'
            }}>
                    {/* Focus point */}
                    <Box sx={{
                      position: 'absolute',
                      top: '35%', left: '45%',
                      width:  60, height:  60,
                      backgroundColor: '#ffeb3b',
                      borderRadius: '50, %',
                      border: '3px solid white',
                      boxShadow: '0 0 20px rgba(25,235,59,0.8)'
              }} />
                    
                    {/* Depth of field indicators */}
                    <Box sx={{
                      position: 'absolute',
                      top: '20%', left: '20%',
                      width:  30, height:  30,
                      backgroundColor: '#795548',
                      borderRadius: '50, %',
                      opacity: 0.3 }} />
                    
                    <Box sx={{
                      position: 'absolute',
                      top: '70%', right: '20%',
                      width:  25, height:  25,
                      backgroundColor: '#795548',
                      borderRadius: '50, %',
                      opacity: 0.2 }} />
                    
                    <Typography variant="caption" sx={{
                      position: 'absolute',
                      bottom:  8, right:  8,
                      backgroundColor: 'rgba(25,255,255,0.9)',
                      px: 1, py: 0, borderRadius: 1, fontSize: '11px'
            }}>
                      Sharp Focus (Yellow) - Bokeh (Brown)
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb:  2 }}>
                    Exposure & Focus Control: </Typography>
                  
                  <List>
                    <ListItem sx={{ py: 1 }}>
                      <ListItemText 
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                            <Box sx={{ 
                              display: 'flex', alignItems: 'center', gap:  1,
                              fontFamily: 'monospace', backgroundColor: '#efebe0',
                              px: 2, py: 1, borderRadius: 1, fontWeight: 600, color: '#5d4037'
                    }}>
                              <ZoomIn sx={{ fontSize: 16}} />
                              {platform === 'windows' ? 'Ctrl++' : 'Cmd++'}
                            </Box>
                            <Typography variant="body2" fontWeight={600}>
                              Zoom In - Check focus accuracy
                            </Typography>
                          </Box>
                  }
                        secondary="Zoom to 100% to verify sharpness and focus quality"
                      />
                    </ListItem>
                    
                    <ListItem sx={{ py:  1 }}>
                      <ListItemText 
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                            <Box sx={{ 
                              display: 'flex', alignItems: 'center', gap:  1,
                              fontFamily: 'monospace', backgroundColor: '#efebe0',
                              px: 2, py: 1, borderRadius: 1, fontWeight: 600, color: '#5d4037'
                    }}>
                              <Tune sx={{ fontSize: 16}} />
                              {platform === 'windows' ? 'Ctrl+U' : 'Cmd+U'}
                            </Box>
                            <Typography variant="body2" fontWeight={600}>
                              Clarity/Texture - Enhance details
                            </Typography>
                          </Box>
                  }
                        secondary="Increase clarity to make subjects pop from background"
                      />
                    </ListItem>
                    
                    <ListItem sx={{ py:  1 }}>
                      <ListItemText 
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                            <Box sx={{ 
                              display: 'flex', alignItems: 'center', gap:  1,
                              fontFamily: 'monospace', backgroundColor: '#efebe0',
                              px: 2, py: 1, borderRadius: 1, fontWeight: 600, color: '#5d4037'
                    }}>
                              <Palette sx={{ fontSize: 16}} />
                              {platform === 'windows' ? 'Ctrl+Shift+M' : 'Cmd+Shift+M'}
                            </Box>
                            <Typography variant="body2" fontWeight={600}>
                              Masking - Selective adjustments
                            </Typography>
                          </Box>
                  }
                        secondary="Apply exposure adjustments only to specific areas"
                      />
                    </ListItem>
                  </List>
                </Grid>
              </Grid>
            </Card>
          )}
          
        </AccordionDetails>
      </Accordion>

      {/* Interactive Tool Explanations */}
      <Accordion 
        expanded={expandedAccordion === 'tools'}
        onChange={(e, isExpanded) => setExpandedAccordion(isExpanded ? 'tools' : false)}
        elevation={3}
        sx={{ 
          mt:  3,
          borderRadius: 2, '&:before': { display: 'none' }
  }}
      >
        <AccordionSummary
          expandIcon={theming.getThemedIcon('expandMore')}
          sx={{ 
            backgroundColor: '#4caf501',
            borderRadius: expandedAccordion === 'tools' ? '8px 8px 0 0' : '8px',
            minHeight: 72 }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
            <Tune sx={{ color: '#4caf50', mr: 2, fontSize: 28}} />
            <Box sx={{ flexGrow:  1 }}>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5, color: theming.colors.primary }}>
                🧠 Interaktive Verktøyforklaringer
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Forstå eksakt hvordan curves, histogram, white balance og andre tekniske verktøy fungerer
              </Typography>
            </Box>
            <Chip 
              label="Læring" 
              size="small" 
              color="success"
            />
          </Box>
        </AccordionSummary>
        <AccordionDetails sx={{ p:  0 }}>
          <Box sx={{ p:  3 }}>
            {/* Tool Selection */}
            <Typography variant="h6" sx={{  mb:  3, fontWeight: 600, display: 'flex', alignItems: 'center', gap:  1  }}>
              <Palette sx={{ color: '#4caf50' }} />
              Velg verktøy for dybdelæring
            </Typography>
            
            <Grid container spacing={2} sx={{ mb:  4 }}>
              {technicalTools.map((tool) => {
                const ToolIcon = getIconComponent(tool.icon);
                return (
                  <Grid item xs={12} md={6} lg={4} key={tool.id}>
                    <Card 
                      sx={{ 
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        border: selectedToolExplanation === tool.id ? '3px solid #4caf50' : '2px solid transparent',
                        bgcolor: selectedToolExplanation === tool.id ? '#f1f8e915' : 'background.paper',
                        '&:hover': {
                          transform: 'translateY(-4px)',
                          boxShadow: 6,
                          border: '3px solid #4caf5050'
                        },
                        ...theming.getThemedCardSx()
                      }}
                      onClick={() => setSelectedToolExplanation(selectedToolExplanation === tool.id ? null : tool.id)}
                    >
                      <CardContent sx={{ p:  3 ,  ...theming.getThemedCardSx() }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb:  2 }}>
                          <ToolIcon sx={{ fontSize:  32, color: '#4caf50' }} />
                          <Box>
                            <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1.1rem', color: theming.colors.primary }}>
                              {tool.name}
                            </Typography>
                            <Chip 
                              label={tool.category}
                              size="small" 
                              color="success" 
                              variant="outlined"
                              sx={{ mt: 0.5}}
                            />
                          </Box>
                        </Box>
                        <Typography variant="body2" color="text.secondary">
                          {tool.description}
                        </Typography>
                        {selectedToolExplanation === tool.id && (
                          <Chip 
                            label="Aktiv" 
                            size="small" 
                            color="success"
                            sx={{ mt:  2 }}
                          />
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
              );
        })}
            </Grid>

            {/* Detailed Tool Explanation */}
            {selectedToolExplanation && (
              <Card sx={{ 
                p:  4, 
                border: '2px solid #4caf50', 
                borderRadius:  3,
                background: 'linear-gradient(135deg, #f1f8e915 0%, #e8f5e805 100%)'
        ,  ...theming.getThemedCardSx() }}>
                {(() => {
                  const tool = technicalTools.find(t => t.id === selectedToolExplanation);
                  if (!tool) return null;
                  
                  return (
                    <>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb:  3 }}>
                        {React.createElement(getIconComponent(tool.icon), { sx: { fontSize: 40, color: '#4caf50' } })}
                        <Box>
                          <Typography variant="h4" sx={{ fontWeight: 700, color: theming.colors.primary }}>
                            {tool.name}
                          </Typography>
                          <Typography variant="h6" color="text.secondary" sx={{ color: theming.colors.primary }}>
                            {tool.description}
                          </Typography>
                        </Box>
                      </Box>

                      <Grid container spacing={4}>
                        <Grid item xs={12} md={6}>
                          <Box sx={{ mb:  3 }}>
                            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: theming.colors.primary }}>
                              Hvordan det fungerer: </Typography>
                            <Paper sx={{ p: 3, bgcolor: '#e3f2fd', borderRadius:  2 ,  ...theming.getThemedCardSx() }}>
                              <Typography variant="body1">
                                {tool.explanation.how}
                              </Typography>
                            </Paper>
                          </Box>

                          <Box sx={{ mb:  3 }}>
                            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: theming.colors.primary }}>
                              Hensikten: </Typography>
                            <Paper sx={{ p: 3, bgcolor: '#fff3e0', borderRadius:  2 ,  ...theming.getThemedCardSx() }}>
                              <Typography variant="body1">
                                {tool.explanation.purpose}
                              </Typography>
                            </Paper>
                          </Box>
                        </Grid>

                        <Grid item xs={12} md={6}>
                          <Box sx={{ mb:  3 }}>
                            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: theming.colors.primary }}>
                              📚 Hvordan bruke: </Typography>
                            <Paper sx={{ p: 3, bgcolor: '#f3e5f0', borderRadius:  2 ,  ...theming.getThemedCardSx() }}>
                              <Typography variant="body1">
                                {tool.explanation.usage}
                              </Typography>
                            </Paper>
                          </Box>

                          <Box sx={{ mb:  3 }}>
                            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: theming.colors.primary }}>
                              💡 Profftips: </Typography>
                            <Paper sx={{ p: 3, bgcolor: '#e8f5e0', borderRadius:  2 ,  ...theming.getThemedCardSx() }}>
                              <Typography variant="body1">
                                {tool.explanation.tips}
                              </Typography>
                            </Paper>
                          </Box>
                        </Grid>
                      </Grid>

                      {/* Visual Learning Aid */}
                      <Box sx={{ mt:  4 }}>
                        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: theming.colors.primary }}>
                          📊 Visuell huskeregel: </Typography>
                        <Alert 
                          severity="info"
                          sx={{ 
                            fontSize: '1.1rem', '& .MuiAlert-message': { fontSize: '1.1rem' }
                    }}
                        >
                          {tool.visual}
                        </Alert>
                      </Box>

                      {/* Related Shortcuts */}
                      <Box sx={{ mt:  4 }}>
                          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: theming.colors.primary }}>
                          ⌨️ Relaterte snarveier: </Typography>
                        <Grid container spacing={2}>
                          {[
                            { key: platform === 'windows' ? 'Ctrl+M' : 'Cmd+', action: `${tool.name} Panel`, desc: 'Åpne/lukk verktøypanel' },
                            { key: platform === 'windows' ? 'Shift+Tab' : 'Shift+Tab', action: 'Forrige justeringsverktø', desc: 'Bytt til forrige panel' },
                            { key: platform === 'windows' ? 'Tab' : 'Tab', action: 'Neste justeringsverktø', desc: 'Bytt til neste panel' },
                          ].map((shortcut, index) => (
                            <Grid item xs={12} md={4} key={index}>
                              <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#fafafa' ,  ...theming.getThemedCardSx() }}>
                                <Box sx={{ 
                                  display: 'inline-flex', 
                                  alignItems: 'center',
                                  gap:  1,
                                  bgcolor: '#4caf50',
                                  px:  2,
                                  py:  1,
                                  borderRadius:  1,
                                  fontFamily: 'monospace',
                                  fontWeight: 600,
                                  fontSize: '0.9rem',
                                  border: '2px solid #4caf50',
                                  mb: 1 }}>
                                  <Keyboard sx={{ fontSize:  16, color: '#4caf50' }} />
                                  {shortcut.key}
                                </Box>
                                <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5}}>
                                  {shortcut.action}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {shortcut.desc}
                                </Typography>
                              </Paper>
                            </Grid>
                          ))}
                        </Grid>
                      </Box>
                    </>
                );
          })()}
              </Card>
            )}

            {!selectedToolExplanation && (
              <>
                <Paper sx={{ p:  4, textAlign: 'center', bgcolor: '#f8f9fa', borderRadius: 2, mb:  4 ,  ...theming.getThemedCardSx() }}>
                  <Tune sx={{ fontSize:  48, color: '#4caf50', mb:  2 }} />
                  <Typography variant="h6" color="text.secondary" sx={{  mb:  1  }}>
                    Velg et verktøy ovenfor
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Klikk på et teknisk verktøy for å få detaljerte forklaringer på hvordan det fungerer
                  </Typography>
                </Paper>

                {/* Pro Workflow Tips */}
                <Card
  sx={{
    ...theming.getThemedCardSx(),
    p: 4,
    background: 'linear-gradient(135deg, #ff8c0015 0%, #ff8c0005 100%)',
    border: '2px solid #ff8c0030' }}
>


                  <Typography variant="h5" sx={{  mb:  3, fontWeight: 700, color: '#ff8c00', display: 'flex', alignItems: 'center', gap:  2  }}>
                    <RocketLaunch sx={{ fontSize: 32}} />
                    Raskere & Smartere Redigeringstips
                  </Typography>
                  
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                        <Paper sx={{ p:  3, height: '100%', border: '2px solid #2196f3', borderRadius:  
                        2 ,  ...theming.getThemedCardSx() }}>
                        <Typography variant="h6" sx={{  mb: 2, color: '#2196f3', fontWeight: 600, display: 'flex', alignItems: 'center', gap:  1  }}>
                          <RocketLaunch sx={{ fontSize: 20}} />
                          Arbeidsflyt-hacks
                        </Typography>
                        <List dense>
                          <ListItem sx={{ px:  0 }}>
                            <ListItemText 
                              primary="Kultivering før alt annet"
                              secondary="Rett hvitbalanse + eksponering før du starter detaljarbeid"
                            />
                          </ListItem>
                          <ListItem sx={{ px:  0 }}>
                            <ListItemText 
                              primary="Lag dine egne presets"
                              secondary="Ditt signature-look som 1-klikk preset spar timer"
                            />
                          </ListItem>
                          <ListItem sx={{ px:  0 }}>
                            <ListItemText 
                              primary="Batch alle lignende bilder"
                              secondary="Juster 1 bryllupsbilde → sync til alle 500+ bilder"
                            />
                          </ListItem>
                        </List>
                      </Paper>
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <Paper sx={{ p:  3, height: '100%', border: '2px solid #4caf50', borderRadius:  2 ,  ...theming.getThemedCardSx() }}>
                        <Typography variant="h6" sx={{  mb: 2, color: '#4caf50', fontWeight: 600, display: 'flex', alignItems: 'center', gap:  1  }}>
                          <Brush sx={{ fontSize: 20}} />
                          Retusjeringstricks
                        </Typography>
                        <List dense>
                          <ListItem sx={{ px:  0 }}>
                            <ListItemText 
                              primary="Frequency Separation for hud"
                              secondary="Separer tekstur/farge → perfekt hudretusjering"
                            />
                          </ListItem>
                          <ListItem sx={{ px:  0 }}>
                            <ListItemText 
                              primary="Masker for alt avansert"
                              secondary="Selektive justeringer uten å ødelegge originalen"
                            />
                          </ListItem>
                          <ListItem sx={{ px:  0 }}>
                            <ListItemText 
                              primary="Subtilitet er nøkkelen"
                              secondary="20% opacity × 5 lag = bedre enn 100% × 1 lag"
                            />
                          </ListItem>
                        </List>
                      </Paper>
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <Paper sx={{ p:  3, height: '100%', border: '2px solid #ff9800', borderRadius:  2 ,  ...theming.getThemedCardSx() }}>
                        <Typography variant="h6" sx={{  mb: 2, color: '#ff9800', fontWeight: 600, display: 'flex', alignItems: 'center', gap:  1  }}>
                          <CameraEnhance sx={{ fontSize: 20}} />
                          Eksponeringstricks
                        </Typography>
                        <List dense>
                          <ListItem sx={{ px:  0 }}>
                            <ListItemText 
                              primary="Bruk historgrammet aktivt"
                              secondary="Venstre kant = mister mørke detaljer, høyre = lyse"
                            />
                          </ListItem>
                          <ListItem sx={{ px:  0 }}>
                            <ListItemText 
                              primary="Highlights/Shadows først"
                              secondary="Redder ekstreme områder før overall eksponering"
                            />
                          </ListItem>
                          <ListItem sx={{ px:  0 }}>
                            <ListItemText 
                              primary="Kurver for finesse"
                              secondary="S-kurve for kontrast, omvendt S for mykhet"
                            />
                          </ListItem>
                        </List>
                      </Paper>
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <Paper sx={{ p:  3, height: '100%', border: '2px solid #9c27b0', borderRadius:  2 ,  ...theming.getThemedCardSx() }}>
                        <Typography variant="h6" sx={{  mb: 2, color: '#9c27b0', fontWeight: 600, display: 'flex', alignItems: 'center', gap:  1  }}>
                          <MovieFilter sx={{ fontSize: 20}} />
                          Fargegrade som proff
                        </Typography>
                        <List dense>
                          <ListItem sx={{ px:  0 }}>
                            <ListItemText 
                              primary="Cinematisk formel"
                              secondary="Shadows→cyan/blå, Highlights→orange/gul"
                            />
                          </ListItem>
                          <ListItem sx={{ px:  0 }}>
                            <ListItemText 
                              primary="Bevar hudtoner"
                              secondary="Mask ut ansikter eller bruk Vibrance over Saturation"
                            />
                          </ListItem>
                          <ListItem sx={{ px:  0 }}>
                            <ListItemText 
                              primary="Konsistens er alt"
                              secondary="Lag LUT eller Color Grading preset for hele serien"
                            />
                          </ListItem>
                        </List>
                      </Paper>
                    </Grid>
                  </Grid>

                  {/* Professional Standards Section */}
                  <Box sx={{ mt:  4 }}>
                      <Typography variant="h6" sx={{  mb:  3, fontWeight: 600, color: '#f44336', display: 'flex', alignItems: 'center', gap:  1  }}>
                        <BusinessCenter sx={{ fontSize: 24}} />
                        Profesjonelle standarder og leveranse
                      </Typography>
                      
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={4}>
                          <Alert severity="info" sx={{ height: '100%' }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, display: 'flex', alignItems: 'center', gap:  1 }}>
                            <Print sx={{ fontSize: 16}} />
                            Print kvalitet
                          </Typography>
                          <Typography variant="body2">
                            300 DPI minimum • sRGB fargerom • Unsharp Mask for skarphet
                          </Typography>
                        </Alert>
                      </Grid>
                      
                      <Grid item xs={12} md={4}>
                        <Alert severity="success" sx={{ height: '100%' }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, display: 'flex', alignItems: 'center', gap:  1 }}>
                            <Computer sx={{ fontSize: 16}} />
                            Web leveranse
                          </Typography>
                          <Typography variant="body2">
                            72 DPI • sRGB • Smart Sharpen for web • JPG 90-95% kvalitet
                          </Typography>
                        </Alert>
                      </Grid>
                      
                      <Grid item xs={12} md={4}>
                        <Alert severity="warning" sx={{ height: '100%' }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, display: 'flex', alignItems: 'center', gap:  1 }}>
                            <PhoneAndroid sx={{ fontSize: 16}} />
                            Sosiale medier
                          </Typography>
                          <Typography variant="body2">
                            Instagram: 1080x1080 • Facebook: 1200x630 • Ekstra skarphet
                          </Typography>
                        </Alert>
                      </Grid>
                    </Grid>
                  </Box>

                  {/* Export Formats & Social Media Settings */}
                  <Box sx={{ mt:  4 }}>
                    <Typography variant="h6" sx={{  mb:  3, fontWeight: 600, color: '#2196f3', display: 'flex', alignItems: 'center', gap:  1  }}>
                      <FileDownload sx={{ fontSize: 24}} />
                      Eksporteringsformater & Sosiale Medier Innstillinger
                    </Typography>
                    
                    {/* Export Formats */}
                    <Card sx={{ mb:  3, p:  3, border: '2px solid #2196f3', borderRadius:  2 ,  ...theming.getThemedCardSx() }}>
                      <Typography variant="h6" sx={{  mb: 2, color: '#2196f3', fontWeight: 600, display: 'flex', alignItems: 'center', gap:  1  }}>
                        <Settings sx={{ fontSize: 20}} />
                        Anbefalte Eksporteringsformater
                      </Typography>
                      
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={6} lg={3}>
                          <Alert severity="info" sx={{ height: '100%' }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, display: 'flex', alignItems: 'center', gap:  1 }}>
                              <Image sx={{ fontSize: 16}} />
                              JPEG/JPG
                            </Typography>
                            <Typography variant="body2" sx={{ mb:  1 }}>
                              <strong>Bruk: </strong> Vanlige bilder, web, sosiale medier
                            </Typography>
                            <Typography variant="body2" sx={{ mb:  1 }}>
                              <strong>Kvalitet: </strong> 85-95% for web, 95-100% for print
                            </Typography>
                            <Typography variant="body2">
                              <strong>Fordel: </strong> Små filstørrelser
                            </Typography>
                          </Alert>
                        </Grid>

                        <Grid item xs={12} md={6} lg={3}>
                          <Alert severity="success" sx={{ height: '100%' }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, display: 'flex', alignItems: 'center', gap:  1 }}>
                              <HighQuality sx={{ fontSize: 16}} />
                              TIFF
                            </Typography>
                            <Typography variant="body2" sx={{ mb:  1 }}>
                              <strong>Bruk: </strong> Profesjonell arkivering, print
                            </Typography>
                            <Typography variant="body2" sx={{ mb:  1 }}>
                              <strong>Kvalitet: </strong> Tapsfri kompresjon eller ukomprimert
                            </Typography>
                            <Typography variant="body2">
                              <strong>Fordel:</strong> Høyeste kvalitet
                            </Typography>
                          </Alert>
                        </Grid>

                        <Grid item xs={12} md={6} lg={3}>
                          <Alert severity="warning" sx={{ height: '100%' }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, display: 'flex', alignItems: 'center', gap:  1 }}>
                              <PhotoSizeSelectActual sx={{ fontSize: 16}} />
                              PNG
                            </Typography>
                            <Typography variant="body2" sx={{ mb:  1 }}>
                              <strong>Bruk: </strong> Logoer, grafikk med transparens
                            </Typography>
                            <Typography variant="body2" sx={{ mb:  1 }}>
                              <strong>Kvalitet: </strong> Tapsfri, støtter transparens
                            </Typography>
                            <Typography variant="body2">
                              <strong>Fordel: </strong> Perfekt for grafiske elementer
                            </Typography>
                          </Alert>
                        </Grid>

                        <Grid item xs={12} md={6} lg={3}>
                          <Alert severity="error" sx={{ height: '100%' }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, display: 'flex', alignItems: 'center', gap:  1 }}>
                              <SpeedIcon sx={{ fontSize: 16}} />
                              WebP
                            </Typography>
                            <Typography variant="body2" sx={{ mb:  1 }}>
                              <strong>Bruk: </strong> Moderne web, raskere lasting
                            </Typography>
                            <Typography variant="body2" sx={{ mb:  1 }}>
                              <strong>Kvalitet: </strong> 25-35% mindre enn JPEG
                            </Typography>
                            <Typography variant="body2">
                              <strong>Fordel:</strong> Beste kvalitet/størrelse-forhold
                            </Typography>
                          </Alert>
                        </Grid>
                      </Grid>
                    </Card>

                    {/* Social Media Specifications */}
                    <Card sx={{ p:  3, border: '2px solid #e91e63', borderRadius:  2 ,  ...theming.getThemedCardSx() }}>
                      <Typography variant="h6" sx={{  mb:  3, color: '#e91e63', fontWeight: 600, display: 'flex', alignItems: 'center', gap:  1  }}>
                        <PhoneAndroid sx={{ fontSize: 20}} />
                        Sosiale Medier - Optimale Innstillinger
                      </Typography>
                      
                      <Grid container spacing={3}>
                        {/* Instagram */}
                        <Grid item xs={12} md={6} lg={4}>
                        <Paper
  sx={{
    ...theming.getThemedCardSx(),
    p: 2,
    border: '2px solid #E4405F',
    borderRadius: 2,
    background: 'linear-gradient(135deg, #E4405F15 0%, #E4405F05 100%)' }}
>

                            <Typography variant="h6" sx={{  mb: 2, color: '#E4405F', fontWeight: 600, display: 'flex', alignItems: 'center', gap:  1  }}>
                              <Box 
                                component="svg" 
                                sx={{ fontSize:  18, width:  18, height: 18}}
                                viewBox="0 0 24 24" 
                                fill="currentColor"
                              >
                                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                              </Box>
                              Instagram
                            </Typography>
                            <List dense>
                              <ListItem sx={{ px: 0, py: 0.5}}>
                                <ListItemText 
                                  primary="Feed Post (kvadrat)" 
                                  secondary="1080 x 1080px, JPEG 85-90%"
                                  primaryTypographyProps={{ fontWeight: 600 }}
                                />
                              </ListItem>
                              <ListItem sx={{ px: 0, py: 0.5}}>
                                <ListItemText 
                                  primary="Stories" 
                                  secondary="1080 x 1920px, JPEG/PNG"
                                  primaryTypographyProps={{ fontWeight: 600 }}
                                />
                              </ListItem>
                              <ListItem sx={{ px: 0, py: 0.5}}>
                                <ListItemText 
                                  primary="Reels" 
                                  secondary="1080 x 1920px, MP4 H.264"
                                  primaryTypographyProps={{ fontWeight: 600 }}
                                />
                              </ListItem>
                            </List>
                          </Paper>
                        </Grid>

                        {/* Facebook */}
                        <Grid item xs={12} md={6} lg={4}>
                          <Paper sx={{ p: 2, border: '2px solid #1877F2', borderRadius: 2, background: 'linear-gradient(135deg, #1877F215 0%, #1877F205 100%)' }}>
                            <Typography variant="h6" sx={{  mb: 2, color: '#1877F2', fontWeight: 600, display: 'flex', alignItems: 'center', gap:  1  }}>
                              <Box 
                                component="svg" 
                                sx={{ fontSize:  18, width:  18, height: 18}}
                                viewBox="0 0 24 24" 
                                fill="currentColor"
                              >
                                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                              </Box>
                              Facebook
                            </Typography>
                            <List dense>
                              <ListItem sx={{ px: 0, py: 0.5}}>
                                <ListItemText 
                                  primary="Feed Post" 
                                  secondary="1200 x 630px, JPEG 85%"
                                  primaryTypographyProps={{ fontWeight: 600 }}
                                />
                              </ListItem>
                              <ListItem sx={{ px: 0, py: 0.5}}>
                                <ListItemText 
                                  primary="Cover Photo" 
                                  secondary="820 x 312px, JPEG/PNG"
                                  primaryTypographyProps={{ fontWeight: 600 }}
                                />
                              </ListItem>
                              <ListItem sx={{ px: 0, py: 0.5}}>
                                <ListItemText 
                                  primary="Stories" 
                                  secondary="1080 x 1920px, JPEG/MP4"
                                  primaryTypographyProps={{ fontWeight: 600 }}
                                />
                              </ListItem>
                            </List>
                          </Paper>
                        </Grid>

                        {/* YouTube */}
                        <Grid item xs={12} md={6} lg={4}>
                        <Paper
    sx={{
    ...theming.getThemedCardSx(),
    p: 2,
    border: '2px solid #FF0000',
    borderRadius: 2,
    background: 'linear-gradient(135deg, #FF000015 0%, #FF000005 100%)' }}
>

                            <Typography variant="h6" sx={{  mb: 2, color: '#FF0000', fontWeight: 600, display: 'flex', alignItems: 'center', gap:  1  }}>
                              <VideoFile sx={{ fontSize: 18}} />
                              YouTube
                            </Typography>
                            <List dense>
                              <ListItem sx={{ px: 0, py: 0.5}}>
                                <ListItemText 
                                  primary="Thumbnail" 
                                  secondary="1280 x 720px, JPEG/PNG"
                                  primaryTypographyProps={{ fontWeight: 600 }}
                                />
                              </ListItem>
                              <ListItem sx={{ px: 0, py: 0.5}}>
                                <ListItemText 
                                  primary="Video 4K" 
                                  secondary="3840 x 2160px, MP4 H.264"
                                  primaryTypographyProps={{ fontWeight: 600 }}
                                />
                              </ListItem>
                              <ListItem sx={{ px: 0, py: 0.5}}>
                                <ListItemText 
                                  primary="Video 1080p" 
                                  secondary="1920 x 1080px, MP4 H.264"
                                  primaryTypographyProps={{ fontWeight: 600 }}
                                />
                              </ListItem>
                            </List>
                          </Paper>
                        </Grid>

                        {/* LinkedIn */}
                        <Grid item xs={12} md={6} lg={4}>
                          <Paper sx={{ p: 2, border: '2px solid #0A66C2', borderRadius: 2, background: 'linear-gradient(135deg, #0A66C215 0%, #0A66C205 100%)' }}>
                            <Typography variant="h6" sx={{  mb: 2, color: '#0A66C2', fontWeight: 600, display: 'flex', alignItems: 'center', gap:  1  }}>
                              <Box 
                                component="svg" 
                                sx={{ fontSize:  18, width:  18, height: 18}}
                                viewBox="0 0 24 24" 
                                fill="currentColor"
                              >
                                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                              </Box>
                              LinkedIn
                            </Typography>
                            <List dense>
                              <ListItem sx={{ px: 0, py: 0.5}}>
                                <ListItemText 
                                  primary="Feed Post" 
                                  secondary="1200 x 627px, JPEG 80%"
                                  primaryTypographyProps={{ fontWeight: 600 }}
                                />
                              </ListItem>
                              <ListItem sx={{ px: 0, py: 0.5}}>
                                <ListItemText 
                                  primary="Company Logo" 
                                  secondary="300 x 300px, PNG"
                                  primaryTypographyProps={{ fontWeight: 600 }}
                                />
                              </ListItem>
                              <ListItem sx={{ px: 0, py: 0.5}}>
                                <ListItemText 
                                  primary="Banner" 
                                  secondary="1128 x 191px, JPEG/PNG"
                                  primaryTypographyProps={{ fontWeight: 600 }}
                                />
                              </ListItem>
                            </List>
                          </Paper>
                        </Grid>

                        {/* TikTok */}
                        <Grid item xs={12} md={6} lg={4}>
                          <Paper sx={{ p: 2, border: '2px solid #000000', borderRadius: 2, background: 'linear-gradient(135deg, #00000015 0%, #00000005 100%)' }}>
                            <Typography variant="h6" sx={{  mb: 2, color: '#000000', fontWeight: 600, display: 'flex', alignItems: 'center', gap:  1  }}>
                              <Box 
                                component="svg" 
                                sx={{ fontSize:  18, width:  18, height: 18}}
                                viewBox="0 0 24 24" 
                                fill="currentColor"
                              >
                                <path d="M12.527 6.517c-.838 0-1.518-.68-1.518-1.518S11.689 3.48 12.527 3.48s1.518.681 1.518 1.519-.68 1.518-1.518 1.518zm2.36 1.966v6.034c0 2.684-2.177 4.861-4.861 4.861s-4.861-2.177-4.861-4.861 2.177-4.861 4.861-4.861c.688 0 1.344.143 1.94.402V7.42c-.596-.133-1.211-.202-1.844-.202-3.89 0-7.041 3.151-7.041 7.041s3.151 7.041 7.041 7.041 7.041-3.151 7.041-7.041V8.483c1.505 1.089 3.359 1.739 5.374 1.739v-2.18c-1.505 0-2.889-.653-3.834-1.693z"/>
                              </Box>
                              TikTok
                            </Typography>
                            <List dense>
                              <ListItem sx={{ px: 0, py: 0.5}}>
                                <ListItemText 
                                  primary="Video Post" 
                                  secondary="1080 x 1920px, MP4"
                                  primaryTypographyProps={{ fontWeight: 600 }}
                                />
                              </ListItem>
                              <ListItem sx={{ px: 0, py: 0.5}}>
                                <ListItemText 
                                  primary="Profil Bilde" 
                                  secondary="200 x 200px, JPEG/PNG"
                                  primaryTypographyProps={{ fontWeight: 600 }}
                                />
                              </ListItem>
                              <ListItem sx={{ px: 0, py: 0.5}}>
                                <ListItemText 
                                  primary="Varighet" 
                                  secondary="15 sek - 10 min, 25-50 MB"
                                  primaryTypographyProps={{ fontWeight: 600 }}
                                />
                              </ListItem>
                            </List>
                          </Paper>
                        </Grid>

                        {/* Pinterest */}
                        <Grid item xs={12} md={6} lg={4}>
                        <Paper
  sx={{
    ...theming.getThemedCardSx(),
    p: 2,
    border: '2px solid #E60023',
    borderRadius: 2,
    background: 'linear-gradient(135deg, #E6002315 0%, #E6002305 100%)' }}
>

                            <Typography variant="h6" sx={{  mb: 2, color: '#E60020', fontWeight: 600, display: 'flex', alignItems: 'center', gap:  1  }}>
                              <Image sx={{ fontSize: 18}} />
                              Pinterest
                            </Typography>
                            <List dense>
                              <ListItem sx={{ px: 0, py: 0.5}}>
                                <ListItemText 
                                  primary="Standard Pin" 
                                  secondary="1000 x 1500px (2:  3), JPEG"
                                  primaryTypographyProps={{ fontWeight: 600 }}
                                />
                              </ListItem>
                              <ListItem sx={{ px: 0, py: 0.5}}>
                                <ListItemText 
                                  primary="Square Pin" 
                                  secondary="1000 x 1000px, JPEG/PNG"
                                  primaryTypographyProps={{ fontWeight: 600 }}
                                />
                              </ListItem>
                              <ListItem sx={{ px: 0, py: 0.5}}>
                                <ListItemText 
                                  primary="Video Pin" 
                                  secondary="1000 x 1500px, MP4"
                                  primaryTypographyProps={{ fontWeight: 600 }}
                                />
                              </ListItem>
                            </List>
                          </Paper>
                        </Grid>
                      </Grid>
                    </Card>

                    {/* Pro Export Tips */}
                    <Card sx={{ mt:  3, p:  3, border: '2px solid #4caf50', borderRadius: 2, background: 'linear-gradient(135deg, #4caf5015 0%, #4caf5005 100%)' }}>
                      <Typography variant="h6" sx={{  mb: 2, color: '#4caf50', fontWeight: 600, display: 'flex', alignItems: 'center', gap:  1  }}>
                        <Settings sx={{ fontSize: 20}} />
                        Profesjonelle Eksporteringstips
                      </Typography>
                      
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={4}>
                          <Alert severity="success" sx={{ height: '100%' }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb:  1 }}>
                              Fargerom-innstillinger
                            </Typography>
                            <Typography variant="body2">
                              • sRGB: Web og sosiale medier<br/>
                              • Adobe RGB: Print med større fargerom<br/>
                              • ProPhoto RGB: Avansert redigering
                            </Typography>
                          </Alert>
                        </Grid>
                        
                        <Grid item xs={12} md={4}>
                          <Alert severity="info" sx={{ height: '100%' }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb:  1 }}>
                              Skarphetstips for platform
                            </Typography>
                            <Typography variant="body2">
                              • Instagram: Ekstra skarphet 120-150%<br/>
                              • Facebook: Standard skarphet 100%<br/>
                              • Print: Unsharp Mask 150-300%
                            </Typography>
                          </Alert>
                        </Grid>
                        
                        <Grid item xs={12} md={4}>
                          <Alert severity="warning" sx={{ height: '100%' }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb:  1 }}>
                              Filstørrelse-optimalisering
                            </Typography>
                            <Typography variant="body2">
                              • Instagram: Maks 30MB per bilde<br/>
                              • Facebook: Under 15MB anbefalt<br/>
                              • Web: Under 500KB for rask lasting
                            </Typography>
                          </Alert>
                        </Grid>
                      </Grid>
                    </Card>

                    {/* Program-Specific Export Instructions */}
                    <Card
                      sx={{
    ...theming.getThemedCardSx(),
    mt: 3,
    p: 3,
    border: '2px solid #ff5722',
    borderRadius: 2,
    background: 'linear-gradient(135deg, #ff572215 0%, #ff572205 100%)' }}
>

                      <Typography variant="h6" sx={{  mb:  3, color: '#ff5720', fontWeight: 600, display: 'flex', alignItems: 'center', gap:  1  }}>
                        <Computer sx={{ fontSize: 20}} />
                        Hvordan Eksportere i Ulike Programmer
                      </Typography>
                      
                      <Grid container spacing={3}>
                        {/* Lightroom Export */}
                        <Grid item xs={12} md={6}>
                          <Paper sx={{ p:  3, border: '2px solid #31A8FF', borderRadius: 2, background: 'linear-gradient(135deg, #31A8FF15 0%, #31A8FF05 100%)' }}>
                            <Typography variant="h6" sx={{  mb: 2, color: '#31A8FF', fontWeight: 600, display: 'flex', alignItems: 'center', gap:  1  }}>
                              <PhotoSizeSelectActual sx={{ fontSize: 18}} />
                              Adobe Lightroom
                            </Typography>
                            
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb:  1, color: '#31A8FF' }}>
                              Eksporter bilder: </Typography>
                            <List dense sx={{ mb: 2 }}>
                              <ListItem sx={{ px: 0, py: 0.3}}>
                                <ListItemText 
                                  primary="1. Velg bilder → File → Export (Ctrl+Shift+E)"
                                  primaryTypographyProps={{ fontSize: '0.875rem' }}
                                />
                              </ListItem>
                              <ListItem sx={{ px: 0, py: 0.3}}>
                                <ListItemText 
                                  primary="2. Export Location: Velg mappe"
                                  primaryTypographyProps={{ fontSize: '0.875rem' }}
                                />
                              </ListItem>
                              <ListItem sx={{ px: 0, py: 0.3}}>
                                <ListItemText 
                                  primary="3. File Settings: JPG, sRGB, 85-95% kvalitet"
                                  primaryTypographyProps={{ fontSize: '0.875rem' }}
                                />
                              </ListItem>
                              <ListItem sx={{ px: 0, py: 0.3}}>
                                <ListItemText 
                                  primary="4. Image Sizing: Sett bredde/høyde i piksler"
                                  primaryTypographyProps={{ fontSize: '0.875rem' }}
                                />
                              </ListItem>
                              <ListItem sx={{ px: 0, py: 0.3}}>
                                <ListItemText 
                                  primary="5. Output Sharpening: Velg Screen/Matte/Glossy"
                                  primaryTypographyProps={{ fontSize: '0.875rem' }}
                                />
                              </ListItem>
                            </List>

                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb:  1, color: '#31A8FF' }}>
                              Sosiale medier preset: </Typography>
                            <Typography variant="body2" sx={{ fontSize: '0.875rem', mb:  2 }}>
                              Lag egen Export Preset for Instagram: 1080, pxJPEG 90%, sRGB, Screen sharpening
                            </Typography>

                            {/* Download Presets */}
                            <Box sx={{ display: 'flex', gap:  1, flexWrap: 'wrap' }}>
                              <Button size="small"
                                variant="contained"
                                startIcon={<GetApp sx={{ fontSize: 16}} />}
                                sx={{ 
                                  background: 'linear-gradient(45deg, #31A8FF 30%, #1976d2 90%)',
                                  fontSize: '0.75rem',
                                  textTransform: 'none' }}
                                onClick={() => {
                                  // Create Lightroom export preset content
                                  const presetContent = `s = {
  id = "CreatorHub_Instagram_Preset",
  internalName = "CreatorHub Instagram",
  title = "CreatorHub - Instagram Optimized",
  type = "Export",
  value = {
    exportServiceProvider = "com.adobe.ag.export.file",
    exportServiceProviderTitle = "Hard Drive",
    export_bitDepth = 8,
    export_colorSpace = "sRGB",
    export_destinationType = "specificFolder",
    export_format = "JPEG",
    export_jpeg_quality = 0.90,
    export_postProcessing = "com.adobe.ag.export.post.openInOtherApp",
    export_useSubfolder = true,
    export_subfolder = "Instagram Export",
    format = "JPEG",
    jpeg_quality = 0.90,
    size_doConstrain = true,
    size_doNotEnlarge = true,
    size_maxHeight = 1080,
    size_maxWidth = 1080,
    size_megapixels = 1.0,
    size_percentage = 100,
    size_resizeType = "wh",
    size_resolution = 240,
    size_units = "pixels",
    outputSharpening = 1,
    outputSharpeningMedia = 1,
    outputSharpeningAmount = 1,
}
}`;
                                  const blob = new Blob([presetContent], { type: 'text/plain' });
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = 'CreatorHub_Instagram_Preset.lrtemplate';
                                  document.body.appendChild(a);
                                  a.click();
                                  document.body.removeChild(a);
                                  URL.revokeObjectURL(url);
                          }}
                              >
                                Last ned LR Preset
                              </Button>
                              
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<FilePresent sx={{ fontSize: 16}} />}
                                sx={{ 
                                  borderColor: '#31A8FF',
                                  color: '#31A8FF',
                                  fontSize: '0.75rem',
                                  textTransform: 'none' }}
                                onClick={() => {
                                  // Create comprehensive guide
                                  const guideContent = `LIGHTROOM EXPORT PRESET INSTALLASJON

1. LAST NED PRESET: - Klikk "Last ned LR Preset" knappen
   - Filen heter "CreatorHub_Instagram_Preset.lrtemplate"

2. INSTALLER I LIGHTROOM:
   - Åpne Lightroom
   - Gå til File > Import Develop Profiles and Presets
   - Velg den nedlastede .lrtemplate filen
   - Preset vises nå under "User Presets"

3. BRUK PRESET:
   - I Export-dialogen, velg "CreatorHub - Instagram Optimized"
   - Preset er optimalisert for: 1080x1080, pxJPEG 90%, sRGB, Screen sharpening

4. TILPASS ETTER BEHOV: - Høyreklikk på preset for å redigere
   - Endre mappe-lokasjon eller kvalitet
   - Lagre som ny preset med eget navn

FORDELENE:
✓ Konsistent Instagram-kvalitet
✓ Optimal filstørrelse (under 1MB)
✓ Perfekt fargegjengivelse
✓ Automatisk skarphet for skjerm`;
                                  
                                  const blob = new Blob([guideContent], { type: 'text/plain' });
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = 'Lightroom_Preset_Installasjon_Guide.txt';
                                  document.body.appendChild(a);
                                  a.click();
                                  document.body.removeChild(a);
                                  URL.revokeObjectURL(url);
                          }}
                              >
                                Installasjon Guide
                              </Button>
                            </Box>
                          </Paper>
                        </Grid>

                        {/* Photoshop Export */}
                        <Grid item xs={12} md={6}>
                          <Paper sx={{ p:  3, border: '2px solid #00D4FF', borderRadius: 2, background: 'linear-gradient(135deg, #00D4FF15 0%, #00D4FF05 100%)' }}>
                            <Typography variant="h6" sx={{  mb: 2, color: '#00D4FF', fontWeight: 600, display: 'flex', alignItems: 'center', gap:  1  }}>
                              <Image sx={{ fontSize: 18}} />
                              Adobe Photoshop
                            </Typography>
                            
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb:  1, color: '#00D4FF' }}>
                              Export for Web (moderne):
                            </Typography>
                            <List dense sx={{ mb:  2 }}>
                              <ListItem sx={{ px: 0, py: 0.3}}>
                                <ListItemText 
                                  primary="1. File → Export → Export As (Ctrl+Alt+Shift+W)"
                                  primaryTypographyProps={{ fontSize: '0.875rem' }}
                                />
                              </ListItem>
                              <ListItem sx={{ px: 0, py: 0.3}}>
                                <ListItemText 
                                  primary="2. Velg format: JPG, PNG, WebP"
                                  primaryTypographyProps={{ fontSize: '0.875rem' }}
                                />
                              </ListItem>
                              <ListItem sx={{ px: 0, py: 0.3}}>
                                <ListItemText 
                                  primary="3. Image Size: Skriv inn ønsket størrelse"
                                  primaryTypographyProps={{ fontSize: '0.875rem' }}
                                />
                              </ListItem>
                              <ListItem sx={{ px: 0, py: 0.3}}>
                                <ListItemText 
                                  primary="4. Metadata: None for web, All for arkiv"
                                  primaryTypographyProps={{ fontSize: '0.875rem' }}
                                />
                              </ListItem>
                            </List>

                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb:  1, color: '#00D4FF' }}>
                              Legacy Export for Web: </Typography>
                            <Typography variant="body2" sx={{ fontSize: '0.875rem', mb:  2 }}>
                              File → Export → Save for Web (Legacy) for mer kontroll over kompresjon
                            </Typography>

                            {/* Photoshop Actions Download */}
                            <Box sx={{ display: 'flex', gap:  1, flexWrap: 'wrap' }}>
                              <Button size="small"
                                variant="contained"
                                startIcon={<ExtensionOutlined sx={{ fontSize: 16}} />}
                                sx={{ 
                                  background: 'linear-gradient(45deg, #00D4FF 30%, #0091ea 90%)',
                                  fontSize: '0.75rem',
                                  textTransform: 'none' }}
                                onClick={() => {
                                  // Create Photoshop Action content
                                  const actionContent = `{
  "version": 1"name":"CreatorHub Social Media Actions","description" : "Optimized export actions for social media platforms","actions": [
    {
      "name" : "Instagram Square Export","steps": [
        {"command":"resize","width": 1080"height": 1080"resample" : "bicubic"},
        {"command" : "sharpen","amount": 120"radius": 0.5"threshold": 0},
        {"command":"export","format":"JPEG","quality": 90"colorSpace" : "sRGB"}
      ]
},
    {
      "name" : "Facebook Post Export","steps": [
        {"command":"resize","width": 1200"height": 630"resample" : "bicubic"},
        {"command" : "sharpen","amount": 100"radius": 0.3"threshold": 0},
        {"command":"export","format":"JPEG","quality": 85"colorSpace" : "sRGB"}
      ]
}
  ]
}`;
                                  const blob = new Blob([actionContent], { type: 'application/json' });
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = 'CreatorHub_Social_Actions.atn';
                                  document.body.appendChild(a);
                                  a.click();
                                  document.body.removeChild(a);
                                  URL.revokeObjectURL(url);
                          }}
                              >
                                Last ned PS Actions
                              </Button>
                              
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<ImportExport sx={{ fontSize: 16}} />}
                                sx={{ 
                                  borderColor: '#00D4FF',
                                  color: '#00D4FF',
                                  fontSize: '0.75rem',
                                  textTransform: 'none' }}
                                onClick={() => {
                                  const guideContent = `PHOTOSHOP ACTIONS INSTALLASJON

1. LAST NED ACTIONS: - Klikk "Last ned PS Actions" knappen
   - Filen heter "CreatorHub_Social_Actions.atn"

2. INSTALLER I PHOTOSHOP:
   - Åpne Photoshop
   - Gå til Window > Actions (eller F9)
   - Klikk på Actions panel menu (☰ ikon)
   - Velg "Load Actions..."
   - Velg den nedlastede .atn filen

3. BRUK ACTIONS:
   - I Actions panel, finn "CreatorHub Social Media Actions"
   - Velg ønsket action (Instagram Square Export, Facebook Post Export)
   - Klikk Play-knappen eller trykk F12

4. TILPASS ACTIONS: - Dobbeltklikk på action-steg for å redigere
   - Endre størrelse, kvalitet eller sharpening
   - Record nye actions basert på dine behov

INKLUDERTE ACTIONS: ✓ Instagram Square Export (1080x1080px)
✓ Facebook Post Export (1200x630px)
✓ Automatisk sharpening optimalisert per plattform
✓ Riktig fargerom (sRGB) for web`;
                                  
                                  const blob = new Blob([guideContent], { type: 'text/plain' });
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = 'Photoshop_Actions_Guide.txt';
                                  document.body.appendChild(a);
                                  a.click();
                                  document.body.removeChild(a);
                                  URL.revokeObjectURL(url);
                          }}
                              >
                                Actions Guide
                              </Button>
                            </Box>
                          </Paper>
                        </Grid>

                        {/* Capture One Export */}
                        <Grid item xs={12} md={6}>
                       <Paper
  sx={{
    ...theming.getThemedCardSx(),
    p: 3,
    border: '2px solid #FF3B3B',
    borderRadius: 2,
    background: 'linear-gradient(135deg, #FF3B3B15 0%, #FF3B3B05 100%)' }}
>

                            <Typography variant="h6" sx={{  mb: 2, color: '#FF6B3B', fontWeight: 600, display: 'flex', alignItems: 'center', gap:  1  }}>
                              <CameraEnhance sx={{ fontSize: 18}} />
                              Capture One
                            </Typography>
                            
                              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb:  1, color: '#FF6B3B' }}>
                              Process Recipe oppsett: </Typography>
                            <List dense sx={{ mb: 2 }}>
                              <ListItem sx={{ px: 0, py: 0.3}}>
                                <ListItemText 
                                  primary="1. Åpne Process Recipes panel (høyre side)"
                                  primaryTypographyProps={{ fontSize: '0.875rem' }}
                                />
                              </ListItem>
                              <ListItem sx={{ px: 0, py: 0.3}}>
                                <ListItemText 
                                  primary="2. Lag ny recipe: + ikon, gi navn"
                                  primaryTypographyProps={{ fontSize: '0.875rem' }}
                                />
                              </ListItem>
                              <ListItem sx={{ px: 0, py: 0.3}}>
                                <ListItemText 
                                  primary="3. Format: JPG, TIFF, eller PNG"
                                  primaryTypographyProps={{ fontSize: '0.875rem' }}
                                />
                              </ListItem>
                              <ListItem sx={{ px: 0, py: 0.3}}>
                                <ListItemText 
                                  primary="4. Dimensions: Sett maks bredde/høyde"
                                  primaryTypographyProps={{ fontSize: '0.875rem' }}
                                />
                              </ListItem>
                              <ListItem sx={{ px: 0, py: 0.3}}>
                                <ListItemText 
                                  primary="5. Høyreklikk bilder → Process → Velg recipe"
                                  primaryTypographyProps={{ fontSize: '0.875rem' }}
                                />
                              </ListItem>
                            </List>

                            {/* Capture One Export Settings */}
                            <Box sx={{ display: 'flex', gap:  1, flexWrap: 'wrap' }}>
                              <Button size="small"
                                variant="contained"
                                startIcon={<CloudDownload sx={{ fontSize: 16}} />}
                                sx={{ 
                                  background: 'linear-gradient(45deg, #FF6B35 30%, #e65100 90%)',
                                  fontSize: '0.75rem',
                                  textTransform: 'none' }}
                                onClick={() => {
                                  // Create Capture One export settings
                                  const settingsContent = `{
  "CreatorHub_Instagram_Recipe": {
    "name":"Instagram Square 1080x1080","format":"JPEG","quality": 90"color_space" : "sRGB IEC61966-2.1","dimensions": {
      "width": 1080"height": 1080"method" : "fit_dimensions","allow_upsampling": false
}, "output_sharpening": {
      "enabled": true"media":"screen","amount" : "standard"
}, "metadata": {
      "copyright": true"exif" : "minimal"
}
}, "CreatorHub_YouTube_Thumbnail": {
    "name":"YouTube Thumbnail 1280x720","format":"JPEG","quality": 95"color_space" : "sRGB IEC61966-2.1","dimensions": {
      "width": 1280"height": 720"method" : "fit_dimensions","allow_upsampling": false
}, "output_sharpening": {
      "enabled": true"media":"screen","amount" : "high"
}
}, "CreatorHub_Print_300DPI": {
    "name":"Print Ready 300 DPI","format":"TIFF","quality": 100"color_space" : "Adobe RGB (1998)","dimensions": {
      "width": 3000"height": 3000"method" : "dimensions_and_dpi","dpi": 300 }, "output_sharpening": {
      "enabled": true"media":"glossy_paper","amount" : "standard"
}
}
}`;
                                  const blob = new Blob([settingsContent], { type: 'application/json' });
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = 'CreatorHub_CaptureOne_Recipes.json';
                                  document.body.appendChild(a);
                                  a.click();
                                  document.body.removeChild(a);
                                  URL.revokeObjectURL(url);
                          }}
                              >
                                C1 Eksport-innstillinger
                              </Button>
                              
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<ImportExport sx={{ fontSize: 16}} />}
                                sx={{ 
                                  borderColor: '#FF6B3B',
                                  color: '#FF6B3B',
                                  fontSize: '0.75rem',
                                  textTransform: 'none' }}
                                onClick={() => {
                                  const guideContent = `CAPTURE ONE EKSPORT-INNSTILLINGER

MANUELL OPPSETT AV PROCESS RECIPES: 1. INSTAGRAM SQUARE (1080x1080):
   - Format: JPEG
   - Quality: 90%
   - Color Space: sRGB IEC61966-2.1
   - Dimensions: 1080x1080, pxFit Dimensions
   - Output Sharpening: Screen, Standard
   - File Naming: [Image Name]_instagram

2. YOUTUBE THUMBNAIL (1280x720):
   - Format: JPEG  
   - Quality: 95%
   - Color Space: sRGB IEC61966-2.1
   - Dimensions: 1280x720, pxFit Dimensions
   - Output Sharpening: Screen, High
   - File Naming: [Image Name]_youtube

3. PRINT READY (300 DPI):
   - Format: TIFF (16-bit)
   - Quality: 100%
   - Color Space: Adobe RGB (1998)
   - Dimensions: Størrelse + 300 DPI
   - Output Sharpening: Glossy Paper, Standard
   - File Naming: [Image Name]_print

HVORDAN BRUKE:
1. Høyreklikk på bilder i browser
2. Velg "Process" → Välj recipe
3. Bilder eksporteres til Output-mappen
4. Batch-prosessering: Velg flere bilder

TIPS:
✓ Lagre recipes i User Templates for gjenbruk
✓ Test forskjellige sharpenening-nivåer per plattform
✓ Bruk ICC profiles for konsistent fargegjengivelse`;
                                  
                                  const blob = new Blob([guideContent], { type: 'text/plain' });
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = 'Capture_One_Eksport_Guide.txt';
                                  document.body.appendChild(a);
                                  a.click();
                                  document.body.removeChild(a);
                                  URL.revokeObjectURL(url);
                          }}
                              >
                                C1 Guide
                              </Button>
                            </Box>
                          </Paper>
                        </Grid>

                        {/* DaVinci Resolve Export */}
                        <Grid item xs={12} md={6}>
                         <Paper
  sx={{
    ...theming.getThemedCardSx(),
    p: 3,
    border: '2px solid #FF3B3B',
    borderRadius: 2,
    background: 'linear-gradient(135deg, #FF3B3B15 0%, #FF3B3B05 100%)' }}
>

                            <Typography variant="h6" sx={{  mb: 2, color: '#FF3B3B', fontWeight: 600, display: 'flex', alignItems: 'center', gap:  1  }}>
                              <VideoFile sx={{ fontSize: 18}} />
                              DaVinci Resolve
                            </Typography>
                            
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb:  1, color: '#FF3B3B' }}>
                              Deliver Page eksport: </Typography>
                            <List dense sx={{ mb: 2 }}>
                              <ListItem sx={{ px: 0, py: 0.3}}>
                                <ListItemText 
                                  primary="1. Gå til Deliver page (nederst)"
                                  primaryTypographyProps={{ fontSize: '0.875rem' }}
                                />
                              </ListItem>
                              <ListItem sx={{ px: 0, py: 0.3}}>
                                <ListItemText 
                                  primary="2. Velg preset: YouTube, Vimeo, eller Custom"
                                  primaryTypographyProps={{ fontSize: '0.875rem' }}
                                />
                              </ListItem>
                              <ListItem sx={{ px: 0, py: 0.3}}>
                                <ListItemText 
                                  primary="3. Format: M4, MOV, eller Export Still"
                                  primaryTypographyProps={{ fontSize: '0.875rem' }}
                                />
                              </ListItem>
                              <ListItem sx={{ px: 0, py: 0.3}}>
                                <ListItemText 
                                  primary="4. Resolution:  4K, 1080p, eller Custom"
                                  primaryTypographyProps={{ fontSize: '0.875rem' }}
                                />
                              </ListItem>
                              <ListItem sx={{ px: 0, py: 0.3}}>
                                <ListItemText 
                                  primary="5. Add to Render Queue → Start Render"
                                  primaryTypographyProps={{ fontSize: '0.875rem' }}
                                />
                              </ListItem>
                            </List>

                            {/* DaVinci Resolve Export Presets */}
                            <Box sx={{ display: 'flex', gap:  1, flexWrap: 'wrap' }}>
                              <Button size="small"
                                variant="contained"
                                startIcon={<CloudDownload sx={{ fontSize: 16}} />}
                                sx={{ 
                                  background: 'linear-gradient(45deg, #FF3B3B 30%, #d32f2f 90%)',
                                  fontSize: '0.75rem',
                                  textTransform: 'none' }}
                                onClick={() => {
                                  // Create comprehensive DaVinci export presets
                                  const presetContent = `<?xml version="1.0" encoding="UTF-8"?>
<resolve_export_presets version="19.0">
  
  <!-- PAL PRESETS (25fps, Europa/Norge) -->
  <preset name="CreatorHub - Instagram Square (PAL 25fps)">
    <format>mp4</format>
    <codec>h264</codec>
    <resolution>
      <width>1080</width>
      <height>1080</height>
    </resolution>
    <framerate>25</framerate>
    <tv_standard>PAL</tv_standard>
    <video_bitrate>8000</video_bitrate>
    <profile>high</profile>
    <level>4.2</level>
    <keyframe_interval>25</keyframe_interval>
    <audio_codec>aac</audio_codec>
    <audio_bitrate>128</audio_bitrate>
    <audio_samplerate>48000</audio_samplerate>
    <colorspace>Rec.709</colorspace>
    <gamma>Rec.709</gamma>
  </preset>

  <preset name="CreatorHub - YouTube 1080p (PAL 25fps)">
    <format>mp4</format>
    <codec>h264</codec>
    <resolution>
      <width>1920</width>
      <height>1080</height>
    </resolution>
    <framerate>25</framerate>
    <tv_standard>PAL</tv_standard>
    <video_bitrate>12000</video_bitrate>
    <profile>high</profile>
    <level>4.2</level>
    <keyframe_interval>50</keyframe_interval>
    <audio_codec>aac</audio_codec>
    <audio_bitrate>192</audio_bitrate>
    <audio_samplerate>48000</audio_samplerate>
    <colorspace>Rec.709</colorspace>
    <gamma>Rec.709</gamma>
  </preset>

  <preset name="CreatorHub - TikTok Vertical (PAL 25fps)">
    <format>mp4</format>
    <codec>h264</codec>
    <resolution>
      <width>1080</width>
      <height>1920</height>
    </resolution>
    <framerate>25</framerate>
    <tv_standard>PAL</tv_standard>
    <video_bitrate>10000</video_bitrate>
    <profile>high</profile>
    <level>4.2</level>
    <keyframe_interval>25</keyframe_interval>
    <audio_codec>aac</audio_codec>
    <audio_bitrate>128</audio_bitrate>
    <audio_samplerate>48000</audio_samplerate>
    <colorspace>Rec.709</colorspace>
    <gamma>Rec.709</gamma>
  </preset>

  <!-- NTSC PRESETS (29.97fps/30fps, USA/Canada) -->
  <preset name="CreatorHub - Instagram Square (NTSC 30fps)">
    <format>mp4</format>
    <codec>h264</codec>
    <resolution>
      <width>1080</width>
      <height>1080</height>
    </resolution>
    <framerate>29.97</framerate>
    <tv_standard>NTSC</tv_standard>
    <video_bitrate>8000</video_bitrate>
    <profile>high</profile>
    <level>4.2</level>
    <keyframe_interval>30</keyframe_interval>
    <audio_codec>aac</audio_codec>
    <audio_bitrate>128</audio_bitrate>
    <audio_samplerate>48000</audio_samplerate>
    <colorspace>Rec.709</colorspace>
    <gamma>Rec.709</gamma>
  </preset>

  <preset name="CreatorHub - YouTube 1080p (NTSC 30fps)">
    <format>mp4</format>
    <codec>h264</codec>
    <resolution>
      <width>1920</width>
      <height>1080</height>
    </resolution>
    <framerate>29.97</framerate>
    <tv_standard>NTSC</tv_standard>
    <video_bitrate>12000</video_bitrate>
    <profile>high</profile>
    <level>4.2</level>
    <keyframe_interval>60</keyframe_interval>
    <audio_codec>aac</audio_codec>
    <audio_bitrate>192</audio_bitrate>
    <audio_samplerate>48000</audio_samplerate>
    <colorspace>Rec.709</colorspace>
    <gamma>Rec.709</gamma>
  </preset>

  <preset name="CreatorHub - TikTok Vertical (NTSC 30fps)">
    <format>mp4</format>
    <codec>h264</codec>
    <resolution>
      <width>1080</width>
      <height>1920</height>
    </resolution>
    <framerate>30</framerate>
    <tv_standard>NTSC</tv_standard>
    <video_bitrate>10000</video_bitrate>
    <profile>high</profile>
    <level>4.2</level>
    <keyframe_interval>30</keyframe_interval>
    <audio_codec>aac</audio_codec>
    <audio_bitrate>128</audio_bitrate>
    <audio_samplerate>48000</audio_samplerate>
    <colorspace>Rec.709</colorspace>
    <gamma>Rec.709</gamma>
  </preset>

  <!-- UNIVERSAL/MASTER PRESETS -->
  <preset name="CreatorHub - ProRes 422 Master (PAL)">
    <format>mov</format>
    <codec>prores_422</codec>
    <resolution>
      <width>1920</width>
      <height>1080</height>
    </resolution>
    <framerate>25</framerate>
    <tv_standard>PAL</tv_standard>
    <profile>standard</profile>
    <audio_codec>pcm_s24le</audio_codec>
    <audio_bitrate>uncompressed</audio_bitrate>
    <audio_samplerate>48000</audio_samplerate>
    <colorspace>Rec.709</colorspace>
    <gamma>Rec.709</gamma>
  </preset>

  <preset name="CreatorHub - ProRes 422 Master (NTSC)">
    <format>mov</format>
    <codec>prores_422</codec>
    <resolution>
      <width>1920</width>
      <height>1080</height>
    </resolution>
    <framerate>29.97</framerate>
    <tv_standard>NTSC</tv_standard>
    <profile>standard</profile>
    <audio_codec>pcm_s24le</audio_codec>
    <audio_bitrate>uncompressed</audio_bitrate>
    <audio_samplerate>48000</audio_samplerate>
    <colorspace>Rec.709</colorspace>
    <gamma>Rec.709</gamma>
  </preset>

</resolve_export_presets>`;
                                  const blob = new Blob([presetContent], { type: 'application/xml' });
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = 'CreatorHub_DaVinci_Export_Presets.xml';
                                  document.body.appendChild(a);
                                  a.click();
                                  document.body.removeChild(a);
                                  URL.revokeObjectURL(url);
                          }}
                              >
                                DaVinci Eksport-preset
                              </Button>
                              
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<FilePresent sx={{ fontSize: 16}} />}
                                sx={{ 
                                  borderColor: '#FF3B30',
                                  color: '#FF3B30',
                                  fontSize: '0.75rem',
                                  textTransform: 'none'
                        }}
                                onClick={() => {
                                  const exportSettings = `DAVINCI RESOLVE EKSPORT-INNSTILLINGER

KRITISK: VELG RIKTIG TV-STANDARD!

PAL STANDARD (Europa/Norge - 25fps):
- Brukes i Norge, Europa, Australia
- Frame Rate: 25fps eller 50fps
- Standard for europeiske kanaler og produksjoner

NTSC STANDARD (USA/Canada - 29.97fps/30fps):
- Brukes i UA, Canada, Japan
- Frame Rate: 29.97fps, 30fps eller 59.94fps
- Standard for amerikanske plattformer

PRESET INNSTILLINGER: === PAL PRESETS (Norge/Europa) ===

1. INSTAGRAM SQUARE PAL (1080x1080):
   - Format: MP4
   - Codec: H.24, High Profile
   - Resolution: 1080x1080px
   - Frame Rate: 25fps (PAL)
   - TV Standard: PAL
   - Video Bitrate: 8 Mbps (CBR)
   - Audio: AC, 128kbps, 48kHz Stereo
   - Color Space: Rec.709

2. YOUTUBE 1080P PAL (1920x1080):
   - Format: MP4
   - Codec: H.24, High Profile
   - Resolution: 1920x1080px
   - Frame Rate: 25fps (PAL)
   - TV Standard: PAL
   - Video Bitrate: 12 Mbps (VBR)
   - Audio: AC, 192kbps, 48kHz Stereo
   - Color Space: Rec.709

3. TIKTOK VERTIKAL PAL (1080x1920):
   - Format: MP4
   - Codec: H.24, High Profile
   - Resolution: 1080x1920px
   - Frame Rate: 25fps (PAL)
   - TV Standard: PAL
   - Video Bitrate: 10 Mbps (CBR)
   - Audio: AC, 128kbps, 48kHz Stereo
   - Color Space: Rec.709

=== NTSC PRESETS (USA/Globalt) ===

4. INSTAGRAM SQUARE NTSC (1080x1080):
   - Format: MP4
   - Codec: H.24, High Profile
   - Resolution: 1080x1080px
   - Frame Rate: 29.97fps (NTSC)
   - TV Standard: NTSC
   - Video Bitrate: 8 Mbps (CBR)
   - Audio: AC, 128kbps, 48kHz Stereo
   - Color Space: Rec.709

5. YOUTUBE 1080P NTSC (1920x1080):
   - Format: MP4
   - Codec: H.24, High Profile
   - Resolution: 1920x1080px
   - Frame Rate: 29.97fps (NTSC)
   - TV Standard: NTSC
   - Video Bitrate: 12 Mbps (VBR)
   - Audio: AC, 192kbps, 48kHz Stereo
   - Color Space: Rec.709

6. TIKTOK VERTIKAL NTSC (1080x1920):
   - Format: MP4
   - Codec: H.24, High Profile
   - Resolution: 1080x1920px
   - Frame Rate: 30fps (NTSC)
   - TV Standard: NTSC
   - Video Bitrate: 10 Mbps (CBR)
   - Audio: AC, 128kbps, 48kHz Stereo
   - Color Space: Rec.709

=== MASTER PRESETS ===

7. PRORES MASTER PAL:
   - Format: MOV
   - Codec: Apple ProRes 422
   - Resolution: 1920x1080px (eller original)
   - Frame Rate: 25fps (PAL)
   - Audio: PCM 24-bit, 48kHz
   - Color Space: Rec.709

8. PRORES MASTER NTSC:
   - Format: MOV
   - Codec: Apple ProRes 422
   - Resolution: 1920x1080px (eller original)
   - Frame Rate: 29.97fps (NTSC)
   - Audio: PCM 24-bit, 48kHz
   - Color Space: Rec.709,
    DELIVER PAGE WORKFLOW:
1. Gå til Deliver page
2. Velg Custom preset
3. VIKTIG: Sett riktig TV Standard (PAL/NTSC)
4. Endre innstillinger som vist over
5. Lagre som ny preset (Save As)
6. Add to Render Queue
7. Start Render

VALG AV STANDARD:
✓ PAL (25fps): Norske TV-kanaler, europeiske kunder
✓ NTSC (29.97fps): Amerikanske plattformer, globale sosiale medier
✓ Match original materiale hvis mulig
✓ Spør kunden om målregion ved usikkerhet

OPTIMALISERING TIPS: ✓ Bruk H.264 for sosiale medier (best kompatibilitet)
✓ Bruk ProRes for videreredigering eller arkivering
✓ Test forskjellige bitrates basert på innhold
✓ Match framerate til original materiale
✓ Bruk CBR for direktestr, øVBR for upload`;
                                  
                                  const blob = new Blob([exportSettings], { type: 'text/plain' });
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = 'DaVinci_Resolve_Eksport_Guide.txt';
                                  document.body.appendChild(a);
                                  a.click();
                                  document.body.removeChild(a);
                                  URL.revokeObjectURL(url);
                          }}
                              >
                                DaVinci Guide
                              </Button>
                            </Box>
                          </Paper>
                        </Grid>

                        {/* Premiere Pro Export */}
                        <Grid item xs={12} md={6}>
                          <Paper sx={{ p:  3, border: '2px solid #9966F0', borderRadius: 2, background: 'linear-gradient(135deg, #9966FF15 0%, #9966FF05 100%)' ,  ...theming.getThemedCardSx() }}>
                            <Typography variant="h6" sx={{  mb: 2, color: '#9966F0', fontWeight: 600, display: 'flex', alignItems: 'center', gap:  1  }}>
                              <MovieFilter sx={{ fontSize: 18}} />
                              Adobe Premiere Pro
                            </Typography>
                            
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb:  1, color: '#9966FF' }}>
                              Media Encoder eksport: </Typography>
                            <List dense sx={{ mb: 2 }}>
                              <ListItem sx={{ px: 0, py: 0.3}}>
                                <ListItemText 
                                  primary="1. File → Export → Media (Ctrl+M)"
                                  primaryTypographyProps={{ fontSize: '0.875rem' }}
                                />
                              </ListItem>
                              <ListItem sx={{ px: 0, py: 0.3}}>
                                <ListItemText 
                                  primary="2. Format: H.264 for web, ProRes for kvalitet"
                                  primaryTypographyProps={{ fontSize: '0.875rem' }}
                                />
                              </ListItem>
                              <ListItem sx={{ px: 0, py: 0.3}}>
                                <ListItemText 
                                  primary="3. Preset: YouTube 108, 0Match Source"
                                  primaryTypographyProps={{ fontSize: '0.875rem' }}
                                />
                              </ListItem>
                              <ListItem sx={{ px: 0, py: 0.3}}>
                                <ListItemText 
                                  primary="4. Output Name: Sett filnavn og lokasjon"
                                  primaryTypographyProps={{ fontSize: '0.875rem' }}
                                />
                              </ListItem>
                              <ListItem sx={{ px: 0, py: 0.3}}>
                                <ListItemText 
                                  primary="5. Queue in AME eller Export direkte"
                                  primaryTypographyProps={{ fontSize: '0.875rem' }}
                                />
                              </ListItem>
                            </List>

                            {/* Premiere Pro Export Settings */}
                            <Box sx={{ display: 'flex', gap:  1, flexWrap: 'wrap' }}>
                              <Button size="small"
                                variant="contained"
                                startIcon={<CloudDownload sx={{ fontSize: 16}} />}
                                sx={{ 
                                  background: 'linear-gradient(45deg, #9966FF 30%, #7b1fa2 90%)',
                                  fontSize: '0.75rem',
                                  textTransform: 'none' }}
                                onClick={() => {
                                  // Create Premiere Pro export presets
                                  const presetContent = `{
  "premiere_export_presets": {
    "version":"2024","description" : "CreatorHub Norge Export Presets with PAL and NTSC standards","presets": [
      {
        "name":"CreatorHub - Instagram Square (PAL 25fps)","format" : "H.264","video": {
          "width": 1080"height": 1080"pixel_aspect_ratio":"1.0","frame_rate": 25"field_order":"Progressive","tv_standard":"PAL","bitrate_encoding":"CBR","target_bitrate": 8"maximum_bitrate": 10"profile" : "High","level": 4.2 }, "audio": {
          "codec":"AAC","sample_rate": 48000"channels" : "Stereo","bitrate": 128 }, "multiplexer": {
          "format" : "MP4"
  }
},
      {
        "name":"CreatorHub - Instagram Square (NTSC 30fps)","format" : "H.264","video": {
          "width": 1080"height": 1080"pixel_aspect_ratio":"1.0","frame_rate": 29.97"field_order":"Progressive","tv_standard":"NTSC","bitrate_encoding":"CBR","target_bitrate": 8"maximum_bitrate": 10"profile" : "High","level": 4.2 }, "audio": {
          "codec":"AAC","sample_rate": 48000"channels" : "Stereo","bitrate": 128 }, "multiplexer": {
          "format" : "MP4"
  }
},
      {
        "name":"CreatorHub - YouTube 1080p (PAL 25fps)","format" : "H.264","video": {
          "width": 1920"height": 1080"pixel_aspect_ratio":"1.0","frame_rate": 25"field_order":"Progressive","tv_standard":"PAL","bitrate_encoding":"VBR, 2 pass","target_bitrate": 12"maximum_bitrate": 15"profile" : "High","level": 4.2 }, "audio": {
          "codec":"AAC","sample_rate": 48000"channels" : "Stereo","bitrate": 192 }, "multiplexer": {
          "format" : "MP4"
  }
},
      {
        "name":"CreatorHub - YouTube 1080p (NTSC 30fps)","format" : "H.264","video": {
          "width": 1920"height": 1080"pixel_aspect_ratio":"1.0","frame_rate": 29.97"field_order":"Progressive","tv_standard":"NTSC","bitrate_encoding":"VBR, 2 pass","target_bitrate": 12"maximum_bitrate": 15"profile" : "High","level": 4.2 }, "audio": {
          "codec":"AAC","sample_rate": 48000"channels" : "Stereo","bitrate": 192 }, "multiplexer": {
          "format" : "MP4"
  }
},
      {
        "name":"CreatorHub - TikTok Vertical (PAL 25fps)","format" : "H.264","video": {
          "width": 1080"height": 1920"pixel_aspect_ratio":"1.0","frame_rate": 25"field_order":"Progressive","tv_standard":"PAL","bitrate_encoding":"CBR","target_bitrate": 10"maximum_bitrate": 12"profile" : "High","level": 4.2 }, "audio": {
          "codec":"AAC","sample_rate": 48000"channels" : "Stereo","bitrate": 128 }, "multiplexer": {
          "format" : "MP4"
  }
},
      {
        "name":"CreatorHub - TikTok Vertical (NTSC 30fps)","format" : "H.264","video": {
          "width": 1080"height": 1920"pixel_aspect_ratio":"1.0","frame_rate": 30"field_order":"Progressive","tv_standard":"NTSC","bitrate_encoding":"CBR","target_bitrate": 10"maximum_bitrate": 12"profile" : "High","level": 4.2 }, "audio": {
          "codec":"AAC","sample_rate": 48000"channels" : "Stereo","bitrate": 128 }"multiplexer": {
          "format" : "MP4"
  }
}
    ]
}
}`;
                                  const blob = new Blob([presetContent], { type: 'application/json' });
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = 'CreatorHub_Premiere_Export_Settings.json';
                                  document.body.appendChild(a);
                                  a.click();
                                  document.body.removeChild(a);
                                  URL.revokeObjectURL(url);
                          }}
                              >
                                Premiere Eksport-innstillinger
                              </Button>
                              
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<LibraryBooks sx={{ fontSize: 16}} />}
                                sx={{ 
                                  borderColor: '#9966FF',
                                  color: '#9966FF',
                                  fontSize: '0.75rem',
                                  textTransform: 'none' }}
                                onClick={() => {
                                  const exportGuide = `PREMIERE PRO EKSPORT-INNSTILLINGER

KRITISK: VELG RIKTIG TV-STANDARD!

PAL vs NTSC i Premiere Pro:
- PAL: 25fps (Norge/Europa)
- NTSC: 29.97fps (USA/Canada)
- Timeline Settings → General → Timebase må matche eksport

MANUELL OPPSETT (File → Export → Media):

=== PAL PRESETS (Norge/Europa - 25fps) ===

1. INSTAGRAM SQUARE PAL (1080x1080):
   - Format: H.264
   - Preset: Custom
   - Video Tab:
     * Width: 100, Height: 1080
     * Frame Rate: 25fps (PAL)
     * TV Standard: PAL
     * Pixel Aspect Ratio: 1.0 (Square)
     * Bitrate Encoding: CBR
     * Target Bitrate: 8 Mbps
     * Profile: High, Level: 4.2
   - Audio Tab:
     * Codec: AAC
     * Sample Rate: 48000 Hz
     * Channels: Stereo
     * Bitrate: 128 kbps

2. YOUTUBE 1080P PAL (1920x1080):
   - Format: H.264
   - Preset: Custom
   - Video Tab:
     * Width: 190, Height: 1080
     * Frame Rate: 25fps (PAL)
     * TV Standard: PAL
     * Bitrate Encoding: VR, 2 pass
     * Target Bitrate: 12 Mbps
     * Maximum Bitrate: 15 Mbps
     * Profile: High, Level: 4.2
   - Audio Tab:
     * Codec: AAC
     * Sample Rate: 48000 Hz
     * Channels: Stereo
     * Bitrate: 192 kbps

3. TIKTOK VERTIKAL PAL (1080x1920):
   - Format: H.264
   - Preset: Custom
   - Video Tab:
     * Width: 100, Height: 1920
     * Frame Rate: 25fps (PAL)
     * TV Standard: PAL
     * Bitrate Encoding: CBR
     * Target Bitrate: 10 Mbps
     * Profile: High, Level: 4.2
   - Audio Tab:
     * Codec: AAC
     * Sample Rate: 48000 Hz
     * Channels: Stereo
     * Bitrate: 128 kbps

=== NTSC PRESETS (USA/Globalt - 29.97fps) ===

4. INSTAGRAM SQUARE NTSC (1080x1080):
   - Format: H.264
   - Preset: Custom
   - Video Tab:
     * Width: 100, Height: 1080
     * Frame Rate: 29.97fps (NTSC)
     * TV Standard: NTSC
     * Pixel Aspect Ratio: 1.0 (Square)
     * Bitrate Encoding: CBR
     * Target Bitrate: 8 Mbps
     * Profile: High, Level: 4.2
   - Audio Tab:
     * Codec: AAC
     * Sample Rate: 48000 Hz
     * Channels: Stereo
     * Bitrate: 128 kbps

5. YOUTUBE 1080P NTSC (1920x1080):
   - Format: H.264
   - Preset: Custom
   - Video Tab:
     * Width: 190, Height: 1080
     * Frame Rate: 29.97fps (NTSC)
     * TV Standard: NTSC
     * Bitrate Encoding: VR, 2 pass
     * Target Bitrate: 12 Mbps
     * Maximum Bitrate: 15 Mbps
     * Profile: High, Level: 4.2
   - Audio Tab:
     * Codec: AAC
     * Sample Rate: 48000 Hz
     * Channels: Stereo
     * Bitrate: 192 kbps

6. TIKTOK VERTIKAL NTSC (1080x1920):
   - Format: H.264
   - Preset: Custom
   - Video Tab:
     * Width: 100, Height: 1920
     * Frame Rate: 30fps (NTSC)
     * TV Standard: NTSC
     * Bitrate Encoding: CBR
     * Target Bitrate: 10 Mbps
     * Profile: High, Level: 4.2
   - Audio Tab:
     * Codec: AAC
     * Sample Rate: 48000 Hz
     * Channels: Stereo
     * Bitrate: 128 kbps

TIMELINE vs EKSPORT MATCHING:
✓ Timeline: 25fps → Eksport: 25fps (PAL)
✓ Timeline: 29.97fps → Eksport: 29.97fps (NTSC)
✓ Timeline: 30fps → Eksport: 30fps (NTSC)
✗ ALDRI bland forskjellige standards!

WORKFLOW TIPS:
✓ Sjekk Timeline Settings før eksport
✓ Lagre custom presets: Save Preset (disk-ikon)
✓ Bruk Media Encoder for batch-eksport
✓ Queue multiple exports med forskjellige innstillinger
✓ Preview eksport med In/Out points først
✓ Check "Use Maximum Render Quality" for best kvalitet
✓ Match original materiale framerate når mulig

REGION GUIDE:
✓ PAL (25fps): Norge, Europa, Australia
✓ NTSC (29.97fps): USA, Canada, Japan, globale plattformer`;
                                  
                                  const blob = new Blob([exportGuide], { type: 'text/plain' });
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = 'Premiere_Pro_Eksport_Guide.txt';
                                  document.body.appendChild(a);
                                  a.click();
                                  document.body.removeChild(a);
                                  URL.revokeObjectURL(url);
                          }}
                              >
                                Premiere Guide
                              </Button>
                            </Box>
                          </Paper>
                        </Grid>

                        {/* Canva Export */}
                        <Grid item xs={12} md={6}>
                          <Paper sx={{ p:  3, border: '2px solid #00C4CC', borderRadius: 2, background: 'linear-gradient(135deg, #00C4CC15 0%, #00C4CC05 100%)' ,  ...theming.getThemedCardSx() }}>
                            <Typography variant="h6" sx={{  mb: 2, color: '#00C4CC', fontWeight: 600, display: 'flex', alignItems: 'center', gap:  1  }}>
                              <Brush sx={{ fontSize: 18}} />
                              Canva
                            </Typography>
                            
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb:  1, color: '#00C4CC' }}>
                              Download alternativer: </Typography>
                            <List dense sx={{ mb: 2 }}>
                              <ListItem sx={{ px: 0, py: 0.3}}>
                                <ListItemText 
                                  primary="1. Klikk 'Share' knappen (øverst høyre)"
                                  primaryTypographyProps={{ fontSize: '0.875rem' }}
                                />
                              </ListItem>
                              <ListItem sx={{ px: 0, py: 0.3}}>
                                <ListItemText 
                                  primary="2. Velg 'Download' fra dropdown-menyen"
                                  primaryTypographyProps={{ fontSize: '0.875rem' }}
                                />
                              </ListItem>
                              <ListItem sx={{ px: 0, py: 0.3}}>
                                <ListItemText 
                                  primary="3. File type: PNG (transparens), JPEG (solid)"
                                  primaryTypographyProps={{ fontSize: '0.875rem' }}
                                />
                              </ListItem>
                              <ListItem sx={{ px: 0, py: 0.3}}>
                                <ListItemText 
                                  primary="4. Velg 'Current page' eller 'All pages'"
                                  primaryTypographyProps={{ fontSize: '0.875rem' }}
                                />
                              </ListItem>
                              <ListItem sx={{ px: 0, py: 0.3}}>
                                <ListItemText 
                                  primary="5. Klikk 'Download' for å laste ned"
                                  primaryTypographyProps={{ fontSize: '0.875rem' }}
                                />
                              </ListItem>
                            </List>
                          </Paper>
                        </Grid>
                      </Grid>
                    </Card>

                    {/* Quick Export Shortcuts */}
                    <Card sx={{ mt:  3, p:  3, border: '2px solid #9c27b0', borderRadius: 2, background: 'linear-gradient(135deg, #9c27b015 0%, #9c27b005 100%)' ,  ...theming.getThemedCardSx() }}>
                      <Typography variant="h6" sx={{  mb: 2, color: '#9c27b0', fontWeight: 600, display: 'flex', alignItems: 'center', gap:  1  }}>
                        <Keyboard sx={{ fontSize: 20}} />
                        Raskere Eksport med Shortcuts
                      </Typography>
                      
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                          <Alert severity="info" sx={{ height: '100%' }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb:  1 }}>
                              Adobe Programmer
                            </Typography>
                            <Typography variant="body2">
                              • Lightroom: Ctrl+Shift+E (Export)<br/>
                              • Photoshop: Ctrl+Alt+Shift+W (Export As)<br/>
                              • Premiere Pro: Ctrl+M (Media Encoder)
                            </Typography>
                          </Alert>
                        </Grid>
                        
                        <Grid item xs={12} md={6}>
                          <Alert severity="success" sx={{ height: '100%' }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb:  1 }}>
                              Pro Tips for Raskere Workflow
                            </Typography>
                            <Typography variant="body2">
                              • Lag eksport-presets for gjentakende formater<br/>
                              • Bruk batch-prosessering for mange filer<br/>
                              • Sett opp hot folders for automatisk eksport
                            </Typography>
                          </Alert>
                        </Grid>
                      </Grid>
                    </Card>

                    {/* Algorithm Insights & Platform Recommendations */}
                    <Card
                    sx={{
                      ...theming.getThemedCardSx(),
                      mt: 3,
                      p: 3,
                      border: '2px solid #ff9800',
                      borderRadius: 2,
                      background: 'linear-gradient(135deg, #ff980015 0%, #ff980005 100%)' }}
                  >
                  
                      <Typography variant="h6" sx={{  mb:  3, color: '#ff9800', fontWeight: 600, display: 'flex', alignItems: 'center', gap:  1  }}>
                        <TrendingUp sx={{ fontSize: 20}} />
                        Sosiale Medier Algoritme-Råd & Eksponeringsoptimalisering
                        <Chip label="Oppdatert 2025" size="small" color="warning" sx={{ ml:  1 }} />
                      </Typography>

                      <Grid container spacing={3}>
                        {/* Instagram Algorithm Tips */}
                        <Grid item xs={12} lg={6}>
                        <Paper
  sx={{
    ...theming.getThemedCardSx(),
    p: 3,
    border: '2px solid #E4405F',
    borderRadius: 2,
    background: 'linear-gradient(135deg, #E4405F15 0%, #E4405F05 100%)' }}
>

                            <Typography variant="h6" sx={{  mb: 2, color: '#E4405F', fontWeight: 600, display: 'flex', alignItems: 'center', gap:  1  }}>
                              <Insights sx={{ fontSize: 18}} />
                              Instagram Algoritme-Optimalisering
                            </Typography>

                            <Alert severity="success" sx={{ mb:  2 }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb:  1 }}>
                                Hvorfor disse formatene?
                              </Typography>
                              <Typography variant="body2">
                                Algoritmen prioriterer høy oppløsning og engagement. 1080x1080px gir krystallklar kvalitet som stopper scroll-behavior.
                              </Typography>
                            </Alert>

                            <List dense>
                                <ListItem sx={{ px: 0, alignItems: 'flex-start' }}>
                                <ListItemIcon sx={{ minWidth:  32, mt: 0.5}}>
                                  <Timeline sx={{ fontSize:  16, color: '#E4405F' }} />
                                </ListItemIcon>
                                <ListItemText 
                                  primary="Optimal poste-timing"
                                  secondary="Kl. 11-13 og 19-21 når nordmenn scroller mest. Algoritmen belønner rask engagement."
                                  primaryTypographyProps={{ fontWeight: 600, fontSize: '0.875rem' }}
                                />
                              </ListItem>

                              <ListItem sx={{ px: 0, alignItems: 'flex-start' }}>
                                <ListItemIcon sx={{ minWidth:  32, mt: 0.5}}>
                                  <Psychology sx={{ fontSize:  16, color: '#E4405F' }} />
                                </ListItemIcon>
                                <ListItemText 
                                  primary="Hashtag-strategi 2025"
                                  secondary="3-5 relevante hashtags fungerer bedre enn 30. Algoritmen straffer hashtag-spamming."
                                  primaryTypographyProps={{ fontWeight: 600, fontSize: '0.875rem' }}
                                />
                              </ListItem>

                              <ListItem sx={{ px: 0, alignItems: 'flex-start' }}>
                                <ListItemIcon sx={{ minWidth:  32, mt: 0.5}}>
                                  <VideoFile sx={{ fontSize:  16, color: '#E4405F' }} />
                                </ListItemIcon>
                                <ListItemText 
                                  primary="Reels vs. Feed prioritering"
                                  secondary="Reels får 22% mer rekkevidde. Vertikal 9: 16 format matcher skjermbruk og får algoritme-boost."
                                  primaryTypographyProps={{ fontWeight: 600, fontSize: '0.875rem' }}
                                />
                              </ListItem>

                              <ListItem sx={{ px: 0, alignItems: 'flex-start' }}>
                                <ListItemIcon sx={{ minWidth:  32, mt: 0.5}}>
                                  <SentimentSatisfied sx={{ fontSize:  16, color: '#E4405F' }} />
                                </ListItemIcon>
                                <ListItemText 
                                  primary="Engagement-triggere"
                                  secondary="Første 60 sekunder er kritiske. Spørsmål i caption og 'save this post' øker delinger."
                                  primaryTypographyProps={{ fontWeight: 600, fontSize: '0.875rem' }}
                                />
                              </ListItem>
                            </List>

                            <Alert severity="info" sx={{ mt:  2 }}>
                              <Typography variant="body2">
                                <strong>Instagram Oppdatering 2025: </strong> Carousel-poster (flere bilder) får nå 1.4x mer engagement enn enkeltposter.
                              </Typography>
                            </Alert>
                          </Paper>
                        </Grid>

                        {/* YouTube Algorithm Tips */}
                        <Grid item xs={12} lg={6}>
                        <Paper
  sx={{
    ...theming.getThemedCardSx(),
    p: 3,
    border: '2px solid #FF0000',
    borderRadius: 2,
    background: 'linear-gradient(135deg, #FF000015 0%, #FF000005 100%)' }}
>

                            <Typography variant="h6" sx={{  mb: 2, color: '#FF0000', fontWeight: 600, display: 'flex', alignItems: 'center', gap:  1  }}>
                              <Analytics sx={{ fontSize: 18}} />
                              YouTube Algoritme-Strategi
                            </Typography>

                            <Alert severity="warning" sx={{ mb:  2 }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb:  1 }}>
                                Hvorfor disse dimensjonene?
                              </Typography>
                              <Typography variant="body2">
                                1280x720px thumbnails vises perfekt på alle enheter. Høy oppløsning = høyere click-through rate (CTR).
                              </Typography>
                            </Alert>

                            <List dense>
                              <ListItem sx={{ px: 0, alignItems: 'flex-start' }}>
                                <ListItemIcon sx={{ minWidth:  32, mt: 0.5}}>
                                  <Visibility sx={{ fontSize:  16, color: '#FF0000' }} />
                                </ListItemIcon>
                                <ListItemText 
                                  primary="Thumbnail-psykologi"
                                  secondary="Ansikter og tekst på norsk øker CTR med 25%. Kontrast og store elementer fungerer best."
                                  primaryTypographyProps={{ fontWeight: 600, fontSize: '0.875rem' }}
                                />
                              </ListItem>

                              <ListItem sx={{ px: 0, alignItems: 'flex-start' }}>
                                <ListItemIcon sx={{ minWidth:  32, mt: 0.5}}>
                                  <Schedule sx={{ fontSize:  16, color: '#FF0000' }} />
                                </ListItemIcon>
                                <ListItemText 
                                  primary="Seertid-optimalisering"
                                  secondary="Første 15 sekunder avgjør algoritme-ranking. Hook-teknikker og tidlig verdi-leveranse er kritisk."
                                  primaryTypographyProps={{ fontWeight: 600, fontSize: '0.875rem' }}
                                />
                              </ListItem>

                              <ListItem sx={{ px: 0, alignItems: 'flex-start' }}>
                                <ListItemIcon sx={{ minWidth:  32, mt: 0.5}}>
                                  <Campaign sx={{ fontSize:  16, color: '#FF0000' }} />
                                </ListItemIcon>
                                <ListItemText 
                                  primary="Shorts vs. Lange videoer"
                                  secondary="Shorts: Vertikal 9:6, maks 60 sek for maksimal spredning. Lange videoer: Min 8 min for ad-revenue."
                                  primaryTypographyProps={{ fontWeight: 600, fontSize: '0.875rem' }}
                                />
                              </ListItem>

                              <ListItem sx={{ px: 0, alignItems: 'flex-start' }}>
                                <ListItemIcon sx={{ minWidth:  32, mt: 0.5}}>
                                  <Update sx={{ fontSize:  16, color: '#FF0000' }} />
                                </ListItemIcon>
                                <ListItemText 
                                  primary="Konsistens-faktoren"
                                  secondary="Regelmessig posting (2-3x/uke) signaliserer til algoritmen at kanalen er aktiv og relevant."
                                  primaryTypographyProps={{ fontWeight: 600, fontSize: '0.875rem' }}
                                />
                              </ListItem>
                            </List>

                            <Alert severity="error" sx={{ mt:  2 }}>
                              <Typography variant="body2">
                                <strong>YouTube Shorts Oppdatering 2025: </strong> Musikk-syncing og trending lyder øker discovery med 300%.
                              </Typography>
                            </Alert>
                          </Paper>
                        </Grid>

                        {/* Facebook & LinkedIn Combined */}
                        <Grid item xs={12} lg={6}>
                          <Paper sx={{ p:  3, border: '2px solid #1877F2', borderRadius: 2, background: 'linear-gradient(135deg, #1877F215 0%, #1877F205 100%)' ,  ...theming.getThemedCardSx() }}>
                            <Typography variant="h6" sx={{  mb: 2, color: '#1877F2', fontWeight: 600, display: 'flex', alignItems: 'center', gap:  1  }}>
                              <BusinessCenter sx={{ fontSize: 18}} />
                              Facebook & LinkedIn Business-Algoritmer
                            </Typography>

                            <Alert severity="info" sx={{ mb:  2 }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb:  1 }}>
                                Hvorfor disse størrelsene prioriteres?
                              </Typography>
                              <Typography variant="body2">
                                Facebook: 1200x630px fyller feed-bredden. LinkedIn: Profesjonell standard som vises optimalt på desktop og mobil.
                              </Typography>
                            </Alert>

                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb:  1, color: '#1877F2' }}>
                              Facebook-strategi: </Typography>
                            <List dense sx={{ mb: 2 }}>
                              <ListItem sx={{ px: 0, py: 0.3}}>
                                <ListItemText 
                                  primary="• Autentisk innhold prioriteres - personlige historier"
                                  secondary="• Video med undertekster får 85% mer engagement"
                                  primaryTypographyProps={{ fontSize: '0.875rem' }}
                                  secondaryTypographyProps={{ fontSize: '0.75rem' }}
                                />
                              </ListItem>
                              <ListItem sx={{ px: 0, py: 0.3}}>
                                <ListItemText 
                                  primary="• Live video får 6x mer interaksjon enn vanlig video"
                                  secondary="• Poste mellom 13-15 for maksimal norsk rekkevidde"
                                  primaryTypographyProps={{ fontSize: '0.875rem' }}
                                  secondaryTypographyProps={{ fontSize: '0.75rem' }}
                                />
                              </ListItem>
                            </List>

                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb:  1, color: '#0A66C2' }}>
                              LinkedIn-strategi: </Typography>
                            <List dense>
                              <ListItem sx={{ px: 0, py: 0.3}}>
                                <ListItemText 
                                  primary="• Langtekst-poster (1300+ ord) får mest engagement"
                                  secondary="• Poste 08-10 og 17-18 når nordmenn er mest aktive"
                                  primaryTypographyProps={{ fontSize: '0.875rem' }}
                                  secondaryTypographyProps={{ fontSize: '0.75rem' }}
                                />
                              </ListItem>
                              <ListItem sx={{ px: 0, py: 0.3}}>
                                <ListItemText 
                                  primary="• Native LinkedIn-video får 20x mer deling enn YouTube-links"
                                  secondary="• Faglig innhold med personlig vinkling presterer best"
                                  primaryTypographyProps={{ fontSize: '0.875rem' }}
                                  secondaryTypographyProps={{ fontSize: '0.75rem' }}
                                />
                              </ListItem>
                            </List>
                          </Paper>
                        </Grid>

                        {/* TikTok & Emerging Platforms */}
                        <Grid item xs={12} lg={6}>
                            <Paper sx={{ p:  3, border: '2px solid #000000', borderRadius: 2, background: 'linear-gradient(135deg, #00000015 0%, #00000005 100%)' ,  ...theming.getThemedCardSx() }}>
                            <Typography variant="h6" sx={{  mb: 2, color: '#000000', fontWeight: 600, display: 'flex', alignItems: 'center', gap:  1  }}>
                              <TrendingUp sx={{ fontSize: 18}} />
                              TikTok & Emerging Platforms 2025
                            </Typography>

                            <Alert severity="success" sx={{ mb:  2 }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb:  1 }}>
                                Hvorfor vertikal 9: 16 dominerer?
                              </Typography>
                              <Typography variant="body2">
                                91% av TikTok-bruk er på mobil. Vertikal video fyller hele skjermen og gir høyeste engagement-rate.
                              </Typography>
                            </Alert>

                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb:  1, color: '#000000' }}>
                              TikTok Algoritme-hemmeligheter: </Typography>
                            <List dense sx={{ mb: 2 }}>
                              <ListItem sx={{ px: 0, py: 0.3}}>
                                <ListItemText 
                                  primary="• For You Page prioriterer completion rate over views"
                                  secondary="• 3-sekunder hook er kritisk for norsk audience"
                                  primaryTypographyProps={{ fontSize: '0.875rem' }}
                                  secondaryTypographyProps={{ fontSize: '0.75rem' }}
                                />
                              </ListItem>
                              <ListItem sx={{ px: 0, py: 0.3}}>
                                <ListItemText 
                                  primary="• Trending lyder og hashtags gir viral-boost første 24 timer"
                                  secondary="• Original lyd kan generere egen trend-følging"
                                  primaryTypographyProps={{ fontSize: '0.875rem' }}
                                  secondaryTypographyProps={{ fontSize: '0.75rem' }}
                                />
                              </ListItem>
                            </List>

                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb:  1, color: '#E60023' }}>
                              Pinterest Upptrendings: </Typography>
                            <List dense>
                              <ListItem sx={{ px: 0, py: 0.3}}>
                                <ListItemText 
                                  primary="• Idea Pins (video-format) får 5x mer visninger"
                                  secondary="• SEO-optimaliserte beskrivelser avgjør long-tail discovery"
                                    primaryTypographyProps={{ fontSize: '0.875rem' }}
                                  secondaryTypographyProps={{ fontSize: '0.75rem' }}
                                />
                              </ListItem>
                              <ListItem sx={{ px: 0, py: 0.3}}>
                                <ListItemText 
                                  primary="• Vertikal 2: 3 format matcher ny shopping-behavior"
                                  secondary="• Sesongplanlegging 45 dager frem gir best SEO-rezultater"
                                  primaryTypographyProps={{ fontSize: '0.875rem' }}
                                  secondaryTypographyProps={{ fontSize: '0.75rem' }}
                                />
                              </ListItem>
                            </List>
                          </Paper>
                        </Grid>
                      </Grid>

                      {/* Platform Updates Alert */}
                      <Alert severity="warning" sx={{ mt:  3 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb:  1, display: 'flex', alignItems: 'center', gap:  1 }}>
                          <Update sx={{ fontSize: 16}} />
                          Plattform-Oppdateringer 2025
                        </Typography>
                        <Typography variant="body2">
                          <strong>Instagram: </strong> Creator Subscriptions lansert • <strong>YouTube:</strong> Shorts kan nå være opp til 3 minutter • 
                          <strong>TikTok:</strong> Foto-carousels nå støttet • <strong>LinkedIn:</strong> Native event-streaming implementert
                        </Typography>
                      </Alert>

                      {/* Expert Strategy Tips */}
                      <Card sx={{ mt:  3, p:  2, border: '1px solid #4caf50', borderRadius: 2, background: 'linear-gradient(135deg, #4caf5010 0%, #4caf5005 100%)' ,  ...theming.getThemedCardSx() }}>
                        <Typography variant="h6" sx={{  mb: 2, color: '#4caf50', fontWeight: 600, display: 'flex', alignItems: 'center', gap:  1  }}>
                          <Insights sx={{ fontSize: 18}} />
                          Ekspert-Strategier for Maksimal Rekkevidde
                        </Typography>
                        
                        <Grid container spacing={2}>
                          <Grid item xs={12} md={4}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb:  1, color: '#4caf50' }}>
                              Cross-Platform Synergier: </Typography>
                            <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                              • Lag master-innhold, tilpass per plattform<br/>
                              • Tease på Stories, utdyp på feed<br/>
                              • Bruk platform-spesifikke call-to-actions
                            </Typography>
                          </Grid>
                          
                          <Grid item xs={12} md={4}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb:  1, color: '#4caf50' }}>
                              Norsk Marked Insights: </Typography>
                            <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                              • Instagram peak: Søndager 19-21<br/>
                              • LinkedIn peak: Tirsdager 08-10<br/>
                              • TikTok peak: Onsdager 20-22<br/>
                              • YouTube peak: Lørdager 14-16
                            </Typography>
                          </Grid>
                          
                          <Grid item xs={12} md={4}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb:  1, color: '#4caf50' }}>   
                              Algoritme-Hacking 2025: </Typography>
                            <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                              • Reply til kommentarer innen 1 time<br/>
                              • Bruk platform-native redigeringsverktøy<br/>
                              • Test A/B på thumbnail og titler<br/>
                              • Monitor trending topics daglig
                            </Typography>
                          </Grid>
                        </Grid>
                      </Card>
                    </Card>
                  </Box>
                </Card>
              </>
            )}
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Tips */}
      <Paper elevation={1} sx={{ mt:  3, p:  3, borderRadius: 2, bgcolor: 'info.light', color: 'info.contrastText' ,  ...theming.getThemedCardSx() }}>
        <Typography variant="h6" sx={{  mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap:  1  }}>
          {theming.getThemedIcon('build')}
          💡 Professional Tips
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <Typography variant="body2" sx={{ mb:  1, fontWeight: 600}}>
              Lær favorittene først
            </Typography>
            <Typography variant="body2">
              Start med de merkede populære snarveiene - disse brukes mest av profesjonelle fotografer.
            </Typography>
          </Grid>
          <Grid item xs={12} md={4}>
            <Typography variant="body2" sx={{ mb:  1, fontWeight: 600}}>
              ⌨️ Øv regelmessig
            </Typography>
            <Typography variant="body2">
              Bruk snarveiene konsekvent i dine arbeidsflyter for å bygge muskelminne.
            </Typography>
          </Grid>
          <Grid item xs={12} md={4}>
              <Typography variant="body2" sx={{ mb:  1, fontWeight: 600}}>
              📝 Skriv ut referanse
            </Typography>
            <Typography variant="body2">
              Kopier dine mest brukte snarveier og ha dem synlige ved arbeidsplassen.
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      {/* Tutorial Modal - Database Persistent */}
      <KeyboardShortcutsTutorial
        open={showTutorial}
        onClose={() => setShowTutorial(false)}
        profession={profession || 'photographer'}
        professionName={professionConfig?.name}
        onDismiss={handleTutorialDismiss}
      />
    </Box>
  );
}