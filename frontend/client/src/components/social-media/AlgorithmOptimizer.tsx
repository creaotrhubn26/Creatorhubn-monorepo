import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card as MuiCard,
  CardContent,
  Button,
  LinearProgress,
  Chip,
  Alert,
  Switch,
  FormControlLabel,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import {
  TrendingUp,
  Share,
  Favorite,
  Bookmark,
  Comment,
  Visibility,
  Schedule,
  Psychology,
  Speed as Speed,
  Analytics,
  CheckCircle,
  Warning,
  Error as ErrorIcon,
} from '@mui/icons-material';

interface AlgorithmMetrics {
  engagement: number;
  reach: number;
  shareability: number;
  retention: number;
  timing: number;
  contentQuality: number;
  hashtagRelevance: number;
  trendAlignment: number
}

interface OptimizationTip {
  category: string;
  message: string;
  impact: 'high' | 'medium' | 'low';
  implemented: boolean
}

interface AlgorithmOptimizerProps {
  platform: string;
  videoData?: {
    duration: number;
    aspectRatio: string;
    hasAudio: boolean;
    hasCaptions: boolean;
    hashtagCount: number;
    uploadTime: string;
};
  onOptimizationApply?: (optimizations: OptimizationTip[]) => void
}

export default function AlgorithmOptimizer({
  platform,
  videoData,
  onOptimizationApply,
}: AlgorithmOptimizerProps) {
  const queryClient = useQueryClient();
  
  // Theming system
  const theming = useTheming('photographer');

  // Database connection for AlgorithmOptimizer
  const { data: componentData = [], isLoading } = useQuery({
    queryKey: ['/api/component', 'user-data'],
    queryFn: () => apiRequest('/api/component/user-data', ),
    retry: false,
});

  // Mutation for updating component data
  const updateAlgorithmOptimizer = useMutation({
    mutationFn: async (data: any) =>
      apiRequest('/api/component/update', {
        method: 'POS',
        body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/component', ],});
  },
});

  const [metrics, setMetrics] = useState<AlgorithmMetrics>({
    engagement:  0,
    reach:  0,
    shareability:  0,
    retention:  0,
    timing:  0,
    contentQuality:  0,
    hashtagRelevance:  0,
    trendAlignment:  0,
});

  const [optimizationTips, setOptimizationTips] = useState<OptimizationTip[]>([]);
  const [analysisComplete, setAnalysisComplete] = useState(false);

  // Algoritme-optimaliserings logikk basert på 2024-2025 forskning
  const analyzeAlgorithmCompatibility = () => {
    if (!videoData) return;

    const newMetrics: AlgorithmMetrics = {
      engagement: 0,
      reach:  0,
      shareability:  0,
      retention:  0,
      timing:  0,
      contentQuality:  0,
      hashtagRelevance:  0,
      trendAlignment:  0,
  };

    const tips: OptimizationTip[] = [];

    // Engagement analyse (prioriterer saves/shares over likes/comments)
    if (videoData.aspectRatio === '9:16') {
      newMetrics.engagement += 25;
      tips.push({
        category: 'Format',
        message: 'Vertikal video format (9:16) optimalisert for mobile algoritmer',
        impact: 'high',
        implemented: true,
    });
  }

    // Duration analyse per platform
    switch (platform.toLowerCase()) {
      case 'instagram':
        if (videoData.duration >= 7 && videoData.duration <= 30) {
          newMetrics.retention += 30;
          tips.push({
            category: 'Timing',
            message: 'Optimal varighet (7-30s) for Instagram Reels algoritme',
            impact: 'high',
            implemented: true,
        });
      } else if (videoData.duration > 90) {
          newMetrics.retention += 35; // Extended duration fordel
          tips.push({
            category: 'Timing',
            message: 'Extended Duration (>90s) gir høyere algoritme prioritet',
            impact: 'high',
            implemented: true,
        });
      }
        break;
      case 'tiktok':
        if (videoData.duration >= 15 && videoData.duration <= 60) {
          newMetrics.retention += 25;
      }
        break;
      case 'youtube':
        if (videoData.duration >= 30) {
          newMetrics.retention += 20;
      }
        break;
  }

    // Audio analyse
    if (videoData.hasAudio) {
      newMetrics.engagement += 20;
      tips.push({
        category: 'Audio',
        message: 'Video med audio får høyere algoritme prioritet',
        impact: 'medium',
        implemented: true,
    });
  } else {
      tips.push({
        category: 'Audio',
        message: 'Legg til trending audio for bedre algoritme performance',
        impact: 'high',
        implemented: false,
    });
  }

    // Captions analyse
    if (videoData.hasCaptions) {
      newMetrics.contentQuality += 25;
      newMetrics.shareability += 15;
      tips.push({
        category: 'Accessibility',
        message: 'Auto-captions øker shareability og engagement',
        impact: 'medium',
        implemented: true,
    });
  } else {
      tips.push({
        category: 'Accessibility',
        message: 'Legg til AI-genererte captions for bedre algoritme score',
        impact: 'medium',
        implemented: false,
    });
  }

    // Hashtag analyse
    if (videoData.hashtagCount >= 3 && videoData.hashtagCount <= 7) {
      newMetrics.hashtagRelevance += 20;
      tips.push({
        category: 'Hashtags',
        message: 'Optimal hashtag antall (3-7) for best reach',
        impact: 'medium',
        implemented: true,
    });
  } else if (videoData.hashtagCount > 10) {
      tips.push({
        category: 'Hashtags',
        message: 'Reduser hashtag antall - algoritmer straffer over-tagging',
        impact: 'medium',
        implemented: false,
    });
  }

    // Upload timing analyse
    const uploadHour = new Date(videoData.uploadTime).getHours();
    if ((uploadHour >= 18 && uploadHour <= 21) || (uploadHour >= 11 && uploadHour <= 13)) {
      newMetrics.timing += 25;
      tips.push({
        category: 'Timing',
        message: 'Optimal upload tid for norsk publikum (11-13 eller 18-21, )',
        impact: 'medium',
        implemented: true,
    });
  }

    // Trend alignment (mock data - ville brukt real-time trend API)
    newMetrics.trendAlignment = Math.floor(Math.random() * 30) + 40;

    // Content quality heuristikk
    newMetrics.contentQuality += Math.floor(Math.random() * 20) + 30;

    // Shareability beregning
    newMetrics.shareability = (newMetrics.engagement + newMetrics.contentQuality) / 2;

    // Reach beregning basert på alle faktorer
    newMetrics.reach =
      newMetrics.engagement * 0.3 +
      newMetrics.retention * 0.25 +
      newMetrics.timing * 0.15 +
      newMetrics.hashtagRelevance * 0.15 +
      newMetrics.trendAlignment * 0.15;

    // Platform-spesifikke optimaliseringer
    if (platform.toLowerCase() === 'instagram') {
      tips.push({
        category: 'Instagram-spesifikk',
        message: 'Algoritmen prioriterer saves over likes - oppfordre til å lagre',
        impact: 'high',
        implemented: false,
    });
      tips.push({
        category: 'Instagram-spesifikk',
        message: 'Bruk Trial Reels for å teste med ikke-følgere først',
        impact: 'medium',
        implemented: false,
    });
  }

    setMetrics(newMetrics);
    setOptimizationTips(tips);
    setAnalysisComplete(true);
};

  useEffect(() => {
    if (videoData) {
      setAnalysisComplete(false);
      // Simuler analyse-delay
      const timer = setTimeout(() => {
        analyzeAlgorithmCompatibility();
    }, 2000);
      return () => clearTimeout(timer);
  }
}, [videoData, platform]);

  const getScoreColor = (score: number) => {
    if (score >= 70) return '#4caf50';
    if (score >= 50) return '#ff9800';
    return '#f44336';
};

  const getImpactIcon = (impact: string) => {
    switch (impact) {
      case 'high':
        return <TrendingUp sx={{ color: '#f44336'}} />;
      case 'medium':
        return <Analytics sx={{ color: '#ff9800'}} />;
      case 'low':
        return <Speed sx={{ color: '#4caf50'}} />;
      default: return <Psychology />;
}
};

  if (!videoData) {
    return (
      <Alert severity="info">
        Last opp en video for å få algoritme-analyse og optimaliseringstips
      </Alert>
    );
}

  return (
    <Box>
      <Typography variant="h6" sx={{  fontWeight: 'bold', mb:  2  }}>
        {platform} Algoritme-optimalisering
      </Typography>

      {!analysisComplete ? (
        <Box sx={{ mb:  3 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb:  1 }}>
            Analyserer video for {platform} algoritme-kompatibilitet...
          </Typography>
          <LinearProgress />
        </Box>
      ) : (
        <>
          {/* Algorithm Score Cards */}
          <Grid container spacing={2} sx={{ mb:  3 }}>
            <Grid item xs={6} sm={3}>
              <MuiCard>
                <CardContent sx={{ textAlign: 'center', py:  2 ,  ...theming.getThemedCardSx() }}>
                  <Favorite sx={{ color: getScoreColor(metrics.engagement), mb:  1 }} />
                  <Typography variant="h6"
                    sx={{ 
                      color: getScoreColor(metrics.engagement),
                      fontWeight: 'bold' }}>
                    {Math.round(metrics.engagement)}%
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Engagement
                  </Typography>
                </CardContent>
              </MuiCard>
            </Grid>
            <Grid item xs={6} sm={3}>
              <MuiCard>
                <CardContent sx={{ textAlign: 'center', py:  2 ,  ...theming.getThemedCardSx() }}>
                  <Visibility sx={{ color: getScoreColor(metrics.reach), mb:  1 }} />
                  <Typography variant="h6"
                    sx={{ 
                      color: getScoreColor(metrics.reach),
                      fontWeight: 'bold' }}>
                    {Math.round(metrics.reach)}%
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Reach
                  </Typography>
                </CardContent>
              </MuiCard>
            </Grid>
            <Grid item xs={6} sm={3}>
              <MuiCard>
                <CardContent sx={{ textAlign: 'center', py:  2 ,  ...theming.getThemedCardSx() }}>
                  <Share sx={{ color: getScoreColor(metrics.shareability), mb:  1 }} />
                  <Typography variant="h6"
                    sx={{ 
                      color: getScoreColor(metrics.shareability),
                      fontWeight: 'bold' }}>
                    {Math.round(metrics.shareability)}%
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Shareability
                  </Typography>
                </CardContent>
              </MuiCard>
            </Grid>
            <Grid item xs={6} sm={3}>
              <MuiCard>
                <CardContent sx={{ textAlign: 'center', py:  2 ,  ...theming.getThemedCardSx() }}>
                  <Schedule sx={{ color: getScoreColor(metrics.retention), mb:  1 }} />
                  <Typography variant="h6"
                    sx={{ 
                      color: getScoreColor(metrics.retention),
                      fontWeight: 'bold' }}>
                    {Math.round(metrics.retention)}%
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Retention
                  </Typography>
                </CardContent>
              </MuiCard>
            </Grid>
          </Grid>

          {/* Overall Score */}
          <MuiCard sx={{ mb:  3, bgcolor: 'rgba(6, 175, 80, 0.1)' }}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'}}
              >
                <Box>
                  <Typography variant="h6" sx={{  fontWeight: 'bold' }}>
                    Samlet Algoritme Score
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Basert på {platform} algoritme-faktorer (2024-2025)
                  </Typography>
                </Box>
                <Typography variant="h3"
                  sx={{ 
                    fontWeight: 'bold',
                    color: getScoreColor(metrics.reach) }}>
                  {Math.round(
                    (metrics.engagement +
                      metrics.reach +
                      metrics.shareability +
                      metrics.retention) /
                      4,
                  )}
                  %
                </Typography>
              </Box>
            </CardContent>
          </MuiCard>

          {/* Optimization Tips */}
          <MuiCard>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" sx={{  fontWeight: 'bold', mb:  2  }}>
                Optimaliseringstips
              </Typography>
              <List dense>
                {optimizationTips.map((tip, index) => (
                  <ListItem key={index} divider>
                    <ListItemIcon>
                      {tip.implemented ? (
                        <CheckCircle sx={{ color: '#4caf50'}} />
                      ) : (
                        getImpactIcon(tip.impact)
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary={tip.message}
                      secondary={
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap:  1,
                            mt: 0.5}}
                        >
                          <Chip label={tip.category} size="small" variant="outlined" />
                          <Chip
                            label={`${tip.impact} impact`}
                            size="small"
                            color={
                              tip.impact === 'high'
                                ? 'error'
                                : tip.impact === 'medium'
                                  ? 'warning' : 'success'
                          }
                            variant="outlined"
                          />
                          {tip.implemented && (
                            <Chip label="Implementert" size="small" color="success" />
                          )}
                        </Box>
                    }
                    />
                  </ListItem>
                ))}
              </List>

              <Button variant="contained"
                fullWidth
                sx={{ mt:  2 }}
                onClick={() => onOptimizationApply?.(optimizationTips)}
              >
                Anvend Alle Optimaliseringer
              </Button>
            </CardContent>
          </MuiCard>
        </>
      )}
    </Box>
  );
}
