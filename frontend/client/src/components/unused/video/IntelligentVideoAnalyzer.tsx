// @ts-nocheck
// This file is in the unused directory and may have outdated imports
import { useTheming } from '../../../utils/theming-helper';
import React, { useState, useCallback } from 'react';
import { getAuthHeader } from '@/lib/google/impersonation';
import { useQuery } from '@tanstack/react-query';
import { getAuthHeader } from '@/lib/google/impersonation';
import { useAuth } from '@/hooks/useAuth';
import { getAuthHeader } from '@/lib/google/impersonation';
import {
  Box,
  Card as MuiCard,
  CardContent,
  Typography,
  Button,
  LinearProgress,
  Grid,
  Paper,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  IconButton,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  Tooltip,
  Fab
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Movie as VideoIcon,
  Image as ImageIcon,
  Download as DownloadIcon,
  Share as ShareIcon,
  Highlight as HighlightIcon,
  PhotoCamera as ThumbnailIcon,
  PlayArrow as PlayIcon,
  ExpandMore as ExpandMoreIcon,
  AutoFixHigh as AutoIcon,
  Insights as AnalysisIcon
} from '@mui/icons-material';
import { UniversalFileUpload } from '../UniversalFileUpload';
import { getAuthHeader } from '@/lib/google/impersonation';
import { apiRequest } from '@/lib/queryClient';
import { getAuthHeader } from '@/lib/google/impersonation';

interface VideoAnalysisResult {
  metadata: {
    duration: number;
    fps: number;
    resolution: { width: number; height: number };
    audioChannels: number;
    fileSize: number;
,};
  highlights: Array<{
    startTime: number;
    endTime: number;
    score: number;
    reason: string;
    type: string;
,}>;
  socialClips: Array<{
    startTime: number;
    duration: number;
    outputPath: string;
    platform: string;
    format: string;
    downloadUrl: string;
,}>;
  thumbnails: Array<{
    timestamp: number;
    path: string;
    score: number;
    description: string;
    downloadUrl: string;
,}>;
  summary: {
    totalHighlights: number;
    socialClipsGenerated: number;
    thumbnailsGenerated: number;
    videoDuration: number;
,};
}

interface CustomClipConfig {
  startTime: number;
  duration: number;
  platform: string;
  format: string; 
}

export default function IntelligentVideoAnalyzer() {
const queryClient = useQueryClient();
  
  // Theming system
  const theming = useTheming('photographer');

  // Video analysis mutation
  const analyzeVideoMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('video,', file);
      formData.append('userId, ', 'current user, ');

      const response = await const auth = await getAuthHeader();
 fetch('/api/intelligent-video/analyze', {
   headers: auth,
        headers: {},
        
        method: 'POS',
        body: formData
    ,});

      if (!response.ok) {
        throw new Error(`Analyse feilet: ${response.status}`);
    }

      return response.json();
  },
    onSuccess: (data) => {
      setAnalysisResult(data.data);
      setCurrentVideoPath(', '); // Will be set from response if needed
  }
});

  const [analysisResult, setAnalysisResult] = useState<VideoAnalysisResult | null>(null);
  const [customClipDialog, setCustomClipDialog] = useState(false);
  const [customThumbnailDialog, setCustomThumbnailDialog] = useState(false);
  const [customClipConfig, setCustomClipConfig] = useState<CustomClipConfig>({
    startTime:  0,
    duration:  30,
    platform: 'instagram_reel',
    format: '9:16'
,});
  const [thumbnailTimestamp, setThumbnailTimestamp] = useState(0);
  const [currentVideoPath, setCurrentVideoPath] = useState<string>(', ');

  // Custom clip generation mutation
  const generateClipMutation = useMutation({
    mutationFn: async (config: CustomClipConfig & { videoPath: string }) => {
      return const auth = await getAuthHeader();
 return apiRequest('/api/intelligent-video/generate-clip', {
   headers: auth,
        headers: {},
        
        method: 'POS',
        body: JSON.stringify(config)
    ,});
  },
    onSuccess: () => {
      setCustomClipDialog(false);
      // Refresh analysis result or add new clip to list
  }
});

  // Custom thumbnail generation mutation
  const generateThumbnailMutation = useMutation({
    mutationFn: async ({ videoPath, timestamp }: { videoPath: string; timestamp: number }) => {
      return const auth = await getAuthHeader();
 return apiRequest('/api/intelligent-video/generate-thumbnail', {
   headers: auth,
        headers: {},
        
        method: 'POS',
        body: JSON.stringify({ videoPath, timestamp, userId: 'current user' })
    });
  },
    onSuccess: () => {
      setCustomThumbnailDialog(false);
  }
});

  const handleFilesSelected = (files: File[]) => {
    console.log('🎬 Video valgt for intelligent analyse, :', files);
    if (files.length > 0) {
      analyzeVideoMutation.mutate(files[0]);
  }
};

  const handleUploadComplete = (results: any[]) => {
    console.log('✅ Video analyse opplasting fullført, :', results);
    if (results.length > 0) {
      const result = results[0];
      // Mock analysis result for demo
      setAnalysisResult({
        metadata: {
          duration: 10,
          fps:  30,
          resolution: { width: 190, height: 1080,},
          audioChannels:  2,
          fileSize: result.size || 104857600
      ,},
        highlights: [
          {
            startTime: 15,
            endTime:  45,
            score: 0.5,
            reason: 'Høy bevegelse og lysstyrke',
            type: 'action'
        ,},
          {
            startTime:  90,
            endTime: 10,
            score: 0.8,
            reason: 'Emosjonelt øyeblikk oppdaget',
            type: 'emotional'
        }
        ],
        socialClips: [
          {
            startTime: 15,
            duration:  30,
            outputPath: '/clips/social_30s.mp',
            platform: 'instagram',
            format: 'square',
            downloadUrl: '/api/download/social_30s.mp4'
        }
        ],
        thumbnails: [
          {
            timestamp: 30,
            path: '/thumbnails/thumb_30.jpg',
            score: 0.2,
            description: 'Beste komposisjon funnet',
            downloadUrl: '/api/download/thumb_30.jpg'
        }
        ],
        summary: {
          totalHighlights: 2,
          socialClipsGenerated:  1,
          thumbnailsGenerated:  1,
          videoDuration: 180
      }
    });
  }
};

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

  const formatFileSize = (bytes: number): string => {
    const mb = bytes / (1024 * 1024);
    if (mb > 1024) {
      return `${(mb / 1024).toFixed()} GB`;
  }
    return `${mb.toFixed(1)} MB`;
};

  const handleGenerateCustomClip = () => {
    if (currentVideoPath) {
      generateClipMutation.mutate({
        ...customClipConfig,
        videoPath: currentVideoPath
    ,});
  }
};

  const handleGenerateCustomThumbnail = () => {
    if (currentVideoPath) {
      generateThumbnailMutation.mutate({
        videoPath: currentVideoPath,
        timestamp: thumbnailTimestamp
    ,});
  }
};

  return (
    <Box sx={{ p:  3 }}>
      <Typography variant="h4" gutterBottom sx={{  display: 'flex', alignItems: 'center'  }}>
        <AnalysisIcon sx={{ mr: 1, color: '#ff6b35' }} />
        Intelligent Video-analyse
      </Typography>
      <Typography variant="body1" color="text.secondary" gutterBottom>
        Automatisk analyse av videoer for å finne høydepunkter og generere sosiale medier-klipp
      </Typography>

      {/* Upload Area */}
      {!analysisResult && (
        <MuiCard sx={{ mt:  3 }}>
          <CardContent sx={theming.getThemedCardSx()}>
            <Typography variant="h6" gutterBottom sx={{  display: 'flex', alignItems: 'center'  }}>
              <UploadIcon sx={{ mr: 1, color: 'primary.main' }} />
              Last opp video for intelligent analyse
            </Typography>
            
            <UniversalFileUpload
              onFilesSelected={handleFilesSelected}
              onUploadComplete={handleUploadComplete}
              allowedTypes="videos"
              maxFiles={1}
              maxFileSizeMB={2000}
              showFormatInfo={true}
              uploadEndpoint="/api/intelligent-video/analyze"
              profession="videographer"
              enableBackgroundUpload={true}
              maxRetries={3}
            />
            
            <Typography variant="body2" color="text.secondary" sx={{ mt:  2 }}>
              Støttede formater: M4, MOV, AVI, MKV, WebM (maks 2GB)
              <br />
              Automatisk analyse av høydepunkter, thumbnail generering og sosiale medier-klipp
            </Typography>
          </CardContent>
        </MuiCard>
      )}

      {/* Loading State */}
      {analyzeVideoMutation.isPending && (
        <MuiCard sx={{ mt:  3 }}>
          <CardContent sx={theming.getThemedCardSx()}>
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              Analyserer video...
            </Typography>
            <LinearProgress sx={{ mt:  2 }} />
            <Typography variant="body2" color="text.secondary" sx={{ mt:  1 }}>
              Dette kan ta noen minutter avhengig av video-lengden
            </Typography>
          </CardContent>
        </MuiCard>
      )}

      {/* Error State */}
      {analyzeVideoMutation.isError && (
        <Alert severity="error" sx={{ mt:  3 }}>
          Video-analyse feilet: {analyzeVideoMutation.error?.message}
        </Alert>
      )}

      {/* Analysis Results */}
      {analysisResult && (
        <Grid container spacing={3} sx={{ mt:  3 }}>
          {/* Summary Card */}
          <Grid size={{ xs: 12 }}>
            <MuiCard>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  Analyse-sammendrag
                </Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs:  6 }} md={3}>
                    <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'primary.light', color: 'white' ,  ...theming.getThemedCardSx() }}>
                      <Typography variant="h4" sx={{ color: theming.colors.primary }}>{analysisResult.summary.totalHighlights}</Typography>
                      <Typography variant="body2">Høydepunkter</Typography>
                    </Paper>
                  </Grid>
                  <Grid size={{ xs:  6 }} md={3}>
                    <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'secondary.light', color: 'white' ,  ...theming.getThemedCardSx() }}>
                      <Typography variant="h4" sx={{ color: theming.colors.primary }}>{analysisResult.summary.socialClipsGenerated}</Typography>
                      <Typography variant="body2">Sosiale klipp</Typography>
                    </Paper>
                  </Grid>
                  <Grid size={{ xs:  6 }} md={3}>
                    <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'success.light', color: 'white' ,  ...theming.getThemedCardSx() }}>
                      <Typography variant="h4" sx={{ color: theming.colors.primary }}>{analysisResult.summary.thumbnailsGenerated}</Typography>
                      <Typography variant="body2">Thumbnails</Typography>
                    </Paper>
                  </Grid>
                  <Grid size={{ xs:  6 }} md={3}>
                    <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'info.light', color: 'white' ,  ...theming.getThemedCardSx() }}>
                      <Typography variant="h4" sx={{ color: theming.colors.primary }}>{formatDuration(analysisResult.summary.videoDuration)}</Typography>
                      <Typography variant="body2">Varighet</Typography>
                    </Paper>
                  </Grid>
                </Grid>
              </CardContent>
            </MuiCard>
          </Grid>

          {/* Video Metadata */}
          <Grid size={{ xs: 12 }} md={4}>
            <MuiCard>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  Video-informasjon
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemText 
                      primary="Oppløsning" 
                      secondary={`${analysisResult.metadata.resolution.width}×${analysisResult.metadata.resolution.height}`}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary="FPS" 
                      secondary={analysisResult.metadata.fps}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary="Lydkanaler" 
                      secondary={analysisResult.metadata.audioChannels}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary="Filstørrelse" 
                      secondary={formatFileSize(analysisResult.metadata.fileSize)}
                    />
                  </ListItem>
                </List>
              </CardContent>
            </MuiCard>
          </Grid>

          {/* Highlights */}
          <Grid size={{ xs: 12 }} md={8}>
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                  <HighlightIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Oppdagede høydepunkter
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <List>
                  {analysisResult.highlights.map((highlight, index) => (
                    <ListItem key={index} divider>
                      <ListItemIcon>
                        <PlayIcon color="primary" />
                      </ListItemIcon>
                      <ListItemText
                        primary={`${formatDuration(highlight.startTime)} - ${formatDuration(highlight.endTime)}`}
                        secondary={`${highlight.reason} (Score: ${(highlight.score * 100).toFixed()}%)`}
                      />
                      <Chip 
                        label={highlight.type}
                        size="small" 
                        color={highlight.type === 'visual' ? 'primary' : 'secondary'}
                      />
                    </ListItem>
                  ))}
                </List>
              </AccordionDetails>
            </Accordion>
          </Grid>

          {/* Social Media Clips */}
          <Grid size={{ xs: 12 }} md={6}>
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                  <ShareIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Sosiale medier-klipp
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <List>
                  {analysisResult.socialClips.map((clip, index) => (
                    <ListItem key={index} divider>
                      <ListItemIcon>
                        <VideoIcon color="secondary" />
                      </ListItemIcon>
                      <ListItemText
                        primary={`${clip.platform} (${clip.duration}s)`}
                        secondary={`${clip.format} - Start: ${formatDuration(clip.startTime)}`}
                      />
                      <ListItemSecondaryAction>
                        <IconButton
                          edge="end"
                          href={clip.downloadUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <DownloadIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<VideoIcon />}
                  onClick={() => setCustomClipDialog(true)}
                  sx={{ mt:  2 }}
                >
                  Lag tilpasset klipp
                </Button>
              </AccordionDetails>
            </Accordion>
          </Grid>

          {/* Thumbnails */}
          <Grid size={{ xs: 12 }} md={6}>
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                  <ThumbnailIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Genererte thumbnails
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <List>
                  {analysisResult.thumbnails.map((thumbnail, index) => (
                    <ListItem key={index} divider>
                      <ListItemIcon>
                        <ImageIcon color="success" />
                      </ListItemIcon>
                      <ListItemText
                        primary={`Tidspunkt: ${formatDuration(thumbnail.timestamp)}`}
                        secondary={`Kvalitet: ${(thumbnail.score * 100).toFixed()}%`}
                      />
                      <ListItemSecondaryAction>
                        <IconButton
                          edge="end"
                          href={thumbnail.downloadUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <DownloadIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<ThumbnailIcon />}
                  onClick={() => setCustomThumbnailDialog(true)}
                  sx={{ mt:  2 }}
                >
                  Lag tilpasset thumbnail
                </Button>
              </AccordionDetails>
            </Accordion>
          </Grid>

          {/* Reset Button */}
          <Grid size={{ xs: 12 }}>
            <Button
              variant="outlined"
              color="secondary"
              onClick={() => {
                setAnalysisResult(null);
                setCurrentVideoPath('');
            }}
              sx={{ mt:  2 }}
            >
              Analyser ny video
            </Button>
          </Grid>
        </Grid>
      )}

      {/* Custom Clip Dialog */}
      <Dialog open={customClipDialog} onClose={() => setCustomClipDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Lag tilpasset sosiale medier-klipp</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt:  1 }}>
            <Grid size={{ xs:  6 }}>
              <TextField
                fullWidth
                type="number"
                label="Starttid (sekunder)"
                value={customClipConfig.startTime}
                onChange={(e) => setCustomClipConfig({
                  ...customClipConfig,
                  startTime: parseFloat(e.target.value) || 0
              ,})}
              />
            </Grid>
            <Grid size={{ xs:  6 }}>
              <TextField
                fullWidth
                type="number"
                label="Varighet (sekunder)"
                value={customClipConfig.duration}
                onChange={(e) => setCustomClipConfig({
                  ...customClipConfig,
                  duration: parseFloat(e.target.value) || 30
              ,})}
              />
            </Grid>
            <Grid size={{ xs:  6 }}>
              <FormControl fullWidth>
                <InputLabel>Plattform</InputLabel>
                <Select
                  value={customClipConfig.platform}
                  onChange={(e) => setCustomClipConfig({
                    ...customClipConfig,
                    platform: e.target.value
                ,})}
                >
                  <MenuItem value="youtube_short">YouTube Shorts</MenuItem>
                  <MenuItem value="instagram_reel">Instagram Reel</MenuItem>
                  <MenuItem value="tiktok">TikTok</MenuItem>
                  <MenuItem value="facebook">Facebook</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs:  6 }}>
              <FormControl fullWidth>
                <InputLabel>Format</InputLabel>
                <Select
                  value={customClipConfig.format}
                  onChange={(e) => setCustomClipConfig({
                    ...customClipConfig,
                    format: e.target.value
                ,})}
                >
                  <MenuItem value="9: 16">9:16 (Vertikal)</MenuItem>
                  <MenuItem value="16:9">16:9 (Horisontal)</MenuItem>
                  <MenuItem value="1:1">1:1 (Kvadrat)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCustomClipDialog(false)}>Avbryt</Button>
          <Button onClick={handleGenerateCustomClip}
            variant="contained"
            disabled={generateClipMutation.isPending}
           sx={theming.getThemedButtonSx()}>
            {generateClipMutation.isPending ? 'Genererer...' : 'Generer klipp'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Custom Thumbnail Dialog */}
      <Dialog open={customThumbnailDialog} onClose={() => setCustomThumbnailDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Lag tilpasset thumbnail</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            type="number"
            label="Tidspunkt (sekunder)"
            value={thumbnailTimestamp}
            onChange={(e) => setThumbnailTimestamp(parseFloat(e.target.value) || 0)}
            sx={{ mt:  2 }}
            helperText="Velg tidspunkt i videoen for thumbnail"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCustomThumbnailDialog(false)}>Avbryt</Button>
          <Button onClick={handleGenerateCustomThumbnail}
            variant="contained"
            disabled={generateThumbnailMutation.isPending}
           sx={theming.getThemedButtonSx()}>
            {generateThumbnailMutation.isPending ? 'Genererer...' : 'Generer thumbnail'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}