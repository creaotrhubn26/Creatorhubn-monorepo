import { useTheming } from '../utils/theming-helper';
import React, { useState, useCallback, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Box, 
  Typography, 
  Button, 
  Card as MuiCard, 
  CardContent, 
  CardHeader,
  LinearProgress,
  Grid,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Paper,
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import { 
  CloudUpload, 
  VideoFile, 
  Settings, 
  PlayArrow, 
  GetApp, 
  Timeline, 
  Movie,
  Edit,
  ExpandMore,
  Info,
  TrendingUp,
  AccessTime,
  People,
  PhotoCamera
} from '@mui/icons-material';

interface VideoFile {
  id: string;
  name: string;
  size: number;
  duration: number;
  resolution: string;
  format: string;
  url: string
}

interface ProjectType {
  id: string;
  name: string;
  description: string;
  icon: string;
  targetDuration: number;
  features: string[]
}

interface StorySegment {
  id: string;
  title: string;
  description: string;
  startTime: number;
  endTime: number;
  intensity: number;
  clipRecommendations: string[];
  transitionType: string;
  musicMood: string
}

interface StoryArc {
  id: string;
  title: string;
  totalDuration: number;
  segments: StorySegment[];
  musicRecommendations: string[];
  colorGrading: string;
  pacing: 'slow' | 'medium' | 'fast';
  emotionalJourney: string[]
}

interface StoryArcGeneratorProps {
  // Integration props
  onMeetingCreate?: (meeting: any) => void;
  onProjectUpdate?: (project: any) => void;
  onWorklogCreate?: (worklog: any) => void;
  selectedProject?: any;
  onProjectSelect?: (project: any) => void;
  userId?: string
}

export default function StoryArcGenerator({
  onMeetingCreate,
  onProjectUpdate,
  onWorklogCreate,
  selectedProject,
  onProjectSelect,
  userId
}: StoryArcGeneratorProps = {}) {
  
  // Theming system
  const theming = useTheming('photographer, ');
  const queryClient = useQueryClient();
  
  // Database connection for StoryArcGenerator
const { data: componentData = [], isLoading } = useQuery({
    queryKey: ['/api/component/user-data'],
    queryFn: () => apiRequest('/api/component/user-data'),
    retry: false,
});

  // Mutation for updating component data
  const updateStoryArcGenerator = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('/api/component/update', {
        headers: {
          "Content-Type" : "application/json"
    },
        method: 'POST',
        body: JSON.stringify(data)
  });
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/component'] });
  }
});


  const [uploadedFiles, setUploadedFiles] = useState<VideoFile[]>([]);
  const [projectTypes, setProjectTypes] = useState<ProjectType[]>([]);
  const [selectedProjectType, setSelectedProjectType] = useState<string>(', ');
  const [targetDuration, setTargetDuration] = useState<number>(300);
  const [generatedStoryArc, setGeneratedStoryArc] = useState<StoryArc | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [activeTab, setActiveTab] = useState(0);
  const [isDragActive, setIsDragActive] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [importingMonitor, setImportingMonitor] = useState(false);

  // Fetch project types on component mount
  useEffect(() => {
    fetchProjectTypes();
  }, []);

  // Fetch current session for Drive imports
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/auth/public-session', { credentials: 'include' });
        const json = await res.json();
        setCurrentUser(json);
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  const fetchProjectTypes = async () => {
    try {
      const response = await fetch('/api/story-arc/project-types');
      if (response.ok) {
        const data = await response.json();
        setProjectTypes(data.projectTypes || []);
    }
  } catch (error) {
      console.error('Error fetching project types: ', error);
      // Fallback data for development
setProjectTypes([
        {
          id: 'wedding',
          name: 'Bryllup',
          description: 'Romantisk bryllupsfilm med klassisk narrativ struktur',
          icon: '💒',
          targetDuration: 480,
          features: ['Ceremoni høydepunkter','Følelsesmomenter','Fest atmosfære']
        },
        {
          id: 'corporate',
          name: 'Bedrift',
          description: 'Profesjonell bedriftspresentasjon',
          icon: '🏢',
          targetDuration: 300,
          features: ['Brand storytelling','Team presentasjon','Produkt focus']
        },
        {
          id: 'social',
          name: 'Sosiale Medier',
          description: 'Engasjerende innhold for sosiale plattformer',
          icon: '📱',
          targetDuration: 60,
          features: ['Hook opening','Quick pacing','CTA ending']
        }
      ]);
  }
};

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
}, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
}, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
}, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    
    const files = Array.from(e.dataTransfer.files);
    handleFilesSelected(files);
}, []);

  const getRootProps = () => ({
    onDragEnter: handleDragEnter,
    onDragLeave: handleDragLeave,
    onDragOver: handleDragOver,
    onDrop: handleDrop,
});

  const getInputProps = () => ({
    type: 'file',
    multiple: true,
    accept: 'video/*',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        handleFilesSelected(Array.from(e.target.files));
  }
  },
});

  const handleFilesSelected = (files: File[]) => {
    console.log('🎬 Video filer valgt for story arc, :', files);
    setIsUploading(true);
    setUploadProgress(0);
};

  const handleUploadComplete = (results: any[]) => {
    console.log('✅ Story arc opplasting fullført, :', results);
    
    // Convert results to VideoFile format
    const newFiles: VideoFile[] = results.map((result, index) => ({
      id: `uploaded-${Date.now()}-${index}`,
      name: result.originalName || `Video ${index + 1}`,
      size: result.size || 0,
      duration: 120 + Math.random() * 10, // Mock duration for now
      resolution: '1920x1080', // Mock resolution
      format: result.originalName?.split('.').pop() || 'mp4',
      url: result.url || result.path
}));
    
    setUploadedFiles((prev: VideoFile[])  => [...prev, ...newFiles]);
    setUploadProgress(100);
    setIsUploading(false);
    setActiveTab(1); // Move to project selection tab
};

  const generateStoryArc = async () => {
    if (!selectedProjectType || uploadedFiles.length === 0) {
      console.log('Missing project type or files');
      return;
  }

    setIsGenerating(true);

    try {
const response = await fetch('/api/story-arc/generate', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({
          files: uploadedFiles.map((file: VideoFile) => file.id),
          projectType: selectedProjectType,
          targetDuration: targetDuration
        })
      });

      if (!response.ok) {
        throw new Error('Story arc generation failed: ' + response.statusText);
    }

      const result = await response.json();
      setGeneratedStoryArc(result.storyArc);
      setActiveTab(2); // Move to story arc tab
  } catch (error) {
      console.error('Error generating story arc:', error);
      // Generate mock story arc for development
      const mockStoryArc: StoryArc = {
        id: 'mock-arc-' + Date.now(),
        title: 'Generert Story Arc',
        totalDuration: targetDuration,
        pacing: 'medium',
        colorGrading: 'Warm Cinematic',
emotionalJourney: ['Intro','Buildup','Climax','Resolution'],
        musicRecommendations: ['Emotional Piano','Uplifting Orchestral','Ambient Outro'],
        segments: [
          {
            id: 'opening',
            title: 'Åpning',
            description: 'Etablerer stemning og settinng',
            startTime:  0,
            endTime: targetDuration * 0.5,
            intensity:  3,
clipRecommendations: ['Establishing shots','Key characters'],
            transitionType: 'Fade In',
            musicMood: 'Mysterious'
      },
          {
            id: 'buildup',
            title: 'Utvikling',
            description: 'Bygger opp spenning og engasjement',
            startTime: targetDuration * 0.5,
            endTime: targetDuration * 0.7,
            intensity:  7,
clipRecommendations: ['Action sequences','Emotional moments'],
            transitionType: 'Quick Cuts',
            musicMood: 'Building Energy'
      },
          {
            id: 'climax',
            title: 'Høydepunkt',
            description: 'Emosjonell eller visuell klimaks',
            startTime: targetDuration * 0.7,
            endTime: targetDuration * 0.9,
            intensity:  10,
clipRecommendations: ['Peak moments','Key reveals'],
            transitionType: 'Dramatic Cuts',
            musicMood: 'Intense Emotional'
      },
          {
            id: 'resolution',
            title: 'Avslutning',
            description: 'Løser opp og konkluderer historien',
            startTime: targetDuration * 0.9,
            endTime: targetDuration,
            intensity:  4,
clipRecommendations: ['Resolution shots','Final messages'],
            transitionType: 'Fade Out',
            musicMood: 'Peaceful Resolution'
      }
        ]
    };
      setGeneratedStoryArc(mockStoryArc);
      setActiveTab(2);
  } finally {
      setIsGenerating(false);
  }
};

const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

  const formatFileSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed()} MB`;
};

  return (
    <Box sx={{ 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      bgcolor: 'background.default',
      color: 'text.primary'
}}>
      {/* Header */}
      <Box sx={{ 
        borderBottom: 1,
        borderColor: 'divider', 
        p:  2,
        bgcolor: 'background.paper'
  }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ color: theming.colors.primary }}>
          Intelligent Story Arc Generator
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Lag profesjonelle videoer med intelligent narrativ struktur
        </Typography>
      </Box>

      {/* Main Content */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden'}}>
        <Box sx={{ flex: 1, p: 3, width: '100%', height: '100%'}}>
<Tabs 
            value={activeTab}
            onChange={(_, newValue) => setActiveTab(newValue)}
            sx={{ mb: 3, width: '100%' }}
          >
            <Tab label="Last opp videoer" icon={<CloudUpload />} />
            <Tab label="Velg prosjekttype" icon={<Settings />} disabled={uploadedFiles.length === 0} />
            <Tab label="Story Arc" icon={<Timeline />} disabled={!generatedStoryArc} />
          </Tabs>

          {/* Upload Tab */}
          {activeTab === 0 && (
            <MuiCard>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'stretch', flexWrap: 'wrap' }}>
                  <Box
                    {...getRootProps()}
                    sx={{
                      flex: '1 1 420px',
                      minWidth: 360,
                      border: '2px dashed',
                      borderColor: isDragActive ? 'primary.main' : 'grey.300',
                      borderRadius: 2,
                      p: 4,
                      textAlign: 'center',
                      cursor: 'pointer',
                      bgcolor: isDragActive ? 'action.hover' : 'transparent', '&:hover': { bgcolor: 'action.hover' }}}
                  >
                    <input {...getInputProps()} />
                    <CloudUpload sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
                    <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                      {isDragActive ? 'Slipp videoene her...' : 'Last opp videofiler'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Støtter MP4, MOV, AVI, WebM, MKV (maks 20 filer, 500MB per fil)
                    </Typography>
                  </Box>

                  <Box sx={{ flex: '1 1 320px', minWidth: 300, alignSelf: 'center' }}>
                    <Stack spacing={2}>
                      <Button
                        variant="outlined"
                        startIcon={<CloudUpload />}
                        disabled={importingMonitor || !currentUser?.id}
                        onClick={async () => {
                          if (!currentUser?.id) return;
                          try {
                            setImportingMonitor(true);
                            const path = encodeURIComponent('CreatorHub Norge Projects/studio_arc_create');
                            const res = await fetch(`/api/story-arc/google-drive/browse/${currentUser.id}?folderPath=${path}`, {
                              credentials: 'include',
                            });
                            const json = await res.json();
                            if (!res.ok || !json?.success) throw new Error(json?.message || 'Failed to browse');
                            const files = (json.files || []) as Array<any>;
                            const imported: VideoFile[] = files
                              .filter((f) => f.type === 'video')
                              .map((f: any) => ({
                                id: f.id,
                                name: f.name,
                                size: Number(f.size) || 0,
                                duration: 120, // unknown; will be analyzed later
                                resolution: 'unknown',
                                format: (f.name?.split('.').pop() || 'mp4').toLowerCase(),
                                url: f.url || f.downloadLink || '',
                              }));
                            if (imported.length > 0) {
                              setUploadedFiles(imported);
                              setActiveTab(1);
                            }
                          } catch (e) {
                            // no-op; optionally surface toast
                          } finally {
                            setImportingMonitor(false);
                          }
                        }}
                      >
                        {importingMonitor ? 'Henter fra Drive…' : 'Importer fra overvåket mappe'}
                      </Button>
                      {!currentUser?.id && (
                        <Typography variant="caption" color="text.secondary">
                          Logg inn for å importere fra Google Drive.
                        </Typography>
                      )}
                    </Stack>
                  </Box>
                </Box>

                {isUploading && (
                  <Box sx={{ mt: 3 }}>
                    <Typography variant="body2" gutterBottom>
                      Laster opp filer...
                    </Typography>
                    <LinearProgress variant="determinate" value={uploadProgress} sx={{ height: 8, borderRadius: 4 }} />
                  </Box>
                )}

                {uploadedFiles.length > 0 && (
                  <Box sx={{ mt: 3 }}>
                    <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                      Filer valgt ({uploadedFiles.length})
                    </Typography>
                    <List>
                      {uploadedFiles.map((file) => (
                        <ListItem key={file.id}>
                          <ListItemIcon>
                            <VideoFile color="primary" />
                          </ListItemIcon>
                          <ListItemText
                            primary={file.name}
                            secondary={`${formatFileSize(file.size)} • ${formatDuration(file.duration)} • ${file.resolution}`}
                          />
                          <Chip label={file.format.toUpperCase()} size="small" color="primary" variant="outlined" />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                )}
              </CardContent>
            </MuiCard>
          )}

          {/* Project Type Tab */}
          {activeTab === 1 && (
            <MuiCard>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  Velg prosjekttype
                </Typography>
                <Grid container spacing={3}>
                  {projectTypes.map((type) => (
                    <Grid item xs={12} md={4} key={type.id}>
                      <MuiCard 
                        variant={selectedProjectType === type.id ? "elevation" : "outlined"}
                        sx={{ 
                          cursor: 'pointer',
                          border: selectedProjectType === type.id ? 2 : 1,
                          borderColor: selectedProjectType === type.id ? 'primary.main' : 'divider', '&:hover': {
                            borderColor: 'primary.main'
                      }
                      }}
                        onClick={() => setSelectedProjectType(type.id)}
                      >
                        <CardContent sx={theming.getThemedCardSx()}>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb:  2 }}>
                            <Avatar sx={{ mr: 2, bgcolor: 'primary.main'}}>
                              {type.icon}
                            </Avatar>
                            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                              {type.name}
                            </Typography>
                          </Box>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            {type.description}
                          </Typography>
                          <Box sx={{ mt:  2 }}>
                            {type.features.map((feature, index) => (
                              <Chip 
                                key={index}
                                label={feature}
                                size="small" 
                                sx={{ mr: 0, mb: 0.5}}
                              />
                            ))}
                          </Box>
                        </CardContent>
                      </MuiCard>
                    </Grid>
                  ))}
                </Grid>

                {selectedProjectType && (
                  <Box sx={{ mt:  4 }}>
                    <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                      Tilpass innstillinger
                    </Typography>
                    <Box sx={{ mt:  2 }}>
                      <Typography gutterBottom>
                        Ønsket varighet: {formatDuration(targetDuration)}
                      </Typography>
                      <Slider
                        value={targetDuration}
                        onChange={(_, value) => setTargetDuration(value as number)}
                        min={30}
                        max={600}
                        step={30}
                        marks={[
                          { value:  60, label: '1 min' },
                          { value: 180, label: '3 min' },
                          { value: 300, label: '5 min' },
                          { value: 600, label: '10 min'},
                        ]}
                        sx={{ mt:  2 }}
                      />
                    </Box>

                    <Button variant="contained"
                      size="large"
                      onClick={generateStoryArc}
                      disabled={isGenerating}
                      sx={{ mt: 3, ...theming.getThemedButtonSx() }}>
                      {isGenerating ? 'Genererer Story Arc...' : 'Generer Story Arc'}
                    </Button>
                  </Box>
                )}
              </CardContent>
            </MuiCard>
          )}

          {/* Story Arc Tab */}
          {activeTab === 2 && generatedStoryArc && (
            <MuiCard>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb:  3 }}>
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                    {generatedStoryArc.title}
                  </Typography>
                  <Stack direction="row" spacing={2}>
<Button variant="outlined" startIcon={<Edit />}>
                      Tilpass
                    </Button>
                    <Button variant="contained" startIcon={<GetApp />} sx={theming.getThemedButtonSx()}>
                      Eksporter
                    </Button>
                  </Stack>
                </Box>

                {/* Story Arc Overview */}
                <Grid container spacing={3} sx={{ mb:  4 }}>
                  <Grid item xs={12} md={3}>
                  <Paper sx={{ p: 2, textAlign: 'center', ...theming.getThemedCardSx() }}>
                      <AccessTime sx={{ fontSize:  40, color: 'primary.main', mb:  1 }} />
                      <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                        {formatDuration(generatedStoryArc.totalDuration)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Total varighet
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Paper sx={{ p: 2, textAlign: 'center', ...theming.getThemedCardSx() }}>
                      <TrendingUp sx={{ fontSize:  40, color: 'primary.main', mb:  1 }} />
                      <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                        {generatedStoryArc.pacing}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Pacing
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Paper sx={{ p: 2, textAlign: 'center', ...theming.getThemedCardSx() }}>
                      <PhotoCamera sx={{ fontSize:  40, color: 'primary.main', mb:  1 }} />
                      <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                        {generatedStoryArc.colorGrading}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Color Grading
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Paper sx={{ p: 2, textAlign: 'center', ...theming.getThemedCardSx() }}>
                      <People sx={{ fontSize:  40, color: 'primary.main', mb:  1 }} />
                      <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                        {generatedStoryArc.segments.length}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Segmenter
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>

                {/* Story Segments */}
<Typography variant="h6" gutterBottom sx={{ mt: 4, color: theming.colors.primary }}>
                  Story Segmenter
                </Typography>
                
                {generatedStoryArc.segments.map((segment, index) => (
                  <Accordion key={segment.id} defaultExpanded={index === 0}>
<AccordionSummary expandIcon={<ExpandMore />}>
                      <Box sx={{ display: 'flex', alignItems: 'center', width: '100%'}}>
                        <Typography variant="subtitle1" sx={{ mr:  2 }}>
                          {segment.title}
                        </Typography>
                        <Chip 
                          label={`${formatDuration(segment.startTime)} - ${formatDuration(segment.endTime)}`}
                          size="small"
                          color="primary"
                          variant="outlined"
                          sx={{ mr:  2 }}
                        />
                        <Chip 
                          label={`Intensitet: ${segment.intensity}/10`}
                          size="small"
                          color={segment.intensity > 7 ? 'error' : segment.intensity > 4 ? 'warning' : 'success'}
                          variant="outlined"
                        />
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        {segment.description}
                      </Typography>
                      
                      <TableContainer>
                        <Table size="small">
                          <TableBody>
                            <TableRow>
                              <TableCell variant="head">Anbefalte klipp: </TableCell>
                              <TableCell>
                                {segment.clipRecommendations.map((rec, i) => (
                                  <Chip key={i} label={rec} size="small" sx={{ mr: 0, mb: 0.5}} />
                                ))}
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell variant="head">Overgang: </TableCell>
                              <TableCell>{segment.transitionType}</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell variant="head">Musikk stemning: </TableCell>
                              <TableCell>{segment.musicMood}</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </AccordionDetails>
                  </Accordion>
                ))}

                {/* Music Recommendations */}
                <Box sx={{ mt:  4 }}>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                    Musikk anbefalinger
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {generatedStoryArc.musicRecommendations.map((music, index) => (
                      <Chip 
                        key={index}
                        label={music}
                        color="secondary"
                        sx={{ mb:  1 }}
                      />
                    ))}
                  </Stack>
                </Box>

                {/* Emotional Journey */}
                <Box sx={{ mt:  4 }}>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                    Emosjonell reise
                  </Typography>
                  <Stack direction="row" spacing={2}>
                    {generatedStoryArc.emotionalJourney.map((emotion: string, index: number) => (
<Paper key={index} sx={{ p: 1, textAlign:'center', minWidth: 80, ...theming.getThemedCardSx() }}>
                        <Typography variant="body2">
                          {emotion}
                        </Typography>
                      </Paper>
                    ))}
                  </Stack>
                </Box>
              </CardContent>
            </MuiCard>
          )}
        </Box>
      </Box>
    </Box>
  );
}