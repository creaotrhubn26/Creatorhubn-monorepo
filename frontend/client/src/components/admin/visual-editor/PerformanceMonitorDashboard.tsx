/**
 * Performance Monitor Dashboard
 * Real-time animation performance monitoring and optimization
 */

import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  LinearProgress,
  Chip,
  Alert,
  AlertTitle,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import {
  Speed as Speed,
  Memory,
  Warning,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Remove as TrendingFlat,
} from '@mui/icons-material';
import { useAnimationPerformance } from '../../../hooks/useAnimationPerformance';
import { useTheming } from '../../../utils/theming-helper';

export const PerformanceMonitorDashboard: React.FC = () => {
  const theming = useTheming('prototype_tester');
  const { 
    metrics, 
    getOptimizationRecommendations, 
    getPerformanceStatus,
    isPerformanceGood,
    hasGPUAcceleration 
  } = useAnimationPerformance();

  const performanceStatus = getPerformanceStatus();
  const recommendations = getOptimizationRecommendations();

  const getStatusColor = (status: string): 'success' | 'info' | 'warning' | 'error' => {
    switch (status) {
      case 'excellent': return 'success';
      case 'good': return 'info';
      case 'fair': return 'warning';
      default: return 'error';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'excellent': return <TrendingUp color="success" />;
      case 'good': return <TrendingFlat color="info" />;
      case 'fair': return <Warning color="warning" />;
      default: return <TrendingDown color="error" />;
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <Speed sx={{ fontSize: 32, color: theming.colors.primary }} />
        <Typography variant="h4" fontWeight="bold" sx={{ color: theming.colors.primary }}>
          Animation Performance Monitor
        </Typography>
        <Chip 
          label={performanceStatus.toUpperCase()} 
          color={getStatusColor(performanceStatus)}
          icon={getStatusIcon(performanceStatus)}
        />
      </Box>

      {/* Performance Metrics */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <Speed color="primary" />
                <Typography variant="subtitle2">FPS</Typography>
              </Box>
              <Typography variant="h4" fontWeight="bold" color={metrics.fps >= 55 ? 'success.main' : 'warning.main'}>
                {metrics.fps}
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={(metrics.fps / 60) * 100}
                color={metrics.fps >= 55 ? 'success' : 'warning'}
                sx={{ mt: 2 }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Target: 60 FPS
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <Warning color="warning" />
                <Typography variant="subtitle2">Frame Drops</Typography>
              </Box>
              <Typography variant="h4" fontWeight="bold" color={metrics.frameDrops > 5 ? 'error.main' : 'success.main'}>
                {metrics.frameDrops}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Last 60 frames
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <Memory color="info" />
                <Typography variant="subtitle2">Memory Usage</Typography>
              </Box>
              <Typography variant="h4" fontWeight="bold" color={metrics.memoryUsage > 80 ? 'warning.main' : 'primary.main'}>
                {metrics.memoryUsage}%
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={metrics.memoryUsage}
                color={metrics.memoryUsage > 80 ? 'warning' : 'primary'}
                sx={{ mt: 2 }}
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <TrendingFlat color="secondary" />
                <Typography variant="subtitle2">Jank Score</Typography>
              </Box>
              <Typography variant="h4" fontWeight="bold" color={metrics.jankScore < 20 ? 'success.main' : 'warning.main'}>
                {metrics.jankScore}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Lower is better (target: &lt; 20)
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* GPU Acceleration Status */}
      <Paper sx={{ ...theming.getThemedCardSx(), p: 3, mb: 3 }}>
        <Box display="flex" alignItems="center" gap={2} mb={2}>
          {hasGPUAcceleration ? (
            <CheckCircle color="success" />
          ) : (
            <Warning color="warning" />
          )}
          <Typography variant="h6" fontWeight="bold">
            GPU Acceleration
          </Typography>
          <Chip 
            label={hasGPUAcceleration ? 'Enabled' : 'Disabled'} 
            color={hasGPUAcceleration ? 'success' : 'warning'}
            size="small"
          />
        </Box>
        <Typography variant="body2" color="text.secondary">
          {hasGPUAcceleration 
            ? 'Animations are GPU-accelerated using CSS transforms for optimal performance'
            : 'GPU acceleration not detected. Ensure you use CSS transforms for animations.'
          }
        </Typography>
        {!hasGPUAcceleration && (
          <Alert severity="info" sx={{ mt: 2 }}>
            <AlertTitle>Optimization Tip</AlertTitle>
            Use CSS properties like <code>transform</code> and <code>opacity</code> instead of 
            <code>left/top/width/height</code> for GPU-accelerated animations.
          </Alert>
        )}
      </Paper>

      {/* Batching Status */}
      <Paper sx={{ ...theming.getThemedCardSx(), p: 3, mb: 3 }}>
        <Typography variant="h6" fontWeight="bold" gutterBottom>
          Operation Batching
        </Typography>
        <Box display="flex" alignItems="baseline" gap={2}>
          <Typography variant="h4" fontWeight="bold" color="primary">
            {metrics.batchedOperations}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            operations batched for efficiency
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          DOM operations are automatically batched using <code>requestAnimationFrame</code> to minimize 
          layout thrashing and improve performance.
        </Typography>
      </Paper>

      {/* Optimization Recommendations */}
      <Paper sx={{ ...theming.getThemedCardSx(), p: 3 }}>
        <Typography variant="h6" fontWeight="bold" gutterBottom>
          Optimization Recommendations
        </Typography>
        
        {!isPerformanceGood && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <AlertTitle>Performance Issues Detected</AlertTitle>
            Current FPS: {metrics.fps} (target: 60 FPS)
          </Alert>
        )}

        <List>
          {recommendations.map((recommendation, index) => (
            <ListItem key={index}>
              <ListItemIcon>
                {recommendation.includes('✓') ? (
                  <CheckCircle color="success" />
                ) : (
                  <Warning color="warning" />
                )}
              </ListItemIcon>
              <ListItemText
                primary={recommendation}
                primaryTypographyProps={{
                  variant: 'body2'
                }}
              />
            </ListItem>
          ))}
        </List>
      </Paper>

      {/* Best Practices */}
      <Alert severity="info" sx={{ mt: 3 }}>
        <AlertTitle>Performance Best Practices</AlertTitle>
        <Typography variant="body2" component="div">
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>Use CSS <code>transform</code> and <code>opacity</code> for GPU acceleration</li>
            <li>Keep animation durations under 500ms for interactions</li>
            <li>Batch multiple DOM operations using requestAnimationFrame</li>
            <li>Limit concurrent animations to 5-10 for optimal performance</li>
            <li>Use <code>will-change</code> sparingly and clean up after animations</li>
            <li>Respect user's <code>prefers-reduced-motion</code> preference</li>
          </ul>
        </Typography>
      </Alert>
    </Box>
  );
};

export default PerformanceMonitorDashboard;














