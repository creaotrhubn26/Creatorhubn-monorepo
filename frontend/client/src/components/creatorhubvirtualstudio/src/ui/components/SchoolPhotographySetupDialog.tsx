/**
 * School Photography Setup Dialog
 * 
 * A step-by-step onboarding wizard for school photographers.
 * Guides users through selecting:
 * 1. Photo Type (Individual Portrait, Class Photo, Graduation, etc.)
 * 2. HDRI Environment
 * 3. Lighting Setup
 * 4. Props & Equipment
 * 
 * After completion, applies all selections to the Virtual Studio.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Grid2 as Grid,
  Card,
  CardContent,
  CardActionArea,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Chip,
  Divider,
  IconButton,
  Stack,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Checkbox,
  Paper,
  Tooltip,
  LinearProgress,
} from '@mui/material';
import {
  School,
  Groups,
  Person,
  EmojiEvents,
  SportsFootball,
  ChildCare,
  Badge,
  Close,
  ArrowForward,
  ArrowBack,
  Check,
  WbSunny,
  Tungsten,
  Chair,
  Wallpaper,
  ViewInAr,
  Star,
  PlayArrow,
  Settings,
  Refresh,
  AutoAwesome,
} from '@mui/icons-material';
import { logger } from '../../core/services/logger';

const log = logger.module('SchoolPhotographySetup');

// School photography types
export interface SchoolPhotoType {
  id: string;
  name: string;
  description: string;
  icon: React.ReactElement;
  tags: string[];
  studentCount: 'single' | 'small' | 'large';
  recommendedHDRI: string[];
  recommendedLighting: string[];
  recommendedProps: string[];
}

const SCHOOL_PHOTO_TYPES: SchoolPhotoType[] = [
  {
    id: 'individual-portrait',
    name: 'Individual Portrait',
    description: 'Standard yearbook-style individual portraits',
    icon: <Person />,
    tags: ['school-portrait','yearbook'],
    studentCount: 'single',
    recommendedHDRI: ['studio_small_09','studio_neutral','photo_studio_01'],
    recommendedLighting: ['school-portrait-standard','school-yearbook-classic'],
    recommendedProps: ['school-stool','backdrop-school-grey','step-box'],
  },
  {
    id: 'class-photo',
    name: 'Class Photo',
    description: 'Full class group photos with risers',
    icon: <Groups />,
    tags: ['class-photo','group-school'],
    studentCount: 'large',
    recommendedHDRI: ['school_quad','empty_warehouse_01','studio_neutral'],
    recommendedLighting: ['school-group-wide','school-group-small'],
    recommendedProps: ['riser-3step','backdrop-school-grey','floor-tape-marks','bench-wooden'],
  },
  {
    id: 'graduation',
    name: 'Graduation Portrait',
    description: 'Cap and gown graduation photos',
    icon: <EmojiEvents />,
    tags: ['graduation'],
    studentCount: 'single',
    recommendedHDRI: ['entrance_hall','music_hall_01','studio_small_09'],
    recommendedLighting: ['school-graduation','school-portrait-premium'],
    recommendedProps: ['school-stool','backdrop-graduation','diploma-prop','year-sign'],
  },
  {
    id: 'sports-team',
    name: 'Sports Team',
    description: 'Athletic team photos with dramatic lighting',
    icon: <SportsFootball />,
    tags: ['sports-team'],
    studentCount: 'large',
    recommendedHDRI: ['school_quad','empty_warehouse_01','studio_small_06'],
    recommendedLighting: ['school-sports-team','school-group-wide'],
    recommendedProps: ['riser-3step','sports-banner','floor-gym','football-prop'],
  },
  {
    id: 'preschool',
    name: 'Preschool/Elementary',
    description: 'Soft, child-friendly portraits for young students',
    icon: <ChildCare />,
    tags: ['preschool','elementary'],
    studentCount: 'single',
    recommendedHDRI: ['studio_small_02','studio_neutral','photo_studio_01'],
    recommendedLighting: ['school-preschool','school-portrait-standard'],
    recommendedProps: ['school-stool','backdrop-school-blue','step-box','floor-carpet-blue'],
  },
  {
    id: 'faculty',
    name: 'Faculty/Staff',
    description: 'Professional portraits for teachers and staff',
    icon: <Badge />,
    tags: ['faculty'],
    studentCount: 'single',
    recommendedHDRI: ['studio_small_03','studio_small_09','photo_studio_01'],
    recommendedLighting: ['school-faculty','school-portrait-premium'],
    recommendedProps: ['school-stool','backdrop-school-grey','backdrop-muslin-grey'],
  },
];

// HDRI preset data (simplified)
interface HDRIPreset {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  indoorOutdoor: 'indoor' | 'outdoor';
}

const SCHOOL_HDRI_PRESETS: HDRIPreset[] = [
  { id: 'studio_small_09', name: 'Studio Neutral', description: 'Clean, even studio lighting', thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/studio_small_09.png', indoorOutdoor: 'indoor' },
  { id: 'studio_neutral', name: 'Soft Studio', description: 'Very soft, diffused light', thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/studio_neutral.png', indoorOutdoor: 'indoor' },
  { id: 'photo_studio_01', name: 'Photo Studio', description: 'Professional studio environment', thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/photo_studio_01.png', indoorOutdoor: 'indoor' },
  { id: 'school_quad', name: 'School Quad', description: 'Outdoor school courtyard', thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/school_quad.png', indoorOutdoor: 'outdoor' },
  { id: 'empty_warehouse_01', name: 'Gymnasium', description: 'Large open indoor space', thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/empty_warehouse_01.png', indoorOutdoor: 'indoor' },
  { id: 'entrance_hall', name: 'School Hall', description: 'Elegant hallway setting', thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/entrance_hall.png', indoorOutdoor: 'indoor' },
  { id: 'music_hall_01', name: 'Auditorium', description: 'Large auditorium space', thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/music_hall_01.png', indoorOutdoor: 'indoor' },
];

// Light setup preset data (simplified)
interface LightSetupPreset {
  id: string;
  name: string;
  description: string;
  lights: number;
  ratio: string;
}

const SCHOOL_LIGHT_PRESETS: LightSetupPreset[] = [
  { id: 'school-portrait-standard', name: 'Standard Portrait', description: 'Classic 2:1 ratio for consistent results', lights: 3, ratio: '2:1' },
  { id: 'school-portrait-premium', name: 'Premium Portrait', description: 'More dimension with 4-light setup', lights: 4, ratio: '2.5:1' },
  { id: 'school-yearbook-classic', name: 'Yearbook Classic', description: 'Traditional yearbook lighting', lights: 2, ratio: '2:1' },
  { id: 'school-group-wide', name: 'Large Group', description: 'Even coverage for 15-30+ students', lights: 4, ratio: '1.5:1' },
  { id: 'school-group-small', name: 'Small Group', description: 'Balanced for 5-15 students', lights: 3, ratio: '1.5:1' },
  { id: 'school-graduation', name: 'Graduation', description: 'Polished look for cap & gown', lights: 4, ratio: '2.5:1' },
  { id: 'school-sports-team', name: 'Sports Team', description: 'Dramatic with rim lights', lights: 3, ratio: '4:1' },
  { id: 'school-faculty', name: 'Faculty Portrait', description: 'Professional for teachers', lights: 3, ratio: '2:1' },
  { id: 'school-preschool', name: 'Preschool Soft', description: 'Very soft for young children', lights: 3, ratio: '1.3:1' },
];

// Props preset data (simplified)
interface PropPreset {
  id: string;
  name: string;
  category: 'seating' | 'backdrop' | 'floor' | 'accessory';
}

const SCHOOL_PROP_PRESETS: PropPreset[] = [
  // Seating
  { id: 'school-stool', name: 'School Photo Stool', category: 'seating' },
  { id: 'riser-3step', name: '3-Step Riser', category: 'seating' },
  { id: 'riser-4step', name: '4-Step Riser', category: 'seating' },
  { id: 'bench-wooden', name: 'Wooden Bench', category: 'seating' },
  { id: 'folding-chair-school', name: 'Folding Chair', category: 'seating' },
  { id: 'step-box', name: 'Step Box', category: 'seating' },
  // Backdrops
  { id: 'backdrop-school-grey', name: 'Mottled Grey', category: 'backdrop' },
  { id: 'backdrop-school-blue', name: 'Classic Blue', category: 'backdrop' },
  { id: 'backdrop-school-green', name: 'Classic Green', category: 'backdrop' },
  { id: 'backdrop-graduation', name: 'Graduation', category: 'backdrop' },
  { id: 'backdrop-muslin-grey', name: 'Muslin Grey', category: 'backdrop' },
  { id: 'sports-banner', name: 'Team Banner', category: 'backdrop' },
  // Floors
  { id: 'floor-carpet-blue', name: 'Blue Carpet', category: 'floor' },
  { id: 'floor-gym', name: 'Gymnasium Floor', category: 'floor' },
  { id: 'floor-stage', name: 'Stage Floor', category: 'floor' },
  { id: 'floor-tape-marks', name: 'Position Markers', category: 'floor' },
  // Accessories
  { id: 'diploma-prop', name: 'Diploma', category: 'accessory' },
  { id: 'year-sign', name: 'Year Sign', category: 'accessory' },
  { id: 'school-banner', name: 'School Banner', category: 'accessory' },
];

interface SchoolPhotographySetupDialogProps {
  open: boolean;
  onClose: () => void;
  onComplete: (config: SchoolSetupConfig) => void;
}

export interface SchoolSetupConfig {
  photoType: SchoolPhotoType;
  hdri: HDRIPreset;
  lighting: LightSetupPreset;
  props: PropPreset[];
}

const STEPS = ['Photo Type','Environment','Lighting','Props','Review'];

export const SchoolPhotographySetupDialog: React.FC<SchoolPhotographySetupDialogProps> = ({
  open,
  onClose,
  onComplete,
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [selectedPhotoType, setSelectedPhotoType] = useState<SchoolPhotoType | null>(null);
  const [selectedHDRI, setSelectedHDRI] = useState<HDRIPreset | null>(null);
  const [selectedLighting, setSelectedLighting] = useState<LightSetupPreset | null>(null);
  const [selectedProps, setSelectedProps] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  // Filter HDRIs based on selected photo type
  const filteredHDRIs = useMemo(() => {
    if (!selectedPhotoType) return SCHOOL_HDRI_PRESETS;
    return SCHOOL_HDRI_PRESETS.filter(
      hdri => selectedPhotoType.recommendedHDRI.includes(hdri.id) || true
    ).sort((a, b) => {
      const aRecommended = selectedPhotoType.recommendedHDRI.includes(a.id);
      const bRecommended = selectedPhotoType.recommendedHDRI.includes(b.id);
      if (aRecommended && !bRecommended) return -1;
      if (!aRecommended && bRecommended) return 1;
      return 0;
    });
  }, [selectedPhotoType]);

  // Filter lighting based on selected photo type
  const filteredLighting = useMemo(() => {
    if (!selectedPhotoType) return SCHOOL_LIGHT_PRESETS;
    return SCHOOL_LIGHT_PRESETS.filter(
      light => selectedPhotoType.recommendedLighting.includes(light.id) || true
    ).sort((a, b) => {
      const aRecommended = selectedPhotoType.recommendedLighting.includes(a.id);
      const bRecommended = selectedPhotoType.recommendedLighting.includes(b.id);
      if (aRecommended && !bRecommended) return -1;
      if (!aRecommended && bRecommended) return 1;
      return 0;
    });
  }, [selectedPhotoType]);

  // Filter props based on selected photo type
  const filteredProps = useMemo(() => {
    if (!selectedPhotoType) return SCHOOL_PROP_PRESETS;
    return SCHOOL_PROP_PRESETS;
  }, [selectedPhotoType]);

  // Auto-select recommended items when photo type changes
  const handlePhotoTypeSelect = useCallback((photoType: SchoolPhotoType) => {
    setSelectedPhotoType(photoType);
    
    // Auto-select first recommended HDRI
    const recommendedHDRI = SCHOOL_HDRI_PRESETS.find(h => photoType.recommendedHDRI.includes(h.id));
    if (recommendedHDRI) setSelectedHDRI(recommendedHDRI);
    
    // Auto-select first recommended lighting
    const recommendedLight = SCHOOL_LIGHT_PRESETS.find(l => photoType.recommendedLighting.includes(l.id));
    if (recommendedLight) setSelectedLighting(recommendedLight);
    
    // Auto-select recommended props
    const recommendedPropIds = new Set(photoType.recommendedProps);
    setSelectedProps(recommendedPropIds);
  }, []);

  const handlePropToggle = (propId: string) => {
    setSelectedProps(prev => {
      const next = new Set(prev);
      if (next.has(propId)) {
        next.delete(propId);
      } else {
        next.add(propId);
      }
      return next;
    });
  };

  const handleNext = () => {
    if (activeStep < STEPS.length - 1) {
      setActiveStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (activeStep > 0) {
      setActiveStep(prev => prev - 1);
    }
  };

  const handleComplete = async () => {
    if (!selectedPhotoType || !selectedHDRI || !selectedLighting) return;
    
    setLoading(true);
    
    const config: SchoolSetupConfig = {
      photoType: selectedPhotoType,
      hdri: selectedHDRI,
      lighting: selectedLighting,
      props: SCHOOL_PROP_PRESETS.filter(p => selectedProps.has(p.id)),
    };
    
    try {
      // Dispatch events to apply the configuration
      window.dispatchEvent(new CustomEvent('vs-load-hdri', {
        detail: { hdriId: selectedHDRI.id },
      }));
      
      window.dispatchEvent(new CustomEvent('vs-load-lighting-preset', {
        detail: { presetId: selectedLighting.id },
      }));
      
      config.props.forEach(prop => {
        window.dispatchEvent(new CustomEvent('vs-add-prop', {
          detail: { propId: prop.id },
        }));
      });
      
      // Notify toast
      window.dispatchEvent(new CustomEvent('vs-toast', {
        detail: {
          message: `School photography setup, applied: ${selectedPhotoType.name}`,
          type: 'success',
        },
      }));
      
      log.info('School photography setup complete: ', config);
      
      onComplete(config);
      onClose();
    } catch (error) {
      log.error('Failed to apply school photography setup:', error);
      window.dispatchEvent(new CustomEvent('vs-toast', {
        detail: {
          message: 'Failed to apply setup. Please try again.',
          type: 'error',
        },
      }));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setActiveStep(0);
    setSelectedPhotoType(null);
    setSelectedHDRI(null);
    setSelectedLighting(null);
    setSelectedProps(new Set());
  };

  const canProceed = useMemo(() => {
    switch (activeStep) {
      case 0: return !!selectedPhotoType;
      case 1: return !!selectedHDRI;
      case 2: return !!selectedLighting;
      case 3: return selectedProps.size > 0;
      case 4: return true;
      default: return false;
    }
  }, [activeStep, selectedPhotoType, selectedHDRI, selectedLighting, selectedProps]);

  const renderPhotoTypeStep = () => (
    <Grid container spacing={2}>
      {SCHOOL_PHOTO_TYPES.map(photoType => (
        <Grid size={{ xs: 12, sm: 6, md: 4 }} key={photoType.id}>
          <Card
            sx={{
              border: selectedPhotoType?.id === photoType.id ? 2 : 1,
              borderColor: selectedPhotoType?.id === photoType.id ? 'primary.main' : 'divider',
              transition: 'all 0.2s','&:hover': { borderColor: 'primary.light' }}}
          >
            <CardActionArea onClick={() => handlePhotoTypeSelect(photoType)}>
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center" mb={1}>
                  <Box
                    sx={{
                      p: 1,
                      borderRadius: 1,
                      bgcolor: selectedPhotoType?.id === photoType.id ? 'primary.main' : 'action.hover',
                      color: selectedPhotoType?.id === photoType.id ? 'primary.contrastText' : 'text.primary'}}
                  >
                    {photoType.icon}
                  </Box>
                  <Typography variant="subtitle1" fontWeight="bold">
                    {photoType.name}
                  </Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {photoType.description}
                </Typography>
                <Stack direction="row" spacing={0.5} mt={1} flexWrap="wrap" gap={0.5}>
                  <Chip
                    size="small"
                    label={photoType.studentCount === 'single' ? '1 Student' : photoType.studentCount === 'small' ? '5-15 Students' : '15+ Students'}
                    variant="outlined"
                  />
                </Stack>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>
      ))}
    </Grid>
  );

  const renderHDRIStep = () => (
    <Box>
      {selectedPhotoType && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Recommended environments for {selectedPhotoType.name} are shown first
        </Alert>
      )}
      <Grid container spacing={2}>
        {filteredHDRIs.map(hdri => {
          const isRecommended = selectedPhotoType?.recommendedHDRI.includes(hdri.id);
          return (
            <Grid size={{ xs: 6, sm: 4, md: 3 }} key={hdri.id}>
              <Card
                sx={{
                  border: selectedHDRI?.id === hdri.id ? 2 : 1,
                  borderColor: selectedHDRI?.id === hdri.id ? 'primary.main' : 'divider',
                  position: 'relative'}}
              >
                <CardActionArea onClick={() => setSelectedHDRI(hdri)}>
                  {isRecommended && (
                    <Chip
                      icon={<Star sx={{ fontSize: 14 }} />}
                      label="Recommended"
                      size="small"
                      color="primary"
                      sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1}}
                    />
                  )}
                  <Box
                    sx={{
                      height: 100,
                      bgcolor: 'grey.200',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'}}
                  >
                    <WbSunny sx={{ fontSize: 40, color: 'grey.500' }} />
                  </Box>
                  <CardContent sx={{ py: 1 }}>
                    <Typography variant="body2" fontWeight="bold" noWrap>
                      {hdri.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {hdri.indoorOutdoor === 'indoor' ? 'Indoor' : 'Outdoor'}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );

  const renderLightingStep = () => (
    <Box>
      {selectedPhotoType && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Recommended lighting for {selectedPhotoType.name} is shown first
        </Alert>
      )}
      <Grid container spacing={2}>
        {filteredLighting.map(light => {
          const isRecommended = selectedPhotoType?.recommendedLighting.includes(light.id);
          return (
            <Grid size={{ xs: 12, sm: 6 }} key={light.id}>
              <Card
                sx={{
                  border: selectedLighting?.id === light.id ? 2 : 1,
                  borderColor: selectedLighting?.id === light.id ? 'primary.main' : 'divider'}}
              >
                <CardActionArea onClick={() => setSelectedLighting(light)}>
                  <CardContent>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Box
                        sx={{
                          p: 1,
                          borderRadius: 1,
                          bgcolor: selectedLighting?.id === light.id ? 'primary.main' : 'action.hover',
                          color: selectedLighting?.id === light.id ? 'primary.contrastText' : 'text.primary'}}
                      >
                        <Tungsten />
                      </Box>
                      <Box flex={1}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Typography variant="subtitle1" fontWeight="bold">
                            {light.name}
                          </Typography>
                          {isRecommended && (
                            <Chip icon={<Star sx={{ fontSize: 12 }} />} label="Recommended" size="small" color="primary" />
                          )}
                        </Stack>
                        <Typography variant="body2" color="text.secondary">
                          {light.description}
                        </Typography>
                        <Stack direction="row" spacing={2} mt={1}>
                          <Typography variant="caption" color="text.secondary">
                            {light.lights} Lights
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Ratio: {light.ratio}
                          </Typography>
                        </Stack>
                      </Box>
                    </Stack>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );

  const renderPropsStep = () => {
    const categories = ['seating','backdrop','floor', 'accessory'] as const;
    const categoryLabels = {
      seating: 'Seating & Risers',
      backdrop: 'Backdrops',
      floor: 'Floor Surfaces',
      accessory: 'Accessories',
    };
    const categoryIcons = {
      seating: <Chair />,
      backdrop: <Wallpaper />,
      floor: <ViewInAr />,
      accessory: <Settings />,
    };
    
    return (
      <Box>
        <Alert severity="info" sx={{ mb: 2 }}>
          Recommended props for {selectedPhotoType?.name || 'your selection'} are pre-selected
        </Alert>
        {categories.map(category => (
          <Box key={category} mb={3}>
            <Stack direction="row" spacing={1} alignItems="center" mb={1}>
              {categoryIcons[category]}
              <Typography variant="subtitle1" fontWeight="bold">
                {categoryLabels[category]}
              </Typography>
            </Stack>
            <Paper variant="outlined" sx={{ p: 1 }}>
              <List dense>
                {filteredProps
                  .filter(p => p.category === category)
                  .map(prop => {
                    const isRecommended = selectedPhotoType?.recommendedProps.includes(prop.id);
                    return (
                      <ListItem
                        key={prop.id}
                        secondaryAction={
                          isRecommended && (
                            <Chip label="Recommended" size="small" color="primary" variant="outlined" />
                          )
                        }
                      >
                        <ListItemIcon>
                          <Checkbox
                            edge="start"
                            checked={selectedProps.has(prop.id)}
                            onChange={() => handlePropToggle(prop.id)}
                          />
                        </ListItemIcon>
                        <ListItemText primary={prop.name} />
                      </ListItem>
                    );
                  })}
              </List>
            </Paper>
          </Box>
        ))}
      </Box>
    );
  };

  const renderReviewStep = () => (
    <Box>
      <Alert severity="success" sx={{ mb: 3 }}>
        Review your setup and click "Apply Setup" to configure the Virtual Studio
      </Alert>
      
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              Photo Type
            </Typography>
            {selectedPhotoType && (
              <Stack direction="row" spacing={2} alignItems="center">
                {selectedPhotoType.icon}
                <Box>
                  <Typography>{selectedPhotoType.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedPhotoType.description}
                  </Typography>
                </Box>
              </Stack>
            )}
          </Paper>
        </Grid>
        
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              Environment (HDRI)
            </Typography>
            {selectedHDRI && (
              <Stack direction="row" spacing={2} alignItems="center">
                <WbSunny />
                <Box>
                  <Typography>{selectedHDRI.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedHDRI.description}
                  </Typography>
                </Box>
              </Stack>
            )}
          </Paper>
        </Grid>
        
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              Lighting Setup
            </Typography>
            {selectedLighting && (
              <Stack direction="row" spacing={2} alignItems="center">
                <Tungsten />
                <Box>
                  <Typography>{selectedLighting.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedLighting.lights} lights, {selectedLighting.ratio} ratio
                  </Typography>
                </Box>
              </Stack>
            )}
          </Paper>
        </Grid>
        
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              Props ({selectedProps.size} selected)
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={0.5}>
              {Array.from(selectedProps).map(propId => {
                const prop = SCHOOL_PROP_PRESETS.find(p => p.id === propId);
                return prop ? (
                  <Chip key={propId} label={prop.name} size="small" />
                ) : null;
              })}
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );

  const renderStepContent = () => {
    switch (activeStep) {
      case 0: return renderPhotoTypeStep();
      case 1: return renderHDRIStep();
      case 2: return renderLightingStep();
      case 3: return renderPropsStep();
      case 4: return renderReviewStep();
      default: return null;
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{ sx: { minHeight: '80vh' } }}
    >
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={2} alignItems="center">
            <School color="primary" />
            <Typography variant="h6">School Photography Setup</Typography>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Tooltip title="Reset">
              <IconButton onClick={handleReset} size="small">
                <Refresh />
              </IconButton>
            </Tooltip>
            <IconButton onClick={onClose} size="small">
              <Close />
            </IconButton>
          </Stack>
        </Stack>
      </DialogTitle>
      
      <Divider />
      
      {/* Progress stepper */}
      <Box sx={{ px: 3, pt: 2 }}>
        <Stepper activeStep={activeStep} alternativeLabel>
          {STEPS.map((label, index) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Box>
      
      <DialogContent sx={{ minHeight: 400 }}>
        {loading ? (
          <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" height="100%">
            <LinearProgress sx={{ width:'50%', mb: 2 }} />
            <Typography color="text.secondary">Applying setup...</Typography>
          </Box>
        ) : (
          renderStepContent()
        )}
      </DialogContent>
      
      <Divider />
      
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button
          onClick={handleBack}
          disabled={activeStep === 0}
          startIcon={<ArrowBack />}
        >
          Back
        </Button>
        <Box flex={1} />
        {activeStep < STEPS.length - 1 ? (
          <Button
            variant="contained"
            onClick={handleNext}
            disabled={!canProceed}
            endIcon={<ArrowForward />}
          >
            Next
          </Button>
        ) : (
          <Button
            variant="contained"
            color="success"
            onClick={handleComplete}
            startIcon={<AutoAwesome />}
            disabled={loading}
          >
            Apply Setup
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default SchoolPhotographySetupDialog;

