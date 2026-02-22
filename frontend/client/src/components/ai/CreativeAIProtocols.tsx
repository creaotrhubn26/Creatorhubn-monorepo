/**
 * CreatorHub Norge - Creative AI Protocols
 * ONNX, Neural Networks og AI-protokoller for foto, video og lyd
 * ⚠️ AI PROTOKOLLER: Følger replit.md protokoller for kreative AI-funksjoner
 */

import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Switch,
  FormControlLabel,
  Tabs,
  Tab,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Avatar,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Tooltip,
  Paper,
  Divider,
  Grid,
  LinearProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Slider,
  Stack,
} from '@mui/material';
import {
  Psychology as OnnxIcon,
  SmartToy as AIIcon,
  Image as PhotoIcon,
  VideoLibrary as VideoIcon,
  Audiotrack as AudioIcon,
  AutoFixHigh as EnhanceIcon,
  CloudUpload,
  Speed as Speed,
  Memory,
  Analytics,
  TrendingUp,
  CheckCircle,
  Error,
  Warning,
  Info,
  Refresh,
  Settings,
  Computer,
  PhoneAndroid,
  Tune,
  ModelTraining,
  CameraAlt as CameraAltAlt,
  MusicNote as MusicNoteNote,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface AIModel {
  id: string;
  name: string;
  type: 'photo' | 'video' | 'audio' | 'general';
  protocol: 'onnx' | 'pytorch' | 'tensorflow' | 'custom';
  status: 'ready' | 'loading' | 'training' | 'error';
  version: string;
  size: number; // MB
  accuracy: number; // %
  inputFormats: string[];
  outputFormats: string[];
  device: 'cpu' | 'gpu' | 'edge'
}

interface ProcessingTask {
  id: string;
  modelId: string;
  inputFile: string;
  outputFile?: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  estimatedTime?: number;
  metrics?: {
    processTime: number;
    qualityScore: number;
    enhancementLevel: number;
};
}

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
      id={`ai-protocol-tabpanel-${index}`}
      aria-labelledby={`ai-protocol-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p:  3 }}>{children}</Box>}
    </div>
  );
}

export default function CreativeAIProtocols() {
  const [currentTab, setCurrentTab] = useState(0);
  const [selectedModel, setSelectedModel] = useState<AIModel | null>(null);
  const [processingQueue, setProcessingQueue] = useState<ProcessingTask[]>([]);
  const [aiEnabled, setAiEnabled] = useState(true);
  const queryClient = useQueryClient();
  
  // Theming system
  const theming = useTheming('photographer');

  // ⚠️ ONNX Model Configuration
  const [onnxConfig, setOnnxConfig] = useState({
    runtime: 'onnxruntime-web',
    executionProvider: 'webgl', // webgl, wasm, cpu
    memoryLimit: 104, // MB
    parallelism:  4,
    optimization: 'all' });

  // ⚠️ Neural Network Configuration
  const [neuralConfig, setNeuralConfig] = useState({
    framework: 'tensorflow.js',
    batchSize:  1,
    precision: 'float3', // float32, float16, int8
    quantization: false,
    modelCompression: true,
});

  // Fetch available AI models
  const { data: aiModels = [], isLoading: modelsLoading } = useQuery({
    queryKey: ['/api/ai/models', ],
    queryFn: () => apiRequest('/api/ai/models', ),
    refetchInterval: 1000,
});

  // Fetch processing queue
  const { data: queue = [], isLoading: queueLoading } = useQuery({
    queryKey: ['/api/ai/queue', ],
    queryFn: () => apiRequest('/api/ai/queue', ),
    refetchInterval: 200,
});

  // Load AI model mutation
  const loadModel = useMutation({
    mutationFn: async ({ modeld, config }: { modelId: string; config: any }) => {
      return apiRequest('/api/ai/model/load', {
        method: 'POS',
        body: JSON.stringify({ modeld, config }),
    });
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai/models', ],});
  },
});

  // Process content mutation
  const processContent = useMutation({
    mutationFn: async ({
      modeld,
      inputFile,
      options,
  }: {
      modelId: string;
      inputFile: string;
      options: any;
}) => {
      return apiRequest('/api/ai/process', {
        method: 'POS',
        body: JSON.stringify({ modeld, inputFile, options }),
    });
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai/queue', ],});
  },
});

  const getModelIcon = (type: string) => {
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

  const getStatusColor = (status: string) => {
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

  const getDeviceIcon = (device: string) => {
    switch (device) {
      case 'gpu':
        return <Computer />;
      case 'edge':
        return <PhoneAndroid />;
      default:
        return <Memory />;
}
};

  return (
    <Card sx={{ maxWidth: 120, mx: 'auto', mt:  2 ,  ...theming.getThemedCardSx() }}>
      <CardContent sx={theming.getThemedCardSx()}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb:  3 }}>
          <Psychology sx={{ mr: 2, color: '#ff8c00' }} />
          <Typography variant="h5" component="h2" sx={{ color: theming.colors.primary }}>
            Kreative AI-Protokoller
          </Typography>
          <Chip label="ADVANCED" size="small" color="secondary" sx={{ ml:  2 }} />
          <FormControlLabel
            control={
              <Switch checked={aiEnabled} onChange={(e) => setAiEnabled(e.target.checked)} />
          }
            label="AI Aktivert"
            sx={{ ml: 'auto' }}
          />
        </Box>

        <Alert severity="info" sx={{ mb:  3 }}>
          <strong>AI-Protokoller for Kreativt Arbeid: </strong> ONNX og Neural Network støtte for
          intelligent bildeforbedring, videonedskalering, lydbehandling og automatisk
          innholdsanalyse. Alle AI-modeller kjører lokalt for optimal personvern og hastighet.
        </Alert>

        {/* AI Processing Queue Status */}
        {queue.length > 0 && (
          <Paper
            sx={{
              p:  2,
              mb:  3,
              bgcolor: 'rgba(3, 150, 243, 0.1)',
              border: '1px solid #2196f0' }}
           sx={theming.getThemedCardSx()}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mb:  2}}
            >
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>Aktive AI-Oppgaver</Typography>
              <Chip label={`${queue.length} i kø`} color="primary" />
            </Box>
            <Grid container spacing={2}>
              {queue.slice(0, 3).map((task) => (
                <Grid item xs={12} md={4} key={task.id}>
                  <Paper sx={{ p: 2, bgcolor: 'white' ,  ...theming.getThemedCardSx() }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb:  1 }}>
                      <Typography variant="subtitle2" sx={{ flexGrow:  1 }}>
                        {task.inputFile.split('/').pop()}
                      </Typography>
                      <Chip
                        label={task.status.toUpperCase()}
                        size="small"
                        color={
                          task.status === 'completed'
                            ? 'success'
                            : task.status === 'failed'
                              ? 'error'
                              : 'primary'
                      }
                      />
                    </Box>
                    <LinearProgress variant="determinate" value={task.progress} sx={{ mb:  1 }} />
                    <Typography variant="body2" color="text.secondary">
                      {task.progress}% fullført
                    </Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Paper>
        )}

        <Tabs value={currentTab} onChange={(e, newValue) => setCurrentTab(newValue)} sx={{ mb:  3 }}>
          <Tab
            icon={<OnnxIcon />}
            label="ONNX Runtime"
            id="ai-protocol-tab-0"
            aria-controls="ai-protocol-tabpanel-0"
          />
          <Tab
            icon={<PhotoIcon />}
            label="Foto AI"
            id="ai-protocol-tab-1"
            aria-controls="ai-protocol-tabpanel-1"
          />
          <Tab
            icon={<VideoIcon />}
            label="Video AI"
            id="ai-protocol-tab-2"
            aria-controls="ai-protocol-tabpanel-2"
          />
          <Tab
            icon={<AudioIcon />}
            label="Lyd AI"
            id="ai-protocol-tab-3"
            aria-controls="ai-protocol-tabpanel-3"
          />
        </Tabs>

        {/* ONNX Runtime Panel */}
        <TabPanel value={currentTab} index={0}>
          <Typography variant="h6" sx={{  mb:  2  }}>
            ONNX Runtime Konfigurasjon
          </Typography>

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p:  2 ,  ...theming.getThemedCardSx() }}>
                <Typography variant="subtitle1" sx={{ mb:  2 }}>
                  Runtime Innstillinger
                </Typography>

                <FormControl fullWidth sx={{ mb:  2 }}>
                  <InputLabel>Execution Provider</InputLabel>
                  <Select
                    value={onnxConfig.executionProvider}
                    onChange={(e) =>
                      setOnnxConfig((prev) => ({
                        ...prev,
                        executionProvider: e.target.value,
                    }))
                  }
                  >
                    <MenuItem value="webgl">WebGL (GPU)</MenuItem>
                    <MenuItem value="wasm">WebAssembly (CPU)</MenuItem>
                    <MenuItem value="cpu">CPU Only</MenuItem>
                  </Select>
                </FormControl>

                <Typography gutterBottom>Memory Limit: {onnxConfig.memoryLimit} MB</Typography>
                <Slider
                  value={onnxConfig.memoryLimit}
                  onChange={(e, value) =>
                    setOnnxConfig((prev) => ({
                      ...prev,
                      memoryLimit: value as number,
                  }))
                }
                  min={512}
                  max={4096}
                  step={256}
                  marks={[
                    { value: 52, label: '512MB' },
                    { value: 104, label: '1GB' },
                    { value: 208, label: '2GB' },
                    { value: 406, label: '4GB' },
                  ]}
                  sx={{ mb:  2 }}
                />

                <Typography gutterBottom>Parallelism: {onnxConfig.parallelism} threads</Typography>
                <Slider
                  value={onnxConfig.parallelism}
                  onChange={(e, value) =>
                    setOnnxConfig((prev) => ({
                      ...prev,
                      parallelism: value as number,
                  }))
                }
                  min={1}
                  max={16}
                  step={1}
                  marks={[
                    { value: 1, label: '1' },
                    { value:  4, label: '4' },
                    { value:  8, label: '8' },
                    { value:  16, label: '16' },
                  ]}
                  sx={{ mb:  2 }}
                />

                <Button fullWidth
                  variant="contained"
                  onClick={() => sx={theming.getThemedButtonSx()}>
                    loadModel.mutate({
                      modelId: 'onnx-runtime',
                      config: onnxConfig,
                  })
                }
                  disabled={loadModel.isPending}
                  sx={{ bgcolor: '#ff8c00', '&:hover': { bgcolor: '#e67c00' } }}
                >
                  Konfigurer ONNX Runtime
                </Button>
              </Paper>
            </Grid>

            <Grid item xs={12} md={6}>
              <Paper sx={{ p:  2 ,  ...theming.getThemedCardSx() }}>
                <Typography variant="subtitle1" sx={{ mb:  2 }}>
                  ONNX Model Oversikt
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
                            color={getStatusColor(model.status) as any}
                            size="small"
                          />
                        </Stack>
                      </ListItem>
                    ))}
                </List>

                <Divider sx={{ my:  2 }} />

                <Typography variant="body2" color="text.secondary">
                  <strong>ONNX Fordeler: </strong>
                  <br />• Kryssplattform kompatibilitet
                  <br />• Optimalisert inferens ytelse
                  <br />• Standardisert model format
                  <br />• Hardware akselerasjon støtte
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Photo AI Panel , *, /}
        <TabPanel value={currentTab} index={1}>
          <Typography variant="h6" sx={{  mb:  2  }}>
            Foto AI-Modeller
          </Typography>

          <Grid container spacing={2}>
            {aiModels
              .filter((model) => model.type === 'photo')
              .map((model) => (
                <Grid item xs={12} md={6} lg={4} key={model.id}>
                  <Card variant="outlined" sx={{ height: '100%' ,  ...theming.getThemedCardSx() }}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb:  2 }}>
                        <Avatar sx={{ bgcolor: '#ff8c00', mr:  2 }}>
                          <PhotoIcon />
                        </Avatar>
                        <Box>
                          <Typography variant="h6" sx={{ color: theming.colors.primary }}>{model.name}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {model.protocol.toUpperCase()} • v{model.version}
                          </Typography>
                        </Box>
                      </Box>

                      <Stack spacing={1} sx={{ mb:  2 }}>
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between' }}
                        >
                          <Typography variant="body2">Nøyaktighet: </Typography>
                          <Typography variant="body2">{model.accuracy}%</Typography>
                        </Box>
                        <LinearProgress variant="determinate" value={model.accuracy} />

                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between' }}
                        >
                          <Typography variant="body2">Størrelse: </Typography>
                          <Typography variant="body2">{model.size}MB</Typography>
                        </Box>
                      </Stack>

                      <Typography variant="body2" sx={{ mb:  2 }}>
                        <strong>Støttede formater: </strong>
                        <br />
                        Inn: {model.inputFormats.join('')}
                        <br />
                        Ut: {model.outputFormats.join(', ')}
                      </Typography>

                      <Button
                        fullWidth
                        variant={selectedModel?.id === model.id ? 'contained' : 'outlined'}
                        onClick={() => setSelectedModel(model)}
                        disabled={model.status !== 'ready'}
                        startIcon={
                          model.status === 'loading' ? (
                            <CircularProgress size={16} />
                          ) : (
                            <CameraAlt />
                          )
                      }
                      >
                        {model.status === 'ready' ? 'Velg Model' : model.status.toUpperCase()}
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
          </Grid>

          {selectedModel && selectedModel.type === 'photo' && (
            <Paper sx={{ p: 2, mt: 3, bgcolor: 'rgba(25, 1400.1)' ,  ...theming.getThemedCardSx() }}>
              <Typography variant="h6" sx={{  mb:  2  }}>
                Bildeforbedring med {selectedModel.name}
              </Typography>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={8}>
                  <TextField
                    fullWidth
                    label="Velg bildefil"
                    placeholder="Dra og slipp eller klikk for å velge..."
                    InputProps={{
                      endAdornment: theming.getThemedIcon(', ')}}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <Button fullWidth
                    variant="contained"
                    onClick={() => sx={theming.getThemedButtonSx()}>
                      processContent.mutate({
                        modelId: selectedModel.d,
                        inputFile: 'example.jpg',
                        options: { enhancement: 'auto' },
                    })
                  }
                    disabled={processContent.isPending}
                    sx={{
                      bgcolor: '#ff8c00', '&:hover': { bgcolor: '#e67c00' }}}
                  >
                    Forbedre Bilde
                  </Button>
                </Grid>
              </Grid>
            </Paper>
          )}
        </TabPanel>

        {/* Video AI Panel */}
        <TabPanel value={currentTab} index={2}>
          <Typography variant="h6" sx={{  mb:  2  }}>
            Video AI-Modeller
          </Typography>

          <Grid container spacing={2}>
            {aiModels
              .filter((model) => model.type === 'video')
              .map((model) => (
                <Grid item xs={12} md={6} key={model.id}>
                  <Card variant="outlined" sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb:  2 }}>
                        <Avatar sx={{ bgcolor: '#1976d0', mr:  2 }}>
                          <VideoIcon />
                        </Avatar>
                        <Box>
                          <Typography variant="h6" sx={{ color: theming.colors.primary }}>{model.name}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            Video Processing • {model.device.toUpperCase()}
                          </Typography>
                        </Box>
                      </Box>

                      <Typography variant="body2" sx={{ mb:  2 }}>
                        Avansert videobehandling med neural nettverk for kvalitetsforbedring,
                        stabilisering og automatisk innholdsanalyse.
                      </Typography>

                      <Stack direction="row" spacing={1} sx={{ mb:  2 }}>
                        <Chip label="4K Support" size="small" color="primary" />
                        <Chip label="Real-time" size="small" color="success" />
                        <Chip label="GPU Accelerated" size="small" color="secondary" />
                      </Stack>

                      <Button
                        fullWidth
                        variant="outlined"
                        disabled={model.status !== 'ready'}
                        startIcon={theming.getThemedIcon('videoLibrary')}
                      >
                        {model.status === 'ready' ? 'Process Video' : 'Loading...'}
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
          </Grid>
        </TabPanel>

        {/* Audio AI Panel */}
        <TabPanel value={currentTab} index={3}>
          <Typography variant="h6" sx={{  mb:  2  }}>
            Lyd AI-Modeller
          </Typography>

          <Grid container spacing={2}>
            {aiModels
              .filter((model) => model.type === 'audio')
              .map((model) => (
                <Grid item xs={12} md={6} key={model.id}>
                  <Card variant="outlined" sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb:  2 }}>
                        <Avatar sx={{ bgcolor: '#9c27b0', mr:  2 }}>
                          <AudioIcon />
                        </Avatar>
                        <Box>
                          <Typography variant="h6" sx={{ color: theming.colors.primary }}>{model.name}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            Audio Enhancement • {model.accuracy}% accuracy
                          </Typography>
                        </Box>
                      </Box>

                      <Typography variant="body2" sx={{ mb:  2 }}>
                        Intelligent lydbehandling med støyreduksjon, kvalitetsforbedring og
                        automatisk mastering for profesjonell lydkvalitet.
                      </Typography>

                      <Stack direction="row" spacing={1} sx={{ mb:  2 }}>
                        <Chip label="Noise Reduction" size="small" color="primary" />
                        <Chip label="Auto Mastering" size="small" color="success" />
                        <Chip label="48kHz Support" size="small" color="secondary" />
                      </Stack>

                      <Button
                        fullWidth
                        variant="outlined"
                        disabled={model.status !== 'ready'}
                        startIcon={<MusicNote />}
                      >
                        {model.status === 'ready' ? 'Process Audio' : 'Loading...'}
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
          </Grid>
        </TabPanel>

        {/* AI Protocol Comparison */}
        <Divider sx={{ my:  3 }} />
        <Typography variant="h6" sx={{  mb:  2  }}>
          AI Protocol Sammenligning
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap:  2}}
        >
          <Paper sx={{ p: 2, border: '2px solid #ff8c00' ,  ...theming.getThemedCardSx() }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb:  2 }}>
              <OnnxIcon sx={{ mr: 1, color: '#ff8c00' }} />
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>ONNX</Typography>
            </Box>
            <Typography variant="body2" sx={{ mb:  1 }}>
              🔄 Kryssplattform kompatibilitet
            </Typography>
            <Typography variant="body2" sx={{ mb:  1 }}>
              ⚡ Optimalisert inferens
            </Typography>
            <Typography variant="body2" sx={{ mb:  1 }}>
              🏭 Industristandard format
            </Typography>
            <Typography variant="body2">🔧 Hardware akselerasjon</Typography>
          </Paper>

          <Paper sx={{ p: 2, border: '2px solid #1976d2' ,  ...theming.getThemedCardSx() }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb:  2 }}>
              <PhotoIcon sx={{ mr: 1, color: '#1976d2' }} />
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>Foto AI</Typography>
            </Box>
            <Typography variant="body2" sx={{ mb:  1 }}>
              📸 Intelligent bildeforbedring
            </Typography>
            <Typography variant="body2" sx={{ mb:  1 }}>
              🎨 Stiloverføring og effekter
            </Typography>
            <Typography variant="body2" sx={{ mb:  1 }}>
              🔍 Objektdeteksjon og -fjerning
            </Typography>
            <Typography variant="body2">📊 Kvalitetsanalyse</Typography>
          </Paper>

          <Paper sx={{ p: 2, border: '2px solid #9c27b0' ,  ...theming.getThemedCardSx() }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb:  2 }}>
              <VideoIcon sx={{ mr: 1, color: '#9c27b0' }} />
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>Video AI</Typography>
            </Box>
            <Typography variant="body2" sx={{ mb:  1 }}>
              🎬 Videooppskalering og stabilisering
            </Typography>
            <Typography variant="body2" sx={{ mb:  1 }}>
              ✂️ Automatisk scenedeling
            </Typography>
            <Typography variant="body2" sx={{ mb:  1 }}>
              🎯 Objekttracking
            </Typography>
            <Typography variant="body2">🎨 Stiloverføring for video</Typography>
          </Paper>

          <Paper sx={{ p: 2, border: '2px solid #4caf50' ,  ...theming.getThemedCardSx() }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb:  2 }}>
              <AudioIcon sx={{ mr: 1, color: '#4caf50' }} />
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>Lyd AI</Typography>
            </Box>
            <Typography variant="body2" sx={{ mb:  1 }}>
              🔇 Intelligent støyreduksjon
            </Typography>
            <Typography variant="body2" sx={{ mb:  1 }}>
              🎧 Automatisk mastering
            </Typography>
            <Typography variant="body2" sx={{ mb:  1 }}>
              🗣️ Stemme isolering
            </Typography>
            <Typography variant="body2">🎵 Musikk separasjon</Typography>
          </Paper>
        </Box>
      </CardContent>
    </Card>
  );
}
