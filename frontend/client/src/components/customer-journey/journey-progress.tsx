import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Stack,
  Typography,
} from '@mui/material';
import {
  ArrowForward,
  Lightbulb,
  SearchOutlined,
  ThumbUp,
  TrendingUp,
  Visibility,
} from '@mui/icons-material';
import { useTheming } from '../../utils/theming-helper';

interface JourneyStageResponse {
  stage?: string;
  personalizedMessage?: string;
  nextSuggestedActions?: string[];
}

interface RecommendationItem {
  vendorId?: string | number;
  reason?: string;
}

interface MarketplaceRecommendations {
  trending?: RecommendationItem[];
  similar?: RecommendationItem[];
}

interface JourneyStageConfig {
  id: string;
  label: string;
  description: string;
  color: string;
  icon: React.ComponentType;
}

const JOURNEY_STAGES: JourneyStageConfig[] = [
  {
    id: 'discovery',
    label: 'Discovery',
    description: 'Finding your needs',
    color: '#ff8c00',
    icon: SearchOutlined,
  },
  {
    id: 'consideration',
    label: 'Consideration',
    description: 'Evaluating options',
    color: '#ffa500',
    icon: Visibility,
  },
  {
    id: 'decision',
    label: 'Decision',
    description: 'Making choice',
    color: '#ffb340',
    icon: ThumbUp,
  },
  {
    id: 'action',
    label: 'Action',
    description: 'Taking action',
    color: '#ffd700',
    icon: ArrowForward,
  },
  {
    id: 'advocacy',
    label: 'Advocacy',
    description: 'Sharing experience',
    color: '#32cd30',
    icon: Lightbulb,
  },
];

export default function JourneyProgress() {
  const theming = useTheming('photographer');

  const { data: journeyStage } = useQuery<JourneyStageResponse>({
    queryKey: ['/api/customer-journey/stage'],
    refetchInterval: 30000,
  });

  const { data: recommendations } = useQuery<MarketplaceRecommendations>({
    queryKey: ['/api/marketplace/recommendations'],
  });

  if (!journeyStage) {
    return null;
  }

  const detectedStageIndex = JOURNEY_STAGES.findIndex((stage) => stage.id === journeyStage.stage);
  const currentStageIndex = detectedStageIndex >= 0 ? detectedStageIndex : 0;

  return (
    <Stack spacing={2}>
      <Card sx={theming.getThemedCardSx()}>
        <CardContent>
          <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
            <Typography variant="h6">Your Journey Progress</Typography>
            <Chip
              label={JOURNEY_STAGES[currentStageIndex].label}
              sx={{
                bgcolor: JOURNEY_STAGES[currentStageIndex].color,
                color: '#fff',
              }}
            />
          </Stack>

          <Stack spacing={1.5}>
            {JOURNEY_STAGES.map((stage, index) => {
              const isActive = index === currentStageIndex;
              const isCompleted = index < currentStageIndex;
              const IconComponent = stage.icon;

              return (
                <Box key={stage.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box
                    sx={{
                      width: 34,
                      height: 34,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: isActive ? '#8B4513' : isCompleted ? '#fbbf24' : '#e5e7eb',
                      color: isActive || isCompleted ? '#fff' : '#6b7280',
                      flexShrink: 0,
                    }}
                  >
                    <IconComponent />
                  </Box>

                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" fontWeight={600}>
                      {stage.label}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {stage.description}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Stack>

          {journeyStage.personalizedMessage && (
            <Box sx={{ mt: 2, p: 1.5, bgcolor: '#eff6ff', borderRadius: 1.5 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Lightbulb sx={{ color: '#2563eb' }} />
                <Typography variant="body2" sx={{ color: '#1e40af' }}>
                  {journeyStage.personalizedMessage}
                </Typography>
              </Stack>
            </Box>
          )}
        </CardContent>
      </Card>

      {journeyStage.nextSuggestedActions && journeyStage.nextSuggestedActions.length > 0 && (
        <Card sx={theming.getThemedCardSx()}>
          <CardContent>
            <Typography variant="h6" mb={1.5}>
              Suggested Next Steps
            </Typography>
            <Stack spacing={1}>
              {journeyStage.nextSuggestedActions.map((action, index) => (
                <Stack key={`${action}-${index}`} direction="row" spacing={1} alignItems="center">
                  <ArrowForward sx={{ color: '#8B4513', fontSize: 18 }} />
                  <Typography variant="body2">{action}</Typography>
                </Stack>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      {recommendations && (
        <Card sx={theming.getThemedCardSx()}>
          <CardContent>
            <Stack direction="row" spacing={1} alignItems="center" mb={1.5}>
              <TrendingUp sx={{ color: '#8B4513' }} />
              <Typography variant="h6">Recommended for You</Typography>
            </Stack>

            {recommendations.trending && recommendations.trending.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" mb={1}>
                  Trending Now
                </Typography>
                <Stack spacing={1}>
                  {recommendations.trending.map((rec, index) => (
                    <Box
                      key={`trending-${index}`}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        p: 1,
                        bgcolor: 'rgba(21, 191, 36, 0.1)',
                        borderRadius: 1,
                      }}
                    >
                      <Typography variant="body2">Vendor #{rec.vendorId ?? 'N/A'}</Typography>
                      <Chip label={rec.reason ?? 'Trending'} size="small" variant="outlined" />
                    </Box>
                  ))}
                </Stack>
              </Box>
            )}

            {recommendations.similar && recommendations.similar.length > 0 && (
              <Box>
                <Typography variant="subtitle2" mb={1}>
                  Based on Your Timeline
                </Typography>
                <Stack spacing={1}>
                  {recommendations.similar.map((rec, index) => (
                    <Box
                      key={`similar-${index}`}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        p: 1,
                        bgcolor: 'rgba(21, 191, 36, 0.1)',
                        borderRadius: 1,
                      }}
                    >
                      <Typography variant="body2">Vendor #{rec.vendorId ?? 'N/A'}</Typography>
                      <Chip label={rec.reason ?? 'Suggested'} size="small" variant="outlined" />
                    </Box>
                  ))}
                </Stack>
              </Box>
            )}
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}
