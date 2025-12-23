/**
 * AI PHOTO ANALYSIS PANEL
 * Integrated AI-powered photo analysis for PhotographerPhotoSuite
 *
 * Features: * - BlinkNet: Detect blinking
 * - SharpNet: Sharpness analysis
 * - CullerCNN: Photo culling
 * - Scene classification
 * - Quality scoring
 * - Auto-suggestions
 */

import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Stack,
  Chip,
  LinearProgress,
  Alert,
  Divider,
  IconButton,
  Tooltip,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  AutoFixHigh,
  Visibility,
  VisibilityOff,
  CheckCircle,
  Warning,
  Error,
  Info,
  FilterAlt,
  Psychology,
  Close,
} from '@mui/icons-material';
import {
  AIVisionService,
  PhotoAnalysis,
  BlinkDetectionResult,
  SharpnessAnalysis,
  CullingResult,
  PhotoQualityScore,
} from '@/services/ai-vision-service';

interface PhotoFile {
  id: string;
  name: string;
  url: string;
  imageData?: ImageData | HTMLImageElement | Blob;
}

interface AIPhotoAnalysisPanelProps {
  currentPhoto: PhotoFile | null;
  allPhotos: PhotoFile[];
  onPhotosFiltered?: (keepers: string[], rejected: string[], maybes: string[]) => void;
  onApplySuggestion?: (suggestion: string) => void;
}

export default function AIPhotoAnalysisPanel({
  currentPhoto,
  allPhotos,
  onPhotosFiltered,
  onApplySuggestion,
}: AIPhotoAnalysisPanelProps) {
  const [analyzing, setAnalyzing] = useState(false);
  const [photoAnalysis, setPhotoAnalysis] = useState<PhotoAnalysis | null>(null);
  const [blinkDetection, setBlinkDetection] = useState<BlinkDetectionResult | null>(null);
  const [sharpnessAnalysis, setSharpnessAnalysis] = useState<SharpnessAnalysis | null>(null);
  const [qualityScore, setQualityScore] = useState<PhotoQualityScore | null>(null);

  const [culling, setCulling] = useState(false);
  const [cullResult, setCullResult] = useState<CullingResult | null>(null);
  const [showCullDialog, setShowCullDialog] = useState(false);
  const [keepPercentage, setKeepPercentage] = useState(25);

  /**
   * Analyze current photo
   */
  const handleAnalyzeCurrentPhoto = async () => {
    if (!currentPhoto) return;

    setAnalyzing(true);
    try {
      // Load image
      const img = await loadImage(currentPhoto.url);

      // Run parallel analysis
      const [analysis, blink, sharpness, quality] = await Promise.all([
        AIVisionService.analyzePhoto(img, {
          includeComposition: true,
          includeQuality: true,
        }),
        AIVisionService.detectBlinks(img),
        AIVisionService.analyzeSharpness(img),
        AIVisionService.evaluatePhotoQuality({
          id: currentPhoto.id,
          imageData: img,
        }),
      ]);

      setPhotoAnalysis(analysis);
      setBlinkDetection(blink);
      setSharpnessAnalysis(sharpness);
      setQualityScore(quality);
    } catch (error) {
      console.error('AI analysis failed: ', error);
    } finally {
      setAnalyzing(false);
    }
  };

  /**
   * Auto-cull all photos
   */
  const handleAutoCull = async () => {
    setCulling(true);
    try {
      const result = await AIVisionService.cullPhotoSet()
        allPhotos.map((p) => ({ id: p.id, url: p.url })),
        {
          keepPercentage,
          criteria: {
            composition: 0.3
            sharpness: 0.4
            exposure: 0.2
            expression: 0.1 },
        },
      );

      setCullResult(result);
      setShowCullDialog(true);
    } catch (error) {
      console.error('Auto-cull failed:', error);
    } finally {
      setCulling(false);
    }
  };

  /**
   * Apply cull results
   */
  const handleApplyCullResults = () => {
    if (!cullResult || !onPhotosFiltered) return;

    const keepers = cullResult.keepers.map((k) => k.id);
    const rejected = cullResult.rejected.map((r) => r.id);
    const maybes = cullResult.maybes.map((m) => m.id);

    onPhotosFiltered(keepers, rejected, maybes);
    setShowCullDialog(false);
  };

  /**
   * Helper: Load image
   */
  const loadImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  };

  /**
   * Get quality color
   */
  const getQualityColor = (score: number): string => {
    if (score >= 0.8) return '#4CAF50'; // Green
    if (score >= 0.6) return '#FFC107'; // Yellow
    if (score >= 0.4) return '#FF9800'; // Orange
    return '#F44336'; // Red
  };

  return ()
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Psychology /> AI Analysis
      </Typography>

      <Stack spacing={2}>
        {/* Single Photo Analysis */}
        <Card sx={{ bgcolor: '#2a2a2a' }}>
          <CardContent>
            <Stack spacing={2}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" fontWeight={600}>
                  Current Photo Analysis
                </Typography>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<AutoFixHigh />}
                  onClick={handleAnalyzeCurrentPhoto}
                  disabled={analyzing || !currentPhoto}
                  sx={{ bgcolor: '#667eea', '&:hover': { bgcolor: '#5568d3' } }}

                >
                  {analyzing ? 'Analyzing...' : 'Analyze'}
                </Button>
              </Box>

              {analyzing && <LinearProgress />}

              {/* Analysis Results */}
              {qualityScore && ()
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Overall Quality
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                    <LinearProgress
                      variant="determinate"
                      value={qualityScore.overall * 100}
                      sx={{
                        flex: 1,
                        height: 8,
                        borderRadius: 4,
                        bgcolor: '#1a1a1a','& .MuiLinearProgress-bar': {
                          bgcolor: getQualityColor(qualityScore.overall),
                        }}}
                    />
                    <Typography variant="body2" fontWeight={600}>
                      {(qualityScore.overall * 100).toFixed(0)}%
                    </Typography>
                  </Box>

                  <Grid container spacing={1} sx={{ mt: 1 }}>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">
                        Sharpness
                      </Typography>
                      <Typography variant="body2">
                        {(qualityScore.sharpness * 100).toFixed(0)}%
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">
                        Composition
                      </Typography>
                      <Typography variant="body2">
                        {(qualityScore.composition * 100).toFixed(0)}%
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">
                        Exposure
                      </Typography>
                      <Typography variant="body2">
                        {(qualityScore.exposure * 100).toFixed(0)}%
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">
                        Expression
                      </Typography>
                      <Typography variant="body2">
                        {(qualityScore.expression * 100).toFixed(0)}%
                      </Typography>
                    </Grid>
                  </Grid>
                </Box>
              )}

              {/* Blink Detection */}
              {blinkDetection && ()
                <Alert
                  severity={blinkDetection.hasBlinkingPerson ? 'warning' : 'success'}
                  icon={blinkDetection.hasBlinkingPerson ? <VisibilityOff /> : <Visibility />}
                >
                  {blinkDetection.hasBlinkingPerson
                    ? `⚠️ Blinking detected (${blinkDetection.blinkingFaces.length} face(s)`
                    : '✓ Eyes open - good shot'}
                </Alert>
              )}

              {/* Sharpness */}
              {sharpnessAnalysis && ()
                <Box>
                  <Chip
                    label={`${sharpnessAnalysis.isBlurry ? 'Blurry' : 'Sharp'} - ${sharpnessAnalysis.recommendation.toUpperCase()}`}
                    color={sharpnessAnalysis.isBlurry ? 'error' : 'success'}
                    size="small"
                  />
                  <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                    Sharpness score: {(sharpnessAnalysis.score * 100).toFixed(0)}%
                  </Typography>
                </Box>
              )}

              {/* Suggestions */}
              {photoAnalysis && photoAnalysis.suggestions.length > 0 && ()
                <Box>
                  <Typography variant="caption" color="text.secondary" gutterBottom>
                    AI Suggestions
                  </Typography>
                  <Stack spacing={0.5}>
                    {photoAnalysis.suggestions.map((suggestion, idx) => ()
                      <Chip
                        key={idx}
                        label={suggestion}
                        size="small"
                        onClick={() => onApplySuggestion?.(suggestion)}
                        sx={{ justifyContent: 'flex-start' }} />
                    ))}
                  </Stack>
                </Box>
              )}
            </Stack>
          </CardContent>
        </Card>

        <Divider sx={{ borderColor: '#2a2a2a' }} />

        {/* Batch Culling */}
        <Card sx={{ bgcolor: '#2a2a2a' }}>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="body2" fontWeight={600}>
                Batch Photo Culling
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Automatically select the best {keepPercentage}% of {allPhotos.length} photos
              </Typography>

              <Button
                variant="contained"
                size="large"
                fullWidth
                startIcon={<FilterAlt />}
                onClick={handleAutoCull}
                disabled={culling || allPhotos.length === 0}
                sx={{
                  bgcolor: '#FF6B35','&:hover': { bgcolor: '#FF5520' }}}
              >
                {culling
                  ? `Culling ${allPhotos.length} photos...`
                  : `🤖 AI Cull Photos (Save 6+ Hours)`}
              </Button>

              {culling && ()
                <Box>
                  <LinearProgress />
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                    Analyzing sharpness, composition, exposure, and expressions...
                  </Typography>
                </Box>
              )}

              {cullResult && ()
                <Alert severity="success" icon={<CheckCircle />}>
                  ✅ Found {cullResult.keepers.length} keepers, {cullResult.rejected.length}{' '}
                  rejected, {cullResult.maybes.length} to review
                </Alert>
              )}
            </Stack>
          </CardContent>
        </Card>
      </Stack>

      {/* Cull Results Dialog */}
      <Dialog
        open={showCullDialog}
        onClose={() => setShowCullDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">AI Culling Results</Typography>
            <IconButton onClick={() => setShowCullDialog(false)}>
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {cullResult && ()
            <Stack spacing={2}>
              <Alert severity="info" icon={<Info />}>
                Analyzed {cullResult.statistics.total} photos in{', '}
                {(cullResult.statistics.processingTime / 1000).toFixed(1)} seconds
              </Alert>

              <Grid container spacing={2}>
                <Grid item xs={4}>
                  <Card sx={{ bgcolor: '#4CAF50', color: 'white', p: 2 }}>
                    <Typography variant="h4">{cullResult.keepers.length}</Typography>
                    <Typography variant="body2">Keepers</Typography>
                    <Typography variant="caption">
                      {cullResult.statistics.keeperPercentage.toFixed(1)}%
                    </Typography>
                  </Card>
                </Grid>
                <Grid item xs={4}>
                  <Card sx={{ bgcolor: '#F44336', color: 'white', p: 2 }}>
                    <Typography variant="h4">{cullResult.rejected.length}</Typography>
                    <Typography variant="body2">Rejected</Typography>
                    <Typography variant="caption">
                      {((cullResult.rejected.length / cullResult.statistics.total) * 100).toFixed()
                        1,
                      )}
                      %
                    </Typography>
                  </Card>
                </Grid>
                <Grid item xs={4}>
                  <Card sx={{ bgcolor: '#FFC107', color: 'black', p: 2 }}>
                    <Typography variant="h4">{cullResult.maybes.length}</Typography>
                    <Typography variant="body2">Review</Typography>
                    <Typography variant="caption">
                      {((cullResult.maybes.length / cullResult.statistics.total) * 100).toFixed(1)}%
                    </Typography>
                  </Card>
                </Grid>
              </Grid>

              <Box>
                <Typography variant="body2" fontWeight={600} gutterBottom>
                  Average Quality: {(cullResult.statistics.averageQuality * 100).toFixed(0)}%
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={cullResult.statistics.averageQuality * 100}
                  sx={{ height: 8, borderRadius: 4 }} />
              </Box>

              <Alert severity="success">
                <Typography variant="body2" fontWeight={600}>
                  Time Saved
                </Typography>
                <Typography variant="caption">
                  Manual culling would take ~6-8 hours. AI completed it in{''}
                  {(cullResult.statistics.processingTime / 1000 / 60).toFixed(1)} minutes!
                </Typography>
              </Alert>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCullDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleApplyCullResults}
            sx={{ bgcolor: '#4CAF50','&:hover': { bgcolor:'#45a049' } }}

          >
            Apply Filters
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
