import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  LinearProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  IconButton,
  Tooltip,
  CircularProgress,
  Divider,
  Stack,
  ThemeProvider,
  type ChipProps,
} from '@mui/material';
import { adminDarkTheme } from './adminDarkTheme';
import {
  CheckCircle,
  Error,
  Warning,
  Refresh,
  PlayArrow,
  Stop,
  TrendingUp,
  Storage,
  CloudUpload,
  Psychology,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface TestStatus {
  name: string;
  status: 'passed' | 'failed' | 'skipped' | 'running';
  message?: string;
}

interface TrainingDataStats {
  total_samples: number;
  adjusted_samples: number;
  avg_confidence: number;
  avg_adjustment: number;
  first_sample: string;
  latest_sample: string;
}

interface ModelVersion {
  id: string;
  model_type: string;
  version_number: number;
  status: string;
  is_active: boolean;
  training_data_count: number;
  validation_accuracy: number;
  test_accuracy: number;
  training_completed_at: string;
  created_at: string;
}

interface AllModels {
  model_type: string;
  storage_type: string;
  r2_key: string;
  base_path: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface TrainingSystems {
  sync: {
    trainingData: any;
    modelVersions: any[];
  };
  ai: {
    trainingJobs: any;
    trainingData: any[];
  };
  lighting: {
    trainingData: any;
  };
  sam2: {
    models: any[];
    modelCount: number;
    trainingData: any;
    modelVersions: any[];
  };
}

interface SystemStatus {
  database: { status: string };
  syncTraining: { status: string };
  aiTraining: { status: string };
  lightingTraining: { status: string };
  r2Storage: { status: string; modelCount?: number };
}

export default function FineTuningMonitoringPanel() {
  const queryClient = useQueryClient();
  const [isRunningTest, setIsRunningTest] = useState(false);
  const [testResults, setTestResults] = useState<TestStatus[]>([]);

  // Fetch training data statistics
  const { data: trainingStats, isLoading: statsLoading } = useQuery<TrainingDataStats>({
    queryKey: ['/api/video-sync/training-data/stats'],
    queryFn: async () => {
      return apiRequest('/api/video-sync/training-data/stats');
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch model versions
  const { data: modelVersions, isLoading: versionsLoading } = useQuery<ModelVersion[]>({
    queryKey: ['/api/video-sync/model-versions'],
    queryFn: async () => {
      const response = await apiRequest('/api/video-sync/model-versions');
      return Array.isArray(response?.versions) ? response.versions : [];
    },
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch all models from R2
  const { data: allModels, isLoading: allModelsLoading } = useQuery<AllModels[]>({
    queryKey: ['/api/training-monitoring/all-models'],
    queryFn: async () => {
      const response = await apiRequest('/api/training-monitoring/all-models');
      return Array.isArray(response?.models) ? response.models : [];
    },
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch all training systems status
  const { data: trainingSystems, isLoading: systemsLoading } = useQuery<TrainingSystems>({
    queryKey: ['/api/training-monitoring/training-systems'],
    queryFn: async () => {
      const response = await apiRequest('/api/training-monitoring/training-systems');
      return response.systems || {};
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch system status
  const { data: systemStatus, isLoading: statusLoading } = useQuery<SystemStatus>({
    queryKey: ['/api/training-monitoring/system-status'],
    queryFn: async () => {
      const response = await apiRequest('/api/training-monitoring/system-status');
      return response.status || {};
    },
    refetchInterval: 30000, // Refresh every 10 seconds
  });

  // Run system test
  const runTestMutation = useMutation({
    mutationFn: async (modelType?: string) => {
      setIsRunningTest(true);
      const response = await apiRequest('/api/training-monitoring/run-test', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({ modelType: modelType || 'sam2' }),
      });
      return Array.isArray(response?.results) ? response.results : [];
    },
    onSuccess: (results) => {
      setTestResults(Array.isArray(results) ? results : []);
      setIsRunningTest(false);
    },
    onError: (error: any) => {
      console.error('Test failed: ', error);
      setTestResults([
        { name: 'Test Execution', status: 'failed', message: error.message || 'Unknown error' },
      ]);
      setIsRunningTest(false);
    },
  });

  const handleRunTest = (modelType?: string) => {
    runTestMutation.mutate(modelType);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed':
      case 'completed':
      case 'active':
        return <CheckCircle color="success" />;
      case 'failed':
      case 'error':
        return <Error color="error" />;
      case 'skipped':
      case 'training':
        return <Warning color="warning" />;
      default:
        return <CircularProgress size={20} />;
    }
  };

  const getStatusColor = (status: string): ChipProps['color'] => {
    switch (status) {
      case 'passed':
      case 'completed':
      case 'active':
        return 'success';
      case 'failed':
      case 'error':
        return 'error';
      case 'skipped':
      case 'training':
        return 'warning';
      default:
        return 'default';
    }
  };

  const toNumericValue = (value: string | number | null | undefined): number => {
    if (value === null || value === undefined || value === '') {
      return 0;
    }
    if (typeof value === 'number') {
      return value;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  return (
    <ThemeProvider theme={adminDarkTheme}>
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Psychology color="primary" />
            Training Systems Monitor
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Monitor all training systems: Video Sync, AI Models, Lighting ML, and all R2 models
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            startIcon={isRunningTest ? <CircularProgress size={16} /> : <Refresh />}
            onClick={() => handleRunTest('sam2')}
            disabled={isRunningTest}
          >
            Test SAM 2
          </Button>
          <Button
            variant="outlined"
            startIcon={isRunningTest ? <CircularProgress size={16} /> : <Refresh />}
            onClick={() => handleRunTest('synchformer')}
            disabled={isRunningTest}
          >
            Test Sync Models
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* System Status Overview */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Storage color="primary" />
                System Status
              </Typography>
              <Divider sx={{ my: 2 }} />
              
              {statusLoading ? (
                <LinearProgress />
              ) : systemStatus ? (
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid item xs={12} sm={6} md={4}>
                    <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                      <Typography variant="body2" color="text.secondary">Database</Typography>
                      <Chip
                        icon={getStatusIcon(systemStatus.database.status)}
                        label={systemStatus.database.status}
                        color={getStatusColor(systemStatus.database.status) as any}
                        size="small"
                        sx={{ mt: 1 }}
                      />
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6} md={4}>
                    <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                      <Typography variant="body2" color="text.secondary">Sync Training</Typography>
                      <Chip
                        icon={getStatusIcon(systemStatus.syncTraining.status)}
                        label={systemStatus.syncTraining.status}
                        color={getStatusColor(systemStatus.syncTraining.status) as any}
                        size="small"
                        sx={{ mt: 1 }}
                      />
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6} md={4}>
                    <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                      <Typography variant="body2" color="text.secondary">AI Training</Typography>
                      <Chip
                        icon={getStatusIcon(systemStatus.aiTraining.status)}
                        label={systemStatus.aiTraining.status}
                        color={getStatusColor(systemStatus.aiTraining.status) as any}
                        size="small"
                        sx={{ mt: 1 }}
                      />
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6} md={4}>
                    <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                      <Typography variant="body2" color="text.secondary">Lighting Training</Typography>
                      <Chip
                        icon={getStatusIcon(systemStatus.lightingTraining.status)}
                        label={systemStatus.lightingTraining.status}
                        color={getStatusColor(systemStatus.lightingTraining.status) as any}
                        size="small"
                        sx={{ mt: 1 }}
                      />
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6} md={4}>
                    <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                      <Typography variant="body2" color="text.secondary">R2 Storage</Typography>
                      <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip
                          icon={getStatusIcon(systemStatus.r2Storage.status)}
                          label={systemStatus.r2Storage.status}
                          color={getStatusColor(systemStatus.r2Storage.status) as any}
                          size="small"
                        />
                        {systemStatus.r2Storage.modelCount !== undefined && (
                          <Typography variant="caption" color="text.secondary">
                            ({systemStatus.r2Storage.modelCount} models)
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </Grid>
                </Grid>
              ) : null}
              
              {testResults.length > 0 && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" gutterBottom>Test Results</Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Test</TableCell>
                          <TableCell align="center">Status</TableCell>
                          <TableCell>Message</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {testResults.map((test, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{test.name}</TableCell>
                            <TableCell align="center">
                              <Chip
                                icon={getStatusIcon(test.status)}
                                label={test.status.toUpperCase()}
                                color={getStatusColor(test.status) as any}
                                size="small"
                              />
                            </TableCell>
                            <TableCell>{test.message || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Training Data Statistics */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Storage color="primary" />
                Training Data
              </Typography>
              <Divider sx={{ my: 2 }} />
              
              {statsLoading ? (
                <LinearProgress />
              ) : trainingStats ? (
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Total Samples
                    </Typography>
                    <Typography variant="h4" color="primary">
                      {trainingStats.total_samples || 0}
                    </Typography>
                  </Box>
                  
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Adjusted Samples
                    </Typography>
                    <Typography variant="h5">
                      {trainingStats.adjusted_samples || 0}
                      {trainingStats.total_samples > 0 && (
                        <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                          ({Math.round((trainingStats.adjusted_samples / trainingStats.total_samples) * 100)}%)
                        </Typography>
                      )}
                    </Typography>
                  </Box>
                  
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Average Confidence
                    </Typography>
                    <Typography variant="h6">
                      {trainingStats.avg_confidence
                        ? (toNumericValue(trainingStats.avg_confidence) * 100).toFixed(1)
                        : '0.0'}
                      %
                    </Typography>
                  </Box>
                  
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Average Adjustment
                    </Typography>
                    <Typography variant="h6">
                      {trainingStats.avg_adjustment
                        ? toNumericValue(trainingStats.avg_adjustment).toFixed(4)
                        : '0.0000'}s
                    </Typography>
                  </Box>
                  
                  {trainingStats.first_sample && (
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        First Sample
                      </Typography>
                      <Typography variant="body2">
                        {new Date(trainingStats.first_sample).toLocaleDateString()}
                      </Typography>
                    </Box>
                  )}
                  
                  {trainingStats.latest_sample && (
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Latest Sample
                      </Typography>
                      <Typography variant="body2">
                        {new Date(trainingStats.latest_sample).toLocaleDateString()}
                      </Typography>
                    </Box>
                  )}
                </Stack>
              ) : (
                <Alert severity="warning">No training data available</Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Fine-Tuning Pipeline Status */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TrendingUp color="primary" />
                Fine-Tuning Pipeline
              </Typography>
              <Divider sx={{ my: 2 }} />
              
              <Stack spacing={2}>
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Loads training data
                  </Typography>
                  <Chip
                    icon={<CheckCircle />}
                    label="Ready"
                    color="success"
                    size="small"
                  />
                </Box>
                
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Prepares dataset
                  </Typography>
                  <Chip
                    icon={<CheckCircle />}
                    label="Ready"
                    color="success"
                    size="small"
                  />
                </Box>
                
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Trains model
                  </Typography>
                  <Chip
                    icon={<CheckCircle />}
                    label="Ready"
                    color="success"
                    size="small"
                  />
                </Box>
                
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Evaluates performance
                  </Typography>
                  <Chip
                    icon={<CheckCircle />}
                    label="Ready"
                    color="success"
                    size="small"
                  />
                </Box>
                
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Saves model version
                  </Typography>
                  <Chip
                    icon={<CheckCircle />}
                    label="Ready"
                    color="success"
                    size="small"
                  />
                </Box>
                
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Updates database
                  </Typography>
                  <Chip
                    icon={<CheckCircle />}
                    label="Ready"
                    color="success"
                    size="small"
                  />
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* All Models in R2 */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CloudUpload color="primary" />
                All Models in R2 Storage
              </Typography>
              <Divider sx={{ my: 2 }} />
              
              {allModelsLoading ? (
                <LinearProgress />
              ) : allModels && allModels.length > 0 ? (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Model Type</TableCell>
                        <TableCell>Storage</TableCell>
                        <TableCell>R2 Key</TableCell>
                        <TableCell align="center">Active</TableCell>
                        <TableCell>Updated</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {allModels.map((model, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <Chip label={model.model_type} size="small" color="primary" />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={model.storage_type}
                              size="small"
                              color={model.storage_type === 'r2' ? 'success' : 'default'}
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                              {model.r2_key || model.base_path || '-'}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            {model.is_active ? (
                              <Chip icon={<CheckCircle />} label="Active" color="success" size="small" />
                            ) : (
                              <Chip label="Inactive" size="small" />
                            )}
                          </TableCell>
                          <TableCell>
                            {model.updated_at
                              ? new Date(model.updated_at).toLocaleDateString()
                              : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Alert severity="info">No models found in database</Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* All Training Systems */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TrendingUp color="primary" />
                All Training Systems
              </Typography>
              <Divider sx={{ my: 2 }} />
              
              {systemsLoading ? (
                <LinearProgress />
              ) : trainingSystems ? (
                <Grid container spacing={2}>
                  {/* Sync Training */}
                  <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
                      <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600}}>
                        Video Sync Training
                      </Typography>
                      {trainingSystems.sync?.trainingData && (
                        <Stack spacing={1} sx={{ mt: 1 }}>
                          <Box>
                            <Typography variant="body2" color="text.secondary">Total Samples</Typography>
                            <Typography variant="h6">{trainingSystems.sync.trainingData.total_samples || 0}</Typography>
                          </Box>
                          <Box>
                            <Typography variant="body2" color="text.secondary">Adjusted</Typography>
                            <Typography variant="body1">
                              {trainingSystems.sync.trainingData.adjusted_samples || 0}
                            </Typography>
                          </Box>
                          <Box>
                            <Typography variant="body2" color="text.secondary">Model Versions</Typography>
                            <Typography variant="body1">
                              {trainingSystems.sync.modelVersions?.length || 0}
                            </Typography>
                          </Box>
                        </Stack>
                      )}
                    </Paper>
                  </Grid>

                  {/* AI Training */}
                  <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
                      <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600}}>
                        AI Model Training
                      </Typography>
                      {trainingSystems.ai?.trainingJobs && (
                        <Stack spacing={1} sx={{ mt: 1 }}>
                          <Box>
                            <Typography variant="body2" color="text.secondary">Total Jobs</Typography>
                            <Typography variant="h6">{trainingSystems.ai.trainingJobs.total_jobs || 0}</Typography>
                          </Box>
                          <Box>
                            <Typography variant="body2" color="text.secondary">Completed</Typography>
                            <Typography variant="body1">
                              {trainingSystems.ai.trainingJobs.completed_jobs || 0}
                            </Typography>
                          </Box>
                          <Box>
                            <Typography variant="body2" color="text.secondary">Training Data Types</Typography>
                            <Typography variant="body1">
                              {trainingSystems.ai.trainingData?.length || 0}
                            </Typography>
                          </Box>
                        </Stack>
                      )}
                    </Paper>
                  </Grid>

                  {/* Lighting Training */}
                  <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
                      <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600}}>
                        Lighting ML Training
                      </Typography>
                      {trainingSystems.lighting?.trainingData && (
                        <Stack spacing={1} sx={{ mt: 1 }}>
                          <Box>
                            <Typography variant="body2" color="text.secondary">Total Samples</Typography>
                            <Typography variant="h6">
                              {trainingSystems.lighting.trainingData.total_samples || 0}
                            </Typography>
                          </Box>
                        </Stack>
                      )}
                    </Paper>
                  </Grid>

                  {/* SAM 2 Motion Tracking */}
                  <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
                      <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600}}>
                        SAM 2 Motion Tracking
                      </Typography>
                      {trainingSystems.sam2 && (
                        <Stack spacing={1} sx={{ mt: 1 }}>
                          <Box>
                            <Typography variant="body2" color="text.secondary">Models Available</Typography>
                            <Typography variant="h6">
                              {trainingSystems.sam2.modelCount || 0}
                            </Typography>
                          </Box>
                          {trainingSystems.sam2.trainingData && (
                            <>
                              <Box>
                                <Typography variant="body2" color="text.secondary">Training Samples</Typography>
                                <Typography variant="body1">
                                  {trainingSystems.sam2.trainingData.total_samples || 0}
                                  {trainingSystems.sam2.trainingData.corrected_samples > 0 && (
                                    <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                                      ({trainingSystems.sam2.trainingData.corrected_samples} corrected)
                                    </Typography>
                                  )}
                                </Typography>
                              </Box>
                              <Box>
                                <Typography variant="body2" color="text.secondary">Fine-Tuned Versions</Typography>
                                <Typography variant="body1">
                                  {trainingSystems.sam2.modelVersions?.length || 0}
                                </Typography>
                              </Box>
                            </>
                          )}
                        </Stack>
                      )}
                    </Paper>
                  </Grid>
                </Grid>
              ) : (
                <Alert severity="info">Loading training systems data...</Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Fine-Tuned Model Versions */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CloudUpload color="primary" />
                Fine-Tuned Model Versions
              </Typography>
              <Divider sx={{ my: 2 }} />
              
              {versionsLoading ? (
                <LinearProgress />
              ) : modelVersions && modelVersions.length > 0 ? (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Model Type</TableCell>
                        <TableCell>Version</TableCell>
                        <TableCell align="center">Status</TableCell>
                        <TableCell align="center">Active</TableCell>
                        <TableCell align="right">Training Samples</TableCell>
                        <TableCell align="right">Validation Accuracy</TableCell>
                        <TableCell align="right">Test Accuracy</TableCell>
                        <TableCell>Completed</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {modelVersions.map((version) => (
                        <TableRow key={version.id}>
                          <TableCell>
                            <Chip label={version.model_type} size="small" />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 600}}>
                              v{version.version_number}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              icon={getStatusIcon(version.status)}
                              label={version.status}
                              color={getStatusColor(version.status)}
                              size="small"
                            />
                          </TableCell>
                          <TableCell align="center">
                            {version.is_active ? (
                              <Chip icon={<CheckCircle />} label="Active" color="success" size="small" />
                            ) : (
                              <Chip label="Inactive" size="small" />
                            )}
                          </TableCell>
                          <TableCell align="right">{version.training_data_count || 0}</TableCell>
                          <TableCell align="right">
                            {version.validation_accuracy
                              ? (toNumericValue(version.validation_accuracy) * 100).toFixed(1)
                              : '-'}
                            %
                          </TableCell>
                          <TableCell align="right">
                            {version.test_accuracy
                              ? (toNumericValue(version.test_accuracy) * 100).toFixed(1)
                              : '-'}
                            %
                          </TableCell>
                          <TableCell>
                            {version.training_completed_at
                              ? new Date(version.training_completed_at).toLocaleDateString()
                              :'-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Alert severity="info">No fine-tuned models yet. Models will appear here after training.</Alert>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
    </ThemeProvider>
  );
}
