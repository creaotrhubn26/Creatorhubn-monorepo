/**
 * Complete Integration Overview
 * Displays live profession-adapter integrations and cross-system status.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import {
  Analytics as AnalyticsIcon,
  AutoFixHigh as AutoFixHighIcon,
  CheckCircle as CheckCircleIcon,
  Link as LinkIcon,
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import getProfessionIcon from '@/utils/profession-icons';
import { useTheming } from '@/utils/theming-helper';
import type { GoogleTrendsData } from '@/services/GoogleTrendsService';

type SnackbarState = {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'info';
};

type ConnectedComponentRow = {
  component: string;
  connection: string;
  status: 'Active' | 'Partial' | 'Disabled';
};

const CORE_COMPONENT_ROWS: ConnectedComponentRow[] = [
  { component: 'ProfessionAdapter', connection: 'Context + hook bridge', status: 'Active' },
  { component: 'Universal CRM Dashboard', connection: 'Profession-adapted labels/data', status: 'Active' },
  { component: 'Communication Hub', connection: 'Dynamic profession config', status: 'Active' },
  { component: 'Smart Workflow System', connection: 'Feature matrix + profession config', status: 'Active' },
];

const SEO_COMPONENT_ROWS: ConnectedComponentRow[] = [
  { component: 'SEO Specialist Management', connection: 'SEO suggestions + analytics', status: 'Active' },
  { component: 'SEO Trends Dashboard', connection: 'Google Trends data path', status: 'Active' },
  { component: 'Visual Editor', connection: 'SEO validation + content metadata', status: 'Active' },
  { component: 'Profession Trends Integration', connection: 'Dynamic profession + trends merge', status: 'Active' },
];

function statusColor(status: ConnectedComponentRow['status']): 'success' | 'warning' | 'default' {
  if (status === 'Active') return 'success';
  if (status === 'Partial') return 'warning';
  return 'default';
}

function ConnectedTable({ rows }: { rows: ConnectedComponentRow[] }) {
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Component</TableCell>
            <TableCell>Connection</TableCell>
            <TableCell>Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.component}>
              <TableCell>{row.component}</TableCell>
              <TableCell>{row.connection}</TableCell>
              <TableCell>
                <Chip size="small" label={row.status} color={statusColor(row.status)} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default function CompleteIntegrationOverview() {
  const {
    profession,
    config,
    getProjectTypes,
    getDefaultHourlyRate,
    getContractTemplates,
    adaptDashboardTitle,
    supportsWeddingTimeline,
    loadTrendsData,
    getTrendingKeywords,
    getSEOSuggestions,
    getSEOInsights,
    applySEOFixes,
    getProfessionSpecificKeywords,
    getProfessionSEOTips,
    trackProfessionActivity,
    getProfessionAnalytics,
  } = useProfessionAdapter();

  const { getProfessionDisplayName, getUserProfessionColor } = useDynamicProfessions();
  const theming = useTheming(profession);

  const [loading, setLoading] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<Record<string, unknown> | null>(null);
  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: '',
    severity: 'info',
  });

  const professionIcon = useMemo(() => getProfessionIcon(profession), [profession]);
  const trendingKeywords = getTrendingKeywords();
  const seoSuggestions = getSEOSuggestions();
  const seoInsights = getSEOInsights();
  const professionKeywords = getProfessionSpecificKeywords();
  const professionSEOTips = getProfessionSEOTips();

  const loadIntegrationData = useCallback(async () => {
    setLoading(true);
    try {
      await loadTrendsData('norway');
      const analytics = await getProfessionAnalytics();
      if (analytics && typeof analytics === 'object') {
        setAnalyticsData(analytics as Record<string, unknown>);
      } else {
        setAnalyticsData(null);
      }
    } catch (error) {
      console.error('Failed to load integration overview data:', error);
      setSnackbar({
        open: true,
        message: 'Kunne ikke laste integrasjonsdata',
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [getProfessionAnalytics, loadTrendsData]);

  useEffect(() => {
    void loadIntegrationData();
  }, [loadIntegrationData]);

  const handleApplySEOFixes = useCallback(async () => {
    const ok = await applySEOFixes('norway');
    if (ok) {
      setSnackbar({
        open: true,
        message: 'SEO-forslag ble brukt',
        severity: 'success',
      });
      await trackProfessionActivity('seo_fixes_applied', { profession });
      return;
    }

    setSnackbar({
      open: true,
      message: 'SEO-forslag kunne ikke brukes',
      severity: 'error',
    });
  }, [applySEOFixes, profession, trackProfessionActivity]);

  return (
    <Box sx={{ width: '100%', display: 'grid', gap: 2 }}>
      <Box>
        <Typography variant="h4" sx={{ color: theming.colors.primary, fontWeight: 700 }}>
          Complete Integration Overview
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Live status for adapter, trends, SEO and cross-component data flow.
        </Typography>
      </Box>

      <Card sx={theming.getThemedCardSx()}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={8}>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1.5 }}>
                <Box sx={{ color: getUserProfessionColor(profession), display: 'flex', alignItems: 'center' }}>
                  {professionIcon}
                </Box>
                <Box>
                  <Typography variant="h6">{getProfessionDisplayName(profession)}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {profession}
                  </Typography>
                </Box>
              </Stack>
              <Typography variant="body2">
                <strong>Dashboard:</strong> {adaptDashboardTitle()}
              </Typography>
              <Typography variant="body2">
                <strong>Default hourly rate:</strong> {getDefaultHourlyRate()} NOK
              </Typography>
              <Typography variant="body2">
                <strong>Wedding timeline support:</strong> {supportsWeddingTimeline() ? 'Yes' : 'No'}
              </Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Special features
              </Typography>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {config.specialFeatures.map((feature) => (
                  <Chip key={feature} size="small" label={feature} color="primary" />
                ))}
              </Stack>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Project Types
              </Typography>
              <List dense>
                {getProjectTypes().map((projectType) => (
                  <ListItem key={projectType.value}>
                    <ListItemIcon>
                      <CheckCircleIcon color="success" />
                    </ListItemIcon>
                    <ListItemText
                      primary={projectType.label}
                      secondary={`${projectType.description ?? 'No description'} • ${projectType.defaultHours ?? 0}h`}
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Contract Templates
              </Typography>
              <List dense>
                {getContractTemplates().map((template) => (
                  <ListItem key={template}>
                    <ListItemIcon>
                      <CheckCircleIcon color="success" />
                    </ListItemIcon>
                    <ListItemText primary={template} />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <TrendingUpIcon color="primary" />
                <Typography variant="h6">Google Trends</Typography>
              </Stack>
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                  <CircularProgress size={28} />
                </Box>
              ) : trendingKeywords.length === 0 ? (
                <Alert severity="info">No trends loaded yet.</Alert>
              ) : (
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  {(trendingKeywords as GoogleTrendsData[]).slice(0, 8).map((keyword) => (
                    <Chip
                      key={keyword.keyword}
                      size="small"
                      label={`${keyword.keyword} (${keyword.searchVolume})`}
                      color={keyword.trend === 'rising' ? 'success' : 'default'}
                    />
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <AutoFixHighIcon color="primary" />
                <Typography variant="h6">SEO Suggestions</Typography>
              </Stack>
              {seoSuggestions.length === 0 ? (
                <Alert severity="info">No SEO suggestions available.</Alert>
              ) : (
                <List dense>
                  {seoSuggestions.slice(0, 5).map((suggestion, index) => (
                    <ListItem key={`seo-suggestion-${index}`}>
                      <ListItemIcon>
                        <AutoFixHighIcon color="action" />
                      </ListItemIcon>
                      <ListItemText
                        primary={typeof suggestion?.title === 'string' ? suggestion.title : 'SEO item'}
                        secondary={
                          typeof suggestion?.description === 'string'
                            ? suggestion.description
                            : 'No detailed description'
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              )}
              <Button
                variant="contained"
                color="success"
                startIcon={<AutoFixHighIcon />}
                onClick={() => void handleApplySEOFixes()}
                sx={{ mt: 1 }}
              >
                Apply SEO Fixes
              </Button>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Profession Keywords
              </Typography>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {professionKeywords.map((keyword) => (
                  <Chip key={keyword} size="small" label={keyword} variant="outlined" />
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <VisibilityIcon color="primary" />
                <Typography variant="h6">SEO Tips</Typography>
              </Stack>
              <List dense>
                {professionSEOTips.slice(0, 5).map((tip, index) => (
                  <ListItem key={`seo-tip-${index}`}>
                    <ListItemIcon>
                      <VisibilityIcon color="action" />
                    </ListItemIcon>
                    <ListItemText primary={tip} />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card sx={theming.getThemedCardSx()}>
        <CardContent sx={{ display: 'grid', gap: 2 }}>
          <Box>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Connected Components
            </Typography>
            <ConnectedTable rows={CORE_COMPONENT_ROWS} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ mb: 1 }}>
              SEO & Analytics Components
            </Typography>
            <ConnectedTable rows={SEO_COMPONENT_ROWS} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Data Flow
            </Typography>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
              <Chip label="Dynamic Professions" color="primary" />
              <Typography>→</Typography>
              <Chip label="Profession Adapter" color="secondary" />
              <Typography>→</Typography>
              <Chip label="Google Trends" color="success" />
              <Typography>→</Typography>
              <Chip label="SEO Suggestions" color="warning" />
              <Typography>→</Typography>
              <Chip label="Analytics" color="info" />
            </Stack>
          </Box>
          {seoInsights && (
            <Alert severity="info" icon={<AnalyticsIcon />}>
              {`SEO Insight: volume ${seoInsights.searchVolume}, trend ${seoInsights.trend}, opportunity ${seoInsights.opportunity}`}
            </Alert>
          )}
          {analyticsData && (
            <Alert severity="success" icon={<AnalyticsIcon />}>
              Analytics data connected ({Object.keys(analyticsData).length} fields).
            </Alert>
          )}
        </CardContent>
      </Card>

      <Stack direction="row" spacing={1}>
        <Button
          variant="contained"
          startIcon={<RefreshIcon />}
          onClick={() => void loadIntegrationData()}
          disabled={loading}
        >
          Refresh Data
        </Button>
        <Button
          variant="outlined"
          startIcon={<LinkIcon />}
          onClick={() => void trackProfessionActivity('integration_overview_viewed', { profession })}
        >
          Track View
        </Button>
      </Stack>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
