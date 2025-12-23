import { useTheming } from '../../utils/theming-helper';
import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Stepper,
  Step,
  StepLabel,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Videocamcam,
  Movie,
  Edit,
  AutoAwesome,
  CloudUpload,
  TrendingUp as TimelineIcon,
  ColorLens,
  VolumeUpUp,
  Subtitles,
  Download,
  Share,
  Analytics,
  Speed,
} from '@mui/icons-material';

interface VideoProject {
  id: string;
  name: string;
  duration: string;
  status: 'editing' | 'rendering' | 'completed';
  progress: number
}

interface StoryArcTemplate {
  id: string;
  name: string;
  description: string;
  duration: string;
  scenes: number
}

const VideoProductionTools: React.FC = () => {
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [storyArcDialog, setStoryArcDialog] = useState(false);
  
  // Theming system
  const theming = useTheming('photographer');
  const [generatingStoryArc, setGeneratingStoryArc] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectType, setProjectType] = useState('');

  const videoProjects: VideoProject[] = [
    {
      id: '',
      name: 'Bryllupsfilm - Emma & Lars',
      duration: '12:4',
      status: 'editing',
      progress:  65,
  },
    {
      id: '',
      name: 'Produktvideo - Teknologi A',
      duration: '3:3',
      status: 'completed',
      progress: 10,
  },
    {
      id: '',
      name: 'Eventvideo - Konferanse 202',
      duration: '8:2',
      status: 'rendering',
      progress:  45,
  },
  ];

  const storyArcTemplates: StoryArcTemplate[] = [
    {
      id: 'wedding-classic',
      name: 'Klassisk Bryllup',
      description: 'Tradisjonell bryllupshistorie med forberedelser, seremoni og fest',
      duration: '10-15 min',
      scenes:  8,
  },
    {
      id: 'wedding-cinematic',
      name: 'Kinematisk Bryllup',
      description: 'Dramatisk og emosjonell storytelling med artistiske overganger',
      duration: '8-12 min',
      scenes:  6,
  },
    {
      id: 'corporate-intro',
      name: 'Bedriftspresentasjon',
      description: 'Profesjonell introduksjon av bedrift, team og verdier',
      duration: '3-5 min',
      scenes:  5,
  },
    {
      id: 'product-showcase',
      name: 'Produktvisning',
      description: 'Detaljert presentasjon av produkt med fokus på fordeler',
      duration: '2-4 min',
      scenes:  4,
  },
    {
      id: 'event-highlight',
      name: 'Event Høydepunkter',
      description: 'Sammendrag av konferanse eller event med nøkkelmomenter',
      duration: '5-8 min',
      scenes:  6,
  },
  ];

  const productionTools = [
    {
      id: 'video-editor',
      name: 'Video Editor',
      description: 'Avansert videoredigering med støtte for 4K og HD',
      icon: Edit,
      features: ['Multi-track editing','Color grading','Audio mixing','Effects library'],
  },
    {
      id: 'story-arc-generator',
      name: 'Story Arc Generator',
      description: 'Intelligent generering av videostruktur og storyboard',
      icon: AutoAwesome,
      features: ['Template library','Scene planning', 'Timing optimization','Music sync'],
  },
    {
      id: 'auto-highlight',
      name: 'Auto Highlight Generator',
      description: 'Automatisk identifikasjon av beste øyeblikk',
      icon: Analytics,
      features: ['Face detection', 'Motion analysis', 'Audio cues','Smart selection'],
  },
    {
      id: 'color-grading',
      name: 'Color Grading Suite',
      description: 'Profesjonell fargekorrigering og grading',
      icon: ColorLens,
      features: ['LUT support', 'Color wheels','Scopes','HDR workflow'],
  },
  ];

  const handleGenerateStoryArc = () => {
    setGeneratingStoryArc(true);
    setTimeout(() => {
      setGeneratingStoryArc(false);
      setStoryArcDialog(false);
  }, 4000);
};

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'editing':
        return 'info';
      case 'rendering':
        return 'warning';
      default:
        return 'default';
}
};

  return (
    <Box sx={{ p:  3 }}>
      <Typography variant="h4" sx={{  mb:  3, display: 'flex', alignItems: 'center', gap:  1  }}>
        {theming.getThemedIcon('videocam')}
        Video Production Tools
      </Typography>

      <Grid container spacing={3}>
        {/* Active Projects */}
        <Grid item xs={12}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6"
                sx={{  mb: 2, display: 'flex', alignItems: 'center', gap:  1  }}>
                <Movie />
                Aktive Videoprosjekter
              </Typography>

              <Grid container spacing={2}>
                {videoProjects.map((project) => (
                  <Grid item xs={12} md={4} key={project.id}>
                    <Card variant="outlined" sx={theming.getThemedCardSx()}>
                      <CardContent sx={theming.getThemedCardSx()}>
                        <Typography variant="subtitle1">{project.name}</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb:  1 }}>
                          Varighet: {project.duration}
                        </Typography>

                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            mb:  1}}
                        >
                          <Chip
                            label={project.status}
                            color={getStatusColor(project.status)}
                            size="small"
                          />
                          <Typography variant="body2">{project.progress}%</Typography>
                        </Box>

                        <LinearProgress
                          variant="determinate"
                          value={project.progress}
                          sx={{ mb:  2 }}
                        />

                        <Box sx={{ display: 'flex', gap:  1 }}>
                          <Button size="small" variant="outlined">
                            Åpne
                          </Button>
                          {project.status === 'completed' && (
                            <Button size="small" startIcon={theming.getThemedIcon('download')}>
                              Last ned
                            </Button>
                          )}
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Production Tools */}
        <Grid item xs={12}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6"
                sx={{  mb: 2, display: 'flex', alignItems: 'center', gap:  1  }}>
                {theming.getThemedIcon('edit')}
                Produksjonsverktøy
              </Typography>

              <Grid container spacing={2}>
                {productionTools.map((tool) => (
                  <Grid item xs={12} sm={6} md={3} key={tool.id}>
                    <Card
                      variant="outlined"
                      sx={{
                        cursor: 'pointer','&:hover': { boxShadow:  2 }}}
                      onClick={() => {
                        if (tool.id === 'story-arc-generator') {
                          setStoryArcDialog(true);
                      } else {
                          setSelectedTool(tool.id);
                      }
                    }}
                    >
                      <CardContent sx={theming.getThemedCardSx()}>
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap:  1,
                            mb:  1}}
                        >
                          <tool.icon />
                          <Typography variant="subtitle1">{tool.name}</Typography>
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                          {tool.description}
                        </Typography>
                        <List dense>
                          {tool.features.slice(0, 2).map((feature, index) => (
                            <ListItem key={index} sx={{ px:  0 }}>
                              <Typography variant="caption">• {feature}</Typography>
                            </ListItem>
                          ))}
                        </List>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Quick Actions */}
        <Grid item xs={12} md={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6"
                sx={{  mb: 2, display: 'flex', alignItems: 'center', gap:  1  }}>
                {theming.getThemedIcon('speed')}
                Hurtighandlinger
              </Typography>

              <List>
                <ListItem>
                  <ListItemIcon>
                    {theming.getThemedIcon('cloudUpload')}
                  </ListItemIcon>
                  <ListItemText primary="Last opp nye klipp" secondary="Drag og slipp videofiler" />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <Box />
                  </ListItemIcon>
                  <ListItemText
                    primary="Opprett nytt prosjekt"
                    secondary="Start fra mal eller blank"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    {theming.getThemedIcon('share')}
                  </ListItemIcon>
                  <ListItemText
                    primary="Del for gjennomgang"
                    secondary="Send til kunde for feedback"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    {theming.getThemedIcon('analytics')}
                  </ListItemIcon>
                  <ListItemText primary="Analyser ytelse" secondary="Se statistikk og metrics" />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* System Status */}
        <Grid item xs={12} md={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" sx={{  mb:  2  }}>
                System Status
              </Typography>

              <Alert severity="success" sx={{ mb:  2 }}>
                Video production studio er operativ og klar for bruk
              </Alert>

              <List dense>
                <ListItem>
                  <ListItemText
                    primary="Rendering Engine"
                    secondary="NVIDIA CUDA akselerasjon aktivert"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText primary="Storage" secondary="2.4TB ledig av 5TB total kapasitet" />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Export Formater"
                    secondary="4K, HD, Web-optimalisert, og sosiale medier"
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Story Arc Generator Dialog */}
      <Dialog
        open={storyArcDialog}
        onClose={() => setStoryArcDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Intelligent Story Arc Generator</DialogTitle>
        <DialogContent>
          {generatingStoryArc ? (
            <Box sx={{ textAlign: 'center', py:  4 }}>
              <LinearProgress sx={{ mb:  2 }} />
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>Genererer story arc...</Typography>
              <Typography variant="body2" color="text.secondary">
                Analyserer innhold og oppretter optimal videosturktur
              </Typography>
            </Box>
          ) : (
            <>
              <Grid container spacing={2} sx={{ mb:  3 }}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Prosjektnavn"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Prosjekttype</InputLabel>
                    <Select value={projectType} onChange={(e) => setProjectType(e.target.value)}>
                      <MenuItem value="wedding">Bryllup</MenuItem>
                      <MenuItem value="corporate">Bedriftsvideo</MenuItem>
                      <MenuItem value="event">Event</MenuItem>
                      <MenuItem value="product">Produkt</MenuItem>
                      <MenuItem value="custom">Tilpasset</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>

              <Typography variant="h6" sx={{  mb:  2  }}>
                Velg story arc mal: </Typography>

              <Grid container spacing={2}>
                {storyArcTemplates.map((template) => (
                  <Grid item xs={12} sm={6} key={template.id}>
                    <Card
                      variant="outlined"
                      sx={{
                        cursor: 'pointer', '&:hover': { boxShadow:  2 }}}
                     sx={theming.getThemedCardSx()}>
                      <CardContent sx={theming.getThemedCardSx()}>
                        <Typography variant="subtitle1">{template.name}</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb:  1 }}>
                          {template.description}
                        </Typography>
                        <Box sx={{ display: 'flex', gap:  1 }}>
                          <Chip label={template.duration} size="small" />
                          <Chip label={`${template.scenes} scener`} size="small" />
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStoryArcDialog(false)} disabled={generatingStoryArc}>
            Avbryt
          </Button>
          <Button onClick={handleGenerateStoryArc}
            variant="contained"
            disabled={generatingStoryArc}
           sx={theming.getThemedButtonSx()}>
            Generer Story Arc
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default VideoProductionTools;
