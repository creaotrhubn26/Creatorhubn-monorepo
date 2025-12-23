/**
 * Onboarding Setup Selector
 * 
 * Shows published virtual studio setups during onboarding.
 * Users can clone successful setups to get started quickly.
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  Stack,
  Rating,
  CircularProgress,
  Alert,
  Divider,
} from '@mui/material';
import {
  CameraAlt,
  Lightbulb,
  Category,
  ContentCopy,
  Star,
  TrendingUp,
  ArrowForward,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/api';

interface PublishedStudio {
  id: string;
  title: string;
  description: string;
  equipmentSummary: string;
  difficultyLevel: string;
  cameraCount: number;
  lightCount: number;
  objectCount: number;
  targetUseCases: string[];
  tags: string[];
  averageRating: number;
  ratingCount: number;
  cloneCount: number;
  isFeatured: boolean;
  isTrending: boolean;
  authorName?: string;
}

interface OnboardingSetupSelectorProps {
  projectType?: string;
  onSetupCloned: (projectId: string) => void;
  onSkip: () => void;
}

export const OnboardingSetupSelector: React.FC<OnboardingSetupSelectorProps> = ({
  projectType,
  onSetupCloned,
  onSkip,
}) => {
  const [studios, setStudios] = useState<PublishedStudio[]>([]);
  const [loading, setLoading] = useState(true);
  const [cloning, setCloning] = useState<string | null>(null);

  useEffect(() => {
    fetchRecommendedStudios();
  }, [projectType]);

  const fetchRecommendedStudios = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (projectType) params.append('useCase', projectType);
      params.append('sort,', 'rating'); // Show highest rated first
      params.append('minRating', '4'); // Only show well-rated setups
      params.append('limit', '6'); // Show top 6
      
      const response = await apiRequest<{ published: PublishedStudio[] }>(
        `/api/virtual-studio/published?${params.toString()}`,
        { method: 'GET' }
      );
      
      setStudios(response.published);
    } catch (error) {
      console.error('Error fetching studios: ', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClone = async (studio: PublishedStudio) => {
    setCloning(studio.id);
    try {
      const response = await apiRequest<{ clonedProjectId: string }>(
        '/api/virtual-studio/clone',
        {
          method: 'POST',
          body: JSON.stringify({
            publishedStudioId: studio.id,
            cloneSource: 'onboarding',
          }),
        }
      );
      
      onSetupCloned(response.clonedProjectId);
    } catch (error) {
      console.error('Error cloning studio:', error);
      alert('Failed to clone setup. Please try again.');
      setCloning(null);
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Typography variant="h5" gutterBottom>
          Start with a Proven Setup
        </Typography>
        <Typography variant="body1" color="text.secondary">
          These setups have been tested and rated by the community. Clone one to get started quickly!
        </Typography>
      </Box>

      {/* Loading State */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Empty State */}
      {!loading && studios.length === 0 && (
        <Alert severity="info" sx={{ mb: 3 }}>
          No published setups available yet. Start from scratch or check back later!
        </Alert>
      )}

      {/* Studios Grid */}
      {!loading && studios.length > 0 && (
        <>
          <Grid container spacing={3} sx={{ mb: 3 }}>
            {studios.map((studio) => (
              <Grid item xs={12} md={6} key={studio.id}>
                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <CardContent sx={{ flexGrow: 1 }}>
                    {/* Badges */}
                    <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                      {studio.isFeatured && (
                        <Chip
                          label="Featured"
                          size="small"
                          color="primary"
                          icon={<Star />}
                        />
                      )}
                      {studio.isTrending && (
                        <Chip
                          label="Trending"
                          size="small"
                          color="secondary"
                          icon={<TrendingUp />}
                        />
                      )}
                    </Stack>

                    {/* Title */}
                    <Typography variant="h6" gutterBottom>
                      {studio.title}
                    </Typography>

                    {/* Rating */}
                    {studio.ratingCount > 0 && (
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <Rating value={studio.averageRating} precision={0.1} size="small" readOnly />
                        <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                          {studio.averageRating.toFixed(1)} ({studio.ratingCount} reviews)
                        </Typography>
                      </Box>
                    )}

                    {/* Description */}
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {studio.description.length > 100
                        ? `${studio.description.substring(0, 100)}...`
                        : studio.description}
                    </Typography>

                    {/* Equipment Summary */}
                    <Typography variant="body2" fontWeight="bold" sx={{ mb: 1 }}>
                      {studio.equipmentSummary}
                    </Typography>

                    {/* Equipment Details */}
                    <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
                      <Chip
                        icon={<CameraAlt />}
                        label={`${studio.cameraCount} camera${studio.cameraCount > 1 ? 's' : ','}`}
                        size="small"
                        variant="outlined"
                      />
                      <Chip
                        icon={<Lightbulb />}
                        label={`${studio.lightCount} light${studio.lightCount > 1 ? 's' : ','}`}
                        size="small"
                        variant="outlined"
                      />
                    </Stack>

                    {/* Difficulty */}
                    <Chip
                      label={studio.difficultyLevel}
                      size="small"
                      color={
                        studio.difficultyLevel === 'beginner' ? 'success' :
                        studio.difficultyLevel === 'intermediate' ? 'info' :
                        studio.difficultyLevel === 'advanced' ? 'warning' : 'error'
                      }
                    />

                    {/* Author */}
                    {studio.authorName && (
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2 }}>
                        Created by {studio.authorName}
                      </Typography>
                    )}

                    {/* Clone Count */}
                    <Typography variant="caption" color="text.secondary" display="block">
                      {studio.cloneCount} {studio.cloneCount === 1 ? 'person has' : 'people have'} used this setup
                    </Typography>
                  </CardContent>

                  <CardActions sx={{ px: 2, pb: 2 }}>
                    <Button
                      fullWidth
                      variant="contained"
                      startIcon={cloning === studio.id ? <CircularProgress size={16} /> : <ContentCopy />}
                      onClick={() => handleClone(studio)}
                      disabled={cloning === studio.id}
                    >
                      {cloning === studio.id ? 'Cloning...' : 'Use This Setup'}
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Divider sx={{ my: 3 }} />
        </>
      )}

      {/* Skip Button */}
      <Box sx={{ textAlign:'center' }}>
        <Button
          variant="outlined"
          onClick={onSkip}
          endIcon={<ArrowForward />}
        >
          Start from Scratch Instead
        </Button>
      </Box>
    </Box>
  );
};
