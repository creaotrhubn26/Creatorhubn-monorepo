/**
 * Virtual Studio Recommendations Component
 * 
 * Displays ML-powered recommendations for virtual studio setups
 * Shows successful configurations from other users (anonymized)
 * 
 * Privacy: Only shows configuration patterns, never actual project content
 */

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Chip,
  Grid,
  CircularProgress,
  Alert,
  Stack,
  Tooltip,
} from '@mui/material';
import {
  TrendingUp,
  CheckCircle,
  People,
  Star,
  Info,
} from '@mui/icons-material';
import { useVirtualStudioRecommendations, VirtualStudioRecommendation } from '@/hooks/useVirtualStudioRecommendations';

interface VirtualStudioRecommendationsProps {
  projectType: string;
  onSelectRecommendation?: (recommendation: VirtualStudioRecommendation) => void;
  showTrending?: boolean;
}

export const VirtualStudioRecommendations: React.FC<VirtualStudioRecommendationsProps> = ({
  projectType,
  onSelectRecommendation,
  showTrending = false,
}) => {
  const { recommendations, trending, isLoading, error, fetchTrending } = useVirtualStudioRecommendations(projectType);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  React.useEffect(() => {
    if (showTrending) {
      fetchTrending();
    }
  }, [showTrending, fetchTrending]);

  const displayRecommendations = showTrending ? trending : recommendations;

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
        <CircularProgress />
        <Typography variant="body2" sx={{ ml: 2 }}>
          Loading recommendations...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="info" sx={{ mb: 2 }}>
        Unable to load recommendations. You can still create your own custom setup!
      </Alert>
    );
  }

  if (displayRecommendations.length === 0) {
    return (
      <Alert severity="info" icon={<Info />} sx={{ mb: 2 }}>
        <Typography variant="body2">
          No recommendations available yet for this project type.
          <br />
          Be the first to create a successful setup and help others learn!
        </Typography>
      </Alert>
    );
  }

  const handleSelect = (recommendation: VirtualStudioRecommendation) => {
    setSelectedId(recommendation.title);
    if (onSelectRecommendation) {
      onSelectRecommendation(recommendation);
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {showTrending ? <TrendingUp /> : <Star />}
          {showTrending ? 'Trending Setups' : 'Recommended Setups'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Based on successful virtual studios from other users. Your privacy is protected - we only learn from configuration patterns.
        </Typography>
      </Box>

      <Grid container spacing={2}>
        {displayRecommendations.map((recommendation, index) => (
          <Grid item xs={12} sm={6} md={4} key={index}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                border: selectedId === recommendation.title ? '2px solid' : '1px solid',
                borderColor: selectedId === recommendation.title ? 'primary.main' : 'divider',
                transition: 'all 0.2s','&:hover': {
                  boxShadow: 3,
                  borderColor: 'primary.main',
                }}}
            >
              <CardContent sx={{ flexGrow: 1 }}>
                <Typography variant="h6" gutterBottom>
                  {recommendation.title}
                </Typography>
                
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {recommendation.description}
                </Typography>

                <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 0.5 }}>
                  {recommendation.isTrending && (
                    <Chip
                      icon={<TrendingUp />}
                      label="Trending"
                      size="small"
                      color="secondary"
                    />
                  )}
                  
                  <Tooltip title={`${recommendation.successRate}% of projects completed successfully`}>
                    <Chip
                      icon={<CheckCircle />}
                      label={`${recommendation.successRate}% success`}
                      size="small"
                      color="success"
                      variant="outlined"
                    />
                  </Tooltip>
                  
                  <Tooltip title={`Based on ${recommendation.basedOnProjectsCount} successful projects`}>
                    <Chip
                      icon={<People />}
                      label={`${recommendation.basedOnProjectsCount} projects`}
                      size="small"
                      variant="outlined"
                    />
                  </Tooltip>
                </Stack>

                {recommendation.tags && recommendation.tags.length > 0 && (
                  <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                    {recommendation.tags.slice(0, 3).map((tag, tagIndex) => (
                      <Chip
                        key={tagIndex}
                        label={tag}
                        size="small"
                        variant="outlined"
                      />
                    ))}
                  </Stack>
                )}
              </CardContent>

              <CardActions>
                <Button
                  fullWidth
                  variant={selectedId === recommendation.title ? 'contained' : 'outlined'}
                  onClick={() => handleSelect(recommendation)}
                >
                  {selectedId === recommendation.title ? 'Selected' : 'Use This Setup'}
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

