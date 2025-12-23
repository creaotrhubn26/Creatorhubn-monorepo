import { useTheming } from '../../utils/theming-helper';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from './hooks/useDynamicProfessions';
import React, { useState, useEffect } from 'react';
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
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Switch,
  FormControlLabel,
  Tooltip,
  Alert,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material';
import { apiRequest } from '@/lib/queryClient';
import { 
  Videocam, 
  Settings, 
  TrendingUp as TimelineIcon, 
  People, 
  Build, 
  Cloud, 
  CheckCircle, 
  Warning, 
  Error,
  Info,
  PlayCircle,
  Pause,
  Refresh,
  Visibility,
  VisibilityOff,
  TrendingUp,
  Speed,
  Security,
  Memory,
  Storage,
  Link,
  AutoAwesome,
  Sync,
  Movie,
  Edit,
  Upload,
  FilePresent
} from '@mui/icons-material';

// Videograf Orkestrering - automatiske triggere mellom komponenter
const VIDEOGRAF_ORCHESTRATIONS = {
  nyProsjekt: {
    name: 'Ny Video Prosjekt Workflow',
    trigger: 'video_project_creation',
    actions: [
      {
        component: 'BRREGIntegration',
        action: 'validateClient',
        autoTrigger: true
      },
      {
        component: 'GoogleDriveProjectSync', 
        action: 'createVideoProjectFolder',
        dependsOn: 'BRREGIntegration.success'
      },
      {
        component: 'StoryArcStudio',
        action: 'initializeProject',
        dependsOn: 'GoogleDriveProjectSync.success'
      },
      {
        component: 'ContractGenerator',
        action: 'generateVideoContract',
        dependsOn: 'StoryArcStudio.initializeProject'
      },
      {
        component: 'ShowcaseLanding',
        action: 'createProjectShowcase',
        dependsOn: 'ContractGenerator.success'
      }
    ],
    status: 'active'
  },
  aiVideoAnalysis: {
    name: 'AI Video Analyse Workflow',
    trigger: 'video_upload',
    actions: [
      {
        component: 'UniversalFileUpload',
        action: 'processVideoUpload',
        autoTrigger: true
      },
      {
        component: 'VideoAnalysisSuite',
        action: 'analyzeFootage',
        dependsOn: 'UniversalFileUpload.success'
      },
      {
        component: 'VideoAnalysisSuite',
        action: 'detectScenes',
        dependsOn: 'VideoAnalysisSuite.analyzeFootage'
      },
      {
        component: 'VideoAnalysisSuite',
        action: 'tagContent',
        dependsOn: 'VideoAnalysisSuite.detectScenes'
      },
      {
        component: 'StoryArcStudio',
        action: 'importAnalyzedFootage',
        dependsOn: 'VideoAnalysisSuite.tagContent'
      }
    ],
    status: 'active'
  },
  storyArcCreation: {
    name: 'Story Arc Automatisk Redigering',
    trigger: 'story_arc_requested',
    actions: [
      {
        component: 'StoryArcStudio',
        action: 'analyzeNarrative',
        autoTrigger: true
      },
      {
        component: 'StoryArcStudio',
        action: 'generateStoryline',
        dependsOn: 'StoryArcStudio.analyzeNarrative'
      },
      {
        component: 'StoryArcStudio',
        action: 'createTimeline',
        dependsOn: 'StoryArcStudio.generateStoryline'
      },
      {
        component: 'AudioEnhancementSuite',
        action: 'enhanceAudio',
        dependsOn: 'StoryArcStudio.createTimeline'
      },
      {
        component: 'StoryArcStudio',
        action: 'renderPreview',
        dependsOn: 'AudioEnhancementSuite.enhanceAudio'
      }
    ],
    status: 'active'
  },
  multiAngleSync: {
    name: 'Multi-Angle Synkronisering',
    trigger: 'multi_camera_upload',
    actions: [
      {
        component: 'VideoAnalysisSuite',
        action: 'detectAudioSync',
        autoTrigger: true
      },
      {
        component: 'MultiAngleSync',
        action: 'synchronizeClips',
        dependsOn: 'VideoAnalysisSuite.detectAudioSync'
      },
      {
        component: 'StoryArcStudio',
        action: 'createMultiCamTimeline',
        dependsOn: 'MultiAngleSync.synchronizeClips'
      },
      {
        component: 'FrameAccurateEditor',
        action: 'alignPrecisely',
        dependsOn: 'StoryArcStudio.createMultiCamTimeline'
      }
    ],
    status: 'active'
  },
  audioEnhancement: {
    name: 'Profesjonell Lydbehandling',
    trigger: 'audio_needs_enhancement',
    actions: [
      {
        component: 'AudioEnhancementSuite',
        action: 'analyzeAudio',
        autoTrigger: true
      },
      {
        component: 'AudioEnhancementSuite',
        action: 'removeNoise',
        dependsOn: 'AudioEnhancementSuite.analyzeAudio'
      },
      {
        component: 'AudioEnhancementSuite',
        action: 'enhanceVoice',
        dependsOn: 'AudioEnhancementSuite.removeNoise'
      },
      {
        component: 'AudioEnhancementSuite',
        action: 'masterAudio',
        dependsOn: 'AudioEnhancementSuite.enhanceVoice'
      },
      {
        component: 'StoryArcStudio',
        action: 'syncEnhancedAudio',
        dependsOn: 'AudioEnhancementSuite.masterAudio'
      }
    ],
    status: 'active'
  },
  virtualProduction: {
    name: 'Virtual Production Workflow',
    trigger: 'virtual_production_session',
    actions: [
      {
        component: 'VirtualStudio',
        action: 'initialize3DEnvironment',
        autoTrigger: true
      },
      {
        component: 'VirtualStudio',
        action: 'setupVirtualCamera',
        dependsOn: 'VirtualStudio.initialize3DEnvironment'
      },
      {
        component: 'VirtualStudio',
        action: 'loadCharacterModels',
        dependsOn: 'VirtualStudio.setupVirtualCamera'
      },
      {
        component: 'VirtualStudio',
        action: 'applyLUTGrading',
        dependsOn: 'VirtualStudio.loadCharacterModels'
      },
      {
        component: 'StoryArcStudio',
        action: 'recordVirtualShot',
        dependsOn: 'VirtualStudio.applyLUTGrading'
      }
    ],
    status: 'active'
  },
  prosjektLevering: {
    name: 'Video Levering Workflow',
    trigger: 'project_completion',
    actions: [
      {
        component: 'StoryArcStudio',
        action: 'renderFinalVideo',
        autoTrigger: true
      },
      {
        component: 'ClientGallery',
        action: 'createVideoGallery',
        dependsOn: 'StoryArcStudio.renderFinalVideo'
      },
      {
        component: 'ShowcaseLanding',
        action: 'addToShowcase',
        dependsOn: 'ClientGallery.createVideoGallery'
      },
      {
        component: 'UniversalChatWidget',
        action: 'notifyClientDelivery',
        dependsOn: 'ShowcaseLanding.addToShowcase'
      },
      {
        component: 'GoogleDriveProjectSync',
        action: 'archiveProject',
        dependsOn: 'UniversalChatWidget.success'
      }
    ],
    status: 'active'
  }
};

// Aktive orkestreringsdata
interface OrchestrationState {
  [key: string]: {
    running: boolean;
    lastRun: Date | null;
    completedActions: string[];
    failedActions: string[];
}
}

// Sanntids systemstatistikker
const SYSTEM_METRICS = [
  { name: 'CPU Usage', value: 0, unit: ', %', type: 'performance', threshold: 80,},
  { name: 'Memory Usage', value: 0, unit: ', %', type: 'performance', threshold: 85,},
  { name: 'Storage Usage', value: 0, unit: ', %', type: 'storage', threshold: 90,},
  { name: 'Network Latency', value: 0, unit: 'ms', type: 'network', threshold: 200,},
  { name: 'Render Queue', value: 0, unit: ',', type: 'video', threshold: 10,},
  { name: 'Active Projects', value: 0, unit: ', ', type: 'projects', threshold: 50,}
];

interface VideografOrchestratorProps {
  sessionId?: string;
  activeWorkflow?: string;
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

export default function VideografOrchestrator({ 
  sessionId,
  activeWorkflow = 'nyProsjekt',
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
}: VideografOrchestratorProps) {
  const [selectedOrchestration, setSelectedOrchestration] = useState(activeWorkflow);
  const [showSystemMetrics, setShowSystemMetrics] = useState(false);
  const [orchestrationStates, setOrchestrationStates] = useState<OrchestrationState>({});
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [triggerDialogOpen, setTriggerDialogOpen] = useState(false);
  const [manualTriggerData, setManualTriggerData] = useState<any>({});

  const queryClient = useQueryClient();
  
  // Theming system
  const theming = useTheming('videographer');
  
  // Profession system integration
  const { professionConfig, isLoading: configLoading } = useProfessionConfigs('videographer');
  const { professionAdapter } = useProfessionAdapter('videographer');
  const professionIcon = getProfessionIcon('videographer');
  const { professions: dynamicProfessions } = useDynamicProfessions();

  // Orkestreringsstatuser
  const { data: orchestrationStatus = {}, isLoading } = useQuery({
    queryKey: ['/api/videograf/orchestration/status', sessionId],
    queryFn: () => apiRequest(`/api/videograf/orchestration/status/${sessionId}`),
    retry: false,
    refetchInterval: 2000 // Real-time oppdateringer
  });

  // System metrics query
  const { data: systemMetrics = {} } = useQuery({
    queryKey: ['/api/system/metrics'],
    queryFn: () => apiRequest('/api/system/metrics'),
    retry: false,
    refetchInterval: 3000
  });

  // Trigger orchestration
  const triggerOrchestration = useMutation({
    mutationFn: async ({ orchestrationd, triggerData }: { orchestrationId: string, triggerData: any }) => {
      return apiRequest(`/api/videograf/orchestration/trigger`, {
        headers: {
          "Content-Type" : "application/json"
    },
        method: 'POS',
        body: { orchestrationd, triggerData, sessionId }
    });
  },
    onSuccess: (data, variables) => {
      setOrchestrationStates(prev => ({
        ...prev,
        [variables.orchestrationId]: {
          running: true,
          lastRun: new Date(),
          completedActions:  [],
          failedActions: []
    }
    }));
      queryClient.invalidateQueries({ queryKey: ['/api/videograf/orchestration/status', ],});
  }
});

  const handleOrchestrationTrigger = (orchestrationId: string, triggerData?: any) => {
    triggerOrchestration.mutate({ orchestrationId, triggerData: triggerData || {} });
};

  const openOrchestrationDetails = (orchestrationKey: string) => {
    setSelectedOrchestration(orchestrationKey);
    setDetailsOpen(true);
};

  const getMetricColor = (metric: any) => {
    if (metric.value > metric.threshold) return '#f44336'; // Red
    if (metric.value > metric.threshold * 0.8) return '#ff9800'; // Orange
    return '#4caf50'; // Green
};

  const getOrchestrationStatusColor = (orchestrationKey: string) => {
    const state = orchestrationStates[orchestrationKey] || orchestrationStatus[orchestrationKey];
    if (state?.running) return '#4caf50'; // Green
    if (VIDEOGRAF_ORCHESTRATIONS[orchestrationKey]?.status === 'active') return '#2196f3'; // Blue
    return '#757575'; // Gray
};

  if (isLoading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '400px',
        background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)',
        borderRadius: '16px'
  }}>
        <LinearProgress sx={{ width: '200px', height: '6px', borderRadius: '3px'}} />
      </Box>
    );
}

  return (
    <Box sx={{ p: 3 }}>
      {/* Header med videograf-identitet */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
        <Box sx={{ display: 'flex', color: theming.colors.primary, fontSize: 40 }}>
          {professionIcon || <Movie sx={{ color: '#e91e60', fontSize: 40 }} />}
        </Box>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, color: theming.colors.primary }}>
            {professionConfig?.displayName || 'Videograf'} Orkestrering
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Automatisk sammenkobling av video produksjon komponenter
          </Typography>
        </Box>
        <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
          <FormControlLabel
            control={
              <Switch 
                checked={showSystemMetrics}
                onChange={(e) => setShowSystemMetrics(e.target.checked)}
                color="primary"
              />
          }
            label="System Metrics"
          />
          <Button variant="contained"
            startIcon={theming.getThemedIcon('playCircle')}
            onClick={() => setTriggerDialogOpen(true)}
            sx={{ bgcolor: '#e91e63'}}
          >
            Manual Trigger
          </Button>
        </Box>
      </Box>

      {/* System Metrics (når aktivert) */}
      {showSystemMetrics && (
        <Grid container spacing={2} sx={{ mb:  4 }}>
          {systemMetrics.map((metric, index) => (
            <Grid size={{ xs:  6 }} md={2} key={index}>
	              <MuiCard
	                sx={{
	                  border: `2px solid ${getMetricColor(metric)}20`, '&:hover': {
	                    borderColor: getMetricColor(metric),
	                  }}}
	              >
	                <CardContent sx={{ textAlign: 'center', py: 1, ...theming.getThemedCardSx() }}>
	                  <Typography variant="h6" sx={{ color: getMetricColor(metric) }}>
                    {metric.value},{metric.unit}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {metric.name}
                  </Typography>
                </CardContent>
              </MuiCard>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Orkestreringer Overview */}
      <Grid container spacing={3}>
        {Object.entries(VIDEOGRAF_ORCHESTRATIONS).map(([orchestrationKey, orchestration]) => (
          <Grid item xs={12} md={6} lg={4} key={orchestrationKey}>
	            <MuiCard
	              sx={{
	                height: '400px',
	                border: `2px solid ${getOrchestrationStatusColor(orchestrationKey)}20`, '&:hover': {
	                  borderColor: getOrchestrationStatusColor(orchestrationKey),
	                  transform: 'translateY(-4px)',
	                  transition: 'all 0.3s ease',
	                  boxShadow: '0 8px 25px rgba(0,0,0,0.1)',
	                }}}
	            >
              <CardContent sx={theming.getThemedCardSx()}>
                {/* Orkestrering Header */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
	                  <Typography
	                    variant="h6"
	                    sx={{
	                      color: theming.colors.primary,
	                      fontWeight: 600}}
	                  >
                    {orchestration.name}
                  </Typography>
                  <Chip 
                    label={orchestrationStates[orchestrationKey]?.running ? 'Aktiv' : 'Klar'}
                    size="small"
                    color={orchestrationStates[orchestrationKey]?.running ? 'success' : 'default'}
                    icon={orchestrationStates[orchestrationKey]?.running ? theming.getThemedIcon('sync') : theming.getThemedIcon('playCircle')}
                  />
                </Box>

                {/* Trigger Info */}
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Trigger: <strong>{orchestration.trigger}</strong>
                  </Typography>
                  <LinearProgress 
                    variant={orchestrationStates[orchestrationKey]?.running ? "indeterminate" : "determinate"}
                    value={orchestrationStates[orchestrationKey]?.running ? undefined : 0}
	                    sx={{
	                      height: 6,
	                      borderRadius: 3,
	                      mt: 1,
	                      backgroundColor: `${getOrchestrationStatusColor(orchestrationKey)}20`,
	                      '& .MuiLinearProgress-bar': {
	                        backgroundColor: getOrchestrationStatusColor(orchestrationKey),
	                      }
	                    }}
                  />
                </Box>

	                {/* Actions Flow */}
	                <List dense sx={{ maxHeight: 10, overflow: 'auto' }}>
                  {orchestration.actions.map((action, index) => (
                    <ListItem key={index} sx={{ px:  0 }}>
	                      <ListItemIcon sx={{ minWidth: 32 }}>
	                        <Link sx={{ fontSize: 16, color: getOrchestrationStatusColor(orchestrationKey) }} />
                      </ListItemIcon>
                     <ListItemText 
                       primary={action.component}
                       secondary={action.action}
                       primaryTypographyProps={{ variant: 'body', fontWeight: 600 }}
                       secondaryTypographyProps={{ variant: 'caption' }}
                     />
                    </ListItem>
                  ))}
                </List>

                {/* Control Buttons */}
                <Box sx={{ display: 'flex', gap: 1,mt:  2 }}>
                  <Button size="small"
                    variant="contained"
                    color="primary"
                    startIcon={theming.getThemedIcon('sync')}
                    onClick={() => handleOrchestrationTrigger(orchestrationKey)}
                    disabled={triggerOrchestration.isPending}
                  >
                    Trigger
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={theming.getThemedIcon('info')}
                    onClick={() => openOrchestrationDetails(orchestrationKey)}
                  >
                    Detaljer
                  </Button>
                </Box>
              </CardContent>
            </MuiCard>
          </Grid>
        ))}
      </Grid>

      {/* Status Alert */}
      <Alert 
        severity="success" 
        sx={{ mt:  4 }}
        icon={<Movie />}
      >
        <Typography variant="body1">
          <strong>Videograf Orkestrering</strong> er aktiv og overvåker {Object.keys(VIDEOGRAF_ORCHESTRATIONS).length} automatiserte workflows.
          {sessionId && ` Sesjon: ${sessiond}`}
        </Typography>
      </Alert>

      {/* Manual Trigger Dialog */}
      <Dialog 
        open={triggerDialogOpen}
        onClose={() => setTriggerDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Manual Trigger</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt:  2 }}>
            <InputLabel>Velg Orkestrering</InputLabel>
            <Select
              value={selectedOrchestration}
              onChange={(e) => setSelectedOrchestration(e.target.value)}
            >
              {Object.entries(VIDEOGRAF_ORCHESTRATIONS).map(([key, orchestration]) => (
                <MenuItem key={key} value={key}>
                  {orchestration.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Trigger Data (JSON)"
            placeholder='{"projectType":"bryllup""duration" : "3h"}'
            value={JSON.stringify(manualTriggerData)}
            onChange={(e) => {
              try {
                setManualTriggerData(JSON.parse(e.target.value || '{}'));
            } catch {
                // Invalid JSON, ignore
            }
          }}
            sx={{ mt:  2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTriggerDialogOpen(false)}>Avbryt</Button>
          <Button variant="contained"
            onClick={() => {
              if (selectedOrchestration) {
                handleOrchestrationTrigger(selectedOrchestration, manualTriggerData);
                setTriggerDialogOpen(false);
            }
          }}
            disabled={!selectedOrchestration}
          >
            Trigger
          </Button>
        </DialogActions>
      </Dialog>

      {/* Orkestrering Details Dialog */}
      <Dialog 
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {selectedOrchestration && VIDEOGRAF_ORCHESTRATIONS[selectedOrchestration]?.name} - Detaljer
        </DialogTitle>
        <DialogContent>
          {selectedOrchestration && (
            <Box>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>Trigger: </Typography>
              <Chip 
                label={VIDEOGRAF_ORCHESTRATIONS[selectedOrchestration].trigger}
                color="primary"
                sx={{ mb: 2 }}
              />
              
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>Automatiserte Aksjoner: </Typography>
              <List>
                {VIDEOGRAF_ORCHESTRATIONS[selectedOrchestration].actions.map((action, index) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      <Link color="primary" />
                    </ListItemIcon>
                    <ListItemText 
                      primary={action.component}
                      secondary={`${action.action}${action.dependsOn ? ` (avhenger av: ${action.dependsn})` :''}`}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsOpen(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}