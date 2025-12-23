/**
 * Vision Transformer Panel
 * UI component for 2025 Vision Transformer classification and enhancement
 */

import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Stack,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  List,
  ListItem,
  ListItemText,
  Divider,
} from '@mui/material';
import {
  Psychology,
  Image as ImageIcon,
  PlayArrow,
  CheckCircle,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

interface VisionTransformerPanelProps {
  imageUrl?: string;
  onClassified?: (predictions: any[]) => void;
  onError?: (error: string) => void;
}

export default function VisionTransformerPanel({
  imageUrl,
  onClassified,
  onError,
}: VisionTransformerPanelProps) {
  const [task, setTask] = useState<'classification' | 'segmentation' | 'enhancement'>('classification');
  const [model, setModel] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [predictions, setPredictions] = useState<any[]>([]);

  const classifyMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      return apiRequest<{
        success: boolean;
        predictions: any[];
        method: string;
      }>('/api/enhanced-ai/vision-transformer-classify', {
        method: 'POST',
        body: formData,
      });
    },
    onSuccess: (data) => {
      if (data.success && data.predictions) {
        setPredictions(data.predictions);
        onClassified?.(data.predictions);
      } else {
        onError?.('Classification failed');
      }
    },
    onError: (error: any) => {
      const errorMessage = error?.message || 'Vision Transformer classification failed';
      onError?.(errorMessage);
    },
  });

  const handleClassify = async () => {
    if (!file && !imageUrl) {
      onError?.('Please provide an image');
      return;
    }

    const formData = new FormData();
    if (file) {
      formData.append('image', file);
    }
    formData.append('task', task);
    if (model) {
      formData.append('model', model);
    }

    classifyMutation.mutate(formData);
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
            <Psychology color="primary" />
            <Typography variant="h6">Vision Transformer (2025)</Typography>
            <Chip label="AI" size="small" color="primary" />
          </Box>

          <Alert severity="info">
            Uses state-of-the-art 2025 Vision Transformer models for image
            classification, segmentation, and enhancement.
          </Alert>

          {imageUrl && (
            <Box>
              <img
                src={imageUrl}
                alt="Source"
                style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px' }}
              />
            </Box>
          )}

          <FormControl fullWidth>
            <InputLabel>Task</InputLabel>
            <Select
              value={task}
              onChange={(e) => setTask(e.target.value as any)}
              label="Task"
            >
              <MenuItem value="classification">Classification</MenuItem>
              <MenuItem value="segmentation">Segmentation</MenuItem>
              <MenuItem value="enhancement">Enhancement</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel>Model (Optional)</InputLabel>
            <Select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              label="Model (Optional)"
            >
              <MenuItem value="">Auto-select</MenuItem>
              <MenuItem value="vit-base">ViT-Base</MenuItem>
              <MenuItem value="vit-large">ViT-Large</MenuItem>
              <MenuItem value="deit">DeiT</MenuItem>
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
            onClick={handleClassify}
            disabled={classifyMutation.isPending || (!file && !imageUrl)}
            startIcon={
              classifyMutation.isPending ? (
                <CircularProgress size={20} />
              ) : (
                <PlayArrow />
              )
            }
            fullWidth
          >
            {classifyMutation.isPending
              ? 'Processing...'
              : `Run ${task.charAt(0).toUpperCase() + task.slice(1)}`}
          </Button>

          {predictions.length > 0 && (
            <>
              <Divider />
              <Typography variant="subtitle2" fontWeight="bold">
                Results:
              </Typography>
              <List dense>
                {predictions.map((pred, idx) => (
                  <ListItem key={idx}>
                    <CheckCircle color="success" sx={{ mr: 1 }} />
                    <ListItemText
                      primary={pred.label || pred.class || `Prediction ${idx + 1}`}
                      secondary={
                        pred.confidence
                          ? `Confidence: ${(pred.confidence * 100).toFixed(1)}%`
                          : pred.description
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </>
          )}

          {classifyMutation.isError && (
            <Alert severity="error">
              {classifyMutation.error?.message ||'Classification failed'}
            </Alert>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

