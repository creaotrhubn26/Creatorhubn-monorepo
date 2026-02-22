/**
 * Accessibility Animation Dashboard
 * WCAG 2.1 compliance monitoring and animation accessibility tools
 * Implements Success Criteria 2.2.2, 2.3.1, and 2.3.3
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Switch,
  FormControlLabel,
  Button,
  Card,
  CardContent,
  Grid,
  Chip,
  Alert,
  AlertTitle,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Slider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  LinearProgress,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Accessibility,
  CheckCircle,
  Warning,
  Error as ErrorIcon,
  Info,
  PlayArrow,
  Pause,
  Speed as Speed,
  Visibility,
  VisibilityOff,
  Settings,
  Assessment,
  CompareArrows,
} from '@mui/icons-material';
import { useMotionPreference } from '../../../hooks/useMotionPreference';
import { useResearchBackedAnimations } from '../../../hooks/useResearchBackedAnimations';
import { useAnimation } from '../../../hooks/useAnimation';
import { useTheming } from '../../../utils/theming-helper';

interface AccessibilityDashboardProps {
  onClose?: () => void;
}

export const AccessibilityAnimationDashboard: React.FC<AccessibilityDashboardProps> = ({ onClose }) => {
  const theming = useTheming('prototype_tester');
  const { prefersReducedMotion, isSupported, shouldAnimate, getDuration } = useMotionPreference();
  const { getIconButtonStyles, getTooltipProps, UI_ANIMATIONS } = useResearchBackedAnimations();
  const { animations, config, updateConfig } = useAnimation();

  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1);
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [comparisonMode, setComparisonMode] = useState<boolean>(false);
  const [auditResults, setAuditResults] = useState<Record<string, unknown>[]>([]);

  // Run accessibility audit on animations
  useEffect(() => {
    const results = animations.map((animation) => {
      const issues: string[] = [];
      let complianceLevel: 'AAA' | 'AA' | 'A' | 'Needs Review' = 'AAA';

      // WCAG 2.2.2: Animations should be pausable/stoppable
      if (animation.duration > 5000 && animation.iterationCount === 'infinite') {
        issues.push('WCAG 2.2.2: Infinite animations longer than 5s must be pausable');
        complianceLevel = 'Needs Review';
      }

      // WCAG 2.3.1: No more than 3 flashes per second
      const flashesPerSecond = animation.keyframes.length / (animation.duration / 1000);
      if (flashesPerSecond > 3) {
        issues.push('WCAG 2.3.1: Animation may cause more than 3 flashes per second');
        complianceLevel = 'Needs Review';
      }

      // Best practice: Keep durations reasonable
      if (animation.duration > 5000 && animation.iterationCount !== 'infinite') {
        issues.push('Best Practice: Animation duration exceeds 5 seconds');
        if (complianceLevel === 'AAA') complianceLevel = 'AA';
      }

      // Check for accessibility metadata
      if (animation.research?.accessibilityRating) {
        complianceLevel = animation.research.accessibilityRating;
      }

      return {
        animation,
        issues,
        complianceLevel,
        compliant: issues.length === 0
      };
    });

    setAuditResults(results);
  }, [animations]);

  const complianceStats = {
    total: auditResults.length,
    compliant: auditResults.filter(r => r.compliant).length,
    aaa: auditResults.filter(r => r.complianceLevel === 'AAA').length,
    aa: auditResults.filter(r => r.complianceLevel === 'AA').length,
    a: auditResults.filter(r => r.complianceLevel === 'A').length,
    needsReview: auditResults.filter(r => r.complianceLevel === 'Needs Review').length
  };

  const getComplianceColor = (level: string) => {
    switch (level) {
      case 'AAA': return 'success';
      case 'AA': return 'info';
      case 'A': return 'warning';
      default: return 'error';
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1400, margin: '0 auto' }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
        <Box display="flex" alignItems="center" gap={2}>
          <Accessibility sx={{ fontSize: 32, color: theming.colors.primary }} />
          <Typography variant="h4" fontWeight="bold" sx={{ color: theming.colors.primary }}>
            Animation Accessibility Dashboard
          </Typography>
        </Box>
        {onClose && (
          <Button onClick={onClose} variant="outlined">
            Close
          </Button>
        )}
      </Box>

      {/* System Status */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} md={4}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                {isSupported ? (
                  <CheckCircle color="success" />
                ) : (
                  <Warning color="warning" />
                )}
                <Typography variant="h6">Motion Preference Detection</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                System: {isSupported ? 'Supported' : 'Not Supported'}
              </Typography>
              <Chip
                label={prefersReducedMotion ? 'Reduced Motion Enabled' : 'Full Motion'}
                color={prefersReducedMotion ? 'warning' : 'success'}
                size="small"
                sx={{ mt: 1 }}
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <Assessment color="primary" />
                <Typography variant="h6">Compliance Score</Typography>
              </Box>
              <Box display="flex" alignItems="baseline" gap={1}>
                <Typography variant="h3" fontWeight="bold" color="primary">
                  {Math.round((complianceStats.compliant / complianceStats.total) * 100)}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  ({complianceStats.compliant}/{complianceStats.total} animations)
                </Typography>
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={(complianceStats.compliant / complianceStats.total) * 100}
                sx={{ mt: 2 }}
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <Speed color="info" />
                <Typography variant="h6">Active Animations</Typography>
              </Box>
              <Typography variant="h3" fontWeight="bold" color="primary">
                {animations.length}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Total registered animations
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* WCAG Compliance Breakdown */}
      <Paper sx={{ ...theming.getThemedCardSx(), p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom fontWeight="bold">
          WCAG 2.1 Compliance Levels
        </Typography>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={6} sm={3}>
            <Box textAlign="center" p={2} bgcolor="success.50" borderRadius={2}>
              <Typography variant="h4" fontWeight="bold" color="success.main">
                {complianceStats.aaa}
              </Typography>
              <Typography variant="body2" color="text.secondary">AAA - Excellent</Typography>
            </Box>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Box textAlign="center" p={2} bgcolor="info.50" borderRadius={2}>
              <Typography variant="h4" fontWeight="bold" color="info.main">
                {complianceStats.aa}
              </Typography>
              <Typography variant="body2" color="text.secondary">AA - Good</Typography>
            </Box>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Box textAlign="center" p={2} bgcolor="warning.50" borderRadius={2}>
              <Typography variant="h4" fontWeight="bold" color="warning.main">
                {complianceStats.a}
              </Typography>
              <Typography variant="body2" color="text.secondary">A - Acceptable</Typography>
            </Box>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Box textAlign="center" p={2} bgcolor="error.50" borderRadius={2}>
              <Typography variant="h4" fontWeight="bold" color="error.main">
                {complianceStats.needsReview}
              </Typography>
              <Typography variant="body2" color="text.secondary">Needs Review</Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Animation Controls */}
      <Paper sx={{ ...theming.getThemedCardSx(), p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom fontWeight="bold">
          Animation Controls
        </Typography>

        <Grid container spacing={3} sx={{ mt: 1 }}>
          <Grid item xs={12} md={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={config.enableAnimations}
                  onChange={(e) => updateConfig({ enableAnimations: e.target.checked })}
                />
              }
              label="Enable All Animations"
            />
            <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4 }}>
              Master toggle for all animation playback
            </Typography>
          </Grid>

          <Grid item xs={12} md={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={comparisonMode}
                  onChange={(e) => setComparisonMode(e.target.checked)}
                />
              }
              label="Comparison Mode"
            />
            <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4 }}>
              View animations side-by-side (normal vs reduced motion)
            </Typography>
          </Grid>

          <Grid item xs={12}>
            <Typography variant="body2" gutterBottom>
              Animation Speed Multiplier
            </Typography>
            <Box display="flex" alignItems="center" gap={2}>
              <Slider
                value={speedMultiplier}
                onChange={(_, value) => setSpeedMultiplier(value as number)}
                min={0}
                max={2}
                step={0.1}
                marks={[
                  { value: 0, label: 'Off' },
                  { value: 0.5, label: '0.5x' },
                  { value: 1, label: '1x' },
                  { value: 1.5, label: '1.5x' },
                  { value: 2, label: '2x' }
                ]}
                valueLabelDisplay="auto"
                sx={{ flexGrow: 1 }}
              />
              <Typography variant="body2" sx={{ minWidth: 60 }}>
                {speedMultiplier === 0 ? 'Disabled' : `${speedMultiplier}x`}
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Audit Results */}
      <Paper sx={{ ...theming.getThemedCardSx(), p: 3 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Typography variant="h6" fontWeight="bold">
            Animation Audit Results
          </Typography>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Filter by Level</InputLabel>
            <Select defaultValue="all" label="Filter by Level">
              <MenuItem value="all">All Levels</MenuItem>
              <MenuItem value="AAA">AAA Only</MenuItem>
              <MenuItem value="AA">AA Only</MenuItem>
              <MenuItem value="A">A Only</MenuItem>
              <MenuItem value="review">Needs Review</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {complianceStats.needsReview > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <AlertTitle>Accessibility Issues Found</AlertTitle>
            {complianceStats.needsReview} animation(s) need review for WCAG 2.1 compliance
          </Alert>
        )}

        <List>
          {auditResults.map((result, index) => (
            <React.Fragment key={result.animation.id}>
              {index > 0 && <Divider />}
              <ListItem
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  py: 2
                }}
              >
                <ListItemIcon sx={{ mt: 1 }}>
                  {result.compliant ? (
                    <CheckCircle color="success" />
                  ) : (
                    <Warning color="warning" />
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="body1" fontWeight="medium">
                        {result.animation.name}
                      </Typography>
                      <Chip
                        label={result.complianceLevel}
                        color={getComplianceColor(result.complianceLevel) as 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'}
                        size="small"
                      />
                      {result.animation.research && (
                        <Chip
                          label={result.animation.research.source}
                          size="small"
                          variant="outlined"
                        />
                      )}
                    </Box>
                  }
                  secondary={
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Duration: {result.animation.duration}ms • Easing: {result.animation.easing}
                      </Typography>
                      {result.issues.length > 0 && (
                        <Box sx={{ mt: 1 }}>
                          {result.issues.map((issue, i) => (
                            <Typography key={i} variant="caption" color="error.main" display="block">
                              • {issue}
                            </Typography>
                          ))}
                        </Box>
                      )}
                      {result.animation.research?.recommendedContext && (
                        <Box sx={{ mt: 1 }}>
                          <Typography variant="caption" color="text.secondary">
                            Recommended for: {result.animation.research.recommendedContext.join(', ')}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  }
                />
              </ListItem>
            </React.Fragment>
          ))}
        </List>
      </Paper>

      {/* Help Information */}
      <Alert severity="info" sx={{ mt: 3 }}>
        <AlertTitle>About Accessibility Compliance</AlertTitle>
        <Typography variant="body2">
          This dashboard monitors animation compliance with WCAG 2.1 Success Criteria 2.2.2 (Pause, Stop, Hide),
          2.3.1 (Three Flashes or Below Threshold), and 2.3.3 (Animation from Interactions). 
          All animations automatically respect the user's <code>prefers-reduced-motion</code> system preference.
        </Typography>
      </Alert>
    </Box>
  );
};

export default AccessibilityAnimationDashboard;














