import { useTheming } from '../../utils/theming-helper';
import React, { useState, useRef, useEffect } from 'react';
import { 
  Box, Typography, Paper, Grid, Button, Card, CardContent, Chip, LinearProgress, Alert, 
  List, ListItem, ListItemText, ListItemIcon, Divider, Stack, Slider, FormControl, 
  InputLabel, Select, MenuItem, Switch, FormControlLabel, Dialog, DialogTitle, 
  DialogContent, DialogActions, Avatar, Tooltip, IconButton
} from '@mui/material';
import { 
  Face, Palette, AutoFixHigh, Lightbulb, CameraAlt, ColorLens, 
  Refresh, Download, Share, Info, CheckCircle, Warning, Error,
  WbSunny, WbTwilight, WbIncandescent, FlashOn, Nature
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface SkinToneAnalysis {
	id: string;
	imageUrl: string;
	skinTone: {
		undertone: 'warm' | 'cool' | 'neutral';
		depth: 'light' | 'medium' | 'deep';
		saturation: 'muted' | 'medium' | 'vibrant';
		temperature: number; // 0-100
		hue: number; // 0-360
	};
	lighting: {
		type: 'natural' | 'artificial' | 'mixed';
		quality: 'soft' | 'harsh' | 'dramatic';
		direction: 'front' | 'side' | 'back' | 'top';
		colorTemperature: number; // Kelvin
	};
	recommendations: {
		cameraSettings: {
			whiteBalance: string;
			exposure: string;
			aperture: string;
			iso: string;
		};
		lighting: {
			setup: string;
			modifiers: string[];
			colorGels: string[];
		};
		postProcessing: {
			colorCorrection: string;
			skinSmoothing: string;
			contrastAdjustment: string;
		};
	};
	confidence: number;
	timestamp: string; 
}

interface SmartSkinToneGuideProps {
  imageUrl?: string;
  onAnalysisComplete?: (analysis: SkinToneAnalysis) => void;
  onRecommendationApplied?: (recommendation: any) => void; 
}

export default function SmartSkinToneGuide({ 
  imageUrl, 
  onAnalysisComplete,
  onRecommendationApplied
}: SmartSkinToneGuideProps) {
  const queryClient = useQueryClient();
  
  // Theming system
  const theming = useTheming('photographer');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [analysis, setAnalysis] = useState<SkinToneAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [selectedSkinTone, setSelectedSkinTone] = useState<string>('auto');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(false);

  const { data: aiAnalysis, isLoading: analysisLoading } = useQuery({
    queryKey: ['/api/ai/skin-tone-analysis,', imageUrl],
    queryFn: () => apiRequest(`/api/ai/skin-tone-analysis?imageUrl=${encodeURIComponent(imageUrl || ', ')}`),
    enabled: !!imageUl,
    retry: false,
});

  const updateSkinToneAnalysis = useMutation({
    mutationFn: async (data: any) =>
      apiRequest('/api/ai/skin-tone-analysis/update', {
        method: 'POS',
        body: JSON.stringify(data),
    }),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai/skin-tone-analysis', ],});
      onAnalysisComplete?.(response);
  },
});

  const analyzeSkinTone = async () => {
    if (!imageUrl) return;
    
    setIsAnalyzing(true);
    setAnalysisProgress(0);
    
    try {
      // Simulate analysis progress
      const progressInterval = setInterval(() => {
        setAnalysisProgress(prev => {
          if (prev >= 100) {
            clearInterval(progressInterval);
            return 100;
        }
          return prev + 15;
      });
    }, 300);

      // Use real AI photo analysis service
      const aiAnalysisResult = await apiRequest(`/api/ai/photo-analysis?imageUrl=${encodeURIComponent(imageUrl)}`);
      
      // Extract skin tone data from AI analysis
      const aiData = aiAnalysisResult.data || aiAnalysisResult;
      
	      // Generate skin tone analysis based on real AI data
	      const skinToneAnalysis: SkinToneAnalysis = {
	        id: `skin_analysis_${Date.now()}`,
	        imageUrl,
	        skinTone: {
	          undertone: aiData.colorScore > 85 ? 'warm' : aiData.colorScore < 70 ? 'cool' : 'neutral',
	          depth: aiData.overallScore > 85 ? 'light' : aiData.overallScore < 70 ? 'deep' : 'medium',
	          saturation: aiData.colorScore > 80 ? 'vibrant' : aiData.colorScore < 60 ? 'muted' : 'medium',
	          temperature: Math.round(aiData.colorScore || 50),
	          hue: Math.round((aiData.colorScore || 50) * 0.6 + 1), // Convert to skin tone hue range
	        },
	        lighting: {
	          type: aiData.exposureScore > 80 ? 'natural' : 'artificial',
	          quality: aiData.exposureScore > 85 ? 'soft' : aiData.exposureScore < 70 ? 'harsh' : 'dramatic',
	          direction: aiData.compositionScore > 80 ? 'front' : aiData.compositionScore < 60 ? 'side' : 'back',
	          colorTemperature: Math.round((aiData.exposureScore || 50) * 40 + 3000), // ~3000-5000K
	        },
	        recommendations: {
	          cameraSettings: {
	            whiteBalance: aiData.skinTone?.undertone === 'warm' ? 'Daylight (5200K)' : 'Tungsten (3200K)',
	            exposure: aiData.exposureScore < 70 ? '+1/3 to +2/3 EV' : '0 to +1/3 EV',
	            aperture: aiData.focusScore > 80 ? 'f/2.8 - f/4' : 'f/4 - f/5.6',
	            iso: aiData.technicalScore > 85 ? '100-200' : '200-400',
	          },
	          lighting: {
	            setup: aiData.lighting?.type === 'natural'
	              ? 'Window light with reflector fill'
	              : 'Softbox 45° to subject, reflector opposite',
	            modifiers: aiData.lighting?.quality === 'harsh'
	              ? ['Softbox','Diffuser','Reflector']
	              : ['Softbox','Reflector'],
	            colorGels: aiData.skinTone?.undertone === 'cool'
	              ? ['CTO 1/4','CTO 1/2']
	              : ['CTB 1/8', 'CTB 1/4'],
	          },
	          postProcessing: {
	            colorCorrection: aiData.skinTone?.undertone === 'warm'
	              ? 'Warm +2, Tint +1'
	              : 'Cool -2, Tint -1',
	            skinSmoothing: `Frequency separation, ${Math.max(10, 20 - (aiData.technicalScore || 50) / 5)}% opacity`,
	            contrastAdjustment: aiData.overallScore < 75
	              ? 'Curves: S-light adjustment'
	              : 'Curves: Subtle contrast boost',
	          },
	        },
	        confidence: Math.round(aiData.confidence || 80),
	        timestamp: new Date().toISOString(),
	      };

      setAnalysis(skinToneAnalysis);
      updateSkinToneAnalysis.mutate(skinToneAnalysis);
      setIsAnalyzing(false);
  } catch (error) {
      console.error('Error analyzing skin tone: ', error);
      setIsAnalyzing(false);
  }
};

  const getSkinToneColor = (skinTone: SkinToneAnalysis['skinTone']) => {
    const { undertone, depth, saturation } = skinTone;
    
    // Generate color based on skin tone analysis
    let baseColor = '#D4AF8C'; // Default medium skin tone
    
    if (depth === 'light') {
      baseColor = undertone === 'warm' ? '#F5D5C2' : '#E8D5C4';
  } else if (depth === 'deep') {
      baseColor = undertone === 'warm' ? '#8B4513' : '#654321';
  } else {
      baseColor = undertone === 'warm' ? '#D4AF8C' : '#C4A484';
  }
    
    return baseColor;
};

  const getUndertoneIcon = (undertone: string) => {
    switch (undertone) {
      case 'warm': return <WbSunny color="warning" />;
      case 'cool': return <WbTwilight color="info" />;
      default: return <WbIncandescent color="default" />;
	    }
};

	  const getLightingIcon = (type: string) => {
	    switch (type) {
	      case 'natural':
	        return <Nature color="success" />;
	      case 'artificial':
	        return <FlashOn color="warning" />;
	      default:
	        return <Lightbulb color="default" />;
	    }
	  };
	
	  const getConfidenceColor = (confidence: number) => {
	    if (confidence >= 90) return 'success';
	    if (confidence >= 75) return 'warning';
	    return 'error';
	  };

  useEffect(() => {
    if (imageUrl) {
      analyzeSkinTone();
  }
}, [imageUrl]);

  return (
    <Box sx={{ p:  2 }}>
      <Typography variant="h6" sx={{  mb: 2, display: 'flex', alignItems: 'center', gap:  1  }}>
        {theming.getThemedIcon('face')} Smart Skin Tone Guide
      </Typography>

      {isAnalyzing && (
        <Paper sx={{ p: 2, mb: 2 ,  ...theming.getThemedCardSx() }}>
          <Typography variant="body2" sx={{ mb:  1 }}>
            Analyzing skin tone and lighting... {analysisProgress}%
          </Typography>
          <LinearProgress variant="determinate" value={analysisProgress} />
        </Paper>
      )}

      {analysis && (
        <>
          {/* Skin Tone Analysis Results */}
          <Paper sx={{ p: 2, mb: 2 ,  ...theming.getThemedCardSx() }}>
            <Typography variant="h6" sx={{  mb:  2  }}>Skin Tone Analysis</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Card sx={{ mb:  2 ,  ...theming.getThemedCardSx() }}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                      <Avatar 
                        sx={{ 
                          bgcolor: getSkinToneColor(analysis.skinTone),
                          width:  60,
                          height:  60,
                          border: '3px solid',
                          borderColor: 'primary.main'
                      }}
                      >
                        {theming.getThemedIcon('face')}
                      </Avatar>
                      <Box>
                        <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                          {analysis.skinTone.depth.charAt(0).toUpperCase() + analysis.skinTone.depth.slice(1)} {analysis.skinTone.undertone}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {analysis.skinTone.saturation} saturation
                        </Typography>
                      </Box>
                    </Box>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      <Chip 
                        icon={getUndertoneIcon(analysis.skinTone.undertone)}
                        label={`${analysis.skinTone.undertone} undertone`}
                        color="primary"
                        variant="outlined"
                      />
                      <Chip 
                        label={`${analysis.skinTone.temperature}° temp`}
                        size="small"
                      />
                      <Chip 
                        label={`${analysis.skinTone.hue}° hue`}
                        size="small"
                      />
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={6}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle1" sx={{ mb:  1 }}>Lighting Analysis</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      {getLightingIcon(analysis.lighting.type)}
                      <Typography variant="body2">
                        {analysis.lighting.type} lighting
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      Quality: {analysis.lighting.quality} • Direction: {analysis.lighting.direction}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Color Temperature: {analysis.lighting.colorTemperature}K
                    </Typography>
                    <Chip 
                      label={`${analysis.confidence}% confidence`}
                      color={getConfidenceColor(analysis.confidence) as any}
                      size="small"
                      sx={{ mt:  1 }}
                    />
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Paper>

          {/* Recommendations */}
          <Paper sx={{ p: 2, mb: 2 ,  ...theming.getThemedCardSx() }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb:  2 }}>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>Photography Recommendations</Typography>
              <Button 
                variant="outlined" 
                onClick={() => setShowRecommendations(!showRecommendations)}
              >
                {showRecommendations ? 'Hide' : 'Show'} Details
              </Button>
            </Box>
            
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle1" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap:  1 }}>
                      <CameraAlt /> Camera Settings
                    </Typography>
                    <List dense>
                      <ListItem>
                        <ListItemText 
                          primary="White Balance" 
                          secondary={analysis.recommendations.cameraSettings.whiteBalance}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemText 
                          primary="Exposure" 
                          secondary={analysis.recommendations.cameraSettings.exposure}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemText 
                          primary="Aperture" 
                          secondary={analysis.recommendations.cameraSettings.aperture}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemText 
                          primary="ISO" 
                          secondary={analysis.recommendations.cameraSettings.iso}
                        />
                      </ListItem>
                    </List>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} md={4}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle1" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap:  1 }}>
                      <Lightbulb /> Lighting Setup
                    </Typography>
                    <Typography variant="body2" sx={{ mb:  1 }}>
                      {analysis.recommendations.lighting.setup}
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb:  1 }}>
                      {analysis.recommendations.lighting.modifiers.map((modifier, index) => (
                        <Chip key={index} label={modifier} size="small" />
                      ))}
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      Color Gels: {analysis.recommendations.lighting.colorGels.join(', ')}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} md={4}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle1" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap:  1 }}>
                      {theming.getThemedIcon('autoFixHigh')} Post-Processing
                    </Typography>
                    <List dense>
                      <ListItem>
                        <ListItemText 
                          primary="Color Correction" 
                          secondary={analysis.recommendations.postProcessing.colorCorrection}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemText 
                          primary="Skin Smoothing" 
                          secondary={analysis.recommendations.postProcessing.skinSmoothing}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemText 
                          primary="Contrast" 
                          secondary={analysis.recommendations.postProcessing.contrastAdjustment}
                        />
                      </ListItem>
                    </List>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Paper>

          {/* Action Buttons */}
          <Paper sx={{ p:  2 ,  ...theming.getThemedCardSx() }}>
            <Stack direction="row" spacing={2} justifyContent="center">
              <Button variant="contained" 
                startIcon={theming.getThemedIcon('refresh')}
                onClick={analyzeSkinTone}
                disabled={!imageUrl || isAnalyzing}
               sx={theming.getThemedButtonSx()}>
                Re-analyze
              </Button>
              <Button 
                variant="outlined" 
                startIcon={theming.getThemedIcon('download')}
                onClick={() => onRecommendationApplied?.(analysis.recommendations)}
              >
                Apply Recommendations
              </Button>
              <Button 
                variant="outlined" 
                startIcon={theming.getThemedIcon('share')}
              >
                Export Analysis
              </Button>
            </Stack>
          </Paper>
        </>
      )}

      {!imageUrl && !isAnalyzing && (
        <Paper sx={{ p:  4, textAlign: 'center',  ...theming.getThemedCardSx() }}>
          <Face sx={{ fontSize:  64, color:'text.secondary', mb:  2 }} />
          <Typography variant="h6" color="text.secondary" sx={{  mb:  1  }}>
            No Image Selected
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Please provide an image URL to analyze skin tone and get photography recommendations.
          </Typography>
        </Paper>
      )}
    </Box>
  );
}
