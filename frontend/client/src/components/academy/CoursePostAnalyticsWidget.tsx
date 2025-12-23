import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Stack,
  Chip,
  LinearProgress,
  Tooltip,
  IconButton,
  Alert,
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  TouchApp as TouchAppIcon,
  School as SchoolIcon,
  TrendingUp as TrendingUpIcon,
  Refresh as RefreshIcon,
	  Info as InfoIcon,
	} from '@mui/icons-material';
	import { withUniversalIntegration } from '@/integration/UniversalIntegrationHOC';

interface AnalyticsData {
  totals: {
    total_posts: number;
    total_views: number;
    total_clicks: number;
    total_enrollments: number;
    avg_click_through_rate: number;
    avg_conversion_rate: number;
  };
  analytics: any[];
}

	function CoursePostAnalyticsWidget() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/academy/analytics/posts', {
        credentials: 'include',
      });
      const result = await response.json();
      if (response.ok) {
        setData(result);
      } else {
        setError(result.error || 'Failed to load analytics');
      }
    } catch (err: any) {
      console.error('Error fetching analytics: ', err);
      setError('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

	  if (loading) {
	    return (
	      <Card>
	        <CardContent>
	          <Typography variant="h6" gutterBottom>
	            Community Post Analytics
	          </Typography>
	          <LinearProgress />
	        </CardContent>
	      </Card>
	    );
	  }

	  if (error) {
    return (
      <Card>
        <CardContent>
          <Alert severity="error">{error}</Alert>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.totals.total_posts === 0) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Community Post Analytics
          </Typography>
          <Alert severity="info">
            Ingen data tilgjengelig ennå. Publiser et kurs til community for å se analytikk.
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const { totals } = data;

  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">
            Community Post Analytics
          </Typography>
          <Tooltip title="Oppdater data">
            <IconButton size="small" onClick={fetchAnalytics}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>

        <Grid container spacing={2}>
          {/* Total Views */}
          <Grid item xs={6} md={3}>
            <Box textAlign="center" p={2} bgcolor="primary.50" borderRadius={2}>
              <VisibilityIcon color="primary" sx={{ fontSize: 32, mb: 1 }} />
              <Typography variant="h4" fontWeight={600}>
                {totals.total_views}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Totale visninger
              </Typography>
            </Box>
          </Grid>

          {/* Total Clicks */}
          <Grid item xs={6} md={3}>
            <Box textAlign="center" p={2} bgcolor="secondary.50" borderRadius={2}>
              <TouchAppIcon color="secondary" sx={{ fontSize: 32, mb: 1 }} />
              <Typography variant="h4" fontWeight={600}>
                {totals.total_clicks}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Totale klikk
              </Typography>
            </Box>
          </Grid>

          {/* Total Enrollments */}
          <Grid item xs={6} md={3}>
            <Box textAlign="center" p={2} bgcolor="success.50" borderRadius={2}>
              <SchoolIcon color="success" sx={{ fontSize: 32, mb: 1 }} />
              <Typography variant="h4" fontWeight={600}>
                {totals.total_enrollments}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Påmeldinger
              </Typography>
            </Box>
          </Grid>

          {/* Total Posts */}
          <Grid item xs={6} md={3}>
            <Box textAlign="center" p={2} bgcolor="info.50" borderRadius={2}>
              <TrendingUpIcon color="info" sx={{ fontSize: 32, mb: 1 }} />
              <Typography variant="h4" fontWeight={600}>
                {totals.total_posts}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Publiserte innlegg
              </Typography>
            </Box>
          </Grid>

          {/* Performance Metrics */}
          <Grid item xs={12}>
            <Stack spacing={2} mt={2}>
              {/* Click-Through Rate */}
              <Box>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="body2" color="text.secondary">
                    Gjennomsnittlig klikkrate (CTR)
                  </Typography>
                  <Tooltip title="Prosentandel av visninger som resulterte i klikk">
                    <InfoIcon fontSize="small" color="action" />
                  </Tooltip>
                </Box>
                <Box display="flex" alignItems="center" gap={2}>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(totals.avg_click_through_rate, 100)}
                    sx={{ flex: 1, height: 8, borderRadius: 4 }}
                  />
                  <Typography variant="body2" fontWeight={600}>
                    {totals.avg_click_through_rate.toFixed(1)}%
                  </Typography>
                </Box>
              </Box>

              {/* Conversion Rate */}
              <Box>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="body2" color="text.secondary">
                    Gjennomsnittlig konverteringsrate
                  </Typography>
                  <Tooltip title="Prosentandel av klikk som resulterte i påmeldinger">
                    <InfoIcon fontSize="small" color="action" />
                  </Tooltip>
                </Box>
                <Box display="flex" alignItems="center" gap={2}>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(totals.avg_conversion_rate, 100)}
                    color="success"
                    sx={{ flex: 1, height: 8, borderRadius: 4 }}
                  />
                  <Typography variant="body2" fontWeight={600}>
                    {totals.avg_conversion_rate.toFixed(1)}%
                  </Typography>
                </Box>
              </Box>
            </Stack>
          </Grid>

          {/* Top Performing Posts */}
          {data.analytics.length > 0 && (
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                Beste innlegg
              </Typography>
              <Stack spacing={1}>
                {data.analytics
                  .sort((a: any, b: any) => (b.enrollments_from_post || 0) - (a.enrollments_from_post || 0))
                  .slice(0, 3)
                  .map((post: any) => (
                    <Box
                      key={post.post_id}
                      p={1.5}
                      bgcolor="background.default"
                      borderRadius={1}
                      display="flex"
                      justifyContent="space-between"
                      alignItems="center"
                    >
                      <Box flex={1}>
                        <Typography variant="body2" fontWeight={600} noWrap>
                          {post.course_title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {post.channel_name}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1}>
                        <Chip
                          label={`${post.views_count} visninger`}
                          size="small"
                          variant="outlined"
                        />
                        <Chip
                          label={`${post.enrollments_from_post} påmeldinger`}
                          size="small"
                          color="success"
                        />
                      </Stack>
                    </Box>
                  ))}
              </Stack>
            </Grid>
          )}
        </Grid>
      </CardContent>
    </Card>
  );
}

export default withUniversalIntegration(CoursePostAnalyticsWidget, {
	  componentId: 'course-post-analytics-widget',
	  componentName: 'Course Post Analytics Widget',
	  componentType: 'widget',
	  componentCategory:'academy',
	  	  featureIds: ['analytics-academy'],
});
