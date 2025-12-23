/**
 * OBJECT SEGMENTATION PANEL
 * AI-powered object segmentation in video using SAM 2
 * Enables selective effects, color grading, and background replacement
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  Stack,
  TextField,
  IconButton,
  LinearProgress,
  Chip,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Grid,
  Card,
  CardContent,
} from '@mui/material';
import { Close, AutoAwesome, PlayArrow, Image as ImageIcon } from '@mui/icons-material';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface ObjectSegmentationPanelProps {
  open: boolean;
  onClose: () => void;
  clipId: string;
  videoUrl?: string;
  onSegmentationComplete: (result: any) => void;
}

interface SegmentationResult {
  frames: Array<{
    frame: number;
    masks: Array<{
      mask: string; // Base64 PNG
      bbox: [number, number, number, number];
      confidence: number;
      area: number;
    }>;
  }>;
  video_info: {
    fps: number;
    width: number;
    height: number;
    total_frames: number;
  };
  model_size: string;
}

export default function ObjectSegmentationPanel({
  open,
  onClose,
  clipId,
  videoUrl,
  onSegmentationComplete,
}: ObjectSegmentationPanelProps) {
  const [promptType, setPromptType] = useState<'point' | 'box' | 'auto'>('point');
  const [prompt, setPrompt] = useState<{ points?: Array<[number, number]>; box?: [number, number, number, number] } | null>(null);
  const [modelSize, setModelSize] = useState<'tiny' | 'small' | 'base_plus' | 'large'>('small');
  const [frameNumbers, setFrameNumbers] = useState<string>(''); // Comma-separated or 'all'
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'queued' | 'processing' | 'completed' | 'failed'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SegmentationResult | null>(null);

  // Poll for job status
  useEffect(() => {
    if (!jobId || status === 'completed' || status === 'failed') return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await apiRequest(`/api/video-analysis/object-segmentation/${jobId}`);
        
        if (response.success) {
          setStatus(response.status);
          
          if (response.status === 'processing') {
            setProgress(prev => Math.min(prev + 10, 90));
          } else if (response.status === 'completed') {
            setProgress(100);
            setResult(response.result);
            setStatus('completed');
            clearInterval(pollInterval);
          } else if (response.status === 'failed') {
            setError(response.error || 'Object segmentation failed');
            setStatus('failed');
            clearInterval(pollInterval);
          }
        }
      } catch (error: any) {
        setError(error.message || 'Failed to check job status');
        setStatus('failed');
        clearInterval(pollInterval);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [jobId, status]);

  const startSegmentationMutation = useMutation({
    mutationFn: async () => {
      if (!videoUrl) {
        throw new Error('Video URL is required');
      }

      const requestBody: any = {
        video_path: videoUrl,
        prompt_type: promptType,
        model_size: modelSize,
      };

      if (frameNumbers && frameNumbers !== 'all') {
        requestBody.frame_numbers = frameNumbers.split(', ').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
      }

      if (prompt) {
        requestBody.prompt = prompt;
      }

      const response = await apiRequest('/api/video-analysis/object-segmentation', {
        method: 'POST',
        headers: {
          'Content-Type' : 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (response.success && response.job_id) {
        setJobId(response.job_id);
        setStatus('queued');
        setProgress(5);
        return response;
      } else {
        throw new Error(response.message || 'Failed to start object segmentation');
      }
    },
    onError: (error: any) => {
      setError(error.message || 'Failed to start object segmentation');
      setStatus('failed');
    },
  });

  const handleStart = () => {
    setError(null);
    setProgress(0);
    setStatus('idle');
    setResult(null);
    startSegmentationMutation.mutate();
  };

  const handleClose = () => {
    if (status === 'processing' || status === 'queued') {
      return;
    }
    setJobId(null);
    setProgress(0);
    setStatus('idle');
    setError(null);
    setResult(null);
    onClose();
  };

  const handleComplete = () => {
    if (result) {
      onSegmentationComplete(result);
    }
    handleClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Object Segmentation (SAM 2)</Typography>
          <IconButton onClick={handleClose} size="small">
            <Close />
          </IconButton>
        </Stack>
      </DialogTitle>
      
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <Alert severity="info">
            Segment objects in your video for selective effects, color grading, or background replacement.
            SAM 2 provides high-quality masks for each frame.
          </Alert>

          {/* Prompt Type */}
          <FormControl fullWidth>
            <InputLabel>Prompt Type</InputLabel>
            <Select
              value={promptType}
              onChange={(e) => setPromptType(e.target.value as any)}
              label="Prompt Type"
              disabled={status !== 'idle'}
            >
              <MenuItem value="point">
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip label="AI" size="small" color="primary" />
                  <Typography>Point (Click on object)</Typography>
                </Stack>
              </MenuItem>
              <MenuItem value="box">Box (Draw bounding box)</MenuItem>
              <MenuItem value="auto">Auto (Detect all objects)</MenuItem>
            </Select>
          </FormControl>

          {/* Model Size */}
          <FormControl fullWidth>
            <InputLabel>Model Size</InputLabel>
            <Select
              value={modelSize}
              onChange={(e) => setModelSize(e.target.value as any)}
              label="Model Size"
              disabled={status !== 'idle'}
            >
              <MenuItem value="tiny">Tiny (Fastest, ~40MB)</MenuItem>
              <MenuItem value="small">Small (Balanced, ~100MB, Recommended)</MenuItem>
              <MenuItem value="base_plus">Base Plus (Better quality, ~200MB)</MenuItem>
              <MenuItem value="large">Large (Best quality, ~400MB)</MenuItem>
            </Select>
          </FormControl>

          {/* Frame Numbers (Optional) */}
          <TextField
            label="Frame Numbers (Optional)"
            placeholder="e.g., 0,10,20,30 or 'all' for entire video"
            value={frameNumbers}
            onChange={(e) => setFrameNumbers(e.target.value)}
            disabled={status !== 'idle'}
            helperText="Leave empty or enter 'all' to segment entire video"
            fullWidth
          />

          {/* Progress */}
          {(status === 'queued' || status === 'processing') && (
            <Box>
              <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="body2">
                  {status === 'queued' ? 'Queued...' : 'Processing...'}
                </Typography>
                <Typography variant="body2">{progress}%</Typography>
              </Stack>
              <LinearProgress variant="determinate" value={progress} />
            </Box>
          )}

          {/* Error Display */}
          {error && (
            <Alert severity="error">{error}</Alert>
          )}

          {/* Results */}
          {result && status === 'completed' && (
            <Paper variant="outlined" sx={{ p: 2, bgcolor: 'success.light' }}>
              <Typography variant="subtitle2" gutterBottom>
                Segmentation Complete!
              </Typography>
              <Stack spacing={1}>
                <Typography variant="body2">
                  <strong>Frames Processed:</strong> {result.frames.length}
                </Typography>
                <Typography variant="body2">
                  <strong>Total Masks:</strong> {result.frames.reduce((sum, f) => sum + f.masks.length, 0)}
                </Typography>
                <Typography variant="body2">
                  <strong>Model:</strong> SAM 2 {result.model_size}
                </Typography>
                <Typography variant="body2">
                  <strong>Video:</strong> {result.video_info.width}x{result.video_info.height} @ {result.video_info.fps}fps
                </Typography>
              </Stack>
            </Paper>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={status === 'processing' || status === 'queued'}>
          Cancel
        </Button>
        {status === 'idle' && (
          <Button
            variant="contained"
            startIcon={<AutoAwesome />}
            onClick={handleStart}
            disabled={!videoUrl || startSegmentationMutation.isPending}
          >
            Start Segmentation
          </Button>
        )}
        {status ==='completed' && result && (
          <Button
            variant="contained"
            color="success"
            onClick={handleComplete}
          >
            Apply Results
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
