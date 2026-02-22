/**
 * ThemeDashboard Component
 * Theme management dashboard with dark mode and theme switching
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
  Grid,
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
  LightMode,
  DarkMode,
  Brightness4,
  Brightness7,
  BrightnessAuto,
  ColorLens,
  Brush,
  FormatColorFill,
  FormatColorText,
  FormatColorReset,
  PaletteOutlined,
  PaletteRounded,
  PaletteSharp,
  PaletteTwoTone,
  InvertColors,
  InvertColorsOff,
  InvertColorsOutlined,
  InvertColorsRounded,
  InvertColorsSharp,
  InvertColorsTwoTone,
  Contrast,
  Opacity,
  Gradient,
  Texture,
  Style,
  DesignServices,
  AutoFixHigh,
  AutoFixNormal,
  AutoFixOff,
  AutoAwesome,
  AutoAwesomeMotion,
  AutoAwesomeOutlined,
  AutoAwesomeRounded,
  AutoAwesomeSharp,
  AutoAwesomeTwoTone,
} from '@mui/icons-material';
import { useTheme, UseThemeOptions } from '../../../hooks/useTheme';
import { ThemeConfig, Theme } from '../../../utils/themeManager';

interface ThemeDashboardProps {
  showDetails?: boolean;
  showSettings?: boolean;
  showManagement?: boolean;
  showCustomization?: boolean;
  showThemes?: boolean;
  showColors?: boolean;
  showTypography?: boolean;
  showSpacing?: boolean;
  variant?: 'minimal' | 'detailed' | 'full';
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center';
  onSettingsClick?: () => void;
  onManagementClick?: () => void;
  onCustomizationClick?: () => void;
  onThemesClick?: () => void;
  onColorsClick?: () => void;
  onTypographyClick?: () => void;
  onSpacingClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

const ThemeDashboard: React.FC<ThemeDashboardProps> = memo(({
  showDetails = true,
  showSettings = true,
  showManagement = true,
  showCustomization = true,
  showThemes = true,
  showColors = true,
  showTypography = true,
  showSpacing = true,
  variant = 'minimal',
  position = 'top-right',
  onSettingsClick,
  onManagementClick,
  onCustomizationClick,
  onThemesClick,
  onColorsClick,
  onTypographyClick,
  onSpacingClick,
  className,
  style
}) => {
  const [showThemeDialog, setShowThemeDialog] = useState(false);
  
  // Theming system
  const theming = useTheming('prototype_tester');
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showManagementDialog, setShowManagementDialog] = useState(false);
  const [showCustomizationDialog, setShowCustomizationDialog] = useState(false);
  const [showThemesDialog, setShowThemesDialog] = useState(false);
  const [showColorsDialog, setShowColorsDialog] = useState(false);
  const [showTypographyDialog, setShowTypographyDialog] = useState(false);
  const [showSpacingDialog, setShowSpacingDialog] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedTheme, setSelectedTheme] = useState<Theme | null>(null);

  // Theme options
  const themeOptions: UseThemeOptions = useMemo(() => ({
    onThemeChanged: (_data: { theme: Theme; previousTheme: string }) => {
      setFilterType('all');
      setPage(0);
  },
    onThemeChangeFailed: (data: { theme: Theme; error: string }) => {
      console.error('Theme change failed:', data.error);
  },
    onSystemThemeChanged: (_data: { theme: string }) => {
      setPage(0);
  },
    onCustomThemeCreated: (_data: { theme: Theme }) => {
      setPage(0);
  },
    onCustomThemeCreateFailed: (data: { theme: Theme; error: string }) => {
      console.error('Custom theme creation failed:', data.error);
  },
    onError: (error: string) => {
      console.error('Theme error:', error);
  },
    onInitialized: () => {
      setFilterType('all');
      setPage(0);
}
}), []);

  // Use theme hook
  const {
    switchTheme,
    toggleDarkMode,
    setSystemTheme,
    createCustomTheme,
    state,
    config,
    updateConfig,
    isEnabled,
    isInitialized,
    hasError,
    error,
    currentTheme,
    systemTheme,
    isDarkMode,
    isSystemTheme,
    themes,
    customThemes,
    totalThemes,
    totalCustomThemes,
    themeChanges,
    systemThemeChanges,
    darkModeChanges,
    getCurrentTheme,
    getThemes,
    getCustomThemes
} = useTheme(themeOptions);

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

  // Handle customization click
  const handleCustomizationClick = useCallback(() => {
    if (onCustomizationClick) {
      onCustomizationClick();
  } else {
      setShowCustomizationDialog(true);
  }
}, [onCustomizationClick]);

  // Handle themes click
  const handleThemesClick = useCallback(() => {
    if (onThemesClick) {
      onThemesClick();
  } else {
      setShowThemesDialog(true);
  }
}, [onThemesClick]);

  // Handle colors click
  const handleColorsClick = useCallback(() => {
    if (onColorsClick) {
      onColorsClick();
  } else {
      setShowColorsDialog(true);
  }
}, [onColorsClick]);

  // Handle typography click
  const handleTypographyClick = useCallback(() => {
    if (onTypographyClick) {
      onTypographyClick();
  } else {
      setShowTypographyDialog(true);
  }
}, [onTypographyClick]);

  // Handle spacing click
  const handleSpacingClick = useCallback(() => {
    if (onSpacingClick) {
      onSpacingClick();
  } else {
      setShowSpacingDialog(true);
  }
}, [onSpacingClick]);

  // Handle create custom theme
  const handleCreateCustomTheme = useCallback(async () => {
    try {
      const themeData: Partial<Theme> = {
        name: 'Custom Theme',
        displayName: 'Custom',
        description: 'A custom theme created by the user',
        type: 'custom',
        colors: {
          primary: '#1976d0',
          secondary: '#dc0040',
          error: '#f44330',
          warning: '#ff9800',
          info: '#2196f0',
          success: '#4caf50',
          background: '#ffffff',
          surface: '#ffffff',
          paper: '#ffffff',
          text: {
            primary: 'rgba(0,0,0,0.87)',
            secondary: 'rgba(0,0,0,0.6)',
            disabled: 'rgba(0,0,0,0.38)',
            hint: 'rgba(0,0,0,0.38)'
        },
          divider: 'rgba(0,0,0,0.12)',
          action: {
            active: 'rgba(0,0,0,0.54)',
            hover: 'rgba(0,0,0,0.04)',
            selected: 'rgba(0,0,0,0.08)',
            disabled: 'rgba(0,0,0,0.26)'
        },
          grey: {
            50: '#fafafa',
            100: '#f5f5f0',
            200: '#eeeeee',
            300: '#e0e0e0',
            400: '#bdbdbd',
            500: '#9e9e90',
            600: '#757570',
            700: '#616160',
            800: '#424240',
            900: '#212121'
      }
      },
        metadata: {
          created: Date.now(),
          modified: Date.now(),
          version: '1.0.0',
          author: 'User',
          tags: ['custom']
    },
        config: {}
    };
      await createCustomTheme(themeData);
  } catch (error) {
      console.error('Failed to create custom theme:', error);
  }
}, [createCustomTheme]);

  // Get status color
  const getStatusColor = useCallback(() => {
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

  // Get theme icon
  const getThemeIcon = useCallback(() => {
    if (isDarkMode) return <DarkMode />;
    if (currentTheme === 'light') return <LightMode />;
    return theming.getThemedIcon('palette');
}, [isDarkMode, currentTheme]);

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
  const renderMinimal = () => (
    <Tooltip title={`Theme: ${getStatusText()}`}>
      <Chip
        icon={getStatusIcon()}
        label={currentTheme}
        color={getStatusColor()}
        size="small"
        onClick={() => setShowThemeDialog(true)}
        sx={{ cursor: 'pointer'}}
      />
    </Tooltip>
  );

  // Render detailed variant
  const renderDetailed = () => (
    <Paper elevation={2} sx={{ p: 1, minWidth: 200,  ...theming.getThemedCardSx() }}>
      <Box display="flex" alignItems="center" justifyContent="space-between">
        <Box display="flex" alignItems="center" gap={1}>
          {getStatusIcon()}
          <Typography variant="body2" color={getStatusColor() + '.main'}>
            {getStatusText()}
          </Typography>
        </Box>
        
        <Box display="flex" gap={1}>
          <IconButton size="small" onClick={() => setShowThemeDialog(true)}>
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
            {currentTheme} • {isDarkMode ? 'Dark' : 'Light'}
          </Typography>
          {isSystemTheme && (
            <Typography variant="caption" color="info.main" sx={{ ml:  1 }}>
              System
            </Typography>
          )}
        </Box>
      )}
    </Paper>
  );

  // Render full variant
  const renderFull = () => (
    <Paper elevation={3} sx={{ p: 2, minWidth: 300,  ...theming.getThemedCardSx() }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Box display="flex" alignItems="center" gap={1}>
          <Palette color="primary" />
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
            Theme
          </Typography>
        </Box>
        
        <Box display="flex" gap={1}>
          <Button
            startIcon={theming.getThemedIcon('add')}
            onClick={handleCreateCustomTheme}
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
        <Grid item xs={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="subtitle2" gutterBottom>
                Current Theme
              </Typography>
              <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                {currentTheme}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="subtitle2" gutterBottom>
                Mode
              </Typography>
              <Box display="flex" alignItems="center" gap={1}>
                {getThemeIcon()}
                <Typography variant="body2" color="text.secondary">
                  {isDarkMode ? 'Dark' : 'Light'}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="subtitle2" gutterBottom>
                System Theme
              </Typography>
              <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                {systemTheme}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={6}>
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
          Total themes: {totalThemes} • Custom: {totalCustomThemes}
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

      {/* Theme Dialog */}
      <Dialog open={showThemeDialog} onClose={() => setShowThemeDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            {theming.getThemedIcon('palette')}
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Theme Management Dashboard</Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
            <Tab label="Overview" />
            <Tab label="Themes" />
            <Tab label="Colors" />
            <Tab label="Typography" />
            <Tab label="Spacing" />
            <Tab label="Customization" />
            <Tab label="Settings" />
          </Tabs>
          
          {activeTab === 0 && (
            <Grid container spacing={2} sx={{ mt:  2 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle2" gutterBottom>
                      Current Theme
                    </Typography>
                    <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                      {currentTheme}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle2" gutterBottom>
                      Mode
                    </Typography>
                    <Box display="flex" alignItems="center" gap={1}>
                      {getThemeIcon()}
                      <Typography variant="body2" color="text.secondary">
                        {isDarkMode ? 'Dark' : 'Light'}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle2" gutterBottom>
                      System Theme
                    </Typography>
                    <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                      {systemTheme}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
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
                Theme Management
              </Typography>
              <List>
                {themes.map((theme) => (
                  <ListItem key={theme.id}>
                    <ListItemAvatar>
                      <Avatar>
                        {theme.type === 'dark' ? <DarkMode /> : <LightMode />}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={theme.displayName}
                      secondary={`${theme.type} • ${theme.description}`}
                    />
                    <ListItemSecondaryAction>
                      <ButtonGroup size="small">
                        <Button
                          onClick={() => switchTheme(theme.id)}
                          disabled={theme.id === currentTheme}
                          startIcon={theming.getThemedIcon('play')}
                        >
                          {theme.id === currentTheme ? 'Active' : 'Switch'}
                        </Button>
                        <Button
                          onClick={() => setSelectedTheme(theme)}
                          startIcon={theming.getThemedIcon('edit')}
                        >
                          Edit
                        </Button>
                      </ButtonGroup>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
          
          {activeTab === 2 && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Color Management
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Color customization and management
              </Typography>
            </Box>
          )}
          
          {activeTab === 3 && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Typography Management
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Typography customization and management
              </Typography>
            </Box>
          )}
          
          {activeTab === 4 && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Spacing Management
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Spacing customization and management
              </Typography>
            </Box>
          )}
          
          {activeTab === 5 && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Theme Customization
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Advanced theme customization options
              </Typography>
            </Box>
          )}
          
          {activeTab === 6 && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Theme Settings
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
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
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableDarkMode}
                        onChange={(e) => updateConfig({ enableDarkMode: e.target.checked })}
                      />
                  }
                    label="Enable Dark Mode"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableThemeSwitching}
                        onChange={(e) => updateConfig({ enableThemeSwitching: e.target.checked })}
                      />
                  }
                    label="Enable Theme Switching"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableSystemTheme}
                        onChange={(e) => updateConfig({ enableSystemTheme: e.target.checked })}
                      />
                  }
                    label="Enable System Theme"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableCustomThemes}
                        onChange={(e) => updateConfig({ enableCustomThemes: e.target.checked })}
                      />
                  }
                    label="Enable Custom Themes"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableThemePersistence}
                        onChange={(e) => updateConfig({ enableThemePersistence: e.target.checked })}
                      />
                  }
                    label="Enable Theme Persistence"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableThemeAnimation}
                        onChange={(e) => updateConfig({ enableThemeAnimation: e.target.checked })}
                      />
                  }
                    label="Enable Theme Animation"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableThemeTransitions}
                        onChange={(e) => updateConfig({ enableThemeTransitions: e.target.checked })}
                      />
                  }
                    label="Enable Theme Transitions"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableThemeCustomization}
                        onChange={(e) => updateConfig({ enableThemeCustomization: e.target.checked })}
                      />
                  }
                    label="Enable Theme Customization"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableThemeSharing}
                        onChange={(e) => updateConfig({ enableThemeSharing: e.target.checked })}
                      />
                  }
                    label="Enable Theme Sharing"
                  />
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setShowThemeDialog(false)}>
            Close
          </Button>
          <Button onClick={toggleDarkMode}
            variant="contained"
            startIcon={isDarkMode ? <LightMode /> : <DarkMode />}
          >
            {isDarkMode ? 'Switch to Light' : 'Switch to Dark'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={showSettingsDialog} onClose={() => setShowSettingsDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            {theming.getThemedIcon('settings')}
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Theme Settings</Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Grid container spacing={2}>
            <Grid item xs={12}>
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
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableDarkMode}
                    onChange={(e) => updateConfig({ enableDarkMode: e.target.checked })}
                  />
              }
                label="Enable Dark Mode"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableThemeSwitching}
                    onChange={(e) => updateConfig({ enableThemeSwitching: e.target.checked })}
                  />
              }
                label="Enable Theme Switching"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableSystemTheme}
                    onChange={(e) => updateConfig({ enableSystemTheme: e.target.checked })}
                  />
              }
                label="Enable System Theme"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableCustomThemes}
                    onChange={(e) => updateConfig({ enableCustomThemes: e.target.checked })}
                  />
              }
                label="Enable Custom Themes"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableThemePersistence}
                    onChange={(e) => updateConfig({ enableThemePersistence: e.target.checked })}
                  />
              }
                label="Enable Theme Persistence"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableThemeAnimation}
                    onChange={(e) => updateConfig({ enableThemeAnimation: e.target.checked })}
                  />
              }
                label="Enable Theme Animation"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableThemeTransitions}
                    onChange={(e) => updateConfig({ enableThemeTransitions: e.target.checked })}
                  />
              }
                label="Enable Theme Transitions"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableThemeCustomization}
                    onChange={(e) => updateConfig({ enableThemeCustomization: e.target.checked })}
                  />
              }
                label="Enable Theme Customization"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableThemeSharing}
                    onChange={(e) => updateConfig({ enableThemeSharing: e.target.checked })}
                  />
              }
                label="Enable Theme Sharing"
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

ThemeDashboard.displayName ='ThemeDashboard';

export default ThemeDashboard;





