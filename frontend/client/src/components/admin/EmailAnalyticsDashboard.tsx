/**
 * Email Analytics Dashboard
 * - Track email open rates
 * - Track link clicks in emails
 * - A/B test email templates
 * - Email performance metrics
 * - Conversion tracking
 */

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Stack,
  Chip,
  IconButton,
  Button,
  Divider,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  ToggleButtonGroup,
  ToggleButton,
  CircularProgress,
} from '@mui/material';
import {
  Email,
  OpenInNew,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  ErrorOutline,
  Refresh,
  Science,
  Link as LinkIcon,
  BarChart,
  CompareArrows,
  Visibility,
  Mouse,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useTheming } from '@/utils/theming-helper';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';

interface EmailCampaign {
  id: string;
  name: string;
  subject: string;
  template: string;
  sentCount: number;
  openCount: number;
  clickCount: number;
  openRate: number;
  clickRate: number;
  conversionRate: number;
  sentAt: string;
  isABTest: boolean;
  variantA?: EmailVariant;
  variantB?: EmailVariant;
}

interface EmailVariant {
  id: string;
  name: string;
  sentCount: number;
  openCount: number;
  clickCount: number;
  conversionCount: number;
}

interface LinkAnalytics {
  url: string;
  clicks: number;
  uniqueClicks: number;
  clickRate: number;
}

export default function EmailAnalyticsDashboard() {
  const queryClient = useQueryClient();
  const { auth } = useEnhancedMasterIntegration();
  
  // Profession system hooks
  const { professionConfigs, getUserProfessionColor } = useDynamicProfessions();
  const { professionConfigs: apiProfessionConfigs } = useProfessionConfigs();
  const professionAdapter = useProfessionAdapter();
  const currentProfession = professionAdapter.profession || 'photographer';
  const professionIcon = getProfessionIcon(currentProfession);
  const professionConfig = professionConfigs?.[currentProfession];
  const enhancedProfessionConfig = apiProfessionConfigs?.[currentProfession] || professionConfig;
  const professionColor = getUserProfessionColor(currentProfession) || '#FF6B35';
  
  // Theming system - use dynamic profession
  const theming = useTheming(currentProfession);

  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<string>('7d');
  const [showABTestDialog, setShowABTestDialog] = useState(false);

  // Fetch email analytics
  const { data: analytics, isLoading } = useQuery({
    queryKey: ['/api/admin/email-analytics', { timeRange }],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest(`/api/admin/email-analytics?range=${timeRange}`, { headers });
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch campaigns
  const { data: campaigns = [] } = useQuery({
    queryKey: ['/api/admin/email-campaigns'],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/admin/email-campaigns', { headers });
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch link analytics for selected campaign
  const { data: linkAnalytics = [] } = useQuery({
    queryKey: ['/api/admin/email-link-analytics', selectedCampaign],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest(`/api/admin/email-link-analytics?campaignId=${selectedCampaign}`, { headers });
    },
    enabled: !!selectedCampaign,
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/admin/email-analytics'] });
    queryClient.invalidateQueries({ queryKey: ['/api/admin/email-campaigns'] });
  };

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          {professionIcon && (
            <Box sx={{ color: professionColor, display: 'flex', alignItems: 'center' }}>
              {professionIcon}
            </Box>
          )}
          <Email sx={{ fontSize: 32, color: '#ea4335' }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 600, color: theming.colors.primary }}>
              {enhancedProfessionConfig?.displayName || professionConfig?.displayName
                ? `${enhancedProfessionConfig?.displayName || professionConfig.displayName} - Email Analytics Dashboard`
                : 'Email Analytics Dashboard'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Track opens, clicks, conversions, and A/B test performance
            </Typography>
          </Box>
        </Stack>
        
        <Stack direction="row" spacing={1}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Time Range</InputLabel>
            <Select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              label="Time Range"
            >
              <MenuItem value="24h">Last 24h</MenuItem>
              <MenuItem value="7d">Last 7 days</MenuItem>
              <MenuItem value="30d">Last 30 days</MenuItem>
              <MenuItem value="90d">Last 90 days</MenuItem>
            </Select>
          </FormControl>
          
          <IconButton onClick={handleRefresh}>
            <Refresh />
          </IconButton>
        </Stack>
      </Stack>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {/* Overview Stats */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Stack spacing={1}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Typography variant="caption" color="text.secondary">
                        Emails Sent
                      </Typography>
                      <Email sx={{ color: '#2196f3', fontSize: 24 }} />
                    </Stack>
                    <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                      {analytics?.totalSent || 0}
                    </Typography>
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      <TrendingUp sx={{ fontSize: 16, color: 'success.main' }} />
                      <Typography variant="caption" color="success.main">
                        +{analytics?.sentGrowth || 0}% vs last period
                      </Typography>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Stack spacing={1}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Typography variant="caption" color="text.secondary">
                        Open Rate
                      </Typography>
                      <OpenInNew sx={{ color: '#4caf50', fontSize: 24 }} />
                    </Stack>
                    <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                      {analytics?.averageOpenRate || 0}%
                    </Typography>
                    <LinearProgress 
                      variant="determinate" 
                      value={analytics?.averageOpenRate || 0} 
                      sx={{ height: 6, borderRadius: 1 }}
                    />
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Stack spacing={1}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Typography variant="caption" color="text.secondary">
                        Click Rate
                      </Typography>
                      <Mouse sx={{ color: '#ff9800', fontSize: 24 }} />
                    </Stack>
                    <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                      {analytics?.averageClickRate || 0}%
                    </Typography>
                    <LinearProgress 
                      variant="determinate" 
                      value={analytics?.averageClickRate || 0} 
                      sx={{ height: 6, borderRadius: 1, '& .MuiLinearProgress-bar': { bgcolor: '#ff9800' } }}
                    />
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Stack spacing={1}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Typography variant="caption" color="text.secondary">
                        Conversion Rate
                      </Typography>
                      <CheckCircle sx={{ color: '#9c27b0', fontSize: 24 }} />
                    </Stack>
                    <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                      {analytics?.averageConversionRate || 0}%
                    </Typography>
                    <LinearProgress 
                      variant="determinate" 
                      value={analytics?.averageConversionRate || 0} 
                      sx={{ height: 6, borderRadius: 1, '& .MuiLinearProgress-bar': { bgcolor: '#9c27b0' } }}
                    />
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Campaign Performance Table */}
          <Card sx={{ mb: 4 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600}}>
                Campaign Performance
              </Typography>
              
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Campaign</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell align="right">Sent</TableCell>
                      <TableCell align="right">Opens</TableCell>
                      <TableCell align="right">Clicks</TableCell>
                      <TableCell align="right">Open Rate</TableCell>
                      <TableCell align="right">Click Rate</TableCell>
                      <TableCell align="right">Conversion</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {campaigns.map((campaign: EmailCampaign) => (
                      <TableRow key={campaign.id} hover>
                        <TableCell>
                          <Stack>
                            <Typography variant="body2" sx={{ fontWeight: 600}}>
                              {campaign.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {campaign.subject}
                            </Typography>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          {campaign.isABTest ? (
                            <Chip 
                              icon={<Science />} 
                              label="A/B Test" 
                              size="small" 
                              color="secondary"
                            />
                          ) : (
                            <Chip label="Standard" size="small" variant="outlined" />
                          )}
                        </TableCell>
                        <TableCell align="right">{campaign.sentCount}</TableCell>
                        <TableCell align="right">{campaign.openCount}</TableCell>
                        <TableCell align="right">{campaign.clickCount}</TableCell>
                        <TableCell align="right">
                          <Chip 
                            label={`${campaign.openRate}%`}
                            size="small"
                            color={campaign.openRate > 30 ? 'success' : campaign.openRate > 15 ? 'warning' : 'error'}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Chip 
                            label={`${campaign.clickRate}%`}
                            size="small"
                            color={campaign.clickRate > 5 ? 'success' : campaign.clickRate > 2 ? 'warning' : 'error'}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Chip 
                            label={`${campaign.conversionRate}%`}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={1}>
                            <Tooltip title="View link analytics">
                              <IconButton 
                                size="small"
                                onClick={() => setSelectedCampaign(campaign.id)}
                              >
                                <BarChart fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            {campaign.isABTest && (
                              <Tooltip title="View A/B test results">
                                <IconButton size="small">
                                  <CompareArrows fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>

          {/* A/B Testing Section */}
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Science sx={{ color: '#9c27b0', fontSize: 28 }} />
                  <Typography variant="h6" sx={{ fontWeight: 600}}>
                    A/B Testing
                  </Typography>
                </Stack>
                <Button
                  variant="contained"
                  startIcon={<Science />}
                  onClick={() => setShowABTestDialog(true)}
                >
                  Create A/B Test
                </Button>
              </Stack>

              <Alert severity="info" sx={{ mb: 2 }}>
                Test different subject lines, content, or designs to optimize email performance
              </Alert>

              {/* Active A/B Tests */}
              <Grid container spacing={2}>
                {campaigns.filter((c: EmailCampaign) => c.isABTest).map((campaign: EmailCampaign) => (
                  <Grid item xs={12} md={6} key={campaign.id}>
                    <Paper variant="outlined" sx={{ p: 2 }}>
                      <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600}}>
                        {campaign.name}
                      </Typography>
                      
                      <Stack direction="row" spacing={2}>
                        {/* Variant A */}
                        <Box sx={{ flex: 1, p: 2, borderRadius: 1, bgcolor: 'success.light' }}>
                          <Typography variant="caption" color="success.dark" sx={{ fontWeight: 600}}>
                            VARIANT A {campaign.variantA && campaign.variantA.openCount > (campaign.variantB?.openCount || 0) && '(Winner)'}
                          </Typography>
                          <Typography variant="h6" sx={{ my: 1 }}>
                            {campaign.variantA?.openCount || 0} opens
                          </Typography>
                          <Typography variant="caption">
                            Open Rate: {((campaign.variantA?.openCount || 0) / (campaign.variantA?.sentCount || 1) * 100).toFixed(1)}%
                          </Typography>
                        </Box>
                        
                        <CompareArrows sx={{ alignSelf: 'center', color: 'text.secondary' }} />
                        
                        {/* Variant B */}
                        <Box sx={{ flex: 1, p: 2, borderRadius: 1, bgcolor: 'info.light' }}>
                          <Typography variant="caption" color="info.dark" sx={{ fontWeight: 600}}>
                            VARIANT B {campaign.variantB && campaign.variantB.openCount > (campaign.variantA?.openCount || 0) && '(Winner)'}
                          </Typography>
                          <Typography variant="h6" sx={{ my: 1 }}>
                            {campaign.variantB?.openCount || 0} opens
                          </Typography>
                          <Typography variant="caption">
                            Open Rate: {((campaign.variantB?.openCount || 0) / (campaign.variantB?.sentCount || 1) * 100).toFixed(1)}%
                          </Typography>
                        </Box>
                      </Stack>
                      
                      <Button
                        size="small"
                        fullWidth
                        sx={{ mt: 2 }}
                        onClick={() => setSelectedCampaign(campaign.id)}
                      >
                        View Detailed Results
                      </Button>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </>
      )}

      {/* Link Analytics Dialog */}
      <Dialog 
        open={!!selectedCampaign} 
        onClose={() => setSelectedCampaign(null)} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" spacing={2} alignItems="center">
            <LinkIcon />
            Link Analytics
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Track which links in your emails get the most clicks
          </Typography>
          
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Link URL</TableCell>
                  <TableCell align="right">Total Clicks</TableCell>
                  <TableCell align="right">Unique Clicks</TableCell>
                  <TableCell align="right">Click Rate</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {linkAnalytics.map((link: LinkAnalytics, index: number) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontSize: '0.875rem' }} noWrap>
                        {link.url.length > 50 ? link.url.substring(0, 50) + '...' : link.url}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">{link.clicks}</TableCell>
                    <TableCell align="right">{link.uniqueClicks}</TableCell>
                    <TableCell align="right">
                      <Chip 
                        label={`${link.clickRate}%`} 
                        size="small"
                        color={link.clickRate > 10 ? 'success' : 'default'}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {linkAnalytics.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} align="center">
                      <Typography variant="body2" color="text.secondary">
                        No link click data available
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedCampaign(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Create A/B Test Dialog */}
      <Dialog open={showABTestDialog} onClose={() => setShowABTestDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create A/B Test</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Test two email variations to see which performs better
          </Alert>
          
          <Typography variant="body2" color="text.secondary">
            A/B test feature coming soon! You'll be able to:
          </Typography>
          <ul>
            <li>Test different subject lines</li>
            <li>Test different email designs</li>
            <li>Test different CTAs</li>
            <li>Automatically select winner</li>
          </ul>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowABTestDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

