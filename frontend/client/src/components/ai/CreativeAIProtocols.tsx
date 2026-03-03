/**
 * CreatorHub Norge - Creative AI Protocols
 * ONNX, neural networks and creative AI workflows for photo/video/audio
 */

import React, { useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Slider,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import type { ChipProps } from '@mui/material';
import {
  Audiotrack as AudioIcon,
  CameraAlt as CameraIcon,
  Computer as GpuIcon,
  Memory as CpuIcon,
  PhoneAndroid as EdgeIcon,
  Psychology as OnnxIcon,
  SmartToy as AIIcon,
  VideoLibrary as VideoIcon,
  Image as PhotoIcon,
  PlayArrow as ProcessIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheming } from '../../utils/theming-helper';
import { apiRequest } from '@/lib/queryClient';

interface AIModel {
  id: string;
  name: string;
  type: 'photo' | 'video' | 'audio' | 'general';
  protocol: 'onnx' | 'pytorch' | 'tensorflow' | 'custom';
  status: 'ready' | 'loading' | 'training' | 'error';
  version: string;
  size: number;
  accuracy: number;
  inputFormats: string[];
  outputFormats: string[];
  device: 'cpu' | 'gpu' | 'edge';
}

interface ProcessingTask {
  id: string;
  modelId: string;
  inputFile: string;
  outputFile?: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
}

interface OnnxConfig {
  runtime: string;
  executionProvider: 'webgl' | 'wasm' | 'cpu';
  memoryLimit: number;
  parallelism: number;
  optimization: 'all' | 'basic' | 'none';
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];

const toAIModel = (value: unknown): AIModel | null => {
  if (!isRecord(value)) return null;

  const type = value.type;
  const protocol = value.protocol;
  const status = value.status;
  const device = value.device;

  if (
    typeof value.id !== 'string' ||
    typeof value.name !== 'string' ||
    !['photo', 'video', 'audio', 'general'].includes(String(type)) ||
    !['onnx', 'pytorch', 'tensorflow', 'custom'].includes(String(protocol)) ||
    !['ready', 'loading', 'training', 'error'].includes(String(status)) ||
    typeof value.version !== 'string' ||
    typeof value.size !== 'number' ||
    typeof value.accuracy !== 'number' ||
    !['cpu', 'gpu', 'edge'].includes(String(device))
  ) {
    return null;
  }

  return {
    id: value.id,
    name: value.name,
    type: type as AIModel['type'],
    protocol: protocol as AIModel['protocol'],
    status: status as AIModel['status'],
    version: value.version,
    size: value.size,
    accuracy: value.accuracy,
    inputFormats: toStringArray(value.inputFormats),
    outputFormats: toStringArray(value.outputFormats),
    device: device as AIModel['device'],
  };
};

const toProcessingTask = (value: unknown): ProcessingTask | null => {
  if (!isRecord(value)) return null;
  const status = value.status;

  if (
    typeof value.id !== 'string' ||
    typeof value.modelId !== 'string' ||
    typeof value.inputFile !== 'string' ||
    !['queued', 'processing', 'completed', 'failed'].includes(String(status)) ||
    typeof value.progress !== 'number'
  ) {
    return null;
  }

  return {
    id: value.id,
    modelId: value.modelId,
    inputFile: value.inputFile,
    outputFile: typeof value.outputFile === 'string' ? value.outputFile : undefined,
    status: status as ProcessingTask['status'],
    progress: value.progress,
  };
};

function TabPanel(props: { value: number; index: number; children: React.ReactNode }) {
  const { value, index, children } = props;
  return (
    <div role="tabpanel" hidden={value !== index} id={`ai-protocol-tabpanel-${index}`}>
      {value === index && <Box sx={{ p: 2 }}>{children}</Box>}
    </div>
  );
}

const fallbackModels: AIModel[] = [
  {
    id: 'photo-enhance-onnx',
    name: 'Photo Enhance Pro',
    type: 'photo',
    protocol: 'onnx',
    status: 'ready',
    version: '1.3.0',
    size: 420,
    accuracy: 92,
    inputFormats: ['jpg', 'png', 'webp'],
    outputFormats: ['jpg', 'png'],
    device: 'gpu',
  },
  {
    id: 'video-color-ai',
    name: 'Video Color Match',
    type: 'video',
    protocol: 'onnx',
    status: 'ready',
    version: '2.0.1',
    size: 680,
    accuracy: 89,
    inputFormats: ['mp4', 'mov'],
    outputFormats: ['mp4', 'mov'],
    device: 'gpu',
  },
  {
    id: 'audio-clarity-net',
    name: 'Audio Clarity Net',
    type: 'audio',
    protocol: 'onnx',
    status: 'ready',
    version: '1.1.4',
    size: 210,
    accuracy: 90,
    inputFormats: ['wav', 'mp3'],
    outputFormats: ['wav'],
    device: 'cpu',
  },
];

export default function CreativeAIProtocols() {
  const theming = useTheming('photographer');
  const queryClient = useQueryClient();

  const [currentTab, setCurrentTab] = useState(0);
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [sourcePath, setSourcePath] = useState('');
  const [aiEnabled, setAiEnabled] = useState(true);
  const [onnxConfig, setOnnxConfig] = useState<OnnxConfig>({
    runtime: 'onnxruntime-web',
    executionProvider: 'webgl',
    memoryLimit: 1024,
    parallelism: 4,
    optimization: 'all',
  });

  const { data: aiModels = [], isLoading: modelsLoading } = useQuery<AIModel[]>({
    queryKey: ['/api/ai/models'],
    queryFn: async () => {
      const response = await apiRequest('/api/ai/models');
      if (!Array.isArray(response)) return fallbackModels;
      const models = response.map(toAIModel).filter((model): model is AIModel => model !== null);
      return models.length > 0 ? models : fallbackModels;
    },
    refetchInterval: 5_000,
  });

  const { data: queue = [], isLoading: queueLoading } = useQuery<ProcessingTask[]>({
    queryKey: ['/api/ai/queue'],
    queryFn: async () => {
      const response = await apiRequest('/api/ai/queue');
      if (!Array.isArray(response)) return [];
      return response
        .map(toProcessingTask)
        .filter((task): task is ProcessingTask => task !== null);
    },
    refetchInterval: 2_000,
  });

  const loadModel = useMutation({
    mutationFn: async ({ modelId, config }: { modelId: string; config: OnnxConfig }) =>
      apiRequest('/api/ai/model/load', {
        method: 'POST',
        body: { modelId, config },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['/api/ai/models'] });
    },
  });

  const processContent = useMutation({
    mutationFn: async ({
      modelId,
      inputFile,
    }: {
      modelId: string;
      inputFile: string;
    }) =>
      apiRequest('/api/ai/process', {
        method: 'POST',
        body: {
          modelId,
          inputFile,
          options: {
            quality: 'high',
            optimization: onnxConfig.optimization,
            executionProvider: onnxConfig.executionProvider,
          },
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['/api/ai/queue'] });
    },
  });

  const selectedModel = useMemo(
    () => aiModels.find((model) => model.id === selectedModelId) ?? null,
    [aiModels, selectedModelId],
  );

  const getModelIcon = (type: AIModel['type']) => {
    switch (type) {
      case 'photo':
        return <PhotoIcon />;
      case 'video':
        return <VideoIcon />;
      case 'audio':
        return <AudioIcon />;
      default:
        return <AIIcon />;
    }
  };

  const getDeviceIcon = (device: AIModel['device']) => {
    switch (device) {
      case 'gpu':
        return <GpuIcon />;
      case 'edge':
        return <EdgeIcon />;
      default:
        return <CpuIcon />;
    }
  };

  const getStatusColor = (status: AIModel['status']): ChipProps['color'] => {
    switch (status) {
      case 'ready':
        return 'success';
      case 'loading':
        return 'warning';
      case 'training':
        return 'info';
      case 'error':
        return 'error';
      default:
        return 'default';
    }
  };

  const renderModelCards = (type: AIModel['type']) => {
    const models = aiModels.filter((model) => model.type === type);

    return (
      <Grid container spacing={2}>
        {models.map((model) => (
          <Grid item xs={12} md={6} lg={4} key={model.id}>
            <Card variant="outlined" sx={{ height: '100%', ...theming.getThemedCardSx() }}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Avatar sx={{ bgcolor: '#ff8c00', mr: 2 }}>{getModelIcon(model.type)}</Avatar>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="h6" noWrap>
                      {model.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {model.protocol.toUpperCase()} • v{model.version}
                    </Typography>
                  </Box>
                </Box>

                <Stack spacing={1} sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">Nøyaktighet</Typography>
                    <Typography variant="body2">{model.accuracy}%</Typography>
                  </Box>
                  <LinearProgress variant="determinate" value={model.accuracy} />

                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">Størrelse</Typography>
                    <Typography variant="body2">{model.size} MB</Typography>
                  </Box>
                </Stack>

                <Typography variant="body2" sx={{ mb: 2 }}>
                  <strong>Inn:</strong> {model.inputFormats.join(', ')}
                  <br />
                  <strong>Ut:</strong> {model.outputFormats.join(', ')}
                </Typography>

                <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                  <Chip
                    icon={getDeviceIcon(model.device)}
                    label={model.device.toUpperCase()}
                    size="small"
                  />
                  <Chip
                    label={model.status.toUpperCase()}
                    color={getStatusColor(model.status)}
                    size="small"
                  />
                </Stack>

                <Button
                  fullWidth
                  variant={selectedModelId === model.id ? 'contained' : 'outlined'}
                  disabled={model.status !== 'ready' || !aiEnabled}
                  onClick={() => setSelectedModelId(model.id)}
                >
                  {selectedModelId === model.id ? 'Valgt' : 'Velg modell'}
                </Button>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    );
  };

  return (
    <Card sx={{ maxWidth: 1400, mx: 'auto', mt: 2, ...theming.getThemedCardSx() }}>
      <CardContent sx={theming.getThemedCardSx()}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <OnnxIcon sx={{ color: '#ff8c00' }} />
          <Typography variant="h5">Kreative AI-protokoller</Typography>
          <Chip label="ADVANCED" size="small" color="secondary" />
          <FormControlLabel
            sx={{ ml: 'auto' }}
            control={<Switch checked={aiEnabled} onChange={(e) => setAiEnabled(e.target.checked)} />}
            label="AI aktivert"
          />
        </Box>

        <Alert severity="info" sx={{ mb: 2 }}>
          ONNX/AI-kjeder for foto, video og lyd. Modellene kan lastes dynamisk og prosessering
          legges i kø med statusoppdatering i sanntid.
        </Alert>

        {(modelsLoading || queueLoading) && <LinearProgress sx={{ mb: 2 }} />}

        {queue.length > 0 && (
          <Paper sx={{ p: 2, mb: 2, border: '1px solid #2196f0', ...theming.getThemedCardSx() }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="h6">Aktive AI-oppgaver</Typography>
              <Chip label={`${queue.length} i kø`} color="primary" size="small" />
            </Box>
            <Grid container spacing={1.5}>
              {queue.slice(0, 4).map((task) => (
                <Grid item xs={12} md={6} key={task.id}>
                  <Paper sx={{ p: 1.5, ...theming.getThemedCardSx() }}>
                    <Typography variant="body2" noWrap>
                      {task.inputFile.split('/').pop()}
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                      <Chip label={task.status.toUpperCase()} size="small" />
                      <Box sx={{ flex: 1 }}>
                        <LinearProgress variant="determinate" value={task.progress} />
                      </Box>
                      <Typography variant="caption">{task.progress}%</Typography>
                    </Stack>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Paper>
        )}

        <Tabs value={currentTab} onChange={(_, nextTab: number) => setCurrentTab(nextTab)} sx={{ mb: 2 }}>
          <Tab icon={<OnnxIcon />} label="ONNX Runtime" />
          <Tab icon={<PhotoIcon />} label="Foto AI" />
          <Tab icon={<VideoIcon />} label="Video AI" />
          <Tab icon={<AudioIcon />} label="Lyd AI" />
        </Tabs>

        <TabPanel value={currentTab} index={0}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2, ...theming.getThemedCardSx() }}>
                <Typography variant="subtitle1" sx={{ mb: 2 }}>
                  Runtime-innstillinger
                </Typography>

                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel id="execution-provider-label">Execution Provider</InputLabel>
                  <Select
                    labelId="execution-provider-label"
                    value={onnxConfig.executionProvider}
                    label="Execution Provider"
                    onChange={(event) =>
                      setOnnxConfig((prev) => ({
                        ...prev,
                        executionProvider: event.target.value as OnnxConfig['executionProvider'],
                      }))
                    }
                  >
                    <MenuItem value="webgl">WebGL (GPU)</MenuItem>
                    <MenuItem value="wasm">WebAssembly (CPU)</MenuItem>
                    <MenuItem value="cpu">CPU only</MenuItem>
                  </Select>
                </FormControl>

                <Typography gutterBottom>Memory Limit: {onnxConfig.memoryLimit} MB</Typography>
                <Slider
                  value={onnxConfig.memoryLimit}
                  onChange={(_, value) =>
                    setOnnxConfig((prev) => ({
                      ...prev,
                      memoryLimit: typeof value === 'number' ? value : prev.memoryLimit,
                    }))
                  }
                  min={512}
                  max={4096}
                  step={256}
                  marks={[
                    { value: 512, label: '512MB' },
                    { value: 1024, label: '1GB' },
                    { value: 2048, label: '2GB' },
                    { value: 4096, label: '4GB' },
                  ]}
                  sx={{ mb: 2 }}
                />

                <Typography gutterBottom>Parallelism: {onnxConfig.parallelism} threads</Typography>
                <Slider
                  value={onnxConfig.parallelism}
                  onChange={(_, value) =>
                    setOnnxConfig((prev) => ({
                      ...prev,
                      parallelism: typeof value === 'number' ? value : prev.parallelism,
                    }))
                  }
                  min={1}
                  max={16}
                  step={1}
                  marks={[
                    { value: 1, label: '1' },
                    { value: 4, label: '4' },
                    { value: 8, label: '8' },
                    { value: 16, label: '16' },
                  ]}
                  sx={{ mb: 2 }}
                />

                <Button
                  fullWidth
                  variant="contained"
                  disabled={!aiEnabled || loadModel.isPending}
                  onClick={() => loadModel.mutate({ modelId: 'onnx-runtime', config: onnxConfig })}
                  sx={{ bgcolor: '#ff8c00', '&:hover': { bgcolor: '#e67c00' } }}
                >
                  {loadModel.isPending ? 'Konfigurerer...' : 'Konfigurer ONNX Runtime'}
                </Button>
              </Paper>
            </Grid>

            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2, ...theming.getThemedCardSx() }}>
                <Typography variant="subtitle1" sx={{ mb: 2 }}>
                  ONNX modelloversikt
                </Typography>
                <List>
                  {aiModels
                    .filter((model) => model.protocol === 'onnx')
                    .map((model) => (
                      <ListItem key={model.id}>
                        <ListItemIcon>{getModelIcon(model.type)}</ListItemIcon>
                        <ListItemText
                          primary={model.name}
                          secondary={`${model.size}MB • ${model.accuracy}% nøyaktighet`}
                        />
                        <Stack direction="row" spacing={1}>
                          <Chip
                            icon={getDeviceIcon(model.device)}
                            label={model.device.toUpperCase()}
                            size="small"
                          />
                          <Chip
                            label={model.status.toUpperCase()}
                            color={getStatusColor(model.status)}
                            size="small"
                          />
                        </Stack>
                      </ListItem>
                    ))}
                </List>
                <Divider sx={{ my: 1.5 }} />
                <Typography variant="body2" color="text.secondary">
                  ONNX gir høy ytelse, standardisert format og lokal inferens for kreativ pipeline.
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={currentTab} index={1}>
          {renderModelCards('photo')}
        </TabPanel>

        <TabPanel value={currentTab} index={2}>
          {renderModelCards('video')}
        </TabPanel>

        <TabPanel value={currentTab} index={3}>
          {renderModelCards('audio')}
        </TabPanel>

        <Paper sx={{ p: 2, mt: 2, ...theming.getThemedCardSx() }}>
          <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
            Start prosessering
          </Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={5}>
              <TextField
                fullWidth
                label="Kilde-fil"
                placeholder="/path/to/input.mov"
                value={sourcePath}
                onChange={(event) => setSourcePath(event.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                disabled
                label="Valgt modell"
                value={selectedModel ? `${selectedModel.name} (${selectedModel.protocol})` : 'Ingen valgt'}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <Button
                fullWidth
                variant="contained"
                startIcon={processContent.isPending ? <CircularProgress size={16} /> : <ProcessIcon />}
                disabled={!aiEnabled || !selectedModel || sourcePath.trim().length === 0 || processContent.isPending}
                onClick={() => {
                  if (!selectedModel) return;
                  processContent.mutate({ modelId: selectedModel.id, inputFile: sourcePath.trim() });
                }}
              >
                {processContent.isPending ? 'Kjører...' : 'Kjør AI-prosess'}
              </Button>
            </Grid>
          </Grid>
          {!aiEnabled && (
            <Alert severity="warning" sx={{ mt: 1.5 }}>
              AI er deaktivert. Slå på AI-bryteren for å starte prosessering.
            </Alert>
          )}
        </Paper>
      </CardContent>
    </Card>
  );
}
