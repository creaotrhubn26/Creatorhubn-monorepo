// @ts-nocheck
// This file is in the unused directory and may have outdated imports
import { useTheming } from '../../../utils/theming-helper';
import React from 'react';
import { getAuthHeader } from '@/lib/google/impersonation';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  Box,
  Typography,
  Grid,
  Card as MuiCard,
  CardContent,
  Chip,
  LinearProgress,
} from '@mui/material';
import { apiRequest } from '@/lib/queryClient';
import {
  PhotoCamera,
  Videocam,
  LibraryMusic,
  Store,
  CheckCircle,
  Warning,
  Error,
} from '@mui/icons-material';

// Component registry with all 762 components
const TOTAL_COMPONENTS = 762;

// Profession-specific component mappings
const professionComponentMappings = {
  photographer: {
    overview: {
      analytics: ['BusinessIntelligenceDashboard','GoogleAnalyticsDashboard','RevenueAnalyticsDashboard','PerformanceAnalyticsDashboard'],
      ai: ['AIRecommendationEngine','AIWorkflowAutomation','AIBudgetOptimizer'],
      admin: ['AdminFeatureControlPanel','AdminAccessibilityDashboard'],
      business: ['Analytics','AnalyticsDashboard','ConsentBanner','ProductivityDashboard']
  },
    projects: {
      project: ['ProjectManagementPageD','ProjectTimelineManager','ProjectBackupManager','ProjectManager'],
      files: ['FileManagementSystem','EnhancedProjectFileManager','FileMetadataSystem'],
      collaboration: ['RealTimeCollaborationWorkspace','CollaborationWidget','TeamMembersList'],
      delivery: ['PhotoDeliveryGalleryManager','ClientDashboard','ClientPortalMobileInterface']
  },
    clients: {
      communication: ['ClientManagementPageD','ClientCommunicationDashboard','ProfessionalEmailSystem'],
      contracts: ['ContractTemplateManager','ContractGenerator','ContractAnalyzer','EnhancedContractWizard'],
      crm: ['UniversalChatWidget','EmailChatIntegration','ComprehensiveChatSystem']
  },
    equipment: {
      equipment: ['ComprehensiveEquipmentDashboard','EquipmentTrackingDashboard','LiveEquipmentDashboard','EquipmentMaintenanceScheduler'],
      lighting: ['LightingSimulator3','InteractiveLensVisualization','SmartLensMatching'],
      maintenance: ['EquipmentMaintenanceTracker','EquipmentNotificationSystem','EquipmentUpgradeRoadmap']
  },
    settings: {
      integrations: ['GoogleDriveIntegration','MicrosoftIntegrationDemo','ComprehensiveDriveIntegration'],
      settings: ['SettingsDashboard','MobileSettingsPage','NotificationSettings'],
      security: ['SecurityMonitoringDashboard','GDPRConsentModal','AccessibilityColorCorrection']
  }
},
  videographer: {
    overview: {
      analytics: ['AnalyticsManagementDashboard','PerformanceAnalyticsDashboard','RevenueAnalyticsDashboard'],
      ai: ['AIWorkflowAutomation','AIVideographerTools','AISceneSimulation'],
      video: ['AdvancedVideoProjectManagement','VideoTimelineDemo','StoryArcGenerator']
  },
    projects: {
      project: ['ProjectManagementPage','ProjectManager','VideoDeliveryWorkflow'],
      video: ['VideoGallery','EnhancedVideoPlayer','VideoEditor'],
      collaboration: ['UnifiedVideoMusicCollaboration','LiveCollaborationWorkspace','ContentCollaboration']
  },
    clients: {
      communication: ['ClientManagementPage','ClientCommunicationDashboard','TabbedChatSystem'],
      contracts: ['ContractGenerator','VideographerContractTemplates','ContractSigningWorkflow']
  },
    equipment: {
      equipment: ['LiveEquipmentDashboard','VideoEquipmentTracker','VideoEquipmentMaintenanceScheduler'],
      video: ['ComprehensiveEquipmentDashboard','EquipmentTrackingDashboard']
  },
    settings: {
      integrations: ['ComprehensiveDriveIntegration','MicrosoftCalendarIntegration','UnifiedMicrosoftDashboard'],
      settings: ['SettingsPage','VideographerSettingsPage','DynamicThemeSwitcher']
  }
},
  musicproducer: {
    overview: {
      analytics: ['BusinessIntelligenceDashboard','AIMarketingDashboard','RevenueAnalyticsDashboard'],
      music: ['MusicShowcaseManager','SoundLibrary','SpotifyArtistManagement'],
      ai: ['AIMusicMatcher','AIWritingAssistant','AIBudgetOptimizer']
  },
    projects: {
      project: ['ProjectManagementPageD','ProjectTimelineManager','MusicProducerDashboardWithIntegration'],
      music: ['SoundLibrary','SpotifyArtistManagement','MusicShowcaseManager']
  },
    clients: {
      communication: ['ClientManagementPageD','ClientCommunicationDashboard','UniversalChatWidget'],
      contracts: ['ContractAnalyzer','MusicProducerContractTemplates','EnhancedContractGenerator']
  },
    equipment: {
      equipment: ['EquipmentTrackingDashboard','EquipmentManagementDB','LiveEquipmentDashboard'],
      studio: ['ComprehensiveEquipmentDashboard','EquipmentMaintenanceScheduler']
  },
    settings: {
      integrations: ['GoogleDriveFileManager','MicrosoftOneDriveIntegration','MusicProducerUltimateIntegration'],
      settings: ['MobileSettingsPage','MusicProducerSecurityCompliance','NotificationSettings']
  }
},
  vendor: {
    overview: {
      analytics: ['AnalyticsManagementDashboard','AIBudgetOptimizer','BusinessIntelligenceDashboard'],
      marketplace: ['VendorMarketplace','VendorAnalysisDialog','SmartVendorCard'],
      ai: ['AIRecommendationEngine','AIWorkflowAutomation']
  },
    projects: {
      project: ['ProjectManager','ContractTemplateManager','ProjectBackupManager'],
      marketplace: ['VendorMarketplaceMobileInterface','PartnerProductManager','RentalComparison']
  },
    clients: {
      communication: ['ClientManagementPage','ClientCommunicationDashboard','PartnerPortal'],
      contracts: ['ContractGenerator','ContractTemplateManager','SmartClauseRecommender']
  },
    equipment: {
      equipment: ['ComprehensiveEquipmentDashboard','EquipmentMaintenanceScheduler','EquipmentTrackingDashboard'],
      inventory: ['LiveEquipmentDashboard','EquipmentPricingDashboard','EquipmentSearchSystem']
  },
    settings: {
      integrations: ['GoogleDriveIntegration','MicrosoftIntegrationDemo','SeamlessWorkflowIntegration'],
      settings: ['SettingsDashboard','VendorMobileInterface','ComplianceLegalManagement']
  }
}
};

interface ComponentOrchestratorProps {
  profession?: 'photographer' | 'videographer' | 'musicproducer' | 'vendor';
  activeTab?: string;
  tabIndex?: number;
}

const professionConfigs = {
  photographer: { name: 'Fotograf', color: '#ff8c0', icon: PhotoCamera },
  videographer: { name: 'Videograf', color: '#e74c3', icon: Videocam },
  musicproducer: { name: 'Musikkprodusent', color: '#9b59b', icon: LibraryMusic },
  vendor: { name: 'Leverandø', color: '#27ae6', icon: Store }
};

export default function ComponentOrchestrator({ 
  profession = 'photographer,', 
  tabIndex = 0 
}: ComponentOrchestratorProps) {
  const queryClient = useQueryClient();
  
  // Theming system
  const theming = useTheming('photographer');
  
  // Database connection for ComponentOrchestrator
  const { data: componentData = [], isLoading } = useQuery({
    queryKey: ['/api/component','user-data'],
    queryFn: () => apiRequest('/api/component/user-data', ),
    retry: false,
});

  // Mutation for updating component data
  const updateComponentOrchestrator = useMutation({
    mutationFn: async (data: any) => {
      const auth = await getAuthHeader();
      return apiRequest('/api/component/update', {
        headers: {
          ...auth, 'Content-Type' : 'application/json'
      },
        method: 'POST',
        body: JSON.stringify(data)
    ,});
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/component', ],});
  }
});
  const config = professionConfigs[profession];
  const ProfessionIcon = config.icon;
  
  // Map tab indices to tab names
  const tabMapping = ['overview','projects','clients','equipment','files','settings'];
  const currentTab = tabMapping[tabIndex] || 'overview';
  
  // Get components for current tab and profession
  const professionMapping = professionComponentMappings[profession];
  const currentTabComponents = professionMapping[currentTab] || {};
  
  // Calculate component statistics
  const totalActiveComponents = Object.values(currentTabComponents)
    .reduce((total, categoryComponents) => total + categoryComponents.length, 0);
  
  const componentCategories = Object.keys(currentTabComponents);
  const completionPercentage = Math.round((totalActiveComponents / TOTAL_COMPONENTS) * 100);

  return (
    <Box sx={{ p:  2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <ProfessionIcon sx={{ color: config.color, fontSize: 32}} />
        <Typography variant="h5" sx={{ fontWeight: 600, color: config.color }} sx={{ ...{}, color: theming.colors.primary }}>
          Component Orchestrator - {config.name}
        </Typography>
      </Box>

      {/* Status Overview */}
      <Grid container spacing={3} sx={{ mb:  3 }}>
        <Grid size={{ xs: 12 }} md={3}>
          <MuiCard>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h4" sx={{ color: config.color }} sx={{ ...{}, color: theming.colors.primary }}>
                {totalActiveComponents}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Aktive Komponenter
              </Typography>
            </CardContent>
          </MuiCard>
        </Grid>
        <Grid size={{ xs: 12 }} md={3}>
          <MuiCard>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h4" sx={{ color: '#32cd32'}} sx={{ ...{}, color: theming.colors.primary }}>
                {TOTAL_COMPONENTS}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Totale Komponenter
              </Typography>
            </CardContent>
          </MuiCard>
        </Grid>
        <Grid size={{ xs: 12 }} md={3}>
          <MuiCard>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h4" sx={{ color: '#1976d2'}} sx={{ ...{}, color: theming.colors.primary }}>
                {componentCategories.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Kategorier
              </Typography>
            </CardContent>
          </MuiCard>
        </Grid>
        <Grid size={{ xs: 12 }} md={3}>
          <MuiCard>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h4" sx={{ color: '#9c27b0'}} sx={{ ...{}, color: theming.colors.primary }}>
                {completionPercentage}%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Aktivert
              </Typography>
            </CardContent>
          </MuiCard>
        </Grid>
      </Grid>

      {/* Current Tab Status */}
      <MuiCard sx={{ mb:  3, bgcolor: '#e3f2fd'}}>
        <CardContent sx={{ display: 'flex', alignItems: 'center', gap:  2 ,  ...theming.getThemedCardSx() }}>
          <CheckCircle sx={{ color: config.color }} />
          <Typography variant="body1">
            <strong>{currentTab.charAt(0).toUpperCase() + currentTab.slice(1)}</strong> fane er aktiv med{''}
            <strong>{totalActiveComponents} komponenter</strong> fordelt på{''}
            <strong>{componentCategories.length} kategorier</strong>
          </Typography>
        </CardContent>
      </MuiCard>

      {/* Component Categories */}
      <Grid container spacing={2}>
        {componentCategories.map((category) => {
          const components = currentTabComponents[category];
          
          return (
            <Grid size={{ xs: 12 }} md={6} lg={4} key={category}>
              <MuiCard sx={{ 
                height: '300px',
                border: `2px solid ${config.color}20`, '&:hover': { 
                  borderColor: config.color,
                  transform: 'translateY(-2px)',
                  transition: 'all 0.3s ease'
              }
            }}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <Typography variant="h6" sx={{ color: config.color, textTransform: 'capitalize'}} sx={{ ...{}, color: theming.colors.primary }}>
                      {category}
                    </Typography>
                    <Chip 
                      label={`${components.length} komponenter`}
                      size="small"
                      color="primary"
                    />
                  </Box>
                  
                  <Box sx={{ mb:  2 }}>
                    <LinearProgress 
                      variant="determinate" 
                      value={(components.length / 10) * 100} // Assuming max 10 per category
                      sx={{ 
                        height:  8, 
                        borderRadius:  4,
                        bgcolor: config.color + '2', '& .MuiLinearProgress-bar': {
                          bgcolor: config.color
                      }
                    }}
                    />
                  </Box>

                  <Box sx={{ maxHeight: '180px', overflow: 'auto'}}>
                    {components.map((component, index) => (
                      <Box 
                        key={component}
                        sx={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 1, mb:  1,
                          p:  1,
                          borderRadius:  1,
                          bgcolor: config.color + '10'
                      }}
                      >
                        <CheckCircle sx={{ color: '#4caf5', fontSize: 16}} />
                        <Typography variant="body2" sx={{ fontSize: '0.8rem'}}>
                          {component}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </CardContent>
              </MuiCard>
            </Grid>
          );
      })}
      </Grid>

      {/* System Status */}
      <MuiCard sx={{ mt:  3, bgcolor: '#f8f9fa'}}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Typography variant="h6" gutterBottom sx={{ color: config.color }} sx={{ ...{}, color: theming.colors.primary }}>
            Orchestrator System Status
          </Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12 }} sm={4}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                <CheckCircle sx={{ color: '#4caf50'}} />
                <Typography variant="body2">
                  Universal Dashboard: Aktivt
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 12 }} sm={4}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                <CheckCircle sx={{ color: '#4caf50'}} />
                <Typography variant="body2">
                  Profession Adapter: Aktivt
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 12 }} sm={4}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                <CheckCircle sx={{ color: '#4caf50'}} />
                <Typography variant="body2">
                  Component Registry: Aktivt
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </MuiCard>
    </Box>
  ); 
}