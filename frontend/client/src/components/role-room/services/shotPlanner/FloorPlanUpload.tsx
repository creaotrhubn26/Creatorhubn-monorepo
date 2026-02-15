/**
 * Floor Plan Upload Component
 * Allows uploading and managing floor plan images for shot planning
 */

import React, { useRef } from 'react';
import {
  Box,
  Paper,
  Button,
  Typography,
  Slider,
  Stack,
  CircularProgress,
  Alert,
} from '@mui/material';
import { CloudUpload as UploadIcon, Delete as DeleteIcon } from '@mui/icons-material';

interface FloorPlanUploadProps {
  currentImageUrl?: string;
  scale?: number;
  onUpload: (imageUrl: string, scale: number) => Promise<void>;
  onDelete: () => void;
  glassStyles?: any;
}

export const FloorPlanUpload: React.FC<FloorPlanUploadProps> = ({
  currentImageUrl,
  scale = 1,
  onUpload,
  onDelete,
  glassStyles = {},
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [localScale, setLocalScale] = React.useState(scale);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(currentImageUrl || null);

  const handleFileSelect = async (file: File) => {
    try {
      setError(null);
      setIsLoading(true);

      // Validate file
      if (!file.type.startsWith('image/')) {
        throw new Error('Please select an image file');
      }

      if (file.size > 10 * 1024 * 1024) {
        throw new Error('File size must be less than 10MB');
      }

      // Create preview
      const reader = new FileReader();
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string;
        setPreviewUrl(dataUrl);

        // Upload to R2 (Cloudflare R2)
        const formData = new FormData();
        formData.append('file', file);
        formData.append('directory', 'floor-plans');

        const response = await fetch('/api/upload/image', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Upload failed: ${response.statusText}`);
        }

        const data = await response.json();
        await onUpload(data.url, localScale);
      };

      reader.readAsDataURL(file);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleScaleChange = (_: Event, newValue: number | number[]) => {
    const newScale = Array.isArray(newValue) ? newValue[0] : newValue;
    setLocalScale(newScale);
  };

  return (
    <Paper
      sx={{
        p: 3,
        ...glassStyles,
        borderRadius: 2,
      }}
    >
      <Typography variant="h6" sx={{ mb: 2 }}>
        Floor Plan
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {previewUrl && (
        <Box
          sx={{
            mb: 2,
            borderRadius: 1,
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.1)',
            maxHeight: 300,
          }}
        >
          <img
            src={previewUrl}
            alt="Floor plan"
            style={{
              width: '100%',
              height: 'auto',
              display: 'block',
              opacity: 0.8,
            }}
          />
        </Box>
      )}

      <Stack spacing={2}>
        {previewUrl && (
          <>
            <Box>
              <Typography variant="caption">Scale: {(localScale * 100).toFixed(0)}%</Typography>
              <Slider
                min={0.1}
                max={2}
                step={0.1}
                value={localScale}
                onChange={handleScaleChange}
                sx={{
                  '& .MuiSlider-track': { backgroundColor: '#4FC3F7' },
                  '& .MuiSlider-thumb': { backgroundColor: '#4FC3F7' },
                }}
              />
            </Box>

            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={onDelete}
              fullWidth
            >
              Remove Floor Plan
            </Button>
          </>
        )}

        <Button
          variant={previewUrl ? 'outlined' : 'contained'}
          startIcon={isLoading ? <CircularProgress size={20} /> : <UploadIcon />}
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          fullWidth
        >
          {previewUrl ? 'Change Floor Plan' : 'Upload Floor Plan'}
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={handleFileChange}
        />

        <Typography variant="caption" color="textSecondary">
          PNG, JPG up to 10MB. Will be used as scene background layer.
        </Typography>
      </Stack>
    </Paper>
  );
};

export default FloorPlanUpload;
