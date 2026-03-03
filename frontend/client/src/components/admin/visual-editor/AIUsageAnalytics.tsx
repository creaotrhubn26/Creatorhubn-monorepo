/**
 * AI Code Completion Usage Analytics Dashboard
 * Tracks API usage, costs, performance metrics
 * Integrates with AIMetricsDashboard
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Stack,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  Divider,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  Psychology,
  Speed as Speed,
  AttachMoney,
  Timer,
  CheckCircle,
  Error as ErrorIcon,
  Refresh,
  Download,
  Close,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export interface UsageRecord {
  id: string;
  timestamp: number;
  provider: 'openai' | 'anthropic' | 'local';
  model: string;
  operation: 'completion' | 'generate' | 'refactor' | 'explain' | 'compare';
  tokensUsed: number;
  cost: number;
  responseTime: number;
  success: boolean;
  error?: string;
  confidence?: number;
}

export interface UsageStats {
  totalRequests: number;
  successRate: number;
  totalTokens: number;
  totalCost: number;
  avgResponseTime: number;
  byProvider: Record<string, number>;
  byModel: Record<string, number>;
  byOperation: Record<string, number>;
  costByProvider: Record<string, number>;
  dailyUsage: Array<{ date: string; requests: number; cost: number }>;
  hourlyDistribution: Array<{ hour: number; requests: number }>;
}

interface AIUsageAnalyticsProps {
  open: boolean;
  onClose: () => void;
  aiMetricsDashboardEnabled?: boolean;
}

type TimeRange = '24h' | '7d' | '30d' | '90d';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const parseTimeRange = (value: string): TimeRange => {
  switch (value) {
    case '24h':
    case '7d':
    case '30d':
    case '90d':
      return value;
    default:
      return '7d';
  }
};

const COLORS = ['#0088FE','#00C49F','#FFBB28','#FF8042','#8884D8'];

export default function AIUsageAnalytics({
  open,
  onClose,
  aiMetricsDashboardEnabled = true,
}: AIUsageAnalyticsProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [recentRequests, setRecentRequests] = useState<UsageRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [aiMetricsData, setAiMetricsData] = useState<Record<string, unknown> | null>(null);

  // Load usage data from localStorage and API
  const loadUsageData = useCallback(async () => {
    setIsLoading(true);

    try {
      // Load from server KV first, fallback to localStorage
      let records: UsageRecord[] = [];
      try {
        const r = await fetch('/api/user/kv/ai_usage_records', { credentials: 'include' });
        const j = r.ok ? await r.json().catch(() => null) : null;
        const v = j && typeof j === 'object' && 'value' in j ? j.value : j;
        if (Array.isArray(v)) {
          records = v as UsageRecord[];
        } else {
          const stored = localStorage.getItem('ai_usage_records');
          records = stored ? JSON.parse(stored) : [];
        }
      } catch {
        const stored = localStorage.getItem('ai_usage_records');
        records = stored ? JSON.parse(stored) : [];
      }

      // Filter by time range
      const now = Date.now();
      const rangeMs = {
        '24h': 24 * 60 * 60 * 1000, '7d': 7 * 24 * 60 * 60 * 1000, '30d': 30 * 24 * 60 * 60 * 1000, '90d': 90 * 24 * 60 * 60 * 1000,
      }[timeRange];

      const filtered = records.filter((r) => now - r.timestamp < rangeMs);

      // Calculate stats
      const calculatedStats = calculateStats(filtered);
      setStats(calculatedStats);
      setRecentRequests(filtered.slice(0, 50));

      // Load AI metrics dashboard data if enabled
      if (aiMetricsDashboardEnabled) {
        try {
          const response = await fetch(
            `/api/ai/learning/metrics/code_completion?timeRange=${timeRange}`,
          );
          if (response.ok) {
            const data: unknown = await response.json();
            setAiMetricsData(isRecord(data) ? data : null);
          }
        } catch (error) {
          console.warn('Could not load AI metrics data: ', error);
        }
      }
    } catch (error) {
      console.error('Error loading usage data: ', error);
    } finally {
      setIsLoading(false);
    }
  }, [timeRange, aiMetricsDashboardEnabled]);

  useEffect(() => {
    if (open) {
      loadUsageData();
    }
  }, [open, loadUsageData]);

  const calculateStats = (records: UsageRecord[]): UsageStats => {
    const successfulRequests = records.filter((r) => r.success);

    const byProvider: Record<string, number> = {};
    const byModel: Record<string, number> = {};
    const byOperation: Record<string, number> = {};
    const costByProvider: Record<string, number> = {};

    records.forEach((r) => {
      byProvider[r.provider] = (byProvider[r.provider] || 0) + 1;
      byModel[r.model] = (byModel[r.model] || 0) + 1;
      byOperation[r.operation] = (byOperation[r.operation] || 0) + 1;
      costByProvider[r.provider] = (costByProvider[r.provider] || 0) + r.cost;
    });

    // Daily usage aggregation
    const dailyMap = new Map<string, { requests: number; cost: number }>();
    records.forEach((r) => {
      const date = new Date(r.timestamp).toISOString().split('T')[0];
      const existing = dailyMap.get(date) || { requests: 0, cost: 0 };
      dailyMap.set(date, {
        requests: existing.requests + 1,
        cost: existing.cost + r.cost,
      });
    });

    const dailyUsage = Array.from(dailyMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Hourly distribution
    const hourlyMap = new Map<number, number>();
    records.forEach((r) => {
      const hour = new Date(r.timestamp).getHours();
      hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + 1);
    });

    const hourlyDistribution = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      requests: hourlyMap.get(hour) || 0,
    }));

    return {
      totalRequests: records.length,
      successRate: records.length > 0 ? successfulRequests.length / records.length : 0,
      totalTokens: records.reduce((sum, r) => sum + r.tokensUsed, 0),
      totalCost: records.reduce((sum, r) => sum + r.cost, 0),
      avgResponseTime: records.length > 0
          ? records.reduce((sum, r) => sum + r.responseTime, 0) / records.length
          : 0,
      byProvider,
      byModel,
      byOperation,
      costByProvider,
      dailyUsage,
      hourlyDistribution,
    };
  };

  const handleExport = useCallback(() => {
    const data = {
      stats,
      recentRequests,
      exportedAt: new Date().toISOString(),
      timeRange,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-usage-analytics-${timeRange}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [stats, recentRequests, timeRange]);

  if (!open) return null;

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'fixed',
        top: 80,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '90vw',
        maxWidth: 1600,
        maxHeight: 'calc(100vh - 100px)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 150,
        borderRadius: 2,
        overflow: 'hidden'}}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2,
          bgcolor: 'primary.main',
          color: 'white'}}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Psychology />
          <Typography variant="h6" fontWeight={600}>
            AI Code Completion Analytics
          </Typography>
          <Chip
            label={timeRange.toUpperCase()}
            size="small"
            sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }} />
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <Select
              value={timeRange}
              onChange={(e) => setTimeRange(parseTimeRange(e.target.value))}
              sx={{
                color: 'white', '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' }}}
            >
              <MenuItem value="24h">Last 24h</MenuItem>
              <MenuItem value="7d">Last 7 Days</MenuItem>
              <MenuItem value="30d">Last 30 Days</MenuItem>
              <MenuItem value="90d">Last 90 Days</MenuItem>
            </Select>
          </FormControl>
          <Tooltip title="Refresh">
            <IconButton size="small" onClick={loadUsageData} sx={{ color: 'white' }}>
              <Refresh />
            </IconButton>
          </Tooltip>
          <Tooltip title="Export Data">
            <IconButton size="small" onClick={handleExport} sx={{ color: 'white' }}>
              <Download />
            </IconButton>
          </Tooltip>
          <IconButton size="small" onClick={onClose} sx={{ color: 'white' }}>
            <Close />
          </IconButton>
        </Box>
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
        {isLoading ? (
          <Box sx={{ py: 8, textAlign: 'center' }}>
            <LinearProgress sx={{ mb: 2 }} />
            <Typography color="text.secondary">Loading analytics...</Typography>
          </Box>
        ) : stats ? (
          <Stack spacing={3}>
            {/* AI Metrics Dashboard Integration */}
            {Boolean(aiMetricsData) && (
              <Alert severity="info" icon={<Psychology />}>
                <strong>Connected to AI Learning Hub:</strong> Data is being synced with the main AI
                Metrics Dashboard for cross-platform learning insights.
              </Alert>
            )}

            {/* Key Metrics */}
            <Grid container spacing={2}>
              <Grid item xs={12} md={3}>
                <MetricCard
                  icon={<Psychology />}
                  title="Total Requests"
                  value={stats.totalRequests.toLocaleString()}
                  color="primary"
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <MetricCard
                  icon={<CheckCircle />}
                  title="Success Rate"
                  value={`${(stats.successRate * 100).toFixed(1)}%`}
                  color="success"
                  trend={
                    stats.successRate > 0.9 ? 'up' : stats.successRate < 0.7 ? 'down' : undefined
                  }
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <MetricCard
                  icon={<AttachMoney />}
                  title="Total Cost"
                  value={`$${stats.totalCost.toFixed(2)}`}
                  color="warning"
                  subtitle={`~$${(stats.totalCost / Math.max(1, Math.ceil((Date.now() - (recentRequests[recentRequests.length - 1]?.timestamp || Date.now())) / (24 * 60 * 60 * 1000)))).toFixed(2)}/day`}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <MetricCard
                  icon={<Speed />}
                  title="Avg Response Time"
                  value={`${(stats.avgResponseTime / 1000).toFixed(2)}s`}
                  color="info"
                  trend={stats.avgResponseTime < 2000 ? 'up' : 'down'}
                />
              </Grid>
            </Grid>

            {/* Charts Row 1 */}
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Usage by Provider
                    </Typography>
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={Object.entries(stats.byProvider).map(([name, value]) => ({
                            name,
                            value,
                          }))}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={(entry) => `${entry.name}: ${entry.value}`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {Object.keys(stats.byProvider).map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Operations Distribution
                    </Typography>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart
                        data={Object.entries(stats.byOperation).map(([name, value]) => ({
                          name,
                          value,
                        }))}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <RechartsTooltip />
                        <Bar dataKey="value" fill="#8884d8" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Charts Row 2 */}
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Daily Usage & Cost Trend
                    </Typography>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={stats.dailyUsage}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" />
                        <RechartsTooltip />
                        <Legend />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="requests"
                          stroke="#8884d8"
                          name="Requests"
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="cost"
                          stroke="#82ca9d"
                          name="Cost ($)"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Cost Breakdown */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Cost by Provider
                </Typography>
                <Grid container spacing={2}>
                  {Object.entries(stats.costByProvider).map(([provider, cost]) => (
                    <Grid item xs={12} md={4} key={provider}>
                      <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                        <Typography variant="subtitle2" color="text.secondary">
                          {provider.toUpperCase()}
                        </Typography>
                        <Typography variant="h5" color="warning.main">
                          ${cost.toFixed(3)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {stats.byProvider[provider]} requests
                        </Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>

            {/* Recent Requests Table */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Recent Requests
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Time</TableCell>
                        <TableCell>Provider</TableCell>
                        <TableCell>Model</TableCell>
                        <TableCell>Operation</TableCell>
                        <TableCell align="right">Tokens</TableCell>
                        <TableCell align="right">Cost</TableCell>
                        <TableCell align="right">Time (ms)</TableCell>
                        <TableCell align="center">Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {recentRequests.slice(0, 20).map((record) => (
                        <TableRow key={record.id}>
                          <TableCell>
                            <Typography variant="caption">
                              {new Date(record.timestamp).toLocaleTimeString()}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip label={record.provider} size="small" />
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption">{record.model}</Typography>
                          </TableCell>
                          <TableCell>
                            <Chip label={record.operation} size="small" variant="outlined" />
                          </TableCell>
                          <TableCell align="right">{record.tokensUsed.toLocaleString()}</TableCell>
                          <TableCell align="right">${record.cost.toFixed(4)}</TableCell>
                          <TableCell align="right">{record.responseTime}</TableCell>
                          <TableCell align="center">
                            {record.success ? (
                              <CheckCircle fontSize="small" color="success" />
                            ) : (
                              <Tooltip title={record.error || 'Failed'}>
                                <ErrorIcon fontSize="small" color="error" />
                              </Tooltip>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Stack>
        ) : (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Psychology sx={{ fontSize: 80, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No Usage Data Yet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Start using AI code completion to see analytics here
            </Typography>
          </Box>
        )}
      </Box>
    </Paper>
  );
}

interface MetricCardProps {
  icon: React.ReactNode;
  title: string;
  value: string;
  color?: 'primary' | 'success' | 'warning' | 'info' | 'error';
  trend?: 'up' | 'down';
  subtitle?: string;
}

function MetricCard({ icon, title, value, color = 'primary', trend, subtitle }: MetricCardProps) {
  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Box sx={{ color: `${color}.main` }}>{icon}</Box>
          {trend &&
            (trend === 'up' ? <TrendingUp color="success" /> : <TrendingDown color="error" />)}
        </Box>
        <Typography variant="caption" color="text.secondary" display="block">
          {title}
        </Typography>
        <Typography variant="h4" color={`${color}.main`} fontWeight={600}>
          {value}
        </Typography>
        {subtitle && (
          <Typography variant="caption" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

// Helper function to track usage (export for use in AICodeCompletionSystem)
export function trackAIUsage(record: Omit<UsageRecord, 'id' | 'timestamp'>) {
  const fullRecord: UsageRecord = {
    id: `usage-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    ...record,
  };

  try {
    const stored = localStorage.getItem('ai_usage_records');
    const records: UsageRecord[] = stored ? JSON.parse(stored) : [];
    records.unshift(fullRecord);

    // Keep only last 1000 records
    const trimmed = records.slice(0, 1000);
    // Mirror to server KV
    fetch('/api/user/kv', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ key: 'ai_usage_records', value: trimmed })
    }).catch((err: unknown) => console.error('Operation failed:', err));
    localStorage.setItem('ai_usage_records', JSON.stringify(trimmed));

    // Also send to AI Metrics Dashboard if available
    fetch('/api/ai/learning/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service: 'code_completion',
        event:'ai_usage',
        data: fullRecord,
      }),
    }).catch(() => {
      // Silently fail if endpoint doesn't exist
    });
  } catch (error) {
    console.error('Failed to track AI usage:', error);
  }
}
