import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  LinearProgress,
} from '@mui/material';
import {
  Speed as SpeedIcon,
  Error as ErrorIcon,
  CheckCircle as SuccessIcon,
} from '@mui/icons-material';
import { harRecorder } from '../../utils/harRecorder';
import { useWireMockTestHistory } from '../../hooks/useWireMockTestHistory';
import {
  aggregateAnalytics,
  formatBytes,
  type WireMockTestResult as AnalyticsWireMockTestResult,
} from '../../utils/wireMockAnalytics';
import { AdminCard, AdminEmpty, AdminTableContainer } from './design-system';

interface EndpointStats {
  endpoint: string;
  method: string;
  hitCount: number;
  successCount: number;
  errorCount: number;
  avgResponseTime: number;
  totalSize: number;
  errorRate: number;
}

export const WireMockBehaviorAnalytics: React.FC = () => {
  // Use test history hook for comprehensive analytics
  const { history } = useWireMockTestHistory();

  const [endpointStats, setEndpointStats] = useState<EndpointStats[]>([]);
  const [globalStats, setGlobalStats] = useState({
    totalRequests: 0,
    totalErrors: 0,
    avgResponseTime: 0,
    totalDataTransferred: 0
  });

  useEffect(() => {
    const updateStats = () => {
      const normalizedHistory: AnalyticsWireMockTestResult[] = history.map((result) => ({
        apiName: result.apiName,
        success: result.status === 'success',
        responseTime: result.responseTime ?? 0,
        statusCode: result.statusCode ?? (result.status === 'success' ? 200 : 500),
        timestamp: result.timestamp.toISOString(),
        requestDetails: {
          method: result.method,
          endpoint: result.endpoint,
          headers: result.request?.headers,
          body: result.request?.body,
        },
        responseDetails: {
          body: result.response?.body ?? {},
          headers: result.response?.headers ?? {},
        },
        error: result.error?.message,
      }));

      // Aggregate analytics from test history (Gap 6 fix)
      const analytics = aggregateAnalytics(normalizedHistory);

      // Convert to EndpointStats format for display
      const stats: EndpointStats[] = analytics.endpoints.map(endpoint => ({
        endpoint: endpoint.name,
        method: 'POST', // Most WireMock tests use POST
        hitCount: endpoint.hitCount,
        successCount: endpoint.successCount,
        errorCount: endpoint.errorCount,
        avgResponseTime: endpoint.avgResponseTime,
        totalSize: endpoint.totalDataTransferred,
        errorRate: endpoint.errorRate
      }));

      setEndpointStats(stats);
      setGlobalStats({
        totalRequests: analytics.totalTests,
        totalErrors: analytics.totalErrors,
        avgResponseTime: analytics.avgResponseTime,
        totalDataTransferred: analytics.totalDataTransferred
      });
    };

    updateStats();
    const interval = setInterval(updateStats, 3000);
    return () => clearInterval(interval);
  }, [history]); // Re-run when test history changes

  const formatSize = (bytes: number): string => {
    return formatBytes(bytes); // Use utility function
  };

  const formatTime = (ms: number): string => {
    return `${ms.toFixed(0)} ms`;
  };

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET': return 'primary';
      case 'POST': return 'success';
      case 'PUT': return 'warning';
      case 'DELETE': return 'error';
      default: return 'default';
    }
  };

  return (
    <AdminCard title="📊 WireMock Behavior Analytics">
        {/* Global Statistics */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={6} sm={3}>
            <Box sx={{ p: 2, bgcolor: 'primary.light', borderRadius: 1, textAlign: 'center' }}>
              <Typography variant="h4" color="primary.contrastText">
                {globalStats.totalRequests}
              </Typography>
              <Typography variant="caption" color="primary.contrastText">
                Total Requests
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Box sx={{ p: 2, bgcolor: 'error.light', borderRadius: 1, textAlign: 'center' }}>
              <Typography variant="h4" color="error.contrastText">
                {globalStats.totalErrors}
              </Typography>
              <Typography variant="caption" color="error.contrastText">
                Total Errors
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Box sx={{ p: 2, bgcolor: 'info.light', borderRadius: 1, textAlign: 'center' }}>
              <Typography variant="h4" color="info.contrastText">
                {formatTime(globalStats.avgResponseTime)}
              </Typography>
              <Typography variant="caption" color="info.contrastText">
                Avg Response Time
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Box sx={{ p: 2, bgcolor: 'success.light', borderRadius: 1, textAlign: 'center' }}>
              <Typography variant="h4" color="success.contrastText">
                {formatSize(globalStats.totalDataTransferred)}
              </Typography>
              <Typography variant="caption" color="success.contrastText">
                Data Transferred
              </Typography>
            </Box>
          </Grid>
        </Grid>

        {/* Per-Endpoint Statistics */}
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          Endpoint Performance
        </Typography>

        {endpointStats.length === 0 ? (
          <AdminEmpty description="No data yet. Run WireMock tests to see analytics." />
        ) : (
          <AdminTableContainer ariaLabel="Endpoint performance" sx={{ maxHeight: 400 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Method</TableCell>
                  <TableCell>Endpoint</TableCell>
                  <TableCell align="right">Hits</TableCell>
                  <TableCell align="right">Success</TableCell>
                  <TableCell align="right">Errors</TableCell>
                  <TableCell align="right">Error Rate</TableCell>
                  <TableCell align="right">Avg Time</TableCell>
                  <TableCell align="right">Total Size</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {endpointStats.map((stat, index) => (
                  <TableRow key={index} hover>
                    <TableCell>
                      <Chip
                        label={stat.method}
                        size="small"
                        color={getMethodColor(stat.method) as any}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 300 }}>
                        {stat.endpoint}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight={600}>
                        {stat.hitCount}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Box display="flex" alignItems="center" justifyContent="flex-end" gap={0.5}>
                        <SuccessIcon fontSize="small" color="success" />
                        <Typography variant="body2">{stat.successCount}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Box display="flex" alignItems="center" justifyContent="flex-end" gap={0.5}>
                        <ErrorIcon fontSize="small" color="error" />
                        <Typography variant="body2">{stat.errorCount}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ minWidth: 100 }}>
                        <Box display="flex" alignItems="center" gap={1}>
                          <LinearProgress
                            variant="determinate"
                            value={stat.errorRate}
                            sx={{
                              flex: 1,
                              height: 6,
                              borderRadius: 1,
                              bgcolor: 'grey.200','& .MuiLinearProgress-bar': {
                                bgcolor: stat.errorRate > 50 ? 'error.main' : stat.errorRate > 20 ? 'warning.main' : 'success.main'
                              }
                            }}
                          />
                          <Typography variant="caption">
                            {stat.errorRate.toFixed(1)}%
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Box display="flex" alignItems="center" justifyContent="flex-end" gap={0.5}>
                        <SpeedIcon fontSize="small" color="action" />
                        <Typography variant="body2">{formatTime(stat.avgResponseTime)}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2">{formatSize(stat.totalSize)}</Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </AdminTableContainer>
        )}
    </AdminCard>
  );
};
