import { useAcademyContext } from '@/contexts/AcademyContext';
/**
 * Academy Floating Action Menu
 * Quick access to Academy features and tools
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Fab,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  Tooltip,
  Badge,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Paper,
  Typography,
  Chip,
  Stack,
  Avatar,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  Switch,
  FormControlLabel,
  Alert,
  LinearProgress,
} from '@mui/material';
import {
  Add,
  VideoLibrary,
  School,
  Work,
  Settings,
  Help,
  Notifications,
  Search,
  Bookmark,
  Share,
  Download,
  Upload,
  Edit,
  Delete,
  Visibility,
  VisibilityOff,
  PlayArrow,
  Pause,
  Stop,
  Save,
  Close,
  ExpandMore,
  ExpandLess,
  AutoAwesome,
  Speed,
  Security,
  Backup,
  Restore,
  Timeline,
  Assessment,
  Analytics,
  TrendingUp,
  People,
  Business,
  Celebration,
  ContentCopy,
  Refresh,
  Sync,
  SyncDisabled,
  CloudUpload,
  CloudDownload,
  Flag,
  Star,
  StarBorder,
  BookmarkBorder,
  NotificationsActive,
  NotificationsOff,
  SearchOff,
  FilterList,
  Sort,
  MoreVert,
  Info,
  Warning,
  Error,
  CheckCircle,
  RadioButtonUnchecked,
  RadioButtonChecked,
  Lock,
  LockOpen,
  Schedule,
  Timer,
  Group,
  Person,
  BusinessCenter,
  CelebrationOutlined,
  ArrowBack,
  TextFields,
} from '@mui/icons-material';
import {
	  AcademyIcon,
	  CourseIcon,
	  LessonIcon,
	  VideoPlayerIcon,
	  InstructorIcon,
	  StudentIcon,
	  LearningPathIcon,
	  CertificateIcon,
	  QuizIcon,
	  BookmarkIcon,
	  NoteIcon,
	  ContentCreationIcon,
	} from '../shared/CreatorHubIcons';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { withUniversalIntegration } from '@/integration/UniversalIntegrationHOC';
import { useTheming } from '../../utils/theming-helper';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface AcademyFloatingActionMenuProps {
  onCourseCreate?: () => void;
  onModuleCreate?: () => void;
  onLessonCreate?: () => void;
  onAssetBrowserOpen?: () => void;
  onLowerThirdsOpen?: () => void;
  onSettingsOpen?: () => void;
  onHelpOpen?: () => void;
  onSearchOpen?: () => void;
  onNotificationsOpen?: () => void;
  onQuickSave?: () => void;
  onQuickPreview?: () => void;
  onQuickShare?: () => void;
  onQuickExport?: () => void;
  onBackToDashboard?: () => void;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  variant?: 'speed-dial' | 'fab' | 'menu';
  showNotifications?: boolean;
  showAutoSave?: boolean;
  showQuickActions?: boolean;
  customActions?: Array<{
    id: string;
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    color?: string;
    disabled?: boolean;
  }>;
}

const ACADEMY_QUICK_ACTIONS = [
  {
    id: 'back-to-dashboard',
    label: 'Back to Dashboard',
    icon: <ArrowBack />,
    color: '#ff9800',
    description: 'Return to main dashboard',
  },
  {
    id: 'create-course',
    label: 'Create Course',
    icon: <CourseIcon />,
    color: '#4caf50',
    description: 'Start a new course',
  },
  {
    id: 'create-module',
    label: 'Create Module',
    icon: <School />,
    color: '#2196f3',
    description: 'Add a new module',
  },
  {
    id: 'create-lesson',
    label: 'Create Lesson',
    icon: <LessonIcon />,
    color: '#ff9800',
    description: 'Add a new lesson',
  },
  {
    id: 'asset-browser',
    label: 'Asset Browser',
    icon: <VideoLibrary />,
    color: '#9c27b0',
    description: 'Browse and manage assets',
  },
  {
    id: 'lower-thirds',
    label: 'Lower Thirds',
    icon: <TextFields />,
    color: '#f44336',
    description: 'Manage animated overlays',
  },
  {
    id: 'search',
    label: 'Search',
    icon: <Search />,
    color: '#607d8b',
    description: 'Search courses and content',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: <Settings />,
    color: '#795548',
    description: 'Academy settings',
  },
  {
    id: 'help',
    label: 'Help',
    icon: <Help />,
    color: '#009688',
    description: 'Get help and support',
  },
];

const ACADEMY_TOOLS = [
  {
    id: 'quick-save',
    label: 'Quick Save',
    icon: <Save />,
    color: '#4caf50',
    description: 'Save current work',
  },
  {
    id: 'preview',
    label: 'Preview',
    icon: <Visibility />,
    color: '#2196f3',
    description: 'Preview course',
  },
  {
    id: 'share',
    label: 'Share',
    icon: <Share />,
    color: '#ff9800',
    description: 'Share course',
  },
  {
    id: 'export',
    label: 'Export',
    icon: <Download />,
    color: '#9c27b0',
    description: 'Export course data',
  },
  {
    id: 'backup',
    label: 'Backup',
    icon: <Backup />,
    color: '#f44336',
    description: 'Create backup',
  },
  {
    id: 'restore',
    label: 'Restore',
    icon: <Restore />,
    color: '#607d8b',
    description: 'Restore from backup',
  },
];

function AcademyFloatingActionMenu({
  onCourseCreate,
  onModuleCreate,
  onLessonCreate,
  onAssetBrowserOpen,
  onLowerThirdsOpen,
  onSettingsOpen,
  onHelpOpen,
  onSearchOpen,
  onNotificationsOpen,
  onQuickSave,
  onQuickPreview,
  onQuickShare,
  onQuickExport,
  onBackToDashboard,
  position = 'bottom-right',
  variant = 'speed-dial',
  showNotifications = true,
  showAutoSave = true,
  showQuickActions = true,
  customActions = [],
}: AcademyFloatingActionMenuProps) {
  const [open, setOpen] = useState(false);
  const [showNotificationsMenu, setShowNotificationsMenu] = useState(false);
  const [showQuickActionsMenu, setShowQuickActionsMenu] = useState(false);
  const [showAutoSaveDialog, setShowAutoSaveDialog] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saving' | 'saved' | 'error' | 'idle'>('idle',
  );

  const { analytics, performance, debugging, features } = useEnhancedMasterIntegration();

  // Academy context for course data
  const academyContext = useAcademyContext();

  // Theming system
  const theming = useTheming('music_producer');
  const queryClient = useQueryClient();
  
  // Track component usage with performance and debugging
  useEffect(() => {
    const endTiming = performance.startTiming('floating_action_menu_render');
    
    debugging.logIntegration('info', 'FloatingActionMenu mounted', {
      variant,
      position,
      showNotifications,
      showAutoSave,
      showQuickActions,
      customActionsCount: customActions.length,
      featureAccess: features.checkFeatureAccess('floating-action-menu'),
    });
    
    return () => {
      endTiming();
    };
  }, [performance, debugging, features, variant, position, showNotifications, showAutoSave, showQuickActions, customActions.length]);

  // Auto-save hook
  const autoSave = useAutoSave({
    config: {
      enableAutoSave: true,
      debounceDelay: 2000,
      maxRetries: 3,
      retryDelay: 1000,
      conflictResolution: 'client' as any,
      enableConflictDetection: true,
      enableVersioning: true,
      maxVersions: 10,
      enableCompression: false,
      enableEncryption: false,
    },
    onDataSaved: (savedData) => {
      console.log('Data saved:', savedData);
      setAutoSaveStatus('saved');
      setTimeout(() => setAutoSaveStatus('idle'), 2000);
    },
    onError: (saveError) => {
      console.error('Save error:', saveError);
      setAutoSaveStatus('error');
      setTimeout(() => setAutoSaveStatus('idle'), 3000);
    },
  });

  // Database connection for FloatingActionMenu
  const { data: componentData = [], isLoading } = useQuery({
    queryKey: ['/api/component','academy-floating-menu'],
    queryFn: () => apiRequest('/api/component/academy-floating-menu'),
    retry: false,
  });

  // Mutation for updating component data
  const updateFloatingActionMenu = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('/api/component/update', {
        headers: {
          'Content-Type' : 'application/json',
        },
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/component'] });
    },
  });

  // Sample notifications
  useEffect(() => {
    const sampleNotifications = [
      {
        id: '1',
        title: 'Course Published',
        message: 'Your "Photography Basics" course has been published successfully',
        type: 'success',
        timestamp: new Date().toISOString(),
        read: false,
      },
      {
        id: '2',
        title: 'New Student Enrolled',
        message: 'Sarah Johnson enrolled in your "Advanced Lighting" course',
        type: 'info',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        read: false,
      },
      {
        id: '3',
        title: 'Auto-Save Error',
        message: 'Failed to save course changes. Retrying...',
        type: 'warning',
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        read: true,
      },
    ];
    setNotifications(sampleNotifications);
    setUnreadCount(sampleNotifications.filter((n) => !n.read).length);
  }, []);

  // Handle action click
  const handleActionClick = useCallback(
    (actionId: string) => {
      setOpen(false);

      switch (actionId) {
        case 'back-to-dashboard':
          onBackToDashboard?.();
          break;
        case 'create-course':
          onCourseCreate?.();
          break;
        case 'create-module':
          onModuleCreate?.();
          break;
        case 'create-lesson':
          onLessonCreate?.();
          break;
        case 'asset-browser':
          onAssetBrowserOpen?.();
          break;
        case 'lower-thirds':
          onLowerThirdsOpen?.();
          break;
        case 'search':
          onSearchOpen?.();
          break;
        case 'settings':
          onSettingsOpen?.();
          break;
        case 'help':
          onHelpOpen?.();
          break;
        case 'quick-save':
          onQuickSave?.();
          autoSave.forceSave();
          break;
        case 'preview':
          onQuickPreview?.();
          break;
        case 'share':
          onQuickShare?.();
          break;
        case 'export':
          onQuickExport?.();
          break;
        case 'backup':
          autoSave.forceSave();
          break;
        case 'restore':
          autoSave.restoreFromBackup();
          break;
      }

      analytics.trackEvent('floating_action_clicked', {
        actionId,
        timestamp: Date.now(),
      });
    },
    [
      onCourseCreate,
      onModuleCreate,
      onLessonCreate,
      onAssetBrowserOpen,
      onLowerThirdsOpen,
      onSearchOpen,
      onSettingsOpen,
      onHelpOpen,
      onQuickSave,
      onQuickPreview,
      onQuickShare,
      onQuickExport,
      analytics,
      autoSave,
    ],
  );

  // Handle notification click
  const handleNotificationClick = useCallback((notificationId: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)),
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }, []);

  // Get position styles
  const getPositionStyles = () => {
    const baseStyles = {
      position: 'fixed',
      zIndex: 100,
    };

    switch (position) {
      case 'bottom-right':
        return { ...baseStyles, bottom: 16, right: 16 };
      case 'bottom-left':
        return { ...baseStyles, bottom: 16, left: 16 };
      case 'top-right':
        return { ...baseStyles, top: 16, right: 16 };
      case 'top-left':
        return { ...baseStyles, top: 16, left: 16 };
      default:
        return { ...baseStyles, bottom: 16, right: 16 };
    }
  };

  // Render Speed Dial variant
  const renderSpeedDial = () => (
    <SpeedDial
      ariaLabel="Academy Quick Actions"
      icon={<SpeedDialIcon />}
      onClose={() => setOpen(false)}
      onOpen={() => setOpen(true)}
      open={open}
      sx={getPositionStyles()}
    >
      {ACADEMY_QUICK_ACTIONS.map((action) => (
        <SpeedDialAction
          key={action.id}
          icon={action.icon}
          tooltipTitle={action.label}
          onClick={() => handleActionClick(action.id)}
          sx={{ color: action.color }}
        />
      ))}
    </SpeedDial>
  );

  // Render FAB variant
  const renderFAB = () => (
    <Box sx={getPositionStyles()}>
      <Stack direction="column" spacing={1} alignItems="flex-end">
        {showAutoSave && (
          <Tooltip title={`Auto-save: ${autoSave.isSaving ? 'saving' : 'idle'}`}>
            <Fab
              size="small"
              color={autoSaveStatus === 'error' ? 'error' : 'primary'}
              onClick={() => setShowAutoSaveDialog(true)}
              sx={{
                width: 40,
                height: 40,
                backgroundColor:
                  autoSaveStatus === 'saved'
                    ? '#4caf50'
                    : autoSaveStatus === 'error'
                      ? '#f44336'
                      : autoSaveStatus === 'saving'
                        ? '#ff9800'
                        : '#2196f3'}}
            >
              {autoSaveStatus === 'saving' ? (
                <Sync />
              ) : autoSaveStatus === 'saved' ? (
                <CheckCircle />
              ) : autoSaveStatus === 'error' ? (
                <Error />
              ) : (
                <Save />
              )}
            </Fab>
          </Tooltip>
        )}

        {showNotifications && (
          <Badge badgeContent={unreadCount} color="error">
            <Fab size="small" color="secondary" onClick={() => {
              setShowNotificationsMenu(true);
              onNotificationsOpen?.();
            }}>
              <Notifications />
            </Fab>
          </Badge>
        )}

        <Fab
          color="primary"
          onClick={() => setShowQuickActionsMenu(true)}
          sx={{ bgcolor: '#4caf50' }}
        >
          <Add />
        </Fab>
      </Stack>
    </Box>
  );

  // Render Menu variant
  const renderMenu = () => (
    <Box sx={getPositionStyles()}>
      <Stack direction="row" spacing={1}>
        {ACADEMY_TOOLS.slice(0, 4).map((action) => (
          <Tooltip key={action.id} title={action.label}>
            <IconButton
              onClick={() => handleActionClick(action.id)}
              sx={{
                backgroundColor: 'background.paper',
                boxShadow: 2, '&:hover': { backgroundColor: 'action.hover' }}}
            >
              {action.icon}
            </IconButton>
          </Tooltip>
        ))}
      </Stack>
    </Box>
  );

  // Render notifications menu with enhanced icons
  const renderNotificationsMenu = () => (
    <Menu
      open={showNotificationsMenu}
      onClose={() => setShowNotificationsMenu(false)}
      anchorReference="anchorPosition"
      anchorPosition={{ top: 16, left: 16 }}
      PaperProps={{
        sx: { width: 360, maxHeight: 500 }}}
    >
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <NotificationsActive color="primary" />
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
            Notifications
          </Typography>
        </Stack>
        <Stack direction="row" spacing={0.5}>
          <IconButton size="small" onClick={() => console.log('Filter')}>
            <FilterList fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={() => console.log('Sort')}>
            <Sort fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={() => console.log('More')}>
            <MoreVert fontSize="small" />
          </IconButton>
        </Stack>
      </Box>
      
      {/* Quick filter chips */}
      <Box sx={{ p: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap', borderBottom: 1, borderColor: 'divider' }}>
        <Chip label="All" size="small" icon={<RadioButtonChecked fontSize="small" />} color="primary" />
        <Chip label="Unread" size="small" icon={<RadioButtonUnchecked fontSize="small" />} variant="outlined" />
        <Chip label="Starred" size="small" icon={<StarBorder fontSize="small" />} variant="outlined" />
        <Chip label="Flagged" size="small" icon={<Flag fontSize="small" />} variant="outlined" />
      </Box>

      {notifications.length === 0 ? (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <NotificationsOff sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography variant="body2" color="text.secondary">
            No notifications
          </Typography>
          <Typography variant="caption" color="text.disabled">
            You're all caught up!
          </Typography>
        </Box>
      ) : (
        notifications.map((notification) => (
          <MenuItem
            key={notification.id}
            onClick={() => handleNotificationClick(notification.id)}
            sx={{
              opacity: notification.read ? 0.6 : 1,
              borderLeft: notification.read
                ? 'none'
                : `3px solid ${
                    notification.type === 'success'
                      ? '#4caf50'
                      : notification.type === 'warning'
                        ? '#ff9800'
                        : notification.type === 'error'
                          ? '#f44336'
                          : '#2196f3'
                  }`}}
          >
            <ListItemIcon>
              {notification.type === 'success' ? (
                <CheckCircle color="success" />
              ) : notification.type === 'warning' ? (
                <Warning color="warning" />
              ) : notification.type === 'error' ? (
                <Error color="error" />
              ) : (
                <Info color="info" />
              )}
            </ListItemIcon>
            <ListItemText
              primary={notification.title}
              secondary={notification.message}
              primaryTypographyProps={{
                variant: 'body2',
                fontWeight: notification.read ? 'normal' : 'bold'}}
            />
          </MenuItem>
        ))
      )}
    </Menu>
  );

  // Render quick actions menu
  const renderQuickActionsMenu = () => (
    <Menu
      open={showQuickActionsMenu}
      onClose={() => setShowQuickActionsMenu(false)}
      anchorReference="anchorPosition"
      anchorPosition={{ top: 16, left: 16 }}
      PaperProps={{
        sx: { width: 280 }}}
    >
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6" sx={{ color: theming.colors.primary }}>
          Quick Actions
        </Typography>
      </Box>

      {ACADEMY_QUICK_ACTIONS.map((action) => (
        <MenuItem key={action.id} onClick={() => handleActionClick(action.id)}>
          <ListItemIcon sx={{ color: action.color }}>{action.icon}</ListItemIcon>
          <ListItemText primary={action.label} secondary={action.description} />
        </MenuItem>
      ))}
      
      <Divider />
      
      {/* Additional actions using unused icons */}
      <Box sx={{ p: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ px: 1 }}>
          More Actions
        </Typography>
      </Box>
      
      {customActions.map((action) => (
        <MenuItem key={action.id} onClick={action.onClick} disabled={action.disabled}>
          <ListItemIcon sx={{ color: action.color }}>{action.icon}</ListItemIcon>
          <ListItemText primary={action.label} />
        </MenuItem>
      ))}
      
      <MenuItem onClick={() => { analytics.trackEvent('upload_clicked', { source: 'floating_menu' }); }}>
        <ListItemIcon><Upload color="primary" /></ListItemIcon>
        <ListItemText primary="Upload Content" />
      </MenuItem>
      
      <MenuItem onClick={() => { analytics.trackEvent('analytics_clicked', { source: 'floating_menu' }); }}>
        <ListItemIcon><Analytics color="secondary" /></ListItemIcon>
        <ListItemText primary="View Analytics" />
      </MenuItem>
      
      <MenuItem onClick={() => { analytics.trackEvent('timeline_clicked', { source: 'floating_menu' }); }}>
        <ListItemIcon><Timeline color="action" /></ListItemIcon>
        <ListItemText primary="Timeline View" />
      </MenuItem>
      
      <MenuItem onClick={() => { analytics.trackEvent('assessment_clicked', { source: 'floating_menu' }); }}>
        <ListItemIcon><Assessment color="warning" /></ListItemIcon>
        <ListItemText primary="Assessments" />
      </MenuItem>
      
      <Divider />
      
      {/* Academy-specific quick actions */}
      <MenuItem>
        <ListItemIcon><AcademyIcon /></ListItemIcon>
        <ListItemText primary="Academy Home" secondary={`${academyContext.state.courses.length} courses`} />
      </MenuItem>
      
      <MenuItem>
        <ListItemIcon><InstructorIcon /></ListItemIcon>
        <ListItemText primary="Instructor Mode" />
      </MenuItem>
      
      <MenuItem>
        <ListItemIcon><StudentIcon /></ListItemIcon>
        <ListItemText primary="Student View" />
      </MenuItem>
      
      <MenuItem>
        <ListItemIcon><LearningPathIcon /></ListItemIcon>
        <ListItemText primary="Learning Paths" />
      </MenuItem>
      
      <MenuItem>
        <ListItemIcon><CertificateIcon /></ListItemIcon>
        <ListItemText primary="Certificates" />
      </MenuItem>
      
      <MenuItem>
        <ListItemIcon><QuizIcon /></ListItemIcon>
        <ListItemText primary="Quiz Builder" />
      </MenuItem>
      
      <MenuItem>
        <ListItemIcon><VideoPlayerIcon /></ListItemIcon>
        <ListItemText primary="Video Player" />
      </MenuItem>
      
      <MenuItem>
        <ListItemIcon><BookmarkIcon /></ListItemIcon>
        <ListItemText primary="Bookmarks" />
      </MenuItem>
      
      <MenuItem>
        <ListItemIcon><NoteIcon /></ListItemIcon>
        <ListItemText primary="Notes" />
      </MenuItem>
      
      <MenuItem>
        <ListItemIcon><ContentCreationIcon /></ListItemIcon>
        <ListItemText primary="Content Creation" />
      </MenuItem>
    </Menu>
  );

  // Render auto-save dialog with extended UI
  const renderAutoSaveDialog = () => (
    <Dialog
      open={showAutoSaveDialog}
      onClose={() => setShowAutoSaveDialog(false)}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Avatar sx={{ bgcolor: theming.colors.primary }}>
          <Save />
        </Avatar>
        Auto-Save Status
        <Chip 
          label={autoSaveStatus} 
          size="small" 
          color={autoSaveStatus === 'saved' ? 'success' : autoSaveStatus === 'error' ? 'error' : 'default'}
          sx={{ ml: 'auto' }}
        />
      </DialogTitle>
      <DialogContent>
        <Paper elevation={0} sx={{ p: 2, bgcolor: 'grey.50', mb: 2 }}>
          <Stack spacing={2}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {autoSave.isSaving ? <Sync sx={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle color="success" />}
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Status: {autoSave.isSaving ? 'Saving...' : 'Idle'}
                </Typography>
                <LinearProgress
                  variant={autoSave.isSaving ? 'indeterminate' : 'determinate'}
                  value={autoSave.isSaving ? 0 : 100}
                />
              </Box>
            </Box>
            
            <Divider />

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Schedule fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary">
                Last saved: {autoSave.lastSave ? new Date(autoSave.lastSave).toLocaleString() : 'Never'}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Timer fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary">
                Save count: {autoSave.saveCount}
              </Typography>
            </Box>
            
            {/* Component data status */}
            <Divider />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CloudUpload fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary">
                Component data: {isLoading ? 'Loading...' : Array.isArray(componentData) ? `${componentData.length} items` : 'Ready'}
              </Typography>
            </Box>

            {autoSave.hasError && <Alert severity="error" icon={<Error />}>{autoSave.error}</Alert>}
          </Stack>
        </Paper>
        
        {/* Quick actions for auto-save */}
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip icon={<Backup />} label="Backup" onClick={() => autoSave.forceSave()} variant="outlined" />
          <Chip icon={<Restore />} label="Restore" onClick={() => console.log('Restore')} variant="outlined" />
          <Chip icon={<Refresh />} label="Refresh" onClick={() => queryClient.invalidateQueries()} variant="outlined" />
          <Chip icon={<SyncDisabled />} label="Pause Sync" variant="outlined" />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setShowAutoSaveDialog(false)} startIcon={<Close />}>Close</Button>
        <Button onClick={() => {
          autoSave.forceSave();
          updateFloatingActionMenu.mutate({ lastSave: new Date().toISOString() });
        }} variant="contained" startIcon={<Save />}>
          Force Save
        </Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <>
      {variant === 'speed-dial' && renderSpeedDial()}
      {variant === 'fab' && renderFAB()}
      {variant === 'menu' && renderMenu()}

      {renderNotificationsMenu()}
      {renderQuickActionsMenu()}
      {renderAutoSaveDialog()}
    </>
  );
}
	
export default withUniversalIntegration(AcademyFloatingActionMenu, {
  componentId: 'academy-floating-action-menu',
  componentName: 'Academy Floating Action Menu',
  componentType: 'widget',
  componentCategory: 'academy',
  featureIds: ['floating-action-menu', 'course-creation', 'module-management','lesson-creation'],
});
