/**
 * CollaborationDashboard Component
 * Real-time collaboration dashboard with conflict resolution
 */

import { useTheming } from '../../../utils/theming-helper';
import React, { memo, useCallback, useState, useEffect } from 'react';
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
} from '@mui/material';
import {
  People,
  Person,
  PersonAdd,
  PersonRemove,
  Edit,
  Visibility,
  Comment,
  History as VersionControl,
  Security,
  Notifications,
  Sync,
  SyncProblem,
  CloudOff,
  CloudDone,
  CloudSync,
  Warning as Conflict,
  CheckCircle as Resolve,
  Queue,
  Timeline,
  BarChart,
  PieChart,
  ShowChart,
  Download,
  Upload,
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
  Public as Globe,
  Book,
  School,
  Work,
  Home,
  Group,
  PublicOff,
  Public as PublicOn,
  Settings,
  Refresh,
  CheckCircle,
  Error,
  Info,
  Warning,
} from '@mui/icons-material';
import { useCollaboration, UseCollaborationOptions } from '../../../hooks/useCollaboration';
import { CollaborationConfig, Collaborator, ConflictResolution } from '../../../utils/collaborationManager';

interface CollaborationDashboardProps {
  showDetails?: boolean;
  showSettings?: boolean;
  showConflicts?: boolean;
  showCursors?: boolean;
  showComments?: boolean;
  showVersions?: boolean;
  showPermissions?: boolean;
  showNotifications?: boolean;
  variant?: 'minimal' | 'detailed' | 'full';
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center';
  onSettingsClick?: () => void;
  onConflictClick?: () => void;
  onCursorClick?: () => void;
  onCommentClick?: () => void;
  onVersionClick?: () => void;
  onPermissionClick?: () => void;
  onNotificationClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

const CollaborationDashboard: React.FC<CollaborationDashboardProps> = memo(({
  showDetails = true,
  showSettings = true,
  showConflicts = true,
  showCursors = true,
  showComments = true,
  showVersions = true,
  showPermissions = true,
  showNotifications = true,
  variant = 'minimal',
  position = 'top-right',
  onSettingsClick,
  onConflictClick,
  onCursorClick,
  onCommentClick,
  onVersionClick,
  onPermissionClick,
  onNotificationClick,
  className,
  style
}) => {
  const [showCollaborationDialog, setShowCollaborationDialog] = useState(false);
  
  // Theming system
  const theming = useTheming('prototype_tester');
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showConflictsDialog, setShowConflictsDialog] = useState(false);
  const [showCursorsDialog, setShowCursorsDialog] = useState(false);
  const [showCommentsDialog, setShowCommentsDialog] = useState(false);
  const [showVersionsDialog, setShowVersionsDialog] = useState(false);
  const [showPermissionsDialog, setShowPermissionsDialog] = useState(false);
  const [showNotificationsDialog, setShowNotificationsDialog] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('timestamp');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Collaboration options
  const collaborationOptions: UseCollaborationOptions = useMemo(() => ({
    onConnected: (_data: { user: Collaborator }) => {
      setFilterType('all');
      setPage(0);
  },
    onDisconnected: () => {
      setFilterType('all');
},
    onReconnecting: () => {
      setFilterType('all');
},
    onReconnected: () => {
      setPage(0);
},
    onEventSent: (_event: Record<string, unknown>) => {
      setPage(0);
},
    onEventReceived: (_event: Record<string, unknown>) => {
      setPage(0);
},
    onCursorUpdated: (_data: { userId: string; cursor: Record<string, unknown> }) => {
      setShowCursorsDialog(true);
  },
    onPresenceUpdated: (_data: { userId: string; presence: Record<string, unknown> }) => {
      setPage(0);
  },
    onCommentUpdated: (_data: { elementId: string; comment: Record<string, unknown> }) => {
      setShowCommentsDialog(true);
  },
    onVersionUpdated: (_data: { projectId: string; version: Record<string, unknown> }) => {
      setShowVersionsDialog(true);
  },
    onPermissionUpdated: (_data: { userId: string; permission: Record<string, unknown> }) => {
      setShowPermissionsDialog(true);
  },
    onNotificationUpdated: (_data: { userId: string; notification: Record<string, unknown> }) => {
      setShowNotificationsDialog(true);
  },
    onConflictDetected: (_conflict: ConflictResolution) => {
      setShowConflictsDialog(true);
      setFilterType('conflicts');
},
    onConflictResolved: (_conflict: ConflictResolution) => {
      setFilterType('all');
      setPage(0);
},
    onSyncCompleted: (_data: { data: unknown }) => {
      setFilterType('all');
      setPage(0);
  },
    onOfflineSyncCompleted: (_data: { count: number }) => {
      setPage(0);
  },
    onError: (error: string) => {
      console.error('Collaboration error:', error);
  },
    onInitialized: () => {
      setFilterType('all');
      setPage(0);
}
}), []);

  // Use collaboration hook
  const {
    connect,
    disconnect,
    sendEvent,
    handleIncomingEvent,
    resolveConflict,
    state,
    config,
    updateConfig,
    isEnabled,
    isConnected,
    isReconnecting,
    hasError,
    error,
    collaborators,
    currentUser,
    activeCursors,
    activeComments,
    activeVersions,
    activePermissions,
    activeNotifications,
    offlineQueue,
    conflictQueue,
    lastSync,
    connectionCount,
    messageCount,
    errorCount,
    conflictCount
} = useCollaboration(collaborationOptions);

  // Handle settings click
  const handleSettingsClick = useCallback(() => {
    if (onSettingsClick) {
      onSettingsClick();
  } else {
      setShowSettingsDialog(true);
  }
}, [onSettingsClick]);

  // Handle conflict click
  const handleConflictClick = useCallback(() => {
    if (onConflictClick) {
      onConflictClick();
  } else {
      setShowConflictsDialog(true);
  }
}, [onConflictClick]);

  // Handle cursor click
  const handleCursorClick = useCallback(() => {
    if (onCursorClick) {
      onCursorClick();
  } else {
      setShowCursorsDialog(true);
  }
}, [onCursorClick]);

  // Handle comment click
  const handleCommentClick = useCallback(() => {
    if (onCommentClick) {
      onCommentClick();
  } else {
      setShowCommentsDialog(true);
  }
}, [onCommentClick]);

  // Handle version click
  const handleVersionClick = useCallback(() => {
    if (onVersionClick) {
      onVersionClick();
  } else {
      setShowVersionsDialog(true);
  }
}, [onVersionClick]);

  // Handle permission click
  const handlePermissionClick = useCallback(() => {
    if (onPermissionClick) {
      onPermissionClick();
  } else {
      setShowPermissionsDialog(true);
  }
}, [onPermissionClick]);

  // Handle notification click
  const handleNotificationClick = useCallback(() => {
    if (onNotificationClick) {
      onNotificationClick();
  } else {
      setShowNotificationsDialog(true);
  }
}, [onNotificationClick]);

  // Handle connect
  const handleConnect = useCallback(async () => {
    const user: Collaborator = {
      id: 'user_' + Date.now(),
      name: 'Current User',
      email: 'user@example.com',
      role: 'editor',
      permissions: ['read', 'write', 'comment'],
      isOnline: true,
      lastSeen: Date.now()
};
    await connect(user);
}, [connect]);

  // Handle disconnect
  const handleDisconnect = useCallback(async () => {
    await disconnect();
}, [disconnect]);

  // Handle conflict resolution
  const handleConflictResolution = useCallback(async (conflictId: string, resolution: 'client' | 'server' | 'merge' | 'manual') => {
    await resolveConflict(conflictd, resolution);
}, [resolveConflict]);

  // Get status color
  const getStatusColor = useCallback(() => {
    if (hasError) return 'error';
    if (isReconnecting) return 'warning';
    if (isConnected) return 'success';
    return 'default';
}, [hasError, isReconnecting, isConnected]);

  // Get status icon
  const getStatusIcon = useCallback(() => {
    if (hasError) return theming.getThemedIcon('error');
    if (isReconnecting) return <CircularProgress size={16} />;
    if (isConnected) return theming.getThemedIcon('people');
    return theming.getThemedIcon('person');
}, [hasError, isReconnecting, isConnected]);

  // Get status text
  const getStatusText = useCallback(() => {
    if (hasError) return 'Error';
    if (isReconnecting) return 'Reconnecting...';
    if (isConnected) return 'Connected';
    return 'Disconnected';
}, [hasError, isReconnecting, isConnected]);

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
    <Tooltip title={`Collaboration: ${getStatusText()}`}>
      <Chip
        icon={getStatusIcon()}
        label={collaborators.length}
        color={getStatusColor()}
        size="small"
        onClick={() => setShowCollaborationDialog(true)}
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
          <IconButton size="small" onClick={() => setShowCollaborationDialog(true)}>
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
            {collaborators.length} users
          </Typography>
          {conflictCount > 0 && (
            <Typography variant="caption" color="error.main" sx={{ ml:  1 }}>
              {conflictCount} conflicts
            </Typography>
          )}
          {offlineQueue.length > 0 && (
            <Typography variant="caption" color="warning.main" sx={{ ml:  1 }}>
              {offlineQueue.length} queued
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
          <People color="primary" />
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
            Collaboration
          </Typography>
        </Box>
        
        <Box display="flex" gap={1}>
          <Button
            startIcon={theming.getThemedIcon('people')}
            onClick={isConnected ? handleDisconnect : handleConnect}
            variant="outlined"
            size="small"
          >
            {isConnected ? 'Disconnect' : 'Connect'}
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
                Collaborators
              </Typography>
              <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                {collaborators.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="subtitle2" gutterBottom>
                Conflicts
              </Typography>
              <Typography variant="h4" color={conflictCount  sx={{ color: theming.colors.primary }}> 0 ? 'error' : 'text.secondary'}>
                {conflictCount}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="subtitle2" gutterBottom>
                Messages
              </Typography>
              <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                {messageCount}
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
      
      {lastSync > 0 && (
        <Box mt={2}>
          <Typography variant="caption" color="text.secondary">
            Last sync: {new Date(lastSync).toLocaleString()}
          </Typography>
        </Box>
      )}
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

      {/* Collaboration Dialog */}
      <Dialog open={showCollaborationDialog} onClose={() => setShowCollaborationDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            {theming.getThemedIcon('people')}
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Collaboration Dashboard</Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
            <Tab label="Overview" />
            <Tab label="Collaborators" />
            <Tab label="Conflicts" />
            <Tab label="Cursors" />
            <Tab label="Comments" />
            <Tab label="Versions" />
            <Tab label="Permissions" />
            <Tab label="Notifications" />
          </Tabs>
          
          {activeTab === 0 && (
            <Grid container spacing={2} sx={{ mt:  2 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle2" gutterBottom>
                      Collaborators
                    </Typography>
                    <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                      {collaborators.length}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle2" gutterBottom>
                      Conflicts
                    </Typography>
                    <Typography variant="h4" color={conflictCount  sx={{ color: theming.colors.primary }}> 0 ? 'error' : 'text.secondary'}>
                      {conflictCount}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle2" gutterBottom>
                      Messages
                    </Typography>
                    <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                      {messageCount}
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
                Collaborators
              </Typography>
              <List>
                {collaborators.map((collaborator) => (
                  <ListItem key={collaborator.id}>
                    <ListItemAvatar>
                      <Avatar>
                        {collaborator.name.charAt(0)}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={collaborator.name}
                      secondary={`${collaborator.role} • ${collaborator.isOnline ? 'Online' : 'Offline'}`}
                    />
                    <ListItemSecondaryAction>
                      <Chip
                        label={collaborator.role}
                        size="small"
                        color={collaborator.isOnline ? 'success' : 'default'}
                      />
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
          
          {activeTab === 2 && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Conflicts
              </Typography>
              {conflictQueue.length === 0 ? (
                <Typography color="text.secondary">No conflicts</Typography>
              ) : (
                <List>
                  {conflictQueue.map((conflict) => (
                    <ListItem key={conflict.id}>
                      <ListItemText
                        primary={`${conflict.type} conflict`}
                        secondary={`${conflict.userId} • ${new Date(conflict.timestamp).toLocaleString()}`}
                      />
                      <ListItemSecondaryAction>
                        <ButtonGroup size="small">
                          <Button onClick={() => handleConflictResolution(conflict.id'client')}>
                            Client
                          </Button>
                          <Button onClick={() => handleConflictResolution(conflict.id'server')}>
                            Server
                          </Button>
                          <Button onClick={() => handleConflictResolution(conflict.id'merge')}>
                            Merge
                          </Button>
                        </ButtonGroup>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setShowCollaborationDialog(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={showSettingsDialog} onClose={() => setShowSettingsDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            {theming.getThemedIcon('settings')}
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Collaboration Settings</Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableCollaboration}
                    onChange={(e) => updateConfig({ enableCollaboration: e.target.checked })}
                  />
              }
                label="Enable Collaboration"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableRealTime}
                    onChange={(e) => updateConfig({ enableRealTime: e.target.checked })}
                  />
              }
                label="Enable Real-Time"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableConflictResolution}
                    onChange={(e) => updateConfig({ enableConflictResolution: e.target.checked })}
                  />
              }
                label="Enable Conflict Resolution"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enablePresence}
                    onChange={(e) => updateConfig({ enablePresence: e.target.checked })}
                  />
              }
                label="Enable Presence"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableCursors}
                    onChange={(e) => updateConfig({ enableCursors: e.target.checked })}
                  />
              }
                label="Enable Cursors"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableComments}
                    onChange={(e) => updateConfig({ enableComments: e.target.checked })}
                  />
              }
                label="Enable Comments"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableVersionControl}
                    onChange={(e) => updateConfig({ enableVersionControl: e.target.checked })}
                  />
              }
                label="Enable Version Control"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enablePermissions}
                    onChange={(e) => updateConfig({ enablePermissions: e.target.checked })}
                  />
              }
                label="Enable Permissions"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableNotifications}
                    onChange={(e) => updateConfig({ enableNotifications: e.target.checked })}
                  />
              }
                label="Enable Notifications"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableOfflineSync}
                    onChange={(e) => updateConfig({ enableOfflineSync: e.target.checked })}
                  />
              }
                label="Enable Offline Sync"
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

CollaborationDashboard.displayName ='CollaborationDashboard';

export default CollaborationDashboard;





