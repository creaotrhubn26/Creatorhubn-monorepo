/**
 * SEO Trends Dashboard for CreatorHub Norge
 * Real-time Google Trends integration with one-click fixes
 */

import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Chip,
  LinearProgress,
  Alert,
  Snackbar,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Tooltip,
  Badge,
  Divider,
  Paper,
  Stack,
  CircularProgress,
} from '@mui/material';
import {
  TrendingUp,
  Search,
  AutoFixHigh,
  CheckCircle,
  Warning,
  Info,
  Refresh,
  Analytics,
  Timeline,
  LocationOn,
  Schedule,
  Star,
  TrendingDown,
  TrendingFlat,
} from '@mui/icons-material';
import { creatorHubSEOFixService, CreatorHubSEOSuggestion } from '@/services/CreatorHubSEOFixService';
import { googleTrendsService, GoogleTrendsData, TrendsInsight } from '@/services/GoogleTrendsService';
import { googleAnalyticsService } from '@/services/GoogleAnalyticsService';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`seo-trends-tabpanel-${index}`}
      aria-labelledby={`seo-trends-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p:  3 }}>{children}</Box>}
    </div>
  );
}

export default function SEOTrendsDashboard() {
  const [activeTab, setActiveTab] = useState(0);

  // Theming system
  const theming = useTheming('prototype_tester');
  const { auth } = useEnhancedMasterIntegration();
  const [profession, setProfession] = useState<'photographer' | 'videographer' | 'music-producer' | 'vendor'>('photographer');
  const [region, setRegion] = useState<'norway' | 'oslo' | 'bergen' | 'trondheim' | 'stavanger'>('norway');
  const [suggestions, setSuggestions] = useState<CreatorHubSEOSuggestion[]>([]);
  const [trendsInsights, setTrendsInsights] = useState<TrendsInsight | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isApplyingFixes, setIsApplyingFixes] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'warning' | 'info' }>({ open: false, message: '', severity: 'info' });

  // Load data on mount and when profession/region changes
  useEffect(() => {
    loadTrendsData();
}, [profession, region]);

  const loadTrendsData = async () => {
    setIsLoading(true);
    try {
      // Track trends dashboard view
      googleAnalyticsService.trackEvent('seo_trends_dashboard_viewed,', {
        profession,
        region,
        timestamp: new Date().toISOString(),
    });

      // Load suggestions with trends data
      const seoSuggestions = await creatorHubSEOFixService.generateSuggestions({}, profession, region);
      setSuggestions(seoSuggestions);

      // Load trends insights
      const insights = await googleTrendsService.getTrendsInsights(profession);
      setTrendsInsights(insights);

      setLastUpdate(new Date());
  } catch (error) {
      console.error('Error loading trends data: ', error);
  } finally {
      setIsLoading(false);
  }
};

  const handleApplyAllFixes = async () => {
    setIsApplyingFixes(true);
    try {
      await creatorHubSEOFixService.applyAllHighPriorityFixes({}, profession, region);
      
      // Show success message
      const confirmation = creatorHubSEOFixService.getFixConfirmation(
        suggestions.flatMap(s => s.fixes).filter(f => f.priority === 'high').length,
        profession
      );
      
      // Track successful fix application
      googleAnalyticsService.trackEvent('seo_fixes_applied_successfully', {
        profession,
        region,
        fixes_count: suggestions.flatMap(s => s.fixes).filter(f => f.priority === 'high').length,
        timestamp: new Date().toISOString(),
    });

      setSnackbar({ open: true, message: confirmation, severity: 'success' });
  } catch (error) {
      console.error('Error applying fixes: ', error);
  } finally {
      setIsApplyingFixes(false);
  }
};

  const getTrendIcon = (trend: 'rising' | 'stable' | 'declining') => {
    switch (trend) {
      case 'rising':
        return <TrendingUp color="success" />;
      case 'declining':
        return <TrendingDown color="error" />;
      default:
        return <TrendingFlat color="info" />;
}
};

  const getOpportunityColor = (opportunity: 'high' | 'medium' | 'low') => {
    switch (opportunity) {
      case 'high':
        return 'success';
      case 'medium':
        return 'warning';
      default:
        return 'error';
}
};

  return (
    <Box sx={{ width: '100%'}}>
      {/* Header */}
      <Box sx={{ mb:  3 }}>
        <Typography variant="h4" gutterBottom sx={{ color: theming.colors.primary }}>
          📈 SEO Trends Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Real-time Google Trends data for Norwegian creative professionals
        </Typography>
      </Box>

      {/* Profession and Region Selector */}
      <Card sx={{ mb:  3 ,  ...theming.getThemedCardSx() }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Grid container spacing={2} alignItems="center">
            <Grid item >
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Profession & Region
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {(['photographer', 'videographer', 'music-producer','vendor'] as const).map((prof) => (
                  <Chip
                    key={prof}
                    label={prof.charAt(0).toUpperCase() + prof.slice(1)}
                    onClick={() => setProfession(prof)}
                    color={profession === prof ? 'primary' : 'default'}
                    variant={profession === prof ? 'filled' : 'outlined'}
                  />
                ))}
              </Stack>
            </Grid>
            <Grid item >
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {(['norway', 'oslo', 'bergen', 'trondheim','stavanger'] as const).map((reg) => (
                  <Chip
                    key={reg}
                    label={reg.charAt(0).toUpperCase() + reg.slice(1)}
                    onClick={() => setRegion(reg)}
                    color={region === reg ? 'secondary' : 'default'}
                    variant={region === reg ? 'filled' : 'outlined'}
                    icon={theming.getThemedIcon('location')}}
                  />
                ))}
              </Stack>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider'}}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab label="Trending Keywords" icon={theming.getThemedIcon('trendingUp')}} />
          <Tab label="SEO Suggestions" icon={theming.getThemedIcon('autoFixHigh')}} />
          <Tab label="Regional Insights" icon={theming.getThemedIcon('location')}} />
          <Tab label="Seasonal Opportunities" icon={theming.getThemedIcon('schedule')}} />
        </Tabs>
      </Box>

      {/* Tab Panels */}
      <TabPanel value={activeTab} index={0}>
        {/* Trending Keywords */}
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p:  4 }}>
            <CircularProgress />
          </Box>
        ) : trendsInsights ? (
          <Grid container spacing={3}>
            <Grid item >
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                🔥 Trending Keywords for {profession.charAt(0).toUpperCase() + profession.slice(1)} in {region.charAt(0).toUpperCase() + region.slice(1)}
              </Typography>
            </Grid>
            {trendsInsights.trendingKeywords.map((keyword, index) => (
              <Grid item  key={index}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb:  2 }}>
                      <Typography variant="h6" sx={{ color: theming.colors.primary }}>{keyword.keyword}</Typography>
                      {getTrendIcon(keyword.trend)}
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                      <Chip
                        label={`${keyword.searchVolume} searches`}
                        size="small"
                        icon={theming.getThemedIcon('search')}}
                      />
                      <Chip
                        label={keyword.opportunity}
                        size="small"
                        color={getOpportunityColor(keyword.opportunity)}
                      />
                      <Chip
                        label={keyword.competition}
                        size="small"
                        variant="outlined"
                      />
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      Related: {keyword.relatedKeywords.join('')}
                    </Typography>
                    {keyword.seasonality.peakMonths.length > 0 && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt:  1 }}>
                        Peak season: {keyword.seasonality.peakMonths.join(', ')}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        ) : (
          <Alert severity="info">No trending data available</Alert>
        )}
      </TabPanel>

      <TabPanel value={activeTab} index={1}>
        {/* SEO Suggestions */}
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p:  4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb:  3 }}>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                🎯 SEO Suggestions with Google Trends Data
              </Typography>
              <Button variant="contained"
                startIcon={theming.getThemedIcon('autoFixHigh')}
                onClick={handleApplyAllFixes}
                disabled={isApplyingFixes}
                color="success"
               sx={theming.getThemedButtonSx()}>
                {isApplyingFixes ? 'Applying...' : 'Apply All High-Priority Fixes'}
              </Button>
            </Box>

            {suggestions.map((suggestion, index) => (
              <Card key={index}, sx={{ mb:  2 ,  ...theming.getThemedCardSx() }}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb:  2 }}>
                    <Box>
                      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                        {suggestion.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {suggestion.description}
                      </Typography>
                    </Box>
                    <Chip
                      label={suggestion.category}
                      color="primary"
                      size="small"
                    />
                  </Box>

                  {/* Trends Insights */}
                  {suggestion.trendsInsights && (
                    <Paper sx={{ p: 2, mb: 2, bgcolor: 'grey.50',  ...theming.getThemedCardSx() }}>
                      <Typography variant="subtitle2" gutterBottom>
                        📊 Google Trends Insights
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap'}}>
                        <Chip
                          label={`${suggestion.trendsInsights.searchVolume} total searches`}
                          size="small"
                          icon={theming.getThemedIcon('search')}}
                        />
                        <Chip
                          label={`Trend: ${suggestion.trendsInsights.trend}`}
                          size="small"
                          icon={getTrendIcon(suggestion.trendsInsights.trend)}
                        />
                        <Chip
                          label={`Opportunity: ${suggestion.trendsInsights.opportunity}`}
                          size="small"
                          color={getOpportunityColor(suggestion.trendsInsights.opportunity)}
                        />
                        <Chip
                          label={suggestion.trendsInsights.seasonality}
                          size="small"
                          icon={theming.getThemedIcon('schedule')}}
                        />
                      </Box>
                    </Paper>
                  )}

                  {/* Fixes */}
                  <Typography variant="subtitle2" gutterBottom>
                    One-Click Fixes: </Typography>
                  <List dense>
                    {suggestion.fixes.map((fix, fixIndex) => (
                      <ListItem key={fixIndex}>
                        <ListItemIcon>
                          <CheckCircle color="success" />
                        </ListItemIcon>
                        <ListItemText
                          primary={fix.title}
                          secondary={fix.description}
                        />
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={fix.oneClickFix}
                        >
                          Apply
                        </Button>
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            ))}
          </Box>
        )}
      </TabPanel>

      <TabPanel value={activeTab} index={2}>
        {/* Regional Insights */}
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p:  4 }}>
            <CircularProgress />
          </Box>
        ) : trendsInsights ? (
          <Grid container spacing={3}>
            {trendsInsights.regionalInsights.map((regionData, index) => (
              <Grid item  key={index}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                      <LocationOn sx={{ mr: 1, verticalAlign: 'middle'}} />
                      {regionData.region.charAt(0).toUpperCase() + regionData.region.slice(1)}
                    </Typography>
                    <List dense>
                      {regionData.topKeywords.map((keyword, keywordIndex) => (
                        <ListItem key={keywordIndex}>
                          <ListItemIcon>
                            {getTrendIcon(keyword.trend)}
                          </ListItemIcon>
                          <ListItemText
                            primary={keyword.keyword}
                            secondary={`${keyword.searchVolume} searches • ${keyword.opportunity} opportunity`}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        ) : (
          <Alert severity="info">No regional data available</Alert>
        )}
      </TabPanel>

      <TabPanel value={activeTab} index={3}>
        {/* Seasonal Opportunities */}
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p:  4 }}>
            <CircularProgress />
          </Box>
        ) : trendsInsights ? (
          <Box>
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              📅 Seasonal Opportunities
            </Typography>
            <Grid container spacing={3}>
              {trendsInsights.seasonalOpportunities.map((opportunity, index) => (
                <Grid item  key={index}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                        {opportunity.keyword}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                        <Chip
                          label={`Peak: ${opportunity.seasonality.peakMonths.join(', ')}`}
                          color="success"
                          size="small"
                        />
                        <Chip
                          label={`Low: ${opportunity.seasonality.lowMonths.join(', ')}`}
                          color="warning"
                          size="small"
                        />
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        Search Volume: {opportunity.searchVolume}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        ) : (
          <Alert severity="info">No seasonal data available</Alert>
        )}
      </TabPanel>

      {/* Footer */}
      {lastUpdate && (
        <Box sx={{ mt:  3, textAlign:'center'}}>
          <Typography variant="body2" color="text.secondary">
            Last updated: {lastUpdate.toLocaleString()}
          </Typography>
          <Button
            startIcon={theming.getThemedIcon('refresh')}
            onClick={loadTrendsData}
            disabled={isLoading}
            size="small"
            sx={{ mt:  1 }}
          >
            Refresh Data
          </Button>
        </Box>
      )}

      {/* Snackbar for notifications */}
      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))} severity={snackbar.severity} variant="filled">{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
