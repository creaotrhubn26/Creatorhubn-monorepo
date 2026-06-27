/**
 * Profession Trends Integration Component
 * Shows how useDynamicProfessions is connected to Google Trends
 */

import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Alert,
  Divider,
  Paper,
  Stack,
  IconButton,
  Tooltip,
  Snackbar,
} from '@mui/material';
import {
  TrendingUp,
  Search,
  AutoFixHigh,
  CheckCircle,
  Refresh,
  Analytics,
  LocationOn,
  Schedule,
  Star,
  Link,
  Whatshot,
  Lightbulb,
  Build,
} from '@mui/icons-material';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import { AdminButton, AdminLoading } from './design-system';

export default function ProfessionTrendsIntegration() {
  const {
    professionConfigs,
    getCurrentUserProfession,
    loadTrendsData,
    getTrendingKeywords,
    getSEOSuggestions,
    getSEOInsights,
    applySEOFixes,
  } = useDynamicProfessions();

  const [selectedProfession, setSelectedProfession] = useState<string>('photographer');
  const [selectedRegion, setSelectedRegion] = useState<string>('norway');
  const [isLoading, setIsLoading] = useState(false);
  
  // Snackbar state
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'warning' | 'info' }>({ open: false, message: '', severity: 'info' });
  
  // Theming system
  const theming = useTheming('prototype_tester');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const currentProfession = getCurrentUserProfession();
  const professionConfig = professionConfigs[selectedProfession];

  // Load trends data when profession or region changes
  useEffect(() => {
    loadTrendsForProfession();
}, [selectedProfession, selectedRegion]);

  const loadTrendsForProfession = async () => {
    setIsLoading(true);
    try {
      await loadTrendsData(selectedProfession, selectedRegion);
      setLastUpdate(new Date());
  } catch (error) {
      console.error('Error loading trends: ', error);
  } finally {
      setIsLoading(false);
  }
};

  const handleApplySEOFixes = async () => {
    const success = await applySEOFixes(selectedProfession, selectedRegion);
    if (success) {
      setSnackbar({ open: true, message: 'SEO fixes applied successfully!', severity: 'success' });
  } else {
      setSnackbar({ open: true, message: 'Error applying SEO fixes', severity: 'error' });
  }
};

  const getTrendIcon = (trend: 'rising' | 'stable' | 'declining') => {
    switch (trend) {
      case 'rising':
        return <TrendingUp color="success" />;
      case 'declining':
        return <TrendingUp color="error" sx={{ transform: 'rotate(180deg)'}} />;
      default: return <TrendingUp color="info" />;
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
        <Typography variant="h4" component="h2" gutterBottom sx={{ color: theming.colors.primary, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Link sx={{ fontSize: 32 }} aria-hidden="true" />
          Profession-Trends Integration
        </Typography>
        <Typography variant="body1" color="text.secondary">
          How useDynamicProfessions connects to Google Trends and SEO
        </Typography>
      </Box>

      {/* Current User Info */}
      <Card sx={{ mb:  3 ,  ...theming.getThemedCardSx() }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Typography variant="h6" component="h3" gutterBottom sx={{ color: theming.colors.primary }}>
            Current User Context
          </Typography>
          <Grid container spacing={2}>
            <Grid item >
              <Typography variant="body2" color="text.secondary">
                Current Profession: <strong>{currentProfession}</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Display Name: <strong>{professionConfig?.displayName}</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Icon Color: <Chip label={professionConfig?.iconColor} size="small" />
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Active: <Chip label={professionConfig?.isActive ? 'Yes' : 'N'} color={professionConfig?.isActive ? 'success' : 'error'} size="small" />
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Profession Selector */}
      <Card sx={{ mb:  3 ,  ...theming.getThemedCardSx() }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Typography variant="h6" component="h3" gutterBottom sx={{ color: theming.colors.primary }}>
            <Search sx={{ mr: 1, verticalAlign: 'middle' }} aria-hidden="true" />
            Test Different Professions
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb:  2 }}>
            {Object.keys(professionConfigs).map((profession) => (
              <Chip
                key={profession}
                label={professionConfigs[profession].displayName}
                onClick={() => setSelectedProfession(profession)}
                color={selectedProfession === profession ? 'primary' : 'default'}
                variant={selectedProfession === profession ? 'filled' : 'outlined'}
              />
            ))}
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <LocationOn fontSize="small" />
            Select Region:
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {['norway', 'oslo', 'bergen', 'trondheim', 'stavanger'].map((region) => (
              <Tooltip key={region} title={`Analyze trends for ${region}`} arrow>
                <Chip
                  label={region.charAt(0).toUpperCase() + region.slice(1)}
                  onClick={() => setSelectedRegion(region)}
                  color={selectedRegion === region ? 'secondary' : 'default'}
                  variant={selectedRegion === region ? 'filled' : 'outlined'}
                  icon={<LocationOn />}
                />
              </Tooltip>
            ))}
          </Stack>
        </CardContent>
      </Card>

      {/* Google Trends Data */}
      <Grid container spacing={3}>
        {/* Trending Keywords */}
        <Grid item >
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb:  2 }}>
                <Typography variant="h6" component="h3" sx={{ color: theming.colors.primary, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Whatshot aria-hidden="true" />
                  Trending Keywords
                </Typography>
                <Tooltip title="Refresh trend data" arrow>
                  <IconButton onClick={loadTrendsForProfession} disabled={isLoading} aria-label="Oppdater trenddata">
                    <Refresh />
                  </IconButton>
                </Tooltip>
              </Box>
              
              {isLoading ? (
                <AdminLoading />
              ) : (
                <List dense>
                  {getTrendingKeywords(selectedProfession).map((keyword: any, index: number) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        {getTrendIcon(keyword.trend)}
                      </ListItemIcon>
                      <ListItemText
                        primary={keyword.keyword}
                        secondary={`${keyword.searchVolume} searches • ${keyword.opportunity} opportunity`}
                      />
                      <Chip
                        label={keyword.competition}
                        size="small"
                        color={keyword.competition === 'low' ? 'success' : keyword.competition === 'medium' ? 'warning' : 'error'}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* SEO Insights */}
        <Grid item >
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" component="h3" gutterBottom sx={{ color: theming.colors.primary, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Analytics aria-hidden="true" />
                SEO Insights
              </Typography>
              
              {getSEOInsights(selectedProfession) ? (
                <Box>
                  <Paper sx={{ p: 2, mb: 2, bgcolor: 'grey.50',  ...theming.getThemedCardSx() }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Market Overview
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item >
                        <Typography variant="body2" color="text.secondary">
                          Total Search Volume
                        </Typography>
                        <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                          {getSEOInsights(selectedProfession)?.searchVolume.toLocaleString()}
                        </Typography>
                      </Grid>
                      <Grid item >
                        <Typography variant="body2" color="text.secondary">
                          Trend Direction
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                          {getTrendIcon(getSEOInsights(selectedProfession)?.trend)}
                          <Typography variant="body2">
                            {getSEOInsights(selectedProfession)?.trend}
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>
                  </Paper>

                  <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                    <Tooltip title="Market opportunity level based on competition and demand" arrow>
                      <Chip
                        icon={<Star />}
                        label={`Opportunity: ${getSEOInsights(selectedProfession)?.opportunity}`}
                        color={getOpportunityColor(getSEOInsights(selectedProfession)?.opportunity || 'medium')}
                        size="small"
                      />
                    </Tooltip>
                    <Tooltip title="Peak season for this profession" arrow>
                      <Chip
                        icon={<Schedule />}
                        label={getSEOInsights(selectedProfession)?.seasonality}
                        size="small"
                      />
                    </Tooltip>
                  </Box>

                  <Tooltip title="Apply top 3 SEO optimizations automatically" arrow placement="top">
                    <AdminButton tone="primary"
                      startIcon={<AutoFixHigh />}
                      onClick={handleApplySEOFixes}
                      fullWidth
                     sx={theming.getThemedButtonSx()}>
                      Apply SEO Fixes
                    </AdminButton>
                  </Tooltip>
                </Box>
              ) : (
                <Alert severity="info">
                  No SEO insights available. Click refresh to load trends data.
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* SEO Suggestions */}
        <Grid item >
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" component="h3" gutterBottom sx={{ color: theming.colors.primary, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Lightbulb aria-hidden="true" />
                SEO Suggestions
              </Typography>
              
              {getSEOSuggestions(selectedProfession).length > 0 ? (
                <List>
                  {getSEOSuggestions(selectedProfession).map((suggestion: any, index: number) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <CheckCircle color="success" />
                      </ListItemIcon>
                      <ListItemText
                        primary={suggestion.title}
                        secondary={suggestion.description}
                      />
                      <Chip
                        label={suggestion.category}
                        size="small"
                        color="primary"
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Alert severity="info">
                  No SEO suggestions available. Load trends data to see suggestions.
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Divider sx={{ my: 3 }} />

      {/* Integration Details */}
      <Card sx={{ mt:  3 ,  ...theming.getThemedCardSx() }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Typography variant="h6" component="h3" gutterBottom sx={{ color: theming.colors.primary, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Build aria-hidden="true" />
            How the Integration Works
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Grid container spacing={2}>
            <Grid item >
              <Typography variant="subtitle2" gutterBottom>
                useDynamicProfessions Hook
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemIcon><CheckCircle color="success" /></ListItemIcon>
                  <ListItemText primary="Manages profession configurations" />
                </ListItem>
                <ListItem>
                  <ListItemIcon><CheckCircle color="success" /></ListItemIcon>
                  <ListItemText primary="Loads Google Trends data per profession" />
                </ListItem>
                <ListItem>
                  <ListItemIcon><CheckCircle color="success" /></ListItemIcon>
                  <ListItemText primary="Generates SEO suggestions automatically" />
                </ListItem>
                <ListItem>
                  <ListItemIcon><CheckCircle color="success" /></ListItemIcon>
                  <ListItemText primary="Provides one-click SEO fixes" />
                </ListItem>
              </List>
            </Grid>
            <Grid item >
              <Typography variant="subtitle2" gutterBottom>
                Connected Components
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemIcon><CheckCircle color="success" /></ListItemIcon>
                  <ListItemText primary="SmartWorkflowSystem" />
                </ListItem>
                <ListItem>
                  <ListItemIcon><CheckCircle color="success" /></ListItemIcon>
                  <ListItemText primary="UniversalCommunicationHub" />
                </ListItem>
                <ListItem>
                  <ListItemIcon><CheckCircle color="success" /></ListItemIcon>
                  <ListItemText primary="ProfessionAdapter" />
                </ListItem>
                <ListItem>
                  <ListItemIcon><CheckCircle color="success" /></ListItemIcon>
                  <ListItemText primary="Project Creation Forms" />
                </ListItem>
              </List>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Footer */}
      {lastUpdate && (
        <Box sx={{ mt:  3, textAlign: 'center'}}>
          <Typography variant="body2" color="text.secondary">
            Last updated: {lastUpdate.toLocaleString()}
          </Typography>
        </Box>
      )}

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
