// @ts-nocheck
/**
 * Diffusion Enhancement Panel
 * UI component for 2025 diffusion model enhancement
 */

import React, { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useEnhancedAIWebSocket } from '@/hooks/useEnhancedAIWebSocket';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Slider,
  TextField,
  Stack,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
} from '@mui/material';
import {
  AutoFixHigh,
  Image as ImageIcon,
  Settings,
  PlayArrow,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

interface DiffusionEnhancementPanelProps {
  imageUrl: string;
  onEnhanced?: (enhancedUrl: string) => void;
  onError?: (error: string) => void;
}

export default function DiffusionEnhancementPanel({
  imageUrl,
  onEnhanced,
  onError,
}: DiffusionEnhancementPanelProps) {
  const [prompt, setPrompt] = useState('');
  const [strength, setStrength] = useState(0.5);
  const [guidanceScale, setGuidanceScale] = useState(7.5);
  const [numInferenceSteps, setNumInferenceSteps] = useState(20);
  const [file, setFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string | undefined>();
  const { progress, result, error: wsError, isConnected } = useEnhancedAIWebSocket(jobId);

  // Handle WebSocket result
  useEffect(() => {
    if (result && result.result?.outputPath) {
      onEnhanced?.(result.result.outputPath);
      setJobId(undefined);
    }
  }, [result, onEnhanced]);

  // Handle WebSocket error
  useEffect(() => {
    if (wsError) {
      onError?.(wsError.error);
      setJobId(undefined);
    }
  }, [wsError, onError]);

  const enhanceMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      return apiRequest<{ success: boolean; outputPath: string; method: string }>(
        '/api/enhanced-ai/diffusion-enhance',
        {
          method: 'POST',
          body: formData,
        }
      );
    },
    onSuccess: (data) => {
      if (data.success && data.outputPath) {
        onEnhanced?.(data.outputPath);
      } else if (data.jobId) {
        // If jobId is returned, subscribe to WebSocket for progress
        setJobId(data.jobId);
      } else {
        onError?.('Enhancement failed');
      }
    },
    onError: (error: any) => {
      const errorMessage = error?.message || 'Diffusion enhancement failed';
      onError?.(errorMessage);
    },
  });

  const handleEnhance = async () => {
    if (!file && !imageUrl) {
      onError?.('Please provide an image');
      return;
    }

    const formData = new FormData();
    if (file) {
      formData.append('image', file);
    }
    formData.append('prompt', prompt || 'enhance image quality, improve details');
    formData.append('strength', strength.toString());
    formData.append('guidanceScale', guidanceScale.toString());
    formData.append('numInferenceSteps', numInferenceSteps.toString());

    enhanceMutation.mutate(formData);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setFile(event.target.files[0]);
    }
  };

  return (
    <Card>
      <CardContent>
        <Stack spacing={3}>
          <Box display="flex" alignItems="center" gap={1}>
            <AutoFixHigh color="primary" />
            <Typography variant="h6">Diffusion Enhancement (2025)</Typography>
            <Chip label="AI" size="small" color="primary" />
          </Box>

          <Alert severity="info">
            Uses state-of-the-art 2025 diffusion models for image enhancement.
            Best for artistic enhancement and style transfer.
          </Alert>

          {!isConnected && (
            <Alert severity="warning">
              WebSocket disconnected. Progress updates may not be available.
            </Alert>
          )}

          {progress && (
            <Box>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="body2" color="text.secondary">
                  {progress.message}
                </Typography>
                <Chip label={`${progress.progress}%`} size="small" />
              </Box>
              <LinearProgress variant="determinate" value={progress.progress} />
              <Typography variant="caption" color="text.secondary" mt={0.5}>
                Stage: {progress.stage}
              </Typography>
            </Box>
          )}

          {imageUrl && (
            <Box>
              <img
                src={imageUrl}
                alt="Source"
                style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px' }}
              />
            </Box>
          )}

          <TextField
            label="Enhancement Prompt (Optional)"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., enhance image quality, improve details, add artistic style"
            fullWidth
            multiline
            rows={2}
          />

          <Box>
            <Typography gutterBottom>Strength: {strength.toFixed(2)}</Typography>
            <Slider
              value={strength}
              onChange={(_, value) => setStrength(value as number)}
              min={0}
              max={1}
              step={0.05}
              marks={[
                { value: 0, label: 'Subtle' },
                { value: 0.5, label: 'Moderate' },
                { value: 1, label: 'Strong' },
              ]}
            />
          </Box>

          <Box>
            <Typography gutterBottom>Guidance Scale: {guidanceScale.toFixed(1)}</Typography>
            <Slider
              value={guidanceScale}
              onChange={(_, value) => setGuidanceScale(value as number)}
              min={1}
              max={20}
              step={0.5}
            />
          </Box>

          <FormControl fullWidth>
            <InputLabel>Inference Steps</InputLabel>
            <Select
              value={numInferenceSteps}
              onChange={(e) => setNumInferenceSteps(e.target.value as number)}
              label="Inference Steps"
            >
              <MenuItem value={10}>10 (Fast)</MenuItem>
              <MenuItem value={20}>20 (Balanced)</MenuItem>
              <MenuItem value={50}>50 (High Quality)</MenuItem>
            </Select>
          </FormControl>

          {!imageUrl && (
            <Button
              variant="outlined"
              component="label"
              startIcon={<ImageIcon />}
              fullWidth
            >
              Upload Image
              <input
                type="file"
                hidden
                accept="image/*"
                onChange={handleFileChange}
              />
            </Button>
          )}

          {file && (
            <Chip
              label={`Selected: ${file.name}`}
              onDelete={() => setFile(null)}
            />
          )}

          <Button
            variant="contained"
            onClick={handleEnhance}
            disabled={enhanceMutation.isPending || (!file && !imageUrl)}
            startIcon={
              enhanceMutation.isPending ? (
                <CircularProgress size={20} />
              ) : (
                <PlayArrow />
              )
            }
            fullWidth
          >
            {enhanceMutation.isPending ? 'Enhancing...' : 'Enhance with Diffusion'}
          </Button>

          {enhanceMutation.isError && (
            <Alert severity="error">
              {enhanceMutation.error?.message ||'Enhancement failed'}
            </Alert>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

