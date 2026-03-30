import { useTheming } from '../../utils/theming-helper';
import React, { useState, useCallback } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  Box,
  Typography,
  Card as MuiCard,
  CardContent as MuiCardContent,
  Chip,
  Button,
  IconButton,
  useTheme,
  CircularProgress,
  Alert,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {
  Dashboard,
  Refresh,
  Analytics,
  Settings,
  Assessment,
  Group,
  Build,
  FolderOpen,
  Email,
  Article,
  Event,
  Star,
  AttachMoney,
  Chat,
  Error as ErrorIcon,
} from '@mui/icons-material';

// Import dynamic profession system
import { useDynamicProfessions, type DynamicProfessionConfig } from './hooks/useDynamicProfessions';
import getProfessionIcon from '@/utils/profession-icons';

// Import pricing administration
import PriceAdministration from '@/components/PriceAdministration';

// Import other components
import UniversalCRMDashboard from '../crm/UniversalCRMDashboard';
import { EnhancedGearTab } from '../dashboard/EnhancedGearTab';
import { VisualEditorProvider } from '../admin/visual-editor/VisualEditorContext';
import FilesTab from './tabs/FilesTab';
import IntegratedEmailCenter from '../email/EmailComposer';
import UniversalWorklog from '../worklog/UniversalWorklog';

// Import vendor-specific components
import VendorDashboard from '../vendor/VendorDashboard';
import VendorProductManager from '../vendor/VendorProductManager';
import VendorShowcase from '../vendor/VendorShowcase';
import UniversalVendorDashboard from '../vendor/UniversalVendorDashboard';

// Import Universal Components for enhanced integration
// Lazy import to avoid circular dependency
const UniversalShowcase = React.lazy(() => import('./UniversalShowcase'));
import { UniversalDownload } from './UniversalDownload';
import UniversalFileUpload from './UniversalFileUpload';

// Import Community System
import CommunityHub from '../community/CommunityHub';

interface ProfessionAdapterProps {
  profession?: string; // Now supports any dynamic profession
  activeTab?: string;
  tabIndex?: number;
  projectId?: string;
  // Integration props for unified workflow connectivity
  onMeetingCreate?: (meeting: any) => void;
  onProjectUpdate?: (project: any) => void;
  onWorklogCreate?: (worklog: any) => void;
  onClientSelect?: (client: any) => void;
  onClientUpdate?: (client: any) => void;
  onShowcaseCreate?: (showcase: any) => void;
  onFileUpload?: (file: any) => void;
  onFileDownload?: (file: any) => void;
  selectedProject?: any;
  onProjectSelect?: (project: any) => void;
  selectedClient?: any
}

// Fallback profession configuration for when API is loading or fails
const getFallbackProfessionConfig = (professionName: string) => {
  // Profession-specific creative enhancement components
  const creativeComponents = professionName === 'photographer' ?
    ['PhotoBatchProcessor','ImageHistogram','PhotoAnalysisAndFeedback','SmartSkinToneGuide','InteractiveLensVisualization'] :
    professionName === 'videographer' ?
    ['PhotoBatchProcessor','SocialMediaOptimizer'] :
    ['SocialMediaOptimizer'];

  return {
    name: professionName || 'Bruker',
    displayName: professionName || 'Bruker',
    iconColor: '#ff8c00',
    isActive: true,
    sortOrder: 0,
    icon: getProfessionIcon(professionName),
    components: {
      overview: ['DashboardStats','ProjectOverview','RecentActivity', ...creativeComponents.slice(0, 2)],
      projects: ['ProjectManager','ClientProjects','ProjectTimeline'],
      pricing: [''],
      contracts: ['ContractManager','DigitalSignatures'],
      clients: ['UniversalCRMDashboard','ClientCommunication'],
      equipment: ['EnhancedGearTab','EquipmentManager', ...creativeComponents.slice(2, 4)],
      files: ['FilesTab','GoogleDriveIntegration', ...creativeComponents.slice(4)],
      email: [''],
      worklog: [''],
      settings: ['SystemSettings','GoogleIntegration'],
      // Universal Components available for all professions
      showcase: [', '],
      downloads: [','],
      upload: ['UniversalFileUpload']
    }
  };
};

// Tab mapping
// NOTE: Community tab added at index 2 for photographer, videographer, music_producer
// All subsequent indices shifted by +1 for these professions
const tabMapping: Record<number, string> = {
  0: 'overview',
  1: 'projects',
  2: 'community', // NEW - Community tab (not for vendor)
  3: 'contracts', // Was 2
  4: 'pricing', // Was 3 (or timeline for photographer)
  5: 'showcase', // Was 4
  6: 'downloads', // Was 5
  7: 'upload', // Was 6
  8: 'email', // Was 7
  9: 'worklog', // Was 8
  10: 'clients', // Was 9
  11: 'equipment', // Was 10
  12: 'files', // Was 11
  13: 'settings', // Was 12
  14: 'communication' // Was 13
};

// Component registry for dynamic rendering
const componentRegistry: Record<string, React.ComponentType<any>> = {
  PriceAdministration: PriceAdministration,
  UniversalCRMDashboard: UniversalCRMDashboard,
  EnhancedGearTab: EnhancedGearTab,
  FilesTab: FilesTab,
  IntegratedEmailCenter: IntegratedEmailCenter,
  UniversalWorklog: UniversalWorklog,
  // Universal Components
  UniversalShowcase: UniversalShowcase,
  UniversalDownload: UniversalDownload,
  UniversalFileUpload: UniversalFileUpload,
  // Community System
  CommunityHub: CommunityHub,
  // Vendor-specific components
  VendorDashboard: VendorDashboard,
  VendorProductManager: VendorProductManager,
  VendorShowcase: VendorShowcase,
  UniversalVendorDashboard: UniversalVendorDashboard,
  UniversalVendorOnboarding: React.lazy(() => import('../vendor/UniversalVendorOnboarding')),
  // Creative Enhancement Components (protokoll-integrerte)
  PhotoBatchProcessor: React.lazy(() => import('../photo-editing/PhotoBatchProcessor')),
  ImageHistogram: React.lazy(() => import('../photo-editing/ImageHistogram')),
  InteractiveLensVisualization: React.lazy(() => import('../photo-editing/InteractiveLensVisualization')),
  PhotoAnalysisAndFeedback: React.lazy(() => import('../photo-editing/PhotoAnalysisAndFeedback')),
  SmartSkinToneGuide: React.lazy(() => import('../photo-editing/SmartSkinToneGuide')),
  SocialMediaOptimizer: React.lazy(() => import('../social-media/social-media-optimizer-dialog')),
  // Add more components as needed
};

export default function ProfessionAdapter({ 
  profession = 'photographer', 
  activeTab = 'overview',
  tabIndex = 0,
  projectId = 'demo-project-123',
  onMeetingCreate,
  onProjectUpdate,
  onWorklogCreate,
  onClientSelect,
  onClientUpdate,
  onShowcaseCreate,
  onFileUpload,
  onFileDownload,
  selectedProject,
  onProjectSelect,
  selectedClient
}: ProfessionAdapterProps) {
  const [refreshKey, setRefreshKey] = useState(0);
  const theme = useTheme();
  const { user } = useAuth();
  
  // Theming system
  const theming = useTheming('photographer');
  
  // Use dynamic profession system
  const { professionConfigs, isLoading, error } = useDynamicProfessions();

  // Fetch profession stats from API
  const { data: professionStats } = useQuery({
    queryKey: ['profession-stats', profession, user?.id],
    queryFn: () => apiRequest(`/api/professions/${profession}/stats`),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000 // 5 minutes
  });

  // Callback handlers that wire props to child component actions
  const handleMeetingCreate = useCallback((meetingData: Record<string, unknown>) => {
    if (onMeetingCreate) {
      onMeetingCreate({ ...meetingData, profession, createdBy: user?.id });
    }
  }, [onMeetingCreate, profession, user?.id]);

  const handleProjectUpdate = useCallback((projectData: Record<string, unknown>) => {
    if (onProjectUpdate) {
      onProjectUpdate({ ...projectData, updatedAt: new Date().toISOString() });
    }
  }, [onProjectUpdate]);

  const handleWorklogCreate = useCallback((worklogData: Record<string, unknown>) => {
    if (onWorklogCreate) {
      onWorklogCreate({ ...worklogData, profession, userId: user?.id });
    }
  }, [onWorklogCreate, profession, user?.id]);

  const handleClientSelect = useCallback((client: Record<string, unknown>) => {
    if (onClientSelect) {
      onClientSelect(client);
    }
  }, [onClientSelect]);

  const handleClientUpdate = useCallback((client: Record<string, unknown>) => {
    if (onClientUpdate) {
      onClientUpdate({ ...client, updatedAt: new Date().toISOString() });
    }
  }, [onClientUpdate]);

  const handleShowcaseCreate = useCallback((showcaseData: Record<string, unknown>) => {
    if (onShowcaseCreate) {
      onShowcaseCreate({ ...showcaseData, profession, userId: user?.id });
    }
  }, [onShowcaseCreate, profession, user?.id]);

  const handleFileUpload = useCallback((file: Record<string, unknown>) => {
    if (onFileUpload) {
      onFileUpload({ ...file, uploadedBy: user?.id, profession });
    }
  }, [onFileUpload, user?.id, profession]);

  const handleFileDownload = useCallback((file: Record<string, unknown>) => {
    if (onFileDownload) {
      onFileDownload({ ...file, downloadedBy: user?.id });
    }
  }, [onFileDownload, user?.id]);

  const handleProjectSelect = useCallback((project: Record<string, unknown>) => {
    if (onProjectSelect) {
      onProjectSelect(project);
    }
  }, [onProjectSelect]);
  
  // Get config for current profession (with fallback)
  const config = professionConfigs[profession] || getFallbackProfessionConfig(profession);
  
  // Map tab indices to tab names
  const currentTab = tabMapping[tabIndex] || activeTab;
  
  // Get components for current tab
  type ComponentTabKey = keyof NonNullable<DynamicProfessionConfig['components']>;
  const currentComponents = config.components?.[currentTab as ComponentTabKey] || [];

  // Show loading state
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200}}>
        <CircularProgress />
        <Typography variant="body2" sx={{ ml:  2 }}>
          Laster profesjonsinnstillinger...
        </Typography>
      </Box>
    );
}

  // Show error state
  if (error) {
    return (
      <Alert severity="warning" icon={<ErrorIcon />} sx={{ m:  2 }}>
        <Typography variant="body2">
          Kunne ikke laste profesjonsinnstillinger. Bruker fallback-innstillinger.
        </Typography>
      </Alert>
    );
}

  // Handle specific tab content rendering
  const renderTabContent = () => {
    switch (currentTab) {
      case 'community':
        // Community tab only for photographer, videographer, music_producer (NOT vendor)
        if (profession === 'vendor') {
          return (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body1" color="text.secondary">
                Community er ikke tilgjengelig for leverandører.
              </Typography>
            </Box>
          );
        }
        return <CommunityHub userId={projectId} profession={profession} />;

      case 'academy': {
        // Academy tab only for mentors/instructors
        const AcademyDashboard = React.lazy(() => import('../academy/AcademyDashboardCinematic'));
        return (
          <React.Suspense fallback={
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
              <CircularProgress />
            </Box>
          }>
            <AcademyDashboard />
          </React.Suspense>
        );
      }

      case 'pricing':
        return (
          <Box sx={{ p: 3 }}>
            <Typography variant="h5" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', mb: 3, color: theming.colors.primary }}>
              <AttachMoney sx={{ mr: 2, fontSize: 32 }} />
              Prisadministrasjon
            </Typography>
            <PriceAdministration profession={profession} />
          </Box>
        );

      case 'clients':
        return (
          <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
              <Typography variant="h5" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', flex: 1, color: theming.colors.primary }}>
                <Group sx={{ mr: 2, fontSize: 32 }} />
                {profession === 'music_producer' ? 'Artister' : 'Kunder'}
              </Typography>
              {selectedClient && (
                <Chip
                  label={`Valgt: ${selectedClient.name || selectedClient.id || 'Klient'}`}
                  color="primary"
                  size="small"
                  sx={{ mr: 1 }}
                />
              )}
            </Box>
            <UniversalCRMDashboard
              profession={profession}
              onCustomerSelect={(customer) => {
                handleClientSelect({ ...customer } as unknown as Record<string, unknown>);
              }}
              onProjectCreate={(customer, projectData) => {
                handleClientUpdate({ ...customer, projectData, updatedAt: new Date().toISOString() } as unknown as Record<string, unknown>);
              }}
            />
          </Box>
        );

      case 'equipment':
        return (
          <Box sx={{ p: 3, height: 'calc(100vh - 200px)', overflow: 'auto' }}>
            <Typography variant="h5" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', mb: 3, color: theming.colors.primary }}>
              <Build sx={{ mr: 2, fontSize: 32 }} />
              {profession === 'music_producer' ? 'Studio' : profession === 'vendor' ? 'Lager' : 'Utstyr'}
            </Typography>
            <VisualEditorProvider>
              <EnhancedGearTab
                profession={profession as 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'enterprise'}
                className="enhanced-equipment-tab"
              />
            </VisualEditorProvider>
          </Box>
        );

      case 'files':
        return (
          <Box sx={{ p: 3 }}>
            <Typography variant="h5" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', mb: 3, color: theming.colors.primary }}>
              <FolderOpen sx={{ mr: 2, fontSize: 32 }} />
              Filer
            </Typography>
            <FilesTab
              profession={profession as 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'enterprise'}
              userId={projectId}
              onFileUpload={(file) => handleFileUpload(file)}
              onFileDownload={(file) => handleFileDownload(file)}
            />
          </Box>
        );

      case 'email':
        return (
          <Box sx={{ p: 3 }}>
            <Typography variant="h5" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', mb: 3, color: theming.colors.primary }}>
              <Email sx={{ mr: 2, fontSize: 32 }} />
              E-post
            </Typography>
            <IntegratedEmailCenter profession={profession} userId={projectId} />
          </Box>
        );
        
      case 'worklog':
        return (
          <Box sx={{ p:  3 }}>
            <Typography variant="h5" sx={{  fontWeight: 600, color: config.iconColor, display: 'flex', alignItems: 'center', mb:  3  }}>
              <Article sx={{ mr: 2, fontSize: 32}} />
              Arbeidslogg
            </Typography>
            <UniversalWorklog 
              projectId={selectedProject?.id || projectId}
              userId={projectId}
              profession={profession as 'photographer' | 'videographer' | 'musicproducer' | 'vendor' | 'enterprise'}
              onWorklogCreate={(worklog) => handleWorklogCreate(worklog)}
            />
          </Box>
        );
        
      case 'showcase':
        return (
          <Box sx={{ p: 0, height: 'calc(100vh - 200px)', overflow: 'auto'}}>
            <Typography variant="h5" sx={{  fontWeight: 600, color: config.iconColor, display: 'flex', alignItems: 'center', mb:  3, p:  3  }}>
              <Star sx={{ mr: 2, fontSize: 32}} />
              {profession === 'music_producer' ? 'Musikk Showcase' : profession === 'vendor' ? 'Produkt Showcase' : 'Showcase'}
            </Typography>
            <React.Suspense fallback={<CircularProgress />}>
              <UniversalShowcase
                profession={profession as 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'enterprise'}
                userId={projectId}
                maxItems={50}
                onItemSelect={(item: Record<string, unknown>) => handleShowcaseCreate(item)}
              />
            </React.Suspense>
          </Box>
        );
        
      case 'downloads':
        return (
          <Box sx={{ p:  3, height: 'calc(100vh - 200px, )', overflow: 'auto'}}>
            <Typography variant="h5" sx={{  fontWeight: 600, color: config.iconColor, display: 'flex', alignItems: 'center', mb:  3  }}>
              <Assessment sx={{ mr: 2, fontSize: 32}} />
              {profession === 'music_producer' ? 'Musikk Downloads' : 'Downloads'}
            </Typography>
            <UniversalDownload
              items={[]}
              profession={profession as 'photographer' | 'videographer' | 'music_producer' | 'designer'}
            />
          </Box>
        );
        
      case 'upload':
        return (
          <Box sx={{ p:  3, height: 'calc(100vh - 200px)', overflow: 'auto'}}>
            <Typography variant="h5" sx={{  fontWeight: 600, color: config.iconColor, display: 'flex', alignItems: 'center', mb:  3  }}>
              <Settings sx={{ mr: 2, fontSize: 32}} />
              {profession === 'music_producer' ? 'Musikk Upload' : profession === 'vendor' ? 'Produkt Upload' : 'File Upload'}
            </Typography>
            <UniversalFileUpload
              profession={profession as 'photographer' | 'videographer' | 'music_producer' | 'designer'}
              onFilesSelected={(files: File[]) => files.forEach(file => handleFileUpload({ name: file.name, size: file.size, type: file.type }))}
            />
          </Box>
        );
        
      case 'communication':
        return (
          <Box sx={{ p: 3 }}>
            <Typography variant="h5" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', mb: 3, color: theming.colors.primary }}>
              <Chat sx={{ mr: 2, fontSize: 32 }} />
              Kommunikasjon
            </Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <MuiCard sx={{ p: 2 }}>
                  <MuiCardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <Event sx={{ color: theme.palette.primary.main }} />
                      <Typography variant="h6">Møter</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Planlegg og administrer møter med kunder og samarbeidspartnere.
                    </Typography>
                    <Button
                      variant="contained"
                      startIcon={<Event />}
                      onClick={() => handleMeetingCreate({
                        title: 'Nytt møte',
                        profession,
                        projectId: selectedProject?.id || projectId,
                        scheduledAt: new Date().toISOString()
                      })}
                      sx={{ backgroundColor: theme.palette.primary.main }}
                    >
                      Nytt Møte
                    </Button>
                  </MuiCardContent>
                </MuiCard>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <MuiCard sx={{ p: 2 }}>
                  <MuiCardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <Chat sx={{ color: theme.palette.secondary.main }} />
                      <Typography variant="h6">Meldinger</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      Direkte kommunikasjon med kunder og team.
                    </Typography>
                  </MuiCardContent>
                </MuiCard>
              </Grid>
            </Grid>
          </Box>
        );

      default: return (
          <Box sx={{ p: 2 }}>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
              {config.icon ? React.cloneElement(config.icon, { sx: { color: config.iconColor, fontSize: 32} }) : <Dashboard sx={{ color: config.iconColor, fontSize: 32 }} />}
              <Typography variant="h5" sx={{  fontWeight: 600, color: config.iconColor  }}>
                {config.displayName} Orchestrator
              </Typography>
              <Chip 
                label={`${currentComponents.length} aktive komponenter`}
                color="primary" 
                size="small"
                sx={{ ml: 'auto'}}
              />
            </Box>

            {/* Profession Stats */}
            {professionStats && (
              <MuiCard sx={{ mb: 3, bgcolor: theme.palette.background.default }}>
                <MuiCardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                    <Chip label={`Prosjekter: ${professionStats.projectCount || 0}`} size="small" variant="outlined" />
                    <Chip label={`Kunder: ${professionStats.clientCount || 0}`} size="small" variant="outlined" />
                    <Chip label={`Filer: ${professionStats.fileCount || 0}`} size="small" variant="outlined" />
                  </Box>
                </MuiCardContent>
              </MuiCard>
            )}

            {/* Selected Project Context */}
            {selectedProject && (
              <MuiCard sx={{ mb: 3, bgcolor: config.iconColor + '08', border: `1px solid ${config.iconColor}30` }}>
                <MuiCardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <FolderOpen sx={{ color: config.iconColor }} />
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        {selectedProject.name || selectedProject.title || 'Valgt prosjekt'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {selectedProject.status || 'Aktiv'}
                      </Typography>
                    </Box>
                    <IconButton
                      size="small"
                      onClick={() => handleProjectUpdate({ ...selectedProject, lastAccessed: new Date().toISOString() })}
                    >
                      <Refresh />
                    </IconButton>
                  </Box>
                </MuiCardContent>
              </MuiCard>
            )}

            {/* Active Tab Info */}
            <MuiCard sx={{ mb:  3, bgcolor: config.iconColor + '10'}}>
              <MuiCardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                  <Dashboard sx={{ color: config.iconColor }} />
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                    {currentTab.charAt(0).toUpperCase() + currentTab.slice(1)} Komponenter
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => setRefreshKey(prev => prev + 1)}
                    sx={{ color: config.iconColor }}
                  >
                    <Refresh />
                  </IconButton>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Refresh />}
                    onClick={() => setRefreshKey(prev => prev + 1)}
                    sx={{ ml: 'auto', borderColor: config.iconColor, color: config.iconColor }}
                  >
                    Oppdater
                  </Button>
                </Box>
              </MuiCardContent>
            </MuiCard>

            {/* Component Grid */}
            <Grid container spacing={2}>
              {currentComponents.map((componentName: string, index: number) => {
                const Component = componentRegistry[componentName];

                return (
                  <Grid size={{ xs: 12, md: 6, lg: 4 }} key={`${componentName}-${index}`}>
                    <MuiCard sx={{
                      height: '200px',
                      border: `2px solid ${config.iconColor}20`, '&:hover': {
                        borderColor: config.iconColor,
                        transform: 'translateY(-2px)',
                        transition: 'all 0.3s ease'
                      }
                    }}>
                      <MuiCardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                          <Analytics sx={{ color: config.iconColor, fontSize: 20 }} />
                          <Typography variant="h6" sx={{ fontSize: '0.9rem', fontWeight: 600, color: theming.colors.primary }}>
                            {componentName}
                          </Typography>
                          <Chip label={`#${index + 1}`} size="small" variant="outlined" sx={{ ml: 'auto', fontSize: '0.7rem' }} />
                        </Box>

                        {Component ? (
                          <React.Suspense fallback={
                            <Box sx={{
                              flex: 1,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'text.secondary'
                            }}>
                              Laster...
                            </Box>
                          }>
                            <Box sx={{ flex: 1, overflow: 'hidden' }}>
                              {componentName === 'UniversalVendorDashboard' && profession === 'vendor' ? (
                                <Component
                                  vendorType={(config as DynamicProfessionConfig & { vendorType?: string }).vendorType || 'software'}
                                  vendorName="Demo Vendor"
                                  userId={projectId}
                                  compact={true}
                                  key={refreshKey}
                                  onProjectSelect={handleProjectSelect}
                                />
                              ) : (
                                <Component
                                  profession={profession}
                                  userId={projectId}
                                  compact={true}
                                  key={refreshKey}
                                  selectedProject={selectedProject}
                                  onProjectUpdate={handleProjectUpdate}
                                />
                              )}
                            </Box>
                          </React.Suspense>
                        ) : (
                          <Box sx={{
                            flex: 1,
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            color:'text.secondary'
                      }}>
                            Komponent ikke tilgjengelig
                          </Box>
                        )}
                      </MuiCardContent>
                    </MuiCard>
                  </Grid>
                );
            })}
            </Grid>
          </Box>
        );
  }
};

  return (
    <Box key={refreshKey}>
      {renderTabContent()}
    </Box>
  );
}
