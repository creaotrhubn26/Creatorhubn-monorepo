/**
 * Accessibility Animation Dashboard
 * WCAG 2.1 compliance monitoring and animation accessibility tools
 * Implements Success Criteria 2.2.2, 2.3.1, and 2.3.3
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Slider,
  Switch,
  Tooltip,
  Typography,
  type ChipProps,
  type SelectChangeEvent,
} from '@mui/material';
import {
  Accessibility,
  Assessment,
  CheckCircle,
  CompareArrows,
  Pause,
  PlayArrow,
  Settings,
  Speed as SpeedIcon,
  Visibility,
  VisibilityOff,
  Warning,
} from '@mui/icons-material';
import { useAnimation, type UseAnimationReturn } from '../../../hooks/useAnimation';
import { useMotionPreference } from '../../../hooks/useMotionPreference';
import { useResearchBackedAnimations } from '../../../hooks/useResearchBackedAnimations';
import { useTheming } from '../../../utils/theming-helper';

interface AccessibilityDashboardProps {
  onClose?: () => void;
}

type ComplianceLevel = 'AAA' | 'AA' | 'A' | 'Needs Review';
type FilterLevel = 'all' | ComplianceLevel;
type AnimationItem = UseAnimationReturn['animations'][number];

interface AuditResult {
  animation: AnimationItem;
  issues: string[];
  complianceLevel: ComplianceLevel;
  compliant: boolean;
}

const FLASHES_PER_SECOND_LIMIT = 3;
const LONG_ANIMATION_MS = 5000;

const getComplianceColor = (level: ComplianceLevel): ChipProps['color'] => {
  switch (level) {
    case 'AAA':
      return 'success';
    case 'AA':
      return 'info';
    case 'A':
      return 'warning';
    default:
      return 'error';
  }
};

export const AccessibilityAnimationDashboard: React.FC<AccessibilityDashboardProps> = ({ onClose }) => {
  const theming = useTheming('prototype_tester');
  const { prefersReducedMotion, isSupported, shouldAnimate, getDuration } = useMotionPreference();
  const { getIconButtonStyles, getTooltipProps } = useResearchBackedAnimations();
  const { animations, config, updateConfig } = useAnimation();

  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [showPreview, setShowPreview] = useState(false);
  const [comparisonMode, setComparisonMode] = useState(false);
  const [filterLevel, setFilterLevel] = useState<FilterLevel>('all');
  const [auditResults, setAuditResults] = useState<AuditResult[]>([]);

  useEffect(() => {
    const results: AuditResult[] = animations.map((animation) => {
      const issues: string[] = [];
      let complianceLevel: ComplianceLevel = 'AAA';

      if (animation.duration > LONG_ANIMATION_MS && animation.iterationCount === 'infinite') {
        issues.push('WCAG 2.2.2: Infinite animations longer than 5s must be pausable');
        complianceLevel = 'Needs Review';
      }

      const flashesPerSecond =
        animation.duration > 0 ? animation.keyframes.length / (animation.duration / 1000) : 0;
      if (flashesPerSecond > FLASHES_PER_SECOND_LIMIT) {
        issues.push('WCAG 2.3.1: Animation may cause more than 3 flashes per second');
        complianceLevel = 'Needs Review';
      }

      if (animation.duration > LONG_ANIMATION_MS && animation.iterationCount !== 'infinite') {
        issues.push('Best Practice: Animation duration exceeds 5 seconds');
        if (complianceLevel === 'AAA') {
          complianceLevel = 'AA';
        }
      }

      if (animation.research?.accessibilityRating) {
        complianceLevel = animation.research.accessibilityRating;
      }

      return {
        animation,
        issues,
        complianceLevel,
        compliant: issues.length === 0,
      };
    });

    setAuditResults(results);
  }, [animations]);

  const filteredAuditResults = useMemo(
    () =>
      auditResults.filter((result) =>
        filterLevel === 'all' ? true : result.complianceLevel === filterLevel,
      ),
    [auditResults, filterLevel],
  );

  const complianceStats = useMemo(() => {
    const total = auditResults.length;
    const compliant = auditResults.filter((result) => result.compliant).length;
    return {
      total,
      compliant,
      aaa: auditResults.filter((result) => result.complianceLevel === 'AAA').length,
      aa: auditResults.filter((result) => result.complianceLevel === 'AA').length,
      a: auditResults.filter((result) => result.complianceLevel === 'A').length,
      needsReview: auditResults.filter((result) => result.complianceLevel === 'Needs Review').length,
      compliancePercent: total > 0 ? Math.round((compliant / total) * 100) : 100,
    };
  }, [auditResults]);

  const handleFilterChange = (event: SelectChangeEvent<FilterLevel>) => {
    setFilterLevel(event.target.value as FilterLevel);
  };

  return (
    <Box sx={{ margin: '0 auto', maxWidth: 1400, p: 3 }}>
      <Box alignItems="center" display="flex" justifyContent="space-between" mb={3}>
        <Box alignItems="center" display="flex" gap={2}>
          <Accessibility sx={{ color: theming.colors.primary, fontSize: 32 }} />
          <Typography sx={{ color: theming.colors.primary }} variant="h4">
            Animation Accessibility Dashboard
          </Typography>
        </Box>
        <Box alignItems="center" display="flex" gap={1}>
          <Tooltip title={showPreview ? 'Hide Preview' : 'Show Preview'} {...getTooltipProps()}>
            <IconButton onClick={() => setShowPreview((value) => !value)} sx={getIconButtonStyles()}>
              {showPreview ? <VisibilityOff /> : <Visibility />}
            </IconButton>
          </Tooltip>
          <Tooltip
            title={comparisonMode ? 'Disable Comparison Mode' : 'Enable Comparison Mode'}
            {...getTooltipProps()}
          >
            <IconButton
              onClick={() => setComparisonMode((value) => !value)}
              sx={getIconButtonStyles()}
            >
              <CompareArrows />
            </IconButton>
          </Tooltip>
          <Tooltip title={config.enableAnimations ? 'Pause animations' : 'Play animations'} {...getTooltipProps()}>
            <IconButton
              onClick={() => updateConfig({ enableAnimations: !config.enableAnimations })}
              sx={getIconButtonStyles()}
            >
              {config.enableAnimations ? <Pause /> : <PlayArrow />}
            </IconButton>
          </Tooltip>
          {onClose && (
            <Button onClick={onClose} variant="outlined">
              Close
            </Button>
          )}
        </Box>
      </Box>

      <Grid container mb={3} spacing={3}>
        <Grid item md={4} xs={12}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent>
              <Box alignItems="center" display="flex" gap={1} mb={1}>
                {isSupported ? <CheckCircle color="success" /> : <Warning color="warning" />}
                <Typography variant="h6">Motion Preference Detection</Typography>
              </Box>
              <Typography color="text.secondary" gutterBottom variant="body2">
                System: {isSupported ? 'Supported' : 'Not Supported'}
              </Typography>
              <Chip
                color={prefersReducedMotion ? 'warning' : 'success'}
                label={prefersReducedMotion ? 'Reduced Motion Enabled' : 'Full Motion'}
                size="small"
                sx={{ mt: 1 }}
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid item md={4} xs={12}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent>
              <Box alignItems="center" display="flex" gap={1} mb={1}>
                <Assessment color="primary" />
                <Typography variant="h6">Compliance Score</Typography>
              </Box>
              <Box alignItems="baseline" display="flex" gap={1}>
                <Typography color="primary" variant="h3">
                  {complianceStats.compliancePercent}%
                </Typography>
                <Typography color="text.secondary" variant="body2">
                  ({complianceStats.compliant}/{complianceStats.total} animations)
                </Typography>
              </Box>
              <LinearProgress
                sx={{ mt: 2 }}
                value={complianceStats.compliancePercent}
                variant="determinate"
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid item md={4} xs={12}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent>
              <Box alignItems="center" display="flex" gap={1} mb={1}>
                <SpeedIcon color="info" />
                <Typography variant="h6">Effective Duration</Typography>
              </Box>
              <Typography color="primary" variant="h3">
                {Math.round(getDuration(1000) * speedMultiplier)}ms
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 1 }} variant="body2">
                Motion allowed: {shouldAnimate() ? 'Yes' : 'No'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Paper sx={{ ...theming.getThemedCardSx(), mb: 3, p: 3 }}>
        <Typography gutterBottom variant="h6">
          Animation Controls
        </Typography>
        <Grid container spacing={3} sx={{ mt: 1 }}>
          <Grid item md={6} xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={config.enableAnimations}
                  onChange={(event) => updateConfig({ enableAnimations: event.target.checked })}
                />
              }
              label="Enable All Animations"
            />
            <Typography color="text.secondary" sx={{ ml: 4 }} variant="caption">
              Master toggle for all animation playback
            </Typography>
          </Grid>

          <Grid item md={6} xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={comparisonMode}
                  onChange={(event) => setComparisonMode(event.target.checked)}
                />
              }
              label="Comparison Mode"
            />
            <Typography color="text.secondary" sx={{ ml: 4 }} variant="caption">
              View animations side-by-side (normal vs reduced motion)
            </Typography>
          </Grid>

          <Grid item xs={12}>
            <Typography gutterBottom variant="body2">
              Animation Speed Multiplier
            </Typography>
            <Box alignItems="center" display="flex" gap={2}>
              <Slider
                marks={[
                  { label: 'Off', value: 0 },
                  { label: '0.5x', value: 0.5 },
                  { label: '1x', value: 1 },
                  { label: '1.5x', value: 1.5 },
                  { label: '2x', value: 2 },
                ]}
                max={2}
                min={0}
                onChange={(_, value) => setSpeedMultiplier(value as number)}
                step={0.1}
                sx={{ flexGrow: 1 }}
                value={speedMultiplier}
                valueLabelDisplay="auto"
              />
              <Typography sx={{ minWidth: 60 }} variant="body2">
                {speedMultiplier === 0 ? 'Disabled' : `${speedMultiplier}x`}
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ ...theming.getThemedCardSx(), p: 3 }}>
        <Box alignItems="center" display="flex" justifyContent="space-between" mb={2}>
          <Typography variant="h6">Animation Audit Results</Typography>
          <Box alignItems="center" display="flex" gap={1}>
            <Settings fontSize="small" />
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Filter by Level</InputLabel>
              <Select<FilterLevel>
                label="Filter by Level"
                onChange={handleFilterChange}
                value={filterLevel}
              >
                <MenuItem value="all">All Levels</MenuItem>
                <MenuItem value="AAA">AAA Only</MenuItem>
                <MenuItem value="AA">AA Only</MenuItem>
                <MenuItem value="A">A Only</MenuItem>
                <MenuItem value="Needs Review">Needs Review</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </Box>

        {complianceStats.needsReview > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <AlertTitle>Accessibility Issues Found</AlertTitle>
            {complianceStats.needsReview} animation(s) need review for WCAG 2.1 compliance
          </Alert>
        )}

        <List>
          {filteredAuditResults.map((result, index) => (
            <React.Fragment key={result.animation.id}>
              {index > 0 && <Divider />}
              <ListItem sx={{ alignItems: 'flex-start', py: 2 }}>
                <ListItemIcon sx={{ mt: 1 }}>
                  {result.compliant ? <CheckCircle color="success" /> : <Warning color="warning" />}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box alignItems="center" display="flex" gap={1}>
                      <Typography variant="body1">{result.animation.name}</Typography>
                      <Chip
                        color={getComplianceColor(result.complianceLevel)}
                        label={result.complianceLevel}
                        size="small"
                      />
                      {result.animation.research?.source && (
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
                      <Typography color="text.secondary" gutterBottom variant="body2">
                        Duration: {result.animation.duration}ms • Easing: {result.animation.easing}
                      </Typography>
                      {result.issues.length > 0 && (
                        <Box sx={{ mt: 1 }}>
                          {result.issues.map((issue, issueIndex) => (
                            <Typography color="error.main" display="block" key={issueIndex} variant="caption">
                              • {issue}
                            </Typography>
                          ))}
                        </Box>
                      )}
                      {result.animation.research?.recommendedContext &&
                        result.animation.research.recommendedContext.length > 0 && (
                          <Box sx={{ mt: 1 }}>
                            <Typography color="text.secondary" variant="caption">
                              Recommended for:{' '}
                              {result.animation.research.recommendedContext.join(', ')}
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

      <Alert severity="info" sx={{ mt: 3 }}>
        <AlertTitle>About Accessibility Compliance</AlertTitle>
        <Typography variant="body2">
          This dashboard monitors animation compliance with WCAG 2.1 Success Criteria 2.2.2
          (Pause, Stop, Hide), 2.3.1 (Three Flashes or Below Threshold), and 2.3.3 (Animation from
          Interactions). All animations automatically respect the user&apos;s
          <code> prefers-reduced-motion </code> system preference.
        </Typography>
      </Alert>
    </Box>
  );
};

export default AccessibilityAnimationDashboard;
