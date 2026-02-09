import { useTheming } from '../../utils/theming-helper';
import React, { useState, useRef, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Card as MuiCard,
  CardContent,
  Alert,
  LinearProgress,
  Grid,
  Chip,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  VideocamLibrary,
  Upload,
  AutoFixHigh,
  Download,
  PlayArrowArrow,
  Folder,
  Schedule,
  CheckCircle,
  TrendingUp as TimelineIcon,
  SmartDisplay,
  ColorLens,
  Settings,
  ExpandMore,
} from '@mui/icons-material';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
// Toast removed - Zero Toast Compliance Policy
import ResolveProjectCreator from '@/components/davinci-resolve/ResolveProjectCreator';
import { UniversalFileUpload } from '../universal/UniversalFileUpload';

interface UploadedVideo {
  id: string;
  name: string;
  size: number;
  duration: number;
  status: 'uploading' | 'processing' | 'completed';
  highlights: {
    social30: { status: 'pending' | 'processing' | 'ready'; url?: string };
    social60: { status: 'pending' | 'processing' | 'ready'; url?: string };
    extended: { status: 'pending' | 'processing' | 'ready'; url?: string };
};
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`video-tabpanel-${index}`}
      aria-labelledby={`video-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p:  3 }}>{children}</Box>}
    </div>
  );
}

export default function CreatorHubVideoSuite() {
  const [tabValue, setTabValue] = useState(0);
  
  // Theming system
  const theming = useTheming('photographer');
  const [uploadedVideos, setUploadedVideos] = useState<UploadedVideo[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showDaVinciDialog, setShowDaVinciDialog] = useState(false);

  // Toast functionality removed for Material UI compliance

  // Upload og automatisk highlight generering
  const uploadToDeliveryFolder = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('video', file);
      formData.append('folder', 'Leveranse');

      const response = await fetch('/api/video/upload-delivery', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');
      return response.json();
    },
    onSuccess: (data, file) => {
      const newVideo: UploadedVideo = {
        id: data.videoId,
        name: file.name,
        size: file.size,
        duration: 0, // Vil bli oppdatert fra server
        status: 'processing',
        highlights: {
          social30: { status: 'processing' },
          social60: { status: 'processing' },
          extended: { status: 'processing' },
        },
      };

      setUploadedVideos((prev) => [...prev, newVideo]);
      // Toast notification removed for Zero Toast Policy

      // Start automatisk highlight generering
      generateHighlights.mutate({ videoId: data.videoId, fileName: file.name });
    },
  });

  // Automatisk highlight generering
  const generateHighlights = useMutation({
    mutationFn: async ({ videoId, fileName }: { videoId: string; fileName: string }) =>
      apiRequest('/api/davinci-resolve/auto-generate-highlights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoId,
          fileName,
          highlights: [
            { type: 'social', duration: 30, name: 'Sosiale medier (30s)' },
            { type: 'social', duration: 60, name: 'Sosiale medier (60s)' },
            { type: 'extended', duration: 180, name: 'Utvidet highlight (3 min)' },
          ],
        }),
      }),
    onSuccess: (data) => {
      // Oppdater status for highlights
      setUploadedVideos((prev) =>
        prev.map((video) =>
          video.id === data.videoId
            ? {
                ...video,
                highlights: {
                  social30: { status: 'ready', url: data.highlights.social30 },
                  social60: { status: 'ready', url: data.highlights.social60 },
                  extended: { status: 'ready', url: data.highlights.extended },
                },
              }
            : video,
        ),
      );
      // Toast notification removed for Zero Toast Policy
    },
  });

  const handleFilesSelected = (files: File[]) => {
    console.log('🎬 Video filer valgt for kreativ suite:', files);
  };

  const handleUploadComplete = (results: any[]) => {
    console.log('✅ Video Suite opplasting fullført:', results);
    if (results.length > 0) {
      const result = results[0];
      const file = new File([], result.originalName || 'video.mp4');
      uploadToDeliveryFolder.mutate(file);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const formatFileSize = (bytes: number): string => {
    // Mock data removed - using database connection
    if (bytes === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${Math.round((bytes / Math.pow(1024, i)) * 100) / 100} ${sizes[i]}`;
  };

  return (
    <Box sx={{ p:  3 }}>
      <Typography variant="h4"
        sx={{ 
          mb:  3,
          fontWeight: 'bold',
          color: '#1f2930',
          display: 'flex',
          alignItems: 'center'  }}>
        <SmartDisplay sx={{ mr: 2, color: '#ff8c00', fontSize: 36}} />
        CreatorHub Video Suite
      </Typography>

      <Alert severity="info" sx={{ mb:  3 }}>
        <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
          🚀 Automatisk Highlight Generering
        </Typography>
        Når du laster opp video til Leveranse-mappen, genereres automatisk: <br />• 30 sekunder sosiale medier highlight
        <br />• 60 sekunder sosiale medier highlight
        <br />• 2-3 minutters utvidet highlight
      </Alert>

      <Paper sx={{ width: '100%' ,  ...theming.getThemedCardSx() }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          sx={{
            borderBottom:  1,
            borderColor: 'divider',
            '& .MuiTab-root': {
              color: '#666',
              '&.Mui-selected': {
                color: '#ff8c00',
                fontWeight: 'bold',
              },
            },
          }}
        >
          <Tab
            icon={theming.getThemedIcon('upload')}
            label="Leveranse Upload"
            id="video-tab-0"
            aria-controls="video-tabpanel-0"
          />
          <Tab
            icon={theming.getThemedIcon('autoFixHigh')}
            label="Automatiske Highlights"
            id="video-tab-1"
            aria-controls="video-tabpanel-1"
          />
          <Tab
            icon={theming.getThemedIcon('videoLibrary')}
            label="DaVinci Resolve"
            id="video-tab-2"
            aria-controls="video-tabpanel-2"
          />
        </Tabs>

        {/* Leveranse Upload Tab */}
        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <MuiCard
                sx={{
                  background:
                    'linear-gradient(135deg, rgba(2, 5, 5, 0.1) 0%, rgba(2, 5, 5, 0.05) 100%)',
                  border: '2px dashed rgba(25, 140, 0, 0.3)',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    border: '2px dashed rgba(25, 140, 0, 0.6)',
                    background:
                      'linear-gradient(135deg, rgba(2, 5, 5, 0.15) 0%, rgba(2, 5, 5, 0.08) 100%)',
                  },
                }}
              >
                <CardContent sx={{ textAlign: 'center', py:  4 ,  ...theming.getThemedCardSx() }}>
                  <Typography variant="h5" gutterBottom sx={{ color: theming.colors.primary }}>
                    Last opp til Leveranse-mappen
                  </Typography>
                  <Typography variant="body1" color="text.secondary" sx={{ mb:  3 }}>
                    Automatisk highlight generering starter umiddelbart
                  </Typography>
                  <UniversalFileUpload
                    onFilesSelected={handleFilesSelected}
                    onUploadComplete={handleUploadComplete}
                    allowedTypes="videos"
                    maxFiles={5}
                    maxFileSizeMB={2048}
                    enableBackgroundUpload={true}
                    maxRetries={3}
                    profession="videographer"
                    showFormatInfo={true}
                    uploadEndpoint="/api/video-editor/upload-delivery"
                  />
                </CardContent>
              </MuiCard>
            </Grid>

            <Grid item xs={12} md={6}>
              <MuiCard sx={{ height: '100%' }}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6"
                    gutterBottom
                    sx={{  display: 'flex', alignItems: 'center'  }}>
                    <Folder sx={{ mr: 1, color: '#ff8c00' }} />
                    Leveranse Mappestruktur
                  </Typography>

                  <List dense>
                    <ListItem>
                      <ListItemIcon>
                        <Folder sx={{ color: '#ff8c00' }} />
                      </ListItemIcon>
                      <ListItemText
                        primary="📁 Leveranse"
                        secondary="Hovedmappe for ferdig innhold"
                      />
                    </ListItem>
                    <ListItem sx={{ pl:  4 }}>
                      <ListItemIcon>
                        <VideoLibrary sx={{ color: '#666' }} />
                      </ListItemIcon>
                      <ListItemText primary="🎬 Full_Videos" secondary="Komplette leveranser" />
                    </ListItem>
                    <ListItem sx={{ pl:  4 }}>
                      <ListItemIcon>
                        <SmartDisplay sx={{ color: '#666' }} />
                      </ListItemIcon>
                      <ListItemText
                        primary="📱 Social_Highlights"
                        secondary="Automatisk genererte highlights"
                      />
                    </ListItem>
                    <ListItem sx={{ pl:  4 }}>
                      <ListItemIcon>
                        <TimelineIcon sx={{ color: '#666' }} />
                      </ListItemIcon>
                      <ListItemText
                        primary="🎞️ Extended_Highlights"
                        secondary="Lengre høydepunktsreel"
                      />
                    </ListItem>
                  </List>
                </CardContent>
              </MuiCard>
            </Grid>
          </Grid>

          {uploadToDeliveryFolder.isPending && (
            <Alert severity="info" sx={{ mt:  3 }}>
              <LinearProgress sx={{ mb:  1 }} />
              Laster opp til Leveranse-mappen...
            </Alert>
          )}
        </TabPanel>

        {/* Automatiske Highlights Tab */}
        <TabPanel value={tabValue} index={1}>
          {uploadedVideos.length === 0 ? (
            <Alert severity="info">
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>Ingen videoer lastet opp ennå</Typography>
              <Typography>
                Last opp en video i "Leveranse Upload" fanen for å se automatisk highlight
                generering.
              </Typography>
            </Alert>
          ) : (
            <Grid container spacing={3}>
              {uploadedVideos.map((video) => (
                <Grid item xs={12} key={video.id}>
                  <MuiCard sx={{ border: '1px solid rgba(25,140,0,0.3)' }}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} md={4}>
                          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                            {video.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Størrelse: {formatFileSize(video.size)}
                          </Typography>
                          <Chip
                            label={video.status === 'processing' ? 'Prosesserer' : 'Ferdig'}
                            color={video.status === 'completed' ? 'success' : 'warning'}
                            size="small"
                            sx={{ mt:  1 }}
                          />
                        </Grid>

                        <Grid item xs={12} md={8}>
                          <Typography variant="subtitle1" gutterBottom>
                            Automatiske Highlights: </Typography>

                          <Grid container spacing={2}>
                            <Grid item xs={12} sm={4}>
                              <MuiCard variant="outlined" sx={{ textAlign: 'center', p:  2 }}>
                                <Schedule sx={{ fontSize:  32, mb: 1, color: '#ff8c00' }} />
                                <Typography variant="body2" gutterBottom>
                                  30s Sosiale Medier
                                </Typography>
                                {video.highlights.social30.status === 'ready' ? (
                                  <Button size="small" startIcon={theming.getThemedIcon('download')}>
                                    Last ned
                                  </Button>
                                ) : (
                                  <LinearProgress sx={{ mt:  1 }} />
                                )}
                              </MuiCard>
                            </Grid>

                            <Grid item xs={12} sm={4}>
                              <MuiCard variant="outlined" sx={{ textAlign: 'center', p:  2 }}>
                                <Schedule sx={{ fontSize:  32, mb: 1, color: '#ff8c00' }} />
                                <Typography variant="body2" gutterBottom>
                                  60s Sosiale Medier
                                </Typography>
                                {video.highlights.social60.status === 'ready' ? (
                                  <Button size="small" startIcon={theming.getThemedIcon('download')}>
                                    Last ned
                                  </Button>
                                ) : (
                                  <LinearProgress sx={{ mt:  1 }} />
                                )}
                              </MuiCard>
                            </Grid>

                            <Grid item xs={12} sm={4}>
                              <MuiCard variant="outlined" sx={{ textAlign: 'center', p:  2 }}>
                                <TimelineIcon sx={{ fontSize:  32, mb: 1, color: '#ff8c00' }} />
                                <Typography variant="body2" gutterBottom>
                                  3 min Utvidet
                                </Typography>
                                {video.highlights.extended.status ==='ready' ? (
                                  <Button size="small" startIcon={theming.getThemedIcon('download')}>
                                    Last ned
                                  </Button>
                                ) : (
                                  <LinearProgress sx={{ mt:  1 }} />
                                )}
                              </MuiCard>
                            </Grid>
                          </Grid>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </MuiCard>
                </Grid>
              ))}
            </Grid>
          )}
        </TabPanel>

        {/* DaVinci Resolve Tab */}
        <TabPanel value={tabValue} index={2}>
          <Alert severity="success" sx={{ mb:  3 }}>
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              🎬 DaVinci Resolve Integration
            </Typography>
            Opprett strukturerte prosjektfiler og XML templates for profesjonell redigering.
          </Alert>

          <ResolveProjectCreator />
        </TabPanel>
      </Paper>

      {/* DaVinci Resolve Dialog */}
      <Dialog
        open={showDaVinciDialog}
        onClose={() => setShowDaVinciDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>DaVinci Resolve Prosjekt</DialogTitle>
        <DialogContent>
          <ResolveProjectCreator />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDaVinciDialog(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
