/**
 * StoryboardTemplates - Pre-defined storyboard templates for different aspect ratios
 * 
 * Features:
 * - Industry-standard aspect ratios (Film, TV, Social Media)
 * - Custom ratio input
 * - Frame guides (rule of thirds, golden ratio, safe zones)
 * - Template presets with grid configurations
 * - Quick apply to canvas
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Alert,
  Box,
  Paper,
  Typography,
  IconButton,
  Stack,
  Tooltip,
  Divider,
  TextField,
  Button,
  Chip,
  Slider,
  Switch,
  FormControlLabel,
  Collapse,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  InputAdornment,
} from '@mui/material';
import {
  Search,
  Movie,
  Tv,
  Smartphone,
  GridOn,
  GridView,
  Add,
  Check,
  Delete,
  Star,
  StarBorder,
  Settings,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';

// =============================================================================
// Types
// =============================================================================

export type AspectRatioCategory = 'film' | 'tv' | 'social' | 'web' | 'custom';

export type GuideType = 'none' | 'thirds' | 'golden' | 'diagonal' | 'center' | 'safe';

export interface AspectRatioPreset {
  id: string;
  name: string;
  category: AspectRatioCategory;
  width: number;
  height: number;
  description: string;
  icon?: React.ReactNode;
  color?: string;
  popular?: boolean;
  defaultGuideType?: GuideType;
  defaultGuidesEnabled?: boolean;
  defaultActionSafe?: boolean;
  defaultTitleSafe?: boolean;
}

export interface FrameGuides {
  type: GuideType;
  enabled: boolean;
  opacity: number;
  color: string;
  showActionSafe: boolean;  // TV action safe zone (90%)
  showTitleSafe: boolean;   // TV title safe zone (80%)
}

export interface StoryboardTemplate {
  id: string;
  name: string;
  aspectRatio: AspectRatioPreset;
  frameWidth: number;
  frameHeight: number;
  guides: FrameGuides;
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  showFrameNumber: boolean;
  showTimecode: boolean;
  framesPerRow: number;
  marginBetweenFrames: number;
  isFavorite: boolean;
  isCustom: boolean;
  createdAt: number;
}

export interface StoryboardTemplatesProps {
  selectedTemplate: StoryboardTemplate | null;
  onTemplateSelect: (template: StoryboardTemplate) => void;
  onTemplateCreate?: (template: StoryboardTemplate) => void;
  onTemplateDelete?: (templateId: string) => void;
  customTemplates?: StoryboardTemplate[];
  canvasWidth?: number;
  canvasHeight?: number;
}

// =============================================================================
// Constants
// =============================================================================

export const ASPECT_RATIO_PRESETS: AspectRatioPreset[] = [
  // Film Formats
  {
    id: 'film-scope',
    name: 'Cinemascope',
    category: 'film',
    width: 2.39,
    height: 1,
    description: 'Anamorphic widescreen (2.39:1)',
    color: '#f59e0b',
    popular: true,
  },
  {
    id: 'film-185',
    name: 'Academy Flat',
    category: 'film',
    width: 1.85,
    height: 1,
    description: 'Standard theatrical (1.85:1)',
    color: '#f59e0b',
  },
  {
    id: 'film-235',
    name: 'Scope 2.35',
    category: 'film',
    width: 2.35,
    height: 1,
    description: 'Classic anamorphic (2.35:1)',
    color: '#f59e0b',
  },
  {
    id: 'film-imax',
    name: 'IMAX',
    category: 'film',
    width: 1.43,
    height: 1,
    description: 'IMAX 70mm (1.43:1)',
    color: '#f59e0b',
  },
  {
    id: 'film-4k-dci',
    name: 'DCI 4K',
    category: 'film',
    width: 1.9,
    height: 1,
    description: 'Digital cinema (1.9:1)',
    color: '#f59e0b',
  },
  
  // TV Formats
  {
    id: 'tv-16x9',
    name: 'HD 16:9',
    category: 'tv',
    width: 16,
    height: 9,
    description: 'Standard HD/4K TV',
    color: '#3b82f6',
    popular: true,
  },
  {
    id: 'tv-4x3',
    name: 'SD 4:3',
    category: 'tv',
    width: 4,
    height: 3,
    description: 'Classic TV format',
    color: '#3b82f6',
  },
  {
    id: 'tv-21x9',
    name: 'Ultrawide',
    category: 'tv',
    width: 21,
    height: 9,
    description: 'Ultrawide monitor (21:9)',
    color: '#3b82f6',
  },
  {
    id: 'tv-32x9',
    name: 'Super Ultrawide',
    category: 'tv',
    width: 32,
    height: 9,
    description: 'Dual monitor/Samsung Odyssey',
    color: '#3b82f6',
  },
  
  // Social Media Formats
  {
    id: 'social-square',
    name: 'Square',
    category: 'social',
    width: 1,
    height: 1,
    description: 'Instagram/Facebook feed',
    color: '#ec4899',
    popular: true,
  },
  {
    id: 'social-vertical',
    name: 'Vertical 9:16',
    category: 'social',
    width: 9,
    height: 16,
    description: 'Stories/Reels/TikTok',
    color: '#ec4899',
    popular: true,
  },
  {
    id: 'social-portrait',
    name: 'Portrait 4:5',
    category: 'social',
    width: 4,
    height: 5,
    description: 'Instagram portrait',
    color: '#ec4899',
  },
  {
    id: 'social-twitter',
    name: 'Twitter Video',
    category: 'social',
    width: 16,
    height: 9,
    description: 'Twitter/X video',
    color: '#ec4899',
  },
  {
    id: 'social-youtube-short',
    name: 'YouTube Shorts',
    category: 'social',
    width: 9,
    height: 16,
    description: 'YouTube Shorts format',
    color: '#ec4899',
  },
  
  // Web Formats
  {
    id: 'web-banner',
    name: 'Web Banner',
    category: 'web',
    width: 728,
    height: 90,
    description: 'Leaderboard ad (728x90)',
    color: '#10b981',
  },
  {
    id: 'web-hero',
    name: 'Hero Section',
    category: 'web',
    width: 16,
    height: 6,
    description: 'Website hero section',
    color: '#10b981',
  },
  {
    id: 'web-thumbnail',
    name: 'Video Thumbnail',
    category: 'web',
    width: 16,
    height: 9,
    description: 'YouTube thumbnail',
    color: '#10b981',
  },
];

export const DEFAULT_GUIDES: FrameGuides = {
  type: 'thirds',
  enabled: true,
  opacity: 0.3,
  color: '#ffffff',
  showActionSafe: false,
  showTitleSafe: false,
};

const CATEGORY_ICONS: Record<AspectRatioCategory, React.ReactNode> = {
  film: <Movie />,
  tv: <Tv />,
  social: <Smartphone />,
  web: <GridView />,
  custom: <Settings />,
};

const CATEGORY_LABELS: Record<AspectRatioCategory, string> = {
  film: 'Film & Cinema',
  tv: 'TV & Broadcast',
  social: 'Social Media',
  web: 'Web & Digital',
  custom: 'Custom',
};

const CATEGORY_DEFAULT_GUIDES: Record<AspectRatioCategory, Partial<FrameGuides>> = {
  film: {
    type: 'thirds',
    enabled: true,
    showActionSafe: false,
    showTitleSafe: false,
  },
  tv: {
    type: 'safe',
    enabled: true,
    showActionSafe: true,
    showTitleSafe: true,
  },
  social: {
    type: 'center',
    enabled: true,
    showActionSafe: false,
    showTitleSafe: false,
  },
  web: {
    type: 'diagonal',
    enabled: true,
    showActionSafe: false,
    showTitleSafe: false,
  },
  custom: {
    type: 'thirds',
    enabled: true,
    showActionSafe: false,
    showTitleSafe: false,
  },
};

// =============================================================================
// Styled Components
// =============================================================================

const TemplateCard = styled(Paper, {
  shouldForwardProp: (prop) => prop !== 'selected',
})<{ selected?: boolean }>(({ selected }) => ({
  padding: 14,
  cursor: 'pointer',
  background: selected
    ? 'linear-gradient(135deg, rgba(56, 189, 248, 0.18) 0%, rgba(37, 99, 235, 0.16) 100%)'
    : 'linear-gradient(145deg, rgba(18, 24, 40, 0.95) 0%, rgba(11, 16, 30, 0.95) 100%)',
  border: selected ? '1px solid rgba(56, 189, 248, 0.7)' : '1px solid rgba(99, 102, 241, 0.22)',
  transition: 'all 0.2s ease',
  minHeight: 128,
  boxShadow: selected
    ? '0 14px 30px rgba(14, 165, 233, 0.25)'
    : '0 10px 24px rgba(4, 8, 22, 0.55)',
  '&:hover': {
    borderColor: selected ? 'rgba(56, 189, 248, 0.85)' : 'rgba(99, 102, 241, 0.38)',
    transform: 'translateY(-2px) scale(1.01)',
  },
}));

const AspectPreview = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'aspectRatio',
})<{ aspectRatio: number }>(({ aspectRatio }) => ({
  position: 'relative',
  backgroundColor: 'rgba(0, 0, 0, 0.4)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: 4,
  overflow: 'hidden',
  width: '100%',
  paddingTop: `${(1 / aspectRatio) * 100}%`,
  maxHeight: 80,
}));

const CategoryChip = styled(Chip, {
  shouldForwardProp: (prop) => prop !== 'categoryColor',
})<{ categoryColor?: string }>(({ categoryColor }) => ({
  backgroundColor: categoryColor ? `${categoryColor}20` : 'rgba(255,255,255,0.1)',
  color: categoryColor || 'inherit',
  borderColor: categoryColor ? `${categoryColor}50` : 'rgba(255,255,255,0.2)',
  fontSize: 10,
  height: 20,
}));

const TemplateSection = styled(Paper)({
  padding: 14,
  borderRadius: 12,
  border: '1px solid rgba(99, 102, 241, 0.22)',
  background: 'linear-gradient(145deg, rgba(8, 14, 28, 0.95) 0%, rgba(8, 12, 24, 0.95) 100%)',
  boxShadow: '0 12px 26px rgba(2, 6, 23, 0.45)',
});

// =============================================================================
// Helper Functions
// =============================================================================

export const calculateAspectRatio = (width: number, height: number): number => {
  return width / height;
};

export const getFrameDimensions = (
  aspectRatio: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } => {
  const ratioWidth = maxHeight * aspectRatio;
  const ratioHeight = maxWidth / aspectRatio;
  
  if (ratioWidth <= maxWidth) {
    return { width: ratioWidth, height: maxHeight };
  }
  return { width: maxWidth, height: ratioHeight };
};

export const formatAspectRatio = (width: number, height: number): string => {
  const isNearlyInteger = (value: number): boolean => Math.abs(value - Math.round(value)) < 1e-9;
  const trimDecimals = (value: number): string => {
    if (isNearlyInteger(value)) return String(Math.round(value));
    return value.toFixed(2).replace(/\.?0+$/, '');
  };

  if (!isNearlyInteger(width) || !isNearlyInteger(height)) {
    return `${trimDecimals(width)}:${trimDecimals(height)}`;
  }

  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const intWidth = Math.round(width);
  const intHeight = Math.round(height);
  const divisor = gcd(intWidth, intHeight);
  return `${intWidth / divisor}:${intHeight / divisor}`;
};

export const drawGuides = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  guides: FrameGuides
): void => {
  if (!guides.enabled) return;
  
  ctx.save();
  ctx.strokeStyle = guides.color;
  ctx.globalAlpha = guides.opacity;
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  
  switch (guides.type) {
    case 'thirds': {
      // Rule of thirds
      const thirdW = width / 3;
      const thirdH = height / 3;
      
      ctx.beginPath();
      ctx.moveTo(thirdW, 0);
      ctx.lineTo(thirdW, height);
      ctx.moveTo(thirdW * 2, 0);
      ctx.lineTo(thirdW * 2, height);
      ctx.moveTo(0, thirdH);
      ctx.lineTo(width, thirdH);
      ctx.moveTo(0, thirdH * 2);
      ctx.lineTo(width, thirdH * 2);
      ctx.stroke();
      break;
    }

    case 'golden': {
      // Golden ratio (1.618)
      const phi = 1.618033988749;
      const goldenW = width / phi;
      const goldenH = height / phi;
      
      ctx.beginPath();
      ctx.moveTo(width - goldenW, 0);
      ctx.lineTo(width - goldenW, height);
      ctx.moveTo(goldenW, 0);
      ctx.lineTo(goldenW, height);
      ctx.moveTo(0, height - goldenH);
      ctx.lineTo(width, height - goldenH);
      ctx.moveTo(0, goldenH);
      ctx.lineTo(width, goldenH);
      ctx.stroke();
      break;
    }

    case 'diagonal':
      // Diagonal lines
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(width, height);
      ctx.moveTo(width, 0);
      ctx.lineTo(0, height);
      ctx.stroke();
      break;

    case 'center':
      // Center crosshairs
      ctx.beginPath();
      ctx.moveTo(width / 2, 0);
      ctx.lineTo(width / 2, height);
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
      
      // Center circle
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, Math.min(width, height) * 0.1, 0, Math.PI * 2);
      ctx.stroke();
      break;

    case 'safe': {
      // TV safe zones
      const actionSafe = 0.93;
      const titleSafe = 0.9;
      
      ctx.setLineDash([4, 4]);
      
      // Action safe (93%)
      const actionX = width * (1 - actionSafe) / 2;
      const actionY = height * (1 - actionSafe) / 2;
      const actionW = width * actionSafe;
      const actionH = height * actionSafe;
      
      ctx.strokeStyle = '#ff6b6b';
      ctx.strokeRect(actionX, actionY, actionW, actionH);
      
      // Title safe (90%)
      const titleX = width * (1 - titleSafe) / 2;
      const titleY = height * (1 - titleSafe) / 2;
      const titleW = width * titleSafe;
      const titleH = height * titleSafe;
      
      ctx.strokeStyle = '#4ecdc4';
      ctx.strokeRect(titleX, titleY, titleW, titleH);
      break;
    }
  }
  
  // Additional safe zones if enabled
  if (guides.showActionSafe && guides.type !== 'safe') {
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = '#ff6b6b';
    ctx.globalAlpha = guides.opacity * 0.7;
    const actionX = width * 0.035;
    const actionY = height * 0.035;
    ctx.strokeRect(actionX, actionY, width * 0.93, height * 0.93);
  }
  
  if (guides.showTitleSafe && guides.type !== 'safe') {
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = '#4ecdc4';
    ctx.globalAlpha = guides.opacity * 0.7;
    const titleX = width * 0.05;
    const titleY = height * 0.05;
    ctx.strokeRect(titleX, titleY, width * 0.9, height * 0.9);
  }
  
  ctx.restore();
};

export const createTemplateFromPreset = (
  preset: AspectRatioPreset,
  canvasWidth: number = 1920,
  canvasHeight: number = 1080
): StoryboardTemplate => {
  const aspectRatio = calculateAspectRatio(preset.width, preset.height);
  const { width, height } = getFrameDimensions(aspectRatio, canvasWidth, canvasHeight);
  
  const categoryDefaults = CATEGORY_DEFAULT_GUIDES[preset.category] ?? {};
  const guideDefaults: FrameGuides = {
    ...DEFAULT_GUIDES,
    ...categoryDefaults,
    type: preset.defaultGuideType ?? categoryDefaults.type ?? DEFAULT_GUIDES.type,
    enabled: preset.defaultGuidesEnabled ?? categoryDefaults.enabled ?? DEFAULT_GUIDES.enabled,
    showActionSafe: preset.defaultActionSafe ?? categoryDefaults.showActionSafe ?? DEFAULT_GUIDES.showActionSafe,
    showTitleSafe: preset.defaultTitleSafe ?? categoryDefaults.showTitleSafe ?? DEFAULT_GUIDES.showTitleSafe,
  };

  return {
    id: `template-${preset.id}-${Date.now()}`,
    name: preset.name,
    aspectRatio: preset,
    frameWidth: Math.round(width),
    frameHeight: Math.round(height),
    guides: guideDefaults,
    backgroundColor: '#1a1a2e',
    borderColor: '#333344',
    borderWidth: 2,
    showFrameNumber: true,
    showTimecode: false,
    framesPerRow: 4,
    marginBetweenFrames: 16,
    isFavorite: false,
    isCustom: false,
    createdAt: Date.now(),
  };
};

// =============================================================================
// Sub-Components
// =============================================================================

interface GuidePreviewProps {
  type: GuideType;
  aspectRatio: number;
}

const GuidePreviewCanvas: React.FC<GuidePreviewProps> = ({ type, aspectRatio }) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = canvas.width;
    const height = canvas.height;
    
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 0, width, height);
    
    drawGuides(ctx, width, height, {
      type,
      enabled: true,
      opacity: 0.5,
      color: '#ffffff',
      showActionSafe: false,
      showTitleSafe: false,
    });
  }, [type, aspectRatio]);
  
  return (
    <canvas
      ref={canvasRef}
      width={80}
      height={Math.round(80 / aspectRatio)}
      style={{
        width: '100%',
        height: 'auto',
        borderRadius: 4,
        border: '1px solid rgba(255,255,255,0.1)',
      }}
    />
  );
};

// =============================================================================
// Main Component
// =============================================================================

export const StoryboardTemplates: React.FC<StoryboardTemplatesProps> = ({
  selectedTemplate,
  onTemplateSelect,
  onTemplateCreate,
  onTemplateDelete,
  customTemplates = [],
  canvasWidth = 1920,
  canvasHeight = 1080,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<AspectRatioCategory | 'all'>('all');
  const [showCustomDialog, setShowCustomDialog] = useState(false);
  const [showGuideSettings, setShowGuideSettings] = useState(false);
  const [customWidth, setCustomWidth] = useState(16);
  const [customHeight, setCustomHeight] = useState(9);
  const [customName, setCustomName] = useState('Custom Template');
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
  const [favoritePresetIds, setFavoritePresetIds] = useState<Set<string>>(
    () => new Set(ASPECT_RATIO_PRESETS.filter((preset) => preset.popular).map((preset) => preset.id))
  );
  const safeCustomWidth = Number.isFinite(customWidth) && customWidth > 0 ? customWidth : 16;
  const safeCustomHeight = Number.isFinite(customHeight) && customHeight > 0 ? customHeight : 9;
  const safeCustomAspectRatio = safeCustomWidth / safeCustomHeight;
  const sanitizedCustomName = customName.trim() || 'Custom Template';

  const presetIntegrity = useMemo(() => {
    const seenIds = new Set<string>();
    const duplicateIds = new Set<string>();
    const invalidDimensionIds: string[] = [];
    const valid: AspectRatioPreset[] = [];

    ASPECT_RATIO_PRESETS.forEach((preset) => {
      const hasValidDimensions = Number.isFinite(preset.width)
        && Number.isFinite(preset.height)
        && preset.width > 0
        && preset.height > 0;

      if (!hasValidDimensions) {
        invalidDimensionIds.push(preset.id);
        return;
      }

      if (seenIds.has(preset.id)) {
        duplicateIds.add(preset.id);
        return;
      }

      seenIds.add(preset.id);
      valid.push(preset);
    });

    return {
      valid,
      duplicateIds: Array.from(duplicateIds),
      invalidDimensionIds,
    };
  }, []);

  const togglePresetFavorite = useCallback((presetId: string) => {
    setFavoritePresetIds((prev) => {
      const next = new Set(prev);
      if (next.has(presetId)) {
        next.delete(presetId);
      } else {
        next.add(presetId);
      }
      return next;
    });
  }, []);
  
  // Filter presets
  const filteredPresets = useMemo(() => {
    let presets = presetIntegrity.valid;
    
    if (selectedCategory !== 'all') {
      presets = presets.filter(p => p.category === selectedCategory);
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      presets = presets.filter(p => 
        p.name.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query)
      );
    }

    if (showOnlyFavorites) {
      presets = presets.filter((preset) => favoritePresetIds.has(preset.id));
    }
    
    return presets;
  }, [selectedCategory, searchQuery, showOnlyFavorites, favoritePresetIds, presetIntegrity.valid]);

  const filteredCustomTemplates = useMemo(() => {
    let templates = customTemplates;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      templates = templates.filter((template) => (
        template.name.toLowerCase().includes(query)
        || template.aspectRatio.description.toLowerCase().includes(query)
      ));
    }
    if (showOnlyFavorites) {
      templates = templates.filter((template) => template.isFavorite);
    }
    return templates;
  }, [customTemplates, searchQuery, showOnlyFavorites]);

  const favoritePresets = useMemo(() => (
    presetIntegrity.valid.filter((preset) => favoritePresetIds.has(preset.id))
  ), [favoritePresetIds, presetIntegrity.valid]);
  
  // Group presets by category
  const groupedPresets = useMemo(() => {
    const groups: Record<AspectRatioCategory, AspectRatioPreset[]> = {
      film: [],
      tv: [],
      social: [],
      web: [],
      custom: [],
    };
    
    filteredPresets.forEach(preset => {
      groups[preset.category].push(preset);
    });
    
    return groups;
  }, [filteredPresets]);
  
  const handlePresetClick = useCallback((preset: AspectRatioPreset) => {
    const template = createTemplateFromPreset(preset, canvasWidth, canvasHeight);
    onTemplateSelect(template);
  }, [canvasWidth, canvasHeight, onTemplateSelect]);
  
  const handleCreateCustom = useCallback(() => {
    const customPreset: AspectRatioPreset = {
      id: `custom-${Date.now()}`,
      name: sanitizedCustomName,
      category: 'custom',
      width: safeCustomWidth,
      height: safeCustomHeight,
      description: `Custom ${safeCustomWidth}:${safeCustomHeight}`,
      color: '#8b5cf6',
    };
    
    const template = createTemplateFromPreset(customPreset, canvasWidth, canvasHeight);
    template.isCustom = true;
    
    onTemplateCreate?.(template);
    onTemplateSelect(template);
    setShowCustomDialog(false);
  }, [sanitizedCustomName, safeCustomWidth, safeCustomHeight, canvasWidth, canvasHeight, onTemplateCreate, onTemplateSelect]);
  
  const handleGuideChange = useCallback((updates: Partial<FrameGuides>) => {
    if (selectedTemplate) {
      const updated = {
        ...selectedTemplate,
        guides: { ...selectedTemplate.guides, ...updates },
      };
      onTemplateSelect(updated);
    }
  }, [selectedTemplate, onTemplateSelect]);

  const templateCardItemSx = {
    flex: '1 1 172px',
    minWidth: 172,
    maxWidth: '100%',
  } as const;
  const popularCardItemSx = {
    flex: '1 1 156px',
    minWidth: 156,
    maxWidth: '100%',
  } as const;
  
  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Header */}
      <TemplateSection>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" mb={1.75} gap={1.25}>
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>
              Storyboard Templates
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                maxWidth: 280,
                lineHeight: 1.45,
                mt: 0.25,
              }}
            >
              Cinematic ratios, social formats, and custom frame guides
            </Typography>
          </Box>
          <Stack direction="row" gap={1}>
            <Tooltip title="Show favorites only">
              <IconButton
                size="small"
                onClick={() => setShowOnlyFavorites(!showOnlyFavorites)}
                sx={{ color: showOnlyFavorites ? '#f59e0b' : 'inherit' }}
              >
                {showOnlyFavorites ? <Star /> : <StarBorder />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Create custom template">
              <IconButton
                size="small"
                onClick={() => setShowCustomDialog(true)}
                sx={{ color: '#8b5cf6' }}
              >
                <Add />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        {(presetIntegrity.duplicateIds.length > 0 || presetIntegrity.invalidDimensionIds.length > 0) && (
          <Alert
            severity="warning"
            sx={{
              mb: 1.25,
              borderRadius: 2,
              py: 0.5,
              bgcolor: 'rgba(161, 98, 7, 0.14)',
              border: '1px solid rgba(234, 179, 8, 0.35)',
              '& .MuiAlert-message': { fontSize: 12 },
            }}
          >
            Template validation: {presetIntegrity.valid.length} gyldige.
            {presetIntegrity.duplicateIds.length > 0 ? ` Duplikat-IDer: ${presetIntegrity.duplicateIds.join(', ')}.` : ''}
            {presetIntegrity.invalidDimensionIds.length > 0 ? ` Ugyldige dimensjoner: ${presetIntegrity.invalidDimensionIds.join(', ')}.` : ''}
          </Alert>
        )}

        {selectedTemplate && (
          <Paper
            sx={{
              p: 1.5,
              mb: 1.75,
              borderRadius: 2,
              border: '1px solid rgba(56, 189, 248, 0.35)',
              background: 'linear-gradient(135deg, rgba(6, 24, 46, 0.92) 0%, rgba(15, 23, 42, 0.92) 100%)',
            }}
          >
            <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
              <Box>
                <Typography variant="caption" sx={{ color: '#67e8f9', fontWeight: 700 }}>
                  AKTIV TEMPLATE
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {selectedTemplate.name}
                </Typography>
              </Box>
              <Stack direction="row" gap={0.5} flexWrap="wrap" justifyContent="flex-end">
                <Chip
                  size="small"
                  label={`${presetIntegrity.valid.length} presets`}
                  sx={{ height: 22 }}
                />
                <Chip
                  size="small"
                  label={formatAspectRatio(selectedTemplate.aspectRatio.width, selectedTemplate.aspectRatio.height)}
                  sx={{ height: 22 }}
                />
                <Chip
                  size="small"
                  label={selectedTemplate.guides.enabled ? 'Guides ON' : 'Guides OFF'}
                  color={selectedTemplate.guides.enabled ? 'success' : 'default'}
                  sx={{ height: 22 }}
                />
              </Stack>
            </Stack>
          </Paper>
        )}

        <TextField
          fullWidth
          size="small"
          placeholder="Search templates..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search sx={{ fontSize: 16, color: 'rgba(125, 211, 252, 0.85)' }} />
              </InputAdornment>
            ),
          }}
          sx={{
            mb: 1.5,
            '& .MuiOutlinedInput-root': {
              backgroundColor: 'rgba(3, 11, 24, 0.7)',
              fontSize: 13,
            },
          }}
        />
        
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Chip
            label="All"
            size="small"
            variant={selectedCategory === 'all' ? 'filled' : 'outlined'}
            onClick={() => setSelectedCategory('all')}
            sx={{ fontSize: 11 }}
          />
          {(Object.keys(CATEGORY_LABELS) as AspectRatioCategory[]).map(cat => (
            <Chip
              key={cat}
              icon={CATEGORY_ICONS[cat] as React.ReactElement}
              label={CATEGORY_LABELS[cat]}
              size="small"
              variant={selectedCategory === cat ? 'filled' : 'outlined'}
              onClick={() => setSelectedCategory(cat)}
              sx={{ fontSize: 11, '& .MuiChip-icon': { fontSize: 14 }, maxWidth: '100%' }}
            />
          ))}
        </Box>
      </TemplateSection>
      
      {/* Popular Templates */}
      {selectedCategory === 'all' && !searchQuery && favoritePresets.length > 0 && (
        <TemplateSection>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            {showOnlyFavorites ? 'Favoritter' : 'Popular Templates'}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
            {favoritePresets.map((preset) => {
              const isSelected = selectedTemplate?.aspectRatio.id === preset.id;
              const aspectRatio = calculateAspectRatio(preset.width, preset.height);
              const isFavorite = favoritePresetIds.has(preset.id);
              
              return (
                <Box key={preset.id} sx={popularCardItemSx}>
                  <TemplateCard selected={isSelected} onClick={() => handlePresetClick(preset)}>
                    <Box sx={{ position: 'relative', mb: 1.1 }}>
                      <AspectPreview aspectRatio={aspectRatio}>
                        <Box
                          sx={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {isSelected && <Check sx={{ color: '#3b82f6', fontSize: 20 }} />}
                        </Box>
                      </AspectPreview>
                      <IconButton
                        size="small"
                        onClick={(event) => {
                          event.stopPropagation();
                          togglePresetFavorite(preset.id);
                        }}
                        sx={{
                          position: 'absolute',
                          top: -8,
                          right: -8,
                          bgcolor: 'rgba(2, 6, 23, 0.72)',
                          border: '1px solid rgba(99, 102, 241, 0.35)',
                        }}
                      >
                        {isFavorite
                          ? <Star sx={{ fontSize: 14, color: '#f59e0b' }} />
                          : <StarBorder sx={{ fontSize: 14, color: 'rgba(255,255,255,0.76)' }} />}
                      </IconButton>
                    </Box>
                    <Typography variant="caption" fontWeight={500} display="block" noWrap>
                      {preset.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" fontSize={10}>
                      {formatAspectRatio(preset.width, preset.height)}
                    </Typography>
                  </TemplateCard>
                </Box>
              );
            })}
          </Box>
        </TemplateSection>
      )}
      
      {/* Grouped Templates */}
      {(Object.keys(groupedPresets) as AspectRatioCategory[]).map(category => {
        const presets = groupedPresets[category];
        if (presets.length === 0) return null;
        
        return (
          <TemplateSection key={category}>
            <Stack direction="row" alignItems="center" gap={1} mb={1}>
              {CATEGORY_ICONS[category]}
              <Typography variant="caption" color="text.secondary" fontWeight={500}>
                {CATEGORY_LABELS[category]}
              </Typography>
              <Chip label={presets.length} size="small" sx={{ height: 16, fontSize: 10 }} />
            </Stack>
            
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
            {presets.map((preset) => {
                const isSelected = selectedTemplate?.aspectRatio.id === preset.id;
                const aspectRatio = calculateAspectRatio(preset.width, preset.height);
                const isFavorite = favoritePresetIds.has(preset.id);
                
                return (
                  <Box key={preset.id} sx={templateCardItemSx}>
                    <TemplateCard selected={isSelected} onClick={() => handlePresetClick(preset)}>
                      <Box sx={{ position: 'relative' }}>
                        <AspectPreview aspectRatio={aspectRatio}>
                          <Box
                            sx={{
                              position: 'absolute',
                              inset: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {isSelected && <Check sx={{ color: '#3b82f6', fontSize: 16 }} />}
                          </Box>
                        </AspectPreview>
                        <IconButton
                          size="small"
                          onClick={(event) => {
                            event.stopPropagation();
                            togglePresetFavorite(preset.id);
                          }}
                          sx={{
                            position: 'absolute',
                            top: -8,
                            right: -8,
                            bgcolor: 'rgba(2, 6, 23, 0.72)',
                            border: '1px solid rgba(99, 102, 241, 0.35)',
                          }}
                        >
                          {isFavorite
                            ? <Star sx={{ fontSize: 14, color: '#f59e0b' }} />
                            : <StarBorder sx={{ fontSize: 14, color: 'rgba(255,255,255,0.76)' }} />}
                        </IconButton>
                      </Box>
                      <Typography variant="caption" fontWeight={500} display="block" noWrap sx={{ mt: 0.5 }}>
                        {preset.name}
                      </Typography>
                      <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Typography variant="caption" color="text.secondary" fontSize={10}>
                          {formatAspectRatio(preset.width, preset.height)}
                        </Typography>
                        <CategoryChip
                          categoryColor={preset.color}
                          label={category}
                          size="small"
                          variant="outlined"
                        />
                      </Stack>
                    </TemplateCard>
                  </Box>
                );
              })}
            </Box>
          </TemplateSection>
        );
      })}
      
      {/* Custom Templates */}
      {filteredCustomTemplates.length > 0 && (
        <TemplateSection>
          <Stack direction="row" alignItems="center" gap={1} mb={1}>
            <Settings fontSize="small" />
            <Typography variant="caption" color="text.secondary" fontWeight={500}>
              My Custom Templates
            </Typography>
          </Stack>
          
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
            {filteredCustomTemplates.map((template) => {
              const isSelected = selectedTemplate?.id === template.id;
              const aspectRatio = calculateAspectRatio(
                template.aspectRatio.width,
                template.aspectRatio.height
              );
              
              return (
                <Box key={template.id} sx={templateCardItemSx}>
                  <TemplateCard selected={isSelected} onClick={() => onTemplateSelect(template)}>
                    <Stack direction="row" alignItems="start" justifyContent="space-between">
                      <Box sx={{ flex: 1 }}>
                        <AspectPreview aspectRatio={aspectRatio}>
                          <Box
                            sx={{
                              position: 'absolute',
                              inset: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {isSelected && <Check sx={{ color: '#3b82f6', fontSize: 16 }} />}
                          </Box>
                        </AspectPreview>
                      </Box>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          onTemplateDelete?.(template.id);
                        }}
                        sx={{ ml: 0.5, p: 0.25 }}
                      >
                        <Delete sx={{ fontSize: 14, color: 'error.main' }} />
                      </IconButton>
                    </Stack>
                    <Typography variant="caption" fontWeight={500} display="block" noWrap sx={{ mt: 0.5 }}>
                      {template.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" fontSize={10}>
                      {formatAspectRatio(template.aspectRatio.width, template.aspectRatio.height)}
                    </Typography>
                  </TemplateCard>
                </Box>
              );
            })}
          </Box>
        </TemplateSection>
      )}

      {filteredPresets.length === 0 && filteredCustomTemplates.length === 0 && (
        <TemplateSection>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
            Ingen templates funnet
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Prøv et annet søk, slå av favoritt-filter, eller opprett en custom template.
          </Typography>
        </TemplateSection>
      )}
      
      {/* Selected Template Settings */}
      {selectedTemplate && (
        <>
          <Divider sx={{ my: 2 }} />
          
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            onClick={() => setShowGuideSettings(!showGuideSettings)}
            sx={{ cursor: 'pointer', mb: 1 }}
          >
            <Stack direction="row" alignItems="center" gap={1}>
              <GridOn fontSize="small" />
              <Typography variant="caption" fontWeight={500}>
                Frame Guides
              </Typography>
            </Stack>
            <Switch
              size="small"
              checked={selectedTemplate.guides.enabled}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => handleGuideChange({ enabled: e.target.checked })}
            />
          </Stack>
          
          <Collapse in={showGuideSettings && selectedTemplate.guides.enabled}>
            <Box sx={{ pl: 3, pr: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                Guide Type
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2 }}>
                {(['thirds', 'golden', 'diagonal', 'center', 'safe'] as GuideType[]).map(type => (
                  <Box key={type} sx={{ width: 'calc(33.333% - 6px)' }}>
                    <Paper
                      onClick={() => handleGuideChange({ type })}
                      sx={{
                        p: 0.5,
                        cursor: 'pointer',
                        backgroundColor: selectedTemplate.guides.type === type 
                          ? 'rgba(59, 130, 246, 0.2)' 
                          : 'rgba(0,0,0,0.2)',
                        border: selectedTemplate.guides.type === type
                          ? '1px solid rgba(59, 130, 246, 0.5)'
                          : '1px solid transparent',
                        textAlign: 'center',
                        borderRadius: 1,
                      }}
                    >
                      <GuidePreviewCanvas
                        type={type}
                        aspectRatio={calculateAspectRatio(
                          selectedTemplate.aspectRatio.width,
                          selectedTemplate.aspectRatio.height
                        )}
                      />
                      <Typography variant="caption" fontSize={9} sx={{ mt: 0.5, display: 'block' }}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </Typography>
                    </Paper>
                  </Box>
                ))}
              </Box>
              
              <Typography variant="caption" color="text.secondary">
                Opacity
              </Typography>
              <Slider
                size="small"
                value={selectedTemplate.guides.opacity}
                onChange={(_, v) => handleGuideChange({ opacity: v as number })}
                min={0.1}
                max={1}
                step={0.1}
                sx={{ mt: 0 }}
              />
              
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={selectedTemplate.guides.showActionSafe}
                    onChange={(e) => handleGuideChange({ showActionSafe: e.target.checked })}
                  />
                }
                label={<Typography variant="caption">Action Safe (93%)</Typography>}
              />
              
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={selectedTemplate.guides.showTitleSafe}
                    onChange={(e) => handleGuideChange({ showTitleSafe: e.target.checked })}
                  />
                }
                label={<Typography variant="caption">Title Safe (90%)</Typography>}
              />
            </Box>
          </Collapse>
        </>
      )}
      
      {/* Custom Template Dialog */}
      <Dialog
        open={showCustomDialog}
        onClose={() => setShowCustomDialog(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: 'rgba(30, 30, 40, 0.98)',
            backgroundImage: 'none',
          },
        }}
      >
        <DialogTitle>Create Custom Template</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Template Name"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              fullWidth
              size="small"
            />
            
            <Stack direction="row" spacing={2}>
              <TextField
                label="Width"
                type="number"
                value={Number.isFinite(customWidth) ? customWidth : ''}
                onChange={(e) => {
                  const next = Number.parseFloat(e.target.value);
                  setCustomWidth(Number.isFinite(next) ? next : Number.NaN);
                }}
                size="small"
                inputProps={{ min: 1 }}
              />
              <Typography sx={{ alignSelf: 'center' }}>:</Typography>
              <TextField
                label="Height"
                type="number"
                value={Number.isFinite(customHeight) ? customHeight : ''}
                onChange={(e) => {
                  const next = Number.parseFloat(e.target.value);
                  setCustomHeight(Number.isFinite(next) ? next : Number.NaN);
                }}
                size="small"
                inputProps={{ min: 1 }}
              />
            </Stack>
            
            <Box>
              <Typography variant="caption" color="text.secondary">
                Preview
              </Typography>
              <Box sx={{ mt: 1, maxWidth: 200 }}>
                <AspectPreview aspectRatio={safeCustomAspectRatio} />
              </Box>
              <Typography variant="caption" color="text.secondary">
                {formatAspectRatio(safeCustomWidth, safeCustomHeight)} • {safeCustomAspectRatio.toFixed(2)}:1
              </Typography>
            </Box>
            
            {/* Quick Presets */}
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                Quick Presets
              </Typography>
              <Stack direction="row" gap={0.5} flexWrap="wrap">
                {[
                  { w: 16, h: 9, label: '16:9' },
                  { w: 4, h: 3, label: '4:3' },
                  { w: 1, h: 1, label: '1:1' },
                  { w: 9, h: 16, label: '9:16' },
                  { w: 21, h: 9, label: '21:9' },
                  { w: 2.39, h: 1, label: '2.39:1' },
                ].map(({ w, h, label }) => (
                  <Chip
                    key={label}
                    label={label}
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      setCustomWidth(w);
                      setCustomHeight(h);
                    }}
                    sx={{ fontSize: 10 }}
                  />
                ))}
              </Stack>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCustomDialog(false)} size="small">
            Cancel
          </Button>
          <Button
            onClick={handleCreateCustom}
            variant="contained"
            size="small"
            startIcon={<Add />}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default StoryboardTemplates;
