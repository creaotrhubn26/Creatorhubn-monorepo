// @ts-nocheck
import { useTheming } from '../../utils/theming-helper';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from './hooks/useDynamicProfessions';
import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
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
  InputLabel,
} from '@mui/material';
import { apiRequest } from '@/lib/queryClient';
import {
  LibraryMusic,
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
  Speed as Speed,
  Security,
  Memory,
  Storage,
  Link,
  AutoAwesome,
  Sync,
  Album,
  VolumeUp,
  Radio,
} from '@mui/icons-material';

// Musikk Produsent Orkestrering - automatiske triggere mellom komponenter
const MUSIKK_ORCHESTRATIONS = {
  nyLåt: {
    name: 'Ny Låt Produksjon Workflow',
    trigger: 'song_creation',
    actions: [
      {
        component: 'BRREGIntegration',
        action: 'validateArtist',
        autoTrigger: true
      },
      {
        component: 'GoogleDriveProjectSync', 
        action: 'createMusicProjectFolder',
        dependsOn: 'BRREGIntegration.success'
      },
      {
        component: 'SongFlowGenerator',
        action: 'initializeSongProject',
        dependsOn: 'GoogleDriveProjectSync.success'
      },
      {
        component: 'SplitSheetManager',
        action: 'createSplitSheet',
        dependsOn: 'SongFlowGenerator.initializeSongProject'
      },
      {
        component: 'ContractGenerator',
        action: 'generateMusicContract',
        dependsOn: 'SplitSheetManager.createSplitSheet'
      }
    ],
    status: 'active'
  },
  aiAudioEnhancement: {
    name: 'AI Lydbehandling og Mastering',
    trigger: 'audio_upload',
    actions: [
      {
        component: 'UniversalFileUpload',
        action: 'processAudioUpload',
        autoTrigger: true
      },
      {
        component: 'AudioEnhancementSuite',
        action: 'analyzeAudio',
        dependsOn: 'UniversalFileUpload.success'
      },
      {
        component: 'AudioEnhancementSuite',
        action: 'removeNoise',
        dependsOn: 'AudioEnhancementSuite.analyzeAudio'
      },
      {
        component: 'AudioEnhancementSuite',
        action: 'enhanceVocals',
        dependsOn: 'AudioEnhancementSuite.removeNoise'
      },
      {
        component: 'AudioEnhancementSuite',
        action: 'masterTrack',
        dependsOn: 'AudioEnhancementSuite.enhanceVocals'
      },
      {
        component: 'GoogleDriveProjectSync',
        action: 'backupEnhancedAudio',
        dependsOn: 'AudioEnhancementSuite.masterTrack'
      }
    ],
    status: 'active'
  },
  stemSeparation: {
    name: 'AI Stem Separasjon',
    trigger: 'stem_separation_requested',
    actions: [
      {
        component: 'AudioEnhancementSuite',
        action: 'analyzeMixedTrack',
        autoTrigger: true
      },
      {
        component: 'AudioEnhancementSuite',
        action: 'separateVocals',
        dependsOn: 'AudioEnhancementSuite.analyzeMixedTrack'
      },
      {
        component: 'AudioEnhancementSuite',
        action: 'separateInstruments',
        dependsOn: 'AudioEnhancementSuite.separateVocals'
      },
      {
        component: 'AudioEnhancementSuite',
        action: 'exportStems',
        dependsOn: 'AudioEnhancementSuite.separateInstruments'
      },
      {
        component: 'GoogleDriveProjectSync',
        action: 'organizeStemFolder',
        dependsOn: 'AudioEnhancementSuite.exportStems'
      }
    ],
    status: 'active'
  },
  multiTrackMixing: {
    name: 'Multi-track Mixing Workflow',
    trigger: 'mixing_session_started',
    actions: [
      {
        component: 'AudioEnhancementSuite',
        action: 'loadAllTracks',
        autoTrigger: true
      },
      {
        component: 'AudioEnhancementSuite',
        action: 'balanceLevels',
        dependsOn: 'AudioEnhancementSuite.loadAllTracks'
      },
      {
        component: 'AudioEnhancementSuite',
        action: 'applyEQ',
        dependsOn: 'AudioEnhancementSuite.balanceLevels'
      },
      {
        component: 'AudioEnhancementSuite',
        action: 'addCompression',
        dependsOn: 'AudioEnhancementSuite.applyEQ'
      },
      {
        component: 'AudioEnhancementSuite',
        action: 'renderMix',
        dependsOn: 'AudioEnhancementSuite.addCompression'
      }
    ],
    status: 'active'
  },
  splitSheetGeneration: {
    name: 'Automatisk Split Sheet Generering',
    trigger: 'song_completed',
    actions: [
      {
        component: 'SplitSheetManager',
        action: 'identifyContributors',
        autoTrigger: true
      },
      {
        component: 'SplitSheetManager',
        action: 'calculateShares',
        dependsOn: 'SplitSheetManager.identifyContributors'
      },
      {
        component: 'SplitSheetManager',
        action: 'generateDocument',
        dependsOn: 'SplitSheetManager.calculateShares'
      },
      {
        component: 'UniversalCommunication',
        action: 'requestSignatures',
        dependsOn: 'SplitSheetManager.generateDocument'
      },
      {
        component: 'GoogleDriveProjectSync',
        action: 'archiveSplitSheet',
        dependsOn: 'UniversalCommunication.requestSignatures'
      }
    ],
    status: 'active'
  },
  voiceEnhancement: {
    name: 'Profesjonell Stemmebehandling',
    trigger: 'vocal_track_uploaded',
    actions: [
      {
        component: 'AudioEnhancementSuite',
        action: 'analyzeVoice',
        autoTrigger: true
      },
      {
        component: 'AudioEnhancementSuite',
        action: 'removeBreath',
        dependsOn: 'AudioEnhancementSuite.analyzeVoice'
      },
      {
        component: 'AudioEnhancementSuite',
        action: 'tuneVocals',
        dependsOn: 'AudioEnhancementSuite.removeBreath'
      },
      {
        component: 'AudioEnhancementSuite',
        action: 'enhanceClarity',
        dependsOn: 'AudioEnhancementSuite.tuneVocals'
      },
      {
        component: 'AudioEnhancementSuite',
        action: 'applyVocalEffects',
        dependsOn: 'AudioEnhancementSuite.enhanceClarity'
      }
    ],
    status: 'active'
  },
  albulmLevering: {
    name: 'Album Levering Workflow',
    trigger: 'album_completion',
    actions: [
      {
        component: 'AudioEnhancementSuite',
        action: 'masterFinalTracks',
        autoTrigger: true
      },
      {
        component: 'MusicShowcase',
        action: 'createAlbumShowcase',
        dependsOn: 'AudioEnhancementSuite.masterFinalTracks'
      },
      {
        component: 'SplitSheetManager',
        action: 'finalizeSplitSheets',
        dependsOn: 'MusicShowcase.createAlbumShowcase'
      },
      {
        component: 'UniversalChatWidget',
        action: 'notifyArtistDelivery',
        dependsOn: 'SplitSheetManager.finalizeSplitSheets'
      },
      {
        component: 'GoogleDriveProjectSync',
        action: 'archiveMusicProject',
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
  { name: 'Audio Processing Queue', value: 0, unit: ',', type: 'audio', threshold: 15,},
  { name: 'Active Sessions', value: 0, unit: ',', type: 'sessions', threshold: 25,}
];

interface MusikkProdusentOrchestratorProps {
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

export default function MusikkProdusentOrchestrator({ 
  sessionId,
  activeWorkflow = 'nyLåt',
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
}: MusikkProdusentOrchestratorProps) {
  const [selectedOrchestration, setSelectedOrchestration] = useState(activeWorkflow);
  const [showSystemMetrics, setShowSystemMetrics] = useState(false);
  const [orchestrationStates, setOrchestrationStates] = useState<OrchestrationState>({});
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [triggerDialogOpen, setTriggerDialogOpen] = useState(false);
  const [manualTriggerData, setManualTriggerData] = useState<any>({});

  const queryClient = useQueryClient();
  
  // Theming system
  const theming = useTheming('music_producer');
  
  // Profession system integration
  const { user } = useAuth();
  const { professionConfigs, isLoading: configLoading } = useProfessionConfigs();
  const professionAdapter = useProfessionAdapter();
  const professionIcon = getProfessionIcon('music_producer');
  const { professions: dynamicProfessions } = useDynamicProfessions();
  const activeProfession = professionAdapter?.profession || 'music_producer';
  const professionConfig = professionConfigs?.[activeProfession];
  const dynamicProfession = dynamicProfessions?.[activeProfession];
  const professionDisplayName = dynamicProfession?.displayName || 'Musikk Produsent';
  const projectTypes = professionAdapter?.getProjectTypes?.() || [];

  useEffect(() => {
    if (activeWorkflow && activeWorkflow !== selectedOrchestration) {
      setSelectedOrchestration(activeWorkflow);
    }
  }, [activeWorkflow, selectedOrchestration]);

  useEffect(() => {
    if (!sessionId && !selectedProject && !selectedClient) return;
    setManualTriggerData(prev => ({
      ...prev,
      sessionId: sessionId ?? prev.sessionId,
      projectId: selectedProject?.id ?? prev.projectId,
      clientId: selectedClient?.id ?? prev.clientId
    }));
  }, [sessionId, selectedProject, selectedClient]);

  // Orkestreringsstatuser
  const { data: orchestrationStatus = {}, isLoading } = useQuery({
    queryKey: ['/api/musikk/orchestration/status', sessionId],
    queryFn: () => apiRequest(`/api/musikk/orchestration/status/${sessionId}`),
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
    mutationFn: async ({ orchestrationId, triggerData }: { orchestrationId: string; triggerData: any }) => {
      return apiRequest(`/api/musikk/orchestration/trigger`, {
        headers: {
          "Content-Type": "application/json"
        },
        method: 'POST',
        body: { orchestrationId, triggerData, sessionId }
      });
    },
    onSuccess: (data, variables) => {
      setOrchestrationStates(prev => ({
        ...prev,
        [variables.orchestrationId]: {
          running: true,
          lastRun: new Date(),
          completedActions: [],
          failedActions: []
        }
      }));
      queryClient.invalidateQueries({ queryKey: ['/api/musikk/orchestration/status', sessionId] });
    }
  });

  const handleOrchestrationTrigger = (orchestrationId: string, triggerData?: any) => {
    const timestamp = new Date().toISOString();
    const projectContext = selectedProject || {
      id: `music-${Date.now()}`,
      name: 'Ny musikk prosjekt',
      type: orchestrationId
    };
    const clientContext = selectedClient || {
      id: `artist-${Date.now()}`,
      name: 'Ny artist'
    };

    switch (orchestrationId) {
      case 'nyLåt':
        onProjectSelect?.(projectContext);
        onClientSelect?.(clientContext);
        onProjectUpdate?.({
          ...projectContext,
          status: 'initiert',
          updatedAt: timestamp
        });
        onMeetingCreate?.({
          title: 'Kickoff for ny låt',
          projectId: projectContext.id,
          clientId: clientContext.id,
          scheduledAt: timestamp
        });
        onWorklogCreate?.({
          projectId: projectContext.id,
          description: 'Opprettet ny låt-workflow',
          loggedAt: timestamp
        });
        break;
      case 'aiAudioEnhancement':
        onFileUpload?.({
          projectId: projectContext.id,
          fileName: 'raw-audio.wav',
          uploadedAt: timestamp
        });
        onWorklogCreate?.({
          projectId: projectContext.id,
          description: 'AI lydforbedring startet',
          loggedAt: timestamp
        });
        onProjectUpdate?.({
          ...projectContext,
          status: 'audio-enhancement',
          updatedAt: timestamp
        });
        break;
      case 'stemSeparation':
        onFileUpload?.({
          projectId: projectContext.id,
          fileName: 'mixdown.wav',
          uploadedAt: timestamp
        });
        onFileDownload?.({
          projectId: projectContext.id,
          fileName: 'stems.zip',
          generatedAt: timestamp
        });
        onWorklogCreate?.({
          projectId: projectContext.id,
          description: 'Stem-separasjon kjort',
          loggedAt: timestamp
        });
        break;
      case 'multiTrackMixing':
        onWorklogCreate?.({
          projectId: projectContext.id,
          description: 'Multi-track mixing aktivert',
          loggedAt: timestamp
        });
        onProjectUpdate?.({
          ...projectContext,
          status: 'mixing',
          updatedAt: timestamp
        });
        break;
      case 'splitSheetGeneration':
        onClientUpdate?.({
          ...clientContext,
          lastUpdated: timestamp,
          splitSheetStatus: 'requested'
        });
        onProjectUpdate?.({
          ...projectContext,
          status: 'split-sheet',
          updatedAt: timestamp
        });
        onFileDownload?.({
          projectId: projectContext.id,
          fileName: 'split-sheet.pdf',
          generatedAt: timestamp
        });
        break;
      case 'voiceEnhancement':
        onFileUpload?.({
          projectId: projectContext.id,
          fileName: 'vocals.wav',
          uploadedAt: timestamp
        });
        onWorklogCreate?.({
          projectId: projectContext.id,
          description: 'Vocal enhancement startet',
          loggedAt: timestamp
        });
        break;
      case 'albulmLevering':
        onShowcaseCreate?.({
          projectId: projectContext.id,
          title: 'Album levering',
          createdAt: timestamp
        });
        onFileDownload?.({
          projectId: projectContext.id,
          fileName: 'album-master.zip',
          generatedAt: timestamp
        });
        onProjectUpdate?.({
          ...projectContext,
          status: 'delivered',
          updatedAt: timestamp
        });
        onClientUpdate?.({
          ...clientContext,
          lastUpdated: timestamp,
          deliveryStatus: 'sent'
        });
        break;
      default:
        break;
    }

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

  const getMetricIcon = (metric: any) => {
    switch (metric.type) {
      case 'performance':
        return <Speed sx={{ color: getMetricColor(metric) }} />;
      case 'storage':
        return <Storage sx={{ color: getMetricColor(metric) }} />;
      case 'network':
        return <Cloud sx={{ color: getMetricColor(metric) }} />;
      case 'audio':
        return <VolumeUp sx={{ color: getMetricColor(metric) }} />;
      case 'sessions':
        return <Radio sx={{ color: getMetricColor(metric) }} />;
      default:
        return <Memory sx={{ color: getMetricColor(metric) }} />;
    }
  };

  const getOrchestrationStatusColor = (orchestrationKey: string) => {
    const state = orchestrationStates[orchestrationKey] || orchestrationStatus[orchestrationKey];
    if (state?.running) return '#4caf50'; // Green
    const orchestration = MUSIKK_ORCHESTRATIONS[orchestrationKey as keyof typeof MUSIKK_ORCHESTRATIONS];
    if (orchestration?.status === 'active') return '#9b59b6'; // Purple
    return '#757575'; // Gray
};

  const resolvedMetrics = SYSTEM_METRICS.map((metric) => {
    const liveMetric = Array.isArray(systemMetrics)
      ? systemMetrics.find((item: any) => item?.name === metric.name)
      : systemMetrics?.[metric.name] || systemMetrics?.[metric.type];
    const rawValue = Number(liveMetric?.value ?? metric.value);
    return {
      ...metric,
      value: Number.isFinite(rawValue) ? rawValue : metric.value
    };
  });
  const performanceMetric = resolvedMetrics.find((metric) => metric.type === 'performance');
  const sessionMetric = resolvedMetrics.find((metric) => metric.type === 'sessions');

  if (isLoading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '400px',
        background: 'linear-gradient(135deg, #8e44ad 0%, #9b59b6 100%)',
        borderRadius: '16px'
  }}>
        <LinearProgress sx={{ width: '200px', height: '6px', borderRadius: '3px'}} />
      </Box>
    );
}

  const orchestrationConfig = selectedOrchestration
    ? MUSIKK_ORCHESTRATIONS[selectedOrchestration as keyof typeof MUSIKK_ORCHESTRATIONS]
    : undefined;
  const userDisplayName = user?.name || user?.email || 'Bruker';

  return (
    <Box sx={{ p: 3 }}>
      {/* Header med musikk produsent-identitet */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
        <Box sx={{ display: 'flex', color: theming.colors.primary, fontSize: 40 }}>
          {professionIcon || <Album sx={{ color: '#9b59b0', fontSize: 40 }} />}
        </Box>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, color: theming.colors.primary }}>
            {professionDisplayName} Orkestrering
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Automatisk sammenkobling av musikk produksjon komponenter
          </Typography>
        </Box>
        <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
          <Tooltip title={showSystemMetrics ? 'Skjul system metrics' : 'Vis system metrics'}>
            <IconButton
              onClick={() => setShowSystemMetrics(prev => !prev)}
              sx={{ bgcolor: '#f5f5f5' }}
            >
              {showSystemMetrics ? <VisibilityOff /> : <Visibility />}
            </IconButton>
          </Tooltip>
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
            sx={{ bgcolor: '#9b59b6'}}
          >
            Manual Trigger
          </Button>
        </Box>
      </Box>

      <Divider sx={{ mb: 3 }} />

      {/* Kontekst og raske kontroller */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <MuiCard>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <People sx={{ color: theming.colors.primary }} />
                <Typography variant="h6">Produksjonskontekst</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Innlogget: {userDisplayName}
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Typography variant="body2" sx={{ mb: 1 }}>
                Prosjekt: {selectedProject?.name || 'Ikke valgt'}
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                Artist: {selectedClient?.name || 'Ikke valgt'}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<LibraryMusic />}
                  onClick={() => onProjectSelect?.({
                    id: `music-${Date.now()}`,
                    name: 'Demo musikk prosjekt'
                  })}
                >
                  Velg prosjekt
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<People />}
                  onClick={() => onClientSelect?.({
                    id: `artist-${Date.now()}`,
                    name: 'Demo artist'
                  })}
                >
                  Velg artist
                </Button>
              </Box>
            </CardContent>
          </MuiCard>
        </Grid>
        <Grid item xs={12} md={4}>
          <MuiCard>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Settings sx={{ color: theming.colors.primary }} />
                <Typography variant="h6">Profesjon innsikt</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Aktiv profil: {professionDisplayName}
              </Typography>
              {configLoading && <LinearProgress sx={{ my: 2 }} />}
              <Typography variant="body2" sx={{ mt: 1 }}>
                Dynamiske profesjoner: {Object.keys(dynamicProfessions || {}).length}
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Typography variant="body2" sx={{ mb: 1 }}>
                Prosjekttyper
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {projectTypes.length === 0 && (
                  <Chip size="small" label="Ingen typer" />
                )}
                {projectTypes.map((type: string) => (
                  <Chip key={type} size="small" label={type} color="primary" />
                ))}
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
                <AutoAwesome sx={{ color: theming.colors.primary }} />
                <Typography variant="caption" color="text.secondary">
                  {professionConfig?.specialFeatures?.length || 0} spesialfunksjoner aktivert
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                <TimelineIcon sx={{ color: theming.colors.primary }} />
                <Typography variant="caption" color="text.secondary">
                  {Object.keys(MUSIKK_ORCHESTRATIONS).length} orkestreringer aktive
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                <TrendingUp sx={{ color: theming.colors.primary }} />
                <Typography variant="caption" color="text.secondary">
                  Performance: {performanceMetric?.value ?? 0}{performanceMetric?.unit || ''}
                </Typography>
              </Box>
            </CardContent>
          </MuiCard>
        </Grid>
        <Grid item xs={12} md={4}>
          <MuiCard>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Build sx={{ color: theming.colors.primary }} />
                <Typography variant="h6">Hurtigverktøy</Typography>
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<PlayCircle />}
                  onClick={() => onWorklogCreate?.({
                    projectId: selectedProject?.id,
                    description: 'Startet ny produksjonsrunde',
                    loggedAt: new Date().toISOString()
                  })}
                >
                  Start
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<Pause />}
                  onClick={() => onWorklogCreate?.({
                    projectId: selectedProject?.id,
                    description: 'Satte produksjon pa pause',
                    loggedAt: new Date().toISOString()
                  })}
                >
                  Pause
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<Refresh />}
                  onClick={() => handleOrchestrationTrigger(selectedOrchestration)}
                >
                  Oppdater
                </Button>
              </Box>
              <Divider sx={{ my: 2 }} />
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CheckCircle sx={{ color: '#4caf50' }} />
                  <Typography variant="caption">Automatisering klar</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Warning sx={{ color: '#ff9800' }} />
                  <Typography variant="caption">Audio queue overvaket</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Info sx={{ color: '#2196f3' }} />
                  <Typography variant="caption">Sync aktiv</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Error sx={{ color: '#f44336' }} />
                  <Typography variant="caption">Ingen kritiske feil</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Security sx={{ color: '#607d8b' }} />
                  <Typography variant="caption">Sikkerhetsstatus OK</Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
                <Sync sx={{ color: theming.colors.primary }} />
                <Typography variant="caption" color="text.secondary">
                  Cloud sync aktiv - {sessionMetric?.value ?? 0} sesjoner overvaket
                </Typography>
              </Box>
            </CardContent>
          </MuiCard>
        </Grid>
      </Grid>

	      {/* System Metrics (når aktivert) */}
	      {showSystemMetrics && (
	        <Grid container spacing={2} sx={{ mb: 4 }}>
              {resolvedMetrics.map((metric, index) => (
                <Grid item xs={6} md={2} key={index}>
	              <MuiCard
	                sx={{
	                  border: `2px solid ${getMetricColor(metric)}20`, '&:hover': {
	                    borderColor: getMetricColor(metric),
	                  }}}
	              >
	                <CardContent sx={{ textAlign: 'center', py: 1, ...theming.getThemedCardSx() }}>
                      <Box sx={{ mb: 1 }}>
                        {getMetricIcon(metric)}
                      </Box>
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
	        {Object.entries(MUSIKK_ORCHESTRATIONS).map(([orchestrationKey, orchestration]) => (
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
	                    icon={
	                      orchestrationStates[orchestrationKey]?.running
	                        ? theming.getThemedIcon('sync')
	                        : theming.getThemedIcon('playCircle')
	                    }
	                  />
	                </Box>

	                {/* Trigger Info */}
	                <Box sx={{ mb: 2 }}>
	                  <Typography variant="body2" color="text.secondary">
	                    Trigger: <strong>{orchestration.trigger}</strong>
	                  </Typography>
	                  <LinearProgress
	                    variant={orchestrationStates[orchestrationKey]?.running ? 'indeterminate' : 'determinate'}
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
	                    <ListItem key={index} sx={{ px: 0 }}>
	                      <ListItemIcon sx={{ minWidth: 32 }}>
	                        <Link sx={{ fontSize: 16, color: getOrchestrationStatusColor(orchestrationKey) }} />
	                      </ListItemIcon>
	                      <ListItemText
	                        primary={action.component}
	                        secondary={action.action}
	                        primaryTypographyProps={{ variant: 'body2', fontWeight: 600}}
	                        secondaryTypographyProps={{ variant: 'caption' }}
	                      />
	                    </ListItem>
	                  ))}
	                </List>

	                {/* Control Buttons */}
	                <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
	                  <Button
	                    size="small"
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
        icon={<Album />}
      >
        <Typography variant="body1">
          <strong>Musikk Produsent Orkestrering</strong> er aktiv og overvaker {Object.keys(MUSIKK_ORCHESTRATIONS).length} automatiserte workflows.
          {sessionId && ` Sesjon: ${sessionId}`}
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
              {Object.entries(MUSIKK_ORCHESTRATIONS).map(([key, orchestration]) => (
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
            placeholder='{"genre":"elektronisk""duration" : "3: 3"}'
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
          {orchestrationConfig?.name} - Detaljer
        </DialogTitle>
        <DialogContent>
          {orchestrationConfig && (
            <Box>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>Trigger: </Typography>
              <Chip 
                label={orchestrationConfig.trigger}
                color="primary"
                sx={{ mb: 2 }}
              />
              
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>Automatiserte Aksjoner: </Typography>
              <List>
                {orchestrationConfig.actions.map((action, index) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      <Link color="primary" />
                    </ListItemIcon>
                    <ListItemText 
                      primary={action.component}
                      secondary={`${action.action}${action.dependsOn ? ` (avhenger av: ${action.dependsOn})` : ''}`}
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