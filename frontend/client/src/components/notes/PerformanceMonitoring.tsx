import React, { useEffect, useMemo, useState } from 'react';
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
  FormControlLabel,
  Grid,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  Slider,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import {
  Analytics,
  CheckCircle,
  Edit,
  ErrorOutline,
  FileDownload,
  Notifications,
  WarningAmber,
} from '@mui/icons-material';

type MetricCategory =
  | 'core_web_vitals'
  | 'performance'
  | 'accessibility'
  | 'seo'
  | 'best_practices';

type MetricUnit = 'ms' | 'score' | 'bytes' | 'count' | 'percentage';
type MetricStatus = 'good' | 'needs_improvement' | 'poor';
type Trend = 'up' | 'down' | 'stable';

type AlertType = 'threshold' | 'anomaly' | 'degradation';
type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';
type AlertStatus = 'active' | 'resolved' | 'dismissed';

interface PerformanceDataPoint {
  timestamp: Date;
  value: number;
  context?: string;
}

interface PerformanceMetric {
  id: string;
  name: string;
  description: string;
  category: MetricCategory;
  value: number;
  threshold: number;
  unit: MetricUnit;
  status: MetricStatus;
  trend: Trend;
  lastUpdated: Date;
  history: PerformanceDataPoint[];
}

interface PerformanceAlert {
  id: string;
  metricId: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  triggered: Date;
  resolved?: Date;
  status: AlertStatus;
}

interface PerformanceMonitoringProps {
  className?: string;
  onMetricChange?: (metric: PerformanceMetric) => void;
  onAlertChange?: (alert: PerformanceAlert) => void;
  onPerformanceExport?: (data: { metrics: PerformanceMetric[]; alerts: PerformanceAlert[] }) => void;
}

const INITIAL_METRICS: PerformanceMetric[] = [
  {
    id: 'lcp',
    name: 'Largest Contentful Paint',
    description: 'Time to render the largest visible content element.',
    category: 'core_web_vitals',
    value: 2.1,
    threshold: 2.5,
    unit: 'ms',
    status: 'good',
    trend: 'stable',
    lastUpdated: new Date(),
    history: [],
  },
  {
    id: 'cls',
    name: 'Cumulative Layout Shift',
    description: 'Measures visual layout stability.',
    category: 'core_web_vitals',
    value: 0.18,
    threshold: 0.1,
    unit: 'score',
    status: 'needs_improvement',
    trend: 'up',
    lastUpdated: new Date(),
    history: [],
  },
  {
    id: 'ttfb',
    name: 'Time to First Byte',
    description: 'Server response delay to first byte.',
    category: 'performance',
    value: 780,
    threshold: 600,
    unit: 'ms',
    status: 'needs_improvement',
    trend: 'stable',
    lastUpdated: new Date(),
    history: [],
  },
  {
    id: 'a11y',
    name: 'Accessibility Score',
    description: 'Accessibility audit score.',
    category: 'accessibility',
    value: 86,
    threshold: 90,
    unit: 'score',
    status: 'needs_improvement',
    trend: 'up',
    lastUpdated: new Date(),
    history: [],
  },
];

const CATEGORY_LABELS: Record<MetricCategory, string> = {
  core_web_vitals: 'Core Web Vitals',
  performance: 'Performance',
  accessibility: 'Accessibility',
  seo: 'SEO',
  best_practices: 'Best Practices',
};

function metricStatus(value: number, threshold: number, unit: MetricUnit): MetricStatus {
  const scoreLike = unit === 'score' || unit === 'percentage';

  if (scoreLike) {
    if (value >= threshold) {
      return 'good';
    }
    if (value >= threshold * 0.9) {
      return 'needs_improvement';
    }
    return 'poor';
  }

  if (value <= threshold) {
    return 'good';
  }
  if (value <= threshold * 1.2) {
    return 'needs_improvement';
  }
  return 'poor';
}

function randomDeltaForUnit(unit: MetricUnit): number {
  switch (unit) {
    case 'ms':
      return (Math.random() - 0.5) * 60;
    case 'score':
    case 'percentage':
      return (Math.random() - 0.5) * 1.8;
    case 'bytes':
      return (Math.random() - 0.5) * 12000;
    default:
      return (Math.random() - 0.5) * 3;
  }
}

function formatMetricValue(value: number, unit: MetricUnit): string {
  if (unit === 'ms') {
    return `${value.toFixed(0)} ms`;
  }
  if (unit === 'score') {
    return value.toFixed(2);
  }
  if (unit === 'percentage') {
    return `${value.toFixed(1)}%`;
  }
  if (unit === 'bytes') {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return value.toFixed(0);
}

function statusColor(status: MetricStatus): 'success' | 'warning' | 'error' {
  if (status === 'good') {
    return 'success';
  }
  if (status === 'needs_improvement') {
    return 'warning';
  }
  return 'error';
}

function severityFromStatus(status: MetricStatus): AlertSeverity {
  if (status === 'poor') {
    return 'high';
  }
  if (status === 'needs_improvement') {
    return 'medium';
  }
  return 'low';
}

const PerformanceMonitoring: React.FC<PerformanceMonitoringProps> = ({
  className,
  onMetricChange,
  onAlertChange,
  onPerformanceExport,
}) => {
  const [tab, setTab] = useState(0);
  const [metrics, setMetrics] = useState<PerformanceMetric[]>(INITIAL_METRICS);
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const [monitoringEnabled, setMonitoringEnabled] = useState(true);
  const [refreshIntervalSeconds, setRefreshIntervalSeconds] = useState(30);
  const [editingMetric, setEditingMetric] = useState<PerformanceMetric | null>(null);
  const [thresholdDraft, setThresholdDraft] = useState('');

  useEffect(() => {
    if (!monitoringEnabled) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setMetrics((previousMetrics) => {
        const now = new Date();
        const nextMetrics = previousMetrics.map((metric) => {
          const nextValue = Math.max(0, metric.value + randomDeltaForUnit(metric.unit));
          const nextStatus = metricStatus(nextValue, metric.threshold, metric.unit);
          const nextTrend: Trend = nextValue > metric.value ? 'up' : nextValue < metric.value ? 'down' : 'stable';

          const updatedMetric: PerformanceMetric = {
            ...metric,
            value: nextValue,
            status: nextStatus,
            trend: nextTrend,
            lastUpdated: now,
            history: [...metric.history.slice(-29), { timestamp: now, value: nextValue }],
          };

          onMetricChange?.(updatedMetric);
          return updatedMetric;
        });

        setAlerts((previousAlerts) => {
          const nextAlerts = [...previousAlerts];

          for (const metric of nextMetrics) {
            const hasActiveAlert = nextAlerts.some(
              (alert) => alert.metricId === metric.id && alert.status === 'active',
            );

            if (metric.status !== 'good' && !hasActiveAlert) {
              const alert: PerformanceAlert = {
                id: `${metric.id}-${Date.now()}`,
                metricId: metric.id,
                type: metric.status === 'poor' ? 'degradation' : 'threshold',
                severity: severityFromStatus(metric.status),
                message: `${metric.name} is now ${metric.status.replace('_', ' ')}`,
                triggered: now,
                status: 'active',
              };

              onAlertChange?.(alert);
              nextAlerts.unshift(alert);
            }
          }

          return nextAlerts.slice(0, 80);
        });

        return nextMetrics;
      });
    }, refreshIntervalSeconds * 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [monitoringEnabled, refreshIntervalSeconds, onAlertChange, onMetricChange]);

  const activeAlerts = useMemo(
    () => alerts.filter((alert) => alert.status === 'active'),
    [alerts],
  );

  const dashboardScore = useMemo(() => {
    if (metrics.length === 0) {
      return 0;
    }

    const score =
      metrics.reduce((sum, metric) => {
        if (metric.status === 'good') {
          return sum + 100;
        }
        if (metric.status === 'needs_improvement') {
          return sum + 65;
        }
        return sum + 35;
      }, 0) / metrics.length;

    return Math.round(score);
  }, [metrics]);

  const openMetricEditor = (metric: PerformanceMetric) => {
    setEditingMetric(metric);
    setThresholdDraft(metric.threshold.toString());
  };

  const saveMetricThreshold = () => {
    if (!editingMetric) {
      return;
    }

    const parsedThreshold = Number(thresholdDraft);
    if (!Number.isFinite(parsedThreshold) || parsedThreshold <= 0) {
      return;
    }

    setMetrics((previous) =>
      previous.map((metric) =>
        metric.id === editingMetric.id
          ? {
              ...metric,
              threshold: parsedThreshold,
              status: metricStatus(metric.value, parsedThreshold, metric.unit),
            }
          : metric,
      ),
    );

    setEditingMetric(null);
  };

  const updateAlertStatus = (alertId: string, status: AlertStatus) => {
    setAlerts((previous) =>
      previous.map((alert) =>
        alert.id === alertId
          ? {
              ...alert,
              status,
              resolved: status === 'active' ? undefined : new Date(),
            }
          : alert,
      ),
    );
  };

  const exportSnapshot = () => {
    onPerformanceExport?.({ metrics, alerts });
  };

  return (
    <Box className={className}>
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center" justifyContent="space-between">
            <Box>
              <Typography variant="h6">Performance Monitoring</Typography>
              <Typography variant="body2" color="text.secondary">
                Live monitoring av vitals, tilgjengelighet og stabilitet.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Chip icon={<Analytics fontSize="small" />} label={`Score ${dashboardScore}`} color={dashboardScore >= 80 ? 'success' : dashboardScore >= 60 ? 'warning' : 'error'} />
              <Chip
                icon={<Notifications fontSize="small" />}
                label={`${activeAlerts.length} active alerts`}
                color={activeAlerts.length === 0 ? 'success' : 'warning'}
              />
              <Button startIcon={<FileDownload />} variant="outlined" onClick={exportSnapshot}>
                Export
              </Button>
            </Stack>
          </Stack>
          <LinearProgress variant="determinate" value={dashboardScore} sx={{ mt: 2 }} />
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Tabs value={tab} onChange={(_, value) => setTab(value)}>
            <Tab label="Metrics" />
            <Tab label="Alerts" />
            <Tab label="Settings" />
          </Tabs>

          <Divider sx={{ my: 2 }} />

          {tab === 0 && (
            <Grid container spacing={2}>
              {metrics.map((metric) => (
                <Grid item xs={12} md={6} key={metric.id}>
                  <Card variant="outlined">
                    <CardContent>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                        <Box>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                            {metric.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {metric.description}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {CATEGORY_LABELS[metric.category]}
                          </Typography>
                        </Box>
                        <IconButton size="small" onClick={() => openMetricEditor(metric)}>
                          <Edit fontSize="small" />
                        </IconButton>
                      </Stack>

                      <Stack direction="row" spacing={1} sx={{ mt: 1.25, mb: 1 }}>
                        <Chip label={formatMetricValue(metric.value, metric.unit)} size="small" color={statusColor(metric.status)} />
                        <Chip label={`Threshold ${formatMetricValue(metric.threshold, metric.unit)}`} size="small" variant="outlined" />
                        <Chip label={metric.trend} size="small" variant="outlined" />
                      </Stack>

                      <LinearProgress
                        variant="determinate"
                        value={
                          metric.unit === 'score' || metric.unit === 'percentage'
                            ? Math.max(0, Math.min(100, (metric.value / Math.max(metric.threshold, 1)) * 100))
                            : Math.max(0, Math.min(100, (Math.max(metric.threshold * 1.5 - metric.value, 0) / (metric.threshold * 1.5)) * 100))
                        }
                        color={statusColor(metric.status)}
                      />
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}

          {tab === 1 && (
            <List>
              {alerts.length === 0 ? (
                <Alert severity="success">Ingen varsler akkurat nå.</Alert>
              ) : (
                alerts.map((alert) => (
                  <ListItem key={alert.id} divider alignItems="flex-start">
                    <ListItemText
                      primary={alert.message}
                      secondary={`Severity: ${alert.severity} • Status: ${alert.status}`}
                    />
                    <ListItemSecondaryAction>
                      {alert.status === 'active' && (
                        <Stack direction="row" spacing={1}>
                          <Button size="small" startIcon={<CheckCircle />} onClick={() => updateAlertStatus(alert.id, 'resolved')}>
                            Resolve
                          </Button>
                          <Button size="small" startIcon={<ErrorOutline />} onClick={() => updateAlertStatus(alert.id, 'dismissed')}>
                            Dismiss
                          </Button>
                        </Stack>
                      )}
                    </ListItemSecondaryAction>
                  </ListItem>
                ))
              )}
            </List>
          )}

          {tab === 2 && (
            <Stack spacing={3}>
              <FormControlLabel
                control={
                  <Switch
                    checked={monitoringEnabled}
                    onChange={(event) => setMonitoringEnabled(event.target.checked)}
                  />
                }
                label="Enable live monitoring"
              />

              <Box>
                <Typography gutterBottom>Refresh interval (seconds)</Typography>
                <Slider
                  value={refreshIntervalSeconds}
                  min={5}
                  max={120}
                  step={5}
                  valueLabelDisplay="auto"
                  onChange={(_, value) => setRefreshIntervalSeconds(value as number)}
                />
              </Box>

              <Alert severity="info" icon={<WarningAmber />}>
                Kortere intervall gir raskere deteksjon, men høyere runtime-overhead.
              </Alert>
            </Stack>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(editingMetric)} onClose={() => setEditingMetric(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Edit metric threshold</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Threshold"
            type="number"
            value={thresholdDraft}
            onChange={(event) => setThresholdDraft(event.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingMetric(null)}>Cancel</Button>
          <Button variant="contained" onClick={saveMetricThreshold}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PerformanceMonitoring;
