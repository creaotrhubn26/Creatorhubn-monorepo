/**
 * AUTO-CAPTIONS PANEL
 * OpenAI Whisper auto-caption generation
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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Stack,
  LinearProgress,
  Chip,
  IconButton,
  Alert,
} from '@mui/material';
import { Close, Subtitles } from '@mui/icons-material';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
// AutoCaptionService - calls backend API
const AutoCaptionService = {
  generateCaptions: async (videoPath: string, language: string) => {
    const response = await fetch('/api/video/generate-captions', {
      method: 'POST',
      headers: { 'Content-Type' : 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ videoPath, language }),
    });
    if (!response.ok) throw new Error('Failed to generate captions');
    return response.json();
  }
};

interface AutoCaptionsPanelProps {
  open: boolean;
  onClose: () => void;
  videoPath: string;
  onCaptionsGenerated: (captions: any[], srt: string, vtt: string) => void;
}

export default function AutoCaptionsPanel({
  open,
  onClose,
  videoPath,
  onCaptionsGenerated
}: AutoCaptionsPanelProps) {
  const [language, setLanguage] = useState('en');
  const [style, setStyle] = useState('modern');
  
  const languages = [
    { code: 'en', name: 'English' },
    { code: 'no', name: 'Norwegian' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'it', name: 'Italian' },
    { code: 'zh', name: 'Chinese' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ko', name: 'Korean' },
    { code: 'ar', name: 'Arabic' },
    { code: 'hi', name: 'Hindi' }
  ];
  
  const styles = ['modern','minimal', 'bold', 'elegant'];
  
  const generateMutation = useMutation({
    mutationFn: async () => {
      // Try new Whisper API first, fallback to CapCut API
      try {
        const response = await apiRequest('/api/video-analysis/transcribe', {
          method: 'POST',
          body: JSON.stringify({ 
            video_path: videoPath, 
            language: language === 'auto' ? null : language,
            model_size: 'base',
            word_timestamps: true,
          })
        });
        
        if (response.success && response.job_id) {
          // Poll for results
          return new Promise((resolve, reject) => {
            const pollInterval = setInterval(async () => {
              try {
                const statusResponse = await apiRequest(`/api/video-analysis/transcribe/${response.job_id}`);
                
                if (statusResponse.status === 'completed') {
                  clearInterval(pollInterval);
                  const transcription = statusResponse.result?.transcription;
                  
                  // Convert Whisper format to caption format
                  const captions = transcription.segments.map((seg: any, idx: number) => ({
                    id: idx + 1,
                    start: seg.start,
                    end: seg.end,
                    text: seg.text,
                    confidence: 1.0,
                  }));
                  
                  resolve({
                    captions,
                    formats: {
                      srt: AutoCaptionService.exportToSRT(captions),
                      vtt: AutoCaptionService.exportToVTT(captions),
                    },
                    language: transcription.language || language,
                  });
                } else if (statusResponse.status === 'failed') {
                  clearInterval(pollInterval);
                  reject(new Error(statusResponse.error || 'Transcription failed'));
                }
              } catch (error: any) {
                clearInterval(pollInterval);
                reject(error);
              }
            }, 2000);
          });
        }
      } catch (error) {
        // Fallback to CapCut API
        console.log('Whisper API not available, using CapCut API');
      }
      
      // Fallback to original CapCut API
      return await apiRequest('/api/capcut-features/auto-captions', {
        method: 'POST',
        body: JSON.stringify({ videoPath, language })
      });
    },
    onSuccess: (data) => {
      onCaptionsGenerated(data.captions, data.formats.srt, data.formats.vtt);
      onClose();
    }
  });
  
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
        <Stack direction="row" justifyContent="space-between">
          <Box>
            <Typography variant="h6">Auto-Captions</Typography>
            <Typography variant="caption" sx={{ opacity: 0.9 }}>OpenAI Whisper - 80+ languages</Typography>
          </Box>
          <IconButton onClick={onClose} sx={{ color: 'white' }}>
            <Close />
          </IconButton>
        </Stack>
      </DialogTitle>
      
      <DialogContent>
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            AI will transcribe your video and generate word-level captions automatically.
          </Typography>
        </Alert>
        
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>Language</InputLabel>
          <Select value={language} onChange={(e) => setLanguage(e.target.value)} label="Language">
            {languages.map((lang) => (
              <MenuItem key={lang.code} value={lang.code}>{lang.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
        
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>Style</InputLabel>
          <Select value={style} onChange={(e) => setStyle(e.target.value)} label="Style">
            {styles.map((s) => (
              <MenuItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</MenuItem>
            ))}
          </Select>
        </FormControl>
        
        {generateMutation.isPending && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>Generating captions...</Typography>
            <LinearProgress />
          </Box>
        )}
        
        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
          <Chip label="Word-level timestamps" size="small" />
          <Chip label="SRT/VTT export" size="small" />
        </Stack>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          variant="contained" 
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          startIcon={<Subtitles />}
        >
          Generate Captions
        </Button>
      </DialogActions>
    </Dialog>
  );
}


