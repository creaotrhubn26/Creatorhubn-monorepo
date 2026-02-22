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
  CardMedia,
  Chip,
  IconButton,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Slider,
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
  ViewModule as GridOnIcon,
  ViewStream as ListIcon,
  ViewComfy as MasonryIcon,
  Slideshow as SlideshowIcon,
  TrendingUp as TimelineIcon,
  Book as MagazineIcon,
  CropFree as PortfolioIcon,
  Splitscreen as SplitScreenIcon,
  Fullscreen as FullWidthIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Settings as SettingsIcon,
  Palette as PaletteIcon,
  Animation as AnimationIcon,
  Phone as MobileIcon,
  Computer as DesktopIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Preview as PreviewIcon,
  Share as ShareIcon,
  Download as DownloadIcon,
  ContentCopy as CopyIcon,
  Restore as RestoreIcon,
  Photo as PhotoIcon,
  VideoLibrary as VideoIcon,
  LibraryMusic as AudioIcon,
  Description as DocumentIcon,
  YouTube as YouTubeIcon,
  Link as EmbedIcon,
  Analytics as AnalyticsIcon,
  TrendingUp as TrendingUpIcon,
  Insights as InsightsIcon,
  ExpandMore as ExpandMoreIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Category as CategoryIcon,
  LocalOffer as LocalOfferIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Public as PublicIcon,
  Lock as PrivateIcon,
  Dashboard as TemplateIcon,
  GetApp as ImportIcon,
  Publish as ExportIcon,
  GridView as GridIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface ShowcaseConfiguration {
  id?: string;
  profession: 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'admin' | 'enterprise';
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
  profession: 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'admin' | 'enterprise';
  userId?: string
}

interface ShowcaseTemplate {
  id: string;
  name: string;
  description: string;
  profession: string;
  previewImageUrl: string;
  isPremium: boolean;
  isPopular: boolean;
  configuration: Partial<ShowcaseConfiguration>;
  createdAt: string;
}

interface ShowcaseAnalytics {
  totalViews: number;
  totalLikes: number;
  totalShares: number;
  totalDownloads: number;
  totalComments: number;
  averageEngagementRate: number;
  viewsByDate: { date: string; views: number }[];
  topItems: { id: string; views: number; title: string }[];
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

  // Error and Success State
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [queryErrors, setQueryErrors] = useState<{ [key: string]: string }>({});

  // State Management
  const [configDialog, setConfigDialog] = useState(false);
  const [templatesDialog, setTemplatesDialog] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [colorPickerOpen, setColorPickerOpen] = useState<string | null>(null);
  const [editingConfig, setEditingConfig] = useState<ShowcaseConfiguration | null>(null);
  const [confirmDeleteConfigId, setConfirmDeleteConfigId] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(true);
  const [isPrivate, setIsPrivate] = useState(false);
  const [canShareSocial, setCanShareSocial] = useState(true);
  const [youtubeEnabled, setYoutubeEnabled] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [expandedConfig, setExpandedConfig] = useState<string | null>(null);

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
  const { data: configurations = [], isLoading: configsLoading, error: configsError } = useQuery<ShowcaseConfiguration[]>({
    queryKey: [`/api/showcase/configurations/${profession}`, userId],
    queryFn: async () => {
      try {
        const response = await fetch(`/api/showcase/configurations/${profession}?userId=${userId}`);
        if (!response.ok) throw new Error('Failed to fetch configurations');
        return response.json();
      } catch (error) {
        const message = (error as Error).message;
        setQueryErrors(prev => ({ ...prev, configs: message }));
        throw error;
      }
    },
    enabled: !!userId && !!profession,
  });

  // Fetch available templates
  const { data: templates = [], isLoading: templatesLoading, error: templatesError } = useQuery<ShowcaseTemplate[]>({
    queryKey: [`/api/showcase/templates/${profession}`],
    queryFn: async () => {
      try {
        const response = await fetch(`/api/showcase/templates/${profession}`);
        if (!response.ok) throw new Error('Failed to fetch templates');
        return response.json();
      } catch (error) {
        const message = (error as Error).message;
        setQueryErrors(prev => ({ ...prev, templates: message }));
        throw error;
      }
    },
    enabled: !!profession,
  });

  // Fetch showcase analytics
  const { data: analytics = {} as ShowcaseAnalytics, isLoading: analyticsLoading, error: analyticsError } = useQuery<ShowcaseAnalytics>({
    queryKey: [`/api/showcase/analytics/${profession}`, userId],
    queryFn: async () => {
      try {
        const response = await fetch(`/api/showcase/analytics/${profession}?userId=${userId}`);
        if (!response.ok) throw new Error('Failed to fetch analytics');
        return response.json();
      } catch (error) {
        const message = (error as Error).message;
        setQueryErrors(prev => ({ ...prev, analytics: message }));
        throw error;
      }
    },
    enabled: !!userId && !!profession,
  });

  // Create/Update configuration mutation
  const saveConfigMutation = useMutation({
    mutationFn: async (configData: ShowcaseConfiguration) => {
      const endpoint = editingConfig
        ? `/api/showcase/configurations/${editingConfig.id}`
        : '/api/showcase/configurations';

      const response = await fetch(endpoint, {
        method: editingConfig ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify(configData),
      });

      if (!response.ok) throw new Error('Failed to save configuration');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/showcase/configurations/${profession}`, userId],
      });
      setConfigDialog(false);
      setEditingConfig(null);
      resetForm();
      setSuccessMessage(editingConfig ? 'Konfigurasjon oppdatert' : 'Konfigurasjon opprettet');
    },
    onError: (error: any) => {
      setErrorMessage(error.message || 'Feil ved lagring av konfigurasjon');
    },
  });

  // Delete configuration mutation
  const deleteConfigMutation = useMutation({
    mutationFn: async (configId: string) => {
      const response = await fetch(`/api/showcase/configurations/${configId}`, {
        method: 'DELETE',
        headers: { 'x-user-id': userId },
      });
      if (!response.ok) throw new Error('Failed to delete configuration');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/showcase/configurations/${profession}`, userId],
      });
      setSuccessMessage('Konfigurasjon slettet');
    },
    onError: (error: any) => {
      setErrorMessage(error.message || 'Feil ved sletting av konfigurasjon');
    },
  });

  // Apply template mutation
  const applyTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const response = await fetch(`/api/showcase/templates/${templateId}/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
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
      setSuccessMessage('Mal brukt');
    },
    onError: (error: any) => {
      setErrorMessage(error.message || 'Feil ved bruk av mal');
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

  // Initialize component and clear messages after timeout
  useEffect(() => {
    // Reset errors messages after 5 seconds
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  useEffect(() => {
    // Reset success messages after 4 seconds
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const handleEditConfig = (config: ShowcaseConfiguration) => {
    setEditingConfig(config);
    setFormData(config);
    setConfigDialog(true);
};

  const handleDeleteConfig = (configId: string) => {
    setConfirmDeleteConfigId(configId);
  };

  const executeDeleteConfig = () => {
    if (!confirmDeleteConfigId) return;
    deleteConfigMutation.mutate(confirmDeleteConfigId);
    setConfirmDeleteConfigId(null);
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
                        : 'divider',
                      ...theming.getThemedCardSx()
                    }}
                    onClick={() => setFormData({
                      ...formData,
                      hoverEffect: effect.value as any,
                    })}
                  >
                    <CardContent sx={{ textAlign: 'center', p: 2 }}>
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

  const renderSharingConfiguration = () => (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom sx={{ color: professionConfig.primaryColor }}>
        🔗 Deling & Tilgangskontroll
      </Typography>
      <Stack spacing={3}>
        <Box>
          <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PublicIcon fontSize="small" /> Offentlig Tilgang
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
              />
            }
            label="Gjør showcase offentlig tilgjengelig på nett"
          />
        </Box>
        <Box>
          <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PrivateIcon fontSize="small" /> Privat Tilgang
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
              />
            }
            label="Begrenset til godkjente brukere"
          />
        </Box>
        <Box>
          <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EmbedIcon fontSize="small" /> Innbyggings-alternativer
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={formData.enableShare}
                onChange={(e) => setFormData({ ...formData, enableShare: e.target.checked })}
              />
            }
            label="Tillat innbygging på andre nettsider"
          />
        </Box>
        <Box>
          <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ShareIcon fontSize="small" /> Deling på Sosiale Medier
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={canShareSocial}
                onChange={(e) => setCanShareSocial(e.target.checked)}
              />
            }
            label="Tillat deling på Facebook, Twitter, Instagram"
          />
        </Box>
      </Stack>
    </Box>
  );

  const renderEmbedConfiguration = () => (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom sx={{ color: professionConfig.primaryColor }}>
        📺 Media-integrasjon
      </Typography>
      <Stack spacing={3}>
        <Box>
          <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <YouTubeIcon fontSize="small" /> YouTube-integrasjon
          </Typography>
          <FormControlLabel
            control={<Switch checked={youtubeEnabled} onChange={(e) => setYoutubeEnabled(e.target.checked)} />}
            label="Tillat innbygging av YouTube-videoer"
          />
        </Box>
        <Box>
          <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EmbedIcon fontSize="small" /> Egendefinert Innbygging
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Innbyggingskode (iFrame)"
            placeholder="&lt;iframe src='...'&gt;&lt;/iframe&gt;"
            variant="outlined"
          />
        </Box>
      </Stack>
    </Box>
  );

  const renderAnalyticsConfiguration = () => (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom sx={{ color: professionConfig.primaryColor }}>
        📊 Avansert Analytikk
      </Typography>
      <Stack spacing={3}>
        <Box>
          <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AnalyticsIcon fontSize="small" /> Detaljert Sporing
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={formData.enableAnalytics}
                onChange={(e) => setFormData({ ...formData, enableAnalytics: e.target.checked })}
              />
            }
            label="Spor detaljert brukeroppførsel (varighet, interaksjon, etc.)"
          />
        </Box>
        <Box>
          <Typography variant="body2" color="text.secondary">
            Med analytics aktivert kan du se:
          </Typography>
          <List dense>
            <ListItem>
              <ListItemIcon sx={{ minWidth: 24 }}>
                <ChevronLeftIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Unike besøkende" primaryTypographyProps={{ variant: 'caption' }} />
            </ListItem>
            <ListItem>
              <ListItemIcon sx={{ minWidth: 24 }}>
                <ChevronLeftIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Gjennomsnittlig sesjonvarighet" primaryTypographyProps={{ variant: 'caption' }} />
            </ListItem>
            <ListItem>
              <ListItemIcon sx={{ minWidth: 24 }}>
                <ChevronLeftIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Klikkheat maps" primaryTypographyProps={{ variant: 'caption' }} />
            </ListItem>
            <ListItem>
              <ListItemIcon sx={{ minWidth: 24 }}>
                <ChevronLeftIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Konversjonsratinger" primaryTypographyProps={{ variant: 'caption' }} />
            </ListItem>
          </List>
        </Box>
      </Stack>
    </Box>
  );

  const renderExportConfiguration = () => (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom sx={{ color: professionConfig.primaryColor }}>
        💾 Eksporter & Sikkerhetskopi
      </Typography>
      <Stack spacing={3}>
        <Box>
          <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ExportIcon fontSize="small" /> Eksporter Konfigurasjon
          </Typography>
          <Button
            startIcon={<DownloadIcon />}
            variant="outlined"
            fullWidth
          >
            Eksporter som JSON
          </Button>
        </Box>
        <Box>
          <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <RestoreIcon fontSize="small" /> Gjenopprett Tidligere Versjon
          </Typography>
          <Button
            startIcon={<RestoreIcon />}
            variant="outlined"
            fullWidth
          >
            Se Versjonhistorikk
          </Button>
        </Box>
        <Box>
          <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SaveIcon fontSize="small" /> Sikkerhetskopi
          </Typography>
          <Button
            startIcon={<SaveIcon />}
            variant="outlined"
            fullWidth
          >
            Lag Sikkerhetskopi Nå
          </Button>
        </Box>
      </Stack>
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
    {
      label: 'Deling',
      icon: <ShareIcon />,
      component: renderSharingConfiguration,
  },
    {
      label: 'Innbygging',
      icon: <EmbedIcon />,
      component: renderEmbedConfiguration,
  },
    {
      label: 'Analytikk',
      icon: <InsightsIcon />,
      component: renderAnalyticsConfiguration,
  },
    {
      label: 'Eksport',
      icon: <ExportIcon />,
      component: renderExportConfiguration,
  },
  ];

  return (
    <Box sx={{ p:  3, backgroundColor: theme.palette.background.default, minHeight: '100vh' }}>
      {/* Error and Success Alerts */}
      {errorMessage && (
        <Alert 
          severity="error" 
          sx={{ mb: 2, display: 'flex', alignItems: 'center' }}
          icon={<ErrorIcon />}
          onClose={() => setErrorMessage(null)}
        >
          {errorMessage}
        </Alert>
      )}
      
      {successMessage && (
        <Alert 
          severity="success" 
          sx={{ mb: 2, display: 'flex', alignItems: 'center' }}
          icon={<CheckCircleIcon />}
          onClose={() => setSuccessMessage(null)}
        >
          {successMessage}
        </Alert>
      )}

      {(configsError || templatesError || analyticsError) && (
        <Alert severity="error" sx={{ mb: 2 }} icon={<ErrorIcon />}>
          <Typography variant="subtitle2">Feil ved henting av data:</Typography>
          <List dense sx={{ mt: 1 }}>
            {configsError && (
              <ListItem sx={{ py: 0.5 }}>
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <ChevronLeftIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText 
                  primary={`Konfigurasjoner: ${(configsError as any).message}`}
                  primaryTypographyProps={{ variant: 'caption' }}
                />
                <ListItemSecondaryAction>
                  <Tooltip title="Skjul denne feilen">
                    <IconButton 
                      edge="end" 
                      size="small"
                      onClick={() => setErrorMessage(null)}
                    >
                      <VisibilityOffIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </ListItemSecondaryAction>
              </ListItem>
            )}
            {templatesError && (
              <ListItem sx={{ py: 0.5 }}>
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <ChevronLeftIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText 
                  primary={`Maler: ${(templatesError as any).message}`}
                  primaryTypographyProps={{ variant: 'caption' }}
                />
                <ListItemSecondaryAction>
                  <Tooltip title="Skjul denne feilen">
                    <IconButton 
                      edge="end" 
                      size="small"
                      onClick={() => setErrorMessage(null)}
                    >
                      <VisibilityOffIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </ListItemSecondaryAction>
              </ListItem>
            )}
            {analyticsError && (
              <ListItem sx={{ py: 0.5 }}>
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <ChevronLeftIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText 
                  primary={`Analytikk: ${(analyticsError as any).message}`}
                  primaryTypographyProps={{ variant: 'caption' }}
                />
                <ListItemSecondaryAction>
                  <Tooltip title="Skjul denne feilen">
                    <IconButton 
                      edge="end" 
                      size="small"
                      onClick={() => setErrorMessage(null)}
                    >
                      <VisibilityOffIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </ListItemSecondaryAction>
              </ListItem>
            )}
          </List>
        </Alert>
      )}

      {Object.values(queryErrors).length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }} icon={<WarningIcon />}>
          <Typography variant="subtitle2">Advarsel: Noen data kunne ikke lastes inn.</Typography>
          {Object.entries(queryErrors).length > 0 && (
            <List dense sx={{ mt: 1 }}>
              {Object.entries(queryErrors).map(([key, error]) => (
                <ListItem key={key} sx={{ py: 0.5 }}>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <InfoIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText 
                    primary={`${key}: ${error}`}
                    primaryTypographyProps={{ variant: 'caption' }}
                  />
                  <ListItemSecondaryAction>
                    <IconButton 
                      edge="end" 
                      size="small"
                      onClick={() => setQueryErrors(prev => {
                        const next = { ...prev };
                        delete next[key];
                        return next;
                      })}
                    >
                      <VisibilityOffIcon fontSize="small" />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
        </Alert>
      )}

      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb:  3,
          p: 2,
          backgroundColor: theme.palette.background.paper,
          borderRadius: 1,
          boxShadow: theme.shadows[1]
        }}
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

        <Stack direction="row" spacing={1}>
          <Tooltip title="Bytt til rutenettvisning">
            <IconButton 
              size="small"
              onClick={() => setViewMode('grid')}
              color={viewMode === 'grid' ? 'primary' : 'default'}
            >
              <GridOnIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Bytt til listevisning">
            <IconButton 
              size="small"
              onClick={() => setViewMode('list')}
              color={viewMode === 'list' ? 'primary' : 'default'}
            >
              <ListIcon />
            </IconButton>
          </Tooltip>
          <Divider orientation="vertical" flexItem />
          <Tooltip title="Velg malerstøtter">
            <Button
              variant="outlined"
              startIcon={<TemplateIcon />}
              onClick={() => setTemplatesDialog(true)}
              disabled={templatesLoading}
            >
              Maler {templatesLoading && <Badge badgeContent={1} color="info" />}
            </Button>
          </Tooltip>
          <Tooltip title="Opprett ny konfigurasjon">
            <Button variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setConfigDialog(true)}
              sx={{
                background: `linear-gradient(135deg, ${professionConfig.primaryColor} 0%, ${formData.secondaryColor} 100%)`}}
            >
              Ny Konfigurasjon
            </Button>
          </Tooltip>
        </Stack>
      </Box>

      {/* Analytics Summary */}
      {analyticsLoading ? (
        <Stack spacing={2} sx={{ mb: 4 }}>
          {[1,2,3,4].map((i) => (
            <Box key={i} sx={{ height: 120, backgroundColor: theme.palette.action.hover, borderRadius: 1, animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </Stack>
      ) : (
        <Grid container spacing={3} sx={{ mb:  4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap:  2, justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">Totale Visninger</Typography>
                    <Tooltip title="Se visningsstatistikk">
                      <Typography variant="h6" sx={{ color: theming.colors.primary, cursor: 'pointer' }}>
                        <Badge badgeContent={analytics.totalViews ? 3 : 0} color="error">
                          {analytics.totalViews || 0}
                        </Badge>
                      </Typography>
                    </Tooltip>
                  </Box>
                  <Avatar sx={{ bgcolor: professionConfig.primaryColor }}>
                    <VisibilityIcon />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap:  2, justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">Totale Likes</Typography>
                    <Tooltip title="Se likestatistikk">
                      <Typography variant="h6" sx={{ color: theming.colors.primary, cursor: 'pointer' }}>
                        <Badge badgeContent={analytics.totalLikes ? 1 : 0} color="error">
                          {analytics.totalLikes || 0}
                        </Badge>
                      </Typography>
                    </Tooltip>
                  </Box>
                  <Avatar sx={{ bgcolor: '#4CAF50'}}>
                    <StarIcon />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap:  2, justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">Totale Delinger</Typography>
                    <Tooltip title="Se delingsstatistikk">
                      <Typography variant="h6" sx={{ color: theming.colors.primary, cursor: 'pointer' }}>
                        <Badge badgeContent={analytics.totalShares ? 2 : 0} color="error">
                          {analytics.totalShares || 0}
                        </Badge>
                      </Typography>
                    </Tooltip>
                  </Box>
                  <Avatar sx={{ bgcolor: '#FF9800'}}>
                    <ShareIcon />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap:  2, justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">Totale Nedlastinger</Typography>
                    <Tooltip title="Se nedlastingsstatistikk">
                      <Typography variant="h6" sx={{ color: theming.colors.primary, cursor: 'pointer' }}>
                        <Badge badgeContent={analytics.totalDownloads ? 1 : 0} color="error">
                          {analytics.totalDownloads || 0}
                        </Badge>
                      </Typography>
                    </Tooltip>
                  </Box>
                  <Avatar sx={{ bgcolor: '#9C27B0'}}>
                    <DownloadIcon />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Existing Configurations */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary, m: 0 }}>
            Eksisterende Konfigurasjoner
          </Typography>
          {configsLoading && <Typography variant="caption" color="text.secondary">Laster...</Typography>}
          {!configsLoading && <Chip label={`${configurations.length} konfigurasjoner`} color="primary" variant="outlined" />}
        </Box>
      </Box>

      {configsLoading ? (
        <Grid container spacing={3}>
          {[1,2,3].map((i) => (
            <Grid item xs={12} sm={viewMode === 'grid' ? 6 : 12} md={viewMode === 'grid' ? 4 : 12} key={i}>
              <Box sx={{ height: 200, backgroundColor: theme.palette.action.hover, borderRadius: 1, animation: 'pulse 1.5s ease-in-out infinite' }} />
            </Grid>
          ))}
        </Grid>
      ) : (
        <Grid container spacing={3}>
          {configurations.map((config: ShowcaseConfiguration) => (
            <Grid 
              item 
              xs={12} 
              sm={viewMode === 'grid' ? 6 : 12} 
              md={viewMode === 'grid' ? 4 : 12} 
              key={config.id}
            >
              <Accordion 
                expanded={expandedConfig === config.id}
                onChange={() => setExpandedConfig(expandedConfig === config.id ? null : config.id!)}
                sx={{ ...theming.getThemedCardSx() }}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                    <Typography variant="h6" sx={{ color: theming.colors.primary, flex: 1 }}>
                      {config.configName}
                    </Typography>
                    <Chip
                      icon={config.isActive ? <CheckCircleIcon /> : <InfoIcon />}
                      label={config.isActive ? 'Aktiv' : 'Inaktiv'}
                      color={config.isActive ? 'success' : 'default'}
                      size="small"
                    />
                  </Box>
                </AccordionSummary>
                <AccordionDetails sx={{ ...theming.getThemedCardSx() }}>
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">Layout</Typography>
                      <Chip 
                        icon={<GridIcon />}
                        label={layoutOptions.find((l) => l.value === config.layoutType)?.label}
                        size="small" 
                      />
                    </Box>

                    <Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        Kolonnekonfigurasjon
                      </Typography>
                      <Stack direction="row" spacing={1}>
                        <Chip 
                          icon={<DesktopIcon />}
                          label={`${config.columnsDesktop} desktop`}
                          variant="outlined"
                          size="small" 
                        />
                        <Chip 
                          icon={<MobileIcon />}
                          label={`${config.columnsMobile} mobil`}
                          variant="outlined"
                          size="small" 
                        />
                      </Stack>
                    </Box>

                    <Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Fullstendighet</Typography>
                      <LinearProgress
                        variant="determinate"
                        value={75}
                        sx={{ height:  6, borderRadius:  3 }}
                      />
                      <Typography variant="caption" color="text.secondary">75% konfigurert</Typography>
                    </Box>

                    <Divider />

                    <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                      <Tooltip title="Rediger denne konfigurasjonen">
                        <Button
                          size="small"
                          startIcon={<EditIcon />}
                          onClick={() => handleEditConfig(config)}
                          variant="contained"
                          color="primary"
                        >
                          Rediger
                        </Button>
                      </Tooltip>
                      <Tooltip title="Forhåndsvis konfigurasjonen">
                        <Button 
                          size="small" 
                          startIcon={<PreviewIcon />} 
                          color="secondary"
                          variant="outlined"
                        >
                          Forhåndsvis
                        </Button>
                      </Tooltip>
                      <Tooltip title="Kopier denne konfigurasjonen">
                        <IconButton
                          size="small"
                          color="primary"
                        >
                          <CopyIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Slett denne konfigurasjonen">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteConfig(config.id!)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Stack>
                </AccordionDetails>
              </Accordion>
            </Grid>
          ))}

          {configurations.length === 0 && (
            <Grid item xs={12}>
              <Paper sx={{ p:  4, textAlign: 'center',  ...theming.getThemedCardSx() }}>
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                  <CategoryIcon sx={{ fontSize: 64, color: theme.palette.text.secondary }} />
                </Box>
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
      )}

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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <TemplateIcon />
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Velg Showcase-mal</Typography>
            {templatesLoading && <Badge badgeContent={1} color="info" />}
          </Box>
        </DialogTitle>
        <DialogContent>
          {templatesLoading ? (
            <Stack spacing={2}>
              {[1,2,3].map((i) => (
                <Box key={i} sx={{ height: 200, backgroundColor: theme.palette.action.hover, borderRadius: 1, animation: 'pulse 1.5s ease-in-out infinite' }} />
              ))}
            </Stack>
          ) : (
            <Grid container spacing={3}>
              {templates.map((template: any) => (
                <Grid item xs={12} sm={6} key={template.id}>
                  <Card sx={{ cursor: 'pointer', '&:hover': { boxShadow: 4 }, ...theming.getThemedCardSx() }}>
                    {template.previewImageUrl && (
                      <CardMedia
                        component="img"
                        height="140"
                        image={template.previewImageUrl}
                        alt={template.name}
                      />
                    )}
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 1 }}>
                        <Typography variant="h6" sx={{ color: theming.colors.primary }}>{template.name}</Typography>
                        {template.isPopular && <StarIcon sx={{ color: '#FFD700' }} />}
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {template.description}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                        {template.isPremium && <Chip label="Premium" color="warning" size="small" icon={<LocalOfferIcon />} />}
                        {template.isPopular && <Chip label="Populær" color="success" size="small" icon={<TrendingUpIcon />} />}
                      </Box>
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="caption" color="text.secondary">Vurdering</Typography>
                        <Rating value={template.rating || 4} readOnly size="small" sx={{ display: 'block' }} />
                      </Box>
                    </CardContent>
                    <CardActions sx={theming.getThemedCardSx()}>
                      <Tooltip title="Bruk denne malen">
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => applyTemplateMutation.mutate(template.id)}
                          disabled={applyTemplateMutation.isPending}
                          startIcon={<ImportIcon />}
                        >
                          Bruk Mal
                        </Button>
                      </Tooltip>
                      <Tooltip title="Forhåndsvis malen">
                        <Button 
                          size="small" 
                          color="secondary"
                          startIcon={<PreviewIcon />}
                        >
                          Forhåndsvis
                        </Button>
                      </Tooltip>
                    </CardActions>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTemplatesDialog(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>

      {/* Confirm Delete Config Dialog */}
      <Dialog open={!!confirmDeleteConfigId} onClose={() => setConfirmDeleteConfigId(null)}>
        <DialogTitle>Bekreft sletting</DialogTitle>
        <DialogContent>
          <Typography>Er du sikker på at du vil slette denne konfigurasjonen? Denne handlingen kan ikke angres.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteConfigId(null)}>Avbryt</Button>
          <Button onClick={executeDeleteConfig} color="error" variant="contained">Slett</Button>
        </DialogActions>
      </Dialog>

      {/* Floating Admin Controls */}
      <SpeedDial
        ariaLabel="Showcase Admin Actions"
        sx={{ 
          position: 'fixed', 
          bottom: 20, 
          right: 20,
          '& .MuiFab-primary': {
            backgroundColor: professionConfig.primaryColor,
            '&:hover': {
              backgroundColor: alpha(professionConfig.primaryColor, 0.8),
              boxShadow: theme.shadows[8],
            }
          }
        }}
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
        <SpeedDialAction icon={<InsightsIcon />} tooltipTitle="Analytikk" />
        <SpeedDialAction icon={<SaveIcon />} tooltipTitle="Lagre alt" />
        <SpeedDialAction icon={<RestoreIcon />} tooltipTitle="Gjenopprett tidligere" />
        <SpeedDialAction icon={<DownloadIcon />} tooltipTitle="Last ned" />
        <SpeedDialAction icon={<ChevronRightIcon />} tooltipTitle="Flere alternativer" />
      </SpeedDial>

      {/* Additional FAB for favorites */}
      <Fab
        color="secondary"
        aria-label="favorites"
        sx={{
          position: 'fixed',
          bottom: 100,
          right: 20,
          backgroundColor: alpha(formData.secondaryColor, 0.9),
          '&:hover': {
            backgroundColor: alpha(formData.secondaryColor, 0.7),
          }
        }}
      >
        <StarBorderIcon />
      </Fab>
    </Box>
  );
};

export default ComprehensiveShowcaseAdmin;
