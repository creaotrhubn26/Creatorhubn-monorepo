/**
 * ComponentLibraryDashboard Component
 * Component library management dashboard with monitoring and configuration
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
  LibraryBooks,
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
  Category,
  Tag,
  Label,
  LocalOffer,
  Extension,
  Widgets,
  Apps,
  Dashboard,
  ViewInAr,
  ViewQuilt,
  ViewStream,
  ViewWeek,
  ViewColumn,
  ViewDay,
  ViewAgenda,
  ViewSidebar,
  ViewHeadline,
  ViewArray,
  ViewCarousel,
  ViewCompact,
  ViewCompactAlt,
  ViewKanban,
  ViewList as ViewListIcon,
  ViewModule as ViewModuleIcon,
  ViewComfy as ViewComfyIcon,
  ViewQuilt as ViewQuiltIcon,
  ViewStream as ViewStreamIcon,
  ViewWeek as ViewWeekIcon,
  ViewColumn as ViewColumnIcon,
  ViewDay as ViewDayIcon,
  ViewAgenda as ViewAgendaIcon,
  ViewSidebar as ViewSidebarIcon,
  ViewHeadline as ViewHeadlineIcon,
  ViewArray as ViewArrayIcon,
  ViewCarousel as ViewCarouselIcon,
  ViewCompact as ViewCompactIcon,
  ViewCompactAlt as ViewCompactAltIcon,
  ViewInAr as ViewInArIcon,
  ViewKanban as ViewKanbanIcon,
} from '@mui/icons-material';
import { useComponentLibrary, UseComponentLibraryOptions } from '../../../hooks/useComponentLibrary';
import { ComponentLibraryConfig, ComponentLibraryItem } from '../../../utils/componentLibraryManager';

interface ComponentLibraryDashboardProps {
  showDetails?: boolean;
  showSettings?: boolean;
  showManagement?: boolean;
  showMonitoring?: boolean;
  showComponents?: boolean;
  showCategories?: boolean;
  showTags?: boolean;
  showDocumentation?: boolean;
  variant?: 'minimal' | 'detailed' | 'full';
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center';
  onSettingsClick?: () => void;
  onManagementClick?: () => void;
  onMonitoringClick?: () => void;
  onComponentsClick?: () => void;
  onCategoriesClick?: () => void;
  onTagsClick?: () => void;
  onDocumentationClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

const ComponentLibraryDashboard: React.FC<ComponentLibraryDashboardProps> = memo(({
  showDetails = true,
  showSettings = true,
  showManagement = true,
  showMonitoring = true,
  showComponents = true,
  showCategories = true,
  showTags = true,
  showDocumentation = true,
  variant = 'minimal',
  position = 'top-right',
  onSettingsClick,
  onManagementClick,
  onMonitoringClick,
  onComponentsClick,
  onCategoriesClick,
  onTagsClick,
  onDocumentationClick,
  className,
  style
}) => {
  const [showLibraryDialog, setShowLibraryDialog] = useState(false);
  
  // Theming system
  const theming = useTheming('prototype_tester');
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showManagementDialog, setShowManagementDialog] = useState(false);
  const [showMonitoringDialog, setShowMonitoringDialog] = useState(false);
  const [showComponentsDialog, setShowComponentsDialog] = useState(false);
  const [showCategoriesDialog, setShowCategoriesDialog] = useState(false);
  const [showTagsDialog, setShowTagsDialog] = useState(false);
  const [showDocumentationDialog, setShowDocumentationDialog] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterTag, setFilterTag] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedComponent, setSelectedComponent] = useState<ComponentLibraryItem | null>(null);

  // Component library options
  const componentLibraryOptions: UseComponentLibraryOptions = useMemo(() => ({
    onComponentAdded: (_data: { component: ComponentLibraryItem }) => {
      setPage(0);
  },
    onComponentUpdated: (_data: { component: ComponentLibraryItem }) => {
      setPage(0);
  },
    onComponentDeleted: (_data: { component: ComponentLibraryItem }) => {
      setPage(0);
  },
    onSearchCompleted: (_data: { query: string; results: ComponentLibraryItem[] }) => {
      setPage(0);
  },
    onSearchFailed: (data: { query: string; error: string }) => {
      console.error('Search failed: ', data.error);
  },
    onError: (error: string) => {
      console.error('Component library error:', error);
  },
    onInitialized: () => {
      setPage(0);
}
}), []);

  // Use component library hook
  const {
    addComponent,
    updateComponent,
    deleteComponent,
    searchComponents,
    getComponent,
    getComponentsByCategory,
    getComponentsByTag,
    state,
    config,
    updateConfig,
    isEnabled,
    isInitialized,
    hasError,
    error,
    items,
    categories,
    tags,
    searchResults,
    totalItems,
    totalCategories,
    totalTags,
    totalDownloads,
    totalUsage,
    averageRating,
    totalReviews,
    totalErrors,
    totalConflicts,
    totalOverrides,
    getAllComponents,
    getCategories,
    getTags
} = useComponentLibrary(componentLibraryOptions);

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

  // Handle components click
  const handleComponentsClick = useCallback(() => {
    if (onComponentsClick) {
      onComponentsClick();
  } else {
      setShowComponentsDialog(true);
  }
}, [onComponentsClick]);

  // Handle categories click
  const handleCategoriesClick = useCallback(() => {
    if (onCategoriesClick) {
      onCategoriesClick();
  } else {
      setShowCategoriesDialog(true);
  }
}, [onCategoriesClick]);

  // Handle tags click
  const handleTagsClick = useCallback(() => {
    if (onTagsClick) {
      onTagsClick();
  } else {
      setShowTagsDialog(true);
  }
}, [onTagsClick]);

  // Handle documentation click
  const handleDocumentationClick = useCallback(() => {
    if (onDocumentationClick) {
      onDocumentationClick();
  } else {
      setShowDocumentationDialog(true);
  }
}, [onDocumentationClick]);

  // Handle create component
  const handleCreateComponent = useCallback(async () => {
    try {
      const componentData: Partial<ComponentLibraryItem> = {
        name: 'Custom Component',
        description: 'A custom component created by the user',
        category: 'custom',
        tags: ['custom', 'user-created'],
        version: '1.0.0',
        author: 'User',
        component: () => null, // Placeholder
        props:  [],
        events:  [],
        slots:  [],
        examples:  [],
        documentation: {
          overview: 'A custom component',
          usage: 'Use this component for custom functionality',
          api: 'Component API documentation',
          examples: 'Usage examples',
          bestPractices: 'Best practices for using this component',
          troubleshooting: 'Common issues and solutions',
          changelog: 'Version history',
          migration: 'Migration guide',
          accessibility: 'Accessibility guidelines',
          performance: 'Performance considerations',
          security: 'Security considerations',
          compliance: 'Compliance information'
    }
    };
      await addComponent(componentData);
  } catch (error) {
      console.error('Failed to create component:', error);
  }
}, [addComponent]);

  // Handle search
  const handleSearch = useCallback(async () => {
    try {
      await searchComponents(searchQuery, {
        category: filterCategory !== 'all' ? filterCategory : undefined,
        tags: filterTag !== 'all' ? [filterTag] : undefined
  });
  } catch (error) {
      console.error('Search failed:', error);
  }
}, [searchQuery, filterCategory, filterTag, searchComponents]);

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
    if (isEnabled) return <LibraryBooks />;
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
    <Tooltip title={`Component Library: ${getStatusText()}`}>
      <Chip
        icon={getStatusIcon()}
        label={totalItems}
        color={getStatusColor()}
        size="small"
        onClick={() => setShowLibraryDialog(true)}
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
          <IconButton size="small" onClick={() => setShowLibraryDialog(true)}>
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
            {totalItems} components • {totalCategories} categories
          </Typography>
          {searchResults.length > 0 && (
            <Typography variant="caption" color="info.main" sx={{ ml:  1 }}>
              {searchResults.length} results
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
          <LibraryBooks color="primary" />
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
            Component Library
          </Typography>
        </Box>

        <Box display="flex" gap={1}>
          <Button
            startIcon={theming.getThemedIcon('add')}
            onClick={handleCreateComponent}
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
                Total Components
              </Typography>
              <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                {totalItems}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid size={6}>
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
        
        <Grid size={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="subtitle2" gutterBottom>
                Downloads
              </Typography>
              <Typography variant="h4" color="success.main" sx={{ color: theming.colors.primary }}>
                {totalDownloads}
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
          Tags: {totalTags} • Rating: {averageRating.toFixed()}/5 • Documentation: {config.enableDocumentation ? 'On' : 'Off'}
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

      {/* Component Library Dialog */}
      <Dialog open={showLibraryDialog} onClose={() => setShowLibraryDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <LibraryBooks />
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Component Library</Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
            <Tab label="Overview" />
            <Tab label="Components" />
            <Tab label="Categories" />
            <Tab label="Tags" />
            <Tab label="Documentation" />
            <Tab label="Search" />
            <Tab label="Settings" />
          </Tabs>
          
          {activeTab === 0 && (
            <Grid container spacing={2} sx={{ mt:  2 }}>
              <Grid size={{ xs:  12, sm:  6, md:  3 }}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle2" gutterBottom>
                      Total Components
                    </Typography>
                    <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                      {totalItems}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid size={{ xs:  12, sm:  6, md:  3 }}>
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
              
              <Grid size={{ xs:  12, sm:  6, md:  3 }}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle2" gutterBottom>
                      Downloads
                    </Typography>
                    <Typography variant="h4" color="success.main" sx={{ color: theming.colors.primary }}>
                      {totalDownloads}
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
                Component Management
              </Typography>
              <List>
                {items.map((component) => (
                  <ListItem key={component.id}>
                    <ListItemAvatar>
                      <Avatar>
                        <Widgets />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={component.name}
                      secondary={`${component.category} • v${component.version} • ${component.description}`}
                    />
                    <ListItemSecondaryAction>
                      <ButtonGroup size="small">
                        <Button
                          onClick={() => setSelectedComponent(component)}
                          startIcon={theming.getThemedIcon('edit')}
                        >
                          Edit
                        </Button>
                        <Button
                          onClick={() => deleteComponent(component.id)}
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
                  <ListItem key={category}>
                    <ListItemAvatar>
                      <Avatar>
                        <Category />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={category}
                      secondary={`${getComponentsByCategory(category).length} components`}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
          
          {activeTab === 3 && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Tag Management
              </Typography>
              <List>
                {tags.map((tag) => (
                  <ListItem key={tag}>
                    <ListItemAvatar>
                      <Avatar>
                        <Tag />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={tag}
                      secondary={`${getComponentsByTag(tag).length} components`}
                    />
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
                Component documentation and examples
              </Typography>
            </Box>
          )}
          
          {activeTab === 5 && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Search Components
              </Typography>
              <Box display="flex" gap={2} mb={2}>
                <TextField
                  fullWidth
                  placeholder="Search components..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        {theming.getThemedIcon(', ')}
                      </InputAdornment>
                    )
                }}
                />
                <Button
                  variant="contained"
                  onClick={handleSearch}
                  startIcon={theming.getThemedIcon('search')}
                  sx={theming.getThemedButtonSx()}
                >
                  Search
                </Button>
              </Box>
              
              <Box display="flex" gap={2} mb={2}>
                <FormControl size="small" sx={{ minWidth: 120}}>
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    label="Category"
                  >
                    <MenuItem value="all">All Categories</MenuItem>
                    {categories.map((category) => (
                      <MenuItem key={category} value={category}>
                        {category}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                
                <FormControl size="small" sx={{ minWidth: 120}}>
                  <InputLabel>Tag</InputLabel>
                  <Select
                    value={filterTag}
                    onChange={(e) => setFilterTag(e.target.value)}
                    label="Tag"
                  >
                    <MenuItem value="all">All Tags</MenuItem>
                    {tags.map((tag) => (
                      <MenuItem key={tag} value={tag}>
                        {tag}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
              
              <List>
                {searchResults.map((component) => (
                  <ListItem key={component.id}>
                    <ListItemAvatar>
                      <Avatar>
                        <Widgets />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={component.name}
                      secondary={`${component.category} • ${component.description}`}
                    />
                    <ListItemSecondaryAction>
                      <Button
                        onClick={() => setSelectedComponent(component)}
                        startIcon={theming.getThemedIcon('edit')}
                        size="small"
                      >
                        View
                      </Button>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
          
          {activeTab === 6 && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Component Library Settings
              </Typography>
              <Grid container spacing={2}>
                <Grid size={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableLibrary}
                        onChange={(e) => updateConfig({ enableLibrary: e.target.checked })}
                      />
                  }
                    label="Enable Component Library"
                  />
                </Grid>
                
                <Grid size={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableDocumentation}
                        onChange={(e) => updateConfig({ enableDocumentation: e.target.checked })}
                      />
                  }
                    label="Enable Documentation"
                  />
                </Grid>
                
                <Grid size={12}>
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
                
                <Grid size={12}>
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
                
                <Grid size={12}>
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
                
                <Grid size={12}>
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
                
                <Grid size={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableVersioning}
                        onChange={(e) => updateConfig({ enableVersioning: e.target.checked })}
                      />
                  }
                    label="Enable Versioning"
                  />
                </Grid>
                
                <Grid size={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableSharing}
                        onChange={(e) => updateConfig({ enableSharing: e.target.checked })}
                      />
                  }
                    label="Enable Sharing"
                  />
                </Grid>
                
                <Grid size={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableImport}
                        onChange={(e) => updateConfig({ enableImport: e.target.checked })}
                      />
                  }
                    label="Enable Import"
                  />
                </Grid>
                
                <Grid size={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableExport}
                        onChange={(e) => updateConfig({ enableExport: e.target.checked })}
                      />
                  }
                    label="Enable Export"
                  />
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setShowLibraryDialog(false)}>
            Close
          </Button>
          <Button
            onClick={handleCreateComponent}
            variant="contained"
            startIcon={theming.getThemedIcon('add')}
            sx={theming.getThemedButtonSx()}
          >
            Create Component
          </Button>
        </DialogActions>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={showSettingsDialog} onClose={() => setShowSettingsDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            {theming.getThemedIcon('settings')}
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Component Library Settings</Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Grid container spacing={2}>
            <Grid size={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableLibrary}
                    onChange={(e) => updateConfig({ enableLibrary: e.target.checked })}
                  />
              }
                label="Enable Component Library"
              />
            </Grid>
            
            <Grid size={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableDocumentation}
                    onChange={(e) => updateConfig({ enableDocumentation: e.target.checked })}
                  />
              }
                label="Enable Documentation"
              />
            </Grid>
            
            <Grid size={12}>
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
            
            <Grid size={12}>
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
            
            <Grid size={12}>
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
            
            <Grid size={12}>
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
            
            <Grid size={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableVersioning}
                    onChange={(e) => updateConfig({ enableVersioning: e.target.checked })}
                  />
              }
                label="Enable Versioning"
              />
            </Grid>
            
            <Grid size={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableSharing}
                    onChange={(e) => updateConfig({ enableSharing: e.target.checked })}
                  />
              }
                label="Enable Sharing"
              />
            </Grid>
            
            <Grid size={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableImport}
                    onChange={(e) => updateConfig({ enableImport: e.target.checked })}
                  />
              }
                label="Enable Import"
              />
            </Grid>
            
            <Grid size={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableExport}
                    onChange={(e) => updateConfig({ enableExport: e.target.checked })}
                  />
              }
                label="Enable Export"
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

ComponentLibraryDashboard.displayName ='ComponentLibraryDashboard';

export default ComponentLibraryDashboard;





