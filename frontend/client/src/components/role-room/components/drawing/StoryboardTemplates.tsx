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
  ToggleButtonGroup,
  ToggleButton,
  Slider,
  Switch,
  FormControlLabel,
  Collapse,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  InputAdornment,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Badge,
  Grid,
} from '@mui/material';
import {
  AspectRatio,
  Movie,
  Tv,
  Smartphone,
  CropSquare,
  CropLandscape,
  CropPortrait,
  GridOn,
  GridOff,
  GridView,
  Add,
  Check,
  Edit,
  Delete,
  Save,
  FolderOpen,
  Star,
  StarBorder,
  ContentCopy,
  Info,
  Settings,
  Visibility,
  VisibilityOff,
  Lock,
  LockOpen,
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

// =============================================================================
// Styled Components
// =============================================================================

const TemplateCard = styled(Paper, {
  shouldForwardProp: (prop) => prop !== 'selected',
})<{ selected?: boolean }>(({ selected }) => ({
  padding: 12,
  cursor: 'pointer',
  backgroundColor: selected ? 'rgba(59, 130, 246, 0.15)' : 'rgba(30, 30, 40, 0.6)',
  border: selected ? '2px solid rgba(59, 130, 246, 0.5)' : '2px solid transparent',
  borderRadius: 8,
  transition: 'all 0.2s ease',
  '&:hover': {
    backgroundColor: selected ? 'rgba(59, 130, 246, 0.2)' : 'rgba(40, 40, 50, 0.8)',
    transform: 'translateY(-2px)',
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

const GuideOverlay = styled(Box)({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  pointerEvents: 'none',
});

const CategoryChip = styled(Chip, {
  shouldForwardProp: (prop) => prop !== 'categoryColor',
})<{ categoryColor?: string }>(({ categoryColor }) => ({
  backgroundColor: categoryColor ? `${categoryColor}20` : 'rgba(255,255,255,0.1)',
  color: categoryColor || 'inherit',
  borderColor: categoryColor ? `${categoryColor}50` : 'rgba(255,255,255,0.2)',
  fontSize: 10,
  height: 20,
}));

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
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(width, height);
  return `${width / divisor}:${height / divisor}`;
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
    case 'thirds':
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
      
    case 'golden':
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
      
    case 'safe':
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
  
  return {
    id: `template-${preset.id}-${Date.now()}`,
    name: preset.name,
    aspectRatio: preset,
    frameWidth: Math.round(width),
    frameHeight: Math.round(height),
    guides: { ...DEFAULT_GUIDES },
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
  
  // Filter presets
  const filteredPresets = useMemo(() => {
    let presets = ASPECT_RATIO_PRESETS;
    
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
    
    return presets;
  }, [selectedCategory, searchQuery]);
  
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
      name: customName,
      category: 'custom',
      width: customWidth,
      height: customHeight,
      description: `Custom ${customWidth}:${customHeight}`,
      color: '#8b5cf6',
    };
    
    const template = createTemplateFromPreset(customPreset, canvasWidth, canvasHeight);
    template.isCustom = true;
    
    onTemplateCreate?.(template);
    onTemplateSelect(template);
    setShowCustomDialog(false);
  }, [customName, customWidth, customHeight, canvasWidth, canvasHeight, onTemplateCreate, onTemplateSelect]);
  
  const handleGuideChange = useCallback((updates: Partial<FrameGuides>) => {
    if (selectedTemplate) {
      const updated = {
        ...selectedTemplate,
        guides: { ...selectedTemplate.guides, ...updates },
      };
      onTemplateSelect(updated);
    }
  }, [selectedTemplate, onTemplateSelect]);
  
  return (
    <Box sx={{ p: 2 }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
        <Typography variant="subtitle1" fontWeight={600}>
          Storyboard Templates
        </Typography>
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
      
      {/* Search */}
      <TextField
        fullWidth
        size="small"
        placeholder="Search templates..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        sx={{
          mb: 2,
          '& .MuiOutlinedInput-root': {
            backgroundColor: 'rgba(0,0,0,0.2)',
            fontSize: 12,
          },
        }}
      />
      
      {/* Category Filter */}
      <Stack direction="row" gap={0.5} flexWrap="wrap" mb={2}>
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
            sx={{ fontSize: 11, '& .MuiChip-icon': { fontSize: 14 } }}
          />
        ))}
      </Stack>
      
      {/* Popular Templates */}
      {selectedCategory === 'all' && !searchQuery && (
        <>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            Popular Templates
          </Typography>
          <Grid container spacing={1} sx={{ mb: 2 }}>
            {ASPECT_RATIO_PRESETS.filter(p => p.popular).map(preset => {
              const isSelected = selectedTemplate?.aspectRatio.id === preset.id;
              const aspectRatio = calculateAspectRatio(preset.width, preset.height);
              
              return (
                <Grid size={6} key={preset.id}>
                  <TemplateCard selected={isSelected} onClick={() => handlePresetClick(preset)}>
                    <Box sx={{ position: 'relative', mb: 1 }}>
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
                      {preset.popular && (
                        <Star
                          sx={{
                            position: 'absolute',
                            top: -4,
                            right: -4,
                            fontSize: 14,
                            color: '#f59e0b',
                          }}
                        />
                      )}
                    </Box>
                    <Typography variant="caption" fontWeight={500} display="block" noWrap>
                      {preset.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" fontSize={10}>
                      {formatAspectRatio(preset.width, preset.height)}
                    </Typography>
                  </TemplateCard>
                </Grid>
              );
            })}
          </Grid>
          <Divider sx={{ my: 2 }} />
        </>
      )}
      
      {/* Grouped Templates */}
      {(Object.keys(groupedPresets) as AspectRatioCategory[]).map(category => {
        const presets = groupedPresets[category];
        if (presets.length === 0) return null;
        
        return (
          <Box key={category} sx={{ mb: 2 }}>
            <Stack direction="row" alignItems="center" gap={1} mb={1}>
              {CATEGORY_ICONS[category]}
              <Typography variant="caption" color="text.secondary" fontWeight={500}>
                {CATEGORY_LABELS[category]}
              </Typography>
              <Chip label={presets.length} size="small" sx={{ height: 16, fontSize: 10 }} />
            </Stack>
            
            <Grid container spacing={1}>
              {presets.map(preset => {
                const isSelected = selectedTemplate?.aspectRatio.id === preset.id;
                const aspectRatio = calculateAspectRatio(preset.width, preset.height);
                
                return (
                  <Grid size={{ xs: 6, sm: 4 }} key={preset.id}>
                    <TemplateCard selected={isSelected} onClick={() => handlePresetClick(preset)}>
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
                  </Grid>
                );
              })}
            </Grid>
          </Box>
        );
      })}
      
      {/* Custom Templates */}
      {customTemplates.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Stack direction="row" alignItems="center" gap={1} mb={1}>
            <Settings fontSize="small" />
            <Typography variant="caption" color="text.secondary" fontWeight={500}>
              My Custom Templates
            </Typography>
          </Stack>
          
          <Grid container spacing={1}>
            {customTemplates.map(template => {
              const isSelected = selectedTemplate?.id === template.id;
              const aspectRatio = calculateAspectRatio(
                template.aspectRatio.width,
                template.aspectRatio.height
              );
              
              return (
                <Grid size={6} key={template.id}>
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
                </Grid>
              );
            })}
          </Grid>
        </Box>
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
              <Grid container spacing={0.5} sx={{ mb: 2 }}>
                {(['thirds', 'golden', 'diagonal', 'center', 'safe'] as GuideType[]).map(type => (
                  <Grid size={4} key={type}>
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
                  </Grid>
                ))}
              </Grid>
              
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
                value={customWidth}
                onChange={(e) => setCustomWidth(Number(e.target.value))}
                size="small"
                inputProps={{ min: 1 }}
              />
              <Typography sx={{ alignSelf: 'center' }}>:</Typography>
              <TextField
                label="Height"
                type="number"
                value={customHeight}
                onChange={(e) => setCustomHeight(Number(e.target.value))}
                size="small"
                inputProps={{ min: 1 }}
              />
            </Stack>
            
            <Box>
              <Typography variant="caption" color="text.secondary">
                Preview
              </Typography>
              <Box sx={{ mt: 1, maxWidth: 200 }}>
                <AspectPreview aspectRatio={customWidth / customHeight} />
              </Box>
              <Typography variant="caption" color="text.secondary">
                {formatAspectRatio(customWidth, customHeight)} • {(customWidth / customHeight).toFixed(2)}:1
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
