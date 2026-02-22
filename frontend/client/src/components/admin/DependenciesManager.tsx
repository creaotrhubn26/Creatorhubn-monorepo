import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Tabs,
  Tab,
  Alert,
  Chip,
  Button,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Badge,
  Switch,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  CircularProgress,
  Stack,
} from '@mui/material';
import {
  Update,
  Security,
  CheckCircle,
  Warning,
  Error,
  Refresh,
  Settings,
  GetApp,
  Launch,
  Code,
  Storage,
  Analytics,
  Visibility,
  SystemUpdate,
  BugReport,
  Shield,
  AutoFixHigh,
  MonitorHeart,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { getProfessionIcon } from '@/utils/profession-icons';

interface DependencyInfo {
  name: string;
  current: string;
  wanted: string;
  latest: string;
  isOutdated: boolean;
  category: 'core' | 'ui' | 'backend' | 'security' | 'analytics' | 'enhancement' | 'testing' | 'build';
  component: string;
  system: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  benefits: string[];
  risks: string[];
  initialized: boolean;
  lastChecked: Date;
  isSecurityUpdate: boolean;
  hasBreakingChanges: boolean; 
}

interface DependencyCategory {
  name: string;
  color: string;
  icon: React.ReactElement;
  description: string;
  count: number;
  outdatedCount: number;
  criticalCount: number; 
}

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
      id={`dependencies-tabpanel-${index}`}
      aria-labelledby={`dependencies-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export function DependenciesManager() {
  const [tabValue, setTabValue] = useState(0);
  const [autoScanEnabled, setAutoScanEnabled] = useState(true);
  const [selectedDependency, setSelectedDependency] = useState<DependencyInfo | null>(null);
  const [updateDialog, setUpdateDialog] = useState(false);
  const queryClient = useQueryClient();

  // Theming system
  const theming = useTheming('prototype_tester');

  // Get auth from master integration
  const { auth } = useEnhancedMasterIntegration();

  // Fetch dependencies data with real-time monitoring
  const { data: dependenciesData, isLoading, refetch } = useQuery({
    queryKey: ['/api/admin/dependencies-manager/status'],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/admin/dependencies-manager/status', { headers });
    },
    refetchInterval: autoScanEnabled ? 8000000 : false, // Auto-refresh every 30 seconds if enabled
});

  // Fetch compatibility matrix
  const { data: compatibilityData } = useQuery({
    queryKey: ['/api/admin/dependencies-manager/compatibility'],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/admin/dependencies-manager/compatibility', { headers });
    },
});

  // Fetch security vulnerabilities
  const { data: securityData } = useQuery({
    queryKey: ['/api/admin/dependencies-manager/security'],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/admin/dependencies-manager/security', { headers });
    },
});

  // Update dependency mutation
  const updateDependency = useMutation({
    mutationFn: async (data: { name: string; version: string; force?: boolean }) => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/admin/dependencies-manager/update', {
        headers: {
          ...headers,
          "Content-Type" : "application/json"
      },
        method: 'POST',
        body: JSON.stringify(data)
    });
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/dependencies-manager'] });
      setUpdateDialog(false);
  }
});

  // Force full scan mutation
  const forceScan = useMutation({
    mutationFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/admin/dependencies-manager/scan', {
        headers: {
          ...headers, "Content-Type" : "application/json"
      },
        method: 'POST'
    });
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/dependencies-manager'] });
  }
});

  const dependencies: DependencyInfo[] = dependenciesData?.dependencies || [];
  const categories: DependencyCategory[] = dependenciesData?.categories || [];

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'core': return <Code />;
      case 'ui': return getProfessionIcon('designer');
      case 'backend': return theming.getThemedIcon('storage');
      case 'security': return theming.getThemedIcon('security');
      case 'analytics': return theming.getThemedIcon('analytics');
      case 'enhancement': return theming.getThemedIcon('autoFixHigh');
      case 'testing': return <BugReport />;
      case 'build': return theming.getThemedIcon('settings');
      default: return <Code />;
  }
};

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return '#d32f2f';
      case 'high': return '#ff6f00';
      case 'medium': return '#f57c00';
      case 'low': return '#388e3c';
      default: return '#757575';
  }
};

  const getDependenciesByCategory = (categoryName: string) => {
    return dependencies.filter(dep => dep.category === categoryName);
};

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header with global controls */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ color: theming.colors.primary }}>
          Dependencies Manager
        </Typography>
        <Stack direction="row" spacing={2} alignItems="center">
          <FormControlLabel
            control={
              <Switch
                checked={autoScanEnabled}
                onChange={(e) => setAutoScanEnabled(e.target.checked)}
                color="primary"
              />
          }
            label="Auto-scanning"
          />
          <Button
            variant="outlined"
            startIcon={theming.getThemedIcon('refresh')}
            onClick={() => forceScan.mutate()}
            disabled={forceScan.isPending}
          >
            {forceScan.isPending ? 'Scanning...' : 'Force Scan'}
          </Button>
          <Button variant="contained"
            startIcon={<MonitorHeart />}
            onClick={() => refetch()}
            sx={{ bgcolor: '#ff8c00' }}
          >
            Refresh Status
          </Button>
        </Stack>
      </Box>

      {/* Global Status Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Card sx={{ bgcolor: '#e8f5e8', border: '1px solid #2e7d32', ...theming.getThemedCardSx() }}>
            <CardContent >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <CheckCircle sx={{ color: '#2e7d32', fontSize: 32 }} />
                <Box>
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                    {dependencies.filter(d => !d.isOutdated).length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Up to Date
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card sx={{ bgcolor: '#fff3e', border: '1px solid #ff6f00'}} >
            <CardContent >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Warning sx={{ color: '#ff6f00', fontSize: 32 }} />
                <Box>
                  <Typography variant="h6" sx={{ color: '#ff6f00' }}>
                    {dependencies.filter(d => d.isOutdated).length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Outdated
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card sx={{ bgcolor: '#ffebee', border: '1px solid #d32f2f' }}>
            <CardContent >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Error sx={{ color: '#d32f2f', fontSize: 32 }} />
                <Box>
                  <Typography variant="h6" sx={{ color: '#d32f2f' }}>
                    {dependencies.filter(d => d.severity === 'critical').length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Critical Updates
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card sx={{ bgcolor: '#e3f2fd', border: '1px solid #1976d2' }}>
            <CardContent >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Shield sx={{ color: '#1976d2', fontSize: 32 }} />
                <Box>
                  <Typography variant="h6" sx={{ color: '#1976d2' }}>
                    {dependencies.filter(d => d.isSecurityUpdate).length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Security Updates
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Category Tabs */}
      <Paper sx={{ width: '100%'}} >
        <Tabs
          value={tabValue}
          onChange={(_, newValue) => setTabValue(newValue)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1}}>
                {theming.getThemedIcon('analytics')}
                Overview
              </Box>
          }
          />
          {categories.map((category, index) => (
            <Tab
              key={category.name}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1}}>
                  {getCategoryIcon(category.name)}
                  {category.name.charAt(0).toUpperCase() + category.name.slice(1)}
                  {category.outdatedCount > 0 && (
                    <Badge badgeContent={category.outdatedCount} color="warning" />
                  )}
                </Box>
            }
            />
          ))}
        </Tabs>

        {/* Overview Tab */}
        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            {categories.map((category) => (
              <Grid item xs={12} md={6} lg={4} key={category.name}>
                <Card sx={{ height: '100%', border: `1px solid ${category.color}20` }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                      {React.cloneElement(getCategoryIcon(category.name) as React.ReactElement, { 
                        sx: { color: category.color, fontSize: 32 }
                    })}
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" sx={{ color: category.color }}>
                          {category.name.charAt(0).toUpperCase() + category.name.slice(1)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {category.description}
                        </Typography>
                      </Box>
                    </Box>
                    <Stack spacing={1}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                        <Typography variant="body2">Total: </Typography>
                        <Chip label={category.count} size="small" />
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                        <Typography variant="body2">Outdated: </Typography>
                        <Chip 
                          label={category.outdatedCount}
                          size="small" 
                          color={category.outdatedCount > 0 ? "warning" : "default"}
                        />
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                        <Typography variant="body2">Critical: </Typography>
                        <Chip 
                          label={category.criticalCount}
                          size="small" 
                          color={category.criticalCount > 0 ? "error" : "default"}
                        />
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </TabPanel>

        {/* Category-specific tabs */}
        {categories.map((category, categoryIndex) => (
          <TabPanel value={tabValue} index={categoryIndex + 1} key={category.name}>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Package</TableCell>
                    <TableCell>Current</TableCell>
                    <TableCell>Latest</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Component/System</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {getDependenciesByCategory(category.name).map((dependency) => (
                    <TableRow key={dependency.name}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1}}>
                          <Typography variant="body2" fontWeight="medium">
                            {dependency.name}
                          </Typography>
                          {dependency.isSecurityUpdate && (
                            <Shield sx={{ color: '#d32f2f', fontSize: 16 }} />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={dependency.current}
                          size="small" 
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={dependency.latest}
                          size="small" 
                          color={dependency.isOutdated ? "warning" : "success"}
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1}}>
                          {dependency.initialized ? (
                            <CheckCircle sx={{ color: '#2e7d32', fontSize: 20 }} />
                          ) : (
                            <Error sx={{ color: '#d32f2f', fontSize: 20 }} />
                          )}
                          <Chip
                            label={dependency.severity}
                            size="small"
                            sx={{ 
                              bgcolor: getSeverityColor(dependency.severity),
                              color: 'white',
                              fontSize: '0.75rem'
                        }}
                          />
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {dependency.component} / {dependency.system}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1}>
                          <Tooltip title="View Details">
                            <IconButton 
                              size="small"
                              onClick={() => setSelectedDependency(dependency)}
                            >
                              {theming.getThemedIcon('visibility')}
                            </IconButton>
                          </Tooltip>
                          {dependency.isOutdated && (
                            <Tooltip title="Update">
                              <IconButton 
                                size="small" 
                                color="primary"
                                onClick={() => {
                                  setSelectedDependency(dependency);
                                  setUpdateDialog(true);
                              }}
                              >
                                <Update />
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
          </TabPanel>
        ))}
      </Paper>

      {/* Update Dialog */}
      <Dialog 
        open={updateDialog}
        onClose={() => setUpdateDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Update Dependency: {selectedDependency?.name}
        </DialogTitle>
        <DialogContent>
          {selectedDependency && (
            <Box sx={{ mt: 2 }}>
              <Alert 
                severity={selectedDependency.severity === 'critical' ? 'error' : 'warning'}
                sx={{ mb: 2 }}
              >
                {selectedDependency.severity === 'critical' 
                  ? 'Critical security update required'
                  : 'Update recommended for improved functionality'
              }
              </Alert>
              
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>Benefits: </Typography>
              <List dense>
                {selectedDependency.benefits.map((benefit, index) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      <CheckCircle sx={{ color: '#2e7d32' }} />
                    </ListItemIcon>
                    <ListItemText primary={benefit} />
                  </ListItem>
                ))}
              </List>

              {selectedDependency.risks.length > 0 && (
                <>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>Potential Risks: </Typography>
                  <List dense>
                    {selectedDependency.risks.map((risk, index) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          <Warning sx={{ color: '#ff6f00' }} />
                        </ListItemIcon>
                        <ListItemText primary={risk} />
                      </ListItem>
                    ))}
                  </List>
                </>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUpdateDialog(false)}>
            Cancel
          </Button>
          <Button variant="contained"
            onClick={() => selectedDependency && updateDependency.mutate({
              name: selectedDependency.name,
              version: selectedDependency.latest
          })}
            disabled={updateDependency.isPending}
          >
            {updateDependency.isPending ? 'Updating...' : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Loading Overlay */}
      {isLoading && (
        <Box sx={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          bgcolor: 'rgba(255,255,255,0.7)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          zIndex: 100}}>
          <CircularProgress />
        </Box>
      )}
    </Box>
  );
}

export default DependenciesManager;