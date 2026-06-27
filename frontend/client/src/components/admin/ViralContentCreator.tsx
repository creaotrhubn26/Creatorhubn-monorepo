import { useTheming } from '../../utils/theming-helper';
import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  LinearProgress,
  Alert,
  Paper,
  Divider,
  Avatar,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Switch,
  FormControlLabel,
  Slider,
  Tabs,
  Tab,
} from '@mui/material';
import {
  TrendingUp,
  YouTube,
  PhotoLibrary,
  VideoLibrary as VideocamLibrary,
  Analytics,
  Schedule,
  ThumbUp,
  Share,
  Visibility,
  Edit,
  Save,
  Refresh,
  Launch,
  AutoGraph,
  Psychology,
  Palette,
  Speed as Speed,
  Star,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import { StatusChip } from './design-system';

interface ViralContentCreatorProps {
  showcase: any;
  onClose: () => void;
  onContentCreated: (content: any) => void;
}

export default function ViralContentCreator({
  showcase,
  onClose,
  onContentCreated,
}: ViralContentCreatorProps) {
  const queryClient = useQueryClient();
  const { auth } = useEnhancedMasterIntegration();

  // Theming system
  const theming = useTheming('prototype_tester');
  const [currentStep, setCurrentStep] = useState(0);
  const [viralStrategy, setViralStrategy] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedTitle, setSelectedTitle] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const [thumbnailConfig, setThumbnailConfig] = useState({
    template: 'professional',
    textOverlay: 'CREATORHU',
    colorScheme: 'warm',
    style: 'professional',
});
  const [scheduledTime, setScheduledTime] = useState('19:00');
  const [creativeToolsTab, setCreativeToolsTab] = useState(0);

  // Viral analysis mutation
  const viralAnalysisMutation = useMutation({
    mutationFn: async (showcaseData: any) => {
      setIsAnalyzing(true);
      const headers = await auth.getAuthHeader();
      return await apiRequest('/api/viral-content/analyze', {
        method: 'POST',
        headers: {
          ...headers, 'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          showcaseId: showcaseData.id,
          mediaUrl: showcaseData.mediaUrl,
          profession: showcaseData.profession,
          title: showcaseData.title,
          description: showcaseData.description,
      }),
    });
  },
    onSuccess: (data) => {
      setViralStrategy(data);
      setSelectedTitle(data.strategy.title);
      setCustomDescription(data.strategy.description);
      setCurrentStep(1);
      setIsAnalyzing(false);
},
    onError: () => {
      setIsAnalyzing(false);
},
});

  // YouTube upload mutation
  const youtubeUploadMutation = useMutation({
    mutationFn: async (uploadData: any) => {
      const headers = await auth.getAuthHeader();
      return await apiRequest('/api/youtube/upload-showcase', {
        method: 'POST',
        headers: {
          ...headers, 'Content-Type': 'application/json'
        },
        body: JSON.stringify(uploadData),
    });
  },
    onSuccess: (data) => {
      onContentCreated(data);
      queryClient.invalidateQueries({ queryKey: ['/api/youtube/analytics']});
  },
});

  // Creative tools access mutation
  const openCreativeToolMutation = useMutation({
    mutationFn: async (toolData: any) => {
      const headers = await auth.getAuthHeader();
      return await apiRequest('/api/creative-tools/launch', {
        method: 'POST',
        headers: {
          ...headers, 'Content-Type': 'application/json'
        },
        body: JSON.stringify(toolData),
    });
  },
});

  const handleAnalyzeContent = () => {
    viralAnalysisMutation.mutate(showcase);
};

  const handleCreateViralPost = async () => {
    const uploadData = {
      showcaseId: showcase.id,
      title: selectedTitle,
      description: customDescription,
      thumbnailConfig,
      scheduledTime,
      strategy: viralStrategy?.strategy,
  };

    youtubeUploadMutation.mutate(uploadData);
};

  const handleLaunchCreativeTool = (toolType: 'video' | 'photo') => {
    const toolData = {
      showcaseId: showcase.id,
      toolType,
      mediaUrl: showcase.mediaUrl,
      profession: showcase.profession,
  };

    openCreativeToolMutation.mutate(toolData);
};

  const renderAnalysisStep = () => (
    <Box>
      <Typography variant="h6" component="h2" gutterBottom sx={{  color: theming.colors.primary }}>
        🔍 Viral Innholds-Analyse
      </Typography>

      <Card
        sx={{
          ...theming.getThemedCardSx(),
          mb: 3,
          background: 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)',
        }}
      >
        <CardContent sx={theming.getThemedCardSx()}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={8} >
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>{showcase.title}</Typography>
              <Typography color="textSecondary">
                {showcase.profession} • {showcase.category}
              </Typography>
            </Grid>
            <Grid item xs={4} sx={{ textAlign: 'right'}}>
              <Button variant="contained"
                onClick={handleAnalyzeContent}
                disabled={isAnalyzing}
                sx={{
                  background: 'linear-gradient(45deg, #f57c00 30%, #ff9800 90%)',
                  minWidth: 10,
                }}
                startIcon={isAnalyzing ? <Refresh className="animate-spin" /> : <Psychology />}
              >
                {isAnalyzing ? 'Analyserer...' : 'Analyser Viral Potensial'}
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {isAnalyzing && (
        <Box sx={{ mb:  3 }}>
          <LinearProgress sx={{ mb:  1 }} />
          <Typography variant="body2" color="textSecondary">
            Analyserer innhold for viral potensial, målgruppe og optimalisering...
          </Typography>
        </Box>
      )}

      <Alert severity="info" sx={{ mb:  2 }}>
        <Typography variant="body2">
          <strong>Viral Content Creator</strong> analyserer ditt showcase-innhold og lager
          optimaliserte YouTube-strategier som kan hjelpe innholdet ditt å nå flere norske seere og
          potensielle kunder.
        </Typography>
      </Alert>
    </Box>
  );

  const renderOptimizationStep = () => (
    <Box>
      <Typography variant="h6" component="h2" gutterBottom sx={{  color: theming.colors.primary }}>
        🚀 Viral Optimalisering
      </Typography>

      {viralStrategy && (
        <Grid container spacing={3}>
          {/* Viral Potential Score */}
          <Grid item xs={12}>
            <Card sx={{ mb:  2 ,  ...theming.getThemedCardSx() }}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Grid container spacing={2}>
                  <Grid item xs={4} >
                    <Box sx={{ textAlign: 'center'}}>
                      <Typography variant="h3" color="primary" sx={{ color: theming.colors.primary }}>
                        {viralStrategy.analysis?.viralPotential || 85}%
                      </Typography>
                      <Typography color="textSecondary">Viral Potensial</Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={4} >
                    <Box sx={{ textAlign: 'center'}}>
                      <Typography variant="h3" color="success.main" sx={{ color: theming.colors.primary }}>
                        {viralStrategy.analysis?.qualityScore || 92}%
                      </Typography>
                      <Typography color="textSecondary">Kvalitet Score</Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={4} >
                    <Box sx={{ textAlign: 'center'}}>
                      <StatusChip
                        icon={<Star fontSize="small" />}
                        label={
                          viralStrategy.analysis?.qualityScore > 85
                            ? 'HØYT POTENSIAL'
                            : 'MIDDELS POTENSIAL'
                      }
                        tone={viralStrategy.analysis?.qualityScore > 85 ? 'success' : 'warning'}
                        sx={{ fontWeight: 'bold'}}
                      />
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Title Selection */}
          <Grid item xs={12}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" component="h3" gutterBottom sx={{ color: theming.colors.primary }}>
                  📝 Viral Tittel-forslag
                </Typography>
                <FormControl fullWidth sx={{ mb:  2 }}>
                  <InputLabel>Velg Viral Tittel</InputLabel>
                  <Select value={selectedTitle} onChange={(e) => setSelectedTitle(e.target.value)}>
                    {(Array.isArray(viralStrategy.strategy?.titleOptions) ? viralStrategy.strategy.titleOptions : undefined)?.map((title: string, index: number) => (
                      <MenuItem key={index} value={title}>
                        {title}
                      </MenuItem>
                    )) || [
                      <MenuItem
                        key={0}
                        value="🔥 NORSK FOTOGRAF: Premium Bryllupsfotografering - DU TRODDE IKKE DETTE VAR MULIG!"
                      >
                        🔥 NORSK FOTOGRAF: Premium Bryllupsfotografering - DU TRODDE IKKE DETTE VAR
                        MULIG!
                      </MenuItem>,
                    ]}
                  </Select>
                </FormControl>
                <TextField
                  fullWidth
                  label="Tilpass Tittel"
                  value={selectedTitle}
                  onChange={(e) => setSelectedTitle(e.target.value)}
                  multiline
                  rows={2}
                />
              </CardContent>
            </Card>
          </Grid>

          {/* Description Optimization */}
          <Grid item xs={12}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" component="h3" gutterBottom sx={{ color: theming.colors.primary }}>
                  📄 Viral Beskrivelse
                </Typography>
                <TextField
                  fullWidth
                  label="YouTube Beskrivelse"
                  value={customDescription}
                  onChange={(e) => setCustomDescription(e.target.value)}
                  multiline
                  rows={6}
                  sx={{ mb:  2 }}
                />
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap'}}>
                  {(Array.isArray(viralStrategy.strategy?.tags) ? viralStrategy.strategy.tags : []).map((tag: string, index: number) => (
                    <Chip
                      key={index}
                      label={`#${tag}`}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Creative Tools Integration */}
          <Grid item xs={12}>
            <Card
              sx={{
                ...theming.getThemedCardSx(),
                background: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)',
              }}
            >
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" component="h3" gutterBottom sx={{  color: theming.colors.primary }}>
                  🎨 Kreative Verktøy - Rask Tilgang
                </Typography>

                <Tabs
                  value={creativeToolsTab}
                  onChange={(e, newValue) => setCreativeToolsTab(newValue)}
                  aria-label="Kreative verktøy"
                  sx={{ mb:  2 }}
                >
                  <Tab icon={<VideocamLibrary />} label="Video Suite" />
                  <Tab icon={<PhotoLibrary />} label="Photo Enhancer" />
                </Tabs>

                {creativeToolsTab === 0 && (
                  <Box>
                    <Typography variant="body1" gutterBottom>
                      <strong>CreatorHub Video Suite</strong> - Profesjonell videoredigering
                    </Typography>
                    <Button variant="contained"
                      startIcon={theming.getThemedIcon('videoLibrary')}
                      onClick={() => handleLaunchCreativeTool('video')}
                      sx={{ mr: 1, mb: 1, backgroundColor: '#1976d2'}}
                    >
                      Åpne Video Suite
                    </Button>
                    <Typography variant="body2" color="textSecondary">
                      Rediger videoer, legg til effekter, og optimaliser for YouTube
                    </Typography>
                  </Box>
                )}

                {creativeToolsTab === 1 && (
                  <Box>
                    <Typography variant="body1" gutterBottom>
                      <strong>CreatorHub Photo Enhancer</strong> - Avansert bildebehandling
                    </Typography>
                    <Button variant="contained"
                      startIcon={theming.getThemedIcon('photoLibrary')}
                      onClick={() => handleLaunchCreativeTool('photo')}
                      sx={{ mr: 1, mb: 1, backgroundColor: '#1976d2'}}
                    >
                      Åpne Photo Enhancer
                    </Button>
                    <Typography variant="body2" color="textSecondary">
                      Forbedre bilder, lag thumbnails, og optimaliser for sosiale medier
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Thumbnail Configuration */}
          <Grid item xs={12}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" component="h3" gutterBottom sx={{ color: theming.colors.primary }}>
                  🖼️ Thumbnail Optimalisering
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6} >
                    <FormControl fullWidth>
                      <InputLabel>Template</InputLabel>
                      <Select
                        value={thumbnailConfig.template}
                        onChange={(e) =>
                          setThumbnailConfig({
                            ...thumbnailConfig,
                            template: e.target.value,
                        })
                      }
                      >
                        <MenuItem value="professional">Profesjonell</MenuItem>
                        <MenuItem value="clickbait">Clickbait</MenuItem>
                        <MenuItem value="artistic">Artistisk</MenuItem>
                        <MenuItem value="minimal">Minimal</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={6} >
                    <TextField
                      fullWidth
                      label="Tekst Overlay"
                      value={thumbnailConfig.textOverlay}
                      onChange={(e) =>
                        setThumbnailConfig({
                          ...thumbnailConfig,
                          textOverlay: e.target.value,
                      })
                    }
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Scheduling */}
          <Grid item xs={12}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" component="h3" gutterBottom sx={{ color: theming.colors.primary }}>
                  ⏰ Optimal Publiseringstid
                </Typography>
                <TextField
                  type="time"
                  label="Publiseringstid"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ mr:  2 }}
                />
                <StatusChip
                  icon={<Schedule fontSize="small" />}
                  label="Optimal for norske seere: 19:00-21:00"
                  tone="info"
                />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
     )}
    </Box>
  );

  const renderPublishStep = () => (
    <Box>
      <Typography variant="h6" component="h2" gutterBottom sx={{  color: theming.colors.primary }}>
        🎯 Publiser Viral Innhold
      </Typography>

      <Alert severity="success" sx={{ mb:  3 }}>
        <Typography variant="body1">
          <strong>Klar for publisering!</strong> Ditt innhold er optimalisert for maksimal viral
          spredning på YouTube.
        </Typography>
      </Alert>

      <Card sx={{ mb:  3 ,  ...theming.getThemedCardSx() }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Typography variant="h6" component="h3" gutterBottom sx={{ color: theming.colors.primary }}>
            📊 Forventet Ytelse
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={3} >
              <Box sx={{ textAlign: 'center'}}>
                <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                  2.5K
                </Typography>
                <Typography color="textSecondary">Forventede visninger</Typography>
              </Box>
            </Grid>
            <Grid item xs={3} >
              <Box sx={{ textAlign: 'center'}}>
                <Typography variant="h4" color="success.main" sx={{ color: theming.colors.primary }}>
                  15%
                </Typography>
                <Typography color="textSecondary">Engagement rate</Typography>
              </Box>
            </Grid>
            <Grid item xs={3} >
              <Box sx={{ textAlign: 'center'}}>
                <Typography variant="h4" color="warning.main" sx={{ color: theming.colors.primary }}>
                  85%
                </Typography>
                <Typography color="textSecondary">Viral score</Typography>
              </Box>
            </Grid>
            <Grid item xs={3} >
              <Box sx={{ textAlign: 'center'}}>
                <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                  12
                </Typography>
                <Typography color="textSecondary">Nye leads</Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Button variant="contained"
        size="large"
        onClick={handleCreateViralPost}
        disabled={youtubeUploadMutation.isPending}
        sx={{
          background: 'linear-gradient(45deg, #f57c00 30%, #ff9800 90%)',
          minWidth: 20,
          height:  50}}
        startIcon={<YouTube />}
      >
        {youtubeUploadMutation.isPending ? 'Publiserer...' : 'Publiser til YouTube'}
      </Button>
    </Box>
  );

  const steps = ['Analyser Innhold','Optimaliser for Viral Spredning', 'Publiser til YouTube'];

  return (
    <Dialog
      open={true}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          background: 'linear-gradient(135deg, #fafafa 0%, #f5f5f5 100%)',
      }}}
    >
      <DialogTitle
        sx={{
          background: 'linear-gradient(45deg, #f57c00 30%, #ff9800 90%)',
          color: 'white',
          textAlign: 'center'}}
      >
        <TrendingUp sx={{ mr: 1, verticalAlign: 'middle'}} />
        Viral Content Creator
      </DialogTitle>

      <DialogContent sx={{ p:  3 }}>
        {/* Progress indicator */}
        <Box sx={{ mb:  3 }}>
          <Typography variant="body2" color="textSecondary" gutterBottom>
            Steg {currentStep + 1} av {steps.length}: {steps[currentStep]}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={(currentStep / (steps.length - 1)) * 100}
            sx={{ height:  6, borderRadius:  3 }}
          />
        </Box>

        {currentStep === 0 && renderAnalysisStep()}
        {currentStep === 1 && renderOptimizationStep()}
        {currentStep === 2 && renderPublishStep()}
      </DialogContent>

      <DialogActions sx={{ p:  3, pt:  0 }}>
        <Button onClick={onClose} color="inherit">
          Avbryt
        </Button>
        {currentStep > 0 && (
          <Button onClick={() => setCurrentStep(currentStep - 1)} color="primary">
            Tilbake
          </Button>
        )}
        {currentStep < steps.length - 1 && viralStrategy && (
          <Button
            onClick={() => setCurrentStep(currentStep + 1)}
            variant="contained"
            color="primary"
          >
            Neste
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
