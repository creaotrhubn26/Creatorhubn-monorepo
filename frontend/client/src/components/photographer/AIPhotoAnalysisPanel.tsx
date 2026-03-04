import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import {
  AutoFixHigh as AutoFixHighIcon,
  CheckCircle as CheckCircleIcon,
  Psychology as PsychologyIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import type {
  BlinkDetectionResult,
  CullingResult,
  PhotoAnalysis,
  PhotoQualityScore,
  SharpnessAnalysis} from '@/services/ai-vision-service';
import {
  AIVisionService
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
  const [culling, setCulling] = useState(false);
  const [analysis, setAnalysis] = useState<PhotoAnalysis | null>(null);
  const [blink, setBlink] = useState<BlinkDetectionResult | null>(null);
  const [sharpness, setSharpness] = useState<SharpnessAnalysis | null>(null);
  const [quality, setQuality] = useState<PhotoQualityScore | null>(null);
  const [cullResult, setCullResult] = useState<CullingResult | null>(null);
  const [showCullDialog, setShowCullDialog] = useState(false);

  const handleAnalyzeCurrentPhoto = async () => {
    if (!currentPhoto) {
      return;
    }

    setAnalyzing(true);
    try {
      const image = await loadImage(currentPhoto.url);
      const [analysisData, blinkData, sharpnessData, qualityData] = await Promise.all([
        AIVisionService.analyzePhoto(image, {
          includeComposition: true,
          includeQuality: true,
          useBrowser: true,
        }),
        AIVisionService.detectBlinks(image),
        AIVisionService.analyzeSharpness(image),
        AIVisionService.evaluatePhotoQuality({
          id: currentPhoto.id,
          imageData: image,
        }),
      ]);

      setAnalysis(analysisData);
      setBlink(blinkData);
      setSharpness(sharpnessData);
      setQuality(qualityData);
    } catch (error) {
      console.error('AI analysis failed:', error);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAutoCull = async () => {
    setCulling(true);
    try {
      const result = await AIVisionService.cullPhotoSet(
        allPhotos.map((photo) => ({
          id: photo.id,
          url: photo.url,
          imageData: photo.imageData,
        })),
        {
          keepPercentage: 25,
          criteria: {
            composition: 0.3,
            sharpness: 0.4,
            exposure: 0.2,
            expression: 0.1,
          },
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

  const applyCullResult = () => {
    if (!cullResult || !onPhotosFiltered) {
      setShowCullDialog(false);
      return;
    }
    onPhotosFiltered(
      cullResult.keepers.map((entry) => entry.id),
      cullResult.rejected.map((entry) => entry.id),
      cullResult.maybes.map((entry) => entry.id),
    );
    setShowCullDialog(false);
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <PsychologyIcon />
        AI Photo Analysis
      </Typography>

      <Stack spacing={2}>
        <Card>
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                Current Photo
              </Typography>
              <Button
                variant="contained"
                startIcon={<AutoFixHighIcon />}
                disabled={!currentPhoto || analyzing}
                onClick={handleAnalyzeCurrentPhoto}
              >
                {analyzing ? 'Analyserer…' : 'Analyser nå'}
              </Button>
            </Stack>
            {analyzing && <LinearProgress sx={{ mb: 1.5 }} />}

            {!currentPhoto && (
              <Alert severity="info">Velg et bilde for å kjøre analyse.</Alert>
            )}

            {quality && (
              <Box sx={{ mt: 1.5 }}>
                <Typography variant="caption" color="text.secondary">
                  Overall quality {(quality.overall * 100).toFixed(0)}%
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={quality.overall * 100}
                  sx={{
                    mt: 0.5,
                    height: 10,
                    borderRadius: 5,
                    '& .MuiLinearProgress-bar': {
                      bgcolor: getQualityColor(quality.overall),
                    },
                  }}
                />
                <Grid container spacing={1} sx={{ mt: 1 }}>
                  <Metric label="Sharpness" value={quality.sharpness} />
                  <Metric label="Composition" value={quality.composition} />
                  <Metric label="Exposure" value={quality.exposure} />
                  <Metric label="Expression" value={quality.expression} />
                </Grid>
              </Box>
            )}

            {blink && (
              <Alert severity={blink.hasBlinkingPerson ? 'warning' : 'success'} sx={{ mt: 1.5 }}>
                {blink.hasBlinkingPerson
                  ? `${blink.blinkingFaces.length} ansikt(er) med blink oppdaget`
                  : 'Ingen blink oppdaget'}
              </Alert>
            )}

            {sharpness && (
              <Alert severity={sharpness.isBlurry ? 'warning' : 'success'} sx={{ mt: 1.5 }}>
                Skarphet {(sharpness.score * 100).toFixed(0)}% • anbefaling: {sharpness.recommendation}
              </Alert>
            )}

            {analysis && analysis.suggestions.length > 0 && (
              <Box sx={{ mt: 1.5 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  AI-forslag
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {analysis.suggestions.slice(0, 8).map((suggestion, index) => (
                    <Chip
                      key={`${suggestion}-${index}`}
                      label={suggestion}
                      onClick={() => onApplySuggestion?.(suggestion)}
                      clickable
                    />
                  ))}
                </Stack>
              </Box>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Auto Culling
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Rangerer hele bildesettet og deler i keep/reject/maybe.
                </Typography>
              </Box>
              <Button
                variant="outlined"
                startIcon={<CheckCircleIcon />}
                disabled={allPhotos.length === 0 || culling}
                onClick={handleAutoCull}
              >
                {culling ? 'Kjører…' : `Cull ${allPhotos.length} bilder`}
              </Button>
            </Stack>
            {culling && <LinearProgress sx={{ mt: 1.5 }} />}
          </CardContent>
        </Card>
      </Stack>

      <Dialog open={showCullDialog} onClose={() => setShowCullDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Auto-cull resultat</DialogTitle>
        <DialogContent>
          {cullResult ? (
            <Stack spacing={2}>
              <Alert severity="info">
                Total {cullResult.statistics.total} • keeper-rate {cullResult.statistics.keeperPercentage.toFixed(1)}%
              </Alert>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <BucketCard
                    title="Keepers"
                    color="success.main"
                    icon={<CheckCircleIcon fontSize="small" />}
                    items={cullResult.keepers.map((entry) => `${entry.id} (${(entry.score * 100).toFixed(0)}%)`)}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <BucketCard
                    title="Maybes"
                    color="warning.main"
                    icon={<WarningIcon fontSize="small" />}
                    items={cullResult.maybes.map((entry) => `${entry.id} (${(entry.score * 100).toFixed(0)}%)`)}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <BucketCard
                    title="Rejected"
                    color="error.main"
                    icon={<WarningIcon fontSize="small" />}
                    items={cullResult.rejected.map((entry) => `${entry.id} (${(entry.score * 100).toFixed(0)}%)`)}
                  />
                </Grid>
              </Grid>
            </Stack>
          ) : (
            <Typography>Ingen data tilgjengelig.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCullDialog(false)}>Lukk</Button>
          <Button variant="contained" onClick={applyCullResult}>
            Bruk resultat
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Grid item xs={6} sm={3}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {(value * 100).toFixed(0)}%
      </Typography>
    </Grid>
  );
}

function BucketCard({
  title,
  color,
  icon,
  items,
}: {
  title: string;
  color: string;
  icon: React.ReactNode;
  items: string[];
}) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="subtitle2" sx={{ color, display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
          {icon}
          {title}
        </Typography>
        <Divider sx={{ mb: 1 }} />
        <Stack spacing={0.5}>
          {items.slice(0, 8).map((item) => (
            <Typography key={item} variant="caption">
              {item}
            </Typography>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}

function getQualityColor(score: number): string {
  if (score >= 0.8) {
    return '#4caf50';
  }
  if (score >= 0.6) {
    return '#ffb300';
  }
  if (score >= 0.4) {
    return '#ff9800';
  }
  return '#f44336';
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = (event) => reject(event);
    image.src = url;
  });
}
