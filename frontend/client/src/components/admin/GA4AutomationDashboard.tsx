/**
 * GA4 Automation Dashboard Component
 * Complete automation control and configuration
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/queryClient';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  Switch,
  FormControlLabel,
  Alert,
  LinearProgress,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  Settings,
  PlayArrow,
  Stop,
  CheckCircle,
  Error,
  Warning,
  Info,
  Refresh,
  CloudUpload as Deploy,
  Insights,
  Timeline,
  AutoAwesome,
  Speed as Speed,
  Security,
  Analytics,
} from '@mui/icons-material';

interface AutomationStatus {
  gtm: {
    containerId: string;
    name: string;
    publicId: string;
    status: string;
  };
  insights: {
    total: number;
    active: number;
    triggered: number;
  };
  measurementProtocol: {
    status: string;
    eventsSupported: string[];
  };
}

export default function GA4AutomationDashboard() {
  const queryClient = useQueryClient();
  const { auth } = useEnhancedMasterIntegration();

  // State
  const [setupDialogOpen, setSetupDialogOpen] = useState(false);
  const [customInsightDialogOpen, setCustomInsightDialogOpen] = useState(false);
  const [monthlyReportDialogOpen, setMonthlyReportDialogOpen] = useState(false);
  const [adminEmail, setAdminEmail] = useState('daniel@creatorhubn.com, ');

  // Custom insight form state
  const [customInsight, setCustomInsight] = useState({
    name: ',',
    metric: ', ',
    operator: 'LESS_THAN',
    value: ', ',
    comparisonPeriod: 'PREVIOUS_WEEK'
  });

  // Monthly report form state
  const [reportParams, setReportParams] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    email: 'daniel@creatorhubn.com'
  });

  // Fetch automation status
  const { data: statusData, isLoading: statusLoading, refetch: refetchStatus } = useQuery({
    queryKey: ['/api/ga4/automation/status'],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/ga4/automation/status', { headers });
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Setup automation mutation
  const setupMutation = useMutation({
    mutationFn: async (email: string) => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/ga4/automation/setup', {
        method: 'POST',
        headers: {
          ...headers, 'Content-Type' : 'application/json'
        },
        body: JSON.stringify({ adminEmail: email })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ga4/automation/status'] });
      setSetupDialogOpen(false);
    }
  });

  // Deploy GTM mutation
  const deployMutation = useMutation({
    mutationFn: async (versionName?: string) => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/ga4/gtm/deploy', {
        method: 'POST',
        headers: {
          ...headers, 'Content-Type' : 'application/json'
        },
        body: JSON.stringify({ versionName })
      });
    },
    onSuccess: () => {
      refetchStatus();
    }
  });

  // Create custom insight mutation
  const createInsightMutation = useMutation({
    mutationFn: async (insight: any) => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/ga4/insights/create', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(insight)
      });
    },
    onSuccess: () => {
      setCustomInsightDialogOpen(false);
      refetchStatus();
    }
  });

  // Send monthly report mutation
  const monthlyReportMutation = useMutation({
    mutationFn: async (params: any) => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/ga4/reports/monthly/send', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(params)
      });
    },
    onSuccess: () => {
      setMonthlyReportDialogOpen(false);
    }
  });

  const status: AutomationStatus = statusData?.data || {
    gtm: { containerId: ', ', name: ', ', publicId: ', ', status: 'inactive' },
    insights: { total: 0, active: 0, triggered: 0 },
    measurementProtocol: { status: 'inactive', eventsSupported: [] }
  };

  const handleSetupAutomation = () => {
    setupMutation.mutate(adminEmail);
  };

  const handleDeployGTM = () => {
    deployMutation.mutate(`Manual Deploy - ${new Date().toISOString()}`);
  };

  const handleCreateCustomInsight = () => {
    createInsightMutation.mutate({
      ...customInsight,
      value: parseFloat(customInsight.value)
    });
  };

  const handleSendMonthlyReport = () => {
    monthlyReportMutation.mutate(reportParams);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return '#4caf50';
      case 'inactive': return '#f44336';
      case 'error': return '#ff9800';
      default: return '#9e9e9e';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return <CheckCircle />;
      case 'inactive': return <Error />;
      case 'error': return <Warning />;
      default: return <Info />;
    }
  };

  return (
    <Box sx={{ mb: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Settings sx={{ color: '#ff6b35', fontSize: 32 }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#ffffff' }}>
              GA4 Automation Dashboard
            </Typography>
            <Typography variant="body2" sx={{ color: '#ffa726' }}>
              Complete automation control and configuration
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            startIcon={<PlayArrow />}
            onClick={() => setSetupDialogOpen(true)}
            sx={{ 
              background: 'linear-gradient(135deg, #ff6b35 0%, #ffa726 100%)', '&:hover': { background: '#ff6b35' }
            }}
          >
            Setup Automation
          </Button>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={() => refetchStatus()}
            disabled={statusLoading}
            sx={{ 
              borderColor: '#ff6b35', 
              color: '#ff6b35','&:hover': { borderColor: '#ffa726' }
            }}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Status Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <Card sx={{ 
            background: '#2d2d2d',
            border: '1px solid #404040'
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Analytics sx={{ color: getStatusColor(status.gtm.status) }} />
                <Typography variant="h6" sx={{ color: '#ffffff' }}>
                  Google Tag Manager
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ color: '#ffa726', mb: 1 }}>
                Container: {status.gtm.publicId || 'Not configured'}
              </Typography>
              <Typography variant="body2" sx={{ color: '#ffa726', mb: 2 }}>
                Status: {status.gtm.status}
              </Typography>
              <Button
                variant="outlined"
                size="small"
                startIcon={<Deploy />}
                onClick={handleDeployGTM}
                disabled={deployMutation.isPending || status.gtm.status !== 'active'}
                sx={{ 
                  borderColor: '#ff6b35', 
                  color: '#ff6b35','&:hover': { borderColor: '#ffa726' }
                }}
              >
                Deploy Changes
              </Button>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ 
            background: '#2d2d2d',
            border: '1px solid #404040'
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Insights sx={{ color: getStatusColor('active') }} />
                <Typography variant="h6" sx={{ color: '#ffffff' }}>
                  Custom Insights
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ color: '#ffa726', mb: 1 }}>
                Total: {status.insights.total}
              </Typography>
              <Typography variant="body2" sx={{ color: '#ffa726', mb: 2 }}>
                Active: {status.insights.active} | Triggered: {status.insights.triggered}
              </Typography>
              <Button
                variant="outlined"
                size="small"
                startIcon={<AutoAwesome />}
                onClick={() => setCustomInsightDialogOpen(true)}
                sx={{ 
                  borderColor: '#ff6b35', 
                  color: '#ff6b35','&:hover': { borderColor: '#ffa726' }
                }}
              >
                Create Insight
              </Button>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ 
            background: '#2d2d2d',
            border: '1px solid #404040'
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Speed sx={{ color: getStatusColor(status.measurementProtocol.status) }} />
                <Typography variant="h6" sx={{ color: '#ffffff' }}>
                  Measurement Protocol
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ color: '#ffa726', mb: 1 }}>
                Status: {status.measurementProtocol.status}
              </Typography>
              <Typography variant="body2" sx={{ color: '#ffa726', mb: 2 }}>
                Events: {status.measurementProtocol.eventsSupported.length}
              </Typography>
              <Button
                variant="outlined"
                size="small"
                startIcon={<Timeline />}
                onClick={() => setMonthlyReportDialogOpen(true)}
                sx={{ 
                  borderColor: '#ff6b35', 
                  color: '#ff6b35','&:hover': { borderColor: '#ffa726' }
                }}
              >
                Monthly Report
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Supported Events */}
      <Card sx={{ 
        background: '#2d2d2d',
        border: '1px solid #404040',
        mb: 3
      }}>
        <CardContent>
          <Typography variant="h6" sx={{ 
            fontWeight: 600, 
            color: '#ffffff',
            mb: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 1
          }}>
            <Security sx={{ color: '#ff6b35' }} />
            Supported Events
          </Typography>
          <Grid container spacing={1}>
            {status.measurementProtocol.eventsSupported.map((event, index) => (
              <Grid item key={index}>
                <Chip
                  label={event.replace('_', ', ')}
                  size="small"
                  sx={{ 
                    backgroundColor: '#ff6b35',
                    color: '#ffffff','&:hover': { backgroundColor: '#ffa726' }
                  }}
                />
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      {/* Setup Dialog */}
      <Dialog open={setupDialogOpen} onClose={() => setSetupDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ color: '#ffffff', backgroundColor: '#2d2d2d' }}>
          Setup GA4 Automation
        </DialogTitle>
        <DialogContent sx={{ backgroundColor: '#2d2d2d' }}>
          <TextField
            fullWidth
            label="Admin Email"
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
            sx={{ mt: 2 }}
            InputProps={{ sx: { color: '#ffffff' } }}
            InputLabelProps={{ sx: { color: '#ffa726' } }}
          />
          <Alert severity="info" sx={{ mt: 2, backgroundColor: '#1a1a1a' }}>
            This will set up complete GA4 automation including GTM tags, custom insights, and measurement protocol.
          </Alert>
          {setupMutation.isPending && (
            <Box sx={{ mt: 2 }}>
              <LinearProgress />
              <Typography variant="body2" sx={{ color: '#ffa726', mt: 1 }}>
                Setting up automation...
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ backgroundColor: '#2d2d2d' }}>
          <Button onClick={() => setSetupDialogOpen(false)} sx={{ color: '#ffa726' }}>
            Cancel
          </Button>
          <Button 
            onClick={handleSetupAutomation}
            disabled={setupMutation.isPending}
            sx={{ 
              backgroundColor: '#ff6b35',
              color: '#ffffff',
              '&:hover': { backgroundColor: '#ffa726' }
            }}
          >
            Setup
          </Button>
        </DialogActions>
      </Dialog>

      {/* Custom Insight Dialog */}
      <Dialog open={customInsightDialogOpen} onClose={() => setCustomInsightDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ color: '#ffffff', backgroundColor: '#2d2d2d' }}>
          Create Custom Insight
        </DialogTitle>
        <DialogContent sx={{ backgroundColor: '#2d2d2d' }}>
          <TextField
            fullWidth
            label="Insight Name"
            value={customInsight.name}
            onChange={(e) => setCustomInsight({ ...customInsight, name: e.target.value })}
            sx={{ mt: 2 }}
            InputProps={{ sx: { color: '#ffffff' } }}
            InputLabelProps={{ sx: { color: '#ffa726' } }}
          />
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel sx={{ color: '#ffa726' }}>Metric</InputLabel>
            <Select
              value={customInsight.metric}
              onChange={(e) => setCustomInsight({ ...customInsight, metric: e.target.value })}
              sx={{ color: '#ffffff' }}
            >
              <MenuItem value="totalUsers">Total Users</MenuItem>
              <MenuItem value="totalRevenue">Total Revenue</MenuItem>
              <MenuItem value="conversions">Conversions</MenuItem>
              <MenuItem value="bounceRate">Bounce Rate</MenuItem>
              <MenuItem value="sessions">Sessions</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel sx={{ color: '#ffa726' }}>Operator</InputLabel>
            <Select
              value={customInsight.operator}
              onChange={(e) => setCustomInsight({ ...customInsight, operator: e.target.value })}
              sx={{ color: '#ffffff' }}
            >
              <MenuItem value="GREATER_THAN">Greater Than</MenuItem>
              <MenuItem value="LESS_THAN">Less Than</MenuItem>
              <MenuItem value="EQUALS">Equals</MenuItem>
            </Select>
          </FormControl>
          <TextField
            fullWidth
            label="Threshold Value"
            type="number"
            value={customInsight.value}
            onChange={(e) => setCustomInsight({ ...customInsight, value: e.target.value })}
            sx={{ mt: 2 }}
            InputProps={{ sx: { color: '#ffffff' } }}
            InputLabelProps={{ sx: { color: '#ffa726' } }}
          />
        </DialogContent>
        <DialogActions sx={{ backgroundColor: '#2d2d2d' }}>
          <Button onClick={() => setCustomInsightDialogOpen(false)} sx={{ color: '#ffa726' }}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreateCustomInsight}
            disabled={createInsightMutation.isPending}
            sx={{ 
              backgroundColor: '#ff6b35',
              color: '#ffffff', '&:hover': { backgroundColor: '#ffa726' }
            }}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Monthly Report Dialog */}
      <Dialog open={monthlyReportDialogOpen} onClose={() => setMonthlyReportDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ color: '#ffffff', backgroundColor: '#2d2d2d' }}>
          Generate Monthly Report
        </DialogTitle>
        <DialogContent sx={{ backgroundColor: '#2d2d2d' }}>
          <TextField
            fullWidth
            label="Year"
            type="number"
            value={reportParams.year}
            onChange={(e) => setReportParams({ ...reportParams, year: parseInt(e.target.value) })}
            sx={{ mt: 2 }}
            InputProps={{ sx: { color: '#ffffff' } }}
            InputLabelProps={{ sx: { color: '#ffa726' } }}
          />
          <TextField
            fullWidth
            label="Month"
            type="number"
            inputProps={{ min: 1, max: 12 }}
            value={reportParams.month}
            onChange={(e) => setReportParams({ ...reportParams, month: parseInt(e.target.value) })}
            sx={{ mt: 2 }}
            InputProps={{ sx: { color: '#ffffff' } }}
            InputLabelProps={{ sx: { color: '#ffa726' } }}
          />
          <TextField
            fullWidth
            label="Email"
            value={reportParams.email}
            onChange={(e) => setReportParams({ ...reportParams, email: e.target.value })}
            sx={{ mt: 2 }}
            InputProps={{ sx: { color: '#ffffff' } }}
            InputLabelProps={{ sx: { color: '#ffa726' } }}
          />
        </DialogContent>
        <DialogActions sx={{ backgroundColor: '#2d2d2d' }}>
          <Button onClick={() => setMonthlyReportDialogOpen(false)} sx={{ color: '#ffa726' }}>
            Cancel
          </Button>
          <Button 
            onClick={handleSendMonthlyReport}
            disabled={monthlyReportMutation.isPending}
            sx={{ 
              backgroundColor: '#ff6b35',
              color: '#ffffff',
              '&:hover': { backgroundColor: '#ffa726' }
            }}
          >
            Generate & Send
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
