import { useTheming } from '../../../utils/theming-helper';
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useDemoMode, useDemoModeData } from '@/contexts/DemoModeContext';
import { 
  Box, Typography, Card, CardContent, Grid, Button, Slider, Chip, LinearProgress, 
  Alert, Select, MenuItem, FormControl, InputLabel, Dialog, DialogTitle, 
  DialogContent, DialogActions, List, ListItem, ListItemText, Divider
} from '@mui/material';
import { 
  PhotoCamera, AutoFixHigh, Brightness6, Contrast, Palette, Face, Tune, 
  CloudUpload, FolderOpen, Save, Assessment, CloudDone, ZoomIn, CompareArrows, Fullscreen,
  ZoomOut, ViewColumn, VisibilityOff, Compare, Layers, SwapHoriz, Opacity, Close,
  PanTool, FitScreen, CenterFocusStrong, Visibility, RotateLeft, RotateRight, GridOn
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import ProgressTracking from '../../photo-enhancer/ProgressTracking';
import CompositionGuides from '../../photo-enhancer/CompositionGuides';
import { CompositionAnalysisResult, compositionAnalyzer } from '@/services/composition-analysis';
import EnhancementRatingDialog from '../../ai-training/EnhancementRatingDialog';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../hooks/useDynamicProfessions';

interface CreatorHubPhotoEnhancerProps {
  profession?: 'photographer' | 'videographer' | 'musicproducer' | 'vendor';
}

export default function CreatorHubPhotoEnhancer({ 
  profession: professionProp
}: CreatorHubPhotoEnhancerProps) {
  const { isDemoMode } = useDemoMode();
  
  // Dynamic profession system integration
  const { profession: professionFromAdapter } = useProfessionAdapter();
  const { professionConfigs } = useProfessionConfigs();
  const { getProfessionConfig } = useDynamicProfessions();
  
  // Use profession from prop, adapter, or fallback
  const profession = professionProp || professionFromAdapter || 'photographer';
  
  // Get profession-specific configuration
  const currentProfessionConfig = getProfessionConfig(profession);
  const professionConfig = professionConfigs?.[profession];
  const professionIcon = getProfessionIcon(profession);
  
  // Theming system - use dynamic profession
  const theming = useTheming(profession);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activePreset, setActivePreset] = useState<string>('auto');
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [originalImageUrl, setOriginalImageUrl] = useState<string>('');
  const [enhancedImageUrl, setEnhancedImageUrl] = useState<string>('');
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [showComparison, setShowComparison] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'side-by-side' | 'slider' | 'overlay' | 'difference'>('side-by-side');
  const [sliderPosition, setSliderPosition] = useState(50);
  const [overlayOpacity, setOverlayOpacity] = useState(50);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [progressSessionId, setProgressSessionId] = useState<string>('');
  const [showProgress, setShowProgress] = useState(false);
  const [historySessionId, setHistorySessionId] = useState<string>('');
  const [showCompositionGuides, setShowCompositionGuides] = useState(false);
  const [compositionAnalysis, setCompositionAnalysis] = useState<CompositionAnalysisResult | null>(null);
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null);
  const [showRatingDialog, setShowRatingDialog] = useState(false);

  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Get demo data when in demo mode
  const demoProjects = useDemoModeData<any>('projects', []);

  // Get profession color from config or fallback
  const color = currentProfessionConfig?.iconColor || 
                professionConfig?.color || 
                professionConfig?.iconColor || 
                theming.colors.primary;

  // Enhancement presets
  const presets = [
    { 
      id: 'auto', 
      name: 'Auto Enhancer', 
      description: 'Automatisk optimalisering',
      icon: AutoFixHigh 
},
    { 
      id: 'portrait', 
      name: 'Portrait Pro', 
      description: 'Ansiktsfokusert forbedring',
      icon: Face 
},
    { 
      id: 'landscape', 
      name: 'Landscape Master', 
      description: 'Naturbilder og landskap',
      icon: Palette 
},
    { 
      id: 'studio', 
      name: 'Studio Perfect', 
      description: 'Studio og profesjonelle portretter',
      icon: Brightness6 }
  ];

  // AI Features status
  const aiFeatures = [
    { 
      name: 'Real-ESRGAN Super Resolution', 
      description: 'AI-basert oppskalering og skarphet',
      enabled: true 
},
    { 
      name: 'GFPGAN Face Enhancement', 
      description: 'Ansiktsforbedring og hudutjevning',
      enabled: true 
},
    { 
      name: 'CodeFormer Restoration', 
      description: 'Gjenopprettingsalgoritmer',
      enabled: true 
},
    { 
      name: 'TensorFlow GPU Acceleration', 
      description: 'GPU-akselerert prosessering',
      enabled: true 
}
  ];

  const [settings, setSettings] = useState({
    brightness:  0,
    contrast:  0,
    saturation:  0,
    sharpness:  0,
    denoising:  50,
    faceEnhancement: 75 });

  // Get projects based on demo mode
  const displayProjects = isDemoMode ? demoProjects : [];

  // Project folder structure based on profession
  const getProjectFolders = () => {
    if (profession === 'photographer') {
      return [
        { id: 'raw-footage', name: 'Raw Footage', description: 'Originale bildefiler',},
        { id: 'edited-files', name: 'Edited Files', description: 'Redigerte og forbedrede bilder',},
        { id: 'client-review', name: 'Client Review', description: 'Bilder til kunde gjennomgang',},
        { id: 'final-delivery', name: 'Final Delivery', description: 'Ferdig leveranse til kunde',},
        { id: 'reference-materials', name: 'Reference Materials', description: 'Referansebilder og inspirasjon',}
      ];
} else if (profession === 'videographer') {
      return [
        { id: 'raw-footage', name: 'Raw Footage', description: 'Opprinnelige videofiler',},
        { id: 'edited-files', name: 'Edited Files', description: 'Redigerte videoer og stillbilder',},
        { id: 'client-review', name: 'Client Review', description: 'Filer til kunde gjennomgang',},
        { id: 'final-delivery', name: 'Final Delivery', description: 'Ferdig leveranse',}
      ];
}
    return [
      { id: 'assets', name: 'Assets', description: 'Alle prosjektfiler',},
      { id: 'processed', name: 'Processed', description: 'Bearbeidede filer',}
    ];
};

  // Image upload handler
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedImage(file);
      setEnhancedImageUrl('');
      setAnalysisResult(null);
      setCompositionAnalysis(null);
      
      // Create URL for original image preview
      const imageUrl = URL.createObjectURL(file);
      setOriginalImageUrl(imageUrl);
      
      // Automatically enable composition guides for uploaded images
      setShowCompositionGuides(true);
      
      console.log('🖼️ Bilde lastet opp - starter komposisjonsanalyse automatisk, ');
}
};

  // Handle image load for composition analysis
  const handleImageLoad = async (imgElement: HTMLImageElement) => {
    if (imgElement) {
      try {
        // Analyze composition when image loads
        const analysis = await compositionAnalyzer.analyzeImage(imgElement);
        setCompositionAnalysis(analysis);
        
        console.log('🎨 Komposisjonsanalyse fullført:', analysis);
  } catch (error) {
        console.error('Feil ved komposisjonsanalyse: ', error);
  }
}
};

  // Image analysis mutation
  const analyzeImageMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      return apiRequest('/api/photo-enhancer/analyze', {
        method: 'POST',
        body: formData,
      });
},
    onSuccess: (data) => {
      setAnalysisResult(data);
      console.log('Analysis complete:', data);
},
    onError: (error) => {
      console.error('Analysis failed:', error);
},
});

  // Enhancement mutation with progress tracking
  const enhanceImageMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      setShowProgress(true);
      return apiRequest('/api/photo-enhancer/upload-enhance', {
        method: 'POST',
        body: formData,
      });
},
    onSuccess: (data) => {
      console.log('✅ Enhancement API response:', data);
      setEnhancedImageUrl(data.enhancedPath || data.outputPath);
      setProgressSessionId(data.progressSessionId || '');
      setHistorySessionId(data.historySessionId || '');
      setIsProcessing(false);
      setProgress(100);
      console.log('Enhancement complete:', data);

      // Show rating dialog after enhancement completes
      setTimeout(() => {
        setShowRatingDialog(true);
      }, 1000); // Wait 1 second for user to see the result
},
    onError: (error) => {
      setIsProcessing(false);
      setProgress(0);
      setShowProgress(false);
      console.error('❌ Enhancement failed:', error);
},
});

  // Analyze uploaded image
  const startAnalysis = async () => {
    if (!uploadedImage) return;

    const formData = new FormData();
    formData.append('photo', uploadedImage);
    analyzeImageMutation.mutate(formData);
};

  // Start enhancement with progress tracking
  const startEnhancement = async () => {
    if (!uploadedImage) {
      console.log('❌ No image uploaded');
      return;
}

    console.log('🚀 Starting enhancement process with progress tracking...');
    console.log('📁 Uploaded image:', uploadedImage.name, `${uploadedImage.size} bytes`);
    console.log('⚙️ Settings:', { activePreset, profession, settings });

    setIsProcessing(true);
    setProgress(0);
    setShowProgress(true);

    try {
      // Create FormData for upload and enhancement with progress tracking
      const formData = new FormData();
      formData.append('photo', uploadedImage);
      formData.append('enhancementType', activePreset);
      formData.append('profession', profession);
      
      // Add all settings
      Object.entries(settings).forEach(([key, value]) => {
        formData.append(key, value.toString());
  });

      // Use the mutation which includes progress tracking
      enhanceImageMutation.mutate(formData);
      
} catch (error) {
      console.error('❌ Enhancement process error:', error);
      setIsProcessing(false);
      setShowProgress(false);
}
};

  // Submit rating to training pipeline
  const handleSubmitRating = async (rating: number, feedback: string) => {
    if (!user?.id) {
      console.error('No user ID available');
      return;
    }

    try {
      await apiRequest('/api/ai-training/collect/photo-enhancement', {
        method: 'POST',
        body: {
          userId: user.id,
          enhancementType: activePreset,
          preset: activePreset,
          settings: settings,
          originalImagePath: originalImageUrl,
          enhancedImagePath: enhancedImageUrl,
          userRating: rating,
          userFeedback: feedback,
          qualityMetrics: {
            processingTime: 0
          },
          modelsUsed: ['nafnet','restormer','realesrgan','gfpgan','codeformer','hdrnet','unet']
        }
      });

      console.log('✅ Rating submitted successfully:', rating, feedback);
    } catch (error) {
      console.error('❌ Failed to submit rating:', error);
    }
  };

  return (
    <Box sx={{ p:  2 }}>
      <Card sx={{ border: `2px solid ${color}20` ,  ...theming.getThemedCardSx() }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <PhotoCamera sx={{ color, fontSize: 32}} />
            <Typography variant="h5" sx={{  color, fontWeight: 600}}>
              CreatorHub Photo Enhancer
            </Typography>
            <Chip 
              label="AI-Powered"
              color="primary"
              size="small"
              icon={theming.getThemedIcon('autoFixHigh')}
            />
          </Box>

          {/* Progress Tracking */}
          {showProgress && progressSessionId && (
            <Box sx={{ mb:  3 }}>
              <ProgressTracking
                sessionId={progressSessionId}
                onComplete={(result) => {
                  console.log('✅ Progress tracking completed:', result);
                  setShowProgress(false);
                  setIsProcessing(false);
            }}
                onError={(error) => {
                  console.error('❌ Progress tracking error:', error);
                  setShowProgress(false);
                  setIsProcessing(false);
            }}
              />
            </Box>
          )}

          {/* Fallback progress for legacy mode */}
          {isProcessing && !showProgress && (
            <Alert severity="info" sx={{ mb:  3 }}>
              <Typography variant="body2" sx={{ mb:  1 }}>
                Prosesserer med AI-modeller: Real-ESRGN, GFPGAN, CodeFormer
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={progress}
                sx={{ 
                  height:  8,
                  bgcolor: `${color}20`,
                  '& .MuiLinearProgress-bar': {
                    bgcolor: color
            }
            }}
              />
              <Typography variant="caption" sx={{ mt: 1, display: 'block'}}>
                {Math.round(progress)}% - Estimert tid: {Math.ceil((100 - progress) * 0.3)} sekunder
              </Typography>
            </Alert>
          )}

          <Grid container spacing={3}>
            {/* Enhancement Presets */}
            <Grid item xs={12} md={6}>
              <Typography variant="h6" sx={{  mb: 2, fontWeight: 600}}>
                AI Enhancement Presets
              </Typography>
              
              <Grid container spacing={2}>
                {presets.map((preset) => {
                  const IconComponent = preset.icon;
                  return (
                    <Grid item xs={12} sm={6} key={preset.id}>
                      <Card 
                        sx={{ 
                          cursor: 'pointer',
                          border: activePreset === preset.id ? `2px solid ${color}` : '1px solid #e0e0e0','&:hover': { boxShadow:  2 }
                    }}
                        onClick={() => setActivePreset(preset.id)}
                      >
                        <CardContent sx={{ p: 2, textAlign: 'center',  ...theming.getThemedCardSx() }}>
                          <IconComponent 
                            sx={{ 
                              fontSize:  32, 
                              color: activePreset === preset.id ? color : '#66',
                              mb: 1 }}
                          />
                          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5}}>
                            {preset.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {preset.description}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                );
            })}
              </Grid>

              <Typography variant="h6" sx={{  mt:  3, mb: 2, fontWeight: 600}}>
                Manuelle Justeringer
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap:  2 }}>
                {Object.entries(settings).map(([key, value]) => (
                  <Box key={key}>
                    <Typography variant="body2" sx={{ mb: 1, textTransform: 'capitalize'}}>
                      {key === 'brightness' ? 'Lysstyrke' :
                       key === 'contrast' ? 'Kontrast' :
                       key === 'saturation' ? 'Metning' :
                       key === 'sharpness' ? 'Skarphet' :
                       key === 'denoising' ? 'Støyreduksjon' :
                       key === 'faceEnhancement' ? 'Ansiktsforbedring' : key}: {value}
                    </Typography>
                    <Slider
                      value={value}
                      onChange={(_, newValue) => {
                        setSettings(prev => ({ ...prev, [key]: newValue as number }));
                        // Real-time preview update kunne implementeres her
                  }}
                      min={key === 'denoising' || key === 'faceEnhancement' ? 0 : -100}
                      max={100}
                      sx={{
                        color'& .MuiSlider-thumb': {
                          bgcolor: color
                  }
                  }}
                    />
                  </Box>
                ))}
              </Box>
            </Grid>

            {/* Upload and AI Features */}
            <Grid item xs={12} md={6}>
              <Typography variant="h6" sx={{  mb: 2, fontWeight: 600}}>
                AI Features Status
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 3 }}>
                {aiFeatures.map((feature) => (
                  <Box key={feature.name} sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    p:  2,
                    border: '1px solid #',
                    borderRadius:  1,
                    bgcolor: feature.enabled ? `${color}10` : 'transparent'
              }}>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600}>
                        {feature.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {feature.description}
                      </Typography>
                    </Box>
                    <Chip 
                      label={feature.enabled ? 'Aktivert' : 'Deaktivert'}
                      color={feature.enabled ? 'success' : 'default'}
                      size="small"
                    />
                  </Box>
                ))}
              </Box>

              <Typography variant="h6" sx={{  mb: 2, fontWeight: 600}}>
                Upload & Process
              </Typography>

              {/* Image Upload Section */}
              <Box sx={{ mb:  3 }}>
                <input
                  accept="image/*"
                  style={{ display: 'none'}}
                  id="image-upload"
                  type="file"
                  onChange={handleImageUpload}
                />
                <label htmlFor="image-upload">
                  <Box sx={{ 
                    border: `2px dashed ${color}50`,
                    borderRadius:  2,
                    p:  3,
                    textAlign: 'center',
                    bgcolor: `${color}05`,
                    cursor: 'pointer','&:hover': { bgcolor: `${color}10` }
              }}>
                    <CloudUpload sx={{ fontSize:  48, color: color + '8', mb:  2 }} />
                    <Typography variant="body1" sx={{ mb:  1 }}>
                      {uploadedImage ? uploadedImage.name : 'Dra og slipp bilder her'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                      {uploadedImage ? '✓ Bilde lastet opp - klar for forbedring' : 'Støtter JPG, PNG, TIFF, RAW opptil 50MB'}
                    </Typography>
                    <Button variant="outlined" sx={{ borderColor: color, color }} component="span">
                      {uploadedImage ? 'Bytt bilde' : 'Velg filer'}
                    </Button>
                  </Box>
                </label>
              </Box>

              {/* Analysis Results */}
              {analysisResult && (
                <Box sx={{ mb:  3, p: 2, bgcolor: 'background.default', borderRadius:  1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb:  1 }}>
                    <Assessment sx={{ mr: 1, fontSize: 16}} />
                    Bildeanalyse
                  </Typography>
                  <Typography variant="body2">
                    Kvalitet: {analysisResult.analysis?.quality || 'N/'}/100
                  </Typography>
                  <Typography variant="body2">
                    Skarphet: {analysisResult.analysis?.sharpness || 'N/'}
                  </Typography>
                  <Typography variant="body2">
                    Lysstyrke: {analysisResult.analysis?.brightness || 'N/'}
                  </Typography>
                </Box>
              )}

              {/* Advanced Before/After Image Comparison */}
              {originalImageUrl && (
                <Box sx={{ mb:  3 }}>
                  <Typography variant="body2" sx={{ mb: 2, fontWeight: 600,color }}>
                    Avansert Før/Etter Detaljanalyse
                  </Typography>
                  
                  {/* View Mode Selector */}
                  <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center'}}>
                    <Typography variant="caption" sx={{ fontWeight: 600,mr:  1 }}>
                      Visningsmodus: </Typography>
                    <Button
                      size="small"
                      variant={viewMode === 'side-by-side' ? 'contained' : 'outlined'}
                      startIcon={<ViewColumn />}
                      onClick={() => setViewMode('side-by-side')}
                      sx={{ bgcolor: viewMode === 'side-by-side' ? color : 'transparent'}}
                    >
                      Side ved side
                    </Button>
                    <Button
                      size="small"
                      variant={viewMode === 'slider' ? 'contained' : 'outlined'}
                      startIcon={theming.getThemedIcon('swapHoriz')}
                      onClick={() => setViewMode('slider')}
                      sx={{ bgcolor: viewMode === 'slider' ? color : 'transparent'}}
                    >
                      Slider sammenligning
                    </Button>
                    <Button
                      size="small"
                      variant={viewMode === 'overlay' ? 'contained' : 'outlined'}
                      startIcon={<Layers />}
                      onClick={() => setViewMode('overlay')}
                      sx={{ bgcolor: viewMode === 'overlay' ? color : 'transparent'}}
                    >
                      Overlay blending
                    </Button>
                  </Box>
                  
                  {/* Image Comparison Container */}
                  <Box sx={{ position: 'relative', height: '400px', borderRadius: 2, overflow: 'hidden', border: `2px solid ${color}` }}>
                    {viewMode === 'side-by-side' && (
                      <Grid container sx={{ height: '100%'}}>
                        <Grid item xs={6}>
                          <Box sx={{ position: 'relative', height: '100%', borderRight: `1px solid ${color}` }}>
                            <Typography variant="caption" sx={{ 
                              position: 'absolute', top:  8, left:  8, zIndex: 2,
                              bgcolor: 'rgba(0,0,0,0.8)', color: 'white', px: 1, py: 0, borderRadius: 1 }}>
                              🔸 Original
                            </Typography>
                            {originalImageUrl && (
                              <img 
                                src={originalImageUrl}
                                alt="Original" 
                                style={{ 
                                  width: '100%', 
                                  height: '100%', 
                                  objectFit: 'cover',
                                  transform: `scale(${zoomLevel})`,
                                  transformOrigin: 'center center',
                                  transition: 'transform 0.3s ease'
                          }}
                              />
                            )}
                          </Box>
                        </Grid>
                        <Grid item xs={6}>
                          <Box sx={{ position: 'relative', height: '100%'}}>
                            <Typography variant="caption" sx={{ 
                              position: 'absolute', top:  8, left:  8, zIndex: 2,
                              bgcolor: `rgba(${color.slice(1,3)}, ${color.slice(3,5)}, ${color.slice(5)}, 0.9)`, color: 'white', px: 1, py: 0, borderRadius: 1 }}>
                              ✨ AI Forbedret
                            </Typography>
                            {enhancedImageUrl ? (
                              <img 
                                src={enhancedImageUrl}
                                alt="Enhanced" 
                                style={{ 
                                  width: '100%', 
                                  height: '100%', 
                                  objectFit: 'cover',
                                  transform: `scale(${zoomLevel})`,
                                  transformOrigin: 'center center',
                                  transition: 'transform 0.3s ease'
                          }}
                              />
                            ) : (
                              <Box sx={{ 
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                height: '100%', bgcolor: '#', color: 'text.secondary'
                        }}>
                                <Box sx={{ textAlign: 'center'}}>
                                  <AutoFixHigh sx={{ fontSize:  32, mb: 1, opacity: 0.5}} />
                                  <Typography variant="caption">
                                    Venter på AI-forbedring
                                  </Typography>
                                </Box>
                              </Box>
                            )}
                          </Box>
                        </Grid>
                      </Grid>
                    )}
                    
                    {viewMode === 'slider' && enhancedImageUrl && (
                      <Box sx={{ position: 'relative', height: '100%'}}>
                        {/* Enhanced Image (Background) */}
                        <img 
                          src={enhancedImageUrl}
                          alt="Enhanced" 
                          style={{ 
                            position: 'absolute', top: 0, left:  0,
                            width: '100%', height: '100%', 
                            objectFit: 'cover',
                            transform: `scale(${zoomLevel})`,
                            transformOrigin: 'center center'
                    }}
                        />
                        {/* Original Image (Clipped) */}
                        <img 
                          src={originalImageUrl}
                          alt="Original" 
                          style={{ 
                            position: 'absolute', top: 0, left:  0,
                            width: '100%', height: '100%', 
                            objectFit: 'cover',
                            clipPath: `inset(0 ${100 - sliderPosition}% 0 0)`,
                            transform: `scale(${zoomLevel})`,
                            transformOrigin: 'center center'
                    }}
                        />
                        {/* Slider Line */}
                        <Box sx={{
                          position: 'absolute',
                          left: `${sliderPosition}%`,
                          top:  0,
                          height: '100%',
                          width:  3,
                          bgcolor: color,
                          boxShadow: '0 0 10px rgba(0,0,0,0.5)',
                          cursor: 'ew-resize',
                          zIndex: 3, '&::before': {
                            content: '","',
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-5%, -50%)',
                            width:  20,
                            height:  20,
                            bgcolor: color,
                            borderRadius: '50, %',
                            border: '2px solid white'
                    }
                    }}
                        onMouseDown={(e) => {
                          const handleMouseMove = (moveEvent: MouseEvent) => {
                            const rect = (e.currentTarget as HTMLElement).parentElement!.getBoundingClientRect();
                            const newPosition = ((moveEvent.clientX - rect.left) / rect.width) * 100;
                            setSliderPosition(Math.max, (Math.min(100, newPosition)));
                      };
                          const handleMouseUp = () => {
                            document.removeEventListener('mousemove', handleMouseMove);
                            document.removeEventListener('mouseup', handleMouseUp);
                      };
                          document.addEventListener('mousemove', handleMouseMove);
                          document.addEventListener('mouseup', handleMouseUp);
                    }}
                        />
                        {/* Labels */}
                        <Typography variant="caption" sx={{ 
                          position: 'absolute', top:  8, left:  8, zIndex: 2,
                          bgcolor: 'rgba(0,0,0,0.8)', color: 'white', px: 1, py: 0, borderRadius: 1 }}>
                          🔸 Original
                        </Typography>
                        <Typography variant="caption" sx={{ 
                          position: 'absolute', top:  8, right:  8, zIndex: 2,
                          bgcolor: `rgba(${color.slice(1,3)}, ${color.slice(3,5)}, ${color.slice(5)}, 0.9)`, color: 'white', px: 1, py: 0, borderRadius: 1 }}>
                          ✨ AI Forbedret
                        </Typography>
                        <Typography variant="caption" sx={{ 
                          position: 'absolute', bottom:  8, left:  8, zIndex: 2,
                          bgcolor: 'rgba(0,0,0,0.8)', color: 'white', px: 1, py: 0, borderRadius: 1 }}>
                          Dra den orange linjen for å sammenligne
                        </Typography>
                      </Box>
                    )}
                    
                    {viewMode === 'overlay' && enhancedImageUrl && (
                      <Box sx={{ position: 'relative', height: '100%'}}>
                        {/* Original Image (Background) */}
                        <img 
                          src={originalImageUrl}
                          alt="Original" 
                          style={{ 
                            position: 'absolute', top: 0, left:  0,
                            width: '100%', height: '100%', 
                            objectFit: 'cover',
                            transform: `scale(${zoomLevel})`,
                            transformOrigin: 'center center'
                    }}
                        />
                        {/* Enhanced Image (Overlay) */}
                        <img 
                          src={enhancedImageUrl}
                          alt="Enhanced" 
                          style={{ 
                            position: 'absolute', top: 0, left:  0,
                            width: '100%', height: '100%', 
                            objectFit: 'cover',
                            opacity: overlayOpacity / 10,
                            transform: `scale(${zoomLevel})`,
                            transformOrigin: 'center center',
                            transition: 'opacity 0.3s ease'
                    }}
                        />
                        {/* Labels */}
                        <Typography variant="caption" sx={{ 
                          position: 'absolute', top:  8, left:  8, zIndex: 2,
                          bgcolor: 'rgba(0,0,0,0.8)', color: 'white', px: 1, py: 0, borderRadius: 1 }}>
                          🔸 Original (bakgrunn)
                        </Typography>
                        <Typography variant="caption" sx={{ 
                          position: 'absolute', top:  8, right:  8, zIndex: 2,
                          bgcolor: `rgba(${color.slice(1,3)}, ${color.slice(3,5)}, ${color.slice(5)}, 0.9)`, color: 'white', px: 1, py: 0, borderRadius: 1 }}>
                          ✨ AI Forbedret ({overlayOpacity}% synlighet)
                        </Typography>
                      </Box>
                    )}
                  </Box>
                  
                  {/* Mode-Specific Controls */}
                  {viewMode === 'slider' && enhancedImageUrl && (
                    <Box sx={{ mt:  2 }}>
                      <Typography variant="caption" sx={{ mb: 1, display: 'block', fontWeight: 600}>
                        📏 Juster sammenligning: {Math.round(sliderPosition)}% original / {Math.round(100-sliderPosition)}% forbedret
                      </Typography>
                      <Slider
                        value={sliderPosition}
                        onChange={(_, value) => setSliderPosition(value as number)}
                        min={0}
                        max={100}
                        sx={{ color }}
                      />
                    </Box>
                  )}
                  
                  {viewMode === 'overlay' && enhancedImageUrl && (
                    <Box sx={{ mt:  2 }}>
                      <Typography variant="caption" sx={{ mb: 1, display: 'block', fontWeight: 600}>
                        🎨 Overlay blending: {overlayOpacity}% forbedring synlighet
                      </Typography>
                      <Slider
                        value={overlayOpacity}
                        onChange={(_, value) => setOverlayOpacity(value as number)}
                        min={0}
                        max={100}
                        sx={{ color }}
                      />
                    </Box>
                  )}
                  
                  {/* General Image Controls */}
                  <Box sx={{ 
                    mt: 2, display: 'flex', 
                    gap: 1, justifyContent: 'center',
                    alignItems: 'center',
                    flexWrap: 'wrap'
            }}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={theming.getThemedIcon('zoomIn')}
                      onClick={() => setZoomLevel(prev => Math.min(prev + 0.5, 3))}
                      disabled={zoomLevel >= 3}
                      sx={{ borderColor: color, color }}
                    >
                      Zoom Inn ({Math.round(zoomLevel * 100)}%)
                    </Button>
                    
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={theming.getThemedIcon('compareArrows')}
                      onClick={() => setZoomLevel(1)}
                      sx={{ borderColor: color, color }}
                    >
                      Reset zoom
                    </Button>
                    
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={theming.getThemedIcon('zoomOut')}
                      onClick={() => setZoomLevel(prev => Math.max(prev - 0.5, 0.5))}
                      disabled={zoomLevel <= 0.5}
                      sx={{ borderColor: color, color }}
                    >
                      Zoom ut
                    </Button>
                    
                    <Button size="small"
                      variant="contained"
                      startIcon={theming.getThemedIcon('fullscreen')}
                      onClick={() => setLightboxOpen(true)}
                      sx={{ bgcolor: color, '&:hover': { bgcolor: color + 'cc',} }}
                    >
                      Lightroom Visning
                    </Button>
                    
                    {enhancedImageUrl && (
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={theming.getThemedIcon('compareArrows')}
                        onClick={() => setShowComparison(!showComparison)}
                        sx={{ borderColor: color, color }}
                      >
                        {showComparison ? 'Side ved Side' : 'Overlapping'}
                      </Button>
                    )}
                  </Box>
                  
                  {/* Quality Comparison */}
                  {enhancedImageUrl && (
                    <Box sx={{ 
                      mt: 2
                     , p: 2, bgcolor: `${color}10`, 
                      borderRadius:  1,
                      border: `1px solid ${color}30`
                }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, mb: 1color }}>
                        ✨ Forbedringer utført: </Typography>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap'}}>
                        <Chip size="small" label="Oppløsning forbedret" />
                        <Chip size="small" label="Skarphet økt" />
                        <Chip size="small" label="Støy redusert" />
                        {activePreset === 'portrait' && <Chip size="small" label="Ansikt forbedret" />}
                        {activePreset === 'landscape' && <Chip size="small" label="Farger forbedret" />}
                      </Box>
                    </Box>
                  )}
                </Box>
              )}

              {/* Project Integration */}
              {displayProjects.length > 0 && uploadedImage && (
                <Box sx={{ mb:  3, p: 2, bgcolor: 'background.paper', borderRadius: 2, border: `1px solid ${color}30` }}>
                  <Typography variant="body2" sx={{ mb: 2, fontWeight: 600,color }}>
                    <FolderOpen sx={{ mr: 1, fontSize: 16}} />
                    Smart prosjektintegrasjon
                  </Typography>
                  
                  <FormControl size="small" fullWidth sx={{ mb:  2 }}>
                    <InputLabel>Velg prosjekt</InputLabel>
                    <Select
                      value={selectedProject}
                      onChange={(e) => setSelectedProject(e.target.value)}
                      label="Velg prosjekt"
                    >
                      {displayProjects.map((project) => (
                        <MenuItem key={project.id} value={project.id}>
                          {project.name} - {project.clientName}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  {selectedProject && (
                    <FormControl size="small" fullWidth>
                      <InputLabel>Velg mappe</InputLabel>
                      <Select
                        value={selectedFolder}
                        onChange={(e) => setSelectedFolder(e.target.value)}
                        label="Velg mappe"
                      >
                        {getProjectFolders().map((folder) => (
                          <MenuItem key={folder.id} value={folder.id}>
                            {folder.name} - {folder.description}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                </Box>
              )}
            </Grid>
          </Grid>

          <Box sx={{ mt:  3, display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap'}}>
            <Button 
              variant="outlined"
              onClick={startAnalysis}
              disabled={!uploadedImage || analyzeImageMutation.isPending}
              startIcon={theming.getThemedIcon('assessment')}
            >
              {analyzeImageMutation.isPending ? 'Analyserer...' : 'Analyser bilde'}
            </Button>
            
            <Button variant="contained" 
              sx={{ bgcolor: color, minWidth: 200}}
              onClick={startEnhancement}
              disabled={isProcessing || !uploadedImage}
              startIcon={theming.getThemedIcon('autoFixHigh')}
             sx={theming.getThemedButtonSx()}>
              {isProcessing ? 'Prosesserer...' : 'Start AI Enhancement'}
            </Button>
            
            {enhancedImageUrl && (
              <Button variant="contained" 
                startIcon={theming.getThemedIcon('save')}
                onClick={() => setSaveModalOpen(true)}
                sx={{ bgcolor: 'success.main'}}
              >
                Lagre til prosjekt
              </Button>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Lightroom Classic-Inspired Lightbox */}
      <Dialog 
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        maxWidth={false}
        fullScreen
        sx={{
          '& .MuiDialog-paper': {
            bgcolor: '#1a1a10',
            color: 'white',
            margin:  0,
            maxHeight: '100vh',
            maxWidth: '100vw'
    }
    }}
      >
        <Box sx={{ 
          position: 'relative', 
          width: '100vw', 
          height: '100vh', 
          bgcolor: '#1a1a10',
          overflow: 'hidden'
  }}>
          {/* Top Toolbar - Lightroom Classic Style */}
          <Box sx={{
            position: 'absolute',
            top:  0,
            left:  0,
            right:  0,
            height:  60,
            bgcolor: 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px:  2,
            zIndex: 1000}}>
            <Box sx={{ display: 'flex', gap:  1 }}>
              <Typography variant="h6" sx={{  color: 'white', fontWeight: 600}}>
                CreatorHub Photo Enhancer - Lightroom View
              </Typography>
              <Chip 
                label={`${Math.round(zoomLevel * 100)}%`}
                size="small" 
                sx={{ bgcolor: color, color: 'white'}}
              />
            </Box>
            
            <Box sx={{ display: 'flex', gap:  1 }}>
              {/* View Mode Buttons */}
              <Button
                size="small"
                variant={viewMode === 'side-by-side' ? 'contained' : 'text'}
                startIcon={<ViewColumn />}
                onClick={() => setViewMode('side-by-side')}
                sx={{ 
                  color: 'white', 
                  bgcolor: viewMode === 'side-by-side' ? color : 'transparent','&:hover': { bgcolor: viewMode === 'side-by-side' ? color : 'rgba(25,255,255,0.1)' }
            }}
              >
                Split
              </Button>
              <Button
                size="small"
                variant={viewMode === 'slider' ? 'contained' : 'text'}
                startIcon={theming.getThemedIcon('swapHoriz')}
                onClick={() => setViewMode('slider')}
                sx={{ 
                  color: 'white', 
                  bgcolor: viewMode === 'slider' ? color : 'transparent','&:hover': { bgcolor: viewMode === 'slider' ? color : 'rgba(25,255,255,0.1)' }
            }}
              >
                Slider
              </Button>
              <Button
                size="small"
                variant={viewMode === 'overlay' ? 'contained' : 'text'}
                startIcon={<Layers />}
                onClick={() => setViewMode('overlay')}
                sx={{ 
                  color: 'white', 
                  bgcolor: viewMode === 'overlay' ? color : 'transparent','&:hover': { bgcolor: viewMode === 'overlay' ? color : 'rgba(25,255,255,0.1)' }
            }}
              >
                Overlay
              </Button>
              
              <Divider orientation="vertical" sx={{ bgcolor: 'rgba(25,255,255,0.3)', mx:  1 }} />
              
              {/* Zoom Controls */}
              <Button
                size="small"
                variant="text"
                startIcon={<FitScreen />}
                onClick={() => setZoomLevel(1)}
                sx={{ color: 'white','&:hover': { bgcolor: 'rgba(25,255,255,0.1)' } }}
              >
                Fit
              </Button>
              
              <Divider orientation="vertical" sx={{ bgcolor: 'rgba(25,255,255,0.3)', mx:  1 }} />
              
              {/* Composition Guides Toggle */}
              <Button
                size="small"
                variant={showCompositionGuides ? 'contained' : 'text'}
                startIcon={<GridOn />}
                onClick={() => setShowCompositionGuides(!showCompositionGuides)}
                sx={{ 
                  color: 'white', 
                  bgcolor: showCompositionGuides ? color : 'transparent','&:hover': { bgcolor: showCompositionGuides ? color : 'rgba(25,255,255,0.1)' }
            }}
              >
                Composition Guide
              </Button>
              
              <Button
                size="small"
                variant="text"
                startIcon={theming.getThemedIcon('zoomIn')}
                onClick={() => setZoomLevel(prev => Math.min(prev + 0.5, 5))}
                disabled={zoomLevel >= 5}
                sx={{ color: 'white','&:hover': { bgcolor: 'rgba(25,255,255,0.1)' } }}
              >
                Zoom+
              </Button>
              <Button
                size="small"
                variant="text"
                startIcon={theming.getThemedIcon('zoomOut')}
                onClick={() => setZoomLevel(prev => Math.max(prev - 0.5, 0.1))}
                disabled={zoomLevel <= 0.1}
                sx={{ color: 'white','&:hover': { bgcolor: 'rgba(25,255,255,0.1)' } }}
              >
                Zoom-
              </Button>
              
              <Divider orientation="vertical" sx={{ bgcolor: 'rgba(25,255,255,0.3)', mx:  1 }} />
              
              <Button
                size="small"
                variant="text"
                startIcon={theming.getThemedIcon('close')}
                onClick={() => setLightboxOpen(false)}
                sx={{ color: 'white', '&:hover': { bgcolor: 'rgba(25,255,255,0.1)' } }}
              >
                Lukk
              </Button>
            </Box>
          </Box>

          {/* Main Image Viewing Area */}
          <Box sx={{
            position: 'absolute',
            top:  60,
            left:  0,
            right:  0,
            bottom: viewMode === 'slider' || viewMode === 'overlay' ? 100 : 60,
            overflow: 'hidden',
            cursor: zoomLevel > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
    }}>
            {viewMode === 'side-by-side' && (
              <Grid container sx={{ height: '100%'}}>
                <Grid item xs={6}>
                  <Box sx={{ 
                    position: 'relative', 
                    height: '100%', 
                    borderRight: `2px solid ${color}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden'
            }}>
                    <Typography variant="h6" sx={{  
                      position: 'absolute', 
                      top:  20, 
                      left:  20, 
                      zIndex: 2,
                      bgcolor: 'rgba(0,0,0,0.8)', 
                      px: 2, py: 1, borderRadius:  1,
                      color: 'white'
               }}>
                      🔸 Original
                    </Typography>
                    {originalImageUrl && (
                      <Box sx={{ position: 'relative', width: '100%', height: '100%'}}>
                        <img 
                          ref={(ref) => {
                            if (ref && !imageElement) {
                              setImageElement(ref);
                              // Trigger composition analysis when image loads
                              if (ref.complete) {
                                handleImageLoad(ref);
                          } else {
                                ref.onload = () => handleImageLoad(ref);
                          }
                        }
                      }}
                          src={originalImageUrl}
                          alt="Original" 
                          style={{ 
                            maxWidth: zoomLevel > 1 ? 'none' : '100%',
                            maxHeight: zoomLevel > 1 ? 'none' : '100%',
                            width: zoomLevel > 1 ? `${zoomLevel * 10}%` : 'auto',
                            height: zoomLevel > 1 ? `${zoomLevel * 10}%` : 'auto',
                            objectFit: 'contain',
                            transform: `translate(${panPosition.x}px, ${panPosition.y}px)`,
                            transition: isDragging ? 'none' : 'transform 0.2s ease'
                    }}
                          onMouseDown={(e) => {
                            if (zoomLevel > 1) {
                              setIsDragging(true);
                              const startX = e.clientX - panPosition.x;
                              const startY = e.clientY - panPosition.y;
                              
                              const handleMouseMove = (moveEvent: MouseEvent) => {
                                setPanPosition({
                                  x: moveEvent.clientX - startX,
                                  y: moveEvent.clientY - startY
                          });
                          };
                              
                              const handleMouseUp = () => {
                                setIsDragging(false);
                                document.removeEventListener('mousemove', handleMouseMove);
                                document.removeEventListener('mouseup', handleMouseUp);
                          };
                              
                              document.addEventListener('mousemove', handleMouseMove);
                              document.addEventListener('mouseup', handleMouseUp);
                        }
                      }}
                        />
                        
                        {/* Composition Guides Overlay */}
                        {showCompositionGuides && imageElement && (
                          <CompositionGuides
                            imageElement={imageElement}
                            zoomLevel={zoomLevel}
                            panPosition={panPosition}
                            analysisResult={compositionAnalysis}
                          />
                        )}
                      </Box>
                    )}
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box sx={{ 
                    position: 'relative', 
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden'
            }}>
                    <Typography variant="h6" sx={{  
                      position: 'absolute', 
                      top:  20, 
                      left:  20, 
                      zIndex: 2,
                      bgcolor: color + 'dd', 
                      px: 2, py: 1, borderRadius:  1,
                      color: 'white'
               }}>
                      ✨ AI Forbedret
                    </Typography>
                    {enhancedImageUrl ? (
                      <img 
                        src={enhancedImageUrl}
                        alt="Enhanced" 
                        style={{ 
                          maxWidth: zoomLevel > 1 ? 'none' : '100%',
                          maxHeight: zoomLevel > 1 ? 'none' : '100%',
                          width: zoomLevel > 1 ? `${zoomLevel * 10}%` : 'auto',
                          height: zoomLevel > 1 ? `${zoomLevel * 10}%` : 'auto',
                          objectFit: 'contain',
                          transform: `translate(${panPosition.x}px, ${panPosition.y}px)`,
                          transition: isDragging ? 'none' : 'transform 0.2s ease'
                  }}
                        onMouseDown={(e) => {
                          if (zoomLevel > 1) {
                            setIsDragging(true);
                            const startX = e.clientX - panPosition.x;
                            const startY = e.clientY - panPosition.y;
                            
                            const handleMouseMove = (moveEvent: MouseEvent) => {
                              setPanPosition({
                                x: moveEvent.clientX - startX,
                                y: moveEvent.clientY - startY
                        });
                        };
                            
                            const handleMouseUp = () => {
                              setIsDragging(false);
                              document.removeEventListener('mousemove', handleMouseMove);
                              document.removeEventListener('mouseup', handleMouseUp);
                        };
                            
                            document.addEventListener('mousemove', handleMouseMove);
                            document.addEventListener('mouseup', handleMouseUp);
                      }
                    }}
                      />
                    ) : (
                      <Box sx={{ textAlign: 'center', color: 'rgba(25,255,255,0.6)' }}>
                        <AutoFixHigh sx={{ fontSize:  64, mb: 2, opacity: 0.5}} />
                        <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                          Venter på AI-forbedring
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Grid>
              </Grid>
            )}

            {/* Slider View Mode */}
            {viewMode === 'slider' && enhancedImageUrl && (
              <Box sx={{ 
                position: 'relative', 
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden'
        }}>
                {/* Enhanced Image (Background) */}
                <img 
                  src={enhancedImageUrl}
                  alt="Enhanced" 
                  style={{ 
                    position: 'absolute',
                    maxWidth: zoomLevel > 1 ? 'none' : '100%',
                    maxHeight: zoomLevel > 1 ? 'none' : '100%',
                    width: zoomLevel > 1 ? `${zoomLevel * 10}%` : 'auto',
                    height: zoomLevel > 1 ? `${zoomLevel * 10}%` : 'auto',
                    objectFit: 'contain',
                    transform: `translate(${panPosition.x}px, ${panPosition.y}px)`
              }}
                />
                {/* Original Image (Clipped) */}
                <img 
                  ref={(ref) => {
                    if (ref && !imageElement) {
                      setImageElement(ref);
                      // Trigger composition analysis when image loads
                      if (ref.complete) {
                        handleImageLoad(ref);
                  } else {
                        ref.onload = () => handleImageLoad(ref);
                  }
                }
              }}
                  src={originalImageUrl}
                  alt="Original" 
                  style={{ 
                    position: 'absolute',
                    maxWidth: zoomLevel > 1 ? 'none' : '100%',
                    maxHeight: zoomLevel > 1 ? 'none' : '100%',
                    width: zoomLevel > 1 ? `${zoomLevel * 10}%` : 'auto',
                    height: zoomLevel > 1 ? `${zoomLevel * 10}%` : 'auto',
                    objectFit: 'contain',
                    clipPath: `inset(0 ${100 - sliderPosition}% 0 0)`,
                    transform: `translate(${panPosition.x}px, ${panPosition.y}px)`
              }}
                />
                
                {/* Composition Guides Overlay */}
                {showCompositionGuides && imageElement && (
                  <CompositionGuides
                    imageElement={imageElement}
                    zoomLevel={zoomLevel}
                    panPosition={panPosition}
                    analysisResult={compositionAnalysis}
                  />
                )}
                {/* Slider Line */}
                <Box sx={{
                  position: 'absolute',
                  left: `${sliderPosition}%`,
                  top:  0,
                  height: '100%',
                  width:  4,
                  bgcolor: color,
                  boxShadow: '0 0 20px rgba(0,0,0,0.8)',
                  cursor: 'ew-resize',
                  zIndex: 10, '&::before': {
                    content: ', ""',
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-5%, -50%)',
                    width:  30,
                    height:  30,
                    bgcolor: color,
                    borderRadius: '50, %',
                    border: '3px solid white',
                    boxShadow: '0 0 10px rgba(0,0,0,0.5)'
              }
            }}
                onMouseDown={(e) => {
                  const handleMouseMove = (moveEvent: MouseEvent) => {
                    const rect = (e.currentTarget as HTMLElement).parentElement!.getBoundingClientRect();
                    const newPosition = ((moveEvent.clientX - rect.left) / rect.width) * 100;
                    setSliderPosition(Math.max, (Math.min(100, newPosition)));
              };
                  const handleMouseUp = () => {
                    document.removeEventListener('mousemove', handleMouseMove);
                    document.removeEventListener('mouseup', handleMouseUp);
              };
                  document.addEventListener('mousemove', handleMouseMove);
                  document.addEventListener('mouseup', handleMouseUp);
            }}
                />
                {/* Labels */}
                <Typography variant="h6" sx={{  
                  position: 'absolute', top:  20, left:  20, zIndex: 2,
                  bgcolor: 'rgba(0,0,0,0.8)', color: 'white', px: 2, py: 1, borderRadius: 1  }}>
                  🔸 Original
                </Typography>
                <Typography variant="h6" sx={{  
                  position: 'absolute', top:  20, right:  20, zIndex: 2,
                  bgcolor: color + 'dd', color: 'white', px: 2, py: 1, borderRadius: 1  }}>
                  ✨ AI Forbedret
                </Typography>
              </Box>
            )}

            {/* Overlay View Mode */}
            {viewMode === 'overlay' && enhancedImageUrl && (
              <Box sx={{ 
                position: 'relative', 
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden'
        }}>
                {/* Original Image (Background) */}
                <img 
                  ref={(ref) => {
                    if (ref && !imageElement) {
                      setImageElement(ref);
                      // Trigger composition analysis when image loads
                      if (ref.complete) {
                        handleImageLoad(ref);
                  } else {
                        ref.onload = () => handleImageLoad(ref);
                  }
                }
              }}
                  src={originalImageUrl}
                  alt="Original" 
                  style={{ 
                    position: 'absolute',
                    maxWidth: zoomLevel > 1 ? 'none' : '100%',
                    maxHeight: zoomLevel > 1 ? 'none' : '100%',
                    width: zoomLevel > 1 ? `${zoomLevel * 10}%` : 'auto',
                    height: zoomLevel > 1 ? `${zoomLevel * 10}%` : 'auto',
                    objectFit: 'contain',
                    transform: `translate(${panPosition.x}px, ${panPosition.y}px)`
              }}
                />
                
                {/* Composition Guides Overlay */}
                {showCompositionGuides && imageElement && (
                  <CompositionGuides
                    imageElement={imageElement}
                    zoomLevel={zoomLevel}
                    panPosition={panPosition}
                    analysisResult={compositionAnalysis}
                  />
                )}
                {/* Enhanced Image (Overlay) */}
                <img 
                  src={enhancedImageUrl}
                  alt="Enhanced" 
                  style={{ 
                    position: 'absolute',
                    maxWidth: zoomLevel > 1 ? 'none' : '100%',
                    maxHeight: zoomLevel > 1 ? 'none' : '100%',
                    width: zoomLevel > 1 ? `${zoomLevel * 10}%` : 'auto',
                    height: zoomLevel > 1 ? `${zoomLevel * 10}%` : 'auto',
                    objectFit: 'contain',
                    opacity: overlayOpacity / 10,
                    transform: `translate(${panPosition.x}px, ${panPosition.y}px)`,
                    transition: 'opacity 0.3s ease'
            }}
                />
                {/* Labels */}
                <Typography variant="h6" sx={{  
                  position: 'absolute', top:  20, left:  20, zIndex: 2,
                  bgcolor: 'rgba(0,0,0,0.8)', color: 'white', px: 2, py: 1, borderRadius: 1  }}>
                  🔸 Original (bakgrunn)
                </Typography>
                <Typography variant="h6" sx={{  
                  position: 'absolute', top:  20, right:  20, zIndex: 2,
                  bgcolor: color + 'dd', color: 'white', px: 2, py: 1, borderRadius: 1  }}>
                  ✨ AI Forbedret ({overlayOpacity}% synlighet)
                </Typography>
              </Box>
            )}
          </Box>

          {/* Bottom Control Panel */}
          <Box sx={{
            position: 'absolute',
            bottom:  0,
            left:  0,
            right:  0,
            height: viewMode === 'slider' || viewMode === 'overlay' ? 100 : 60,
            bgcolor: 'rgba(0,0,0,0.9)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            px:  3,
            zIndex: 1000}}>
            {/* Mode-Specific Controls */}
            {viewMode === 'slider' && enhancedImageUrl && (
              <Box sx={{ mb:  2 }}>
                <Typography variant="body2" sx={{ mb: 1, color: 'white', fontWeight: 600}>
                  📏 Slider Position: {Math.round(sliderPosition)}% original / {Math.round(100-sliderPosition)}% enhanced
                </Typography>
                <Slider
                  value={sliderPosition}
                  onChange={(_, value) => setSliderPosition(value as number)}
                  min={0}
                  max={100}
                  sx={{ 
                    color: color'& .MuiSlider-thumb': {
                      width:  20,
                      height:  20,
                      border: '3px solid white'
              }
              }}
                />
              </Box>
            )}
            
            {viewMode === 'overlay' && enhancedImageUrl && (
              <Box sx={{ mb:  2 }}>
                <Typography variant="body2" sx={{ mb: 1, color: 'white', fontWeight: 600}>
                  🎨 Overlay Transparency: {overlayOpacity}% enhanced visibility
                </Typography>
                <Slider
                  value={overlayOpacity}
                  onChange={(_, value) => setOverlayOpacity(value as number)}
                  min={0}
                  max={100}
                  sx={{ 
                    color: color'& .MuiSlider-thumb': {
                      width:  20,
                      height:  20,
                      border: '3px solid white'
              }
              }}
                />
              </Box>
            )}

            {/* Zoom Level Display */}
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
              <Typography variant="body2" sx={{ color: 'rgba(25,255,255,0.7)' }}>
                {zoomLevel > 1 && '🔍 Zoom aktiv - Dra for å panorere • '}
                Lightroom-inspirert visning • Zoom: {Math.round(zoomLevel * 10)}%
                {analysisResult && ` • Kvalitet: ${analysisResult.analysis?.quality ||'N/'}/100`}
              </Typography>
            </Box>
          </Box>
        </Box>
      </Dialog>

      {/* Rating Dialog */}
      <EnhancementRatingDialog
        open={showRatingDialog}
        onClose={() => setShowRatingDialog(false)}
        enhancementType="photo"
        originalUrl={originalImageUrl}
        enhancedUrl={enhancedImageUrl}
        onSubmitRating={handleSubmitRating}
        title="Vurder bildeforbedringen"
        description="Din tilbakemelding hjelper oss å trene AI-modellene slik at de blir bedre for norske fotografer!"
      />
    </Box>
);
}
