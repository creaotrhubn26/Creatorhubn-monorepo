/**
 * MOTION TRACKING PANEL
 * AI-powered motion tracking using SAM 2 (Segment Anything Model 2)
 * Falls back to OpenCV trackers if SAM 2 unavailable
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
  Paper
} from '@mui/material';
import { Close, PlayArrow, Stop, GpsFixed } from '@mui/icons-material';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface MotionTrackingPanelProps {
  open: boolean;
  onClose: () => void;
  clipId: string;
  videoUrl?: string;
  onTrackingComplete: (result: any) => void;
}

interface TrackingResult {
  frames: Array<{
    frame_number: number;
    bbox: [number, number, number, number]; // [x, y, width, height]
    mask?: string; // Base64 encoded mask (if SAM 2 used)
    confidence?: number;
  }>;
  tracker_type: string;
  total_frames: number;
}

export default function MotionTrackingPanel({
  open,
  onClose,
  clipId,
  videoUrl,
  onTrackingComplete
}: MotionTrackingPanelProps) {
  const [bbox, setBbox] = useState({ x: 0, y: 0, width: 100, height: 100 });
  const [trackerType, setTrackerType] = useState<'sam2' | 'CSRT' | 'KCF' | 'MOSSE'>('sam2');
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'queued' | 'processing' | 'completed' | 'failed'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TrackingResult | null>(null);

  // Poll for job status
  useEffect(() => {
    if (!jobId || status === 'completed' || status === 'failed') return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await apiRequest(`/api/video-analysis/motion-tracking/${jobId}`);
        
        if (response.success) {
          setStatus(response.status);
          
          if (response.status === 'processing') {
            // Estimate progress based on status
            setProgress(prev => Math.min(prev + 10, 90));
          } else if (response.status === 'completed') {
            setProgress(100);
            setResult(response.result);
            setStatus('completed');
            clearInterval(pollInterval);
          } else if (response.status === 'failed') {
            setError(response.error || 'Motion tracking failed');
            setStatus('failed');
            clearInterval(pollInterval);
          }
        }
      } catch (error: any) {
        setError(error.message || 'Failed to check job status');
        setStatus('failed');
        clearInterval(pollInterval);
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(pollInterval);
  }, [jobId, status]);

  const startTrackingMutation = useMutation({
    mutationFn: async () => {
      if (!videoUrl) {
        throw new Error('Video URL is required');
      }

      // Convert bbox to format expected by API: [x, y, width, height]
      const bboxArray = [bbox.x, bbox.y, bbox.width, bbox.height];

      const response = await apiRequest('/api/video-analysis/motion-tracking', {
        method: 'POST',
        headers: {
          'Content-Type' : 'application/json',
        },
        body: JSON.stringify({
          video_path: videoUrl,
          bbox: bboxArray,
          tracker_type: trackerType === 'sam2' ? 'SAM2' : trackerType,
        }),
      });

      if (response.success && response.job_id) {
        setJobId(response.job_id);
        setStatus('queued');
        setProgress(5);
        return response;
      } else {
        throw new Error(response.message || 'Failed to start motion tracking');
      }
    },
    onError: (error: any) => {
      setError(error.message || 'Failed to start motion tracking');
      setStatus('failed');
    }
  });

  const handleStart = () => {
    setError(null);
    setProgress(0);
    setStatus('idle');
    setResult(null);
    startTrackingMutation.mutate();
  };

  const handleClose = () => {
    if (status === 'processing' || status === 'queued') {
      // Don't close if processing
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
      onTrackingComplete(result);
      
      // Automatically save training data for fine-tuning
      // This happens in the background, so we don't wait for it
      apiRequest('/api/video-analysis/sam2-training-data', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({
          video_clip_id: clipId,
          user_id: 'current-user', // TODO: Get from auth context
          initial_bbox: [bbox.x, bbox.y, bbox.width, bbox.height],
          initial_frame: 0,
          tracking_method: trackerType === 'sam2' ? 'sam2' : trackerType.toLowerCase(),
          model_size: trackerType === 'sam2' ? 'small' : null,
          predicted_tracking: result.frames.map((f: any) => ({
            frame: f.frame_number || 0,
            bbox: f.bbox,
            confidence: f.confidence || 0.0,
            mask_available: !!f.mask,
            time: (f.frame_number || 0) / 30, // Assuming 30fps
          })),
          video_metadata: {
            total_frames: result.total_frames,
            tracker_type: result.tracker_type,
          },
        }),
      }).catch((error) => {
        console.warn('Failed to save training data: ', error);
        // Don't show error to user - this is background operation
      });
    }
    handleClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Motion Tracking</Typography>
          <IconButton onClick={handleClose} size="small">
            <Close />
          </IconButton>
        </Stack>
      </DialogTitle>
      
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          {/* Instructions */}
          <Alert severity="info">
            Track objects in your video using AI-powered SAM 2 or OpenCV trackers.
            Select the bounding box area to track.
          </Alert>

          {/* Bounding Box Input */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Bounding Box (Select area to track)
            </Typography>
            <Stack direction="row" spacing={2}>
              <TextField
                label="X"
                type="number"
                value={bbox.x}
                onChange={(e) => setBbox({ ...bbox, x: parseInt(e.target.value) || 0 })}
                size="small"
                fullWidth
              />
              <TextField
                label="Y"
                type="number"
                value={bbox.y}
                onChange={(e) => setBbox({ ...bbox, y: parseInt(e.target.value) || 0 })}
                size="small"
                fullWidth
              />
              <TextField
                label="Width"
                type="number"
                value={bbox.width}
                onChange={(e) => setBbox({ ...bbox, width: parseInt(e.target.value) || 0 })}
                size="small"
                fullWidth
              />
              <TextField
                label="Height"
                type="number"
                value={bbox.height}
                onChange={(e) => setBbox({ ...bbox, height: parseInt(e.target.value) || 0 })}
                size="small"
                fullWidth
              />
            </Stack>
          </Paper>

          {/* Tracker Type Selection */}
          <FormControl fullWidth>
            <InputLabel>Tracker Type</InputLabel>
            <Select
              value={trackerType}
              onChange={(e) => setTrackerType(e.target.value as any)}
              label="Tracker Type"
              disabled={status !== 'idle'}
            >
              <MenuItem value="sam2">
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip label="AI" size="small" color="primary" />
                  <Typography>SAM 2 (Recommended)</Typography>
                </Stack>
              </MenuItem>
              <MenuItem value="CSRT">CSRT (OpenCV)</MenuItem>
              <MenuItem value="KCF">KCF (OpenCV)</MenuItem>
              <MenuItem value="MOSSE">MOSSE (OpenCV)</MenuItem>
            </Select>
          </FormControl>

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
                Tracking Complete!
              </Typography>
              <Stack spacing={1}>
                <Typography variant="body2">
                  <strong>Tracker:</strong> {result.tracker_type}
                </Typography>
                <Typography variant="body2">
                  <strong>Frames Tracked:</strong> {result.total_frames}
                </Typography>
                <Typography variant="body2">
                  <strong>Tracking Points:</strong> {result.frames.length}
                </Typography>
                {result.frames.some((f: any) => f.mask) && (
                  <Alert severity="success" sx={{ mt: 1 }}>
                    ✅ Masks available for {result.frames.filter((f: any) => f.mask).length} frames.
                    You can use these for mask-based effects (blur background, color grade object, etc.).
                  </Alert>
                )}
                <Alert severity="info" sx={{ mt: 1 }}>
                  Training data will be saved automatically for fine-tuning.
                  You can correct tracking results later to improve the model.
                </Alert>
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
            startIcon={<PlayArrow />}
            onClick={handleStart}
            disabled={!videoUrl || startTrackingMutation.isPending}
          >
            Start Tracking
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


