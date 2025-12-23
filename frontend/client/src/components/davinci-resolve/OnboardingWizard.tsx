/**
 * OnboardingWizard.tsx - Personalized onboarding flow for DaVinci Resolve Script Manager
 * 
 * Features:
 * - Visual camera brand selection with logos
 * - Category selection with icons
 * - Preference persistence (localStorage)
 * - Skip option for advanced users
 * - Smart filtering based on selections
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Stepper,
  Step,
  StepLabel,
  Chip,
  Stack,
  Divider,
} from '@mui/material';
import {
  CheckCircle,
  ArrowForward,
  ArrowBack,
  Close,
  Favorite,
  Movie,
  VideoLibrary,
  Business,
  Tv,
  Description,
  MusicVideo,
  Home,
  FlightTakeoff,
  SportsBasketball,
  Event,
  School,
  Celebration,
  Landscape,
  Pets,
  Restaurant,
  DirectionsCar,
  Checkroom,
  TheaterComedy,
} from '@mui/icons-material';
import { DAVINCI_COLORS } from '../../assets/davinci-resolve-logo';
import { getCameraLogo } from '../../assets/camera-logos';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import PresetWorkflows from './PresetWorkflows';
import type { Camera } from '@/../../shared/camera-database-schema';

// Camera brands with metadata (expanded to 15 brands)
const CAMERA_BRANDS = [
  {
    id: 'sony',
    name: 'Sony',
    profiles: ['S-Log2','S-Log3'],
    models: 'A7S III, FX3, FX6, FX9, Venice',
    color: '#000000',
    popular: true,
  },
  {
    id: 'canon',
    name: 'Canon',
    profiles: ['C-Log2','C-Log3'],
    models: 'C70, C200, C300, C500, R5C',
    color: '#CC0000',
    popular: true,
  },
  {
    id: 'red',
    name: 'RED',
    profiles: ['Log3G10'],
    models: 'Komodo, V-Raptor, Monstro',
    color: '#CC0000',
    popular: true,
  },
  {
    id: 'arri',
    name: 'ARRI',
    profiles: ['LogC'],
    models: 'Alexa, Alexa Mini, Alexa LF',
    color: '#0066CC',
    popular: true,
  },
  {
    id: 'blackmagic',
    name: 'Blackmagic',
    profiles: ['Blackmagic Film'],
    models: 'Pocket 4K/6K, URSA Mini Pro 12K',
    color: '#000000',
    popular: true,
  },
  {
    id: 'panasonic',
    name: 'Panasonic',
    profiles: ['V-Log'],
    models: 'GH5, GH6, S1H, S5 II',
    color: '#0033A0',
    popular: false,
  },
  {
    id: 'fujifilm',
    name: 'Fujifilm',
    profiles: ['F-Log','F-Log2'],
    models: 'X-T4, X-H2S, GFX100 II',
    color: '#E60012',
    popular: false,
  },
  {
    id: 'nikon',
    name: 'Nikon',
    profiles: ['N-Log'],
    models: 'Z9, Z8, Z6 III',
    color: '#FFD700',
    popular: false,
  },
  {
    id: 'dji',
    name: 'DJI',
    profiles: ['D-Log','D-Log M'],
    models: 'Mavic 3, Inspire 3, Air 3',
    color: '#000000',
    popular: false,
  },
  {
    id: 'olympus',
    name: 'Olympus/OM System',
    profiles: ['OM-Log'],
    models: 'OM-1, E-M1 Mark III',
    color: '#0066CC',
    popular: false,
  },
  {
    id: 'leica',
    name: 'Leica',
    profiles: ['L-Log'],
    models: 'SL2-S, SL3',
    color: '#DC0000',
    popular: false,
  },
  {
    id: 'sigma',
    name: 'Sigma',
    profiles: ['Sigma Log'],
    models: 'fp, fp L',
    color: '#000000',
    popular: false,
  },
  {
    id: 'gopro',
    name: 'GoPro',
    profiles: ['Flat','GP-Log'],
    models: 'Hero 12, Hero 11',
    color: '#00A8E1',
    popular: false,
  },
  {
    id: 'insta360',
    name: 'Insta360',
    profiles: ['Flat','Log'],
    models: 'X3, One RS',
    color: '#000000',
    popular: false,
  },
  {
    id: 'zcam',
    name: 'Z CAM',
    profiles: ['Z-Log2'],
    models: 'E2, E2-M4, E2-F6',
    color: '#FF6600',
    popular: false,
  },
];

// Categories with Material UI icons and descriptions (expanded to 18 categories)
const CATEGORIES = [
  { id: 'wedding', name: 'Wedding', Icon: Favorite, description: 'Ceremonies, receptions, cultural weddings' },
  { id: 'film', name: 'Film & Cinema', Icon: Movie, description: 'Feature films, short films, dailies' },
  { id: 'youtube', name: 'YouTube & Social', Icon: VideoLibrary, description: 'Vlogs, tutorials, social media' },
  { id: 'corporate', name: 'Corporate', Icon: Business, description: 'Training, branding, presentations' },
  { id: 'commercial', name: 'Commercial', Icon: Tv, description: 'Ads, promotional content' },
  { id: 'documentary', name: 'Documentary', Icon: Description, description: 'Interviews, storytelling, B-roll' },
  { id: 'music-video', name: 'Music Video', Icon: MusicVideo, description: 'Music videos, creative effects' },
  { id: 'real-estate', name: 'Real Estate', Icon: Home, description: 'Property tours, marketing' },
  { id: 'drone', name: 'Drone & Aerial', Icon: FlightTakeoff, description: 'Aerial cinematography' },
  { id: 'sports', name: 'Sports & Action', Icon: SportsBasketball, description: 'Sports coverage, slow motion' },
  { id: 'event', name: 'Event', Icon: Event, description: 'Conferences, concerts, events' },
  { id: 'education', name: 'Education', Icon: School, description: 'Online courses, tutorials, training' },
  { id: 'party', name: 'Party & Celebration', Icon: Celebration, description: 'Birthday parties, celebrations' },
  { id: 'travel', name: 'Travel & Tourism', Icon: Landscape, description: 'Travel vlogs, destination videos' },
  { id: 'pet', name: 'Pet & Animal', Icon: Pets, description: 'Pet videos, animal content' },
  { id: 'food', name: 'Food & Culinary', Icon: Restaurant, description: 'Cooking shows, food reviews' },
  { id: 'automotive', name: 'Automotive', Icon: DirectionsCar, description: 'Car reviews, racing, automotive' },
  { id: 'fashion', name: 'Fashion & Beauty', Icon: Checkroom, description: 'Fashion shows, beauty content' },
  { id: 'entertainment', name: 'Entertainment', Icon: TheaterComedy, description: 'Comedy, sketches, entertainment' },
];

// Experience levels
const EXPERIENCE_LEVELS = [
  {
    id: 'beginner',
    name: 'Beginner',
    description: 'New to DaVinci Resolve and color grading',
    features: ['Guided workflows','Basic scripts','Step-by-step tutorials']
  },
  {
    id: 'intermediate',
    name: 'Intermediate',
    description: 'Comfortable with basic editing and grading',
    features: ['Advanced scripts','Custom workflows','Optimization tips']
  },
  {
    id: 'advanced',
    name: 'Advanced',
    description: 'Professional colorist or experienced editor',
    features: ['Complex automation','API access','Custom integrations']
  },
];

interface OnboardingWizardProps {
  open: boolean;
  onComplete: (preferences: {
    cameras: string[];
    categories: string[];
    experienceLevel: string;
    primaryCamera?: string;
    primaryCategory?: string;
  }) => void;
  onSkip: () => void;
  userId?: string; // Add userId prop for database operations
}

export default function OnboardingWizard({ open, onComplete, onSkip, userId }: OnboardingWizardProps) {
  const queryClient = useQueryClient();
  const [activeStep, setActiveStep] = useState(0);
  const [selectedCameras, setSelectedCameras] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedExperience, setSelectedExperience] = useState<string | null>(null);

  const steps = ['Quick Start','Choose Your Cameras','Select Your Focus Areas','Experience Level','Get Started'];

  // Fetch cameras from database
  const { data: cameraDatabase = [], isLoading: camerasLoading } = useQuery<Camera[]>({
    queryKey: ['/api/cameras'],
    queryFn: async () => {
      const response = await apiRequest('/api/cameras?limit=100,');
      return response.data || [];
    },
    enabled: open, // Only fetch when wizard is open
  });

  // Fetch user's existing cameras
  const { data: userCamerasData } = useQuery({
    queryKey: ['/api/cameras/user', userId],
    queryFn: async () => {
      if (!userId) return { data: [] };
      const response = await apiRequest(`/api/cameras/user/${userId}`);
      return response;
    },
    enabled: open && !!userId,
  });

  // Save preferences to database
  const savePreferencesMutation = useMutation({
    mutationFn: async (preferences: {
      cameras: string[];
      categories: string[];
      experienceLevel: string;
      primaryCamera?: string;
      primaryCategory?: string;
    }) => {
      return apiRequest('/api/user-preferences', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({
          preferences: {
            davinciResolve: preferences,
          },
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-preferences'] });
    },
  });

  // Save user cameras to database
  const saveUserCamerasMutation = useMutation({
    mutationFn: async (cameraIds: string[]) => {
      if (!userId) return null;

      const cameras = cameraIds.map((cameraId, index) => ({
        cameraId,
        isPrimary: index === 0, // First camera is primary
      }));

      return apiRequest('/api/cameras/user', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({ cameras }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cameras/user', userId] });
    },
  });

  const handleNext = () => {
    if (activeStep === 0) {
      // From preset selection to camera selection
      setActiveStep(1);
    } else if (activeStep === 1 && selectedCameras.length > 0) {
      setActiveStep(2);
    } else if (activeStep === 2 && selectedCategories.length > 0) {
      setActiveStep(3);
    } else if (activeStep === 3 && selectedExperience) {
      setActiveStep(4);
    }
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  const handleCameraToggle = (cameraId: string) => {
    setSelectedCameras(prev =>
      prev.includes(cameraId)
        ? prev.filter(id => id !== cameraId)
        : [...prev, cameraId]
    );
  };

  const handleCategoryToggle = (categoryId: string) => {
    setSelectedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handlePresetSelect = (preset: {
    cameras: string[];
    categories: string[];
    experienceLevel: string;
  }) => {
    // Apply preset selections
    setSelectedCameras(preset.cameras);
    setSelectedCategories(preset.categories);
    setSelectedExperience(preset.experienceLevel);

    // Skip to summary step (step 4)
    setActiveStep(4);
  };

  const handleComplete = async () => {
    if (selectedCameras.length > 0 && selectedCategories.length > 0 && selectedExperience) {
      const preferences = {
        cameras: selectedCameras,
        categories: selectedCategories,
        experienceLevel: selectedExperience,
        primaryCamera: selectedCameras[0], // First selected is primary
        primaryCategory: selectedCategories[0], // First selected is primary
      };

      // Save to localStorage (fallback)
      localStorage.setItem('davinciPreferences', JSON.stringify({
        ...preferences,
        timestamp: new Date().toISOString(),
      }));

      // Save to database (preferences)
      savePreferencesMutation.mutate(preferences);

      // Save to user_cameras table (if userId is provided)
      if (userId) {
        saveUserCamerasMutation.mutate(selectedCameras);
      }

      onComplete(preferences);
    }
  };

  const handleSkip = () => {
    localStorage.setItem('davinciOnboardingSkipped','true');
    onSkip();
  };

  const selectedCamerasData = CAMERA_BRANDS.filter(c => selectedCameras.includes(c.id));
  const selectedCategoriesData = CATEGORIES.filter(c => selectedCategories.includes(c.id));
  const selectedExperienceData = EXPERIENCE_LEVELS.find(e => e.id === selectedExperience);

  return (
    <Dialog
      open={open}
      maxWidth="md"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: 2,
            minHeight: '600px',
          },
        }}}
    >
      <DialogContent sx={{ p: 4 }}>
        {/* Header */}
        <Box sx={{ mb: 4, textAlign: 'center' }}>
          <Typography variant="h4" sx={{ fontWeight: 70, mb: 1 }}>
            Welcome to DaVinci Resolve Scripts! 🎬
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Let's personalize your experience in just 2 steps
          </Typography>
        </Box>

        {/* Stepper */}
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {/* Step Content */}
        <Box sx={{ minHeight: '350px' }}>
          {/* Step 0: Preset Workflows (NEW) */}
          {activeStep === 0 && (
            <Box>
              <PresetWorkflows onSelectPreset={handlePresetSelect} />

              <Divider sx={{ my: 4 }}>
                <Chip label="OR" />
              </Divider>

              <Typography variant="h6" sx={{ mb: 2, textAlign: 'center' }}>
                Customize Manually
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
                Choose your own cameras, categories, and experience level
              </Typography>
            </Box>
          )}

          {/* Step 1: Camera Selection (Multi-select) */}
          {activeStep === 1 && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2, textAlign: 'center' }}>
                What cameras do you work with?
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1, textAlign: 'center' }}>
                Select all that apply - we'll optimize scripts for your cameras
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 3, textAlign: 'center', display: 'block' }}>
                {selectedCameras.length > 0 ? `${selectedCameras.length} selected` : 'Select at least one'}
              </Typography>

              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
                {CAMERA_BRANDS.map((camera) => {
                  const isSelected = selectedCameras.includes(camera.id);
                  const isPrimary = selectedCameras[0] === camera.id;

                  return (
                    <Card
                      key={camera.id}
                      sx={{
                        border: isSelected ? `3px solid ${DAVINCI_COLORS.primary}` : '1px solid #e0e0e0',
                        position: 'relative',
                        transition: 'all 0.2s','&:hover': {
                          transform: 'translateY(-4px)',
                          boxShadow: 3,
                        }}}
                    >
                      <CardActionArea onClick={() => handleCameraToggle(camera.id)} sx={{ p: 2 }}>
                        {isSelected && (
                          <CheckCircle
                            sx={{
                              position: 'absolute',
                              top: 8,
                              right: 8,
                              color: DAVINCI_COLORS.primary}}
                          />
                        )}
                        {isPrimary && (
                          <Chip
                            label="Primary"
                            size="small"
                            sx={{
                              position: 'absolute',
                              top: 8,
                              left: 8,
                              bgcolor: DAVINCI_COLORS.primary,
                              color: 'white',
                              fontSize: '0.65rem'}}
                          />
                        )}
                      <CardContent sx={{ p: 0 }}>
                        {/* Camera Logo */}
                        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                          {React.createElement(getCameraLogo(camera.id), {
                            sx: { fontSize: 60, color: camera.color },
                          })}
                        </Box>

                        <Typography variant="h6" sx={{ fontWeight: 70, mb: 0.5, textAlign: 'center' }}>
                          {camera.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, textAlign: 'center' }}>
                          {camera.profiles.join(', ')}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', textAlign: 'center', display: 'block' }}>
                          {camera.models}
                        </Typography>
                        {camera.popular && (
                          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
                            <Chip label="Popular" size="small" color="primary" />
                          </Box>
                        )}
                      </CardContent>
                    </CardActionArea>
                  </Card>
                  );
                })}
              </Box>
            </Box>
          )}

          {/* Step 2: Category Selection (Multi-select) */}
          {activeStep === 2 && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2, textAlign: 'center' }}>
                What types of content do you create?
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1, textAlign: 'center' }}>
                Select all that apply - we'll prioritize scripts for your production styles
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 3, textAlign: 'center', display: 'block' }}>
                {selectedCategories.length > 0 ? `${selectedCategories.length} selected` : 'Select at least one'}
              </Typography>

              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
                {CATEGORIES.map((category) => {
                  const isSelected = selectedCategories.includes(category.id);
                  const isPrimary = selectedCategories[0] === category.id;

                  return (
                    <Card
                      key={category.id}
                      sx={{
                        border: isSelected ? `3px solid ${DAVINCI_COLORS.primary}` : '1px solid #e0e0e0',
                        position: 'relative',
                        transition: 'all 0.2s','&:hover': {
                          transform: 'translateY(-4px)',
                          boxShadow: 3,
                        }}}
                    >
                      <CardActionArea onClick={() => handleCategoryToggle(category.id)} sx={{ p: 2 }}>
                        {isSelected && (
                          <CheckCircle
                            sx={{
                              position: 'absolute',
                              top: 8,
                              right: 8,
                              color: DAVINCI_COLORS.primary}}
                          />
                        )}
                        {isPrimary && (
                          <Chip
                            label="Primary"
                            size="small"
                            sx={{
                              position: 'absolute',
                              top: 8,
                              left: 8,
                              bgcolor: DAVINCI_COLORS.primary,
                              color: 'white',
                              fontSize: '0.65rem'}}
                          />
                        )}
                      <CardContent sx={{ p: 0 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
                          <category.Icon sx={{ fontSize: 48, color: DAVINCI_COLORS.primary }} />
                        </Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5, textAlign: 'center' }}>
                          {category.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', textAlign: 'center', display: 'block' }}>
                          {category.description}
                        </Typography>
                      </CardContent>
                    </CardActionArea>
                  </Card>
                  );
                })}
              </Box>
            </Box>
          )}

          {/* Step 3: Experience Level */}
          {activeStep === 3 && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2, textAlign: 'center' }}>
                What's your experience level?
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
                This helps us recommend the right scripts and workflows for you
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                  gap: 2}}
              >
                {EXPERIENCE_LEVELS.map((level) => (
                  <Card
                    key={level.id}
                    sx={{
                      border: selectedExperience === level.id ? `3px solid ${DAVINCI_COLORS.primary}` : '1px solid #e0e0e0',
                      position: 'relative',
                      transition: 'all 0.2s',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: 3,
                      }
                    }}
                  >
                    <CardActionArea onClick={() => setSelectedExperience(level.id)} sx={{ p: 3 }}>
                      {selectedExperience === level.id && (
                        <CheckCircle
                          sx={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            color: DAVINCI_COLORS.primary}}
                        />
                      )}
                      <CardContent sx={{ p: 0 }}>
                        <Typography variant="h6" sx={{ fontWeight: 70, mb: 1 }}>
                          {level.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          {level.description}
                        </Typography>
                        <Box component="ul" sx={{ pl: 2, m: 0 }}>
                          {level.features.map((feature, idx) => (
                            <Typography key={idx} component="li" variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>
                              {feature}
                            </Typography>
                          ))}
                        </Box>
                      </CardContent>
                    </CardActionArea>
                  </Card>
                ))}
              </Box>
            </Box>
          )}

          {/* Step 4: Summary */}
          {activeStep === 4 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CheckCircle sx={{ fontSize: 80, color: DAVINCI_COLORS.primary, mb: 3 }} />
              <Typography variant="h5" sx={{ fontWeight: 70, mb: 2 }}>
                You're All Set!
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                We've personalized your experience for:
              </Typography>

              <Stack direction="row" spacing={2} justifyContent="center" sx={{ mb: 4, flexWrap: 'wrap' }}>
                <Card sx={{ p: 3, minWidth: 200, bgcolor: '#f5f5f5' }}>
                  <Typography variant="overline" color="text.secondary">
                    Cameras ({selectedCamerasData.length})
                  </Typography>
                  <Stack spacing={1} sx={{ mt: 1 }}>
                    {selectedCamerasData.map((camera, idx) => (
                      <Box key={camera.id}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700}}>
                          {idx === 0 && '⭐'}{camera.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {camera.profiles.join(', ')}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </Card>

                <Card sx={{ p: 3, minWidth: 200, bgcolor: '#f5f5f5' }}>
                  <Typography variant="overline" color="text.secondary">
                    Categories ({selectedCategoriesData.length})
                  </Typography>
                  <Stack spacing={1} sx={{ mt: 1 }}>
                    {selectedCategoriesData.map((category, idx) => (
                      <Box key={category.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <category.Icon sx={{ fontSize: 20, color: DAVINCI_COLORS.primary }} />
                        <Typography variant="subtitle2" sx={{ fontWeight: 700}}>
                          {idx === 0 && '⭐'}{category.name}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </Card>

                <Card sx={{ p: 3, minWidth: 200, bgcolor: '#f5f5f5' }}>
                  <Typography variant="overline" color="text.secondary">
                    Experience
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700}}>
                    {selectedExperienceData?.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {selectedExperienceData?.description}
                  </Typography>
                </Card>
              </Stack>

              <Typography variant="body2" color="text.secondary">
                You can change these preferences anytime in settings
              </Typography>
            </Box>
          )}
        </Box>

        {/* Navigation Buttons */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
          <Button
            startIcon={<Close />}
            onClick={handleSkip}
            sx={{ color: 'text.secondary' }}
          >
            Skip for now
          </Button>

          <Box sx={{ display: 'flex', gap: 1 }}>
            {activeStep > 0 && activeStep < 4 && (
              <Button
                startIcon={<ArrowBack />}
                onClick={handleBack}
                variant="outlined"
              >
                Back
              </Button>
            )}

            {activeStep < 4 && (
              <Button
                endIcon={<ArrowForward />}
                onClick={handleNext}
                variant="contained"
                disabled={
                  (activeStep === 1 && selectedCameras.length === 0) ||
                  (activeStep === 2 && selectedCategories.length === 0) ||
                  (activeStep === 3 && !selectedExperience)
                }
                sx={{
                  bgcolor: DAVINCI_COLORS.primary,
                  '&:hover': {
                    bgcolor: DAVINCI_COLORS.accent,
                  }
                }}
              >
                {activeStep === 0 ? 'Customize Manually' : 'Next'}
              </Button>
            )}

            {activeStep === 4 && (
              <Button
                onClick={handleComplete}
                variant="contained"
                size="large"
                sx={{
                  bgcolor: DAVINCI_COLORS.primary,
                  '&:hover': {
                    bgcolor: DAVINCI_COLORS.accent,
                  }
                }}
              >
                Start Browsing Scripts
              </Button>
            )}
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
