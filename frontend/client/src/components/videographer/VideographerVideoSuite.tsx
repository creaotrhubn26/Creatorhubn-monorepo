import React, { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../utils/theming-helper';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  Tabs,
  Tab,
  Grid,
  Card as MuiCard,
  CardContent,
  IconButton,
  Paper,
  Stack,
  Slider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  LinearProgress,
  Chip,
  Divider
} from '@mui/material';
import {
  Close,
  Movie,
  Share,
  SmartToy,
  TrendingUp as TimelineIcon,
  Edit,
  Analytics,
  History,
  TrendingUp,
  VolumeUp,
  AudioFile,
  Equalizer,
  GraphicEq,
  Mic,
  MusicNote,
  Tune,
  Speed,
  AutoFixHigh
} from '@mui/icons-material';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`video-suite-tabpanel-${index}`}
      aria-labelledby={`video-suite-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p:  3 }}>{children}</Box>}
    </div>
  );
}

// Logo component
const CreatorHubVideoSuiteLogo: React.FC<{ size?: number; color?: string }> = ({ 
  size = 24, 
  color = '#FF6B35' 
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" fill={color} />
    <path d="M8 8l8 4-8 4V8z" fill="white" />
  </svg>
);

interface VideographerVideoSuiteProps {
  onClose: () => void;
  selectedVideoFiles: any[];
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
  selectedClient?: any;
  onSettingsUpdate?: (settings: any) => void;
  onNotificationCreate?: (notification: any) => void
}

export default function VideographerVideoSuite({ 
  onClose, 
  selectedVideoFiles,
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
  selectedClient,
  onSettingsUpdate,
  onNotificationCreate
}: VideographerVideoSuiteProps) {
  const [tabValue, setTabValue] = useState(0);
  const [socialMediaDialogOpen, setSocialMediaDialogOpen] = useState(false);

  // Master Integration Provider
  const { integration, communication, dataFlow, componentRegistry } = useEnhancedMasterIntegration();
  
  // Theming system
  const theming = useTheming('videographer');
  const [algorithmOptimizerOpen, setAlgorithmOptimizerOpen] = useState(false);
  const [audioProcessingOpen, setAudioProcessingOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState('instagram,');
  const [selectedSocialFormat, setSelectedSocialFormat] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [audioProcessingType, setAudioProcessingType] = useState('enhancement');
  const [audioQuality, setAudioQuality] = useState(85);
  const [initializingDependencies, setInitializingDependencies] = useState(false);

  // Fetch video suite dependency status
  const { data: suiteStatus, isLoading: statusLoading, refetch: refetchStatus } = useQuery({
    queryKey: ['/api/suite-status/video-suite/status', ],
    queryFn: async () => {
      return apiRequest('/api/suite-status/video-suite/status', {
        headers: auth
  });
  },
    refetchInterval: 5000 // Check every 5 seconds during initialization
});

  const { data: combinedStatus } = useQuery({
    queryKey: ['/api/suite-status/suites/status', ],
    queryFn: async () => {
      return apiRequest('/api/suite-status/suites/status', {
        headers: auth
  });
  },
    refetchInterval: 10000 });

  // Register component with MasterIntegrationProvider
  useEffect(() => {
    componentRegistry.registerComponent('VideographerVideoSuite', {
      type: 'video',
      capabilities: ['video-processing','social-media-export','audio-processing'],
      dataFlow: {
        sources: ['video-files','project-data','client-data'],
        destinations: ['admin-dashboard','user-interface'],
        processors: ['video-processing','social-processing']
      }
    });

    // Set up data flow nodes
    dataFlow.registerNode('video-files', {
      type: 'source',
      data: selectedVideoFiles,
      metadata: { component: 'VideographerVideoSuite', type: 'video-files' }
    });

    dataFlow.registerNode('project-data', {
      type: 'source',
      data: selectedProject,
      metadata: { component: 'VideographerVideoSuite', type: 'project-data' }
    });

    dataFlow.registerNode('client-data', {
      type: 'source',
      data: selectedClient,
      metadata: { component: 'VideographerVideoSuite', type: 'client-data' }
  });

    // Listen for video processing events
    communication.subscribe('video: process', (data) => {
      if (data.files && data.platform) {
        handleSocialMediaExport(data.files, data.platform, data.format);
    }
  });

    communication.subscribe('video: audio-process', (data) => {
      if (data.files) {
        handleAudioProcessing();
    }
  });

    return () => {
      componentRegistry.unregisterComponent('VideographerVideoSuite');
      dataFlow.unregisterNode('video-files');
      dataFlow.unregisterNode('project-data');
      dataFlow.unregisterNode('client-data');
  };
}, [selectedVideoFiles, selectedProject, selectedClient, componentRegistry, dataFlow, communication]);

  // Social platforms configuration
  const socialPlatforms = [
    {
      id: 'instagram',
      name: 'Instagram',
      icon: theming.getThemedIcon(''),
      formats: ['Story (9:16)','Post (1:1)','Reel (9:16)','IGTV (16:9)']
    },
    {
      id: 'tiktok',
      name: 'TikTok',
      icon: theming.getThemedIcon(''),
      formats: ['Vertikal (9:16)','Horisontal (16:9)']
    },
    {
      id: 'youtube',
      name: 'YouTube',
      icon: theming.getThemedIcon(', '),
      formats: ['YouTube Shorts (9:16)','Standard (16:9)','Live (16:9)']
    }
  ];

  // Video suite features
  const videoSuiteFeatures = [
    {
      title: 'Automatisk Klipping',
      description: 'AI-drevet klipping basert på innhold',
      icon: <Movie sx={{ fontSize: 40, color: '#e74c3c' }} />,
      stats: { accuracy: '94%', timeReduction: '75%' },
      action: () => console.log('Auto-klipping aktivert')
    },
    {
      title: 'Lydbehandling & Forbedring',
      description: 'Avansert lydbehandling med AI',
      icon: <VolumeUp sx={{ fontSize: 40, color: '#9b59b6' }} />,
      stats: { noiseReduction: '98%', clarity: '85%' },
      action: () => setAudioProcessingOpen(true)
    },
    {
      title: 'Sosiale Medier Format',
      description: 'Optimaliser for alle plattformer',
      icon: <Share sx={{ fontSize: 40, color: '#e91e63' }} />,
      stats: { engagement: '+156%', reach: '+89%' },
      action: () => setSocialMediaDialogOpen(true)
    },
    {
      title: 'Algoritme Optimizer',
      description: 'Maksimer synlighet og engagement',
      icon: <SmartToy sx={{ fontSize: 40, color: '#9c27b0' }} />,
      stats: { hookStrength: '85, %', retention: '78, %', viralScore: 92,},
      action: () => setAlgorithmOptimizerOpen(true)
}
  ];

  const handleAudioProcessing = async () => {
    setIsProcessing(true);
    setProcessingProgress(0);

    // Simulate AI audio processing
    const interval = setInterval(() => {
      setProcessingProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsProcessing(false);
          setAudioProcessingOpen(false);
          
          // Trigger unified workflow callbacks
          const processedVideos = selectedVideoFiles.map(file => ({
            ...file,
            audioEnhanced: true,
            audioProcessingType,
            audioQuality,
            processedAt: new Date().toISOString()
      }));
          
          onFileUpload?.(processedVideos);
          onProjectUpdate?.({
            type: 'video_audio_enhancement',
            videos: processedVideos,
            audioProcessingType,
            audioQuality
        });
          onNotificationCreate?.({
            type: 'video_audio_enhanced',
            message: `${processedVideos.length} videos audio enhanced successfully`,
            timestamp: new Date().toISOString()
      });
          
          return 100;
      }
        return prev + 5;
    });
  }, 200);
};

  const initializeDependencies = async () => {
    setInitializingDependencies(true);
    try {
      const response = await fetch('/api/suite-status/video-suite/initialize', {
        headers: {
          ...auth,
          'Content-Type': 'application/json'
        },
        method: 'POST'
      });

      if (response.ok) {
        console.log('Video Suite dependencies initialized successfully');
        refetchStatus();
      }
    } catch (error) {
      console.error('Failed to initialize dependencies: ', error);
    } finally {
      setInitializingDependencies(false);
    }
  };

  // Initialize dependencies on component mount if not ready
  useEffect(() => {
    if (suiteStatus && !suiteStatus.initialized && !initializingDependencies) {
      initializeDependencies();
    }
  }, [suiteStatus]);

  return (
    <Dialog 
      open={true}
      onClose={onClose}
      maxWidth="xl" 
      fullWidth
      sx={{
        '& .MuiDialog-paper': {
          height: '90vh',
          bgcolor: 'background.default'
    }
    }}
    >
      <DialogTitle sx={{ 
        background: 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
  }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
          <CreatorHubVideoSuiteLogo size={32} color="#FF6B35" />
          <Box>
            <Typography variant="h5" sx={{  fontWeight: 'bold'  }}>
              CreatorHub Video Suite
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9}}>
              {selectedVideoFiles.length > 0 
                ? `${selectedVideoFiles.length} video${selectedVideoFiles.length !== 1 ? 'er' : ', '} valgt`
                : 'Avanserte video verktøy med lydbehandling'
            }
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={onClose} sx={{ color: 'white' }}>
          {theming.getThemedIcon('close')}
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p:  3 }}>
        <Tabs 
          value={tabValue}
          onChange={(e, newValue) => setTabValue(newValue)}
          sx={{ mb: 3 }}
        >
          <Tab icon={<Movie />} label="Video Verktøy" />
          <Tab icon={theming.getThemedIcon('volumeUp')} label="Lydbehandling" />
          <Tab icon={theming.getThemedIcon('share')} label="Sosiale Medier" />
          <Tab icon={theming.getThemedIcon('smartToy')} label="Algoritme Optimizer" />
          <Tab icon={theming.getThemedIcon('timeline')} label="Prosjekt & Struktur" />
          <Tab icon={theming.getThemedIcon('edit')} label="Review & Godkjenning" />
          <Tab icon={theming.getThemedIcon('analytics')} label="Leveranse & Eksport" />
          <Tab icon={<History />} label="Endringshistorikk" />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            {videoSuiteFeatures.map((feature, index) => (
              <Grid size={{ xs: 12 }} md={4} key={index}>
                <MuiCard sx={{
                  height: '100%','&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 6
                  },
                  transition: 'all 0.3s ease'
            }}>
                  <CardContent sx={{ ...theming.getThemedCardSx(), textAlign: 'center', p: 3 }}>
                    <Box sx={{ mb:  2 }}>
                      {feature.icon}
                    </Box>
                    <Typography variant="h6" sx={{  mb: 1, fontWeight: 'bold'  }}>
                      {feature.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                      {feature.description}
                    </Typography>
                    <Box sx={{ mb:  2 }}>
                      {Object.entries(feature.stats).map(([key, value], idx) => (
                        <Chip
                          key={idx}
                          label={`${key}: ${value}`}
                          size="small"
                          sx={{ m: 0.5, bgcolor: '#f8f9fa' }}
                        />
                      ))}
                    </Box>
                    <Button
                      variant="contained"
                      onClick={feature.action}
                      sx={{
                        bgcolor: '#e74c3c',
                        '&:hover': { bgcolor: '#c0392b' },
                        ...theming.getThemedButtonSx()
                      }}
                    >
                      Aktiver
                    </Button>
                  </CardContent>
                </MuiCard>
              </Grid>
            ))}
          </Grid>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Typography variant="h5" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
            {theming.getThemedIcon('volumeUp')}
            Avansert Lydbehandling for Video
          </Typography>

          <Grid container spacing={3}>
            <Grid size={{ xs: 12 }}>
              <Paper sx={{ p: 3, mb: 3, bgcolor: '#f8f9fa', borderLeft: '4px solid #9b59b6', ...theming.getThemedCardSx() }}>
                <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
                  <GraphicEq />
                  AI-Drevet Lydanalyse med Avanserte Modeller
                  {statusLoading && <LinearProgress sx={{ width: 10, ml:  2 }} />}
                </Typography>
                
                {suiteStatus && (
                  <Box sx={{ mb:  2 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb:  1 }}>
                      Status: {suiteStatus.initialized ? 
                        <Chip label="Alle modeller lastet" color="success" size="small" /> :
                        <Chip label="Laster modeller..." color="warning" size="small" />
                  }
                    </Typography>
                    
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb:  2 }}>
                      {suiteStatus.dependencies?.essentia && <Chip label="Essentia.js ✓" size="small" color="primary" />}
                      {suiteStatus.dependencies?.librosa && <Chip label="Librosa ✓" size="small" color="primary" />}
                      {suiteStatus.dependencies?.rnnoise && <Chip label="RNNoise ✓" size="small" color="primary" />}
                      {suiteStatus.dependencies?.demucs && <Chip label="Demucs v4 ✓" size="small" color="primary" />}
                      {suiteStatus.dependencies?.dccrn && <Chip label="DCCRN ✓" size="small" color="primary" />}
                      {suiteStatus.dependencies?.spleeter && <Chip label="Spleeter ✓" size="small" color="primary" />}
                      {suiteStatus.dependencies?.onnxruntime && <Chip label="AI Acceleration ✓" size="small" color="secondary" />}
                    </Box>

                    <Typography variant="caption" color="text.secondary">
                      Audio Models: {suiteStatus.audioModelsCount || 0}/8 •
                      Video Models: {suiteStatus.videoModelsCount || 0}/2 •
                      AI Acceleration: {suiteStatus.aiAccelerationCount || 0}/3
                    </Typography>
                  </Box>
                )}

                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Omfattende lydkvalitetsanalyse og forbedringspotensiale med avanserte AI-modeller.
                </Typography>

                <Button
                  variant="contained"
                  startIcon={theming.getThemedIcon('autoFixHigh')}
                  sx={{ bgcolor: '#9b59b6', mr: 2, ...theming.getThemedButtonSx() }}
                  disabled={!suiteStatus?.initialized}
                  onClick={async () => {
                    console.log('Starting comprehensive audio analysis...');
                    setAudioProcessingOpen(true);
                    setAudioProcessingType('analysis');
                  }}
                >
                  {suiteStatus?.initialized ? 'Start Omfattende Lydanalyse' : 'Laster AI-modeller...'}
                </Button>
                <Button
                  variant="outlined"
                  startIcon={theming.getThemedIcon('tune')}
                  disabled={!suiteStatus?.initialized}
                  onClick={() => setAudioProcessingOpen(true)}
                >
                  Manuell Lydbehandling
                </Button>

                {!suiteStatus?.initialized && (
                  <Button
                    variant="text"
                    startIcon={theming.getThemedIcon('speed')}
                    sx={{ ml: 2 }}
                    onClick={initializeDependencies}
                    disabled={initializingDependencies}
                  >
                    {initializingDependencies ? 'Initialiserer...' : 'Geninitialisér'}
                  </Button>
                )}
              </Paper>
            </Grid>

            <Grid size={{ xs: 12 }} md={6}>
              <Paper sx={{ p: 3, height: '100%', ...theming.getThemedCardSx() }}>
                <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
                  <AudioFile />
                  Live Lydkvalitetsanalyse
                </Typography>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">Støynivå (RNNoise)</Typography>
                  <LinearProgress variant="determinate" value={25} sx={{ mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">Lydklarhet (Essentia.js)</Typography>
                  <LinearProgress variant="determinate" value={audioQuality} sx={{ mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">Dynamisk rekkevidde (Librosa)</Typography>
                  <LinearProgress variant="determinate" value={78} sx={{ mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">Taleforståelse (DCCRN)</Typography>
                  <LinearProgress variant="determinate" value={82} />
                </Box>
                <Chip
                  label="AI-modeller: 6 aktive"
                  color="primary"
                  size="small"
                  sx={{ mb: 2 }}
                />
                <Button
                  variant="outlined"
                  onClick={() => setAudioProcessingOpen(true)}
                  startIcon={theming.getThemedIcon('tune')}
                  fullWidth
                >
                  Forbedre Lydkvalitet
                </Button>
              </Paper>
            </Grid>

            <Grid size={{ xs: 12 }} md={6}>
              <Paper sx={{ p: 3, height: '100%', ...theming.getThemedCardSx() }}>
                <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
                  <Equalizer />
                  Lydbehandlingsverktøy
                </Typography>
                <Stack spacing={2}>
                  <Button
                    variant="contained"
                    startIcon={theming.getThemedIcon('mic')}
                    sx={{ bgcolor: '#9b59b6', ...theming.getThemedButtonSx() }}
                    onClick={() => { setAudioProcessingType('denoising'); setAudioProcessingOpen(true); }}
                  >
                    Støyfjerning (RNNoise + DCCRN)
                  </Button>
                  <Button variant="contained"
                    startIcon={<GraphicEq />}
                    sx={{ bgcolor: '#27ae60' }}
                    onClick={() => { setAudioProcessingType('separation'); setAudioProcessingOpen(true); }}
                  >
                    Kildeseparasjon (Demucs v4)
                  </Button>
                  <Button variant="contained"
                    startIcon={<MusicNote />}
                    sx={{ bgcolor: '#f39c12' }}
                    onClick={() => {setAudioProcessingType('enhancement'); setAudioProcessingOpen(true);}}
                  >
                    Lydrestaurering (FullSubNet)
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={theming.getThemedIcon('autoFixHigh')}
                    sx={{ bgcolor: '#e74c3c', ...theming.getThemedButtonSx() }}
                    onClick={() => { setAudioProcessingType('mastering'); setAudioProcessingOpen(true); }}
                  >
                    AI Auto-mastering
                  </Button>
                  <Divider sx={{ my: 2 }} />
                  <Button
                    variant="contained"
                    startIcon={theming.getThemedIcon('speed')}
                    sx={{ bgcolor: '#2c3e50', mb: 1, ...theming.getThemedButtonSx() }}
                    onClick={() => { setAudioProcessingType('analysis'); setAudioProcessingOpen(true); }}
                    fullWidth
                  >
                    Komplett AI-analyse (Essentia + Librosa)
                  </Button>
                  <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', display: 'block' }}>
                    Bruker 8+ AI-modeller for omfattende lydkvalitetsvurdering
                  </Typography>
                </Stack>
              </Paper>
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Paper sx={{ p: 3,...theming.getThemedCardSx() }}>
                <Typography variant="h6" sx={{ mb: 2, color: theming.colors.primary }}>
                  Lydspektrumanalyse
                </Typography>
                <Box sx={{ height: 200, bgcolor: '#f8f9fa', borderRadius: 1, p: 2, position: 'relative' }}>
                  <Typography variant="body2" sx={{ position: 'absolute', top: 8, left: 8 }}>
                    Frekvensrespons (Hz)
                  </Typography>
                  {/* Simulated audio spectrum visualization */}
                  <Box sx={{
                    display: 'flex',
                    alignItems: 'end',
                    height: '80%',
                    gap: 1,
                    mt: 3
                  }}>
                    {Array.from({ length: 50 }, (_, i) => (
                      <Box
                        key={i}
                        sx={{
                          bgcolor: '#9b59b6',
                          width: '2%',
                          height: `${Math.random() * 100}%`,
                          borderRadius: '2px 2px 0 0'
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Typography>Sosiale Medier optimalisering kommer her</Typography>
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <Typography>Algoritme Optimizer kommer her</Typography>
        </TabPanel>

        <TabPanel value={tabValue} index={4}>
          <Typography>Prosjekt & Struktur kommer her</Typography>
        </TabPanel>

        <TabPanel value={tabValue} index={5}>
          <Typography>Review & Godkjenning kommer her</Typography>
        </TabPanel>

        <TabPanel value={tabValue} index={6}>
          <Typography>Leveranse & Eksport kommer her</Typography>
        </TabPanel>

        <TabPanel value={tabValue} index={7}>
          <Typography>Endringshistorikk kommer her</Typography>
        </TabPanel>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          Lukk
        </Button>
        <Button variant="contained" sx={{ ...theming.getThemedButtonSx(), bgcolor: '#e74c3c' }}>
          Lagre Innstillinger
        </Button>
      </DialogActions>

      {/* Audio Processing Dialog */}
      <Dialog 
        open={audioProcessingOpen}
        onClose={() => setAudioProcessingOpen(false)}
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1, bgcolor: '#9b59b0', 
          color: 'white' 
    }}>
          {theming.getThemedIcon('volumeUp')}
          Lydbehandling - {audioProcessingType === 'denoising' ? 'Støyfjerning' : 
                          audioProcessingType === 'separation' ? 'Kildeseparasjon' :
                          audioProcessingType === 'enhancement' ? 'Lydrestaurering' : 'Auto-mastering'}
        </DialogTitle>
        <DialogContent sx={{ p:  3 }}>
          {isProcessing ? (
            <Box sx={{ textAlign: 'center', py:  4 }}>
              <Typography variant="h6" sx={{  mb:  2  }}>
                {audioProcessingType === 'analysis' ? 
                  'Analyserer lyd med AI-modeller...' : 
                  'Behandler lyd med AI...'}
              </Typography>
              <LinearProgress variant="determinate" value={processingProgress} sx={{ mb: 2 }} />
              <Typography variant="body2" color="text.secondary">
                {processingProgress}% fullført
              </Typography>
              {audioProcessingType === 'analysis' && (
                <Box sx={{ mt: 2 }}>
                  <Chip
                    label="Essentia.js: Spektralanalyse"
                    size="small"
                    sx={{ m: 0.5, bgcolor: processingProgress > 20 ? '#27ae60' : '#95a5a6', color: 'white' }}
                  />
                  <Chip
                    label="Librosa: Frekvensanalyse"
                    size="small"
                    sx={{ m: 0.5, bgcolor: processingProgress > 40 ? '#27ae60' : '#95a5a6', color: 'white' }}
                  />
                  <Chip
                    label="RNNoise: Støydeteksjon"
                    size="small"
                    sx={{ m: 0.5, bgcolor: processingProgress > 60 ? '#27ae60' : '#95a5a6', color: 'white' }}
                  />
                  <Chip
                    label="DCCRN: Taleanalyse"
                    size="small"
                    sx={{ m: 0.5, bgcolor: processingProgress > 80 ? '#27ae60' : '#95a5a6', color: 'white' }}
                  />
                </Box>
              )}
            </Box>
          ) : (
            <Grid container spacing={3}>
              <Grid size={{ xs: 12 }}>
                <Typography variant="body1" sx={{ mb: 3 }}>
                  Velg lydbehandlingsinnstillinger for {selectedVideoFiles.length || 1} video{(selectedVideoFiles.length || 1) !== 1 ? 'er' : ', '}
                </Typography>
              </Grid>

              <Grid size={{ xs: 12 }} md={6}>
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Behandlingstype</InputLabel>
                  <Select
                    value={audioProcessingType}
                    onChange={(e) => setAudioProcessingType(e.target.value)}
                  >
                    <MenuItem value="denoising">Støyfjerning</MenuItem>
                    <MenuItem value="separation">Kildeseparasjon</MenuItem>
                    <MenuItem value="enhancement">Lydrestaurering</MenuItem>
                    <MenuItem value="mastering">Auto-mastering</MenuItem>
                  </Select>
                </FormControl>

                <Typography gutterBottom>Kvalitetsnivå: {audioQuality}%</Typography>
                <Slider
                  value={audioQuality}
                  onChange={(e, value) => setAudioQuality(value as number)}
                  min={50}
                  max={100}
                  valueLabelDisplay="auto"
                />
              </Grid>

              <Grid size={{ xs: 12 }} md={6}>
                <Paper sx={{ ...theming.getThemedCardSx(), p: 2, bgcolor: '#f8f9fa' }}>
                  <Typography variant="h6" sx={{  mb:  1  }}>Behandlingsinfo</Typography>
                  <Typography variant="body2" sx={{ mb:  1 }}>
                    • AI-modell: {audioProcessingType === 'denoising' ? 'RNNoise + DCCRN' :
                                 audioProcessingType === 'separation' ? 'Demucs v4' :
                                 audioProcessingType === 'enhancement' ? 'FullSubNet' : 'Custom AI Mastering'}
                  </Typography>
                  <Typography variant="body2" sx={{ mb:  1 }}>
                    • Behandlingstid: ~{Math.round(Math.random() * 5 + 2)} minutter
                  </Typography>
                  <Typography variant="body2">
                    • Kvalitetsforventet forbedring: +{Math.round(Math.random() * 30 + 4)}%
                  </Typography>
                </Paper>
              </Grid>

              <Grid size={{ xs: 12 }}>
                <FormControlLabel
                  control={<Switch defaultChecked />}
                  label="Bevar original lyd som backup"
                />
                <FormControlLabel
                  control={<Switch defaultChecked />}
                  label="Automatisk volumnormalisering"
                />
                <FormControlLabel
                  control={<Switch />}
                  label="Høy kvalitet modus (tregere)"
                />
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAudioProcessingOpen(false)}>
            Avbryt
          </Button>
          <Button
            variant="contained"
            onClick={handleAudioProcessing}
            disabled={isProcessing}
            sx={{ bgcolor: '#9b59b6', ...theming.getThemedButtonSx() }}
          >
            {isProcessing ? 'Behandler...' : 'Start Lydbehandling'}
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
}