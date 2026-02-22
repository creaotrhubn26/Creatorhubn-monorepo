/**
 * DragDropDashboard Component
 * Drag and drop dashboard with management and monitoring
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
  DragIndicator,
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
  DragHandle,
  OpenWith,
  SwapHoriz,
  SwapVert,
  SwapHorizontalCircle,
  SwapVerticalCircle,
  CompareArrows,
  CompareArrowsOutlined,
  CompareArrowsRounded,
  CompareArrowsSharp,
  CompareArrowsTwoTone,
  CompareArrows as CompareArrowsIcon,
  CompareArrowsOutlined as CompareArrowsOutlinedIcon,
  CompareArrowsRounded as CompareArrowsRoundedIcon,
  CompareArrowsSharp as CompareArrowsSharpIcon,
  CompareArrowsTwoTone as CompareArrowsTwoToneIcon,
} from '@mui/icons-material';
import { useDragDrop, UseDragDropOptions } from '../../../hooks/useDragDrop';
import { DragDropConfig, DragItem, DropZone } from '../../../utils/dragDropManager';

interface DragDropDashboardProps {
  showDetails?: boolean;
  showSettings?: boolean;
  showManagement?: boolean;
  showMonitoring?: boolean;
  showDragItems?: boolean;
  showDropZones?: boolean;
  showAnimations?: boolean;
  showValidation?: boolean;
  variant?: 'minimal' | 'detailed' | 'full';
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center';
  onSettingsClick?: () => void;
  onManagementClick?: () => void;
  onMonitoringClick?: () => void;
  onDragItemsClick?: () => void;
  onDropZonesClick?: () => void;
  onAnimationsClick?: () => void;
  onValidationClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

const DragDropDashboard: React.FC<DragDropDashboardProps> = memo(({
  showDetails = true,
  showSettings = true,
  showManagement = true,
  showMonitoring = true,
  showDragItems = true,
  showDropZones = true,
  showAnimations = true,
  showValidation = true,
  variant = 'minimal',
  position = 'top-right',
  onSettingsClick,
  onManagementClick,
  onMonitoringClick,
  onDragItemsClick,
  onDropZonesClick,
  onAnimationsClick,
  onValidationClick,
  className,
  style
}) => {
  const [showDragDropDialog, setShowDragDropDialog] = useState(false);
  
  // Theming system
  const theming = useTheming('prototype_tester');
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showManagementDialog, setShowManagementDialog] = useState(false);
  const [showMonitoringDialog, setShowMonitoringDialog] = useState(false);
  const [showDragItemsDialog, setShowDragItemsDialog] = useState(false);
  const [showDropZonesDialog, setShowDropZonesDialog] = useState(false);
  const [showAnimationsDialog, setShowAnimationsDialog] = useState(false);
  const [showValidationDialog, setShowValidationDialog] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedDragItem, setSelectedDragItem] = useState<DragItem | null>(null);
  const [selectedDropZone, setSelectedDropZone] = useState<DropZone | null>(null);

  // Drag drop options
  const dragDropOptions: UseDragDropOptions = useMemo(() => ({
    onDragItemRegistered: (_data: { item: DragItem }) => {
      setPage(0);
  },
    onDropZoneRegistered: (_data: { zone: DropZone }) => {
      setPage(0);
  },
    onDragStarted: (_data: { item: DragItem; event: DragEvent | TouchEvent }) => {
      setSelectedDragItem(_data.item);
  },
    onDragEnded: (_data: { item: DragItem; event: DragEvent | TouchEvent }) => {
      setSelectedDragItem(null);
  },
    onDragOver: (_data: { item: DragItem; zone: DropZone; event: DragEvent }) => {
      setSelectedDropZone(_data.zone);
  },
    onDropSuccessful: (_data: { item: DragItem; zone: DropZone; event: DragEvent }) => {
      setFilterType('all');
      setPage(0);
  },
    onDropRejected: (_data: { item: DragItem; zone: DropZone; event: DragEvent }) => {
      setPage(0);
  },
    onDropFailed: (data: { item: DragItem; zone: DropZone; event: DragEvent; error: string }) => {
      console.error('Drop failed: ', data.error);
  },
    onError: (error: string) => {
      console.error('Drag drop error:', error);
  },
    onInitialized: () => {
      setFilterType('all');
      setPage(0);
}
}), []);

  // Use drag drop hook
  const {
    registerDragItem,
    registerDropZone,
    startDrag,
    endDrag,
    state,
    config,
    updateConfig,
    isEnabled,
    isInitialized,
    hasError,
    error,
    isDragging,
    isDropping,
    dragItem,
    dropZone,
    dragItems,
    dropZones,
    totalDrags,
    totalDrops,
    successfulDrops,
    failedDrops,
    averageDragTime,
    averageDropTime,
    averageAnimationTime,
    totalErrors,
    totalCollisions,
    totalValidations,
    getDragItems,
    getDropZones
} = useDragDrop(dragDropOptions);

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

  // Handle drag items click
  const handleDragItemsClick = useCallback(() => {
    if (onDragItemsClick) {
      onDragItemsClick();
  } else {
      setShowDragItemsDialog(true);
  }
}, [onDragItemsClick]);

  // Handle drop zones click
  const handleDropZonesClick = useCallback(() => {
    if (onDropZonesClick) {
      onDropZonesClick();
  } else {
      setShowDropZonesDialog(true);
  }
}, [onDropZonesClick]);

  // Handle animations click
  const handleAnimationsClick = useCallback(() => {
    if (onAnimationsClick) {
      onAnimationsClick();
  } else {
      setShowAnimationsDialog(true);
  }
}, [onAnimationsClick]);

  // Handle validation click
  const handleValidationClick = useCallback(() => {
    if (onValidationClick) {
      onValidationClick();
  } else {
      setShowValidationDialog(true);
  }
}, [onValidationClick]);

  // Handle create drag item
  const handleCreateDragItem = useCallback(async () => {
    try {
      const itemData: Partial<DragItem> = {
        type: 'custom',
        data: { name: 'Custom Drag Item',},
        element: document.createElement(', '),
        position: { x: 0, y:  0 },
        size: { width: 10, height: 100,},
        bounds: { minX: 0, maxX: 100, minY: 0, maxY: 1000,},
        constraints: {
          horizontal: true,
          vertical: true,
          rotation: false,
          scaling: false
    }
    };
      await registerDragItem(itemData);
  } catch (error) {
      console.error('Failed to create drag item:', error);
  }
}, [registerDragItem]);

  // Handle create drop zone
  const handleCreateDropZone = useCallback(async () => {
    try {
      const zoneData: Partial<DropZone> = {
        type: 'custom',
        element: document.createElement(', '),
        position: { x: 0, y:  0 },
        size: { width: 20, height: 200,},
        bounds: { minX: 0, maxX: 100, minY: 0, maxY: 1000,},
        acceptTypes: ['*', ],
        acceptItems: ['*', ],
        rejectItems:  [],
        validation: () => true,
        onDrop: () =>, {},
        onDragEnter: () =>, {},
        onDragLeave: () =>, {},
        onDragOver: () =>, {}
    };
      await registerDropZone(zoneData);
  } catch (error) {
      console.error('Failed to create drop zone:', error);
  }
}, [registerDropZone]);

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
    if (isEnabled) return <DragIndicator />;
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
    <Tooltip title={`Drag Drop: ${getStatusText()}`}>
      <Chip
        icon={getStatusIcon()}
        label={totalDrags}
        color={getStatusColor()}
        size="small"
        onClick={() => setShowDragDropDialog(true)}
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
          <IconButton size="small" onClick={() => setShowDragDropDialog(true)}>
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
            {totalDrags} drags • {totalDrops} drops
          </Typography>
          {isDragging && (
            <Typography variant="caption" color="info.main" sx={{ ml:  1 }}>
              Dragging
            </Typography>
          )}
          {isDropping && (
            <Typography variant="caption" color="warning.main" sx={{ ml:  1 }}>
              Dropping
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
          <DragIndicator color="primary" />
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
            Drag & Drop
          </Typography>
        </Box>
        
        <Box display="flex" gap={1}>
          <Button
            startIcon={theming.getThemedIcon('add')}
            onClick={handleCreateDragItem}
            variant="outlined"
            size="small"
          >
            Create Item
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
                Total Drags
              </Typography>
              <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                {totalDrags}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid size={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="subtitle2" gutterBottom>
                Total Drops
              </Typography>
              <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                {totalDrops}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid size={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="subtitle2" gutterBottom>
                Success Rate
              </Typography>
              <Typography variant="h4" color="success.main" sx={{ color: theming.colors.primary }}>
                {totalDrops > 0 ? Math.round((successfulDrops / totalDrops) * 100) : 0}%
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
          Drag items: {dragItems.length} • Drop zones: {dropZones.length} • Animations: {config.enableAnimations ? 'On' : 'Off'}
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

      {/* Drag Drop Dialog */}
      <Dialog open={showDragDropDialog} onClose={() => setShowDragDropDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <DragIndicator />
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Drag & Drop Dashboard</Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
            <Tab label="Overview" />
            <Tab label="Drag Items" />
            <Tab label="Drop Zones" />
            <Tab label="Animations" />
            <Tab label="Validation" />
            <Tab label="Monitoring" />
            <Tab label="Settings" />
          </Tabs>
          
          {activeTab === 0 && (
            <Grid container spacing={2} sx={{ mt:  2 }}>
              <Grid size={{ xs:  12, sm:  6, md:  3 }}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle2" gutterBottom>
                      Total Drags
                    </Typography>
                    <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                      {totalDrags}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid size={{ xs:  12, sm:  6, md:  3 }}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle2" gutterBottom>
                      Total Drops
                    </Typography>
                    <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                      {totalDrops}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid size={{ xs:  12, sm:  6, md:  3 }}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle2" gutterBottom>
                      Success Rate
                    </Typography>
                    <Typography variant="h4" color="success.main" sx={{ color: theming.colors.primary }}>
                      {totalDrops > 0 ? Math.round((successfulDrops / totalDrops) * 100) : 0}%
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
                Drag Item Management
              </Typography>
              <List>
                {dragItems.map((item) => (
                  <ListItem key={item.id}>
                    <ListItemAvatar>
                      <Avatar>
                        <DragIndicator />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={item.type}
                      secondary={`${item.position.x}, ${item.position.y} • ${item.size.width}x${item.size.height}`}
                    />
                    <ListItemSecondaryAction>
                      <ButtonGroup size="small">
                        <Button
                          onClick={() => setSelectedDragItem(item)}
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
                Drop Zone Management
              </Typography>
              <List>
                {dropZones.map((zone) => (
                  <ListItem key={zone.id}>
                    <ListItemAvatar>
                      <Avatar>
                        <OpenWith />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={zone.type}
                      secondary={`${zone.position.x}, ${zone.position.y} • ${zone.size.width}x${zone.size.height}`}
                    />
                    <ListItemSecondaryAction>
                      <ButtonGroup size="small">
                        <Button
                          onClick={() => setSelectedDropZone(zone)}
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
                Animation Settings
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Configure drag and drop animations
              </Typography>
            </Box>
          )}
          
          {activeTab === 4 && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Validation Settings
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Configure drag and drop validation
              </Typography>
            </Box>
          )}
          
          {activeTab === 5 && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Performance Monitoring
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs:  12, sm:  6, md:  3 }}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="subtitle2" gutterBottom>
                        Avg Drag Time
                      </Typography>
                      <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                        {averageDragTime.toFixed(2)}ms
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid size={{ xs:  12, sm:  6, md:  3 }}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="subtitle2" gutterBottom>
                        Avg Drop Time
                      </Typography>
                      <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                        {averageDropTime.toFixed(2)}ms
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid size={{ xs:  12, sm:  6, md:  3 }}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="subtitle2" gutterBottom>
                        Avg Animation Time
                      </Typography>
                      <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                        {averageAnimationTime.toFixed(2)}ms
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid size={{ xs:  12, sm:  6, md:  3 }}>
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
                Drag & Drop Settings
              </Typography>
              <Grid container spacing={2}>
                <Grid size={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableDragDrop}
                        onChange={(e) => updateConfig({ enableDragDrop: e.target.checked })}
                      />
                  }
                    label="Enable Drag Drop"
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
                
                <Grid size={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableSmoothAnimations}
                        onChange={(e) => updateConfig({ enableSmoothAnimations: e.target.checked })}
                      />
                  }
                    label="Enable Smooth Animations"
                  />
                </Grid>
                
                <Grid size={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableDragPreview}
                        onChange={(e) => updateConfig({ enableDragPreview: e.target.checked })}
                      />
                  }
                    label="Enable Drag Preview"
                  />
                </Grid>
                
                <Grid size={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableDropZones}
                        onChange={(e) => updateConfig({ enableDropZones: e.target.checked })}
                      />
                  }
                    label="Enable Drop Zones"
                  />
                </Grid>
                
                <Grid size={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableDragHandles}
                        onChange={(e) => updateConfig({ enableDragHandles: e.target.checked })}
                      />
                  }
                    label="Enable Drag Handles"
                  />
                </Grid>
                
                <Grid size={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableTouchSupport}
                        onChange={(e) => updateConfig({ enableTouchSupport: e.target.checked })}
                      />
                  }
                    label="Enable Touch Support"
                  />
                </Grid>
                
                <Grid size={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableKeyboardSupport}
                        onChange={(e) => updateConfig({ enableKeyboardSupport: e.target.checked })}
                      />
                  }
                    label="Enable Keyboard Support"
                  />
                </Grid>
                
                <Grid size={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableAccessibility}
                        onChange={(e) => updateConfig({ enableAccessibility: e.target.checked })}
                      />
                  }
                    label="Enable Accessibility"
                  />
                </Grid>
                
                <Grid size={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableAutoScroll}
                        onChange={(e) => updateConfig({ enableAutoScroll: e.target.checked })}
                      />
                  }
                    label="Enable Auto Scroll"
                  />
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setShowDragDropDialog(false)}>
            Close
          </Button>
          <Button onClick={handleCreateDragItem}
            variant="contained"
            startIcon={theming.getThemedIcon('add')}
           sx={theming.getThemedButtonSx()}>
            Create Item
          </Button>
        </DialogActions>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={showSettingsDialog} onClose={() => setShowSettingsDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            {theming.getThemedIcon('settings')}
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Drag & Drop Settings</Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Grid container spacing={2}>
            <Grid size={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableDragDrop}
                    onChange={(e) => updateConfig({ enableDragDrop: e.target.checked })}
                  />
              }
                label="Enable Drag Drop"
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
            
            <Grid size={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableSmoothAnimations}
                    onChange={(e) => updateConfig({ enableSmoothAnimations: e.target.checked })}
                  />
              }
                label="Enable Smooth Animations"
              />
            </Grid>
            
            <Grid size={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableDragPreview}
                    onChange={(e) => updateConfig({ enableDragPreview: e.target.checked })}
                  />
              }
                label="Enable Drag Preview"
              />
            </Grid>
            
            <Grid size={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableDropZones}
                    onChange={(e) => updateConfig({ enableDropZones: e.target.checked })}
                  />
              }
                label="Enable Drop Zones"
              />
            </Grid>
            
            <Grid size={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableDragHandles}
                    onChange={(e) => updateConfig({ enableDragHandles: e.target.checked })}
                  />
              }
                label="Enable Drag Handles"
              />
            </Grid>
            
            <Grid size={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableTouchSupport}
                    onChange={(e) => updateConfig({ enableTouchSupport: e.target.checked })}
                  />
              }
                label="Enable Touch Support"
              />
            </Grid>
            
            <Grid size={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableKeyboardSupport}
                    onChange={(e) => updateConfig({ enableKeyboardSupport: e.target.checked })}
                  />
              }
                label="Enable Keyboard Support"
              />
            </Grid>
            
            <Grid size={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableAccessibility}
                    onChange={(e) => updateConfig({ enableAccessibility: e.target.checked })}
                  />
              }
                label="Enable Accessibility"
              />
            </Grid>
            
            <Grid size={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableAutoScroll}
                    onChange={(e) => updateConfig({ enableAutoScroll: e.target.checked })}
                  />
              }
                label="Enable Auto Scroll"
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

DragDropDashboard.displayName ='DragDropDashboard';

export default DragDropDashboard;





