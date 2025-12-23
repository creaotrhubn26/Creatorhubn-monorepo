/**
 * BEAT SYNC PANEL
 * Auto-sync clips to music beats
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
  LinearProgress,
  Chip,
  IconButton,
  Alert,
  List,
  ListItem,
  ListItemText
} from '@mui/material';
import { Close, MusicNote } from '@mui/icons-material';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface BeatSyncPanelProps {
  open: boolean;
  onClose: () => void;
  audioPath: string;
  clips: any[];
  onClipsSnapped: (snappedClips: any[]) => void;
}

export default function BeatSyncPanel({
  open,
  onClose,
  audioPath,
  clips,
  onClipsSnapped
}: BeatSyncPanelProps) {
  const [beatAnalysis, setBeatAnalysis] = useState<any>(null);
  
  const detectMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/capcut-features/beat-detection', {
        method: 'POST',
        body: JSON.stringify({ videoPath: audioPath })
      });
    },
    onSuccess: (data) => {
      setBeatAnalysis(data);
    }
  });
  
  const snapMutation = useMutation({
    mutationFn: async () => {
      if (!beatAnalysis) return;
      
      const clipPositions = clips.map(c => c.start);
      
      return await apiRequest('/api/capcut-features/snap-to-beat', {
        method: 'POST',
        body: JSON.stringify({
          clipPositions,
          beats: beatAnalysis.beats
        })
      });
    },
    onSuccess: (data) => {
      // Update clip positions
      const snappedClips = clips.map((clip, index) => ({
        ...clip,
        start: data.snapped[index]
      }));
      
      onClipsSnapped(snappedClips);
      onClose();
    }
  });
  
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
        <Stack direction="row" justifyContent="space-between">
          <Box>
            <Typography variant="h6">Beat Sync</Typography>
            <Typography variant="caption" sx={{ opacity: 0.9 }}>Auto-sync clips to music</Typography>
          </Box>
          <IconButton onClick={onClose} sx={{ color: 'white' }}>
            <Close />
          </IconButton>
        </Stack>
      </DialogTitle>
      
      <DialogContent>
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            Automatically detect beats and snap your clips to the music rhythm.
          </Typography>
        </Alert>
        
        {!beatAnalysis ? (
          <Box>
            <Button
              fullWidth
              variant="contained"
              onClick={() => detectMutation.mutate()}
              disabled={detectMutation.isPending}
              startIcon={<MusicNote />}
              sx={{ mb: 2 }}
            >
              {detectMutation.isPending ? 'Detecting Beats...' : 'Detect Beats'}
            </Button>
            
            {detectMutation.isPending && <LinearProgress />}
          </Box>
        ) : (
          <Box>
            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
              <Chip label={`${beatAnalysis.beatCount} beats`} color="primary" />
              <Chip label={`${beatAnalysis.bpm} BPM`} />
              <Chip label={beatAnalysis.timeSignature} />
            </Stack>
            
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Beat Timeline</Typography>
            <Box sx={{ maxHeight: 200, overflow: 'auto', bgcolor: '#F5F5F5', p: 1, borderRadius: 1, mb: 2 }}>
              <List dense>
                {beatAnalysis.beats.slice(0, 20).map((beat: any, index: number) => (
                  <ListItem key={index}>
                    <ListItemText
                      primary={`Beat ${index + 1}`}
                      secondary={`${beat.time.toFixed(2)}s - ${beat.type}`}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
            
            <Button
              fullWidth
              variant="contained"
              onClick={() => snapMutation.mutate()}
              disabled={snapMutation.isPending}
            >
              {snapMutation.isPending ?'Snapping to Beats...' : `Snap ${clips.length} Clips to Beats`}
            </Button>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}


