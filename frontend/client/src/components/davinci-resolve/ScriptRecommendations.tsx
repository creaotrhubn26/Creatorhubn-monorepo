import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Stack,
  Button,
} from '@mui/material';
import {
  TrendingUp,
  Star,
  Lightbulb,
  EmojiEvents,
  Videocam,
  ColorLens,
  AutoAwesome,
} from '@mui/icons-material';
import { CAMERA_PROFILES, SCRIPT_CATEGORIES } from './scriptData';

const DAVINCI_COLORS = {
  primary: '#E02020',
  secondary: '#1A1A1A',
  accent: '#FF4444',
};

interface ScriptRecommendation {
  id: string;
  name: string;
  description: string;
  reason: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  category: string;
  icon: React.ReactNode;
  matchScore?: number;
}

interface ScriptRecommendationsProps {
  experienceLevel: string;
  cameras: string[];
  categories: string[];
  onSelectScript: (scriptId: string) => void;
}

// Camera + Category specific recommendations
const COMBINATION_RECOMMENDATIONS: Record<string, Record<string, ScriptRecommendation[]>> = {
  // Sony + Wedding
  'sony-wedding': [
    {
      id: 'wedding-sony-s_log2-professional-powergrade-creation.py',
      name: 'Sony Wedding Professional Powergrade',
      description: 'Professional color grading preset optimized for Sony S-Log2 wedding footage',
      reason: 'Perfect match for your Sony camera and wedding work',
      difficulty: 'intermediate',
      category: 'Wedding',
      icon: <Star />,
      matchScore: 100,
    },
    {
      id: 'wedding-multicam-sync',
      name: 'Wedding Multicam Sync',
      description: 'Automatically sync multiple Sony camera angles',
      reason: 'Essential for multi-camera wedding coverage',
      difficulty: 'beginner',
      category: 'Wedding',
      icon: <Videocam />,
      matchScore: 95,
    },
  ],
  // Canon + Wedding
  'canon-wedding': [
    {
      id: 'wedding-canon-c_log2-professional-powergrade-creation.py',
      name: 'Canon Wedding Professional Powergrade',
      description: 'Professional color grading preset optimized for Canon C-Log2 wedding footage',
      reason: 'Perfect match for your Canon camera and wedding work',
      difficulty: 'intermediate',
      category: 'Wedding',
      icon: <Star />,
      matchScore: 100,
    },
  ],
  // Panasonic + Wedding
  'panasonic-wedding': [
    {
      id: 'wedding-panasonic-v_log-professional-powergrade-creation.py',
      name: 'Panasonic Wedding Professional Powergrade',
      description: 'Professional color grading preset optimized for Panasonic V-Log wedding footage',
      reason: 'Perfect match for your Panasonic camera and wedding work',
      difficulty: 'intermediate',
      category: 'Wedding',
      icon: <Star />,
      matchScore: 100,
    },
  ],
  // Sony + Film
  'sony-film': [
    {
      id: 'sony-s_log3-powergrade-creation.py',
      name: 'Sony S-Log3 Cinematic Powergrade',
      description: 'Cinematic color grading for Sony S-Log3 footage',
      reason: 'Ideal for cinematic projects with Sony cameras',
      difficulty: 'advanced',
      category: 'Film',
      icon: <ColorLens />,
      matchScore: 100,
    },
    {
      id: 'film-lut-generator',
      name: 'Custom Film LUT Generator',
      description: 'Generate custom LUTs for your Sony footage',
      reason: 'Create your signature cinematic look',
      difficulty: 'advanced',
      category: 'Film',
      icon: <AutoAwesome />,
      matchScore: 90,
    },
  ],
  // RED + Film
  'red-film': [
    {
      id: 'red-log3g10-powergrade-creation.py',
      name: 'RED Log3G10 Cinematic Powergrade',
      description: 'Professional color grading for RED cameras',
      reason: 'Optimized for RED cinema cameras',
      difficulty: 'advanced',
      category: 'Film',
      icon: <Star />,
      matchScore: 100,
    },
  ],
  // DJI + Drone
  'dji-drone': [
    {
      id: 'dji-d_log-powergrade-creation.py',
      name: 'DJI D-Log Aerial Powergrade',
      description: 'Color grading optimized for DJI drone footage',
      reason: 'Perfect for your DJI drone work',
      difficulty: 'intermediate',
      category: 'Drone',
      icon: <Star />,
      matchScore: 100,
    },
    {
      id: 'drone-stabilization',
      name: 'Drone Stabilization',
      description: 'Advanced stabilization for aerial footage',
      reason: 'Essential for smooth drone shots',
      difficulty: 'intermediate',
      category: 'Drone',
      icon: <TrendingUp />,
      matchScore: 95,
    },
  ],
};

export function ScriptRecommendations({
  experienceLevel,
  cameras,
  categories,
  onSelectScript,
}: ScriptRecommendationsProps) {
  // Generate recommendations based on camera/category combinations and experience level
  const recommendations: ScriptRecommendation[] = React.useMemo(() => {
    const recs: ScriptRecommendation[] = [];

    // Try to find camera + category specific recommendations
    for (const camera of cameras) {
      for (const category of categories) {
        const cameraManufacturer = CAMERA_PROFILES[camera]?.manufacturer.toLowerCase() || camera.split('-')[0];
        const combinationKey = `${cameraManufacturer}-${category}`;
        const specificRecs = COMBINATION_RECOMMENDATIONS[combinationKey];

        if (specificRecs) {
          recs.push(...specificRecs);
        }
      }
    }

    // If we have specific recommendations, filter by experience level and return top 3
    if (recs.length > 0) {
      const filteredByExperience = recs.filter(rec => {
        if (experienceLevel === 'beginner') return rec.difficulty === 'beginner' || rec.difficulty === 'intermediate';
        if (experienceLevel === 'intermediate') return rec.difficulty === 'intermediate' || rec.difficulty === 'advanced';
        return true; // Advanced users see all
      });

      // Sort by match score and return top 3
      return filteredByExperience
        .sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0))
        .slice(0, 3);
    }

    // Fallback to generic recommendations based on experience level
    const primaryCamera = cameras[0] || 'any';
    const primaryCategory = categories[0] || 'any';

    if (experienceLevel === 'beginner') {
      recs.push({
        id: 'auto-color-balance',
        name: 'Auto Color Balance',
        description: 'Automatically balance colors across all clips',
        reason: 'Perfect for learning color correction basics',
        difficulty: 'beginner',
        category: 'Color Correction',
        icon: <Star />,
      });
      recs.push({
        id: 'basic-lut-apply',
        name: 'Apply Basic LUT',
        description: 'Apply a LUT to selected clips',
        reason: 'Great introduction to color grading',
        difficulty: 'beginner',
        category: 'Color Grading',
        icon: <Lightbulb />,
      });
      recs.push({
        id: 'clip-organizer',
        name: 'Clip Organizer',
        description: 'Organize clips by scene or take',
        reason: 'Learn project organization',
        difficulty: 'beginner',
        category: 'Organization',
        icon: <TrendingUp />,
      });
    } else if (experienceLevel === 'intermediate') {
      recs.push({
        id: 'advanced-color-match',
        name: 'Advanced Color Matching',
        description: 'Match colors between different camera angles',
        reason: 'Build on your color correction skills',
        difficulty: 'intermediate',
        category: 'Color Correction',
        icon: <TrendingUp />,
      });
      recs.push({
        id: 'custom-lut-generator',
        name: 'Custom LUT Generator',
        description: 'Generate custom LUTs from reference images',
        reason: 'Create your own look',
        difficulty: 'intermediate',
        category: 'Color Grading',
        icon: <Star />,
      });
      recs.push({
        id: 'batch-export',
        name: 'Batch Export Optimizer',
        description: 'Export multiple timelines with optimized settings',
        reason: 'Streamline your workflow',
        difficulty: 'intermediate',
        category: 'Export',
        icon: <EmojiEvents />,
      });
    } else {
      // Advanced
      recs.push({
        id: 'api-integration',
        name: 'Custom API Integration',
        description: 'Integrate external color grading APIs',
        reason: 'Unlock advanced automation',
        difficulty: 'advanced',
        category: 'Integration',
        icon: <EmojiEvents />,
      });
      recs.push({
        id: 'ml-color-grade',
        name: 'ML-Powered Color Grading',
        description: 'Use machine learning for intelligent color grading',
        reason: 'Cutting-edge technology',
        difficulty: 'advanced',
        category: 'Color Grading',
        icon: <Star />,
      });
      recs.push({
        id: 'complex-automation',
        name: 'Complex Workflow Automation',
        description: 'Automate entire post-production pipelines',
        reason: 'Maximum efficiency',
        difficulty: 'advanced',
        category: 'Automation',
        icon: <TrendingUp />,
      });
    }

    return recs;
  }, [experienceLevel, cameras, categories]);

  return (
    <Box sx={{ mb: 4 }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 700}}>
        Recommended for You
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Based on your {experienceLevel} experience level
      </Typography>

      <Stack spacing={2}>
        {recommendations.map((rec) => (
          <Card
            key={rec.id}
            sx={{
              border: '1px solid #e0e0e0',
              '&:hover': {
                boxShadow: 3,
                borderColor: DAVINCI_COLORS.primary,
              }
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                <Box sx={{ color: DAVINCI_COLORS.primary, mt: 0.5 }}>{rec.icon}</Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                    {rec.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {rec.description}
                  </Typography>
                  <Typography variant="caption" sx={{ color: DAVINCI_COLORS.primary, mb: 1, display: 'block' }}>
                    💡 {rec.reason}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Chip label={rec.category} size="small" />
                    <Chip
                      label={rec.difficulty}
                      size="small"
                      sx={{
                        bgcolor:
                          rec.difficulty === 'beginner'
                            ? '#4caf50'
                            : rec.difficulty === 'intermediate'
                            ? '#ff9800' : '#f44336',
                        color: 'white'}}
                    />
                    <Button
                      size="small"
                      onClick={() => onSelectScript(rec.id)}
                      sx={{
                        ml: 'auto',
                        color: DAVINCI_COLORS.primary,
                        '&:hover': {
                          bgcolor: 'rgba(224, 32, 32, 0.1)',
                        }
                      }}
                    >
                      Try Now
                    </Button>
                  </Box>
                </Box>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Box>
  );
}

export default ScriptRecommendations;
