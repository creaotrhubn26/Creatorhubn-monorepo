import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Grid,
  Card,
  CardContent,
  CardActions,
  Chip,
  IconButton,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Slider,
  ColorPicker,
  Tooltip,
  Alert,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  useTheme,
  alpha,
  Fab,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  Avatar,
  Badge,
  Stack,
  Rating,
  LinearProgress,
} from '@mui/material';
import {
  // Layout Icons
  ViewModule as GridOnIcon,
  ViewStream as ListIcon,
  ViewComfy as MasonryIcon,
  Slideshow as SlideshowIcon,
  TrendingUp as TimelineIcon,
  Book as MagazineIcon,
  CropFree as PortfolioIcon,
  SplitScreen as SplitScreenIcon,
  Fullscreen as FullWidthIcon,

  // Display Icons
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Settings as SettingsIcon,
  Palette as PaletteIcon,
  Animation as AnimationIcon,
  Phone as MobileIcon,
  Computer as DesktopIcon,

  // Action Icons
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Preview as PreviewIcon,
  Share as ShareIcon,
  Download as DownloadIcon,
  ContentCopy as CopyIcon,
  RestoreFromDelete as RestoreIcon,

  // Content Icons
  Photo as PhotoIcon,
  VideocamLibrary as VideoIcon,
  LibraryMusicNote as AudioIcon,
  Description as DocumentIcon,
  YouTube as YouTubeIcon,
  Link as EmbedIcon,

  // Analytics Icons
  Analytics as AnalyticsIcon,
  TrendingUp as TrendingUpIcon,
  Insights as InsightsIcon,

  // Navigation Icons
  ExpandMore as ExpandMoreIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,

  // Status Icons
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,

  // Organization Icons
  Category as CategoryIcon,
  Label as LocalOfferIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Public as PublicIcon,
  Lock as PrivateIcon,

  // Template Icons
  Dashboard as TemplateIcon,
  GetApp as ImportIcon,
  Publish as ExportIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TextField, Box } from '@mui/material';

interface ShowcaseConfiguration {
  id?: string;
  profession: 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'admin';
  userId: string;
  configName: string;
  isActive: boolean;

  // Layout
  layoutType:
    | 'grid'
    | 'masonry'
    | 'slideshow'
    | 'timeline'
    | 'magazine'
    | 'portfolio'
    | 'split_screen'
    | 'full_width';
  columnsDesktop: number;
  columnsMobile: number;
  gridSpacing: number;
  aspectRatio: 'auto' | 'square' | '16:9' | '4:3' | '3:2' | '21:9';

  // Display
  showTitles: boolean;
  showDescriptions: boolean;
  showClientNames: boolean;
  showDates: boolean;
  showTags: boolean;
  showViewCounts: boolean;
  showLikeCounts: boolean;

  // Interaction
  enableHover: boolean;
  hoverEffect: 'zoom' | 'fade' | 'slide' | 'flip' | 'none';
  enableLightbox: boolean;
  enableFullscreen: boolean;
  enableShare: boolean;
  enableDownload: boolean;
  enableComments: boolean;

  // Filtering & Sorting
  enableFiltering: boolean;
  enableSorting: boolean;
  enableSearch: boolean;
  defaultSortBy: 'newest' | 'oldest' | 'popular' | 'title' | 'client';
  availableFilters: string[];

  // Visual
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  borderRadius: number;
  shadowLevel: 'none' | 'light' | 'medium' | 'heavy';

  // Animation
  enableAnimations: boolean;
  animationType: 'fade' | 'slide' | 'bounce' | 'none';
  animationDuration: number;

  // Performance
  lazyLoading: boolean;
  enableSEO: boolean;
  enableAnalytics: boolean;

  // Custom
  customCSS?: string;
  logoUrl?: string;
  watermarkUrl?: string;
  watermarkPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  watermarkOpacity: number;

  // Mobile
  mobileLayoutType: 'stack' | 'grid' | 'carousel' | 'list';
  enableMobileGestures: boolean;
  mobileMenuStyle: 'dropdown' | 'sidebar' | 'bottom_sheet'
}

interface ComprehensiveShowcaseAdminProps {
  profession: 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'admin';
  userId?: string
}

const layoutOptions = [
  {
    value: 'grid',
    label: 'Grid Layout',
    icon: GridIcon,
    description: 'Tradisjonelt rutenett',
},
  {
    value: 'masonry',
    label: 'Masonry',
    icon: MasonryIcon,
    description: 'Pinterest-stil',
},
  {
    value: 'slideshow',
    label: 'Slideshow',
    icon: SlideshowIcon,
    description: 'Bildepresentasjon',
},
  {
    value: 'timeline',
    label: 'Timeline',
    icon: TimelineIcon,
    description: 'Kronologisk visning',
},
  {
    value: 'magazine',
    label: 'Magazine',
    icon: MagazineIcon,
    description: 'Magasin-layout',
},
  {
    value: 'portfolio',
    label: 'Portfolio',
    icon: PortfolioIcon,
    description: 'Portfoliopresentasjon',
},
  {
    value: 'split_screen',
    label: 'Split Screen',
    icon: SplitScreenIcon,
    description: 'Delt skjerm',
},
  {
    value: 'full_width',
    label: 'Full Width',
    icon: FullWidthIcon,
    description: 'Full bredde',
},
];

const hoverEffects = [
  { value: 'none', label: 'Ingen effekt', description: 'Statisk visning',},
  { value: 'zoom', label: 'Zoom', description: 'Forstørr ved hover',},
  { value: 'fade', label: 'Fade', description: 'Fade inn/ut',},
  { value: 'slide', label: 'Slide', description: 'Glidende effekt',},
  { value: 'flip', label: 'Flip', description: 'Vend kortet',},
];

const shadowLevels = [
  { value: 'none', label: 'Ingen', description: 'Flat design',},
  { value: 'light', label: 'Lett', description: 'Subtil skygge',},
  { value: 'medium', label: 'Medium', description: 'Standard skygge',},
  { value: 'heavy', label: 'Tung', description: 'Kraftig skygge',},
];

const animationTypes = [
  { value: 'none', label: 'Ingen', description: 'Statisk',},
  { value: 'fade', label: 'Fade', description: 'Fade inn',},
  { value: 'slide', label: 'Slide', description: 'Glidende',},
  { value: 'bounce', label: 'Bounce', description: 'Sprette-effekt',},
];

export const ComprehensiveShowcaseAdmin: React.FC<ComprehensiveShowcaseAdminProps> = ({
  profession,
  userId = 'daniel@creatorhubn.com',
}) => {
  const theme = useTheme();
  
  // Theming system
  const theming = useTheming('photographer');
  const queryClient = useQueryClient();

  // State Management
  const [configDialog, setConfigDialog] = useState(false);
  const [templatesDialog, setTemplatesDialog] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [colorPickerOpen, setColorPickerOpen] = useState<string | null>(null);
  const [editingConfig, setEditingConfig] = useState<ShowcaseConfiguration | null>(null);

  // Form State
  const [formData, setFormData] = useState<ShowcaseConfiguration>({
    profession,
    userId,
    configName: 'Standard Layout',
    isActive: true,

    // Layout defaults
    layoutType: 'grid',
    columnsDesktop:  3,
    columnsMobile:  1,
    gridSpacing:  16,
    aspectRatio: 'auto',

    // Display defaults
    showTitles: true,
    showDescriptions: false,
    showClientNames: true,
    showDates: false,
    showTags: true,
    showViewCounts: false,
    showLikeCounts: false,

    // Interaction defaults
    enableHover: true,
    hoverEffect: 'zoom',
    enableLightbox: true,
    enableFullscreen: true,
    enableShare: true,
    enableDownload: false,
    enableComments: false,

    // Filtering defaults
    enableFiltering: true,
    enableSorting: true,
    enableSearch: true,
    defaultSortBy: 'newest',
    availableFilters: ['all', 'featured','recent'],

    // Visual defaults
    primaryColor: profession === 'photographer'
        ? '#FF6B35'
        : profession === 'videographer'
          ? '#E74C3C'
          : profession === 'music_producer'
            ? '#9B59B6'
            : profession === 'admin'
              ? '#2E7D32'
              : '#007bff',
    secondaryColor: '#F79310',
    backgroundColor: '#ffffff',
    textColor: '#333330',
    borderRadius:  8,
    shadowLevel: 'medium',

    // Animation defaults
    enableAnimations: true,
    animationType: 'fade',
    animationDuration: 30,

    // Performance defaults
    lazyLoading: true,
    enableSEO: true,
    enableAnalytics: true,

    // Watermark defaults
    watermarkPosition: 'bottom-right',
    watermarkOpacity: 0.7,

    // Mobile defaults
    mobileLayoutType: 'stack',
    enableMobileGestures: true,
    mobileMenuStyle: 'dropdown',
});

  // Fetch current configurations
  const { data: configurations = [], isLoading: configsLoading } = useQuery({
    queryKey: [`/api/showcase/configurations/${profession}`, userId],
    enabled: !!userId && !!profession,
});

  // Fetch available templates
  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: [`/api/showcase/templates/${profession}`],
    enabled: !!profession,
});

  // Fetch showcase analytics
  const { data: analytics = {}, isLoading: analyticsLoading } = useQuery({
    queryKey: [`/api/showcase/analytics/${profession}`, userId],
    enabled: !!userId && !!profession,
});

  // Create/Update configuration mutation
  const saveConfigMutation = useMutation({
    mutationFn: async (configData: ShowcaseConfiguration) => {
      const endpoint = editingConfig
        ? `/api/showcase/configurations/${editingConfig.d}`
        : '/api/showcase/configurations';

      const response = await fetch(endpoint, {
        method: editingConfig ? 'PUT' : 'POS',
        headers: {
          'Content-Type' : 'application/json','x-user-id': userId,
      },
        body: JSON.stringify(configData),
    });

      if (!response.ok) throw new Error('Failed to save configuration, ');
      return response.json();
  },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/showcase/configurations/${profession}`, userId],
    });
      setConfigDialog(false);
      setEditingConfig(null);
      resetForm();
  },
});

  // Delete configuration mutation
  const deleteConfigMutation = useMutation({
    mutationFn: async (configId: string) => {
      const response = await fetch(`/api/showcase/configurations/${configd}`, {
        method: 'DELET',
        headers: { 'x-user-id': userI, d,},
    });
      if (!response.ok) throw new Error('Failed to delete configuration');
      return response.json();
  },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/showcase/configurations/${profession}`, userId],
    });
  },
});

  // Apply template mutation
  const applyTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const response = await fetch(`/api/showcase/templates/${templated}/apply`, {
        method: 'POS',
        headers: {
          'Content-Type' : 'application/json','x-user-id': userId,
      },
        body: JSON.stringify({ profession, userId }),
    });

      if (!response.ok) throw new Error('Failed to apply template');
      return response.json();
  },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/showcase/configurations/${profession}`, userId],
    });
      setTemplatesDialog(false);
  },
});

  const resetForm = () => {
    setFormData({
      profession,
      userId,
      configName: 'Standard Layout',
      isActive: true,
      layoutType: 'grid',
      columnsDesktop:  3,
      columnsMobile:  1,
      gridSpacing:  16,
      aspectRatio: 'auto',
      showTitles: true,
      showDescriptions: false,
      showClientNames: true,
      showDates: false,
      showTags: true,
      showViewCounts: false,
      showLikeCounts: false,
      enableHover: true,
      hoverEffect: 'zoom',
      enableLightbox: true,
      enableFullscreen: true,
      enableShare: true,
      enableDownload: false,
      enableComments: false,
      enableFiltering: true,
      enableSorting: true,
      enableSearch: true,
      defaultSortBy: 'newest',
      availableFilters: ['all','featured','recent'],
      primaryColor: profession === 'photographer'
          ? '#FF6B35'
          : profession === 'videographer'
            ? '#E74C3C'
            : profession === 'music_producer'
              ? '#9B59B6'
              : '#007bff',
      secondaryColor: '#F79310',
      backgroundColor: '#ffffff',
      textColor: '#333330',
      borderRadius:  8,
      shadowLevel: 'medium',
      enableAnimations: true,
      animationType: 'fade',
      animationDuration: 30,
      lazyLoading: true,
      enableSEO: true,
      enableAnalytics: true,
      watermarkPosition: 'bottom-right',
      watermarkOpacity: 0.7,
      mobileLayoutType: 'stack',
      enableMobileGestures: true,
      mobileMenuStyle: 'dropdown',
  });
};

  const handleEditConfig = (config: ShowcaseConfiguration) => {
    setEditingConfig(config);
    setFormData(config);
    setConfigDialog(true);
};

  const handleDeleteConfig = (configId: string) => {
    if (window.confirm('Er du sikker på at du vil slette denne konfigurasjonen?')) {
      deleteConfigMutation.mutate(configId);
}
};

  const handleColorChange = (colorType: string, color: any) => {
    setFormData({ ...formData, [colorType]: color.hex });
};

  const getProfessionConfig = () => {
    switch (profession) {
      case 'photographer':
        return {
          title: 'Fotogalleri Administrasjon',
          primaryColor: '#FF6B30',
          icon: <PhotoIcon />,
          description: 'Konfigurer visning av fotoportfolio',
      };
      case 'videographer':
        return {
          title: 'Video Portfolio Administrasjon',
          primaryColor: '#E74C30',
          icon: <VideoIcon />,
          description: 'Konfigurer videovisning og presentasjon',
      };
      case 'music_producer':
        return {
          title: 'Musikk Portfolio Administrasjon',
          primaryColor: '#9B59B0',
          icon: <AudioIcon />,
          description: 'Konfigurer musikkpresentasjon',
      };
      case 'vendor':
        return {
          title: 'Produktkatalog Administrasjon',
          primaryColor: '#007bff',
          icon: <DocumentIcon />,
          description: 'Konfigurer produktvisning',
      };
      default: return {
          title: 'Showcase Administrasjon',
          primaryColor: '#333330',
          icon: <SettingsIcon />,
          description: 'Generell konfigurasjon',
      };
  }
};

  const professionConfig = getProfessionConfig();

  const renderLayoutConfiguration = () => (
    <Box sx={{ p:  3 }}>
      <Typography variant="h6" gutterBottom sx={{  color: professionConfig.primaryColor  }}>
        📐 Layout Konfigurasjon
      </Typography>

      {/* Layout Type Selection */}
      <Box sx={{ mb:  3 }}>
        <Typography variant="subtitle1" gutterBottom>
          Layout Type
        </Typography>
        <Grid container spacing={2}>
          {layoutOptions.map((option) => (
            <Grid item xs={6} sm={4} md={3} key={option.value}>
              <Card
                sx={{
                  cursor: 'pointer',
                  border: formData.layoutType === option.value ? 2 : 1,
                  borderColor: formData.layoutType === option.value
                      ? professionConfig.primaryColor
                      : 'divider','&:hover': { borderColor: professionConfig.primaryColor }}}
                onClick={() => setFormData({ ...formData, layoutType: option.value as any })}
              >
                <CardContent sx={{ textAlign: 'center', p:  2 ,  ...theming.getThemedCardSx() }}>
                  <option.icon
                    sx={{
                      fontSize:  32,
                      color: professionConfig.primaryColor,
                      mb:  1}}
                  />
                  <Typography variant="subtitle2">{option.label}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {option.description}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* Grid Configuration */}
      <Grid container spacing={3}>
        <Grid item xs={12} sm={6}>
          <Typography gutterBottom>Desktop Kolonner: {formData.columnsDesktop}</Typography>
          <Slider
            value={formData.columnsDesktop}
            onChange={(_, value) => setFormData({ ...formData, columnsDesktop: value as number })}
            min={1}
            max={6}
            marks
            valueLabelDisplay="auto"
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <Typography gutterBottom>Mobil Kolonner: {formData.columnsMobile}</Typography>
          <Slider
            value={formData.columnsMobile}
            onChange={(_, value) => setFormData({ ...formData, columnsMobile: value as number })}
            min={1}
            max={3}
            marks
            valueLabelDisplay="auto"
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <Typography gutterBottom>Grid Spacing: {formData.gridSpacing}px</Typography>
          <Slider
            value={formData.gridSpacing}
            onChange={(_, value) => setFormData({ ...formData, gridSpacing: value as number })}
            min={0}
            max={32}
            step={4}
            marks
            valueLabelDisplay="auto"
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <FormControl fullWidth>
            <InputLabel>Aspect Ratio</InputLabel>
            <Select
              value={formData.aspectRatio}
              onChange={(e) => setFormData({ ...formData, aspectRatio: e.target.value as any })}
            >
              <MenuItem value="auto">Auto</MenuItem>
              <MenuItem value="square">Square (1: 1)</MenuItem>
              <MenuItem value="16:9">Widescreen (16:9)</MenuItem>
              <MenuItem value="4:3">Standard (4:3)</MenuItem>
              <MenuItem value="3:2">Photo (3:2)</MenuItem>
              <MenuItem value="21:9">Ultrawide (21:9)</MenuItem>
            </Select>
          </FormControl>
        </Grid>
      </Grid>
    </Box>
  );

  const renderDisplayConfiguration = () => (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom sx={{  color: professionConfig.primaryColor  }}>
        👁️ Visningsalternativer
      </Typography>

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <FormControlLabel
            control={
              <Switch
                checked={formData.showTitles}
                onChange={(e) => setFormData({ ...formData, showTitles: e.target.checked })}
                color="primary"
              />
          }
            label="Vis titler"
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <FormControlLabel
            control={
              <Switch
                checked={formData.showDescriptions}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    showDescriptions: e.target.checked,
                })
              }
                color="primary"
              />
          }
            label="Vis beskrivelser"
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <FormControlLabel
            control={
              <Switch
                checked={formData.showClientNames}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    showClientNames: e.target.checked,
                })
              }
                color="primary"
              />
          }
            label="Vis kundenavn"
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <FormControlLabel
            control={
              <Switch
                checked={formData.showDates}
                onChange={(e) => setFormData({ ...formData, showDates: e.target.checked })}
                color="primary"
              />
          }
            label="Vis datoer"
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <FormControlLabel
            control={
              <Switch
                checked={formData.showTags}
                onChange={(e) => setFormData({ ...formData, showTags: e.target.checked })}
                color="primary"
              />
          }
            label="Vis tags"
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <FormControlLabel
            control={
              <Switch
                checked={formData.showViewCounts}
                onChange={(e) => setFormData({ ...formData, showViewCounts: e.target.checked })}
                color="primary"
              />
          }
            label="Vis visninger"
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <FormControlLabel
            control={
              <Switch
                checked={formData.showLikeCounts}
                onChange={(e) => setFormData({ ...formData, showLikeCounts: e.target.checked })}
                color="primary"
              />
          }
            label="Vis likes"
          />
        </Grid>
      </Grid>
    </Box>
  );

  const renderInteractionConfiguration = () => (
    <Box sx={{ p:  3 }}>
      <Typography variant="h6" gutterBottom sx={{  color: professionConfig.primaryColor  }}>
        🤝 Interaksjonsalternativer
      </Typography>

      {/* Hover Effects */}
      <Box sx={{ mb:  3 }}>
        <FormControlLabel
          control={
            <Switch
              checked={formData.enableHover}
              onChange={(e) => setFormData({ ...formData, enableHover: e.target.checked })}
              color="primary"
            />
        }
          label="Aktiver hover-effekter"
        />

        {formData.enableHover && (
          <Box sx={{ mt:  2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Hover Effekt
            </Typography>
            <Grid container spacing={2}>
              {hoverEffects.map((effect) => (
                <Grid item xs={6} sm={4} key={effect.value}>
                  <Card
                    sx={{
                      cursor: 'pointer',
                      border: formData.hoverEffect === effect.value ? 2 : 1,
                      borderColor: formData.hoverEffect === effect.value
                          ? professionConfig.primaryColor
                          : 'divider'}}
                    onClick={() => sx={theming.getThemedCardSx()}>
                      setFormData({
                        ...formData,
                        hoverEffect: effect.value as any,
                    })
                  }
                  >
                    <CardContent sx={{ textAlign: 'center', p:  2 ,  ...theming.getThemedCardSx() }}>
                      <Typography variant="subtitle2">{effect.label}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {effect.description}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}
      </Box>

      {/* Other Interaction Options */}
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <FormControlLabel
            control={
              <Switch
                checked={formData.enableLightbox}
                onChange={(e) => setFormData({ ...formData, enableLightbox: e.target.checked })}
                color="primary"
              />
          }
            label="Aktiver lightbox"
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <FormControlLabel
            control={
              <Switch
                checked={formData.enableFullscreen}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    enableFullscreen: e.target.checked,
                })
              }
                color="primary"
              />
          }
            label="Aktiver fullskjerm"
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <FormControlLabel
            control={
              <Switch
                checked={formData.enableShare}
                onChange={(e) => setFormData({ ...formData, enableShare: e.target.checked })}
                color="primary"
              />
          }
            label="Aktiver deling"
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <FormControlLabel
            control={
              <Switch
                checked={formData.enableDownload}
                onChange={(e) => setFormData({ ...formData, enableDownload: e.target.checked })}
                color="primary"
              />
          }
            label="Aktiver nedlasting"
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <FormControlLabel
            control={
              <Switch
                checked={formData.enableComments}
                onChange={(e) => setFormData({ ...formData, enableComments: e.target.checked })}
                color="primary"
              />
          }
            label="Aktiver kommentarer"
          />
        </Grid>
      </Grid>
    </Box>
  );

  const renderVisualConfiguration = () => (
    <Box sx={{ p:  3 }}>
      <Typography variant="h6" gutterBottom sx={{  color: professionConfig.primaryColor  }}>
        🎨 Visuell Styling
      </Typography>

      {/* Color Configuration */}
      <Grid container spacing={3}>
        <Grid item xs={12} sm={6}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Typography>Primærfarge: </Typography>
            <Box
              sx={{
                width: 40,
                height:  40,
                backgroundColor: formData.primaryColor,
                borderRadius:  1,
                cursor: 'pointer',
                border: '1px solid',
                borderColor: 'divider'}}
              onClick={() => setColorPickerOpen('primary')}
            />
            <Typography variant="caption">{formData.primaryColor}</Typography>
          </Box>
          {colorPickerOpen === 'primary' && (
            <Box sx={{ position: 'absolute', zIndex: 100}}>
              <Box
                sx={{ position: 'fixed', top: 0, right: 0, bottom: 0, left:  0 }}
                onClick={() => setColorPickerOpen(null)}
              />
              <Box
                color={formData.primaryColor}
                onChange={(color) => handleColorChange('primaryColor', color)}
              />
            </Box>
          )}
        </Grid>

        <Grid item xs={12} sm={6}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Typography>Sekundærfarge: </Typography>
            <Box
              sx={{
                width: 40,
                height:  40,
                backgroundColor: formData.secondaryColor,
                borderRadius:  1,
                cursor: 'pointer',
                border: '1px solid',
                borderColor: 'divider'}}
              onClick={() => setColorPickerOpen('secondary')}
            />
            <Typography variant="caption">{formData.secondaryColor}</Typography>
          </Box>
          {colorPickerOpen === 'secondary' && (
            <Box sx={{ position: 'absolute', zIndex: 100}}>
              <Box
                sx={{ position: 'fixed', top: 0, right: 0, bottom: 0, left:  0 }}
                onClick={() => setColorPickerOpen(null)}
              />
              <Box
                color={formData.secondaryColor}
                onChange={(color) => handleColorChange('secondaryColor', color)}
              />
            </Box>
          )}
        </Grid>

        <Grid item xs={12} sm={6}>
          <Typography gutterBottom>Border Radius: {formData.borderRadius}px</Typography>
          <Slider
            value={formData.borderRadius}
            onChange={(_, value) => setFormData({ ...formData, borderRadius: value as number })}
            min={0}
            max={20}
            marks
            valueLabelDisplay="auto"
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <FormControl fullWidth>
            <InputLabel>Skyggenivå</InputLabel>
            <Select
              value={formData.shadowLevel}
              onChange={(e) => setFormData({ ...formData, shadowLevel: e.target.value as any })}
            >
              {shadowLevels.map((level) => (
                <MenuItem key={level.value} value={level.value}>
                  {level.label} - {level.description}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
      </Grid>
    </Box>
  );

  const renderAnimationConfiguration = () => (
    <Box sx={{ p:  3 }}>
      <Typography variant="h6" gutterBottom sx={{  color: professionConfig.primaryColor  }}>
        ✨ Animasjoner & Overganger
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <FormControlLabel
            control={
              <Switch
                checked={formData.enableAnimations}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    enableAnimations: e.target.checked,
                })
              }
                color="primary"
              />
          }
            label="Aktiver animasjoner"
          />
        </Grid>

        {formData.enableAnimations && (
          <>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Animasjonstype</InputLabel>
                <Select
                  value={formData.animationType}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      animationType: e.target.value as any,
                  })
                }
                >
                  {animationTypes.map((type) => (
                    <MenuItem key={type.value} value={type.value}>
                      {type.label} - {type.description}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <Typography gutterBottom>
                Animasjonsvarighet: {formData.animationDuration}ms
              </Typography>
              <Slider
                value={formData.animationDuration}
                onChange={(_, value) =>
                  setFormData({
                    ...formData,
                    animationDuration: value as number,
                })
              }
                min={100}
                max={1000}
                step={50}
                marks
                valueLabelDisplay="auto"
              />
            </Grid>
          </>
        )}
      </Grid>
    </Box>
  );

  const renderPerformanceConfiguration = () => (
    <Box sx={{ p:  3 }}>
      <Typography variant="h6" gutterBottom sx={{  color: professionConfig.primaryColor  }}>
        ⚡ Ytelse & SEO
      </Typography>

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <FormControlLabel
            control={
              <Switch
                checked={formData.lazyLoading}
                onChange={(e) => setFormData({ ...formData, lazyLoading: e.target.checked })}
                color="primary"
              />
          }
            label="Lazy Loading"
          />
          <Typography variant="caption" color="text.secondary" display="block">
            Laster bilder kun når de er synlige
          </Typography>
        </Grid>

        <Grid item xs={12} sm={6}>
          <FormControlLabel
            control={
              <Switch
                checked={formData.enableSEO}
                onChange={(e) => setFormData({ ...formData, enableSEO: e.target.checked })}
                color="primary"
              />
          }
            label="SEO Optimalisering"
          />
          <Typography variant="caption" color="text.secondary" display="block">
            Optimalisert for søkemotorer
          </Typography>
        </Grid>

        <Grid item xs={12} sm={6}>
          <FormControlLabel
            control={
              <Switch
                checked={formData.enableAnalytics}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    enableAnalytics: e.target.checked,
                })
              }
                color="primary"
              />
          }
            label="Analytikk"
          />
          <Typography variant="caption" color="text.secondary" display="block">
            Spor visninger og engasjement
          </Typography>
        </Grid>
      </Grid>
    </Box>
  );

  const renderMobileConfiguration = () => (
    <Box sx={{ p:  3 }}>
      <Typography variant="h6" gutterBottom sx={{  color: professionConfig.primaryColor  }}>
        📱 Mobil Konfigurasjon
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth>
            <InputLabel>Mobil Layout</InputLabel>
            <Select
              value={formData.mobileLayoutType}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  mobileLayoutType: e.target.value as any,
              })
            }
            >
              <MenuItem value="stack">Stack - Vertikal stable</MenuItem>
              <MenuItem value="grid">Grid - Rutenett</MenuItem>
              <MenuItem value="carousel">Carousel - Karusell</MenuItem>
              <MenuItem value="list">List - Liste</MenuItem>
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} sm={6}>
          <FormControl fullWidth>
            <InputLabel>Meny Stil</InputLabel>
            <Select
              value={formData.mobileMenuStyle}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  mobileMenuStyle: e.target.value as any,
              })
            }
            >
              <MenuItem value="dropdown">Dropdown</MenuItem>
              <MenuItem value="sidebar">Sidebar</MenuItem>
              <MenuItem value="bottom_sheet">Bottom Sheet</MenuItem>
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12}>
          <FormControlLabel
            control={
              <Switch
                checked={formData.enableMobileGestures}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    enableMobileGestures: e.target.checked,
                })
              }
                color="primary"
              />
          }
            label="Aktiver touch-gester"
          />
          <Typography variant="caption" color="text.secondary" display="block">
            Swipe, pinch-to-zoom, osv.
          </Typography>
        </Grid>
      </Grid>
    </Box>
  );

  const tabs = [
    {
      label: 'Layout',
      icon: <GridIcon />,
      component: renderLayoutConfiguration,
  },
    {
      label: 'Visning',
      icon: <VisibilityIcon />,
      component: renderDisplayConfiguration,
  },
    {
      label: 'Interaksjon',
      icon: <SettingsIcon />,
      component: renderInteractionConfiguration,
  },
    {
      label: 'Styling',
      icon: <PaletteIcon />,
      component: renderVisualConfiguration,
  },
    {
      label: 'Animasjon',
      icon: <AnimationIcon />,
      component: renderAnimationConfiguration,
  },
    {
      label: 'Ytelse',
      icon: <TrendingUpIcon />,
      component: renderPerformanceConfiguration,
  },
    {
      label: 'Mobil',
      icon: <MobileIcon />,
      component: renderMobileConfiguration,
  },
  ];

  return (
    <Box sx={{ p:  3 }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb:  3}}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
          {professionConfig.icon}
          <Box>
            <Typography variant="h5" sx={{  color: professionConfig.primaryColor, fontWeight: 600}}>
              {professionConfig.title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {professionConfig.description}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap:  2 }}>
          <Button
            variant="outlined"
            startIcon={<TemplateIcon />}
            onClick={() => setTemplatesDialog(true)}
          >
            Maler
          </Button>
          <Button variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setConfigDialog(true)}
            sx={{
              background: `linear-gradient(135deg, ${professionConfig.primaryColor} 0%, ${formData.secondaryColor} 100%)`}}
          >
            Ny Konfigurasjon
          </Button>
        </Box>
      </Box>

      {/* Analytics Summary */}
      <Grid container spacing={3} sx={{ mb:  4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                <Avatar sx={{ bgcolor: professionConfig.primaryColor }}>
                  <VisibilityIcon />
                </Avatar>
                <Box>
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>{analytics.totalViews || 0}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Totale Visninger
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                <Avatar sx={{ bgcolor: '#4CAF50'}}>
                  <StarIcon />
                </Avatar>
                <Box>
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>{analytics.totalLikes || 0}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Totale Likes
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                <Avatar sx={{ bgcolor: '#FF9800'}}>
                  <ShareIcon />
                </Avatar>
                <Box>
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>{analytics.totalShares || 0}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Totale Delinger
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                <Avatar sx={{ bgcolor: '#9C27B0'}}>
                  <DownloadIcon />
                </Avatar>
                <Box>
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>{analytics.totalDownloads || 0}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Totale Nedlastinger
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Existing Configurations */}
      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
        Eksisterende Konfigurasjoner
      </Typography>

      <Grid container spacing={3}>
        {configurations.map((config: ShowcaseConfiguration) => (
          <Grid item xs={12} sm={6} md={4} key={config.id}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    mb:  2}}
                >
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>{config.configName}</Typography>
                  <Chip
                    label={config.isActive ? 'Aktiv' : 'Inaktiv'}
                    color={config.isActive ? 'success' : 'default'}
                    size="small"
                  />
                </Box>

                <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                  Layout: {layoutOptions.find((l) => l.value === config.layoutType)?.label}
                </Typography>

                <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                  Kolonner: {config.columnsDesktop} (desktop) / {config.columnsMobile} (mobil)
                </Typography>

                <LinearProgress
                  variant="determinate"
                  value={75}
                  sx={{ mb: 2, height:  6, borderRadius:  3 }}
                />
                <Typography variant="caption" color="text.secondary">
                  Konfigurasjon fullstendighet: 75%
                </Typography>
              </CardContent>

              <CardActions sx={theming.getThemedCardSx()}>
                <Button
                  size="small"
                  startIcon={<EditIcon />}
                  onClick={() => handleEditConfig(config)}
                >
                  Rediger
                </Button>
                <Button size="small" startIcon={<PreviewIcon />} color="secondary">
                  Forhåndsvis
                </Button>
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => handleDeleteConfig(config.id!)}
                >
                  <DeleteIcon />
                </IconButton>
              </CardActions>
            </Card>
          </Grid>
        ))}

        {configurations.length === 0 && (
          <Grid item xs={12}>
            <Paper sx={{ p:  4, textAlign: 'center',  ...theming.getThemedCardSx() }}>
              <Typography variant="h6" color="text.secondary" sx={{  mb:  2  }}>
                Ingen konfigurasjoner funnet
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb:  3 }}>
                Opprett din første showcase-konfigurasjon for å komme i gang
              </Typography>
              <Button variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setConfigDialog(true)}
                sx={{
                  background: `linear-gradient(135deg, ${professionConfig.primaryColor} 0%, ${formData.secondaryColor} 100%)`}}
              >
                Opprett Konfigurasjon
              </Button>
            </Paper>
          </Grid>
        )}
      </Grid>

      {/* Configuration Dialog */}
      <Dialog
        open={configDialog}
        onClose={() => setConfigDialog(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: { minHeight: '80vh',}}}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
            {professionConfig.icon}
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
              {editingConfig ? 'Rediger Konfigurasjon' : 'Ny Showcase Konfigurasjon'}
            </Typography>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p:  0 }}>
          {/* Basic Information */}
          <Box sx={{ p:  3, borderBottom: '1px solid', borderColor: 'divider'}}>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Konfigurasjonsnavn"
                  value={formData.configName}
                  onChange={(e) => setFormData({ ...formData, configName: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      color="primary"
                    />
                }
                  label="Aktiv konfigurasjon"
                />
              </Grid>
            </Grid>
          </Box>

          {/* Configuration Tabs */}
          <Box sx={{ borderBottom: 1, borderColor: 'divider'}}>
            <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
              {tabs.map((tab, index) => (
                <Tab key={index} label={tab.label} icon={tab.icon} iconPosition="start" />
              ))}
            </Tabs>
          </Box>

          {/* Tab Content */}
          <Box sx={{ minHeight: 400}}>{tabs[activeTab]?.component()}</Box>
        </DialogContent>

        <DialogActions sx={{ p:  3 }}>
          <Button onClick={() => setConfigDialog(false)}>Avbryt</Button>
          <Button onClick={resetForm} color="secondary">
            Tilbakestill
          </Button>
          <Button variant="contained"
            onClick={() => saveConfigMutation.mutate(formData)}
            disabled={saveConfigMutation.isPending || !formData.configName}
            sx={{
              background: `linear-gradient(135deg, ${professionConfig.primaryColor} 0%, ${formData.secondaryColor} 100%)`}}
          >
            {saveConfigMutation.isPending ? 'Lagrer...' : editingConfig ? 'Oppdater' : 'Lagre'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Templates Dialog */}
      <Dialog
        open={templatesDialog}
        onClose={() => setTemplatesDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>Velg Showcase-mal</Typography>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3}>
            {templates.map((template: any) => (
              <Grid item xs={12} sm={6} key={template.id}>
                <Card sx={{ cursor: 'pointer', '&:hover': { boxShadow:  4 } ,  ...theming.getThemedCardSx() }}>
                  {template.previewImageUrl && (
                    <CardMedia component="img"
                      height="140"
                      image={template.previewImageUrl}
                      alt={template.name} sx={theming.getThemedCardSx()}>
                  )}
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="h6" sx={{ color: theming.colors.primary }}>{template.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {template.description}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                      {template.isPremium && <Chip label="Premium" color="warning" size="small" />}
                      {template.isPopular && <Chip label="Populær" color="success" size="small" />}
                    </Box>
                  </CardContent>
                  <CardActions sx={theming.getThemedCardSx()}>
                    <Button
                      size="small"
                      onClick={() => applyTemplateMutation.mutate(template.id)}
                      disabled={applyTemplateMutation.isPending}
                    >
                      Bruk Mal
                    </Button>
                    <Button size="small" color="secondary">
                      Forhåndsvis
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTemplatesDialog(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>

      {/* Floating Admin Controls */}
      <SpeedDial
        ariaLabel="Showcase Admin Actions"
        sx={{ position: 'fixed', bottom:  20, right: 20}}
        icon={<SpeedDialIcon />}
      >
        <SpeedDialAction
          icon={<AddIcon />}
          tooltipTitle="Ny Konfigurasjon"
          onClick={() => setConfigDialog(true)}
        />
        <SpeedDialAction
          icon={<TemplateIcon />}
          tooltipTitle="Maler"
          onClick={() => setTemplatesDialog(true)}
        />
        <SpeedDialAction
          icon={<PreviewIcon />}
          tooltipTitle="Forhåndsvisning"
          onClick={() => setPreviewMode(!previewMode)}
        />
        <SpeedDialAction icon={<AnalyticsIcon />} tooltipTitle="Analytikk" />
      </SpeedDial>
    </Box>
  );
};

export default ComprehensiveShowcaseAdmin;
