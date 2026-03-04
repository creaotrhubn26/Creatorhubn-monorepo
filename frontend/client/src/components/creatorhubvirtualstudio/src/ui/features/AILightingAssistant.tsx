import * as React from 'react';
import { logger } from '../../core/services/logger';

const log = logger.module('AILighting, ');
import {
  Box,
  Button,
  Typography,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Alert,
} from '@mui/material';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import CompareIcon from '@mui/icons-material/Compare';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { useScene, useActions } from '@/state/selectors';
import type {
  SceneAnalysisResult} from '@/core/services/ai-integration';
import {
  analyzeReferencePhoto,
  applyLightingRecommendation
} from '@/core/services/ai-integration';

export default function AILightingAssistant() {
  const scene = useScene();
  const { setScene } = useActions();
  const [analyzing, setAnalyzing] = React.useState(false);
  const [analysis, setAnalysis] = React.useState<SceneAnalysisResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAnalyzing(true);
    setError(null);

    try {
      log.info('Analyzing reference photo with AI...');
      const result = await analyzeReferencePhoto(file);
      setAnalysis(result);
      log.debug('Analysis complete: ', result);
    } catch (err) {
      log.error('AI analysis failed: ', err);
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleApplyRecommendation = () => {
    if (!analysis) return;

    const newScene = applyLightingRecommendation(scene, analysis.recommendation);
    setScene(newScene);
    log.info('Applied AI lighting recommendation');
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner':
        return 'success';
      case 'intermediate':
        return 'info';
      case 'advanced':
        return 'warning';
      case 'professional':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileUpload}
      />

      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <AutoFixHighIcon />
        AI Lighting Assistant
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Upload a reference photo and get AI-powered lighting setup recommendations
      </Typography>

      {/* Upload Button */}
      <Button
        fullWidth
        variant="contained"
        startIcon={analyzing ? <CircularProgress size={20} color="inherit" /> : <UploadFileIcon />}
        onClick={() => fileInputRef.current?.click()}
        disabled={analyzing}
        sx={{ mb: 2 }}
      >
        {analyzing ? 'Analyzing...' : 'Upload Reference Photo'}
      </Button>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Analysis Results */}
      {analysis && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              AI Analysis Results
            </Typography>

            {/* Scene Classification */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Scene Type
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip label={analysis.original.scene.type} size="small" color="primary" />
                <Chip label={analysis.original.scene.lighting} size="small" />
                <Chip label={analysis.original.scene.activity} size="small" />
              </Box>
            </Box>

            {/* Lighting Recommendation */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Recommended Setup
              </Typography>
              <Chip
                label={analysis.recommendation.setup.replace(/-/g, '').toUpperCase()}
                color="secondary"
                size="small"
              />
            </Box>

            {/* Difficulty & Time */}
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Difficulty
                </Typography>
                <Chip
                  label={analysis.difficulty.toUpperCase()}
                  color={getDifficultyColor(analysis.difficulty) as any}
                  size="small"
                />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Setup Time
                </Typography>
                <Typography variant="body1" fontWeight="bold">
                  {analysis.setupTime} min
                </Typography>
              </Box>
            </Box>

            {/* Lights Count */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Required Lights
              </Typography>
              <Typography variant="body1">
                {analysis.recommendation.lights.length} light
                {analysis.recommendation.lights.length !== 1 ? 's' : ', '}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                {analysis.recommendation.lights.map((light, i) => (
                  <Chip
                    key={i}
                    label={`${light.type} (${light.purpose})`}
                    size="small"
                    variant="outlined"
                  />
                ))}
              </Box>
            </Box>

            {/* Rationale */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                AI Rationale
              </Typography>
              <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
                "{analysis.recommendation.rationale}"
              </Typography>
            </Box>

            {/* Confidence */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Confidence: {Math.round(analysis.recommendation.confidence * 100)}%
              </Typography>
            </Box>

            {/* Apply Button */}
            <Button
              fullWidth
              variant="contained"
              color="success"
              startIcon={<AutoFixHighIcon />}
              onClick={handleApplyRecommendation}
            >
              Apply AI Recommendation
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Quick Tips */}
      <Card sx={{ bgcolor:'#f8fafc' }}>
        <CardContent>
          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
            💡 Tips for Best Results
          </Typography>
          <Typography variant="body2" color="text.secondary" component="ul" sx={{ pl: 2, mt: 1 }}>
            <li>Use clear, well-lit reference photos</li>
            <li>Photos with visible lighting setups work best</li>
            <li>AI analyzes scene type, lighting, and composition</li>
            <li>Recommendations can be tweaked after applying</li>
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
