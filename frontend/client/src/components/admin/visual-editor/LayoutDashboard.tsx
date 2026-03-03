/**
 * LayoutDashboard Component
 * Layout management dashboard with monitoring and configuration
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
  ViewComfy,
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
  ViewComfy as ViewComfyIcon,
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
  ViewColumn,
  ViewWeek,
  ViewDay,
  ViewAgenda,
  ViewStream,
  ViewQuilt,
  ViewSidebar,
  ViewHeadline,
  ViewArray,
  ViewCarousel,
  ViewCompact,
  ViewCompactAlt,
  ViewInAr,
  ViewKanban,
  ViewList as ViewListIcon,
  ViewModule as ViewModuleIcon,
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
import { useLayout, UseLayoutOptions } from '../../../hooks/useLayout';
import { LayoutConfig, LayoutElement, LayoutRule } from '../../../utils/layoutManager';

interface LayoutDashboardProps {
  showDetails?: boolean;
  showSettings?: boolean;
  showManagement?: boolean;
  showMonitoring?: boolean;
  showElements?: boolean;
  showRules?: boolean;
  showAlignment?: boolean;
  showResponsive?: boolean;
  variant?: 'minimal' | 'detailed' | 'full';
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center';
  onSettingsClick?: () => void;
  onManagementClick?: () => void;
  onMonitoringClick?: () => void;
  onElementsClick?: () => void;
  onRulesClick?: () => void;
  onAlignmentClick?: () => void;
  onResponsiveClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

const LayoutDashboard: React.FC<LayoutDashboardProps> = memo(({
  showDetails = true,
  showSettings = true,
  showManagement = true,
  showMonitoring = true,
  showElements = true,
  showRules = true,
  showAlignment = true,
  showResponsive = true,
  variant = 'minimal',
  position = 'top-right',
  onSettingsClick,
  onManagementClick,
  onMonitoringClick,
  onElementsClick,
  onRulesClick,
  onAlignmentClick,
  onResponsiveClick,
  className,
  style
}) => {
  const [showLayoutDialog, setShowLayoutDialog] = useState(false);
  
  // Theming system
  const theming = useTheming('prototype_tester');
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showManagementDialog, setShowManagementDialog] = useState(false);
  const [showMonitoringDialog, setShowMonitoringDialog] = useState(false);
  const [showElementsDialog, setShowElementsDialog] = useState(false);
  const [showRulesDialog, setShowRulesDialog] = useState(false);
  const [showAlignmentDialog, setShowAlignmentDialog] = useState(false);
  const [showResponsiveDialog, setShowResponsiveDialog] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedElement, setSelectedElement] = useState<LayoutElement | null>(null);
  const [selectedRule, setSelectedRule] = useState<LayoutRule | null>(null);

  // Layout options
  const layoutOptions: UseLayoutOptions = useMemo(() => ({
    onElementRegistered: (_data: { element: LayoutElement }) => {
      setPage(0);
  },
    onRuleCreated: (_data: { rule: LayoutRule }) => {
      setPage(0);
  },
    onLayoutApplied: (_data: { element: LayoutElement }) => {
      setPage(0);
  },
    onLayoutApplyFailed: (data: { element: LayoutElement; error: string }) => {
      console.error('Layout apply failed:', data.error);
    },
    onRuleExecutionFailed: (data: { rule: LayoutRule; element: LayoutElement; error: string }) => {
      console.error('Rule execution failed:', data.error);
    },
    onError: (error: string) => {
      console.error('Layout error:', error);
    },
    onInitialized: () => {
      setFilterType('all');
      setPage(0);
}
}), []);

  // Use layout hook
  const {
    registerElement,
    createRule,
    applyLayout,
    state,
    config,
    updateConfig,
    isEnabled,
    isInitialized,
    hasError,
    error,
    elements,
    rules,
    activeElements,
    totalElements,
    totalRules,
    totalLayouts,
    successfulLayouts,
    failedLayouts,
    averageLayoutTime,
    averageRenderTime,
    averageOptimizationTime,
    totalErrors,
    totalConflicts,
    totalOverrides,
    getElements,
    getRules
} = useLayout(layoutOptions);

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

  // Handle elements click
  const handleElementsClick = useCallback(() => {
    if (onElementsClick) {
      onElementsClick();
  } else {
      setShowElementsDialog(true);
  }
}, [onElementsClick]);

  // Handle rules click
  const handleRulesClick = useCallback(() => {
    if (onRulesClick) {
      onRulesClick();
  } else {
      setShowRulesDialog(true);
  }
}, [onRulesClick]);

  // Handle alignment click
  const handleAlignmentClick = useCallback(() => {
    if (onAlignmentClick) {
      onAlignmentClick();
  } else {
      setShowAlignmentDialog(true);
  }
}, [onAlignmentClick]);

  // Handle responsive click
  const handleResponsiveClick = useCallback(() => {
    if (onResponsiveClick) {
      onResponsiveClick();
  } else {
      setShowResponsiveDialog(true);
  }
}, [onResponsiveClick]);

  // Handle create element
  const handleCreateElement = useCallback(async () => {
    try {
      const elementData: Partial<LayoutElement> = {
        type: 'container',
        element: document.createElement('div'),
        position: { x: 0, y: 0 },
        size: { width: 200, height: 200 },
        bounds: { minX: 0, maxX: 1000, minY: 0, maxY: 1000 },
        constraints: {
          minWidth: 50,
          maxWidth: 500,
          minHeight: 50,
          maxHeight: 500,
          maintainAspectRatio: false
        },
        layout: {
          type: 'flex',
          direction: 'row',
          wrap: 'nowrap',
          justifyContent: 'flex-start',
          alignItems: 'flex-start',
          alignContent: 'flex-start',
          gap: 10,
          padding: { top: 10, right: 10, bottom: 10, left: 10 },
          margin: { top: 0, right: 0, bottom: 0, left: 0 }
        },
        responsive: {
          breakpoints: {},
          mobile: {},
          tablet: {},
          desktop: {}
        }
      };
      await registerElement(elementData);
    } catch (error) {
      console.error('Failed to create element:', error);
    }
  }, [registerElement]);

  // Handle create rule
  const handleCreateRule = useCallback(async () => {
    try {
      const ruleData: Partial<LayoutRule> = {
        name: 'Custom Rule',
        description: 'A custom layout rule',
        condition: (element) => element.type === 'container',
        action: (element) => {
          element.layout.justifyContent = 'center';
          element.layout.alignItems = 'center';
    },
        priority:  1,
        enabled: true
  };
      await createRule(ruleData);
  } catch (error) {
      console.error('Failed to create rule:', error);
  }
}, [createRule]);

  // Get status color
  const getStatusColor = useCallback((): 'default' | 'error' | 'warning' | 'success' => {
    if (hasError) return 'error';
    if (!isInitialized) return 'warning';
    if (isEnabled) return 'success';
    return 'default';
}, [hasError, isInitialized, isEnabled]);

  // Get status icon
  const getStatusIcon = useCallback((): React.ReactElement => {
    if (hasError) return <Error fontSize="small" />;
    if (!isInitialized) return <CircularProgress size={16} />;
    if (isEnabled) return <ViewComfy />;
    return <Warning fontSize="small" />;
}, [hasError, isInitialized, isEnabled]);

  const getStatusTextColor = useCallback((): 'error.main' | 'warning.main' | 'success.main' | 'text.secondary' => {
    if (hasError) return 'error.main';
    if (!isInitialized) return 'warning.main';
    if (isEnabled) return 'success.main';
    return 'text.secondary';
  }, [hasError, isEnabled, isInitialized]);

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
    <Tooltip title={`Layout: ${getStatusText()}`}>
      <Chip
        icon={getStatusIcon()}
        label={totalElements}
        color={getStatusColor()}
        size="small"
        onClick={() => setShowLayoutDialog(true)}
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
          <Typography variant="body2" color={getStatusTextColor()}>
            {getStatusText()}
          </Typography>
        </Box>
        
        <Box display="flex" gap={1}>
          <IconButton size="small" onClick={() => setShowLayoutDialog(true)}>
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
            {totalElements} elements • {totalLayouts} layouts
          </Typography>
          {activeElements.length > 0 && (
            <Typography variant="caption" color="info.main" sx={{ ml:  1 }}>
              {activeElements.length} active
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
          <ViewComfy color="primary" />
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
            Layout
          </Typography>
        </Box>
        
        <Box display="flex" gap={1}>
          <Button
            startIcon={theming.getThemedIcon('add')}
            onClick={handleCreateElement}
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
                Total Elements
              </Typography>
              <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                {totalElements}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="subtitle2" gutterBottom>
                Layouts
              </Typography>
              <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                {totalLayouts}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="subtitle2" gutterBottom>
                Success Rate
              </Typography>
              <Typography variant="h4" color="success.main" sx={{ color: theming.colors.primary }}>
                {totalLayouts > 0 ? Math.round((successfulLayouts / totalLayouts) * 100) : 0}%
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
          Rules: {totalRules} • Auto Layout: {config.enableAutoLayout ? 'On' : 'Off'} • Responsive: {config.enableResponsive ? 'On' : 'Off'}
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

      {/* Layout Dialog */}
      <Dialog open={showLayoutDialog} onClose={() => setShowLayoutDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <ViewComfy />
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Layout Dashboard</Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
            <Tab label="Overview" />
            <Tab label="Elements" />
            <Tab label="Rules" />
            <Tab label="Alignment" />
            <Tab label="Responsive" />
            <Tab label="Monitoring" />
            <Tab label="Settings" />
          </Tabs>
          
          {activeTab === 0 && (
            <Grid container spacing={2} sx={{ mt:  2 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle2" gutterBottom>
                      Total Elements
                    </Typography>
                    <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                      {totalElements}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle2" gutterBottom>
                      Layouts
                    </Typography>
                    <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                      {totalLayouts}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle2" gutterBottom>
                      Success Rate
                    </Typography>
                    <Typography variant="h4" color="success.main" sx={{ color: theming.colors.primary }}>
                      {totalLayouts > 0 ? Math.round((successfulLayouts / totalLayouts) * 100) : 0}%
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
                Element Management
              </Typography>
              <List>
                {elements.map((element) => (
                  <ListItem key={element.id}>
                    <ListItemAvatar>
                      <Avatar>
                        <ViewComfy />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={element.type}
                      secondary={`${element.position.x}, ${element.position.y} • ${element.size.width}x${element.size.height} • ${element.layout.type}`}
                    />
                    <ListItemSecondaryAction>
                      <ButtonGroup size="small">
                        <Button
                          onClick={() => applyLayout(element.id)}
                          startIcon={theming.getThemedIcon('play')}
                        >
                          Apply
                        </Button>
                        <Button
                          onClick={() => setSelectedElement(element)}
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
                Rule Management
              </Typography>
              <List>
                {rules.map((rule) => (
                  <ListItem key={rule.id}>
                    <ListItemAvatar>
                      <Avatar>
                        {theming.getThemedIcon('settings')}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={rule.name}
                      secondary={`Priority: ${rule.priority} • ${rule.description}`}
                    />
                    <ListItemSecondaryAction>
                      <ButtonGroup size="small">
                        <Button
                          onClick={() => setSelectedRule(rule)}
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
                Alignment Settings
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Configure element alignment and positioning
              </Typography>
            </Box>
          )}
          
          {activeTab === 4 && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Responsive Settings
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Configure responsive layout behavior
              </Typography>
            </Box>
          )}
          
          {activeTab === 5 && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Performance Monitoring
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="subtitle2" gutterBottom>
                        Avg Layout Time
                      </Typography>
                      <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                        {averageLayoutTime.toFixed(2)}ms
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="subtitle2" gutterBottom>
                        Avg Render Time
                      </Typography>
                      <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                        {averageRenderTime.toFixed(2)}ms
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="subtitle2" gutterBottom>
                        Avg Optimization Time
                      </Typography>
                      <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                        {averageOptimizationTime.toFixed(2)}ms
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="subtitle2" gutterBottom>
                        Total Errors
                      </Typography>
                      <Typography variant="h4" color="error.main" sx={{ color: theming.colors.primary }}>
                        {totalErrors}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          )}
          
          {activeTab === 6 && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Layout Settings
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableLayout}
                        onChange={(e) => updateConfig({ enableLayout: e.target.checked })}
                      />
                  }
                    label="Enable Layout"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableAutoLayout}
                        onChange={(e) => updateConfig({ enableAutoLayout: e.target.checked })}
                      />
                  }
                    label="Enable Auto Layout"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableAlignment}
                        onChange={(e) => updateConfig({ enableAlignment: e.target.checked })}
                      />
                  }
                    label="Enable Alignment"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableSnapping}
                        onChange={(e) => updateConfig({ enableSnapping: e.target.checked })}
                      />
                  }
                    label="Enable Snapping"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableGrid}
                        onChange={(e) => updateConfig({ enableGrid: e.target.checked })}
                      />
                  }
                    label="Enable Grid"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableGuides}
                        onChange={(e) => updateConfig({ enableGuides: e.target.checked })}
                      />
                  }
                    label="Enable Guides"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableConstraints}
                        onChange={(e) => updateConfig({ enableConstraints: e.target.checked })}
                      />
                  }
                    label="Enable Constraints"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableResponsive}
                        onChange={(e) => updateConfig({ enableResponsive: e.target.checked })}
                      />
                  }
                    label="Enable Responsive"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableFlexbox}
                        onChange={(e) => updateConfig({ enableFlexbox: e.target.checked })}
                      />
                  }
                    label="Enable Flexbox"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableGridLayout}
                        onChange={(e) => updateConfig({ enableGridLayout: e.target.checked })}
                      />
                  }
                    label="Enable Grid Layout"
                  />
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setShowLayoutDialog(false)}>
            Close
          </Button>
          <Button onClick={handleCreateElement}
            variant="contained"
            startIcon={theming.getThemedIcon('add')}
           sx={theming.getThemedButtonSx()}>
            Create Element
          </Button>
        </DialogActions>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={showSettingsDialog} onClose={() => setShowSettingsDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            {theming.getThemedIcon('settings')}
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Layout Settings</Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableLayout}
                    onChange={(e) => updateConfig({ enableLayout: e.target.checked })}
                  />
              }
                label="Enable Layout"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableAutoLayout}
                    onChange={(e) => updateConfig({ enableAutoLayout: e.target.checked })}
                  />
              }
                label="Enable Auto Layout"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableAlignment}
                    onChange={(e) => updateConfig({ enableAlignment: e.target.checked })}
                  />
              }
                label="Enable Alignment"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableSnapping}
                    onChange={(e) => updateConfig({ enableSnapping: e.target.checked })}
                  />
              }
                label="Enable Snapping"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableGrid}
                    onChange={(e) => updateConfig({ enableGrid: e.target.checked })}
                  />
              }
                label="Enable Grid"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableGuides}
                    onChange={(e) => updateConfig({ enableGuides: e.target.checked })}
                  />
              }
                label="Enable Guides"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableConstraints}
                    onChange={(e) => updateConfig({ enableConstraints: e.target.checked })}
                  />
              }
                label="Enable Constraints"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableResponsive}
                    onChange={(e) => updateConfig({ enableResponsive: e.target.checked })}
                  />
              }
                label="Enable Responsive"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableFlexbox}
                    onChange={(e) => updateConfig({ enableFlexbox: e.target.checked })}
                  />
              }
                label="Enable Flexbox"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableGridLayout}
                    onChange={(e) => updateConfig({ enableGridLayout: e.target.checked })}
                  />
              }
                label="Enable Grid Layout"
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

LayoutDashboard.displayName ='LayoutDashboard';

export default LayoutDashboard;




