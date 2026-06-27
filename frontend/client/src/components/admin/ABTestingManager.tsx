import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  type SelectChangeEvent,
} from '@mui/material';
import {
  Add as AddIcon,
  AdsClick as ClicksIcon,
  BarChart as BarChartIcon,
  Email as EmailIcon,
  EmojiEvents as WinnerIcon,
  Groups as AudienceIcon,
  Pause as PauseIcon,
  PlayArrow as PlayIcon,
  Share as ShareIcon,
  Stop as StopIcon,
  TrackChanges as ConversionIcon,
  TrendingUp as ImprovementIcon,
  Visibility as ViewsIcon,
  WarningAmber as WarningIcon,
} from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/lib/queryKeys';
import { useToast } from '@/hooks/use-toast';
import { AdminButton, StatusChip } from './design-system';

type TestStatus = 'draft' | 'running' | 'paused' | 'completed' | 'cancelled';
type TestType = 'email' | 'social';
type TestTab = 'active' | 'completed' | 'draft';

interface VariantMetrics {
  views: number;
  clicks: number;
  conversions: number;
  conversionRate: number;
  engagementRate: number;
  revenue?: number;
}

interface TestVariant {
  id: string;
  name: string;
  description: string;
  audienceSplit: number;
  content: Record<string, unknown>;
  metrics: VariantMetrics;
}

interface TestConfig {
  duration: number;
  minSampleSize: number;
  significanceLevel: number;
  primaryMetric: 'clicks' | 'conversions' | 'engagement' | 'revenue';
  audienceSegment?: string;
}

interface TestResults {
  winner?: string;
  confidence: number;
  improvement: number;
  recommendation: string;
  statisticalSignificance: boolean;
}

interface ABTest {
  id: string;
  name: string;
  type: TestType;
  status: TestStatus;
  variants: TestVariant[];
  config: TestConfig;
  results?: TestResults;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

interface CreateABTestPayload {
  name: string;
  type: TestType;
  variants: Array<Pick<TestVariant, 'name' | 'description' | 'audienceSplit' | 'content'>>;
  config: TestConfig;
}

const defaultVariantMetrics: VariantMetrics = {
  views: 0,
  clicks: 0,
  conversions: 0,
  conversionRate: 0,
  engagementRate: 0,
};

export default function ABTestingManager() {
  const [selectedTab, setSelectedTab] = useState<TestTab>('active');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newTestName, setNewTestName] = useState('');
  const [newTestType, setNewTestType] = useState<TestType>('email');
  const [newPrimaryMetric, setNewPrimaryMetric] =
    useState<TestConfig['primaryMetric']>('conversions');
  const [newDurationDays, setNewDurationDays] = useState<number>(7);
  const [newMinSampleSize, setNewMinSampleSize] = useState<number>(1000);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: tests = [], isLoading } = useQuery({
    queryKey: [...QUERY_KEYS.AB_TESTS, selectedTab],
    queryFn: async () => {
      const res = await fetch(`/api/ab-tests?status=${selectedTab}`);
      if (!res.ok) {
        throw new Error('Failed to fetch A/B tests');
      }
      return (await res.json()) as ABTest[];
    },
    select: (data) => (Array.isArray(data) ? data : []),
  });

  const createTestMutation = useMutation({
    mutationFn: async (payload: CreateABTestPayload) => {
      const res = await fetch('/api/ab-tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        throw new Error('Failed to create A/B test');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AB_TESTS });
      setCreateDialogOpen(false);
      setNewTestName('');
      toast({
        title: 'A/B test created',
        description: 'The test is saved as draft and ready to start.',
      });
    },
    onError: () => {
      toast({
        title: 'Failed to create test',
        description: 'Please validate fields and try again.',
        variant: 'destructive',
      });
    },
  });

  const startTestMutation = useMutation({
    mutationFn: async (testId: string) => {
      const res = await fetch(`/api/ab-tests/${testId}/start`, { method: 'POST' });
      if (!res.ok) {
        throw new Error('Failed to start test');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AB_TESTS });
      toast({
        title: 'Test started',
        description: 'A/B test is now running.',
      });
    },
  });

  const pauseTestMutation = useMutation({
    mutationFn: async (testId: string) => {
      const res = await fetch(`/api/ab-tests/${testId}/pause`, { method: 'POST' });
      if (!res.ok) {
        throw new Error('Failed to pause test');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AB_TESTS });
      toast({
        title: 'Test paused',
        description: 'You can resume the test anytime.',
      });
    },
  });

  const stopTestMutation = useMutation({
    mutationFn: async (testId: string) => {
      const res = await fetch(`/api/ab-tests/${testId}/stop`, { method: 'POST' });
      if (!res.ok) {
        throw new Error('Failed to stop test');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AB_TESTS });
      toast({
        title: 'Test completed',
        description: 'Result snapshot is now available.',
      });
    },
  });

  const getStatusTone = (
    status: TestStatus,
  ): 'success' | 'warning' | 'brand' | 'error' | 'neutral' => {
    if (status === 'running') return 'success';
    if (status === 'paused') return 'warning';
    if (status === 'completed') return 'brand';
    if (status === 'cancelled') return 'error';
    return 'neutral';
  };

  const getTypeIcon = (type: TestType) => {
    if (type === 'email') return <EmailIcon fontSize="small" />;
    return <ShareIcon fontSize="small" />;
  };

  const calculateProgress = (test: ABTest): number => {
    if (!test.startedAt || test.status !== 'running') return 0;
    const startTime = new Date(test.startedAt).getTime();
    const endTime = startTime + test.config.duration * 24 * 60 * 60 * 1000;
    const now = Date.now();
    if (now >= endTime) return 100;
    return Math.min(100, ((now - startTime) / (endTime - startTime)) * 100);
  };

  const averageImprovement = useMemo(() => {
    const completedWithResults = tests.filter(
      (test) => test.status === 'completed' && typeof test.results?.improvement === 'number',
    );
    if (completedWithResults.length === 0) return 0;
    const sum = completedWithResults.reduce((acc, test) => acc + (test.results?.improvement ?? 0), 0);
    return sum / completedWithResults.length;
  }, [tests]);

  const totalAudience = useMemo(
    () =>
      tests.reduce(
        (sum, test) =>
          sum +
          (Array.isArray(test.variants) ? test.variants : []).reduce(
            (variantSum, variant) => variantSum + (variant.metrics?.views ?? 0),
            0,
          ),
        0,
      ),
    [tests],
  );

  const handleCreateTest = () => {
    if (!newTestName.trim()) {
      toast({
        title: 'Missing test name',
        description: 'Please set a name before creating the test.',
        variant: 'destructive',
      });
      return;
    }

    const payload: CreateABTestPayload = {
      name: newTestName.trim(),
      type: newTestType,
      variants: [
        {
          name: 'Variant A',
          description: 'Control variant',
          audienceSplit: 50,
          content: {},
        },
        {
          name: 'Variant B',
          description: 'Test variant',
          audienceSplit: 50,
          content: {},
        },
      ],
      config: {
        duration: newDurationDays,
        minSampleSize: newMinSampleSize,
        significanceLevel: 0.95,
        primaryMetric: newPrimaryMetric,
      },
    };

    createTestMutation.mutate(payload);
  };

  const handleTabChange = (_event: React.SyntheticEvent, value: TestTab) => {
    setSelectedTab(value);
  };

  const isBusy =
    createTestMutation.isPending ||
    startTestMutation.isPending ||
    pauseTestMutation.isPending ||
    stopTestMutation.isPending;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            A/B Testing
          </Typography>
          <Typography color="text.secondary">
            Optimize campaigns with controlled experiments and measurable winners.
          </Typography>
        </Box>
        <AdminButton tone="primary" startIcon={<AddIcon />} onClick={() => setCreateDialogOpen(true)}>
          Create Test
        </AdminButton>
      </Box>

      <Grid container spacing={2}>
        <Grid xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography color="text.secondary">Running</Typography>
                <PlayIcon fontSize="small" />
              </Stack>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                {tests.filter((test) => test.status === 'running').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography color="text.secondary">Completed</Typography>
                <BarChartIcon fontSize="small" />
              </Stack>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                {tests.filter((test) => test.status === 'completed').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography color="text.secondary">Avg Improvement</Typography>
                <ImprovementIcon fontSize="small" />
              </Stack>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                {averageImprovement.toFixed(1)}%
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography color="text.secondary">Audience</Typography>
                <AudienceIcon fontSize="small" />
              </Stack>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                {totalAudience.toLocaleString('nb-NO')}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card>
        <CardContent>
          <Tabs value={selectedTab} onChange={handleTabChange}>
            <Tab value="active" label="Active" />
            <Tab value="completed" label="Completed" />
            <Tab value="draft" label="Drafts" />
          </Tabs>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card>
          <CardContent>
            <Typography color="text.secondary">Loading tests...</Typography>
          </CardContent>
        </Card>
      ) : tests.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <Typography color="text.secondary">No tests found for this filter.</Typography>
            <AdminButton tone="ghost" sx={{ mt: 2 }} startIcon={<AddIcon />} onClick={() => setCreateDialogOpen(true)}>
              Create your first test
            </AdminButton>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={2}>
          {tests.map((test) => {
            const variants = Array.isArray(test.variants) ? test.variants : [];
            const winner = variants.find((variant) => variant.id === test.results?.winner);
            return (
              <Card key={test.id}>
                <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    justifyContent="space-between"
                    alignItems={{ xs: 'flex-start', md: 'center' }}
                    gap={2}
                  >
                    <Box>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        {getTypeIcon(test.type)}
                        <Typography variant="h6">{test.name}</Typography>
                        <StatusChip tone={getStatusTone(test.status)} label={test.status} />
                      </Stack>
                      <Typography color="text.secondary" variant="body2">
                        {variants.length} variants | primary metric: {test.config.primaryMetric}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1}>
                      {test.status === 'draft' && (
                        <AdminButton
                          tone="primary"
                          size="small"
                          startIcon={<PlayIcon />}
                          onClick={() => startTestMutation.mutate(test.id)}
                          disabled={isBusy}
                        >
                          Start
                        </AdminButton>
                      )}
                      {test.status === 'running' && (
                        <>
                          <AdminButton
                            tone="secondary"
                            size="small"
                            startIcon={<PauseIcon />}
                            onClick={() => pauseTestMutation.mutate(test.id)}
                            disabled={isBusy}
                          >
                            Pause
                          </AdminButton>
                          <AdminButton
                            tone="danger"
                            size="small"
                            startIcon={<StopIcon />}
                            onClick={() => stopTestMutation.mutate(test.id)}
                            disabled={isBusy}
                          >
                            Stop
                          </AdminButton>
                        </>
                      )}
                      {test.status === 'paused' && (
                        <AdminButton
                          tone="primary"
                          size="small"
                          startIcon={<PlayIcon />}
                          onClick={() => startTestMutation.mutate(test.id)}
                          disabled={isBusy}
                        >
                          Resume
                        </AdminButton>
                      )}
                    </Stack>
                  </Stack>

                  {test.status === 'running' && (
                    <Box>
                      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">
                          Progress
                        </Typography>
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>
                          {calculateProgress(test).toFixed(0)}%
                        </Typography>
                      </Stack>
                      <LinearProgress value={calculateProgress(test)} variant="determinate" />
                    </Box>
                  )}

                  <Grid container spacing={1.5}>
                    {variants.map((variant) => (
                      <Grid key={variant.id} xs={12} md={6} lg={4}>
                        <Card variant="outlined">
                          <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                              <Typography sx={{ fontWeight: 600 }}>{variant.name}</Typography>
                              {winner?.id === variant.id && (
                                <Tooltip title="Winner">
                                  <WinnerIcon color="warning" fontSize="small" />
                                </Tooltip>
                              )}
                            </Stack>
                            <Typography variant="caption" color="text.secondary">
                              {variant.audienceSplit}% of audience
                            </Typography>
                            <Stack direction="row" justifyContent="space-between">
                              <Stack direction="row" spacing={0.5} alignItems="center">
                                <ViewsIcon fontSize="small" />
                                <Typography variant="caption">Views</Typography>
                              </Stack>
                              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                {(variant.metrics.views ?? 0).toLocaleString('nb-NO')}
                              </Typography>
                            </Stack>
                            <Stack direction="row" justifyContent="space-between">
                              <Stack direction="row" spacing={0.5} alignItems="center">
                                <ClicksIcon fontSize="small" />
                                <Typography variant="caption">Clicks</Typography>
                              </Stack>
                              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                {(variant.metrics.clicks ?? 0).toLocaleString('nb-NO')}
                              </Typography>
                            </Stack>
                            <Stack direction="row" justifyContent="space-between">
                              <Stack direction="row" spacing={0.5} alignItems="center">
                                <ConversionIcon fontSize="small" />
                                <Typography variant="caption">Conversions</Typography>
                              </Stack>
                              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                {(variant.metrics.conversions ?? 0).toLocaleString('nb-NO')}
                              </Typography>
                            </Stack>
                            <Stack direction="row" justifyContent="space-between" sx={{ pt: 0.5 }}>
                              <Typography variant="caption" color="text.secondary">
                                Conversion rate
                              </Typography>
                              <Typography variant="caption" sx={{ fontWeight: 700 }}>
                                {(variant.metrics.conversionRate ?? 0).toFixed(2)}%
                              </Typography>
                            </Stack>
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>

                  {test.status === 'completed' && test.results && (
                    <Card variant="outlined">
                      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Typography variant="subtitle2">Test Results</Typography>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2" color="text.secondary">
                            Winner
                          </Typography>
                          <StatusChip
                            tone={winner ? 'success' : 'neutral'}
                            label={winner?.name ?? 'No winner'}
                          />
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2" color="text.secondary">
                            Improvement
                          </Typography>
                          <Typography sx={{ fontWeight: 700, color: 'success.main' }}>
                            +{test.results.improvement.toFixed(1)}%
                          </Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2" color="text.secondary">
                            Confidence
                          </Typography>
                          <Typography sx={{ fontWeight: 700 }}>
                            {(test.results.confidence * 100).toFixed(0)}%
                          </Typography>
                        </Stack>
                        {!test.results.statisticalSignificance && (
                          <Alert icon={<WarningIcon fontSize="inherit" />} severity="warning">
                            Results are not statistically significant yet. Run longer for stronger confidence.
                          </Alert>
                        )}
                        <Typography variant="body2" color="text.secondary">
                          {test.results.recommendation}
                        </Typography>
                      </CardContent>
                    </Card>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      )}

      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create A/B Test</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '12px !important' }}>
          <TextField
            label="Test name"
            value={newTestName}
            onChange={(event) => setNewTestName(event.target.value)}
            fullWidth
          />

          <FormControl fullWidth>
            <InputLabel id="ab-test-type-label">Test type</InputLabel>
            <Select
              labelId="ab-test-type-label"
              value={newTestType}
              label="Test type"
              onChange={(event: SelectChangeEvent<TestType>) => {
                setNewTestType(event.target.value as TestType);
              }}
            >
              <MenuItem value="email">Email campaign</MenuItem>
              <MenuItem value="social">Social post</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel id="ab-test-metric-label">Primary metric</InputLabel>
            <Select
              labelId="ab-test-metric-label"
              value={newPrimaryMetric}
              label="Primary metric"
              onChange={(event: SelectChangeEvent<TestConfig['primaryMetric']>) => {
                setNewPrimaryMetric(event.target.value as TestConfig['primaryMetric']);
              }}
            >
              <MenuItem value="clicks">Clicks</MenuItem>
              <MenuItem value="conversions">Conversions</MenuItem>
              <MenuItem value="engagement">Engagement</MenuItem>
              <MenuItem value="revenue">Revenue</MenuItem>
            </Select>
          </FormControl>

          <Grid container spacing={2}>
            <Grid xs={12} sm={6}>
              <TextField
                label="Duration (days)"
                type="number"
                value={newDurationDays}
                onChange={(event) => setNewDurationDays(Math.max(1, Number(event.target.value) || 1))}
                fullWidth
              />
            </Grid>
            <Grid xs={12} sm={6}>
              <TextField
                label="Min sample size"
                type="number"
                value={newMinSampleSize}
                onChange={(event) =>
                  setNewMinSampleSize(Math.max(100, Number(event.target.value) || 100))
                }
                fullWidth
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <AdminButton tone="ghost" onClick={() => setCreateDialogOpen(false)}>Cancel</AdminButton>
          <AdminButton
            tone="primary"
            onClick={handleCreateTest}
            loading={createTestMutation.isPending}
            disabled={!newTestName.trim()}
          >
            Create Test
          </AdminButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
