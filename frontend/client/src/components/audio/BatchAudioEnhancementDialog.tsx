/**
 * BATCH AUDIO ENHANCEMENT DIALOG
 * Process multiple audio files at once with preset selection
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  LinearProgress,
  Stack,
  Card,
  CardContent,
  IconButton,
  Chip,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Tooltip,
} from '@mui/material';
import {
  AudioFile,
  CheckCircle,
  Error,
  Pending,
  Close,
  AutoFixHigh,
  Delete,
} from '@mui/icons-material';

interface BatchAudioEnhancementDialogProps {
  open: boolean;
  onClose: () => void;
  audioFiles: File[];
  onBatchComplete: (results: BatchResult[]) => void;
  defaultPreset?: string;
}

interface BatchResult {
  file: File;
  status: 'pending' | 'processing' | 'success' | 'error';
  enhancedUrl?: string;
  metrics?: any;
  error?: string;
}

const PRESETS = [
  { value: 'auto', label: 'Auto-detect', description: 'Automatically detect best preset' },
  { value: 'podcast', label: 'Podcast', description: '-16 LUFS (Apple Music, Spotify)' },
  { value: 'youtube', label: 'YouTube', description: '-14 LUFS (YouTube, TikTok)' },
  { value: 'music', label: 'Music', description: '-14 LUFS (Spotify, Apple Music)' },
  { value: 'audiobook', label: 'Audiobook', description: '-18 LUFS (Audible, ACX)' },
  { value: 'radio', label: 'Radio', description: '-16 LUFS (Radio broadcast)' },
  { value: 'broadcast', label: 'TV/Broadcast', description: '-23 LUFS (EBU R128)' },
  { value: 'tiktok', label: 'TikTok/Reels', description: '-14 LUFS (Social media)' },
  { value: 'twitch', label: 'Twitch', description: '-14 LUFS (Streaming)' },
  { value: 'discord', label: 'Discord', description: '-16 LUFS (Voice chat)' },
];

const BRAND_COLORS = {
  orange: '#ff8c00',
  purple: '#9333ea',
  green: '#16a34a',
  dark: '#1a1a1a',
};

export default function BatchAudioEnhancementDialog({
  open,
  onClose,
  audioFiles,
  onBatchComplete,
  defaultPreset = 'auto'
}: BatchAudioEnhancementDialogProps) {
  const [preset, setPreset] = useState(defaultPreset);
  const [results, setResults] = useState<BatchResult[]>([]);
  const [processing, setProcessing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Initialize results when files change
  useEffect(() => {
    if (audioFiles.length > 0) {
      setResults(audioFiles.map(file => ({
        file,
        status: 'pending'
      })));
    }
  }, [audioFiles]);

  const startBatchProcessing = async () => {
    setProcessing(true);
    setCurrentIndex(0);

    for (let i = 0; i < audioFiles.length; i++) {
      setCurrentIndex(i);
      
      // Update status to processing
      setResults(prev => prev.map((r, idx) => 
        idx === i ? { ...r, status: 'processing' } : r
      ));

      try {
        const formData = new FormData();
        formData.append('file', audioFiles[i]);
        formData.append('preset', preset);
        formData.append('autoDetect', 'true');

        const response = await fetch('/api/audio-enhancement/auto-enhance', {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          throw new Error('Enhancement failed');
        }

        const data = await response.json();

        // Update status to success
        setResults(prev => prev.map((r, idx) => 
          idx === i ? {
            ...r,
            status: 'success',
            enhancedUrl: data.enhancedUrl,
            metrics: data.metrics
          } : r
        ));
      } catch (error: any) {
        // Update status to error
        setResults(prev => prev.map((r, idx) => 
          idx === i ? {
            ...r,
            status: 'error',
            error: error.message || 'Enhancement failed'
          } : r
        ));
      }
    }

    setProcessing(false);
  };

  const handleComplete = () => {
    onBatchComplete(results);
    onClose();
  };

  const handleRemoveFile = (index: number) => {
    setResults(prev => prev.filter((_, idx) => idx !== index));
  };

  const successCount = results.filter(r => r.status === 'success').length;
  const errorCount = results.filter(r => r.status === 'error').length;
  const progress = results.length > 0 ? (currentIndex / results.length) * 100 : 0;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ 
        background: `linear-gradient(135deg, ${BRAND_COLORS.orange} 0%, ${BRAND_COLORS.purple} 100%)`,
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AutoFixHigh />
          <Typography variant="h6">Batch Audio Enhancement</Typography>
        </Box>
        <IconButton onClick={onClose} sx={{ color: 'white' }}>
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ mt: 2 }}>
        <Stack spacing={3}>
          {/* Preset Selector */}
          <FormControl fullWidth disabled={processing}>
            <InputLabel>Preset</InputLabel>
            <Select
              value={preset}
              onChange={(e) => setPreset(e.target.value)}
              label="Preset"
            >
              {PRESETS.map(p => (
                <MenuItem key={p.value} value={p.value}>
                  <Box>
                    <Typography variant="body1">{p.label}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {p.description}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Progress */}
          {processing && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2">
                  Processing {currentIndex + 1} of {results.length}...
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {Math.round(progress)}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={progress}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: 'rgba(147, 51, 234, 0.1)', '& .MuiLinearProgress-bar': {
                    background: `linear-gradient(90deg, ${BRAND_COLORS.orange} 0%, ${BRAND_COLORS.purple} 100%)`,
                    borderRadius: 4,
                  }
                }}
              />
            </Box>
          )}

          {/* Summary */}
          {!processing && results.length > 0 && (
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Chip
                icon={<CheckCircle />}
                label={`${successCount} Success`}
                color="success"
                variant="outlined"
              />
              {errorCount > 0 && (
                <Chip
                  icon={<Error />}
                  label={`${errorCount} Failed`}
                  color="error"
                  variant="outlined"
                />
              )}
              <Chip
                icon={<Pending />}
                label={`${results.filter(r => r.status === 'pending').length} Pending`}
                variant="outlined"
              />
            </Box>
          )}

          {/* File List */}
          <Card variant="outlined">
            <List sx={{ maxHeight: 400, overflow: 'auto' }}>
              {results.map((result, index) => (
                <React.Fragment key={index}>
                  <ListItem
                    secondaryAction={
                      !processing && result.status === 'pending' && (
                        <IconButton
                          edge="end"
                          onClick={() => handleRemoveFile(index)}
                          size="small"
                        >
                          <Delete />
                        </IconButton>
                      )
                    }
                  >
                    <ListItemIcon>
                      {result.status === 'pending' && <Pending color="disabled" />}
                      {result.status === 'processing' && <AutoFixHigh color="primary" />}
                      {result.status === 'success' && <CheckCircle color="success" />}
                      {result.status === 'error' && <Error color="error" />}
                    </ListItemIcon>
                    <ListItemText
                      primary={result.file.name}
                      secondary={
                        result.status === 'success'
                          ? `Enhanced: ${result.metrics?.loudness?.standard} (${result.metrics?.loudness?.final_lufs?.toFixed(1)} LUFS)`
                          : result.status === 'error'
                          ? result.error
                          : result.status === 'processing'
                          ? 'Processing...'
                          : `${(result.file.size / 1024 / 1024).toFixed(2)} MB`
                      }
                      secondaryTypographyProps={{
                        color: result.status === 'error' ? 'error' : 'text.secondary'
                      }}
                    />
                  </ListItem>
                  {index < results.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          </Card>

          {/* Info Alert */}
          {!processing && results.length > 0 && (
            <Alert severity="info" icon={<AutoFixHigh />}>
              <Typography variant="body2">
                <strong>Batch processing</strong> will enhance all files with the selected preset.
                Processing time: ~1 second per file.
              </Typography>
            </Alert>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={processing}>
          Avbryt
        </Button>
        {!processing && successCount === 0 && (
          <Button
            variant="contained"
            onClick={startBatchProcessing}
            disabled={results.length === 0}
            sx={{
              background: `linear-gradient(135deg, ${BRAND_COLORS.orange} 0%, ${BRAND_COLORS.purple} 100%)`, '&:hover': {
                background: `linear-gradient(135deg, ${BRAND_COLORS.orange} 20%, ${BRAND_COLORS.purple} 120%)`,
              }
            }}
          >
            Start Enhancement
          </Button>
        )}
        {!processing && successCount > 0 && (
          <Button
            variant="contained"
            onClick={handleComplete}
            color="success"
          >
            Add {successCount} to Timeline
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

