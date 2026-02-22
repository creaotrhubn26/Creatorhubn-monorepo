import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Stack,
  Button,
  Grid,
} from '@mui/material';
import {
  Favorite,
  Movie,
  VideoLibrary,
  Business,
  Home,
  FlightTakeoff,
  Videocam,
  ColorLens,
  Speed as Speed,
} from '@mui/icons-material';

const DAVINCI_COLORS = {
  primary: '#E02020',
  secondary: '#1A1A1A',
  accent: '#FF4444',
};

interface WorkflowPreset {
  id: string;
  name: string;
  description: string;
  cameras: string[];
  categories: string[];
  experienceLevel: string;
  icon: React.ReactNode;
  color: string;
  popular?: boolean;
}

interface PresetWorkflowsProps {
  onSelectPreset: (preset: Omit<WorkflowPreset, 'id' | 'icon' | 'color' | 'popular'>) => void;
}

const WORKFLOW_PRESETS: WorkflowPreset[] = [
  {
    id: 'sony-wedding-pro',
    name: 'Sony Wedding Pro',
    description: 'Professional wedding videography with Sony cameras',
    cameras: ['sony-s_log2','sony-s_log3'],
    categories: ['wedding','event'],
    experienceLevel: 'intermediate',
    icon: <Favorite />,
    color: '#E91E63',
    popular: true,
  },
  {
    id: 'canon-wedding-pro',
    name: 'Canon Wedding Pro',
    description: 'Professional wedding videography with Canon Cinema EOS',
    cameras: ['canon-c_log2','canon-c_log3'],
    categories: ['wedding','event'],
    experienceLevel: 'intermediate',
    icon: <Favorite />,
    color: '#E91E63',
    popular: true,
  },
  {
    id: 'cinematic-filmmaker',
    name: 'Cinematic Filmmaker',
    description: 'High-end cinema production with RED/ARRI',
    cameras: ['red-log3g10','arri-logc'],
    categories: ['film','commercial'],
    experienceLevel: 'advanced',
    icon: <Movie />,
    color: '#9C27B0',
    popular: true,
  },
  {
    id: 'youtube-creator',
    name: 'YouTube Creator',
    description: 'Content creation for YouTube and social media',
    cameras: ['sony-s_log2','panasonic-v_log','fujifilm-f_log'],
    categories: ['youtube','education'],
    experienceLevel: 'beginner',
    icon: <VideoLibrary />,
    color: '#FF5722',
    popular: true,
  },
  {
    id: 'corporate-videographer',
    name: 'Corporate Videographer',
    description: 'Professional corporate and business videos',
    cameras: ['canon-c_log2','sony-s_log2','panasonic-v_log'],
    categories: ['corporate','event'],
    experienceLevel: 'intermediate',
    icon: <Business />,
    color: '#2196F3',
  },
  {
    id: 'real-estate-specialist',
    name: 'Real Estate Specialist',
    description: 'Property tours and real estate marketing',
    cameras: ['dji-d_log','sony-s_log2'],
    categories: ['real-estate','drone'],
    experienceLevel: 'beginner',
    icon: <Home />,
    color: '#4CAF50',
  },
  {
    id: 'drone-pilot',
    name: 'Drone Pilot',
    description: 'Aerial cinematography and drone footage',
    cameras: ['dji-d_log'],
    categories: ['drone','real-estate','film'],
    experienceLevel: 'intermediate',
    icon: <FlightTakeoff />,
    color: '#00BCD4',
  },
  {
    id: 'indie-filmmaker',
    name: 'Indie Filmmaker',
    description: 'Independent film production on a budget',
    cameras: ['blackmagic-film','panasonic-v_log'],
    categories: ['film','documentary'],
    experienceLevel: 'intermediate',
    icon: <Movie />,
    color: '#FF9800',
  },
];

export function PresetWorkflows({ onSelectPreset }: PresetWorkflowsProps) {
  return (
    <Box sx={{ mb: 4 }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600}}>
        Quick Start Presets
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Choose a preset workflow to quickly configure your cameras and categories
      </Typography>
      
      <Grid container spacing={2}>
        {WORKFLOW_PRESETS.map((preset) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={preset.id}>
            <Card
              sx={{
                height: '100%',
                cursor: 'pointer',
                transition: 'all 0.2s',
                border: '2px solid transparent',
                '&:hover': {
                  borderColor: DAVINCI_COLORS.primary,
                  transform: 'translateY(-4px)',
                  boxShadow: 4,
                }}}
              onClick={() => onSelectPreset({
                name: preset.name,
                description: preset.description,
                cameras: preset.cameras,
                categories: preset.categories,
                experienceLevel: preset.experienceLevel,
              })}
            >
              <CardContent>
                <Stack spacing={2}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ color: preset.color }}>
                      {preset.icon}
                    </Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, flex: 1 }}>
                      {preset.name}
                    </Typography>
                    {preset.popular && (
                      <Chip label="Popular" size="small" color="error" />
                    )}
                  </Box>
                  
                  <Typography variant="body2" color="text.secondary">
                    {preset.description}
                  </Typography>
                  
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Chip
                      label={`${preset.cameras.length} camera${preset.cameras.length !== 1 ? 's' : ','}`}
                      size="small"
                      icon={<Videocam />}
                      sx={{ fontSize: '0.7rem' }}
                    />
                    <Chip
                      label={`${preset.categories.length} categor${preset.categories.length !== 1 ? 'ies' : 'y'}`}
                      size="small"
                      icon={<ColorLens />}
                      sx={{ fontSize: '0.7rem' }}
                    />
                    <Chip
                      label={preset.experienceLevel}
                      size="small"
                      icon={<Speed />}
                      sx={{ fontSize: '0.7rem' }}
                    />
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

export default PresetWorkflows;

