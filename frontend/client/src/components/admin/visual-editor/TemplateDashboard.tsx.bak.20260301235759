/**
 * TemplateDashboard Component
 * Template management dashboard with search, filtering, and organization
 */

import { useTheming } from '../../../utils/theming-helper';
import React, { memo, useCallback, useState, useEffect, useMemo } from 'react';
import { useVisualEditor } from './VisualEditorContext';
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
  Slider,
} from '@mui/material';
import {
  Description,
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
  PlayCircleOutline,
  PauseCircleOutline,
  StopCircleOutlined,
  SkipNext,
  SkipPrevious,
  Replay,
  FastForward,
  FastRewind,
  VolumeUp,
  VolumeOff,
  VolumeDown,
  Fullscreen,
  FullscreenExit,
  ZoomIn,
  ZoomOut,
  CenterFocusStrong,
  CenterFocusWeak,
  CenterFocusStrong as CenterFocusStrongIcon,
  CenterFocusWeak as CenterFocusWeakIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  FullscreenExit as FullscreenExitIcon,
  Fullscreen as FullscreenIcon,
  VolumeDown as VolumeDownIcon,
  VolumeOff as VolumeOffIcon,
  VolumeUp as VolumeUpIcon,
  FastRewind as FastRewindIcon,
  FastForward as FastForwardIcon,
  Replay as ReplayIcon,
  SkipPrevious as SkipPreviousIcon,
  SkipNext as SkipNextIcon,
  StopCircleOutlined as StopCircleOutlinedIcon,
  PauseCircleOutline as PauseCircleOutlineIcon,
  PlayCircleOutline as PlayCircleOutlineIcon,
  Timeline as TimelineIcon,
  Event as EventIcon,
  Schedule as ScheduleIcon,
  Timer as TimerIcon,
  Favorite as FavoriteIcon,
  FavoriteBorder as FavoriteBorderIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  MoreVert as MoreVertIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  VisibilityOff as VisibilityOffIcon,
  Visibility as VisibilityIcon,
  Lock as LockIcon,
  Security as SecurityIcon,
  Storage as StorageIcon,
  Speed as SpeedIcon,
  Memory as MemoryIcon,
  ShowChart as ShowChartIcon,
  PieChart as PieChartIcon,
  BarChart as BarChartIcon,
  Queue as QueueIcon,
  CloudSync as CloudSyncIcon3,
  CloudDone as CloudDoneIcon3,
  CloudOff as CloudOffIcon3,
  SyncProblem as SyncProblemIcon,
  Sync as SyncIcon,
  Group as GroupIcon,
  Person as PersonIcon,
  Home as HomeIcon,
  Work as WorkIcon,
  School as SchoolIcon,
  Book as BookIcon,
  Public as PublicIcon,
  Flag as FlagIcon,
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
  KeyboardArrowUp as KeyboardArrowUpIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  ViewComfy as ViewComfyIcon,
  ViewModule as ViewModuleIcon,
  ViewList as ViewListIcon,
  Sort as SortIcon,
  Search as SearchIcon,
  FilterList as FilterListIcon,
  Build as BuildIcon,
  Api as ApiIcon,
  Code as CodeIcon,
  Upload as UploadIcon,
  Download as DownloadIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  Stop as StopIcon,
  Pause as PauseIcon,
  PlayArrow as PlayArrowIcon,
  Remove as RemoveIcon,
  Add as AddIcon,
  Description as DescriptionIcon,
} from '@mui/icons-material';
import { useTemplate, UseTemplateOptions } from '../../../hooks/useTemplate';
import { Template as TemplateType } from '../../../utils/templateManager';

interface TemplateDashboardProps {
  showDetails?: boolean;
  showSettings?: boolean;
  showManagement?: boolean;
  showMonitoring?: boolean;
  showTemplates?: boolean;
  showCategories?: boolean;
  showSearch?: boolean;
  showPreview?: boolean;
  variant?: 'minimal' | 'detailed' | 'full';
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center';
  onSettingsClick?: () => void;
  onManagementClick?: () => void;
  onMonitoringClick?: () => void;
  onTemplatesClick?: () => void;
  onCategoriesClick?: () => void;
  onSearchClick?: () => void;
  onPreviewClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

const TemplateDashboard: React.FC<TemplateDashboardProps> = memo(({
  showDetails = true,
  showSettings = true,
  showManagement = true,
  showMonitoring = true,
  showTemplates = true,
  showCategories = true,
  showSearch = true,
  showPreview = true,
  variant = 'minimal',
  position = 'top-right',
  onSettingsClick,
  onManagementClick,
  onMonitoringClick,
  onTemplatesClick,
  onCategoriesClick,
  onSearchClick,
  onPreviewClick,
  className,
  style
}) => {
  // Get context from visual editor
  const {
    state: contextState,
    createTemplate,
    loadTemplate,
    addNotification,
    setActiveTab: setContextActiveTab
} = useVisualEditor();
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  
  // Theming system
  const theming = useTheming('prototype_tester');
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showManagementDialog, setShowManagementDialog] = useState(false);
  const [showMonitoringDialog, setShowMonitoringDialog] = useState(false);
  const [showTemplatesDialog, setShowTemplatesDialog] = useState(false);
  const [showCategoriesDialog, setShowCategoriesDialog] = useState(false);
  const [showSearchDialog, setShowSearchDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType | null>(null);

  // Template options
  const templateOptions: UseTemplateOptions = useMemo(() => ({
    onTemplateAdded: (_data: { template: TemplateType }) => {
      setPage(0);
  },
    onCategoryAdded: (_data: { category: string }) => {
      setFilterCategory('all');
      setPage(0);
  },
    onSearchCompleted: (_data: { query: string; results: TemplateType[] }) => {
      setFilterType('all');
      setPage(0);
  },
    onSearchFailed: (data: { query: string; error: string }) => {
      console.error('Template search failed: ', data.error);
  },
    onError: (error: string) => {
      console.error('Template error:', error);
  },
    onInitialized: () => {
      setFilterType('all');
      setFilterCategory('all');
      setPage(0);
}
}), []);

  // Use template hook
  const {
    addTemplate,
    addCategory,
    searchTemplates,
    getTemplate,
    getTemplatesByType,
    getTemplatesByCategory,
    getCategory,
    state,
    config,
    updateConfig,
    isEnabled,
    isInitialized,
    hasError,
    error,
    templates,
    categories,
    searchResults,
    lastSearchQuery,
    totalTemplates,
    totalCategories,
    totalUsage,
    totalErrors,
    totalConflicts,
    totalOverrides,
    getAllTemplates,
    getAllCategories
} = useTemplate(templateOptions);

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

  // Handle templates click
  const handleTemplatesClick = useCallback(() => {
    if (onTemplatesClick) {
      onTemplatesClick();
  } else {
      setShowTemplatesDialog(true);
  }
}, [onTemplatesClick]);

  // Handle categories click
  const handleCategoriesClick = useCallback(() => {
    if (onCategoriesClick) {
      onCategoriesClick();
  } else {
      setShowCategoriesDialog(true);
  }
}, [onCategoriesClick]);

  // Handle search click
  const handleSearchClick = useCallback(() => {
    if (onSearchClick) {
      onSearchClick();
  } else {
      setShowSearchDialog(true);
  }
}, [onSearchClick]);

  // Handle preview click
  const handlePreviewClick = useCallback(() => {
    if (onPreviewClick) {
      onPreviewClick();
  } else {
      setShowPreviewDialog(true);
  }
}, [onPreviewClick]);

  // Handle create template
  const handleCreateTemplate = useCallback(async () => {
    try {
      const templateData = {
        name: 'Custom Template',
        description: 'A custom template created by the user',
        category: 'project' as const,
        elements: contextState.elements, // Use current elements from context
        tags: ['custom', 'user-created']
    };
      
      createTemplate(templateData);
      
      addNotification({
        type: 'success',
        title: 'Template Created',
        message: 'Template has been created successfully',
        read: false
  });
  } catch (error) {
      console.error('Failed to create template:', error);
      addNotification({
        type: 'error',
        title: 'Template Creation Failed',
        message: 'Failed to create template. Please try again.',
        read: false
  });
  }
}, [createTemplate, addNotification, contextState.elements]);

  // Handle load template
  const handleLoadTemplate = useCallback((templateId: string) => {
    try {
      loadTemplate(templateId);
      addNotification({
        type: 'success',
        title: 'Template Loaded',
        message: 'Template has been loaded successfully',
        read: false
  });
  } catch (error) {
      console.error('Failed to load template:', error);
      addNotification({
        type: 'error',
        title: 'Template Loading Failed',
        message: 'Failed to load template. Please try again.',
        read: false
  });
  }
}, [loadTemplate, addNotification]);

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
    if (isEnabled) return <Description />;
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
  const renderMinimal = () => (
    <Tooltip title={`Templates: ${getStatusText()}`}>
      <Chip
        icon={getStatusIcon()}
        label={totalTemplates}
        color={getStatusColor()}
        size="small"
        onClick={() => setShowTemplateDialog(true)}
        sx={{ cursor: 'pointer'}}
      />
    </Tooltip>
  );

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
          <IconButton size="small" onClick={() => setShowTemplateDialog(true)}>
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
            {totalTemplates} templates • {totalCategories} categories
          </Typography>
        </Box>
      )}
    </Paper>
  );

  // Render full variant
  const renderFull = () => (
    <Paper elevation={3} sx={{ ...theming.getThemedCardSx(), p: 2, minWidth: 300 }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Box display="flex" alignItems="center" gap={1}>
          <Description color="primary" />
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
            Templates
          </Typography>
        </Box>

        <Box display="flex" gap={1}>
          <Button
            startIcon={theming.getThemedIcon('add')}
            onClick={handleCreateTemplate}
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
                Total Templates
              </Typography>
              <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                {totalTemplates}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="subtitle2" gutterBottom>
                Categories
              </Typography>
              <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                {totalCategories}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="subtitle2" gutterBottom>
                Usage
              </Typography>
              <Typography variant="h4" color="success.main" sx={{ color: theming.colors.primary }}>
                {totalUsage}
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
          Errors: {totalErrors} • Conflicts: {totalConflicts} • Overrides: {totalOverrides}
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

      {/* Template Dialog */}
      <Dialog open={showTemplateDialog} onClose={() => setShowTemplateDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <Description />
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Template Dashboard</Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
            <Tab label="Overview" />
            <Tab label="Templates" />
            <Tab label="Categories" />
            <Tab label="Search" />
            <Tab label="Preview" />
            <Tab label="Settings" />
          </Tabs>
          
          {activeTab === 0 && (
            <Grid container spacing={2} sx={{ mt:  2 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle2" gutterBottom>
                      Total Templates
                    </Typography>
                    <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                      {totalTemplates}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle2" gutterBottom>
                      Categories
                    </Typography>
                    <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                      {totalCategories}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle2" gutterBottom>
                      Usage
                    </Typography>
                    <Typography variant="h4" color="success.main" sx={{ color: theming.colors.primary }}>
                      {totalUsage}
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
                Template Management
              </Typography>
              <List>
                {contextState.templates.map((template) => (
                  <ListItem key={template.id} component="div" onClick={() => handleLoadTemplate(template.id)} sx={{ cursor: 'pointer'}}>
                    <ListItemAvatar>
                      <Avatar>
                        <Description />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={template.name}
                      secondary={`${template.category} • ${template.description}`}
                    />
                    <ListItemSecondaryAction>
                      <ButtonGroup size="small">
                        <Button
                          onClick={() => setSelectedTemplate(template as TemplateType)}
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
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Category Management
              </Typography>
              <List>
                {categories.map((category) => (
                  <ListItem key={category.id}>
                    <ListItemAvatar>
                      <Avatar>
                        <Book />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={category.name}
                      secondary={`${category.description} • ${category.templates.length} templates`}
                    />
                    <ListItemSecondaryAction>
                      <ButtonGroup size="small">
                        <Button
                          onClick={() => {/* Handle edit */}}
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
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Template Search
              </Typography>
              <Box sx={{ mb:  2 }}>
                <TextField
                  fullWidth
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search />
                      </InputAdornment>
                    )}}
                />
              </Box>
              
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <FormControl fullWidth>
                    <InputLabel>Type</InputLabel>
                    <Select
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                    >
                      <MenuItem value="all">All Types</MenuItem>
                      <MenuItem value="layout">Layout</MenuItem>
                      <MenuItem value="component">Component</MenuItem>
                      <MenuItem value="page">Page</MenuItem>
                      <MenuItem value="design">Design</MenuItem>
                      <MenuItem value="ui">UI</MenuItem>
                      <MenuItem value="custom">Custom</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={6}>
                  <FormControl fullWidth>
                    <InputLabel>Category</InputLabel>
                    <Select
                      value={filterCategory}
                      onChange={(e) => setFilterCategory(e.target.value)}
                    >
                      <MenuItem value="all">All Categories</MenuItem>
                      {categories.map((category) => (
                        <MenuItem key={category.id} value={category.id}>
                          {category.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </Box>
          )}
          
          {activeTab === 4 && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Template Preview
              </Typography>
              <Box sx={{ p: 2, border: '1px dashed #ccc', borderRadius: 1, textAlign: 'center'}}>
                <Typography variant="body2" color="text.secondary">
                  Template preview area
                </Typography>
                {selectedTemplate && (
                  <Box sx={{ mt:  2 }}>
                    <Typography variant="h6" sx={{ color: theming.colors.primary }}>{selectedTemplate.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {selectedTemplate.description}
                    </Typography>
                    <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.10', borderRadius:  1 }}>
                      <pre style={{ margin: 0, fontSize: '12px'}}>
                        {selectedTemplate.description}
                      </pre>
                    </Box>
                  </Box>
                )}
              </Box>
            </Box>
          )}
          
          {activeTab === 5 && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Template Settings
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableTemplates}
                        onChange={(e) => updateConfig({ enableTemplates: e.target.checked })}
                      />
                  }
                    label="Enable Templates"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableSearch}
                        onChange={(e) => updateConfig({ enableSearch: e.target.checked })}
                      />
                  }
                    label="Enable Search"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableFiltering}
                        onChange={(e) => updateConfig({ enableFiltering: e.target.checked })}
                      />
                  }
                    label="Enable Filtering"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableOrganization}
                        onChange={(e) => updateConfig({ enableOrganization: e.target.checked })}
                      />
                  }
                    label="Enable Organization"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableCategorization}
                        onChange={(e) => updateConfig({ enableCategorization: e.target.checked })}
                      />
                  }
                    label="Enable Categorization"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableTagging}
                        onChange={(e) => updateConfig({ enableTagging: e.target.checked })}
                      />
                  }
                    label="Enable Tagging"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableMetadata}
                        onChange={(e) => updateConfig({ enableMetadata: e.target.checked })}
                      />
                  }
                    label="Enable Metadata"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableThumbnails}
                        onChange={(e) => updateConfig({ enableThumbnails: e.target.checked })}
                      />
                  }
                    label="Enable Thumbnails"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enablePreview}
                        onChange={(e) => updateConfig({ enablePreview: e.target.checked })}
                      />
                  }
                    label="Enable Preview"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableCustomization}
                        onChange={(e) => updateConfig({ enableCustomization: e.target.checked })}
                      />
                  }
                    label="Enable Customization"
                  />
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setShowTemplateDialog(false)}>
            Close
          </Button>
          <Button onClick={handleCreateTemplate}
            variant="contained"
            startIcon={theming.getThemedIcon('add')}
            sx={theming.getThemedButtonSx()}>
            Create Template
          </Button>
        </DialogActions>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={showSettingsDialog} onClose={() => setShowSettingsDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            {theming.getThemedIcon('settings')}
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Template Settings</Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableTemplates}
                    onChange={(e) => updateConfig({ enableTemplates: e.target.checked })}
                  />
              }
                label="Enable Templates"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableSearch}
                    onChange={(e) => updateConfig({ enableSearch: e.target.checked })}
                  />
              }
                label="Enable Search"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableFiltering}
                    onChange={(e) => updateConfig({ enableFiltering: e.target.checked })}
                  />
              }
                label="Enable Filtering"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableOrganization}
                    onChange={(e) => updateConfig({ enableOrganization: e.target.checked })}
                  />
              }
                label="Enable Organization"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableCategorization}
                    onChange={(e) => updateConfig({ enableCategorization: e.target.checked })}
                  />
              }
                label="Enable Categorization"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableTagging}
                    onChange={(e) => updateConfig({ enableTagging: e.target.checked })}
                  />
              }
                label="Enable Tagging"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableMetadata}
                    onChange={(e) => updateConfig({ enableMetadata: e.target.checked })}
                  />
              }
                label="Enable Metadata"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableThumbnails}
                    onChange={(e) => updateConfig({ enableThumbnails: e.target.checked })}
                  />
              }
                label="Enable Thumbnails"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enablePreview}
                    onChange={(e) => updateConfig({ enablePreview: e.target.checked })}
                  />
              }
                label="Enable Preview"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableCustomization}
                    onChange={(e) => updateConfig({ enableCustomization: e.target.checked })}
                  />
              }
                label="Enable Customization"
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

TemplateDashboard.displayName ='TemplateDashboard';

export default TemplateDashboard;
