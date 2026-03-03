import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {
  AutoFixHigh,
  CheckCircle,
  CloudUpload,
  ColorLens,
  ExpandMore,
  Face,
  Lightbulb,
  Movie,
  Psychology,
  Refresh,
  Settings,
  TrendingUp,
} from '@mui/icons-material';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import { useTheming } from '../../utils/theming-helper';

interface NeuralEngineAnalyzerProps {
  onAnalysisComplete?: (analysis: AnalysisResponse) => void;
  onProjectCreated?: (project: IntelligentProjectResponse) => void;
}

interface AnalysisResponse {
  fileInfo?: {
    path?: string;
    durationSeconds?: number;
    fileName?: string;
  };
  analysis: {
    sceneType: string;
    confidence: number;
    objectsDetected: string[];
    faceCount: number;
    lightingCondition: string;
    brightnessLevel: number;
    contrastLevel: number;
    audioType?: string;
    transcript?: string;
  };
  recommendations: {
    projectType: string;
    recommendedFrameRate: number;
    recommendedResolution: string;
    colorSpace: string;
    suggestedColorPreset: string;
    lightingAdjustment: string;
    exportFormats: string[];
    timelineStructure: string;
  };
  colorOptimization: {
    recommendedLUT: string;
    brightnessAdjustment: number;
    contrastAdjustment: number;
    saturationAdjustment: number;
    temperatureAdjustment: number;
  };
}

interface IntelligentProjectResponse {
  projectId?: string;
  projectName?: string;
  projectResult?: unknown;
}

function getSceneBadgeColor(sceneType: string): 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' {
  const normalized = sceneType.toLowerCase();
  if (normalized.includes('wedding')) {
    return 'secondary';
  }
  if (normalized.includes('corporate')) {
    return 'primary';
  }
  if (normalized.includes('music')) {
    return 'warning';
  }
  if (normalized.includes('documentary')) {
    return 'success';
  }
  return 'default';
}

function getSceneIcon(sceneType: string): string {
  const normalized = sceneType.toLowerCase();
  if (normalized.includes('wedding')) {
    return 'W';
  }
  if (normalized.includes('corporate')) {
    return 'C';
  }
  if (normalized.includes('music')) {
    return 'M';
  }
  if (normalized.includes('documentary')) {
    return 'D';
  }
  return 'V';
}

const EMPTY_ANALYSIS_ERROR = 'Analysis response was missing required fields.';

export default function NeuralEngineAnalyzer({
  onAnalysisComplete,
  onProjectCreated,
}: NeuralEngineAnalyzerProps): React.ReactElement {
  const { user } = useAuth();
  const theming = useTheming('videographer');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [lastError, setLastError] = useState<string>('');

  const fullAnalysisMutation = useMutation({
    mutationFn: async (file: File): Promise<AnalysisResponse> => {
      const formData = new FormData();
      formData.append('video', file);
      const data = await apiRequest('/api/neural-engine/full-analysis', {
        method: 'POST',
        body: formData,
      });

      if (typeof data !== 'object' || data === null || !('analysis' in data) || !('recommendations' in data)) {
        throw new Error(EMPTY_ANALYSIS_ERROR);
      }

      return data as AnalysisResponse;
    },
    onSuccess: (data) => {
      setAnalysisResult(data);
      setShowResults(true);
      setLastError('');
      onAnalysisComplete?.(data);
    },
    onError: (error) => {
      setLastError(error instanceof Error ? error.message : 'Analysis failed');
    },
  });

  const createProjectMutation = useMutation({
    mutationFn: async (payload: {
      projectName: string;
      recommendations: AnalysisResponse['recommendations'];
      sourceVideoPath?: string;
    }): Promise<IntelligentProjectResponse> => {
      const data = await apiRequest('/api/neural-engine/create-intelligent-project', {
        method: 'POST',
        body: {
          ...payload,
          userId: user?.id ?? null,
        },
      });
      return (typeof data === 'object' && data !== null ? data : {}) as IntelligentProjectResponse;
    },
    onSuccess: (data) => {
      setLastError('');
      onProjectCreated?.(data);
    },
    onError: (error) => {
      setLastError(error instanceof Error ? error.message : 'Project creation failed');
    },
  });

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setShowResults(false);
    setAnalysisResult(null);
    setLastError('');
  }, []);

  const handleAnalyze = useCallback(() => {
    if (!selectedFile) {
      return;
    }
    fullAnalysisMutation.mutate(selectedFile);
  }, [fullAnalysisMutation, selectedFile]);

  const handleCreateProject = useCallback(() => {
    if (!analysisResult) {
      return;
    }

    const sceneName = analysisResult.analysis.sceneType.replace(/\s+/g, '_');
    createProjectMutation.mutate({
      projectName: `${sceneName}_${Date.now()}`,
      recommendations: analysisResult.recommendations,
      sourceVideoPath: analysisResult.fileInfo?.path,
    });
  }, [analysisResult, createProjectMutation]);

  const confidencePercent = useMemo(() => {
    if (!analysisResult) {
      return 0;
    }
    return Math.round(analysisResult.analysis.confidence * 100);
  }, [analysisResult]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', p: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <Psychology sx={{ color: theming.colors.primary }} />
          <Typography variant="h5" sx={{ color: theming.colors.primary, fontWeight: 700 }}>
            Neural Engine Analyzer
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary">
          Upload a video, run AI analysis, and generate an editor-ready project profile.
        </Typography>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {!showResults ? (
          <Stack spacing={2}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ color: theming.colors.primary, mb: 1 }}>
                  Upload Video
                </Typography>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  style={{ display: 'none' }}
                  onChange={handleFileSelect}
                />

                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                  <Button
                    variant="outlined"
                    startIcon={<CloudUpload />}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Select Video File
                  </Button>
                  {selectedFile ? (
                    <Chip
                      color="primary"
                      label={`${selectedFile.name} (${(selectedFile.size / 1024 / 1024).toFixed(1)} MB)`}
                      onDelete={() => setSelectedFile(null)}
                    />
                  ) : null}
                </Stack>

                <Button
                  variant="contained"
                  startIcon={<AutoFixHigh />}
                  onClick={handleAnalyze}
                  disabled={!selectedFile || fullAnalysisMutation.isPending}
                  sx={theming.getThemedButtonSx()}
                >
                  {fullAnalysisMutation.isPending ? 'Analyzing...' : 'Start AI Analysis'}
                </Button>

                {fullAnalysisMutation.isPending ? <LinearProgress sx={{ mt: 2 }} /> : null}
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ color: theming.colors.primary, mb: 1 }}>
                  Analysis Capabilities
                </Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <List>
                      <ListItem>
                        <ListItemIcon>
                          <Movie color="primary" />
                        </ListItemIcon>
                        <ListItemText
                          primary="Scene Classification"
                          secondary="Identifies scene context and project category."
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          <Face color="primary" />
                        </ListItemIcon>
                        <ListItemText
                          primary="Face and Subject Detection"
                          secondary="Detects people and counts subjects in frame."
                        />
                      </ListItem>
                    </List>
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <List>
                      <ListItem>
                        <ListItemIcon>
                          <Lightbulb color="primary" />
                        </ListItemIcon>
                        <ListItemText
                          primary="Lighting Diagnostics"
                          secondary="Rates exposure balance and lighting quality."
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          <ColorLens color="primary" />
                        </ListItemIcon>
                        <ListItemText
                          primary="Color Optimization"
                          secondary="Proposes LUT and grade tuning suggestions."
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          <TrendingUp color="primary" />
                        </ListItemIcon>
                        <ListItemText
                          primary="Export Recommendations"
                          secondary="Suggests delivery codecs and formats."
                        />
                      </ListItem>
                    </List>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Stack>
        ) : analysisResult ? (
          <Stack spacing={2}>
            <Card>
              <CardContent>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <CheckCircle color="success" />
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                    Analysis Complete
                  </Typography>
                </Stack>

                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="subtitle2" color="text.secondary">
                        Scene Type
                      </Typography>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                        <Chip label={getSceneIcon(analysisResult.analysis.sceneType)} size="small" />
                        <Chip
                          label={analysisResult.analysis.sceneType}
                          color={getSceneBadgeColor(analysisResult.analysis.sceneType)}
                        />
                      </Stack>
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        Confidence: {confidencePercent}%
                      </Typography>
                    </Paper>
                  </Grid>

                  <Grid size={{ xs: 12, md: 6 }}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="subtitle2" color="text.secondary">
                        Content Detection
                      </Typography>
                      <Typography variant="body2">Faces: {analysisResult.analysis.faceCount}</Typography>
                      <Typography variant="body2">
                        Lighting: {analysisResult.analysis.lightingCondition}
                      </Typography>
                      <Typography variant="body2">
                        Objects: {analysisResult.analysis.objectsDetected.join(', ') || 'None'}
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ color: theming.colors.primary, mb: 1 }}>
                  Recommendations
                </Typography>

                <Accordion defaultExpanded>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Typography variant="subtitle1">Project Settings</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Grid container spacing={1}>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <Typography variant="body2" color="text.secondary">
                          Frame Rate
                        </Typography>
                        <Typography variant="body1">
                          {analysisResult.recommendations.recommendedFrameRate} fps
                        </Typography>
                      </Grid>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <Typography variant="body2" color="text.secondary">
                          Resolution
                        </Typography>
                        <Typography variant="body1">
                          {analysisResult.recommendations.recommendedResolution}
                        </Typography>
                      </Grid>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <Typography variant="body2" color="text.secondary">
                          Color Space
                        </Typography>
                        <Typography variant="body1">
                          {analysisResult.recommendations.colorSpace}
                        </Typography>
                      </Grid>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <Typography variant="body2" color="text.secondary">
                          Suggested Preset
                        </Typography>
                        <Typography variant="body1">
                          {analysisResult.recommendations.suggestedColorPreset}
                        </Typography>
                      </Grid>
                    </Grid>
                  </AccordionDetails>
                </Accordion>

                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Typography variant="subtitle1">Export Formats</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                      {analysisResult.recommendations.exportFormats.map((format) => (
                        <Chip key={format} label={format} size="small" variant="outlined" />
                      ))}
                    </Stack>
                  </AccordionDetails>
                </Accordion>

                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Typography variant="subtitle1">Color Optimization</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Typography variant="body2">
                      LUT: {analysisResult.colorOptimization.recommendedLUT}
                    </Typography>
                    <Typography variant="body2">
                      Brightness: {(analysisResult.colorOptimization.brightnessAdjustment * 100).toFixed(1)}%
                    </Typography>
                    <Typography variant="body2">
                      Contrast: {((analysisResult.colorOptimization.contrastAdjustment - 1) * 100).toFixed(1)}%
                    </Typography>
                    <Typography variant="body2">
                      Saturation: {((analysisResult.colorOptimization.saturationAdjustment - 1) * 100).toFixed(1)}%
                    </Typography>
                  </AccordionDetails>
                </Accordion>
              </CardContent>
            </Card>

            <Stack direction="row" spacing={1} justifyContent="center">
              <Button
                variant="outlined"
                startIcon={<Refresh />}
                onClick={() => {
                  setSelectedFile(null);
                  setAnalysisResult(null);
                  setShowResults(false);
                  setLastError('');
                }}
              >
                Analyze Another Video
              </Button>

              <Button
                variant="contained"
                startIcon={<Settings />}
                disabled={createProjectMutation.isPending}
                onClick={handleCreateProject}
                sx={theming.getThemedButtonSx()}
              >
                {createProjectMutation.isPending ? 'Creating Project...' : 'Create Intelligent Project'}
              </Button>
            </Stack>
          </Stack>
        ) : null}
      </Box>

      {lastError ? (
        <Alert severity="error" sx={{ m: 2 }}>
          {lastError}
        </Alert>
      ) : null}
    </Box>
  );
}
