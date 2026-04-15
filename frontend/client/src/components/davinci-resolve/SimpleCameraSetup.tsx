// @ts-nocheck
import { useTheming } from '../../utils/theming-helper';
import React, { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Alert,
  Chip,
  Grid,
  Paper,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stepper,
  Step,
  StepLabel,
  StepContent,
} from '@mui/material';
import { VideographyIconcam,
  Add,
  Delete,
  PlayArrowArrow,
  CheckCircle,
  CameraAltAlt,
  Movie,
  VideoLibrary,
  Share,
  Download,
  AutoFixHigh, } from '../shared/CreatorHubIcons';
import { apiRequest } from '@/lib/queryClient';

interface CameraInfo {
  name: string;
  type: string;
  resolution: string
}

interface ProjectInfo {
  event_name: string;
  client_name: string;
  event_type: string;
  date: string
}

interface SimpleCameraSetupProps {
  onProjectCreated?: (project: any) => void
}

export default function SimpleCameraSetup({ onProjectCreated }: SimpleCameraSetupProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [cameras, setCameras] = useState<CameraInfo[]>([
    { name: '', type: 'DSL', resolution: '1920x1080',}
  ]);
  const [projectInfo, setProjectInfo] = useState<ProjectInfo>({
    event_name: '',
    client_name: '',
    event_type: 'wedding',
    date: new Date().toISOString().split('T')[0]
});
  const [showResults, setShowResults] = useState(false);
  const [projectResult, setProjectResult] = useState<any>(null);

  // Create project mutation
  const createProject = useMutation({
    mutationFn: async ({ cameraInfo, projectInfo }: { cameraInfo: any, projectInfo: any }) => {
      const response = await fetch('/api/davinci-resolve/simple-camera-setup,', {
        headers: {
          'Content-Type' : 'application/json'
        },
        credentials: 'include',
        method: 'POST',
        body: JSON.stringify({ cameraInfo, projectInfo }),
      });
      
      if (!response.ok) {
        throw new Error('Project creation failed');
    }
      
      return response.json();
  },
    onSuccess: (data) => {
      console.log('✅ Simple project created, :', data);
      setProjectResult(data);
      setShowResults(true);
      onProjectCreated?.(data);
  },
    onError: (error) => {
      console.error('❌ Project creation failed, :', error);
  },
});

  const handleAddCamera = useCallback(() => {
    setCameras([...cameras, { name: '', type: 'DSL', resolution: '1920x1080',}]);
}, [cameras]);

  const handleRemoveCamera = useCallback((index: number) => {
    if (cameras.length > 1) {
      setCameras(cameras.filter((_, i) => i !== index));
  }
}, [cameras]);

  const handleCameraChange = useCallback((index: number, field: keyof CameraInfo, value: string) => {
    const newCameras = [...cameras];
    newCameras[index] = { ...newCameras[index], [field]: value };
    setCameras(newCameras);
}, [cameras]);

  const handleProjectInfoChange = useCallback((field: keyof ProjectInfo, value: string) => {
    setProjectInfo({ ...projectInfo, [field]: value });
}, [projectInfo]);

  const handleNext = useCallback(() => {
    setActiveStep((prev) => prev + 1);
}, []);

  const handleBack = useCallback(() => {
    setActiveStep((prev) => prev - 1);
}, []);

  const handleCreateProject = useCallback(() => {
    const cameraInfo = { cameras };
    createProject.mutate({ cameraInfo, projectInfo });
}, [cameras, projectInfo, createProject]);

  const handleReset = useCallback(() => {
    setActiveStep(0);
    setCameras([{ name: '', type: 'DSL', resolution: '1920x1080',}]);
    setProjectInfo({
      event_name: '',
      client_name: '',
      event_type: 'wedding',
      date: new Date().toISOString().split('T')[0]
});
    setShowResults(false);
    setProjectResult(null);
}, []);

  const steps = [
    {
      label: 'Camera Setup',
      description: 'Tell us about your cameras'
},
    {
      label: 'Project Info',
      description: 'Basic project information'
},
    {
      label: 'Create Project',
      description: 'Generate your DaVinci Resolve project'
}
  ];

  if (showResults && projectResult) {
    return (
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column'}}>
        {/* Success Header */}
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider'}}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb:  2 }}>
            <CheckCircle sx={{ color: 'success.main', mr: 1, fontSize: 32}} />
            <Typography variant="h5" sx={{  fontWeight: 'bold', color: 'success.main' }}>
              Project Created Successfully!
            </Typography>
          </Box>
        </Box>

        {/* Results Content */}
        <Box sx={{ flex: 1, p: 2, overflow: 'auto'}}>
          <Grid container spacing={3}>
            {/* Project Info */}
            <Grid item xs={12}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                    Project Details
                  </Typography>
                  <List>
                    <ListItem>
                      <ListItemIcon>
                        {theming.getThemedIcon('videoLibrary')}
                      </ListItemIcon>
                      <ListItemText
                        primary="Project Name"
                        secondary={projectResult.project_name}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        {theming.getThemedIcon('share')}
                      </ListItemIcon>
                      <ListItemText
                        primary="Client"
                        secondary={projectInfo.client_name}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <Movie />
                      </ListItemIcon>
                      <ListItemText
                        primary="Event Type"
                        secondary={projectInfo.event_type}
                      />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>

            {/* Cameras Setup */}
            <Grid item xs={12}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                    Cameras Setup
                  </Typography>
                  <List>
                    {projectResult.cameras_setup.map((camera: any, index: number) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          <VideographyIcon />
                        </ListItemIcon>
                        <ListItemText
                          primary={camera.camera_name}
                          secondary={`${camera.camera_type} - ${camera.resolution}`}
                        />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            </Grid>

            {/* Timelines Created */}
            <Grid item xs={12}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                    Timelines Created
                  </Typography>
                  <Grid container spacing={2}>
                    {projectResult.timelines_created.map((timeline: any, index: number) => (
                      <Grid item xs={12} key={index}>
                        <Paper sx={{ p: 2, textAlign: 'center'}}>
                          <Typography variant="h6" color="primary" sx={{ color: theming.colors.primary }}>
                            {timeline.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {timeline.settings.resolution} @ {timeline.settings.frameRate}fps
                          </Typography>
                          <Chip
                            label={timeline.type.replace('_', ',')}
                            size="small"
                            color="primary"
                            sx={{ mt:  1 }}
                          />
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mt:  3 }}>
            <Button
              variant="outlined"
              startIcon={theming.getThemedIcon('autoFixHigh')}
              onClick={handleReset}
            >
              Create Another Project
            </Button>
            
            <Button variant="contained"
              startIcon={theming.getThemedIcon('download')}
              sx={{
                background: 'linear-gradient(45deg, #3b82f6, #8b5cf6)', '&:hover': {
                  background: 'linear-gradient(45deg, #2563eb, #7c3aed)',
              }}}
             sx={theming.getThemedButtonSx()}>
              Open in DaVinci Resolve
            </Button>
          </Box>
        </Box>
      </Box>
    );
}

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column'}}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider'}}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb:  2 }}>
          <Videocam sx={{ color: '#3b82f0', mr: 1, fontSize: 32}} />
          <Typography variant="h5" sx={{  fontWeight: 'bold', color: theming.colors.primary }}>
            Simple Camera Setup
          </Typography>
        </Box>
        
        <Typography variant="body2" color="text.secondary">
          Easy dialog to set up your cameras and create a complete DaVinci Resolve project
        </Typography>
      </Box>

      {/* Stepper */}
      <Box sx={{ p:  2 }}>
        <Stepper activeStep={activeStep} orientation="horizontal">
          {steps.map((step, index) => (
            <Step key={step.label}>
              <StepLabel>{step.label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Box>

      {/* Main Content */}
      <Box sx={{ flex: 1, p: 2, overflow: 'auto'}}>
        <Card sx={theming.getThemedCardSx()}>
          <CardContent sx={theming.getThemedCardSx()}>
            {/* Step 1: Camera Setup */}
            {activeStep === 0 && (
              <Box>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  Camera Setup
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb:  3 }}>
                  Tell us about your cameras. We'll create organized bins for each camera.
                </Typography>
                
                <List>
                  {cameras.map((camera, index) => (
                    <ListItem key={index} sx={{ flexDirection: 'column', alignItems: 'stretch'}}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, width: '100%'}}>
                        <CameraAlt sx={{ mr: 1, color: 'primary.main'}} />
                        <Typography variant="subtitle1">
                          Camera {index + 1}
                        </Typography>
                        {cameras.length > 1 && (
                          <ListItemSecondaryAction>
                            <IconButton
                              edge="end"
                              onClick={() => handleRemoveCamera(index)}
                              color="error"
                            >
                              {theming.getThemedIcon('delete')}
                            </IconButton>
                          </ListItemSecondaryAction>
                        )}
                      </Box>
                      
                      <Grid container spacing={2}>
                        <Grid item xs={12}>
                          <TextField
                            label="Camera Name"
                            value={camera.name}
                            onChange={(e) => handleCameraChange(index, 'name', e.target.value)}
                            placeholder="e.g., Canon R5, Sony A7"
                            fullWidth
                            required
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <FormControl fullWidth>
                            <InputLabel>Camera Type</InputLabel>
                            <Select
                              value={camera.type}
                              onChange={(e) => handleCameraChange(index, 'type', e.target.value)}
                              label="Camera Type"
                            >
                              <MenuItem value="DSLR">DSLR</MenuItem>
                              <MenuItem value="Mirrorless">Mirrorless</MenuItem>
                              <MenuItem value="Cinema">Cinema Camera</MenuItem>
                              <MenuItem value="Action Cam">Action Camera</MenuItem>
                              <MenuItem value="Drone">Drone</MenuItem>
                              <MenuItem value="Other">Other</MenuItem>
                            </Select>
                          </FormControl>
                        </Grid>
                        <Grid item xs={12}>
                          <FormControl fullWidth>
                            <InputLabel>Resolution</InputLabel>
                            <Select
                              value={camera.resolution}
                              onChange={(e) => handleCameraChange(index, 'resolution', e.target.value)}
                              label="Resolution"
                            >
                              <MenuItem value="1920x1080">1920x1080 (HD)</MenuItem>
                              <MenuItem value="3840x2160">3840x2160 (4K)</MenuItem>
                              <MenuItem value="4096x2160">4096x2160 (4K Cinema)</MenuItem>
                              <MenuItem value="1280x720">1280x720 (HD Ready)</MenuItem>
                              <MenuItem value="Other">Other</MenuItem>
                            </Select>
                          </FormControl>
                        </Grid>
                      </Grid>
                    </ListItem>
                  ))}
                </List>
                
                <Button
                  startIcon={theming.getThemedIcon('add')}
                  onClick={handleAddCamera}
                  variant="outlined"
                  sx={{ mt:  2 }}
                >
                  Add Another Camera
                </Button>
              </Box>
            )}

            {/* Step 2: Project Info */}
            {activeStep === 1 && (
              <Box>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  Project Information
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb:  3 }}>
                  Basic information about your project.
                </Typography>
                
                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <TextField
                      label="Event Name"
                      value={projectInfo.event_name}
                      onChange={(e) => handleProjectInfoChange('event_name', e.target.value)}
                      placeholder="e.g., Sarah & John Wedding"
                      fullWidth
                      required
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      label="Client Name"
                      value={projectInfo.client_name}
                      onChange={(e) => handleProjectInfoChange('client_name', e.target.value)}
                      placeholder="e.g., Sarah & John"
                      fullWidth
                      required
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <FormControl fullWidth>
                      <InputLabel>Event Type</InputLabel>
                      <Select
                        value={projectInfo.event_type}
                        onChange={(e) => handleProjectInfoChange('event_type', e.target.value)}
                        label="Event Type"
                      >
                        <MenuItem value="wedding">Wedding</MenuItem>
                        <MenuItem value="corporate">Corporate</MenuItem>
                        <MenuItem value="music_video">Music Video</MenuItem>
                        <MenuItem value="documentary">Documentary</MenuItem>
                        <MenuItem value="event">Event</MenuItem>
                        <MenuItem value="other">Other</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      label="Project Date"
                      type="date"
                      value={projectInfo.date}
                      onChange={(e) => handleProjectInfoChange('date', e.target.value)}
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                      required
                    />
                  </Grid>
                </Grid>
              </Box>
            )}

            {/* Step 3: Create Project */}
            {activeStep === 2 && (
              <Box>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  Ready to Create Project
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb:  3 }}>
                  We'll create a complete DaVinci Resolve project with smart culling based on your project type: </Typography>
                
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Paper sx={{ p:  2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Camera Bins
                      </Typography>
                      {cameras.map((camera, index) => (
                        <Chip
                          key={index}
                          label={`Camera ${index + 1} - ${camera.name}`}
                          size="small"
                          sx={{ mr: 1, mb: 1 }}
                        />
                      ))}
                    </Paper>
                  </Grid>
                  <Grid item xs={12}>
                    <Paper sx={{ p:  2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Timelines Created
                      </Typography>
                      <List dense>
                        <ListItem>
                          <ListItemIcon>
                            <Movie />
                          </ListItemIcon>
                          <ListItemText primary="Main Film" secondary="1920x1080 @ 25fps" />
                        </ListItem>
                        <ListItem>
                          <ListItemIcon>
                            {theming.getThemedIcon('videoLibrary')}
                          </ListItemIcon>
                          <ListItemText primary="Highlight Reel" secondary="1920x1080 @ 25fps" />
                        </ListItem>
                        <ListItem>
                          <ListItemIcon>
                            {theming.getThemedIcon('share')}
                          </ListItemIcon>
                          <ListItemText primary="Social Media" secondary="1080x1080 @ 25fps" />
                        </ListItem>
                        <ListItem>
                          <ListItemIcon>
                            {theming.getThemedIcon('download')}
                          </ListItemIcon>
                          <ListItemText primary="Export Master" secondary="1920x1080 @ 25fps" />
                        </ListItem>
                      </List>
                    </Paper>
                  </Grid>
                  
                  {/* Smart Culling Preview */}
                  <Grid item xs={12}>
                    <Paper sx={{ p: 2, backgroundColor: 'primary.50'}}>
                      <Typography variant="subtitle2" gutterBottom color="primary">
                        🎯 Smart Culling Preview - {projectInfo.event_type.charAt(0).toUpperCase() + projectInfo.event_type.slice(1)} Project
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                        When you import footage, it will be automatically organized into these categories: </Typography>
                      
                      {projectInfo.event_type === 'wedding' && (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap:  1 }}>
                          {['Ceremony','Reception','Preparation','Details','Couple Shots','Group Photos','Getting Ready','Speeches','Dancing','Exit'].map((category, index) => (
                            <Chip
                              key={index}
                              label={category}
                              size="small"
                              variant="outlined"
                              color="primary"
                            />
                          ))}
                        </Box>
                      )}
                      
                      {projectInfo.event_type === 'corporate' && (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap:  1 }}>
                          {[
                            'Interviews',
                            'B-Roll',
                            'Graphics & Branding',
                            'Logo & Assets',
                            'Audio & Music',
                            'Corporate Voice',
                            'Testimonials',
                            'Product Shots',
                            'Office & Environment',
                          ].map((category, index) => (
                            <Chip
                              key={index}
                              label={category}
                              size="small"
                              variant="outlined"
                              color="primary"
                            />
                          ))}
                        </Box>
                      )}
                      
                      {projectInfo.event_type === 'music_video' && (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap:  1 }}>
                          {['Master Audio','Stems & Tracks','Performance','Concept Shots','Location Footage','Close-ups', 'Wide Shots', 'Special Effects','Graphics & Text'].map((category, index) => (
                            <Chip
                              key={index}
                              label={category}
                              size="small"
                              variant="outlined"
                              color="primary"
                            />
                          ))}
                        </Box>
                      )}
                      
                      {projectInfo.event_type === 'documentary' && (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap:  1 }}>
                          {['Interviews', 'Archival Footage', 'B-Roll', 'Photos & Stills', 'Audio & Narration', 'Music & Sound Design', 'Graphics & Titles','Reenactments','Locations'].map((category, index) => (
                            <Chip
                              key={index}
                              label={category}
                              size="small"
                              variant="outlined"
                              color="primary"
                            />
                          ))}
                        </Box>
                      )}
                      
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block'}}>
                        * Smart culling analyzes video content (duration, faces, motion, lighting) to automatically categorize your footage
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Navigation Buttons */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt:  3 }}>
          <Button
            disabled={activeStep === 0}
            onClick={handleBack}
          >
            Back
          </Button>
          
          <Box>
            {activeStep < steps.length - 1 ? (
              <Button variant="contained"
                onClick={handleNext}
                disabled={
                  (activeStep === 0 && cameras.some((c) => !c.name)) ||
                  (activeStep === 1 && (!projectInfo.event_name || !projectInfo.client_name))
              }
                sx={theming.getThemedButtonSx()}
              >
                Next
              </Button>
            ) : (
              <Button variant="contained"
                startIcon={createProject.isPending ? theming.getThemedIcon('play') : theming.getThemedIcon('autoFixHigh')}
                onClick={handleCreateProject}
                disabled={createProject.isPending}
                sx={{
                  ...theming.getThemedButtonSx(),
                  background: 'linear-gradient(45deg, #10b981, #059669)',
                  '&:hover': {
                    background: 'linear-gradient(45deg, #059669, #047857)',
                  },
                }}
              >
                {createProject.isPending ? 'Creating Project...' : 'Create DaVinci Resolve Project'}
              </Button>
            )}
          </Box>
        </Box>
      </Box>

      {/* Error Handling */}
      {createProject.isError && (
        <Alert 
          severity="error" 
          sx={{ m:  2 }}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => createProject.reset()}
            >
              Dismiss
            </Button>
        }
        >
          {createProject.error?.message ||'Failed to create project'}
        </Alert>
      )}
    </Box>
  );
}
