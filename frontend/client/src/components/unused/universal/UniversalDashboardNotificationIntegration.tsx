// @ts-nocheck
// This file is in the unused directory and may have outdated imports
/**
 * Universal Dashboard Notification Integration
 * Connects Google Meet system to project administration management with seamless notification flow
 */

import { useTheming } from '../../../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import { getAuthHeader } from '@/lib/google/impersonation';
import { useQuery } from '@tanstack/react-query';
import { getAuthHeader } from '@/lib/google/impersonation';
import { useAuth } from '@/hooks/useAuth';
import { getAuthHeader } from '@/lib/google/impersonation';
import { apiRequest } from '@/lib/queryClient';
import { getAuthHeader } from '@/lib/google/impersonation';
import {
  Box,
  Card as MuiCard,
  CardContent,
  Typography,
  Grid,
  Alert,
  Chip,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Badge,
  Paper,
  Tooltip,
} from '@mui/material';
import {
  VideoCall as MeetIcon,
  Assignment as ProjectIcon,
  Notifications as NotificationIcon,
  TrendingUp as TimelineIcon,
  Description as DocumentIcon,
  Group as ClientIcon,
  SmartToy as SmartIcon,
  Sync as SyncIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { useUniversalNotificationContext } from './UniversalNotificationProvider';
import { getAuthHeader } from '@/lib/google/impersonation';
import GoogleMeetIntegration from '../meet/GoogleMeetIntegration';
import { getAuthHeader } from '@/lib/google/impersonation';
import SmartMeetingPreparation from '../meet/SmartMeetingPreparation';
import { getAuthHeader } from '@/lib/google/impersonation';

interface UniversalDashboardNotificationIntegrationProps {
  profession: 'photographer' | 'videographer' | 'music_producer' | 'vendor';
  userId: string;
  currentProject?: string;
  dashboardTab?: string; 
}

interface ProjectConnection {
  projectId: string;
  projectName: string;
  clientName: string;
  status: 'active' | 'planning' | 'completed';
  relatedMeetings: string[];
  documents: number;
  contracts: number;
  timeline?: boolean; 
}

interface NotificationIntegration {
  googleMeet: {
    connected: boolean;
    upcomingMeetings: number;
    activeMeetings: number;
    preparationStatus: string;
,};
  projectAdmin: {
    connected: boolean;
    activeProjects: number;
    pendingTasks: number;
    documentsReady: number;
,};
  crossComponent: {
    synchronization: 'active' | 'syncing' | 'error';
    lastSync: string;
    connectedComponents: string[];
,};
}

export default function UniversalDashboardNotificationIntegration({
  profession,
  userId,
  currentProject,
  dashboardTab
}: UniversalDashboardNotificationIntegrationProps) {
  const queryClient = useQueryClient();
  
  // Theming system
  const theming = useTheming('photographer');
  
  // Database connection for UniversalDashboardNotificationIntegration
  const { data: dashboardData = [], isLoading } = useQuery({
    queryKey: ['/api/dashboard','user-data'],
    queryFn: () => apiRequest('/api/dashboard/user-data', ),
    retry: false,
});

  // Mutation for updating dashboard data
  const updateUniversalDashboardNotificationIntegration = useMutation({
    mutationFn: async (data: any) => 
      const auth = await getAuthHeader();
      return apiRequest('/api/dashboard/update', {
        headers: auth,
        headers: {},
        
        method: 'POS',
        body: JSON.stringify(data)
    ,}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard', ],});
  }
});

  const [integration, setIntegration] = useState<NotificationIntegration | null>(null);
  const [projectConnections, setProjectConnections] = useState<ProjectConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<any[]>([]);

  const notificationContext = useUniversalNotificationContext();

  useEffect(() => {
    initializeIntegration();
    
    // Subscribe to all notifications for cross-component sync
    const unsubscribe = notificationContext.subscribe('all', (notification) => {
      handleCrossComponentNotification(notification);
  });

    return unsubscribe;
}, [profession, userId, currentProject]);

  const initializeIntegration = async () => {
    setLoading(true);
    try {
      // Initialize project administration connections
      const projectData = await fetchProjectConnections();
      setProjectConnections(projectData);

      // Initialize notification integration status
      const integrationStatus = await fetchIntegrationStatus();
      setIntegration(integrationStatus);

      // Fetch recent notifications
      const recentNotifications = await fetchRecentNotifications();
      setNotifications(recentNotifications);

  } catch (error) {
      console.error('Error initializing dashboard integration: ', error);
  } finally {
      setLoading(false);
  }
};

  const fetchProjectConnections = async (): Promise<ProjectConnection[]> => {
    try {
      const response = await const auth = await getAuthHeader();
 fetch(`/api/project-admin/connections/${userId}`, {
   headers: auth,
        headers: {},
        
        headers: {
          'Authorization': `Bearer ${userId}`
      }
    });

      if (response.ok) {
        const data = await response.json();
        return data.connections;
    } else {
        // Mock data for demo
        return generateMockProjectConnections(profession);
    }
  } catch (error) {
      console.error('Error fetching project connections:', error);
      return generateMockProjectConnections(profession);
  }
};

  const fetchIntegrationStatus = async (): Promise<NotificationIntegration> => {
    try {
      const response = await const auth = await getAuthHeader();
 fetch(`/api/dashboard-integration/status/${userId}`, {
   headers: auth,
        headers: {},
        
        headers: {
          'Authorization': `Bearer ${userId}`
      }
    });

      if (response.ok) {
        const data = await response.json();
        return data.integration;
    } else {
        // Mock integration status
        return {
          googleMeet: {
            connected: true,
            upcomingMeetings:  2,
            activeMeetings:  0,
            preparationStatus: 'ready'
        ,},
          projectAdmin: {
            connected: true,
            activeProjects:  3,
            pendingTasks:  5,
            documentsReady: 8
        ,},
          crossComponent: {
            synchronization: 'active',
            lastSync: new Date().toISOString(),
            connectedComponents: ['google_meet', 'project_admin', 'wedding_timeline', 'document_manager','client_portal']
        }
      };
    }
  } catch (error) {
      console.error('Error fetching integration status:', error);
      return {
        googleMeet: { connected: false, upcomingMeetings: 0, activeMeetings: 0, preparationStatus: 'error' },
        projectAdmin: { connected: false, activeProjects: 0, pendingTasks: 0, documentsReady:  0 },
        crossComponent: { synchronization: 'error', lastSync: ', ', connectedComponents: [],}
    };
  }
};

  const fetchRecentNotifications = async (): Promise<any[]> => {
    try {
      const response = await const auth = await getAuthHeader();
 fetch(`/api/notifications/recent/${userId}?limit=10`, {
   headers: auth,
        headers: {},
        
        headers: {
          'Authorization': `Bearer ${userId}`
      }
    });

      if (response.ok) {
        const data = await response.json();
        return data.notifications;
    }
  } catch (error) {
      console.error('Error fetching recent notifications:', error);
  }
    return [];
};

  const handleCrossComponentNotification = async (notification: any) => {
    // Update integration status based on notification
    if (notification.component === 'google_meet') {
      await syncMeetingWithProjects(notification);
  ,} else if (notification.component === 'project_admin') {
      await syncProjectWithMeetings(notification);
  }

    // Update recent notifications
    setNotifications(prev => [notification, ...prev.slice(0, 9)]);
};

  const syncMeetingWithProjects = async (meetingNotification: any) => {
    const { metadata } = meetingNotification;
    
    if (metadata?.projectId) {
      // Notify project administration about meeting activity
      notificationContext.notify({
        type: 'project_meeting_activity',
        title: 'Prosjektmøte oppdatering',
        message: `Møte "${metadata.title}" har blitt oppdatert for prosjekt`,
        userId,
        profession,
        component: 'project_admin',
        metadata: {
          projectId: metadata.projectId,
          meetingId: metadata.meetingd,
          clientName: metadata.clientName,
          crossSync: true
      }
    });
  }
};

  const syncProjectWithMeetings = async (projectNotification: any) => {
    const { metadata } = projectNotification;
    
    if (metadata?.projectId) {
      // Check if there are related meetings that need updates
      const relatedProject = projectConnections.find(p => p.projectId === metadata.projectId);
      if (relatedProject && relatedProject.relatedMeetings.length > 0) {
        notificationContext.notify({
          type: 'meeting_project_sync',
          title: 'Møte-prosjekt synkronisering',
          message: `Prosjekt "${relatedProject.projectName}" har oppdateringer som påvirker kommende møter`,
          userId,
          profession,
          component: 'google_meet',
          metadata: {
            projectId: metadata.projectId,
            relatedMeetings: relatedProject.relatedMeetings,
            crossSync: true
        }
      });
    }
  }
};

  const getProfessionIcon = () => {
    switch (profession) {
      case 'photographer': return 'PhotoCamera';
      case 'videographer': return 'Videocam';
      case 'music_producer': return 'LibraryMusic';
      case 'vendor': return 'Store';
      default: return 'Business';
  }
};

  const getIntegrationStatusColor = (status: string) => {
    switch (status) {
      case 'active': case 'ready': case 'connected': return 'success';
      case 'syncing': case 'preparing': return 'warning';
      case 'error': case 'disconnected': return 'error';
      default: return 'default';
  }
};

  if (loading) {
    return (
      <Box sx={{ p:  3 }}>
        <Typography>Initialiserer dashboard integrasjon...</Typography>
      </Box>
    );
}

  return (
    <Box sx={{ p:  3 }}>
      {/* Integration Status Header */}
      <Paper elevation={2} sx={{ p:  3, mb:  3, background: 'linear-gradient(135deg, #FFC107 0%, #FF9800 100%)' ,  ...theming.getThemedCardSx() }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
            <Typography variant="h4" sx={{  color: 'white'  }}>
              {getProfessionIcon()}
            </Typography>
            <Box>
              <Typography variant="h5" sx={{  color: 'white', fontWeight: 'bold'  }}>
                Universal Dashboard Integration
              </Typography>
              <Typography variant="subtitle1" sx={{ color: 'white', opacity: 0.9}}>
                {getProfessionDisplayName(profession)} • Google Meet ↔ Project Administration
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
            <Chip
              label={integration?.crossComponent.synchronization || 'Syncing'}
              color={getIntegrationStatusColor(integration?.crossComponent.synchronization || 'syncing')}
              icon={<SyncIcon />}
              sx={{ backgroundColor: 'white' }}
            />
            <Tooltip title="Sist synkronisert">
              <Typography variant="caption" sx={{ color: 'white' }}>
                {integration?.crossComponent.lastSync ? 
                  formatTimestamp(integration.crossComponent.lastSync) : 
                  'Synkroniserer...'
              }
              </Typography>
            </Tooltip>
          </Box>
        </Box>
      </Paper>

      {/* Integration Status Cards */}
      <Grid container spacing={3} sx={{ mb:  3 }}>
        {/* Google Meet Integration */}
        <Grid size={{ xs: 12 }} md={4}>
          <MuiCard>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Badge
                  badgeContent={integration?.googleMeet.activeMeetings || 0}
                  color="error"
                >
                  <MeetIcon color={integration?.googleMeet.connected ? 'primary' : 'disabled'} />
                </Badge>
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>Google Meet</Typography>
                <Chip
                  size="small"
                  label={integration?.googleMeet.connected ? 'Tilkoblet' : 'Frakoblet'}
                  color={integration?.googleMeet.connected ? 'success' : 'error'}
                />
              </Box>
              <Typography variant="body2" color="text.secondary">
                {integration?.googleMeet.upcomingMeetings} kommende møter
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Forberedelser: {integration?.googleMeet.preparationStatus}
              </Typography>
            </CardContent>
          </MuiCard>
        </Grid>

        {/* Project Administration Integration */}
        <Grid size={{ xs: 12 }} md={4}>
          <MuiCard>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Badge
                  badgeContent={integration?.projectAdmin.pendingTasks || 0}
                  color="warning"
                >
                  <ProjectIcon color={integration?.projectAdmin.connected ? 'primary' : 'disabled'} />
                </Badge>
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>Prosjektadministrasjon</Typography>
                <Chip
                  size="small"
                  label={integration?.projectAdmin.connected ? 'Tilkoblet' : 'Frakoblet'}
                  color={integration?.projectAdmin.connected ? 'success' : 'error'}
                />
              </Box>
              <Typography variant="body2" color="text.secondary">
                {integration?.projectAdmin.activeProjects} aktive prosjekter
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {integration?.projectAdmin.documentsReady} dokumenter klare
              </Typography>
            </CardContent>
          </MuiCard>
        </Grid>

        {/* Cross-Component Sync */}
        <Grid size={{ xs: 12 }} md={4}>
          <MuiCard>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <SyncIcon 
                  color={getIntegrationStatusColor(integration?.crossComponent.synchronization || 'syncing') === 'success' ? 'primary' : 'disabled'}
                />
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>Tverrkomponent Sync</Typography>
                <Chip
                  size="small"
                  label={integration?.crossComponent.connectedComponents.length || 0}
                  color="primary"
                />
              </Box>
              <Typography variant="body2" color="text.secondary">
                {integration?.crossComponent.connectedComponents.join(', ')}
              </Typography>
            </CardContent>
          </MuiCard>
        </Grid>
      </Grid>

      {/* Project Connections */}
      <MuiCard sx={{ mb:  3 }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Typography variant="h6" gutterBottom sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
            <ProjectIcon />
            Prosjekt-Møte Tilkoblinger
          </Typography>
          <List>
            {projectConnections.map(project => (
              <ListItem key={project.projectId} sx={{ backgroundColor: 'grey.5', borderRadius: 1, mb:  1 }}>
                <ListItemIcon>
                  <Badge badgeContent={project.relatedMeetings.length} color="primary">
                    <ClientIcon />
                  </Badge>
                </ListItemIcon>
                <ListItemText
                  primary={project.projectName}
                  secondary={
                    <Box>
                      <Typography variant="body2">
                        {project.clientName} • {project.documents} dokumenter • {project.contracts} kontrakter
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                        <Chip size="small" label={project.status} color={getIntegrationStatusColor(project.status)} />
                        {project.timeline && <Chip size="small" label="Tidslinje" variant="outlined" icon={<TimelineIcon />} />}
                      </Box>
                    </Box>
                }
                />
              </ListItem>
            ))}
          </List>
        </CardContent>
      </MuiCard>

      {/* Recent Cross-Component Notifications */}
      {notifications.length > 0 && (
        <MuiCard>
          <CardContent sx={theming.getThemedCardSx()}>
            <Typography variant="h6" gutterBottom sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
              <NotificationIcon />
              Nylige Tverrkomponent Varsler
            </Typography>
            <List>
              {notifications.slice(0, 5).map((notification, index) => (
                <ListItem key={index} sx={{ backgroundColor: 'grey.5', borderRadius: 1, mb:  1 }}>
                  <ListItemIcon>
                    {notification.metadata?.crossSync ? <SyncIcon color="primary" /> : <NotificationIcon />}
                  </ListItemIcon>
                  <ListItemText
                    primary={notification.title}
                    secondary={
                      <Box>
                        <Typography variant="body2">
                          {notification.message}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatTimestamp(notification.timestamp)} • {notification.component}
                        </Typography>
                      </Box>
                  }
                  />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </MuiCard>
      )}
    </Box>
  );
}

// Helper functions
function generateMockProjectConnections(profession: string): ProjectConnection[] {
  // Mock data removed - using database connection

  return baseConnections; 
}

function getProfessionDisplayName(profession: string): string {
  switch (profession) {
    case 'photographer': return 'Fotograf';
    case 'videographer': return 'Videograf';
    case 'music_producer': return 'Musikkprodusent';
    case 'vendor': return 'Utstyrsleverandør';
    default: return profession;
,}
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return'Nå';
  if (diffMins < 60) return `${diffMins}m siden`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}t siden`;
  return date.toLocaleDateString('no-NO');
}