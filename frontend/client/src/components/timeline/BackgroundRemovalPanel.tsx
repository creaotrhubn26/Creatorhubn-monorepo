/**
 * BACKGROUND REMOVAL PANEL
 * AI-powered background removal/blur/replacement
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  Stack,
  Tabs,
  Tab,
  Slider,
  TextField,
  IconButton,
  LinearProgress,
  Chip
} from '@mui/material';
import { Close, RemoveCircle, BlurOn as Blur, Image, AutoAwesome } from '@mui/icons-material';
import { Switch, FormControlLabel } from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface BackgroundRemovalPanelProps {
  open: boolean;
  onClose: () => void;
  clipId: string;
  onProcessed: (result: any) => void;
}

export default function BackgroundRemovalPanel({
  open,
  onClose,
  clipId,
  onProcessed
}: BackgroundRemovalPanelProps) {
  const [mode, setMode] = useState<'remove' | 'blur' | 'replace'>('remove');
  const [blurAmount, setBlurAmount] = useState(20);
  const [backgroundImage, setBackgroundImage] = useState<File | null>(null);
  const [useSAM2Enhancement, setUseSAM2Enhancement] = useState(true);
  
  const processMutation = useMutation({
    mutationFn: async () => {
      // Get video file from clip (this would need to be passed as prop or fetched)
      // For now, use the new API endpoint structure
      const formData = new FormData();
      formData.append('clipId', clipId);
      formData.append('use_sam2_enhancement', String(useSAM2Enhancement));
      
      // Note: In production, you'd need to get the actual video file
      // This is a placeholder - the actual implementation would need the video file
      if (mode === 'remove') {
        const response = await apiRequest('/api/background-removal/remove', {
          method: 'POST',
          body: formData,
        });
        
        // Poll for job completion
        if (response.success && response.job_id) {
          return new Promise((resolve, reject) => {
            const pollInterval = setInterval(async () => {
              try {
                const statusResponse = await apiRequest(`/api/background-removal/${response.job_id}`);
                
                if (statusResponse.status === 'completed') {
                  clearInterval(pollInterval);
                  resolve(statusResponse.result);
                } else if (statusResponse.status === 'failed') {
                  clearInterval(pollInterval);
                  reject(new Error(statusResponse.error || 'Background removal failed'));
                }
              } catch (error: any) {
                clearInterval(pollInterval);
                reject(error);
              }
            }, 2000);
          });
        }
        
        return response;
      } else if (mode === 'blur') {
        formData.append('blurAmount', String(blurAmount));
        const response = await apiRequest('/api/background-removal/blur', {
          method: 'POST',
          body: formData,
        });
        
        if (response.success && response.job_id) {
          return new Promise((resolve, reject) => {
            const pollInterval = setInterval(async () => {
              try {
                const statusResponse = await apiRequest(`/api/background-removal/${response.job_id}`);
                
                if (statusResponse.status === 'completed') {
                  clearInterval(pollInterval);
                  resolve(statusResponse.result);
                } else if (statusResponse.status === 'failed') {
                  clearInterval(pollInterval);
                  reject(new Error(statusResponse.error || 'Background blur failed'));
                }
              } catch (error: any) {
                clearInterval(pollInterval);
                reject(error);
              }
            }, 2000);
          });
        }
        
        return response;
      } else {
        if (backgroundImage) {
          formData.append('background', backgroundImage);
        }
        const response = await apiRequest('/api/background-removal/replace', {
          method: 'POST',
          body: formData,
        });
        
        if (response.success && response.job_id) {
          return new Promise((resolve, reject) => {
            const pollInterval = setInterval(async () => {
              try {
                const statusResponse = await apiRequest(`/api/background-removal/${response.job_id}`);
                
                if (statusResponse.status === 'completed') {
                  clearInterval(pollInterval);
                  resolve(statusResponse.result);
                } else if (statusResponse.status === 'failed') {
                  clearInterval(pollInterval);
                  reject(new Error(statusResponse.error || 'Background replace failed'));
                }
              } catch (error: any) {
                clearInterval(pollInterval);
                reject(error);
              }
            }, 2000);
          });
        }
        
        return response;
      }
    },
    onSuccess: (data) => {
      onProcessed(data);
      onClose();
    }
  });
  
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
        <Stack direction="row" justifyContent="space-between">
          <Typography variant="h6">Background Removal</Typography>
          <IconButton onClick={onClose} sx={{ color: 'white' }}>
            <Close />
          </IconButton>
        </Stack>
      </DialogTitle>
      
      <DialogContent>
        <Tabs value={mode} onChange={(_, v) => setMode(v)} sx={{ mb: 2 }}>
          <Tab icon={<RemoveCircle />} label="Remove" value="remove" />
          <Tab icon={<Blur />} label="Blur" value="blur" />
          <Tab icon={<Image />} label="Replace" value="replace" />
        </Tabs>
        
        {mode === 'remove' && (
          <Box>
            <Typography variant="body2" sx={{ mb: 2 }}>
              AI will remove the background completely, leaving only the subject with a transparent background.
            </Typography>
            <Chip label="U2-Net AI Model" size="small" sx={{ bgcolor: '#667eea', color: 'white' }} />
          </Box>
        )}
        
        {mode === 'blur' && (
          <Box>
            <Typography variant="body2" sx={{ mb: 2 }}>
              Blur the background while keeping the subject sharp (portrait mode effect).
            </Typography>
            <Typography variant="caption">Blur Amount: {blurAmount}px</Typography>
            <Slider
              value={blurAmount}
              onChange={(_, v) => setBlurAmount(v as number)}
              min={5}
              max={100}
              sx={{ color: '#667eea' }}
            />
          </Box>
        )}
        
        {mode === 'replace' && (
          <Box>
            <Typography variant="body2" sx={{ mb: 2 }}>
              Replace the background with a custom image.
            </Typography>
            <Button
              variant="outlined"
              component="label"
              fullWidth
              sx={{ mb: 1 }}
            >
              Choose Background Image
              <input
                type="file"
                hidden
                accept="image/*"
                onChange={(e) => setBackgroundImage(e.target.files?.[0] || null)}
              />
            </Button>
            {backgroundImage && (
              <Typography variant="caption" color="success.main">
                ✓ {backgroundImage.name}
              </Typography>
            )}
          </Box>
        )}
        
        {processMutation.isPending && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>Processing with AI...</Typography>
            <LinearProgress />
          </Box>
        )}
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={() => processMutation.mutate()}
          disabled={processMutation.isPending || (mode ==='replace' && !backgroundImage)}
        >
          Process Clip
        </Button>
      </DialogActions>
    </Dialog>
  );
}


