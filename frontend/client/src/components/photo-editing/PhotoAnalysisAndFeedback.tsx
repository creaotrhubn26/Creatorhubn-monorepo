import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Grid, 
  Button, 
  Card,
  CardContent,
  Chip,
  LinearProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Stack,
  Rating,
  Slider,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import { 
  Photo, 
  AutoFixHigh, 
  Analytics, 
  Lightbulb, 
  Warning,
  CheckCircle,
  Error,
  Refresh,
  Download,
  Share
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { sam2Service } from '@/services/SAM2Service';

interface PhotoAnalysis {
  id: string;
  imageUrl: string;
  overallScore: number;
  technicalScore: number;
  compositionScore: number;
  colorScore: number;
  exposureScore: number;
  focusScore: number;
  suggestions: Suggestion[];
  tags: string[];
  metadata: {
    camera?: string;
    lens?: string;
    settings?: string;
    location?: string;
	    date?: string;
	  };
  aiInsights: {
    mood: string;
    style: string;
    quality: string;
    improvements: string[];
	  };
}

interface Suggestion {
  id: string;
  type: 'improvement' | 'warning' | 'tip';
  category: 'composition' | 'exposure' | 'color' | 'focus' | 'technical';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  confidence: number;
  action?: string; 
}

interface PhotoAnalysisAndFeedbackProps {
  imageUrl?: string;
  onAnalysisComplete?: (analysis: PhotoAnalysis) => void;
  onSuggestionApplied?: (suggestion: Suggestion) => void;
  profession?: 'photographer' | 'videographer' | 'music_producer' | 'vendor';
}

export default function PhotoAnalysisAndFeedback({ 
  imageUrl, 
  onAnalysisComplete,
  onSuggestionApplied,
  profession = 'photographer'
}: PhotoAnalysisAndFeedbackProps) {
  const queryClient = useQueryClient();
  
  // Theming system - use dynamic profession
  const theming = useTheming(profession);
  const [analysis, setAnalysis] = useState<PhotoAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showOnlyHighPriority, setShowOnlyHighPriority] = useState(false);

  // Fetch AI analysis
  const { data: aiAnalysis, isLoading: analysisLoading } = useQuery({
    queryKey: [ '/api/ai/photo-analysis,', imageUrl],
    queryFn: () => apiRequest(`/api/ai/photo-analysis?imageUrl=${encodeURIComponent(imageUrl || '')}`),
    enabled: !!imageUl,
    retry: false,
});

  // Mutation for updating analysis
  const updateAnalysis = useMutation({
    mutationFn: async (data: any) =>
      apiRequest('/api/ai/photo-analysis/update', {
        method: 'POS',
        body: JSON.stringify(data),
    }),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai/photo-analysis', ],});
      onAnalysisComplete?.(response);
  },
});

  // Analyze photo
  const analyzePhoto = async () => {
    if (!imageUrl) return;

    setIsAnalyzing(true);
    setAnalysisProgress(0);

    try {
      // Step 1: Object detection with SAM 2
      setAnalysisProgress(20);
      let detectedObjects: any[] = [];
      try {
        const objectResult = await sam2Service.segmentImageFromUrl(imageUrl, undefined, 'auto', 'small');
        detectedObjects = objectResult.masks || [];
        setAnalysisProgress(40);
      } catch (error) {
        console.warn('SAM 2 object detection failed, continuing without it: ', error);
      }

      // Simulate remaining analysis progress
      const progressInterval = setInterval(() => {
        setAnalysisProgress(prev => {
          if (prev >= 100) {
            clearInterval(progressInterval);
            return 100;
        }
          return prev + 10;
      });
    }, 200);

      // Simulate AI analysis
      await new Promise(resolve => setTimeout(resolve, 2000));

      const mockAnalysis: PhotoAnalysis = {
        id: `analysis_${Date.now()}`,
        imageUrl,
        overallScore: Math.round(Math.random() * 40 + 6), // 60-100
        technicalScore: Math.round(Math.random() * 40 + 6),
        compositionScore: Math.round(Math.random() * 40 + 6),
        colorScore: Math.round(Math.random() * 40 + 6),
        exposureScore: Math.round(Math.random() * 40 + 6),
        focusScore: Math.round(Math.random() * 40 + 6),
        suggestions: [
          // Add object-based composition suggestions if objects detected
          ...(detectedObjects.length > 0 ? [{
            id: 'suggestion_objects',
            type: 'tip' as const,
            category: 'composition' as const,
            title: `Object Detection: ${detectedObjects.length} object(s) found`,
            description: `Detected ${detectedObjects.length} object(s) in the image. Consider adjusting composition to better highlight the main subject.`,
            priority: 'medium' as const,
            confidence: Math.round(detectedObjects.reduce((sum, obj) => sum + obj.confidence, 0) / detectedObjects.length * 100),
            action: 'View object positions'
          }] : []),
          {
            id: 'suggestion_',
            type: 'improvement',
            category: 'composition',
            title: 'Rule of Thirds',
            description: 'Consider repositioning the main subject to align with the rule of thirds grid lines for better visual balance.',
            priority: 'high',
            confidence:  85,
            action: 'Apply rule of thirds crop'
          },
          {
            id: 'suggestion_',
            type: 'tip',
            category: 'exposure',
            title: 'Exposure Adjustment',
            description: 'The image appears slightly underexposed. Try increasing exposure by 0.3-0.5 stops.',
            priority: 'medium',
            confidence:  92,
            action: 'Auto-exposure correction'
          },
          {
            id: 'suggestion_',
            type: 'warning',
            category: 'focus',
            title: 'Focus Issue',
            description: 'Some areas appear slightly soft. Consider using a smaller aperture or adjusting focus point.',
            priority: 'high',
            confidence:  78,
            action: 'Sharpness enhancement'
          },
          {
            id: 'suggestion_',
            type: 'improvement',
            category: 'color',
            title: 'Color Balance',
            description: 'The white balance could be adjusted to reduce the warm cast and achieve more natural colors.',
            priority: 'medium',
            confidence:  88,
            action: 'Auto white balance'
          }
        ],
        tags: ['portrait','outdoor','natural-light','professional'],
        metadata: {
          camera: 'Canon EOS R',
          lens: 'RF 85mm f/1.2L US',
          settings: 'f/2, 1/125s, ISO 400',
          location: 'Studio',
          date: new Date().toISOString(),
        },
        aiInsights: {
          mood: 'Professional and confident',
          style: 'Portrait photography',
          quality: 'High quality with minor improvements needed',
          improvements: [
            'Enhance composition using rule of thirds','Adjust exposure for better lighting', 'Improve focus sharpness', 'Fine-tune color balance',
          ],
        },
    };

      setAnalysis(mockAnalysis);
      updateAnalysis.mutate(mockAnalysis);
      setIsAnalyzing(false);
  } catch (error) {
      console.error('Error analyzing photo:', error);
      setIsAnalyzing(false);
  }
};

  // Auto-analyze when image URL changes
  useEffect(() => {
    if (imageUrl) {
      analyzePhoto();
  }
}, [imageUrl]);

  // Filter suggestions
  const filteredSuggestions = analysis?.suggestions.filter(suggestion => {
    if (selectedCategory !== 'all' && suggestion.category !== selectedCategory) {
      return false;
  }
    if (showOnlyHighPriority && suggestion.priority !== 'high') {
      return false;
  }
    return true;
}) || [];

  // Get score color
  const getScoreColor = (score: number) => {
    if (score >= 90) return 'success';
    if (score >= 70) return 'warning';
    return 'error';
  };

  // Get priority color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      case 'low':
        return 'info';
      default:
        return 'default';
    }
  };

  // Get category icon
  const getCategoryIcon = (category: string) => {
	    switch (category) {
	      case 'composition':
	        return <Photo />;
	      case 'exposure':
	        return <Lightbulb />;
	      case 'color':
	        return theming.getThemedIcon('palette');
	      case 'focus':
	        return theming.getThemedIcon('analytics');
	      case 'technical':
	        return theming.getThemedIcon('warning');
	      default:
	        return <Photo />;
	    }
	  };

  return (
    <Box sx={{ p:  2 }}>
      <Typography variant="h6" sx={{  mb: 2, display: 'flex', alignItems: 'center', gap:  1  }}>
        {theming.getThemedIcon('analytics')}
        AI Photo Analysis & Feedback
      </Typography>

      {/* Analysis Progress */}
      {isAnalyzing && (
        <Paper sx={{ p: 2, mb: 2 ,  ...theming.getThemedCardSx() }}>
          <Typography variant="body2" sx={{ mb:  1 }}>
            Analyzing photo with AI... {analysisProgress}%
          </Typography>
          <LinearProgress variant="determinate" value={analysisProgress} />
        </Paper>
      )}

      {/* Analysis Results */}
      {analysis && (
        <>
          {/* Overall Scores */}
          <Paper sx={{ p: 2, mb: 2 ,  ...theming.getThemedCardSx() }}>
            <Typography variant="h6" sx={{  mb:  2  }}>
              Analysis Scores
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={2}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={{ textAlign: 'center',  ...theming.getThemedCardSx() }}>
                    <Typography variant="h4" color={getScoreColor(analysis.overallScore)} sx={{ color: theming.colors.primary }}>
                      {analysis.overallScore}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Overall
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={{ textAlign: 'center',  ...theming.getThemedCardSx() }}>
                    <Typography variant="h6" color={getScoreColor(analysis.technicalScore)} sx={{ color: theming.colors.primary }}>
                      {analysis.technicalScore}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Technical
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={{ textAlign: 'center',  ...theming.getThemedCardSx() }}>
                    <Typography variant="h6" color={getScoreColor(analysis.compositionScore)} sx={{ color: theming.colors.primary }}>
                      {analysis.compositionScore}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Composition
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={{ textAlign: 'center',  ...theming.getThemedCardSx() }}>
                    <Typography variant="h6" color={getScoreColor(analysis.colorScore)} sx={{ color: theming.colors.primary }}>
                      {analysis.colorScore}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Color
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={{ textAlign: 'center',  ...theming.getThemedCardSx() }}>
                    <Typography variant="h6" color={getScoreColor(analysis.exposureScore)} sx={{ color: theming.colors.primary }}>
                      {analysis.exposureScore}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Exposure
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={{ textAlign: 'center',  ...theming.getThemedCardSx() }}>
                    <Typography variant="h6" color={getScoreColor(analysis.focusScore)} sx={{ color: theming.colors.primary }}>
                      {analysis.focusScore}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Focus
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Paper>

          {/* AI Insights */}
          <Paper sx={{ p: 2, mb: 2 ,  ...theming.getThemedCardSx() }}>
            <Typography variant="h6" sx={{  mb:  2  }}>
              AI Insights
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="body2" color="text.secondary" sx={{ mb:  1 }}>
                  Mood: <strong>{analysis.aiInsights.mood}</strong>
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb:  1 }}>
                  Style: <strong>{analysis.aiInsights.style}</strong>
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Quality: <strong>{analysis.aiInsights.quality}</strong>
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {analysis.tags.map((tag, index) => (
                    <Chip key={index} label={tag} size="small" color="primary" />
                  ))}
                </Stack>
              </Grid>
            </Grid>
          </Paper>

          {/* Suggestions */}
          <Paper sx={{ p: 2, mb: 2 ,  ...theming.getThemedCardSx() }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb:  2 }}>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                Suggestions ({filteredSuggestions.length})
              </Typography>
              <Box sx={{ display: 'flex', gap:  2 }}>
                <FormControl size="small" sx={{ minWidth: 120}}>
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                  >
                    <MenuItem value="all">All Categories</MenuItem>
                    <MenuItem value="composition">Composition</MenuItem>
                    <MenuItem value="exposure">Exposure</MenuItem>
                    <MenuItem value="color">Color</MenuItem>
                    <MenuItem value="focus">Focus</MenuItem>
                    <MenuItem value="technical">Technical</MenuItem>
                  </Select>
                </FormControl>
                <Button
                  variant={showOnlyHighPriority ? "contained" : "outlined"}
                  size="small"
                  onClick={() => setShowOnlyHighPriority(!showOnlyHighPriority)}
                >
                  High Priority Only
                </Button>
              </Box>
            </Box>

            <List>
              {filteredSuggestions.map((suggestion, index) => (
                <ListItem key={suggestion.id} divider>
                  <ListItemIcon>
                    {getCategoryIcon(suggestion.category)}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Typography variant="subtitle1">
                          {suggestion.title}
                        </Typography>
                        <Chip 
                          label={suggestion.priority} 
                          color={getPriorityColor(suggestion.priority) as any}
                          size="small"
                        />
                        <Chip 
                          label={`${suggestion.confidence}% confidence`}
                          size="small"
                          variant="outlined"
                        />
                      </Box>
                  }
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb:  1 }}>
                          {suggestion.description}
                        </Typography>
                        {suggestion.action && (
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => onSuggestionApplied?.(suggestion)}
                          >
                            {suggestion.action}
                          </Button>
                        )}
                      </Box>
                  }
                  />
                </ListItem>
              ))}
            </List>
          </Paper>

          {/* Metadata */}
          {analysis.metadata && (
            <Paper sx={{ p:  2 ,  ...theming.getThemedCardSx() }}>
              <Typography variant="h6" sx={{  mb:  2  }}>
                Photo Metadata
              </Typography>
              <Grid container spacing={2}>
                {Object.entries(analysis.metadata).map(([key, value]) => (
                  <Grid item xs={12} sm={6} md={4} key={key}>
                    <Typography variant="body2" color="text.secondary">
                      {key.charAt(0).toUpperCase() + key.slice(1)}:
                    </Typography>
                    <Typography variant="body2">
                      {value}
                    </Typography>
                  </Grid>
                ))}
              </Grid>
            </Paper>
          )}
        </>
      )}

      {/* No Image Message */}
      {!imageUrl && !isAnalyzing && (
        <Paper sx={{ p:  4, textAlign:'center',  ...theming.getThemedCardSx() }}>
          <Typography variant="body1" color="text.secondary">
            No image selected for analysis. Please provide an image URL to analyze.
          </Typography>
        </Paper>
      )}
    </Box>
  );
}
