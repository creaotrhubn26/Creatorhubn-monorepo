import React from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { Box, Card, CardContent, Typography, Chip, Grid } from '@mui/material';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../utils/theming-helper';

interface FeatureFlagTestProps {
  userId?: string;
}

export default function FeatureFlagTest({ userId = 'test-user' }: FeatureFlagTestProps) {
  // Master Integration Provider
  const { features } = useEnhancedMasterIntegration();
  
  // Theming system
  const theming = useTheming('photographer');
  
  // Test main dashboard features - Basic Feature Flags
  const { isEnabled: isOverviewEnabled } = useFeatureFlag('dashboard-overview');
  const { isEnabled: isProjectsEnabled } = useFeatureFlag('dashboard-projects');
  const { isEnabled: isClientsEnabled } = useFeatureFlag('dashboard-clients');
  const { isEnabled: isCalendarEnabled } = useFeatureFlag('dashboard-calendar');
  const { isEnabled: isSettingsEnabled } = useFeatureFlag('dashboard-settings');
  const { isEnabled: isBusinessIntelligenceEnabled } = useFeatureFlag('business-intelligence');

  // Test main dashboard features - Comprehensive Feature System
  const overviewAccess = features.checkFeatureAccess('dashboard-overview');
  const projectsAccess = features.checkFeatureAccess('dashboard-projects');
  const clientsAccess = features.checkFeatureAccess('dashboard-clients');
  const calendarAccess = features.checkFeatureAccess('dashboard-calendar');
  const settingsAccess = features.checkFeatureAccess('dashboard-settings');
  const businessIntelligenceAccess = features.checkFeatureAccess('business-intelligence');

  // Test settings sub-tabs - Basic Feature Flags
  const { isEnabled: isPriceAdministrationEnabled } = useFeatureFlag('settings-price-administration');
  const { isEnabled: isBusinessProfileEnabled } = useFeatureFlag('settings-business-profile');
  const { isEnabled: isGoogleDriveEnabled } = useFeatureFlag('settings-google-drive');
  const { isEnabled: isBRREGIntegrationEnabled } = useFeatureFlag('settings-brreg-integration');

  // Test timeline sub-tabs - Basic Feature Flags
  const { isEnabled: isTimelineBasicEnabled } = useFeatureFlag('timeline-basic');
  const { isEnabled: isGoogleMeetingsEnabled } = useFeatureFlag('timeline-google-meetings');
  const { isEnabled: isTimelineManageEnabled } = useFeatureFlag('timeline-manage');

  // Get comprehensive feature analytics
  const featureAnalytics = features.getFeatureAnalytics();
  const mostUsedFeatures = features.getMostUsedFeatures(5);
  const recommendedFeatures = features.getRecommendedFeatures(5);

  const mainFeatures = [
    { 
      id: 'overview', 
      name: 'Dashboard Oversikt', 
      enabled: isOverviewEnabled,
      access: overviewAccess,
      reason: overviewAccess.reason,
      requiredPlan: overviewAccess.requiredPlan
},
    { 
      id: 'projects', 
      name: 'Prosjekter', 
      enabled: isProjectsEnabled,
      access: projectsAccess,
      reason: projectsAccess.reason,
      requiredPlan: projectsAccess.requiredPlan
},
    { 
      id: 'clients', 
      name: 'Kunder', 
      enabled: isClientsEnabled,
      access: clientsAccess,
      reason: clientsAccess.reason,
      requiredPlan: clientsAccess.requiredPlan
},
    { 
      id: 'calendar', 
      name: 'Kalender', 
      enabled: isCalendarEnabled,
      access: calendarAccess,
      reason: calendarAccess.reason,
      requiredPlan: calendarAccess.requiredPlan
},
    { 
      id: 'settings', 
      name: 'Innstillinger', 
      enabled: isSettingsEnabled,
      access: settingsAccess,
      reason: settingsAccess.reason,
      requiredPlan: settingsAccess.requiredPlan
},
    { 
      id: 'business-intelligence', 
      name: 'Business Intelligence', 
      enabled: isBusinessIntelligenceEnabled,
      access: businessIntelligenceAccess,
      reason: businessIntelligenceAccess.reason,
      requiredPlan: businessIntelligenceAccess.requiredPlan
}
  ];

  const settingsFeatures = [
    { id: 'price-administration', name: 'Prisadministrasjon', enabled: isPriceAdministrationEnabled },
    { id: 'business-profile', name: 'Forretningsprofil', enabled: isBusinessProfileEnabled },
    { id: 'google-drive', name: 'Google Drive', enabled: isGoogleDriveEnabled },
    { id: 'brreg-integration', name: 'BRREG Integration', enabled: isBRREGIntegrationEnabled },
  ];

  const timelineFeatures = [
    { id: 'timeline-basic', name: 'Timeline', enabled: isTimelineBasicEnabled },
    { id: 'google-meetings', name: 'Google Møter', enabled: isGoogleMeetingsEnabled },
    { id: 'timeline-manage', name: 'Administrer Tidslinje', enabled: isTimelineManageEnabled },
  ];

  return (
    <Box sx={{ p:  3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb:  3 }}>
        <Box>
          <Typography variant="h4" gutterBottom sx={{ color: theming.colors.primary }}>
            🧪 Feature Flag Test Dashboard
          </Typography>
          <Typography variant="body1" color="text.secondary">
            This component shows the current status of all feature flags. 
            Toggle features in the admin dashboard to see changes here.
          </Typography>
        </Box>
        
        {/* Comprehensive Feature Analytics */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap:  1 }}>
          <Typography variant="h6" color="primary" sx={{ color: theming.colors.primary }}>
            Comprehensive Feature System
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
            <Typography variant="caption" color="text.secondary">
              Features: {featureAnalytics.enabledFeatures}/{featureAnalytics.totalFeatures}
            </Typography>
            <Chip 
              label={`${Math.round(featureAnalytics.featureAdoptionRate * 100)}%`}
              size="small"
              variant="outlined"
              color="primary"
            />
          </Box>
          <Typography variant="caption" color="text.secondary">
            Engagement: {Math.round(featureAnalytics.userEngagementScore)}%
          </Typography>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Main Dashboard Features */}
        <Grid item xs={12} md={4}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                📊 Main Dashboard Tabs
              </Typography>
              {mainFeatures.map((feature) => (
                <Box key={feature.id} sx={{ mb: 2, p: 1, border: 1, borderColor: 'divider', borderRadius:  1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb:  1 }}>
                    <Chip
                      label={feature.enabled ? 'ON' : 'OFF'}
                      color={feature.enabled ? 'success' : 'error'}
                      size="small"
                      sx={{ mr: 2, minWidth: 50}}
                    />
                    <Typography variant="body2" sx={{ fontWeight: 500}}>{feature.name}</Typography>
                  </Box>
                  
                  {/* Comprehensive Feature System Details */}
                  <Box sx={{ ml:  6 }}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      <strong>Basic Flag: </strong> {feature.enabled ? 'Enabled' : 'Disabled'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      <strong>Comprehensive: </strong> {feature.access.isEnabled ? 'Enabled' : 'Disabled'}
                    </Typography>
                    {feature.reason && (
                      <Typography variant="caption" color="warning.main" display="block">
                        <strong>Reason: </strong> {feature.reason}
                      </Typography>
                    )}
                    {feature.requiredPlan && (
                      <Typography variant="caption" color="info.main" display="block">
                        <strong>Required Plan: </strong> {feature.requiredPlan}
                      </Typography>
                    )}
                  </Box>
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>

        {/* Settings Sub-tabs */}
        <Grid item xs={12} md={4}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                ⚙️ Settings Sub-tabs
              </Typography>
              {settingsFeatures.map((feature) => (
                <Box key={feature.id} sx={{ display: 'flex', alignItems: 'center', mb:  1 }}>
                  <Chip
                    label={feature.enabled ? 'ON' : 'OFF'}
                    color={feature.enabled ? 'success' : 'error'}
                    size="small"
                    sx={{ mr: 2, minWidth: 50}}
                  />
                  <Typography variant="body2">{feature.name}</Typography>
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>

        {/* Timeline Sub-tabs */}
        <Grid item xs={12} md={4}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                📅 Timeline Sub-tabs
              </Typography>
              {timelineFeatures.map((feature) => (
                <Box key={feature.id} sx={{ display: 'flex', alignItems: 'center', mb:  1 }}>
                  <Chip
                    label={feature.enabled ? 'ON' : 'OFF'}
                    color={feature.enabled ? 'success' : 'error'}
                    size="small"
                    sx={{ mr: 2, minWidth: 50}}
                  />
                  <Typography variant="body2">{feature.name}</Typography>
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Comprehensive Feature Analytics Section */}
      <Grid container spacing={3} sx={{ mt:  2 }}>
        <Grid item xs={12} md={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                📈 Most Used Features
              </Typography>
              {mostUsedFeatures.length > 0 ? (
                mostUsedFeatures.map((feature, index) => (
                  <Box key={feature.featureId} sx={{ display: 'flex', alignItems: 'center', mb:  1 }}>
                    <Chip
                      label={`#${index + 1}`}
                      size="small"
                      color="primary"
                      sx={{ mr: 2, minWidth: 30}}
                    />
                    <Typography variant="body2" sx={{ flex:  1 }}>
                      {feature.featureId}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {feature.usageCount} uses
                    </Typography>
                  </Box>
                ))
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No usage data available yet
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                🎯 Recommended Features
              </Typography>
              {recommendedFeatures.length > 0 ? (
                recommendedFeatures.map((feature, index) => (
                  <Box key={feature.id} sx={{ display: 'flex', alignItems: 'center', mb:  1 }}>
                    <Chip
                      label={`#${index + 1}`}
                      size="small"
                      color="secondary"
                      sx={{ mr: 2, minWidth: 30}}
                    />
                    <Typography variant="body2" sx={{ flex:  1 }}>
                      {feature.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {feature.category}
                    </Typography>
                  </Box>
                ))
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No recommendations available
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Box sx={{ mt:  3, p: 2, bgcolor: 'info.light', borderRadius:  1 }}>
        <Typography variant="body2">
          <strong>💡 How to test: </strong>
          <br />
          1. Go to Admin Dashboard → Feature Management
          <br />
          2. Toggle any feature on/off
          <br />
          3. Come back here to see the changes
          <br />
          4. Check the main dashboard to see tabs appear/disappear
        </Typography>
        <Typography variant="body2" sx={{ mt: 1 }}>
          🔧 <strong>Comprehensive Feature System: </strong> Shows detailed access information, 
          usage tracking, analytics, and recommendations beyond basic boolean flags.
        </Typography>
      </Box>
    </Box>
  );
}



