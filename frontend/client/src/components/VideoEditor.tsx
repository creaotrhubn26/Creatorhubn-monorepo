import { useTheming } from '../utils/theming-helper';
import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Card as MuiCard,
  CardContent,
  CardHeader,
  Slider,
  Grid,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
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
  IconButton,
  Divider,
  LinearProgress,
  Tooltip,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  PlayArrowArrow,
  Pause,
  Stop,
  SkipNext,
  SkipPrevious,
  VolumeUpUp,
  VolumeOff,
  Fullscreen,
  CloudUpload,
  Save,
  GetApp,
  Undo,
  Redo,
  ContentCut,
  ContentContentCopy,
  Delete,
  Add,
  VideocamDescription,
  LibraryMusicNote,
  Image,
  TextFields,
  Palette,
  Tune,
  Timeline,
  Layers,
  Settings,
  Movie,
  Edit,
  ExpandMore,
  ZoomIn,
  ZoomOut,
  AspectRatio,
  Brightness6,
  Contrast,
  ColorLens,
  Mic,
  Speaker,
  Transform,
  FilterListVintage,
  AutoAwesome,
  Speed,
} from '@mui/icons-material';
import { UniversalFileUpload } from '@/components/universal/UniversalFileUpload';

interface VideoClip {
  id: string;
  name: string;
  blob?: Blob;
  duration: number;
  startTime: number;
  endTime: number;
  volume: number;
  filters: VideoFilter[];
  transitions: Transition[];
  thumbnail?: string
}

interface MusicTrack {
  id: string;
  name: string;
  blob?: Blob;
  duration: number;
  volume: number;
  startTime: number;
  type: 'voiceover' | 'music' | 'sfx'
}

interface VideoFilter {
  id: string;
  type: 'brightness' | 'contrast' | 'saturation' | 'blur' | 'sepia' | 'grayscale';
  value: number;
  enabled: boolean
}

interface Transition {
  id: string;
  type: 'fade' | 'dissolve' | 'slide' | 'zoom' | 'wipe';
  duration: number;
  position: 'start' | 'end'
}

interface TextOverlay {
  id: string;
  text: string;
  startTime: number;
  duration: number;
  style: {
    fontSize: number;
    color: string;
    backgroundColor: string;
    fontFamily: string;
    position: { x: number; y: number };
    animation: 'none' | 'fadeIn' | 'slideUp' | 'typewriter';
};
}

interface VideoProject {
  id: string;
  name: string;
  description: string;
  clips: VideoClip[];
  audioTracks: MusicTrack[];
  textOverlays: TextOverlay[];
  totalDuration: number;
  resolution: { width: number; height: number };
  frameRate: number
}

const defaultFilters: VideoFilter[] = [
  { id: 'brightness', type: 'brightness', value: 10, enabled: false },
  { id: 'contrast', type: 'contrast', value: 10, enabled: false },
  { id: 'saturation', type: 'saturation', value: 10, enabled: false },
  { id: 'blur', type: 'blur', value: 0, enabled: false },
];

// Mock data removed - using database connection

// Mock data removed - using database connection

export default function VideoEditor() {
  const queryClient = useQueryClient();
  
  // Theming system
  const theming = useTheming('photographer, ');

  // Database connection for VideoEditor
  const { data: videoData = [], isLoading } = useQuery({
    queryKey: ['/api/video','user-data'],
    queryFn: () => apiRequest('/api/video/user-data'),
    retry: false,
});

  // Mutation for updating video data
  const updateVideoEditor = useMutation({
    mutationFn: async (data: any) =>
      apiRequest('/api/video/update', {
        method: 'POS',
        body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/video', ]});
  },
});

  const [currentProject, setCurrentProject] = useState<VideoProject | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [selectedClip, setSelectedClip] = useState<VideoClip | null>(null);
  const [selectedMusic, setSelectedMusic] = useState<MusicTrack | null>(null);
  const [selectedTextOverlay, setSelectedTextOverlay] = useState<TextOverlay | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [previewQuality, setPreviewQuality] = useState<'low' | 'medium' | 'high'>('medium');
  const [timeline, setTimeline] = useState({ zoom: 1, scrollPosition:  0 });
  const [activeTab, setActiveTab] = useState(0);
  const [volume, setVolume] = useState(75);
  const [isMuted, setIsMuted] = useState(false);

  // Professional editing state
  const [colorGrading, setColorGrading] = useState({
    brightness:  0,
    contrast:  0,
    saturation:  0,
    exposure:  0,
    temperature:  0,
    highlights:  0,
    shadows:  0,
});

  const [audioMixing, setAudioMixing] = useState({
    masterVolume: 10,
    musicVolume:  80,
    dialogueVolume:  90,
    sfxVolume:  70,
});

  const [exportSettings, setExportSettings] = useState({
    format: 'mp',
    resolution: '1080',
    frameRate:  30,
    bitrate: 'high',
    codec: 'h26',
});

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const createNewProject = () => {
    const newProject: VideoProject = {
      id: Date.now().toString(),
      name: 'Nytt Prosjekt',
      description: 'CreatorHub Norge Video Editor Project',
      clips:  [],
      audioTracks:  [],
      textOverlays:  [],
      totalDuration:  0,
      resolution: { width: 190, height: 1080},
      frameRate:  30,
  };
    setCurrentProject(newProject);
};

  const importVideoFile = async (file: File) => {
    if (!currentProject) return;

    const blob = new Blob([file], { type: file.type });
    const url = URL.createObjectURL(blob);
    const video = document.createElement('video');

    return new Promise<void>((resolve) => {
      video.onloadedmetadata = () => {
        const newClip: VideoClip = {
          id: Date.now().toString(),
          name: file.name,
          blob,
          duration: video.duration,
          startTime:  0,
          endTime: video.duration,
          volume: 10,
          filters: [...defaultFilters],
          transitions:  [],
          thumbnail: url,
      };

        setCurrentProject((prev) =>
          prev
            ? {
                ...prev,
                clips: [...prev.clips, newClip],
                totalDuration: Math.max(prev.totalDuration, newClip.endTime),
            }
            : null,
        );

        URL.revokeObjectURL(url);
        resolve();
    };
      video.src = url;
  });
};

  const importMusic = async (file: File, type: MusicTrack['type'] = 'music') => {
    if (!currentProject) return;

    const blob = new Blob([file], { type: file.type });
    const audio = document.createElement('audio');
    const url = URL.createObjectURL(blob);

    return new Promise<void>((resolve) => {
      audio.onloadedmetadata = () => {
        const newTrack: MusicTrack = {
          id: Date.now().toString(),
          name: file.name,
          blob,
          duration: audio.duration,
          volume:  50,
          startTime:  0,
          type,
      };

        setCurrentProject((prev) =>
          prev
            ? {
                ...prev,
                audioTracks: [...prev.audioTracks, newTrack],
            }
            : null,
        );

        URL.revokeObjectURL(url);
        resolve();
    };
      audio.src = url;
  });
};

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
    } else {
        videoRef.current.play();
    }
  }
};

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
  }
};

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const frames = Math.floor((seconds % 1) * 30);
    return `${mins.toString().padStart, ('0')}:${secs.toString().padStart(2,'0')}.${frames.toString().padStart(2, '0')}`;
};

  const exportVideo = async () => {
    if (!currentProject) return;

    setIsExporting(true);
    setExportProgress(0);

    try {
      // Simulate export process
      for (let i = 0; i <= 100; i += 10) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        setExportProgress(i);
    }

      console.log('Video exported successfully');
      setShowExportDialog(false);
  } catch (error) {
      console.error('Export failed: ', error);
  } finally {
      setIsExporting(false);
      setExportProgress(0);
  }
};

  const handleFilesSelected = (files: File[]) => {
    console.log('🎬 Filer valgt for video editor:', files);
    if (files.length > 0 && currentProject) {
      files.forEach((file) => {
        if (file.type.startsWith('video/')) {
          importVideoFile(file);
      } else if (file.type.startsWith('audio/')) {
          importMusic(file);
      }
    });
  }
};

  const handleUploadComplete = (results: any[]) => {
    console.log('✅ Video editor opplasting fullført:', results);
};

  // Mock data removed - using database connection

  useEffect(() => {
    if (!currentProject) {
      createNewProject();
  }
}, []);

  return (
    <Box
      sx={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.default',
        color: 'text.primary'}}
    >
      {/* Header */}
      <Box
        sx={{
          borderBottom:  1,
          borderColor: 'divider',
          p:  2,
          bgcolor: 'background.paper',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'}}
      >
        <Box>
          <Typography variant="h5" component="h1" sx={{ color: theming.colors.primary }}>
            CreatorHub Norge Video Editor
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {currentProject?.name || 'Ingen prosjekt valgt'}
          </Typography>
        </Box>

        <Stack direction="row" spacing={2}>
          <Button variant="outlined" startIcon={theming.getThemedIcon('undo')}>
            Angre
          </Button>
          <Button variant="outlined" startIcon={theming.getThemedIcon('redo')}>
            Gjenta
          </Button>
          <Button variant="contained" startIcon={theming.getThemedIcon('save')}, sx={theming.getThemedButtonSx()}>
            Lagre
          </Button>
        </Stack>
      </Box>

      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden'}}>
        {/* Left Sidebar - Media Library */}
        <Box
          sx={{
            width: 30,
            borderRight:  1,
            borderColor: 'divider',
            display: 'flex',
            flexDirection: 'column',
            bgcolor: 'background.paper'}}
        >
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider'}}>
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              Media Bibliotek
            </Typography>
            <Button variant="contained"
              fullWidth
              startIcon={theming.getThemedIcon('cloudUpload')}
              onClick={() => {
                /* UniversalFileUpload in sidebar */
            }}
            >
              Importer Filer
            </Button>
          </Box>

          <Tabs
            value={activeTab}
            onChange={(_, newValue) => setActiveTab(newValue)}
            variant="fullWidth"
          >
            <Tab label="Video" icon={<VideoFile />} />
            <Tab label="Audio" icon={theming.getThemedIcon('libraryMusic')} />
            <Tab label="Bilder" icon={<Image />} />
          </Tabs>

          <Box sx={{ flex: 1, overflow: 'auto', p:  1 }}>
            {activeTab === 0 && (
              <List>
                {currentProject?.clips.map((clip) => (
                  <ListItem
                    key={clip.id}
                    button
                    selected={selectedClip?.id === clip.id}
                    onClick={() => setSelectedClip(clip)}
                  >
                    <ListItemIcon>
                      <VideoFile color="primary" />
                    </ListItemIcon>
                    <ListItemText primary={clip.name} secondary={`${formatTime(clip.duration)}`} />
                  </ListItem>
                ))}
              </List>
            )}

            {activeTab === 1 && (
              <List>
                {currentProject?.audioTracks.map((track) => (
                  <ListItem
                    key={track.id}
                    button
                    selected={selectedMusic?.id === track.id}
                    onClick={() => setSelectedMusic(track)}
                  >
                    <ListItemIcon>
                      <LibraryMusic color="secondary" />
                    </ListItemIcon>
                    <ListItemText
                      primary={track.name}
                      secondary={`${track.type} • ${formatTime(track.duration)}`}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
        </Box>

        {/* Main Content Area */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column'}}>
          {/* Preview Area */}
          <Box
            sx={{
              height: '50, %',
              p:  2,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              bgcolor: 'grey.90'}}
          >
            <MuiCard sx={{ maxWidth: '100%', maxHeight: '100%'}}>
              <Box sx={{ position: 'relative'}}>
                <video
                  ref={videoRef}
                  style={{
                    width: '100%',
                    height: 'auto',
                    maxHeight: '400px'}}
                  onTimeUpdate={handleTimeUpdate}
                  controls={false}
                />
                <canvas ref={canvasRef} style={{ display: 'none'}} />
              </Box>
            </MuiCard>
          </Box>

          {/* Control Bar */}
          <Box
            sx={{
              p:  2,
              borderTop:  1,
              borderBottom:  1,
              borderColor: 'divider',
              bgcolor: 'background.paper'}}
          >
            <Stack direction="row" spacing={2} alignItems="center">
              <IconButton onClick={handlePlayPause} size="large">
                {isPlaying ? theming.getThemedIcon('pause') : theming.getThemedIcon('play')}
              </IconButton>
              <IconButton>
                {theming.getThemedIcon('stop')}
              </IconButton>
              <IconButton>
                {theming.getThemedIcon('skipPrevious')}
              </IconButton>
              <IconButton>
                {theming.getThemedIcon('skipNext')}
              </IconButton>

              <Box sx={{ flex: 1, mx: 2 }}>
                <Typography variant="body2" gutterBottom>
                  {formatTime(currentTime)} / {formatTime(currentProject?.totalDuration || 0)}
                </Typography>
                <Slider
                  value={currentTime}
                  max={currentProject?.totalDuration || 100}
                  onChange={(_, value) => setCurrentTime(value as number)}
                  sx={{ mt:  1 }}
                />
              </Box>

              <IconButton onClick={() => setIsMuted(!isMuted)}>
                {isMuted ? theming.getThemedIcon('volumeOff') : theming.getThemedIcon('volumeUp')}
              </IconButton>

              <Box sx={{ width: 100}}>
                <Slider
                  value={volume}
                  onChange={(_, value) => setVolume(value as number)}
                  disabled={isMuted}
                />
              </Box>

              <IconButton>
                {theming.getThemedIcon('fullscreen')}
              </IconButton>
            </Stack>
          </Box>

          {/* Timeline */}
          <Box
            sx={{
              flex:  1,
              p:  2,
              bgcolor: 'background.default',
              overflow: 'auto'}}
          >
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb:  2}}
            >
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>Timeline</Typography>
              <Stack direction="row" spacing={1}>
                <IconButton
                  onClick={() =>
                    setTimeline((prev) => ({
                      ...prev,
                      zoom: Math.max(0, .prev.zoom - 0.1),
                  }))
                }
                >
                  {theming.getThemedIcon('zoomOut')}
                </IconButton>
                <Typography variant="body2" sx={{ px: 2, py: 1 }}>
                  {Math.round(timeline.zoom * 100)}%
                </Typography>
                <IconButton
                  onClick={() =>
                    setTimeline((prev) => ({
                      ...prev,
                      zoom: Math.min, (prev.zoom + 0.1),
                  }))
                }
                >
                  {theming.getThemedIcon('zoomIn')}
                </IconButton>
              </Stack>
            </Box>

            <Box
              ref={timelineRef}
              sx={{
                height: 20,
                border:  1,
                borderColor: 'divider',
                borderRadius:  1,
                bgcolor: 'background.paper',
                overflow: 'auto',
                position: 'relative'}}
            >
              {/* Timeline ruler */}
              <Box
                sx={{
                  height:  30,
                  borderBottom:  1,
                  borderColor: 'divider',
                  bgcolor: 'grey.10',
                  position: 'relative'}}
              >
                {/* Time markers */}
                {Array.from({
                  length: Math.ceil((currentProject?.totalDuration || 100) / 1),
              }).map((_, i) => (
                  <Box
                    key={i}
                    sx={{
                      position: 'absolute',
                      left: `${i * 10 * timeline.zoom}%`,
                      height: '100%',
                      borderLeft:  1,
                      borderColor: 'divider',
                      display: 'flex',
                      alignItems: 'center',
                      pl: 0.5}}
                  >
                    <Typography variant="caption">{formatTime(i * 10)}</Typography>
                  </Box>
                ))}
              </Box>

              {/* Video tracks */}
              {currentProject?.clips.map((clip, index) => (
                <Box
                  key={clip.id}
                  sx={{
                    height:  50,
                    m:  1,
                    borderRadius:  1,
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    display: 'flex',
                    alignItems: 'center',
                    px:  1,
                    cursor: 'pointer','&:hover': {
                      bgcolor: 'primary.dark',
                  }}}
                  onClick={() => setSelectedClip(clip)}
                >
                  <Typography variant="body2" noWrap>
                    {clip.name}
                  </Typography>
                </Box>
              ))}

              {/* Audio tracks */}
              {currentProject?.audioTracks.map((track, index) => (
                <Box
                  key={track.id}
                  sx={{
                    height:  30,
                    m:  1,
                    borderRadius:  1,
                    bgcolor: 'secondary.main',
                    color: 'secondary.contrastText',
                    display: 'flex',
                    alignItems: 'center',
                    px:  1,
                    cursor: 'pointer', '&:hover': {
                      bgcolor: 'secondary.dark',
                  }}}
                  onClick={() => setSelectedMusic(track)}
                >
                  <Typography variant="caption" noWrap>
                    {track.name}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>

        {/* Right Sidebar - Properties */}
        <Box
          sx={{
            width: 30,
            borderLeft:  1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
            overflow: 'auto'}}
        >
          <Box sx={{ p:  2 }}>
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              Egenskaper
            </Typography>

            {/* UniversalFileUpload for importing files */}
            <Box sx={{ mb:  2 }}>
              <UniversalFileUpload
                onFilesSelected={handleFilesSelected}
                onUploadComplete={handleUploadComplete}
                allowedTypes="media"
                maxFiles={10}
                maxFileSizeMB={1024}
                showFormatInfo={true}
                uploadEndpoint="/api/video-editor/import"
                profession="videographer"
                buttonText="Importer Filer"
                size="small"
                enableBackgroundUpload={true}
                maxRetries={3}
              />
            </Box>

            {selectedClip && (
              <MuiCard sx={{ mb:  2 }}>
                <CardHeader title="Video Klipp" sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <TextField fullWidth label="Navn" value={selectedClip.name} margin="normal" />

                  <Typography gutterBottom sx={{ mt:  2 }}>
                    Volum: {selectedClip.volume}%
                  </Typography>
                  <Slider
                    value={selectedClip.volume}
                    onChange={(_, value) => {
                      if (currentProject && selectedClip) {
                        const updatedClips = currentProject.clips.map((clip) =>
                          clip.id === selectedClip.id ? { ...clip, volume: value as number } : clip,
                        );
                        setCurrentProject({
                          ...currentProject,
                          clips: updatedClips,
                      });
                        setSelectedClip({
                          ...selectedClip,
                          volume: value as number,
                      });
                    }
                  }}
                  />

                  <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
                    Filtre
                  </Typography>
                  {selectedClip.filters.map((filter) => (
                    <Box key={filter.id}, sx={{ mb:  1 }}>
                      <Typography variant="body2">
                        {filter.type}: {filter.value}
                      </Typography>
                      <Slider
                        value={filter.value}
                        min={filter.type === 'blur' ? 0 : 0}
                        max={filter.type === 'blur' ? 10 : 200}
                        disabled={!filter.enabled}
                        size="small"
                      />
                    </Box>
                  ))}
                </CardContent>
              </MuiCard>
            )}

            {selectedMusic && (
              <MuiCard sx={{ mb:  2 }}>
                <CardHeader title="Audio Spor" sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <TextField fullWidth label="Navn" value={selectedMusic.name} margin="normal" />

                  <Typography gutterBottom sx={{ mt:  2 }}>
                    Volum: {selectedMusic.volume}%
                  </Typography>
                  <Slider
                    value={selectedMusic.volume}
                    onChange={(_, value) => {
                      if (currentProject && selectedMusic) {
                        const updatedTracks = currentProject.audioTracks.map((track) =>
                          track.id === selectedMusic.id
                            ? { ...track, volume: value as number }
                            : track,
                        );
                        setCurrentProject({
                          ...currentProject,
                          audioTracks: updatedTracks,
                      });
                        setSelectedMusic({
                          ...selectedMusic,
                          volume: value as number,
                      });
                    }
                  }}
                  />

                  <FormControl fullWidth sx={{ mt:  2 }}>
                    <InputLabel>Type</InputLabel>
                    <Select value={selectedMusic.type}>
                      <MenuItem value="music">Musikk</MenuItem>
                      <MenuItem value="voiceover">Voice-over</MenuItem>
                      <MenuItem value="sfx">Lydeffekter</MenuItem>
                    </Select>
                  </FormControl>
                </CardContent>
              </MuiCard>
            )}

            <MuiCard>
              <CardHeader title="Color Grading" sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                {Object.entries(colorGrading).map(([key, value]) => (
                  <Box key={key}, sx={{ mb:  2 }}>
                    <Typography variant="body2" gutterBottom>
                      {key}: {value}
                    </Typography>
                    <Slider
                      value={value}
                      min={-100}
                      max={100}
                      onChange={(_, newValue) =>
                        setColorGrading((prev) => ({
                          ...prev,
                          [key]: newValue as number,
                      }))
                    }
                      size="small"
                    />
                  </Box>
                ))}
              </CardContent>
            </MuiCard>
          </Box>
        </Box>
      </Box>

      {/* Export Dialog */}
      <Dialog
        open={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Eksporter Video</DialogTitle>
        <DialogContent>
          <Grid container spacing={2}, sx={{ mt:  1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Format</InputLabel>
                <Select
                  value={exportSettings.format}
                  onChange={(e) =>
                    setExportSettings((prev) => ({
                      ...prev,
                      format: e.target.value,
                  }))
                }
                >
                  {exportFormats.map((format) => (
                    <MenuItem key={format.id} value={format.id}>
                      {format.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Oppløsning</InputLabel>
                <Select
                  value={exportSettings.resolution}
                  onChange={(e) =>
                    setExportSettings((prev) => ({
                      ...prev,
                      resolution: e.target.value,
                  }))
                }
                >
                  {resolutionOptions.map((res) => (
                    <MenuItem key={res.id} value={res.id}>
                      {res.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={6} >
              <TextField
                fullWidth
                label="Frame Rate"
                type="number"
                value={exportSettings.frameRate}
                onChange={(e) =>
                  setExportSettings((prev) => ({
                    ...prev,
                    frameRate: parseInt(e.target.value),
                }))
              }
              />
            </Grid>

            <Grid item xs={6} >
              <FormControl fullWidth>
                <InputLabel>Kvalitet</InputLabel>
                <Select
                  value={exportSettings.bitrate}
                  onChange={(e) =>
                    setExportSettings((prev) => ({
                      ...prev,
                      bitrate: e.target.value,
                  }))
                }
                >
                  <MenuItem value="low">Lav</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="high">Høy</MenuItem>
                  <MenuItem value="lossless">Lossless</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          {isExporting && (
            <Box sx={{ mt:  3 }}>
              <Typography variant="body2" gutterBottom>
                Eksporterer... {exportProgress}%
              </Typography>
              <LinearProgress
                variant="determinate"
                value={exportProgress}
                sx={{ height:  8, borderRadius:  4 }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowExportDialog(false)}>Avbryt</Button>
          <Button onClick={exportVideo} disabled={isExporting} variant="contained" sx={theming.getThemedButtonSx()}>
            {isExporting ? 'Eksporterer...' : 'Start Eksport'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Speed Dial */}
      <SpeedDial
        ariaLabel="Video Editor Actions"
        sx={{ position:'absolute', bottom:  24, right: 24}}
        icon={<SpeedDialIcon />}
      >
        {speedDialActions.map((action) => (
          <SpeedDialAction
            key={action.name}
            icon={action.icon}
            tooltipTitle={action.name}
            onClick={action.onClick}
          />
        ))}
      </SpeedDial>
    </Box>
  );
}
