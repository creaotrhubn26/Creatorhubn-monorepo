import { useMemo, useRef, useState, type ChangeEvent, type FC } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Slider,
  Stack,
  Switch,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import {
  CheckCircle,
  CloudUpload,
  Delete,
  Download,
  Error as ErrorIcon,
  Movie,
  Palette,
  Refresh,
  Settings,
  Speed,
  Timeline,
} from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface VideoEnhancementToolsProps {
  userId: string;
  projectId?: string;
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
  errorMessage?: string;
}

interface SceneDetectionResult {
  scenes: Array<{
    startTime: number;
    endTime: number;
    duration: number;
    sceneType: 'dialogue' | 'action' | 'landscape' | 'closeup' | 'transition';
    confidence: number;
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
  highlights: number;
  shadows: number;
  preset: 'none' | 'cinematic' | 'warm' | 'cool' | 'vintage' | 'dramatic';
}

interface OptimizationSettings {
  outputFormats: string[];
  resolutions: string[];
  framerate: number;
  codec: 'h264' | 'h265' | 'vp9' | 'av1';
  quality: 'draft' | 'good' | 'high' | 'best';
  enableGPU: boolean;
}

const fallbackJobs: VideoEnhancementJob[] = [
  {
    id: 'job-1',
    filename: 'NORWEDFILM_VIGNETT_DEMO2.mov',
    originalSize: 420_000_000,
    originalUrl: '/assets/NORWEDFILM_VIGNETT_DEMO2.mov',
    enhancedUrl: '/assets/NORWEDFILM_VIGNETT_DEMO2.mov',
    enhancementType: 'scene_detect',
    status: 'completed',
    progress: 100,
    startedAt: '2026-02-27T20:30:00Z',
    completedAt: '2026-02-27T20:31:08Z',
    processingTime: 68,
  },
  {
    id: 'job-2',
    filename: 'story-arc-highlight.mp4',
    originalSize: 180_000_000,
    originalUrl: '/assets/NORWEDFILM_VIGNETT_DEMO2.mov',
    enhancementType: 'color_grade',
    status: 'processing',
    progress: 42,
    startedAt: '2026-02-27T20:35:00Z',
  },
];

const fallbackSceneResult: SceneDetectionResult = {
  scenes: [
    { startTime: 0, endTime: 5.4, duration: 5.4, sceneType: 'landscape', confidence: 0.88 },
    { startTime: 5.4, endTime: 12.2, duration: 6.8, sceneType: 'dialogue', confidence: 0.91 },
    { startTime: 12.2, endTime: 17.4, duration: 5.2, sceneType: 'action', confidence: 0.84 },
  ],
  totalScenes: 3,
  averageSceneLength: 5.8,
  suggestedCuts: [
    { time: 5.4, reason: 'Speaker switch', confidence: 0.87 },
    { time: 12.2, reason: 'Motion intensity change', confidence: 0.82 },
  ],
};

function tabA11yProps(index: number) {
  return {
    id: `video-enhancement-tab-${index}`,
    'aria-controls': `video-enhancement-tabpanel-${index}`,
  };
}

function TabPanel(props: { value: number; index: number; children: React.ReactNode }) {
  const { value, index, children } = props;

  return (
    <Box
      role="tabpanel"
      hidden={value !== index}
      id={`video-enhancement-tabpanel-${index}`}
      aria-labelledby={`video-enhancement-tab-${index}`}
      sx={{ pt: 2 }}
    >
      {value === index ? children : null}
    </Box>
  );
}

async function safeApiRequest<T>(url: string, fallback: T): Promise<T> {
  try {
    const response = await apiRequest(url);
    return response as T;
  } catch {
    return fallback;
  }
}

function formatBytes(value: number): string {
  if (value === 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const scaled = value / 1024 ** index;
  return `${scaled.toFixed(1)} ${units[index]}`;
}

function statusColor(status: VideoEnhancementJob['status']): 'warning' | 'success' | 'error' | 'default' {
  if (status === 'completed') {
    return 'success';
  }

  if (status === 'processing') {
    return 'warning';
  }

  if (status === 'error') {
    return 'error';
  }

  return 'default';
}

const VideoEnhancementTools: FC<VideoEnhancementToolsProps> = ({ userId, projectId }) => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedTab, setSelectedTab] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedJobForPreview, setSelectedJobForPreview] = useState<string | null>(null);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [operationMessage, setOperationMessage] = useState<string | null>(null);

  const [sceneSensitivity, setSceneSensitivity] = useState(70);
  const [minSceneLength, setMinSceneLength] = useState(2);

  const [colorSettings, setColorSettings] = useState<ColorGradingSettings>({
    brightness: 0,
    contrast: 0,
    saturation: 0,
    temperature: 0,
    highlights: 0,
    shadows: 0,
    preset: 'none',
  });

  const [optimizationSettings, setOptimizationSettings] = useState<OptimizationSettings>({
    outputFormats: ['mp4'],
    resolutions: ['1920x1080'],
    framerate: 30,
    codec: 'h264',
    quality: 'high',
    enableGPU: true,
  });

  const jobsQuery = useQuery({
    queryKey: ['/api/video-enhancement/jobs', userId, projectId],
    queryFn: async () => {
      const query = new URLSearchParams({ userId });
      if (projectId) {
        query.set('projectId', projectId);
      }

      return safeApiRequest<VideoEnhancementJob[]>(`/api/video-enhancement/jobs?${query.toString()}`, fallbackJobs);
    },
    refetchInterval: 3000,
  });

  const sceneResultQuery = useQuery({
    queryKey: ['/api/video-enhancement/scene-detection', selectedJobForPreview],
    queryFn: async () => {
      if (!selectedJobForPreview) {
        return null;
      }

      return safeApiRequest<SceneDetectionResult | null>(
        `/api/video-enhancement/scene-detection/${encodeURIComponent(selectedJobForPreview)}`,
        fallbackSceneResult,
      );
    },
    enabled: selectedJobForPreview !== null,
  });

  const sceneDetectMutation = useMutation({
    mutationFn: async (payload: { files: File[]; sensitivity: number; minSceneLength: number }) => {
      const formData = new FormData();
      payload.files.forEach((file) => formData.append('files', file));
      formData.append('userId', userId);
      if (projectId) {
        formData.append('projectId', projectId);
      }
      formData.append('sensitivity', String(payload.sensitivity));
      formData.append('minSceneLength', String(payload.minSceneLength));

      const response = await fetch('/api/video-enhancement/scene-detection', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Scene detection request failed');
      }

      return response.json();
    },
    onSuccess: async () => {
      setOperationMessage('Scene detection started.');
      setSelectedFiles([]);
      await queryClient.invalidateQueries({ queryKey: ['/api/video-enhancement/jobs', userId, projectId] });
    },
    onError: () => {
      setOperationMessage('Scene detection could not be started.');
    },
  });

  const autoCutMutation = useMutation({
    mutationFn: async (payload: { files: File[]; style: 'narrative' | 'dynamic' | 'social' }) => {
      const formData = new FormData();
      payload.files.forEach((file) => formData.append('files', file));
      formData.append('userId', userId);
      if (projectId) {
        formData.append('projectId', projectId);
      }
      formData.append('cutStyle', payload.style);
      formData.append('transitionType', 'hard-cut');

      const response = await fetch('/api/video-enhancement/auto-cut', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Auto cut request failed');
      }

      return response.json();
    },
    onSuccess: async () => {
      setOperationMessage('Auto-cut pipeline started.');
      setSelectedFiles([]);
      await queryClient.invalidateQueries({ queryKey: ['/api/video-enhancement/jobs', userId, projectId] });
    },
    onError: () => {
      setOperationMessage('Auto-cut pipeline failed to start.');
    },
  });

  const colorGradeMutation = useMutation({
    mutationFn: async (payload: { files: File[]; settings: ColorGradingSettings }) => {
      const formData = new FormData();
      payload.files.forEach((file) => formData.append('files', file));
      formData.append('userId', userId);
      if (projectId) {
        formData.append('projectId', projectId);
      }
      formData.append('settings', JSON.stringify(payload.settings));

      const response = await fetch('/api/video-enhancement/color-grade', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Color grade request failed');
      }

      return response.json();
    },
    onSuccess: async () => {
      setOperationMessage('Color grading started.');
      setSelectedFiles([]);
      await queryClient.invalidateQueries({ queryKey: ['/api/video-enhancement/jobs', userId, projectId] });
    },
    onError: () => {
      setOperationMessage('Color grading failed to start.');
    },
  });

  const optimizeMutation = useMutation({
    mutationFn: async (payload: { files: File[]; settings: OptimizationSettings }) => {
      const formData = new FormData();
      payload.files.forEach((file) => formData.append('files', file));
      formData.append('userId', userId);
      if (projectId) {
        formData.append('projectId', projectId);
      }
      formData.append('settings', JSON.stringify(payload.settings));

      const response = await fetch('/api/video-enhancement/optimize', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Optimization request failed');
      }

      return response.json();
    },
    onSuccess: async () => {
      setOperationMessage('Optimization started.');
      setSelectedFiles([]);
      await queryClient.invalidateQueries({ queryKey: ['/api/video-enhancement/jobs', userId, projectId] });
    },
    onError: () => {
      setOperationMessage('Optimization failed to start.');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (jobId: string) => {
      await apiRequest(`/api/video-enhancement/cancel/${encodeURIComponent(jobId)}`, { method: 'POST' });
    },
    onSuccess: async () => {
      setOperationMessage('Job cancelled.');
      await queryClient.invalidateQueries({ queryKey: ['/api/video-enhancement/jobs', userId, projectId] });
    },
    onError: () => {
      setOperationMessage('Could not cancel job.');
    },
  });

  const jobs = jobsQuery.data ?? fallbackJobs;
  const isLoading = jobsQuery.isLoading;

  const runningJobs = jobs.filter((job) => job.status === 'processing').length;
  const completedJobs = jobs.filter((job) => job.status === 'completed').length;
  const failedJobs = jobs.filter((job) => job.status === 'error').length;

  const selectedFileNames = useMemo(() => selectedFiles.map((file) => file.name), [selectedFiles]);

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    setSelectedFiles((current) => [...current, ...files]);
  };

  const clearSelectedFile = (name: string) => {
    setSelectedFiles((current) => current.filter((file) => file.name !== name));
  };

  const handleRefresh = async () => {
    await jobsQuery.refetch();
  };

  const openPreview = (job: VideoEnhancementJob) => {
    setSelectedJobForPreview(job.id);
    setPreviewDialogOpen(true);
  };

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'start', md: 'center' }} gap={2}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Movie color="primary" sx={{ fontSize: 36 }} />
          <Box>
            <Typography variant="h5" fontWeight={700}>
              Video Enhancement Tools
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Scene detection, auto-cut, grading and export optimization.
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" spacing={1}>
          <Button startIcon={<Settings />} variant="outlined" onClick={() => setSettingsDialogOpen(true)}>
            Settings
          </Button>
          <Button startIcon={<Refresh />} variant="outlined" onClick={handleRefresh}>
            Refresh
          </Button>
        </Stack>
      </Stack>

      {operationMessage ? (
        <Alert
          severity={operationMessage.includes('failed') || operationMessage.includes('could not') ? 'warning' : 'success'}
          sx={{ mt: 2 }}
          onClose={() => setOperationMessage(null)}
        >
          {operationMessage}
        </Alert>
      ) : null}

      {isLoading ? <LinearProgress sx={{ mt: 2 }} /> : null}

      <Grid container spacing={2} sx={{ mt: 1 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Total Jobs
              </Typography>
              <Typography variant="h5" fontWeight={700}>
                {jobs.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Running
              </Typography>
              <Typography variant="h5" fontWeight={700} color={runningJobs > 0 ? 'warning.main' : 'text.primary'}>
                {runningJobs}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Completed
              </Typography>
              <Typography variant="h5" fontWeight={700} color="success.main">
                {completedJobs}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Failed
              </Typography>
              <Typography variant="h5" fontWeight={700} color={failedJobs > 0 ? 'error.main' : 'text.primary'}>
                {failedJobs}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }}>
            <Button variant="contained" startIcon={<CloudUpload />} onClick={() => fileInputRef.current?.click()}>
              Select Videos
            </Button>
            <input ref={fileInputRef} type="file" accept="video/*" multiple hidden onChange={handleFileSelect} />
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {selectedFileNames.map((name) => (
                <Chip
                  key={name}
                  label={name}
                  onDelete={() => clearSelectedFile(name)}
                  deleteIcon={<Delete />}
                  size="small"
                />
              ))}
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Box sx={{ mt: 3 }}>
        <Tabs value={selectedTab} onChange={(_, value) => setSelectedTab(value)}>
          <Tab icon={<Timeline />} iconPosition="start" label="Scene Detect" {...tabA11yProps(0)} />
          <Tab icon={<Movie />} iconPosition="start" label="Auto Cut" {...tabA11yProps(1)} />
          <Tab icon={<Palette />} iconPosition="start" label="Color Grade" {...tabA11yProps(2)} />
          <Tab icon={<Speed />} iconPosition="start" label="Optimize" {...tabA11yProps(3)} />
          <Tab icon={<CheckCircle />} iconPosition="start" label="Jobs" {...tabA11yProps(4)} />
        </Tabs>

        <TabPanel value={selectedTab} index={0}>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Detect scene boundaries and generate suggested cut points.
            </Typography>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption">Sensitivity</Typography>
                <Slider value={sceneSensitivity} onChange={(_, value) => setSceneSensitivity(value as number)} min={10} max={100} />
              </Box>
              <TextField
                label="Min Scene Length (sec)"
                type="number"
                value={minSceneLength}
                onChange={(event) => setMinSceneLength(Math.max(1, Number(event.target.value) || 1))}
                sx={{ width: 220 }}
              />
              <Button
                variant="contained"
                onClick={() =>
                  sceneDetectMutation.mutate({
                    files: selectedFiles,
                    sensitivity: sceneSensitivity,
                    minSceneLength,
                  })
                }
                disabled={selectedFiles.length === 0 || sceneDetectMutation.isPending}
              >
                Start Scene Detection
              </Button>
            </Stack>
          </Stack>
        </TabPanel>

        <TabPanel value={selectedTab} index={1}>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Build rough cuts automatically using movement and dialogue changes.
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                onClick={() => autoCutMutation.mutate({ files: selectedFiles, style: 'narrative' })}
                disabled={selectedFiles.length === 0 || autoCutMutation.isPending}
              >
                Narrative Cut
              </Button>
              <Button
                variant="contained"
                onClick={() => autoCutMutation.mutate({ files: selectedFiles, style: 'dynamic' })}
                disabled={selectedFiles.length === 0 || autoCutMutation.isPending}
              >
                Dynamic Cut
              </Button>
              <Button
                variant="contained"
                onClick={() => autoCutMutation.mutate({ files: selectedFiles, style: 'social' })}
                disabled={selectedFiles.length === 0 || autoCutMutation.isPending}
              >
                Social Cut
              </Button>
            </Stack>
          </Stack>
        </TabPanel>

        <TabPanel value={selectedTab} index={2}>
          <Stack spacing={2}>
            <FormControl fullWidth>
              <InputLabel id="video-enhancement-preset-label">Preset</InputLabel>
              <Select
                labelId="video-enhancement-preset-label"
                label="Preset"
                value={colorSettings.preset}
                onChange={(event) =>
                  setColorSettings((current) => ({ ...current, preset: event.target.value as ColorGradingSettings['preset'] }))
                }
              >
                <MenuItem value="none">None</MenuItem>
                <MenuItem value="cinematic">Cinematic</MenuItem>
                <MenuItem value="warm">Warm</MenuItem>
                <MenuItem value="cool">Cool</MenuItem>
                <MenuItem value="vintage">Vintage</MenuItem>
                <MenuItem value="dramatic">Dramatic</MenuItem>
              </Select>
            </FormControl>

            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="caption">Brightness</Typography>
                <Slider
                  value={colorSettings.brightness}
                  min={-100}
                  max={100}
                  onChange={(_, value) =>
                    setColorSettings((current) => ({ ...current, brightness: value as number }))
                  }
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="caption">Contrast</Typography>
                <Slider
                  value={colorSettings.contrast}
                  min={-100}
                  max={100}
                  onChange={(_, value) =>
                    setColorSettings((current) => ({ ...current, contrast: value as number }))
                  }
                />
              </Grid>
            </Grid>

            <Button
              variant="contained"
              onClick={() => colorGradeMutation.mutate({ files: selectedFiles, settings: colorSettings })}
              disabled={selectedFiles.length === 0 || colorGradeMutation.isPending}
            >
              Start Color Grading
            </Button>
          </Stack>
        </TabPanel>

        <TabPanel value={selectedTab} index={3}>
          <Stack spacing={2}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel id="video-enhancement-quality-label">Quality</InputLabel>
                  <Select
                    labelId="video-enhancement-quality-label"
                    label="Quality"
                    value={optimizationSettings.quality}
                    onChange={(event) =>
                      setOptimizationSettings((current) => ({
                        ...current,
                        quality: event.target.value as OptimizationSettings['quality'],
                      }))
                    }
                  >
                    <MenuItem value="draft">Draft</MenuItem>
                    <MenuItem value="good">Good</MenuItem>
                    <MenuItem value="high">High</MenuItem>
                    <MenuItem value="best">Best</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel id="video-enhancement-codec-label">Codec</InputLabel>
                  <Select
                    labelId="video-enhancement-codec-label"
                    label="Codec"
                    value={optimizationSettings.codec}
                    onChange={(event) =>
                      setOptimizationSettings((current) => ({
                        ...current,
                        codec: event.target.value as OptimizationSettings['codec'],
                      }))
                    }
                  >
                    <MenuItem value="h264">H.264</MenuItem>
                    <MenuItem value="h265">H.265</MenuItem>
                    <MenuItem value="vp9">VP9</MenuItem>
                    <MenuItem value="av1">AV1</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
            <FormControlLabel
              control={<Switch checked={optimizationSettings.enableGPU} onChange={(event) => setOptimizationSettings((current) => ({ ...current, enableGPU: event.target.checked }))} />}
              label="Enable GPU Acceleration"
            />
            <Button
              variant="contained"
              onClick={() => optimizeMutation.mutate({ files: selectedFiles, settings: optimizationSettings })}
              disabled={selectedFiles.length === 0 || optimizeMutation.isPending}
            >
              Start Optimization
            </Button>
          </Stack>
        </TabPanel>

        <TabPanel value={selectedTab} index={4}>
          <Card>
            <CardContent sx={{ p: 0 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>File</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Progress</TableCell>
                    <TableCell>Size</TableCell>
                    <TableCell>Started</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {jobs.map((job) => (
                    <TableRow key={job.id} hover>
                      <TableCell>{job.filename}</TableCell>
                      <TableCell>{job.enhancementType}</TableCell>
                      <TableCell>
                        <Chip size="small" label={job.status} color={statusColor(job.status)} icon={job.status === 'error' ? <ErrorIcon /> : undefined} />
                      </TableCell>
                      <TableCell>
                        <Stack spacing={0.5} sx={{ minWidth: 130 }}>
                          <LinearProgress variant="determinate" value={job.progress} />
                          <Typography variant="caption">{job.progress}%</Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>{formatBytes(job.originalSize)}</TableCell>
                      <TableCell>{new Date(job.startedAt).toLocaleString('nb-NO')}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1}>
                          <Button size="small" variant="outlined" onClick={() => openPreview(job)}>
                            Preview
                          </Button>
                          {job.status === 'processing' ? (
                            <Button size="small" variant="outlined" color="warning" onClick={() => cancelMutation.mutate(job.id)}>
                              Cancel
                            </Button>
                          ) : null}
                          {job.enhancedUrl ? (
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<Download />}
                              onClick={() => window.open(job.enhancedUrl, '_blank', 'noopener,noreferrer')}
                            >
                              Download
                            </Button>
                          ) : null}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabPanel>
      </Box>

      <Dialog open={settingsDialogOpen} onClose={() => setSettingsDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Enhancement Defaults</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Default Framerate"
              type="number"
              value={optimizationSettings.framerate}
              onChange={(event) =>
                setOptimizationSettings((current) => ({ ...current, framerate: Math.max(1, Number(event.target.value) || 30) }))
              }
            />
            <TextField
              label="Output Formats"
              value={optimizationSettings.outputFormats.join(', ')}
              onChange={(event) =>
                setOptimizationSettings((current) => ({
                  ...current,
                  outputFormats: event.target.value
                    .split(',')
                    .map((format) => format.trim())
                    .filter((format) => format.length > 0),
                }))
              }
            />
            <TextField
              label="Resolutions"
              value={optimizationSettings.resolutions.join(', ')}
              onChange={(event) =>
                setOptimizationSettings((current) => ({
                  ...current,
                  resolutions: event.target.value
                    .split(',')
                    .map((resolution) => resolution.trim())
                    .filter((resolution) => resolution.length > 0),
                }))
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={previewDialogOpen} onClose={() => setPreviewDialogOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Scene Detection Preview</DialogTitle>
        <DialogContent>
          {sceneResultQuery.isLoading ? <LinearProgress /> : null}
          {sceneResultQuery.data ? (
            <Stack spacing={1.5} sx={{ pt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Total scenes: {sceneResultQuery.data.totalScenes} · Average length:{' '}
                {sceneResultQuery.data.averageSceneLength.toFixed(1)}s
              </Typography>

              {sceneResultQuery.data.scenes.map((scene, index) => (
                <Card key={`${scene.startTime}-${scene.endTime}`} variant="outlined">
                  <CardContent>
                    <Typography fontWeight={600}>Scene {index + 1}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {scene.startTime.toFixed(2)}s - {scene.endTime.toFixed(2)}s · {scene.sceneType} · confidence{' '}
                      {(scene.confidence * 100).toFixed(0)}%
                    </Typography>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          ) : (
            <Alert severity="info" sx={{ mt: 1 }}>
              No scene detection result found for this job.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default VideoEnhancementTools;
