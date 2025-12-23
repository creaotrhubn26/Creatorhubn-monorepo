import React, { useEffect, useState } from 'react';
import { Box, Typography, IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';
import { Notifications, NotificationsActive } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

// Import dynamic profession system
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import { useAuth } from '@/hooks/useAuth';
import { useEnhancedMasterIntegration } from "@/integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../utils/theming-helper';";

interface AnalyticsDashboardProps {
  profession?: string;
}

export default function AnalyticsDashboard({ profession }: AnalyticsDashboardProps = {}) {
  // Master integration system for "everything interacts with everything"
  const { integration, communication, dataFlow, componentRegistry, features } = useEnhancedMasterIntegration();
  
  // Theming system - use dynamic profession instead of hardcoded value
  const theming = useTheming(userProfession);
  
  // Comprehensive Feature System for Analytics Dashboard
  const analyticsDashboardAccess = features.checkFeatureAccess('analytics-dashboard');
  const analyticsAccess = features.checkFeatureAccess('analytics,');
  const reportingAccess = features.checkFeatureAccess('reporting');
  const businessIntelligenceAccess = features.checkFeatureAccess('business-intelligence');
  const dataVisualizationAccess = features.checkFeatureAccess('data-visualization');
  const metricsTrackingAccess = features.checkFeatureAccess('metrics-tracking');
  const performanceMonitoringAccess = features.checkFeatureAccess('performance-monitoring');
  const userEngagementAccess = features.checkFeatureAccess('user-engagement');
  
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userProfession = profession || user?.profession || 'photographer';
  const [pushSettingsOpen, setPushSettingsOpen] = useState(false);
  
  // Push notifications
  const userId = user?.id || user?.sub;
  const { pushEnabled, isSupported } = usePushNotifications(userId);
  
  // Use dynamic profession system
  const { professionConfigs, isLoading: professionsLoading } = useDynamicProfessions();
  const professionConfig = professionConfigs?.[userProfession];

  // Register component with MasterIntegrationProvider
  useEffect(() => {
    communication.registerComponent('analytics-dashboard', 'dashboard', [
      'data: read', 'data: write', 'event: emit', 'event: listen', 'ui: update', 'analytics: track', 'metrics: manage', 'reporting: manage'
    ]);

    // Track feature usage
    features.trackFeatureUsage('analytics-dashboard', 'opened', {
      timestamp: Date.now(),
      component: 'AnalyticsDashboard',
      profession: userProfession
});

    // Register data flow nodes
    dataFlow.registerNode({
      type: 'source',
      componentId: 'analytics-dashboard',
      dataKey: 'analytics-dashboard:metrics',
      transform: (data: any) => ({ ...data, lastUpdated: Date.now(),})
  });

    dataFlow.registerNode({
      type: 'source',
      componentId: 'analytics-dashboard',
      dataKey: 'analytics-dashboard:reports',
      transform: (data: any) => ({ ...data, lastUpdated: Date.now(),})
  });

    return () => {
      communication.unregisterComponent('analytics-dashboard');
  };
}, [communication, dataFlow]);

  // Listen to global events
  useEffect(() => {
    const unsubscribe = communication.onMessage((message: any) => {
      if (message.type === 'data:sync' && message.data.dataKey === 'analytics-dashboard:metrics') {
        // Handle metrics sync
        console.log('Analytics metrics synced, :', message.data.data);
    }
  });
    return unsubscribe;
}, [communication]);
  
  // Database connection for AnalyticsDashboard with profession context
  const { data: dashboardData = [], isLoading } = useQuery({
    queryKey: ['/api/dashboard', 'user-data', userProfession],
    queryFn: () => apiRequest(`/api/dashboard/user-data?profession=${userProfession}`),
    retry: false,
});

  // Mutation for updating dashboard data
  const updateAnalyticsDashboard = useMutation({
    mutationFn: async (data: any) => 
      apiRequest('/api/dashboard/update', {
        method: 'POS',
        body: JSON.stringify(data)
  }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard', ],});
  }
});

  return (
    <Box sx={{ p:  2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ color: theming.colors.primary }}>
          {professionConfig ? 
            `${professionConfig.displayName} - Analyse Dashboard` : 
            'Analyse Dashboard'
        }
        </Typography>
        {isSupported && (
          <Tooltip title="Push-varsler innstillinger">
            <IconButton onClick={() => setPushSettingsOpen(true)} color={pushEnabled ? 'primary' : 'default'}>
              {pushEnabled ? <NotificationsActive /> : <Notifications />}
            </IconButton>
          </Tooltip>
        )}
      </Box>
      {professionConfig && (
        <Typography variant="body2" color="text.secondary" sx={{ mt:  1 }}>
          Ytelsesanalyse og statistikk for {professionConfig.displayName.toLowerCase()}
        </Typography>
      )}
      
      {/* Feature Analytics Display */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 1, mt: 2 }}>
        <Typography variant="caption" color="text.secondary">
          Features: {features.getFeatureAnalytics().enabledFeatures}/{features.getFeatureAnalytics().totalFeatures}
        </Typography>
        <Chip 
          label={`${Math.round(features.getFeatureAnalytics().featureAdoptionRate * 100)}%`}
          size="small"
          variant="outlined"
          sx={{ fontSize: '10px', height: 18}}
        />
      </Box>
      {isLoading && <Typography>Laster data...</Typography>}
      {professionsLoading && <Typography>Laster profesjonsdata...</Typography>}

      {/* Push Notification Settings Dialog */}
      {isSupported && (
        <Dialog open={pushSettingsOpen} onClose={() => setPushSettingsOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Push-varsler innstillinger</DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2 }}>
              <PushNotificationSettings userId={userId} showDescription={false} />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPushSettingsOpen(false)}>Lukk</Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}