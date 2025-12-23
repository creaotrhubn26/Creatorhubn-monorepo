import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Chip,
  Stack,
  LinearProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Paper,
  IconButton,
  Tooltip,
  Badge,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField
} from '@mui/material';
import {
  Science,
  BugReport,
  ThumbsUpDown,
  DataObject,
  Analytics,
  CheckCircle,
  Assignment,
  EmojiEvents,
  TrendingUp,
  Info,
  Warning,
  Error as ErrorIcon,
  Refresh
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '@/utils/theming-helper';

interface Mission {
  id: string;
  type: string;
  title: string;
  description: string;
  role: string;
  points: number;
  status: 'active' | 'completed' | 'failed';
  progress?: number;
}

interface TesterStats {
  bugsReported: number;
  featuresTested: number;
  missionsCompleted: number;
  dicePoints: number;
  testingHours: number;
  professionsAccessed: string[];
}

export default function PrototypeTesterDashboard() {
  const { features, auth, analytics } = useEnhancedMasterIntegration();
  const theming = useTheming('prototype_tester');
  const queryClient = useQueryClient();
  
  // State
  const [showBugReportDialog, setShowBugReportDialog] = useState(false);
  const [showTestDataDialog, setShowTestDataDialog] = useState(false);
  const [bugReport, setBugReport] = useState({ title: ',', description: ', ', severity: 'medium' });
  
  // Get assigned profession from user profile
  // Prototype testers are assigned ONE specific profession to test
  const assignedProfession = auth.state.user?.assignedProfession || auth.state.user?.profession || 'photographer';
  
  // Fetch assigned profession details
  const { data: professionConfig, isLoading: professionLoading } = useQuery({
    queryKey: ['/api/professions/', assignedProfession'/dashboard-config'],
    queryFn: () => apiRequest(`/api/professions/${assignedProfession}/dashboard-config`),
    staleTime: 5 * 60 * 1000,
  });
  
  // Fetch active missions
  const { data: missions, isLoading: missionsLoading } = useQuery({
    queryKey: ['/api/prototype-tester/missions'],
    queryFn: () => apiRequest('/api/prototype-tester/missions'),
    staleTime: 2 * 60 * 1000,
  });
  
  // Fetch tester stats
  const { data: stats, isLoading: statsLoading } = useQuery<TesterStats>({
    queryKey: ['/api/prototype-tester/stats'],
    queryFn: () => apiRequest('/api/prototype-tester/stats'),
    staleTime: 1 * 60 * 1000,
  });
  
  // Submit bug report
  const submitBugReportMutation = useMutation({
    mutationFn: async (report: any) => {
      return apiRequest('/api/prototype-tester/bug-report', {
        method: 'POST',
        body: JSON.stringify({ ...report, profession: assignedProfession })
      });
    },
    onSuccess: () => {
      setShowBugReportDialog(false);
      setBugReport({ title: ', ', description: ', ', severity: 'medium' });
      queryClient.invalidateQueries({ queryKey: ['/api/prototype-tester/stats'] });
    }
  });
  
  // Generate test data
  const generateTestDataMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/prototype-tester/generate-test-data', {
        method: 'POST',
        body: JSON.stringify({ profession: assignedProfession })
      });
    },
    onSuccess: () => {
      setShowTestDataDialog(false);
      queryClient.invalidateQueries();
    }
  });
  
  // Check feature access
  const testDataAccess = features.checkFeatureAccess('test-data-generator');
  const testerToolsAccess = features.checkFeatureAccess('prototype-tester-tools');
  const bugReportingAccess = features.checkFeatureAccess('bug-reporting');
  const featureVotingAccess = features.checkFeatureAccess('feature-voting');
  const betaAccess = features.checkFeatureAccess('beta-features-access');
  
  if (!auth.state.isAuthenticated || auth.state.user?.role !== 'prototype_tester') {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error">
          Prototype Tester access required. Please contact an administrator.
        </Alert>
      </Container>
    );
  }
  
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
          <Science sx={{ fontSize: 40, color: '#e65100' }} />
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#1f2937' }}>
              Prototype Testing Dashboard
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Velkommen, {auth.state.user?.email || 'Tester'}!
            </Typography>
          </Box>
        </Stack>
        
        <Alert severity="info" sx={{ mt: 2 }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="body2">
              Du tester: <strong>{professionConfig?.dashboardConfig?.displayName || assignedProfession}</strong>
            </Typography>
            <Chip 
              label={assignedProfession} 
              color="primary" 
              size="small"
              icon={<Science />}
            />
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Bruk verktøyene nedenfor for å teste funksjoner, rapportere bugs, og fullføre oppdrag for denne profesjonen.
          </Typography>
        </Alert>
      </Box>
      
      {/* Stats Row */}
      {stats && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: '#f44336', color: 'white' }}>
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center">
                  <BugReport sx={{ fontSize: 40 }} />
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                      {stats.bugsReported || 0}
                    </Typography>
                    <Typography variant="body2">Bugs Reported</Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: '#2196f3', color: 'white' }}>
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center">
                  <CheckCircle sx={{ fontSize: 40 }} />
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                      {stats.featuresTested || 0}
                    </Typography>
                    <Typography variant="body2">Features Tested</Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: '#4caf50', color: 'white' }}>
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Assignment sx={{ fontSize: 40 }} />
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                      {stats.missionsCompleted || 0}
                    </Typography>
                    <Typography variant="body2">Missions Complete</Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: '#ff9800', color: 'white' }}>
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center">
                  <EmojiEvents sx={{ fontSize: 40 }} />
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                      {stats.dicePoints || 0}
                    </Typography>
                    <Typography variant="body2">Dice Points</Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
      
      {/* Assigned Profession Details */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
            <Info color="primary" />
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              Your Assigned Profession
            </Typography>
          </Stack>
          
          {professionLoading ? (
            <LinearProgress />
          ) : professionConfig ? (
            <Box>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                <Avatar 
                  sx={{ 
                    bgcolor: professionConfig.dashboardConfig?.color || '#2196f3', 
                    width: 56, 
                    height: 56 }}
                >
                  <Science sx={{ fontSize: 32 }} />
                </Avatar>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                    {professionConfig.dashboardConfig?.displayName || assignedProfession}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {professionConfig.dashboardConfig?.description || 'Test all features for this profession'}
                  </Typography>
                </Box>
              </Stack>
              
              <Divider sx={{ my: 2 }} />
              
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                Testing Scope:
              </Typography>
              <Grid container spacing={1}>
                {professionConfig.tabs && professionConfig.tabs.length > 0 && (
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">
                      <strong>{professionConfig.tabs.length} Tabs</strong> to test
                    </Typography>
                  </Grid>
                )}
                {professionConfig.projectTypes && professionConfig.projectTypes.length > 0 && (
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">
                      <strong>{professionConfig.projectTypes.length} Project Types</strong> to validate
                    </Typography>
                  </Grid>
                )}
                {professionConfig.stats && professionConfig.stats.length > 0 && (
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">
                      <strong>{professionConfig.stats.length} Stats</strong> to verify
                    </Typography>
                  </Grid>
                )}
              </Grid>
            </Box>
          ) : (
            <Alert severity="warning">
              Could not load profession configuration. Contact administrator.
            </Alert>
          )}
        </CardContent>
      </Card>
      
      {/* Active Missions */}
      {testerToolsAccess.hasAccess && (
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
              <Assignment color="primary" />
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                Active Testing Missions
              </Typography>
              <Badge badgeContent={missions?.missions?.filter((m: Mission) => m.status === 'active').length || 0} color="primary">
                <></>
              </Badge>
            </Stack>
            
            {missionsLoading ? (
              <LinearProgress />
            ) : missions?.missions && missions.missions.length > 0 ? (
              <Stack spacing={2}>
                {missions.missions.filter((m: Mission) => m.status === 'active').map((mission: Mission) => (
                  <Paper key={mission.id} sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
                    <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                          {mission.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {mission.description}
                        </Typography>
                        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                          <Chip label={`${mission.points} points`} size="small" color="primary" />
                          <Chip label={mission.role} size="small" variant="outlined" />
                        </Stack>
                      </Box>
                      
                      {mission.progress !== undefined && (
                        <Box sx={{ width: 100 }}>
                          <LinearProgress 
                            variant="determinate" 
                            value={mission.progress} 
                            sx={{ mb: 0.5 }}
                          />
                          <Typography variant="caption" color="text.secondary">
                            {mission.progress}% Complete
                          </Typography>
                        </Box>
                      )}
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            ) : (
              <Alert severity="info">
                Ingen aktive testing oppdrag for øyeblikket. Sjekk tilbake senere!
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
      
      {/* Testing Tools */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 3 }}>
            Testing Tools
          </Typography>
          
          <Grid container spacing={2}>
            {/* Bug Reporting */}
            {bugReportingAccess.hasAccess && (
              <Grid item xs={12} sm={6} md={4}>
                <Card 
                  sx={{ 
                    p: 2, 
                    cursor: 'pointer',
                    border: '2px solid',
                    borderColor: 'transparent', '&:hover': {
                      borderColor: '#f44336',
                      bgcolor: 'rgba(2, 4, 4, 67, 54, 0.05)'
                    }
                  }}
                  onClick={() => setShowBugReportDialog(true)}
                >
                  <Stack spacing={1} alignItems="center">
                    <BugReport sx={{ fontSize: 48, color: '#f44336' }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                      Bug Reporting
                    </Typography>
                    <Typography variant="body2" color="text.secondary" textAlign="center">
                      Report bugs and issues you discover during testing
                    </Typography>
                    <Chip 
                      label={`${stats?.bugsReported || 0} reported`} 
                      size="small" 
                      color="error"
                      variant="outlined"
                    />
                  </Stack>
                </Card>
              </Grid>
            )}
            
            {/* Feature Voting */}
            {featureVotingAccess.hasAccess && (
              <Grid item xs={12} sm={6} md={4}>
                <Card 
                  sx={{ 
                    p: 2, 
                    cursor: 'pointer',
                    border: '2px solid',
                    borderColor: 'transparent','&:hover': {
                      borderColor: '#2196f3',
                      bgcolor: 'rgba(33, 150, 243, 0.05)'
                    }
                  }}
                  onClick={() => {
                    // Navigate to feature voting
                    analytics.trackEvent('prototype_tester_feature_voting_opened', {
                      profession: assignedProfession,
                      timestamp: Date.now()
                    });
                  }}
                >
                  <Stack spacing={1} alignItems="center">
                    <ThumbsUpDown sx={{ fontSize: 48, color: '#2196f3' }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                      Feature Voting
                    </Typography>
                    <Typography variant="body2" color="text.secondary" textAlign="center">
                      Vote on upcoming features and improvements
                    </Typography>
                    <Chip 
                      label="Vote Now" 
                      size="small" 
                      color="primary"
                      variant="outlined"
                    />
                  </Stack>
                </Card>
              </Grid>
            )}
            
            {/* Test Data Generator (Tester Only) */}
            {testDataAccess.hasAccess && (
              <Grid item xs={12} sm={6} md={4}>
                <Card 
                  sx={{ 
                    p: 2, 
                    cursor: 'pointer',
                    border: '2px solid',
                    borderColor: 'transparent','&:hover': {
                      borderColor: '#ff9800',
                      bgcolor: 'rgba(2, 5, 5, 152, 0, 0.05)'
                    }
                  }}
                  onClick={() => setShowTestDataDialog(true)}
                >
                  <Stack spacing={1} alignItems="center">
                    <DataObject sx={{ fontSize: 48, color: '#ff9800' }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                      Test Data Generator
                    </Typography>
                    <Typography variant="body2" color="text.secondary" textAlign="center">
                      Generate mock projects, clients, and files
                    </Typography>
                    <Chip 
                      label="Tester Only" 
                      size="small" 
                      color="warning"
                      icon={<Science sx={{ fontSize: 14 }} />}
                    />
                  </Stack>
                </Card>
              </Grid>
            )}
            
            {/* Analytics Dashboard (Tester Only) */}
            {testerToolsAccess.hasAccess && (
              <Grid item xs={12} sm={6} md={4}>
                <Card 
                  sx={{ 
                    p: 2, 
                    cursor: 'pointer',
                    border: '2px solid',
                    borderColor: 'transparent','&:hover': {
                      borderColor: '#4caf50',
                      bgcolor: 'rgba(76, 175, 80, 0.05)'
                    }
                  }}
                  onClick={() => {
                    analytics.trackEvent('prototype_tester_analytics_opened', {
                      profession: assignedProfession,
                      timestamp: Date.now()
                    });
                  }}
                >
                  <Stack spacing={1} alignItems="center">
                    <Analytics sx={{ fontSize: 48, color: '#4caf50' }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                      Testing Analytics
                    </Typography>
                    <Typography variant="body2" color="text.secondary" textAlign="center">
                      View testing metrics and performance data
                    </Typography>
                    <Chip 
                      label="Tester Only" 
                      size="small" 
                      color="success"
                      icon={<Science sx={{ fontSize: 14 }} />}
                    />
                  </Stack>
                </Card>
              </Grid>
            )}
            
            {/* Beta Features Access */}
            {betaAccess.hasAccess && (
              <Grid item xs={12} sm={6} md={4}>
                <Card 
                  sx={{ 
                    p: 2, 
                    cursor: 'pointer',
                    border: '2px solid',
                    borderColor: 'transparent', '&:hover': {
                      borderColor: '#9c27b0',
                      bgcolor: 'rgba(1, 5, 6, 39, 176, 0.05)'
                    }
                  }}
                >
                  <Stack spacing={1} alignItems="center">
                    <TrendingUp sx={{ fontSize: 48, color: '#9c27b0' }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                      Beta Features
                    </Typography>
                    <Typography variant="body2" color="text.secondary" textAlign="center">
                      Access and test beta features before release
                    </Typography>
                    <Chip 
                      label="Early Access" 
                      size="small" 
                      color="secondary"
                    />
                  </Stack>
                </Card>
              </Grid>
            )}
          </Grid>
        </Card>
      )}
      
      {/* Bug Report Dialog */}
      <Dialog 
        open={showBugReportDialog} 
        onClose={() => setShowBugReportDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" spacing={2} alignItems="center">
            <BugReport color="error" />
            <Typography variant="h6">Report a Bug</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            <TextField
              label="Bug Title"
              value={bugReport.title}
              onChange={(e) => setBugReport({ ...bugReport, title: e.target.value })}
              fullWidth
              required
            />
            
            <TextField
              label="Description"
              value={bugReport.description}
              onChange={(e) => setBugReport({ ...bugReport, description: e.target.value })}
              multiline
              rows={4}
              fullWidth
              required
            />
            
            <TextField
              label="Severity"
              select
              value={bugReport.severity}
              onChange={(e) => setBugReport({ ...bugReport, severity: e.target.value })}
              fullWidth
              SelectProps={{ native: true }}
            >
              <option value="low">Low - Minor issue</option>
              <option value="medium">Medium - Noticeable issue</option>
              <option value="high">High - Significant issue</option>
              <option value="critical">Critical - Blocking issue</option>
            </TextField>
            
            <Alert severity="info" icon={<Info />}>
              <Typography variant="body2">
                Profession: <strong>{assignedProfession}</strong>
              </Typography>
              <Typography variant="caption">
                This bug will be tagged with your assigned profession
              </Typography>
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowBugReportDialog(false)}>
            Cancel
          </Button>
          <Button 
            variant="contained"
            color="error"
            onClick={() => submitBugReportMutation.mutate(bugReport)}
            disabled={!bugReport.title || !bugReport.description || submitBugReportMutation.isPending}
            startIcon={<BugReport />}
          >
            Submit Bug Report
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Test Data Generator Dialog */}
      <Dialog 
        open={showTestDataDialog} 
        onClose={() => setShowTestDataDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" spacing={2} alignItems="center">
            <DataObject color="warning" />
            <Typography variant="h6">Generate Test Data</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            <Alert severity="info">
              This will generate mock data for the <strong>{assignedProfession}</strong> profession:
              <List dense sx={{ mt: 1 }}>
                <ListItem>
                  <ListItemIcon><CheckCircle color="success" sx={{ fontSize: 20 }} /></ListItemIcon>
                  <ListItemText primary="5 mock clients with realistic data" />
                </ListItem>
                <ListItem>
                  <ListItemIcon><CheckCircle color="success" sx={{ fontSize: 20 }} /></ListItemIcon>
                  <ListItemText primary="10 mock projects with different statuses" />
                </ListItem>
                <ListItem>
                  <ListItemIcon><CheckCircle color="success" sx={{ fontSize: 20 }} /></ListItemIcon>
                  <ListItemText primary="Sample files and media" />
                </ListItem>
                <ListItem>
                  <ListItemIcon><CheckCircle color="success" sx={{ fontSize: 20 }} /></ListItemIcon>
                  <ListItemText primary="Timeline events and milestones" />
                </ListItem>
              </List>
            </Alert>
            
            <Alert severity="warning">
              <Typography variant="body2" sx={{ fontWeight: 600}}>
                Testing Data Only
              </Typography>
              <Typography variant="caption">
                Generated data is marked as test data and can be easily cleaned up
              </Typography>
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowTestDataDialog(false)}>
            Cancel
          </Button>
          <Button 
            variant="contained"
            color="warning"
            onClick={() => generateTestDataMutation.mutate()}
            disabled={generateTestDataMutation.isPending}
            startIcon={<DataObject />}
          >
            Generate Test Data
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

