/**
 * AI Video Generator Component
 * 
 * Sora-like text-to-video interface for Customer Journey Builder
 */

import React, { useState } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Card,
  CardContent,
  Grid,
  Chip,
  LinearProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  MovieCreation as CreateIcon,
  Close as CloseIcon,
  Download as DownloadIcon,
  Share as ShareIcon,
  Settings as SettingsIcon,
  ExpandMore as ExpandMoreIcon,
  AutoAwesome as AIIcon,
  AttachMoney as CostIcon,
  Timer as DurationIcon,
  AspectRatio as AspectRatioIcon,
  HighQuality as QualityIcon,
} from '@mui/icons-material';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface VideoGenerationRequest {
  prompt: string;
  style?: string;
  duration?: number;
  aspectRatio?: string;
  fps?: number;
  resolution?: string;
  backend?: string;
}

interface VideoGenerationResult {
  id: string;
  status: 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  thumbnailUrl?: string;
  duration?: number;
  cost?: number;
  metadata: any;
  error?: string;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface AIVideoGeneratorProps {
  open: boolean;
  onClose: () => void;
  onVideoGenerated?: (result: VideoGenerationResult) => void;
  initialPrompt?: string;
  touchpointType?: string;
}

export default function AIVideoGenerator({
  open,
  onClose,
  onVideoGenerated,
  initialPrompt = ', ',
}: AIVideoGeneratorProps) {
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // STATE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const [prompt, setPrompt] = useState(initialPrompt);
  const [style, setStyle] = useState<string>('cinematic');
  const [duration, setDuration] = useState(10);
  const [aspectRatio, setAspectRatio] = useState('16:9, ');
  const [resolution, setResolution] = useState('1080p');
  const [fps, setFps] = useState(30);
  const [backend, setBackend] = useState('runway');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [generatedVideo, setGeneratedVideo] = useState<VideoGenerationResult | null>(null);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // API
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // Fetch example prompts
  const { data: examples } = useQuery({
    queryKey: ['video-examples'],
    queryFn: async () => {
      const response = await axios.get('/api/ai-video/examples');
      return response.data.data;
    },
  });

  // Estimate cost
  const { data: costEstimate } = useQuery({
    queryKey: ['video-cost', duration, backend],
    queryFn: async () => {
      const response = await axios.post('/api/ai-video/pricing/estimate', {
        duration,
        backend,
      });
      return response.data.data;
    },
  });

  // Generate video mutation
  const generateMutation = useMutation({
    mutationFn: async (request: VideoGenerationRequest) => {
      const response = await axios.post('/api/ai-video/generate', request);
      return response.data.data;
    },
    onSuccess: (result) => {
      setGeneratedVideo(result);
      if (onVideoGenerated) {
        onVideoGenerated(result);
      }
    },
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // HANDLERS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const handleGenerate = () => {
    if (!prompt.trim()) {
      return;
    }

    generateMutation.mutate({
      prompt,
      style,
      duration,
      aspectRatio,
      fps,
      resolution,
      backend,
    });
  };

  const handleUseExample = (examplePrompt: string) => {
    setPrompt(examplePrompt);
  };

  const handleReset = () => {
    setPrompt(initialPrompt);
    setGeneratedVideo(null);
    generateMutation.reset();
  };

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // RENDER
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            <AIIcon color="primary" />
            <Typography variant="h6">AI Video Generator (Sora-like)</Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ py: 2 }}>
          {/* Header Info */}
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              <strong>Generate professional videos from text prompts!</strong>
              <br />
              Uses Runway Gen-3 (near-Sora quality) or Stability AI Video (free). Perfect for customer journey
              touchpoints, ads, and marketing materials.
            </Typography>
          </Alert>

          {/* Main Prompt */}
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Video Prompt"
            placeholder="Describe the video you want to create... (e.g.'Professional Norwegian photographer frustrated at laptop, 15 browser tabs open, messy desk, Nordic lighting, cinematic, 4K')"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            sx={{ mb: 3 }}
            helperText={`${prompt.length}/500 characters`}
          />

          {/* Quick Settings */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Style</InputLabel>
                <Select value={style} onChange={(e) => setStyle(e.target.value)} label="Style">
                  <MenuItem value="cinematic">🎬 Cinematic</MenuItem>
                  <MenuItem value="documentary">📹 Documentary</MenuItem>
                  <MenuItem value="animated">🎨 Animated</MenuItem>
                  <MenuItem value="motion_graphics">🎯 Motion Graphics</MenuItem>
                  <MenuItem value="realistic">📸 Realistic</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Duration</InputLabel>
                <Select value={duration} onChange={(e) => setDuration(Number(e.target.value))} label="Duration">
                  <MenuItem value={5}>5 seconds</MenuItem>
                  <MenuItem value={10}>10 seconds</MenuItem>
                  <MenuItem value={15}>15 seconds</MenuItem>
                  <MenuItem value={30}>30 seconds</MenuItem>
                  <MenuItem value={60}>60 seconds</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Aspect Ratio</InputLabel>
                <Select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} label="Aspect Ratio">
                  <MenuItem value="16:9">16:9 (YouTube)</MenuItem>
                  <MenuItem value="9:16">9:16 (TikTok/Reels)</MenuItem>
                  <MenuItem value="1:1">1:1 (Instagram)</MenuItem>
                  <MenuItem value="4:3">4:3 (Classic)</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Backend</InputLabel>
                <Select value={backend} onChange={(e) => setBackend(e.target.value)} label="Backend">
                  <MenuItem value="runway">⭐ Runway (Best Quality)</MenuItem>
                  <MenuItem value="stability">💰 Stability AI (Free)</MenuItem>
                  <MenuItem value="leonardo">⚡ Leonardo (Fast)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          {/* Cost Estimate */}
          {costEstimate && (
            <Box sx={{ mb: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
              <Grid container spacing={2}>
                <Grid item xs={6} sm={3}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <DurationIcon fontSize="small" />
                    <Typography variant="body2">
                      <strong>Duration:</strong> {duration}s
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <AspectRatioIcon fontSize="small" />
                    <Typography variant="body2">
                      <strong>Ratio:</strong> {aspectRatio}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <QualityIcon fontSize="small" />
                    <Typography variant="body2">
                      <strong>Quality:</strong> {resolution}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <CostIcon fontSize="small" color={costEstimate.totalCost > 0 ? 'warning' : 'success'} />
                    <Typography variant="body2">
                      <strong>Cost:</strong> ${costEstimate.totalCost.toFixed(2)}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </Box>
          )}

          {/* Advanced Settings */}
          <Accordion expanded={showAdvanced} onChange={() => setShowAdvanced(!showAdvanced)}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box display="flex" alignItems="center" gap={1}>
                <SettingsIcon fontSize="small" />
                <Typography>Advanced Settings</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Resolution</InputLabel>
                    <Select value={resolution} onChange={(e) => setResolution(e.target.value)} label="Resolution">
                      <MenuItem value="720p">720p (HD)</MenuItem>
                      <MenuItem value="1080p">1080p (Full HD)</MenuItem>
                      <MenuItem value="4k">4K (Ultra HD)</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>FPS</InputLabel>
                    <Select value={fps} onChange={(e) => setFps(Number(e.target.value))} label="FPS">
                      <MenuItem value={24}>24 fps (Cinematic)</MenuItem>
                      <MenuItem value={30}>30 fps (Standard)</MenuItem>
                      <MenuItem value={60}>60 fps (Smooth)</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>

          {/* Example Prompts */}
          {Array.isArray(examples) && examples.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                📝 Example Prompts
              </Typography>
              <Grid container spacing={1}>
                {examples.slice(0, 2).map((category: any, catIdx: number) => (
                  <React.Fragment key={catIdx}>
                    {(Array.isArray(category.prompts) ? category.prompts : []).slice(0, 2).map((example: any, idx: number) => (
                      <Grid item xs={12} sm={6} key={idx}>
                        <Card
                          variant="outlined"
                          sx={{
                            cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' },
                            transition: 'all 0.2s'}}
                          onClick={() => handleUseExample(example.prompt)}
                        >
                          <CardContent>
                            <Typography variant="body2" fontWeight="bold" gutterBottom>
                              {example.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                              {example.prompt.substring(0, 80)}...
                            </Typography>
                            <Box display="flex" gap={0.5}>
                              <Chip label={example.style} size="small" />
                              <Chip label={`${example.duration}s`} size="small" />
                            </Box>
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </React.Fragment>
                ))}
              </Grid>
            </Box>
          )}

          {/* Generation Progress */}
          {generateMutation.isPending && (
            <Box sx={{ mt: 3 }}>
              <Alert severity="info">
                <Typography variant="body2" gutterBottom>
                  🎬 Generating your video... This may take 1-3 minutes.
                </Typography>
                <LinearProgress sx={{ mt: 1 }} />
                <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
                  Step 1/4: Generating storyboard with AI...
                </Typography>
              </Alert>
            </Box>
          )}

          {/* Error */}
          {generateMutation.isError && (
            <Alert severity="error" sx={{ mt: 3 }}>
              <Typography variant="body2">
                ❌ Generation failed: {(generateMutation.error as any)?.message || 'Unknown error'}
              </Typography>
            </Alert>
          )}

          {/* Generated Video Result */}
          {generatedVideo && generatedVideo.status === 'completed' && (
            <Box sx={{ mt: 3 }}>
              <Alert severity="success" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  ✅ Video generated successfully! (Cost: ${generatedVideo.cost?.toFixed(2) || '0.00'})
                </Typography>
              </Alert>

              <Card>
                <Box sx={{ position: 'relative', paddingTop: '56.25%', bgcolor: 'black' }}>
                  {generatedVideo.videoUrl && (
                    <video
                      src={generatedVideo.videoUrl}
                      controls
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%'}}
                    />
                  )}
                </Box>
                <CardContent>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {generatedVideo.metadata?.prompt}
                  </Typography>
                  <Box display="flex" gap={1} mt={2}>
                    {generatedVideo.videoUrl && (
                      <Button
                        component="a"
                        variant="outlined"
                        size="small"
                        startIcon={<DownloadIcon />}
                        href={generatedVideo.videoUrl}
                        download
                      >
                        Download
                      </Button>
                    )}
                    <Button variant="outlined" size="small" startIcon={<ShareIcon />}>
                      Share
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleReset} disabled={generateMutation.isPending}>
          Reset
        </Button>
        <Button onClick={onClose}>Close</Button>
        <Button
          variant="contained"
          startIcon={<CreateIcon />}
          onClick={handleGenerate}
          disabled={!prompt.trim() || generateMutation.isPending}
        >
          {generateMutation.isPending ? 'Generating...' : 'Generate Video'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}



