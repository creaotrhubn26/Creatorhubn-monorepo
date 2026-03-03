import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import { apiRequest } from '@/lib/queryClient';

import {
  Fab,
  Box,
  Tooltip,
  Button,
  Typography,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';

import {
  History,
  Backup,
  MonitorHeart,
  AdminPanelSettings,
  RestartAlt,
  SystemUpdateAlt,
  Extension,
  Api,
  ErrorOutline,
  Gavel,
  ConnectedTv as Integration,
  Support,
  Memory,
  NetworkCheck,
  PersonAdd,
  Psychology,
  Google,
  Note,
  DocumentScanner,
} from '@mui/icons-material';

interface AdminFloatingActionButtonsProps {
  onUserManagementOpen?: () => void;
  onSystemHealthOpen?: () => void;
  onAnalyticsOpen?: () => void;
  onBackupOpen?: () => void;
  onSecurityAuditOpen?: () => void;
  onBillingOpen?: () => void;
  onAutomationsOpen?: () => void;
  onLogsOpen?: () => void;
  onSystemRestart?: () => void;
  onMaintenanceMode?: () => void;
  onDataExportOpen?: () => void;
  onSystemSettingsOpen?: () => void;
  onPluginManagementOpen?: () => void;
  onDatabaseManagementOpen?: () => void;
  onApiMonitoringOpen?: () => void;
  onErrorTrackingOpen?: () => void;
  onUserCommunicationOpen?: () => void;
  onPerformanceMetricsOpen?: () => void;
  onContentModerationOpen?: () => void;
  onLicenseManagementOpen?: () => void;
  onMarketplaceAdminOpen?: () => void;
  onStrategicNotesOpen?: () => void;
  onMagicCreatorOpen?: () => void;
  onGoogleWorkspaceResellerOpen?: () => void;
  onIntegrationManagementOpen?: () => void;
  onSupportTicketsOpen?: () => void;
  onActivityTimelineOpen?: () => void;
  onMemoryOptimizationOpen?: () => void;
  onNetworkMonitoringOpen?: () => void;
  onCloudSyncOpen?: () => void;
  onUserInvitesOpen?: () => void;
  onPermissionsManagementOpen?: () => void;
}

interface ActionItem {
  name: string;
  icon: React.ReactNode;
  action: () => void;
  priority: 'high' | 'medium' | 'low';
}

export default function AdminFloatingActionButtons({
  onUserManagementOpen,
  onSystemHealthOpen,
  onAnalyticsOpen,
  onBackupOpen,
  onSecurityAuditOpen,
  onBillingOpen,
  onAutomationsOpen,
  onLogsOpen,
  onSystemRestart,
  onMaintenanceMode,
  onDataExportOpen,
  onSystemSettingsOpen,
  onPluginManagementOpen,
  onDatabaseManagementOpen,
  onApiMonitoringOpen,
  onErrorTrackingOpen,
  onUserCommunicationOpen,
  onPerformanceMetricsOpen,
  onContentModerationOpen,
  onLicenseManagementOpen,
  onMarketplaceAdminOpen,
  onIntegrationManagementOpen,
  onSupportTicketsOpen,
  onActivityTimelineOpen,
  onMemoryOptimizationOpen,
  onNetworkMonitoringOpen,
  onCloudSyncOpen,
  onUserInvitesOpen,
  onPermissionsManagementOpen,
  onStrategicNotesOpen,
  onMagicCreatorOpen,
  onGoogleWorkspaceResellerOpen,
}: AdminFloatingActionButtonsProps) {
  const [open, setOpen] = useState(false);

  // Get auth from master integration
  const { auth } = useEnhancedMasterIntegration();

  // Theming system
  const theming = useTheming('prototype_tester');
  const [showInfoMessage, setShowInfoMessage] = useState(false);
  const [clickedAction, setClickedAction] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [organizerDialogOpen, setOrganizerDialogOpen] = useState(false);

  // Admin usage analytics - for intelligent sorting
  const [actionUsageStats, setActionUsageStats] = useState<Record<string, number>>({});
  const [isLearningMode, setIsLearningMode] = useState(true);

  // Fetch usage analytics for smart sorting
  const { data: usageData } = useQuery({
    queryKey: ['admin-action-usage-stats', 'admin-session'],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/admin/action-usage-stats', { headers });
    }
});

  // Save action usage mutation
  const saveActionUsageMutation = useMutation({
    mutationFn: async (actionName: string) => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/admin/track-action-usage', {
        headers: {
          ...headers,
          "Content-Type" : "application/json"
      },
        method: 'POST',
        body: JSON.stringify({
          sessionId: 'admin-session',
          actionName,
          timestamp: new Date().toISOString()
      })
    });
  },
    onSuccess: () => {
      // queryClient.invalidateQueries({ queryKey: ['admin-action-usage-stats'] });
  }
});

  // Update usage stats when data loads
  useEffect(() => {
    if (usageData) {
      setActionUsageStats(usageData.stats || {});
      setIsLearningMode((usageData.totalActions || 0) < 20); // Learning mode for first 20 actions
  }
}, [usageData]);

  // Info message logic for admin
  useEffect(() => {
    const hasShownMessage = localStorage.getItem('admin_speedDial_info_shown');
    if (!hasShownMessage) {
      const timer = setTimeout(() => {
        setShowInfoMessage(true);
        localStorage.setItem('admin_speedDial_info_shown','true');
        
        // Auto-hide after 6 seconds
        setTimeout(() => {
          setShowInfoMessage(false);
      }, 6000);
    }, 2000);

      return () => clearTimeout(timer);
  }
}, []);

  const getAllAvailableActions = (): ActionItem[] => {
    return [
      // Core Admin Actions (High Priority)
      { name: 'brukerhåndtering', icon: theming.getThemedIcon('people'), action: () => onUserManagementOpen?.(), priority: 'high' },
      { name: 'systemhelse', icon: <MonitorHeart />, action: () => onSystemHealthOpen?.(), priority: 'high' },
      { name: 'sikkerhet-audit', icon: theming.getThemedIcon('security'), action: () => onSecurityAuditOpen?.(), priority: 'high' },
      { name: 'backup-admin', icon: <Backup />, action: () => onBackupOpen?.(), priority: 'high' },
      { name: 'database-admin', icon: theming.getThemedIcon('storage'), action: () => onDatabaseManagementOpen?.(), priority: 'high' },
      { name: 'feilsporing', icon: <ErrorOutline />, action: () => onErrorTrackingOpen?.(), priority: 'high' },
      
      // Management & Monitoring (Medium Priority)
      { name: 'analytics-rapport', icon: theming.getThemedIcon('analytics'), action: () => onAnalyticsOpen?.(), priority: 'medium' },
      { name: 'økonomi-oversikt', icon: theming.getThemedIcon('money'), action: () => onBillingOpen?.(), priority: 'medium' },
      { name: 'plugin-admin', icon: <Extension />, action: () => onPluginManagementOpen?.(), priority: 'medium' },
      { name: 'api-overvåking', icon: <Api />, action: () => onApiMonitoringOpen?.(), priority: 'medium' },
      { name: 'ytelse-metrikker', icon: theming.getThemedIcon('speed'), action: () => onPerformanceMetricsOpen?.(), priority: 'medium' },
      { name: 'lisens-admin', icon: theming.getThemedIcon('vpnKey'), action: () => onLicenseManagementOpen?.(), priority: 'medium' },
      { name: 'integrasjoner', icon: <Integration />, action: () => onIntegrationManagementOpen?.(), priority: 'medium' },
      { name: 'support-tickets', icon: <Support />, action: () => onSupportTicketsOpen?.(), priority: 'medium' },
      { name: 'aktivitets-tidslinje', icon: theming.getThemedIcon('timeline'), action: () => onActivityTimelineOpen?.(), priority: 'medium' },
      { name: 'nettverksovervåking', icon: <NetworkCheck />, action: () => onNetworkMonitoringOpen?.(), priority: 'medium' },
      
      // Communication & Content (Medium Priority)
      { name: 'bruker-kommunikasjon', icon: theming.getThemedIcon('email'), action: () => onUserCommunicationOpen?.(), priority: 'medium' },
      { name: 'innhold-moderering', icon: <Gavel />, action: () => onContentModerationOpen?.(), priority: 'medium' },
      { name: 'marketplace-admin', icon: theming.getThemedIcon('store'), action: () => onMarketplaceAdminOpen?.(), priority: 'medium' },
      { name: 'bruker-invitasjoner', icon: <PersonAdd />, action: () => onUserInvitesOpen?.(), priority: 'medium' },
      
      // System Operations (Low Priority)
      { name: 'automatisering', icon: theming.getThemedIcon('autoAwesome'), action: () => onAutomationsOpen?.(), priority: 'low' },
      { name: 'system-logger', icon: <History />, action: () => onLogsOpen?.(), priority: 'low' },
      { name: 'data-eksport', icon: theming.getThemedIcon('dataUsage'), action: () => onDataExportOpen?.(), priority: 'low' },
      { name: 'systeminnstillinger', icon: theming.getThemedIcon('settings'), action: () => onSystemSettingsOpen?.(), priority: 'low' },
      { name: 'minneoptimalisering', icon: <Memory />, action: () => onMemoryOptimizationOpen?.(), priority: 'low' },
      { name: 'sky-synkronisering', icon: theming.getThemedIcon('cloudUpload'), action: () => onCloudSyncOpen?.(), priority: 'low' },
      { name: 'tillatelse-admin', icon: theming.getThemedIcon('lock'), action: () => onPermissionsManagementOpen?.(), priority: 'low' },
      { name: 'system-omstart', icon: <RestartAlt />, action: () => onSystemRestart?.(), priority: 'low' },
      { name: 'vedlikehold-modus', icon: <SystemUpdateAlt />, action: () => onMaintenanceMode?.(), priority: 'low' },
      { name: 'organiser', icon: theming.getThemedIcon('tune'), action: () => setOrganizerDialogOpen(true), priority: 'low' },
      
      // Additional Actions using remaining icons
      { name: 'strategiske-notater', icon: <Note />, action: () => onStrategicNotesOpen?.(), priority: 'medium' },
      { name: 'ai-kreator', icon: <Psychology />, action: () => onMagicCreatorOpen?.(), priority: 'medium' },
      { name: 'google-workspace', icon: <Google />, action: () => onGoogleWorkspaceResellerOpen?.(), priority: 'medium' },
      { name: 'dokument-skanning', icon: <DocumentScanner />, action: () => onDataExportOpen?.(), priority: 'low' },
    ];
};

  const getVisibleActions = (): ActionItem[] => {
    const allActions = getAllAvailableActions();
    // Show first 8 high priority actions and 4 medium priority actions for optimal UX
    const highPriorityActions = allActions.filter(action => action.priority === 'high').slice(0, 8);
    const mediumPriorityActions = allActions.filter(action => action.priority === 'medium').slice(0, 6);
    return [...highPriorityActions, ...mediumPriorityActions];
};

  const handleActionClick = (actionName: string, actionFunction: () => void) => {
    // Trigger click animation
    setClickedAction(actionName);
    
    // Clear animation after 600ms
    setTimeout(() => {
      setClickedAction(null);
  }, 600);
    
    // Close SpeedDial
    setOpen(false);
    
    // Execute the action
    actionFunction();
};

  const getPriorityColor = (priority: 'high' | 'medium' | 'low'): string => {
    switch (priority) {
      case 'high': return '#ff4444'; // Red for critical admin actions
      case 'medium': return '#ff8c00'; // Orange for normal actions
      case 'low': return '#4caf50'; // Green for low priority
      default: return '#ff8c00';
}
};

  return (
    <Box sx={{ position: 'fixed', bottom: 20, right: 20, zIndex: 1200}}>
      {/* Info Message */}
      {showInfoMessage && (
        <Box
          onClick={() => setShowInfoMessage(false)}
          sx={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '320px',
            height: '200px',
            zIndex: 9999,
            background: 'linear-gradient(135deg, #ff4444 0%, #ff6b00 50%, #ff8500 100%)',
            borderRadius: 4,
            border: '4px solid white',
            padding: 3,
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            animation: 'pulse 2s infinite'
        }}
        >
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 2, 
            mb: 2,
            '@keyframes pulse': {
              '0%': { transform: 'scale(1)' }, '50%': { transform: 'scale(1.05)' }, '100%': { transform: 'scale(1)' }
          }
        }}>
            <AdminPanelSettings sx={{ 
              fontSize: 40, 
              color: 'white',
              animation: 'pulse 1.5s infinite'
          }} />
            <Typography variant="h6" sx={{ 
              color: 'white', 
              fontWeight: 'bold',
              textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
          }}>
              Admin Handlinger
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ opacity: 0.95, lineHeight: 1.4, color: 'white' }}>
            Trykk på + ikonet for å få tilgang til administrative handlinger som brukerhåndtering, systemhelse, og sikkerhet!
          </Typography>
          <Typography variant="caption" sx={{ 
            opacity: 0.8, 
            fontSize: '0.7rem',
            display: 'block',
            mt: 1,
            fontStyle: 'italic',
            color: 'white'
        }}>
            Klikk for å lukke
          </Typography>
        </Box>
      )}

      {/* Simple Organizer Dialog */}
      <Dialog
        open={organizerDialogOpen}
        onClose={() => setOrganizerDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Admin SpeedDial Organiser
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Tilgjengelige admin-handlinger: </Typography>
          <List>
            {getVisibleActions().map((action) => {
              const priorityColor = getPriorityColor(action.priority);
              return (
                <ListItem key={action.name}>
                  <ListItemIcon sx={{ color: priorityColor }}>
                    {action.icon}
                  </ListItemIcon>
                  <ListItemText 
                    primary={action.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    secondary={`Prioritet: ${action.priority}`}
                  />
                </ListItem>
              );
          })}
          </List>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setOrganizerDialogOpen(false)}
            variant="contained"
            sx={{ 
              background: 'linear-gradient(135deg, #ff4444, #ff6b00)', '&:hover': {
                background: 'linear-gradient(135deg, #ff6b00, #ff4444)',
            }
          }}
          >
            Ferdig
          </Button>
        </DialogActions>
      </Dialog>

      {/* Custom SpeedDial with proper keyboard navigation */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 20,
          right: 180, // Positioned to left of chat button
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          zIndex: 120}}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setOpen(false);
            setFocusedIndex(-1);
        } else if (open && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Tab')) {
            e.preventDefault();
            const actions = getVisibleActions();
            const direction = (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) ? -1 : 1;
            const newIndex = (focusedIndex + direction + actions.length) % actions.length;
            setFocusedIndex(newIndex);
        } else if (open && (e.key === 'Enter' || e.key === ', ')) {
            e.preventDefault();
            const actions = getVisibleActions();
            if (focusedIndex >= 0 && focusedIndex < actions.length) {
              handleActionClick(actions[focusedIndex].name, actions[focusedIndex].action);
          }
        }
      }}
      >
        {/* Action buttons (appear above main button when open) */}
        {open && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              mb: 1,
              alignItems: 'center'
          }}
          >
            {getVisibleActions().map((action, index) => {
              const isClicked = clickedAction === action.name;
              const isFocused = focusedIndex === index;
              const priorityColor = getPriorityColor(action.priority);
              return (
                <Box
                  key={action.name}
                  sx={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    animation: `slideUp 0.3s ease-out ${index * 0.1}s both`
                }}
                >
                  {/* Label */}
                  <Typography
                    sx={{
                      position: 'absolute',
                      right: '100%',
                      mr: 2,
                      bgcolor: isFocused ? `${priorityColor}dd` : 'rgba(0,0,0,0.8)',
                      color: 'white',
                      px: 2,
                      py: 1,
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      boxShadow: isFocused 
                        ? `0 0 15px ${priorityColor}99` 
                        : '0 4px 8px rgba(0,0,0,0.2)',
                      backdropFilter: 'blur(10px)',
                      border: isFocused ? '2px solid rgba(255, 255, 255, 0.6)' : `1px solid ${priorityColor}66`,
                      zIndex: 140,
                      transition: 'all 0.2s ease-in-out'
                  }}
                  >
                    {action.name.replace(/-/g, ', ').replace(/\b\w/g, l => l.toUpperCase())}
                  </Typography>
                  
                  {/* Action button */}
                  <Fab
                    size="medium"
                    tabIndex={0}
                    onFocus={() => setFocusedIndex(index)}
                    onClick={() => handleActionClick(action.name, action.action)}
                    sx={{
                      width: 48,
                      height: 48,
                      bgcolor: isFocused ? priorityColor : `${priorityColor}dd`,
                      color: 'white',
                      transform: isClicked ? 'scale(1.1)' : isFocused ? 'scale(1.05)' : 'scale(1)',
                      transition: 'all 0.2s ease-in-out',
                      outline: isFocused ? `3px solid ${priorityColor}88` : 'none',
                      outlineOffset: '2px','&:hover': {
                        bgcolor: priorityColor,
                        transform: 'scale(1.05)'
                    }, '&:focus': {
                        outline: `3px solid ${priorityColor}bb`,
                        outlineOffset: '2px'
                    }
                  }}
                  >
                    {action.icon}
                  </Fab>
                </Box>
              );
          })}
          </Box>
        )}

        {/* Main SpeedDial button */}
        <Fab
          color="primary"
          tabIndex={0}
          onClick={() => {
            setOpen(!open);
            setFocusedIndex(open ? -1 : 0);
        }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              setOpen(!open);
              setFocusedIndex(open ? -1 : 0);
          }
        }}
          sx={{
            width: 70,
            height: 70,
            bgcolor: '#ff4444',
            color: 'white',
            transform: open ? 'rotate(45deg)' : 'rotate(0deg)',
            transition: 'all 0.3s ease-in-out',
            border: '3px solid #fff',
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)', '&:hover': {
              bgcolor: '#ff6b00',
              boxShadow: '0 6px 25px rgba(0,0,0,0.5)'
          }, '&:focus': {
              outline: '3px solid rgba(00, 0.5)',
              outlineOffset: '2px'
          }
        }}
        >
          <AdminPanelSettings />
        </Fab>

        {/* Keyframe animations */}
        <style>
          {`
            @keyframes slideUp {
              from {
                opacity: 0;
                transform: translateY(20px) scale(0.8);
            }
              to {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
          }
          `}
        </style>
      </Box>
    </Box>
  );
}
