/**
 * DesignSystemDashboard Component
 * Design system management dashboard with monitoring and configuration
 */

import { useTheming } from '../../../utils/theming-helper';
import React, { memo, useCallback, useState, useEffect, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  LinearProgress,
  Tooltip,
  IconButton,
  Button,
  ButtonGroup,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  ListItemAvatar,
  Avatar,
  Divider,
  Alert,
  AlertTitle,
  ChipProps,
  Card,
  CardContent,
  CardActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  TextField,
  InputAdornment,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Badge,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  StepButton,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {
  Palette,
  Add,
  Remove,
  PlayArrow,
  Pause,
  Stop,
  Settings,
  Refresh,
  CheckCircle,
  Error,
  Info,
  Warning,
  Download,
  Upload,
  Code,
  Api,
  Build,
  FilterList,
  Search,
  Sort,
  ViewList,
  ViewModule,
  ViewComfy,
  KeyboardArrowDown,
  KeyboardArrowUp,
  ExpandMore,
  ExpandLess,
  Flag,
  Public,
  Book,
  School,
  Work,
  Home,
  Person,
  Group,
  PublicOff,
  Sync,
  SyncProblem,
  CloudOff,
  CloudDone,
  CloudSync,
  Queue,
  BarChart,
  PieChart,
  ShowChart,
  Memory,
  Speed as Speed,
  Storage,
  Security,
  Lock,
  Visibility,
  VisibilityOff,
  Edit,
  Delete,
  MoreVert,
  Star,
  StarBorder,
  Favorite,
  FavoriteBorder,
  Schedule,
  Timer,
  Event,
  Timeline,
  AccountTree as FlowChart,
  AccountTree,
  Hub,
  Share,
  Link,
  GetApp,
  Publish,
  CloudUpload,
  CloudDownload,
  CloudSync as CloudSyncIcon,
  CloudQueue,
  CloudDone as CloudDoneIcon,
  CloudOff as CloudOffIcon,
  CloudSync as CloudSyncIcon2,
  CloudQueue as CloudQueueIcon,
  CloudDone as CloudDoneIcon2,
  CloudOff as CloudOffIcon2,
  ColorLens,
  FormatColorFill,
  FormatColorText,
  FormatSize,
  FormatBold,
  FormatItalic,
  FormatUnderlined,
  FormatAlignLeft,
  FormatAlignCenter,
  FormatAlignRight,
  FormatAlignJustify,
  FormatListBulleted,
  FormatListNumbered,
  FormatIndentIncrease,
  FormatIndentDecrease,
  FormatLineSpacing,
  FormatColorReset,
  FormatPaint,
  Brush,
  AutoFixHigh,
  AutoFixNormal,
  AutoFixOff,
  Style,
  DesignServices,
  Architecture,
  Construction,
  Engineering,
  Science,
  Psychology,
  Biotech,
  Psychology as PsychologyIcon,
  Biotech as BiotechIcon,
  Science as ScienceIcon,
  Engineering as EngineeringIcon,
  Construction as ConstructionIcon,
  Architecture as ArchitectureIcon,
  DesignServices as DesignServicesIcon,
  Style as StyleIcon,
  AutoFixOff as AutoFixOffIcon,
  AutoFixNormal as AutoFixNormalIcon,
  AutoFixHigh as AutoFixHighIcon,
  Brush as BrushIcon,
  FormatPaint as FormatPaintIcon,
  FormatColorReset as FormatColorResetIcon,
  FormatLineSpacing as FormatLineSpacingIcon,
  FormatIndentDecrease as FormatIndentDecreaseIcon,
  FormatIndentIncrease as FormatIndentIncreaseIcon,
  FormatListNumbered as FormatListNumberedIcon,
  FormatListBulleted as FormatListBulletedIcon,
  FormatAlignJustify as FormatAlignJustifyIcon,
  FormatAlignRight as FormatAlignRightIcon,
  FormatAlignCenter as FormatAlignCenterIcon,
  FormatAlignLeft as FormatAlignLeftIcon,
  FormatUnderlined as FormatUnderlinedIcon,
  FormatItalic as FormatItalicIcon,
  FormatBold as FormatBoldIcon,
  FormatSize as FormatSizeIcon,
  FormatColorText as FormatColorTextIcon,
  FormatColorFill as FormatColorFillIcon,
  ColorLens as ColorLensIcon,
} from '@mui/icons-material';
import { useDesignSystem, UseDesignSystemOptions } from '../../../hooks/useDesignSystem';
import { DesignSystemConfig, DesignToken, DesignGuideline, DesignTheme } from '../../../utils/designSystemManager';

interface DesignSystemDashboardProps {
  showDetails?: boolean;
  showSettings?: boolean;
  showManagement?: boolean;
  showMonitoring?: boolean;
  showTokens?: boolean;
  showGuidelines?: boolean;
  showThemes?: boolean;
  showDocumentation?: boolean;
  variant?: 'minimal' | 'detailed' | 'full';
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center';
  onSettingsClick?: () => void;
  onManagementClick?: () => void;
  onMonitoringClick?: () => void;
  onTokensClick?: () => void;
  onGuidelinesClick?: () => void;
  onThemesClick?: () => void;
  onDocumentationClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

const DesignSystemDashboard: React.FC<DesignSystemDashboardProps> = memo(({
  showDetails = true,
  showSettings = true,
  showManagement = true,
  showMonitoring = true,
  showTokens = true,
  showGuidelines = true,
  showThemes = true,
  showDocumentation = true,
  variant = 'minimal',
  position = 'top-right',
  onSettingsClick,
  onManagementClick,
  onMonitoringClick,
  onTokensClick,
  onGuidelinesClick,
  onThemesClick,
  onDocumentationClick,
  className,
  style
}) => {
  const [showDesignSystemDialog, setShowDesignSystemDialog] = useState(false);
  
  // Theming system
  const theming = useTheming('prototype_tester');
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showManagementDialog, setShowManagementDialog] = useState(false);
  const [showMonitoringDialog, setShowMonitoringDialog] = useState(false);
  const [showTokensDialog, setShowTokensDialog] = useState(false);
  const [showGuidelinesDialog, setShowGuidelinesDialog] = useState(false);
  const [showThemesDialog, setShowThemesDialog] = useState(false);
  const [showDocumentationDialog, setShowDocumentationDialog] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedToken, setSelectedToken] = useState<DesignToken | null>(null);
  const [selectedGuideline, setSelectedGuideline] = useState<DesignGuideline | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<DesignTheme | null>(null);

  // Design system options
  const designSystemOptions: UseDesignSystemOptions = useMemo(() => ({
    onTokenAdded: (_data: { token: DesignToken }) => {
      setPage(0);
  },
    onGuidelineAdded: (_data: { guideline: DesignGuideline }) => {
      setPage(0);
  },
    onThemeAdded: (_data: { theme: DesignTheme }) => {
      setPage(0);
  },
    onThemeActivated: (_data: { theme: DesignTheme }) => {
      setFilterType('all');
      setPage(0);
  },
    onError: (error: string) => {
      console.error('Design system error:', error);
  },
    onInitialized: () => {
      setPage(0);
}
}), []);

  // Use design system hook
  const {
    addToken,
    addGuideline,
    addTheme,
    getToken,
    getTokensByType,
    getTokensByCategory,
    getGuideline,
    getGuidelinesByCategory,
    getTheme,
    setActiveTheme,
    getActiveTheme,
    state,
    config,
    updateConfig,
    isEnabled,
    isInitialized,
    hasError,
    error,
    tokens,
    guidelines,
    themes,
    activeTheme,
    totalTokens,
    totalGuidelines,
    totalThemes,
    totalCategories,
    totalSubcategories,
    totalUsage,
    totalErrors,
    totalConflicts,
    totalOverrides,
    getAllTokens,
    getAllGuidelines,
    getAllThemes
} = useDesignSystem(designSystemOptions);

  // Handle settings click
  const handleSettingsClick = useCallback(() => {
    if (onSettingsClick) {
      onSettingsClick();
  } else {
      setShowSettingsDialog(true);
  }
}, [onSettingsClick]);

  // Handle management click
  const handleManagementClick = useCallback(() => {
    if (onManagementClick) {
      onManagementClick();
  } else {
      setShowManagementDialog(true);
  }
}, [onManagementClick]);

  // Handle monitoring click
  const handleMonitoringClick = useCallback(() => {
    if (onMonitoringClick) {
      onMonitoringClick();
  } else {
      setShowMonitoringDialog(true);
  }
}, [onMonitoringClick]);

  // Handle tokens click
  const handleTokensClick = useCallback(() => {
    if (onTokensClick) {
      onTokensClick();
  } else {
      setShowTokensDialog(true);
  }
}, [onTokensClick]);

  // Handle guidelines click
  const handleGuidelinesClick = useCallback(() => {
    if (onGuidelinesClick) {
      onGuidelinesClick();
  } else {
      setShowGuidelinesDialog(true);
  }
}, [onGuidelinesClick]);

  // Handle themes click
  const handleThemesClick = useCallback(() => {
    if (onThemesClick) {
      onThemesClick();
  } else {
      setShowThemesDialog(true);
  }
}, [onThemesClick]);

  // Handle documentation click
  const handleDocumentationClick = useCallback(() => {
    if (onDocumentationClick) {
      onDocumentationClick();
  } else {
      setShowDocumentationDialog(true);
  }
}, [onDocumentationClick]);

  // Handle create token
  const handleCreateToken = useCallback(async () => {
    try {
      const tokenData: Partial<DesignToken> = {
        name: 'Custom Token',
        value: '#000000',
        type: 'color',
        category: 'color',
        subcategory: 'primary',
        description: 'A custom design token',
        usage: ['buttons', 'text'],
        examples: ['#000000', '#ffffff'],
        variants: []
  };
      await addToken(tokenData);
  } catch (error) {
      console.error('Failed to create token: ', error);
  }
}, [addToken]);

  // Handle create guideline
  const handleCreateGuideline = useCallback(async () => {
    try {
      const guidelineData: Partial<DesignGuideline> = {
        name: 'Custom Guideline',
        description: 'A custom design guideline',
        category: 'accessibility',
        subcategory: 'color',
        type: 'principle',
        content: 'This is a custom design guideline',
        examples:  [],
        relatedTokens:  [],
        relatedComponents: []
  };
      await addGuideline(guidelineData);
  } catch (error) {
      console.error('Failed to create guideline:', error);
  }
}, [addGuideline]);

  // Handle create theme
  const handleCreateTheme = useCallback(async () => {
    try {
      const themeData: Partial<DesignTheme> = {
        name: 'Custom Theme',
        description: 'A custom design theme',
        type: 'custom',
        tokens: new Map(),
        guidelines: new Map()
  };
      await addTheme(themeData);
  } catch (error) {
      console.error('Failed to create theme:', error);
  }
}, [addTheme]);

  // Get status color
  const getStatusColor = useCallback((): ChipProps['color'] => {
    if (hasError) return 'error';
    if (!isInitialized) return 'warning';
    if (isEnabled) return 'success';
    return 'default';
}, [hasError, isInitialized, isEnabled]);

  // Get status icon
  const getStatusIcon = useCallback(() => {
    if (hasError) return theming.getThemedIcon('error');
    if (!isInitialized) return <CircularProgress size={16} />;
    if (isEnabled) return theming.getThemedIcon('palette');
    return theming.getThemedIcon('warning');
}, [hasError, isInitialized, isEnabled]);

  // Get status text
  const getStatusText = useCallback(() => {
    if (hasError) return 'Error';
    if (!isInitialized) return 'Initializing...';
    if (isEnabled) return 'Active';
    return 'Disabled';
}, [hasError, isInitialized, isEnabled]);

  // Get position styles
  const getPositionStyles = useCallback(() => {
    const baseStyles = {
      position: 'fixed' as const,
      zIndex: 1000,  };

    switch (position) {
      case 'top-left':
        return { ...baseStyles, top:  16, left: 16,};
      case 'top-right':
        return { ...baseStyles, top:  16, right: 16,};
      case 'bottom-left':
        return { ...baseStyles, bottom:  16, left: 16,};
      case 'bottom-right':
        return { ...baseStyles, bottom:  16, right: 16,};
      case 'top-center':
        return { ...baseStyles, top:  16, left: '50%', transform: 'translateX(-50%)',};
      case 'bottom-center':
        return { ...baseStyles, bottom:  16, left: '50%', transform: 'translateX(-50%)',};
      default: return { ...baseStyles, top:  16, right: 16,};
  }
}, [position]);

  // Render minimal variant
  const renderMinimal = () => {
    const statusIcon = getStatusIcon();
    return (
      <Tooltip title={`Design System: ${getStatusText()}`}>
        <Chip
          icon={React.isValidElement(statusIcon) ? statusIcon : undefined}
          label={totalTokens}
          color={getStatusColor()}
          size="small"
          onClick={() => setShowDesignSystemDialog(true)}
          sx={{ cursor: 'pointer'}}
        />
      </Tooltip>
    );
  };

  // Render detailed variant
  const renderDetailed = () => (
    <Paper elevation={2} sx={{ ...theming.getThemedCardSx(), p: 1, minWidth: 200 }}>
      <Box display="flex" alignItems="center" justifyContent="space-between">
        <Box display="flex" alignItems="center" gap={1}>
          {getStatusIcon()}
          <Typography variant="body2" color={getStatusColor() + '.main'}>
            {getStatusText()}
          </Typography>
        </Box>
        
        <Box display="flex" gap={1}>
          <IconButton size="small" onClick={() => setShowDesignSystemDialog(true)}>
            <KeyboardArrowDown />
          </IconButton>
          
          {showSettings && (
            <IconButton size="small" onClick={handleSettingsClick}>
              {theming.getThemedIcon('settings')}
            </IconButton>
          )}
        </Box>
      </Box>
      
      {showDetails && (
        <Box mt={1}>
          <Typography variant="caption" color="text.secondary">
            {totalTokens} tokens • {totalGuidelines} guidelines
          </Typography>
          {activeTheme && (
            <Typography variant="caption" color="info.main" sx={{ ml:  1 }}>
              {activeTheme.name}
            </Typography>
          )}
        </Box>
      )}
    </Paper>
  );

  // Render full variant
  const renderFull = () => (
    <Paper elevation={3} sx={{ ...theming.getThemedCardSx(), p: 2, minWidth: 300 }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Box display="flex" alignItems="center" gap={1}>
          <Palette color="primary" />
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
            Design System
          </Typography>
        </Box>

        <Box display="flex" gap={1}>
          <Button
            startIcon={theming.getThemedIcon('add')}
            onClick={handleCreateToken}
            variant="outlined"
            size="small"
          >
            Create
          </Button>
          
          {showSettings && (
            <IconButton onClick={handleSettingsClick}>
              {theming.getThemedIcon('settings')}
            </IconButton>
          )}
        </Box>
      </Box>
      
      <Grid container spacing={2}>
        <Grid size={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="subtitle2" gutterBottom>
                Total Tokens
              </Typography>
              <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                {totalTokens}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid size={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="subtitle2" gutterBottom>
                Guidelines
              </Typography>
              <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                {totalGuidelines}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid size={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="subtitle2" gutterBottom>
                Themes
              </Typography>
              <Typography variant="h4" color="success.main" sx={{ color: theming.colors.primary }}>
                {totalThemes}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid size={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="subtitle2" gutterBottom>
                Status
              </Typography>
              <Box display="flex" alignItems="center" gap={1}>
                {getStatusIcon()}
                <Typography variant="body2" color={getStatusColor() + '.main'}>
                  {getStatusText()}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      <Box mt={2}>
        <Typography variant="caption" color="text.secondary">
          Categories: {totalCategories} • Active Theme: {activeTheme?.name || 'None'} • Tokens: {config.enableTokens ? 'On' : 'Off'}
        </Typography>
      </Box>
    </Paper>
  );

  // Render based on variant
  const renderContent = () => {
    switch (variant) {
      case 'minimal':
        return renderMinimal();
      case 'detailed':
        return renderDetailed();
      case 'full':
        return renderFull();
      default: return renderMinimal();
}
};

  return (
    <>
      <Box
        className={className}
        style={{
          ...getPositionStyles(),
          ...style
      }}
      >
        {renderContent()}
      </Box>

      {/* Design System Dialog */}
      <Dialog open={showDesignSystemDialog} onClose={() => setShowDesignSystemDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            {theming.getThemedIcon('palette')}
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Design System</Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
            <Tab label="Overview" />
            <Tab label="Tokens" />
            <Tab label="Guidelines" />
            <Tab label="Themes" />
            <Tab label="Documentation" />
            <Tab label="Settings" />
          </Tabs>
          
          {activeTab === 0 && (
            <Grid container spacing={2} sx={{ mt:  2 }}>
              <Grid size={{ xs:  12, sm:  6, md:  3 }}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle2" gutterBottom>
                      Total Tokens
                    </Typography>
                    <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                      {totalTokens}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid size={{ xs:  12, sm:  6, md:  3 }}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle2" gutterBottom>
                      Guidelines
                    </Typography>
                    <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                      {totalGuidelines}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid size={{ xs:  12, sm:  6, md:  3 }}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle2" gutterBottom>
                      Themes
                    </Typography>
                    <Typography variant="h4" color="success.main" sx={{ color: theming.colors.primary }}>
                      {totalThemes}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid size={{ xs:  12, sm:  6, md:  3 }}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle2" gutterBottom>
                      Status
                    </Typography>
                    <Box display="flex" alignItems="center" gap={1}>
                      {getStatusIcon()}
                      <Typography variant="body2" color={getStatusColor() + '.main'}>
                        {getStatusText()}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}
          
          {activeTab === 1 && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Token Management
              </Typography>
              <List>
                {tokens.map((token) => (
                  <ListItem key={token.id}>
                    <ListItemAvatar>
                      <Avatar>
                        <ColorLens />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={token.name}
                      secondary={`${token.type} • ${token.category} • ${token.description}`}
                    />
                    <ListItemSecondaryAction>
                      <ButtonGroup size="small">
                        <Button
                          onClick={() => setSelectedToken(token)}
                          startIcon={theming.getThemedIcon('edit')}
                        >
                          Edit
                        </Button>
                        <Button
                          onClick={() => {/* Handle delete */}}
                          startIcon={theming.getThemedIcon('delete')}
                          color="error"
                        >
                          Delete
                        </Button>
                      </ButtonGroup>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </Box>
          )}

          {activeTab === 2 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Guideline Management
              </Typography>
              <List>
                {guidelines.map((guideline) => (
                  <ListItem key={guideline.id}>
                    <ListItemAvatar>
                      <Avatar>
                        <Book />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={guideline.name}
                      secondary={`${guideline.category} • ${guideline.type} • ${guideline.description}`}
                    />
                    <ListItemSecondaryAction>
                      <ButtonGroup size="small">
                        <Button
                          onClick={() => setSelectedGuideline(guideline)}
                          startIcon={theming.getThemedIcon('edit')}
                        >
                          Edit
                        </Button>
                        <Button
                          onClick={() => {/* Handle delete */}}
                          startIcon={theming.getThemedIcon('delete')}
                          color="error"
                        >
                          Delete
                        </Button>
                      </ButtonGroup>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </Box>
          )}

          {activeTab === 3 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Theme Management
              </Typography>
              <List>
                {themes.map((theme) => (
                  <ListItem key={theme.id}>
                    <ListItemAvatar>
                      <Avatar>
                        {theming.getThemedIcon('palette')}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={theme.name}
                      secondary={`${theme.type} • ${theme.description}`}
                    />
                    <ListItemSecondaryAction>
                      <ButtonGroup size="small">
                        <Button
                          onClick={() => setActiveTheme(theme.id)}
                          startIcon={theming.getThemedIcon('play')}
                        >
                          Activate
                        </Button>
                        <Button
                          onClick={() => setSelectedTheme(theme)}
                          startIcon={theming.getThemedIcon('edit')}
                        >
                          Edit
                        </Button>
                        <Button
                          onClick={() => {/* Handle delete */}}
                          startIcon={theming.getThemedIcon('delete')}
                          color="error"
                        >
                          Delete
                        </Button>
                      </ButtonGroup>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
          
          {activeTab === 4 && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Documentation
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Design system documentation and guidelines
              </Typography>
            </Box>
          )}
          
          {activeTab === 5 && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Design System Settings
              </Typography>
              <Grid container spacing={2}>
                <Grid size={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableDesignSystem}
                        onChange={(e) => updateConfig({ enableDesignSystem: e.target.checked })}
                      />
                  }
                    label="Enable Design System"
                  />
                </Grid>
                
                <Grid size={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableTokens}
                        onChange={(e) => updateConfig({ enableTokens: e.target.checked })}
                      />
                  }
                    label="Enable Tokens"
                  />
                </Grid>
                
                <Grid size={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableGuidelines}
                        onChange={(e) => updateConfig({ enableGuidelines: e.target.checked })}
                      />
                  }
                    label="Enable Guidelines"
                  />
                </Grid>
                
                <Grid size={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableThemes}
                        onChange={(e) => updateConfig({ enableThemes: e.target.checked })}
                      />
                  }
                    label="Enable Themes"
                  />
                </Grid>
                
                <Grid size={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableTypography}
                        onChange={(e) => updateConfig({ enableTypography: e.target.checked })}
                      />
                  }
                    label="Enable Typography"
                  />
                </Grid>
                
                <Grid size={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableColors}
                        onChange={(e) => updateConfig({ enableColors: e.target.checked })}
                      />
                  }
                    label="Enable Colors"
                  />
                </Grid>
                
                <Grid size={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableSpacing}
                        onChange={(e) => updateConfig({ enableSpacing: e.target.checked })}
                      />
                  }
                    label="Enable Spacing"
                  />
                </Grid>
                
                <Grid size={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableShadows}
                        onChange={(e) => updateConfig({ enableShadows: e.target.checked })}
                      />
                  }
                    label="Enable Shadows"
                  />
                </Grid>
                
                <Grid size={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableBorders}
                        onChange={(e) => updateConfig({ enableBorders: e.target.checked })}
                      />
                  }
                    label="Enable Borders"
                  />
                </Grid>
                
                <Grid size={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableAnimations}
                        onChange={(e) => updateConfig({ enableAnimations: e.target.checked })}
                      />
                  }
                    label="Enable Animations"
                  />
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setShowDesignSystemDialog(false)}>
            Close
          </Button>
          <Button
            onClick={handleCreateToken}
            variant="contained"
            startIcon={theming.getThemedIcon('add')}
            sx={theming.getThemedButtonSx()}
          >
            Create Token
          </Button>
        </DialogActions>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={showSettingsDialog} onClose={() => setShowSettingsDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            {theming.getThemedIcon('settings')}
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Design System Settings</Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Grid container spacing={2}>
            <Grid size={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableDesignSystem}
                    onChange={(e) => updateConfig({ enableDesignSystem: e.target.checked })}
                  />
              }
                label="Enable Design System"
              />
            </Grid>
            
            <Grid size={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableTokens}
                    onChange={(e) => updateConfig({ enableTokens: e.target.checked })}
                  />
              }
                label="Enable Tokens"
              />
            </Grid>
            
            <Grid size={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableGuidelines}
                    onChange={(e) => updateConfig({ enableGuidelines: e.target.checked })}
                  />
              }
                label="Enable Guidelines"
              />
            </Grid>
            
            <Grid size={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableThemes}
                    onChange={(e) => updateConfig({ enableThemes: e.target.checked })}
                  />
              }
                label="Enable Themes"
              />
            </Grid>
            
            <Grid size={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableTypography}
                    onChange={(e) => updateConfig({ enableTypography: e.target.checked })}
                  />
              }
                label="Enable Typography"
              />
            </Grid>
            
            <Grid size={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableColors}
                    onChange={(e) => updateConfig({ enableColors: e.target.checked })}
                  />
              }
                label="Enable Colors"
              />
            </Grid>
            
            <Grid size={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableSpacing}
                    onChange={(e) => updateConfig({ enableSpacing: e.target.checked })}
                  />
              }
                label="Enable Spacing"
              />
            </Grid>
            
            <Grid size={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableShadows}
                    onChange={(e) => updateConfig({ enableShadows: e.target.checked })}
                  />
              }
                label="Enable Shadows"
              />
            </Grid>
            
            <Grid size={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableBorders}
                    onChange={(e) => updateConfig({ enableBorders: e.target.checked })}
                  />
              }
                label="Enable Borders"
              />
            </Grid>
            
            <Grid size={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableAnimations}
                    onChange={(e) => updateConfig({ enableAnimations: e.target.checked })}
                  />
              }
                label="Enable Animations"
              />
            </Grid>
          </Grid>
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setShowSettingsDialog(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
});

DesignSystemDashboard.displayName ='DesignSystemDashboard';

export default DesignSystemDashboard;



