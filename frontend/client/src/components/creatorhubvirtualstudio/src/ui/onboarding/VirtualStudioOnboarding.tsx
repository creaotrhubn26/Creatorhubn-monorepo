import React, { useState, useEffect } from 'react';
import { logger } from '../../core/services/logger';

const log = logger.module('Onboarding, ');
import {
  Box,
  Dialog,
  DialogContent,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Button,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  LinearProgress,
  Alert,
  Checkbox,
  FormControlLabel,
  Divider,
  Tabs,
  Tab,
  Card,
  CardContent,
  Avatar,
  Chip,
  Grid,
  CardActionArea,
  Stack,
  Badge,
  CircularProgress,
} from '@mui/material';
import {
  Folder,
  CheckCircle,
  Videocam,
  Camera,
  Animation,
  CloudUpload,
  Settings,
  PlayArrow,
  TrendingUp,
  Speed as Speed,
  AttachMoney,
  Face,
  School,
  Checkroom,
  Campaign,
  Inventory2,
  Restaurant,
  Home,
  SportsScore,
  Celebration,
  ChildCare,
  Favorite,
  Palette,
  Movie,
  Tv,
  Article,
  MusicNote,
  Business,
  Share,
  FlightTakeoff,
  AutoAwesome,
  ArrowForward,
  Star,
} from '@mui/icons-material';
import { brandColors } from '../../assets/brandkit';
import {
  ProfessionType,
  Specialization,
  PHOTOGRAPHER_SPECIALIZATIONS,
  VIDEOGRAPHER_SPECIALIZATIONS,
  ENVIRONMENTS,
  getSpecializationById,
  getEnvironmentById,
} from '../../core/data/professionTypes';

interface OnboardingStep {
  label: string;
  description: string;
  content: React.ReactNode;
}

interface VirtualStudioOnboardingProps {
  open: boolean;
  onComplete: (config: OnboardingConfig) => void;
  onSkip: () => void;
  backendAPI?: {
    post: (url: string, data: unknown) => Promise<any>;
  };
}

export interface OnboardingConfig {
  profession: ProfessionType | null;
  specialization: string | null;
  environment: string | null;
  preferences: {
    autoSave: boolean;
    cloudSync: boolean;
    analytics: boolean;
  };
}

// Icon mapping for specializations
const ICON_MAP: Record<string, React.ReactNode> = {
  Face: <Face />,
  School: <School />,
  Checkroom: <Checkroom />,
  Campaign: <Campaign />,
  Inventory2: <Inventory2 />,
  Restaurant: <Restaurant />,
  Home: <Home />,
  SportsScore: <SportsScore />,
  Celebration: <Celebration />,
  ChildCare: <ChildCare />,
  Favorite: <Favorite />,
  Palette: <Palette />,
  Movie: <Movie />,
  Tv: <Tv />,
  Article: <Article />,
  MusicNote: <MusicNote />,
  Business: <Business />,
  Share: <Share />,
  FlightTakeoff: <FlightTakeoff />,
  AutoAwesome: <AutoAwesome />,
  Livestream: <Videocam />,
};

export const VirtualStudioOnboarding: React.FC<VirtualStudioOnboardingProps> = ({
  open,
  onComplete,
  onSkip,
  backendAPI,
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [folderCreationStatus, setFolderCreationStatus] = useState<{
    inProgress: boolean;
    completed: boolean;
    error: string | null;
    foldersCreated: string[];
  }>({
    inProgress: false,
    completed: false,
    error: null,
    foldersCreated: [],
  });
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [selectedFeatures, setSelectedFeatures] = useState({
    autoSave: true,
    cloudSync: true,
    analytics: true,
  });
  const [selectedProfession, setSelectedProfession] = useState<ProfessionType | null>(null);
  const [selectedSpecialization, setSelectedSpecialization] = useState<string | null>(null);
  const [workerInitStatus, setWorkerInitStatus] = useState<{
    inProgress: boolean;
    completed: boolean;
    error: string | null;
    progress: number;
    workers: Record<string, { ready: boolean; message: string }>;
  }>({
    inProgress: false,
    completed: false,
    error: null,
    progress: 0,
    workers: {},
  });

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const createGoogleDriveFolders = async () => {
    setFolderCreationStatus({
      inProgress: true,
      completed: false,
      error: null,
      foldersCreated: [],
    });

    try {
      const folders = [
        'CreatorHub/Virtual_Studio','CreatorHub/Virtual_Studio/Projects','CreatorHub/Virtual_Studio/Camera_Paths','CreatorHub/Virtual_Studio/Exports','CreatorHub/Virtual_Studio/Assets','CreatorHub/Virtual_Studio/Templates',
      ];

      const createdFolders: string[] = [];

      for (const folder of folders) {
        // Simulate folder creation with progress
        await new Promise((resolve) => setTimeout(resolve, 500));

        if (backendAPI) {
          try {
            await backendAPI.post('/api/virtual-studio/setup/folders,', {
              folderPath: folder,
            });
            createdFolders.push(folder);
            setFolderCreationStatus((prev) => ({
              ...prev,
              foldersCreated: [...createdFolders],
            }));
          } catch (error) {
            log.warn(`Failed to create folder ${folder}:`, error);
            // Continue with other folders
          }
        } else {
          // Mock mode - just add to list
          createdFolders.push(folder);
          setFolderCreationStatus((prev) => ({
            ...prev,
            foldersCreated: [...createdFolders],
          }));
        }
      }

      setFolderCreationStatus({
        inProgress: false,
        completed: true,
        error: null,
        foldersCreated: createdFolders,
      });

      // Auto-advance to next step
      setTimeout(() => {
        handleNext();
      }, 1000);
    } catch (error) {
      setFolderCreationStatus({
        inProgress: false,
        completed: false,
        error: error instanceof Error ? error.message : 'Failed to create folders',
        foldersCreated: [],
      });
    }
  };

  const initializeWorkers = async () => {
    setWorkerInitStatus({
      inProgress: true,
      completed: false,
      error: null,
      progress: 0,
      workers: {},
    });

    try {
      // Call initialization endpoint
      if (backendAPI) {
        await backendAPI.post('/api/workers/initialize,', {});
      }

      // Poll status endpoint to get progress
      const checkStatus = async (): Promise<void> => {
        try {
          const response = await fetch('/api/workers/status, ', { credentials: 'include' });
          const data = await response.json();

          const allWorkers = {
            ...(data.workers?.onDemand || {}),
            ...(data.workers?.continuous || {}),
          };

          // Calculate progress (simple: count ready workers / total)
          const totalWorkers = Object.keys(allWorkers).length;
          const readyWorkers = Object.values(allWorkers).filter(
            (w: any) => w.ready || w.status === 'running'
          ).length;
          const progress = totalWorkers > 0 ? Math.round((readyWorkers / totalWorkers) * 100) : 0;

          setWorkerInitStatus((prev) => ({
            ...prev,
            progress,
            workers: allWorkers,
          }));

          // If all ready or progress is high enough, mark as complete
          if (data.status === 'ready' || progress >= 80) {
            setWorkerInitStatus((prev) => ({
              ...prev,
              inProgress: false,
              completed: true,
              progress: 100,
            }));
            // Auto-advance after a moment
            setTimeout(() => {
              handleComplete();
            }, 1000);
          } else if (progress < 100) {
            // Continue polling
            setTimeout(checkStatus, 1000);
          }
        } catch (error) {
          log.warn('Error checking worker status: ', error);
          // Continue anyway - workers will initialize on first use
          setWorkerInitStatus((prev) => ({
            ...prev,
            inProgress: false,
            completed: true,
            progress: 100,
          }));
          setTimeout(() => {
            handleComplete();
          }, 500);
        }
      };

      // Start checking status
      await checkStatus();
    } catch (error) {
      log.warn('Error initializing workers:', error);
      // Don't block onboarding - workers will initialize on first use
      setWorkerInitStatus((prev) => ({
        ...prev,
        inProgress: false,
        completed: true,
        error: null, // Don't show error to user
        progress: 100,
      }));
      setTimeout(() => {
        handleComplete();
      }, 500);
    }
  };

  const handleComplete = () => {
    // Get the environment for the selected specialization
    const spec = selectedProfession && selectedSpecialization 
      ? getSpecializationById(selectedSpecialization, selectedProfession)
      : null;
    const environmentId = spec?.defaultEnvironment || 'studio_portrait';

    const config: OnboardingConfig = {
      profession: selectedProfession,
      specialization: selectedSpecialization,
      environment: environmentId,
      preferences: {
        autoSave: selectedFeatures.autoSave,
        cloudSync: selectedFeatures.cloudSync,
        analytics: selectedFeatures.analytics,
      },
    };

    // Save onboarding completion to localStorage
    localStorage.setItem('virtualStudio_onboardingCompleted','true');
    localStorage.setItem(
      'virtualStudio_preferences',
      JSON.stringify({
        ...config,
        completedAt: new Date().toISOString(),
      }),
    );
    onComplete(config);
  };

  // Get specializations based on selected profession
  const specializations = selectedProfession === 'photographer' 
    ? PHOTOGRAPHER_SPECIALIZATIONS 
    : selectedProfession === 'videographer'
    ? VIDEOGRAPHER_SPECIALIZATIONS
    : [];

  // Get selected specialization details
  const selectedSpecDetails = selectedProfession && selectedSpecialization
    ? getSpecializationById(selectedSpecialization, selectedProfession)
    : null;

  // Get environment preview for selected specialization
  const selectedEnvironment = selectedSpecDetails?.defaultEnvironment
    ? getEnvironmentById(selectedSpecDetails.defaultEnvironment)
    : null;

  const steps: OnboardingStep[] = [
    {
      label: 'Choose Your Profession',
      description: 'Are you a photographer or videographer?',
      content: (
        <Box>
          <Typography variant="h5" gutterBottom fontWeight={700}>
            Welcome to Virtual Studio
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Let's personalize your experience. What type of creative professional are you?
          </Typography>

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card 
                sx={{ 
                  height: '100%',
                  border: selectedProfession === 'photographer' ? '3px solid' : '1px solid',
                  borderColor: selectedProfession === 'photographer' ? 'primary.main' : 'divider',
                  transition: 'all 0.3s ease', '&:hover': { 
                    transform: 'translateY(-4px)',
                    boxShadow: 4,
                  }}}
              >
                <CardActionArea 
                  onClick={() => {
                    setSelectedProfession('photographer');
                    setSelectedSpecialization(null);
                  }}
                  sx={{ height: '100%', p: 3 }}
                >
                  <Box sx={{ textAlign: 'center' }}>
                    <Camera sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
                    <Typography variant="h5" fontWeight={700} gutterBottom>
                      Photographer
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Still images, portraits, products, events, and more
                    </Typography>
                    {selectedProfession === 'photographer' && (
                      <Chip 
                        icon={<CheckCircle />} 
                        label="Selected" 
                        color="primary" 
                        sx={{ mt: 2 }}
                      />
                    )}
                  </Box>
                </CardActionArea>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card 
                sx={{ 
                  height: '100%',
                  border: selectedProfession === 'videographer' ? '3px solid' : '1px solid',
                  borderColor: selectedProfession === 'videographer' ? 'primary.main' : 'divider',
                  transition: 'all 0.3s ease','&:hover': { 
                    transform: 'translateY(-4px)',
                    boxShadow: 4,
                  }}}
              >
                <CardActionArea 
                  onClick={() => {
                    setSelectedProfession('videographer');
                    setSelectedSpecialization(null);
                  }}
                  sx={{ height: '100%', p: 3 }}
                >
                  <Box sx={{ textAlign: 'center' }}>
                    <Videocam sx={{ fontSize: 64, color: 'secondary.main', mb: 2 }} />
                    <Typography variant="h5" fontWeight={700} gutterBottom>
                      Videographer
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Films, commercials, documentaries, and video content
                    </Typography>
                    {selectedProfession === 'videographer' && (
                      <Chip 
                        icon={<CheckCircle />} 
                        label="Selected" 
                        color="primary" 
                        sx={{ mt: 2 }}
                      />
                    )}
                  </Box>
                </CardActionArea>
              </Card>
            </Grid>
          </Grid>
        </Box>
      ),
    },
    {
      label: 'Choose Your Specialization',
      description: 'What type of work do you focus on?',
      content: (
        <Box>
          <Typography variant="h5" gutterBottom fontWeight={700}>
            {selectedProfession === 'photographer' ? 'Photography' : 'Videography'} Specialization
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Select your primary focus. This will customize your workspace with relevant templates, 
            equipment, and workflows.
          </Typography>

          <Grid container spacing={2} sx={{ maxHeight: 400, overflowY: 'auto', pb: 2 }}>
            {specializations.map((spec) => (
              <Grid item xs={12} sm={6} md={4} key={spec.id}>
                <Card 
                  sx={{ 
                    border: selectedSpecialization === spec.id ? '2px solid' : '1px solid',
                    borderColor: selectedSpecialization === spec.id ? 'primary.main' : 'divider',
                    bgcolor: selectedSpecialization === spec.id ? 'action.selected' : 'background.paper',
                    transition: 'all 0.2s ease','&:hover': { borderColor: 'primary.light' }}}
                >
                  <CardActionArea 
                    onClick={() => setSelectedSpecialization(spec.id)}
                    sx={{ p: 2 }}
                  >
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Box sx={{ 
                        p: 1.5, 
                        borderRadius: 2, 
                        bgcolor: selectedSpecialization === spec.id ? 'primary.main' : 'action.hover',
                        color: selectedSpecialization === spec.id ? 'white' : 'text.primary'}}>
                        {ICON_MAP[spec.icon] || <Star />}
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle1" fontWeight={600}>
                          {spec.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          {spec.description}
                        </Typography>
                      </Box>
                      {selectedSpecialization === spec.id && (
                        <CheckCircle color="primary" />
                      )}
                    </Stack>
                  </CardActionArea>
                </Card>
              </Grid>
            ))}
          </Grid>

          {selectedSpecDetails && (
            <Card sx={{ mt: 3, bgcolor: brandColors.alpha.light }}>
              <CardContent>
                <Typography variant="h6" gutterBottom fontWeight={700}>
                  Your Environment: {selectedEnvironment?.name || 'Custom Studio'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {selectedEnvironment?.description || selectedSpecDetails.description}
                </Typography>
                
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Default Templates
                    </Typography>
                    <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 0.5 }}>
                      {selectedSpecDetails.defaultTemplates.slice(0, 3).map((t) => (
                        <Chip key={t} label={t.replace(/_/g, ' ')} size="small" variant="outlined" />
                      ))}
                    </Stack>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Recommended Equipment
                    </Typography>
                    <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 0.5 }}>
                      {selectedSpecDetails.recommendedEquipment.slice(0, 2).map((e) => (
                        <Chip key={e} label={e.replace(/_/g, '')} size="small" variant="outlined" />
                      ))}
                    </Stack>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          )}
        </Box>
      ),
    },
    {
      label: 'Welcome to Virtual Studio',
      description: 'Professional virtual production environment',
      content: (
        <Box>
          <Typography variant="h6" gutterBottom>
            🎬 Welcome to CreatorHub Virtual Studio
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            A powerful virtual production environment for photographers and videographers. Virtual
            Studio lets you:{' '}
          </Typography>
          <List dense>
            <ListItem>
              <ListItemIcon>
                <Camera color="primary" />
              </ListItemIcon>
              <ListItemText
                primary="Virtual Camera Control"
                secondary="Professional camera movements and path recording"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <Animation color="primary" />
              </ListItemIcon>
              <ListItemText
                primary="Timeline Animation"
                secondary="Keyframe-based animation with curve editor"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <Videocam color="primary" />
              </ListItemIcon>
              <ListItemText
                primary="Real-time Rendering"
                secondary="GPU-accelerated rendering with LUT color grading"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <CloudUpload color="primary" />
              </ListItemIcon>
              <ListItemText
                primary="Cloud Sync"
                secondary="Automatic project backup to Google Drive"
              />
            </ListItem>
          </List>
          <Divider sx={{ my: 2 }} />
          <FormControlLabel
            control={
              <Checkbox
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
              />
            }
            label={
              <Typography variant="body2">
                I understand this is a professional tool and agree to save my work regularly
              </Typography>
            }
          />
        </Box>
      ),
    },
    {
      label: 'Setup Google Drive Storage',
      description: 'Create workspace folders automatically',
      content: (
        <Box>
          <Typography variant="h6" gutterBottom>
            📁 Setting up your workspace
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            We'll create the following folder structure in your Google Drive to keep your projects
            organized:{' '}
          </Typography>

          {!folderCreationStatus.inProgress && !folderCreationStatus.completed && (
            <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'background.default' }}>
              <List dense>
                <ListItem>
                  <ListItemIcon>
                    <Folder />
                  </ListItemIcon>
                  <ListItemText
                    primary="CreatorHub/Virtual_Studio/Projects"
                    secondary="Your virtual studio projects"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <Folder />
                  </ListItemIcon>
                  <ListItemText
                    primary="CreatorHub/Virtual_Studio/Camera_Paths"
                    secondary="Saved camera animations"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <Folder />
                  </ListItemIcon>
                  <ListItemText
                    primary="CreatorHub/Virtual_Studio/Exports"
                    secondary="Rendered videos and images"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <Folder />
                  </ListItemIcon>
                  <ListItemText
                    primary="CreatorHub/Virtual_Studio/Assets"
                    secondary="3D models, HDRIs, and textures"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <Folder />
                  </ListItemIcon>
                  <ListItemText
                    primary="CreatorHub/Virtual_Studio/Templates"
                    secondary="Reusable project templates"
                  />
                </ListItem>
              </List>
            </Paper>
          )}

          {folderCreationStatus.inProgress && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" gutterBottom>
                Creating folders... ({folderCreationStatus.foldersCreated.length}/6)
              </Typography>
              <LinearProgress />
              <List dense sx={{ mt: 1 }}>
                {folderCreationStatus.foldersCreated.map((folder) => (
                  <ListItem key={folder}>
                    <ListItemIcon>
                      <CheckCircle color="success" fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary={folder} primaryTypographyProps={{ variant: 'body2' }} />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}

          {folderCreationStatus.completed && (
            <Alert severity="success" sx={{ mb: 2 }}>
              ✅ Successfully created {folderCreationStatus.foldersCreated.length} folders in your
              Google Drive!
            </Alert>
          )}

          {folderCreationStatus.error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {folderCreationStatus.error}
            </Alert>
          )}

          {!folderCreationStatus.completed && (
            <Button
              variant="contained"
              onClick={createGoogleDriveFolders}
              disabled={folderCreationStatus.inProgress}
              startIcon={<CloudUpload />}
              fullWidth
            >
              {folderCreationStatus.inProgress ? 'Creating Folders...' : 'Create Folders Now'}
            </Button>
          )}
        </Box>
      ),
    },
    {
      label: 'Configure Preferences',
      description: 'Customize your experience',
      content: (
        <Box>
          <Typography variant="h6" gutterBottom>
            ⚙️ Preferences
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Configure how Virtual Studio works for you:{''}
          </Typography>
          <List>
            <ListItem>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={selectedFeatures.autoSave}
                    onChange={(e) =>
                      setSelectedFeatures({ ...selectedFeatures, autoSave: e.target.checked })
                    }
                  />
                }
                label={
                  <Box>
                    <Typography variant="body1">Auto-save projects</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Automatically save your work every 30 seconds (recommended)
                    </Typography>
                  </Box>
                }
              />
            </ListItem>
            <ListItem>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={selectedFeatures.cloudSync}
                    onChange={(e) =>
                      setSelectedFeatures({ ...selectedFeatures, cloudSync: e.target.checked })
                    }
                  />
                }
                label={
                  <Box>
                    <Typography variant="body1">Cloud sync</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Sync projects to Google Drive automatically
                    </Typography>
                  </Box>
                }
              />
            </ListItem>
            <ListItem>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={selectedFeatures.analytics}
                    onChange={(e) =>
                      setSelectedFeatures({ ...selectedFeatures, analytics: e.target.checked })
                    }
                  />
                }
                label={
                  <Box>
                    <Typography variant="body1">Usage analytics</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Help us improve with anonymous usage data
                    </Typography>
                  </Box>
                }
              />
            </ListItem>
          </List>
        </Box>
      ),
    },
    {
      label: 'Preparing AI Features',
      description: 'Setting up intelligent tools to help you create amazing work',
      content: (
        <Box>
          <Typography variant="h6" gutterBottom fontWeight={700}>
            🚀 Preparing Your Creative Tools
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            We're getting everything ready so you can start creating right away. This will only take a moment.
          </Typography>

          {!workerInitStatus.inProgress && !workerInitStatus.completed && (
            <Button
              variant="contained"
              onClick={initializeWorkers}
              fullWidth
              startIcon={<AutoAwesome />}
              sx={{ mb: 2 }}
            >
              Prepare Features
            </Button>
          )}

          {workerInitStatus.inProgress && (
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2">
                  {workerInitStatus.progress < 30
                    ? 'Getting everything ready...'
                    : workerInitStatus.progress < 70
                    ? 'Almost there...'
                    : workerInitStatus.progress < 90
                    ? 'Final touches...'
                    : 'All set!'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {workerInitStatus.progress}%
                </Typography>
              </Box>
              <LinearProgress variant="determinate" value={workerInitStatus.progress} sx={{ mb: 3 }} />

              <Grid container spacing={2}>
                {Object.entries(workerInitStatus.workers).slice(0, 6).map(([key, worker]: [string, any]) => (
                  <Grid item xs={12} sm={6} key={key}>
                    <Card
                      variant="outlined"
                      sx={{
                        p: 1.5,
                        bgcolor: worker.ready || worker.status === 'running' ? 'success.light' : 'action.hover',
                        transition: 'all 0.3s ease'}}
                    >
                      <Stack direction="row" spacing={1} alignItems="center">
                        {worker.ready || worker.status === 'running' ? (
                          <CheckCircle color="success" fontSize="small" />
                        ) : (
                          <CircularProgress size={16} />
                        )}
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body2" fontWeight={600}>
                            {worker.friendlyName || key}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {worker.message || worker.description || 'Preparing...'}
                          </Typography>
                        </Box>
                      </Stack>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}

          {workerInitStatus.completed && (
            <Alert severity="success" sx={{ mb: 2 }}>
              ✅ All features are ready! You're all set to start creating.
            </Alert>
          )}

          {workerInitStatus.error && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Some features need a moment to load - you can continue and they'll be ready shortly.
            </Alert>
          )}

          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2 }}>
            💡 Tip: You can skip this step and features will be ready when you first use them.
          </Typography>
        </Box>
      ),
    },
    {
      label: 'Ready to Create',
      description: 'Start your first project',
      content: (
        <Box sx={{ textAlign: 'center' }}>
          <PlayArrow sx={{ fontSize: 80, color: 'primary.main', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            🎉 You're all set!
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Your Virtual Studio is ready. Here are some quick tips to get started:{', '}
          </Typography>
          <Paper variant="outlined" sx={{ p: 2, textAlign: 'left', mb: 2 }}>
            <List dense>
              <ListItem>
                <ListItemText
                  primary="💾 Save Early, Save Often"
                  secondary="Use Ctrl+S or click Save Project in the toolbar"
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="🎥 Camera Controls"
                  secondary="Left panel → Camera to adjust position and settings"
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="⏱️ Timeline"
                  secondary="Bottom panel to create keyframe animations"
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="🎨 Color Grading"
                  secondary="Access 627 professional LUTs in the Color tab"
                />
              </ListItem>
            </List>
          </Paper>
        </Box>
      ),
    },
  ];

  return (
    <Dialog open={open} maxWidth="md" fullWidth PaperProps={{ sx: {} }}>
      <DialogContent>
        <Stepper activeStep={activeStep} orientation="vertical">
          {steps.map((step, index) => (
            <Step key={step.label}>
              <StepLabel
                optional={
                  index === steps.length - 1 ? (
                    <Typography variant="caption">Last step</Typography>
                  ) : null
                }
              >
                {step.label}
              </StepLabel>
              <StepContent>
                <Typography variant="caption" color="text.secondary" display="block" mb={2}>
                  {step.description}
                </Typography>
                {step.content}
                <Box sx={{ mb: 2, mt: 3 }}>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      variant="contained"
                      onClick={index === steps.length - 1 ? handleComplete : handleNext}
                      endIcon={index < steps.length - 1 ? <ArrowForward /> : undefined}
                      disabled={
                        (index === 0 && !selectedProfession) ||
                        (index === 1 && !selectedSpecialization) ||
                        (index === 2 && !agreedToTerms) ||
                        (index === 3 &&
                          !folderCreationStatus.completed &&
                          !folderCreationStatus.inProgress) ||
                        (index === 5 && workerInitStatus.inProgress)
                      }
                    >
                      {index === steps.length - 1 ? 'Get Started': 'Continue'}
                    </Button>
                    {index > 0 && (
                      <Button onClick={handleBack} disabled={folderCreationStatus.inProgress}>
                        Back
                      </Button>
                    )}
                    {index === 0 && (
                      <Button onClick={onSkip} color="inherit">
                        Skip Onboarding
                      </Button>
                    )}
                  </Box>
                </Box>
              </StepContent>
            </Step>
          ))}
        </Stepper>
      </DialogContent>
    </Dialog>
  );
};
