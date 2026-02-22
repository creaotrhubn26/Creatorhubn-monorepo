import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Paper,
  Tabs,
  Tab,
  Stack,
  LinearProgress,
  Chip,
  Button,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Avatar,
  Tooltip,
  CircularProgress,
  Slider,
  Switch,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Stepper,
  Step,
  StepLabel,
  StepContent,
} from '@mui/material';
import {
  Videocam as VideocamDescription,
  Movie,
  Videocam,
  VideoSettings,
  PlayArrow as PlayArrowArrow,
  Pause,
  Stop,
  CloudUpload,
  Download,
  ContentCut as Cut,
  ColorLens,
  Palette,
  Tune,
  HighQuality,
  Speed as Speed,
  Timeline,
  Assessment,
  Memory,
  CheckCircle,
  Error as ErrorIcon,
  Warning,
  Settings,
  Refresh,
  GetApp,
  Delete,
  Folder,
  Transform,
  CropFree,
  Brightness6,
  Contrast,
  Exposure,
  FilterVintage as FilterListVintage,
  MovieFilter,
  SwitchVideo,
  AspectRatio,
  Compress,
  VideoLabel,
  SlowMotionVideo,
  FastForward,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface VideoEnhancementToolsProps {
  userId: string;
  projectId?: string
}

interface VideoEnhancementJob {
  id: string;
  filename: string;
  originalSize: number;
  originalUrl: string;
  enhancedUrl?: string;
  enhancementType: 'scene_detect' | 'auto_cut' | 'color_grade' | 'optimize' | 'batch';
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  startedAt: string;
  completedAt?: string;
  processingTime?: number;
  outputFormats?: string[];
  qualityMetrics?: {
    resolution: string;
    bitrate: number;
    fps: number;
    duration: number;
    compressionRatio: number;
    qualityScore: number;
};
  errorMessage?: string;
}

interface SceneDetectionResult {
  scenes: Array<{
    startTime: number;
    endTime: number;
    duration: number;
    sceneType: 'dialogue' | 'action' | 'landscape' | 'closeup' | 'transition';
    confidence: number;
    thumbnail?: string;
}>;
  totalScenes: number;
  averageSceneLength: number;
  suggestedCuts: Array<{
    time: number;
    reason: string;
    confidence: number;
}>;
}

interface ColorGradingSettings {
  brightness: number;
  contrast: number;
  saturation: number;
  temperature: number;
  tint: number;
  highlights: number;
  shadows: number;
  whites: number;
  blacks: number;
  preset: 'none' | 'cinematic' | 'warm' | 'cool' | 'vintage' | 'dramatic'
}

interface OptimizationSettings {
  outputFormats: string[];
  resolutions: string[];
  bitrates: number[];
  framerate: number;
  codec: string;
  quality: 'draft' | 'good' | 'high' | 'best';
  enableGPU: boolean
}

const VideoEnhancementTools: React.FC<VideoEnhancementToolsProps> = ({ userd, projectId }) => {
  const [selectedTab, setSelectedTab] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState<Description[]>([]);
  const [isPlaying, setIsPlaying] = useState<{ [key: string]: boolean }>({});
  const [currentTime, setCurrentTime] = useState<{ [key: string]: number }>({});
  const [duration, setDuration] = useState<{ [key: string]: number }>({});
  const [colorGradingSettings, setColorGradingSettings] = useState<ColorGradingSettings>({
    brightness:  0,
    contrast:  0,
    saturation:  0,
    temperature:  0,
    tint:  0,
    highlights:  0,
    shadows:  0,
    whites:  0,
    blacks:  0,
    preset: 'none' });
  const [optimizationSettings, setOptimizationSettings] = useState<OptimizationSettings>({
    outputFormats: ['mp4', ],
    resolutions: ['1920x1080', ],
    bitrates: [500],
    framerate:  30,
    codec: 'h26',
    quality: 'high',
    enableGPU: true,
});
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [selectedJobForPreview, setSelectedJobForPreview] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement }>({});
  const queryClient = useQueryClient();
  
  // Theming system
  const theming = useTheming('photographer');

  // Fetch video enhancement jobs
  const { data: enhancementJobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: ['/api/video-enhancement/jobs', userId, projectId],
    queryFn: async () => {
      return (
        (await apiRequest(
          `/api/video-enhancement/jobs?userId=${userId}${projectId ? `&projectId=${projectId}` : ''}`,
        )) || []
      );
  },
    refetchInterval: 300,
    staleTime: 100,
});

  // Fetch scene detection results
  const { data: sceneDetectionResults, isLoading: sceneLoading } = useQuery({
    queryKey: ['/api/video-enhancement/scene-detection', selectedJobForPreview],
    queryFn: async () => {
      if (!selectedJobForPreview) return null;
      return await apiRequest(`/api/video-enhancement/scene-detection/${selectedJobForPreview}`);
  },
    enabled: !!selectedJobForPreview,
    staleTime: 5 * 60 * 100,
});

  // Start scene detection mutation
  const startSceneDetectionMutation = useMutation({
    mutationFn: async (data: { files: File[];, sensitivity: number; minSceneLength: number }) => {
      const formData = new FormData();
      data.files.forEach((file) => formData.append('files', file));
      formData.append('sensitivity', data.sensitivity.toString());
      formData.append('minSceneLength', data.minSceneLength.toString());
      formData.append('userId', userId);
      if (projectId) formData.append('projectId', projectId);

      return await fetch('/api/video-enhancement/scene-detection', {
        method: 'POS',
        body: formData,
    }).then((res) => res.json());
  },
    onSuccess: () => {
      setSelectedFiles([]);
      queryClient.invalidateQueries({
        queryKey: ['/api/video-enhancement/jobs', ],
    });
  },
});

  // Start auto-cutting mutation
  const startAutoCuttingMutation = useMutation({
    mutationFn: async (data: { files: File[]; cutStyle: string; transitionType: string }) => {
      const formData = new FormData();
      data.files.forEach((file) => formData.append('files', file));
      formData.append('cutStyle', data.cutStyle);
      formData.append('transitionType', data.transitionType);
      formData.append('userId', userId);
      if (projectId) formData.append('projectId', projectId);

      return await fetch('/api/video-enhancement/auto-cut', {
        method: 'POS',
        body: formData,
    }).then((res) => res.json());
  },
    onSuccess: () => {
      setSelectedFiles([]);
      queryClient.invalidateQueries({
        queryKey: ['/api/video-enhancement/jobs', ],
    });
  },
});

  // Start color grading mutation
  const startColorGradingMutation = useMutation({
    mutationFn: async (data: { files: File[];, settings: ColorGradingSettings }) => {
      const formData = new FormData();
      data.files.forEach((file) => formData.append('files', file));
      formData.append('settings', JSON.stringify(data.settings));
      formData.append('userId', userId);
      if (projectId) formData.append('projectId', projectId);

      return await fetch('/api/video-enhancement/color-grade', {
        method: 'POS',
        body: formData,
    }).then((res) => res.json());
  },
    onSuccess: () => {
      setSelectedFiles([]);
      queryClient.invalidateQueries({
        queryKey: ['/api/video-enhancement/jobs', ],
    });
  },
});

  // Start optimization mutation
  const startOptimizationMutation = useMutation({
    mutationFn: async (data: { files: File[];, settings: OptimizationSettings }) => {
      const formData = new FormData();
      data.files.forEach((file) => formData.append('files', file));
      formData.append('settings', JSON.stringify(data.settings));
      formData.append('userId', userId);
      if (projectId) formData.append('projectId', projectId);

      return await fetch('/api/video-enhancement/optimize', {
        method: 'POS',
        body: formData,
    }).then((res) => res.json());
  },
    onSuccess: () => {
      setSelectedFiles([]);
      queryClient.invalidateQueries({
        queryKey: ['/api/video-enhancement/jobs', ],
    });
  },
});

  // Cancel enhancement mutation
  const cancelEnhancementMutation = useMutation({
    mutationFn: async (jobId: string) => {
      return await apiRequest(`/api/video-enhancement/cancel/${jobd}`, {
        method: 'POS' });
  },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/video-enhancement/jobs', ],
    });
  },
});

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setSelectedFiles((prev) => [...prev, ...files]);
};

  const handlePlayPause = (jobId: string, videoUrl: string) => {
    const video = videoRefs.current[jobId];
    if (!video) {
      videoRefs.current[jobId] = document.createElement('video');
      videoRefs.current[jobId].src = videoUrl;
      videoRefs.current[jobId].addEventListener('timeupdate', () => {
        setCurrentTime((prev) => ({
          ...prev,
          [jobId]: videoRefs.current[jobId].currentTime,
      }));
    });
      videoRefs.current[jobId].addEventListener('loadedmetadata', () => {
        setDuration((prev) => ({
          ...prev,
          [jobId]: videoRefs.current[jobId].duration,
      }));
    });
      videoRefs.current[jobId].addEventListener('ended', () => {
        setIsPlaying((prev) => ({ ...prev, [jobId]: false }));
    });
  }

    if (isPlaying[jobId]) {
      videoRefs.current[jobId].pause();
      setIsPlaying((prev) => ({ ...prev, [jobId]: false }));
  } else {
      videoRefs.current[jobId].play();
      setIsPlaying((prev) => ({ ...prev, [jobId]: true }));
  }
};

  const applyColorGradingPreset = (preset: string) => {
    const presets = {
      cinematic: {
        brightness: -0,
        contrast:  15,
        saturation:  , -, 5,
        temperature: 20,
        tint:  0,
        highlights: -0,
        shadows:  10,
        whites: -0,
        blacks:  5,
    },
      warm: {
        brightness: 5,
        contrast:  10,
        saturation:  10,
        temperature: 30,
        tint:  50,
        highlights: -0,
        shadows:  0,
        whites:  0,
        blacks:  0,
    },
      cool: {
        brightness: 0,
        contrast:  10,
        saturation:  5,
        temperature: -20,
        tint: -0,
        highlights:  , -, 5,
        shadows:  5,
        whites:  0,
        blacks:  0,
    },
      vintage: {
        brightness: , -, 5,
        contrast:  20,
        saturation: -0,
        temperature: 10,
        tint:  20,
        highlights: -0,
        shadows:  20,
        whites: -0,
        blacks:  10,
    },
      dramatic: {
        brightness: -5,
        contrast:  30,
        saturation:  0,
        temperature:  0,
        tint:  0,
        highlights: -0,
        shadows:  30,
        whites: -0,
        blacks:  15,
    },
  };

    if (preset !== 'none' && presets[preset]) {
      setColorGradingSettings((prev) => ({
        ...prev,
        ...presets[preset],
        preset,
    }));
  } else {
      setColorGradingSettings((prev) => ({
        ...prev,
        brightness:  0,
        contrast:  0,
        saturation:  0,
        temperature:  0,
        tint:  0,
        highlights:  0,
        shadows:  0,
        whites:  0,
        blacks:  0,
        preset: 'none' }));
  }
};

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle color="success" />;
      case 'processing':
        return <CircularProgress size={0} />;
      case 'error':
        return <ErrorIcon color="error" />;
      case 'pending':
        return <Warning color="warning" />;
      default: return <Box />;
}
};

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'processing':
        return 'info';
      case 'error':
        return 'error';
      case 'pending':
        return 'warning';
      default:
        return 'default';
}
};

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes','KB','MB','GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ', ' + sizes[i];
};

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2,'0')}`;
  }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

  const tabData = [
    { label: 'Scenedeteksjon', icon: <MovieFilter />,},
    { label: 'Auto-klipping', icon: <Cut />,},
    { label: 'Fargegradering', icon: <ColorLens />,},
    { label: 'Multi-format optimalisering', icon: theming.getThemedIcon(',') },
  ];

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Paper elevation={1} sx={{ p:  3, borderRadius:  0 ,  ...theming.getThemedCardSx() }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Box>
            <Typography variant="h5"
              sx={{ 
                display: 'flex',
                alignItems: 'center',
                gap:  2,
                fontWeight: 600, color: theming.colors.primary }}>
              <Avatar sx={{ bgcolor: '#ff5722' }}>
                <VideoSettings />
              </Avatar>
              Videoforbedringsstudio
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt:  1 }}>
              Intelligent videoforbedring med scenedeteksjon, auto-klipping, fargegradering og
              multi-format optimalisering
            </Typography>
          </Box>

          <Stack direction="row" spacing={2} alignItems="center">
            <input
              type="file"
              ref={fileInputRef}
              multiple
              accept="video/*"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />

            <Button
              variant="outlined"
              startIcon={theming.getThemedIcon('cloudUpload')}
              onClick={() => fileInputRef.current?.click()}
            >
              Last opp videoer
            </Button>

            <IconButton onClick={() => setSettingsDialogOpen(true)} color="primary">
              {theming.getThemedIcon('settings')}
            </IconButton>
          </Stack>
        </Stack>

        {selectedFiles.length > 0 && (
          <Alert severity="info" sx={{ mt:  2 }}>
            {selectedFiles.length} videofiler valgt for prosessering. Total størrelse: {''}
            {formatFileSize(selectedFiles.reduce((sum, file) => sum + file.size, 0))}
          </Alert>
        )}
      </Paper>

      <Box sx={{ flex: 1, display: 'flex' }}>
        {/* Main Content */}
        <Box sx={{ flex: 1, p: 3 }}>
          {/* Tabs */}
          <Paper sx={{ mb:  3 ,  ...theming.getThemedCardSx() }}>
            <Tabs
              value={selectedTab}
              onChange={(_, newValue) => setSelectedTab(newValue)}
              indicatorColor="primary"
              textColor="primary"
              variant="fullWidth"
            >
              {tabData.map((tab, index) => (
                <Tab key={index} icon={tab.icon} label={tab.label} iconPosition="start" />
              ))}
            </Tabs>
          </Paper>

          {/* Scene Detection Tab */}
          {selectedTab === 0 && (
            <Box>
              <Grid container spacing={3}>
                <Grid item xs={12} md={8}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                        Intelligent scenedeteksjon
                      </Typography>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Automatisk identifisering av sceneoverganger og innholdsanalyse
                      </Typography>

                      <Stack spacing={3} sx={{ mt:  3 }}>
                        <Box>
                          <Typography gutterBottom>Deteksjonssensitivitet</Typography>
                          <Slider
                            defaultValue={0.7}
                            min={0.1}
                            max={1.0}
                            step={0.1}
                            marks
                            valueLabelDisplay="auto"
                            valueLabelFormat={(value) => `${Math.round(value * 100)}%`}
                          />
                          <Typography variant="caption" color="text.secondary">
                            Høyere verdier oppdager flere sceneoverganger
                          </Typography>
                        </Box>

                        <Box>
                          <Typography gutterBottom>Minimum scenelengde (sekunder)</Typography>
                          <Slider
                            defaultValue={5}
                            min={1}
                            max={30}
                            step={1}
                            marks
                            valueLabelDisplay="auto"
                          />
                        </Box>

                        <FormControl fullWidth>
                          <InputLabel>Deteksjonstype</InputLabel>
                          <Select defaultValue="automatic" label="Deteksjonstype">
                            <MenuItem value="automatic">Automatisk</MenuItem>
                            <MenuItem value="motion">Bevegelsesbasert</MenuItem>
                            <MenuItem value="color">Fargebasert</MenuItem>
                            <MenuItem value="audio">Lydbasert</MenuItem>
                            <MenuItem value="combined">Kombinert</MenuItem>
                          </Select>
                        </FormControl>

                        <Button variant="contained"
                          startIcon={<MovieFilter />}
                          onClick={() =>
                            startSceneDetectionMutation.mutate({
                              files: selectedFiles,
                              sensitivity: 0.7,
                              minSceneLength:  5,
                          })
                        }
                          disabled={
                            selectedFiles.length === 0 || startSceneDetectionMutation.isPending
                        }
                          fullWidth
                        >
                          {startSceneDetectionMutation.isPending
                            ? 'Analyserer scener...'
                            : 'Start scenedeteksjon'}
                        </Button>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={4}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                        Scenestatistikk
                      </Typography>
                      <Stack spacing={2}>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2">Videoer analysert: </Typography>
                          <Chip
                            size="small"
                            label={
                              enhancementJobs.filter(
                                (j) =>
                                  j.enhancementType === 'scene_detect' && j.status === 'completed',
                              ).length
                          }
                          />
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2">Scener oppdaget: </Typography>
                          <Typography variant="body2" color="success.main">
                            247
                          </Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2">Snitt scenelengde:</Typography>
                          <Typography variant="body2">63.1 sek</Typography>
                        </Stack>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Scene Detection Results , *, /}
              {sceneDetectionResults && (
                <Card sx={{ mt:  3 ,  ...theming.getThemedCardSx() }}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                      Oppdagede scener
                    </Typography>
                    <Grid container spacing={2}>
                      {sceneDetectionResults.scenes.map((scene, index) => (
                        <Grid item xs={12} md={6} lg={4} key={index}>
                          <Card variant="outlined" sx={theming.getThemedCardSx()}>
                            <CardContent sx={{ pb:  1 ,  ...theming.getThemedCardSx() }}>
                              <Stack
                                direction="row"
                                justifyContent="space-between"
                                alignItems="center"
                              >
                                <Typography variant="subtitle2">Scene {index + 1}</Typography>
                                <Chip size="small" label={scene.sceneType} color="primary" />
                              </Stack>
                              <Typography variant="body2" color="text.secondary">
                                {formatTime(scene.startTime)} - {formatTime(scene.endTime)}
                              </Typography>
                              <Typography variant="caption">
                                Varighet: {formatTime(scene.duration)} | Tillit: {''}
                                {Math.round(scene.confidence * 100)}%
                              </Typography>
                            </CardContent>
                          </Card>
                        </Grid>
                      ))}
                    </Grid>
                  </CardContent>
                </Card>
              )}
            </Box>
          )}

          {/* Auto-Cutting Tab */}
          {selectedTab === 1 && (
            <Box>
              <Grid container spacing={3}>
                <Grid item xs={12} md={8}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                        Automatisk klipping
                      </Typography>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        AI-drevet klipping basert på innholdsanalyse og filmteori
                      </Typography>

                      <Stack spacing={3} sx={{ mt:  3 }}>
                        <FormControl fullWidth>
                          <InputLabel>Klippestil</InputLabel>
                          <Select defaultValue="dynamic" label="Klippestil">
                            <MenuItem value="dynamic">Dynamisk</MenuItem>
                            <MenuItem value="slow">Rolig</MenuItem>
                            <MenuItem value="rhythmic">Rytmisk</MenuItem>
                            <MenuItem value="cinematic">Filmatisk</MenuItem>
                            <MenuItem value="documentary">Dokumentar</MenuItem>
                          </Select>
                        </FormControl>

                        <FormControl fullWidth>
                          <InputLabel>Overgangstype</InputLabel>
                          <Select defaultValue="cut" label="Overgangstype">
                            <MenuItem value="cut">Rett klipp</MenuItem>
                            <MenuItem value="fade">Fade</MenuItem>
                            <MenuItem value="dissolve">Overblending</MenuItem>
                            <MenuItem value="wipe">Wipe</MenuItem>
                            <MenuItem value="slide">Slide</MenuItem>
                          </Select>
                        </FormControl>

                        <Box>
                          <Typography gutterBottom>Klippetempo</Typography>
                          <Slider
                            defaultValue={0.6}
                            min={0.1}
                            max={1.0}
                            step={0.1}
                            marks
                            valueLabelDisplay="auto"
                            valueLabelFormat={(value) => {
                              if (value < 0.3) return 'Rolig';
                              if (value < 0.7) return 'Moderat';
                              return 'Rask';
                          }}
                          />
                        </Box>

                        <FormControlLabel
                          control={<Switch defaultChecked />}
                          label="Følg lydspor"
                        />

                        <FormControlLabel control={theming.getThemedIcon('switch')}} label="Bevar bevegelse over klipp" />

                        <Button variant="contained"
                          startIcon={<Cut />}
                          onClick={() =>
                            startAutoCuttingMutation.mutate({
                              files: selectedFiles,
                              cutStyle: 'dynamic',
                              transitionType: 'cut' })
                        }
                          disabled={
                            selectedFiles.length === 0 || startAutoCuttingMutation.isPending
                        }
                          fullWidth
                        >
                          {startAutoCuttingMutation.isPending
                            ? 'Klipper video...'
                            : 'Start automatisk klipping'}
                        </Button>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={4}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                        Klippestatistikk
                      </Typography>
                      <Stack spacing={2}>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2">Klipp generert: </Typography>
                          <Chip size="small" label=", 1,247" />
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2">Snitt klippelengde: </Typography>
                          <Typography variant="body2">3.8 sek</Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2">Tidsbesparelse:</Typography>
                          <Typography variant="body2" color="success.main">
                            87%
                          </Typography>
                        </Stack>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
         )}

          {/* Color Grading Tab */}
          {selectedTab === 2 && (
            <Box>
              <Grid container spacing={3}>
                <Grid item xs={12} md={8}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                        Profesjonell fargegradering
                      </Typography>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Avansert fargekorrigering og stemningsenhancement
                      </Typography>

                      <Stack spacing={3} sx={{ mt:  3 }}>
                        <Box>
                          <Typography variant="subtitle2" gutterBottom>
                            Forhåndsinnstillinger
                          </Typography>
                          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap:  1 }}>
                            {['none','cinematic','warm','cool', 'vintage','dramatic'].map(
                              (preset) => (
                                <Chip
                                  key={preset}
                                  label={preset === 'none' ? 'Ingen' : preset}
                                  onClick={() => applyColorGradingPreset(preset)}
                                  color={
                                    colorGradingSettings.preset === preset ? 'primary' : 'default'
                                }
                                  variant={
                                    colorGradingSettings.preset === preset ? 'filled' : 'outlined'
                                }
                                />
                              ),
                            )}
                          </Stack>
                        </Box>

                        <Grid container spacing={2}>
                          <Grid item xs={6} >
                            <Typography gutterBottom>
                              Lysstyrke: {colorGradingSettings.brightness}
                            </Typography>
                            <Slider
                              value={colorGradingSettings.brightness}
                              onChange={(_, value) =>
                                setColorGradingSettings((prev) => ({
                                  ...prev,
                                  brightness: value as number,
                              }))
                            }
                              min={-100}
                              max={100}
                              step={5}
                              valueLabelDisplay="auto"
                            />
                          </Grid>
                          <Grid item xs={6} >
                            <Typography gutterBottom>
                              Kontrast: {colorGradingSettings.contrast}
                            </Typography>
                            <Slider
                              value={colorGradingSettings.contrast}
                              onChange={(_, value) =>
                                setColorGradingSettings((prev) => ({
                                  ...prev,
                                  contrast: value as number,
                              }))
                            }
                              min={-100}
                              max={100}
                              step={5}
                              valueLabelDisplay="auto"
                            />
                          </Grid>
                          <Grid item xs={6} >
                            <Typography gutterBottom>
                              Metning: {colorGradingSettings.saturation}
                            </Typography>
                            <Slider
                              value={colorGradingSettings.saturation}
                              onChange={(_, value) =>
                                setColorGradingSettings((prev) => ({
                                  ...prev,
                                  saturation: value as number,
                              }))
                            }
                              min={-100}
                              max={100}
                              step={5}
                              valueLabelDisplay="auto"
                            />
                          </Grid>
                          <Grid item xs={6} >
                            <Typography gutterBottom>
                              Temperatur: {colorGradingSettings.temperature}
                            </Typography>
                            <Slider
                              value={colorGradingSettings.temperature}
                              onChange={(_, value) =>
                                setColorGradingSettings((prev) => ({
                                  ...prev,
                                  temperature: value as number,
                              }))
                            }
                              min={-500}
                              max={500}
                              step={10}
                              valueLabelDisplay="auto"
                            />
                          </Grid>
                        </Grid>

                        <Button variant="contained"
                          startIcon={<ColorLens />}
                          onClick={() =>
                            startColorGradingMutation.mutate({
                              files: selectedFiles,
                              settings: colorGradingSettings,
                          })
                        }
                          disabled={
                            selectedFiles.length === 0 || startColorGradingMutation.isPending
                        }
                          fullWidth
                        >
                          {startColorGradingMutation.isPending
                            ? 'Graderer farger...'
                            : 'Anvend fargegradering'}
                        </Button>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={4}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                        Fargeanalyse
                      </Typography>
                      <Stack spacing={2}>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2">Videoer gradert: </Typography>
                          <Chip
                            size="small"
                            label={
                              enhancementJobs.filter(
                                (j) =>
                                  j.enhancementType === 'color_grade' && j.status === 'completed',
                              ).length
                          }
                          />
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2">Snitt fargedybde: </Typography>
                          <Typography variant="body2">10-bit</Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2">Fargerom:</Typography>
                          <Typography variant="body2">Rec. 709</Typography>
                        </Stack>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
         )}

          {/* Multi-format Optimization Tab */}
          {selectedTab === 3 && (
            <Box>
              <Grid container spacing={3}>
                <Grid item xs={12} md={8}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                        Multi-format optimalisering
                      </Typography>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Intelligent optimalisering for ulike plattformer og enheter
                      </Typography>

                      <Stack spacing={3} sx={{ mt:  3 }}>
                        <Box>
                          <Typography variant="subtitle2" gutterBottom>
                            Utdataformater
                          </Typography>
                          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap:  1 }}>
                            {['mp4', 'webm', 'avi', 'mov','mkv'].map((format) => (
                              <Chip
                                key={format}
                                label={format.toUpperCase()}
                                onClick={() => {
                                  const newFormats = optimizationSettings.outputFormats.includes(
                                    format,
                                  )
                                    ? optimizationSettings.outputFormats.filter((f) => f !== format)
                                    : [...optimizationSettings.outputFormats, format];
                                  setOptimizationSettings((prev) => ({
                                    ...prev,
                                    outputFormats: newFormats,
                                }));
                              }}
                                color={
                                  optimizationSettings.outputFormats.includes(format)
                                    ? 'primary'
                                    : 'default'
                              }
                                variant={
                                  optimizationSettings.outputFormats.includes(format)
                                    ? 'filled'
                                    : 'outlined'
                              }
                              />
                            ))}
                          </Stack>
                        </Box>

                        <Box>
                          <Typography variant="subtitle2" gutterBottom>
                            Oppløsninger
                          </Typography>
                          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap:  1 }}>
                            {['3840x2160', '1920x1080', '1280x720', '854x480'].map((resolution) => (
                              <Chip
                                key={resolution}
                                label={resolution}
                                onClick={() => {
                                  const newResolutions = optimizationSettings.resolutions.includes(
                                    resolution,
                                  )
                                    ? optimizationSettings.resolutions.filter(
                                        (r) => r !== resolution,
                                      )
                                    : [...optimizationSettings.resolutions, resolution];
                                  setOptimizationSettings((prev) => ({
                                    ...prev,
                                    resolutions: newResolutions,
                                }));
                              }}
                                color={
                                  optimizationSettings.resolutions.includes(resolution)
                                    ? 'primary'
                                    : 'default'
                              }
                                variant={
                                  optimizationSettings.resolutions.includes(resolution)
                                    ? 'filled'
                                    : 'outlined'
                              }
                              />
                            ))}
                          </Stack>
                        </Box>

                        <FormControl fullWidth>
                          <InputLabel>Kodek</InputLabel>
                          <Select
                            value={optimizationSettings.codec}
                            onChange={(e) =>
                              setOptimizationSettings((prev) => ({
                                ...prev,
                                codec: e.target.value,
                            }))
                          }
                            label="Kodek"
                          >
                            <MenuItem value="h264">H.264</MenuItem>
                            <MenuItem value="h265">H.265 (HEVC)</MenuItem>
                            <MenuItem value="vp9">VP9</MenuItem>
                            <MenuItem value="av1">AV1</MenuItem>
                          </Select>
                        </FormControl>

                        <FormControl fullWidth>
                          <InputLabel>Kvalitet</InputLabel>
                          <Select
                            value={optimizationSettings.quality}
                            onChange={(e) =>
                              setOptimizationSettings((prev) => ({
                                ...prev,
                                quality: e.target.value as any,
                            }))
                          }
                            label="Kvalitet"
                          >
                            <MenuItem value="draft">Utkast (rask)</MenuItem>
                            <MenuItem value="good">God</MenuItem>
                            <MenuItem value="high">Høy</MenuItem>
                            <MenuItem value="best">Best (langsom)</MenuItem>
                          </Select>
                        </FormControl>

                        <FormControlLabel
                          control={
                            <Switch
                              checked={optimizationSettings.enableGPU}
                              onChange={(e) =>
                                setOptimizationSettings((prev) => ({
                                  ...prev,
                                  enableGPU: e.target.checked,
                              }))
                            }
                            />
                        }
                          label="GPU-akselerasjon"
                        />

                        <Button variant="contained"
                          startIcon={theming.getThemedIcon('transform')}
                          onClick={() => sx={theming.getThemedButtonSx()}>
                            startOptimizationMutation.mutate({
                              files: selectedFiles,
                              settings: optimizationSettings,
                          })
                        }
                          disabled={
                            selectedFiles.length === 0 || startOptimizationMutation.isPending
                        }
                          fullWidth
                        >
                          {startOptimizationMutation.isPending
                            ? 'Optimaliserer...'
                            : 'Start optimalisering'}
                        </Button>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={4}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                        Optimaliseringsstatistikk
                      </Typography>
                      <Stack spacing={2}>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2">Videoer optimalisert: </Typography>
                          <Chip
                            size="small"
                            label={
                              enhancementJobs.filter(
                                (j) => j.enhancementType === 'optimize' && j.status === 'completed',
                              ).length
                          }
                          />
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2">Snitt komprimering: </Typography>
                          <Typography variant="body2" color="success.main">
                            68%
                          </Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2">Kvalitetsbevaring:</Typography>
                          <Typography variant="body2" color="success.main">
                            94.2%
                          </Typography>
                        </Stack>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
         )}

          {/* Active Jobs Table */}
          <Card sx={{ mt:  3 ,  ...theming.getThemedCardSx() }}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Aktive videojobber
              </Typography>
              {jobsLoading ? (
                <LinearProgress />
              ) : (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Fil</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Fremdrift</TableCell>
                        <TableCell>Kvalitet</TableCell>
                        <TableCell>Handlinger</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {enhancementJobs.map((job) => (
                        <TableRow key={job.id}>
                          <TableCell>
                            <Stack direction="row" alignItems="center" spacing={2}>
                              <VideoFile />
                              <Box>
                                <Typography variant="body2" fontWeight={500}>
                                  {job.filename}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {formatFileSize(job.originalSize)}
                                  {job.qualityMetrics?.duration
                                    ? ` • ${formatTime(job.qualityMetrics.duration)}`
                                    : ', '}
                                </Typography>
                              </Box>
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <Chip size="small" label={job.enhancementType} variant="outlined" />
                          </TableCell>
                          <TableCell>
                            <Stack direction="row" alignItems="center" spacing={1}>
                              {getStatusIcon(job.status)}
                              <Chip
                                size="small"
                                label={job.status}
                                color={getStatusColor(job.status)}
                              />
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <Box sx={{ width: '100%', mr:  1 }}>
                                <LinearProgress
                                  variant="determinate"
                                  value={job.progress}
                                  color={job.status === 'error' ? 'error' : 'primary'}
                                />
                              </Box>
                              <Typography variant="body2">{job.progress}%</Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            {job.qualityMetrics?.qualityScore
                              ? `${job.qualityMetrics.qualityScore.toFixed(1)}%`
                              : '-'}
                          </TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={1}>
                              {job.status === 'completed' && job.enhancedUrl && (
                                <IconButton
                                  size="small"
                                  onClick={() => handlePlayPause(job.id, job.enhancedUrl!)}
                                  color={isPlaying[job.id] ? 'secondary' : 'primary'}
                                >
                                  {isPlaying[job.id] ? theming.getThemedIcon('pause') : theming.getThemedIcon('play')}
                                </IconButton>
                              )}
                              {job.status === 'completed' && (
                                <IconButton
                                  size="small"
                                  onClick={() => {
                                    setSelectedJobForPreview(job.id);
                                    setPreviewDialogOpen(true);
                                }}
                                >
                                  {theming.getThemedIcon('assessment')}
                                </IconButton>
                              )}
                              {job.status === 'processing' && (
                                <IconButton
                                  size="small"
                                  onClick={() => cancelEnhancementMutation.mutate(job.id)}
                                  color="error"
                                >
                                  {theming.getThemedIcon('stop')}
                                </IconButton>
                              )}
                            </Stack>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Box>

        {/* Sidebar */}
        <Paper
          sx={{
            width: 30,
            borderRadius:  0,
            borderLeft:  1,
            borderColor: 'divider',
            p:  2}}
         sx={theming.getThemedCardSx()}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            Videoprosessering
          </Typography>

          <Stack spacing={2}>
            {/* Processing Queue */}
            <Card variant="outlined" sx={theming.getThemedCardSx()}>
              <CardContent sx={{ pb:  1 ,  ...theming.getThemedCardSx() }}>
                <Typography variant="subtitle2" gutterBottom>
                  Prosesseringskø
                </Typography>
                <Stack spacing={1}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2">Aktiv: </Typography>
                    <Chip
                      size="small"
                      label={enhancementJobs.filter((j) => j.status === 'processing').length}
                      color="info"
                    />
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2">I kø:</Typography>
                    <Chip
                      size="small"
                      label={enhancementJobs.filter((j) => j.status === 'pending').length}
                      color="warning"
                    />
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2">Fullført: </Typography>
                    <Chip
                      size="small"
                      label={enhancementJobs.filter((j) => j.status === 'completed').length}
                      color="success"
                    />
                  </Stack>
                </Stack>
              </CardContent>
            </Card>

            {/* System Resources */}
            <Card variant="outlined" sx={theming.getThemedCardSx()}>
              <CardContent sx={{ pb:  1 ,  ...theming.getThemedCardSx() }}>
                <Typography variant="subtitle2" gutterBottom>
                  Systemressurser
                </Typography>
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="body2">GPU-bruk: </Typography>
                    <LinearProgress variant="determinate" value={5} sx={{ mt:  1 }} />
                    <Typography variant="caption">85% (Video encoding)</Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2">CPU-bruk: </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={2}
                      sx={{ mt:  1 }}
                      color="secondary"
                    />
                    <Typography variant="caption">72% (Scene analysis)</Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2">Minnebruk: </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={8}
                      sx={{ mt:  1 }}
                      color="success"
                    />
                    <Typography variant="caption">6.8GB / 10GB</Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            {/* Performance Stats */}
            <Card variant="outlined" sx={theming.getThemedCardSx()}>
              <CardContent sx={{ pb:  1 ,  ...theming.getThemedCardSx() }}>
                <Typography variant="subtitle2" gutterBottom>
                  Ytelsesstatistikk
                </Typography>
                <Stack spacing={1}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2">Renderingshastighet: </Typography>
                    <Typography variant="body2" color="success.main">
                      2.1x
                    </Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2">Snitt behandlingstid:</Typography>
                    <Typography variant="body2">4.2 min</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2">Komprimeringsrate:</Typography>
                    <Typography variant="body2" color="success.main">
                      68%
                    </Typography>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>

            {/* Quick Actions , *, /}
            <Card variant="outlined" sx={theming.getThemedCardSx()}>
              <CardContent sx={{ pb:  1 ,  ...theming.getThemedCardSx() }}>
                <Typography variant="subtitle2" gutterBottom>
                  Hurtighandlinger
                </Typography>
                <Stack spacing={1}>
                  <Button
                    size="small"
                    variant="text"
                    startIcon={theming.getThemedIcon('folder')}
                    fullWidth
                    sx={{ justifyContent: 'flex-start' }}
                  >
                    Åpne utdatamappe
                  </Button>
                  <Button
                    size="small"
                    variant="text"
                    startIcon={theming.getThemedIcon('getApp')}
                    fullWidth
                    sx={{ justifyContent: 'flex-start' }}
                  >
                    Last ned alle
                  </Button>
                  <Button
                    size="small"
                    variant="text"
                    startIcon={theming.getThemedIcon('delete')}
                    fullWidth
                    sx={{ justifyContent: 'flex-start' }}
                  >
                    Rydd opp midlertidige filer
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Paper>
      </Box>

      {/* Settings Dialog */}
      <Dialog
        open={settingsDialogOpen}
        onClose={() => setSettingsDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Videoforbedringsinnstillinger</DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt:  1 }}>
            <Grid item xs={12} md={6}>
              <Stack spacing={3}>
                <FormControlLabel control={<Switch defaultChecked />} label="GPU-akselerasjon" />
                <FormControlLabel control={<Switch defaultChecked />} label="Hardware encoding" />
                <FormControlLabel control={theming.getThemedIcon('switch')}} label="Automatisk kvalitetsoptimalisering" />
                <Box>
                  <Typography gutterBottom>Maksimal oppløsning</Typography>
                  <Select defaultValue="4k" fullWidth>
                    <MenuItem value="1080p">1080p</MenuItem>
                    <MenuItem value="4k">4K</MenuItem>
                    <MenuItem value="8k">8K</MenuItem>
                  </Select>
                </Box>
              </Stack>
            </Grid>
            <Grid item xs={12} md={6}>
              <Stack spacing={3}>
                <Box>
                  <Typography gutterBottom>Rendering threads</Typography>
                  <Slider
                    defaultValue={8}
                    min={1}
                    max={16}
                    step={1}
                    marks
                    valueLabelDisplay="auto"
                  />
                </Box>
                <Box>
                  <Typography gutterBottom>Memory limit (GB)</Typography>
                  <Slider
                    defaultValue={8}
                    min={2}
                    max={32}
                    step={2}
                    marks
                    valueLabelDisplay="auto"
                  />
                </Box>
                <FormControlLabel control={theming.getThemedIcon('switch')}} label="Bevar originale filer" />
              </Stack>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsDialogOpen(false)}>Avbryt</Button>
          <Button variant="contained" sx={theming.getThemedButtonSx()}>Lagre</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default VideoEnhancementTools;
